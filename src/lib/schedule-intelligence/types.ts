/**
 * Schedule Intelligence Types
 *
 * Types for route efficiency analysis, recurring appointment detection,
 * and schedule optimization suggestions.
 */

// ============================================================================
// Client Flexibility
// ============================================================================

export type SchedulingFlexibility = 'unknown' | 'flexible' | 'fixed';

// ============================================================================
// Route Efficiency Analysis (US-001)
// ============================================================================

export interface DayEfficiency {
  date: string; // ISO date e.g. "2026-02-24"
  dayOfWeek: string; // "Monday", "Tuesday", etc.
  appointmentCount: number;
  actualDistanceKm: number;
  optimalDistanceKm: number;
  efficiencyPercent: number; // (optimal / actual) * 100
  estimatedWastedMinutes: number;
  source: 'graphhopper' | 'haversine';
}

export interface WeeklyEfficiency {
  weekStart: string; // ISO date of Monday
  weekEnd: string; // ISO date of Sunday
  days: DayEfficiency[];
  totalActualKm: number;
  totalOptimalKm: number;
  totalEfficiencyPercent: number;
  totalWastedMinutes: number;
}

// ============================================================================
// Recurring Appointment Detection (US-002)
// ============================================================================

export interface RecurringPattern {
  clientId: string;
  serviceId: string;
  clientName: string;
  serviceName: string;
  typicalDay: string; // "monday", "tuesday", etc.
  typicalTimeRange: string; // "9:00-11:00"
  occurrencesInLast4Weeks: number;
  flexibility: SchedulingFlexibility;
}

// ============================================================================
// Schedule Suggestions (US-004)
// ============================================================================

export interface ScheduleSuggestion {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  currentDay: string;
  currentTime: string; // "9:00 AM"
  suggestedDay: string;
  suggestedTime: string; // "11:00 AM"
  reason: string;
  estimatedMilesSaved: number;
  estimatedMinutesSaved: number;
  clientFlexibility: SchedulingFlexibility;
  /** Original start_time for undo */
  originalStartTime: string;
  /** Original end_time for undo */
  originalEndTime: string;
  /** New start_time to apply */
  newStartTime: string;
  /** New end_time to apply */
  newEndTime: string;
}

export interface WeeklySuggestions {
  weekStart: string;
  weekEnd: string;
  suggestions: ScheduleSuggestion[];
  totalMilesSaved: number;
  totalMinutesSaved: number;
}

// ============================================================================
// Analysis Input (shared by analyzer and suggester)
// ============================================================================

export interface AnalysisAppointment {
  id: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  startTime: string; // ISO datetime
  endTime: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  flexibility: SchedulingFlexibility;
}
