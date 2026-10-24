import type { UserLocale } from '@gl/db';
import { writeAudit } from '../audit';
import { issueCode, verifyCode } from '../auth/otp';
import { hashPassword, validatePassword, verifyPassword } from '../auth/password';
import { normalizeEmail } from '../auth/phone';
import { hitRateLimit } from '../auth/rate-limit';
import { listActiveSessions, revokeOtherSessions, revokeSession } from '../auth/sessions';
import { authSettings } from '../auth/settings';
import { auditActor, type ServiceContext } from '../context';
import type { NotificationDispatcher } from '../notifications/dispatcher';
import { err, ok, type Result } from '../result';
import type { SettingsReader } from '../settings';

/** The signed-in user's own account. No permission needed: SELF by definition. */
export function getProfile(ctx: ServiceContext) {
  return ctx.db.user.findUniqueOrThrow({
    where: { id: ctx.actor.userId },
    include: { channels: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function setLocale(ctx: ServiceContext, locale: UserLocale): Promise<Result<true>> {
  if (locale !== 'uz' && locale !== 'ru') return err('VALIDATION');
  await ctx.db.user.update({ where: { id: ctx.actor.userId }, data: { locale } });
  return ok(true);
}

/** Branch switcher. null — "all branches", allowed only with an ALL_BRANCHES/SYSTEM grant. */
export async function setPreferredBranch(
  ctx: ServiceContext,
  branchId: string | null,
): Promise<Result<true>> {
  if (
    branchId === null
      ? !ctx.actor.hasAllBranches
      : !ctx.actor.branches.some((b) => b.id === branchId)
  ) {
    return err('FORBIDDEN');
  }
  await ctx.db.user.update({
    where: { id: ctx.actor.userId },
    data: { preferredBranchId: branchId },
  });
  return ok(true);
}

/**
 * Changes the password (current one required). Other devices are signed out; the current
 * session stays.
 */
export async function changePassword(
  ctx: ServiceContext,
  input: { current: string; password: string; confirm: string; sessionId: string | null },
): Promise<Result<true>> {
  const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.actor.userId } });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.current))) {
    return err('PASSWORD_WRONG', undefined, { current: 'PASSWORD_WRONG' });
  }
  const valid = validatePassword(input.password);
  if (!valid.ok) return err('PASSWORD_WEAK', valid.error.params, { password: 'PASSWORD_WEAK' });
  if (input.password !== input.confirm) {
    return err('PASSWORD_MISMATCH', undefined, { confirm: 'PASSWORD_MISMATCH' });
  }
  await ctx.db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });
  await revokeOtherSessions(ctx.db, user.id, input.sessionId);
  await writeAudit(ctx.db, auditActor(ctx), {
    action: 'profile.password.change',
    entityType: 'User',
    entityId: user.id,
  });
  return ok(true);
}

export function listMySessions(ctx: ServiceContext) {
  return listActiveSessions(ctx.db, ctx.actor.userId);
}

export async function signOutSession(
  ctx: ServiceContext,
  sessionId: string,
): Promise<Result<true>> {
  return (await revokeSession(ctx.db, ctx.actor.userId, sessionId)) ? ok(true) : err('NOT_FOUND');
}

export async function signOutOtherSessions(
  ctx: ServiceContext,
  currentSessionId: string | null,
): Promise<Result<{ count: number }>> {
  const count = await revokeOtherSessions(ctx.db, ctx.actor.userId, currentSessionId);
  await writeAudit(ctx.db, auditActor(ctx), {
    action: 'profile.sessions.revokeOthers',
    entityType: 'User',
    entityId: ctx.actor.userId,
    after: { count },
  });
  return ok({ count });
}

// ─── Contact channels ────────────────────────────────────────────────────────

/**
 * Step 1 of adding an e-mail: a code goes to that address only. It becomes a channel (and
 * starts receiving sign-in codes) after step 2 proves the user owns it.
 */
