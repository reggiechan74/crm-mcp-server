# CRM Plugin Skills — Architecture Design

**Date:** 2026-03-05
**Status:** Approved
**Scope:** 19 plugin-bundled skills for crm-mcp-server

---

## 1. Overview

Add 19 skills to the CRM plugin, organized into 5 categories. Each skill orchestrates existing MCP tools into higher-level workflows. Skills are bundled inside the plugin at `skills/` so they travel with every installation.

### Skill Roster

| # | Skill | Category | Pattern | Priority |
|---|-------|----------|---------|:--------:|
| 1 | `intel-briefing` | Preparation | Single-contact deep read | P1 |
| 2 | `deal-parties` | Preparation | Graph traversal | P1 |
| 3 | `event-prep` | Preparation | Multi-contact aggregation | P2 |
| 4 | `relationship-pulse` | Maintenance | Multi-contact aggregation | P1 |
| 5 | `post-meeting` | Maintenance | Single-contact deep read | P1 |
| 6 | `crm-health` | Maintenance | Multi-contact aggregation | P2 |
| 7 | `enrich-contact` | Research | Single-contact deep read | P2 |
| 8 | `find-path` | Research | Graph traversal | P2 |
| 9 | `competitive-intel` | Research | Graph traversal | P3 |
| 10 | `pipeline-review` | Reporting | Multi-contact aggregation | P2 |
| 11 | `relationship-roi` | Reporting | Multi-contact aggregation | P3 |
| 12 | `annual-review` | Reporting | Multi-contact aggregation | P3 |
| 13 | `medical-briefing` | Personal & Family | Single-contact deep read | P1 |
| 14 | `family-health-dashboard` | Personal & Family | Multi-contact aggregation | P2 |
| 15 | `birthday-and-dates` | Personal & Family | Multi-contact aggregation | P2 |
| 16 | `education-tracker` | Personal & Family | Single-contact deep read | P3 |
| 17 | `family-intel` | Personal & Family | Single-contact deep read | P2 |
| 18 | `gift-intel` | Personal & Family | Single-contact deep read | P3 |
| 19 | `life-event-support` | Personal & Family | Graph traversal | P3 |

### Implementation Phases

| Phase | Skills | Rationale |
|-------|--------|-----------|
| **Phase 1** | intel-briefing, post-meeting, relationship-pulse, deal-parties, medical-briefing | Daily-use skills, immediate ROI, one from each pattern type |
| **Phase 2** | event-prep, crm-health, enrich-contact, find-path, family-intel, family-health-dashboard, birthday-and-dates, pipeline-review | Weekly/monthly use, builds on Phase 1 conventions |
| **Phase 3** | competitive-intel, relationship-roi, annual-review, education-tracker, gift-intel, life-event-support | Situational use, depends on CRM data maturity |

---

## 2. Architecture

### Plugin Structure

```
crm-mcp-server/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── intel-briefing/
│   │   └── SKILL.md
│   ├── post-meeting/
│   │   └── SKILL.md
│   ├── relationship-pulse/
│   │   └── SKILL.md
│   ├── ... (19 total)
│   └── _shared/
│       └── conventions.md        ← shared reference loaded by skills that need it
├── src/                          ← MCP server (existing)
├── templates/                    ← dossier templates (existing)
└── docs/
```

### Execution Patterns

Skills orchestrate MCP tools — they contain no code, only instructions for Claude on how to chain tool calls and format output.

**Pattern A: Single-Contact Deep Read**
```
User prompt → crm_search (find contact) → crm_outline (see what's populated)
→ crm_read × N (load relevant sections) → crm_connections (optional)
→ synthesize and format output
```
Token budget: 1,500–3,000 tokens input, depending on sections read.

**Pattern B: Multi-Contact Aggregation**
```
User prompt → crm_search or crm_stats (get contact list)
→ crm_read section="index" × N (lightweight scan)
→ selective crm_read deeper sections for flagged contacts
→ aggregate and format output
```
Token budget: Must stay under 5,000 tokens. Use index-level data for scanning (50–150 tokens per contact). Only drill into full sections for the top 5–10 flagged contacts.

**Pattern C: Graph Traversal**
```
User prompt → crm_vector_search (semantic search across all content)
→ crm_connections for each hit → crm_read for relevant sections
→ build relationship map → format output
```
Token budget: 2,000–4,000 tokens. Vector search returns ranked results; limit to top 10–15 hits.

### Shared Conventions

