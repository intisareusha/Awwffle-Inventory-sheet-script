/**
 * Awwffle Inventory System — 09_Stock.gs
 *
 * Phase 6 — stock calculation and valuation.
 *
 * README §3.3 (Measurements x Batches), §6.2 (filters), §6.2.1 (weighted average),
 * §6.2.2 (estimates), §17.3 (the three populations).
 *
 * THE ACCOUNTING IDENTITY
 * For every item:
 *
 *     used cost + remaining value = opening value + purchase spend
 *
 * That identity is the reason weighted-average cost is used at all (§6.2.1). If it
 * ever fails, the valuation method is broken — it is not a rounding difference.
 *
 * WHY THE ANSWER DIFFERS FROM THE OLD WORKBOOK
 * The source valued everything at ONE hand-typed rate per item, which produced
 * 98,956.50 of stock value against 92,940.00 of actual spend — a 6,016.50 gap with
 * no business meaning. Weighted average removes that gap by construction, so the
 * used cost here is NOT the source's 48,752.85. That difference is the fix, not a
 * regression. The identity is what must hold, not the old figure.
 *
 * THE THREE POPULATIONS (§3.3, §13.G1)
 *   Recipe-driven — consumption from Measurements x Batches, automatic.
 *   Manual        — consumption entered by hand (toppings, packaging).
 *   Resale        — Water only: POS sales consume one piece each.
 */

// ---------------------------------------------------------------------------
// Valuation primitives
// ---------------------------------------------------------------------------
//
// ratePerBaseUnit_ lives in 01_Utils.gs, next to the other unit conversions,
// because the migration needs it too and must not depend on a later phase.

/**
 * The opening cut-off date, from Settings. Defaults to the first Bazar purchase.
 *
 * This single date decides what counts as opening stock versus a purchase, so it
 * is read from one place. The default matters: if Settings has not been seeded,
 * falling back to nothing would silently double every October purchase.
 */
function openingCutOff_() {
  var settings = readSettings_();
  var raw = settings.opening_cutoff_date || '2026-10-10';
  return toDate_(raw) || toDate_('2026-10-10');
}

/**
 * Groups rows by their normalised item name, so a multi-item valuation can visit
 * only the rows that belong to the item instead of scanning the whole sheet per
 * item. Building this once turns the Stock and batch-cost paths from
 * `items x rows` into `rows`.
 */
function indexByItem_(rows, field) {
  var key = field || 'Item';
  var index = {};
  (rows || []).forEach(function (r) {
    var k = normaliseItemName_(r[key]);
    if (!k) return;
    (index[k] || (index[k] = [])).push(r);
  });
  return index;
}

/**
 * Weighted-average cost for one item (§6.2.1).
 *
 * Opening stock is the first "purchase" at its snapshot rate, so the average is
 * the total value divided by the total quantity. This is what makes
 * `used cost + remaining value = total available value` true for any split.
 *
 * Returns { openingQty, openingValue, purchaseQty, purchaseValue, avg, availableQty }
 *
 * `opts.openingIndex` / `opts.bazarIndex` are optional pre-built item indexes. A
 * caller valuing many items should build them once and pass them in — otherwise
 * every item scans every row, which is what made the batch cost model quadratic.
 * When they are absent this still works, just by filtering the rows it was given.
 */
