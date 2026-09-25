/**
 * Organization dossier taxonomy — org types, roles, asset classes, and
 * helpers for dossier codes (`[orgType]-[CID]-[SEQ]`) and folder names.
 */

export const ORG_TYPES = {
  REIT: 'Public REIT',
  INV: 'Private equity RE fund / GP / investment manager',
  LP: 'Allocator (pension, sovereign, endowment, insurer, family office)',
  OPR: 'Operating partner / third-party property manager',
  DEV: 'Developer',
  LND: 'Lender / debt fund / servicer',
  BRK: 'Brokerage',
  SAAS: 'Proptech software vendor',
  DATA: 'RE data provider',
  SVC: 'Fund admin / accounting / consulting services',
} as const;

export type OrgType = keyof typeof ORG_TYPES;

export const ORG_ROLES = [
  'Client', 'Prospect', 'IntegrationPartner', 'ChannelPartner', 'Competitor',
  'OperatingPartner', 'Investor', 'Lender', 'Employer', 'TalentTarget',
] as const;

export type OrgRole = typeof ORG_ROLES[number];

export const ASSET_CLASSES = [
  'MF', 'SFR', 'OFF', 'IND', 'RET', 'DC', 'LS', 'SEN', 'SS', 'HOS', 'LAND', 'MIX',
] as const;

/** Roles that add an overlay file from ORGANIZATION/ROLES/<dir>/. */
export const ROLE_OVERLAYS: Partial<Record<OrgRole, string>> = {
  Competitor: 'COMPETITOR',
  IntegrationPartner: 'PARTNER',
  ChannelPartner: 'PARTNER',
};

/** Context marker for derived person→org `works_at` edges (re-derived on every index). */
export const AUTO_WORKS_AT_CONTEXT = 'auto: organization field';

export function normalizeOrgType(input: string): OrgType | null {
  const upper = input.trim().toUpperCase();
  return upper in ORG_TYPES ? (upper as OrgType) : null;
}

function asciiWords(name: string): string[] {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/** Default CID: initials of a multi-word name, else first 4 letters. Max 6 chars. */
export function generateCid(name: string): string {
  const words = asciiWords(name);
  if (words.length >= 2) return words.map(w => w[0]).join('').toUpperCase().slice(0, 6);
  return (words[0] ?? '').slice(0, 4).toUpperCase();
}

export function isValidCid(cid: string): boolean {
  return /^[A-Z0-9.]{2,6}$/.test(cid);
}

export function orgFolderName(orgType: OrgType, name: string): string {
  return `${orgType}_${asciiWords(name).join('_')}`;
}
