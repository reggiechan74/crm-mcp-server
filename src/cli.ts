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
  } else {
    await startMcpServerUnconfigured(config);
  }
} else if (command === 'reindex') {
  const config = loadConfig();
  const store = createStore(config.dbPath, config.crmRoot);
  store.indexAll();
  const stats = store.getStats();
  console.log(`Reindex complete: ${stats.totalContacts} contacts indexed.`);
  store.close();
} else if (command === 'embed') {
  const { generateEmbeddings } = await import('./embeddings.js');
  const config = loadConfig();
  const store = createStore(config.dbPath, config.crmRoot);
  store.indexAll();
  console.log('Generating embeddings...');
  const result = await generateEmbeddings(store, config);
  console.log(`Done: ${result.indexed} chunks indexed, ${result.skipped} sections skipped.`);
  store.close();
} else {
  console.log('Usage: crm-mcp <mcp|reindex|embed>');
  console.log('');
  console.log('Commands:');
  console.log('  mcp      Start MCP server (stdio transport)');
  console.log('  reindex   Re-scan and re-index all dossiers');
  console.log('  embed     Generate vector embeddings for semantic search');
}
