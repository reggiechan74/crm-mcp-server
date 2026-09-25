/**
 * Small filesystem helpers shared across the indexer, writer, audit and repair.
 */

import { readdirSync, renameSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep, dirname, basename } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Recursively collect all .md files under a directory, returning paths
 * relative to the root directory (POSIX separators are not forced).
 */
export function collectMdFiles(dir: string, root?: string): string[] {
  const base = root ?? dir;
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(relative(base, full));
    }
  }
  return results;
}

/**
 * Write a file atomically: write a sibling temp file, then rename over the
 * target. A crash mid-write leaves the original file intact.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const tmp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, filePath);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/** True when `child` resolves to `parent` itself or a path inside it. */
export function isWithin(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/** Normalize a YAML date-ish value (Date or string) to a string, or null. */
export function formatDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

/** Today's date as YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Stable hash over every .md file in a dossier (relative path + content). */
export function hashMdTree(dir: string): string {
  const hash = createHash('sha256');
  for (const rel of collectMdFiles(dir).sort()) {
    hash.update(rel);
    hash.update('\0');
    hash.update(readFileSync(join(dir, rel)));
    hash.update('\0');
  }
  return hash.digest('hex');
}
