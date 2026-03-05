import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('returns config with CRM_ROOT from env', () => {
    process.env.CRM_ROOT = '/tmp/test-crm';
    const config = loadConfig();
    expect(config.crmRoot).toBe('/tmp/test-crm');
    delete process.env.CRM_ROOT;
  });

  it('has sensible defaults for dbPath', () => {
    process.env.CRM_ROOT = '/tmp/test-crm';
    const config = loadConfig();
    expect(config.dbPath).toContain('crm.db');
    delete process.env.CRM_ROOT;
  });

  it('defaults embedding model to MiniLM', () => {
    const config = loadConfig();
    expect(config.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('allows empty crmRoot without crashing', () => {
    delete process.env.CRM_ROOT;
    const config = loadConfig();
    expect(config.crmRoot).toBe('');
  });

  it('returns templates array from config file', () => {
    const config = loadConfig();
    expect(config.templates).toEqual([]);
    expect(config.defaultTemplate).toBe('simple');
  });
});
