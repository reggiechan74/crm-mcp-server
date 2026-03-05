import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, cpSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createStore, type Store } from '../src/store.js';
import { appendLog, updateField, createDossier, generateF3L3 } from '../src/writer.js';

let store: Store;
let tempDir: string;

beforeEach(() => {
  // Copy fixtures to temp dir so writes don't pollute test data
  tempDir = mkdtempSync(join(tmpdir(), 'crm-test-'));
  cpSync(join(import.meta.dirname, 'fixtures'), tempDir, { recursive: true });
  store = createStore(':memory:', tempDir);
  store.indexAll();
});

afterEach(() => {
  store.close();
});

describe('appendLog', () => {
  it('appends interaction row to log.md file', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Email',
      summary: 'Discussed project timeline',
      outcome: 'Agreed on March deadline',
      nextStep: 'Send proposal by Friday',
    });
    // Verify the file on disk was updated
    const logPath = join(tempDir, 'Network', 'TEST_Contact', 'log.md');
    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain('Discussed project timeline');
    expect(content).toContain('2026-03-04');
    expect(content).toContain('Send proposal by Friday');
  });

  it('updates cache so getSection returns new content', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Call',
      summary: 'Quick check-in call',
    });
    const content = store.getSection('NE-TESCON-001', 'log');
    expect(content).toContain('Quick check-in call');
  });

  it('preserves existing log entries', () => {
    appendLog(store, 'NE-TESCON-001', {
      date: '2026-03-04',
      type: 'Email',
      summary: 'New interaction',
    });
    const logPath = join(tempDir, 'Network', 'TEST_Contact', 'log.md');
    const content = readFileSync(logPath, 'utf-8');
    // Original entry should still be there
    expect(content).toContain('Introductory email');
    // New entry should be there too
    expect(content).toContain('New interaction');
  });
});

describe('updateField', () => {
  it('updates YAML frontmatter field in INDEX.md', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain('status: DORMANT');
  });

  it('updates lastUpdated timestamp', () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain(`lastUpdated: ${today}`);
  });

  it('preserves file body after YAML update', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const indexPath = join(tempDir, 'Network', 'TEST_Contact', 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    // Body should still be intact
    expect(content).toContain('EXECUTIVE SUMMARY');
    expect(content).toContain('Test contact for unit tests');
  });

  it('invalidates cache after update', () => {
    updateField(store, 'NE-TESCON-001', 'index', 'status', 'DORMANT');
    const content = store.getSection('NE-TESCON-001', 'index');
    expect(content).toContain('DORMANT');
  });
});

describe('generateF3L3', () => {
  it('handles simple first/last name', () => {
    expect(generateF3L3('Ross Bratt')).toBe('ROSBRA');
  });

  it('handles hyphenated surname (takes first part)', () => {
    expect(generateF3L3('Janice Nyarko-Mensah')).toBe('JANNYA');
  });

  it('handles short name (< 3 chars)', () => {
    expect(generateF3L3('Ed Chan')).toBe('EDCHA');
  });

  it('removes accents', () => {
    expect(generateF3L3('José García')).toBe('JOSGAR');
  });
});

