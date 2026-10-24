'use client';

import { Input, Select } from '@gl/ui';
import { CalendarPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogForm, OpenButton } from '@/components/action-form';
import { addCalendarDayAction } from '../actions';

export function AddCalendarDayDialog({
  branches,
  allowBoth,
}: {
  branches: { id: string; name: string }[];
  allowBoth: boolean;
}) {
  const t = useTranslations('school.calendar');
  return (
    <DialogForm
      title={t('addTitle')}
      description={t('addText')}
      action={addCalendarDayAction}
      submitLabel={t('add')}
      trigger={(open) => (
        <OpenButton onClick={open} icon={<CalendarPlus strokeWidth={2} aria-hidden />}>
          {t('add')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <Input
            id="cal-date"
            name="date"
            type="date"
            label={t('date')}
            error={state.fields?.date}
            required
          />
          <Select
            id="cal-kind"
            name="kind"
            label={t('kind')}
            defaultValue="HOLIDAY"
            options={[
              { value: 'HOLIDAY', label: t('kinds.HOLIDAY') },
              { value: 'WORKDAY', label: t('kinds.WORKDAY') },
            ]}
          />
          <Select
            id="cal-type"
            name="classType"
            label={t('appliesTo')}
            defaultValue=""
            options={[
              { value: '', label: t('allClasses') },
              { value: 'REGULAR', label: t('classTypes.REGULAR') },
              { value: 'DIRECTION_GROUP', label: t('classTypes.DIRECTION_GROUP') },
            ]}
          />
          <Select
            id="cal-scope"
            name="scope"
            label={t('branch')}
            defaultValue={branches[0]?.id}
            options={[
              ...branches.map((b) => ({ value: b.id, label: b.name })),
              ...(allowBoth ? [{ value: 'all', label: t('bothBranches') }] : []),
            ]}
          />
          <Input id="cal-note" name="note" label={t('note')} placeholder={t('notePlaceholder')} />
        </>
      )}
    </DialogForm>
  );
}
