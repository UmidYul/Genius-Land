'use server';

import {
  login,
  requestPasswordReset,
  resendCode,
  resetPassword,
  verifyLoginCode,
  type AuthEnv,
} from '@gl/core';
import { prisma } from '@gl/db';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { errorState, formString, type FormState } from '@/lib/action-result';
import {
  CHALLENGE_COOKIE,
  cookieOptions,
  DEVICE_COOKIE,
  getClientInfo,
  SESSION_COOKIE,
} from '@/lib/auth';
import { readChallenge, saveChallenge, type Challenge } from '@/lib/challenge';
import { dispatcher } from '@/lib/notify';
import { getSettings } from '@/lib/settings';

const DEVICE_MAX_AGE = 365 * 24 * 3600;

async function authEnv(): Promise<AuthEnv> {
  return { db: prisma, settings: getSettings(), dispatcher, ...(await getClientInfo()) };
}

async function startWebSession(token: string, expiresAt: Date, userLocale: string) {
  const jar = await cookies();
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  jar.set(SESSION_COOKIE, token, cookieOptions(maxAge));
  jar.delete(CHALLENGE_COOKIE);
  const locale = userLocale === 'ru' ? 'ru' : 'uz';
  return redirect({ href: '/', locale });
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const result = await login(await authEnv(), {
    phone: formString(form, 'phone'),
    password: formString(form, 'password'),
    deviceToken: jar.get(DEVICE_COOKIE)?.value ?? null,
  });
  if (!result.ok) return errorState(result.error);

  const outcome = result.value;
  if (outcome.kind === 'session') {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: outcome.userId } });
    return startWebSession(outcome.session.token, outcome.session.session.expiresAt, user.locale);
  }
  await saveChallenge({ id: outcome.challengeId, purpose: 'login', sentTo: outcome.sentTo });
  return redirect({ href: '/login/verify', locale: await getLocale() });
}

export async function verifyLoginAction(_: FormState, form: FormData): Promise<FormState> {
  const challenge = await readChallenge('login');
  if (!challenge) return redirect({ href: '/login', locale: await getLocale() });
  const result = await verifyLoginCode(await authEnv(), {
    challengeId: challenge.id,
    code: formString(form, 'code'),
  });
  if (!result.ok) return errorState(result.error);

  (await cookies()).set(DEVICE_COOKIE, result.value.deviceToken, cookieOptions(DEVICE_MAX_AGE));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: result.value.userId } });
  return startWebSession(
    result.value.session.token,
    result.value.session.session.expiresAt,
    user.locale,
  );
}

export async function resendCodeAction(purpose: Challenge['purpose']): Promise<FormState> {
  const challenge = await readChallenge(purpose);
  if (!challenge)
    return redirect({
      href: purpose === 'login' ? '/login' : '/forgot-password',
      locale: await getLocale(),
    });
  const result = await resendCode(await authEnv(), { challengeId: challenge.id });
  const t = await getTranslations('auth');
  // A reset requested for an unknown phone has a made-up challenge; answering "resent" keeps
  // the form from revealing which phones have accounts.
  if (!result.ok && purpose === 'reset' && result.error.code === 'AUTH_CODE_EXPIRED') {
    return { ok: true, message: t('codeResent') };
  }
  if (!result.ok) return errorState(result.error);
  await saveChallenge({ id: result.value.challengeId, purpose, sentTo: result.value.sentTo });
  return { ok: true, message: t('codeResent') };
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await requestPasswordReset(await authEnv(), { phone: formString(form, 'phone') });
  if (!result.ok) return errorState(result.error);
  await saveChallenge({ id: result.value.challengeId, purpose: 'reset', sentTo: [] });
  return redirect({ href: '/forgot-password/reset', locale: await getLocale() });
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const challenge = await readChallenge('reset');
  if (!challenge) return redirect({ href: '/forgot-password', locale: await getLocale() });
  const result = await resetPassword(await authEnv(), {
    challengeId: challenge.id,
    code: formString(form, 'code'),
    password: formString(form, 'password'),
    confirm: formString(form, 'confirm'),
  });
  if (!result.ok) return errorState(result.error);
  (await cookies()).delete(CHALLENGE_COOKIE);
  return redirect({ href: '/login?reset=1', locale: await getLocale() });
}