describe('createDossier', () => {
  it('creates a new dossier folder from template', () => {
    const result = createDossier(store, tempDir, {
      name: 'New Person',
      category: 'Network',
    });
    expect(result.id).toMatch(/^NE-NEWPER-\d{3}$/);
    expect(existsSync(join(tempDir, 'Network', 'PERSON_New', 'INDEX.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'PERSON_New', 'profile.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'PERSON_New', 'log.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'PERSON_New', 'intelligence'))).toBe(true);
  });

  it('creates with organization', () => {
    const result = createDossier(store, tempDir, {
      name: 'Jane Smith',
      category: 'Client',
      organization: 'Acme Corp',
    });
    expect(result.id).toMatch(/^CL-JANSMI-\d{3}$/);
    // Verify organization was written into INDEX.md
    const indexContent = readFileSync(join(tempDir, 'Clients', 'SMITH_Jane', 'INDEX.md'), 'utf-8');
    expect(indexContent).toContain('Acme Corp');
  });

  it('handles hyphenated surnames', () => {
    const result = createDossier(store, tempDir, {
      name: 'Janice Nyarko-Mensah',
      category: 'Family',
    });
    expect(result.id).toMatch(/^FA-JANNYA-\d{3}$/);
    // Family template should have medical.md and education.md
    expect(existsSync(join(tempDir, 'Family', 'NYARKO-MENSAH_Janice', 'medical.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Family', 'NYARKO-MENSAH_Janice', 'education.md'))).toBe(true);
  });

  it('generates INDEX.md parseable by the store', () => {
    createDossier(store, tempDir, {
      name: 'Alice Wonderland',
      category: 'Prospect',
    });
    // After creation, store.indexAll() was called; the contact should be findable
    const results = store.searchContacts({ query: 'Alice' });
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Alice Wonderland');
    expect(results[0].category).toBe('Prospect');
  });

  it('increments sequence number for duplicate F3L3', () => {
    const r1 = createDossier(store, tempDir, { name: 'New Person', category: 'Network' });
    expect(r1.id).toBe('NE-NEWPER-001');

    const r2 = createDossier(store, tempDir, { name: 'Newman Perkins', category: 'Network' });
    expect(r2.id).toBe('NE-NEWPER-002');
  });

  it('replaces template placeholders in files', () => {
    createDossier(store, tempDir, {
      name: 'Bob Builder',
      category: 'Client',
      organization: 'BuildCo',
    });
    const profileContent = readFileSync(join(tempDir, 'Clients', 'BUILDER_Bob', 'profile.md'), 'utf-8');
    // Template name references should be replaced
    expect(profileContent).not.toContain('DOSSIER_TEMPLATE');
    expect(profileContent).toContain('Bob Builder');
  });

  it('throws for invalid category', () => {
    expect(() => createDossier(store, tempDir, { name: 'Test User', category: 'Invalid' }))
      .toThrow(/Invalid category/);
  });

  it('uses Personal template for Personal category', () => {
    const result = createDossier(store, tempDir, {
      name: 'Close Friend',
      category: 'Personal',
    });
    expect(result.id).toMatch(/^PE-CLOFRI-\d{3}$/);
    // Personal template has intelligence-assessment.md, not intelligence-risk.md
    expect(existsSync(join(tempDir, 'Personal', 'FRIEND_Close', 'intelligence', 'intelligence-assessment.md'))).toBe(true);
  });

  it('creates dossier from .templates/ when available', () => {
    // Set up .templates/simple/ in the temp CRM root
    const templatesDir = join(tempDir, '.templates', 'simple');
    mkdirSync(templatesDir, { recursive: true });
    writeFileSync(join(templatesDir, 'template.json'), JSON.stringify({
      name: 'Simple', description: 'Test', sections: ['INDEX', 'log'], variables: ['name']
    }));
    writeFileSync(join(templatesDir, 'INDEX.md'), '---\nname: "{{name}}"\ndossierCode: "{{dossierCode}}"\ncategory: {{category}}\nstatus: Active\nlastUpdated: {{date}}\n---\n# {{name}}\n');
    writeFileSync(join(templatesDir, 'log.md'), '---\ncontactName: "{{name}}"\nlastUpdated: {{date}}\n---\n# {{name}} - Log\n');

    const result = createDossier(store, tempDir, {
      name: 'Alice Wonder',
      category: 'Network',
      template: 'simple',
    });

    expect(result.id).toMatch(/^NE-ALIWON-\d{3}$/);

    // Verify files were created from .templates/simple, not from bundled templates
    const indexPath = join(tempDir, 'Network', 'WONDER_Alice', 'INDEX.md');
    const indexContent = readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('Alice Wonder');
    expect(indexContent).not.toContain('{{name}}');

    // Verify log.md was created (from simple template, no profile.md)
    expect(existsSync(join(tempDir, 'Network', 'WONDER_Alice', 'log.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'WONDER_Alice', 'profile.md'))).toBe(false);
  });
});
