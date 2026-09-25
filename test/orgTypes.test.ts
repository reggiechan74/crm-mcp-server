import { describe, it, expect } from 'vitest';
import {
  ORG_TYPES, ORG_ROLES, ROLE_OVERLAYS, normalizeOrgType,
  generateCid, isValidCid, orgFolderName,
} from '../src/orgTypes.js';
import { CATEGORY_DIRS, CATEGORY_CODES, RELATION_TYPES } from '../src/types.js';

describe('org taxonomy', () => {
  it('defines the 10 org types', () => {
    expect(Object.keys(ORG_TYPES)).toEqual(
      ['REIT', 'INV', 'LP', 'OPR', 'DEV', 'LND', 'BRK', 'SAAS', 'DATA', 'SVC'],
    );
  });

  it('defines the 10 roles', () => {
    expect(ORG_ROLES).toEqual([
      'Client', 'Prospect', 'IntegrationPartner', 'ChannelPartner', 'Competitor',
      'OperatingPartner', 'Investor', 'Lender', 'Employer', 'TalentTarget',
    ]);
  });

  it('maps overlay roles to overlay dirs', () => {
    expect(ROLE_OVERLAYS.Competitor).toBe('COMPETITOR');
    expect(ROLE_OVERLAYS.IntegrationPartner).toBe('PARTNER');
    expect(ROLE_OVERLAYS.ChannelPartner).toBe('PARTNER');
    expect(ROLE_OVERLAYS.Client).toBeUndefined();
  });

  it('normalizes orgType case-insensitively', () => {
    expect(normalizeOrgType('opr')).toBe('OPR');
    expect(normalizeOrgType('SaaS')).toBe('SAAS');
    expect(normalizeOrgType('XYZ')).toBeNull();
  });
});

describe('generateCid', () => {
  it('uses initials for multi-word names', () => {
    expect(generateCid('Oxford Properties Group')).toBe('OPG');
  });
  it('uses first 4 letters for single-word names', () => {
    expect(generateCid('Cherre')).toBe('CHER');
  });
  it('strips accents and punctuation', () => {
    expect(generateCid('Ivanhoé Cambridge')).toBe('IC');
    expect(generateCid('Grosvenor & Co.')).toBe('GC');
  });
  it('caps at 6 chars', () => {
    expect(generateCid('A B C D E F G H')).toBe('ABCDEF');
  });
});

describe('isValidCid', () => {
  it('accepts tickers and dotted subsidiaries', () => {
    expect(isValidCid('PLD')).toBe(true);
    expect(isValidCid('AMZN.A')).toBe(true);
  });
  it('rejects too short, too long, lowercase, symbols', () => {
    expect(isValidCid('X')).toBe(false);
    expect(isValidCid('ABCDEFG')).toBe(false);
    expect(isValidCid('abc')).toBe(false);
    expect(isValidCid('A&B')).toBe(false);
  });
});

describe('orgFolderName', () => {
  it('builds [TYPE]_[Name] with safe chars only', () => {
    expect(orgFolderName('OPR', 'Oxford Properties')).toBe('OPR_Oxford_Properties');
    expect(orgFolderName('INV', 'Grosvenor & Co.')).toBe('INV_Grosvenor_Co');
    expect(orgFolderName('INV', 'Ivanhoé Cambridge')).toBe('INV_Ivanhoe_Cambridge');
  });
});

describe('types', () => {
  it('registers Organization category', () => {
    expect(CATEGORY_DIRS.Organization).toBe('Organizations');
    expect(CATEGORY_CODES.OR).toBe('Organization');
  });
  it('includes org relation types and keeps legacy ones', () => {
    for (const t of ['operating_partner_of', 'lp_in', 'gp_of', 'parent_of', 'subsidiary_of',
      'integrates_with', 'competes_with', 'acquired_by', 'employs', 'works_at', 'associated', 'colleague']) {
      expect(RELATION_TYPES).toContain(t);
    }
  });
});
