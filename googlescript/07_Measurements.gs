/**
 * Awwffle Inventory System — 07_Measurements.gs
 *
 * Phase 5 — the fixed recipe matrix.
 *
 * README §3.1, §13.D27, §13.D28.
 *
 * IMPORTANT: the SEED lives in 03c_MeasurementsSeed.gs, but the LIVE DATA is the
 * Measurements sheet, which the owner may edit during intentional recipe
 * maintenance. Every calculation must therefore read the SHEET, never the seed.
 * The seed exists only to create the sheet once.
 *
 * Blanks mean "not used in this preparation" and must stay blanks, not zeros
 * (§3.1). A zero would be summed harmlessly but would misrepresent the recipe,
 * and the difference matters when a preparation is genuinely unused.
 */

// ---------------------------------------------------------------------------
// Public API (sidebar / menu)
// ---------------------------------------------------------------------------

/** Sidebar bootstrap for the batch form. */
function getBatchFormOptions() {
  return getBatchFormOptions_();
}

/** Existing batch for a date, or null. Lets the form offer edit instead of duplicate. */
function getBatchForDate(dateString) {
  return getBatchForDate_(dateString);
}

/** Creates or updates the batch for a date. */
function saveBatch(payload) {
  return saveBatch_(payload);
}

/** Deletes the batch for a date. */
function deleteBatch(dateString) {
  return deleteBatch_(dateString);
}

/** Recent batches, for the sidebar list. */
function getRecentBatches(limit) {
  return getRecentBatches_(limit);
}

// ---------------------------------------------------------------------------
// Reading the live matrix
// ---------------------------------------------------------------------------

/**
 * Reads the Measurements sheet into a lookup:
 *   { 'Flour': { Batter: 500, 'Nutella Mix': '' , ... }, ... }
 *
 * Blanks are preserved as empty strings. Returns {} when the sheet is missing or
 * empty, so callers must handle that rather than silently computing zeros.
 *
 * Cached per execution: consumption loops call this once per ingredient, and a
 * sheet read per call would make the Stock view quadratic.
 */
var MEASUREMENT_CACHE_ = null;

function readMeasurementMatrix_() {
  if (MEASUREMENT_CACHE_) return MEASUREMENT_CACHE_;

  var records = readRecords_(SHEETS.MEASUREMENTS);
  var matrix = {};

  records.forEach(function (r) {
    var ingredient = String(r['Ingredient'] === null ? '' : r['Ingredient']).trim();
    if (!ingredient) return;

    // Resolve through the item master so a renamed recipe row still matches, but
    // keep the sheet's own spelling as the key when it does not resolve.
    var item = findItem_(ingredient);
    var key = item ? item.name : ingredient;

    var row = {};
    PREPARATIONS.forEach(function (prep) {
      var v = r[prep];
      var n = toNumber_(v);
      row[prep] = (n === null || n === 0) ? '' : n;
    });
    matrix[key] = row;
  });

  MEASUREMENT_CACHE_ = matrix;
  return matrix;
}

/** Clears the per-execution cache. Call after any edit to the sheet. */
function invalidateMeasurementCache_() {
  MEASUREMENT_CACHE_ = null;
}

/** Requirement for one ingredient in one preparation. 0 when blank or unknown. */
function liveMeasurement_(ingredient, preparation) {
  var matrix = readMeasurementMatrix_();
  var item = findItem_(ingredient);
  var key = item ? item.name : String(ingredient);
  var row = matrix[key];
  if (!row) return 0;
  var v = row[preparation];
  return isBlank_(v) ? 0 : Number(v);
}

