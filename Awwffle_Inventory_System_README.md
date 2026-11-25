# Awwffle Inventory & Business Management System
## Product Requirements / Build Blueprint

**Document status:** Draft v0.3 — requirements captured, business rules confirmed, all blocking open questions resolved (§13.G), source workbook audited (see §17)  
**Business:** Awwffle  
**Target platform:** Google Sheets + Google Apps Script (`.gs`)  
**Purpose:** Build a new, maintainable inventory and business-management system using the existing Excel workbook as the historical data source and operational blueprint.

**How to read this document:** Sections 1–12 define what to build. Section 13 records the business rules that are settled and must be implemented as written. Sections 14–16 cover sequencing, acceptance, and the source workbook. Section 17 is the audit of the current workbook: what it contains, what reconciles, what is broken, and what is still missing. Nothing in this document should be treated as optional unless it is listed as an explicit non-goal.

---

## 1. Project objective

Build a fresh Google Sheets-based system for Awwffle. The existing workbook, `Current Blueprint.xlsx`, is a **reference and migration source**, not a template to be cosmetically redesigned.

The new system must:
- Preserve the real historical data, item names, item order, recipe measurements, prices, and existing records from the source workbook.
- Reduce repeated manual entry.
- Automatically connect recipe measurements, daily batch production, purchases, inventory, POS stock snapshots, sales, expenses, and financial summaries.
- Provide useful filtering and date-range summaries.
- Be maintainable through versioned Google Apps Script `.gs` source files.
- Never erase or overwrite live business data when scripts are updated or the system is rebuilt.

The system should be designed around Awwffle's actual daily workflow, not around a generic inventory template.

## 2. Platform and implementation requirements

1. Google Sheets is the live data store and user-facing interface.
2. Google Apps Script is responsible for setup, automation, calculations, validation, menus, reports, and formatting.
3. Deliver the implementation as clearly separated `.gs` files, with a `README.md` explaining installation, configuration, use, backup, and updates.
4. Scripts must be modular, readable, commented, and safe to rerun.
5. A setup/update script must create missing sheets, headers, formulas, validations, formatting, and menus without deleting existing records.
6. Updating scripts must not recreate the spreadsheet from scratch or clear data ranges.
7. Use stable IDs or another reliable key for records. Do not rely on row numbers as permanent record identifiers.
8. Include a backup/export procedure before migrations or structural changes.
9. Include validation and error messages for invalid dates, unknown items, unsupported units, negative quantities, duplicate submissions, and missing required fields.
10. The system must support additional products, ingredients, packaging items, categories, and months without rewriting core logic.

**Delivery and installation (settled in v0.3, §13.H).** The code lives in a `googlescript/` folder in this repository as separate `.gs` files, which the owner pastes into the Google Sheets Apps Script editor. The repository copy is the reference source of truth for the code, so it can be reviewed and improved outside the spreadsheet.

- Two documented paths must exist: a **first-time install** (create project, paste files, run setup once) and an **update** (paste changed files, run the update function).
- An update must be additive and safe: it may create missing sheets, columns, formulas, validations, and settings, and it must never clear, truncate, or reorder live data (§2.6).
- Setup must be idempotent — running it twice must not duplicate records, re-seed values the owner has edited, or reset opening balances.
- The migration reads a Google Sheets copy of `Current Blueprint.xlsx` that the owner places in Drive; the original `.xlsx` is never modified (§16).

## 3. Core operating workflow

### 3.1 Recipe measurements

- The `Measurements` data represents fixed recipe quantities and should remain constant during normal daily operations.
- Measurements define how much of each ingredient is consumed by one batch of each preparation.
- The existing recipe names, ingredient names, values, and order must be migrated exactly.
- Only an intentional recipe-maintenance action should change a measurement. Normal daily entry must not modify recipe data.
- Protect or clearly distinguish recipe configuration cells from daily-entry cells.

The matrix is 17 ingredients × 5 preparations, with blanks meaning "not used in this preparation." Blanks are meaningful and must remain blanks, not become zeros that get summed.

- `Empty Container` (row 19) has values in all five preparation columns but **has no Stock row**. It must be excluded from consumption. It exists only as a reminder and must not be migrated as an ingredient; otherwise it appears as a permanent orphan across every stock total.
- `Waste` must not exist in this sheet (§13.D28).
- The source sheet is padded to row 1000 and the Stock formulas reference `$A$2:$A$1000`. A rebuild must not depend on that padding — reference the real data extent and let it grow.
- There is no `Waste` column, no yield figure, and no per-preparation batch size. A "batch" is the unit the owner already counts, and one batch of each preparation consumes exactly the numbers in this matrix.

### 3.2 Daily batch entry

- The owner enters production batches at the end of each day.
- The batch entry records the date and the number of batches made for each preparation.
- Existing preparation columns must be retained in their current order:
  1. Batter
  2. Nutella Mix
  3. Cream
  4. White Mix
  5. Cheese
- Fractional batch quantities must be supported (for example, 0.5).
- Batch history must be filterable by date/date range and preparation.
- The selected date range must show batch totals by preparation and overall.
- Editing or correcting a batch record must recalculate inventory usage and historical reports without creating duplicate consumption.
- Batches are not guaranteed on every calendar day, and the closed-day pattern is not a fixed weekday. Batch dates in the source span all seven weekdays, including several Wednesdays. Consumption-day averages must therefore be computed from an explicit closed-day calendar (see §13), never from an assumed "six days a week" rule.

### 3.3 Automatic inventory calculation

- Ingredient consumption must be calculated from **Measurements × Batches**.
- Inventory must update automatically when a batch is added, edited, or deleted.
- The system must show, at minimum:
  - Purchased/opening quantity
  - Total available quantity
  - Quantity used by preparation
  - Total quantity used
  - Used cost
  - Remaining quantity
  - Remaining stock value
  - Estimated remaining days
  - Estimated remaining batches
  - Low-stock and low-batch warnings
- Recipe-based consumption is theoretical consumption. Provide a future-compatible way to record wastage, damage, or manual stock adjustments separately so actual stock can be reconciled.
- Do not silently allow inventory to become negative. Flag it clearly and explain the cause.
- Three distinct item populations exist and must be handled differently (see §17.3 and §13.G1):
  - **Recipe-driven items** (Recipes group): consumption derives from Measurements × Batches. These have an Est. Batch figure.
  - **Manually maintained items** (Toppings, Packaging and Equipments groups): consumption is entered by hand for now, because no per-waffle usage pattern has been established. Est. Batch is intentionally blank for these. The design must not break when a pattern later emerges and a real recipe is added for one of them.
  - **Resale products** (`Water 500ml`): one POS sale of the product consumes exactly one unit of the matching stock item. Stock is reduced from the POS counter, not from a recipe. This is the only product whose sales drive ingredient stock directly, and it must be wired as an explicit link between a POS product and a stock item rather than inferred from a matching name.
- The three `Ice cream (…)` items are **not** resale products despite being sold standalone. They are topping stock: the POS sale records revenue only, and the owner enters the quantity consumed by hand when a can is finished, exactly like the other toppings (`§13.G1`). A POS sale of ice cream must never reduce the ice cream stock row.

## 4. Inventory item master and required item order

The following groups, names, spelling, and order are supplied as the required starting catalogue. Preserve them exactly during migration. Do not silently rename, merge, reorder, or remove items. Any future catalogue changes must be deliberate and data-safe.

### 4.1 Recipes

1. Flour
2. Corn Flour
3. Sugar
4. Salt
5. B. Powder
6. B. Soda
7. Egg
8. Milk
9. Oil
10. Butter
11. Vanilla
12. Nutella
13. White Chocolate
14. Milk Chocolate
15. Icing Sugar
16. Whipped Cream
17. Cream Cheese

### 4.2 Toppings

1. Dark Chocolate
2. Kitkat (4 fingers)
3. Oreo
4. Almond Slice
5. Almond Nut
6. Almond Kaju
7. Blue Berry Filling
8. Strawberry Filling
9. Syrup Hersheys
10. Chocolate Chips Dark
11. Chocolate Rice Dark
12. Chocolate Sprinkles
13. Water
14. Ice cream (vanilla)
15. Ice cream (chocolate)
16. Ice cream (strawberry)

### 4.3 Packaging and equipment / operating supplies

The original single `Equipments` group is **split in two** so packaging cost can be
read on its own without operating supplies inflating it. Item names, order, units and
rates are unchanged; only the group label moves.

**Packaging** — consumed per waffle:

1. Waffle Sticks Large
2. Waffle Box
3. Waffle Tray
4. Bento Box
5. Poly bag
6. Tissue

**Equipments** — operating supplies, not consumed per waffle:

7. One Time box
8. Room Freshner
9. Arosole Spray
10. POS Roll

`One Time box` stays in Equipments because it is a staff item, not customer packaging.

### 4.4 Group labels

Five groups, in this order: `Recipes`, `Toppings`, `Packaging`, `Equipments`, `Resale`.

`Water` carries the `Resale` group (a group of one). **Group is a display and filter
label only** — every calculation is driven by an item's `Population`, not its group
(§3.3, §17.3). Regrouping therefore cannot change recipe cost, stock valuation, cash
or any historical record.

A consequence that must not be overlooked: every non-recipe group must appear in
`MANUAL_STOCK_GROUPS`, or its items silently vanish from the Manual Stock form and
their usage then reads low.

