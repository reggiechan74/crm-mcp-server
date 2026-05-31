---
name: refresh-crm
description: Alias for /crm:setup — the CRM connection diagnostic. Use when user says "refresh crm", "rebuild crm", "crm not connecting", "update crm plugin", or "fix crm mcp".
allowed-tools:
  - Bash
  - Read
---

## This skill is now an alias for `/crm:setup`

As of v0.7.0 the CRM MCP server has no native dependencies (it uses Node's
built-in `node:sqlite`), so plugin updates survive a reload with no reinstall
step. `/crm:setup` is now a lightweight connection diagnostic that:

1. Syncs the marketplace clone to the latest pushed code (`git pull`, idempotent).
2. Validates the MCP server boots from `/tmp`.
3. Prompts the user to run `/mcp`.

**Action:** Read `${CLAUDE_PLUGIN_ROOT}/skills/setup/SKILL.md` and follow it exactly.

Do not reinstall `better-sqlite3` / `sqlite-vec` — they are no longer
dependencies. Do not run `npm install --omit=dev`.
