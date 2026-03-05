# Changelog

All notable changes to crm-mcp-server are documented here.

## [0.1.0] - 2026-03-05

First public release. Transforms the CRM from a single-user tool into a general-purpose Claude Code MCP server plugin.

### Added

#### Core Server
- MCP server with 14 tools: search, outline, read, connections, recent, stats, update, log, vector_search, create, bulk_update, export, audit, repair
- Progressive disclosure architecture (`crm_search` → `crm_outline` → `crm_read`) for 10x token savings
- SQLite store with FTS5 full-text search and content caching
- Dossier parser with aggressive boilerplate stripping (empty tables, placeholder text, template headers)
- Relationship graph extraction from dossier cross-references
- Contact export in JSON, CSV, and markdown formats
- Bulk update across contacts by category or status filter

#### Template System
- Four built-in templates: simple, professional, family, personal
- `template.json` metadata (description, category mapping, variables)
- `{{variable}}` Mustache-style substitution in templates
- Three-tier resolution: user `.templates/` → bundled `templates/` → category fallback
- Template-aware `crm_create` tool with automatic category-to-template mapping

#### Audit & Repair Engine
- 5-pass audit engine: compliance, misplaced content, stale data, duplicates, ordering
- Routing table built dynamically from template headings
- Repair engine with dependency-ordered fix application (moves → dedup → ordering → missing → stale)
- Content integrity validation (line count before/after with PASS/WARNING/FAIL thresholds)
- Audit result caching in SQLite for subsequent repair calls

#### Configuration & Distribution
- Config resolution: `CRM_ROOT` env → `~/.crm-mcp.json` → defaults
- Graceful unconfigured state with setup instructions (no crash on first run)
- Interactive `crm-mcp init` CLI wizard (directory selection, template choice, config generation, initial index)
- CLI commands: `mcp`, `init`, `reindex`, `embed`

#### Vector Search
- Local embeddings via Transformers.js (Xenova/all-MiniLM-L6-v2)
- sqlite-vec for vector similarity search
- Optional — server works without embeddings

#### Testing
- 102 tests across 12 test files
- Coverage: config, parser, store, writer, init, audit, repair, server, integration, export, embeddings
- End-to-end integration tests for progressive disclosure workflow and plugin features
