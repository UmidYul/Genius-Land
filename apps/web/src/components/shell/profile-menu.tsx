'use client';

import { cn } from '@gl/ui';
import { CircleUserRound, LogOut, UserCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { signOutAction } from '@/app/[locale]/(cabinet)/actions';
import { Link } from '@/i18n/navigation';
import { ThemeSwitcher } from './theme-switcher';

const itemClass =
  'flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-fg transition-[background-color] duration-150 hover:bg-surface-3';

/** Profile button: who is signed in, theme, profile page, sign out. */
export function ProfileMenu({
  name,
  roles,
  branch,
}: {
  name: string;
  roles: string[];
  branch: string | null;
}) {
  const t = useTranslations('topbar');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('profile')}
        className={cn(
          'text-fg-muted inline-flex size-11 cursor-pointer items-center justify-center rounded-full',
          'hover:bg-surface-3 hover:text-fg transition-[background-color,color] duration-150',
          open && 'bg-surface-3 text-fg',
        )}
      >
        <CircleUserRound className="size-6" strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={t('profile')}
          className="animate-gl-pop-in bg-surface absolute end-0 top-full z-40 mt-2 flex w-[min(18rem,calc(100vw-2rem))] origin-top-right flex-col gap-3 rounded-2xl p-3 shadow-lg"
        >
          <div className="flex items-center gap-3 px-1 pt-1">
            <span className="bg-primary-soft text-primary-soft-fg flex size-10 shrink-0 items-center justify-center rounded-full">
              <CircleUserRound className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-fg truncate text-sm font-semibold">{name}</p>
              <p className="text-fg-muted truncate text-xs">{roles.join(', ')}</p>
              {branch && <p className="text-fg-muted truncate text-xs">{branch}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-fg-muted px-1 text-xs font-semibold">{t('theme')}</p>
            <ThemeSwitcher />
          </div>
          <div className="border-border-soft flex flex-col gap-0.5 border-t pt-2">
            <Link href="/profile" className={itemClass} onClick={() => setOpen(false)}>
              <UserCog aria-hidden strokeWidth={1.75} className="text-fg-muted size-5" />
              {t('myProfile')}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className={itemClass}>
                <LogOut aria-hidden strokeWidth={1.75} className="text-fg-muted size-5" />
                {t('signOut')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
