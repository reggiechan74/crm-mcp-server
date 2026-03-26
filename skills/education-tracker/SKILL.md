---
name: education-tracker
description: Use when the user wants a school progress synthesis for a family member (especially Izzy), such as "how's Izzy doing at school", "education update", "school progress", "what's happening at school", "summarize school milestones", "what should we focus on academically", "give me an education status report", "report card", "parent teacher conference", or "IEP update".
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
  - Read
---

## Purpose
Synthesize education-related progress, milestones, and next actions for a family member, primarily Izzy.

## Workflow
1. Run `crm_search` to resolve the family member.
2. Run `crm_read` with `section="education"` for school status, support plans, and milestones.
3. Run `crm_read` with `section="log"` for recent school-related entries and context. When scanning log entries, filter for entries mentioning: school, education, teacher, GIST, homework, grades, report card, IEP, or learning.
4. Ask before external read: `I can also pull in school updates from GIST_news.md — include that?`
5. If yes and accessible, read `00_STRATEGIC_CORE/GIST_news.md` using `Read` for current school news and action items.
6. Synthesize progress, focus areas, and concrete parent follow-ups.

## Output Template
```markdown
# Education Update: [Name]
**[School] — [Grade/Program] — [Term]**

## Current Status
[from education.md]

## Recent Milestones
[from log entries]

## School News
[from GIST_news.md — upcoming events, action items]

## Areas of Focus
[from education.md — strengths, growth areas]

## Recommended Next Actions
1. [Next parent action]
```

## Edge Cases
- **No education section:** If the family member's dossier has no education data, note this and suggest enrichment.
- **Non-student family members:** If the contact is not a student (e.g., adult family member), inform the user this skill is designed for tracking education progress.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
