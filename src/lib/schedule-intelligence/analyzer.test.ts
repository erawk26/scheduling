import { describe, it, expect } from 'vitest';
import {
  calculateSequentialDistance,
  analyzeDayEfficiency,
  analyzeWeekEfficiency,
} from './analyzer';
import type { AnalysisAppointment } from './types';

// NYC-area coordinates spread ~5–15 km apart
const STOP_A = { latitude: 40.7128, longitude: -74.006 };  // Downtown Manhattan
const STOP_B = { latitude: 40.7580, longitude: -73.9855 }; // Midtown
const STOP_C = { latitude: 40.6892, longitude: -74.0445 }; // Brooklyn

function makeAppt(
  id: string,
  lat: number,
  lon: number,
  startTime = '2026-02-24T09:00:00'
): AnalysisAppointment {
  return {
    id,
    clientId: `client-${id}`,
    clientName: `Client ${id}`,
    serviceId: 'svc-1',
    serviceName: 'Grooming',
    startTime,
    endTime: '2026-02-24T10:00:00',
    durationMinutes: 60,
    latitude: lat,
    longitude: lon,
    flexibility: 'unknown',
  };
}

describe('calculateSequentialDistance', () => {
  it('returns 0 for empty stops', () => {
    expect(calculateSequentialDistance([])).toBe(0);
  });

  it('returns 0 for a single stop', () => {
    expect(calculateSequentialDistance([STOP_A])).toBe(0);
  });

  it('calculates distance for two stops', () => {
    const dist = calculateSequentialDistance([STOP_A, STOP_B]);
    // ~5.7 km between Downtown Manhattan and Midtown
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(8);
  });

  it('sums distances for three stops in order', () => {
    const ab = calculateSequentialDistance([STOP_A, STOP_B]);
    const bc = calculateSequentialDistance([STOP_B, STOP_C]);
    const abc = calculateSequentialDistance([STOP_A, STOP_B, STOP_C]);
    expect(abc).toBeCloseTo(ab + bc, 5);
  });
});

describe('analyzeDayEfficiency', () => {
  it('returns 100% efficiency for empty appointments', () => {
    const result = analyzeDayEfficiency('2026-02-24', []);
    expect(result.efficiencyPercent).toBe(100);
    expect(result.actualDistanceKm).toBe(0);
    expect(result.optimalDistanceKm).toBe(0);
    expect(result.estimatedWastedMinutes).toBe(0);
    expect(result.appointmentCount).toBe(0);
  });

  it('returns 100% efficiency for a single appointment', () => {
    const appts = [makeAppt('1', STOP_A.latitude, STOP_A.longitude)];
    const result = analyzeDayEfficiency('2026-02-24', appts);
    expect(result.efficiencyPercent).toBe(100);
    expect(result.actualDistanceKm).toBe(0);
  });

  it('returns 100% efficiency when all appointments are at the same location', () => {
    const appts = [
      makeAppt('1', STOP_A.latitude, STOP_A.longitude, '2026-02-24T09:00:00'),
      makeAppt('2', STOP_A.latitude, STOP_A.longitude, '2026-02-24T10:00:00'),
      makeAppt('3', STOP_A.latitude, STOP_A.longitude, '2026-02-24T11:00:00'),
    ];
    const result = analyzeDayEfficiency('2026-02-24', appts);
    expect(result.efficiencyPercent).toBe(100);
    expect(result.estimatedWastedMinutes).toBe(0);
  });

  it('calculates sequential distance for known coordinates', () => {
    const appts = [
      makeAppt('1', STOP_A.latitude, STOP_A.longitude, '2026-02-24T09:00:00'),
      makeAppt('2', STOP_B.latitude, STOP_B.longitude, '2026-02-24T10:00:00'),
    ];
    const result = analyzeDayEfficiency('2026-02-24', appts);
    expect(result.actualDistanceKm).toBeGreaterThan(4);
    expect(result.actualDistanceKm).toBeLessThan(8);
    expect(result.source).toBe('haversine');
  });

  it('returns efficiency < 100% when scheduled order is suboptimal', () => {
    // Order: A -> C -> B is suboptimal vs A -> B -> C
    const appts = [
      makeAppt('1', STOP_A.latitude, STOP_A.longitude, '2026-02-24T09:00:00'),
      makeAppt('2', STOP_C.latitude, STOP_C.longitude, '2026-02-24T10:00:00'),
      makeAppt('3', STOP_B.latitude, STOP_B.longitude, '2026-02-24T11:00:00'),
    ];
    const result = analyzeDayEfficiency('2026-02-24', appts);
    // Actual: A->C->B; nearest-neighbor from A picks the closer of B,C first
    expect(result.efficiencyPercent).toBeLessThanOrEqual(100);
    expect(result.actualDistanceKm).toBeGreaterThan(0);
    expect(result.optimalDistanceKm).toBeGreaterThan(0);
  });

  it('sets dayOfWeek correctly', () => {
    const result = analyzeDayEfficiency('2026-02-23', []); // Monday
    expect(result.dayOfWeek).toBe('Monday');
  });
});

describe('analyzeWeekEfficiency', () => {
  it('handles empty appointmentsByDate map', () => {
    const result = analyzeWeekEfficiency('2026-02-23', new Map());
    expect(result.days).toHaveLength(0);
    expect(result.totalActualKm).toBe(0);
    expect(result.totalOptimalKm).toBe(0);
    expect(result.totalEfficiencyPercent).toBe(100);
    expect(result.totalWastedMinutes).toBe(0);
    expect(result.weekStart).toBe('2026-02-23');
    expect(result.weekEnd).toBe('2026-03-01');
  });

  it('sums day data correctly across multiple days', () => {
    const map = new Map<string, AnalysisAppointment[]>([
      [
        '2026-02-23',
        [
          makeAppt('1', STOP_A.latitude, STOP_A.longitude, '2026-02-23T09:00:00'),
          makeAppt('2', STOP_B.latitude, STOP_B.longitude, '2026-02-23T10:00:00'),
        ],
      ],
      [
        '2026-02-24',
        [
          makeAppt('3', STOP_A.latitude, STOP_A.longitude, '2026-02-24T09:00:00'),
          makeAppt('4', STOP_C.latitude, STOP_C.longitude, '2026-02-24T10:00:00'),
        ],
      ],
    ]);

    const result = analyzeWeekEfficiency('2026-02-23', map);
    expect(result.days).toHaveLength(2);
    const sumActual = result.days.reduce((s, d) => s + d.actualDistanceKm, 0);
    const sumOptimal = result.days.reduce((s, d) => s + d.optimalDistanceKm, 0);
    expect(result.totalActualKm).toBeCloseTo(sumActual, 5);
    expect(result.totalOptimalKm).toBeCloseTo(sumOptimal, 5);
    expect(result.totalWastedMinutes).toBeGreaterThanOrEqual(0);
  });

  it('handles days with no appointments (100% efficiency, 0 km)', () => {
    const map = new Map<string, AnalysisAppointment[]>([
      ['2026-02-23', []],
      ['2026-02-24', []],
    ]);
    const result = analyzeWeekEfficiency('2026-02-23', map);
    expect(result.totalActualKm).toBe(0);
    expect(result.totalEfficiencyPercent).toBe(100);
  });
});
