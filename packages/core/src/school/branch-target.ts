import { can } from '../access/can';
import type { PermissionCode } from '../access/permissions';
import type { ServiceContext } from '../context';
import { err, ok, type Result } from '../result';

/**
 * The branch a new record goes to: the one given explicitly, else the branch chosen in the
 * switcher, else the actor's only branch. "All branches" is not a place to create records.
 */
export function targetBranch(
  ctx: ServiceContext,
  permission: PermissionCode,
  branchId?: string | null,
): Result<string> {
  const candidate =
    branchId ??
    ctx.actor.activeBranchId ??
    (ctx.actor.branches.length === 1 ? ctx.actor.branches[0]!.id : null);
  if (!candidate) return err('BRANCH_REQUIRED');
  if (!can(ctx.actor, permission, { branchId: candidate })) return err('FORBIDDEN');
  return ok(candidate);
}

/** Collapses spaces and uppercases — "5 -а " and "5-А" are the same class name. */
export const nameKey = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .toUpperCase();

export const zodFieldErrors = (issues: { path: (string | number)[] }[]) =>
  Object.fromEntries(issues.map((i) => [i.path.join('.') || 'form', 'VALIDATION' as const]));