All skills follow these conventions (documented in `_shared/conventions.md`):

**Allowed Tools:**
All skills use: `mcp__plugin_crm_crm__crm_search`, `mcp__plugin_crm_crm__crm_outline`, `mcp__plugin_crm_crm__crm_read`, `mcp__plugin_crm_crm__crm_update`, `mcp__plugin_crm_crm__crm_log`, `mcp__plugin_crm_crm__crm_connections`, `mcp__plugin_crm_crm__crm_vector_search`, `mcp__plugin_crm_crm__crm_stats`, `mcp__plugin_crm_crm__crm_recent`, `mcp__plugin_crm_crm__crm_audit`, `mcp__plugin_crm_crm__crm_repair`, `mcp__plugin_crm_crm__crm_export`, `mcp__plugin_crm_crm__crm_bulk_update`, `mcp__plugin_crm_crm__crm_create`

Skills that need external data also declare: `Bash`, `Read`, `Write`

**Output Format:**
- Start with a one-line summary sentence
- Use markdown tables for structured data
- Use headers to separate sections
- End with "Recommended Next Actions" as a numbered list
- No emoji unless the user's prompt uses them

**Contact Resolution:**
- If the user names a contact, use `crm_search` first
- If ambiguous (multiple hits), present options and ask
- If not found, offer to create via `crm_create`

**Token Awareness:**
- Every `crm_read` returns a token footer — skills should respect these costs
- Multi-contact skills scan at index level first, drill deeper selectively
- Never read all sections for all contacts in a single skill invocation

**Model Tiers:**
- `model: haiku` — lightweight scans, date lookups, structural checks (birthday-and-dates, crm-health, gift-intel)
- `model: sonnet` — heavy aggregation across many contacts (annual-review, pipeline-review, relationship-roi, competitive-intel, family-health-dashboard)
- Default (opus) — nuanced synthesis, sensitive context, conversational interaction (everything else)

**Runtime Prompts (AskUserQuestion):**
- Reporting skills ask before writing to file: "Save this report to a file?"
- Cross-project skills ask before accessing data outside CRM: "I can also pull in [source] — include that?"

**Error Handling:**
- If a section is empty or the dossier is thin, note the gap and suggest `enrich-contact`
- If the CRM search returns nothing, say so plainly — don't fabricate

---

## 3. Skill Specifications

### PREPARATION

---

#### 3.1 `intel-briefing`

**Trigger:** "brief me on [name]", "prep me for meeting with [name]", "intel on [name]", "what do I know about [name]", "dossier on [name]"

**Purpose:** Full intelligence synthesis for a single contact before a meeting, call, or negotiation.

**Workflow:**
1. `crm_search` → resolve contact
2. `crm_outline` → identify populated sections and fill rates
3. Read in parallel: index, profile, intelligence-profile, intelligence-strategic, intelligence-risk, tracking file (deals/assignments/etc.), log (last 10 entries)
4. `crm_connections` → who they know that you also know
5. Synthesize into structured briefing

**Output Structure:**
```
# Intelligence Briefing: [Name]
**[Profession] at [Org] | [Category] | Last Contact: [Date]**

## Executive Summary
[2-3 sentences: who they are, current relationship state, why they matter]

## Key Intelligence
| Dimension | Assessment |
|-----------|-----------|
| Communication Style | [from intelligence-profile] |
| Decision-Making | [from intelligence-profile] |
| Negotiation Approach | [from intelligence-profile] |
| Risk Factors | [from intelligence-risk] |

## Deal Activity
[from tracking file — active deals, recent closes, pipeline]

## Network Overlap
[from crm_connections — mutual contacts, introduction paths]

## Recent Interactions
[last 3-5 log entries, summarized]

## Recommended Engagement Strategy
1. [Specific action based on intelligence]
2. [Specific action based on intelligence]
3. [Specific action based on intelligence]
```

**Variant — Family contacts:** When the contact is in the Family category, replace "Deal Activity" with "Health Status" (from medical.md) and "Engagement Strategy" with "Support & Touchpoints". Use `family-intel` output structure instead.

---

#### 3.2 `deal-parties`

**Trigger:** "who's involved in [deal/property]", "deal parties for [address]", "map the [deal name] deal", "who's on this transaction"

**Purpose:** Map all CRM contacts connected to a specific deal or property, with roles, relationships, and gaps.

