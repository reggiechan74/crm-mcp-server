/**
 * Repair engine — applies fixes based on audit findings.
 *
 * Execution order (dependency chain):
 * 1. Moves (M codes) — content in correct file before dedup
 * 2. Dedup (D codes) — safe after moves
 * 3. Ordering (O codes) — meaningful after content placed
 * 4. Missing sections (C codes) — insert template sections
 * 5. Stale fixes (S codes) — field-level updates last
 *
 * Every .md file in the dossier is snapshotted first. If the post-repair
 * integrity check fails (more than 15% of distinct content lines lost) the
 * snapshot is restored and nothing is left changed on disk.
 */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { AuditResult, runAudit, buildRoutingTable, stripPlaceholderLines } from './audit.js';
import { collectMdFiles, today } from './fsutil.js';
import { parseFrontmatter, splitFrontmatter, updateFrontmatter } from './frontmatter.js';

// ── Types ────────────────────────────────────────────────────────────

export interface RepairResult {
  applied: string[];
  failed: string[];
  /** True when the integrity check failed and every file was restored. */
  rolledBack: boolean;
  validation: {
    contentIntegrity: 'PASS' | 'WARNING' | 'FAIL';
    linesBefore: number;
    linesAfter: number;
    delta: string;
    complianceAfter: number;
  };
}

// ── Heading regex (same as audit.ts) ────────────────────────────────

const HEADING_RE = /^#{2,4}\s+.+/;

/** Get heading level from a heading line. */
function headingLevel(line: string): number {
  const match = line.match(/^(#{2,4})\s/);
  return match ? match[1].length : 0;
}

// ── Helpers ─────────────────────────────────────────────────────────

type Snapshot = Map<string, string>;

function snapshotDossier(dir: string): Snapshot {
  const snap: Snapshot = new Map();
  if (!existsSync(dir)) return snap;
  for (const rel of collectMdFiles(dir)) snap.set(rel, readFileSync(join(dir, rel), 'utf-8'));
  return snap;
}

/** Restore a snapshot exactly: rewrite every original file and delete files created since. */
function restoreSnapshot(dir: string, snap: Snapshot): void {
  for (const rel of collectMdFiles(dir)) {
    if (!snap.has(rel)) rmSync(join(dir, rel), { force: true });
  }
  for (const [rel, content] of snap) writeFileSync(join(dir, rel), content);
}

function countLines(snap: Snapshot): number {
  let total = 0;
  for (const content of snap.values()) total += content.split('\n').length;
  return total;
}

/** Distinct non-blank content lines across the dossier. */
function distinctLines(snap: Snapshot): Set<string> {
  const set = new Set<string>();
  for (const content of snap.values()) {
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (t) set.add(t);
    }
  }
  return set;
}

export interface IntegrityOutcome {
  contentIntegrity: 'PASS' | 'WARNING' | 'FAIL';
  linesBefore: number;
  linesAfter: number;
  rolledBack: boolean;
}

/**
 * Run `apply` against a dossier and verify no content was lost. Loss is
 * measured on DISTINCT non-blank lines — collapsing an identical duplicate
 * removes no information, while dropping unique text does. More than 5% lost
 * is a WARNING; more than 15% is a FAIL and every file is restored exactly
 * (including deleting files `apply` created).
 */
export function withIntegrityGuard(dossierDir: string, apply: () => void): IntegrityOutcome {
  const snapshot = snapshotDossier(dossierDir);
  const before = distinctLines(snapshot);

  apply();

  const after = snapshotDossier(dossierDir);
  const afterLines = distinctLines(after);
  let lost = 0;
  for (const line of before) if (!afterLines.has(line)) lost++;
  const lossPercent = before.size > 0 ? (lost / before.size) * 100 : 0;

  const contentIntegrity = lossPercent > 15 ? 'FAIL' : lossPercent > 5 ? 'WARNING' : 'PASS';
  const rolledBack = contentIntegrity === 'FAIL';
  if (rolledBack) restoreSnapshot(dossierDir, snapshot);

  return { contentIntegrity, linesBefore: countLines(snapshot), linesAfter: countLines(rolledBack ? snapshot : after), rolledBack };
}

function selected(code: string, fixCodes: string[]): boolean {
  return fixCodes.includes(code) || fixCodes.includes('all');
}

/**
 * Extract a section block from file content: the heading line + all lines
 * until the next heading at the same or higher level (subsections included).
 * `occurrence` selects which match when a heading appears more than once.
 */
function extractSectionBlock(
  lines: string[],
  heading: string,
  occurrence = 0,
): { start: number; end: number; block: string[] } | null {
  let startIdx = -1;
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === heading && seen++ === occurrence) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  const level = headingLevel(heading);
  let endIdx = startIdx + 1;
  while (endIdx < lines.length) {
    const line = lines[endIdx].trimEnd();
    if (HEADING_RE.test(line) && headingLevel(line) <= level) {
      break;
    }
    endIdx++;
  }

  return {
    start: startIdx,
    end: endIdx,
    block: lines.slice(startIdx, endIdx),
  };
}

