# Discounts, dues and cash in hand

Two small ledgers feed the one figure the owner asked for: **cash in hand**.

- **Discounts** — one dated daily amount.
- **Dues** — one row per customer amount still owed, with a Paid state.
- **Cash in hand** — derived from POS sales, discounts, outstanding dues and Bazar.

Enter them from **Awwffle → Daily entry → Record a discount / Record a due**.
Everything is editable and filterable by date range (All time and the usual
shortcuts). Nothing is stored twice.

**All time** starts at the same opening date the Batches / Bazar tabs use and runs
to today, so every summary reports the same starting day. Date presets are
resolved on the server with the same rules the Summary tabs use: clicking one
("Today", "Last 7 days", …) fills From / To **and** runs the query, showing the
shared spinner. **Show Discounts** / **Show Dues** run a query for hand-picked
dates.

The due form's **Customer** box is a dropdown of the `Customers` tab (plus any
name already used on a due). Pick a name, or choose **+ Add new customer…** and
type one — it is saved to `Customers` and appears in the list next time.

Rows typed directly into the `Discounts` / `Dues` tabs are read as well. The
generated ID column may be left blank — a stable ID is filled in on first read so
Edit / Delete / Mark paid keep working.

---

## Sheets

| Sheet | Grain | Columns |
|---|---|---|
| `Discounts` | one row per day | Discount ID, Date, Amount, Notes, Entered At |
| `Dues` | one row per customer amount | Due ID, Date, Customer, Amount, Status, Paid Date, Notes, Entered At |
| `Customers` | dropdown list | Customer, Active, Note |
| `DiscountDue` | **legacy only** | the old monthly migration aggregates |

`DiscountDue` is not read by the finance calculation. Migration put two monthly
lumps there (Oct 6,032 / Nov 2,826); the owner now enters daily figures, so reading
both would double-count. Leave the old sheet as an audit artifact.

### Customers

Seeded once with Riyad, Rasha, Farsim, Raza, Aman, Shohag, Sagor, Raihan and
Delivery. Typing a name that is not in the list appends it to `Customers`, so it
appears in the dropdown next time. Names are compared case- and space-insensitively.

---

## Rules

### Discount

- **One per day.** Saving the same date updates that day's row instead of adding a
  second one. Two discounts can never stack on one day.
- Must be greater than zero and not in the future.

### Due

- A due has a **Status**: `Outstanding` or `Paid`.
- **Only Outstanding dues reduce cash in hand.**
- **Mark paid** records the money coming back: the due stops reducing cash and its
  row becomes inert history. Deleting a paid row changes nothing.
- **Deleting an outstanding row** removes a deduction, so cash rises by that
  amount — the owner's "no money drop" rule.
- Editing a due keeps its paid/outstanding state; only date, customer, amount and
  note change.

### Cash in hand

```
Sale after Discount = gross POS sale − Discount in range
Cash in Hand        = Sale after Discount − Outstanding Due − Bazar in range
```

- Discount is applied **exactly once** (README §8.1).
- **Bazar** means every expense row in the range — inventory and operating
  (§13.B15). A purchase reduces cash when recorded, not when marked paid.
- Gross sale is the whole-period POS sale, so the figure is not narrowed by the
  product/kind filters used for the item table.
- Cash recomputes live on every sidebar load. There is no separate refresh step.
- A due accrued in one period and paid later moves that earlier range's figure —
  the intended live behaviour.

The POS / Daily waffles summary shows the tiles in this order:

**Total POS Sale → Total Discount / Total Due → Sale after Discount → Bazar in
range → Cash in Hand → total open days / Showing Items / Units Sold → table →
POS Revenue / POS Cost**

Black for the gross sale, red for deductions and cost, green for what remains.

---

## Code map

| File | Role |
|---|---|
| `12_Finance.gs` | read/write discounts and dues, customer list, `financeTotals_`, `cashInHand_` |
| `ui/Sidebar_Discount.html` | discount entry, range filter, edit/delete |
| `ui/Sidebar_Due.html` | due entry, customer dropdown, paid/reopen, per-customer outstanding |
| `10_POS.gs` | `getDailyWaffles_` adds discount, due, Bazar and cash to the summary |
| `14_Menu.gs` | Daily entry menu items |
| `03_Schema.gs` / `04_Setup.gs` | sheet definitions and customer seed |
| `99_Tests.gs` | `testFinance` covers the arithmetic and the public boundary |
