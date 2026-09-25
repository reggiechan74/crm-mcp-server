/**
 * Audit / repair orchestration on top of the pure audit and repair engines:
 * template resolution, audit caching with change detection, and reindexing
 * after files are rewritten.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Store } from './store.js';
import { runAudit, type AuditPass, type AuditResult } from './audit.js';
import { runRepair, type RepairResult } from './repair.js';
import { hashMdTree } from './fsutil.js';

export const ALL_AUDIT_PASSES: AuditPass[] = ['misplaced', 'stale', 'duplicates', 'ordering', 'compliance'];

/**
 * Resolve the template directory for a contact based on their category.
 * Uses .templates/ as the single source of truth.
 */
export function resolveTemplateDir(crmRoot: string, store: Store, contactId: string): string | null {
  const outline = store.getOutline(contactId);
  if (outline.contact.category === 'Organization') {
    const orgTpl = join(crmRoot, '.templates', 'REAL_ESTATE', 'ORGANIZATION', 'COMMON');
    return existsSync(orgTpl) ? orgTpl : null;
  }
  const category = outline.contact.category.toLowerCase();

  // Map category to template type
  let templateType = 'PROFESSIONAL';
  if (category === 'family') templateType = 'FAMILY';
  else if (category === 'personal') templateType = 'PERSONAL';

  const userTpl = join(crmRoot, '.templates', templateType);
  if (existsSync(userTpl)) return userTpl;

  // Also check lowercase (legacy)
  const userTplLower = join(crmRoot, '.templates', templateType.toLowerCase());
  if (existsSync(userTplLower)) return userTplLower;

  return null;
}

function dossierAndTemplate(store: Store, crmRoot: string, contactId: string): { contactPath: string; dossierDir: string; templateDir: string } {
  const contactPath = store.getContactPath(contactId);
  if (!contactPath) throw new Error(`Contact path not found: ${contactId}`);
  const templateDir = resolveTemplateDir(crmRoot, store, contactId);
  if (!templateDir) throw new Error(`Template not found for ${contactId}`);
  return { contactPath, dossierDir: join(crmRoot, contactPath), templateDir };
}

/** Run an audit and cache it (with a hash of the dossier's files) for a later repair. */
export function auditContact(store: Store, crmRoot: string, contactId: string, passes: AuditPass[] = ALL_AUDIT_PASSES): AuditResult {
  const { dossierDir, templateDir } = dossierAndTemplate(store, crmRoot, contactId);
  const result = runAudit(dossierDir, templateDir, passes);
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

  const { contactPath, dossierDir, templateDir } = dossierAndTemplate(store, crmRoot, contactId);
  if (cached.dossierHash !== hashMdTree(dossierDir)) {
    store.clearAudit(contactId);
    throw new Error(`Dossier ${contactId} changed since it was audited. Run crm_audit again before repairing.`);
  }

  const result = runRepair(dossierDir, templateDir, JSON.parse(cached.auditJson) as AuditResult, fixes);
  store.clearAudit(contactId);
  store.indexOne(contactPath);
  return result;
}
