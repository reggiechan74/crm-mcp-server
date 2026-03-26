---
name: pipeline-review
description: Use when the user asks for portfolio-wide deal pipeline status, like "pipeline review", "what deals are active", "what's in play", "deal pipeline", "show me active transactions", "where are we stuck", "pipeline health", "quarterly pipeline check", or "aggregate all deals".
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
  - Bash
  - Read
  - Write
---

## Purpose
Cross-contact deal pipeline summary that aggregates deal activity across all contacts.

## Workflow
1. Run `crm_search` to find contacts with tracking files (profession-based dossiers).
2. For contacts with deals/assignments/projects tracking files, run `crm_read` for tracking sections.
3. Aggregate active deals, pipeline volume, deals by asset class, and referral balance.
4. Flag deals needing action, stale deals, and referral imbalances.
5. Ask before file output: `Save this report to a file? [Y/path/N]`.
6. If yes, write to the provided path or default `09_AGENT_REPORTS/crm/`.

## Output Template
```markdown
# Pipeline Review — [Date]

## Active Pipeline
| Deal/Property | Contact | Asset Class | Role | Est. Value | Status | Est. Close |
|--------------|---------|-------------|------|:----------:|--------|:----------:|

## Pipeline Summary
| Metric | Value |
|--------|-------|
| Active Deals | [N] |
| Total Pipeline Volume | [$X] |
| Avg Deal Size | [$X] |
| Deals Closing This Quarter | [N] |

## By Asset Class
| Asset Class | # Deals | Volume | Avg Size |
|-------------|:-------:|:------:|:--------:|

## Referral Balance
| Contact | From Them | To Them | Net Position |
|---------|:---------:|:-------:|:------------:|
[Top 5 referral relationships]

## Needs Attention
- [Deal X] — no activity in 30 days, check with [Contact]
- [Deal Y] — closing date passed, update status

## Recommended Next Actions
1. [Highest-priority pipeline action]
```

## Token Strategy
Scan `section="index"` first to identify contacts with tracking files. Only read tracking sections for contacts that have deal/assignment/project data. Do not read full dossiers for all contacts.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
