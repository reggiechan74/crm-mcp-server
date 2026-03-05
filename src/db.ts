/**
 * Cross-runtime SQLite layer.
 * Detects Bun vs Node and loads the appropriate SQLite driver.
 */

import { createRequire } from 'node:module';

const esmRequire = createRequire(import.meta.url);

export const isBun = typeof (globalThis as any).Bun !== 'undefined';

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

export interface Statement {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

/**
 * Open a SQLite database using the appropriate driver for the runtime.
 */
export function openDatabase(path: string): Database {
  // Default to better-sqlite3 (Node.js)
  const BetterSqlite3 = esmRequire('better-sqlite3');
  const raw = new BetterSqlite3(path);

  // Enable WAL mode for better concurrent read performance
  raw.pragma('journal_mode = WAL');

  return raw as Database;
}

/**
 * Attempt to load the sqlite-vec extension for vector search support.
 * Fails silently if the extension is not available (e.g., in CI).
 */
export function loadSqliteVec(db: Database): boolean {
  try {
    const sqliteVec = esmRequire('sqlite-vec');
    sqliteVec.load(db);
    return true;
  } catch {
    // sqlite-vec not available — vector search will be disabled
    return false;
  }
}
