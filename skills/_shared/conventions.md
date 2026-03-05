# CRM Skill Conventions

These rules apply to all CRM plugin skills.

## Allowed Tools
All CRM skills should rely on this tool set by default:
- `mcp__plugin_crm_crm__crm_search`
- `mcp__plugin_crm_crm__crm_outline`
- `mcp__plugin_crm_crm__crm_read`
- `mcp__plugin_crm_crm__crm_update`
- `mcp__plugin_crm_crm__crm_log`
- `mcp__plugin_crm_crm__crm_connections`
- `mcp__plugin_crm_crm__crm_vector_search`
- `mcp__plugin_crm_crm__crm_stats`
- `mcp__plugin_crm_crm__crm_recent`
- `mcp__plugin_crm_crm__crm_audit`
- `mcp__plugin_crm_crm__crm_repair`
- `mcp__plugin_crm_crm__crm_export`
- `mcp__plugin_crm_crm__crm_bulk_update`
- `mcp__plugin_crm_crm__crm_create`
- `AskUserQuestion`

Add `Bash`, `Read`, and `Write` only when the skill needs external files or report output.

All skills declare the full tool set so Claude can handle edge cases opportunistically (e.g., offering to create a missing contact, logging an interaction). Skills should only *routinely* call the tools listed in their Workflow section.

## Output Format
- Start with a one-line summary sentence.
- Use markdown tables for structured data.
- Use headers to separate sections.
- End with `Recommended Next Actions` as a numbered list (or preserve a skill-specific equivalent heading from the design template).
- Do not use emoji unless the user's prompt uses them.

## Contact Resolution
- If the user names a contact, call `crm_search` first.
- If multiple matches are returned, present options and ask the user to choose.
- If no match is found, say that clearly and offer to create a record via `crm_create`.

## Token Awareness
- Every `crm_read` call returns token usage; treat it as a hard budget signal.
- For multi-contact workflows, scan `section=\"index\"` first, then drill into deeper sections only for flagged contacts.
- Never read all sections for all contacts in one invocation.
- For vector-search workflows, cap to top-ranked hits (typically top 10-15).

## Model Tiers
- `model: haiku` for lightweight scans, date lookups, and structural checks.
- `model: sonnet` for heavy cross-contact aggregation and synthesis.
- `model: default (opus)` for nuanced synthesis, sensitive context, and conversational back-and-forth.

## AskUserQuestion Patterns
- Reporting skills should ask before file output: `Save this report to a file? [Y/path/N]`
- Cross-project skills should ask before external reads: `I can also pull in [source] — include that?`

## Error Handling
- If a section is empty or a dossier is thin, explicitly call out the gap and suggest using `enrich-contact`.
- If CRM search returns no results, state that plainly and do not fabricate details.
- If critical data is missing for a requested analysis, return best-effort output with a clear missing-data block.
