/**
 * SQLite WASM Dialect for Kysely
 *
 * Bridges Kysely's driver interface with SQLite WASM's API
 * See: https://sqlite.org/wasm/doc/trunk/api-oo1.md
 *
 * CRITICAL: SQLite WASM API is different from better-sqlite3
 * - Uses db.exec() for DDL
 * - Uses db.prepare().step() for queries
 * - NO .run() method exists
 */

import type {
  Driver,
  Dialect,
  DatabaseConnection,
  QueryResult,
  DatabaseIntrospector,
  Kysely,
} from 'kysely';
import {
  CompiledQuery,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';

/**
 * SQLite WASM Driver - Implements Kysely's Driver interface
 */
class SQLiteWasmDriver implements Driver {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async init(): Promise<void> {
    // Already initialized by SQLiteManager
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return new SQLiteWasmConnection(this.db);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('BEGIN'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }

  async releaseConnection(): Promise<void> {
    // Connection is shared, no need to release
  }

  async destroy(): Promise<void> {
    // Database is managed by SQLiteManager
  }
}

/**
 * SQLite WASM Connection - Implements Kysely's DatabaseConnection interface
 */
class SQLiteWasmConnection implements DatabaseConnection {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery;

    try {
      // Prepare statement
      const stmt = this.db.prepare(sql);

      try {
        // Bind parameters if any
        if (parameters && parameters.length > 0) {
          stmt.bind(parameters);
        }

        const rows: O[] = [];
        let numAffectedRows: bigint | undefined;

        // Execute query
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          // SELECT query - collect all rows
          while (stmt.step()) {
            const row = stmt.get({});
            rows.push(row as O);
          }
        } else {
          // INSERT/UPDATE/DELETE - execute and get affected rows
          stmt.step();
          numAffectedRows = BigInt(this.db.changes());
        }

        // Get insertId for INSERT statements
        let insertId: bigint | undefined;
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const lastId = this.db.exec(
            'SELECT last_insert_rowid() as id',
            { returnValue: 'resultRows' }
          );
          if (lastId && lastId.length > 0 && lastId[0] && lastId[0][0]) {
            insertId = BigInt(lastId[0][0]);
          }
        }

        return {
          rows,
          numAffectedRows,
          insertId,
        };
      } finally {
        // Always finalize statement to free resources
        stmt.finalize();
      }
    } catch (error) {
      throw new Error(
        `SQLite WASM query failed: ${error instanceof Error ? error.message : 'Unknown error'}\nSQL: ${sql}\nParameters: ${JSON.stringify(parameters)}`
      );
    }
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    _chunkSize: number
  ): AsyncIterableIterator<QueryResult<O>> {
    const { sql, parameters } = compiledQuery;

    try {
      const stmt = this.db.prepare(sql);

      try {
        if (parameters && parameters.length > 0) {
          stmt.bind(parameters);
        }

        const rows: O[] = [];
        while (stmt.step()) {
          const row = stmt.get({});
          rows.push(row as O);
        }

        yield {
          rows,
        };
      } finally {
        stmt.finalize();
      }
    } catch (error) {
      throw new Error(
        `SQLite WASM stream query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * SQLite WASM Dialect - Main dialect class for Kysely
 */
export class SQLiteWasmDialect implements Dialect {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  createAdapter() {
    return new SqliteAdapter();
  }

  createDriver(): Driver {
    return new SQLiteWasmDriver(this.db);
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }

  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }
}
