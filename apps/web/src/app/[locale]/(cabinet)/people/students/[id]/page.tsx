import { can, dbDateToIso, formatPhone, fromDbDate, getStudent, listClasses } from '@gl/core';
import { formatDate, formatDateTime } from '@gl/core/time';
import { Card, CardHeader, CardTitle } from '@gl/ui';
import { Star } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';
import {
  AddGuardianDialog,
  EditStudentDialog,
  GuardianActions,
  StatusDialog,
  TransferDialog,
} from './student-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'people.students' }))('cardTitle') };
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('people.student.view');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const student = await getStudent(ctx, id);
  if (!student) notFound();
  const t = await getTranslations('people.students');
  const tG = await getTranslations('people.guardians');
  const name = (x: { nameUz: string; nameRu: string }) => (locale === 'ru' ? x.nameRu : x.nameUz);

  const canManage = can(actor, 'people.student.manage', { branchId: student.branchId });
  const canGuardians = can(actor, 'people.guardian.manage', { branchId: student.branchId });
  const canSeeGuardians = can(actor, 'people.guardian.view', {
    branchId: student.branchId,
    classId: student.classId,
  });
  const transferTargets =
    canManage && student.status === 'ACTIVE'
      ? (await listClasses(ctx)).filter(
          (c) => c.branchId === student.branchId && c.id !== student.classId,
        )
      : [];

  const historyText = (h: (typeof student.history)[number]) => {
    const cls = (cid: string | null) => (cid ? (student.historyClasses[cid] ?? '—') : '—');
    if (h.kind === 'ENROLLED') return t('history.enrolled', { class: cls(h.toClassId) });
    if (h.kind === 'TRANSFER')
      return t('history.transfer', { from: cls(h.fromClassId), to: cls(h.toClassId) });
    return t('history.status', {
      from: h.fromStatus ? t(`status.${h.fromStatus}`) : '—',
      to: h.toStatus ? t(`status.${h.toStatus}`) : '—',
    });
  };

  return (
    <>
      <Link
        href="/people/students"
        className="text-fg-muted mb-2 inline-block rounded-lg text-sm font-medium hover:underline"
      >
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={`${student.lastName} ${student.firstName} ${student.middleName ?? ''}`.trim()}
          description={
            <span className="tabular-nums">
              {student.number} · {t(`status.${student.status}`)}
            </span>
          }
        />
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <EditStudentDialog
              id={student.id}
              values={{
                lastName: student.lastName,
                firstName: student.firstName,
                middleName: student.middleName,
                birthDate: dbDateToIso(student.birthDate),
                gender: student.gender,
                gradeLevel: student.gradeLevel,
                emergencyContactName: student.emergencyContactName,
                emergencyContactPhone: student.emergencyContactPhone,
              }}
            />
            {student.status === 'ACTIVE' && (
              <TransferDialog
                studentId={student.id}
                gradeLevel={student.gradeLevel}
                classes={transferTargets.map((c) => ({
                  value: c.id,
                  label: `${c.name} · ${c.occupied}/${c.capacity}`,
                }))}
              />
            )}
            <StatusDialog studentId={student.id} status={student.status} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t('data')}</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">{t('class')}</dt>
            <dd>
              {student.class ? (
                <Link
                  href={`/school/classes/${student.class.id}`}
                  className="font-semibold hover:underline"
                >
                  {student.class.name}
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-fg-muted">{t('grade')}</dt>
            <dd className="tabular-nums">{student.gradeLevel}</dd>
            <dt className="text-fg-muted">{t('birthDate')}</dt>
            <dd className="tabular-nums">{formatDate(fromDbDate(student.birthDate))}</dd>
            <dt className="text-fg-muted">{t('gender')}</dt>
            <dd>{t(`genders.${student.gender}`)}</dd>
            <dt className="text-fg-muted">{t('branch')}</dt>
            <dd>{name(student.branch)}</dd>
            <dt className="text-fg-muted">{t('emergency')}</dt>
            <dd>
              {student.emergencyContactName || student.emergencyContactPhone ? (
                <>
                  {student.emergencyContactName}
                  {student.emergencyContactPhone && (
                    <span className="text-fg-muted ms-1 tabular-nums">
                      {formatPhone(student.emergencyContactPhone)}
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        </Card>

        {canSeeGuardians && (
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
              <CardTitle>{tG('title')}</CardTitle>
              {canGuardians && <AddGuardianDialog studentId={student.id} />}
            </CardHeader>
            {student.guardians.length === 0 ? (
              <p className="text-fg-muted text-sm">{tG('none')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {student.guardians.map((link) => (
                  <li
                    key={link.id}
                    className="bg-surface-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {link.guardian.fullName}
                        {link.isPrimary && (
                          <span className="text-primary-soft-fg inline-flex items-center gap-1 text-xs">
                            <Star aria-hidden strokeWidth={2} className="size-3.5" />
                            {tG('primary')}
                          </span>
                        )}
                      </p>
                      <p className="text-fg-muted text-xs tabular-nums">
                        {tG(`relations.${link.relation}`)} · {formatPhone(link.guardian.phone)}
                      </p>
                    </div>
                    {canGuardians && (
                      <GuardianActions
                        studentId={student.id}
                        guardianId={link.guardian.id}
                        isPrimary={link.isPrimary}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('historyTitle')}</CardTitle>
          </CardHeader>
          <ol className="flex flex-col gap-2">
            {student.history.map((h) => (
              <li key={h.id} className="border-border-soft border-s-2 ps-3">
                <p className="text-sm font-medium">{historyText(h)}</p>
                <p className="text-fg-muted text-xs tabular-nums">
                  {formatDate(fromDbDate(h.date))}
                  {h.actor ? ` · ${h.actor.fullName}` : ''}
                  {` · ${formatDateTime(h.createdAt)}`}
                </p>
                {h.reason && (
                  <p className="text-fg-muted text-xs">{t('reasonValue', { reason: h.reason })}</p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
