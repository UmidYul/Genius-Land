import type { Db } from '@gl/db';
import { isPermissionCode, type PermissionCode, type PermissionScope } from './permissions';
import { dbScopeRelationsProvider } from './relations';
import { isRoleCode, type RoleCode } from './roles';

/** One grant of a permission: its scope and the branches of the role assignment it came from. */
export interface Grant {
  scope: PermissionScope;
  branchIds: readonly string[];
}

/** A class–subject pair a teacher teaches. */
export interface TeachingPair {
  classId: string;
  subjectId: string;
}

/**
 * Data behind the ASSIGNED / HOMEROOM / SELF / CHILDREN scopes. Stage 1 has no classes or
 * students yet: the default provider returns empty sets; stages 2 and 4 plug in real data.
 */
export interface ScopeRelations {
  /** Classes and direction groups the user teaches in, with subjects. */
  teaching: readonly TeachingPair[];
  /** Classes where the user is the homeroom teacher. */
  homeroomClassIds: readonly string[];
  /** Students who are the user's children (parent role). */
  childStudentIds: readonly string[];
  /** The student record of the user (student role). */
  selfStudentId: string | null;
}

export interface ScopeRelationsProvider {
  load(db: Db, userId: string): Promise<ScopeRelations>;
}

export const emptyScopeRelations: ScopeRelations = {
  teaching: [],
  homeroomClassIds: [],
  childStudentIds: [],
  selfStudentId: null,
};

/** No relations at all — for tests and for actors that need none. */
export const emptyScopeRelationsProvider: ScopeRelationsProvider = {
  load: async () => emptyScopeRelations,
};

export interface ActorBranch {
  id: string;
  nameUz: string;
  nameRu: string;
}

/** Who is acting: identity, effective grants and visible branches. Built once per request. */
export interface Actor {
  userId: string;
  fullName: string;
  roleCodes: readonly RoleCode[];
  /** Highest role rank — guards against granting roles above one's own. */
  maxRank: number;
  grants: ReadonlyMap<PermissionCode, readonly Grant[]>;
  /** Branches this actor may see at all (every active branch for ALL_BRANCHES / SYSTEM). */
  branches: readonly ActorBranch[];
  /** The actor holds at least one ALL_BRANCHES or SYSTEM grant. */
  hasAllBranches: boolean;
  /** Branch switcher: a concrete branch, or null for "all branches". */
  activeBranchId: string | null;
  relations: ScopeRelations;
}

/**
 * Loads the actor for a user. Returns null when the user does not exist, is deleted or blocked:
 * such a user has no access at all, even with a valid session.
 */
export async function loadActor(
  db: Db,
  userId: string,
  relations: ScopeRelationsProvider = dbScopeRelationsProvider,
): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: {
        include: {
          role: { include: { permissions: true } },
          branches: { select: { branchId: true } },
        },
      },
    },
  });
  if (!user || user.deletedAt || user.status !== 'ACTIVE') return null;

  const grants = new Map<PermissionCode, Grant[]>();
  const roleCodes: RoleCode[] = [];
  let maxRank = 0;
  let hasAllBranches = false;
  const assignedBranchIds = new Set<string>();

  for (const assignment of user.roleAssignments) {
    const { role } = assignment;
    if (!isRoleCode(role.code)) continue;
    roleCodes.push(role.code);
    maxRank = Math.max(maxRank, role.rank);
    const branchIds = assignment.branches.map((b) => b.branchId);
    branchIds.forEach((id) => assignedBranchIds.add(id));
    for (const rp of role.permissions) {
      if (!isPermissionCode(rp.permissionCode)) continue;
      if (rp.scope === 'ALL_BRANCHES' || rp.scope === 'SYSTEM') hasAllBranches = true;
      const list = grants.get(rp.permissionCode) ?? [];
      list.push({ scope: rp.scope, branchIds });
      grants.set(rp.permissionCode, list);
    }
  }

  const branches = await db.branch.findMany({
    where: hasAllBranches
      ? { isActive: true }
      : { id: { in: [...assignedBranchIds] }, isActive: true },
    select: { id: true, nameUz: true, nameRu: true },
    orderBy: { createdAt: 'asc' },
  });

  return {
    userId: user.id,
    fullName: user.fullName,
    roleCodes,
    maxRank,
    grants,
    branches,
    hasAllBranches,
    activeBranchId: resolveActiveBranch(user.preferredBranchId, branches, hasAllBranches),
    relations: await relations.load(db, user.id),
  };
}

/**
 * The saved switcher choice if it is still visible; otherwise "all branches" for those who may
 * see all, or the first visible branch for everyone else.
 */
export function resolveActiveBranch(
  preferred: string | null,
  branches: readonly ActorBranch[],
  hasAllBranches: boolean,
): string | null {
  if (preferred && branches.some((b) => b.id === preferred)) return preferred;
  if (hasAllBranches) return null;
  return branches[0]?.id ?? null;
}

/** Whether the branch switcher is shown: more than one branch to choose from. */
export function canSwitchBranch(actor: Actor): boolean {
  return actor.branches.length > 1;
}
