'use client';

import { Card, Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { changePasswordAction } from './actions';

export function PasswordForm() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const [state, action] = useActionState(changePasswordAction, {});

  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        <FormAlert tone="error">{state.fields ? null : state.error}</FormAlert>
        <FormAlert tone="success">{state.message}</FormAlert>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          label={t('currentPassword')}
          error={state.fields?.current}
          required
        />
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          label={tAuth('newPassword')}
          hint={tAuth('passwordRules')}
          error={state.fields?.password}
          required
        />
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          label={tAuth('confirmPassword')}
          error={state.fields?.confirm}
          required
        />
        <SubmitButton className="self-start">{tAuth('savePassword')}</SubmitButton>
      </form>
    </Card>
  );
}
