import { prisma } from '@gl/db';
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServiceContext } from '../../context';
import { contextFor, createUser, setupWorld, type TestWorld } from '../../testing/fixtures';
import { saveCatalogItem } from '../catalog';
import { createAcademicYear } from '../years';
import { buildTemplate, readImportFile } from './workbook';
import { confirmImport, previewImport } from './import';

let world: TestWorld;
let ctx: ServiceContext;

const TERMS = [
  { startDate: '2026-09-02', endDate: '2026-10-31' },
  { startDate: '2026-11-09', endDate: '2026-12-28' },
  { startDate: '2027-01-12', endDate: '2027-03-19' },
  { startDate: '2027-03-29', endDate: '2027-05-25' },
];

/** A workbook as a person would fill it: header row + data rows. */
async function sheet(headers: string[], rows: (string | number | Date)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('data');
  ws.addRow(headers);
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function run(kind: 'STAFF' | 'CLASSES' | 'STUDENTS' | 'GUARDIANS', data: Buffer) {
  const preview = await previewImport(ctx, { kind, fileName: `${kind}.xlsx`, data });
  if (!preview.ok) throw new Error(preview.error.code);
  return preview.value;
}

const errorsOf = (rows: { row: number; errors: { field: string; code: string }[] }[]) =>
  Object.fromEntries(
    rows
      .filter((r) => r.errors.length)
      .map((r) => [r.row, r.errors.map((e) => `${e.field}:${e.code}`)]),
  );

beforeEach(async () => {
  world = await setupWorld();
  const director = await createUser({ roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }] });
  ctx = await contextFor(director.id);
  const year = await createAcademicYear(ctx, {
    name: '2026–2027',
    terms: TERMS,
    makeCurrent: true,
  });
  if (!year.ok) throw new Error(year.error.code);
  await saveCatalogItem(ctx, 'direction', { nameRu: 'Экономика', nameUz: 'Iqtisodiyot' });
});

describe('templates', () => {
  it('a template reads back with every column recognised, in both languages', async () => {
    for (const kind of ['STAFF', 'CLASSES', 'STUDENTS', 'GUARDIANS'] as const) {
      for (const locale of ['uz', 'ru'] as const) {
        const read = await readImportFile(kind, await buildTemplate(kind, locale));
        expect(read, `${kind} ${locale}`).toMatchObject({ ok: true, rows: [], unknownHeaders: [] });
      }
    }
  });

  it('missing required columns and broken files are reported', async () => {
    const data = await sheet(['ФИО'], [['Только имя']]);
    expect(await previewImport(ctx, { kind: 'STAFF', fileName: 'x.xlsx', data })).toMatchObject({
      error: { code: 'IMPORT_MISSING_COLUMNS' },
    });
    expect(
      await previewImport(ctx, {
        kind: 'STAFF',
        fileName: 'x.xlsx',
        data: Buffer.from('not excel'),
      }),
    ).toMatchObject({
      error: { code: 'IMPORT_FILE_INVALID' },
    });
  });
});

