import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { outboxFile } from './e2e/paths';

loadEnv({ path: new URL('./.env', import.meta.url), quiet: true });

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

/**
 * End-to-end tests run against the TEST database (re-seeded in e2e/global-setup.ts), never the
 * development one. Sign-in codes are read from the console providers' outbox file.
 * One worker: the flows share demo accounts, and a new code invalidates the previous one.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    // The smallest phone the cabinet must support: 360 px wide.
    { name: 'phone-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm --filter @gl/web exec next dev --port ${port}`,
    url: `${baseURL}/uz/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      DEV_OUTBOX_FILE: outboxFile,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
