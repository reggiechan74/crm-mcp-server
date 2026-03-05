---
title: Template Management — Thin Bundle + On-Demand Pull
date: 2026-03-05
status: Draft
---

# Template Management: Thin Bundle + Smart Versioning (Option B)

## Problem

The `templates/` directory currently ships **all** templates with the npm package/plugin.
Today: 1,202 files, 7.3MB — and growing. REAL_ESTATE alone has 167 profession-specific
templates across 18 categories. A user who only needs PROFESSIONAL + FAMILY downloads
and stores ~1,100 files they'll never use.

## Design Principles

1. **Bundle only the core four** — `simple`, `PROFESSIONAL`, `FAMILY`, `PERSONAL`
2. **Extended templates live on GitHub** — fetched on-demand via `crm-mcp templates pull`
3. **`.templates/` is the single source of truth** — no bundled fallback at runtime
4. **Smart versioning** — auto-update untouched templates; warn on customized ones

## Key Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Source branch | `main` | Simpler than tagged releases; template versions tracked in `template.json` |
| MCP tool exposure | `list` + `pull` only | Safe read + single-install ops; `update`/`--force` are CLI-only (see MCP section) |
| REAL_ESTATE granularity | Individual categories | `pull REAL_ESTATE/A_BROKERAGE_SALES` supported; avoids forcing 1,100-file download |

---

## Architecture

```
Plugin package ships:
  templates/                        ← "bundled core" (4 templates only)
    simple/
    PROFESSIONAL/
    FAMILY/
    PERSONAL/

GitHub repo (main branch) hosts:
  templates/                        ← "master registry" (all templates)
    simple/
    PROFESSIONAL/
    FAMILY/
    PERSONAL/
    REAL_ESTATE/                    ← extended (pulled on demand)
      template.json                 ← top-level metadata + profession map
      COMMON/                       ← shared base files for all professions
      A_BROKERAGE_SALES/            ← individually pullable category
        BROKER_SALES/
        BROKER_LEASING/
        ...
      B_VALUATION_ADVISORY/
      ...
    LEGAL/                          ← future extended
    MEDICAL/                        ← future extended

User's CRM root:
  .templates/                       ← "local templates" (single source of truth)
    .manifest.json                  ← tracks installed templates, versions, content hashes
    PROFESSIONAL/
    FAMILY/
    REAL_ESTATE/                    ← pulled on demand
      COMMON/                       ← always included when any RE category is pulled
      A_BROKERAGE_SALES/            ← only if user pulled this category
```

### REAL_ESTATE Category Pull Behavior

REAL_ESTATE is a **composite template** — it has a shared `COMMON/` base and per-category
overlays. When pulling an individual category:

1. `COMMON/` is always included (required for the composition pattern in `writer.ts`)
2. `template.json` is always included (profession code → template directory mapping)
3. Only the requested category subdirectory is downloaded

```
crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES

Downloads:
  REAL_ESTATE/template.json
  REAL_ESTATE/COMMON/**
  REAL_ESTATE/A_BROKERAGE_SALES/**
```

Pulling additional categories later adds them alongside existing ones without
re-downloading COMMON (unless its hash has changed upstream).

---

## .manifest.json — The Version Tracking File

Created during `init`, updated on every `pull` or `update`. Lives at `<crmRoot>/.templates/.manifest.json`.

```json
{
  "schemaVersion": 1,
  "installedAt": "2026-03-05T14:30:00Z",
  "templates": {
    "PROFESSIONAL": {
      "version": "1.0.0",
      "installedAt": "2026-03-05T14:30:00Z",
      "updatedAt": "2026-03-05T14:30:00Z",
      "source": "bundled",
      "contentHash": "sha256:a1b2c3...",
      "customized": false
    },
    "REAL_ESTATE": {
      "version": "1.0.0",
      "installedAt": "2026-03-10T09:00:00Z",
      "updatedAt": "2026-03-10T09:00:00Z",
      "source": "github",
      "contentHash": "sha256:d4e5f6...",
      "customized": true,
      "categories": ["A_BROKERAGE_SALES", "E_FINANCE_CAPITAL_MARKETS"]
    }
  }
}
```

### Fields

