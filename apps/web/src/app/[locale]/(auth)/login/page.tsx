import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getAuth } from '@/lib/auth';
import { LoginForm } from './login-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('title') };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getAuth()) redirect({ href: '/', locale });
  const { reset } = await searchParams;
  return <LoginForm passwordWasReset={reset === '1'} />;
}
