'use client';

import { Input, Select } from '@gl/ui';
import { useTranslations } from 'next-intl';
import type { FormState } from '@/lib/action-result';

export interface StudentValues {
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
  gradeLevel: number;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/** Personal fields shared by "new student" and "edit". */
export function StudentFields({ values, state }: { values?: StudentValues; state: FormState }) {
  const t = useTranslations('people.students');
  const tAuth = useTranslations('auth');
  const f = state.fields ?? {};
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        id="lastName"
        name="lastName"
        label={t('lastName')}
        defaultValue={values?.lastName}
        error={f.lastName}
        required
      />
      <Input
        id="firstName"
        name="firstName"
        label={t('firstName')}
        defaultValue={values?.firstName}
        error={f.firstName}
        required
      />
      <Input
        id="middleName"
        name="middleName"
        label={t('middleName')}
        hint={t('optional')}
        defaultValue={values?.middleName ?? ''}
      />
      <Input
        id="birthDate"
        name="birthDate"
        type="date"
        label={t('birthDate')}
        defaultValue={values?.birthDate}
        error={f.birthDate}
        required
      />
      <Select
        id="gender"
        name="gender"
        label={t('gender')}
        defaultValue={values?.gender ?? ''}
        placeholder={t('choose')}
        options={[
          { value: 'MALE', label: t('genders.MALE') },
          { value: 'FEMALE', label: t('genders.FEMALE') },
        ]}
        required
      />
      <Select
        id="gradeLevel"
        name="gradeLevel"
        label={t('grade')}
        hint={t('gradeHint')}
        defaultValue={values?.gradeLevel ? String(values.gradeLevel) : ''}
        placeholder={t('choose')}
        options={Array.from({ length: 11 }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
        error={f.gradeLevel}
        required
      />
      <Input
        id="emergencyContactName"
        name="emergencyContactName"
        label={t('emergencyName')}
        hint={t('optional')}
        defaultValue={values?.emergencyContactName ?? ''}
      />
      <Input
        id="emergencyContactPhone"
        name="emergencyContactPhone"
        type="tel"
        inputMode="tel"
        label={t('emergencyPhone')}
        placeholder={tAuth('phonePlaceholder')}
        defaultValue={values?.emergencyContactPhone ?? ''}
        error={f.emergencyContactPhone}
        numeric
      />
    </div>
  );
}
