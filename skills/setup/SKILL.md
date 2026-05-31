---
name: setup
description: The one command to run after updating the CRM plugin or on a fresh environment. Syncs the marketplace clone to the latest pushed code, installs the native deps (better-sqlite3, sqlite-vec) that the plugin updater wipes, and validates the MCP server. Use for "update crm", "refresh crm", "crm not connecting", "fix crm mcp", "rebuild crm", "Failed to reconnect to plugin:crm:crm", or on a fresh Codespace.
allowed-tools:
  - Bash
---

## Purpose
Make the CRM plugin runtime correct after a version bump or on a fresh environment — in one command. This does two orthogonal jobs:

1. **Code sync** — pull the latest pushed bundles into the marketplace clone (the runtime). The plugin auto-updater usually does this, but this step is idempotent and guarantees it.
2. **Native deps** — reinstall `better-sqlite3` and `sqlite-vec`. The plugin updater re-creates the marketplace dir on every version bump and `node_modules/` is gitignored, so the native addons are wiped on **every update**. Nothing reinstalls them automatically.

**Symptom this fixes:** "Failed to reconnect to plugin:crm:crm" at session start, or `Cannot find module 'better-sqlite3'` when running the MCP server manually.

> There is only one runtime — the marketplace clone at `~/.claude/plugins/marketplaces/crm-mcp-server`. `${CLAUDE_PLUGIN_ROOT}` resolves there for **every** project repo that uses the plugin, so running this once fixes the plugin everywhere.

## Workflow

### Step 1 — Sync the runtime to latest pushed code (idempotent)
```bash
MKT="$HOME/.claude/plugins/marketplaces/crm-mcp-server"
ls "$MKT/.mcp.json" >/dev/null 2>&1 || { echo "Plugin not installed. Run: claude plugin install crm-mcp-server"; exit 1; }
cd "$MKT" && git checkout . 2>/dev/null; git pull --ff-only 2>&1 | tail -2
```
The marketplace clone should never have local edits — `git checkout .` discards any before pulling. "Already up to date" is the normal, expected result when the auto-updater already pulled.

### Step 2 — Install native deps (required on every update)
```bash
cd "$HOME/.claude/plugins/marketplaces/crm-mcp-server" && npm install better-sqlite3 sqlite-vec --no-save
```
**Use `--no-save` with exactly these two packages.** Do NOT run `npm install` / `npm install --omit=dev` — that pulls `@huggingface/transformers` → `onnxruntime-node`, whose prebuilt binary download fails (`ENOENT`) and aborts the whole npm transaction, leaving you with no deps at all. transformers is only needed for `crm_vector_search`; the core server and `crm_reindex` don't need it.

### Step 3 — Validate from /tmp
Run from `/tmp` (no ambient `node_modules/`) to simulate Claude Code's execution environment:
```bash
cd /tmp && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 10 node "$HOME/.claude/plugins/marketplaces/crm-mcp-server/dist/mcp-server.mjs" 2>&1 | head -3
```

**Pass:** response starts with `{"result":{"protocolVersion":` and lists CRM tools.
**Fail:** `Cannot find module 'better-sqlite3'` — Step 2 did not complete successfully.

### Step 4 — Reload MCP in Claude Code
Tell the user: run `/mcp` to reconnect the plugin. If `/mcp` still reports "Failed to reconnect," restart Claude Code to clear stale connection state.

## Why native deps can't be bundled
`better-sqlite3` and `sqlite-vec` are compiled C++ addons (`.node` binary files). esbuild bundles JavaScript only — binary files cannot be inlined, so they stay external and must live in `node_modules/` adjacent to the marketplace dir where Claude Code runs the server. `npm install -g` only puts CLIs in PATH, not packages available to `require()`. That is why a wiped `node_modules/` breaks the server even though the committed `dist/*.mjs` bundle is current.
