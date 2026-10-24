'use client';

import type { MessageKey } from '@gl/i18n';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import { CircleAlert, CircleCheck, Download, Upload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { confirmImportAction, previewImportAction } from './actions';

type Kind = 'STAFF' | 'CLASSES' | 'STUDENTS' | 'GUARDIANS';

/** Upload → preview with errors per row → import valid rows in one transaction → report. */
export function ImportFlow({ kinds }: { kinds: Kind[] }) {
  const t = useTranslations('import');
  const tAll = useTranslations();
  const locale = useLocale();
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'STUDENTS');
  const [fileName, setFileName] = useState('');
  const [preview, previewAction, previewPending] = useActionState(previewImportAction, {});
  const [result, confirmAction, confirmPending] = useActionState(confirmImportAction, {});

  const submit = (dispatch: (data: FormData) => void) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  const rows = preview.rows ?? [];
  const valid = rows.filter((r) => r.errors.length === 0).length;
  const errorText = (code: string, params?: Record<string, string | number>) =>
    tAll(`errors.${code}` as MessageKey, params ?? {});
  const column = (key: string) =>
    tAll(`import.columns.${preview.kind ?? kind}.${key}` as MessageKey);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('step1')}</CardTitle>
          <CardDescription>{t('step1Text')}</CardDescription>
        </CardHeader>
        <form onSubmit={submit(previewAction)} className="flex flex-col gap-4">
          <Select
            id="kind"
            name="kind"
            label={t('kind')}
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            options={kinds.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
          />
          <a
            href={`/api/import/template/${kind}?locale=${locale}`}
            className="text-primary-soft-fg inline-flex items-center gap-2 self-start rounded-lg text-sm font-semibold hover:underline"
            download
          >
            <Download aria-hidden strokeWidth={1.75} className="size-4" />
            {t('downloadTemplate')}
          </a>
          <p className="text-fg-muted text-sm">{t(`order`)}</p>
          {/* The native file input shows browser-language text; our own label is translated. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('file')}</span>
            <label className="flex min-w-0 cursor-pointer flex-wrap items-center gap-3">
              <input
                type="file"
                name="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="peer sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
              <span className="bg-surface-3 hover:bg-surface-2 peer-focus-visible:outline-focus inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                <Upload aria-hidden strokeWidth={1.75} className="size-4" />
                {t('chooseFile')}
              </span>
              <span className="text-fg-muted min-w-0 truncate text-sm">
                {fileName || t('noFile')}
              </span>
            </label>
          </div>
          <FormAlert tone="error">{preview.error}</FormAlert>
          <SubmitButton pending={previewPending} className="self-start">
            {t('check')}
          </SubmitButton>
        </form>
      </Card>

      {preview.jobId && !result.report && (
        <Card>
          <CardHeader>
            <CardTitle>{t('step2')}</CardTitle>
            <CardDescription>
              {t('summary', { total: rows.length, valid, invalid: rows.length - valid })}
            </CardDescription>
          </CardHeader>
          {preview.unknownHeaders && preview.unknownHeaders.length > 0 && (
            <p className="text-fg-muted mb-3 text-sm">
              {t('unknownHeaders', { headers: preview.unknownHeaders.join(', ') })}
            </p>
          )}
          <TableContainer className="ring-border-soft mb-4 max-h-[28rem] overflow-y-auto shadow-none ring-1">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell numeric>{t('row')}</TableHeaderCell>
                  <TableHeaderCell>{t('result')}</TableHeaderCell>
                  <TableHeaderCell>{t('valuesColumn')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.row} className="align-top">
                    <TableCell numeric>{row.row}</TableCell>
                    <TableCell className="min-w-56">
                      {row.errors.length === 0 ? (
                        <span className="text-success-fg inline-flex items-center gap-1.5 text-sm font-medium">
                          <CircleCheck aria-hidden strokeWidth={2} className="size-4" />
                          {t('ok')}
                        </span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {row.errors.map((e, i) => (
                            <li key={i} className="text-danger-fg flex items-start gap-1.5 text-sm">
                              <CircleAlert
                                aria-hidden
                                strokeWidth={2}
                                className="mt-0.5 size-4 shrink-0"
                              />
                              <span>
                                <span className="font-semibold">{column(e.field)}:</span>{' '}
                                {errorText(e.code, e.params)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-fg-muted min-w-64 text-xs',
                        row.errors.length === 0 && 'text-fg',
                      )}
                    >
                      {Object.entries(row.values)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${column(k)}: ${v}`)
                        .join(' · ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <form onSubmit={submit(confirmAction)} className="flex flex-col gap-3">
            <input type="hidden" name="jobId" value={preview.jobId} />
            <FormAlert tone="error">{result.error}</FormAlert>
            <SubmitButton pending={confirmPending} disabled={valid === 0} className="self-start">
              {t('confirm', { count: valid })}
            </SubmitButton>
          </form>
        </Card>
      )}

      {result.report && (
        <Card>
          <CardHeader>
            <CardTitle>{t('step3')}</CardTitle>
          </CardHeader>
          <FormAlert tone="success">
            {t('report', { created: result.report.created, skipped: result.report.skipped })}
          </FormAlert>
          {result.report.failedRows.length > 0 && (
            <p className="text-warning-fg mt-3 text-sm">
              {t('changedRows', { rows: result.report.failedRows.join(', ') })}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
