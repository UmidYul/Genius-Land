import { can, listAcademicYears, listCatalog, listClasses, staffOptions } from '@gl/core';
import {
  cn,
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
import { School } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExportButton } from '@/components/export-button';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';
import { CreateClassDialog } from './class-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'school.classes' }))('title') };
}

type Search = { q?: string; type?: string; grade?: string; year?: string; archived?: string };

/** Occupancy as text and a bar; full classes are marked by text, not only colour. */
function Occupancy({
  occupied,
  capacity,
  fullLabel,
}: {
  occupied: number;
  capacity: number;
  fullLabel: string;
}) {
  const ratio = Math.min(1, occupied / capacity);
  const full = occupied >= capacity;
  return (
    <div className="flex min-w-28 flex-col gap-1">
      <span className="text-sm tabular-nums">
        {occupied} / {capacity}
        {full && <span className="text-warning-fg ms-1.5 text-xs font-semibold">{fullLabel}</span>}
      </span>
      <span className="bg-surface-3 h-1.5 overflow-hidden rounded-full" aria-hidden>
        <span
          className={cn('block h-full rounded-full', full ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}

export default async function ClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('school.class.view');
  const search = await searchParams;
  const t = await getTranslations('school.classes');
  const tCommon = await getTranslations('common');
  const name = (x: { nameUz: string; nameRu: string }) => (locale === 'ru' ? x.nameRu : x.nameUz);

  const type =
    search.type === 'REGULAR' || search.type === 'DIRECTION_GROUP' ? search.type : undefined;
  const [classes, years] = await Promise.all([
    listClasses(ctx, {
      query: search.q,
      type,
      gradeLevel: Number(search.grade) || undefined,
      academicYearId: search.year || undefined,
      includeArchived: search.archived === '1',
    }),
    can(actor, 'school.academicYear.view') ? listAcademicYears(ctx) : Promise.resolve([]),
  ]);

  // Creating a class happens in the branch chosen in the switcher (or the only branch).
  const branchId =
    actor.activeBranchId ?? (actor.branches.length === 1 ? actor.branches[0]!.id : null);
  const canCreate = !!branchId && can(actor, 'school.class.manage', { branchId });
  const [directions, teachers] = canCreate
    ? await Promise.all([listCatalog(ctx, 'direction'), staffOptions(ctx, branchId!)])
    : [[], []];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle', { count: classes.length })} />
        <div className="flex flex-wrap gap-2">
          <ExportButton kind="classes" searchParams={search} />
          {canCreate && (
            <CreateClassDialog
              directions={directions.map((d) => ({ value: d.id, label: name(d) }))}
              teachers={teachers.map((s) => ({
                value: s.id,
                label: `${s.fullName} · ${s.position}`,
              }))}
            />
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
          id="type"
          name="type"
          label={t('type')}
          defaultValue={type ?? ''}
          placeholder={tCommon('all')}
          options={[
            { value: 'REGULAR', label: t('types.REGULAR') },
            { value: 'DIRECTION_GROUP', label: t('types.DIRECTION_GROUP') },
          ]}
        />
        <Select
          id="grade"
          name="grade"
          label={t('grade')}
          defaultValue={search.grade ?? ''}
          placeholder={tCommon('all')}
          options={[1, 2, 3, 4, 5, 6, 7].map((g) => ({ value: String(g), label: String(g) }))}
        />
        <Select
          id="year"
          name="year"
          label={t('year')}
          defaultValue={search.year ?? ''}
          placeholder={t('currentYear')}
          options={years.map((y) => ({
            value: y.id,
            label: actor.branches.length > 1 ? `${y.name} · ${name(y.branch)}` : y.name,
          }))}
        />
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>

      {classes.length === 0 ? (
        <EmptyState
          icon={<School strokeWidth={1.75} />}
          title={t('empty')}
          description={t('emptyText')}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('name')}</TableHeaderCell>
                <TableHeaderCell>{t('type')}</TableHeaderCell>
                <TableHeaderCell>{t('occupancy')}</TableHeaderCell>
                <TableHeaderCell>{t('homeroom')}</TableHeaderCell>
                {actor.branches.length > 1 && <TableHeaderCell>{t('branch')}</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id} className={cls.archivedAt ? 'opacity-60' : undefined}>
                  <TableCell className="min-w-32">
                    <Link
                      href={`/school/classes/${cls.id}`}
                      className="font-semibold hover:underline"
                    >
                      {cls.name}
                    </Link>
                    {cls.archivedAt && <p className="text-fg-muted text-xs">{t('archived')}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {cls.type === 'REGULAR'
                      ? t('gradeN', { grade: cls.gradeLevel ?? 0 })
                      : cls.direction
                        ? name(cls.direction)
                        : t('types.DIRECTION_GROUP')}
                  </TableCell>
                  <TableCell>
                    <Occupancy
                      occupied={cls.occupied}
                      capacity={cls.capacity}
                      fullLabel={t('full')}
                    />
                  </TableCell>
                  <TableCell className="min-w-40">{cls.homeroomTeacher.fullName}</TableCell>
                  {actor.branches.length > 1 && (
                    <TableCell className="whitespace-nowrap">{name(cls.branch)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
