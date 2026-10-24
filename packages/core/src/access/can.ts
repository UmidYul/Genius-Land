import { DomainError } from '../result';
import type { Actor, Grant } from './actor';
import type { PermissionCode } from './permissions';

/**
 * The record an action targets. Only the fields relevant to the record are set: a payment has a
 * branch and a student, a lesson has a branch, class and subject, a user profile has an owner.
 */
export interface AccessResource {
  /** Branch of the record; null — a school-wide record (not owned by a branch). */
  branchId?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  studentId?: string | null;
  /** User who owns the record (own profile, own request). */
  ownerUserId?: string | null;
}

function branchAllowed(grant: Grant, resource: AccessResource): boolean {
  // A record without a branch field is not branch-owned; with one, the branch must be granted.
  if (resource.branchId === undefined) return true;
  return resource.branchId !== null && grant.branchIds.includes(resource.branchId);
}

function grantCovers(actor: Actor, grant: Grant, resource: AccessResource): boolean {
  const { relations } = actor;
  switch (grant.scope) {
    case 'SYSTEM':
    case 'ALL_BRANCHES':
      return true;
    case 'BRANCH':
      return resource.branchId != null && grant.branchIds.includes(resource.branchId);
    case 'ASSIGNED': {
      if (!resource.classId || !branchAllowed(grant, resource)) return false;
      // Subject-level records (grades, topics): only the pairs the teacher teaches.
      if (resource.subjectId != null) {
        return relations.teaching.some(
          (pair) => pair.classId === resource.classId && pair.subjectId === resource.subjectId,
        );
      }
      // Class-level records (students, timetable): taught classes and the homeroom class.
      return (
        relations.teaching.some((pair) => pair.classId === resource.classId) ||
        relations.homeroomClassIds.includes(resource.classId)
      );
    }
    case 'HOMEROOM':
      return (
        !!resource.classId &&
        branchAllowed(grant, resource) &&
        relations.homeroomClassIds.includes(resource.classId)
      );
    case 'SELF':
      return (
        (resource.ownerUserId != null && resource.ownerUserId === actor.userId) ||
        (resource.studentId != null && resource.studentId === relations.selfStudentId)
      );
    case 'CHILDREN':
      return resource.studentId != null && relations.childStudentIds.includes(resource.studentId);
  }
}

/**
 * Does the actor hold the permission — for this record when one is given?
 * Without a resource it answers "is the permission held anywhere" (menus, page entry).
 * With a resource every relevant field is checked against the grant's scope.
 */
export function can(actor: Actor, permission: PermissionCode, resource?: AccessResource): boolean {
  const grants = actor.grants.get(permission);
  if (!grants?.length) return false;
  if (!resource) return true;
  return grants.some((grant) => grantCovers(actor, grant, resource));
}

/** Same as {@link can}, but throws FORBIDDEN. For service entry points. */
export function assertCan(actor: Actor, permission: PermissionCode, resource?: AccessResource) {
  if (!can(actor, permission, resource)) throw new DomainError('FORBIDDEN');
}

/** Any of the permissions — for menu sections that group several pages. */
export function canAny(actor: Actor, permissions: readonly PermissionCode[]): boolean {
  return permissions.some((permission) => can(actor, permission));
}
