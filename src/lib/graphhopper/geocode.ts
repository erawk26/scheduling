import type { GeocodingResult } from './types';

/**
 * Client-side geocoding via our API route.
 * Returns null if offline, API not configured, or address not found.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Offline or network error - fail silently
    return null;
  }
}
