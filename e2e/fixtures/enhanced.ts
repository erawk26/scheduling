/**
 * Enhanced E2E fixtures for Playwright tests.
 *
 * Uses real OfflineKit with proper initialization sequence.
 */

import { test as base, expect as baseExpect, type Page, BrowserContext } from '@playwright/test';

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

/** Create a real auth session via Better Auth API */
async function createRealSession(baseURL: string): Promise<string[]> {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': baseURL,
  };

  // Sign up — returns session cookies on success
  const signUpRes = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      password: 'testpassword123',
      name: TEST_USER.name,
    }),
  });

  if (!signUpRes.ok) {
    const body = await signUpRes.text().catch(() => '');
    throw new Error(`Auth sign-up failed: ${signUpRes.status} ${body}`);
  }

  // Extract set-cookie headers from sign-up response
  const cookies = signUpRes.headers.getSetCookie?.() ?? [];
  return cookies;
}

/** Setup auth + mock external APIs */
async function setupAuth(page: Page) {
  const baseURL = 'http://localhost:3001';

  // Create a real session via the auth API
  const rawCookies = await createRealSession(baseURL);

  // Parse and set cookies on the browser context
  for (const raw of rawCookies) {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    if (!nameVal) continue;
    const eqIdx = nameVal.indexOf('=');
    const name = nameVal.slice(0, eqIdx);
    const value = decodeURIComponent(nameVal.slice(eqIdx + 1));

    const cookie: {
      name: string;
      value: string;
      domain: string;
      path: string;
      httpOnly?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
      expires?: number;
    } = {
      name,
      value,
      domain: 'localhost',
      path: '/',
    };

    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === 'httponly') cookie.httpOnly = true;
      if (lower.startsWith('path=')) cookie.path = attr.split('=')[1] || '/';
      if (lower.startsWith('max-age=')) {
        const maxAge = parseInt(attr.split('=')[1] || '0', 10);
        cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
      }
      if (lower.startsWith('samesite=')) {
        const ss = attr.split('=')[1] || 'Lax';
        cookie.sameSite = ss as 'Strict' | 'Lax' | 'None';
      }
    }

    await page.context().addCookies([cookie]);
  }

  // Mock other external APIs
  await page.route('**/api/weather/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ forecasts: [], location: { lat: 40.0, lon: -74.0 } }) })
  );
  await page.route('**/api/routes/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ optimized: [], distance: 0, duration: 0 }) })
  );
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lat: 40.0, lon: -74.0 }) })
  );
  await page.route('**/api/schedule/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) })
  );
}

/** Seed OfflineKit with test data via OfflineKit's API (not raw IndexedDB).
 *  Uses dynamic import to access the OfflineKit app singleton so data goes
 *  through the encrypted adapter and triggers the reactive layer.
 *  Must be called after the page has been navigated to localhost.
 */
