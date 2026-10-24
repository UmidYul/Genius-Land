import { buttonVariants } from '@gl/ui';
import { FileSpreadsheet } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

/**
 * Download of the current list as Excel. The export endpoint applies the same filters and the
 * same permissions as the page.
 */
export async function ExportButton({
  kind,
  searchParams,
}: {
  kind: 'classes' | 'staff' | 'students' | 'guardians';
  searchParams: Record<string, string | undefined>;
}) {
  const t = await getTranslations('common');
  const query = new URLSearchParams({ locale: await getLocale() });
  for (const [key, value] of Object.entries(searchParams))
    if (value && key !== 'page') query.set(key, value);
  return (
    <a
      href={`/api/export/${kind}?${query.toString()}`}
      className={buttonVariants({ variant: 'secondary' })}
      download
    >
      <FileSpreadsheet strokeWidth={1.75} aria-hidden />
      {t('exportExcel')}
    </a>
  );
}
