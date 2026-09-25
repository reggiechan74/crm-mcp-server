import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SALES_MOTIONS, type Config, type SalesMotion } from './types.js';

export function loadConfig(): Config {
  const home = homedir();
  let fileConfig: Partial<Config> = {};

  const configPath = join(home, '.crm-mcp.json');
  if (existsSync(configPath)) {
    fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  const crmRoot = process.env.CRM_ROOT || fileConfig.crmRoot || '';
  const dbPath = process.env.CRM_DB_PATH || fileConfig.dbPath || join(home, '.crm-mcp', 'crm.db');
  const embeddingModel = process.env.CRM_EMBEDDING_MODEL || fileConfig.embeddingModel || 'onnx-community/embeddinggemma-300m-ONNX';
  // Guard the trust boundary: ~/.crm-mcp.json is untrusted JSON, and legacy
  // configs stored `templates` as a string (e.g. "default"). Coerce anything
  // that isn't an array to [] so the declared Config.templates: string[] holds.
  const templates = Array.isArray(fileConfig.templates) ? fileConfig.templates : [];
  const defaultTemplate = fileConfig.defaultTemplate || 'simple';
  const templateRepo = process.env.CRM_TEMPLATE_REPO || fileConfig.templateRepo || 'reggiechan74/crm-mcp-server';
  const githubToken = process.env.CRM_GITHUB_TOKEN || fileConfig.githubToken || undefined;

  const rawMotion = process.env.CRM_SALES_MOTION || fileConfig.salesMotion || 'general';
  let salesMotion: SalesMotion = 'general';
  if ((SALES_MOTIONS as readonly string[]).includes(rawMotion)) {
    salesMotion = rawMotion as SalesMotion;
  } else {
    console.error(`crm-mcp: unknown salesMotion "${rawMotion}" — using "general" (valid: ${SALES_MOTIONS.join(', ')})`);
  }

  return { crmRoot, dbPath, embeddingModel, templates, defaultTemplate, templateRepo, githubToken, salesMotion };
}
