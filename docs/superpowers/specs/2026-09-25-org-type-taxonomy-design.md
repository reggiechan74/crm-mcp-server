# Organization Type Taxonomy & Type-Aware Org Templates — Design

**Date:** 2026-09-25
**Status:** Approved in conversation; pending written-spec review
**Branch:** `refactor/code-review-fixes` (same PR as the code-review fix wave)

## 1. Problem

Organization dossiers (unreleased, `[Unreleased]` in CHANGELOG) were built from a proptech-vendor point of view:

- `ORG_TYPES` has 10 codes, two of which (`SAAS`, `DATA`) only exist because they are what a proptech vendor sells or competes with. Large parts of the real estate ecosystem have no type (title/escrow, law firms, appraisal, contractors, architects, insurers, homebuilders, servicers, occupiers, government, associations).
- The single `ORGANIZATION/COMMON` template is a SaaS-seller's account plan regardless of type: *Technology Buying Behavior*, *Buying Committee*, *Systems of Record / Data Maturity*, and a pipeline of *Pilot/POC → Security Review → Proposal → MSA/Order Form*.
- The role list is similarly vendor-shaped (IntegrationPartner, ChannelPartner, TalentTarget) and lacks everyday RE relationships (Landlord, Tenant, Borrower, JV partner).

The CRM serves any real-estate professional (167 person professions in 18 categories). Organization types must cover the industry, the user must be able to choose, and each dossier's sections must fit what the organization is.

## 2. Goals / Non-goals

**Goals**
- A grouped, industry-wide org-type taxonomy (43 types in 10 groups, plus `OTH`) the user selects from.
- Multi-line firms: one primary type plus secondary types.
- Dossier sections tailored by type group, via overlays on a neutral core.
- The SaaS-seller content preserved as an opt-in "tech-sale" sales motion.
- Broadened relationship roles.
- Audit/repair understands the composed template, so later type changes can be repaired in.

**Non-goals**
- User-defined custom types (templates owning the taxonomy). Revisit if requested.
- Auto-applying overlays when `secondaryTypes`/`roles` change after creation (audit + repair cover it).
- Any change to person dossiers or professions.
- CRLF line-ending preservation (separate, pre-existing).

## 3. Taxonomy (`src/orgTypes.ts`)

A code registry, the single source of truth for validation, tool schemas, composition and audit.

```ts
// Shape of each entry (full contents in the table below)
export const ORG_GROUPS = {
  LENDING: {
    label: 'Lending & Capital',
    overlay: 'LENDING',                    // TYPES/<overlay>; null for OTHER
    types: { BANK: 'Bank / credit union lender', DEBT: 'Debt fund / private lender', /* … */ },
  },
  // OWNERS, BROKERAGE, DEVELOPMENT, OPERATORS, SERVICES, OCCUPIERS, PUBLIC,
  // TECHNOLOGY, ASSOCIATIONS, OTHER — exactly as tabulated in §3
} as const;
```

Derived: `ORG_TYPES: Record<OrgType, { label, group }>`, `OrgType`, `OrgGroup`, `groupOf(code)`, `normalizeOrgType(input)` (case-insensitive; returns code or null). Codes are 2–4 uppercase letters, unique across the registry.

