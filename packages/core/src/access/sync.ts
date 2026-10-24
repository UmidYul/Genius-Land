import type { PrismaClient } from '@gl/db';
import { permissionCodes, splitPermission } from './permissions';
import { roleDefinitions } from './roles';

/**
 * Writes the permission registry and the v1 role definitions into the database.
 * Idempotent: adds new permissions, updates ranks, and makes each role's grants exactly match
 * its definition (grants removed from the definition are removed from the role).
 * Used by the seed and by tests.
 */
export async function syncAccessModel(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const code of permissionCodes) {
      await tx.permission.upsert({
        where: { code },
        create: { code, module: splitPermission(code).module },
        update: {},
      });
    }
    for (const def of Object.values(roleDefinitions)) {
      const role = await tx.role.upsert({
        where: { code: def.code },
        create: { code: def.code, rank: def.rank, isStaff: def.isStaff },
        update: { rank: def.rank, isStaff: def.isStaff },
      });
      const grants = Object.entries(def.grants);
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionCode: { notIn: grants.map(([code]) => code) } },
      });
      for (const [permissionCode, scope] of grants) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionCode: { roleId: role.id, permissionCode } },
          create: { roleId: role.id, permissionCode, scope },
          update: { scope },
        });
      }
    }
  });
}
