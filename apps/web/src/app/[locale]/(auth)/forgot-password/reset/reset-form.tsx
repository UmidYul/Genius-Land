'use client';

import { Button, Card, Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { Link } from '@/i18n/navigation';
import type { FormState } from '@/lib/action-result';
import { resendCodeAction, resetPasswordAction } from '../../actions';

export function ResetForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(resetPasswordAction, {});
  const [resendState, setResendState] = useState<FormState>({});
  const [resending, startResend] = useTransition();
  const shown = resendState.error || resendState.message ? resendState : state;

  return (
    <Card className="flex w-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="font-head text-2xl font-semibold tracking-tight">{t('resetTitle')}</h1>
        <p className="text-fg-muted text-[0.9375rem]">{t('resetText')}</p>
      </div>
      <FormAlert tone="error">{shown.error}</FormAlert>
      <FormAlert tone="success">{shown.message}</FormAlert>
      <form
        action={(form) => {
          setResendState({});
          action(form);
        }}
        className="flex flex-col gap-4"
      >
        <Input
          id="code"
          name="code"
          label={t('code')}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          numeric
          className="text-center text-lg tracking-[0.4em]"
        />
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          label={t('newPassword')}
          hint={t('passwordRules')}
          error={state.fields?.password}
          required
        />
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          label={t('confirmPassword')}
          error={state.fields?.confirm}
          required
        />
        <SubmitButton className="w-full">{t('savePassword')}</SubmitButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/login"
          className="text-fg-muted rounded-lg px-2 py-1 text-sm font-medium hover:underline"
        >
          {t('back')}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          loading={resending}
          onClick={() => startResend(async () => setResendState(await resendCodeAction('reset')))}
        >
          {t('resend')}
        </Button>
      </div>
    </Card>
  );
}
