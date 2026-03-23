---
name: analyze-subject
description: Comprehensive individual intelligence gathering combining internal sources (Gmail, Limitless recordings, transcripts) with extensive OSINT (LinkedIn, Twitter/X, Substack, Crunchbase, SEC filings, court records). Builds detailed profiles including professional history, digital footprint, network connections, thought leadership, and behavioral patterns. Detects manipulation tactics and red flags. Populates CRM dossiers (tiered folder format with modular intelligence/ subdirectory) AND generates standalone intelligence reports. Use when researching business prospects, interviewers, investors, partners, or evaluating contact trustworthiness.
arguments: subject_name
allowed-tools:
  - mcp__plugin_crm_crm__crm_search
  - mcp__plugin_crm_crm__crm_outline
  - mcp__plugin_crm_crm__crm_read
  - mcp__plugin_crm_crm__crm_update
  - mcp__plugin_crm_crm__crm_log
  - mcp__plugin_crm_crm__crm_connections
  - mcp__plugin_crm_crm__crm_vector_search
  - mcp__plugin_crm_crm__crm_stats
  - mcp__plugin_crm_crm__crm_recent
  - mcp__plugin_crm_crm__crm_audit
  - mcp__plugin_crm_crm__crm_repair
  - mcp__plugin_crm_crm__crm_export
  - mcp__plugin_crm_crm__crm_bulk_update
  - mcp__plugin_crm_crm__crm_create
  - AskUserQuestion
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Agent
  - WebSearch
  - WebFetch
  - mcp__gmail__search_emails
  - mcp__gmail__read_email
---

# Subject Analysis Command

Comprehensive individual intelligence gathering combining internal data sources with extensive OSINT to build detailed profiles of professional history, digital footprint, network connections, thought leadership, and behavioral patterns.

## Usage

```
/crm:analyze-subject [Subject Name]
```

**Research Contexts:** Prospect | Interviewer | Investor | Partner | Client | General

---

# EXECUTION WORKFLOW

## Phase 1: Locate or Create Dossier

1. Run `crm_search` for the subject name
2. If found: run `crm_outline` to see structure and fill rates
3. If not found: ask user for category, then use `crm_create` to create the dossier
4. Note the dossier path — you will need it for Phase 6

## Phase 2: Identity Verification

**For common names, STOP and confirm identity before proceeding.**

Confirm these data points match across 2+ sources:
- Full legal name + current title + current organization
- Location consistent with known information
- Email domain matches organization
- LinkedIn URL or unique identifier available

**If identity cannot be confirmed with HIGH confidence, ask user for additional identifying information.**

## Phase 3: Data Collection

Run these searches **in parallel** where possible.

### 3A. Internal Sources

| Source | Method | Extract |
|--------|--------|---------|
| **Gmail** | `mcp__gmail__search_emails` with `"from:[subject] OR to:[subject]"` | Communication patterns, tone, topics, key dates, quotes |
| **Limitless** | `curl -s "https://api.limitless.ai/v1/lifelogs?limit=50&search=[NAME]" -H "X-API-Key: $(printenv LIMITLESS_API_KEY)"` | Meeting transcripts, verbal patterns, in-person dynamics |
| **Local files** | Grep for subject name in `04_RELATIONSHIPS/CRM/`, `03_PROFESSIONAL/Meetings/`, `01_FINANCIAL/` | Existing analysis, meeting notes, transcripts |
| **CRM** | `crm_read` on existing dossier sections | Prior intelligence, interaction history |

**Transcript reading rule:** Read entire files. For files >2000 lines, use the Read tool with offset/limit to chunk through sequentially. Never sample or skip sections.

### 3B. OSINT — Digital Footprint

Search each platform systematically. Run searches in parallel batches.

**Platform checklist:**
- [ ] LinkedIn — profile, connections, activity, career gaps, endorsements
- [ ] Twitter/X — handle, follower count, content focus, notable posts, red flags
- [ ] Personal website — bio, portfolio, services, blog
- [ ] Substack/Newsletter — publication, frequency, themes, audience
- [ ] Medium/Blog — articles, publications, content themes
- [ ] YouTube — channel, appearances, interviews, conference talks
- [ ] GitHub — repos, activity, technical focus (if applicable)
- [ ] Instagram/Facebook/Threads — public presence only

**Search pattern for each platform:**
```
WebSearch: "[Subject Name]" site:[platform.com]
WebSearch: "[Subject Name]" "[Company]" [platform]
WebFetch: [profile URL if found]
```

### 3C. OSINT — Thought Leadership

- [ ] Books, academic papers, whitepapers (Google Scholar, Amazon)
- [ ] Speaking engagements (keynote, panel, workshop)
- [ ] Podcast appearances (Apple Podcasts, Spotify)
- [ ] Media coverage (Bloomberg, WSJ, TechCrunch, industry press)
- [ ] Op-eds, industry articles

### 3D. OSINT — Professional Network

