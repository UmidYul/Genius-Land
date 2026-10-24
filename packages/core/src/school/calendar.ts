import type { CalendarDayKind, ClassType, Db, Prisma } from '@gl/db';
import { z } from 'zod';
import { assertCan, can } from '../access/can';
import { scopeWhere } from '../access/scope';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';
import { parseIsoDate, type LocalDate } from '../time';
import { dateKey, fromDbDate, toDbDate, weekdayOf } from './dates';

/**
 * The school week: classes 1–7 study Monday–Friday; direction groups 8–11 Monday–Saturday
 * (Saturday until lunch — the bell schedule is stage 3).
 */
export const baseWorkingDays: Record<ClassType, readonly number[]> = {
  REGULAR: [1, 2, 3, 4, 5],
  DIRECTION_GROUP: [1, 2, 3, 4, 5, 6],
};

export interface CalendarException {
  /** null — applies to both branches. */
  branchId: string | null;
  date: LocalDate;
  kind: CalendarDayKind;
  /** null — every class type. */
  classType: ClassType | null;
}

export interface SchoolDayInput {
  classType: ClassType;
  branchId: string;
  date: LocalDate;
  /** Terms of the class's academic year: lessons happen only inside a term. */
  terms: readonly { startDate: LocalDate; endDate: LocalDate }[];
  exceptions: readonly CalendarException[];
}

/**
 * Pure rule, shared by attendance, the journal and the bot:
 * 1. outside every term (holidays between terms, before or after the year) — no school;
 * 2. a calendar exception for this date wins: the most specific one (own branch over both
 *    branches, own class type over all types);
 * 3. otherwise the class type's working week.
 */
export function isSchoolDayRule(input: SchoolDayInput): boolean {
  const key = dateKey(input.date);
  const inTerm = input.terms.some((t) => dateKey(t.startDate) <= key && key <= dateKey(t.endDate));
  if (!inTerm) return false;

  const matching = input.exceptions.filter(
    (e) =>
      dateKey(e.date) === key &&
      (e.branchId === null || e.branchId === input.branchId) &&
      (e.classType === null || e.classType === input.classType),
  );
  if (matching.length > 0) {
    const specificity = (e: CalendarException) => (e.branchId ? 2 : 0) + (e.classType ? 1 : 0);
    const winner = matching.reduce((best, e) => (specificity(e) > specificity(best) ? e : best));
    return winner.kind === 'WORKDAY';
  }
  return baseWorkingDays[input.classType].includes(weekdayOf(input.date));
}

/** Is `date` a school day for this class? Reads terms and calendar exceptions fresh. */
export async function isSchoolDay(
  db: Db,
  classRef: string | { id: string; type: ClassType; branchId: string; academicYearId: string },
  date: LocalDate,
): Promise<boolean> {
  const cls =
    typeof classRef === 'string'
      ? await db.class.findUnique({
          where: { id: classRef },
          select: { id: true, type: true, branchId: true, academicYearId: true },
        })
      : classRef;
  if (!cls) return false;
  const [terms, exceptions] = await Promise.all([
    db.term.findMany({ where: { academicYearId: cls.academicYearId } }),
    db.calendarDay.findMany({
      where: { date: toDbDate(date), OR: [{ branchId: null }, { branchId: cls.branchId }] },
    }),
  ]);
  return isSchoolDayRule({
    classType: cls.type,
    branchId: cls.branchId,
    date,
    terms: terms.map((t) => ({
      startDate: fromDbDate(t.startDate),
      endDate: fromDbDate(t.endDate),
    })),
    exceptions: exceptions.map((e) => ({
      branchId: e.branchId,
      date: fromDbDate(e.date),
      kind: e.kind,
      classType: e.classType,
    })),
  });
}

// ─── Managing calendar exceptions ────────────────────────────────────────────

export const calendarDayInput = z.object({
  date: z.string(),
  kind: z.enum(['HOLIDAY', 'WORKDAY']),
  classType: z.enum(['REGULAR', 'DIRECTION_GROUP']).nullable().default(null),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  /** null — both branches (allowed only to someone who manages the calendar of every branch). */
  branchId: z.string().uuid().nullable(),
});

/**
 * Whether the actor may manage the calendar of EVERY active branch of the school (needed for an
 * entry that applies to both). Checked against all branches in the database, not just the
 * branches the actor sees — a director sees only their own branch.
 */
async function managesAllBranches(ctx: ServiceContext): Promise<boolean> {
  const branches = await ctx.db.branch.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return (
    branches.length > 0 &&
    branches.every((b) => can(ctx.actor, 'school.calendar.manage', { branchId: b.id }))
  );
}

export async function listCalendarDays(
  ctx: ServiceContext,
  range: { from: LocalDate; to: LocalDate },
) {
  const where = scopeWhere(ctx.actor, 'school.academicYear.view', { branch: 'branchId' });
  if (!where) return [];
  return ctx.db.calendarDay.findMany({
    where: {
      // Entries for both branches are visible to everyone who sees the calendar.
      OR: [where as Prisma.CalendarDayWhereInput, { branchId: null }],
      date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
    },
    orderBy: { date: 'asc' },
  });
}

export async function addCalendarDay(
  ctx: ServiceContext,
  input: z.input<typeof calendarDayInput>,
): Promise<Result<{ id: string }>> {
  const parsed = calendarDayInput.safeParse(input);
  const date = parsed.success ? parseIsoDate(parsed.data.date) : null;
  if (!parsed.success || !date) return err('VALIDATION', undefined, { date: 'VALIDATION' });
  const { branchId } = parsed.data;
  if (branchId === null) {
    assertCan(ctx.actor, 'school.calendar.manage');
    if (!(await managesAllBranches(ctx))) return err('FORBIDDEN');
  } else {
    assertCan(ctx.actor, 'school.calendar.manage', { branchId });
  }
  const clash = await ctx.db.calendarDay.findFirst({
    where: { branchId, date: toDbDate(date), classType: parsed.data.classType },
  });
  if (clash) return err('CALENDAR_DAY_TAKEN', undefined, { date: 'CALENDAR_DAY_TAKEN' });

  const created = await ctx.db.$transaction(async (tx) => {
    const day = await tx.calendarDay.create({
      data: {
        branchId,
        date: toDbDate(date),
        kind: parsed.data.kind,
        classType: parsed.data.classType,
        note: parsed.data.note,
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.calendar.add',
      entityType: 'CalendarDay',
      entityId: day.id,
      branchId,
      after: { ...parsed.data },
    });
    return day;
  });
  return ok({ id: created.id });
}

export async function removeCalendarDay(ctx: ServiceContext, id: string): Promise<Result<true>> {
  const day = await ctx.db.calendarDay.findUnique({ where: { id } });
  if (!day) return err('NOT_FOUND');
  if (day.branchId === null) {
    assertCan(ctx.actor, 'school.calendar.manage');
    if (!(await managesAllBranches(ctx))) return err('FORBIDDEN');
  } else if (!can(ctx.actor, 'school.calendar.manage', { branchId: day.branchId })) {
    return err('NOT_FOUND');
  }
  await ctx.db.$transaction(async (tx) => {
    await tx.calendarDay.delete({ where: { id } });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.calendar.remove',
      entityType: 'CalendarDay',
      entityId: id,
      branchId: day.branchId,
      before: {
        date: fromDbDate(day.date),
        kind: day.kind,
        classType: day.classType,
        note: day.note,
      },
    });
  });
  return ok(true);
}
