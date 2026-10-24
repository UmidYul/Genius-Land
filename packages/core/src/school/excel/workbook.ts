import type { ImportKind } from '@gl/db';
import { translate, type Locale, type MessageKey } from '@gl/i18n';
import ExcelJS from 'exceljs';
import { toIsoDate } from '../../time';
import { columnLabel, importColumns, matchHeader, valueLabels } from './columns';

export type CellValue = string | number | boolean | Date | null;

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  // Brand primary-soft from docs/BRAND.md — the spreadsheet has no CSS tokens.
  fgColor: { argb: 'FFE5F8F0' },
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 32;
}

/**
 * Empty template for an import: headers in the user's language (required ones marked "*"),
 * drop-down lists for enumerated columns, and a second sheet explaining the formats.
 * No sample rows — sample data would look real.
 */
export async function buildTemplate(kind: ImportKind, locale: Locale): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(translate(locale, `import.kinds.${kind}` as MessageKey));
  const columns = importColumns[kind];
  sheet.columns = columns.map((c) => ({
    header: `${columnLabel(kind, c.key, locale)}${c.required ? ' *' : ''}`,
    key: c.key,
    width: 24,
  }));
  styleHeader(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  columns.forEach((column, index) => {
    if (!column.values) return;
    const options = Object.keys(valueLabels(column.values)).map((code) =>
      translate(locale, `import.values.${column.values}.${code}` as MessageKey),
    );
    const letter = sheet.getColumn(index + 1).letter;
    for (let row = 2; row <= 1000; row++) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: 'list',
        allowBlank: !column.required,
        formulae: [`"${options.join(',')}"`],
      };
    }
  });

  const help = workbook.addWorksheet(translate(locale, 'import.helpSheet'));
  help.columns = [
    { header: translate(locale, 'import.helpColumn'), key: 'column', width: 30 },
    { header: translate(locale, 'import.helpFormat'), key: 'format', width: 80 },
  ];
  styleHeader(help.getRow(1));
  for (const column of columns) {
    help.addRow({
      column: columnLabel(kind, column.key, locale),
      format: translate(locale, `import.hints.${kind}.${column.key}` as MessageKey),
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export interface SheetRow {
  /** Row number in the sheet (as Excel shows it). */
  row: number;
  values: Record<string, string>;
}

export type ReadResult =
  | { ok: true; rows: SheetRow[]; unknownHeaders: string[] }
  | { ok: false; code: 'IMPORT_FILE_INVALID' | 'IMPORT_MISSING_COLUMNS'; missing?: string[] };

/** Cell → text. Dates become ISO (yyyy-mm-dd) — Excel stores them as UTC midnight. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return toIsoDate({
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    });
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim(); // hyperlink
    if ('richText' in value)
      return value.richText
        .map((r) => r.text)
        .join('')
        .trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue); // formula
    return '';
  }
  return String(value).trim();
}

/** Reads the first sheet: header row → column keys, then every non-empty row. */
export async function readImportFile(
  kind: ImportKind,
  data: ArrayBuffer | Buffer,
): Promise<ReadResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as ArrayBuffer);
  } catch {
    return { ok: false, code: 'IMPORT_FILE_INVALID' };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, code: 'IMPORT_FILE_INVALID' };

  const keyByColumn = new Map<number, string>();
  const unknownHeaders: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    const text = cellText(cell.value);
    const key = matchHeader(kind, text);
    if (key) keyByColumn.set(col, key);
    else if (text) unknownHeaders.push(text);
  });
  const found = new Set(keyByColumn.values());
  const missing = importColumns[kind]
    .filter((c) => c.required && !found.has(c.key))
    .map((c) => c.key);
  if (missing.length > 0) return { ok: false, code: 'IMPORT_MISSING_COLUMNS', missing };

  const rows: SheetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    for (const [col, key] of keyByColumn) values[key] = cellText(row.getCell(col).value);
    if (Object.values(values).some((v) => v !== '')) rows.push({ row: rowNumber, values });
  });
  return { ok: true, rows, unknownHeaders };
}

export interface ExportColumn<T> {
  header: string;
  width?: number;
  value: (row: T) => CellValue;
}

/** A registry export: one sheet, translated headers, values as shown in the interface. */
export async function buildExport<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c, i) => ({
    header: c.header,
    key: String(i),
    width: c.width ?? 22,
  }));
  styleHeader(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c, i) => [String(i), c.value(row)])));
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
