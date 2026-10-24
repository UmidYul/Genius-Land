import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Brings the test database to the latest migration before integration tests run.
 * The test database is separate from the development one (see docker/postgres-init.sql).
 */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Copy .env.example to .env and run `docker compose up -d`.',
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must point to a separate database: tests truncate tables.');
  }

  const dbPackage = fileURLToPath(new URL('../packages/db/', import.meta.url));
  const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
  const prismaCli = require.resolve('prisma/build/index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: dbPackage,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
