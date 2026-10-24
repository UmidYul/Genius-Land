import type { Prisma, UserStatus } from '@gl/db';
import { z } from 'zod';
import { assertCan } from '../access/can';
import { isRoleCode, roleDefinitions, type RoleCode } from '../access/roles';
import { writeAudit } from '../audit';
import { generateTemporaryPassword, hashPassword } from '../auth/password';
import { normalizeEmail, normalizePhone } from '../auth/phone';
import { revokeOtherSessions } from '../auth/sessions';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type ErrorCode, type Result } from '../result';

export interface AssignmentInput {
  roleCode: RoleCode;
  /** Branches for branch-bound roles (director, administrator, teacher, accountant). */
  branchIds: string[];
}

const PAGE_SIZE = 25;

export interface UserListFilters {
  query?: string;
  status?: UserStatus;
  roleCode?: RoleCode;
  branchId?: string;
  page?: number;
}

export async function listUsers(ctx: ServiceContext, filters: UserListFilters = {}) {
  assertCan(ctx.actor, 'admin.user.view');
  const query = filters.query?.trim();
  const digits = query?.replace(/\D/g, '');
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(query && {
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query.toLowerCase() } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    }),
    ...((filters.roleCode || filters.branchId) && {
      roleAssignments: {
        some: {
          ...(filters.roleCode && { role: { code: filters.roleCode } }),
          ...(filters.branchId && { branches: { some: { branchId: filters.branchId } } }),
        },
      },
    }),
  };
  const page = Math.max(1, filters.page ?? 1);
  const [total, users] = await Promise.all([
    ctx.db.user.count({ where }),
    ctx.db.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        roleAssignments: { include: { role: true, branches: { select: { branchId: true } } } },
      },
    }),
  ]);
  return { total, page, pageSize: PAGE_SIZE, users };
}

export async function getUser(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, 'admin.user.view');
  return ctx.db.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      roleAssignments: { include: { role: true, branches: { select: { branchId: true } } } },
      channels: true,
    },
  });
}

// ─── Privilege rules ─────────────────────────────────────────────────────────

async function rankOf(ctx: ServiceContext, userId: string): Promise<number> {
  const assignments = await ctx.db.roleAssignment.findMany({
    where: { userId },
    select: { role: { select: { rank: true } } },
  });
  return Math.max(0, ...assignments.map((a) => a.role.rank));
}

/** A user may act on another user only if the target's highest role is not above their own. */
async function assertManageable(ctx: ServiceContext, targetId: string): Promise<Result<true>> {
  if ((await rankOf(ctx, targetId)) > ctx.actor.maxRank) return err('ROLE_ESCALATION');
  return ok(true);
}

async function activeSuperadminCount(ctx: ServiceContext, exceptUserId?: string) {
  return ctx.db.user.count({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      ...(exceptUserId && { id: { not: exceptUserId } }),
      roleAssignments: { some: { role: { code: 'SUPERADMIN' } } },
    },
  });
}

async function validateAssignments(
  ctx: ServiceContext,
  assignments: AssignmentInput[],
): Promise<Result<AssignmentInput[]>> {
  const seen = new Set<string>();
  const branchIds = new Set(
    (await ctx.db.branch.findMany({ select: { id: true } })).map((b) => b.id),
  );
  const clean: AssignmentInput[] = [];
  for (const a of assignments) {
    if (!isRoleCode(a.roleCode) || seen.has(a.roleCode)) return err('VALIDATION');
    seen.add(a.roleCode);
    const def = roleDefinitions[a.roleCode];
    // Escalation guard: only roles not above one's own highest role.
    if (def.rank > ctx.actor.maxRank) return err('ROLE_ESCALATION');
    const branches = [...new Set(a.branchIds)];
    if (branches.some((id) => !branchIds.has(id))) return err('VALIDATION');
    if (def.branchBound && branches.length === 0) {
      return err('ROLE_BRANCH_REQUIRED', { role: a.roleCode });
    }
    clean.push({ roleCode: a.roleCode, branchIds: def.branchBound ? branches : [] });
  }
  return ok(clean);
}

async function writeAssignments(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  userId: string,
  assignments: AssignmentInput[],
) {
  const roles = await tx.role.findMany({
    where: { code: { in: assignments.map((a) => a.roleCode) } },
  });
  await tx.roleAssignment.deleteMany({ where: { userId } });
  for (const a of assignments) {
    const role = roles.find((r) => r.code === a.roleCode);
    if (!role) throw new Error(`Role ${a.roleCode} is not seeded`);
    await tx.roleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        grantedById: ctx.actor.userId,
        branches: { create: a.branchIds.map((branchId) => ({ branchId })) },
      },
    });
  }
}

