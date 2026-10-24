'use client';

import { locales, type Locale } from '@gl/i18n';
import { cn } from '@gl/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { rememberLocaleAction } from '@/app/[locale]/(cabinet)/actions';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Segmented UZ / RU switch: both options are visible, one tap to change.
 * In the cabinet (`remember`) the choice is also saved as the user's interface language.
 */
export function LocaleSwitcher({ remember = false }: { remember?: boolean }) {
  const t = useTranslations();
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();

  const change = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      if (remember) await rememberLocaleAction(locale);
      // @ts-expect-error -- params of the current route always match the current pathname.
      router.replace({ pathname, params }, { locale, scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label={t('topbar.language')}
      aria-busy={pending || undefined}
      className="bg-surface-3 inline-flex h-10 shrink-0 items-center rounded-xl p-1"
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => change(locale)}
            aria-pressed={active}
            aria-label={t(`locale.${locale}`)}
            className={cn(
              'inline-flex h-8 min-w-10 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-bold uppercase tracking-wide',
              'transition-[background-color,color,box-shadow] duration-150 ease-out',
              active ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
