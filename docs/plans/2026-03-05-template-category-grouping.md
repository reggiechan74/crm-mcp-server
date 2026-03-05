# RE-CRM Template Category Grouping — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nest 167 profession template directories under 18 lettered category folders matching the RE-CRM taxonomy (A through R).

**Architecture:** Update `templateDir` in `src/professions.ts` to include the category prefix (e.g., `'BROKER_SALES'` → `'A_BROKERAGE_SALES/BROKER_SALES'`). Update generator cleanup logic for nested paths. Both writer and generator already resolve paths via `join('re-crm', entry.templateDir)`, so no consumer code changes needed.

**Tech Stack:** TypeScript, Node.js fs, vitest

---

### Task 1: Update `templateDir` values in professions registry

**Files:**
- Modify: `src/professions.ts` (all 167 entries)

**Category folder mapping (derive from `categoryLetter` + `category` name):**

| Letter | Folder Name |
|--------|------------|
| A | `A_BROKERAGE_SALES` |
| B | `B_VALUATION_ADVISORY` |
| C | `C_DEVELOPMENT_CONSTRUCTION` |
| D | `D_PROPERTY_ASSET_MANAGEMENT` |
| E | `E_FINANCE_CAPITAL_MARKETS` |
| F | `F_LEGAL_COMPLIANCE` |
| G | `G_DESIGN_PLANNING` |
| H | `H_TECHNICAL_SPECIALTY` |
| I | `I_GOVERNMENT_MUNICIPAL` |
| J | `J_INSURANCE_RISK` |
| K | `K_CORPORATE_REAL_ESTATE` |
| L | `L_MARKETING_OPERATIONS` |
| M | `M_ACCOUNTING_FINANCE` |
| N | `N_INVESTMENT_PRINCIPAL` |
| O | `O_AFFORDABLE_PUBLIC_HOUSING` |
| P | `P_HOSPITALITY_SPECIALTY` |
| Q | `Q_BUILDING_TRADES` |
| R | `R_EDUCATION_PROFESSIONAL` |

**Step 1: Write a transformation script (run once, then delete)**

Create a temporary Node script that reads `professions.ts`, maps each `categoryLetter` + `category` to the folder name above, and rewrites every `templateDir` value from `'DIRNAME'` to `'X_CATEGORY/DIRNAME'`.

Alternatively, use targeted find-and-replace per category group in the editor. There are 18 groups, each with a consistent `categoryLetter` value. For each group, prepend the category folder to every `templateDir` in that block.

Example transformations:
```
// Category A — Brokerage & Sales
templateDir: 'BROKER_SALES'       → templateDir: 'A_BROKERAGE_SALES/BROKER_SALES'
templateDir: 'BROKER_LEASING'     → templateDir: 'A_BROKERAGE_SALES/BROKER_LEASING'

// Category B — Valuation & Advisory
templateDir: 'APPRAISER'          → templateDir: 'B_VALUATION_ADVISORY/APPRAISER'
templateDir: 'REVIEW_APPRAISER'   → templateDir: 'B_VALUATION_ADVISORY/REVIEW_APPRAISER'

// ... etc for all 18 categories
```

**Step 2: Run tests to verify registry integrity**

Run: `cd /home/codespace/crm-mcp-server && npm test 2>&1 | tail -10`

Expected: All 129 tests pass. The professions tests check `templateDir` is truthy and codes are unique — nested paths still satisfy both.

**Step 3: Commit**

```bash
git add src/professions.ts
git commit -m "refactor: nest templateDir paths under category folders"
```

---

### Task 2: Update generator cleanup logic for nested directories

**Files:**
- Modify: `scripts/generate-re-crm-templates.ts` (the `main()` function, lines ~3036-3089)

**Problem:** The `--force` flag currently does `rmSync(profDir)` per profession, which removes `re-crm/X_CATEGORY/DIRNAME`. But old flat directories (`re-crm/BROKER_SALES/`) from before this change won't be cleaned up. Also, if a category folder becomes empty after removing professions, it should be cleaned.

**Step 1: Update the `--force` cleanup**

Replace the current per-profession `rmSync` approach with a bulk cleanup that removes all directories under `TEMPLATES_DIR` except `COMMON` before regenerating:

