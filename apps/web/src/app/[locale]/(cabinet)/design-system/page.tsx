import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-header';
import { DesignSystemShowcase } from './showcase';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'designSystem' });
  return { title: t('title') };
}

/** Living reference of the base components, for design review. Holds only sample data. */
export default function DesignSystemPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('designSystem');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <DesignSystemShowcase />
    </>
  );
}
