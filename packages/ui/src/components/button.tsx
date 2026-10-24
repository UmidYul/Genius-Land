import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-solid text-on-solid shadow-sm hover:bg-primary-hover active:bg-primary-active',
  secondary: 'bg-surface text-fg shadow-sm hover:bg-surface-2 active:bg-surface-3',
  ghost: 'text-fg hover:bg-surface-3 active:bg-surface-3',
  danger: 'bg-danger-solid text-on-solid shadow-sm hover:opacity-90 active:opacity-100',
};

const sizes: Record<ButtonSize, string> = {
  // 40px on dense desktop screens, 44px (touch) by default.
  sm: 'h-10 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-11 gap-2 rounded-xl px-4 text-[0.9375rem]',
  icon: 'size-11 rounded-xl',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the press scale — for buttons in places where motion would distract. */
  static?: boolean;
  className?: string;
}

/** Button classes, for links and other elements that must look like a button. */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  static: isStatic = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap select-none',
    'transition-[background-color,color,opacity,box-shadow,scale] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none',
    '[&_svg]:size-[1.125rem] [&_svg]:shrink-0',
    !isStatic && 'active:scale-[0.96]',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {
  loading?: boolean;
  /** Icon before the text. */
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  static: isStatic,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, static: isStatic, className })}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" strokeWidth={2} aria-hidden /> : icon}
      {children}
    </button>
  );
}
