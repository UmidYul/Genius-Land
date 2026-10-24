import { loadActor, verifyAccessToken } from '@gl/core';
import { prisma } from '@gl/db';

export const dynamic = 'force-dynamic';

/**
 * Groundwork for the parent/student app: who am I, by a bearer access token.
 * Sign-in endpoints for the app arrive with the app; tokens are issued by `issueApiTokens`.
 */
export async function GET(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const auth = token ? await verifyAccessToken(prisma, token) : null;
  if (!auth) return Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  const actor = await loadActor(prisma, auth.userId);
  if (!actor) return Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  return Response.json({
    id: actor.userId,
    fullName: actor.fullName,
    roles: actor.roleCodes,
    branches: actor.branches.map((b) => ({ id: b.id, nameUz: b.nameUz, nameRu: b.nameRu })),
  });
}
