'use client';

import { Input } from '@gl/ui';
import { CalendarPlus, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogForm, OpenButton } from '@/components/action-form';
import type { FormState } from '@/lib/action-result';
import { createYearAction, updateTermsAction } from '../actions';

export interface TermValues {
  startDate: string;
  endDate: string;
}

function TermFields({ values, state }: { values?: TermValues[]; state: FormState }) {
  const t = useTranslations('school.years');
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3, 4].map((n) => (
        <fieldset key={n} className="grid grid-cols-2 gap-3">
          <legend className="mb-1 text-sm font-semibold">{t('term', { n })}</legend>
          <Input
            id={`term${n}Start`}
            name={`term${n}Start`}
            type="date"
            label={t('from')}
            defaultValue={values?.[n - 1]?.startDate}
            error={state.fields?.[`terms.${n - 1}`]}
            required
          />
          <Input
            id={`term${n}End`}
            name={`term${n}End`}
            type="date"
            label={t('to')}
            defaultValue={values?.[n - 1]?.endDate}
            required
          />
        </fieldset>
      ))}
    </div>
  );
}

export function CreateYearDialog() {
  const t = useTranslations('school.years');
  return (
    <DialogForm
      title={t('createTitle')}
      description={t('createText')}
      action={createYearAction}
      submitLabel={t('create')}
      trigger={(open) => (
        <OpenButton onClick={open} icon={<CalendarPlus strokeWidth={2} aria-hidden />}>
          {t('create')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <Input
            id="year-name"
            name="name"
            label={t('name')}
            placeholder={t('namePlaceholder')}
            error={state.fields?.name}
            required
          />
          <TermFields state={state} />
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              name="makeCurrent"
              className="accent-primary-solid size-5"
              defaultChecked
            />
            {t('makeCurrent')}
          </label>
        </>
      )}
    </DialogForm>
  );
}

export function EditTermsDialog({ yearId, terms }: { yearId: string; terms: TermValues[] }) {
  const t = useTranslations('school.years');
  const tCommon = useTranslations('common');
  return (
    <DialogForm
      title={t('editTerms')}
      action={updateTermsAction}
      submitLabel={tCommon('save')}
      trigger={(open) => (
        <OpenButton onClick={open} variant="ghost" icon={<Pencil strokeWidth={1.75} aria-hidden />}>
          {t('editTerms')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="yearId" value={yearId} />
          <TermFields values={terms} state={state} />
        </>
      )}
    </DialogForm>
  );
}
