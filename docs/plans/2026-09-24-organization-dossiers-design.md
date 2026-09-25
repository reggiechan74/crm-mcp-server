# Organization Dossiers (Proptech / RE SaaS)

**Date:** 2026-09-24
**Status:** Draft — pending review
**Origin:** Adapts the BI-CRM Corporate Dossier Design (2026-01-27, `reggie-life-plan/09_AGENT_REPORTS/project-manager/2026-01-27_BI-CRM_Corporate_Dossier_Design/`) into crm-mcp-server as a first-class dossier kind.

## Problem

The CRM is person-only. `organization` is a free-text field on a contact, and there is no way to record a company as a dossier. Working in proptech / RE data SaaS (Cherre / RealPage), the relationships that matter are between **companies** as much as people:

- One company plays several roles at once. Oxford can be a direct client *and* the operating partner of another client.
- Any RE LP is a potential client; partners can also be clients; competitors, partners, colleagues and career contacts all sit at proptech firms.
- We need to track the corporate entity and the individuals who work there, linked to each other.

Existing RE profession templates don't cover this. All 167 professions share identical `profile.md` / `intelligence/*.md`; only the tracking file differs, and the proptech-adjacent ones (`LPT` campaigns.md, `RSW` / `RDP` engagements.md) are marketing and speaker/educator templates respectively.

Two gaps in current code also block a useful company graph:

1. `extractRelationships` (`src/parser.ts:376`) only parses `"Name (Context)"` strings and hard-codes `type: 'associated'`. Typed edges are impossible.
2. `targetId` is always `''` (`src/parser.ts:394`). `getConnections` (`src/store.ts:483`) therefore cannot traverse past depth 1 or find inbound edges.

## Goals

