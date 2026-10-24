/**
 * Seed for local development. Must stay idempotent: safe to run many times.
 *
 * Stage 0 has no business data, so there is nothing to insert yet. Settings are not seeded on
 * purpose: their defaults live in the settings registry (`@gl/core`), and a stored row would
 * freeze a default that may change later. Later stages add demo records here — every one of
 * them must be clearly marked as demo data (never real names, grades or sums).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedStep = { name: string; run: (db: PrismaClient) => Promise<void> };

const steps: SeedStep[] = [];

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  for (const step of steps) {
    await step.run(prisma);
    console.log(`seed: ${step.name} — ok`);
  }
  console.log(`seed: done (${steps.length} steps)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
