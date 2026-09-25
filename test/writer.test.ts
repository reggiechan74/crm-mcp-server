import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeTempDir } from './helpers/tmp.js';
import { join, resolve, dirname } from 'node:path';
import { mkdtempSync, cpSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createStore, type Store } from '../src/store.js';
import { appendLog, updateField, createDossier, generateF3L3, bulkUpdateField } from '../src/writer.js';
import { resolveSectionFile } from '../src/types.js';
import { parseFrontmatter } from '../src/frontmatter.js';

let store: Store;
let tempDir: string;

/**
 * Find the project's bundled templates directory.
 */
function getBundledTemplatesDir(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(thisDir, '..', 'templates'),
    resolve(thisDir, '..', '..', 'templates'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error('Templates directory not found for tests');
}

beforeEach(() => {
  // Copy fixtures to temp dir so writes don't pollute test data
  tempDir = makeTempDir('crm-test-');
  cpSync(join(import.meta.dirname, 'fixtures'), tempDir, { recursive: true });

  // Install bundled templates into .templates/ so createDossier can find them
  const bundledDir = getBundledTemplatesDir();
  const templatesDir = join(tempDir, '.templates');
  mkdirSync(templatesDir, { recursive: true });
  for (const name of ['simple', 'PROFESSIONAL', 'FAMILY', 'PERSONAL', 'REAL_ESTATE']) {
    const src = join(bundledDir, name);
    if (existsSync(src)) {
      const dest = join(templatesDir, name);
      cpSync(src, dest, { recursive: true });
    }
  }

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

describe('updateField — org roles (F1)', () => {
  it('writes a comma-separated roles update as a YAML list and keeps both roles searchable', () => {
    const org = createDossier(store, tempDir, {
      name: 'Acme Capital', category: 'Organization', orgType: 'INV', cid: 'ACM', roles: ['Client'],
    });
    updateField(store, org.id, 'index', 'roles', 'Client, Competitor');

    const indexContent = readFileSync(join(tempDir, org.path, 'INDEX.md'), 'utf-8');
    expect(indexContent).toMatch(/roles:\n\s+- Client\n\s+- Competitor/);

    expect(store.searchContacts({ roles: ['Client'] }).map(r => r.id)).toContain(org.id);
    expect(store.searchContacts({ roles: ['Competitor'] }).map(r => r.id)).toContain(org.id);
  });

  it('accepts a JSON array string for roles', () => {
    const org = createDossier(store, tempDir, {
      name: 'Beta Capital', category: 'Organization', orgType: 'INV', cid: 'BET', roles: ['Client'],
    });
    updateField(store, org.id, 'index', 'roles', '["Client","Competitor"]');
    expect(store.searchContacts({ roles: ['Competitor'] }).map(r => r.id)).toContain(org.id);
  });

  it('throws Invalid role(s) for an unknown role', () => {
    const org = createDossier(store, tempDir, {
      name: 'Gamma Capital', category: 'Organization', orgType: 'INV', cid: 'GAM', roles: ['Client'],
    });
    expect(() => updateField(store, org.id, 'index', 'roles', 'client'))
      .toThrow(/Invalid role\(s\): client\. Valid: Client, Prospect/);
  });

  it('re-derives works_at immediately when a person\'s organization field is updated', () => {
    const org = createDossier(store, tempDir, {
      name: 'Delta Capital', category: 'Organization', orgType: 'INV', cid: 'DEL',
    });
    const person = createDossier(store, tempDir, { name: 'New Person', category: 'Network' });
    updateField(store, person.id, 'index', 'organization', 'Delta Capital');

    const rels = store.getConnections(person.id);
    const w = rels.find(r => r.type === 'works_at');
    expect(w).toMatchObject({ targetId: org.id });
  });
});

describe('updateField — secondaryTypes (F1)', () => {
  it('accepts a JSON array string for secondaryTypes, including an empty array to clear it', () => {
    const org = createDossier(store, tempDir, {
      name: 'Epsilon Capital', category: 'Organization', orgType: 'BRK', cid: 'EPS', secondaryTypes: ['PM'],
    });
    updateField(store, org.id, 'index', 'secondaryTypes', '["PM","INV"]');
    let yaml = parseFrontmatter(readFileSync(join(tempDir, org.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['PM', 'INV']);

    updateField(store, org.id, 'index', 'secondaryTypes', '[]');
    yaml = parseFrontmatter(readFileSync(join(tempDir, org.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual([]);
  });

  it('still accepts the comma-separated form', () => {
    const org = createDossier(store, tempDir, {
      name: 'Zeta Capital', category: 'Organization', orgType: 'BRK', cid: 'ZET',
    });
    updateField(store, org.id, 'index', 'secondaryTypes', 'PM, INV');
    const yaml = parseFrontmatter(readFileSync(join(tempDir, org.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['PM', 'INV']);
  });
});

describe('updateField — salesMotion (F5)', () => {
  it('normalizes case-insensitively and rejects unknown values', () => {
    const org = createDossier(store, tempDir, {
      name: 'Eta Capital', category: 'Organization', orgType: 'INV', cid: 'ETA',
    });
    updateField(store, org.id, 'index', 'salesMotion', 'Tech');
    const yaml = parseFrontmatter(readFileSync(join(tempDir, org.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.salesMotion).toBe('tech');

    expect(() => updateField(store, org.id, 'index', 'salesMotion', 'aggressive'))
      .toThrow(/Invalid salesMotion "aggressive"\. Valid: general, tech/);
  });
});

describe('updateField — org-only fields on person dossiers (F7)', () => {
  it('rejects orgType, secondaryTypes and salesMotion on a non-Organization dossier', () => {
    expect(() => updateField(store, 'NE-TESCON-001', 'index', 'orgType', 'INV'))
      .toThrow(/orgType applies to Organization dossiers only/);
    expect(() => updateField(store, 'NE-TESCON-001', 'index', 'secondaryTypes', 'PM'))
      .toThrow(/secondaryTypes applies to Organization dossiers only/);
    expect(() => updateField(store, 'NE-TESCON-001', 'index', 'salesMotion', 'tech'))
      .toThrow(/salesMotion applies to Organization dossiers only/);
  });

  it('bulkUpdateField reports the same rejection per contact instead of throwing', () => {
    const r = bulkUpdateField(store, { category: 'Network' }, 'orgType', 'INV');
    expect(r.updated).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].message).toMatch(/orgType applies to Organization dossiers only/);
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

describe('resolveSectionFile', () => {
  it('returns known section files from SECTION_FILES map', () => {
    expect(resolveSectionFile('index')).toBe('INDEX.md');
    expect(resolveSectionFile('profile')).toBe('profile.md');
    expect(resolveSectionFile('intelligence-risk')).toBe('intelligence/intelligence-risk.md');
  });

  it('returns ${section}.md for unknown sections', () => {
    expect(resolveSectionFile('deals')).toBe('deals.md');
    expect(resolveSectionFile('assignments')).toBe('assignments.md');
    expect(resolveSectionFile('projects')).toBe('projects.md');
  });
});

describe('resolveContact regex', () => {
  const resolveContactRegex = /^[A-Z]{2,4}-/;

  it('matches 2-letter category codes', () => {
    expect(resolveContactRegex.test('CL-RANMUL-002')).toBe(true);
    expect(resolveContactRegex.test('NE-TESCON-001')).toBe(true);
  });

  it('matches 3-letter profession codes', () => {
    expect(resolveContactRegex.test('BSB-ROSBRA-001')).toBe(true);
    expect(resolveContactRegex.test('VAP-JANAPP-001')).toBe(true);
  });

  it('matches 4-letter org type codes', () => {
    expect(resolveContactRegex.test('SAAS-CHER-001')).toBe(true);
    expect(resolveContactRegex.test('REIT-PLD-001')).toBe(true);
  });

  it('does not match plain names', () => {
    expect(resolveContactRegex.test('Ross Bratt')).toBe(false);
    expect(resolveContactRegex.test('ranjit')).toBe(false);
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
    // Family template should have medical/ directory and education.md
    expect(existsSync(join(tempDir, 'Family', 'NYARKO-MENSAH_Janice', 'medical', 'medical.md'))).toBe(true);
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

  it('throws when org-only inputs are given for a non-Organization category (F7)', () => {
    expect(() => createDossier(store, tempDir, { name: 'Test User', category: 'Network', orgType: 'INV' }))
      .toThrow(/apply to Organization dossiers only/);
    expect(() => createDossier(store, tempDir, { name: 'Test User', category: 'Network', cid: 'ABC' }))
      .toThrow(/apply to Organization dossiers only/);
    expect(() => createDossier(store, tempDir, { name: 'Test User', category: 'Network', roles: ['Client'] }))
      .toThrow(/apply to Organization dossiers only/);
  });

  it('creates dossier with 3-letter profession code', () => {
    const result = createDossier(store, tempDir, {
      name: 'Ross Bratt',
      category: 'Network',
      profession: 'BSB',
    });
    expect(result.id).toBe('BSB-ROSBRA-001');
    expect(existsSync(join(tempDir, 'Network', 'BRATT_Ross', 'INDEX.md'))).toBe(true);

    // Verify profession is in YAML frontmatter
    const indexContent = readFileSync(join(tempDir, 'Network', 'BRATT_Ross', 'INDEX.md'), 'utf-8');
    expect(indexContent).toMatch(/profession: "?BSB"?\n/);
  });

  it('profession dossier includes tracking file', () => {
    createDossier(store, tempDir, {
      name: 'Loan Guy',
      category: 'Network',
      profession: 'FMB',
    });
    // FMB (Mortgage Broker) should get loans.md
    expect(existsSync(join(tempDir, 'Network', 'GUY_Loan', 'loans.md'))).toBe(true);
    const loansContent = readFileSync(join(tempDir, 'Network', 'GUY_Loan', 'loans.md'), 'utf-8');
    expect(loansContent).toContain('LOAN TRACKING');
  });

  it('composes dossier from COMMON + overlay for partial profession template', () => {
    // Create a .templates/ dir with ONLY a tracking file (no INDEX.md)
    const profTemplateDir = join(tempDir, '.templates', 'TEST_PROF');
    mkdirSync(profTemplateDir, { recursive: true });
    writeFileSync(join(profTemplateDir, 'custom_tracking.md'), '---\ntier: custom\n---\n# Custom Tracking\n\n## XVI. CUSTOM SECTION\n\nCustom content here.\n');

    // We can't easily test the full compose path without wiring up the profession registry,
    // but we CAN verify the tracking file template for known professions includes COMMON files
    const result = createDossier(store, tempDir, {
      name: 'Title Officer',
      category: 'Network',
      profession: 'LTE',
    });
    expect(result.id).toBe('LTE-TITOFF-001');

    // Should have COMMON files AND the profession-specific closings.md
    expect(existsSync(join(tempDir, 'Network', 'OFFICER_Title', 'INDEX.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'OFFICER_Title', 'profile.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'OFFICER_Title', 'log.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'Network', 'OFFICER_Title', 'closings.md'))).toBe(true);

    const closingsContent = readFileSync(join(tempDir, 'Network', 'OFFICER_Title', 'closings.md'), 'utf-8');
    expect(closingsContent).toContain('CLOSING TRACKING');
    expect(closingsContent).toContain('Title Officer');
  });

  it('throws for invalid profession code', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Test User',
      category: 'Network',
      profession: 'ZZZ',
    })).toThrow(/Unknown profession code/);
  });

  it('profession dossier is searchable after creation', () => {
    createDossier(store, tempDir, {
      name: 'Jane Appraiser',
      category: 'Network',
      profession: 'VAP',
    });
    const results = store.searchContacts({ query: 'Jane Appraiser' });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('VAP-JANAPP-001');
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

describe('createDossier — Organization', () => {
  it('creates code, folder, and COMMON files', () => {
    const r = createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF',
      roles: ['Client', 'OperatingPartner'],
    });
    expect(r.id).toBe('OPR-OXF-001');
    expect(r.path).toBe('Organizations/OPR_Oxford_Properties');
    const dir = join(tempDir, r.path);
    for (const f of ['INDEX.md', 'profile.md', 'intelligence.md', 'stakeholders.md', 'pipeline.md', 'log.md',
      'managed-portfolio.md']) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
    expect(existsSync(join(dir, 'portfolio.md'))).toBe(false);
    expect(existsSync(join(dir, 'tech-stack.md'))).toBe(false);
  });

  it('writes org fields into INDEX.md and indexes as Organization', () => {
    const r = createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'opr', cid: 'OXF',
      roles: ['Client', 'OperatingPartner'],
    });
    const idx = readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8');
    expect(idx).toMatch(/orgType: "?OPR"?/);
    expect(idx).toContain('category: Organization');
    expect(idx).toMatch(/roles:\n\s+- Client\n\s+- OperatingPartner/);
    expect(idx).not.toContain('{{');
    const found = store.searchContacts({ query: 'Oxford Properties' });
    expect(found[0].id).toBe('OPR-OXF-001');
    expect(found[0].category).toBe('Organization');
  });

  it('adds role overlays only for matching roles', () => {
    const r = createDossier(store, tempDir, {
      name: 'Rival Data', category: 'Organization', orgType: 'DATA',
      roles: ['Competitor', 'IntegrationPartner', 'ChannelPartner'],
    });
    const dir = join(tempDir, r.path);
    expect(existsSync(join(dir, 'competitive.md'))).toBe(true);
    expect(existsSync(join(dir, 'partnership.md'))).toBe(true);
  });

  it('defaults CID from name and increments SEQ on collision', () => {
    const a = createDossier(store, tempDir, { name: 'Acme Capital', category: 'Organization', orgType: 'INV' });
    const b = createDossier(store, tempDir, { name: 'Alpha Commons', category: 'Organization', orgType: 'INV' });
    expect(a.id).toBe('INV-AC-001');
    expect(b.id).toBe('INV-AC-002');
  });

  it('sanitizes punctuation and accents in folder and CID', () => {
    const r = createDossier(store, tempDir, { name: 'Ivanhoé Cambridge & Co.', category: 'Organization', orgType: 'INV' });
    expect(r.path).toBe('Organizations/INV_Ivanhoe_Cambridge_Co');
    expect(r.id).toBe('INV-ICC-001');
  });

  it('errors on duplicate org folder without partial writes', () => {
    createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    expect(() => createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OX2',
    })).toThrow(/already exists/);
    expect(store.searchContacts({ query: 'Oxford' }).length).toBe(1);
  });

  it('allows same name under a different orgType', () => {
    createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'INV', cid: 'OXF' });
    expect(r.id).toBe('INV-OXF-001');
  });

  it('requires a valid orgType', () => {
    expect(() => createDossier(store, tempDir, { name: 'Acme', category: 'Organization' }))
      .toThrow(/orgType.*REIT.*INV/s);
    expect(() => createDossier(store, tempDir, { name: 'Acme', category: 'Organization', orgType: 'XYZ' }))
      .toThrow(/orgType/);
  });

  it('rejects invalid or wrong-case roles with the valid list', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', roles: ['client'],
    })).toThrow(/Invalid role\(s\): client\. Valid: Client, Prospect/);
  });

  it('rejects invalid CID and profession on orgs', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', cid: 'a&b',
    })).toThrow(/Invalid CID/);
    expect(() => createDossier(store, tempDir, { name: 'X', category: 'Organization', orgType: 'INV' }))
      .toThrow(/Invalid CID/);
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', profession: 'BSB',
    })).toThrow(/profession/);
  });

  it('errors clearly when the ORGANIZATION template is not installed', () => {
    rmSync(join(tempDir, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true, force: true });
    expect(() => createDossier(store, tempDir, { name: 'Acme Co', category: 'Organization', orgType: 'INV' }))
      .toThrow(/templates pull REAL_ESTATE\/ORGANIZATION/);
  });

  it('org sections resolve and index (overlay, intelligence, pipeline)', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'INV', cid: 'OXF' });
    expect(store.getSection(r.id, 'portfolio')).toContain('BUY BOX');
    expect(store.getSection(r.id, 'intelligence')).toContain('PRIORITIES & PAIN POINTS');
    expect(store.getSection(r.id, 'pipeline')).toContain('ACTIVE OPPORTUNITIES');
  });

  it('adds exactly the primary group overlay for each group', () => {
    const cases: Array<[string, string]> = [
      ['REIT', 'portfolio.md'], ['DEBT', 'lending.md'], ['BRK', 'deal-flow.md'], ['DEV', 'projects.md'],
      ['PM', 'managed-portfolio.md'], ['LAW', 'engagements.md'], ['CORP', 'occupancy.md'],
      ['GOV', 'programs.md'], ['SAAS', 'product.md'], ['ASSN', 'membership.md'],
    ];
    const overlayFiles = cases.map(([, f]) => f);
    for (const [code, file] of cases) {
      const r = createDossier(store, tempDir, { name: `Org ${code}`, category: 'Organization', orgType: code, cid: code });
      const files = readdirSync(join(tempDir, r.path));
      expect(files, code).toContain(file);
      expect(files.filter((f) => overlayFiles.includes(f)), code).toEqual([file]);
      expect(r.warnings).toEqual([]);
    }
    const oth = createDossier(store, tempDir, { name: 'Misc Co', category: 'Organization', orgType: 'OTH', cid: 'MISC' });
    expect(readdirSync(join(tempDir, oth.path)).filter((f) => overlayFiles.includes(f))).toEqual([]);
  });

  it('multi-line firm gets one overlay per distinct group and records secondaryTypes', () => {
    const r = createDossier(store, tempDir, {
      name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV', 'VAL'],
    });
    expect(r.id).toBe('BRK-CBRE-001');
    const files = readdirSync(join(tempDir, r.path));
    for (const f of ['deal-flow.md', 'managed-portfolio.md', 'portfolio.md', 'engagements.md']) expect(files).toContain(f);
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.orgType).toBe('BRK');
    expect(yaml.secondaryTypes).toEqual(['PM', 'INV', 'VAL']);
    expect(yaml.salesMotion).toBe('general');
  });

  it('dedupes secondary types (same as primary, repeated, same group)', () => {
    const r = createDossier(store, tempDir, {
      name: 'Dup Co', category: 'Organization', orgType: 'BRK', cid: 'DUP', secondaryTypes: ['CAP', 'brk', 'CAP'],
    });
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['CAP']);
    expect(readdirSync(join(tempDir, r.path)).filter((f) => f === 'deal-flow.md')).toHaveLength(1);
  });

  it('normalizes type codes (case and whitespace)', () => {
    const r = createDossier(store, tempDir, {
      name: 'Padded Co', category: 'Organization', orgType: ' debt ', cid: 'PAD', secondaryTypes: [' pm'],
    });
    expect(r.id).toBe('DEBT-PAD-001');
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['PM']);
  });

  it('rejects unknown secondary types with the grouped list', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Bad Co', category: 'Organization', orgType: 'BRK', secondaryTypes: ['LND'],
    })).toThrow(/Invalid org type\(s\): LND\. Valid:\n.*Owners & Investors/s);
    expect(existsSync(join(tempDir, 'Organizations', 'BRK_Bad_Co'))).toBe(false);
  });

  it('tech sales motion adds the tech-sale layer and SaaS pipeline', () => {
    const r = createDossier(store, tempDir, {
      name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY', roles: ['Prospect'], salesMotion: 'tech',
    });
    const dir = join(tempDir, r.path);
    expect(existsSync(join(dir, 'tech-stack.md'))).toBe(true);
    expect(readFileSync(join(dir, 'pipeline.md'), 'utf-8')).toContain('Security Review');
    expect(parseFrontmatter(readFileSync(join(dir, 'INDEX.md'), 'utf-8'))!.salesMotion).toBe('tech');
  });

  it('general sales motion keeps the neutral pipeline', () => {
    const r = createDossier(store, tempDir, { name: 'Plain PM', category: 'Organization', orgType: 'PM', cid: 'PLN' });
    expect(readFileSync(join(tempDir, r.path, 'pipeline.md'), 'utf-8')).not.toContain('Security Review');
  });

  it('Vendor and ServiceProvider roles add vendor.md once', () => {
    const r = createDossier(store, tempDir, {
      name: 'Fix It', category: 'Organization', orgType: 'FM', cid: 'FIX', roles: ['Vendor', 'ServiceProvider'],
    });
    expect(existsSync(join(tempDir, r.path, 'vendor.md'))).toBe(true);
  });

  it('warns when an overlay is not installed but still creates the dossier', () => {
    rmSync(join(tempDir, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'TYPES', 'LENDING'), { recursive: true });
    const r = createDossier(store, tempDir, { name: 'Old Bank', category: 'Organization', orgType: 'BANK', cid: 'OLDB' });
    expect(existsSync(join(tempDir, r.path, 'INDEX.md'))).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('TYPES/LENDING');
    expect(r.warnings[0]).toContain('crm-mcp templates pull REAL_ESTATE/ORGANIZATION');
  });

  it('rejects secondaryTypes on person dossiers', () => {
    expect(() => createDossier(store, tempDir, { name: 'Pat Person', category: 'Network', secondaryTypes: ['PM'] }))
      .toThrow(/apply to Organization dossiers only/);
  });

  it('crm_read index surfaces the confidentiality block', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    const p = join(tempDir, r.path, 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('confidentiality: []',
      'confidentiality:\n  - source: "Client X via Oxford"\n    rule: "Do not share"'));
    store.indexOne(r.path);
    expect(store.getSection(r.id, 'index')).toContain('Client X via Oxford');
  });

  it('crm_log appends into the interaction log, not the document registry', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    appendLog(store, r.id, { date: '2026-09-24', type: 'Call', summary: 'Intro with Jane Doe (CIO)' });
    const log = readFileSync(join(tempDir, r.path, 'log.md'), 'utf-8');
    const interaction = log.slice(log.indexOf('## II. INTERACTION LOG'));
    expect(interaction).toContain('| 2026-09-24 | Call | Intro with Jane Doe (CIO) |  |  |');
  });

  it('falls back to the CID for the folder stem when the name has no ASCII letters (F5)', () => {
    const r = createDossier(store, tempDir, {
      name: '三井不動産', category: 'Organization', orgType: 'INV', cid: 'MFI',
    });
    expect(r.path).toBe('Organizations/INV_MFI');
  });

  it('still requires a valid CID for an all-non-ASCII name without one (F5)', () => {
    expect(() => createDossier(store, tempDir, {
      name: '三井不動産', category: 'Organization', orgType: 'INV',
    })).toThrow(/Invalid CID/);
  });

  it('person dossiers are unchanged', () => {
    const r = createDossier(store, tempDir, { name: 'Jane Smith', category: 'Network' });
    expect(r.id).toBe('NE-JANSMI-001');
  });
});
