'use client';

import { ToastProvider } from '@gl/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  return <ToastProvider dismissLabel={t('close')}>{children}</ToastProvider>;
}
