export type Category =
  | 'Adversary' | 'Advisor' | 'Client' | 'Colleague'
  | 'Family' | 'Mentor' | 'Network' | 'Personal' | 'Prospect'
  | 'Organization';

export const CATEGORY_CODES: Record<string, Category> = {
  AV: 'Adversary', AD: 'Advisor', CL: 'Client', CO: 'Colleague',
  FA: 'Family', ME: 'Mentor', NE: 'Network', PE: 'Personal', PR: 'Prospect',
  OR: 'Organization',
};

export const CATEGORY_DIRS: Record<Category, string> = {
  Adversary: 'Adversaries', Advisor: 'Advisors', Client: 'Clients',
  Colleague: 'Colleagues', Family: 'Family', Mentor: 'Mentors',
  Network: 'Network', Personal: 'Personal', Prospect: 'Prospects',
  Organization: 'Organizations',
};

export const RELATION_TYPES = [
  'reports_to', 'manages', 'colleague', 'spouse', 'parent',
  'child', 'sibling', 'in_law', 'friend', 'mentor', 'mentee',
  'introduced_by', 'client_of', 'advisor_to', 'adversary_of',
  'partner', 'associated',
  // Organization links
  'operating_partner_of', 'lp_in', 'gp_of', 'parent_of', 'subsidiary_of',
  'integrates_with', 'competes_with', 'acquired_by', 'employs', 'works_at',
] as const;

export type RelationType = typeof RELATION_TYPES[number];

export interface Contact {
  id: string;
  name: string;
  category: Category;
  organization: string | null;
  status: string;
  lastContact: string | null;
  lastUpdated: string;
  path: string;
  metadataJson: string;
  profession?: string;
  aliases?: string;  // JSON-serialized array, e.g. '["Izzy","Bella"]'
}

export interface SectionMeta {
  file: string;
  sizeBytes: number;
  filledBytes: number;
  fillPercent: number;
  lastUpdated: string | null;
}

export interface Relationship {
  sourceId: string;
  targetId: string;
  targetName: string;
  type: RelationType;
  context: string;
  bidirectional: boolean;
}

export interface SearchResult {
  id: string;
  name: string;
  category: Category;
  organization: string | null;
  status: string;
  lastContact: string | null;
  path?: string;
  score?: number;
  snippet?: string;
  orgType?: string;
  roles?: string[];
}

export const SALES_MOTIONS = ['general', 'tech'] as const;
/** How the user sells to organizations: `tech` adds the SaaS-sale template layer. */
export type SalesMotion = typeof SALES_MOTIONS[number];

export interface Config {
  crmRoot: string;
  dbPath: string;
  embeddingModel: string;
  templates: string[];       // available template names
  defaultTemplate: string;   // template to use when none specified
  templateRepo: string;      // GitHub repo for remote templates (owner/repo)
  githubToken?: string;      // optional GitHub token for private repos / rate limits
  salesMotion?: SalesMotion; // 'general' (default) | 'tech' — adds the tech-sale org template layer
}

export const DOSSIER_SECTIONS = [
  'index', 'profile', 'log',
  'intelligence-profile', 'intelligence-strategic', 'intelligence-risk',
  'medical', 'medical-genetics', 'medical-pharmacogenomics', 'medical-labs',
  'education',
] as const;

export type DossierSection = typeof DOSSIER_SECTIONS[number];

export const SECTION_FILES: Record<DossierSection, string> = {
  'index': 'INDEX.md',
  'profile': 'profile.md',
  'log': 'log.md',
  'intelligence-profile': 'intelligence/intelligence-profile.md',
  'intelligence-strategic': 'intelligence/intelligence-strategic.md',
  'intelligence-risk': 'intelligence/intelligence-risk.md',
  'medical': 'medical/medical.md',
  'medical-genetics': 'medical/medical-genetics.md',
  'medical-pharmacogenomics': 'medical/medical-pharmacogenomics.md',
  'medical-labs': 'medical/medical-labs.md',
  'education': 'education.md',
};

/** Reverse map: canonical file path → section key. */
export const FILE_TO_SECTION: Record<string, DossierSection> = Object.fromEntries(
  Object.entries(SECTION_FILES).map(([key, file]) => [file, key as DossierSection]),
) as Record<string, DossierSection>;

export interface ResolvedSection {
  /** Canonical key used for cache and FTS rows (e.g. "profile", "deals", "intelligence/intelligence-unsent"). */
  key: string;
  /** Path of the section file relative to the dossier folder. */
  file: string;
}

/**
 * Resolve any accepted spelling of a section to its canonical key and file.
 * Accepts "index", "INDEX.md", "Profile", "intelligence-profile",
 * "intelligence/intelligence-profile.md", and custom files by relative path
 * ("deals", "intelligence/intelligence-unsent").
 *
 * Known sections map case-insensitively when given bare or under their
 * canonical directory; anything else keeps its relative path. Throws on
 * absolute paths and on "." / ".." segments so a section can never address a
 * file outside its dossier folder.
 */
export function resolveSection(section: string): ResolvedSection {
  const normalized = section.trim().replace(/\\/g, '/').replace(/\.md$/i, '');
  const segments = normalized.split('/');
  if (
    normalized === '' ||
    normalized.includes('\0') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((seg) => seg === '' || seg === '.' || seg === '..')
  ) {
    throw new Error(`Invalid section: "${section}"`);
  }

  const flatKey = segments[segments.length - 1].toLowerCase();
  if (flatKey in SECTION_FILES) {
    const file = SECTION_FILES[flatKey as DossierSection];
    const dir = segments.slice(0, -1).join('/').toLowerCase();
    const canonicalDir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')).toLowerCase() : '';
    if (dir === '' || dir === canonicalDir) return { key: flatKey, file };
  }

  return { key: normalized, file: `${normalized}.md` };
}

/** Back-compat wrapper: the section's file path relative to the dossier folder. */
export function resolveSectionFile(section: string): string {
  return resolveSection(section).file;
}
