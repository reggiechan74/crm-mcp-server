---
name: deal-parties
description: Use when the user wants a transaction stakeholder map, like "who's involved in this deal", "deal parties for [address]", "map this transaction", "who's on this", "who are the players", "who do we have on buyer/seller side", "party map", "deal roster", "who's missing from this deal", "stakeholders on [deal]", or "deal team for [project]".
allowed-tools:
  - mcp__plugin_crm_crm__crm_search
  - mcp__plugin_crm_crm__crm_outline
  - mcp__plugin_crm_crm__crm_read
  - mcp__plugin_crm_crm__crm_update
  - mcp__plugin_crm_crm__crm_log
  - mcp__plugin_crm_crm__crm_connections
  - mcp__plugin_crm_crm__crm_vector_search
  - mcp__plugin_crm_crm__crm_stats
  - mcp__plugin_crm_crm__crm_recent
  - mcp__plugin_crm_crm__crm_audit
  - mcp__plugin_crm_crm__crm_repair
  - mcp__plugin_crm_crm__crm_export
  - mcp__plugin_crm_crm__crm_bulk_update
  - mcp__plugin_crm_crm__crm_create
  - AskUserQuestion
---

## Purpose
Map all CRM contacts connected to a specific deal or property, with roles, relationships, and gaps.

## Workflow
1. Run `crm_vector_search` for deal name, property address, or project name across all dossiers.
2. For each hit, run `crm_read` with `section="index"` to capture role, org, and relationship strength.
3. Run `crm_connections` to cross-reference relationships between parties.
4. Identify expected-but-missing roles for this deal type.
5. Include expected roles guidance for sale transactions: broker, buyer's broker, lawyers, appraiser, lender, title. For infrastructure assignments: client, subconsultant, utility company, municipality, environmental consultant. For lease transactions: landlord broker, tenant rep, landlord counsel, tenant counsel.

## Output Template
```markdown
# Deal Party Map: [Deal/Property Name]

## Parties Identified ([count] contacts)

| Role | Contact | Organization | Relationship | Strength | Last Contact |
|------|---------|-------------|-------------|:--------:|:------------:|
| Seller's Broker | [Name] | [Org] | [Category] | [1-10] | [Date] |
| Buyer's Counsel | [Name] | [Org] | [Category] | [1-10] | [Date] |
| ... | | | | | |

## Relationship Map
[which parties know each other, potential alliances, conflict risks]

## Missing Parties
[roles you'd expect on this deal type but don't have in CRM — e.g., "No appraiser identified"]

## Recommended Next Actions
1. [e.g., "Reach out to [Name] for intel on buyer's timeline"]
2. [e.g., "Create dossier for the buyer's counsel — you'll need them later"]
```

## Edge Cases
- **Zero search results:** If `crm_vector_search` returns no contacts mentioning the deal, ask the user to provide party names manually, then search for each.
- **Relationship Map format:** Present key links narratively (e.g., '[Name A] and [Name B] are at the same firm') or as a simple connection list.

## Shared Conventions
See `skills/_shared/conventions.md` for output format, contact resolution, token awareness, and error handling rules.
