---
name: refresh-crm
description: Rebuild CRM plugin dist and sync to the Claude Code runtime directory. Use when user says "refresh crm", "rebuild crm", "crm not connecting", "update crm plugin", "fix crm mcp", or after making changes to crm-mcp-server source code.
allowed-tools:
  - Bash
  - Read
model: haiku
---

## Purpose
Rebuild the CRM MCP server from source and sync to the Claude Code plugin runtime directory (the marketplace clone). Handles the non-obvious gotcha: `${CLAUDE_PLUGIN_ROOT}` resolves to the **marketplace** directory, not the cache directory, so that's where `node_modules` and `dist/` must be current.

## Workflow

### Step 1 — Build dist from source
```bash
cd ~/crm-mcp-server-work && npm run build
```
If build fails, stop and report the error.

### Step 2 — Determine marketplace directory
```bash
MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/crm-mcp-server"
ls "$MARKETPLACE_DIR/.mcp.json" && echo "Marketplace dir OK"
```
If the directory doesn't exist, the plugin isn't installed. Tell the user to run `claude plugin install crm-mcp-server`.

### Step 3 — Pull latest into marketplace clone
```bash
cd "$MARKETPLACE_DIR" && git pull
```
If there are local changes blocking the pull, run `git checkout .` first (the marketplace clone should never have local modifications).

### Step 4 — Install production dependencies
```bash
cd "$MARKETPLACE_DIR" && npm install --omit=dev
```

### Step 5 — Smoke test
```bash
cd "$MARKETPLACE_DIR" && timeout 3 ./dist/mcp-entry.js 2>/tmp/crm-refresh-test.log; EXIT=$?; cat /tmp/crm-refresh-test.log
```
- Exit 124 (timeout) = success (server blocks on stdin, expected)
- Exit 1 with error = report the error
- Any stderr output = report it

### Step 6 — Report result
Tell the user:
- Build: OK/FAIL
- Marketplace sync: OK/FAIL
- Smoke test: OK/FAIL
- **Action required:** Run `/reload-plugins` then `/mcp` to reconnect. If `/mcp` says "Failed to reconnect", restart Claude Code to clear stale connection state.

## Key Architecture Note
Claude Code's plugin system for single-plugin-repo marketplaces uses the **marketplace clone** (`~/.claude/plugins/marketplaces/<name>/`) as the runtime directory. `${CLAUDE_PLUGIN_ROOT}` points there, NOT to the cache directory (`~/.claude/plugins/cache/<name>/`). The cache is used for version tracking and plugin metadata only.
