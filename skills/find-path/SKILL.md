---
name: find-path
description: Use when the user wants intro routes to a person or company, like "who can introduce me to X", "path to X", "how do I get to X", "connection chain to [org]", "I need to reach [person]", "who knows them", "warm intro options", "who's my best bridge contact", "do I know anyone at [company]", or "introduction to [name]".
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
Find introduction chains through your network to reach a target person or organization.

## Workflow
1. Run `crm_search` or `crm_vector_search` to find the target (the target may not be in CRM).
2. If the target is in CRM, run `crm_connections` for direct connections.
3. Build the broader graph by using `crm_connections` across relevant contacts. Limit graph exploration to 2 hops maximum. Start with contacts in the same industry or organization as the target. Do not traverse more than 20 contacts total.
4. Run `crm_vector_search` for the target organization to find people who work there or have dealt with them.
5. Find shortest paths: You -> Intermediary -> Target.
6. Rank paths by intermediary relationship strength.

## Output Template
```markdown
# Path to [Target Name/Org]

## Direct Connections
[If any — contacts who know the target directly]

## Introduction Paths (ranked by strength)

### Path 1 (Strongest)
You -> **[Name A]** (relationship: [8/10]) -> **[Target]**
- [Name A] knows [Target] through [context]
- Suggested ask: "[specific phrasing for the introduction request]"

### Path 2
You -> **[Name B]** -> **[Name C]** -> **[Target]**
- Two-hop path. [Name B] can connect you to [Name C], who works with [Target]

## No Path Found
[If no connections exist — suggest cold outreach strategies or events where target might appear]
```

If no introduction path exists, suggest: (a) cold outreach via LinkedIn with a personalized message referencing shared industry context, (b) industry events where the target is likely to appear, (c) creating a dossier for the target to track future connection opportunities.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
