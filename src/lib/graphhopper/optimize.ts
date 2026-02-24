import type { OptimizationResult } from './types';

export interface OptimizeRequest {
  stops: Array<{
    id: string;
    lat: number;
    lon: number;
    duration_minutes: number;
  }>;
  start?: { lat: number; lon: number };
}

/**
 * Calls our server-side VRP optimization API route.
 * Returns null if offline or API fails (caller should fall back to local optimizer).
 */
export async function fetchOptimizedRoute(
  request: OptimizeRequest
): Promise<OptimizationResult | null> {
  try {
    const res = await fetch('/api/routes/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // Offline or network error
  }
}

export interface CreditInfo {
  used: number;
  limit: number;
  date: string;
}

export async function fetchCreditUsage(): Promise<CreditInfo | null> {
  try {
    const res = await fetch('/api/credits');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
