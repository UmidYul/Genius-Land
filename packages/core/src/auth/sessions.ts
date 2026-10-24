import type { Db, Session, SessionKind } from '@gl/db';
import { hashToken, hmac, randomToken, safeEqual } from './crypto';

export interface ClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

const clip = (value: string | null | undefined, max: number) =>
  value ? value.slice(0, max) : null;

export interface IssuedSession {
  session: Session;
  /** Raw token — goes to the cookie (web) or to the app (API refresh token). Never stored. */
  token: string;
}

export async function createSession(
  db: Db,
  input: { userId: string; kind: SessionKind; ttlDays: number } & ClientInfo,
): Promise<IssuedSession> {
  const token = randomToken();
  const session = await db.session.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      tokenHash: hashToken(token),
      ip: clip(input.ip, 45),
      userAgent: clip(input.userAgent, 400),
      expiresAt: new Date(Date.now() + input.ttlDays * 86_400_000),
    },
  });
  return { session, token };
}

const TOUCH_INTERVAL_MS = 5 * 60_000;

/** The live session for a raw token, or null if unknown, revoked or expired. */
export async function validateSessionToken(
  db: Db,
  token: string,
  kind: SessionKind = 'WEB',
): Promise<Session | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.kind !== kind || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session;
}

export const activeSessionWhere = (userId: string) => ({
  userId,
  revokedAt: null,
  expiresAt: { gt: new Date() },
});

export function listActiveSessions(db: Db, userId: string) {
  return db.session.findMany({
    where: activeSessionWhere(userId),
    orderBy: { lastSeenAt: 'desc' },
  });
}

export async function revokeSession(db: Db, userId: string, sessionId: string): Promise<boolean> {
  const { count } = await db.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count === 1;
}

/** "Sign out on other devices": everything except the current session. */
export async function revokeOtherSessions(
  db: Db,
  userId: string,
  keepSessionId: string | null,
): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(keepSessionId && { id: { not: keepSessionId } }) },
    data: { revokedAt: new Date() },
  });
  return count;
}

// ─── Trusted devices ─────────────────────────────────────────────────────────

/** Remembers the browser after a successful sign-in with a code. Returns the raw device token. */
export async function trustDevice(db: Db, userId: string, info: ClientInfo): Promise<string> {
  const token = randomToken();
  await db.trustedDevice.create({
    data: { userId, tokenHash: hashToken(token), userAgent: clip(info.userAgent, 400) },
  });
  return token;
}

export async function isTrustedDevice(
  db: Db,
  userId: string,
  token: string | null | undefined,
): Promise<boolean> {
  if (!token) return false;
  const device = await db.trustedDevice.findUnique({
    where: { userId_tokenHash: { userId, tokenHash: hashToken(token) } },
  });
  if (!device) return false;
  await db.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
  return true;
}

// ─── API tokens (groundwork for the parent/student app) ─────────────────────

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

interface AccessPayload {
  sid: string;
  uid: string;
  exp: number;
}

function signAccess(payload: AccessPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(`access:${body}`)}`;
}

export interface ApiTokens {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
}

function accessFor(session: Session): Pick<ApiTokens, 'accessToken' | 'expiresIn'> {
  return {
    accessToken: signAccess({
      sid: session.id,
      uid: session.userId,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    }),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/** Starts an API session: a short signed access token and a long opaque refresh token. */
export async function issueApiTokens(
  db: Db,
  input: { userId: string; ttlDays: number } & ClientInfo,
): Promise<ApiTokens> {
  const { session, token } = await createSession(db, { ...input, kind: 'API' });
  return { ...accessFor(session), refreshToken: token };
}

/**
 * Checks the signature and expiry, then that the session is still live — so revoking a session
 * ("sign out everywhere", password change) cuts off the app immediately.
 */
export async function verifyAccessToken(
  db: Db,
  accessToken: string,
): Promise<{ userId: string; sessionId: string } | null> {
  const [body, signature] = accessToken.split('.');
  if (!body || !signature || !safeEqual(signature, hmac(`access:${body}`))) return null;
  let payload: AccessPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AccessPayload;
  } catch {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  const session = await db.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.kind !== 'API' || session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now() || session.userId !== payload.uid) return null;
  return { userId: session.userId, sessionId: session.id };
}

/**
 * Exchanges a refresh token for a new pair. The refresh token rotates: the old one stops
 * working, so a stolen and already-used token is useless.
 */
export async function refreshApiTokens(db: Db, refreshToken: string): Promise<ApiTokens | null> {
  const session = await validateSessionToken(db, refreshToken, 'API');
  if (!session) return null;
  const next = randomToken();
  const { count } = await db.session.updateMany({
    where: { id: session.id, tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { tokenHash: hashToken(next), lastSeenAt: new Date() },
  });
  if (count !== 1) return null;
  return { ...accessFor(session), refreshToken: next };
}

export async function purgeExpiredSessions(db: Db, graceDays = 30): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - graceDays * 86_400_000) } },
  });
  return count;
}