function itemCosting_(itemName, opts) {
  opts = opts || {};
  var openingRows = opts.openingRows || readRecords_(SHEETS.OPENING_STOCK);
  var bazarRows = opts.bazarRows || readRecords_(SHEETS.BAZAR);

  var item = findItem_(itemName);
  var baseUnit = item ? item.baseUnit : '';
  var needle = normaliseItemName_(itemName);

  var openingForItem = opts.openingIndex
    ? (opts.openingIndex[needle] || [])
    : openingRows.filter(function (r) { return normaliseItemName_(r['Item']) === needle; });
  var bazarForItem = opts.bazarIndex
    ? (opts.bazarIndex[needle] || [])
    : bazarRows.filter(function (r) { return normaliseItemName_(r['Item']) === needle; });

  // --- Opening layer (pre-Bazar stock, §6.3) ---
  var openingQty = 0;
  var openingValue = 0;
  openingForItem.forEach(function (r) {
    var q = toNumber_(r['Quantity']);
    if (q === null) return;
    openingQty += q;

    // Recompute from quantity x rate rather than trusting the stored Value cell.
    // A stale or mis-converted value there would silently skew every valuation,
    // and a hand-edited sheet is exactly where that happens.
    var rt = toNumber_(r['Rate']);
    if (rt !== null && item) {
      openingValue += q * ratePerBaseUnit_(item, rt);
    } else {
      var stored = toNumber_(r['Value']);
      if (stored !== null) openingValue += stored;
    }
  });

  // --- Purchases ---
  // Only purchases AFTER the opening cut-off count as "Purchased Qty", because
  // purchases on or before it are already represented by the opening layer.
  // Counting them here as well would double the stock: a 25 L October Milk buy
  // would appear both as opening stock and as a purchase.
  //
  // `opts.cutOff` is an optimisation for callers that value many items at once
  // (the batch cost model). Passing it avoids one Settings sheet read per item.
  var cutOff = opts.cutOff || openingCutOff_();

  var purchaseQty = 0;
  var purchaseValue = 0;
  bazarForItem.forEach(function (r) {
    var affects = String(r['Affects Stock']);
    if (affects !== 'true' && affects !== 'TRUE') return;

    var d = toDate_(r['Date']);
    if (cutOff && d && d <= cutOff) return;   // already inside the opening layer

    var q = toNumber_(r['Base Quantity']);
    var a = toNumber_(r['Amount']);
    if (q === null) return;
    purchaseQty += q;
    if (a !== null) purchaseValue += a;
  });

  var availableQty = openingQty + purchaseQty;
  var availableValue = openingValue + purchaseValue;
  var avg = availableQty > 0 ? availableValue / availableQty : 0;

  return {
    item: itemName,
    baseUnit: baseUnit,
    openingQty: openingQty,
    openingValue: openingValue,
    purchaseQty: purchaseQty,
    purchaseValue: purchaseValue,
    availableQty: availableQty,
    availableValue: availableValue,
    avg: avg
  };
}

// ---------------------------------------------------------------------------
// Consumption by population
// ---------------------------------------------------------------------------

/** Manual usage (toppings/packaging) from Adjustments, in base units. */
function manualUsedBaseQuantity_(itemName, adjustmentRows) {
  var rows = adjustmentRows || readRecords_(SHEETS.ADJUSTMENTS);
  var out = 0;

  rows.forEach(function (r) {
    if (normaliseItemName_(r['Item']) !== normaliseItemName_(itemName)) return;

    var q = toNumber_(r['Base Quantity']);
    if (q === null) {
      // Older rows may only carry the entry quantity; convert it.
      var rawQty = toNumber_(r['Quantity']);
      if (rawQty === null) return;
      var item = findItem_(itemName);
      q = toBaseQuantity_(rawQty, String(r['Unit'] || (item ? item.unit : 'p')),
                          item && item.perPieceWeight);
      if (q === null) return;
    }

    var dir = String(r['Direction'] || 'Out');
    if (dir === 'Out') out += q;
    else if (dir === 'In') out -= q;      // found stock reduces net usage
    // 'Count' is handled separately when reconciling, not as usage.
  });

  return out;
}

/**
 * POS-driven usage for resale items (§13.G1). Water only.
 *
 * One POS sale consumes one stock unit. The cumulative figure comes from the
 * POS product's lifetime total, which survives counter resets.
 */
function resaleUsedBaseQuantity_(itemName, posRows) {
  var item = findItem_(itemName);
  if (!item || item.population !== POPULATION.RESALE || !item.posLink) return 0;

  var rows = posRows || readRecords_(SHEETS.POS_SNAPSHOTS);
  var sold = 0;
  rows.forEach(function (r) {
    if (String(r['Product']) !== item.posLink) return;
    var n = toNumber_(r['Units Sold']);
    if (n !== null) sold += n;
  });

  // One sale = one piece. Water's base unit is already 'p', so no conversion.
  return sold;
}

// ---------------------------------------------------------------------------
// The Stock view
// ---------------------------------------------------------------------------

/**
 * Computes the full stock table.
 *
 * `asOf` limits purchases, consumption, manual usage and POS sales to that date
 * or earlier, which is what a "stock position as of a past date" means (§6.2).
 * Opening stock is always included: it pre-dates the ledger by definition.
 */