| Group key | Label | Overlay dir | Types (code — label) |
|---|---|---|---|
| `OWNERS` | Owners & Investors | `TYPES/OWNERS` | `REIT` Public REIT · `PRVT` Private / non-traded REIT · `REOC` Real estate operating company · `INV` Investment manager / fund GP · `LP` Institutional allocator (pension, sovereign, endowment, insurer GA) · `FO` Family office / private investor · `SYN` Syndicator / crowdfunding sponsor |
| `LENDING` | Lending & Capital | `TYPES/LENDING` | `BANK` Bank / credit union lender · `DEBT` Debt fund / private lender · `AGCY` Agency lender (DUS, HUD) · `LIFE` Life company lender · `SVCR` Loan servicer / special servicer |
| `BROKERAGE` | Brokerage & Advisory | `TYPES/BROKERAGE` | `BRK` Commercial brokerage · `CAP` Capital markets advisory (debt/equity placement) · `TREP` Tenant representation firm · `RES` Residential brokerage |
| `DEVELOPMENT` | Development & Construction | `TYPES/DEVELOPMENT` | `DEV` Developer · `HB` Homebuilder · `GC` General contractor / construction manager · `ARCH` Architecture / planning firm · `ENG` Engineering firm |
| `OPERATORS` | Operators & Management | `TYPES/OPERATORS` | `PM` Third-party property manager · `OPR` Operating partner (JV) · `FM` Facilities management · `HOSP` Hospitality operator / brand · `SNR` Senior housing operator · `FLEX` Coworking / flex operator |
| `SERVICES` | Professional Services | `TYPES/SERVICES` | `LAW` Law firm · `TTL` Title / escrow · `VAL` Appraisal / valuation · `ACCT` Accounting / fund administration · `CONS` Consulting / research · `ENV` Environmental / property condition · `INS` Insurance broker / carrier |
| `OCCUPIERS` | Occupiers | `TYPES/OCCUPIERS` | `CORP` Corporate occupier · `RTL` Retailer / tenant |
| `PUBLIC` | Public Sector & Nonprofit | `TYPES/PUBLIC` | `GOV` Government / municipality / agency · `HA` Housing authority · `NPO` Nonprofit / CDFI |
| `TECHNOLOGY` | Technology & Data | `TYPES/TECHNOLOGY` | `SAAS` Proptech software · `DATA` Data provider · `BTEC` Building technology / IoT |
| `ASSOCIATIONS` | Industry Bodies | `TYPES/ASSOCIATIONS` | `ASSN` Association / trade organization |
| `OTHER` | Other | — | `OTH` Other organization |

Notes:
- `SNR` (not `SEN`) avoids clashing with the `SEN` asset-class code.
- Removed from the unreleased list: `LND` (→ `BANK`/`DEBT`/`AGCY`/`LIFE`/`SVCR`) and `SVC` (→ the `SERVICES` types). No migration: org dossiers are unreleased and the user's CRM has none.
- No new code collides with a person category code or a profession code (checked).

### Roles

`ORG_ROLES` keeps the existing ten and adds nine:

- Existing: `Client`, `Prospect`, `IntegrationPartner`, `ChannelPartner`, `Competitor`, `OperatingPartner`, `Investor`, `Lender`, `Employer`, `TalentTarget`
- Added: `Landlord`, `Tenant`, `Borrower`, `JVPartner`, `CoInvestor`, `Vendor`, `ServiceProvider`, `ReferralSource`, `Regulator`

`ROLE_OVERLAYS`: `Competitor → COMPETITOR`, `IntegrationPartner`/`ChannelPartner → PARTNER` (unchanged), **`Vendor`/`ServiceProvider → VENDOR`** (new).

## 4. Data model (INDEX.md frontmatter)

| Field | Meaning |
|---|---|
| `orgType` | Primary type code. Determines dossier code `[orgType]-[CID]-[SEQ]` and folder `Organizations/[orgType]_[Name]`. |
| `secondaryTypes` | **New.** List of additional valid codes; deduplicated; never contains `orgType`. |
| `roles` | Relationship roles (list). |
| `salesMotion` | **New.** `general` or `tech`, recorded at creation so audit knows which pipeline template applies. |
| `assetClasses` | Unchanged. |

The group is never stored; it is derived from the type codes. Codes and folders are permanent identifiers: changing `orgType` later does not rename either.

## 5. Templates (`templates/REAL_ESTATE/ORGANIZATION/`)

```
ORGANIZATION/
  COMMON/            neutral core — every organization
  TYPES/<GROUP>/     one overlay per group (except OTHER)
  ROLES/COMPETITOR/  competitive.md      (unchanged)
  ROLES/PARTNER/     partnership.md      (unchanged)
  ROLES/VENDOR/      vendor.md           (new)
  MOTION/TECH_SALE/  tech-stack.md, pipeline.md
```

### 5.1 COMMON (neutralized)