## 5. Bazar / purchasing / expense ledger

### 5.1 Single-entry purchasing workflow

Today, the owner enters purchases in `Bazar` and separately updates stock quantities. The new system must remove this duplication.

Required workflow:
1. When an item is purchased, enter the purchase once in `Bazar`.
2. Select the item, date, purchase category, unit, quantity, rate, and other relevant details.
3. The system calculates the purchase amount.
4. If the selected item is inventory-managed, the purchased quantity is automatically added to its stock balance after unit conversion.
5. The owner must not need to manually enter the same purchase quantity again in Stock.

### 5.2 Bazar fields

Preserve the meaning of the existing Bazar fields where possible:
- Date
- Category
- Expense For / Item
- Unit
- Rate
- Amount (BDT)
- Ref
- Status

The new design may add fields such as record ID, payment method, notes, inventory-impact flag, or normalized quantity, provided existing data and workflow are preserved.

**One row per item, grouped by invoice reference.** A Bazar row is always a single item on a single purchase. One shop bill may contain many items, and those items share the same `Ref` value (`#NP01`, `#DCC01`, `#DCC02`, `Riyad`, …) so the bill can be read as a group (§13.G5). Consequences for the build:

- `Ref` is a grouping key, not a unique key. Uniqueness belongs to the record ID, never to `Ref`.
- The entry form must let the owner add several item lines to one invoice in a single sitting, writing one row per item with the same `Ref`. Entering them one at a time must produce the same result.
- Purchase totals are available at two levels: per invoice (sum of its item rows) and per item (sum across invoices). Both must be derivable from the same rows, never stored twice.
- A row's `Amount` remains `quantity × rate` for that single item, never the invoice total.
- Invoice-level reporting must not assume a fixed number of lines per invoice, and an invoice reference may legitimately appear once.

Two things about the existing fields that the rebuild must improve, because both cause silent corruption today:

- **`Amount` must always be derived** as `quantity × rate` after unit conversion. One row in the current sheet has a raw typed amount while every sibling is a formula, so it will not follow a quantity change.
- **`Category` currently doubles as the item name.** It holds ingredient names, and also `Salary`, `Currier Charge`, and `Insect Light`. That is why the single field cannot answer "how much did I spend on inventory versus operating costs." It must become two fields (§5.3).

### 5.3 Categories

- Every Bazar entry must have a category.
- Categories must be configurable and expandable.
- Bazar reports must group and summarize spending by category.
- Distinguish the **expense category** from the **item purchased**. For example, an ingredient purchase is an inventory purchase, while salary or courier charges are operating expenses.
- Non-inventory expenses must be recordable without increasing stock.
- Inventory purchases must increase stock exactly once.
- Do not assume every Bazar row is an inventory purchase.

**The two-field model.** Every entry carries:

1. **Expense type** — one of `Inventory purchase`, `Salary`, `Courier`, `Maintenance`, `Other`. Choosing `Other` reveals a free-text name field.
2. **Item / expense name** — for an inventory purchase this is a canonical item from the item master; for a non-inventory expense it is the free-text or selected name.

Rules:
- `Inventory purchase` is the only expense type that touches stock. The other four never do.
- The item name for an inventory purchase must validate against the item master. An unknown name is rejected at entry, not silently created. This is what prevents the `Kitkat` / `Kitkat (4 fingers)` / `Waffle Stick` fragmentation (§17.5).
- The whole system uses one canonical name per item (§13.C20). No alias table is maintained at query time; aliases exist only inside the one-time migration mapping.
- The existing non-inventory entries in the source are `Salary`, `Currier Charge`, and `Insect Light`. Salary and courier map to their types. `Insect Light` is maintenance.

### 5.4 Bazar filters and summaries

Provide filters for:
- Start date and end date
- Individual date
- Item / Expense For
- Category
- Month
- Payment status
- Payment method, if implemented

For the selected filter, show:
- Total amount spent
- Total quantity purchased where meaningful
- Item-wise totals
- Category-wise totals
- Paid and unpaid totals
- Monthly totals
- All-time totals

Filtering must not alter or delete source records.

## 6. Stock / inventory view

The Stock view must be driven by the item master, Bazar purchases/opening balances, batch consumption, and approved adjustments. It must not require the owner to maintain a second manual quantity ledger.

### 6.1 Units and normalization

- Purchases may be entered in the real purchase unit: `p`, `kg`, `gm`, `l`, or `ml`.
- Recipe measurements are currently expressed in grams for solid ingredients and millilitres where applicable.
- Stock should be normalized to a consistent base unit for calculations:
  - Weight: grams (`gm`)
  - Volume: millilitres (`ml`)
  - Countable items: pieces (`p`)
- Do not convert pieces into grams or millilitres unless a verified conversion rule exists for that specific item.
- Unit conversion must be explicit and correct. For example, 1 kg = 1,000 gm and 1 l = 1,000 ml.
- Preserve the original purchase quantity and unit for audit/reference, while also storing the normalized quantity used for stock calculations.
- The system must handle items whose recipe usage is in grams while purchases are entered in kilograms.
- **Items are tracked in one base unit each, and it is not always a pure weight.** The source workbook's Stock sheet already encodes this and it must be preserved exactly:
  - `B. Powder`, `Vanilla`, `Chocolate Sprinkles` are held in `gm`, not `kg`.
  - `Milk`, `Oil` are held in `l` (treated as 1 l = 1 kg for cost).
  - `Nutella` is held in **pieces**, where 1 piece = one 350 gm jar. A count-based base unit that has a known per-piece weight is therefore a supported case, not an exception.
  - `Whipped Cream` is held in pieces (tubs), not kg, even though the recipe uses grams.
  - Countable items (`Egg`, `Kitkat`, `Oreo`, packaging) are held in `p`.
- A single item may be bought in a different unit from the one it is held in (1 kg vs gm, 1 l vs ml, jar vs piece). Conversion must be resolved per item at purchase time, not by a global rule.
- Each item therefore needs two unit fields: the **entry/display unit** (what the owner types and sees, e.g. `kg`, `l`, `p`) and the **base unit** used for all calculation (always `gm`, `ml`, or `p`). The source workbook already works this way: its quantity column shows `l` for Milk while its calculation column is in ml.
- Do not introduce pounds as a stored unit. `l` is accepted as an entry unit and treated as 1 l = 1 kg for cost, but it must never become a separate calculation basis.

### 6.2 Stock filters and analysis

Provide filters for:
- Date/date range (stock position as of the selected date)
- Item
- Item group
- Low stock
- Low remaining batches

Show:
- Opening stock
- Purchases in the selected period
- Total available stock
- Consumption by preparation
- Total used quantity
- Used cost by item
- Remaining quantity
- Remaining stock value
- Estimated days remaining
- Estimated batches remaining
- Low-stock / low-batch status

The user must be able to see which items need purchasing before they run out.

### 6.2.1 Stock valuation method

Stock value must be computed by **weighted average cost**, not by multiplying current quantity by a single typed rate.

Why this is required and not a preference:
- Weighted average is the only method where **total inventory value + total used cost = money actually spent**. That identity is what makes the reconciliation report in §9 possible at all.
- Latest-rate valuation revalues stock that has already been consumed every time a price moves, so used cost and profit drift for reasons that have nothing to do with the business.
- A single hand-typed rate column has to be edited on every purchase, which is exactly the duplicate manual entry §12 forbids.

Worked example from the source workbook (Flour), which shows the current sheet cannot reconcile:

| purchase | qty | rate |
|---|---|---|
| Oct 10 | 10.5 kg | 80 |
| Nov 10 | 25 kg | 67 |
| Nov 12 | 1 kg | 85 |
| Nov 13 | 1 kg | 80 |
| **total** | **37.5 kg** | **2,680 BDT actual spend** |

| method | value of 37.5 kg |
|---|---|
| current sheet (qty × one typed rate of 67) | 2,512.50 |
| latest purchase rate (80) | 3,000.00 |
| **weighted average (71.47)** | **2,680.00** |

Across all items the current sheet values stock at 98,956.50 while actual Bazar spend is 92,940.00 — a 6,016.50 phantom gap with no business meaning.

Rules:
- Maintain a running weighted average cost per item, recalculated on each purchase as `(existing qty × existing avg) + (purchase qty × purchase rate)` divided by new total quantity.
- Used cost and remaining value must both derive from that same average, so the two always add up to purchase spend.
- Opening stock takes its starting rate from the opening snapshot (§6.3), because no purchase history exists for it.
- Keep a **display-only "latest purchase rate"** column for reorder decisions. The owner asked for this explicitly. It must never feed valuation or profit.
- Units must be normalized before averaging. Mixing a kg purchase and a gm purchase into one average without conversion silently corrupts the rate.

### 6.2.2 Estimated days and estimated batches

These two figures are frequently wrong in the source, and the failure mode is silent — they return a plausible number instead of an error. Both must be defined precisely.

**Estimated days remaining** = remaining quantity ÷ daily consumption, where daily consumption is measured over **open days only** (§8.4).

- The daily rate is `total used ÷ working days in the batch date range`.
- The range must be the actual extent of batch records, computed from the data, not a hardcoded end row. The source currently uses `Batches!A3:A1000`, which is correct. A previous hardcoded `A3:A26` version covered only 24 of the 30 batches and shrank the measured span from 34 days to 27, which **understated** Est. Days by about 21% (Flour read ~33 instead of ~42). Any fixed end row will silently drop data again the moment it is exceeded.
- If total used is zero, or there are fewer than two batch records, the result must be blank rather than a division-by-zero or a misleading number.
- Because the divisor counts open days, an estimate of 40 means 40 *trading* days, not 40 calendar days. Any UI label must say so.

