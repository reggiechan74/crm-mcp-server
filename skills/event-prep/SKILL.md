---
name: event-prep
description: Use when the user needs networking prep for an event, like "prep me for [event]", "who do I know there", "conference prep", "gala prep", "I'm going to [event]", "give me talking points", "who should I prioritize", "networking game plan", "event contact brief", "dinner prep", or "I have [event] coming up".
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
Bulk briefing cards for contacts likely to attend an event.

## Workflow
1. Get event name and optional attendee list/context from the user.
2. If attendee list is provided, run `crm_search` for each name.
3. If no list is provided, run `crm_vector_search` for event/org terms and `crm_search` by likely categories.
4. For each match, run `crm_read` with `section="index"` for snapshot data.
5. For top contacts (strongest relationships), run `crm_read` with `section="log"` for latest context.

## Output Template
```markdown
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

## Recommended Next Actions
1. [e.g., "Follow up with [Name] within 48 hours of event"]
```

## Token Strategy
Cap to 15 contacts maximum. If more matches are found, prioritize by relationship strength and show top 15. For attendees not in CRM, list them under 'People to Meet' with whatever context the user provided — do not offer to create dossiers individually. Instead, offer a single bulk creation at the end: 'Want me to create dossiers for the [N] new contacts?'

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
