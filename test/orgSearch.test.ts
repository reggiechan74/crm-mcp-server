import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createDossier, updateField } from '../src/writer.js';
import { parseFrontmatter } from '../src/frontmatter.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
let root: string;
let store: Store;

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION'), join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
  createDossier(store, root, { name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV'], roles: ['Client'] });
  createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES', roles: ['Lender'] });
  createDossier(store, root, { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY' });
});

afterEach(() => store.close());

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

describe('org search', () => {
  it('orgType matches primary or secondary types', () => {
    expect(ids(store.searchContacts({ orgType: 'PM' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgType: 'pm' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgType: 'BRK' }))).toEqual(['BRK-CBRE-001']);
  });

  it('orgGroup matches any type in the group', () => {
    expect(ids(store.searchContacts({ orgGroup: 'OPERATORS' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgGroup: 'lending' }))).toEqual(['DEBT-ARES-001']);
    expect(ids(store.searchContacts({ orgGroup: 'OWNERS' }))).toEqual(['BRK-CBRE-001']);
    expect(() => store.searchContacts({ orgGroup: 'NOPE' })).toThrow(/Invalid org group: NOPE/);
  });

  it('combines type filters with roles', () => {
    expect(ids(store.searchContacts({ orgGroup: 'OPERATORS', roles: ['Client'] }))).toEqual(['BRK-CBRE-001']);
  });

  it('returns secondaryTypes on results', () => {
    const [cbre] = store.searchContacts({ query: 'CBRE' });
    expect(cbre.orgType).toBe('BRK');
    expect(cbre.secondaryTypes).toEqual(['PM', 'INV']);
  });

  it('handles scalar secondaryTypes in a hand-edited INDEX.md', () => {
    const p = join(root, 'Organizations', 'PM_Greystar', 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('secondaryTypes: []', 'secondaryTypes: brk, Inv'));
    store.indexOne('Organizations/PM_Greystar');
    expect(ids(store.searchContacts({ orgType: 'BRK' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgGroup: 'OWNERS' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(store.searchContacts({ query: 'Greystar' })[0].secondaryTypes).toEqual(['BRK', 'INV']);
  });
});

describe('org updates', () => {
  it('crm_update validates and normalizes secondaryTypes', () => {
    updateField(store, 'DEBT-ARES-001', 'index', 'secondaryTypes', 'svcr, debt, SVCR');
    const yaml = parseFrontmatter(readFileSync(join(root, 'Organizations', 'DEBT_Ares', 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['SVCR']);
    expect(() => updateField(store, 'DEBT-ARES-001', 'index', 'secondaryTypes', 'LND')).toThrow(/Invalid org type/);
  });

  it('crm_update normalizes orgType and removes it from secondaryTypes', () => {
    updateField(store, 'BRK-CBRE-001', 'index', 'orgType', ' pm ');
    const yaml = parseFrontmatter(readFileSync(join(root, 'Organizations', 'BRK_CBRE', 'INDEX.md'), 'utf-8'))!;
    expect(yaml.orgType).toBe('PM');
    expect(yaml.secondaryTypes).toEqual(['INV']);
    expect(store.getContactPath('BRK-CBRE-001')).toBe('Organizations/BRK_CBRE'); // code/folder unchanged
    expect(() => updateField(store, 'BRK-CBRE-001', 'index', 'orgType', 'LND')).toThrow(/Invalid org type/);
  });

  it('crm_update and creation accept roles in any case', () => {
    updateField(store, 'DEBT-ARES-001', 'index', 'roles', 'lender, BORROWER');
    const yaml = parseFrontmatter(readFileSync(join(root, 'Organizations', 'DEBT_Ares', 'INDEX.md'), 'utf-8'))!;
    expect(yaml.roles).toEqual(['Lender', 'Borrower']);
    const r = createDossier(store, root, { name: 'Case Co', category: 'Organization', orgType: 'pm', cid: 'CASE', roles: ['client'] });
    const idx = parseFrontmatter(readFileSync(join(root, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(idx.roles).toEqual(['Client']);
    expect(() => updateField(store, 'DEBT-ARES-001', 'index', 'roles', 'nope')).toThrow(/Invalid role/);
  });
});
