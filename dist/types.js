export const CATEGORY_CODES = {
    AV: 'Adversary', AD: 'Advisor', CL: 'Client', CO: 'Colleague',
    FA: 'Family', ME: 'Mentor', NE: 'Network', PE: 'Personal', PR: 'Prospect',
};
export const CATEGORY_DIRS = {
    Adversary: 'Adversaries', Advisor: 'Advisors', Client: 'Clients',
    Colleague: 'Colleagues', Family: 'Family', Mentor: 'Mentors',
    Network: 'Network', Personal: 'Personal', Prospect: 'Prospects',
};
export const DOSSIER_SECTIONS = [
    'index', 'profile', 'log',
    'intelligence-profile', 'intelligence-strategic', 'intelligence-risk',
    'medical', 'medical-genetics', 'medical-pharmacogenomics', 'medical-labs',
    'education',
];
export const SECTION_FILES = {
    'index': 'INDEX.md',
    'profile': 'profile.md',
    'log': 'log.md',
    'intelligence-profile': 'intelligence/intelligence-profile.md',
    'intelligence-strategic': 'intelligence/intelligence-strategic.md',
    'intelligence-risk': 'intelligence/intelligence-risk.md',
    'medical': 'medical.md',
    'medical-genetics': 'medical/medical-genetics.md',
    'medical-pharmacogenomics': 'medical/medical-pharmacogenomics.md',
    'medical-labs': 'medical/medical-labs.md',
    'education': 'education.md',
};
/**
 * Resolve a section name to its file path.
 * Accepts any format: "index", "INDEX.md", "intelligence-profile", "intelligence/intelligence-profile.md"
 * Known sections use the SECTION_FILES map; unknown sections (e.g. profession-specific
 * tracking files like "deals", "assignments") fall back to `${section}.md`.
 */
export function resolveSectionFile(section) {
    // Normalize: strip path prefix, .md suffix, and lowercase for lookup
    const normalized = section
        .replace(/^.*\//, '') // strip directory prefix (e.g. "intelligence/")
        .replace(/\.md$/i, '') // strip .md suffix
        .toLowerCase();
    if (normalized in SECTION_FILES)
        return SECTION_FILES[normalized];
    // Unknown section — use the normalized name with .md
    return `${normalized}.md`;
}
//# sourceMappingURL=types.js.map