**Estimated batches remaining** = the smallest number of batches any single preparation could still support, given remaining stock.

- For each preparation whose per-batch requirement is greater than zero, compute `remaining ÷ requirement`, then take the minimum. This correctly identifies the bottleneck preparation rather than averaging across them.
- Items with no recipe (toppings, packaging) have no meaningful answer and must return blank, not zero.
- The requirement matrix must reference the live data extent, not a fixed range.
- If remaining stock is zero or negative, return blank rather than a negative batch count.

**Google Sheets compatibility note.** The source stores the batches formula in a wrapped unknown-function form (`__xludf.DUMMYFUNCTION(...)`) because it contains `FILTER`, which Excel does not natively support. Google Sheets evaluates `FILTER` natively, so the wrapper resolves on import — but the cached values in the file are the only values currently present and must not be trusted as a recalculated result. Verify by recomputing in Sheets, not by reading the file's cached numbers.

### 6.3 Historical opening stock and migration

- Bazar records currently begin on **10 October 2026** (the first purchase row) and run to **16 November 2026**.
- Existing Stock quantities include stock that was already available before the Bazar history began.
- Therefore, Bazar purchases alone cannot explain the current Stock quantities.
- The migration must preserve the existing Stock balances, quantities, rates, and calculated values as a historical opening snapshot as of a clearly recorded cut-off date.
- Do not guess missing October purchases or infer quantities from rates unless the source data proves the quantity.
- If October Bazar records are later supplied, they can be imported as historical transactions and reconciled against the opening snapshot.
- The system must avoid counting the same opening stock and imported purchases twice.

**Verified position of the current workbook.** The Stock sheet's quantity column is not an opening balance — it is a manually maintained running total. Diffing it against all recorded Bazar purchases reconciles **40 of 43 items exactly**, leaving only:

| item | stock | purchases | difference |
|---|---|---|---|
| Milk | 39,500 ml | 31,506 ml | 7,994 ml |
| Waffle Box | 1,200 p | 0 | 1,200 p |
| Waffle Tray | 1,200 p | 0 | 1,200 p |

- Milk's gap is a data-entry defect, not real opening stock: Bazar row 73 records `Milk, 6, p` where every other milk purchase is in litres. Reading it as 6 l makes Milk reconcile to exactly **2.0 l** of genuine opening stock.
- Waffle Box and Waffle Tray were never purchased inside the recorded window. Their 1,200 each is real pre-existing stock and must be preserved as opening balances with a rate taken from the Stock sheet.

Practical consequence: **opening stock is small and almost fully explained.** The cut-off is best recorded as *stock holding before the Bazar ledger begins*, i.e. **as of 9 October 2026**, and October's purchases (53,890 BDT) should then be replayed on top rather than folded into opening. This keeps the October purchase history visible and auditable instead of silently baked into a number. The alternative — a snapshot as of 16 November — is acceptable only if the October purchases are marked as already-included so they are never added twice.

Either choice must be written down explicitly in the migration output. A snapshot that is 100% purchases and a snapshot that is 100% pre-existing stock are both wrong; the truth is a small, itemized opening layer plus a full purchase ledger.

## 7. Daily Waffles / POS stock snapshot workflow

This is a critical part of the system and must follow the owner's existing POS workflow.

### 7.1 POS workflow

- The owner uses a third-party POS website.
- Each day, the owner downloads the POS stock list.
- The POS provides a `Cr. Stock` value for each product.
- The owner enters/replaces the current `Cr. Stock` values in the system.
- The system compares the current value against the previous day's value to calculate units sold.
- The owner should not have to separately enter the calculated quantity sold.
- The `Cr. Stock` column, product order, and product names must align with the POS export and existing workbook.

**The real POS export columns.** The download provides exactly these six columns, in this order, for all 18 products (12 waffles + 6 extras):

```
SL.  Product  Cost  Qty  Sale  Stock Value
```

- `SL.` — row number, 1…18. Not a stable product ID; do not key on it.
- `Product` — display name. Must map to the internal item master via an alias table (the POS spelling differs from the Stock sheet spelling).
- `Cost` — POS-assumed unit cost. This is the same figure kept in the workbook's `Cost` column, and it is an assumption, not a recipe-derived cost (§8.1).
- `Qty` — the remaining counter. **This is the `Cr. Stock` value the owner types today.**
- `Sale` — unit selling price.
- `Stock Value` — `Qty × Cost`, printed by the POS. Treat as derived; recompute rather than trust on import.

Sample of the real format:

```
1   Extra Banana        5.00৳  10000  5.00৳   50,000.00৳
7   Chocolate Explosion 75.00৳ 9847   75.00৳  738,525.00৳
18  Awwffle             50.00৳  9848   50.00৳  492,400.00৳
```

Notes that matter:
- Prices and values carry a `৳` suffix and thousands separators, and `Cost`/`Sale` carry two decimals. Import parsing must strip both.
- The `Stock Value` column is the POS's own valuation and is **not** the inventory valuation in §6.2.1. They measure different things (POS stock counters vs physical ingredient stock) and must never be reconciled against each other.
- The owner may enter by pasting the whole export rather than typing 18 cells.

### 7.2 Calculation rules

- `Units Sold = Previous Cr. Stock - Current Cr. Stock`.
- The first baseline for the existing POS counters is **10,000**, as used in the historical workbook, unless a product has a different verified baseline in the source data.
- Preserve daily snapshots so historical sales remain reproducible.
- Do not overwrite yesterday's snapshot when entering today's stock.
- If a POS counter increases, it is a **reset** if the value is consistent with a restart at 10,000, and it is handled silently under the reset rule below (§13.A3, §13.G7). A counter increase that is **not** consistent with a restart is a data-entry error and must be flagged for review rather than recorded as a sale.
- Support correction of an incorrectly entered snapshot while recalculating affected sales safely.
- Record the snapshot date and import/entry timestamp.
- The owner should be able to paste or bulk-enter the daily POS stock list, rather than editing many cells one by one.

**Counter reset rule.** Counters decrease from 10,000 until they reach 0, then restart at 10,000. A reset is **not** negative sales and must never produce a negative units-sold figure.

- On a reset, the true units sold for that day is the units consumed on the old counter **plus** the gap implied by the new counter's value.
- The all-time total must accumulate across resets without loss. When Awwffle's counter resets to 10,000, its lifetime total becomes 10,000 + its previous total, not a replacement.
- Treat this as a first-class state transition on the product, not as an exception to special-case. The workbook has not needed it yet — every counter is still above 9,800 — so the behaviour must be designed and unit-tested before it first happens rather than patched after.

**Invoice count rule.** The POS export does **not** contain an invoice count. The owner reads the last invoice number off the POS and enters only that.

- Store the cumulative last-invoice number per day.
- Derive the daily invoice count as `today's last invoice − previous day's last invoice`.
- The owner must never enter a daily count directly.
- The first day of a period has no previous day, so its count is either taken from the POS's own day summary or seeded from the opening baseline. Whichever is used must be recorded on the record, not guessed.

**Historical limitation to carry into migration.** No daily invoice history exists anywhere in the source workbook. The Daily Waffles sheet records only date, product, previous/current stock, and units sold — there has never been an invoice column. Only three monthly totals were ever typed (October 248, November 179, All Time 427). Migration therefore cannot back-fill daily invoice counts for the existing history; those months must be migrated as monthly aggregates and the reconciliation report (§9) must explicitly accept that, rather than flagging it as a mismatch.

### 7.3 Product catalogue — preserve exact order and names

The 12 waffles:

1. Chocolate Explosion
2. Bluelicious
3. Bananutella
4. Very Strawberry
5. Kit-Kat Kraze
6. Rustic Sweet
7. Midnight Oreo
8. Dark Night
9. Snowy Bliss
10. Unicorn Bliss
11. Nutella Nut
12. Awwffle

The extra items:

1. Extra Banana
2. Extra Nut
3. Water 500ml
4. Ice Cream - Strawberry
5. Ice Cream - Chocolate
6. Ice Cream - Vanilla

Preserve the source workbook's actual item order in the POS entry interface and reports. Do not alphabetize these lists.

### 7.4 Daily Waffles filters and summaries

- Filter by date/date range.
- Filter by waffle or extra item.
- Show units sold per item and total units sold for the selected period.
- Show sales/revenue and other available item-level figures where supported by the POS and configured selling prices.
- Keep the POS `Cr. Stock` snapshot history available for audit.

## 8. All Time and monthly sales reports

### 8.1 All Time

The All Time report must be calculated from the underlying daily POS snapshots and related records, not manually maintained totals.

Preserve the existing concepts and analysis fields:
- First Day
- Last Day
- Total Days
- Total Invoices
- Total Waffles Sold
- Avg Waffles per Invoice
- Per Invoice order
- Original Sale
- POS Cost
- POS Profit
- Cash in hand
- AVG. Day Sell
- AVG. Waffle Sold Price
- AVG. Waffle Cost
- AVG. W/per day

