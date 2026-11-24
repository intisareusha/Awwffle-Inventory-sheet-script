/**
 * Awwffle Inventory System — 01_Utils.gs
 *
 * Shared helpers: sheet access, IDs, dates, unit conversion, validation.
 * Nothing in here knows about business rules beyond the unit table in Config.
 */

// ---------------------------------------------------------------------------
// Sheet access
// ---------------------------------------------------------------------------

/**
 * Returns a sheet by name, creating it empty if it does not exist.
 * Setup is responsible for headers; this only guarantees existence.
 */
function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/** True when a sheet with this name exists. */
function sheetExists_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) !== null;
}

/**
 * Reads a sheet into an array of objects keyed by header name.
 * Only rows with a non-empty first column are returned, so trailing blanks in a
 * padded sheet do not produce phantom records.
 */
function readRecords_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var records = [];

  for (var r = 1; r < values.length; r++) {
    if (isBlank_(values[r][0])) continue;
    var record = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      record[String(headers[c])] = values[r][c];
    }
    records.push(record);
  }
  return records;
}

/** Appends one row, mapping an object to the sheet's header order. */
function appendRecord_(sheetName, record) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var row = headers.map(function (h) {
    return record.hasOwnProperty(h) ? record[h] : '';
  });
  sheet.appendRow(row);
  return row;
}

/** Header names for a sheet, trimmed. */
function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

/**
 * Index of a header name in a header array, or -1.
 * Used instead of hard-coded column letters so adding a column cannot silently
 * shift every read in the project.
 */
function colIndex_(headers, name) {
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === name) return i;
  }
  return -1;
}

/**
 * Writes headers into row 1, clearing anything to the right.
 *
 * Clearing the tail matters: if a column is renamed or removed, the old header
 * stays in its cell and a new one is appended, leaving an orphan column that
 * looks like a bug. Renaming `Total Available` to `Total Qty` did exactly that.
 */
