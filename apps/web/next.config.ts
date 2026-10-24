import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript sources.
  transpilePackages: ['@gl/core', '@gl/db', '@gl/i18n', '@gl/ui'],
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],
  // Lint runs once for the whole monorepo (`pnpm lint`), not again inside `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Excel imports are uploaded through a server action (files up to 5 MB).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default withNextIntl(config);
