# Organization Dossiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organization (company) dossiers with multiple roles and typed company-to-company / person-to-company links, plus proptech / RE SaaS templates, to crm-mcp-server.

**Architecture:** `Organization` becomes a new `Category` stored under `Organizations/`, so the existing parser, indexer and tools pick it up. `createDossier` hands off to a new `createOrgDossier`, which builds `[orgType]-[CID]-[SEQ]` codes and composes `ORGANIZATION/COMMON` plus role overlay files. `linkedContacts` gains a typed object form. A new store pass resolves every relationship's `target_id` and derives automatic `works_at` edges from a person's `organization` field. Roles and orgType live in `metadata_json` and are filtered with SQLite JSON functions, so there is no schema change.

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), Node ≥ 22.5 `node:sqlite`, `yaml`, `zod`, Vitest.

**Spec:** `docs/plans/2026-09-24-organization-dossiers-design.md`

## Global Constraints

- Node `>=22.5.0`. No new dependencies.
- No DB schema changes. Use `metadata_json` and the existing `relationships` table.
- Person dossiers, the 167 profession templates and the legacy `"Name (Context)"` `linkedContacts` form must behave exactly as before.
- Org dossier code: `[orgType]-[CID]-[SEQ]`. SEQ is 3 digits, zero-padded.
- Org folder: `Organizations/[orgType]_[Company_Name]`.
- Org types: `REIT, INV, LP, OPR, DEV, LND, BRK, SAAS, DATA, SVC`.
- Roles: `Client, Prospect, IntegrationPartner, ChannelPartner, Competitor, OperatingPartner, Investor, Lender, Employer, TalentTarget`.
- CID: 2–6 chars matching `/^[A-Z0-9.]{2,6}$/`. Default: initials of a multi-word name, else first 4 letters.
- New relation types: `operating_partner_of, lp_in, gp_of, parent_of, subsidiary_of, integrates_with, competes_with, acquired_by, employs, works_at`.
- Auto person→org edges use context exactly `auto: organization field`.
- Code style: 2-space indent, single quotes, match surrounding files.
- Test command: `npx vitest run <file>`. Typecheck: `npx tsc --noEmit -p tsconfig.json`. Baseline: 161 tests passing, tsc clean.

## Spec deviations (found while reading code, intentional)

- **`SECTION_FILES` is not extended.** `resolveSectionFile` already maps unknown names to `<name>.md`, and the store and parser already index and scan every `.md` file. `portfolio`, `stakeholders`, `pipeline`, `competitive`, `partnership` and `intelligence` resolve correctly with no change. Task 3 adds a test pinning this.
- **No `template.json` change.** `github.ts:83-92` lists every non-COMMON subdirectory as a pullable category, so `templates pull REAL_ESTATE/ORGANIZATION` works as soon as the directory exists.
- **Confidentiality needs no code.** `stripBoilerplate` never removes YAML frontmatter, so `crm_read section:"index"` already shows the `confidentiality` block first. Task 3 adds a test pinning this.
- **Org `log.md` has no Stakeholder column, and its Document Registry comes first.** `appendLog` (`src/writer.ts:92`) appends a 5-column row after the *last* table in the file. The interaction log must therefore be the last table and keep the person log's 5 columns. Put the stakeholder name in the Summary text.
- **`assetClasses` is not validated.** It's only set by hand-editing INDEX.md, and no tool writes it. `ASSET_CLASSES` is exported as the reference list only.
- **Search takes `roles: string[]`** (every role must be present) rather than a repeated `role` param.
- **Additions the spec didn't mention:**
  - `resolveContact`'s dossier-code regex widens from `{2,3}` to `{2,4}` letters, so `SAAS-…`, `REIT-…` and `DATA-…` codes resolve.
  - `crm_audit` / `crm_repair` get the org template directory for Organization dossiers.
  - `crm_connections` prints the source of each edge, because inbound edges now appear.

## Review Focus

