'use client';

import { Card, Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { Link } from '@/i18n/navigation';
import { forgotPasswordAction } from '../actions';

export function ForgotForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(forgotPasswordAction, {});

  return (
    <Card className="flex w-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="font-head text-2xl font-semibold tracking-tight">{t('forgotTitle')}</h1>
        <p className="text-fg-muted text-[0.9375rem]">{t('forgotText')}</p>
      </div>
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
        <SubmitButton className="w-full">{t('sendCode')}</SubmitButton>
      </form>
      <Link
        href="/login"
        className="text-fg-muted self-center rounded-lg px-2 py-1 text-sm font-medium hover:underline"
      >
        {t('back')}
      </Link>
    </Card>
  );
}
