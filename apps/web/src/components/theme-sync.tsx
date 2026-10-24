'use client';

import { useEffect, useLayoutEffect } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { applyTheme, readThemePreference, systemDarkQuery } from '@/lib/theme-client';

/**
 * Keeps <html data-theme> in sync with the saved preference.
 *
 * The inline script in <head> covers the first paint. But <html> lives in the [locale] layout,
 * so switching the language re-renders the root element without the attribute, and the inline
 * script does not run again. This component re-applies the theme before paint on every mount,
 * follows OS changes in "system" mode and picks up changes made in other tabs.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readThemePreference());
  }, []);

  useEffect(() => {
    const reapply = () => applyTheme(readThemePreference());
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) reapply();
    };
    const query = systemDarkQuery();
    query.addEventListener('change', reapply);
    window.addEventListener('storage', onStorage);
    return () => {
      query.removeEventListener('change', reapply);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