const assignmentsSnapshot = (
  list: { role: { code: string }; branches: { branchId: string }[] }[],
) => list.map((a) => ({ roleCode: a.role.code, branchIds: a.branches.map((b) => b.branchId) }));

// ─── Create / update ─────────────────────────────────────────────────────────

export const userInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string(),
  email: z.string().optional(),
  locale: z.enum(['uz', 'ru']).default('uz'),
});

type ContactResult = Result<{ phone: string; email: string | null }>;

async function checkContacts(
  ctx: ServiceContext,
  input: { phone: string; email?: string },
  exceptUserId?: string,
): Promise<ContactResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) return err('PHONE_INVALID', undefined, { phone: 'PHONE_INVALID' });
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  if (input.email?.trim() && !email)
    return err('EMAIL_INVALID', undefined, { email: 'EMAIL_INVALID' });

  const clash = await ctx.db.user.findFirst({
    where: {
      OR: [{ phone }, ...(email ? [{ email }] : [])],
      ...(exceptUserId && { id: { not: exceptUserId } }),
    },
    select: { phone: true },
  });
  if (clash) {
    const code: ErrorCode = clash.phone === phone ? 'PHONE_TAKEN' : 'EMAIL_TAKEN';
    return err(code, undefined, { [code === 'PHONE_TAKEN' ? 'phone' : 'email']: code });
  }
  return ok({ phone, email });
}

/**
 * Creates a staff account with a temporary password (returned once, to hand over in person).
 * The user must change it at first sign-in. The phone becomes the SMS channel right away.
 */
export async function createUser(
  ctx: ServiceContext,
  input: z.input<typeof userInput> & { assignments: AssignmentInput[] },
): Promise<Result<{ id: string; temporaryPassword: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  const parsed = userInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { fullName: 'VALIDATION' });
  const contacts = await checkContacts(ctx, parsed.data);
  if (!contacts.ok) return contacts;
  const assignments = await validateAssignments(ctx, input.assignments);
  if (!assignments.ok) return assignments;

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const { phone, email } = contacts.value;

  const user = await ctx.db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: parsed.data.fullName,
        phone,
        email,
        locale: parsed.data.locale,
        passwordHash,
        mustChangePassword: true,
        channels: {
          create: [
            { type: 'SMS', address: phone, verifiedAt: new Date() },
            // An e-mail typed by the superadmin is trusted as given; users verify their own.
            ...(email ? [{ type: 'EMAIL' as const, address: email, verifiedAt: new Date() }] : []),
          ],
        },
      },
    });
    await writeAssignments(tx, ctx, created.id, assignments.value);
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.user.create',
      entityType: 'User',
      entityId: created.id,
      after: { fullName: created.fullName, phone, email, assignments: assignments.value },
    });
    return created;
  });
  return ok({ id: user.id, temporaryPassword });
}

export async function updateUserProfile(
  ctx: ServiceContext,
  id: string,
  input: z.input<typeof userInput>,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  const manageable = await assertManageable(ctx, id);
  if (!manageable.ok) return manageable;
  const parsed = userInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { fullName: 'VALIDATION' });
  const before = await ctx.db.user.findFirst({ where: { id, deletedAt: null } });
  if (!before) return err('NOT_FOUND');
  const contacts = await checkContacts(ctx, parsed.data, id);
  if (!contacts.ok) return contacts;
  const { phone, email } = contacts.value;

  await ctx.db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { fullName: parsed.data.fullName, phone, email, locale: parsed.data.locale },
    });
    // Keep the contact channels in line with the account's phone and e-mail.
    if (before.phone !== phone) {
      await tx.notificationChannel.deleteMany({
        where: { userId: id, type: 'SMS', address: before.phone },
      });
      await tx.notificationChannel.create({
        data: { userId: id, type: 'SMS', address: phone, verifiedAt: new Date() },
      });
    }
    if (before.email !== email) {
      if (before.email) {
        await tx.notificationChannel.deleteMany({
          where: { userId: id, type: 'EMAIL', address: before.email },
        });
      }
      if (email) {
        await tx.notificationChannel.upsert({
          where: { userId_type_address: { userId: id, type: 'EMAIL', address: email } },
          create: { userId: id, type: 'EMAIL', address: email, verifiedAt: new Date() },
          update: { verifiedAt: new Date(), isEnabled: true },
        });
      }
    }
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.user.update',
      entityType: 'User',
      entityId: id,
      before: {
        fullName: before.fullName,
        phone: before.phone,
        email: before.email,
        locale: before.locale,
      },
      after: { fullName: parsed.data.fullName, phone, email, locale: parsed.data.locale },
    });
  });
  return ok({ id });
}

