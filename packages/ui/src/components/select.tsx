import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../cn';
import { controlClasses, describedBy, Field } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: ReactNode;
  options: SelectOption[];
  /** Text of the empty first option; omit to force a value. */
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

/**
 * Native select: the phone's own picker is the fastest and most accessible choice
 * for teachers working one-handed.
 */
export function Select({
  id,
  label,
  options,
  placeholder,
  hint,
  error,
  required,
  className,
  containerClassName,
  ...props
}: SelectProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlClasses, 'cursor-pointer appearance-none pe-10', className)}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className="text-fg-muted pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2"
        />
      </div>
    </Field>
  );
}
