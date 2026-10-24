'use client';

import { Button, Input, Select } from '@gl/ui';
import { ArrowRightLeft, Pencil, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogForm, OpenButton } from '@/components/action-form';
import {
  addGuardianAction,
  guardianLinkAction,
  statusStudentAction,
  transferStudentAction,
  updateStudentAction,
} from '../../actions';
import { StudentFields, type StudentValues } from '../student-fields';

export function EditStudentDialog({ id, values }: { id: string; values: StudentValues }) {
  const t = useTranslations('people.students');
  const tCommon = useTranslations('common');
  return (
    <DialogForm
      title={t('editTitle')}
      action={updateStudentAction}
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
          <input type="hidden" name="id" value={id} />
          <StudentFields values={values} state={state} />
        </>
      )}
    </DialogForm>
  );
}

export function TransferDialog({
  studentId,
  gradeLevel,
  classes,
}: {
  studentId: string;
  gradeLevel: number;
  classes: { value: string; label: string }[];
}) {
  const t = useTranslations('people.students');
  return (
    <DialogForm
      title={t('transferTitle')}
      description={t('transferText')}
      action={transferStudentAction}
      submitLabel={t('transfer')}
      trigger={(open) => (
        <OpenButton
          onClick={open}
          variant="secondary"
          icon={<ArrowRightLeft strokeWidth={1.75} aria-hidden />}
        >
          {t('transfer')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="studentId" value={studentId} />
          <Select
            id="toClassId"
            name="toClassId"
            label={t('toClass')}
            placeholder={t('choose')}
            defaultValue=""
            options={classes}
            error={state.fields?.toClassId ?? state.fields?.classId}
            required
          />
          <Select
            id="tr-grade"
            name="gradeLevel"
            label={t('grade')}
            hint={t('transferGradeHint')}
            defaultValue={String(gradeLevel)}
            options={Array.from({ length: 11 }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
            error={state.fields?.gradeLevel}
          />
          <Input id="tr-reason" name="reason" label={t('reason')} hint={t('optional')} />
        </>
      )}
    </DialogForm>
  );
}

const STATUSES = ['ACTIVE', 'LEFT', 'GRADUATED', 'TRANSFERRED'] as const;

export function StatusDialog({ studentId, status }: { studentId: string; status: string }) {
  const t = useTranslations('people.students');
  return (
    <DialogForm
      title={t('statusTitle')}
      action={statusStudentAction}
      submitLabel={t('changeStatus')}
      trigger={(open) => (
        <OpenButton onClick={open} variant="ghost">
          {t('changeStatus')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="studentId" value={studentId} />
          <Select
            id="st-status"
            name="status"
            label={t('statusLabel')}
            defaultValue={STATUSES.find((s) => s !== status)}
            options={STATUSES.filter((s) => s !== status).map((s) => ({
              value: s,
              label: t(`status.${s}`),
            }))}
            error={state.fields?.status}
          />
          <Input
            id="st-date"
            name="date"
            type="date"
            label={t('statusDate')}
            hint={t('statusDateHint')}
          />
          <Input
            id="st-reason"
            name="reason"
            label={t('reason')}
            error={state.fields?.reason}
            required
          />
        </>
      )}
    </DialogForm>
  );
}

export function AddGuardianDialog({ studentId }: { studentId: string }) {
  const t = useTranslations('people.guardians');
  const tAuth = useTranslations('auth');
  return (
    <DialogForm
      title={t('addTitle')}
      description={t('addText')}
      action={addGuardianAction}
      submitLabel={t('add')}
      trigger={(open) => (
        <OpenButton
          onClick={open}
          variant="secondary"
          icon={<UserPlus strokeWidth={1.75} aria-hidden />}
        >
          {t('add')}
        </OpenButton>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="studentId" value={studentId} />
          <Input
            id="g-name"
            name="fullName"
            label={t('fullName')}
            error={state.fields?.fullName}
            required
          />
          <Input
            id="g-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            label={t('phone')}
            placeholder={tAuth('phonePlaceholder')}
            error={state.fields?.phone}
            numeric
            required
          />
          <Select
            id="g-relation"
            name="relation"
            label={t('relation')}
            defaultValue="MOTHER"
            options={(['MOTHER', 'FATHER', 'GUARDIAN', 'OTHER'] as const).map((r) => ({
              value: r,
              label: t(`relations.${r}`),
            }))}
          />
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="isPrimary" className="accent-primary-solid size-5" />
            {t('makePrimary')}
          </label>
        </>
      )}
    </DialogForm>
  );
}

export function GuardianActions({
  studentId,
  guardianId,
  isPrimary,
}: {
  studentId: string;
  guardianId: string;
  isPrimary: boolean;
}) {
  const t = useTranslations('people.guardians');
  const renderCommand = (command: 'primary' | 'unlink', label: string) => (
    <form action={guardianLinkAction}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="guardianId" value={guardianId} />
      <input type="hidden" name="command" value={command} />
      <Button type="submit" size="sm" variant="ghost">
        {label}
      </Button>
    </form>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {!isPrimary && renderCommand('primary', t('setPrimary'))}
      {renderCommand('unlink', t('unlink'))}
    </div>
  );
}
