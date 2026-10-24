'use client';

import { cn } from '@gl/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, themePreferences, type ThemePreference } from '@/lib/theme';

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return themePreferences.includes(stored as ThemePreference)
      ? (stored as ThemePreference)
      : 'system';
  } catch {
    return 'system';
  }
}

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function apply(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && systemQuery().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Light / dark / system. The choice is kept in this browser (localStorage). */
export function ThemeSwitcher() {
  const t = useTranslations('theme');
  const tTopbar = useTranslations('topbar');
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => setPreference(readPreference()), []);

  // In "system" mode follow OS changes live.
  useEffect(() => {
    if (preference !== 'system') return;
    const query = systemQuery();
    const onChange = () => apply('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  const choose = (next: ThemePreference) => {
    setPreference(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    apply(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={tTopbar('theme')}
      className="bg-surface-3 grid grid-cols-3 gap-1 rounded-xl p-1"
    >
      {themePreferences.map((option) => {
        const Icon = icons[option];
        const active = option === preference;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option)}
            className={cn(
              'flex h-14 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium',
              'transition-[background-color,color,box-shadow] duration-150 ease-out',
              active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden className="size-[1.125rem]" strokeWidth={active ? 2 : 1.75} />
            <span className="max-w-full truncate">{t(option)}</span>
          </button>
        );
      })}
    </div>
  );
}
