# CRM Intelligence System for Real Estate Professionals

## What This Is

A contact relationship management system purpose-built for real estate — not a generic CRM bolted onto your workflow, but a markdown-based intelligence platform that understands brokers, appraisers, developers, lenders, lawyers, and 162 other RE profession types out of the box.

Every contact gets a structured dossier with:
- **Deal velocity metrics** on the front page
- **Intelligence files** covering personality, risk, and strategic positioning
- **Profession-specific tracking** — brokers get `deals.md`, appraisers get `assignments.md`, lawyers get `matters.md`, developers get `projects.md`
- **Referral tracking** with net position analysis

You interact with it through natural conversation via [Claude Code](https://claude.ai/code). Ask "what do I know about Ross Bratt?" and it searches, loads, and summarizes — pulling only the sections you need instead of dumping entire files into context.

---

## Why Markdown, Not a SaaS Dashboard

| Concern | How This System Handles It |
|---------|---------------------------|
| **Portability** | Your data is plain text files in folders. No vendor lock-in, no database migrations, no export hassles. Works with Obsidian, VS Code, GitHub, or any text editor. |
| **Privacy** | Contact intelligence stays on your machine or private repo. Nothing uploaded to a third-party CRM platform. |
| **AI-Native** | Built as an MCP server for Claude Code. The AI reads, searches, and updates dossiers through structured tools — not screen-scraping a web UI. |
| **Version Control** | Every change is tracked in git. See who changed what, when, and why. Roll back mistakes instantly. |
| **Customizable** | Templates are markdown files. Edit them with any text editor. No "custom field" limits or pricing tiers. |

---

## The 167 Profession Types

The system maps the real estate ecosystem across **18 categories** with **167 distinct profession types**, each identified by a 3-letter code. When you create a contact, the profession code determines which tracking file they get.

### Category Overview

| # | Category | Professions | Tracking File | What It Tracks |
|---|----------|:-----------:|---------------|----------------|
| A | **Brokerage & Sales** | 10 | `deals.md` | Active/closed/lost deals, deal patterns, co-brokerage history, referral balance |
| B | **Valuation & Advisory** | 8 | `assignments.md` | Appraisal assignments, engagement pipeline, methodology preferences |
| C | **Development & Construction** | 14 | `projects.md` | Development projects, construction timelines, budget tracking |
| D | **Property & Asset Management** | 12 | `portfolio.md` | Properties under management, NOI tracking, tenant mix |
| E | **Finance & Capital Markets** | 16 | `deals.md` | Loan origination, capital raises, fund performance |
| F | **Legal & Compliance** | 8 | `matters.md` | Legal matters, case tracking, regulatory filings |
| G | **Design & Planning** | 10 | `projects.md` | Design projects, planning applications, deliverables |
| H | **Technical & Specialty** | 14 | `assessments.md` | Inspections, environmental assessments, technical reports |
| I | **Government & Municipal** | 8 | `jurisdictions.md` | Jurisdictional authority, approval processes, political dynamics |
| J | **Insurance & Risk** | 6 | `policies.md` | Policy tracking, claims history, coverage analysis |
| K | **Corporate Real Estate** | 7 | `portfolio.md` | Corporate portfolio, site selection history, lease obligations |
| L | **Marketing & Operations** | 10 | `campaigns.md` | Marketing campaigns, listing coordination, event management |
| M | **Accounting & Finance** | 7 | `entities.md` | Entity structures, tax strategies, financial reporting |
| N | **Investment & Principal** | 7 | `holdings.md` | Investment holdings, fund commitments, return tracking |
| O | **Affordable & Public Housing** | 6 | `programs.md` | Housing programs, tax credits, compliance requirements |
| P | **Hospitality & Specialty** | 8 | `assets.md` | Specialty asset tracking (hotels, senior housing, data centers, etc.) |
| Q | **Building Trades** | 8 | `services.md` | Service contracts, work orders, vendor performance |
| R | **Education & Professional** | 8 | `engagements.md` | Speaking engagements, training, recruiting, association work |

### Profession Code Reference

<details>
<summary><strong>A. Brokerage & Sales</strong> (10 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `BSB` | Sales Broker | Commercial/residential sales representation |
| `BLB` | Leasing Broker | Office, retail, industrial leasing |
| `BTR` | Tenant Rep | Tenant-side representation |
| `BLR` | Landlord Rep | Landlord-side representation |
| `BIS` | Investment Sales | Investment property disposition/acquisition |
| `BDE` | Debt & Equity | Debt/equity placement and advisory |
| `BNB` | Note Broker | Mortgage note trading |
| `BBB` | Business Broker | Business sale transactions |
| `BAU` | Auctioneer | Real estate auctions |
| `BRR` | Referral Agent | Referral-based brokerage |

</details>

<details>
<summary><strong>B. Valuation & Advisory</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `VAP` | Appraiser | Property valuation |
| `VRA` | Review Appraiser | Appraisal review and quality control |
| `VCN` | Consultant | Real estate consulting/advisory |
| `VMR` | Market Research | Market analysis and research |
| `VDD` | Due Diligence | Transaction due diligence |
| `VVS` | Valuation Services | Portfolio/bulk valuation |
| `VFA` | Financial Analyst | RE financial modeling and analysis |
| `VDS` | Data Scientist | RE data analytics and proptech |

</details>

<details>
<summary><strong>C. Development & Construction</strong> (14 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `DDV` | Developer | Real estate development |
| `DDM` | Development Manager | Project management for developers |
| `DLA` | Land Agent | Land acquisition and assemblage |
| `DAR` | Architect | Building design and documentation |
| `DGC` | General Contractor | Construction management |
| `DEN` | Engineer | Structural, civil, MEP engineering |
| `DCM` | Construction Manager | On-site construction oversight |
| `DPM` | Project Manager | Construction project coordination |
| `DSU` | Superintendent | Field supervision |
| `DES` | Estimator | Cost estimation |
| `DSC` | Subcontractor | Specialty trade contractor |
| `DET` | Entitlement | Zoning and permitting |
| `DOC` | Owner's Rep | Owner-side project oversight |
| `DPC` | Permit Expediter | Permit processing |

</details>

<details>
<summary><strong>D. Property & Asset Management</strong> (12 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `MPY` | Property Manager | Day-to-day property operations |
| `MAM` | Asset Manager | Portfolio strategy and performance |
| `MFM` | Facilities Manager | Building systems and maintenance |
| `MBE` | Building Engineer | Mechanical/electrical systems |
| `MLC` | Leasing Coordinator | Lease administration support |
| `MTC` | Tenant Coordinator | Tenant relations and buildouts |
| `MRS` | Resident Services | Residential tenant services |
| `MHO` | HOA Manager | Homeowners association management |
| `MPO` | Portfolio Manager | Multi-property portfolio oversight |
| `MRM` | Regional Manager | Multi-site operations management |
| `MLA` | Lease Administrator | Lease abstraction and compliance |
| `MCO` | Concierge | Tenant/resident concierge services |

</details>

<details>
<summary><strong>E. Finance & Capital Markets</strong> (16 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `FMB` | Mortgage Broker | Loan origination |
| `FLO` | Loan Officer | Bank/lender loan processing |
| `FUW` | Underwriter | Credit and collateral analysis |
| `FLS` | Loan Servicer | Post-closing loan administration |
| `FSS` | Special Servicer | Distressed loan workouts |
| `FIR` | Investor Relations | LP communication and reporting |
| `FCR` | Capital Raiser | Equity/debt fundraising |
| `FFM` | Fund Manager | RE fund management |
| `FPA` | Portfolio Analyst | Investment portfolio analysis |
| `FAQ` | Acquisitions | Deal sourcing and underwriting |
| `FDS` | Dispositions | Asset sale execution |
| `FSY` | Syndicator | Investment syndication |
| `FCF` | Crowdfunding | RE crowdfunding platforms |
| `FLN` | Commercial Lender | Direct lending |
| `FEQ` | Equity Partner | JV equity investment |
| `FCD` | Credit Analyst | Credit risk assessment |

</details>

<details>
<summary><strong>F. Legal & Compliance</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `LRE` | RE Lawyer | Transaction and litigation counsel |
| `LTE` | Title & Escrow | Title examination and closing |
| `LTI` | Title Insurance | Title risk underwriting |
| `LCO` | Compliance | Regulatory compliance |
| `LZA` | Zoning Attorney | Land use and zoning law |
| `LEA` | Environmental Attorney | Environmental regulation |
| `LPA` | Paralegal | Legal support services |
| `LCC` | Corporate Counsel | In-house legal |

</details>

<details>
<summary><strong>G. Design & Planning</strong> (10 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `GID` | Interior Designer | Space design and finishes |
| `GSP` | Space Planner | Space utilization and layout |
| `GWS` | Workplace Strategy | Workplace design consulting |
| `GUP` | Urban Planner | Community and land use planning |
| `GLS` | Landscape Architect | Site and landscape design |
| `GHP` | Historic Preservation | Heritage building conservation |
| `GAD` | Architectural Designer | Design-focused architecture |
| `GLD` | Lighting Designer | Lighting systems design |
| `GSC` | Sustainability | Green building and ESG consulting |
| `GVS` | Virtual Staging | Digital staging and visualization |

</details>

<details>
<summary><strong>H. Technical & Specialty</strong> (14 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `TSV` | Surveyor | Land and boundary surveying |
| `TEV` | Environmental | Phase I/II environmental assessments |
| `TGE` | Geotechnical | Soil and foundation engineering |
| `TBI` | Building Inspector | Commercial building inspection |
| `THI` | Home Inspector | Residential inspection |
| `TEC` | Energy Consultant | Energy audits and efficiency |
| `TSC` | Security Consultant | Building security systems |
| `TAC` | Acoustical | Sound and vibration consulting |
| `TAV` | AV Technology | Audio/visual system integration |
| `TFF` | FF&E Specialist | Furniture, fixtures, and equipment |
| `TRP` | RE Photographer | Property photography |
| `TDR` | Drone Operator | Aerial imaging and inspection |
| `TVT` | Virtual Tour | 3D tour and virtual walkthrough |
| `TMS` | Moving & Storage | Relocation logistics |

</details>

<details>
<summary><strong>I. Government & Municipal</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `GZO` | Zoning Official | Zoning administration |
| `GBI` | Building Inspector (Gov) | Municipal building inspection |
| `GPO` | Planning Official | Planning department leadership |
| `GTA` | Tax Assessor | Property tax assessment |
| `GED` | Economic Development | Municipal economic development |
| `GPC` | Planning Commissioner | Planning commission member |
| `GHA` | Housing Authority | Public housing administration |
| `GFM` | Fire Marshal | Fire code enforcement |

</details>

<details>
<summary><strong>J. Insurance & Risk</strong> (6 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `JIB` | Insurance Broker | Property/casualty placement |
| `JRM` | Risk Manager | Risk assessment and mitigation |
| `JCA` | Claims Adjuster | Property damage claims |
| `JLC` | Loss Control | Loss prevention consulting |
| `JRE` | Risk Engineer | Engineering risk assessment |
| `JCW` | Catastrophe Specialist | Natural disaster risk modeling |

</details>

<details>
<summary><strong>K. Corporate Real Estate</strong> (7 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `KCR` | Corporate RE Director | Enterprise portfolio strategy |
| `KSS` | Site Selection | Location analysis and selection |
| `KRL` | Relocation | Corporate relocation management |
| `KWP` | Workplace Services | Workplace operations |
| `KPD` | Procurement | RE vendor/service procurement |
| `KTM` | Transaction Manager | Corporate lease transactions |
| `KST` | Strategic Planner | RE portfolio strategy |

</details>

<details>
<summary><strong>L. Marketing & Operations</strong> (10 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `LMK` | Marketing Coordinator | Brokerage marketing support |
| `LLX` | Listing Coordinator | Listing management and materials |
| `LTC` | Transaction Coordinator | Deal processing and compliance |
| `LOA` | Office Administrator | Brokerage office management |
| `LRM` | Research Manager | Market research operations |
| `LPT` | PropTech | Real estate technology |
| `LPR` | PR Specialist | Industry public relations |
| `LCM` | Communications | Corporate communications |
| `LDS` | Digital Media | Digital marketing and social media |
| `LEM` | Event Manager | Industry event coordination |

</details>

<details>
<summary><strong>M. Accounting & Finance</strong> (7 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `MCT` | Controller | Financial controls and reporting |
| `MRA` | RE Accountant | Property-level accounting |
| `MPA` | Property Accountant | Operational accounting |
| `MBK` | Bookkeeper | Transaction recording |
| `MTS` | Tax Specialist | RE tax planning and compliance |
| `MCF` | CFO | Financial leadership |
| `MAU` | Auditor | Financial and operational auditing |

</details>

<details>
<summary><strong>N. Investment & Principal</strong> (7 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `NPI` | Principal | Direct RE investor/operator |
| `NLP` | LP Investor | Limited partner investor |
| `NFO` | Family Office | Family office RE allocation |
| `NHN` | HNWI | High-net-worth individual investor |
| `NIN` | Institutional Investor | Pension, insurance, endowment RE teams |
| `NSO` | Sovereign/Pension | Sovereign wealth and pension fund RE |
| `NEN` | Endowment | University/foundation RE investment |

</details>

<details>
<summary><strong>O. Affordable & Public Housing</strong> (6 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `OAH` | Affordable Housing Manager | Affordable property operations |
| `OHS` | Housing Specialist | Housing program administration |
| `OCD` | Community Development | Community investment and planning |
| `OTC` | Tax Credit Specialist | LIHTC and tax credit programs |
| `ORS` | Resident Services | Supportive resident services |
| `OFA` | Fair Housing | Fair housing compliance |

</details>

<details>
<summary><strong>P. Hospitality & Specialty</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `PHA` | Hotel Asset Manager | Hospitality portfolio management |
| `PHD` | Hotel Developer | Hospitality development |
| `PSH` | Senior Housing | Senior living and care facilities |
| `PSS` | Self-Storage | Self-storage operations |
| `PDC` | Data Center | Data center development/operations |
| `PLS` | Life Sciences | Lab and life sciences facilities |
| `PSP` | Sports Venue | Sports and entertainment venues |
| `PMH` | Manufactured Housing | Manufactured home communities |

</details>

<details>
<summary><strong>Q. Building Trades</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `QHV` | HVAC Technician | Heating/cooling systems |
| `QPL` | Plumber | Plumbing systems |
| `QEL` | Electrician | Electrical systems |
| `QMT` | Maintenance Technician | General building maintenance |
| `QJA` | Janitorial | Cleaning and janitorial services |
| `QLN` | Landscaping | Grounds maintenance |
| `QSE` | Security Personnel | On-site security |
| `QPT` | Painter | Interior/exterior painting |

</details>

<details>
<summary><strong>R. Education & Professional</strong> (8 types)</summary>

| Code | Profession | Description |
|------|-----------|-------------|
| `REI` | RE Instructor | Real estate education |
| `RRC` | RE Recruiter | Brokerage talent acquisition |
| `RCH` | RE Coach | Broker/agent coaching |
| `RAS` | Association | Industry association leadership |
| `RJO` | RE Journalist | Industry media and reporting |
| `RSP` | Speaker | Conference and event speaking |
| `RDP` | Data Provider | CoStar, REIS, Yardi, etc. |
| `RSW` | Software Vendor | RE technology solutions |

</details>

---

## Dossier Structure

Every contact gets 7 files organized across 3 tiers. The system uses **progressive disclosure** — you start with a lightweight summary and drill deeper only when needed.

### File Layout

```
CRM/
└── Network/
    └── BRATT_Ross/                          # BSB-BRARO-001
        ├── INDEX.md          ← Quick reference (Tier 1: ~60 lines)
        ├── profile.md        ← Full contact details (Tier 2: ~210 lines)
        ├── intelligence/
        │   ├── intelligence-profile.md    ← Personality & communication (Tier 3)
        │   ├── intelligence-strategic.md  ← Network mapping & strategy (Tier 3)
        │   └── intelligence-risk.md       ← Risk factors & threat assessment (Tier 3)
        ├── deals.md          ← Profession-specific tracking (Tier 2)
        └── log.md            ← Interaction log & summary stats (Tier 2)
```

### What Each File Contains

| File | Purpose | Key Sections |
|------|---------|-------------|
| **INDEX.md** | One-glance summary | Snapshot table, quick contact info, deal velocity (last 12 months), relationship notes, red flags |
| **profile.md** | Full background | Contact info, professional background, career history, education & credentials, relationship history, market specialization, competitive positioning, communication preferences, personal context |
| **intelligence-profile.md** | How they think | Personality type, communication patterns, decision-making style, negotiation behavior, emotional triggers, trust signals |
| **intelligence-strategic.md** | How to work with them | Organizational influence, network mapping, key relationships, gatekeepers, opportunities, risks, competitive intelligence, engagement strategy |
| **intelligence-risk.md** | What to watch for | Ethical profile, reputation risks, litigation history, financial stability, compliance concerns, relationship risks |
| **[tracking].md** | What they do | Profession-specific — see tracking file details below |
| **log.md** | What happened | Chronological interaction log with summary statistics, related documents |

### The 19 Tracking File Types

The tracking file is what makes this system profession-aware. A sales broker's `deals.md` looks nothing like an appraiser's `assignments.md` or a government official's `jurisdictions.md`.

| Tracking File | Used By | Key Sections |
|---------------|---------|-------------|
| `deals.md` | Brokers, Investment Sales, D&E, Capital Markets | Active/closed/lost deals, deal patterns by asset class, co-brokerage history, referral tracking with net position |
| `assignments.md` | Appraisers, Review Appraisers, Consultants | Engagement pipeline, assignment history, methodology, turnaround tracking |
| `projects.md` | Developers, Architects, Engineers, Designers | Project pipeline, timeline tracking, budget/cost analysis, deliverables |
| `portfolio.md` | Property/Asset/Portfolio Managers, Corporate RE | Properties under management, NOI tracking, tenant mix, capital projects |
| `matters.md` | Lawyers, Title/Escrow, Compliance | Legal matters by type, case status, opposing counsel, fee tracking |
| `assessments.md` | Inspectors, Environmental, Geotechnical, Energy | Assessment pipeline, report tracking, findings, follow-up requirements |
| `jurisdictions.md` | Zoning Officials, Planning, Tax Assessors, Fire Marshal | Jurisdictional authority, approval processes, political dynamics, key contacts |
| `policies.md` | Insurance Brokers, Risk Managers, Claims | Policy tracking, coverage analysis, claims history, loss control recommendations |
| `campaigns.md` | Marketing, Listing Coords, Digital Media, PR | Campaign tracking, performance metrics, content calendar, event management |
| `entities.md` | Controllers, Accountants, Tax Specialists | Entity structures, tax positions, financial reporting, audit tracking |
| `holdings.md` | Principals, LP Investors, Family Offices, HNWI | Investment holdings, fund commitments, return tracking, capital calls |
| `programs.md` | Affordable Housing, Community Development | Program tracking, compliance requirements, funding sources, resident outcomes |
| `assets.md` | Hotel, Senior Housing, Self-Storage, Data Center | Specialty asset performance, operational metrics, market positioning |
| `services.md` | HVAC, Plumbing, Electrical, Maintenance, Janitorial | Service contracts, work orders, response times, vendor performance |
| `engagements.md` | Instructors, Coaches, Recruiters, Speakers | Speaking/training engagements, recruiting mandates, association activities |
| `closings.md` | Title & Escrow, Loan Servicers | Closing pipeline, document tracking, disbursement |
| `loans.md` | Loan Officers, Underwriters, Commercial Lenders | Loan pipeline, terms tracking, portfolio performance |
| `acquisitions.md` | Acquisitions, Dispositions specialists | Deal pipeline, underwriting, due diligence tracking |
| `investments.md` | Fund Managers, Syndicators, Crowdfunding | Investment vehicles, LP commitments, distributions |

---

## How It Works in Practice

### Creating a Contact

```
You: "Add Ross Bratt — he's a sales broker at CBRE, met him at the NAIOP event"

Claude: [uses crm_create with name="Ross Bratt", category="Network", profession="BSB",
         organization="CBRE", context="Met at NAIOP event"]
       → Creates BSB-BRARO-001 with deals.md tracking file
```

The dossier code `BSB-BRARO-001` breaks down as:
- `BSB` = Sales Broker (profession code)
- `BRARO` = BRATT + ROss (name hash)
- `001` = first contact with this name hash

### Searching and Reading

```
You: "What do I know about Ross Bratt?"

Claude: [crm_search → finds BSB-BRARO-001]
        [crm_outline → shows section sizes and fill percentages]
        [crm_read section="index" → loads 60-line quick reference]

"Ross Bratt is a Sales Broker at CBRE. Relationship strength: 7/10.
 Last 12 months: 3 deals referred, 1 closed together, $2.4M volume.
 Next action: Follow up on industrial listing lead (due March 15)."
```

The system uses **progressive disclosure** — it starts with the lightweight INDEX.md (~150 tokens) and only loads heavier files when you ask for specifics. This is 10x more efficient than loading entire dossiers.

### Updating Intelligence

```
You: "Update Ross's profile — he just moved to Cushman & Wakefield as Managing Director"

Claude: [crm_update field="organization" value="Cushman & Wakefield"]
        [crm_read section="profile" → loads career history]
        [adds new row to Career History table]
```

### Logging Interactions

```
You: "Had coffee with Ross today. He mentioned he's working on a 200K sf
      industrial deal in Vaughan. Looking for a JV equity partner."

Claude: [crm_log → appends timestamped entry to log.md]
        [crm_update → updates "Last Contact" in INDEX.md]
        [crm_read section="deals" → checks for existing deal entry]
        [adds to Active Deals table in deals.md]
```

### Intelligence Gathering

```
You: "Prep me for a meeting with Ross tomorrow"

Claude: [crm_read section="intelligence-profile" → communication style]
        [crm_read section="intelligence-strategic" → current opportunities]
        [crm_read section="deals" → active deal pipeline]
        [crm_read section="log" → recent interactions]

"Ross prefers direct communication, values data-driven arguments.
 He has 2 active deals: the Vaughan industrial (needs equity partner)
 and a retail disposition in Mississauga. Last spoke March 1 about
 the NAIOP committee. Consider: offer to connect him with your LP
 contact for the Vaughan deal — builds reciprocity."
```

---

## Token Efficiency

Every CRM response includes a token estimate footer showing exactly how much AI context each call consumes:

```
<!-- 599 chars | ~150 tokens -->
```

The progressive disclosure workflow is designed to minimize token usage:

| Operation | Tokens | What You Get |
|-----------|--------|-------------|
| `crm_search` | ~50-100 | Name, code, category, status |
| `crm_outline` | ~200-400 | All sections with sizes and fill % |
| `crm_read` (index) | ~150 | Quick reference snapshot |
| `crm_read` (profile) | ~500 | Full contact background |
| `crm_read` (deals) | ~200-800 | Deal history and pipeline |
| `crm_read` (intelligence) | ~250 each | One intelligence file |

Compare to loading an entire dossier at once: **~3,000+ tokens**. Progressive disclosure typically uses **300-800 tokens** per interaction.

---

## Audit & Repair

The system includes a 5-pass audit engine that validates dossiers against their templates:

| Pass | What It Checks | Example Finding |
|------|---------------|-----------------|
| **Compliance** | Missing sections the template defines | "deals.md missing Referral Tracking section" |
| **Misplaced** | Content in the wrong file | "Deal info found in profile.md — belongs in deals.md" |
| **Stale** | Outdated fields contradicted by log | "Organization says CBRE but log shows C&W move" |
| **Duplicates** | Same content across multiple files | "Contact info duplicated in INDEX.md and profile.md" |
| **Ordering** | Sections out of template order | "Career History appears before Contact Information" |

The repair engine applies fixes automatically in dependency order, with content integrity validation.

---

## Installation

### As a Claude Code Plugin (Recommended)

```bash
# 1. Add the marketplace
/plugin marketplace add reggiechan74/crm-mcp-server

# 2. Install the plugin
/plugin install crm@crm-mcp-server

# 3. Initialize — choose your CRM directory, select templates
crm-mcp init

# 4. Pull the Real Estate template pack
crm-mcp templates pull REAL_ESTATE

# Or pull just the categories you need:
crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES
crm-mcp templates pull REAL_ESTATE/E_FINANCE_CAPITAL_MARKETS
```

### Manual Install

```bash
git clone git@github.com:reggiechan74/crm-mcp-server.git
cd crm-mcp-server
npm install && npm run build
npx crm-mcp init
npx crm-mcp templates pull REAL_ESTATE
```

---

## Template Customization

All templates are copied to your local `<CRM_ROOT>/.templates/` directory on install. You can customize any file — the system tracks content hashes and preserves your changes across updates.

| Upstream Updated? | You Customized? | What Happens |
|:-:|:-:|:--|
| No | -- | Skipped (up to date) |
| Yes | No | Auto-updated |
| Yes | Yes | Skipped with warning (your edits preserved) |

Common customizations:
- Add asset classes to the deal tracking tables
- Modify the intelligence sections for your market
- Add custom fields to INDEX.md snapshot
- Create new tracking file types for niche professions

---

## Technical Details

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js >= 22, TypeScript (strict ESM) |
| Search | SQLite with FTS5 full-text search |
| Semantic Search | Transformers.js local vector embeddings (optional) |
| Protocol | Model Context Protocol (MCP) |
| Tests | 140 tests via Vitest |
| Storage | Plain markdown files, git-versioned |

---

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `crm_search` | Find contacts by name, org, status, category, profession |
| `crm_outline` | Structural overview with section sizes and fill % |
| `crm_read` | Read a specific section (boilerplate stripped, token-counted) |
| `crm_create` | Create a new dossier from template (with optional profession code) |
| `crm_update` | Update a YAML field in a dossier |
| `crm_log` | Append an interaction to the contact's log |
| `crm_bulk_update` | Update a field across multiple contacts |
| `crm_export` | Export contacts as JSON, CSV, or markdown |
| `crm_connections` | Relationship graph — who they know and how |
| `crm_recent` | Most recently contacted people |
| `crm_stats` | CRM-wide statistics |
| `crm_vector_search` | Semantic search across all dossier content |
| `crm_audit` | Analyze dossier structural health (5 passes) |
| `crm_repair` | Apply fixes from audit results |
| `crm_templates_list` | List installed and available templates |
| `crm_templates_pull` | Download a template from GitHub |

---

*Built for real estate professionals who want their contact intelligence to work as hard as they do.*
