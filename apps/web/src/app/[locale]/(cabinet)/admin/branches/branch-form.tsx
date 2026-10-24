'use client';

import { Button, Dialog, Input } from '@gl/ui';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { FormAlert, SubmitButton } from '@/components/form';
import { createBranchAction, updateBranchAction } from './actions';

interface BranchValues {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  address: string | null;
}

/** Create (no `branch`) or rename / change the address of a branch, in a dialog. */
export function BranchFormDialog({ branch }: { branch?: BranchValues }) {
  const t = useTranslations('admin.branches');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(branch ? updateBranchAction : createBranchAction, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      {branch ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil strokeWidth={1.75} aria-hidden />}
          onClick={() => setOpen(true)}
        >
          {tCommon('edit')}
        </Button>
      ) : (
        <Button icon={<Plus strokeWidth={2} aria-hidden />} onClick={() => setOpen(true)}>
          {t('create')}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={branch ? t('editTitle') : t('createTitle')}
        closeLabel={tCommon('close')}
      >
        <form action={action} className="flex flex-col gap-4">
          <FormAlert tone="error">{state.fields ? null : state.error}</FormAlert>
          {branch ? (
            <input type="hidden" name="id" value={branch.id} />
          ) : (
            <Input
              id="branch-code"
              name="code"
              label={t('code')}
              hint={t('codeHint')}
              error={state.fields?.code}
              pattern="[a-z][a-z0-9\-]{1,39}"
              required
            />
          )}
          <Input
            id="branch-name-uz"
            name="nameUz"
            label={t('nameUz')}
            defaultValue={branch?.nameUz}
            error={state.fields?.nameUz}
            required
          />
          <Input
            id="branch-name-ru"
            name="nameRu"
            label={t('nameRu')}
            defaultValue={branch?.nameRu}
            error={state.fields?.nameRu}
            required
          />
          <Input
            id="branch-address"
            name="address"
            label={t('address')}
            defaultValue={branch?.address ?? ''}
            error={state.fields?.address}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <SubmitButton>{tCommon('save')}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
