import { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { getBundledTemplatesDir, installBundledTemplates, installTemplate } from './templates.js';

function getTemplatesDir(): string {
  return getBundledTemplatesDir();
}

// ── Types ──────────────────────────────────────────────────────────────

export interface InitOptions {
  crmRoot: string;
  templates: string[];
  customTemplatePath: string | undefined;
  configPath: string;
}

interface InitConfig {
  crmRoot: string;
  templates: string[];
  defaultTemplate: string;
}

// ── Variable substitution ──────────────────────────────────────────────

function substituteVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// ── Core logic (shared between interactive and non-interactive) ────────

export function runInitNonInteractive(opts: InitOptions): void {
  const { crmRoot, templates, customTemplatePath, configPath } = opts;

  // 1. Create CRM root
  mkdirSync(crmRoot, { recursive: true });

  // 2. Copy bundled templates (with manifest tracking)
  installBundledTemplates(crmRoot, templates);

  // 3. Copy custom templates (subdirectories containing template.json)
  if (customTemplatePath && existsSync(customTemplatePath)) {
    const entries = readdirSync(customTemplatePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const templateJsonPath = join(customTemplatePath, entry.name, 'template.json');
      if (!existsSync(templateJsonPath)) continue;
      installTemplate({
        crmRoot,
        templateName: entry.name,
        sourceDir: join(customTemplatePath, entry.name),
        source: 'bundled',
      });
    }
  }

  // 4. Create sample contact "Jane Doe" in Network/ using the first template
  const firstTemplate = templates[0];
  const sampleDir = join(crmRoot, 'Network', 'DOE_Jane');
  const templateSrcDir = join(crmRoot, '.templates', firstTemplate);
  mkdirSync(sampleDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const vars: Record<string, string> = {
    name: 'Jane Doe',
    category: 'Network',
    dossierCode: 'NE-JANDOE-001',
    date: today,
    organization: '',
    context: 'Sample contact created during CRM initialization',
  };

  copyTemplateFilesWithSubstitution(templateSrcDir, sampleDir, vars);

  // 5. Write config
  const config: InitConfig = {
    crmRoot,
    templates,
    defaultTemplate: firstTemplate,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Recursively copy template files, performing {{variable}} substitution on text files.
 */
function copyTemplateFilesWithSubstitution(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
): void {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyTemplateFilesWithSubstitution(srcPath, destPath, vars);
    } else {
      const content = readFileSync(srcPath, 'utf-8');
      writeFileSync(destPath, substituteVariables(content, vars));
    }
  }
}

// ── Interactive version (for `npx crm-mcp init`) ──────────────────────

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function runInit(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('');
    console.log('CRM MCP Server — Init Wizard');
    console.log('============================');
    console.log('');

    // CRM root path
    const defaultRoot = join(homedir(), 'contacts');
    const rootAnswer = await ask(rl, `CRM root directory [${defaultRoot}]: `);
    const crmRoot = rootAnswer || defaultRoot;

    // Template selection
    const available = readdirSync(getTemplatesDir(), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    console.log('');
    console.log('Available templates:');
    available.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log('');
    const tmplAnswer = await ask(rl, `Select templates (comma-separated numbers, or "all") [1]: `);

    let templates: string[];
    if (tmplAnswer.toLowerCase() === 'all') {
      templates = available;
    } else if (tmplAnswer === '') {
      templates = [available[0]];
    } else {
      const indices = tmplAnswer.split(',').map((s) => parseInt(s.trim(), 10) - 1);
      templates = indices.filter((i) => i >= 0 && i < available.length).map((i) => available[i]);
      if (templates.length === 0) templates = [available[0]];
    }

    // Custom template path
    const customAnswer = await ask(rl, 'Custom templates directory (leave blank to skip): ');
    const customTemplatePath = customAnswer || undefined;

    // Config path
    const defaultConfig = join(homedir(), '.crm-mcp.json');
    const configPath = defaultConfig;

    console.log('');
    console.log('Configuration:');
    console.log(`  CRM root:   ${crmRoot}`);
    console.log(`  Templates:  ${templates.join(', ')}`);
    if (customTemplatePath) console.log(`  Custom:     ${customTemplatePath}`);
    console.log(`  Config:     ${configPath}`);
    console.log('');

    const confirm = await ask(rl, 'Proceed? [Y/n]: ');
    if (confirm.toLowerCase() === 'n') {
      console.log('Aborted.');
      return;
    }

    runInitNonInteractive({ crmRoot, templates, customTemplatePath, configPath });

    console.log('');
    console.log('Init complete! Your CRM is ready.');
    console.log(`  Root:    ${crmRoot}`);
    console.log(`  Config:  ${configPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run `crm-mcp mcp` to start the MCP server');
    console.log('  2. Add contacts via the crm_create tool');
    console.log('');
  } finally {
    rl.close();
  }
}
