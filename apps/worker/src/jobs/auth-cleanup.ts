import { purgeExpiredRateLimits, purgeExpiredSessions, purgeOldCodes } from '@gl/core';
import type { Db } from '@gl/db';
import type { Logger } from '../logger';

/** Daily housekeeping of sign-in data: dead codes, long-expired sessions, finished rate windows. */
export const AUTH_CLEANUP_QUEUE = 'auth.cleanup';
export const AUTH_CLEANUP_CRON = '30 3 * * *';

export async function handleAuthCleanup(db: Db, logger: Logger) {
  const [codes, sessions, buckets] = await Promise.all([
    purgeOldCodes(db),
    purgeExpiredSessions(db),
    purgeExpiredRateLimits(db),
  ]);
  logger.info('auth.cleanup done', { codes, sessions, buckets });
  return { codes, sessions, buckets };
}
