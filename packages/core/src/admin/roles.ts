import { assertCan } from '../access/can';
import type { ServiceContext } from '../context';

/** Roles with their permissions and scopes, as stored — read-only view for the superadmin. */
export function listRolesWithPermissions(ctx: ServiceContext) {
  assertCan(ctx.actor, 'admin.role.view');
  return ctx.db.role.findMany({
    orderBy: { rank: 'desc' },
    include: {
      permissions: { orderBy: { permissionCode: 'asc' } },
      _count: { select: { assignments: true } },
    },
  });
}
