# Summary views

Read-only analysis over the same records the forms write. Nothing here stores a
figure — every number is recomputed each time, so a summary can never drift from
the sheet.

**Awwffle → Summary → Batches / Bazar / Stock…**

---

## Three tabs, two kinds of question

| Tab | Question it answers | Control |
|---|---|---|
| Batches | "How much did I make between two dates?" | From / To |
| Bazar | "How much did I spend between two dates?" | From / To |
| Stock | "What do I have, and what is it worth **on a date**?" | As of |

**Stock is a snapshot, not a range.** "Stock between 1 and 15 Nov" is not a
meaningful question — stock is a position at a moment. So the Stock tab takes one
date. Batches and Bazar genuinely accumulate, so they take a range.

### Date shortcuts

Every range tab has **All time · This month · Last month · Last 7 days · Last 30 days**.
Ranges are inclusive at both ends: 1–30 Nov includes the 30th. The shortcut you
chose stays highlighted; typing a date by hand clears the highlight because no
shortcut describes that range any more.

---

## Batches tab

- **Preparation** — dropdown to narrow the whole tab to one recipe
- **Total Avg Cost / Total Cost / Open Days** — two green tiles side by side:
  the one-batch cost of every recipe made in the range, and the same recipes'
  total cost spread over the range's open days. With a preparation selected they
  become **Avg `recipe` Cost** and **`recipe` Cost / Open Day**.
- **Calendar days / Open days / Closed days / Days Record**
- **By preparation** — Batter, Nutella Mix, Cream, White Mix, Cheese, each with
  its batch count, **average cost per batch** and **total cost** for the range
- **Average per open day** — batches per open day and cost per open day, per recipe
- **Per day** — every batch record, newest first, with only the columns in view
- **Cost comparison** — average batch cost for each preset range, with an arrow
  against All time, and a **C/OD** switch for cost per open day

There is deliberately **no grand total of batches and no single blended average**.
Batches are not alike — one Batter batch and one Cream batch are different things
— so a combined figure answers no real question. Each recipe carries its own
total, its own average per open day and its own cost. **Total Avg Cost** is not
the range's total spend; it is one batch of each recipe that was made, added
together.

### How a batch cost is worked out

A batch costs the ingredients it consumes, multiplied by each ingredient's
**weighted-average cost per base unit** — the same figure the Stock tab shows.
Nothing is stored or hand-typed, so a purchase price change reaches the next
summary automatically.

- Recipe quantities come from the live **Measurements** sheet (grams / ml / pieces).
- Prices come from opening stock plus every purchase up to the **end of the range**.
  An old range is therefore costed at the prices in force then, not restated at
  today's prices — which is what makes the comparison table meaningful.
- An ingredient with no purchase history yet is called out under the tables rather
  than silently counted at zero.

This is **ingredient cost only** — what the recipe consumes. Packaging, labour and
utilities are not part of a batch cost; packaging is its own cost line (§13.D).

### Cost comparison

| Row | What it covers |
|---|---|
| Date range | the From / To currently entered |
| Last 7 days | today − 6 days → today |
| Last 30 days | today − 29 days → today |
| This month | the 1st of this month → today |
| Last month | the full previous calendar month |
| All time | first batch → last batch; the baseline row |

Columns are **Batches**, **Avg cost** (total ingredient cost ÷ batches made in
that range) and **vs All time**. The All time row has no arrow — it is the
baseline. ▲ red means the range cost more per batch than All time; ▼ green means
it cost less. When a preparation is selected, both the tables and the comparison
follow that one recipe, so "is Batter getting dearer?" has a direct answer.

