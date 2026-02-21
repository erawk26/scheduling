/**
 * SQLite Migrations
 *
 * Schema matches PostgreSQL exactly with local-only additions
 * See: /docs/tech_requirements_guide.md lines 247-381
 */

export const SQLITE_MIGRATIONS = [
  // Migration 1: Initial Schema
  `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    business_name TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    service_area_miles INTEGER DEFAULT 25,
    business_latitude REAL,
    business_longitude REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    synced_at TEXT,
    needs_sync INTEGER DEFAULT 0,
    sync_operation TEXT
  );

  -- Clients table
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    synced_at TEXT,
    deleted_at TEXT,
    needs_sync INTEGER DEFAULT 0,
    sync_operation TEXT
  );

  -- Pets table
  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    size TEXT,
    age_years INTEGER,
    weight_lbs REAL,
    behavior_notes TEXT,
    medical_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    synced_at TEXT,
    deleted_at TEXT,
    needs_sync INTEGER DEFAULT 0,
    sync_operation TEXT
  );

  -- Services table
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER,
    weather_dependent INTEGER DEFAULT 0,
    location_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    synced_at TEXT,
    deleted_at TEXT,
    needs_sync INTEGER DEFAULT 0,
    sync_operation TEXT
  );

  -- Appointments table
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    pet_id TEXT,
    service_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    location_type TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    notes TEXT,
    internal_notes TEXT,
    weather_alert INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    synced_at TEXT,
    deleted_at TEXT,
    needs_sync INTEGER DEFAULT 0,
    sync_operation TEXT
  );

  -- Query cache for TanStack Query
  CREATE TABLE IF NOT EXISTS query_cache (
    query_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    stale_time INTEGER NOT NULL,
    gc_time INTEGER NOT NULL
  );

  -- Sync queue for offline mutations
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    retry_after INTEGER
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_clients_user_id
    ON clients(user_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_pets_client_id
    ON pets(client_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_services_user_id
    ON services(user_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_appointments_user_date
    ON appointments(user_id, start_time, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_appointments_client
    ON appointments(client_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_processing
    ON sync_queue(created_at, attempts);

  CREATE INDEX IF NOT EXISTS idx_needs_sync_appointments
    ON appointments(needs_sync) WHERE needs_sync = 1;

  CREATE INDEX IF NOT EXISTS idx_needs_sync_clients
    ON clients(needs_sync) WHERE needs_sync = 1;

  CREATE INDEX IF NOT EXISTS idx_needs_sync_pets
    ON pets(needs_sync) WHERE needs_sync = 1;

  CREATE INDEX IF NOT EXISTS idx_needs_sync_services
    ON services(needs_sync) WHERE needs_sync = 1;
  `,
];

/**
 * Incremental ALTER TABLE migrations for existing databases.
 * Each runs independently; "duplicate column" errors are silently ignored.
 */
const ALTER_MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN business_latitude REAL`,
  `ALTER TABLE users ADD COLUMN business_longitude REAL`,
];

/**
 * Run all migrations on a SQLite database
 */
export async function runMigrations(db: any): Promise<void> {
  try {
    for (const migration of SQLITE_MIGRATIONS) {
      await db.exec(migration);
    }

    // Run ALTER TABLE migrations (ignore "duplicate column" errors)
    for (const alter of ALTER_MIGRATIONS) {
      try {
        await db.exec(alter);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('duplicate column')) throw e;
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to run migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if migrations have been run
 */
export async function hasMigrations(db: any): Promise<boolean> {
  try {
    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    return result.length > 0;
  } catch {
    return false;
  }
}
