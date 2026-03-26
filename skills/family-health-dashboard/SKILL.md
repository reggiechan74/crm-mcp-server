---
name: family-health-dashboard
description: Use when the user asks for a cross-family medical overview, such as "family health check", "health dashboard", "how's the family doing health-wise", "any medical follow-ups", "what appointments are coming up", "what screenings are overdue", "give me the family medical snapshot", "medication refills", or "family medical overview".
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
Cross-family medical overview covering active issues, upcoming appointments, overdue screenings, and medication cadence.

## Workflow
1. Run `crm_search` with Family category scope to identify family contacts.
2. For each family contact, run `crm_read` with `section="medical"` only.
3. Aggregate active conditions, upcoming appointments, overdue screenings, and refill/schedule items.
4. Highlight highest-priority follow-ups and unresolved actions.

## Output Template
```markdown
# Family Health Dashboard — [Date]

## Active Health Issues
| Member | Condition | Status | Next Action | Due |
|--------|-----------|--------|------------|-----|

## Upcoming Appointments
| Date | Member | Type | Provider | Prep Needed? |
|------|--------|------|----------|:------------:|

## Overdue Screenings
| Member | Screening | Last Done | Recommended Frequency | Overdue By |
|--------|-----------|:---------:|:---------------------:|:----------:|

## Medication Schedule
| Member | Medication | Purpose | Frequency | Refill Due |
|--------|-----------|---------|-----------|:----------:|

## Recommended Next Actions
1. [Most urgent medical follow-up]
```

## Token Strategy
Only read `medical` section (the frequently-updated file) for each family member. Do not read genetics, pharmacogenomics, or labs — those are static files loaded only by `medical-briefing` for specific appointments. If a family member has no medical.md, note them as 'No medical data on file' and suggest using `enrich-contact`.

## Notes
This skill is intentionally limited to `medical.md` reads for each family member. Do not load genetics, pharmacogenomics, or lab sections in this workflow.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
