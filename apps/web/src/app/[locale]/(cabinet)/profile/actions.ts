'use server';

import {
  changePassword,
  confirmEmailChannel,
  removeChannel,
  setLocale,
  signOutOtherSessions,
  signOutSession,
  startEmailChannel,
} from '@gl/core';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { errorState, formString, type FormState } from '@/lib/action-result';
import { requireAuth } from '@/lib/auth';
import { dispatcher } from '@/lib/notify';
import { getSettings } from '@/lib/settings';

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx, session } = await requireAuth();
  const result = await changePassword(ctx, {
    current: formString(form, 'current'),
    password: formString(form, 'password'),
    confirm: formString(form, 'confirm'),
    sessionId: session.id,
  });
  if (!result.ok) return errorState(result.error);
  revalidatePath('/', 'layout');
  const t = await getTranslations('profile');
  return { ok: true, message: t('passwordChanged') };
}

export async function setLocaleAction(form: FormData) {
  const { ctx } = await requireAuth();
  const locale = formString(form, 'locale') === 'ru' ? 'ru' : 'uz';
  await setLocale(ctx, locale);
  redirect({ href: '/profile', locale });
}

export async function startEmailAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await startEmailChannel(
    ctx,
    { settings: getSettings(), dispatcher },
    formString(form, 'email'),
  );
  if (!result.ok) return errorState(result.error);
  const t = await getTranslations('profile');
  return { ok: true, message: t('emailCodeSent'), secret: result.value.challengeId };
}

export async function confirmEmailAction(_: FormState, form: FormData): Promise<FormState> {
  const { ctx } = await requireAuth();
  const result = await confirmEmailChannel(
    ctx,
    { settings: getSettings() },
    {
      challengeId: formString(form, 'challengeId'),
      code: formString(form, 'code'),
    },
  );
  if (!result.ok) return errorState(result.error);
  revalidatePath('/profile');
  const t = await getTranslations('profile');
  return { ok: true, message: t('emailAdded') };
}

export async function removeChannelAction(form: FormData) {
  const { ctx } = await requireAuth();
  await removeChannel(ctx, formString(form, 'channelId'));
  revalidatePath('/profile');
}

export async function signOutSessionAction(form: FormData) {
  const { ctx } = await requireAuth();
  await signOutSession(ctx, formString(form, 'sessionId'));
  revalidatePath('/profile');
}

export async function signOutOthersAction() {
  const { ctx, session } = await requireAuth();
  await signOutOtherSessions(ctx, session.id);
  revalidatePath('/profile');
}
