'use client';

import { Button, cn, type ButtonProps } from '@gl/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';
import {
  createContext,
  startTransition,
  useContext,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';

const PendingContext = createContext<boolean | null>(null);

/**
 * A form that submits to a `useActionState` dispatch WITHOUT React's automatic reset.
 * With `<form action>` React 19 clears the fields after every submission, so a validation
 * error would wipe what the user typed. Here the fields keep their values; on success the
 * component decides what to do (close a dialog, navigate, show a message).
 */
export function Form({
  action,
  pending,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  action: (data: FormData) => void;
  pending: boolean;
}) {
  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}

/** Submit button that shows progress while its form's server action runs. */
export function SubmitButton({
  pending: pendingProp,
  ...props
}: Omit<ButtonProps, 'type' | 'loading'> & { pending?: boolean }) {
  const status = useFormStatus();
  const fromForm = useContext(PendingContext);
  const pending = pendingProp ?? fromForm ?? status.pending;
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
