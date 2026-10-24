'use server';

import {
  createUser,
  isRoleCode,
  resetUserPassword,
  setUserAssignments,
  setUserBlocked,
  unlockUser,
  updateUserProfile,
  type AssignmentInput,
} from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

function readAssignments(form: FormData): AssignmentInput[] {
  try {
    const raw = JSON.parse(formString(form, 'assignments') || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((a): a is { roleCode: string; branchIds: unknown } => !!a && typeof a === 'object')
      .filter((a) => isRoleCode(a.roleCode))
      .map((a) => ({
        roleCode: a.roleCode as AssignmentInput['roleCode'],
        branchIds: Array.isArray(a.branchIds)
          ? a.branchIds.filter((id): id is string => typeof id === 'string')
          : [],
      }));
  } catch {
    return [];
  }
}

const profileFields = (form: FormData) => ({
  fullName: formString(form, 'fullName'),
  phone: formString(form, 'phone'),
  email: formString(form, 'email'),
  locale: formString(form, 'locale') === 'ru' ? ('ru' as const) : ('uz' as const),
});

export async function createUserAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await createUser(ctx, {
    ...profileFields(form),
    assignments: readAssignments(form),
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/admin/users');
  const t = await getTranslations('admin.users');
  return {
    ok: true,
    message: t('createdWithPassword'),
    secret: result.value.temporaryPassword,
    id: result.value.id,
  };
}

export async function updateUserAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await updateUserProfile(ctx, formString(form, 'id'), profileFields(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath('/admin/users');
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

export async function setAssignmentsAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await setUserAssignments(
    ctx,
    formString(form, 'id'),
    readAssignments(form),
    formString(form, 'reason') || null,
  );
  if (!result.ok) return errorState(result.error);
  revalidatePath('/admin/users');
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

export async function userCommandAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const id = formString(form, 'id');
  const command = formString(form, 'command');
  const t = await getTranslations('admin.users');
  if (command === 'resetPassword') {
    const result = await resetUserPassword(ctx, id);
    if (!result.ok) return errorState(result.error);
    revalidatePath(`/admin/users/${id}`);
    return {
      ok: true,
      message: t('passwordResetWithPassword'),
      secret: result.value.temporaryPassword,
    };
  }
  const result =
    command === 'unlock'
      ? await unlockUser(ctx, id)
      : await setUserBlocked(ctx, id, command === 'block', formString(form, 'reason') || null);
  if (!result.ok) return errorState(result.error);
  revalidatePath(`/admin/users/${id}`);
  return {
    ok: true,
    message: t(
      `done.${command === 'unlock' ? 'unlock' : command === 'block' ? 'block' : 'unblock'}`,
    ),
  };
}
