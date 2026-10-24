import { can, listClasses } from '@gl/core';
import { EmptyState } from '@gl/ui';
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { NewStudentForm } from './new-student-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: (await getTranslations({ locale, namespace: 'people.students' }))('createTitle'),
  };
}

export default async function NewStudentPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('people.student.manage');
  const t = await getTranslations('people.students');
  const branchId =
    actor.activeBranchId ?? (actor.branches.length === 1 ? actor.branches[0]!.id : null);
  if (branchId && !can(actor, 'people.student.manage', { branchId })) notFound();
  const classes = branchId ? (await listClasses(ctx)).filter((c) => c.branchId === branchId) : [];

  return (
    <>
      <PageHeader title={t('createTitle')} description={t('createText')} />
      {branchId ? (
        <NewStudentForm
          classes={classes.map((c) => ({
            value: c.id,
            label: `${c.name} · ${c.occupied}/${c.capacity}`,
          }))}
        />
      ) : (
        <EmptyState icon={<Building2 strokeWidth={1.75} />} title={t('pickBranch')} />
      )}
    </>
  );
}
