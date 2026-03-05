import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildRoutingTable, runAudit } from '../src/audit.js';

const tempDir = join(import.meta.dirname, '.tmp-audit-test');

beforeEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  // Create a minimal template structure
  const tplDir = join(tempDir, '.templates', 'professional');
  mkdirSync(join(tplDir, 'intelligence'), { recursive: true });
  writeFileSync(join(tplDir, 'template.json'), JSON.stringify({
    name: 'Professional', sections: ['INDEX', 'profile', 'log', 'intelligence-profile']
  }));
  writeFileSync(join(tplDir, 'INDEX.md'), '# Name\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
  writeFileSync(join(tplDir, 'profile.md'), '## II. CONTACT INFORMATION\n## III. PROFESSIONAL BACKGROUND\n');
  writeFileSync(join(tplDir, 'log.md'), '## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
  writeFileSync(join(tplDir, 'intelligence', 'intelligence-profile.md'), '## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('buildRoutingTable', () => {
  it('maps section headers to their canonical file', () => {
    const table = buildRoutingTable(join(tempDir, '.templates', 'professional'));
    expect(table.get('## I. EXECUTIVE SUMMARY')).toBe('INDEX.md');
    expect(table.get('## II. CONTACT INFORMATION')).toBe('profile.md');
    expect(table.get('## XII. INTERACTION LOG')).toBe('log.md');
    expect(table.get('## VII. PSYCHOLOGICAL PROFILE')).toBe('intelligence/intelligence-profile.md');
  });

  it('ignores h1 headings (document titles)', () => {
    const table = buildRoutingTable(join(tempDir, '.templates', 'professional'));
    expect(table.has('# Name')).toBe(false);
  });

  it('includes h3 and h4 headings', () => {
    const table = buildRoutingTable(join(tempDir, '.templates', 'professional'));
    expect(table.get('### A. Personality')).toBe('intelligence/intelligence-profile.md');
  });
});

describe('runAudit — compliance pass', () => {
  it('detects missing sections', () => {
    // Create a dossier missing one section
    const dossierDir = join(tempDir, 'Network', 'TEST_Contact');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\n---\n# Test\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\n');
    // Missing: ## III. PROFESSIONAL BACKGROUND
    writeFileSync(join(dossierDir, 'log.md'), '---\n---\n## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const result = runAudit(dossierDir, join(tempDir, '.templates', 'professional'), ['compliance']);

    expect(result.findings.missing.length).toBeGreaterThan(0);
    expect(result.findings.missing[0].section).toContain('PROFESSIONAL BACKGROUND');
    expect(result.findings.missing[0].file).toBe('profile.md');
    expect(result.compliance).toBeLessThan(100);
  });

  it('returns 100% compliance when all sections present', () => {
    const dossierDir = join(tempDir, 'Network', 'FULL_Contact');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\n---\n# Full\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\n## III. PROFESSIONAL BACKGROUND\n');
    writeFileSync(join(dossierDir, 'log.md'), '---\n---\n## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const result = runAudit(dossierDir, join(tempDir, '.templates', 'professional'), ['compliance']);

    expect(result.compliance).toBe(100);
    expect(result.findings.missing.length).toBe(0);
  });

  it('initializes all finding arrays even when only compliance pass is run', () => {
    const dossierDir = join(tempDir, 'Network', 'FULL_Contact');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\n---\n# Full\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\n## III. PROFESSIONAL BACKGROUND\n');
    writeFileSync(join(dossierDir, 'log.md'), '---\n---\n## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const result = runAudit(dossierDir, join(tempDir, '.templates', 'professional'), ['compliance']);

    expect(Array.isArray(result.findings.misplaced)).toBe(true);
    expect(Array.isArray(result.findings.stale)).toBe(true);
    expect(Array.isArray(result.findings.duplicates)).toBe(true);
    expect(Array.isArray(result.findings.ordering)).toBe(true);
    expect(Array.isArray(result.findings.missing)).toBe(true);
  });
});