The existing `Cost` per waffle is an assumed/configured cost, not necessarily a live recipe-derived cost. Preserve this distinction.
- `Sale` is the configured selling price.
- Product-level units sold, sales, cost, and profit must be calculated from daily POS-derived sales.
- Dates and invoice counts should not need to be manually edited in a summary table.
- Invoice count must come from a clearly defined daily input or imported POS data source. Do not invent invoice counts from waffle quantities.

**Original Sale is already net of discount.** This is the single most misunderstood figure in the workbook and it must not be re-derived.

- The sheet computes `Original Sale = SUM(product revenue) − Discount`. In the current data that is `113,832 − 8,892 = 104,940`.
- Discount is per invoice and is already deducted, so no downstream figure may subtract Discount a second time.
- **Cash in hand = Original Sale − Due − Bazar.** Expanded: `(Gross Sales − Discount) − Due − Bazar`. It must not subtract Discount again.
- Both the current sheet and the stated rule agree once "Original Sale" is read as the net figure. Preserve the name and the meaning together, or rename the column to make the netting obvious — but never change the arithmetic.

**Discount and due are dated daily records, not monthly lumps.** In the source they are typed once per month and summed into All Time. All Time's 8,892 is not exactly October 6,032 + November 2,826 = 8,858; there are 34 BDT of difference from earlier or unallocated entries. The new system records them **once per day, with a date** (§13.G3), so monthly and all-time totals reconcile by construction instead of by hand. October's historical totals are migrated as monthly aggregates because no daily history exists (§9), and that limitation is recorded rather than disguised as daily data.

**Payment methods are not interchangeable.** Sale, cash received, bKash, and bank are four different things:

- `bKash` is a payment gateway total. It is part of money received and is already inside the sale figure.
- `Bank` / `Cash Box` is physical drawer cash — in the source it is a constant 500 BDT float, not a daily flow.
- `PIX. All Time` is a POS-side cross-check figure. It exists only so the owner can see whether the calculated sale matches what the POS reports. It is not an input to profit.
- Cash in hand is a derived position, not a payment channel. It must never be summed together with bKash or bank as if they were all cash.

**The promo/upsell analysis block is out of scope.** The source workbook previously contained a Buy X/Get Y, Paid Waffles, Extra Waffles Given, Net Gain, ROI, and break-even analysis. It has been removed and is not part of this build. Do not re-create it during migration, and do not treat its absence as data loss.

### 8.2 Monthly reports

- Generate monthly reports automatically from the same underlying daily records.
- Do not require separate manual entry of `Cr. Stock` for All Time, October, November, or future month sheets.
- One daily POS snapshot must feed Daily Waffles, All Time, and the relevant monthly report.
- Generate a report for each month with data, rather than requiring a new manually built sheet every month.
- Preserve the existing October and November historical data during migration.
- Monthly reports must include sales, units by item, invoices, discounts, due, Bazar/expenses, cash position, and profit measures where the underlying records support them.
- Month selection and date-range filters should be available without creating duplicate source data.

### 8.3 Existing All Time / month financial concepts

The source workbook includes values/fields for:
- Discount
- Due
- Bazar
- bKash / POS-related totals
- Cash in hand

These concepts are all preserved, and their definitions are now settled in §13.B. They are not interchangeable: revenue, cash received, bank/mobile payments, discounts, dues, and expenses are five different things, and §8.1 pins down exactly how the source combines them.

### 8.4 Working-day calculation

Every per-day average in the system depends on this, so it gets its own rule. Three figures use it: `AVG. Day Sell`, `AVG. W/per day`, and `Est. Days` on the Stock sheet.

- **Working days are calendar days minus closed days.** They are not calendar days, and they are not "six days a week."
- The closed day is **currently Wednesday**, but that is a setting, not a law. There may later be more closed days, or none at all.
- The closed-day pattern is **not reliably reflected in the historical data**. In the source period the shop has snapshots on two Wednesdays (21 and 28 October) but is missing Thursday 22 October, and there are Wednesdays with no snapshot at all (4 and 11 November). History must therefore come from an explicit calendar of closed dates, not from a weekday rule.
- Store closed days as a dated list (date + optional reason). The working-day count for any range is `total days in range − closed dates in range`.
- Never apply an off-by-one `+1` correction to a working-day count. The source workbook's monthly sheets add `+1` to a `NETWORKDAYS` result while the All Time sheet does not — the discrepancy happens to cancel out against the weekday-rule error today, which means fixing one without the other will silently shift every average. Replace both with the closed-day list.
- Estimated days remaining (`Est. Days`) must count only open days: `remaining quantity ÷ (daily consumption ÷ working days)`, where working days come from the closed-day list.

Verified current values, so the rebuild can be checked: All Time 28 working days, October 14, November 14 (all three agree with the actual number of POS snapshots). All Time `AVG. Day Sell` = 104,940 / 28 = 3,747.86 and `AVG. W/per day` = 831 / 28 = 29.68 are therefore **correct as they stand**. Any rebuild that produces different numbers from the same inputs has introduced a bug.

### 8.5 Bulk-entry and correctness hazards to design against

Each of these is present in the source workbook and each silently corrupts a total. They are listed together because they share one root cause: typed values sitting where formulas belong.

- **Frozen summary cells.** Several All Time summary cells are literal numbers rather than formulas, including `First Day`, `Last Day`, and `Total Invoices`. Any change to the underlying daily data leaves them stale with no error shown. Every summary figure must be derived.
- **A typed total drifted and was wrong for 129 units.** November's `Total Waffles Sold` was a hardcoded `208` while the daily blocks beneath it summed to **337**. It was corrected in the source on 17 Nov 2026 and is now `=SUM(E8:E19)`. Three derived figures moved as a result: avg waffles per invoice 1.16 → 1.88, avg waffle sold price 206.31 → 127.34, avg waffles per day 14.86 → 24.07. All Time was unaffected (831 = October 494 + November 337). This is the archetype of the failure mode: a plausible-looking number with no error, silently wrong for an unknown period. Every total must be a formula.
- **Item numbering drift.** `Item No` is hand-typed and has drifted: October and November both still jump 16 → 19 → 20, skipping 17 and 18, while All Time runs 1…18 correctly. Item numbers must be generated from the item master, never typed.
- **A duplicated total column.** The Daily Waffles block computes a per-day waffle total that duplicates the summary's total for the same set of rows. Two definitions of one number will eventually disagree.
- **A literal hiding among formulas.** One Stock row's cost cell (`E29`, Chocolate Rice Dark) is a raw `1050` while every sibling row is a formula, so it will not respond when that item's quantity changes.
- **Two competing expense ledgers.** See §8.6. This is the most damaging one.

### 8.6 One expense ledger, not two

The source workbook records expenses twice: once in the `Bazar` sheet, and again as a hand-typed list of 31 amounts in the All Time `Q` column that the cash formula sums.

Both currently total **39,050**, so the cash figure is arithmetically correct. But the two lists still do not correspond row by row — they happen to agree only because offsetting errors cancel out:

- Six Bazar amounts have no typed counterpart: `Kitkat 800`, `Vanilla 140`, `Corn Flour 90`, `Flour 85`, `B. Soda 60`, `B. Powder 50`.
- Three typed amounts have no Bazar counterpart: `400`, `400`, `425`.
- The two sides balance exactly because `800` was re-entered as two `400`s, and the five small items (`50 + 140 + 85 + 90 + 60 = 425`) were consolidated into a single `425`.

Consequences that must be designed out:
- Correctness here is accidental. Any future edit to one list without the other silently breaks cash in hand, and nothing will flag it.
- The typed block has 31 rows against 34 Bazar rows for the same period, so it is not a ledger — it is a summary that has drifted from its source.
- Bazar rows 2–39 are **October** purchases (they share a single October date), and they are absent from the typed block by design, since October is an investment month (§13.F38). That exclusion is correct, but it means the block is not "all expenses" and cannot be reasoned about as if it were.
- The new system must have exactly one expense table. Cash in hand, monthly expense totals, and category reports must all read from it. A summary must never re-list expense amounts as typed cells.
- The typed block must be **deleted, not migrated**. Migrating it would import a summary that cannot be tied back to individual purchases.

## 9. Historical workbook and data migration

The existing workbook is real business history and must be treated carefully.

Migration requirements:
1. Import all usable historical data from the source workbook.
2. Preserve exact item names, spelling, order, recipe measurements, batch records, POS stock values, prices, and Bazar records.
3. Preserve the existing October and November historical reporting data.
4. Do not replace real data with sample/demo data.
5. Do not silently correct, normalize, rename, reorder, or deduplicate source records.
6. If records appear inconsistent, retain the source values and create a migration/reconciliation warning for review.
7. Keep original values and source references available for audit.
8. Establish a documented migration cut-off date and opening inventory snapshot (§6.3).
9. Before final migration, produce a reconciliation report comparing source workbook totals with the new system's imported totals.

**Exception to rule 5 — known defects are corrected, not preserved.** Rule 5 protects genuine history from silent rewriting. It does not mean carrying forward known typos. The following are confirmed defects and must be fixed during migration, with each correction logged individually in the reconciliation report:

| defect | correction |
|---|---|
| Bazar row 73: `Milk, 6, p` | unit is `l`; every other milk purchase is in litres |
| October and November `Item No` skipping 17 and 18 | regenerate from item master (1…18) |
| `Kitkat ` and ` Syrup Hersheys` leading/trailing spaces | strip; map to canonical names |
| `Kitkat`, `Kitkat (4 fingers)`, `Waffle Stick`, `Poly Bag` in Bazar | map to the canonical Stock names |
| `Currier Charge`, `Salary`, `Insect Light` used as item names | split into expense type + name (§5.3) |
| `Empty Container` | excluded from Stock entirely; it is a reminder row, not an item |
| Stock `E29` literal `1050` | replace with the item's valuation formula |
| Duplicated All Time expense block | **delete, do not migrate** (§8.6) |

