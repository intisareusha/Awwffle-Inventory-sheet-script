/**
 * Awwffle Inventory System — 05_Migration.gs
 *
 * Phase 3 — imports the historical workbook into the new structure.
 *
 * SOURCE: a separate Google Sheets file in Drive, named by the
 * `migration_source_name` setting. It cannot live in this spreadsheet because its
 * tab names (Batches, Bazar, Measurements, Stock, ...) collide with the new ones.
 * The source file is opened read-only and never written to.
 *
 * Design rules (README §9, §11):
 *   - Source values are preserved. Where a known defect is corrected, the
 *     correction is LOGGED individually with before/after values.
 *   - Nothing is silently normalised, renamed, reordered or deduplicated.
 *   - A migration guard prevents an accidental second run.
 *   - A reconciliation report compares source totals to imported totals.
 */

/**
 * Known defects to correct during import — README §9.
 * Each correction is logged with before/after values, never applied silently.
 */
var CORRECTIONS = {
  // Bazar row 73 records Milk as 6 pieces; every other milk purchase is in litres.
  MILK_ROW: 73,
  MILK_FROM_UNIT: 'p',
  MILK_TO_UNIT: 'l',

  // The 10 October setup purchase. The owner corrected its quantity to 25 L by
  // hand, so a re-run must never add a second (or stale) Milk line on that date.
  MILK_SETUP_DATE: '2026-10-10'
};

/** Expected totals — README §14. Migration must reproduce these. */
var EXPECTED = {
  bazarRows: 72,
  bazarOctober: 53890,
  bazarNovember: 39050,
  bazarAllTime: 92940,
  batchRecords: 30,
  snapshotDays: 28,
  wafflesSold: 831,
  extrasSold: 25,
  originalSale: 104940,
  posCost: 54094,
  cashInHand: 65770,
  openDays: 28,
  stockItems: 43,
  measurementRows: 17,
  usedCost: 48752.85,
  stockValue: 98956.50
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function runMigration() {
  var ui = SpreadsheetApp.getUi();
  var settings = readSettings_();

  if (settings.migration_completed_at) {
    var again = ui.alert(
      'Migration already run',
      'This workbook was already migrated on ' + settings.migration_completed_at + '.\n\n' +
      'Running again will import duplicates.\n\n' +
      'To re-run deliberately: blank "migration_completed_at" in Settings and delete ' +
      'the imported rows first.\n\nContinue anyway?',
      ui.ButtonSet.YES_NO
    );
    if (again !== ui.Button.YES) return { cancelled: true };
  }

  var source;
  try {
    source = openSourceSpreadsheet_(settings);
  } catch (err) {
    ui.alert('Source workbook not found', err.message, ui.ButtonSet.OK);
    return { error: err.message };
  }

  var result = migrateFromWorkbook_(source);
  ui.alert('Migration complete', formatMigrationSummary_(result), ui.ButtonSet.OK);
  return result;
}

/**
 * Opens the source workbook. Prefers an explicit ID, then a name lookup.
 * Throws a message the owner can act on.
 */
function openSourceSpreadsheet_(settings) {
  var id = settings.migration_source_id;
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw new Error('Could not open the spreadsheet with ID "' + id + '".\n\n' + e.message);
    }
  }

  var name = settings.migration_source_name || 'Current Blueprint';
  var files = DriveApp.getFilesByName(name);
  if (!files.hasNext()) {
    throw new Error(
      'Could not find a Google Sheets file named "' + name + '" in your Drive.\n\n' +
      'How to fix this:\n' +
      '1. Upload Current Blueprint.xlsx to Google Drive.\n' +
      '2. Right-click it in Drive and choose "Open with > Google Sheets".\n' +
      '   That creates a Google Sheet copy. Keep the name "' + name + '".\n' +
      '3. Close the extra copy of the xlsx if Drive made one — only the\n' +
      '   Google Sheet copy is read.\n\n' +
      'Alternatively, paste its ID into the "migration_source_id" setting.'
    );
  }

  var file = files.next();
  if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
    throw new Error(
      'Found "' + name + '" but it is not a Google Sheet.\n\n' +
      'Open it in Drive with "Open with > Google Sheets" to create a Sheet copy, ' +
      'then run migration again.'
    );
  }
  return SpreadsheetApp.openById(file.getId());
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function migrateFromWorkbook_(source) {
  var startedAt = new Date();
  var recon = [];
  var corrections = [];
  var stats = {};

  // Read the source tabs once, up front, so a missing tab fails fast and clearly.
  var src = {
    batches: requireSourceSheet_(source, 'Batches'),
    bazar: requireSourceSheet_(source, 'Bazar'),
    stock: requireSourceSheet_(source, 'Stock'),
    daily: requireSourceSheet_(source, 'Daily Waffles'),
    allTime: requireSourceSheet_(source, 'All Time'),
    october: requireSourceSheet_(source, 'October'),
    november: requireSourceSheet_(source, 'November'),
    measurements: requireSourceSheet_(source, 'Measurements')
  };

  // 1. Batches
  stats.batches = migrateBatches_(src.batches, recon, corrections);

  // 2. Bazar — purchases, aliases, expense types, the Milk correction
  stats.bazar = migrateBazar_(src.bazar, recon, corrections);

  // 3. POS snapshots — 28 days x 18 products
  stats.pos = migratePosSnapshots_(src.daily, recon, corrections);

  // 4. Invoice + discount/due monthly aggregates (no daily history exists)
  stats.aggregates = migrateMonthlyAggregates_(src, recon, corrections);

  // 5. Closed days — the dates inside the POS span with no snapshot
  stats.closedDays = migrateClosedDays_(stats.pos, recon, corrections);

  // 6. Opening stock snapshot as of the cut-off date (§6.3)
  stats.opening = migrateOpeningStock_(src.stock, stats.bazar, recon, corrections);

  // 7. Manual historical usage (toppings/packaging) as dated adjustments.
  //    Without this the 25 manual items would each show far too much stock,
  //    because their usage never existed anywhere except the old Stock column.
  stats.manualUsage = migrateManualUsage_(src.stock, stats.bazar, recon, corrections);

  // 8. Cross-checks against the source report sheets
  stats.checks = verifyAgainstSourceReports_(src, stats, recon, corrections);

  // 9. Write the report
  writeReconciliationReport_(stats, recon, corrections, startedAt);

  // 10. Set the guard
  setSetting_('migration_completed_at', Utilities.formatDate(startedAt,
    Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));

  logEvent_('MIGRATION', 'Historical migration completed', JSON.stringify({
    batches: stats.batches.imported,
    bazar: stats.bazar.imported,
    snapshots: stats.pos.imported
  }));

  return { stats: stats, recon: recon, corrections: corrections, startedAt: startedAt };
}

/** Fetches a source tab, throwing a clear message when it is missing. */
function requireSourceSheet_(source, name) {
  var sheet = source.getSheetByName(name);
  if (!sheet) {
    throw new Error(
      'The source workbook has no tab named "' + name + '".\n\n' +
      'Found tabs: ' + source.getSheets().map(function (s) { return s.getName(); }).join(', ')
    );
  }
  return sheet;
}

/** Reads a whole sheet as objects keyed by its header row. */
function readSourceRecords_(sheet, headerRow) {
  var hRow = headerRow || 1;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < hRow + 1) return [];

  var values = sheet.getRange(hRow, 1, lastRow - hRow + 1, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return isBlank_(c); })) continue;
    var obj = { _row: hRow + r };
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}
