Here's my evaluation — no code changed. Short version: yes, this is safe and doable without touching a single historical row or changing any calculation. Group is a label in this
  system; the maths key off Population, not Group. The only real work is a one-column Group update plus teaching two lists about the new groups.

  1. How the categorization actually works today

  From 02_ItemMaster.gs, each item has group and population. They are different things:

  - group (Recipes / Toppings / Equipments) is used only for display and filtering:

  - Stock summary group dropdown (getSummaryOptions_ builds groups from the ItemMaster Group column).
  - Bazar item dropdown grouping.
  - Manual Stock count form grouping.
  - population (Recipe-driven / Manual / Resale) is what drives every calculation:
    - Recipe-driven → usage from Measurements × Batches.
    - Manual → usage from counts/adjustments.
    - Resale → POS link removes stock.

  So re-labelling Equipments into Packaging/Equipments, and Water to Resale, cannot change recipe cost, stock valuation, cash, or any history. The batch cost model
  (batchCostPerPreparationFrom_) only loops the 17 recipe ingredients from Measurements — it never reads group at all.

  One functional dependency to know: 13_Adjustments.gs has
  MANUAL_STOCK_GROUPS = ['Toppings', 'Equipments'], and isCountableItem_ requires the item's group to be in that list. If we split groups and forget this, packaging items silently
  disappear from the Manual Stock form. That list must become ['Toppings', 'Packaging', 'Equipments', 'Resale'].

  Also 99_Tests.gs hard-asserts Recipes 17 / Toppings 16 / Equipments 10 — that has to be updated with the split.

  2. Proposed regrouping (still 43 items, nothing renamed)

  ┌────────────┬───────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │ Group      │ Count │ Items                                                                                     │
  ├────────────┼───────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Recipes    │ 17    │ unchanged                                                                                 │
  ├────────────┼───────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Toppings   │ 15    │ all current toppings except Water                                                         │
  ├────────────┼───────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Resale     │ 1     │ Water (already population: Resale + POS link Water 500ml)                                 │
  ├────────────┼───────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Packaging  │ 6–7   │ Waffle Sticks Large, Waffle Box, Waffle Tray, Bento Box, Poly bag, Tissue + One Time box? │
  ├────────────┼───────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ Equipments │ 3–4   │ Room Freshner, Arosole Spray, POS Roll (+ One Time box?)                                  │
  └────────────┴───────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  Water needs no data change at all — it is already Resale; only its group string says Toppings. Moving it is cosmetic.

  Decision needed: is One Time box given away per waffle (→ Packaging), or general equipment? I'd put it in Packaging unless you say otherwise.

  3. Applying it to the live workbook (no data loss)

  ensureItemMasterSheet_ seeds rows only when missing and never updates an existing row, so editing ITEMS in code will not change the live sheet. To apply it we need a small
  idempotent updater that rewrites only the Group column, matched by item name, e.g. applyItemGroups_() run once from Setup/menu. It would:

  - set the new Group for the 11 affected items,
  - leave every other column (rates, units, populations, low-stock) untouched,
  - never delete or add a row,
  - be safe to run twice.

  Then update GROUPS, MANUAL_STOCK_GROUPS, and the group-count tests. Bazar/Batches/POS/Adjustments all reference item names, not groups, so no historical row is affected and every
  existing filter keeps working. The Stock summary simply gains Packaging and Resale options in its group dropdown.

  4. Can we compute the costs? Yes — with different confidence per category

  Recipe cost — exact, already done. Total Recipe Cost = Σ (costByPreparation) from Measurements × Batches. This is real, not estimated.

  Waffles sold in range — available. POS_PRODUCTS marks each product kind: 'waffle' vs 'extra', and POS_Snapshots.Units Sold is per day. So "waffles sold in [range]" is just the sum
   over the 12 waffle products. (Today's totalUnits mixes waffles and extras, so we must filter by kind.)

  Topping cost — feasible from existing data, but it is an estimate.
  Toppings are Manual, and computeStock_(asOf) already derives, per item:

  - remainingQty from the latest physical count + movements after it,
  - totalUsed = available − remaining,
  - usedCost = used × weighted-average cost.

  So two usable measures already exist:

  - Topping stock value = Σ remainingValue over Toppings (real, from your "what's left on the shelf" counts).
  - Topping used cost in a range = difference of usedCost/remaining between range start and end, or purchases − Δstock. Per waffle = that ÷ waffles sold.

  Caveat: this is only accurate where you have counts bracketing the range. With no counts, usage falls back to explicit adjustment rows and reads low. So it should be labelled
  estimated, and ideally shown "since last count" or for ranges that contain counts. Recipe cost stays the exact figure.

  Packaging cost — two options; recommend showing both.

  1. Standard per-waffle = Σ (qty given per waffle × item avg cost). You told me a stick is 1 per waffle; boxes/trays/bento/maybe poly bag/tissue vary by product. This needs a small
   mapping of packaging per waffle (ideally per POS product, because a box vs tray vs bento differ). Deterministic and stable, but rule-driven.
  2. Actual = Packaging group usedCost over the range ÷ waffles sold (same count/purchase caveat as toppings).

  Total packaging cost for a range = waffles sold × per-waffle packaging cost (standard) or the actual group usage.

  Equipments cost (Room Freshner, Arosole, POS Roll) is not per-waffle by nature. Best shown as a period expense (used cost over a range). Allocating it per waffle is optional and
  arbitrary; I'd keep it separate.

  5. What the finished picture would look like

  A cost breakdown per waffle and per range (all derived, nothing typed):

  ┌────────────────┬───────────────────────────────────────────────────────────────────────┬───────────────────────┐
  │ Cost line      │ Source                                                                │ Nature                │
  ├────────────────┼───────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Recipe cost    │ Measurements × Batches × avg ingredient cost                          │ exact                 │
  ├────────────────┼───────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Topping cost   │ Toppings group usage ÷ waffles sold                                   │ estimate              │
  ├────────────────┼───────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Packaging cost │ Packaging group usage ÷ waffles sold (and/or standard per-waffle map) │ estimate / rule       │
  ├────────────────┼───────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Equipment cost │ Equipments group usage over range                                     │ actual period expense │
  ├────────────────┼───────────────────────────────────────────────────────────────────────┼───────────────────────┤
  │ Waffles sold   │ POS snapshots, kind = waffle                                          │ exact                 │
  └────────────────┴───────────────────────────────────────────────────────────────────────┴───────────────────────┘

  Existing Real used cost in the Stock summary already sums all item usage; the new work is splitting it by these groups and dividing by waffles sold.

  6. Risks / decisions to settle

  1. One Time box → Packaging or Equipments?
  2. Packaging mapping: one global "per waffle" quantity, or per POS product (box vs tray vs bento)? The latter is accurate but needs your rules.
  3. Waffle denominator: waffles sold (POS) or waffles produced (batches × waffles-per-batch)? Packaging/toppings follow sales; recipe cost follows production. Mixing them shifts
  per-waffle numbers.
  4. Topping estimate basis: "since last count" vs arbitrary date ranges. Counts exist only at certain dates, so ranges without counts will look understated.
  5. Any toppings that are actually packaging (e.g. is Nutella drizzle per waffle)? Only if you say so.

  7. Recommendation

  This is low-risk and worth doing in three small steps (separately reviewable):

  1. Regroup only (Packaging/Equipments/Resale) + Group updater + MANUAL_STOCK_GROUPS + tests. No maths change; filters gain the new groups.
  2. Per-waffle packaging using a small per-waffle mapping (or per-product) × avg costs, plus waffles-sold from POS.
  3. Topping cost as an estimated group cost from stock usage, shown with its caveat, and a group-level breakdown in the Stock/Batches summary.

  Tell me your calls on the 4 decisions above (especially One Time box and whether packaging is per-product) and I'll build step 1 first.