import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { readChallenge } from '@/lib/challenge';
import { CodeForm } from '../../code-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('codeTitle') };
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const challenge = await readChallenge('login');
  if (!challenge) redirect({ href: '/login', locale });
  return <CodeForm sentTo={challenge!.sentTo} />;
}
