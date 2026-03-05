import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeContentHash, readManifest, writeManifest, ensureManifest,
  migrateManifest, isCustomized, listLocalTemplates, installBundledTemplates,
  installTemplate, readTemplateInfo, countFiles,
  type Manifest,
} from '../src/templates.js';

const tempDir = join(import.meta.dirname, '.tmp-templates-test');

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
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('computeContentHash', () => {
  it('produces deterministic hash for same content', () => {
    const dir = join(tempDir, 'hash-test');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), 'hello');
    writeFileSync(join(dir, 'b.md'), 'world');

    const hash1 = computeContentHash(dir);
    const hash2 = computeContentHash(dir);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('changes when file content changes', () => {
    const dir = join(tempDir, 'hash-change');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), 'hello');

    const hash1 = computeContentHash(dir);
    writeFileSync(join(dir, 'a.md'), 'goodbye');
    const hash2 = computeContentHash(dir);

    expect(hash1).not.toBe(hash2);
  });

  it('changes when a file is added', () => {
    const dir = join(tempDir, 'hash-add');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), 'hello');

    const hash1 = computeContentHash(dir);
    writeFileSync(join(dir, 'b.md'), 'new file');
    const hash2 = computeContentHash(dir);

    expect(hash1).not.toBe(hash2);
  });
});

describe('manifest I/O', () => {
  it('writes and reads manifest', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(join(crmRoot, '.templates'), { recursive: true });

    const manifest: Manifest = {
      schemaVersion: 1,
      installedAt: '2026-03-05T00:00:00Z',
      templates: {
        PROFESSIONAL: {
          version: '1.0.0',
          installedAt: '2026-03-05T00:00:00Z',
          updatedAt: '2026-03-05T00:00:00Z',
          source: 'bundled',
          contentHash: 'sha256:abc123',
        },
      },
    };

    writeManifest(crmRoot, manifest);
    const read = readManifest(crmRoot);
    expect(read).toEqual(manifest);
  });

  it('returns null when no manifest exists', () => {
    const crmRoot = join(tempDir, 'empty');
    mkdirSync(crmRoot, { recursive: true });
    expect(readManifest(crmRoot)).toBeNull();
  });
});

describe('installBundledTemplates', () => {
  it('installs templates and creates manifest', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(crmRoot, { recursive: true });

    const manifest = installBundledTemplates(crmRoot, ['simple', 'PROFESSIONAL']);

    // Templates copied
    expect(existsSync(join(crmRoot, '.templates', 'simple', 'template.json'))).toBe(true);
    expect(existsSync(join(crmRoot, '.templates', 'PROFESSIONAL', 'INDEX.md'))).toBe(true);

    // Manifest written with entries
    expect(manifest.templates['simple']).toBeDefined();
    expect(manifest.templates['PROFESSIONAL']).toBeDefined();
    expect(manifest.templates['simple'].source).toBe('bundled');
    expect(manifest.templates['simple'].version).toBe('1.0.0');
    expect(manifest.templates['simple'].contentHash).toMatch(/^sha256:/);

    // Manifest persisted to disk
    const diskManifest = readManifest(crmRoot);
    expect(diskManifest).toEqual(manifest);
  });
});

describe('isCustomized', () => {
  it('returns false for unmodified templates', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(crmRoot, { recursive: true });

    const manifest = installBundledTemplates(crmRoot, ['simple']);
    expect(isCustomized(crmRoot, 'simple', manifest)).toBe(false);
  });

  it('returns true when template content is modified', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(crmRoot, { recursive: true });

    const manifest = installBundledTemplates(crmRoot, ['simple']);

    // Modify a file
    const indexPath = join(crmRoot, '.templates', 'simple', 'INDEX.md');
    writeFileSync(indexPath, 'MODIFIED CONTENT');

    expect(isCustomized(crmRoot, 'simple', manifest)).toBe(true);
  });
});

describe('migrateManifest', () => {
  it('generates manifest from existing .templates/ without one', () => {
    const crmRoot = join(tempDir, 'crm');
    const bundled = getBundledTemplatesDir();

    // Manually copy a template (simulating pre-manifest install)
    const dest = join(crmRoot, '.templates', 'simple');
    mkdirSync(dest, { recursive: true });
    cpSync(join(bundled, 'simple'), dest, { recursive: true });

    const manifest = migrateManifest(crmRoot);

    expect(manifest.templates['simple']).toBeDefined();
    expect(manifest.templates['simple'].source).toBe('unknown');
    expect(manifest.templates['simple'].version).toBe('1.0.0');
    expect(manifest.templates['simple'].contentHash).toMatch(/^sha256:/);
  });
});

describe('listLocalTemplates', () => {
  it('lists installed templates with customization status', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(crmRoot, { recursive: true });
    installBundledTemplates(crmRoot, ['simple', 'PROFESSIONAL']);

    const local = listLocalTemplates(crmRoot);
    expect(local.length).toBe(2);

    const names = local.map(t => t.name);
    expect(names).toContain('simple');
    expect(names).toContain('PROFESSIONAL');

    for (const t of local) {
      expect(t.customized).toBe(false);
      expect(t.version).toBe('1.0.0');
    }
  });
});

describe('installTemplate with category', () => {
  it('installs a composite template category with COMMON', () => {
    const crmRoot = join(tempDir, 'crm');
    mkdirSync(crmRoot, { recursive: true });
    const bundled = getBundledTemplatesDir();
    const reSource = join(bundled, 'REAL_ESTATE');

    // Only install if REAL_ESTATE exists in bundled
    if (!existsSync(reSource)) return;

    installTemplate({
      crmRoot,
      templateName: 'REAL_ESTATE',
      sourceDir: reSource,
      source: 'bundled',
      category: 'A_BROKERAGE_SALES',
    });

    const dest = join(crmRoot, '.templates', 'REAL_ESTATE');
    expect(existsSync(join(dest, 'template.json'))).toBe(true);
    expect(existsSync(join(dest, 'COMMON'))).toBe(true);
    expect(existsSync(join(dest, 'A_BROKERAGE_SALES'))).toBe(true);

    // Manifest should track the category
    const manifest = readManifest(crmRoot);
    expect(manifest!.templates['REAL_ESTATE'].categories).toEqual(['A_BROKERAGE_SALES']);
  });
});
