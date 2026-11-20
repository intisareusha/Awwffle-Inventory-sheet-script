# Awwffle Build Plan — Phase by Phase

**Status:** Awaiting owner review
**Companion document:** `Awwffle_Inventory_System_README.md` (v0.3) — that document defines *what* to build. This one defines *how we work* and *in what order*.
**Source of truth for rules:** README §13. If this plan and the README ever disagree, the README wins.

---

## 1. Delivery strategy — phase by phase, not one go

**Decision: phase by phase.** Reasons, in order of importance:

1. **The README forbids a big-bang build.** §14 says "Do not attempt a full build before the data model and formulas are agreed." A single drop cannot satisfy that.
2. **Every phase has a checkable number.** The workbook gives known-good values (831 waffles, 104,940 Original Sale, 65,770 cash, 40/43 items reconciling). If a phase produces a different number, we catch it at that phase — not after nine phases of accumulated bugs.
3. **Mistakes get cheaper.** A wrong unit rule found in phase 2 costs one file. The same mistake found in phase 9 costs a migration rebuild and possibly corrupted live data.
4. **You can actually review it.** Nine small reviews are reviewable. One 4,000-line drop is not — you would have to trust it rather than check it.
5. **Live data safety.** Later phases write to the real spreadsheet. By then the schema is already verified by you, so the write paths are built against something agreed.

**Nothing is written to your live Google Sheet until phase 3 is approved by you.** Phases 2 onward run against a scratch copy.

### How a phase works

```
  I build the phase  →  I self-test  →  I hand you a review note  →  you check  →  you approve or correct
                                                                                        │
                                                          correct ◄─────────────────────┤
                                                             │                          │
                                                    I revise, re-hand            I commit, next phase
```

Each phase hand-off gives you:

- **What was built** — the files touched and why.
- **What to check yourself** — 3–6 concrete things, in plain language. e.g. "open Settings, confirm 43 items appear in the order you expect."
- **Test evidence** — the numbers my tests produced, next to the expected numbers.
- **What I chose and why** — any decision I had to make that the README did not cover, so you can overrule it.
- **What is deliberately not done yet** — so you are never surprised by absence.

You reply with anything: "ok", "change X", "why did you do Y". I revise and re-hand the same phase. **No phase is considered done without your explicit ok.**

### Commit discipline

- One commit per approved phase, message naming the phase. Nothing is committed before you approve it.
- `Current Blueprint.xlsx` is never modified by me. Read-only reference.
- Work-in-progress of an unapproved phase stays uncommitted.

---

## 2. Folder structure

The repository is the reference copy of the code. You copy from here into Apps Script by hand.

```
Awwffle-spreadsheet/
├── Awwffle_Inventory_System_README.md      # the requirements (v0.3)
├── Phase_Planning.md                       # this file
├── Current Blueprint.xlsx                  # read-only historical source
│
└── googlescript/                           # ← everything you paste into Apps Script
    │
    ├── 00_Config.gs                        # constants, sheet names, headers, feature flags
    ├── 01_Utils.gs                         # IDs, date helpers, validation, unit maths, logging
    ├── 02_ItemMaster.gs                    # the 43 items, groups, base units, per-piece weights
    ├── 03_Schema.gs                        # single definition of every sheet's columns
    ├── 04_Setup.gs                         # create sheets/headers/menus/protections; idempotent
    ├── 05_Migration.gs                     # import history from the Drive copy; reconciliation
    ├── 06_Bazar.gs                         # purchases, invoice refs, auto stock increase
    ├── 07_Measurements.gs                  # fixed recipe matrix (protected)
    ├── 08_Batches.gs                       # daily batch entry
    ├── 09_Stock.gs                         # consumption, weighted avg, remaining, est. days/batches
    ├── 10_POS.gs                           # Cr. Stock paste, snapshots, counter reset, invoices
    ├── 11_Sales.gs                         # sales derivation, discount/due, cash in hand, profit
    ├── 12_Reports.gs                       # All Time, monthly, date-range reports
    ├── 13_Adjustments.gs                   # wastage / damage / manual stock corrections
    ├── 14_Menu.gs                          # onOpen menu + all UI entry points
    ├── 99_Tests.gs                         # self-tests, hidden from the menu for daily use
    │
    ├── ui/
    │   ├── Sidebar_Bazar.html
    │   ├── Sidebar_Batches.html
    │   ├── Sidebar_POS.html
    │   ├── Sidebar_Adjustment.html
    │   └── common.html                     # shared CSS/JS, included by the others
    │
    └── docs/
        ├── SETUP.md                        # first-time install, step by step
        ├── UPDATE.md                       # how to apply a new version safely
        ├── MIGRATION.md                    # how to run the import and read its report
        ├── SHEETS.md                       # what each sheet is, and which cells are editable
        └── BACKUP.md                       # backup / restore procedure
```

