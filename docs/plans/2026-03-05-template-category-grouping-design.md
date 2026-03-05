# RE-CRM Template Category Grouping

**Date:** 2026-03-05
**Status:** Approved

## Problem

The `templates/re-crm/` directory contains 167 flat profession directories plus COMMON. Users browsing this directory see an overwhelming alphabetical list with no grouping by the 18-category taxonomy defined in the design doc.

## Solution

Nest profession directories under lettered category folders matching the taxonomy order (A through R). COMMON stays at the top level.

### Before

```
templates/re-crm/
├── COMMON/
├── BROKER_SALES/
├── APPRAISER/
├── DEVELOPER/
└── ... (167 flat directories)
```

### After

```
templates/re-crm/
├── COMMON/
├── A_BROKERAGE_SALES/
│   ├── BROKER_SALES/
│   ├── BROKER_LEASING/
│   └── ... (10 professions)
├── B_VALUATION_ADVISORY/
│   ├── APPRAISER/
│   └── ... (8 professions)
└── ... (18 categories, A through R)
```

## Category Folder Names

| Letter | Folder Name | # Professions |
|--------|------------|---------------|
| A | A_BROKERAGE_SALES | 10 |
| B | B_VALUATION_ADVISORY | 8 |
| C | C_DEVELOPMENT_CONSTRUCTION | 11 |
| D | D_PROPERTY_ASSET_MANAGEMENT | 8 |
| E | E_FINANCE_CAPITAL_MARKETS | 7 |
| F | F_LEGAL_COMPLIANCE | 7 |
| G | G_DESIGN_PLANNING | 7 |
| H | H_TECHNICAL_SPECIALTY | 13 |
| I | I_GOVERNMENT_MUNICIPAL | 7 |
| J | J_INSURANCE_RISK | 7 |
| K | K_CORPORATE_REAL_ESTATE | 7 |
| L | L_MARKETING_OPERATIONS | 10 |
| M | M_ACCOUNTING_FINANCE | 7 |
| N | N_INVESTMENT_PRINCIPAL | 7 |
| O | O_AFFORDABLE_PUBLIC_HOUSING | 7 |
| P | P_HOSPITALITY_SPECIALTY | 8 |
| Q | Q_BUILDING_TRADES | 10 |
| R | R_EDUCATION_PROFESSIONAL | 8 |

## Files Modified

1. **`src/professions.ts`** — Update 139 `templateDir` values: `'BROKER_SALES'` → `'A_BROKERAGE_SALES/BROKER_SALES'`
2. **`scripts/generate-re-crm-templates.ts`** — Update `--force` cleanup to handle category folders
3. **`src/writer.ts`** — No changes (already uses `join('re-crm', templateDir)`)
4. **Tests** — Should pass without changes (use registry's `templateDir`)

## Risk Areas

- **`--force` cleanup**: Must remove old flat directories and handle category-level cleanup
- **User `.templates/` overrides**: Existing installations with custom templates under `.templates/{templateDir}` need path updates
