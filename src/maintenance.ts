/**
 * Audit / repair orchestration on top of the pure audit and repair engines:
 * template resolution, audit caching with change detection, and reindexing
 * after files are rewritten.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Store } from './store.js';
import { runAudit, type AuditPass, type AuditResult } from './audit.js';
import { runRepair, type RepairResult } from './repair.js';
import { hashMdTree } from './fsutil.js';
import { parseFrontmatter } from './frontmatter.js';
import { orgTemplateLayers } from './orgTypes.js';

export const ALL_AUDIT_PASSES: AuditPass[] = ['misplaced', 'stale', 'duplicates', 'ordering', 'compliance'];

/**
 * Template layers a dossier is audited against. Organizations: the layered
 * ORGANIZATION template for the types, roles and sales motion currently in
 * INDEX.md on disk (only installed layers). People: their category template.
 * Returns null when no template is installed.
 */
export function resolveTemplateDirs(crmRoot: string, store: Store, contactId: string): string[] | null {
  const outline = store.getOutline(contactId);
  if (outline.contact.category === 'Organization') {
    const orgRoot = join(crmRoot, '.templates', 'REAL_ESTATE', 'ORGANIZATION');
    if (!existsSync(join(orgRoot, 'COMMON'))) return null;
    const indexPath = join(crmRoot, outline.contact.path, 'INDEX.md');
    const yaml = existsSync(indexPath) ? parseFrontmatter(readFileSync(indexPath, 'utf-8')) ?? {} : {};
    const list = (v: unknown): string[] =>
      (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : []).map((s) => s.trim()).filter(Boolean);
    return orgTemplateLayers(orgRoot, {
      orgType: String(yaml.orgType ?? ''),
      secondaryTypes: list(yaml.secondaryTypes),
      roles: list(yaml.roles),
      salesMotion: yaml.salesMotion === 'tech' ? 'tech' : 'general',
    }).filter((dir) => existsSync(dir));
  }

  const category = outline.contact.category.toLowerCase();
  let templateType = 'PROFESSIONAL';
  if (category === 'family') templateType = 'FAMILY';
  else if (category === 'personal') templateType = 'PERSONAL';

  for (const name of [templateType, templateType.toLowerCase()]) {
    const dir = join(crmRoot, '.templates', name);
    if (existsSync(dir)) return [dir];
  }
  return null;
}

function dossierAndTemplate(store: Store, crmRoot: string, contactId: string): { contactPath: string; dossierDir: string; templateDirs: string[] } {
  const contactPath = store.getContactPath(contactId);
  if (!contactPath) throw new Error(`Contact path not found: ${contactId}`);
  const templateDirs = resolveTemplateDirs(crmRoot, store, contactId);
  if (!templateDirs) throw new Error(`Template not found for ${contactId}`);
  return { contactPath, dossierDir: join(crmRoot, contactPath), templateDirs };
}

/** Run an audit and cache it (with a hash of the dossier's files) for a later repair. */
export function auditContact(store: Store, crmRoot: string, contactId: string, passes: AuditPass[] = ALL_AUDIT_PASSES): AuditResult {
  const { dossierDir, templateDirs } = dossierAndTemplate(store, crmRoot, contactId);
  const result = runAudit(dossierDir, templateDirs, passes);
  store.saveAudit(contactId, JSON.stringify(result), hashMdTree(dossierDir));
  return result;
}

/**
 * Apply fixes from the cached audit. Refuses when the dossier changed since
 * the audit (the findings' headings and line positions may no longer hold),
 * and reindexes the dossier afterwards so search reflects the new files.
 */
export function repairContact(store: Store, crmRoot: string, contactId: string, fixes: string[]): RepairResult {
  const cached = store.loadAudit(contactId);
  if (!cached) throw new Error(`No audit cache found for ${contactId}. Run crm_audit first.`);

  const { contactPath, dossierDir, templateDirs } = dossierAndTemplate(store, crmRoot, contactId);
  if (cached.dossierHash !== hashMdTree(dossierDir)) {
    store.clearAudit(contactId);
    throw new Error(`Dossier ${contactId} changed since it was audited. Run crm_audit again before repairing.`);
  }

  const result = runRepair(dossierDir, templateDirs, JSON.parse(cached.auditJson) as AuditResult, fixes);
  store.clearAudit(contactId);
  store.indexOne(contactPath);
  return result;
}
