import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { assertSafeTemplateName, type TemplateInfo } from './templates.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface RemoteTemplate {
  name: string;
  version: string;
  description: string;
  categories?: string[];    // for composite templates like REAL_ESTATE
}

interface RemoteCache {
  fetchedAt: string;
  templates: RemoteTemplate[];
}

// ── Configuration ──────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheFilePath(crmRoot: string): string {
  return join(crmRoot, '.templates', '.remote-cache.json');
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'crm-mcp-server',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── Remote listing ─────────────────────────────────────────────────────

/**
 * List available templates from the GitHub repo.
 * Uses a 1-hour cache to avoid excessive API calls.
 */
export async function listRemoteTemplates(
  repo: string,
  crmRoot: string,
  token?: string,
): Promise<RemoteTemplate[]> {
  // Check cache
  const cachePath = cacheFilePath(crmRoot);
  if (existsSync(cachePath)) {
    try {
      const cache: RemoteCache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      const age = Date.now() - new Date(cache.fetchedAt).getTime();
      if (age < CACHE_TTL_MS && Array.isArray(cache.templates)) return cache.templates;
    } catch {
      // Corrupt cache — refetch below
    }
  }

  // Fetch directory listing
  const url = `https://api.github.com/repos/${repo}/contents/templates`;
  const resp = await fetch(url, { headers: githubHeaders(token) });
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }
  const entries = await resp.json() as Array<{ name: string; type: string }>;
  // Only plain identifiers — names come from the network and are later used
  // in URLs, paths and archive member names.
  const dirs = entries.filter(e => e.type === 'dir' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(e.name));

  // Fetch template.json for each
  const templates: RemoteTemplate[] = [];
  for (const dir of dirs) {
    try {
      const tmplUrl = `https://api.github.com/repos/${repo}/contents/templates/${dir.name}/template.json`;
      const tmplResp = await fetch(tmplUrl, { headers: githubHeaders(token) });
      if (!tmplResp.ok) continue;
      const tmplData = await tmplResp.json() as { content: string };
      const decoded = Buffer.from(tmplData.content, 'base64').toString('utf-8');
      const info: TemplateInfo = JSON.parse(decoded);

      const remote: RemoteTemplate = {
        name: dir.name,
        version: info.version || '0.0.0',
        description: info.description || '',
      };

      // Detect composite templates by checking for professions or sub-categories
      if (info.professions) {
        // List sub-categories by fetching directory listing
        const catUrl = `https://api.github.com/repos/${repo}/contents/templates/${dir.name}`;
        const catResp = await fetch(catUrl, { headers: githubHeaders(token) });
        if (catResp.ok) {
          const catEntries = await catResp.json() as Array<{ name: string; type: string }>;
          remote.categories = catEntries
            .filter(e => e.type === 'dir' && e.name !== 'COMMON')
            .map(e => e.name);
        }
      }

      templates.push(remote);
    } catch {
      // Skip templates with no valid template.json
    }
  }

  // Write cache
  mkdirSync(join(crmRoot, '.templates'), { recursive: true });
  const cache: RemoteCache = { fetchedAt: new Date().toISOString(), templates };
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');

  return templates;
}

// ── Tarball download and extraction ────────────────────────────────────

/**
 * Download the repo tarball and extract a specific template directory.
 * For composite templates with a category, extracts COMMON + template.json + category.
 */
export async function downloadTemplate(
  repo: string,
  templateName: string,
  destDir: string,
  token?: string,
  category?: string,
): Promise<void> {
  // Validate before any network or filesystem work: these names become tar
  // member paths and destination directories.
  assertSafeTemplateName(templateName);
  if (category !== undefined) assertSafeTemplateName(category, 'category');

  const url = `https://api.github.com/repos/${repo}/tarball/main`;
  const resp = await fetch(url, {
    headers: githubHeaders(token),
    redirect: 'follow',
  });
  if (!resp.ok) {
    throw new Error(`GitHub tarball download failed: ${resp.status} ${resp.statusText}`);
  }

  // The tarball has a top-level directory like "owner-repo-sha/"
  // We need to extract templates/{templateName}/ from it
  const allowedPrefixes: string[] = category
    ? [
        `templates/${templateName}/template.json`,
        `templates/${templateName}/COMMON/`,
        `templates/${templateName}/${category}/`,
      ]
    : [`templates/${templateName}/`];

  const workDir = mkdtempSync(join(tmpdir(), 'crm-mcp-'));
  const tmpFile = join(workDir, 'repo.tar.gz');
  const tmpExtract = join(workDir, 'extract');

  try {
    writeFileSync(tmpFile, Buffer.from(await resp.arrayBuffer()));
    mkdirSync(tmpExtract);

    // Find the top-level directory name in the tarball. execFileSync passes
    // arguments directly to tar — no shell is involved anywhere below.
    const listing = execFileSync('tar', ['tzf', tmpFile], { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
    const topDir = listing.split('\n', 1)[0].trim().split('/')[0];
    if (!topDir || topDir === '..' || topDir.startsWith('/')) {
      throw new Error('Unexpected tarball layout');
    }

    // Extract each wanted prefix separately so a missing optional path
    // (e.g. COMMON/ in a non-composite template) does not abort the rest.
    for (const p of allowedPrefixes) {
      try {
        execFileSync('tar', ['xzf', tmpFile, '-C', tmpExtract, `${topDir}/${p}`], { stdio: 'ignore' });
      } catch { /* path not present in archive */ }
    }

    const extractedTemplateDir = join(tmpExtract, topDir, 'templates', templateName);
    if (!existsSync(extractedTemplateDir)) {
      throw new Error(`Template "${templateName}" not found in repository`);
    }

    mkdirSync(destDir, { recursive: true });
    if (category) {
      const catDir = join(extractedTemplateDir, category);
      if (!existsSync(catDir)) {
        throw new Error(`Category "${category}" not found in ${templateName}`);
      }
      const tmplJson = join(extractedTemplateDir, 'template.json');
      if (existsSync(tmplJson)) {
        writeFileSync(join(destDir, 'template.json'), readFileSync(tmplJson));
      }
      const commonDir = join(extractedTemplateDir, 'COMMON');
      if (existsSync(commonDir)) {
        cpSync(commonDir, join(destDir, 'COMMON'), { recursive: true });
      }
      cpSync(catDir, join(destDir, category), { recursive: true });
    } else {
      cpSync(extractedTemplateDir, destDir, { recursive: true });
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
