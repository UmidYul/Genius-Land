'use client';

import { Card, Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { Link } from '@/i18n/navigation';
import { loginAction } from '../actions';

export function LoginForm({ passwordWasReset }: { passwordWasReset: boolean }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(loginAction, {});

  return (
    <Card className="flex w-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="font-head text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-fg-muted text-[0.9375rem]">{t('subtitle')}</p>
      </div>
      {passwordWasReset && !state.error && (
        <FormAlert tone="success">{t('passwordResetDone')}</FormAlert>
      )}
      <FormAlert tone="error">{state.error}</FormAlert>
      <form action={action} className="flex flex-col gap-4">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          label={t('phone')}
          placeholder={t('phonePlaceholder')}
          required
          numeric
        />
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          label={t('password')}
          required
        />
        <SubmitButton className="w-full">{t('signIn')}</SubmitButton>
      </form>
      <Link
        href="/forgot-password"
        className="text-primary-soft-fg self-center rounded-lg px-2 py-1 text-sm font-semibold hover:underline"
      >
        {t('forgotPassword')}
      </Link>
    </Card>
  );
}
