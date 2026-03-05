/**
 * Generate RE-CRM profession-specific template directories.
 *
 * Each profession gets a directory under templates/re-crm/ containing:
 * - The COMMON files (INDEX.md, profile.md, intelligence.md, log.md)
 * - A profession-specific tracking file (e.g., deals.md, assignments.md)
 *
 * Usage: npx tsx scripts/generate-re-crm-templates.ts
 */

import { mkdirSync, writeFileSync, cpSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
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
| CoStar / LoopNet Listings | | | |
| Offering Memorandum Design | | | |
| Property Websites / Landing Pages | | | |
| Investor Decks / Pitch Materials | | | |
| Drone / 3D Virtual Tours | | | |
| Social Media (LinkedIn, IG) | | | |
| Email / CRM Drip Campaigns | | | |
| Print / Collateral / Signage | | | |
| PR / Media Relations | | | |
| Events / Open Houses | | | |

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

### C. Creative Portfolio Assessment

| Deliverable Type | Sample Quality (1-5) | Turnaround | Pricing Model | Notes |
|-----------------|---------------------|-----------|---------------|-------|
| Offering Memorandum | | | | |
| Property Photography | | | | |
| Video / Drone Content | | | | |
| Website / Landing Page | | | | |
| Investor Presentation | | | | |
| Signage / Print Collateral | | | | |

### D. Property Marketing Track Record

| Property | Campaign Type | Days on Market | Absorption Impact | Result | Notes |
|----------|-------------|----------------|-------------------|--------|-------|
| | | | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Property listing / brokerage | | | |
| Market data / comp research | | | |
| Investor outreach strategy | | | |
| Repositioning / branding | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Developers needing marketing | | |
| Brokers needing collateral | | |
| Investors seeking deal flow | | |
| Other marketing professionals | | |
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
| Transfer Pricing / Cross-Border | | |
| Withholding Tax (NR) | | |

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

### C. Year-End & Tax Calendar

| Deadline | Entity/Filing | Type | Status | Notes |
|----------|--------------|------|--------|-------|
| T1/T2 Corporate Filing | | | | |
| T3 Trust Returns | | | | |
| T5013 Partnership Returns | | | | |
| Estimated Tax Installments | | | | |
| HST/GST Filing | | | | |
| Audit / CRA Review Windows | | | | |
| K-1 / Slip Distribution | | | | |

### D. Lender & Investor Reporting

| Report | Frequency | GAAP vs. Tax Basis | Recipient | Timing | Notes |
|--------|-----------|-------------------|-----------|--------|-------|
| Financial Statements | | | | | |
| Waterfall / Distribution Calcs | | | | | |
| K-1 / T5013 Slips | | | | | |
| Covenant Compliance | | | | | |
| Investor Quarterly Update | | | | | |
| Annual Audit Package | | | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (tax / estate) | | | |
| Brokerage (disposition timing) | | | |
| Consulting (structure optimization) | | | |
| Cost segregation studies | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Investors needing tax advice | | |
| Developers needing entity setup | | |
| Lawyers (tax / corporate) | | |
| Other accountants (specialized) | | |
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

### D. Allocation Strategy & Targets

| Asset Class | Target % | Current % | Geography | Vintage Preference | Notes |
|-------------|----------|-----------|-----------|-------------------|-------|
| Core / Core-Plus | | | | | |
| Value-Add | | | | | |
| Opportunistic | | | | | |
| Debt / Mezzanine | | | | | |
| Fund Investments | | | | | |

---

## XVII. PORTFOLIO CONSTRUCTION & GOVERNANCE

### A. Portfolio Construction Parameters

| Dimension | Parameters |
|-----------|-----------|
| Target Portfolio Size | |
| Diversification Requirements | |
| Geographic Constraints | |
| Vintage Year Targets | |
| Liquidity Requirements | |
| Currency / FX Policy | |
| ESG / Impact Mandate | |

### B. Fund / Vehicle Structure

| Dimension | Detail |
|-----------|--------|
| Vehicle Type | open-end / closed-end / separate account |
| Fund Term | |
| Distribution Schedule | |
| Redemption / Liquidity | |
| Fee Structure (Mgmt / Carry) | |
| GP Commitment / Co-Invest | |

### C. Reporting & Governance

| Requirement | Frequency | Format | Notes |
|-------------|-----------|--------|-------|
| Board / IC Approval Process | | | |
| Mandate Constraints | | | |
| NAV / Valuation Reporting | | | |
| ESG / Impact Reporting | | | |
| Investor Letters / Updates | | | |
| Annual Meeting / AGM | | | |

### D. Manager Selection Criteria

| Criterion | Minimum Requirement | Preferred | Notes |
|-----------|-------------------|-----------|-------|
| GP Track Record (years) | | | |
| AUM Threshold | | | |
| Team Stability | | | |
| Co-Investment Rights | | | |
| Separate Account Willingness | | | |
| Reporting Standards (GIPS/INREV) | | | |
| ESG Integration | | | |

---

## XVIII. RELATIONSHIPS & ALLOCATIONS

### A. GP / Manager Relationships

| GP / Manager | Strategy | # Allocations | Total Committed | Performance | Relationship |
|-------------|----------|---------------|-----------------|-------------|--------------|
| | | | | | |

### B. Co-Investor Network

| Co-Investor | Type | # Deals Together | Total Volume | Relationship |
|-------------|------|-----------------|--------------|--------------|
| | | | | |

### C. Advisory / Consultant Team

| Advisor | Role | Firm | Influence Level | Relationship Quality |
|---------|------|------|-----------------|---------------------|
| | | | | |

### D. Service Provider Preferences

| Service | Current Provider | Satisfaction | My Opportunity |
|---------|------------------|--------------|----------------|
| Brokerage | | | |
| Legal | | | |
| Appraisal | | | |
| Property Management | | | |
| Accounting / Fund Admin | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (portfolio valuation) | | | |
| Market research / analytics | | | |
| Consulting (asset strategy) | | | |
| Brokerage (sourcing / disposition) | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Other allocators / LPs | | |
| Fund managers / GPs | | |
| Operating partners | | |
| Placement agents | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // loans.md — Mortgage Broker / Loan Officer (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'loans.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: loans
lastUpdated: {{date}}
---

# {{name}} - Loan Pipeline & History

## XVI. LOAN TRACKING

### A. Originator Profile

| Metric | Value |
|--------|-------|
| Total Loans Tracked | |
| Primary Loan Types | |
| Firm/Company | |
| NMLS # | |
| Avg. Loan Size | |
| Primary Market | |

### B. Active Loan Pipeline

| Borrower | Property | Loan Type | Amount | Rate | LTV | Status | Est. Close |
|----------|----------|-----------|--------|------|-----|--------|------------|
| | | | | | | | |

### C. Closed Loans (Last 24 Months)

| Close Date | Borrower | Property | Loan Type | Amount | Rate | Term | My Involvement |
|------------|----------|----------|-----------|--------|------|------|----------------|
| | | | | | | | |

### D. Lost/Declined Loans

| Date | Borrower | Reason | Lessons |
|------|----------|--------|---------|
| | | | |

---

## XVII. PRODUCT & RATE ANALYSIS

### A. Product Specialization

| Loan Product | Experience Level | # Deals | Avg. Size | Notes |
|--------------|------------------|---------|-----------|-------|
| Conventional | | | | |
| FHA/VA | | | | |
| Commercial | | | | |
| CMBS | | | | |
| Bridge/Hard Money | | | | |
| Construction | | | | |
| SBA | | | | |

### B. Rate Competitiveness

| Product | Typical Rate Spread | Market Position | Last Quoted Date | vs. Market | Notes |
|---------|---------------------|-----------------|-----------------|------------|-------|
| | | | | | |

### C. Turnaround & Performance

| Dimension | Assessment | Evidence |
|-----------|------------|----------|
| Application to Close Time | | |
| Approval Rate | | |
| Lock Accuracy | | |
| Communication During Process | | |

### D. Regulatory & Compliance

| Requirement | Status | Details |
|-------------|--------|---------|
| NMLS Registration | | |
| State Licensing | | |
| TRID Compliance | | |
| RESPA Compliance | | |
| Continuing Education | | |
| E&O Insurance | | |

---

## XVIII. LENDER RELATIONSHIPS

### A. Wholesale Lender Relationships

| Lender | Products | Volume | Relationship | AE Contact |
|--------|----------|--------|--------------|------------|
| | | | | |

### B. Bank/Credit Union Relationships

| Institution | Products | Approval Flexibility | Relationship | Notes |
|-------------|----------|---------------------|--------------|-------|
| | | | | |

### C. Investor/Private Lender Network

| Lender | Type | Typical Terms | Relationship | My Referral Value |
|--------|------|---------------|--------------|-------------------|
| | | | | |

---

## XIX. REFERRAL TRACKING

### A. Referrals FROM This Contact

| Date | Referral Type | Who/What Referred | Outcome | Fee/Thank You |
|------|---------------|-------------------|---------|---------------|
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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal for lending | | | |
| Investment advisory | | | |
| Brokerage referrals | | | |
| Consulting | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Borrowers needing appraisal | | |
| Investors seeking financing | | |
| Developers needing construction loans | | |
| Other professionals | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // acquisitions.md — Land Agent / ROW Specialist (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'acquisitions.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: acquisitions
lastUpdated: {{date}}
---

# {{name}} - Land Acquisition History

## XVI. ACQUISITION TRACKING

### A. Agent Profile

| Metric | Value |
|--------|-------|
| Total Acquisitions Tracked | |
| Primary Acquisition Type | |
| Organization/Utility | |
| Geographic Coverage | |
| Primary Project Types | |
| Certification/Designation | |

### B. Active Acquisitions

| Parcel/Owner | Project | Location | Type | Acreage | Offer | Status | Est. Close |
|--------------|---------|----------|------|---------|-------|--------|------------|
| | | | | | | | |

### C. Completed Acquisitions (Last 24 Months)

| Close Date | Parcel/Owner | Project | Type | Acreage | Compensation | My Involvement |
|------------|--------------|---------|------|---------|--------------|----------------|
| | | | | | | |

### D. Stalled/Disputed Parcels

| Parcel/Owner | Project | Issue | Status | Resolution Strategy |
|--------------|---------|-------|--------|---------------------|
| | | | | |

---

## XVII. SPECIALIZATION ANALYSIS

### A. Acquisition Type Experience

| Acquisition Type | Experience Level | # Deals | Notes |
|------------------|------------------|---------|-------|
| Fee Simple Purchase | | | |
| Easement/ROW | | | |
| Temporary Construction | | | |
| Expropriation/Eminent Domain | | | |
| Lease/License | | | |
| Option Agreement | | | |

### B. Project Type Experience

| Project Type | # Assignments | Notable Projects | Notes |
|--------------|---------------|------------------|-------|
| Transmission Lines | | | |
| Pipelines | | | |
| Highway/Road | | | |
| Rail | | | |
| Renewable Energy | | | |
| Telecommunications | | | |

### C. Landowner Negotiation Approach

| Dimension | Assessment | Evidence |
|-----------|------------|----------|
| Rapport Building | | |
| Compensation Fairness | | |
| Deadline Management | | |
| Dispute Resolution | | |
| Community Relations | | |

### D. Regulatory & Legal Context

| Jurisdiction | Governing Act | Expropriation Authority | Key Provisions | Notes |
|-------------|---------------|------------------------|----------------|-------|
| Ontario | Expropriations Act | | | |
| Federal | National Energy Board Act | | | |
| | | | | |

### E. Subcontractor / Team Network

| Vendor | Service | Relationship | Quality | Notes |
|--------|---------|--------------|---------|-------|
| | Surveying | | | |
| | Environmental Assessment | | | |
| | Appraisal / Compensation | | | |
| | Legal (Expropriation) | | | |
| | Archaeological | | | |
| | Arborist | | | |

---

## XVIII. CLIENT & PROJECT RELATIONSHIPS

### A. Key Clients (Utilities/Agencies)

| Client | Type | # Projects | Relationship | Primary Contact |
|--------|------|------------|--------------|-----------------|
| | | | | |

### B. Landowner Relationship Patterns

| Pattern | Assessment | Evidence |
|---------|------------|----------|
| Repeat Landowner Success | | |
| Dispute Rate | | |
| Average Settlement Time | | |
| Community Reputation | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal / compensation valuation | | | |
| Route optimization consulting | | | |
| Landowner negotiation support | | | |
| GIS / mapping services | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Utility / infrastructure clients | | |
| Other ROW agents | | |
| Environmental consultants | | |
| Legal counsel (expropriation) | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // closings.md — Title/Escrow Officer (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'closings.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: closings
lastUpdated: {{date}}
---

# {{name}} - Closing & Title History

## XVI. CLOSING TRACKING

### A. Officer Profile

| Metric | Value |
|--------|-------|
| Total Closings Tracked | |
| Company | |
| Primary Transaction Types | |
| Geographic Coverage | |
| Avg. Turnaround Time | |
| Typical Deal Size | |

### B. Active Closings Pipeline

| Transaction | Property | Type | Buyer/Seller | Amount | Status | Est. Close | My Role |
|-------------|----------|------|--------------|--------|--------|------------|---------|
| | | | | | | | |

### C. Completed Closings (Last 24 Months)

| Close Date | Transaction | Property | Type | Amount | Turnaround | Issues | My Involvement |
|------------|-------------|----------|------|--------|------------|--------|----------------|
| | | | | | | | |

### D. Problem Closings / Delays

| Date | Transaction | Issue | Resolution | Time to Resolve | Lessons |
|------|-------------|-------|------------|-----------------|---------|
| | | | | | |

---

## XVII. CAPABILITY ANALYSIS

### A. Transaction Type Experience

| Transaction Type | Experience Level | # Closings | Notes |
|------------------|------------------|------------|-------|
| Residential Resale | | | |
| Commercial Sale | | | |
| Refinance | | | |
| New Construction | | | |
| 1031 Exchange | | | |
| Short Sale/REO | | | |
| Bulk/Portfolio | | | |

### B. Title Issue Resolution

| Issue Type | Experience | Resolution Approach | Success Rate |
|------------|------------|---------------------|--------------|
| Chain of Title Defects | | | |
| Lien Resolution | | | |
| Survey Discrepancies | | | |
| Judgment/Tax Issues | | | |
| Estate/Probate | | | |
| Boundary Disputes | | | |

### C. Performance Metrics

| Dimension | Assessment | Evidence |
|-----------|------------|----------|
| Turnaround Time | | |
| Error Rate | | |
| Communication Quality | | |
| Proactive Issue Detection | | |
| After-Hours Availability | | |

### D. Technology & Process

| Capability | Status | Platform/Tool | Notes |
|-----------|--------|---------------|-------|
| E-Closing / Remote Closing | | | |
| Remote Online Notarization (RON) | | | |
| Digital Title Search Platform | | | |
| Automated Title Commitment | | | |
| Electronic Document Signing | | | |
| Wire Fraud Prevention Protocol | | | |

---

## XVIII. UNDERWRITER & LENDER RELATIONSHIPS

### A. Title Insurance Underwriters

| Underwriter | Products | Volume | Relationship | Key Contact |
|-------------|----------|--------|--------------|-------------|
| | | | | |

### B. Lender Relationships

| Lender | # Closings | Preferred Status | Notes |
|--------|------------|------------------|-------|
| | | | |

### C. Attorney/Notary Network

| Professional | Type | Jurisdiction | Relationship | Notes |
|--------------|------|-------------|--------------|-------|
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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal for transactions | | | |
| Brokerage introductions | | | |
| Consulting (title clearance) | | | |
| 1031 exchange coordination | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Buyers/Sellers needing title | | |
| Lenders needing closings | | |
| Attorneys needing title work | | |
| Real estate agents | | |
`,

  // ════════════════════════════════════════════════════════════════════════
  // investments.md — Investor / Principal (ENRICHED)
  // ════════════════════════════════════════════════════════════════════════
  'investments.md': (p) => `---
contactName: "{{name}}"
dossierCode: "{{dossierCode}}"
profession: "${p.code}"
tier: investments
lastUpdated: {{date}}
---

# {{name}} - Investment Portfolio & History

## XVI. INVESTMENT TRACKING

### A. Investor Profile

| Metric | Value |
|--------|-------|
| Investor Type | |
| Total Investments Tracked | |
| Estimated AUM | |
| Primary Asset Classes | |
| Geographic Focus | |
| Investment Style | |
| Capital Available for New Deals | |
| LP/GP Status | |

### B. Current Portfolio Holdings

| Property/Fund | Location | Asset Class | Size | Acquisition Date | Basis | Est. Current Value | Ownership % |
|--------------|----------|-------------|------|------------------|-------|-------------------|-------------|
| | | | | | | | |

### C. Recent Dispositions (Last 24 Months)

| Sale Date | Property/Fund | Asset Class | Hold Period | Sale Price | IRR | Equity Multiple | My Involvement |
|-----------|--------------|-------------|-------------|------------|-----|-----------------|----------------|
| | | | | | | | |

### D. Active Acquisition Pipeline

| Target | Location | Asset Class | Size | Underwritten Price | Target IRR | Stage | My Opportunity |
|--------|----------|-------------|------|-------------------|------------|-------|----------------|
| | | | | | | | |

---

## XVII. INVESTMENT STRATEGY ANALYSIS

### A. Investment Criteria

| Dimension | Criteria |
|-----------|----------|
| Target Returns (IRR) | |
| Equity Multiple Expectation | |
| Preferred Hold Period | |
| Leverage Preference | |
| Minimum Deal Size | |
| Maximum Deal Size | |
| Risk Profile | |
| Value-Add vs. Core | |

### B. Asset Class Preferences

| Asset Class | # Investments | Total Value | Avg. Hold Period | Performance | Notes |
|-------------|---------------|-------------|------------------|-------------|-------|
| Office | | | | | |
| Industrial | | | | | |
| Retail | | | | | |
| Multifamily | | | | | |
| Land | | | | | |
| Specialty | | | | | |

### C. Capital Structure Patterns

| Dimension | Pattern | Evidence |
|-----------|---------|----------|
| Equity Source | | |
| Typical Leverage | | |
| Preferred Debt Structure | | |
| Co-Investment Approach | | |

### D. Tax & Structure Strategy

| Strategy | Usage | Evidence | Notes |
|----------|-------|----------|-------|
| 1031 Exchange | | | |
| Opportunity Zones | | | |
| Cost Segregation / Bonus Depreciation | | | |
| Delaware Statutory Trust (DST) | | | |
| Tenancy-in-Common (TIC) | | | |
| UPREIT Contribution | | | |

### E. Deal Sourcing Patterns

| Source | Frequency | Success Rate | Notes |
|--------|-----------|--------------|-------|
| Broker-marketed (on-market) | | | |
| Off-market / direct | | | |
| Auction / competitive bid | | | |
| Distress / workout | | | |
| Relationship-driven | | | |
| Platform / marketplace | | | |

---

## XVIII. LP/GP RELATIONSHIPS

### A. If GP — LP Relationships

| LP/Investor | Type | Commitment | # Deals | Relationship | Notes |
|-------------|------|------------|---------|--------------|-------|
| | | | | | |

### B. If LP — GP/Sponsor Relationships

| GP/Sponsor | Type | # Investments | Total Committed | Performance | Relationship |
|------------|------|---------------|-----------------|-------------|--------------|
| | | | | | |

### C. Advisory Team

| Advisor | Role | Firm | Influence Level |
|---------|------|------|-----------------|
| | | | |

### D. My Opportunity Assessment

| Service Gap | Current Provider | Satisfaction | My Approach | Status |
|-------------|------------------|--------------|-------------|--------|
| Brokerage | | | | |
| Appraisal / Valuation | | | | |
| Consulting / Advisory | | | | |
| Property Management | | | | |
| Legal | | | | |
| Accounting/Tax | | | | |

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
| CMHC Programs (Canada) | | | |
| Provincial Housing Corp | | | |
| Co-operative Housing | | | |
| Inclusionary Zoning | | | |

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

### D. Application & Allocation Workflow

| Phase | Typical Timeline | Key Requirements | Pitfalls | Notes |
|-------|-----------------|------------------|----------|-------|
| Application Cycle / Intake | | | | |
| Allocation / Award | | | | |
| Syndication / Capital Close | | | | |
| Construction / Rehab | | | | |
| Placed-in-Service (PIS) | | | | |
| Initial Compliance Certification | | | | |

### E. Compliance Monitoring Detail

| Requirement | Frequency | Method | Risk Level | Notes |
|-------------|-----------|--------|------------|-------|
| Annual Tenant Certification | | | | |
| IRS Form 8823 Filing | | | | |
| Tenant File Audits | | | | |
| Physical Inspection | | | | |
| Utility Allowance Review | | | | |
| Income Recertification | | | | |

### F. Political & Community Relations

| Stakeholder | Relationship | Position on Affordable Housing | Influence | Notes |
|-------------|-------------|-------------------------------|-----------|-------|
| Municipal Council | | | | |
| Neighborhood Associations | | | | |
| Community Benefit Agreements | | | | |
| NIMBY Opposition Groups | | | | |
| Supportive Housing Advocates | | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (LIHTC / affordable) | | | |
| Market study / rent comparability | | | |
| Consulting (compliance advisory) | | | |
| Brokerage (portfolio disposition) | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Developers (affordable housing) | | |
| Syndicators / tax credit investors | | |
| Property managers (compliance) | | |
| Legal counsel (housing law) | | |
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

### D. KPI by Asset Type

| Asset Type | Primary KPI | Secondary KPI | Benchmark Source | Notes |
|------------|------------|---------------|------------------|-------|
| Hotels (Full-Service) | RevPAR | ADR / Occupancy | STR | |
| Hotels (Select-Service) | RevPAR | GOP per Key | STR | |
| Senior Living | NOI/Unit | Occupancy / Acuity Mix | NIC MAP | |
| Self-Storage | Revenue/SF | Physical vs. Economic Occ. | Yardi Matrix | |
| Student Housing | Revenue/Bed | Pre-Lease % | RealPage | |
| Medical Office | NOI/SF | Weighted Avg. Lease Term | | |

### E. Management Agreement Expertise

| Dimension | Knowledge | Evidence | Notes |
|-----------|-----------|----------|-------|
| HMA vs. Franchise Agreement | | | |
| Key Money / Owner Priority | | | |
| Performance Test Structure | | | |
| Termination Provisions | | | |
| Brand PIP Requirements | | | |
| FF&E Reserve Adequacy | | | |

---

## XVIII. CLIENT & OWNER RELATIONSHIPS

### A. Key Owners/Operators

| Owner/Operator | # Assets | Relationship Type | Decision Maker |
|----------------|----------|-------------------|----------------|
| | | | |

### B. Performance Benchmarking

| Asset | Key Metric | Performance | Comp Set Ranking | Data Source | Notes |
|-------|-----------|-------------|------------------|------------|-------|
| | | | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (hospitality / specialty) | | | |
| Market study / feasibility | | | |
| Brokerage (acquisition / disposition) | | | |
| Asset management consulting | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Hotel / specialty investors | | |
| Operators seeking management | | |
| Brands expanding markets | | |
| Other specialty professionals | | |
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
| Prevailing Wage / Union Status | |

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

### A. Service Expertise by Trade

| Trade / Service | Specialty Detail | Experience Level | Certifications | Notes |
|----------------|-----------------|------------------|----------------|-------|
| HVAC | Tonnage capacity, BAS integration | | | |
| Electrical | High voltage, fire alarm, generator | | | |
| Plumbing | Backflow prevention, medical gas | | | |
| Roofing | Flat / TPO / metal, warranty programs | | | |
| Fire Protection | Sprinkler, suppression, alarm | | | |
| Elevator/Vertical | Modernization, code compliance | | | |
| General Contracting | Tenant fit-up, base building | | | |
| Landscaping/Snow | Seasonal scope, salt/plow capacity | | | |

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

### C. Emergency Response History

| Date | Property | Issue | Response Time | After-Hours? | Resolution | Notes |
|------|----------|-------|-------------|-------------|-----------|-------|
| | | | | | | |

### D. Warranty & Guarantee Tracking

| Work/Project | Warranty Period | Start | Expiry | Callback History | Status |
|-------------|----------------|-------|--------|-----------------|--------|
| | | | | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (capital planning) | | | |
| Consulting (energy/sustainability) | | | |
| Project management (renovations) | | | |
| Property management referral | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Property managers needing trades | | |
| Developers needing subcontractors | | |
| Other trades (complementary) | | |
| Building owners (direct) | | |
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
| Valuation Methodology | | | |
| Market Analytics / Forecasting | | | |
| PropTech / AI in Real Estate | | | |
| ESG / Sustainability in RE | | | |
| Capital Markets / CMBS | | | |
| Land Use / Entitlements | | | |
| Infrastructure / Linear Assets | | | |
| Affordable Housing Policy | | | |

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

### C. Publication & Content Track Record

| Content Type | Title/Topic | Outlet/Venue | Date | Citations/Impact | Notes |
|-------------|------------|-------------|------|-----------------|-------|
| Research Report | | | | | |
| Conference Presentation | | | | | |
| Podcast / Webinar | | | | | |
| Published Article | | | | | |
| Industry Award / Recognition | | | | | |

### D. Engagement Model

| Dimension | Detail | Notes |
|-----------|--------|-------|
| Primary Billing Model | hourly / project / retainer | |
| Typical Engagement Size | | |
| Standard Deliverables | | |
| Retainer Availability | | |
| Subcontracting Willingness | | |

### E. Competitive Positioning

| Competitor | Overlap Area | Their Differentiator | My Differentiator | Notes |
|-----------|-------------|---------------------|-------------------|-------|
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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Valuation / appraisal expertise | | | |
| Market research collaboration | | | |
| Speaking / panel co-presentation | | | |
| Joint consulting engagement | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Clients needing consulting | | |
| Conference / event organizers | | |
| Publishers / media contacts | | |
| Other industry experts | | |
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
| Term / Appointment Cycle | |
| Next Reappointment / Election | |
| Vulnerability (Low/Med/High) | |

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

### D. Precedent Decisions

| Date | Application/Matter | Type | Decision | Rationale | Relevance to My Projects |
|------|-------------------|------|----------|-----------|--------------------------|
| | | | | | |

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

---

## XX. ENGAGEMENT STRATEGY

### A. Pre-Consultation Approach

| Phase | Recommended Approach | Notes |
|-------|---------------------|-------|
| Pre-Application Meeting | | |
| Staff Report Influence | | |
| Public Consultation | | |
| Committee/Council Hearing | | |
| Post-Decision Follow-Up | | |

### B. Communication Preferences

| Dimension | Preference | Notes |
|-----------|-----------|-------|
| Preferred Contact Method | | |
| Meeting Format (formal/informal) | | |
| Information Depth Preference | | |
| Political Sensitivity Level | | |
| Staff Report vs. Direct Advocacy | | |

### C. My Influence Map

| Approach | Effectiveness | Evidence |
|----------|-------------|----------|
| Technical data presentation | | |
| Community benefit framing | | |
| Precedent-based arguments | | |
| Third-party expert support | | |
| Public engagement strategy | | |
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

| Carrier | Relationship Level | Program Access | Binding Authority | Specialties |
|---------|-------------------|----------------|-------------------|-------------|
| | | | | |

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

### C. Coverage Gap Analysis

| Coverage Area | Current Status | Gap Identified | Recommended Addition | Priority |
|-------------|----------------|----------------|---------------------|----------|
| Earthquake / Seismic | | | | |
| Flood / Water Damage | | | | |
| Cyber Liability | | | | |
| Umbrella / Excess | | | | |
| Pollution / Environmental | | | | |
| Business Interruption | | | | |

### D. Claims Handling Process

| Dimension | Assessment | Evidence |
|-----------|-----------|----------|
| Filing Workflow / Ease | | |
| Adjuster Response Speed | | |
| Settlement Time (avg.) | | |
| Dispute Resolution Approach | | |
| Subrogation Aggressiveness | | |
| Client Advocacy Level | | |

### E. Market Cycle Awareness

| Dimension | Current Assessment | Notes |
|-----------|-------------------|-------|
| Market Phase | hard / soft / transitioning | |
| Carrier Appetite (by line) | | |
| Rate Trend Direction | | |
| Capacity Constraints | | |
| Reinsurance Market Impact | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (insurance valuation) | | | |
| Risk consulting (property) | | | |
| Loss prevention advisory | | | |
| Portfolio risk assessment | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Property owners needing coverage | | |
| Developers (builder's risk) | | |
| Lenders (force-placed insurance) | | |
| Other insurance professionals | | |
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

### D. Regulatory Credential Detail

| Credential | Status | Issuing Body | Expiry | Jurisdiction |
|-----------|--------|--------------|--------|-------------|
| QPESA (Qualified Person - ESA) | | | | |
| Designated Substances Surveyor | | | | |
| Record of Site Condition (RSC) | | | | |
| P.Eng / P.Geo | | | | |
| LEED AP / BOMA BESt | | | | |
| Radiation Safety Officer | | | | |

### E. Lab & Subcontractor Network

| Lab / Subcontractor | Service | Accreditation | Turnaround | Notes |
|---------------------|---------|---------------|-----------|-------|
| | Soil/Groundwater Analysis | | | |
| | Air Quality Monitoring | | | |
| | Asbestos/Lead Testing | | | |
| | Geotechnical Drilling | | | |
| | Biological Assessment | | | |

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
| Defensibility Under Challenge | | |

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

---

## XX. BUSINESS DEVELOPMENT OPPORTUNITIES

### A. Services They Need / My Opportunity

| Service | Current Provider | My Opportunity | Status |
|---------|------------------|----------------|--------|
| Appraisal (pre-acquisition due diligence) | | | |
| Consulting (remediation oversight) | | | |
| ROW / infrastructure assessment | | | |
| Litigation support (contamination) | | | |

### B. Referral Potential

| Referral Type | Likelihood | Notes |
|---------------|------------|-------|
| Developers needing Phase I/II | | |
| Lenders requiring environmental | | |
| Lawyers (contamination liability) | | |
| Other technical specialists | | |
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

    // Copy COMMON files (flat files + intelligence/ directory)
    for (const entry of readdirSync(COMMON_DIR)) {
      const src = join(COMMON_DIR, entry);
      const dest = join(profDir, entry);
      if (statSync(src).isDirectory()) {
        cpSync(src, dest, { recursive: true });
      } else {
        cpSync(src, dest);
      }
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
