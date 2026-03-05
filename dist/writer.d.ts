import type { Store } from './store.js';
export interface LogEntry {
    date: string;
    type: string;
    summary: string;
    outcome?: string;
    nextStep?: string;
}
/**
 * Append a new interaction row to a contact's log.md.
 */
export declare function appendLog(store: Store, contactId: string, entry: LogEntry): void;
/**
 * Update a specific YAML frontmatter field in a dossier section file.
 */
export declare function updateField(store: Store, contactId: string, section: string, field: string, value: string): void;
export interface CreateDossierInput {
    name: string;
    category: string;
    organization?: string;
    context?: string;
    template?: string;
    profession?: string;
}
export interface CreateDossierResult {
    id: string;
    path: string;
}
/**
 * Generate F3L3 code from a full name.
 * Rules:
 *   - Simple (First Last): first 3 chars of each, uppercase
 *   - Hyphenated surname: first 3 of first name + first 3 of first part of surname
 *   - Short name (< 3 chars): use available chars
 * Always uppercase, accents removed.
 */
export declare function generateF3L3(fullName: string): string;
/**
 * Create a new contact dossier from template.
 */
export declare function createDossier(store: Store, crmRoot: string, input: CreateDossierInput): CreateDossierResult;
