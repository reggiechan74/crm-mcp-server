import { type Store } from './store.js';
import { type Config } from './types.js';
/**
 * Split text into overlapping chunks suitable for embedding.
 *
 * Splitting priority:
 *   1. Markdown heading boundaries (### or ####)
 *   2. Paragraph breaks (double newline)
 *   3. Sentence boundaries (". " pattern)
 *   4. Hard character limit (~4 chars per token)
 *
 * Each chunk overlaps with the previous by `overlapTokens` worth of characters.
 */
export declare function chunkText(text: string, maxTokens?: number, overlapTokens?: number): string[];
/**
 * Cosine similarity between two vectors.
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * Generate embeddings for all indexed content.
 * Reads from content_cache, chunks text, embeds each chunk,
 * and stores results in the embeddings table.
 */
export declare function generateEmbeddings(store: Store, config: Config): Promise<{
    indexed: number;
    skipped: number;
}>;
/**
 * Semantic vector search across all embedded dossier content.
 */
export declare function vectorSearch(store: Store, config: Config, query: string, limit?: number): Promise<Array<{
    contactId: string;
    contactName: string;
    section: string;
    chunk: string;
    score: number;
}>>;
