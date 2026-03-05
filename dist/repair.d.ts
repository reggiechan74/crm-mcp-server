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
import { AuditResult } from './audit.js';
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
export declare function runRepair(dossierDir: string, templateDir: string, audit: AuditResult, fixCodes: string[]): RepairResult;