| Field | Purpose |
|-------|---------|
| `version` | From `template.json` `version` field at install time |
| `contentHash` | SHA-256 of all template file contents at install time (deterministic) |
| `customized` | Computed: `currentHash !== contentHash` (checked on `update`) |
| `source` | `"bundled"` or `"github"` — where this template came from |
| `categories` | (Composite templates only) Which sub-categories are installed |

### Customization Detection

To determine if a user has customized a template:

```
hash(current .templates/PROFESSIONAL/**)  !==  manifest.contentHash
```

The hash is computed deterministically: sort all file paths alphabetically, concatenate
`relativePath + \0 + fileContent` for each, SHA-256 the result. This catches any file
edit, addition, or deletion.

---

## MCP Tools (Claude-Facing)

Two template operations are exposed as MCP tools. These enable Claude to help users
discover and install templates without breaking out of the conversation.

### `crm_templates_list`

**Read-only.** Returns installed templates (with version/customization status) and
available remote templates. Zero side effects.

```typescript
// Tool definition
{
  name: "crm_templates_list",
  description: "List installed and available CRM dossier templates",
  inputSchema: {
    type: "object",
    properties: {
      remote: {
        type: "boolean",
        description: "Include available templates from GitHub (default: true)"
      }
    }
  }
}
```

**Example response:**
```
Installed:
  PROFESSIONAL  v1.0.0  (customized)
  FAMILY        v1.0.0
  simple        v1.0.0

Available on GitHub:
  REAL_ESTATE   v1.0.0  167 professions, 18 categories
    Categories: A_BROKERAGE_SALES, B_VALUATION_ADVISORY, ...
  PERSONAL      v1.0.0
```

### `crm_templates_pull`

**Single-template install.** Downloads one template (or one category of a composite
template) from GitHub to `.templates/`. No `--force` flag — if the template exists
locally and is customized, it returns an error directing the user to CLI.

```typescript
// Tool definition
{
  name: "crm_templates_pull",
  description: "Download a template from GitHub to local .templates/",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Template name (e.g. 'REAL_ESTATE/A_BROKERAGE_SALES')"
      }
    },
    required: ["name"]
  }
}
```

**Behavior:**
- Template not installed → download and install → success
- Template installed, not customized → overwrite with upstream → success
- Template installed, customized → **error**: "Template has local customizations. Use CLI: `crm-mcp templates pull <name> --force`"

**Recovery path example:**
```
User: "Create a dossier for John Smith, he's a commercial broker"
Claude: [calls crm_create with profession: "BSB"]
        → Error: Template "REAL_ESTATE/A_BROKERAGE_SALES" not installed
Claude: "The broker template isn't installed yet. Want me to pull it?"
User: "Yes"
Claude: [calls crm_templates_pull("REAL_ESTATE/A_BROKERAGE_SALES")]
        → Success: installed COMMON + A_BROKERAGE_SALES
Claude: [calls crm_create again]
        → Success
```

### What is NOT exposed as MCP tools

| Operation | Why CLI-only |
|-----------|-------------|
| `templates update` | Touches multiple templates at once; user should see line-by-line output |
| `templates pull --force` | Overwrites customizations; should never be one approval-prompt from an AI decision |
| `templates info` | Low value as MCP tool; `list` covers the common case |

This mirrors the Gmail hook pattern: expose safe operations (`draft_email`), gate
destructive ones (`send_email`, `delete_email`).

---

## CLI Commands

### Existing (modified)

#### `crm-mcp init`

**Change:** After copying selected bundled templates to `.templates/`, write `.manifest.json`
with version and contentHash for each.

**Flow:**
1. Prompt for CRM root (unchanged)
2. Prompt for template selection from **bundled** set (unchanged)
3. Copy selected templates to `.templates/` (unchanged)
4. **NEW:** Compute contentHash for each copied template
5. **NEW:** Write `.manifest.json`
6. Create sample contact (unchanged)
7. Write `.crm-mcp.json` config (unchanged)

### New Commands

#### `crm-mcp templates list`

List available templates — both local and remote.

