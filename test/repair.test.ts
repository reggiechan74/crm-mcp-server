import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runAudit } from '../src/audit.js';
import { runRepair } from '../src/repair.js';

const tempDir = join(import.meta.dirname, '.tmp-repair-test');

beforeEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
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

describe('runRepair — moves', () => {
  it('moves misplaced content to the correct file', () => {
    const dossierDir = join(tempDir, 'Network', 'MOVE_Test');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\n---\n# Test\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## III. PROFESSIONAL BACKGROUND\nSome background\n');
    // Misplaced: ## II. CONTACT INFORMATION is in log.md instead of profile.md
    writeFileSync(join(dossierDir, 'log.md'), '---\n---\n## II. CONTACT INFORMATION\nPhone: 555-1234\n## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const tplDir = join(tempDir, '.templates', 'professional');
    const audit = runAudit(dossierDir, tplDir, ['misplaced']);
    expect(audit.findings.misplaced.length).toBe(1);
    expect(audit.findings.misplaced[0].code).toBe('M1');

    const result = runRepair(dossierDir, tplDir, audit, ['M1']);

    expect(result.applied).toContain('M1');
    expect(result.failed).toHaveLength(0);

    // Verify content moved to profile.md
    const profileContent = readFileSync(join(dossierDir, 'profile.md'), 'utf-8');
    expect(profileContent).toContain('## II. CONTACT INFORMATION');
    expect(profileContent).toContain('Phone: 555-1234');

    // Verify content removed from log.md
    const logContent = readFileSync(join(dossierDir, 'log.md'), 'utf-8');
    expect(logContent).not.toContain('## II. CONTACT INFORMATION');
    expect(logContent).not.toContain('Phone: 555-1234');
    // Ensure log.md still has its own sections
    expect(logContent).toContain('## XII. INTERACTION LOG');
  });
});

describe('runRepair — stale', () => {
  it('updates stale YAML fields', () => {
    const dossierDir = join(tempDir, 'Network', 'STALE_Test');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\nlastContactDate: 2025-01-01\n---\n# Test\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## II. CONTACT INFORMATION\n## III. PROFESSIONAL BACKGROUND\n');
    writeFileSync(join(dossierDir, 'log.md'),
      '---\n---\n## XII. INTERACTION LOG\n| Date | Type | Summary | Outcome | Next Step |\n|------|------|---------|---------|---|\n| 2026-02-15 | Call | Catchup | Good | Follow up |\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const tplDir = join(tempDir, '.templates', 'professional');
    const audit = runAudit(dossierDir, tplDir, ['stale']);
    expect(audit.findings.stale.length).toBe(1);
    expect(audit.findings.stale[0].code).toBe('S1');

    const result = runRepair(dossierDir, tplDir, audit, ['S1']);

    expect(result.applied).toContain('S1');
    expect(result.failed).toHaveLength(0);

    // Verify INDEX.md now has updated date
    const indexContent = readFileSync(join(dossierDir, 'INDEX.md'), 'utf-8');
    expect(indexContent).toContain('lastContactDate: 2026-02-15');
    expect(indexContent).not.toContain('lastContactDate: 2025-01-01');
  });
});

describe('runRepair — validation', () => {
  it('validates content integrity after repair', () => {
    const dossierDir = join(tempDir, 'Network', 'VALIDATE_Test');
    mkdirSync(join(dossierDir, 'intelligence'), { recursive: true });
    writeFileSync(join(dossierDir, 'INDEX.md'), '---\nname: Test\n---\n# Test\n## I. EXECUTIVE SUMMARY\n## Quick Contact\n');
    writeFileSync(join(dossierDir, 'profile.md'), '---\n---\n## III. PROFESSIONAL BACKGROUND\nSome background\n');
    // Misplaced content
    writeFileSync(join(dossierDir, 'log.md'), '---\n---\n## II. CONTACT INFORMATION\nPhone: 555-1234\n## XII. INTERACTION LOG\n## XIII. NEXT ACTIONS\n');
    writeFileSync(join(dossierDir, 'intelligence', 'intelligence-profile.md'), '---\n---\n## VII. PSYCHOLOGICAL PROFILE\n### A. Personality\n');

    const tplDir = join(tempDir, '.templates', 'professional');
    const audit = runAudit(dossierDir, tplDir, ['misplaced']);

    const result = runRepair(dossierDir, tplDir, audit, ['M1']);

    expect(result.validation.contentIntegrity).toBe('PASS');
    expect(result.validation.linesBefore).toBeGreaterThan(0);
    expect(result.validation.linesAfter).toBeGreaterThan(0);
    expect(result.validation.complianceAfter).toBeGreaterThanOrEqual(0);
  });
});
