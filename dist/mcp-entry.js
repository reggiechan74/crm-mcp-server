#!/usr/bin/env node
import { loadConfig } from './config.js';
import { createStore } from './store.js';
import { startMcpServer, startMcpServerUnconfigured } from './server.js';
const config = loadConfig();
if (config.crmRoot) {
    const store = createStore(config.dbPath, config.crmRoot);
    store.indexAll();
    await startMcpServer(store, config);
}
else {
    await startMcpServerUnconfigured(config);
}
//# sourceMappingURL=mcp-entry.js.map