import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayRange,
  formatDate,
  formatDateTime,
  formatTime,
  localWeekday,
  monthRange,
  parseIsoDate,
  startOfLocalDate,
  toIsoDate,
  toLocalDate,
} from './time';

// Tashkent is UTC+5: local midnight is 19:00 UTC of the previous day.
describe('school time zone boundaries', () => {
  it('local midnight is 19:00 UTC the day before', () => {
    expect(startOfLocalDate({ year: 2026, month: 10, day: 24 }).toISOString()).toBe(
      '2026-10-23T19:00:00.000Z',
    );
  });

  it('an evening UTC instant already belongs to the next local day', () => {
    const instant = new Date('2026-10-23T20:30:00Z'); // 01:30 on 24.10 in Tashkent
    expect(toLocalDate(instant)).toEqual({ year: 2026, month: 10, day: 24 });
    expect(formatDateTime(instant)).toBe('24.10.2026 01:30');
  });

  it('dayRange is a half-open 24h interval', () => {
    const { start, end } = dayRange(new Date('2026-10-24T06:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-23T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-24T19:00:00.000Z');
  });

  it('monthRange handles December → January', () => {
    const { start, end } = monthRange(new Date('2026-12-15T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-11-30T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T19:00:00.000Z');
  });

  it('monthRange uses the local month, not the UTC one', () => {
    // 31.10 21:00 UTC is already 01.11 02:00 in Tashkent
    const { start } = monthRange(new Date('2026-10-31T21:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-31T19:00:00.000Z');
  });

  it('weekday follows the local date', () => {
    expect(localWeekday(new Date('2026-10-24T06:00:00Z'))).toBe(6); // Saturday
    expect(localWeekday(new Date('2026-10-24T20:00:00Z'))).toBe(7); // Sunday 01:00 local
  });

  it('addDays crosses months and leap years', () => {
    expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });
});

describe('formatting', () => {
  it('formats DD.MM.YYYY', () => {
    expect(formatDate({ year: 2026, month: 9, day: 2 })).toBe('02.09.2026');
    expect(formatDate(new Date('2026-09-01T19:30:00Z'))).toBe('02.09.2026');
  });

  it('formats time in 24h school time', () => {
    expect(formatTime(new Date('2026-09-02T03:05:00Z'))).toBe('08:05');
  });

  it('ISO date round-trip', () => {
    expect(toIsoDate({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05');
    expect(parseIsoDate('2026-01-05')).toEqual({ year: 2026, month: 1, day: 5 });
  });

  it.each(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-5', ''])('rejects %j', (input) => {
    expect(parseIsoDate(input)).toBeNull();
  });
});
