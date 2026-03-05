import { type Store } from './store.js';
import { type Config } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

async function getEmbedder(model: string): Promise<any> {
  if (!embedder) {
    // Dynamic import to avoid loading transformers.js until needed
    const { pipeline } = await import('@huggingface/transformers');
    // Use q8 quantization for EmbeddingGemma (fp16 not supported by this model)
    const isGemma = model.toLowerCase().includes('gemma');
    embedder = await pipeline('feature-extraction', model, isGemma ? { dtype: 'q8' } : {});
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
 * Ensure the embeddings table exists in the database.
 */
function ensureEmbeddingsTable(store: Store): void {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY,
      contact_id TEXT,
      section TEXT,
      chunk_index INTEGER,
      chunk_text TEXT,
      embedding BLOB,
      UNIQUE(contact_id, section, chunk_index)
    );
  `);
}

/**
 * Generate embeddings for all indexed content.
 * Reads from content_cache, chunks text, embeds each chunk,
 * and stores results in the embeddings table.
 */
export async function generateEmbeddings(
  store: Store,
  config: Config,
): Promise<{ indexed: number; skipped: number }> {
  const model = config.embeddingModel || 'Xenova/all-MiniLM-L6-v2';
  const pipe = await getEmbedder(model);

  ensureEmbeddingsTable(store);

  // Clear existing embeddings
  store.db.exec('DELETE FROM embeddings');

  const insertStmt = store.db.prepare(`
    INSERT OR REPLACE INTO embeddings (contact_id, section, chunk_index, chunk_text, embedding)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Get all content from cache
  const rows = store.db
    .prepare('SELECT contact_id, section, cleaned_content FROM content_cache')
    .all() as Array<{ contact_id: string; section: string; cleaned_content: string }>;

  let indexed = 0;
  let skipped = 0;

  for (const row of rows) {
    const content = row.cleaned_content?.trim();
    if (!content || content.length === 0) {
      skipped++;
      continue;
    }

    const chunks = chunkText(content);
    if (chunks.length === 0) {
      skipped++;
      continue;
    }

    for (let i = 0; i < chunks.length; i++) {
      const output = await pipe(chunks[i], { pooling: 'mean', normalize: true });
      // output.data is a Float32Array (or similar typed array)
      const embedding = new Float32Array(output.data);
      const buffer = Buffer.from(embedding.buffer);

      insertStmt.run(row.contact_id, row.section, i, chunks[i], buffer);
      indexed++;
    }
  }

  return { indexed, skipped };
}

/**
 * Semantic vector search across all embedded dossier content.
 */
export async function vectorSearch(
  store: Store,
  config: Config,
  query: string,
  limit = 5,
): Promise<Array<{ contactId: string; contactName: string; section: string; chunk: string; score: number }>> {
  const model = config.embeddingModel || 'Xenova/all-MiniLM-L6-v2';
  const pipe = await getEmbedder(model);

  ensureEmbeddingsTable(store);

  // Embed the query
  const queryOutput = await pipe(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = new Float32Array(queryOutput.data);

  // Load all embeddings
  const rows = store.db
    .prepare(`
      SELECT e.contact_id, e.section, e.chunk_text, e.embedding, c.name as contact_name
      FROM embeddings e
      JOIN contacts c ON c.id = e.contact_id
    `)
    .all() as Array<{
      contact_id: string;
      section: string;
      chunk_text: string;
      embedding: Buffer;
      contact_name: string;
    }>;

  if (rows.length === 0) return [];

  // Compute cosine similarity for each
  const scored = rows.map((row) => {
    const embedding = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4,
    );
    return {
      contactId: row.contact_id,
      contactName: row.contact_name,
      section: row.section,
      chunk: row.chunk_text,
      score: cosineSimilarity(queryEmbedding, embedding),
    };
  });

  // Sort by score descending and return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