/** Ingredients that actually appear in the sheet, in sheet order. */
function liveMeasurementIngredients_() {
  return readRecords_(SHEETS.MEASUREMENTS).map(function (r) {
    var raw = String(r['Ingredient'] === null ? '' : r['Ingredient']).trim();
    var item = findItem_(raw);
    return item ? item.name : raw;
  }).filter(function (n) { return n; });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Checks the sheet against the rules that matter for correctness (§3.1, §9):
 *   - every ingredient exists in the item master
 *   - values are numeric and non-negative
 *   - 'Empty Container' is absent
 *   - 'Waste' is absent
 *
 * Returns { ok, errors, warnings }.
 */
function validateMeasurements_() {
  var errors = [];
  var warnings = [];
  var records = readRecords_(SHEETS.MEASUREMENTS);

  if (!records.length) {
    errors.push('The Measurements sheet is empty. Run Setup to seed it.');
    return { ok: false, errors: errors, warnings: warnings };
  }

  var seen = {};
  var usedIngredients = 0;

  records.forEach(function (r, i) {
    var rowNumber = i + 2;
    var raw = String(r['Ingredient'] === null ? '' : r['Ingredient']).trim();

    if (!raw) {
      warnings.push('Row ' + rowNumber + ' has no ingredient name and is ignored.');
      return;
    }

    var key = normaliseItemName_(raw);
    if (seen[key]) {
      errors.push('Row ' + rowNumber + ': "' + raw + '" appears more than once.');
    }
    seen[key] = true;

    // Excluded rows that must never reappear (§3.1, §13.D28).
    if (key === normaliseItemName_('Empty Container')) {
      errors.push('Row ' + rowNumber + ': "Empty Container" must not be in Measurements. ' +
                  'It has no Stock row and would orphan every total.');
    }
    if (key === normaliseItemName_('Waste')) {
      errors.push('Row ' + rowNumber + ': "Waste" is not a preparation or an ingredient.');
    }

    if (!findItem_(raw)) {
      errors.push('Row ' + rowNumber + ': "' + raw + '" is not in the item master.');
    }

    var anyValue = false;
    var isExcluded = key === normaliseItemName_('Empty Container') ||
                     key === normaliseItemName_('Waste');

    PREPARATIONS.forEach(function (prep) {
      var v = r[prep];
      if (isBlank_(v)) return;
      var n = toNumber_(v);
      if (n === null) {
        errors.push('Row ' + rowNumber + ': ' + prep + ' is not a number ("' + v + '").');
      } else if (n < 0) {
        errors.push('Row ' + rowNumber + ': ' + prep + ' is negative (' + n + ').');
      } else {
        anyValue = true;
      }
    });

    if (!anyValue && !isExcluded) {
      warnings.push('Row ' + rowNumber + ' ("' + raw + '") is used in no preparation. ' +
                    'It will never be consumed — is that intended?');
    } else if (anyValue) {
      usedIngredients++;
    }
  });

  if (usedIngredients === 0) {
    errors.push('No ingredient is used in any preparation. The recipe is effectively empty.');
  }

  return { ok: errors.length === 0, errors: errors, warnings: warnings };
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Rewrites the Measurements sheet from the seed. Destructive: it replaces the
 * owner's edited values, so it is only for a deliberate reset.
 */
function resetMeasurementsToSeed_() {
  var sheet = getSheet_(SHEETS.MEASUREMENTS);
  var result = validateMeasurements_();
  if (!result.ok) {
    // Still allow a reset when the sheet is broken — that is the point of a reset.
    logEvent_('MEASUREMENTS', 'Reset despite validation errors', result.errors.join(' | '));
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, SCHEMA[SHEETS.MEASUREMENTS].length).clearContent();
  }

  var rows = MEASUREMENTS_SEED.map(function (r) {
    return [r.ingredient, r.Batter, r['Nutella Mix'], r.Cream, r['White Mix'], r.Cheese];
  });
  sheet.getRange(2, 1, rows.length, SCHEMA[SHEETS.MEASUREMENTS].length).setValues(rows);

  logEvent_('MEASUREMENTS', 'Reset to seed', rows.length + ' rows');
  return { ok: true, rows: rows.length };
}
