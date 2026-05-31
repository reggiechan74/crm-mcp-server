/**
 * SQLite layer backed by Node's built-in node:sqlite driver.
 *
 * Using the built-in driver (Node >= 22.5) instead of the native better-sqlite3
 * addon means the bundled MCP server has ZERO native node_modules to load at
 * runtime. That is what lets the plugin survive a marketplace re-clone on every
 * update without a reinstall step — the esbuild bundle plus node:sqlite is fully
 * self-contained. See docs/plugin-distribution-investigation.md.
 */

import { createRequire } from 'node:module';

const esmRequire = createRequire(import.meta.url);

export const isBun = typeof (globalThis as any).Bun !== 'undefined';

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  // Runs fn inside a single BEGIN/COMMIT transaction (ROLLBACK on throw) and
  // returns a callable, matching better-sqlite3's db.transaction() shape.
  transaction<F extends (...args: any[]) => any>(fn: F): F;
  close(): void;
}

export interface Statement {
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

// node:sqlite is still flagged experimental and prints a warning to stderr on
// first use. It is harmless (stdout carries the MCP protocol, not stderr) but
// noisy in logs, so we filter just this one message.
let warningFilterInstalled = false;
function suppressSqliteExperimentalWarning(): void {
  if (warningFilterInstalled) return;
  warningFilterInstalled = true;
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: any, ...args: any[]) => {
    const message = typeof warning === 'string' ? warning : warning?.message;
    if (message && message.includes('SQLite is an experimental feature')) return;
    return (original as any)(warning, ...args);
  }) as typeof process.emitWarning;
}

function wrapDatabase(raw: any): Database {
  return {
    exec: (sql: string) => raw.exec(sql),
    prepare: (sql: string): Statement => raw.prepare(sql),
    transaction: (<F extends (...args: any[]) => any>(fn: F): F => {
      return ((...args: any[]) => {
        raw.exec('BEGIN');
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            raw.exec('ROLLBACK');
          } catch {
            // ignore rollback failure — surface the original error below
          }
          throw err;
        }
      }) as F;
    }),
    close: () => raw.close(),
  };
}

/**
 * Open a SQLite database using Node's built-in node:sqlite driver.
 */
export function openDatabase(path: string): Database {
  suppressSqliteExperimentalWarning();
  const { DatabaseSync } = esmRequire('node:sqlite');
  const raw = new DatabaseSync(path);

  // Enable WAL mode for better concurrent read performance.
  raw.exec('PRAGMA journal_mode = WAL');

  return wrapDatabase(raw);
}

/**
 * Vector search is computed in-process with JS cosine similarity
 * (see embeddings.ts), so the native sqlite-vec extension is not required.
 * Kept as a no-op for backward compatibility with existing callers.
 */
export function loadSqliteVec(_db: Database): boolean {
  return false;
}
