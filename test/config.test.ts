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

  it('defaults embedding model to EmbeddingGemma', () => {
    const config = loadConfig();
    expect(config.embeddingModel).toBe('onnx-community/embeddinggemma-300m-ONNX');
  });

  it('allows empty crmRoot without crashing when no config file', () => {
    const origHome = process.env.HOME;
    // Point HOME to a dir without .crm-mcp.json
    process.env.HOME = '/tmp/no-config-home';
    delete process.env.CRM_ROOT;
    const config = loadConfig();
    expect(config.crmRoot).toBe('');
    process.env.HOME = origHome;
  });

  it('returns templates from config file or defaults', () => {
    const config = loadConfig();
    // templates comes from ~/.crm-mcp.json if present, otherwise []
    expect(Array.isArray(config.templates)).toBe(true);
    // defaultTemplate is always a string
    expect(typeof config.defaultTemplate).toBe('string');
  });
});
