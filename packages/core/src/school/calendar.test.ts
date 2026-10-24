import { describe, expect, it } from 'vitest';
import { isSchoolDayRule, type CalendarException } from './calendar';
import { checkGradeForClass } from '../people/students';
import { nameKey } from './branch-target';
import { matchHeader, matchValue } from './excel/columns';
import { parseCellDate } from './excel/import';

const A = 'branch-a';
const B = 'branch-b';
// 2026-10-26 is a Monday; the term covers two weeks.
const terms = [
  { startDate: { year: 2026, month: 10, day: 26 }, endDate: { year: 2026, month: 11, day: 8 } },
];
const d = (day: number, month = 10) => ({ year: 2026, month, day });

function schoolDay(
  classType: 'REGULAR' | 'DIRECTION_GROUP',
  date: ReturnType<typeof d>,
  exceptions: CalendarException[] = [],
  branchId = A,
) {
  return isSchoolDayRule({ classType, branchId, date, terms, exceptions });
}

describe('isSchoolDay — the school week by class type', () => {
  it('classes 1–7 study Monday–Friday', () => {
    expect([26, 27, 28, 29, 30].map((day) => schoolDay('REGULAR', d(day)))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(schoolDay('REGULAR', d(31))).toBe(false); // Saturday
    expect(schoolDay('REGULAR', d(1, 11))).toBe(false); // Sunday
  });

  it('direction groups 8–11 also study on Saturday, never on Sunday', () => {
    expect(schoolDay('DIRECTION_GROUP', d(31))).toBe(true);
    expect(schoolDay('DIRECTION_GROUP', d(1, 11))).toBe(false);
    expect(schoolDay('DIRECTION_GROUP', d(26))).toBe(true);
  });

  it('days outside every term are holidays', () => {
    expect(schoolDay('REGULAR', d(23))).toBe(false); // Friday before the term
    expect(schoolDay('DIRECTION_GROUP', d(9, 11))).toBe(false); // Monday after
  });
});

describe('isSchoolDay — holidays and transfers', () => {
  const holiday = (over: Partial<CalendarException> = {}): CalendarException => ({
    branchId: null,
    date: d(28),
    kind: 'HOLIDAY',
    classType: null,
    ...over,
  });

  it('a holiday for both branches closes every class', () => {
    expect(schoolDay('REGULAR', d(28), [holiday()])).toBe(false);
    expect(schoolDay('DIRECTION_GROUP', d(28), [holiday()])).toBe(false);
    expect(schoolDay('REGULAR', d(28), [holiday()], B)).toBe(false);
  });

  it('a branch holiday does not touch the other branch', () => {
    const exceptions = [holiday({ branchId: A })];
    expect(schoolDay('REGULAR', d(28), exceptions, A)).toBe(false);
    expect(schoolDay('REGULAR', d(28), exceptions, B)).toBe(true);
  });

  it('a holiday for one class type only', () => {
    const exceptions = [holiday({ classType: 'DIRECTION_GROUP' })];
    expect(schoolDay('DIRECTION_GROUP', d(28), exceptions)).toBe(false);
    expect(schoolDay('REGULAR', d(28), exceptions)).toBe(true);
  });

  it('a transferred working Saturday opens classes 1–7', () => {
    const exceptions: CalendarException[] = [
      { branchId: null, date: d(31), kind: 'WORKDAY', classType: 'REGULAR' },
    ];
    expect(schoolDay('REGULAR', d(31), exceptions)).toBe(true);
  });

  it('the most specific entry wins: own branch over both, own type over all', () => {
    const exceptions: CalendarException[] = [
      holiday(),
      { branchId: A, date: d(28), kind: 'WORKDAY', classType: null },
    ];
    expect(schoolDay('REGULAR', d(28), exceptions, A)).toBe(true);
    expect(schoolDay('REGULAR', d(28), exceptions, B)).toBe(false);
  });

  it('a working day outside the terms stays a holiday', () => {
    const exceptions: CalendarException[] = [
      { branchId: null, date: d(24), kind: 'WORKDAY', classType: null },
    ];
    expect(schoolDay('REGULAR', d(24), exceptions)).toBe(false);
  });
});

describe('grade rules', () => {
  it('classes 1–7: the student grade equals the class grade', () => {
    expect(checkGradeForClass({ type: 'REGULAR', gradeLevel: 5 }, 5).ok).toBe(true);
    expect(checkGradeForClass({ type: 'REGULAR', gradeLevel: 5 }, 6)).toMatchObject({
      ok: false,
      error: { code: 'CLASS_GRADE_MISMATCH' },
    });
  });

  it('direction groups take grades 8–11 only, mixed', () => {
    for (const grade of [8, 9, 10, 11]) {
      expect(checkGradeForClass({ type: 'DIRECTION_GROUP', gradeLevel: null }, grade).ok).toBe(
        true,
      );
    }
    for (const grade of [1, 7]) {
      expect(
        checkGradeForClass({ type: 'DIRECTION_GROUP', gradeLevel: null }, grade),
      ).toMatchObject({
        ok: false,
        error: { code: 'GROUP_GRADE_INVALID' },
      });
    }
  });
});

describe('helpers', () => {
  it('class names compare without case and spacing', () => {
    expect(nameKey(' 5 - а ')).toBe(nameKey('5-А'));
    expect(nameKey('экономика  1')).toBe('ЭКОНОМИКА 1');
  });

  it('import headers and values match in either language', () => {
    expect(matchHeader('STUDENTS', 'Фамилия *')).toBe('lastName');
    expect(matchHeader('STUDENTS', 'familiyasi')).toBe('lastName');
    expect(matchHeader('STUDENTS', 'Что-то ещё')).toBeNull();
    expect(matchValue('gender', 'Ж')).toBe('FEMALE');
    expect(matchValue('gender', 'qiz')).toBe('FEMALE');
    expect(matchValue('classType', 'группа')).toBe('DIRECTION_GROUP');
    expect(matchValue('relation', 'Otasi')).toBe('FATHER');
    expect(matchValue('yesNo', 'да')).toBe('yes');
    expect(matchValue('gender', 'x')).toBeNull();
  });

  it('import dates: Excel dates and DD.MM.YYYY', () => {
    expect(parseCellDate('2015-09-02')).toBe('2015-09-02');
    expect(parseCellDate('2.9.2015')).toBe('2015-09-02');
    expect(parseCellDate('31.02.2015')).toBeNull();
    expect(parseCellDate('вчера')).toBeNull();
  });
});