function writeHeaders_(sheet, headers) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > headers.length) {
    sheet.getRange(1, headers.length + 1, 1, lastCol - headers.length).clearContent();
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

function isBlank_(v) {
  return v === '' || v === null || v === undefined;
}

/** Parses a number tolerantly; returns null when it is not a real number. */
function toNumber_(v) {
  if (isBlank_(v)) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var cleaned = String(v).replace(/[৳,\s]/g, '');
  var n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function round2_(n) {
  if (n === null || n === undefined || !isFinite(n)) return '';
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Dates — everything is normalised to a Date at midnight
// ---------------------------------------------------------------------------

/** Normalises any date-ish value to local midnight, or null. */
function toDate_(v) {
  if (isBlank_(v)) return null;
  var d;
  if (v instanceof Date) {
    d = new Date(v.getTime());
  } else if (typeof v === 'string') {
    var s = v.trim();

    // yyyy-mm-dd must be parsed EXPLICITLY as a local date.
    // `new Date('2026-11-18')` is parsed as UTC midnight by the language spec, so
    // in any timezone behind UTC it becomes the previous day — which silently
    // shifts a date by one when it is stored and read back.
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    } else {
      // Slash / dash dates, which can be written either day-first or month-first.
      // Sheets read back as text use the sheet's display format, and this workbook
      // stores them as M/D/YYYY ("10/17/2026"). Decide by which number can only be
      // a day: 17/10 must be day-first, 10/17 must be month-first. When both are
      // 12 or less the two readings are genuinely ambiguous, so follow the sheet
      // (month-first) rather than silently shifting the day.
      var slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (slash) {
        var a = Number(slash[1]);
        var b = Number(slash[2]);
        var year = Number(slash[3]);
        var month, day;

        if (a > 12 && b <= 12) {        // d/m/yyyy
          day = a; month = b;
        } else if (b > 12 && a <= 12) { // m/d/yyyy
          month = a; day = b;
        } else {                        // ambiguous → m/d/yyyy (sheet format)
          month = a; day = b;
        }
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(s);
      }
    }
  } else if (typeof v === 'number' && isFinite(v)) {
    // A cell formatted as a plain number still holds a date serial. Serial 0 is
    // 1899-12-30; whole (floored) days keep the timezone off the result.
    var utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    d = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** yyyy-MM-dd string for storage and logging. */
function dateKey_(v) {
  var d = toDate_(v);
  if (!d) return '';
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/** Whole days between two dates, inclusive. */
function daysBetweenInclusive_(start, end) {
  var a = toDate_(start), b = toDate_(end);
  if (!a || !b) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/** Every date from start to end inclusive. */
function dateRange_(start, end) {
  var out = [];
  var a = toDate_(start), b = toDate_(end);
  if (!a || !b || a > b) return out;
  var cur = new Date(a.getTime());
  while (cur <= b) {
    out.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unit conversion — README §6.1, D7 ruling
// ---------------------------------------------------------------------------

/**
 * Factor relating an entry quantity to the item's rate basis.
 * Amount = quantity / rateDivisor(unit) * rate.
 */
function rateDivisor_(unit) {
  var rule = UNIT_RULES[String(unit).trim()];
  if (!rule) throw new Error('Unsupported unit: ' + unit);
  return rule.rateDivisor;
}

/**
 * Factor converting an entry quantity into the item's base unit.
 * For piece-based items with a known weight, perPieceWeight is used (D8).
 */
function baseMultiplier_(unit, perPieceWeight) {
  var u = String(unit).trim();
  var rule = UNIT_RULES[u];
  if (!rule) throw new Error('Unsupported unit: ' + u);
  if (u === 'p' && perPieceWeight && isFinite(perPieceWeight)) {
    return Number(perPieceWeight);
  }
  return rule.baseMultiplier;
}

/** Money amount for a purchase line: quantity in `unit` at `rate`. */
function amountFor_(quantity, unit, rate) {
  var q = toNumber_(quantity), r = toNumber_(rate);
  if (q === null || r === null) return null;
  return round2_((q / rateDivisor_(unit)) * r);
}

/**
 * Price per BASE unit (gm / ml / p) from an entry rate.
 *
 * The rate is always per kg / per litre / per piece (D7), while base quantities
 * are gm / ml / p. This is the conversion that keeps valuation honest — get it
 * wrong and every value is out by 1000x, or by the per-piece weight.
 *
 * It lives here, next to the other unit conversions, because BOTH the migration
 * and the Stock valuation need it. Putting it in the Stock file made the
 * migration depend on a later phase, which is the wrong direction.
 */
function ratePerBaseUnit_(item, rate) {
  var r = toNumber_(rate);
  if (r === null) return 0;
  if (!item) return 0;

  var unit = item.unit;
  if (unit === 'kg' || unit === 'l') return r / 1000;   // per gm / per ml
  if (unit === 'p') {
    // A piece with a known weight (Nutella 350 gm, Whipped Cream 1000 gm) still
    // has its rate per PIECE, so dividing by the weight gives per-gram.
    if (item.perPieceWeight && item.perPieceWeight > 1) return r / item.perPieceWeight;
    return r;                                           // a true count
  }
  return r / 1000;                                      // gm/ml display, rate per kg
}

/** Rate per base unit, resolved from an item name. Used by migration. */
function ratePerBaseUnitForMigration_(itemName, rate) {
  return ratePerBaseUnit_(findItem_(itemName), rate);
}

/**
 * Inverse of ratePerBaseUnit_: turns a price per base unit back into a price per
 * ENTRY unit (per kg / per litre / per piece).
 *
 * Needed because the owner reads rates the way she buys things — "Flour is 80 per
 * kg", not "0.08 per gram" — while all internal maths runs on base units.
 */
function entryRateFromPerBase_(item, perBase) {
  var p = toNumber_(perBase);
  if (p === null || !item) return 0;

  var unit = item.unit;
  if (unit === 'kg' || unit === 'l') return p * 1000;
  if (unit === 'p') {
    if (item.perPieceWeight && item.perPieceWeight > 1) return p * item.perPieceWeight;
    return p;
  }
  return p * 1000;                                      // gm/ml display
}

/** Quantity expressed in the item's base unit. */
function toBaseQuantity_(quantity, unit, perPieceWeight) {
  var q = toNumber_(quantity);
  if (q === null) return null;
  return q * baseMultiplier_(unit, perPieceWeight);
}

/**
 * Converts a quantity from one unit to another for the SAME item.
 * Used when a purchase is entered in kg but the item is held in gm, etc.
 */
function convertQuantity_(quantity, fromUnit, toUnit, perPieceWeight) {
  var q = toNumber_(quantity);
  if (q === null) return null;
  var inBase = toBaseQuantity_(q, fromUnit, perPieceWeight);
  var targetRule = UNIT_RULES[String(toUnit).trim()];
  if (!targetRule) throw new Error('Unsupported unit: ' + toUnit);
  var targetMultiplier = String(toUnit).trim() === 'p'
    ? (perPieceWeight && isFinite(perPieceWeight) ? Number(perPieceWeight) : 1)
    : targetRule.baseMultiplier;
  return inBase / targetMultiplier;
}

/** The base unit string for an item's entry unit. */
function baseUnitFor_(unit, fallback) {
  var rule = UNIT_RULES[String(unit).trim()];
  if (!rule) return fallback || '';
  return rule.baseUnit;
}

// ---------------------------------------------------------------------------
// IDs and logging
// ---------------------------------------------------------------------------

/**
 * Stable record ID. README §2.7 — never rely on row numbers.
 * Format: prefix-<base36 time>-<random>, short and readable in a sheet.
 */
function newId_(prefix) {
  var stamp = Date.now().toString(36).toUpperCase();
  var rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase();
  while (rand.length < 3) rand = '0' + rand;
  return (prefix || 'REC') + '-' + stamp + '-' + rand;
}

/** Appends to the Script log sheet, creating it if needed. */
function logEvent_(kind, message, detail) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_Log');
  if (!sheet) {
    sheet = ss.insertSheet('_Log');
    writeHeaders_(sheet, ['Timestamp', 'Kind', 'Message', 'Detail']);
    sheet.hideSheet();
  }
  sheet.appendRow([new Date(), kind, message, detail || '']);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function toast_(message, title) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, title || 'Awwffle', 5);
}
