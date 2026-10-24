import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv({ path: new URL('./.env', import.meta.url), quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST ?? '';
// Tests never use the real secret; a fixed one keeps them reproducible.
const testSecret = 'test-secret-test-secret-test-secret-0123456789';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          env: { AUTH_SECRET: testSecret },
          exclude: ['**/*.int.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['packages/*/src/**/*.int.test.ts', 'apps/*/src/**/*.int.test.ts'],
          globalSetup: ['./test/integration-setup.ts'],
          // Integration tests share one database: run files one after another.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test', AUTH_SECRET: testSecret },
        },
      },
    ],
  },
});
