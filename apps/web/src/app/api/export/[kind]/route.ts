import { can, exportRegistry, type ExportKind, type PermissionCode } from '@gl/core';
import { isLocale } from '@gl/i18n';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PERMISSION: Record<ExportKind, PermissionCode> = {
  classes: 'school.class.view',
  staff: 'people.staff.view',
  students: 'people.student.view',
  guardians: 'people.guardian.view',
};

/** Excel export of a registry, with the page's filters and the user's permissions. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const auth = await getAuth();
  if (!auth) return new Response(null, { status: 401 });
  const { kind: requestedKind } = await params;
  const kind = (Object.keys(PERMISSION) as ExportKind[]).find((k) => k === requestedKind);
  if (!kind || !can(auth.actor, PERMISSION[kind])) return new Response(null, { status: 404 });
  const search = new URL(request.url).searchParams;
  const requested = search.get('locale');
  const locale = isLocale(requested) ? requested : 'uz';
  const { fileName, data } = await exportRegistry(
    auth.ctx,
    kind,
    locale,
    Object.fromEntries(search),
  );
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
