# Organization Type Taxonomy & Type-Aware Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10-code, SaaS-slanted organization taxonomy with a grouped real-estate-wide taxonomy (primary + secondary types), tailor org dossiers with per-group template overlays on a neutral core, keep the SaaS-seller content as an opt-in "tech-sale" motion, broaden roles, and make audit/repair understand the layered template.

**Architecture:** A code registry in `src/orgTypes.ts` (groups → types → overlay) is the single source of truth. `orgTemplateLayers()` turns an org's `orgType`/`secondaryTypes`/`roles`/`salesMotion` into an ordered list of template directories (COMMON → group overlays → role overlays → motion); creation copies them in order and audit builds a layered routing table from the same list. Tools expose the registry as enum choices and a new `crm_org_types` catalog tool.

**Tech Stack:** TypeScript (ESM), Node ≥ 22.5 (`node:sqlite`), `@modelcontextprotocol/sdk` 1.27 `registerTool`, zod v4, `yaml` Document API, vitest 3, esbuild.

**Spec:** `docs/superpowers/specs/2026-09-25-org-type-taxonomy-design.md`

## Global Constraints

- Node `>=22.5.0`; no new runtime dependencies.
- Type codes: 2–4 uppercase letters, unique across the registry, exactly the 44 codes in the spec §3 table (43 + `OTH`). Senior housing operator is `SNR` (not `SEN`).
- Group keys exactly: `OWNERS, LENDING, BROKERAGE, DEVELOPMENT, OPERATORS, SERVICES, OCCUPIERS, PUBLIC, TECHNOLOGY, ASSOCIATIONS, OTHER`.
- Roles: the existing 10 in their current order, followed by `Landlord, Tenant, Borrower, JVPartner, CoInvestor, Vendor, ServiceProvider, ReferralSource, Regulator`.
- `salesMotion` values: `general` (default) and `tech` only. Env override `CRM_SALES_MOTION`.
- COMMON template files must not contain (case-insensitive): `POC`, `Security Review`, `MSA`, `Order Form`, `Buying Committee`, `Systems of Record`, `Data Maturity`, `Technology Buying`.
- Overlays only add files; the only permitted replacement of a COMMON file is `MOTION/TECH_SALE/pipeline.md`.
- Dossier codes and folders are never renamed after creation.
- Test temp dirs via `makeTempDir()` from `test/helpers/tmp.ts` (never raw `mkdtempSync`).
- Every commit ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After each task: `npx tsc --noEmit -p .` clean and `npx vitest run` green before committing.

## Review Focus

1. A secondary type equal to the primary, repeated, or in the primary's own group (e.g. `BRK` + `[CAP, brk, CAP]`) — expect each overlay copied once and the primary dropped from `secondaryTypes`. Test: Task 3 Step 1 (`dedupes secondary types`).
2. Lower-case or padded codes (`" pm "`, `debt`) passed to `crm_create` or `crm_update` — expect normalization to upper-case codes, not a rejection. Tests: Task 3 Step 1 (`normalizes type codes`), Task 4 Step 1 (`crm_update normalizes orgType`).
3. A CRM whose installed `ORGANIZATION` templates predate `TYPES/` — expect creation to succeed with COMMON and return a warning naming `crm-mcp templates pull REAL_ESTATE/ORGANIZATION`. Test: Task 3 Step 1 (`warns when an overlay is not installed`).
4. A hand-edited INDEX.md with `secondaryTypes: PM, brk` (a string, not a list) — expect search by `orgType`/`orgGroup` to still match and results to show `(+PM, BRK)`. Test: Task 4 Step 1 (`handles scalar secondaryTypes`).
5. A dossier whose `orgType` is unknown (e.g. legacy `LND`) — expect audit/repair to fall back to COMMON only, never crash. Test: Task 6 Step 1 (`unknown orgType audits against COMMON`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/types.ts` | Add `SalesMotion`, `SALES_MOTIONS`, `Config.salesMotion` | 1 |
| `src/orgTypes.ts` | Registry: groups, types, roles, overlays, `normalizeOrgType`, `groupOf`, `orgTemplateLayers`, `normalizeOrgTypeList`, `formatOrgTypeChoices`, `formatOrgTypeCatalog` | 1, 5 |
| `templates/REAL_ESTATE/ORGANIZATION/**` | Neutral COMMON, 10 group overlays, VENDOR role overlay, TECH_SALE motion | 2 |
| `src/writer.ts` | Layered org creation, warnings, `secondaryTypes`/`salesMotion` fields, validation in `updateField` | 3, 4 |
| `src/parser.ts` | Normalize `orgType`/`secondaryTypes`/`roles` in indexed metadata | 4 |
| `src/store.ts` | `orgType` matches secondary, `orgGroup` filter, shared filter builder | 4 |
| `src/config.ts` | `salesMotion` loading + validation | 5 |
| `src/server.ts` | Enum schemas, `techSale`, `orgGroup`, `crm_org_types`, update note, display | 5 |
| `src/audit.ts`, `src/repair.ts`, `src/maintenance.ts` | Layered routing table, missing-file creation from template, `resolveTemplateDirs` | 6 |
| `README.md`, `CHANGELOG.md`, `test/integration.test.ts` | Docs and end-to-end scenario | 7 |

---

### Task 1: Taxonomy registry and roles

**Files:**
- Modify: `src/types.ts` (Config + SalesMotion)
- Modify: `src/orgTypes.ts` (replace `ORG_TYPES`, extend roles/overlays, add helpers)
- Modify: `src/writer.ts:~478` (error message uses new helper — the only existing consumer of `ORG_TYPES` keys)
- Test: `test/orgTypes.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (all exported from `src/orgTypes.ts`):
  - `ORG_GROUPS: Record<OrgGroup, { label: string; overlay: { dir: string; file: string } | null; types: Record<string, string> }>`
  - `type OrgGroup` (the 11 keys), `type OrgType` (the 44 codes), `ORG_GROUP_KEYS: [OrgGroup, ...OrgGroup[]]`, `ORG_TYPE_CODES: [OrgType, ...OrgType[]]`
  - `ORG_TYPES: Record<OrgType, { label: string; group: OrgGroup }>`
  - `normalizeOrgType(input: string): OrgType | null` (trim + upper-case)
  - `groupOf(code: string): OrgGroup | null`
  - `normalizeOrgTypeList(input: unknown, primary?: string): OrgType[]` — accepts array or comma string; normalizes, dedupes, drops `primary`; throws `Invalid org type(s): X. Valid: …` on unknown codes
  - `formatOrgTypeChoices(): string` — one line per group: `Lending & Capital: BANK, DEBT, AGCY, LIFE, SVCR`
  - `ORG_ROLES` (19), `type OrgRole`, `ROLE_OVERLAYS` (adds `Vendor`/`ServiceProvider → 'VENDOR'`)
  - `orgTemplateLayers(orgRoot: string, spec: OrgLayerSpec): string[]`, `interface OrgLayerSpec { orgType: string; secondaryTypes?: string[]; roles?: string[]; salesMotion?: SalesMotion }`
  - From `src/types.ts`: `type SalesMotion = 'general' | 'tech'`, `SALES_MOTIONS`, `Config.salesMotion?: SalesMotion`

- [ ] **Step 1: Write the failing tests** — replace the `org taxonomy` describe block at the top of `test/orgTypes.test.ts` (keep the `generateCid` and later blocks) with:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  ORG_GROUPS, ORG_GROUP_KEYS, ORG_TYPES, ORG_TYPE_CODES, ORG_ROLES, ROLE_OVERLAYS,
  normalizeOrgType, groupOf, normalizeOrgTypeList, formatOrgTypeChoices, orgTemplateLayers,
  generateCid, isValidCid, orgFolderName,
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
```

Also check that `PROFESSIONS` is the exported name in `src/professions.ts` (`grep -n "export const" src/professions.ts`); if it is named differently, import that name instead.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/orgTypes.test.ts`
Expected: FAIL — `ORG_GROUPS` / `normalizeOrgTypeList` / `orgTemplateLayers` not exported.

- [ ] **Step 3: Add `SalesMotion` to `src/types.ts`** — insert above `export interface Config`, and add the field to `Config`:

```ts
export const SALES_MOTIONS = ['general', 'tech'] as const;
/** How the user sells to organizations: `tech` adds the SaaS-sale template layer. */
export type SalesMotion = typeof SALES_MOTIONS[number];
```

```ts
  githubToken?: string;      // optional GitHub token for private repos / rate limits
  salesMotion?: SalesMotion; // 'general' (default) | 'tech' — adds the tech-sale org template layer
```

- [ ] **Step 4: Replace the taxonomy in `src/orgTypes.ts`** — replace everything from `export const ORG_TYPES = {` through the `normalizeOrgType` function (keep the file header comment, `ASSET_CLASSES`, `AUTO_WORKS_AT_CONTEXT`, `asciiWords`, `generateCid`, `isValidCid`, `orgFolderName`) with:

```ts
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
    const overlay = ROLE_OVERLAYS[role as OrgRole];
    if (overlay) add(join(orgRoot, 'ROLES', overlay));
  }
  if (spec.salesMotion === 'tech') add(join(orgRoot, 'MOTION', 'TECH_SALE'));
  return dirs;
}
```

Keep the existing import-free helpers below it unchanged. Move the `import { join } …` and `import type { SalesMotion } …` lines to the top of the file.

- [ ] **Step 5: Update the one existing consumer of the old `ORG_TYPES` shape** — in `src/writer.ts` `createOrgDossier`, replace:

```ts
    throw new Error(`Organization requires a valid orgType. Valid: ${Object.keys(ORG_TYPES).join(', ')}`);
```
with
```ts
    throw new Error(`Organization requires a valid orgType. Valid:\n${formatOrgTypeChoices()}`);
```
and in the writer's `orgTypes.js` import replace `ORG_TYPES,` with `formatOrgTypeChoices,`. Also update the `orgType?:` comment on `CreateDossierInput` to `// Organization only: a code from ORG_TYPES (see crm_org_types)`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx tsc --noEmit -p . && npx vitest run test/orgTypes.test.ts`
Expected: PASS. Then `npx vitest run` — expect failures ONLY in tests that create orgs with the old template layout (`writer.test.ts` org block, `orgTemplates.test.ts`); these are fixed in Tasks 2–3. Record the list of failing test names in the commit message body.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/orgTypes.ts src/writer.ts test/orgTypes.test.ts
git commit -m "feat: grouped real-estate org type registry, expanded roles, template layer order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Neutral COMMON and overlay templates

**Files:**
- Modify: `templates/REAL_ESTATE/ORGANIZATION/COMMON/{INDEX,profile,stakeholders,intelligence,pipeline,log}.md`
- Delete: `templates/REAL_ESTATE/ORGANIZATION/COMMON/portfolio.md`
- Create: `templates/REAL_ESTATE/ORGANIZATION/TYPES/<GROUP>/<file>` × 10, `ROLES/VENDOR/vendor.md`, `MOTION/TECH_SALE/{tech-stack,pipeline}.md`
- Test: `test/orgTemplates.test.ts` (rewrite)

**Interfaces:**
- Consumes: `ORG_GROUPS`, `ORG_GROUP_KEYS`, `ROLE_OVERLAYS` (Task 1).
- Produces: the template tree in spec §5; every file has frontmatter with `dossierCode`; headings (H2–H4) unique across all ORGANIZATION files except between same-named files (`pipeline.md`).

