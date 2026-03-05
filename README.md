# CRM MCP Server

A personal CRM system built as an [MCP](https://modelcontextprotocol.io/) server for [Claude Code](https://claude.ai/code). Manage contacts, dossiers, and relationship intelligence through natural conversation — no GUI needed.

## What It Does

Store contact intelligence in markdown dossiers, then search, read, and update them through Claude Code with token-optimized progressive disclosure:

```
You: "What do I know about David Gratton?"
Claude: [uses crm_search → crm_outline → crm_read to fetch relevant sections]
```

Instead of loading entire dossier files (thousands of tokens), the server strips boilerplate, caches cleaned content in SQLite with FTS5, and serves only what's requested.

## Quick Start

### Option A: Claude Code Plugin (Recommended)

Install directly from Claude Code:

```
/install-plugin https://github.com/reggiechan74/crm-mcp-server
```

This clones the repo, builds it, and registers the MCP server automatically. Then initialize your CRM:

```bash
crm-mcp init
```

The init wizard walks you through choosing a directory, selecting templates, and building your first index.

### Option B: Manual Install

```bash
# Clone and build
git clone https://github.com/reggiechan74/crm-mcp-server.git
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

## Tools

The server exposes 14 MCP tools:

### Core Workflow (Progressive Disclosure)

| Tool | Purpose | Tokens |
|------|---------|--------|
| `crm_search` | Find contacts by name, org, status, category | ~50-100 per result |
| `crm_outline` | Structural overview — sections, sizes, fill % | ~200-400 |
| `crm_read` | Read a specific section with boilerplate stripped | Varies |

### Contact Management

| Tool | Purpose |
|------|---------|
| `crm_create` | Create a new dossier from template |
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

## Dossier Structure

Each contact is a folder of markdown files:

```
CRM/
├── Network/
│   └── GRATTON_David/
│       ├── INDEX.md          # Quick reference, status, next actions
│       ├── profile.md        # Background, career, relationship history
│       ├── intelligence/
│       │   ├── intelligence-profile.md     # Personality, communication patterns
│       │   ├── intelligence-strategic.md   # MICE, network influence, moral foundations
│       │   └── intelligence-risk.md        # Key intel, risk factors, threat assessment
│       └── log.md            # Interaction log, related documents
├── Family/
│   └── CHAN_Esther/
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

## Templates

Four built-in templates handle different contact types:

| Template | Use Case | Files |
|----------|----------|-------|
| `simple` | Basic contacts | INDEX.md, profile.md, log.md |
| `professional` | Clients, network, prospects | INDEX.md, profile.md, intelligence/ (3 files), log.md |
| `family` | Family members | INDEX.md, profile.md, medical.md, education.md, intelligence/ (3 files), log.md |
| `personal` | Friends, personal contacts | INDEX.md, profile.md, intelligence/ (3 files), log.md |

Templates use `{{variable}}` substitution (name, category, date, etc.) and are fully customizable. Place custom templates in `<CRM_ROOT>/.templates/<name>/`.

## Configuration

Config is read from (in priority order):

1. `CRM_ROOT` environment variable
2. `~/.crm-mcp.json`
3. Defaults (unconfigured mode with setup instructions)

```json
{
  "crmRoot": "/path/to/your/CRM",
  "templates": ["simple", "professional", "family", "personal"],
  "defaultTemplate": "professional"
}
```

## CLI Commands

```bash
crm-mcp mcp        # Start MCP server (used by Claude Code)
crm-mcp init       # Interactive setup wizard
crm-mcp reindex    # Rebuild SQLite index from dossier files
crm-mcp embed      # Generate vector embeddings for semantic search
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
- **Vitest** for testing (102 tests)

## Development

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev -- mcp    # Run server in dev mode
```

## License

MIT
