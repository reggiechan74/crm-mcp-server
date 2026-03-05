import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { Store } from './store.js';
import { appendLog, updateField, createDossier } from './writer.js';
import { vectorSearch } from './embeddings.js';
import { formatExport } from './export.js';
import { runAudit, type AuditPass } from './audit.js';
import { runRepair } from './repair.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Config } from './types.js';
import { lookupProfession, searchProfessions } from './professions.js';
import {
  listLocalTemplates, ensureManifest, isCustomized, readTemplateInfo,
  computeContentHash, writeManifest, countFiles,
} from './templates.js';
import { listRemoteTemplates, downloadTemplate } from './github.js';

/**
 * Guard: returns an error message when crmRoot is empty (unconfigured),
 * null when properly configured.  Apply at the top of every tool handler
 * EXCEPT crm_stats.
 */
function requireConfigured(config: Config): string | null {
  if (!config.crmRoot) {
    return 'CRM not initialized. Run \'npx crm-mcp init\' to set up your contact directory.';
  }
  return null;
}

/**
 * Resolve a contact identifier — accepts either a dossier code (e.g. "CL-RANMUL-002")
 * or a name fragment, returning the canonical contact ID.
 * Returns null if not found.
 */
function resolveContact(store: Store, contact: string): string | null {
  // If it looks like a dossier code (2 or 3 letter prefix), use it directly
  if (/^[A-Z]{2,3}-/.test(contact)) {
    return contact;
  }
  // Otherwise search by name
  const results = store.searchContacts({ query: contact, limit: 1 });
  return results.length > 0 ? results[0].id : null;
}

/**
 * Resolve the template directory for a contact based on their category.
 * Uses .templates/ as the single source of truth.
 */
function resolveTemplateDir(crmRoot: string, store: Store, contactId: string): string | null {
  const outline = store.getOutline(contactId);
  const category = outline.contact.category.toLowerCase();

  // Map category to template type
  let templateType = 'PROFESSIONAL';
  if (category === 'family') templateType = 'FAMILY';
  else if (category === 'personal') templateType = 'PERSONAL';

  const userTpl = join(crmRoot, '.templates', templateType);
  if (existsSync(userTpl)) return userTpl;

  // Also check lowercase (legacy)
  const userTplLower = join(crmRoot, '.templates', templateType.toLowerCase());
  if (existsSync(userTplLower)) return userTplLower;

  return null;
}