- [ ] **Step 1: Rewrite `test/orgTemplates.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { join, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { ORG_GROUPS, ORG_GROUP_KEYS, ROLE_OVERLAYS } from '../src/orgTypes.js';

const ORG = join(import.meta.dirname, '..', 'templates', 'REAL_ESTATE', 'ORGANIZATION');
const COMMON_FILES = ['INDEX.md', 'profile.md', 'intelligence.md', 'stakeholders.md', 'pipeline.md', 'log.md'];

function mdFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(e.parentPath, e.name));
}

function frontmatter(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf-8')
    .replace(/\{\{date\}\}/g, '2026-09-24')
    .replace(/\{\{\w+\}\}/g, 'X');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  expect(m, `${path} has frontmatter`).not.toBeNull();
  return parseYaml(m![1]);
}

/** Overlay dirs: TYPES/*, ROLES/*, MOTION/* */
function overlayDirs(): string[] {
  return ['TYPES', 'ROLES', 'MOTION'].flatMap((kind) =>
    readdirSync(join(ORG, kind), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(ORG, kind, e.name)));
}

describe('ORGANIZATION templates', () => {
  it('ships exactly the COMMON files (portfolio moved to OWNERS)', () => {
    expect(readdirSync(join(ORG, 'COMMON')).sort()).toEqual([...COMMON_FILES].sort());
  });

  it('ships one overlay per group with the registered file', () => {
    for (const key of ORG_GROUP_KEYS) {
      const overlay = ORG_GROUPS[key].overlay;
      if (!overlay) continue;
      expect(readdirSync(join(ORG, 'TYPES', overlay.dir)), key).toEqual([overlay.file]);
    }
  });

  it('ships role and motion overlays', () => {
    for (const dir of new Set(Object.values(ROLE_OVERLAYS))) {
      expect(existsSync(join(ORG, 'ROLES', dir!)), dir).toBe(true);
    }
    expect(readdirSync(join(ORG, 'ROLES', 'VENDOR'))).toEqual(['vendor.md']);
    expect(readdirSync(join(ORG, 'MOTION', 'TECH_SALE')).sort()).toEqual(['pipeline.md', 'tech-stack.md']);
  });

  it('overlays only add files — the one allowed replacement is TECH_SALE pipeline.md', () => {
    const owner = new Map<string, string>();
    for (const dir of overlayDirs()) {
      for (const f of readdirSync(dir)) {
        expect(owner.has(f), `${f} shipped by ${owner.get(f)} and ${relative(ORG, dir)}`).toBe(false);
        owner.set(f, relative(ORG, dir));
        if (COMMON_FILES.includes(f)) expect(`${relative(ORG, dir)}/${f}`).toBe('MOTION/TECH_SALE/pipeline.md');
      }
    }
  });

  it('INDEX.md frontmatter parses and has org fields', () => {
    const y = frontmatter(join(ORG, 'COMMON', 'INDEX.md'));
    expect(y.category).toBe('Organization');
    expect(y.roles).toEqual([]);
    expect(y.secondaryTypes).toEqual([]);
    expect(y.salesMotion).toBe('general');
    expect(y.aliases).toEqual([]);
    expect(y.linkedContacts).toEqual([]);
    expect(y.confidentiality).toEqual([]);
    expect(y).toHaveProperty('orgType');
    expect(y).toHaveProperty('dossierCode');
  });

  it('every file has parseable frontmatter with dossierCode', () => {
    for (const f of mdFiles(ORG)) expect(frontmatter(f), f).toHaveProperty('dossierCode');
  });

  it('COMMON carries no SaaS-seller vocabulary', () => {
    const banned = ['POC', 'Security Review', 'MSA', 'Order Form', 'Buying Committee',
      'Systems of Record', 'Data Maturity', 'Technology Buying'];
    for (const f of COMMON_FILES) {
      const text = readFileSync(join(ORG, 'COMMON', f), 'utf-8');
      for (const term of banned) {
        expect(new RegExp(`\\b${term}\\b`, 'i').test(text), `${f} contains "${term}"`).toBe(false);
      }
    }
  });

  it('TECH_SALE keeps the SaaS content', () => {
    const tech = readFileSync(join(ORG, 'MOTION', 'TECH_SALE', 'tech-stack.md'), 'utf-8');
    for (const h of ['SYSTEMS OF RECORD', 'DATA MATURITY', 'TECHNOLOGY BUYING BEHAVIOR', 'BUYING COMMITTEE']) {
      expect(tech).toContain(h);
    }
    expect(readFileSync(join(ORG, 'MOTION', 'TECH_SALE', 'pipeline.md'), 'utf-8')).toContain('Security Review');
  });

  it('headings are unique across files (audit routes by heading)', () => {
    const where = new Map<string, string>();
    for (const f of mdFiles(ORG)) {
      const name = f.split('/').pop()!;
      for (const line of readFileSync(f, 'utf-8').split('\n')) {
        if (!/^#{2,4}\s+/.test(line)) continue;
        const h = line.trimEnd();
        const prev = where.get(h);
        if (prev && prev.split('/').pop() !== name) {
          throw new Error(`Heading "${h}" in both ${relative(ORG, prev)} and ${relative(ORG, f)}`);
        }
        where.set(h, f);
      }
    }
  });

  it('pipeline files and competitive overlay carry the confidentiality rule', () => {
    for (const f of [join(ORG, 'COMMON', 'pipeline.md'), join(ORG, 'MOTION', 'TECH_SALE', 'pipeline.md'),
      join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md')]) {
      expect(readFileSync(f, 'utf-8')).toContain('Never record one client');
    }
  });

  it('log.md document registry is type-neutral', () => {
    expect(readFileSync(join(ORG, 'COMMON', 'log.md'), 'utf-8'))
      .toContain('[NDA / LOI / PSA / Lease / Loan Docs / Engagement Letter / Contract]');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/orgTemplates.test.ts`
Expected: FAIL (no `TYPES/`, COMMON has `portfolio.md`, SaaS terms present).

- [ ] **Step 3: Move SaaS content into MOTION/TECH_SALE** (do this BEFORE editing COMMON so nothing is lost)

```bash
cd templates/REAL_ESTATE/ORGANIZATION
mkdir -p MOTION/TECH_SALE ROLES/VENDOR TYPES/{OWNERS,LENDING,BROKERAGE,DEVELOPMENT,OPERATORS,SERVICES,OCCUPIERS,PUBLIC,TECHNOLOGY,ASSOCIATIONS}
git mv COMMON/pipeline.md MOTION/TECH_SALE/pipeline.md
git rm -q COMMON/portfolio.md
cd -
```

`MOTION/TECH_SALE/pipeline.md` keeps its current content unchanged (it already has the SaaS stages and the confidentiality line).

Create `MOTION/TECH_SALE/tech-stack.md`:

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: tech-stack
lastUpdated: {{date}}
---

# {{name}} - Tech Stack & Buying Process

## I. SYSTEMS OF RECORD

| Category | Vendor | Module | Renewal | Satisfaction | Conf |
|----------|--------|--------|---------|--------------|------|
| Property Management | [Yardi / MRI / RealPage / Entrata / AppFolio] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Lease Admin | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Accounting / GL | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| IR / Investor Portal | [Juniper Square / Agora] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Valuation / Underwriting | [ARGUS] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Deal Pipeline | [Dealpath] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Leasing | [VTS] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Market Data | [CoStar / Green Street] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Data Warehouse / BI | [Snowflake / Databricks / Power BI] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. DATA MATURITY

| Field | Value | Conf |
|-------|-------|------|
| Data Team (size, reports to) | [TO BE POPULATED] | [V/I/A] |
| Current Integration Method | [Spreadsheets / In-house ETL / Vendor] | [V/I/A] |
| Data Quality Pain Points | [TO BE POPULATED] | [V/I/A] |
| Sources to Unify | [TO BE POPULATED] | [V/I/A] |

## III. TECHNOLOGY BUYING BEHAVIOR

| Dimension | Assessment | Conf |
|-----------|------------|------|
| Central IT vs Business-Unit Buying | [TO BE POPULATED] | [V/I/A] |
| Build vs Buy | [TO BE POPULATED] | [V/I/A] |
| Adoption Pattern | [Early / Mainstream / Laggard] | [V/I/A] |
| InfoSec Review Timeline | [TO BE POPULATED] | [V/I/A] |
| Procurement Timeline | [TO BE POPULATED] | [V/I/A] |

## IV. BUYING COMMITTEE

| Role | Name | Title | Stance | Dossier |
|------|------|-------|--------|---------|
| Economic Buyer (CIO / COO / CFO) | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Technical Buyer (CTO / Head of Data) | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| User: Asset Mgmt | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| User: Portfolio Mgmt | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| User: Investor Reporting | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| User: Fund Accounting | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Gatekeeper: InfoSec | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Gatekeeper: Procurement / Legal | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
```

- [ ] **Step 4: Neutralize COMMON**

`COMMON/INDEX.md` — replace the whole file with:

```markdown
---
name: "{{name}}"
dossierCode: "{{dossierCode}}"
category: Organization
orgType: "{{orgType}}"
secondaryTypes: []
assetClasses: []
roles: []
salesMotion: general
accountTier: T3
aliases: []
parentOrg: ""
relationshipOwner: ""
linkedContacts: []
confidentiality: []
status: Active
tier: index
lastUpdated: {{date}}
templateVersion: "2.0"
---

# {{name}} - Quick Reference

> Tag every value: [V] verified · [I] inferred · [A] assumed.

## SNAPSHOT

| Field | Value | Conf |
|-------|-------|------|
| **Org Type** | {{orgType}} | [V] |
| **Also Operates As** | [TO BE POPULATED] | [V/I/A] |
| **HQ** | [TO BE POPULATED] | [V/I/A] |
| **Size (AUM / revenue / portfolio)** | [TO BE POPULATED] | [V/I/A] |
| **Headcount** | [TO BE POPULATED] | [V/I/A] |
| **Parent** | [TO BE POPULATED] | [V/I/A] |
| **Context** | {{context}} | [V] |

## ROLE SUMMARY

| Role | Status | So What |
|------|--------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## RELATIONSHIP HEALTH

| Metric | Value | Conf |
|--------|-------|------|
| Relationship Stage | [Cold / Warm / Active / Strategic] | [V/I/A] |
| Strength (1-10) | [TO BE POPULATED] | [V/I/A] |
| Last Meaningful Touch | [TO BE POPULATED] | [V/I/A] |
| Business Value to Date | [TO BE POPULATED] | [V/I/A] |
| Key Date (renewal / expiry / closing) | [TO BE POPULATED] | [V/I/A] |

## NEXT ACTION

| Action | Due | Owner |
|--------|-----|-------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## RED FLAGS

- None identified

---
*Load stakeholders.md for meeting prep, pipeline.md for commercial status, and the type file (e.g. lending.md, deal-flow.md) for business detail*
```

`COMMON/profile.md` — replace section II (from `## II. OWNERSHIP & CAPITAL` through the Fund Family table) with the block below, and in section IV replace `[NCREIF / PREA / NAREIT / ULI]` with `[e.g. ULI / NAIOP / BOMA / CREFC / NAREIT]`:

```markdown
## II. OWNERSHIP

| Field | Value | Conf |
|-------|-------|------|
| Public / Private | [TO BE POPULATED] | [V/I/A] |
| Parent | [TO BE POPULATED] | [V/I/A] |
| Major Shareholders / Sponsors | [TO BE POPULATED] | [V/I/A] |
| Capital Sources | [TO BE POPULATED] | [V/I/A] |
```

`COMMON/stakeholders.md` — replace the whole `## II. BUYING COMMITTEE` section (heading and table) with:

```markdown
## II. KEY DECISION MAKERS

| Role | Name | Title | Stance | Dossier |
|------|------|-------|--------|---------|
| Executive Sponsor / Final Decision | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Day-to-Day Lead | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Influencer | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
| Gatekeeper (Legal / Procurement / Compliance) | [TO BE POPULATED] | [TO BE POPULATED] | [Champion / Supporter / Neutral / Blocker] | [TO BE POPULATED] |
```

`COMMON/intelligence.md` — replace everything after the `# {{name}} - Intelligence` heading with:

