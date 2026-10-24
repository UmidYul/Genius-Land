import { can, dbDateToIso, fromDbDate, listAcademicYears } from '@gl/core';
import { formatDate } from '@gl/core/time';
import { Button, Card, EmptyState } from '@gl/ui';
import { CalendarRange, CircleCheck } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { setCurrentYearAction } from '../actions';
import { CreateYearDialog, EditTermsDialog } from './year-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'school.years' }))('title') };
}

export default async function YearsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('school.academicYear.view');
  const years = await listAcademicYears(ctx);
  const t = await getTranslations('school.years');
  const canManage = can(actor, 'school.academicYear.manage');
  const showBranch = actor.branches.length > 1;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle')} />
        {canManage && <CreateYearDialog />}
      </div>
      {years.length === 0 ? (
        <EmptyState
          icon={<CalendarRange strokeWidth={1.75} />}
          title={t('empty')}
          description={t('emptyText')}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          {years.map((year) => {
            const manage = can(actor, 'school.academicYear.manage', { branchId: year.branchId });
            return (
              <li key={year.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-head text-lg font-semibold">{year.name}</h2>
                      <p className="text-fg-muted text-sm">
                        {showBranch &&
                          `${locale === 'ru' ? year.branch.nameRu : year.branch.nameUz} · `}
                        {t('classesCount', { count: year._count.classes })}
                      </p>
                    </div>
                    {year.isCurrent ? (
                      <span className="bg-success-soft text-success-fg inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold">
                        <CircleCheck aria-hidden strokeWidth={2} className="size-3.5" />
                        {t('current')}
                      </span>
                    ) : (
                      manage && (
                        <form action={setCurrentYearAction}>
                          <input type="hidden" name="yearId" value={year.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            {t('makeCurrentButton')}
                          </Button>
                        </form>
                      )
                    )}
                  </div>
                  <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {year.terms.map((term) => (
                      <li key={term.id} className="bg-surface-2 rounded-xl px-3 py-2">
                        <p className="text-fg-muted text-xs font-semibold">
                          {t('term', { n: term.number })}
                        </p>
                        <p className="text-sm tabular-nums">
                          {formatDate(fromDbDate(term.startDate))} —{' '}
                          {formatDate(fromDbDate(term.endDate))}
                        </p>
                      </li>
                    ))}
                  </ol>
                  {manage && (
                    <EditTermsDialog
                      yearId={year.id}
                      terms={year.terms.map((term) => ({
                        startDate: dbDateToIso(term.startDate),
                        endDate: dbDateToIso(term.endDate),
                      }))}
                    />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
