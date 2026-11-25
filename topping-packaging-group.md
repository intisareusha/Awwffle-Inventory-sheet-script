# Topping / Packaging / Equipment Groups — Evaluation & Plan

**Status:** evaluation only. No code changed, no sheet touched, no calculation altered.
**Scope:** split `Equipments` into `Packaging` + `Equipments`, move Water to a `Resale` group and rename it, then add a `Summary → Food Cost` view.
**Hard constraint:** the waffle recipe cost that already works must stay exactly as it is.

---

## 0. Verdict

Safe and worth doing. **Group is a display/filter label; the maths key off `Population`.** Changing the Group column cannot change recipe cost, stock valuation, cash, or any historical row.

Two things need care, and neither is in the maths:

1. **Two sources of truth for Group.** The code catalogue (`ITEMS` in `02_ItemMaster.gs`) and the live `ItemMaster` sheet both carry Group. Setup seeds only *missing* rows and never updates an existing one, so both must be changed deliberately.
2. **`MANUAL_STOCK_GROUPS` gate.** If Packaging/Resale are not added, packaging items silently vanish from the Manual Stock form — and their usage then reads low, which quietly understates the very cost we are measuring.

The recipe cost is untouched because `batchCostPerPreparationFrom_` / `batchCostModel_` read only the Measurements matrix and weighted-average ingredient cost. They never read Group.

---

## 1. Decisions — locked

All answered. These are settled and are not to be re-opened during the build.

### Grouping

| # | Question | Ruling |
|---|---|---|
| 1 | Item split | **Yes** — Toppings 15, Resale 1, Packaging 6, Equipments 4, Recipes 17 = 43. No item renamed except Water (below). |
| 2 | Dropdown order | **Recipes → Toppings → Packaging → Equipments → Resale** |
| 3 | Water's group string | **`Resale`** |
| 4 | Missing packaging items | **None** — catalogue is complete |
| 5 | Water rename | **Rename `Water` → `Water 500ml` everywhere**, including historical rows |

### Packaging quantities

| # | Question | Ruling |
|---|---|---|
| 6 | Bento use | **0.5 bento per walk-in waffle.** One box has two sides and each waffle takes one side: 2 waffles = 1 box, 1 waffle = 1 box with one side wasted. The wasted half is still consumed stock, so use is **exactly 0.5 per walk-in waffle**. Delivery uses 0. |
| 7 | Poly bag | **≈5 gm per waffle** (weighed, not counted) |
| 8 | Waffle stick | **1 per waffle**, walk-in and delivery |
| 9 | Tissue | **Excluded from both A and B**, shown as a period expense. It has no per-waffle rule, so it cannot sit in the standard pack; for consistency it is removed from the actual per-waffle figure too. |
| 10 | Delivery count entry | **Not now** — back-solve the delivery share from Waffle Box usage |
| 11 | Packaging count cadence | **Monthly** |
| 12 | Blended totals | **Two totals**: A = standard pack, B = actual pack. Both exclude equipment. |

### Cost model

| # | Question | Ruling |
|---|---|---|
| 13 | Topping basis | **Count-to-count only.** No count brackets the range → "not measured". |
| 14 | Ice cream placement | **Include in toppings**, accept the standalone-sale overstatement |
| 15 | Water placement | **Separate resale line** — never in waffle food cost |
| 16 | Equipment placement | **Period expense only**, never per waffle |
| 17 | Topping count cadence | **Monthly** |
| 18 | Production denominator | **Batter batches × 24.8** |

Also locked from earlier: One Time box stays in **Equipments** (staff-only); the cost view lives in **`Summary → Food Cost`**; future juice/coffee/tea categories must not require a rewrite.

---

## 2. How the system actually works today (verified)

### 2.1 Group vs Population

| Field | Drives | Read from |
|---|---|---|
| `Group` | Display, dropdown grouping, filters only | Live `ItemMaster` for display (`11_Summary.gs:94-99`, `06_Bazar.gs:76-89`, `09_Stock.gs:523`); code `ITEMS` for countability (`13_Adjustments.gs:66-70`) |
| `Population` | **Every calculation** | Live `ItemMaster` in `computeStock_` (`09_Stock.gs:411-440`) |

