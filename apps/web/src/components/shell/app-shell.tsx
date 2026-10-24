import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '../logo';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { NavList } from './nav-list';
import { ProfileMenu } from './profile-menu';

/**
 * Staff cabinet frame. Desktop (≥1024px): fixed sidebar + top bar.
 * Phone and tablet: top bar with a menu button that opens the slide-out menu.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();

  return (
    <div className="min-h-dvh lg:ps-64">
      <a
        href="#main"
        className="bg-surface text-fg sr-only z-50 rounded-xl px-4 py-3 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t('common.skipToContent')}
      </a>

      <aside className="bg-surface fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-6 p-3 shadow-sm lg:flex">
        <Link href="/" className="flex h-14 items-center rounded-xl px-2">
          <Logo priority />
        </Link>
        <nav aria-label={t('nav.mainMenu')}>
          <NavList />
        </nav>
      </aside>

      <header className="border-border-soft bg-bg/85 sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <MobileNav />
          <Link href="/" className="flex min-w-0 items-center rounded-xl lg:hidden">
            <Logo size={36} priority className="min-w-0 [&>span:last-child]:max-[359px]:hidden" />
          </Link>
          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <LocaleSwitcher />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
