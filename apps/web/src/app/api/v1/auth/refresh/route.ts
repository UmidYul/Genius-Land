import { refreshApiTokens } from '@gl/core';
import { prisma } from '@gl/db';

export const dynamic = 'force-dynamic';

/** Exchanges a refresh token for a new access + refresh pair (the refresh token rotates). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { refreshToken?: unknown } | null;
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
  const tokens = refreshToken ? await refreshApiTokens(prisma, refreshToken) : null;
  if (!tokens) return Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  return Response.json(tokens);
}
