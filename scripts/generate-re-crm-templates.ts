/**
 * Generate RE-CRM profession-specific template directories.
 *
 * Each profession gets a directory under templates/re-crm/ containing:
 * - The COMMON files (INDEX.md, profile.md, intelligence.md, log.md)
 * - A profession-specific tracking file (e.g., deals.md, assignments.md)
 *
 * Usage: npx tsx scripts/generate-re-crm-templates.ts
 */

import { mkdirSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFESSIONS, type ProfessionEntry } from '../src/professions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates', 're-crm');
const COMMON_DIR = join(TEMPLATES_DIR, 'COMMON');

// ── Helper: Leasing-broker profession codes that get the leasing variant of deals.md
const LEASING_CODES = new Set(['BLB', 'BTR', 'BLR']);

// Tracking file content generators by file name
const TRACKING_TEMPLATES: Record<string, (p: ProfessionEntry) => string> = {

  // ════════════════════════════════════════════════════════════════════════
  // deals.md — Sales Broker variant (default) + Leasing Broker variant
  // Design doc: Section V.A (Sales Broker) and V.B (Leasing Broker)
  // ════════════════════════════════════════════════════════════════════════
  'deals.md': (p) => LEASING_CODES.has(p.code)
    ? `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: deals
lastUpdated: {{date}}
---

# {{name}} - Lease Deal History

## XVI. LEASE DEAL TRACKING

### A. Deal Summary

| Metric | Value |
|--------|-------|
| Total Deals Tracked | |
| Total SF Leased | |
| Avg. Deal Size | |
| Primary Asset Class | |
| Primary Role | |

### B. Active Lease Deals

| Tenant/Landlord | Property | Size (SF) | Asking Rate | Role | Status | Est. Execution |
|-----------------|----------|-----------|-------------|------|--------|----------------|
| | | | | | | |

### C. Executed Leases (Last 24 Months)

| Execution Date | Tenant | Property | Size (SF) | Term | Rate | Role | My Involvement |
|----------------|--------|----------|-----------|------|------|------|----------------|
| | | | | | | | |

### D. Lease Expirations They're Tracking

| Tenant | Property | Lease Expiry | Size (SF) | Renewal Likelihood | My Opportunity |
|--------|----------|--------------|-----------|-------------------|----------------|
| | | | | | |

---

## XVII. PORTFOLIO & ASSIGNMENTS

### A. Exclusive Listings (If Landlord Rep)

| Property | Address | Total SF | Available SF | Asking Rate | Assignment Expiry |
|----------|---------|----------|--------------|-------------|-------------------|
| | | | | | |

### B. Active Tenant Rep Assignments

| Tenant | Requirement | Size Range | Market | Status |
|--------|-------------|------------|--------|--------|
| | | | | |

---

## XVIII. LANDLORD/TENANT RELATIONSHIPS

### A. Key Landlord Relationships

| Landlord/Owner | Properties | Total SF | Relationship Type | Exclusivity |
|----------------|------------|----------|-------------------|-------------|
| | | | | |

### B. Key Tenant Relationships

| Tenant | Industry | Typical Size | Relationship Type | Last Served |
|--------|----------|--------------|-------------------|-------------|
| | | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Deal/Client Referred | Outcome | Fee/Thank You |
|------|---------------|---------------------|---------|---------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Deal/Client Referred | Outcome | Reciprocation |
|------|---------------|---------------------|---------|---------------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`
    : `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: deals
lastUpdated: {{date}}
---

# {{name}} - Deal History

## XVI. DEAL TRACKING

### A. Deal Summary

| Metric | Value |
|--------|-------|
| Total Deals Tracked | |
| Total Volume | |
| Avg. Deal Size | |
| Primary Asset Class | |
| Primary Role | |

### B. Active Deals

| Property/Deal Name | Address | Asset Class | Role | List Price | Status | Est. Close |
|-------------------|---------|-------------|------|------------|--------|------------|
| | | | | | | |

### C. Closed Deals (Last 24 Months)

| Close Date | Property | Address | Asset Class | Role | Sale Price | My Involvement |
|------------|----------|---------|-------------|------|------------|----------------|
| | | | | | | |

### D. Lost/Dead Deals

| Date | Property | Reason Lost | Lessons |
|------|----------|-------------|---------|
| | | | |

---

## XVII. DEAL PATTERNS

### A. Specialization Analysis

| Asset Class | # Deals | Volume | Avg. Size | Notes |
|-------------|---------|--------|-----------|-------|
| Office | | | | |
| Industrial | | | | |
| Retail | | | | |
| Multifamily | | | | |
| Land | | | | |

### B. Client Relationships

| Client Name | Client Type | # Deals | Total Volume | Relationship |
|-------------|-------------|---------|--------------|--------------|
| | | | | |

### C. Co-Brokerage History

| Partner | # Deals Together | Total Volume | Working Style | Would Repeat? |
|---------|-----------------|--------------|---------------|---------------|
| | | | | |

---

## XVIII. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Deal/Client Referred | Outcome | Fee/Thank You |
|------|---------------|---------------------|---------|---------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Deal/Client Referred | Outcome | Reciprocation |
|------|---------------|---------------------|---------|---------------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // assignments.md — Appraiser / Valuation & Advisory
  // Design doc: Section V.C (Appraiser)
  // ════════════════════════════════════════════════════════════════════════
  'assignments.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: assignments
lastUpdated: {{date}}
---

# {{name}} - Appraisal Assignment History

## XVI. APPRAISAL TRACKING

### A. Assignment Summary

| Metric | Value |
|--------|-------|
| Total Assignments Tracked | |
| Primary Asset Class | |
| Typical Property Value Range | |
| Primary Client Type | |
| Designations | |

### B. Active Assignments

| Property | Address | Asset Class | Purpose | Client | Due Date | Status |
|----------|---------|-------------|---------|--------|----------|--------|
| | | | | | | |

### C. Completed Appraisals (Last 24 Months)

| Completion Date | Property | Address | Asset Class | Purpose | Value Concluded | My Relationship |
|-----------------|----------|---------|-------------|---------|-----------------|-----------------|
| | | | | | | |

---

## XVII. SPECIALIZATION PROFILE

### A. Asset Class Expertise

| Asset Class | Experience Level | Notable Assignments | Notes |
|-------------|------------------|---------------------|-------|
| Office | | | |
| Industrial | | | |
| Retail | | | |
| Multifamily | | | |
| Land | | | |
| Special Purpose | | | |

### B. Special Competencies

| Specialty | Evidence | Confidence Level |
|-----------|----------|------------------|
| Going concern valuations | | |
| Litigation support | | |
| Partial interest valuations | | |
| Lease analysis | | |
| Cost segregation | | |
| Highest & best use studies | | |

### C. Geographic Coverage

| Market | Experience | Recent Work |
|--------|------------|-------------|
| | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Lender Relationships

| Lender | Panel Status | # Assignments | Typical Assignment Type |
|--------|--------------|---------------|------------------------|
| | | | |

### B. Law Firm Relationships

| Firm | Contact | # Engagements | Typical Purpose |
|------|---------|---------------|-----------------|
| | | | |

### C. Direct Client Relationships

| Client | Type | # Assignments | Notes |
|--------|------|---------------|-------|
| | | | |

---

## XIX. REFERRAL & COLLABORATION

### A. Referrals FROM This Appraiser

| Date | Type | What Referred | Outcome |
|------|------|---------------|---------|
| | | | |

### B. Referrals TO This Appraiser

| Date | Type | What Referred | Outcome | Quality of Work |
|------|------|---------------|---------|-----------------|
| | | | | |

### C. Review Appraisal History

| Date | Property | Original Appraiser | My Role | Outcome |
|------|----------|-------------------|---------|---------|
| | | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // matters.md — Lawyer / Legal & Compliance
  // Design doc: Section V.D (Real Estate Lawyer)
  // ════════════════════════════════════════════════════════════════════════
  'matters.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: matters
lastUpdated: {{date}}
---

# {{name}} - Legal Matter History

## XVI. MATTER TRACKING

### A. Practice Summary

| Metric | Value |
|--------|-------|
| Total Matters Tracked | |
| Primary Practice Areas | |
| Firm | |
| Partnership Level | |
| Hourly Rate | |
| Billing Style | |

### B. Active Matters (Involving Me)

| Matter Name | Type | My Role | Their Role | Status | Key Dates |
|-------------|------|---------|------------|--------|-----------|
| | | | | | |

### C. Closed Matters (Last 24 Months)

| Close Date | Matter | Type | My Role | Their Role | Outcome | Notes |
|------------|--------|------|---------|------------|---------|-------|
| | | | | | | |

---

## XVII. PRACTICE AREA ANALYSIS

### A. Transaction Experience

| Transaction Type | Experience Level | Notable Matters | Strengths |
|------------------|------------------|-----------------|-----------|
| Purchase/Sale | | | |
| Commercial Leasing | | | |
| Financing | | | |
| Joint Ventures | | | |
| Development | | | |

### B. Litigation Experience

| Litigation Type | Experience Level | Notable Cases | Approach |
|-----------------|------------------|---------------|----------|
| Landlord/Tenant | | | |
| Contract Disputes | | | |
| Title Issues | | | |
| Construction | | | |
| Partnership Disputes | | | |

### C. Regulatory/Land Use Experience

| Area | Experience | Notable Matters |
|------|------------|-----------------|
| Zoning | | |
| Environmental | | |
| Municipal Law | | |
| Expropriation | | |

---

## XVIII. WORK QUALITY ASSESSMENT

### A. Performance Metrics

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Legal Analysis Quality | | |
| Document Drafting | | |
| Negotiation Skill | | |
| Responsiveness | | |
| Cost Efficiency | | |
| Strategic Thinking | | |
| Client Communication | | |

### B. Billing Analysis

| Matter | Estimated | Actual | Variance | Value Assessment |
|--------|-----------|--------|----------|------------------|
| | | | | |

### C. Opposing Counsel Assessment (If Applicable)

| Dimension | Observation |
|-----------|-------------|
| Aggressiveness | |
| Preparation | |
| Honesty | |
| Settlement Orientation | |

---

## XIX. REFERRAL NETWORK

### A. Referrals FROM This Lawyer

| Date | Type | Who/What Referred | Outcome |
|------|------|-------------------|---------|
| | | | |

### B. Referrals TO This Lawyer

| Date | Type | Who/What Referred | Outcome | Quality |
|------|------|-------------------|---------|---------|
| | | | | |

### C. Related Professionals in Their Network

| Professional | Type | Relationship | My Interest |
|--------------|------|--------------|-------------|
| | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // projects.md — Developer / Development & Construction
  // Design doc: Section V.E (Developer)
  // ════════════════════════════════════════════════════════════════════════
  'projects.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: projects
lastUpdated: {{date}}
---

# {{name}} - Development Project History

## XVI. PROJECT TRACKING

### A. Developer Profile

| Metric | Value |
|--------|-------|
| Total Projects Tracked | |
| Primary Product Type | |
| Typical Project Scale | |
| Geographic Focus | |
| Development Style | |
| Capital Source | |

### B. Active Projects

| Project Name | Location | Type | Size | Status | Est. Completion | My Opportunity |
|--------------|----------|------|------|--------|-----------------|----------------|
| | | | | | | |

### C. Completed Projects (Last 5 Years)

| Completion | Project | Location | Type | Size | Outcome | My Involvement |
|------------|---------|----------|------|------|---------|----------------|
| | | | | | | |

---

## XVII. DEVELOPMENT CAPABILITIES

### A. Product Type Experience

| Product Type | Experience | Notable Projects | Quality |
|--------------|------------|------------------|---------|
| Multifamily Rental | | | |
| Condo | | | |
| Office | | | |
| Industrial | | | |
| Retail | | | |
| Mixed-Use | | | |
| Land Development | | | |

### B. Development Process Expertise

| Phase | Capability | Evidence |
|-------|------------|----------|
| Site Selection | | |
| Entitlements | | |
| Design Management | | |
| Construction Oversight | | |
| Financing | | |
| Lease-up/Sales | | |

### C. Team & Resources

| Function | In-House vs. Outsourced | Key Partners |
|----------|------------------------|--------------|
| Construction Management | | |
| Architecture | | |
| Engineering | | |
| Legal | | |
| Capital | | |

---

## XVIII. LAND & SITE TRACKING

### A. Sites They're Pursuing

| Site/Area | Status | Size | Target Use | My Intel |
|-----------|--------|------|------------|----------|
| | | | | |

### B. Land They Own (Undeveloped)

| Site | Acquired | Size | Zoning | Status | Development Timeline |
|------|----------|------|--------|--------|---------------------|
| | | | | | |

---

## XIX. CAPITAL & FINANCIAL

### A. Capital Sources

| Source | Type | Relationship |
|--------|------|--------------|
| | | |

### B. Financial Patterns

| Dimension | Observation |
|-----------|-------------|
| Leverage Preference | |
| Equity Strategy | |
| Exit Strategy | |
| Return Thresholds | |

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal | | | |
| Brokerage | | | |
| Consulting | | | |
| Other | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Other developers | | |
| Investors | | |
| Service providers | | |
| Deals/Opportunities | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // portfolio.md — Property Manager / Property & Asset Management
  // Design doc: Section V.F (Property Manager)
  // ════════════════════════════════════════════════════════════════════════
  'portfolio.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: portfolio
lastUpdated: {{date}}
---

# {{name}} - Property Management Portfolio

## XVI. PORTFOLIO TRACKING

### A. Manager Profile

| Metric | Value |
|--------|-------|
| Company | |
| Portfolio Size | |
| Primary Asset Class | |
| Geographic Coverage | |
| Owner Type | |

### B. Properties They Manage

| Property | Address | Type | Size | Owner | My Relationship |
|----------|---------|------|------|-------|-----------------|
| | | | | | |

### C. Recent Portfolio Changes

| Date | Change Type | Property | Details | Opportunity |
|------|-------------|----------|---------|-------------|
| | | | | |

---

## XVII. MANAGEMENT CAPABILITIES

### A. Asset Class Experience

| Asset Class | Portfolio Size | Experience Level | Quality Assessment |
|-------------|----------------|------------------|-------------------|
| Office | | | |
| Industrial | | | |
| Retail | | | |
| Multifamily | | | |

### B. Service Capabilities

| Service | Offered | Quality | Notes |
|---------|---------|---------|-------|
| Leasing | | | |
| Construction Management | | | |
| Financial Reporting | | | |
| Tenant Relations | | | |
| Capital Projects | | | |

---

## XVIII. OWNER RELATIONSHIPS

### A. Key Owners They Serve

| Owner | # Properties | Relationship Type | Decision Maker |
|-------|--------------|-------------------|----------------|
| | | | |

### B. Owner Satisfaction Intel

| Owner | Satisfaction | Contract Status | Vulnerability |
|-------|--------------|-----------------|---------------|
| | | | |

---

## XIX. TENANT RELATIONSHIPS

### A. Key Tenants in Their Portfolio

| Tenant | Property | Size | Lease Expiry | My Interest |
|--------|----------|------|--------------|-------------|
| | | | | |

### B. Vacancy & Leasing Activity

| Property | Vacancy | Active Prospects | Broker Involved | My Opportunity |
|----------|---------|------------------|-----------------|----------------|
| | | | | |

---

## XX. REFERRAL & BUSINESS DEVELOPMENT

### A. Their Vendor Network

| Service | Preferred Vendor | My Opportunity |
|---------|------------------|----------------|
| Brokerage | | |
| Appraisal | | |
| Legal | | |
| Construction | | |

### B. Referral History

| Date | Type | Details | Outcome |
|------|------|---------|---------|
| | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // campaigns.md — Marketing & Operations (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'campaigns.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: campaigns
lastUpdated: {{date}}
---

# {{name}} - Campaign & Marketing History

## XVI. CAMPAIGN TRACKING

### A. Campaign Summary

| Metric | Value |
|--------|-------|
| Total Campaigns Tracked | |
| Primary Campaign Types | |
| Primary Platforms | |
| Avg. Campaign Budget | |
| Key Clients Served | |

### B. Active Campaigns

| Campaign Name | Client | Platform | Type | Budget | Status | Launch Date |
|---------------|--------|----------|------|--------|--------|-------------|
| | | | | | | |

### C. Completed Campaigns (Last 24 Months)

| End Date | Campaign | Client | Platform | Type | Results/ROI | My Involvement |
|----------|----------|--------|----------|------|-------------|----------------|
| | | | | | | |

### D. Pipeline/Upcoming

| Campaign | Client | Target Launch | Est. Budget | Status | Notes |
|----------|--------|---------------|-------------|--------|-------|
| | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Platform Expertise

| Platform/Channel | Experience Level | Notable Campaigns | Notes |
|------------------|------------------|-------------------|-------|
| Digital/Social | | | |
| Print/Collateral | | | |
| Email/CRM | | | |
| Events/Experiential | | | |
| Video/Multimedia | | | |
| PR/Media Relations | | | |

### B. Industry Vertical Experience

| Vertical | # Campaigns | Quality | Notes |
|----------|-------------|---------|-------|
| Office | | | |
| Industrial | | | |
| Retail | | | |
| Multifamily | | | |
| Mixed-Use | | | |

### C. Tools & Technology Stack

| Tool/Platform | Proficiency | Usage Context |
|---------------|-------------|---------------|
| | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Key Clients

| Client Name | Client Type | # Campaigns | Relationship | Last Engagement |
|-------------|-------------|-------------|--------------|-----------------|
| | | | | |

### B. Work Quality Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Creative Quality | | |
| Strategic Thinking | | |
| Execution Timeliness | | |
| Budget Management | | |
| Communication | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // entities.md — Accounting & Finance (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'entities.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: entities
lastUpdated: {{date}}
---

# {{name}} - Entity & Accounting History

## XVI. ENTITY TRACKING

### A. Practice Summary

| Metric | Value |
|--------|-------|
| Total Entities Managed | |
| Primary Entity Types | |
| Firm/Company | |
| Certifications | |
| Software Proficiency | |

### B. Active Entities

| Entity Name | Entity Type | Role | Reporting Cycle | Status | My Relationship |
|-------------|-------------|------|-----------------|--------|-----------------|
| | | | | | |

### C. Completed Engagements (Last 24 Months)

| End Date | Entity | Type | Service Provided | Outcome | Quality |
|----------|--------|------|------------------|---------|---------|
| | | | | | |

### D. Reporting Cycles & Deadlines

| Entity | Report Type | Frequency | Next Due | Status | Notes |
|--------|-------------|-----------|----------|--------|-------|
| | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Entity Type Expertise

| Entity Type | Experience Level | Notable Engagements | Notes |
|-------------|------------------|---------------------|-------|
| LP/GP Structures | | | |
| REITs | | | |
| Joint Ventures | | | |
| Single-Asset LLCs | | | |
| Trusts/Estates | | | |
| Corporate Entities | | | |

### B. Service Capabilities

| Service | Capability | Evidence |
|---------|------------|----------|
| Tax Preparation (RE) | | |
| Financial Reporting | | |
| Cost Segregation | | |
| 1031 Exchange Tracking | | |
| Audit Support | | |
| Budgeting/Forecasting | | |

### C. Software & Systems

| Platform | Proficiency | Usage Context |
|----------|-------------|---------------|
| Yardi | | |
| MRI | | |
| QuickBooks | | |
| Excel/Financial Models | | |
| Other | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Key Clients

| Client Name | Client Type | # Entities | Relationship | Last Engagement |
|-------------|-------------|------------|--------------|-----------------|
| | | | | |

### B. Work Quality Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Accuracy | | |
| Timeliness | | |
| Proactive Tax Planning | | |
| Communication | | |
| Cost Efficiency | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // holdings.md — Investment & Principal (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'holdings.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: holdings
lastUpdated: {{date}}
---

# {{name}} - Holdings & Investment History

## XVI. HOLDINGS TRACKING

### A. Investor Profile

| Metric | Value |
|--------|-------|
| Total Holdings Tracked | |
| Estimated AUM | |
| Primary Asset Classes | |
| Geographic Focus | |
| Investment Style | |
| Capital Available | |

### B. Current Holdings

| Property/Fund | Location | Asset Class | Size | Acquisition Date | Est. Value | Role |
|--------------|----------|-------------|------|------------------|------------|------|
| | | | | | | |

### C. Recent Dispositions (Last 24 Months)

| Disposition Date | Property/Fund | Asset Class | Hold Period | Sale Price | My Involvement |
|------------------|--------------|-------------|-------------|------------|----------------|
| | | | | | |

### D. Active Acquisitions Pipeline

| Target | Location | Asset Class | Size | Stage | Est. Close | My Opportunity |
|--------|----------|-------------|------|-------|------------|----------------|
| | | | | | | |

---

## XVII. INVESTMENT STRATEGY ANALYSIS

### A. Asset Class Preferences

| Asset Class | # Holdings | Total Value | Avg. Hold Period | Notes |
|-------------|-----------|-------------|------------------|-------|
| Office | | | | |
| Industrial | | | | |
| Retail | | | | |
| Multifamily | | | | |
| Land | | | | |
| Specialty | | | | |

### B. Investment Criteria

| Dimension | Criteria |
|-----------|----------|
| Target Returns (IRR) | |
| Equity Multiple | |
| Hold Period | |
| Leverage Preference | |
| Minimum Deal Size | |
| Maximum Deal Size | |
| Risk Profile | |

### C. Capital Structure Patterns

| Source | Type | Typical % | Relationship |
|--------|------|-----------|--------------|
| | | | |

---

## XVIII. RELATIONSHIPS & CO-INVESTMENT

### A. Co-Investment Partners

| Partner | # Deals Together | Total Volume | Structure | Relationship |
|---------|-----------------|--------------|-----------|--------------|
| | | | | |

### B. Advisory Team

| Advisor | Role | Firm | Relationship Quality |
|---------|------|------|---------------------|
| | | | |

### C. Service Provider Preferences

| Service | Current Provider | Satisfaction | My Opportunity |
|---------|------------------|--------------|----------------|
| Brokerage | | | |
| Legal | | | |
| Appraisal | | | |
| Property Management | | | |
| Accounting | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // programs.md — Affordable & Public Housing (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'programs.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: programs
lastUpdated: {{date}}
---

# {{name}} - Program & Compliance History

## XVI. PROGRAM TRACKING

### A. Program Summary

| Metric | Value |
|--------|-------|
| Total Programs Tracked | |
| Primary Program Types | |
| Organization | |
| Regulatory Jurisdictions | |
| Certifications Held | |

### B. Active Programs

| Program Name | Type | Funding Source | Units/Properties | Compliance Status | Expiry |
|--------------|------|---------------|------------------|-------------------|--------|
| | | | | | |

### C. Completed Programs (Last 24 Months)

| End Date | Program | Type | Units/Properties | Outcome | My Involvement |
|----------|---------|------|------------------|---------|----------------|
| | | | | | |

### D. Upcoming Compliance Deadlines

| Program | Deadline | Type | Status | Risk Level | Notes |
|---------|----------|------|--------|------------|-------|
| | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Program Type Expertise

| Program Type | Experience Level | Notable Programs | Notes |
|--------------|------------------|------------------|-------|
| LIHTC | | | |
| Section 8 / HCV | | | |
| HUD Programs | | | |
| State/Municipal Housing | | | |
| Tax Credit Syndication | | | |
| Community Development | | | |

### B. Regulatory Knowledge

| Regulatory Area | Depth | Jurisdictions | Notes |
|-----------------|-------|---------------|-------|
| Fair Housing | | | |
| Rent Stabilization | | | |
| Environmental Compliance | | | |
| Building Codes (Affordable) | | | |
| ADA/Accessibility | | | |

### C. Certifications & Credentials

| Certification | Status | Expiry | Issuing Body |
|--------------|--------|--------|--------------|
| | | | |

---

## XVIII. CLIENT & STAKEHOLDER RELATIONSHIPS

### A. Key Stakeholders

| Stakeholder | Type | # Programs | Relationship | Decision Maker |
|-------------|------|------------|--------------|----------------|
| | | | | |

### B. Funding Source Relationships

| Source | Program Types | Approval Rate | Relationship Quality |
|--------|---------------|---------------|---------------------|
| | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // assets.md — Hospitality & Specialty Assets (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'assets.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: assets
lastUpdated: {{date}}
---

# {{name}} - Specialty Asset History

## XVI. ASSET TRACKING

### A. Asset Profile

| Metric | Value |
|--------|-------|
| Total Assets Tracked | |
| Primary Asset Type | |
| Portfolio Size | |
| Geographic Coverage | |
| Brand Affiliations | |
| Management Style | |

### B. Current Assets Under Management

| Property/Asset | Location | Type | Size/Keys | Brand | Status | My Relationship |
|----------------|----------|------|-----------|-------|--------|-----------------|
| | | | | | | |

### C. Recent Transactions (Last 24 Months)

| Date | Asset | Type | Transaction Type | Value | My Involvement |
|------|-------|------|------------------|-------|----------------|
| | | | | | |

### D. Pipeline / Under Development

| Asset | Location | Type | Size/Keys | Stage | Est. Opening | My Opportunity |
|-------|----------|------|-----------|-------|--------------|----------------|
| | | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Asset Type Expertise

| Asset Type | Experience Level | # Properties | Notable Assets | Notes |
|------------|------------------|--------------|----------------|-------|
| Full-Service Hotel | | | | |
| Select-Service Hotel | | | | |
| Senior Living | | | | |
| Self-Storage | | | | |
| Data Center | | | | |
| Life Sciences | | | | |
| Sports/Entertainment | | | | |
| Manufactured Housing | | | | |

### B. Operational Capabilities

| Capability | Strength | Evidence |
|------------|----------|----------|
| Revenue Management | | |
| Capital Planning | | |
| Repositioning/Renovation | | |
| Brand Relations | | |
| Staffing/HR | | |
| Technology/Systems | | |

### C. Brand & Franchise Relationships

| Brand/Franchise | Relationship | # Properties | Notes |
|-----------------|-------------|--------------|-------|
| | | | |

---

## XVIII. CLIENT & OWNER RELATIONSHIPS

### A. Key Owners/Operators

| Owner/Operator | # Assets | Relationship Type | Decision Maker |
|----------------|----------|-------------------|----------------|
| | | | |

### B. Performance Benchmarking

| Asset | Key Metric | Performance | Comp Set Ranking | Notes |
|-------|-----------|-------------|------------------|-------|
| | | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // services.md — Building Trades & Maintenance (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'services.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: services
lastUpdated: {{date}}
---

# {{name}} - Service & Contract History

## XVI. SERVICE TRACKING

### A. Service Provider Profile

| Metric | Value |
|--------|-------|
| Total Contracts Tracked | |
| Primary Service Type | |
| Company/Trade | |
| License Numbers | |
| Service Territory | |
| Emergency Availability | |

### B. Active Contracts

| Property | Service Type | Frequency | Contract Value | Start Date | Expiry | Status |
|----------|-------------|-----------|----------------|------------|--------|--------|
| | | | | | | |

### C. Completed Work (Last 24 Months)

| Completion Date | Property | Service Type | Scope | Cost | Quality Rating | My Involvement |
|-----------------|----------|-------------|-------|------|----------------|----------------|
| | | | | | | |

### D. Open/Pending Quotes

| Property | Service Type | Scope | Est. Cost | Status | Timeline |
|----------|-------------|-------|-----------|--------|----------|
| | | | | | |

---

## XVII. SPECIALIZATION & CAPABILITIES

### A. Service Expertise

| Service Type | Experience Level | Certifications | Notes |
|-------------|------------------|----------------|-------|
| | | | |

### B. Equipment & Resources

| Equipment/Resource | Capacity | Availability | Notes |
|-------------------|----------|--------------|-------|
| | | | |

### C. Licensing & Insurance

| License/Certification | Number | Expiry | Jurisdictions |
|----------------------|--------|--------|---------------|
| | | | |
| Liability Insurance | | | |
| Workers Comp | | | |
| Bonding | | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Key Property Accounts

| Property/Owner | # Contracts | Total Value | Relationship | Satisfaction |
|----------------|-------------|-------------|--------------|--------------|
| | | | | |

### B. Work Quality Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Quality of Work | | |
| Timeliness | | |
| Pricing Fairness | | |
| Communication | | |
| Cleanup/Professionalism | | |
| Emergency Response | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // engagements.md — Education & Professional Services (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'engagements.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: engagements
lastUpdated: {{date}}
---

# {{name}} - Engagement & Activity History

## XVI. ENGAGEMENT TRACKING

### A. Engagement Summary

| Metric | Value |
|--------|-------|
| Total Engagements Tracked | |
| Primary Engagement Types | |
| Organization/Platform | |
| Audience/Reach | |
| Specialization Areas | |

### B. Active Engagements

| Engagement Name | Type | Platform/Venue | Audience | Status | Date(s) | My Role |
|-----------------|------|----------------|----------|--------|---------|---------|
| | | | | | | |

### C. Completed Engagements (Last 24 Months)

| Date | Engagement | Type | Platform/Venue | Audience | Outcome | My Involvement |
|------|-----------|------|----------------|----------|---------|----------------|
| | | | | | | |

### D. Upcoming/Pipeline

| Engagement | Type | Target Date | Est. Audience | Status | Notes |
|-----------|------|-------------|---------------|--------|-------|
| | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Topic Expertise

| Topic Area | Depth | Notable Engagements | Notes |
|------------|-------|---------------------|-------|
| Market Analysis | | | |
| Investment Strategy | | | |
| Property Management | | | |
| Development/Construction | | | |
| Legal/Regulatory | | | |
| Technology/PropTech | | | |

### B. Platform & Medium Experience

| Platform/Medium | Experience Level | Reach | Notes |
|-----------------|------------------|-------|-------|
| Speaking/Conferences | | | |
| Writing/Publications | | | |
| Teaching/Instruction | | | |
| Consulting/Advisory | | | |
| Podcasts/Media | | | |
| Recruiting/Placement | | | |

### C. Industry Affiliations

| Organization | Role | Duration | Influence Level |
|-------------|------|----------|-----------------|
| | | | |

---

## XVIII. CLIENT & AUDIENCE RELATIONSHIPS

### A. Key Clients/Partners

| Client/Partner | Type | # Engagements | Relationship | Value |
|----------------|------|---------------|--------------|-------|
| | | | | |

### B. Influence Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Industry Reputation | | |
| Network Breadth | | |
| Content Quality | | |
| Accessibility | | |
| Commercial Value | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // jurisdictions.md — Government & Municipal (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'jurisdictions.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: jurisdictions
lastUpdated: {{date}}
---

# {{name}} - Jurisdiction & Regulatory History

## XVI. JURISDICTION TRACKING

### A. Official Profile

| Metric | Value |
|--------|-------|
| Jurisdiction | |
| Department | |
| Title/Role | |
| Supervisor | |
| Years in Role | |
| Political Affiliation/Context | |

### B. Active Matters in Their Jurisdiction

| Matter/Application | Type | Property/Project | Status | Key Dates | My Role |
|--------------------|------|------------------|--------|-----------|---------|
| | | | | | |

### C. Completed Matters (Last 24 Months)

| Decision Date | Matter | Type | Property/Project | Outcome | Processing Time | Notes |
|---------------|--------|------|------------------|---------|-----------------|-------|
| | | | | | | |

### D. Upcoming Hearings/Reviews

| Date | Matter | Type | Property/Project | Status | Risk Level |
|------|--------|------|------------------|--------|------------|
| | | | | | |

---

## XVII. PROCESS & REGULATORY KNOWLEDGE

### A. Approval Process Expertise

| Process Type | Typical Timeline | Key Requirements | Pitfalls |
|-------------|------------------|------------------|----------|
| Zoning/Rezoning | | | |
| Site Plan Approval | | | |
| Building Permits | | | |
| Variances | | | |
| Subdivisions | | | |
| Environmental Review | | | |

### B. Policy Positions & Preferences

| Policy Area | Known Position | Evidence | Notes |
|-------------|---------------|----------|-------|
| Density/Growth | | | |
| Affordable Housing | | | |
| Commercial Development | | | |
| Environmental | | | |
| Historic Preservation | | | |

### C. Decision-Making Patterns

| Dimension | Observation |
|-----------|-------------|
| Speed of Decisions | |
| Transparency | |
| Developer-Friendliness | |
| Political Sensitivity | |
| Appeal Likelihood | |

---

## XVIII. RELATIONSHIP MAPPING

### A. Key Relationships Within Government

| Official | Department | Relationship | Influence on This Contact |
|----------|-----------|--------------|--------------------------|
| | | | |

### B. External Influencers

| Person/Org | Type | Relationship | Influence Level |
|-----------|------|--------------|-----------------|
| | | | |

### C. Preferred Consultants/Professionals

| Professional | Type | Relationship | Notes |
|-------------|------|--------------|-------|
| | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // policies.md — Insurance & Risk (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'policies.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: policies
lastUpdated: {{date}}
---

# {{name}} - Policy & Risk Management History

## XVI. POLICY TRACKING

### A. Insurance Professional Profile

| Metric | Value |
|--------|-------|
| Total Policies Tracked | |
| Primary Coverage Types | |
| Carrier Relationships | |
| Firm/Company | |
| License Jurisdictions | |
| Specialization | |

### B. Active Policies

| Policy/Coverage | Property/Entity | Carrier | Type | Premium | Expiry | Status |
|-----------------|-----------------|---------|------|---------|--------|--------|
| | | | | | | |

### C. Claims History (Last 24 Months)

| Claim Date | Policy | Property | Type | Amount Claimed | Amount Paid | Status | My Involvement |
|------------|--------|----------|------|----------------|-------------|--------|----------------|
| | | | | | | | |

### D. Upcoming Renewals

| Policy | Property/Entity | Carrier | Current Premium | Renewal Date | Risk Factors | Notes |
|--------|-----------------|---------|-----------------|--------------|--------------|-------|
| | | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Coverage Type Expertise

| Coverage Type | Experience Level | Notable Placements | Notes |
|-------------|------------------|---------------------|-------|
| Property/Casualty | | | |
| General Liability | | | |
| Professional Liability (E&O) | | | |
| Environmental | | | |
| Builder's Risk | | | |
| Flood/Earthquake | | | |
| D&O / EPLI | | | |

### B. Carrier Relationships

| Carrier | Relationship Level | Program Access | Specialties |
|---------|-------------------|----------------|-------------|
| | | | |

### C. Risk Assessment Capabilities

| Capability | Proficiency | Evidence |
|-----------|-------------|----------|
| Loss Analysis | | |
| Risk Mitigation Planning | | |
| Claims Advocacy | | |
| Market Placement | | |
| Portfolio Review | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Key Accounts

| Client/Owner | # Policies | Total Premium | Relationship | Satisfaction |
|-------------|------------|---------------|--------------|--------------|
| | | | | |

### B. Work Quality Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Market Knowledge | | |
| Claims Handling | | |
| Responsiveness | | |
| Cost Competitiveness | | |
| Proactive Risk Advice | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // assessments.md — Technical & Specialty (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'assessments.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: assessments
lastUpdated: {{date}}
---

# {{name}} - Assessment & Inspection History

## XVI. ASSESSMENT TRACKING

### A. Technical Professional Profile

| Metric | Value |
|--------|-------|
| Total Assessments Tracked | |
| Primary Assessment Types | |
| Certifications/Licenses | |
| Equipment/Technology | |
| Service Territory | |
| Turnaround Time (Typical) | |

### B. Active Assessments

| Property/Site | Address | Assessment Type | Client | Due Date | Status | Scope |
|--------------|---------|-----------------|--------|----------|--------|-------|
| | | | | | | |

### C. Completed Assessments (Last 24 Months)

| Completion Date | Property/Site | Address | Type | Client | Findings Summary | My Relationship |
|-----------------|--------------|---------|------|--------|------------------|-----------------|
| | | | | | | |

### D. Pending/Quoted

| Property/Site | Type | Client | Est. Fee | Status | Timeline |
|--------------|------|--------|----------|--------|----------|
| | | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Assessment Type Expertise

| Assessment Type | Experience Level | Notable Assessments | Notes |
|-----------------|------------------|---------------------|-------|
| Phase I ESA | | | |
| Phase II ESA | | | |
| Building Condition | | | |
| Geotechnical | | | |
| Survey/Boundary | | | |
| Energy Audit | | | |
| ADA/Accessibility | | | |
| Asbestos/Hazmat | | | |

### B. Property Type Experience

| Property Type | # Assessments | Experience Level | Notes |
|-------------|---------------|------------------|-------|
| Office | | | |
| Industrial | | | |
| Retail | | | |
| Multifamily | | | |
| Land (Greenfield) | | | |
| Land (Brownfield) | | | |

### C. Equipment & Technology

| Equipment/Tool | Capability | Availability |
|---------------|------------|--------------|
| | | |

---

## XVIII. CLIENT RELATIONSHIPS

### A. Key Clients

| Client Name | Client Type | # Assessments | Relationship | Last Engagement |
|-------------|-------------|---------------|--------------|-----------------|
| | | | | |

### B. Work Quality Assessment

| Dimension | Rating (1-5) | Evidence |
|-----------|--------------|----------|
| Technical Accuracy | | |
| Report Quality | | |
| Turnaround Time | | |
| Communication | | |
| Cost Competitiveness | | |
| Regulatory Knowledge | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Acknowledgment |
|------|---------------|-------------------|---------|----------------|
| | | | | |

### B. Referrals TO This Contact

| Date | Referral Type | Who/What Referred | Outcome | Quality |
|------|---------------|-------------------|---------|---------|
| | | | | |

### C. Referral Balance

| Direction | Count | Value | Net Position |
|-----------|-------|-------|--------------|
| FROM them to me | | | |
| TO them from me | | | |
| **Net** | | | |
`,
};

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  const forceRegenerate = process.argv.includes('--force');
  let created = 0;
  let skipped = 0;
  let regenerated = 0;

  for (const entry of Object.values(PROFESSIONS)) {
    const profDir = join(TEMPLATES_DIR, entry.templateDir);

    if (existsSync(profDir)) {
      if (forceRegenerate) {
        rmSync(profDir, { recursive: true, force: true });
        regenerated++;
      } else {
        skipped++;
        continue;
      }
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

    if (!forceRegenerate) created++;
  }

  if (forceRegenerate) {
    console.log(`Regenerated ${regenerated} profession template directories (${skipped} unchanged)`);
  } else {
    console.log(`Generated ${created} profession template directories (${skipped} already existed)`);
  }
}

main();
