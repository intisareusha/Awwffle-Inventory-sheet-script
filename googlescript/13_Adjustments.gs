/**
 * Awwffle Inventory System — 13_Adjustments.gs
 *
 * Physical stock counts for manually maintained items.
 *
 * README §3.3 (the three populations), §6 (the Stock view), §13.C26 (wastage /
 * adjustments), §11 (one source, one truth).
 *
 * WHAT A COUNT IS
 * The owner counts what is actually on the shelf for a Toppings or Equipments
 * item and records that figure here. The row is a SET-TO statement — "on this
 * date, this much was left" — not a usage delta.
 *
 * Usage is never stored. The Stock view derives it each time:
 *
 *     remaining = counted + purchases after the count − movement after the count
 *     used      = total available − remaining
 *
 * WHY NOT WRITE THE DELTA
 * Turning the count into an Out row would bake in the state of the ledger at that
 * moment. Correcting an earlier Bazar row would then leave a wrong usage figure
 * behind. A set-to count stays true: availability and movement are recalculated
 * around it on every read.
 *
 * WHY TOPS/GEAR ONLY
 * Recipe-driven consumption comes from Measurements × Batches. A count against a
 * recipe item would disagree with the recipe model by design, so those items are
 * excluded here rather than allowed to contradict it.
 */

/** Groups the count form offers. Recipe-driven items are deliberately absent. */
var MANUAL_STOCK_GROUPS = ['Toppings', 'Equipments'];

// ---------------------------------------------------------------------------
// Public API for the sidebar
// ---------------------------------------------------------------------------
//
// Apps Script's `google.script.run` only sees functions with no trailing
// underscore. These wrappers are the boundary between the UI and the logic.

/** Sidebar bootstrap: groups and countable items with their current position. */
function getManualStockPanel() {
  return getManualStockPanel_();
}

/** One item's position on a date, plus its count history. */
function getManualStockState(itemName, asOf) {
  return getManualStockState_(itemName, asOf);
}

/** Records (or replaces) one physical count. */
function saveManualStockCount(payload) {
  return saveManualStockCount_(payload);
}

/** Deletes one count row by Adjustment ID. */
function deleteManualStockCount(adjustmentId) {
  return deleteManualStockCount_(adjustmentId);
}

// ---------------------------------------------------------------------------
// Eligibility and units
// ---------------------------------------------------------------------------

/** True when an item's usage is recorded by hand rather than derived. */
function isCountableItem_(item) {
  if (!item) return false;
  if (MANUAL_STOCK_GROUPS.indexOf(item.group) === -1) return false;
  return item.population === POPULATION.MANUAL || item.population === POPULATION.RESALE;
}

/**
 * Entry units that make sense for this item. Filtered by the item's base unit so
 * a piece item can never be counted in kg, and a weight item never in litres.
 */
function allowedUnitsForItem_(item) {
  if (!item) return [];
  return ENTRY_UNITS.filter(function (u) {
    return UNIT_RULES[u] && UNIT_RULES[u].baseUnit === item.baseUnit;
  });
}

/** A base-unit quantity expressed in the item's display unit. */
function entryQtyFromBase_(item, baseQty) {
  var n = toNumber_(baseQty);
  if (n === null || !item) return null;
  var multiplier = baseMultiplier_(item.unit, item.perPieceWeight);
  return multiplier ? n / multiplier : n;
}

