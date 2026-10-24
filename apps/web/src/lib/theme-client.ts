'use client';

import { THEME_STORAGE_KEY, themePreferences, type ThemePreference } from './theme';

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return themePreferences.includes(stored as ThemePreference)
      ? (stored as ThemePreference)
      : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

export const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && systemDarkQuery().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