function computeStock_(asOf, opts) {
  opts = opts || {};
  var asOfDate = asOf ? toDate_(asOf) : null;

  var itemRows = readRecords_(SHEETS.ITEM_MASTER).filter(function (r) {
    return String(r['Active']) !== 'FALSE' && String(r['Item Name'] || '');
  });

  var openingRows = readRecords_(SHEETS.OPENING_STOCK);
  var bazarRows = filterBazarAsOf_(readRecords_(SHEETS.BAZAR), asOfDate);
  var adjustmentRows = filterByDateAsOf_(readRecords_(SHEETS.ADJUSTMENTS), asOfDate);
  var posRows = filterByDateAsOf_(readRecords_(SHEETS.POS_SNAPSHOTS), asOfDate);

  // Index once for the whole 43-item valuation rather than once per item.
  var openingIndex = indexByItem_(openingRows, 'Item');
  var bazarIndex = indexByItem_(bazarRows, 'Item');

  // Batch totals drive recipe consumption. Restricted to the same as-of window.
  var batchRange = asOfDate ? { start: null, end: asOfDate } : null;
  var batchStats = batchTotals_(batchRange && batchRange.start, batchRange && batchRange.end);
  var batchTotals = batchStats.totals;

  var workDays = openDaysBetween_(batchStats.firstDate, batchStats.lastDate);
  var dayBasis = workDays > 0 ? workDays : 0;

  var rows = [];

  itemRows.forEach(function (r) {
    var name = String(r['Item Name']);
    var population = String(r['Population']);
    var item = findItem_(name);

    var cost = itemCosting_(name, {
      openingRows: openingRows,
      bazarRows: bazarRows,
      openingIndex: openingIndex,
      bazarIndex: bazarIndex
    });

    // --- Usage, by population ---
    var perPrep = {};
    PREPARATIONS.forEach(function (p) { perPrep[p] = 0; });

    var manualUsed = 0;
    var resaleUsed = 0;

    if (population === POPULATION.RECIPE) {
      perPrep = ingredientConsumptionByPreparation_(name, batchTotals);
    } else if (population === POPULATION.RESALE) {
      resaleUsed = resaleUsedBaseQuantity_(name, posRows);
    } else {
      manualUsed = manualUsedBaseQuantity_(name, adjustmentRows);
    }

    var totalUsed = manualUsed + resaleUsed;
    PREPARATIONS.forEach(function (p) { totalUsed += perPrep[p]; });

    // --- Valuation: the identity is enforced here ---
    var usedCost = totalUsed * cost.avg;
    var remainingQty = cost.availableQty - totalUsed;
    var remainingValue = remainingQty * cost.avg;

    // --- Estimates (§6.2.2) ---
    var estDays = '';
    var estBatches = '';
    var dailyUse = dayBasis > 0 ? totalUsed / dayBasis : 0;

    if (totalUsed > 0 && dailyUse > 0 && remainingQty > 0) {
      estDays = Math.round(remainingQty / dailyUse);
    }

    if (population === POPULATION.RECIPE && remainingQty > 0) {
      // Smallest number of batches any preparation could still support.
      var bottleneck = null;
      PREPARATIONS.forEach(function (prep) {
        var perBatch = liveMeasurement_(name, prep);
        if (!perBatch || perBatch <= 0) return;
        var possible = remainingQty / perBatch;
        if (bottleneck === null || possible < bottleneck) bottleneck = possible;
      });
      if (bottleneck !== null) estBatches = Math.floor(bottleneck);
    }

    // --- Flags (§13.E34) ---
    var lowDays = toNumber_(r['Low Stock Days']);
    var lowBatches = toNumber_(r['Low Batches']);
    var flags = [];

    if (remainingQty < 0) flags.push('NEGATIVE');
    if (lowDays !== null && estDays !== '' && estDays <= lowDays) flags.push('LOW DAYS');
    if (lowBatches !== null && estBatches !== '' && estBatches <= lowBatches) flags.push('LOW BATCHES');

    rows.push({
      item: name,
      group: String(r['Group']),
      population: population,
      baseUnit: cost.baseUnit,

      openingQty: cost.openingQty,
      purchasedQty: cost.purchaseQty,
      totalAvailable: cost.availableQty,

      perPrep: perPrep,
      manualUsed: manualUsed,
      resaleUsed: resaleUsed,
      totalUsed: totalUsed,

      avgCost: cost.avg,
      // The same average, expressed in the unit the owner buys in: per kg / per
      // litre / per piece. This is the figure she asked to see on the Stock tab,
      // because "Flour averages 71.47/kg" is meaningful and "0.07147 per gram" is not.
      avgRate: round2_(entryRateFromPerBase_(item, cost.avg)),
      usedCost: round2_(usedCost),
      remainingQty: remainingQty,
      remainingValue: round2_(remainingValue),

      // Used cost + remaining value. Equals opening value + purchase spend, so this
      // is what the stock actually cost — the figure the owner asked for.
      totalCost: round2_(cost.availableValue),

      availableValue: round2_(cost.availableValue),
      openingValue: round2_(cost.openingValue),
      purchaseValue: round2_(cost.purchaseValue),

      estDays: estDays,
      estBatches: estBatches,
      flags: flags,
      lowStock: remainingQty < 0 || flags.indexOf('LOW DAYS') !== -1 ||
                flags.indexOf('LOW BATCHES') !== -1,

      latestRate: toNumber_(r['Latest Purchase Rate'])
    });
  });

  return {
    rows: rows,
    asOf: asOfDate ? dateKey_(asOfDate) : '',
    batchTotals: batchTotals,
    batchRecords: batchStats.records,
    firstBatch: batchStats.firstDate,
    lastBatch: batchStats.lastDate,
    openDays: workDays,
    calendarDays: batchStats.firstDate && batchStats.lastDate
      ? daysBetweenInclusive_(batchStats.firstDate, batchStats.lastDate) : 0
  };
}

