import { buildTemplate, can, importPermission } from '@gl/core';
import type { ImportKind } from '@gl/db';
import { isLocale } from '@gl/i18n';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const KINDS: ImportKind[] = ['STAFF', 'CLASSES', 'STUDENTS', 'GUARDIANS'];

/** Empty import template in the user's language. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await getAuth();
  if (!auth) return new Response(null, { status: 401 });
  const { kind: requestedKind } = await params;
  const kind = KINDS.find((k) => k === requestedKind);
  if (!kind || !can(auth.actor, importPermission[kind])) return new Response(null, { status: 404 });
  const requested = new URL(request.url).searchParams.get('locale');
  const locale = isLocale(requested) ? requested : 'uz';
  const data = await buildTemplate(kind, locale);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-${kind.toLowerCase()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
