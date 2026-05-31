# Plugin distribution: why CRM breaks on update, and how to fix it

Investigation date: 2026-05-31. Status: root cause confirmed, fix proposed (needs scope decision).

## Symptom

After the CRM plugin updates (version bump) and Claude Code reloads, the MCP
server fails with "Failed to reconnect to plugin:crm:crm". Today the only
recovery is the manual `/crm:setup` skill, which reinstalls native modules.
The goal: install the plugin once, and have every update survive a reload with
zero manual steps.

## Root cause (confirmed)

The MCP server boots by `require()`-ing a native addon that is not present in
the directory Claude Code runs it from.

Evidence:

1. `.mcp.json` runs the bundle directly:
   `"command": "${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.mjs"`.
2. `esbuild.config.mjs` marks the heavy deps as `external`, so they are NOT in
   the bundle and are loaded at runtime from an adjacent `node_modules`:
   `external: ['better-sqlite3', 'sqlite-vec', '@huggingface/transformers']`.
3. `src/db.ts:31` does `esmRequire('better-sqlite3')` unconditionally at
   startup. This is the hard dependency that must resolve for the server to boot.
4. The runtime clone `~/.claude/plugins/marketplaces/crm-mcp-server/` has
   **`node_modules` count = 0**. The plugin updater re-creates this directory on
   every version bump and does not run `npm install`, so the native addon is gone.

Result: on reload, `require('better-sqlite3')` throws MODULE_NOT_FOUND, the
stdio server exits, Claude Code reports "failed to reconnect".

Dependency reality (from `src/`):

- `better-sqlite3` — native, **required at boot** (`db.ts`). The actual blocker.
- `sqlite-vec` — native, loaded in a try/catch and treated as non-critical
  (`db.ts:46`, `store.ts:136`). The semantic search in `embeddings.ts` actually
  does cosine similarity in plain JS over BLOBs, so sqlite-vec is not on the
  search hot path.
- `@huggingface/transformers` (pulls `onnxruntime-node`) — native, huge, and the
  thing that breaks `npm install --omit=dev` (onnxruntime binary ENOENT aborts
  the whole install). Used only by the optional semantic-embedding feature, via
  lazy `await import()` in `embeddings.ts` and the `embed` CLI command. Never
  needed to boot the server.

## How claude-mem avoids this (confirmed)

claude-mem (thedotmack) is installed the same way (marketplace cache) but never
hits the problem, for two structural reasons.

1. **Its MCP runtime needs no `node_modules` in the plugin dir.** Its `.mcp.json`
   runs `node scripts/mcp-server.cjs` — a 329 KB pre-bundled CommonJS file with a
   `#!/usr/bin/env node` shebang. The versioned cache dir
   (`cache/thedotmack/claude-mem/13.4.0/`) has **zero `node_modules`**. Anything
   heavy or native (tree-sitter grammars, the vector store) runs out-of-process
   or installs into a persistent data dir, not the wiped cache. The server boots
   from the self-contained bundle alone.

2. **Its launcher resolves the server path dynamically instead of trusting one
   env var.** Its command is `sh -c` with a resolver that checks, in order:
   `$CLAUDE_PLUGIN_ROOT`, `$PWD/plugin`, `$PWD`, every cached version dir
   (newest first via `ls -dt`), and the marketplace path, then picks the first
   one that actually contains `scripts/mcp-server.cjs`. So even if the plugin
   root moves or an env var is stale after a reload, it still finds a working
   copy. claude-mem also keeps multiple versions side by side
   (`13.2.0/ 13.3.0/ 13.4.0/`) and the resolver selects the newest valid one.

CRM violates both: it boots requiring a native addon from a `node_modules` the
updater wipes, and it hardcodes a single path.

## Fix: make the MCP server boot with zero native node_modules

The runtime that does have an answer here is the node Claude Code already uses:
**v22.22.2, which ships `node:sqlite` built in.** That lets us delete the native
SQLite dependency entirely instead of fighting the install lifecycle.

Plan (smallest change that achieves "survives every update"):