```markdown
## I. STRATEGY SIGNALS

| Stated (Public) | Revealed (Actions) | Implication for Us | Conf |
|-----------------|--------------------|--------------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. PRIORITIES & PAIN POINTS

| Priority / Pain Point | Confirmed / Inferred | Relevance to Us | Evidence |
|-----------------------|---------------------|-----------------|----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. RISKS

### A. Relationship Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| [Key contact departure / Consolidation / Budget freeze] | [TO BE POPULATED] | [TO BE POPULATED] |

### B. Company Viability Risks

| Risk | Signal | Conf |
|------|--------|------|
| [Liquidity / Leadership change / M&A / Litigation] | [TO BE POPULATED] | [V/I/A] |

## IV. INTELLIGENCE GAPS & SOURCES

| Gap / Source | Reliability | Next Step |
|--------------|-------------|-----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

Create the neutral `COMMON/pipeline.md`:

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: pipeline
lastUpdated: {{date}}
---

# {{name}} - Pipeline

> Never record one client's pricing, rent, or operational data in another client's or a competitor's dossier. Note the source relationship in INDEX.md `confidentiality`.

## I. RELATIONSHIP SUMMARY

| Field | Value | Conf |
|-------|-------|------|
| Relationship Since | [TO BE POPULATED] | [V/I/A] |
| Business to Date | [TO BE POPULATED] | [V/I/A] |
| Current Engagements | [TO BE POPULATED] | [V/I/A] |
| Key Terms / Renewal Date | [TO BE POPULATED] | [V/I/A] |
| Satisfaction | [TO BE POPULATED] | [V/I/A] |

## II. ACTIVE OPPORTUNITIES

Stages: Identified → Qualified → Proposal → Negotiation → Won / Lost

| Opportunity | Type | Value | Stage | Champion | Blocker | Competition | Next Step |
|-------------|------|-------|-------|----------|---------|-------------|-----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. STAGE HISTORY

| Date | Opportunity | From | To | Trigger |
|------|-------------|------|----|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. CLOSED WON / LOST

Loss reasons: PRICE · FIT · TIMING · COMPETITOR · RELATIONSHIP · NO_DECISION · WITHDRAWN

| Date | Opportunity | Outcome | Value | Reason | Lesson |
|------|-------------|---------|-------|--------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Won / Lost] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. EXPANSION

| Motion | Target | Path | Status |
|--------|--------|------|--------|
| Repeat Business | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Adjacent Service / Market | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Referral Path (via linked organizations) | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

Note: `COMMON/pipeline.md` and `MOTION/TECH_SALE/pipeline.md` share headings `## II. ACTIVE OPPORTUNITIES`, `## III. STAGE HISTORY`, `## IV. CLOSED WON / LOST`, `## V. EXPANSION` — allowed (same file name). The TECH_SALE file's first section is `## I. ACCOUNT SUMMARY`.

`COMMON/log.md` — replace `[NDA / MSA / SOW / Security Questionnaire / Order Form]` with `[NDA / LOI / PSA / Lease / Loan Docs / Engagement Letter / Contract]`, and replace the sentence `This table must stay last in the file (crm_log appends after the last table).` with `crm_log appends new rows to this table.`

- [ ] **Step 5: Create the group overlays.** Each file starts with this frontmatter (substitute `<tier>` with the file's base name without `.md`):

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: <tier>
lastUpdated: {{date}}
---
```

`TYPES/OWNERS/portfolio.md` (tier `portfolio`):

```markdown
# {{name}} - Portfolio & Investment Strategy

## I. HOLDINGS

| Asset Class | Market(s) | Assets / Units / SF | Trajectory | Conf |
|-------------|-----------|---------------------|------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Growing / Stable / Selling Down] | [V/I/A] |

## II. FUND VEHICLES

| Fund | Vintage | Size | Strategy | Stage | Conf |
|------|---------|------|----------|-------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Core / Value-Add / Opportunistic / Debt] | [Fundraising / Deploying / Harvesting] | [V/I/A] |

## III. INVESTMENT STRATEGY & BUY BOX

| Field | Value | Conf |
|-------|-------|------|
| Target Asset Classes | [TO BE POPULATED] | [V/I/A] |
| Target Markets | [TO BE POPULATED] | [V/I/A] |
| Deal Size Range | [TO BE POPULATED] | [V/I/A] |
| Return Target | [TO BE POPULATED] | [V/I/A] |
| Hold Period | [TO BE POPULATED] | [V/I/A] |

## IV. ACQUISITIONS & DISPOSITIONS

| Date | Asset | Acq / Disp | Price | Counterparty | Source |
|------|-------|-----------|-------|--------------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Acquisition / Disposition] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. OPERATING MODEL

| Field | Value | Conf |
|-------|-------|------|
| Management Model | [In-house / Third-party / Mixed] | [V/I/A] |

### A. Operating Partners

| Operator | Assets Run | Since | Linked Dossier | Conf |
|----------|-----------|-------|----------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## VI. REPORTING OBLIGATIONS

| Obligation | Cadence | Conf |
|------------|---------|------|
| LP Reporting | [TO BE POPULATED] | [V/I/A] |
| ODCE / NCREIF | [TO BE POPULATED] | [V/I/A] |
| GRESB / ESG | [TO BE POPULATED] | [V/I/A] |
| Lender Reporting | [TO BE POPULATED] | [V/I/A] |
```

`TYPES/LENDING/lending.md` (tier `lending`):

```markdown
# {{name}} - Lending

## I. CREDIT BOX

| Field | Value | Conf |
|-------|-------|------|
| Loan Types | [Construction / Bridge / Permanent / Mezzanine / Pref Equity] | [V/I/A] |
| Asset Classes | [TO BE POPULATED] | [V/I/A] |
| Markets | [TO BE POPULATED] | [V/I/A] |
| Loan Size Range | [TO BE POPULATED] | [V/I/A] |
| Max LTV / LTC | [TO BE POPULATED] | [V/I/A] |
| Min DSCR / Debt Yield | [TO BE POPULATED] | [V/I/A] |
| Pricing | [TO BE POPULATED] | [V/I/A] |
| Recourse | [TO BE POPULATED] | [V/I/A] |

## II. LOAN BOOK & EXPOSURE

| Segment | Exposure | Trend | Conf |
|---------|----------|-------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Growing / Stable / Reducing] | [V/I/A] |

## III. RECENT TRANSACTIONS

| Date | Borrower | Asset | Amount | Terms | Source |
|------|----------|-------|--------|-------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. SERVICING & WORKOUTS

| Loan / Borrower | Status | Notes |
|-----------------|--------|-------|
| [TO BE POPULATED] | [Current / Watchlist / Special Servicing / Modified] | [TO BE POPULATED] |

## V. LENDING TEAM

| Role | Name | Dossier |
|------|------|---------|
| Originator | [TO BE POPULATED] | [TO BE POPULATED] |
| Credit Officer | [TO BE POPULATED] | [TO BE POPULATED] |
| Servicing / Asset Management | [TO BE POPULATED] | [TO BE POPULATED] |
```

`TYPES/BROKERAGE/deal-flow.md` (tier `deal-flow`):

```markdown
# {{name}} - Deal Flow

## I. COVERAGE

| Market | Specialty / Property Type | Team Lead | Dossier |
|--------|---------------------------|-----------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## II. ACTIVE LISTINGS & MANDATES

| Assignment | Type | Asset / Client | Size / Value | Status | Our Angle |
|------------|------|----------------|--------------|--------|-----------|
| [TO BE POPULATED] | [Sale / Lease / Financing / Tenant Rep] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. CLOSED DEALS & COMPS

| Date | Deal | Value | Counterparties | Source |
|------|------|-------|----------------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. BROKERAGE MARKET POSITION

| Field | Value | Conf |
|-------|-------|------|
| Rank / League Tables | [TO BE POPULATED] | [V/I/A] |
| Key Rivals | [TO BE POPULATED] | [V/I/A] |
| Strengths | [TO BE POPULATED] | [V/I/A] |

## V. FEES & CO-BROKE

| Field | Value | Conf |
|-------|-------|------|
| Typical Fee | [TO BE POPULATED] | [V/I/A] |
| Co-Broke Practice | [TO BE POPULATED] | [V/I/A] |
| Referral Terms | [TO BE POPULATED] | [V/I/A] |
```

`TYPES/DEVELOPMENT/projects.md` (tier `projects`):

```markdown
# {{name}} - Projects

## I. PROJECTS

| Project | Asset Class | Location | Size | Stage | Est. Completion | Conf |
|---------|-------------|----------|------|-------|-----------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Pursuit / Entitlement / Pre-Development / Construction / Lease-Up / Stabilized] | [TO BE POPULATED] | [V/I/A] |

## II. ENTITLEMENTS & APPROVALS

| Project | Approval | Authority | Status | Date |
|---------|----------|-----------|--------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. CAPITAL PARTNERS

| Partner | Role | Projects | Dossier |
|---------|------|----------|---------|
| [TO BE POPULATED] | [Equity / Construction Lender / JV] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. DESIGN & CONSTRUCTION TEAM

| Firm | Role | Projects | Dossier |
|------|------|----------|---------|
| [TO BE POPULATED] | [Architect / GC / Engineer] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. CAPABILITIES

| Field | Value | Conf |
|-------|-------|------|
| Product Types | [TO BE POPULATED] | [V/I/A] |
| Typical Project Size | [TO BE POPULATED] | [V/I/A] |
| Markets | [TO BE POPULATED] | [V/I/A] |
| Merchant vs Build-to-Hold vs Fee | [TO BE POPULATED] | [V/I/A] |
```

`TYPES/OPERATORS/managed-portfolio.md` (tier `managed-portfolio`):

```markdown
# {{name}} - Managed Portfolio

## I. PORTFOLIO UNDER MANAGEMENT

| Asset Class | Market | Units / SF / Keys | Owners Served | Conf |
|-------------|--------|-------------------|---------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. OWNERS SERVED

| Owner | Assets | Since | Linked Dossier |
|-------|--------|-------|----------------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. SERVICES OFFERED

| Service | Offered | Notes |
|---------|---------|-------|
| Property Management | [Yes / No] | [TO BE POPULATED] |
| Leasing | [Yes / No] | [TO BE POPULATED] |
| Facilities / Engineering | [Yes / No] | [TO BE POPULATED] |
| Construction Management | [Yes / No] | [TO BE POPULATED] |
| Accounting & Reporting | [Yes / No] | [TO BE POPULATED] |

## IV. PERFORMANCE & SLAs

| Metric | Value | Benchmark | Conf |
|--------|-------|-----------|------|
| Occupancy | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| NOI Margin | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Resident / Guest Score | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Staff Turnover | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## V. OPERATING PLATFORM

| Function | Tool / Provider | Notes |
|----------|-----------------|-------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

`TYPES/SERVICES/engagements.md` (tier `engagements`):

```markdown
# {{name}} - Engagements

## I. PRACTICE AREAS

| Area | Strength | Key Professionals | Conf |
|------|----------|-------------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. ENGAGEMENTS

| Date | Matter / Assignment | Client | Scope | Fee | Status |
|------|---------------------|--------|-------|-----|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. PANEL & APPROVED-VENDOR STATUS

| Organization | Status | Since | Notes |
|--------------|--------|-------|-------|
| [TO BE POPULATED] | [Approved / Pending / Not on panel] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. FEE STRUCTURES

| Service | Structure | Typical Range | Conf |
|---------|-----------|---------------|------|
| [TO BE POPULATED] | [Hourly / Fixed / Success / % of value] | [TO BE POPULATED] | [V/I/A] |

## V. KEY PROFESSIONALS

| Name | Title | Specialty | Dossier |
|------|-------|-----------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

`TYPES/OCCUPIERS/occupancy.md` (tier `occupancy`):

```markdown
# {{name}} - Occupancy

## I. LOCATIONS

| Location | Use | SF | Owned / Leased | Landlord | Conf |
|----------|-----|----|----------------|----------|------|
| [TO BE POPULATED] | [HQ / Office / Retail / Industrial / Lab] | [TO BE POPULATED] | [Owned / Leased] | [TO BE POPULATED] | [V/I/A] |

## II. LEASE EVENTS

| Location | Expiration | Option / Event | Decision Date | Status |
|----------|------------|----------------|---------------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Renewal / Expansion / Termination / ROFO] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. FOOTPRINT STRATEGY

