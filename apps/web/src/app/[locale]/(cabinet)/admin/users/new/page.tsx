import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { roleOptions } from '../role-options';
import { CreateUserForm } from '../user-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.users' });
  return { title: t('createTitle') };
}

export default async function NewUserPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.user.manage');
  const t = await getTranslations('admin.users');
  const branches = await ctx.db.branch.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <PageHeader title={t('createTitle')} description={t('createText')} />
      <CreateUserForm
        roles={roleOptions(actor).filter((r) => !r.locked)}
        branches={branches.map((b) => ({ id: b.id, name: locale === 'ru' ? b.nameRu : b.nameUz }))}
      />
    </>
  );
}