| File | Content |
|---|---|
| `INDEX.md` | Frontmatter adds `secondaryTypes: []`, `salesMotion`. Body: Snapshot, Role Summary, **Relationship Health** (was Account Health), Next Action, Red Flags. Keeps the confidentiality block. |
| `profile.md` | Corporate Identity, Ownership (fund-family content moves to OWNERS), Structure, Market Position, Recent Events. |
| `stakeholders.md` | Org Structure, **Key Decision Makers** (was Buying Committee), Our Relationships (Active / Target / Former), Coverage. |
| `intelligence.md` | Strategy Signals, Priorities & Pain Points, Risks (Relationship / Company Viability), Intelligence Gaps & Sources. *Technology Buying Behavior* removed (→ TECH_SALE). |
| `pipeline.md` | Opportunities with neutral stages **Identified → Qualified → Proposal → Negotiation → Won / Lost**; Stage History; Closed Won/Lost; Expansion. |
| `log.md` | Document registry types: *NDA / LOI / PSA / Lease / Loan Docs / Engagement Letter / Contract*. Interaction log unchanged. |

`portfolio.md` is removed from COMMON (moves to OWNERS, reshaped). COMMON must contain none of: `POC`, `Security Review`, `MSA`, `Order Form`, `Buying Committee`, `Systems of Record`, `Data Maturity`, `Technology Buying`.

### 5.2 Group overlays — one file each

| Overlay | File | Sections |
|---|---|---|
| OWNERS | `portfolio.md` | Holdings by asset class & market; Fund vehicles / fund family; Investment strategy & buy box; Acquisitions & dispositions; Operating partners |
| LENDING | `lending.md` | Credit box (loan types, LTV/DSCR, size range, asset classes, markets); Exposure / loan book; Recent transactions; Servicing & workouts |
| BROKERAGE | `deal-flow.md` | Active listings / mandates; Closed deals & comps; Coverage (markets, specialties, teams); Market position; Fee & co-broke practices |
| DEVELOPMENT | `projects.md` | Projects by stage; Entitlements & approvals; Capital partners; Design & construction relationships |
| OPERATORS | `managed-portfolio.md` | Units / SF under management; Owners served; Services offered; SLAs & KPIs; Operating systems |
| SERVICES | `engagements.md` | Engagements; Panel / approved-vendor status; Practice areas; Fee structures; Key professionals |
| OCCUPIERS | `occupancy.md` | Locations; Lease expirations & events; Footprint strategy; Real estate decision makers |
| PUBLIC | `programs.md` | Jurisdiction; Programs & incentives; Approvals / permits in flight; Policy calendar |
| TECHNOLOGY | `product.md` | Products; Integrations; Customers; Pricing; Roadmap |
| ASSOCIATIONS | `membership.md` | Membership; Committees; Events calendar; Sponsorships |
| ROLES/VENDOR | `vendor.md` | Contract & scope; Spend; SLAs; Renewal date; Performance notes |
| MOTION/TECH_SALE | `tech-stack.md` | Systems of Record; Data Maturity; Technology Buying Behavior; Buying Committee |
| MOTION/TECH_SALE | `pipeline.md` | Today's SaaS stages: Identified → Discovery → Pilot/POC → Security Review → Proposal → MSA/Order Form → Closed Won/Lost |

All overlay files use the standard section frontmatter (`contactName`, `dossierCode`, `tier`, `lastUpdated`) and placeholders, and are compatible with boilerplate stripping.

### 5.3 Composition

Copy order at creation (each step `cpSync` onto the dossier folder):

1. `COMMON`
2. Group overlay of the primary type
3. Group overlays of secondary types, in order, each distinct group once
4. Role overlays, each distinct overlay once
5. `MOTION/TECH_SALE` when the effective sales motion is `tech`

**Overlay rule:** overlays only add files. The single permitted replacement is `MOTION/TECH_SALE/pipeline.md` over `COMMON/pipeline.md`. Enforced by a test over the template tree. A missing overlay directory (templates installed before this change) is skipped at creation, and `crm_create` returns a warning naming the fix (`crm-mcp templates pull REAL_ESTATE/ORGANIZATION`). The audit cannot report sections from a template layer that is not installed, so the warning is the user's signal.

A shared function `orgTemplateLayers(templatesRoot, { orgType, secondaryTypes, roles, salesMotion }): string[]` returns the ordered directory list. Both creation and audit use it.

## 6. Configuration

`~/.crm-mcp.json` gains `salesMotion: "general" | "tech"` (env `CRM_SALES_MOTION` overrides). Default `general`. Any other value → `general` plus one stderr warning. `Config.salesMotion` is typed.

## 7. Tool surface