November's `Total Waffles Sold` was a stale hardcode of 208. It was corrected in the source on 17 Nov 2026 to `=SUM(E8:E19)` = 337, so no migration correction is needed — but the rebuild must derive it, never accept it as an input.

A correction that changes a quantity, unit, or total must appear in the reconciliation report with before and after values. A correction made silently is a bug.

**`BM October` is not migrated.** It has been deleted from the source workbook and is out of scope (§13.F37). Its purpose — knowing October usage and cost by batch — is served by date-range filtering in the new system.

## 10. Reporting and dashboard goals

The system should help the owner understand what is happening in the business, not merely store transactions.

Useful reporting dimensions:
- Daily, weekly, monthly, custom date range, and all-time
- Item-wise sales
- Waffle-wise sales ranking
- Revenue and units sold
- Invoice count and average order size
- Discount and due
- Payment-method breakdown
- Bazar/expense by category
- Inventory purchase by item
- Ingredient consumption and cost
- Remaining stock value
- Low-stock and low-batch alerts
- Product-level assumed cost, selling price, and POS profit
- Real product cost derived from recipe and topping consumption, shown alongside the assumed cost (§13.D30)
- Packaging cost as its own line, separate from ingredient cost (§13.D31)
- Gross and net business performance, using the settled expense definitions in §13.B

Reports must be filterable and should recalculate from source records. Avoid manually typed summary totals.

**Every report must respect the same two constraints:**

- A date range in any report means a range of **open days** (§8.4), unless the report is explicitly about calendar time.
- The October period is an investment month (§13.F38). A report that shows October as an operating loss is misrepresenting the business; the capital nature of those purchases must be representable.

## 11. Data integrity and audit requirements

- Keep transaction history; do not overwrite historical transactions to represent a new event.
- Use unique IDs for purchases, batches, POS snapshots, adjustments, and other records.
- Log important edits/corrections with timestamp and record reference where feasible.
- Prevent duplicate submissions.
- Validate that an item exists in the item master before accepting a purchase or stock snapshot.
- Use protected formula/configuration ranges where appropriate.
- Clearly distinguish editable input cells from calculated cells.
- Keep a visible system/configuration area for thresholds, conversion rules, prices, and other settings.
- Never delete historical data as part of a normal setup or update operation.
- Provide a backup step and a safe migration mode.

**One source, one truth.** Every figure the owner reads must have exactly one derivation path. The recurring defect in the current workbook is not a wrong formula — it is the same number maintained twice, then drifting apart:

- Expenses exist in the Bazar sheet *and* as a typed block in All Time (§8.6).
- A daily waffle total exists in the Daily Waffles block *and* in the summary above it.
- `Item No` is typed into three separate monthly sheets.
- Discount, due, invoices, and month boundaries are each typed per sheet.

Design rule: if a number can be recomputed, it must never be stored as an input. If it must be stored — an invoice's last number, a POS counter, a typed opening balance — it is stored exactly once, at the finest granularity available, and every summary derives from it.

**Negative and impossible states must be visible.** The current sheet allows stock to go negative, allows a purchase amount to be a literal while its siblings are formulas, and allows a monthly total to contradict the rows beneath it, all without any indication. The rebuild must make every one of these either impossible or loudly flagged. A silent wrong number is worse than a visible error.

**Distinguish "closed" from "missed."** A day with no data is ambiguous (§13.A7). The system must be able to tell the owner "you were closed" apart from "you forgot to enter today's snapshot," because the first is correct behaviour and the second corrupts every average that follows it.

## 12. Explicit non-goals / constraints

- Do not merely polish or reformat the uploaded Excel workbook.
- Do not make the user enter the same purchase quantity in both Bazar and Stock.
- Do not require the user to enter POS-derived units sold manually.
- Do not require separate daily POS stock entry in Daily Waffles, All Time, and each month.
- Do not hard-code a fixed number of months or rows.
- Do not assume all Bazar purchases are inventory items.
- Do not infer missing historical purchase quantities from prices alone.
- Do not delete or reset live records when deploying updated scripts.
- Do not hard-code the number of batches, days, items, or months anywhere in a formula or script.
- Do not derive a closed day from a weekday rule; closed days are a dated list.
- Do not subtract Discount more than once, or from any figure that already has it removed.
- Do not maintain an expense list anywhere except the single expense table.
- Do not carry forward known data defects unlabelled during migration (§9).
- Do not build promo, upsell, ROI, or break-even analysis (§13.F40).
- Do not introduce pounds, or treat litres as a separate calculation basis.
- Do not let a POS stock-counter value be compared to or reconciled with physical ingredient stock value.
- Do not back-fill daily invoice counts that were never recorded (§7.2).
- Do not let a POS sale of an ice cream product reduce ice cream stock; ice cream consumption is entered by hand (§13.G1).
- Do not add any stock item other than `Water` as a POS-driven resale link without an explicit decision (§13.G1).
- Do not infer "waffles per batch" at runtime from sales history; it is a Settings value seeded once (§13.D30).
- Do not hard-code cost benchmarks or low-stock thresholds; they live in Settings and are owner-editable.
- Do not treat a Bazar `Ref` as unique or as a record key; it groups invoice lines only (§5.2).
- Do not build per-invoice entry forms for discount, due, or payment method; those are dated daily totals (§13.G3).

---

# 13. Confirmed business rules

These are settled. Implement them as written; they are not open questions and must not be re-negotiated during the build. Anything not covered here is either in §14–§17 or was one of the questions now resolved in §13.G.

## A. POS and sales data

1. **The POS stock export contains exactly six columns:** `SL.`, `Product`, `Cost`, `Qty`, `Sale`, `Stock Value`. There is no invoice column, no date column, and no discount or due column.
2. **`Cr. Stock` is the export's `Qty` column.** That is the only figure the owner types or pastes.
3. **Counters start at 10,000 and decrease. They never reset before reaching 0.** On reaching 0 a counter restarts at 10,000, and **the cumulative total is preserved** — a product that refills once carries a 20,000 lifetime baseline. See §7.2.
   - **A reset is detected automatically and handled silently.** The owner is shown the correct positive units sold and the preserved cumulative total; no confirmation step and no manual "reset" flag is required (§13.G7). The previous counter value is retained, so the reset is always auditable after the fact.
4. **Invoice counts are not in the export.** The owner reads the POS's last invoice number and enters only that; the system derives the daily count.
5. **The six extra items share the same export and the same 10,000 baseline** as the 12 waffles.
6. **Wednesday is the closed day.** In future there may be more closed days or none, so closed days are stored as a dated list, never as a fixed weekday rule.
7. **A day with no snapshot is either a closed day or a missed entry**, and these must be distinguishable. The system must not silently treat a missing day as zero sales.

## B. Cash, payment, discount, and due

8. **Cash in hand = Original Sale − Due − Bazar**, where Original Sale is already net of Discount. In full: `(Gross Sales − Discount) − Due − Bazar`.
9. **Discount is never subtracted twice.** It is applied once, at the point Original Sale is computed (§8.1).
10. **bKash is included in cash in hand.** It is not a separate cash pool.
11. **Bank / Cash Box is the physical drawer float** — currently a constant 500 BDT. It is not a daily flow and is not added to sales.
12. **`PIX. All Time` is a POS cross-check only.** It exists so the owner can compare the system's calculated sale against the POS's own figure. It is not an input to any profit or cash figure.
13. **Due is money customers owe Awwffle**, not money owed to suppliers.
14. **Discount is entered as one dated daily total**, not per product and not as an undated monthly lump. It is conceptually a per-invoice figure, but because the POS export carries no per-sale rows (§13.G3) it is captured once per day and applied once, at the point Original Sale is computed. The per-invoice nature is preserved in the arithmetic, not in a per-invoice record.
15. **Bazar reduces the all-time total and the monthly total; what remains is cash in hand.** A Bazar entry reduces cash when it is recorded, not when it is later marked paid.
16. **Due is accrued as one dated daily total** and settled as a dated record of `date + amount`. A customer name is optional, not required, because the POS provides no per-invoice identity (§13.G3) and the owner does not build per-invoice records. A due figure is never edited in place; a settlement is a new dated entry that reduces the outstanding balance.

## C. Bazar, inventory, and units