- `Recipe-driven` → usage from `Measurements × Batches`.
- `Manual` → usage from Adjustments (`Out` / `In`) or derived from physical `Count` rows.
- `Resale` → usage from POS unit sales, via `posLink`.

### 2.2 The one real functional gate

`13_Adjustments.gs:32`:

```js
var MANUAL_STOCK_GROUPS = ['Toppings', 'Equipments'];
```

`isCountableItem_` requires the item's Group to be in that list **and** its Population to be `Manual` or `Resale`.

- Today: 16 Toppings + 10 Equipments = **26 countable items**. Water qualifies via Group `Toppings`.
- After the split the same 26 must remain countable. If the list is not extended, **7 items disappear** (6 Packaging + 1 Resale) and their usage reads low.
- Required: `['Toppings', 'Packaging', 'Equipments', 'Resale']`.

### 2.3 The Water rename — actual blast radius

Renaming the canonical item is not a one-line change. `resolveAlias_`/`findItem_` match by normalised name, so any history row still saying `Water` would **fail to resolve and be dropped** from valuation and usage.

| Location | What must change | Note |
|---|---|---|
| `02_ItemMaster.gs:71-72` | `name: 'Water 500ml'`; `posLink` now equals its own name | Keep `posLink` — it is the POS link, not a name lookup |
| `03b_PosProducts.gs:18-19` | `stockItem: 'Water'` → `'Water 500ml'` | `posStockLinks_` is built from this |
| `Bazar.Item`, `OpeningStock.Item`, `Adjustments.Item` | Rewrite existing rows | One-time updater, logged before/after |
| `Adjustments['Adjustment ID']` | **Do NOT change** `MIGRATED-USE-Water` | Migration's re-run guard keys on this ID; changing it would re-import the usage and double-count |
| `99_Tests.gs:238,239,246,1796` | Expect `Water 500ml` | Line 246's "only Water has a POS link" becomes `'Water 500ml'` |
| `MIGRATION_ALIASES` | Add `'water' → 'Water 500ml'` | Safety net so an un-renamed row can never be dropped silently |
| After the rename | Run `rebuildOpeningStock_()` | It keys opening quantity by Bazar `Item`, so it must be rebuilt after the rename |

The POS product is already `Water 500ml`, so stock item and POS product end up sharing a string. That is harmless here — they live in different sheets and are matched through `posLink`, never by assuming a name match.

### 2.4 Other verified dependencies

| Location | Dependency | Effect of the split |
|---|---|---|
| `99_Tests.gs:209-213` | Hard-coded `17 / 16 / 10` | Must become `17 / 15 / 6 / 4 / 1` |
| `11_Summary.gs:94-99` | Group dropdown built from the sheet | New groups appear automatically |
| `06_Bazar.gs:76-89` | Item dropdown grouped from the sheet | New headers appear; validation is by item **name**, so nothing breaks |
| `ui/Sidebar_Summary.html:364-374` | Display order `['Recipes','Toppings','Equipments']` | Cosmetic; update the order |
| `00_Config.gs:39` | `GROUPS` constant | Not used at runtime; update so it does not lie |
| `09_Stock.gs:899` | Stock view writes `Group` from the sheet | Same numbers; only the label changes |

**No transaction table carries Group.** `Bazar`, `Batches`, `POS_Snapshots`, `Adjustments`, `OpeningStock`, `PriceHistory` all reference items/products by name. Only the rename touches history, and only the Item column.

---

## 3. Proposed regrouping — still 43 items

| Group | Count | Items |
|---|---:|---|
| Recipes | 17 | unchanged |
| Toppings | 15 | all current toppings except Water (includes the 3 ice creams) |
| Resale | 1 | Water 500ml |
| Packaging | 6 | Waffle Sticks Large, Waffle Box, Waffle Tray, Bento Box, Poly bag, Tissue |
| Equipments | 4 | One Time box, Room Freshner, Arosole Spray, POS Roll |
| **Total** | **43** | |

---

## 4. What will NOT change (the recipe-cost guarantee)

