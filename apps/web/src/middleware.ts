import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Pages reachable without signing in (after the /uz or /ru prefix). */
const PUBLIC_PATHS = ['/login', '/forgot-password'];
const SESSION_COOKIE = 'gl_session';

/**
 * Fast path only: without a session cookie the cabinet redirects to the sign-in page.
 * The real check (session valid, user active, permissions) happens on the server for every
 * page and action — a cookie alone never grants anything.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = /^\/(uz|ru)(\/.*)?$/.exec(pathname);
  if (match) {
    const locale = match[1];
    const rest = match[2] ?? '/';
    const isPublic = PUBLIC_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`));
    if (!isPublic && !request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
  }
  return intl(request);
}

export const config = {
  // Everything except the API, Next internals and files with an extension (logo, favicon).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
