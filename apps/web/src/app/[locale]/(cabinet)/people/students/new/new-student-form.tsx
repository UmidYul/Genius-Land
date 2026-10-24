'use client';

import { Card, Select } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { useRouter } from '@/i18n/navigation';
import { createStudentAction } from '../../actions';
import { StudentFields } from '../student-fields';

export function NewStudentForm({ classes }: { classes: { value: string; label: string }[] }) {
  const t = useTranslations('people.students');
  const [state, action, actionPending] = useActionState(createStudentAction, {});
  const router = useRouter();
  const duplicate = state.secret === 'duplicate';

  useEffect(() => {
    if (state.ok && state.id) router.push(`/people/students/${state.id}`);
  }, [state, router]);

  return (
    <Form action={action} pending={actionPending} className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        {duplicate ? (
          <FormAlert tone="error">
            <p>{state.error}</p>
            <p className="mt-1">{t('duplicateConfirm')}</p>
          </FormAlert>
        ) : (
          <FormAlert tone="error">{state.error}</FormAlert>
        )}
        <StudentFields state={state} />
        <Select
          id="classId"
          name="classId"
          label={t('class')}
          hint={t('classHint')}
          defaultValue=""
          placeholder={t('noClass')}
          options={classes}
          error={state.fields?.classId}
        />
        {/* After the duplicate warning, the same submit saves anyway. */}
        <input type="hidden" name="confirmDuplicate" value={duplicate ? '1' : '0'} />
        <SubmitButton className="self-start" variant={duplicate ? 'danger' : 'primary'}>
          {duplicate ? t('saveAnyway') : t('create')}
        </SubmitButton>
      </Card>
    </Form>
  );
}