- Create, index, search, read, update and log **organization dossiers** using the existing tools.
- Multi-valued **roles** per organization, filterable in search.
- **Typed org-to-org and person-to-org links**, traversable by `crm_connections`.
- Proptech / RE SaaS-specific templates (seller's perspective: what does this company need, how do they buy, where do they fit in the graph).
- A **confidentiality** record for information obtained through one relationship about another.

## Non-Goals

- BI-CRM's `reports/` aggregation layer and its separate plugin packaging (11 commands / 4 skills / 3 agents).
- Separate overlay files for LP/Investor, Employer and TalentTarget roles.
- The proptech **person** tracking-file rewrite (`RSW` / `RDP`). That is sub-project 2 and gets its own design.
- DB schema changes. `metadata_json` and `relationships` suffice.

## Design

### 1. Organization as a category

`src/types.ts`:

```ts
export type Category = ... | 'Organization';
CATEGORY_CODES: { ..., OR: 'Organization' }
CATEGORY_DIRS:  { ..., Organization: 'Organizations' }
```

The parser already walks every `CATEGORY_DIRS` entry, so indexing, `crm_search`, `crm_outline`, `crm_read`, `crm_update`, `crm_log`, `crm_stats`, `crm_audit` and export pick up orgs with no further changes. Stats report orgs as their own category.

### 2. Org type taxonomy

`src/orgTypes.ts` (new, mirrors `professions.ts`):

| Code | Type |
|------|------|
| REIT | Public REIT |
| INV | Private equity RE fund / GP / investment manager |
| LP | Allocator: pension, sovereign, endowment, insurer, family office |
| OPR | Operating partner / third-party property manager |
| DEV | Developer |
| LND | Lender / debt fund / servicer |
| BRK | Brokerage |
| SAAS | Proptech software vendor |
| DATA | RE data provider |
| SVC | Fund admin / accounting / consulting services |

Asset-class tags (free array, validated against a list, not part of the code): `MF, SFR, OFF, IND, RET, DC, LS, SEN, SS, HOS, LAND, MIX`.

Roles (validated list): `Client, Prospect, IntegrationPartner, ChannelPartner, Competitor, OperatingPartner, Investor, Lender, Employer, TalentTarget`.

### 3. Creating an org dossier

`crm_create` gains optional inputs, required only when `category: "Organization"`:

| Input | Type | Notes |
|-------|------|-------|
| `orgType` | enum of org type codes | Required for orgs |
| `cid` | string, 2–6 chars `[A-Z0-9.]` | Optional. Ticker if public. Default: initials of multi-word name if ≥ 2 words, else first 4 letters, uppercased |
| `roles` | array of role enum | Optional, default `[]` |

`createDossier` (`src/writer.ts:241`) branches on `category === 'Organization'`:

- **Dossier code:** `[orgType]-[CID]-[SEQ]`, e.g. `OPR-OXF-001`. SEQ increments on collision within the same `orgType-CID` prefix, reusing the existing seq-scan logic.
- **Folder:** `Organizations/[orgType]_[Company_Name]`, where the name has non-alphanumerics collapsed to `_`. Example: `OPR_Oxford_Properties`.
- **Template:** copy `.templates/REAL_ESTATE/ORGANIZATION/COMMON/`, then for each role with an overlay, copy its file:
  - `Competitor` → `ROLES/COMPETITOR/competitive.md`
  - `IntegrationPartner` or `ChannelPartner` → `ROLES/PARTNER/partnership.md`
- **Placeholders:** existing `{{name}} {{dossierCode}} {{date}} {{context}} {{category}}` plus `{{orgType}}` and `{{roles}}`. `{{organization}}` and `{{profession}}` resolve to `''`.
- The INDEX.md frontmatter rewrite writes `orgType`, `roles` and `assetClasses: []`.

Missing `orgType` on an Organization → error listing valid codes. Person-only inputs (`profession`) on an Organization → error.

Adding a role later (e.g. a partner becomes a competitor) is done by editing `roles` and pulling the overlay manually. Automatic overlay-on-update is out of scope.

### 4. Typed links

**YAML format.** `linkedContacts` accepts both the legacy string form and a new object form:

```yaml
linkedContacts:
  - "Jane Doe (met at NMHC)"                     # legacy → type 'associated'
  - { name: "INV-XYZ-001", type: operating_partner_of, context: "TX MF portfolio" }
```

`extractRelationships` handles objects: `name` → `targetName`, `type` validated against `RelationType` (unknown → `associated`), `context` optional.

**New `RelationType` values:** `operating_partner_of, lp_in, gp_of, parent_of, subsidiary_of, integrates_with, competes_with, acquired_by, employs, works_at`.

**Target resolution.** After the full index pass, a new `store.resolveRelationshipTargets()` sets `target_id` by matching `target_name`, case-insensitive, in this order:

1. dossier code (`id`)
2. exact `name`
3. exact alias

Ambiguous or no match → stays `''`, as today. This fixes multi-hop traversal and inbound edges for people too.

**Auto person→org link.** During resolution, each non-Organization contact whose `organization` exactly matches (case-insensitive) an Organization's name or alias gets an edge `works_at` from person to org, stored with `context: 'auto'`. It is re-derived on every reindex (existing `context='auto'` edges are deleted first), so renaming a person's organization updates the link.

### 5. Roles in search

`crm_search` gains optional `role` and `orgType` filters. Both are matched against `metadata_json` via SQLite `json_each` / `json_extract`. `role` may be given twice to require both (e.g. Client AND OperatingPartner). Result rows for orgs show `orgType` and `roles` in place of profession.

### 6. Templates

Location: `templates/REAL_ESTATE/ORGANIZATION/`. This is outside the `A_`–`R_` profession categories and is not registered in `template.json` `professions`. Add `"organization": "ORGANIZATION"` to `template.json` so `templates pull REAL_ESTATE/ORGANIZATION` works. `init` copies it with the rest of REAL_ESTATE.

```
ORGANIZATION/
├── COMMON/
│   ├── INDEX.md
│   ├── profile.md
│   ├── portfolio.md
│   ├── intelligence.md
│   ├── stakeholders.md
│   ├── pipeline.md
│   └── log.md
└── ROLES/
    ├── COMPETITOR/competitive.md
    └── PARTNER/partnership.md
```

`SECTION_FILES` gains `portfolio, stakeholders, pipeline, competitive, partnership`. The org `intelligence.md` is flat, so `crm_read section:"intelligence"` must resolve to `intelligence.md` for orgs. Add `'intelligence': 'intelligence.md'` to `SECTION_FILES`; person dossiers keep using `intelligence-profile` etc.

Every table cell carries a `[V]` / `[I]` / `[A]` confidence tag (verified / inferred / assumed). Target ≤ ~100 populated lines per file.

**`INDEX.md`**

```yaml
---
name: "{{name}}"
dossierCode: "{{dossierCode}}"
category: Organization
orgType: "{{orgType}}"
assetClasses: []
roles: {{roles}}
accountTier: T3                 # T1 strategic / T2 core / T3 opportunistic
aliases: []
parentOrg: ""
relationshipOwner: ""
linkedContacts: []
confidentiality: []             # - { source: "...", rule: "..." }
status: Active
lastUpdated: {{date}}
templateVersion: "1.0"
---
```

Body sections:

- **Snapshot:** HQ, AUM, assets/units, headcount, parent.
- **Role Summary:** one row per role, with status and a "so what".
- **Account Health:** ARR, renewal, adoption, qualification score 1–100.
- **Next Action.**
- **Red Flags.**

**`profile.md`**

1. Corporate Identity: legal name, trade names, ticker / LEI, HQ, founded.
2. Ownership & Capital: public/private, parent, fund family table (vintage, size, strategy core / VA / opportunistic / debt, stage fundraising / deploying / harvesting).
3. Structure: subsidiaries, regional offices, JV platforms.
4. Market Position: peer set, memberships (NCREIF / PREA / NAREIT / ULI).
5. Recent Events.

**`portfolio.md`** (optional for SAAS / DATA orgs)

1. Portfolio: AUM, assets/units by asset class × market, trajectory.
2. Operating Model: in-house vs third-party; table of operating partners and the assets they run.
3. Systems of Record: table (category, vendor, module, renewal, satisfaction) covering:
   - property management: Yardi / MRI / RealPage / Entrata / AppFolio
   - lease admin
   - accounting / GL
   - IR / portal: Juniper Square / Agora
   - valuation: ARGUS
   - deal pipeline: Dealpath
   - leasing: VTS
   - market data: CoStar / Green Street
   - warehouse / BI: Snowflake / Databricks / Power BI
4. Data Maturity: data team, current integration method, quality pain points, sources to unify.
5. Reporting Obligations: LP cadence, ODCE / NCREIF, GRESB / ESG, lender reporting.

**`intelligence.md`**

1. Strategy Signals: stated vs revealed.
2. Technology Buying Behavior: central vs BU, build vs buy, adoption pattern, InfoSec and procurement timelines.
3. Pain Points: confirmed and inferred, mapped to product line.
4. Risks: account risks and company viability risks.
5. Intelligence Gaps & Source Reliability.

**`stakeholders.md`**

1. Org Structure.
2. Buying Committee:
   - economic buyer: CIO / COO / CFO
   - technical buyer: CTO / Head of Data
   - users: Asset Mgmt / Portfolio Mgmt / Investor Reporting / Fund Accounting
   - gatekeepers: InfoSec / Procurement / Legal
   - stance per person: champion / supporter / neutral / blocker
3. Our Relationships: active, target and former contacts, each linked by person dossier code.
4. Coverage: threading by level, gaps, plan.

**`pipeline.md`**

1. Account Summary: ARR, first contract, renewal, modules, connected data sources, adoption health.
2. Active Opportunities (block each): module, ACV, stage, champion / blocker, competitors. Stages: `Identified → Discovery → Pilot/POC → Security Review → Proposal → MSA/Order Form → Closed Won / Closed Lost`.
3. Stage History.
4. Closed Won / Lost. Loss reasons: `PRICE, FIT, TIMING, COMPETITOR, BUILD_INTERNAL, SECURITY, CHAMPION_LEFT, NO_DECISION`.
5. Expansion: cross-sell, renewal plan, **graph-adjacent expansion** (e.g. extend via operating-partner links to the client's portfolio).

**`log.md`:** the person log format, so `crm_log` is unchanged, plus a stakeholder column and a Document Registry (NDA / MSA / SOW / security questionnaire, with dates and status).

**`ROLES/COMPETITOR/competitive.md`**

1. Product Overlap: product-by-product matrix.
2. Pricing & Packaging Signals: public or deal-surfaced only; never client data.
3. Win/Loss vs Them.
4. GTM: segments, recent logos, partnerships, messaging.
5. Talent Flows.
6. Watch List.

**`ROLES/PARTNER/partnership.md`**

1. Partnership Type.
2. Integration Status: connector / API, data direction, `scoped → built → certified → live`, clients using it.
3. Co-Sell: shared accounts, joint deals, referral balance.
4. Commercial Terms.
5. Partner Contacts.

### 7. Confidentiality

`confidentiality` in INDEX.md frontmatter is a list of `{ source, rule }`. `crm_read` of an org INDEX.md surfaces it at the top. It is not stripped as boilerplate. Standing template guidance (a comment in `competitive.md` and `pipeline.md`): never record one client's pricing, rent or operational data in another client's or a competitor's dossier. No automated enforcement in this iteration.

## Testing

- `test/writer.test.ts`:
  - org create produces the right code, folder and COMMON files
  - role overlays are copied only for matching roles
  - CID defaulting and collision SEQ
  - missing `orgType` errors
- `test/parser.test.ts`:
  - object-form `linkedContacts`
  - unknown type → `associated`
  - legacy strings unchanged
  - `orgType` / `roles` land in metadata
- `test/store.test.ts`:
  - target resolution by code, name and alias
  - ambiguous names stay unresolved
  - auto `works_at` edges created and re-derived
  - `getConnections` depth 2 (person → org → org)
- `test/server.test.ts`: `crm_create` org inputs; `crm_search` `role` / `orgType` filters, including two roles combined with AND.
- `test/templates.test.ts` / `init.test.ts`: ORGANIZATION ships and pulls.
- `test/integration.test.ts`: Oxford scenario. Org A (`OPR`, roles Client + OperatingPartner) `operating_partner_of` org B (`INV`, Client), plus a person at A. `crm_connections` from the person at depth 2 reaches B.

## Docs

- README: tools table (new `crm_create` / `crm_search` params), category list, test count.
- CHANGELOG entry; version bump via the `crm:version-bump` skill at release time.

## Sub-project 2 (separate design, after this ships)

Rewrite the `RSW` and `RDP` tracking files as proptech SaaS person templates: product/platform, integrations owned, GTM motion, career moves. Link people to org dossiers via `works_at`.
