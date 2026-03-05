/**
 * Cross-runtime SQLite layer.
 * Detects Bun vs Node and loads the appropriate SQLite driver.
 */
export declare const isBun: boolean;
export interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
}
export interface Statement {
    run(...params: any[]): {
        changes: number;
        lastInsertRowid: number | bigint;
    };
    get(...params: any[]): any;
    all(...params: any[]): any[];
}
/**
 * Open a SQLite database using the appropriate driver for the runtime.
 */
export declare function openDatabase(path: string): Database;
/**
 * Attempt to load the sqlite-vec extension for vector search support.
 * Fails silently if the extension is not available (e.g., in CI).
 */
export declare function loadSqliteVec(db: Database): boolean;
