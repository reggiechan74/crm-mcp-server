import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────────

export interface ManifestEntry {
  version: string;
  installedAt: string;
  updatedAt: string;
  source: 'bundled' | 'github' | 'unknown';
  contentHash: string;
  categories?: string[];       // composite templates only (e.g. REAL_ESTATE)
}

export interface Manifest {
  schemaVersion: number;
  installedAt: string;
  templates: Record<string, ManifestEntry>;
}

export interface TemplateInfo {
  name: string;
  version: string;
  description: string;
  sections?: string[];
  professions?: Record<string, string>;
}

export interface LocalTemplateStatus {
  name: string;
  version: string;
  source: ManifestEntry['source'];
  customized: boolean;
  categories?: string[];
}

// ── Bundled templates directory ────────────────────────────────────────

export function getBundledTemplatesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = dirname(thisFile);
  const candidates = [
    resolve(thisDir, '..', 'templates'),
    resolve(thisDir, '..', '..', 'templates'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(`Bundled templates directory not found (searched: ${candidates.join(', ')})`);
}

// ── Content hashing ────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash of all files in a directory.
 * Files are sorted alphabetically by relative path, then concatenated as:
 *   relativePath + \0 + fileContent
 */
export function computeContentHash(dirPath: string): string {
  const files = collectFiles(dirPath);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f.relPath);
    hash.update('\0');
    hash.update(f.content);
  }
  return `sha256:${hash.digest('hex')}`;
}

function collectFiles(dirPath: string, basePath?: string): Array<{ relPath: string; content: string }> {
  const base = basePath ?? dirPath;
  const result: Array<{ relPath: string; content: string }> = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, base));
    } else {
      const relPath = relative(base, fullPath);
      const content = readFileSync(fullPath, 'utf-8');
      result.push({ relPath, content });
    }
  }
  return result;
}

// ── Manifest I/O ───────────────────────────────────────────────────────

function manifestPath(crmRoot: string): string {
  return join(crmRoot, '.templates', '.manifest.json');
}

