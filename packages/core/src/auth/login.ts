import type { PrismaClient, User } from '@gl/db';
import { writeAudit } from '../audit';
import type { ChannelKind, NotificationDispatcher } from '../notifications/dispatcher';
import { err, ok, type Result } from '../result';
import type { SettingsReader } from '../settings';
import { maskEmail, maskPhone, normalizePhone } from './phone';
import { hashPassword, validatePassword, verifyAgainstDummy, verifyPassword } from './password';
import { hitRateLimit } from './rate-limit';
import { issueCode, verifyCode } from './otp';
import {
  createSession,
  isTrustedDevice,
  revokeOtherSessions,
  trustDevice,
  type ClientInfo,
  type IssuedSession,
} from './sessions';
import { authSettings } from './settings';

/** Everything the sign-in flow needs; no actor yet — the user is not known. */
export interface AuthEnv extends ClientInfo {
  db: PrismaClient;
  settings: SettingsReader;
  dispatcher: NotificationDispatcher;
}

export interface CodeSent {
  /** Id of the code; the web keeps it in an httpOnly cookie between the two steps. */
  challengeId: string;
  /** Masked destinations, for "the code was sent to …". */
  sentTo: { channel: ChannelKind; address: string }[];
  expiresAt: Date;
}

export type LoginOutcome =
  | { kind: 'session'; session: IssuedSession; userId: string; mustChangePassword: boolean }
  | ({ kind: 'code' } & CodeSent);

const mask = (channel: ChannelKind, address: string) =>
  channel === 'SMS' ? maskPhone(address) : channel === 'EMAIL' ? maskEmail(address) : address;

const audit = (env: AuthEnv, actorId: string | null, action: string, after?: unknown) =>
  writeAudit(
    env.db,
    { actorId, ip: env.ip ?? null },
    {
      action,
      entityType: 'User',
      entityId: actorId,
      after,
    },
  );

async function findStaffByPhone(env: AuthEnv, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const user = await env.db.user.findUnique({ where: { phone } });
  return user && !user.deletedAt && user.passwordHash ? user : null;
}

async function limitCodes(env: AuthEnv, userId: string): Promise<Result<true>> {
  const [perUser, perIp] = await Promise.all([
    env.settings.get(authSettings.codesPerUserPerHour),
    env.settings.get(authSettings.codesPerIpPerHour),
  ]);
  const checks = [hitRateLimit(env.db, `code:user:${userId}`, perUser, 3600)];
  if (env.ip) checks.push(hitRateLimit(env.db, `code:ip:${env.ip}`, perIp, 3600));
  const denied = (await Promise.all(checks)).find((r) => !r.allowed);
  return denied ? err('AUTH_RATE_LIMITED', { seconds: denied.retryAfterSeconds }) : ok(true);
}

/** Issues a code and sends it to every connected channel, SMS included. */
async function sendCode(
  env: AuthEnv,
  user: Pick<User, 'id'>,
  purpose: 'LOGIN' | 'PASSWORD_RESET',
): Promise<Result<CodeSent>> {
  const limited = await limitCodes(env, user.id);
  if (!limited.ok) return limited;
  const issued = await issueCode(env.db, env.settings, { userId: user.id, purpose });
  if (!issued.ok) return issued;

  const minutes = await env.settings.get(authSettings.codeTtlMinutes);
  const { sentTo } = await env.dispatcher.dispatch(env.db, {
    userId: user.id,
    event: purpose === 'LOGIN' ? 'loginCode' : 'passwordResetCode',
    params: { code: issued.value.code, minutes },
    critical: true,
  });
  if (sentTo.length === 0) return err('AUTH_NO_CHANNEL');
  return ok({
    challengeId: issued.value.otpId,
    sentTo: sentTo.map((t) => ({ channel: t.channel, address: mask(t.channel, t.address) })),
    expiresAt: issued.value.expiresAt,
  });
}

async function startSession(env: AuthEnv, user: User): Promise<LoginOutcome> {
  const ttlDays = await env.settings.get(authSettings.sessionTtlDays);
  const session = await createSession(env.db, {
    userId: user.id,
    kind: 'WEB',
    ttlDays,
    ip: env.ip,
    userAgent: env.userAgent,
  });
  await env.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(env, user.id, 'auth.login.success', { sessionId: session.session.id });
  return {
    kind: 'session',
    session,
    userId: user.id,
    mustChangePassword: user.mustChangePassword,
  };
}

const lockedFor = (user: Pick<User, 'lockedUntil'>) =>
  user.lockedUntil && user.lockedUntil.getTime() > Date.now()
    ? Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
    : 0;

/**
 * Step 1: phone + password. From a trusted device the session starts right away; from a new
 * device a code is sent to all channels and step 2 ({@link verifyLoginCode}) follows.
 * Errors never reveal whether the phone has an account.
 */