1. **Replace `better-sqlite3` with `node:sqlite`.** Add a thin adapter in
   `db.ts` (DatabaseSync: `prepare`/`get`→`.get()`, `all`, `run`, `exec`). This
   removes the boot blocker. Verify the built-in SQLite has FTS5 compiled in
   (CRM's primary search); if yes, FTS works unchanged.
2. **Drop native `sqlite-vec`.** It is already optional and the vector search is
   pure-JS cosine. Remove it from deps and from the `external` list.
3. **Make `@huggingface/transformers` a true optional feature that never blocks
   boot.** It is already lazy-imported. Remove it from runtime `dependencies`
   (move to optional/peer or document it as a dev/CLI-only install). The MCP
   server serves FTS5 search always; semantic search degrades gracefully when
   transformers is absent (the code already returns "run crm-mcp embed first").
4. After 1-3 the esbuild bundle plus `node:sqlite` is fully self-contained. No
   `node_modules` is needed next to `dist/`, so the marketplace re-clone can wipe
   freely and the server still boots. `/crm:setup` native-install step becomes
   unnecessary.
5. **Optional hardening (mirror claude-mem):** replace the hardcoded `.mcp.json`
   command with a small `sh -c` resolver so a stale `CLAUDE_PLUGIN_ROOT` can't
   break reconnect.

## Decision (made 2026-05-31): Option A — keep semantic search, optional

FTS5 is the default search in the plugin and always available. Semantic/vector
search stays as an optional, lazy feature that works only where
`@huggingface/transformers` is installed, and never blocks server boot. The code
already degrades gracefully (`server.ts:350` returns "run crm-mcp embed first").

## Verified facts (node:sqlite on the runtime node v22.22.2)

- FTS5: SUPPORTED. `CREATE VIRTUAL TABLE ... USING fts5(...)` and `MATCH` both
  work (an earlier "not supported" reading was a double-quote bug in the probe
  SQL, not a missing module).
- Transactions: `BEGIN`/`COMMIT` via `db.exec()` work. Note: `node:sqlite` has no
  better-sqlite3-style `.transaction(fn)` wrapper, so `db.ts` must replace that
  with explicit BEGIN/COMMIT (or a small helper).
- `loadExtension` exists on `DatabaseSync`, so `sqlite-vec` could be loaded later
  if ever wanted, but it is not needed (vector search is JS cosine).

## Implementation plan (ready to execute)

1. `src/db.ts`: replace `esmRequire('better-sqlite3')` with
   `require('node:sqlite').DatabaseSync`. Add a thin adapter so the rest of the
   code keeps its current call shape: `prepare().get/all/run`, `exec`, and a
   `transaction(fn)` helper built on BEGIN/COMMIT/ROLLBACK. Suppress the
   ExperimentalWarning. Keep the optional `sqlite-vec` try/catch but make it a
   no-op by default.
2. `package.json`: move `better-sqlite3` and `sqlite-vec` out of runtime
   `dependencies` (drop entirely). Move `@huggingface/transformers` to
   `optionalDependencies` (or document as a CLI-only install) so a normal plugin
   install never pulls onnxruntime.
3. `esbuild.config.mjs`: drop `better-sqlite3` and `sqlite-vec` from `external`.
   Keep `@huggingface/transformers` external (it stays a lazy optional import).
4. `src/embeddings.ts` / `src/store.ts`: confirm BLOB round-trips use
   `Uint8Array`/`Buffer` in a way `node:sqlite` accepts; adjust binding if needed.
5. Tests: add a regression test that opens the store on a fresh temp dir with NO
   `node_modules` present and asserts the MCP server boots and FTS search returns
   results. This is the test that would have caught the original bug.
6. `.mcp.json` (optional hardening): replace the single hardcoded path with an
   `sh -c` resolver like claude-mem's, so a stale `CLAUDE_PLUGIN_ROOT` cannot
   break reconnect.
7. Verify: build the bundle, run the full vitest suite, then simulate a wiped
   clone (empty `node_modules`) and confirm `node dist/mcp-server.mjs` boots and
   answers `crm_search`. Bump version across the manifest files and changelog.

Either way the server boots with no native deps in the plugin dir, which is what
makes updates survive a reload with zero manual steps.

## Notes

- `node:sqlite` emits an ExperimentalWarning on node 22 (stable in node 24). The
  warning can be suppressed; behavior is stable for this usage.
- This removes the need for the `--no-save` native reinstall documented in the
  project memory and the `/crm:setup` post-update step.
