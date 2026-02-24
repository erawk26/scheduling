/**
 * Route Efficiency Analyzer
 *
 * Calculates actual vs optimal route distances for scheduled appointments
 * and produces per-day and per-week efficiency reports.
 */

import type { AnalysisAppointment, DayEfficiency, WeeklyEfficiency } from './types';
import { haversineKm, optimizeRoute } from '@/lib/routes/optimizer';
import { parseISO, format, addDays } from 'date-fns';

const AVG_SPEED_KMH = 40;

/**
 * Calculate the total sequential distance for stops in their given order.
 */
export function calculateSequentialDistance(
  stops: Array<{ latitude: number; longitude: number }>
): number {
  if (stops.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    total += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return total;
}

function getDayOfWeek(date: string): string {
  return format(parseISO(date), 'EEEE');
}

function calcEfficiency(actualKm: number, optimalKm: number): number {
  if (actualKm === 0) return 100;
  return Math.min(100, (optimalKm / actualKm) * 100);
}

function calcWastedMinutes(actualKm: number, optimalKm: number): number {
  const wastedKm = actualKm - optimalKm;
  if (wastedKm <= 0) return 0;
  return (wastedKm / AVG_SPEED_KMH) * 60;
}

/**
 * Analyze efficiency for a single day's appointments.
 * Requires 2+ geocoded appointments to be meaningful.
 */
export function analyzeDayEfficiency(
  date: string,
  appointments: AnalysisAppointment[]
): DayEfficiency {
  const geocoded = appointments.filter(
    (a) => a.latitude !== 0 && a.longitude !== 0
  );

  if (geocoded.length < 2) {
    return {
      date,
      dayOfWeek: getDayOfWeek(date),
      appointmentCount: appointments.length,
      actualDistanceKm: 0,
      optimalDistanceKm: 0,
      efficiencyPercent: 100,
      estimatedWastedMinutes: 0,
      source: 'haversine',
    };
  }

  const actualKm = calculateSequentialDistance(geocoded);
  const optimized = optimizeRoute(
    geocoded.map((a) => ({ id: a.id, latitude: a.latitude, longitude: a.longitude }))
  );
  const optimalKm = optimized.totalDistanceKm;

  return {
    date,
    dayOfWeek: getDayOfWeek(date),
    appointmentCount: appointments.length,
    actualDistanceKm: actualKm,
    optimalDistanceKm: optimalKm,
    efficiencyPercent: calcEfficiency(actualKm, optimalKm),
    estimatedWastedMinutes: calcWastedMinutes(actualKm, optimalKm),
    source: 'haversine',
  };
}

/**
 * Analyze a full week's efficiency.
 */
export function analyzeWeekEfficiency(
  weekStart: string,
  appointmentsByDate: Map<string, AnalysisAppointment[]>
): WeeklyEfficiency {
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');

  const days: DayEfficiency[] = [];
  for (const [date, appts] of appointmentsByDate) {
    days.push(analyzeDayEfficiency(date, appts));
  }

  const totalActualKm = days.reduce((sum, d) => sum + d.actualDistanceKm, 0);
  const totalOptimalKm = days.reduce((sum, d) => sum + d.optimalDistanceKm, 0);
  const totalWastedMinutes = days.reduce((sum, d) => sum + d.estimatedWastedMinutes, 0);
  const totalEfficiencyPercent = calcEfficiency(totalActualKm, totalOptimalKm);

  return {
    weekStart,
    weekEnd,
    days,
    totalActualKm,
    totalOptimalKm,
    totalEfficiencyPercent,
    totalWastedMinutes,
  };
}