/** Serialisable description of an item for the sidebar. */
function itemSummary_(item) {
  return {
    name: item.name,
    group: item.group,
    population: item.population,
    unit: item.unit,
    baseUnit: item.baseUnit,
    perPieceWeight: item.perPieceWeight || null,
    allowedUnits: allowedUnitsForItem_(item)
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Builds the sidebar payload from one Stock computation. Items keep the item
 * master's order, so the dropdown reads the way the catalogue does.
 */
function getManualStockPanel_() {
  var today = dateKey_(new Date());
  var stock = computeStock_(today);

  var items = [];
  var present = {};

  stock.rows.forEach(function (r) {
    var item = findItem_(r.item);
    if (!isCountableItem_(item)) return;

    present[item.group] = true;
    items.push({
      name: item.name,
      group: item.group,
      population: item.population,
      unit: item.unit,
      baseUnit: item.baseUnit,
      perPieceWeight: item.perPieceWeight || null,
      allowedUnits: allowedUnitsForItem_(item),
      available: round2_(entryQtyFromBase_(item, r.totalAvailable)),
      used: round2_(entryQtyFromBase_(item, r.totalUsed)),
      remaining: round2_(entryQtyFromBase_(item, r.remainingQty)),
      avgRate: r.avgRate,
      countDate: r.countDate || ''
    });
  });

  return {
    today: today,
    groups: MANUAL_STOCK_GROUPS.filter(function (g) { return present[g]; }),
    items: items
  };
}

/** Position for one item on one date, plus the counts recorded for it. */
function getManualStockState_(itemName, asOf) {
  var item = findItem_(itemName);
  if (!item) return { ok: false, errors: ['Unknown item: ' + itemName] };
  if (!isCountableItem_(item)) {
    return {
      ok: false,
      errors: [item.name + ' is not a manual or resale item. Recipe items derive ' +
               'their usage from Measurements × Batches.']
    };
  }

  var date = toDate_(asOf) || toDate_(new Date());
  var stock = computeStock_(date);

  var row = null;
  stock.rows.forEach(function (r) {
    if (r.item === item.name) row = r;
  });
  if (!row) return { ok: false, errors: ['Could not value ' + item.name + '.'] };

  return {
    ok: true,
    asOf: dateKey_(date),
    item: itemSummary_(item),
    available: round2_(entryQtyFromBase_(item, row.totalAvailable)),
    availableBase: round2_(row.totalAvailable),
    used: round2_(entryQtyFromBase_(item, row.totalUsed)),
    remaining: round2_(entryQtyFromBase_(item, row.remainingQty)),
    remainingBase: round2_(row.remainingQty),
    remainingValue: row.remainingValue,
    avgRate: row.avgRate,
    avgPerBase: row.avgCost,
    countDate: row.countDate || '',
    counts: countHistoryFor_(item.name)
  };
}

/** Count rows for one item, newest first. */
function countHistoryFor_(itemName) {
  var needle = normaliseItemName_(itemName);

  return readRecords_(SHEETS.ADJUSTMENTS)
    .filter(function (r) {
      return String(r['Direction']) === 'Count' &&
             normaliseItemName_(r['Item']) === needle;
    })
    .map(function (r) {
      return {
        adjustmentId: String(r['Adjustment ID'] || ''),
        date: dateKey_(r['Date']),
        quantity: toNumber_(r['Quantity']),
        baseQuantity: round2_(adjustmentBaseQty_(r)),
        reason: String(r['Reason'] || ''),
        notes: String(r['Notes'] || '')
      };
    })
    .sort(function (a, b) {
      if (a.date === b.date) return 0;
      return a.date < b.date ? 1 : -1;
    });
}

/** Existing count row for the same item and date, for in-place replacement. */
function findCountRow_(itemName, date) {
  var sheet = getSheet_(SHEETS.ADJUSTMENTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var headers = getHeaders_(sheet);
  var idCol = colIndex_(headers, 'Adjustment ID');
  var dateCol = colIndex_(headers, 'Date');
  var itemCol = colIndex_(headers, 'Item');
  var dirCol = colIndex_(headers, 'Direction');
  if (idCol < 0 || dateCol < 0 || itemCol < 0 || dirCol < 0) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var needle = normaliseItemName_(itemName);
  var key = dateKey_(date);

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][dirCol]) !== 'Count') continue;
    if (normaliseItemName_(values[i][itemCol]) !== needle) continue;
    if (dateKey_(values[i][dateCol]) !== key) continue;
    return {
      rowNumber: i + 2,
      adjustmentId: String(values[i][idCol] || '')
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Records one physical count.
 *
 * `payload` = { date, item, quantity, unit, reason, notes }
 *
 * Quantity is stored in the item's display unit, so a row always reads in the
 * unit the item is held in, regardless of the unit it was typed in. The typed
 * figure is preserved in Notes for audit.
 *
 * A second count for the same item on the same date updates that row instead of
 * adding another, because it is a correction of the first, not extra movement.
 */
function saveManualStockCount_(payload) {
  var p = payload || {};

  var item = findItem_(String(p.item || '').trim());
  if (!item) return { ok: false, errors: ['Choose an item.'] };
  if (!isCountableItem_(item)) {
    return {
      ok: false,
      errors: [item.name + ' is not a manual or resale item. Recipe items derive ' +
               'their usage from Measurements × Batches.']
    };
  }

  var date = toDate_(p.date);
  if (!date) return { ok: false, errors: ['A valid count date is required.'] };
  if (date > toDate_(new Date())) {
    return { ok: false, errors: ['The count date cannot be in the future.'] };
  }

  // Before the cut-off, purchases are represented by the opening layer, so a
  // count there would count those purchases twice in the "movement after" term.
  var cutOff = openingCutOff_();
  if (cutOff && date <= cutOff) {
    return {
      ok: false,
      errors: ['Counts must be dated after the opening cut-off (' + dateKey_(cutOff) + ').']
    };
  }

  var quantity = toNumber_(p.quantity);
  if (quantity === null || quantity < 0) {
    return { ok: false, errors: ['Enter the quantity counted (zero or more).'] };
  }

  var allowed = allowedUnitsForItem_(item);
  var unit = String(p.unit || item.unit).trim();
  if (allowed.indexOf(unit) === -1) {
    return {
      ok: false,
      errors: ['Count ' + item.name + ' in ' + allowed.join(' or ') + '. ' +
               unit + ' is not a valid unit for this item.']
    };
  }

  var base = toBaseQuantity_(quantity, unit, item.perPieceWeight);
  if (base === null) return { ok: false, errors: ['Could not convert that quantity.'] };

  var displayQty = unit === item.unit
    ? quantity
    : convertQuantity_(quantity, unit, item.unit, item.perPieceWeight);
  displayQty = round2_(displayQty);

  var reason = String(p.reason || '').trim() || 'Manual stock count';
  var notes = 'Counted ' + quantity + ' ' + unit + ' (' + displayQty + ' ' + item.unit +
              '; ' + round2_(base) + ' ' + item.baseUnit + ')';
  var extra = String(p.notes || '').trim();
  if (extra) notes += '. ' + extra;

  var sheet = getSheet_(SHEETS.ADJUSTMENTS);
  var headers = getHeaders_(sheet);
  var required = ['Adjustment ID', 'Date', 'Item', 'Quantity', 'Direction',
                  'Reason', 'Base Quantity', 'Entered At', 'Notes'];
  var missing = required.filter(function (h) { return colIndex_(headers, h) < 0; });

  if (missing.length) {
    return {
      ok: false,
      errors: ['The Adjustments sheet is missing columns: ' + missing.join(', ') +
               '. Run Awwffle > Setup / Update structure first.']
    };
  }

  var existing = findCountRow_(item.name, date);
  var verb;

  if (existing) {
    var idCol = colIndex_(headers, 'Adjustment ID');
    var dateCol = colIndex_(headers, 'Date');
    var itemCol = colIndex_(headers, 'Item');
    var qtyCol = colIndex_(headers, 'Quantity');
    var dirCol = colIndex_(headers, 'Direction');
    var reasonCol = colIndex_(headers, 'Reason');
    var baseCol = colIndex_(headers, 'Base Quantity');
    var enteredCol = colIndex_(headers, 'Entered At');
    var notesCol = colIndex_(headers, 'Notes');

    var width = headers.length;
    var current = sheet.getRange(existing.rowNumber, 1, 1, width).getValues()[0];

    current[idCol] = existing.adjustmentId;
    current[dateCol] = date;
    current[itemCol] = item.name;
    current[qtyCol] = displayQty;
    current[dirCol] = 'Count';
    current[reasonCol] = reason;
    current[baseCol] = round2_(base);
    current[enteredCol] = new Date();
    current[notesCol] = notes;

    sheet.getRange(existing.rowNumber, 1, 1, width).setValues([current]);
    verb = 'updated';
  } else {
    appendRows_(SHEETS.ADJUSTMENTS, [[
      newId_('ADJ'),
      date,
      item.name,
      displayQty,
      'Count',
      reason,
      round2_(base),
      new Date(),
      notes
    ]]);
    verb = 'recorded';
  }

  var refresh = safeRefreshStock_();
  logEvent_('ADJUSTMENT', 'Manual stock count ' + verb,
    item.name + ' ' + dateKey_(date) + ' = ' + displayQty + ' ' + item.unit);

  return {
    ok: true,
    message: 'Count ' + verb + ' for ' + item.name + ' on ' + dateKey_(date) + '.',
    warning: refresh.ok ? '' : 'The count was saved, but the Stock view could not ' +
      'be refreshed: ' + refresh.error,
    state: getManualStockState_(item.name, date)
  };
}

/** Deletes one count row. Refuses anything that is not a Count. */
function deleteManualStockCount_(adjustmentId) {
  var id = String(adjustmentId || '').trim();
  if (!id) return { ok: false, errors: ['No count was selected.'] };

  var sheet = getSheet_(SHEETS.ADJUSTMENTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, errors: ['That count no longer exists.'] };

  var headers = getHeaders_(sheet);
  var idCol = colIndex_(headers, 'Adjustment ID');
  var dateCol = colIndex_(headers, 'Date');
  var itemCol = colIndex_(headers, 'Item');
  var dirCol = colIndex_(headers, 'Direction');
  if (idCol < 0 || dateCol < 0 || itemCol < 0 || dirCol < 0) {
    return { ok: false, errors: ['The Adjustments sheet is missing expected columns.'] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idCol]).trim() !== id) continue;

    if (String(values[i][dirCol]) !== 'Count') {
      return { ok: false, errors: ['That row is not a stock count.'] };
    }

    var label = String(values[i][itemCol]) + ' on ' + dateKey_(values[i][dateCol]);
    sheet.deleteRow(i + 2);
    var refresh = safeRefreshStock_();
    logEvent_('ADJUSTMENT', 'Manual stock count deleted', label + ' (' + id + ')');

    return {
      ok: true,
      message: 'Count deleted for ' + label + '.',
      warning: refresh.ok ? '' : 'The count was deleted, but the Stock view could ' +
        'not be refreshed: ' + refresh.error
    };
  }

  return { ok: false, errors: ['That count no longer exists. It may already be deleted.'] };
}

/** Rebuilds the Stock view without letting a refresh failure hide a saved count. */
function safeRefreshStock_() {
  try {
    refreshStockSheet_();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}
