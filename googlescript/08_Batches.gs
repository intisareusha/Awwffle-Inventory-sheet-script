/**
 * Awwffle Inventory System — 08_Batches.gs
 *
 * Phase 5 — daily batch production entry.
 *
 * README §3.2, §11.
 *
 * One row per production date. Fractional batches are normal and expected
 * (0.5 Batter is a real thing), so no rounding is applied anywhere.
 *
 * Editing is an UPDATE, not a second row. The old workbook's whole problem was
 * the same fact recorded twice (§11 "one source, one truth"); a batch is keyed by
 * date, so correcting a batch cannot produce duplicate consumption (§3.2).
 */

// ---------------------------------------------------------------------------
// Form bootstrap
// ---------------------------------------------------------------------------

/** Everything the batch sidebar needs. */
function getBatchFormOptions_() {
  var validation = validateMeasurements_();

  return {
    preparations: PREPARATIONS,
    today: dateKey_(new Date()),
    measurementErrors: validation.errors,
    measurementWarnings: validation.warnings,
    recent: getRecentBatches_(30)
  };
}

/** Existing batch for a date, or null so the form can switch to edit mode. */
function getBatchForDate_(dateString) {
  var d = toDate_(dateString);
  if (!d) return null;

  var key = dateKey_(d);
  var found = readRecords_(SHEETS.BATCHES).filter(function (r) {
    return dateKey_(r['Date']) === key;
  })[0];

  if (!found) return null;

  var values = {};
  PREPARATIONS.forEach(function (prep) {
    var n = toNumber_(found[prep]);
    values[prep] = n === null ? '' : n;
  });

  return {
    date: key,
    batchId: String(found['Batch ID'] || ''),
    values: values,
    totalBatches: PREPARATIONS.reduce(function (sum, p) {
      var v = toNumber_(found[p]);
      return sum + (v === null ? 0 : v);
    }, 0),
    isClosed: isClosedDay_(d)
  };
}

/** Recent batches, newest first. */
function getRecentBatches_(limit) {
  var rows = readRecords_(SHEETS.BATCHES).map(function (r) {
    var d = toDate_(r['Date']);
    var values = {};
    var total = 0;
    PREPARATIONS.forEach(function (prep) {
      var n = toNumber_(r[prep]);
      values[prep] = n === null ? '' : n;
      if (n !== null) total += n;
    });
    return { date: d, key: dateKey_(d), values: values, total: total };
  }).filter(function (r) { return r.key; });

  rows.sort(function (a, b) { return b.date - a.date; });
  return limit ? rows.slice(0, limit) : rows;
}

/** True when the date is in the ClosedDays list (§8.4). */
function isClosedDay_(date) {
  var key = dateKey_(date);
  return readRecords_(SHEETS.CLOSED_DAYS).some(function (r) {
    return dateKey_(r['Date']) === key;
  });
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Creates or updates the batch record for one date.
 *
 * `payload` = { date: 'yyyy-MM-dd', values: { Batter: 1.5, ... }, notes: '' }
 *
 * Rules enforced:
 *   - one record per date (a second save updates the first)
 *   - fractional values allowed
 *   - negative values rejected
 *   - at least one preparation must be non-zero, otherwise the row is pointless
 *   - a closed day is allowed but flagged, because batches have genuinely happened
 *     on closed days in the source data (§17.1)
 */
function saveBatch_(payload) {
  var result = validateBatch_(payload);
  if (!result.ok) return { ok: false, errors: result.errors };

  var date = result.date;
  var key = dateKey_(date);
  var sheet = getSheet_(SHEETS.BATCHES);
  var records = readRecords_(SHEETS.BATCHES);

  var existingIndex = -1;
  for (var i = 0; i < records.length; i++) {
    if (dateKey_(records[i]['Date']) === key) { existingIndex = i; break; }
  }

  var values = result.values;
  var row = [
    existingIndex >= 0 ? String(records[existingIndex]['Batch ID'] || newId_('BATCH')) : newId_('BATCH'),
    date,
    values['Batter'],
    values['Nutella Mix'],
    values['Cream'],
    values['White Mix'],
    values['Cheese'],
    new Date(),
    String(payload.notes || '')
  ];

  if (existingIndex >= 0) {
    // readRecords skips blank first-column rows, so index i maps to row i+2 only
    // when there are no gaps. Find the real row by scanning column A.
    var realRow = findBatchRow_(sheet, key);
    if (realRow < 2) return { ok: false, errors: ['Could not locate the existing batch row.'] };
    sheet.getRange(realRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }

  invalidateMeasurementCache_();

  logEvent_('BATCH', existingIndex >= 0 ? 'Batch updated' : 'Batch created',
    key + ' ' + JSON.stringify(values));

  return {
    ok: true,
    updated: existingIndex >= 0,
    date: key,
    total: result.total,
    closedDay: isClosedDay_(date),
    message: (existingIndex >= 0 ? 'Updated' : 'Saved') + ' batch for ' + key +
             ' (total ' + round2_(result.total) + ' batches)'
  };
}

/** Finds the sheet row number for a batch date, or -1. */
function findBatchRow_(sheet, dateKeyValue) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var dates = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (dateKey_(dates[i][0]) === dateKeyValue) return i + 2;
  }
  return -1;
}