```
$ crm-mcp templates list

Local (.templates/):
  PROFESSIONAL  v1.0.0  (customized)
  FAMILY        v1.0.0
  simple        v1.0.0

Available on GitHub:
  REAL_ESTATE   v1.0.0  167 professions, 18 categories
    Categories: A_BROKERAGE_SALES, B_VALUATION_ADVISORY, C_DEVELOPMENT_CONSTRUCTION,
                D_PROPERTY_ASSET_MANAGEMENT, E_FINANCE_CAPITAL_MARKETS, ...
  PERSONAL      v1.0.0
```

**Implementation:**
- Local: read `.manifest.json` + check customization
- Remote: GitHub Contents API → `GET /repos/{owner}/{repo}/contents/templates`
  then fetch each `template.json` for metadata. Cache the listing for 1 hour in
  `<crmRoot>/.templates/.remote-cache.json`.

#### `crm-mcp templates pull <name> [--force]`

Download a template from GitHub to `.templates/`. Supports both top-level templates
and individual categories within composite templates.

```
# Pull a core template
$ crm-mcp templates pull PERSONAL

# Pull one REAL_ESTATE category (auto-includes COMMON)
$ crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES

# Pull all REAL_ESTATE categories
$ crm-mcp templates pull REAL_ESTATE

# Force-overwrite a customized template (CLI only)
$ crm-mcp templates pull PROFESSIONAL --force
```

**Without --force:** If template exists locally and is customized → error with message.
If template exists but is NOT customized → overwrite silently.
If template doesn't exist locally → download and install.

**Implementation:**
- Download repo tarball from `main` branch (single HTTP request)
- Stream-extract only the relevant `templates/{name}/` subtree
- For category pulls: extract `COMMON/` + `template.json` + requested category
- Write to `.templates/<name>/`
- Compute contentHash, update `.manifest.json`

#### `crm-mcp templates update [--force] [--template <name>]`

**CLI only** — not exposed as MCP tool.

Check all installed templates for upstream updates. Smart versioning logic.

```
$ crm-mcp templates update

Checking for updates...

  PROFESSIONAL  v1.0.0 → v1.1.0  (not customized) → updated
  FAMILY        v1.0.0 → v1.0.0  (up to date)
  REAL_ESTATE   v1.0.0 → v1.1.0  (CUSTOMIZED — skipped, use --force to overwrite)
  simple        v1.0.0 → v1.0.0  (up to date)

Updated 1 template. 1 skipped (customized).
```

**Decision matrix:**

| Local version | Upstream version | Customized? | Action |
|--------------|-----------------|-------------|--------|
| 1.0.0 | 1.0.0 | no | Skip (up to date) |
| 1.0.0 | 1.0.0 | yes | Skip (up to date, customized) |
| 1.0.0 | 1.1.0 | no | Auto-update |
| 1.0.0 | 1.1.0 | yes | Skip + warn (use `--force` to overwrite) |

**`--force` flag:** Updates ALL templates regardless of customization.
**`--template <name>` flag:** Update only the named template.

#### `crm-mcp templates info <name>`

Show detailed info about a template.

```
$ crm-mcp templates info REAL_ESTATE

REAL_ESTATE v1.0.0
  Description: Real Estate CRM — 167 profession types across 18 categories
  Source: github
  Installed: 2026-03-10
  Customized: no
  Files: 1,102
  Size: 6.8MB
  Installed categories: A_BROKERAGE_SALES, E_FINANCE_CAPITAL_MARKETS
  Available categories: B_VALUATION_ADVISORY, C_DEVELOPMENT_CONSTRUCTION, ...
```

---

## Changes to Existing Code

### 1. `writer.ts` — Remove bundled fallback

**Current** (lines 316-344): Three-tier fallback: `.templates/` → bundled → category default.

**New:** Single source: `.templates/` only. If not found → clear error.

```typescript
// BEFORE (3-tier fallback)
if (existsSync(userTemplatesDir)) {
  templatePath = userTemplatesDir;
} else if (existsSync(bundledTemplatesDir)) {
  templatePath = bundledTemplatesDir;
} else {
  templatePath = categoryFallbackDir;
}

// AFTER (single source)
if (existsSync(userTemplatesDir)) {
  templatePath = userTemplatesDir;
} else {
  throw new Error(
    `Template "${templateName}" not installed locally. ` +
    `Run: crm-mcp templates pull ${templateName}`
  );
}
```

The same change applies to profession template resolution (lines 322-329).

### 2. `init.ts` — Add manifest generation

