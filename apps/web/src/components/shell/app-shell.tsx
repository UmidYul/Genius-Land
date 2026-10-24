import {
  canSwitchBranch,
  countApprovalQueue,
  can,
  type Actor,
  type ServiceContext,
} from '@gl/core';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '../logo';
import { BranchSwitcher } from './branch-switcher';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { navItems } from './nav-items';
import { NavList } from './nav-list';
import { ProfileMenu } from './profile-menu';

/** Hrefs of the menu items this actor may see — computed on the server from permissions. */
function visibleHrefs(actor: Actor): string[] {
  const dev = process.env.NODE_ENV !== 'production';
  return navItems
    .filter((item) => (!item.devOnly || dev) && (!item.permission || can(actor, item.permission)))
    .map((item) => item.href);
}

/**
 * Staff cabinet frame. Desktop (≥1024px): fixed sidebar + top bar.
 * Phone and tablet: top bar with a menu button that opens the slide-out menu.
 */
export async function AppShell({
  actor,
  ctx,
  children,
}: {
  actor: Actor;
  ctx: ServiceContext;
  children: ReactNode;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const allowed = visibleHrefs(actor);
  const badges = { '/approvals': await countApprovalQueue(ctx) };
  const branchName = (b: Actor['branches'][number]) => (locale === 'ru' ? b.nameRu : b.nameUz);
  const branches = actor.branches.map((b) => ({ id: b.id, name: branchName(b) }));
  const activeBranch = actor.branches.find((b) => b.id === actor.activeBranchId);
  const roles = actor.roleCodes.map((code) => t(`roles.${code}`));

  const switcher = canSwitchBranch(actor) ? (
    <BranchSwitcher
      branches={branches}
      allowAll={actor.hasAllBranches}
      value={actor.activeBranchId ?? 'all'}
    />
  ) : null;

  return (
    <div className="min-h-dvh lg:ps-64">
      <a
        href="#main"
        className="bg-surface text-fg sr-only z-50 rounded-xl px-4 py-3 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t('common.skipToContent')}
      </a>

      <aside className="bg-surface fixed inset-y-0 start-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto p-3 shadow-sm lg:flex">
        <Link href="/" className="flex h-14 shrink-0 items-center rounded-xl px-2">
          <Logo priority />
        </Link>
        <nav aria-label={t('nav.mainMenu')}>
          <NavList allowed={allowed} badges={badges} />
        </nav>
      </aside>

      <header className="border-border-soft bg-bg/85 sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
          <MobileNav allowed={allowed} badges={badges} switcher={switcher} />
          <Link href="/" className="flex min-w-0 items-center rounded-xl lg:hidden">
            <Logo size={36} priority className="min-w-0 max-sm:[&>span:last-child]:hidden" />
          </Link>
          {switcher && <div className="hidden min-w-0 sm:block">{switcher}</div>}
          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <LocaleSwitcher remember />
            <ProfileMenu
              name={actor.fullName}
              roles={roles}
              branch={activeBranch ? branchName(activeBranch) : null}
            />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