### Why this shape

**Numbered `.gs` files.** Apps Script treats all files as one flat namespace and has no real folders — the "folder" here is a repository organisation that survives copy-paste. Numeric prefixes keep related code adjacent and make the paste order obvious, even though Apps Script hoists everything anyway. Names describe the module so you can find things without me.

**`03_Schema.gs` kept separate from `04_Setup.gs`.** Every sheet's columns live in one file. Setup reads it to create sheets; every other module reads it to find columns by name. Adding a column later is a one-line change plus a setup re-run, not a hunt through nine files for hard-coded column letters. This is the single most important structural choice for maintainability.

**`ui/` and `docs/` are repository-only.** Apps Script needs the HTML files, but it does not use the `ui/` path — you create `Sidebar_Bazar.html` etc. as flat files in the editor. The `docs/` folder is never pasted at all; it is for you to read.

**`99_Tests.gs` is real, not decoration.** It encodes the checkable numbers from README §14 as assertions. Running it after any change tells you immediately whether the rebuild still reproduces 831 / 104,940 / 65,770.

---

## 3. Sheet structure in the new workbook

Source records are narrow and append-only; every report is a filter over them (README §11, "one source, one truth").

**Source sheets (what the scripts write):**

| Sheet | Grain | Feeds |
|---|---|---|
| `Settings` | one row per setting | everything |
| `ItemMaster` | one row per inventory item | stock, bazar validation, reports |
| `ExpenseTypes` | one row per expense type | bazar |
| `Measurements` | one row per ingredient, one column per preparation | stock consumption |
| `Batches` | one row per production date | stock consumption |
| `Bazar` | one row per purchased item | stock purchases, expenses, cash |
| `POS_Snapshots` | one row per date per product | sales, invoices, profit |
| `POS_Products` | one row per POS product | sales, price history |
| `PriceHistory` | one row per price change | historic profit |
| `Invoices` | one row per date | invoice counts |
| `DiscountDue` | one row per date | cash in hand |
| `ClosedDays` | one row per closed date | all per-day averages |
| `Adjustments` | one row per wastage/adjustment | actual stock |

**View sheets (formula-driven, no data entry):**

`Stock`, `DailyWaffles`, `AllTime`, and one per month — all pivoted/filtered from the source sheets. Regenerating them never loses source data.

---

## 4. Phases

Each phase below lists: what it produces, what you review, and the gate that must pass.

---

### Phase 2 — Data model and configuration

**README:** §14.2, §6.1, §13.C, §13.D, §13.G

**Build:** `00_Config.gs`, `01_Utils.gs`, `02_ItemMaster.gs`, `03_Schema.gs`, `04_Setup.gs`

- The 43 items with group, display unit, base unit, per-piece weight (Nutella = 350 gm/piece, Whipped Cream in pieces, etc.).
- Unit conversion rules: `kg↔gm`, `l↔ml`, `p`, and the per-item special cases.
- Every sheet's column schema in one place.
- Setup that creates sheets, headers, protections, seeded Settings, and the menu — safely re-runnable.
- Dated price history, `waffles per batch`, cost benchmarks, low-stock thresholds as Settings rows.

