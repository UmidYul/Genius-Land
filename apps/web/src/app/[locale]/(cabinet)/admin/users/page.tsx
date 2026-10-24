import { can, formatPhone, isRoleCode, listUsers, roleCodes, type RoleCode } from '@gl/core';
import {
  buttonVariants,
  EmptyState,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import { Plus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SubmitButton } from '@/components/form';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth';
import { UserStatusBadge } from './status-badge';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.users' });
  return { title: t('title') };
}

type Search = { q?: string; role?: string; branch?: string; status?: string; page?: string };

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.user.view');
  const search = await searchParams;
  const t = await getTranslations('admin.users');
  const tRoles = await getTranslations('roles');
  const tCommon = await getTranslations('common');

  const roleCode = search.role && isRoleCode(search.role) ? (search.role as RoleCode) : undefined;
  const status =
    search.status === 'BLOCKED' || search.status === 'ACTIVE' ? search.status : undefined;
  const branches = await ctx.db.branch.findMany({ orderBy: { createdAt: 'asc' } });
  const { users, total, page, pageSize } = await listUsers(ctx, {
    query: search.q,
    roleCode,
    branchId: search.branch || undefined,
    status,
    page: Number(search.page) || 1,
  });
  const branchName = (id: string) => {
    const b = branches.find((x) => x.id === id);
    return b ? (locale === 'ru' ? b.nameRu : b.nameUz) : '';
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle', { count: total })} />
        {can(actor, 'admin.user.manage') && (
          <Link href="/admin/users/new" className={buttonVariants()}>
            <Plus strokeWidth={2} aria-hidden />
            {t('create')}
          </Link>
        )}
      </div>

      <form className="bg-surface mb-4 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <Input
          id="q"
          name="q"
          type="search"
          label={tCommon('search')}
          placeholder={t('searchPlaceholder')}
          defaultValue={search.q}
        />
        <Select
          id="role"
          name="role"
          label={t('role')}
          defaultValue={roleCode ?? ''}
          placeholder={tCommon('all')}
          options={roleCodes.map((code) => ({ value: code, label: tRoles(code) }))}
        />
        <Select
          id="branch"
          name="branch"
          label={t('branch')}
          defaultValue={search.branch ?? ''}
          placeholder={tCommon('all')}
          options={branches.map((b) => ({
            value: b.id,
            label: locale === 'ru' ? b.nameRu : b.nameUz,
          }))}
        />
        <Select
          id="status"
          name="status"
          label={t('status')}
          defaultValue={status ?? ''}
          placeholder={tCommon('all')}
          options={[
            { value: 'ACTIVE', label: t('statusActive') },
            { value: 'BLOCKED', label: t('statusBlocked') },
          ]}
        />
        <SubmitButton variant="secondary">{tCommon('apply')}</SubmitButton>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={<Users strokeWidth={1.75} />} title={t('empty')} />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('fullName')}</TableHeaderCell>
                <TableHeaderCell>{t('phone')}</TableHeaderCell>
                <TableHeaderCell>{t('roles')}</TableHeaderCell>
                <TableHeaderCell>{t('status')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="min-w-48">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-fg font-semibold hover:underline"
                    >
                      {user.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatPhone(user.phone)}
                  </TableCell>
                  <TableCell className="min-w-56">
                    <ul className="flex flex-col gap-0.5">
                      {user.roleAssignments.map((a) => (
                        <li key={a.id}>
                          <span className="font-medium">
                            {isRoleCode(a.role.code) ? tRoles(a.role.code) : a.role.code}
                          </span>
                          {a.branches.length > 0 && (
                            <span className="text-fg-muted">
                              {' · '}
                              {a.branches.map((b) => branchName(b.branchId)).join(', ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={user.status} lockedUntil={user.lockedUntil} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        searchParams={search}
        basePath="/admin/users"
      />
    </>
  );
}
