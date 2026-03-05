import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function loadConfig() {
    const home = homedir();
    let fileConfig = {};
    const configPath = join(home, '.crm-mcp.json');
    if (existsSync(configPath)) {
        fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    }
    const crmRoot = process.env.CRM_ROOT || fileConfig.crmRoot || '';
    const dbPath = process.env.CRM_DB_PATH || fileConfig.dbPath || join(home, '.crm-mcp', 'crm.db');
    const embeddingModel = process.env.CRM_EMBEDDING_MODEL || fileConfig.embeddingModel || 'Xenova/all-MiniLM-L6-v2';
    const templates = fileConfig.templates || [];
    const defaultTemplate = fileConfig.defaultTemplate || 'simple';
    const templateRepo = process.env.CRM_TEMPLATE_REPO || fileConfig.templateRepo || 'reggiechan74/crm-mcp-server';
    const githubToken = process.env.CRM_GITHUB_TOKEN || fileConfig.githubToken || undefined;
    return { crmRoot, dbPath, embeddingModel, templates, defaultTemplate, templateRepo, githubToken };
}
//# sourceMappingURL=config.js.map