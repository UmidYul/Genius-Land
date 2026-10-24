import { can, getUser } from '@gl/core';
import { formatDateTime } from '@gl/core/time';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';
import { roleOptions } from '../role-options';
import { UserStatusBadge } from '../status-badge';
import { EditAssignmentsForm, EditProfileForm, UserCommands } from '../user-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.users' });
  return { title: t('userTitle') };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.user.view');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getUser(ctx, id);
  if (!user) notFound();
  const t = await getTranslations('admin.users');
  const branches = await ctx.db.branch.findMany({ orderBy: { createdAt: 'asc' } });
  const canManage = can(actor, 'admin.user.manage');
  const locked = !!user.lockedUntil && user.lockedUntil.getTime() > Date.now();

  return (
    <>
      <Link
        href="/admin/users"
        className="text-fg-muted mb-2 inline-block rounded-lg text-sm font-medium hover:underline"
      >
        {t('backToList')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={user.fullName}
          description={
            user.lastLoginAt
              ? t('lastLogin', { time: formatDateTime(user.lastLoginAt) })
              : t('neverLoggedIn')
          }
        />
        <UserStatusBadge status={user.status} lockedUntil={user.lockedUntil} />
      </div>
      {canManage ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <EditProfileForm
            id={user.id}
            values={{
              fullName: user.fullName,
              phone: user.phone,
              email: user.email,
              locale: user.locale,
            }}
          />
          <div className="flex flex-col gap-4">
            <EditAssignmentsForm
              id={user.id}
              roles={roleOptions(actor)}
              branches={branches.map((b) => ({
                id: b.id,
                name: locale === 'ru' ? b.nameRu : b.nameUz,
              }))}
              initial={user.roleAssignments.map((a) => ({
                roleCode: a.role.code,
                branchIds: a.branches.map((b) => b.branchId),
              }))}
            />
            <UserCommands
              id={user.id}
              blocked={user.status === 'BLOCKED'}
              locked={locked}
              isSelf={user.id === actor.userId}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
