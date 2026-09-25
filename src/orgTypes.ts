/**
 * Organization dossier taxonomy — org types, roles, asset classes, and
 * helpers for dossier codes (`[orgType]-[CID]-[SEQ]`) and folder names.
 */

import { join } from 'node:path';
import type { SalesMotion } from './types.js';

/**
 * Organization type registry — groups of real-estate organization types.
 * Each group (except OTHER) adds one overlay directory under
 * ORGANIZATION/TYPES/ whose single file is `overlay.file`.
 */
export const ORG_GROUPS = {
  OWNERS: {
    label: 'Owners & Investors',
    overlay: { dir: 'OWNERS', file: 'portfolio.md' },
    types: {
      REIT: 'Public REIT',
      PRVT: 'Private / non-traded REIT',
      REOC: 'Real estate operating company',
      INV: 'Investment manager / fund GP',
      LP: 'Institutional allocator (pension, sovereign, endowment, insurer GA)',
      FO: 'Family office / private investor',
      SYN: 'Syndicator / crowdfunding sponsor',
    },
  },
  LENDING: {
    label: 'Lending & Capital',
    overlay: { dir: 'LENDING', file: 'lending.md' },
    types: {
      BANK: 'Bank / credit union lender',
      DEBT: 'Debt fund / private lender',
      AGCY: 'Agency lender (DUS, HUD)',
      LIFE: 'Life company lender',
      SVCR: 'Loan servicer / special servicer',
    },
  },
  BROKERAGE: {
    label: 'Brokerage & Advisory',
    overlay: { dir: 'BROKERAGE', file: 'deal-flow.md' },
    types: {
      BRK: 'Commercial brokerage',
      CAP: 'Capital markets advisory (debt/equity placement)',
      TREP: 'Tenant representation firm',
      RES: 'Residential brokerage',
    },
  },
  DEVELOPMENT: {
    label: 'Development & Construction',
    overlay: { dir: 'DEVELOPMENT', file: 'projects.md' },
    types: {
      DEV: 'Developer',
      HB: 'Homebuilder',
      GC: 'General contractor / construction manager',
      ARCH: 'Architecture / planning firm',
      ENG: 'Engineering firm',
    },
  },
  OPERATORS: {
    label: 'Operators & Management',
    overlay: { dir: 'OPERATORS', file: 'managed-portfolio.md' },
    types: {
      PM: 'Third-party property manager',
      OPR: 'Operating partner (JV)',
      FM: 'Facilities management',
      HOSP: 'Hospitality operator / brand',
      SNR: 'Senior housing operator',
      FLEX: 'Coworking / flex operator',
    },
  },
  SERVICES: {
    label: 'Professional Services',
    overlay: { dir: 'SERVICES', file: 'engagements.md' },
    types: {
      LAW: 'Law firm',
      TTL: 'Title / escrow',
      VAL: 'Appraisal / valuation',
      ACCT: 'Accounting / fund administration',
      CONS: 'Consulting / research',
      ENV: 'Environmental / property condition',
      INS: 'Insurance broker / carrier',
    },
  },
  OCCUPIERS: {
    label: 'Occupiers',
    overlay: { dir: 'OCCUPIERS', file: 'occupancy.md' },
    types: {
      CORP: 'Corporate occupier',
      RTL: 'Retailer / tenant',
    },
  },
  PUBLIC: {
    label: 'Public Sector & Nonprofit',
    overlay: { dir: 'PUBLIC', file: 'programs.md' },
    types: {
      GOV: 'Government / municipality / agency',
      HA: 'Housing authority',
      NPO: 'Nonprofit / CDFI',
    },
  },
  TECHNOLOGY: {
    label: 'Technology & Data',
    overlay: { dir: 'TECHNOLOGY', file: 'product.md' },
    types: {
      SAAS: 'Proptech software',
      DATA: 'Data provider',
      BTEC: 'Building technology / IoT',
    },
  },
  ASSOCIATIONS: {
    label: 'Industry Bodies',
    overlay: { dir: 'ASSOCIATIONS', file: 'membership.md' },
    types: {
      ASSN: 'Association / trade organization',
    },
  },
  OTHER: {
    label: 'Other',
    overlay: null,
    types: {
      OTH: 'Other organization',
    },
  },
} as const satisfies Record<string, {
  label: string;
  overlay: { dir: string; file: string } | null;
  types: Record<string, string>;
}>;

