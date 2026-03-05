import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import type { TemplateInfo } from './templates.js';

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
    const cache: RemoteCache = JSON.parse(readFileSync(cachePath, 'utf-8'));
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cache.templates;
  }

  // Fetch directory listing
  const url = `https://api.github.com/repos/${repo}/contents/templates`;
  const resp = await fetch(url, { headers: githubHeaders(token) });
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }
  const entries = await resp.json() as Array<{ name: string; type: string }>;
  const dirs = entries.filter(e => e.type === 'dir');

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
  const templatePrefix = `templates/${templateName}/`;

  // Build the set of path prefixes to extract
  const allowedPrefixes: string[] = [];
  if (category) {
    allowedPrefixes.push(`templates/${templateName}/template.json`);
    allowedPrefixes.push(`templates/${templateName}/COMMON/`);
    allowedPrefixes.push(`templates/${templateName}/${category}/`);
  } else {
    allowedPrefixes.push(templatePrefix);
  }

  mkdirSync(destDir, { recursive: true });

  // Write to temp file first, then extract
  const tmpFile = join(tmpdir(), `crm-mcp-tarball-${Date.now()}.tar.gz`);

  try {
    const arrayBuffer = await resp.arrayBuffer();
    writeFileSync(tmpFile, Buffer.from(arrayBuffer));

    // First, find the top-level directory name in the tarball
    const listOutput = execSync(`tar tzf "${tmpFile}" | head -1`, { encoding: 'utf-8' });
    const topDir = listOutput.trim().split('/')[0];

    // Build the list of paths to extract
    const extractPaths = allowedPrefixes.map(p => `${topDir}/${p}`);

    // Extract to a temp directory
    const tmpExtract = join(tmpdir(), `crm-mcp-extract-${Date.now()}`);
    mkdirSync(tmpExtract, { recursive: true });

    try {
      execSync(
        `tar xzf "${tmpFile}" -C "${tmpExtract}" ${extractPaths.map(p => `"${p}"`).join(' ')}`,
        { encoding: 'utf-8' },
      );
    } catch {
      // Some paths may not exist (e.g., COMMON/ in non-composite templates) — that's OK
      // Try extracting what we can
      for (const p of extractPaths) {
        try {
          execSync(`tar xzf "${tmpFile}" -C "${tmpExtract}" "${p}" 2>/dev/null`, { encoding: 'utf-8' });
        } catch { /* skip missing paths */ }
      }
    }

    // Move extracted files to destination
    const extractedTemplateDir = join(tmpExtract, topDir, 'templates', templateName);

    if (!existsSync(extractedTemplateDir)) {
      throw new Error(`Template "${templateName}" not found in repository`);
    }

    if (category) {
      // Copy specific pieces
      const tmplJson = join(extractedTemplateDir, 'template.json');
      if (existsSync(tmplJson)) {
        writeFileSync(join(destDir, 'template.json'), readFileSync(tmplJson));
      }
      const commonDir = join(extractedTemplateDir, 'COMMON');
      if (existsSync(commonDir)) {
        const destCommon = join(destDir, 'COMMON');
        mkdirSync(destCommon, { recursive: true });
        cpSync(commonDir, destCommon, { recursive: true });
      }
      const catDir = join(extractedTemplateDir, category);
      if (existsSync(catDir)) {
        const destCat = join(destDir, category);
        mkdirSync(destCat, { recursive: true });
        cpSync(catDir, destCat, { recursive: true });
      } else {
        throw new Error(`Category "${category}" not found in ${templateName}`);
      }
    } else {
      cpSync(extractedTemplateDir, destDir, { recursive: true });
    }

    // Clean up temp extract directory
    rmSync(tmpExtract, { recursive: true, force: true });
  } finally {
    // Clean up temp tarball
    rmSync(tmpFile, { force: true });
  }
}