/**
 * A heading's own body: lines after the heading up to the next heading of
 * ANY level. Subsections are not part of it.
 */
function ownBody(lines: string[], headingIdx: number): { start: number; end: number } {
  let end = headingIdx + 1;
  while (end < lines.length && !HEADING_RE.test(lines[end].trimEnd())) end++;
  return { start: headingIdx + 1, end };
}

/** Normalized content lines for comparison (matches audit's extractSections filtering). */
function contentLines(lines: string[]): string[] {
  return stripPlaceholderLines(lines);
}

function findHeading(lines: string[], heading: string, occurrence = 0): number {
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === heading && seen++ === occurrence) return i;
  }
  return -1;
}

// ── Fix implementations ─────────────────────────────────────────────

function applyMoves(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.misplaced) {
    if (!selected(finding.code, fixCodes)) continue;

    try {
      const srcPath = join(dossierDir, finding.currentFile);
      const dstPath = join(dossierDir, finding.correctFile);

      const srcLines = readFileSync(srcPath, 'utf-8').split('\n');
      const block = extractSectionBlock(srcLines, finding.section);
      if (!block) {
        failed.push(finding.code);
        continue;
      }

      // Append section to destination file first, so a failed write can
      // never leave the section removed from both files
      let dstContent = '';
      if (existsSync(dstPath)) {
        dstContent = readFileSync(dstPath, 'utf-8');
        if (!dstContent.endsWith('\n')) dstContent += '\n';
      }
      dstContent += block.block.join('\n') + '\n';
      writeFileSync(dstPath, dstContent);

      // Then remove section from source file
      srcLines.splice(block.start, block.end - block.start);
      writeFileSync(srcPath, srcLines.join('\n'));

      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}

/**
 * Replace the second copy of a duplicated section with a cross-reference —
 * but only when its own content is identical to the first copy. Partial
 * overlaps (the audit flags >60%) are left for a human, since collapsing them
 * would discard the lines that differ. Subsections are never touched.
 */
function applyDedup(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.duplicates) {
    if (!selected(finding.code, fixCodes)) continue;

    try {
      const [canonicalFile, dupFile] = finding.locations;
      const [canonicalHeading, dupHeading] = finding.headings ?? [finding.section, finding.section];

      const canonicalLines = readFileSync(join(dossierDir, canonicalFile), 'utf-8').split('\n');
      const dupPath = join(dossierDir, dupFile);
      const dupLines = canonicalFile === dupFile ? canonicalLines : readFileSync(dupPath, 'utf-8').split('\n');

      const canonicalIdx = findHeading(canonicalLines, canonicalHeading);
      // Same heading in the same file: the duplicate is the second occurrence.
      const dupOccurrence = canonicalFile === dupFile && canonicalHeading === dupHeading ? 1 : 0;
      const dupIdx = findHeading(dupLines, dupHeading, dupOccurrence);
      if (canonicalIdx === -1 || dupIdx === -1) {
        failed.push(finding.code);
        continue;
      }

      const canonicalBody = ownBody(canonicalLines, canonicalIdx);
      const dupBody = ownBody(dupLines, dupIdx);
      const a = contentLines(canonicalLines.slice(canonicalBody.start, canonicalBody.end));
      const b = contentLines(dupLines.slice(dupBody.start, dupBody.end));
      if (a.length === 0 || a.length !== b.length || a.some((line, i) => line !== b[i])) {
        failed.push(finding.code);
        continue;
      }

      dupLines.splice(dupBody.start, dupBody.end - dupBody.start, `> See ${canonicalFile}`, '');
      writeFileSync(dupPath, dupLines.join('\n'));
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}

/**
 * Reorder H2 blocks in each affected file to match the template order.
 * Blocks the template does not know stay attached to the block before them;
 * ties keep their original order (stable decorate-sort-undecorate).
 */
function applyOrdering(
  dossierDir: string,
  templateDirs: string | string[],
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  const byFile = new Map<string, typeof audit.findings.ordering>();
  for (const finding of audit.findings.ordering) {
    if (!selected(finding.code, fixCodes)) continue;
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file)!.push(finding);
  }
  if (byFile.size === 0) return;

  // Template heading order per file
  const templateOrder = new Map<string, string[]>();
  for (const [heading, file] of buildRoutingTable(templateDirs)) {
    if (!templateOrder.has(file)) templateOrder.set(file, []);
    templateOrder.get(file)!.push(heading);
  }

  for (const [relPath, findings] of byFile) {
    try {
      const filePath = join(dossierDir, relPath);
      const lines = readFileSync(filePath, 'utf-8').split('\n');
      const order = templateOrder.get(relPath) ?? [];

      // Preamble: frontmatter (only a leading --- block) plus anything before the first H2
      let firstBodyLine = 0;
      if (lines[0]?.trimEnd() === '---') {
        const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
        firstBodyLine = close === -1 ? lines.length : close + 1;
      }
      let firstH2 = lines.findIndex((l, i) => i >= firstBodyLine && HEADING_RE.test(l.trimEnd()) && headingLevel(l.trimEnd()) === 2);
      if (firstH2 === -1) firstH2 = lines.length;
      const preamble = lines.slice(0, firstH2);

      // Split into H2 blocks
      const blocks: { heading: string; lines: string[] }[] = [];
      for (let i = firstH2; i < lines.length; i++) {
        const trimmed = lines[i].trimEnd();
        if (HEADING_RE.test(trimmed) && headingLevel(trimmed) === 2) {
          blocks.push({ heading: trimmed, lines: [lines[i]] });
        } else {
          blocks[blocks.length - 1].lines.push(lines[i]);
        }
      }

      // Group unknown blocks with the preceding known block, then stable-sort groups
      const groups: { key: number; seq: number; lines: string[] }[] = [];
      for (const block of blocks) {
        const idx = order.indexOf(block.heading);
        if (idx === -1 && groups.length > 0) {
          groups[groups.length - 1].lines.push(...block.lines);
        } else {
          groups.push({ key: idx, seq: groups.length, lines: [...block.lines] });
        }
      }
      groups.sort((a, b) => (a.key - b.key) || (a.seq - b.seq));

      writeFileSync(filePath, [...preamble, ...groups.flatMap(g => g.lines)].join('\n'));
      for (const f of findings) applied.push(f.code);
    } catch {
      for (const f of findings) failed.push(f.code);
    }
  }
}

/** Last layer that ships `relPath` — the file the composed template actually uses. */
function templateSource(templateDirs: string[], relPath: string): string | null {
  for (let i = templateDirs.length - 1; i >= 0; i--) {
    const candidate = join(templateDirs[i], relPath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Fill a template file's placeholders for this dossier: name and dossier code
 * come from the dossier's INDEX.md; other {{…}} placeholders become empty.
 * Inside frontmatter values are JSON-escaped (templates double-quote them).
 */
function fillTemplate(content: string, dossierDir: string): string {
  const index = existsSync(join(dossierDir, 'INDEX.md'))
    ? parseFrontmatter(readFileSync(join(dossierDir, 'INDEX.md'), 'utf-8')) ?? {}
    : {};
  const vars: Record<string, string> = {
    name: String(index.name ?? basename(dossierDir)),
    dossierCode: String(index.dossierCode ?? ''),
    date: today(),
  };
  const { body } = splitFrontmatter(content);
  const head = content.slice(0, content.length - body.length);
  const fill = (text: string, escape: boolean) =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      const value = vars[key] ?? '';
      return escape ? JSON.stringify(value).slice(1, -1) : value;
    });
  return fill(head, true) + fill(body, false);
}

function applyMissing(
  dossierDir: string,
  templateDirs: string[],
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  const createdFromTemplate = new Set<string>();
  for (const finding of audit.findings.missing) {
    if (!selected(finding.code, fixCodes)) continue;

    try {
      const filePath = join(dossierDir, finding.file);
      if (createdFromTemplate.has(finding.file)) {
        applied.push(finding.code);
        continue;
      }
      if (!existsSync(filePath)) {
        // Whole file missing (e.g. an overlay added after creation): copy it
        // from the template so it gets frontmatter and every section at once.
        const source = templateSource(templateDirs, finding.file);
        if (source) {
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, fillTemplate(readFileSync(source, 'utf-8'), dossierDir));
          createdFromTemplate.add(finding.file);
          applied.push(finding.code);
          continue;
        }
      }
      let content = '';
      if (existsSync(filePath)) {
        content = readFileSync(filePath, 'utf-8');
        if (!content.endsWith('\n')) content += '\n';
      }
      content += `${finding.section}\n\n`;
      writeFileSync(filePath, content);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}

function applyStale(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.stale) {
    if (!selected(finding.code, fixCodes)) continue;

    try {
      const filePath = join(dossierDir, finding.file);
      const content = readFileSync(filePath, 'utf-8');
      const newContent = updateFrontmatter(content, { [finding.field]: finding.suggested });

      if (newContent === content) {
        failed.push(finding.code);
        continue;
      }

      writeFileSync(filePath, newContent);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function runRepair(
  dossierDir: string,
  templateDirs: string | string[],
  audit: AuditResult,
  fixCodes: string[],
): RepairResult {
  const applied: string[] = [];
  const failed: string[] = [];
  const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];

  // Apply fixes in dependency order
  const outcome = withIntegrityGuard(dossierDir, () => {
    applyMoves(dossierDir, audit, fixCodes, applied, failed);
    applyDedup(dossierDir, audit, fixCodes, applied, failed);
    applyOrdering(dossierDir, layers, audit, fixCodes, applied, failed);
    applyMissing(dossierDir, layers, audit, fixCodes, applied, failed);
    applyStale(dossierDir, audit, fixCodes, applied, failed);
  });
  if (outcome.rolledBack) failed.push(...applied.splice(0));

  // Run fresh compliance check
  const freshAudit = runAudit(dossierDir, layers, ['compliance']);

  const lineDelta = outcome.linesAfter - outcome.linesBefore;
  return {
    applied,
    failed,
    rolledBack: outcome.rolledBack,
    validation: {
      contentIntegrity: outcome.contentIntegrity,
      linesBefore: outcome.linesBefore,
      linesAfter: outcome.linesAfter,
      delta: lineDelta >= 0 ? `+${lineDelta}` : `${lineDelta}`,
      complianceAfter: freshAudit.compliance,
    },
  };
}
