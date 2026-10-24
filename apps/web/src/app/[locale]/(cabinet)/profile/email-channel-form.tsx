'use client';

import { Input } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { confirmEmailAction, startEmailAction } from './actions';

/** Add an e-mail: the address gets a code first; it becomes a channel once the code is entered. */
export function EmailChannelForm() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const [started, start] = useActionState(startEmailAction, {});
  const [confirmed, confirm] = useActionState(confirmEmailAction, {});
  const challengeId = started.ok && !confirmed.ok ? started.secret : undefined;

  if (confirmed.ok) return <FormAlert tone="success">{confirmed.message}</FormAlert>;

  if (challengeId) {
    return (
      <form action={confirm} className="flex flex-col gap-3">
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
      </form>
    );
  }

  return (
    <form action={start} className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
    </form>
  );
}
