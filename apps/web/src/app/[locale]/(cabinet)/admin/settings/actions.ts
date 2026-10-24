'use server';

import { changeSetting, findSettingDefinition } from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';

export async function changeSettingAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const key = formString(form, 'key');
  const definition = findSettingDefinition(key);
  const raw = formString(form, 'value');
  // Values arrive as text; numbers are converted so the setting's schema can validate them.
  const value = typeof definition?.defaultValue === 'number' ? Number(raw) : raw;
  const result = await changeSetting(ctx, {
    key,
    value,
    reason: formString(form, 'reason') || null,
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/admin/settings');
  return { ok: true, message: (await getTranslations('common'))('saved') };
}
