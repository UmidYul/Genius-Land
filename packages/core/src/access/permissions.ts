/**
 * Permission registry — the single source of every permission code `module.resource.action`.
 * The seed syncs it into the `Permission` table; menus, API guards and tests are derived from it.
 * Permissions for future modules are declared now so roles can be reviewed as a whole.
 * Labels are composed from the dictionaries: `access.modules.*`, `access.resources.*`,
 * `access.actions.*`.
 */
export const permissionCodes = [
  // Dashboards and reports
  'dashboard.overview.view',
  'dashboard.branchComparison.view',
  'reports.report.view',
  'reports.report.export',

  // People
  'people.student.view',
  'people.student.manage',
  'people.guardian.view',
  'people.guardian.manage',
  'people.staff.view',
  'people.staff.manage',

  // School structure
  'school.academicYear.view',
  'school.academicYear.manage',
  'school.calendar.manage',
  'school.class.view',
  'school.class.manage',
  'school.subject.view',
  'school.subject.manage',
  'school.teachingAssignment.view',
  'school.teachingAssignment.manage',

  // Schedule
  'schedule.timetable.view',
  'schedule.timetable.manage',
  'schedule.change.manage',

  // Journal
  'journal.lesson.view',
  'journal.topic.write',
  'journal.grade.view',
  'journal.grade.write',
  'journal.attendance.view',
  'journal.attendance.write',
  'journal.attendance.backdate',
  'journal.termGrade.view',
  'journal.termGrade.set',
  'journal.termGrade.approve',
  'journal.termGrade.unlock',

  // Finance
  'finance.contract.view',
  'finance.contract.manage',
  'finance.invoice.view',
  'finance.invoice.manage',
  'finance.payment.view',
  'finance.payment.create',
  'finance.payment.reverse',
  'finance.discount.view',
  'finance.discount.manage',
  'finance.debt.view',
  'finance.debt.writeOff',
  'finance.policy.view',
  'finance.policy.propose',

  // Approvals
  'approvals.request.view',
  'approvals.request.create',
  'approvals.request.decide',

  // Notifications
  'notifications.broadcast.send',
  'notifications.paymentReminder.send',

  // Discipline — the foundation for v2: declared, not granted to any role in v1.
  'discipline.record.view',
  'discipline.record.manage',
  'discipline.violationType.manage',
  'discipline.score.view',

  // Administration (superadmin)
  'admin.branch.view',
  'admin.branch.manage',
  'admin.user.view',
  'admin.user.manage',
  'admin.role.view',
  'admin.setting.view',
  'admin.setting.manage',
  'admin.audit.view',
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export const permissionScopes = [
  'SYSTEM',
  'ALL_BRANCHES',
  'BRANCH',
  'ASSIGNED',
  'HOMEROOM',
  'SELF',
  'CHILDREN',
] as const;

export type PermissionScope = (typeof permissionScopes)[number];

export interface PermissionParts {
  module: string;
  resource: string;
  action: string;
}

export function splitPermission(code: PermissionCode): PermissionParts {
  const [module = '', resource = '', action = ''] = code.split('.');
  return { module, resource, action };
}

export function isPermissionCode(value: string): value is PermissionCode {
  return (permissionCodes as readonly string[]).includes(value);
}

/** Permissions that exist but no role may hold in v1 (checked by tests). */
export const reservedPermissionPrefixes = ['discipline.'] as const;
