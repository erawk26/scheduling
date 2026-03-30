/**
 * Auth fixture for Playwright E2E tests.
 *
 * Sets the Better Auth session cookie and intercepts the session endpoint
 * so dashboard pages render without a real auth backend.
 * Also mocks all external API routes with sensible defaults.
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
    return route.continue();
  });

  // Mock all external API routes with sensible defaults.
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

  await page.route('**/api/routes/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ optimized: [], distance: 0, duration: 0 }),
    });
  });

  await page.route('**/api/geocode**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ lat: 40.0, lon: -74.0 }),
    });
  });

  await page.route('**/api/email/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, messageId: 'mock-msg-id' }),
    });
  });

  await page.route('**/api/messaging/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/credits**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ used: 10, limit: 500, remaining: 490 }),
    });
  });

  await page.route('**/api/schedule/**', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: [] }),
    });
  });
}

/** Seed OfflineKit with test data. Must be called after navigating to a page that has loaded OfflineKit (e.g., /dashboard/appointments). */
export async function seedOfflineKit(page: Page, data: {
  clients?: Array<{ id: string; first_name: string; last_name: string; email?: string }>;
  services?: Array<{ id: string; name: string; duration_minutes: number; price_cents?: number }>;
  appointments?: Array<{
    id: string;
    client_id: string;
    service_id: string;
    start_time: string;
    end_time: string;
    status?: string;
    location_type: string;
  }>;
  agentProfile?: Array<{ id: string; section_id: string; content: Record<string, unknown> }>;
}) {
  await page.evaluate(async (data) => {
    // Access the OfflineKit app singleton via the module
    const { app } = await import('/src/lib/offlinekit/index.ts');
    const userId = '00000000-0000-0000-0000-000000000000';
    const now = new Date().toISOString();

    if (data.clients) {
      for (const client of data.clients) {
        await app.clients.create({
          ...client,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        });
      }
    }

    if (data.services) {
      for (const service of data.services) {
        await app.services.create({
          ...service,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
          location_type: 'home',
          description: null,
          weather_dependent: false,
        });
      }
    }

    if (data.appointments) {
      for (const appointment of data.appointments) {
        await app.appointments.create({
          ...appointment,
          user_id: userId,
          pet_id: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          internal_notes: null,
          weather_alert: 0,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        });
      }
    }

    if (data.agentProfile) {
      for (const section of data.agentProfile) {
        await app.agentProfile.create({
          ...section,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        });
      }
    }
  }, data);
}

/** Chat mock configuration */
export interface ChatMockConfig {
  response?: string;
  bootstrapResponse?: string;
  streamDelay?: number;
  error?: boolean;
  handler?: (message: string) => string | Promise<string>;
}

/** Mock the /api/agent/chat endpoint using runtime fetch override. Must be set before navigating to the chat page. */
export async function mockChatAPI(context: any, config: ChatMockConfig = {}) {
  // Store config on context for the init script
  (context as any).__CHAT_MOCK_CONFIG__ = config;

  await context.addInitScript(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.href : String(input);
      const mockConfig: ChatMockConfig = (window as any).__CHAT_MOCK_CONFIG__;

      if (url.includes('/api/agent/chat') && (init?.method === 'POST' || !init?.method)) {
        const body = await (input as Request).clone().json();
        const messages = body.messages as Array<{ role: string; content: string }> | undefined;
        const lastUserMsg = messages?.[messages.length - 1]?.content || '';

        if (mockConfig?.error) {
          return new Response(JSON.stringify({ error: 'Simulated error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        let responseText: string;
        if (mockConfig?.handler) {
          responseText = await mockConfig.handler(lastUserMsg);
        } else if (body.bootstrapPrompt) {
          responseText = mockConfig?.bootstrapResponse ?? "Great! I've noted that. What else should I know?";
        } else {
          responseText = mockConfig?.response ?? "I'm your AI scheduling assistant. How can I help?";
        }

        const encoder = new TextEncoder();
        const parts = responseText.split(/(?=\s)/);
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const part of parts) {
              if (mockConfig?.streamDelay) {
                await new Promise(r => setTimeout(r, mockConfig.streamDelay));
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      return originalFetch(input, init);
    };
  }, {});
}

/** Extended test fixture with auth + seeding + chat mock */
export const test = base.extend<{
  authPage: Page;
  seedOfflineKit: (data: Parameters<typeof seedOfflineKit>[1]) => Promise<void>;
  mockChatAPI: (config: ChatMockConfig) => Promise<void>;
}>({
  authPage: async ({ page }, use) => {
    await setupAuth(page);
    await use(page);
  },

  seedOfflineKit: async ({ page }, use) => {
    await use(async (data) => {
      await seedOfflineKit(page, data);
    });
  },

  mockChatAPI: async ({ context }, use) => {
    await use(async (config) => {
      await mockChatAPI(context, config);
    });
  },
});

export { expect, TEST_USER, TEST_SESSION };
