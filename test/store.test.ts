import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore, type Store } from '../src/store.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
let store: Store;

function writeDossier(root: string, rel: string, yaml: string): void {
  mkdirSync(join(root, rel), { recursive: true });
  writeFileSync(join(root, rel, 'INDEX.md'), `---\n${yaml}\nstatus: Active\n---\n\n# X\n`);
}

/** Oxford (OPR; Client+OperatingPartner) → operating_partner_of → XYZ (INV; Client); Jane works at "oxford". */
function graphRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'crm-graph-'));
  writeDossier(root, 'Organizations/OPR_Oxford', [
    'name: "Oxford Properties"', 'dossierCode: "OPR-OXF-001"', 'orgType: OPR', 'aliases:', '  - "Oxford"',
    'roles:', '  - Client', '  - OperatingPartner',
    'linkedContacts:', '  - { name: "INV-XYZ-001", type: operating_partner_of, context: "TX MF" }',
  ].join('\n'));
  writeDossier(root, 'Organizations/INV_Xyz', [
    'name: "XYZ Capital"', 'dossierCode: "INV-XYZ-001"', 'orgType: INV', 'roles:', '  - Client',
  ].join('\n'));
  writeDossier(root, 'Network/DOE_Jane', [
    'name: "Jane Doe"', 'dossierCode: "NE-JANDOE-001"', 'organization: "oxford"',
    'linkedContacts:', '  - "Nobody Here (unknown)"', '  - "Sam Twin (ambiguous)"',
  ].join('\n'));
  writeDossier(root, 'Network/TWIN_Sam', 'name: "Sam Twin"\ndossierCode: "NE-SAMTWI-001"');
  writeDossier(root, 'Clients/TWIN_Sam', 'name: "Sam Twin"\ndossierCode: "CL-SAMTWI-001"');
  return root;
}

beforeAll(() => {
  store = createStore(':memory:', FIXTURES);
  store.indexAll();
});

afterAll(() => {
  store.close();
});

