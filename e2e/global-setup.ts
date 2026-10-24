import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { outboxFile } from './paths';
import migrateTestDatabase from '../test/integration-setup';

/** Fresh test database with the seed, relaxed code limits, and an empty outbox. */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set (see .env.example).');
  migrateTestDatabase();
  process.env.DATABASE_URL = url;

  const { PrismaClient } = await import('@gl/db');
  const { updateSetting, authSettings } = await import('@gl/core');
  const { seedBranchesAndAccess, seedDemoUsers } = await import('../packages/core/src/seed/seed');
  const { resetDatabase } = await import('../packages/core/src/testing/fixtures');
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await resetDatabase(db);
    await seedBranchesAndAccess(db);
    await seedDemoUsers(db);
    // Flows repeat sign-ins of the same demo accounts in quick succession.
    const system = { actorId: null };
    await updateSetting(db, authSettings.codeResendSeconds, { value: 1, actor: system });
    await updateSetting(db, authSettings.codesPerUserPerHour, { value: 100, actor: system });
  } finally {
    await db.$disconnect();
  }

  mkdirSync(dirname(outboxFile), { recursive: true });
  writeFileSync(outboxFile, '');
}
