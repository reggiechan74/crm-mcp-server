# CRM Plugin Skills — Implementation Plan

**Date:** 2026-03-05
**Design Doc:** `2026-03-05-crm-skills-design.md`
**Status:** Ready to build

---

## Prerequisites

Before building any skills:

- [ ] Create `skills/` directory in crm-mcp-server root
- [ ] Create `skills/_shared/conventions.md` with shared conventions from design doc (contact resolution, output format, token awareness, error handling, model tiers, AskUserQuestion patterns)
- [ ] Verify plugin skill discovery works — install plugin, confirm a test skill appears in available skills list
- [ ] Determine `allowed-tools` syntax for MCP plugin tools (confirm `mcp__plugin_crm_crm__crm_search` format works in plugin-bundled skills)

---

## Phase 1: Daily-Use Skills (5 skills)

Build order matters — each skill validates a pattern that subsequent skills reuse.

### 1.1 `intel-briefing` (Pattern: Single-contact deep read)

**Establishes:** Output conventions, single-contact workflow, intelligence synthesis format

- [ ] Create `skills/intel-briefing/SKILL.md`
  - Frontmatter: name, description (with aggressive trigger phrases), allowed-tools (all CRM read tools + AskUserQuestion), model: default
  - Body: workflow steps, output template from design doc
  - Reference `_shared/conventions.md` for shared rules
  - Include family-contact variant (detect category, switch output structure)
- [ ] Test with a Network contact (business intel output)
- [ ] Test with a Family contact (family intel output — should redirect to family-intel style)
- [ ] Verify token consumption is reasonable (~1,500-3,000 tokens input)

### 1.2 `post-meeting` (Pattern: Single-contact write-back)

**Establishes:** Write-back workflow, conversational interaction, multi-section updates

- [ ] Create `skills/post-meeting/SKILL.md`
  - Frontmatter: model: default
  - Body: conversational debrief flow, write-back orchestration
  - Key behavior: if user gives bare statement, ask 2-3 questions; if detailed dump, skip questions
  - Must handle: crm_log, crm_update (index fields), tracking file updates, new contact suggestions
- [ ] Test with minimal input ("just had coffee with Ross")
- [ ] Test with detailed input ("Had lunch with Ross. He mentioned the Vaughan industrial deal needs equity...")
- [ ] Verify log entry is created and INDEX.md fields updated

### 1.3 `relationship-pulse` (Pattern: Multi-contact aggregation)

**Establishes:** Multi-contact scanning strategy, priority segmentation, token-efficient aggregation

- [ ] Create `skills/relationship-pulse/SKILL.md`
  - Frontmatter: model: default
  - Body: scan strategy (index-level first, selective drill-down), segmentation logic, touch list generation
  - Token guardrail: explicitly instruct to use crm_stats + crm_recent first, then scan by category, only drill into log for top 5-10
- [ ] Test with full CRM (98 contacts)
- [ ] Verify output stays within reasonable token budget
- [ ] Verify stale contacts are correctly identified and prioritized

### 1.4 `medical-briefing` (Pattern: Single-contact deep read, family-specific)

**Establishes:** Family-specific deep read, medical data synthesis, appointment-oriented output

- [ ] Create `skills/medical-briefing/SKILL.md`
  - Frontmatter: model: default
  - Body: medical section reading strategy (medical → labs → pharmacogenomics → genetics, load selectively based on appointment type)
  - Include Izzy FH variant (emphasize lipid trends, Praluent tracking)
  - Guard: must be Family category contact
- [ ] Test with Izzy (cardiology appointment scenario)
- [ ] Test with Janice (general health check scenario)
- [ ] Verify pharmacogenomic alerts surface correctly

### 1.5 `deal-parties` (Pattern: Graph traversal)

**Establishes:** Vector search → connection mapping workflow, gap identification

