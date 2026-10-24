import 'server-only';
import { roleDefinitions, type Actor } from '@gl/core';
import type { RoleOption } from './assignments-editor';

/** Every role, with the ones above the actor's rank locked (visible, not changeable). */
export function roleOptions(actor: Actor): RoleOption[] {
  return Object.values(roleDefinitions)
    .sort((a, b) => b.rank - a.rank)
    .map((def) => ({
      code: def.code,
      branchBound: def.branchBound,
      locked: def.rank > actor.maxRank,
    }));
}
