/**
 * Schedule Suggestion Engine
 *
 * Generates optimized schedule suggestions using the local Haversine optimizer.
 * Identifies days where reordering flexible appointments saves drive time.
 */

import type { AnalysisAppointment, ScheduleSuggestion, WeeklySuggestions } from './types';
import { optimizeRoute, haversineKm } from '@/lib/routes/optimizer';
import { format, parseISO, addMinutes } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export interface SuggesterOptions {
  businessStartHour?: number;
  businessEndHour?: number;
  includeUnknownFlexibility?: boolean;
}

const KM_TO_MILES = 0.621371;
const TRAVEL_BUFFER_MINUTES = 15;
const AVG_SPEED_KM_PER_MIN = 40 / 60; // 40 km/h

/**
 * Build new start/end times chained from a base time.
 * Returns null if any appointment falls outside business hours.
 */
function buildChainedTimes(
  baseStart: Date,
  orderedAppts: AnalysisAppointment[],
  businessStartHour: number,
  businessEndHour: number
): Array<{ newStart: Date; newEnd: Date }> | null {
  const result: Array<{ newStart: Date; newEnd: Date }> = [];
  let cursor = baseStart;

  for (const appt of orderedAppts) {
    const newStart = new Date(cursor);
    const newEnd = addMinutes(newStart, appt.durationMinutes);

    if (newStart.getHours() < businessStartHour) return null;
    if (newEnd.getHours() > businessEndHour) return null;
    if (newEnd.getHours() === businessEndHour && newEnd.getMinutes() > 0) return null;

    result.push({ newStart, newEnd });
    cursor = addMinutes(newEnd, TRAVEL_BUFFER_MINUTES);
  }

  return result;
}

/**
 * Calculate total route distance for an ordered list of appointments.
 */
function totalRouteKm(appts: AnalysisAppointment[]): number {
  let total = 0;
  for (let i = 1; i < appts.length; i++) {
    const prev = appts[i - 1] as AnalysisAppointment;
    const curr = appts[i] as AnalysisAppointment;
    total += haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return total;
}

/**
 * Generate schedule suggestions for a week.
 * For each day with 2+ flexible appointments, optimize ordering
 * and suggest time slot swaps.
 */
export function generateSuggestions(
  appointmentsByDate: Map<string, AnalysisAppointment[]>,
  options?: SuggesterOptions
): WeeklySuggestions {
  const businessStartHour = options?.businessStartHour ?? 8;
  const businessEndHour = options?.businessEndHour ?? 18;
  const includeUnknown = options?.includeUnknownFlexibility ?? true;

  const dates = Array.from(appointmentsByDate.keys()).sort();
  const weekStart = dates[0] ?? '';
  const weekEnd = dates[dates.length - 1] ?? '';

  const suggestions: ScheduleSuggestion[] = [];

  for (const [date, dayAppts] of appointmentsByDate) {
    const withCoords = dayAppts.filter(
      (a) => a.latitude !== 0 && a.longitude !== 0
    );

    const flexible = withCoords.filter((a) => {
      if (a.flexibility === 'fixed') return false;
      if (a.flexibility === 'unknown' && !includeUnknown) return false;
      return true;
    });

    if (flexible.length < 2) continue;

    const sorted = [...flexible].sort(
      (a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
    );

    const optimized = optimizeRoute(sorted);
    const currentKm = totalRouteKm(sorted);
    const optimizedKm = optimized.totalDistanceKm;

    const orderChanged = optimized.stops.some((s, i) => s.id !== sorted[i]?.id);
    if (!orderChanged) continue;

    const baseStart = parseISO(sorted[0]!.startTime);
    const chained = buildChainedTimes(
      baseStart,
      optimized.stops,
      businessStartHour,
      businessEndHour
    );
    if (!chained) continue;

    const savedKm = Math.max(0, currentKm - optimizedKm);
    const savedMiles = savedKm * KM_TO_MILES;
    const savedMinutes = Math.round(savedKm / AVG_SPEED_KM_PER_MIN);

    optimized.stops.forEach((appt, newIdx) => {
      const oldIdx = sorted.findIndex((a) => a.id === appt.id);
      if (oldIdx === newIdx) return;

      const times = chained[newIdx]!;
      const newStartStr = format(times.newStart, "yyyy-MM-dd'T'HH:mm:ss");
      const newEndStr = format(times.newEnd, "yyyy-MM-dd'T'HH:mm:ss");

      suggestions.push({
        id: uuidv4(),
        appointmentId: appt.id,
        clientId: appt.clientId,
        clientName: appt.clientName,
        serviceName: appt.serviceName,
        currentDay: date,
        currentTime: format(parseISO(appt.startTime), 'h:mm a'),
        suggestedDay: date,
        suggestedTime: format(times.newStart, 'h:mm a'),
        reason: `Moving to position ${newIdx + 1} reduces backtracking by ${savedMiles.toFixed(1)} miles`,
        estimatedMilesSaved: Math.round(savedMiles * 10) / 10,
        estimatedMinutesSaved: savedMinutes,
        clientFlexibility: appt.flexibility,
        originalStartTime: appt.startTime,
        originalEndTime: appt.endTime,
        newStartTime: newStartStr,
        newEndTime: newEndStr,
      });
    });
  }

  const totalMilesSaved = suggestions.reduce((sum, s) => sum + s.estimatedMilesSaved, 0);
  const totalMinutesSaved = suggestions.reduce((sum, s) => sum + s.estimatedMinutesSaved, 0);

  return {
    weekStart,
    weekEnd,
    suggestions,
    totalMilesSaved: Math.round(totalMilesSaved * 10) / 10,
    totalMinutesSaved,
  };
}
