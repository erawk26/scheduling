/**
 * GraphHopper API Types
 *
 * Types for Geocoding, VRP Route Optimization, and credit tracking.
 * Free tier: 500 credits/day, 1 vehicle max, ~1 req/sec.
 */

// ============================================================================
// Geocoding
// ============================================================================

export interface GeocodingHit {
  point: { lat: number; lng: number };
  name: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface GeocodingApiResponse {
  hits: GeocodingHit[];
  took: number;
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  formatted_address: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

// ============================================================================
// VRP (Vehicle Routing Problem) - Route Optimization
// ============================================================================

export interface VRPAddress {
  location_id: string;
  lat: number;
  lon: number;
}

export interface VRPShift {
  start_address: VRPAddress;
  end_address?: VRPAddress;
  earliest_start?: number;
  latest_end?: number;
}

export interface VRPVehicle {
  vehicle_id: string;
  type_id: string;
  shifts: VRPShift[];
}

export interface VRPVehicleType {
  type_id: string;
  profile: string;
}

export interface VRPService {
  id: string;
  address: VRPAddress;
  duration: number;
  time_windows?: Array<{ earliest: number; latest: number }>;
}

export interface VRPRequest {
  vehicles: VRPVehicle[];
  vehicle_types: VRPVehicleType[];
  services: VRPService[];
  configuration?: {
    routing?: {
      calc_points?: boolean;
    };
  };
}

export interface VRPActivity {
  type: 'start' | 'service' | 'end';
  id?: string;
  location_id?: string;
  address?: VRPAddress;
  arr_time: number;
  end_time: number;
  distance?: number;
  driving_time?: number;
}

export interface VRPRoute {
  vehicle_id: string;
  distance: number;
  transport_time: number;
  activities: VRPActivity[];
  points?: string; // encoded polyline
}

export interface VRPSolution {
  distance: number;
  transport_time: number;
  completion_time: number;
  no_unassigned: number;
  routes: VRPRoute[];
  unassigned?: {
    services: string[];
    details?: Array<{ id: string; code: number; reason: string }>;
  };
}

export interface VRPResponse {
  status: string;
  processing_time: number;
  solution: VRPSolution;
}

// ============================================================================
// Optimization Result (app-level)
// ============================================================================

export interface OptimizedStop {
  id: string;
  arrivalTimeS: number;
  departureTimeS: number;
  distanceM: number;
  drivingTimeS: number;
}

export interface OptimizationResult {
  stops: OptimizedStop[];
  totalDistanceM: number;
  totalTimeS: number;
  polyline?: string;
  source: 'graphhopper' | 'local';
}

// ============================================================================
// Credit Tracking
// ============================================================================

export interface CreditUsage {
  date: string; // YYYY-MM-DD
  used: number;
  limit: number;
}

// ============================================================================
// API Error
// ============================================================================

export interface GraphHopperError {
  message: string;
  hints?: Array<{ message: string }>;
}

// ============================================================================
// Rate Limiter
// ============================================================================

export interface RateLimiterConfig {
  maxPerSecond: number;
  maxCreditsPerDay: number;
  warnAtPercent: number;
  hardStopAtPercent: number;
}

export const DEFAULT_RATE_CONFIG: RateLimiterConfig = {
  maxPerSecond: 1,
  maxCreditsPerDay: 500,
  warnAtPercent: 80,
  hardStopAtPercent: 95,
};
