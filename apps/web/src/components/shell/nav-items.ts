import type { PermissionCode } from '@gl/core/permissions';
import {
  Building2,
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
  | 'designSystem';

export type NavSection = 'main' | 'admin' | 'dev';

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
