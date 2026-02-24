/**
 * Route Optimizer - Nearest-Neighbor Algorithm
 *
 * Fully offline. No API calls. O(n²) is fine for ≤20 stops.
 */

export interface RouteStop {
  id: string;
  latitude: number;
  longitude: number;
}

export interface OptimizedRoute<T extends RouteStop> {
  stops: T[];
  totalDistanceKm: number;
}

/**
 * Haversine formula - great-circle distance in km between two lat/lon points.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nearest-neighbor greedy route optimizer.
 * Starts from the first stop in the input array, then always picks the closest unvisited stop.
 */
export function optimizeRoute<T extends RouteStop>(stops: T[]): OptimizedRoute<T> {
  if (stops.length === 0) return { stops: [], totalDistanceKm: 0 };

  const unvisited: T[] = [...stops];
  const first = unvisited.splice(0, 1)[0] as T;
  const ordered: T[] = [first];
  let totalDistanceKm = 0;

  while (unvisited.length > 0) {
    const current = ordered[ordered.length - 1] as T;
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i] as T;
      const dist = haversineKm(
        current.latitude,
        current.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    totalDistanceKm += nearestDist;
    ordered.push(unvisited.splice(nearestIdx, 1)[0] as T);
  }

  return { stops: ordered, totalDistanceKm };
}
