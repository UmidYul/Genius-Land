import { buttonVariants, cn } from '@gl/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Previous / next links that keep the current filters in the query string. */
export async function Pagination({
  page,
  pageSize,
  total,
  searchParams,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
  /** Path of the list page without the locale, e.g. `/admin/users`. */
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const t = await getTranslations('common');
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') query.set(key, value);
    }
    query.set('page', String(target));
    return `${basePath}?${query.toString()}`;
  };
  const link = (target: number, disabled: boolean, children: React.ReactNode, label: string) =>
    disabled ? (
      <span
        aria-disabled
        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'opacity-40')}
      >
        {children}
      </span>
    ) : (
      <Link
        href={href(target)}
        aria-label={label}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        {children}
      </Link>
    );

  return (
    <nav aria-label={t('pagination')} className="mt-4 flex items-center justify-between gap-3">
      {link(page - 1, page <= 1, <ChevronLeft strokeWidth={2} aria-hidden />, t('previous'))}
      <p className="text-fg-muted text-sm tabular-nums">{t('pageOf', { page, pages })}</p>
      {link(page + 1, page >= pages, <ChevronRight strokeWidth={2} aria-hidden />, t('next'))}
    </nav>
  );
}