```typescript
function main(): void {
  const forceRegenerate = process.argv.includes('--force');
  let created = 0;
  let skipped = 0;
  let regenerated = 0;

  // On --force, clean all generated directories (preserve COMMON)
  if (forceRegenerate) {
    for (const entry of readdirSync(TEMPLATES_DIR)) {
      if (entry === 'COMMON') continue;
      const fullPath = join(TEMPLATES_DIR, entry);
      if (statSync(fullPath).isDirectory()) {
        rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }

  for (const entry of Object.values(PROFESSIONS)) {
    const profDir = join(TEMPLATES_DIR, entry.templateDir);

    if (existsSync(profDir)) {
      skipped++;
      continue;
    }

    // Create directory (recursive handles category parent)
    mkdirSync(profDir, { recursive: true });

    // Copy COMMON files (flat files + intelligence/ directory)
    for (const item of readdirSync(COMMON_DIR)) {
      const src = join(COMMON_DIR, item);
      const dest = join(profDir, item);
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

    if (forceRegenerate) {
      regenerated++;
    } else {
      created++;
    }
  }

  if (forceRegenerate) {
    console.log(`Regenerated ${regenerated} profession template directories`);
  } else {
    console.log(`Generated ${created} profession template directories (${skipped} already existed)`);
  }
}
```

Key changes:
- Bulk cleanup at start instead of per-profession rmSync
- Renamed shadow variable `entry` → `item` in COMMON copy loop
- Count logic adjusted (regenerated = newly created after bulk wipe)

**Step 2: Run the generator**

Run: `cd /home/codespace/crm-mcp-server && npx tsx scripts/generate-re-crm-templates.ts --force`

Expected: `Regenerated 167 profession template directories`

**Step 3: Verify directory structure**

Run: `ls templates/re-crm/ | head -20`

Expected: `A_BROKERAGE_SALES`, `B_VALUATION_ADVISORY`, `C_DEVELOPMENT_CONSTRUCTION`, `COMMON`, etc.

Run: `ls templates/re-crm/A_BROKERAGE_SALES/`

Expected: `AUCTIONEER`, `BROKER_LEASING`, `BROKER_SALES`, `BUSINESS_BROKER`, `DEBT_EQUITY`, `INVESTMENT_SALES`, `LANDLORD_REP`, `NOTE_BROKER`, `REFERRAL_AGENT`, `TENANT_REP`

Run: `find templates/re-crm -name "*.md" -path "*/BROKER_SALES/*" | head -5`

Expected: Files like `templates/re-crm/A_BROKERAGE_SALES/BROKER_SALES/INDEX.md`

**Step 4: Run tests**

Run: `npm test`

Expected: 129/129 pass

**Step 5: Commit**

```bash
git add scripts/generate-re-crm-templates.ts templates/re-crm/
git commit -m "refactor: group generated templates under category folders"
```

---

### Task 3: Clean up old flat template directories from git

**Files:**
- Remove: `templates/re-crm/BROKER_SALES/`, `templates/re-crm/APPRAISER/`, etc. (all 167 old flat directories)

**Step 1: Verify old directories are gone from disk**

Run: `ls templates/re-crm/ | grep -v "^[A-R]_" | grep -v COMMON`

Expected: Empty (no flat directories remain). If any exist, the generator's bulk cleanup in Task 2 already removed them. Git will show them as deleted.

**Step 2: Stage removals and new paths**

Run: `git add -A templates/re-crm/`

**Step 3: Verify git status**

Run: `git status --short templates/re-crm/ | head -20`

Expected: Mix of `D` (deleted old flat paths) and `A` (added new nested paths), or `R` (renames) if git detects the move.

**Step 4: Run tests one final time**

Run: `npm test`

Expected: 129/129 pass

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove old flat template directories, complete category grouping"
```

---

### Verification Checklist

After all tasks:

1. `ls templates/re-crm/` shows 18 category folders + COMMON (19 entries)
2. `find templates/re-crm -maxdepth 2 -mindepth 2 -type d | wc -l` = 167
3. `npm test` = 129/129 pass
4. `npx tsx scripts/generate-re-crm-templates.ts --force` succeeds
5. No flat profession directories remain under `templates/re-crm/`
