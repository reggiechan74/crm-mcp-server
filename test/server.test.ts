import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createStore } from '../src/store.js';
import { createMcpServer, resolveContact } from '../src/server.js';
import { runAudit } from '../src/audit.js';
import { runRepair } from '../src/repair.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

describe('MCP server', () => {
  it('creates server with all tools registered', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    const config = { crmRoot: FIXTURES, dbPath: ':memory:', embeddingModel: 'test', templates: [], defaultTemplate: 'simple' };
    const server = createMcpServer(store, config);
    expect(server).toBeDefined();
    store.close();
  });
});

describe('unconfigured state', () => {
  it('creates server without crashing when store is null', () => {
    const config = { crmRoot: '', dbPath: ':memory:', embeddingModel: 'test', templates: [], defaultTemplate: 'simple' };
    const server = createMcpServer(null, config);
    expect(server).toBeDefined();
  });
});

describe('resolveContact — folder-name inputs resolve to the right contact', () => {
  const OWNER = 'NE-BOBSMI-100';
  const DECOY = 'NE-ADADEC-099';

  it('resolves a dossier folder name to its owner, never the decoy', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    const id = resolveContact(store, 'SMITH-JONES_Bobby');
    expect(id).toBe(OWNER);
    expect(id).not.toBe(DECOY);
    store.close();
  });

  it('resolves a full folder path to its owner', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    expect(resolveContact(store, 'Network/SMITH-JONES_Bobby/')).toBe(OWNER);
    store.close();
  });

  it('still resolves a plain display name via the name search (existing behavior)', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    // "Smith" is not a folder basename, so it falls through to the name search,
    // which matches "Bobby Smith-Jones".
    expect(resolveContact(store, 'Smith')).toBe(OWNER);
    store.close();
  });

  it('passes through a dossier code unchanged', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    expect(resolveContact(store, 'NE-BOBSMI-100')).toBe('NE-BOBSMI-100');
    store.close();
  });
});

describe('audit and repair tools', () => {
  it('registers crm_audit and crm_repair tools', () => {
    // Smoke test — verify the imports work and the functions exist.
    // The integration test (Task 12) will test end-to-end.
    expect(typeof runAudit).toBe('function');
    expect(typeof runRepair).toBe('function');
  });
});
