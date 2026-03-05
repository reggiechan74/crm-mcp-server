/**
 * RE-CRM Profession Taxonomy — 167 real estate profession types across 18 categories.
 *
 * Each entry maps a unique 3-letter profession code to metadata used for
 * dossier code generation, template resolution, and profession-specific tracking.
 */

export interface ProfessionEntry {
  code: string;           // 3-letter code, e.g. "BSB"
  name: string;           // Human-readable name, e.g. "Sales Broker/Agent"
  category: string;       // Category name, e.g. "Brokerage & Sales"
  categoryLetter: string; // Single letter, e.g. "A"
  templateDir: string;    // Template directory path, e.g. "A_BROKERAGE_SALES/BROKER_SALES"
  trackingFile: string;   // Profession-specific tracking file, e.g. "deals.md"
}

export const PROFESSIONS: Record<string, ProfessionEntry> = {
  // ── Category A: Brokerage & Sales (10) ──────────────────────────────
  BSB: { code: 'BSB', name: 'Sales Broker/Agent', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/BROKER_SALES', trackingFile: 'deals.md' },
  BLB: { code: 'BLB', name: 'Leasing Broker/Agent', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/BROKER_LEASING', trackingFile: 'deals.md' },
  BTR: { code: 'BTR', name: 'Tenant Representative', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/TENANT_REP', trackingFile: 'deals.md' },
  BLR: { code: 'BLR', name: 'Landlord Representative', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/LANDLORD_REP', trackingFile: 'deals.md' },
  BIS: { code: 'BIS', name: 'Investment Sales Broker', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/INVESTMENT_SALES', trackingFile: 'deals.md' },
  BDE: { code: 'BDE', name: 'Debt/Equity Placement', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/DEBT_EQUITY', trackingFile: 'deals.md' },
  BNB: { code: 'BNB', name: 'Note Broker', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/NOTE_BROKER', trackingFile: 'deals.md' },
  BBB: { code: 'BBB', name: 'Business Broker', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/BUSINESS_BROKER', trackingFile: 'deals.md' },
  BAU: { code: 'BAU', name: 'Auctioneer (RE)', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/AUCTIONEER', trackingFile: 'deals.md' },
  BRR: { code: 'BRR', name: 'Referral Agent', category: 'Brokerage & Sales', categoryLetter: 'A', templateDir: 'A_BROKERAGE_SALES/REFERRAL_AGENT', trackingFile: 'deals.md' },

  // ── Category B: Valuation & Advisory (8) ────────────────────────────
  VAP: { code: 'VAP', name: 'Appraiser (General)', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/APPRAISER', trackingFile: 'assignments.md' },
  VRA: { code: 'VRA', name: 'Review Appraiser', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/REVIEW_APPRAISER', trackingFile: 'assignments.md' },
  VCN: { code: 'VCN', name: 'Consultant/Advisor', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/CONSULTANT', trackingFile: 'engagements.md' },
  VMR: { code: 'VMR', name: 'Market Research Analyst', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/MARKET_RESEARCH', trackingFile: 'assignments.md' },
  VDD: { code: 'VDD', name: 'Due Diligence Specialist', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/DUE_DILIGENCE', trackingFile: 'assignments.md' },
  VVS: { code: 'VVS', name: 'Valuation Services (Big 4)', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/VALUATION_SERVICES', trackingFile: 'assignments.md' },
  VFA: { code: 'VFA', name: 'Financial Analyst (RE)', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/FIN_ANALYST', trackingFile: 'assignments.md' },
  VDS: { code: 'VDS', name: 'Data Scientist (RE/PropTech)', category: 'Valuation & Advisory', categoryLetter: 'B', templateDir: 'B_VALUATION_ADVISORY/DATA_SCIENTIST', trackingFile: 'assignments.md' },

  // ── Category C: Development & Construction (14) ─────────────────────
  DDV: { code: 'DDV', name: 'Developer/Principal', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/DEVELOPER', trackingFile: 'projects.md' },
  DDM: { code: 'DDM', name: 'Development Manager', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/DEV_MANAGER', trackingFile: 'projects.md' },
  DLA: { code: 'DLA', name: 'Land Agent/ROW Specialist', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/LAND_AGENT', trackingFile: 'acquisitions.md' },
  DAR: { code: 'DAR', name: 'Architect', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/ARCHITECT', trackingFile: 'projects.md' },
  DGC: { code: 'DGC', name: 'General Contractor', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/CONTRACTOR', trackingFile: 'projects.md' },
  DEN: { code: 'DEN', name: 'Engineer (Civil/Structural)', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/ENGINEER', trackingFile: 'projects.md' },
  DCM: { code: 'DCM', name: 'Construction Manager', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/CONSTRUCTION_MGR', trackingFile: 'projects.md' },
  DPM: { code: 'DPM', name: 'Project Manager (Construction)', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/PROJECT_MGR_CONST', trackingFile: 'projects.md' },
  DSU: { code: 'DSU', name: 'Superintendent', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/SUPERINTENDENT', trackingFile: 'projects.md' },
  DES: { code: 'DES', name: 'Estimator/Preconstruction', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/ESTIMATOR', trackingFile: 'projects.md' },
  DSC: { code: 'DSC', name: 'Subcontractor', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/SUBCONTRACTOR', trackingFile: 'projects.md' },
  DET: { code: 'DET', name: 'Entitlement Consultant', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/ENTITLEMENT', trackingFile: 'projects.md' },
  DOC: { code: 'DOC', name: "Owner's Representative", category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/OWNERS_REP', trackingFile: 'projects.md' },
  DPC: { code: 'DPC', name: 'Permit Expediter', category: 'Development & Construction', categoryLetter: 'C', templateDir: 'C_DEVELOPMENT_CONSTRUCTION/PERMIT_EXPEDITER', trackingFile: 'projects.md' },

  // ── Category D: Property & Asset Management (12) ────────────────────
  MPY: { code: 'MPY', name: 'Property Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/PROPERTY_MANAGER', trackingFile: 'portfolio.md' },
  MAM: { code: 'MAM', name: 'Asset Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/ASSET_MANAGER', trackingFile: 'portfolio.md' },
  MFM: { code: 'MFM', name: 'Facilities Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/FACILITIES_MANAGER', trackingFile: 'portfolio.md' },
  MBE: { code: 'MBE', name: 'Building Engineer', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/BUILDING_ENGINEER', trackingFile: 'portfolio.md' },
  MLC: { code: 'MLC', name: 'Leasing Coordinator', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/LEASING_COORD', trackingFile: 'portfolio.md' },
  MTC: { code: 'MTC', name: 'Tenant Coordinator (Retail)', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/TENANT_COORD', trackingFile: 'portfolio.md' },
  MRS: { code: 'MRS', name: 'Resident Services Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/RESIDENT_SERVICES', trackingFile: 'portfolio.md' },
  MHO: { code: 'MHO', name: 'HOA/Condo Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/HOA_MANAGER', trackingFile: 'portfolio.md' },
  MPO: { code: 'MPO', name: 'Portfolio Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/PORTFOLIO_MGR', trackingFile: 'portfolio.md' },
  MRM: { code: 'MRM', name: 'Regional Manager', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/REGIONAL_MGR', trackingFile: 'portfolio.md' },
  MLA: { code: 'MLA', name: 'Lease Administrator', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/LEASE_ADMIN', trackingFile: 'portfolio.md' },
  MCO: { code: 'MCO', name: 'Concierge/Luxury Services', category: 'Property & Asset Management', categoryLetter: 'D', templateDir: 'D_PROPERTY_ASSET_MANAGEMENT/CONCIERGE', trackingFile: 'portfolio.md' },

  // ── Category E: Finance & Capital Markets (16) ──────────────────────
  FMB: { code: 'FMB', name: 'Mortgage Broker', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/MORTGAGE_BROKER', trackingFile: 'loans.md' },
  FLO: { code: 'FLO', name: 'Loan Officer/Originator', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/LOAN_OFFICER', trackingFile: 'loans.md' },
  FUW: { code: 'FUW', name: 'Underwriter (Mortgage/CMBS)', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/UNDERWRITER', trackingFile: 'deals.md' },
  FLS: { code: 'FLS', name: 'Loan Servicer', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/LOAN_SERVICER', trackingFile: 'deals.md' },
  FSS: { code: 'FSS', name: 'Special Servicer/Workout', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/SPECIAL_SERVICER', trackingFile: 'deals.md' },
  FIR: { code: 'FIR', name: 'Investor Relations', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/INVESTOR_RELATIONS', trackingFile: 'deals.md' },
  FCR: { code: 'FCR', name: 'Capital Raiser', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/CAPITAL_RAISER', trackingFile: 'deals.md' },
  FFM: { code: 'FFM', name: 'Fund Manager', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/FUND_MANAGER', trackingFile: 'deals.md' },
  FPA: { code: 'FPA', name: 'Portfolio Analyst', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/PORTFOLIO_ANALYST', trackingFile: 'deals.md' },
  FAQ: { code: 'FAQ', name: 'Acquisitions Professional', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/ACQUISITIONS', trackingFile: 'deals.md' },
  FDS: { code: 'FDS', name: 'Dispositions Professional', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/DISPOSITIONS', trackingFile: 'deals.md' },
  FSY: { code: 'FSY', name: 'Syndicator/GP', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/SYNDICATOR', trackingFile: 'deals.md' },
  FCF: { code: 'FCF', name: 'Crowdfunding Platform Rep', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/CROWDFUNDING', trackingFile: 'deals.md' },
  FLN: { code: 'FLN', name: 'Commercial Lender (Bank)', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/COMM_LENDER', trackingFile: 'deals.md' },
  FEQ: { code: 'FEQ', name: 'Equity Partner/JV', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/EQUITY_PARTNER', trackingFile: 'deals.md' },
  FCD: { code: 'FCD', name: 'Credit Analyst', category: 'Finance & Capital Markets', categoryLetter: 'E', templateDir: 'E_FINANCE_CAPITAL_MARKETS/CREDIT_ANALYST', trackingFile: 'deals.md' },

  // ── Category F: Legal & Compliance (8) ──────────────────────────────
  LRE: { code: 'LRE', name: 'Real Estate Lawyer', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/LAWYER', trackingFile: 'matters.md' },
  LTE: { code: 'LTE', name: 'Title/Escrow Officer', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/TITLE_ESCROW', trackingFile: 'closings.md' },
  LTI: { code: 'LTI', name: 'Title Insurance Underwriter', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/TITLE_INSURANCE', trackingFile: 'matters.md' },
  LCO: { code: 'LCO', name: 'Compliance Officer', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/COMPLIANCE', trackingFile: 'matters.md' },
  LZA: { code: 'LZA', name: 'Zoning/Land Use Attorney', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/ZONING_ATTORNEY', trackingFile: 'matters.md' },
  LEA: { code: 'LEA', name: 'Environmental Attorney', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/ENVIRONMENTAL_ATT', trackingFile: 'matters.md' },
  LPA: { code: 'LPA', name: 'Paralegal (RE)', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/PARALEGAL', trackingFile: 'matters.md' },
  LCC: { code: 'LCC', name: 'Corporate Counsel (In-House)', category: 'Legal & Compliance', categoryLetter: 'F', templateDir: 'F_LEGAL_COMPLIANCE/CORP_COUNSEL', trackingFile: 'matters.md' },

  // ── Category G: Design & Planning (10) ──────────────────────────────
  GID: { code: 'GID', name: 'Interior Designer', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/INTERIOR_DESIGNER', trackingFile: 'projects.md' },
  GSP: { code: 'GSP', name: 'Space Planner', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/SPACE_PLANNER', trackingFile: 'projects.md' },
  GWS: { code: 'GWS', name: 'Workplace Strategist', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/WORKPLACE_STRATEGY', trackingFile: 'projects.md' },
  GUP: { code: 'GUP', name: 'Urban Planner', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/URBAN_PLANNER', trackingFile: 'projects.md' },
  GLS: { code: 'GLS', name: 'Landscape Architect', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/LANDSCAPE_ARCH', trackingFile: 'projects.md' },
  GHP: { code: 'GHP', name: 'Historic Preservation Specialist', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/HISTORIC_PRES', trackingFile: 'projects.md' },
  GAD: { code: 'GAD', name: 'Architectural Designer', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/ARCH_DESIGNER', trackingFile: 'projects.md' },
  GLD: { code: 'GLD', name: 'Lighting Designer', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/LIGHTING_DESIGNER', trackingFile: 'projects.md' },
  GSC: { code: 'GSC', name: 'Sustainability Consultant', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/SUSTAINABILITY', trackingFile: 'projects.md' },
  GVS: { code: 'GVS', name: 'Virtual Staging Specialist', category: 'Design & Planning', categoryLetter: 'G', templateDir: 'G_DESIGN_PLANNING/VIRTUAL_STAGING', trackingFile: 'projects.md' },

  // ── Category H: Technical & Specialty (14) ──────────────────────────
  TSV: { code: 'TSV', name: 'Surveyor (Licensed)', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/SURVEYOR', trackingFile: 'assessments.md' },
  TEV: { code: 'TEV', name: 'Environmental Consultant', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/ENVIRONMENTAL', trackingFile: 'assessments.md' },
  TGE: { code: 'TGE', name: 'Geotechnical Engineer', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/GEOTECHNICAL', trackingFile: 'assessments.md' },
  TBI: { code: 'TBI', name: 'Building Inspector (Private)', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/INSPECTOR', trackingFile: 'assessments.md' },
  THI: { code: 'THI', name: 'Home Inspector', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/HOME_INSPECTOR', trackingFile: 'assessments.md' },
  TEC: { code: 'TEC', name: 'Energy Consultant', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/ENERGY_CONSULTANT', trackingFile: 'assessments.md' },
  TSC: { code: 'TSC', name: 'Security Consultant', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/SECURITY', trackingFile: 'assessments.md' },
  TAC: { code: 'TAC', name: 'Acoustical Consultant', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/ACOUSTICAL', trackingFile: 'assessments.md' },
  TAV: { code: 'TAV', name: 'AV/Technology Consultant', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/AV_TECHNOLOGY', trackingFile: 'assessments.md' },
  TFF: { code: 'TFF', name: 'Furniture/FF&E Specialist', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/FFE_SPECIALIST', trackingFile: 'assessments.md' },
  TRP: { code: 'TRP', name: 'Real Estate Photographer', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/RE_PHOTOGRAPHER', trackingFile: 'assessments.md' },
  TDR: { code: 'TDR', name: 'Drone Operator/Aerial', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/DRONE_OPERATOR', trackingFile: 'assessments.md' },
  TVT: { code: 'TVT', name: 'Virtual Tour/3D Capture', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/VIRTUAL_TOUR', trackingFile: 'assessments.md' },
  TMS: { code: 'TMS', name: 'Moving/Storage Coordinator', category: 'Technical & Specialty', categoryLetter: 'H', templateDir: 'H_TECHNICAL_SPECIALTY/MOVING_STORAGE', trackingFile: 'assessments.md' },

  // ── Category I: Government & Municipal (8) ──────────────────────────
  GZO: { code: 'GZO', name: 'Zoning Official', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/ZONING_OFFICIAL', trackingFile: 'jurisdictions.md' },
  GBI: { code: 'GBI', name: 'Building Inspector (Govt)', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/BLDG_INSPECTOR_GOV', trackingFile: 'jurisdictions.md' },
  GPO: { code: 'GPO', name: 'Planning Official', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/PLANNING_OFFICIAL', trackingFile: 'jurisdictions.md' },
  GTA: { code: 'GTA', name: 'Tax Assessor', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/TAX_ASSESSOR', trackingFile: 'jurisdictions.md' },
  GED: { code: 'GED', name: 'Economic Development Officer', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/ECON_DEV', trackingFile: 'jurisdictions.md' },
  GPC: { code: 'GPC', name: 'Planning Commissioner', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/PLANNING_COMM', trackingFile: 'jurisdictions.md' },
  GHA: { code: 'GHA', name: 'Housing Authority Official', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/HOUSING_AUTH', trackingFile: 'jurisdictions.md' },
  GFM: { code: 'GFM', name: 'Fire Marshal', category: 'Government & Municipal', categoryLetter: 'I', templateDir: 'I_GOVERNMENT_MUNICIPAL/FIRE_MARSHAL', trackingFile: 'jurisdictions.md' },

  // ── Category J: Insurance & Risk (6) ────────────────────────────────
  JIB: { code: 'JIB', name: 'Insurance Broker', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/INSURANCE_BROKER', trackingFile: 'policies.md' },
  JRM: { code: 'JRM', name: 'Risk Manager', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/RISK_MANAGER', trackingFile: 'policies.md' },
  JCA: { code: 'JCA', name: 'Claims Adjuster', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/CLAIMS_ADJUSTER', trackingFile: 'policies.md' },
  JLC: { code: 'JLC', name: 'Loss Control Specialist', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/LOSS_CONTROL', trackingFile: 'policies.md' },
  JRE: { code: 'JRE', name: 'Risk Engineer', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/RISK_ENGINEER', trackingFile: 'policies.md' },
  JCW: { code: 'JCW', name: 'Catastrophe/Weather Specialist', category: 'Insurance & Risk', categoryLetter: 'J', templateDir: 'J_INSURANCE_RISK/CATASTROPHE', trackingFile: 'policies.md' },

  // ── Category K: Corporate Real Estate (7) ───────────────────────────
  KCR: { code: 'KCR', name: 'Corporate RE Director', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/CORPORATE_RE', trackingFile: 'portfolio.md' },
  KSS: { code: 'KSS', name: 'Site Selection Specialist', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/SITE_SELECTION', trackingFile: 'portfolio.md' },
  KRL: { code: 'KRL', name: 'Relocation Specialist', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/RELOCATION', trackingFile: 'portfolio.md' },
  KWP: { code: 'KWP', name: 'Workplace Services Manager', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/WORKPLACE_SERVICES', trackingFile: 'portfolio.md' },
  KPD: { code: 'KPD', name: 'Procurement/Vendor Manager', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/PROCUREMENT', trackingFile: 'portfolio.md' },
  KTM: { code: 'KTM', name: 'Transaction Manager', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/TRANSACTION_MGR', trackingFile: 'portfolio.md' },
  KST: { code: 'KST', name: 'Strategic Planning (RE)', category: 'Corporate Real Estate', categoryLetter: 'K', templateDir: 'K_CORPORATE_REAL_ESTATE/STRATEGIC_PLAN', trackingFile: 'portfolio.md' },

  // ── Category L: Marketing & Operations (10) ─────────────────────────
  LMK: { code: 'LMK', name: 'Marketing Coordinator', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/MARKETING_COORD', trackingFile: 'campaigns.md' },
  LLX: { code: 'LLX', name: 'Listing Coordinator', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/LISTING_COORD', trackingFile: 'campaigns.md' },
  LTC: { code: 'LTC', name: 'Transaction Coordinator', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/TRANSACTION_COORD', trackingFile: 'campaigns.md' },
  LOA: { code: 'LOA', name: 'Office Administrator', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/OFFICE_ADMIN', trackingFile: 'campaigns.md' },
  LRM: { code: 'LRM', name: 'Research Manager', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/RESEARCH_MGR', trackingFile: 'campaigns.md' },
  LPT: { code: 'LPT', name: 'PropTech Specialist', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/PROPTECH', trackingFile: 'campaigns.md' },
  LPR: { code: 'LPR', name: 'Public Relations (RE)', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/PR_SPECIALIST', trackingFile: 'campaigns.md' },
  LCM: { code: 'LCM', name: 'Communications Manager', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/COMMUNICATIONS', trackingFile: 'campaigns.md' },
  LDS: { code: 'LDS', name: 'Digital/Social Media', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/DIGITAL_MEDIA', trackingFile: 'campaigns.md' },
  LEM: { code: 'LEM', name: 'Event Manager (RE)', category: 'Marketing & Operations', categoryLetter: 'L', templateDir: 'L_MARKETING_OPERATIONS/EVENT_MANAGER', trackingFile: 'campaigns.md' },

  // ── Category M: Accounting & Finance (7) ────────────────────────────
  MCT: { code: 'MCT', name: 'Controller', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/CONTROLLER', trackingFile: 'entities.md' },
  MRA: { code: 'MRA', name: 'Real Estate Accountant', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/RE_ACCOUNTANT', trackingFile: 'entities.md' },
  MPA: { code: 'MPA', name: 'Property Accountant', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/PROPERTY_ACCT', trackingFile: 'entities.md' },
  MBK: { code: 'MBK', name: 'Bookkeeper', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/BOOKKEEPER', trackingFile: 'entities.md' },
  MTS: { code: 'MTS', name: 'Tax Specialist (RE)', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/TAX_SPECIALIST', trackingFile: 'entities.md' },
  MCF: { code: 'MCF', name: 'CFO/Finance Director', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/CFO', trackingFile: 'entities.md' },
  MAU: { code: 'MAU', name: 'Auditor (Internal/External)', category: 'Accounting & Finance', categoryLetter: 'M', templateDir: 'M_ACCOUNTING_FINANCE/AUDITOR', trackingFile: 'entities.md' },

  // ── Category N: Investment & Principal (7) ──────────────────────────
  NPI: { code: 'NPI', name: 'Principal/Owner', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/PRINCIPAL', trackingFile: 'investments.md' },
  NLP: { code: 'NLP', name: 'Limited Partner/Investor', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/LP_INVESTOR', trackingFile: 'holdings.md' },
  NFO: { code: 'NFO', name: 'Family Office', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/FAMILY_OFFICE', trackingFile: 'holdings.md' },
  NHN: { code: 'NHN', name: 'High Net Worth Individual', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/HNWI', trackingFile: 'holdings.md' },
  NIN: { code: 'NIN', name: 'Institutional Investor', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/INSTITUTIONAL', trackingFile: 'holdings.md' },
  NSO: { code: 'NSO', name: 'Sovereign Wealth/Pension', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/SOVEREIGN_PENSION', trackingFile: 'holdings.md' },
  NEN: { code: 'NEN', name: 'Endowment/Foundation', category: 'Investment & Principal', categoryLetter: 'N', templateDir: 'N_INVESTMENT_PRINCIPAL/ENDOWMENT', trackingFile: 'holdings.md' },

  // ── Category O: Affordable & Public Housing (6) ─────────────────────
  OAH: { code: 'OAH', name: 'Affordable Housing Manager', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/AFFORDABLE_MGR', trackingFile: 'programs.md' },
  OHS: { code: 'OHS', name: 'Housing Specialist', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/HOUSING_SPECIALIST', trackingFile: 'programs.md' },
  OCD: { code: 'OCD', name: 'Community Development', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/COMMUNITY_DEV', trackingFile: 'programs.md' },
  OTC: { code: 'OTC', name: 'Tax Credit Specialist', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/TAX_CREDIT', trackingFile: 'programs.md' },
  ORS: { code: 'ORS', name: 'Resident Services Coordinator', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/RESIDENT_SVCS', trackingFile: 'programs.md' },
  OFA: { code: 'OFA', name: 'Fair Housing Specialist', category: 'Affordable & Public Housing', categoryLetter: 'O', templateDir: 'O_AFFORDABLE_PUBLIC_HOUSING/FAIR_HOUSING', trackingFile: 'programs.md' },

  // ── Category P: Hospitality & Specialty Assets (8) ──────────────────
  PHA: { code: 'PHA', name: 'Hotel Asset Manager', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/HOTEL_ASSET', trackingFile: 'assets.md' },
  PHD: { code: 'PHD', name: 'Hospitality Developer', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/HOTEL_DEVELOPER', trackingFile: 'assets.md' },
  PSH: { code: 'PSH', name: 'Senior Housing Specialist', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/SENIOR_HOUSING', trackingFile: 'assets.md' },
  PSS: { code: 'PSS', name: 'Self-Storage Manager', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/SELF_STORAGE', trackingFile: 'assets.md' },
  PDC: { code: 'PDC', name: 'Data Center Specialist', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/DATA_CENTER', trackingFile: 'assets.md' },
  PLS: { code: 'PLS', name: 'Life Sciences RE Specialist', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/LIFE_SCIENCES', trackingFile: 'assets.md' },
  PSP: { code: 'PSP', name: 'Sports/Entertainment Venue', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/SPORTS_VENUE', trackingFile: 'assets.md' },
  PMH: { code: 'PMH', name: 'Manufactured Housing', category: 'Hospitality & Specialty Assets', categoryLetter: 'P', templateDir: 'P_HOSPITALITY_SPECIALTY/MANUFACTURED', trackingFile: 'assets.md' },

  // ── Category Q: Building Trades & Maintenance (8) ───────────────────
  QHV: { code: 'QHV', name: 'HVAC Technician', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/HVAC_TECH', trackingFile: 'services.md' },
  QPL: { code: 'QPL', name: 'Plumber', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/PLUMBER', trackingFile: 'services.md' },
  QEL: { code: 'QEL', name: 'Electrician', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/ELECTRICIAN', trackingFile: 'services.md' },
  QMT: { code: 'QMT', name: 'Maintenance Technician', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/MAINT_TECH', trackingFile: 'services.md' },
  QJA: { code: 'QJA', name: 'Janitorial/Cleaning', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/JANITORIAL', trackingFile: 'services.md' },
  QLN: { code: 'QLN', name: 'Landscaping/Grounds', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/LANDSCAPING', trackingFile: 'services.md' },
  QSE: { code: 'QSE', name: 'Security Personnel', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/SECURITY_PERSONNEL', trackingFile: 'services.md' },
  QPT: { code: 'QPT', name: 'Painter/Finishing', category: 'Building Trades & Maintenance', categoryLetter: 'Q', templateDir: 'Q_BUILDING_TRADES/PAINTER', trackingFile: 'services.md' },

  // ── Category R: Education & Professional Services (8) ───────────────
  REI: { code: 'REI', name: 'Real Estate Instructor', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/RE_INSTRUCTOR', trackingFile: 'engagements.md' },
  RRC: { code: 'RRC', name: 'Recruiter (RE Industry)', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/RE_RECRUITER', trackingFile: 'engagements.md' },
  RCH: { code: 'RCH', name: 'Coach/Mentor (RE)', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/RE_COACH', trackingFile: 'engagements.md' },
  RAS: { code: 'RAS', name: 'Association Executive', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/ASSOCIATION', trackingFile: 'engagements.md' },
  RJO: { code: 'RJO', name: 'Journalist/Editor (RE)', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/RE_JOURNALIST', trackingFile: 'engagements.md' },
  RSP: { code: 'RSP', name: 'Speaker/Thought Leader', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/SPEAKER', trackingFile: 'engagements.md' },
  RDP: { code: 'RDP', name: 'Data Provider Representative', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/DATA_PROVIDER', trackingFile: 'engagements.md' },
  RSW: { code: 'RSW', name: 'Software Vendor (RE)', category: 'Education & Professional Services', categoryLetter: 'R', templateDir: 'R_EDUCATION_PROFESSIONAL/SOFTWARE_VENDOR', trackingFile: 'engagements.md' },
};

/**
 * Look up a profession entry by its 3-letter code.
 */
export function lookupProfession(code: string): ProfessionEntry | undefined {
  return PROFESSIONS[code.toUpperCase()];
}

/**
 * Search professions by partial name match (case-insensitive).
 */
export function searchProfessions(query: string): ProfessionEntry[] {
  const q = query.toLowerCase();
  return Object.values(PROFESSIONS).filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
  );
}
