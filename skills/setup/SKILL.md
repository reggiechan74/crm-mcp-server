---
name: setup
description: Install native deps (better-sqlite3, sqlite-vec) in the CRM marketplace dir and validate the MCP server. Run on every fresh Codespace or after "Failed to reconnect to plugin:crm:crm".
allowed-tools:
  - Bash
---

## Purpose
Install the native Node.js addons that cannot be bundled into dist and cannot be installed globally. Required on every fresh Codespace because `node_modules/` is gitignored.

**Symptom this fixes:** "Failed to reconnect to plugin:crm:crm" at session start, or `Cannot find module 'better-sqlite3'` when running the MCP server manually.

## Workflow

### Step 1 — Install native deps
```bash
cd ~/.claude/plugins/marketplaces/crm-mcp-server && npm install better-sqlite3 sqlite-vec --no-save
```

### Step 2 — Validate from /tmp
Run from `/tmp` (no ambient `node_modules/`) to simulate Claude Code's execution environment:
```bash
cd /tmp && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 10 node ~/.claude/plugins/marketplaces/crm-mcp-server/dist/mcp-server.mjs 2>&1 | head -3
```

**Pass:** response starts with `{"result":{"protocolVersion":` and lists CRM tools.
**Fail:** `Cannot find module 'better-sqlite3'` — Step 1 did not complete successfully.

### Step 3 — Reload MCP in Claude Code
Tell the user: run `/mcp` to reconnect the plugin.

## Why native deps can't be bundled
`better-sqlite3` and `sqlite-vec` are compiled C++ addons (`.node` binary files). esbuild bundles JavaScript only — binary files cannot be inlined. `npm install -g` only puts CLIs in PATH, not packages available to `require()`. Node.js resolves `require('better-sqlite3')` from the script's directory, so deps must live in `node_modules/` adjacent to the marketplace dir where Claude Code runs the server.
