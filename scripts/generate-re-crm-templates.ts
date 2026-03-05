/**
 * Generate RE-CRM profession-specific template directories.
 *
 * Each profession gets a directory under templates/re-crm/ containing:
 * - The COMMON files (INDEX.md, profile.md, intelligence.md, log.md)
 * - A profession-specific tracking file (e.g., deals.md, assignments.md)
 *
 * Usage: npx tsx scripts/generate-re-crm-templates.ts
 */

import { mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFESSIONS, type ProfessionEntry } from '../src/professions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates', 're-crm');
const COMMON_DIR = join(TEMPLATES_DIR, 'COMMON');

// Tracking file content generators by file name
const TRACKING_TEMPLATES: Record<string, (p: ProfessionEntry) => string> = {
  'deals.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Deal Tracker

## Active Deals

| Date | Property/Asset | Role | Status | Value | Notes |
|------|---------------|------|--------|-------|-------|

## Closed Deals

| Date | Property/Asset | Role | Status | Value | Notes |
|------|---------------|------|--------|-------|-------|

## Deal Preferences

- **Asset Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Deal Size Range:** [TO BE POPULATED]
- **Investment Criteria:** [TO BE POPULATED]
`,

  'assignments.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Assignment Tracker

## Active Assignments

| Date | Property/Client | Type | Status | Fee | Notes |
|------|----------------|------|--------|-----|-------|

## Completed Assignments

| Date | Property/Client | Type | Status | Fee | Notes |
|------|----------------|------|--------|-----|-------|

## Specializations

- **Property Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Designations:** [TO BE POPULATED]
- **Lender Panels:** [TO BE POPULATED]
`,

  'projects.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Project Tracker

## Active Projects

| Date | Project | Role | Status | Value | Notes |
|------|---------|------|--------|-------|-------|

## Completed Projects

| Date | Project | Role | Status | Value | Notes |
|------|---------|------|--------|-------|-------|

## Capabilities

- **Project Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Specialties:** [TO BE POPULATED]
`,

  'portfolio.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Portfolio Tracker

## Current Portfolio

| Property | Type | Role | Status | Notes |
|----------|------|------|--------|-------|

## Performance Metrics

- **AUM/SF Managed:** [TO BE POPULATED]
- **Occupancy:** [TO BE POPULATED]
- **NOI Performance:** [TO BE POPULATED]

## Capabilities

- **Property Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Certifications:** [TO BE POPULATED]
`,

  'matters.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Matter Tracker

## Active Matters

| Date | Matter | Type | Status | Client | Notes |
|------|--------|------|--------|--------|-------|

## Completed Matters

| Date | Matter | Type | Status | Client | Notes |
|------|--------|------|--------|--------|-------|

## Practice Areas

- **Specialties:** [TO BE POPULATED]
- **Jurisdictions:** [TO BE POPULATED]
- **Bar Admissions:** [TO BE POPULATED]
`,

  'assessments.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Assessment Tracker

## Active Assessments

| Date | Property/Site | Type | Status | Client | Notes |
|------|--------------|------|--------|--------|-------|

## Completed Assessments

| Date | Property/Site | Type | Status | Client | Notes |
|------|--------------|------|--------|--------|-------|

## Capabilities

- **Specialties:** [TO BE POPULATED]
- **Certifications:** [TO BE POPULATED]
- **Equipment:** [TO BE POPULATED]
`,

  'jurisdictions.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Jurisdiction Tracker

## Jurisdiction Details

| Jurisdiction | Role | Authority | Contact Pattern | Notes |
|-------------|------|-----------|-----------------|-------|

## Key Relationships

- **Department:** [TO BE POPULATED]
- **Supervisor:** [TO BE POPULATED]
- **Political Context:** [TO BE POPULATED]

## Process Knowledge

- **Approval Process:** [TO BE POPULATED]
- **Timeline Expectations:** [TO BE POPULATED]
- **Known Requirements:** [TO BE POPULATED]
`,

  'policies.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Policy Tracker

## Active Policies

| Date | Policy/Claim | Type | Status | Value | Notes |
|------|-------------|------|--------|-------|-------|

## Claims History

| Date | Claim | Type | Status | Amount | Notes |
|------|-------|------|--------|--------|-------|

## Capabilities

- **Carrier Relationships:** [TO BE POPULATED]
- **Specialties:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
`,

  'campaigns.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Campaign Tracker

## Active Campaigns

| Date | Campaign/Project | Type | Status | Notes |
|------|-----------------|------|--------|-------|

## Completed Campaigns

| Date | Campaign/Project | Type | Status | Notes |
|------|-----------------|------|--------|-------|

## Capabilities

- **Platforms:** [TO BE POPULATED]
- **Specialties:** [TO BE POPULATED]
- **Tools:** [TO BE POPULATED]
`,

  'entities.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Entity Tracker

## Active Entities

| Entity | Type | Role | Status | Notes |
|--------|------|------|--------|-------|

## Reporting Cycles

| Entity | Frequency | Next Due | Notes |
|--------|-----------|----------|-------|

## Capabilities

- **Entity Types:** [TO BE POPULATED]
- **Software:** [TO BE POPULATED]
- **Certifications:** [TO BE POPULATED]
`,

  'holdings.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Holdings Tracker

## Current Holdings

| Property/Fund | Type | Role | Status | Value | Notes |
|--------------|------|------|--------|-------|-------|

## Investment Criteria

- **Asset Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Return Targets:** [TO BE POPULATED]
- **Hold Period:** [TO BE POPULATED]
- **Capital Available:** [TO BE POPULATED]
`,

  'programs.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Program Tracker

## Active Programs

| Program | Type | Status | Compliance | Notes |
|---------|------|--------|------------|-------|

## Certifications

| Certification | Status | Expiry | Notes |
|--------------|--------|--------|-------|

## Capabilities

- **Program Types:** [TO BE POPULATED]
- **Regulatory Knowledge:** [TO BE POPULATED]
- **Compliance Areas:** [TO BE POPULATED]
`,

  'assets.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Asset Tracker

## Current Assets

| Property | Type | Role | Status | Performance | Notes |
|----------|------|------|--------|-------------|-------|

## Pipeline

| Property | Type | Stage | Timeline | Notes |
|----------|------|-------|----------|-------|

## Capabilities

- **Asset Types:** [TO BE POPULATED]
- **Markets:** [TO BE POPULATED]
- **Brand Relationships:** [TO BE POPULATED]
`,

  'services.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Service Tracker

## Active Contracts

| Property | Service | Frequency | Status | Notes |
|----------|---------|-----------|--------|-------|

## Service History

| Date | Property | Service | Rating | Notes |
|------|----------|---------|--------|-------|

## Capabilities

- **Licenses:** [TO BE POPULATED]
- **Service Areas:** [TO BE POPULATED]
- **Certifications:** [TO BE POPULATED]
- **Availability:** [TO BE POPULATED]
`,

  'engagements.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
lastUpdated: {{date}}
---

# {{name}} - Engagement Tracker

## Active Engagements

| Date | Engagement | Type | Status | Notes |
|------|-----------|------|--------|-------|

## Completed Engagements

| Date | Engagement | Type | Outcome | Notes |
|------|-----------|------|---------|-------|

## Capabilities

- **Specialties:** [TO BE POPULATED]
- **Platforms/Publications:** [TO BE POPULATED]
- **Audience:** [TO BE POPULATED]
`,
};

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  let created = 0;
  let skipped = 0;

  for (const entry of Object.values(PROFESSIONS)) {
    const profDir = join(TEMPLATES_DIR, entry.templateDir);

    if (existsSync(profDir)) {
      skipped++;
      continue;
    }

    // Create directory
    mkdirSync(profDir, { recursive: true });

    // Copy COMMON files
    for (const file of ['INDEX.md', 'profile.md', 'intelligence.md', 'log.md']) {
      cpSync(join(COMMON_DIR, file), join(profDir, file));
    }

    // Generate tracking file
    const generator = TRACKING_TEMPLATES[entry.trackingFile];
    if (generator) {
      writeFileSync(join(profDir, entry.trackingFile), generator(entry), 'utf-8');
    } else {
      console.warn(`No template generator for tracking file: ${entry.trackingFile} (${entry.code})`);
    }

    created++;
  }

  console.log(`Generated ${created} profession template directories (${skipped} already existed)`);
}

main();
