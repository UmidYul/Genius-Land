import { listAuditLog } from '@gl/core';
import { formatDateTime, parseIsoDate } from '@gl/core/time';
import {
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import { ScrollText } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { requirePermission } from '@/lib/auth';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.audit' });
  return { title: t('title') };
}

type Search = {
  action?: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  branch?: string;
  from?: string;
  to?: string;
  page?: string;
};

const ENTITY_TYPES = ['User', 'Branch', 'Setting', 'ApprovalRequest', 'NotificationChannel'];
const UUID = /^[0-9a-f-]{36}$/i;

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <pre className="bg-surface-sunk max-h-48 max-w-md overflow-auto whitespace-pre-wrap rounded-lg p-2 font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.audit.view');
  const search = await searchParams;
  const t = await getTranslations('admin.audit');
  const tCommon = await getTranslations('common');

  const { entries, total, page, pageSize } = await listAuditLog(ctx, {
    action: search.action?.trim() || undefined,
    entityType: ENTITY_TYPES.includes(search.entityType ?? '') ? search.entityType : undefined,
    entityId: search.entityId?.trim() || undefined,
    actorId: search.actor && UUID.test(search.actor) ? search.actor : undefined,
    branchId: search.branch && UUID.test(search.branch) ? search.branch : undefined,
    from: search.from ? (parseIsoDate(search.from) ?? undefined) : undefined,
    to: search.to ? (parseIsoDate(search.to) ?? undefined) : undefined,
    page: Number(search.page) || 1,
  });
  const branchName = (id: string | null) => {
    const b = actor.branches.find((x) => x.id === id);
    return b ? (locale === 'ru' ? b.nameRu : b.nameUz) : '—';
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle', { count: total })} />
      <form className="bg-surface mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <Input
          id="action"
          name="action"
          label={t('action')}
          placeholder={t('actionPlaceholder')}
          defaultValue={search.action}
        />
        <Select
          id="entityType"
          name="entityType"
          label={t('entityType')}
          defaultValue={search.entityType ?? ''}
          placeholder={tCommon('all')}
          options={ENTITY_TYPES.map((type) => ({ value: type, label: type }))}
        />
        <Input id="entityId" name="entityId" label={t('entityId')} defaultValue={search.entityId} />
        <Select
          id="branch"
          name="branch"
          label={t('branch')}
          defaultValue={search.branch ?? ''}
          placeholder={tCommon('all')}
          options={actor.branches.map((b) => ({
            value: b.id,
            label: locale === 'ru' ? b.nameRu : b.nameUz,
          }))}
        />
        <Input id="actor" name="actor" label={t('actorId')} defaultValue={search.actor} />
        <Input id="from" name="from" type="date" label={t('from')} defaultValue={search.from} />
        <Input id="to" name="to" type="date" label={t('to')} defaultValue={search.to} />
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>

      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText strokeWidth={1.75} />} title={t('empty')} />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('time')}</TableHeaderCell>
                <TableHeaderCell>{t('actor')}</TableHeaderCell>
                <TableHeaderCell>{t('action')}</TableHeaderCell>
                <TableHeaderCell>{t('entity')}</TableHeaderCell>
                <TableHeaderCell>{t('branch')}</TableHeaderCell>
                <TableHeaderCell>{t('details')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="min-w-40">
                    {entry.actor?.fullName ?? t('system')}
                    {entry.ip && <p className="text-fg-muted text-xs tabular-nums">{entry.ip}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {entry.action}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p className="font-semibold">{entry.entityType}</p>
                    <p className="text-fg-muted break-all font-mono">{entry.entityId}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{branchName(entry.branchId)}</TableCell>
                  <TableCell className="min-w-64">
                    {entry.reason && (
                      <p className="mb-1 text-sm">{t('reason', { reason: entry.reason })}</p>
                    )}
                    {(entry.before !== null || entry.after !== null) && (
                      <details>
                        <summary className="text-primary-soft-fg cursor-pointer text-sm font-semibold">
                          {t('changes')}
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          {entry.before !== null && (
                            <div>
                              <p className="text-fg-muted text-xs font-semibold">{t('before')}</p>
                              <Json value={entry.before} />
                            </div>
                          )}
                          {entry.after !== null && (
                            <div>
                              <p className="text-fg-muted text-xs font-semibold">{t('after')}</p>
                              <Json value={entry.after} />
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        searchParams={search}
        basePath="/admin/audit"
      />
    </>
  );
}
