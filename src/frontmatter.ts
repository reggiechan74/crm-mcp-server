/**
 * The single YAML frontmatter implementation used by the indexer, writer,
 * audit and repair engines.
 *
 * Reads are lenient (a malformed block degrades to a regex extraction of key
 * fields rather than dropping the dossier). Writes go through yaml's Document
 * API so comments, key order and quoting of untouched fields survive.
 */

import { parse as parseYaml, parseDocument } from 'yaml';

const FRONTMATTER_RE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

export interface SplitResult {
  /** Raw YAML text between the fences, or null when there is no frontmatter. */
  yaml: string | null;
  /** Everything after the closing fence (or the whole content). */
  body: string;
}

export function splitFrontmatter(content: string): SplitResult {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { yaml: null, body: content };
  return { yaml: match[1] ?? '', body: content.slice(match[0].length) };
}

/**
 * Parse frontmatter leniently. Returns null when there is no frontmatter or
 * nothing could be recovered from it.
 */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  const { yaml } = splitFrontmatter(content);
  if (yaml === null) return null;
  try {
    const parsed = parseYaml(yaml);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    // Fallback: comment out unquoted parenthetical content after quoted array items
    const fixed = yaml.replace(/^(\s*-\s*"[^"]*")\s*(\([^)]*\))/gm, '$1 # $2');
    try {
      return parseYaml(fixed) as Record<string, unknown>;
    } catch {
      // Last resort: extract key fields with regex
      const result: Record<string, unknown> = {};
      for (const [key, pattern] of [
        ['name', /^name:\s*"?([^"\n]+)"?/m],
        ['dossierCode', /^dossierCode:\s*"?([^"\n]+)"?/m],
        ['organization', /^organization:\s*"?([^"\n]+)"?/m],
        ['status', /^status:\s*(\S+)/m],
        ['lastContactDate', /^lastContactDate:\s*"?([^"\s]+)"?/m],
        ['lastUpdated', /^lastUpdated:\s*"?([^"\s]+)"?/m],
        ['profession', /^profession:\s*"?([^"\n]+)"?/m],
      ] as const) {
        const m = yaml.match(pattern);
        if (m) result[key] = m[1].trim();
      }
      return Object.keys(result).length > 0 ? result : null;
    }
  }
}

/**
 * Return `content` with the given frontmatter fields set (a value of
 * `undefined` deletes the key). Creates a frontmatter block when absent.
 * Comments, ordering and formatting of untouched keys are preserved.
 *
 * Throws on frontmatter that does not parse as YAML, rather than silently
 * rewriting (and potentially truncating) a malformed block.
 */
export function updateFrontmatter(content: string, fields: Record<string, unknown>): string {
  const { yaml, body } = splitFrontmatter(content);
  const doc = parseDocument(yaml ?? '');
  if (doc.errors.length > 0) {
    throw new Error(`Cannot update malformed YAML frontmatter: ${doc.errors[0].message}`);
  }
  if (doc.contents === null) doc.contents = doc.createNode({}) as any;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) doc.delete(key);
    else doc.set(key, value instanceof Date ? value.toISOString().slice(0, 10) : value);
  }
  const yamlStr = doc.toString({ lineWidth: 0 }).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}
