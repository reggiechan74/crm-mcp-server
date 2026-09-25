import { type Store, type NewEmbedding } from './store.js';
import { type Config } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;
let embedderModel: string | null = null;

async function getEmbedder(model: string): Promise<any> {
  if (!embedder || embedderModel !== model) {
    // Dynamic import to avoid loading transformers.js until needed
    const { pipeline } = await import('@huggingface/transformers');
    // Use q8 quantization for EmbeddingGemma (fp16 not supported by this model)
    const isGemma = model.toLowerCase().includes('gemma');
    embedder = await pipeline('feature-extraction', model, isGemma ? { dtype: 'q8' } : {});
    embedderModel = model;
  }
  return embedder;
}

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
export function chunkText(
  text: string,
  maxTokens = 200,
  overlapTokens = 30,
): string[] {
  if (!text || text.trim().length === 0) return [];

  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);

    if (end < text.length) {
      // Try heading boundary first
      const window = text.slice(offset, end);
      const headingMatch = findLastHeadingBoundary(window);
      if (headingMatch !== -1 && headingMatch > maxChars * 0.3) {
        end = offset + headingMatch;
      } else {
        // Try paragraph boundary
        const paraMatch = window.lastIndexOf('\n\n');
        if (paraMatch !== -1 && paraMatch > maxChars * 0.3) {
          end = offset + paraMatch;
        } else {
          // Try sentence boundary
          const sentenceMatch = findLastSentenceBoundary(window);
          if (sentenceMatch !== -1 && sentenceMatch > maxChars * 0.3) {
            end = offset + sentenceMatch;
          }
          // else: hard cut at maxChars
        }
      }
    }

    const chunk = text.slice(offset, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Advance with overlap
    const advance = end - offset;
    if (advance <= 0) {
      // Safety: always advance at least 1 char
      offset = end + 1;
    } else {
      offset = end - overlapChars;
      if (offset <= (chunks.length > 1 ? end - advance : 0)) {
        // Prevent going backwards
        offset = end;
      }
    }

    // If we're near the end and overlap would create a tiny chunk, just stop
    if (text.length - offset < overlapChars && chunks.length > 0) {
      // Append remaining to last chunk if it's small
      const remaining = text.slice(offset).trim();
      if (remaining.length > 0 && remaining.length < overlapChars) {
        // Already covered by overlap in last chunk
        break;
      }
    }
  }

  return chunks;
}

/**
 * Find the last markdown heading boundary (### or ####) in a string.
 * Returns the index of the newline before the heading, or -1.
 */
function findLastHeadingBoundary(text: string): number {
  const pattern = /\n(#{3,4}\s)/g;
  let lastIndex = -1;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}

/**
 * Find the last sentence boundary (". " or ".\n") in a string.
 * Returns the index after the period, or -1.
 */
function findLastSentenceBoundary(text: string): number {
  // Look for ". " or ".\n" patterns
  const pattern = /\.\s/g;
  let lastIndex = -1;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    lastIndex = match.index + 1; // Include the period
  }
  return lastIndex;
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Generate embeddings for all indexed content.
 * Reads cleaned section content from the store, chunks it, embeds each chunk,
 * and replaces the stored embeddings (tagged with the model and each
 * section's content hash) in a single transaction.
 */
export async function generateEmbeddings(
  store: Store,
  config: Config,
): Promise<{ indexed: number; skipped: number }> {
  const model = config.embeddingModel;
  const pipe = await getEmbedder(model);

  const rows: NewEmbedding[] = [];
  let skipped = 0;

  for (const section of store.getSectionContents()) {
    const chunks = chunkText(section.content.trim());
    if (chunks.length === 0) {
      skipped++;
      continue;
    }
    for (let i = 0; i < chunks.length; i++) {
      const output = await pipe(chunks[i], { pooling: 'mean', normalize: true });
      rows.push({
        contactId: section.contactId,
        section: section.section,
        chunkIndex: i,
        chunkText: chunks[i],
        embedding: Buffer.from(new Float32Array(output.data).buffer),
        fileHash: section.fileHash,
      });
    }
  }

  store.replaceEmbeddings(model, rows);
  return { indexed: rows.length, skipped };
}

export interface VectorSearchResult {
  results: Array<{ contactId: string; contactName: string; section: string; chunk: string; score: number }>;
  /** Number of embedded sections whose content changed since `crm-mcp embed` ran. */
  staleSections: number;
}

/**
 * Semantic vector search across all embedded dossier content.
 * Throws when the stored embeddings came from a different model than the
 * one configured — vectors from two models are not comparable.
 */
export async function vectorSearch(
  store: Store,
  config: Config,
  query: string,
  limit = 5,
): Promise<VectorSearchResult> {
  const stored = store.getEmbeddings();
  if (stored.length === 0) return { results: [], staleSections: 0 };

  const model = config.embeddingModel;
  const storedModel = store.getEmbeddingModel();
  if (storedModel && storedModel !== model) {
    throw new Error(
      `Embeddings were generated with "${storedModel}" but the configured model is "${model}". Re-run 'crm-mcp embed'.`,
    );
  }

  const pipe = await getEmbedder(model);
  const queryOutput = await pipe(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = new Float32Array(queryOutput.data);

  const staleSections = new Set(stored.filter(r => r.stale).map(r => `${r.contactId}\0${r.section}`)).size;

  const scored = stored.map((row) => {
    const embedding = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4,
    );
    return {
      contactId: row.contactId,
      contactName: row.contactName,
      section: row.section,
      chunk: row.chunkText,
      score: cosineSimilarity(queryEmbedding, embedding),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, limit), staleSections };
}
