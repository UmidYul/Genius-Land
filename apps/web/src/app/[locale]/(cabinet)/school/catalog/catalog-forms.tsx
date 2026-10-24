'use client';

import { Input } from '@gl/ui';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogForm, OpenButton } from '@/components/action-form';
import { saveCatalogAction } from '../actions';

export function CatalogDialog({
  kind,
  item,
}: {
  kind: 'subject' | 'direction';
  item?: { id: string; nameUz: string; nameRu: string };
}) {
  const t = useTranslations('school.catalog');
  const tCommon = useTranslations('common');
  return (
    <DialogForm
      title={item ? t(`${kind}.editTitle`) : t(`${kind}.addTitle`)}
      action={saveCatalogAction}
      submitLabel={tCommon('save')}
      trigger={(open) =>
        item ? (
          <OpenButton
            onClick={open}
            variant="ghost"
            icon={<Pencil strokeWidth={1.75} aria-hidden />}
          >
            {tCommon('edit')}
          </OpenButton>
        ) : (
          <OpenButton
            onClick={open}
            variant="secondary"
            icon={<Plus strokeWidth={2} aria-hidden />}
          >
            {t(`${kind}.add`)}
          </OpenButton>
        )
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="kind" value={kind} />
          {item && <input type="hidden" name="id" value={item.id} />}
          <Input
            id={`${kind}-ru`}
            name="nameRu"
            label={t('nameRu')}
            defaultValue={item?.nameRu}
            error={state.fields?.nameRu}
            required
          />
          <Input
            id={`${kind}-uz`}
            name="nameUz"
            label={t('nameUz')}
            defaultValue={item?.nameUz}
            required
          />
        </>
      )}
    </DialogForm>
  );
}
