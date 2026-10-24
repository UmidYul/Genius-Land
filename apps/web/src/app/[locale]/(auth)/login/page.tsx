import { buttonVariants, Card } from '@gl/ui';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('title') };
}

/** Placeholder: the sign-in form (phone + one-time code) arrives in stage 1. */
export default function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('auth');

  return (
    <Card className="flex w-full flex-col items-center gap-4 p-6 text-center">
      <h1 className="font-head text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-fg-muted text-[0.9375rem]">{t('comingSoon')}</p>
      <Link href="/" className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
        {t('toHome')}
      </Link>
    </Card>
  );
}
