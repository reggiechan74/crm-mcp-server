---
name: refresh-crm
description: Alias for /crm:setup — the single post-update command. Use when user says "refresh crm", "rebuild crm", "crm not connecting", "update crm plugin", or "fix crm mcp".
allowed-tools:
  - Bash
  - Read
---

## This skill is now an alias for `/crm:setup`

The post-update workflow was consolidated into a single command so end users only run one thing after a plugin update. `/crm:setup` now does everything refresh-crm used to attempt — and does it correctly:

1. Syncs the marketplace clone to the latest pushed code (`git pull`, idempotent).
2. Reinstalls the native deps (`better-sqlite3`, `sqlite-vec`) that the plugin updater wipes on every version bump.
3. Validates the MCP server boots from `/tmp`.
4. Prompts the user to run `/mcp`.

**Action:** Read `${CLAUDE_PLUGIN_ROOT}/skills/setup/SKILL.md` and follow it exactly.

Do not run the old refresh-crm steps. The build-from-dev-clone step never reached the runtime — the runtime pulls from GitHub, not your dev clone — and `npm install --omit=dev` aborts on the `onnxruntime-node` binary and leaves you with no deps at all.
