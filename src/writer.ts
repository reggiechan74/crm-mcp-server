import { readFileSync, mkdirSync, readdirSync, cpSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATEGORY_CODES, CATEGORY_DIRS, resolveSection, type Category, type SalesMotion } from './types.js';
import { lookupProfession } from './professions.js';
import type { Store } from './store.js';
import {
  formatOrgTypeChoices, ORG_ROLES, normalizeOrgType, normalizeOrgTypeList, orgTemplateLayers,
  generateCid, isValidCid, orgFolderName,
} from './orgTypes.js';
import { parseFrontmatter, splitFrontmatter, updateFrontmatter } from './frontmatter.js';
import { atomicWriteFileSync, isWithin, today } from './fsutil.js';

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
function requireContactPath(store: Store, contactId: string): string {
  const path = store.getContactPath(contactId);
  if (!path) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  return path;
}

/** Resolve a section to an absolute file path, refusing anything outside the dossier folder. */
function sectionFilePath(store: Store, contactPath: string, section: string): { key: string; filePath: string } {
  const { key, file } = resolveSection(section);
  const dossierDir = join(store.crmRoot, contactPath);
  const filePath = join(dossierDir, file);
  if (!isWithin(dossierDir, filePath)) {
    throw new Error(`Invalid section: "${section}"`);
  }
  return { key, filePath };
}

// ── Interaction log ─────────────────────────────────────────────────────

const TABLE_SEPARATOR_RE = /^\|[-|\s:]+\|$/;

/** Escape a value for a single markdown table cell. */
function tableCell(value: string | undefined): string {
  return (value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().toLowerCase());
}

/**
 * Locate the interaction table — the first table whose header starts with
 * Date and includes Type and Summary columns. Returns the header columns and
 * the index of its last row.
 */
function findInteractionTable(lines: string[]): { columns: string[]; lastRowIndex: number } | null {
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i].trim();
    if (!header.startsWith('|') || !TABLE_SEPARATOR_RE.test(lines[i + 1].trim())) continue;
    const columns = splitRow(header);
    if (columns[0] !== 'date' || !columns.includes('type') || !columns.includes('summary')) continue;
    let last = i + 1;
    while (last + 1 < lines.length && lines[last + 1].trim().startsWith('|')) last++;
    return { columns, lastRowIndex: last };
  }
  return null;
}

function buildLogRow(columns: string[], entry: LogEntry): string {
  const hasOutcome = columns.includes('outcome');
  const summary = !hasOutcome && entry.outcome
    ? `${entry.summary} — Outcome: ${entry.outcome}`
    : entry.summary;
  const cells = columns.map((col) => {
    if (col === 'date') return tableCell(entry.date);
    if (col === 'type') return tableCell(entry.type);
    if (col === 'summary') return tableCell(summary);
    if (col === 'outcome') return tableCell(entry.outcome);
    if (/^(next steps?|follow[- ]?ups?)$/.test(col)) return tableCell(entry.nextStep);
    return '';
  });
  return `| ${cells.join(' | ')} |`;
}

const DEFAULT_LOG_COLUMNS = ['date', 'type', 'summary', 'outcome', 'next step'];

/**
 * Append a new interaction row to the interaction table in a contact's log.md.
 * When the log has no interaction table (e.g. heading-based family logs), a
 * new one is appended at the end of the file.
 */
export function appendLog(store: Store, contactId: string, entry: LogEntry): void {
  const contactPath = requireContactPath(store, contactId);
  const logFile = join(store.crmRoot, contactPath, 'log.md');

  const content = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
  const { body } = splitFrontmatter(content);
  const bodyLines = body.split('\n');

  const table = findInteractionTable(bodyLines);
  if (table) {
    bodyLines.splice(table.lastRowIndex + 1, 0, buildLogRow(table.columns, entry));
  } else {
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
    bodyLines.push(
      '',
      '| Date | Type | Summary | Outcome | Next Step |',
      '|------|------|---------|---------|-----------|',
      buildLogRow(DEFAULT_LOG_COLUMNS, entry),
      '',
    );
  }

  const withBody = content.slice(0, content.length - body.length) + bodyLines.join('\n');
  atomicWriteFileSync(logFile, updateFrontmatter(withBody, { lastUpdated: today() }));

  store.reindexSection(contactId, 'log');
}