export type OrgGroup = keyof typeof ORG_GROUPS;
type TypesOf<G extends OrgGroup> = keyof (typeof ORG_GROUPS)[G]['types'];
export type OrgType = { [G in OrgGroup]: TypesOf<G> }[OrgGroup] & string;

export const ORG_GROUP_KEYS = Object.keys(ORG_GROUPS) as [OrgGroup, ...OrgGroup[]];

export const ORG_TYPES = Object.fromEntries(
  ORG_GROUP_KEYS.flatMap((group) =>
    Object.entries(ORG_GROUPS[group].types).map(([code, label]) => [code, { label, group }])),
) as Record<OrgType, { label: string; group: OrgGroup }>;

export const ORG_TYPE_CODES = Object.keys(ORG_TYPES) as [OrgType, ...OrgType[]];

export const ORG_ROLES = [
  'Client', 'Prospect', 'IntegrationPartner', 'ChannelPartner', 'Competitor',
  'OperatingPartner', 'Investor', 'Lender', 'Employer', 'TalentTarget',
  'Landlord', 'Tenant', 'Borrower', 'JVPartner', 'CoInvestor', 'Vendor',
  'ServiceProvider', 'ReferralSource', 'Regulator',
] as const;

export type OrgRole = typeof ORG_ROLES[number];

/** Roles that add an overlay directory from ORGANIZATION/ROLES/<dir>/. */
export const ROLE_OVERLAYS: Partial<Record<OrgRole, string>> = {
  Competitor: 'COMPETITOR',
  IntegrationPartner: 'PARTNER',
  ChannelPartner: 'PARTNER',
  Vendor: 'VENDOR',
  ServiceProvider: 'VENDOR',
};

/** Canonical type code for any casing/padding of a known code, else null. */
export function normalizeOrgType(input: string): OrgType | null {
  const upper = input.trim().toUpperCase();
  return Object.hasOwn(ORG_TYPES, upper) ? (upper as OrgType) : null;
}

/** Canonical role spelling for any casing/padding of a known role, else null. */
export function normalizeOrgRole(input: string): OrgRole | null {
  const needle = input.trim().toLowerCase();
  return ORG_ROLES.find((r) => r.toLowerCase() === needle) ?? null;
}

/** Canonical group key for any casing/padding of a known group, else null. */
export function normalizeOrgGroup(input: string): OrgGroup | null {
  const upper = input.trim().toUpperCase();
  return Object.hasOwn(ORG_GROUPS, upper) ? (upper as OrgGroup) : null;
}

export function groupOf(code: string): OrgGroup | null {
  const t = normalizeOrgType(code);
  return t ? ORG_TYPES[t].group : null;
}

/** One line per group — used in validation errors. */
export function formatOrgTypeChoices(): string {
  return ORG_GROUP_KEYS
    .map((g) => `${ORG_GROUPS[g].label}: ${Object.keys(ORG_GROUPS[g].types).join(', ')}`)
    .join('\n');
}

/**
 * Parse a list of type codes (array, or comma-separated string), normalize,
 * dedupe, and drop `primary`. Throws listing every unknown code.
 */