/** Replaces the user's roles and branches. Guards: rank, branch-bound roles, last superadmin. */
export async function setUserAssignments(
  ctx: ServiceContext,
  userId: string,
  assignments: AssignmentInput[],
  reason?: string | null,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  const manageable = await assertManageable(ctx, userId);
  if (!manageable.ok) return manageable;
  const clean = await validateAssignments(ctx, assignments);
  if (!clean.ok) return clean;

  const before = await ctx.db.roleAssignment.findMany({
    where: { userId },
    include: { role: true, branches: { select: { branchId: true } } },
  });
  // Removing a role above one's own is as much an escalation as granting it.
  if (before.some((a) => a.role.rank > ctx.actor.maxRank)) return err('ROLE_ESCALATION');

  const losesSuperadmin =
    before.some((a) => a.role.code === 'SUPERADMIN') &&
    !clean.value.some((a) => a.roleCode === 'SUPERADMIN');
  if (losesSuperadmin && (await activeSuperadminCount(ctx, userId)) === 0) {
    return err('LAST_SUPERADMIN');
  }

  await ctx.db.$transaction(async (tx) => {
    await writeAssignments(tx, ctx, userId, clean.value);
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.user.assignments',
      entityType: 'User',
      entityId: userId,
      before: assignmentsSnapshot(before),
      after: clean.value,
      reason: reason ?? null,
    });
  });
  return ok({ id: userId });
}

/** Manual block (status BLOCKED) — sign-in impossible and all sessions end. */
export async function setUserBlocked(
  ctx: ServiceContext,
  userId: string,
  blocked: boolean,
  reason?: string | null,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  if (userId === ctx.actor.userId) return err('SELF_ACTION');
  const manageable = await assertManageable(ctx, userId);
  if (!manageable.ok) return manageable;
  const user = await ctx.db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) return err('NOT_FOUND');
  if (blocked) {
    const isSuperadmin = await ctx.db.roleAssignment.count({
      where: { userId, role: { code: 'SUPERADMIN' } },
    });
    if (isSuperadmin && (await activeSuperadminCount(ctx, userId)) === 0) {
      return err('LAST_SUPERADMIN');
    }
  }
  const status: UserStatus = blocked ? 'BLOCKED' : 'ACTIVE';
  await ctx.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });
    if (blocked) await revokeOtherSessions(tx, userId, null);
    await writeAudit(tx, auditActor(ctx), {
      action: blocked ? 'admin.user.block' : 'admin.user.unblock',
      entityType: 'User',
      entityId: userId,
      before: { status: user.status },
      after: { status },
      reason: reason ?? null,
    });
  });
  return ok({ id: userId });
}

/** Lifts the temporary lock after too many wrong passwords. */
export async function unlockUser(
  ctx: ServiceContext,
  userId: string,
): Promise<Result<{ id: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  const manageable = await assertManageable(ctx, userId);
  if (!manageable.ok) return manageable;
  const user = await ctx.db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) return err('NOT_FOUND');
  await ctx.db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginCount: 0 },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.user.unlock',
      entityType: 'User',
      entityId: userId,
      before: { lockedUntil: user.lockedUntil, failedLoginCount: user.failedLoginCount },
      after: { lockedUntil: null, failedLoginCount: 0 },
    });
  });
  return ok({ id: userId });
}

/** New temporary password; the user must change it and is signed out everywhere. */
export async function resetUserPassword(
  ctx: ServiceContext,
  userId: string,
): Promise<Result<{ temporaryPassword: string }>> {
  assertCan(ctx.actor, 'admin.user.manage');
  const manageable = await assertManageable(ctx, userId);
  if (!manageable.ok) return manageable;
  const user = await ctx.db.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) return err('NOT_FOUND');
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await ctx.db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await revokeOtherSessions(tx, userId, null);
    await writeAudit(tx, auditActor(ctx), {
      action: 'admin.user.resetPassword',
      entityType: 'User',
      entityId: userId,
    });
  });
  return ok({ temporaryPassword });
}

/** Roles the actor may grant — for the role picker. */
export function grantableRoles(ctx: ServiceContext): RoleCode[] {
  return Object.values(roleDefinitions)
    .filter((def) => def.rank <= ctx.actor.maxRank)
    .map((def) => def.code);
}
