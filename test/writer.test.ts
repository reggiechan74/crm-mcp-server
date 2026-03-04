import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore, type Store } from '../src/store.js';
import { appendLog, updateField } from '../src/writer.js';

let store: Store;
let tempDir: string;

beforeEach(() => {
  // Copy fixtures to temp dir so writes don't pollute test data
  tempDir = mkdtempSync(join(tmpdir(), 'crm-test-'));
  cpSync(join(import.meta.dirname, 'fixtures'), tempDir, { recursive: true });
  store = createStore(':memory:', tempDir);
  store.indexAll();
});

afterEach(() => {
  store.close();
});

describe('appendLog', () => {
  it('appends interaction row to log.md file', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Email',
      summary: 'Discussed project timeline',
      outcome: 'Agreed on March deadline',
      nextStep: 'Send proposal by Friday',
    });
    // Verify the file on disk was updated
    const logPath = join(tempDir, 'Network', 'TEST_Contact', 'log.md');
    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('Discussed project timeline');
    expect(content).toContain('2026-03-04');
    expect(content).toContain('Send proposal by Friday');
  });

  it('updates cache so getSection returns new content', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Call',
      summary: 'Quick check-in call',
    });
    const content = store.getSection('NE-TESCON-001', 'log');
    expect(content).toContain('Quick check-in call');
  });

  it('preserves existing log entries', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Email',
      summary: 'New interaction',
    });
    const logPath = join(tempDir, 'Network', 'TEST_Contact', 'log.md');
    const content = readFileSync(logPath, 'utf-8');
    // Original entry should still be there
    expect(content).toContain('Introductory email');
    // New entry should be there too
    expect(content).toContain('New interaction');
  });
});

describe('updateField', () => {
  it('updates YAML frontmatter field in INDEX.md', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('status: DORMANT');
  });

  it('updates lastUpdated timestamp', () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain(`lastUpdated: ${today}`);
  });

  it('preserves file body after YAML update', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    // Body should still be intact
    expect(content).toContain('EXECUTIVE SUMMARY');
    expect(content).toContain('Test contact for unit tests');
  });

  it('invalidates cache after update', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const content = store.getSection('NE-TESCON-001', 'index');
    expect(content).toContain('DORMANT');
  });
});
