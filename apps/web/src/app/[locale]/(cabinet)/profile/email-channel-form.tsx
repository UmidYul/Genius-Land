'use client';

import { Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { confirmEmailAction, startEmailAction } from './actions';

/** Add an e-mail: the address gets a code first; it becomes a channel once the code is entered. */
export function EmailChannelForm() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const [started, start, startPending] = useActionState(startEmailAction, {});
  const [confirmed, confirm, confirmPending] = useActionState(confirmEmailAction, {});
  const challengeId = started.ok && !confirmed.ok ? started.secret : undefined;

  if (confirmed.ok) return <FormAlert tone="success">{confirmed.message}</FormAlert>;

  if (challengeId) {
    return (
      <Form action={confirm} pending={confirmPending} className="flex flex-col gap-3">
        <FormAlert tone="success">{started.message}</FormAlert>
        <FormAlert tone="error">{confirmed.error}</FormAlert>
        <input type="hidden" name="challengeId" value={challengeId} />
        <Input
          id="email-code"
          name="code"
          label={tAuth('code')}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          numeric
        />
        <SubmitButton className="self-start">{tAuth('confirm')}</SubmitButton>
      </Form>
    );
  }

  return (
    <Form
      action={start}
      pending={startPending}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        label={t('addEmail')}
        error={started.fields?.email ?? (started.fields ? undefined : started.error)}
        containerClassName="flex-1"
        required
      />
      <SubmitButton variant="secondary">{tAuth('sendCode')}</SubmitButton>
    </Form>
  );
}
