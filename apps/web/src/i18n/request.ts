import { SCHOOL_TIME_ZONE } from '@gl/core/time';
import { messages } from '@gl/i18n';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: messages[locale],
    timeZone: SCHOOL_TIME_ZONE,
  };
});
