'use server';

import { revokeSession, setLocale, setPreferredBranch } from '@gl/core';
import { prisma } from '@gl/db';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { getAuth, SESSION_COOKIE } from '@/lib/auth';

export async function signOutAction() {
  const auth = await getAuth();
  if (auth) await revokeSession(prisma, auth.session.userId, auth.session.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect({ href: '/login', locale: await getLocale() });
}

/** Branch switcher. `all` — every branch (only for those who may see all). */
export async function selectBranchAction(branchId: string) {
  const auth = await getAuth();
  if (!auth) return;
  await setPreferredBranch(auth.ctx, branchId === 'all' ? null : branchId);
  revalidatePath('/', 'layout');
}

/** The language switch also remembers the choice in the profile. */
export async function rememberLocaleAction(locale: 'uz' | 'ru') {
  const auth = await getAuth();
  if (auth) await setLocale(auth.ctx, locale);
}