| Field | Value | Conf |
|-------|-------|------|
| Growth / Contraction | [TO BE POPULATED] | [V/I/A] |
| Workplace Policy | [TO BE POPULATED] | [V/I/A] |
| Target Markets | [TO BE POPULATED] | [V/I/A] |
| Site Criteria | [TO BE POPULATED] | [V/I/A] |

## IV. REAL ESTATE DECISION MAKERS

| Role | Name | Dossier |
|------|------|---------|
| Head of Real Estate | [TO BE POPULATED] | [TO BE POPULATED] |
| Finance Approver | [TO BE POPULATED] | [TO BE POPULATED] |
| Broker of Record | [TO BE POPULATED] | [TO BE POPULATED] |
```

`TYPES/PUBLIC/programs.md` (tier `programs`):

```markdown
# {{name}} - Programs & Approvals

## I. JURISDICTION & MANDATE

| Field | Value | Conf |
|-------|-------|------|
| Jurisdiction | [TO BE POPULATED] | [V/I/A] |
| Agency Type | [TO BE POPULATED] | [V/I/A] |
| Mandate | [TO BE POPULATED] | [V/I/A] |
| Budget / Funding Sources | [TO BE POPULATED] | [V/I/A] |

## II. PROGRAMS & INCENTIVES

| Program | Type | Eligibility | Deadline | Conf |
|---------|------|-------------|----------|------|
| [TO BE POPULATED] | [Tax Abatement / Grant / Loan / Zoning Bonus] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## III. APPROVALS & PERMITS IN FLIGHT

| Project | Approval | Stage | Hearing / Decision Date | Notes |
|---------|----------|-------|-------------------------|-------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. POLICY CALENDAR

| Date | Item | Implication |
|------|------|-------------|
| [TO BE POPULATED] | [Election / Budget / Code Change / Hearing] | [TO BE POPULATED] |

## V. KEY OFFICIALS & STAFF

| Role | Name | Dossier |
|------|------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

`TYPES/TECHNOLOGY/product.md` (tier `product`):

```markdown
# {{name}} - Product

## I. PRODUCTS

| Product | Category | Customers / Segment | Conf |
|---------|----------|---------------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. INTEGRATIONS

| System | Direction | Status | Conf |
|--------|-----------|--------|------|
| [TO BE POPULATED] | [Inbound / Outbound / Bi-directional] | [TO BE POPULATED] | [V/I/A] |

## III. NOTABLE CUSTOMERS

| Customer | Products | Since | Dossier |
|----------|----------|-------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. PRICING MODEL

| Signal | Source | Date | Conf |
|--------|--------|------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## V. ROADMAP & FUNDING

| Date | Event | Implication |
|------|-------|-------------|
| [TO BE POPULATED] | [Launch / Funding / M&A] | [TO BE POPULATED] |
```

`TYPES/ASSOCIATIONS/membership.md` (tier `membership`):

```markdown
# {{name}} - Membership

## I. ASSOCIATION PROFILE

| Field | Value | Conf |
|-------|-------|------|
| Scope | [National / Regional / Local] | [V/I/A] |
| Members | [TO BE POPULATED] | [V/I/A] |
| Focus | [TO BE POPULATED] | [V/I/A] |

## II. OUR MEMBERSHIP

| Field | Value | Conf |
|-------|-------|------|
| Member Since | [TO BE POPULATED] | [V/I/A] |
| Tier | [TO BE POPULATED] | [V/I/A] |
| Dues | [TO BE POPULATED] | [V/I/A] |
| Renewal | [TO BE POPULATED] | [V/I/A] |

## III. COMMITTEES & ROLES

| Committee | Our Role | Chair / Contacts | Dossier |
|-----------|----------|------------------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. EVENTS CALENDAR

| Date | Event | Location | Attending | Goal |
|------|-------|----------|-----------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. SPONSORSHIPS

| Event / Program | Level | Cost | Value Received |
|-----------------|-------|------|----------------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

`ROLES/VENDOR/vendor.md` (tier `vendor`):

```markdown
# {{name}} - Vendor Relationship

## I. VENDOR ENGAGEMENT

| Field | Value | Conf |
|-------|-------|------|
| Service / Product | [TO BE POPULATED] | [V/I/A] |
| Contract Start | [TO BE POPULATED] | [V/I/A] |
| Term | [TO BE POPULATED] | [V/I/A] |
| Renewal / Notice Date | [TO BE POPULATED] | [V/I/A] |
| Owner on Our Side | [TO BE POPULATED] | [V/I/A] |

## II. SPEND

| Period | Amount | Notes |
|--------|--------|-------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. SLAs & PERFORMANCE

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [On Track / At Risk / Breached] |

## IV. ISSUES & ESCALATIONS

| Date | Issue | Resolution |
|------|-------|------------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. ALTERNATIVES

| Vendor | Notes | Dossier |
|--------|-------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 6: Run the template tests**

Run: `npx vitest run test/orgTemplates.test.ts`
Expected: PASS. If `headings are unique` fails, rename the later heading (keep roman numeral, change the words) and rerun.

- [ ] **Step 7: Commit**

```bash
git add templates/REAL_ESTATE/ORGANIZATION test/orgTemplates.test.ts
git commit -m "feat: neutral org COMMON, per-group type overlays, vendor role overlay, tech-sale motion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Layered org creation

**Files:**
- Modify: `src/writer.ts` (`CreateDossierInput`, `CreateDossierResult`, `createDossier` person guard, `createOrgDossier`)
- Test: `test/writer.test.ts` (`createDossier — Organization` block)

**Interfaces:**
- Consumes: `orgTemplateLayers`, `normalizeOrgType`, `normalizeOrgTypeList`, `formatOrgTypeChoices`, `ORG_ROLES` (Task 1); `SalesMotion` (Task 1); templates (Task 2).
- Produces:
  - `CreateDossierInput` gains `secondaryTypes?: string[]` and `salesMotion?: SalesMotion` (org only; default `'general'`).
  - `CreateDossierResult` gains `warnings: string[]` (always present; `[]` for persons).
  - INDEX.md of new orgs has `orgType`, `secondaryTypes` (array), `roles`, `salesMotion`.

- [ ] **Step 1: Write failing tests.** In `test/writer.test.ts`, inside `describe('createDossier — Organization', …)`:

Replace the file list in `creates code, folder, and COMMON files`:
```ts
    for (const f of ['INDEX.md', 'profile.md', 'intelligence.md', 'stakeholders.md', 'pipeline.md', 'log.md',
      'managed-portfolio.md']) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
    expect(existsSync(join(dir, 'portfolio.md'))).toBe(false);
    expect(existsSync(join(dir, 'tech-stack.md'))).toBe(false);
```

Replace the test `org sections resolve and index (portfolio, intelligence, pipeline)` with:
```ts
  it('org sections resolve and index (overlay, intelligence, pipeline)', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'INV', cid: 'OXF' });
    expect(store.getSection(r.id, 'portfolio')).toContain('BUY BOX');
    expect(store.getSection(r.id, 'intelligence')).toContain('PRIORITIES & PAIN POINTS');
    expect(store.getSection(r.id, 'pipeline')).toContain('ACTIVE OPPORTUNITIES');
  });
```

Add these tests to the same describe block:
```ts
  it('adds exactly the primary group overlay for each group', () => {
    const cases: Array<[string, string]> = [
      ['REIT', 'portfolio.md'], ['DEBT', 'lending.md'], ['BRK', 'deal-flow.md'], ['DEV', 'projects.md'],
      ['PM', 'managed-portfolio.md'], ['LAW', 'engagements.md'], ['CORP', 'occupancy.md'],
      ['GOV', 'programs.md'], ['SAAS', 'product.md'], ['ASSN', 'membership.md'],
    ];
    const overlayFiles = cases.map(([, f]) => f);
    for (const [code, file] of cases) {
      const r = createDossier(store, tempDir, { name: `Org ${code}`, category: 'Organization', orgType: code, cid: code });
      const files = readdirSync(join(tempDir, r.path));
      expect(files, code).toContain(file);
      expect(files.filter((f) => overlayFiles.includes(f)), code).toEqual([file]);
      expect(r.warnings).toEqual([]);
    }
    const oth = createDossier(store, tempDir, { name: 'Misc Co', category: 'Organization', orgType: 'OTH', cid: 'MISC' });
    expect(readdirSync(join(tempDir, oth.path)).filter((f) => overlayFiles.includes(f))).toEqual([]);
  });

  it('multi-line firm gets one overlay per distinct group and records secondaryTypes', () => {
    const r = createDossier(store, tempDir, {
      name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV', 'VAL'],
    });
    expect(r.id).toBe('BRK-CBRE-001');
    const files = readdirSync(join(tempDir, r.path));
    for (const f of ['deal-flow.md', 'managed-portfolio.md', 'portfolio.md', 'engagements.md']) expect(files).toContain(f);
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.orgType).toBe('BRK');
    expect(yaml.secondaryTypes).toEqual(['PM', 'INV', 'VAL']);
    expect(yaml.salesMotion).toBe('general');
  });

  it('dedupes secondary types (same as primary, repeated, same group)', () => {
    const r = createDossier(store, tempDir, {
      name: 'Dup Co', category: 'Organization', orgType: 'BRK', cid: 'DUP', secondaryTypes: ['CAP', 'brk', 'CAP'],
    });
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['CAP']);
    expect(readdirSync(join(tempDir, r.path)).filter((f) => f === 'deal-flow.md')).toHaveLength(1);
  });

  it('normalizes type codes (case and whitespace)', () => {
    const r = createDossier(store, tempDir, {
      name: 'Padded Co', category: 'Organization', orgType: ' debt ', cid: 'PAD', secondaryTypes: [' pm'],
    });
    expect(r.id).toBe('DEBT-PAD-001');
    const yaml = parseFrontmatter(readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['PM']);
  });

  it('rejects unknown secondary types with the grouped list', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Bad Co', category: 'Organization', orgType: 'BRK', secondaryTypes: ['LND'],
    })).toThrow(/Invalid org type\(s\): LND\. Valid:\n.*Owners & Investors/s);
    expect(existsSync(join(tempDir, 'Organizations', 'BRK_Bad_Co'))).toBe(false);
  });

  it('tech sales motion adds the tech-sale layer and SaaS pipeline', () => {
    const r = createDossier(store, tempDir, {
      name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY', roles: ['Prospect'], salesMotion: 'tech',
    });
    const dir = join(tempDir, r.path);
    expect(existsSync(join(dir, 'tech-stack.md'))).toBe(true);
    expect(readFileSync(join(dir, 'pipeline.md'), 'utf-8')).toContain('Security Review');
    expect(parseFrontmatter(readFileSync(join(dir, 'INDEX.md'), 'utf-8'))!.salesMotion).toBe('tech');
  });

  it('general sales motion keeps the neutral pipeline', () => {
    const r = createDossier(store, tempDir, { name: 'Plain PM', category: 'Organization', orgType: 'PM', cid: 'PLN' });
    expect(readFileSync(join(tempDir, r.path, 'pipeline.md'), 'utf-8')).not.toContain('Security Review');
  });

  it('Vendor and ServiceProvider roles add vendor.md once', () => {
    const r = createDossier(store, tempDir, {
      name: 'Fix It', category: 'Organization', orgType: 'FM', cid: 'FIX', roles: ['Vendor', 'ServiceProvider'],
    });
    expect(existsSync(join(tempDir, r.path, 'vendor.md'))).toBe(true);
  });

  it('warns when an overlay is not installed but still creates the dossier', () => {
    rmSync(join(tempDir, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'TYPES', 'LENDING'), { recursive: true });
    const r = createDossier(store, tempDir, { name: 'Old Bank', category: 'Organization', orgType: 'BANK', cid: 'OLDB' });
    expect(existsSync(join(tempDir, r.path, 'INDEX.md'))).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('TYPES/LENDING');
    expect(r.warnings[0]).toContain('crm-mcp templates pull REAL_ESTATE/ORGANIZATION');
  });

  it('rejects secondaryTypes on person dossiers', () => {
    expect(() => createDossier(store, tempDir, { name: 'Pat Person', category: 'Network', secondaryTypes: ['PM'] }))
      .toThrow(/apply to Organization dossiers only/);
  });
