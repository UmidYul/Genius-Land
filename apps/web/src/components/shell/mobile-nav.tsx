'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { Logo } from '../logo';
import { NavList } from './nav-list';

/**
 * Slide-out menu for phones and tablets. A drawer (not a bottom bar) because the menu grows
 * with permissions and a bottom bar fits only 4–5 items.
 * Built on <dialog>: focus trap, Esc and inert background come from the browser.
 */
export function MobileNav({
  allowed,
  badges,
  switcher,
}: {
  allowed: string[];
  badges: Record<string, number>;
  /** Branch switcher, shown inside the drawer on narrow screens. */
  switcher?: ReactNode;
}) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close after navigation (also covers browser back/forward).
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openMenu')}
        aria-expanded={open}
        className="text-fg hover:bg-surface-3 -ms-1.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-[background-color] duration-150 lg:hidden"
      >
        <Menu className="size-6" strokeWidth={1.75} aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-label={t('mainMenu')}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="bg-surface text-fg backdrop:bg-overlay backdrop:animate-gl-fade-in open:animate-gl-slide-in m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none p-0 shadow-lg lg:hidden"
      >
        <nav
          aria-label={t('mainMenu')}
          className="flex h-full flex-col gap-4 overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <div className="flex items-center justify-between ps-2">
            <Logo size={36} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeMenu')}
              className="text-fg-muted hover:bg-surface-3 hover:text-fg inline-flex size-11 cursor-pointer items-center justify-center rounded-xl transition-[background-color,color] duration-150"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {switcher && <div className="sm:hidden">{switcher}</div>}
          <NavList allowed={allowed} badges={badges} onNavigate={() => setOpen(false)} />
        </nav>
      </dialog>
    </>
  );
}
