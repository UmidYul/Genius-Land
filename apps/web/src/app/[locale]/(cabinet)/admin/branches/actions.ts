'use server';

import { createBranch, updateBranch } from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

const branchFields = (form: FormData) => ({
  nameUz: formString(form, 'nameUz'),
  nameRu: formString(form, 'nameRu'),
  address: formString(form, 'address'),
});

export async function createBranchAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await createBranch(ctx, { code: formString(form, 'code'), ...branchFields(form) });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/', 'layout');
  return { ok: true, message: (await getTranslations('admin.branches'))('created') };
}

export async function updateBranchAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await updateBranch(ctx, formString(form, 'id'), branchFields(form));
  if (!result.ok) return errorState(result.error);
  revalidatePath('/', 'layout');
  return { ok: true, message: (await getTranslations('admin.branches'))('saved') };
}