```

Add to the imports at the top of `test/writer.test.ts`: `readdirSync` (from `node:fs`) and `import { parseFrontmatter } from '../src/frontmatter.js';`. Update the `rejects invalid CID and profession on orgs` / `requires a valid orgType` tests if they assert on the old `Valid: REIT, INV…` text: they should now match `/Valid:\n.*Lending & Capital/s`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/writer.test.ts -t "Organization"`
Expected: FAIL (`warnings` undefined, overlays missing, `secondaryTypes` not written).

- [ ] **Step 3: Implement in `src/writer.ts`.**

Imports: add `normalizeOrgTypeList`, `orgTemplateLayers` to the `./orgTypes.js` import; add `type SalesMotion` to the `./types.js` import; add `relative` to the `node:path` import.

Extend the interfaces:
```ts
  roles?: string[];      // Organization only: multi-valued roles (Client, Competitor, …)
  secondaryTypes?: string[]; // Organization only: additional org type codes (multi-line firms)
  salesMotion?: SalesMotion; // Organization only: 'tech' adds the tech-sale template layer (default 'general')
}

export interface CreateDossierResult {
  id: string;            // Generated dossier code
  path: string;          // Relative path to new dossier
  warnings: string[];    // Non-fatal issues (e.g. a template overlay that is not installed)
}
```

In `createDossier`, replace the org-only guard:
```ts
  if (input.orgType || input.cid || (input.roles && input.roles.length > 0)
    || (input.secondaryTypes && input.secondaryTypes.length > 0) || input.salesMotion) {
    throw new Error('orgType, cid, roles, secondaryTypes and salesMotion apply to Organization dossiers only');
  }
```
and change the person return to `return { id: dossierCode, path: relPath, warnings: [] };`.

Replace `createOrgDossier` from its roles validation through the `cpSync` overlay loop and the INDEX update with:
```ts
  const roles = input.roles ?? [];
  const badRoles = roles.filter(r => !(ORG_ROLES as readonly string[]).includes(r));
  if (badRoles.length > 0) {
    throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
  }
  const secondaryTypes = normalizeOrgTypeList(input.secondaryTypes ?? [], orgType);
  const salesMotion: SalesMotion = input.salesMotion === 'tech' ? 'tech' : 'general';
  const cid = (input.cid ?? generateCid(input.name)).toUpperCase();
  // … unchanged: CID validation, orgTpl/commonDir existence check, categoryDir, prefix,
  //   dossierCode, folderName, destPath exists check …

  mkdirSync(join(crmRoot, categoryDir), { recursive: true });
  const warnings: string[] = [];
  for (const layer of orgTemplateLayers(orgTpl, { orgType, secondaryTypes, roles, salesMotion })) {
    if (existsSync(layer)) {
      cpSync(layer, destPath, { recursive: true });
    } else {
      warnings.push(
        `Template overlay ${relative(orgTpl, layer).split('\\').join('/')} is not installed — ` +
        'run: crm-mcp templates pull REAL_ESTATE/ORGANIZATION',
      );
    }
  }
```
(`orgTemplateLayers` always puts COMMON first and `commonDir` existence is checked earlier, so COMMON is always copied.)

In the INDEX `updateFrontmatter` call of `createOrgDossier`, add after `roles,`:
```ts
    secondaryTypes,
    salesMotion,
```
and change the return to `return { id: dossierCode, path: relPath, warnings };`. Delete the now-unused `ROLE_OVERLAYS`/`OrgRole` imports if nothing else in the file uses them (`npx tsc` will tell you).

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit -p . && npx vitest run test/writer.test.ts`
Expected: PASS. Then full `npx vitest run` — remaining failures may only be in `test/server.test.ts` (`resolveTemplateDir`, fixed in Task 6) — if anything else fails, fix it now.

- [ ] **Step 5: Commit**

```bash
git add src/writer.ts test/writer.test.ts
git commit -m "feat: compose org dossiers from COMMON + type, role and motion layers; secondaryTypes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Search by any type or group, and validated updates

**Files:**
- Modify: `src/parser.ts` (`parseDossierIndex` metadata normalization)
- Modify: `src/store.ts` (`searchContacts`, `toSearchResult`, Store filter type)
- Modify: `src/types.ts` (`SearchResult.secondaryTypes`)
- Modify: `src/writer.ts` (`LIST_FIELDS`, `writeField`)
- Test: `test/review-fixes.test.ts` is for review fixes — put these in a new `test/orgSearch.test.ts`

**Interfaces:**
- Consumes: `ORG_GROUPS`, `normalizeOrgType`, `normalizeOrgTypeList`, `OrgGroup` (Task 1); `createDossier` (Task 3).
- Produces:
  - `store.searchContacts({ …, orgType?: string, orgGroup?: string })` — `orgType` matches primary or secondary; `orgGroup` matches if any type is in the group; unknown `orgGroup` throws `Invalid org group: X. Valid: OWNERS, …`.
  - `SearchResult.secondaryTypes?: string[]`.
  - Indexed `metadata_json` always has `orgType` upper-case, `secondaryTypes` and `roles` as arrays (for Organization rows).
  - `updateField(store, id, 'index', 'orgType' | 'secondaryTypes', value)` validates/normalizes; `orgType` change removes it from `secondaryTypes`.

- [ ] **Step 1: Write the failing tests** — create `test/orgSearch.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createDossier, updateField } from '../src/writer.js';
import { parseFrontmatter } from '../src/frontmatter.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
let root: string;
let store: Store;

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION'), join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
  createDossier(store, root, { name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV'], roles: ['Client'] });
  createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES', roles: ['Lender'] });
  createDossier(store, root, { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY' });
});

afterEach(() => store.close());

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

describe('org search', () => {
  it('orgType matches primary or secondary types', () => {
    expect(ids(store.searchContacts({ orgType: 'PM' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgType: 'pm' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgType: 'BRK' }))).toEqual(['BRK-CBRE-001']);
  });

  it('orgGroup matches any type in the group', () => {
    expect(ids(store.searchContacts({ orgGroup: 'OPERATORS' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgGroup: 'lending' }))).toEqual(['DEBT-ARES-001']);
    expect(ids(store.searchContacts({ orgGroup: 'OWNERS' }))).toEqual(['BRK-CBRE-001']);
    expect(() => store.searchContacts({ orgGroup: 'NOPE' })).toThrow(/Invalid org group: NOPE/);
  });

  it('combines type filters with roles', () => {
    expect(ids(store.searchContacts({ orgGroup: 'OPERATORS', roles: ['Client'] }))).toEqual(['BRK-CBRE-001']);
  });

  it('returns secondaryTypes on results', () => {
    const [cbre] = store.searchContacts({ query: 'CBRE' });
    expect(cbre.orgType).toBe('BRK');
    expect(cbre.secondaryTypes).toEqual(['PM', 'INV']);
  });

  it('handles scalar secondaryTypes in a hand-edited INDEX.md', () => {
    const p = join(root, 'Organizations', 'PM_Greystar', 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('secondaryTypes: []', 'secondaryTypes: brk, Inv'));
    store.indexOne('Organizations/PM_Greystar');
    expect(ids(store.searchContacts({ orgType: 'BRK' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(ids(store.searchContacts({ orgGroup: 'OWNERS' }))).toEqual(['BRK-CBRE-001', 'PM-GREY-001']);
    expect(store.searchContacts({ query: 'Greystar' })[0].secondaryTypes).toEqual(['BRK', 'INV']);
  });
});

describe('org updates', () => {
  it('crm_update validates and normalizes secondaryTypes', () => {
    updateField(store, 'DEBT-ARES-001', 'index', 'secondaryTypes', 'svcr, debt, SVCR');
    const yaml = parseFrontmatter(readFileSync(join(root, 'Organizations', 'DEBT_Ares', 'INDEX.md'), 'utf-8'))!;
    expect(yaml.secondaryTypes).toEqual(['SVCR']);
    expect(() => updateField(store, 'DEBT-ARES-001', 'index', 'secondaryTypes', 'LND')).toThrow(/Invalid org type/);
  });

  it('crm_update normalizes orgType and removes it from secondaryTypes', () => {
    updateField(store, 'BRK-CBRE-001', 'index', 'orgType', ' pm ');
    const yaml = parseFrontmatter(readFileSync(join(root, 'Organizations', 'BRK_CBRE', 'INDEX.md'), 'utf-8'))!;
    expect(yaml.orgType).toBe('PM');
    expect(yaml.secondaryTypes).toEqual(['INV']);
    expect(store.getContactPath('BRK-CBRE-001')).toBe('Organizations/BRK_CBRE'); // code/folder unchanged
    expect(() => updateField(store, 'BRK-CBRE-001', 'index', 'orgType', 'LND')).toThrow(/Invalid org type/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/orgSearch.test.ts`
Expected: FAIL (no secondary matching, `orgGroup` ignored, updates unvalidated).

- [ ] **Step 3: Normalize org metadata at index time** — in `src/parser.ts` `parseDossierIndex`, after computing `category` and before building `contact`, add:

```ts
  if (category === 'Organization') normalizeOrgMetadata(yaml);
```

and add at the bottom of the file:

```ts
/**
 * Canonical shape for indexed org metadata so SQL filters stay simple:
 * orgType upper-case, secondaryTypes/roles as arrays (hand edits may use a
 * comma-separated string). Unknown codes are kept, upper-cased.
 */
function normalizeOrgMetadata(yaml: Record<string, unknown>): void {
  const list = (v: unknown): string[] =>
    (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [])
      .map((s) => s.trim()).filter(Boolean);
  if (yaml.orgType != null) yaml.orgType = String(yaml.orgType).trim().toUpperCase();
  yaml.secondaryTypes = [...new Set(list(yaml.secondaryTypes).map((s) => s.toUpperCase()))]
    .filter((s) => s !== yaml.orgType);
  yaml.roles = list(yaml.roles);
}
```

- [ ] **Step 4: Search in `src/store.ts`.**

Add `orgGroup?: string;` to the `searchContacts` filter type in the `Store` interface. Import `ORG_GROUPS, ORG_GROUP_KEYS, type OrgGroup` from `./orgTypes.js`. Add `secondaryTypes?: string[];` to `SearchResult` in `src/types.ts` (after `roles?`).

In `toSearchResult`, inside the Organization branch, add:
```ts
        if (Array.isArray(meta.secondaryTypes)) result.secondaryTypes = meta.secondaryTypes.map(String);
```

Replace the body of `searchContacts` from the destructuring through the end of the FTS fallback with a single filter builder used by both queries:

