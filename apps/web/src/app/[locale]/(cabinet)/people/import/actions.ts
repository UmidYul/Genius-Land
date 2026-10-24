'use server';

import { confirmImport, previewImport, type CheckedRow, type ImportReport } from '@gl/core';
import type { ImportKind } from '@gl/db';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

const KINDS: ImportKind[] = ['STAFF', 'CLASSES', 'STUDENTS', 'GUARDIANS'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface PreviewState {
  error?: string;
  jobId?: string;
  kind?: ImportKind;
  rows?: CheckedRow[];
  unknownHeaders?: string[];
}

export async function previewImportAction(_: PreviewState, form: FormData): Promise<PreviewState> {
  const { ctx } = await requireAuth();
  const kind = KINDS.find((k) => k === form.get('kind'));
  const file = form.get('file');
  const t = await getTranslations('errors');
  if (!kind || !(file instanceof File) || file.size === 0)
    return { error: t('IMPORT_FILE_INVALID') };
  if (file.size > MAX_BYTES) return { error: t('IMPORT_TOO_LARGE', { max: 2000 }) };
  const result = await previewImport(ctx, {
    kind,
    fileName: file.name,
    data: await file.arrayBuffer(),
  });
  if (!result.ok) return { error: (await errorState(result.error)).error };
  return {
    jobId: result.value.jobId,
    kind,
    rows: result.value.rows,
    unknownHeaders: result.value.unknownHeaders,
  };
}

export interface ConfirmState {
  error?: string;
  report?: ImportReport;
}

export async function confirmImportAction(_: ConfirmState, form: FormData): Promise<ConfirmState> {
  const { ctx } = await requireAuth();
  const result = await confirmImport(ctx, String(form.get('jobId') ?? ''));
  if (!result.ok) return { error: (await errorState(result.error)).error };
  revalidatePath('/', 'layout');
  return { report: result.value };
}
