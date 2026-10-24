import { prisma } from '@gl/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { login } from '../auth/login';
import {
  confirmEmailChannel,
  changePassword,
  removeChannel,
  startEmailChannel,
} from '../profile/service';
import {
  contextFor,
  createUser,
  lastCode,
  recordingDispatcher,
  settingsReader,
  setupWorld,
  TEST_PASSWORD,
  type TestWorld,
} from '../testing/fixtures';
import { createBranch, updateBranch } from './branches';
import { changeSetting, listSettingValues } from './settings-admin';
import {
  createUser as adminCreateUser,
  resetUserPassword,
  setUserAssignments,
  setUserBlocked,
  unlockUser,
} from './users';

let world: TestWorld;

beforeEach(async () => {
  world = await setupWorld();
});

const superadminCtx = async () =>
  contextFor((await createUser({ roles: [{ role: 'SUPERADMIN' }] })).id);

describe('users', () => {
  it('creates a staff account with a temporary password, SMS channel and roles', async () => {
    const ctx = await superadminCtx();
    const result = await adminCreateUser(ctx, {
      fullName: 'Yangi Xodim',
      phone: '+998 00 123 45 67',
      email: 'NEW@example.com',
      locale: 'ru',
      assignments: [{ roleCode: 'ACCOUNTANT', branchIds: [world.branchA, world.branchB] }],
    });
    if (!result.ok) throw new Error(result.error.code);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.value.id },
      include: { channels: true, roleAssignments: { include: { branches: true } } },
    });
    expect(user).toMatchObject({
      phone: '+998001234567',
      email: 'new@example.com',
      mustChangePassword: true,
    });
    expect(user.channels.map((c) => c.type).sort()).toEqual(['EMAIL', 'SMS']);
    expect(user.roleAssignments[0]!.branches).toHaveLength(2);
    expect(user.passwordHash).not.toContain(result.value.temporaryPassword);
    expect(await prisma.auditLog.count({ where: { action: 'admin.user.create' } })).toBe(1);
  });

  it('rejects duplicates and branch-bound roles without a branch', async () => {
    const ctx = await superadminCtx();
    const existing = await createUser();
    expect(
      await adminCreateUser(ctx, { fullName: 'Dup', phone: existing.phone, assignments: [] }),
    ).toMatchObject({ error: { code: 'PHONE_TAKEN' } });
    expect(
      await adminCreateUser(ctx, {
        fullName: 'No branch',
        phone: '+998001112233',
        assignments: [{ roleCode: 'TEACHER', branchIds: [] }],
      }),
    ).toMatchObject({ error: { code: 'ROLE_BRANCH_REQUIRED' } });
  });

  it('only the superadmin may manage users', async () => {
    for (const role of ['FOUNDER', 'DIRECTOR'] as const) {
      const user = await createUser({ roles: [{ role, branchIds: [world.branchA] }] });
      const ctx = await contextFor(user.id);
      await expect(
        adminCreateUser(ctx, { fullName: 'X', phone: '+998001112244', assignments: [] }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('cannot grant or strip a role above one’s own rank', async () => {
    // A hypothetical manager below the founder: a superadmin whose rank is lowered for the test.
    const ctx = await superadminCtx();
    const weaker = { ...ctx, actor: { ...ctx.actor, maxRank: 70 } };
    const target = await createUser({ roles: [{ role: 'TEACHER', branchIds: [world.branchA] }] });
    expect(
      await setUserAssignments(weaker, target.id, [{ roleCode: 'FOUNDER', branchIds: [] }]),
    ).toMatchObject({ error: { code: 'ROLE_ESCALATION' } });
    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    expect(await setUserAssignments(weaker, founder.id, [])).toMatchObject({
      error: { code: 'ROLE_ESCALATION' },
    });
    expect(await setUserBlocked(weaker, founder.id, true)).toMatchObject({
      error: { code: 'ROLE_ESCALATION' },
    });
  });

  it('protects the last superadmin and forbids blocking oneself', async () => {
    const ctx = await superadminCtx();
    expect(await setUserAssignments(ctx, ctx.actor.userId, [])).toMatchObject({
      error: { code: 'LAST_SUPERADMIN' },
    });
    expect(await setUserBlocked(ctx, ctx.actor.userId, true)).toMatchObject({
      error: { code: 'SELF_ACTION' },
    });
    const second = await createUser({ roles: [{ role: 'SUPERADMIN' }] });
    expect((await setUserAssignments(ctx, second.id, [])).ok).toBe(true);
  });

  it('block ends sessions; unlock lifts the temporary lock; reset gives a new temporary password', async () => {
    const ctx = await superadminCtx();
    const target = await createUser({ roles: [{ role: 'TEACHER', branchIds: [world.branchA] }] });
    const session = await prisma.session.create({
      data: {
        userId: target.id,
        kind: 'WEB',
        tokenHash: 'y'.repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    expect((await setUserBlocked(ctx, target.id, true, 'test')).ok).toBe(true);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt,
    ).not.toBeNull();
    expect((await setUserBlocked(ctx, target.id, false)).ok).toBe(true);

    await prisma.user.update({
      where: { id: target.id },
      data: { lockedUntil: new Date(Date.now() + 600_000), failedLoginCount: 3 },
    });
    expect((await unlockUser(ctx, target.id)).ok).toBe(true);
    const env = {
      db: prisma,
      settings: settingsReader(),
      dispatcher: recordingDispatcher(),
      ip: '10.9.9.9',
    };
    expect((await login(env, { phone: target.phone, password: TEST_PASSWORD })).ok).toBe(true);

    const reset = await resetUserPassword(ctx, target.id);
    if (!reset.ok) throw new Error(reset.error.code);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.mustChangePassword).toBe(true);
    // The first sign-in just sent a code; step past the resend interval.
    await prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 3_600_000) } });
    expect(
      (await login(env, { phone: target.phone, password: reset.value.temporaryPassword })).ok,
    ).toBe(true);
  });
});

