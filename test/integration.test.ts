import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore, type Store } from '../src/store.js';
import { createDossier } from '../src/writer.js';
import { runInitNonInteractive } from '../src/init.js';
import { runAudit } from '../src/audit.js';
import { runRepair } from '../src/repair.js';
import { createMcpServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
let store: Store;

beforeAll(() => {
  store = createStore(':memory:', FIXTURES);
  store.indexAll();
});

afterAll(() => store.close());

describe('progressive disclosure workflow', () => {
  it('search → outline → read gives progressively more detail', () => {
    // Step 1: Search — lowest token cost (~50-100 tokens/result)
    const results = store.searchContacts({ query: 'Test' });
    expect(results.length).toBeGreaterThan(0);
    const contactId = results[0].id;
    expect(contactId).toBe('NE-TESCON-001');

    // Step 2: Outline — medium token cost (~100-200 tokens)
    const outline = store.getOutline(contactId);
    expect(outline.contact.name).toBe('Test Contact');
    expect(outline.sections.length).toBeGreaterThan(0);
    // Outline should show fill percentages
    const indexSection = outline.sections.find(s => s.file === 'INDEX.md');
    expect(indexSection).toBeDefined();
    expect(indexSection!.fillPercent).toBeGreaterThan(0);

    // Step 3: Read specific section — actual content only (boilerplate stripped)
    const content = store.getSection(contactId, 'index');
    expect(content).toContain('Test Contact');
    expect(content).toContain('EXECUTIVE SUMMARY');
    expect(content).not.toContain('[TO BE ADDED]');
  });

  it('boilerplate stripping dramatically reduces intelligence-risk content', () => {
    // The fixture intelligence-risk.md is mostly boilerplate
    const outline = store.getOutline('NE-TESCON-001');
    const risk = outline.sections.find(s => s.file === 'intelligence/intelligence-risk.md');
    expect(risk).toBeDefined();
    // Fill percent should be low — most content is [TO BE POPULATED]
    expect(risk!.fillPercent).toBeLessThan(50);

    // Reading the section should strip boilerplate
    const content = store.getSection('NE-TESCON-001', 'intelligence-risk');
    expect(content).not.toContain('[TO BE POPULATED]');
    expect(content).not.toContain('[TO BE ADDED]');
    // But should preserve real content
    expect(content).toContain('competitor XYZ');
  });
});

describe('relationship graph', () => {
  it('returns connections for a contact', () => {
    const connections = store.getConnections('NE-TESCON-001');
    expect(connections.length).toBe(2);
    expect(connections[0]).toHaveProperty('targetName');
    expect(connections[0]).toHaveProperty('type');
    expect(connections[0]).toHaveProperty('context');
  });

  it('includes named contacts with context', () => {
    const connections = store.getConnections('NE-TESCON-001');
    const names = connections.map(c => c.targetName);
    expect(names).toContain('Jane Doe');
    expect(names).toContain('Bob Smith');
    const jane = connections.find(c => c.targetName === 'Jane Doe');
    expect(jane!.context).toContain('Test Corp VP');
  });
});

describe('full-text search', () => {
  it('finds content across different sections', () => {
    const results = store.fullTextSearch('competitor');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].section).toBeDefined();
  });

  it('returns snippets with search terms', () => {
    const results = store.fullTextSearch('proposal');
    expect(results.length).toBeGreaterThan(0);
    // Snippet should contain some context around the match
    expect(results[0].snippet).toBeDefined();
  });
});

describe('CRM statistics', () => {
  it('returns accurate aggregate stats', () => {
    const stats = store.getStats();
    expect(stats.totalContacts).toBeGreaterThan(0);
    expect(stats.byCategory).toHaveProperty('Network');
    expect(stats.byCategory['Network']).toBeGreaterThan(0);
    expect(typeof stats.avgFillPercent).toBe('number');
    expect(stats.avgFillPercent).toBeGreaterThanOrEqual(0);
    expect(stats.avgFillPercent).toBeLessThanOrEqual(100);
  });
});

