import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ShapeOutput, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStore, type Store } from './store.js';
import { appendLog, updateField, createDossier, bulkUpdateField } from './writer.js';
import { vectorSearch } from './embeddings.js';
import { formatExport } from './export.js';
import { ALL_AUDIT_PASSES, auditContact, repairContact } from './maintenance.js';
import type { Config, Relationship } from './types.js';
import { resolveSection } from './types.js';
import { lookupProfession } from './professions.js';
import {
  ORG_TYPE_CODES, ORG_GROUP_KEYS, ORG_ROLES, formatOrgTypeCatalog,
  normalizeOrgType, normalizeOrgGroup, normalizeOrgRole,
} from './orgTypes.js';
import {
  listLocalTemplates, ensureManifest, isCustomized, readTemplateInfo,
  computeContentHash, writeManifest, countFiles, parseTemplateRef,
} from './templates.js';
import { listRemoteTemplates, downloadTemplate } from './github.js';

export { resolveTemplateDirs } from './maintenance.js';

/** Package version, read at runtime (dist/*.mjs and src/*.ts both sit one level below package.json). */
function readVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** One-line summaries for the server instructions — every registered tool must have one. */
export const TOOL_SUMMARIES = {
  crm_search: 'find contacts by name, org, status, or keyword',
  crm_outline: 'dossier structural overview with fill percentages',
  crm_read: 'read specific section (boilerplate stripped)',
  crm_connections: 'relationship graph',
  crm_recent: 'recently contacted people',
  crm_stats: 'CRM-wide statistics',
  crm_update: 'update dossier field',
  crm_log: 'append interaction log entry',
  crm_vector_search: 'semantic search over dossier content (requires crm-mcp embed)',
  crm_create: 'create a person or organization dossier from template',
  crm_org_types: 'list organization types, groups, roles and the template file each adds',
  crm_bulk_update: 'update an INDEX.md field across contacts matching a filter',
  crm_export: 'export contacts as JSON, CSV, or markdown',
  crm_audit: 'analyze dossier structural health',
  crm_repair: 'apply fixes from audit results',
  crm_templates_list: 'list installed and remote templates',
  crm_templates_pull: 'download a template from GitHub',
  crm_reindex: 'rebuild FTS index after out-of-band file edits',
} as const;

type ToolName = keyof typeof TOOL_SUMMARIES;

const NOT_CONFIGURED = 'CRM not initialized. Run \'npx crm-mcp init\' to set up your contact directory.';

/** Wrap text into an MCP response, appending a token-estimate footer. */
function respond(text: string) {
  const chars = text.length;
  const tokens = Math.ceil(chars / 4);
  const footer = `\n<!-- ${chars.toLocaleString()} chars | ~${tokens.toLocaleString()} tokens -->`;
  return { content: [{ type: 'text' as const, text: text + footer }] };
}

/**
 * Resolve a contact identifier — a dossier code (e.g. "CL-RANMUL-002"), a
 * dossier folder name/path, or a name — to the canonical contact ID.
 * Returns null if not found.
 *
 * With `strict` (used by every tool that writes), only exact matches count:
 * a known code, a folder name, or a name/alias that equals the input
 * case-insensitively. An input matching several contacts throws, rather than
 * picking one; the fuzzy substring/full-text fallback is never used.
 */
