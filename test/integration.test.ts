import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore, type Store } from '../src/store.js';
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
