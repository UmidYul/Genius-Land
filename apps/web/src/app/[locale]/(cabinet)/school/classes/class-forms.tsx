'use client';

import { Input, Select } from '@gl/ui';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DialogForm, OpenButton } from '@/components/action-form';
import type { FormState } from '@/lib/action-result';
import { useRouter } from '@/i18n/navigation';
import { addAssignmentAction, createClassAction, updateClassAction } from '../actions';

export interface Option {
  value: string;
  label: string;
}

interface ClassValues {
  id: string;
  type: 'REGULAR' | 'DIRECTION_GROUP';
  name: string;
  gradeLevel: number | null;
  directionId: string | null;
  capacity: number;
  homeroomTeacherId: string;
}

function ClassFields({
  type,
  values,
  state,
  directions,
  teachers,
}: {
  type: 'REGULAR' | 'DIRECTION_GROUP';
  values?: ClassValues;
  state: FormState;
  directions: Option[];
  teachers: Option[];
}) {
  const t = useTranslations('school.classes');
  return (
    <>
      <Input
        id="class-name"
        name="name"
        label={t('name')}
        placeholder={type === 'REGULAR' ? t('namePlaceholderRegular') : t('namePlaceholderGroup')}
        defaultValue={values?.name}
        error={state.fields?.name}
        required
      />
      {type === 'REGULAR' ? (
        <Select
          id="class-grade"
          name="gradeLevel"
          label={t('grade')}
          defaultValue={values?.gradeLevel ? String(values.gradeLevel) : ''}
          placeholder={t('choose')}
          options={[1, 2, 3, 4, 5, 6, 7].map((g) => ({ value: String(g), label: String(g) }))}
          error={state.fields?.gradeLevel}
          required
        />
      ) : (
        <Select
          id="class-direction"
          name="directionId"
          label={t('direction')}
          defaultValue={values?.directionId ?? ''}
          placeholder={t('choose')}
          options={directions}
          error={state.fields?.directionId}
          hint={directions.length === 0 ? t('noDirections') : undefined}
          required
        />
      )}
      <Input
        id="class-capacity"
        name="capacity"
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        label={t('capacity')}
        hint={t('capacityHint')}
        defaultValue={values?.capacity}
        error={state.fields?.capacity}
        numeric
        required
      />
      <Select
        id="class-homeroom"
        name="homeroomTeacherId"
        label={t('homeroom')}
        defaultValue={values?.homeroomTeacherId ?? ''}
        placeholder={t('choose')}
        options={teachers}
        error={state.fields?.homeroomTeacherId}
        hint={teachers.length === 0 ? t('noStaff') : undefined}
        required
      />
    </>
  );
}

export function CreateClassDialog({
  directions,
  teachers,
}: {
  directions: Option[];
  teachers: Option[];
}) {
  const t = useTranslations('school.classes');
  const [type, setType] = useState<'REGULAR' | 'DIRECTION_GROUP'>('REGULAR');
  const router = useRouter();
  return (
    <DialogForm
      title={t('createTitle')}
      action={async (state, form) => {
        const result = await createClassAction(state, form);
        if (result.ok && result.id) router.push(`/school/classes/${result.id}`);
        return result;
      }}
      submitLabel={t('create')}
      trigger={(open) => (
        <OpenButton onClick={open} icon={<Plus strokeWidth={2} aria-hidden />}>
          {t('create')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <Select
            id="class-type"
            name="type"
            label={t('type')}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            options={[
              { value: 'REGULAR', label: t('types.REGULAR') },
              { value: 'DIRECTION_GROUP', label: t('types.DIRECTION_GROUP') },
            ]}
          />
          <ClassFields type={type} state={state} directions={directions} teachers={teachers} />
        </>
      )}
    </DialogForm>
  );
}

export function EditClassDialog({
  values,
  directions,
  teachers,
}: {
  values: ClassValues;
  directions: Option[];
  teachers: Option[];
}) {
  const t = useTranslations('school.classes');
  const tCommon = useTranslations('common');
  return (
    <DialogForm
      title={t('editTitle')}
      action={updateClassAction}
      submitLabel={tCommon('save')}
      trigger={(open) => (
        <OpenButton
          onClick={open}
          variant="secondary"
          icon={<Pencil strokeWidth={1.75} aria-hidden />}
        >
          {tCommon('edit')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={values.id} />
          <ClassFields
            type={values.type}
            values={values}
            state={state}
            directions={directions}
            teachers={teachers}
          />
        </>
      )}
    </DialogForm>
  );
}

export function AddAssignmentDialog({
  classId,
  subjects,
  teachers,
}: {
  classId: string;
  subjects: Option[];
  teachers: Option[];
}) {
  const t = useTranslations('school.classes');
  return (
    <DialogForm
      title={t('addAssignment')}
      action={addAssignmentAction}
      submitLabel={t('assign')}
      trigger={(open) => (
        <OpenButton onClick={open} variant="secondary" icon={<Plus strokeWidth={2} aria-hidden />}>
          {t('addAssignment')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="classId" value={classId} />
          <Select
            id="as-subject"
            name="subjectId"
            label={t('subject')}
            placeholder={t('choose')}
            defaultValue=""
            options={subjects}
            error={state.fields?.subjectId}
            required
          />
          <Select
            id="as-teacher"
            name="staffId"
            label={t('teacher')}
            placeholder={t('choose')}
            defaultValue=""
            options={teachers}
            error={state.fields?.staffId}
            required
          />
        </>
      )}
    </DialogForm>
  );
}
