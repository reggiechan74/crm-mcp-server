export interface RemoteTemplate {
    name: string;
    version: string;
    description: string;
    categories?: string[];
}
/**
 * List available templates from the GitHub repo.
 * Uses a 1-hour cache to avoid excessive API calls.
 */
export declare function listRemoteTemplates(repo: string, crmRoot: string, token?: string): Promise<RemoteTemplate[]>;
/**
 * Download the repo tarball and extract a specific template directory.
 * For composite templates with a category, extracts COMMON + template.json + category.
 */
export declare function downloadTemplate(repo: string, templateName: string, destDir: string, token?: string, category?: string): Promise<void>;
