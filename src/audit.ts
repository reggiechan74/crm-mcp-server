/**
 * Audit engine — routing table and compliance pass.
 *
 * Extensible: each audit pass is a standalone function that takes
 * routing table + dossier headings and returns typed findings.
 * Tasks 8/9 will add misplaced, stale, duplicates, and ordering passes.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { collectMdFiles, formatDate } from './fsutil.js';
import { parseFrontmatter, splitFrontmatter } from './frontmatter.js';

// ── Types ────────────────────────────────────────────────────────────

export type AuditPass = 'compliance' | 'misplaced' | 'stale' | 'duplicates' | 'ordering';

export interface MissingFinding {
  code: string;
  file: string;
  section: string;
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface MisplacedFinding {
  code: string;
  section: string;
  currentFile: string;
  correctFile: string;
  lines: number;
  preview: string;
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface StaleFinding {
  code: string;
  file: string;
  field: string;
  current: string;
  suggested: string;
  evidence: string;
  confidence: 'HIGH' | 'MEDIUM';
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface DuplicateFinding {
  code: string;
  section: string;
  locations: string[];
  /** Heading at each location (same order as `locations`). */
  headings: string[];
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface OrderingFinding {
  code: string;
  file: string;
  section: string;
  expectedPosition: number;
  actualPosition: number;
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface AuditFindings {
  misplaced: MisplacedFinding[];
  stale: StaleFinding[];
  duplicates: DuplicateFinding[];
  ordering: OrderingFinding[];
  missing: MissingFinding[];
}

export interface AuditResult {
  contact: string;
  template: string;
  compliance: number;
  findings: AuditFindings;
  summary: string;
}

// ── Heading regex: matches ## through #### (excludes h1) ─────────────

const HEADING_RE = /^#{2,4}\s+.+/;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract headings (## through ####) from a markdown file.
 * Skips h1 headings — those are document titles, not routable sections.
 */
function extractHeadings(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const { body } = splitFrontmatter(readFileSync(filePath, 'utf-8'));
  return body
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => HEADING_RE.test(line));
}

/**
 * Determine missing-section priority based on the heading.
 * Roman-numeral top-level sections are CRITICAL,
 * lettered subsections are MODERATE, everything else MINOR.
 */
function missingPriority(heading: string): 'CRITICAL' | 'MODERATE' | 'MINOR' {
  if (/^## [IVXLCDM]+\.\s/.test(heading)) return 'CRITICAL';
  if (/^### [A-Z]\.\s/.test(heading)) return 'MODERATE';
  return 'MINOR';
}

/**
 * Extract content lines under each heading from a markdown file.
 * Returns a map of heading -> content lines (non-empty, trimmed).
 */
function extractSections(filePath: string): Map<string, string[]> {
  if (!existsSync(filePath)) return new Map();
  // Only a leading `---` block is frontmatter; later `---` lines are
  // horizontal rules and must not hide the content that follows them.
  const { body } = splitFrontmatter(readFileSync(filePath, 'utf-8'));
  const lines = body.split('\n');
  const sections = new Map<string, string[]>();
  let currentHeading: string | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === '---') continue;

    if (HEADING_RE.test(trimmed)) {
      currentHeading = trimmed;
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
    } else if (currentHeading) {
      const t = trimmed.trim();
      if (t.length > 0 && !t.startsWith('|---') && !t.startsWith('| Date') && !t.startsWith('| ---')) {
        sections.get(currentHeading)!.push(t);
      }
    }
  }
  return sections;
}

/**
 * Parse the interaction log table from log.md and return the most recent date.
 */
function parseLatestLogDate(logPath: string): { date: string; summary: string } | null {
  if (!existsSync(logPath)) return null;
  const content = readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');
  const dateRe = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/;
  let latest: { date: string; summary: string } | null = null;

  for (const line of lines) {
    const m = line.match(dateRe);
    if (m) {
      const date = m[1];
      // Extract summary (third column)
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      const summary = cols[2] || '';
      if (!latest || date > latest.date) {
        latest = { date, summary };
      }
    }
  }
  return latest;
}

