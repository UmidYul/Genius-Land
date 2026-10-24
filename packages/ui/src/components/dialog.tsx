'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Accessible label of the close button — comes from the dictionary. */
  closeLabel: string;
  /** Buttons row at the bottom. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Modal dialog on the native <dialog> element: focus trap, Esc and the top layer come from the
 * browser. On phones it sits at the bottom of the screen, within thumb reach.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  footer,
  children,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'bg-surface text-fg m-0 mt-auto w-full max-w-none rounded-t-3xl p-0 shadow-lg',
        'sm:m-auto sm:max-w-md sm:rounded-3xl',
        'backdrop:bg-overlay backdrop:animate-gl-fade-in open:animate-gl-pop-in',
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
            <h2 id={titleId} className="font-head text-lg font-semibold leading-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-fg-muted text-sm">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="text-fg-muted hover:bg-surface-3 hover:text-fg -me-2 -mt-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-[background-color,color] duration-150"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {children}
        {footer && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
