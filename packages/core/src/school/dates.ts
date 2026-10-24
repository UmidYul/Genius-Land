import { parseIsoDate, toIsoDate, type LocalDate } from '../time';

/**
 * Calendar dates (birthdays, term boundaries, holidays) are stored in `date` columns. Prisma
 * maps them to a JS Date at UTC midnight; these helpers convert without any time-zone shift.
 */
export const toDbDate = (date: LocalDate): Date =>
  new Date(Date.UTC(date.year, date.month - 1, date.day));

export const fromDbDate = (date: Date): LocalDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

/** "2026-09-02" ↔ Date column value. */
export const isoToDbDate = (iso: string): Date | null => {
  const parsed = parseIsoDate(iso);
  return parsed ? toDbDate(parsed) : null;
};
export const dbDateToIso = (date: Date): string => toIsoDate(fromDbDate(date));

/** Comparable number yyyymmdd. */
export const dateKey = (d: LocalDate) => d.year * 10_000 + d.month * 100 + d.day;

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: LocalDate): number {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 ? 7 : day;
}