export async function seedOfflineKit(page: Page, data: {
  clients?: Array<{ id: string; first_name: string; last_name: string; email?: string; address?: string | null }>;
  pets?: Array<{ id: string; client_id: string; name: string; species: string; breed?: string | null; size?: string | null; age_years?: number | null; weight_lbs?: number | null; behavior_notes?: string | null; medical_notes?: string | null }>;
  services?: Array<{ id: string; name: string; duration_minutes: number; price_cents?: number }>;
  appointments?: Array<{
    id: string;
    client_id: string;
    pet_id?: string | null;
    service_id: string;
    start_time: string;
    end_time: string;
    status?: string;
    location_type?: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
    internal_notes?: string | null;
    weather_alert?: number;
  }>;
  agentProfile?: Array<{ id: string; section_id: string; content: Record<string, unknown> }>;
  businessProfile?: Array<{ id: string; business_name: string; phone?: string | null; timezone?: string; service_area_miles?: number; business_latitude?: number | null; business_longitude?: number | null }>;
}) {
  // OfflineKit modules are only available from a page on localhost (Vite serves them).
  const currentUrl = page.url();
  if (!currentUrl || currentUrl.startsWith('about:') || currentUrl === 'data:') {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
  }

  await page.evaluate(async (data) => {
    const { app } = await import('/src/lib/offlinekit/index.ts') as any;
    const userId = '00000000-0000-0000-0000-000000000000';
    const now = new Date().toISOString();

    if (data.clients) {
      for (const client of data.clients) {
        await app.clients.create({
          id: client.id,
          user_id: userId,
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email ?? null,
          phone: null,
          address: client.address ?? null,
          latitude: null,
          longitude: null,
          notes: null,
          scheduling_flexibility: 'unknown',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }

    if (data.pets) {
      for (const pet of data.pets) {
        await app.pets.create({
          id: pet.id,
          client_id: pet.client_id,
          user_id: userId,
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? null,
          size: pet.size ?? null,
          age_years: pet.age_years ?? null,
          weight_lbs: pet.weight_lbs ?? null,
          behavior_notes: pet.behavior_notes ?? null,
          medical_notes: pet.medical_notes ?? null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }

    if (data.services) {
      for (const service of data.services) {
        await app.services.create({
          id: service.id,
          user_id: userId,
          name: service.name,
          description: null,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents ?? null,
          weather_dependent: false,
          location_type: 'client_location',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }

    if (data.appointments) {
      for (const appointment of data.appointments) {
        await app.appointments.create({
          id: appointment.id,
          user_id: userId,
          client_id: appointment.client_id,
          pet_id: appointment.pet_id ?? null,
          service_id: appointment.service_id,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: appointment.status ?? 'scheduled',
          location_type: appointment.location_type ?? 'client_location',
          address: appointment.address ?? null,
          latitude: appointment.latitude ?? null,
          longitude: appointment.longitude ?? null,
          notes: appointment.notes ?? null,
          internal_notes: appointment.internal_notes ?? null,
          weather_alert: appointment.weather_alert ?? 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }

    if (data.agentProfile) {
      for (const section of data.agentProfile) {
        await app.agentProfile.create({
          id: section.id,
          section_id: section.section_id,
          content: section.content,
          user_id: userId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }

    if (data.businessProfile) {
      for (const profile of data.businessProfile) {
        await app.businessProfile.create({
          id: profile.id,
          business_name: profile.business_name,
          phone: profile.phone ?? null,
          timezone: profile.timezone ?? 'America/New_York',
          service_area_miles: profile.service_area_miles ?? 25,
          business_latitude: profile.business_latitude ?? null,
          business_longitude: profile.business_longitude ?? null,
          user_id: userId,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });
      }
    }
  }, data);
}

/** Chat mock config */
export interface ChatMockConfig {
  response?: string;
  bootstrapResponse?: string;
  streamDelay?: number;
  error?: boolean;
  handler?: (message: string) => string | Promise<string>;
}

/** Runtime chat API mock - adds X-Test-Response header to chat requests */
export async function mockChatAPI(page: Page, config: ChatMockConfig = {}) {
  // Serializable config for addInitScript (functions can't be serialized)
  const serializableConfig = {
    response: config.response,
    bootstrapResponse: config.bootstrapResponse,
    streamDelay: config.streamDelay,
    error: config.error,
  };

  // addInitScript runs on every navigation — embed the config so it survives goto()
  await page.addInitScript((cfg) => {
    // Always update the config (later calls override earlier ones)
    (window as any).__CHAT_MOCK_CONFIG__ = cfg;

    // Install fetch override once
    if ((window as any).__CHAT_MOCK_OVERRIDE_INSTALLED__) return;
    (window as any).__CHAT_MOCK_OVERRIDE_INSTALLED__ = true;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof URL ? input.href : String(input);

      const mockConfig = (window as any).__CHAT_MOCK_CONFIG__;
      if (mockConfig && url.includes('/api/agent/chat') && (init?.method === 'POST' || !init?.method)) {
        const responseText: string =
          mockConfig.response ?? mockConfig.bootstrapResponse ?? "I'm your AI scheduling assistant. How can I help?";

        const newInit: RequestInit = {
          ...init,
          headers: {
            ...init?.headers,
            'X-Test-Response': responseText,
          },
        };

        return originalFetch(input, newInit);
      }

      return originalFetch(input, init);
    };
  }, serializableConfig);

  // Also set on current page context (for calls made after navigation)
  await page.evaluate((cfg) => {
    (window as any).__CHAT_MOCK_CONFIG__ = cfg;
  }, serializableConfig);
}

/** Extended test fixture */
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

  mockChatAPI: async ({ page }, use) => {
    await use(async (config) => {
      await mockChatAPI(page, config);
    });
  },
});

export { baseExpect as expect, TEST_USER, TEST_SESSION };
