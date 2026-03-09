import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createStore, type Store } from '../src/store.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
let store: Store;

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
