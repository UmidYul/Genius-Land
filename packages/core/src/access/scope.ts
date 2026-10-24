import { DomainError } from '../result';
import type { Actor, Grant } from './actor';
import type { PermissionCode } from './permissions';

/** Column names of the queried model that the scopes map to. */
export interface ScopeFields {
  /** Branch column, e.g. `branchId`. Required for every branch-owned model. */
  branch: string;
  class?: string;
  student?: string;
  owner?: string;
}

type Where = Record<string, unknown>;

/** Marker of a where-clause produced by {@link scopeWhere} (it always names the branch column). */
declare const scoped: unique symbol;
export type ScopedWhere = Where & { readonly [scoped]: true };

function branchSet(actor: Actor, grant: Grant): string[] | 'all' {
  const visible =
    grant.scope === 'SYSTEM' || grant.scope === 'ALL_BRANCHES'
      ? 'all'
      : grant.branchIds.filter((id) => actor.branches.some((b) => b.id === id));
  // The branch switcher narrows what is shown; it never widens what is allowed.
  if (actor.activeBranchId === null) return visible;
  if (visible === 'all') return [actor.activeBranchId];
  return visible.filter((id) => id === actor.activeBranchId);
}

function grantCondition(actor: Actor, grant: Grant, fields: ScopeFields): Where | null {
  // SELF / CHILDREN are bounded by the person (own records, own children), not by a branch:
  // parents and students have no branch assignment.
  const personal = grant.scope === 'SELF' || grant.scope === 'CHILDREN';
  const branches = personal ? 'all' : branchSet(actor, grant);
  // Every condition names the branch column (undefined = any branch), so guarded queries can
  // verify that a scope was applied.
  const branch: Where = { [fields.branch]: branches === 'all' ? undefined : { in: branches } };
  if (branches !== 'all' && branches.length === 0) return null;
  const { relations } = actor;

  switch (grant.scope) {
    case 'SYSTEM':
    case 'ALL_BRANCHES':
    case 'BRANCH':
      return branch;
    case 'ASSIGNED': {
      // Class-level lists: taught classes and the homeroom class (see can.ts).
      const classIds = [
        ...new Set([...relations.teaching.map((p) => p.classId), ...relations.homeroomClassIds]),
      ];
      if (!fields.class || classIds.length === 0) return null;
      return { ...branch, [fields.class]: { in: classIds } };
    }
    case 'HOMEROOM':
      if (!fields.class || relations.homeroomClassIds.length === 0) return null;
      return { ...branch, [fields.class]: { in: [...relations.homeroomClassIds] } };
    case 'SELF': {
      const options: Where[] = [];
      if (fields.owner) options.push({ [fields.owner]: actor.userId });
      if (fields.student && relations.selfStudentId) {
        options.push({ [fields.student]: relations.selfStudentId });
      }
      if (options.length === 0) return null;
      return { ...branch, OR: options };
    }
    case 'CHILDREN':
      if (!fields.student || relations.childStudentIds.length === 0) return null;
      return { ...branch, [fields.student]: { in: [...relations.childStudentIds] } };
  }
}

/**
 * Where-clause limiting a query of a branch-owned model to what the actor may see with this
 * permission (all its grants combined, narrowed by the branch switcher).
 * Returns null when nothing is visible — the caller returns an empty list without querying.
 *
 *   const where = scopeWhere(ctx.actor, 'approvals.request.view', { branch: 'branchId' });
 *   if (!where) return [];
 *   db.approvalRequest.findMany({ where: { AND: [where, { status: 'PENDING' }] } });
 */
export function scopeWhere(
  actor: Actor,
  permission: PermissionCode,
  fields: ScopeFields,
): ScopedWhere | null {
  const grants = actor.grants.get(permission) ?? [];
  const conditions = grants
    .map((grant) => grantCondition(actor, grant, fields))
    .filter((c): c is Where => c !== null);
  if (conditions.length === 0) return null;
  const where = conditions.length === 1 ? conditions[0]! : { OR: conditions };
  return where as ScopedWhere;
}

/** {@link scopeWhere} that throws FORBIDDEN when the permission is not held at all. */
export function requireScope(
  actor: Actor,
  permission: PermissionCode,
  fields: ScopeFields,
): ScopedWhere | null {
  if (!actor.grants.get(permission)?.length) throw new DomainError('FORBIDDEN');
  return scopeWhere(actor, permission, fields);
}