describe('full import chain with faulty rows', () => {
  it('staff → classes → students → guardians: only valid rows are imported', async () => {
    // Staff: row 4 has a bad phone, row 5 repeats row 2.
    const staff = await run(
      'STAFF',
      await sheet(
        ['ФИО', 'Телефон', 'Должность'],
        [
          ['Учитель Один (тест)', '+998 00 300 00 01', 'учитель'],
          ['Учитель Два (тест)', '00 300 00 02', 'учитель'],
          ['Без телефона', '123', 'учитель'],
          ['Дубль', '+998003000001', 'учитель'],
        ],
      ),
    );
    expect(errorsOf(staff.rows)).toEqual({
      4: ['phone:PHONE_INVALID'],
      5: ['phone:IMPORT_DUPLICATE_IN_FILE'],
    });
    expect(await confirmImport(ctx, staff.jobId)).toMatchObject({
      ok: true,
      value: { created: 2, skipped: 2 },
    });

    // Classes: Uzbek headers; a group without direction, an unknown teacher, a bad grade.
    const classes = await run(
      'CLASSES',
      await sheet(
        ['Turi', 'Nomi', 'Sinf raqami', 'Yoʻnalish', 'Sigʻimi', 'Sinf rahbari telefoni'],
        [
          ['Sinf', '5-A', 5, '', 1, '+998003000001'],
          ['Guruh', 'IQTISODIYOT 1', '', 'Экономика', 25, '+998003000002'],
          ['Guruh', 'TIBBIYOT 1', '', '', 25, '+998003000002'],
          ['Sinf', '6-A', 6, '', 25, '+998009999999'],
          ['Sinf', '9-A', 9, '', 25, '+998003000001'],
        ],
      ),
    );
    expect(errorsOf(classes.rows)).toEqual({
      4: ['direction:CLASS_DIRECTION_REQUIRED'],
      5: ['homeroomPhone:STAFF_NOT_FOUND'],
      6: ['gradeLevel:CLASS_GRADE_REQUIRED'],
    });
    expect(await confirmImport(ctx, classes.jobId)).toMatchObject({ value: { created: 2 } });

    // Students: capacity of 5-A is 1; group takes 8–11 only; dates in two formats.
    const students = await run(
      'STUDENTS',
      await sheet(
        ['Фамилия', 'Имя', 'Дата рождения', 'Пол', 'Номер класса', 'Класс / группа'],
        [
          ['Тестов', 'Первый', '02.09.2015', 'М', 5, '5-A'],
          ['Тестов', 'Второй', new Date(Date.UTC(2015, 0, 3)), 'Ж', 5, '5-a'],
          ['Тестов', 'Третий', '01.01.2012', 'Ж', 7, 'IQTISODIYOT 1'],
          ['Тестов', 'Четвёртый', '01.01.2011', 'Ж', 10, 'IQTISODIYOT 1'],
          ['Тестов', 'Пятый', '01.01.2999', 'X', 5, 'НЕТ ТАКОГО'],
          ['Тестов', 'Шестой', '01.01.2010', 'М', 11, ''],
        ],
      ),
    );
    expect(errorsOf(students.rows)).toEqual({
      3: ['className:CLASS_FULL'],
      4: ['gradeLevel:GROUP_GRADE_INVALID'],
      6: [
        'birthDate:BIRTHDATE_INVALID',
        'gender:IMPORT_VALUE_UNKNOWN',
        'className:CLASS_NOT_FOUND',
      ],
    });
    expect(await confirmImport(ctx, students.jobId)).toMatchObject({
      value: { created: 3, skipped: 3 },
    });
    const imported = await prisma.student.findMany({ orderBy: { number: 'asc' } });
    expect(imported.map((s) => s.firstName)).toEqual(['Первый', 'Четвёртый', 'Шестой']);
    expect(imported.every((s) => /^GL-\d{6}$/.test(s.number))).toBe(true);

    // Guardians: by student number; unknown number and unknown relation are errors.
    const first = imported[0]!;
    const guardians = await run(
      'GUARDIANS',
      await sheet(
        ['Номер ученика', 'ФИО', 'Телефон', 'Кем приходится', 'Главный контакт'],
        [
          [first.number, 'Мама (тест)', '+998003100001', 'Мать', 'Да'],
          [first.number, 'Папа (тест)', '+998003100002', 'Otasi', 'Нет'],
          ['GL-999999', 'Никто', '+998003100003', 'Мать', ''],
          [first.number, 'Кто-то', '+998003100004', 'Сосед', ''],
        ],
      ),
    );
    expect(errorsOf(guardians.rows)).toEqual({
      4: ['studentNumber:STUDENT_NOT_FOUND'],
      5: ['relation:IMPORT_VALUE_UNKNOWN'],
    });
    expect(await confirmImport(ctx, guardians.jobId)).toMatchObject({ value: { created: 2 } });
    const links = await prisma.guardianLink.findMany({
      where: { studentId: first.id },
      include: { guardian: true },
    });
    expect(links.find((l) => l.isPrimary)?.guardian.fullName).toBe('Мама (тест)');
    expect(links.every((l) => l.guardian.passwordHash === null)).toBe(true);
  });
});

describe('confirmation', () => {
  it('re-checks rows: data changed after the preview is skipped and reported', async () => {
    const preview = await run(
      'STAFF',
      await sheet(
        ['ФИО', 'Телефон', 'Должность'],
        [
          ['Сотрудник А', '+998003200001', 'x'],
          ['Сотрудник Б', '+998003200002', 'x'],
        ],
      ),
    );
    // Someone adds the same phone by hand between preview and confirm.
    await prisma.staff.create({
      data: { branchId: world.branchA, fullName: 'Вручную', phone: '+998003200002', position: 'x' },
    });
    expect(await confirmImport(ctx, preview.jobId)).toMatchObject({
      value: { created: 1, skipped: 1, failedRows: [3] },
    });
  });

  it('runs once, only for its author, and is audited', async () => {
    const preview = await run(
      'STAFF',
      await sheet(['ФИО', 'Телефон', 'Должность'], [['Сотрудник', '+998003300001', 'x']]),
    );
    const other = await createUser({ roles: [{ role: 'DIRECTOR', branchIds: [world.branchA] }] });
    expect(await confirmImport(await contextFor(other.id), preview.jobId)).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect((await confirmImport(ctx, preview.jobId)).ok).toBe(true);
    expect(await confirmImport(ctx, preview.jobId)).toMatchObject({
      error: { code: 'IMPORT_ALREADY_DONE' },
    });
    expect(
      await prisma.auditLog.count({ where: { action: 'import.run', entityId: preview.jobId } }),
    ).toBe(1);
  });

  it('a teacher or accountant cannot import', async () => {
    const accountant = await createUser({
      roles: [{ role: 'ACCOUNTANT', branchIds: [world.branchA] }],
    });
    const data = await sheet(['ФИО', 'Телефон', 'Должность'], [['X Y', '+998003400001', 'x']]);
    expect(
      await previewImport(await contextFor(accountant.id), {
        kind: 'STAFF',
        fileName: 'x.xlsx',
        data,
      }),
    ).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });
});
