/**
 * Repair engine — applies fixes based on audit findings.
 *
 * Execution order (dependency chain):
 * 1. Moves (M codes) — content in correct file before dedup
 * 2. Dedup (D codes) — safe after moves
 * 3. Ordering (O codes) — meaningful after content placed
 * 4. Missing sections (C codes) — insert template sections
 * 5. Stale fixes (S codes) — field-level updates last
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AuditResult, runAudit } from './audit.js';

// ── Types ────────────────────────────────────────────────────────────

export interface RepairResult {
  applied: string[];
  failed: string[];
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

/** Count total lines across all .md files in a directory (recursive). */
function countLines(dir: string): number {
  let total = 0;
  if (!existsSync(dir)) return 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countLines(full);
    } else if (entry.name.endsWith('.md')) {
      const content = readFileSync(full, 'utf-8');
      total += content.split('\n').length;
    }
  }
  return total;
}

/**
 * Extract a section block from file content: the heading line + all lines
 * until the next heading at the same or higher level.
 * Returns { start, end, block } where block includes the heading line.
 */
function extractSectionBlock(
  lines: string[],
  heading: string,
): { start: number; end: number; block: string[] } | null {
  const startIdx = lines.findIndex(l => l.trimEnd() === heading);
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

// ── Fix implementations ─────────────────────────────────────────────

function applyMoves(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.misplaced) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes('all')) continue;

    try {
      const srcPath = join(dossierDir, finding.currentFile);
      const dstPath = join(dossierDir, finding.correctFile);

      const srcContent = readFileSync(srcPath, 'utf-8');
      const srcLines = srcContent.split('\n');

      const block = extractSectionBlock(srcLines, finding.section);
      if (!block) {
        failed.push(finding.code);
        continue;
      }

      // Remove section from source file
      srcLines.splice(block.start, block.end - block.start);
      writeFileSync(srcPath, srcLines.join('\n'));

      // Append section to destination file
      let dstContent = '';
      if (existsSync(dstPath)) {
        dstContent = readFileSync(dstPath, 'utf-8');
        if (!dstContent.endsWith('\n')) dstContent += '\n';
      }
      dstContent += block.block.join('\n') + '\n';
      writeFileSync(dstPath, dstContent);

      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}

function applyDedup(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.duplicates) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes('all')) continue;

    try {
      // Keep the first location (canonical), gut the second
      const nonCanonicalFile = finding.locations[1];
      const filePath = join(dossierDir, nonCanonicalFile);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Find the duplicate heading in this file — try both headings if section label contains " / "
      const headingsToTry = finding.section.includes(' / ')
        ? finding.section.split(' / ')
        : [finding.section];

      let replaced = false;
      for (const heading of headingsToTry) {
        const block = extractSectionBlock(lines, heading.trim());
        if (block) {
          // Replace content lines with a cross-reference, keep the heading
          const newBlock = [lines[block.start], `> See ${finding.locations[0]}`];
          lines.splice(block.start, block.end - block.start, ...newBlock);
          replaced = true;
          break;
        }
      }

      if (replaced) {
        writeFileSync(filePath, lines.join('\n'));
        applied.push(finding.code);
      } else {
        failed.push(finding.code);
      }
    } catch {
      failed.push(finding.code);
    }
  }
}

