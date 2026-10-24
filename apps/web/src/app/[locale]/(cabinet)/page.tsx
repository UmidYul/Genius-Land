import { formatDate } from '@gl/core/time';
import { EmptyState } from '@gl/ui';
import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { PageHeader } from '@/components/page-header';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return { title: t('title') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Render on every request: "today" must never come from a build-time snapshot.
  await connection();
  const t = await getTranslations('home');

  return (
    <>
      <PageHeader
        title={t('title')}
        description={
          <span className="tabular-nums">{t('today', { date: formatDate(new Date()) })}</span>
        }
      />
      <EmptyState
        icon={<LayoutDashboard strokeWidth={1.75} />}
        title={t('emptyTitle')}
        description={t('emptyText')}
      />
    </>
  );
}
