import { prisma } from '@gl/db';

export const dynamic = 'force-dynamic';

/** Liveness + database check for monitoring and deploy scripts. Never exposes details. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', db: 'ok' });
  } catch {
    return Response.json({ status: 'degraded', db: 'unavailable' }, { status: 503 });
  }
}
