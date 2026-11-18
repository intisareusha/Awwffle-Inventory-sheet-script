# Migrating the old workbook

Phase 3 imports your history from `Current Blueprint.xlsx` into the new sheet.

**Nothing is written to the old workbook.** It is opened read-only.

---

## Before you start

You need a **Google Sheets copy** of the workbook in Drive, in addition to the
`.xlsx`. The script reads a Google Sheet, not an Excel file.

1. Upload `Current Blueprint.xlsx` to Google Drive.
2. Right-click it → **Open with → Google Sheets**. This creates a Sheet copy.
3. Keep the copy's name as **`Current Blueprint`**.
   (If Google names it something like `Copy of Current Blueprint`, rename it.)

> **Why a separate file?** The old workbook's tab names — `Batches`, `Bazar`,
> `Measurements`, `Stock` — are identical to the new ones. They cannot live in the
> same spreadsheet without one overwriting the other.

If your copy has a different name, either rename it or set
`migration_source_name` in the **Settings** tab. You can also paste the
spreadsheet ID into `migration_source_id` to skip the name lookup entirely.

---

## Run it

1. In your `Awwffle DEV` sheet, reload the page so the **Awwffle** menu appears.
2. **Awwffle → Import historical data**.
3. Confirm. Wait for the completion dialog.

You should see something like:

```
Batches imported:      30
Bazar rows imported:   72
POS snapshots:         504
Opening stock rows:    43
Closed days recorded:  3

Checks passed:         42 of 42
Need attention:        0

Everything reconciled against the source workbook.
```

If you see "Need attention", open the **MigrationReport** tab (or
**Awwffle → Open migration report**) and read the `CHECK` rows.

---

## What gets imported

| Target sheet | Rows | From |
|---|---|---|
| `Batches` | 30 | Batches, rows 3+ (row 1 is the totals row) |
| `Bazar` | 72 | Bazar, one row per item purchased |
| `POS_Snapshots` | 504 | Daily Waffles: 28 days × 18 products |
| `Invoices` | 2 | October + November monthly totals |
| `DiscountDue` | 2 | October + November monthly figures |
| `ClosedDays` | 3 | The three dates with no snapshot |
| `OpeningStock` | 43 | Stock quantity minus recorded purchases |

---

## The corrections it makes — and logs

Every one of these appears in the **MigrationReport** with before/after values.
Nothing is changed silently.

| Correction | Before | After | Why |
|---|---|---|---|
| Milk unit | `6 p` | `6 l` | Every other Milk purchase is in litres (§9) |
| `Kitkat ` | trailing space | `Kitkat` | One naming convention (D10) |
| ` Syrup Hersheys` | leading space | `Syrup Hersheys` | One naming convention (D10) |
| `Kitkat (4 fingers)` | variant | `Kitkat` | Alias (§9) |
| `Waffle Stick` | variant | `Waffle Sticks Large` | Alias (§9) |
| `Poly Bag` | variant | `Poly bag` | Alias (D3) |
| `Currier Charge` | item name | expense type `Courier` | Two-field model (§5.3) |
| `Salary`, `Insect Light` | item names | `Salary`, `Maintenance` | Two-field model (§5.3) |
| `Empty Container` | measurement row | **not imported** | No Stock row; would orphan every total (§3.1) |
| All Time column Q block | 31 typed amounts | **not imported** | Duplicate ledger; Bazar is the single source (§8.6) |

### Things deliberately **not** imported

- **`BM October`** — deleted from the source, out of scope (§13.F37).
- **Daily invoice counts** — they never existed. Only three monthly totals were
  ever typed, so these come in as monthly aggregates, explicitly labelled
  `Monthly aggregate`, not disguised as daily data (§7.2).
- **Daily discount and due** — same reason. Monthly aggregates, dated to month
  end (§13.G3).
- **Cached Excel formula values** — the file stores `__xludf.DUMMYFUNCTION`
  wrappers. Values are recomputed rather than trusted (§6.2.2).

---

## What "reconciled" means

The report compares what was imported against the numbers your workbook already
agrees on. All 42 checks pass on your data:

| Check | Value |
|---|---|
| Bazar October / November / total | 53,890 / 39,050 / 92,940 |
| Waffles sold | 831 |
| Extras sold | 25 |
| Original Sale | 104,940 |
| POS Cost | 54,094 |
| Cash in hand | 65,770 |
| Open days | 28 |
| Items fully explained by purchases | 40 of 43 |

### The three items with real opening stock

| Item | Opening | Why |
|---|---|---|
| Milk | 2,000 ml | Only after correcting the `6 p` row to `6 l` |
| Waffle Box | 1,200 p | Never purchased inside the recorded window |
| Waffle Tray | 1,200 p | Same |

Everything else is fully explained by purchases, so its opening layer is 0.

---

## The 34 BDT discount residual

October discount is 6,032 and November is 2,826 — but All Time says 8,892.
The 34 BDT difference comes from entries that were never allocated to a month.

**It is recorded as an unallocated difference, not spread across the months.**
Distributing it would invent data that does not exist (§8.1).

---

## Re-running

The migration sets a guard (`migration_completed_at` in Settings). A second run
warns you first.

If you do force a second run, it is safe: every worker checks what is already
imported and skips duplicates. Verified — running twice leaves all row counts
unchanged.

To deliberately start over:

1. Blank `migration_completed_at` in **Settings**.
2. Delete the data rows from `Batches`, `Bazar`, `POS_Snapshots`, `Invoices`,
   `DiscountDue`, `ClosedDays`, `OpeningStock` (keep the header row).
3. Run the import again.

---

## If something goes wrong

**"Could not find a Google Sheets file named Current Blueprint."**
You have the `.xlsx` in Drive but no Sheet copy. Right-click → Open with →
Google Sheets, then keep that copy's name.

**"Found Current Blueprint but it is not a Google Sheet."**
The name matched the `.xlsx`. Rename the Excel file, or set
`migration_source_id` to the Sheet copy's ID.

**"The source workbook has no tab named Batches."**
The message lists the tabs it did find. You may have opened the wrong file.

**A `CHECK` row in the report.**
Read the `Detail` column — it names the exact source row and values. Do not
delete the row; tell me and I will decide whether it is a new defect to correct
or a legitimate historical difference.
