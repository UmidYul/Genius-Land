import type { Prisma } from '@gl/db';
import { z } from 'zod';
import { assertCan, can } from '../access/can';
import { requireScope } from '../access/scope';
import { writeAudit } from '../audit';
import { auditActor, type ServiceContext } from '../context';
import { err, ok, type Result } from '../result';
import { parseIsoDate, type LocalDate } from '../time';
import { targetBranch } from './branch-target';
import { dateKey, fromDbDate, toDbDate } from './dates';

export interface TermInput {
  startDate: string;
  endDate: string;
}

export const yearInput = z.object({
  name: z.string().trim().min(4).max(40),
  /** Exactly four terms, in order. The year spans from the first term's start to the last's end. */
  terms: z.array(z.object({ startDate: z.string(), endDate: z.string() })).length(4),
  makeCurrent: z.boolean().default(false),
  branchId: z.string().uuid().nullable().optional(),
});

interface ParsedTerm {
  number: number;
  start: LocalDate;
  end: LocalDate;
}

/** Terms must be real dates, each start ≤ end, in order and not overlapping. */
export function validateTerms(terms: TermInput[]): Result<ParsedTerm[]> {
  const parsed: ParsedTerm[] = [];
  for (const [index, term] of terms.entries()) {
    const start = parseIsoDate(term.startDate);
    const end = parseIsoDate(term.endDate);
    if (!start || !end || dateKey(start) > dateKey(end)) {
      return err(
        'YEAR_TERMS_INVALID',
        { term: index + 1 },
        { [`terms.${index}`]: 'YEAR_TERMS_INVALID' },
      );
    }
    const previous = parsed.at(-1);
    if (previous && dateKey(start) <= dateKey(previous.end)) {
      return err(
        'YEAR_TERMS_INVALID',
        { term: index + 1 },
        { [`terms.${index}`]: 'YEAR_TERMS_INVALID' },
      );
    }
    parsed.push({ number: index + 1, start, end });
  }
  return ok(parsed);
}

export async function listAcademicYears(ctx: ServiceContext) {
  const where = requireScope(ctx.actor, 'school.academicYear.view', { branch: 'branchId' });
  if (!where) return [];
  return ctx.db.academicYear.findMany({
    where: where as Prisma.AcademicYearWhereInput,
    orderBy: [{ startDate: 'desc' }],
    include: {
      terms: { orderBy: { number: 'asc' } },
      branch: true,
      _count: { select: { classes: true } },
    },
  });
}

/** The current year of a branch, or null. */
export function getCurrentYear(ctx: ServiceContext, branchId: string) {
  return ctx.db.academicYear.findFirst({
    where: { branchId, isCurrent: true },
    include: { terms: { orderBy: { number: 'asc' } } },
  });
}

/** Creates a year together with its four terms; optionally makes it the branch's current year. */
export async function createAcademicYear(
  ctx: ServiceContext,
  input: z.input<typeof yearInput>,
): Promise<Result<{ id: string }>> {
  const parsed = yearInput.safeParse(input);
  if (!parsed.success) return err('VALIDATION', undefined, { name: 'VALIDATION' });
  const branch = targetBranch(ctx, 'school.academicYear.manage', parsed.data.branchId);
  if (!branch.ok) return branch;
  const terms = validateTerms(parsed.data.terms);
  if (!terms.ok) return terms;
  if (
    await ctx.db.academicYear.findFirst({
      where: { branchId: branch.value, name: parsed.data.name },
    })
  ) {
    return err('YEAR_NAME_TAKEN', undefined, { name: 'YEAR_NAME_TAKEN' });
  }

  const year = await ctx.db.$transaction(async (tx) => {
    if (parsed.data.makeCurrent) {
      await tx.academicYear.updateMany({
        where: { branchId: branch.value, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    const created = await tx.academicYear.create({
      data: {
        branchId: branch.value,
        name: parsed.data.name,
        startDate: toDbDate(terms.value[0]!.start),
        endDate: toDbDate(terms.value[3]!.end),
        isCurrent: parsed.data.makeCurrent,
        terms: {
          create: terms.value.map((t) => ({
            number: t.number,
            startDate: toDbDate(t.start),
            endDate: toDbDate(t.end),
          })),
        },
      },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.academicYear.create',
      entityType: 'AcademicYear',
      entityId: created.id,
      branchId: branch.value,
      after: {
        name: parsed.data.name,
        terms: parsed.data.terms,
        isCurrent: parsed.data.makeCurrent,
      },
    });
    return created;
  });
  return ok({ id: year.id });
}

/** Edits term dates; the year's span follows the first and last term. */
export async function updateTerms(
  ctx: ServiceContext,
  yearId: string,
  input: TermInput[],
): Promise<Result<true>> {
  const year = await ctx.db.academicYear.findUnique({
    where: { id: yearId },
    include: { terms: { orderBy: { number: 'asc' } } },
  });
  if (!year || !can(ctx.actor, 'school.academicYear.manage', { branchId: year.branchId })) {
    return err('NOT_FOUND');
  }
  if (input.length !== 4) return err('VALIDATION');
  const terms = validateTerms(input);
  if (!terms.ok) return terms;

  await ctx.db.$transaction(async (tx) => {
    for (const t of terms.value) {
      await tx.term.update({
        where: { academicYearId_number: { academicYearId: yearId, number: t.number } },
        data: { startDate: toDbDate(t.start), endDate: toDbDate(t.end) },
      });
    }
    await tx.academicYear.update({
      where: { id: yearId },
      data: { startDate: toDbDate(terms.value[0]!.start), endDate: toDbDate(terms.value[3]!.end) },
    });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.academicYear.terms',
      entityType: 'AcademicYear',
      entityId: yearId,
      branchId: year.branchId,
      before: year.terms.map((t) => ({
        start: fromDbDate(t.startDate),
        end: fromDbDate(t.endDate),
      })),
      after: input,
    });
  });
  return ok(true);
}

/** Makes the year current for its branch (the previous current year stops being current). */
export async function setCurrentYear(ctx: ServiceContext, yearId: string): Promise<Result<true>> {
  const year = await ctx.db.academicYear.findUnique({ where: { id: yearId } });
  if (!year || !can(ctx.actor, 'school.academicYear.manage', { branchId: year.branchId })) {
    return err('NOT_FOUND');
  }
  assertCan(ctx.actor, 'school.academicYear.manage', { branchId: year.branchId });
  await ctx.db.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: { branchId: year.branchId, isCurrent: true },
      data: { isCurrent: false },
    });
    await tx.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } });
    await writeAudit(tx, auditActor(ctx), {
      action: 'school.academicYear.setCurrent',
      entityType: 'AcademicYear',
      entityId: yearId,
      branchId: year.branchId,
      after: { isCurrent: true },
    });
  });
  return ok(true);
}
