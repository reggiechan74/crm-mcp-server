---
name: crm-health
description: Use when the user wants CRM quality scoring and audit findings, including "CRM health check", "audit my CRM", "how complete are my files", "dossier quality", "what's broken", "data quality report", "cleanliness check", "template compliance", "give me a CRM scorecard", "fix my CRM", "stale contacts", or "which contacts need updating".
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
Structural health assessment across the entire CRM: template compliance, fill rates, and data quality.

## Workflow
1. Run `crm_stats` for baseline metrics.
2. Run `crm_audit` for the 5-pass audit (compliance, misplaced, stale, duplicates, ordering).
3. Run `crm_search` by category to scan fill-rate distribution.
4. Aggregate findings by severity and category.
5. Ask before file output: `Save this report to a file? [Y/path/N]`.
6. If yes, write to the provided path or default `09_AGENT_REPORTS/crm/`.

## Output Template
```markdown
# CRM Health Report — [Date]

## Overall Score: [X/100]
| Metric | Value | Status |
|--------|-------|--------|
| Total Contacts | [N] | — |
| Avg Fill Rate | [X%] | [Good/Needs Work] |
| Template Compliance | [X%] | [Good/Needs Work] |
| Stale Contacts (>30d) | [N] | [Concern if >50%] |
| Orphaned (no connections) | [N] | [Concern if high] |
| Zero-Log Contacts | [N] | [Concern if high] |

## Issues Found
### Critical
- [e.g., "12 contacts missing INDEX.md snapshot data"]

### Moderate
- [e.g., "8 contacts have content in wrong tier files"]

### Minor
- [e.g., "3 contacts have sections out of template order"]

## Category Breakdown
| Category | Contacts | Avg Fill | Stale | Issues |
|----------|:--------:|:--------:|:-----:|:------:|
| Network | 60 | 88% | 42 | 15 |
| Family | 13 | 95% | 3 | 2 |
| ... | | | | |

## Recommended Next Actions
1. Run `crm_repair` on [N] contacts with auto-fixable issues
2. Prioritize enrichment for [contacts with lowest fill rates]
3. Review [stale contacts] for archive candidates
```

## Scoring Formula
Compute overall score as: `(avg_fill_rate × 0.4) + (template_compliance × 0.3) + (non_stale_percentage × 0.2) + (connected_percentage × 0.1)`, scaled to 100. This ensures consistent scoring across invocations.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
