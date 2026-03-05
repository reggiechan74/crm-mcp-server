export interface ManifestEntry {
    version: string;
    installedAt: string;
    updatedAt: string;
    source: 'bundled' | 'github' | 'unknown';
    contentHash: string;
    categories?: string[];
}
export interface Manifest {
    schemaVersion: number;
    installedAt: string;
    templates: Record<string, ManifestEntry>;
}
export interface TemplateInfo {
    name: string;
    version: string;
    description: string;
    sections?: string[];
    professions?: Record<string, string>;
}
export interface LocalTemplateStatus {
    name: string;
    version: string;
    source: ManifestEntry['source'];
    customized: boolean;
    categories?: string[];
}
export declare function getBundledTemplatesDir(): string;
/**
 * Compute a deterministic SHA-256 hash of all files in a directory.
 * Files are sorted alphabetically by relative path, then concatenated as:
 *   relativePath + \0 + fileContent
 */
export declare function computeContentHash(dirPath: string): string;
export declare function readManifest(crmRoot: string): Manifest | null;
export declare function writeManifest(crmRoot: string, manifest: Manifest): void;
/**
 * Auto-generate a manifest for an existing .templates/ directory that lacks one.
 * Reads template.json from each subdirectory and computes content hashes.
 */
export declare function migrateManifest(crmRoot: string): Manifest;
/**
 * Ensure manifest exists. If missing, auto-migrate from existing .templates/ or create empty.
 */
export declare function ensureManifest(crmRoot: string): Manifest;
/**
 * Check if a locally installed template has been customized (content differs from manifest hash).
 */
export declare function isCustomized(crmRoot: string, templateName: string, manifest: Manifest): boolean;
/**
 * List all locally installed templates with their status.
 */
export declare function listLocalTemplates(crmRoot: string): LocalTemplateStatus[];
/**
 * Read template.json metadata from a template directory.
 */
export declare function readTemplateInfo(templateDir: string): TemplateInfo | null;
export interface InstallOptions {
    crmRoot: string;
    templateName: string;
    sourceDir: string;
    source: ManifestEntry['source'];
    category?: string;
}
/**
 * Install a template from a source directory into .templates/.
 * For composite templates with a category, also copies COMMON/ and template.json.
 */
export declare function installTemplate(opts: InstallOptions): void;
/**
 * Install selected bundled templates during init.
 * Returns the manifest with all installed templates recorded.
 */
export declare function installBundledTemplates(crmRoot: string, templateNames: string[]): Manifest;
/**
 * Count files in a directory recursively.
 */
export declare function countFiles(dirPath: string): number;
/**
 * Get total size of a directory in bytes.
 */
export declare function dirSize(dirPath: string): number;