// ── Field updates ───────────────────────────────────────────────────────

/** INDEX.md fields that hold list values (comma-separated or JSON array string on input). */
const LIST_FIELDS = new Set(['roles', 'aliases', 'assetClasses', 'secondaryTypes']);

/** INDEX.md fields that only make sense on an Organization dossier. */
const ORG_ONLY_FIELDS = new Set(['orgType', 'secondaryTypes', 'salesMotion']);

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
 * Write a frontmatter field to disk without touching the index.
 * Returns the canonical section key and the dossier's relative path.
 */
function writeField(store: Store, contactId: string, section: string, field: string, value: string): { key: string; contactPath: string } {
  const contactPath = requireContactPath(store, contactId);
  const { key, filePath } = sectionFilePath(store, contactPath, section);
  const content = readFileSync(filePath, 'utf-8');

  if (key === 'index' && ORG_ONLY_FIELDS.has(field)) {
    const category = store.getOutline(contactId).contact.category;
    if (category !== 'Organization') {
      throw new Error(`${field} applies to Organization dossiers only`);
    }
  }

  const extra: Record<string, unknown> = {};
  let newValue: unknown = value;
  if (key === 'index' && field === 'orgType') {
    const code = normalizeOrgType(value);
    if (!code) throw new Error(`Invalid org type(s): ${value}. Valid:\n${formatOrgTypeChoices()}`);
    newValue = code;
    const current = parseFrontmatter(content)?.secondaryTypes;
    if (current !== undefined) extra.secondaryTypes = normalizeOrgTypeList(current, code);
  } else if (key === 'index' && field === 'secondaryTypes') {
    newValue = normalizeOrgTypeList(parseListValue(value), String(parseFrontmatter(content)?.orgType ?? ''));
  } else if (key === 'index' && field === 'salesMotion') {
    const normalized = value.trim().toLowerCase();
    if (normalized !== 'general' && normalized !== 'tech') {
      throw new Error(`Invalid salesMotion "${value}". Valid: general, tech`);
    }
    newValue = normalized;
  } else if (key === 'index' && LIST_FIELDS.has(field)) {
    const list = parseListValue(value);
    if (field === 'roles') {
      const badRoles = list.filter((r) => !(ORG_ROLES as readonly string[]).includes(r));
      if (badRoles.length > 0) {
        throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
      }
    }
    newValue = list;
  }

  atomicWriteFileSync(filePath, updateFrontmatter(content, { [field]: newValue, ...extra, lastUpdated: today() }));
  return { key, contactPath };
}

/**
 * Update a specific YAML frontmatter field in a dossier section file.
 */
export function updateField(store: Store, contactId: string, section: string, field: string, value: string): void {
  const { key, contactPath } = writeField(store, contactId, section, field, value);
  if (key === 'index') {
    // Full reindex of the dossier refreshes metadata_json, aliases, every
    // contacts column (including last_updated), and auto-derived edges
    // (e.g. works_at) that depend on this field.
    store.indexOne(contactPath);
  } else {
    store.reindexSection(contactId, key);
  }
}

export interface BulkUpdateResult {
  updated: string[];
  errors: Array<{ id: string; message: string }>;
}

/**
 * Update an INDEX.md field across every contact matching the filter, then
 * reindex them in one pass. At least one filter is required so a missing
 * argument can never rewrite the whole CRM.
 */
export function bulkUpdateField(
  store: Store,
  filters: { category?: string; status?: string },
  field: string,
  value: string,
): BulkUpdateResult {
  if (!filters.category && !filters.status) {
    throw new Error('bulk update requires at least one filter (category or status)');
  }
  const contacts = store.searchContacts({ ...filters, limit: 100_000 });
  const result: BulkUpdateResult = { updated: [], errors: [] };
  const paths: string[] = [];
  for (const c of contacts) {
    try {
      paths.push(writeField(store, c.id, 'index', field, value).contactPath);
      result.updated.push(c.id);
    } catch (e: any) {
      result.errors.push({ id: c.id, message: e.message });
    }
  }
  // Dossiers that fail to reindex are reported, not fatal: the others'
  // index rows still commit.
  if (paths.length > 0) {
    for (const f of store.indexMany(paths).failed) {
      result.errors.push({ id: f.path, message: `written but not reindexed: ${f.message}` });
    }
  }
  return result;
}

