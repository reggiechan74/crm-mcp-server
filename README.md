# CRM MCP Server

A personal CRM system built as an [MCP](https://modelcontextprotocol.io/) server for [Claude Code](https://claude.ai/code). Manage contacts, dossiers, and relationship intelligence through natural conversation — no GUI needed.

## What It Does

Store contact intelligence in markdown dossiers, then search, read, and update them through Claude Code with token-optimized progressive disclosure:

```
You: "What do I know about John Doe?"
Claude: [uses crm_search → crm_outline → crm_read to fetch relevant sections]
```

Instead of loading entire dossier files (thousands of tokens), the server strips boilerplate, caches cleaned content in SQLite with FTS5, and serves only what's requested.

## Quick Start

### Option A: Claude Code Plugin (Recommended)

> **Note:** This repository is currently **private**. You need SSH access to `reggiechan74/crm-mcp-server` before installing. See [Private Repository Access](#private-repository-access) below.

**1. Add the marketplace:**

```
/plugin marketplace add reggiechan74/crm-mcp-server
```

**2. Install the plugin:**

```
/plugin install crm@crm-mcp-server
```

**3. Initialize your CRM:**

```bash
crm-mcp init
```

The init wizard walks you through choosing a directory, selecting templates, and building your first index.

### Option B: Manual Install

```bash
# Clone and build
git clone git@github.com:reggiechan74/crm-mcp-server.git
cd crm-mcp-server
npm install && npm run build

# Initialize your CRM
npx crm-mcp init

# Register with Claude Code — add to your project's .mcp.json:
```

```json
{
  "mcpServers": {
    "crm": {
      "command": "node",
      "args": ["/path/to/crm-mcp-server/dist/cli.js", "mcp"]
    }
  }
}
```

```bash
# Index your contacts
npx crm-mcp reindex
```

### Private Repository Access

This repository is private. Both the marketplace and plugin install use `git clone` over SSH, so you need a valid SSH key with access to `reggiechan74/crm-mcp-server`.

#### Using a deploy key (recommended for CI/Codespaces)

If your environment uses per-repo deploy keys with custom SSH host aliases, configure a git URL rewrite so the plugin installer resolves correctly:

```bash
# 1. Add a deploy key to the repo (Settings → Deploy keys) with read access

# 2. Configure SSH (~/.ssh/config) with a host alias:
Host github-crm-mcp-server
  HostName github.com
  IdentityFile ~/.ssh/id_crm_mcp_server
  IdentitiesOnly yes

# 3. Tell git to rewrite the URL for this repo:
git config --global url."git@github-crm-mcp-server:reggiechan74/crm-mcp-server".insteadOf "git@github.com:reggiechan74/crm-mcp-server"
```

After this, both `/plugin marketplace add` and `/plugin install` will use the deploy key transparently.

#### Using a personal SSH key

If your default `~/.ssh/id_ed25519` (or `id_rsa`) is added to a GitHub account with access to this repo, no extra configuration is needed — `git clone git@github.com:reggiechan74/crm-mcp-server.git` will just work.

#### Verifying access

```bash
# Test SSH access (should show your username):
ssh -T git@github.com

# Or test via the deploy key alias:
ssh -T git@github-crm-mcp-server

# Test git access (should return a commit SHA):
git ls-remote git@github.com:reggiechan74/crm-mcp-server.git HEAD
```

## Tools

The server exposes 16 MCP tools:

### Core Workflow (Progressive Disclosure)

| Tool | Purpose | Tokens |
|------|---------|--------|
| `crm_search` | Find contacts by name, org, status, category, profession | ~50-100 per result |
| `crm_outline` | Structural overview — sections, sizes, fill % | ~200-400 |
| `crm_read` | Read a specific section with boilerplate stripped | Varies |

### Contact Management

| Tool | Purpose |
|------|---------|
| `crm_create` | Create a new dossier from template (supports optional `profession` code) |
| `crm_update` | Update a YAML field in a dossier |
| `crm_log` | Append an interaction to the contact's log |
| `crm_bulk_update` | Update a field across multiple contacts |
| `crm_export` | Export contacts as JSON, CSV, or markdown |

### Intelligence

| Tool | Purpose |
|------|---------|
| `crm_connections` | Relationship graph — who they know and how |
| `crm_recent` | Most recently contacted people |
| `crm_stats` | CRM-wide statistics |
| `crm_vector_search` | Semantic search across all dossier content |
| `crm_audit` | Analyze dossier structural health (5 passes) |
| `crm_repair` | Apply fixes from audit results |

### Template Management

| Tool | Purpose |
|------|---------|
| `crm_templates_list` | List installed and available remote templates |
| `crm_templates_pull` | Download a template from GitHub to local `.templates/` |

## Dossier Structure

Each contact is a folder of markdown files. Dossier codes use 2-letter category prefixes (e.g., `NW-DOEJOH-001`) or 3-letter profession prefixes when a profession is assigned (e.g., `BSB-DOEJOH-001`):

```
CRM/
├── .templates/                            # Local template store (single source of truth)
│   ├── .manifest.json                     # Version + content hash tracking
│   ├── PROFESSIONAL/
│   ├── FAMILY/
│   └── REAL_ESTATE/                       # Pulled on-demand from GitHub
│       ├── COMMON/
│       └── A_BROKERAGE_SALES/
├── Network/
│   └── DOE_John/                           # NW-DOEJOH-001
│       ├── INDEX.md          # Quick reference, status, next actions
│       ├── profile.md        # Background, career, relationship history
│       ├── intelligence/
│       │   ├── intelligence-profile.md     # Personality, communication patterns
│       │   ├── intelligence-strategic.md   # MICE, network influence, moral foundations
│       │   └── intelligence-risk.md        # Key intel, risk factors, threat assessment
│       └── log.md            # Interaction log, related documents
├── Family/
│   └── DOE_Jane/                           # FA-DOEJAH-001
│       ├── INDEX.md
│       ├── profile.md
│       ├── medical.md        # Family-specific
│       ├── education.md      # Family-specific
│       ├── intelligence/
│       │   ├── intelligence-profile.md
│       │   ├── intelligence-relational.md
│       │   └── intelligence-health-check.md
│       └── log.md
└── ...
```

### Profession-Based Dossiers

When a contact is created with a `profession` code, the dossier uses a 3-letter profession prefix instead of the 2-letter category prefix, and gains a profession-specific tracking file:

```
CRM/
└── Network/
    └── BRATT_Ross/                          # BSB-BRARO-001
        ├── INDEX.md
        ├── profile.md
        ├── intelligence/
        │   ├── intelligence-profile.md
        │   ├── intelligence-strategic.md
        │   └── intelligence-risk.md
        ├── deals.md           # Profession-specific tracking file
        └── log.md
```

The tracking file varies by profession — brokers get `deals.md`, appraisers get `assignments.md`, lawyers get `matters.md`, etc.

## Templates

### Bundled Templates

Four core templates ship with the package and are installed during `crm-mcp init`:

| Template | Use Case | Files |
|----------|----------|-------|
| `simple` | Basic contacts | INDEX.md, profile.md, log.md |
| `PROFESSIONAL` | Clients, network, prospects | INDEX.md, profile.md, intelligence/ (3 files), log.md |
| `FAMILY` | Family members | INDEX.md, profile.md, medical.md, education.md, intelligence/ (3 files), log.md |
| `PERSONAL` | Friends, personal contacts | INDEX.md, profile.md, intelligence/ (3 files), log.md |

### Extended Templates (On-Demand)

Extended templates are hosted on GitHub and pulled on-demand — they are **not** included in the npm package. This keeps the install lightweight while providing access to specialized template packs.

#### Managing Templates

```bash
# List installed and available templates
crm-mcp templates list

# Pull a template from GitHub
crm-mcp templates pull REAL_ESTATE

# Pull a single category from a composite template
crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES

# Check for upstream updates (auto-updates untouched templates, skips customized ones)
crm-mcp templates update

# View template details
crm-mcp templates info REAL_ESTATE
```

Claude can also manage templates directly through the MCP tools `crm_templates_list` and `crm_templates_pull`. If you try to create a contact with a template that isn't installed, Claude will offer to pull it for you.

#### Smart Versioning

Templates you install are copied to `<CRM_ROOT>/.templates/`, which serves as both the local template store and your customization layer. A `.manifest.json` file tracks versions and content hashes for each installed template.

**How updates work:**

| Upstream newer? | You customized it? | What happens |
|:-:|:-:|:--|
| No | — | Skipped (up to date) |
| Yes | No | Auto-updated |
| Yes | Yes | Skipped with warning (use `--force` via CLI to override) |

The `--force` flag is only available via CLI, never through the MCP tool — this ensures Claude cannot accidentally overwrite your customizations.

#### Custom Templates

You can customize any installed template by editing files in `.templates/`. Your changes are preserved across updates (the system detects customization via content hashing). You can also create entirely new templates by adding a directory with a `template.json` manifest.

### RE-CRM Template Pack (Real Estate)

A profession-specific template pack for real estate professionals, available as an extended template:

- **167 profession types** across 18 categories (Brokerage & Sales, Appraisal, Legal, Development, etc.)
- **3-letter profession codes** (e.g., `BSB` = Sales Broker, `APR` = Residential Appraiser, `LRE` = Real Estate Lawyer)
- **15 unique tracking file types** with rich section templates: deals, assignments, projects, portfolio, matters, assessments, jurisdictions, policies, campaigns, entities, holdings, programs, assets, services, engagements
- **COMMON base templates** shared across all professions: INDEX.md (with deal velocity metrics), profile.md (6 major sections), intelligence/ (3-file split: profile, risk, strategic), log.md (with summary statistics)

```bash
# Install the full pack (all 18 categories, ~1,200 files)
crm-mcp templates pull REAL_ESTATE

# Or install just what you need
crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES
crm-mcp templates pull REAL_ESTATE/E_FINANCE_CAPITAL_MARKETS
```

When pulling individual categories, `COMMON/` (shared base files) and `template.json` (profession code mapping) are always included automatically.

**Usage:** Create a profession-based dossier:
```
crm_create({ name: "Ross Bratt", category: "Network", profession: "BSB" })
→ Creates BSB-BRARO-001 with deals.md tracking file
```

**Regenerate templates** (after editing COMMON or the generator script):
```bash
npx tsx scripts/generate-real-estate-templates.ts --force
```

## Configuration

Config is read from (in priority order):

1. Environment variables (`CRM_ROOT`, `CRM_TEMPLATE_REPO`, `CRM_GITHUB_TOKEN`)
2. `~/.crm-mcp.json`
3. Defaults (unconfigured mode with setup instructions)

```json
{
  "crmRoot": "/path/to/your/CRM",
  "templates": ["simple", "PROFESSIONAL", "FAMILY", "PERSONAL"],
  "defaultTemplate": "PROFESSIONAL",
  "templateRepo": "reggiechan74/crm-mcp-server",
  "githubToken": ""
}
```

| Field | Default | Purpose |
|-------|---------|---------|
| `crmRoot` | — | Path to your CRM contact directory |
| `templates` | `[]` | Templates selected during init |
| `defaultTemplate` | `simple` | Template used when none specified |
| `templateRepo` | `reggiechan74/crm-mcp-server` | GitHub repo for remote templates (forks can override) |
| `githubToken` | — | Optional GitHub token for private repos or higher rate limits |

## CLI Commands

```bash
crm-mcp mcp                    # Start MCP server (used by Claude Code)
crm-mcp init                   # Interactive setup wizard
crm-mcp reindex                # Rebuild SQLite index from dossier files
crm-mcp embed                  # Generate vector embeddings for semantic search
crm-mcp templates list         # List local and remote templates
crm-mcp templates pull <name>  # Download template from GitHub
crm-mcp templates update       # Smart-update installed templates
crm-mcp templates info <name>  # Show template details
```

## Audit & Repair

The audit engine runs 5 passes against your dossier templates:

| Pass | Detects |
|------|---------|
| **Compliance** | Missing sections that the template defines |
| **Misplaced** | Content in the wrong tier file |
| **Stale** | Outdated fields contradicted by newer log entries |
| **Duplicates** | Same content repeated across files (>60% overlap) |
| **Ordering** | Sections out of template-defined order |

The repair engine applies fixes in dependency order: moves → dedup → ordering → missing → stale, with content integrity validation.

## Tech Stack

- **TypeScript** (ESM, strict mode)
- **Node.js** ≥ 22
- **SQLite** via better-sqlite3 (FTS5 for search, content cache)
- **MCP SDK** (@modelcontextprotocol/sdk)
- **Transformers.js** for local vector embeddings (optional)
- **Vitest** for testing (140 tests)

## Development

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev -- mcp    # Run server in dev mode
```

## License

MIT
