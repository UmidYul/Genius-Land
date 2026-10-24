import { cn, logoPath } from '@gl/ui';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

/**
 * School emblem. The JPEG has a white background inside a circle, so it is clipped to a circle:
 * on the dark theme the white disc itself is the light backing BRAND.md asks for.
 */
export function Logo({
  size = 40,
  withName = true,
  className,
  priority,
}: {
  size?: number;
  withName?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src={logoPath}
        alt={withName ? '' : t('appName')}
        width={size}
        height={size}
        priority={priority}
        className="shrink-0 rounded-full"
      />
      {withName && (
        <span className="font-head text-fg text-base font-semibold leading-none tracking-tight">
          {t('appName')}
        </span>
      )}
    </span>
  );
}
