var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/embeddings.ts
var embeddings_exports = {};
__export(embeddings_exports, {
  chunkText: () => chunkText,
  cosineSimilarity: () => cosineSimilarity,
  generateEmbeddings: () => generateEmbeddings,
  vectorSearch: () => vectorSearch
});
async function getEmbedder(model) {
  if (!embedder) {
    const { pipeline } = await import("@huggingface/transformers");
    const isGemma = model.toLowerCase().includes("gemma");
    embedder = await pipeline("feature-extraction", model, isGemma ? { dtype: "q8" } : {});
  }
  return embedder;
}
function chunkText(text, maxTokens = 200, overlapTokens = 30) {
  if (!text || text.trim().length === 0) return [];
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(offset, end);
      const headingMatch = findLastHeadingBoundary(window);
      if (headingMatch !== -1 && headingMatch > maxChars * 0.3) {
        end = offset + headingMatch;
      } else {
        const paraMatch = window.lastIndexOf("\n\n");
        if (paraMatch !== -1 && paraMatch > maxChars * 0.3) {
          end = offset + paraMatch;
        } else {
          const sentenceMatch = findLastSentenceBoundary(window);
          if (sentenceMatch !== -1 && sentenceMatch > maxChars * 0.3) {
            end = offset + sentenceMatch;
          }
        }
      }
    }
    const chunk = text.slice(offset, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    const advance = end - offset;
    if (advance <= 0) {
      offset = end + 1;
    } else {
      offset = end - overlapChars;
      if (offset <= (chunks.length > 1 ? end - advance : 0)) {
        offset = end;
      }
    }
    if (text.length - offset < overlapChars && chunks.length > 0) {
      const remaining = text.slice(offset).trim();
      if (remaining.length > 0 && remaining.length < overlapChars) {
        break;
      }
    }
  }
  return chunks;
}
function findLastHeadingBoundary(text) {
  const pattern = /\n(#{3,4}\s)/g;
  let lastIndex = -1;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}
function findLastSentenceBoundary(text) {
  const pattern = /\.\s/g;
  let lastIndex = -1;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    lastIndex = match.index + 1;
  }
  return lastIndex;
}
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}
function ensureEmbeddingsTable(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY,
      contact_id TEXT,
      section TEXT,
      chunk_index INTEGER,
      chunk_text TEXT,
      embedding BLOB,
      UNIQUE(contact_id, section, chunk_index)
    );
  `);
}
async function generateEmbeddings(store, config) {
  const model = config.embeddingModel || "Xenova/all-MiniLM-L6-v2";
  const pipe = await getEmbedder(model);
  ensureEmbeddingsTable(store);
  store.db.exec("DELETE FROM embeddings");
  const insertStmt = store.db.prepare(`
    INSERT OR REPLACE INTO embeddings (contact_id, section, chunk_index, chunk_text, embedding)
    VALUES (?, ?, ?, ?, ?)
  `);
  const rows = store.db.prepare("SELECT contact_id, section, cleaned_content FROM content_cache").all();
  let indexed = 0;
  let skipped = 0;
  for (const row of rows) {
    const content = row.cleaned_content?.trim();
    if (!content || content.length === 0) {
      skipped++;
      continue;
    }
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      skipped++;
      continue;
    }
    for (let i = 0; i < chunks.length; i++) {
      const output = await pipe(chunks[i], { pooling: "mean", normalize: true });
      const embedding = new Float32Array(output.data);
      const buffer = Buffer.from(embedding.buffer);
      insertStmt.run(row.contact_id, row.section, i, chunks[i], buffer);
      indexed++;
    }
  }
  return { indexed, skipped };
}
async function vectorSearch(store, config, query, limit = 5) {
  const model = config.embeddingModel || "Xenova/all-MiniLM-L6-v2";
  const pipe = await getEmbedder(model);
  ensureEmbeddingsTable(store);
  const queryOutput = await pipe(query, { pooling: "mean", normalize: true });
  const queryEmbedding = new Float32Array(queryOutput.data);
  const rows = store.db.prepare(`
      SELECT e.contact_id, e.section, e.chunk_text, e.embedding, c.name as contact_name
      FROM embeddings e
      JOIN contacts c ON c.id = e.contact_id
    `).all();
  if (rows.length === 0) return [];
  const scored = rows.map((row) => {
    const embedding = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    );
    return {
      contactId: row.contact_id,
      contactName: row.contact_name,
      section: row.section,
      chunk: row.chunk_text,
      score: cosineSimilarity(queryEmbedding, embedding)
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
var embedder;
var init_embeddings = __esm({
  "src/embeddings.ts"() {
    "use strict";
    embedder = null;
  }
});

// src/templates.ts
var templates_exports = {};
__export(templates_exports, {
  computeContentHash: () => computeContentHash,
  countFiles: () => countFiles,
  dirSize: () => dirSize,
  ensureManifest: () => ensureManifest,
  getBundledTemplatesDir: () => getBundledTemplatesDir,
  installBundledTemplates: () => installBundledTemplates,
  installTemplate: () => installTemplate,
  isCustomized: () => isCustomized,
  listLocalTemplates: () => listLocalTemplates,
  migrateManifest: () => migrateManifest,
  readManifest: () => readManifest,
  readTemplateInfo: () => readTemplateInfo,
  writeManifest: () => writeManifest
});
import { existsSync as existsSync7, readFileSync as readFileSync7, writeFileSync as writeFileSync3, mkdirSync as mkdirSync3, readdirSync as readdirSync5, cpSync as cpSync2, statSync as statSync5 } from "node:fs";
import { join as join7, relative as relative4, resolve, dirname as dirname3 } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash as createHash3 } from "node:crypto";
function getBundledTemplatesDir() {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = dirname3(thisFile);
  const candidates = [
    resolve(thisDir, "..", "templates"),
    resolve(thisDir, "..", "..", "templates")
  ];
  for (const dir of candidates) {
    if (existsSync7(dir)) return dir;
  }
  throw new Error(`Bundled templates directory not found (searched: ${candidates.join(", ")})`);
}
function computeContentHash(dirPath) {
  const files = collectFiles(dirPath);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hash = createHash3("sha256");
  for (const f of files) {
    hash.update(f.relPath);
    hash.update("\0");
    hash.update(f.content);
  }
  return `sha256:${hash.digest("hex")}`;
}
function collectFiles(dirPath, basePath) {
  const base = basePath ?? dirPath;
  const result = [];
  const entries = readdirSync5(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join7(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, base));
    } else {
      const relPath = relative4(base, fullPath);
      const content = readFileSync7(fullPath, "utf-8");
      result.push({ relPath, content });
    }
  }
  return result;
}
function manifestPath(crmRoot) {
  return join7(crmRoot, ".templates", ".manifest.json");
}
function readManifest(crmRoot) {
  const path = manifestPath(crmRoot);
  if (!existsSync7(path)) return null;
  return JSON.parse(readFileSync7(path, "utf-8"));
}
function writeManifest(crmRoot, manifest) {
  const dir = join7(crmRoot, ".templates");
  mkdirSync3(dir, { recursive: true });
  writeFileSync3(manifestPath(crmRoot), JSON.stringify(manifest, null, 2) + "\n");
}
function migrateManifest(crmRoot) {
  const templatesDir = join7(crmRoot, ".templates");
  const manifest = {
    schemaVersion: 1,
    installedAt: (/* @__PURE__ */ new Date()).toISOString(),
    templates: {}
  };
  if (!existsSync7(templatesDir)) return manifest;
  const entries = readdirSync5(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const tmplDir = join7(templatesDir, entry.name);
    const tmplJson = join7(tmplDir, "template.json");
    let version = "0.0.0";
    if (existsSync7(tmplJson)) {
      try {
        const meta = JSON.parse(readFileSync7(tmplJson, "utf-8"));
        version = meta.version || "0.0.0";
      } catch {
      }
    }
    const contentHash = computeContentHash(tmplDir);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    manifest.templates[entry.name] = {
      version,
      installedAt: now,
      updatedAt: now,
      source: "unknown",
      contentHash
    };
  }
  writeManifest(crmRoot, manifest);
  return manifest;
}
function ensureManifest(crmRoot) {
  const existing = readManifest(crmRoot);
  if (existing) return existing;
  return migrateManifest(crmRoot);
}
function isCustomized(crmRoot, templateName, manifest) {
  const entry = manifest.templates[templateName];
  if (!entry) return false;
  const tmplDir = join7(crmRoot, ".templates", templateName);
  if (!existsSync7(tmplDir)) return false;
  const currentHash = computeContentHash(tmplDir);
  return currentHash !== entry.contentHash;
}
function listLocalTemplates(crmRoot) {
  const manifest = ensureManifest(crmRoot);
  const result = [];
  for (const [name, entry] of Object.entries(manifest.templates)) {
    const tmplDir = join7(crmRoot, ".templates", name);
    if (!existsSync7(tmplDir)) continue;
    result.push({
      name,
      version: entry.version,
      source: entry.source,
      customized: isCustomized(crmRoot, name, manifest),
      categories: entry.categories
    });
  }
  return result;
}
function readTemplateInfo(templateDir) {
  const jsonPath = join7(templateDir, "template.json");
  if (!existsSync7(jsonPath)) return null;
  return JSON.parse(readFileSync7(jsonPath, "utf-8"));
}
function installTemplate(opts) {
  const { crmRoot, templateName, sourceDir, source, category } = opts;
  const destBase = join7(crmRoot, ".templates", templateName);
  if (category) {
    const commonSrc = join7(sourceDir, "COMMON");
    const catSrc = join7(sourceDir, category);
    const tmplJsonSrc = join7(sourceDir, "template.json");
    if (!existsSync7(catSrc)) {
      throw new Error(`Category "${category}" not found in ${templateName}`);
    }
    mkdirSync3(destBase, { recursive: true });
    if (existsSync7(tmplJsonSrc)) {
      const content = readFileSync7(tmplJsonSrc, "utf-8");
      writeFileSync3(join7(destBase, "template.json"), content);
    }
    if (existsSync7(commonSrc)) {
      const destCommon = join7(destBase, "COMMON");
      mkdirSync3(destCommon, { recursive: true });
      cpSync2(commonSrc, destCommon, { recursive: true });
    }
    const destCat = join7(destBase, category);
    mkdirSync3(destCat, { recursive: true });
    cpSync2(catSrc, destCat, { recursive: true });
  } else {
    mkdirSync3(destBase, { recursive: true });
    cpSync2(sourceDir, destBase, { recursive: true });
  }
  const manifest = ensureManifest(crmRoot);
  const info = readTemplateInfo(destBase);
  const version = info?.version || "0.0.0";
  const contentHash = computeContentHash(destBase);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingEntry = manifest.templates[templateName];
  const existingCategories = existingEntry?.categories || [];
  manifest.templates[templateName] = {
    version,
    installedAt: existingEntry?.installedAt || now,
    updatedAt: now,
    source,
    contentHash,
    ...category ? { categories: [.../* @__PURE__ */ new Set([...existingCategories, category])] } : {}
  };
  writeManifest(crmRoot, manifest);
}
function installBundledTemplates(crmRoot, templateNames) {
  const bundledDir = getBundledTemplatesDir();
  for (const name of templateNames) {
    const src = join7(bundledDir, name);
    if (!existsSync7(src)) {
      throw new Error(`Bundled template "${name}" not found at ${src}`);
    }
    installTemplate({
      crmRoot,
      templateName: name,
      sourceDir: src,
      source: "bundled"
    });
  }
  return ensureManifest(crmRoot);
}
function countFiles(dirPath) {
  if (!existsSync7(dirPath)) return 0;
  let count = 0;
  const entries = readdirSync5(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(join7(dirPath, entry.name));
    } else {
      count++;
    }
  }
  return count;
}
function dirSize(dirPath) {
  if (!existsSync7(dirPath)) return 0;
  let size = 0;
  const entries = readdirSync5(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join7(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += dirSize(fullPath);
    } else {
      size += statSync5(fullPath).size;
    }
  }
  return size;
}
var init_templates = __esm({
  "src/templates.ts"() {
    "use strict";
  }
});

// src/github.ts
var github_exports = {};
__export(github_exports, {
  downloadTemplate: () => downloadTemplate,
  listRemoteTemplates: () => listRemoteTemplates
});
import { existsSync as existsSync8, readFileSync as readFileSync8, writeFileSync as writeFileSync4, mkdirSync as mkdirSync4, cpSync as cpSync3, rmSync as rmSync2 } from "node:fs";
import { join as join8 } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
function cacheFilePath(crmRoot) {
  return join8(crmRoot, ".templates", ".remote-cache.json");
}
function githubHeaders(token) {
  const headers = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "crm-mcp-server"
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
async function listRemoteTemplates(repo, crmRoot, token) {
  const cachePath = cacheFilePath(crmRoot);
  if (existsSync8(cachePath)) {
    const cache2 = JSON.parse(readFileSync8(cachePath, "utf-8"));
    const age = Date.now() - new Date(cache2.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cache2.templates;
  }
  const url = `https://api.github.com/repos/${repo}/contents/templates`;
  const resp = await fetch(url, { headers: githubHeaders(token) });
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }
  const entries = await resp.json();
  const dirs = entries.filter((e) => e.type === "dir");
  const templates = [];
  for (const dir of dirs) {
    try {
      const tmplUrl = `https://api.github.com/repos/${repo}/contents/templates/${dir.name}/template.json`;
      const tmplResp = await fetch(tmplUrl, { headers: githubHeaders(token) });
      if (!tmplResp.ok) continue;
      const tmplData = await tmplResp.json();
      const decoded = Buffer.from(tmplData.content, "base64").toString("utf-8");
      const info = JSON.parse(decoded);
      const remote = {
        name: dir.name,
        version: info.version || "0.0.0",
        description: info.description || ""
      };
      if (info.professions) {
        const catUrl = `https://api.github.com/repos/${repo}/contents/templates/${dir.name}`;
        const catResp = await fetch(catUrl, { headers: githubHeaders(token) });
        if (catResp.ok) {
          const catEntries = await catResp.json();
          remote.categories = catEntries.filter((e) => e.type === "dir" && e.name !== "COMMON").map((e) => e.name);
        }
      }
      templates.push(remote);
    } catch {
    }
  }
  mkdirSync4(join8(crmRoot, ".templates"), { recursive: true });
  const cache = { fetchedAt: (/* @__PURE__ */ new Date()).toISOString(), templates };
  writeFileSync4(cachePath, JSON.stringify(cache, null, 2) + "\n");
  return templates;
}
async function downloadTemplate(repo, templateName, destDir, token, category) {
  const url = `https://api.github.com/repos/${repo}/tarball/main`;
  const resp = await fetch(url, {
    headers: githubHeaders(token),
    redirect: "follow"
  });
  if (!resp.ok) {
    throw new Error(`GitHub tarball download failed: ${resp.status} ${resp.statusText}`);
  }
  const templatePrefix = `templates/${templateName}/`;
  const allowedPrefixes = [];
  if (category) {
    allowedPrefixes.push(`templates/${templateName}/template.json`);
    allowedPrefixes.push(`templates/${templateName}/COMMON/`);
    allowedPrefixes.push(`templates/${templateName}/${category}/`);
  } else {
    allowedPrefixes.push(templatePrefix);
  }
  mkdirSync4(destDir, { recursive: true });
  const tmpFile = join8(tmpdir(), `crm-mcp-tarball-${Date.now()}.tar.gz`);
  try {
    const arrayBuffer = await resp.arrayBuffer();
    writeFileSync4(tmpFile, Buffer.from(arrayBuffer));
    const listOutput = execSync(`tar tzf "${tmpFile}" | head -1`, { encoding: "utf-8" });
    const topDir = listOutput.trim().split("/")[0];
    const extractPaths = allowedPrefixes.map((p) => `${topDir}/${p}`);
    const tmpExtract = join8(tmpdir(), `crm-mcp-extract-${Date.now()}`);
    mkdirSync4(tmpExtract, { recursive: true });
    try {
      execSync(
        `tar xzf "${tmpFile}" -C "${tmpExtract}" ${extractPaths.map((p) => `"${p}"`).join(" ")}`,
        { encoding: "utf-8" }
      );
    } catch {
      for (const p of extractPaths) {
        try {
          execSync(`tar xzf "${tmpFile}" -C "${tmpExtract}" "${p}" 2>/dev/null`, { encoding: "utf-8" });
        } catch {
        }
      }
    }
    const extractedTemplateDir = join8(tmpExtract, topDir, "templates", templateName);
    if (!existsSync8(extractedTemplateDir)) {
      throw new Error(`Template "${templateName}" not found in repository`);
    }
    if (category) {
      const tmplJson = join8(extractedTemplateDir, "template.json");
      if (existsSync8(tmplJson)) {
        writeFileSync4(join8(destDir, "template.json"), readFileSync8(tmplJson));
      }
      const commonDir = join8(extractedTemplateDir, "COMMON");
      if (existsSync8(commonDir)) {
        const destCommon = join8(destDir, "COMMON");
        mkdirSync4(destCommon, { recursive: true });
        cpSync3(commonDir, destCommon, { recursive: true });
      }
      const catDir = join8(extractedTemplateDir, category);
      if (existsSync8(catDir)) {
        const destCat = join8(destDir, category);
        mkdirSync4(destCat, { recursive: true });
        cpSync3(catDir, destCat, { recursive: true });
      } else {
        throw new Error(`Category "${category}" not found in ${templateName}`);
      }
    } else {
      cpSync3(extractedTemplateDir, destDir, { recursive: true });
    }
    rmSync2(tmpExtract, { recursive: true, force: true });
  } finally {
    rmSync2(tmpFile, { force: true });
  }
}
var CACHE_TTL_MS;
var init_github = __esm({
  "src/github.ts"() {
    "use strict";
    CACHE_TTL_MS = 60 * 60 * 1e3;
  }
});