- [ ] Board and advisory roles (Crunchbase, company websites)
- [ ] Investment activity (AngelList, Crunchbase, portfolio companies)
- [ ] Professional associations and memberships
- [ ] Co-founder and partnership history
- [ ] Key collaborators and frequent connections

### 3E. OSINT — Due Diligence

- [ ] Court records and litigation (`"[Name]" lawsuit OR litigation OR "v."`)
- [ ] Regulatory actions (`"[Name]" SEC enforcement OR FINRA OR disciplinary`)
- [ ] Corporate registry filings (LLC, Inc, Corp)
- [ ] SEC filings (for public company executives)
- [ ] Patent and trademark filings
- [ ] Credential verification (degrees, licenses, certifications — search official registries)

## Phase 4: Verification

Cross-reference key claims across multiple sources. For each major factual claim:

1. **Classify confidence:**
   - VERIFIED — confirmed by 2+ authoritative sources
   - CORROBORATED — supported by 1 additional source
   - UNVERIFIED — single source only
   - CONFLICTING — contradicting information found
   - REFUTED — evidence contradicts the claim

2. **Escalation rules:**
   - REFUTED credential claims → increase risk score by 2
   - 3+ CONFLICTING claims → flag for manual review
   - UNVERIFIED claims → include with `[UNVERIFIED]` tag

3. **High-priority verification** (always attempt):
   - Professional licenses → licensing body registry
   - Educational degrees → university alumni records
   - Employment claims → company announcements, SEC filings
   - Legal outcomes → court records

## Phase 5: Analysis

Synthesize all collected data into:

### 5A. Behavioral Analysis
- **Communication patterns** — response time, tone shifts, follow-through
- **Manipulation tactic detection** — Personal Vulnerability Opening, Character Reframing, Lesson-Learning Positioning, Efficiency Framing, Future Optionality Hook, Information Asymmetry, Personality Weaponization
- **Cialdini principle usage** — Reciprocity, Commitment/Consistency, Social Proof, Authority, Liking, Scarcity, Unity
- **Trust architecture** — commitment asymmetry, information asymmetry, verbal vs written alignment

### 5B. Risk Assessment

Score each category 1-10:
- Professional Credibility
- Behavioral Red Flags
- Relationship Risk
- Financial Risk (if applicable)
- **Overall Risk** (weighted average)

### 5C. Context-Specific Intelligence

Generate tailored intel based on research context:

| Context | Focus Areas |
|---------|------------|
| **Interviewer** | Interview style, what they value, hot buttons, rapport angles, recent activity |
| **Investor** | Investment thesis, check size, portfolio, value-add, deal breakers, decision timeline |
| **Partner** | Working style, past partnerships, reputation, negotiation style, risk factors |
| **Prospect/Client** | Decision authority, pain points, budget indicators, competitive landscape, relationship map |

## Phase 6: Dossier Population

**CRITICAL RULES:**
- NEVER use Write tool on existing dossier files — use Edit only
- Replace ALL template placeholders (`[TO BE POPULATED]`, `[TITLE]`, `[X]/5`, etc.) with actual data or "Unknown" if not found
- If a section has insufficient data, write "INSUFFICIENT DATA — [reason]" instead of leaving the template placeholder
- Launch parallel sub-agents for independent files to maximize speed

### 6A. INDEX.md — MUST be fully populated

This is the most-read file. Every placeholder MUST be replaced.

**Executive Summary:** Write 2-3 paragraph synthesis covering: who they are, role, background highlights, how you met, current relationship status, risk assessment, and strategic relevance.

**Quick Reference table:** Replace every `[PLACEHOLDER]` with actual values:
- Role → actual title and organization
- Relationship Type → actual category (Network, Client, etc.)
- How We Met → actual origin story
- Last Contact → actual date and context
- Current Status → actual status
- Next Action → actual next step or "None"
- Reach Out Via → actual preferred channel

**Relationship Assessment table:** Replace every `[X]/5` and `[BRIEF JUSTIFICATION]`:
- Relationship Strength → 0-5 with justification
- Strategic Value → 0-5 with justification
- Trust Level → level with justification
- Engagement Priority → HIGH/MEDIUM/LOW with justification

**Quick Contact table:** Replace with actual email, phone, LinkedIn from research.

### 6B. profile.md

Populate with actual data using Edit tool:
- **II. Contact Information** — all channels discovered (email, LinkedIn, Twitter, website, location, timezone)
- **III. Professional Background** — current position (title, tenure, responsibilities, reporting structure), career history table, expertise areas, education and credentials
- **IV. Relationship History** — origin story, timeline of interactions
- **V. Communication Preferences** — observed patterns (if any interaction data exists)
- **VI. Personal Interests** — hobbies, conversation starters discovered in research
- **VIII. Strategic Value Assessment** — value ratings with justification, mutual interests, investment strategy recommendation
- **IX. Active Opportunities** — any deals, projects, or initiatives
- **XV. Appendices** — all social media profiles with URLs and activity levels, public information sources

### 6C. intelligence/intelligence-profile.md

