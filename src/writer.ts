import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SECTION_FILES, CATEGORY_CODES, CATEGORY_DIRS, resolveSectionFile, type DossierSection, type Category } from './types.js';
import { lookupProfession } from './professions.js';
import { stripBoilerplate } from './parser.js';
import { createHash } from 'node:crypto';
import type { Store } from './store.js';
import {
  ORG_TYPES, ORG_ROLES, ROLE_OVERLAYS, normalizeOrgType, generateCid, isValidCid,
  orgFolderName, type OrgRole,
} from './orgTypes.js';

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

/** INDEX.md fields that hold list values (comma-separated or JSON array string on input). */
const LIST_FIELDS = new Set(['roles', 'aliases', 'assetClasses']);

/**
 * Parse a list-valued field's incoming string into a string array.
 * Accepts a JSON array string (`'["Client","Competitor"]'`) or a
 * comma-separated string (`'Client, Competitor'`); trims items and drops empties.
 */
function parseListValue(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // fall through to comma-split parsing below
    }
  }
  return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
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
  let newValue: unknown = value;
  if (section === 'index' && LIST_FIELDS.has(field)) {
    const list = parseListValue(value);
    if (field === 'roles') {
      const badRoles = list.filter((r) => !(ORG_ROLES as readonly string[]).includes(r));
      if (badRoles.length > 0) {
        throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
      }
    }
    newValue = list;
  }
  yaml[field] = newValue;
  yaml.lastUpdated = today();

  const updatedContent = reconstructFile(yaml, body);
  writeFileSync(filePath, updatedContent, 'utf-8');

  if (section === 'index') {
    // Full reindex of the dossier refreshes metadata_json, aliases, every
    // contacts column (including last_updated), and auto-derived edges
    // (e.g. works_at) that depend on this field.
    store.indexOne(contactPath);
  } else {
    // Invalidate cache and re-index just this section.
    invalidateAndReindex(store, contactId, section, filePath);
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
  orgType?: string;      // Organization only: REIT | INV | LP | OPR | DEV | LND | BRK | SAAS | DATA | SVC
  cid?: string;          // Organization only: company identifier (ticker or abbreviation), 2-6 chars
  roles?: string[];      // Organization only: multi-valued roles (Client, Competitor, …)
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
 * Resolve the templates directory — .templates/ in user's CRM root is the single source of truth.
 * Bundled templates are only used during init; at runtime we read from .templates/ exclusively.
 */
function getUserTemplatesDir(crmRoot: string): string {
  return join(crmRoot, '.templates');
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
 * Next sequence number for a dossier code prefix (e.g. "NE-JANSMI-" or "OPR-OXF-")
 * by scanning INDEX.md dossierCode values under a category directory.
 */
function nextSequence(catPath: string, prefix: string): number {
  let nextSeq = 1;
  if (!existsSync(catPath)) return nextSeq;
  for (const entry of readdirSync(catPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const indexPath = join(catPath, entry.name, 'INDEX.md');
    if (!existsSync(indexPath)) continue;
    try {
      const content = readFileSync(indexPath, 'utf-8');
      const match = content.match(/dossierCode:\s*"?([^"\n]+)"?/);
      if (match && match[1].startsWith(prefix)) {
        const seq = parseInt(match[1].substring(prefix.length), 10);
        if (!isNaN(seq) && seq >= nextSeq) nextSeq = seq + 1;
      }
    } catch {
      // skip unreadable
    }
  }
  return nextSeq;
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

  if (category === 'Organization') {
    return createOrgDossier(store, crmRoot, input);
  }

  if (input.orgType || input.cid || (input.roles && input.roles.length > 0)) {
    throw new Error('orgType, cid and roles apply to Organization dossiers only');
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
  const nextSeq = nextSequence(join(crmRoot, categoryDir), `${codePrefix}-${f3l3}-`);

  const dossierCode = `${codePrefix}-${f3l3}-${String(nextSeq).padStart(3, '0')}`;

  // 5. Create folder name: LASTNAME_Firstname
  const nameParts = input.name.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts.slice(0, -1).join(' ');
  const folderName = `${lastName.toUpperCase()}_${firstName}`;

  // 6. Determine template source — .templates/ is the single source of truth
  const userTemplates = getUserTemplatesDir(crmRoot);
  const templateName = input.template || templateTypeForCategory(input.category);
  let templatePath: string | undefined;

  // If profession specified, check for profession-specific template first
  if (professionEntry) {
    const userProfTpl = join(userTemplates, 'REAL_ESTATE', professionEntry.templateDir);
    if (existsSync(userProfTpl)) {
      templatePath = userProfTpl;
    }
  }

  // Fall back to named template or category default
  if (!templatePath) {
    const userTpl = join(userTemplates, templateName);
    const categoryTpl = join(userTemplates, templateTypeForCategory(input.category));

    if (existsSync(userTpl)) {
      templatePath = userTpl;
    } else if (existsSync(categoryTpl)) {
      templatePath = categoryTpl;
    } else {
      throw new Error(
        `Template "${templateName}" not installed locally. ` +
        `Run: crm-mcp templates pull ${templateName}`
      );
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
    const commonDir = join(userTemplates, 'REAL_ESTATE', 'COMMON');
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

  // 9. Re-index the new dossier only (O(1) instead of O(N))
  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);

  return { id: dossierCode, path: relPath };
}

/**
 * Create an organization dossier: `[orgType]-[CID]-[SEQ]` code, `Organizations/[orgType]_[Name]`
 * folder, composed from REAL_ESTATE/ORGANIZATION/COMMON plus one overlay per role.
 */
function createOrgDossier(store: Store, crmRoot: string, input: CreateDossierInput): CreateDossierResult {
  if (input.profession) {
    throw new Error('profession applies to person dossiers only; use orgType for organizations');
  }
  const orgType = input.orgType ? normalizeOrgType(input.orgType) : null;
  if (!orgType) {
    throw new Error(`Organization requires a valid orgType. Valid: ${Object.keys(ORG_TYPES).join(', ')}`);
  }
  const roles = input.roles ?? [];
  const badRoles = roles.filter(r => !(ORG_ROLES as readonly string[]).includes(r));
  if (badRoles.length > 0) {
    throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
  }
  const cid = (input.cid ?? generateCid(input.name)).toUpperCase();
  if (!isValidCid(cid)) {
    throw new Error(`Invalid CID "${cid}": use 2-6 chars of A-Z, 0-9, "." (pass cid explicitly)`);
  }

  const orgTpl = join(getUserTemplatesDir(crmRoot), 'REAL_ESTATE', 'ORGANIZATION');
  const commonDir = join(orgTpl, 'COMMON');
  if (!existsSync(commonDir)) {
    throw new Error('Organization template not installed locally. Run: crm-mcp templates pull REAL_ESTATE/ORGANIZATION');
  }

  const categoryDir = CATEGORY_DIRS.Organization;
  const prefix = `${orgType}-${cid}-`;
  const dossierCode = `${prefix}${String(nextSequence(join(crmRoot, categoryDir), prefix)).padStart(3, '0')}`;

  // orgFolderName strips non-ASCII characters; an all-non-ASCII name (e.g.
  // pure CJK) yields an empty stem (`INV_`), which would collide with a
  // second such org. Fall back to the CID as the stem in that case.
  let folderName = orgFolderName(orgType, input.name);
  if (folderName === `${orgType}_`) {
    folderName = `${orgType}_${cid}`;
  }
  const destPath = join(crmRoot, categoryDir, folderName);
  if (existsSync(destPath)) {
    throw new Error(`Dossier folder already exists: ${destPath}`);
  }

  mkdirSync(join(crmRoot, categoryDir), { recursive: true });
  cpSync(commonDir, destPath, { recursive: true });
  const overlays = new Set(roles.map(r => ROLE_OVERLAYS[r as OrgRole]).filter((d): d is string => !!d));
  for (const overlay of overlays) {
    const src = join(orgTpl, 'ROLES', overlay);
    if (existsSync(src)) cpSync(src, destPath, { recursive: true });
  }

  const todayStr = today();
  replacePlaceholdersRecursive(destPath, {
    name: input.name,
    dossierCode,
    organization: '',
    category: 'Organization',
    date: todayStr,
    context: input.context ?? '',
    profession: '',
    orgType,
  });

  const indexPath = join(destPath, 'INDEX.md');
  const { yaml: indexYaml, body: indexBody } = parseFrontmatterAndBody(readFileSync(indexPath, 'utf-8'));
  indexYaml.name = input.name;
  indexYaml.dossierCode = dossierCode;
  indexYaml.category = 'Organization';
  indexYaml.orgType = orgType;
  indexYaml.roles = roles;
  indexYaml.status = 'Active';
  indexYaml.lastContactDate = todayStr;
  indexYaml.lastUpdated = todayStr;
  if (input.context) indexYaml.context = input.context;
  delete indexYaml.tier;
  writeFileSync(indexPath, reconstructFile(indexYaml, indexBody), 'utf-8');

  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);
  return { id: dossierCode, path: relPath };
}

/**
 * Recursively replace placeholders in all .md files under a directory.
 */
function replacePlaceholdersRecursive(
  dirPath: string,
  replacements: { name: string; dossierCode: string; organization: string; category: string; date: string; context: string; profession: string; orgType?: string },
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
        orgType: replacements.orgType ?? '',
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