export function resolveContact(store: Store, contact: string, opts: { strict?: boolean } = {}): string | null {
  // 1. Dossier code (e.g. "CL-RANMUL-002", "SAAS-CHER-001") — use it directly,
  //    but only when it actually resolves to a known contact. A folder name
  //    like "CHAN-LEE_Amy" also matches this shape (a 2-4 letter prefix
  //    followed by "-"), so we must not short-circuit on shape alone — fall
  //    through to the folder lookup and name search below when it doesn't.
  if (/^[A-Z]{2,4}-/.test(contact) && store.getContactPath(contact) != null) {
    return contact;
  }
  // 2. Dossier folder name or full folder path (e.g. "MENSAH-CHAN_Izzy") —
  //    resolve EXACTLY by path basename. This must come before the name search:
  //    a folder name is not a substring of the stored display name, so the name
  //    search would fall through to the fail-open FTS fallback and silently
  //    return the wrong contact.
  //    A full "Category/Folder" path is unambiguous; a bare folder name can
  //    exist under several categories, which strict mode refuses to guess.
  const byFolder = store.resolveAllByPath(contact);
  const pathMatch = contact.replace(/\\/g, '/').replace(/\/+$/, '');
  const exactPath = byFolder.filter((id) => {
    const p = store.getContactPath(id);
    return p != null && (pathMatch === p || pathMatch.endsWith(`/${p}`));
  });
  if (exactPath.length === 1) return exactPath[0];
  // A path with a category ("Clients/X") that matched no dossier exactly must
  // not fall back to a same-named folder elsewhere when writing.
  if (opts.strict && pathMatch.includes('/') && byFolder.length > 0) return null;
  if (byFolder.length === 1) return byFolder[0];
  if (byFolder.length > 1) {
    if (opts.strict) {
      throw new Error(`"${contact}" matches ${byFolder.length} dossier folders (${byFolder.join(', ')}). Use the dossier code.`);
    }
    return byFolder[0];
  }

  // 3. Exact name / alias.
  const exact = store.findByExactName(contact);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    if (opts.strict) {
      throw new Error(`"${contact}" matches ${exact.length} contacts (${exact.join(', ')}). Use the dossier code.`);
    }
    return exact[0];
  }
  if (opts.strict) return null;

  // 4. Reads only: substring name/alias search with full-text fallback.
  const results = store.searchContacts({ query: contact, limit: 1 });
  return results.length > 0 ? results[0].id : null;
}

/**
 * Render relationship edges as "- Source → Target (type) — context".
 * Source is shown because resolved inbound edges appear alongside outbound ones;
 * resolved targets show their display name instead of the raw linkedContacts text.
 */
export function formatConnections(store: Store, connections: Relationship[]): string {
  const names = store.getContactNames(connections.flatMap(c => [c.sourceId, c.targetId].filter(Boolean)));
  const nameOf = (id: string): string => names.get(id) ?? id;
  return connections
    .map(c => {
      const target = c.targetId ? nameOf(c.targetId) : c.targetName;
      return `- ${nameOf(c.sourceId)} → ${target} (${c.type})${c.context ? ` — ${c.context}` : ''}`;
    })
    .join('\n');
}

/**
 * Build dynamic instructions string from CRM state for the MCP server.
 * When store is null (unconfigured), returns setup instructions instead.
 * Uses only indexed data (no filesystem reads) so it never delays the
 * handshake; counts reflect the most recent index.
 */
function buildInstructions(store: Store | null, config: Config): string {
  if (!config.crmRoot || !store) {
    return [
      'CRM MCP Server is installed but not yet configured.',
      '',
      'Ask the user to run: npx crm-mcp init',
      '',
      'This will set up their contact directory, choose templates,',
      'and configure the server for first use.',
    ].join('\n');
  }

  const stats = store.getStats();
  const lines: string[] = [];
  lines.push(`CRM Intelligence System with ${stats.totalContacts} contacts (as of last index).`);
  lines.push('');
  lines.push('Categories:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    lines.push(`  - ${cat}: ${count}`);
  }
  const profRows = store.getProfessionCounts();
  if (profRows.length > 0) {
    lines.push('');
    lines.push('Professions:');
    for (const row of profRows) {
      const entry = lookupProfession(row.profession);
      const label = entry ? `${entry.name} (${row.profession})` : row.profession;
      lines.push(`  - ${label}: ${row.count}`);
    }
  }

  lines.push('');
  lines.push('Workflow: crm_search → crm_outline → crm_read (progressive disclosure, 10x token savings)');
  lines.push('');
  lines.push('Tools:');
  for (const [name, summary] of Object.entries(TOOL_SUMMARIES)) {
    lines.push(`  - ${name} — ${summary}`);
  }
  return lines.join('\n');
}