**You review:**
1. Open the new spreadsheet. Do all 43 items appear, with the units you actually use?
2. Are Nutella and Whipped Cream counted in pieces, and Milk/Oil in litres?
3. Do the seeded `waffles per batch` values (24.8 / 33.2 / 63.9) look sane to you?
4. Run setup a second time — does anything duplicate or reset?

**Gate:** setup runs twice with no duplication; item master matches your real catalogue; unit conversions unit-tested.

---

### Phase 3 — Historical migration

**README:** §14.3, §9, §6.3, §17

**Build:** `05_Migration.gs`, `docs/MIGRATION.md`

- Import Measurements (17 rows, `Empty Container` excluded), Batches (30 records), Bazar (72 rows), 28 days of POS snapshots, October/November/All Time history.
- Opening stock snapshot as of **9 October 2026** (README §6.3), with October purchases replayed on top.
- All logged defect corrections applied and each one individually recorded: Milk `6 p → 6 l`, Item No regenerated 1–18, alias names mapped, `Kitkat ` whitespace stripped, `E29` literal replaced, duplicate expense block **deleted not migrated**.
- A **reconciliation report** sheet: source total vs imported total per item and per month.

**You review:**
1. Read the reconciliation report. Every correction is listed with before and after — do you accept each one?
2. Do the totals match: Bazar 53,890 / 39,050 / 92,940?
3. Does the imported Bazar row count match what you expect (72 rows)?
4. Are the aliases mapped the way you want (`Poly Bag`→`Poly bag`, `Kitkat (4 fingers)`→`Kitkat`, etc.)?

**Gate:** every README §14 fixture reproduces; every correction is logged; no source row silently dropped or changed.

---

### Phase 4 — Bazar and purchasing

**README:** §14.4, §5, §13.C

**Build:** `06_Bazar.gs`, `ui/Sidebar_Bazar.html`

- Entry form: date, expense type, item (validated against ItemMaster), unit, quantity, rate, ref, status.
- Amount always derived as `quantity × rate` after unit conversion — never typed.
- One row per item; several rows may share one `Ref` to form one invoice, added in a single sitting.
- Inventory purchases increase stock exactly once; the other four expense types never touch stock.
- Unknown item names rejected at entry, not silently created.

**You review:**
1. Add a multi-item invoice the way you would in real life. Is it faster than the old sheet?
2. Add a `Salary` expense — confirm stock does **not** move.
3. Add a `Flour 10 kg` purchase — confirm stock rises by exactly 10,000 gm.
4. Try typing a fake item — is it rejected clearly?

**Gate:** purchase increases stock exactly once; non-inventory expense never does; amount is always derived.

---

### Phase 5 — Measurements and Batches

**README:** §14.5, §3.1, §3.2

**Build:** `07_Measurements.gs`, `08_Batches.gs`, `ui/Sidebar_Batches.html`

- Fixed 17×5 matrix, protected, blanks preserved as blanks (not zeros).
- Daily batch form: date + fractional batch counts for the five preparations.
- Edit/delete a batch recalculates usage with no duplicate consumption.

**You review:**
1. Check the recipe matrix against what you actually mix. Any number wrong?
2. Enter a batch of `0.5 Batter` — does it accept fractional?
3. Correct a batch date — does the history follow?

**Gate:** fractional batches work; blanks stay blank; editing a batch does not double-count.

---

### Phase 6 — Stock calculations

**README:** §14.6, §3.3, §6.2, §6.2.1, §6.2.2

**Build:** `09_Stock.gs`

- Consumption per preparation from Measurements × Batches.
- Weighted-average cost; `remaining value + used cost = purchase spend` for every item.
- Est. Days using open days only; Est. Batch as the bottleneck preparation.
- Water as a POS-driven item; ice cream as manual topping stock.
- Low-stock and low-batch flags.

**You review:**
1. Pick three items — do used cost and remaining value add up to what you spent?
2. Does Est. Days read in *trading* days, and does it look believable?
3. Do low-stock flags point at things you actually need to buy?
4. Does Water's stock reflect POS water sales?

**Gate:** valuation identity holds for all items; estimates blank rather than wrong when data is thin.

