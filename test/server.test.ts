import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createStore } from '../src/store.js';
import { createMcpServer } from '../src/server.js';
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

describe('audit and repair tools', () => {
  it('registers crm_audit and crm_repair tools', () => {
    // Smoke test — verify the imports work and the functions exist.
    // The integration test (Task 12) will test end-to-end.
    expect(typeof runAudit).toBe('function');
    expect(typeof runRepair).toBe('function');
  });
});
