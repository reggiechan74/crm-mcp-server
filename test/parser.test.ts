import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  parseIndexYaml,
  stripBoilerplate,
  scanDossierSections,
  extractRelationships,
} from '../src/parser.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const DOSSIER = join(FIXTURES, 'Network', 'TEST_Contact');

describe('parseIndexYaml', () => {
  it('extracts contact metadata from INDEX.md', () => {
    const contact = parseIndexYaml(DOSSIER);
    expect(contact.id).toBe('NE-TESCON-001');
    expect(contact.name).toBe('Test Contact');
    expect(contact.organization).toBe('Test Corp');
    expect(contact.status).toBe('Active');
  });

  it('extracts lastContactDate', () => {
    const contact = parseIndexYaml(DOSSIER);
    expect(contact.lastContact).toBe('2026-01-15');
  });

  it('extracts lastUpdated', () => {
    const contact = parseIndexYaml(DOSSIER);
    expect(contact.lastUpdated).toBe('2026-02-01');
  });

  it('detects category from directory structure', () => {
    const contact = parseIndexYaml(DOSSIER);
    expect(contact.category).toBe('Network');
  });
});

describe('stripBoilerplate', () => {
  it('removes [TO BE ADDED] lines', () => {
    const input = `### A. Facts

1. [TO BE ADDED]

### B. Real

Actual content here.`;
    const result = stripBoilerplate(input);
    expect(result).not.toContain('[TO BE ADDED]');
    expect(result).toContain('Actual content here.');
  });

  it('removes [TO BE POPULATED] lines', () => {
    const input = '- **Transparency Score:** [TO BE POPULATED] - Are their true intentions clear?';
    const result = stripBoilerplate(input);
    expect(result.trim()).toBe('');
  });

  it('removes empty table rows with all placeholders', () => {
    const input = `| Header1 | Header2 |
|---------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] |`;
    const result = stripBoilerplate(input);
    expect(result).not.toContain('[TO BE POPULATED]');
  });

  it('preserves real content', () => {
    const input = '- Important: Avoid discussing competitor XYZ';
    const result = stripBoilerplate(input);
    expect(result).toContain('competitor XYZ');
  });

  it('removes sections where ALL content is placeholder', () => {
    const input = `### A. Must-Know Facts

1. [TO BE ADDED]

### B. Preferences

- [TO BE ADDED]

### C. Real Section

Real content.`;
    const result = stripBoilerplate(input);
    expect(result).not.toContain('Must-Know Facts');
    expect(result).not.toContain('Preferences');
    expect(result).toContain('Real Section');
    expect(result).toContain('Real content.');
  });

  it('handles real-world intelligence-risk.md boilerplate', () => {
    // Simulate the Cialdini Framework table
    const input = `### F. Manipulation Tactics Detection

> **ANALYSIS FRAMEWORK:** Document observed manipulation tactics using established psychological frameworks.

#### 1. Observed Tactics Inventory

| Tactic | Evidence | Frequency | Severity |
|--------|----------|-----------|----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

#### 2. Influence Principle Usage (Cialdini Framework)

| Principle | Observed Usage | Example |
|-----------|----------------|---------|
| Reciprocity | [TO BE POPULATED] | [TO BE POPULATED] |
| Commitment/Consistency | [TO BE POPULATED] | [TO BE POPULATED] |
| Social Proof | [TO BE POPULATED] | [TO BE POPULATED] |`;
    const result = stripBoilerplate(input);
    // Entire section should be stripped since all content is placeholder
    expect(result.trim()).toBe('');
  });
});

describe('scanDossierSections', () => {
  it('returns section metadata for existing files', () => {
    const sections = scanDossierSections(DOSSIER);
    expect(sections.length).toBeGreaterThan(0);
    const index = sections.find(s => s.file === 'INDEX.md');
    expect(index).toBeDefined();
    expect(index!.sizeBytes).toBeGreaterThan(0);
  });

  it('computes fill percentage correctly', () => {
    const sections = scanDossierSections(DOSSIER);
    const risk = sections.find(s => s.file === 'intelligence/intelligence-risk.md');
    expect(risk).toBeDefined();
    // Risk file is mostly boilerplate, should have low fill%
    expect(risk!.fillPercent).toBeLessThan(50);
    // INDEX.md has real content, should have high fill%
    const index = sections.find(s => s.file === 'INDEX.md');
    expect(index!.fillPercent).toBeGreaterThan(50);
  });

  it('only returns sections that exist on disk', () => {
    const sections = scanDossierSections(DOSSIER);
    // medical.md and education.md should NOT be in results (not created in fixtures)
    expect(sections.find(s => s.file === 'medical.md')).toBeUndefined();
    expect(sections.find(s => s.file === 'education.md')).toBeUndefined();
  });
});

describe('extractRelationships', () => {
  it('extracts linkedContacts from INDEX.md YAML', () => {
    const rels = extractRelationships(DOSSIER, 'NE-TESCON-001');
    expect(rels.length).toBe(2);
  });

  it('parses name and context from "Name (Context)" format', () => {
    const rels = extractRelationships(DOSSIER, 'NE-TESCON-001');
    const jane = rels.find(r => r.targetName === 'Jane Doe');
    expect(jane).toBeDefined();
    expect(jane!.context).toContain('Test Corp VP');
  });

  it('sets sourceId correctly', () => {
    const rels = extractRelationships(DOSSIER, 'NE-TESCON-001');
    expect(rels.every(r => r.sourceId === 'NE-TESCON-001')).toBe(true);
  });
});
