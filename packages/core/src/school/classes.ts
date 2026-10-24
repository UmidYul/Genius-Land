import type { ClassType, Prisma } from '@gl/db';
import { z } from 'zod';
import { can } from '../access/can';
import { requireScope } from '../access/scope';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';
import { nameKey, targetBranch } from './branch-target';

export const classInput = z
  .object({
    type: z.enum(['REGULAR', 'DIRECTION_GROUP']),
    name: z.string().trim().min(1).max(60),
    gradeLevel: z.number().int().min(1).max(7).nullable().optional(),
    directionId: z.string().uuid().nullable().optional(),
    capacity: z.number().int().min(1).max(100),
    homeroomTeacherId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    branchId: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // Classes 1–7 have a grade and no direction; groups 8–11 have a direction and no grade.
    if (v.type === 'REGULAR' && !v.gradeLevel) {
      ctx.addIssue({ code: 'custom', path: ['gradeLevel'], message: 'CLASS_GRADE_REQUIRED' });
    }
    if (v.type === 'DIRECTION_GROUP' && !v.directionId) {
      ctx.addIssue({ code: 'custom', path: ['directionId'], message: 'CLASS_DIRECTION_REQUIRED' });
    }
  });
export type ClassInput = z.input<typeof classInput>;

export interface ClassFilters {
  academicYearId?: string;
  type?: ClassType;
  gradeLevel?: number;
  directionId?: string;
  query?: string;
  includeArchived?: boolean;
}

/** Classes the actor may see, with occupancy (active students / capacity). */
export async function listClasses(ctx: ServiceContext, filters: ClassFilters = {}) {
  const scope = requireScope(ctx.actor, 'school.class.view', { branch: 'branchId', class: 'id' });
  if (!scope) return [];
  const classes = await ctx.db.class.findMany({
    where: {
      AND: [
        scope as Prisma.ClassWhereInput,
        {
          ...(!filters.includeArchived && { archivedAt: null }),
          ...(filters.academicYearId
            ? { academicYearId: filters.academicYearId }
            : { academicYear: { isCurrent: true } }),
          ...(filters.type && { type: filters.type }),
          ...(filters.gradeLevel && { gradeLevel: filters.gradeLevel }),
          ...(filters.directionId && { directionId: filters.directionId }),
          ...(filters.query && { name: { contains: filters.query.trim(), mode: 'insensitive' } }),
        },
      ],
    },
    orderBy: [{ type: 'asc' }, { gradeLevel: 'asc' }, { name: 'asc' }],
    include: {
      direction: true,
      homeroomTeacher: { select: { id: true, fullName: true } },
      academicYear: { select: { id: true, name: true } },
      branch: { select: { id: true, nameUz: true, nameRu: true } },
      _count: { select: { students: { where: { status: 'ACTIVE' } } } },
    },
  });
  return classes.map(({ _count, ...c }) => ({ ...c, occupied: _count.students }));
}

