/**
 * Route Optimizer Tests
 */

import { describe, it, expect } from 'vitest';
import { haversineKm, optimizeRoute } from './optimizer';
import type { RouteStop } from './optimizer';

// Known city coordinates for reference distance calculations
const NYC: RouteStop = { id: 'nyc', latitude: 40.7128, longitude: -74.006 };
const LA: RouteStop = { id: 'la', latitude: 34.0522, longitude: -118.2437 };
const CHICAGO: RouteStop = { id: 'chi', latitude: 41.8781, longitude: -87.6298 };

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('calculates distance between NYC and LA within known range', () => {
    // NYC to LA is approximately 3940 km great-circle
    const dist = haversineKm(NYC.latitude, NYC.longitude, LA.latitude, LA.longitude);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it('calculates distance between NYC and Chicago within known range', () => {
    // NYC to Chicago is approximately 1149 km great-circle
    const dist = haversineKm(NYC.latitude, NYC.longitude, CHICAGO.latitude, CHICAGO.longitude);
    expect(dist).toBeGreaterThan(1100);
    expect(dist).toBeLessThan(1200);
  });

  it('is symmetric (A->B equals B->A)', () => {
    const ab = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    const ba = haversineKm(34.0522, -118.2437, 40.7128, -74.006);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('returns a positive number for distinct coordinates', () => {
    const dist = haversineKm(0, 0, 1, 1);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('optimizeRoute', () => {
  it('returns empty result for empty stops array', () => {
    const result = optimizeRoute([]);
    expect(result.stops).toEqual([]);
    expect(result.totalDistanceKm).toBe(0);
  });

  it('returns single stop unchanged with zero distance', () => {
    const result = optimizeRoute([NYC]);
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]!.id).toBe('nyc');
    expect(result.totalDistanceKm).toBe(0);
  });

  it('returns both stops for two-stop input', () => {
    const result = optimizeRoute([NYC, LA]);
    expect(result.stops).toHaveLength(2);
    expect(result.stops[0]!.id).toBe('nyc');
    expect(result.stops[1]!.id).toBe('la');
  });

  it('calculates correct total distance for two stops', () => {
    const result = optimizeRoute([NYC, LA]);
    const expected = haversineKm(NYC.latitude, NYC.longitude, LA.latitude, LA.longitude);
    expect(result.totalDistanceKm).toBeCloseTo(expected, 6);
  });

  it('starts from the first stop in the input array', () => {
    const result = optimizeRoute([LA, NYC, CHICAGO]);
    expect(result.stops[0]!.id).toBe('la');
  });

  it('reorders three stops by nearest-neighbor from the first', () => {
    // Starting from LA: nearest to LA is Chicago (~2800 km) vs NYC (~3940 km)
    // Wait - actually Chicago is closer to NYC than to LA
    // LA -> Chicago ~2800 km, LA -> NYC ~3940 km
    // So nearest neighbor from LA picks Chicago, then NYC
    const result = optimizeRoute([LA, NYC, CHICAGO]);
    expect(result.stops[0]!.id).toBe('la');
    expect(result.stops[1]!.id).toBe('chi');
    expect(result.stops[2]!.id).toBe('nyc');
  });

  it('total distance equals sum of leg distances', () => {
    const result = optimizeRoute([LA, NYC, CHICAGO]);
    const leg1 = haversineKm(
      result.stops[0]!.latitude, result.stops[0]!.longitude,
      result.stops[1]!.latitude, result.stops[1]!.longitude
    );
    const leg2 = haversineKm(
      result.stops[1]!.latitude, result.stops[1]!.longitude,
      result.stops[2]!.latitude, result.stops[2]!.longitude
    );
    expect(result.totalDistanceKm).toBeCloseTo(leg1 + leg2, 6);
  });

  it('preserves all stops with coordinates in output', () => {
    const stops: RouteStop[] = [
      { id: 'a', latitude: 40.7128, longitude: -74.006 },
      { id: 'b', latitude: 41.8781, longitude: -87.6298 },
      { id: 'c', latitude: 34.0522, longitude: -118.2437 },
      { id: 'd', latitude: 37.7749, longitude: -122.4194 },
    ];
    const result = optimizeRoute(stops);
    expect(result.stops).toHaveLength(4);
    const ids = result.stops.map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns a positive total distance for multi-stop route', () => {
    const result = optimizeRoute([NYC, LA, CHICAGO]);
    expect(result.totalDistanceKm).toBeGreaterThan(0);
  });
});
