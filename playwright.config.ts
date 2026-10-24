import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
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
    url: `${baseURL}/uz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