export function normalizeOrgTypeList(input: unknown, primary?: string): OrgType[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string' ? input.split(',') : [];
  const items = raw.map((s) => s.trim()).filter(Boolean);
  const bad = items.filter((s) => !normalizeOrgType(s));
  if (bad.length > 0) {
    throw new Error(`Invalid org type(s): ${bad.join(', ')}. Valid:\n${formatOrgTypeChoices()}`);
  }
  const primaryCode = primary ? normalizeOrgType(primary) : null;
  const out: OrgType[] = [];
  for (const s of items) {
    const code = normalizeOrgType(s)!;
    if (code !== primaryCode && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Human-readable catalog for the crm_org_types tool. */
export function formatOrgTypeCatalog(group?: string): string {
  let keys: OrgGroup[] = ORG_GROUP_KEYS;
  if (group) {
    const key = group.trim().toUpperCase();
    if (!Object.hasOwn(ORG_GROUPS, key)) {
      throw new Error(`Invalid org group: ${group}. Valid: ${ORG_GROUP_KEYS.join(', ')}`);
    }
    keys = [key as OrgGroup];
  }
  const lines: string[] = [];
  for (const key of keys) {
    const g = ORG_GROUPS[key];
    lines.push(`## ${g.label} (${key}) — ${g.overlay ? `adds ${g.overlay.file}` : 'no extra file'}`);
    for (const [code, label] of Object.entries(g.types)) lines.push(`- ${code} — ${label}`);
    lines.push('');
  }
  if (!group) {
    const byOverlay = new Map<string, string[]>();
    for (const [role, dir] of Object.entries(ROLE_OVERLAYS)) {
      byOverlay.set(dir!, [...(byOverlay.get(dir!) ?? []), role]);
    }
    const overlayFile: Record<string, string> = { COMPETITOR: 'competitive.md', PARTNER: 'partnership.md', VENDOR: 'vendor.md' };
    lines.push('## Roles');
    lines.push(ORG_ROLES.join(', '));
    for (const [dir, roles] of byOverlay) lines.push(`- ${roles.join(', ')} → ${overlayFile[dir] ?? dir}`);
    lines.push('');
    lines.push('## Sales motion');
    lines.push('- tech — adds tech-stack.md and the SaaS pipeline (POC → Security Review → MSA). Set "salesMotion": "tech" in ~/.crm-mcp.json, or pass techSale to crm_create.');
  }
  return lines.join('\n').trimEnd();
}

export interface OrgLayerSpec {
  orgType: string;
  secondaryTypes?: string[];
  roles?: string[];
  salesMotion?: SalesMotion;
}

/**
 * Ordered template directories for an organization dossier:
 * COMMON → primary group overlay → secondary group overlays → role overlays
 * → MOTION/TECH_SALE. Each directory appears once; unknown codes and roles
 * are skipped. Pure path logic — callers check existence.
 */
export function orgTemplateLayers(orgRoot: string, spec: OrgLayerSpec): string[] {
  const dirs = [join(orgRoot, 'COMMON')];
  const add = (dir: string) => { if (!dirs.includes(dir)) dirs.push(dir); };
  for (const code of [spec.orgType, ...(spec.secondaryTypes ?? [])]) {
    const group = groupOf(String(code));
    const overlay = group ? ORG_GROUPS[group].overlay : null;
    if (overlay) add(join(orgRoot, 'TYPES', overlay.dir));
  }
  for (const role of spec.roles ?? []) {
    const canonical = normalizeOrgRole(String(role));
    const overlay = canonical ? ROLE_OVERLAYS[canonical] : undefined;
    if (overlay) add(join(orgRoot, 'ROLES', overlay));
  }
  if (spec.salesMotion === 'tech') add(join(orgRoot, 'MOTION', 'TECH_SALE'));
  return dirs;
}

export const ASSET_CLASSES = [
  'MF', 'SFR', 'OFF', 'IND', 'RET', 'DC', 'LS', 'SEN', 'SS', 'HOS', 'LAND', 'MIX',
] as const;

/** Context marker for derived person→org `works_at` edges (re-derived on every index). */
export const AUTO_WORKS_AT_CONTEXT = 'auto: organization field';

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
