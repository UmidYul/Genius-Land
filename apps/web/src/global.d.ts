import type { Locale, Messages } from '@gl/i18n';

// Type-checked translation keys: t('nav.home') compiles, t('nav.hom') does not.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
