---
name: version-bump
description: Bump crm-mcp-server version across all files (package.json, plugin.json, marketplace.json, CHANGELOG, README badge). Use when user says "version bump", "bump version", "release", "new version", or "bump crm".
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - AskUserQuestion
model: haiku
---

## Purpose
Bump crm-mcp-server version consistently across all 5 files that contain version references. Prevents the triple-sync bug where mismatched versions cause plugin cache corruption.

## Arguments
The user may provide:
- `<version>` — explicit semver (e.g., `0.5.0`)
- `patch` / `minor` / `major` — increment type
- Nothing — ask which increment type

## Workflow

### Step 1 — Determine current version and target
```bash
cd ~/crm-mcp-server-work && node -e "console.log(require('./package.json').version)"
```
If no version argument provided, ask the user:
> Current version is X.Y.Z. Bump to patch (X.Y.Z+1), minor (X.Y+1.0), or major (X+1.0.0)?

### Step 2 — Get changelog entry
Ask the user:
> What changed in this version? (1-3 bullet points for the CHANGELOG)

### Step 3 — Update all version files
Update these files with the new version — use Edit tool for each:

1. **`package.json`** — `"version": "X.Y.Z"`
2. **`.claude-plugin/plugin.json`** — `"version": "X.Y.Z"`
3. **`.claude-plugin/marketplace.json`** — `"version": "X.Y.Z"` inside the plugins array

Then run:
```bash
cd ~/crm-mcp-server-work && npm install --package-lock-only
```
This updates `package-lock.json` to match without reinstalling.

### Step 4 — Update README badge if needed
Check if `README.md` has a Node.js version badge. If it references an incorrect Node version, update it to match the current `engines.node` field in package.json.

### Step 5 — Update CHANGELOG
Prepend a new entry to `CHANGELOG.md` after the `# Changelog` header line:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added/Changed/Fixed
- (user's bullet points)
```

Use `TZ='America/New_York' date '+%Y-%m-%d'` for the date.

### Step 6 — Build dist
```bash
cd ~/crm-mcp-server-work && npm run build
```
If build fails, stop and report.

### Step 7 — Stage and commit
```bash
cd ~/crm-mcp-server-work && git add package.json package-lock.json .claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md README.md dist/
```
Commit with message: `bump: vX.Y.Z — <one-line summary from changelog>`

Do NOT push yet. Ask:
> Version bump committed. Push to origin and run /crm:refresh-crm to sync the plugin? [Y/N]

### Step 8 — Push and refresh (if approved)
```bash
cd ~/crm-mcp-server-work && git push
```
Then tell the user to run `/crm:refresh-crm` to sync the marketplace clone.

## Validation Checklist
Before committing, verify all 3 JSON files show the same version:
```bash
cd ~/crm-mcp-server-work && echo "package.json: $(node -e "console.log(require('./package.json').version)")" && echo "plugin.json: $(node -e "console.log(require('./.claude-plugin/plugin.json').version)")" && echo "marketplace.json: $(node -e "console.log(JSON.parse(require('fs').readFileSync('./.claude-plugin/marketplace.json','utf8')).plugins[0].version)")"
```
All three MUST match. If they don't, fix before committing.
