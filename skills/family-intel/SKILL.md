---
name: family-intel
description: Use when the user asks for a full family-member wellbeing brief, including "brief me on [family member]", "family update on [name]", "how's [name] doing", "what's going on with [family member]", "give me the full picture on [name]", "support plan for [name]", "check in on [name]", "status update for [family member]", "how's mom/dad doing", or "how's my [relationship] doing". This skill applies only to Family-category contacts. For professional/network contacts, use intel-briefing instead.
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
---

## Purpose
Full family member briefing focused on wellbeing, relationship dynamics, and practical support.

## Workflow
1. Run `crm_search` to resolve the contact and confirm Family category.
2. If the contact is not in the Family category, inform the user and suggest `intel-briefing` instead.
3. Run `crm_outline` to identify populated sections and major gaps.
4. Read in parallel: `index`, `profile`, `medical.md`, `intelligence-relational.md`, `intelligence-health-check.md`, and recent `log` entries.
5. Run `crm_connections` to map family relationships and support network context.
6. Synthesize into the structure below, prioritizing near-term support and touchpoints.

## Output Template
```markdown
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

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