function applyOrdering(
  dossierDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  // Group ordering findings by file so we can process each file once
  const byFile = new Map<string, typeof audit.findings.ordering>();
  for (const finding of audit.findings.ordering) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes('all')) continue;
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file)!.push(finding);
  }

  for (const [relPath, findings] of byFile) {
    try {
      const filePath = join(dossierDir, relPath);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Extract all sections
      const sections: { heading: string; block: string[] }[] = [];
      let frontmatter: string[] = [];
      let inFrontmatter = false;
      let currentBlock: string[] = [];
      let currentHeading: string | null = null;
      let preHeadingLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed === '---' && sections.length === 0 && !currentHeading) {
          inFrontmatter = !inFrontmatter;
          frontmatter.push(line);
          continue;
        }
        if (inFrontmatter) {
          frontmatter.push(line);
          continue;
        }

        if (HEADING_RE.test(trimmed) && headingLevel(trimmed) === 2) {
          if (currentHeading) {
            sections.push({ heading: currentHeading, block: currentBlock });
          } else if (preHeadingLines.length > 0) {
            // Lines before first heading (like h1 title)
            frontmatter.push(...preHeadingLines);
          }
          currentHeading = trimmed;
          currentBlock = [line];
        } else if (currentHeading) {
          currentBlock.push(line);
        } else {
          preHeadingLines.push(line);
        }
      }
      if (currentHeading) {
        sections.push({ heading: currentHeading, block: currentBlock });
      }

      // Sort sections by expectedPosition
      // Build position map from findings
      const posMap = new Map<string, number>();
      for (const f of findings) {
        posMap.set(f.section, f.expectedPosition);
      }

      sections.sort((a, b) => {
        const posA = posMap.get(a.heading) ?? sections.indexOf(a);
        const posB = posMap.get(b.heading) ?? sections.indexOf(b);
        return posA - posB;
      });

      // Reconstruct file
      const result = [...frontmatter];
      for (const sec of sections) {
        result.push(...sec.block);
      }
      writeFileSync(filePath, result.join('\n'));

      for (const f of findings) {
        applied.push(f.code);
      }
    } catch {
      for (const f of findings) {
        failed.push(f.code);
      }
    }
  }
}

function applyMissing(
  dossierDir: string,
  templateDir: string,
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  for (const finding of audit.findings.missing) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes('all')) continue;

    try {
      const filePath = join(dossierDir, finding.file);
      let content = '';
      if (existsSync(filePath)) {
        content = readFileSync(filePath, 'utf-8');
        if (!content.endsWith('\n')) content += '\n';
      }

      // Append the heading as a placeholder
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
    if (!fixCodes.includes(finding.code) && !fixCodes.includes('all')) continue;

    try {
      const filePath = join(dossierDir, finding.file);
      const content = readFileSync(filePath, 'utf-8');

      // Replace the YAML field value in frontmatter
      const fieldRe = new RegExp(
        `^(${finding.field}:\\s*)${escapeRegex(finding.current)}\\s*$`,
        'm',
      );
      const newContent = content.replace(fieldRe, `$1${finding.suggested}`);

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Public API ──────────────────────────────────────────────────────

export function runRepair(
  dossierDir: string,
  templateDir: string,
  audit: AuditResult,
  fixCodes: string[],
): RepairResult {
  const applied: string[] = [];
  const failed: string[] = [];

  // Count lines before
  const linesBefore = countLines(dossierDir);

  // Apply fixes in dependency order
  // 1. Moves
  applyMoves(dossierDir, audit, fixCodes, applied, failed);
  // 2. Dedup
  applyDedup(dossierDir, audit, fixCodes, applied, failed);
  // 3. Ordering
  applyOrdering(dossierDir, audit, fixCodes, applied, failed);
  // 4. Missing sections
  applyMissing(dossierDir, templateDir, audit, fixCodes, applied, failed);
  // 5. Stale fixes
  applyStale(dossierDir, audit, fixCodes, applied, failed);

  // Count lines after
  const linesAfter = countLines(dossierDir);

  // Calculate content integrity
  const lineDelta = linesAfter - linesBefore;
  const lossPercent = linesBefore > 0 ? ((linesBefore - linesAfter) / linesBefore) * 100 : 0;

  let contentIntegrity: 'PASS' | 'WARNING' | 'FAIL';
  if (lossPercent > 15) {
    contentIntegrity = 'FAIL';
  } else if (lossPercent > 5) {
    contentIntegrity = 'WARNING';
  } else {
    contentIntegrity = 'PASS';
  }

  // Run fresh compliance check
  const freshAudit = runAudit(dossierDir, templateDir, ['compliance']);

  const delta = lineDelta >= 0 ? `+${lineDelta}` : `${lineDelta}`;

  return {
    applied,
    failed,
    validation: {
      contentIntegrity,
      linesBefore,
      linesAfter,
      delta,
      complianceAfter: freshAudit.compliance,
    },
  };
}
