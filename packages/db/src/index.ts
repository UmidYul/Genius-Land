import { PrismaClient, type Prisma } from '@prisma/client';

// Generated model types and enums (User, Session, PermissionScope, …).
export * from '@prisma/client';

/** Either the root client or a transaction client — domain functions accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __glPrisma?: PrismaClient };

/**
 * One client per process. In development Next.js reloads modules on every change,
 * so the instance is kept on globalThis to avoid exhausting connections.
 */
export const prisma: PrismaClient =
  globalForPrisma.__glPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'test'
        ? []
        : process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__glPrisma = prisma;
