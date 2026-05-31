---
name: setup
description: Diagnostic for when the CRM plugin won't connect. Syncs the marketplace clone to the latest pushed code and validates the MCP server boots. Use for "crm not connecting", "fix crm mcp", "rebuild crm", "update crm", "Failed to reconnect to plugin:crm:crm", or on a fresh environment.
allowed-tools:
  - Bash
---

## Purpose
Make the CRM plugin runtime correct and confirm it boots — in one command.

As of v0.7.0 the MCP server has **no native dependencies**: it uses Node's
built-in `node:sqlite` and the esbuild bundle is fully self-contained. The plugin
updater can re-create the marketplace clone freely and the server still boots, so
there is no longer a per-update reinstall step. This skill is now just a
diagnostic for the two things that can still leave the plugin disconnected:

1. **Stale code** — the auto-updater hasn't pulled the latest `dist/` into the
   marketplace clone yet. Step 1 forces it (idempotent).
2. **Stale connection state** — Claude Code is holding a dead MCP connection.
   Step 3 reloads it.

**Symptom this fixes:** "Failed to reconnect to plugin:crm:crm" at session start.

> There is only one runtime — the marketplace clone at
> `~/.claude/plugins/marketplaces/crm-mcp-server`. `${CLAUDE_PLUGIN_ROOT}`
> resolves there for **every** project repo that uses the plugin, so running this
> once fixes the plugin everywhere.

## Requirement
Node >= 22.5 (ships with current Claude Code). `node:sqlite` is unavailable on
older Node; if validation fails with `Cannot find module 'node:sqlite'`, upgrade
Node.

## Workflow

### Step 1 — Sync the runtime to latest pushed code (idempotent)
```bash
MKT="$HOME/.claude/plugins/marketplaces/crm-mcp-server"
ls "$MKT/.mcp.json" >/dev/null 2>&1 || { echo "Plugin not installed. Run: claude plugin install crm-mcp-server"; exit 1; }
cd "$MKT" && git checkout . 2>/dev/null; git pull --ff-only 2>&1 | tail -2
```
The marketplace clone should never have local edits — `git checkout .` discards
any before pulling. "Already up to date" is the normal, expected result when the
auto-updater already pulled.

### Step 2 — Validate from /tmp
Run from `/tmp` (no ambient `node_modules/`) to match Claude Code's execution
environment and prove the bundle is self-contained:
```bash
cd /tmp && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 10 node "$HOME/.claude/plugins/marketplaces/crm-mcp-server/dist/mcp-server.mjs" 2>&1 | head -3
```

**Pass:** response starts with `{"result":{"protocolVersion":` and lists CRM tools.
**Fail:** `Cannot find module 'node:sqlite'` — Node is older than 22.5; upgrade it.

### Step 3 — Reload MCP in Claude Code
Tell the user: run `/mcp` to reconnect the plugin. If `/mcp` still reports
"Failed to reconnect," restart Claude Code to clear stale connection state.

## Note on semantic search
`crm_vector_search` uses the optional `@huggingface/transformers` dependency,
which is not installed by default (it pulls the large native `onnxruntime-node`
addon). The core server, FTS keyword search (`crm_search`), and `crm_reindex`
work without it. To enable semantic search, install transformers in the
marketplace clone explicitly:
```bash
cd "$HOME/.claude/plugins/marketplaces/crm-mcp-server" && npm install @huggingface/transformers --no-save
```
This is opt-in and unrelated to getting the plugin to connect.