```ts
      const { query, category, status, profession, roles, orgType, orgGroup, limit = 20 } = filters;

      const normalizedRoles = (roles ?? []).map((role) => {
        const canonical = (ORG_ROLES as readonly string[]).find(
          (r) => r.toLowerCase() === role.trim().toLowerCase(),
        );
        if (!canonical) throw new Error(`Invalid role(s): ${role}. Valid: ${ORG_ROLES.join(', ')}`);
        return canonical;
      });
      let groupCodes: string[] = [];
      if (orgGroup) {
        const key = orgGroup.trim().toUpperCase();
        if (!Object.hasOwn(ORG_GROUPS, key)) {
          throw new Error(`Invalid org group: ${orgGroup}. Valid: ${ORG_GROUP_KEYS.join(', ')}`);
        }
        groupCodes = Object.keys(ORG_GROUPS[key as OrgGroup].types);
      }

      /** Structured filters for a contacts alias (`contacts` or `c`). */
      const filterSql = (t: string): { sql: string[]; params: any[] } => {
        const sql: string[] = [];
        const params: any[] = [];
        const anyType = (codesSql: string) =>
          `(json_extract(${t}.metadata_json, '$.orgType') ${codesSql}` +
          ` OR EXISTS (SELECT 1 FROM json_each(${t}.metadata_json, '$.secondaryTypes') WHERE value ${codesSql}))`;
        if (category) { sql.push(`${t}.category = ?`); params.push(category); }
        if (status) { sql.push(`${t}.status = ?`); params.push(status); }
        if (profession) { sql.push(`${t}.profession = ?`); params.push(profession); }
        if (orgType) {
          const code = orgType.trim().toUpperCase();
          sql.push(anyType('= ?')); params.push(code, code);
        }
        if (groupCodes.length > 0) {
          const inList = `IN (${groupCodes.map(() => '?').join(', ')})`;
          sql.push(anyType(inList)); params.push(...groupCodes, ...groupCodes);
        }
        for (const role of normalizedRoles) {
          sql.push(`EXISTS (SELECT 1 FROM json_each(${t}.metadata_json, '$.roles') WHERE value = ?)`);
          params.push(role);
        }
        return { sql, params };
      };

      const base = filterSql('contacts');
      const conditions = [...base.sql];
      const params: any[] = [];
      if (query) {
        // Escape LIKE wildcards so '_' and '%' in the query match literally.
        // Folder-style inputs like "SMITH_Bobby" contain '_', which SQLite LIKE
        // otherwise treats as a single-char wildcard.
        const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
        conditions.unshift("(name LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\')");
        params.push(`%${escaped}%`, `%${escaped}%`);
      }
      params.push(...base.params);

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      const rows = db.prepare(
        `SELECT id, name, category, organization, status, last_contact, path, metadata_json FROM contacts ${where} ORDER BY name LIMIT ?`,
      ).all(...params, limit);
      let results = rows.map(toSearchResult);

      // If query provided and no name matches, fall back to FTS
      if (query && results.length === 0) {
        const fts = filterSql('c');
        const ftsRows = db.prepare(`
          SELECT DISTINCT c.id, c.name, c.category, c.organization, c.status, c.last_contact, c.path, c.metadata_json
          FROM content_fts f
          JOIN contacts c ON c.id = f.contact_id
          WHERE content_fts MATCH ?
          ${fts.sql.map((s) => `AND ${s}`).join('\n')}
          ORDER BY rank
          LIMIT ?
        `).all(sanitizeFtsQuery(query), ...fts.params, limit);
        results = ftsRows.map(toSearchResult);
      }

      return results;
```

- [ ] **Step 5: Validate org fields in `writeField` (`src/writer.ts`).** Add `'secondaryTypes'` to `LIST_FIELDS`. Replace the block that computes `newValue` and writes the file with:

```ts
  const extra: Record<string, unknown> = {};
  let newValue: unknown = value;
  if (key === 'index' && field === 'orgType') {
    const code = normalizeOrgType(value);
    if (!code) throw new Error(`Invalid org type(s): ${value}. Valid:\n${formatOrgTypeChoices()}`);
    newValue = code;
    const current = parseFrontmatter(content)?.secondaryTypes;
    if (current !== undefined) extra.secondaryTypes = normalizeOrgTypeList(current, code);
  } else if (key === 'index' && field === 'secondaryTypes') {
    newValue = normalizeOrgTypeList(value, String(parseFrontmatter(content)?.orgType ?? ''));
  } else if (key === 'index' && LIST_FIELDS.has(field)) {
    const list = parseListValue(value);
    if (field === 'roles') {
      const badRoles = list.filter((r) => !(ORG_ROLES as readonly string[]).includes(r));
      if (badRoles.length > 0) {
        throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
      }
    }
    newValue = list;
  }

  atomicWriteFileSync(filePath, updateFrontmatter(content, { [field]: newValue, ...extra, lastUpdated: today() }));
```

Add `normalizeOrgType` to the writer's `./orgTypes.js` import (`normalizeOrgTypeList`, `formatOrgTypeChoices`, `parseFrontmatter` are already imported from Tasks 1/3 and the frontmatter module).

Note: `normalizeOrgTypeList(current, code)` throws if the existing `secondaryTypes` already contains an unknown code (hand-edited); that is intended — the user fixes the list first.

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit -p . && npx vitest run test/orgSearch.test.ts test/store.test.ts test/writer.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/parser.ts src/store.ts src/types.ts src/writer.ts test/orgSearch.test.ts
git commit -m "feat: search orgs by any type or group; validate orgType/secondaryTypes updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `salesMotion` config and the tool surface

**Files:**
- Modify: `src/config.ts`
- Modify: `src/orgTypes.ts` (add `formatOrgTypeCatalog`)
- Modify: `src/server.ts` (`TOOL_SUMMARIES`, `crm_search`, `crm_create`, `crm_update`, `crm_read` description, new `crm_org_types`)
- Test: `test/config.test.ts`, `test/orgTypes.test.ts`, new `test/orgTools.test.ts`

**Interfaces:**
- Consumes: registry + `ORG_TYPE_CODES`, `ORG_GROUP_KEYS`, `ORG_ROLES` (Task 1); `CreateDossierResult.warnings` (Task 3); `searchContacts({ orgGroup })`, `SearchResult.secondaryTypes` (Task 4).
- Produces:
  - `Config.salesMotion` always set by `loadConfig()` (`'general' | 'tech'`).
  - `formatOrgTypeCatalog(group?: string): string` (throws `Invalid org group` for unknown group).
  - Tool `crm_org_types` (`{ group?: enum ORG_GROUP_KEYS }`).
  - `crm_create` args `orgType: enum`, `secondaryTypes: enum[]`, `roles: enum[]`, `techSale: boolean`.
  - `crm_search` args `orgType: enum`, `orgGroup: enum`, `roles: enum[]`.

- [ ] **Step 1: Write failing tests.**

