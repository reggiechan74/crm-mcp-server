import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createDossier, updateField } from '../src/writer.js';
import { auditContact, repairContact, resolveTemplateDirs } from '../src/maintenance.js';
import { buildRoutingTable } from '../src/audit.js';
import { parseFrontmatter } from '../src/frontmatter.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const ORG_SRC = join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION');
let root: string;
let store: Store;

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(ORG_SRC, join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
});
afterEach(() => store.close());

describe('layered routing table', () => {
  it('a later layer replaces an earlier layer\'s headings for the same file', () => {
    const table = buildRoutingTable([join(ORG_SRC, 'COMMON'), join(ORG_SRC, 'MOTION', 'TECH_SALE')]);
    expect(table.get('## I. ACCOUNT SUMMARY')).toBe('pipeline.md');
    expect(table.has('## I. RELATIONSHIP SUMMARY')).toBe(false);
    expect(table.get('## I. SYSTEMS OF RECORD')).toBe('tech-stack.md');
    expect(table.get('## II. KEY DECISION MAKERS')).toBe('stakeholders.md');
  });
});

describe('org audit/repair', () => {
  it('a fresh org dossier is fully compliant with its layers', () => {
    const r = createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES', roles: ['Vendor'] });
    const audit = auditContact(store, root, r.id, ['compliance']);
    expect(audit.findings.missing).toEqual([]);
    expect(audit.compliance).toBe(100);
  });

  it('a tech-sale dossier does not report the neutral pipeline headings missing', () => {
    const r = createDossier(store, root, { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY', salesMotion: 'tech' });
    const audit = auditContact(store, root, r.id, ['compliance']);
    expect(audit.findings.missing).toEqual([]);
  });

  it('adding a secondary type → audit reports the overlay file → repair creates it from template', () => {
    const r = createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES' });
    updateField(store, r.id, 'index', 'secondaryTypes', 'SVCR, INV');
    const audit = auditContact(store, root, r.id, ['compliance']);
    const files = [...new Set(audit.findings.missing.map((m) => m.file))];
    expect(files).toEqual(['portfolio.md']); // SVCR is LENDING (already present); INV adds OWNERS
    const result = repairContact(store, root, r.id, ['all']);
    expect(result.failed).toEqual([]);
    const created = readFileSync(join(root, r.path, 'portfolio.md'), 'utf-8');
    const fm = parseFrontmatter(created)!;
    expect(fm.contactName).toBe('Ares');
    expect(fm.dossierCode).toBe('DEBT-ARES-001');
    expect(created).not.toContain('{{');
    expect(auditContact(store, root, r.id, ['compliance']).findings.missing).toEqual([]);
    expect(store.getSection(r.id, 'portfolio')).toContain('BUY BOX');
  });

  it('unknown orgType audits against COMMON only', () => {
    const r = createDossier(store, root, { name: 'Legacy Co', category: 'Organization', orgType: 'OTH', cid: 'LEG' });
    const p = join(root, r.path, 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('orgType: OTH', 'orgType: LND').replace('orgType: "OTH"', 'orgType: "LND"'));
    store.indexOne(r.path);
    expect(resolveTemplateDirs(root, store, r.id)).toEqual([join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'COMMON')]);
    const audit = auditContact(store, root, r.id);
    expect(audit.findings.missing).toEqual([]);
    expect(() => repairContact(store, root, r.id, ['all'])).not.toThrow();
  });

  it('person dossiers still audit against their single template', () => {
    mkdirSync(join(root, '.templates', 'PROFESSIONAL'), { recursive: true });
    cpSync(join(BUNDLED, 'PROFESSIONAL'), join(root, '.templates', 'PROFESSIONAL'), { recursive: true });
    const r = createDossier(store, root, { name: 'Pat Person', category: 'Network' });
    expect(resolveTemplateDirs(root, store, r.id)).toEqual([join(root, '.templates', 'PROFESSIONAL')]);
    expect(existsSync(join(root, r.path, 'INDEX.md'))).toBe(true);
  });
});
