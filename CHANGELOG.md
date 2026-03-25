# Changelog

All notable changes to crm-mcp-server are documented here.

## [0.4.4] - 2026-03-25

### Added
- Dedicated `mcp-entry.js` entrypoint for plugin launcher compatibility
- `refresh-crm` skill for rebuilding and syncing the plugin runtime
- `version-bump` skill for atomic version updates across all files

### Fixed
- Node.js engine requirement lowered from `>=22` to `>=18` (server works fine on Node 18+)
- `plugin.json` version sync — was stuck at `0.4.1` while other files were at `0.4.3`
- README badge now reflects correct Node.js version

## [0.4.3] - 2026-03-23

### Changed
- `analyze-subject` refactored to v4.0 — 78% size reduction (1624→354 lines). Explicit INDEX.md population rules, search checklists replacing empty template tables, condensed verification protocol, removed legacy dossier support, parallel sub-agent dispatch pattern baked in.

## [0.4.2] - 2026-03-23

### Added
- `analyze-subject` skill — comprehensive OSINT intelligence gathering combining Gmail, Limitless, and web sources to build detailed profiles with behavioral analysis, manipulation detection, and risk scoring. Migrated from reggie-life-plan local skill to CRM plugin. Invocable as `/crm:analyze-subject [Name]`.

### Changed
- Internal references updated from `/create-dossier` to `crm_create` MCP tool
- `Task` tool references updated to `Agent` tool

## [0.4.1] - 2026-03-15

### Fixed
- Minor bug fixes and stability improvements

## [0.4.0] - 2026-03-05

19 plugin-bundled skills that orchestrate MCP tools into higher-level workflows, triggered by natural conversation.

### Added

#### Skills System
- 19 skills across 5 categories: Preparation (3), Maintenance (3), Research (3), Reporting (3), Personal & Family (7)
- Shared conventions file (`skills/_shared/conventions.md`) defining output format, contact resolution, token awareness, model tiers, and error handling
- Skills bundled inside plugin at `skills/` — travel with every installation, no separate setup

#### Phase 1 — Daily Use (5 skills)
- `intel-briefing` — full intelligence synthesis for a single contact before meetings (opus)
- `post-meeting` — structured debrief with multi-section write-back to CRM (opus)
- `relationship-pulse` — weekly/monthly network health check with prioritized touch list (opus)
- `medical-briefing` — pre-appointment health synthesis for family contacts with Izzy FH variant (opus)
- `deal-parties` — transaction stakeholder mapping with gap identification across deal types (opus)

#### Phase 2 — Weekly/Monthly (8 skills)
- `family-intel` — family member wellbeing briefing with health, relationships, and support (opus)
- `enrich-contact` — interview-driven dossier enrichment with natural conversation flow (opus)
- `crm-health` — CRM structural health scorecard with weighted scoring formula (haiku)
- `event-prep` — bulk networking briefing cards with 15-contact cap and token strategy (opus)
- `find-path` — introduction chain finder with 2-hop traversal budget (opus)
- `family-health-dashboard` — cross-family medical overview scanning medical.md only (sonnet)
- `birthday-and-dates` — upcoming key dates across all contacts with recently-missed detection (haiku)
- `pipeline-review` — cross-contact deal pipeline aggregation with referral balance tracking (sonnet)

#### Phase 3 — Situational (6 skills)
- `competitive-intel` — organization-focused intelligence synthesis from network data (sonnet)
- `relationship-roi` — network value analysis with over/under-invested contact identification (sonnet)
- `education-tracker` — school progress synthesis with cross-project GIST_news.md integration (opus)
- `gift-intel` — gift history and preference synthesis with budget context awareness (haiku)
- `life-event-support` — context-aware life event response guidance with cultural sensitivity (opus)
- `annual-review` — comprehensive year-end portfolio review combining all analysis patterns (sonnet)

#### Documentation
- Skills section added to README with trigger examples and model tiers per skill
- Skills badge (19) added to README badge bar
- Table of contents added to README
- Architecture design doc: `docs/plans/2026-03-05-crm-skills-design.md`
- Implementation plan: `docs/plans/2026-03-05-crm-skills-implementation.md`

### Design Decisions
- **Model tiers:** haiku (3 lightweight scans), sonnet (5 heavy aggregation), opus/default (11 nuanced synthesis)
- **Full tool set per skill:** All skills declare all 14 CRM tools for opportunistic edge-case handling; workflow sections document which tools are routinely called
- **Token strategies:** Multi-contact skills include explicit scan-then-drill budgets and contact caps
- **Edge case handling:** Non-Family guards on medical/family skills, zero-results fallbacks, first-run handling for annual-review

## [0.3.0] - 2026-03-05

Template management system, Claude Code plugin marketplace, and performance optimizations.

### Added