// ── Dossier Creation ────────────────────────────────────────────────────

export interface CreateDossierInput {
  name: string;          // "First Last"
  category: string;      // "Network" | "Client" | etc.
  organization?: string;
  context?: string;      // How you met
  template?: string;     // Template name (looks in .templates/ then bundled templates/)
  profession?: string;   // 3-letter profession code (e.g. "BSB") — uses profession-based dossier code
  orgType?: string;      // Organization only: a code from ORG_TYPES (see crm_org_types)
  cid?: string;          // Organization only: company identifier (ticker or abbreviation), 2-6 chars
  roles?: string[];      // Organization only: multi-valued roles (Client, Competitor, …)
  secondaryTypes?: string[]; // Organization only: additional org type codes (multi-line firms)
  salesMotion?: SalesMotion; // Organization only: 'tech' adds the tech-sale template layer (default 'general')
}

export interface CreateDossierResult {
  id: string;            // Generated dossier code
  path: string;          // Relative path to new dossier
  warnings: string[];    // Non-fatal issues (e.g. a template overlay that is not installed)
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
 * Strip characters that are unsafe in a folder name (path separators,
 * Windows-reserved characters, control characters) from one name part.
 */
function safeFolderPart(part: string): string {
  // eslint-disable-next-line no-control-regex
  return part.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim();
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
      const code = String(parseFrontmatter(readFileSync(indexPath, 'utf-8'))?.dossierCode ?? '');
      if (code.startsWith(prefix)) {
        const seq = parseInt(code.substring(prefix.length), 10);
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
  if (!Object.hasOwn(CATEGORY_DIRS, input.category)) {
    throw new Error(`Invalid category: "${input.category}". Valid: ${Object.keys(CATEGORY_DIRS).join(', ')}`);
  }
  const category = input.category as Category;
  const categoryDir = CATEGORY_DIRS[category];

  if (category === 'Organization') {
    return createOrgDossier(store, crmRoot, input);
  }

  if (input.orgType || input.cid || (input.roles && input.roles.length > 0)
    || (input.secondaryTypes && input.secondaryTypes.length > 0) || input.salesMotion) {
    throw new Error('orgType, cid, roles, secondaryTypes and salesMotion apply to Organization dossiers only');
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

  // 5. Create folder name: LASTNAME_Firstname (unsafe path characters removed)
  const nameParts = input.name.trim().split(/\s+/);
  const lastName = safeFolderPart(nameParts[nameParts.length - 1]);
  const firstName = safeFolderPart(nameParts.slice(0, -1).join(' '));
  if (!lastName || !firstName) {
    throw new Error(`Name "${input.name}" does not produce a valid folder name`);
  }
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

    if (isWithin(userTemplates, userTpl) && existsSync(userTpl)) {
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

  const categoryPath = join(crmRoot, categoryDir);
  const destPath = join(categoryPath, folderName);
  if (!isWithin(categoryPath, destPath) || destPath === categoryPath) {
    throw new Error(`Name "${input.name}" does not produce a valid folder name`);
  }

  if (existsSync(destPath)) {
    throw new Error(`Dossier folder already exists: ${destPath}`);
  }

  // Ensure category directory exists
  mkdirSync(categoryPath, { recursive: true });

  // Check if the template dir needs composition (has tracking file but no INDEX.md)
  const needsCompose = !existsSync(join(templatePath, 'INDEX.md'));
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

  // 8. Rewrite INDEX.md key fields so parseDossierIndex sees them
  const indexPath = join(destPath, 'INDEX.md');
  const indexContent = readFileSync(indexPath, 'utf-8');
  const { body: indexBody } = splitFrontmatter(indexContent);

  // Replace template name in body heading
  const updatedBody = indexBody
    .replace(/DOSSIER_TEMPLATE_\w+/g, () => input.name)
    .replace(/\[SUBJECT NAME\]/g, () => input.name)
    .replace(/\[ORGANIZATION\]/g, () => input.organization ?? '')
    .replace(/\[NAME\]/g, () => input.name);

  const withBody = indexContent.slice(0, indexContent.length - indexBody.length) + updatedBody;
  writeFileSync(indexPath, updateFrontmatter(withBody, {
    name: input.name,
    dossierCode,
    organization: input.organization ?? '',
    status: 'Active',
    lastContactDate: todayStr,
    lastUpdated: todayStr,
    ...(input.context ? { context: input.context } : {}),
    ...(input.profession ? { profession: input.profession } : {}),
    tier: undefined, // template-only field
  }), 'utf-8');

  // 9. Re-index the new dossier only (O(1) instead of O(N))
  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);

  return { id: dossierCode, path: relPath, warnings: [] };
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
    throw new Error(`Organization requires a valid orgType. Valid:\n${formatOrgTypeChoices()}`);
  }
  const roles = input.roles ?? [];
  const badRoles = roles.filter(r => !(ORG_ROLES as readonly string[]).includes(r));
  if (badRoles.length > 0) {
    throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
  }
  const secondaryTypes = normalizeOrgTypeList(input.secondaryTypes ?? [], orgType);
  const salesMotion: SalesMotion = input.salesMotion === 'tech' ? 'tech' : 'general';
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
  const warnings: string[] = [];
  for (const layer of orgTemplateLayers(orgTpl, { orgType, secondaryTypes, roles, salesMotion })) {
    if (existsSync(layer)) {
      cpSync(layer, destPath, { recursive: true });
    } else {
      warnings.push(
        `Template overlay ${relative(orgTpl, layer).split('\\').join('/')} is not installed — ` +
        'run: crm-mcp templates pull REAL_ESTATE/ORGANIZATION',
      );
    }
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
  writeFileSync(indexPath, updateFrontmatter(readFileSync(indexPath, 'utf-8'), {
    name: input.name,
    dossierCode,
    category: 'Organization',
    orgType,
    roles,
    secondaryTypes,
    salesMotion,
    status: 'Active',
    lastContactDate: todayStr,
    lastUpdated: todayStr,
    ...(input.context ? { context: input.context } : {}),
    tier: undefined, // template-only field
  }), 'utf-8');

  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);
  return { id: dossierCode, path: relPath, warnings };
}

/**
 * Recursively replace placeholders in all .md files under a directory.
 * Replacement values are inserted literally (function replacers, so `$&`
 * and friends in a name are not expanded) and YAML values are emitted as
 * double-quoted scalars so quotes in a name cannot break the frontmatter.
 */
function replacePlaceholdersRecursive(
  dirPath: string,
  replacements: { name: string; dossierCode: string; organization: string; category: string; date: string; context: string; profession: string; orgType?: string },
): void {
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

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      replacePlaceholdersRecursive(fullPath, replacements);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;

    const original = readFileSync(fullPath, 'utf-8');
    const { yaml, body } = splitFrontmatter(original);
    let head = original.slice(0, original.length - body.length);
    let content = body;

    // Known YAML placeholder fields — frontmatter only. Runs before the
    // mustache pass so these regexes never see escaped quotes in a value.
    if (yaml !== null) {
      head = head
        .replace(/contactName:\s*"[^"]*"/g, () => `contactName: ${JSON.stringify(replacements.name)}`)
        .replace(/dossierCode:\s*"[^"]*"/g, () => `dossierCode: ${JSON.stringify(replacements.dossierCode)}`)
        .replace(/lastUpdated:\s*\S+/g, () => `lastUpdated: ${replacements.date}`);
    }

    // Replace {{variable}} mustache-style placeholders. Inside frontmatter the
    // templates wrap them in double quotes, so insert JSON-escaped text there.
    for (const [key, value] of Object.entries(vars)) {
      const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      head = head.replace(re, () => JSON.stringify(value).slice(1, -1));
      content = content.replace(re, () => value);
    }
    content = head + content;

    // Replace template name references in body
    content = content.replace(/DOSSIER_TEMPLATE_\w+/g, () => replacements.name);

    writeFileSync(fullPath, content, 'utf-8');
  }
}