describe('indexAll', () => {
  it('indexes contacts from fixture dossiers', () => {
    const results = store.searchContacts({});
    expect(results.length).toBeGreaterThan(0);
  });

  it('stores contact metadata correctly', () => {
    const results = store.searchContacts({ query: 'Test Contact' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Test Contact');
    expect(results[0].organization).toBe('Test Corp');
  });
});

describe('searchContacts', () => {
  it('searches by name', () => {
    const results = store.searchContacts({ query: 'Test' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Test');
  });

  it('filters by category', () => {
    const results = store.searchContacts({ category: 'Network' });
    expect(results.every((r) => r.category === 'Network')).toBe(true);
  });

  it('filters by status', () => {
    const results = store.searchContacts({ status: 'Active' });
    expect(results.every((r) => r.status === 'Active')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    const results = store.searchContacts({ query: 'Nonexistent Person' });
    expect(results.length).toBe(0);
  });

  it('includes the dossier path on name-match results', () => {
    const results = store.searchContacts({ query: 'Test Contact' });
    expect(results[0].path).toBe('Network/TEST_Contact');
  });

  it('includes the dossier path on FTS-fallback results', () => {
    // 'competitor XYZ' lives in section content, not the name — forces the
    // FTS fallback branch of searchContacts (the one easy to miss).
    const results = store.searchContacts({ query: 'competitor XYZ' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('Network/TEST_Contact');
  });
});

describe('searchContacts — alias support', () => {
  it('finds contact by alias', () => {
    const results = store.searchContacts({ query: 'TC' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Test Contact');
  });

  it('finds contact by partial alias', () => {
    const results = store.searchContacts({ query: 'Testy' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Test Contact');
  });

  it('finds family contact by nickname with category filter', () => {
    const results = store.searchContacts({ query: 'Izzy', category: 'Family' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Isabella Persona');
  });

  it('finds family contact by alternate alias', () => {
    const results = store.searchContacts({ query: 'Bella' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Isabella Persona');
  });

  it('still finds contact by name when aliases exist', () => {
    const results = store.searchContacts({ query: 'Test Contact' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Test Contact');
  });
});

describe('fullTextSearch', () => {
  it('finds content across dossier sections', () => {
    const results = store.fullTextSearch('competitor XYZ');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns section and snippet in results', () => {
    const results = store.fullTextSearch('competitor');
    expect(results[0]).toHaveProperty('section');
    expect(results[0]).toHaveProperty('snippet');
  });
});

describe('getOutline', () => {
  it('returns section metadata for a contact', () => {
    const outline = store.getOutline('NE-TESCON-001');
    expect(outline.contact.name).toBe('Test Contact');
    expect(outline.sections.length).toBeGreaterThan(0);
  });

  it('includes fill percentages', () => {
    const outline = store.getOutline('NE-TESCON-001');
    outline.sections.forEach((s) => {
      expect(s).toHaveProperty('fillPercent');
      expect(s.fillPercent).toBeGreaterThanOrEqual(0);
      expect(s.fillPercent).toBeLessThanOrEqual(100);
    });
  });
});

describe('getSection', () => {
  it('returns cleaned content for a section', () => {
    const content = store.getSection('NE-TESCON-001', 'intelligence-risk');
    expect(content).not.toContain('[TO BE ADDED]');
    expect(content).toContain('competitor XYZ');
  });

  it('returns full content for index section', () => {
    const content = store.getSection('NE-TESCON-001', 'index');
    expect(content).toContain('Test Contact');
    expect(content).toContain('EXECUTIVE SUMMARY');
  });
});

describe('getConnections', () => {
  it('returns relationships for a contact', () => {
    const rels = store.getConnections('NE-TESCON-001');
    expect(rels.length).toBe(2);
  });

  it('includes target name and context', () => {
    const rels = store.getConnections('NE-TESCON-001');
    const jane = rels.find((r) => r.targetName === 'Jane Doe');
    expect(jane).toBeDefined();
    expect(jane!.context).toContain('Test Corp VP');
  });
});

describe('getRecent', () => {
  it('returns contacts sorted by last contact date', () => {
    const recent = store.getRecent(10);
    expect(recent.length).toBeGreaterThan(0);
  });
});

describe('getStats', () => {
  it('returns CRM-wide statistics', () => {
    const stats = store.getStats();
    expect(stats.totalContacts).toBeGreaterThan(0);
    expect(stats.byCategory).toBeDefined();
    expect(stats.byCategory['Network']).toBeGreaterThan(0);
  });
});

describe('resolveByPath — exact folder-name resolution (fail-open bug fix)', () => {
  // Fixtures reproduce the bug: ADECOY_Den (lower rowid, token-dense, mentions
  // "Smith-Jones Bobby" repeatedly) vs SMITH-JONES_Bobby (the real owner, minimal
  // content). A folder-name input must resolve to the OWNER, never the decoy.
  const OWNER = 'NE-BOBSMI-100';
  const DECOY = 'NE-ADADEC-099';

  it('resolves a bare folder name to its owner, not a token-dense decoy', () => {
    const id = store.resolveByPath('SMITH-JONES_Bobby');
    expect(id).toBe(OWNER);
    expect(id).not.toBe(DECOY);
  });

  it('resolves a full folder path (with trailing slash) to its owner', () => {
    expect(store.resolveByPath('Network/SMITH-JONES_Bobby/')).toBe(OWNER);
    expect(store.resolveByPath('/abs/CRM/Network/SMITH-JONES_Bobby')).toBe(OWNER);
  });

  it('handles folder names containing both _ and - (no LIKE-wildcard hazard)', () => {
    // The "_" must be treated literally, not as a SQLite single-char wildcard.
    expect(store.resolveByPath('SMITH-JONES_Bobby')).toBe(OWNER);
  });

  it('returns null for an input with no matching folder basename', () => {
    expect(store.resolveByPath('Smith')).toBeNull();
    expect(store.resolveByPath('Nonexistent_Folder')).toBeNull();
  });

  it('confirms the trap: the buggy FTS path returns the DECOY for this input', () => {
    // Proves the regression test is non-vacuous: structured + FTS-fallback
    // search (the old resolution route) lands on the wrong contact, so the
    // resolveByPath step is what actually fixes it.
    const results = store.searchContacts({ query: 'SMITH-JONES_Bobby', limit: 1 });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(DECOY);
  });
});

describe('reindex after out-of-band edit (issue #1, AC#2)', () => {
  it('reflects a direct file edit in crm_search after indexOne, without restart', () => {
    const sectionPath = join(
      FIXTURES,
      'Network/TEST_Contact/intelligence/intelligence-risk.md',
    );
    const original = readFileSync(sectionPath, 'utf-8');
    const sentinel = 'ZZZsentineltokenZZZ';

    try {
      // Pre-condition: sentinel not present in the live FTS index.
      expect(store.fullTextSearch(sentinel).length).toBe(0);

      // Simulate an out-of-band edit (e.g. via the Edit tool, bypassing MCP writes).
      writeFileSync(sectionPath, `${original}\n\n${sentinel}\n`, 'utf-8');

      // Without reindex, FTS is still stale (no file watcher).
      expect(store.fullTextSearch(sentinel).length).toBe(0);

      // On-demand reindex closes the gap.
      store.indexOne('Network/TEST_Contact');
      expect(store.fullTextSearch(sentinel).length).toBeGreaterThan(0);
    } finally {
      writeFileSync(sectionPath, original, 'utf-8');
      store.indexOne('Network/TEST_Contact');
    }
  });
});

describe('relationship resolution', () => {
  it('resolves target_id by dossier code', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('OPR-OXF-001');
    const op = rels.find(r => r.type === 'operating_partner_of');
    expect(op!.targetId).toBe('INV-XYZ-001');
    s.close();
  });

  it('derives works_at from organization via alias, case-insensitive', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001');
    const w = rels.find(r => r.type === 'works_at');
    expect(w).toMatchObject({ targetId: 'OPR-OXF-001', targetName: 'Oxford Properties', context: 'auto: organization field' });
    s.close();
  });

  it('leaves unknown and ambiguous targets unresolved without crashing', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001');
    expect(rels.find(r => r.targetName === 'Nobody Here')!.targetId).toBe('');
    expect(rels.find(r => r.targetName === 'Sam Twin')!.targetId).toBe('');
    s.close();
  });

  it('traverses person → org → org at depth 2', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001', 2);
    expect(rels.some(r => r.type === 'operating_partner_of' && r.targetId === 'INV-XYZ-001')).toBe(true);
    s.close();
  });

  it('shows inbound edges on the target', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('INV-XYZ-001');
    expect(rels.some(r => r.sourceId === 'OPR-OXF-001' && r.type === 'operating_partner_of')).toBe(true);
    s.close();
  });

  it('re-derives works_at after indexOne (no duplicates, follows org change)', () => {
    const root = graphRoot();
    const s = createStore(':memory:', root);
    s.indexAll();
    s.indexOne('Organizations/OPR_Oxford');
    const count = () => (s.db.prepare(
      "SELECT COUNT(*) AS n FROM relationships WHERE type = 'works_at'").get() as any).n;
    expect(count()).toBe(1);
    const p = join(root, 'Network/DOE_Jane/INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('organization: "oxford"', 'organization: "Elsewhere"'));
    s.indexOne('Network/DOE_Jane');
    expect(count()).toBe(0);
    s.close();
  });

  it('never clobbers a hand-authored works_at edge with the auto-derived one', () => {
    const root = mkdtempSync(join(tmpdir(), 'crm-manual-works-at-'));
    writeDossier(root, 'Organizations/OPR_Oxford', [
      'name: "Oxford Properties"', 'dossierCode: "OPR-OXF-001"', 'orgType: OPR', 'roles:', '  - Client',
    ].join('\n'));
    writeDossier(root, 'Network/DOE_Jane', [
      'name: "Jane Doe"', 'dossierCode: "NE-JANDOE-001"', 'organization: "Oxford Properties"',
      'linkedContacts:',
      '  - { name: "Oxford Properties", type: works_at, context: "Head of Data" }',
    ].join('\n'));
    const s = createStore(':memory:', root);
    s.indexAll();
    s.indexOne('Network/DOE_Jane');
    const rows = s.db.prepare(
      "SELECT * FROM relationships WHERE source_id = 'NE-JANDOE-001' AND type = 'works_at'",
    ).all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].context).toBe('Head of Data');
    expect(rows[0].target_id).toBe('OPR-OXF-001');
    s.close();
  });

  it('does not duplicate a hand-authored works_at edge that names the org by dossier code (F4)', () => {
    const root = mkdtempSync(join(tmpdir(), 'crm-manual-works-at-code-'));
    writeDossier(root, 'Organizations/OPR_Oxford', [
      'name: "Oxford Properties"', 'dossierCode: "OPR-OXF-001"', 'orgType: OPR', 'roles:', '  - Client',
    ].join('\n'));
    writeDossier(root, 'Network/DOE_Jane', [
      'name: "Jane Doe"', 'dossierCode: "NE-JANDOE-001"', 'organization: "Oxford Properties"',
      'linkedContacts:',
      '  - { name: "OPR-OXF-001", type: works_at }',
    ].join('\n'));
    const s = createStore(':memory:', root);
    s.indexAll();
    const rows = s.db.prepare(
      "SELECT * FROM relationships WHERE source_id = 'NE-JANDOE-001' AND type = 'works_at'",
    ).all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].target_id).toBe('OPR-OXF-001');
    s.close();
  });

  it('leaves an unrelated edge\'s target_id unchanged after indexOne of another dossier (F2)', () => {
    const root = graphRoot();
    const s = createStore(':memory:', root);
    s.indexAll();
    // Unrelated dossier with no relationships of its own.
    s.indexOne('Network/TWIN_Sam');
    const rels = s.getConnections('OPR-OXF-001');
    const op = rels.find(r => r.type === 'operating_partner_of');
    expect(op!.targetId).toBe('INV-XYZ-001');
    s.close();
  });
});

describe('searchContacts — case-insensitive role search (F6)', () => {
  it('finds orgs with Client when searching lowercase "client"', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(s.searchContacts({ roles: ['client'] }).map(r => r.id).sort())
      .toEqual(['INV-XYZ-001', 'OPR-OXF-001']);
    s.close();
  });

  it('throws Invalid role(s) for an unknown role rather than failing open', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(() => s.searchContacts({ roles: ['Nope'] })).toThrow(/Invalid role\(s\): Nope\. Valid:/);
    s.close();
  });
});

describe('searchContacts org filters', () => {
  it('filters by single role', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const ids = s.searchContacts({ roles: ['Client'] }).map(r => r.id).sort();
    expect(ids).toEqual(['INV-XYZ-001', 'OPR-OXF-001']);
    s.close();
  });

  it('ANDs multiple roles', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(s.searchContacts({ roles: ['Client', 'OperatingPartner'] }).map(r => r.id)).toEqual(['OPR-OXF-001']);
    s.close();
  });

  it('filters by orgType and never matches people', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(s.searchContacts({ orgType: 'INV' }).map(r => r.id)).toEqual(['INV-XYZ-001']);
    expect(s.searchContacts({ roles: ['Competitor'] })).toEqual([]);
    expect(s.searchContacts({ query: 'Jane' })[0].roles).toBeUndefined();
    s.close();
  });

  it('returns orgType and roles on org rows', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const r = s.searchContacts({ query: 'Oxford Properties' })[0];
    expect(r.roles).toEqual(['Client', 'OperatingPartner']);
    s.close();
  });
});
