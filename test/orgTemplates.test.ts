import { describe, it, expect } from 'vitest';
import { join, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ORG_GROUPS, ORG_GROUP_KEYS, ROLE_OVERLAYS } from '../src/orgTypes.js';

const ORG = join(import.meta.dirname, '..', 'templates', 'REAL_ESTATE', 'ORGANIZATION');
const COMMON_FILES = ['INDEX.md', 'profile.md', 'intelligence.md', 'stakeholders.md', 'pipeline.md', 'log.md'];

function mdFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(e.parentPath, e.name));
}

function frontmatter(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf-8')
    .replace(/\{\{date\}\}/g, '2026-09-24')
    .replace(/\{\{\w+\}\}/g, 'X');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  expect(m, `${path} has frontmatter`).not.toBeNull();
  return parseYaml(m![1]);
}

/** Overlay dirs: TYPES/*, ROLES/*, MOTION/* */
function overlayDirs(): string[] {
  return ['TYPES', 'ROLES', 'MOTION'].flatMap((kind) =>
    readdirSync(join(ORG, kind), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(ORG, kind, e.name)));
}

describe('ORGANIZATION templates', () => {
  it('ships exactly the COMMON files (portfolio moved to OWNERS)', () => {
    expect(readdirSync(join(ORG, 'COMMON')).sort()).toEqual([...COMMON_FILES].sort());
  });

  it('ships one overlay per group with the registered file', () => {
    for (const key of ORG_GROUP_KEYS) {
      const overlay = ORG_GROUPS[key].overlay;
      if (!overlay) continue;
      expect(readdirSync(join(ORG, 'TYPES', overlay.dir)), key).toEqual([overlay.file]);
    }
  });

  it('ships role and motion overlays', () => {
    for (const dir of new Set(Object.values(ROLE_OVERLAYS))) {
      expect(existsSync(join(ORG, 'ROLES', dir!)), dir).toBe(true);
    }
    expect(readdirSync(join(ORG, 'ROLES', 'VENDOR'))).toEqual(['vendor.md']);
    expect(readdirSync(join(ORG, 'MOTION', 'TECH_SALE')).sort()).toEqual(['pipeline.md', 'tech-stack.md']);
  });

  it('overlays only add files — the one allowed replacement is TECH_SALE pipeline.md', () => {
    const owner = new Map<string, string>();
    for (const dir of overlayDirs()) {
      for (const f of readdirSync(dir)) {
        expect(owner.has(f), `${f} shipped by ${owner.get(f)} and ${relative(ORG, dir)}`).toBe(false);
        owner.set(f, relative(ORG, dir));
        if (COMMON_FILES.includes(f)) expect(`${relative(ORG, dir)}/${f}`).toBe('MOTION/TECH_SALE/pipeline.md');
      }
    }
  });

  it('INDEX.md frontmatter parses and has org fields', () => {
    const y = frontmatter(join(ORG, 'COMMON', 'INDEX.md'));
    expect(y.category).toBe('Organization');
    expect(y.roles).toEqual([]);
    expect(y.secondaryTypes).toEqual([]);
    expect(y.salesMotion).toBe('general');
    expect(y.aliases).toEqual([]);
    expect(y.linkedContacts).toEqual([]);
    expect(y.confidentiality).toEqual([]);
    expect(y).toHaveProperty('orgType');
    expect(y).toHaveProperty('dossierCode');
  });

  it('every file has parseable frontmatter with dossierCode', () => {
    for (const f of mdFiles(ORG)) expect(frontmatter(f), f).toHaveProperty('dossierCode');
  });

  it('COMMON carries no SaaS-seller vocabulary', () => {
    const banned = ['POC', 'Security Review', 'MSA', 'Order Form', 'Buying Committee',
      'Systems of Record', 'Data Maturity', 'Technology Buying'];
    for (const f of COMMON_FILES) {
      const text = readFileSync(join(ORG, 'COMMON', f), 'utf-8');
      for (const term of banned) {
        expect(new RegExp(`\\b${term}\\b`, 'i').test(text), `${f} contains "${term}"`).toBe(false);
      }
    }
  });

  it('TECH_SALE keeps the SaaS content', () => {
    const tech = readFileSync(join(ORG, 'MOTION', 'TECH_SALE', 'tech-stack.md'), 'utf-8');
    for (const h of ['SYSTEMS OF RECORD', 'DATA MATURITY', 'TECHNOLOGY BUYING BEHAVIOR', 'BUYING COMMITTEE']) {
      expect(tech).toContain(h);
    }
    expect(readFileSync(join(ORG, 'MOTION', 'TECH_SALE', 'pipeline.md'), 'utf-8')).toContain('Security Review');
  });

  it('headings are unique across files (audit routes by heading)', () => {
    const where = new Map<string, string>();
    for (const f of mdFiles(ORG)) {
      const name = f.split('/').pop()!;
      for (const line of readFileSync(f, 'utf-8').split('\n')) {
        if (!/^#{2,4}\s+/.test(line)) continue;
        const h = line.trimEnd();
        const prev = where.get(h);
        if (prev && prev.split('/').pop() !== name) {
          throw new Error(`Heading "${h}" in both ${relative(ORG, prev)} and ${relative(ORG, f)}`);
        }
        where.set(h, f);
      }
    }
  });

  it('pipeline files and competitive overlay carry the confidentiality rule', () => {
    for (const f of [join(ORG, 'COMMON', 'pipeline.md'), join(ORG, 'MOTION', 'TECH_SALE', 'pipeline.md'),
      join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md')]) {
      expect(readFileSync(f, 'utf-8')).toContain('Never record one client');
    }
  });

  it('log.md document registry is type-neutral', () => {
    expect(readFileSync(join(ORG, 'COMMON', 'log.md'), 'utf-8'))
      .toContain('[NDA / LOI / PSA / Lease / Loan Docs / Engagement Letter / Contract]');
  });
});