/**
 * Enum fields that accept any casing/padding: the advertised JSON schema still
 * lists the exact choices, and input like " pm " is canonicalized to "PM"
 * before validation. Unknown values pass through unchanged and fail the enum.
 */
const caseless = <T extends readonly [string, ...string[]]>(values: T, canon: (v: string) => string | null) =>
  z.preprocess((v) => (typeof v === 'string' ? canon(v) ?? v : v), z.enum(values));
const orgTypeField = () => caseless(ORG_TYPE_CODES, normalizeOrgType);
const orgGroupField = () => caseless(ORG_GROUP_KEYS, normalizeOrgGroup);
const orgRoleField = () => caseless(ORG_ROLES, normalizeOrgRole);

const READ_ONLY: ToolAnnotations = { readOnlyHint: true };
const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false };
const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };

export interface ServerOptions {
  /** Resolves when the initial index is built; tool calls wait for it. */
  ready?: Promise<void>;
}

export function createMcpServer(store: Store | null, config: Config, opts: ServerOptions = {}): McpServer {
  const ready = opts.ready ?? Promise.resolve();
  const server = new McpServer(
    { name: 'crm', version: readVersion() },
    { instructions: buildInstructions(store, config) },
  );

  /**
   * Register a tool whose handler returns text. Handles the unconfigured
   * guard and turns thrown errors into "Error: …" responses.
   */
  function tool<S extends ZodRawShapeCompat>(
    name: ToolName,
    description: string,
    inputSchema: S,
    annotations: ToolAnnotations,
    run: (store: Store, args: ShapeOutput<S>) => string | Promise<string>,
  ): void {
    server.registerTool(name, { description, inputSchema, annotations }, (async (args: ShapeOutput<S>) => {
      if (!config.crmRoot || !store) return respond(NOT_CONFIGURED);
      try {
        await ready;
        return respond(await run(store, args));
      } catch (e: any) {
        return respond(`Error: ${e.message}`);
      }
    }) as any);
  }

  /** Resolve `args.contact` (strictly for writes) or throw "Contact not found". */
  function contactId(s: Store, contact: string, strict: boolean): string {
    const id = resolveContact(s, contact, { strict });
    if (!id) {
      throw new Error(strict
        ? `Contact not found: ${contact} (writes need an exact dossier code, folder name, name or alias)`
        : `Contact not found: ${contact}`);
    }
    return id;
  }

  // ── crm_search ───────────────────────────────────────────────────────
  tool(
    'crm_search',
    'Search contacts and organizations by name, alias/nickname, organization, status, category, profession, org role, or org type. Returns compact results (~50-100 tokens each).',
    {
      query: z.string().optional().describe('Name, org, or keyword to search for'),
      category: z.string().optional().describe('Filter by category: Client, Network, Family, etc.'),
      status: z.string().optional().describe('Filter by status: ACTIVE, DORMANT, etc.'),
      profession: z.string().optional().describe('Filter by 3-letter profession code (e.g., BSB for Sales Broker)'),
      roles: z.array(orgRoleField()).optional().describe('Organization roles that must ALL be present (any case)'),
      orgType: orgTypeField().optional().describe('Organization type code, any case — matches primary or secondary type (see crm_org_types)'),
      orgGroup: orgGroupField().optional().describe('Organization type group, any case, e.g. LENDING (see crm_org_types)'),
      limit: z.number().optional().default(20).describe('Max results (default 20)'),
      paths: z.boolean().optional().default(false).describe('Include the absolute dossier folder path per result (off by default to keep results compact)'),
    },
    READ_ONLY,
    (s, { query, category, status, profession, roles, orgType, orgGroup, limit, paths }) => {
      const results = s.searchContacts({ query, category, status, profession, roles, orgType, orgGroup, limit });
      if (results.length === 0) return 'No contacts found.';
      const header = `| ID | Name | Org | Category | Status | Last Contact |${paths ? ' Path |' : ''}`;
      const sep = `|-----|------|-----|----------|--------|-------------|${paths ? '------|' : ''}`;
      const rows = results.map(r => {
        const types = r.orgType ? `${r.orgType}${r.secondaryTypes?.length ? ` (+${r.secondaryTypes.join(', ')})` : ''}` : '';
        const org = r.orgType ? `${types}${r.roles?.length ? ` [${r.roles.join(', ')}]` : ''}` : (r.organization || '-');
        const base = `| ${r.id} | ${r.name} | ${org} | ${r.category} | ${r.status} | ${r.lastContact || '-'} |`;
        return paths ? `${base} ${r.path ? join(config.crmRoot, r.path) : '-'} |` : base;
      });
      return [header, sep, ...rows].join('\n');
    },
  );

  // ── crm_outline ──────────────────────────────────────────────────────
  tool(
    'crm_outline',
    'Get structural overview of a contact\'s dossier — shows which sections exist, their size, and fill percentage. Use before crm_read to decide which section to read.',
    {
      contact: z.string().describe('Contact name or dossier code (e.g., \'Ranjit\' or \'CL-RANMUL-002\')'),
    },
    READ_ONLY,
    (s, { contact }) => {
      const outline = s.getOutline(contactId(s, contact, false));
      const dossierDir = join(config.crmRoot, outline.contact.path);
      const lines = [`# ${outline.contact.name} (${outline.contact.id})`, ''];
      lines.push(`**Status:** ${outline.contact.status} | **Org:** ${outline.contact.organization || '-'} | **Last Contact:** ${outline.contact.lastContact || '-'}`);
      // Folder path once; per-section absolute paths are just this + the
      // Section column, so we don't repeat the long prefix on every row.
      lines.push(`**Path:** ${dossierDir}`);
      lines.push('');
      lines.push('| Section | Size | Filled | Last Updated |');
      lines.push('|---------|------|--------|-------------|');
      for (const sec of outline.sections) {
        const sizeKb = (sec.sizeBytes / 1024).toFixed(1);
        lines.push(`| ${sec.file} | ${sizeKb}KB | ${sec.fillPercent}% | ${sec.lastUpdated || '-'} |`);
      }
      return lines.join('\n');
    },
  );

  // ── crm_read ─────────────────────────────────────────────────────────
  tool(
    'crm_read',
    'Read a specific section of a contact\'s dossier. Returns cleaned content with boilerplate stripped. Standard sections: index, profile, log, intelligence-profile, intelligence-strategic, intelligence-risk, medical, medical-genetics, medical-pharmacogenomics, medical-labs, education. Profession-specific sections: deals, assignments, projects, portfolio, matters, assessments, jurisdictions, policies, campaigns, entities, holdings, programs, assets, services, engagements. Organization sections: index, profile, intelligence, stakeholders, pipeline, log, plus type files (portfolio, lending, deal-flow, projects, managed-portfolio, engagements, occupancy, programs, product, membership) and role/motion files (competitive, partnership, vendor, tech-stack). Any custom file visible in crm_outline is also addressable by its relative path (e.g., "intelligence/intelligence-unsent").',
    {
      contact: z.string().describe('Contact name or dossier code'),
      section: z.string().describe('Section name (e.g., "profile", "deals", "assignments")'),
    },
    READ_ONLY,
    (s, { contact, section }) => s.getSection(contactId(s, contact, false), section),
  );

  // ── crm_connections ──────────────────────────────────────────────────
  tool(
    'crm_connections',
    'Get relationship graph for a contact — shows who they\'re connected to and how.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      depth: z.number().optional().default(1).describe('How many hops to traverse (default 1)'),
    },
    READ_ONLY,
    (s, { contact, depth }) => {
      const connections = s.getConnections(contactId(s, contact, false), depth);
      if (connections.length === 0) return 'No connections found.';
      return formatConnections(s, connections);
    },
  );

  // ── crm_recent ───────────────────────────────────────────────────────
  tool(
    'crm_recent',
    'List most recently contacted people, sorted by last contact date.',
    {
      limit: z.number().optional().default(10).describe('Max results'),
      category: z.string().optional().describe('Filter by category'),
    },
    READ_ONLY,
    (s, { limit, category }) => {
      const results = s.getRecent(limit, category);
      if (results.length === 0) return 'No recent contacts.';
      const header = '| Name | Category | Status | Last Contact |';
      const sep = '|------|----------|--------|-------------|';
      const rows = results.map(r => `| ${r.name} | ${r.category} | ${r.status} | ${r.lastContact || '-'} |`);
      return [header, sep, ...rows].join('\n');
    },
  );

  // ── crm_stats ────────────────────────────────────────────────────────
  // Registered directly: unlike every other tool it answers when unconfigured.
  server.registerTool(
    'crm_stats',
    {
      description: 'Get CRM-wide statistics: total contacts, by category, stale contacts, average fill rate.',
      annotations: READ_ONLY,
    },
    async () => {
      if (!config.crmRoot || !store) {
        return respond(JSON.stringify({ status: 'unconfigured', message: 'Run npx crm-mcp init' }));
      }
      await ready;
      const stats = store.getStats();
      return respond([
        `**Total Contacts:** ${stats.totalContacts}`,
        `**Stale (>30 days):** ${stats.staleContacts}`,
        `**Avg Fill Rate:** ${stats.avgFillPercent}%`,
        '',
        '**By Category:**',
        ...Object.entries(stats.byCategory).map(([cat, count]) => `  - ${cat}: ${count}`),
      ].join('\n'));
    },
  );

  // ── crm_update ───────────────────────────────────────────────────────
  tool(
    'crm_update',
    'Update a specific field in a contact\'s dossier. Updates YAML frontmatter and invalidates cache. The contact must be identified exactly (dossier code, folder name, or full name/alias).',
    {
      contact: z.string().describe('Dossier code (preferred), folder name, or exact name/alias'),
      section: z.string().describe('Section name (e.g., "index", "profile", "deals")'),
      field: z.string().describe("YAML field name to update (e.g., 'status', 'lastContactDate')"),
      value: z.string().describe('New value for the field'),
    },
    WRITE,
    (s, { contact, section, field, value }) => {
      const id = contactId(s, contact, true);
      updateField(s, id, section, field, value);
      const note = resolveSection(section).key === 'index' && field === 'orgType'
        ? '\nNote: the dossier code and folder are unchanged (codes are permanent). The previous type is no longer listed — add it to secondaryTypes to keep it. Run crm_audit to see sections the new type adds, then crm_repair to insert them.'
        : '';
      return `Updated ${field} = "${value}" in ${section} for ${id}${note}`;
    },
  );

  // ── crm_log ──────────────────────────────────────────────────────────
  tool(
    'crm_log',
    'Append a new interaction to a contact\'s log. Adds a row to the interaction table in log.md. The contact must be identified exactly (dossier code, folder name, or full name/alias).',
    {
      contact: z.string().describe('Dossier code (preferred), folder name, or exact name/alias'),
      date: z.string().describe('Interaction date (YYYY-MM-DD)'),
      type: z.string().describe('Interaction type: Meeting, Email, Call, Video, Chat, etc.'),
      summary: z.string().describe('Brief summary of the interaction'),
      outcome: z.string().optional().describe('What resulted from the interaction'),
      nextStep: z.string().optional().describe('What should happen next'),
    },
    WRITE,
    (s, { contact, date, type, summary, outcome, nextStep }) => {
      const id = contactId(s, contact, true);
      appendLog(s, id, { date, type, summary, outcome, nextStep });
      return `Logged ${type} interaction with ${id} on ${date}`;
    },
  );

  // ── crm_vector_search ────────────────────────────────────────────────
  tool(
    'crm_vector_search',
    "Semantic search across all dossier content. Finds contacts and sections matching a natural language query. Requires embeddings (run 'crm-mcp embed' first).",
    {
      query: z.string().describe('Natural language query'),
      limit: z.number().optional().default(5).describe('Max results'),
    },
    READ_ONLY,
    async (s, { query, limit }) => {
      const { results, staleSections } = await vectorSearch(s, config, query, limit);
      if (results.length === 0) {
        return "No results. Have you run 'crm-mcp embed' to generate embeddings?";
      }
      const lines = results.map(r =>
        `- **${r.contactName}** (${r.section}) [${(r.score * 100).toFixed(0)}%]: ${r.chunk.substring(0, 150)}...`
      );
      if (staleSections > 0) {
        lines.push('', `(${staleSections} section(s) changed since embeddings were generated — run 'crm-mcp embed' to refresh.)`);
      }
      return lines.join('\n');
    },
  );

  // ── crm_create ───────────────────────────────────────────────────────
  tool(
    'crm_create',
    'Create a new contact or organization dossier from template. For companies use category "Organization" with orgType (see crm_org_types), optionally secondaryTypes, cid, roles and techSale.',
    {
      name: z.string().describe("Full name (e.g., 'Jane Smith')"),
      category: z.string().describe('Category: Client, Network, Family, Personal, Prospect, Organization, etc.'),
      organization: z.string().optional().describe('Organization name'),
      context: z.string().optional().describe('How you met or relationship context'),
      profession: z.string().optional().describe('3-letter profession code (e.g., BSB for Sales Broker). Generates profession-based dossier code.'),
      orgType: orgTypeField().optional().describe('Organization only: primary type code, any case (see crm_org_types). Sets the dossier code prefix.'),
      secondaryTypes: z.array(orgTypeField()).optional().describe('Organization only: other lines of business, e.g. ["PM","INV"] for a brokerage that also manages and invests'),
      cid: z.string().optional().describe('Organization only: company identifier, 2-6 chars (ticker if public, e.g. "PLD")'),
      roles: z.array(orgRoleField()).optional().describe('Organization only: your relationship roles with this org (any case)'),
      techSale: z.boolean().optional().describe('Organization only: add the tech-sale layer (tech stack, SaaS pipeline). Defaults to the salesMotion setting.'),
    },
    WRITE,
    (s, { name, category, organization, context, profession, orgType, secondaryTypes, cid, roles, techSale }) => {
      if (category !== 'Organization' && techSale !== undefined) {
        throw new Error('techSale applies to Organization dossiers only');
      }
      const salesMotion = category === 'Organization'
        ? (techSale === undefined ? (config.salesMotion ?? 'general') : techSale ? 'tech' : 'general')
        : undefined;
      const result = createDossier(s, config.crmRoot, {
        name, category, organization, context, profession, orgType, secondaryTypes, cid, roles, salesMotion,
      });
      return [`Created dossier ${result.id} at ${result.path}`, ...result.warnings.map((w) => `Warning: ${w}`)].join('\n');
    },
  );

  // ── crm_org_types ────────────────────────────────────────────────────
  tool(
    'crm_org_types',
    'List organization type codes by group, the relationship roles, and which dossier file each group, role or the tech-sale motion adds. Use before crm_create for an organization.',
    {
      group: orgGroupField().optional().describe('Show one group only, any case, e.g. LENDING'),
    },
    READ_ONLY,
    (_s, { group }) => formatOrgTypeCatalog(group),
  );

  // ── crm_bulk_update ──────────────────────────────────────────────────
  tool(
    'crm_bulk_update',
    'Update an INDEX.md field across all contacts matching a filter. At least one of category or status is required.',
    {
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by current status'),
      field: z.string().describe("YAML field to update (e.g., 'status')"),
      value: z.string().describe('New value'),
    },
    DESTRUCTIVE,
    (s, { category, status, field, value }) => {
      const { updated, errors } = bulkUpdateField(s, { category, status }, field, value);
      if (updated.length === 0 && errors.length === 0) return 'No contacts match filter.';
      const lines = [`Updated ${updated.length} contacts.`];
      if (errors.length > 0) {
        lines.push(`${errors.length} errors:`);
        for (const e of errors) lines.push(`  - ${e.id}: ${e.message}`);
      }
      return lines.join('\n');
    },
  );

  // ── crm_export ───────────────────────────────────────────────────────
  tool(
    'crm_export',
    'Export contacts as JSON, CSV, or markdown table.',
    {
      format: z.enum(['json', 'csv', 'markdown']).describe('Output format'),
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by status'),
    },
    READ_ONLY,
    (s, { format, category, status }) => {
      const contacts = s.searchContacts({ category, status, limit: 100_000 });
      if (contacts.length === 0) return 'No contacts match filter.';
      return formatExport(contacts, format);
    },
  );

  // ── crm_audit ────────────────────────────────────────────────────────
  tool(
    'crm_audit',
    "Analyze a dossier's structural health against its template. Returns findings without making changes.",
    {
      contact: z.string().describe('Contact name or dossier code'),
      passes: z.array(z.enum(['misplaced', 'stale', 'duplicates', 'ordering', 'compliance']))
        .optional()
        .describe('Which analysis passes to run (default: all)'),
    },
    READ_ONLY,
    (s, { contact, passes }) => {
      const result = auditContact(s, config.crmRoot, contactId(s, contact, false), passes ?? ALL_AUDIT_PASSES);
      return JSON.stringify(result, null, 2);
    },
  );

  // ── crm_repair ───────────────────────────────────────────────────────
  tool(
    'crm_repair',
    'Apply specific fixes from a prior audit. Requires crm_audit to be run first, and refuses if the dossier changed since. Rolls back all changes if the repair would lose more than 15% of lines. The contact must be identified exactly.',
    {
      contact: z.string().describe('Dossier code (preferred), folder name, or exact name/alias'),
      fixes: z.array(z.string()).describe("Fix codes from audit (e.g., ['M1', 'S1']) or ['all']"),
    },
    DESTRUCTIVE,
    (s, { contact, fixes }) => {
      const result = repairContact(s, config.crmRoot, contactId(s, contact, true), fixes);
      return JSON.stringify(result, null, 2);
    },
  );

  // ── crm_templates_list ───────────────────────────────────────────────
  tool(
    'crm_templates_list',
    'List installed and available CRM dossier templates. Shows version, customization status, and available remote templates.',
    {
      remote: z.boolean().optional().default(true).describe('Include available templates from GitHub (default: true)'),
    },
    { readOnlyHint: true, openWorldHint: true },
    async (_s, { remote }) => {
      const lines: string[] = [];
      const local = listLocalTemplates(config.crmRoot);

      if (local.length > 0) {
        lines.push('**Installed:**');
        for (const t of local) {
          const status = t.customized ? ' (customized)' : '';
          const cats = t.categories ? ` [${t.categories.join(', ')}]` : '';
          lines.push(`  ${t.name}  v${t.version}${status}${cats}`);
        }
      } else {
        lines.push('No templates installed locally.');
      }

      if (remote) {
        try {
          const remoteTemplates = await listRemoteTemplates(config.templateRepo, config.crmRoot, config.githubToken);
          const localNames = new Set(local.map(t => t.name));
          const available = remoteTemplates.filter(r => !localNames.has(r.name));
          if (available.length > 0) {
            lines.push('');
            lines.push('**Available on GitHub:**');
            for (const r of available) {
              const cats = r.categories ? `  (${r.categories.length} categories)` : '';
              lines.push(`  ${r.name}  v${r.version}  ${r.description}${cats}`);
              if (r.categories) {
                lines.push(`    Categories: ${r.categories.join(', ')}`);
              }
            }
          }
        } catch (e: any) {
          lines.push('');
          lines.push(`(Could not fetch remote templates: ${e.message})`);
        }
      }

      return lines.join('\n');
    },
  );

  // ── crm_templates_pull ───────────────────────────────────────────────
  tool(
    'crm_templates_pull',
    'Download a template from GitHub to local .templates/. Supports individual categories for composite templates (e.g., "REAL_ESTATE/A_BROKERAGE_SALES"). Will not overwrite customized templates — direct the user to CLI with --force for that.',
    {
      name: z.string().describe('Template name (e.g., "REAL_ESTATE" or "REAL_ESTATE/A_BROKERAGE_SALES")'),
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async (_s, { name: nameArg }) => {
      const { templateName, category } = parseTemplateRef(nameArg);

      const manifest = ensureManifest(config.crmRoot);
      if (manifest.templates[templateName] && isCustomized(config.crmRoot, templateName, manifest)) {
        return `Template "${templateName}" has local customizations. ` +
          `Use CLI to force update: crm-mcp templates pull ${nameArg} --force`;
      }

      const destDir = join(config.crmRoot, '.templates', templateName);
      await downloadTemplate(config.templateRepo, templateName, destDir, config.githubToken, category);

      const info = readTemplateInfo(destDir);
      const now = new Date().toISOString();
      const existingEntry = manifest.templates[templateName];
      manifest.templates[templateName] = {
        version: info?.version || '0.0.0',
        installedAt: existingEntry?.installedAt || now,
        updatedAt: now,
        source: 'github',
        contentHash: computeContentHash(destDir),
        ...(category ? { categories: [...new Set([...(existingEntry?.categories || []), category])] } : {}),
      };
      writeManifest(config.crmRoot, manifest);

      return `Installed ${templateName}${category ? '/' + category : ''}: ${countFiles(destDir)} files written to .templates/${templateName}/`;
    },
  );

  // ── crm_reindex ──────────────────────────────────────────────────────
  tool(
    'crm_reindex',
    'Rebuild the full-text search index from disk. Use after editing a dossier file directly (out-of-band, e.g. via the Edit tool) so crm_search keyword results reflect the change without restarting the server. crm_read is always disk-fresh and does not need this. Omit "contact" to reindex the whole CRM.',
    {
      contact: z.string().optional().describe('Contact name or dossier code to reindex. Omit to reindex all contacts.'),
    },
    WRITE,
    (s, { contact }) => {
      if (contact) {
        const id = contactId(s, contact, false);
        const contactPath = s.getContactPath(id);
        if (!contactPath) throw new Error(`Contact path not found: ${id}`);
        s.indexOne(contactPath);
        return `Reindexed ${id} from disk.`;
      }
      s.indexAll();
      return 'Reindexed all contacts from disk.';
    },
  );

  return server;
}

export async function startMcpServer(store: Store, config: Config, opts: ServerOptions = {}): Promise<void> {
  const server = createMcpServer(store, config, opts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startMcpServerUnconfigured(config: Config): Promise<void> {
  const server = createMcpServer(null, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Start the stdio MCP server for a loaded config — the single entry used by
 * both the plugin binary and `crm-mcp mcp`.
 *
 * The transport connects first so the handshake completes immediately;
 * indexAll() is synchronous and can block the event loop for seconds, so it
 * is deferred to the next tick. Tool calls wait on `ready` so none can run
 * against the pre-index database, even if sent in the same burst as the
 * handshake.
 */
export async function runMcpServer(config: Config): Promise<void> {
  if (!config.crmRoot) {
    await startMcpServerUnconfigured(config);
    return;
  }
  const store = createStore(config.dbPath, config.crmRoot);
  let markReady!: () => void;
  const ready = new Promise<void>((r) => { markReady = r; });
  await startMcpServer(store, config, { ready });
  setImmediate(() => {
    try {
      store.indexAll();
    } catch (err) {
      // Serve whatever the last successful index left in the database
      console.error('Initial index failed:', err);
    } finally {
      markReady();
    }
  });
}
