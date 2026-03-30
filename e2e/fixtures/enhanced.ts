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

/** Setup auth + mock external APIs */
async function setupAuth(page: Page) {
  // Auth cookie
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Mock Better Auth session endpoint
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

/** Seed OfflineKit with test data by writing directly to IndexedDB.
 *  Must be called after the page has been navigated to localhost (for IndexedDB access).
 */
export async function seedOfflineKit(page: Page, data: {
  clients?: Array<{ id: string; first_name: string; last_name: string; email?: string }>;
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
    location_type: string;
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
  // IndexedDB is only accessible from a page origin (not about:blank).
  // Navigate to the app root if not already on localhost.
  const currentUrl = page.url();
  if (!currentUrl || currentUrl.startsWith('about:') || currentUrl === 'data:') {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
  }

  await page.evaluate(async (data) => {
    const userId = '00000000-0000-0000-0000-000000000000';
    const now = new Date().toISOString();
    const DB_NAME = 'offlinekit-localkit';

    /** Open (or create) an object store and return its IDB database */
    function openStore(storeName: string): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains(storeName)) {
            resolve(db);
          } else {
            // Need to upgrade to add the store
            const version = db.version + 1;
            db.close();
            const req2 = indexedDB.open(DB_NAME, version);
            req2.onerror = () => reject(req2.error);
            req2.onupgradeneeded = (e) => {
              const db2 = (e.target as IDBOpenDBRequest).result;
              if (!db2.objectStoreNames.contains(storeName)) {
                db2.createObjectStore(storeName, { keyPath: '_id' });
              }
            };
            req2.onsuccess = () => resolve(req2.result);
          }
        };
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: '_id' });
          }
        };
      });
    }

    async function putRecord(storeName: string, record: Record<string, unknown>) {
      const db = await openStore(storeName);
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put({ ...record, _id: record.id, _collection: storeName, _deleted: false, _updatedAt: Date.now() });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
      });
    }

    if (data.clients) {
      for (const client of data.clients) {
        await putRecord('clients', {
          ...client,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
          email: client.email ?? null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          scheduling_flexibility: 'unknown',
        });
      }
    }

    if (data.pets) {
      for (const pet of data.pets) {
        await putRecord('pets', {
          ...pet,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
          breed: pet.breed ?? null,
          size: pet.size ?? null,
          age_years: pet.age_years ?? null,
          weight_lbs: pet.weight_lbs ?? null,
          behavior_notes: pet.behavior_notes ?? null,
          medical_notes: pet.medical_notes ?? null,
        });
      }
    }

    if (data.services) {
      for (const service of data.services) {
        await putRecord('services', {
          ...service,
          user_id: userId,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
          location_type: 'client_location',
          description: null,
          weather_dependent: false,
          price_cents: service.price_cents ?? null,
        });
      }
    }

    if (data.appointments) {
      for (const appointment of data.appointments) {
        await putRecord('appointments', {
          pet_id: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          internal_notes: null,
          weather_alert: 0,
          ...appointment,
          user_id: userId,
          status: appointment.status ?? 'scheduled',
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
        await putRecord('agentProfile', {
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

    if (data.businessProfile) {
      for (const profile of data.businessProfile) {
        await putRecord('businessProfile', {
          ...profile,
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
