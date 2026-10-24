'use client';

import { cn } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { isActive, navItems, type NavSection } from './nav-items';

const sectionOrder: NavSection[] = ['main', 'admin', 'dev'];

export function NavList({
  allowed,
  badges = {},
  onNavigate,
}: {
  /** Hrefs the user may see (computed on the server from permissions). */
  allowed: string[];
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const visible = navItems.filter((item) => allowed.includes(item.href));

  return (
    <div className="flex flex-col gap-5">
      {sectionOrder.map((section) => {
        const items = visible.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section} className="flex flex-col gap-1">
            {section !== 'main' && (
              <p className="text-fg-muted px-3 pb-1 text-xs font-semibold uppercase tracking-wide">
                {t(`section.${section}`)}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {items.map(({ href, labelKey, icon: Icon }) => {
                const active = isActive(pathname, href);
                const badge = badges[href] ?? 0;
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
                      <Icon
                        aria-hidden
                        className="size-5 shrink-0"
                        strokeWidth={active ? 2 : 1.75}
                      />
                      <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                      {badge > 0 && (
                        <span className="bg-primary-solid text-on-solid min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold tabular-nums">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