**Workflow:**
1. `crm_vector_search` → search for deal name, property address, or project name across all dossiers
2. For each hit: `crm_read` section="index" → get role, org, relationship strength
3. `crm_connections` → cross-reference relationships between the parties
4. Identify gaps — roles typically involved in this deal type that aren't in the CRM

**Output Structure:**
```
# Deal Party Map: [Deal/Property Name]

## Parties Identified ([count] contacts)

| Role | Contact | Organization | Relationship | Strength | Last Contact |
|------|---------|-------------|-------------|:--------:|:------------:|
| Seller's Broker | [Name] | [Org] | [Category] | [1-10] | [Date] |
| Buyer's Counsel | [Name] | [Org] | [Category] | [1-10] | [Date] |
| ... | | | | | |

## Relationship Map
[which parties know each other, potential alliances, conflict risks]

## Missing Parties
[roles you'd expect on this deal type but don't have in CRM — e.g., "No appraiser identified"]

## Recommended Actions
1. [e.g., "Reach out to [Name] for intel on buyer's timeline"]
2. [e.g., "Create dossier for the buyer's counsel — you'll need them later"]
```

---

#### 3.3 `event-prep`

**Trigger:** "prep me for [event]", "I'm going to [conference/gala/dinner]", "who do I know at [event]", "networking prep"

**Purpose:** Bulk briefing cards for contacts likely to attend an event.

**Workflow:**
1. User provides: event name, attendee list (optional), or context ("NAIOP gala", "ULI conference")
2. If attendee list provided: `crm_search` each name
3. If no list: `crm_vector_search` for event/org name, `crm_search` by likely categories
4. For each match: `crm_read` section="index" → snapshot
5. For top contacts (strongest relationships): `crm_read` section="log" → last interaction

**Output Structure:**
```
# Event Prep: [Event Name] — [Date]

## Your Contacts ([count] identified)

### Must-See (Strong Relationships)
**[Name]** — [Title] at [Org]
- Last spoke: [date] about [topic]
- Talking point: [one specific thing to bring up]
- Ask: [what you want from this interaction]

### Should-Say-Hello (Active Relationships)
| Contact | Org | Last Contact | One-Liner |
|---------|-----|:------------:|-----------|
| [Name] | [Org] | [Date] | [Quick context] |

### People to Meet (Not in CRM, suggested)
[If context allows — e.g., "NAIOP events typically draw developers and capital markets people. You have gaps in [category]."]

## Recommended Actions
1. [e.g., "Follow up with [Name] within 48 hours of event"]
```

---

### MAINTENANCE

---

#### 3.4 `relationship-pulse`

**Trigger:** "relationship pulse", "how's my network", "who should I call", "who am I neglecting", "weekly check-in", "touch base recommendations"

**Purpose:** Weekly/monthly relationship health check with prioritized touchpoint recommendations.

**Workflow:**
1. `crm_stats` → overall health
2. `crm_recent` → who you've been in touch with
3. `crm_search` by category → scan all contacts
4. For each contact: `crm_read` section="index" → last contact date, relationship strength, next action
5. Segment into priority tiers
6. For A-tier overdue contacts: `crm_read` section="log" → last interaction context

**Output Structure:**
```
# Relationship Pulse — [Date]
**[Total] contacts | [Stale count] need attention | [Recent count] touched this week**

## Urgent (High-Value + Overdue)
| Contact | Days Since Contact | Relationship | Suggested Touchpoint |
|---------|:-----------------:|:------------:|---------------------|
| [Name] | [N] days | [8/10] | [e.g., "Coffee — discuss Q2 pipeline"] |

## This Week's Touch List
1. **[Name]** — [reason: birthday, follow-up, deal check-in, etc.]
2. **[Name]** — [reason]
3. **[Name]** — [reason]
4. **[Name]** — [reason]
5. **[Name]** — [reason]

## Relationship Trends
- Warming: [contacts with increasing interaction frequency]
- Cooling: [contacts with decreasing interaction frequency]
- New: [contacts added in last 30 days]

## Key Dates (Next 14 Days)
| Date | Contact | Event | Action |
|------|---------|-------|--------|

## Recommended Actions
1. [Highest-priority touchpoint with reasoning]
```

**Token Strategy:** Scans at index level. With 98 contacts at ~100 tokens each, the full scan is ~10K tokens. To stay efficient: use `crm_search` with category filter, process in batches, and only drill into log for the top 5-10 flagged contacts.

---

#### 3.5 `post-meeting`

**Trigger:** "just met with [name]", "had lunch with [name]", "debrief [name]", "log meeting with [name]", "just got off a call with [name]"

