import { formatPhone, getProfile, listMySessions } from '@gl/core';
import { formatDateTime } from '@gl/core/time';
import { Button, Card, CardDescription, CardHeader, CardTitle, Select } from '@gl/ui';
import { Mail, MessageSquareText, MonitorSmartphone, Send } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { requireAuth } from '@/lib/auth';
import {
  removeChannelAction,
  setLocaleAction,
  signOutOthersAction,
  signOutSessionAction,
} from './actions';
import { EmailChannelForm } from './email-channel-form';
import { PasswordForm } from './password-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title') };
}

const channelIcons = { SMS: MessageSquareText, EMAIL: Mail, TELEGRAM: Send } as const;

/** A short, human description of a browser from its user agent. */
function deviceName(userAgent: string | null): string {
  if (!userAgent) return '—';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null;
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' · ') || userAgent.slice(0, 40);
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor, session } = await requireAuth();
  const [profile, sessions] = await Promise.all([getProfile(ctx), listMySessions(ctx)]);
  const t = await getTranslations('profile');
  const tRoles = await getTranslations('roles');
  const tChannels = await getTranslations('channels');
  const tLocale = await getTranslations('locale');

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{profile.fullName}</CardTitle>
            <CardDescription>
              {actor.roleCodes.map((code) => tRoles(code)).join(', ')}
            </CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">{t('phone')}</dt>
            <dd className="tabular-nums">{formatPhone(profile.phone)}</dd>
            <dt className="text-fg-muted">{t('email')}</dt>
            <dd className="min-w-0 truncate">{profile.email ?? '—'}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('language')}</CardTitle>
            <CardDescription>{t('languageText')}</CardDescription>
          </CardHeader>
          <form action={setLocaleAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              id="locale"
              name="locale"
              label={t('language')}
              defaultValue={profile.locale}
              options={[
                { value: 'uz', label: tLocale('uz') },
                { value: 'ru', label: tLocale('ru') },
              ]}
              containerClassName="flex-1"
            />
            <SubmitButton variant="secondary">{t('save')}</SubmitButton>
          </form>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="font-head text-lg font-semibold">{t('password')}</h2>
          <PasswordForm />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('channels')}</CardTitle>
            <CardDescription>{t('channelsText')}</CardDescription>
          </CardHeader>
          <ul className="mb-4 flex flex-col gap-2">
            {profile.channels.map((channel) => {
              const Icon = channelIcons[channel.type];
              return (
                <li
                  key={channel.id}
                  className="bg-surface-2 flex items-center gap-3 rounded-xl p-3"
                >
                  <Icon aria-hidden strokeWidth={1.75} className="text-fg-muted size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{tChannels(channel.type)}</p>
                    <p className="text-fg-muted truncate text-sm tabular-nums">
                      {channel.type === 'SMS' ? formatPhone(channel.address) : channel.address}
                    </p>
                  </div>
                  {channel.type === 'EMAIL' && (
                    <form action={removeChannelAction}>
                      <input type="hidden" name="channelId" value={channel.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t('remove')}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <EmailChannelForm />
          <p className="text-fg-muted mt-3 text-xs">{t('telegramLater')}</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('sessions')}</CardTitle>
            <CardDescription>{t('sessionsText')}</CardDescription>
          </CardHeader>
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="bg-surface-2 flex flex-wrap items-center gap-3 rounded-xl p-3"
              >
                <MonitorSmartphone
                  aria-hidden
                  strokeWidth={1.75}
                  className="text-fg-muted size-5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {deviceName(s.userAgent)}
                    {s.id === session.id && (
                      <span className="bg-primary-soft text-primary-soft-fg ms-2 rounded-md px-1.5 py-0.5 text-xs">
                        {t('thisDevice')}
                      </span>
                    )}
                  </p>
                  <p className="text-fg-muted text-xs tabular-nums">
                    {t('lastSeen', { time: formatDateTime(s.lastSeenAt) })}
                    {s.ip ? ` · ${s.ip}` : ''}
                  </p>
                </div>
                {s.id !== session.id && (
                  <form action={signOutSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t('signOutDevice')}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <form action={signOutOthersAction} className="mt-4">
              <SubmitButton variant="secondary">{t('signOutOthers')}</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
