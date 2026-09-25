---
name: lookup
description: Use whenever the user mentions the CRM or wants to find someone's record — "crm", "check the crm", "is X in the crm", "look up X", "pull up X", "find X", "X's file / dossier / record", "where is X's dossier", "who is X", "what's X's email / phone / org / title", "when did I last talk to X", "what did X say about Y". Finds the person or organization through the CRM's SQLite index and points to the exact dossier file without searching the repo. For a full pre-meeting brief ("brief me", "prep me"), use intel-briefing instead.
argument-hint: "[name, company or dossier code] [optional question]"
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
The cheapest way to answer "who is this / where is their file / what do I have on them". The CRM keeps an SQLite index of every dossier, so a lookup costs ~100 tokens instead of a repo search. Read as little as possible: one index search, one outline, and at most one section.

Request: $ARGUMENTS

## Rules
- **Never locate records by searching files.** No Grep, Glob, `find`, `ls` or Read over the CRM folder to find a person — the index already has them. Only read a dossier file directly if the user asks you to edit it by hand.
- If the CRM tools are not available yet, load them first with ToolSearch: `select:mcp__plugin_crm_crm__crm_search,mcp__plugin_crm_crm__crm_outline,mcp__plugin_crm_crm__crm_read,mcp__plugin_crm_crm__crm_recent`. If they still cannot be loaded, the MCP server is not connected — tell the user to run `/crm:setup` and stop (do not fall back to searching files).

## Workflow

### 1. Nothing to look up
If the request is empty, call `crm_recent` (limit 10) and show it, then say: "Ask about anyone with `/crm <name>` or just mention them with 'crm'."

### 2. Find the record
Call `crm_search` with `query` = the name, company, alias or dossier code, `paths: true`, `limit: 5`.
- **One match** → go to step 3.
- **Several matches** → show the compact table (ID, name, org, category, last contact) and ask which one with AskUserQuestion. Do not read anything yet.
- **No match** → retry once with the surname, a nickname, or the company name. Still nothing → say so plainly and offer to create a dossier (`crm_create`).
- For organizations you can also filter: `orgType` (e.g. `PM`) or `orgGroup` (e.g. `LENDING`).

### 3. Point to the file
Call `crm_outline` for the matched ID and answer with a short card:

**<Name>** (<ID>) — <org> · <category> · <status> · last contact <date>
Dossier: `<folder path>`

| Section | File | Filled |
|---|---|---|
| index | `<folder>/INDEX.md` | 64% |
| … | … | … |

Keep it to the card — no summary of contents the user did not ask for.

### 4. Answer a specific question (only if asked)
If the request includes a question ("email?", "when did we last talk?", "what did she say about the offer?"), read **one** section with `crm_read` and answer from it:
- contact details, org, title, aliases → `index` (or `profile`)
- last conversation, what was said, follow-ups → `log`
- background, career → `profile`
- personality, motives → `intelligence-profile`
- a company's lending, deals, projects… → its type file (`lending`, `deal-flow`, `projects`, …) from the outline

Quote the answer with the file it came from. If that section does not answer it, say which section likely does and ask before reading more.

### 5. Next step
End with one line offering the obvious follow-up: `/crm:intel-briefing <name>` for a full brief, `/crm:post-meeting <name>` to log an interaction, or `crm_connections` to see who they are linked to.
