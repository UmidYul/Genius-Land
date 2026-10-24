import type { Prisma } from '@gl/db';
import { z } from 'zod';
import { can } from '../access/can';
import { requireScope } from '../access/scope';
import { normalizePhone } from '../auth/phone';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';
import { targetBranch } from '../school/branch-target';

export const staffInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string(),
  position: z.string().trim().min(1).max(120),
  branchId: z.string().uuid().nullable().optional(),
});
export type StaffInput = z.input<typeof staffInput>;

const PAGE_SIZE = 25;

export interface StaffFilters {
  query?: string;
  includeArchived?: boolean;
  page?: number;
  /** For exports: no paging. */
  all?: boolean;
}

export async function listStaff(ctx: ServiceContext, filters: StaffFilters = {}) {
  const scope = requireScope(ctx.actor, 'people.staff.view', { branch: 'branchId' });
  const page = Math.max(1, filters.page ?? 1);
  if (!scope) return { total: 0, page, pageSize: PAGE_SIZE, staff: [] };
  const query = filters.query?.trim();
  const digits = query?.replace(/\D/g, '');
  const where: Prisma.StaffWhereInput = {
    AND: [
      scope as Prisma.StaffWhereInput,
      {
        ...(!filters.includeArchived && { archivedAt: null }),
        ...(query && {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { position: { contains: query, mode: 'insensitive' } },
            ...(digits ? [{ phone: { contains: digits } }] : []),
          ],
        }),
      },
    ],
  };
  const [total, staff] = await Promise.all([
    ctx.db.staff.count({ where }),
    ctx.db.staff.findMany({
      where,
      orderBy: { fullName: 'asc' },
      ...(!filters.all && { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      include: {
        branch: { select: { id: true, nameUz: true, nameRu: true } },
        user: { select: { id: true, status: true } },
        homeroomClasses: { where: { archivedAt: null }, select: { id: true, name: true } },
        _count: { select: { teachingAssignments: true } },
      },
    }),
  ]);
  return { total, page, pageSize: PAGE_SIZE, staff };
}

/** Active staff of a branch for pickers (homeroom teacher, teaching assignment). */
export function staffOptions(ctx: ServiceContext, branchId: string) {
  if (
    !can(ctx.actor, 'people.staff.view', { branchId }) &&
    !can(ctx.actor, 'school.class.manage', { branchId })
  ) {
    return Promise.resolve([]);
  }
  return ctx.db.staff.findMany({
    where: { branchId, archivedAt: null },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, position: true },
  });
}

/** The account with this phone, if one exists — staff and accounts are linked by phone. */
async function accountFor(ctx: ServiceContext, phone: string) {
  return ctx.db.user.findUnique({ where: { phone }, select: { id: true, deletedAt: true } });
}

export async function createStaff(
  ctx: ServiceContext,
  input: StaffInput,
): Promise<Result<{ id: string }>> {
  const parsed = staffInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { fullName: 'VALIDATION' });
  const branch = targetBranch(ctx, 'people.staff.manage', parsed.data.branchId);
  if (!branch.ok) return branch;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return err('PHONE_INVALID', undefined, { phone: 'PHONE_INVALID' });
  if (await ctx.db.staff.findFirst({ where: { branchId: branch.value, phone } })) {
    return err('STAFF_PHONE_TAKEN', undefined, { phone: 'STAFF_PHONE_TAKEN' });
  }
  const account = await accountFor(ctx, phone);
  const created = await ctx.db.$transaction(async (tx) => {
    const staff = await tx.staff.create({
      data: {
        branchId: branch.value,
        fullName: parsed.data.fullName,
        phone,
        position: parsed.data.position,
        userId: account && !account.deletedAt ? account.id : null,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.staff.create',
      entityType: 'Staff',
      entityId: staff.id,
      branchId: branch.value,
      after: { ...parsed.data, phone, linkedUserId: staff.userId },
    });
    return staff;
  });
  return ok({ id: created.id });
}

export async function updateStaff(
  ctx: ServiceContext,
  id: string,
  input: StaffInput,
): Promise<Result<{ id: string }>> {
  const staff = await ctx.db.staff.findUnique({ where: { id } });
  if (!staff || !can(ctx.actor, 'people.staff.manage', { branchId: staff.branchId }))
    return err('NOT_FOUND');
  const parsed = staffInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { fullName: 'VALIDATION' });
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return err('PHONE_INVALID', undefined, { phone: 'PHONE_INVALID' });
  if (
    await ctx.db.staff.findFirst({ where: { branchId: staff.branchId, phone, id: { not: id } } })
  ) {
    return err('STAFF_PHONE_TAKEN', undefined, { phone: 'STAFF_PHONE_TAKEN' });
  }
  const account = phone !== staff.phone ? await accountFor(ctx, phone) : null;
  await ctx.db.$transaction(async (tx) => {
    await tx.staff.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName,
        phone,
        position: parsed.data.position,
        ...(phone !== staff.phone && { userId: account && !account.deletedAt ? account.id : null }),
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.staff.update',
      entityType: 'Staff',
      entityId: id,
      branchId: staff.branchId,
      before: { fullName: staff.fullName, phone: staff.phone, position: staff.position },
      after: { ...parsed.data, phone },
    });
  });
  return ok({ id });
}

/** A staff member who is a homeroom teacher of an active class cannot be archived. */
export async function setStaffArchived(
  ctx: ServiceContext,
  id: string,
  archived: boolean,
): Promise<Result<true>> {
  const staff = await ctx.db.staff.findUnique({
    where: { id },
    include: { homeroomClasses: { where: { archivedAt: null }, select: { name: true } } },
  });
  if (!staff || !can(ctx.actor, 'people.staff.manage', { branchId: staff.branchId }))
    return err('NOT_FOUND');
  if (archived && staff.homeroomClasses.length > 0) {
    return err('STAFF_IS_HOMEROOM', {
      classes: staff.homeroomClasses.map((c) => c.name).join(', '),
    });
  }
  await ctx.db.$transaction(async (tx) => {
    await tx.staff.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    if (archived)
      await tx.teachingAssignment.deleteMany({ where: { staffId: id, branchId: staff.branchId } });
    await writeAudit(tx, auditActor(ctx), {
      action: archived ? 'people.staff.archive' : 'people.staff.restore',
      entityType: 'Staff',
      entityId: id,
      branchId: staff.branchId,
    });
  });
  return ok(true);
}

/**
 * Links staff records to a newly created account with the same phone (called when the
 * superadmin creates a user). Keeps "who is this teacher" and "who signs in" in one place.
 */
export async function linkStaffToUser(
  db: Prisma.TransactionClient | ServiceContext['db'],
  user: { id: string; phone: string },
) {
  await db.staff.updateMany({
    where: { phone: user.phone, userId: null, branchId: undefined },
    data: { userId: user.id },
  });
}
