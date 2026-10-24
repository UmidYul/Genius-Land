import { buttonVariants, EmptyState } from '@gl/ui';
import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4">
      <EmptyState
        className="w-full"
        icon={<SearchX strokeWidth={1.75} />}
        title={t('errors.NOT_FOUND')}
        action={
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            {t('auth.toHome')}
          </Link>
        }
      />
    </main>
  );
}