export async function getClass(ctx: ServiceContext, id: string) {
  const cls = await ctx.db.class.findUnique({
    where: { id },
    include: {
      direction: true,
      homeroomTeacher: true,
      academicYear: true,
      teachingAssignments: {
        include: { staff: true, subject: true },
        orderBy: { createdAt: 'asc' },
      },
      students: {
        where: { status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      },
    },
  });
  if (!cls || !can(ctx.actor, 'school.class.view', { branchId: cls.branchId, classId: cls.id })) {
    return null;
  }
  return cls;
}

async function checkReferences(
  ctx: ServiceContext,
  branchId: string,
  data: { homeroomTeacherId: string; directionId?: string | null; academicYearId: string },
): Promise<Result<true>> {
  const [teacher, year, direction] = await Promise.all([
    ctx.db.staff.findFirst({ where: { id: data.homeroomTeacherId, branchId, archivedAt: null } }),
    ctx.db.academicYear.findFirst({ where: { id: data.academicYearId, branchId } }),
    data.directionId ? ctx.db.direction.findUnique({ where: { id: data.directionId } }) : null,
  ]);
  if (!teacher) return err('VALIDATION', undefined, { homeroomTeacherId: 'VALIDATION' });
  if (!year) return err('YEAR_NOT_FOUND');
  if (data.directionId && (!direction || direction.archivedAt)) {
    return err('VALIDATION', undefined, { directionId: 'VALIDATION' });
  }
  return ok(true);
}

const fieldsFromZod = (issues: z.ZodIssue[]) =>
  Object.fromEntries(
    issues.map((i) => [
      i.path.join('.'),
      (i.message.startsWith('CLASS_') ? i.message : 'VALIDATION') as 'VALIDATION',
    ]),
  );

export async function createClass(
  ctx: ServiceContext,
  input: ClassInput,
): Promise<Result<{ id: string }>> {
  const parsed = classInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, fieldsFromZod(parsed.error.issues));
  const branch = targetBranch(ctx, 'school.class.manage', parsed.data.branchId);
  if (!branch.ok) return branch;
  const branchId = branch.value;
  const yearId =
    parsed.data.academicYearId ??
    (await ctx.db.academicYear.findFirst({ where: { branchId, isCurrent: true } }))?.id;
  if (!yearId) return err('YEAR_NOT_FOUND');
  const refs = await checkReferences(ctx, branchId, { ...parsed.data, academicYearId: yearId });
  if (!refs.ok) return refs;

  const key = nameKey(parsed.data.name);
  if (await ctx.db.class.findFirst({ where: { branchId, academicYearId: yearId, nameKey: key } })) {
    return err('CLASS_NAME_TAKEN', undefined, { name: 'CLASS_NAME_TAKEN' });
  }
  const isGroup = parsed.data.type === 'DIRECTION_GROUP';
  const created = await ctx.db.$transaction(async (tx) => {
    const cls = await tx.class.create({
      data: {
        branchId,
        academicYearId: yearId,
        type: parsed.data.type,
        name: parsed.data.name.replace(/\s+/g, ' '),
        nameKey: key,
        gradeLevel: isGroup ? null : parsed.data.gradeLevel!,
        directionId: isGroup ? parsed.data.directionId! : null,
        capacity: parsed.data.capacity,
        homeroomTeacherId: parsed.data.homeroomTeacherId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.class.create',
      entityType: 'Class',
      entityId: cls.id,
      branchId,
      after: { ...parsed.data, academicYearId: yearId },
    });
    return cls;
  });
  return ok({ id: created.id });
}

/** Edits a class. The type cannot change; capacity cannot drop below the current occupancy. */
export async function updateClass(
  ctx: ServiceContext,
  id: string,
  input: Omit<ClassInput, 'type' | 'branchId' | 'academicYearId'>,
): Promise<Result<{ id: string }>> {
  const cls = await ctx.db.class.findUnique({
    where: { id },
    include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
  });
  if (!cls || !can(ctx.actor, 'school.class.manage', { branchId: cls.branchId }))
    return err('NOT_FOUND');
  const parsed = classInput.safeParse({ ...input, type: cls.type });
  if (!parsed.success) return err('VALIDATION', undefined, fieldsFromZod(parsed.error.issues));
  if (parsed.data.capacity < cls._count.students) {
    return err(
      'CLASS_CAPACITY_BELOW_OCCUPANCY',
      { occupied: cls._count.students },
      { capacity: 'CLASS_CAPACITY_BELOW_OCCUPANCY' },
    );
  }
  const refs = await checkReferences(ctx, cls.branchId, {
    ...parsed.data,
    academicYearId: cls.academicYearId,
  });
  if (!refs.ok) return refs;
  const key = nameKey(parsed.data.name);
  const clash = await ctx.db.class.findFirst({
    where: {
      branchId: cls.branchId,
      academicYearId: cls.academicYearId,
      nameKey: key,
      id: { not: id },
    },
  });
  if (clash) return err('CLASS_NAME_TAKEN', undefined, { name: 'CLASS_NAME_TAKEN' });
  const isGroup = cls.type === 'DIRECTION_GROUP';

  await ctx.db.$transaction(async (tx) => {
    await tx.class.update({
      where: { id },
      data: {
        name: parsed.data.name.replace(/\s+/g, ' '),
        nameKey: key,
        gradeLevel: isGroup ? null : parsed.data.gradeLevel!,
        directionId: isGroup ? parsed.data.directionId! : null,
        capacity: parsed.data.capacity,
        homeroomTeacherId: parsed.data.homeroomTeacherId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.class.update',
      entityType: 'Class',
      entityId: id,
      branchId: cls.branchId,
      before: {
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        directionId: cls.directionId,
        capacity: cls.capacity,
        homeroomTeacherId: cls.homeroomTeacherId,
      },
      after: parsed.data,
    });
  });
  return ok({ id });
}

/** Archive only an empty class: students must be transferred first. */
export async function setClassArchived(
  ctx: ServiceContext,
  id: string,
  archived: boolean,
): Promise<Result<true>> {
  const cls = await ctx.db.class.findUnique({
    where: { id },
    include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
  });
  if (!cls || !can(ctx.actor, 'school.class.manage', { branchId: cls.branchId }))
    return err('NOT_FOUND');
  if (archived && cls._count.students > 0)
    return err('CLASS_HAS_STUDENTS', { count: cls._count.students });
  await ctx.db.$transaction(async (tx) => {
    await tx.class.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await writeAudit(tx, auditActor(ctx), {
      action: archived ? 'school.class.archive' : 'school.class.restore',
      entityType: 'Class',
      entityId: id,
      branchId: cls.branchId,
    });
  });
  return ok(true);
}

// ─── Teaching assignments ────────────────────────────────────────────────────

export async function addTeachingAssignment(
  ctx: ServiceContext,
  input: { classId: string; subjectId: string; staffId: string },
): Promise<Result<{ id: string }>> {
  const cls = await ctx.db.class.findUnique({ where: { id: input.classId } });
  if (!cls || !can(ctx.actor, 'school.teachingAssignment.manage', { branchId: cls.branchId })) {
    return err('NOT_FOUND');
  }
  if (cls.archivedAt) return err('CLASS_ARCHIVED');
  const [staff, subject] = await Promise.all([
    ctx.db.staff.findFirst({
      where: { id: input.staffId, branchId: cls.branchId, archivedAt: null },
    }),
    ctx.db.subject.findUnique({ where: { id: input.subjectId } }),
  ]);
  if (!staff) return err('VALIDATION', undefined, { staffId: 'VALIDATION' });
  if (!subject || subject.archivedAt)
    return err('VALIDATION', undefined, { subjectId: 'VALIDATION' });
  const exists = await ctx.db.teachingAssignment.findFirst({
    where: { branchId: cls.branchId, classId: cls.id, subjectId: subject.id, staffId: staff.id },
  });
  if (exists) return err('ASSIGNMENT_EXISTS');

  const created = await ctx.db.$transaction(async (tx) => {
    const row = await tx.teachingAssignment.create({
      data: { branchId: cls.branchId, classId: cls.id, subjectId: subject.id, staffId: staff.id },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.teachingAssignment.add',
      entityType: 'TeachingAssignment',
      entityId: row.id,
      branchId: cls.branchId,
      after: input,
    });
    return row;
  });
  return ok({ id: created.id });
}

export async function removeTeachingAssignment(
  ctx: ServiceContext,
  id: string,
): Promise<Result<true>> {
  const row = await ctx.db.teachingAssignment.findUnique({ where: { id } });
  if (!row || !can(ctx.actor, 'school.teachingAssignment.manage', { branchId: row.branchId })) {
    return err('NOT_FOUND');
  }
  await ctx.db.$transaction(async (tx) => {
    await tx.teachingAssignment.delete({ where: { id } });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.teachingAssignment.remove',
      entityType: 'TeachingAssignment',
      entityId: id,
      branchId: row.branchId,
      before: { classId: row.classId, subjectId: row.subjectId, staffId: row.staffId },
    });
  });
  return ok(true);
}
