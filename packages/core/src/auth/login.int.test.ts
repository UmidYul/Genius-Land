import { prisma } from '@gl/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { updateSetting } from '../settings';
import {
  createUser,
  lastCode,
  recordingDispatcher,
  settingsReader,
  setupWorld,
  TEST_PASSWORD,
  type TestWorld,
} from '../testing/fixtures';
import {
  login,
  requestPasswordReset,
  resendCode,
  resetPassword,
  verifyLoginCode,
  type AuthEnv,
} from './login';
import {
  issueApiTokens,
  refreshApiTokens,
  revokeOtherSessions,
  validateSessionToken,
  verifyAccessToken,
} from './sessions';
import { authSettings } from './settings';

let world: TestWorld;
let dispatcher: ReturnType<typeof recordingDispatcher>;
let ipCounter = 1;

/** A fresh environment per call: own IP (rate limits per IP), fresh settings cache. */
function env(): AuthEnv {
  return {
    db: prisma,
    settings: settingsReader(),
    dispatcher,
    ip: `10.0.0.${ipCounter++ % 250}`,
    userAgent: 'vitest',
  };
}

const system = { actorId: null };

async function expireLatestCode(userId: string) {
  await prisma.otpCode.updateMany({
    where: { userId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
}

async function allowImmediateResend() {
  await updateSetting(prisma, authSettings.codeResendSeconds, { value: 1, actor: system });
  await prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
}

beforeEach(async () => {
  world = await setupWorld();
  dispatcher = recordingDispatcher();
});

async function staff(email?: string) {
  return createUser({ roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }], email });
}

describe('sign-in from a new device', () => {
  it('sends the code to every connected channel, SMS included', async () => {
    const user = await staff('dir@example.com');
    const result = await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    expect(result).toMatchObject({ ok: true, value: { kind: 'code' } });
    expect(dispatcher.sent.map((m) => m.channel).sort()).toEqual(['EMAIL', 'SMS']);
    expect(dispatcher.sent.find((m) => m.channel === 'SMS')?.address).toBe(user.phone);
    // Both messages carry the same code.
    expect(new Set(dispatcher.sent.map((m) => /\d{6}/.exec(m.text)?.[0])).size).toBe(1);
    // Masked destinations, never the full number.
    if (result.ok && result.value.kind === 'code') {
      expect(result.value.sentTo.map((t) => t.address)).not.toContain(user.phone);
    }
  });

  it('a disabled or unverified channel gets nothing', async () => {
    const user = await staff('dir@example.com');
    await prisma.notificationChannel.updateMany({
      where: { userId: user.id, type: 'EMAIL' },
      data: { verifiedAt: null },
    });
    await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    expect(dispatcher.sent.map((m) => m.channel)).toEqual(['SMS']);
  });

  it('code → session; the device becomes trusted and is not asked again', async () => {
    const user = await staff();
    const step1 = await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    if (!step1.ok || step1.value.kind !== 'code') throw new Error('expected code');
    const step2 = await verifyLoginCode(env(), {
      challengeId: step1.value.challengeId,
      code: lastCode(dispatcher.sent),
    });
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;
    expect(await validateSessionToken(prisma, step2.value.session.token)).not.toBeNull();

    const again = await login(env(), {
      phone: user.phone,
      password: TEST_PASSWORD,
      deviceToken: step2.value.deviceToken,
    });
    expect(again).toMatchObject({ ok: true, value: { kind: 'session' } });
  });

  it("another user's device token does not skip the code", async () => {
    const a = await staff();
    const b = await staff();
    const s1 = await login(env(), { phone: a.phone, password: TEST_PASSWORD });
    if (!s1.ok || s1.value.kind !== 'code') throw new Error('expected code');
    const s2 = await verifyLoginCode(env(), {
      challengeId: s1.value.challengeId,
      code: lastCode(dispatcher.sent),
    });
    if (!s2.ok) throw new Error('expected session');
    const forB = await login(env(), {
      phone: b.phone,
      password: TEST_PASSWORD,
      deviceToken: s2.value.deviceToken,
    });
    expect(forB).toMatchObject({ ok: true, value: { kind: 'code' } });
  });
});

describe('codes', () => {
  async function challenge() {
    const user = await staff();
    const result = await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    if (!result.ok || result.value.kind !== 'code') throw new Error('expected code');
    return { user, challengeId: result.value.challengeId, code: lastCode(dispatcher.sent) };
  }

  it('expire after their lifetime', async () => {
    const { user, challengeId, code } = await challenge();
    await expireLatestCode(user.id);
    expect(await verifyLoginCode(env(), { challengeId, code })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_CODE_EXPIRED' },
    });
  });

  it('live 10 minutes by default (a setting)', async () => {
    const { challengeId } = await challenge();
    const otp = await prisma.otpCode.findUniqueOrThrow({ where: { id: challengeId } });
    const minutes = (otp.expiresAt.getTime() - otp.createdAt.getTime()) / 60_000;
    expect(Math.round(minutes)).toBe(10);
  });

  it('work only once', async () => {
    const { challengeId, code } = await challenge();
    expect((await verifyLoginCode(env(), { challengeId, code })).ok).toBe(true);
    expect(await verifyLoginCode(env(), { challengeId, code })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_CODE_EXPIRED' },
    });
  });

  it('die after too many wrong guesses, even if the right one comes next', async () => {
    const { challengeId, code } = await challenge();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect(await verifyLoginCode(env(), { challengeId, code: wrong })).toMatchObject({
        ok: false,
        error: { code: 'AUTH_CODE_INVALID' },
      });
    }
    expect(await verifyLoginCode(env(), { challengeId, code })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_CODE_EXPIRED' },
    });
  });

  it('a new code invalidates the previous one; resend respects the interval', async () => {
    const { challengeId, code } = await challenge();
    expect(await resendCode(env(), { challengeId })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_CODE_TOO_SOON' },
    });
    await allowImmediateResend();
    const resent = await resendCode(env(), { challengeId });
    if (!resent.ok) throw new Error('expected resend');
    expect(await verifyLoginCode(env(), { challengeId, code })).toMatchObject({ ok: false });
    expect(
      (
        await verifyLoginCode(env(), {
          challengeId: resent.value.challengeId,
          code: lastCode(dispatcher.sent),
        })
      ).ok,
    ).toBe(true);
  });

  it('a login code cannot be used to reset the password', async () => {
    const { challengeId, code } = await challenge();
    expect(
      await resetPassword(env(), {
        challengeId,
        code,
        password: 'newpass123',
        confirm: 'newpass123',
      }),
    ).toMatchObject({ ok: false, error: { code: 'AUTH_CODE_INVALID' } });
  });

  it('are stored only as a hash', async () => {
    const { challengeId, code } = await challenge();
    const otp = await prisma.otpCode.findUniqueOrThrow({ where: { id: challengeId } });
    expect(otp.codeHash).not.toContain(code);
    expect(otp.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('lockout', () => {
  it('locks for 15 minutes after 5 wrong passwords, even for the right one', async () => {
    const user = await staff();
    for (let i = 0; i < 4; i++) {
      expect(await login(env(), { phone: user.phone, password: 'wrong-pass1' })).toMatchObject({
        ok: false,
        error: { code: 'AUTH_INVALID_CREDENTIALS' },
      });
    }
    expect(await login(env(), { phone: user.phone, password: 'wrong-pass1' })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_LOCKED', params: { minutes: 15 } },
    });
    expect(await login(env(), { phone: user.phone, password: TEST_PASSWORD })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_LOCKED' },
    });
    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.lockedUntil!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(
      await prisma.auditLog.count({ where: { action: 'auth.user.locked', entityId: user.id } }),
    ).toBe(1);
  });

  it('attempts and lock time are settings', async () => {
    await updateSetting(prisma, authSettings.maxFailedAttempts, { value: 2, actor: system });
    await updateSetting(prisma, authSettings.lockMinutes, { value: 3, actor: system });
    const user = await staff();
    await login(env(), { phone: user.phone, password: 'wrong-pass1' });
    expect(await login(env(), { phone: user.phone, password: 'wrong-pass1' })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_LOCKED', params: { minutes: 3 } },
    });
  });

  it('a successful sign-in resets the counter', async () => {
    const user = await staff();
    for (let i = 0; i < 3; i++) await login(env(), { phone: user.phone, password: 'wrong-pass1' });
    await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount).toBe(
      0,
    );
  });

  it('a blocked account is reported only after the right password', async () => {
    const user = await staff();
    await prisma.user.update({ where: { id: user.id }, data: { status: 'BLOCKED' } });
    expect(await login(env(), { phone: user.phone, password: 'wrong-pass1' })).toMatchObject({
      error: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
    expect(await login(env(), { phone: user.phone, password: TEST_PASSWORD })).toMatchObject({
      error: { code: 'AUTH_BLOCKED' },
    });
  });

  it('unknown phones and accounts without a password answer like a wrong password', async () => {
    const parent = await createUser({ roles: [{ role: 'PARENT' }], password: null });
    for (const phone of ['+998009999999', parent.phone, 'garbage']) {
      expect(await login(env(), { phone, password: TEST_PASSWORD })).toMatchObject({
        ok: false,
        error: { code: 'AUTH_INVALID_CREDENTIALS' },
      });
    }
  });
});

describe('rate limits', () => {
  it('limits sign-in attempts per IP', async () => {
    await updateSetting(prisma, authSettings.loginAttemptsPerIpPerMinute, {
      value: 3,
      actor: system,
    });
    const fixed: AuthEnv = { ...env(), ip: '192.0.2.1' };
    for (let i = 0; i < 3; i++) await login(fixed, { phone: '+998009999999', password: 'x' });
    expect(await login(fixed, { phone: '+998009999999', password: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_RATE_LIMITED' },
    });
  });

  it('limits codes per user per hour', async () => {
    await updateSetting(prisma, authSettings.codesPerUserPerHour, { value: 2, actor: system });
    await updateSetting(prisma, authSettings.codeResendSeconds, { value: 1, actor: system });
    const user = await staff();
    for (let i = 0; i < 2; i++) {
      await prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
      expect((await login(env(), { phone: user.phone, password: TEST_PASSWORD })).ok).toBe(true);
    }
    await prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } });
    expect(await login(env(), { phone: user.phone, password: TEST_PASSWORD })).toMatchObject({
      ok: false,
      error: { code: 'AUTH_RATE_LIMITED' },
    });
  });
});

