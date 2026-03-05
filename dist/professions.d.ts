/**
 * RE-CRM Profession Taxonomy — 167 real estate profession types across 18 categories.
 *
 * Each entry maps a unique 3-letter profession code to metadata used for
 * dossier code generation, template resolution, and profession-specific tracking.
 */
export interface ProfessionEntry {
    code: string;
    name: string;
    category: string;
    categoryLetter: string;
    templateDir: string;
    trackingFile: string;
}
export declare const PROFESSIONS: Record<string, ProfessionEntry>;
/**
 * Look up a profession entry by its 3-letter code.
 */
export declare function lookupProfession(code: string): ProfessionEntry | undefined;
/**
 * Search professions by partial name match (case-insensitive).
 */
export declare function searchProfessions(query: string): ProfessionEntry[];
