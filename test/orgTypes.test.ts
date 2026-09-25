import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  ORG_GROUPS, ORG_GROUP_KEYS, ORG_TYPES, ORG_TYPE_CODES, ORG_ROLES, ROLE_OVERLAYS,
  normalizeOrgType, groupOf, normalizeOrgTypeList, formatOrgTypeChoices, orgTemplateLayers,
  generateCid, isValidCid, orgFolderName, formatOrgTypeCatalog,
} from '../src/orgTypes.js';
import { CATEGORY_DIRS, CATEGORY_CODES, RELATION_TYPES } from '../src/types.js';
import { PROFESSIONS } from '../src/professions.js';

describe('org taxonomy', () => {
  it('defines the 11 groups in order', () => {
    expect(ORG_GROUP_KEYS).toEqual(['OWNERS', 'LENDING', 'BROKERAGE', 'DEVELOPMENT', 'OPERATORS',
      'SERVICES', 'OCCUPIERS', 'PUBLIC', 'TECHNOLOGY', 'ASSOCIATIONS', 'OTHER']);
  });

  it('defines exactly the 44 type codes', () => {
    expect([...ORG_TYPE_CODES].sort()).toEqual([
      'ACCT', 'AGCY', 'ARCH', 'ASSN', 'BANK', 'BRK', 'BTEC', 'CAP', 'CONS', 'CORP', 'DATA', 'DEBT',
      'DEV', 'ENG', 'ENV', 'FLEX', 'FM', 'FO', 'GC', 'GOV', 'HA', 'HB', 'HOSP', 'INS', 'INV', 'LAW',
      'LIFE', 'LP', 'NPO', 'OPR', 'OTH', 'PM', 'PRVT', 'REIT', 'REOC', 'RES', 'RTL', 'SAAS', 'SNR',
      'SVCR', 'SYN', 'TREP', 'TTL', 'VAL',
    ]);
  });

  it('every code is 2-4 upper-case letters and belongs to exactly one group', () => {
    const seen = new Map<string, string>();
    for (const [group, g] of Object.entries(ORG_GROUPS)) {
      for (const code of Object.keys(g.types)) {
        expect(code).toMatch(/^[A-Z]{2,4}$/);
        expect(seen.has(code), `${code} in ${seen.get(code)} and ${group}`).toBe(false);
        seen.set(code, group);
        expect(ORG_TYPES[code as keyof typeof ORG_TYPES].group).toBe(group);
      }
    }
    expect(seen.size).toBe(44);
  });

  it('no type code collides with a person category or profession code', () => {
    for (const code of ORG_TYPE_CODES) {
      expect(code in CATEGORY_CODES, code).toBe(false);
      expect(code in PROFESSIONS, code).toBe(false);
    }
  });

  it('only OTHER has no overlay', () => {
    for (const key of ORG_GROUP_KEYS) {
      expect(ORG_GROUPS[key].overlay === null, key).toBe(key === 'OTHER');
    }
    expect(ORG_GROUPS.OTHER.types).toEqual({ OTH: 'Other organization' });
  });

  it('defines the 19 roles, existing first', () => {
    expect(ORG_ROLES).toEqual([
      'Client', 'Prospect', 'IntegrationPartner', 'ChannelPartner', 'Competitor',
      'OperatingPartner', 'Investor', 'Lender', 'Employer', 'TalentTarget',
      'Landlord', 'Tenant', 'Borrower', 'JVPartner', 'CoInvestor', 'Vendor',
      'ServiceProvider', 'ReferralSource', 'Regulator',
    ]);
  });

  it('maps overlay roles to overlay dirs', () => {
    expect(ROLE_OVERLAYS.Competitor).toBe('COMPETITOR');
    expect(ROLE_OVERLAYS.IntegrationPartner).toBe('PARTNER');
    expect(ROLE_OVERLAYS.ChannelPartner).toBe('PARTNER');
    expect(ROLE_OVERLAYS.Vendor).toBe('VENDOR');
    expect(ROLE_OVERLAYS.ServiceProvider).toBe('VENDOR');
    expect(ROLE_OVERLAYS.Client).toBeUndefined();
  });

  it('normalizes orgType case- and whitespace-insensitively', () => {
    expect(normalizeOrgType(' opr ')).toBe('OPR');
    expect(normalizeOrgType('SaaS')).toBe('SAAS');
    expect(normalizeOrgType('LND')).toBeNull();
    expect(normalizeOrgType('XYZ')).toBeNull();
    expect(groupOf('debt')).toBe('LENDING');
    expect(groupOf('nope')).toBeNull();
  });

  it('normalizeOrgTypeList parses, dedupes and drops the primary', () => {
    expect(normalizeOrgTypeList(['pm', 'INV', 'pm', 'BRK'], 'BRK')).toEqual(['PM', 'INV']);
    expect(normalizeOrgTypeList('pm, inv', 'BRK')).toEqual(['PM', 'INV']);
    expect(normalizeOrgTypeList(undefined)).toEqual([]);
    expect(() => normalizeOrgTypeList(['PM', 'LND'])).toThrow(/Invalid org type\(s\): LND\. Valid:/);
  });

  it('formatOrgTypeChoices lists every group with its codes', () => {
    const text = formatOrgTypeChoices();
    expect(text).toContain('Lending & Capital: BANK, DEBT, AGCY, LIFE, SVCR');
    expect(text.split('\n')).toHaveLength(11);
  });

  it('orgTemplateLayers orders COMMON, groups, roles, motion — each once', () => {
    const root = '/t';
    expect(orgTemplateLayers(root, {
      orgType: 'BRK', secondaryTypes: ['CAP', 'PM', 'INV', 'pm'], roles: ['Vendor', 'ServiceProvider', 'Competitor'],
      salesMotion: 'tech',
    })).toEqual([
      join(root, 'COMMON'),
      join(root, 'TYPES', 'BROKERAGE'),
      join(root, 'TYPES', 'OPERATORS'),
      join(root, 'TYPES', 'OWNERS'),
      join(root, 'ROLES', 'VENDOR'),
      join(root, 'ROLES', 'COMPETITOR'),
      join(root, 'MOTION', 'TECH_SALE'),
    ]);
    expect(orgTemplateLayers(root, { orgType: 'OTH' })).toEqual([join(root, 'COMMON')]);
    expect(orgTemplateLayers(root, { orgType: 'LND', roles: ['Nope'] })).toEqual([join(root, 'COMMON')]);
  });
});

describe('formatOrgTypeCatalog', () => {
  it('lists every group, its overlay file, types, roles and the tech-sale motion', () => {
    const text = formatOrgTypeCatalog();
    expect(text).toContain('## Lending & Capital (LENDING) — adds lending.md');
    expect(text).toContain('- DEBT — Debt fund / private lender');
    expect(text).toContain('## Other (OTHER) — no extra file');
    expect(text).toContain('Vendor, ServiceProvider → vendor.md');
    expect(text).toContain('tech-stack.md');
  });

  it('filters to one group', () => {
    const text = formatOrgTypeCatalog('lending');
    expect(text).toContain('BANK');
    expect(text).not.toContain('REIT');
    expect(() => formatOrgTypeCatalog('NOPE')).toThrow(/Invalid org group/);
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
