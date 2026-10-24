import { can, formatPhone, fromDbDate, listClasses, listStudents } from '@gl/core';
import { formatDate } from '@gl/core/time';
import {
  buttonVariants,
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
import { GraduationCap, UserPlus } from 'lucide-react';
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
  return { title: (await getTranslations({ locale, namespace: 'people.students' }))('title') };
}

type Search = { q?: string; class?: string; grade?: string; status?: string; page?: string };
const STATUSES = ['ACTIVE', 'LEFT', 'GRADUATED', 'TRANSFERRED'] as const;

export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('people.student.view');
  const search = await searchParams;
  const t = await getTranslations('people.students');
  const tCommon = await getTranslations('common');
  const status = STATUSES.find((s) => s === search.status);
  const [{ students, total, page, pageSize }, classes] = await Promise.all([
    listStudents(ctx, {
      query: search.q,
      classId: search.class || undefined,
      gradeLevel: Number(search.grade) || undefined,
      status,
      page: Number(search.page) || 1,
    }),
    can(actor, 'school.class.view') ? listClasses(ctx) : Promise.resolve([]),
  ]);
  const branchId =
    actor.activeBranchId ?? (actor.branches.length === 1 ? actor.branches[0]!.id : null);
  const canCreate = !!branchId && can(actor, 'people.student.manage', { branchId });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle', { count: total })} />
        <div className="flex flex-wrap gap-2">
          <ExportButton kind="students" searchParams={search} />
          {canCreate && (
            <Link href="/people/students/new" className={buttonVariants()}>
              <UserPlus strokeWidth={2} aria-hidden />
              {t('create')}
            </Link>
          )}
        </div>
      </div>
      <form className="bg-surface mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <Input
          id="q"
          name="q"
          type="search"
          label={tCommon('search')}
          placeholder={t('searchPlaceholder')}
          defaultValue={search.q}
        />
        <Select
          id="class"
          name="class"
          label={t('class')}
          defaultValue={search.class ?? ''}
          placeholder={tCommon('all')}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          id="grade"
          name="grade"
          label={t('grade')}
          defaultValue={search.grade ?? ''}
          placeholder={tCommon('all')}
          options={Array.from({ length: 11 }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          }))}
        />
        <Select
          id="status"
          name="status"
          label={t('statusLabel')}
          defaultValue={status ?? 'ACTIVE'}
          options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>
      {students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap strokeWidth={1.75} />}
          title={t('empty')}
          description={t('emptyText')}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('number')}</TableHeaderCell>
                <TableHeaderCell>{t('fullName')}</TableHeaderCell>
                <TableHeaderCell>{t('class')}</TableHeaderCell>
                <TableHeaderCell numeric>{t('grade')}</TableHeaderCell>
                <TableHeaderCell>{t('birthDate')}</TableHeaderCell>
                <TableHeaderCell>{t('primaryGuardian')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => {
                const g = s.guardians[0]?.guardian;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {s.number}
                    </TableCell>
                    <TableCell className="min-w-48">
                      <Link
                        href={`/people/students/${s.id}`}
                        className="font-semibold hover:underline"
                      >
                        {s.lastName} {s.firstName} {s.middleName ?? ''}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{s.class?.name ?? '—'}</TableCell>
                    <TableCell numeric>{s.gradeLevel}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(fromDbDate(s.birthDate))}
                    </TableCell>
                    <TableCell className="min-w-44">
                      {g ? (
                        <>
                          {g.fullName}
                          <p className="text-fg-muted text-xs tabular-nums">
                            {formatPhone(g.phone)}
                          </p>
                        </>
                      ) : (
                        '—'
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
        basePath="/people/students"
      />
    </>
  );
}