After copying templates in `runInitNonInteractive()`, compute hashes and write `.manifest.json`.

### 3. `config.ts` — Add `templateRepo` config field

```typescript
// New optional field in Config
templateRepo: string;  // default: "reggiechan74/crm-mcp-server"
```

Allows users (or forks) to point at a different GitHub repo for templates.

### 4. `cli.ts` — Add `templates` subcommand

```
crm-mcp templates list
crm-mcp templates pull <name> [--force]
crm-mcp templates update [--force] [--template <name>]
crm-mcp templates info <name>
```

### 5. `server.ts` — Register MCP tools

Add `crm_templates_list` and `crm_templates_pull` tool registrations.

### 6. `template.json` — Add version to all templates

All template.json files must include a `version` field:

```json
{
  "name": "Professional",
  "version": "1.0.0",
  "description": "Intelligence-grade dossier for business contacts",
  "sections": ["INDEX", "profile", "log", ...],
  "variables": ["name", "organization", "category", "context"]
}
```

### 7. `package.json` `files` — Exclude extended templates

Only ship the core four in the npm package. Extended templates are GitHub-only.

```json
"files": [
  "dist/",
  "templates/simple/",
  "templates/PROFESSIONAL/",
  "templates/FAMILY/",
  "templates/PERSONAL/"
]
```

---

## GitHub API Strategy

All remote operations fetch from the `main` branch.

### Listing templates (for `list` and `update`)

```
GET /repos/reggiechan74/crm-mcp-server/contents/templates
Accept: application/vnd.github.v3+json
```

Returns directory listing. For each entry, fetch `template.json`:

```
GET /repos/reggiechan74/crm-mcp-server/contents/templates/{name}/template.json
```

### Downloading a template (for `pull`)

**Primary method — tarball with streaming extraction:**

```
GET /repos/reggiechan74/crm-mcp-server/tarball/main
```

Extract only `templates/{name}/` from the tarball. Single API call regardless of file count.
For category pulls within REAL_ESTATE, extract:
- `templates/REAL_ESTATE/template.json`
- `templates/REAL_ESTATE/COMMON/**`
- `templates/REAL_ESTATE/{category}/**`

**Fallback — Recursive tree API (for small templates):**

```
GET /repos/reggiechan74/crm-mcp-server/git/trees/main?recursive=1
```

Filter paths starting with `templates/{name}/`, then fetch each blob.

### Rate Limits

- Unauthenticated: 60 requests/hour (sufficient for occasional pull/update)
- Authenticated (token): 5,000 requests/hour
- Config field `githubToken` (optional) for heavy users

### Caching

Remote template listings cached at `<crmRoot>/.templates/.remote-cache.json` with 1-hour TTL.
Avoids hitting GitHub API on every `list` call.

---

## Migration Path (Existing Users)

For users who already have `.templates/` from a previous `init` (no manifest):

1. On first `templates list`, `templates update`, or `crm_create`, detect missing `.manifest.json`
2. Auto-generate manifest by reading each `.templates/*/template.json` for version
3. Compute contentHash for each installed template
4. Write `.manifest.json` with `source: "unknown"` for existing templates
5. Print: "Migrated template manifest. Run `crm-mcp templates update` to check for updates."

---

## New Source Files

| File | Responsibility |
|------|---------------|
| `src/templates.ts` | Manifest I/O, contentHash computation, customization detection, template install/copy logic |
| `src/github.ts` | GitHub API client — tarball download, contents listing, template.json fetching, caching |

---

## Implementation Order

1. **Add `version` to all `template.json` files** — prerequisite for everything
2. **New file: `src/templates.ts`** — manifest I/O, hash computation, install logic
3. **New file: `src/github.ts`** — GitHub API client (tarball download, contents listing)
4. **Modify `init.ts`** — write manifest after copying templates
5. **Modify `writer.ts`** — remove bundled fallback, require local `.templates/`
6. **Modify `config.ts`** — add `templateRepo` field
7. **Modify `cli.ts`** — add `templates` subcommand routing
8. **Modify `server.ts`** — register `crm_templates_list` and `crm_templates_pull` MCP tools
9. **Modify `package.json`** — `files` field to exclude extended templates from npm
10. **Test with fresh init** — verify manifest generation, pull, update, customization detection
