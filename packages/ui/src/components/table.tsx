import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../cn';

/** Scroll container: wide tables scroll horizontally inside it, never the whole page. */
export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface w-full overflow-x-auto rounded-2xl shadow-sm', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-2', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:last-child]:border-b-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-border-soft hover:bg-surface-2 border-b transition-[background-color] duration-150',
        className,
      )}
      {...props}
    />
  );
}

interface AlignProps {
  /** Right-aligned tabular digits for sums, counts and grades. */
  numeric?: boolean;
}

export function TableHeaderCell({
  className,
  numeric,
  scope = 'col',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & AlignProps) {
  return (
    <th
      scope={scope}
      className={cn(
        'text-fg-muted h-11 whitespace-nowrap px-4 text-start align-middle text-xs font-semibold uppercase tracking-wide',
        numeric && 'text-end',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & AlignProps) {
  return (
    <td
      className={cn(
        'text-fg h-12 px-4 align-middle',
        numeric && 'whitespace-nowrap text-end tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
