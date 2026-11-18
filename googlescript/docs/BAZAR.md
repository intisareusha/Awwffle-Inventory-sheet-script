# Recording a purchase (Bazar)

One form for every expense. It replaces typing rows directly into the Bazar
sheet, and it is the **only** place expenses are recorded (§8.6).

Open it from **Awwffle → Daily entry → Record a purchase (Bazar)**.

---

## How to use it

1. **Date** — defaults to today.
2. **Expense type** — the first choice decides everything else:
   - `Inventory purchase` → the form asks for an **item**, quantity, unit, rate.
     Stock increases.
   - `Salary`, `Courier`, `Maintenance`, `Other` → the form asks for a **name**
     and an **amount**. Stock never changes.
3. **Invoice ref** — type once; use the same ref for every line of one shop bill.
   Recent refs appear as suggestions.
4. **Add another item** — one line per item, all saved under the same ref.
5. **Save invoice** — all lines are written together, or none are.

---

## Editing and deleting a saved line

Below the form is **Saved lines**, showing your most recent purchases across
**all dates** — the date field only affects saving, not browsing.

- **Click any line** to load it into the form. A yellow banner appears:
  > **Editing a saved line from 2026-11-12. Saving updates it.**  **[Delete] [Cancel]**

- The date field moves to that line's date, and the button changes to
  **Update line**. Correct anything and save. The row is **updated in place** — it
  keeps its Record ID, so nothing is duplicated and history is not rewritten (§11).
- **Delete** removes that one line, after a confirmation naming what will go.
- **Cancel** leaves edit mode without changing anything.

Each line shows its own date, because the list spans many days. The footer gives
the line count and their combined total.

> **If the list looks empty** but you know you have purchases, it will now say why
> in red rather than showing nothing. The most likely cause is that
> `06_Bazar.gs` was not re-pasted, so the server is missing the new functions.

### What editing does and does not change

| Editing… | Effect |
|---|---|
| quantity or rate | `Amount` is recomputed; base quantity is recomputed for stock |
| item | base quantity converts using the new item's rules |
| expense type | inventory ↔ non-inventory changes whether stock is affected |
| date | the line moves to that day |
| ref | the line regroups under the new invoice |
| Record ID | **never changes** — that is the row's identity |

Editing obeys exactly the same validation as adding: no unknown items, no future
dates, no bad units, no accidental duplicates. A line is never treated as a
duplicate of *itself*, so re-saving without changes is safe.

---

## What is calculated for you

**Amount is never typed.** It is always `quantity ÷ rate divisor × rate`, matching
the unit rules:

| You type | Rate is per | Amount |
|---|---|---|
| `10 kg` @ 80 | kg | 800 |
| `800 gm` @ 450 | kg | **360** (divided by 1000) |
| `5 l` @ 80 | litre | 400 |
| `2 p` @ 830 (Nutella) | piece | 1,660 |

That gm/ml division is the same rule the old workbook used. Getting it wrong
would make every gram-based purchase 1000× too expensive.

**Base quantity is stored too**, so the Stock view never has to re-derive it:
`10 kg flour` stores `10,000 gm`. Nutella is special — `2 pieces` stores `700 gm`
because one jar is 350 gm.

---

## Why stock updates by itself

There is no second ledger to update. The `Stock` sheet is a **view**:

```
opening stock + purchased − used by batches − wastage = remaining
```

So saving one purchase line makes stock rise exactly once, automatically. This is
what removes the old double-entry where you had to type the purchase in Bazar
*and* again in Stock (§5.1).

The `Stock` view itself is filled in Phase 6. Until then the purchase is still
recorded correctly — the numbers just are not displayed yet.

---

## What it refuses to save

Each of these is a rule from the README, not a preference:

| Refused | Why |
|---|---|
| A date in the future | Almost always a typo |
| Quantity of 0 or less | Negative stock is meaningless |
| An unknown item name | Prevents the `Kitkat` / `Kitkat (4 fingers)` split (§5.3) |
| A unit other than `p, kg, gm, l, ml` | Pounds are explicitly excluded (§13.C23) |
| A non-inventory line with no name | An expense must say what it was for |
| A line identical to one already saved (same date, item, quantity, unit, rate, ref) | Duplicate submission (§11) |

**The last one is worth knowing.** If you genuinely buy the same thing twice in
one day at the same price, change the ref or the quantity. The check exists
because double-submitting a form is far more common than a true repeat.

---

## Adding a new item later

If the form rejects an item as "not in the item master", that is deliberate. To
add it:

1. Open the **ItemMaster** sheet.
2. Add a row with: item name, group, display unit, base unit, per-piece weight
   (blank or `1` for countable things), population, seed rate.
3. Run **Awwffle → Setup / Update structure** so the form picks it up.

The system will not invent an item silently, because a silently created item is
how one ingredient becomes two (§5.3).

---

## Checking your entries

Pick any date range and see totals by item and by expense type:

```
=bazarSummary_("2026-11-01", "2026-11-30")
```

Or list invoices with their line counts and totals:

```
=bazarInvoices_()
```

Both read only from the Bazar sheet, so they can never disagree with it.

---

## What is not built yet

- The **Stock** view that turns these purchases into remaining quantities — Phase 6.
- Batch entry (what you produced) — Phase 5.
- POS sales entry — Phase 7.
- Reports — Phase 8.

Purchases recorded now are correct and will appear in all of those automatically,
because they all read from this same table.
