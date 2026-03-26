/**
 * Auth fixture for Playwright E2E tests.
 *
 * Sets the Better Auth session cookie and intercepts the session endpoint
 * so dashboard pages render without a real auth backend.
 */

import { test as base, type Page } from '@playwright/test';

const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test User',
  email: 'test@keagenda.com',
  emailVerified: true,
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const TEST_SESSION = {
  id: 'test-session-id',
  userId: TEST_USER.id,
  token: 'test-session-token',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Injects auth cookie + mocks the session endpoint. */
export async function setupAuth(page: Page) {
  // Set the session cookie that middleware checks
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Mock the Better Auth session endpoint
  await page.route('**/api/auth/**', async (route) => {
    const url = route.request().url();

    if (url.includes('get-session') || url.includes('session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: TEST_USER, session: TEST_SESSION }),
      });
    }

    // Let other auth routes pass through
    return route.continue();
  });
}

/** Mock all external API routes with sensible defaults. */
export async function mockAPIs(page: Page) {
  // Weather API
  await page.route('**/api/weather/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        forecasts: [],
        location: { lat: 40.0, lon: -74.0 },
      }),
    });
  });

  // Route optimization API
  await page.route('**/api/routes/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ optimized: [], distance: 0, duration: 0 }),
    });
  });

  // Geocode API
  await page.route('**/api/geocode**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ lat: 40.0, lon: -74.0 }),
    });
  });

  // Agent chat API
  await page.route('**/api/agent/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: 'Hello! I am your scheduling assistant. How can I help?',
        skill: null,
      }),
    });
  });

  // Email API
  await page.route('**/api/email/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, messageId: 'mock-msg-id' }),
    });
  });

  // Messaging webhook/setup
  await page.route('**/api/messaging/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Credits API
  await page.route('**/api/credits**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ used: 10, limit: 500, remaining: 490 }),
    });
  });

  // Schedule suggestions API
  await page.route('**/api/schedule/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] }),
    });
  });
}

/**
 * Extended test fixture with auth + API mocking pre-configured.
 * Use `authPage` for any test that needs authenticated dashboard access.
 */
export const test = base.extend<{ authPage: Page }>({
  authPage: async ({ page }, use) => {
    await setupAuth(page);
    await mockAPIs(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { TEST_USER, TEST_SESSION };
