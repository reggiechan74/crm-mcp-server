---
name: competitive-intel
description: Use when the user wants a full intelligence picture on an organization, such as "what do I know about [org]", "intel on [company]", "who do I know at [org]", "competitive intel", "org brief", "where are they strong/weak", "who in my network touched them", or "how should I position against [org]".
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
Synthesize everything your CRM knows about a competing or target organization.

## Workflow
1. Run `crm_vector_search` to find all contacts mentioning the organization.
2. For each hit, run `crm_read` for `index`, `intelligence-strategic`, and the tracking file.
3. Cross-reference who works there, who used to work there, and who does deals with them.
4. Run `crm_connections` to map inter-organizational relationships.

## Output Template
```markdown
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

## Recommended Next Actions
1. [Highest-priority intelligence action]
2. [Relationship to strengthen for better intel access]
3. [Gap to fill — contact to create or enrich]
```

## Edge Cases
- **Zero results:** If `crm_vector_search` returns no contacts mentioning this organization, say so plainly and suggest the user add intel via `enrich-contact` or `post-meeting` after their next relevant interaction.
- **Former employees:** Pay special attention to contacts who previously worked at the target org — they often have the most candid intelligence.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
