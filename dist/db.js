/**
 * Cross-runtime SQLite layer.
 * Detects Bun vs Node and loads the appropriate SQLite driver.
 */
import { createRequire } from 'node:module';
const esmRequire = createRequire(import.meta.url);
export const isBun = typeof globalThis.Bun !== 'undefined';
/**
 * Open a SQLite database using the appropriate driver for the runtime.
 */
export function openDatabase(path) {
    // Default to better-sqlite3 (Node.js)
    const BetterSqlite3 = esmRequire('better-sqlite3');
    const raw = new BetterSqlite3(path);
    // Enable WAL mode for better concurrent read performance
    raw.pragma('journal_mode = WAL');
    return raw;
}
/**
 * Attempt to load the sqlite-vec extension for vector search support.
 * Fails silently if the extension is not available (e.g., in CI).
 */
export function loadSqliteVec(db) {
    try {
        const sqliteVec = esmRequire('sqlite-vec');
        sqliteVec.load(db);
        return true;
    }
    catch {
        // sqlite-vec not available — vector search will be disabled
        return false;
    }
}
//# sourceMappingURL=db.js.map