17. **Every item in the Recipes, Toppings, Packaging, Equipments and Resale groups is inventory-managed.** None of them are pure non-stock expenses.
18. **Bazar categories are two fields, not one:** the item/expense name, and an expense type. Expense types are `Inventory purchase`, `Salary`, `Courier`, `Maintenance`, `Other`. Selecting `Other` reveals a free-text field to name it.
19. **Inventory purchase items use the canonical item names from the Stock sheet.** Non-inventory expenses (Salary, Courier, Maintenance) are recorded without any stock impact.
20. **One canonical name per item across the whole system.** No aliases, no variant spellings, no per-sheet naming. Purchase records, stock records, and reports all use the same name. The Stock sheet's names are the master list; the POS product names follow the Daily Waffles list. Where these two differ (e.g. `Kitkat` vs `Kit-Kat Kraze`) they are different things and must not be merged — one is an ingredient, the other is a finished product.
21. **Units are pieces, grams, and millilitres.** Purchases may be entered as `p`, `kg`, `gm`, `l`, or `ml`.
22. **1 l is treated as 1 kg.** Litres are never stored as a separate calculation basis.
23. **Pounds are not used.** The 500 gm = 1 pound equivalence is not stored and must not appear in the model.
24. **No conversion-flagging workflow.** The owner's stock quantities already express the correct basis per item (§6.1), so an unverified conversion is a data-setup problem, not a runtime prompt.
25. **Stock value uses weighted average cost. Bazar keeps the latest purchase rate.** These are two different columns and must never be used interchangeably. See §6.2.1.
26. **Wastage and damaged items are tracked in v1**, as a dedicated adjustment entry (item, quantity, reason, date). Wastage is recorded **separately from** theoretical recipe consumption and is never added into it, so a wasted unit is never counted as both consumed and wasted (§13.G6). The exact column layout is fixed at phase 2.

## D. Recipes and product costs

27. **Recipe measurements are fixed indefinitely.** There is no effective-dated recipe versioning in v1.
28. **`Waste` must not exist in Measurements.** It is not a preparation, a category, or an allowance.
29. **`Cost` and `Sale` per waffle stay side by side as configured values**, because they are supplied by the POS and are assumptions. Both are stored as a **dated price history**, not a single overwritable value, so a past month's POS profit stays reproducible after a price change (§13.G4). A price change takes effect from a stated date and never rewrites earlier periods.
30. **Real cost must also be calculated** from recipe and topping consumption, so the assumed POS cost can be compared against the actual cost. Real cost is reported at two levels, because a batch does not map 1:1 to a waffle (§13.G2):
    - **Cost per preparation batch** — the primary figure. Each preparation's batch cost is the total used cost of its ingredients for one batch, from the fixed Measurements and the weighted-average rates. This is exact and needs no yield assumption.
    - **Cost per waffle** — the secondary figure. `preparation batch cost ÷ waffles per batch`, where `waffles per batch` is a **configurable Settings value per preparation**, seeded from observed history (Batter ≈ 24.8, Nutella Mix ≈ 33.2, Cream ≈ 63.9) and owned by the owner thereafter. It is never hard-coded and never inferred at runtime from sales data.
    - A waffle consumes more than one preparation, so the per-waffle real cost is the sum of its preparation components under the stated rule. Where the split across preparations is not fixed, each preparation's contribution must be shown separately rather than silently averaged into one number.
31. **Packaging is included in the assumed waffle cost** but must also be visible as its own cost line, so the owner can see what packaging alone costs.

### Cost benchmark and yield settings (new, from §13.G2)

**A cost benchmark is a first-class setting, not a report afterthought.** The owner sets a target cost per batch and per waffle (or a target cost percentage). The system reports actual against benchmark, so a rising cost is visible while sales are low. This is the stated purpose of the real-cost calculation and replaces any implicit "cost looks fine" assumption.

Stored in the Settings sheet, editable by the owner, never in code:

| setting | per | purpose |
|---|---|---|
| `waffles per batch` | each preparation | converts batch cost to per-waffle cost |
| `target cost per batch` | each preparation | benchmark for one batch |
| `target cost per waffle` | product | benchmark for one waffle |
| `target cost %` | business | benchmark for cost as a share of sale price |

A benchmark may be blank, in which case the comparison is simply not shown. A benchmark must never be substituted with a guessed default at calculation time; seeding happens once, in setup, and is visible in the sheet.

## E. Operation and interface

32. **Desktop is the primary target.** Mobile is not a design constraint.
33. **Daily entry uses forms / sidebar dialogs, not raw spreadsheet rows**, so entries are labelled, validated, and hard to mis-key.
34. **Low-stock and low-batch thresholds are configured per item.** Defaults may be seeded, but the owner edits them.
35. **Only the owner may edit records, recipes, prices, or settings.**

## F. Scope and source of truth

36. **`Current Blueprint.xlsx` is the authoritative source.** It replaces any earlier workbook. Its history runs from 17 October 2026 to 16 November 2026 and that is the complete history to migrate.
37. **`BM October` is deleted and out of scope.** It is not to be preserved or migrated. Its purpose (knowing October usage and cost by batch) is now served by the date-range filtering in this system.
38. **October was an investment month, not an expense month.** The first 15 days were setup capital. October purchases are recorded in Bazar and are real purchases, but they are not treated as operating expense for the October period's profit.
39. **October Bazar entries are investment**, and are imported as such rather than silently dropped.
40. **The promo / upsell analysis block is out of scope and deleted.** Buy X/Get Y, Paid Waffles, Extra Waffles Given, Net Gain, ROI, break-even, and Updated Profit % are all removed and must not be rebuilt.
41. **Analysis in v1 is limited to the filtering and reporting described in this document.** No other analytical blocks are in scope.
42. **The opening snapshot is "stock holding from day 1 until 16 November 2026."** See §6.3 for how that is expressed without double-counting October purchases.

## G. Resolved questions (v0.3)

These were the open items in v0.2. **All five blocking questions are now answered by the business owner and are settled rules.** They are recorded here with the original question preserved, so the reasoning is not lost; the answer is the rule and must not be re-opened.

**Blocking — answered**

1. **Are `Water 500ml` and the three `Ice Cream` items resale products, ingredient stock, or both?**
   - *Original problem:* the workbook treats them as Stock rows *and* as POS products, with disconnected tracking (Water 16 used vs 18 sold; ice creams 1,000 used vs 7 sold, all three at zero remaining).
   - **ANSWER — they are not the same kind of item, and must be handled separately:**
     - **`Water` is a resale product.** One POS sale of `Water 500ml` subtracts one piece from the `Water` stock row automatically. This is the only stock item driven by POS sales.
     - **The three `Ice cream (…)` items are topping stock, not resale.** They are sold standalone on the POS, but that sale affects revenue only. Consumption is entered **manually by the owner when a can is finished**, exactly like the other toppings. A POS ice cream sale never reduces ice cream stock.
     - The historical mismatch (16 vs 18, 1,000 vs 7) is a consequence of the old workbook having no defined link. It is **not** to be back-corrected into agreement during migration; record it as a stated reconciliation difference and let the new rules apply from the cut-off forward.
   - This adds a third population to §17.3. The link is explicit configuration (`POS product → stock item`), never inferred from a similar name.

2. **How is the waffle-level cost breakdown wanted?**
   - *Original problem:* batches do not map 1:1 to waffles (24.8 waffles per Batter batch, 33.2 per Nutella Mix, 63.9 per Cream), so a single per-waffle number required an unstated rule.
   - **ANSWER — report both batch cost and waffles per batch:**
     - **Preparation batch cost** is the primary, exact figure and needs no yield assumption.
     - **Cost per waffle** derives from it via a **`waffles per batch` setting per preparation**, seeded once from observed history and then owner-editable (§13.D30). It is configuration, not a hard-coded constant and not inferred at runtime.
     - **A benchmark is required alongside**, so the owner can see cost rising while waffle sales are low. Benchmarks are Settings values (§13.D, "Cost benchmark and yield settings").
     - The 831-waffle figure covers only the 12 waffles; the six extras stay separate and are never folded into waffle cost.

3. **What identifies a sale when the POS gives no transaction data?**
   - **ANSWER — dated daily totals, not a per-invoice entry form.** Discount and due are each entered as **one dated daily total** per day. The owner does not build per-invoice records, and no per-sale identity is required. Every total is stored once at daily granularity, so monthly and all-time figures derive from the same rows (§13.B14 is satisfied by a daily record rather than a per-invoice one).

4. **How should the per-waffle assumed `Cost` be kept in sync?**
   - **ANSWER — dated price history.** `Cost` and `Sale` per product are stored as a history with an effective date, so a past month's POS profit stays reproducible after a price change. A price change never rewrites earlier periods (§13.D29).

5. **Do Bazar purchases ever have more than one line per invoice?**
   - **ANSWER — yes, and one row per item is correct.** A can have multiple items on one invoice, and `Ref` (`#NP01`, `#DCC01`, `#DCC02`, `Riyad`) groups those rows into one bill. `Ref` is a grouping key only; record IDs carry uniqueness. The entry form supports adding several lines to one invoice in one sitting (§5.2).

**Non-blocking — now also settled**

6. **Wastage/adjustment schema** — unchanged from §13.C26: a dedicated entry of `item, quantity, reason, date`, kept separate from recipe-derived consumption so wastage is never double-counted. Exact column layout is fixed at phase 2 (data model).
7. **POS counter reset detection** — **detected automatically and handled silently**; no owner confirmation and no manual flag. The previous counter value is retained for audit and the cumulative total is never lost (§13.A3, §7.2).
8. **Low-stock and low-batch thresholds** — **seeded defaults, owner-editable per item.** Defaults are derived from observed history (e.g. warn below roughly three trading days of stock) and written visibly into the Settings/Item Master sheets during setup. Defaults are seeded once and never substituted at calculation time.
9. **First-day invoice rule** — when no previous invoice number exists, the day's count is seeded from the opening baseline and the source used is recorded on the record (§7.2). Never guessed.
10. **Promoting a manual item to recipe-driven** — supported by design; an item gains recipe rows and switches population without restructuring (§17.3).

## H. Delivery and migration mechanics (new in v0.3)

