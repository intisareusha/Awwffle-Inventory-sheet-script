/**
 * Awwffle Inventory System — 04_Setup.gs
 *
 * Creates and updates the spreadsheet structure.
 *
 * GUARANTEES (README §2.5, §2.6, §11, §13.H):
 *   - Never deletes or clears existing records.
 *   - Safe to run repeatedly: headers are written only when missing, and seeded
 *     values are never re-applied over something the owner has edited.
 *   - Adds missing sheets and missing columns; leaves extra columns alone.
 *
 * Run order for a first install:
 *   1. runSetup()
 *   2. (Phase 3) runMigration()
 */

/** Entry point from the menu. */
function runSetup() {
  var report = setupSpreadsheet_();
  toast_('Setup complete. ' + report.summary, 'Awwffle setup');
  return report;
}

/**
 * Performs the whole setup and returns a report of what was created or skipped.
 */
function setupSpreadsheet_() {
  var created = [];
  var skipped = [];
  var seeded = [];

  // 1. Config sheets first — everything else reads settings.
  var settings = ensureSettingsSheet_(created, skipped, seeded);

  // 2. Expense types
  ensureExpenseTypesSheet_(created, skipped, seeded);

  // 3. Item master
  ensureItemMasterSheet_(settings, created, skipped, seeded);

  // 4. All remaining source sheets, except those with dedicated handlers below
  //    (settings, expense types, item master, POS products).
  var handledSeparately = [
    SHEETS.SETTINGS, SHEETS.EXPENSE_TYPES, SHEETS.ITEM_MASTER, SHEETS.POS_PRODUCTS
  ];
  sourceSheetOrder_().forEach(function (name) {
    if (handledSeparately.indexOf(name) !== -1) return;
    ensureSheetWithHeaders_(name, headersFor_(name), created, skipped);
  });

  // 5. Measurements — seed the recipe matrix if empty
  seedMeasurements_(seeded);

  // 6. POS products
  ensurePosProducts_(settings, created, skipped, seeded);

  // 7. Seed the current price into PriceHistory so historic reports have a base
  seedPriceHistory_(seeded);

  // 8. View sheets (headers only — formulas arrive in later phases)
  ensureSheetWithHeaders_(SHEETS.STOCK, SCHEMA[SHEETS.STOCK], created, skipped);
  ensureSheetWithHeaders_(SHEETS.DAILY_WAFFLES, SCHEMA[SHEETS.DAILY_WAFFLES], created, skipped);
  ensureSheetWithHeaders_(SHEETS.ALL_TIME, SCHEMA[SHEETS.ALL_TIME], created, skipped);

  // 9. Protections
  applyProtections_();

  // 10. Menu
  installMenu_();

  // 11. Order the tabs so the owner sees them in a sensible sequence
  orderSheets_();

  var summary = [
    created.length + ' created',
    skipped.length + ' unchanged',
    seeded.length + ' seeded'
  ].join(', ');

  logEvent_('SETUP', 'Setup completed', summary);
  return { created: created, skipped: skipped, seeded: seeded, summary: summary };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Creates Settings and seeds any missing keys.
 * Existing values are NEVER overwritten — the owner may have edited them (§13.H).
 */
function ensureSettingsSheet_(created, skipped, seeded) {
  var existed = sheetExists_(SHEETS.SETTINGS);
  var sheet = getSheet_(SHEETS.SETTINGS);

  if (!existed) {
    writeHeaders_(sheet, SCHEMA[SHEETS.SETTINGS]);
    created.push(SHEETS.SETTINGS);
  } else {
    ensureHeadersPresent_(sheet, SCHEMA[SHEETS.SETTINGS]);
    skipped.push(SHEETS.SETTINGS);
  }

  var existing = {};
  readRecords_(SHEETS.SETTINGS).forEach(function (r) { existing[r.Setting] = r; });

  var toAppend = [];
  SETTINGS_SCHEMA.forEach(function (def) {
    if (existing.hasOwnProperty(def.key)) return;   // never overwrite
    toAppend.push([def.key, def.value, def.type, def.editable, def.note || '']);
  });

  if (toAppend.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, toAppend.length, SCHEMA[SHEETS.SETTINGS].length).setValues(toAppend);
    seeded.push(toAppend.length + ' settings');
  }

  // Waffles per batch live as settings so the owner owns them (§13.D30).
  var wpbExisting = readRecords_(SHEETS.SETTINGS).filter(function (r) {
    return String(r.Setting).indexOf('waffles_per_batch:') === 0;
  }).map(function (r) { return String(r.Setting); });

  var wpbRows = [];
  PREPARATIONS.forEach(function (prep) {
    var key = 'waffles_per_batch:' + prep;
    if (wpbExisting.indexOf(key) !== -1) return;
    wpbRows.push([key, WAFFLES_PER_BATCH_SEED[prep] || 0, 'number', true,
      'Observed seed. Cost per waffle = batch cost / this number.']);
  });
  if (wpbRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, wpbRows.length, SCHEMA[SHEETS.SETTINGS].length).setValues(wpbRows);
    seeded.push(wpbRows.length + ' waffles-per-batch');
  }

  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(5, 420);

  return readSettings_();
}