1. **Company names with punctuation or accents** ("Grosvenor & Co.", "Ivanhoé Cambridge") → a folder with only `[A-Za-z0-9_]` and an ASCII CID. Test in Task 3.
2. **Creating the same org twice** (same orgType + name) → a clear "already exists" error and no partial folder. Changing only orgType creates a separate dossier. Test in Task 3.
3. **A role or orgType in the wrong case or misspelled** (`client`, `opr`) → orgType is accepted case-insensitively. Roles are rejected with the valid list, because roles are case-sensitive tags. Test in Task 3.
4. **A link target that is ambiguous or missing** (two contacts share a name, or the name isn't in the CRM) → `target_id` stays `''`, nothing crashes, and the edge still lists by name. Test in Task 5.
5. **Role filter when most contacts are people without `roles`** → search returns only matching orgs, and people are never matched or broken. Test in Task 6.

---

### Task 1: Types, org taxonomy, and code regex

**Files:**
- Modify: `src/types.ts:1-20` (Category, CATEGORY_CODES, CATEGORY_DIRS, RelationType)
- Create: `src/orgTypes.ts`
- Modify: `src/server.ts:47` (resolveContact regex)
- Test: `test/orgTypes.test.ts` (create), `test/writer.test.ts:159-176` (regex tests)

**Interfaces:**
- Produces:
  - `Category` includes `'Organization'`; `CATEGORY_DIRS.Organization === 'Organizations'`; `CATEGORY_CODES.OR === 'Organization'`.
  - `RELATION_TYPES` (readonly string tuple) and `type RelationType = typeof RELATION_TYPES[number]`.
  - From `src/orgTypes.ts`: `ORG_TYPES: Record<OrgType,string>`, `type OrgType`, `ORG_ROLES`, `type OrgRole`, `ASSET_CLASSES`, `ROLE_OVERLAYS: Partial<Record<OrgRole,string>>`, `normalizeOrgType(s: string): OrgType | null`, `generateCid(name: string): string`, `isValidCid(cid: string): boolean`, `orgFolderName(orgType: OrgType, name: string): string`, `AUTO_WORKS_AT_CONTEXT = 'auto: organization field'`.

- [ ] **Step 1: Write the failing tests**

Create `test/orgTypes.test.ts`:

```ts
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
```

In `test/writer.test.ts`, replace the `resolveContact regex` describe block (lines 159-176) with:

```ts
describe('resolveContact regex', () => {
  const resolveContactRegex = /^[A-Z]{2,4}-/;

  it('matches 2-letter category codes', () => {
    expect(resolveContactRegex.test('CL-RANMUL-002')).toBe(true);
    expect(resolveContactRegex.test('NE-TESCON-001')).toBe(true);
  });

  it('matches 3-letter profession codes', () => {
    expect(resolveContactRegex.test('BSB-ROSBRA-001')).toBe(true);
    expect(resolveContactRegex.test('VAP-JANAPP-001')).toBe(true);
  });

  it('matches 4-letter org type codes', () => {
    expect(resolveContactRegex.test('SAAS-CHER-001')).toBe(true);
    expect(resolveContactRegex.test('REIT-PLD-001')).toBe(true);
  });

  it('does not match plain names', () => {
    expect(resolveContactRegex.test('Ross Bratt')).toBe(false);
    expect(resolveContactRegex.test('ranjit')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/orgTypes.test.ts`
Expected: FAIL. Cannot find module `../src/orgTypes.js`.

- [ ] **Step 3: Implement types**

In `src/types.ts`, replace lines 1-20 (Category through RelationType) with:

```ts
export type Category =
  | 'Adversary' | 'Advisor' | 'Client' | 'Colleague'
  | 'Family' | 'Mentor' | 'Network' | 'Personal' | 'Prospect'
  | 'Organization';

export const CATEGORY_CODES: Record<string, Category> = {
  AV: 'Adversary', AD: 'Advisor', CL: 'Client', CO: 'Colleague',
  FA: 'Family', ME: 'Mentor', NE: 'Network', PE: 'Personal', PR: 'Prospect',
  OR: 'Organization',
};

export const CATEGORY_DIRS: Record<Category, string> = {
  Adversary: 'Adversaries', Advisor: 'Advisors', Client: 'Clients',
  Colleague: 'Colleagues', Family: 'Family', Mentor: 'Mentors',
  Network: 'Network', Personal: 'Personal', Prospect: 'Prospects',
  Organization: 'Organizations',
};

export const RELATION_TYPES = [
  'reports_to', 'manages', 'colleague', 'spouse', 'parent',
  'child', 'sibling', 'in_law', 'friend', 'mentor', 'mentee',
  'introduced_by', 'client_of', 'advisor_to', 'adversary_of',
  'partner', 'associated',
  // Organization links
  'operating_partner_of', 'lp_in', 'gp_of', 'parent_of', 'subsidiary_of',
  'integrates_with', 'competes_with', 'acquired_by', 'employs', 'works_at',
] as const;

export type RelationType = typeof RELATION_TYPES[number];
```

- [ ] **Step 4: Implement `src/orgTypes.ts`**

```ts
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
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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
```

- [ ] **Step 5: Widen the resolveContact regex**

In `src/server.ts:47`, change `/^[A-Z]{2,3}-/` to `/^[A-Z]{2,4}-/`, and update the comment on line 46 to:
`// 1. Dossier code (e.g. "CL-RANMUL-002", "SAAS-CHER-001") — use it directly.`

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run test/orgTypes.test.ts test/writer.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/orgTypes.ts src/server.ts test/orgTypes.test.ts test/writer.test.ts
git commit -m "feat: add Organization category, org taxonomy, and org relation types"
```

---

### Task 2: Organization templates

**Files:**
- Create: `templates/REAL_ESTATE/ORGANIZATION/COMMON/{INDEX,profile,portfolio,intelligence,stakeholders,pipeline,log}.md`
- Create: `templates/REAL_ESTATE/ORGANIZATION/ROLES/COMPETITOR/competitive.md`
- Create: `templates/REAL_ESTATE/ORGANIZATION/ROLES/PARTNER/partnership.md`
- Test: `test/orgTemplates.test.ts` (create)

**Interfaces:**
- Produces: the template tree Task 3 copies. Placeholders used: `{{name}}`, `{{dossierCode}}`, `{{date}}`, `{{context}}`, `{{orgType}}`. `INDEX.md` frontmatter must parse as YAML after placeholder substitution and contain `roles: []`, `aliases: []`, `linkedContacts: []`, `confidentiality: []`.

- [ ] **Step 1: Write the failing test**

Create `test/orgTemplates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const ORG = join(import.meta.dirname, '..', 'templates', 'REAL_ESTATE', 'ORGANIZATION');
const COMMON_FILES = ['INDEX.md', 'profile.md', 'portfolio.md', 'intelligence.md',
  'stakeholders.md', 'pipeline.md', 'log.md'];

function frontmatter(path: string): Record<string, unknown> {
  const raw = readFileSync(path, 'utf-8')
    .replace(/\{\{date\}\}/g, '2026-09-24')
    .replace(/\{\{\w+\}\}/g, 'X');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  expect(m, `${path} has frontmatter`).not.toBeNull();
  return parseYaml(m![1]);
}

describe('ORGANIZATION templates', () => {
  it('ships all COMMON files', () => {
    for (const f of COMMON_FILES) expect(existsSync(join(ORG, 'COMMON', f)), f).toBe(true);
  });

  it('ships role overlays', () => {
    expect(existsSync(join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md'))).toBe(true);
    expect(existsSync(join(ORG, 'ROLES', 'PARTNER', 'partnership.md'))).toBe(true);
  });

  it('INDEX.md frontmatter parses and has org fields', () => {
    const y = frontmatter(join(ORG, 'COMMON', 'INDEX.md'));
    expect(y.category).toBe('Organization');
    expect(y.roles).toEqual([]);
    expect(y.aliases).toEqual([]);
    expect(y.linkedContacts).toEqual([]);
    expect(y.confidentiality).toEqual([]);
    expect(y).toHaveProperty('orgType');
    expect(y).toHaveProperty('dossierCode');
  });

  it('every file has parseable frontmatter with dossierCode', () => {
    const files = [...COMMON_FILES.map(f => join(ORG, 'COMMON', f)),
      join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md'),
      join(ORG, 'ROLES', 'PARTNER', 'partnership.md')];
    for (const f of files) expect(frontmatter(f)).toHaveProperty('dossierCode');
  });

  it('competitive and pipeline carry the confidentiality rule', () => {
    for (const f of [join(ORG, 'COMMON', 'pipeline.md'), join(ORG, 'ROLES', 'COMPETITOR', 'competitive.md')]) {
      expect(readFileSync(f, 'utf-8')).toContain('Never record one client');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/orgTemplates.test.ts`
Expected: FAIL. `ships all COMMON files` reports `INDEX.md` false.

- [ ] **Step 3: Create `COMMON/INDEX.md`**

```markdown
---
name: "{{name}}"
dossierCode: "{{dossierCode}}"
category: Organization
orgType: "{{orgType}}"
assetClasses: []
roles: []
accountTier: T3
aliases: []
parentOrg: ""
relationshipOwner: ""
linkedContacts: []
confidentiality: []
status: Active
tier: index
lastUpdated: {{date}}
templateVersion: "1.0"
---

# {{name}} - Quick Reference

> Tag every value: [V] verified · [I] inferred · [A] assumed.

## SNAPSHOT

| Field | Value | Conf |
|-------|-------|------|
| **Org Type** | {{orgType}} | [V] |
| **HQ** | [TO BE POPULATED] | [V/I/A] |
| **AUM** | [TO BE POPULATED] | [V/I/A] |
| **Assets / Units** | [TO BE POPULATED] | [V/I/A] |
| **Headcount** | [TO BE POPULATED] | [V/I/A] |
| **Parent** | [TO BE POPULATED] | [V/I/A] |
| **Context** | {{context}} | [V] |

## ROLE SUMMARY

| Role | Status | So What |
|------|--------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## ACCOUNT HEALTH

| Metric | Value | Conf |
|--------|-------|------|
| ARR | [TO BE POPULATED] | [V/I/A] |
| Renewal Date | [TO BE POPULATED] | [V/I/A] |
| Adoption Health | [TO BE POPULATED] | [V/I/A] |
| Qualification Score (1-100) | [TO BE POPULATED] | [V/I/A] |

## NEXT ACTION

| Action | Due | Owner |
|--------|-----|-------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## RED FLAGS

- None identified

---
*Load stakeholders.md for meeting prep, pipeline.md for commercial status, portfolio.md for fit*
```

- [ ] **Step 4: Create `COMMON/profile.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: profile
lastUpdated: {{date}}
---

# {{name}} - Corporate Profile

## I. CORPORATE IDENTITY

| Field | Value | Conf |
|-------|-------|------|
| Legal Name | [TO BE POPULATED] | [V/I/A] |
| Trade Names | [TO BE POPULATED] | [V/I/A] |
| Ticker / LEI | [TO BE POPULATED] | [V/I/A] |
| HQ | [TO BE POPULATED] | [V/I/A] |
| Founded | [TO BE POPULATED] | [V/I/A] |
| Website | [TO BE POPULATED] | [V/I/A] |

## II. OWNERSHIP & CAPITAL

### A. Ownership

| Field | Value | Conf |
|-------|-------|------|
| Public / Private | [TO BE POPULATED] | [V/I/A] |
| Parent | [TO BE POPULATED] | [V/I/A] |
| Major Shareholders / Sponsors | [TO BE POPULATED] | [V/I/A] |

### B. Fund Family

| Fund | Vintage | Size | Strategy | Stage | Conf |
|------|---------|------|----------|-------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Core / Value-Add / Opportunistic / Debt] | [Fundraising / Deploying / Harvesting] | [V/I/A] |

## III. STRUCTURE

| Entity / Office / JV | Type | Notes | Conf |
|----------------------|------|-------|------|
| [TO BE POPULATED] | [Subsidiary / Regional Office / JV Platform] | [TO BE POPULATED] | [V/I/A] |

## IV. MARKET POSITION

| Field | Value | Conf |
|-------|-------|------|
| Peer Set | [TO BE POPULATED] | [V/I/A] |
| Memberships | [NCREIF / PREA / NAREIT / ULI] | [V/I/A] |
| Reputation | [TO BE POPULATED] | [V/I/A] |

## V. RECENT EVENTS

| Date | Event | Relevance to Us | Source |
|------|-------|-----------------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 5: Create `COMMON/portfolio.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: portfolio
lastUpdated: {{date}}
---

# {{name}} - Portfolio & Tech Stack

> Optional for SAAS / DATA orgs — their product detail belongs in competitive.md or partnership.md.

## I. PORTFOLIO

| Asset Class | Market(s) | Assets / Units / SF | Trajectory | Conf |
|-------------|-----------|---------------------|------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Growing / Stable / Selling Down] | [V/I/A] |

## II. OPERATING MODEL

| Field | Value | Conf |
|-------|-------|------|
| Management Model | [In-house / Third-party / Mixed] | [V/I/A] |

### A. Operating Partners

| Operator | Assets Run | Since | Linked Dossier | Conf |
|----------|-----------|-------|----------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## III. SYSTEMS OF RECORD

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

## IV. DATA MATURITY

| Field | Value | Conf |
|-------|-------|------|
| Data Team (size, reports to) | [TO BE POPULATED] | [V/I/A] |
| Current Integration Method | [Spreadsheets / In-house ETL / Vendor] | [V/I/A] |
| Data Quality Pain Points | [TO BE POPULATED] | [V/I/A] |
| Sources to Unify | [TO BE POPULATED] | [V/I/A] |

## V. REPORTING OBLIGATIONS

| Obligation | Cadence | Tooling | Conf |
|------------|---------|---------|------|
| LP Reporting | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| ODCE / NCREIF | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| GRESB / ESG | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
| Lender Reporting | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |
```

- [ ] **Step 6: Create `COMMON/intelligence.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: intelligence
lastUpdated: {{date}}
---

# {{name}} - Intelligence

## I. STRATEGY SIGNALS

| Stated (Public) | Revealed (Actions) | Implication for Us | Conf |
|-----------------|--------------------|--------------------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. TECHNOLOGY BUYING BEHAVIOR

| Dimension | Assessment | Conf |
|-----------|------------|------|
| Central IT vs Business-Unit Buying | [TO BE POPULATED] | [V/I/A] |
| Build vs Buy | [TO BE POPULATED] | [V/I/A] |
| Adoption Pattern | [Early / Mainstream / Laggard] | [V/I/A] |
| InfoSec Review Timeline | [TO BE POPULATED] | [V/I/A] |
| Procurement Timeline | [TO BE POPULATED] | [V/I/A] |

## III. PAIN POINTS

| Pain Point | Confirmed / Inferred | Product Line | Evidence |
|------------|---------------------|--------------|----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. RISKS

### A. Account Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| [Champion departure / Platform consolidation / Budget freeze] | [TO BE POPULATED] | [TO BE POPULATED] |

### B. Company Viability Risks

| Risk | Signal | Conf |
|------|--------|------|
| [Fund performance / Redemption queue / M&A] | [TO BE POPULATED] | [V/I/A] |

## V. INTELLIGENCE GAPS & SOURCES

| Gap / Source | Reliability | Next Step |
|--------------|-------------|-----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 7: Create `COMMON/stakeholders.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: stakeholders
lastUpdated: {{date}}
---

# {{name}} - Stakeholders

## I. ORG STRUCTURE

| Name | Title | Reports To | Dossier | Conf |
|------|-------|-----------|---------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [V/I/A] |

## II. BUYING COMMITTEE

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

## III. OUR RELATIONSHIPS

### A. Active

| Name | Dossier | Our Contact | Strength (1-10) | Last Touch |
|------|---------|-------------|-----------------|------------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

### B. Target (Not Yet Established)

| Name | Title | Path In | Priority |
|------|-------|---------|----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

### C. Former (Departed)

| Name | Left For | When | Dossier |
|------|----------|------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. COVERAGE

| Level | # Relationships | Gap | Plan |
|-------|-----------------|-----|------|
| Executive | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Director / VP | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Practitioner | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 8: Create `COMMON/pipeline.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: pipeline
lastUpdated: {{date}}
---

# {{name}} - Pipeline

> Never record one client's pricing, rent, or operational data in another client's or a competitor's dossier. Note the source relationship in INDEX.md `confidentiality`.

## I. ACCOUNT SUMMARY

| Field | Value | Conf |
|-------|-------|------|
| ARR | [TO BE POPULATED] | [V/I/A] |
| First Contract | [TO BE POPULATED] | [V/I/A] |
| Renewal Date | [TO BE POPULATED] | [V/I/A] |
| Modules / Products | [TO BE POPULATED] | [V/I/A] |
| Connected Data Sources | [TO BE POPULATED] | [V/I/A] |
| Adoption Health (users, logins, freshness) | [TO BE POPULATED] | [V/I/A] |

## II. ACTIVE OPPORTUNITIES

Stages: Identified → Discovery → Pilot/POC → Security Review → Proposal → MSA/Order Form → Closed Won / Closed Lost

| Opportunity | Module | ACV | Stage | Champion | Blocker | Competitors | Next Step |
|-------------|--------|-----|-------|----------|---------|-------------|-----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## III. STAGE HISTORY

| Date | Opportunity | From | To | Trigger |
|------|-------------|------|----|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. CLOSED WON / LOST

Loss reasons: PRICE · FIT · TIMING · COMPETITOR · BUILD_INTERNAL · SECURITY · CHAMPION_LEFT · NO_DECISION

| Date | Opportunity | Outcome | Value | Reason | Lesson |
|------|-------------|---------|-------|--------|--------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Won / Lost] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## V. EXPANSION

| Motion | Target | Path | Status |
|--------|--------|------|--------|
| Cross-sell | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Renewal Plan | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
| Graph-Adjacent (via operating partner / LP / GP links) | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 9: Create `COMMON/log.md`**

`appendLog` appends a 5-column row after the **last** table in the file. The Document Registry therefore comes first, and the interaction log is the final table, using the person log's exact 5-column header:

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: log
lastUpdated: {{date}}
---

# {{name}} - Interaction Log

## I. DOCUMENT REGISTRY

| Date | Document | Type | Status | Location |
|------|----------|------|--------|----------|
| [TO BE POPULATED] | [TO BE POPULATED] | [NDA / MSA / SOW / Security Questionnaire / Order Form] | [Draft / Sent / Signed / Expired] | [TO BE POPULATED] |

## II. INTERACTION LOG

Name the stakeholder(s) in the Summary. This table must stay last in the file (crm_log appends after the last table).

| Date | Type | Summary | Outcome | Follow-Up |
|------|------|---------|---------|-----------|
| {{date}} | Initial | Dossier created | New account | First outreach |
```

- [ ] **Step 10: Create `ROLES/COMPETITOR/competitive.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: competitive
lastUpdated: {{date}}
---

# {{name}} - Competitive Intelligence

> Never record one client's pricing, rent, or operational data in another client's or a competitor's dossier. Public and deal-surfaced signals only.

## I. PRODUCT OVERLAP

| Capability | Theirs | Ours | Edge | Conf |
|------------|--------|------|------|------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [Them / Us / Parity] | [V/I/A] |

## II. PRICING & PACKAGING SIGNALS

| Signal | Source | Date | Conf |
|--------|--------|------|------|
| [TO BE POPULATED] | [Public / Deal-surfaced] | [TO BE POPULATED] | [V/I/A] |

## III. WIN / LOSS VS THEM

| Date | Account | Outcome | Why | Dossier |
|------|---------|---------|-----|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [Won / Lost] | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. GO-TO-MARKET

| Dimension | Observation | Conf |
|-----------|-------------|------|
| Target Segments | [TO BE POPULATED] | [V/I/A] |
| Recent Logos | [TO BE POPULATED] | [V/I/A] |
| Partnerships | [TO BE POPULATED] | [V/I/A] |
| Messaging | [TO BE POPULATED] | [V/I/A] |

## V. TALENT FLOWS

| Person | Direction | Role | Date | Dossier |
|--------|-----------|------|------|---------|
| [TO BE POPULATED] | [Joined / Left / Our alumni there] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

## VI. WATCH LIST

| Item | Type | Date | Implication |
|------|------|------|-------------|
| [TO BE POPULATED] | [Funding / M&A / Product Launch] | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 11: Create `ROLES/PARTNER/partnership.md`**

```markdown
---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
tier: partnership
lastUpdated: {{date}}
---

# {{name}} - Partnership

## I. PARTNERSHIP TYPE

| Field | Value | Conf |
|-------|-------|------|
| Type | [Data Integration / Reseller / Referral / Marketplace / Strategic Alliance] | [V/I/A] |
| Since | [TO BE POPULATED] | [V/I/A] |
| Strategic Value | [TO BE POPULATED] | [V/I/A] |

## II. INTEGRATION STATUS

| Connector / API | Data Direction | Status | Clients Using | Conf |
|-----------------|----------------|--------|---------------|------|
| [TO BE POPULATED] | [Inbound / Outbound / Bi-directional] | [Scoped / Built / Certified / Live] | [TO BE POPULATED] | [V/I/A] |

## III. CO-SELL

| Account | Their Role | Our Role | Stage | Dossier |
|---------|-----------|----------|-------|---------|
| [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] | [TO BE POPULATED] |

### Referral Balance

| Direction | Count | Value |
|-----------|-------|-------|
| From them | [TO BE POPULATED] | [TO BE POPULATED] |
| To them | [TO BE POPULATED] | [TO BE POPULATED] |

## IV. COMMERCIAL TERMS

| Field | Value | Conf |
|-------|-------|------|
| Agreement | [TO BE POPULATED] | [V/I/A] |
| Renewal | [TO BE POPULATED] | [V/I/A] |
| Rev Share / Fees | [TO BE POPULATED] | [V/I/A] |

## V. PARTNER CONTACTS

| Role | Name | Dossier |
|------|------|---------|
| Partnership Lead | [TO BE POPULATED] | [TO BE POPULATED] |
| Technical Lead | [TO BE POPULATED] | [TO BE POPULATED] |
| Executive Sponsor | [TO BE POPULATED] | [TO BE POPULATED] |
```

- [ ] **Step 12: Run tests**

Run: `npx vitest run test/orgTemplates.test.ts`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add templates/REAL_ESTATE/ORGANIZATION test/orgTemplates.test.ts
git commit -m "feat: add proptech / RE SaaS organization dossier templates"
```

---

### Task 3: Create organization dossiers

**Files:**
- Modify: `src/writer.ts` (CreateDossierInput, seq-scan helper, createDossier branch, new createOrgDossier, replacePlaceholdersRecursive)
- Test: `test/writer.test.ts` (append `describe('createDossier — Organization')`)

**Interfaces:**
- Consumes: `normalizeOrgType`, `generateCid`, `isValidCid`, `orgFolderName`, `ORG_ROLES`, `ORG_TYPES`, `ROLE_OVERLAYS`, `type OrgRole` from `src/orgTypes.ts`. Also `CATEGORY_DIRS.Organization`.
- Produces: `CreateDossierInput` gains `orgType?: string; cid?: string; roles?: string[]`. `createDossier(store, crmRoot, { name, category: 'Organization', orgType, cid?, roles? })` returns `{ id: 'OPR-OXF-001', path: 'Organizations/OPR_Oxford_Properties' }`. The INDEX.md frontmatter it writes has `name, dossierCode, category: Organization, orgType, roles, status: Active, lastContactDate, lastUpdated`.

- [ ] **Step 1: Write the failing tests**

Append to `test/writer.test.ts` (it already copies `REAL_ESTATE` into `.templates/` in `beforeEach`):

```ts
describe('createDossier — Organization', () => {
  it('creates code, folder, and COMMON files', () => {
    const r = createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF',
      roles: ['Client', 'OperatingPartner'],
    });
    expect(r.id).toBe('OPR-OXF-001');
    expect(r.path).toBe('Organizations/OPR_Oxford_Properties');
    const dir = join(tempDir, r.path);
    for (const f of ['INDEX.md', 'profile.md', 'portfolio.md', 'intelligence.md',
      'stakeholders.md', 'pipeline.md', 'log.md']) {
      expect(existsSync(join(dir, f)), f).toBe(true);
    }
    expect(existsSync(join(dir, 'competitive.md'))).toBe(false);
    expect(existsSync(join(dir, 'partnership.md'))).toBe(false);
  });

  it('writes org fields into INDEX.md and indexes as Organization', () => {
    const r = createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'opr', cid: 'OXF',
      roles: ['Client', 'OperatingPartner'],
    });
    const idx = readFileSync(join(tempDir, r.path, 'INDEX.md'), 'utf-8');
    expect(idx).toContain('orgType: OPR');
    expect(idx).toContain('category: Organization');
    expect(idx).toMatch(/roles:\n\s+- Client\n\s+- OperatingPartner/);
    expect(idx).not.toContain('{{');
    const found = store.searchContacts({ query: 'Oxford Properties' });
    expect(found[0].id).toBe('OPR-OXF-001');
    expect(found[0].category).toBe('Organization');
  });

  it('adds role overlays only for matching roles', () => {
    const r = createDossier(store, tempDir, {
      name: 'Rival Data', category: 'Organization', orgType: 'DATA',
      roles: ['Competitor', 'IntegrationPartner', 'ChannelPartner'],
    });
    const dir = join(tempDir, r.path);
    expect(existsSync(join(dir, 'competitive.md'))).toBe(true);
    expect(existsSync(join(dir, 'partnership.md'))).toBe(true);
  });

  it('defaults CID from name and increments SEQ on collision', () => {
    const a = createDossier(store, tempDir, { name: 'Acme Capital', category: 'Organization', orgType: 'INV' });
    const b = createDossier(store, tempDir, { name: 'Alpha Commons', category: 'Organization', orgType: 'INV' });
    expect(a.id).toBe('INV-AC-001');
    expect(b.id).toBe('INV-AC-002');
  });

  it('sanitizes punctuation and accents in folder and CID', () => {
    const r = createDossier(store, tempDir, { name: 'Ivanhoé Cambridge & Co.', category: 'Organization', orgType: 'INV' });
    expect(r.path).toBe('Organizations/INV_Ivanhoe_Cambridge_Co');
    expect(r.id).toBe('INV-ICC-001');
  });

  it('errors on duplicate org folder without partial writes', () => {
    createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    expect(() => createDossier(store, tempDir, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OX2',
    })).toThrow(/already exists/);
    expect(store.searchContacts({ query: 'Oxford' }).length).toBe(1);
  });

  it('allows same name under a different orgType', () => {
    createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'INV', cid: 'OXF' });
    expect(r.id).toBe('INV-OXF-001');
  });

  it('requires a valid orgType', () => {
    expect(() => createDossier(store, tempDir, { name: 'Acme', category: 'Organization' }))
      .toThrow(/orgType.*REIT, INV/);
    expect(() => createDossier(store, tempDir, { name: 'Acme', category: 'Organization', orgType: 'XYZ' }))
      .toThrow(/orgType/);
  });

  it('rejects invalid or wrong-case roles with the valid list', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', roles: ['client'],
    })).toThrow(/Invalid role\(s\): client\. Valid: Client, Prospect/);
  });

  it('rejects invalid CID and profession on orgs', () => {
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', cid: 'a&b',
    })).toThrow(/Invalid CID/);
    expect(() => createDossier(store, tempDir, { name: 'X', category: 'Organization', orgType: 'INV' }))
      .toThrow(/Invalid CID/);
    expect(() => createDossier(store, tempDir, {
      name: 'Acme', category: 'Organization', orgType: 'INV', profession: 'BSB',
    })).toThrow(/profession/);
  });

  it('errors clearly when the ORGANIZATION template is not installed', () => {
    rmSync(join(tempDir, '.templates', 'REAL_ESTATE', 'ORGANIZATION'), { recursive: true, force: true });
    expect(() => createDossier(store, tempDir, { name: 'Acme Co', category: 'Organization', orgType: 'INV' }))
      .toThrow(/templates pull REAL_ESTATE\/ORGANIZATION/);
  });

  it('org sections resolve and index (portfolio, intelligence, pipeline)', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    expect(store.getSection(r.id, 'portfolio')).toContain('SYSTEMS OF RECORD');
    expect(store.getSection(r.id, 'intelligence')).toContain('TECHNOLOGY BUYING BEHAVIOR');
    expect(store.getSection(r.id, 'pipeline')).toContain('ACTIVE OPPORTUNITIES');
  });

  it('crm_read index surfaces the confidentiality block', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    const p = join(tempDir, r.path, 'INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('confidentiality: []',
      'confidentiality:\n  - source: "Client X via Oxford"\n    rule: "Do not share"'));
    store.indexOne(r.path);
    expect(store.getSection(r.id, 'index')).toContain('Client X via Oxford');
  });

  it('crm_log appends into the interaction log, not the document registry', () => {
    const r = createDossier(store, tempDir, { name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF' });
    appendLog(store, r.id, { date: '2026-09-24', type: 'Call', summary: 'Intro with Jane Doe (CIO)' });
    const log = readFileSync(join(tempDir, r.path, 'log.md'), 'utf-8');
    const interaction = log.slice(log.indexOf('## II. INTERACTION LOG'));
    expect(interaction).toContain('| 2026-09-24 | Call | Intro with Jane Doe (CIO) |  |  |');
  });

  it('person dossiers are unchanged', () => {
    const r = createDossier(store, tempDir, { name: 'Jane Smith', category: 'Network' });
    expect(r.id).toBe('NE-JANSMI-001');
  });
});
```

Add `rmSync` to the `node:fs` import at the top of `test/writer.test.ts`. (`writeFileSync`, `readFileSync` and `appendLog` are already imported.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/writer.test.ts -t "Organization"`
Expected: FAIL. The first test throws `No code mapping for category: Organization`, or produces an `OR-…` code.

- [ ] **Step 3: Extract the sequence-scan helper**

In `src/writer.ts`, add above `createDossier`:

```ts
/**
 * Next sequence number for a dossier code prefix (e.g. "NE-JANSMI-" or "OPR-OXF-")
 * by scanning INDEX.md dossierCode values under a category directory.
 */
function nextSequence(catPath: string, prefix: string): number {
  let nextSeq = 1;
  if (!existsSync(catPath)) return nextSeq;
  for (const entry of readdirSync(catPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const indexPath = join(catPath, entry.name, 'INDEX.md');
    if (!existsSync(indexPath)) continue;
    try {
      const content = readFileSync(indexPath, 'utf-8');
      const match = content.match(/dossierCode:\s*"?([^"\n]+)"?/);
      if (match && match[1].startsWith(prefix)) {
        const seq = parseInt(match[1].substring(prefix.length), 10);
        if (!isNaN(seq) && seq >= nextSeq) nextSeq = seq + 1;
      }
    } catch {
      // skip unreadable
    }
  }
  return nextSeq;
}
```

Replace the body of step 4 in `createDossier` (the `// 4. Determine next sequence number…` block through the end of its `if (existsSync(catPath)) {…}`) with:

```ts
  // 4. Determine next sequence number by scanning existing dossiers
  const nextSeq = nextSequence(join(crmRoot, categoryDir), `${codePrefix}-${f3l3}-`);
```

- [ ] **Step 4: Extend input type and placeholder replacement**

In `CreateDossierInput`, add after `profession`:

```ts
  orgType?: string;      // Organization only: REIT | INV | LP | OPR | DEV | LND | BRK | SAAS | DATA | SVC
  cid?: string;          // Organization only: company identifier (ticker or abbreviation), 2-6 chars
  roles?: string[];      // Organization only: multi-valued roles (Client, Competitor, …)
```

In `replacePlaceholdersRecursive`, extend the `replacements` parameter type with `orgType?: string`, and add `orgType: replacements.orgType ?? '',` to the `vars` object.

- [ ] **Step 5: Add the Organization branch and createOrgDossier**

Add to the imports at the top of `src/writer.ts`:

```ts
import {
  ORG_TYPES, ORG_ROLES, ROLE_OVERLAYS, normalizeOrgType, generateCid, isValidCid,
  orgFolderName, type OrgRole,
} from './orgTypes.js';
```

At the start of `createDossier`, right after the `// 1. Validate category` block, add:

```ts
  if (category === 'Organization') {
    return createOrgDossier(store, crmRoot, input);
  }
```

Add the new function after `createDossier`:

```ts
/**
 * Create an organization dossier: `[orgType]-[CID]-[SEQ]` code, `Organizations/[orgType]_[Name]`
 * folder, composed from REAL_ESTATE/ORGANIZATION/COMMON plus one overlay per role.
 */
function createOrgDossier(store: Store, crmRoot: string, input: CreateDossierInput): CreateDossierResult {
  if (input.profession) {
    throw new Error('profession applies to person dossiers only; use orgType for organizations');
  }
  const orgType = input.orgType ? normalizeOrgType(input.orgType) : null;
  if (!orgType) {
    throw new Error(`Organization requires a valid orgType. Valid: ${Object.keys(ORG_TYPES).join(', ')}`);
  }
  const roles = input.roles ?? [];
  const badRoles = roles.filter(r => !(ORG_ROLES as readonly string[]).includes(r));
  if (badRoles.length > 0) {
    throw new Error(`Invalid role(s): ${badRoles.join(', ')}. Valid: ${ORG_ROLES.join(', ')}`);
  }
  const cid = (input.cid ?? generateCid(input.name)).toUpperCase();
  if (!isValidCid(cid)) {
    throw new Error(`Invalid CID "${cid}": use 2-6 chars of A-Z, 0-9, "." (pass cid explicitly)`);
  }

  const orgTpl = join(getUserTemplatesDir(crmRoot), 'REAL_ESTATE', 'ORGANIZATION');
  const commonDir = join(orgTpl, 'COMMON');
  if (!existsSync(commonDir)) {
    throw new Error('Organization template not installed locally. Run: crm-mcp templates pull REAL_ESTATE/ORGANIZATION');
  }

  const categoryDir = CATEGORY_DIRS.Organization;
  const folderName = orgFolderName(orgType, input.name);
  const destPath = join(crmRoot, categoryDir, folderName);
  if (existsSync(destPath)) {
    throw new Error(`Dossier folder already exists: ${destPath}`);
  }

  const prefix = `${orgType}-${cid}-`;
  const dossierCode = `${prefix}${String(nextSequence(join(crmRoot, categoryDir), prefix)).padStart(3, '0')}`;

  mkdirSync(join(crmRoot, categoryDir), { recursive: true });
  cpSync(commonDir, destPath, { recursive: true });
  const overlays = new Set(roles.map(r => ROLE_OVERLAYS[r as OrgRole]).filter((d): d is string => !!d));
  for (const overlay of overlays) {
    const src = join(orgTpl, 'ROLES', overlay);
    if (existsSync(src)) cpSync(src, destPath, { recursive: true });
  }

  const todayStr = today();
  replacePlaceholdersRecursive(destPath, {
    name: input.name,
    dossierCode,
    organization: '',
    category: 'Organization',
    date: todayStr,
    context: input.context ?? '',
    profession: '',
    orgType,
  });

  const indexPath = join(destPath, 'INDEX.md');
  const { yaml: indexYaml, body: indexBody } = parseFrontmatterAndBody(readFileSync(indexPath, 'utf-8'));
  indexYaml.name = input.name;
  indexYaml.dossierCode = dossierCode;
  indexYaml.category = 'Organization';
  indexYaml.orgType = orgType;
  indexYaml.roles = roles;
  indexYaml.status = 'Active';
  indexYaml.lastContactDate = todayStr;
  indexYaml.lastUpdated = todayStr;
  if (input.context) indexYaml.context = input.context;
  delete indexYaml.tier;
  writeFileSync(indexPath, reconstructFile(indexYaml, indexBody), 'utf-8');

  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);
  return { id: dossierCode, path: relPath };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run test/writer.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, including every pre-existing `createDossier` test. tsc exit 0.

If `idx` contains `orgType: "OPR"` rather than `orgType: OPR`, `reconstructFile` quotes strings. Change that assertion to `toMatch(/orgType: "?OPR"?/)`. Do not change `reconstructFile`.

- [ ] **Step 7: Commit**

```bash
git add src/writer.ts test/writer.test.ts
git commit -m "feat: create organization dossiers with org codes and role overlays"
```

---

### Task 4: Typed linkedContacts

**Files:**
- Modify: `src/parser.ts:376-401` (extractRelationships)
- Test: `test/parser.test.ts` (append to `describe('extractRelationships')`)

**Interfaces:**
- Consumes: `RELATION_TYPES`, `type RelationType` from `src/types.ts`.
- Produces: `extractRelationships(dossierPath, contactId)` returns typed edges for object entries `{ name, type, context? }`. Legacy strings still give `type: 'associated'`. Empty names are dropped. `targetId` is still `''` (Task 5 resolves it).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('extractRelationships', …)` in `test/parser.test.ts`. Add `mkdtempSync, mkdirSync, writeFileSync` to the `node:fs` import and `tmpdir` from `node:os` if they are missing:

```ts
  function dossierWith(linked: string): string {
    const dir = join(mkdtempSync(join(tmpdir(), 'crm-rel-')), 'Organizations', 'OPR_Test');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'INDEX.md'),
      `---\nname: "Test Org"\ndossierCode: "OPR-TST-001"\nlinkedContacts:\n${linked}\n---\n\n# Test Org\n`);
    return dir;
  }

  it('parses object-form entries with type and context', () => {
    const rels = extractRelationships(dossierWith(
      '  - { name: "INV-XYZ-001", type: operating_partner_of, context: "TX MF" }'), 'OPR-TST-001');
    expect(rels).toEqual([{
      sourceId: 'OPR-TST-001', targetId: '', targetName: 'INV-XYZ-001',
      type: 'operating_partner_of', context: 'TX MF', bidirectional: false,
    }]);
  });

  it('falls back to associated for unknown types', () => {
    const rels = extractRelationships(dossierWith('  - { name: "Acme", type: frenemy }'), 'OPR-TST-001');
    expect(rels[0].type).toBe('associated');
    expect(rels[0].context).toBe('');
  });

  it('mixes legacy strings and objects, drops empty names', () => {
    const rels = extractRelationships(dossierWith(
      '  - "Jane Doe (VP)"\n  - { name: "Acme", type: competes_with }\n  - { type: lp_in }'), 'OPR-TST-001');
    expect(rels.map(r => [r.targetName, r.type])).toEqual([
      ['Jane Doe', 'associated'], ['Acme', 'competes_with'],
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/parser.test.ts -t "extractRelationships"`
Expected: FAIL. The object entry becomes targetName `[object Object]`.

- [ ] **Step 3: Implement**

In `src/parser.ts`, change the type import to also bring in the runtime list:

```ts
import type { Contact, SectionMeta, Relationship, Category, RelationType } from './types.js';
import { SECTION_FILES, CATEGORY_DIRS, RELATION_TYPES } from './types.js';
```

Replace the `return linkedContacts.map(…);` statement in `extractRelationships` with:

```ts
  const rels: Relationship[] = linkedContacts.map((entry: unknown): Relationship => {
    // Object form: { name, type, context }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      const rawType = String(obj.type ?? '');
      const type = (RELATION_TYPES as readonly string[]).includes(rawType)
        ? (rawType as RelationType)
        : 'associated';
      return {
        sourceId: contactId,
        targetId: '',
        targetName: String(obj.name ?? '').trim(),
        type,
        context: obj.context != null ? String(obj.context) : '',
        bidirectional: false,
      };
    }

    // Legacy string form: "Name (Context)"
    const str = String(entry);
    const match = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    return {
      sourceId: contactId,
      targetId: '',
      targetName: match ? match[1].trim() : str.trim(),
      type: 'associated',
      context: match ? match[2].trim() : '',
      bidirectional: false,
    };
  });

  return rels.filter(r => r.targetName !== '');
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run test/parser.test.ts test/store.test.ts test/integration.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. The existing legacy tests are unchanged. tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts test/parser.test.ts
git commit -m "feat: typed object form for linkedContacts relationships"
```

---

### Task 5: Resolve relationship targets and derive works_at edges

**Files:**
- Modify: `src/store.ts` (new internal `resolveRelationshipTargets`, called from `indexAll` and `indexOne`)
- Test: `test/store.test.ts` (append `describe('relationship resolution')`)

**Interfaces:**
- Consumes: `AUTO_WORKS_AT_CONTEXT` from `src/orgTypes.ts`. Relationship rows from Task 4.
- Produces: after `indexAll()` / `indexOne()`, every `relationships.target_id` equals the unique contact whose dossier code, name or alias matches `target_name` (case-insensitive), else `''`. Each non-Organization contact whose `organization` uniquely matches an Organization's name or alias has an edge `(person, org, orgName, 'works_at', 'auto: organization field')`. `getConnections(id, 2)` traverses person → org → org.

- [ ] **Step 1: Write the failing tests**

Append to `test/store.test.ts`. Add `mkdtempSync, mkdirSync` to the `node:fs` import, add `import { tmpdir } from 'node:os';`, and add `createStore` if it isn't already imported. The two helpers go at **module scope** because Task 6 reuses them:

```ts
function writeDossier(root: string, rel: string, yaml: string): void {
  mkdirSync(join(root, rel), { recursive: true });
  writeFileSync(join(root, rel, 'INDEX.md'), `---\n${yaml}\nstatus: Active\n---\n\n# X\n`);
}

/** Oxford (OPR; Client+OperatingPartner) → operating_partner_of → XYZ (INV; Client); Jane works at "oxford". */
function graphRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'crm-graph-'));
  writeDossier(root, 'Organizations/OPR_Oxford', [
    'name: "Oxford Properties"', 'dossierCode: "OPR-OXF-001"', 'orgType: OPR', 'aliases:', '  - "Oxford"',
    'roles:', '  - Client', '  - OperatingPartner',
    'linkedContacts:', '  - { name: "INV-XYZ-001", type: operating_partner_of, context: "TX MF" }',
  ].join('\n'));
  writeDossier(root, 'Organizations/INV_Xyz', [
    'name: "XYZ Capital"', 'dossierCode: "INV-XYZ-001"', 'orgType: INV', 'roles:', '  - Client',
  ].join('\n'));
  writeDossier(root, 'Network/DOE_Jane', [
    'name: "Jane Doe"', 'dossierCode: "NE-JANDOE-001"', 'organization: "oxford"',
    'linkedContacts:', '  - "Nobody Here (unknown)"', '  - "Sam Twin (ambiguous)"',
  ].join('\n'));
  writeDossier(root, 'Network/TWIN_Sam', 'name: "Sam Twin"\ndossierCode: "NE-SAMTWI-001"');
  writeDossier(root, 'Clients/TWIN_Sam', 'name: "Sam Twin"\ndossierCode: "CL-SAMTWI-001"');
  return root;
}

describe('relationship resolution', () => {
  it('resolves target_id by dossier code', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('OPR-OXF-001');
    const op = rels.find(r => r.type === 'operating_partner_of');
    expect(op!.targetId).toBe('INV-XYZ-001');
    s.close();
  });

  it('derives works_at from organization via alias, case-insensitive', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001');
    const w = rels.find(r => r.type === 'works_at');
    expect(w).toMatchObject({ targetId: 'OPR-OXF-001', targetName: 'Oxford Properties', context: 'auto: organization field' });
    s.close();
  });

  it('leaves unknown and ambiguous targets unresolved without crashing', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001');
    expect(rels.find(r => r.targetName === 'Nobody Here')!.targetId).toBe('');
    expect(rels.find(r => r.targetName === 'Sam Twin')!.targetId).toBe('');
    s.close();
  });

  it('traverses person → org → org at depth 2', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('NE-JANDOE-001', 2);
    expect(rels.some(r => r.type === 'operating_partner_of' && r.targetId === 'INV-XYZ-001')).toBe(true);
    s.close();
  });

  it('shows inbound edges on the target', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const rels = s.getConnections('INV-XYZ-001');
    expect(rels.some(r => r.sourceId === 'OPR-OXF-001' && r.type === 'operating_partner_of')).toBe(true);
    s.close();
  });

  it('re-derives works_at after indexOne (no duplicates, follows org change)', () => {
    const root = graphRoot();
    const s = createStore(':memory:', root);
    s.indexAll();
    s.indexOne('Organizations/OPR_Oxford');
    const count = () => (s.db.prepare(
      "SELECT COUNT(*) AS n FROM relationships WHERE type = 'works_at'").get() as any).n;
    expect(count()).toBe(1);
    const p = join(root, 'Network/DOE_Jane/INDEX.md');
    writeFileSync(p, readFileSync(p, 'utf-8').replace('organization: "oxford"', 'organization: "Elsewhere"'));
    s.indexOne('Network/DOE_Jane');
    expect(count()).toBe(0);
    s.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/store.test.ts -t "relationship resolution"`
Expected: FAIL. `targetId` is `''` and there are no `works_at` edges.

- [ ] **Step 3: Implement**

In `src/store.ts`, add `import { AUTO_WORKS_AT_CONTEXT } from './orgTypes.js';`.

Inside `createStore`, after the `indexDossier` function, add:

```ts
  /**
   * Resolve relationships.target_id from target_name (dossier code, name, or alias —
   * case-insensitive, unique matches only) and re-derive person→org `works_at` edges
   * from each person's `organization` field.
   */
  function resolveRelationshipTargets(): void {
    db.prepare('DELETE FROM relationships WHERE context = ?').run(AUTO_WORKS_AT_CONTEXT);

    const contacts = db.prepare(
      'SELECT id, name, aliases, category, organization FROM contacts',
    ).all() as Array<{ id: string; name: string; aliases: string | null; category: string; organization: string | null }>;

    const buildIndex = (rows: typeof contacts, includeIds: boolean): Map<string, Set<string>> => {
      const map = new Map<string, Set<string>>();
      const add = (key: string, id: string) => {
        const k = key.trim().toLowerCase();
        if (!k) return;
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(id);
      };
      for (const c of rows) {
        if (includeIds) add(c.id, c.id);
        add(c.name, c.id);
        if (c.aliases) {
          try { for (const a of JSON.parse(c.aliases) as string[]) add(a, c.id); } catch { /* ignore */ }
        }
      }
      return map;
    };
    const unique = (map: Map<string, Set<string>>, key: string): string => {
      const ids = map.get(key.trim().toLowerCase());
      return ids && ids.size === 1 ? [...ids][0] : '';
    };

    const all = buildIndex(contacts, true);
    const update = db.prepare('UPDATE relationships SET target_id = ? WHERE rowid = ?');
    for (const row of db.prepare('SELECT rowid, target_name FROM relationships').all() as any[]) {
      update.run(unique(all, row.target_name), row.rowid);
    }

    const orgs = contacts.filter(c => c.category === 'Organization');
    const orgIndex = buildIndex(orgs, false);
    const orgName = new Map(orgs.map(o => [o.id, o.name]));
    for (const c of contacts) {
      if (c.category === 'Organization' || !c.organization) continue;
      const orgId = unique(orgIndex, c.organization);
      if (!orgId) continue;
      stmts.insertRelationship.run(c.id, orgId, orgName.get(orgId)!, 'works_at', AUTO_WORKS_AT_CONTEXT, 0);
    }
  }
```

In `indexAll`, inside `runIndex` after the `for (const relPath of indexFiles) {…}` loop, add:

```ts
        resolveRelationshipTargets();
```

In `indexOne`, after `indexDossier(dossierRelPath);`, add:

```ts
      resolveRelationshipTargets();
```

`stmts` is declared with `const` after the functions but before `store` is used. `resolveRelationshipTargets` is only called at runtime, after `stmts` exists, so there is no TDZ issue. Confirm `stmts` is declared before the `const store: Store = {` line.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: full suite PASS, including existing `getConnections` tests. `Jane Doe` / `Bob Smith` have no matching fixture, so their counts stay at 2. tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/store.ts test/store.test.ts
git commit -m "feat: resolve relationship targets and derive person-to-org works_at edges"
```

---

### Task 6: Search filters, tool wiring, audit, and connections display

**Files:**
- Modify: `src/types.ts` (SearchResult gains `orgType?`, `roles?`)
- Modify: `src/store.ts` (Store interface + `searchContacts` filters and org fields)
- Modify: `src/server.ts` (`crm_search`, `crm_create`, `crm_connections`, `resolveTemplateDir`)
- Test: `test/store.test.ts`, `test/server.test.ts`

**Interfaces:**
- Consumes: `createDossier` org inputs (Task 3). Org metadata in `metadata_json` (Task 3 writes it; parser stores the whole YAML).
- Produces:
  - `store.searchContacts({ …, roles?: string[], orgType?: string })`. Every listed role must be present (AND).
  - `SearchResult.orgType?: string` and `SearchResult.roles?: string[]`, set for Organization rows.
  - Exported `resolveTemplateDir(crmRoot, store, contactId)`, which returns `.templates/REAL_ESTATE/ORGANIZATION/COMMON` for orgs.
  - Exported `formatConnections(store, connections): string`.

- [ ] **Step 1: Write the failing tests**

Append to `test/store.test.ts`, reusing the module-scope `graphRoot()` from Task 5:

```ts
describe('searchContacts org filters', () => {
  it('filters by single role', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const ids = s.searchContacts({ roles: ['Client'] }).map(r => r.id).sort();
    expect(ids).toEqual(['INV-XYZ-001', 'OPR-OXF-001']);
    s.close();
  });

  it('ANDs multiple roles', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(s.searchContacts({ roles: ['Client', 'OperatingPartner'] }).map(r => r.id)).toEqual(['OPR-OXF-001']);
    s.close();
  });

  it('filters by orgType and never matches people', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    expect(s.searchContacts({ orgType: 'INV' }).map(r => r.id)).toEqual(['INV-XYZ-001']);
    expect(s.searchContacts({ roles: ['Competitor'] })).toEqual([]);
    expect(s.searchContacts({ query: 'Jane' })[0].roles).toBeUndefined();
    s.close();
  });

  it('returns orgType and roles on org rows', () => {
    const s = createStore(':memory:', graphRoot());
    s.indexAll();
    const r = s.searchContacts({ query: 'Oxford Properties' })[0];
    expect(r.roles).toEqual(['Client', 'OperatingPartner']);
    s.close();
  });
});
```

Append to `test/server.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { formatConnections, resolveTemplateDir } from '../src/server.js';

describe('org tool helpers', () => {
  it('formatConnections shows source → target for inbound edges', () => {
    const root = mkdtempSync(join(tmpdir(), 'crm-srv-'));
    for (const [rel, yaml] of [
      ['Organizations/OPR_A', 'name: "Org A"\ndossierCode: "OPR-A-001"\nlinkedContacts:\n  - { name: "INV-B-001", type: operating_partner_of }'],
      ['Organizations/INV_B', 'name: "Org B"\ndossierCode: "INV-B-001"'],
    ]) {
      mkdirSync(join(root, rel), { recursive: true });
      writeFileSync(join(root, rel, 'INDEX.md'), `---\n${yaml}\nstatus: Active\n---\n`);
    }
    const store = createStore(':memory:', root);
    store.indexAll();
    const text = formatConnections(store, store.getConnections('INV-B-001'));
    expect(text).toBe('- Org A → Org B (operating_partner_of)');
    store.close();
  });

  it('resolveTemplateDir returns the org template for Organization', () => {
    const root = mkdtempSync(join(tmpdir(), 'crm-srv-'));
    mkdirSync(join(root, 'Organizations/OPR_A'), { recursive: true });
    writeFileSync(join(root, 'Organizations/OPR_A/INDEX.md'), '---\nname: "Org A"\ndossierCode: "OPR-A-001"\n---\n');
    mkdirSync(join(root, '.templates/REAL_ESTATE/ORGANIZATION/COMMON'), { recursive: true });
    const store = createStore(':memory:', root);
    store.indexAll();
    expect(resolveTemplateDir(root, store, 'OPR-A-001'))
      .toBe(join(root, '.templates/REAL_ESTATE/ORGANIZATION/COMMON'));
    store.close();
  });
});
```

Merge the new `node:fs` / `node:os` imports into the file's existing import lines rather than duplicating them.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/store.test.ts test/server.test.ts`
Expected: FAIL. `roles` filter ignored / `formatConnections` is not exported.

- [ ] **Step 3: Store — filters and org fields**

In `src/types.ts` `SearchResult`, add:

```ts
  orgType?: string;
  roles?: string[];
```

In `src/store.ts`, extend the `searchContacts` filter type in the `Store` interface with `roles?: string[]; orgType?: string;`.

In `searchContacts`, destructure `roles` and `orgType`. After the `profession` condition add:

```ts
      if (orgType) {
        conditions.push("json_extract(metadata_json, '$.orgType') = ?");
        params.push(orgType.toUpperCase());
      }
      for (const role of roles ?? []) {
        conditions.push("EXISTS (SELECT 1 FROM json_each(contacts.metadata_json, '$.roles') WHERE value = ?)");
        params.push(role);
      }
```

Change the main SELECT to include `metadata_json`:
`SELECT id, name, category, organization, status, last_contact, path, metadata_json FROM contacts ${where} ORDER BY name LIMIT ?`

In the FTS fallback, add `c.metadata_json` to its SELECT, and after the `${profession ? …}` line add:

```ts
          ${orgType ? "AND json_extract(c.metadata_json, '$.orgType') = ?" : ''}
          ${(roles ?? []).map(() => "AND EXISTS (SELECT 1 FROM json_each(c.metadata_json, '$.roles') WHERE value = ?)").join('\n')}
```

and after `if (profession) ftsParams.push(profession);` add:

```ts
        if (orgType) ftsParams.push(orgType.toUpperCase());
        for (const role of roles ?? []) ftsParams.push(role);
```

Replace both `rows.map` / `ftsRows.map` result mappers with a shared helper defined above `const store: Store = {`:

```ts
  function toSearchResult(row: any): SearchResult {
    const result: SearchResult = {
      id: row.id,
      name: row.name,
      category: row.category,
      organization: row.organization,
      status: row.status,
      lastContact: row.last_contact,
      path: row.path,
    };
    if (row.category === 'Organization' && row.metadata_json) {
      try {
        const meta = JSON.parse(row.metadata_json);
        if (meta.orgType) result.orgType = String(meta.orgType);
        if (Array.isArray(meta.roles)) result.roles = meta.roles.map(String);
      } catch { /* ignore malformed metadata */ }
    }
    return result;
  }
```

and use `rows.map(toSearchResult)` / `ftsRows.map(toSearchResult)`.

- [ ] **Step 4: Server — tools and helpers**

In `src/server.ts`:

1. Export `resolveTemplateDir` and add the org branch at its top:

```ts
export function resolveTemplateDir(crmRoot: string, store: Store, contactId: string): string | null {
  const outline = store.getOutline(contactId);
  if (outline.contact.category === 'Organization') {
    const orgTpl = join(crmRoot, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'COMMON');
    return existsSync(orgTpl) ? orgTpl : null;
  }
  const category = outline.contact.category.toLowerCase();
```

(the rest of the function is unchanged).

2. Add below `resolveTemplateDir`:

```ts
/**
 * Render relationship edges as "- Source → Target (type) — context".
 * Source is shown because resolved inbound edges appear alongside outbound ones;
 * resolved targets show their display name instead of the raw linkedContacts text.
 */
export function formatConnections(store: Store, connections: Relationship[]): string {
  const nameOf = (id: string): string =>
    (store.db.prepare('SELECT name FROM contacts WHERE id = ?').get(id) as any)?.name ?? id;
  return connections
    .map(c => {
      const target = c.targetId ? nameOf(c.targetId) : c.targetName;
      return `- ${nameOf(c.sourceId)} → ${target} (${c.type})${c.context ? ` — ${c.context}` : ''}`;
    })
    .join('\n');
}
```

Add `Relationship` to the `./types.js` type import (create `import type { Relationship } from './types.js';` if no such import exists).

3. `crm_connections`: replace

```ts
      const lines = connections.map(c => `- ${c.targetName} (${c.type}) — ${c.context}`);
      return respond(lines.join('\n'));
```

with

```ts
      return respond(formatConnections(store!, connections));
```

4. `crm_search`: add parameters

```ts
      roles: z.array(z.string()).optional().describe('Organization roles that must ALL be present (e.g., ["Client","OperatingPartner"])'),
      orgType: z.string().optional().describe('Organization type code: REIT, INV, LP, OPR, DEV, LND, BRK, SAAS, DATA, SVC'),
```

Pass them through: `store!.searchContacts({ query, category, status, profession, roles, orgType, limit })`. In the row renderer, compute the Org cell as:

```ts
        const org = r.orgType ? `${r.orgType}${r.roles?.length ? ` [${r.roles.join(', ')}]` : ''}` : (r.organization || '-');
        const base = `| ${r.id} | ${r.name} | ${org} | ${r.category} | ${r.status} | ${r.lastContact || '-'} |`;
```

Update the tool description to: `'Search contacts and organizations by name, alias/nickname, organization, status, category, profession, org role, or org type. Returns compact results (~50-100 tokens each).'`

5. `crm_create`: change the description to `'Create a new contact or organization dossier from template. For companies use category "Organization" with orgType (and optional cid, roles).'`. Change the `category` describe to `'Category: Client, Network, Family, Personal, Prospect, Organization, etc.'`. Add:

```ts
      orgType: z.string().optional().describe('Organization only: REIT, INV, LP, OPR, DEV, LND, BRK, SAAS, DATA, SVC'),
      cid: z.string().optional().describe('Organization only: company identifier, 2-6 chars (ticker if public, e.g. "PLD")'),
      roles: z.array(z.string()).optional().describe('Organization only: Client, Prospect, IntegrationPartner, ChannelPartner, Competitor, OperatingPartner, Investor, Lender, Employer, TalentTarget'),
```

Update the handler signature and call: `async ({ name, category, organization, context, profession, orgType, cid, roles }) => { … createDossier(store!, config.crmRoot, { name, category, organization, context, profession, orgType, cid, roles }) …`.

6. `crm_read` description: after `Profession-specific sections: …` insert `Organization sections: index, profile, portfolio, intelligence, stakeholders, pipeline, log, competitive, partnership. `

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.json`
Expected: full suite PASS, tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/store.ts src/server.ts test/store.test.ts test/server.test.ts
git commit -m "feat: org role/type search filters, org-aware create/connections/audit tools"
```

---

### Task 7: Oxford end-to-end scenario, docs, build

**Files:**
- Test: `test/integration.test.ts` (append)
- Modify: `README.md` (lines ~8, ~182, ~190, ~201, ~485, plus a new usage example near ~414), `CHANGELOG.md`
- Build: `dist/` via `npm run build`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the end-to-end test**

Append to `test/integration.test.ts`. It sets up its own temp root with templates, following `test/writer.test.ts`'s `beforeEach`. Add any missing imports: `mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync` from `node:fs`, `tmpdir` from `node:os`, `createDossier` from `../src/writer.js`, `createStore` from `../src/store.js`.

```ts
describe('Oxford scenario: org as client and operating partner of another client', () => {
  it('links person → Oxford → client and filters by combined roles', () => {
    const root = mkdtempSync(join(tmpdir(), 'crm-oxford-'));
    mkdirSync(join(root, '.templates'), { recursive: true });
    cpSync(join(import.meta.dirname, '..', 'templates', 'REAL_ESTATE'),
      join(root, '.templates', 'REAL_ESTATE'), { recursive: true });
    cpSync(join(import.meta.dirname, '..', 'templates', 'PROFESSIONAL'),
      join(root, '.templates', 'PROFESSIONAL'), { recursive: true });
    const store = createStore(':memory:', root);
    store.indexAll();

    const client = createDossier(store, root, {
      name: 'XYZ Capital', category: 'Organization', orgType: 'INV', cid: 'XYZ', roles: ['Client'],
    });
    const oxford = createDossier(store, root, {
      name: 'Oxford Properties', category: 'Organization', orgType: 'OPR', cid: 'OXF',
      roles: ['Client', 'OperatingPartner'],
    });
    const idx = join(root, oxford.path, 'INDEX.md');
    writeFileSync(idx, readFileSync(idx, 'utf-8').replace('linkedContacts: []',
      `linkedContacts:\n  - { name: "${client.id}", type: operating_partner_of, context: "Runs TX MF" }`));
    store.indexOne(oxford.path);

    const person = createDossier(store, root, {
      name: 'Jane Doe', category: 'Client', organization: 'Oxford Properties', profession: 'MAM',
    });

    const graph = store.getConnections(person.id, 2);
    expect(graph.some(r => r.type === 'works_at' && r.targetId === oxford.id)).toBe(true);
    expect(graph.some(r => r.type === 'operating_partner_of' && r.targetId === client.id)).toBe(true);

    expect(store.searchContacts({ roles: ['Client', 'OperatingPartner'] }).map(r => r.id)).toEqual([oxford.id]);
    expect(store.searchContacts({ roles: ['Client'] }).map(r => r.id).sort()).toEqual([oxford.id, client.id].sort());
    store.close();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/integration.test.ts`
Expected: PASS. If `profession: 'MAM'` fails because the template isn't copied, confirm `.templates/REAL_ESTATE/D_PROPERTY_ASSET_MANAGEMENT/ASSET_MANAGER` exists in the temp root. It should, since the whole REAL_ESTATE tree is copied.

- [ ] **Step 3: Full suite, typecheck, and count**

Run: `npx vitest run 2>&1 | tail -4 && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, tsc exit 0. Note the total test count N from the `Tests  N passed` line.

- [ ] **Step 4: Update README**

- Line ~8 badge: `Tests-161` → `Tests-N`.
- Line ~485: `(161 tests)` → `(N tests)`.
- Line ~182 `crm_search` row: `| \`crm_search\` | Find contacts and organizations by name, org, status, category, profession, org role, org type | ~50-100 per result |`
- Line ~190 `crm_create` row: `| \`crm_create\` | Create a new dossier from template (optional \`profession\` code; for companies, \`category: "Organization"\` with \`orgType\`, \`cid\`, \`roles\`) |`
- Line ~201 `crm_connections` row: `| \`crm_connections\` | Relationship graph — people and organizations, typed links (e.g. \`operating_partner_of\`, \`works_at\`), multi-hop |`
- After the `crm_create({ name: "Ross Bratt", … })` example (~414), add:

````markdown
### Organization dossiers

Track a company as its own dossier, with multiple roles and typed links to other companies:

```
crm_create({ name: "Oxford Properties", category: "Organization", orgType: "OPR", cid: "OXF",
             roles: ["Client", "OperatingPartner"] })
# → OPR-OXF-001 at Organizations/OPR_Oxford_Properties
```

Link companies in `INDEX.md`:

```yaml
linkedContacts:
  - { name: "INV-XYZ-001", type: operating_partner_of, context: "Runs TX MF portfolio" }
```

People whose `organization` matches a company's name or alias are linked automatically (`works_at`).
Org types: REIT, INV, LP, OPR, DEV, LND, BRK, SAAS, DATA, SVC. Pull the templates with
`crm-mcp templates pull REAL_ESTATE/ORGANIZATION`.
````

- [ ] **Step 5: Update CHANGELOG**

Insert above `## [0.7.3]`:

```markdown
## [Unreleased]

### Added
- **Organization dossiers.** New `Organization` category (`Organizations/`) with `[orgType]-[CID]-[SEQ]` codes, multi-valued `roles`, and proptech / RE SaaS templates (`REAL_ESTATE/ORGANIZATION`: index, profile, portfolio, intelligence, stakeholders, pipeline, log, plus `competitive.md` / `partnership.md` role overlays). Confidentiality block in INDEX.md for info obtained via one relationship about another.
- Typed `linkedContacts` object form (`{ name, type, context }`) with org relation types (`operating_partner_of`, `lp_in`, `gp_of`, `parent_of`, `subsidiary_of`, `integrates_with`, `competes_with`, `acquired_by`, `employs`, `works_at`). Legacy `"Name (Context)"` strings unchanged.
- `crm_search` `roles` (AND) and `orgType` filters; `crm_create` `orgType`, `cid`, `roles` inputs.

### Fixed
- Relationship `target_id` was never resolved, so `crm_connections` could not traverse past one hop or show inbound links. Targets now resolve by dossier code, name, or alias (unique matches only).
- `resolveContact` now recognizes 4-letter dossier-code prefixes (`SAAS-…`, `REIT-…`, `DATA-…`).
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: exit 0, and `dist/mcp-server.mjs` exists. The MCP server failed to start this session with ENOENT on `dist/mcp-server.mjs`, so after building, tell the user to reconnect via `/mcp`.

- [ ] **Step 7: Commit**

```bash
git add test/integration.test.ts README.md CHANGELOG.md
git commit -m "test+docs: Oxford org scenario, README and CHANGELOG for organization dossiers"
```

(`dist/` is only committed if it is tracked: check `git status --short dist | head`. If it shows modified tracked files, include `dist/` in the commit.)

The version bump is deliberately **not** in this plan. Run the `crm:version-bump` skill at release time, per the spec.
