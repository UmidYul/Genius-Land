import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';

/** Frame of the sign-in pages: emblem on top, a single card, language switch in the corner. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <div className="flex h-16 items-center justify-end">
        <LocaleSwitcher />
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 pb-16">
        <Logo size={96} withName={false} priority />
        {children}
      </main>
    </div>
  );
}
