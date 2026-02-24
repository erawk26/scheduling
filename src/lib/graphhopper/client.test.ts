import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment
vi.stubEnv('GRAPHHOPPER_API_KEY', 'test-key-123');

describe('GraphHopper Client', () => {
  let geocode: typeof import('./client').geocode;
  let optimizeRoute: typeof import('./client').optimizeRoute;
  let creditTracker: typeof import('./client').creditTracker;

  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date('2026-02-23T12:00:00Z') });
    vi.resetModules();

    // Fresh import each test to reset singletons
    const mod = await import('./client');
    geocode = mod.geocode;
    optimizeRoute = mod.optimizeRoute;
    creditTracker = mod.creditTracker;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('geocode', () => {
    it('returns geocoding result on success', async () => {
      const mockResponse = {
        hits: [{
          point: { lat: 40.7128, lng: -74.006 },
          name: 'New York',
          street: 'Broadway',
          housenumber: '123',
          city: 'New York',
          state: 'NY',
          postcode: '10001',
          country: 'US',
        }],
        took: 5,
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const result = await geocode('123 Broadway, New York, NY');

      expect(result).not.toBeNull();
      expect(result!.lat).toBe(40.7128);
      expect(result!.lon).toBe(-74.006);
      expect(result!.city).toBe('New York');
      expect(result!.state).toBe('NY');
    });

    it('returns null when no hits', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hits: [], took: 3 }),
      }));

      const result = await geocode('nonexistent address xyz');
      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ message: 'Invalid API key' }),
      }));

      const result = await geocode('123 Main St');
      expect(result).toBeNull();
    });

    it('returns cached result on second call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          hits: [{ point: { lat: 1, lng: 2 }, name: 'Test' }],
          took: 1,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await geocode('same address');
      await geocode('same address');

      expect(mockFetch).toHaveBeenCalledTimes(1); // second call is cached
    });

    it('returns null when credit limit reached', async () => {
      // Burn through credits
      for (let i = 0; i < 1584; i++) {
        creditTracker.recordUsage(0.3); // 475.2 -> over 95% of 500
      }

      const result = await geocode('any address');
      expect(result).toBeNull();
    });
  });

  describe('optimizeRoute', () => {
    const validRequest = {
      vehicles: [{ vehicle_id: 'v1', type_id: 'car', shifts: [{ start_address: { location_id: 'start', lat: 40, lon: -74 } }] }],
      vehicle_types: [{ type_id: 'car', profile: 'car' }],
      services: [
        { id: 's1', address: { location_id: 's1', lat: 40.1, lon: -74.1 }, duration: 1800 },
        { id: 's2', address: { location_id: 's2', lat: 40.2, lon: -74.2 }, duration: 1800 },
      ],
    };

    it('returns VRP response on success', async () => {
      const mockVRP = {
        status: 'finished',
        processing_time: 100,
        solution: {
          distance: 5000,
          transport_time: 600,
          completion_time: 4200,
          no_unassigned: 0,
          routes: [{
            vehicle_id: 'v1',
            distance: 5000,
            transport_time: 600,
            activities: [
              { type: 'start', arr_time: 0, end_time: 0 },
              { type: 'service', id: 's2', arr_time: 300, end_time: 2100, distance: 3000, driving_time: 300 },
              { type: 'service', id: 's1', arr_time: 2400, end_time: 4200, distance: 2000, driving_time: 300 },
              { type: 'end', arr_time: 4200, end_time: 4200 },
            ],
          }],
        },
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVRP),
      }));

      const result = await optimizeRoute(validRequest);

      expect(result.solution.routes).toHaveLength(1);
      expect(result.solution.distance).toBe(5000);
      expect(result.solution.routes[0]!.activities).toHaveLength(4);
    });

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid request' }),
      }));

      await expect(optimizeRoute(validRequest)).rejects.toThrow('GraphHopper VRP error');
    });

    it('throws when credit limit reached', async () => {
      creditTracker.recordUsage(470); // Over 95% of 500

      await expect(optimizeRoute(validRequest)).rejects.toThrow('credit limit');
    });

    it('caches VRP result for 1 hour', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'finished',
          processing_time: 50,
          solution: { distance: 1000, transport_time: 300, completion_time: 300, no_unassigned: 0, routes: [] },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await optimizeRoute(validRequest);
      await optimizeRoute(validRequest);

      expect(mockFetch).toHaveBeenCalledTimes(1); // cached

      // Advance past 1 hour TTL
      vi.advanceTimersByTime(61 * 60 * 1000);
      await optimizeRoute(validRequest);
      expect(mockFetch).toHaveBeenCalledTimes(2); // cache expired
    });
  });
});
