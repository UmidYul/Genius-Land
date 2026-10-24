import type { ImportKind, Prisma } from '@gl/db';
import { can } from '../../access/can';
import { normalizePhone } from '../../auth/phone';
import { writeAudit } from '../../audit';
import { auditActor, type ServiceContext } from '../../context';
import { checkGradeForClass, validateBirthDate } from '../../people/students';
import { err, ok, type ErrorCode, type Result } from '../../result';
import { parseIsoDate, toIsoDate, toLocalDate } from '../../time';
import { nameKey, targetBranch } from '../branch-target';
import { toDbDate } from '../dates';
import { importColumns, matchValue } from './columns';
import { readImportFile, type SheetRow } from './workbook';

export interface RowError {
  field: string;
  code: ErrorCode;
  params?: Record<string, string | number>;
}

export interface CheckedRow extends SheetRow {
  errors: RowError[];
}

export interface ImportReport {
  created: number;
  skipped: number;
  /** Rows that failed at confirmation time (data changed since the preview). */
  failedRows: number[];
}

type Tx = Prisma.TransactionClient;

/** Kinds and the permission each needs in the branch. */
export const importPermission = {
  CLASSES: 'school.class.manage',
  STAFF: 'people.staff.manage',
  STUDENTS: 'people.student.manage',
  GUARDIANS: 'people.guardian.manage',
} as const;

