#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { createStore } from './store.js';
import { startMcpServer, startMcpServerUnconfigured } from './server.js';
const command = process.argv[2];
if (command === 'mcp') {
    const config = loadConfig();
    if (config.crmRoot) {
        const store = createStore(config.dbPath, config.crmRoot);
        store.indexAll();
        await startMcpServer(store, config);
    }
    else {
        await startMcpServerUnconfigured(config);
    }
}
else if (command === 'reindex') {
    const config = loadConfig();
    const store = createStore(config.dbPath, config.crmRoot);
    store.indexAll();
    const stats = store.getStats();
    console.log(`Reindex complete: ${stats.totalContacts} contacts indexed.`);
    store.close();
}
else if (command === 'embed') {
    const { generateEmbeddings } = await import('./embeddings.js');
    const config = loadConfig();
    const store = createStore(config.dbPath, config.crmRoot);
    store.indexAll();
    console.log('Generating embeddings...');
    const result = await generateEmbeddings(store, config);
    console.log(`Done: ${result.indexed} chunks indexed, ${result.skipped} sections skipped.`);
    store.close();
}
else if (command === 'benchmark-embed') {
    const { chunkText } = await import('./embeddings.js');
    const config = loadConfig();
    const store = createStore(config.dbPath, config.crmRoot);
    store.indexAll();
    const model = config.embeddingModel;
    console.log(`Model: ${model}`);
    console.log('Loading model...');
    const { pipeline } = await import('@huggingface/transformers');
    const isGemma = model.toLowerCase().includes('gemma');
    const t0 = Date.now();
    const pipe = await pipeline('feature-extraction', model, isGemma ? { dtype: 'q8' } : {});
    const loadTime = (Date.now() - t0) / 1000;
    console.log(`Model loaded in ${loadTime.toFixed(1)}s`);
    // Count actual chunks from content_cache
    const rows = store.db
        .prepare('SELECT contact_id, section, cleaned_content FROM content_cache')
        .all();
    let totalChunks = 0;
    let skipped = 0;
    for (const row of rows) {
        const content = row.cleaned_content?.trim();
        if (!content || content.length === 0) {
            skipped++;
            continue;
        }
        totalChunks += chunkText(content).length;
    }
    console.log(`Content cache: ${rows.length} sections (${skipped} empty)`);
    console.log(`Total chunks: ${totalChunks}`);
    // Benchmark 20 chunks
    const sampleChunks = [];
    for (const row of rows) {
        const content = row.cleaned_content?.trim();
        if (!content)
            continue;
        const chunks = chunkText(content);
        for (const c of chunks) {
            sampleChunks.push(c);
            if (sampleChunks.length >= 20)
                break;
        }
        if (sampleChunks.length >= 20)
            break;
    }
    console.log(`\nBenchmarking ${sampleChunks.length} chunks...`);
    const t1 = Date.now();
    for (const c of sampleChunks) {
        await pipe(c, { pooling: 'mean', normalize: true });
    }
    const elapsed = (Date.now() - t1) / 1000;
    const perChunk = elapsed / sampleChunks.length;
    const totalEst = perChunk * totalChunks;
    console.log(`Speed: ${(perChunk * 1000).toFixed(0)}ms/chunk`);
    console.log(`\nEstimated full embed time: ${formatDuration(totalEst)}`);
    console.log(`  (${totalChunks} chunks × ${(perChunk * 1000).toFixed(0)}ms + ${loadTime.toFixed(1)}s model load)`);
    store.close();
    function formatDuration(secs) {
        if (secs < 60)
            return `${secs.toFixed(0)}s`;
        const m = Math.floor(secs / 60);
        const s = Math.round(secs % 60);
        return `${m}m ${s}s`;
    }
}
else if (command === 'init') {
    const { runInit } = await import('./init.js');
    await runInit();
}
else if (command === 'templates') {
    await handleTemplatesCommand();
}
else {
    console.log('Usage: crm-mcp <mcp|reindex|embed|benchmark-embed|init|templates>');
    console.log('');
    console.log('Commands:');
    console.log('  init                          Initialize a new CRM directory with templates');
    console.log('  mcp                           Start MCP server (stdio transport)');
    console.log('  reindex                       Re-scan and re-index all dossiers');
    console.log('  embed                         Generate vector embeddings for semantic search');
    console.log('  benchmark-embed               Benchmark embedding speed and estimate full embed time');
    console.log('  templates list                List local and remote templates');
    console.log('  templates pull <name>         Download template from GitHub');
    console.log('  templates update              Check and update installed templates');
    console.log('  templates info <name>         Show template details');
}
async function handleTemplatesCommand() {
    const subcommand = process.argv[3];
    const config = loadConfig();
    if (!config.crmRoot) {
        console.error('CRM not initialized. Run: crm-mcp init');
        process.exit(1);
    }
    const { listLocalTemplates, ensureManifest, isCustomized, readTemplateInfo, computeContentHash, countFiles, dirSize, installTemplate, } = await import('./templates.js');
    const { listRemoteTemplates, downloadTemplate } = await import('./github.js');
    if (subcommand === 'list') {
        // ── List local templates ──────────────────────────────────────
        const local = listLocalTemplates(config.crmRoot);
        console.log('');
        if (local.length > 0) {
            console.log('Local (.templates/):');
            for (const t of local) {
                const status = t.customized ? '(customized)' : '';
                const cats = t.categories ? ` [${t.categories.join(', ')}]` : '';
                console.log(`  ${t.name.padEnd(20)} v${t.version}  ${status}${cats}`);
            }
        }
        else {
            console.log('No templates installed locally.');
        }
        // ── List remote templates ─────────────────────────────────────
        console.log('');
        try {
            const remote = await listRemoteTemplates(config.templateRepo, config.crmRoot, config.githubToken);
            const localNames = new Set(local.map(t => t.name));
            const available = remote.filter(r => !localNames.has(r.name));
            if (available.length > 0) {
                console.log('Available on GitHub:');
                for (const r of available) {
                    const cats = r.categories ? `  ${r.categories.length} categories` : '';
                    console.log(`  ${r.name.padEnd(20)} v${r.version}  ${r.description}${cats}`);
                    if (r.categories) {
                        console.log(`    Categories: ${r.categories.join(', ')}`);
                    }
                }
            }
            else {
                console.log('All available templates are installed locally.');
            }
        }
        catch (e) {
            console.log(`(Could not fetch remote templates: ${e.message})`);
        }
        console.log('');
    }
    else if (subcommand === 'pull') {
        // ── Pull a template ───────────────────────────────────────────
        const nameArg = process.argv[4];
        const force = process.argv.includes('--force');
        if (!nameArg) {
            console.error('Usage: crm-mcp templates pull <name> [--force]');
            console.error('Examples:');
            console.error('  crm-mcp templates pull REAL_ESTATE');
            console.error('  crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES');
            process.exit(1);
        }
        // Parse name — could be "REAL_ESTATE" or "REAL_ESTATE/A_BROKERAGE_SALES"
        const parts = nameArg.split('/');
        const templateName = parts[0];
        const category = parts[1] || undefined;
        // Check if already installed and customized
        const manifest = ensureManifest(config.crmRoot);
        const existing = manifest.templates[templateName];
        if (existing && !force) {
            const customized = isCustomized(config.crmRoot, templateName, manifest);
            if (customized) {
                console.error(`Template "${templateName}" has local customizations.`);
                console.error('Use --force to overwrite.');
                process.exit(1);
            }
        }
        console.log(`Pulling ${nameArg} from GitHub (${config.templateRepo})...`);
        const destDir = join(config.crmRoot, '.templates', templateName);
        try {
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
            const { writeManifest } = await import('./templates.js');
            writeManifest(config.crmRoot, manifest);
            const files = countFiles(destDir);
            console.log(`  Wrote ${files} files to .templates/${templateName}/`);
            console.log('  Updated .manifest.json');
            console.log('');
        }
        catch (e) {
            console.error(`Error: ${e.message}`);
            process.exit(1);
        }
    }
    else if (subcommand === 'update') {
        // ── Update installed templates ────────────────────────────────
        const force = process.argv.includes('--force');
        const templateFlag = process.argv.indexOf('--template');
        const onlyTemplate = templateFlag >= 0 ? process.argv[templateFlag + 1] : undefined;
        const manifest = ensureManifest(config.crmRoot);
        let remote;
        try {
            remote = await listRemoteTemplates(config.templateRepo, config.crmRoot, config.githubToken);
        }
        catch (e) {
            console.error(`Could not fetch remote templates: ${e.message}`);
            process.exit(1);
        }
        const remoteMap = new Map(remote.map(r => [r.name, r]));
        let updated = 0;
        let skipped = 0;
        console.log('');
        console.log('Checking for updates...');
        console.log('');
        for (const [name, entry] of Object.entries(manifest.templates)) {
            if (onlyTemplate && name !== onlyTemplate)
                continue;
            const upstream = remoteMap.get(name);
            if (!upstream) {
                console.log(`  ${name.padEnd(20)} (not found upstream — skipping)`);
                skipped++;
                continue;
            }
            if (upstream.version === entry.version) {
                const customized = isCustomized(config.crmRoot, name, manifest);
                const suffix = customized ? '(customized)' : '';
                console.log(`  ${name.padEnd(20)} v${entry.version}  (up to date) ${suffix}`);
                continue;
            }
            const customized = isCustomized(config.crmRoot, name, manifest);
            if (customized && !force) {
                console.log(`  ${name.padEnd(20)} v${entry.version} → v${upstream.version}  CUSTOMIZED — skipped (use --force)`);
                skipped++;
                continue;
            }
            if (customized && force) {
                console.log(`  ${name.padEnd(20)} v${entry.version} → v${upstream.version}  (customized, --force overwriting)`);
            }
            else {
                console.log(`  ${name.padEnd(20)} v${entry.version} → v${upstream.version}  → updating`);
            }
            const destDir = join(config.crmRoot, '.templates', name);
            try {
                await downloadTemplate(config.templateRepo, name, destDir, config.githubToken);
                const info = readTemplateInfo(destDir);
                const contentHash = computeContentHash(destDir);
                const now = new Date().toISOString();
                manifest.templates[name] = {
                    ...entry,
                    version: info?.version || upstream.version,
                    updatedAt: now,
                    contentHash,
                    source: 'github',
                };
                updated++;
            }
            catch (e) {
                console.error(`    Error updating ${name}: ${e.message}`);
                skipped++;
            }
        }
        const { writeManifest } = await import('./templates.js');
        writeManifest(config.crmRoot, manifest);
        console.log('');
        console.log(`Updated ${updated} template(s).${skipped > 0 ? ` ${skipped} skipped.` : ''}`);
        console.log('');
    }
    else if (subcommand === 'info') {
        // ── Template info ─────────────────────────────────────────────
        const nameArg = process.argv[4];
        if (!nameArg) {
            console.error('Usage: crm-mcp templates info <name>');
            process.exit(1);
        }
        const manifest = ensureManifest(config.crmRoot);
        const entry = manifest.templates[nameArg];
        const tmplDir = join(config.crmRoot, '.templates', nameArg);
        if (!entry || !existsSync(tmplDir)) {
            // Check if available remotely
            try {
                const remote = await listRemoteTemplates(config.templateRepo, config.crmRoot, config.githubToken);
                const r = remote.find(t => t.name === nameArg);
                if (r) {
                    console.log('');
                    console.log(`${r.name} v${r.version} (not installed)`);
                    console.log(`  Description: ${r.description}`);
                    if (r.categories) {
                        console.log(`  Categories: ${r.categories.join(', ')}`);
                    }
                    console.log(`  Install: crm-mcp templates pull ${nameArg}`);
                    console.log('');
                }
                else {
                    console.error(`Template "${nameArg}" not found locally or remotely.`);
                }
            }
            catch {
                console.error(`Template "${nameArg}" not found locally.`);
            }
            return;
        }
        const info = readTemplateInfo(tmplDir);
        const customized = isCustomized(config.crmRoot, nameArg, manifest);
        const files = countFiles(tmplDir);
        const size = dirSize(tmplDir);
        const sizeMb = (size / 1024 / 1024).toFixed(1);
        console.log('');
        console.log(`${nameArg} v${entry.version}`);
        console.log(`  Description: ${info?.description || '-'}`);
        console.log(`  Source:      ${entry.source}`);
        console.log(`  Installed:   ${entry.installedAt.split('T')[0]}`);
        console.log(`  Updated:     ${entry.updatedAt.split('T')[0]}`);
        console.log(`  Customized:  ${customized ? 'yes' : 'no'}`);
        console.log(`  Files:       ${files}`);
        console.log(`  Size:        ${sizeMb}MB`);
        if (entry.categories) {
            console.log(`  Installed categories: ${entry.categories.join(', ')}`);
        }
        console.log('');
    }
    else {
        console.log('Usage: crm-mcp templates <list|pull|update|info>');
        console.log('');
        console.log('Commands:');
        console.log('  list                List local and remote templates');
        console.log('  pull <name>         Download template from GitHub');
        console.log('  update              Check and update installed templates');
        console.log('  info <name>         Show template details');
    }
}
//# sourceMappingURL=cli.js.map