Append to `test/config.test.ts`:
```ts
describe('salesMotion', () => {
  it('defaults to general', () => {
    delete process.env.CRM_SALES_MOTION;
    process.env.HOME = '/tmp/no-config-home';
    expect(loadConfig().salesMotion).toBe('general');
  });

  it('reads the env override', () => {
    process.env.CRM_SALES_MOTION = 'tech';
    expect(loadConfig().salesMotion).toBe('tech');
    delete process.env.CRM_SALES_MOTION;
  });

  it('falls back to general with a warning on an unknown value', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CRM_SALES_MOTION = 'saas';
    expect(loadConfig().salesMotion).toBe('general');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('salesMotion'));
    warn.mockRestore();
    delete process.env.CRM_SALES_MOTION;
  });
});
```
(Add `vi` to the vitest import. If the file's existing tests restore `HOME`, follow that pattern: save `process.env.HOME` in a variable and restore it at the end of the first test.)

Append to `test/orgTypes.test.ts`:
```ts
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
```
(Add `formatOrgTypeCatalog` to that file's `../src/orgTypes.js` import.)

Create `test/orgTools.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createMcpServer, TOOL_SUMMARIES } from '../src/server.js';
import type { Config } from '../src/types.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
let root: string;
let store: Store;

function config(salesMotion: 'general' | 'tech' = 'general'): Config {
  return { crmRoot: root, dbPath: ':memory:', embeddingModel: 't', templates: [], defaultTemplate: 'simple', templateRepo: 'o/r', salesMotion };
}

/** Call a registered tool's handler directly and return its text (footer stripped). */
async function call(server: any, name: string, args: Record<string, unknown>): Promise<string> {
  const tool = server._registeredTools[name];
  const parsed = tool.inputSchema ? tool.inputSchema.parse(args) : args;
  const res = await tool.handler(parsed, {});
  return res.content[0].text.split('\n<!--')[0];
}

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION'), join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
});
afterEach(() => store.close());

describe('org tools', () => {
  it('registers crm_org_types with a summary', () => {
    const server = createMcpServer(store, config()) as any;
    expect(server._registeredTools.crm_org_types).toBeDefined();
    expect(TOOL_SUMMARIES.crm_org_types).toBeTruthy();
  });

  it('crm_org_types returns the catalog', async () => {
    const text = await call(createMcpServer(store, config()), 'crm_org_types', { group: 'LENDING' });
    expect(text).toContain('DEBT — Debt fund / private lender');
  });

  it('crm_create uses config salesMotion, techSale overrides it both ways', async () => {
    const tech = createMcpServer(store, config('tech'));
    await call(tech, 'crm_create', { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY' });
    expect(existsSync(join(root, 'Organizations', 'PM_Greystar', 'tech-stack.md'))).toBe(true);
    await call(tech, 'crm_create', { name: 'Quiet PM', category: 'Organization', orgType: 'PM', cid: 'QPM', techSale: false });
    expect(existsSync(join(root, 'Organizations', 'PM_Quiet_PM', 'tech-stack.md'))).toBe(false);
    const general = createMcpServer(store, config('general'));
    await call(general, 'crm_create', { name: 'Loud PM', category: 'Organization', orgType: 'PM', cid: 'LPM', techSale: true });
    expect(existsSync(join(root, 'Organizations', 'PM_Loud_PM', 'tech-stack.md'))).toBe(true);
  });

  it('crm_create rejects techSale for people and reports warnings', async () => {
    const server = createMcpServer(store, config());
    expect(await call(server, 'crm_create', { name: 'Pat Person', category: 'Network', techSale: true }))
      .toMatch(/^Error: .*Organization dossiers only/);
  });

  it('crm_create schema offers type and role choices', () => {
    const server = createMcpServer(store, config()) as any;
    const schema = server._registeredTools.crm_create.inputSchema;
    expect(() => schema.parse({ name: 'X Y', category: 'Organization', orgType: 'LND' })).toThrow();
    expect(() => schema.parse({ name: 'X Y', category: 'Organization', orgType: 'DEBT', roles: ['Borrower'] })).not.toThrow();
  });

  it('crm_search filters by orgGroup and shows secondary types', async () => {
    const server = createMcpServer(store, config());
    await call(server, 'crm_create', { name: 'CBRE', category: 'Organization', orgType: 'BRK', cid: 'CBRE', secondaryTypes: ['PM', 'INV'], roles: ['Client'] });
    const text = await call(server, 'crm_search', { orgGroup: 'OPERATORS' });
    expect(text).toContain('| BRK-CBRE-001 | CBRE | BRK (+PM, INV) [Client] |');
  });

  it('crm_update on orgType explains the code and folder are unchanged', async () => {
    const server = createMcpServer(store, config());
    await call(server, 'crm_create', { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES' });
    const text = await call(server, 'crm_update', { contact: 'DEBT-ARES-001', section: 'index', field: 'orgType', value: 'SVCR' });
    expect(text).toContain('dossier code and folder are unchanged');
    expect(text).toContain('crm_audit');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/config.test.ts test/orgTypes.test.ts test/orgTools.test.ts`
Expected: FAIL.

Check the handler-call helper against the SDK: `server._registeredTools[name]` has `inputSchema` (a zod object built from the raw shape) and `handler`. If `inputSchema.parse` is not a function in this SDK version, use `z.object(tool.inputSchema).parse` — inspect with `console.log(Object.keys(tool))` once, then remove the log.

- [ ] **Step 3: Config** — in `src/config.ts`, import `SALES_MOTIONS, type SalesMotion` from `./types.js` and add before the `return`:

```ts
  const rawMotion = process.env.CRM_SALES_MOTION || fileConfig.salesMotion || 'general';
  let salesMotion: SalesMotion = 'general';
  if ((SALES_MOTIONS as readonly string[]).includes(rawMotion)) {
    salesMotion = rawMotion as SalesMotion;
  } else {
    console.error(`crm-mcp: unknown salesMotion "${rawMotion}" — using "general" (valid: ${SALES_MOTIONS.join(', ')})`);
  }
```
and add `salesMotion` to the returned object.

- [ ] **Step 4: Catalog formatter** — append to `src/orgTypes.ts`:

```ts
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
```

- [ ] **Step 5: Server changes (`src/server.ts`).**

Imports: `import { ORG_TYPE_CODES, ORG_GROUP_KEYS, ORG_ROLES, formatOrgTypeCatalog } from './orgTypes.js';`

`TOOL_SUMMARIES` — add after `crm_create`:
```ts
  crm_org_types: 'list organization types, groups, roles and the template file each adds',
```

`crm_search` — replace the `roles` and `orgType` schema lines with:
```ts
      roles: z.array(z.enum(ORG_ROLES)).optional().describe('Organization roles that must ALL be present'),
      orgType: z.enum(ORG_TYPE_CODES).optional().describe('Organization type code — matches primary or secondary type (see crm_org_types)'),
      orgGroup: z.enum(ORG_GROUP_KEYS).optional().describe('Organization type group, e.g. LENDING (see crm_org_types)'),
```
add `orgGroup` to the destructured args and the `searchContacts` call, and replace the `org` column expression with:
```ts
        const types = r.orgType ? `${r.orgType}${r.secondaryTypes?.length ? ` (+${r.secondaryTypes.join(', ')})` : ''}` : '';
        const org = r.orgType ? `${types}${r.roles?.length ? ` [${r.roles.join(', ')}]` : ''}` : (r.organization || '-');
```

`crm_create` — replace the `orgType` and `roles` schema lines and add two fields:
```ts
      orgType: z.enum(ORG_TYPE_CODES).optional().describe('Organization only: primary type code (see crm_org_types). Sets the dossier code prefix.'),
      secondaryTypes: z.array(z.enum(ORG_TYPE_CODES)).optional().describe('Organization only: other lines of business, e.g. ["PM","INV"] for a brokerage that also manages and invests'),
      cid: z.string().optional().describe('Organization only: company identifier, 2-6 chars (ticker if public, e.g. "PLD")'),
      roles: z.array(z.enum(ORG_ROLES)).optional().describe('Organization only: your relationship roles with this org'),
      techSale: z.boolean().optional().describe('Organization only: add the tech-sale layer (tech stack, SaaS pipeline). Defaults to the salesMotion setting.'),
```
and replace the handler body with:
```ts
    (s, { name, category, organization, context, profession, orgType, secondaryTypes, cid, roles, techSale }) => {
      if (category !== 'Organization' && techSale !== undefined) {
        throw new Error('techSale applies to Organization dossiers only');
      }
      const salesMotion = category === 'Organization'
        ? (techSale === undefined ? (config.salesMotion ?? 'general') : techSale ? 'tech' : 'general')
        : undefined;
      const result = createDossier(s, config.crmRoot, {
        name, category, organization, context, profession, orgType, secondaryTypes, cid, roles, salesMotion,
      });
      return [`Created dossier ${result.id} at ${result.path}`, ...result.warnings.map((w) => `Warning: ${w}`)].join('\n');
    },
```
Also change the tool description to: `'Create a new contact or organization dossier from template. For companies use category "Organization" with orgType (see crm_org_types), optionally secondaryTypes, cid, roles and techSale.'`

`crm_update` — replace the handler's return with:
```ts
      const note = resolveSection(section).key === 'index' && field === 'orgType'
        ? '\nNote: the dossier code and folder are unchanged (codes are permanent). Run crm_audit to see sections the new type adds, then crm_repair to insert them.'
        : '';
      return `Updated ${field} = "${value}" in ${section} for ${id}${note}`;
```
(import `resolveSection` from `./types.js`).

`crm_read` description — replace `Organization sections: index, profile, portfolio, intelligence, stakeholders, pipeline, log, competitive, partnership.` with `Organization sections: index, profile, intelligence, stakeholders, pipeline, log, plus type files (portfolio, lending, deal-flow, projects, managed-portfolio, engagements, occupancy, programs, product, membership) and role/motion files (competitive, partnership, vendor, tech-stack).`

New tool, registered right after `crm_create`:
```ts
  // ── crm_org_types ────────────────────────────────────────────────────
  tool(
    'crm_org_types',
    'List organization type codes by group, the relationship roles, and which dossier file each group, role or the tech-sale motion adds. Use before crm_create for an organization.',
    {
      group: z.enum(ORG_GROUP_KEYS).optional().describe('Show one group only, e.g. LENDING'),
    },
    READ_ONLY,
    (_s, { group }) => formatOrgTypeCatalog(group),
  );
```

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: PASS except `test/server.test.ts` `resolveTemplateDir` if Task 6 is not done yet (it still passes — the function is unchanged until Task 6). The existing `every registered tool has an instructions summary` test must pass.

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/orgTypes.ts src/server.ts test/config.test.ts test/orgTypes.test.ts test/orgTools.test.ts
git commit -m "feat: salesMotion setting, org type/role choices in tools, crm_org_types catalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Audit and repair against the layered template

**Files:**
- Modify: `src/audit.ts` (`buildRoutingTable`, `runAudit` signature)
- Modify: `src/repair.ts` (`runRepair`/`applyOrdering`/`applyMissing` signatures; create missing files from template)
- Modify: `src/maintenance.ts` (`resolveTemplateDirs`)
- Modify: `src/server.ts` (re-export)
- Test: `test/server.test.ts` (rename), new `test/orgAudit.test.ts`

**Interfaces:**
- Consumes: `orgTemplateLayers` (Task 1), templates (Task 2), `createDossier` + `salesMotion` (Task 3), `updateField` on `secondaryTypes` (Task 4).
- Produces:
  - `buildRoutingTable(templateDirs: string | string[]): Map<string, string>` — later layer's copy of a file replaces earlier layers' headings for that file.
  - `runAudit(dossierDir, templateDirs: string | string[], passes)`; `runRepair(dossierDir, templateDirs: string | string[], audit, fixCodes)`.
  - `resolveTemplateDirs(crmRoot, store, contactId): string[] | null` (replaces `resolveTemplateDir`; exported from `src/maintenance.ts` and re-exported from `src/server.ts`).
  - Repair of a C-code whose file does not exist copies that file from the template layer that defines it, filling `{{name}}`, `{{dossierCode}}`, `{{date}}` (others → empty).

- [ ] **Step 1: Write failing tests.**

In `test/server.test.ts`, change the import `resolveTemplateDir` → `resolveTemplateDirs` and the test to:
```ts
  it('resolveTemplateDirs returns the org COMMON layer for an Organization', () => {
    // … same setup as before …
    expect(resolveTemplateDirs(root, store, 'OPR-A-001'))
      .toEqual([join(root, '.templates/REAL_ESTATE/ORGANIZATION/COMMON')]);
    store.close();
  });
```
(The fixture INDEX has no `orgType` overlay directory installed, so only COMMON exists.)

Create `test/orgAudit.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeTempDir } from './helpers/tmp.js';
import { createStore, type Store } from '../src/store.js';
import { createDossier, updateField } from '../src/writer.js';
import { auditContact, repairContact, resolveTemplateDirs } from '../src/maintenance.js';
import { buildRoutingTable } from '../src/audit.js';
import { parseFrontmatter } from '../src/frontmatter.js';

const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const ORG_SRC = join(BUNDLED, 'REAL_ESTATE', 'ORGANIZATION');
let root: string;
let store: Store;

beforeEach(() => {
  root = makeTempDir('crm-test-');
  mkdirSync(join(root, '.templates'), { recursive: true });
  cpSync(ORG_SRC, join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true });
  store = createStore(':memory:', root);
  store.indexAll();
});
afterEach(() => store.close());

describe('layered routing table', () => {
  it('a later layer replaces an earlier layer\'s headings for the same file', () => {
    const table = buildRoutingTable([join(ORG_SRC, 'COMMON'), join(ORG_SRC, 'MOTION', 'TECH_SALE')]);
    expect(table.get('## I. ACCOUNT SUMMARY')).toBe('pipeline.md');
    expect(table.has('## I. RELATIONSHIP SUMMARY')).toBe(false);
    expect(table.get('## I. SYSTEMS OF RECORD')).toBe('tech-stack.md');
    expect(table.get('## II. KEY DECISION MAKERS')).toBe('stakeholders.md');
  });
});

describe('org audit/repair', () => {
  it('a fresh org dossier is fully compliant with its layers', () => {
    const r = createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES', roles: ['Vendor'] });
    const audit = auditContact(store, root, r.id, ['compliance']);
    expect(audit.findings.missing).toEqual([]);
    expect(audit.compliance).toBe(100);
  });

  it('a tech-sale dossier does not report the neutral pipeline headings missing', () => {
    const r = createDossier(store, root, { name: 'Greystar', category: 'Organization', orgType: 'PM', cid: 'GREY', salesMotion: 'tech' });
    const audit = auditContact(store, root, r.id, ['compliance']);
    expect(audit.findings.missing).toEqual([]);
  });

  it('adding a secondary type → audit reports the overlay file → repair creates it from template', () => {
    const r = createDossier(store, root, { name: 'Ares', category: 'Organization', orgType: 'DEBT', cid: 'ARES' });
    updateField(store, r.id, 'index', 'secondaryTypes', 'SVCR, INV');
    const audit = auditContact(store, root, r.id, ['compliance']);
    const files = [...new Set(audit.findings.missing.map((m) => m.file))];
    expect(files).toEqual(['portfolio.md']); // SVCR is LENDING (already present); INV adds OWNERS
    const result = repairContact(store, root, r.id, ['all']);
    expect(result.failed).toEqual([]);
    const created = readFileSync(join(root, r.path, 'portfolio.md'), 'utf-8');
    const fm = parseFrontmatter(created)!;
    expect(fm.contactName).toBe('Ares');
    expect(fm.dossierCode).toBe('DEBT-ARES-001');
    expect(created).not.toContain('{{');
    expect(auditContact(store, root, r.id, ['compliance']).findings.missing).toEqual([]);
    expect(store.getSection(r.id, 'portfolio')).toContain('BUY BOX');
  });

  it('unknown orgType audits against COMMON only', () => {
    const r = createDossier(store, root, { name: 'Legacy Co', category: 'Organization', orgType: 'OTH', cid: 'LEG' });
    const p = join(root, r.path, 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('orgType: OTH', 'orgType: LND').replace('orgType: "OTH"', 'orgType: "LND"'));
    store.indexOne(r.path);
    expect(resolveTemplateDirs(root, store, r.id)).toEqual([join(root, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'COMMON')]);
    const audit = auditContact(store, root, r.id);
    expect(audit.findings.missing).toEqual([]);
    expect(() => repairContact(store, root, r.id, ['all'])).not.toThrow();
  });

  it('person dossiers still audit against their single template', () => {
    mkdirSync(join(root, '.templates', 'PROFESSIONAL'), { recursive: true });
    cpSync(join(BUNDLED, 'PROFESSIONAL'), join(root, '.templates', 'PROFESSIONAL'), { recursive: true });
    const r = createDossier(store, root, { name: 'Pat Person', category: 'Network' });
    expect(resolveTemplateDirs(root, store, r.id)).toEqual([join(root, '.templates', 'PROFESSIONAL')]);
    expect(existsSync(join(root, r.path, 'INDEX.md'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/orgAudit.test.ts test/server.test.ts`
Expected: FAIL (`resolveTemplateDirs` not exported; routing not layered).

- [ ] **Step 3: Layered routing in `src/audit.ts`.** Replace `buildRoutingTable` with:

```ts
/**
 * Build a routing table (heading → relative file) from one template
 * directory or an ordered list of layers. A layer that ships a file replaces
 * every heading earlier layers mapped to that same file, then adds its own —
 * so an overriding file (e.g. MOTION/TECH_SALE/pipeline.md) defines that
 * file's expected headings. H1 headings are ignored.
 */
export function buildRoutingTable(templateDirs: string | string[]): Map<string, string> {
  const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];
  const table = new Map<string, string>();
  for (const dir of layers) {
    const files = collectMdFiles(dir);
    const shipped = new Set(files);
    for (const [heading, file] of [...table]) {
      if (shipped.has(file)) table.delete(heading);
    }
    for (const relPath of files) {
      for (const h of extractHeadings(join(dir, relPath))) table.set(h, relPath);
    }
  }
  return table;
}
```

Change `runAudit`'s parameter to `templateDirs: string | string[]`, set
```ts
  const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];
  const templateName = basename(layers[0] ?? '');
```
and call `buildRoutingTable(layers)`.

- [ ] **Step 4: Repair in `src/repair.ts`.**

Change `runRepair` and `applyOrdering` parameter `templateDir: string` → `templateDirs: string | string[]` (pass through to `buildRoutingTable(templateDirs)` and `runAudit(dossierDir, templateDirs, ['compliance'])`). Pass `templateDirs` to `applyMissing` too.

Add imports: `import { basename } from 'node:path';` (merge with the existing `join` import), `import { parseFrontmatter, splitFrontmatter, updateFrontmatter } from './frontmatter.js';` (extend the existing frontmatter import), `import { today } from './fsutil.js';` (extend the existing fsutil import).

Replace `applyMissing` with:
```ts
/** Last layer that ships `relPath` — the file the composed template actually uses. */
function templateSource(templateDirs: string[], relPath: string): string | null {
  for (let i = templateDirs.length - 1; i >= 0; i--) {
    const candidate = join(templateDirs[i], relPath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Fill a template file's placeholders for this dossier: name and dossier code
 * come from the dossier's INDEX.md; other {{…}} placeholders become empty.
 * Inside frontmatter values are JSON-escaped (templates double-quote them).
 */
function fillTemplate(content: string, dossierDir: string): string {
  const index = existsSync(join(dossierDir, 'INDEX.md'))
    ? parseFrontmatter(readFileSync(join(dossierDir, 'INDEX.md'), 'utf-8')) ?? {}
    : {};
  const vars: Record<string, string> = {
    name: String(index.name ?? basename(dossierDir)),
    dossierCode: String(index.dossierCode ?? ''),
    date: today(),
  };
  const { body } = splitFrontmatter(content);
  const head = content.slice(0, content.length - body.length);
  const fill = (text: string, escape: boolean) =>
    text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      const value = vars[key] ?? '';
      return escape ? JSON.stringify(value).slice(1, -1) : value;
    });
  return fill(head, true) + fill(body, false);
}

function applyMissing(
  dossierDir: string,
  templateDirs: string[],
  audit: AuditResult,
  fixCodes: string[],
  applied: string[],
  failed: string[],
): void {
  const createdFromTemplate = new Set<string>();
  for (const finding of audit.findings.missing) {
    if (!selected(finding.code, fixCodes)) continue;

    try {
      const filePath = join(dossierDir, finding.file);
      if (createdFromTemplate.has(finding.file)) {
        applied.push(finding.code);
        continue;
      }
      if (!existsSync(filePath)) {
        // Whole file missing (e.g. an overlay added after creation): copy it
        // from the template so it gets frontmatter and every section at once.
        const source = templateSource(templateDirs, finding.file);
        if (source) {
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, fillTemplate(readFileSync(source, 'utf-8'), dossierDir));
          createdFromTemplate.add(finding.file);
          applied.push(finding.code);
          continue;
        }
      }
      let content = '';
      if (existsSync(filePath)) {
        content = readFileSync(filePath, 'utf-8');
        if (!content.endsWith('\n')) content += '\n';
      }
      content += `${finding.section}\n\n`;
      writeFileSync(filePath, content);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}
```
(add `mkdirSync` to the `node:fs` import and `dirname` to the `node:path` import.)

In `runRepair`, normalize once: `const layers = Array.isArray(templateDirs) ? templateDirs : [templateDirs];` and call `applyMissing(dossierDir, layers, audit, fixCodes, applied, failed)`.

- [ ] **Step 5: `resolveTemplateDirs` in `src/maintenance.ts`.** Replace `resolveTemplateDir` with:

```ts
/**
 * Template layers a dossier is audited against. Organizations: the layered
 * ORGANIZATION template for the types, roles and sales motion currently in
 * INDEX.md on disk (only installed layers). People: their category template.
 * Returns null when no template is installed.
 */
export function resolveTemplateDirs(crmRoot: string, store: Store, contactId: string): string[] | null {
  const outline = store.getOutline(contactId);
  if (outline.contact.category === 'Organization') {
    const orgRoot = join(crmRoot, '.templates', 'REAL_ESTATE', 'ORGANIZATION');
    if (!existsSync(join(orgRoot, 'COMMON'))) return null;
    const indexPath = join(crmRoot, outline.contact.path, 'INDEX.md');
    const yaml = existsSync(indexPath) ? parseFrontmatter(readFileSync(indexPath, 'utf-8')) ?? {} : {};
    const list = (v: unknown): string[] =>
      (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : []).map((s) => s.trim()).filter(Boolean);
    return orgTemplateLayers(orgRoot, {
      orgType: String(yaml.orgType ?? ''),
      secondaryTypes: list(yaml.secondaryTypes),
      roles: list(yaml.roles),
      salesMotion: yaml.salesMotion === 'tech' ? 'tech' : 'general',
    }).filter((dir) => existsSync(dir));
  }

  const category = outline.contact.category.toLowerCase();
  let templateType = 'PROFESSIONAL';
  if (category === 'family') templateType = 'FAMILY';
  else if (category === 'personal') templateType = 'PERSONAL';

  for (const name of [templateType, templateType.toLowerCase()]) {
    const dir = join(crmRoot, '.templates', name);
    if (existsSync(dir)) return [dir];
  }
  return null;
}
```

Imports in `src/maintenance.ts`: `readFileSync` from `node:fs`, `parseFrontmatter` from `./frontmatter.js`, `orgTemplateLayers` from `./orgTypes.js`. In `dossierAndTemplate`, rename the variable to `templateDirs` (type `string[]`), call `resolveTemplateDirs`, and pass `templateDirs` to `runAudit`/`runRepair`.

`src/server.ts`: change `export { resolveTemplateDir } from './maintenance.js';` to `export { resolveTemplateDirs } from './maintenance.js';`.

- [ ] **Step 6: Run tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/audit.ts src/repair.ts src/maintenance.ts src/server.ts test/server.test.ts test/orgAudit.test.ts
git commit -m "feat: audit and repair org dossiers against their layered template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, end-to-end scenario, build

**Files:**
- Modify: `test/integration.test.ts` (Oxford scenario)
- Modify: `README.md`, `CHANGELOG.md`
- Modify: `skills/_shared/conventions.md` only if it contains org type codes (`grep -n "SAAS\|OPR-\|orgType" skills/_shared/conventions.md`; at plan time it had none — skip if still none)
- Rebuild: `dist/`

**Interfaces:**
- Consumes: everything above.
- Produces: user-facing docs; a green build.

- [ ] **Step 1: Extend the Oxford end-to-end test.** In `test/integration.test.ts` inside `describe('Oxford scenario …')`'s existing test, after the existing assertions add:

```ts
    // Multi-line lender that is also a servicer, found by group and by secondary type
    const lender = createDossier(store, root, {
      name: 'Harbor Credit', category: 'Organization', orgType: 'DEBT', cid: 'HARB', secondaryTypes: ['SVCR'], roles: ['Lender'],
    });
    expect(lender.warnings).toEqual([]);
    expect(store.searchContacts({ orgGroup: 'LENDING' }).map((r) => r.id)).toContain('DEBT-HARB-001');
    expect(store.searchContacts({ orgType: 'SVCR' }).map((r) => r.id)).toEqual(['DEBT-HARB-001']);
    expect(store.getSection('DEBT-HARB-001', 'lending')).toContain('CREDIT BOX');
```
Use the variable names the existing test uses for the store and CRM root (read the test first; rename `store`/`root` above to match).

- [ ] **Step 2: Run it**

Run: `npx vitest run test/integration.test.ts`
Expected: PASS (this is a regression check across Tasks 1–6; if it fails, fix the owning code, not the test).

- [ ] **Step 3: README.** Find the organization section (`grep -n -i "organization" README.md`). Replace the org-type list/paragraph with:

```markdown
### Organizations

Organization dossiers live in `Organizations/` with codes `[orgType]-[CID]-[SEQ]` (e.g. `DEBT-ARES-001`).
Types are grouped — run `crm_org_types` for the full list:

| Group | Types | Adds |
|---|---|---|
| Owners & Investors | REIT, PRVT, REOC, INV, LP, FO, SYN | `portfolio.md` |
| Lending & Capital | BANK, DEBT, AGCY, LIFE, SVCR | `lending.md` |
| Brokerage & Advisory | BRK, CAP, TREP, RES | `deal-flow.md` |
| Development & Construction | DEV, HB, GC, ARCH, ENG | `projects.md` |
| Operators & Management | PM, OPR, FM, HOSP, SNR, FLEX | `managed-portfolio.md` |
| Professional Services | LAW, TTL, VAL, ACCT, CONS, ENV, INS | `engagements.md` |
| Occupiers | CORP, RTL | `occupancy.md` |
| Public Sector & Nonprofit | GOV, HA, NPO | `programs.md` |
| Technology & Data | SAAS, DATA, BTEC | `product.md` |
| Industry Bodies | ASSN | `membership.md` |
| Other | OTH | — |

Every organization gets the neutral core (index, profile, stakeholders, intelligence, pipeline, log) plus the file for its
primary type's group. Multi-line firms add `secondaryTypes` (e.g. CBRE: `orgType: BRK`, `secondaryTypes: [PM, INV, VAL]`),
which add their groups' files and make `crm_search orgType=PM` / `orgGroup=OPERATORS` match.

Roles describe your relationship: Client, Prospect, IntegrationPartner, ChannelPartner, Competitor, OperatingPartner,
Investor, Lender, Employer, TalentTarget, Landlord, Tenant, Borrower, JVPartner, CoInvestor, Vendor, ServiceProvider,
ReferralSource, Regulator. Competitor adds `competitive.md`; IntegrationPartner/ChannelPartner add `partnership.md`;
Vendor/ServiceProvider add `vendor.md`.

**Selling technology?** Set `"salesMotion": "tech"` in `~/.crm-mcp.json` (or `CRM_SALES_MOTION=tech`, or `techSale: true`
on `crm_create`) to add `tech-stack.md` (systems of record, data maturity, buying committee) and a SaaS pipeline
(POC → Security Review → MSA) to new organization dossiers.

Changing `orgType`/`secondaryTypes`/`roles` later does not rename the dossier; run `crm_audit` to see the sections the
change adds and `crm_repair` to insert them. After upgrading, run `crm-mcp templates pull REAL_ESTATE/ORGANIZATION`.
```

Add `crm_org_types` to the README's tool list/table in the same format as its neighbors, and bump the test badge to the new count from `npx vitest run`.

- [ ] **Step 4: CHANGELOG.** Under `## [Unreleased]`:
- In `### Added`, replace the **Organization dossiers** bullet's type list (`[orgType]-[CID]-[SEQ] codes, multi-valued roles, and proptech / RE SaaS templates (…)`) with: `[orgType]-[CID]-[SEQ] codes from a grouped real-estate taxonomy (44 types in 11 groups — owners, lenders, brokerages, developers, operators, professional services, occupiers, public sector, technology, associations, other), secondaryTypes for multi-line firms, multi-valued roles, and templates composed from a neutral core plus one overlay per type group, role overlays (competitive, partnership, vendor) and an opt-in tech-sale layer.`
- Replace the bullet `crm_search roles (AND) and orgType filters; crm_create orgType, cid, roles inputs.` with: `crm_search roles (AND), orgType (matches primary or secondary) and orgGroup filters; crm_create orgType, secondaryTypes, cid, roles and techSale inputs with enumerated choices; new crm_org_types catalog tool; salesMotion setting ("general" | "tech"). Audit/repair check organizations against their composed template, and repair creates a missing overlay file from the template.`

- [ ] **Step 5: Build and full verification**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build && ls -d /tmp/crm-* 2>/dev/null | wc -l`
Expected: typecheck clean, all tests pass, `Bundle complete`, `0` leaked temp dirs.

- [ ] **Step 6: Commit**

```bash
git add README.md CHANGELOG.md test/integration.test.ts dist/ skills/_shared/conventions.md
git commit -m "docs: organization taxonomy, sales motion and crm_org_types; rebuild

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add` of an unchanged `conventions.md` is a no-op.)

---

## Final step (after all tasks)

Dispatch an independent Opus reviewer over `git diff 1ac72e8..HEAD -- src test templates` with the spec and this plan, fix confirmed findings with regression tests, then ask the user before pushing/opening the PR.
