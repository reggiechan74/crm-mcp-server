---
name: enrich-contact
description: Use when the user wants to fill gaps in a thin dossier, including "enrich [name]", "fill out [name]'s file", "I know more about [name] now", "update [name]'s profile", "complete this contact", "help me flesh this out", "what info am I missing", "let's improve this dossier", "beef up [name]'s dossier", or "what's missing for [name]".
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
Interview-driven dossier enrichment that identifies gaps and asks targeted questions to fill them.

## Workflow
1. Run `crm_search` to resolve the contact.
2. Run `crm_outline` to identify low-fill sections.
3. Prioritize empty sections by value: intelligence > profile > tracking > log.
4. Ask one targeted question at a time, grouped by section.
5. After each answer, run `crm_update` (or `crm_read` + edit) to update the relevant section.
6. Continue until the user says "that's all" or high-priority sections are sufficiently filled.
7. Aim for 3-5 questions per round. After 5 updates, summarize what changed and ask if the user wants to continue.

## Interaction Style
Use natural conversation, not rigid forms.

Preferred style:
- "What's their communication style like — formal or casual?"
- "Do you know what asset classes they focus on?"
- "Have you done any deals together?"

Avoid form-style prompts like:
- "Please provide value for field: Communication Style (Formal/Casual/Mixed)"

## Wrap-Up Template
When the enrichment session ends, summarize:
- **Updates Applied:** list each section updated and what changed
- **Fill Rate:** [before]% → [after]% (use crm_outline to check)
- **Remaining Gaps:** sections still empty or thin

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
