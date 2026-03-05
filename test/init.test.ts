import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runInitNonInteractive } from '../src/init.js';

const tempDir = join(import.meta.dirname, '.tmp-init-test');

beforeEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('runInitNonInteractive', () => {
  it('creates CRM directory with .templates and sample contact', () => {
    const crmRoot = join(tempDir, 'contacts');
    const configPath = join(tempDir, 'config.json');

    runInitNonInteractive({
      crmRoot,
      templates: ['simple'],
      customTemplatePath: undefined,
      configPath,
    });

    // CRM root created
    expect(existsSync(crmRoot)).toBe(true);

    // .templates/simple/ copied
    expect(existsSync(join(crmRoot, '.templates', 'simple', 'INDEX.md'))).toBe(true);
    expect(existsSync(join(crmRoot, '.templates', 'simple', 'template.json'))).toBe(true);

    // Sample contact created (DOE_Jane in Network/)
    const networkDir = join(crmRoot, 'Network');
    expect(existsSync(networkDir)).toBe(true);
    const sampleDirs = readdirSync(networkDir);
    expect(sampleDirs.length).toBe(1);
    expect(sampleDirs[0]).toBe('DOE_Jane');

    // Config file written
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.crmRoot).toBe(crmRoot);
    expect(config.templates).toEqual(['simple']);
    expect(config.defaultTemplate).toBe('simple');
  });

  it('copies custom templates when path provided', () => {
    const crmRoot = join(tempDir, 'contacts');
    const customDir = join(tempDir, 'my-templates');
    mkdirSync(join(customDir, 'special'), { recursive: true });
    writeFileSync(join(customDir, 'special', 'template.json'), '{"name":"Special"}');
    writeFileSync(join(customDir, 'special', 'INDEX.md'), '# {{name}}');

    runInitNonInteractive({
      crmRoot,
      templates: ['simple'],
      customTemplatePath: customDir,
      configPath: join(tempDir, 'config.json'),
    });

    expect(existsSync(join(crmRoot, '.templates', 'special', 'INDEX.md'))).toBe(true);
  });

  it('copies multiple bundled templates', () => {
    const crmRoot = join(tempDir, 'contacts');

    runInitNonInteractive({
      crmRoot,
      templates: ['simple', 'PROFESSIONAL'],
      customTemplatePath: undefined,
      configPath: join(tempDir, 'config.json'),
    });

    expect(existsSync(join(crmRoot, '.templates', 'simple', 'template.json'))).toBe(true);
    expect(existsSync(join(crmRoot, '.templates', 'PROFESSIONAL', 'template.json'))).toBe(true);
    expect(existsSync(join(crmRoot, '.templates', 'PROFESSIONAL', 'INDEX.md'))).toBe(true);
  });
});
