'use client';

import { Button, Card, CardHeader, CardTitle, Input, Select } from '@gl/ui';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { FormAlert, SubmitButton, Form } from '@/components/form';
import { Link } from '@/i18n/navigation';
import type { FormState } from '@/lib/action-result';
import {
  createUserAction,
  setAssignmentsAction,
  updateUserAction,
  userCommandAction,
} from './actions';
import { AssignmentsEditor, type Assignment, type RoleOption } from './assignments-editor';

interface ProfileValues {
  fullName: string;
  phone: string;
  email: string | null;
  locale: 'uz' | 'ru';
}

/** One-time temporary password: shown once, to hand over in person. */
function TemporaryPassword({ state }: { state: FormState }) {
  const t = useTranslations('admin.users');
  const [copied, setCopied] = useState(false);
  if (!state.ok || !state.secret) return null;
  return (
    <FormAlert tone="success">
      <p>{state.message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="bg-surface text-fg rounded-lg px-3 py-1.5 font-mono text-base font-semibold tracking-wider">
          {state.secret}
        </code>
        <Button
          size="sm"
          variant="secondary"
          icon={<Copy strokeWidth={1.75} aria-hidden />}
          onClick={async () => {
            await navigator.clipboard.writeText(state.secret ?? '');
            setCopied(true);
          }}
        >
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
      <p className="mt-2 text-xs">{t('passwordShownOnce')}</p>
    </FormAlert>
  );
}

function ProfileFields({ values, state }: { values?: ProfileValues; state: FormState }) {
  const t = useTranslations('admin.users');
  const tLocale = useTranslations('locale');
  const tAuth = useTranslations('auth');
  return (
    <>
      <Input
        id="fullName"
        name="fullName"
        label={t('fullName')}
        defaultValue={values?.fullName}
        error={state.fields?.fullName}
        required
      />
      <Input
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        label={t('phone')}
        placeholder={tAuth('phonePlaceholder')}
        defaultValue={values?.phone}
        error={state.fields?.phone}
        numeric
        required
      />
      <Input
        id="email"
        name="email"
        type="email"
        label={t('email')}
        hint={t('optional')}
        defaultValue={values?.email ?? ''}
        error={state.fields?.email}
      />
      <Select
        id="locale"
        name="locale"
        label={t('language')}
        defaultValue={values?.locale ?? 'uz'}
        options={[
          { value: 'uz', label: tLocale('uz') },
          { value: 'ru', label: tLocale('ru') },
        ]}
      />
    </>
  );
}

export function CreateUserForm({
  roles,
  branches,
}: {
  roles: RoleOption[];
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations('admin.users');
  const [state, action, actionPending] = useActionState(createUserAction, {});

  if (state.ok && state.id) {
    return (
      <Card className="flex flex-col gap-4">
        <TemporaryPassword state={state} />
        <Link
          href={`/admin/users/${state.id}`}
          className="text-primary-soft-fg text-sm font-semibold hover:underline"
        >
          {t('openUser')}
        </Link>
      </Card>
    );
  }

  return (
    <Form
      action={action}
      pending={actionPending}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0"
    >
      <Card className="flex flex-col gap-4">
        <FormAlert tone="error">{state.fields ? null : state.error}</FormAlert>
        <ProfileFields state={state} />
      </Card>
      <Card className="flex flex-col gap-4">
        <AssignmentsEditor roles={roles} branches={branches} initial={[]} />
        <SubmitButton className="self-start">{t('create')}</SubmitButton>
      </Card>
    </Form>
  );
}

export function EditProfileForm({ id, values }: { id: string; values: ProfileValues }) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const [state, action, actionPending] = useActionState(updateUserAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile')}</CardTitle>
      </CardHeader>
      <Form action={action} pending={actionPending} className="flex flex-col gap-4">
        <FormAlert tone="error">{state.fields ? null : state.error}</FormAlert>
        <FormAlert tone="success">{state.ok ? state.message : null}</FormAlert>
        <input type="hidden" name="id" value={id} />
        <ProfileFields values={values} state={state} />
        <SubmitButton className="self-start">{tCommon('save')}</SubmitButton>
      </Form>
    </Card>
  );
}

export function EditAssignmentsForm({
  id,
  roles,
  branches,
  initial,
}: {
  id: string;
  roles: RoleOption[];
  branches: { id: string; name: string }[];
  initial: Assignment[];
}) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const [state, action, actionPending] = useActionState(setAssignmentsAction, {});
  return (
    <Card>
      <Form action={action} pending={actionPending} className="flex flex-col gap-4">
        <FormAlert tone="error">{state.error}</FormAlert>
        <FormAlert tone="success">{state.ok ? state.message : null}</FormAlert>
        <input type="hidden" name="id" value={id} />
        <AssignmentsEditor roles={roles} branches={branches} initial={initial} />
        <Input id="assign-reason" name="reason" label={t('reason')} hint={t('optional')} />
        <SubmitButton className="self-start">{tCommon('save')}</SubmitButton>
      </Form>
    </Card>
  );
}

export function UserCommands({
  id,
  blocked,
  locked,
  isSelf,
}: {
  id: string;
  blocked: boolean;
  locked: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations('admin.users');
  const [state, action, actionPending] = useActionState(userCommandAction, {});
  const command = (name: string, label: string, variant: 'secondary' | 'danger' = 'secondary') => (
    <Form action={action} pending={actionPending}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="command" value={name} />
      <SubmitButton variant={variant} size="sm" className="w-full sm:w-auto">
        {label}
      </SubmitButton>
    </Form>
  );
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0">
        <CardTitle>{t('actions')}</CardTitle>
      </CardHeader>
      <FormAlert tone="error">{state.error}</FormAlert>
      {state.ok && !state.secret && <FormAlert tone="success">{state.message}</FormAlert>}
      <TemporaryPassword state={state} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {command('resetPassword', t('resetPassword'))}
        {locked && command('unlock', t('unlock'))}
        {!isSelf &&
          (blocked ? command('unblock', t('unblock')) : command('block', t('block'), 'danger'))}
      </div>
    </Card>
  );
}