export async function startEmailChannel(
  ctx: ServiceContext,
  deps: { settings: SettingsReader; dispatcher: NotificationDispatcher },
  rawEmail: string,
): Promise<Result<{ challengeId: string }>> {
  const email = normalizeEmail(rawEmail);
  if (!email) return err('EMAIL_INVALID', undefined, { email: 'EMAIL_INVALID' });
  const [channelTaken, accountTaken] = await Promise.all([
    ctx.db.notificationChannel.findFirst({
      where: {
        type: 'EMAIL',
        address: email,
        verifiedAt: { not: null },
        userId: { not: ctx.actor.userId },
      },
    }),
    ctx.db.user.findFirst({ where: { email, id: { not: ctx.actor.userId } } }),
  ]);
  if (channelTaken || accountTaken) return err('EMAIL_TAKEN', undefined, { email: 'EMAIL_TAKEN' });

  const perUser = await deps.settings.get(authSettings.codesPerUserPerHour);
  const hit = await hitRateLimit(ctx.db, `code:user:${ctx.actor.userId}`, perUser, 3600);
  if (!hit.allowed) return err('AUTH_RATE_LIMITED', { seconds: hit.retryAfterSeconds });

  const issued = await issueCode(ctx.db, deps.settings, {
    userId: ctx.actor.userId,
    purpose: 'CHANNEL_VERIFY',
    target: email,
  });
  if (!issued.ok) return issued;
  const minutes = await deps.settings.get(authSettings.codeTtlMinutes);
  await deps.dispatcher.dispatch(ctx.db, {
    userId: ctx.actor.userId,
    event: 'channelVerifyCode',
    params: { code: issued.value.code, minutes },
    critical: true,
    target: { channel: 'EMAIL', address: email },
  });
  return ok({ challengeId: issued.value.otpId });
}

export async function confirmEmailChannel(
  ctx: ServiceContext,
  deps: { settings: SettingsReader },
  input: { challengeId: string; code: string },
): Promise<Result<true>> {
  const verified = await verifyCode(ctx.db, deps.settings, {
    otpId: input.challengeId,
    purpose: 'CHANNEL_VERIFY',
    code: input.code,
  });
  if (!verified.ok) return verified;
  if (verified.value.userId !== ctx.actor.userId || !verified.value.target) {
    return err('AUTH_CODE_INVALID');
  }
  const email = verified.value.target;
  await ctx.db.$transaction(async (tx) => {
    // One e-mail per account: the verified one replaces the previous.
    await tx.notificationChannel.deleteMany({ where: { userId: ctx.actor.userId, type: 'EMAIL' } });
    await tx.notificationChannel.create({
      data: { userId: ctx.actor.userId, type: 'EMAIL', address: email, verifiedAt: new Date() },
    });
    await tx.user.update({ where: { id: ctx.actor.userId }, data: { email } });
    await writeAudit(tx, auditActor(ctx), {
      action: 'profile.channel.add',
      entityType: 'NotificationChannel',
      entityId: ctx.actor.userId,
      after: { type: 'EMAIL', address: email },
    });
  });
  return ok(true);
}

/** Removes an e-mail channel. The SMS channel is the account phone and cannot be removed here. */
export async function removeChannel(ctx: ServiceContext, channelId: string): Promise<Result<true>> {
  const channel = await ctx.db.notificationChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.userId !== ctx.actor.userId) return err('NOT_FOUND');
  if (channel.type === 'SMS') return err('FORBIDDEN');
  await ctx.db.$transaction(async (tx) => {
    await tx.notificationChannel.delete({ where: { id: channelId } });
    if (channel.type === 'EMAIL') {
      await tx.user.update({ where: { id: ctx.actor.userId }, data: { email: null } });
    }
    await writeAudit(tx, auditActor(ctx), {
      action: 'profile.channel.remove',
      entityType: 'NotificationChannel',
      entityId: channelId,
      before: { type: channel.type, address: channel.address },
    });
  });
  return ok(true);
}