---

### Phase 7 — POS snapshots and Daily Waffles

**README:** §14.7, §7, §13.A

**Build:** `10_POS.gs`, `ui/Sidebar_POS.html`

- Paste the whole six-column export; parse `৳`, thousands separators, two decimals.
- Snapshot per day per product; never overwrite yesterday.
- Counter reset detected and handled silently, cumulative total preserved.
- Last-invoice entry → derived daily count.
- Product order preserved exactly.

**You review:**
1. Paste a real POS export. Does it land cleanly?
2. Check units sold against the POS's own day summary.
3. Confirm the 10,000 baseline and that no day is overwritten.
4. Simulate a reset (set a counter near 0 next day) — is the sale positive and the total preserved?

**Gate:** a paste produces correct units sold; a reset loses nothing; history is never overwritten.

---

### Phase 8 — All Time and monthly reports

**README:** §14.8, §8, §8.4, §8.5

**Build:** `11_Sales.gs`, `12_Reports.gs`

- All Time and monthly views, all derived, zero typed totals.
- Closed-day list replaces the weekday rule; no off-by-one correction.
- Cash in hand = Original Sale − Due − Bazar, with Discount subtracted exactly once.
- Month boundaries and reports generated from data, not hand-built sheets.

**You review:**
1. All Time must read **831**, **104,940**, **54,094**, **65,770**, **28** working days.
2. October / November must read 494 / 337.
3. Is any figure a typed number instead of a formula? (There must be none.)
4. Does adding a closed day move the averages in a way that makes sense?

**Gate:** every README §14 fixture matches; no typed totals anywhere.

---

### Phase 9 — Cost, benchmark, and adjustments

**README:** §13.D, §13.C26, §13.G2

**Build:** `13_Adjustments.gs`, `ui/Sidebar_Adjustment.html` + cost reporting

- Cost per preparation batch (exact) and per waffle (via `waffles per batch`).
- Actual vs benchmark, so rising cost is visible while sales are low.
- Packaging as its own cost line.
- Wastage/damage adjustment entries, never double-counted as consumption.

**You review:**
1. Does batch cost per preparation look right to you?
2. Set a benchmark — does the comparison show clearly when you are over?
3. Log a wastage entry — does stock drop once, and only once?

**Gate:** batch cost exact; benchmark comparison works; wastage never counted twice.

---

### Phase 10 — Hardening, docs, and deployment

**README:** §14.10, §11, §15

**Build:** `99_Tests.gs` finalised, `docs/SETUP.md`, `UPDATE.md`, `SHEETS.md`, `BACKUP.md`

- Full acceptance-criteria pass (README §15) as executable tests.
- Update path proven: paste new files over old, run update, **no data lost**.
- Backup/export procedure documented and tested.

**You review:**
1. Follow `SETUP.md` yourself on a fresh copy. Did it work without asking me anything?
2. Follow `UPDATE.md` on a copy with data in it. Is the data intact?
3. Run the test suite — does it pass?

**Gate:** acceptance criteria all green; install reproducible from docs alone; update loses nothing.

---

## 5. Test fixtures we check against

From README §14. These are the numbers that prove the rebuild is correct.

| check | expected |
|---|---|
| All Time working days | 28 |
| All Time total waffles sold | 831 |
| October / November waffles sold | 494 / 337 |
| All Time Original Sale | 104,940 |
| All Time POS Cost | 54,094 |
| All Time cash in hand | 65,770 |
| October / November / All Time Bazar | 53,890 / 39,050 / 92,940 |
| Items reconciling stock vs purchases | 40 of 43 |
| Real used cost | 48,752.85 |
| Real cost per waffle | 58.67 |

---

## 6. Discrepancies found while planning — your decision needed

I inspected `Current Blueprint.xlsx` directly before writing this plan. Eleven things differ from what the README describes or were not documented. None is fatal, but several change what I build, so I will not guess. **Only four are true blockers** — listed as such in §7.

**D1 — `Expense For` holds the quantity, not an item name. (affects Phase 3, 4)** — **RULED: confirmed.** Rename to `Quantity` in the new schema.

