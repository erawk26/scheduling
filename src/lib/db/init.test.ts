/**
 * Database Initialization Tests
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';
import { initializeDatabase, isDatabaseInitialized } from './init';

const REQUIRED_TABLES = ['user', 'session', 'account', 'verification', 'jwks', 'users'];

let tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ke-db-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tmpDirs = [];
});

describe('initializeDatabase', () => {
  it('creates all required tables on a fresh database', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'test.db');

    initializeDatabase(dbPath);

    const db = new Database(dbPath);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    db.close();

    const tableNames = rows.map((r) => r.name);
    for (const table of REQUIRED_TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it('is idempotent - safe to call multiple times', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'test.db');

    expect(() => {
      initializeDatabase(dbPath);
      initializeDatabase(dbPath);
      initializeDatabase(dbPath);
    }).not.toThrow();
  });

  it('tables still exist after multiple calls', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'test.db');

    initializeDatabase(dbPath);
    initializeDatabase(dbPath);

    const db = new Database(dbPath);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    db.close();

    const tableNames = rows.map((r) => r.name);
    for (const table of REQUIRED_TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it('handles a corrupt database file by deleting and recreating', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'corrupt.db');

    // Write garbage bytes to simulate a corrupt DB
    writeFileSync(dbPath, Buffer.from('this is not a valid sqlite database file!!!'));

    // Should not throw - should delete corrupt file and create fresh DB
    expect(() => initializeDatabase(dbPath)).not.toThrow();

    // The DB should now be valid and initialized
    expect(isDatabaseInitialized(dbPath)).toBe(true);
  });

  it('creates indexes without error', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'test.db');

    expect(() => initializeDatabase(dbPath)).not.toThrow();

    const db = new Database(dbPath);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    db.close();

    const indexNames = indexes.map((r) => r.name);
    expect(indexNames).toContain('idx_session_userId');
    expect(indexNames).toContain('idx_session_token');
    expect(indexNames).toContain('idx_account_userId');
    expect(indexNames).toContain('idx_verification_identifier');
  });
});

describe('isDatabaseInitialized', () => {
  it('returns false for a missing file', () => {
    expect(isDatabaseInitialized('/tmp/ke-nonexistent-db-99999.db')).toBe(false);
  });

  it('returns false for an empty (no tables) database', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'empty.db');

    const db = new Database(dbPath);
    db.close();

    expect(isDatabaseInitialized(dbPath)).toBe(false);
  });

  it('returns true after initializeDatabase completes', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'test.db');

    initializeDatabase(dbPath);

    expect(isDatabaseInitialized(dbPath)).toBe(true);
  });

  it('returns false for a corrupt file', () => {
    const dir = makeTempDir();
    const dbPath = join(dir, 'corrupt.db');
    writeFileSync(dbPath, Buffer.from('not sqlite data'));

    expect(isDatabaseInitialized(dbPath)).toBe(false);
  });
});
