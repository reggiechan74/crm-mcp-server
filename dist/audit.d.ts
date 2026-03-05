/**
 * Audit engine — routing table and compliance pass.
 *
 * Extensible: each audit pass is a standalone function that takes
 * routing table + dossier headings and returns typed findings.
 * Tasks 8/9 will add misplaced, stale, duplicates, and ordering passes.
 */
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
/**
 * Build a routing table from a template directory.
 *
 * Reads every .md file under `templateDir`, extracts headings (## - ####),
 * and maps each heading string to its relative file path.
 * H1 headings are ignored — they are document titles, not sections.
 */
export declare function buildRoutingTable(templateDir: string): Map<string, string>;
/**
 * Run specified audit passes against a dossier directory.
 *
 * Currently supports: compliance.
 * Future passes (misplaced, stale, duplicates, ordering) will be added
 * in Tasks 8 and 9.
 */
export declare function runAudit(dossierDir: string, templateDir: string, passes: AuditPass[]): AuditResult;
