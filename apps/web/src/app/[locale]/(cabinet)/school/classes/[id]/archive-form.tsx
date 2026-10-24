'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { archiveClassAction } from '../../actions';

export function ArchiveClassForm({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations('school.classes');
  const [state, action, actionPending] = useActionState(archiveClassAction, {});
  return (
    <Form action={action} pending={actionPending} className="flex flex-col gap-2">
      <FormAlert tone="error">{state.error}</FormAlert>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={archived ? '0' : '1'} />
      <SubmitButton variant={archived ? 'secondary' : 'ghost'} className="self-start">
        {archived ? t('restore') : t('archive')}
      </SubmitButton>
    </Form>
  );
}