These are build decisions the owner has confirmed, and they govern how the system is delivered and first installed.

1. **The implementation is delivered as `.gs` files in a `googlescript/` folder** in this repository, which the owner copies into the spreadsheet's Apps Script editor by hand. The files remain in the repo as the reference copy, so the code is reviewable and improvable outside the sheet.
2. **First-time setup is documented step by step**, and later updates are "copy the changed file, paste, run the update function." An update must never clear or overwrite live data (§2.6).
3. **Migration source is the owner's own copy of the workbook.** The migration reads a Google Sheets copy of `Current Blueprint.xlsx` that the owner places in Drive; the original `.xlsx` is never modified (§16). The import writes a reconciliation report and logs every correction (§9).
4. **Setup is safe to re-run.** Creating sheets, headers, menus, protections, and seeded defaults is idempotent; running it twice must not duplicate rows or reset values the owner has edited.

---

# 14. Recommended implementation sequence

Build and test in phases. Do not attempt a full build before the data model and formulas are agreed. The audit in §17 is already complete, so phase 1 is done — start at phase 2.

1. ~~**Workbook audit and migration map**~~ — complete; see §17.
2. **Data model and configuration** — define item master, categories, expense types, units and per-item base units, conversion rules, recipes, closed-day calendar, and stable IDs. Also define, from the v0.3 answers: dated product price history (§13.D29), per-preparation `waffles per batch` and cost benchmarks (§13.D), per-item low-stock/low-batch defaults (§13.G8), and the resale link between `Water 500ml` and the `Water` stock item (§13.G1).
3. **Historical migration** — import existing records and opening stock; apply the logged defect corrections (§9); generate the reconciliation report.
4. **Bazar and purchasing** — implement single-entry purchasing and automatic stock increases, with the two-field category model.
5. **Measurements and Batches** — implement fixed recipe data and daily batch entry via form.
6. **Stock calculations** — implement usage, remaining stock, weighted-average valuation, estimates, closed-day-aware day counts, and alerts.
7. **POS snapshots and Daily Waffles** — implement bulk `Cr. Stock` paste, snapshot-based sales, counter-reset handling, and last-invoice entry.
8. **All Time and monthly reporting** — implement automatic summaries from the same underlying records.
9. **Cash and profit reporting** — implement against the settled definitions in §8.1 and §13.B.
10. **Testing and deployment** — test historical dates, corrections, duplicate prevention, month boundaries, low stock, unit conversion, counter resets, closed days, and script updates.

Every phase must include test cases and must preserve existing data.

**Test fixtures that already exist.** The current workbook provides known-good expected values, so the build can be verified without waiting for new data:

| check | expected |
|---|---|
| All Time working days | 28 |
| All Time total waffles sold | 831 |
| October / November waffles sold | 494 / 337 |
| All Time Original Sale | 104,940 |
| All Time POS Cost | 54,094 |
| All Time cash in hand | 65,770 |
| October / November / All Time Bazar | 53,890 / 39,050 / 92,940 |
| Items reconciling stock vs purchases | 40 of 43, with Milk, Waffle Box, Waffle Tray explained |

If the rebuild does not reproduce these from the same source records, the bug is in the rebuild — not in the source.

Note: cash in hand is 65,770, not the 65,890 the workbook showed before 17 Nov 2026. The typed expense block in All Time gained a 120 BDT cell at `Q32`, which is correct — the block now totals exactly 39,050, matching Bazar. See §8.6.

---

# 15. Acceptance criteria

The system is not ready for daily use until all of the following are true:

- A Bazar purchase is entered once and increases the correct inventory balance exactly once.
- A non-inventory expense does not increase stock.
- Adding or correcting a batch recalculates ingredient usage correctly from the fixed Measurements.
- Fractional batches work.
- Purchase units convert correctly to the stock base unit, including items held in pieces with a known per-piece weight.
- Stock as of a past date can be calculated from historical transactions.
- Remaining stock value plus used cost equals total purchase spend for every item.
- Low-stock and low-batch alerts identify items that need attention.
- A daily POS `Cr. Stock` snapshot calculates units sold against the previous snapshot.
- A POS counter reset produces positive sales and preserves the cumulative total.
- POS snapshot history is retained and corrections recalculate affected sales.
- Daily invoices are derived from the entered last-invoice number, never typed directly.
- A closed day is distinguishable from a missed entry and does not distort per-day averages.
- Daily Waffles, All Time, and monthly reports use the same source records and do not require duplicate entry.
- Product order and names match the source workbook/POS.
- Cash in hand subtracts Discount exactly once.
- Every expense figure comes from one expense table; no summary re-lists expense amounts as typed cells.
- Historical records and opening stock reconcile against the original workbook, with every deliberate correction logged.
- A `Water 500ml` POS sale reduces `Water` stock by exactly one piece, exactly once.
- Selling an ice cream product does **not** change ice cream stock; its consumption is entered by hand as a topping.
- Real cost is reported per preparation batch, and per waffle using the configured `waffles per batch` value, never a hard-coded constant.
- Actual cost is shown against the owner's benchmark so a rising cost is visible while sales are low.
- Changing a product's POS `Cost` or `Sale` price from a given date leaves all earlier months' profit unchanged.
- Discount and due are stored as one dated daily total each, and settle into monthly and all-time figures without manual totals.
- Multiple Bazar rows sharing one `Ref` report as a single invoice total, while each row still carries its own item amount.
- Low-stock and low-batch defaults are seeded once and remain owner-editable, and are never substituted at calculation time.
- A POS counter reset is handled without owner confirmation, produces positive sales, and preserves the cumulative total.
- Running an updated script does not clear or overwrite live data.
- The system supports future months and additional catalogue items.

---

# 16. Source workbook

The original workbook supplied for this project is:

`Current Blueprint.xlsx`

It contains **eight** sheets, in this order:

1. Measurements
2. Batches
3. Stock
4. Daily Waffles
5. All Time
6. October
7. November
8. Bazar

`BM October` was the ninth sheet and has been **deleted** (§13.F37). Do not expect it, and do not treat its absence as data loss.

The source workbook must remain unchanged. Work on a copy or import its data into a separate new Google Sheets file.

---

# 17. Source workbook audit

This section records what the current workbook actually contains, as verified by inspecting the file directly. It exists so the build can proceed without re-deriving these facts, and so that any future discrepancy can be traced to a specific known cause.

## 17.1 Data extent

| sheet | contents | coverage |
|---|---|---|
| Measurements | 17 ingredient rows + 1 reminder row, 5 preparation columns | fixed configuration |
| Batches | 30 dated batch records | 14 Oct 2026 → 16 Nov 2026 |
| Stock | 43 items, 17 columns | current position, manually maintained |
| Daily Waffles | 28 daily blocks × 18 products | 17 Oct 2026 → 16 Nov 2026 |
| All Time | 18 products + 15 summary fields | 17 Oct 2026 → 16 Nov 2026 |
| October | 18 products + 15 summary fields | 17 Oct 2026 → 31 Oct 2026 |
| November | 18 products + 15 summary fields | 1 Nov 2026 → 16 Nov 2026 |
| Bazar | 72 purchase/expense rows | 10 Oct 2026 → 16 Nov 2026 |

- **28 POS snapshot days** across a 31-day range. Missing: 22 Oct (Thursday), 4 Nov and 11 Nov (Wednesdays).
- **Batches span 34 days** with 30 records. Two batch dates (14 Oct, 16 Oct) fall before the first POS snapshot, and there are Wednesday batches on 14, 21 and 28 October — so batches are not confined to open days.
- All 18 POS counters are still between 9,838 and 10,000. **No reset has occurred yet**, which is why the reset rule (§7.2) must be built and tested ahead of the event rather than after it.

## 17.2 Structure of the Stock sheet

Seventeen columns, of which the calculation chain is:

```
Name  Quantity  Unit  Rate  BDT  Stock | Batter Nutella Cream WhiteMix Cheese | Total Used  Used Cost  Remaining  Rem. Value  Est. Days  Est. Batch
 A       B       C     D     E     F   |   G       H       I       J       K    |     L          M           N           O           P          Q
```

- `E` (BDT) converts Quantity × Rate into a money value by unit.
- `F` (Stock) converts Quantity into the base unit for calculation — `×1000` for kg/l, `×350` for Nutella jars, identity for pieces and grams.
- `G–K` derive consumption per preparation from Measurements × Batches.
- `L = SUM(G:K)` for the 17 recipe-driven items, and is **typed by hand** for the other 26. This is the split noted in §3.3.
- `M, N, O` derive used cost, remaining quantity, and remaining value.
- `P` (Est. Days) divides remaining quantity by daily consumption across the batch date span.
- `Q` (Est. Batch) takes the minimum batch count across preparations, so it reports the bottleneck preparation.

Two structural details worth preserving exactly:
- **`Nutella` is a jar with a 350 gm basis**, encoded as `MULTIPLY(350, quantity)`. Any rebuild that assumes one universal multiplier per unit type will silently corrupt Nutella.
- **`Empty Container` has measurement values for all five preparations but no Stock row.** It must be excluded from consumption entirely or it becomes an orphan in every total.

## 17.3 The three consumption populations

| population | items | consumption source | Est. Batch |
|---|---|---|---|
| Recipe-driven | 17 | Measurements × Batches, automatic | computed |
| Manually maintained | 25 | typed Total Used / physical counts | blank by design |
| Resale product | `Water` / `Water 500ml` | POS unit sales, 1 sale = 1 piece, automatic | blank by design |