describe('recent contacts', () => {
  it('returns contacts sorted by last contact date', () => {
    const recent = store.getRecent(10);
    expect(recent.length).toBeGreaterThan(0);
    // If multiple contacts existed, they'd be sorted by date
    expect(recent[0].lastContact).toBeDefined();
  });
});

describe('profession workflow', () => {
  let tempDir: string;
  let profStore: Store;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'crm-prof-test-'));
    cpSync(FIXTURES, tempDir, { recursive: true });
    profStore = createStore(':memory:', tempDir);
    profStore.indexAll();
  });

  afterAll(() => profStore.close());

  it('create → search → read profession-aware dossier end-to-end', () => {
    // 1. Create with profession
    const result = createDossier(profStore, tempDir, {
      name: 'Ross Bratt',
      category: 'Network',
      profession: 'BSB',
      organization: 'CBRE',
    });
    expect(result.id).toBe('BSB-ROSBRA-001');

    // 2. Search by profession
    const byProf = profStore.searchContacts({ profession: 'BSB' });
    expect(byProf.length).toBe(1);
    expect(byProf[0].name).toBe('Ross Bratt');

    // 3. Search by name still works
    const byName = profStore.searchContacts({ query: 'Ross' });
    expect(byName.length).toBe(1);
    expect(byName[0].id).toBe('BSB-ROSBRA-001');

    // 4. Outline shows standard sections
    const outline = profStore.getOutline('BSB-ROSBRA-001');
    expect(outline.contact.name).toBe('Ross Bratt');
    expect(outline.sections.some(s => s.file === 'INDEX.md')).toBe(true);

    // 5. Read index section
    const content = profStore.getSection('BSB-ROSBRA-001', 'index');
    expect(content).toContain('Ross Bratt');
    expect(content).toContain('BSB');
  });

  it('reads profession-specific tracking file via getSection', () => {
    // Create a profession dossier (BSB gets deals.md)
    createDossier(profStore, tempDir, {
      name: 'Deal Maker',
      category: 'Network',
      profession: 'BSB',
    });

    // Write some identifiable content into deals.md
    const dealsPath = join(tempDir, 'Network', 'MAKER_Deal', 'deals.md');
    const content = readFileSync(dealsPath, 'utf-8');
    writeFileSync(dealsPath, content.replace('| Total Deals Tracked | |', '| Total Deals Tracked | 47 |'));

    // Re-index so FTS picks it up
    profStore.indexAll();

    // Read the tracking section via resolveSectionFile fallback
    const section = profStore.getSection('BSB-DEAMAK-001', 'deals');
    expect(section).toContain('47');
    expect(section).toContain('DEAL TRACKING');
  });

  it('finds tracking file content via full-text search', () => {
    // Create profession dossier and add searchable content
    createDossier(profStore, tempDir, {
      name: 'Search Target',
      category: 'Client',
      profession: 'VAP',
    });

    const assignmentsPath = join(tempDir, 'Clients', 'TARGET_Search', 'assignments.md');
    const content = readFileSync(assignmentsPath, 'utf-8');
    writeFileSync(assignmentsPath, content.replace('| Total Assignments Tracked | |', '| Total Assignments Tracked | UniqueAppraisalTerm |'));

    profStore.indexAll();

    const ftsResults = profStore.fullTextSearch('UniqueAppraisalTerm');
    expect(ftsResults.length).toBeGreaterThan(0);
    expect(ftsResults[0].section).toBe('assignments');
  });

  it('outline includes profession-specific tracking file', () => {
    createDossier(profStore, tempDir, {
      name: 'Outline Test',
      category: 'Network',
      profession: 'BSB',
    });

    const outline = profStore.getOutline('BSB-OUTTES-001');
    const dealsSection = outline.sections.find(s => s.file === 'deals.md');
    expect(dealsSection).toBeDefined();
    expect(dealsSection!.sizeBytes).toBeGreaterThan(0);
  });

  it('existing 2-letter contacts coexist with 3-letter profession contacts', () => {
    // Original fixture contact
    const oldResults = profStore.searchContacts({ query: 'Test Contact' });
    expect(oldResults.length).toBe(1);
    expect(oldResults[0].id).toBe('NE-TESCON-001');

    // New profession contacts (includes Ross Bratt + others created in earlier tests)
    const newResults = profStore.searchContacts({ profession: 'BSB' });
    expect(newResults.length).toBeGreaterThanOrEqual(1);
    expect(newResults.some(r => r.id === 'BSB-ROSBRA-001')).toBe(true);

    // Total should include all created contacts
    const stats = profStore.getStats();
    expect(stats.totalContacts).toBeGreaterThanOrEqual(5);
  });
});

