import { messages } from '@gl/i18n';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { demo, signIn } from './helpers';

const ru = messages.ru;

async function staffFile(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('data');
  ws.addRow(['ФИО', 'Телефон', 'Должность']);
  // Unique phones per run: the e2e database is shared by both projects.
  const tail = String(Date.now()).slice(-6);
  ws.addRow([
    'Импорт Верный (e2e)',
    `+998 00 7${tail.slice(0, 2)} ${tail.slice(2, 4)} ${tail.slice(4)}`,
    'учитель',
  ]);
  ws.addRow(['Импорт Ошибка (e2e)', '12345', 'учитель']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('Excel import: template, preview with row errors, import of valid rows', async ({ page }) => {
  await signIn(page, demo.director.phone, undefined, 'ru');
  await page.goto('/ru/people/import');
  await expect(page.getByRole('heading', { level: 1, name: ru.import.title })).toBeVisible();

  // The template downloads.
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: ru.import.downloadTemplate }).click();
  expect((await download).suggestedFilename()).toBe('template-staff.xlsx');

  await page.locator('input[type=file]').setInputFiles({
    name: 'staff.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await staffFile(),
  });
  await page.getByRole('button', { name: ru.import.check }).click();

  await expect(
    page.getByText(
      ru.import.summary.replace('{total}', '2').replace('{valid}', '1').replace('{invalid}', '1'),
    ),
  ).toBeVisible();
  await expect(page.getByText(ru.errors.PHONE_INVALID)).toBeVisible();

  await page.getByRole('button', { name: ru.import.confirm.replace('{count}', '1') }).click();
  await expect(
    page.getByText(ru.import.report.replace('{created}', '1').replace('{skipped}', '1')),
  ).toBeVisible();

  await page.goto('/ru/people/staff');
  await expect(page.getByText('Импорт Верный (e2e)').first()).toBeVisible();
  await expect(page.getByText('Импорт Ошибка (e2e)')).toHaveCount(0);
});
