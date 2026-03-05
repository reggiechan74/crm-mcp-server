/**
 * Audit engine — routing table and compliance pass.
 *
 * Extensible: each audit pass is a standalone function that takes
 * routing table + dossier headings and returns typed findings.
 * Tasks 8/9 will add misplaced, stale, duplicates, and ordering passes.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
// ── Heading regex: matches ## through #### (excludes h1) ─────────────
const HEADING_RE = /^#{2,4}\s+.+/;
// ── Helpers ──────────────────────────────────────────────────────────
/**
 * Recursively collect all .md files under a directory,
 * returning paths relative to the root.
 */
function collectMdFiles(dir, root) {
    const base = root ?? dir;
    const results = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMdFiles(full, base));
        }
        else if (entry.name.endsWith('.md')) {
            results.push(relative(base, full));
        }
    }
    return results;
}
/**
 * Extract headings (## through ####) from a markdown file.
 * Skips h1 headings — those are document titles, not routable sections.
 */
function extractHeadings(filePath) {
    if (!existsSync(filePath))
        return [];
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
function missingPriority(heading) {
    if (/^## [IVXLCDM]+\.\s/.test(heading))
        return 'CRITICAL';
    if (/^### [A-Z]\.\s/.test(heading))
        return 'MODERATE';
    return 'MINOR';
}
/**
 * Extract content lines under each heading from a markdown file.
 * Returns a map of heading -> content lines (non-empty, trimmed).
 */
function extractSections(filePath) {
    if (!existsSync(filePath))
        return new Map();
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const sections = new Map();
    let currentHeading = null;
    let inFrontmatter = false;
    for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed === '---') {
            inFrontmatter = !inFrontmatter;
            continue;
        }
        if (inFrontmatter)
            continue;
        if (HEADING_RE.test(trimmed)) {
            currentHeading = trimmed;
            if (!sections.has(currentHeading)) {
                sections.set(currentHeading, []);
            }
        }
        else if (currentHeading) {
            const t = trimmed.trim();
            if (t.length > 0 && !t.startsWith('|---') && !t.startsWith('| Date') && !t.startsWith('| ---')) {
                sections.get(currentHeading).push(t);
            }
        }
    }
    return sections;
}
/**
 * Parse the interaction log table from log.md and return the most recent date.
 */
function parseLatestLogDate(logPath) {
    if (!existsSync(logPath))
        return null;
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    const dateRe = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/;
    let latest = null;
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
 * Parse YAML frontmatter and return a key-value map.
 */
function parseFrontmatter(filePath) {
    const result = new Map();
    if (!existsSync(filePath))
        return result;
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch)
        return result;
    for (const line of fmMatch[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim();
            result.set(key, val);
        }
    }
    return result;
}
// ── Public API ───────────────────────────────────────────────────────
/**
 * Build a routing table from a template directory.
 *
 * Reads every .md file under `templateDir`, extracts headings (## - ####),
 * and maps each heading string to its relative file path.
 * H1 headings are ignored — they are document titles, not sections.
 */
export function buildRoutingTable(templateDir) {
    const table = new Map();
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
export function runAudit(dossierDir, templateDir, passes) {
    const contact = basename(dossierDir);
    const templateName = basename(templateDir);
    // Always initialize all finding arrays
    const findings = {
        misplaced: [],
        stale: [],
        duplicates: [],
        ordering: [],
        missing: [],
    };
    const routingTable = buildRoutingTable(templateDir);
    // Build dossier heading map: file -> set of headings
    const dossierHeadings = new Map();
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
            }
            else {
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
        const fm = parseFrontmatter(indexPath);
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
        const allSections = [];
        for (const relPath of dossierMdFiles) {
            const sections = extractSections(join(dossierDir, relPath));
            for (const [heading, lines] of sections) {
                if (lines.length > 0) {
                    allSections.push({ heading, file: relPath, lines });
                }
            }
        }
        let dupCount = 0;
        const seen = new Set();
        for (let i = 0; i < allSections.length; i++) {
            for (let j = i + 1; j < allSections.length; j++) {
                const a = allSections[i];
                const b = allSections[j];
                const pairKey = `${a.file}:${a.heading}|${b.file}:${b.heading}`;
                if (seen.has(pairKey))
                    continue;
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
                        priority: 'MODERATE',
                    });
                }
            }
        }
    }
    // ── Ordering pass ─────────────────────────────────────────────
    if (passes.includes('ordering')) {
        // Build per-file ordering from routing table
        const templateFileOrder = new Map();
        for (const [heading, file] of routingTable) {
            if (!templateFileOrder.has(file)) {
                templateFileOrder.set(file, []);
            }
            templateFileOrder.get(file).push(heading);
        }
        let ordCount = 0;
        for (const [relPath, headings] of dossierHeadings) {
            const templateOrder = templateFileOrder.get(relPath);
            if (!templateOrder)
                continue;
            // Filter dossier headings to only those that exist in the template for this file
            const dossierList = [];
            const headingArr = Array.from(headings);
            // Preserve document order by re-extracting from file
            const docHeadings = extractHeadings(join(dossierDir, relPath));
            for (const h of docHeadings) {
                if (templateOrder.includes(h)) {
                    dossierList.push(h);
                }
            }
            // Map each dossier heading to its index in the template order
            const templateIndex = (h) => templateOrder.indexOf(h);
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
    const totalFindings = findings.missing.length +
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
//# sourceMappingURL=audit.js.map