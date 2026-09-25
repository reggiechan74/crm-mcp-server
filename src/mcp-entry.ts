#!/usr/bin/env node
import { loadConfig } from './config.js';
import { runMcpServer } from './server.js';

await runMcpServer(loadConfig());
