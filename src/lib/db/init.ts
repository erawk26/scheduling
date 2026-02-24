/**
 * Database Initialization
 *
 * Creates Better Auth tables in SQLite on first run.
 * This ensures the database schema exists before any auth operations.
 *
 * Failsafe: handles corrupt/empty DB files by deleting and recreating.
 */

import Database from "better-sqlite3"
import { existsSync, unlinkSync } from "fs"

const REQUIRED_TABLES = ["user", "session", "account", "verification", "jwks", "users"]

/**
 * Initialize database and create tables
 * Safe to call multiple times (uses IF NOT EXISTS)
 * Handles corrupt files by deleting and starting fresh
 */
export function initializeDatabase(dbPath: string = "./sqlite.db"): void {
  // If file exists but is corrupt, delete it so better-sqlite3 creates a fresh one
  if (existsSync(dbPath)) {
    try {
      const test = new Database(dbPath)
      test.pragma("integrity_check")
      test.close()
    } catch {
      unlinkSync(dbPath)
      // Also clean up WAL/SHM files if they exist
      try { unlinkSync(dbPath + "-wal") } catch { /* ignore */ }
      try { unlinkSync(dbPath + "-shm") } catch { /* ignore */ }
    }
  }

  const sqlite = new Database(dbPath)

  // Create user table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      businessName TEXT,
      phone TEXT
    )
  `)

  // Create session table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `)

  // Create account table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      expiresAt INTEGER,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      password TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `)

  // Create verification table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `)

  // Create jwks table (for JWT plugin)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jwks (
      id TEXT PRIMARY KEY,
      publicKey TEXT NOT NULL,
      privateKey TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )
  `)

  // Create business users table (needed by auth hook on signup)
  sqlite.exec(`
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
      needs_sync INTEGER DEFAULT 1,
      sync_operation TEXT DEFAULT 'INSERT'
    )
  `)

  // Create indexes for better performance
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
  `)

  sqlite.close()
}

/**
 * Check if database has all required tables
 * Returns false if file is missing, corrupt, or any table is absent
 */
export function isDatabaseInitialized(dbPath: string = "./sqlite.db"): boolean {
  if (!existsSync(dbPath)) return false

  try {
    const sqlite = new Database(dbPath)
    const rows = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[]
    sqlite.close()

    const existing = new Set(rows.map((r) => r.name))
    return REQUIRED_TABLES.every((t) => existing.has(t))
  } catch {
    return false
  }
}
