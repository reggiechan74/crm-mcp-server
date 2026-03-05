export type Category = 'Adversary' | 'Advisor' | 'Client' | 'Colleague' | 'Family' | 'Mentor' | 'Network' | 'Personal' | 'Prospect';
export declare const CATEGORY_CODES: Record<string, Category>;
export declare const CATEGORY_DIRS: Record<Category, string>;
export type RelationType = 'reports_to' | 'manages' | 'colleague' | 'spouse' | 'parent' | 'child' | 'sibling' | 'in_law' | 'friend' | 'mentor' | 'mentee' | 'introduced_by' | 'client_of' | 'advisor_to' | 'adversary_of' | 'partner' | 'associated';
export interface Contact {
    id: string;
    name: string;
    category: Category;
    organization: string | null;
    status: string;
    lastContact: string | null;
    lastUpdated: string;
    path: string;
    metadataJson: string;
    profession?: string;
}
export interface SectionMeta {
    file: string;
    sizeBytes: number;
    filledBytes: number;
    fillPercent: number;
    lastUpdated: string | null;
}
export interface Relationship {
    sourceId: string;
    targetId: string;
    targetName: string;
    type: RelationType;
    context: string;
    bidirectional: boolean;
}
export interface SearchResult {
    id: string;
    name: string;
    category: Category;
    organization: string | null;
    status: string;
    lastContact: string | null;
    score?: number;
    snippet?: string;
}
export interface Config {
    crmRoot: string;
    dbPath: string;
    embeddingModel: string;
    templates: string[];
    defaultTemplate: string;
    templateRepo: string;
    githubToken?: string;
}
export declare const DOSSIER_SECTIONS: readonly ["index", "profile", "log", "intelligence-profile", "intelligence-strategic", "intelligence-risk", "medical", "medical-genetics", "medical-pharmacogenomics", "medical-labs", "education"];
export type DossierSection = typeof DOSSIER_SECTIONS[number];
export declare const SECTION_FILES: Record<DossierSection, string>;
/**
 * Resolve a section name to its file path.
 * Accepts any format: "index", "INDEX.md", "intelligence-profile", "intelligence/intelligence-profile.md"
 * Known sections use the SECTION_FILES map; unknown sections (e.g. profession-specific
 * tracking files like "deals", "assignments") fall back to `${section}.md`.
 */
export declare function resolveSectionFile(section: string): string;
