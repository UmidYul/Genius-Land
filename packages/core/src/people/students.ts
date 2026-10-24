import type { Class, Prisma, StudentStatus } from '@gl/db';
import { z } from 'zod';
import { can } from '../access/can';
import { requireScope } from '../access/scope';
import { normalizePhone } from '../auth/phone';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';
import { targetBranch } from '../school/branch-target';
import { dateKey, fromDbDate, toDbDate } from '../school/dates';
import { parseIsoDate, toLocalDate, type LocalDate } from '../time';

export const studentInput = z.object({
  lastName: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(1).max(80),
  middleName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  birthDate: z.string(),
  gender: z.enum(['MALE', 'FEMALE']),
  gradeLevel: z.number().int().min(1).max(11),
  classId: z.string().uuid().nullable().optional(),
  emergencyContactName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => v || null),
  emergencyContactPhone: z.string().optional(),
  branchId: z.string().uuid().nullable().optional(),
  /** The user saw the "possible duplicate" warning and confirmed. */
  confirmDuplicate: z.boolean().default(false),
});
export type StudentInput = z.input<typeof studentInput>;

/** Birth date: a real date, not in the future (school time). */
export function validateBirthDate(iso: string): Result<LocalDate> {
  const date = parseIsoDate(iso);
  if (!date || dateKey(date) > dateKey(toLocalDate(new Date())) || date.year < 1990) {
    return err('BIRTHDATE_INVALID', undefined, { birthDate: 'BIRTHDATE_INVALID' });
  }
  return ok(date);
}

/**
 * The grade rule. Classes 1–7: the student's grade equals the class's grade.
 * Direction groups: students of grades 8–11 only (the grade is just an attribute).
 */
export function checkGradeForClass(
  cls: Pick<Class, 'type' | 'gradeLevel'>,
  gradeLevel: number,
): Result<true> {
  if (cls.type === 'REGULAR' && cls.gradeLevel !== gradeLevel) {
    return err(
      'CLASS_GRADE_MISMATCH',
      { grade: cls.gradeLevel ?? 0 },
      { gradeLevel: 'CLASS_GRADE_MISMATCH' },
    );
  }
  if (cls.type === 'DIRECTION_GROUP' && (gradeLevel < 8 || gradeLevel > 11)) {
    return err('GROUP_GRADE_INVALID', undefined, { gradeLevel: 'GROUP_GRADE_INVALID' });
  }
  return ok(true);
}

/**
 * Locks the class row and checks capacity, so two simultaneous enrolments cannot both take
 * the last place. Must run inside the transaction that adds the student.
 */
