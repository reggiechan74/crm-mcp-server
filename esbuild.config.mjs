import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  // CJS packages (yaml, fast-glob, etc.) use require() internally. In an ESM bundle,
  // esbuild's synthetic __require shim can't resolve Node.js built-ins (process, path).
  // Injecting createRequire at the top gives bundled CJS code a real require() that works.
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
  // SQLite is Node's built-in node:sqlite (auto-external via the node: prefix),
  // so the bundle has no native SQLite dependency. @huggingface/transformers is
  // an OPTIONAL embedding dep that pulls in the native onnxruntime-node addon;
  // keep it external and lazy-loaded so the core server bundle stays
  // dependency-free and boots even when transformers is not installed.
  external: ['@huggingface/transformers'],
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
