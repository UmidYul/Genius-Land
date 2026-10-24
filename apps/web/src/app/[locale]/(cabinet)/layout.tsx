import { prisma } from '@gl/db';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { AppShell } from '@/components/shell/app-shell';
import { requireAuth } from '@/lib/auth';
import { PasswordForm } from './profile/password-form';

export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const { actor, ctx } = await requireAuth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { mustChangePassword: true },
  });

  // A temporary password from the superadmin must be replaced before anything else.
  if (user.mustChangePassword) {
    const t = await getTranslations('profile');
    return (
      <AppShell actor={actor} ctx={ctx}>
        <div className="mx-auto max-w-md">
          <PageHeader title={t('mustChangeTitle')} description={t('mustChangeText')} />
          <PasswordForm />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell actor={actor} ctx={ctx}>
      {children}
    </AppShell>
  );
}
