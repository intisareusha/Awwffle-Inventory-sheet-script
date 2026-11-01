# Awwffle — Business Management Workbook (Google Sheets / Apps Script)

This folder holds the **source code** for the Awwffle business management workbook.
The workbook itself is built inside **your own Google account** when you run one function.

Nothing here is Microsoft-Excel-dependent. The generated sheet will also export to
`.xlsx` cleanly because every formula is kept inside the Excel-portable set
(`SUMIFS`, `COUNTIFS`, `SUMPRODUCT`, `INDEX/MATCH`, `IF`, `IFERROR`).

> New here? Read **`RUN-STEPS.md`** — it is the simple, click-by-click guide.

---

## What it builds

One Google Sheet with these tabs (in this order):

| Tab | Purpose |
|---|---|
| START HERE | What the workbook is + daily workflow |
| Lists | Controlled vocabularies feeding every dropdown |
| Item Master | One canonical name + base unit per item |
| Product Master | POS products, prices, costs (prices pending owner) |
| POS Raw Data | Immutable daily stock snapshots (append only) |
| Sales Log | Product sales derived from POS movement |
| Daily Finance | One row per operating day |
| Period Summary | Oct 17–30 supply + reconciliation |
| Production Log | Batches prepared per day |
| Recipes BOM | Ingredients per batch |
| Purchases | Bazar purchases (source of truth for buying) |
| Expense Log | Salaries / electricity / maintenance / other |
| Inventory | Purchased vs consumed vs remaining per item |
| Packaging Stock | Countable serving materials |
| Unit Conversions | Purchase unit → base unit factors |
| Stocktake | Physical counts, wastage, adjustments |
| Executive / Product / Inventory / Financial Dashboards | KPIs |
| Reports | Monthly & all-time (single data source) |
| Reconciliation | Active error-checks (PASS / REVIEW / INFO) |

## Design principles honoured

- **One canonical name per item** — everything reads from Item/Product Master.
- **History is never overwritten** — POS snapshots are appended, purchase prices
  stay as separate records, days-remaining estimates are preserved.
- **No invented numbers** — missing values show a status (`Not supplied`,
  `Needs confirmation`, `No recipe defined`, `Conversion required`,
  `Forecast unavailable`) instead of a fabricated figure.
- **Separated concepts** — gross / discount / net / due / cash / bazar /
  expenses / COGS / POS-estimate are never merged or double-counted.
- **Scalable** — add products/ingredients to the masters; dashboards and formulas
  pick them up without rebuilding.

## Known confirmations still open (see the Reconciliation tab)

- POS unit costs and selling prices — **supplied 1 Nov 2026** and entered in
  Product Master (they reproduce gross sales 64,392 and POS cost 30,659 exactly).
- Purchase dates; daily invoice counts, discounts, due, bazar allocations.
- The ৳8 gap between daily POS sale totals (58,682) and the period net (58,690).
- Definition of POS-reported profit.
- Missing recipes: Dark Chocolate, Cream Cheese, Cheese batch, direct toppings.
- Unit conversions for `jar` (Nutella) and `pack` (whipped cream).
- Reorder levels, packaging consumption, ice cream purchase quantities.

## File map

| File | Role |
|---|---|
| `Config.gs` | Sheet names, colours, masters, lists, conversions |
| `SheetBuilder.gs` | Low-level sheet/format/validation helpers |
| `SeedData.gs` | Every supplied historical figure, verbatim |
| `Build.gs` | Builds all sheets and installs formulas |
| `Reconciliation.gs` | The active error-check sheet |
| `Main.gs` | `buildWorkbook()` entry point + the **Awwffle** menu |
| `appsscript.json` | Apps Script manifest (timezone, V8) |

## Version

`1.0.0` — first complete build (all supplied history seeded, dashboards +
reconciliation live).
