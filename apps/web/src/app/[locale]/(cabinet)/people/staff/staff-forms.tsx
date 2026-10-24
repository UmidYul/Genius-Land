'use client';

import { Input } from '@gl/ui';
import { Pencil, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { DialogForm, OpenButton } from '@/components/action-form';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { archiveStaffAction, saveStaffAction } from '../actions';

interface StaffValues {
  id: string;
  fullName: string;
  phone: string;
  position: string;
}

export function StaffDialog({ staff }: { staff?: StaffValues }) {
  const t = useTranslations('people.staff');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  return (
    <DialogForm
      title={staff ? t('editTitle') : t('createTitle')}
      description={staff ? undefined : t('createText')}
      action={saveStaffAction}
      submitLabel={tCommon('save')}
      trigger={(open) =>
        staff ? (
          <OpenButton
            onClick={open}
            variant="ghost"
            icon={<Pencil strokeWidth={1.75} aria-hidden />}
          >
            {tCommon('edit')}
          </OpenButton>
        ) : (
          <OpenButton onClick={open} icon={<UserPlus strokeWidth={2} aria-hidden />}>
            {t('create')}
          </OpenButton>
        )
      }
    >
      {(state) => (
        <>
          {staff && <input type="hidden" name="id" value={staff.id} />}
          <Input
            id="st-name"
            name="fullName"
            label={t('fullName')}
            defaultValue={staff?.fullName}
            error={state.fields?.fullName}
            required
          />
          <Input
            id="st-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            label={t('phone')}
            placeholder={tAuth('phonePlaceholder')}
            defaultValue={staff?.phone}
            error={state.fields?.phone}
            numeric
            required
          />
          <Input
            id="st-position"
            name="position"
            label={t('position')}
            placeholder={t('positionPlaceholder')}
            defaultValue={staff?.position}
            required
          />
        </>
      )}
    </DialogForm>
  );
}

export function ArchiveStaffButton({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations('people.staff');
  const [state, action, actionPending] = useActionState(archiveStaffAction, {});
  return (
    <Form action={action} pending={actionPending} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={archived ? '0' : '1'} />
      <SubmitButton variant="ghost" size="sm">
        {archived ? t('restore') : t('archive')}
      </SubmitButton>
      <FormAlert tone="error" className="max-w-64">
        {state.error}
      </FormAlert>
    </Form>
  );
}
