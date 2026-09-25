import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const ORG = join(import.meta.dirname, '..', 'templates', 'REAL_ESTATE', 'ORGANIZATION');
const COMMON_FILES = ['INDEX.md', 'profile.md', 'portfolio.md', 'intelligence.md',
  'stakeholders.md', 'pipeline.md', 'log.md'];

function frontmatter(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf-8')
    .replace(/\{\{date\}\}/g, '2026-09-24')
    .replace(/\{\{\w+\}\}/g, 'X');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  expect(m, `${path} has frontmatter`).not.toBeNull();
  return parseYaml(m![1]);
}

describe('ORGANIZATION templates', () => {
  it('ships all COMMON files', () => {
    for (const f of COMMON_FILES) expect(existsSync(join(ORG, 'COMMON', f)), f).toBe(true);
  });

  it('ships role overlays', () => {
    expect(existsSync(join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md'))).toBe(true);
    expect(existsSync(join(ORG, 'ROLES', 'PARTNER', 'partnership.md'))).toBe(true);
  });

  it('INDEX.md frontmatter parses and has org fields', () => {
    const y = frontmatter(join(ORG, 'COMMON', 'INDEX.md'));
    expect(y.category).toBe('Organization');
    expect(y.roles).toEqual([]);
    expect(y.aliases).toEqual([]);
    expect(y.linkedContacts).toEqual([]);
    expect(y.confidentiality).toEqual([]);
    expect(y).toHaveProperty('orgType');
    expect(y).toHaveProperty('dossierCode');
  });

  it('every file has parseable frontmatter with dossierCode', () => {
    const files = [...COMMON_FILES.map(f => join(ORG, 'COMMON', f)),
      join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md'),
      join(ORG, 'ROLES', 'PARTNER', 'partnership.md')];
    for (const f of files) expect(frontmatter(f)).toHaveProperty('dossierCode');
  });

  it('competitive and pipeline carry the confidentiality rule', () => {
    for (const f of [join(ORG, 'COMMON', 'pipeline.md'), join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md')]) {
      expect(readFileSync(f, 'utf-8')).toContain('Never record one client');
    }
  });
});
