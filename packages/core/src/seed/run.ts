/**
 * `pnpm db:seed` — idempotent: safe to run many times.
 * Always: permissions, roles and branches. Demo users: only outside production
 * (or with SEED_DEMO=1), all marked "(демо)" and with phones that cannot belong to anyone.
 */
import { PrismaClient } from '@gl/db';
import { DEMO_PASSWORD, demoUsers, seedBranchesAndAccess, seedDemoUsers } from './seed';

const prisma = new PrismaClient();

async function main() {
  await seedBranchesAndAccess(prisma);
  console.log('seed: permissions, roles, branches — ok');

  const withDemo = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO === '1';
  if (withDemo) {
    await seedDemoUsers(prisma);
    console.log(`seed: ${demoUsers.length} demo users — ok (staff password: ${DEMO_PASSWORD})`);
    for (const user of demoUsers.filter((u) => u.staff)) {
      console.log(`  ${user.phone}  ${user.fullName}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
