# Stock

The `Stock` tab shows what you have, what it is worth, and what is about to run out.

**It is a calculated view, not a data-entry sheet.** Everything on it is derived
from purchases, batches, adjustments and opening stock. Refreshing rebuilds it;
nothing you type there is kept.

---

## How to use it

**Awwffle → Refresh stock view**

There is also **Awwffle → Check stock valuation**, which proves the numbers are
internally consistent (see below).

---

## How each column is built

```
Opening Qty  = purchases on or before 10 Oct 2026
             + stock that has no purchase at all (Waffle Box, Waffle Tray)
Purchased Qty = purchases AFTER 10 Oct 2026
Total Qty    = Opening Qty + Purchased Qty
Remaining Qty = Total Qty − Total Used
```

**Opening stock is the 10 October setup purchase.** That date is the first Bazar
entry, so everything bought on it is what you started with. Purchases from
November onward are `Purchased Qty`. The two sets never overlap — that is what
keeps `Opening + Purchased = Total Qty` true.

The only genuinely pre-existing stock is **Waffle Box** and **Waffle Tray**: 1,200
each that were on the shelf before the ledger began.

### Changing the cut-off date

It lives in **Settings → `opening_cutoff_date`** (currently `2026-10-10`). After
changing it, run **Awwffle → Rebuild opening stock**, then **Refresh stock view**.

### If you correct a Bazar row

Opening stock is derived from Bazar, so correcting a purchase can leave it stale.
For example, if you change Milk's 10 October purchase from 23 L to 25 L:

1. Correct the row **through the Bazar form** (click it → Update), so `Amount` and
   `Base Quantity` are recalculated for you.
2. **Awwffle → Rebuild opening stock**
3. **Awwffle → Refresh stock view**

Re-running the whole migration will *not* fix it — migration deliberately skips
rows it has already imported.

---

## What each column means

| Column | Meaning |
|---|---|
| Opening Qty | Pre-Bazar stock, from the migration cut-off (10 Oct 2026) |
| Purchased Qty | Total bought after the cut-off, in the base unit |
| Total Qty | Opening + purchased |
| **Avg. Rate** | Weighted average cost **per kg / per litre / per piece** |
| Batter…Cheese Used | Consumption per preparation, from Measurements × Batches |
| Manual Used | Toppings/packaging usage entered by hand |
| Total Used | Everything above combined |
| Used Cost | What the consumed stock was worth |
| Remaining Qty | Total Qty − Total Used |
| Remaining Value | What is left on the shelf, in money |
| **Total Cost** | Used Cost + Remaining Value — what the stock actually cost |
| Est. Open Days | Days of stock left, counted in **trading days** |
| Est. Batches | Batches still possible, limited by the scarcest preparation |
| Low Stock | Flags: `NEGATIVE`, `LOW DAYS`, `LOW BATCHES` |

### Avg. Rate — what it is and why it matters

`Avg. Rate` is the **weighted average cost of everything bought** for that item,
shown in the unit you buy it in.

It is not the latest price and not the first price. Example, Flour:

| Purchase | Qty | Rate |
|---|---|---|
| 10 Oct (opening) | 10.5 kg | 80 |
| 10 Nov | 25 kg | 67 |
| 12 Nov | 1 kg | 85 |
| 13 Nov | 1 kg | 80 |

That is 37.5 kg for 2,680 Tk, so **Avg. Rate = 71.47 per kg**.

Every valuation uses that one number: used cost and remaining value are both
`quantity × 71.47`, which is why they add up to exactly 2,680.

Piece items show their piece rate (Nutella ≈ 830 per jar); gram-entered items show
their per-kg rate (B. Powder 450/kg), so the figure always reads the way you buy.

### Total Cost

`Used Cost + Remaining Value`. It equals the opening value plus everything spent on
that item, so it answers "what did this stock cost me in total".

---

## The three kinds of item

