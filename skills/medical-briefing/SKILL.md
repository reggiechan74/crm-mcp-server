---
name: medical-briefing
description: Use when the user wants a pre-appointment family health brief, including "medical briefing for [name]", "[name] has a doctor appointment", "prep me for [name]'s appointment", "[name] seeing the cardiologist", "what's [name]'s health status", "summarize meds and labs before the visit", "what should we ask the doctor", "give me a health prep sheet", "Izzy's cardiology", "Izzy's lipids", "[name] has a checkup", or "[name] has a physical".
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
Pre-appointment health synthesis for a Family contact.

## Workflow
1. Run `crm_search` to resolve the contact and confirm they are in the Family category.
2. If the contact is not in the Family category, inform the user: 'Medical briefing is designed for Family contacts. For a general brief on [name], try intel-briefing.' Then stop.
3. If the appointment type is not specified in the user's prompt, ask: 'What type of appointment? (e.g., cardiology, pediatrician, dentist, general checkup).' Use the answer to determine which lab and genetics sections are relevant.
4. Run `crm_read` with `section="medical"` for current health status, conditions, and medications.
5. Run `crm_read` with `section="medical-labs"` for recent lab results and trends.
6. Run `crm_read` with `section="medical-pharmacogenomics"` for medication-response or interaction alerts.
7. Run `crm_read` with `section="medical-genetics"` for relevant inherited-risk findings when appointment type warrants it.
8. Run `crm_read` with `section="log"` and focus on recent symptom changes, incidents, or concerns.
9. Synthesize the appointment-ready brief with questions and checklist items.

## Output Template
```markdown
# Medical Briefing: [Name]
**Appointment: [Type/Specialist] — [Date if known]**

## Current Health Summary
[from medical.md — active conditions, current medications, recent events]

## Relevant Lab Trends
| Test | Last Result | Previous | Reference | Trend |
|------|:-----------:|:--------:|:---------:|:-----:|
[from medical-labs.md — only tests relevant to this appointment type]

## Pharmacogenomic Alerts
[from medical-pharmacogenomics.md — ONLY if medications are being discussed]
- [Drug class]: [Alert] ([Gene variant])

## Recent Health Events
[from log entries — symptoms, incidents, concerns mentioned recently]

## Questions for the Doctor
1. [Generated from gaps in data, recent symptoms, or medication changes]
2. [Based on lab trends]
3. [Based on upcoming milestones]

## Bring to Appointment
- [ ] Insurance card
- [ ] List of current medications
- [ ] Lab results from [date] (if not already sent)
- [ ] [Any other relevant documents]
```

## Variant: Izzy FH Cardiology
For FH-focused cardiology appointments, emphasize LDL-C and broader lipid trajectory over time, Praluent tracking (adherence, dose timing, refill continuity), and any FH genetic confirmation notes relevant to treatment planning.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
