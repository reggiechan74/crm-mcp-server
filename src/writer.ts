import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { SECTION_FILES, type DossierSection } from './types.js';
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
function invalidateAndReindex(store: Store, contactId: string, section: DossierSection, filePath: string): void {
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
export function updateField(store: Store, contactId: string, section: DossierSection, field: string, value: string): void {
  const contactPath = getContactPath(store, contactId);
  const sectionFile = SECTION_FILES[section];
  if (!sectionFile) {
    throw new Error(`Unknown section: ${section}`);
  }

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