Within those populations the 43 items are labelled by group: `Recipes` 17, `Toppings` 15,
`Packaging` 6, `Equipments` 4, `Resale` 1 (§4.4). **Group is a label; population is the
behaviour.** The 25 manually maintained items are the 15 Toppings + 6 Packaging + 4
Equipments; Water is deliberately not among them because its movement comes from POS sales.

The rationale is that toppings and packaging have no established per-waffle pattern yet. This is deliberate, not a gap. The design must allow a manual item to be promoted to a recipe-driven item later without restructuring anything.

The resale case is separate again: it is driven by sales rather than production, and it applies to `Water` only (§13.G1). `Water` is the sole item whose stock moves from a POS sale. The three `Ice cream (…)` items sell on the POS but are consumed by hand as toppings, so their stock never moves from a sale.

## 17.4 What reconciles

Independently verified against the raw file:

- **Cash formula is internally consistent.** `104,940 − 120 − 39,050 = 65,770`, matching the stored value. The formula is right; its *input* is a summary that drifted from Bazar (§8.6).
- **Monthly and all-time sales chain correctly.** October current stock equals November previous stock for all 18 products, with no breaks. All Time 831 = October 494 + November 337.
- **November's waffle total is now derived**, `=SUM(E8:E19)` = 337, corrected 17 Nov 2026. Its three averages consequently moved to 1.88, 127.34 and 24.07.
- **Stock reconciles to purchases for 40 of 43 items**, exactly. The three exceptions are documented in §6.3.
- **Working-day counts match the snapshot count** — 28, 14, 14 — so the per-day averages in the sheet are correct.
- **Discount sums sensibly.** October 6,032 + November 2,826 = 8,858 against All Time 8,892, a 34 BDT residual from unallocated entries.
- **The Bazar typed block now totals exactly 39,050**, matching the Bazar sheet, after a 120 BDT cell was added at `Q32` on 17 Nov 2026. The two sides still differ row by row (§8.6), but the totals agree.
- **Waffles and extras are cleanly separated.** The 831 all-time figure covers only the 12 waffles; the six extra items sold 25 in total (Water 18, Ice Cream - Vanilla 5, Ice Cream - Strawberry 2, the rest zero). The daily blocks reproduce both figures exactly, so the extras are not leaking into waffle counts.

## 17.5 What is broken or missing

Ordered by how much damage it causes if carried forward.

1. **Two expense ledgers, tied only by coincidence** (§8.6) — both total 39,050, but 31 typed cells against 34 Bazar rows, with six purchases missing and three phantom amounts balancing them. Any edit breaks cash in hand silently.
2. **No daily invoice history exists anywhere.** Only three monthly totals were ever typed. Cannot be back-filled (§7.2).
3. **Free-text and alias item names in Bazar** — `Kitkat`, `Kitkat (4 fingers)`, `Waffle Stick`, `Poly Bag`, plus a leading space on ` Syrup Hersheys`. Any of these silently splits one item into two.
4. **Resale products and ingredients share names and are tracked differently.** `Water` is a 50-piece stock item but `Water 500ml` is a POS product sold 18 times, and stock records only 16 used. The three `Ice cream (…)` items are held in kg while the POS counts them in units, and stock records 1,000 used against 7 sold. There is no defined relationship between a resale product's POS counter and its ingredient stock row. **Resolved in v0.3 (§13.G1):** `Water` becomes the single POS-driven resale link; ice cream stays manual topping stock. The old mismatch is recorded as a stated migration difference and is not back-corrected.
5. **A unit typo on a real purchase** — Bazar row 73, `Milk, 6, p` (§6.3).
6. **Stock valuation does not reconcile** — 98,956.50 against 92,940.00 actual spend (§6.2.1).
7. **`Item No` drift** — 17 and 18 skipped in October and November (§8.5).
8. **`Empty Container`** is present in Measurements but absent from Stock, with no note explaining it.
9. **Several summary cells are typed literals** rather than formulas (§8.5), including `First Day`, `Last Day`, `Total Invoices`.
10. **One Stock cost cell is a literal among formulas** — `E29` (§8.5).
11. **No closed-day record exists.** The Wednesday rule is applied by formula but contradicted by the data (§8.4).
12. **No wastage, damage, or adjustment concept exists at all.**
13. **No payment or discount record exists per day.** Discount and due are typed monthly totals; Bazar `Status` is `Paid` on all 72 rows, so unpaid-expense handling is untested.
14. **`Consumption cost ≠ POS assumed cost`.** Real used cost is 48,752.85 against the POS's assumed 54,094 — a 5,341 difference with no report explaining it. This is the gap §13.D30 exists to close.

## 17.6 Missing pieces to design, not migrate

These do not exist in the source and have no historical data to import. They must be designed and built new:

- Closed-day calendar (§8.4)
- Expense type taxonomy as a separate field (§13.C18)
- Wastage / damage / manual adjustment entries (§13.C26)
- Due settlement records with date and optional customer name (§13.B16, §13.G3)
- Daily invoice records derived from last-invoice numbers (§7.2)
- Counter-reset state per POS product (§7.2)
- Per-item low-stock and low-batch thresholds (§13.E34)
- Weighted-average cost history per item (§6.2.1)
- **Dated price history per product for POS `Cost` and `Sale`** (§13.D29, §13.G4)
- **Per-preparation `waffles per batch` setting and cost benchmarks** (§13.D "Cost benchmark and yield settings", §13.G2)
- **Explicit resale link mapping `Water 500ml` to the `Water` stock item** (§13.G1)

## 17.7 Field-level reference

The column layouts below are what the migration reads. Field names are preserved from the source where meaning survives.

**Measurements** — `Ingredients | Batter | Nutella Mix | Cream | White Mix | Cheese`. One row per ingredient, grams per batch. Blanks mean not used.

**Batches** — `Date | Batter | Nutella Mix | Cream | White Mix | Cheese`. Fractional batch counts, one row per production date. Row 1 beyond the header holds column totals.

**Stock** — `Name | Quantity | Unit | Rate | BDT | Stock | Batter | Nutella Mix | Cream | White Mix | Cheese | Total Used | Used Cost | Remaining | Rem. Value | Est. Days | Est. Batch`.

**Daily Waffles** — repeating 23-row blocks. Each block: a date label in column A, then 18 product rows of `Product | Pv. Stock | Cr. Stock | Waffles`. Two footer rows carry a batch summary string and a per-day waffle total.

**All Time / October / November** — one row per product: `Item No | Item Name | Prev. Stock | Cr. Stock | Unit Sold | Cost | Sale | Total Sold | Total Cost | Total Profit`. A `M:N` block holds the 15 summary fields: `First Day, Last Day, Total Days, Total Invoices, Total Waffles Sold, Avg Waffles per Invoice, Per Invoice order, Original Sale, POS Cost, POS Profit, Cash in hand, AVG. Day Sell, AVG. Waffle Sold Price, AVG. Waffle Cost, AVG. W/per day`. A separate `O:S` block holds `Discount, Due, Bazar, bKash, Bank/Cash Box`.

**Bazar** — `Date | Category | Expense For | Unit | Rate | Amount (BDT) | Ref | Status`. `Category` carries the item or expense name and must be split into two fields (§5.3). `Amount` is derived from quantity × rate after unit conversion.

Two things the migration must **not** carry over from these layouts:

- The three monthly summary sheets are structurally identical, which is exactly what makes hand-maintained duplication possible. In the rebuild there is one set of source records and the monthly views are filters over it.
- `All Time` also contains a second typed list of expense amounts (the `Q` column block). It is not a field of the data model; it is the duplicate ledger described in §8.6 and must be dropped.

---

# 18. Change log

**v0.3** — all blocking open questions resolved; delivery mechanics settled. No business rule from v0.2 was reversed; the following were added or made precise:

| # | change | where |
|---|---|---|
| 1 | `Water` is a POS-driven resale item; the three ice creams are manual topping stock | §3.3, §13.G1, §17.3 |
| 2 | Real cost reported per preparation batch **and** per waffle via an owner-editable `waffles per batch` setting, with cost benchmarks | §13.D30, §13.D (settings) |
| 3 | POS `Cost` and `Sale` stored as dated price history | §13.D29, §13.G4 |
| 4 | Discount and due are dated **daily totals**, not per-invoice records | §8.1, §13.B14, §13.B16, §13.G3 |
| 5 | Bazar `Ref` is a grouping key for multi-item invoices; one row per item | §5.2, §13.G5 |
| 6 | POS counter reset detected automatically and handled silently | §7.2, §13.A3, §13.G7 |
| 7 | Low-stock and low-batch thresholds seeded once, owner-editable | §13.E34, §13.G8 |
| 8 | Delivery as `.gs` files in `googlescript/`, copy-paste install and safe re-runnable updates | §2, §13.H |
| 9 | Third consumption population added to the audit | §17.3 |

**v0.2** — requirements captured, source workbook audited (§17), business rules settled in §13.

---

**Important instruction to the implementing AI:** This document is a living requirements draft. Sections 1–12 define what to build; §13 is settled business rules; §17 is the verified state of the source data. Do not re-open decisions recorded in §13, including those resolved in §13.G. Do not silently make business, accounting, inventory, or migration assumptions beyond what is written here. Do not "clean up" the source workbook as a substitute for building the system.