Each behaves differently, on purpose (§17.3, §13.G1):

| Kind | Examples | How usage is calculated |
|---|---|---|
| **Recipe-driven** | Flour, Milk, Nutella, Butter | Automatic: Measurements × Batches |
| **Manual** | Oreo, Kitkat, boxes, tissue | You enter usage by hand |
| **Resale** | Water | Automatic: one POS sale = one piece |

Ice cream is **manual**, not resale. It sells on the POS, but that sale only
records revenue — you enter the usage when a can finishes.

---

## Recording a manual stock count

For Toppings and Equipments the honest figure is the one you can see on the shelf.
**Awwffle → Daily entry → Record manual stock count** records it.

1. Pick the group (Toppings or Equipments) and the item.
2. Enter what is actually left, in the item's own unit.
3. Save. The count is written to `Adjustments` as a `Count` row and the Stock view
   is rebuilt.

A count is a **set-to** statement, not a usage figure: "on this date, this much was
left". Usage is derived from it:

```
remaining = counted + purchases after the count − movement after the count
used      = total available − remaining
```

So a purchase the next day raises the balance and a later sale lowers it, without
touching the count itself.

- **Re-counting the same item on the same date** replaces that day's row instead of
  adding a second one.
- **Deleting a count** falls back to the previous count, or to recorded usage when
  there is none.
- **Water is resale**: POS sales after the count keep reducing it, so a count
  reconciles POS drift rather than replacing it.
- Recipe-driven items are not offered. Their usage comes from Measurements ×
  Batches, and a count would contradict that model.

**Never type into the Stock tab.** It is rebuilt from these records, so a typed
number is silently lost on the next refresh.

---

## How stock is valued

**Weighted average cost** (§6.2.1). Not the latest price, not a typed rate.

Every purchase adds quantity and money. The average is total money ÷ total
quantity. Opening stock counts as a purchase at its snapshot rate.

### Why this matters

Your old workbook valued everything at one hand-typed rate per item. That made the
stock value 98,956.50 while actual spend was 92,940.00 — a **6,016.50 gap with no
business meaning**, because the rate was edited rather than derived.

Weighted average removes the gap by construction. The identity below is always
true:

```
used cost + remaining value = opening value + purchase spend
```

If that ever fails, the valuation is broken. That is what **Check stock
valuation** tests.

### The number that changed, on purpose

Your source workbook reports **48,752.85** of used cost. This system reports
**49,005.36** — about 253 higher.

That is not a regression. It is the fix:

- The old figure used one typed rate per item, which drifted from real prices.
- Weighted average reflects what you actually paid.
- The old stock value did not reconcile to spend; this one does, exactly.

The **identity** is the correctness test, not agreement with the old figure.

---

## Estimated days and batches

**Est. Open Days** = remaining quantity ÷ daily usage, where daily usage is
measured over **open days only** (closed days excluded, §8.4).

So "40" means 40 *trading* days, not 40 calendar days.

**Est. Batches** = the smallest number of batches any single preparation could
still support. It reports the **bottleneck**, not an average — averaging across
preparations would hide the one that actually stops you.

Both show blank rather than a wrong number when there is not enough data.

---

## Negative stock

Stock can go negative if purchases are missing. Rather than silently allowing it,
the row is flagged **NEGATIVE**.

The cause is almost always an unrecorded purchase rather than a calculation error.
Add the missing Bazar purchase and refresh.

---

## Stock as of a past date

`computeStock_("2026-11-01")` calculates the position at the end of that day:
purchases, batches, adjustments and POS sales are all limited to that date or
earlier. Opening stock is always included, since it pre-dates the ledger.

This is what makes historical stock auditable instead of guessed.

---

## What is not built yet

- Summary and date-range views (Phase 6.5).
- Wastage adjustment entry UI (Phase 9).
- Cost per batch and benchmarks (Phase 9).
- Sales and profit reports (Phase 8).
