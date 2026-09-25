import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createMcpServer, TOOL_SUMMARIES } from '../src/server.js';
import type { Config } from '../src/types.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
let root: string;
let store: Store;

function config(salesMotion: 'general' | 'tech' = 'general'): Config {
  return { crmRoot: root, dbPath: ':memory:', embeddingModel: 't', templates: [], defaultTemplate: 'simple', templateRepo: 'o/r', salesMotion };
}

/** Call a registered tool's handler directly and return its text (footer stripped). */
async function call(server: any, name: string, args: Record<string, unknown>): Promise<string> {
  const tool = server._registeredTools[name];
  const parsed = tool.inputSchema ? tool.inputSchema.parse(args) : args;
  const res = await tool.handler(parsed, {});
  return res.content[0].text.split('\n<!--')[0];
}

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION'), join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
});
afterEach(() => store.close());

describe('org tools', () => {
  it('registers crm_org_types with a summary', () => {
    const server = createMcpServer(store, config()) as any;
    expect(server._registeredTools.crm_org_types).toBeDefined();
    expect(TOOL_SUMMARIES.crm_org_types).toBeTruthy();
  });

  it('crm_org_types returns the catalog', async () => {
    const text = await call(createMcpServer(store, config()), 'crm_org_types', { group: 'LENDING' });
    expect(text).toContain('DEBT — Debt fund / private lender');
  });

  it('crm_create uses config salesMotion, techSale overrides it both ways', async () => {
    const tech = createMcpServer(store, config('tech'));
    await call(tech, 'crm_create', { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY' });
    expect(existsSync(join(root, 'Organizations', 'PM_Greystar', 'tech-stack.md'))).toBe(true);
    await call(tech, 'crm_create', { name: 'Quiet PM', category: 'Organization', orgType: 'PM', cid: 'QPM', techSale: false });
    expect(existsSync(join(root, 'Organizations', 'PM_Quiet_PM', 'tech-stack.md'))).toBe(false);
    const general = createMcpServer(store, config('general'));
    await call(general, 'crm_create', { name: 'Loud PM', category: 'Organization', orgType: 'PM', cid: 'LPM', techSale: true });
    expect(existsSync(join(root, 'Organizations', 'PM_Loud_PM', 'tech-stack.md'))).toBe(true);
  });

  it('crm_create rejects techSale for people and reports warnings', async () => {
    const server = createMcpServer(store, config());
    expect(await call(server, 'crm_create', { name: 'Pat Person', category: 'Network', techSale: true }))
      .toMatch(/^Error: .*Organization dossiers only/);
  });

  it('crm_create schema offers type and role choices', () => {
    const server = createMcpServer(store, config()) as any;
    const schema = server._registeredTools.crm_create.inputSchema;
    expect(() => schema.parse({ name: 'X Y', category: 'Organization', orgType: 'LND' })).toThrow();
    expect(() => schema.parse({ name: 'X Y', category: 'Organization', orgType: 'DEBT', roles: ['Borrower'] })).not.toThrow();
  });

  it('crm_search filters by orgGroup and shows secondary types', async () => {
    const server = createMcpServer(store, config());
    await call(server, 'crm_create', { name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV'], roles: ['Client'] });
    const text = await call(server, 'crm_search', { orgGroup: 'OPERATORS' });
    expect(text).toContain('| BRK-CBRE-001 | CBRE | BRK (+PM, INV) [Client] |');
  });

  it('crm_update on orgType explains the code and folder are unchanged', async () => {
    const server = createMcpServer(store, config());
    await call(server, 'crm_create', { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES' });
    const text = await call(server, 'crm_update', { contact: 'DEBT-ARES-001', section: 'index', field: 'orgType', value: 'SVCR' });
    expect(text).toContain('dossier code and folder are unchanged');
    expect(text).toContain('crm_audit');
  });
});