describe('plugin integration', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'crm-plugin-test-'));
  });

  it('init creates working CRM that indexes correctly', () => {
    const crmDir = join(tempDir, 'test-crm');
    const configPath = join(tempDir, 'test-config.json');
    runInitNonInteractive({
      crmRoot: crmDir,
      templates: ['simple'],
      customTemplatePath: undefined,
      configPath,
    });

    const dbPath = join(tempDir, 'test.db');
    const initStore = createStore(dbPath, crmDir);
    initStore.indexAll();

    // The init creates a sample DOE_Jane contact
    const results = initStore.searchContacts({ query: 'Jane' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Jane');
    initStore.close();
  });

  it('audit + repair round-trip works', () => {
    const crmDir = join(tempDir, 'audit-crm');
    const configPath = join(tempDir, 'audit-config.json');
    runInitNonInteractive({
      crmRoot: crmDir,
      templates: ['simple'],
      customTemplatePath: undefined,
      configPath,
    });

    // DOE_Jane was created — modify INDEX.md to make lastContactDate stale
    // and add a newer log entry
    const janeDir = join(crmDir, 'Network', 'DOE_Jane');
    const indexPath = join(janeDir, 'INDEX.md');
    const logPath = join(janeDir, 'log.md');

    // Read and modify INDEX.md to set an old date
    let indexContent = readFileSync(indexPath, 'utf-8');
    indexContent = indexContent.replace(/lastContactDate: .+/, 'lastContactDate: 2024-01-01');
    writeFileSync(indexPath, indexContent);

    // Overwrite log with a single entry newer than 2024-01-01
    let logContent = readFileSync(logPath, 'utf-8');
    // Replace the template-generated log entry (which uses today's date) with a known date
    logContent = logContent.replace(/\| \d{4}-\d{2}-\d{2} \|.*\n?/g, '');
    logContent += '| 2026-03-01 | Call | Catchup | Good | Follow up |\n';
    writeFileSync(logPath, logContent);

    // Run audit with stale pass
    const templateDir = join(crmDir, '.templates', 'simple');
    const auditResult = runAudit(janeDir, templateDir, ['stale']);
    expect(auditResult.findings.stale.length).toBe(1);
    expect(auditResult.findings.stale[0].suggested).toBe('2026-03-01');

    // Run repair
    const repairResult = runRepair(janeDir, templateDir, auditResult, ['S1']);
    expect(repairResult.applied).toContain('S1');

    // Verify the fix was applied
    const updatedIndex = readFileSync(indexPath, 'utf-8');
    expect(updatedIndex).toContain('lastContactDate: 2026-03-01');
  });

  it('server starts in unconfigured mode without crashing', () => {
    const config = loadConfig();
    // Override crmRoot to empty
    const unconfiguredConfig = { ...config, crmRoot: '' };
    const server = createMcpServer(null, unconfiguredConfig);
    // Server should exist and not throw
    expect(server).toBeDefined();
  });
});
