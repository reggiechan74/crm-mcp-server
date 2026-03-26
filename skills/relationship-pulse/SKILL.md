---
name: relationship-pulse
description: Use when the user asks for network health and who to contact next, including casual asks like "relationship pulse", "how's my network", "who should I call", "who am I neglecting", "who should I text", "weekly check-in", "touch base list", "who's gone cold", "who needs love", or "give me my outreach priorities".
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
Weekly/monthly relationship health check with prioritized touchpoint recommendations.

## Workflow
1. Run `crm_stats` for overall health.
2. Run `crm_recent` to see recent touchpoints.
3. Run `crm_search` by category in priority order: Clients, Prospects, Advisors, Network, Colleagues, Family, Personal. This ensures high-value contacts surface first if token budget forces early termination.
4. For each contact, run `crm_read` with `section="index"` to capture last contact date, relationship strength, and next action.
5. Segment contacts into priority tiers.
6. For A-tier overdue contacts only, run `crm_read` with `section="log"` for interaction context.

## Token Strategy
Scan at index level first. With ~98 contacts at ~100 tokens each, full scans can exceed 10K tokens. Use `crm_search` category filters, process in batches, and only drill into logs for the top 5-10 flagged contacts.

## Output Template
```markdown
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

(For a full date calendar, use the `birthday-and-dates` skill.)

## Recommended Next Actions
1. [Highest-priority touchpoint with reasoning]
```

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
