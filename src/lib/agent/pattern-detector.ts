/**
 * Pattern detector: analyzes appointment history to surface scheduling patterns.
 */

import type { Appointment } from '@/lib/offlinekit/schema';

export type DetectedPattern = {
  type: 'recurring-cancel' | 'preferred-day' | 'time-preference' | 'area-clustering';
  description: string;
  confidence: number;
  suggestion: string;
  affectedProfileSection: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_OCCURRENCES = 3;

function getDayOfWeek(isoString: string): number {
  return new Date(isoString).getDay();
}

function getHour(isoString: string): number {
  return new Date(isoString).getHours();
}

function isWithinWeeks(isoString: string, weeks: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return new Date(isoString) >= cutoff;
}

function detectRecurringCancellations(appointments: Appointment[], weeks: number): DetectedPattern[] {
  const cancelsByDay = new Map<number, number>();
  const totalByDay = new Map<number, number>();

  for (const apt of appointments) {
    if (!isWithinWeeks(apt.start_time, weeks)) continue;
    const day = getDayOfWeek(apt.start_time);
    totalByDay.set(day, (totalByDay.get(day) ?? 0) + 1);
    if (apt.status === 'cancelled') {
      cancelsByDay.set(day, (cancelsByDay.get(day) ?? 0) + 1);
    }
  }

  const patterns: DetectedPattern[] = [];
  for (const [day, count] of cancelsByDay.entries()) {
    if (count < MIN_OCCURRENCES) continue;
    const total = totalByDay.get(day) ?? count;
    const confidence = count / total;
    patterns.push({
      type: 'recurring-cancel',
      description: `You've cancelled ${DAYS[day]}s ${count} times in the last ${weeks} weeks`,
      confidence,
      suggestion: `Want me to mark ${DAYS[day]}s as off in your work schedule?`,
      affectedProfileSection: 'work-schedule',
    });
  }
  return patterns;
}

function detectPreferredDays(
  appointments: Appointment[],
  weeks: number,
  clientNames?: Map<string, string>
): DetectedPattern[] {
  const countByClientDay = new Map<string, number>();
  const totalByClient = new Map<string, number>();

  for (const apt of appointments) {
    if (!isWithinWeeks(apt.start_time, weeks)) continue;
    if (apt.status === 'cancelled' || apt.status === 'no_show') continue;
    const key = `${apt.client_id}::${getDayOfWeek(apt.start_time)}`;
    countByClientDay.set(key, (countByClientDay.get(key) ?? 0) + 1);
    totalByClient.set(apt.client_id, (totalByClient.get(apt.client_id) ?? 0) + 1);
  }

  const patterns: DetectedPattern[] = [];
  for (const [key, count] of countByClientDay.entries()) {
    if (count < MIN_OCCURRENCES) continue;
    const parts = key.split('::');
    const clientId = parts[0] ?? '';
    const day = parseInt(parts[1] ?? '', 10);
    const clientName = clientNames?.get(clientId) ?? 'A client';
    const total = totalByClient.get(clientId) ?? count;
    const confidence = count / total;
    patterns.push({
      type: 'preferred-day',
      description: `${clientName} always comes on ${DAYS[day]}s (${count} of ${total} appointments)`,
      confidence,
      suggestion: `Lock in ${DAYS[day]} as ${clientName}'s preferred day in client rules`,
      affectedProfileSection: 'client-rules',
    });
  }
  return patterns;
}

function detectTimePreferences(appointments: Appointment[], weeks: number): DetectedPattern[] {
  const getTimeSlot = (hour: number) => (hour < 12 ? 'morning' : 'afternoon');
  // Use last 2 words of address as area proxy (e.g. "Portland OR" from "123 Main St Portland OR")
  const getAreaKey = (address: string | null | undefined): string | null => {
    if (!address) return null;
    const parts = address.trim().split(/\s+/);
    return parts.slice(-2).join(' ').toLowerCase();
  };

  const countByAreaSlot = new Map<string, number>();
  const totalByArea = new Map<string, number>();

  for (const apt of appointments) {
    if (!isWithinWeeks(apt.start_time, weeks)) continue;
    if (apt.status === 'cancelled' || apt.status === 'no_show') continue;
    const area = getAreaKey(apt.address);
    if (!area) continue;
    const slot = getTimeSlot(getHour(apt.start_time));
    const key = `${area}::${slot}`;
    countByAreaSlot.set(key, (countByAreaSlot.get(key) ?? 0) + 1);
    totalByArea.set(area, (totalByArea.get(area) ?? 0) + 1);
  }

  const patterns: DetectedPattern[] = [];
  for (const [key, count] of countByAreaSlot.entries()) {
    if (count < MIN_OCCURRENCES) continue;
    const separatorIdx = key.lastIndexOf('::');
    const area = key.slice(0, separatorIdx);
    const slot = key.slice(separatorIdx + 2);
    const total = totalByArea.get(area) ?? count;
    const confidence = count / total;
    if (confidence < 0.6) continue;
    patterns.push({
      type: 'time-preference',
      description: `You tend to schedule ${slot}s for the ${area} area (${count} of ${total} visits)`,
      confidence,
      suggestion: `Add a travel rule: prefer ${slot} slots for ${area} appointments`,
      affectedProfileSection: 'travel-rules',
    });
  }
  return patterns;
}

function detectAreaClustering(appointments: Appointment[], weeks: number): DetectedPattern[] {
  // Grid cell of ~5km (0.05 degree)
  const GRID = 0.05;
  const toCell = (lat: number, lng: number) =>
    `${(Math.round(lat / GRID) * GRID).toFixed(2)},${(Math.round(lng / GRID) * GRID).toFixed(2)}`;

  const countByDayCell = new Map<string, number>();
  const totalByDay = new Map<number, number>();

  for (const apt of appointments) {
    if (!isWithinWeeks(apt.start_time, weeks)) continue;
    if (apt.status === 'cancelled' || apt.status === 'no_show') continue;
    if (apt.latitude == null || apt.longitude == null) continue;
    const day = getDayOfWeek(apt.start_time);
    const key = `${day}::${toCell(apt.latitude, apt.longitude)}`;
    countByDayCell.set(key, (countByDayCell.get(key) ?? 0) + 1);
    totalByDay.set(day, (totalByDay.get(day) ?? 0) + 1);
  }

  const patterns: DetectedPattern[] = [];
  for (const [key, count] of countByDayCell.entries()) {
    if (count < MIN_OCCURRENCES) continue;
    const day = parseInt(key.split('::')[0] ?? '', 10);
    const total = totalByDay.get(day) ?? count;
    const confidence = count / total;
    if (confidence < 0.5) continue;
    patterns.push({
      type: 'area-clustering',
      description: `Your ${DAYS[day]} clients are often in the same area (${count} of ${total} appointments)`,
      confidence,
      suggestion: `Should I cluster ${DAYS[day]} as a zone day in your service area rules?`,
      affectedProfileSection: 'service-area',
    });
  }
  return patterns;
}

export function detectPatterns(
  appointments: Appointment[],
  weeks: number = 4,
  clientNames?: Map<string, string>
): DetectedPattern[] {
  return [
    ...detectRecurringCancellations(appointments, weeks),
    ...detectPreferredDays(appointments, weeks, clientNames),
    ...detectTimePreferences(appointments, weeks),
    ...detectAreaClustering(appointments, weeks),
  ];
}
