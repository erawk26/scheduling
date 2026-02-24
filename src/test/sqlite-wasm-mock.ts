/**
 * SQLite WASM Mock for Vitest
 *
 * Replaces @sqlite.org/sqlite-wasm with a better-sqlite3-backed implementation
 * that matches the oo1.DB interface used by SQLiteManager and SQLiteWasmDialect.
 *
 * Interface requirements (from sqlite-wasm-dialect.ts):
 *   db.prepare(sql)              -> stmt
 *   stmt.bind(params)            -> void
 *   stmt.step()                  -> boolean (true = row available)
 *   stmt.get({})                 -> object (column-name keyed row)
 *   stmt.finalize()              -> void
 *   db.changes()                 -> number
 *   db.exec(sql, opts?)          -> resultRows[] when opts.returnValue = 'resultRows'
 *   db.close()                   -> void
 *
 * runMigrations calls db.exec(sql) with multi-statement DDL strings.
 */

import Database from 'better-sqlite3';

/**
 * Wraps a better-sqlite3 Statement to match the sqlite-wasm oo1 statement API.
 */
class OO1Statement {
  private stmt: Database.Statement;
  private params: unknown[] = [];
  private rows: Record<string, unknown>[] = [];
  private rowIndex = 0;
  private stepped = false;

  constructor(stmt: Database.Statement, _db: Database.Database) {
    this.stmt = stmt;
  }

  bind(params: unknown[]): void {
    this.params = params ?? [];
  }

  /**
   * Advance the cursor. Returns true if a row is available.
   * For non-SELECT statements, executes and returns false.
   */
  step(): boolean {
    if (!this.stepped) {
      this.stepped = true;
      if (this.stmt.reader) {
        // SELECT - materialize all rows upfront then iterate
        this.rows = this.stmt.all(...this.params) as Record<string, unknown>[];
        this.rowIndex = 0;
      } else {
        // INSERT / UPDATE / DELETE
        this.stmt.run(...this.params);
        return false;
      }
    }

    if (this.rowIndex < this.rows.length) {
      this.rowIndex++;
      return true;
    }
    return false;
  }

  /**
   * Return the current row as a column-name keyed object.
   * Called after step() returns true.
   */
  get(_hint: Record<string, unknown>): Record<string, unknown> {
    return this.rows[this.rowIndex - 1] ?? {};
  }

  finalize(): void {
    // better-sqlite3 statements don't need explicit finalization
  }
}

/**
 * Wraps a better-sqlite3 Database to match the sqlite-wasm oo1.DB API.
 */
class OO1DB {
  private db: Database.Database;

  constructor(_filename: string) {
    // Always use in-memory for tests regardless of filename
    this.db = new Database(':memory:');
    // Enable WAL for better concurrency simulation
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Execute one or more SQL statements.
   * When opts.returnValue === 'resultRows', returns array of row arrays.
   */
  exec(
    sql: string,
    opts?: { returnValue?: string }
  ): unknown[][] | undefined {
    if (opts?.returnValue === 'resultRows') {
      // Execute as a query and return rows as arrays
      const stmt = this.db.prepare(sql);
      const rows = stmt.all() as Record<string, unknown>[];
      return rows.map((row) => Object.values(row));
    }

    // Multi-statement DDL support: split on semicolons and execute each
    // better-sqlite3's exec() handles multi-statement strings natively
    this.db.exec(sql);
    return undefined;
  }

  /**
   * Prepare a statement, returning an OO1Statement wrapper.
   */
  prepare(sql: string): OO1Statement {
    const stmt = this.db.prepare(sql);
    return new OO1Statement(stmt, this.db);
  }

  /**
   * Return the number of rows changed by the last DML statement.
   */
  changes(): number {
    return this.db.prepare('SELECT changes()').pluck().get() as number;
  }

  /**
   * Close the database.
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Mock sqlite3InitModule that matches the real @sqlite.org/sqlite-wasm default export.
 * Returns an object with oo1.DB matching the production interface.
 */
async function sqlite3InitModule(
  _opts?: { print?: (msg: string) => void; printErr?: (msg: string) => void }
): Promise<{ oo1: { DB: typeof OO1DB; OpfsDb?: undefined } }> {
  return {
    oo1: {
      DB: OO1DB,
      // OpfsDb is intentionally absent so SQLiteManager falls back to in-memory
    },
  };
}

export default sqlite3InitModule;
