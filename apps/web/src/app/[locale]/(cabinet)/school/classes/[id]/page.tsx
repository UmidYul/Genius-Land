import { can, getClass, listCatalog, staffOptions } from '@gl/core';
import { Button, Card, CardHeader, CardTitle, EmptyState } from '@gl/ui';
import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';
import { removeAssignmentAction } from '../../actions';
import { AddAssignmentDialog, EditClassDialog } from '../class-forms';
import { ArchiveClassForm } from './archive-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'school.classes' }))('cardTitle') };
}

export default async function ClassPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('school.class.view');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const cls = await getClass(ctx, id);
  if (!cls) notFound();
  const t = await getTranslations('school.classes');
  const name = (x: { nameUz: string; nameRu: string }) => (locale === 'ru' ? x.nameRu : x.nameUz);

  const canManage = can(actor, 'school.class.manage', { branchId: cls.branchId });
  const canAssign = can(actor, 'school.teachingAssignment.manage', { branchId: cls.branchId });
  const canSeeStudents = can(actor, 'people.student.view', {
    branchId: cls.branchId,
    classId: cls.id,
  });
  const needOptions = canManage || canAssign;
  const [directions, subjects, teachers] = needOptions
    ? await Promise.all([
        listCatalog(ctx, 'direction'),
        listCatalog(ctx, 'subject'),
        staffOptions(ctx, cls.branchId),
      ])
    : [[], [], []];
  const teacherOptions = teachers.map((s) => ({
    value: s.id,
    label: `${s.fullName} · ${s.position}`,
  }));

  return (
    <>
      <Link
        href="/school/classes"
        className="text-fg-muted mb-2 inline-block rounded-lg text-sm font-medium hover:underline"
      >
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={cls.name}
          description={
            cls.type === 'REGULAR'
              ? t('summaryRegular', { grade: cls.gradeLevel ?? 0, year: cls.academicYear.name })
              : t('summaryGroup', {
                  direction: cls.direction ? name(cls.direction) : '',
                  year: cls.academicYear.name,
                })
          }
        />
        {canManage && !cls.archivedAt && (
          <EditClassDialog
            values={{
              id: cls.id,
              type: cls.type,
              name: cls.name,
              gradeLevel: cls.gradeLevel,
              directionId: cls.directionId,
              capacity: cls.capacity,
              homeroomTeacherId: cls.homeroomTeacherId,
            }}
            directions={directions.map((d) => ({ value: d.id, label: name(d) }))}
            teachers={teacherOptions}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr] [&>*]:min-w-0">
        <div className="flex flex-col gap-4">
          <Card>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">{t('homeroom')}</dt>
              <dd>{cls.homeroomTeacher.fullName}</dd>
              <dt className="text-fg-muted">{t('occupancy')}</dt>
              <dd className="tabular-nums">
                {cls.students.length} / {cls.capacity}
              </dd>
              <dt className="text-fg-muted">{t('week')}</dt>
              <dd>{t(`weeks.${cls.type}`)}</dd>
            </dl>
            {cls.archivedAt && (
              <p className="text-warning-fg mt-3 text-sm font-semibold">{t('archived')}</p>
            )}
            {canManage && (
              <div className="mt-4">
                <ArchiveClassForm id={cls.id} archived={!!cls.archivedAt} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
              <CardTitle>{t('assignments')}</CardTitle>
              {canAssign && !cls.archivedAt && (
                <AddAssignmentDialog
                  classId={cls.id}
                  subjects={subjects.map((s) => ({ value: s.id, label: name(s) }))}
                  teachers={teacherOptions}
                />
              )}
            </CardHeader>
            {cls.teachingAssignments.length === 0 ? (
              <p className="text-fg-muted text-sm">{t('noAssignments')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {cls.teachingAssignments.map((a) => (
                  <li
                    key={a.id}
                    className="bg-surface-2 flex items-center gap-2 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{name(a.subject)}</p>
                      <p className="text-fg-muted truncate text-xs">{a.staff.fullName}</p>
                    </div>
                    {canAssign && (
                      <form action={removeAssignmentAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="classId" value={cls.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {t('unassign')}
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('students')}</CardTitle>
          </CardHeader>
          {!canSeeStudents ? null : cls.students.length === 0 ? (
            <EmptyState
              className="shadow-none"
              icon={<Users strokeWidth={1.75} />}
              title={t('noStudents')}
            />
          ) : (
            <ol className="divide-border-soft flex flex-col divide-y">
              {cls.students.map((s, index) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <span className="text-fg-muted w-6 text-end text-sm tabular-nums">
                    {index + 1}
                  </span>
                  <Link
                    href={`/people/students/${s.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {s.lastName} {s.firstName} {s.middleName ?? ''}
                  </Link>
                  <span className="text-fg-muted text-xs tabular-nums">{s.number}</span>
                  {cls.type === 'DIRECTION_GROUP' && (
                    <span className="bg-surface-3 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                      {t('gradeShort', { grade: s.gradeLevel })}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