/** Reads Settings into a plain object { key: value }. */
function readSettings_() {
  var out = {};
  readRecords_(SHEETS.SETTINGS).forEach(function (r) {
    out[String(r.Setting)] = r.Value;
  });
  return out;
}

/** Typed lookup with a default. */
function settingsLookup_(settings, key, fallback) {
  if (!settings || !settings.hasOwnProperty(key)) return fallback;
  var v = settings[key];
  if (isBlank_(v)) return fallback;
  var n = toNumber_(v);
  return n === null ? v : n;
}

// ---------------------------------------------------------------------------
// Expense types
// ---------------------------------------------------------------------------

function ensureExpenseTypesSheet_(created, skipped, seeded) {
  var existed = sheetExists_(SHEETS.EXPENSE_TYPES);
  var sheet = getSheet_(SHEETS.EXPENSE_TYPES);

  if (!existed) {
    writeHeaders_(sheet, SCHEMA[SHEETS.EXPENSE_TYPES]);
    created.push(SHEETS.EXPENSE_TYPES);
  } else {
    ensureHeadersPresent_(sheet, SCHEMA[SHEETS.EXPENSE_TYPES]);
    skipped.push(SHEETS.EXPENSE_TYPES);
  }

  var existing = readRecords_(SHEETS.EXPENSE_TYPES).map(function (r) { return String(r['Expense Type']); });
  var rows = [];
  EXPENSE_TYPES.forEach(function (t) {
    if (existing.indexOf(t) !== -1) return;
    var affects = t === EXPENSE_TYPE_INVENTORY;
    var note = affects
      ? 'The only type that increases stock (§13.C18).'
      : 'Never touches stock.';
    rows.push([t, affects, true, note]);
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SCHEMA[SHEETS.EXPENSE_TYPES].length).setValues(rows);
    seeded.push(rows.length + ' expense types');
  }
}

// ---------------------------------------------------------------------------
// Item master
// ---------------------------------------------------------------------------

function ensureItemMasterSheet_(settings, created, skipped, seeded) {
  var existed = sheetExists_(SHEETS.ITEM_MASTER);
  var sheet = getSheet_(SHEETS.ITEM_MASTER);
  var headers = itemMasterHeaders_();

  if (!existed) {
    writeHeaders_(sheet, headers);
    created.push(SHEETS.ITEM_MASTER);
  } else {
    ensureHeadersPresent_(sheet, headers);
    skipped.push(SHEETS.ITEM_MASTER);
  }

  // Seed only items that are missing. An existing row is never touched, so a
  // renamed or re-rated item keeps the owner's values (§11).
  var existing = readRecords_(SHEETS.ITEM_MASTER).map(function (r) {
    return normaliseItemName_(r['Item Name']);
  });

  var toAppend = [];
  itemMasterRows_(settings).forEach(function (row) {
    var nameKey = normaliseItemName_(row[1]);
    if (existing.indexOf(nameKey) !== -1) return;
    row[0] = newId_('ITEM');
    toAppend.push(row);
  });

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
    seeded.push(toAppend.length + ' items');
  }

  // Presentation
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(16, 340);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).setVerticalAlignment('middle');
  }
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

/**
 * Seeds the fixed recipe matrix. Blanks stay blanks — they mean "not used in this
 * preparation" and must never become zeros (README §3.1).
 *
 * 'Empty Container' is deliberately absent: it has measurements but no Stock row,
 * so including it would create a permanent orphan in every total (§3.1, §9).
 */
function seedMeasurements_(seeded) {
  var sheet = getSheet_(SHEETS.MEASUREMENTS);

  // Handles both cases: an empty sheet gets full headers, an existing one only
  // gets any headers it is missing.
  ensureHeadersPresent_(sheet, SCHEMA[SHEETS.MEASUREMENTS]);

  if (sheet.getLastRow() > 1) return;   // already has data — never overwrite

  var rows = MEASUREMENTS_SEED.map(function (r) {
    return [r.ingredient, r.Batter, r['Nutella Mix'], r.Cream, r['White Mix'], r.Cheese];
  });
  sheet.getRange(2, 1, rows.length, SCHEMA[SHEETS.MEASUREMENTS].length).setValues(rows);
  seeded.push(rows.length + ' measurement rows');

  sheet.setColumnWidth(1, 190);
  sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
}

