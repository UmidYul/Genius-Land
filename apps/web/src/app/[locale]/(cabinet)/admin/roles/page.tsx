import { isPermissionCode, isRoleCode, listRolesWithPermissions, splitPermission } from '@gl/core';
import { Card, CardDescription, CardHeader, CardTitle } from '@gl/ui';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.roles' });
  return { title: t('title') };
}

/** Read-only: roles, their permissions and scopes as stored in the database. */
export default async function RolesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx } = await requirePermission('admin.role.view');
  const roles = await listRolesWithPermissions(ctx);
  const t = await getTranslations('admin.roles');
  const tRoles = await getTranslations('roles');
  const tScopes = await getTranslations('scopes');
  const tAccess = await getTranslations('access');

  const label = (code: string) => {
    if (!isPermissionCode(code)) return code;
    const { module, resource, action } = splitPermission(code);
    return `${tAccess(`modules.${module}` as 'modules.admin')} · ${tAccess(`resources.${resource}` as 'resources.user')} · ${tAccess(`actions.${action}` as 'actions.view')}`;
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle>{isRoleCode(role.code) ? tRoles(role.code) : role.code}</CardTitle>
              <CardDescription>
                {t('meta', { rank: role.rank, users: role._count.assignments })}
              </CardDescription>
            </CardHeader>
            {role.permissions.length === 0 ? (
              <p className="text-fg-muted text-sm">{t('noPermissions')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {role.permissions.map((p) => (
                  <li
                    key={p.permissionCode}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
                  >
                    <span className="min-w-0">
                      {label(p.permissionCode)}
                      <span className="text-fg-muted ms-2 font-mono text-xs">
                        {p.permissionCode}
                      </span>
                    </span>
                    <span className="bg-surface-3 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold">
                      {tScopes(p.scope)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