Populate only sections where data exists from transcripts, recordings, or observed interactions:
- VII.A-B — DISC/Big Five (if sufficient behavioral data)
- VII.C — Cognitive biases (if observed in interactions)
- VII.D — Emotional intelligence indicators
- VII.E-G — Decision-making patterns
- VII.H-O — Communication style, stress responses, values, conflict patterns, transcript analysis

**If no interaction data exists:** Write "INSUFFICIENT DATA — No direct interactions recorded. Requires in-person/video meetings or extended email correspondence to assess." at the top of unpopulated sections.

### 6D. intelligence/intelligence-strategic.md

Populate from OSINT and behavioral analysis:
- VII.P — MICE Vulnerability Profile (Money, Ideology, Coercion, Ego)
- VII.Q — Deception Baseline & Detection (note discrepancies found)
- VII.R — Network Influence Map (key network nodes and connections)
- VII.S — Relationship History Pattern Analysis (career patterns, partnership history)
- VII.T — Moral Foundations Profile (Care, Fairness, Loyalty, Authority, Sanctity, Liberty)

### 6E. intelligence/intelligence-risk.md

Populate from behavioral analysis and due diligence:
- X.A-E — Key Intelligence (source assessment, credibility, red flags)
- X.F-K — Manipulation Tactics Detection (7-tactic table + Cialdini assessment)
- X.L — Source Reliability Rating (NATO-style composite)
- X.M — Threat Assessment Matrix (4-category scoring)
- I-2 — Personality Pattern Screening (Dark Triad indicators, energy impact)
- Overall Risk Score with recommendation (PROCEED/CAUTION/RESTRUCTURE/DECLINE)

### 6F. log.md

- Append interaction log entry with date, event, significance, outcome
- Append intelligence assessment note with date and OSINT summary
- Update Quick Stats in header

### 6G. Family Dossier Additions

If the contact is in the Family category, also populate:
- **medical.md** — health conditions, medications, allergies, healthcare providers
- **education.md** — school info, milestones, academic performance, learning profile
- **intelligence/intelligence-relational.md** — influence network, communication authenticity, moral values
- **intelligence/intelligence-health-check.md** — relationship health assessment, toxic dynamics screening

## Phase 7: Standalone Report

Save a comprehensive report to: `09_AGENT_REPORTS/intelligence-analyst/[LASTNAME]_[Firstname]_Individual_Intelligence_[TIMESTAMP].md`

Use `TZ='America/New_York' date '+%Y-%m-%d_%H-%M-%S_EST'` for the timestamp.

**YAML frontmatter:**
```yaml
---
title: Individual Intelligence Report - [Subject Name]
generatedBy: analyze-subject
date: YYYY-MM-DD
timestamp: YYYY-MM-DD_HH-MM-SS_EST
researchContext: [Context]
category: Intelligence
keywords: [osint, individual-intelligence, subject-name, context]
shareable: false
riskAssessment: X/10
recommendation: [PROCEED/CAUTION/RESTRUCTURE/DECLINE]
dossierPath: [CRM dossier path]
lastUpdated: YYYY-MM-DD_HH-MM-SS_EST
---
```

**Report sections:**
1. Identity Confirmation (data points, confidence, sources)
2. Professional History Timeline (chronological career)
3. Digital Footprint Analysis (all platforms with URLs)
4. Thought Leadership Profile (publications, speaking, podcasts, media)
5. Professional Network Map (board roles, investments, key connections)
6. Due Diligence Findings (court records, regulatory, credentials)
7. Communication & Behavioral Analysis
8. Context-Specific Intelligence (tailored to research context)
9. Risk Assessment (scored table + overall + recommendation)
10. Intelligence Gaps (what couldn't be found or verified)
11. Sources Consulted (with URLs and reliability ratings)

---

# CONVERSATION OUTPUT

After all phases complete, present to the user:

```markdown
## Analysis Complete: [Subject Name]
**Context:** [Research Context] | **Date:** [Date] | **Identity Confidence:** [HIGH/MEDIUM/LOW]

### Data Sources
| Source | Count | Notes |
|--------|-------|-------|
| Gmail | X emails | [date range] |
| Limitless | X recordings | [date range] |
| Web OSINT | X sources verified | [platforms found] |

### Key Findings
1. [Most important finding]
2. [Second finding]
3. [Third finding]

### Digital Footprint
| Platform | Presence | Activity | Key Observation |
|----------|----------|----------|-----------------|
[Table of platforms found]

### Risk Assessment: [X]/10 — [LEVEL]
| Category | Score | Note |
|----------|-------|------|
[Scored table]

### Recommendation: [PROCEED / CAUTION / RESTRUCTURE / DECLINE]
[Brief explanation]

### Dossier Updated
[List files updated with brief description of what was populated]

### Standalone Report
[Path to saved report]

### Intelligence Gaps
[What couldn't be found — areas for follow-up]
```

---

**Skill Version:** 4.0
**Updated:** 2026-03-23
