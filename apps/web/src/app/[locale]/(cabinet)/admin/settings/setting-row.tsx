'use client';

import { Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { changeSettingAction } from './actions';

export function SettingRow({
  settingKey,
  label,
  hint,
  value,
  defaultValue,
  canManage,
}: {
  settingKey: string;
  label: string;
  hint: string;
  value: number;
  defaultValue: number;
  canManage: boolean;
}) {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('common');
  const [state, action, actionPending] = useActionState(changeSettingAction, {});
  const id = `setting-${settingKey.replace(/\W/g, '-')}`;

  return (
    <li className="bg-surface flex flex-col gap-3 rounded-2xl p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-fg-muted text-sm">{hint}</p>
        <p className="text-fg-muted mt-1 text-xs tabular-nums">
          {t('default', { value: defaultValue })}
          <span className="ms-2 font-mono">{settingKey}</span>
        </p>
      </div>
      {canManage ? (
        <Form
          action={action}
          pending={actionPending}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="key" value={settingKey} />
          <Input
            id={id}
            name="value"
            type="number"
            inputMode="numeric"
            label={t('value')}
            defaultValue={value}
            numeric
            required
            containerClassName="sm:w-36"
          />
          <Input
            id={`${id}-reason`}
            name="reason"
            label={t('reason')}
            containerClassName="flex-1"
          />
          <SubmitButton variant="secondary">{tCommon('save')}</SubmitButton>
        </Form>
      ) : (
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      )}
      <FormAlert tone="error">{state.error}</FormAlert>
      <FormAlert tone="success">{state.ok ? state.message : null}</FormAlert>
    </li>
  );
}
