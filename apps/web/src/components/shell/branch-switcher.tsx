'use client';

import { cn } from '@gl/ui';
import { Building2, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { selectBranchAction } from '@/app/[locale]/(cabinet)/actions';

/**
 * For users with more than one branch (founder, accountant with both branches).
 * "All branches" only for those who may see all. The choice is saved in the profile.
 */
export function BranchSwitcher({
  branches,
  allowAll,
  value,
  className,
}: {
  branches: { id: string; name: string }[];
  allowAll: boolean;
  value: string;
  className?: string;
}) {
  const t = useTranslations('topbar');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={cn('relative flex min-w-0 items-center', className)}>
      <span className="sr-only">{t('branch')}</span>
      <Building2
        aria-hidden
        strokeWidth={1.75}
        className="text-fg-muted pointer-events-none absolute start-3 size-4"
      />
      <select
        value={value}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await selectBranchAction(next);
            router.refresh();
          });
        }}
        className="bg-surface-3 text-fg hover:bg-surface-2 h-10 w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl pe-9 ps-9 text-sm font-semibold transition-[background-color] duration-150 disabled:opacity-60 sm:max-w-64"
      >
        {allowAll && <option value="all">{t('allBranches')}</option>}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.75}
        className="text-fg-muted pointer-events-none absolute end-3 size-4"
      />
    </label>
  );
}