/** Bazar rows on or before a date. */
function filterBazarAsOf_(rows, asOfDate) {
  if (!asOfDate) return rows;
  return rows.filter(function (r) {
    var d = toDate_(r['Date']);
    return d && d <= asOfDate;
  });
}

/** Any dated rows on or before a date. */
function filterByDateAsOf_(rows, asOfDate) {
  if (!asOfDate) return rows;
  return rows.filter(function (r) {
    var d = toDate_(r['Date']);
    return d && d <= asOfDate;
  });
}

/**
 * Open (trading) days between two dates, inclusive, using the ClosedDays list.
 *
 * README §8.4: never a weekday rule, never a +1 fudge. Returns 0 when the range
 * is unusable so callers can produce a blank estimate rather than a wrong number.
 *
 * Delegates to 10_ClosedDays.gs so there is exactly one definition of "open day".
 * Two implementations of this would eventually disagree, and every per-day average
 * would silently follow whichever one the caller happened to use.
 */
function openDaysBetween_(start, end) {
  var breakdown = openDayBreakdown_(start, end);
  return breakdown ? breakdown.openDays : 0;
}

// ---------------------------------------------------------------------------
// Identity check — the phase gate
// ---------------------------------------------------------------------------

/**
 * Verifies `used cost + remaining value = opening value + purchase spend`
 * for every item, and returns any that break it.
 *
 * This is the test that matters in Phase 6 (§6.2.1, §15).
 */
function verifyValuationIdentity_(asOf) {
  var result = computeStock_(asOf);
  var failures = [];
  var totals = { usedCost: 0, remainingValue: 0, availableValue: 0,
                 purchaseValue: 0, openingValue: 0 };

  result.rows.forEach(function (r) {
    var left = r.usedCost + r.remainingValue;
    var right = r.availableValue;
    var diff = Math.abs(left - right);

    totals.usedCost += r.usedCost;
    totals.remainingValue += r.remainingValue;
    totals.availableValue += r.availableValue;
    totals.purchaseValue += r.purchaseValue;
    totals.openingValue += r.openingValue;

    // A cent of slack absorbs floating point only; anything larger is a real bug.
    if (diff > 0.02) {
      failures.push({
        item: r.item,
        usedCost: r.usedCost,
        remainingValue: r.remainingValue,
        availableValue: r.availableValue,
        difference: round2_(diff)
      });
    }
  });

  return {
    ok: failures.length === 0,
    failures: failures,
    rows: result.rows.length,
    totals: totals,
    detail: result
  };
}

// ---------------------------------------------------------------------------
// Writing the Stock view
// ---------------------------------------------------------------------------