// ---------------------------------------------------------------------------
// POS products and price history
// ---------------------------------------------------------------------------

function ensurePosProducts_(settings, created, skipped, seeded) {
  var existed = sheetExists_(SHEETS.POS_PRODUCTS);
  var sheet = getSheet_(SHEETS.POS_PRODUCTS);

  if (!existed) {
    writeHeaders_(sheet, SCHEMA[SHEETS.POS_PRODUCTS]);
    created.push(SHEETS.POS_PRODUCTS);
  } else {
    ensureHeadersPresent_(sheet, SCHEMA[SHEETS.POS_PRODUCTS]);
    skipped.push(SHEETS.POS_PRODUCTS);
  }

  var baseline = settingsLookup_(settings, 'pos_baseline', 10000);
  var existing = readRecords_(SHEETS.POS_PRODUCTS).map(function (r) { return String(r['Product Name']); });

  var rows = posProductRows_(baseline).filter(function (row) {
    return existing.indexOf(row[1]) === -1;   // never overwrite an existing product
  });
  if (rows.length) {
    rows.forEach(function (row) { row[0] = newId_('PROD'); });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, SCHEMA[SHEETS.POS_PRODUCTS].length).setValues(rows);
    seeded.push(rows.length + ' POS products');
  }

  sheet.setColumnWidth(2, 200);
}

/** Seeds one PriceHistory row per product so historic profit has a starting point. */
function seedPriceHistory_(seeded) {
  var sheet = getSheet_(SHEETS.PRICE_HISTORY);
  if (sheet.getLastRow() > 1) return;

  var cutoff = readSettings_()['opening_cutoff_date'] || '2026-10-09';
  var effective = toDate_(cutoff);
  var rows = POS_PRODUCTS.map(function (p) {
    return [p.name, effective, p.cost, p.sale, new Date(),
      'Seed from the source workbook (Phase 2).'];
  });
  sheet.getRange(2, 1, rows.length, SCHEMA[SHEETS.PRICE_HISTORY].length).setValues(rows);
  seeded.push(rows.length + ' price rows');
  sheet.getRange(2, 2, rows.length, 1).setNumberFormat('yyyy-mm-dd');
}

// ---------------------------------------------------------------------------
// Structure helpers
// ---------------------------------------------------------------------------

/**
 * Creates a sheet with headers if missing; otherwise adds only missing headers.
 * Never clears existing data.
 */
function ensureSheetWithHeaders_(name, headers, created, skipped) {
  var existed = sheetExists_(name);
  var sheet = getSheet_(name);

  if (!existed) {
    writeHeaders_(sheet, headers);
    created.push(name);
  } else {
    ensureHeadersPresent_(sheet, headers);
    skipped.push(name);
  }
  return sheet;
}

/**
 * Appends any header in `required` that the sheet does not already have.
 * Existing columns keep their position, so no data is displaced.
 */
function ensureHeadersPresent_(sheet, required) {
  var lastCol = sheet.getLastColumn();
  var current = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];

  var missing = required.filter(function (h) { return current.indexOf(h) === -1; });
  if (!missing.length) return false;

  var startCol = Math.max(lastCol, 1);
  if (current.length === 0) {
    writeHeaders_(sheet, required);
    return true;
  }
  sheet.getRange(1, startCol + 1, 1, missing.length).setValues([missing]);
  sheet.getRange(1, 1, 1, startCol + missing.length).setFontWeight('bold');
  return true;
}

/**
 * Protects the recipe sheet so a mis-keyed daily entry cannot corrupt the fixed
 * measurements (README §3.1).
 *
 * The owner keeps edit access deliberately: §13.E35 says only the owner may edit
 * recipes, and §3.1 allows an intentional recipe-maintenance action. So this is a
 * guard against accidental edits, not a lock. Removing all editors would lock the
 * owner out of their own sheet.
 */
function applyProtections_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PROTECTED_SHEETS.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length) return;   // already protected; never stack protections

    var p = sheet.protect()
      .setDescription('Recipe data. Fixed during daily operations — edit only for intentional recipe maintenance.');

    // Only meaningful for consumer accounts with multiple editors; leave the
    // owner (and any script editors) in place.
    try {
      if (p.canDomainEdit()) p.setDomainEdit(false);
    } catch (e) {
      // Domain protection is unavailable on consumer accounts — ignore.
    }
  });
}

/** Orders tabs so source sheets appear before view sheets. */
function orderSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var desired = sourceSheetOrder_()
    .concat([SHEETS.STOCK, SHEETS.DAILY_WAFFLES, SHEETS.ALL_TIME]);

  desired.forEach(function (name, i) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(i + 1);
  });
}
