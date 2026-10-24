import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { controlClasses, describedBy, Field } from './field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Digits that change or get compared (sums, counts) use tabular figures. */
  numeric?: boolean;
  containerClassName?: string;
}

export function Input({
  id,
  label,
  hint,
  error,
  numeric,
  required,
  className,
  containerClassName,
  ...props
}: InputProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClasses, numeric && 'tabular-nums', className)}
        {...props}
      />
    </Field>
  );
}