The **C/OD** checkbox at the right of the heading swaps the value column for
**cost per open day** (that range's batch cost ÷ its open days), judged against
the all-time cost per open day. Untick it to return to average cost per batch.
Batches, date ranges and arrows stay the same either way.

**A recipe that was not made in the range is left out** of By preparation,
Average per open day and Total Avg Cost. White Mix and Cheese therefore appear
only in ranges where they were actually used; a range with no Cream shows no
Cream row. The same recipe set drives the per-day columns.

When a preparation is chosen, the tab narrows to the days that produced it: the
record count, the totals, the average and the per-day columns all follow that one
recipe. Records with none of it are left out rather than shown as zeros.

**The per-day table appears only for a narrower range.** Under All time it would
just repeat the Batches sheet, so it is hidden; choosing a preset or typing a
range brings it back as the maintenance tool. Totals alone would hide a mistyped
entry; a per-day list makes "12 Batter on the 3rd" obvious.

---

## Bazar tab

- **Total spent**, line count, invoice count
- **Avg per open day**
- **Expense type / Item / Invoice** filters
- **By expense type** — Inventory purchase / Salary / Courier / Maintenance / Other
- **By item** — amount, plus quantity in its own unit
- **By invoice** — lines per `Ref` and invoice total

### Filters

| Filter | Effect |
|---|---|
| Expense type | only that expense type |
| Item | only that item or expense name; the list follows the chosen type |
| Invoice | only lines sharing that `Ref` |

All three combine (AND) and re-run immediately — no Apply button. Each figure on
the tab follows the filtered set: total, line count, per-open-day average,
invoice count and all three tables. The active filters are shown above the
tables, and clearing a dropdown back to "(all …)" removes that filter.

This is where the two-field split pays off: "how much was inventory vs operating
cost" is now a single figure rather than something to work out by hand.

> **Quantity is never summed across items.** 500 gm and 3 pieces cannot be added.
> Money is the only column that totals meaningfully, so quantity is shown per item
> in its own unit.

---

## Stock tab

- **Total cost** — used cost + remaining value, across the filtered set
- **Used cost / Remaining value**
- **Items shown** — "17 of 43"
- **Low stock / Negative counts**
- **Remaining quantity**, grouped by unit (gm / ml / p) so units are never mixed

### Filters

| Filter | Effect |
|---|---|
| Group | Recipes / Toppings / Equipments |
| Kind | Recipe-driven / Manual / Resale |
| Item | one item only |
| Low stock only | items at or below their threshold |
| Negative only | items with negative stock |

Changing a filter re-runs immediately — no separate Apply button.

---

## Closed days

**Awwffle → Closed days…**

A dated list of closures. Add a date with an optional reason; remove one to
reopen it. Nothing about it is inferred from a weekday.

### Why a weekday rule is not used

Your own history shows the day off moving within three weeks:

| Date | Day | What happened |
|---|---|---|
| 21 Oct | Wed | **open** — traded though normally shut |
| 22 Oct | Thu | **closed** — the day off moved |
| 28 Oct | Wed | **open** |
| 4 Nov | Wed | closed |
| 11 Nov | Wed | closed |

Any weekday rule would be wrong for at least one of those weeks. So closures are
always explicit dated records, and you can change them at any time (two days off,
a different day, or none).

### What the panel shows

- **Calendar / Closed / Open days** for the sales span — updates live as you add
  or remove a closure
- **Closed days** list, newest first, with reasons
- **Missed entries** — open days with no sales snapshot

That last one is the important distinction your requirements call out:

- **Closed** — deliberate, correct behaviour
- **Missed** — you were open, nobody entered the snapshot, and every per-day
  average after it is wrong

A day can only be one or the other. The panel tells you which ones need a decision.

---

## Discounts and dues

**Awwffle → Daily entry → Record a discount**
**Awwffle → Daily entry → Record a due**

These are the two figures the cash calculation needs, entered as **dated daily
records** rather than per-invoice entries (README §8.1, §13.B14, §13.B16, §13.G3).
Both forms take a date range with the same shortcuts as the other summaries
(All time · This month · Last month · Last 7 days · Last 30 days) and list the
records in that range so any day can be edited or deleted.

### Discount

- **One per day.** Saving the same date corrects that day instead of adding a
  second row, so a day can never be discounted twice.
- Date, amount and an optional note.
- Editing or deleting recalculates cash in hand immediately.

### Due

- **One row per customer amount owed**, so several dues on the same day are fine.
- Date, customer, amount and an optional note.
- **Customer** is a dropdown seeded with the usual names (Riyad, Rasha, Farsim,
  Raza, Aman, Shohag, Sagor, Raihan, Delivery). Type a new name and it is saved, so
  it appears in the dropdown next time.
- Each due is **Outstanding** or **Paid**:
  - **Outstanding** money reduces cash in hand.
  - **Mark paid** brings the money back into cash; the row becomes inert history
    and can be deleted with no effect.
  - **Deleting an outstanding due** removes the deduction, so cash rises by that
    amount — no money drop.
- The panel shows **outstanding by customer**, so "how many dues and from whom" is
  answered directly.

### Cash in hand

The POS / Daily waffles summary now shows, for the selected range:

```
Total POS Sale
− Total Discount
= Sale after Discount
− Total Due (Outstanding only)
− Bazar in range
= Cash in Hand
```

Discount is applied **once** and only outstanding dues are subtracted. Cash
recomputes live from the records whenever the sidebar loads — there is no separate
refresh step. A due dated in an earlier period that is paid later moves that
earlier range's figure, which is the intended live behaviour.

> **The old `DiscountDue` sheet is not read.** Migration left two monthly lumps
> (Oct 6,032 / Nov 2,826) there. Enter the daily figures for that period in the
> new **Discounts** and **Dues** forms; leaving the old sheet alone is safe because
> it is no longer part of the calculation.

---

## What every average divides by

Per-day figures use **open days** from the closed-day list:

- **POS sink** runs 17 Oct → 16 Nov: 31 calendar days − 3 closed = **28 open days**
- **Batches** start 14 Oct: 34 calendar days − 3 closed = **31 open days**

Two different denominators, both correct, because they measure different windows.
The tabs show calendar and open days side by side so this is never a mystery.

---

## What is not here

- **No charts.** A table answers the question; charts on dynamic data are brittle.
- **No saved reports.** Nothing to store, nothing to go stale.
- **No export.** The Stock tab already exists as a sheet.
- **No forecasts.** That needs more history than exists.