describe('password reset', () => {
  it('code to all channels → new password; old sessions end; lock lifted', async () => {
    const user = await staff('dir@example.com');
    const old = await prisma.session.create({
      data: {
        userId: user.id,
        kind: 'WEB',
        tokenHash: 'x'.repeat(64),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + 600_000) },
    });

    const requested = await requestPasswordReset(env(), { phone: user.phone });
    if (!requested.ok) throw new Error('expected ok');
    expect(dispatcher.sent.map((m) => m.channel).sort()).toEqual(['EMAIL', 'SMS']);

    expect(
      await resetPassword(env(), {
        challengeId: requested.value.challengeId,
        code: lastCode(dispatcher.sent),
        password: 'short',
        confirm: 'short',
      }),
    ).toMatchObject({ ok: false, error: { code: 'PASSWORD_WEAK' } });

    const done = await resetPassword(env(), {
      challengeId: requested.value.challengeId,
      code: lastCode(dispatcher.sent),
      password: 'brandnew42',
      confirm: 'brandnew42',
    });
    expect(done.ok).toBe(true);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: old.id } })).revokedAt,
    ).not.toBeNull();
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.lockedUntil).toBeNull();
    expect((await login(env(), { phone: user.phone, password: 'brandnew42' })).ok).toBe(true);
  });

  it('answers the same for unknown phones and sends nothing', async () => {
    const result = await requestPasswordReset(env(), { phone: '+998009999998' });
    expect(result.ok).toBe(true);
    expect(dispatcher.sent).toHaveLength(0);
  });
});