/**
 * Parse YAML frontmatter and return a key-value map of scalar values.
 */
function readFrontmatter(filePath: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(filePath)) return result;
  const yaml = parseFrontmatter(readFileSync(filePath, 'utf-8'));
  for (const [key, val] of Object.entries(yaml ?? {})) {
    const str = formatDate(val);
    if (str !== null && typeof val !== 'object') result.set(key, str);
    else if (val instanceof Date) result.set(key, str!);
  }
  return result;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build a routing table (heading → relative file) from one template
 * directory or an ordered list of layers. A layer that ships a file replaces
 * every heading earlier layers mapped to that same file, then adds its own —
 * so an overriding file (e.g. MOTION/TECH_SALE/pipeline.md) defines that
 * file's expected headings. H1 headings are ignored.
 */
export function buildRoutingTable(templateDirs: string | string[]): Map<string, string> {
  const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];
  const table = new Map<string, string>();
  for (const dir of layers) {
    const files = collectMdFiles(dir);
    const shipped = new Set(files);
    for (const [heading, file] of [...table]) {
      if (shipped.has(file)) table.delete(heading);
    }
    for (const relPath of files) {
      for (const h of extractHeadings(join(dir, relPath))) table.set(h, relPath);
    }
  }
  return table;
}

/**
 * Run specified audit passes against a dossier directory.
 *
 * Currently supports: compliance.
 * Future passes (misplaced, stale, duplicates, ordering) will be added
 * in Tasks 8 and 9.
 */
