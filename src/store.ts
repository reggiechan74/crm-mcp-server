import { openDatabase, loadSqliteVec, type Database } from './db.js';
import {
  parseIndexYaml,
  stripBoilerplate,
  scanDossierSections,
  extractRelationships,
  collectMdFiles,
} from './parser.js';
import {
  SECTION_FILES,
  resolveSectionFile,
  type Contact,
  type SectionMeta,
  type Relationship,
  type SearchResult,
} from './types.js';
import fg from 'fast-glob';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';

export interface Store {
  db: Database;
  crmRoot: string;
  indexAll(): void;
  indexOne(dossierRelPath: string): void;
  searchContacts(filters: {
    query?: string;
    category?: string;
    status?: string;
    profession?: string;
    limit?: number;
  }): SearchResult[];
  fullTextSearch(
    query: string,
    limit?: number,
  ): Array<SearchResult & { section: string; snippet: string }>;
  getOutline(contactId: string): { contact: Contact; sections: SectionMeta[] };
  getSection(contactId: string, section: string): string;
  getConnections(contactId: string, depth?: number): Relationship[];
  getRecent(limit?: number, category?: string): SearchResult[];
  getStats(): {
    totalContacts: number;
    byCategory: Record<string, number>;
    staleContacts: number;
    avgFillPercent: number;
  };
  getContactPath(contactId: string): string | null;
  close(): void;
}

function fileHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
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
  `);

  // Migration: add profession column (idempotent)
  try {
    db.exec('ALTER TABLE contacts ADD COLUMN profession TEXT');
  } catch {
    // Column already exists — safe to ignore
  }

  // Migration: add aliases column (idempotent)
  try {
    db.exec('ALTER TABLE contacts ADD COLUMN aliases TEXT');
  } catch {
    // Column already exists — safe to ignore
  }
}

/**
 * Sanitize FTS5 query — escape special characters that FTS5 would interpret as operators.
 * Wraps each word in double quotes to treat them as literal terms.
 */
function sanitizeFtsQuery(query: string): string {
  // Split into words and wrap each in quotes to avoid FTS5 syntax errors
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '""';
  return words.map((w) => `"${w.replace(/"/g, '""')}"`).join(' ');
}

