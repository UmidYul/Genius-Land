import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export const fieldHintId = (id: string) => `${id}-hint`;
export const fieldErrorId = (id: string) => `${id}-error`;

/** Label + control + hint/error. The error replaces the hint and is announced. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-fg text-sm font-semibold">
        {label}
        {required && (
          <span aria-hidden className="text-danger ms-0.5">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={fieldErrorId(id)} role="alert" className="text-danger-fg text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldHintId(id)} className="text-fg-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control look: inputs and selects must be indistinguishable in height and border. */
export const controlClasses = cn(
  'h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3.5 text-[0.9375rem] text-fg',
  'placeholder:text-fg-muted/70',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'hover:border-border-strong',
  'focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20',
);

export function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  if (error) return fieldErrorId(id);
  if (hint) return fieldHintId(id);
  return undefined;
}
