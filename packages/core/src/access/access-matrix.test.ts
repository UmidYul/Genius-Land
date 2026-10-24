import { describe, expect, it } from 'vitest';
import { actorFromDefinitions } from '../testing/fixtures';
import { can, type AccessResource } from './can';
import { permissionCodes, type PermissionCode, type PermissionScope } from './permissions';
import { roleCodes, roleDefinitions, type RoleCode } from './roles';
import { scopeWhere } from './scope';

/**
 * The matrix "role × permission × own / other branch" — generated from the permission registry
 * and the role definitions, so every new permission or grant is covered automatically.
 */

const OWN = 'branch-own';
const OTHER = 'branch-other';
const ALL = [OWN, OTHER];

// Relations a user would have in their own branch (stub data until stages 2 and 4).
const OWN_CLASS = 'class-own';
const OTHER_CLASS = 'class-other';
const SUBJECT = 'subject-1';
const MY_STUDENT = 'student-mine';
const FOREIGN_STUDENT = 'student-foreign';

function actorFor(role: RoleCode) {
  const def = roleDefinitions[role];
  return actorFromDefinitions([{ role, branchIds: def.branchBound ? [OWN] : [] }], {
    allBranchIds: ALL,
    userId: 'me',
    relations: {
      teaching: [{ classId: OWN_CLASS, subjectId: SUBJECT }],
      homeroomClassIds: [OWN_CLASS],
      childStudentIds: [MY_STUDENT],
      selfStudentId: MY_STUDENT,
    },
  });
}

/** A record of the actor's own reach and one outside it, for each kind of scope. */
function resources(scope: PermissionScope): { mine: AccessResource; foreign: AccessResource } {
  switch (scope) {
    case 'SYSTEM':
    case 'ALL_BRANCHES':
    case 'BRANCH':
      return { mine: { branchId: OWN }, foreign: { branchId: OTHER } };
    case 'ASSIGNED':
    case 'HOMEROOM':
      return {
        mine: { branchId: OWN, classId: OWN_CLASS, subjectId: SUBJECT },
        foreign: { branchId: OTHER, classId: OTHER_CLASS, subjectId: SUBJECT },
      };
    case 'SELF':
    case 'CHILDREN':
      return {
        mine: { branchId: OWN, studentId: MY_STUDENT },
        foreign: { branchId: OTHER, studentId: FOREIGN_STUDENT },
      };
  }
}

/** Expected answer, derived only from the scope's meaning. */
const seesForeign = (scope: PermissionScope) => scope === 'SYSTEM' || scope === 'ALL_BRANCHES';

describe.each(roleCodes)('role %s', (role) => {
  const actor = actorFor(role);
  const grants = roleDefinitions[role].grants;

  it.each(permissionCodes)('%s', (permission: PermissionCode) => {
    const scope = grants[permission];
    if (!scope) {
      // Not granted: nothing anywhere, not even "somewhere".
      expect(can(actor, permission)).toBe(false);
      expect(can(actor, permission, { branchId: OWN })).toBe(false);
      expect(can(actor, permission, { branchId: OTHER })).toBe(false);
      expect(scopeWhere(actor, permission, { branch: 'branchId' })).toBeNull();
      return;
    }
    const { mine, foreign } = resources(scope);
    expect(can(actor, permission)).toBe(true);
    expect(can(actor, permission, mine), 'own record').toBe(true);
    expect(can(actor, permission, foreign), 'other branch record').toBe(seesForeign(scope));
  });
});

describe('branch isolation of branch-bound staff', () => {
  const branchBound: RoleCode[] = ['DIRECTOR', 'ADMINISTRATOR', 'TEACHER', 'ACCOUNTANT'];

  it.each(branchBound)('%s sees nothing of the other branch, for any permission', (role) => {
    const actor = actorFor(role);
    for (const permission of permissionCodes) {
      expect(can(actor, permission, { branchId: OTHER }), permission).toBe(false);
      expect(
        can(actor, permission, { branchId: OTHER, classId: OWN_CLASS, studentId: MY_STUDENT }),
        `${permission} with own class id in a foreign branch`,
      ).toBe(false);
      const where = scopeWhere(actor, permission, { branch: 'branchId', class: 'classId' });
      if (where) expect(JSON.stringify(where), permission).not.toContain(OTHER);
    }
  });

  it('a school-wide record (no branch) is not visible through BRANCH grants', () => {
    expect(can(actorFor('DIRECTOR'), 'approvals.request.decide', { branchId: null })).toBe(false);
    expect(can(actorFor('FOUNDER'), 'approvals.request.decide', { branchId: null })).toBe(true);
  });
});

describe('role definitions', () => {
  it('discipline permissions exist but are granted to nobody in v1', () => {
    expect(permissionCodes.filter((p) => p.startsWith('discipline.')).length).toBeGreaterThan(0);
    for (const def of Object.values(roleDefinitions)) {
      expect(
        Object.keys(def.grants).filter((p) => p.startsWith('discipline.')),
        def.code,
      ).toEqual([]);
    }
  });

  it('only the superadmin holds SYSTEM, only the founder ALL_BRANCHES', () => {
    for (const def of Object.values(roleDefinitions)) {
      const scopes = new Set(Object.values(def.grants));
      expect(scopes.has('SYSTEM'), def.code).toBe(def.code === 'SUPERADMIN');
      expect(scopes.has('ALL_BRANCHES'), def.code).toBe(def.code === 'FOUNDER');
    }
  });

  it('branch-bound roles use branch-limited scopes only', () => {
    for (const def of Object.values(roleDefinitions).filter((d) => d.branchBound)) {
      for (const scope of Object.values(def.grants)) {
        expect(['BRANCH', 'ASSIGNED', 'HOMEROOM'], def.code).toContain(scope);
      }
    }
  });

  it('parents and students hold only CHILDREN / SELF and nothing administrative', () => {
    for (const code of ['PARENT', 'STUDENT'] as const) {
      const grants = roleDefinitions[code].grants;
      expect(new Set(Object.values(grants))).toEqual(
        new Set([code === 'PARENT' ? 'CHILDREN' : 'SELF']),
      );
      expect(Object.keys(grants).some((p) => p.startsWith('admin.'))).toBe(false);
    }
  });

  it('administration (users, roles, settings) belongs to the superadmin only', () => {
    for (const def of Object.values(roleDefinitions)) {
      const admin = Object.keys(def.grants).filter(
        (p) => p.startsWith('admin.') && p !== 'admin.audit.view',
      );
      if (def.code !== 'SUPERADMIN') expect(admin, def.code).toEqual([]);
    }
  });

  it('every rank is unique among staff roles (no ambiguous escalation checks)', () => {
    const staff = Object.values(roleDefinitions).filter((d) => d.isStaff);
    expect(new Set(staff.map((d) => d.rank)).size).toBe(staff.length);
  });
});