// src/init.ts
var init_exports = {};
__export(init_exports, {
  runInit: () => runInit,
  runInitNonInteractive: () => runInitNonInteractive
});
import { mkdirSync as mkdirSync5, existsSync as existsSync10, readFileSync as readFileSync9, writeFileSync as writeFileSync5, readdirSync as readdirSync6 } from "node:fs";
import { join as join10 } from "node:path";
import { createInterface } from "node:readline";
import { homedir as homedir2 } from "node:os";
function getTemplatesDir() {
  return getBundledTemplatesDir();
}
function substituteVariables(content, vars) {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
function runInitNonInteractive(opts) {
  const { crmRoot, templates, customTemplatePath, configPath } = opts;
  mkdirSync5(crmRoot, { recursive: true });
  installBundledTemplates(crmRoot, templates);
  if (customTemplatePath && existsSync10(customTemplatePath)) {
    const entries = readdirSync6(customTemplatePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const templateJsonPath = join10(customTemplatePath, entry.name, "template.json");
      if (!existsSync10(templateJsonPath)) continue;
      installTemplate({
        crmRoot,
        templateName: entry.name,
        sourceDir: join10(customTemplatePath, entry.name),
        source: "bundled"
      });
    }
  }
  const firstTemplate = templates[0];
  const sampleDir = join10(crmRoot, "Network", "DOE_Jane");
  const templateSrcDir = join10(crmRoot, ".templates", firstTemplate);
  mkdirSync5(sampleDir, { recursive: true });
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const vars = {
    name: "Jane Doe",
    category: "Network",
    dossierCode: "NE-JANDOE-001",
    date: today2,
    organization: "",
    context: "Sample contact created during CRM initialization"
  };
  copyTemplateFilesWithSubstitution(templateSrcDir, sampleDir, vars);
  const config = {
    crmRoot,
    templates,
    defaultTemplate: firstTemplate
  };
  writeFileSync5(configPath, JSON.stringify(config, null, 2) + "\n");
}
function copyTemplateFilesWithSubstitution(srcDir, destDir, vars) {
  const entries = readdirSync6(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join10(srcDir, entry.name);
    const destPath = join10(destDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync5(destPath, { recursive: true });
      copyTemplateFilesWithSubstitution(srcPath, destPath, vars);
    } else {
      const content = readFileSync9(srcPath, "utf-8");
      writeFileSync5(destPath, substituteVariables(content, vars));
    }
  }
}
function ask(rl, question) {
  return new Promise((resolve3) => {
    rl.question(question, (answer) => resolve3(answer.trim()));
  });
}
async function runInit() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("");
    console.log("CRM MCP Server \u2014 Init Wizard");
    console.log("============================");
    console.log("");
    const defaultRoot = join10(homedir2(), "contacts");
    const rootAnswer = await ask(rl, `CRM root directory [${defaultRoot}]: `);
    const crmRoot = rootAnswer || defaultRoot;
    const available = readdirSync6(getTemplatesDir(), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    console.log("");
    console.log("Available templates:");
    available.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log("");
    const tmplAnswer = await ask(rl, `Select templates (comma-separated numbers, or "all") [1]: `);
    let templates;
    if (tmplAnswer.toLowerCase() === "all") {
      templates = available;
    } else if (tmplAnswer === "") {
      templates = [available[0]];
    } else {
      const indices = tmplAnswer.split(",").map((s) => parseInt(s.trim(), 10) - 1);
      templates = indices.filter((i) => i >= 0 && i < available.length).map((i) => available[i]);
      if (templates.length === 0) templates = [available[0]];
    }
    const customAnswer = await ask(rl, "Custom templates directory (leave blank to skip): ");
    const customTemplatePath = customAnswer || void 0;
    const defaultConfig = join10(homedir2(), ".crm-mcp.json");
    const configPath = defaultConfig;
    console.log("");
    console.log("Configuration:");
    console.log(`  CRM root:   ${crmRoot}`);
    console.log(`  Templates:  ${templates.join(", ")}`);
    if (customTemplatePath) console.log(`  Custom:     ${customTemplatePath}`);
    console.log(`  Config:     ${configPath}`);
    console.log("");
    const confirm = await ask(rl, "Proceed? [Y/n]: ");
    if (confirm.toLowerCase() === "n") {
      console.log("Aborted.");
      return;
    }
    runInitNonInteractive({ crmRoot, templates, customTemplatePath, configPath });
    console.log("");
    console.log("Init complete! Your CRM is ready.");
    console.log(`  Root:    ${crmRoot}`);
    console.log(`  Config:  ${configPath}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Run `crm-mcp mcp` to start the MCP server");
    console.log("  2. Add contacts via the crm_create tool");
    console.log("");
  } finally {
    rl.close();
  }
}
var init_init = __esm({
  "src/init.ts"() {
    "use strict";
    init_templates();
  }
});

// src/cli.ts
import { existsSync as existsSync11 } from "node:fs";
import { join as join11 } from "node:path";

// src/config.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function loadConfig() {
  const home = homedir();
  let fileConfig = {};
  const configPath = join(home, ".crm-mcp.json");
  if (existsSync(configPath)) {
    fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  }
  const crmRoot = process.env.CRM_ROOT || fileConfig.crmRoot || "";
  const dbPath = process.env.CRM_DB_PATH || fileConfig.dbPath || join(home, ".crm-mcp", "crm.db");
  const embeddingModel = process.env.CRM_EMBEDDING_MODEL || fileConfig.embeddingModel || "onnx-community/embeddinggemma-300m-ONNX";
  const templates = fileConfig.templates || [];
  const defaultTemplate = fileConfig.defaultTemplate || "simple";
  const templateRepo = process.env.CRM_TEMPLATE_REPO || fileConfig.templateRepo || "reggiechan74/crm-mcp-server";
  const githubToken = process.env.CRM_GITHUB_TOKEN || fileConfig.githubToken || void 0;
  return { crmRoot, dbPath, embeddingModel, templates, defaultTemplate, templateRepo, githubToken };
}

// src/db.ts
import { createRequire } from "node:module";
var esmRequire = createRequire(import.meta.url);
var isBun = typeof globalThis.Bun !== "undefined";
function openDatabase(path) {
  const BetterSqlite3 = esmRequire("better-sqlite3");
  const raw = new BetterSqlite3(path);
  raw.pragma("journal_mode = WAL");
  return raw;
}
function loadSqliteVec(db) {
  try {
    const sqliteVec = esmRequire("sqlite-vec");
    sqliteVec.load(db);
    return true;
  } catch {
    return false;
  }
}

// src/parser.ts
import { readFileSync as readFileSync2, statSync, existsSync as existsSync2, readdirSync } from "node:fs";
import { join as join2, basename, dirname, relative } from "node:path";
import { parse as parseYaml } from "yaml";

// src/types.ts
var CATEGORY_CODES = {
  AV: "Adversary",
  AD: "Advisor",
  CL: "Client",
  CO: "Colleague",
  FA: "Family",
  ME: "Mentor",
  NE: "Network",
  PE: "Personal",
  PR: "Prospect"
};
var CATEGORY_DIRS = {
  Adversary: "Adversaries",
  Advisor: "Advisors",
  Client: "Clients",
  Colleague: "Colleagues",
  Family: "Family",
  Mentor: "Mentors",
  Network: "Network",
  Personal: "Personal",
  Prospect: "Prospects"
};
var SECTION_FILES = {
  "index": "INDEX.md",
  "profile": "profile.md",
  "log": "log.md",
  "intelligence-profile": "intelligence/intelligence-profile.md",
  "intelligence-strategic": "intelligence/intelligence-strategic.md",
  "intelligence-risk": "intelligence/intelligence-risk.md",
  "medical": "medical/medical.md",
  "medical-genetics": "medical/medical-genetics.md",
  "medical-pharmacogenomics": "medical/medical-pharmacogenomics.md",
  "medical-labs": "medical/medical-labs.md",
  "education": "education.md"
};
function resolveSectionFile(section) {
  const withoutMd = section.replace(/\.md$/i, "");
  const flatKey = withoutMd.replace(/^.*\//, "").toLowerCase();
  if (flatKey in SECTION_FILES) return SECTION_FILES[flatKey];
  return `${withoutMd}.md`;
}

// src/parser.ts
var DIR_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_DIRS).map(([cat, dir]) => [dir, cat])
);
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]);
  } catch {
    const fixed = match[1].replace(
      /^(\s*-\s*"[^"]*")\s*(\([^)]*\))/gm,
      "$1 # $2"
    );
    try {
      return parseYaml(fixed);
    } catch {
      const result = {};
      for (const [key, pattern] of [
        ["name", /^name:\s*"?([^"\n]+)"?/m],
        ["dossierCode", /^dossierCode:\s*"?([^"\n]+)"?/m],
        ["organization", /^organization:\s*"?([^"\n]+)"?/m],
        ["status", /^status:\s*(\S+)/m],
        ["lastContactDate", /^lastContactDate:\s*(\S+)/m],
        ["lastUpdated", /^lastUpdated:\s*(\S+)/m],
        ["profession", /^profession:\s*"?([^"\n]+)"?/m]
      ]) {
        const m = match[1].match(pattern);
        if (m) result[key] = m[1].trim();
      }
      return Object.keys(result).length > 0 ? result : null;
    }
  }
}
function parseIndexYaml(dossierPath) {
  const indexPath = join2(dossierPath, "INDEX.md");
  const content = readFileSync2(indexPath, "utf-8");
  const yaml = parseFrontmatter(content);
  if (!yaml) {
    throw new Error(`No YAML frontmatter found in ${indexPath}`);
  }
  const parentDir = basename(dirname(dossierPath));
  const category = DIR_TO_CATEGORY[parentDir] ?? "Network";
  const lastContactRaw = yaml.lastContactDate;
  const lastUpdatedRaw = yaml.lastUpdated;
  const formatDate = (val) => {
    if (val == null) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val);
  };
  const aliasesRaw = yaml.aliases;
  const aliases = Array.isArray(aliasesRaw) ? JSON.stringify(aliasesRaw.map(String)) : void 0;
  return {
    id: String(yaml.dossierCode ?? ""),
    name: String(yaml.name ?? ""),
    category,
    organization: yaml.organization ? String(yaml.organization) : null,
    status: String(yaml.status ?? "Unknown"),
    lastContact: formatDate(lastContactRaw),
    lastUpdated: formatDate(lastUpdatedRaw) ?? "",
    path: basename(dirname(dossierPath)) + "/" + basename(dossierPath),
    metadataJson: JSON.stringify(yaml),
    profession: yaml.profession ? String(yaml.profession) : void 0,
    aliases
  };
}
var PLACEHOLDER_RE = /\[TO BE (?:POPULATED|ADDED|ASSESSED|DOCUMENTED)\]/i;
var NONE_DOCUMENTED_RE = /^\*(?:None documented|Not yet assessed|No \w+ (?:observed|identified))\*$/;
var TEMPLATE_BLOCKQUOTE_RE = /^>\s*\*\*(?:ANALYSIS FRAMEWORK|STRUCTURAL ANALYSIS)/;
var COMMON_TACTICS_RE = /^\*\*Common Tactics Reference:\*\*$/;
var TABLE_SEPARATOR_RE = /^\|[-|\s:]+\|$/;
var TABLE_HEADER_RE = /^\|.*\|$/;
function isPlaceholderTableRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return false;
  if (TABLE_SEPARATOR_RE.test(line)) return false;
  const cells = line.split("|").slice(1, -1);
  if (cells.length === 0) return false;
  return cells.every((cell) => PLACEHOLDER_RE.test(cell.trim()));
}
function isBoilerplateLine(line) {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  if (PLACEHOLDER_RE.test(trimmed)) return true;
  if (NONE_DOCUMENTED_RE.test(trimmed)) return true;
  if (TEMPLATE_BLOCKQUOTE_RE.test(trimmed)) return true;
  if (COMMON_TACTICS_RE.test(trimmed)) return true;
  if (isPlaceholderTableRow(trimmed)) return true;
  return false;
}
function isSectionHeader(line) {
  return /^#{3,4}\s/.test(line.trim());
}
function stripBoilerplate(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentSection = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSectionHeader(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { headerIndex: i, headerLine: line, bodyLines: [] };
    } else if (currentSection) {
      currentSection.bodyLines.push({ index: i, line });
    }
  }
  if (currentSection) sections.push(currentSection);
  const linesToRemove = /* @__PURE__ */ new Set();
  for (const section of sections) {
    const contentLines = section.bodyLines.filter((bl) => bl.line.trim() !== "");
    const substantiveLines = contentLines.filter((bl) => !TABLE_SEPARATOR_RE.test(bl.line.trim()));
    if (substantiveLines.length === 0) {
      continue;
    }
    const allBoilerplate = substantiveLines.every((bl) => {
      const trimmed = bl.line.trim();
      if (isBoilerplateLine(trimmed)) return true;
      if (TABLE_HEADER_RE.test(trimmed) && !PLACEHOLDER_RE.test(trimmed)) {
        return true;
      }
      return false;
    });
    if (allBoilerplate) {
      const hasRealTableData = substantiveLines.some((bl) => {
        const trimmed = bl.line.trim();
        if (!TABLE_HEADER_RE.test(trimmed)) return false;
        if (isBoilerplateLine(trimmed)) return false;
        if (PLACEHOLDER_RE.test(trimmed)) return false;
        const nextIdx = section.bodyLines.findIndex((b) => b.index > bl.index && b.line.trim() !== "");
        if (nextIdx >= 0 && TABLE_SEPARATOR_RE.test(section.bodyLines[nextIdx].line.trim())) {
          return false;
        }
        return true;
      });
      if (!hasRealTableData) {
        linesToRemove.add(section.headerIndex);
        for (const bl of section.bodyLines) {
          linesToRemove.add(bl.index);
        }
      }
    } else {
      for (const bl of section.bodyLines) {
        const trimmed = bl.line.trim();
        if (isBoilerplateLine(trimmed)) {
          linesToRemove.add(bl.index);
        }
      }
      removeOrphanedTableParts(section.bodyLines, linesToRemove);
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (sections.length > 0 && i >= sections[0].headerIndex) break;
    if (isBoilerplateLine(lines[i])) {
      linesToRemove.add(i);
    }
  }
  const resultLines = lines.filter((_, i) => !linesToRemove.has(i));
  const collapsed = [];
  let blankCount = 0;
  for (const line of resultLines) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }
  return collapsed.join("\n");
}
function removeOrphanedTableParts(bodyLines, linesToRemove) {
  for (let i = 0; i < bodyLines.length; i++) {
    const bl = bodyLines[i];
    if (TABLE_HEADER_RE.test(bl.line.trim()) && !TABLE_SEPARATOR_RE.test(bl.line.trim())) {
      const nextNonBlank = bodyLines.slice(i + 1).find((b) => b.line.trim() !== "");
      if (nextNonBlank && TABLE_SEPARATOR_RE.test(nextNonBlank.line.trim())) {
        const sepIdx = bodyLines.indexOf(nextNonBlank);
        const dataRows = bodyLines.slice(sepIdx + 1).filter((b) => {
          const t = b.line.trim();
          return TABLE_HEADER_RE.test(t) && !TABLE_SEPARATOR_RE.test(t);
        });
        const tableDataRows = [];
        for (let j = sepIdx + 1; j < bodyLines.length; j++) {
          const t = bodyLines[j].line.trim();
          if (t === "") continue;
          if (TABLE_HEADER_RE.test(t) && !TABLE_SEPARATOR_RE.test(t)) {
            tableDataRows.push(bodyLines[j]);
          } else {
            break;
          }
        }
        const allDataRemoved = tableDataRows.length > 0 && tableDataRows.every((dr) => linesToRemove.has(dr.index));
        if (allDataRemoved) {
          linesToRemove.add(bl.index);
          linesToRemove.add(nextNonBlank.index);
        }
      }
    }
  }
}
function buildSectionMeta(fullPath, file) {
  const stat = statSync(fullPath);
  const content = readFileSync2(fullPath, "utf-8");
  const stripped = stripBoilerplate(content);
  const yaml = parseFrontmatter(content);
  let lastUpdated = null;
  if (yaml?.lastUpdated) {
    const val = yaml.lastUpdated;
    if (val instanceof Date) {
      lastUpdated = val.toISOString().slice(0, 10);
    } else {
      lastUpdated = String(val);
    }
  }
  const sizeBytes = stat.size;
  const filledBytes = Buffer.byteLength(stripped, "utf-8");
  const fillPercent = sizeBytes > 0 ? Math.round(filledBytes / sizeBytes * 100) : 0;
  return { file, sizeBytes, filledBytes, fillPercent, lastUpdated };
}
function collectMdFiles(dir, root) {
  const base = root ?? dir;
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join2(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full, base));
    } else if (entry.name.endsWith(".md")) {
      results.push(relative(base, full));
    }
  }
  return results;
}
function scanDossierSections(dossierPath) {
  const results = [];
  const knownFiles = new Set(Object.values(SECTION_FILES));
  for (const [, file] of Object.entries(SECTION_FILES)) {
    const fullPath = join2(dossierPath, file);
    if (!existsSync2(fullPath)) continue;
    results.push(buildSectionMeta(fullPath, file));
  }
  if (existsSync2(dossierPath)) {
    for (const relPath of collectMdFiles(dossierPath)) {
      if (knownFiles.has(relPath)) continue;
      const fullPath = join2(dossierPath, relPath);
      if (!statSync(fullPath).isFile()) continue;
      results.push(buildSectionMeta(fullPath, relPath));
    }
  }
  return results;
}
function extractRelationships(dossierPath, contactId) {
  const indexPath = join2(dossierPath, "INDEX.md");
  const content = readFileSync2(indexPath, "utf-8");
  const yaml = parseFrontmatter(content);
  if (!yaml) return [];
  const linkedContacts = yaml.linkedContacts;
  if (!Array.isArray(linkedContacts)) return [];
  return linkedContacts.map((entry) => {
    const str = String(entry);
    const match = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const targetName = match ? match[1].trim() : str.trim();
    const context = match ? match[2].trim() : "";
    return {
      sourceId: contactId,
      targetId: "",
      targetName,
      type: "associated",
      context,
      bidirectional: false
    };
  });
}

// src/store.ts
import fg from "fast-glob";
import { readFileSync as readFileSync3, existsSync as existsSync3, mkdirSync, statSync as statSync2 } from "node:fs";
import { join as join3, dirname as dirname2 } from "node:path";
import { createHash } from "node:crypto";
function fileHash(filePath) {
  const content = readFileSync3(filePath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      organization TEXT,
      status TEXT,
      last_contact TEXT,
      last_updated TEXT,
      path TEXT NOT NULL,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS relationships (
      source_id TEXT,
      target_id TEXT,
      target_name TEXT NOT NULL,
      type TEXT NOT NULL,
      context TEXT,
      bidirectional INTEGER DEFAULT 0,
      PRIMARY KEY (source_id, target_name, type)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      contact_id,
      section,
      content,
      tokenize='porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS content_cache (
      contact_id TEXT,
      section TEXT,
      file_hash TEXT,
      cleaned_content TEXT,
      cleaned_at TEXT,
      PRIMARY KEY (contact_id, section)
    );

    CREATE TABLE IF NOT EXISTS audit_cache (
      contact_id TEXT PRIMARY KEY,
      audit_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  try {
    db.exec("ALTER TABLE contacts ADD COLUMN profession TEXT");
  } catch {
  }
  try {
    db.exec("ALTER TABLE contacts ADD COLUMN aliases TEXT");
  } catch {
  }
}
function sanitizeFtsQuery(query) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '""';
  return words.map((w) => `"${w.replace(/"/g, '""')}"`).join(" ");
}
function createStore(dbPath, crmRoot) {
  mkdirSync(dirname2(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  initSchema(db);
  loadSqliteVec(db);
  const stmts = {
    insertContact: db.prepare(`
      INSERT OR REPLACE INTO contacts (id, name, category, organization, status, last_contact, last_updated, path, metadata_json, profession, aliases)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertRelationship: db.prepare(`
      INSERT OR REPLACE INTO relationships (source_id, target_id, target_name, type, context, bidirectional)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertContentCache: db.prepare(`
      INSERT OR REPLACE INTO content_cache (contact_id, section, file_hash, cleaned_content, cleaned_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    getContact: db.prepare("SELECT * FROM contacts WHERE id = ?"),
    getContactPath: db.prepare("SELECT path FROM contacts WHERE id = ?"),
    getContentCache: db.prepare(
      "SELECT * FROM content_cache WHERE contact_id = ? AND section = ?"
    ),
    getAllContentCache: db.prepare(
      "SELECT * FROM content_cache WHERE contact_id = ?"
    ),
    getRelationships: db.prepare(
      "SELECT * FROM relationships WHERE source_id = ? OR target_id = ?"
    )
  };
  function indexDossier(dossierRelPath) {
    const dossierPath = join3(crmRoot, dossierRelPath);
    const contact = parseIndexYaml(dossierPath);
    if (!contact.id) return;
    stmts.insertContact.run(
      contact.id,
      contact.name,
      contact.category,
      contact.organization,
      contact.status,
      contact.lastContact,
      contact.lastUpdated,
      contact.path,
      contact.metadataJson,
      contact.profession ?? null,
      contact.aliases ?? null
    );
    const rels = extractRelationships(dossierPath, contact.id);
    for (const rel of rels) {
      stmts.insertRelationship.run(
        rel.sourceId,
        rel.targetId,
        rel.targetName,
        rel.type,
        rel.context,
        rel.bidirectional ? 1 : 0
      );
    }
    for (const [sectionKey, sectionFile] of Object.entries(SECTION_FILES)) {
      const filePath = join3(dossierPath, sectionFile);
      if (!existsSync3(filePath)) continue;
      const raw = readFileSync3(filePath, "utf-8");
      const hash = createHash("sha256").update(raw).digest("hex");
      const cleaned = stripBoilerplate(raw);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(
        "INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)"
      ).run(contact.id, sectionKey, cleaned);
      stmts.insertContentCache.run(
        contact.id,
        sectionKey,
        hash,
        cleaned,
        now
      );
    }
    const knownFiles = new Set(Object.values(SECTION_FILES));
    for (const relPath of collectMdFiles(dossierPath)) {
      if (knownFiles.has(relPath)) continue;
      const filePath = join3(dossierPath, relPath);
      if (!statSync2(filePath).isFile()) continue;
      const sectionKey = relPath.replace(/\.md$/, "");
      const raw = readFileSync3(filePath, "utf-8");
      const hash = createHash("sha256").update(raw).digest("hex");
      const cleaned = stripBoilerplate(raw);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(
        "INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)"
      ).run(contact.id, sectionKey, cleaned);
      stmts.insertContentCache.run(
        contact.id,
        sectionKey,
        hash,
        cleaned,
        now
      );
    }
  }
  const store = {
    db,
    crmRoot,
    indexAll() {
      db.exec("DELETE FROM contacts");
      db.exec("DELETE FROM relationships");
      db.exec("DELETE FROM content_fts");
      db.exec("DELETE FROM content_cache");
      const indexFiles = fg.sync("*/*/INDEX.md", { cwd: crmRoot });
      for (const relPath of indexFiles) {
        try {
          indexDossier(dirname2(relPath));
        } catch (err) {
          console.error(`Failed to index ${relPath}:`, err);
        }
      }
    },
    indexOne(dossierRelPath) {
      const dossierPath = join3(crmRoot, dossierRelPath);
      const contact = parseIndexYaml(dossierPath);
      if (contact.id) {
        db.prepare("DELETE FROM contacts WHERE id = ?").run(contact.id);
        db.prepare("DELETE FROM relationships WHERE source_id = ?").run(contact.id);
        db.prepare("DELETE FROM content_fts WHERE contact_id = ?").run(contact.id);
        db.prepare("DELETE FROM content_cache WHERE contact_id = ?").run(contact.id);
      }
      indexDossier(dossierRelPath);
    },
    searchContacts(filters) {
      const {
        query,
        category,
        status,
        profession,
        limit = 20
      } = filters;
      const conditions = [];
      const params = [];
      if (query) {
        conditions.push("(name LIKE ? OR aliases LIKE ?)");
        params.push(`%${query}%`, `%${query}%`);
      }
      if (category) {
        conditions.push("category = ?");
        params.push(category);
      }
      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }
      if (profession) {
        conditions.push("profession = ?");
        params.push(profession);
      }
      const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
      const sql = `SELECT id, name, category, organization, status, last_contact FROM contacts ${where} ORDER BY name LIMIT ?`;
      params.push(limit);
      const rows = db.prepare(sql).all(...params);
      let results = rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact
      }));
      if (query && results.length === 0) {
        const ftsQuery = sanitizeFtsQuery(query);
        const ftsSql = `
          SELECT DISTINCT c.id, c.name, c.category, c.organization, c.status, c.last_contact
          FROM content_fts f
          JOIN contacts c ON c.id = f.contact_id
          WHERE content_fts MATCH ?
          ${category ? "AND c.category = ?" : ""}
          ${status ? "AND c.status = ?" : ""}
          ${profession ? "AND c.profession = ?" : ""}
          LIMIT ?
        `;
        const ftsParams = [ftsQuery];
        if (category) ftsParams.push(category);
        if (status) ftsParams.push(status);
        if (profession) ftsParams.push(profession);
        ftsParams.push(limit);
        const ftsRows = db.prepare(ftsSql).all(...ftsParams);
        results = ftsRows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          organization: row.organization,
          status: row.status,
          lastContact: row.last_contact
        }));
      }
      return results;
    },
    fullTextSearch(query, limit = 20) {
      const ftsQuery = sanitizeFtsQuery(query);
      const sql = `
        SELECT
          f.contact_id,
          f.section,
          snippet(content_fts, 2, '>>>', '<<<', '...', 30) as snippet,
          rank,
          c.name,
          c.category,
          c.organization,
          c.status,
          c.last_contact
        FROM content_fts f
        JOIN contacts c ON c.id = f.contact_id
        WHERE content_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
      const rows = db.prepare(sql).all(ftsQuery, limit);
      return rows.map((row) => ({
        id: row.contact_id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
        section: row.section,
        snippet: row.snippet,
        score: row.rank
      }));
    },
    getOutline(contactId) {
      const row = stmts.getContact.get(contactId);
      if (!row) {
        throw new Error(`Contact not found: ${contactId}`);
      }
      const contact = {
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
        lastUpdated: row.last_updated,
        path: row.path,
        metadataJson: row.metadata_json,
        profession: row.profession ?? void 0,
        aliases: row.aliases ?? void 0
      };
      const dossierPath = join3(crmRoot, contact.path);
      const sections = scanDossierSections(dossierPath);
      return { contact, sections };
    },
    getSection(contactId, section) {
      const row = stmts.getContactPath.get(contactId);
      if (!row) {
        throw new Error(`Contact not found: ${contactId}`);
      }
      const sectionFile = resolveSectionFile(section);
      const filePath = join3(crmRoot, row.path, sectionFile);
      if (!existsSync3(filePath)) {
        return "";
      }
      const cached = stmts.getContentCache.get(contactId, section);
      const currentHash = fileHash(filePath);
      if (cached && cached.file_hash === currentHash) {
        return cached.cleaned_content;
      }
      const raw = readFileSync3(filePath, "utf-8");
      const cleaned = stripBoilerplate(raw);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      stmts.insertContentCache.run(
        contactId,
        section,
        currentHash,
        cleaned,
        now
      );
      return cleaned;
    },
    getConnections(contactId, depth = 1) {
      const visited = /* @__PURE__ */ new Set();
      const result = [];
      const queue = [
        { id: contactId, currentDepth: 0 }
      ];
      while (queue.length > 0) {
        const { id, currentDepth } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (currentDepth >= depth) continue;
        const rows = stmts.getRelationships.all(id, id);
        for (const row of rows) {
          const rel = {
            sourceId: row.source_id,
            targetId: row.target_id,
            targetName: row.target_name,
            type: row.type,
            context: row.context,
            bidirectional: row.bidirectional === 1
          };
          const key = `${rel.sourceId}-${rel.targetName}-${rel.type}`;
          if (!result.some((r) => `${r.sourceId}-${r.targetName}-${r.type}` === key)) {
            result.push(rel);
          }
          const otherId = rel.sourceId === id ? rel.targetId : rel.sourceId;
          if (otherId && !visited.has(otherId)) {
            queue.push({ id: otherId, currentDepth: currentDepth + 1 });
          }
        }
      }
      return result;
    },
    getRecent(limit = 10, category) {
      let sql = "SELECT id, name, category, organization, status, last_contact FROM contacts";
      const params = [];
      if (category) {
        sql += " WHERE category = ?";
        params.push(category);
      }
      sql += " ORDER BY last_contact DESC LIMIT ?";
      params.push(limit);
      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact
      }));
    },
    getStats() {
      const totalRow = db.prepare("SELECT COUNT(*) as count FROM contacts").get();
      const totalContacts = totalRow.count;
      const categoryRows = db.prepare(
        "SELECT category, COUNT(*) as count FROM contacts GROUP BY category"
      ).all();
      const byCategory = {};
      for (const row of categoryRows) {
        byCategory[row.category] = row.count;
      }
      const thirtyDaysAgo = /* @__PURE__ */ new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const staleDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const staleRow = db.prepare(
        "SELECT COUNT(*) as count FROM contacts WHERE last_contact IS NULL OR last_contact < ?"
      ).get(staleDate);
      const staleContacts = staleRow.count;
      const cacheRows = db.prepare("SELECT contact_id, section, cleaned_content FROM content_cache").all();
      let totalFill = 0;
      let fileCount = 0;
      for (const row of cacheRows) {
        const contact = stmts.getContactPath.get(row.contact_id);
        if (!contact) continue;
        const sectionFile = resolveSectionFile(row.section);
        const filePath = join3(crmRoot, contact.path, sectionFile);
        if (!existsSync3(filePath)) continue;
        try {
          const raw = readFileSync3(filePath, "utf-8");
          const originalSize = Buffer.byteLength(raw, "utf-8");
          const cleanedSize = Buffer.byteLength(
            row.cleaned_content ?? "",
            "utf-8"
          );
          if (originalSize > 0) {
            totalFill += Math.round(cleanedSize / originalSize * 100);
            fileCount++;
          }
        } catch {
        }
      }
      const avgFillPercent = fileCount > 0 ? Math.round(totalFill / fileCount) : 0;
      return { totalContacts, byCategory, staleContacts, avgFillPercent };
    },
    getContactPath(contactId) {
      const row = stmts.getContactPath.get(contactId);
      return row ? row.path : null;
    },
    close() {
      db.close();
    }
  };
  return store;
}

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// src/writer.ts
import { readFileSync as readFileSync4, writeFileSync, mkdirSync as mkdirSync2, readdirSync as readdirSync2, cpSync, existsSync as existsSync4 } from "node:fs";
import { join as join4 } from "node:path";
import { parse as parseYaml2, stringify as stringifyYaml } from "yaml";

