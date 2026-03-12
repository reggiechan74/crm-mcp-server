import type { Contact, SectionMeta, Relationship } from './types.js';
/**
 * Read INDEX.md from a dossier directory and extract contact metadata.
 */
export declare function parseIndexYaml(dossierPath: string): Contact;
/**
 * Strip boilerplate/placeholder content from dossier markdown.
 * Removes placeholder lines, empty table rows, template blockquotes,
 * and entire sections where all content is placeholder.
 */
export declare function stripBoilerplate(content: string): string;
/**
 * Recursively collect all .md files under a directory,
 * returning paths relative to the root directory.
 */
export declare function collectMdFiles(dir: string, root?: string): string[];
/**
 * Scan a dossier directory and return metadata for each existing section file.
 * Discovers all .md files recursively — both standard sections and custom files.
 */
export declare function scanDossierSections(dossierPath: string): SectionMeta[];
/**
 * Extract relationship entries from INDEX.md linkedContacts YAML field.
 */
export declare function extractRelationships(dossierPath: string, contactId: string): Relationship[];
