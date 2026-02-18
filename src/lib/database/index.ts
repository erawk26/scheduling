/**
 * Database Module - Central Export
 *
 * Local-first SQLite WASM with Kysely type-safe queries
 * All operations <200ms, works offline 72+ hours
 */

// Core SQLite Manager
export { SQLiteManager, getSQLiteManager, resetSQLiteManager } from './sqlite-manager';

// Sync Engine
export {
  SyncEngine,
  createLocalFirst,
  updateLocalFirst,
  deleteLocalFirst,
} from './sync-engine';

// Types
export type {
  Database,
  User,
  NewUser,
  UserUpdate,
  Client,
  NewClient,
  ClientUpdate,
  Pet,
  NewPet,
  PetUpdate,
  Service,
  NewService,
  ServiceUpdate,
  Appointment,
  NewAppointment,
  AppointmentUpdate,
  QueryCache,
  NewQueryCache,
  SyncQueueItem,
  NewSyncQueueItem,
  SyncStatus,
  SyncResult,
  ConflictResolution,
} from './types';

// Migrations
export { SQLITE_MIGRATIONS, runMigrations, hasMigrations } from './migrations';
