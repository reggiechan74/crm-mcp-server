import { type Database } from './db.js';
import { type Contact, type SectionMeta, type Relationship, type SearchResult } from './types.js';
export interface Store {
    db: Database;
    crmRoot: string;
    indexAll(): void;
    indexOne(dossierRelPath: string): void;
    searchContacts(filters: {
        query?: string;
        category?: string;
        status?: string;
        profession?: string;
        limit?: number;
    }): SearchResult[];
    fullTextSearch(query: string, limit?: number): Array<SearchResult & {
        section: string;
        snippet: string;
    }>;
    getOutline(contactId: string): {
        contact: Contact;
        sections: SectionMeta[];
    };
    getSection(contactId: string, section: string): string;
    getConnections(contactId: string, depth?: number): Relationship[];
    getRecent(limit?: number, category?: string): SearchResult[];
    getStats(): {
        totalContacts: number;
        byCategory: Record<string, number>;
        staleContacts: number;
        avgFillPercent: number;
    };
    getContactPath(contactId: string): string | null;
    close(): void;
}
export declare function createStore(dbPath: string, crmRoot: string): Store;