/** "02.09.2015", "2.9.2015", "2015-09-02" (Excel dates arrive as ISO). */
export function parseCellDate(raw: string): string | null {
  const iso = parseIsoDate(raw);
  if (iso) return toIsoDate(iso);
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const date = parseIsoDate(`${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
  return date ? toIsoDate(date) : null;
}

const int = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null);

function requiredErrors(kind: ImportKind, row: SheetRow): RowError[] {
  return importColumns[kind]
    .filter((c) => c.required && !row.values[c.key])
    .map((c) => ({ field: c.key, code: 'IMPORT_REQUIRED' as const }));
}

/**
 * Validates every row against the database and against the other rows of the same file
 * (duplicate phones, seats taken by earlier rows). Runs both for the preview and again at
 * confirmation, inside the import transaction.
 */
async function checkRows(
  db: Tx,
  kind: ImportKind,
  branchId: string,
  rows: SheetRow[],
): Promise<CheckedRow[]> {
  const year = await db.academicYear.findFirst({ where: { branchId, isCurrent: true } });
  const checked: CheckedRow[] = [];
  const seen = new Set<string>();
  const seatsUsed = new Map<string, number>();

  // Lookups shared by all rows.
  const classes = year
    ? await db.class.findMany({
        where: { branchId, academicYearId: year.id, archivedAt: null },
        include: { _count: { select: { students: { where: { status: 'ACTIVE' } } } } },
      })
    : [];
  const classByKey = new Map(classes.map((c) => [c.nameKey, c]));

  for (const row of rows) {
    const v = row.values;
    const errors = requiredErrors(kind, row);
    const add = (field: string, code: ErrorCode, params?: RowError['params']) =>
      errors.push({ field, code, params });

    if (kind === 'STAFF') {
      const phone = v.phone ? normalizePhone(v.phone) : null;
      if (v.phone && !phone) add('phone', 'PHONE_INVALID');
      if (phone) {
        if (seen.has(phone)) add('phone', 'IMPORT_DUPLICATE_IN_FILE');
        else if (await db.staff.findFirst({ where: { branchId, phone } }))
          add('phone', 'STAFF_PHONE_TAKEN');
        seen.add(phone);
      }
    }

    if (kind === 'CLASSES') {
      if (!year) add('name', 'YEAR_NOT_FOUND');
      const type = v.type ? matchValue('classType', v.type) : null;
      if (v.type && !type) add('type', 'IMPORT_VALUE_UNKNOWN');
      const grade = v.gradeLevel ? int(v.gradeLevel) : null;
      if (type === 'REGULAR' && (!grade || grade < 1 || grade > 7))
        add('gradeLevel', 'CLASS_GRADE_REQUIRED');
      if (type === 'DIRECTION_GROUP') {
        if (!v.direction) add('direction', 'CLASS_DIRECTION_REQUIRED');
        else {
          const direction = await db.direction.findFirst({
            where: {
              archivedAt: null,
              OR: [
                { nameRu: { equals: v.direction.trim(), mode: 'insensitive' } },
                { nameUz: { equals: v.direction.trim(), mode: 'insensitive' } },
              ],
            },
          });
          if (!direction) add('direction', 'DIRECTION_NOT_FOUND');
        }
      }
      const capacity = v.capacity ? int(v.capacity) : null;
      if (v.capacity && (!capacity || capacity < 1 || capacity > 100))
        add('capacity', 'IMPORT_NUMBER_INVALID');
      if (v.name) {
        const key = nameKey(v.name);
        if (seen.has(key)) add('name', 'IMPORT_DUPLICATE_IN_FILE');
        else if (classByKey.has(key)) add('name', 'CLASS_NAME_TAKEN');
        seen.add(key);
      }
      const phone = v.homeroomPhone ? normalizePhone(v.homeroomPhone) : null;
      if (v.homeroomPhone && !phone) add('homeroomPhone', 'PHONE_INVALID');
      if (phone && !(await db.staff.findFirst({ where: { branchId, phone, archivedAt: null } }))) {
        add('homeroomPhone', 'STAFF_NOT_FOUND');
      }
    }

    if (kind === 'STUDENTS') {
      const birth = v.birthDate ? parseCellDate(v.birthDate) : null;
      if (v.birthDate && !birth) add('birthDate', 'BIRTHDATE_INVALID');
      else if (birth && !validateBirthDate(birth).ok) add('birthDate', 'BIRTHDATE_INVALID');
      if (v.gender && !matchValue('gender', v.gender)) add('gender', 'IMPORT_VALUE_UNKNOWN');
      const grade = v.gradeLevel ? int(v.gradeLevel) : null;
      if (v.gradeLevel && (!grade || grade < 1 || grade > 11))
        add('gradeLevel', 'IMPORT_NUMBER_INVALID');
      if (v.className) {
        const cls = classByKey.get(nameKey(v.className));
        if (!cls) add('className', 'CLASS_NOT_FOUND');
        else {
          if (grade) {
            const rule = checkGradeForClass(cls, grade);
            if (!rule.ok) add('gradeLevel', rule.error.code, rule.error.params);
          }
          const used = (seatsUsed.get(cls.id) ?? cls._count.students) + 1;
          if (used > cls.capacity) add('className', 'CLASS_FULL', { capacity: cls.capacity });
          else if (errors.length === 0) seatsUsed.set(cls.id, used);
        }
      }
      const emergency = v.emergencyPhone ? normalizePhone(v.emergencyPhone) : null;
      if (v.emergencyPhone && !emergency) add('emergencyPhone', 'PHONE_INVALID');
      if (birth && v.lastName && v.firstName) {
        const key = `${v.lastName.toLowerCase()}|${v.firstName.toLowerCase()}|${birth}`;
        if (seen.has(key)) add('lastName', 'IMPORT_DUPLICATE_IN_FILE');
        seen.add(key);
        const dup = await db.student.count({
          where: {
            branchId: undefined,
            lastName: { equals: v.lastName.trim(), mode: 'insensitive' },
            firstName: { equals: v.firstName.trim(), mode: 'insensitive' },
            birthDate: toDbDate(parseIsoDate(birth)!),
          },
        });
        // Probable duplicates are not imported; add them by hand after checking.
        if (dup > 0) add('lastName', 'IMPORT_POSSIBLE_DUPLICATE');
      }
    }

    if (kind === 'GUARDIANS') {
      const student = v.studentNumber
        ? await db.student.findFirst({
            where: { branchId, number: v.studentNumber.trim().toUpperCase() },
          })
        : null;
      if (v.studentNumber && !student) add('studentNumber', 'STUDENT_NOT_FOUND');
      const phone = v.phone ? normalizePhone(v.phone) : null;
      if (v.phone && !phone) add('phone', 'PHONE_INVALID');
      if (v.relation && !matchValue('relation', v.relation))
        add('relation', 'IMPORT_VALUE_UNKNOWN');
      if (v.isPrimary && !matchValue('yesNo', v.isPrimary))
        add('isPrimary', 'IMPORT_VALUE_UNKNOWN');
      if (student && phone) {
        const key = `${student.id}|${phone}`;
        if (seen.has(key)) add('phone', 'IMPORT_DUPLICATE_IN_FILE');
        seen.add(key);
        const user = await db.user.findUnique({ where: { phone } });
        if (user?.deletedAt) add('phone', 'PHONE_TAKEN');
        if (
          user &&
          (await db.guardianLink.findUnique({
            where: { guardianId_studentId: { guardianId: user.id, studentId: student.id } },
          }))
        ) {
          add('phone', 'GUARDIAN_ALREADY_LINKED');
        }
      }
    }

    checked.push({ ...row, errors });
  }
  return checked;
}

/** Creates the records of valid rows. Runs inside the import transaction. */
async function applyRow(
  tx: Tx,
  ctx: ServiceContext,
  kind: ImportKind,
  branchId: string,
  v: Record<string, string>,
) {
  if (kind === 'STAFF') {
    const phone = normalizePhone(v.phone!)!;
    const user = await tx.user.findUnique({
      where: { phone },
      select: { id: true, deletedAt: true },
    });
    await tx.staff.create({
      data: {
        branchId,
        fullName: v.fullName!.trim(),
        phone,
        position: v.position!.trim(),
        userId: user && !user.deletedAt ? user.id : null,
      },
    });
    return;
  }
  if (kind === 'CLASSES') {
    const year = await tx.academicYear.findFirstOrThrow({ where: { branchId, isCurrent: true } });
    const type = matchValue('classType', v.type!) as 'REGULAR' | 'DIRECTION_GROUP';
    const direction =
      type === 'DIRECTION_GROUP'
        ? await tx.direction.findFirstOrThrow({
            where: {
              archivedAt: null,
              OR: [
                { nameRu: { equals: v.direction!.trim(), mode: 'insensitive' } },
                { nameUz: { equals: v.direction!.trim(), mode: 'insensitive' } },
              ],
            },
          })
        : null;
    const teacher = await tx.staff.findFirstOrThrow({
      where: { branchId, phone: normalizePhone(v.homeroomPhone!)!, archivedAt: null },
    });
    await tx.class.create({
      data: {
        branchId,
        academicYearId: year.id,
        type,
        name: v.name!.trim().replace(/\s+/g, ' '),
        nameKey: nameKey(v.name!),
        gradeLevel: type === 'REGULAR' ? int(v.gradeLevel!) : null,
        directionId: direction?.id ?? null,
        capacity: int(v.capacity!)!,
        homeroomTeacherId: teacher.id,
      },
    });
    return;
  }
  if (kind === 'STUDENTS') {
    const year = await tx.academicYear.findFirst({ where: { branchId, isCurrent: true } });
    const cls =
      v.className && year
        ? await tx.class.findFirst({
            where: { branchId, academicYearId: year.id, nameKey: nameKey(v.className) },
          })
        : null;
    const student = await tx.student.create({
      data: {
        branchId,
        classId: cls?.id ?? null,
        gradeLevel: int(v.gradeLevel!)!,
        lastName: v.lastName!.trim(),
        firstName: v.firstName!.trim(),
        middleName: v.middleName?.trim() || null,
        birthDate: toDbDate(parseIsoDate(parseCellDate(v.birthDate!)!)!),
        gender: matchValue('gender', v.gender!) as 'MALE' | 'FEMALE',
        emergencyContactName: v.emergencyName?.trim() || null,
        emergencyContactPhone: v.emergencyPhone ? normalizePhone(v.emergencyPhone) : null,
      },
    });
    await tx.studentHistory.create({
      data: {
        studentId: student.id,
        kind: 'ENROLLED',
        toClassId: cls?.id ?? null,
        toStatus: 'ACTIVE',
        date: toDbDate(toLocalDate(new Date())),
        reason: 'import',
        actorId: ctx.actor.userId,
      },
    });
    return;
  }
  // GUARDIANS
  const student = await tx.student.findFirstOrThrow({
    where: { branchId, number: v.studentNumber!.trim().toUpperCase() },
  });
  const phone = normalizePhone(v.phone!)!;
  let user = await tx.user.findUnique({ where: { phone } });
  if (!user) {
    user = await tx.user.create({
      data: {
        phone,
        fullName: v.fullName!.trim(),
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
  const hasPrimary = await tx.guardianLink.count({
    where: { studentId: student.id, isPrimary: true },
  });
  const wantsPrimary = v.isPrimary ? matchValue('yesNo', v.isPrimary) === 'yes' : false;
  if (wantsPrimary && hasPrimary > 0) {
    await tx.guardianLink.updateMany({
      where: { studentId: student.id },
      data: { isPrimary: false },
    });
  }
  await tx.guardianLink.create({
    data: {
      guardianId: user.id,
      studentId: student.id,
      relation: matchValue('relation', v.relation!) as 'MOTHER' | 'FATHER' | 'GUARDIAN' | 'OTHER',
      isPrimary: wantsPrimary || hasPrimary === 0,
    },
  });
}

/** Step 1: read the file, check every row, keep the result as a preview job. */
export async function previewImport(
  ctx: ServiceContext,
  input: {
    kind: ImportKind;
    fileName: string;
    data: ArrayBuffer | Buffer;
    branchId?: string | null;
  },
): Promise<Result<{ jobId: string; rows: CheckedRow[]; unknownHeaders: string[] }>> {
  const branch = targetBranch(ctx, importPermission[input.kind], input.branchId);
  if (!branch.ok) return branch;
  const read = await readImportFile(input.kind, input.data);
  if (!read.ok) return err(read.code, { columns: (read.missing ?? []).join(', ') });
  if (read.rows.length === 0) return err('IMPORT_EMPTY');
  if (read.rows.length > 2000) return err('IMPORT_TOO_LARGE', { max: 2000 });

  const rows = await checkRows(ctx.db as unknown as Tx, input.kind, branch.value, read.rows);
  const job = await ctx.db.importJob.create({
    data: {
      branchId: branch.value,
      kind: input.kind,
      actorId: ctx.actor.userId,
      fileName: input.fileName.slice(0, 200),
      rows: rows as unknown as Prisma.InputJsonValue,
    },
  });
  return ok({ jobId: job.id, rows, unknownHeaders: read.unknownHeaders });
}

/**
 * Step 2: re-check and create every valid row in ONE transaction — either all valid rows are
 * imported or nothing is. Rows with errors are skipped and listed in the report.
 */
export async function confirmImport(
  ctx: ServiceContext,
  jobId: string,
): Promise<Result<ImportReport>> {
  const job = await ctx.db.importJob.findUnique({ where: { id: jobId } });
  if (
    !job ||
    job.actorId !== ctx.actor.userId ||
    !can(ctx.actor, importPermission[job.kind], { branchId: job.branchId })
  ) {
    return err('NOT_FOUND');
  }
  if (job.status !== 'PREVIEW') return err('IMPORT_ALREADY_DONE');
  const preview = job.rows as unknown as CheckedRow[];

  const report = await ctx.db.$transaction(
    async (tx) => {
      // Seats are counted per class: lock the branch's classes so concurrent enrolments wait.
      if (job.kind === 'STUDENTS') {
        await tx.$queryRaw`SELECT id FROM "Class" WHERE "branchId" = ${job.branchId}::uuid FOR UPDATE`;
      }
      const rechecked = await checkRows(
        tx,
        job.kind,
        job.branchId,
        preview.map(({ row, values }) => ({ row, values })),
      );
      const valid = rechecked.filter((r) => r.errors.length === 0);
      for (const row of valid) await applyRow(tx, ctx, job.kind, job.branchId, row.values);
      const previewValid = new Set(preview.filter((r) => r.errors.length === 0).map((r) => r.row));
      const result: ImportReport = {
        created: valid.length,
        skipped: rechecked.length - valid.length,
        failedRows: rechecked
          .filter((r) => r.errors.length > 0 && previewValid.has(r.row))
          .map((r) => r.row),
      };
      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          report: result as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
      await writeAudit(tx, auditActor(ctx), {
        action: 'import.run',
        entityType: 'ImportJob',
        entityId: job.id,
        branchId: job.branchId,
        after: { kind: job.kind, fileName: job.fileName, ...result },
      });
      return result;
    },
    { timeout: 120_000 },
  );
  return ok(report);
}

export async function getImportJob(ctx: ServiceContext, jobId: string) {
  const job = await ctx.db.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.actorId !== ctx.actor.userId) return null;
  return {
    ...job,
    rows: job.rows as unknown as CheckedRow[],
    report: job.report as unknown as ImportReport | null,
  };
}
