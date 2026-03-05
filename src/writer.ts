import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SECTION_FILES, CATEGORY_CODES, CATEGORY_DIRS, resolveSectionFile, type DossierSection, type Category } from './types.js';
import { lookupProfession } from './professions.js';
import { stripBoilerplate } from './parser.js';
import { createHash } from 'node:crypto';
import type { Store } from './store.js';

export interface LogEntry {
  date: string;       // "2026-03-04"
  type: string;       // "Meeting" | "Email" | "Call" | etc.
  summary: string;
  outcome?: string;
  nextStep?: string;
}

/**
 * Look up a contact's filesystem path from the store.
 */
function getContactPath(store: Store, contactId: string): string {
  const row = store.db.prepare('SELECT path FROM contacts WHERE id = ?').get(contactId) as any;
  if (!row) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  return row.path;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse YAML frontmatter and body from a markdown string.
 * Returns { yaml, body } where yaml is the parsed object and body is everything after the closing ---.
 */
function parseFrontmatterAndBody(content: string): { yaml: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { yaml: {}, body: content };
  }
  const yaml = parseYaml(match[1]) as Record<string, unknown>;
  return { yaml, body: match[2] };
}

/**
 * Reconstruct a markdown file from YAML frontmatter and body.
 * Ensures dates stay as YYYY-MM-DD strings, not full ISO timestamps.
 */
function reconstructFile(yaml: Record<string, unknown>, body: string): string {
  // Convert any Date objects to YYYY-MM-DD strings before stringifying
  const sanitized = { ...yaml };
  for (const [key, value] of Object.entries(sanitized)) {
    if (value instanceof Date) {
      sanitized[key] = value.toISOString().split('T')[0];
    }
  }
  const yamlStr = stringifyYaml(sanitized, { lineWidth: 0 }).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}

/**
 * Invalidate the cache and re-index a specific section for a contact.
 */
function invalidateAndReindex(store: Store, contactId: string, section: string, filePath: string): void {
  // Delete from content_cache
  store.db.prepare('DELETE FROM content_cache WHERE contact_id = ? AND section = ?').run(contactId, section);

  // Delete from content_fts
  store.db.prepare('DELETE FROM content_fts WHERE contact_id = ? AND section = ?').run(contactId, section);

  // Re-read, re-strip, re-insert
  const raw = readFileSync(filePath, 'utf-8');
  const hash = createHash('sha256').update(raw).digest('hex');
  const cleaned = stripBoilerplate(raw);
  const now = new Date().toISOString();

  store.db.prepare(
    'INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)',
  ).run(contactId, section, cleaned);

  store.db.prepare(
    'INSERT OR REPLACE INTO content_cache (contact_id, section, file_hash, cleaned_content, cleaned_at) VALUES (?, ?, ?, ?, ?)',
  ).run(contactId, section, hash, cleaned, now);
}

/**
 * Append a new interaction row to a contact's log.md.
 */
export function appendLog(store: Store, contactId: string, entry: LogEntry): void {
  const contactPath = getContactPath(store, contactId);
  const logFile = join(store.crmRoot, contactPath, 'log.md');

  const content = readFileSync(logFile, 'utf-8');
  const { yaml, body } = parseFrontmatterAndBody(content);

  // Build the new row
  const outcome = entry.outcome ?? '';
  const nextStep = entry.nextStep ?? '';
  const newRow = `| ${entry.date} | ${entry.type} | ${entry.summary} | ${outcome} | ${nextStep} |`;

  // Find the interaction table and append the row
  // The table ends at the last line that starts with |
  const bodyLines = body.split('\n');
  let lastTableRowIndex = -1;

  for (let i = bodyLines.length - 1; i >= 0; i--) {
    if (bodyLines[i].trimStart().startsWith('|')) {
      lastTableRowIndex = i;
      break;
    }
  }

  if (lastTableRowIndex >= 0) {
    bodyLines.splice(lastTableRowIndex + 1, 0, newRow);
  } else {
    // No table found — append at end
    bodyLines.push(newRow);
  }

  // Update lastUpdated
  yaml.lastUpdated = today();

  const updatedContent = reconstructFile(yaml, bodyLines.join('\n'));
  writeFileSync(logFile, updatedContent, 'utf-8');

  // Invalidate cache and re-index
  invalidateAndReindex(store, contactId, 'log', logFile);
}

