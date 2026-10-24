import type { PermissionCode } from '@gl/core/permissions';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  FileUp,
  GraduationCap,
  HeartHandshake,
  IdCard,
  School,
  ClipboardCheck,
  House,
  KeyRound,
  Palette,
  ScrollText,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavLabelKey =
  | 'home'
  | 'approvals'
  | 'adminBranches'
  | 'adminUsers'
  | 'adminRoles'
  | 'adminSettings'
  | 'adminAudit'
  | 'designSystem'
  | 'schoolYears'
  | 'schoolCalendar'
  | 'schoolClasses'
  | 'schoolCatalog'
  | 'peopleStudents'
  | 'peopleGuardians'
  | 'peopleStaff'
  | 'peopleImport';

export type NavSection = 'main' | 'school' | 'people' | 'admin' | 'dev';

export interface NavItem {
  href: string;
  /** Key in the `nav` dictionary namespace. */
  labelKey: NavLabelKey;
  icon: LucideIcon;
  section: NavSection;
  /** Shown only to users holding this permission. No permission — every signed-in user. */
  permission?: PermissionCode;
  /** Development aid, hidden in production. */
  devOnly?: boolean;
}

/**
 * The menu is derived from permissions: an item appears only if the user holds its permission.
 * There are no per-role menu lists. Later stages add their items here with their permission.
 */
export const navItems: NavItem[] = [
  { href: '/', labelKey: 'home', icon: House, section: 'main' },
  {
    href: '/approvals',
    labelKey: 'approvals',
    icon: ClipboardCheck,
    section: 'main',
    permission: 'approvals.request.view',
  },
  {
    href: '/school/classes',
    labelKey: 'schoolClasses',
    icon: School,
    section: 'school',
    permission: 'school.class.view',
  },
  {
    href: '/school/years',
    labelKey: 'schoolYears',
    icon: CalendarRange,
    section: 'school',
    permission: 'school.academicYear.view',
  },
  {
    href: '/school/calendar',
    labelKey: 'schoolCalendar',
    icon: CalendarDays,
    section: 'school',
    permission: 'school.academicYear.view',
  },
  {
    href: '/school/catalog',
    labelKey: 'schoolCatalog',
    icon: BookOpen,
    section: 'school',
    permission: 'school.subject.view',
  },
  {
    href: '/people/students',
    labelKey: 'peopleStudents',
    icon: GraduationCap,
    section: 'people',
    permission: 'people.student.view',
  },
  {
    href: '/people/guardians',
    labelKey: 'peopleGuardians',
    icon: HeartHandshake,
    section: 'people',
    permission: 'people.guardian.view',
  },
  {
    href: '/people/staff',
    labelKey: 'peopleStaff',
    icon: IdCard,
    section: 'people',
    permission: 'people.staff.view',
  },
  {
    href: '/people/import',
    labelKey: 'peopleImport',
    icon: FileUp,
    section: 'people',
    permission: 'people.student.manage',
  },
  {
    href: '/admin/users',
    labelKey: 'adminUsers',
    icon: Users,
    section: 'admin',
    permission: 'admin.user.view',
  },
  {
    href: '/admin/branches',
    labelKey: 'adminBranches',
    icon: Building2,
    section: 'admin',
    permission: 'admin.branch.view',
  },
  {
    href: '/admin/roles',
    labelKey: 'adminRoles',
    icon: KeyRound,
    section: 'admin',
    permission: 'admin.role.view',
  },
  {
    href: '/admin/settings',
    labelKey: 'adminSettings',
    icon: SlidersHorizontal,
    section: 'admin',
    permission: 'admin.setting.view',
  },
  {
    href: '/admin/audit',
    labelKey: 'adminAudit',
    icon: ScrollText,
    section: 'admin',
    permission: 'admin.audit.view',
  },
  {
    href: '/design-system',
    labelKey: 'designSystem',
    icon: Palette,
    section: 'dev',
    devOnly: true,
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
