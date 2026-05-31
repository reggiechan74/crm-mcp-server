# CRM MCP Server

[![Version](https://img.shields.io/badge/Version-0.6.1-FF6B35)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-16-8B5CF6)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/Tests-145-2EA043)](test/)
[![Skills](https://img.shields.io/badge/Skills-23-E879F9)](skills/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-F97316?logo=anthropic&logoColor=white)](https://claude.ai/code)

A personal CRM system built as an [MCP](https://modelcontextprotocol.io/) server for [Claude Code](https://claude.ai/code). Manage contacts, dossiers, and relationship intelligence through natural conversation — no GUI needed.

## Table of Contents

- [What It Does](#what-it-does)
- [Quick Start](#quick-start)
- [Tools](#tools)
- [Skills](#skills)
- [Dossier Structure](#dossier-structure)
- [Templates](#templates)
- [Configuration](#configuration)
- [CLI Commands](#cli-commands)
- [Audit & Repair](#audit--repair)
- [Tech Stack](#tech-stack)
- [Development](#development)
- [License](#license)

## What It Does

Store contact intelligence in markdown dossiers, then search, read, and update them through Claude Code with token-optimized progressive disclosure:

```
You: "What do I know about John Doe?"
Claude: [uses crm_search → crm_outline → crm_read to fetch relevant sections]
```

Instead of loading entire dossier files (thousands of tokens), the server strips boilerplate, caches cleaned content in SQLite with FTS5, and serves only what's requested. Every response includes a token estimate footer (`<!-- 599 chars | ~150 tokens -->`) so you can see exactly how much context each call consumes.

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

This repository is private. Access methods depend on your situation:

#### For yourself: Deploy key (recommended for CI/Codespaces)

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

#### For yourself: Personal SSH key

If your default `~/.ssh/id_ed25519` (or `id_rsa`) is added to a GitHub account with access to this repo, no extra configuration is needed — `git clone git@github.com:reggiechan74/crm-mcp-server.git` will just work.

#### For collaborators

GitHub private repos have two access tiers:

| Access Level | Method | What They Can Do |
|-------------|--------|-----------------|
| **Read + Write** | Add as [collaborator](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-roles/managing-an-individuals-access-to-a-repository) (Settings → Collaborators) | Clone, pull, push, install plugin |
| **Read-only** | Fine-grained Personal Access Token (PAT) | Clone, pull, install plugin — no push |

**Read + Write** — Adding a collaborator grants full read/write. They accept the invite, then clone via SSH as normal. Simple, but there's no way to restrict a collaborator to read-only on a personal repo (this is a GitHub limitation — only Organization repos support granular role-based permissions).

**Read-only** — For read-only access without granting write, create a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) scoped to this repo:

```
1. Go to: GitHub → Settings → Developer settings → Fine-grained personal access tokens
2. Create a new token:
   - Token name: crm-mcp-server-readonly (or descriptive name)
   - Repository access: "Only select repositories" → reggiechan74/crm-mcp-server
   - Permissions → Repository permissions → Contents: Read-only
   - Generate token and share securely with collaborator
3. Collaborator clones via HTTPS with the token:
```

```bash
# Clone using PAT (collaborator runs this):
git clone https://<TOKEN>@github.com/reggiechan74/crm-mcp-server.git

# For plugin install, collaborator sets git URL rewrite to use HTTPS + token:
git config --global url."https://<TOKEN>@github.com/reggiechan74/crm-mcp-server".insteadOf "git@github.com:reggiechan74/crm-mcp-server"
```

The collaborator can then run `/plugin marketplace add reggiechan74/crm-mcp-server` and `/plugin install crm@crm-mcp-server` normally — the git URL rewrite transparently injects the token.

> **Note:** Fine-grained PATs have an expiration date (max 1 year). Set a calendar reminder to rotate before expiry. You can also revoke at any time from Settings → Developer settings → Personal access tokens.

#### Verifying access

```bash
# Test SSH access (should show your username):
ssh -T git@github.com

# Or test via the deploy key alias:
ssh -T git@github-crm-mcp-server

# Test git access (should return a commit SHA):
git ls-remote git@github.com:reggiechan74/crm-mcp-server.git HEAD

# Test HTTPS/PAT access (for collaborators):
git ls-remote https://<TOKEN>@github.com/reggiechan74/crm-mcp-server.git HEAD
```

## Tools

The server exposes 16 MCP tools:

### Core Workflow (Progressive Disclosure)

| Tool | Purpose | Tokens |
|------|---------|--------|
| `crm_search` | Find contacts by name, org, status, category, profession | ~50-100 per result |
| `crm_outline` | Structural overview — sections, sizes, fill % | ~200-400 |
| `crm_read` | Read a specific section with boilerplate stripped | Varies (footer shows estimate) |

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

## Skills

The plugin bundles 23 skills that orchestrate MCP tools into higher-level workflows. Skills trigger automatically from natural conversation — just describe what you need.

### Preparation

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `intel-briefing` | "brief me on [name]", "prep me for meeting with [name]", "what do I know about [name]" | opus |
| `deal-parties` | "who's involved in [deal]", "map this transaction", "who's missing from this deal" | opus |
| `event-prep` | "prep me for [event]", "who do I know there", "networking game plan" | opus |

### Maintenance

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `post-meeting` | "just met with [name]", "debrief [name]", "log meeting with [name]" | opus |
| `relationship-pulse` | "who should I call", "who am I neglecting", "who's gone cold" | opus |
| `crm-health` | "audit my CRM", "CRM health check", "dossier quality" | haiku |

### Research

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `enrich-contact` | "enrich [name]", "fill out [name]'s dossier", "what's missing for [name]" | opus |
| `find-path` | "who can introduce me to [name]", "warm intro options", "connection path to [org]" | opus |
| `competitive-intel` | "what do I know about [org]", "competitive intel", "who do I know at [org]" | sonnet |
| `analyze-subject` | "analyze [name]", "OSINT on [name]", "deep research on [name]", "intelligence report for [name]" | opus |

### Reporting

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `pipeline-review` | "pipeline review", "what deals are active", "what's in play" | sonnet |
| `relationship-roi` | "relationship ROI", "most valuable contacts", "where should I spend time" | sonnet |
| `annual-review` | "annual review", "year-end CRM review", "how did my network perform this year" | sonnet |

### Personal & Family

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `medical-briefing` | "[name] has a doctor appointment", "prep me for [name]'s appointment" | opus |
| `family-intel` | "how's [family member] doing", "family update on [name]" | opus |
| `family-health-dashboard` | "family health check", "any medical follow-ups", "health dashboard" | sonnet |
| `birthday-and-dates` | "any birthdays coming up", "key dates", "important dates" | haiku |
| `education-tracker` | "how's Izzy doing at school", "education update", "school progress" | opus |
| `gift-intel` | "what should I get [name]", "gift ideas for [name]", "gift history" | haiku |
| `life-event-support` | "[name] got promoted", "[name]'s [relative] passed away", "how should I respond" | opus |

### Developer

| Skill | Trigger Examples | Model |
|-------|-----------------|:-----:|
| `setup` | "update crm", "crm setup", "install crm deps", "fresh codespace setup", "crm not connecting", "fix crm mcp" — the one command to run after a plugin update | haiku |
| `refresh-crm` | "refresh crm", "rebuild crm", "update crm plugin" — alias for `setup` | haiku |
| `version-bump` | "version bump", "bump version", "release crm", "new crm version" | haiku |

### Shared Conventions

All skills follow conventions defined in `skills/_shared/conventions.md`: consistent output format (summary → tables → recommended next actions), token-aware progressive disclosure (index-level scans before deep reads), and standard contact resolution (search → disambiguate → read).

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
│       ├── medical/             # Family-specific (split by volatility)
│       │   ├── medical.md                  # Health summary & history (~400 tokens)
│       │   ├── medical-genetics.md         # Ancestry, variants (static)
│       │   ├── medical-pharmacogenomics.md # Drug metabolism (static)
│       │   └── medical-labs.md             # Lab results (periodic)
│       ├── education.md         # Family-specific
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
| `FAMILY` | Family members | INDEX.md, profile.md, medical/ (4 files), education.md, intelligence/ (3 files), log.md |
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
| `embeddingModel` | `onnx-community/embeddinggemma-300m-ONNX` | Local embedding model for `crm_vector_search` (override via `CRM_EMBEDDING_MODEL` env) |
| `templateRepo` | `reggiechan74/crm-mcp-server` | GitHub repo for remote templates (forks can override) |
| `githubToken` | — | Optional GitHub token for private repos or higher rate limits |

## CLI Commands

```bash
crm-mcp mcp                    # Start MCP server (used by Claude Code)
crm-mcp init                   # Interactive setup wizard
crm-mcp reindex                # Rebuild SQLite index from dossier files
crm-mcp embed                  # Generate vector embeddings for semantic search
crm-mcp benchmark-embed        # Benchmark embedding speed and estimate full embed time
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
- **Node.js** ≥ 18
- **SQLite** via better-sqlite3 (FTS5 for search, content cache)
- **MCP SDK** (@modelcontextprotocol/sdk)
- **Transformers.js** v3 + **EmbeddingGemma 300M** (q8) for local 768-dim vector embeddings
- **Vitest** for testing (145 tests)

## Development

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev -- mcp    # Run server in dev mode
```

## License

MIT
