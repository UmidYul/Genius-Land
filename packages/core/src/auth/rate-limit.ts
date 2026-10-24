import type { Db } from '@gl/db';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in PostgreSQL — no extra service, shared by every web instance.
 * One atomic statement: the window resets when its time has passed.
 */
export async function hitRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}), now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1
                     ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt"
                       ELSE "RateLimitBucket"."resetAt" END,
      "updatedAt" = now()
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (!row || row.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Removes finished windows; run periodically by the worker. */
export async function purgeExpiredRateLimits(db: Db): Promise<number> {
  const { count } = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
