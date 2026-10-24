import type { GuardianRelation, Prisma } from '@gl/db';
import { z } from 'zod';
import { can } from '../access/can';
import { requireScope } from '../access/scope';
import { normalizePhone } from '../auth/phone';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';

/**
 * Parents and guardians are users with the PARENT role and no password: they never sign in to
 * the web, only to the app and the bot later. A phone identifies one person: the same parent
 * of several children is one user with several links.
 */
export const guardianInput = z.object({
  studentId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(160),
  phone: z.string(),
  relation: z.enum(['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER']),
  isPrimary: z.boolean().default(false),
});
export type GuardianInput = z.input<typeof guardianInput>;

async function loadManageableStudent(ctx: ServiceContext, studentId: string) {
  const student = await ctx.db.student.findUnique({ where: { id: studentId } });
  if (!student || !can(ctx.actor, 'people.guardian.manage', { branchId: student.branchId }))
    return null;
  return student;
}

/**
 * Adds a guardian to a student: finds the user by phone or creates one (PARENT role, SMS
 * channel, no password), then links. The first guardian becomes the primary contact.
 */
export async function addGuardian(
  ctx: ServiceContext,
  input: GuardianInput,
): Promise<Result<{ guardianId: string; created: boolean }>> {
  const parsed = guardianInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { fullName: 'VALIDATION' });
  const student = await loadManageableStudent(ctx, parsed.data.studentId);
  if (!student) return err('NOT_FOUND');
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return err('PHONE_INVALID', undefined, { phone: 'PHONE_INVALID' });

  return ctx.db.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { phone } });
    const created = !user;
    if (user?.deletedAt) return err('PHONE_TAKEN', undefined, { phone: 'PHONE_TAKEN' });
    if (!user) {
      user = await tx.user.create({
        data: {
          phone,
          fullName: parsed.data.fullName,
          channels: { create: { type: 'SMS', address: phone, verifiedAt: new Date() } },
        },
      });
    }
    const parentRole = await tx.role.findUniqueOrThrow({ where: { code: 'PARENT' } });
    await tx.roleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: parentRole.id } },
      create: { userId: user.id, roleId: parentRole.id, grantedById: ctx.actor.userId },
      update: {},
    });
    if (
      await tx.guardianLink.findUnique({
        where: { guardianId_studentId: { guardianId: user.id, studentId: student.id } },
      })
    ) {
      return err('GUARDIAN_ALREADY_LINKED');
    }
    const hasPrimary = await tx.guardianLink.count({
      where: { studentId: student.id, isPrimary: true },
    });
    const isPrimary = parsed.data.isPrimary || hasPrimary === 0;
    if (isPrimary && hasPrimary > 0) {
      await tx.guardianLink.updateMany({
        where: { studentId: student.id },
        data: { isPrimary: false },
      });
    }
    await tx.guardianLink.create({
      data: {
        guardianId: user.id,
        studentId: student.id,
        relation: parsed.data.relation,
        isPrimary,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.guardian.link',
      entityType: 'Student',
      entityId: student.id,
      branchId: student.branchId,
      after: {
        guardianId: user.id,
        phone,
        relation: parsed.data.relation,
        isPrimary,
        createdUser: created,
      },
    });
    return ok({ guardianId: user.id, created });
  });
}

export async function updateGuardianLink(
  ctx: ServiceContext,
  input: {
    studentId: string;
    guardianId: string;
    relation?: GuardianRelation;
    isPrimary?: boolean;
  },
): Promise<Result<true>> {
  const student = await loadManageableStudent(ctx, input.studentId);
  if (!student) return err('NOT_FOUND');
  const link = await ctx.db.guardianLink.findUnique({
    where: { guardianId_studentId: { guardianId: input.guardianId, studentId: input.studentId } },
  });
  if (!link) return err('NOT_FOUND');
  await ctx.db.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.guardianLink.updateMany({
        where: { studentId: student.id },
        data: { isPrimary: false },
      });
    }
    await tx.guardianLink.update({
      where: { id: link.id },
      data: {
        ...(input.relation && { relation: input.relation }),
        ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.guardian.update',
      entityType: 'Student',
      entityId: student.id,
      branchId: student.branchId,
      before: { relation: link.relation, isPrimary: link.isPrimary },
      after: {
        relation: input.relation ?? link.relation,
        isPrimary: input.isPrimary ?? link.isPrimary,
      },
    });
  });
  return ok(true);
}

/** Removes the link (the parent's account stays — other children or the bot may use it). */
export async function unlinkGuardian(
  ctx: ServiceContext,
  input: { studentId: string; guardianId: string },
): Promise<Result<true>> {
  const student = await loadManageableStudent(ctx, input.studentId);
  if (!student) return err('NOT_FOUND');
  const link = await ctx.db.guardianLink.findUnique({
    where: { guardianId_studentId: { guardianId: input.guardianId, studentId: input.studentId } },
  });
  if (!link) return err('NOT_FOUND');
  await ctx.db.$transaction(async (tx) => {
    await tx.guardianLink.delete({ where: { id: link.id } });
    // Keep a primary contact if anyone is left.
    if (link.isPrimary) {
      const next = await tx.guardianLink.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'asc' },
      });
      if (next) await tx.guardianLink.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.guardian.unlink',
      entityType: 'Student',
      entityId: student.id,
      branchId: student.branchId,
      before: { guardianId: link.guardianId, relation: link.relation, isPrimary: link.isPrimary },
    });
  });
  return ok(true);
}

const PAGE_SIZE = 25;

/** Guardians of the students the actor sees, with their children (only visible ones). */
export async function listGuardians(
  ctx: ServiceContext,
  filters: { query?: string; page?: number; all?: boolean } = {},
) {
  const studentScope = requireScope(ctx.actor, 'people.guardian.view', {
    branch: 'branchId',
    class: 'classId',
  });
  const page = Math.max(1, filters.page ?? 1);
  if (!studentScope) return { total: 0, page, pageSize: PAGE_SIZE, guardians: [] };
  const visibleStudent = studentScope as Prisma.StudentWhereInput;
  const query = filters.query?.trim();
  const digits = query?.replace(/\D/g, '');
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    guardianLinks: { some: { student: visibleStudent } },
    ...(query && {
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    }),
  };
  const [total, guardians] = await Promise.all([
    ctx.db.user.count({ where }),
    ctx.db.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      ...(!filters.all && { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      select: {
        id: true,
        fullName: true,
        phone: true,
        guardianLinks: {
          where: { student: visibleStudent },
          select: {
            relation: true,
            isPrimary: true,
            student: {
              select: {
                id: true,
                number: true,
                lastName: true,
                firstName: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  return { total, page, pageSize: PAGE_SIZE, guardians };
}