| Figure | Why it is unaffected |
|---|---|
| Recipe cost per preparation / per waffle | `batchCostPerPreparationFrom_` loops the Measurements matrix (`11_Summary.gs:201-222`); `batchCostModel_` values those ingredients only (`11_Summary.gs:224-251`). No Group read. |
| Ingredient consumption | Derived from `Measurements × Batches` by Population (`09_Stock.gs:431-437`). |
| Weighted-average valuation | `itemCosting_` reads opening + purchases by item name only (`09_Stock.gs:81-158`). |
| Stock used cost / remaining value | Population-driven (`09_Stock.gs:487-489`). |
| Cash in hand, POS profit, invoices, discounts, dues | Group is never an input. |
| Historical rows | No transaction table stores Group; the rename touches only the `Item` string. |

The only observable change is labels and filters: the Stock summary gains `Packaging` and `Resale`, the Manual Stock form gains `Packaging`, and the Bazar item dropdown gains the same headers.

---

## 5. How to apply it safely (no data loss)

### 5.1 Code changes (one commit, reviewable)

1. `02_ItemMaster.gs` — regroups 11 items; renames Water; keeps `posLink`.
2. `00_Config.gs` — `GROUPS = ['Recipes','Toppings','Packaging','Equipments','Resale']`.
3. `13_Adjustments.gs` — `MANUAL_STOCK_GROUPS = ['Toppings','Packaging','Equipments','Resale']`.
4. `03b_PosProducts.gs` — `stockItem: 'Water 500ml'`.
5. `99_Tests.gs` — group counts `17 / 15 / 6 / 4 / 1`; Water assertions on the new name; keep the countable assertion.
6. `ui/Sidebar_Summary.html` — display order array.
7. Docs — `README §4.3`, `§17.3`, `Phase_Planning.md`, `docs/SUMMARY.md`, `docs/STOCK.md`.

### 5.2 One-time updaters (run once from the menu)

Both must be idempotent, match by normalised item name, never touch a row number, and log every before/after.

**`applyItemGroups_()`** — writes only the `Group` column, derived from `findItem_(name)` so code and sheet cannot disagree. Touches no rate, unit, population, threshold, ID, or note.

**`renameItem_('Water', 'Water 500ml')`** — rewrites only the `Item` column in `Bazar`, `OpeningStock` and `Adjustments`. Explicitly preserves each `Adjustment ID`. Reports unknown rows. Then calls `rebuildOpeningStock_()` and refreshes the Stock view.

**Order:** back up → paste files → `runSetup()` (no-op for existing rows) → `applyItemGroups_()` → `renameItem_()` → `runAllTests()` → check the four dropdowns.

### 5.3 Verification checklist

