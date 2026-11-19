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
Ranges are inclusive at both ends: 1–30 Nov includes the 30th.

---

## Batches tab

- **Preparation** — dropdown to narrow the whole tab to one recipe
- **Records / Open days / Calendar days / Closed days**
- **By preparation** — Batter, Nutella Mix, Cream, White Mix, Cheese
- **Average per open day** — one figure per recipe, below the totals
- **Per day** — every batch record, newest first, with only the columns in view

There is deliberately **no grand total and no single average**. Batches are not
alike — one Batter batch and one Cream batch are different things — so a combined
figure answers no real question. Each recipe carries its own total and its own
average per open day.

When a preparation is chosen, the tab narrows to the days that produced it: the
record count, the totals, the average and the per-day columns all follow that one
recipe. Records with none of it are left out rather than shown as zeros.

The per-day table is the maintenance tool. Totals alone would hide a mistyped
entry; a per-day list makes "12 Batter on the 3rd" obvious.

---

## Bazar tab

- **Total spent**, line count, invoice count
- **Avg per open day**
- **By expense type** — Inventory purchase / Salary / Courier / Maintenance / Other
- **By item** — amount, plus quantity in its own unit
- **By invoice** — lines per `Ref` and invoice total

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
