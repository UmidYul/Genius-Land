import { formatPhone, listGuardians } from '@gl/core';
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
import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExportButton } from '@/components/export-button';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'people.guardians' }))('title') };
}

type Search = { q?: string; page?: string };

/** Guardians are added from a student's card; this registry is for finding and exporting. */
export default async function GuardiansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx } = await requirePermission('people.guardian.view');
  const search = await searchParams;
  const t = await getTranslations('people.guardians');
  const tCommon = await getTranslations('common');
  const { guardians, total, page, pageSize } = await listGuardians(ctx, {
    query: search.q,
    page: Number(search.page) || 1,
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle', { count: total })} />
        <ExportButton kind="guardians" searchParams={search} />
      </div>
      <form className="bg-surface mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
        <Input
          id="q"
          name="q"
          type="search"
          label={tCommon('search')}
          placeholder={t('searchPlaceholder')}
          defaultValue={search.q}
        />
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>
      {guardians.length === 0 ? (
        <EmptyState
          icon={<Users strokeWidth={1.75} />}
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
                <TableHeaderCell>{t('children')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guardians.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="min-w-44 font-semibold">{g.fullName}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatPhone(g.phone)}
                  </TableCell>
                  <TableCell className="min-w-56">
                    <ul className="flex flex-col gap-0.5">
                      {g.guardianLinks.map((l) => (
                        <li key={l.student.id} className="text-sm">
                          <Link
                            href={`/people/students/${l.student.id}`}
                            className="hover:underline"
                          >
                            {l.student.lastName} {l.student.firstName}
                          </Link>
                          <span className="text-fg-muted">
                            {' · '}
                            {t(`relations.${l.relation}`)}
                            {l.student.class ? ` · ${l.student.class.name}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
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
        basePath="/people/guardians"
      />
    </>
  );
}
