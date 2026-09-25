import { openDatabase, type Database } from './db.js';
import {
  parseDossierIndex,
  stripBoilerplate,
  scanDossierSections,
} from './parser.js';
import {
  FILE_TO_SECTION,
  resolveSection,
  type Contact,
  type SectionMeta,
  type Relationship,
  type SearchResult,
} from './types.js';
import fg from 'fast-glob';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { AUTO_WORKS_AT_CONTEXT, ORG_ROLES, ORG_GROUPS, ORG_GROUP_KEYS, type OrgGroup } from './orgTypes.js';
import { collectMdFiles, isWithin, sha256 } from './fsutil.js';

export interface SectionContent {
  contactId: string;
  section: string;
  content: string;
  fileHash: string;
}

export interface StoredEmbedding {
  contactId: string;
  contactName: string;
  section: string;
  chunkText: string;
  embedding: Buffer;
  /** True when the section changed (or vanished) since the embedding was generated. */
  stale: boolean;
}

export interface NewEmbedding {
  contactId: string;
  section: string;
  chunkIndex: number;
  chunkText: string;
  embedding: Buffer;
  fileHash: string;
}

export interface Store {
  /** Raw database handle — exposed for tests and diagnostics only; src/ modules use Store methods. */
  db: Database;
  crmRoot: string;
  indexAll(): void;
  indexOne(dossierRelPath: string): void;
  /**
   * Reindex several dossiers in one transaction with a single relationship-resolution
   * pass. A dossier that fails to parse/index is skipped (its old rows are kept) and
   * reported; the rest still commit.
   */
  indexMany(dossierRelPaths: string[]): { failed: Array<{ path: string; message: string }> };
  /** Refresh the cache and FTS rows for one section after its file was written. */
  reindexSection(contactId: string, section: string): void;
  searchContacts(filters: {
    query?: string;
    category?: string;
    status?: string;
    profession?: string;
    roles?: string[];
    orgType?: string;
    orgGroup?: string;
    limit?: number;
  }): SearchResult[];
  /** Contact ids whose name or alias equals `input` (case-insensitive, exact). */
  findByExactName(input: string): string[];
  fullTextSearch(
    query: string,
    limit?: number,
  ): Array<SearchResult & { section: string; snippet: string }>;
  getOutline(contactId: string): { contact: Contact; sections: SectionMeta[] };
  getSection(contactId: string, section: string): string;
  getConnections(contactId: string, depth?: number): Relationship[];
  getContactNames(ids: string[]): Map<string, string>;
  getRecent(limit?: number, category?: string): SearchResult[];
  getStats(): {
    totalContacts: number;
    byCategory: Record<string, number>;
    staleContacts: number;
    avgFillPercent: number;
  };
  getProfessionCounts(): Array<{ profession: string; count: number }>;
  getContactPath(contactId: string): string | null;
  resolveByPath(input: string): string | null;
  /** Every contact whose folder basename equals the input's basename. */
  resolveAllByPath(input: string): string[];
  saveAudit(contactId: string, auditJson: string, dossierHash: string): void;
  loadAudit(contactId: string): { auditJson: string; dossierHash: string | null } | null;
  clearAudit(contactId: string): void;
  getSectionContents(): SectionContent[];
  getEmbeddingModel(): string | null;
  replaceEmbeddings(model: string, rows: NewEmbedding[]): void;
  getEmbeddings(): StoredEmbedding[];
  close(): void;
}

