---
name: refresh-crm
description: Sync CRM plugin to the Claude Code runtime directory. Use when user says "refresh crm", "rebuild crm", "crm not connecting", "update crm plugin", "fix crm mcp", or after making changes to crm-mcp-server source code.
allowed-tools:
  - Bash
  - Read
---

## Purpose
Sync the CRM MCP server to the Claude Code plugin runtime directory (the marketplace clone). Since v0.4.5+, dist is pre-bundled (esbuild) and committed — no build step needed on the consumer side.

## Workflow

### Step 1 — Build dist from source (dev clone only)
```bash
cd ~/crm-mcp-server-work && npm run build
```
If build fails, stop and report the error. This produces `dist/mcp-server.mjs` and `dist/cli.mjs`.

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

### Step 4 — Install production dependencies (only if deps changed)
```bash
cd "$MARKETPLACE_DIR" && npm install --omit=dev
```
This is only necessary when `package.json` dependencies change between versions. For code-only changes, `git pull` alone is sufficient since the bundled `.mjs` files are committed.

### Step 5 — Smoke test
```bash
cd "$MARKETPLACE_DIR" && timeout 3 ./dist/mcp-server.mjs 2>/tmp/crm-refresh-test.log; EXIT=$?; cat /tmp/crm-refresh-test.log
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

## Build Architecture (v0.4.5+)
- **esbuild** bundles all source TypeScript into two files: `dist/mcp-server.mjs` (MCP entry) and `dist/cli.mjs` (CLI)
- All npm packages are marked external (`packages: 'external'`) — resolved from node_modules at runtime
- Native deps (`better-sqlite3`, `sqlite-vec`) and heavy deps (`@huggingface/transformers`) stay in node_modules
- Pure JS deps (`@modelcontextprotocol/sdk`, `yaml`, `zod`, `fast-glob`) also stay in node_modules but could be inlined in a future iteration
- **No TypeScript compiler needed at runtime** — only esbuild during development