describe('branches', () => {
  it('superadmin creates and renames; codes are unique; changes are audited', async () => {
    const ctx = await superadminCtx();
    const created = await createBranch(ctx, {
      code: 'third',
      nameUz: 'Uchinchi',
      nameRu: 'Третий',
    });
    if (!created.ok) throw new Error(created.error.code);
    expect(await createBranch(ctx, { code: 'third', nameUz: 'X', nameRu: 'X' })).toMatchObject({
      error: { code: 'BRANCH_CODE_TAKEN' },
    });
    expect(
      (await updateBranch(ctx, created.value.id, { nameUz: 'Yangi', nameRu: 'Новый' })).ok,
    ).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityType: 'Branch' } })).toBe(2);
  });

  it('nobody else can manage branches', async () => {
    const founder = await createUser({ roles: [{ role: 'FOUNDER' }] });
    await expect(
      createBranch(await contextFor(founder.id), { code: 'x1', nameUz: 'X', nameRu: 'X' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('settings', () => {
  it('lists defaults and validates changes', async () => {
    const ctx = await superadminCtx();
    const before = await listSettingValues(ctx);
    expect(before.find((s) => s.key === 'auth.lockMinutes')?.value).toBe(15);
    expect(await changeSetting(ctx, { key: 'auth.lockMinutes', value: 0 })).toMatchObject({
      error: { code: 'SETTING_INVALID' },
    });
    expect(
      (await changeSetting(ctx, { key: 'auth.lockMinutes', value: 30, reason: 'policy' })).ok,
    ).toBe(true);
    expect((await listSettingValues(ctx)).find((s) => s.key === 'auth.lockMinutes')?.value).toBe(
      30,
    );
    expect(await changeSetting(ctx, { key: 'nope', value: 1 })).toMatchObject({
      error: { code: 'SETTING_UNKNOWN' },
    });
  });
});

describe('profile', () => {
  it('adds an e-mail only after its code; the code goes to that address only', async () => {
    const user = await createUser({ roles: [{ role: 'TEACHER', branchIds: [world.branchA] }] });
    const ctx = await contextFor(user.id);
    const dispatcher = recordingDispatcher();
    const started = await startEmailChannel(
      ctx,
      { settings: settingsReader(), dispatcher },
      'Me@Example.com',
    );
    if (!started.ok) throw new Error(started.error.code);
    expect(dispatcher.sent.map((m) => [m.channel, m.address])).toEqual([
      ['EMAIL', 'me@example.com'],
    ]);
    expect(
      await prisma.notificationChannel.count({ where: { userId: user.id, type: 'EMAIL' } }),
    ).toBe(0);

    const confirmed = await confirmEmailChannel(
      ctx,
      { settings: settingsReader() },
      {
        challengeId: started.value.challengeId,
        code: lastCode(dispatcher.sent),
      },
    );
    expect(confirmed.ok).toBe(true);
    const channel = await prisma.notificationChannel.findFirstOrThrow({
      where: { userId: user.id, type: 'EMAIL' },
    });
    expect(channel.verifiedAt).not.toBeNull();

    const sms = await prisma.notificationChannel.findFirstOrThrow({
      where: { userId: user.id, type: 'SMS' },
    });
    expect(await removeChannel(ctx, sms.id)).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect((await removeChannel(ctx, channel.id)).ok).toBe(true);
  });

  it("someone else's verification code does not work", async () => {
    const a = await createUser();
    const b = await createUser();
    const dispatcher = recordingDispatcher();
    const started = await startEmailChannel(
      await contextFor(a.id),
      { settings: settingsReader(), dispatcher },
      'a@example.com',
    );
    if (!started.ok) throw new Error(started.error.code);
    expect(
      await confirmEmailChannel(
        await contextFor(b.id),
        { settings: settingsReader() },
        {
          challengeId: started.value.challengeId,
          code: lastCode(dispatcher.sent),
        },
      ),
    ).toMatchObject({ ok: false });
  });

  it('password change needs the current password and keeps only this session', async () => {
    const user = await createUser();
    const ctx = await contextFor(user.id);
    const keep = await prisma.session.create({
      data: {
        userId: user.id,
        kind: 'WEB',
        tokenHash: 'k'.repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const other = await prisma.session.create({
      data: {
        userId: user.id,
        kind: 'WEB',
        tokenHash: 'o'.repeat(64),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    expect(
      await changePassword(ctx, {
        current: 'wrong',
        password: 'newpass123',
        confirm: 'newpass123',
        sessionId: keep.id,
      }),
    ).toMatchObject({ error: { code: 'PASSWORD_WRONG' } });
    expect(
      (
        await changePassword(ctx, {
          current: TEST_PASSWORD,
          password: 'newpass123',
          confirm: 'newpass123',
          sessionId: keep.id,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: keep.id } })).revokedAt,
    ).toBeNull();
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: other.id } })).revokedAt,
    ).not.toBeNull();
  });
});
