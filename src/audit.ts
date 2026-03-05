/**
 * Audit engine — routing table and compliance pass.
 *
 * Extensible: each audit pass is a standalone function that takes
 * routing table + dossier headings and returns typed findings.
 * Tasks 8/9 will add misplaced, stale, duplicates, and ordering passes.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

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
  expectedFile: string;
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface StaleFinding {
  code: string;
  file: string;
  section: string;
  lastUpdated: string;
  daysSince: number;
  priority: 'CRITICAL' | 'MODERATE' | 'MINOR';
}

export interface DuplicateFinding {
  code: string;
  section: string;
  locations: string[];
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
 * Recursively collect all .md files under a directory,
 * returning paths relative to the root.
 */
function collectMdFiles(dir: string, root?: string): string[] {
  const base = root ?? dir;
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full, base));
    } else if (entry.name.endsWith('.md')) {
      results.push(relative(base, full));
    }
  }
  return results;
}

/**
 * Extract headings (## through ####) from a markdown file.
 * Skips h1 headings — those are document titles, not routable sections.
 */
function extractHeadings(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  return content
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

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build a routing table from a template directory.
 *
 * Reads every .md file under `templateDir`, extracts headings (## - ####),
 * and maps each heading string to its relative file path.
 * H1 headings are ignored — they are document titles, not sections.
 */
export function buildRoutingTable(templateDir: string): Map<string, string> {
  const table = new Map<string, string>();
  const mdFiles = collectMdFiles(templateDir);

  for (const relPath of mdFiles) {
    const headings = extractHeadings(join(templateDir, relPath));
    for (const h of headings) {
      table.set(h, relPath);
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
  templateDir: string,
  passes: AuditPass[],
): AuditResult {
  const contact = basename(dossierDir);
  const templateName = basename(templateDir);

  // Always initialize all finding arrays
  const findings: AuditFindings = {
    misplaced: [],
    stale: [],
    duplicates: [],
    ordering: [],
    missing: [],
  };

  const routingTable = buildRoutingTable(templateDir);

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

  // ── Future passes placeholder ────────────────────────────────────
  // if (passes.includes('misplaced')) { ... }
  // if (passes.includes('stale'))     { ... }
  // if (passes.includes('duplicates')){ ... }
  // if (passes.includes('ordering')) { ... }

  // ── Summary ──────────────────────────────────────────────────────
  const totalFindings =
    findings.missing.length +
    findings.misplaced.length +
    findings.stale.length +
    findings.duplicates.length +
    findings.ordering.length;

  const summary = totalFindings === 0
    ? `${contact}: 100% compliant, no findings.`
    : `${contact}: ${compliance}% compliant, ${totalFindings} finding(s) — ${findings.missing.length} missing.`;

  return {
    contact,
    template: templateName,
    compliance,
    findings,
    summary,
  };
}
