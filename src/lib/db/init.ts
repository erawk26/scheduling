/**
 * Database Initialization
 *
 * Creates Better Auth tables in SQLite on first run.
 * This ensures the database schema exists before any auth operations.
 */

import Database from "better-sqlite3"

/**
 * Initialize database and create tables
 * Safe to call multiple times (uses IF NOT EXISTS)
 */
export function initializeDatabase(dbPath: string = "./sqlite.db"): void {
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

  // Create indexes for better performance
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
    CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
    CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
  `)

  sqlite.close()

  console.log("✅ Better Auth database tables initialized")
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(dbPath: string = "./sqlite.db"): boolean {
  try {
    const sqlite = new Database(dbPath)
    const result = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
    ).get()
    sqlite.close()
    return !!result
  } catch {
    return false
  }
}
