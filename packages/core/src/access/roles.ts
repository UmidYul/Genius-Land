import type { PermissionCode, PermissionScope } from './permissions';

/**
 * Roles of v1 as data (PLAN §4). The seed writes them into `Role` / `RolePermission`;
 * at runtime grants are read from the database, so this file is the reviewed default,
 * not a hidden second source of truth.
 *
 * `rank` protects against privilege escalation: a user can grant only roles whose rank is not
 * higher than their own highest rank.
 */
export const roleCodes = [
  'SUPERADMIN',
  'FOUNDER',
  'DIRECTOR',
  'ACCOUNTANT',
  'ADMINISTRATOR',
  'TEACHER',
  'PARENT',
  'STUDENT',
] as const;

export type RoleCode = (typeof roleCodes)[number];

export interface RoleDefinition {
  code: RoleCode;
  rank: number;
  isStaff: boolean;
  /** Whether an assignment of this role is tied to specific branches. */
  branchBound: boolean;
  grants: Partial<Record<PermissionCode, PermissionScope>>;
}

const grant = (scope: PermissionScope, codes: PermissionCode[]) =>
  Object.fromEntries(codes.map((code) => [code, scope])) as Partial<
    Record<PermissionCode, PermissionScope>
  >;

const SUPERADMIN: RoleDefinition = {
  code: 'SUPERADMIN',
  rank: 100,
  isStaff: true,
  branchBound: false,
  grants: grant('SYSTEM', [
    'admin.branch.view',
    'admin.branch.manage',
    'admin.user.view',
    'admin.user.manage',
    'admin.role.view',
    'admin.setting.view',
    'admin.setting.manage',
    'admin.audit.view',
  ]),
};

// Founder: sees both branches, compares them and approves important decisions.
const FOUNDER: RoleDefinition = {
  code: 'FOUNDER',
  rank: 90,
  isStaff: true,
  branchBound: false,
  grants: grant('ALL_BRANCHES', [
    'dashboard.overview.view',
    'dashboard.branchComparison.view',
    'reports.report.view',
    'reports.report.export',
    'people.student.view',
    'people.guardian.view',
    'people.staff.view',
    'school.academicYear.view',
    'school.class.view',
    'school.subject.view',
    'school.teachingAssignment.view',
    'schedule.timetable.view',
    'journal.lesson.view',
    'journal.grade.view',
    'journal.attendance.view',
    'journal.termGrade.view',
    'finance.contract.view',
    'finance.invoice.view',
    'finance.payment.view',
    'finance.discount.view',
    'finance.debt.view',
    'finance.policy.view',
    'approvals.request.view',
    'approvals.request.decide',
    'notifications.broadcast.send',
    'admin.audit.view',
  ]),
};

// Director: runs one branch — academics, staff, finance control, reports.
const DIRECTOR: RoleDefinition = {
  code: 'DIRECTOR',
  rank: 70,
  isStaff: true,
  branchBound: true,
  grants: grant('BRANCH', [
    'dashboard.overview.view',
    'reports.report.view',
    'reports.report.export',
    'people.student.view',
    'people.student.manage',
    'people.guardian.view',
    'people.guardian.manage',
    'people.staff.view',
    'people.staff.manage',
    'school.academicYear.view',
    'school.academicYear.manage',
    'school.calendar.manage',
    'school.class.view',
    'school.class.manage',
    'school.subject.view',
    'school.subject.manage',
    'school.teachingAssignment.view',
    'school.teachingAssignment.manage',
    'schedule.timetable.view',
    'schedule.timetable.manage',
    'schedule.change.manage',
    'journal.lesson.view',
    'journal.topic.write',
    'journal.grade.view',
    'journal.grade.write',
    'journal.attendance.view',
    'journal.attendance.write',
    'journal.attendance.backdate',
    'journal.termGrade.view',
    'journal.termGrade.approve',
    'journal.termGrade.unlock',
    'finance.contract.view',
    'finance.invoice.view',
    'finance.payment.view',
    'finance.discount.view',
    'finance.debt.view',
    'finance.policy.view',
    'approvals.request.view',
    'approvals.request.create',
    'approvals.request.decide',
    'notifications.broadcast.send',
  ]),
};

// Accountant: contracts, fees, payments and debts of the assigned branches (one or both).
const ACCOUNTANT: RoleDefinition = {
  code: 'ACCOUNTANT',
  rank: 50,
  isStaff: true,
  branchBound: true,
  grants: grant('BRANCH', [
    'dashboard.overview.view',
    'reports.report.view',
    'reports.report.export',
    'people.student.view',
    'people.guardian.view',
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
    'approvals.request.view',
    'approvals.request.create',
    'notifications.paymentReminder.send',
  ]),
};

// Administrator: day-to-day operations of one branch.
const ADMINISTRATOR: RoleDefinition = {
  code: 'ADMINISTRATOR',
  rank: 60,
  isStaff: true,
  branchBound: true,
  grants: grant('BRANCH', [
    'dashboard.overview.view',
    'reports.report.view',
    'people.student.view',
    'people.student.manage',
    'people.guardian.view',
    'people.guardian.manage',
    'people.staff.view',
    'people.staff.manage',
    'school.academicYear.view',
    'school.class.view',
    'school.class.manage',
    'school.subject.view',
    'school.subject.manage',
    'school.teachingAssignment.view',
    'school.teachingAssignment.manage',
    'schedule.timetable.view',
    'schedule.timetable.manage',
    'schedule.change.manage',
    'journal.lesson.view',
    'journal.grade.view',
    'journal.attendance.view',
    'journal.attendance.write',
    'journal.attendance.backdate',
    'journal.termGrade.view',
    'approvals.request.view',
    'approvals.request.create',
    'notifications.broadcast.send',
  ]),
};

// Teacher: own classes, groups and subjects; broadcasts only to the homeroom class.
const TEACHER: RoleDefinition = {
  code: 'TEACHER',
  rank: 40,
  isStaff: true,
  branchBound: true,
  grants: {
    ...grant('ASSIGNED', [
      'dashboard.overview.view',
      'people.student.view',
      'school.class.view',
      'schedule.timetable.view',
      'journal.lesson.view',
      'journal.topic.write',
      'journal.grade.view',
      'journal.grade.write',
      'journal.attendance.view',
      'journal.attendance.write',
      'journal.termGrade.view',
      'journal.termGrade.set',
    ]),
    ...grant('HOMEROOM', ['notifications.broadcast.send']),
  },
};

// Parent and student: no web pages — the app and the bot use these grants later.
const PARENT: RoleDefinition = {
  code: 'PARENT',
  rank: 10,
  isStaff: false,
  branchBound: false,
  grants: grant('CHILDREN', [
    'schedule.timetable.view',
    'journal.grade.view',
    'journal.attendance.view',
    'journal.termGrade.view',
    'finance.invoice.view',
    'finance.payment.view',
    'finance.debt.view',
  ]),
};

const STUDENT: RoleDefinition = {
  code: 'STUDENT',
  rank: 10,
  isStaff: false,
  branchBound: false,
  grants: grant('SELF', [
    'schedule.timetable.view',
    'journal.grade.view',
    'journal.attendance.view',
    'journal.termGrade.view',
  ]),
};

export const roleDefinitions: Record<RoleCode, RoleDefinition> = {
  SUPERADMIN,
  FOUNDER,
  DIRECTOR,
  ACCOUNTANT,
  ADMINISTRATOR,
  TEACHER,
  PARENT,
  STUDENT,
};

export function isRoleCode(value: string): value is RoleCode {
  return (roleCodes as readonly string[]).includes(value);
}
