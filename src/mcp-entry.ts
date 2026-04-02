#!/usr/bin/env node
import { loadConfig } from './config.js';
import { createStore } from './store.js';
import { startMcpServer, startMcpServerUnconfigured } from './server.js';

const config = loadConfig();
if (config.crmRoot) {
  const store = createStore(config.dbPath, config.crmRoot);
  // Connect the MCP transport first so the handshake completes immediately.
  // indexAll() is synchronous and blocks the event loop for ~2s — running it
  // before server.connect() caused the handshake to timeout on cold starts.
  // setImmediate defers it to the next event loop tick, after the connection
  // is established. Tool calls that arrive during indexing queue naturally.
  await startMcpServer(store, config);
  setImmediate(() => store.indexAll());
} else {
  await startMcpServerUnconfigured(config);
}
