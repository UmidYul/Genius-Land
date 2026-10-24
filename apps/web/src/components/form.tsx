'use client';

import { Button, cn, type ButtonProps } from '@gl/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/** Submit button that shows progress while its form's server action runs. */
export function SubmitButton(props: Omit<ButtonProps, 'type' | 'loading'>) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} disabled={pending || props.disabled} {...props} />;
}

/** Form-level message. Status is shown by icon and text, never by colour alone. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm',
        tone === 'error' ? 'bg-danger-soft text-danger-fg' : 'bg-success-soft text-success-fg',
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2} className="mt-px size-[1.125rem] shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
