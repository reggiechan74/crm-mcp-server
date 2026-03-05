---
name: annual-review
description: Use when the user wants a year-end or annual CRM/relationship network synthesis, such as "annual review", "year-end CRM review", "annual relationship review", "year in review", "how did my network perform this year", "full yearly report", "summarize the year", or "next-year CRM priorities".
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
model: sonnet
---

## Purpose
Comprehensive year-end portfolio review combining multiple skill outputs.

## Workflow
1. **Relationship Health scan:** Run `crm_stats` for overall metrics. Run `crm_recent` for recent activity. Run `crm_search` by category and `crm_read` with `section="index"` across all contacts to identify stale, warming, and cooling relationships. Segment into priority tiers.
2. **Pipeline scan:** Run `crm_search` to find contacts with tracking files. Run `crm_read` on tracking sections to aggregate active deals, pipeline volume, and referral balances.
3. **ROI analysis:** From the index-level data already collected, compute value generated vs. interaction frequency. Identify over-invested (high touch, low return) and under-invested (high potential, low touch) contacts.
4. **CRM health:** Run `crm_audit` for structural health. Run `crm_stats` for fill rates and category breakdown.
5. Add year-over-year comparisons if a prior annual review exists. If this is the first annual review, use only the current year column in the "Year in Numbers" table and note this as the baseline year.
6. Generate priorities for next year based on gaps, stale relationships, and pipeline opportunities.
7. This is the heaviest skill and will likely approach context limits. Proactively offer file output via AskUserQuestion before generating the full report: "This will be a long report. Save to a file? [Y/path/N]". Default path: `09_AGENT_REPORTS/crm/`.

## Output Template
```markdown
# Annual Relationship Review — [Year]

## Year in Numbers
| Metric | This Year | Last Year | Change |
|--------|:---------:|:---------:|:------:|

## Relationship Health
[Condensed from relationship-pulse]

## Deal Activity
[Condensed from pipeline-review]

## Network Value
[Condensed from relationship-roi]

## CRM Quality
[Condensed from crm-health]

## Key Wins
[Top 5 relationship outcomes this year]

## Lessons Learned
[Patterns from the data]

## Recommended Next Actions
1. [Strategic relationship goal]
2. [Network gap to fill]
3. [Maintenance goal]
```

## Edge Cases
- **First annual review:** If no prior year data exists, omit the 'Last Year' and 'Change' columns from the Year in Numbers table. Note this as the baseline year for future comparisons.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
