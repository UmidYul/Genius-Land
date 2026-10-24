export const themePreferences = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof themePreferences)[number];

export const THEME_STORAGE_KEY = 'gl-theme';

/**
 * Runs in <head> before the first paint: applies the saved preference, resolving "system"
 * through prefers-color-scheme, so the page never flashes the wrong theme.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;
