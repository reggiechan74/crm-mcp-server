import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Store } from './store.js';
import type { Config } from './types.js';
export declare function createMcpServer(store: Store | null, config: Config): McpServer;
export declare function startMcpServer(store: Store, config: Config): Promise<void>;
export declare function startMcpServerUnconfigured(config: Config): Promise<void>;
