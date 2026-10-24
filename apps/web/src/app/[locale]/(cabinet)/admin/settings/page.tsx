import { can, listSettingValues } from '@gl/core';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { SettingRow } from './setting-row';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.settings' });
  return { title: t('title') };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.setting.view');
  const settings = await listSettingValues(ctx);
  const t = await getTranslations('admin.settings');
  const tSettings = await getTranslations('settings');
  const canManage = can(actor, 'admin.setting.manage');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ul className="flex flex-col gap-3">
        {settings.map((setting) => {
          // Keys like `auth.rateLimit.loginPerIpPerMinute` map to nested dictionary entries.
          const key = setting.key as 'auth.lockMinutes';
          return (
            <SettingRow
              key={setting.key}
              settingKey={setting.key}
              label={tSettings(`${key}.label`)}
              hint={tSettings(`${key}.hint`)}
              value={setting.value as number}
              defaultValue={setting.defaultValue as number}
              canManage={canManage}
            />
          );
        })}
      </ul>
    </>
  );
}
