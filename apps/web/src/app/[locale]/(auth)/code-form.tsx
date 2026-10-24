'use client';

import { Button, Card, Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { Link } from '@/i18n/navigation';
import type { FormState } from '@/lib/action-result';
import type { Challenge } from '@/lib/challenge';
import { resendCodeAction, verifyLoginAction } from './actions';

/** Step 2 of signing in on a new device: the 6-digit code sent to every connected channel. */
export function CodeForm({ sentTo }: { sentTo: Challenge['sentTo'] }) {
  const t = useTranslations('auth');
  const tChannel = useTranslations('channels');
  const [state, action, actionPending] = useActionState(verifyLoginAction, {});
  const [resendState, setResendState] = useState<FormState>({});
  const [resending, startResend] = useTransition();

  const shownState = resendState.error || resendState.message ? resendState : state;

  return (
    <Card className="flex w-full flex-col gap-5 p-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="font-head text-2xl font-semibold tracking-tight">{t('codeTitle')}</h1>
        <p className="text-fg-muted text-[0.9375rem]">{t('codeSentTo')}</p>
        <ul className="text-fg flex flex-col gap-0.5 text-sm font-semibold tabular-nums">
          {sentTo.map((target) => (
            <li key={`${target.channel}:${target.address}`}>
              {tChannel(target.channel)}: {target.address}
            </li>
          ))}
        </ul>
      </div>
      <FormAlert tone="error">{shownState.error}</FormAlert>
      <FormAlert tone="success">{shownState.message}</FormAlert>
      <Form
        pending={actionPending}
        action={(data) => {
          setResendState({});
          action(data);
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
          autoFocus
        />
        <SubmitButton className="w-full">{t('confirm')}</SubmitButton>
      </Form>
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
          onClick={() => startResend(async () => setResendState(await resendCodeAction('login')))}
        >
          {t('resend')}
        </Button>
      </div>
    </Card>
  );
}