README §5.2 and §17.7 describe the field as `Expense For / Item`. In the actual sheet, `Category` holds the item name (`Flour`) and `Expense For` holds the **quantity** (`10.5`). Verified: `10.5 kg × 80 = 840`, matching the stored amount.

- **Proposal:** treat `Expense For` as the historical quantity column during migration, rename it to `Quantity` in the new schema, and keep the item name in its own `Item` field. Nothing is lost; the old misleading name does not survive.
- **Need:** confirm that is what the column means to you.

**D2 — Product order is extras-first, not waffles-first. (affects Phase 3, 7)** — **RULED: keep the workbook order (extras first).**

README §7.3 lists the 12 waffles and then the 6 extras. The workbook — all three monthly sheets and Daily Waffles — puts the **6 extras first** (Item No 1–6), then the waffles (7–18). §7.3 also says "preserve the source workbook's actual item order."

- **Proposal:** follow the workbook (extras first), because that is what the POS export and your eye expect, and because the README tells you to preserve actual order. The §7.3 listing then becomes documentation of the groups, not a mandated sequence.
- **Need:** which order do you want to see on screen?

**D3 — `Poly bag` vs `Poly Bag` casing differs between sheets. (affects Phase 3)** — **RULED: one naming convention — canonical `Poly bag`.**

Stock says `Poly bag`; Bazar says `Poly Bag`. Not in the README's alias list.

- **Proposal:** canonical = `Poly bag` (the Stock sheet is the master per §13.C20), map the Bazar variant.
- **Need:** either name is fine, just confirm.

**D4 — The Batches totals row sits above the header, not below. (affects Phase 3)**

Batches layout is: row 1 = totals, row 2 = header, row 3+ = data. README §17.7 says the totals row is "beyond the header." Nothing is wrong in the data; the description is just imprecise. Migration will read from row 3.

- **Proposal:** no action, just noting it so the migration is not written against the wrong row.
- **Need:** nothing.

**D5 — `All Time` averages differ from the November figures in §8.5, and both are correct. (informational — no action)**

README §8.5 records November's averages after the 208→337 fix as 1.88 / 127.34 / 24.07. The All Time sheet reads `Avg Waffles per Invoice` **1.946** and `Per Invoice order` **245.76**. I checked the arithmetic: `831 / 427 = 1.9461`, which is exactly the weighted blend of October (`494/248 = 1.9919`) and November (`337/179 = 1.8827`). **There is no error.** The two figures differ only in scope.

- **Proposal:** no correction needed. Treat 427 invoices and 1.946 as the All Time truth, and note in the reconciliation report that the monthly and all-time invoice averages necessarily differ.
- **Need:** nothing, unless you believe one of the monthly invoice counts (248 / 179) is itself wrong. If so, tell me and I will treat it as a migration-time correction.

**D6 — `Total Days` is 28, which is the POS snapshot count, not the calendar span. (informational)** — **RULED: label it "Open days."**

All Time spans 17 Oct → 16 Nov (31 calendar days) but shows `Total Days` 28 and 28 working days. That matches README §8.4 exactly (28 open days). Confirming it is a label question only: in the new reports I will label it **"Open days"** so nobody reads it as calendar days.

- **Proposal:** relabel to "Open days."
- **Need:** confirm the label wording.

**D7 — `Rate` is per kg / per litre / per piece — never per gm or per ml. (affects Phase 2, 3, 4, 6)** — **RULED: use one rate-basis formula so no value drops.** Implemented as two explicit factors, verified against every stored amount in the workbook.

The owner's instruction: *"Drop best formula for rates units so no value drops."* The workbook formula implies **two different conversions**, and conflating them is what would drop values:

