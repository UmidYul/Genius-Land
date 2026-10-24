import { can, formatPhone, listStaff } from '@gl/core';
import {
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import { CircleCheck, CircleDashed, IdCard } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExportButton } from '@/components/export-button';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { requirePermission } from '@/lib/auth';
import { ArchiveStaffButton, StaffDialog } from './staff-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'people.staff' }))('title') };
}

type Search = { q?: string; archived?: string; page?: string };

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('people.staff.view');
  const search = await searchParams;
  const t = await getTranslations('people.staff');
  const tCommon = await getTranslations('common');
  const { staff, total, page, pageSize } = await listStaff(ctx, {
    query: search.q,
    includeArchived: search.archived === '1',
    page: Number(search.page) || 1,
  });
  const branchId =
    actor.activeBranchId ?? (actor.branches.length === 1 ? actor.branches[0]!.id : null);
  const canCreate = !!branchId && can(actor, 'people.staff.manage', { branchId });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle', { count: total })} />
        <div className="flex flex-wrap gap-2">
          <ExportButton kind="staff" searchParams={search} />
          {canCreate && <StaffDialog />}
        </div>
      </div>
      <form className="bg-surface mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Input
          id="q"
          name="q"
          type="search"
          label={tCommon('search')}
          placeholder={t('searchPlaceholder')}
          defaultValue={search.q}
        />
        <label className="flex h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={search.archived === '1'}
            className="accent-primary-solid size-5"
          />
          {t('showArchived')}
        </label>
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>
      {staff.length === 0 ? (
        <EmptyState
          icon={<IdCard strokeWidth={1.75} />}
          title={t('empty')}
          description={t('emptyText')}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('fullName')}</TableHeaderCell>
                <TableHeaderCell>{t('phone')}</TableHeaderCell>
                <TableHeaderCell>{t('position')}</TableHeaderCell>
                <TableHeaderCell>{t('homeroomOf')}</TableHeaderCell>
                <TableHeaderCell>{t('account')}</TableHeaderCell>
                <TableHeaderCell className="w-px" />
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map((s) => {
                const manage = can(actor, 'people.staff.manage', { branchId: s.branchId });
                return (
                  <TableRow key={s.id} className={s.archivedAt ? 'opacity-60' : undefined}>
                    <TableCell className="min-w-44 font-semibold">{s.fullName}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatPhone(s.phone)}
                    </TableCell>
                    <TableCell className="min-w-32">{s.position}</TableCell>
                    <TableCell className="min-w-24">
                      {s.homeroomClasses.map((c) => c.name).join(', ')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {s.userId ? (
                          <CircleCheck
                            aria-hidden
                            strokeWidth={2}
                            className="text-success size-4"
                          />
                        ) : (
                          <CircleDashed
                            aria-hidden
                            strokeWidth={1.75}
                            className="text-fg-muted size-4"
                          />
                        )}
                        {s.userId ? t('linked') : t('notLinked')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {manage && (
                        <div className="flex items-start gap-1">
                          {!s.archivedAt && <StaffDialog staff={s} />}
                          <ArchiveStaffButton id={s.id} archived={!!s.archivedAt} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        searchParams={search}
        basePath="/people/staff"
      />
    </>
  );
}
