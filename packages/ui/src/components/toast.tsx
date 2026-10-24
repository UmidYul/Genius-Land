'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../cn';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms; 0 keeps the toast until dismissed. Errors stay longer by default. */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'tone'>> {
  id: number;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

// Status is never shown by colour alone: each tone has its own icon.
const tones: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: 'text-success' },
  info: { icon: Info, className: 'text-info' },
  warning: { icon: TriangleAlert, className: 'text-warning' },
  danger: { icon: CircleAlert, className: 'text-danger' },
};

export interface ToastProviderProps {
  children: ReactNode;
  /** Accessible label of the dismiss button — from the dictionary. */
  dismissLabel: string;
}

export function ToastProvider({ children, dismissLabel }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const tone = options.tone ?? 'success';
    const duration = options.duration ?? (tone === 'danger' ? 8000 : 4000);
    setItems((current) => [
      ...current.slice(-2),
      { id, tone, title: options.title, description: options.description, duration },
    ]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} dismissLabel={dismissLabel} />
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
  dismissLabel,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
  dismissLabel: string;
}) {
  const { icon: Icon, className } = tones[item.tone];

  useEffect(() => {
    if (!item.duration) return;
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <li
      role={item.tone === 'danger' ? 'alert' : 'status'}
      className="animate-gl-pop-in bg-surface text-fg pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl py-3 pe-1.5 ps-4 shadow-lg"
    >
      <Icon aria-hidden strokeWidth={2} className={cn('mt-0.5 size-5 shrink-0', className)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.description && <p className="text-fg-muted text-sm">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={dismissLabel}
        className="text-fg-muted hover:bg-surface-3 hover:text-fg -my-1 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-[background-color,color] duration-150"
      >
        <X className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  );
}
