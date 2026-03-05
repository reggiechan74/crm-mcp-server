import { describe, it, expect } from 'vitest';
import { formatExport } from '../src/export.js';

const CONTACTS = [
  { id: 'NE-TEST-001', name: 'Test Contact', category: 'Network' as const, organization: 'Test Corp', status: 'Active', lastContact: '2026-01-01' },
  { id: 'CL-TEST-002', name: 'Client One', category: 'Client' as const, organization: 'Acme', status: 'Active', lastContact: '2026-02-15' },
];

describe('formatExport', () => {
  it('exports as JSON', () => {
    const result = formatExport(CONTACTS, 'json');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Test Contact');
  });

  it('exports as CSV with headers', () => {
    const result = formatExport(CONTACTS, 'csv');
    const lines = result.split('\n');
    expect(lines[0]).toBe('id,name,category,organization,status,lastContact');
    expect(lines[1]).toContain('Test Contact');
  });

  it('handles CSV escaping for values with commas', () => {
    const contacts = [{ id: 'NE-TEST-001', name: 'Last, First', category: 'Network' as const, organization: null, status: 'Active', lastContact: null }];
    const result = formatExport(contacts, 'csv');
    expect(result).toContain('"Last, First"');
  });

  it('exports as markdown table', () => {
    const result = formatExport(CONTACTS, 'markdown');
    expect(result).toContain('| NE-TEST-001 |');
    expect(result).toContain('| ID | Name |');
  });

  it('handles null organization and lastContact', () => {
    const contacts = [{ id: 'NE-TEST-001', name: 'Test', category: 'Network' as const, organization: null, status: 'Active', lastContact: null }];
    const mdResult = formatExport(contacts, 'markdown');
    expect(mdResult).toContain('| - |');
    const csvResult = formatExport(contacts, 'csv');
    expect(csvResult).toContain('""');
  });
});