**Purpose:** Structured debrief that turns a quick summary into updates across multiple dossier sections.

**Workflow:**
1. `crm_search` → resolve contact
2. `crm_outline` → see current dossier state
3. Ask the user (if not already provided): What was discussed? Any deals mentioned? Any names dropped? Any commitments? Next action?
4. `crm_log` → append interaction entry
5. `crm_update` → update last contact date, next action in INDEX.md
6. If deals mentioned: `crm_read` tracking file → check if deal exists → update or add
7. If new names mentioned: offer to create new contacts via `crm_create`
8. If intelligence gathered: update relevant intelligence section

**Output Structure:**
```
# Post-Meeting Debrief: [Name] — [Date]

## Logged
- Interaction entry added to log.md
- Last contact updated: [date]
- Next action set: [action] (due: [date])

## Updates Applied
- [e.g., "Added Vaughan industrial deal to deals.md — Active, est. close Q3"]
- [e.g., "Updated organization: CBRE → Cushman & Wakefield"]

## New Contacts Suggested
- [Name mentioned] — [context] → Create dossier? [Y/N]

## Follow-Up Reminders
1. [Action] — by [date]
2. [Action] — by [date]
```

**Interaction Style:** This skill is conversational. If the user provides a bare statement ("just had coffee with Ross"), the skill should ask 2-3 quick questions to extract actionable intelligence before writing updates. If the user provides a detailed dump, skip the questions and go straight to processing.

---

#### 3.6 `crm-health`

**Trigger:** "audit my CRM", "CRM health check", "dossier quality", "how complete are my files"

**Purpose:** Structural health assessment across the entire CRM — template compliance, fill rates, data quality.

**Workflow:**
1. `crm_stats` → baseline
2. `crm_audit` → run 5-pass audit (compliance, misplaced, stale, duplicates, ordering)
3. `crm_search` by category → scan for fill rates
4. Aggregate findings by severity and category

**Output Structure:**
```
# CRM Health Report — [Date]

## Overall Score: [X/100]
| Metric | Value | Status |
|--------|-------|--------|
| Total Contacts | [N] | — |
| Avg Fill Rate | [X%] | [Good/Needs Work] |
| Template Compliance | [X%] | [Good/Needs Work] |
| Stale Contacts (>30d) | [N] | [Concern if >50%] |
| Orphaned (no connections) | [N] | [Concern if high] |
| Zero-Log Contacts | [N] | [Concern if high] |

## Issues Found
### Critical
- [e.g., "12 contacts missing INDEX.md snapshot data"]

### Moderate
- [e.g., "8 contacts have content in wrong tier files"]

### Minor
- [e.g., "3 contacts have sections out of template order"]

## Category Breakdown
| Category | Contacts | Avg Fill | Stale | Issues |
|----------|:--------:|:--------:|:-----:|:------:|
| Network | 60 | 88% | 42 | 15 |
| Family | 13 | 95% | 3 | 2 |
| ... | | | | |

## Recommended Actions
1. Run `crm_repair` on [N] contacts with auto-fixable issues
2. Prioritize enrichment for [contacts with lowest fill rates]
3. Review [stale contacts] for archive candidates
```

---

### RESEARCH

---

#### 3.7 `enrich-contact`

**Trigger:** "enrich [name]", "fill out [name]'s dossier", "I know more about [name] now", "update [name]'s profile"

**Purpose:** Interview-driven dossier enrichment — identifies gaps and asks targeted questions to fill them.

**Workflow:**
1. `crm_search` → resolve contact
2. `crm_outline` → identify sections with low fill rates
3. Prioritize empty sections by value (intelligence > profile > tracking > log)
4. Ask targeted questions one at a time, grouped by section
5. After each answer: `crm_update` or `crm_read` + edit to update the relevant section
6. Continue until user says "that's all" or all high-priority sections are filled

**Interaction Style:** Conversational interview. Questions should be natural, not form-like:
- "What's their communication style like — formal or casual?"
- "Do you know what asset classes they focus on?"
- "Have you done any deals together?"

Not: "Please provide value for field: Communication Style (Formal/Casual/Mixed)"

---

#### 3.8 `find-path`

**Trigger:** "how do I get to [name/org]", "who can introduce me to [name]", "connection path to [org]", "I need to reach [person]"

**Purpose:** Find introduction chains through your network to reach a target person or organization.

