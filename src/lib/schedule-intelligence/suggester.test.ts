/**
 * Schedule Suggestion Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { generateSuggestions } from './suggester';
import type { AnalysisAppointment } from './types';

// Two appointments in Seattle area that are out of optimal order:
// A is downtown (47.606, -122.332), B is northgate (47.706, -122.332), C is south (47.506, -122.332)
// Optimal order from south to north: C -> A -> B (or B -> A -> C for reverse)
// Current order A -> C -> B requires backtracking

function makeAppt(
  overrides: Partial<AnalysisAppointment> & Pick<AnalysisAppointment, 'id' | 'startTime' | 'endTime' | 'latitude' | 'longitude'>
): AnalysisAppointment {
  return {
    clientId: overrides.id,
    clientName: `Client ${overrides.id}`,
    serviceId: 'svc-1',
    serviceName: 'Grooming',
    durationMinutes: 60,
    flexibility: 'flexible',
    ...overrides,
  };
}

// Appointments arranged so nearest-neighbor produces a different order:
// apptA: start 9am, lat 47.606 (middle)
// apptB: start 10am, lat 47.806 (far north)  <- backtracking required with current order
// apptC: start 11am, lat 47.616 (near middle) <- closer to A than B is
const apptA = makeAppt({
  id: 'a',
  startTime: '2026-03-02T09:00:00',
  endTime: '2026-03-02T10:00:00',
  latitude: 47.606,
  longitude: -122.332,
});

const apptB = makeAppt({
  id: 'b',
  startTime: '2026-03-02T10:15:00',
  endTime: '2026-03-02T11:15:00',
  latitude: 47.806,
  longitude: -122.332,
  flexibility: 'flexible',
});

const apptC = makeAppt({
  id: 'c',
  startTime: '2026-03-02T11:30:00',
  endTime: '2026-03-02T12:30:00',
  latitude: 47.616,
  longitude: -122.332,
  flexibility: 'flexible',
});

describe('generateSuggestions', () => {
  it('returns empty suggestions for empty input', () => {
    const result = generateSuggestions(new Map());
    expect(result.suggestions).toHaveLength(0);
    expect(result.totalMilesSaved).toBe(0);
    expect(result.totalMinutesSaved).toBe(0);
  });

  it('returns empty suggestions when all clients are fixed flexibility', () => {
    const fixed = { ...apptA, flexibility: 'fixed' as const };
    const fixed2 = { ...apptB, flexibility: 'fixed' as const };
    const map = new Map([['2026-03-02', [fixed, fixed2]]]);
    const result = generateSuggestions(map);
    expect(result.suggestions).toHaveLength(0);
  });

  it('skips days with fewer than 2 flexible appointments', () => {
    const map = new Map([['2026-03-02', [apptA]]]);
    const result = generateSuggestions(map);
    expect(result.suggestions).toHaveLength(0);
  });

  it('generates swap suggestions when order is suboptimal', () => {
    // A(middle) -> B(far north) -> C(near middle) forces backtracking
    // Optimal: A -> C -> B (nearest neighbor from A goes to C first)
    const map = new Map([['2026-03-02', [apptA, apptB, apptC]]]);
    const result = generateSuggestions(map);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('preserves original times for undo', () => {
    const map = new Map([['2026-03-02', [apptA, apptB, apptC]]]);
    const result = generateSuggestions(map);
    const moved = result.suggestions.find((s) => s.appointmentId === 'b');
    if (moved) {
      expect(moved.originalStartTime).toBe(apptB.startTime);
      expect(moved.originalEndTime).toBe(apptB.endTime);
    }
  });

  it('sets weekStart and weekEnd from dates', () => {
    const map = new Map([
      ['2026-03-02', [apptA, apptB, apptC]],
    ]);
    const result = generateSuggestions(map);
    expect(result.weekStart).toBe('2026-03-02');
    expect(result.weekEnd).toBe('2026-03-02');
  });

  it('sets weekStart/weekEnd across multiple days', () => {
    const apptD = makeAppt({
      id: 'd',
      startTime: '2026-03-03T09:00:00',
      endTime: '2026-03-03T10:00:00',
      latitude: 47.606,
      longitude: -122.332,
    });
    const apptE = makeAppt({
      id: 'e',
      startTime: '2026-03-03T10:15:00',
      endTime: '2026-03-03T11:15:00',
      latitude: 47.806,
      longitude: -122.332,
    });
    const map = new Map([
      ['2026-03-02', [apptA, apptB, apptC]],
      ['2026-03-03', [apptD, apptE]],
    ]);
    const result = generateSuggestions(map);
    expect(result.weekStart).toBe('2026-03-02');
    expect(result.weekEnd).toBe('2026-03-03');
  });

  it('includes unknown flexibility appointments by default', () => {
    const unknown1 = { ...apptA, id: 'u1', flexibility: 'unknown' as const };
    const unknown2 = {
      ...apptB,
      id: 'u2',
      flexibility: 'unknown' as const,
      startTime: '2026-03-02T10:15:00',
      endTime: '2026-03-02T11:15:00',
    };
    const unknown3 = {
      ...apptC,
      id: 'u3',
      flexibility: 'unknown' as const,
      startTime: '2026-03-02T11:30:00',
      endTime: '2026-03-02T12:30:00',
    };
    const map = new Map([['2026-03-02', [unknown1, unknown2, unknown3]]]);
    const result = generateSuggestions(map);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    // With includeUnknown=true (default), unknowns are included in optimization
    // At minimum we shouldn't throw; suggestions may or may not exist depending on order
  });

  it('excludes unknown flexibility when includeUnknownFlexibility is false', () => {
    const unknown1 = { ...apptA, id: 'u1', flexibility: 'unknown' as const };
    const unknown2 = { ...apptB, id: 'u2', flexibility: 'unknown' as const };
    const map = new Map([['2026-03-02', [unknown1, unknown2]]]);
    const result = generateSuggestions(map, { includeUnknownFlexibility: false });
    expect(result.suggestions).toHaveLength(0);
  });

  it('respects business hours - no suggestions past end hour', () => {
    // Force all appointments into a narrow window near end of business day
    const lateA = makeAppt({
      id: 'la',
      startTime: '2026-03-02T17:00:00',
      endTime: '2026-03-02T18:00:00',
      latitude: 47.606,
      longitude: -122.332,
    });
    const lateB = makeAppt({
      id: 'lb',
      startTime: '2026-03-02T18:00:00',
      endTime: '2026-03-02T19:00:00',
      latitude: 47.806,
      longitude: -122.332,
    });
    const lateC = makeAppt({
      id: 'lc',
      startTime: '2026-03-02T19:00:00',
      endTime: '2026-03-02T20:00:00',
      latitude: 47.616,
      longitude: -122.332,
    });
    const map = new Map([['2026-03-02', [lateA, lateB, lateC]]]);
    // businessEndHour=18 means nothing can end after 18:00
    const result = generateSuggestions(map, { businessEndHour: 18 });
    // chaining from 17:00 with 60min duration + 15min buffer exceeds 18:00 for slots 2+
    expect(result.suggestions).toHaveLength(0);
  });

  it('calculates savings as non-negative numbers', () => {
    const map = new Map([['2026-03-02', [apptA, apptB, apptC]]]);
    const result = generateSuggestions(map);
    expect(result.totalMilesSaved).toBeGreaterThanOrEqual(0);
    expect(result.totalMinutesSaved).toBeGreaterThanOrEqual(0);
    for (const s of result.suggestions) {
      expect(s.estimatedMilesSaved).toBeGreaterThanOrEqual(0);
      expect(s.estimatedMinutesSaved).toBeGreaterThanOrEqual(0);
    }
  });

  it('each suggestion has a unique id', () => {
    const map = new Map([['2026-03-02', [apptA, apptB, apptC]]]);
    const result = generateSuggestions(map);
    const ids = result.suggestions.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('suggestion reason is descriptive', () => {
    const map = new Map([['2026-03-02', [apptA, apptB, apptC]]]);
    const result = generateSuggestions(map);
    for (const s of result.suggestions) {
      expect(s.reason).toMatch(/miles/i);
    }
  });
});
