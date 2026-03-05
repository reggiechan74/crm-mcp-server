import { describe, it, expect } from 'vitest';
import { PROFESSIONS, lookupProfession, searchProfessions } from '../src/professions.js';

describe('PROFESSIONS registry', () => {
  it('contains exactly 139 entries', () => {
    expect(Object.keys(PROFESSIONS).length).toBe(167);
  });

  it('has all unique 3-letter uppercase codes', () => {
    const codes = Object.keys(PROFESSIONS);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);

    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('each entry code matches its key', () => {
    for (const [key, entry] of Object.entries(PROFESSIONS)) {
      expect(entry.code).toBe(key);
    }
  });

  it('all entries have required fields', () => {
    for (const entry of Object.values(PROFESSIONS)) {
      expect(entry.name).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.categoryLetter).toMatch(/^[A-R]$/);
      expect(entry.templateDir).toBeTruthy();
      expect(entry.trackingFile).toMatch(/\.md$/);
    }
  });

  it('covers all 18 category letters', () => {
    const letters = new Set(Object.values(PROFESSIONS).map((p) => p.categoryLetter));
    expect(letters.size).toBe(18);
  });
});

describe('lookupProfession', () => {
  it('returns entry for valid code', () => {
    const entry = lookupProfession('BSB');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Sales Broker/Agent');
    expect(entry!.category).toBe('Brokerage & Sales');
  });

  it('is case-insensitive', () => {
    expect(lookupProfession('bsb')).toBeDefined();
    expect(lookupProfession('Bsb')).toBeDefined();
  });

  it('returns undefined for invalid code', () => {
    expect(lookupProfession('ZZZ')).toBeUndefined();
  });
});

describe('searchProfessions', () => {
  it('finds by partial name', () => {
    const results = searchProfessions('Broker');
    expect(results.length).toBeGreaterThan(3);
    expect(results.some((r) => r.code === 'BSB')).toBe(true);
  });

  it('finds by category name', () => {
    const results = searchProfessions('Valuation');
    expect(results.length).toBe(8);
    expect(results.every((r) => r.categoryLetter === 'B')).toBe(true);
  });

  it('is case-insensitive', () => {
    const results = searchProfessions('MORTGAGE');
    expect(results.some((r) => r.code === 'FMB')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    expect(searchProfessions('xyznonexistent')).toEqual([]);
  });
});