/**
 * Update a specific YAML frontmatter field in a dossier section file.
 */
export function updateField(store: Store, contactId: string, section: string, field: string, value: string): void {
  const contactPath = getContactPath(store, contactId);
  const sectionFile = resolveSectionFile(section);

  const filePath = join(store.crmRoot, contactPath, sectionFile);
  const content = readFileSync(filePath, 'utf-8');
  const { yaml, body } = parseFrontmatterAndBody(content);

  // Update the specified field and lastUpdated
  yaml[field] = value;
  yaml.lastUpdated = today();

  const updatedContent = reconstructFile(yaml, body);
  writeFileSync(filePath, updatedContent, 'utf-8');

  // Invalidate cache and re-index
  invalidateAndReindex(store, contactId, section, filePath);

  // If updating INDEX.md fields, also update the contacts table
  if (section === 'index') {
    const columnMap: Record<string, string> = {
      status: 'status',
      lastContactDate: 'last_contact',
      organization: 'organization',
      name: 'name',
    };
    const column = columnMap[field];
    if (column) {
      store.db.prepare(`UPDATE contacts SET ${column} = ? WHERE id = ?`).run(value, contactId);
    }
    // Always update last_updated in contacts table for index changes
    store.db.prepare('UPDATE contacts SET last_updated = ? WHERE id = ?').run(today(), contactId);
  }
}

// ── Dossier Creation ────────────────────────────────────────────────────

export interface CreateDossierInput {
  name: string;          // "First Last"
  category: string;      // "Network" | "Client" | etc.
  organization?: string;
  context?: string;      // How you met
  template?: string;     // Template name (looks in .templates/ then bundled templates/)
  profession?: string;   // 3-letter profession code (e.g. "BSB") — uses profession-based dossier code
}

export interface CreateDossierResult {
  id: string;            // Generated dossier code
  path: string;          // Relative path to new dossier
}

// Reverse lookup: Category → 2-letter code
const CATEGORY_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CODES).map(([code, cat]) => [cat, code]),
);

/**
 * Resolve the templates directory — works both in source (src/) and compiled (dist/) layouts.
 */
function getTemplatesDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = dirname(thisFile);
  // Try sibling of src/ first (project root/templates), then relative to dist/
  const candidates = [
    resolve(thisDir, '..', 'templates'),
    resolve(thisDir, '..', '..', 'templates'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(`Templates directory not found (searched: ${candidates.join(', ')})`);
}

/**
 * Generate F3L3 code from a full name.
 * Rules:
 *   - Simple (First Last): first 3 chars of each, uppercase
 *   - Hyphenated surname: first 3 of first name + first 3 of first part of surname
 *   - Short name (< 3 chars): use available chars
 * Always uppercase, accents removed.
 */
export function generateF3L3(fullName: string): string {
  // Remove accents
  const normalized = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = normalized.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Name must have at least first and last parts: "${fullName}"`);
  }

  const firstName = parts.slice(0, -1).join(' ');
  const lastName = parts[parts.length - 1];

  // For hyphenated surnames, take first part
  const lastNameBase = lastName.split('-')[0];

  const f3 = firstName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const l3 = lastNameBase.substring(0, 3).toUpperCase();

  return f3 + l3;
}

/**
 * Determine the template type for a category.
 */
function templateTypeForCategory(category: string): string {
  if (category === 'Family') return 'FAMILY';
  if (category === 'Personal') return 'PERSONAL';
  return 'PROFESSIONAL';
}

/**
 * Create a new contact dossier from template.
 */
export function createDossier(store: Store, crmRoot: string, input: CreateDossierInput): CreateDossierResult {
  // 1. Validate category
  const category = input.category as Category;
  const categoryDir = CATEGORY_DIRS[category];
  if (!categoryDir) {
    throw new Error(`Invalid category: "${input.category}". Valid: ${Object.keys(CATEGORY_DIRS).join(', ')}`);
  }

  // 2. Determine code prefix — profession code (3-letter) or category code (2-letter)
  let codePrefix: string;
  let professionEntry: ReturnType<typeof lookupProfession> | undefined;

  if (input.profession) {
    professionEntry = lookupProfession(input.profession);
    if (!professionEntry) {
      throw new Error(`Unknown profession code: "${input.profession}". Use searchProfessions() to find valid codes.`);
    }
    codePrefix = professionEntry.code;
  } else {
    const catCode = CATEGORY_TO_CODE[category];
    if (!catCode) {
      throw new Error(`No code mapping for category: ${category}`);
    }
    codePrefix = catCode;
  }

  // 3. Generate F3L3
  const f3l3 = generateF3L3(input.name);

  // 4. Determine next sequence number by scanning existing dossiers
  const catPath = join(crmRoot, categoryDir);
  let nextSeq = 1;
  if (existsSync(catPath)) {
    const prefix = `${codePrefix}-${f3l3}-`;
    const entries = readdirSync(catPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Check INDEX.md for dossierCode matching our prefix
      const indexPath = join(catPath, entry.name, 'INDEX.md');
      if (!existsSync(indexPath)) continue;
      try {
        const content = readFileSync(indexPath, 'utf-8');
        const match = content.match(/dossierCode:\s*"?([^"\n]+)"?/);
        if (match && match[1].startsWith(prefix)) {
          const seqStr = match[1].substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq >= nextSeq) {
            nextSeq = seq + 1;
          }
        }
      } catch {
        // skip unreadable
      }
    }
  }

  const dossierCode = `${codePrefix}-${f3l3}-${String(nextSeq).padStart(3, '0')}`;

  // 5. Create folder name: LASTNAME_Firstname
  const nameParts = input.name.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts.slice(0, -1).join(' ');
  const folderName = `${lastName.toUpperCase()}_${firstName}`;

  // 6. Determine template source
  // Priority: profession templateDir (.templates/) > explicit template > category default
  const templateName = input.template || templateTypeForCategory(input.category);
  let templatePath: string | undefined;

  // If profession specified, check for profession-specific template first
  if (professionEntry) {
    const userProfTpl = join(crmRoot, '.templates', professionEntry.templateDir);
    const bundledProfTpl = join(getTemplatesDir(), 'REAL_ESTATE', professionEntry.templateDir);
    if (existsSync(userProfTpl)) {
      templatePath = userProfTpl;
    } else if (existsSync(bundledProfTpl)) {
      templatePath = bundledProfTpl;
    }
  }

  // Fall back to named template or category default
  if (!templatePath) {
    const userTemplatesDir = join(crmRoot, '.templates', templateName);
    const bundledTemplatesDir = join(getTemplatesDir(), templateName);
    const categoryFallbackDir = join(getTemplatesDir(), templateTypeForCategory(input.category));

    if (existsSync(userTemplatesDir)) {
      templatePath = userTemplatesDir;
    } else if (existsSync(bundledTemplatesDir)) {
      templatePath = bundledTemplatesDir;
    } else {
      templatePath = categoryFallbackDir;
    }
  }

  const destPath = join(crmRoot, categoryDir, folderName);

  if (existsSync(destPath)) {
    throw new Error(`Dossier folder already exists: ${destPath}`);
  }

  // Ensure category directory exists
  mkdirSync(join(crmRoot, categoryDir), { recursive: true });

  // Check if the template dir needs composition (has tracking file but no INDEX.md)
  const needsCompose = templatePath && !existsSync(join(templatePath, 'INDEX.md'));
  if (needsCompose && professionEntry) {
    // Compose: copy COMMON base files first, then overlay profession-specific files
    const commonDir = join(getTemplatesDir(), 'REAL_ESTATE', 'COMMON');
    if (existsSync(commonDir)) {
      cpSync(commonDir, destPath, { recursive: true });
    }
    // Overlay profession-specific files (tracking file, any overrides)
    cpSync(templatePath, destPath, { recursive: true });
  } else {
    cpSync(templatePath, destPath, { recursive: true });
  }

  // 7. Replace placeholders in all .md files
  const todayStr = today();
  replacePlaceholdersRecursive(destPath, {
    name: input.name,
    dossierCode,
    organization: input.organization ?? '',
    category: input.category,
    date: todayStr,
    context: input.context ?? '',
    profession: input.profession ?? '',
  });

  // 8. Rewrite INDEX.md with proper YAML frontmatter for parseIndexYaml compatibility
  const indexPath = join(destPath, 'INDEX.md');
  const indexContent = readFileSync(indexPath, 'utf-8');
  const { yaml: indexYaml, body: indexBody } = parseFrontmatterAndBody(indexContent);

  // Overwrite key fields to ensure parseIndexYaml works
  indexYaml.name = input.name;
  indexYaml.dossierCode = dossierCode;
  indexYaml.organization = input.organization ?? '';
  indexYaml.status = 'Active';
  indexYaml.lastContactDate = todayStr;
  indexYaml.lastUpdated = todayStr;
  if (input.context) {
    indexYaml.context = input.context;
  }
  if (input.profession) {
    indexYaml.profession = input.profession;
  }
  // Remove template-only fields
  delete indexYaml.tier;

  // Replace template name in body heading
  const updatedBody = indexBody
    .replace(/DOSSIER_TEMPLATE_\w+/g, input.name)
    .replace(/\[SUBJECT NAME\]/g, input.name)
    .replace(/\[ORGANIZATION\]/g, input.organization ?? '')
    .replace(/\[NAME\]/g, input.name);

  const updatedIndex = reconstructFile(indexYaml, updatedBody);
  writeFileSync(indexPath, updatedIndex, 'utf-8');

  // 9. Re-index the new dossier
  const relPath = `${categoryDir}/${folderName}`;
  store.indexAll();

  return { id: dossierCode, path: relPath };
}

/**
 * Recursively replace placeholders in all .md files under a directory.
 */
function replacePlaceholdersRecursive(
  dirPath: string,
  replacements: { name: string; dossierCode: string; organization: string; category: string; date: string; context: string; profession: string },
): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      replacePlaceholdersRecursive(fullPath, replacements);
    } else if (entry.name.endsWith('.md')) {
      let content = readFileSync(fullPath, 'utf-8');

      // Replace {{variable}} mustache-style placeholders first
      const vars: Record<string, string> = {
        name: replacements.name,
        dossierCode: replacements.dossierCode,
        organization: replacements.organization,
        category: replacements.category ?? '',
        context: replacements.context,
        date: replacements.date,
        profession: replacements.profession,
      };
      for (const [key, value] of Object.entries(vars)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }

      // Replace known placeholder patterns in YAML frontmatter
      content = content.replace(/contactName:\s*"[^"]*"/g, `contactName: "${replacements.name}"`);
      content = content.replace(/dossierCode:\s*"[^"]*"/g, `dossierCode: "${replacements.dossierCode}"`);

      // Replace date placeholders in YAML
      content = content.replace(/lastUpdated:\s*\S+/g, `lastUpdated: ${replacements.date}`);

      // Replace template name references in body
      content = content.replace(/DOSSIER_TEMPLATE_\w+/g, replacements.name);

      writeFileSync(fullPath, content, 'utf-8');
    }
  }
}