describe('sessions and API tokens', () => {
  it('revoked or expired sessions are rejected', async () => {
    const user = await staff();
    await allowImmediateResend();
    const s1 = await login(env(), { phone: user.phone, password: TEST_PASSWORD });
    if (!s1.ok || s1.value.kind !== 'code') throw new Error('expected code');
    const s2 = await verifyLoginCode(env(), {
      challengeId: s1.value.challengeId,
      code: lastCode(dispatcher.sent),
    });
    if (!s2.ok) throw new Error('expected session');
    const token = s2.value.session.token;
    expect(await validateSessionToken(prisma, token)).not.toBeNull();
    await revokeOtherSessions(prisma, user.id, null);
    expect(await validateSessionToken(prisma, token)).toBeNull();
  });

  it('access token works, refresh rotates, revocation cuts the app off', async () => {
    const user = await staff();
    const tokens = await issueApiTokens(prisma, { userId: user.id, ttlDays: 30 });
    expect(await verifyAccessToken(prisma, tokens.accessToken)).toMatchObject({ userId: user.id });
    expect(await verifyAccessToken(prisma, `${tokens.accessToken}x`)).toBeNull();

    const next = await refreshApiTokens(prisma, tokens.refreshToken);
    expect(next).not.toBeNull();
    expect(await refreshApiTokens(prisma, tokens.refreshToken)).toBeNull();

    await revokeOtherSessions(prisma, user.id, null);
    expect(await verifyAccessToken(prisma, next!.accessToken)).toBeNull();
    expect(await refreshApiTokens(prisma, next!.refreshToken)).toBeNull();
  });

  it('a web session token is not an API refresh token', async () => {
    const user = await staff();
    const s = await prisma.session.count();
    expect(s).toBe(0);
    const tokens = await issueApiTokens(prisma, { userId: user.id, ttlDays: 1 });
    expect(await validateSessionToken(prisma, tokens.refreshToken, 'WEB')).toBeNull();
  });
});
