import { can, listApprovalQueue, listMyApprovalRequests } from '@gl/core';
import { formatDateTime } from '@gl/core/time';
import { Button, Card, EmptyState } from '@gl/ui';
import { ClipboardCheck } from 'lucide-react';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { requirePermission } from '@/lib/auth';
import { cancelAction } from './actions';
import { DecisionForm } from './decision-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'approvals' });
  return { title: t('title') };
}

/** Payload is module data; until modules define their own views it is shown as key: value. */
function PayloadView({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    <dl className="text-fg-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {Object.entries(payload as Record<string, unknown>).map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-xs leading-5">{key}</dt>
          <dd className="text-fg min-w-0 break-words">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ctx, actor } = await requirePermission('approvals.request.view');
  const t = await getTranslations('approvals');
  const canDecide = can(actor, 'approvals.request.decide');
  const canCreate = can(actor, 'approvals.request.create');
  const [queue, mine] = await Promise.all([
    canDecide ? listApprovalQueue(ctx) : Promise.resolve([]),
    canCreate ? listMyApprovalRequests(ctx) : Promise.resolve([]),
  ]);
  const branchName = (b: { nameUz: string; nameRu: string } | null) =>
    b ? (locale === 'ru' ? b.nameRu : b.nameUz) : t('schoolWide');

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} />
      {canDecide && (
        <section className="mb-8 flex flex-col gap-3">
          <h2 className="font-head text-lg font-semibold">{t('queue')}</h2>
          {queue.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck strokeWidth={1.75} />}
              title={t('queueEmpty')}
              description={t('queueEmptyText')}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {queue.map((request) => (
                <li key={request.id}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-mono text-sm font-semibold">{request.type}</p>
                      <p className="text-fg-muted text-xs tabular-nums">
                        {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm">
                      {t('requestedBy', {
                        name: request.requestedBy.fullName,
                        branch: branchName(request.branch),
                      })}
                    </p>
                    {request.reason && <p className="text-fg-muted text-sm">{request.reason}</p>}
                    <PayloadView payload={request.payload} />
                    <DecisionForm
                      id={request.id}
                      disabled={request.requestedById === actor.userId}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {canCreate && (
        <section className="flex flex-col gap-3">
          <h2 className="font-head text-lg font-semibold">{t('mine')}</h2>
          {mine.length === 0 ? (
            <p className="text-fg-muted text-sm">{t('mineEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {mine.map((request) => (
                <li
                  key={request.id}
                  className="bg-surface flex flex-wrap items-center gap-3 rounded-xl p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{request.type}</p>
                    <p className="text-fg-muted text-xs tabular-nums">
                      {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <span className="bg-surface-3 rounded-lg px-2 py-1 text-xs font-semibold">
                    {t(`status.${request.status}`)}
                  </span>
                  {request.status === 'PENDING' && (
                    <form action={cancelAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t('cancel')}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