/**
 * Build dynamic instructions string from CRM state for the MCP server.
 * When store is null (unconfigured), returns setup instructions instead.
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
  lines.push(`CRM Intelligence System with ${stats.totalContacts} contacts.`);
  lines.push('');
  lines.push('Categories:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    lines.push(`  - ${cat}: ${count}`);
  }
  // Profession stats (if any contacts have professions)
  const profRows = store.db.prepare(
    'SELECT profession, COUNT(*) as count FROM contacts WHERE profession IS NOT NULL GROUP BY profession',
  ).all() as any[];
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
  lines.push('  - crm_search — find contacts by name, org, status, or keyword');
  lines.push('  - crm_outline — dossier structural overview with fill percentages');
  lines.push('  - crm_read — read specific section (boilerplate stripped)');
  lines.push('  - crm_connections — relationship graph');
  lines.push('  - crm_recent — recently contacted people');
  lines.push('  - crm_stats — CRM-wide statistics');
  lines.push('  - crm_update — update dossier field');
  lines.push('  - crm_log — append interaction log entry');
  lines.push('  - crm_audit — analyze dossier structural health');
  lines.push('  - crm_repair — apply fixes from audit results');
  return lines.join('\n');
}

export function createMcpServer(store: Store | null, config: Config): McpServer {
  const server = new McpServer(
    { name: 'crm', version: '0.3.0' },
    { instructions: buildInstructions(store, config) },
  );

  // ── 1. crm_search ────────────────────────────────────────────────────
  server.tool(
    'crm_search',
    'Search contacts by name, organization, status, category, or keyword. Returns compact results (~50-100 tokens each).',
    {
      query: z.string().optional().describe('Name, org, or keyword to search for'),
      category: z.string().optional().describe('Filter by category: Client, Network, Family, etc.'),
      status: z.string().optional().describe('Filter by status: ACTIVE, DORMANT, etc.'),
      profession: z.string().optional().describe('Filter by 3-letter profession code (e.g., BSB for Sales Broker)'),
      limit: z.number().optional().default(20).describe('Max results (default 20)'),
    },
    async ({ query, category, status, profession, limit }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const results = store!.searchContacts({ query, category, status, profession, limit });
      if (results.length === 0) return { content: [{ type: 'text' as const, text: 'No contacts found.' }] };
      const header = '| ID | Name | Org | Category | Status | Last Contact |';
      const sep = '|-----|------|-----|----------|--------|-------------|';
      const rows = results.map(r => `| ${r.id} | ${r.name} | ${r.organization || '-'} | ${r.category} | ${r.status} | ${r.lastContact || '-'} |`);
      return { content: [{ type: 'text' as const, text: [header, sep, ...rows].join('\n') }] };
    },
  );

  // ── 2. crm_outline ───────────────────────────────────────────────────
  server.tool(
    'crm_outline',
    'Get structural overview of a contact\'s dossier — shows which sections exist, their size, and fill percentage. Use before crm_read to decide which section to read.',
    {
      contact: z.string().describe('Contact name or dossier code (e.g., \'Ranjit\' or \'CL-RANMUL-002\')'),
    },
    async ({ contact }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        const outline = store!.getOutline(contactId);
        const lines = [`# ${outline.contact.name} (${outline.contact.id})`, ''];
        lines.push(`**Status:** ${outline.contact.status} | **Org:** ${outline.contact.organization || '-'} | **Last Contact:** ${outline.contact.lastContact || '-'}`);
        lines.push('');
        lines.push('| Section | Size | Filled | Last Updated |');
        lines.push('|---------|------|--------|-------------|');
        for (const s of outline.sections) {
          const sizeKb = (s.sizeBytes / 1024).toFixed(1);
          lines.push(`| ${s.file} | ${sizeKb}KB | ${s.fillPercent}% | ${s.lastUpdated || '-'} |`);
        }
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 3. crm_read ──────────────────────────────────────────────────────
  server.tool(
    'crm_read',
    'Read a specific section of a contact\'s dossier. Returns cleaned content with boilerplate stripped. Standard sections: index, profile, log, intelligence-profile, intelligence-strategic, intelligence-risk, medical, education. Profession-specific sections: deals, assignments, projects, portfolio, matters, assessments, jurisdictions, policies, campaigns, entities, holdings, programs, assets, services, engagements.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      section: z.string().describe('Section name (e.g., "profile", "deals", "assignments")'),
    },
    async ({ contact, section }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        const content = store!.getSection(contactId, section);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 4. crm_connections ────────────────────────────────────────────────
  server.tool(
    'crm_connections',
    'Get relationship graph for a contact — shows who they\'re connected to and how.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      depth: z.number().optional().default(1).describe('How many hops to traverse (default 1)'),
    },
    async ({ contact, depth }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      const connections = store!.getConnections(contactId, depth);
      if (connections.length === 0) return { content: [{ type: 'text' as const, text: 'No connections found.' }] };
      const lines = connections.map(c => `- ${c.targetName} (${c.type}) — ${c.context}`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  // ── 5. crm_recent ────────────────────────────────────────────────────
  server.tool(
    'crm_recent',
    'List most recently contacted people, sorted by last contact date.',
    {
      limit: z.number().optional().default(10).describe('Max results'),
      category: z.string().optional().describe('Filter by category'),
    },
    async ({ limit, category }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const results = store!.getRecent(limit, category);
      if (results.length === 0) return { content: [{ type: 'text' as const, text: 'No recent contacts.' }] };
      const header = '| Name | Category | Status | Last Contact |';
      const sep = '|------|----------|--------|-------------|';
      const rows = results.map(r => `| ${r.name} | ${r.category} | ${r.status} | ${r.lastContact || '-'} |`);
      return { content: [{ type: 'text' as const, text: [header, sep, ...rows].join('\n') }] };
    },
  );

  // ── 6. crm_stats ─────────────────────────────────────────────────────
  server.tool(
    'crm_stats',
    'Get CRM-wide statistics: total contacts, by category, stale contacts, average fill rate.',
    {},
    async () => {
      if (!config.crmRoot || !store) {
        const payload = JSON.stringify({ status: 'unconfigured', message: 'Run npx crm-mcp init' });
        return { content: [{ type: 'text' as const, text: payload }] };
      }
      const stats = store.getStats();
      const lines = [
        `**Total Contacts:** ${stats.totalContacts}`,
        `**Stale (>30 days):** ${stats.staleContacts}`,
        `**Avg Fill Rate:** ${stats.avgFillPercent}%`,
        '',
        '**By Category:**',
        ...Object.entries(stats.byCategory).map(([cat, count]) => `  - ${cat}: ${count}`),
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  // ── 7. crm_update ────────────────────────────────────────────────────
  server.tool(
    'crm_update',
    'Update a specific field in a contact\'s dossier. Updates YAML frontmatter and invalidates cache.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      section: z.string().describe('Section name (e.g., "index", "profile", "deals")'),
      field: z.string().describe("YAML field name to update (e.g., 'status', 'lastContactDate')"),
      value: z.string().describe('New value for the field'),
    },
    async ({ contact, section, field, value }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        updateField(store!, contactId, section, field, value);
        return { content: [{ type: 'text' as const, text: `Updated ${field} = "${value}" in ${section} for ${contactId}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 8. crm_log ───────────────────────────────────────────────────────
  server.tool(
    'crm_log',
    'Append a new interaction to a contact\'s log. Adds a row to the interaction table in log.md.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      date: z.string().describe('Interaction date (YYYY-MM-DD)'),
      type: z.string().describe('Interaction type: Meeting, Email, Call, Video, Chat, etc.'),
      summary: z.string().describe('Brief summary of the interaction'),
      outcome: z.string().optional().describe('What resulted from the interaction'),
      nextStep: z.string().optional().describe('What should happen next'),
    },
    async ({ contact, date, type, summary, outcome, nextStep }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        appendLog(store!, contactId, { date, type, summary, outcome, nextStep });
        return { content: [{ type: 'text' as const, text: `Logged ${type} interaction with ${contactId} on ${date}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 9. crm_vector_search ────────────────────────────────────────────
  server.tool(
    'crm_vector_search',
    "Semantic search across all dossier content. Finds contacts and sections matching a natural language query. Requires embeddings (run 'crm-mcp embed' first).",
    {
      query: z.string().describe('Natural language query'),
      limit: z.number().optional().default(5).describe('Max results'),
    },
    async ({ query, limit }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      try {
        const results = await vectorSearch(store!, config, query, limit);
        if (results.length === 0) {
          return { content: [{ type: 'text' as const, text: "No results. Have you run 'crm-mcp embed' to generate embeddings?" }] };
        }
        const lines = results.map(r =>
          `- **${r.contactName}** (${r.section}) [${(r.score * 100).toFixed(0)}%]: ${r.chunk.substring(0, 150)}...`
        );
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 10. crm_create ─────────────────────────────────────────────────
  server.tool(
    'crm_create',
    'Create a new contact dossier from template.',
    {
      name: z.string().describe("Full name (e.g., 'Jane Smith')"),
      category: z.string().describe('Category: Client, Network, Family, Personal, Prospect, etc.'),
      organization: z.string().optional().describe('Organization name'),
      context: z.string().optional().describe('How you met or relationship context'),
      profession: z.string().optional().describe('3-letter profession code (e.g., BSB for Sales Broker). Generates profession-based dossier code.'),
    },
    async ({ name, category, organization, context, profession }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      try {
        const result = createDossier(store!, config.crmRoot, { name, category, organization, context, profession });
        return { content: [{ type: 'text' as const, text: `Created dossier ${result.id} at ${result.path}` }] };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  // ── 11. crm_bulk_update ─────────────────────────────────────────────
  server.tool(
    'crm_bulk_update',
    'Update a field across multiple contacts matching a filter.',
    {
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by current status'),
      field: z.string().describe("YAML field to update (e.g., 'status')"),
      value: z.string().describe('New value'),
    },
    async ({ category, status, field, value }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contacts = store!.searchContacts({ category, status, limit: 1000 });
      if (contacts.length === 0) return { content: [{ type: 'text' as const, text: 'No contacts match filter.' }] };

      let updated = 0;
      let errors = 0;
      for (const c of contacts) {
        try {
          updateField(store!, c.id, 'index', field, value);
          updated++;
        } catch {
          errors++;
        }
      }
      return { content: [{ type: 'text' as const, text: `Updated ${updated} contacts.${errors > 0 ? ` ${errors} errors.` : ''}` }] };
    },
  );

  // ── 12. crm_export ──────────────────────────────────────────────────
  server.tool(
    'crm_export',
    'Export contacts as JSON, CSV, or markdown table.',
    {
      format: z.enum(['json', 'csv', 'markdown']).describe('Output format'),
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by status'),
    },
    async ({ format, category, status }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contacts = store!.searchContacts({ category, status, limit: 1000 });
      if (contacts.length === 0) return { content: [{ type: 'text' as const, text: 'No contacts match filter.' }] };
      const output = formatExport(contacts, format);
      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  // ── 13. crm_audit ─────────────────────────────────────────────────
  server.tool(
    'crm_audit',
    "Analyze a dossier's structural health against its template. Returns findings without making changes.",
    {
      contact: z.string().describe('Contact name or dossier code'),
      passes: z.array(z.enum(['misplaced', 'stale', 'duplicates', 'ordering', 'compliance']))
        .optional()
        .describe('Which analysis passes to run (default: all)'),
    },
    async ({ contact, passes }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };

      const contactPath = store!.getContactPath(contactId);
      if (!contactPath) return { content: [{ type: 'text' as const, text: `Contact path not found: ${contactId}` }] };

      const dossierDir = join(config.crmRoot, contactPath);
      const templateDir = resolveTemplateDir(config.crmRoot, store!, contactId);
      if (!templateDir) return { content: [{ type: 'text' as const, text: `Template not found for ${contactId}` }] };

      const allPasses: AuditPass[] = passes || ['misplaced', 'stale', 'duplicates', 'ordering', 'compliance'];
      const result = runAudit(dossierDir, templateDir, allPasses);

      // Cache for crm_repair
      store!.db.prepare('INSERT OR REPLACE INTO audit_cache (contact_id, audit_json, created_at) VALUES (?, ?, ?)')
        .run(contactId, JSON.stringify(result), new Date().toISOString());

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── 14. crm_repair ────────────────────────────────────────────────
  server.tool(
    'crm_repair',
    'Apply specific fixes from a prior audit. Requires crm_audit to be run first.',
    {
      contact: z.string().describe('Contact name or dossier code'),
      fixes: z.array(z.string()).describe("Fix codes from audit (e.g., ['M1', 'S1']) or ['all']"),
    },
    async ({ contact, fixes }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };
      const contactId = resolveContact(store!, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };

      // Load cached audit
      const cached = store!.db.prepare('SELECT audit_json FROM audit_cache WHERE contact_id = ?').get(contactId) as any;
      if (!cached) return { content: [{ type: 'text' as const, text: `No audit cache found for ${contactId}. Run crm_audit first.` }] };

      const audit = JSON.parse(cached.audit_json);
      const contactPath = store!.getContactPath(contactId);
      if (!contactPath) return { content: [{ type: 'text' as const, text: `Contact path not found: ${contactId}` }] };

      const dossierDir = join(config.crmRoot, contactPath);
      const templateDir = resolveTemplateDir(config.crmRoot, store!, contactId);
      if (!templateDir) return { content: [{ type: 'text' as const, text: `Template not found for ${contactId}` }] };

      const result = runRepair(dossierDir, templateDir, audit, fixes);

      // Clear audit cache after repair (stale)
      store!.db.prepare('DELETE FROM audit_cache WHERE contact_id = ?').run(contactId);

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── 15. crm_templates_list ──────────────────────────────────────────
  server.tool(
    'crm_templates_list',
    'List installed and available CRM dossier templates. Shows version, customization status, and available remote templates.',
    {
      remote: z.boolean().optional().default(true).describe('Include available templates from GitHub (default: true)'),
    },
    async ({ remote }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };

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

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  // ── 16. crm_templates_pull ─────────────────────────────────────────
  server.tool(
    'crm_templates_pull',
    'Download a template from GitHub to local .templates/. Supports individual categories for composite templates (e.g., "REAL_ESTATE/A_BROKERAGE_SALES"). Will not overwrite customized templates — direct the user to CLI with --force for that.',
    {
      name: z.string().describe('Template name (e.g., "REAL_ESTATE" or "REAL_ESTATE/A_BROKERAGE_SALES")'),
    },
    async ({ name: nameArg }) => {
      const err = requireConfigured(config);
      if (err) return { content: [{ type: 'text' as const, text: err }] };

      const parts = nameArg.split('/');
      const templateName = parts[0];
      const category = parts[1] || undefined;

      // Check if already installed and customized
      const manifest = ensureManifest(config.crmRoot);
      const existing = manifest.templates[templateName];
      if (existing) {
        const customized = isCustomized(config.crmRoot, templateName, manifest);
        if (customized) {
          return {
            content: [{
              type: 'text' as const,
              text: `Template "${templateName}" has local customizations. ` +
                `Use CLI to force update: crm-mcp templates pull ${nameArg} --force`,
            }],
          };
        }
      }

      try {
        const destDir = join(config.crmRoot, '.templates', templateName);
        await downloadTemplate(config.templateRepo, templateName, destDir, config.githubToken, category);

        // Update manifest
        const info = readTemplateInfo(destDir);
        const contentHash = computeContentHash(destDir);
        const now = new Date().toISOString();
        const existingEntry = manifest.templates[templateName];
        const existingCategories = existingEntry?.categories || [];

        manifest.templates[templateName] = {
          version: info?.version || '0.0.0',
          installedAt: existingEntry?.installedAt || now,
          updatedAt: now,
          source: 'github',
          contentHash,
          ...(category ? { categories: [...new Set([...existingCategories, category])] } : {}),
        };

        writeManifest(config.crmRoot, manifest);

        const files = countFiles(destDir);
        return {
          content: [{
            type: 'text' as const,
            text: `Installed ${templateName}${category ? '/' + category : ''}: ${files} files written to .templates/${templateName}/`,
          }],
        };
      } catch (e: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${e.message}` }] };
      }
    },
  );

  return server;
}

export async function startMcpServer(store: Store, config: Config): Promise<void> {
  const server = createMcpServer(store, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startMcpServerUnconfigured(config: Config): Promise<void> {
  const server = createMcpServer(null, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
