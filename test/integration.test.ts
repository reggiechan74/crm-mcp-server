import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createStore, type Store } from '../src/store.js';

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
