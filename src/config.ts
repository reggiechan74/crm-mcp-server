import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Config } from './types.js';

export function loadConfig(): Config {
  const home = homedir();
  let fileConfig: Partial<Config> = {};

  const configPath = join(home, '.crm-mcp.json');
  if (existsSync(configPath)) {
    fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  const crmRoot = process.env.CRM_ROOT || fileConfig.crmRoot || '';
  const dbPath = process.env.CRM_DB_PATH || fileConfig.dbPath || join(home, '.crm-mcp', 'crm.db');
  const embeddingModel = process.env.CRM_EMBEDDING_MODEL || fileConfig.embeddingModel || 'google/embeddinggemma-300m';

  return { crmRoot, dbPath, embeddingModel };
}
