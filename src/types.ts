export type Category =
  | 'Adversary' | 'Advisor' | 'Client' | 'Colleague'
  | 'Family' | 'Mentor' | 'Network' | 'Personal' | 'Prospect';

export const CATEGORY_CODES: Record<string, Category> = {
  AV: 'Adversary', AD: 'Advisor', CL: 'Client', CO: 'Colleague',
  FA: 'Family', ME: 'Mentor', NE: 'Network', PE: 'Personal', PR: 'Prospect',
};

export const CATEGORY_DIRS: Record<Category, string> = {
  Adversary: 'Adversaries', Advisor: 'Advisors', Client: 'Clients',
  Colleague: 'Colleagues', Family: 'Family', Mentor: 'Mentors',
  Network: 'Network', Personal: 'Personal', Prospect: 'Prospects',
};

export type RelationType =
  | 'reports_to' | 'manages' | 'colleague' | 'spouse' | 'parent'
  | 'child' | 'sibling' | 'in_law' | 'friend' | 'mentor' | 'mentee'
  | 'introduced_by' | 'client_of' | 'advisor_to' | 'adversary_of'
  | 'partner' | 'associated';

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
  score?: number;
  snippet?: string;
}

export interface Config {
  crmRoot: string;
  dbPath: string;
  embeddingModel: string;
  templates: string[];       // available template names
  defaultTemplate: string;   // template to use when none specified
  templateRepo: string;      // GitHub repo for remote templates (owner/repo)
  githubToken?: string;      // optional GitHub token for private repos / rate limits
}

export const DOSSIER_SECTIONS = [
  'index', 'profile', 'log',
  'intelligence-profile', 'intelligence-strategic', 'intelligence-risk',
  'medical', 'education',
] as const;

export type DossierSection = typeof DOSSIER_SECTIONS[number];

export const SECTION_FILES: Record<DossierSection, string> = {
  'index': 'INDEX.md',
  'profile': 'profile.md',
  'log': 'log.md',
  'intelligence-profile': 'intelligence/intelligence-profile.md',
  'intelligence-strategic': 'intelligence/intelligence-strategic.md',
  'intelligence-risk': 'intelligence/intelligence-risk.md',
  'medical': 'medical.md',
  'education': 'education.md',
};

/**
 * Resolve a section name to its file path.
 * Known sections use the SECTION_FILES map; unknown sections (e.g. profession-specific
 * tracking files like "deals", "assignments") fall back to `${section}.md`.
 */
export function resolveSectionFile(section: string): string {
  if (section in SECTION_FILES) return SECTION_FILES[section as DossierSection];
  return `${section}.md`;
}