**`crm_create`**
- `orgType`: fixed-choice enum of registry codes. `secondaryTypes`: array of the same enum. `roles`: array of the `ORG_ROLES` enum.
- New `techSale?: boolean` — overrides `config.salesMotion` for this dossier.
- Writes `orgType`, `secondaryTypes`, `roles`, `salesMotion` to INDEX.md.
- Errors on unknown values list valid options grouped by group label.
- Person-only / org-only argument checks unchanged (`secondaryTypes`, `techSale` are org-only).

**`crm_search`**
- `orgType` (enum): matches primary **or** any secondary type.
- **New** `orgGroup` (enum of group keys): matches when any of the org's types is in the group.
- `roles` (enum array): unchanged AND semantics.
- Result `Org` column: `PM (+BRK, INV) [Client, Lender]`.

**New `crm_org_types`** (read-only): lists groups → types with labels, roles, and the overlay file each group/role/motion adds. Optional `group` argument filters. Added to `TOOL_SUMMARIES`.

**`crm_update`** (index section)
- `orgType`: validated and normalized; reply notes that the code and folder are unchanged and suggests `crm_audit`.
- `secondaryTypes`: list field (JSON array or comma-separated), validated, deduped, primary removed.
- `roles`: validated against the expanded list (existing behavior).

**`crm_read`** description: organization section list updated to COMMON + overlay files.

## 8. Audit & repair

- `resolveTemplateDir` becomes `resolveTemplateDirs(crmRoot, store, contactId): string[]` (the old single-dir export is removed; `test/server.test.ts` is updated to the new name). For organizations it reads INDEX.md (`orgType`, `secondaryTypes`, `roles`, `salesMotion`) and returns `orgTemplateLayers(...)`, filtered to existing directories. Person dossiers return a single directory (current behavior).
- `buildRoutingTable` / `runAudit` / `runRepair` accept `string | string[]`. Layered routing: for each layer in order, a file present in that layer **replaces** all headings previously mapped to that file path, then adds its own. (So TECH_SALE's `pipeline.md` headings replace COMMON's.)
- `repairContact` passes the same layers; ordering fixes use the composed per-file order.
- Resulting workflow: add `LENDING` via `secondaryTypes` → `crm_audit` reports `lending.md` headings as missing (C-codes) → `crm_repair` inserts them.

## 9. Documentation

- README: organization section (groups/types table or pointer to `crm_org_types`), multi-type example, `salesMotion` setting, new tool.
- CHANGELOG `[Unreleased]`: Added (taxonomy, secondary types, org-group search, `crm_org_types`, roles, overlays, `salesMotion`); Changed (neutral COMMON, `LND`/`SVC` replaced).
- `skills/_shared/conventions.md`: update any org-code examples.

## 10. Testing (TDD)

- **Registry:** codes unique, 2–4 uppercase letters, one group each; every non-null overlay dir exists under `templates/`; `OTH` has no overlay; no clash with category or profession codes.
- **Overlay rule:** no file name shipped by two overlays; only `MOTION/TECH_SALE/pipeline.md` shadows a COMMON file.
- **Neutral COMMON:** none of the SaaS-only terms listed in §5.1.
- **Creation:** one dossier per group (code, folder, overlay files); multi-line `BRK + [PM, INV, VAL]` gets four overlays once each; tech-sale via config and via `techSale` flag (both directions); `Vendor` role adds `vendor.md`; invalid type/role errors list grouped options; `OTH` gets COMMON only.
- **Search:** secondary-type match; `orgGroup`; roles combined with type filters.
- **Update:** `secondaryTypes` list/CSV parsing, validation, primary removal; `orgType` change reply.
- **Audit/repair:** secondary type added → missing overlay headings reported → repaired; TECH_SALE dossier does not report neutral pipeline headings missing; person audit unchanged.
- **Config:** `salesMotion` default, env override, invalid value fallback.
- **Existing tests** using `LND`/`SVC` or old COMMON sections updated; Oxford end-to-end scenario rewritten on the new types.

## 11. Delivery

Commits on `refactor/code-review-fixes`: registry & roles → templates → composition & creation → config & tools → audit/repair → docs. Full test suite, typecheck and build green at each commit. Independent Opus review at the end, findings fixed, then one PR covering the review fixes and this feature.
