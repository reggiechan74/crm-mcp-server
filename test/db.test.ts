import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/db.js';

/**
 * Regression coverage for the node:sqlite migration (v0.7.0).
 *
 * The original bug: the MCP server booted by require()-ing the native
 * better-sqlite3 addon, which the plugin updater wiped on every version bump,
 * producing "Failed to reconnect to crm". These tests pin the behaviour of the
 * built-in driver the server now depends on: FTS5 search, transactions, and
 * BLOB round-trips for embeddings — none of which need a native node_module.
 */
describe('openDatabase (node:sqlite adapter)', () => {
  it('supports FTS5 full-text search through the Database interface', () => {
    const db = openDatabase(':memory:');
    db.exec(
      `CREATE VIRTUAL TABLE content_fts USING fts5(contact_id, section, content, tokenize='porter unicode61')`,
    );
    const insert = db.prepare(
      'INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)',
    );
    insert.run('CL-1', 'profile', 'Reggie Chan commercial real estate broker');
    insert.run('CL-2', 'profile', 'unrelated note about gardening');

    const rows = db
      .prepare('SELECT contact_id FROM content_fts WHERE content_fts MATCH ?')
      .all('"broker"');
    expect(rows).toHaveLength(1);
    expect(rows[0].contact_id).toBe('CL-1');
    db.close();
  });

  it('commits all writes inside a transaction', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, n TEXT)');
    const insert = db.prepare('INSERT INTO t (n) VALUES (?)');
    const run = db.transaction((names: string[]) => {
      for (const n of names) insert.run(n);
    });
    run(['a', 'b', 'c']);
    const count = db.prepare('SELECT COUNT(*) AS c FROM t').get();
    expect(count.c).toBe(3);
    db.close();
  });

  it('rolls back the whole transaction when the body throws', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, n TEXT)');
    const insert = db.prepare('INSERT INTO t (n) VALUES (?)');
    insert.run('keep');
    const run = db.transaction(() => {
      insert.run('rolled-back');
      throw new Error('boom');
    });
    expect(() => run()).toThrow('boom');
    const count = db.prepare('SELECT COUNT(*) AS c FROM t').get();
    expect(count.c).toBe(1); // only the pre-transaction 'keep' row survives
    db.close();
  });

  it('round-trips BLOB values as bytes (embedding storage)', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE e (id INTEGER PRIMARY KEY, v BLOB)');
    const vec = new Float32Array([0.1, 0.2, 0.3]);
    db.prepare('INSERT INTO e (v) VALUES (?)').run(Buffer.from(vec.buffer));
    const row = db.prepare('SELECT v FROM e').get();
    const out = new Float32Array(
      row.v.buffer,
      row.v.byteOffset,
      row.v.byteLength / 4,
    );
    expect(Array.from(out).map((x) => Math.round(x * 10) / 10)).toEqual([0.1, 0.2, 0.3]);
    db.close();
  });
});
