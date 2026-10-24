import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'bg-surface flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center shadow-sm',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className="bg-primary-soft text-primary-soft-fg mb-1 flex size-12 items-center justify-center rounded-2xl [&_svg]:size-6"
        >
          {icon}
        </div>
      )}
      <h2 className="font-head text-fg text-base font-semibold">{title}</h2>
      {description && <p className="text-fg-muted max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
