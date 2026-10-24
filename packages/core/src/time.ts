/**
 * Time rules: timestamps are stored in UTC; every day, week and month boundary is computed in
 * the school's time zone. Asia/Tashkent has no DST today, but the offset is read from the time
 * zone database instead of being hard-coded, so historical dates stay correct too.
 */
export const SCHOOL_TIME_ZONE = 'Asia/Tashkent';

/** A calendar date in the school's time zone, independent of any instant. */
export interface LocalDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

/** Half-open interval [start, end) in UTC. Use `gte: start, lt: end` in queries. */
export interface Range {
  start: Date;
  end: Date;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHOOL_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface ZonedParts extends LocalDate {
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday */
  weekday: number;
}

function zonedParts(instant: Date): ZonedParts {
  const map: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(instant)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAYS.indexOf(map.weekday as (typeof WEEKDAYS)[number]) + 1,
  };
}

/** Offset of the school time zone from UTC at the given instant, in milliseconds. */
function offsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight at the start of the given school-calendar date. */
export function startOfLocalDate(date: LocalDate): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  // Two passes settle the offset even if it changed around this date.
  let instant = guess - offsetMs(new Date(guess));
  instant = guess - offsetMs(new Date(instant));
  return new Date(instant);
}

/** The school-calendar date of an instant. */
export function toLocalDate(instant: Date): LocalDate {
  const { year, month, day } = zonedParts(instant);
  return { year, month, day };
}

/** ISO weekday of an instant in the school time zone: 1 = Monday … 7 = Sunday. */
export function localWeekday(instant: Date): number {
  return zonedParts(instant).weekday;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** The school day containing the instant. */
export function dayRange(instant: Date): Range {
  const today = toLocalDate(instant);
  return { start: startOfLocalDate(today), end: startOfLocalDate(addDays(today, 1)) };
}

/** The calendar month (in school time) containing the instant. */
export function monthRange(instant: Date): Range {
  const { year, month } = toLocalDate(instant);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: startOfLocalDate({ year, month, day: 1 }),
    end: startOfLocalDate({ ...next, day: 1 }),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** "24.10.2026" — the date format used everywhere in the interface (both languages). */
export function formatDate(value: Date | LocalDate): string {
  const d = value instanceof Date ? toLocalDate(value) : value;
  return `${pad(d.day)}.${pad(d.month)}.${pad(d.year, 4)}`;
}

/** "24.10.2026 14:05" in school time. */
export function formatDateTime(instant: Date): string {
  const p = zonedParts(instant);
  return `${formatDate(p)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** "14:05" in school time. */
export function formatTime(instant: Date): string {
  const p = zonedParts(instant);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "2026-10-24" — for URLs, API payloads and `<input type="date">`. */
export function toIsoDate(value: Date | LocalDate): string {
  const d = value instanceof Date ? toLocalDate(value) : value;
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`;
}

/** Parses "2026-10-24"; returns null for anything that is not a real calendar date. */
export function parseIsoDate(input: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
