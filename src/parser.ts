import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import type { Contact, SectionMeta, Relationship, Category, RelationType } from './types.js';
import { SECTION_FILES, CATEGORY_DIRS, RELATION_TYPES } from './types.js';
import { parseFrontmatter } from './frontmatter.js';
import { collectMdFiles, formatDate } from './fsutil.js';

export { collectMdFiles };

// Reverse lookup: directory name → Category
const DIR_TO_CATEGORY: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORY_DIRS).map(([cat, dir]) => [dir, cat as Category]),
) as Record<string, Category>;

/**
 * Read INDEX.md once and extract both the contact row and its linkedContacts
 * relationship edges.
 */
export function parseDossierIndex(dossierPath: string): { contact: Contact; relationships: Relationship[] } {
  const indexPath = join(dossierPath, 'INDEX.md');
  const yaml = parseFrontmatter(readFileSync(indexPath, 'utf-8'));
  if (!yaml) {
    throw new Error(`No YAML frontmatter found in ${indexPath}`);
  }

  // Detect category from parent directory name
  const parentDir = basename(dirname(dossierPath));
  const category = DIR_TO_CATEGORY[parentDir] ?? ('Network' as Category);

  if (category === 'Organization') normalizeOrgMetadata(yaml);

  const aliasesRaw = yaml.aliases;
  const aliases = Array.isArray(aliasesRaw)
    ? JSON.stringify(aliasesRaw.map(String))
    : undefined;

  const contact: Contact = {
    id: String(yaml.dossierCode ?? ''),
    name: String(yaml.name ?? ''),
    category,
    organization: yaml.organization ? String(yaml.organization) : null,
    status: String(yaml.status ?? 'Unknown'),
    lastContact: formatDate(yaml.lastContactDate),
    lastUpdated: formatDate(yaml.lastUpdated) ?? '',
    path: basename(dirname(dossierPath)) + '/' + basename(dossierPath),
    metadataJson: JSON.stringify(yaml),
    profession: yaml.profession ? String(yaml.profession) : undefined,
    aliases,
  };

  return { contact, relationships: relationshipsFromYaml(yaml, contact.id) };
}

/**
 * Read INDEX.md from a dossier directory and extract contact metadata.
 */
export function parseIndexYaml(dossierPath: string): Contact {
  return parseDossierIndex(dossierPath).contact;
}

// Patterns that indicate placeholder/boilerplate content
const PLACEHOLDER_RE = /\[TO BE (?:POPULATED|ADDED|ASSESSED|DOCUMENTED)\]/i;
const NONE_DOCUMENTED_RE = /^\*(?:None documented|Not yet assessed|No \w+ (?:observed|identified))\*$/;
const TEMPLATE_BLOCKQUOTE_RE = /^>\s*\*\*(?:ANALYSIS FRAMEWORK|STRUCTURAL ANALYSIS)/;
const COMMON_TACTICS_RE = /^\*\*Common Tactics Reference:\*\*$/;
const TABLE_SEPARATOR_RE = /^\|[-|\s:]+\|$/;
const TABLE_HEADER_RE = /^\|.*\|$/;

/**
 * Check if a line is a table row where ALL cells are placeholders.
 */
function isPlaceholderTableRow(line: string): boolean {
  if (!line.startsWith('|') || !line.endsWith('|')) return false;
  if (TABLE_SEPARATOR_RE.test(line)) return false;
  const cells = line.split('|').slice(1, -1);
  if (cells.length === 0) return false;
  return cells.every(cell => PLACEHOLDER_RE.test(cell.trim()));
}

/**
 * Check if a line should be removed as boilerplate.
 */
function isBoilerplateLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return false; // blank lines are not boilerplate themselves
  if (PLACEHOLDER_RE.test(trimmed)) return true;
  if (NONE_DOCUMENTED_RE.test(trimmed)) return true;
  if (TEMPLATE_BLOCKQUOTE_RE.test(trimmed)) return true;
  if (COMMON_TACTICS_RE.test(trimmed)) return true;
  if (isPlaceholderTableRow(trimmed)) return true;
  return false;
}

/**
 * Check if a line is a section header (### or ####).
 */
function isSectionHeader(line: string): boolean {
  return /^#{3,4}\s/.test(line.trim());
}

/**
 * Strip boilerplate/placeholder content from dossier markdown.
 * Removes placeholder lines, empty table rows, template blockquotes,
 * and entire sections where all content is placeholder.
 */
