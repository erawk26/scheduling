import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectRecurringPatterns } from './recurrence';
import type { AnalysisAppointment } from './types';
import { format, subWeeks, subDays } from 'date-fns';

// Pin "today" so lookback window is deterministic
const TODAY = new Date('2026-02-24T00:00:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeAppt(
  id: string,
  clientId: string,
  serviceId: string,
  date: Date,
  hour = 9,
  clientName = 'Test Client',
  serviceName = 'Grooming'
): AnalysisAppointment {
  const dateStr = format(date, 'yyyy-MM-dd');
  return {
    id,
    clientId,
    clientName,
    serviceId,
    serviceName,
    startTime: `${dateStr}T${String(hour).padStart(2, '0')}:00:00`,
    endTime: `${dateStr}T${String(hour + 1).padStart(2, '0')}:00:00`,
    durationMinutes: 60,
    latitude: 40.7128,
    longitude: -74.006,
    flexibility: 'unknown',
  };
}

// Build N weekly occurrences of a client+service going back from today
function weeklyAppts(
  clientId: string,
  serviceId: string,
  count: number,
  dayOfWeekOffset = 0, // days before today
  hour = 10
): AnalysisAppointment[] {
  return Array.from({ length: count }, (_, i) => {
    const date = subWeeks(subDays(TODAY, dayOfWeekOffset), i);
    return makeAppt(
      `${clientId}-${serviceId}-${i}`,
      clientId,
      serviceId,
      date,
      hour
    );
  });
}

describe('detectRecurringPatterns', () => {
  it('returns empty array when no appointments', () => {
    expect(detectRecurringPatterns([])).toEqual([]);
  });

  it('does not detect pattern with only 2 occurrences in 4 weeks', () => {
    const appts = weeklyAppts('c1', 's1', 2);
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(0);
  });

  it('detects pattern with 3 occurrences in 4 weeks', () => {
    const appts = weeklyAppts('c1', 's1', 3);
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.clientId).toBe('c1');
    expect(patterns[0]!.serviceId).toBe('s1');
    expect(patterns[0]!.occurrencesInLast4Weeks).toBe(3);
  });

  it('detects pattern with 4 occurrences (weekly)', () => {
    const appts = weeklyAppts('c2', 's2', 4, 0, 9);
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.occurrencesInLast4Weeks).toBe(4);
  });

  it('identifies correct typical day of week', () => {
    // All appointments on the same day - TODAY is a Tuesday (2026-02-24)
    // subDays(TODAY, 1) = Monday; use that as base to get consistent Monday appts
    const monday = subDays(TODAY, 1); // 2026-02-23 = Monday
    const appts = Array.from({ length: 3 }, (_, i) =>
      makeAppt(`a${i}`, 'c3', 's3', subWeeks(monday, i), 10)
    );
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.typicalDay).toBe('monday');
  });

  it('handles multiple client+service combos independently', () => {
    const appts = [
      ...weeklyAppts('c1', 's1', 3, 0, 9),
      ...weeklyAppts('c2', 's2', 3, 0, 14),
      ...weeklyAppts('c3', 's3', 2, 0, 11), // only 2 - should NOT appear
    ];
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(2);
    const ids = patterns.map((p) => p.clientId).sort();
    expect(ids).toEqual(['c1', 'c2']);
  });

  it('respects lookback window and ignores appointments outside range', () => {
    // 3 appointments within window + 1 old appointment 5 weeks ago (out of 4-week window)
    const inWindow = weeklyAppts('c4', 's4', 3, 0, 9);
    const oldAppt = makeAppt(
      'old-1',
      'c4',
      's4',
      subWeeks(TODAY, 5),
      9
    );
    // With 3 in-window: should detect
    const patterns1 = detectRecurringPatterns([...inWindow, oldAppt]);
    expect(patterns1).toHaveLength(1);
    expect(patterns1[0]!.occurrencesInLast4Weeks).toBe(3);

    // Only the old appointment: should NOT detect
    const patterns2 = detectRecurringPatterns([oldAppt]);
    expect(patterns2).toHaveLength(0);
  });

  it('builds a time range string from start times', () => {
    const monday = subDays(TODAY, 1);
    const appts = [
      makeAppt('t1', 'c5', 's5', subWeeks(monday, 0), 9),
      makeAppt('t2', 'c5', 's5', subWeeks(monday, 1), 10),
      makeAppt('t3', 'c5', 's5', subWeeks(monday, 2), 11),
    ];
    const patterns = detectRecurringPatterns(appts);
    expect(patterns).toHaveLength(1);
    // Should span 9:00 to 11:00
    expect(patterns[0]!.typicalTimeRange).toContain('9:00');
    expect(patterns[0]!.typicalTimeRange).toContain('11:00');
  });
});