/**
 * Recomputes the OpeningStock sheet from the Bazar records currently in this
 * spreadsheet — no access to the source workbook, so it works on live data.
 *
 * Definition (owner's decision): opening stock is every purchase on or before
 * the cut-off date, plus stock that has no purchase behind it at all.
 *
 * This exists because the opening layer depends on Bazar, and if a Bazar row is
 * corrected (e.g. Milk 23 L -> 25 L) the opening layer is stale until rebuilt.
 * Re-running the whole migration cannot fix it: migration skips rows it has
 * already imported.
 *
 * Safe to run repeatedly: it rewrites OpeningStock from scratch each time.
 */
function rebuildOpeningStock_() {
  var settings = readSettings_();
  var cutOff = toDate_(settings.opening_cutoff_date || '2026-10-10');
  if (!cutOff) cutOff = toDate_('2026-10-10');

  // --- Split purchases at the cut-off, tracking the real purchase rate ---
  var openingQty = {};
  var purchasedQty = {};

  // Opening stock must be valued at what was ACTUALLY paid on the cut-off date,
  // not at the item's latest rate. Flour was 80/kg on 10 Oct but 67/kg later;
  // using the latest rate would understate the opening layer by 13 Tk per kg.
  //
  // When an item was bought several times on the cut-off day, quantity-weighted
  // average is the only defensible figure.
  var openingValueRaw = {};
  var duplicateWarnings = [];

  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Expense Type']) !== EXPENSE_TYPE_INVENTORY) return;
    var item = String(r['Item'] || '');
    if (!item) return;
    var base = toNumber_(r['Base Quantity']);
    if (base === null) return;

    var d = toDate_(r['Date']);
    if (d && d <= cutOff) {
      openingQty[item] = (openingQty[item] || 0) + base;
      openingValueRaw[item] = (openingValueRaw[item] || 0) + (toNumber_(r['Amount']) || 0);
    } else {
      purchasedQty[item] = (purchasedQty[item] || 0) + base;
    }
  });

  // --- Detect likely duplicate purchase lines ---
  // Two rows for the same item, quantity and unit on the same day is almost
  // always a re-entry rather than two identical purchases. It silently inflates
  // stock, so it is reported rather than guessed at.
  duplicateWarnings = findDuplicatePurchaseLines_();

  // --- Preserve genuinely pre-existing stock ---
  // An item with no purchase at all but a non-zero existing opening quantity was
  // on the shelf before the ledger began (Waffle Box, Waffle Tray). Keep it.
  var existingOpening = {};
  readRecords_(SHEETS.OPENING_STOCK).forEach(function (r) {
    var name = String(r['Item'] || '');
    if (!name) return;
    var q = toNumber_(r['Quantity']);
    var note = String(r['Note'] || '');
    if (q !== null && q > 0 && note.indexOf('Pre-existing') !== -1) {
      existingOpening[name] = q;
    }
  });

  // --- Rebuild the sheet ---
  var sheet = getSheet_(SHEETS.OPENING_STOCK);
  var headers = SCHEMA[SHEETS.OPENING_STOCK];
  writeHeaders_(sheet, headers);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  var itemRows = readRecords_(SHEETS.ITEM_MASTER).filter(function (r) {
    return String(r['Active']) !== 'FALSE' && String(r['Item Name'] || '');
  });

  var rows = [];
  var totalOpening = 0;
  var totalValue = 0;

  itemRows.forEach(function (ir) {
    var name = String(ir['Item Name']);
    var item = findItem_(name);

    var qty = openingQty[name] || 0;
    var note = 'Purchases on or before ' + dateKey_(cutOff) + ' (setup stock)';

    if (qty === 0 && existingOpening[name]) {
      qty = existingOpening[name];
      note = 'Pre-existing stock: never purchased in the recorded window';
    }

    // Rate shown is the actual rate paid on the cut-off date, in the item's
    // ENTRY unit (per kg / per litre / per piece), which is how the owner reads it.
    // Falls back to the seeded/latest rate only for pre-existing stock, which by
    // definition has no purchase to derive a rate from.
    var rate;
    var value;

    if (qty > 0 && openingValueRaw[name] !== undefined) {
      var perBase = openingValueRaw[name] / qty;            // money per gm/ml/piece
      value = openingValueRaw[name];

      // Convert back up to the entry unit so "Flour at 80/kg" reads correctly.
      rate = entryRateFromPerBase_(item, perBase);
    } else {
      rate = toNumber_(ir['Latest Purchase Rate']);
      if (rate === null) rate = toNumber_(ir['Seed Rate']);
      value = qty * ratePerBaseUnit_(item, rate);
    }

    rows.push([
      name,
      cutOff,
      round2_(qty),
      round2_(rate),
      round2_(value),
      'Rebuilt from Bazar',
      note
    ]);

    totalOpening += qty;
    totalValue += value;
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  logEvent_('STOCK', 'Opening stock rebuilt',
    rows.length + ' items, cut-off ' + dateKey_(cutOff));

  return {
    written: rows.length,
    cutOff: dateKey_(cutOff),
    totalOpeningQty: round2_(totalOpening),
    totalOpeningValue: round2_(totalValue),
    itemsWithOpening: rows.filter(function (r) { return Number(r[2]) > 0; }).length,
    duplicates: duplicateWarnings
  };
}

/**
 * Finds suspicious purchase lines: the same item recorded more than once on the
 * same day in the same unit.
 *
 * Why not require an identical quantity? Because the most common real cause is a
 * correction that left the old row behind — Milk 23 L re-entered as 25 L, giving
 * two rows where one was meant. Requiring identical quantities would miss exactly
 * that case, which is the one that inflates stock silently.
 *
 * Deliberately reports rather than deletes: buying the same item twice in a day
 * is legitimate (two shops, two trips). Only the owner knows which it was.
 */
function findDuplicatePurchaseLines_() {
  var groups = {};
  var duplicates = [];

  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Expense Type']) !== EXPENSE_TYPE_INVENTORY) return;

    var item = String(r['Item'] || '');
    if (!item) return;

    var qty = toNumber_(r['Quantity']);
    if (qty === null) return;

    var unit = String(r['Unit'] || '').trim();
    var key = [normaliseItemName_(item), dateKey_(r['Date']), unit].join('|');

    if (!groups[key]) groups[key] = [];
    groups[key].push({
      recordId: String(r['Record ID'] || ''),
      item: item,
      date: dateKey_(r['Date']),
      quantity: qty,
      unit: unit,
      rate: toNumber_(r['Rate']),
      ref: String(r['Ref'] || '')
    });
  });

  Object.keys(groups).forEach(function (key) {
    var rows = groups[key];
    if (rows.length < 2) return;

    // Same ref means the owner deliberately recorded several lines on one bill.
    // Same item twice on one invoice is unusual but not a re-entry artefact, so
    // it is flagged only when the refs differ or are both blank.
    var refs = {};
    rows.forEach(function (x) { refs[x.ref] = true; });
    var distinctRefs = Object.keys(refs).length;

    var quantities = rows.map(function (x) { return x.quantity; });
    var identical = quantities.every(function (q) { return q === quantities[0]; });

    duplicates.push({
      item: rows[0].item,
      date: rows[0].date,
      unit: rows[0].unit,
      count: rows.length,
      quantities: quantities,
      identical: identical,
      distinctRefs: distinctRefs,
      records: rows.map(function (x) { return x.recordId; })
    });
  });

  return duplicates;
}

/** Rebuilds the Stock sheet from source records. Never the source of truth. */
function refreshStockSheet_(asOf) {
  var computed = computeStock_(asOf);
  var sheet = getSheet_(SHEETS.STOCK);
  var headers = SCHEMA[SHEETS.STOCK];

  writeHeaders_(sheet, headers);

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  var rows = computed.rows.map(function (r) {
    // Order must match SCHEMA[SHEETS.STOCK] exactly.
    return [
      r.item,
      r.group,
      r.population,
      round2_(r.openingQty),
      round2_(r.purchasedQty),
      round2_(r.totalAvailable),
      r.avgRate,
      round2_(r.perPrep['Batter']),
      round2_(r.perPrep['Nutella Mix']),
      round2_(r.perPrep['Cream']),
      round2_(r.perPrep['White Mix']),
      round2_(r.perPrep['Cheese']),
      round2_(r.manualUsed || r.resaleUsed || ''),
      round2_(r.totalUsed),
      r.usedCost,
      round2_(r.remainingQty),
      r.remainingValue,
      r.totalCost,
      r.estDays,
      r.estBatches,
      r.flags.join(', '),
      r.latestRate == null ? '' : r.latestRate
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(19, 170);
  return { written: rows.length, asOf: computed.asOf };
}
