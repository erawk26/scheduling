/**
 * SQLite Manager - Local-First Database
 *
 * CRITICAL Requirements:
 * - <200ms for all operations
 * - Must work offline 72+ hours
 * - No blocking on network
 * - Transaction support for data integrity
 *
 * See: /docs/tech_requirements_guide.md lines 247-381
 * See: /docs/AI_GUARDRAILS.md lines 36-58
 */

import { Kysely } from 'kysely';
import type { Database } from './types';
import { runMigrations } from './migrations';
import { SQLiteWasmDialect } from './sqlite-wasm-dialect';

/**
 * SQLite Manager - Manages local SQLite WASM database
 */
export class SQLiteManager {
  private sqlite3: any = null;
  private db: any = null;
  private kysely: Kysely<Database> | null = null;
  private isInitialized = false;

  /**
   * Initialize SQLite WASM and create in-memory database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamic import for SQLite WASM (browser-only)
      const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;

      // Initialize SQLite WASM module
      this.sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      // Use OPFS for persistent storage; fall back to in-memory if unavailable
      const hasOpfs = typeof this.sqlite3?.oo1?.OpfsDb === 'function';
      if (hasOpfs) {
        this.db = new this.sqlite3.oo1.OpfsDb('ke-agenda.db');
      } else {
        console.warn('[SQLite] OPFS not available, using in-memory database. Data will not persist across refreshes.');
        this.db = new this.sqlite3.oo1.DB(':memory:', 'c');
      }

      // Run migrations to create schema
      await runMigrations(this.db);

      // Initialize Kysely with custom dialect
      this.kysely = new Kysely<Database>({
        dialect: new SQLiteWasmDialect(this.db),
      });

      this.isInitialized = true;
      console.log('[SQLite] Initialized successfully');
    } catch (error) {
      console.error('[SQLite] Initialization failed:', error);
      throw new Error(
        `SQLite initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get Kysely instance for type-safe queries
   */
  getKysely(): Kysely<Database> {
    if (!this.kysely) {
      throw new Error('SQLite not initialized. Call initialize() first.');
    }
    return this.kysely;
  }

  /**
   * Get raw SQLite database for direct operations
   */
  getRawDb(): any {
    if (!this.db) {
      throw new Error('SQLite not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (trx: Kysely<Database>) => Promise<T>
  ): Promise<T> {
    const kysely = this.getKysely();

    try {
      return await kysely.transaction().execute(callback);
    } catch (error) {
      console.error('[SQLite] Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data (for testing or reset)
   */
  async clearAllData(): Promise<void> {
    await this.transaction(async (trx) => {
      await trx.deleteFrom('sync_queue').execute();
      await trx.deleteFrom('query_cache').execute();
      await trx.deleteFrom('appointments').execute();
      await trx.deleteFrom('pets').execute();
      await trx.deleteFrom('clients').execute();
      await trx.deleteFrom('services').execute();
      await trx.deleteFrom('users').execute();
    });

    console.log('[SQLite] All data cleared');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    users: number;
    clients: number;
    pets: number;
    services: number;
    appointments: number;
    sync_queue: number;
    needs_sync: number;
  }> {
    const kysely = this.getKysely();

    const [
      users,
      clients,
      pets,
      services,
      appointments,
      sync_queue,
      needs_sync_appointments,
      needs_sync_clients,
      needs_sync_pets,
      needs_sync_services,
    ] = await Promise.all([
      kysely.selectFrom('users').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely.selectFrom('clients').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely.selectFrom('pets').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely.selectFrom('services').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely.selectFrom('appointments').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely.selectFrom('sync_queue').select((eb) => eb.fn.count('id').as('count')).executeTakeFirst(),
      kysely
        .selectFrom('appointments')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('needs_sync', '=', 1)
        .executeTakeFirst(),
      kysely
        .selectFrom('clients')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('needs_sync', '=', 1)
        .executeTakeFirst(),
      kysely
        .selectFrom('pets')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('needs_sync', '=', 1)
        .executeTakeFirst(),
      kysely
        .selectFrom('services')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('needs_sync', '=', 1)
        .executeTakeFirst(),
    ]);

    return {
      users: Number(users?.count ?? 0),
      clients: Number(clients?.count ?? 0),
      pets: Number(pets?.count ?? 0),
      services: Number(services?.count ?? 0),
      appointments: Number(appointments?.count ?? 0),
      sync_queue: Number(sync_queue?.count ?? 0),
      needs_sync:
        Number(needs_sync_appointments?.count ?? 0) +
        Number(needs_sync_clients?.count ?? 0) +
        Number(needs_sync_pets?.count ?? 0) +
        Number(needs_sync_services?.count ?? 0),
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.kysely) {
      await this.kysely.destroy();
      this.kysely = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.isInitialized = false;
    console.log('[SQLite] Database closed');
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.kysely !== null;
  }
}

/**
 * Singleton instance for application-wide use
 */
let sqliteManagerInstance: SQLiteManager | null = null;

/**
 * Get or create SQLite manager instance
 */
export function getSQLiteManager(): SQLiteManager {
  if (!sqliteManagerInstance) {
    sqliteManagerInstance = new SQLiteManager();
  }
  return sqliteManagerInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetSQLiteManager(): void {
  if (sqliteManagerInstance) {
    sqliteManagerInstance.close();
    sqliteManagerInstance = null;
  }
}
