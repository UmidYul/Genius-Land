import { can, listCatalog, type CatalogKind } from '@gl/core';
import { Button, Card, CardDescription, CardHeader, CardTitle, cn } from '@gl/ui';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { archiveCatalogAction } from '../actions';
import { CatalogDialog } from './catalog-forms';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'school.catalog' }))('title') };
}

export default async function CatalogPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('school.subject.view');
  const t = await getTranslations('school.catalog');
  const canManage = can(actor, 'school.subject.manage');
  const [subjects, directions] = await Promise.all([
    listCatalog(ctx, 'subject', canManage),
    listCatalog(ctx, 'direction', canManage),
  ]);

  const renderSection = (kind: CatalogKind, items: typeof subjects) => (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{t(`${kind}.title`)}</CardTitle>
          <CardDescription>{t(`${kind}.text`)}</CardDescription>
        </div>
        {canManage && <CatalogDialog kind={kind} />}
      </CardHeader>
      {items.length === 0 ? (
        <p className="text-fg-muted text-sm">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'bg-surface-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2',
                item.archivedAt && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {locale === 'ru' ? item.nameRu : item.nameUz}
                </p>
                <p className="text-fg-muted text-xs">
                  {locale === 'ru' ? item.nameUz : item.nameRu}
                </p>
              </div>
              {item.archivedAt && (
                <span className="text-fg-muted text-xs font-semibold">{t('archived')}</span>
              )}
              {canManage && (
                <>
                  <CatalogDialog kind={kind} item={item} />
                  <form action={archiveCatalogAction}>
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="archived" value={item.archivedAt ? '0' : '1'} />
                    <Button type="submit" size="sm" variant="ghost">
                      {item.archivedAt ? t('restore') : t('archive')}
                    </Button>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {renderSection('subject', subjects)}
        {renderSection('direction', directions)}
      </div>
    </>
  );
}
