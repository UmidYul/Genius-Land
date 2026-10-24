import { can, importPermission } from '@gl/core';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { requireAuth } from '@/lib/auth';
import { ImportFlow } from './import-flow';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'import' }))('title') };
}

export default async function ImportPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { actor } = await requireAuth();
  const branchId =
    actor.activeBranchId ?? (actor.branches.length === 1 ? actor.branches[0]!.id : null);
  // Order matters: staff before classes (homeroom), classes before students, students before guardians.
  const kinds = (['STAFF', 'CLASSES', 'STUDENTS', 'GUARDIANS'] as const).filter(
    (k) => branchId && can(actor, importPermission[k], { branchId }),
  );
  if (!can(actor, 'people.student.manage')) notFound();
  const t = await getTranslations('import');
  const branch = actor.branches.find((b) => b.id === branchId);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={
          branch
            ? t('subtitle', { branch: locale === 'ru' ? branch.nameRu : branch.nameUz })
            : t('pickBranch')
        }
      />
      {kinds.length > 0 && <ImportFlow kinds={[...kinds]} />}
    </>
  );
}