| unit | `rateDivisor` (for amount) | `baseMultiplier` (for stock) | example |
|---|---|---|---|
| `kg` | 1 | 1000 | 37.5 kg × 67 = **2,512.50**; stock **37,500 gm** |
| `gm` | 1000 | 1 | 800 gm ÷ 1000 × 450 = **360**; stock **800 gm** |
| `l` | 1 | 1000 | 39.5 l × 80 = **3,160**; stock **39,500 ml** |
| `ml` | 1000 | 1 | 500 ml ÷ 1000 × rate |
| `p` | 1 | `perPieceWeight` (default 1) | 22 jars × 830 = **18,260**; stock 22 × 350 = **7,700 gm** |

So:

```
amount    = (qty / rateDivisor) × rate
stockBase = qty × baseMultiplier        // baseMultiplier = perPieceWeight when unit is 'p'
```

Note that `gm` and `kg` therefore have **opposite** factors — `gm` divides the rate, `kg` multiplies the stock. A single shared factor cannot express both, which is why the first version of this table was wrong. All six examples above are verified against the workbook's own stored values.

`perPieceWeight` defaults to **1** for true countable items, **350** for Nutella, **1000** for Whipped Cream. One rule, no IF-chain, and nothing is special-cased.

The source formula this replaces, for reference:

```
=IF(C="p", B*D, IF(C="kg", B*D, IF(C="gm", (B/1000)*D, IF(C="l", B*D, IF(C="ml", (B/1000)*D, 0)))))
```

**D8 — `Whipped Cream` is entered in pieces but measured in grams, at 1,000 gm per tub. (affects Phase 2)** — **RULED: 1 piece = 1 kg = 1,000 gm. Nutella 1 piece = 350 gm.**

Stock row 17 has unit `p`, rate `215`, and `Stock = MULTIPLY(1000, quantity)` — so one whipped cream piece is **1,000 gm** (a 1 kg tub), and the recipe consumes it in grams (500 gm per Cream batch).

- **Settled:** `perPieceWeight` = **1000** for `Whipped Cream`, **350** for `Nutella`, **1** for every true countable item.

**D9 — Gram-displayed items show a per-kg rate, which reads as inconsistent. (cosmetic, follows from D7)**

`B. Powder` and `Vanilla` display as `gm` with rate `450` / `2600`. Those rates are per kg, so the displayed number does not look like "price per gram." It is correct, just unintuitive.

- **Proposal:** in the new Stock view show rate **per display unit you buy in**, with the base-unit rate available on hover or in a column, so nothing looks like a typo.
- **Need:** nothing; noting it so the screen is not confusing.

**D10 — the whitespace defects live in the Stock master, not only in Bazar. (affects Phase 2, 3)** — **RULED: keep one naming convention — strip the spaces.**

README §17.5 attributes the stray spaces to Bazar (`Kitkat `, ` Syrup Hersheys`). Verified: they are in the **Stock sheet itself** — the master list §13.C20 relies on. Exact names are `'Kitkat '` (trailing space) and `' Syrup Hersheys'` (leading space). 43 items total, which matches.

- **Proposal:** clean both names in the canonical item master during Phase 2, before migration maps anything onto them. Otherwise every lookup against the master misses, or worse, silently creates a second item.
- **Need:** confirm the intended names are `Kitkat` and `Syrup Hersheys`.

**D11 — `Waffle Sticks Large` (Stock) vs `Waffle Stick` (Bazar). (affects Phase 3)**

The Stock master says `Waffle Sticks Large`; Bazar says `Waffle Stick`. This one is already covered by the README's alias table (§9), so no decision is needed — noting it only so you know migration will map it and neither name is being deleted by accident.

---

## 7. Decisions — all settled, Phase 2 approved

Every blocker below was ruled on by the owner. Phase 2 is approved to build.

| # | decision | ruling |
|---|---|---|
| D1 | Bazar `Expense For` | **confirmed the quantity** → renamed `Quantity` in the new schema |
| D2 | product order | **keep workbook order** — 6 extras first, then 12 waffles |
| D3 | `Poly bag` vs `Poly Bag` | **one convention: `Poly bag`** |
| D6 | day-count label | **"Open days"** |
| D7 | rate/unit conversion | **one rate-basis rule, no value drops** → two factors (`rateDivisor`, `baseMultiplier`), verified against workbook |
| D8 | per-piece weights | **Whipped Cream 1 pc = 1,000 gm; Nutella 1 pc = 350 gm** |
| D10 | `'Kitkat '`, `' Syrup Hersheys'` | **one convention: strip spaces** → `Kitkat`, `Syrup Hersheys` |