/**
 * Validates a batch payload. Pure: writes nothing.
 * Returns { ok, errors, warnings, date, values, total }.
 *
 * `isClosed` is a test seam. When omitted it consults the ClosedDays sheet, which
 * is what production does. Passing a boolean keeps this function testable without
 * a spreadsheet.
 */
function validateBatch_(payload, isClosed) {
  var errors = [];
  var warnings = [];

  if (!payload) return { ok: false, errors: ['No data received.'], warnings: warnings };

  var date = toDate_(payload.date);
  if (!date) errors.push('A valid date is required.');
  if (date && date > toDate_(new Date())) {
    errors.push('The date ' + dateKey_(date) + ' is in the future.');
  }

  var raw = payload.values || {};
  var values = {};
  var total = 0;
  var anyPositive = false;

  PREPARATIONS.forEach(function (prep) {
    var v = raw[prep];

    // A blank means "none of this preparation was made" and is stored blank, not
    // zero, so the sheet reflects what was entered (§3.1 logic applied to batches).
    if (isBlank_(v)) {
      values[prep] = '';
      return;
    }

    var n = toNumber_(v);
    if (n === null) {
      errors.push(prep + ' must be a number.');
      values[prep] = '';
      return;
    }
    if (n < 0) {
      errors.push(prep + ' cannot be negative.');
      return;
    }
    if (n === 0) {
      values[prep] = '';
      return;
    }

    values[prep] = n;
    total += n;
    anyPositive = true;
  });

  if (!anyPositive && errors.length === 0) {
    errors.push('Enter at least one preparation. A batch with no quantities records nothing.');
  }

  // A batch on a closed day is legitimate — the source has Wednesday batches — but
  // worth surfacing so a mis-keyed date is noticed.
  var closed = (typeof isClosed === 'boolean') ? isClosed : (date ? isClosedDay_(date) : false);
  if (closed) {
    warnings.push(dateKey_(date) + ' is recorded as a closed day. ' +
                  'The batch will still be saved; check the date if that is unexpected.');
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    date: date,
    values: values,
    total: round2_(total)
  };
}

/** Deletes the batch for a date. Returns whether anything was removed. */
function deleteBatch_(dateString) {
  var d = toDate_(dateString);
  if (!d) return { ok: false, errors: ['A valid date is required.'] };

  var sheet = getSheet_(SHEETS.BATCHES);
  var realRow = findBatchRow_(sheet, dateKey_(d));
  if (realRow < 2) {
    return { ok: false, errors: ['No batch exists for ' + dateKey_(d) + '.'] };
  }

  sheet.deleteRow(realRow);
  invalidateMeasurementCache_();
  logEvent_('BATCH', 'Batch deleted', dateKey_(d));

  return { ok: true, deleted: dateKey_(d), message: 'Deleted batch for ' + dateKey_(d) };
}

// ---------------------------------------------------------------------------
// Aggregation used by later phases
// ---------------------------------------------------------------------------

/**
 * Total batches per preparation over a date range, inclusive.
 * Used by the Stock view (Phase 6) and cost reporting (Phase 9).
 *
 * Returns { Batter: 33.5, ... } plus `days` = number of batch records, which is
 * the denominator for daily consumption (§6.2.2).
 */
function batchTotals_(startDate, endDate) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;

  var totals = {};
  PREPARATIONS.forEach(function (p) { totals[p] = 0; });
  var records = 0;
  var first = null;
  var last = null;

  readRecords_(SHEETS.BATCHES).forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    records++;
    if (!first || d < first) first = d;
    if (!last || d > last) last = d;

    PREPARATIONS.forEach(function (prep) {
      var n = toNumber_(r[prep]);
      if (n !== null) totals[prep] += n;
    });
  });

  return {
    totals: totals,
    records: records,
    firstDate: first,
    lastDate: last,
    grandTotal: PREPARATIONS.reduce(function (s, p) { return s + totals[p]; }, 0)
  };
}

/**
 * Consumption of one ingredient across all preparations, in base units.
 * This is Measurements x Batches (§3.3), the core inventory formula.
 *
 * `totals` may be passed in to avoid re-reading Batches per ingredient.
 */
function ingredientConsumption_(ingredient, totals) {
  var t = totals || batchTotals_().totals;
  var matrix = readMeasurementMatrix_();
  var item = findItem_(ingredient);
  var key = item ? item.name : String(ingredient);
  var row = matrix[key];
  if (!row) return 0;

  var sum = 0;
  PREPARATIONS.forEach(function (prep) {
    var perBatch = row[prep];
    if (isBlank_(perBatch)) return;
    var batches = t[prep] || 0;
    if (!batches) return;
    sum += Number(perBatch) * batches;
  });
  return sum;
}

/** Consumption split by preparation, for the Stock view's per-column breakdown. */
function ingredientConsumptionByPreparation_(ingredient, totals) {
  var t = totals || batchTotals_().totals;
  var matrix = readMeasurementMatrix_();
  var item = findItem_(ingredient);
  var key = item ? item.name : String(ingredient);
  var row = matrix[key] || {};

  var out = {};
  PREPARATIONS.forEach(function (prep) {
    var perBatch = row[prep];
    var batches = t[prep] || 0;
    out[prep] = (isBlank_(perBatch) || !batches) ? 0 : Number(perBatch) * batches;
  });
  return out;
}