**Workflow:**
1. `crm_search` or `crm_vector_search` → find target (may not be in CRM)
2. If target is in CRM: `crm_connections` → direct connections
3. For all contacts: `crm_connections` → build full graph
4. `crm_vector_search` for target's organization → find contacts who work there or have dealt with them
5. Find shortest paths: You → Intermediary → Target
6. Rank paths by relationship strength of the intermediaries

**Output Structure:**
```
# Path to [Target Name/Org]

## Direct Connections
[If any — contacts who know the target directly]

## Introduction Paths (ranked by strength)

### Path 1 (Strongest)
You → **[Name A]** (relationship: [8/10]) → **[Target]**
- [Name A] knows [Target] through [context]
- Suggested ask: "[specific phrasing for the introduction request]"

### Path 2
You → **[Name B]** → **[Name C]** → **[Target]**
- Two-hop path. [Name B] can connect you to [Name C], who works with [Target]

## No Path Found
[If no connections exist — suggest cold outreach strategies or events where target might appear]
```

---

#### 3.9 `competitive-intel`

**Trigger:** "what do I know about [organization]", "intel on [company]'s team", "who do I know at [org]", "competitive intel on [org]"

**Purpose:** Synthesize everything your CRM knows about a competing or target organization.

**Workflow:**
1. `crm_vector_search` → find all contacts mentioning the organization
2. For each hit: `crm_read` sections: index, intelligence-strategic, tracking file
3. Cross-reference: who works there, who used to work there, who does deals with them
4. `crm_connections` → map inter-organizational relationships

**Output Structure:**
```
# Competitive Intelligence: [Organization]

## Your Contacts There ([count])
| Contact | Role | Status | Relationship | Last Contact |
|---------|------|--------|:------------:|:------------:|

## Former Employees in Your Network
| Contact | When They Left | Current Org | Intel Value |

## Deal Activity Involving [Org]
[Aggregated from tracking files across all contacts]

## Intelligence Summary
| Dimension | Assessment |
|-----------|-----------|
| Market Position | [from intelligence-strategic files] |
| Key Strengths | [aggregated] |
| Known Vulnerabilities | [aggregated] |
| Recent Changes | [from log entries] |

## Your Positioning
- Advantages: [where you're stronger]
- Risks: [where they're stronger]
- Opportunities: [gaps you can exploit]
```

---

### REPORTING

---

#### 3.10 `pipeline-review`

**Trigger:** "pipeline review", "what deals are active", "deal pipeline", "what's in play"

**Purpose:** Cross-contact deal pipeline summary — aggregate deal activity across all contacts.

**Workflow:**
1. `crm_search` → find all contacts with tracking files (profession-based dossiers)
2. For contacts with deals/assignments/projects tracking files: `crm_read` tracking section
3. Aggregate: active deals, pipeline volume, deals by asset class, referral balance
4. Flag: deals needing action, stale deals, referral imbalances

**Output Structure:**
```
# Pipeline Review — [Date]

## Active Pipeline
| Deal/Property | Contact | Asset Class | Role | Est. Value | Status | Est. Close |
|--------------|---------|-------------|------|:----------:|--------|:----------:|

## Pipeline Summary
| Metric | Value |
|--------|-------|
| Active Deals | [N] |
| Total Pipeline Volume | [$X] |
| Avg Deal Size | [$X] |
| Deals Closing This Quarter | [N] |

## By Asset Class
| Asset Class | # Deals | Volume | Avg Size |
|-------------|:-------:|:------:|:--------:|

## Referral Balance
| Contact | From Them | To Them | Net Position |
|---------|:---------:|:-------:|:------------:|
[Top 5 referral relationships]

## Needs Attention
- [Deal X] — no activity in 30 days, check with [Contact]
- [Deal Y] — closing date passed, update status

## Recommended Actions
1. [Highest-priority pipeline action]
```

---

#### 3.11 `relationship-roi`

**Trigger:** "relationship ROI", "which contacts are most valuable", "network value analysis", "who generates the most business"

**Purpose:** Analyze which relationships generate the most value (deals, referrals, introductions) relative to time invested.

**Workflow:**
1. `crm_search` → all contacts
2. For each: `crm_read` section="index" → deal velocity metrics
3. For profession-based contacts: `crm_read` tracking file → referral balance, deal history
4. `crm_read` section="log" → interaction frequency (proxy for time invested)
5. Compute: value generated vs. interaction frequency

