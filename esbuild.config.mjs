import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  // All npm packages stay external — only our source code gets bundled.
  // This avoids CJS/ESM interop headaches and keeps node_modules as the
  // single source of truth for dependencies.
  packages: 'external',
};

// MCP server entry — what the plugin system runs
await build({
  ...shared,
  entryPoints: ['src/mcp-entry.ts'],
  outfile: 'dist/mcp-server.mjs',
});

// CLI entry — for `crm-mcp` command
await build({
  ...shared,
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.mjs',
});

console.log('Bundle complete: dist/mcp-server.mjs + dist/cli.mjs');
