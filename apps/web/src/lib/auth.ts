import 'server-only';
import {
  createServiceContext,
  loadActor,
  validateSessionToken,
  type Actor,
  type PermissionCode,
  type ServiceContext,
  can,
} from '@gl/core';
import { prisma, type Session } from '@gl/db';
import { getLocale } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';

export const SESSION_COOKIE = 'gl_session';
export const DEVICE_COOKIE = 'gl_device';
export const CHALLENGE_COOKIE = 'gl_challenge';

const secure = process.env.NODE_ENV === 'production' && !process.env.APP_URL?.startsWith('http://');

export const cookieOptions = (maxAgeSeconds: number) =>
  ({ httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: maxAgeSeconds }) as const;

/** Client address as seen by the reverse proxy (nginx sets X-Forwarded-For / X-Real-IP). */
export const getClientInfo = cache(async () => {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
  };
});

/** The live web session of this request, or null. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(prisma, token) : null;
});

export interface Authenticated {
  session: Session;
  actor: Actor;
  ctx: ServiceContext;
}

/** Session + actor + service context, loaded once per request. */
export const getAuth = cache(async (): Promise<Authenticated | null> => {
  const session = await getSession();
  if (!session) return null;
  const actor = await loadActor(prisma, session.userId);
  if (!actor) return null;
  const { ip } = await getClientInfo();
  return { session, actor, ctx: createServiceContext(prisma, actor, ip) };
});

/** For pages and actions of the cabinet: signed in, or off to the sign-in page. */
export async function requireAuth(): Promise<Authenticated> {
  const auth = await getAuth();
  if (!auth) {
    const locale = await getLocale();
    return redirect({ href: '/login', locale });
  }
  return auth;
}

/**
 * A page that needs a permission. Without it the page does not exist for this user (404) —
 * the menu never links there, so only a typed URL can reach it.
 */
export async function requirePermission(permission: PermissionCode): Promise<Authenticated> {
  const auth = await requireAuth();
  if (!can(auth.actor, permission)) notFound();
  return auth;
}