**Output Structure:**
```
# Relationship ROI Analysis — [Date]

## Top 10 by Value Generated
| Rank | Contact | Deals | Volume | Referrals | Total Value |
|:----:|---------|:-----:|:------:|:---------:|:-----------:|

## Top 10 by Referral Volume
| Rank | Contact | Referrals In | Referrals Out | Net |

## Over-Invested (High Touch, Low Return)
| Contact | Interactions (12mo) | Value Generated | Assessment |
[Contacts you meet frequently but generate little deal flow]

## Under-Invested (High Potential, Low Touch)
| Contact | Relationship Strength | Deal Potential | Days Since Contact |
[Strong relationships you're neglecting]

## Recommended Actions
1. [Rebalance time allocation]
```

---

#### 3.12 `annual-review`

**Trigger:** "annual review", "year-end CRM review", "annual relationship review"

**Purpose:** Comprehensive year-end portfolio review combining multiple skill outputs.

**Workflow:**
1. Run `relationship-pulse` analysis
2. Run `pipeline-review` analysis
3. Run `relationship-roi` analysis
4. Run `crm-health` analysis
5. Add year-over-year comparisons (contacts added/lost, category shifts)
6. Generate priorities for next year

**Output Structure:**
```
# Annual Relationship Review — [Year]

## Year in Numbers
| Metric | This Year | Last Year | Change |
|--------|:---------:|:---------:|:------:|

## Relationship Health
[Condensed from relationship-pulse]

## Deal Activity
[Condensed from pipeline-review]

## Network Value
[Condensed from relationship-roi]

## CRM Quality
[Condensed from crm-health]

## Key Wins
[Top 5 relationship outcomes this year]

## Lessons Learned
[Patterns from the data]

## Next Year Priorities
1. [Strategic relationship goal]
2. [Network gap to fill]
3. [Maintenance goal]
```

**Note:** This is the heaviest skill — it may approach context limits. Consider outputting to a markdown file rather than inline, and pointing the user to it.

---

### PERSONAL & FAMILY

---

#### 3.13 `medical-briefing`

**Trigger:** "[family member] has a doctor appointment", "medical briefing for [name]", "prep me for [name]'s appointment", "what's [name]'s health status", "[name] seeing the cardiologist"

**Purpose:** Pre-appointment health synthesis for a Family contact.

**Workflow:**
1. `crm_search` → resolve contact (must be Family category)
2. `crm_read` section="medical" → current health status, conditions, medications
3. `crm_read` section="medical-labs" → recent lab results, trends
4. `crm_read` section="medical-pharmacogenomics" → drug interaction alerts
5. `crm_read` section="medical-genetics" → relevant genetic findings (if applicable to appointment type)
6. `crm_read` section="log" → recent entries mentioning symptoms or health events

**Output Structure:**
```
# Medical Briefing: [Name]
**Appointment: [Type/Specialist] — [Date if known]**

## Current Health Summary
[from medical.md — active conditions, current medications, recent events]

## Relevant Lab Trends
| Test | Last Result | Previous | Reference | Trend |
|------|:-----------:|:--------:|:---------:|:-----:|
[from medical-labs.md — only tests relevant to this appointment type]

## Pharmacogenomic Alerts
[from medical-pharmacogenomics.md — ONLY if medications are being discussed]
- [Drug class]: [Alert] ([Gene variant])

## Recent Health Events
[from log entries — symptoms, incidents, concerns mentioned recently]

## Questions for the Doctor
1. [Generated from gaps in data, recent symptoms, or medication changes]
2. [Based on lab trends]
3. [Based on upcoming milestones]

## Bring to Appointment
- [ ] Insurance card
- [ ] List of current medications
- [ ] Lab results from [date] (if not already sent)
- [ ] [Any other relevant documents]
```

**Variant — Izzy's cardiology:** For FH-related appointments, emphasize: lipid panel trends (LDL-C trajectory), Praluent adherence, genetic confirmation status, growth/development milestones.

---

#### 3.14 `family-health-dashboard`

**Trigger:** "family health check", "any medical follow-ups", "health dashboard", "how's the family doing health-wise"

**Purpose:** Cross-family medical overview — upcoming appointments, overdue screenings, active issues.

**Workflow:**
1. `crm_search` category="Family" → all family contacts
2. For each: `crm_read` section="medical" → health status summary
3. Aggregate: active conditions, upcoming appointments, overdue screenings, medication schedules