- [ ] `ItemMaster` still 43 rows; only Group (and Water's name) changed.
- [ ] Counts: 17 / 15 / 1 / 6 / 4.
- [ ] No `Water` row remains in `Bazar`, `OpeningStock`, `Adjustments`; `MIGRATED-USE-Water` ID unchanged.
- [ ] Opening stock value identical after the rebuild.
- [ ] Manual Stock form shows all 26 non-recipe items across 4 groups.
- [ ] Stock used cost, remaining value and total cost **identical** before and after.
- [ ] Total Recipe Cost in Summary → Batches **identical**.
- [ ] `runAllTests()` passes.

---

## 6. Cost model

### 6.1 Recipe cost — exact, unchanged

Existing `Total Recipe Cost` and per-waffle cost via `waffles per batch`. Do not touch it.

### 6.2 Denominators — kept separate, never mixed

| Denominator | Formula | Nature |
|---|---|---|
| Waffles sold | POS snapshots, `Kind = waffle` (`10_POS.gs:954-1009`) | exact |
| Waffles produced | Batter batches × 24.8 | exact |

Historical cross-check: **33.5 Batter batches × 24.8 = 830.8 ≈ 831 waffles sold.** Strong enough to trust the seed. Nutella Mix / Cream are not used as the production basis because their yields differ; White Mix and Cheese are seeded at 0.

### 6.3 Toppings — count-to-count only

A `Count` row is a *set-to* statement; usage is only recognised when a **later** count exists. With count-only tracking, a range not ending on a count shows purchases but not consumption.

Rules:

1. Usage cost for a window = `toppings used cost(as of later count) − toppings used cost(as of earlier count)`.
2. Show the two actual count dates on screen.
3. No bracketing counts → **"not measured"**. Never show a low number as if it were usage.
4. Acceptance: **ice cream stays inside Toppings** and its standalone sales are not netted out. This deliberately overstates waffle topping cost slightly.
5. Start live windows **after 16 Nov 2026**. Migration wrote one `Out` row per manual item dated `2026-11-16` (`05d_MigrationRest.gs:419-489`); ranges reaching back across it include that lump.
6. **Water renamed to Water 500ml must be excluded from this group's cost** — it now sits in `Resale`, which handles it automatically.

### 6.4 Packaging — standard pack vs actual

**Standard pack (rule-driven).** Uses the locked rules with weighted-average cost:

| Item | Held in | Walk-in | Delivery |
|---|---|---:|---:|
| Waffle Sticks Large | `p` | 1 | 1 |
| Bento Box | `p` | 0.5 | 0 |
| Waffle Box | `p` | 0 | 1 |
| Waffle Tray | `p` | 0 | 1 |
| Poly bag | `kg` | 5 gm | 5 gm |
| Tissue | `p` | — (excluded, period expense) | — (excluded, period expense) |

At current seeded rates that is roughly **5.17 walk-in** and **13.57 delivery** before weighted-average repricing. Illustrative only — the view must price from `itemCosting_`, not from seeds.

**Delivery share is back-solved, not assumed:**

```
deliveryShare      = Waffle Box used ÷ waffles sold          (0…1)
blended standard   = walkInCost × (1 − deliveryShare) + deliveryCost × deliveryShare
```

Clamp to 0…1 and label "derived from box usage". It is an inference, not a count.

**Bento — a physical fact, not an assumption.** One box has two sides; each side serves one waffle. So a walk-in customer buying 2 waffles uses exactly 1 box, and one buying 1 waffle still uses 1 box and leaves one side unused. **Both cases consume exactly 0.5 box per waffle sold**, so 0.5 is exact rather than an estimate. The unused half is not a modelling error and must not be "corrected" — it is a real cost the owner already pays, and it is why single-waffle walk-ins are the cheaper-margin sale.

Worth watching, not correcting: if the shop ever switches to a box that only fits one waffle, this constant becomes wrong and the actual-vs-standard gap will jump. That gap is the detector.

**Actual packaging (measured).** `Packaging group used cost ÷ waffles sold`, count-bracketed monthly. **Tissue is excluded from both A and B**: it has no per-waffle rule, so it cannot sit in the standard pack, and excluding it from actual too keeps A and B comparable. Tissue is reported as a **period expense** alongside equipment.

That choice has a cost worth stating plainly: actual packaging is now slightly *understated* by the tissue amount, and the Stock view's Packaging group total will still include tissue while this line does not. The tab must label the line "excludes tissue (period expense)" and the Packaging total must not be silently reconciled against it.

### 6.5 Equipment — period expense

Room Freshner, Arosole Spray, POS Roll, One Time box. Shown as used cost over the period, **never** divided per waffle.

### 6.6 Water and ice cream

- **Water 500ml** — resale COGS, separate line, matched against its own POS sales.
- **Ice cream** — inside Toppings by decision, with the overstatement accepted and stated once in the tab's note.

---

## 7. The finished view — `Summary → Food Cost`

A fourth tab beside Batches / Bazar / Stock. Date-range picker reused; everything recomputed on read; nothing stored.

**Section 1 — cost by line**

| Line | Source | Denominator | Nature |
|---|---|---|---|
| Recipe cost | Batches × measurement cost per batch | per waffle **produced** | exact |
| Topping cost | Toppings used-cost delta between counts (incl. ice cream) | per waffle **sold**, same window | estimate |
| Packaging — standard | per-waffle rules × weighted average, blended by back-solved delivery share; excludes tissue | per waffle **sold** | rule |
| Packaging — actual | Packaging group used cost **minus tissue** | per waffle **sold**, same window | estimate |
| Tissue | Tissue used cost | period | actual |
| Equipment | Equipments group used cost | period | actual |
| Waffles sold / produced | POS `Kind = waffle` / Batter × 24.8 | — | exact |
| Water (separate) | resale COGS | per Water sold | exact |

**Section 2 — two blended totals, equipment excluded**

| Total | Composition |
|---|---|
| **A — Standard** | Recipe + Toppings + standard packaging |
| **B — Actual** | Recipe + Toppings + actual packaging |

Both per waffle sold. A and B share the recipe and topping terms **and both exclude tissue and equipment**, so the gap isolates packaging method and waste alone. Label it that way.

Presentation rules: two blocks (production vs sales), never a blended denominator; every line tagged exact / estimate / rule; count dates shown; "not measured" when a boundary lacks a count; "excludes tissue (period expense)" on both packaging lines.

---

## 8. Future categories (juice / coffee / tea)

The view must take, as configuration rather than code:

- a **set of cost groups** (waffles: Toppings + Packaging; juice later: its own), and
- a **sales denominator** (`Kind = waffle`, or a product list for juice).

Tests should count from `ITEMS` rather than literal `17/15/6/4/1` wherever the assertion is not specifically about the catalogue, so adding a category later does not fail the suite for the wrong reason.

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `MANUAL_STOCK_GROUPS` not extended | **High (silent)** — packaging usage reads low | Extend in the same commit; checklist |
| Rename breaks historical resolution | **High (silent)** — rows dropped from valuation | Rewrite the three `Item` columns; add `water` alias; preserve `MIGRATED-USE-Water` ID; rebuild opening stock |
| Code `ITEMS` and sheet Group drift | Medium | One updater derived from `ITEMS`, logged |
| Old ranges include the 16 Nov lump | Medium — inflated usage | Start live windows after 16 Nov |
| A vs B misread as pure waste | Medium | Both totals exclude tissue and equipment, so the gap is packaging method + waste only; label it beside the totals |
| Tissue excluded from actual packaging, still in the Stock group total | Medium | Label the line "excludes tissue (period expense)"; never reconcile it against the Packaging group total |
| Bento constant goes stale if box type changes | Low | 0.5 is a physical fact today; the actual-vs-standard gap detects a change |
| Counting lapses | High for accuracy | "not measured"; monthly cadence agreed |
| Docs still say `Recipes / Toppings / Equipments`, or `Water` | Low | Update README §4.3 / §17.3 and `docs/` |

---

## 10. Confirm before build

One small point, with a safe default. No answer needed to start §5.1.

1. **Poly bag 5 gm** is an approximation. — *Default: seed 5; owner-editable per waffle.*

Resolved since the last review, no longer open:

- **Tissue** — excluded from both A and B; reported as a period expense (§6.4).
- **Bento** — 0.5 per walk-in waffle is exact, not an assumption: two sides per box, one waffle per side (§6.4).

---

## 11. What I will not do

- I will not change any calculation, valuation, cash, POS, or historical `Amount` / quantity.
- I will not rename, merge, or delete any item other than Water, as approved.
- I will not change an `Adjustment ID`, and therefore will not risk a double import.
- I will not add a per-waffle packaging rule based on a guessed channel mix.
- I will not present usage from a range with no bracketing counts as measured.
- I will not silently reconcile a tissue-excluded packaging line against the full Packaging group total.
- I will not touch the recipe cost model that is already working.

---

## Appendix — code evidence

| Claim | Evidence |
|---|---|
| Group is display/filter only | `11_Summary.gs:94-99`, `06_Bazar.gs:76-89`, `09_Stock.gs:523` |
| Population drives usage | `09_Stock.gs:411-440` |
| Recipe cost ignores Group | `11_Summary.gs:201-251` |
| Setup never updates existing items | `04_Setup.gs:313-325` |
| Countability gate | `13_Adjustments.gs:32, 66-70` |
| Hard-coded group counts | `99_Tests.gs:209-213` |
| Water name assertions | `99_Tests.gs:238, 239, 246, 1796` |
| POS link built from `stockItem` | `03b_PosProducts.gs:18-19, 63-64` |
| Waffles sold by Kind | `10_POS.gs:954-1009` |
| Manual usage lump dated 16 Nov | `05d_MigrationRest.gs:419-489` |
| Re-run guard on `MIGRATED-USE-` ID | `05d_MigrationRest.gs:464-467` |
| Summary tabs / menu | `ui/Sidebar_Summary.html:102-105`, `14_Menu.gs:32-35` |
