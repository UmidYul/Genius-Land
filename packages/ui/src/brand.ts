/**
 * Brand values needed outside CSS (browser chrome colour in <meta name="theme-color">).
 * They mirror docs/BRAND.md: light `bg` and the dark theme-color. Components use CSS tokens instead.
 */
export const browserThemeColor = {
  light: '#F2F7F5',
  dark: '#0B1512',
} as const;

/** Logo file served by the web app (copy of src/images/brand/logo-genius-land.jpg). */
export const logoPath = '/brand/logo-genius-land.jpg';