export function readManifest(crmRoot: string): Manifest | null {
  const path = manifestPath(crmRoot);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function writeManifest(crmRoot: string, manifest: Manifest): void {
  const dir = join(crmRoot, '.templates');
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath(crmRoot), JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Auto-generate a manifest for an existing .templates/ directory that lacks one.
 * Reads template.json from each subdirectory and computes content hashes.
 */
export function migrateManifest(crmRoot: string): Manifest {
  const templatesDir = join(crmRoot, '.templates');
  const manifest: Manifest = {
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    templates: {},
  };

  if (!existsSync(templatesDir)) return manifest;

  const entries = readdirSync(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const tmplDir = join(templatesDir, entry.name);
    const tmplJson = join(tmplDir, 'template.json');
    let version = '0.0.0';
    if (existsSync(tmplJson)) {
      try {
        const meta = JSON.parse(readFileSync(tmplJson, 'utf-8'));
        version = meta.version || '0.0.0';
      } catch { /* ignore parse errors */ }
    }
    const contentHash = computeContentHash(tmplDir);
    const now = new Date().toISOString();
    manifest.templates[entry.name] = {
      version,
      installedAt: now,
      updatedAt: now,
      source: 'unknown',
      contentHash,
    };
  }

  writeManifest(crmRoot, manifest);
  return manifest;
}

/**
 * Ensure manifest exists. If missing, auto-migrate from existing .templates/ or create empty.
 */
export function ensureManifest(crmRoot: string): Manifest {
  const existing = readManifest(crmRoot);
  if (existing) return existing;
  return migrateManifest(crmRoot);
}

// ── Template status ────────────────────────────────────────────────────

/**
 * Check if a locally installed template has been customized (content differs from manifest hash).
 */
export function isCustomized(crmRoot: string, templateName: string, manifest: Manifest): boolean {
  const entry = manifest.templates[templateName];
  if (!entry) return false;
  const tmplDir = join(crmRoot, '.templates', templateName);
  if (!existsSync(tmplDir)) return false;
  const currentHash = computeContentHash(tmplDir);
  return currentHash !== entry.contentHash;
}

/**
 * List all locally installed templates with their status.
 */
export function listLocalTemplates(crmRoot: string): LocalTemplateStatus[] {
  const manifest = ensureManifest(crmRoot);
  const result: LocalTemplateStatus[] = [];

  for (const [name, entry] of Object.entries(manifest.templates)) {
    const tmplDir = join(crmRoot, '.templates', name);
    if (!existsSync(tmplDir)) continue;
    result.push({
      name,
      version: entry.version,
      source: entry.source,
      customized: isCustomized(crmRoot, name, manifest),
      categories: entry.categories,
    });
  }
  return result;
}

// ── Template read ──────────────────────────────────────────────────────

/**
 * Read template.json metadata from a template directory.
 */
export function readTemplateInfo(templateDir: string): TemplateInfo | null {
  const jsonPath = join(templateDir, 'template.json');
  if (!existsSync(jsonPath)) return null;
  return JSON.parse(readFileSync(jsonPath, 'utf-8'));
}

// ── Install template from source directory ─────────────────────────────

export interface InstallOptions {
  crmRoot: string;
  templateName: string;
  sourceDir: string;
  source: ManifestEntry['source'];
  category?: string;           // for composite sub-category installs
}

/**
 * Install a template from a source directory into .templates/.
 * For composite templates with a category, also copies COMMON/ and template.json.
 */
export function installTemplate(opts: InstallOptions): void {
  const { crmRoot, templateName, sourceDir, source, category } = opts;
  const destBase = join(crmRoot, '.templates', templateName);

  if (category) {
    // Composite template: copy COMMON + template.json + specific category
    const commonSrc = join(sourceDir, 'COMMON');
    const catSrc = join(sourceDir, category);
    const tmplJsonSrc = join(sourceDir, 'template.json');

    if (!existsSync(catSrc)) {
      throw new Error(`Category "${category}" not found in ${templateName}`);
    }

    mkdirSync(destBase, { recursive: true });

    // Copy template.json
    if (existsSync(tmplJsonSrc)) {
      const content = readFileSync(tmplJsonSrc, 'utf-8');
      writeFileSync(join(destBase, 'template.json'), content);
    }

    // Copy COMMON (if exists and not already present or hash changed)
    if (existsSync(commonSrc)) {
      const destCommon = join(destBase, 'COMMON');
      mkdirSync(destCommon, { recursive: true });
      cpSync(commonSrc, destCommon, { recursive: true });
    }

    // Copy the category
    const destCat = join(destBase, category);
    mkdirSync(destCat, { recursive: true });
    cpSync(catSrc, destCat, { recursive: true });
  } else {
    // Simple template: copy entire directory
    mkdirSync(destBase, { recursive: true });
    cpSync(sourceDir, destBase, { recursive: true });
  }

  // Update manifest
  const manifest = ensureManifest(crmRoot);
  const info = readTemplateInfo(destBase);
  const version = info?.version || '0.0.0';
  const contentHash = computeContentHash(destBase);
  const now = new Date().toISOString();

  const existingEntry = manifest.templates[templateName];
  const existingCategories = existingEntry?.categories || [];

  manifest.templates[templateName] = {
    version,
    installedAt: existingEntry?.installedAt || now,
    updatedAt: now,
    source,
    contentHash,
    ...(category ? { categories: [...new Set([...existingCategories, category])] } : {}),
  };

  writeManifest(crmRoot, manifest);
}

/**
 * Install selected bundled templates during init.
 * Returns the manifest with all installed templates recorded.
 */
export function installBundledTemplates(crmRoot: string, templateNames: string[]): Manifest {
  const bundledDir = getBundledTemplatesDir();

  for (const name of templateNames) {
    const src = join(bundledDir, name);
    if (!existsSync(src)) {
      throw new Error(`Bundled template "${name}" not found at ${src}`);
    }
    installTemplate({
      crmRoot,
      templateName: name,
      sourceDir: src,
      source: 'bundled',
    });
  }

  return ensureManifest(crmRoot);
}

// ── Template directory count ───────────────────────────────────────────

/**
 * Count files in a directory recursively.
 */
export function countFiles(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;
  let count = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(join(dirPath, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Get total size of a directory in bytes.
 */
export function dirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;
  let size = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += dirSize(fullPath);
    } else {
      size += statSync(fullPath).size;
    }
  }
  return size;
}