export function runAudit(
  dossierDir: string,
  templateDirs: string | string[],
  passes: AuditPass[],
): AuditResult {
  const contact = basename(dossierDir);
  const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];
  const templateName = basename(layers[0] ?? '');

  // Always initialize all finding arrays
  const findings: AuditFindings = {
    misplaced: [],
    stale: [],
    duplicates: [],
    ordering: [],
    missing: [],
  };

  const routingTable = buildRoutingTable(layers);

  // Build dossier heading map: file -> set of headings
  const dossierHeadings = new Map<string, Set<string>>();
  const dossierMdFiles = collectMdFiles(dossierDir);
  for (const relPath of dossierMdFiles) {
    const headings = extractHeadings(join(dossierDir, relPath));
    dossierHeadings.set(relPath, new Set(headings));
  }

  let compliance = 100;

  // ── Compliance pass ──────────────────────────────────────────────
  if (passes.includes('compliance')) {
    let total = 0;
    let found = 0;
    let missingCount = 0;

    for (const [heading, expectedFile] of routingTable) {
      total++;
      const fileHeadings = dossierHeadings.get(expectedFile);
      if (fileHeadings && fileHeadings.has(heading)) {
        found++;
      } else {
        missingCount++;
        findings.missing.push({
          code: `C${missingCount}`,
          file: expectedFile,
          section: heading,
          priority: missingPriority(heading),
        });
      }
    }

    compliance = total > 0 ? Math.round((found / total) * 100) : 100;
  }

  // ── Misplaced pass ─────────────────────────────────────────────
  if (passes.includes('misplaced')) {
    let mpCount = 0;
    for (const [relPath, headings] of dossierHeadings) {
      for (const heading of headings) {
        const canonicalFile = routingTable.get(heading);
        if (canonicalFile && canonicalFile !== relPath) {
          mpCount++;
          // Get content lines and preview
          const sections = extractSections(join(dossierDir, relPath));
          const contentLines = sections.get(heading) || [];
          const preview = contentLines.slice(0, 2).join(' ').slice(0, 80) || heading;
          findings.misplaced.push({
            code: `M${mpCount}`,
            section: heading,
            currentFile: relPath,
            correctFile: canonicalFile,
            lines: contentLines.length,
            preview,
            priority: missingPriority(heading),
          });
        }
      }
    }
  }

  // ── Stale pass ────────────────────────────────────────────────
  if (passes.includes('stale')) {
    const indexPath = join(dossierDir, 'INDEX.md');
    const logPath = join(dossierDir, 'log.md');
    const fm = readFrontmatter(indexPath);
    const lastContact = fm.get('lastContactDate') || '';
    const latestLog = parseLatestLogDate(logPath);

    if (latestLog && lastContact && latestLog.date > lastContact) {
      findings.stale.push({
        code: 'S1',
        file: 'INDEX.md',
        field: 'lastContactDate',
        current: lastContact,
        suggested: latestLog.date,
        evidence: `log.md ${latestLog.date}: ${latestLog.summary}`,
        confidence: 'HIGH',
        priority: 'CRITICAL',
      });
    }
  }

  // ── Duplicates pass ───────────────────────────────────────────
  if (passes.includes('duplicates')) {
    // Collect all sections with their content lines across all files
    const allSections: { heading: string; file: string; lines: string[] }[] = [];
    for (const relPath of dossierMdFiles) {
      const sections = extractSections(join(dossierDir, relPath));
      for (const [heading, lines] of sections) {
        if (lines.length > 0) {
          allSections.push({ heading, file: relPath, lines });
        }
      }
    }

    let dupCount = 0;
    const seen = new Set<string>();
    for (let i = 0; i < allSections.length; i++) {
      for (let j = i + 1; j < allSections.length; j++) {
        const a = allSections[i];
        const b = allSections[j];
        const pairKey = `${a.file}:${a.heading}|${b.file}:${b.heading}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        // Compute overlap: count lines in a that also appear in b
        const setB = new Set(b.lines);
        const overlap = a.lines.filter(l => setB.has(l)).length;
        const smaller = Math.min(a.lines.length, b.lines.length);
        if (smaller > 0 && overlap / smaller > 0.6) {
          dupCount++;
          // Use the shorter heading or combine them
          const sectionLabel = a.heading === b.heading ? a.heading : `${a.heading} / ${b.heading}`;
          findings.duplicates.push({
            code: `D${dupCount}`,
            section: sectionLabel,
            locations: [a.file, b.file],
            headings: [a.heading, b.heading],
            priority: 'MODERATE',
          });
        }
      }
    }
  }

  // ── Ordering pass ─────────────────────────────────────────────
  if (passes.includes('ordering')) {
    // Build per-file ordering from routing table
    const templateFileOrder = new Map<string, string[]>();
    for (const [heading, file] of routingTable) {
      if (!templateFileOrder.has(file)) {
        templateFileOrder.set(file, []);
      }
      templateFileOrder.get(file)!.push(heading);
    }

    let ordCount = 0;
    for (const [relPath, headings] of dossierHeadings) {
      const templateOrder = templateFileOrder.get(relPath);
      if (!templateOrder) continue;

      // Filter dossier headings to only those that exist in the template for this file
      const dossierList: string[] = [];
      const headingArr = Array.from(headings);
      // Preserve document order by re-extracting from file
      const docHeadings = extractHeadings(join(dossierDir, relPath));
      for (const h of docHeadings) {
        if (templateOrder.includes(h)) {
          dossierList.push(h);
        }
      }

      // Map each dossier heading to its index in the template order
      const templateIndex = (h: string) => templateOrder.indexOf(h);

      // Find sections where template index decreases relative to the previous section
      // (i.e., appears before something that should come before it in template)
      for (let i = 1; i < dossierList.length; i++) {
        if (templateIndex(dossierList[i]) < templateIndex(dossierList[i - 1])) {
          ordCount++;
          findings.ordering.push({
            code: `O${ordCount}`,
            file: relPath,
            section: dossierList[i],
            expectedPosition: templateIndex(dossierList[i]),
            actualPosition: i,
            priority: 'MINOR',
          });
        }
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  const totalFindings =
    findings.missing.length +
    findings.misplaced.length +
    findings.stale.length +
    findings.duplicates.length +
    findings.ordering.length;

  const summary = totalFindings === 0
    ? `${contact}: 100% compliant, no findings.`
    : `${contact}: ${compliance}% compliant, ${totalFindings} finding(s).`;

  return {
    contact,
    template: templateName,
    compliance,
    findings,
    summary,
  };
}
