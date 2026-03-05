import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { Store } from './store.js';
import { appendLog, updateField, createDossier } from './writer.js';
import { vectorSearch } from './embeddings.js';
import { formatExport } from './export.js';
import type { Config, DossierSection } from './types.js';

/**
 * Resolve a contact identifier — accepts either a dossier code (e.g. "CL-RANMUL-002")
 * or a name fragment, returning the canonical contact ID.
 * Returns null if not found.
 */
function resolveContact(store: Store, contact: string): string | null {
  // If it looks like a dossier code, use it directly
  if (/^[A-Z]{2}-/.test(contact)) {
    return contact;
  }
  // Otherwise search by name
  const results = store.searchContacts({ query: contact, limit: 1 });
  return results.length > 0 ? results[0].id : null;
}

/**
 * Build dynamic instructions string from CRM state for the MCP server.
 */
function buildInstructions(store: Store): string {
  const stats = store.getStats();
  const lines: string[] = [];
  lines.push(`CRM Intelligence System with ${stats.totalContacts} contacts.`);
  lines.push('');
  lines.push('Categories:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    lines.push(`  - ${cat}: ${count}`);
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
  return lines.join('\n');
}

export function createMcpServer(store: Store, config: Config): McpServer {
  const server = new McpServer(
    { name: 'crm', version: '0.1.0' },
    { instructions: buildInstructions(store) },
  );

  // ── 1. crm_search ────────────────────────────────────────────────────
  server.tool(
    'crm_search',
    'Search contacts by name, organization, status, category, or keyword. Returns compact results (~50-100 tokens each).',
    {
      query: z.string().optional().describe('Name, org, or keyword to search for'),
      category: z.string().optional().describe('Filter by category: Client, Network, Family, etc.'),
      status: z.string().optional().describe('Filter by status: ACTIVE, DORMANT, etc.'),
      limit: z.number().optional().default(20).describe('Max results (default 20)'),
    },
    async ({ query, category, status, limit }) => {
      const results = store.searchContacts({ query, category, status, limit });
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
      const contactId = resolveContact(store, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        const outline = store.getOutline(contactId);
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
    'Read a specific section of a contact\'s dossier. Returns cleaned content with boilerplate stripped. Sections: index, profile, log, intelligence-profile, intelligence-strategic, intelligence-risk, medical, education',
    {
      contact: z.string().describe('Contact name or dossier code'),
      section: z.enum(['index', 'profile', 'log', 'intelligence-profile', 'intelligence-strategic', 'intelligence-risk', 'medical', 'education']).describe('Which section to read'),
    },
    async ({ contact, section }) => {
      const contactId = resolveContact(store, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        const content = store.getSection(contactId, section as DossierSection);
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
      const contactId = resolveContact(store, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      const connections = store.getConnections(contactId, depth);
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
      const results = store.getRecent(limit, category);
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
      section: z.enum(['index', 'profile', 'log', 'intelligence-profile', 'intelligence-strategic', 'intelligence-risk', 'medical', 'education']).describe('Which section to update'),
      field: z.string().describe("YAML field name to update (e.g., 'status', 'lastContactDate')"),
      value: z.string().describe('New value for the field'),
    },
    async ({ contact, section, field, value }) => {
      const contactId = resolveContact(store, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        updateField(store, contactId, section as DossierSection, field, value);
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
      const contactId = resolveContact(store, contact);
      if (!contactId) return { content: [{ type: 'text' as const, text: `Contact not found: ${contact}` }] };
      try {
        appendLog(store, contactId, { date, type, summary, outcome, nextStep });
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
      try {
        const results = await vectorSearch(store, config, query, limit);
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
    },
    async ({ name, category, organization, context }) => {
      try {
        const result = createDossier(store, config.crmRoot, { name, category, organization, context });
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
      const contacts = store.searchContacts({ category, status, limit: 1000 });
      if (contacts.length === 0) return { content: [{ type: 'text' as const, text: 'No contacts match filter.' }] };

      let updated = 0;
      let errors = 0;
      for (const c of contacts) {
        try {
          updateField(store, c.id, 'index', field, value);
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
      const contacts = store.searchContacts({ category, status, limit: 1000 });
      if (contacts.length === 0) return { content: [{ type: 'text' as const, text: 'No contacts match filter.' }] };
      const output = formatExport(contacts, format);
      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  return server;
}

export async function startMcpServer(store: Store, config: Config): Promise<void> {
  const server = createMcpServer(store, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
