import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { SECTION_FILES, CATEGORY_DIRS } from './types.js';
// Reverse lookup: directory name → Category
const DIR_TO_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_DIRS).map(([cat, dir]) => [dir, cat]));
/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the parsed object or null if no frontmatter found.
 * Uses lenient parsing to handle malformed YAML (e.g., unquoted parentheses in alias arrays).
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match)
        return null;
    try {
        return parseYaml(match[1]);
    }
    catch {
        // Fallback: quote unquoted parenthetical content in array items and retry
        const fixed = match[1].replace(/^(\s*-\s*"[^"]*")\s*(\([^)]*\))/gm, '$1 # $2');
        try {
            return parseYaml(fixed);
        }
        catch {
            // Last resort: extract key fields with regex
            const result = {};
            for (const [key, pattern] of [
                ['name', /^name:\s*"?([^"\n]+)"?/m],
                ['dossierCode', /^dossierCode:\s*"?([^"\n]+)"?/m],
                ['organization', /^organization:\s*"?([^"\n]+)"?/m],
                ['status', /^status:\s*(\S+)/m],
                ['lastContactDate', /^lastContactDate:\s*(\S+)/m],
                ['lastUpdated', /^lastUpdated:\s*(\S+)/m],
                ['profession', /^profession:\s*"?([^"\n]+)"?/m],
            ]) {
                const m = match[1].match(pattern);
                if (m)
                    result[key] = m[1].trim();
            }
            return Object.keys(result).length > 0 ? result : null;
        }
    }
}
/**
 * Read INDEX.md from a dossier directory and extract contact metadata.
 */
export function parseIndexYaml(dossierPath) {
    const indexPath = join(dossierPath, 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    const yaml = parseFrontmatter(content);
    if (!yaml) {
        throw new Error(`No YAML frontmatter found in ${indexPath}`);
    }
    // Detect category from parent directory name
    const parentDir = basename(dirname(dossierPath));
    const category = DIR_TO_CATEGORY[parentDir] ?? 'Network';
    // Normalize date values — YAML parser may return Date objects
    const lastContactRaw = yaml.lastContactDate;
    const lastUpdatedRaw = yaml.lastUpdated;
    const formatDate = (val) => {
        if (val == null)
            return null;
        if (val instanceof Date)
            return val.toISOString().slice(0, 10);
        return String(val);
    };
    const aliasesRaw = yaml.aliases;
    const aliases = Array.isArray(aliasesRaw)
        ? JSON.stringify(aliasesRaw.map(String))
        : undefined;
    return {
        id: String(yaml.dossierCode ?? ''),
        name: String(yaml.name ?? ''),
        category,
        organization: yaml.organization ? String(yaml.organization) : null,
        status: String(yaml.status ?? 'Unknown'),
        lastContact: formatDate(lastContactRaw),
        lastUpdated: formatDate(lastUpdatedRaw) ?? '',
        path: basename(dirname(dossierPath)) + '/' + basename(dossierPath),
        metadataJson: JSON.stringify(yaml),
        profession: yaml.profession ? String(yaml.profession) : undefined,
        aliases,
    };
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
function isPlaceholderTableRow(line) {
    if (!line.startsWith('|') || !line.endsWith('|'))
        return false;
    if (TABLE_SEPARATOR_RE.test(line))
        return false;
    const cells = line.split('|').slice(1, -1);
    if (cells.length === 0)
        return false;
    return cells.every(cell => PLACEHOLDER_RE.test(cell.trim()));
}
/**
 * Check if a line should be removed as boilerplate.
 */
function isBoilerplateLine(line) {
    const trimmed = line.trim();
    if (trimmed === '')
        return false; // blank lines are not boilerplate themselves
    if (PLACEHOLDER_RE.test(trimmed))
        return true;
    if (NONE_DOCUMENTED_RE.test(trimmed))
        return true;
    if (TEMPLATE_BLOCKQUOTE_RE.test(trimmed))
        return true;
    if (COMMON_TACTICS_RE.test(trimmed))
        return true;
    if (isPlaceholderTableRow(trimmed))
        return true;
    return false;
}
/**
 * Check if a line is a section header (### or ####).
 */
function isSectionHeader(line) {
    return /^#{3,4}\s/.test(line.trim());
}
/**
 * Strip boilerplate/placeholder content from dossier markdown.
 * Removes placeholder lines, empty table rows, template blockquotes,
 * and entire sections where all content is placeholder.
 */
export function stripBoilerplate(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isSectionHeader(line)) {
            if (currentSection)
                sections.push(currentSection);
            currentSection = { headerIndex: i, headerLine: line, bodyLines: [] };
        }
        else if (currentSection) {
            currentSection.bodyLines.push({ index: i, line });
        }
    }
    if (currentSection)
        sections.push(currentSection);
    // Determine which lines to remove
    const linesToRemove = new Set();
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
            if (isBoilerplateLine(trimmed))
                return true;
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
                if (!TABLE_HEADER_RE.test(trimmed))
                    return false;
                if (isBoilerplateLine(trimmed))
                    return false;
                if (PLACEHOLDER_RE.test(trimmed))
                    return false;
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
        }
        else {
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
        if (sections.length > 0 && i >= sections[0].headerIndex)
            break;
        if (isBoilerplateLine(lines[i])) {
            linesToRemove.add(i);
        }
    }
    // Build result
    const resultLines = lines.filter((_, i) => !linesToRemove.has(i));
    // Collapse multiple consecutive blank lines to at most two
    const collapsed = [];
    let blankCount = 0;
    for (const line of resultLines) {
        if (line.trim() === '') {
            blankCount++;
            if (blankCount <= 2)
                collapsed.push(line);
        }
        else {
            blankCount = 0;
            collapsed.push(line);
        }
    }
    return collapsed.join('\n');
}
/**
 * Remove table headers and separators that no longer have any data rows.
 */
