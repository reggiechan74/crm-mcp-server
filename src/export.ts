import type { SearchResult } from './types.js';

export function formatExport(
  contacts: SearchResult[],
  format: 'json' | 'csv' | 'markdown'
): string {
  if (format === 'json') {
    return JSON.stringify(contacts, null, 2);
  }

  if (format === 'csv') {
    const headers = ['id', 'name', 'category', 'organization', 'status', 'lastContact'];
    const rows = contacts.map(c =>
      [c.id, c.name, c.category, c.organization || '', c.status, c.lastContact || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  if (format === 'markdown') {
    const header = '| ID | Name | Category | Organization | Status | Last Contact |';
    const sep = '|-----|------|----------|-------------|--------|-------------|';
    const rows = contacts.map(c =>
      `| ${c.id} | ${c.name} | ${c.category} | ${c.organization || '-'} | ${c.status} | ${c.lastContact || '-'} |`
    );
    return [header, sep, ...rows].join('\n');
  }

  throw new Error(`Unknown format: ${format}`);
}