Still useful but not blocking: D4, D5, D9, D11 need no action.

### Build environment

Phase 2 is written as code in this repository (`googlescript/`). It is not yet running in a spreadsheet. When you create the blank `Awwffle DEV` sheet and paste the files in, `runSetup()` creates everything. The live sheet stays untouched until Phase 3 is approved.

Phase 2 starts with `02_ItemMaster.gs` and `03_Schema.gs`, because everything else depends on them.

---

## 8. Review log

I will keep this table updated so we both know where we stand.

| phase | built | self-tested | handed to you | your verdict | committed |
|---|---|---|---|---|---|
| 2 — data model | yes | 177 tests pass | reviewed and run | **approved** | not yet |
| 3 — migration | yes | 42/42 checks, 0 attention | reviewed and run | **approved** | not yet |
| 4 — bazar | yes | 188 tests, 40 Bazar assertions | reviewed and run | **approved** | not yet |
| 5 — measurements / batches | yes | 238 tests + 59 integration | reviewed and run | **approved** | not yet |
| 5b — Bazar edit/delete + date order | yes | 296 unit, 260 integration | reviewed and run | **approved** | not yet |
| 6 — stock | yes | 372 unit, 35 stock + full migration | reviewed and run | **approved** | not yet |
| 6.5 — summary views + closed days | yes | 372 unit, 59 summary, 12 suites | **awaiting your review** | — | not yet |
| 6.6 — bazar due/paid + item rate tiles | yes | 399 unit, 20 bazar e2e | **awaiting your review** | — | not yet |
| 6.7 — summary performance (DEADLINE_EXCEEDED) | yes | 406 unit, byte-identical outputs | **awaiting your review** | — | not yet |
| 7 — POS | — | — | — | — | — |
| 8 — reports | — | — | — | — | — |
| 9 — cost / adjustments | — | — | — | — | — |
| 10 — hardening | — | — | — | — | — |

---

## 9. Phase 2 hand-off — review note

**Built:** `00_Config.gs`, `01_Utils.gs`, `02_ItemMaster.gs`, `03_Schema.gs`,
`03b_PosProducts.gs`, `03c_MeasurementsSeed.gs`, `04_Setup.gs`, `14_Menu.gs`,
`99_Tests.gs`, `docs/SETUP.md`.

**Test evidence:** 106 assertions pass, 0 fail. Run `runAllTests()` yourself.

| check | expected | got |
|---|---|---|
| Unit conversion factors | per D7 table | pass |
| Amounts for 12 workbook rows | exact stored values | pass |
| All 43 Stock rows (amount + base qty) | 0 mismatches | 0 mismatches |
| Item count / groups | 43 = 17 + 16 + 10 | pass |
| Measurement rows | 17, no Empty Container | pass |
| POS products | 18, extras first | pass |
| Alias mapping | 6 aliases resolve, unknown = null | pass |
| Setup run twice | second run seeds nothing | 0 created, 0 seeded |

**What you should check in the sheet (the real review):**

1. **ItemMaster** — 43 rows, `Flour` first, `POS Roll` last. Are the units right
   for how you actually buy each thing?
2. **Measurements** — 17 rows. Check the recipe numbers against what you mix.
   `Empty Container` must be absent.
3. **POS_Products** — 18 rows, `Extra Banana` first, `Awwffle` last.
4. **Settings** — look at `waffles_per_batch:*`. Current seeds are Batter 24.8,
   Nutella Mix 33.2, Cream 63.9, White Mix 0, Cheese 0. Are the two zeros right?
5. Run setup a second time from the menu. Nothing should duplicate.

**Decisions I had to make that the README did not cover:**