function removeOrphanedTableParts(bodyLines, linesToRemove) {
    // Find table groups: header, separator, data rows
    for (let i = 0; i < bodyLines.length; i++) {
        const bl = bodyLines[i];
        if (TABLE_HEADER_RE.test(bl.line.trim()) && !TABLE_SEPARATOR_RE.test(bl.line.trim())) {
            // Potential table header — look for separator next
            const nextNonBlank = bodyLines.slice(i + 1).find(b => b.line.trim() !== '');
            if (nextNonBlank && TABLE_SEPARATOR_RE.test(nextNonBlank.line.trim())) {
                // Found a table. Check if all data rows after separator are removed
                const sepIdx = bodyLines.indexOf(nextNonBlank);
                const dataRows = bodyLines.slice(sepIdx + 1).filter(b => {
                    const t = b.line.trim();
                    return TABLE_HEADER_RE.test(t) && !TABLE_SEPARATOR_RE.test(t);
                });
                // Stop at next non-table line
                const tableDataRows = [];
                for (let j = sepIdx + 1; j < bodyLines.length; j++) {
                    const t = bodyLines[j].line.trim();
                    if (t === '')
                        continue;
                    if (TABLE_HEADER_RE.test(t) && !TABLE_SEPARATOR_RE.test(t)) {
                        tableDataRows.push(bodyLines[j]);
                    }
                    else {
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
function buildSectionMeta(fullPath, file) {
    const stat = statSync(fullPath);
    const content = readFileSync(fullPath, 'utf-8');
    const stripped = stripBoilerplate(content);
    const yaml = parseFrontmatter(content);
    let lastUpdated = null;
    if (yaml?.lastUpdated) {
        const val = yaml.lastUpdated;
        if (val instanceof Date) {
            lastUpdated = val.toISOString().slice(0, 10);
        }
        else {
            lastUpdated = String(val);
        }
    }
    const sizeBytes = stat.size;
    const filledBytes = Buffer.byteLength(stripped, 'utf-8');
    const fillPercent = sizeBytes > 0 ? Math.round((filledBytes / sizeBytes) * 100) : 0;
    return { file, sizeBytes, filledBytes, fillPercent, lastUpdated };
}
/**
 * Scan a dossier directory and return metadata for each existing section file.
 */
export function scanDossierSections(dossierPath) {
    const results = [];
    // Known section files from the standard dossier structure
    const knownFiles = new Set(Object.values(SECTION_FILES));
    for (const [, file] of Object.entries(SECTION_FILES)) {
        const fullPath = join(dossierPath, file);
        if (!existsSync(fullPath))
            continue;
        results.push(buildSectionMeta(fullPath, file));
    }
    // Scan for extra .md files not in SECTION_FILES (profession-specific tracking files)
    if (existsSync(dossierPath)) {
        for (const entry of readdirSync(dossierPath)) {
            if (!entry.endsWith('.md'))
                continue;
            if (knownFiles.has(entry))
                continue;
            const fullPath = join(dossierPath, entry);
            if (!statSync(fullPath).isFile())
                continue;
            results.push(buildSectionMeta(fullPath, entry));
        }
    }
    return results;
}
/**
 * Extract relationship entries from INDEX.md linkedContacts YAML field.
 */
export function extractRelationships(dossierPath, contactId) {
    const indexPath = join(dossierPath, 'INDEX.md');
    const content = readFileSync(indexPath, 'utf-8');
    const yaml = parseFrontmatter(content);
    if (!yaml)
        return [];
    const linkedContacts = yaml.linkedContacts;
    if (!Array.isArray(linkedContacts))
        return [];
    return linkedContacts.map((entry) => {
        const str = String(entry);
        // Parse "Name (Context)" format
        const match = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        const targetName = match ? match[1].trim() : str.trim();
        const context = match ? match[2].trim() : '';
        return {
            sourceId: contactId,
            targetId: '',
            targetName,
            type: 'associated',
            context,
            bidirectional: false,
        };
    });
}
//# sourceMappingURL=parser.js.map