---
name: relationship-roi
description: Use when the user asks which relationships produce the most business value, including "relationship ROI", "most valuable contacts", "network value analysis", "who generates business", "where should I spend time", "high touch low return", "underinvested relationships", "time allocation across contacts", "return on relationships", or "ROI on my network".
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
Analyze which relationships generate the most value (deals, referrals, introductions) relative to time invested.

## Workflow
1. Run `crm_search` for all contacts.
2. For each contact, run `crm_read` with `section="index"` for deal velocity metrics.
3. For profession-based contacts, run `crm_read` on tracking files for referral balance and deal history.
4. Run `crm_read` with `section="log"` to estimate interaction frequency (proxy for time invested).
5. Compute value generated versus interaction frequency.
6. Ask before file output: `Save this report to a file? [Y/path/N]`.
7. If yes, write to the provided path or default `09_AGENT_REPORTS/crm/`.

## Output Template
```markdown
# Relationship ROI Analysis — [Date]

## Top 10 by Value Generated
| Rank | Contact | Deals | Volume | Referrals | Total Value |
|:----:|---------|:-----:|:------:|:---------:|:-----------:|

## Top 10 by Referral Volume
| Rank | Contact | Referrals In | Referrals Out | Net |

## Over-Invested (High Touch, Low Return)
| Contact | Interactions (12mo) | Value Generated | Assessment |
[Contacts you meet frequently but generate little deal flow]

## Under-Invested (High Potential, Low Touch)
| Contact | Relationship Strength | Deal Potential | Days Since Contact |
[Strong relationships you're neglecting]

## Recommended Next Actions
1. [Rebalance time allocation]
```

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
