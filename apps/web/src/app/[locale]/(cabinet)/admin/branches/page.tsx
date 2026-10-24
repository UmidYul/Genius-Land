import { can, listBranches } from '@gl/core';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@gl/ui';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { BranchFormDialog } from './branch-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.branches' });
  return { title: t('title') };
}

export default async function BranchesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('admin.branch.view');
  const branches = await listBranches(ctx);
  const t = await getTranslations('admin.branches');
  const canManage = can(actor, 'admin.branch.manage');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t('title')} description={t('subtitle')} />
        {canManage && <BranchFormDialog />}
      </div>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('nameUz')}</TableHeaderCell>
              <TableHeaderCell>{t('nameRu')}</TableHeaderCell>
              <TableHeaderCell>{t('address')}</TableHeaderCell>
              <TableHeaderCell>{t('code')}</TableHeaderCell>
              {canManage && <TableHeaderCell className="w-px" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="whitespace-nowrap font-semibold">{branch.nameUz}</TableCell>
                <TableCell className="whitespace-nowrap">{branch.nameRu}</TableCell>
                <TableCell className="text-fg-muted min-w-56">{branch.address ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{branch.code}</TableCell>
                {canManage && (
                  <TableCell>
                    <BranchFormDialog branch={branch} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
