import { cn } from '@gl/ui';
import { Ban, CircleCheck, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Account state, shown by icon and text — not by colour alone. */
export function UserStatusBadge({
  status,
  lockedUntil,
}: {
  status: 'ACTIVE' | 'BLOCKED';
  lockedUntil: Date | null;
}) {
  const t = useTranslations('admin.users');
  const locked = status === 'ACTIVE' && lockedUntil && lockedUntil.getTime() > Date.now();
  const [Icon, label, tone] =
    status === 'BLOCKED'
      ? [Ban, t('statusBlocked'), 'bg-danger-soft text-danger-fg']
      : locked
        ? [Lock, t('statusLocked'), 'bg-warning-soft text-warning-fg']
        : [CircleCheck, t('statusActive'), 'bg-success-soft text-success-fg'];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold',
        tone,
      )}
    >
      <Icon aria-hidden strokeWidth={2} className="size-3.5" />
      {label}
    </span>
  );
}
