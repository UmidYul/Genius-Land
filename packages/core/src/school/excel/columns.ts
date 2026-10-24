import type { ImportKind } from '@gl/db';
import { messages, type Locale } from '@gl/i18n';

/**
 * Our own Excel templates (the old system's export format is unknown; mapping its columns is
 * stage 8). Headers are written in the user's language; on import a header matches either
 * language, so a file filled in Uzbek imports for a Russian-speaking admin too.
 */
export interface ColumnDef {
  key: string;
  required: boolean;
  /** Enumerated values: the cell must match one of these (either language). */
  values?: ValueSet;
}

export type ValueSet = 'classType' | 'gender' | 'relation' | 'yesNo';

export const importColumns: Record<ImportKind, ColumnDef[]> = {
  CLASSES: [
    { key: 'type', required: true, values: 'classType' },
    { key: 'name', required: true },
    { key: 'gradeLevel', required: false },
    { key: 'direction', required: false },
    { key: 'capacity', required: true },
    { key: 'homeroomPhone', required: true },
  ],
  STAFF: [
    { key: 'fullName', required: true },
    { key: 'phone', required: true },
    { key: 'position', required: true },
  ],
  STUDENTS: [
    { key: 'lastName', required: true },
    { key: 'firstName', required: true },
    { key: 'middleName', required: false },
    { key: 'birthDate', required: true },
    { key: 'gender', required: true, values: 'gender' },
    { key: 'gradeLevel', required: true },
    { key: 'className', required: false },
    { key: 'emergencyName', required: false },
    { key: 'emergencyPhone', required: false },
  ],
  GUARDIANS: [
    { key: 'studentNumber', required: true },
    { key: 'fullName', required: true },
    { key: 'phone', required: true },
    { key: 'relation', required: true, values: 'relation' },
    { key: 'isPrimary', required: false, values: 'yesNo' },
  ],
};

type Dict = Record<string, unknown>;
const at = (locale: Locale, path: string[]): unknown =>
  path.reduce<unknown>((node, key) => (node as Dict | undefined)?.[key], messages[locale]);

export function columnLabel(kind: ImportKind, key: string, locale: Locale): string {
  return String(at(locale, ['import', 'columns', kind, key]) ?? key);
}

/** Allowed values of a set, as { code: [labels in both languages] }. */
export function valueLabels(set: ValueSet): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const locale of ['uz', 'ru'] as const) {
    const values = at(locale, ['import', 'values', set]) as Record<string, string>;
    for (const [code, label] of Object.entries(values)) (result[code] ??= []).push(label);
  }
  return result;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ'‘’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Matches a cell to a value code: a full label in either language or its first letter. */
export function matchValue(set: ValueSet, raw: string): string | null {
  const cell = norm(raw);
  if (!cell) return null;
  const labels = valueLabels(set);
  for (const [code, names] of Object.entries(labels)) {
    if (names.some((n) => norm(n) === cell)) return code;
  }
  if (cell.length === 1) {
    const byLetter = Object.entries(labels).filter(([, names]) =>
      names.some((n) => norm(n).startsWith(cell)),
    );
    if (byLetter.length === 1) return byLetter[0]![0];
  }
  return null;
}

/** Header cell → column key (either language, case and spacing ignored). */
export function matchHeader(kind: ImportKind, header: string): string | null {
  const cell = norm(header).replace(/\s*\*$/, '');
  for (const column of importColumns[kind]) {
    for (const locale of ['uz', 'ru'] as const) {
      if (norm(columnLabel(kind, column.key, locale)) === cell) return column.key;
    }
  }
  return null;
}