export function createStore(dbPath: string, crmRoot: string): Store {
  // Ensure DB directory exists
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  initSchema(db);

  // Try to load sqlite-vec (non-critical)
  loadSqliteVec(db);

  // Prepared statements (created lazily to avoid issues with virtual tables)
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
    getContact: db.prepare('SELECT * FROM contacts WHERE id = ?'),
    getContactPath: db.prepare('SELECT path FROM contacts WHERE id = ?'),
    getContentCache: db.prepare(
      'SELECT * FROM content_cache WHERE contact_id = ? AND section = ?',
    ),
    getAllContentCache: db.prepare(
      'SELECT * FROM content_cache WHERE contact_id = ?',
    ),
    getRelationships: db.prepare(
      'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?',
    ),
  };

  /**
   * Index a single dossier by its relative path (e.g., "Network/DOE_John").
   * Inserts contact, relationships, and content into the database.
   */
  function indexDossier(dossierRelPath: string): void {
    const dossierPath = join(crmRoot, dossierRelPath);

    const contact = parseIndexYaml(dossierPath);
    if (!contact.id) return;

    // Insert contact
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

    // Extract and insert relationships
    const rels = extractRelationships(dossierPath, contact.id);
    for (const rel of rels) {
      stmts.insertRelationship.run(
        rel.sourceId,
        rel.targetId,
        rel.targetName,
        rel.type,
        rel.context,
        rel.bidirectional ? 1 : 0,
      );
    }

    // Index known section content
    for (const [sectionKey, sectionFile] of Object.entries(SECTION_FILES)) {
      const filePath = join(dossierPath, sectionFile);
      if (!existsSync(filePath)) continue;

      const raw = readFileSync(filePath, 'utf-8');
      const hash = createHash('sha256').update(raw).digest('hex');
      const cleaned = stripBoilerplate(raw);
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)',
      ).run(contact.id, sectionKey, cleaned);

      stmts.insertContentCache.run(
        contact.id,
        sectionKey,
        hash,
        cleaned,
        now,
      );
    }

    // Index all other .md files recursively (custom and profession-specific)
    const knownFiles = new Set(Object.values(SECTION_FILES));
    for (const relPath of collectMdFiles(dossierPath)) {
      if (knownFiles.has(relPath)) continue;
      const filePath = join(dossierPath, relPath);
      if (!statSync(filePath).isFile()) continue;

      // Section key = relative path without .md (e.g. "intelligence/intelligence-unsent")
      const sectionKey = relPath.replace(/\.md$/, '');
      const raw = readFileSync(filePath, 'utf-8');
      const hash = createHash('sha256').update(raw).digest('hex');
      const cleaned = stripBoilerplate(raw);
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO content_fts (contact_id, section, content) VALUES (?, ?, ?)',
      ).run(contact.id, sectionKey, cleaned);

      stmts.insertContentCache.run(
        contact.id,
        sectionKey,
        hash,
        cleaned,
        now,
      );
    }
  }

  const store: Store = {
    db,
    crmRoot,

    indexAll(): void {
      // Clear existing data
      db.exec('DELETE FROM contacts');
      db.exec('DELETE FROM relationships');
      db.exec('DELETE FROM content_fts');
      db.exec('DELETE FROM content_cache');

      // Find all INDEX.md files under crmRoot
      const indexFiles = fg.sync('*/*/INDEX.md', { cwd: crmRoot });

      for (const relPath of indexFiles) {
        try {
          indexDossier(dirname(relPath));
        } catch (err) {
          console.error(`Failed to index ${relPath}:`, err);
        }
      }
    },

    indexOne(dossierRelPath: string): void {
      // Remove existing data for this dossier (if re-indexing)
      const dossierPath = join(crmRoot, dossierRelPath);
      const contact = parseIndexYaml(dossierPath);
      if (contact.id) {
        db.prepare('DELETE FROM contacts WHERE id = ?').run(contact.id);
        db.prepare('DELETE FROM relationships WHERE source_id = ?').run(contact.id);
        db.prepare('DELETE FROM content_fts WHERE contact_id = ?').run(contact.id);
        db.prepare('DELETE FROM content_cache WHERE contact_id = ?').run(contact.id);
      }
      indexDossier(dossierRelPath);
    },

    searchContacts(filters): SearchResult[] {
      const {
        query,
        category,
        status,
        profession,
        limit = 20,
      } = filters;
      const conditions: string[] = [];
      const params: any[] = [];

      if (query) {
        conditions.push('(name LIKE ? OR aliases LIKE ?)');
        params.push(`%${query}%`, `%${query}%`);
      }
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      if (profession) {
        conditions.push('profession = ?');
        params.push(profession);
      }

      const where =
        conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      const sql = `SELECT id, name, category, organization, status, last_contact FROM contacts ${where} ORDER BY name LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params);

      let results = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        organization: row.organization,
        status: row.status,
        lastContact: row.last_contact,
      }));

      // If query provided and no name matches, fall back to FTS
      if (query && results.length === 0) {
        const ftsQuery = sanitizeFtsQuery(query);
        const ftsSql = `
          SELECT DISTINCT c.id, c.name, c.category, c.organization, c.status, c.last_contact
          FROM content_fts f
          JOIN contacts c ON c.id = f.contact_id
          WHERE content_fts MATCH ?
          ${category ? 'AND c.category = ?' : ''}
          ${status ? 'AND c.status = ?' : ''}
          ${profession ? 'AND c.profession = ?' : ''}
          LIMIT ?
        `;
        const ftsParams: any[] = [ftsQuery];
        if (category) ftsParams.push(category);
        if (status) ftsParams.push(status);
        if (profession) ftsParams.push(profession);
        ftsParams.push(limit);

        const ftsRows = db.prepare(ftsSql).all(...ftsParams);
        results = ftsRows.map((row: any) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          organization: row.organization,
          status: row.status,
          lastContact: row.last_contact,
        }));
      }

      return results;
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

      const sectionFile = resolveSectionFile(section);
      const filePath = join(crmRoot, row.path, sectionFile);
      if (!existsSync(filePath)) {
        return '';
      }

      // Check cache
      const cached = stmts.getContentCache.get(contactId, section) as any;
      const currentHash = fileHash(filePath);

      if (cached && cached.file_hash === currentHash) {
        return cached.cleaned_content;
      }

      // Cache miss — read, strip, update cache
      const raw = readFileSync(filePath, 'utf-8');
      const cleaned = stripBoilerplate(raw);
      const now = new Date().toISOString();

      stmts.insertContentCache.run(
        contactId,
        section,
        currentHash,
        cleaned,
        now,
      );

      return cleaned;
    },

    getConnections(contactId: string, depth = 1): Relationship[] {
      const visited = new Set<string>();
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

          // Avoid duplicate relationships
          const key = `${rel.sourceId}-${rel.targetName}-${rel.type}`;
          if (!result.some((r) => `${r.sourceId}-${r.targetName}-${r.type}` === key)) {
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

    getStats(): {
      totalContacts: number;
      byCategory: Record<string, number>;
      staleContacts: number;
      avgFillPercent: number;
    } {
      const totalRow = db
        .prepare('SELECT COUNT(*) as count FROM contacts')
        .get() as any;
      const totalContacts = totalRow.count;

      const categoryRows = db
        .prepare(
          'SELECT category, COUNT(*) as count FROM contacts GROUP BY category',
        )
        .all() as any[];
      const byCategory: Record<string, number> = {};
      for (const row of categoryRows) {
        byCategory[row.category] = row.count;
      }

      // Stale = last_contact is NULL or > 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const staleDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const staleRow = db
        .prepare(
          'SELECT COUNT(*) as count FROM contacts WHERE last_contact IS NULL OR last_contact < ?',
        )
        .get(staleDate) as any;
      const staleContacts = staleRow.count;

      // Average fill percent from content_cache
      // We compute fill percent as ratio of cleaned content length to original
      const cacheRows = db
        .prepare('SELECT contact_id, section, cleaned_content FROM content_cache')
        .all() as any[];

      let totalFill = 0;
      let fileCount = 0;
      for (const row of cacheRows) {
        // Look up the contact path to compute original size
        const contact = stmts.getContactPath.get(row.contact_id) as any;
        if (!contact) continue;

        const sectionFile = resolveSectionFile(row.section);

        const filePath = join(crmRoot, contact.path, sectionFile);
        if (!existsSync(filePath)) continue;

        try {
          const raw = readFileSync(filePath, 'utf-8');
          const originalSize = Buffer.byteLength(raw, 'utf-8');
          const cleanedSize = Buffer.byteLength(
            row.cleaned_content ?? '',
            'utf-8',
          );
          if (originalSize > 0) {
            totalFill += Math.round((cleanedSize / originalSize) * 100);
            fileCount++;
          }
        } catch {
          // skip
        }
      }

      const avgFillPercent =
        fileCount > 0 ? Math.round(totalFill / fileCount) : 0;

      return { totalContacts, byCategory, staleContacts, avgFillPercent };
    },

    getContactPath(contactId: string): string | null {
      const row = stmts.getContactPath.get(contactId) as any;
      return row ? row.path : null;
    },

    close(): void {
      db.close();
    },
  };

  return store;
}
