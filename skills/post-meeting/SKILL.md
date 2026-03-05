---
name: post-meeting
description: Use when the user wants to debrief and log an interaction, like "just met with X", "had coffee/lunch with X", "debrief X", "log meeting", "just got off a call", "capture notes from this convo", "update the CRM from that meeting", "what should we update after I spoke with X", "ran into [name]", "talked to [name] today", or "bumped into [name]".
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
Structured debrief that turns a quick summary into updates across multiple dossier sections.

## Workflow
1. Run `crm_search` to resolve the contact.
2. Run `crm_outline` to inspect dossier state.
3. If details are missing, ask: what was discussed, deals mentioned, names dropped, commitments, and next action.
4. Run `crm_log` to append an interaction entry.
5. Run `crm_update` to update last contact date and next action in `INDEX.md`.
6. If deals were mentioned, run `crm_read` on the tracking file, then update existing deal or add new deal data. Use `crm_update` with the tracking section to update deal status.
7. If new names were mentioned, offer to create contacts via `crm_create`.
8. If intelligence was gathered, update the relevant intelligence section.

## Interaction Style
Conversational by default.
- If the user gives a bare statement (for example, "just had coffee with Ross"), ask 2-3 quick follow-up questions first.
- If the user gives a detailed dump, skip follow-up questions and process updates directly.

## Output Template
```markdown
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

## Edge Cases
- **Multi-person meetings:** If the user mentions multiple contacts ('had lunch with Ross and Mina'), resolve each contact separately and apply updates to all dossiers.
- **Chance encounters:** Treat 'ran into' and 'bumped into' the same as scheduled meetings — still log and update.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
