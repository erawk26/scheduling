/**
 * Local override config for running Playwright when the dev server
 * is already running on port 3025 (the default Next.js port).
 * Use: pnpm exec playwright test --config=playwright.local.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3025',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer block — rely on the already-running dev server on port 3025
});
