import { can, fromDbDate, getCurrentYear, listCalendarDays } from '@gl/core';
import { formatDate, toLocalDate } from '@gl/core/time';
import {
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import { CalendarCheck, CalendarX, CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { removeCalendarDayAction } from '../actions';
import { AddCalendarDayDialog } from './calendar-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'school.calendar' }))('title') };
}

export default async function CalendarPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('school.academicYear.view');
  const t = await getTranslations('school.calendar');
  const branchName = (b: { nameUz: string; nameRu: string }) =>
    locale === 'ru' ? b.nameRu : b.nameUz;

  // The current year of the active branch defines the range; otherwise the coming twelve months.
  const branchId = actor.activeBranchId ?? actor.branches[0]?.id;
  const year = branchId ? await getCurrentYear(ctx, branchId) : null;
  const today = toLocalDate(new Date());
  const range = year
    ? { from: fromDbDate(year.startDate), to: fromDbDate(year.endDate) }
    : { from: today, to: { ...today, year: today.year + 1 } };
  const days = await listCalendarDays(ctx, range);

  const manageable = actor.branches.filter((b) =>
    can(actor, 'school.calendar.manage', { branchId: b.id }),
  );
  const allowBoth =
    manageable.length > 0 &&
    manageable.length === actor.branches.length &&
    actor.branches.length > 1;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={t('title')}
          description={year ? t('subtitleYear', { year: year.name }) : t('subtitleNoYear')}
        />
        {manageable.length > 0 && (
          <AddCalendarDayDialog
            branches={manageable.map((b) => ({ id: b.id, name: branchName(b) }))}
            allowBoth={allowBoth}
          />
        )}
      </div>
      <p className="text-fg-muted mb-4 text-sm">{t('weekRule')}</p>
      {days.length === 0 ? (
        <EmptyState
          icon={<CalendarDays strokeWidth={1.75} />}
          title={t('empty')}
          description={t('emptyText')}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('date')}</TableHeaderCell>
                <TableHeaderCell>{t('kind')}</TableHeaderCell>
                <TableHeaderCell>{t('appliesTo')}</TableHeaderCell>
                <TableHeaderCell>{t('branch')}</TableHeaderCell>
                <TableHeaderCell>{t('note')}</TableHeaderCell>
                <TableHeaderCell className="w-px" />
              </TableRow>
            </TableHead>
            <TableBody>
              {days.map((day) => {
                const branch = actor.branches.find((b) => b.id === day.branchId);
                const removable = day.branchId
                  ? can(actor, 'school.calendar.manage', { branchId: day.branchId })
                  : allowBoth;
                return (
                  <TableRow key={day.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(fromDbDate(day.date))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {day.kind === 'HOLIDAY' ? (
                          <CalendarX
                            aria-hidden
                            strokeWidth={1.75}
                            className="text-danger size-4"
                          />
                        ) : (
                          <CalendarCheck
                            aria-hidden
                            strokeWidth={1.75}
                            className="text-success size-4"
                          />
                        )}
                        {t(`kinds.${day.kind}`)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {day.classType ? t(`classTypes.${day.classType}`) : t('allClasses')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {branch ? branchName(branch) : t('bothBranches')}
                    </TableCell>
                    <TableCell className="min-w-40">{day.note}</TableCell>
                    <TableCell>
                      {removable && (
                        <form action={removeCalendarDayAction}>
                          <input type="hidden" name="id" value={day.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            {t('remove')}
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
