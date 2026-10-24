import { House, Palette, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  /** Key in the `nav` dictionary namespace. */
  labelKey: 'home' | 'designSystem';
  icon: LucideIcon;
}

/**
 * Static menu for stage 0. In stage 1 the menu is derived from the user's permissions:
 * each item will declare the permission it needs instead of being listed here unconditionally.
 */
export const navItems: NavItem[] = [
  { href: '/', labelKey: 'home', icon: House },
  { href: '/design-system', labelKey: 'designSystem', icon: Palette },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