- **`Rate` seeds.** I copied the source Stock sheet's rate into three columns
  (`Seed Rate`, `Latest Purchase Rate`, `Weighted Avg Cost`). All three start
  equal. From Phase 4 the weighted average is computed from actual purchases and
  the seed stops mattering.
- **Per-piece weight of `1` for true counts.** Piece items with no meaningful
  weight (Egg, Oreo, boxes) store `1`, so the same multiplication works without
  branching.
- **`POPULATION` is stored on every item**, not inferred. This is what keeps
  Water (resale) and ice cream (manual topping) from ever being confused, per
  your D/§13.G1 ruling.
- **Measurements protection keeps your edit access.** I initially removed all
  editors, which would have locked you out of your own recipe sheet. Corrected:
  the sheet is protected as a warning, not a lock.
- **`Empty Container` is not created at all** — not even as an inactive row, so it
  cannot reappear in a total later.

**Deliberately not done yet:** no entry forms, no calculations, no migration, no
reports. `Stock`, `DailyWaffles`, `AllTime` exist with headers only.

**Next after your ok:** Phase 4 — Bazar entry form, which is where you start entering
live purchases.

---

## 10. Phase 3 hand-off — review note

**Built:** `05_Migration.gs`, `05b_MigrationWorkers.gs`, `05c_MigrationPos.gs`,
`05d_MigrationRest.gs`, `05e_MigrationReport.gs`, `docs/MIGRATION.md`, plus a
`OpeningStock` and `MigrationReport` sheet, and menu entries.

**Test evidence:** I built a full end-to-end simulation using your real workbook
data as the source. **42 of 42 reconciliation checks pass, 0 need attention.** All
143 unit tests pass.

| check | expected | got |
|---|---|---|
| Bazar rows | 72 | 72 |
| Bazar Oct / Nov / total | 53,890 / 39,050 / 92,940 | exact |
| Batches | 30, totals 33.5 / 25 / 13 / 1 / 1 | exact |
| POS snapshots | 28 days × 18 = 504 | 504 |
| Waffles sold | 831 | 831 |
| Extras sold | 25 | 25 |
| Original Sale | 104,940 | 104,940 |
| POS Cost | 54,094 | 54,094 |
| Cash in hand | 65,770 | 65,770 |
| Open days | 28 | 28 |
| Items explained by purchases | 40 of 43 | 40 of 43 |
| Milk opening after correction | 2,000 ml | 2,000 ml |

**A mistake I made and fixed.** My first idempotency test showed that a second run
would double *six of seven* tables — only `Batches` had a guard. Worse,
`OpeningStock` re-read the already-doubled Bazar, so errors would compound. Every
worker now dedupes on source provenance, and the second run leaves all row counts
unchanged.

**Decisions I had to make that the README did not cover:**

- **Closed days: 22 October is marked `Unconfirmed`, not `Closed`.** It is a
  Thursday, not a Wednesday. §13.A7 says a missed entry must not be mistaken for a
  closure, so I recorded the fact rather than inventing a reason.
- **Invoice and discount/due come in as monthly aggregates**, dated to month end
  and labelled `Source = Monthly aggregate`. No daily history exists, and I did
  not fabricate one.
- **The 34 BDT discount residual stays unallocated.** Spreading it across months
  would invent data.
- **Opening stock is its own sheet**, not folded into Bazar, so October remains
  visible and auditable (§6.3).
- **The source must be a separate Drive file** — its tab names collide with ours.
  You confirmed this choice.

**What to check yourself:**

1. Open **MigrationReport**. Are there any `CHECK` rows? (There should be none.)
2. Read the **CORRECTIONS** section — every defect with before/after. Do you accept
   each one, especially the Milk `6 p → 6 l`?
3. Open **OpeningStock** — confirm only Milk, Waffle Box and Waffle Tray have a
   non-zero quantity and everything else is 0.
4. Run the import a second time and confirm nothing duplicates.
5. Check **ClosedDays** — 4 Nov and 11 Nov as Closed, 22 Oct as Unconfirmed.

**Deliberately not done yet:** no entry forms, no stock calculation. `Stock`,
`DailyWaffles` and `AllTime` still have headers only.
