---
name: intel-briefing
description: Use when the user asks for a full pre-meeting brief on one person, like "brief me on X", "prep me for X", "intel on X", "what do I know about X", "give me a dossier", "quick rundown", "who is this person again", "what's the play with X", "meeting prep", "call prep", "before I talk to X", "tell me about [name]", "background on [name]", or "refresh me on [name]". For family members, this skill detects Family category and switches to a family-focused output structure.
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
model: default
---

## Purpose
Full intelligence synthesis for a single contact before a meeting, call, or negotiation.

## Workflow
1. Run `crm_search` to resolve the contact.
2. Run `crm_outline` to identify populated sections and fill rates.
3. If any key sections (intelligence-profile, intelligence-strategic, tracking file) are empty, note the gap in the briefing and suggest using `enrich-contact` to fill it.
4. Read in parallel: `index`, `profile`, `intelligence-profile`, `intelligence-strategic`, `intelligence-risk`, tracking file (deals/assignments/etc.), and `log` (last 10 entries).
5. Run `crm_connections` to identify who they know that you also know.
6. Synthesize into the structured briefing format below.

## Output Template
```markdown
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

## Variant: Family Contacts
When the contact is in the Family category, replace "Deal Activity" with "Health Status" (from `medical.md`) and "Engagement Strategy" with "Support & Touchpoints". Use the `family-intel` output structure instead.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
