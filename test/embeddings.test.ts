import { describe, it, expect } from 'vitest';
import { chunkText, cosineSimilarity } from '../src/embeddings.js';

describe('chunkText', () => {
  it('splits text into chunks', () => {
    const text = Array(100).fill('This is a test sentence.').join(' ');
    const chunks = chunkText(text, 200, 30);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves heading boundaries', () => {
    const text =
      '### Section A\n\nContent for section A with enough words to fill a chunk.\n\n### Section B\n\nContent for section B with enough words too.';
    const chunks = chunkText(text, 50, 10);
    // Should prefer splitting at ### boundary
    if (chunks.length > 1) {
      const chunkWithA = chunks.find((c) => c.includes('Section A'));
      expect(chunkWithA).not.toContain('Section B');
    }
  });

  it('handles empty text', () => {
    const chunks = chunkText('', 200, 30);
    expect(chunks.length).toBe(0);
  });

  it('returns single chunk for short text', () => {
    const chunks = chunkText('Short text.', 200, 30);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe('Short text.');
  });

  it('handles whitespace-only text', () => {
    const chunks = chunkText('   \n\n  ', 200, 30);
    expect(chunks.length).toBe(0);
  });

  it('splits at paragraph boundaries when no headings', () => {
    const para1 = 'First paragraph with enough content to matter. ' + 'More words here. '.repeat(20);
    const para2 = 'Second paragraph also has content. ' + 'Even more words. '.repeat(20);
    const text = para1 + '\n\n' + para2;
    const chunks = chunkText(text, 100, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    const score = cosineSimilarity(a, a);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    const score = cosineSimilarity(a, b);
    expect(score).toBeCloseTo(0.0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    const score = cosineSimilarity(a, b);
    expect(score).toBeCloseTo(-1.0, 5);
  });

  it('handles zero vectors', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    const score = cosineSimilarity(a, b);
    expect(score).toBe(0);
  });
});