- [ ] Create `skills/deal-parties/SKILL.md`
  - Frontmatter: model: default
  - Body: vector search for deal/property, connection graph building, gap analysis by deal type
  - Include: expected roles per deal type (sale: broker, buyer's broker, lawyers, appraiser, lender, title)
- [ ] Test with a known deal mentioned across multiple contacts
- [ ] Verify relationship cross-referencing works via crm_connections
- [ ] Verify gap identification ("missing parties") is reasonable

---

## Phase 2: Weekly/Monthly Skills (8 skills)

After Phase 1 is solid, build these. They reuse established patterns.

### 2.1 `family-intel`
- [ ] Create skill — mirrors intel-briefing but family output structure (health, relationships, support)
- [ ] Frontmatter: model: default
- [ ] Test with 2 family contacts

### 2.2 `enrich-contact`
- [ ] Create skill — interview-driven, asks questions one at a time
- [ ] Frontmatter: model: default
- [ ] Test enrichment flow on a thin dossier
- [ ] Verify updates land in correct sections

### 2.3 `crm-health`
- [ ] Create skill — wraps crm_audit + crm_stats into a health scorecard
- [ ] Frontmatter: model: haiku
- [ ] AskUserQuestion for file output
- [ ] Test on full CRM

### 2.4 `event-prep`
- [ ] Create skill — bulk briefing cards, supports attendee list or org-based search
- [ ] Frontmatter: model: default
- [ ] Test with "NAIOP gala" scenario (no attendee list)
- [ ] Test with explicit attendee list

### 2.5 `find-path`
- [ ] Create skill — graph traversal for introduction chains
- [ ] Frontmatter: model: default
- [ ] Test path-finding between known connected contacts
- [ ] Test with a contact NOT in CRM

### 2.6 `family-health-dashboard`
- [ ] Create skill — cross-family medical scan, index-level only
- [ ] Frontmatter: model: sonnet
- [ ] Test with all 13 Family contacts
- [ ] Verify only medical.md is read (not genetics/pharmacogenomics/labs)

### 2.7 `birthday-and-dates`
- [ ] Create skill — lightweight date scan across all contacts
- [ ] Frontmatter: model: haiku
- [ ] Test date extraction from INDEX.md and profile.md
- [ ] Test "recently missed" detection

### 2.8 `pipeline-review`
- [ ] Create skill — cross-contact deal aggregation
- [ ] Frontmatter: model: sonnet
- [ ] AskUserQuestion for file output
- [ ] Test with contacts that have tracking files

---

## Phase 3: Situational Skills (6 skills)

Build when CRM data is mature enough to produce meaningful output.

### 3.1 `competitive-intel`
- [ ] Create skill — org-focused graph traversal and intelligence synthesis
- [ ] Frontmatter: model: sonnet

### 3.2 `relationship-roi`
- [ ] Create skill — value analysis across deal velocity and interaction frequency
- [ ] Frontmatter: model: sonnet
- [ ] AskUserQuestion for file output

### 3.3 `education-tracker`
- [ ] Create skill — education synthesis for family members
- [ ] Frontmatter: model: default
- [ ] AskUserQuestion for cross-project GIST_news.md access

### 3.4 `gift-intel`
- [ ] Create skill — gift history and preference synthesis
- [ ] Frontmatter: model: haiku

### 3.5 `life-event-support`
- [ ] Create skill — sensitive context handling for life events
- [ ] Frontmatter: model: default (needs nuance)

### 3.6 `annual-review`
- [ ] Create skill — combines multiple skill outputs into comprehensive review
- [ ] Frontmatter: model: sonnet
- [ ] AskUserQuestion for file output (recommend yes — this is long)
- [ ] Consider writing to file by default given output size

---

## Post-Build

- [ ] Update crm-mcp-server README.md to document available skills
- [ ] Update docs/RE-CRM-Overview.md with skill examples
- [ ] Run full test: install plugin fresh, verify all skills appear and trigger correctly
- [ ] Push to GitHub, run `/plugin update crm@crm-mcp-server`

---

## Notes

- **No code changes to `src/`** — all skills are pure SKILL.md orchestration files
- **`_shared/conventions.md`** is a reference file read by skills, not a skill itself
- **Each skill is independent** — can be built, tested, and shipped individually
- **Trigger descriptions should be aggressive** — Claude undertriggers skills, so descriptions should list many phrasings including casual ones
- **Test with real contacts** — use existing CRM data, don't create test fixtures
