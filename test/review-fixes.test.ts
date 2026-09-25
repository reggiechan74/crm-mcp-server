/**
 * Regression tests for the code-review fix wave: section path safety,
 * strict write resolution, bulk-update guard, log table targeting,
 * frontmatter preservation, safe dossier creation, repair safety,
 * template-name validation, embeddings metadata, and index maintenance.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTempDir } from './helpers/tmp.js';
import { join, resolve, dirname } from 'node:path';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createStore, type Store } from '../src/store.js';
import { resolveSection } from '../src/types.js';
import { appendLog, updateField, createDossier, bulkUpdateField } from '../src/writer.js';
import { createMcpServer, resolveContact, TOOL_SUMMARIES } from '../src/server.js';
import { updateFrontmatter, parseFrontmatter } from '../src/frontmatter.js';
import { runAudit } from '../src/audit.js';
import { runRepair, withIntegrityGuard } from '../src/repair.js';
import { auditContact, repairContact } from '../src/maintenance.js';
import { assertSafeTemplateName, parseTemplateRef } from '../src/templates.js';
import { downloadTemplate } from '../src/github.js';
import { vectorSearch } from '../src/embeddings.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

let root: string;
let store: Store;

function setup(templates: string[] = []): void {
  root = makeTempDir('crm-test-');
  cpSync(FIXTURES, root, { recursive: true });
  for (const t of templates) cpSync(join(BUNDLED, t), join(root, '.templates', t), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
}

afterEach(() => {
  // Not every suite opens a store; close each one exactly once.
  if (store) store.close();
  store = undefined as unknown as Store;
});

const ftsSections = (id: string): string[] =>
  (store.db.prepare('SELECT section FROM content_fts WHERE contact_id = ?').all(id) as any[]).map(r => r.section).sort();

// ── Section resolution / path safety ───────────────────────────────────

describe('resolveSection', () => {
  it('normalizes every spelling of a known section to one key', () => {
    for (const s of ['index', 'INDEX.md', 'Index', 'INDEX']) expect(resolveSection(s)).toEqual({ key: 'index', file: 'INDEX.md' });
    expect(resolveSection('profile.md')).toEqual({ key: 'profile', file: 'profile.md' });
    expect(resolveSection('intelligence/intelligence-profile.md'))
      .toEqual({ key: 'intelligence-profile', file: 'intelligence/intelligence-profile.md' });
  });

  it('keeps custom paths, and does not alias a custom file onto a known section', () => {
    expect(resolveSection('deals')).toEqual({ key: 'deals', file: 'deals.md' });
    expect(resolveSection('archive/profile')).toEqual({ key: 'archive/profile', file: 'archive/profile.md' });
  });

  it('rejects traversal and absolute paths', () => {
    for (const bad of ['../x', '../../Family/TEST_Family/INDEX', 'a/../../b', '/etc/passwd', 'C:/x', './profile', '', 'a//b']) {
      expect(() => resolveSection(bad), bad).toThrow(/Invalid section/);
    }
  });
});

describe('section reads and writes stay inside the dossier', () => {
  beforeEach(() => setup());

  it('getSection refuses traversal', () => {
    expect(() => store.getSection('NE-TESCON-001', '../ADECOY_Den/INDEX')).toThrow(/Invalid section/);
  });

  it('updateField refuses traversal and writes nothing', () => {
    const victim = join(root, 'Network', 'ADECOY_Den', 'INDEX.md');
    const before = readFileSync(victim, 'utf-8');
    expect(() => updateField(store, 'NE-TESCON-001', '../ADECOY_Den/INDEX', 'status', 'PWNED')).toThrow(/Invalid section/);
    expect(readFileSync(victim, 'utf-8')).toBe(before);
  });

  it('getSection with "profile.md" and "profile" share one cache/FTS key', () => {
    const a = store.getSection('NE-TESCON-001', 'profile.md');
    const b = store.getSection('NE-TESCON-001', 'Profile');
    expect(a).toBe(b);
    const keys = (store.db.prepare("SELECT section FROM content_cache WHERE contact_id = 'NE-TESCON-001'").all() as any[]).map(r => r.section);
    expect(keys).not.toContain('profile.md');
    expect(keys).not.toContain('Profile');
  });

  it('updateField via "INDEX.md" is treated as the index section (full reindex, no stray FTS key)', () => {
    const before = ftsSections('NE-TESCON-001');
    updateField(store, 'NE-TESCON-001', 'INDEX.md', 'status', 'DORMANT');
    expect(ftsSections('NE-TESCON-001')).toEqual(before);
    expect(store.searchContacts({ status: 'DORMANT' }).map(r => r.id)).toContain('NE-TESCON-001');
  });

  it('updateField via "Profile.md" refreshes the profile key only', () => {
    const before = ftsSections('NE-TESCON-001');
    updateField(store, 'NE-TESCON-001', 'Profile.md', 'reviewed', 'yes');
    expect(ftsSections('NE-TESCON-001')).toEqual(before);
    expect(store.getSection('NE-TESCON-001', 'profile')).toContain('reviewed: yes');
  });
});

// ── Contact resolution ─────────────────────────────────────────────────

describe('resolveContact — strict mode for writes', () => {
  beforeEach(() => setup());

  it('never uses the fuzzy/full-text fallback for writes', () => {
    // "Introductory" only appears in TEST_Contact's log — reads find it, writes must not.
    expect(resolveContact(store, 'Introductory')).toBe('NE-TESCON-001');
    expect(resolveContact(store, 'Introductory', { strict: true })).toBeNull();
    // Substring of a name is not an exact match either
    expect(resolveContact(store, 'Decoy', { strict: true })).toBeNull();
  });

  it('accepts codes, folder names, full names and aliases', () => {
    expect(resolveContact(store, 'NE-TESCON-001', { strict: true })).toBe('NE-TESCON-001');
    expect(resolveContact(store, 'TEST_Contact', { strict: true })).toBe('NE-TESCON-001');
    expect(resolveContact(store, 'test contact', { strict: true })).toBe('NE-TESCON-001');
    expect(resolveContact(store, 'Testy', { strict: true })).toBe('NE-TESCON-001');
  });

  it('throws on an ambiguous exact match instead of picking one', () => {
    const p = join(root, 'Network', 'ADECOY_Den', 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('name: "Adam Decoy"', 'name: "Adam Decoy"\naliases:\n  - "Testy"'));
    store.indexAll();
    expect(() => resolveContact(store, 'Testy', { strict: true })).toThrow(/matches 2 contacts/);
  });
});

// ── Bulk update ────────────────────────────────────────────────────────

describe('bulkUpdateField', () => {
  beforeEach(() => setup());

  it('requires at least one filter', () => {
    expect(() => bulkUpdateField(store, {}, 'status', 'X')).toThrow(/at least one filter/);
  });

  it('updates every match and reindexes', () => {
    const r = bulkUpdateField(store, { category: 'Network' }, 'status', 'Dormant');
    expect(r.errors).toEqual([]);
    expect(r.updated.length).toBe(3);
    expect(store.searchContacts({ status: 'Dormant' }).length).toBe(3);
    expect(store.searchContacts({ category: 'Family', status: 'Dormant' }).length).toBe(0);
  });
});

// ── Interaction log ────────────────────────────────────────────────────

describe('appendLog', () => {
  beforeEach(() => setup(['PROFESSIONAL', 'FAMILY', 'PERSONAL']));

  it('escapes pipes and newlines so the row stays one table row', () => {
    appendLog(store, 'NE-TESCON-001', { date: '2026-09-25', type: 'Call', summary: 'A | B\nC', outcome: 'ok' });
    const log = readFileSync(join(root, 'Network', 'TEST_Contact', 'log.md'), 'utf-8');
    expect(log).toContain('| 2026-09-25 | Call | A \\| B C | ok |  |');
  });

  it('writes into the INTERACTION LOG table, not the last table in the file (PROFESSIONAL)', () => {
    const r = createDossier(store, root, { name: 'Pat Pro', category: 'Network' });
    appendLog(store, r.id, { date: '2026-09-25', type: 'Meeting', summary: 'Coffee chat' });
    const log = readFileSync(join(root, r.path, 'log.md'), 'utf-8');
    const interaction = log.slice(log.indexOf('## XII. INTERACTION LOG'), log.indexOf('## XIII. NEXT ACTIONS'));
    expect(interaction).toContain('Coffee chat');
    expect(log.slice(log.indexOf('## XIII. NEXT ACTIONS'))).not.toContain('Coffee chat');
  });

  it('folds the outcome into the summary when the table has no Outcome column (PERSONAL)', () => {
    const r = createDossier(store, root, { name: 'Pal Person', category: 'Personal' });
    appendLog(store, r.id, { date: '2026-09-25', type: 'Dinner', summary: 'Caught up', outcome: 'Plans made', nextStep: 'Hike' });
    const log = readFileSync(join(root, r.path, 'log.md'), 'utf-8');
    expect(log).toContain('| 2026-09-25 | Dinner | Caught up — Outcome: Plans made | Hike |');
  });

  it('starts an interaction table when the log has none (FAMILY)', () => {
    const r = createDossier(store, root, { name: 'Kin Family', category: 'Family' });
    const logPath = join(root, r.path, 'log.md');
    const upcoming = readFileSync(logPath, 'utf-8').match(/\| Date \| Event \|[\s\S]*?\n\n/)![0];
    appendLog(store, r.id, { date: '2026-09-25', type: 'Call', summary: 'Birthday call' });
    const log = readFileSync(logPath, 'utf-8');
    expect(log).toContain(upcoming); // Upcoming Events table untouched
    expect(log.trimEnd().endsWith('| 2026-09-25 | Call | Birthday call |  |  |')).toBe(true);
    // A second entry lands in the same new table
    appendLog(store, r.id, { date: '2026-09-26', type: 'Text', summary: 'Follow-up' });
    expect(readFileSync(logPath, 'utf-8').match(/\| Date \| Type \| Summary/g)!.length).toBe(1);
  });
});

// ── Frontmatter ────────────────────────────────────────────────────────

describe('updateFrontmatter', () => {
  it('preserves comments, key order and untouched quoting', () => {
    const src = '---\n# keep me\nname: "Jane"  # inline\nstatus: Active\ntags: [a, b]\n---\nBody\n';
    const out = updateFrontmatter(src, { status: 'Dormant' });
    expect(out).toBe('---\n# keep me\nname: "Jane" # inline\nstatus: Dormant\ntags: [ a, b ]\n---\nBody\n');
  });

  it('adds and deletes keys, and handles an empty block', () => {
    expect(updateFrontmatter('---\n---\nBody', { a: '1' })).toBe('---\na: "1"\n---\nBody');
    expect(updateFrontmatter('---\na: 1\nb: 2\n---\n', { a: undefined })).toBe('---\nb: 2\n---\n');
    expect(updateFrontmatter('No frontmatter', { a: 'x' })).toBe('---\na: x\n---\nNo frontmatter');
  });

  it('refuses to rewrite malformed YAML', () => {
    expect(() => updateFrontmatter('---\nkey: [unclosed\n---\n', { a: 'b' })).toThrow(/malformed/);
  });
});

// ── Dossier creation ───────────────────────────────────────────────────

describe('createDossier — input safety', () => {
  beforeEach(() => setup(['PROFESSIONAL']));

  it('inserts names literally ($& is not expanded) and keeps YAML valid with quotes', () => {
    const r = createDossier(store, root, { name: 'Ke$&ha "KK" Smith', category: 'Network', context: 'met at $1 event' });
    const idx = readFileSync(join(root, r.path, 'INDEX.md'), 'utf-8');
    const yaml = parseFrontmatter(idx)!;
    expect(yaml.name).toBe('Ke$&ha "KK" Smith');
    expect(yaml.context).toBe('met at $1 event');
    for (const f of readdirSync(join(root, r.path))) {
      if (f.endsWith('.md')) expect(parseFrontmatter(readFileSync(join(root, r.path, f), 'utf-8')), f).not.toBeNull();
    }
    expect(store.getOutline(r.id).contact.name).toBe('Ke$&ha "KK" Smith');
  });

  it('strips path characters from folder names so nothing is written outside the category dir', () => {
    const r = createDossier(store, root, { name: 'Evil ../../../x', category: 'Network' });
    expect(r.path.startsWith('Network/')).toBe(true);
    expect(r.path.slice('Network/'.length)).not.toMatch(/[\\/]/);
    expect(existsSync(join(root, '..', 'X_Evil'))).toBe(false);
  });

  it('rejects inherited object keys as categories', () => {
    expect(() => createDossier(store, root, { name: 'A B', category: 'constructor' })).toThrow(/Invalid category/);
  });
});

// ── Audit / repair ─────────────────────────────────────────────────────

function repairFixture(): { dossierDir: string; tplDir: string } {
  const base = makeTempDir('crm-test-');
  const tplDir = join(base, '.templates', 'PROFESSIONAL');
  mkdirSync(tplDir, { recursive: true });
  writeFileSync(join(tplDir, 'INDEX.md'), '# Name\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
  writeFileSync(join(tplDir, 'profile.md'), '## II. CONTACT INFORMATION\n## III. PROFESSIONAL BACKGROUND\n## IV. EDUCATION\n');
  const dossierDir = join(base, 'Network', 'REPAIR_Test');
  mkdirSync(dossierDir, { recursive: true });
  return { dossierDir, tplDir };
}

describe('repair safety', () => {
  it('audit sees content after a horizontal rule', () => {
    const { dossierDir, tplDir } = repairFixture();
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: T\n---\n## I. EXECUTIVE SUMMARY\n---\nAlpha line\nBeta line\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\nAlpha line\nBeta line\n');
    const audit = runAudit(dossierDir, tplDir, ['duplicates']);
    expect(audit.findings.duplicates.length).toBe(1);
    expect(audit.findings.duplicates[0].headings).toEqual(['## I. EXECUTIVE SUMMARY', '## II. CONTACT INFORMATION']);
  });

  it('dedup leaves partially-overlapping sections alone', () => {
    const { dossierDir, tplDir } = repairFixture();
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: T\n---\n## I. EXECUTIVE SUMMARY\nL1\nL2\nL3\n');
    const profile = '---\n---\n## II. CONTACT INFORMATION\nL1\nL2\nL3\nUnique detail\n';
    writeFileSync(join(dossierDir, 'profile.md'), profile);
    const audit = runAudit(dossierDir, tplDir, ['duplicates']);
    expect(audit.findings.duplicates.length).toBe(1);
    const result = runRepair(dossierDir, tplDir, audit, ['all']);
    expect(result.failed).toEqual(['D1']);
    expect(readFileSync(join(dossierDir, 'profile.md'), 'utf-8')).toBe(profile);
  });

  it('dedup collapses an identical copy but keeps its subsections', () => {
    const { dossierDir, tplDir } = repairFixture();
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: T\n---\n## I. EXECUTIVE SUMMARY\nL1\nL2\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\nL1\nL2\n### Sub\nKeep me\n');
    const audit = runAudit(dossierDir, tplDir, ['duplicates']);
    const result = runRepair(dossierDir, tplDir, audit, ['D1']);
    expect(result.applied).toEqual(['D1']);
    const profile = readFileSync(join(dossierDir, 'profile.md'), 'utf-8');
    expect(profile).toContain('> See INDEX.md');
    expect(profile).toContain('### Sub\nKeep me');
    expect(result.validation.contentIntegrity).toBe('PASS');
  });

  it('ordering follows the template and keeps unknown sections with their predecessor', () => {
    const { dossierDir, tplDir } = repairFixture();
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: T\n---\n## I. EXECUTIVE SUMMARY\n');
    writeFileSync(join(dossierDir, 'profile.md'),
      '---\na: 1\n---\n# Title\n## IV. EDUCATION\nedu\n## Custom Notes\nmine\n## II. CONTACT INFORMATION\nphone\n## III. PROFESSIONAL BACKGROUND\nbg\n');
    const audit = runAudit(dossierDir, tplDir, ['ordering']);
    expect(audit.findings.ordering.length).toBeGreaterThan(0);
    runRepair(dossierDir, tplDir, audit, ['all']);
    expect(readFileSync(join(dossierDir, 'profile.md'), 'utf-8')).toBe(
      '---\na: 1\n---\n# Title\n## II. CONTACT INFORMATION\nphone\n## III. PROFESSIONAL BACKGROUND\nbg\n\n## IV. EDUCATION\nedu\n## Custom Notes\nmine',
    );
  });

  it('integrity guard restores every file (and removes new ones) on FAIL', () => {
    const { dossierDir } = repairFixture();
    writeFileSync(join(dossierDir, 'profile.md'), 'one\ntwo\nthree\nfour\n');
    const outcome = withIntegrityGuard(dossierDir, () => {
      writeFileSync(join(dossierDir, 'profile.md'), 'one\n');
      writeFileSync(join(dossierDir, 'new.md'), 'created\n');
    });
    expect(outcome.contentIntegrity).toBe('FAIL');
    expect(outcome.rolledBack).toBe(true);
    expect(readFileSync(join(dossierDir, 'profile.md'), 'utf-8')).toBe('one\ntwo\nthree\nfour\n');
    expect(existsSync(join(dossierDir, 'new.md'))).toBe(false);
  });
});

describe('repairContact', () => {
  beforeEach(() => {
    setup(['PROFESSIONAL']);
  });

  it('refuses when the dossier changed after the audit', () => {
    auditContact(store, root, 'NE-TESCON-001');
    const p = join(root, 'Network', 'TEST_Contact', 'profile.md');
    writeFileSync(p, readFileSync(p, 'utf-8') + '\nedited\n');
    expect(() => repairContact(store, root, 'NE-TESCON-001', ['all'])).toThrow(/changed since it was audited/);
    expect(store.loadAudit('NE-TESCON-001')).toBeNull();
  });

  it('reindexes after repairing', () => {
    const p = join(root, 'Network', 'TEST_Contact', 'log.md');
    writeFileSync(p, readFileSync(p, 'utf-8') + '| 2026-09-20 | Call | Zanzibar sync | ok | - |\n');
    store.indexAll();
    const audit = auditContact(store, root, 'NE-TESCON-001', ['stale']);
    expect(audit.findings.stale.length).toBe(1);
    repairContact(store, root, 'NE-TESCON-001', ['S1']);
    expect(store.getOutline('NE-TESCON-001').contact.lastContact).toBe('2026-09-20');
  });
});

// ── Templates / GitHub ─────────────────────────────────────────────────

describe('template name validation', () => {
  it('accepts plain identifiers and rejects everything else', () => {
    expect(parseTemplateRef('REAL_ESTATE/A_BROKERAGE_SALES')).toEqual({ templateName: 'REAL_ESTATE', category: 'A_BROKERAGE_SALES' });
    expect(parseTemplateRef('simple')).toEqual({ templateName: 'simple', category: undefined });
    for (const bad of ['X"; rm -rf ~; echo "', '../../etc', 'a/b/c', '$(id)', 'a b', '', '.hidden']) {
      expect(() => parseTemplateRef(bad), bad).toThrow(/Invalid/);
    }
    expect(() => assertSafeTemplateName('`id`')).toThrow();
  });

  it('downloadTemplate validates names before touching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(downloadTemplate('o/r', 'X"; touch /tmp/pwn; echo "', '/tmp/never')).rejects.toThrow(/Invalid template name/);
    await expect(downloadTemplate('o/r', 'OK', '/tmp/never', undefined, '../x')).rejects.toThrow(/Invalid category name/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ── Embeddings metadata ────────────────────────────────────────────────

describe('embeddings storage', () => {
  beforeEach(() => setup());

  const vec = (xs: number[]) => Buffer.from(new Float32Array(xs).buffer);

  it('records the model and flags sections changed since embedding', () => {
    const [section] = store.getSectionContents().filter(s => s.contactId === 'NE-TESCON-001' && s.section === 'log');
    store.replaceEmbeddings('model-a', [
      { contactId: 'NE-TESCON-001', section: 'log', chunkIndex: 0, chunkText: 'x', embedding: vec([1, 0]), fileHash: section.fileHash },
    ]);
    expect(store.getEmbeddingModel()).toBe('model-a');
    expect(store.getEmbeddings()[0].stale).toBe(false);

    appendLog(store, 'NE-TESCON-001', { date: '2026-09-25', type: 'Call', summary: 'new' });
    expect(store.getEmbeddings()[0].stale).toBe(true);
  });

  it('vectorSearch refuses to compare vectors from a different model', async () => {
    store.replaceEmbeddings('model-a', [
      { contactId: 'NE-TESCON-001', section: 'log', chunkIndex: 0, chunkText: 'x', embedding: vec([1, 0]), fileHash: 'h' },
    ]);
    const config = { crmRoot: root, dbPath: ':memory:', embeddingModel: 'model-b', templates: [], defaultTemplate: 'simple', templateRepo: 'o/r' };
    await expect(vectorSearch(store, config, 'q')).rejects.toThrow(/generated with "model-a"/);
  });
});

// ── Index maintenance ──────────────────────────────────────────────────

describe('index maintenance', () => {
  beforeEach(() => setup());

  it('indexOne drops the old id when a dossier code changes on disk', () => {
    const p = join(root, 'Network', 'ADECOY_Den', 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('NE-ADADEC-099', 'NE-ADADEC-100'));
    store.indexOne('Network/ADECOY_Den');
    expect(store.getContactPath('NE-ADADEC-099')).toBeNull();
    expect(store.getContactPath('NE-ADADEC-100')).toBe('Network/ADECOY_Den');
    expect(ftsSections('NE-ADADEC-099')).toEqual([]);
  });

  it('indexOne removes a dossier whose folder was deleted', () => {
    rmSync(join(root, 'Network', 'ADECOY_Den'), { recursive: true });
    store.indexOne('Network/ADECOY_Den');
    expect(store.getContactPath('NE-ADADEC-099')).toBeNull();
  });

  it('getStats computes fill from the index without reading files', () => {
    const before = store.getStats();
    rmSync(join(root, 'Network'), { recursive: true });
    expect(store.getStats()).toEqual(before);
    expect(before.avgFillPercent).toBeGreaterThan(0);
  });
});

// ── Server wiring ──────────────────────────────────────────────────────

describe('server', () => {
  it('every registered tool has an instructions summary', () => {
    setup();
    const config = { crmRoot: root, dbPath: ':memory:', embeddingModel: 't', templates: [], defaultTemplate: 'simple', templateRepo: 'o/r' };
    const server = createMcpServer(store, config) as any;
    expect(Object.keys(server._registeredTools).sort()).toEqual(Object.keys(TOOL_SUMMARIES).sort());
  });
});

// ── Independent-review follow-ups ──────────────────────────────────────

describe('review follow-ups', () => {
  beforeEach(() => setup());

  function addTwin(): void {
    // Same folder name under two categories
    mkdirSync(join(root, 'Clients', 'TEST_Contact'), { recursive: true });
    writeFileSync(join(root, 'Clients', 'TEST_Contact', 'INDEX.md'),
      '---\nname: "Other Person"\ndossierCode: "CL-OTHPER-001"\nstatus: Active\n---\n# X\n');
    store.indexAll();
  }

  it('strict mode refuses a bare folder name shared by two dossiers', () => {
    addTwin();
    expect(() => resolveContact(store, 'TEST_Contact', { strict: true })).toThrow(/matches 2 dossier folders/);
    expect(resolveContact(store, 'Clients/TEST_Contact', { strict: true })).toBe('CL-OTHPER-001');
    expect(resolveContact(store, join(root, 'Network', 'TEST_Contact'), { strict: true })).toBe('NE-TESCON-001');
  });

  it('strict mode does not ignore the category in a path input', () => {
    expect(resolveContact(store, 'Clients/TEST_Contact', { strict: true })).toBeNull();
    expect(resolveContact(store, 'Network/TEST_Contact', { strict: true })).toBe('NE-TESCON-001');
    expect(resolveContact(store, 'TEST_Contact', { strict: true })).toBe('NE-TESCON-001');
  });

  it.skipIf(process.getuid?.() === 0)('indexMany rolls back only a dossier that fails mid-index and keeps its old rows', () => {
    const profile = join(root, 'Network', 'ADECOY_Den', 'profile.md');
    writeFileSync(profile, 'Quokka notes\n');
    store.indexAll();
    const idx = join(root, 'Network', 'TEST_Contact', 'INDEX.md');
    writeFileSync(idx, readFileSync(idx, 'utf-8').replace('status: Active', 'status: Dormant'));
    chmodSync(profile, 0o000);
    try {
      const { failed } = store.indexMany(['Network/ADECOY_Den', 'Network/TEST_Contact']);
      expect(failed.map(f => f.path)).toEqual(['Network/ADECOY_Den']);
      expect(store.getContactPath('NE-ADADEC-099')).toBe('Network/ADECOY_Den');
      expect(store.fullTextSearch('Quokka').map(r => r.id)).toEqual(['NE-ADADEC-099']);
      expect(store.getOutline('NE-TESCON-001').contact.status).toBe('Dormant');
      expect(() => store.indexOne('Network/ADECOY_Den')).toThrow();
      expect(store.getContactPath('NE-ADADEC-099')).toBe('Network/ADECOY_Den');
    } finally {
      chmodSync(profile, 0o644);
    }
    store.indexOne('Network/ADECOY_Den'); // no transaction left open
  });

  it('odd file names on disk do not break indexing or updates', () => {
    const dir = join(root, 'Network', 'TEST_Contact');
    writeFileSync(join(dir, '..md'), 'weird\n');
    store.indexAll();
    expect(store.fullTextSearch('Introductory').map(r => r.id)).toContain('NE-TESCON-001');
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'Dormant');
    expect(store.getOutline('NE-TESCON-001').contact.status).toBe('Dormant');
  });

  it('bulk update reports a dossier that fails to reindex and commits the rest', () => {
    // Break ADECOY_Den's frontmatter after it is written by making INDEX.md unparseable on reindex
    const bad = join(root, 'Network', 'ADECOY_Den', 'INDEX.md');
    writeFileSync(bad, readFileSync(bad, 'utf-8') + '\n');
    const orig = store.indexMany.bind(store);
    store.indexMany = (paths: string[]) => {
      writeFileSync(bad, 'no frontmatter at all\n');
      return orig(paths);
    };
    const r = bulkUpdateField(store, { category: 'Network' }, 'status', 'Dormant');
    expect(r.errors.map(e => e.id)).toEqual(['Network/ADECOY_Den']);
    expect(store.getOutline('NE-TESCON-001').contact.status).toBe('Dormant');
    expect(store.getOutline('NE-BOBSMI-100').contact.status).toBe('Dormant');
  });

  it('a stripping-rule version change invalidates reused cleaned content', () => {
    // Simulate a row cached before versioning: plain sha256 of the unchanged file
    const raw = readFileSync(join(root, 'Network', 'TEST_Contact', 'log.md'), 'utf-8');
    const legacyHash = createHash('sha256').update(raw).digest('hex');
    store.db.prepare("UPDATE content_cache SET cleaned_content = 'STALE', file_hash = ? WHERE contact_id = 'NE-TESCON-001' AND section = 'log'").run(legacyHash);
    store.indexAll();
    expect(store.getSection('NE-TESCON-001', 'log')).not.toBe('STALE');
    expect(store.getSection('NE-TESCON-001', 'log')).toContain('Introductory');
  });
});