export function stripBoilerplate(content: string): string {
  const lines = content.split('\n');

  // First pass: identify and group sections
  interface Section {
    headerIndex: number;
    headerLine: string;
    bodyLines: { index: number; line: string }[];
  }

  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionHeader(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { headerIndex: i, headerLine: line, bodyLines: [] };
    } else if (currentSection) {
      currentSection.bodyLines.push({ index: i, line });
    }
  }
  if (currentSection) sections.push(currentSection);

  // Determine which lines to remove
  const linesToRemove = new Set<number>();

  for (const section of sections) {
    // Check if ALL non-blank content lines in this section are boilerplate
    const contentLines = section.bodyLines.filter(bl => bl.line.trim() !== '');
    // Filter out table separators and table headers that accompany placeholder rows
    const substantiveLines = contentLines.filter(bl => !TABLE_SEPARATOR_RE.test(bl.line.trim()));

    if (substantiveLines.length === 0) {
      // Empty section — don't remove header (nothing to strip)
      continue;
    }

    const allBoilerplate = substantiveLines.every(bl => {
      const trimmed = bl.line.trim();
      if (isBoilerplateLine(trimmed)) return true;
      // Table header rows that are followed only by placeholder data rows
      if (TABLE_HEADER_RE.test(trimmed) && !PLACEHOLDER_RE.test(trimmed)) {
        // Check if this is a header for a table where all data rows are placeholder
        return true; // We'll verify at section level
      }
      return false;
    });

    if (allBoilerplate) {
      // Check more carefully: are there any real table data rows?
      const hasRealTableData = substantiveLines.some(bl => {
        const trimmed = bl.line.trim();
        if (!TABLE_HEADER_RE.test(trimmed)) return false;
        if (isBoilerplateLine(trimmed)) return false;
        if (PLACEHOLDER_RE.test(trimmed)) return false;
        // It's a table row without placeholders — but is it a header row?
        // Header rows precede separator rows
        const nextIdx = section.bodyLines.findIndex(b => b.index > bl.index && b.line.trim() !== '');
        if (nextIdx >= 0 && TABLE_SEPARATOR_RE.test(section.bodyLines[nextIdx].line.trim())) {
          return false; // This is a table header, not data
        }
        return true; // Real data row
      });

      if (!hasRealTableData) {
        // Remove entire section including header
        linesToRemove.add(section.headerIndex);
        for (const bl of section.bodyLines) {
          linesToRemove.add(bl.index);
        }
      }
    } else {
      // Section has real content — only remove individual boilerplate lines
      for (const bl of section.bodyLines) {
        const trimmed = bl.line.trim();
        if (isBoilerplateLine(trimmed)) {
          linesToRemove.add(bl.index);
          // Also remove associated table structure
        }
      }
      // Remove orphaned table headers/separators
      removeOrphanedTableParts(section.bodyLines, linesToRemove);
    }
  }

  // Handle lines before any section header
  for (let i = 0; i < lines.length; i++) {
    if (sections.length > 0 && i >= sections[0].headerIndex) break;
    if (isBoilerplateLine(lines[i])) {
      linesToRemove.add(i);
    }
  }

  // Build result
  const resultLines = lines.filter((_, i) => !linesToRemove.has(i));

  // Collapse multiple consecutive blank lines to at most two
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of resultLines) {
    if (line.trim() === '') {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  return collapsed.join('\n');
}

/**
 * Remove table headers and separators that no longer have any data rows.
 */
function removeOrphanedTableParts(
  bodyLines: { index: number; line: string }[],
  linesToRemove: Set<number>,
): void {
  // Find table groups: header, separator, data rows
  for (let i = 0; i < bodyLines.length; i++) {
    const bl = bodyLines[i];
    if (TABLE_HEADER_RE.test(bl.line.trim()) && !TABLE_SEPARATOR_RE.test(bl.line.trim())) {
      // Potential table header — look for separator next
      const nextNonBlank = bodyLines.slice(i + 1).find(b => b.line.trim() !== '');
      if (nextNonBlank && TABLE_SEPARATOR_RE.test(nextNonBlank.line.trim())) {
        // Found a table. Check if all data rows after separator are removed
        const sepIdx = bodyLines.indexOf(nextNonBlank);

        // Stop at next non-table line
        const tableDataRows: { index: number; line: string }[] = [];
        for (let j = sepIdx + 1; j < bodyLines.length; j++) {
          const t = bodyLines[j].line.trim();
          if (t === '') continue;
          if (TABLE_HEADER_RE.test(t) && !TABLE_SEPARATOR_RE.test(t)) {
            tableDataRows.push(bodyLines[j]);
          } else {
            break;
          }
        }

        const allDataRemoved = tableDataRows.length > 0 &&
          tableDataRows.every(dr => linesToRemove.has(dr.index));

        if (allDataRemoved) {
          linesToRemove.add(bl.index);
          linesToRemove.add(nextNonBlank.index);
        }
      }
    }
  }
}

/**
 * Build section metadata for a single file.
 */
function buildSectionMeta(fullPath: string, file: string): SectionMeta {
  const stat = statSync(fullPath);
  const content = readFileSync(fullPath, 'utf-8');
  const stripped = stripBoilerplate(content);

  const lastUpdated = formatDate(parseFrontmatter(content)?.lastUpdated);

  const sizeBytes = stat.size;
  const filledBytes = Buffer.byteLength(stripped, 'utf-8');
  const fillPercent = sizeBytes > 0 ? Math.round((filledBytes / sizeBytes) * 100) : 0;

  return { file, sizeBytes, filledBytes, fillPercent, lastUpdated };
}

/**
 * Scan a dossier directory and return metadata for each existing section file.
 * Discovers all .md files recursively — both standard sections and custom files.
 */
export function scanDossierSections(dossierPath: string): SectionMeta[] {
  const results: SectionMeta[] = [];

  // Known section files from the standard dossier structure
  const knownFiles = new Set(Object.values(SECTION_FILES));

  // First: index known section files in their canonical order
  for (const [, file] of Object.entries(SECTION_FILES)) {
    const fullPath = join(dossierPath, file);
    if (!existsSync(fullPath)) continue;
    results.push(buildSectionMeta(fullPath, file));
  }

  // Then: recursively discover all other .md files
  if (existsSync(dossierPath)) {
    for (const relPath of collectMdFiles(dossierPath)) {
      if (knownFiles.has(relPath)) continue;
      results.push(buildSectionMeta(join(dossierPath, relPath), relPath));
    }
  }

  return results;
}

/**
 * Extract relationship entries from INDEX.md linkedContacts YAML field.
 */
export function extractRelationships(dossierPath: string, contactId: string): Relationship[] {
  const yaml = parseFrontmatter(readFileSync(join(dossierPath, 'INDEX.md'), 'utf-8'));
  return yaml ? relationshipsFromYaml(yaml, contactId) : [];
}

/**
 * Canonical shape for indexed org metadata so SQL filters stay simple:
 * orgType upper-case, secondaryTypes/roles as arrays (hand edits may use a
 * comma-separated string). Unknown codes are kept, upper-cased.
 */
function normalizeOrgMetadata(yaml: Record<string, unknown>): void {
  const list = (v: unknown): string[] =>
    (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [])
      .map((s) => s.trim()).filter(Boolean);
  if (yaml.orgType != null) yaml.orgType = String(yaml.orgType).trim().toUpperCase();
  yaml.secondaryTypes = [...new Set(list(yaml.secondaryTypes).map((s) => s.toUpperCase()))]
    .filter((s) => s !== yaml.orgType);
  yaml.roles = list(yaml.roles);
}

function relationshipsFromYaml(yaml: Record<string, unknown>, contactId: string): Relationship[] {
  const linkedContacts = yaml.linkedContacts;
  if (!Array.isArray(linkedContacts)) return [];

  const rels: Relationship[] = linkedContacts.map((entry: unknown): Relationship => {
    // Object form: { name, type, context }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      const rawType = String(obj.type ?? '');
      const type = (RELATION_TYPES as readonly string[]).includes(rawType)
        ? (rawType as RelationType)
        : 'associated';
      return {
        sourceId: contactId,
        targetId: '',
        targetName: String(obj.name ?? '').trim(),
        type,
        context: obj.context != null ? String(obj.context) : '',
        bidirectional: false,
      };
    }

    // Legacy string form: "Name (Context)"
    const str = String(entry);
    const match = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    return {
      sourceId: contactId,
      targetId: '',
      targetName: match ? match[1].trim() : str.trim(),
      type: 'associated',
      context: match ? match[2].trim() : '',
      bidirectional: false,
    };
  });

  return rels.filter(r => r.targetName !== '');
}