**Output Structure:**
```
# Family Health Dashboard — [Date]

## Active Health Issues
| Member | Condition | Status | Next Action | Due |
|--------|-----------|--------|------------|-----|

## Upcoming Appointments
| Date | Member | Type | Provider | Prep Needed? |
|------|--------|------|----------|:------------:|

## Overdue Screenings
| Member | Screening | Last Done | Recommended Frequency | Overdue By |
|--------|-----------|:---------:|:---------------------:|:----------:|

## Medication Schedule
| Member | Medication | Purpose | Frequency | Refill Due |
|--------|-----------|---------|-----------|:----------:|

## Recommended Actions
1. [Most urgent medical follow-up]
```

**Token Strategy:** Only reads medical.md (the frequently-updated file) for each family member — not genetics, pharmacogenomics, or labs. Those are static files loaded only by `medical-briefing` when preparing for a specific appointment.

---

#### 3.15 `birthday-and-dates`

**Trigger:** "any birthdays coming up", "key dates", "upcoming anniversaries", "who has a birthday this month", "important dates"

**Purpose:** Surface upcoming key dates across ALL contacts (not just family) with suggested actions.

**Workflow:**
1. `crm_search` → all contacts
2. For each: `crm_read` section="index" or section="profile" → extract key dates
3. Filter to next 30 days (configurable)
4. For each upcoming date: check log for past gestures/gifts

**Output Structure:**
```
# Upcoming Key Dates — Next 30 Days

## This Week
| Date | Contact | Event | Suggested Action |
|------|---------|-------|-----------------|
| Mar 8 | [Name] | Birthday | [Call — you sent flowers last year] |

## Next 2 Weeks
| Date | Contact | Event | Suggested Action |

## This Month
| Date | Contact | Event | Suggested Action |

## Recently Missed (Last 7 Days)
| Date | Contact | Event | Recovery Action |
[Dates you may have missed — suggest a belated gesture]
```

---

#### 3.16 `education-tracker`

**Trigger:** "how's Izzy doing at school", "education update", "school progress", "what's happening at school"

**Purpose:** Synthesize education-related information for a family member (primarily Izzy).

**Workflow:**
1. `crm_search` → resolve family member
2. `crm_read` section="education" → current school status, milestones
3. `crm_read` section="log" → recent school-related entries
4. Read `00_STRATEGIC_CORE/GIST_news.md` (if accessible) → latest school news

**Output Structure:**
```
# Education Update: [Name]
**[School] — [Grade/Program] — [Term]**

## Current Status
[from education.md]

## Recent Milestones
[from log entries]

## School News
[from GIST_news.md — upcoming events, action items]

## Areas of Focus
[from education.md — strengths, growth areas]

## Recommended Actions
1. [Next parent action]
```

---

#### 3.17 `family-intel`

**Trigger:** "what's going on with [family member]", "how's [family member] doing", "brief me on [family member]", "family update on [name]"

**Purpose:** Full family member briefing — the family-specific version of intel-briefing, focused on wellbeing rather than deal positioning.

**Workflow:**
1. `crm_search` → resolve contact (Family category)
2. `crm_outline` → see what's populated
3. Read: index, profile, medical.md, intelligence-relational.md, intelligence-health-check.md, recent log
4. `crm_connections` → family relationships

**Output Structure:**
```
# Family Update: [Name]
**[Relationship] | Last Contact: [Date]**

## How They're Doing
[Overall wellbeing synthesis — health, mood, recent events]

## Health Status
[from medical.md — current conditions, medications, recent events]

## Relationship Dynamics
[from intelligence-relational.md — current state of your relationship, any tensions, recent changes]

## Recent Interactions
[last 3-5 log entries]

## Family Connections
[from crm_connections — their relationships with other family members]

## Support & Touchpoints
1. [Suggested way to support/connect]
2. [Upcoming need or event]
3. [Something they mentioned wanting or needing]
```

---

#### 3.18 `gift-intel`

**Trigger:** "what should I get [name]", "gift ideas for [name]", "[name]'s birthday is coming up", "gift history for [name]"

**Purpose:** Gift and gesture intelligence — what they like, what you've given before, and suggestions.

**Workflow:**
1. `crm_search` → resolve contact
2. `crm_read` section="profile" → interests, hobbies, preferences
3. `crm_read` section="intelligence-profile" → personality, values
4. `crm_vector_search` "[name] gift" or "[name] birthday" → find past gift mentions in logs
5. `crm_read` section="log" → scan for gift/gesture references

