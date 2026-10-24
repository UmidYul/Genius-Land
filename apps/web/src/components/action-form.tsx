'use client';

import { Button, Dialog } from '@gl/ui';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import type { FormState } from '@/lib/action-result';
import { Form, FormAlert, SubmitButton } from './form';

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * A form bound to a server action, with the form-level error / success message.
 * `children` receives the state so fields can show their own errors.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  onDone,
  hideSuccess,
}: {
  action: Action;
  submitLabel: string;
  children: (state: FormState) => ReactNode;
  className?: string;
  onDone?: (state: FormState) => void;
  hideSuccess?: boolean;
}) {
  const [state, formAction, formActionPending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) onDone?.(state);
  }, [state, onDone]);
  return (
    <Form
      action={formAction}
      pending={formActionPending}
      className={className ?? 'flex flex-col gap-4'}
    >
      <FormAlert tone="error">{state.error}</FormAlert>
      {!hideSuccess && <FormAlert tone="success">{state.ok ? state.message : null}</FormAlert>}
      {children(state)}
      <SubmitButton className="self-start">{submitLabel}</SubmitButton>
    </Form>
  );
}

/** A button that opens a dialog with an action form; the dialog closes on success. */
export function DialogForm({
  trigger,
  title,
  description,
  action,
  submitLabel,
  children,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: string;
  action: Action;
  submitLabel: string;
  children: (state: FormState) => ReactNode;
}) {
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  // Remount the form each time the dialog opens, so old errors do not linger.
  const [key, setKey] = useState(0);
  return (
    <>
      {trigger(() => {
        setKey((k) => k + 1);
        setOpen(true);
      })}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        closeLabel={tCommon('close')}
      >
        <ActionForm
          key={key}
          action={action}
          submitLabel={submitLabel}
          onDone={() => setOpen(false)}
          hideSuccess
        >
          {children}
        </ActionForm>
      </Dialog>
    </>
  );
}

export function OpenButton({
  onClick,
  children,
  variant = 'primary',
  icon,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
}) {
  return (
    <Button
      variant={variant}
      size={variant === 'ghost' ? 'sm' : 'md'}
      icon={icon}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
