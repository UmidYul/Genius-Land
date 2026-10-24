'use client';

import { cn } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { isActive, navItems } from './nav-items';

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {navItems.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium',
                'transition-[background-color,color] duration-150 ease-out',
                active
                  ? 'bg-primary-soft text-primary-soft-fg'
                  : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" strokeWidth={active ? 2 : 1.75} />
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