#### Template Management System
- Thin bundle architecture: 4 core templates ship with the package; extended templates (REAL_ESTATE, etc.) pulled on-demand from GitHub
- `.manifest.json` tracking with SHA-256 content hashes for customization detection
- Smart versioning: auto-updates untouched templates, skips customized ones with warning, `--force` CLI-only override
- `installBundledTemplates()` for initializing `.templates/` with version tracking
- `computeContentHash()` for deterministic content hashing (sorted file paths + content)
- `isCustomized()` for detecting user modifications to installed templates
- `migrateManifest()` for forward-compatible schema upgrades

#### GitHub Integration
- `listRemoteTemplates()` — fetches template directory listing + `template.json` metadata with 1-hour cache
- `downloadTemplate()` — tarball download with streaming extraction, supports category-specific extraction (e.g., `REAL_ESTATE/A_BROKERAGE_SALES`)
- Uses system `tar` via `execSync` (no npm tar dependency)

#### MCP Tools
- `crm_templates_list` — list installed and available remote templates (read-only)
- `crm_templates_pull` — download a single template from GitHub to local `.templates/` (no `--force`, safe for AI use)
- Tool count: 14 → 16

#### CLI Commands
- `crm-mcp templates list` — list local and remote templates
- `crm-mcp templates pull <name>` — download template, supports `REAL_ESTATE/A_BROKERAGE_SALES` category syntax
- `crm-mcp templates update` — smart-update all installed templates with decision matrix
- `crm-mcp templates info <name>` — show template version, hash, customization status

#### Plugin Marketplace
- `.claude-plugin/marketplace.json` with correct schema (`name`, `owner`, `plugins` array)
- Self-hosted marketplace: `reggiechan74/crm-mcp-server` registered as a Claude Code marketplace
- Pre-built `dist/` committed for zero-build plugin installation
- Private repo access documentation with SSH deploy key and git URL rewrite instructions

#### Testing
- 11 new tests for template management (content hashing, manifest I/O, bundled install, customization detection, migration, category install)
- Test count: 129 → 140

### Changed

#### Performance
- `indexOne()` method on Store for O(1) single-dossier indexing after `crm_create` (was O(N) full reindex)
- Extracted `indexDossier()` helper from `indexAll()` loop

#### Template Resolution
- `.templates/` is now the single source of truth (removed bundled fallback from writer)
- `getUserTemplatesDir(crmRoot)` replaces `getTemplatesDir()` for explicit local-first resolution
- Template not found errors now include install instructions

#### Distribution
- `package.json` `files` field restricts npm package to `dist/` + 4 core templates only
- `.gitignore` updated: `dist/` no longer ignored (required for plugin installation)

### Fixed
- Marketplace `source` field: `"."` → `"./"` (relative paths must start with `./`)
- ESM `require()` usage in `init.ts` replaced with static imports
- Redundant dynamic imports in `cli.ts` replaced with top-level imports

## [0.2.0] - 2026-03-05

RE-CRM profession taxonomy, domain-enriched templates, and category-grouped directory structure.

### Added

#### RE-CRM Profession Taxonomy
- 167 profession types across 18 categories (A–R) covering all real estate disciplines
- `ProfessionEntry` interface with code, name, category, categoryLetter, templateDir, trackingFile
- `lookupProfession()` (case-insensitive) and `searchProfessions()` (partial name/category match)
- Profession parameter in `crm_create` for profession-specific dossier generation
- Profession filter in `crm_search` for finding contacts by real estate specialty

#### Template Pack
- 167 profession-specific template directories, each with INDEX.md, profile.md, intelligence/ (3 files), log.md, and a tracking file
- 20 tracking file templates with deep domain-specific content (deals, assignments, matters, projects, portfolio, loans, acquisitions, closings, investments, assessments, jurisdictions, campaigns, entities, programs, assets, services, engagements, holdings, policies, general)
- Section XX: Business Development Opportunities added to all 20 tracking templates
- Three-segment intelligence structure: intelligence-profile.md, intelligence-risk.md, intelligence-strategic.md

#### Template Generator
- `scripts/generate-real-estate-templates.ts` — generates all 167 profession directories from COMMON base + tracking templates
- `--force` flag for bulk regeneration with category-aware cleanup
- COMMON directory with shared template files copied to each profession

### Changed

#### Template Category Grouping
- Profession directories nested under 18 lettered category folders (e.g., `A_BROKERAGE_SALES/BROKER_SALES/`)
- `templateDir` values in professions registry updated from flat paths to category-prefixed paths
- Generator cleanup logic handles nested directory structure

#### Template Enrichment
- 14 tracking templates enriched from generic to domain-specific depth matching the 6 gold-standard templates
- Industry-specific table columns, workflow stage breakdowns, and cross-professional relationship tables
- Domain vocabulary replacing generic "Type/Status/Notes" column headers throughout

#### Testing
- Test count increased from 102 to 129 (profession registry, FTS indexing, search filters)
- FTS indexing expanded to include profession-specific tracking files

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
