/**
 * Database Types - SQLite WASM with Kysely
 *
 * CRITICAL: These types MUST match PostgreSQL schema exactly
 * See: /docs/tech_requirements_guide.md lines 247-381
 */

import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

// ============================================================================
// Core Tables (Mirror PostgreSQL + Local Fields)
// ============================================================================

export interface UsersTable {
  id: string;
  business_name: string | null;
  phone: string | null;
  timezone: string;
  service_area_miles: number;
  business_latitude: number | null;
  business_longitude: number | null;
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: string | null;
  // Local-only fields
  needs_sync: number; // SQLite BOOLEAN (0 or 1)
  sync_operation: 'INSERT' | 'UPDATE' | 'DELETE' | null;
}

export interface ClientsTable {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  scheduling_flexibility: 'unknown' | 'flexible' | 'fixed';
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: string | null;
  deleted_at: string | null;
  // Local-only fields
  needs_sync: number;
  sync_operation: 'INSERT' | 'UPDATE' | 'DELETE' | null;
}

export interface PetsTable {
  id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  size: string | null;
  age_years: number | null;
  weight_lbs: number | null;
  behavior_notes: string | null;
  medical_notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: string | null;
  deleted_at: string | null;
  // Local-only fields
  needs_sync: number;
  sync_operation: 'INSERT' | 'UPDATE' | 'DELETE' | null;
}

export interface ServicesTable {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  weather_dependent: number;
  location_type: string;
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: string | null;
  deleted_at: string | null;
  // Local-only fields
  needs_sync: number;
  sync_operation: 'INSERT' | 'UPDATE' | 'DELETE' | null;
}

export interface AppointmentsTable {
  id: string;
  user_id: string;
  client_id: string;
  pet_id: string | null;
  service_id: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  location_type: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  internal_notes: string | null;
  weather_alert: number;
  created_at: string;
  updated_at: string;
  version: number;
  synced_at: string | null;
  deleted_at: string | null;
  // Local-only fields
  needs_sync: number;
  sync_operation: 'INSERT' | 'UPDATE' | 'DELETE' | null;
}

// ============================================================================
// Local-Only Tables
// ============================================================================

export interface QueryCacheTable {
  query_key: string;
  data: string; // JSON serialized
  timestamp: number;
  stale_time: number;
  gc_time: number;
}

export interface SyncQueueTable {
  id: Generated<number>;
  mutation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  data: string; // JSON serialized
  created_at: number;
  attempts: number;
  last_error: string | null;
  retry_after: number | null;
}

// ============================================================================
// Database Interface
// ============================================================================

export interface Database {
  users: UsersTable;
  clients: ClientsTable;
  pets: PetsTable;
  services: ServicesTable;
  appointments: AppointmentsTable;
  query_cache: QueryCacheTable;
  sync_queue: SyncQueueTable;
}

// ============================================================================
// Helper Types for CRUD Operations
// ============================================================================

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type Client = Selectable<ClientsTable>;
export type NewClient = Insertable<ClientsTable>;
export type ClientUpdate = Updateable<ClientsTable>;

export type Pet = Selectable<PetsTable>;
export type NewPet = Insertable<PetsTable>;
export type PetUpdate = Updateable<PetsTable>;

export type Service = Selectable<ServicesTable>;
export type NewService = Insertable<ServicesTable>;
export type ServiceUpdate = Updateable<ServicesTable>;

export type Appointment = Selectable<AppointmentsTable>;
export type NewAppointment = Insertable<AppointmentsTable>;
export type AppointmentUpdate = Updateable<AppointmentsTable>;

export type QueryCache = Selectable<QueryCacheTable>;
export type NewQueryCache = Insertable<QueryCacheTable>;

export type SyncQueueItem = Selectable<SyncQueueTable>;
export type NewSyncQueueItem = Insertable<SyncQueueTable>;

// ============================================================================
// Sync Types
// ============================================================================

export interface SyncStatus {
  pending_items: number;
  last_sync: Date | null;
  is_syncing: boolean;
  last_error: string | null;
}

export interface SyncResult {
  success: boolean;
  synced_count: number;
  failed_count: number;
  errors: Array<{ id: number; error: string }>;
}

export interface ConflictResolution {
  strategy: 'local_wins' | 'server_wins' | 'last_write_wins';
  local_version: number;
  server_version: number;
}
