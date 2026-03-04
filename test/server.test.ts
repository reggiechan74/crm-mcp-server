import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createStore } from '../src/store.js';
import { createMcpServer } from '../src/server.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

describe('MCP server', () => {
  it('creates server with all tools registered', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    const config = { crmRoot: FIXTURES, dbPath: ':memory:', embeddingModel: 'test' };
    const server = createMcpServer(store, config);
    expect(server).toBeDefined();
    store.close();
  });
});