export async function login(
  env: AuthEnv,
  input: { phone: string; password: string; deviceToken?: string | null },
): Promise<Result<LoginOutcome>> {
  if (env.ip) {
    const limit = await env.settings.get(authSettings.loginAttemptsPerIpPerMinute);
    const hit = await hitRateLimit(env.db, `login:ip:${env.ip}`, limit, 60);
    if (!hit.allowed) return err('AUTH_RATE_LIMITED', { seconds: hit.retryAfterSeconds });
  }

  const user = await findStaffByPhone(env, input.phone);
  if (!user) {
    await verifyAgainstDummy(input.password);
    return err('AUTH_INVALID_CREDENTIALS');
  }

  // A temporary lock is reported without checking the password: guesses do not count then.
  const minutes = lockedFor(user);
  if (minutes > 0) return err('AUTH_LOCKED', { minutes });

  if (!(await verifyPassword(user.passwordHash!, input.password))) {
    const [maxAttempts, lockMinutes] = await Promise.all([
      env.settings.get(authSettings.maxFailedAttempts),
      env.settings.get(authSettings.lockMinutes),
    ]);
    const failed = user.failedLoginCount + 1;
    if (failed >= maxAttempts) {
      await env.db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + lockMinutes * 60_000) },
      });
      await audit(env, user.id, 'auth.user.locked', { minutes: lockMinutes });
      return err('AUTH_LOCKED', { minutes: lockMinutes });
    }
    await env.db.user.update({ where: { id: user.id }, data: { failedLoginCount: failed } });
    await audit(env, user.id, 'auth.login.failed', { failedLoginCount: failed });
    return err('AUTH_INVALID_CREDENTIALS');
  }

  // The password is right: only now say that the account is blocked.
  if (user.status === 'BLOCKED') return err('AUTH_BLOCKED');
  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await env.db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  if (await isTrustedDevice(env.db, user.id, input.deviceToken)) {
    return ok(await startSession(env, user));
  }
  const sent = await sendCode(env, user, 'LOGIN');
  if (!sent.ok) return sent;
  return ok({ kind: 'code', ...sent.value });
}

/** Step 2 on a new device: the code. On success the device becomes trusted. */
export async function verifyLoginCode(
  env: AuthEnv,
  input: { challengeId: string; code: string },
): Promise<Result<LoginOutcome & { kind: 'session' } & { deviceToken: string }>> {
  const verified = await verifyCode(env.db, env.settings, {
    otpId: input.challengeId,
    purpose: 'LOGIN',
    code: input.code,
  });
  if (!verified.ok) return verified;

  const user = await env.db.user.findUnique({ where: { id: verified.value.userId } });
  if (!user || user.deletedAt) return err('AUTH_INVALID_CREDENTIALS');
  if (user.status === 'BLOCKED') return err('AUTH_BLOCKED');
  const minutes = lockedFor(user);
  if (minutes > 0) return err('AUTH_LOCKED', { minutes });

  const deviceToken = await trustDevice(env.db, user.id, env);
  const outcome = (await startSession(env, user)) as LoginOutcome & { kind: 'session' };
  return ok({ ...outcome, deviceToken });
}

/** "Send the code again" for an open challenge (respects the resend interval and limits). */
export async function resendCode(
  env: AuthEnv,
  input: { challengeId: string },
): Promise<Result<CodeSent>> {
  const previous = await env.db.otpCode.findUnique({ where: { id: input.challengeId } });
  if (!previous || previous.purpose === 'CHANNEL_VERIFY') return err('AUTH_CODE_EXPIRED');
  const user = await env.db.user.findUnique({ where: { id: previous.userId } });
  if (!user || user.deletedAt || user.status === 'BLOCKED') return err('AUTH_CODE_EXPIRED');
  return sendCode(env, user, previous.purpose);
}

/**
 * Password reset, step 1. The answer is the same whether the phone exists or not, so the form
 * cannot be used to find out who has an account.
 */
export async function requestPasswordReset(
  env: AuthEnv,
  input: { phone: string },
): Promise<Result<{ challengeId: string }>> {
  const phone = normalizePhone(input.phone);
  if (!phone) return err('PHONE_INVALID');
  if (env.ip) {
    const perIp = await env.settings.get(authSettings.codesPerIpPerHour);
    const hit = await hitRateLimit(env.db, `reset:ip:${env.ip}`, perIp, 3600);
    if (!hit.allowed) return err('AUTH_RATE_LIMITED', { seconds: hit.retryAfterSeconds });
  }

  const user = await findStaffByPhone(env, phone);
  if (!user || user.status === 'BLOCKED') return ok({ challengeId: crypto.randomUUID() });

  const sent = await sendCode(env, user, 'PASSWORD_RESET');
  if (!sent.ok) {
    // Too-soon / rate-limit are shown so a person who asked twice knows to wait. They appear only
    // for real accounts after a recent request — an accepted, minor trade-off for usability.
    if (sent.error.code === 'AUTH_CODE_TOO_SOON' || sent.error.code === 'AUTH_RATE_LIMITED') {
      return sent;
    }
    return ok({ challengeId: crypto.randomUUID() });
  }
  await audit(env, user.id, 'auth.passwordReset.requested');
  return ok({ challengeId: sent.value.challengeId });
}

/**
 * Password reset, step 2: code + new password. Unlocks the account and signs out every device —
 * whoever knew the old password loses access.
 */
export async function resetPassword(
  env: AuthEnv,
  input: { challengeId: string; code: string; password: string; confirm: string },
): Promise<Result<{ userId: string }>> {
  const valid = validatePassword(input.password);
  if (!valid.ok) return valid;
  if (input.password !== input.confirm) return err('PASSWORD_MISMATCH');

  const verified = await verifyCode(env.db, env.settings, {
    otpId: input.challengeId,
    purpose: 'PASSWORD_RESET',
    code: input.code,
  });
  if (!verified.ok) return verified;
  const userId = verified.value.userId;

  await env.db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeOtherSessions(env.db, userId, null);
  await audit(env, userId, 'auth.passwordReset.completed');
  return ok({ userId });
}
