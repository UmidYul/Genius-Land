import { defaultLocale, locales } from '@gl/i18n';
import { defineRouting } from 'next-intl/routing';

// Every URL carries the language: /uz/…, /ru/…. Uzbek (Latin) is the default.
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
