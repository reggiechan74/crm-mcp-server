import { afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const created: string[] = [];

// Registered at import time, so it runs after all tests of each importing
// file (vitest isolates modules per test file).
afterAll(() => {
  for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * mkdtemp under the OS temp dir, removed after the importing file's tests.
 * Test dossiers copy full template trees, so leaked dirs exhaust /tmp inodes.
 */
export function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}