// src/professions.ts
var PROFESSIONS = {
  // ── Category A: Brokerage & Sales (10) ──────────────────────────────
  BSB: { code: "BSB", name: "Sales Broker/Agent", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/BROKER_SALES", trackingFile: "deals.md" },
  BLB: { code: "BLB", name: "Leasing Broker/Agent", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/BROKER_LEASING", trackingFile: "deals.md" },
  BTR: { code: "BTR", name: "Tenant Representative", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/TENANT_REP", trackingFile: "deals.md" },
  BLR: { code: "BLR", name: "Landlord Representative", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/LANDLORD_REP", trackingFile: "deals.md" },
  BIS: { code: "BIS", name: "Investment Sales Broker", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/INVESTMENT_SALES", trackingFile: "deals.md" },
  BDE: { code: "BDE", name: "Debt/Equity Placement", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/DEBT_EQUITY", trackingFile: "deals.md" },
  BNB: { code: "BNB", name: "Note Broker", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/NOTE_BROKER", trackingFile: "deals.md" },
  BBB: { code: "BBB", name: "Business Broker", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/BUSINESS_BROKER", trackingFile: "deals.md" },
  BAU: { code: "BAU", name: "Auctioneer (RE)", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/AUCTIONEER", trackingFile: "deals.md" },
  BRR: { code: "BRR", name: "Referral Agent", category: "Brokerage & Sales", categoryLetter: "A", templateDir: "A_BROKERAGE_SALES/REFERRAL_AGENT", trackingFile: "deals.md" },
  // ── Category B: Valuation & Advisory (8) ────────────────────────────
  VAP: { code: "VAP", name: "Appraiser (General)", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/APPRAISER", trackingFile: "assignments.md" },
  VRA: { code: "VRA", name: "Review Appraiser", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/REVIEW_APPRAISER", trackingFile: "assignments.md" },
  VCN: { code: "VCN", name: "Consultant/Advisor", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/CONSULTANT", trackingFile: "engagements.md" },
  VMR: { code: "VMR", name: "Market Research Analyst", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/MARKET_RESEARCH", trackingFile: "assignments.md" },
  VDD: { code: "VDD", name: "Due Diligence Specialist", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/DUE_DILIGENCE", trackingFile: "assignments.md" },
  VVS: { code: "VVS", name: "Valuation Services (Big 4)", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/VALUATION_SERVICES", trackingFile: "assignments.md" },
  VFA: { code: "VFA", name: "Financial Analyst (RE)", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/FIN_ANALYST", trackingFile: "assignments.md" },
  VDS: { code: "VDS", name: "Data Scientist (RE/PropTech)", category: "Valuation & Advisory", categoryLetter: "B", templateDir: "B_VALUATION_ADVISORY/DATA_SCIENTIST", trackingFile: "assignments.md" },
  // ── Category C: Development & Construction (14) ─────────────────────
  DDV: { code: "DDV", name: "Developer/Principal", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/DEVELOPER", trackingFile: "projects.md" },
  DDM: { code: "DDM", name: "Development Manager", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/DEV_MANAGER", trackingFile: "projects.md" },
  DLA: { code: "DLA", name: "Land Agent/ROW Specialist", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/LAND_AGENT", trackingFile: "acquisitions.md" },
  DAR: { code: "DAR", name: "Architect", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/ARCHITECT", trackingFile: "projects.md" },
  DGC: { code: "DGC", name: "General Contractor", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/CONTRACTOR", trackingFile: "projects.md" },
  DEN: { code: "DEN", name: "Engineer (Civil/Structural)", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/ENGINEER", trackingFile: "projects.md" },
  DCM: { code: "DCM", name: "Construction Manager", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/CONSTRUCTION_MGR", trackingFile: "projects.md" },
  DPM: { code: "DPM", name: "Project Manager (Construction)", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/PROJECT_MGR_CONST", trackingFile: "projects.md" },
  DSU: { code: "DSU", name: "Superintendent", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/SUPERINTENDENT", trackingFile: "projects.md" },
  DES: { code: "DES", name: "Estimator/Preconstruction", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/ESTIMATOR", trackingFile: "projects.md" },
  DSC: { code: "DSC", name: "Subcontractor", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/SUBCONTRACTOR", trackingFile: "projects.md" },
  DET: { code: "DET", name: "Entitlement Consultant", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/ENTITLEMENT", trackingFile: "projects.md" },
  DOC: { code: "DOC", name: "Owner's Representative", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/OWNERS_REP", trackingFile: "projects.md" },
  DPC: { code: "DPC", name: "Permit Expediter", category: "Development & Construction", categoryLetter: "C", templateDir: "C_DEVELOPMENT_CONSTRUCTION/PERMIT_EXPEDITER", trackingFile: "projects.md" },
  // ── Category D: Property & Asset Management (12) ────────────────────
  MPY: { code: "MPY", name: "Property Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/PROPERTY_MANAGER", trackingFile: "portfolio.md" },
  MAM: { code: "MAM", name: "Asset Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/ASSET_MANAGER", trackingFile: "portfolio.md" },
  MFM: { code: "MFM", name: "Facilities Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/FACILITIES_MANAGER", trackingFile: "portfolio.md" },
  MBE: { code: "MBE", name: "Building Engineer", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/BUILDING_ENGINEER", trackingFile: "portfolio.md" },
  MLC: { code: "MLC", name: "Leasing Coordinator", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/LEASING_COORD", trackingFile: "portfolio.md" },
  MTC: { code: "MTC", name: "Tenant Coordinator (Retail)", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/TENANT_COORD", trackingFile: "portfolio.md" },
  MRS: { code: "MRS", name: "Resident Services Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/RESIDENT_SERVICES", trackingFile: "portfolio.md" },
  MHO: { code: "MHO", name: "HOA/Condo Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/HOA_MANAGER", trackingFile: "portfolio.md" },
  MPO: { code: "MPO", name: "Portfolio Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/PORTFOLIO_MGR", trackingFile: "portfolio.md" },
  MRM: { code: "MRM", name: "Regional Manager", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/REGIONAL_MGR", trackingFile: "portfolio.md" },
  MLA: { code: "MLA", name: "Lease Administrator", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/LEASE_ADMIN", trackingFile: "portfolio.md" },
  MCO: { code: "MCO", name: "Concierge/Luxury Services", category: "Property & Asset Management", categoryLetter: "D", templateDir: "D_PROPERTY_ASSET_MANAGEMENT/CONCIERGE", trackingFile: "portfolio.md" },
  // ── Category E: Finance & Capital Markets (16) ──────────────────────
  FMB: { code: "FMB", name: "Mortgage Broker", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/MORTGAGE_BROKER", trackingFile: "loans.md" },
  FLO: { code: "FLO", name: "Loan Officer/Originator", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/LOAN_OFFICER", trackingFile: "loans.md" },
  FUW: { code: "FUW", name: "Underwriter (Mortgage/CMBS)", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/UNDERWRITER", trackingFile: "deals.md" },
  FLS: { code: "FLS", name: "Loan Servicer", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/LOAN_SERVICER", trackingFile: "deals.md" },
  FSS: { code: "FSS", name: "Special Servicer/Workout", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/SPECIAL_SERVICER", trackingFile: "deals.md" },
  FIR: { code: "FIR", name: "Investor Relations", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/INVESTOR_RELATIONS", trackingFile: "deals.md" },
  FCR: { code: "FCR", name: "Capital Raiser", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/CAPITAL_RAISER", trackingFile: "deals.md" },
  FFM: { code: "FFM", name: "Fund Manager", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/FUND_MANAGER", trackingFile: "deals.md" },
  FPA: { code: "FPA", name: "Portfolio Analyst", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/PORTFOLIO_ANALYST", trackingFile: "deals.md" },
  FAQ: { code: "FAQ", name: "Acquisitions Professional", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/ACQUISITIONS", trackingFile: "deals.md" },
  FDS: { code: "FDS", name: "Dispositions Professional", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/DISPOSITIONS", trackingFile: "deals.md" },
  FSY: { code: "FSY", name: "Syndicator/GP", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/SYNDICATOR", trackingFile: "deals.md" },
  FCF: { code: "FCF", name: "Crowdfunding Platform Rep", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/CROWDFUNDING", trackingFile: "deals.md" },
  FLN: { code: "FLN", name: "Commercial Lender (Bank)", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/COMM_LENDER", trackingFile: "deals.md" },
  FEQ: { code: "FEQ", name: "Equity Partner/JV", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/EQUITY_PARTNER", trackingFile: "deals.md" },
  FCD: { code: "FCD", name: "Credit Analyst", category: "Finance & Capital Markets", categoryLetter: "E", templateDir: "E_FINANCE_CAPITAL_MARKETS/CREDIT_ANALYST", trackingFile: "deals.md" },
  // ── Category F: Legal & Compliance (8) ──────────────────────────────
  LRE: { code: "LRE", name: "Real Estate Lawyer", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/LAWYER", trackingFile: "matters.md" },
  LTE: { code: "LTE", name: "Title/Escrow Officer", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/TITLE_ESCROW", trackingFile: "closings.md" },
  LTI: { code: "LTI", name: "Title Insurance Underwriter", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/TITLE_INSURANCE", trackingFile: "matters.md" },
  LCO: { code: "LCO", name: "Compliance Officer", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/COMPLIANCE", trackingFile: "matters.md" },
  LZA: { code: "LZA", name: "Zoning/Land Use Attorney", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/ZONING_ATTORNEY", trackingFile: "matters.md" },
  LEA: { code: "LEA", name: "Environmental Attorney", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/ENVIRONMENTAL_ATT", trackingFile: "matters.md" },
  LPA: { code: "LPA", name: "Paralegal (RE)", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/PARALEGAL", trackingFile: "matters.md" },
  LCC: { code: "LCC", name: "Corporate Counsel (In-House)", category: "Legal & Compliance", categoryLetter: "F", templateDir: "F_LEGAL_COMPLIANCE/CORP_COUNSEL", trackingFile: "matters.md" },
  // ── Category G: Design & Planning (10) ──────────────────────────────
  GID: { code: "GID", name: "Interior Designer", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/INTERIOR_DESIGNER", trackingFile: "projects.md" },
  GSP: { code: "GSP", name: "Space Planner", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/SPACE_PLANNER", trackingFile: "projects.md" },
  GWS: { code: "GWS", name: "Workplace Strategist", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/WORKPLACE_STRATEGY", trackingFile: "projects.md" },
  GUP: { code: "GUP", name: "Urban Planner", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/URBAN_PLANNER", trackingFile: "projects.md" },
  GLS: { code: "GLS", name: "Landscape Architect", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/LANDSCAPE_ARCH", trackingFile: "projects.md" },
  GHP: { code: "GHP", name: "Historic Preservation Specialist", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/HISTORIC_PRES", trackingFile: "projects.md" },
  GAD: { code: "GAD", name: "Architectural Designer", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/ARCH_DESIGNER", trackingFile: "projects.md" },
  GLD: { code: "GLD", name: "Lighting Designer", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/LIGHTING_DESIGNER", trackingFile: "projects.md" },
  GSC: { code: "GSC", name: "Sustainability Consultant", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/SUSTAINABILITY", trackingFile: "projects.md" },
  GVS: { code: "GVS", name: "Virtual Staging Specialist", category: "Design & Planning", categoryLetter: "G", templateDir: "G_DESIGN_PLANNING/VIRTUAL_STAGING", trackingFile: "projects.md" },
  // ── Category H: Technical & Specialty (14) ──────────────────────────
  TSV: { code: "TSV", name: "Surveyor (Licensed)", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/SURVEYOR", trackingFile: "assessments.md" },
  TEV: { code: "TEV", name: "Environmental Consultant", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/ENVIRONMENTAL", trackingFile: "assessments.md" },
  TGE: { code: "TGE", name: "Geotechnical Engineer", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/GEOTECHNICAL", trackingFile: "assessments.md" },
  TBI: { code: "TBI", name: "Building Inspector (Private)", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/INSPECTOR", trackingFile: "assessments.md" },
  THI: { code: "THI", name: "Home Inspector", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/HOME_INSPECTOR", trackingFile: "assessments.md" },
  TEC: { code: "TEC", name: "Energy Consultant", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/ENERGY_CONSULTANT", trackingFile: "assessments.md" },
  TSC: { code: "TSC", name: "Security Consultant", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/SECURITY", trackingFile: "assessments.md" },
  TAC: { code: "TAC", name: "Acoustical Consultant", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/ACOUSTICAL", trackingFile: "assessments.md" },
  TAV: { code: "TAV", name: "AV/Technology Consultant", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/AV_TECHNOLOGY", trackingFile: "assessments.md" },
  TFF: { code: "TFF", name: "Furniture/FF&E Specialist", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/FFE_SPECIALIST", trackingFile: "assessments.md" },
  TRP: { code: "TRP", name: "Real Estate Photographer", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/RE_PHOTOGRAPHER", trackingFile: "assessments.md" },
  TDR: { code: "TDR", name: "Drone Operator/Aerial", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/DRONE_OPERATOR", trackingFile: "assessments.md" },
  TVT: { code: "TVT", name: "Virtual Tour/3D Capture", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/VIRTUAL_TOUR", trackingFile: "assessments.md" },
  TMS: { code: "TMS", name: "Moving/Storage Coordinator", category: "Technical & Specialty", categoryLetter: "H", templateDir: "H_TECHNICAL_SPECIALTY/MOVING_STORAGE", trackingFile: "assessments.md" },
  // ── Category I: Government & Municipal (8) ──────────────────────────
  GZO: { code: "GZO", name: "Zoning Official", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/ZONING_OFFICIAL", trackingFile: "jurisdictions.md" },
  GBI: { code: "GBI", name: "Building Inspector (Govt)", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/BLDG_INSPECTOR_GOV", trackingFile: "jurisdictions.md" },
  GPO: { code: "GPO", name: "Planning Official", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/PLANNING_OFFICIAL", trackingFile: "jurisdictions.md" },
  GTA: { code: "GTA", name: "Tax Assessor", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/TAX_ASSESSOR", trackingFile: "jurisdictions.md" },
  GED: { code: "GED", name: "Economic Development Officer", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/ECON_DEV", trackingFile: "jurisdictions.md" },
  GPC: { code: "GPC", name: "Planning Commissioner", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/PLANNING_COMM", trackingFile: "jurisdictions.md" },
  GHA: { code: "GHA", name: "Housing Authority Official", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/HOUSING_AUTH", trackingFile: "jurisdictions.md" },
  GFM: { code: "GFM", name: "Fire Marshal", category: "Government & Municipal", categoryLetter: "I", templateDir: "I_GOVERNMENT_MUNICIPAL/FIRE_MARSHAL", trackingFile: "jurisdictions.md" },
  // ── Category J: Insurance & Risk (6) ────────────────────────────────
  JIB: { code: "JIB", name: "Insurance Broker", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/INSURANCE_BROKER", trackingFile: "policies.md" },
  JRM: { code: "JRM", name: "Risk Manager", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/RISK_MANAGER", trackingFile: "policies.md" },
  JCA: { code: "JCA", name: "Claims Adjuster", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/CLAIMS_ADJUSTER", trackingFile: "policies.md" },
  JLC: { code: "JLC", name: "Loss Control Specialist", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/LOSS_CONTROL", trackingFile: "policies.md" },
  JRE: { code: "JRE", name: "Risk Engineer", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/RISK_ENGINEER", trackingFile: "policies.md" },
  JCW: { code: "JCW", name: "Catastrophe/Weather Specialist", category: "Insurance & Risk", categoryLetter: "J", templateDir: "J_INSURANCE_RISK/CATASTROPHE", trackingFile: "policies.md" },
  // ── Category K: Corporate Real Estate (7) ───────────────────────────
  KCR: { code: "KCR", name: "Corporate RE Director", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/CORPORATE_RE", trackingFile: "portfolio.md" },
  KSS: { code: "KSS", name: "Site Selection Specialist", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/SITE_SELECTION", trackingFile: "portfolio.md" },
  KRL: { code: "KRL", name: "Relocation Specialist", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/RELOCATION", trackingFile: "portfolio.md" },
  KWP: { code: "KWP", name: "Workplace Services Manager", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/WORKPLACE_SERVICES", trackingFile: "portfolio.md" },
  KPD: { code: "KPD", name: "Procurement/Vendor Manager", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/PROCUREMENT", trackingFile: "portfolio.md" },
  KTM: { code: "KTM", name: "Transaction Manager", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/TRANSACTION_MGR", trackingFile: "portfolio.md" },
  KST: { code: "KST", name: "Strategic Planning (RE)", category: "Corporate Real Estate", categoryLetter: "K", templateDir: "K_CORPORATE_REAL_ESTATE/STRATEGIC_PLAN", trackingFile: "portfolio.md" },
  // ── Category L: Marketing & Operations (10) ─────────────────────────
  LMK: { code: "LMK", name: "Marketing Coordinator", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/MARKETING_COORD", trackingFile: "campaigns.md" },
  LLX: { code: "LLX", name: "Listing Coordinator", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/LISTING_COORD", trackingFile: "campaigns.md" },
  LTC: { code: "LTC", name: "Transaction Coordinator", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/TRANSACTION_COORD", trackingFile: "campaigns.md" },
  LOA: { code: "LOA", name: "Office Administrator", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/OFFICE_ADMIN", trackingFile: "campaigns.md" },
  LRM: { code: "LRM", name: "Research Manager", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/RESEARCH_MGR", trackingFile: "campaigns.md" },
  LPT: { code: "LPT", name: "PropTech Specialist", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/PROPTECH", trackingFile: "campaigns.md" },
  LPR: { code: "LPR", name: "Public Relations (RE)", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/PR_SPECIALIST", trackingFile: "campaigns.md" },
  LCM: { code: "LCM", name: "Communications Manager", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/COMMUNICATIONS", trackingFile: "campaigns.md" },
  LDS: { code: "LDS", name: "Digital/Social Media", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/DIGITAL_MEDIA", trackingFile: "campaigns.md" },
  LEM: { code: "LEM", name: "Event Manager (RE)", category: "Marketing & Operations", categoryLetter: "L", templateDir: "L_MARKETING_OPERATIONS/EVENT_MANAGER", trackingFile: "campaigns.md" },
  // ── Category M: Accounting & Finance (7) ────────────────────────────
  MCT: { code: "MCT", name: "Controller", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/CONTROLLER", trackingFile: "entities.md" },
  MRA: { code: "MRA", name: "Real Estate Accountant", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/RE_ACCOUNTANT", trackingFile: "entities.md" },
  MPA: { code: "MPA", name: "Property Accountant", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/PROPERTY_ACCT", trackingFile: "entities.md" },
  MBK: { code: "MBK", name: "Bookkeeper", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/BOOKKEEPER", trackingFile: "entities.md" },
  MTS: { code: "MTS", name: "Tax Specialist (RE)", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/TAX_SPECIALIST", trackingFile: "entities.md" },
  MCF: { code: "MCF", name: "CFO/Finance Director", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/CFO", trackingFile: "entities.md" },
  MAU: { code: "MAU", name: "Auditor (Internal/External)", category: "Accounting & Finance", categoryLetter: "M", templateDir: "M_ACCOUNTING_FINANCE/AUDITOR", trackingFile: "entities.md" },
  // ── Category N: Investment & Principal (7) ──────────────────────────
  NPI: { code: "NPI", name: "Principal/Owner", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/PRINCIPAL", trackingFile: "investments.md" },
  NLP: { code: "NLP", name: "Limited Partner/Investor", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/LP_INVESTOR", trackingFile: "holdings.md" },
  NFO: { code: "NFO", name: "Family Office", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/FAMILY_OFFICE", trackingFile: "holdings.md" },
  NHN: { code: "NHN", name: "High Net Worth Individual", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/HNWI", trackingFile: "holdings.md" },
  NIN: { code: "NIN", name: "Institutional Investor", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/INSTITUTIONAL", trackingFile: "holdings.md" },
  NSO: { code: "NSO", name: "Sovereign Wealth/Pension", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/SOVEREIGN_PENSION", trackingFile: "holdings.md" },
  NEN: { code: "NEN", name: "Endowment/Foundation", category: "Investment & Principal", categoryLetter: "N", templateDir: "N_INVESTMENT_PRINCIPAL/ENDOWMENT", trackingFile: "holdings.md" },
  // ── Category O: Affordable & Public Housing (6) ─────────────────────
  OAH: { code: "OAH", name: "Affordable Housing Manager", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/AFFORDABLE_MGR", trackingFile: "programs.md" },
  OHS: { code: "OHS", name: "Housing Specialist", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/HOUSING_SPECIALIST", trackingFile: "programs.md" },
  OCD: { code: "OCD", name: "Community Development", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/COMMUNITY_DEV", trackingFile: "programs.md" },
  OTC: { code: "OTC", name: "Tax Credit Specialist", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/TAX_CREDIT", trackingFile: "programs.md" },
  ORS: { code: "ORS", name: "Resident Services Coordinator", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/RESIDENT_SVCS", trackingFile: "programs.md" },
  OFA: { code: "OFA", name: "Fair Housing Specialist", category: "Affordable & Public Housing", categoryLetter: "O", templateDir: "O_AFFORDABLE_PUBLIC_HOUSING/FAIR_HOUSING", trackingFile: "programs.md" },
  // ── Category P: Hospitality & Specialty Assets (8) ──────────────────
  PHA: { code: "PHA", name: "Hotel Asset Manager", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/HOTEL_ASSET", trackingFile: "assets.md" },
  PHD: { code: "PHD", name: "Hospitality Developer", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/HOTEL_DEVELOPER", trackingFile: "assets.md" },
  PSH: { code: "PSH", name: "Senior Housing Specialist", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/SENIOR_HOUSING", trackingFile: "assets.md" },
  PSS: { code: "PSS", name: "Self-Storage Manager", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/SELF_STORAGE", trackingFile: "assets.md" },
  PDC: { code: "PDC", name: "Data Center Specialist", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/DATA_CENTER", trackingFile: "assets.md" },
  PLS: { code: "PLS", name: "Life Sciences RE Specialist", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/LIFE_SCIENCES", trackingFile: "assets.md" },
  PSP: { code: "PSP", name: "Sports/Entertainment Venue", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/SPORTS_VENUE", trackingFile: "assets.md" },
  PMH: { code: "PMH", name: "Manufactured Housing", category: "Hospitality & Specialty Assets", categoryLetter: "P", templateDir: "P_HOSPITALITY_SPECIALTY/MANUFACTURED", trackingFile: "assets.md" },
  // ── Category Q: Building Trades & Maintenance (8) ───────────────────
  QHV: { code: "QHV", name: "HVAC Technician", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/HVAC_TECH", trackingFile: "services.md" },
  QPL: { code: "QPL", name: "Plumber", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/PLUMBER", trackingFile: "services.md" },
  QEL: { code: "QEL", name: "Electrician", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/ELECTRICIAN", trackingFile: "services.md" },
  QMT: { code: "QMT", name: "Maintenance Technician", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/MAINT_TECH", trackingFile: "services.md" },
  QJA: { code: "QJA", name: "Janitorial/Cleaning", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/JANITORIAL", trackingFile: "services.md" },
  QLN: { code: "QLN", name: "Landscaping/Grounds", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/LANDSCAPING", trackingFile: "services.md" },
  QSE: { code: "QSE", name: "Security Personnel", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/SECURITY_PERSONNEL", trackingFile: "services.md" },
  QPT: { code: "QPT", name: "Painter/Finishing", category: "Building Trades & Maintenance", categoryLetter: "Q", templateDir: "Q_BUILDING_TRADES/PAINTER", trackingFile: "services.md" },
  // ── Category R: Education & Professional Services (8) ───────────────
  REI: { code: "REI", name: "Real Estate Instructor", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/RE_INSTRUCTOR", trackingFile: "engagements.md" },
  RRC: { code: "RRC", name: "Recruiter (RE Industry)", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/RE_RECRUITER", trackingFile: "engagements.md" },
  RCH: { code: "RCH", name: "Coach/Mentor (RE)", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/RE_COACH", trackingFile: "engagements.md" },
  RAS: { code: "RAS", name: "Association Executive", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/ASSOCIATION", trackingFile: "engagements.md" },
  RJO: { code: "RJO", name: "Journalist/Editor (RE)", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/RE_JOURNALIST", trackingFile: "engagements.md" },
  RSP: { code: "RSP", name: "Speaker/Thought Leader", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/SPEAKER", trackingFile: "engagements.md" },
  RDP: { code: "RDP", name: "Data Provider Representative", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/DATA_PROVIDER", trackingFile: "engagements.md" },
  RSW: { code: "RSW", name: "Software Vendor (RE)", category: "Education & Professional Services", categoryLetter: "R", templateDir: "R_EDUCATION_PROFESSIONAL/SOFTWARE_VENDOR", trackingFile: "engagements.md" }
};
function lookupProfession(code) {
  return PROFESSIONS[code.toUpperCase()];
}

// src/writer.ts
import { createHash as createHash2 } from "node:crypto";
function getContactPath(store, contactId) {
  const row = store.db.prepare("SELECT path FROM contacts WHERE id = ?").get(contactId);
  if (!row) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  return row.path;
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function parseFrontmatterAndBody(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { yaml: {}, body: content };
  }
  const yaml = parseYaml2(match[1]);
  return { yaml, body: match[2] };
}
function reconstructFile(yaml, body) {
  const sanitized = { ...yaml };
  for (const [key, value] of Object.entries(sanitized)) {
    if (value instanceof Date) {
      sanitized[key] = value.toISOString().split("T")[0];
    }
  }
  const yamlStr = stringifyYaml(sanitized, { lineWidth: 0 }).trimEnd();
  return `---
${yamlStr}
---
${body}`;
}
function invalidateAndReindex(store, contactId, section, filePath) {
  store.db.prepare("DELETE FROM content_cache WHERE contact_id = ? AND section = ?").run(contactId, section);
  store.db.prepare("DELETE FROM content_fts WHERE contact_id = ? AND section = ?").run(contactId, section);
  const raw = readFileSync4(filePath, "utf-8");
  const hash = createHash2("sha256").update(raw).digest("hex");
  const cleaned = stripBoilerplate(raw);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  store.db.prepare(
    "INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)"
  ).run(contactId, section, cleaned);
  store.db.prepare(
    "INSERT OR REPLACE INTO content_cache (contact_id, section, file_hash, cleaned_content, cleaned_at) VALUES (?, ?, ?, ?, ?)"
  ).run(contactId, section, hash, cleaned, now);
}
function appendLog(store, contactId, entry) {
  const contactPath = getContactPath(store, contactId);
  const logFile = join4(store.crmRoot, contactPath, "log.md");
  const content = readFileSync4(logFile, "utf-8");
  const { yaml, body } = parseFrontmatterAndBody(content);
  const outcome = entry.outcome ?? "";
  const nextStep = entry.nextStep ?? "";
  const newRow = `| ${entry.date} | ${entry.type} | ${entry.summary} | ${outcome} | ${nextStep} |`;
  const bodyLines = body.split("\n");
  let lastTableRowIndex = -1;
  for (let i = bodyLines.length - 1; i >= 0; i--) {
    if (bodyLines[i].trimStart().startsWith("|")) {
      lastTableRowIndex = i;
      break;
    }
  }
  if (lastTableRowIndex >= 0) {
    bodyLines.splice(lastTableRowIndex + 1, 0, newRow);
  } else {
    bodyLines.push(newRow);
  }
  yaml.lastUpdated = today();
  const updatedContent = reconstructFile(yaml, bodyLines.join("\n"));
  writeFileSync(logFile, updatedContent, "utf-8");
  invalidateAndReindex(store, contactId, "log", logFile);
}
function updateField(store, contactId, section, field, value) {
  const contactPath = getContactPath(store, contactId);
  const sectionFile = resolveSectionFile(section);
  const filePath = join4(store.crmRoot, contactPath, sectionFile);
  const content = readFileSync4(filePath, "utf-8");
  const { yaml, body } = parseFrontmatterAndBody(content);
  yaml[field] = value;
  yaml.lastUpdated = today();
  const updatedContent = reconstructFile(yaml, body);
  writeFileSync(filePath, updatedContent, "utf-8");
  invalidateAndReindex(store, contactId, section, filePath);
  if (section === "index") {
    const columnMap = {
      status: "status",
      lastContactDate: "last_contact",
      organization: "organization",
      name: "name"
    };
    const column = columnMap[field];
    if (column) {
      store.db.prepare(`UPDATE contacts SET ${column} = ? WHERE id = ?`).run(value, contactId);
    }
    store.db.prepare("UPDATE contacts SET last_updated = ? WHERE id = ?").run(today(), contactId);
  }
}
var CATEGORY_TO_CODE = Object.fromEntries(
  Object.entries(CATEGORY_CODES).map(([code, cat]) => [cat, code])
);
function getUserTemplatesDir(crmRoot) {
  return join4(crmRoot, ".templates");
}
function generateF3L3(fullName) {
  const normalized = fullName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const parts = normalized.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Name must have at least first and last parts: "${fullName}"`);
  }
  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];
  const lastNameBase = lastName.split("-")[0];
  const f3 = firstName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
  const l3 = lastNameBase.substring(0, 3).toUpperCase();
  return f3 + l3;
}
function templateTypeForCategory(category) {
  if (category === "Family") return "FAMILY";
  if (category === "Personal") return "PERSONAL";
  return "PROFESSIONAL";
}
function createDossier(store, crmRoot, input) {
  const category = input.category;
  const categoryDir = CATEGORY_DIRS[category];
  if (!categoryDir) {
    throw new Error(`Invalid category: "${input.category}". Valid: ${Object.keys(CATEGORY_DIRS).join(", ")}`);
  }
  let codePrefix;
  let professionEntry;
  if (input.profession) {
    professionEntry = lookupProfession(input.profession);
    if (!professionEntry) {
      throw new Error(`Unknown profession code: "${input.profession}". Use searchProfessions() to find valid codes.`);
    }
    codePrefix = professionEntry.code;
  } else {
    const catCode = CATEGORY_TO_CODE[category];
    if (!catCode) {
      throw new Error(`No code mapping for category: ${category}`);
    }
    codePrefix = catCode;
  }
  const f3l3 = generateF3L3(input.name);
  const catPath = join4(crmRoot, categoryDir);
  let nextSeq = 1;
  if (existsSync4(catPath)) {
    const prefix = `${codePrefix}-${f3l3}-`;
    const entries = readdirSync2(catPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath2 = join4(catPath, entry.name, "INDEX.md");
      if (!existsSync4(indexPath2)) continue;
      try {
        const content = readFileSync4(indexPath2, "utf-8");
        const match = content.match(/dossierCode:\s*"?([^"\n]+)"?/);
        if (match && match[1].startsWith(prefix)) {
          const seqStr = match[1].substring(prefix.length);
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq >= nextSeq) {
            nextSeq = seq + 1;
          }
        }
      } catch {
      }
    }
  }
  const dossierCode = `${codePrefix}-${f3l3}-${String(nextSeq).padStart(3, "0")}`;
  const nameParts = input.name.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts.slice(0, -1).join(" ");
  const folderName = `${lastName.toUpperCase()}_${firstName}`;
  const userTemplates = getUserTemplatesDir(crmRoot);
  const templateName = input.template || templateTypeForCategory(input.category);
  let templatePath;
  if (professionEntry) {
    const userProfTpl = join4(userTemplates, "REAL_ESTATE", professionEntry.templateDir);
    if (existsSync4(userProfTpl)) {
      templatePath = userProfTpl;
    }
  }
  if (!templatePath) {
    const userTpl = join4(userTemplates, templateName);
    const categoryTpl = join4(userTemplates, templateTypeForCategory(input.category));
    if (existsSync4(userTpl)) {
      templatePath = userTpl;
    } else if (existsSync4(categoryTpl)) {
      templatePath = categoryTpl;
    } else {
      throw new Error(
        `Template "${templateName}" not installed locally. Run: crm-mcp templates pull ${templateName}`
      );
    }
  }
  const destPath = join4(crmRoot, categoryDir, folderName);
  if (existsSync4(destPath)) {
    throw new Error(`Dossier folder already exists: ${destPath}`);
  }
  mkdirSync2(join4(crmRoot, categoryDir), { recursive: true });
  const needsCompose = templatePath && !existsSync4(join4(templatePath, "INDEX.md"));
  if (needsCompose && professionEntry) {
    const commonDir = join4(userTemplates, "REAL_ESTATE", "COMMON");
    if (existsSync4(commonDir)) {
      cpSync(commonDir, destPath, { recursive: true });
    }
    cpSync(templatePath, destPath, { recursive: true });
  } else {
    cpSync(templatePath, destPath, { recursive: true });
  }
  const todayStr = today();
  replacePlaceholdersRecursive(destPath, {
    name: input.name,
    dossierCode,
    organization: input.organization ?? "",
    category: input.category,
    date: todayStr,
    context: input.context ?? "",
    profession: input.profession ?? ""
  });
  const indexPath = join4(destPath, "INDEX.md");
  const indexContent = readFileSync4(indexPath, "utf-8");
  const { yaml: indexYaml, body: indexBody } = parseFrontmatterAndBody(indexContent);
  indexYaml.name = input.name;
  indexYaml.dossierCode = dossierCode;
  indexYaml.organization = input.organization ?? "";
  indexYaml.status = "Active";
  indexYaml.lastContactDate = todayStr;
  indexYaml.lastUpdated = todayStr;
  if (input.context) {
    indexYaml.context = input.context;
  }
  if (input.profession) {
    indexYaml.profession = input.profession;
  }
  delete indexYaml.tier;
  const updatedBody = indexBody.replace(/DOSSIER_TEMPLATE_\w+/g, input.name).replace(/\[SUBJECT NAME\]/g, input.name).replace(/\[ORGANIZATION\]/g, input.organization ?? "").replace(/\[NAME\]/g, input.name);
  const updatedIndex = reconstructFile(indexYaml, updatedBody);
  writeFileSync(indexPath, updatedIndex, "utf-8");
  const relPath = `${categoryDir}/${folderName}`;
  store.indexOne(relPath);
  return { id: dossierCode, path: relPath };
}
function replacePlaceholdersRecursive(dirPath, replacements) {
  const entries = readdirSync2(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join4(dirPath, entry.name);
    if (entry.isDirectory()) {
      replacePlaceholdersRecursive(fullPath, replacements);
    } else if (entry.name.endsWith(".md")) {
      let content = readFileSync4(fullPath, "utf-8");
      const vars = {
        name: replacements.name,
        dossierCode: replacements.dossierCode,
        organization: replacements.organization,
        category: replacements.category ?? "",
        context: replacements.context,
        date: replacements.date,
        profession: replacements.profession
      };
      for (const [key, value] of Object.entries(vars)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }
      content = content.replace(/contactName:\s*"[^"]*"/g, `contactName: "${replacements.name}"`);
      content = content.replace(/dossierCode:\s*"[^"]*"/g, `dossierCode: "${replacements.dossierCode}"`);
      content = content.replace(/lastUpdated:\s*\S+/g, `lastUpdated: ${replacements.date}`);
      content = content.replace(/DOSSIER_TEMPLATE_\w+/g, replacements.name);
      writeFileSync(fullPath, content, "utf-8");
    }
  }
}

// src/server.ts
init_embeddings();

// src/export.ts
function formatExport(contacts, format) {
  if (format === "json") {
    return JSON.stringify(contacts, null, 2);
  }
  if (format === "csv") {
    const headers = ["id", "name", "category", "organization", "status", "lastContact"];
    const rows = contacts.map(
      (c) => [c.id, c.name, c.category, c.organization || "", c.status, c.lastContact || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }
  if (format === "markdown") {
    const header = "| ID | Name | Category | Organization | Status | Last Contact |";
    const sep = "|-----|------|----------|-------------|--------|-------------|";
    const rows = contacts.map(
      (c) => `| ${c.id} | ${c.name} | ${c.category} | ${c.organization || "-"} | ${c.status} | ${c.lastContact || "-"} |`
    );
    return [header, sep, ...rows].join("\n");
  }
  throw new Error(`Unknown format: ${format}`);
}

// src/audit.ts
import { readFileSync as readFileSync5, readdirSync as readdirSync3, existsSync as existsSync5 } from "node:fs";
import { join as join5, relative as relative2, basename as basename3 } from "node:path";
var HEADING_RE = /^#{2,4}\s+.+/;
function collectMdFiles2(dir, root) {
  const base = root ?? dir;
  const results = [];
  for (const entry of readdirSync3(dir, { withFileTypes: true })) {
    const full = join5(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles2(full, base));
    } else if (entry.name.endsWith(".md")) {
      results.push(relative2(base, full));
    }
  }
  return results;
}
function extractHeadings(filePath) {
  if (!existsSync5(filePath)) return [];
  const content = readFileSync5(filePath, "utf-8");
  return content.split("\n").map((line) => line.trimEnd()).filter((line) => HEADING_RE.test(line));
}
function missingPriority(heading) {
  if (/^## [IVXLCDM]+\.\s/.test(heading)) return "CRITICAL";
  if (/^### [A-Z]\.\s/.test(heading)) return "MODERATE";
  return "MINOR";
}
function extractSections(filePath) {
  if (!existsSync5(filePath)) return /* @__PURE__ */ new Map();
  const content = readFileSync5(filePath, "utf-8");
  const lines = content.split("\n");
  const sections = /* @__PURE__ */ new Map();
  let currentHeading = null;
  let inFrontmatter = false;
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (HEADING_RE.test(trimmed)) {
      currentHeading = trimmed;
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
    } else if (currentHeading) {
      const t = trimmed.trim();
      if (t.length > 0 && !t.startsWith("|---") && !t.startsWith("| Date") && !t.startsWith("| ---")) {
        sections.get(currentHeading).push(t);
      }
    }
  }
  return sections;
}
function parseLatestLogDate(logPath) {
  if (!existsSync5(logPath)) return null;
  const content = readFileSync5(logPath, "utf-8");
  const lines = content.split("\n");
  const dateRe = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/;
  let latest = null;
  for (const line of lines) {
    const m = line.match(dateRe);
    if (m) {
      const date = m[1];
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      const summary = cols[2] || "";
      if (!latest || date > latest.date) {
        latest = { date, summary };
      }
    }
  }
  return latest;
}
function parseFrontmatter2(filePath) {
  const result = /* @__PURE__ */ new Map();
  if (!existsSync5(filePath)) return result;
  const content = readFileSync5(filePath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return result;
  for (const line of fmMatch[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      result.set(key, val);
    }
  }
  return result;
}
function buildRoutingTable(templateDir) {
  const table = /* @__PURE__ */ new Map();
  const mdFiles = collectMdFiles2(templateDir);
  for (const relPath of mdFiles) {
    const headings = extractHeadings(join5(templateDir, relPath));
    for (const h of headings) {
      table.set(h, relPath);
    }
  }
  return table;
}
function runAudit(dossierDir, templateDir, passes) {
  const contact = basename3(dossierDir);
  const templateName = basename3(templateDir);
  const findings = {
    misplaced: [],
    stale: [],
    duplicates: [],
    ordering: [],
    missing: []
  };
  const routingTable = buildRoutingTable(templateDir);
  const dossierHeadings = /* @__PURE__ */ new Map();
  const dossierMdFiles = collectMdFiles2(dossierDir);
  for (const relPath of dossierMdFiles) {
    const headings = extractHeadings(join5(dossierDir, relPath));
    dossierHeadings.set(relPath, new Set(headings));
  }
  let compliance = 100;
  if (passes.includes("compliance")) {
    let total = 0;
    let found = 0;
    let missingCount = 0;
    for (const [heading, expectedFile] of routingTable) {
      total++;
      const fileHeadings = dossierHeadings.get(expectedFile);
      if (fileHeadings && fileHeadings.has(heading)) {
        found++;
      } else {
        missingCount++;
        findings.missing.push({
          code: `C${missingCount}`,
          file: expectedFile,
          section: heading,
          priority: missingPriority(heading)
        });
      }
    }
    compliance = total > 0 ? Math.round(found / total * 100) : 100;
  }
  if (passes.includes("misplaced")) {
    let mpCount = 0;
    for (const [relPath, headings] of dossierHeadings) {
      for (const heading of headings) {
        const canonicalFile = routingTable.get(heading);
        if (canonicalFile && canonicalFile !== relPath) {
          mpCount++;
          const sections = extractSections(join5(dossierDir, relPath));
          const contentLines = sections.get(heading) || [];
          const preview = contentLines.slice(0, 2).join(" ").slice(0, 80) || heading;
          findings.misplaced.push({
            code: `M${mpCount}`,
            section: heading,
            currentFile: relPath,
            correctFile: canonicalFile,
            lines: contentLines.length,
            preview,
            priority: missingPriority(heading)
          });
        }
      }
    }
  }
  if (passes.includes("stale")) {
    const indexPath = join5(dossierDir, "INDEX.md");
    const logPath = join5(dossierDir, "log.md");
    const fm = parseFrontmatter2(indexPath);
    const lastContact = fm.get("lastContactDate") || "";
    const latestLog = parseLatestLogDate(logPath);
    if (latestLog && lastContact && latestLog.date > lastContact) {
      findings.stale.push({
        code: "S1",
        file: "INDEX.md",
        field: "lastContactDate",
        current: lastContact,
        suggested: latestLog.date,
        evidence: `log.md ${latestLog.date}: ${latestLog.summary}`,
        confidence: "HIGH",
        priority: "CRITICAL"
      });
    }
  }
  if (passes.includes("duplicates")) {
    const allSections = [];
    for (const relPath of dossierMdFiles) {
      const sections = extractSections(join5(dossierDir, relPath));
      for (const [heading, lines] of sections) {
        if (lines.length > 0) {
          allSections.push({ heading, file: relPath, lines });
        }
      }
    }
    let dupCount = 0;
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < allSections.length; i++) {
      for (let j = i + 1; j < allSections.length; j++) {
        const a = allSections[i];
        const b = allSections[j];
        const pairKey = `${a.file}:${a.heading}|${b.file}:${b.heading}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const setB = new Set(b.lines);
        const overlap = a.lines.filter((l) => setB.has(l)).length;
        const smaller = Math.min(a.lines.length, b.lines.length);
        if (smaller > 0 && overlap / smaller > 0.6) {
          dupCount++;
          const sectionLabel = a.heading === b.heading ? a.heading : `${a.heading} / ${b.heading}`;
          findings.duplicates.push({
            code: `D${dupCount}`,
            section: sectionLabel,
            locations: [a.file, b.file],
            priority: "MODERATE"
          });
        }
      }
    }
  }
  if (passes.includes("ordering")) {
    const templateFileOrder = /* @__PURE__ */ new Map();
    for (const [heading, file] of routingTable) {
      if (!templateFileOrder.has(file)) {
        templateFileOrder.set(file, []);
      }
      templateFileOrder.get(file).push(heading);
    }
    let ordCount = 0;
    for (const [relPath, headings] of dossierHeadings) {
      const templateOrder = templateFileOrder.get(relPath);
      if (!templateOrder) continue;
      const dossierList = [];
      const headingArr = Array.from(headings);
      const docHeadings = extractHeadings(join5(dossierDir, relPath));
      for (const h of docHeadings) {
        if (templateOrder.includes(h)) {
          dossierList.push(h);
        }
      }
      const templateIndex = (h) => templateOrder.indexOf(h);
      for (let i = 1; i < dossierList.length; i++) {
        if (templateIndex(dossierList[i]) < templateIndex(dossierList[i - 1])) {
          ordCount++;
          findings.ordering.push({
            code: `O${ordCount}`,
            file: relPath,
            section: dossierList[i],
            expectedPosition: templateIndex(dossierList[i]),
            actualPosition: i,
            priority: "MINOR"
          });
        }
      }
    }
  }
  const totalFindings = findings.missing.length + findings.misplaced.length + findings.stale.length + findings.duplicates.length + findings.ordering.length;
  const summary = totalFindings === 0 ? `${contact}: 100% compliant, no findings.` : `${contact}: ${compliance}% compliant, ${totalFindings} finding(s).`;
  return {
    contact,
    template: templateName,
    compliance,
    findings,
    summary
  };
}

// src/repair.ts
import { readFileSync as readFileSync6, writeFileSync as writeFileSync2, readdirSync as readdirSync4, existsSync as existsSync6 } from "node:fs";
import { join as join6 } from "node:path";
var HEADING_RE2 = /^#{2,4}\s+.+/;
function headingLevel(line) {
  const match = line.match(/^(#{2,4})\s/);
  return match ? match[1].length : 0;
}
function countLines(dir) {
  let total = 0;
  if (!existsSync6(dir)) return 0;
  for (const entry of readdirSync4(dir, { withFileTypes: true })) {
    const full = join6(dir, entry.name);
    if (entry.isDirectory()) {
      total += countLines(full);
    } else if (entry.name.endsWith(".md")) {
      const content = readFileSync6(full, "utf-8");
      total += content.split("\n").length;
    }
  }
  return total;
}
function extractSectionBlock(lines, heading) {
  const startIdx = lines.findIndex((l) => l.trimEnd() === heading);
  if (startIdx === -1) return null;
  const level = headingLevel(heading);
  let endIdx = startIdx + 1;
  while (endIdx < lines.length) {
    const line = lines[endIdx].trimEnd();
    if (HEADING_RE2.test(line) && headingLevel(line) <= level) {
      break;
    }
    endIdx++;
  }
  return {
    start: startIdx,
    end: endIdx,
    block: lines.slice(startIdx, endIdx)
  };
}
function applyMoves(dossierDir, audit, fixCodes, applied, failed) {
  for (const finding of audit.findings.misplaced) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes("all")) continue;
    try {
      const srcPath = join6(dossierDir, finding.currentFile);
      const dstPath = join6(dossierDir, finding.correctFile);
      const srcContent = readFileSync6(srcPath, "utf-8");
      const srcLines = srcContent.split("\n");
      const block = extractSectionBlock(srcLines, finding.section);
      if (!block) {
        failed.push(finding.code);
        continue;
      }
      srcLines.splice(block.start, block.end - block.start);
      writeFileSync2(srcPath, srcLines.join("\n"));
      let dstContent = "";
      if (existsSync6(dstPath)) {
        dstContent = readFileSync6(dstPath, "utf-8");
        if (!dstContent.endsWith("\n")) dstContent += "\n";
      }
      dstContent += block.block.join("\n") + "\n";
      writeFileSync2(dstPath, dstContent);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}
function applyDedup(dossierDir, audit, fixCodes, applied, failed) {
  for (const finding of audit.findings.duplicates) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes("all")) continue;
    try {
      const nonCanonicalFile = finding.locations[1];
      const filePath = join6(dossierDir, nonCanonicalFile);
      const content = readFileSync6(filePath, "utf-8");
      const lines = content.split("\n");
      const headingsToTry = finding.section.includes(" / ") ? finding.section.split(" / ") : [finding.section];
      let replaced = false;
      for (const heading of headingsToTry) {
        const block = extractSectionBlock(lines, heading.trim());
        if (block) {
          const newBlock = [lines[block.start], `> See ${finding.locations[0]}`];
          lines.splice(block.start, block.end - block.start, ...newBlock);
          replaced = true;
          break;
        }
      }
      if (replaced) {
        writeFileSync2(filePath, lines.join("\n"));
        applied.push(finding.code);
      } else {
        failed.push(finding.code);
      }
    } catch {
      failed.push(finding.code);
    }
  }
}
function applyOrdering(dossierDir, audit, fixCodes, applied, failed) {
  const byFile = /* @__PURE__ */ new Map();
  for (const finding of audit.findings.ordering) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes("all")) continue;
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }
  for (const [relPath, findings] of byFile) {
    try {
      const filePath = join6(dossierDir, relPath);
      const content = readFileSync6(filePath, "utf-8");
      const lines = content.split("\n");
      const sections = [];
      let frontmatter = [];
      let inFrontmatter = false;
      let currentBlock = [];
      let currentHeading = null;
      let preHeadingLines = [];
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed === "---" && sections.length === 0 && !currentHeading) {
          inFrontmatter = !inFrontmatter;
          frontmatter.push(line);
          continue;
        }
        if (inFrontmatter) {
          frontmatter.push(line);
          continue;
        }
        if (HEADING_RE2.test(trimmed) && headingLevel(trimmed) === 2) {
          if (currentHeading) {
            sections.push({ heading: currentHeading, block: currentBlock });
          } else if (preHeadingLines.length > 0) {
            frontmatter.push(...preHeadingLines);
          }
          currentHeading = trimmed;
          currentBlock = [line];
        } else if (currentHeading) {
          currentBlock.push(line);
        } else {
          preHeadingLines.push(line);
        }
      }
      if (currentHeading) {
        sections.push({ heading: currentHeading, block: currentBlock });
      }
      const posMap = /* @__PURE__ */ new Map();
      for (const f of findings) {
        posMap.set(f.section, f.expectedPosition);
      }
      sections.sort((a, b) => {
        const posA = posMap.get(a.heading) ?? sections.indexOf(a);
        const posB = posMap.get(b.heading) ?? sections.indexOf(b);
        return posA - posB;
      });
      const result = [...frontmatter];
      for (const sec of sections) {
        result.push(...sec.block);
      }
      writeFileSync2(filePath, result.join("\n"));
      for (const f of findings) {
        applied.push(f.code);
      }
    } catch {
      for (const f of findings) {
        failed.push(f.code);
      }
    }
  }
}
function applyMissing(dossierDir, templateDir, audit, fixCodes, applied, failed) {
  for (const finding of audit.findings.missing) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes("all")) continue;
    try {
      const filePath = join6(dossierDir, finding.file);
      let content = "";
      if (existsSync6(filePath)) {
        content = readFileSync6(filePath, "utf-8");
        if (!content.endsWith("\n")) content += "\n";
      }
      content += `${finding.section}

`;
      writeFileSync2(filePath, content);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}
function applyStale(dossierDir, audit, fixCodes, applied, failed) {
  for (const finding of audit.findings.stale) {
    if (!fixCodes.includes(finding.code) && !fixCodes.includes("all")) continue;
    try {
      const filePath = join6(dossierDir, finding.file);
      const content = readFileSync6(filePath, "utf-8");
      const fieldRe = new RegExp(
        `^(${finding.field}:\\s*)${escapeRegex(finding.current)}\\s*$`,
        "m"
      );
      const newContent = content.replace(fieldRe, `$1${finding.suggested}`);
      if (newContent === content) {
        failed.push(finding.code);
        continue;
      }
      writeFileSync2(filePath, newContent);
      applied.push(finding.code);
    } catch {
      failed.push(finding.code);
    }
  }
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function runRepair(dossierDir, templateDir, audit, fixCodes) {
  const applied = [];
  const failed = [];
  const linesBefore = countLines(dossierDir);
  applyMoves(dossierDir, audit, fixCodes, applied, failed);
  applyDedup(dossierDir, audit, fixCodes, applied, failed);
  applyOrdering(dossierDir, audit, fixCodes, applied, failed);
  applyMissing(dossierDir, templateDir, audit, fixCodes, applied, failed);
  applyStale(dossierDir, audit, fixCodes, applied, failed);
  const linesAfter = countLines(dossierDir);
  const lineDelta = linesAfter - linesBefore;
  const lossPercent = linesBefore > 0 ? (linesBefore - linesAfter) / linesBefore * 100 : 0;
  let contentIntegrity;
  if (lossPercent > 15) {
    contentIntegrity = "FAIL";
  } else if (lossPercent > 5) {
    contentIntegrity = "WARNING";
  } else {
    contentIntegrity = "PASS";
  }
  const freshAudit = runAudit(dossierDir, templateDir, ["compliance"]);
  const delta = lineDelta >= 0 ? `+${lineDelta}` : `${lineDelta}`;
  return {
    applied,
    failed,
    validation: {
      contentIntegrity,
      linesBefore,
      linesAfter,
      delta,
      complianceAfter: freshAudit.compliance
    }
  };
}

// src/server.ts
import { join as join9 } from "node:path";
import { existsSync as existsSync9 } from "node:fs";
init_templates();
init_github();
function requireConfigured(config) {
  if (!config.crmRoot) {
    return "CRM not initialized. Run 'npx crm-mcp init' to set up your contact directory.";
  }
  return null;
}
function respond(text) {
  const chars = text.length;
  const tokens = Math.ceil(chars / 4);
  const footer = `
<!-- ${chars.toLocaleString()} chars | ~${tokens.toLocaleString()} tokens -->`;
  return { content: [{ type: "text", text: text + footer }] };
}
function resolveContact(store, contact) {
  if (/^[A-Z]{2,3}-/.test(contact)) {
    return contact;
  }
  const results = store.searchContacts({ query: contact, limit: 1 });
  return results.length > 0 ? results[0].id : null;
}
function resolveTemplateDir(crmRoot, store, contactId) {
  const outline = store.getOutline(contactId);
  const category = outline.contact.category.toLowerCase();
  let templateType = "PROFESSIONAL";
  if (category === "family") templateType = "FAMILY";
  else if (category === "personal") templateType = "PERSONAL";
  const userTpl = join9(crmRoot, ".templates", templateType);
  if (existsSync9(userTpl)) return userTpl;
  const userTplLower = join9(crmRoot, ".templates", templateType.toLowerCase());
  if (existsSync9(userTplLower)) return userTplLower;
  return null;
}
function buildInstructions(store, config) {
  if (!config.crmRoot || !store) {
    return [
      "CRM MCP Server is installed but not yet configured.",
      "",
      "Ask the user to run: npx crm-mcp init",
      "",
      "This will set up their contact directory, choose templates,",
      "and configure the server for first use."
    ].join("\n");
  }
  const stats = store.getStats();
  const lines = [];
  lines.push(`CRM Intelligence System with ${stats.totalContacts} contacts.`);
  lines.push("");
  lines.push("Categories:");
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    lines.push(`  - ${cat}: ${count}`);
  }
  const profRows = store.db.prepare(
    "SELECT profession, COUNT(*) as count FROM contacts WHERE profession IS NOT NULL GROUP BY profession"
  ).all();
  if (profRows.length > 0) {
    lines.push("");
    lines.push("Professions:");
    for (const row of profRows) {
      const entry = lookupProfession(row.profession);
      const label = entry ? `${entry.name} (${row.profession})` : row.profession;
      lines.push(`  - ${label}: ${row.count}`);
    }
  }
  lines.push("");
  lines.push("Workflow: crm_search \u2192 crm_outline \u2192 crm_read (progressive disclosure, 10x token savings)");
  lines.push("");
  lines.push("Tools:");
  lines.push("  - crm_search \u2014 find contacts by name, org, status, or keyword");
  lines.push("  - crm_outline \u2014 dossier structural overview with fill percentages");
  lines.push("  - crm_read \u2014 read specific section (boilerplate stripped)");
  lines.push("  - crm_connections \u2014 relationship graph");
  lines.push("  - crm_recent \u2014 recently contacted people");
  lines.push("  - crm_stats \u2014 CRM-wide statistics");
  lines.push("  - crm_update \u2014 update dossier field");
  lines.push("  - crm_log \u2014 append interaction log entry");
  lines.push("  - crm_audit \u2014 analyze dossier structural health");
  lines.push("  - crm_repair \u2014 apply fixes from audit results");
  return lines.join("\n");
}
function createMcpServer(store, config) {
  const server = new McpServer(
    { name: "crm", version: "0.3.0" },
    { instructions: buildInstructions(store, config) }
  );
  server.tool(
    "crm_search",
    "Search contacts by name, alias/nickname, organization, status, category, or keyword. Returns compact results (~50-100 tokens each).",
    {
      query: z.string().optional().describe("Name, org, or keyword to search for"),
      category: z.string().optional().describe("Filter by category: Client, Network, Family, etc."),
      status: z.string().optional().describe("Filter by status: ACTIVE, DORMANT, etc."),
      profession: z.string().optional().describe("Filter by 3-letter profession code (e.g., BSB for Sales Broker)"),
      limit: z.number().optional().default(20).describe("Max results (default 20)")
    },
    async ({ query, category, status, profession, limit }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const results = store.searchContacts({ query, category, status, profession, limit });
      if (results.length === 0) return respond("No contacts found.");
      const header = "| ID | Name | Org | Category | Status | Last Contact |";
      const sep = "|-----|------|-----|----------|--------|-------------|";
      const rows = results.map((r) => `| ${r.id} | ${r.name} | ${r.organization || "-"} | ${r.category} | ${r.status} | ${r.lastContact || "-"} |`);
      return respond([header, sep, ...rows].join("\n"));
    }
  );
  server.tool(
    "crm_outline",
    "Get structural overview of a contact's dossier \u2014 shows which sections exist, their size, and fill percentage. Use before crm_read to decide which section to read.",
    {
      contact: z.string().describe("Contact name or dossier code (e.g., 'Ranjit' or 'CL-RANMUL-002')")
    },
    async ({ contact }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      try {
        const outline = store.getOutline(contactId);
        const lines = [`# ${outline.contact.name} (${outline.contact.id})`, ""];
        lines.push(`**Status:** ${outline.contact.status} | **Org:** ${outline.contact.organization || "-"} | **Last Contact:** ${outline.contact.lastContact || "-"}`);
        lines.push("");
        lines.push("| Section | Size | Filled | Last Updated |");
        lines.push("|---------|------|--------|-------------|");
        for (const s of outline.sections) {
          const sizeKb = (s.sizeBytes / 1024).toFixed(1);
          lines.push(`| ${s.file} | ${sizeKb}KB | ${s.fillPercent}% | ${s.lastUpdated || "-"} |`);
        }
        return respond(lines.join("\n"));
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_read",
    `Read a specific section of a contact's dossier. Returns cleaned content with boilerplate stripped. Standard sections: index, profile, log, intelligence-profile, intelligence-strategic, intelligence-risk, medical, medical-genetics, medical-pharmacogenomics, medical-labs, education. Profession-specific sections: deals, assignments, projects, portfolio, matters, assessments, jurisdictions, policies, campaigns, entities, holdings, programs, assets, services, engagements. Any custom file visible in crm_outline is also addressable by its relative path (e.g., "intelligence/intelligence-unsent").`,
    {
      contact: z.string().describe("Contact name or dossier code"),
      section: z.string().describe('Section name (e.g., "profile", "deals", "assignments")')
    },
    async ({ contact, section }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      try {
        const content = store.getSection(contactId, section);
        return respond(content);
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_connections",
    "Get relationship graph for a contact \u2014 shows who they're connected to and how.",
    {
      contact: z.string().describe("Contact name or dossier code"),
      depth: z.number().optional().default(1).describe("How many hops to traverse (default 1)")
    },
    async ({ contact, depth }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      const connections = store.getConnections(contactId, depth);
      if (connections.length === 0) return respond("No connections found.");
      const lines = connections.map((c) => `- ${c.targetName} (${c.type}) \u2014 ${c.context}`);
      return respond(lines.join("\n"));
    }
  );
  server.tool(
    "crm_recent",
    "List most recently contacted people, sorted by last contact date.",
    {
      limit: z.number().optional().default(10).describe("Max results"),
      category: z.string().optional().describe("Filter by category")
    },
    async ({ limit, category }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const results = store.getRecent(limit, category);
      if (results.length === 0) return respond("No recent contacts.");
      const header = "| Name | Category | Status | Last Contact |";
      const sep = "|------|----------|--------|-------------|";
      const rows = results.map((r) => `| ${r.name} | ${r.category} | ${r.status} | ${r.lastContact || "-"} |`);
      return respond([header, sep, ...rows].join("\n"));
    }
  );
  server.tool(
    "crm_stats",
    "Get CRM-wide statistics: total contacts, by category, stale contacts, average fill rate.",
    {},
    async () => {
      if (!config.crmRoot || !store) {
        const payload = JSON.stringify({ status: "unconfigured", message: "Run npx crm-mcp init" });
        return respond(payload);
      }
      const stats = store.getStats();
      const lines = [
        `**Total Contacts:** ${stats.totalContacts}`,
        `**Stale (>30 days):** ${stats.staleContacts}`,
        `**Avg Fill Rate:** ${stats.avgFillPercent}%`,
        "",
        "**By Category:**",
        ...Object.entries(stats.byCategory).map(([cat, count]) => `  - ${cat}: ${count}`)
      ];
      return respond(lines.join("\n"));
    }
  );
  server.tool(
    "crm_update",
    "Update a specific field in a contact's dossier. Updates YAML frontmatter and invalidates cache.",
    {
      contact: z.string().describe("Contact name or dossier code"),
      section: z.string().describe('Section name (e.g., "index", "profile", "deals")'),
      field: z.string().describe("YAML field name to update (e.g., 'status', 'lastContactDate')"),
      value: z.string().describe("New value for the field")
    },
    async ({ contact, section, field, value }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      try {
        updateField(store, contactId, section, field, value);
        return respond(`Updated ${field} = "${value}" in ${section} for ${contactId}`);
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_log",
    "Append a new interaction to a contact's log. Adds a row to the interaction table in log.md.",
    {
      contact: z.string().describe("Contact name or dossier code"),
      date: z.string().describe("Interaction date (YYYY-MM-DD)"),
      type: z.string().describe("Interaction type: Meeting, Email, Call, Video, Chat, etc."),
      summary: z.string().describe("Brief summary of the interaction"),
      outcome: z.string().optional().describe("What resulted from the interaction"),
      nextStep: z.string().optional().describe("What should happen next")
    },
    async ({ contact, date, type, summary, outcome, nextStep }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      try {
        appendLog(store, contactId, { date, type, summary, outcome, nextStep });
        return respond(`Logged ${type} interaction with ${contactId} on ${date}`);
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_vector_search",
    "Semantic search across all dossier content. Finds contacts and sections matching a natural language query. Requires embeddings (run 'crm-mcp embed' first).",
    {
      query: z.string().describe("Natural language query"),
      limit: z.number().optional().default(5).describe("Max results")
    },
    async ({ query, limit }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      try {
        const results = await vectorSearch(store, config, query, limit);
        if (results.length === 0) {
          return respond("No results. Have you run 'crm-mcp embed' to generate embeddings?");
        }
        const lines = results.map(
          (r) => `- **${r.contactName}** (${r.section}) [${(r.score * 100).toFixed(0)}%]: ${r.chunk.substring(0, 150)}...`
        );
        return respond(lines.join("\n"));
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_create",
    "Create a new contact dossier from template.",
    {
      name: z.string().describe("Full name (e.g., 'Jane Smith')"),
      category: z.string().describe("Category: Client, Network, Family, Personal, Prospect, etc."),
      organization: z.string().optional().describe("Organization name"),
      context: z.string().optional().describe("How you met or relationship context"),
      profession: z.string().optional().describe("3-letter profession code (e.g., BSB for Sales Broker). Generates profession-based dossier code.")
    },
    async ({ name, category, organization, context, profession }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      try {
        const result = createDossier(store, config.crmRoot, { name, category, organization, context, profession });
        return respond(`Created dossier ${result.id} at ${result.path}`);
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  server.tool(
    "crm_bulk_update",
    "Update a field across multiple contacts matching a filter.",
    {
      category: z.string().optional().describe("Filter by category"),
      status: z.string().optional().describe("Filter by current status"),
      field: z.string().describe("YAML field to update (e.g., 'status')"),
      value: z.string().describe("New value")
    },
    async ({ category, status, field, value }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contacts = store.searchContacts({ category, status, limit: 1e3 });
      if (contacts.length === 0) return respond("No contacts match filter.");
      let updated = 0;
      let errors = 0;
      for (const c of contacts) {
        try {
          updateField(store, c.id, "index", field, value);
          updated++;
        } catch {
          errors++;
        }
      }
      return respond(`Updated ${updated} contacts.${errors > 0 ? ` ${errors} errors.` : ""}`);
    }
  );
  server.tool(
    "crm_export",
    "Export contacts as JSON, CSV, or markdown table.",
    {
      format: z.enum(["json", "csv", "markdown"]).describe("Output format"),
      category: z.string().optional().describe("Filter by category"),
      status: z.string().optional().describe("Filter by status")
    },
    async ({ format, category, status }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contacts = store.searchContacts({ category, status, limit: 1e3 });
      if (contacts.length === 0) return respond("No contacts match filter.");
      const output = formatExport(contacts, format);
      return respond(output);
    }
  );
  server.tool(
    "crm_audit",
    "Analyze a dossier's structural health against its template. Returns findings without making changes.",
    {
      contact: z.string().describe("Contact name or dossier code"),
      passes: z.array(z.enum(["misplaced", "stale", "duplicates", "ordering", "compliance"])).optional().describe("Which analysis passes to run (default: all)")
    },
    async ({ contact, passes }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      const contactPath = store.getContactPath(contactId);
      if (!contactPath) return respond(`Contact path not found: ${contactId}`);
      const dossierDir = join9(config.crmRoot, contactPath);
      const templateDir = resolveTemplateDir(config.crmRoot, store, contactId);
      if (!templateDir) return respond(`Template not found for ${contactId}`);
      const allPasses = passes || ["misplaced", "stale", "duplicates", "ordering", "compliance"];
      const result = runAudit(dossierDir, templateDir, allPasses);
      store.db.prepare("INSERT OR REPLACE INTO audit_cache (contact_id, audit_json, created_at) VALUES (?, ?, ?)").run(contactId, JSON.stringify(result), (/* @__PURE__ */ new Date()).toISOString());
      return respond(JSON.stringify(result, null, 2));
    }
  );
  server.tool(
    "crm_repair",
    "Apply specific fixes from a prior audit. Requires crm_audit to be run first.",
    {
      contact: z.string().describe("Contact name or dossier code"),
      fixes: z.array(z.string()).describe("Fix codes from audit (e.g., ['M1', 'S1']) or ['all']")
    },
    async ({ contact, fixes }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const contactId = resolveContact(store, contact);
      if (!contactId) return respond(`Contact not found: ${contact}`);
      const cached = store.db.prepare("SELECT audit_json FROM audit_cache WHERE contact_id = ?").get(contactId);
      if (!cached) return respond(`No audit cache found for ${contactId}. Run crm_audit first.`);
      const audit = JSON.parse(cached.audit_json);
      const contactPath = store.getContactPath(contactId);
      if (!contactPath) return respond(`Contact path not found: ${contactId}`);
      const dossierDir = join9(config.crmRoot, contactPath);
      const templateDir = resolveTemplateDir(config.crmRoot, store, contactId);
      if (!templateDir) return respond(`Template not found for ${contactId}`);
      const result = runRepair(dossierDir, templateDir, audit, fixes);
      store.db.prepare("DELETE FROM audit_cache WHERE contact_id = ?").run(contactId);
      return respond(JSON.stringify(result, null, 2));
    }
  );
  server.tool(
    "crm_templates_list",
    "List installed and available CRM dossier templates. Shows version, customization status, and available remote templates.",
    {
      remote: z.boolean().optional().default(true).describe("Include available templates from GitHub (default: true)")
    },
    async ({ remote }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const lines = [];
      const local = listLocalTemplates(config.crmRoot);
      if (local.length > 0) {
        lines.push("**Installed:**");
        for (const t of local) {
          const status = t.customized ? " (customized)" : "";
          const cats = t.categories ? ` [${t.categories.join(", ")}]` : "";
          lines.push(`  ${t.name}  v${t.version}${status}${cats}`);
        }
      } else {
        lines.push("No templates installed locally.");
      }
      if (remote) {
        try {
          const remoteTemplates = await listRemoteTemplates(config.templateRepo, config.crmRoot, config.githubToken);
          const localNames = new Set(local.map((t) => t.name));
          const available = remoteTemplates.filter((r) => !localNames.has(r.name));
          if (available.length > 0) {
            lines.push("");
            lines.push("**Available on GitHub:**");
            for (const r of available) {
              const cats = r.categories ? `  (${r.categories.length} categories)` : "";
              lines.push(`  ${r.name}  v${r.version}  ${r.description}${cats}`);
              if (r.categories) {
                lines.push(`    Categories: ${r.categories.join(", ")}`);
              }
            }
          }
        } catch (e) {
          lines.push("");
          lines.push(`(Could not fetch remote templates: ${e.message})`);
        }
      }
      return respond(lines.join("\n"));
    }
  );
  server.tool(
    "crm_templates_pull",
    'Download a template from GitHub to local .templates/. Supports individual categories for composite templates (e.g., "REAL_ESTATE/A_BROKERAGE_SALES"). Will not overwrite customized templates \u2014 direct the user to CLI with --force for that.',
    {
      name: z.string().describe('Template name (e.g., "REAL_ESTATE" or "REAL_ESTATE/A_BROKERAGE_SALES")')
    },
    async ({ name: nameArg }) => {
      const err = requireConfigured(config);
      if (err) return respond(err);
      const parts = nameArg.split("/");
      const templateName = parts[0];
      const category = parts[1] || void 0;
      const manifest = ensureManifest(config.crmRoot);
      const existing = manifest.templates[templateName];
      if (existing) {
        const customized = isCustomized(config.crmRoot, templateName, manifest);
        if (customized) {
          return {
            content: [{
              type: "text",
              text: `Template "${templateName}" has local customizations. Use CLI to force update: crm-mcp templates pull ${nameArg} --force`
            }]
          };
        }
      }
      try {
        const destDir = join9(config.crmRoot, ".templates", templateName);
        await downloadTemplate(config.templateRepo, templateName, destDir, config.githubToken, category);
        const info = readTemplateInfo(destDir);
        const contentHash = computeContentHash(destDir);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existingEntry = manifest.templates[templateName];
        const existingCategories = existingEntry?.categories || [];
        manifest.templates[templateName] = {
          version: info?.version || "0.0.0",
          installedAt: existingEntry?.installedAt || now,
          updatedAt: now,
          source: "github",
          contentHash,
          ...category ? { categories: [.../* @__PURE__ */ new Set([...existingCategories, category])] } : {}
        };
        writeManifest(config.crmRoot, manifest);
        const files = countFiles(destDir);
        return respond(`Installed ${templateName}${category ? "/" + category : ""}: ${files} files written to .templates/${templateName}/`);
      } catch (e) {
        return respond(`Error: ${e.message}`);
      }
    }
  );
  return server;
}
async function startMcpServer(store, config) {
  const server = createMcpServer(store, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
async function startMcpServerUnconfigured(config) {
  const server = createMcpServer(null, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// src/cli.ts
var command = process.argv[2];
if (command === "mcp") {
  const config = loadConfig();
  if (config.crmRoot) {
    const store = createStore(config.dbPath, config.crmRoot);
    store.indexAll();
    await startMcpServer(store, config);
  } else {
    await startMcpServerUnconfigured(config);
  }
} else if (command === "reindex") {
  const config = loadConfig();
  const store = createStore(config.dbPath, config.crmRoot);
  store.indexAll();
  const stats = store.getStats();
  console.log(`Reindex complete: ${stats.totalContacts} contacts indexed.`);
  store.close();
} else if (command === "embed") {
  const { generateEmbeddings: generateEmbeddings2 } = await Promise.resolve().then(() => (init_embeddings(), embeddings_exports));
  const config = loadConfig();
  const store = createStore(config.dbPath, config.crmRoot);
  store.indexAll();
  console.log("Generating embeddings...");
  const result = await generateEmbeddings2(store, config);
  console.log(`Done: ${result.indexed} chunks indexed, ${result.skipped} sections skipped.`);
  store.close();
} else if (command === "benchmark-embed") {
  let formatDuration = function(secs) {
    if (secs < 60) return `${secs.toFixed(0)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };
  formatDuration2 = formatDuration;
  const { chunkText: chunkText2 } = await Promise.resolve().then(() => (init_embeddings(), embeddings_exports));
  const config = loadConfig();
  const store = createStore(config.dbPath, config.crmRoot);
  store.indexAll();
  const model = config.embeddingModel;
  console.log(`Model: ${model}`);
  console.log("Loading model...");
  const { pipeline } = await import("@huggingface/transformers");
  const isGemma = model.toLowerCase().includes("gemma");
  const t0 = Date.now();
  const pipe = await pipeline("feature-extraction", model, isGemma ? { dtype: "q8" } : {});
  const loadTime = (Date.now() - t0) / 1e3;
  console.log(`Model loaded in ${loadTime.toFixed(1)}s`);
  const rows = store.db.prepare("SELECT contact_id, section, cleaned_content FROM content_cache").all();
  let totalChunks = 0;
  let skipped = 0;
  for (const row of rows) {
    const content = row.cleaned_content?.trim();
    if (!content || content.length === 0) {
      skipped++;
      continue;
    }
    totalChunks += chunkText2(content).length;
  }
  console.log(`Content cache: ${rows.length} sections (${skipped} empty)`);
  console.log(`Total chunks: ${totalChunks}`);
  const sampleChunks = [];
  for (const row of rows) {
    const content = row.cleaned_content?.trim();
    if (!content) continue;
    const chunks = chunkText2(content);
    for (const c of chunks) {
      sampleChunks.push(c);
      if (sampleChunks.length >= 20) break;
    }
    if (sampleChunks.length >= 20) break;
  }
  console.log(`
Benchmarking ${sampleChunks.length} chunks...`);
  const t1 = Date.now();
  for (const c of sampleChunks) {
    await pipe(c, { pooling: "mean", normalize: true });
  }
  const elapsed = (Date.now() - t1) / 1e3;
  const perChunk = elapsed / sampleChunks.length;
  const totalEst = perChunk * totalChunks;
  console.log(`Speed: ${(perChunk * 1e3).toFixed(0)}ms/chunk`);
  console.log(`
Estimated full embed time: ${formatDuration(totalEst)}`);
  console.log(`  (${totalChunks} chunks \xD7 ${(perChunk * 1e3).toFixed(0)}ms + ${loadTime.toFixed(1)}s model load)`);
  store.close();
} else if (command === "init") {
  const { runInit: runInit2 } = await Promise.resolve().then(() => (init_init(), init_exports));
  await runInit2();
} else if (command === "templates") {
  await handleTemplatesCommand();
} else {
  console.log("Usage: crm-mcp <mcp|reindex|embed|benchmark-embed|init|templates>");
  console.log("");
  console.log("Commands:");
  console.log("  init                          Initialize a new CRM directory with templates");
  console.log("  mcp                           Start MCP server (stdio transport)");
  console.log("  reindex                       Re-scan and re-index all dossiers");
  console.log("  embed                         Generate vector embeddings for semantic search");
  console.log("  benchmark-embed               Benchmark embedding speed and estimate full embed time");
  console.log("  templates list                List local and remote templates");
  console.log("  templates pull <name>         Download template from GitHub");
  console.log("  templates update              Check and update installed templates");
  console.log("  templates info <name>         Show template details");
}
var formatDuration2;
async function handleTemplatesCommand() {
  const subcommand = process.argv[3];
  const config = loadConfig();
  if (!config.crmRoot) {
    console.error("CRM not initialized. Run: crm-mcp init");
    process.exit(1);
  }
  const {
    listLocalTemplates: listLocalTemplates2,
    ensureManifest: ensureManifest2,
    isCustomized: isCustomized2,
    readTemplateInfo: readTemplateInfo2,
    computeContentHash: computeContentHash2,
    countFiles: countFiles2,
    dirSize: dirSize2,
    installTemplate: installTemplate2
  } = await Promise.resolve().then(() => (init_templates(), templates_exports));
  const { listRemoteTemplates: listRemoteTemplates2, downloadTemplate: downloadTemplate2 } = await Promise.resolve().then(() => (init_github(), github_exports));
  if (subcommand === "list") {
    const local = listLocalTemplates2(config.crmRoot);
    console.log("");
    if (local.length > 0) {
      console.log("Local (.templates/):");
      for (const t of local) {
        const status = t.customized ? "(customized)" : "";
        const cats = t.categories ? ` [${t.categories.join(", ")}]` : "";
        console.log(`  ${t.name.padEnd(20)} v${t.version}  ${status}${cats}`);
      }
    } else {
      console.log("No templates installed locally.");
    }
    console.log("");
    try {
      const remote = await listRemoteTemplates2(config.templateRepo, config.crmRoot, config.githubToken);
      const localNames = new Set(local.map((t) => t.name));
      const available = remote.filter((r) => !localNames.has(r.name));
      if (available.length > 0) {
        console.log("Available on GitHub:");
        for (const r of available) {
          const cats = r.categories ? `  ${r.categories.length} categories` : "";
          console.log(`  ${r.name.padEnd(20)} v${r.version}  ${r.description}${cats}`);
          if (r.categories) {
            console.log(`    Categories: ${r.categories.join(", ")}`);
          }
        }
      } else {
        console.log("All available templates are installed locally.");
      }
    } catch (e) {
      console.log(`(Could not fetch remote templates: ${e.message})`);
    }
    console.log("");
  } else if (subcommand === "pull") {
    const nameArg = process.argv[4];
    const force = process.argv.includes("--force");
    if (!nameArg) {
      console.error("Usage: crm-mcp templates pull <name> [--force]");
      console.error("Examples:");
      console.error("  crm-mcp templates pull REAL_ESTATE");
      console.error("  crm-mcp templates pull REAL_ESTATE/A_BROKERAGE_SALES");
      process.exit(1);
    }
    const parts = nameArg.split("/");
    const templateName = parts[0];
    const category = parts[1] || void 0;
    const manifest = ensureManifest2(config.crmRoot);
    const existing = manifest.templates[templateName];
    if (existing && !force) {
      const customized = isCustomized2(config.crmRoot, templateName, manifest);
      if (customized) {
        console.error(`Template "${templateName}" has local customizations.`);
        console.error("Use --force to overwrite.");
        process.exit(1);
      }
    }
    console.log(`Pulling ${nameArg} from GitHub (${config.templateRepo})...`);
    const destDir = join11(config.crmRoot, ".templates", templateName);
    try {
      await downloadTemplate2(config.templateRepo, templateName, destDir, config.githubToken, category);
      const info = readTemplateInfo2(destDir);
      const contentHash = computeContentHash2(destDir);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existingEntry = manifest.templates[templateName];
      const existingCategories = existingEntry?.categories || [];
      manifest.templates[templateName] = {
        version: info?.version || "0.0.0",
        installedAt: existingEntry?.installedAt || now,
        updatedAt: now,
        source: "github",
        contentHash,
        ...category ? { categories: [.../* @__PURE__ */ new Set([...existingCategories, category])] } : {}
      };
      const { writeManifest: writeManifest2 } = await Promise.resolve().then(() => (init_templates(), templates_exports));
      writeManifest2(config.crmRoot, manifest);
      const files = countFiles2(destDir);
      console.log(`  Wrote ${files} files to .templates/${templateName}/`);
      console.log("  Updated .manifest.json");
      console.log("");
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  } else if (subcommand === "update") {
    const force = process.argv.includes("--force");
    const templateFlag = process.argv.indexOf("--template");
    const onlyTemplate = templateFlag >= 0 ? process.argv[templateFlag + 1] : void 0;
    const manifest = ensureManifest2(config.crmRoot);
    let remote;
    try {
      remote = await listRemoteTemplates2(config.templateRepo, config.crmRoot, config.githubToken);
    } catch (e) {
      console.error(`Could not fetch remote templates: ${e.message}`);
      process.exit(1);
    }
    const remoteMap = new Map(remote.map((r) => [r.name, r]));
    let updated = 0;
    let skipped = 0;
    console.log("");
    console.log("Checking for updates...");
    console.log("");
    for (const [name, entry] of Object.entries(manifest.templates)) {
      if (onlyTemplate && name !== onlyTemplate) continue;
      const upstream = remoteMap.get(name);
      if (!upstream) {
        console.log(`  ${name.padEnd(20)} (not found upstream \u2014 skipping)`);
        skipped++;
        continue;
      }
      if (upstream.version === entry.version) {
        const customized2 = isCustomized2(config.crmRoot, name, manifest);
        const suffix = customized2 ? "(customized)" : "";
        console.log(`  ${name.padEnd(20)} v${entry.version}  (up to date) ${suffix}`);
        continue;
      }
      const customized = isCustomized2(config.crmRoot, name, manifest);
      if (customized && !force) {
        console.log(`  ${name.padEnd(20)} v${entry.version} \u2192 v${upstream.version}  CUSTOMIZED \u2014 skipped (use --force)`);
        skipped++;
        continue;
      }
      if (customized && force) {
        console.log(`  ${name.padEnd(20)} v${entry.version} \u2192 v${upstream.version}  (customized, --force overwriting)`);
      } else {
        console.log(`  ${name.padEnd(20)} v${entry.version} \u2192 v${upstream.version}  \u2192 updating`);
      }
      const destDir = join11(config.crmRoot, ".templates", name);
      try {
        await downloadTemplate2(config.templateRepo, name, destDir, config.githubToken);
        const info = readTemplateInfo2(destDir);
        const contentHash = computeContentHash2(destDir);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        manifest.templates[name] = {
          ...entry,
          version: info?.version || upstream.version,
          updatedAt: now,
          contentHash,
          source: "github"
        };
        updated++;
      } catch (e) {
        console.error(`    Error updating ${name}: ${e.message}`);
        skipped++;
      }
    }
    const { writeManifest: writeManifest2 } = await Promise.resolve().then(() => (init_templates(), templates_exports));
    writeManifest2(config.crmRoot, manifest);
    console.log("");
    console.log(`Updated ${updated} template(s).${skipped > 0 ? ` ${skipped} skipped.` : ""}`);
    console.log("");
  } else if (subcommand === "info") {
    const nameArg = process.argv[4];
    if (!nameArg) {
      console.error("Usage: crm-mcp templates info <name>");
      process.exit(1);
    }
    const manifest = ensureManifest2(config.crmRoot);
    const entry = manifest.templates[nameArg];
    const tmplDir = join11(config.crmRoot, ".templates", nameArg);
    if (!entry || !existsSync11(tmplDir)) {
      try {
        const remote = await listRemoteTemplates2(config.templateRepo, config.crmRoot, config.githubToken);
        const r = remote.find((t) => t.name === nameArg);
        if (r) {
          console.log("");
          console.log(`${r.name} v${r.version} (not installed)`);
          console.log(`  Description: ${r.description}`);
          if (r.categories) {
            console.log(`  Categories: ${r.categories.join(", ")}`);
          }
          console.log(`  Install: crm-mcp templates pull ${nameArg}`);
          console.log("");
        } else {
          console.error(`Template "${nameArg}" not found locally or remotely.`);
        }
      } catch {
        console.error(`Template "${nameArg}" not found locally.`);
      }
      return;
    }
    const info = readTemplateInfo2(tmplDir);
    const customized = isCustomized2(config.crmRoot, nameArg, manifest);
    const files = countFiles2(tmplDir);
    const size = dirSize2(tmplDir);
    const sizeMb = (size / 1024 / 1024).toFixed(1);
    console.log("");
    console.log(`${nameArg} v${entry.version}`);
    console.log(`  Description: ${info?.description || "-"}`);
    console.log(`  Source:      ${entry.source}`);
    console.log(`  Installed:   ${entry.installedAt.split("T")[0]}`);
    console.log(`  Updated:     ${entry.updatedAt.split("T")[0]}`);
    console.log(`  Customized:  ${customized ? "yes" : "no"}`);
    console.log(`  Files:       ${files}`);
    console.log(`  Size:        ${sizeMb}MB`);
    if (entry.categories) {
      console.log(`  Installed categories: ${entry.categories.join(", ")}`);
    }
    console.log("");
  } else {
    console.log("Usage: crm-mcp templates <list|pull|update|info>");
    console.log("");
    console.log("Commands:");
    console.log("  list                List local and remote templates");
    console.log("  pull <name>         Download template from GitHub");
    console.log("  update              Check and update installed templates");
    console.log("  info <name>         Show template details");
  }
}
//# sourceMappingURL=cli.mjs.map