**Output Structure:**
```
# Gift Intelligence: [Name]

## Past Gifts & Gestures
| Date | Occasion | Gift/Gesture | Their Reaction |
|------|----------|-------------|:---------------:|
[from log entries]

## Known Preferences
- Interests: [from profile]
- Values: [from intelligence-profile]
- Dislikes/Avoid: [if mentioned anywhere]

## Suggested Gift Ideas
1. **[Idea]** — [reasoning tied to their profile]
2. **[Idea]** — [reasoning]
3. **[Idea]** — [reasoning]

## Budget Context
[Business contact: appropriate gift range for the relationship level]
[Family: no budget guidance needed]
```

---

#### 3.19 `life-event-support`

**Trigger:** "[name] just [life event]", "[name]'s [relative] passed away", "[name] got promoted", "[name] is getting married", "how should I respond to [name]'s [event]"

**Purpose:** Context-aware guidance when someone experiences a significant life event (positive or negative).

**Workflow:**
1. `crm_search` → resolve contact
2. `crm_read` sections: index, profile, intelligence-profile → relationship depth, cultural context, personality
3. `crm_connections` → mutual contacts who should know
4. `crm_read` section="log" → recent interaction context

**Output Structure:**
```
# Life Event Response: [Name] — [Event]

## Relationship Context
[How close you are, how long you've known them, last interaction]

## Cultural Considerations
[from profile — ethnicity, religion, cultural norms that affect appropriate response]

## Suggested Response
**Immediate (Today):**
[specific action — call, text, card, flowers, etc. with suggested wording]

**Follow-Up (1-2 Weeks):**
[check-in action]

**Ongoing:**
[longer-term support if applicable]

## People to Notify
| Contact | Their Relationship | How to Tell Them |
|---------|-------------------|-----------------|
[mutual contacts from crm_connections who should know]

## Log This Event
[Offer to log the event and set follow-up reminders]
```

**Tone:** This skill handles sensitive situations. The output should be warm and human, not clinical. For negative events (loss, illness, divorce), lead with empathy. For positive events (promotion, new baby, marriage), lead with celebration.

---

## 4. Design Decisions (Resolved)

1. **Skill model tiers:**
   - `model: haiku` — lightweight skills that don't require deep reasoning: `birthday-and-dates`, `crm-health`, `gift-intel`
   - `model: sonnet` — heavy aggregation skills: `annual-review`, `pipeline-review`, `relationship-roi`, `competitive-intel`, `family-health-dashboard`
   - Default (opus) — skills requiring nuanced synthesis, sensitive context, or conversational interaction: `intel-briefing`, `post-meeting`, `medical-briefing`, `life-event-support`, `family-intel`, `enrich-contact`, `deal-parties`, `find-path`, `event-prep`, `relationship-pulse`, `education-tracker`

2. **File output:** Reporting skills (pipeline-review, annual-review, relationship-roi, crm-health) use AskUserQuestion at runtime: "Save this report to a file? [Y/path/N]". If yes, write to user-specified path or default to `09_AGENT_REPORTS/crm/`.

3. **Cross-project access:** Skills that reference data outside the CRM directory (e.g., `education-tracker` reading `GIST_news.md`) use AskUserQuestion at runtime: "I can also pull in school updates from GIST_news.md — include that?" This keeps skills portable while allowing richer output when the broader project is available.

4. **Scheduling:** No scheduling suggestions. Skills run on demand only.

---

## 5. Build Order

**Phase 1 (5 skills — daily use):**
1. `intel-briefing` — establishes output conventions, tests single-contact pattern
2. `post-meeting` — tests write-back workflow, conversational interaction
3. `relationship-pulse` — tests multi-contact aggregation pattern
4. `medical-briefing` — tests family-specific deep read
5. `deal-parties` — tests graph traversal pattern

**Phase 2 (8 skills — weekly/monthly):**
6. `family-intel` — builds on intel-briefing conventions for family
7. `enrich-contact` — interview-driven, builds on post-meeting patterns
8. `crm-health` — leverages existing audit/repair tools
9. `event-prep` — multi-contact aggregation variant
10. `find-path` — graph traversal variant
11. `family-health-dashboard` — multi-contact family aggregation
12. `birthday-and-dates` — lightweight multi-contact scan
13. `pipeline-review` — aggregation across tracking files

**Phase 3 (6 skills — situational):**
14. `competitive-intel` — complex graph traversal
15. `relationship-roi` — complex aggregation
16. `education-tracker` — cross-project reference
17. `gift-intel` — search-heavy
18. `life-event-support` — sensitive context handling
19. `annual-review` — combines multiple skills, heaviest
