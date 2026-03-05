---
name: birthday-and-dates
description: Use when the user wants upcoming important dates across all contacts, including "any birthdays coming up", "key dates", "important dates", "upcoming anniversaries", "who has a birthday this month", "what did I miss this week", "show me date reminders", "who should I reach out to for birthdays and milestones", "upcoming milestones", or "who do I need to wish happy birthday".
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
model: haiku
---

## Purpose
Surface upcoming key dates across ALL contacts with practical outreach suggestions, including recently missed dates.

## Workflow
1. Run `crm_search` to enumerate contacts across all categories.
2. For each contact, read `section="index"` first (cheapest). Only read `section="profile"` if the index lacks date fields for that contact.
3. Filter to the next 30 days (or user-specified window) and group by urgency.
4. Identify recently missed dates from the last 7 days and propose recovery actions.
5. Optionally check `log` for high-priority contacts to reference last-year gestures in action suggestions.

## Output Template
```markdown
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

## Time Window
Default to next 30 days. If the user specifies a different window ('next 60 days', 'this quarter'), adjust accordingly.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
