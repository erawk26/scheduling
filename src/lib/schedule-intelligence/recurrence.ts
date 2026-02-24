/**
 * Recurring Appointment Pattern Detector
 *
 * Identifies client+service combinations that repeat on a predictable
 * weekly cadence within a configurable lookback window.
 */

import type { AnalysisAppointment, RecurringPattern } from './types';
import { parseISO, getDay, format, subWeeks, startOfToday, isAfter, isBefore, addDays } from 'date-fns';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function compositeKey(appt: AnalysisAppointment): string {
  return `${appt.clientId}::${appt.serviceId}`;
}

function extractTimeHHMM(isoDatetime: string): string {
  const date = parseISO(isoDatetime);
  return format(date, 'H:mm');
}

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function findMostCommonDay(dayNumbers: number[]): number {
  const counts = new Array<number>(7).fill(0);
  for (const d of dayNumbers) counts[d]!++;
  let max = -1;
  let maxDay = 0;
  for (let i = 0; i < 7; i++) {
    if ((counts[i] ?? 0) > max) {
      max = counts[i]!;
      maxDay = i;
    }
  }
  return maxDay;
}

function buildTimeRange(times: string[]): string {
  if (times.length === 0) return '';
  const minutes = times.map(toMinutes).sort((a, b) => a - b);
  const toHHMM = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return `${toHHMM(minutes[0]!)}–${toHHMM(minutes[minutes.length - 1]!)}`;
}

/**
 * Detect recurring appointment patterns from history.
 * A "recurring" appointment: same client_id + same service_id appearing
 * 3+ times in 4 weeks, on the same or similar day of week.
 */
export function detectRecurringPatterns(
  appointments: AnalysisAppointment[],
  lookbackWeeks: number = 4
): RecurringPattern[] {
  const windowStart = subWeeks(startOfToday(), lookbackWeeks);

  const inWindow = appointments.filter((a) => {
    const d = parseISO(a.startTime);
    return !isBefore(d, windowStart) && !isAfter(d, addDays(startOfToday(), 1));
  });

  const groups = new Map<string, AnalysisAppointment[]>();
  for (const appt of inWindow) {
    const key = compositeKey(appt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(appt);
  }

  const patterns: RecurringPattern[] = [];

  for (const appts of groups.values()) {
    if (appts.length < 3) continue;

    const first = appts[0]!;
    const dayNumbers = appts.map((a) => getDay(parseISO(a.startTime)));
    const typicalDayIndex = findMostCommonDay(dayNumbers);
    const typicalDay = DAY_NAMES[typicalDayIndex]!;
    const startTimes = appts.map((a) => extractTimeHHMM(a.startTime));
    const typicalTimeRange = buildTimeRange(startTimes);

    patterns.push({
      clientId: first.clientId,
      serviceId: first.serviceId,
      clientName: first.clientName,
      serviceName: first.serviceName,
      typicalDay,
      typicalTimeRange,
      occurrencesInLast4Weeks: appts.length,
      flexibility: first.flexibility,
    });
  }

  return patterns;
}