function initSchema(db: Database): void {
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

    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY,
      contact_id TEXT,
      section TEXT,
      chunk_index INTEGER,
      chunk_text TEXT,
      embedding BLOB,
      UNIQUE(contact_id, section, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Idempotent column migrations — ALTER fails harmlessly when the column exists.
  for (const ddl of [
    'ALTER TABLE contacts ADD COLUMN profession TEXT',
    'ALTER TABLE contacts ADD COLUMN aliases TEXT',
    'ALTER TABLE content_cache ADD COLUMN raw_bytes INTEGER',
    'ALTER TABLE audit_cache ADD COLUMN dossier_hash TEXT',
    'ALTER TABLE embeddings ADD COLUMN file_hash TEXT',
  ]) {
    try {
      db.exec(ddl);
    } catch {
      // Column already exists
    }
  }
}

/**
 * Sanitize FTS5 query — escape special characters that FTS5 would interpret as operators.
 * Wraps each word in double quotes to treat them as literal terms.
 */
function sanitizeFtsQuery(query: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '""';
  return words.map((w) => `"${w.replace(/"/g, '""')}"`).join(' ');
}

type CacheEntry = { hash: string; cleaned: string };

/**
 * Bump when stripBoilerplate's output changes. It salts the content hash so
 * cleaned text cached under an older cleaner is never reused (the cache
 * persists across upgrades in ~/.crm-mcp/crm.db).
 */
const CLEANER_VERSION = '1';

function contentHash(raw: string): string {
  return sha256(`${CLEANER_VERSION}\0${raw}`);
}

export function createStore(dbPath: string, crmRoot: string): Store {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  initSchema(db);

  const stmts = {
    insertContact: db.prepare(`
      INSERT OR REPLACE INTO contacts (id, name, category, organization, status, last_contact, last_updated, path, metadata_json, profession, aliases)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertRelationship: db.prepare(`
      INSERT OR REPLACE INTO relationships (source_id, target_id, target_name, type, context, bidirectional)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertRelationshipIfAbsent: db.prepare(`
      INSERT OR IGNORE INTO relationships (source_id, target_id, target_name, type, context, bidirectional)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertContentCache: db.prepare(`
      INSERT OR REPLACE INTO content_cache (contact_id, section, file_hash, cleaned_content, cleaned_at, raw_bytes)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertContentFts: db.prepare(
      'INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)',
    ),
    deleteSectionFts: db.prepare('DELETE FROM content_fts WHERE contact_id = ? AND section = ?'),
    deleteSectionCache: db.prepare('DELETE FROM content_cache WHERE contact_id = ? AND section = ?'),
    getContact: db.prepare('SELECT * FROM contacts WHERE id = ?'),
    getContactPath: db.prepare('SELECT path FROM contacts WHERE id = ?'),
    getContactName: db.prepare('SELECT name FROM contacts WHERE id = ?'),
    getContentCache: db.prepare(
      'SELECT * FROM content_cache WHERE contact_id = ? AND section = ?',
    ),
    getRelationships: db.prepare(
      'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?',
    ),
  };

  function loadCache(contactId?: string): Map<string, CacheEntry> {
    const rows = (contactId
      ? db.prepare('SELECT contact_id, section, file_hash, cleaned_content FROM content_cache WHERE contact_id = ?').all(contactId)
      : db.prepare('SELECT contact_id, section, file_hash, cleaned_content FROM content_cache').all()) as any[];
    return new Map(rows.map(r => [`${r.contact_id}\0${r.section}`, { hash: r.file_hash, cleaned: r.cleaned_content }]));
  }

  /** Write cache + FTS rows for one section file, reusing the cleaned text when the hash is unchanged. */
  function writeSectionRows(contactId: string, sectionKey: string, raw: string, prior?: CacheEntry): void {
    const hash = contentHash(raw);
    const cleaned = prior && prior.hash === hash ? prior.cleaned : stripBoilerplate(raw);
    stmts.insertContentFts.run(contactId, sectionKey, cleaned);
    stmts.insertContentCache.run(contactId, sectionKey, hash, cleaned, new Date().toISOString(), Buffer.byteLength(raw, 'utf-8'));
  }

  /**
   * Index a single dossier by its relative path (e.g., "Network/DOE_John").
   * Inserts contact, relationships, and every .md section into the database.
   * `priorCache` supplies previously cleaned content keyed by contact+section.
   */
  function indexDossier(
    dossierRelPath: string,
    priorCache: Map<string, CacheEntry>,
    parsed?: ReturnType<typeof parseDossierIndex>,
  ): void {
    const dossierPath = join(crmRoot, dossierRelPath);
    const { contact, relationships } = parsed ?? parseDossierIndex(dossierPath);
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
      contact.aliases ?? null,
    );

    for (const rel of relationships) {
      stmts.insertRelationship.run(
        rel.sourceId,
        rel.targetId,
        rel.targetName,
        rel.type,
        rel.context,
        rel.bidirectional ? 1 : 0,
      );
    }

    // Every .md file — standard sections keyed by their short name, custom
    // and profession-specific files by relative path without .md.
    for (const relPath of collectMdFiles(dossierPath)) {
      const posix = relPath.split('\\').join('/');
      const sectionKey = FILE_TO_SECTION[posix] ?? sectionKeyForFile(posix);
      const raw = readFileSync(join(dossierPath, relPath), 'utf-8');
      writeSectionRows(contact.id, sectionKey, raw, priorCache.get(`${contact.id}\0${sectionKey}`));
    }
  }

  function deleteContactRows(contactId: string): void {
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
    db.prepare('DELETE FROM relationships WHERE source_id = ?').run(contactId);
    db.prepare('DELETE FROM content_fts WHERE contact_id = ?').run(contactId);
    db.prepare('DELETE FROM content_cache WHERE contact_id = ?').run(contactId);
  }

  /**
   * Resolve relationships.target_id from target_name (dossier code, name, or alias —
   * case-insensitive, unique matches only) and re-derive person→org `works_at` edges
   * from each person's `organization` field.
   */
  function resolveRelationshipTargets(): void {
    db.prepare('DELETE FROM relationships WHERE context = ?').run(AUTO_WORKS_AT_CONTEXT);

    const contacts = db.prepare(
      'SELECT id, name, aliases, category, organization FROM contacts',
    ).all() as Array<{ id: string; name: string; aliases: string | null; category: string; organization: string | null }>;

    const buildIndex = (rows: typeof contacts, includeIds: boolean): Map<string, Set<string>> => {
      const map = new Map<string, Set<string>>();
      const add = (key: string, id: string) => {
        const k = key.trim().toLowerCase();
        if (!k) return;
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(id);
      };
      for (const c of rows) {
        if (includeIds) add(c.id, c.id);
        add(c.name, c.id);
        for (const a of parseAliases(c.aliases)) add(a, c.id);
      }
      return map;
    };
    const unique = (map: Map<string, Set<string>>, key: string): string => {
      const ids = map.get(key.trim().toLowerCase());
      return ids && ids.size === 1 ? [...ids][0] : '';
    };

    const all = buildIndex(contacts, true);
    const update = db.prepare('UPDATE relationships SET target_id = ? WHERE rowid = ? AND target_id IS NOT ?');
    for (const row of db.prepare('SELECT rowid, target_name FROM relationships').all() as any[]) {
      const resolved = unique(all, row.target_name);
      update.run(resolved, row.rowid, resolved);
    }

    const orgs = contacts.filter(c => c.category === 'Organization');
    const orgIndex = buildIndex(orgs, false);
    const orgName = new Map(orgs.map(o => [o.id, o.name]));
    // At this point every remaining `works_at` row is hand-authored (the auto
    // rows were deleted above) and its target_id was just resolved by the
    // loop above — use it to avoid inserting a duplicate auto edge to the
    // same org even when the manual row names the org by code or alias
    // rather than by the exact `organization` field string.
    const hasManualWorksAt = db.prepare(
      "SELECT 1 FROM relationships WHERE source_id = ? AND type = 'works_at' AND target_id = ? LIMIT 1",
    );
    for (const c of contacts) {
      if (c.category === 'Organization' || !c.organization) continue;
      const orgId = unique(orgIndex, c.organization);
      if (!orgId) continue;
      if (hasManualWorksAt.get(c.id, orgId)) continue;
      stmts.insertRelationshipIfAbsent.run(c.id, orgId, orgName.get(orgId)!, 'works_at', AUTO_WORKS_AT_CONTEXT, 0);
    }
  }

  function toSearchResult(row: any): SearchResult {
    const result: SearchResult = {
      id: row.id,
      name: row.name,
      category: row.category,
      organization: row.organization,
      status: row.status,
      lastContact: row.last_contact,
      path: row.path,
    };
    if (row.category === 'Organization' && row.metadata_json) {
      try {
        const meta = JSON.parse(row.metadata_json);
        if (meta.orgType) result.orgType = String(meta.orgType);
        if (Array.isArray(meta.roles)) result.roles = meta.roles.map(String);
        if (Array.isArray(meta.secondaryTypes)) result.secondaryTypes = meta.secondaryTypes.map(String);
      } catch { /* ignore malformed metadata */ }
    }
    return result;
  }

  /**
   * Reindex the given dossiers (removing rows for any whose INDEX.md is gone).
   * With `tolerant`, a dossier that fails is rolled back to its savepoint
   * (old rows kept) and reported; otherwise the first failure throws and the
   * whole batch rolls back.
   */
  function reindexPaths(dossierRelPaths: string[], tolerant: boolean): Array<{ path: string; message: string }> {
    const failed: Array<{ path: string; message: string }> = [];
    // Parse every INDEX.md before opening the transaction (avoids holding the
    // write lock during I/O). A dossier whose INDEX.md is gone is removed.
    const parsedByPath: Array<{ relPath: string; parsed: ReturnType<typeof parseDossierIndex> | null }> = [];
    for (const relPath of dossierRelPaths) {
      const dossierPath = join(crmRoot, relPath);
      try {
        parsedByPath.push({
          relPath,
          parsed: existsSync(join(dossierPath, 'INDEX.md')) ? parseDossierIndex(dossierPath) : null,
        });
      } catch (err: any) {
        if (!tolerant) throw err;
        failed.push({ path: relPath, message: err.message });
      }
    }
    const run = db.transaction(() => {
      for (const { relPath, parsed } of parsedByPath) {
        db.exec('SAVEPOINT dossier');
        try {
          // Rows are keyed by id, but the id may have changed on disk — clear
          // both the row(s) stored under this path and the new id. The prior
          // cache lets unchanged sections skip stripBoilerplate.
          const prior = new Map<string, CacheEntry>();
          const oldIds = (db.prepare('SELECT id FROM contacts WHERE path = ?').all(relPath) as any[]).map(r => r.id);
          const newId = parsed?.contact.id ?? '';
          for (const id of new Set([...oldIds, newId].filter(Boolean))) {
            for (const [k, v] of loadCache(id)) prior.set(k, v);
            deleteContactRows(id);
          }
          if (parsed && newId) indexDossier(relPath, prior, parsed);
          db.exec('RELEASE dossier');
        } catch (err: any) {
          db.exec('ROLLBACK TO dossier');
          db.exec('RELEASE dossier');
          if (!tolerant) throw err;
          failed.push({ path: relPath, message: err.message });
        }
      }
      resolveRelationshipTargets();
    });
    run();
    return failed;
  }

  const store: Store = {
    db,
    crmRoot,

    indexAll(): void {
      // Scan filesystem before opening the transaction (avoids holding write lock during I/O)
      const indexFiles = fg.sync('*/*/INDEX.md', { cwd: crmRoot });
      const prior = loadCache();

      // Wrap all deletes and inserts in a single transaction for 10-50x speedup.
      // Without this, each insert is its own implicit transaction — with 100+ contacts
      // and 600+ files, startup blocked the MCP handshake past Claude Code's timeout.
      const runIndex = db.transaction(() => {
        db.exec('DELETE FROM contacts');
        db.exec('DELETE FROM relationships');
        db.exec('DELETE FROM content_fts');
        db.exec('DELETE FROM content_cache');

        for (const relPath of indexFiles) {
          // Savepoint per dossier: a failure part-way through one dossier
          // rolls back only its rows, never leaving it half-indexed.
          db.exec('SAVEPOINT dossier');
          try {
            indexDossier(dirname(relPath), prior);
            db.exec('RELEASE dossier');
          } catch (err) {
            db.exec('ROLLBACK TO dossier');
            db.exec('RELEASE dossier');
            console.error(`Failed to index ${relPath}:`, err);
          }
        }

        resolveRelationshipTargets();
      });

      runIndex();
    },

    indexOne(dossierRelPath: string): void {
      reindexPaths([dossierRelPath], false);
    },

    indexMany(dossierRelPaths: string[]) {
      return { failed: reindexPaths(dossierRelPaths, true) };
    },

    reindexSection(contactId: string, section: string): void {
      const path = store.getContactPath(contactId);
      if (!path) throw new Error(`Contact not found: ${contactId}`);
      const { key, file } = resolveSection(section);
      const filePath = join(crmRoot, path, file);
      const run = db.transaction(() => {
        stmts.deleteSectionFts.run(contactId, key);
        stmts.deleteSectionCache.run(contactId, key);
        if (existsSync(filePath)) writeSectionRows(contactId, key, readFileSync(filePath, 'utf-8'));
      });
      run();
    },

    searchContacts(filters): SearchResult[] {
      const { query, category, status, profession, roles, orgType, orgGroup, limit = 20 } = filters;

      const normalizedRoles = (roles ?? []).map((role) => {
        const canonical = (ORG_ROLES as readonly string[]).find(
          (r) => r.toLowerCase() === role.trim().toLowerCase(),
        );
        if (!canonical) throw new Error(`Invalid role(s): ${role}. Valid: ${ORG_ROLES.join(', ')}`);
        return canonical;
      });
      let groupCodes: string[] = [];
      if (orgGroup) {
        const key = orgGroup.trim().toUpperCase();
        if (!Object.hasOwn(ORG_GROUPS, key)) {
          throw new Error(`Invalid org group: ${orgGroup}. Valid: ${ORG_GROUP_KEYS.join(', ')}`);
        }
        groupCodes = Object.keys(ORG_GROUPS[key as OrgGroup].types);
      }

      /** Structured filters for a contacts alias (`contacts` or `c`). */
      const filterSql = (t: string): { sql: string[]; params: any[] } => {
        const sql: string[] = [];
        const params: any[] = [];
        const anyType = (codesSql: string) =>
          `(json_extract(${t}.metadata_json, '$.orgType') ${codesSql}` +
          ` OR EXISTS (SELECT 1 FROM json_each(${t}.metadata_json, '$.secondaryTypes') WHERE value ${codesSql}))`;
        if (category) { sql.push(`${t}.category = ?`); params.push(category); }
        if (status) { sql.push(`${t}.status = ?`); params.push(status); }
        if (profession) { sql.push(`${t}.profession = ?`); params.push(profession); }
        if (orgType) {
          const code = orgType.trim().toUpperCase();
          sql.push(anyType('= ?')); params.push(code, code);
        }
        if (groupCodes.length > 0) {
          const inList = `IN (${groupCodes.map(() => '?').join(', ')})`;
          sql.push(anyType(inList)); params.push(...groupCodes, ...groupCodes);
        }
        for (const role of normalizedRoles) {
          sql.push(`EXISTS (SELECT 1 FROM json_each(${t}.metadata_json, '$.roles') WHERE value = ?)`);
          params.push(role);
        }
        return { sql, params };
      };

      const base = filterSql('contacts');
      const conditions = [...base.sql];
      const params: any[] = [];
      if (query) {
        // Escape LIKE wildcards so '_' and '%' in the query match literally.
        // Folder-style inputs like "SMITH_Bobby" contain '_', which SQLite LIKE
        // otherwise treats as a single-char wildcard.
        const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
        conditions.unshift("(name LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\')");
        params.push(`%${escaped}%`, `%${escaped}%`);
      }
      params.push(...base.params);

      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      const rows = db.prepare(
        `SELECT id, name, category, organization, status, last_contact, path, metadata_json FROM contacts ${where} ORDER BY name LIMIT ?`,
      ).all(...params, limit);
      let results = rows.map(toSearchResult);

      // If query provided and no name matches, fall back to FTS
      if (query && results.length === 0) {
        const fts = filterSql('c');
        const ftsRows = db.prepare(`
          SELECT DISTINCT c.id, c.name, c.category, c.organization, c.status, c.last_contact, c.path, c.metadata_json
          FROM content_fts f
          JOIN contacts c ON c.id = f.contact_id
          WHERE content_fts MATCH ?
          ${fts.sql.map((s) => `AND ${s}`).join('\n')}
          ORDER BY rank
          LIMIT ?
        `).all(sanitizeFtsQuery(query), ...fts.params, limit);
        results = ftsRows.map(toSearchResult);
      }

      return results;
    },

    findByExactName(input: string): string[] {
      const needle = input.trim().toLowerCase();
      if (!needle) return [];
      const rows = db.prepare('SELECT id, name, aliases FROM contacts').all() as any[];
      return rows
        .filter(r => String(r.name).trim().toLowerCase() === needle
          || parseAliases(r.aliases).some(a => a.trim().toLowerCase() === needle))
        .map(r => r.id);
    },

    fullTextSearch(
      query: string,
      limit = 20,
    ): Array<SearchResult & { section: string; snippet: string }> {
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
      return rows.map((row: any) => ({
        id: row.contact_id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
        section: row.section,
        snippet: row.snippet,
        score: row.rank,
      }));
    },

    getOutline(
      contactId: string,
    ): { contact: Contact; sections: SectionMeta[] } {
      const row = stmts.getContact.get(contactId) as any;
      if (!row) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      const contact: Contact = {
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
        lastUpdated: row.last_updated,
        path: row.path,
        metadataJson: row.metadata_json,
        profession: row.profession ?? undefined,
        aliases: row.aliases ?? undefined,
      };

      // Get fresh section metadata from filesystem
      const dossierPath = join(crmRoot, contact.path);
      const sections = scanDossierSections(dossierPath);

      return { contact, sections };
    },

    getSection(contactId: string, section: string): string {
      const row = stmts.getContactPath.get(contactId) as any;
      if (!row) {
        throw new Error(`Contact not found: ${contactId}`);
      }

      const { key, file } = resolveSection(section);
      const dossierDir = join(crmRoot, row.path);
      const filePath = join(dossierDir, file);
      if (!isWithin(dossierDir, filePath)) {
        throw new Error(`Invalid section: "${section}"`);
      }
      if (!existsSync(filePath)) {
        return '';
      }

      const raw = readFileSync(filePath, 'utf-8');
      const cached = stmts.getContentCache.get(contactId, key) as any;
      if (cached && cached.file_hash === contentHash(raw)) {
        return cached.cleaned_content;
      }

      // Cache miss — strip and refresh both cache and FTS for this section
      const run = db.transaction(() => {
        stmts.deleteSectionFts.run(contactId, key);
        writeSectionRows(contactId, key, raw);
      });
      run();
      return (stmts.getContentCache.get(contactId, key) as any).cleaned_content;
    },

    getConnections(contactId: string, depth = 1): Relationship[] {
      const visited = new Set<string>();
      const seenEdges = new Set<string>();
      const result: Relationship[] = [];

      const queue: { id: string; currentDepth: number }[] = [
        { id: contactId, currentDepth: 0 },
      ];

      while (queue.length > 0) {
        const { id, currentDepth } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        if (currentDepth >= depth) continue;

        const rows = stmts.getRelationships.all(id, id) as any[];
        for (const row of rows) {
          const rel: Relationship = {
            sourceId: row.source_id,
            targetId: row.target_id,
            targetName: row.target_name,
            type: row.type,
            context: row.context,
            bidirectional: row.bidirectional === 1,
          };

          const key = `${rel.sourceId}\0${rel.targetName}\0${rel.type}`;
          if (!seenEdges.has(key)) {
            seenEdges.add(key);
            result.push(rel);
          }

          // For BFS: queue the other end of the relationship
          const otherId =
            rel.sourceId === id ? rel.targetId : rel.sourceId;
          if (otherId && !visited.has(otherId)) {
            queue.push({ id: otherId, currentDepth: currentDepth + 1 });
          }
        }
      }

      return result;
    },

    getContactNames(ids: string[]): Map<string, string> {
      const names = new Map<string, string>();
      for (const id of new Set(ids)) {
        const row = stmts.getContactName.get(id) as any;
        if (row) names.set(id, row.name);
      }
      return names;
    },

    getRecent(limit = 10, category?: string): SearchResult[] {
      let sql =
        'SELECT id, name, category, organization, status, last_contact FROM contacts';
      const params: any[] = [];

      if (category) {
        sql += ' WHERE category = ?';
        params.push(category);
      }

      sql += ' ORDER BY last_contact DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(sql).all(...params);
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
      }));
    },

    getStats() {
      const totalContacts = (db
        .prepare('SELECT COUNT(*) as count FROM contacts')
        .get() as any).count;

      const byCategory: Record<string, number> = {};
      for (const row of db
        .prepare('SELECT category, COUNT(*) as count FROM contacts GROUP BY category')
        .all() as any[]) {
        byCategory[row.category] = row.count;
      }

      // Stale = last_contact is NULL or > 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const staleDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const staleContacts = (db
        .prepare('SELECT COUNT(*) as count FROM contacts WHERE last_contact IS NULL OR last_contact < ?')
        .get(staleDate) as any).count;

      // Average fill percent: cleaned bytes / raw bytes per section, from the
      // cache populated at index time (no filesystem reads).
      let totalFill = 0;
      let fileCount = 0;
      for (const row of db
        .prepare('SELECT cleaned_content, raw_bytes FROM content_cache WHERE raw_bytes > 0')
        .all() as any[]) {
        const cleanedSize = Buffer.byteLength(row.cleaned_content ?? '', 'utf-8');
        totalFill += Math.round((cleanedSize / row.raw_bytes) * 100);
        fileCount++;
      }
      const avgFillPercent = fileCount > 0 ? Math.round(totalFill / fileCount) : 0;

      return { totalContacts, byCategory, staleContacts, avgFillPercent };
    },

    getProfessionCounts(): Array<{ profession: string; count: number }> {
      return db.prepare(
        'SELECT profession, COUNT(*) as count FROM contacts WHERE profession IS NOT NULL GROUP BY profession',
      ).all() as Array<{ profession: string; count: number }>;
    },

    getContactPath(contactId: string): string | null {
      const row = stmts.getContactPath.get(contactId) as any;
      return row ? row.path : null;
    },

    resolveAllByPath(input: string): string[] {
      const slug = input.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
      if (!slug) return [];
      return (db.prepare('SELECT id, path FROM contacts').all() as any[])
        .filter((r) => r.path && r.path.split(/[\\/]/).pop() === slug)
        .map((r) => r.id);
    },

    resolveByPath(input: string): string | null {
      // Resolve a dossier folder name (LASTNAME_Firstname convention) or full
      // folder path to a contact id by EXACT basename match. Exact string
      // compare avoids the SQLite LIKE wildcard hazard ('_'/'%') entirely.
      const slug = input.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
      if (!slug) return null;
      const rows = db.prepare('SELECT id, path FROM contacts').all() as any[];
      const hit = rows.find(
        (r) => r.path && r.path.split(/[\\/]/).pop() === slug,
      );
      return hit ? hit.id : null;
    },

    saveAudit(contactId: string, auditJson: string, dossierHash: string): void {
      db.prepare('INSERT OR REPLACE INTO audit_cache (contact_id, audit_json, created_at, dossier_hash) VALUES (?, ?, ?, ?)')
        .run(contactId, auditJson, new Date().toISOString(), dossierHash);
    },

    loadAudit(contactId: string): { auditJson: string; dossierHash: string | null } | null {
      const row = db.prepare('SELECT audit_json, dossier_hash FROM audit_cache WHERE contact_id = ?').get(contactId) as any;
      return row ? { auditJson: row.audit_json, dossierHash: row.dossier_hash ?? null } : null;
    },

    clearAudit(contactId: string): void {
      db.prepare('DELETE FROM audit_cache WHERE contact_id = ?').run(contactId);
    },

    getSectionContents(): SectionContent[] {
      return (db.prepare('SELECT contact_id, section, cleaned_content, file_hash FROM content_cache').all() as any[])
        .map(r => ({ contactId: r.contact_id, section: r.section, content: r.cleaned_content ?? '', fileHash: r.file_hash }));
    },

    getEmbeddingModel(): string | null {
      const row = db.prepare("SELECT value FROM meta WHERE key = 'embedding_model'").get() as any;
      return row ? row.value : null;
    },

    replaceEmbeddings(model: string, rows: NewEmbedding[]): void {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO embeddings (contact_id, section, chunk_index, chunk_text, embedding, file_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const run = db.transaction(() => {
        db.exec('DELETE FROM embeddings');
        for (const r of rows) insert.run(r.contactId, r.section, r.chunkIndex, r.chunkText, r.embedding, r.fileHash);
        db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('embedding_model', ?)").run(model);
      });
      run();
    },

    getEmbeddings(): StoredEmbedding[] {
      return (db.prepare(`
        SELECT e.contact_id, e.section, e.chunk_text, e.embedding, e.file_hash, c.name AS contact_name,
               cc.file_hash AS current_hash
        FROM embeddings e
        JOIN contacts c ON c.id = e.contact_id
        LEFT JOIN content_cache cc ON cc.contact_id = e.contact_id AND cc.section = e.section
      `).all() as any[]).map(r => ({
        contactId: r.contact_id,
        contactName: r.contact_name,
        section: r.section,
        chunkText: r.chunk_text,
        embedding: Buffer.from(r.embedding),
        stale: r.current_hash == null || r.file_hash !== r.current_hash,
      }));
    },

    close(): void {
      db.close();
    },
  };

  return store;
}

/**
 * Section key for a file found on disk. Odd names that resolveSection
 * rejects as input (e.g. "..md") are still indexed under their plain
 * relative path, so one strange file never breaks indexing of a dossier.
 */
function sectionKeyForFile(posixRelPath: string): string {
  try {
    return resolveSection(posixRelPath).key;
  } catch {
    return posixRelPath.replace(/\.md$/, '');
  }
}

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
