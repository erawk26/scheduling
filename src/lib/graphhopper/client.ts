/**
 * GraphHopper API client (server-side only).
 * Wraps geocoding and VRP route optimization with rate limiting,
 * caching, and credit tracking for the free tier (500 credits/day).
 */

import { RateLimiter } from '@/lib/graphhopper/rate-limiter';
import { ApiCache } from '@/lib/graphhopper/cache';
import { creditTracker } from '@/lib/graphhopper/credit-tracker';
import type {
  GeocodingResult,
  GeocodingApiResponse,
  VRPRequest,
  VRPResponse,
  GraphHopperError,
} from '@/lib/graphhopper/types';

const BASE_URL = 'https://graphhopper.com/api/1';
const GEOCODE_CREDITS = 0.3;
const VRP_MIN_CREDITS = 10;

const rateLimiter = new RateLimiter(1);
const cache = new ApiCache(1000);

function getApiKey(): string {
  const key = process.env.GRAPHHOPPER_API_KEY;
  if (!key) throw new Error('GRAPHHOPPER_API_KEY not set');
  return key;
}

function geocodeCacheKey(address: string): string {
  return `geo:${address.toLowerCase().trim()}`;
}

function vrpCacheKey(serviceIds: string[]): string {
  return `vrp:${[...serviceIds].sort().join(',')}`;
}

export async function geocode(address: string): Promise<GeocodingResult | null> {
  const cacheKey = geocodeCacheKey(address);
  const cached = cache.get<GeocodingResult>(cacheKey);
  if (cached) return cached;

  if (!creditTracker.canSpend(GEOCODE_CREDITS)) {
    console.warn('[GraphHopper] Credit limit reached, skipping geocode');
    return null;
  }

  await rateLimiter.acquire();

  const url = `${BASE_URL}/geocode?q=${encodeURIComponent(address)}&limit=1&key=${getApiKey()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    console.error('[GraphHopper] Geocode error:', err);
    return null;
  }

  creditTracker.recordUsage(GEOCODE_CREDITS);
  if (creditTracker.isWarning()) {
    console.warn('[GraphHopper] Approaching daily credit limit:', creditTracker.getUsage());
  }

  const data: GeocodingApiResponse = await res.json();
  if (!data.hits?.length) return null;

  const hit = data.hits[0]!;
  const result: GeocodingResult = {
    lat: hit.point.lat,
    lon: hit.point.lng,
    formatted_address: [hit.housenumber, hit.street, hit.city, hit.state, hit.postcode, hit.country]
      .filter(Boolean)
      .join(', '),
    city: hit.city,
    state: hit.state,
    postcode: hit.postcode,
    country: hit.country,
  };

  cache.set(cacheKey, result); // permanent — no TTL
  return result;
}

export async function optimizeRoute(request: VRPRequest): Promise<VRPResponse> {
  const serviceIds = request.services.map((s) => s.id);
  const cacheKey = vrpCacheKey(serviceIds);
  const cached = cache.get<VRPResponse>(cacheKey);
  if (cached) return cached;

  const estimatedCredits = Math.max(VRP_MIN_CREDITS, request.vehicles.length * request.services.length);
  if (!creditTracker.canSpend(estimatedCredits)) {
    throw new Error('GraphHopper daily credit limit reached');
  }

  await rateLimiter.acquire();

  const url = `${BASE_URL}/vrp?key=${getApiKey()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err: GraphHopperError = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`GraphHopper VRP error: ${err.message}`);
  }

  creditTracker.recordUsage(estimatedCredits);
  if (creditTracker.isWarning()) {
    console.warn('[GraphHopper] Approaching daily credit limit:', creditTracker.getUsage());
  }

  const data: VRPResponse = await res.json();
  cache.set(cacheKey, data, 60 * 60 * 1000); // 1 hour TTL
  return data;
}

export { creditTracker };
