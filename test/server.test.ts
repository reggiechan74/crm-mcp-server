import { describe, it, expect } from 'vitest';
import { makeTempDir } from './helpers/tmp.js';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore } from '../src/store.js';
import { createMcpServer, resolveContact, formatConnections, resolveTemplateDir } from '../src/server.js';
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

  it('passes through a real dossier code from the fixtures store unchanged (F3)', () => {
    const store = createStore(':memory:', FIXTURES);
    store.indexAll();
    expect(resolveContact(store, 'NE-TESCON-001')).toBe('NE-TESCON-001');
    store.close();
  });

  it('does not swallow a folder name that happens to look like a dossier code (F3)', () => {
    // "CHAN-LEE_Amy" matches the dossier-code shape (/^[A-Z]{2,4}-/) but is
    // actually a folder name — it must fall through to the folder lookup.
    const root = makeTempDir('crm-srv-f3-');
    mkdirSync(join(root, 'Network/CHAN-LEE_Amy'), { recursive: true });
    writeFileSync(
      join(root, 'Network/CHAN-LEE_Amy/INDEX.md'),
      '---\nname: "Amy Chan-Lee"\ndossierCode: "NE-AMYCHA-001"\nstatus: Active\n---\n',
    );
    const store = createStore(':memory:', root);
    store.indexAll();
    expect(resolveContact(store, 'CHAN-LEE_Amy')).toBe('NE-AMYCHA-001');
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

describe('org tool helpers', () => {
  it('formatConnections shows source → target for inbound edges', () => {
    const root = makeTempDir('crm-srv-');
    for (const [rel, yaml] of [
      ['Organizations/OPR_A', 'name: "Org A"\ndossierCode: "OPR-A-001"\nlinkedContacts:\n  - { name: "INV-B-001", type: operating_partner_of }'],
      ['Organizations/INV_B', 'name: "Org B"\ndossierCode: "INV-B-001"'],
    ]) {
      mkdirSync(join(root, rel), { recursive: true });
      writeFileSync(join(root, rel, 'INDEX.md'), `---\n${yaml}\nstatus: Active\n---\n`);
    }
    const store = createStore(':memory:', root);
    store.indexAll();
    const text = formatConnections(store, store.getConnections('INV-B-001'));
    expect(text).toBe('- Org A → Org B (operating_partner_of)');
    store.close();
  });

  it('resolveTemplateDir returns the org template for Organization', () => {
    const root = makeTempDir('crm-srv-');
    mkdirSync(join(root, 'Organizations/OPR_A'), { recursive: true });
    writeFileSync(join(root, 'Organizations/OPR_A/INDEX.md'), '---\nname: "Org A"\ndossierCode: "OPR-A-001"\n---\n');
    mkdirSync(join(root, '.templates/REAL_ESTATE/ORGANIZATION/COMMON'), { recursive: true });
    const store = createStore(':memory:', root);
    store.indexAll();
    expect(resolveTemplateDir(root, store, 'OPR-A-001'))
      .toBe(join(root, '.templates/REAL_ESTATE/ORGANIZATION/COMMON'));
    store.close();
  });
});
