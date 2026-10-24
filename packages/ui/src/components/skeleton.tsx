import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Placeholder block while data loads. Hidden from screen readers — announce loading elsewhere. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-gl-pulse bg-surface-3 rounded-lg', className)}
      {...props}
    />
  );
}
