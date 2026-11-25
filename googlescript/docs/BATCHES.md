# Recording daily batches

Tells the system what you produced each day. From this, ingredient usage is
calculated automatically — you never type usage yourself.

Open from **Awwffle → Daily entry → Record daily batches**.

---

## How to use it

The form is deliberately plain: one date, five number boxes, one save button.

1. **Production date** — defaults to today.
2. Fill in the five boxes:

   | Field | Example |
   |---|---|
   | Batter | `1` |
   | Nutella Mix | `2` |
   | Cream | `1` |
   | White Mix | `0` |
   | Cheese | `0` |

3. **Save batch**.

That is the whole workflow. Fractions are fine — `0.5` is a real half batch. The
running **Total** under the boxes just adds them up so you can sanity-check before
saving.

**Nothing is ever left blank in the Batches sheet.** A blank box and a typed `0`
both save as `0`, so every saved day shows all five numbers. That is deliberate:
"we made no Cheese today" is a real fact worth recording, and it matches your
source workbook, which stored `0.0` in those cells.

> This differs from **Measurements**, where a blank genuinely means "this
> ingredient is not used in that preparation" and stays blank. A batch of `0` and
> a recipe blank are different things.

**A day with no production is recorded, not refused.** Enter `0` in each box —
or in just one — and save. The row is written with all five numbers as `0`, so
the date exists in the history and it is visible that no batch came that day. It
adds `0` to every total, so it changes no usage, cost, or estimate.

The one thing still refused is a **completely empty form**: nothing typed at all.
That is what a stray click on **Save** looks like, and it would quietly claim a
no-production day you never considered. Typing `0` is how you say it on purpose.

---

## Editing a saved day

Pick the same date again — or click it in **Recent batches** at the bottom.

A yellow banner appears:

> **Editing the saved batch for 2026-11-18. Saving updates it.**   **[Delete]**

The five boxes fill with what is already saved, so you can correct a number and
save. **Saving updates the existing record — it never creates a second one for the
same day.**

## Deleting

The **Delete** button only appears when you are viewing a saved batch. It asks for
confirmation, then removes that day's record and its ingredient usage.

If you only want to fix a number, **edit and save** instead — that keeps the day
and just changes the quantities.

---

## Why one row per day matters

This was the core defect in the old workbook: the same fact recorded twice, then
drifting apart (§11).

- A batch is keyed by **date**, so one day has one batch record.
- Correcting it is an **update**. Ingredient usage recalculates automatically
  because it is derived, never stored.
- Deleting a batch removes that day's usage — but only that day's.

---

## What happens when you save

Usage is `Measurements × Batches`. With your migrated history:

| Preparation | Total batches | Flour used |
|---|---|---|
| Batter | 33.5 | 16,750 gm |
| Nutella Mix | 25 | — |
| Cream | 13 | — |
| White Mix | 1 | — |
| Cheese | 1 | — |

All 17 ingredients reproduce the old workbook's `Total Used` exactly. That is the
test that proves the recipe and the batch data are both correct.

The **Stock** tab will show this from Phase 6. Until then the numbers are
computed but not displayed.

---

## The recipe (Measurements)

The `Measurements` tab is the fixed recipe: 17 ingredients × 5 preparations, in
grams per batch.

- **Blanks mean "not used in this preparation."** They are not zeros and are never
  summed.
- The sheet is **protected** as a guard against accidental edits during daily
  entry. You retain edit access, because recipe maintenance is your call (§13.E35).
- Any change you make there is picked up immediately — calculations read the live
  sheet, not a copy in the code.

### What the batch form will tell you

If the recipe has a problem, the form says so **before** you enter data that
depends on it:

| Problem | Why it matters |
|---|---|
| An ingredient not in ItemMaster | Its usage cannot be valued or subtracted |
| A non-numeric or negative quantity | The recipe would compute nonsense |
| `Empty Container` present | It has no stock row and orphans every total (§3.1) |
| `Waste` present | Not a preparation or an ingredient (§13.D28) |
| An ingredient used in no preparation | Never consumed — probably a mistake |

---

## Closed days

If you enter a batch on a date recorded as closed (currently Wednesdays), it
**saves normally but warns**.

That is deliberate: your own history contains Wednesday batches, so a batch on a
closed day is a real possibility, not an error. The warning simply asks you to
check a mis-keyed date.

---

## Recent batches

The bottom of the form lists the last 30 batches. **Click one** to load it for
editing — much faster than picking the date.

---

## Deleting

**Delete** removes the batch for the date currently shown, after a confirmation.
That day's ingredient usage disappears with it.

If you only want to correct a number, **edit and save** instead — that keeps the
date's record and just changes the quantities.

---

## What is not built yet

- The **Stock** view that turns usage into remaining quantities — Phase 6.
- POS sales entry — Phase 7.
- Reports and cost-per-batch — Phases 8 and 9.

Batches recorded now will flow into all of those automatically.