async function lockSeat(tx: Prisma.TransactionClient, classId: string): Promise<Result<true>> {
  await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${classId}::uuid FOR UPDATE`;
  const cls = await tx.class.findUniqueOrThrow({
    where: { id: classId },
    include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
  });
  if (cls._count.students >= cls.capacity) {
    return err('CLASS_FULL', { capacity: cls.capacity }, { classId: 'CLASS_FULL' });
  }
  return ok(true);
}

async function loadTargetClass(ctx: ServiceContext, classId: string, branchId: string) {
  const cls = await ctx.db.class.findFirst({ where: { id: classId, branchId } });
  if (!cls) return err('VALIDATION', undefined, { classId: 'VALIDATION' });
  if (cls.archivedAt) return err('CLASS_ARCHIVED', undefined, { classId: 'CLASS_ARCHIVED' });
  return ok(cls);
}

/** Students with the same name and birth date anywhere in the school. */
export function findPossibleDuplicates(
  ctx: ServiceContext,
  input: { lastName: string; firstName: string; birthDate: LocalDate },
  exceptId?: string,
) {
  return ctx.db.student.findMany({
    where: {
      branchId: undefined, // School-wide check: only number and class are shown back.
      lastName: { equals: input.lastName.trim(), mode: 'insensitive' },
      firstName: { equals: input.firstName.trim(), mode: 'insensitive' },
      birthDate: toDbDate(input.birthDate),
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true, number: true, branchId: true },
  });
}

export interface CreateStudentResult {
  id: string;
  number: string;
}

export async function createStudent(
  ctx: ServiceContext,
  input: StudentInput,
): Promise<Result<CreateStudentResult>> {
  const parsed = studentInput.safeParse(input);
  if (!parsed.success) {
    return err(
      'VALIDATION',
      undefined,
      Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), 'VALIDATION']),
      ) as Record<string, 'VALIDATION'>,
    );
  }
  const data = parsed.data;
  const branch = targetBranch(ctx, 'people.student.manage', data.branchId);
  if (!branch.ok) return branch;
  const birthDate = validateBirthDate(data.birthDate);
  if (!birthDate.ok) return birthDate;
  const emergencyPhone = data.emergencyContactPhone?.trim()
    ? normalizePhone(data.emergencyContactPhone)
    : null;
  if (data.emergencyContactPhone?.trim() && !emergencyPhone) {
    return err('PHONE_INVALID', undefined, { emergencyContactPhone: 'PHONE_INVALID' });
  }

  let cls: Class | null = null;
  if (data.classId) {
    const loaded = await loadTargetClass(ctx, data.classId, branch.value);
    if (!loaded.ok) return loaded;
    cls = loaded.value;
    const grade = checkGradeForClass(cls, data.gradeLevel);
    if (!grade.ok) return grade;
  }

  if (!data.confirmDuplicate) {
    const duplicates = await findPossibleDuplicates(ctx, { ...data, birthDate: birthDate.value });
    if (duplicates.length > 0) {
      // Numbers only from branches the actor sees; another branch's students stay anonymous.
      const visible = duplicates.filter((d) => ctx.actor.branches.some((b) => b.id === d.branchId));
      return visible.length > 0
        ? err('STUDENT_POSSIBLE_DUPLICATE', { numbers: visible.map((d) => d.number).join(', ') })
        : err('STUDENT_POSSIBLE_DUPLICATE_OTHER_BRANCH');
    }
  }

  const result = await ctx.db.$transaction(async (tx) => {
    if (cls) {
      const seat = await lockSeat(tx, cls.id);
      if (!seat.ok) return seat;
    }
    const student = await tx.student.create({
      data: {
        branchId: branch.value,
        classId: cls?.id ?? null,
        gradeLevel: data.gradeLevel,
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName,
        birthDate: toDbDate(birthDate.value),
        gender: data.gender,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: emergencyPhone,
      },
    });
    await tx.studentHistory.create({
      data: {
        studentId: student.id,
        kind: 'ENROLLED',
        toClassId: cls?.id ?? null,
        toStatus: 'ACTIVE',
        date: toDbDate(toLocalDate(new Date())),
        actorId: ctx.actor.userId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.student.create',
      entityType: 'Student',
      entityId: student.id,
      branchId: branch.value,
      after: {
        number: student.number,
        ...data,
        birthDate: data.birthDate,
        emergencyContactPhone: emergencyPhone,
      },
    });
    return ok({ id: student.id, number: student.number });
  });
  return result;
}

/** Personal data only. Class and status change through transfer / status operations (history). */
export async function updateStudent(
  ctx: ServiceContext,
  id: string,
  input: Omit<StudentInput, 'classId' | 'branchId' | 'confirmDuplicate'>,
): Promise<Result<{ id: string }>> {
  const student = await ctx.db.student.findUnique({ where: { id }, include: { class: true } });
  if (!student || !can(ctx.actor, 'people.student.manage', { branchId: student.branchId })) {
    return err('NOT_FOUND');
  }
  const parsed = studentInput
    .omit({ classId: true, branchId: true, confirmDuplicate: true })
    .safeParse(input);
  if (!parsed.success) return err('VALIDATION');
  const birthDate = validateBirthDate(parsed.data.birthDate);
  if (!birthDate.ok) return birthDate;
  if (student.class) {
    const grade = checkGradeForClass(student.class, parsed.data.gradeLevel);
    if (!grade.ok) return grade;
  }
  const emergencyPhone = parsed.data.emergencyContactPhone?.trim()
    ? normalizePhone(parsed.data.emergencyContactPhone)
    : null;
  if (parsed.data.emergencyContactPhone?.trim() && !emergencyPhone) {
    return err('PHONE_INVALID', undefined, { emergencyContactPhone: 'PHONE_INVALID' });
  }
  const next = {
    lastName: parsed.data.lastName,
    firstName: parsed.data.firstName,
    middleName: parsed.data.middleName,
    birthDate: toDbDate(birthDate.value),
    gender: parsed.data.gender,
    gradeLevel: parsed.data.gradeLevel,
    emergencyContactName: parsed.data.emergencyContactName,
    emergencyContactPhone: emergencyPhone,
  };
  await ctx.db.$transaction(async (tx) => {
    await tx.student.update({ where: { id }, data: next });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.student.update',
      entityType: 'Student',
      entityId: id,
      branchId: student.branchId,
      before: {
        lastName: student.lastName,
        firstName: student.firstName,
        middleName: student.middleName,
        birthDate: fromDbDate(student.birthDate),
        gender: student.gender,
        gradeLevel: student.gradeLevel,
        emergencyContactName: student.emergencyContactName,
        emergencyContactPhone: student.emergencyContactPhone,
      },
      after: { ...next, birthDate: birthDate.value },
    });
  });
  return ok({ id });
}

/** Moves an active student to another class of the same branch (capacity and grade checked). */
export async function transferStudent(
  ctx: ServiceContext,
  input: { studentId: string; toClassId: string; gradeLevel?: number; reason?: string | null },
): Promise<Result<true>> {
  const student = await ctx.db.student.findUnique({ where: { id: input.studentId } });
  if (!student || !can(ctx.actor, 'people.student.manage', { branchId: student.branchId })) {
    return err('NOT_FOUND');
  }
  if (student.status !== 'ACTIVE') return err('STUDENT_NOT_ACTIVE');
  if (student.classId === input.toClassId)
    return err('VALIDATION', undefined, { toClassId: 'VALIDATION' });
  const target = await loadTargetClass(ctx, input.toClassId, student.branchId);
  if (!target.ok) return target;
  // Moving 7 → a group, a new school year, etc.: the grade may change with the transfer.
  const gradeLevel = input.gradeLevel ?? student.gradeLevel;
  const grade = checkGradeForClass(target.value, gradeLevel);
  if (!grade.ok) return grade;

  return ctx.db.$transaction(async (tx) => {
    const seat = await lockSeat(tx, target.value.id);
    if (!seat.ok) return seat;
    await tx.student.update({
      where: { id: student.id },
      data: { classId: target.value.id, gradeLevel },
    });
    await tx.studentHistory.create({
      data: {
        studentId: student.id,
        kind: 'TRANSFER',
        fromClassId: student.classId,
        toClassId: target.value.id,
        date: toDbDate(toLocalDate(new Date())),
        reason: input.reason?.trim() || null,
        actorId: ctx.actor.userId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.student.transfer',
      entityType: 'Student',
      entityId: student.id,
      branchId: student.branchId,
      before: { classId: student.classId, gradeLevel: student.gradeLevel },
      after: { classId: target.value.id, gradeLevel },
      reason: input.reason ?? null,
    });
    return ok(true as const);
  });
}

/**
 * Status change (left, graduated, transferred, back to active), with a reason. A student who
 * leaves frees their seat: they stay linked to the class for history but no longer count.
 * Returning to active needs a free seat again.
 */
export async function changeStudentStatus(
  ctx: ServiceContext,
  input: { studentId: string; status: StudentStatus; reason: string; date?: string },
): Promise<Result<true>> {
  const student = await ctx.db.student.findUnique({ where: { id: input.studentId } });
  if (!student || !can(ctx.actor, 'people.student.manage', { branchId: student.branchId })) {
    return err('NOT_FOUND');
  }
  if (student.status === input.status)
    return err('VALIDATION', undefined, { status: 'VALIDATION' });
  const reason = input.reason.trim();
  if (!reason) return err('REASON_REQUIRED', undefined, { reason: 'REASON_REQUIRED' });
  const date = input.date ? parseIsoDate(input.date) : toLocalDate(new Date());
  if (!date) return err('VALIDATION', undefined, { date: 'VALIDATION' });

  return ctx.db.$transaction(async (tx) => {
    if (input.status === 'ACTIVE' && student.classId) {
      const seat = await lockSeat(tx, student.classId);
      if (!seat.ok) return seat;
    }
    await tx.student.update({ where: { id: student.id }, data: { status: input.status } });
    await tx.studentHistory.create({
      data: {
        studentId: student.id,
        kind: 'STATUS',
        fromStatus: student.status,
        toStatus: input.status,
        fromClassId: student.classId,
        date: toDbDate(date),
        reason,
        actorId: ctx.actor.userId,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'people.student.status',
      entityType: 'Student',
      entityId: student.id,
      branchId: student.branchId,
      before: { status: student.status },
      after: { status: input.status, date },
      reason,
    });
    return ok(true as const);
  });
}

// ─── Reading ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export interface StudentFilters {
  query?: string;
  classId?: string;
  gradeLevel?: number;
  status?: StudentStatus;
  page?: number;
  all?: boolean;
}

export async function listStudents(ctx: ServiceContext, filters: StudentFilters = {}) {
  const scope = requireScope(ctx.actor, 'people.student.view', {
    branch: 'branchId',
    class: 'classId',
    student: 'id',
  });
  const page = Math.max(1, filters.page ?? 1);
  if (!scope) return { total: 0, page, pageSize: PAGE_SIZE, students: [] };
  const query = filters.query?.trim();
  const where: Prisma.StudentWhereInput = {
    AND: [
      scope as Prisma.StudentWhereInput,
      {
        ...(filters.status ? { status: filters.status } : { status: 'ACTIVE' }),
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.gradeLevel && { gradeLevel: filters.gradeLevel }),
        ...(query && {
          OR: [
            { number: { contains: query.toUpperCase() } },
            ...query.split(/\s+/).map((part) => ({
              OR: [
                { lastName: { contains: part, mode: 'insensitive' as const } },
                { firstName: { contains: part, mode: 'insensitive' as const } },
                { middleName: { contains: part, mode: 'insensitive' as const } },
              ],
            })),
          ],
        }),
      },
    ],
  };
  const [total, students] = await Promise.all([
    ctx.db.student.count({ where }),
    ctx.db.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      ...(!filters.all && { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      include: {
        class: { select: { id: true, name: true, type: true } },
        branch: { select: { id: true, nameUz: true, nameRu: true } },
        guardians: {
          where: { isPrimary: true },
          include: { guardian: { select: { fullName: true, phone: true } } },
        },
      },
    }),
  ]);
  return { total, page, pageSize: PAGE_SIZE, students };
}

/** Student card: data, guardians, class, history — if the actor may see this student. */
export async function getStudent(ctx: ServiceContext, id: string) {
  const student = await ctx.db.student.findUnique({
    where: { id },
    include: {
      class: { include: { direction: true } },
      branch: true,
      guardians: {
        include: { guardian: { select: { id: true, fullName: true, phone: true, email: true } } },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      history: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true } } },
      },
    },
  });
  if (
    !student ||
    !can(ctx.actor, 'people.student.view', {
      branchId: student.branchId,
      classId: student.classId,
      studentId: student.id,
    })
  ) {
    return null;
  }
  const classIds = [
    ...new Set(
      student.history.flatMap((h) => [h.fromClassId, h.toClassId]).filter((v): v is string => !!v),
    ),
  ];
  const classes = await ctx.db.class.findMany({
    where: { id: { in: classIds }, branchId: student.branchId },
    select: { id: true, name: true },
  });
  return { ...student, historyClasses: Object.fromEntries(classes.map((c) => [c.id, c.name])) };
}
