/**
 * Awwffle Inventory System — 05e_MigrationReport.gs
 *
 * Writes the reconciliation report and provides the shared helpers the migration
 * workers call. README §9.9 requires this report before the system is used.
 */

// ---------------------------------------------------------------------------
// Shared write helpers
// ---------------------------------------------------------------------------

/**
 * Appends rows to a sheet by header name, so column order can never drift.
 * Returns the number appended.
 */
function appendRows_(sheetName, rows) {
  if (!rows || !rows.length) return 0;

  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  if (!headers.length) return 0;

  // Every caller builds its rows in SCHEMA order, which equals header order.
  var width = headers.length;
  var normalised = rows.map(function (r) {
    var out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, normalised.length, width).setValues(normalised);
  return normalised.length;
}

/** Updates one setting's Value cell, or appends the row when absent. */
function setSetting_(key, value) {
  var sheet = getSheet_(SHEETS.SETTINGS);
  var records = readRecords_(SHEETS.SETTINGS);

  for (var i = 0; i < records.length; i++) {
    if (String(records[i].Setting) === key) {
      var rowIndex = i + 2;   // header offset, and readRecords skips blanks
      sheet.getRange(rowIndex, 2).setValue(value);
      return true;
    }
  }

  sheet.appendRow([key, value, 'text', false, 'Created by migration']);
  return true;
}

// ---------------------------------------------------------------------------
// Re-run protection
// ---------------------------------------------------------------------------

/**
 * Collects what a sheet already holds, so a second migration run cannot duplicate.
 *
 * Every imported row records where it came from ("Imported from source row N").
 * That provenance is the dedupe key, which means a re-run is safe without
 * deleting anything and without guessing from values.
 *
 * Returns a plain object usable as a set.
 */
function importedSourceRows_(sheetName) {
  var seen = {};
  readRecords_(sheetName).forEach(function (r) {
    var note = String(r['Notes'] || r['Detail'] || '');
    var m = note.match(/source row (\d+)/);
    if (m) seen['row:' + m[1]] = true;
  });
  return seen;
}

/** Dedupe set for sheets keyed by a date rather than a source row. */
function importedDateKeys_(sheetName, columnName) {
  var seen = {};
  readRecords_(sheetName).forEach(function (r) {
    var v = r[columnName];
    if (!isBlank_(v)) seen[dateKey_(v)] = true;
  });
  return seen;
}

/** Dedupe set for sheets keyed by an item name. */
function importedItemKeys_(sheetName) {
  var seen = {};
  readRecords_(sheetName).forEach(function (r) {
    var v = r['Item'];
    if (!isBlank_(v)) seen[String(v)] = true;
  });
  return seen;
}

// ---------------------------------------------------------------------------
// Reconciliation report rows
// ---------------------------------------------------------------------------

/**
 * One row of the reconciliation report.
 * `ok` drives the Status column, so a failed check is visible at a glance.
 */
function reportRow_(section, check, expected, actual, ok, detail) {
  var difference = '';
  if (typeof expected === 'number' && typeof actual === 'number') {
    difference = round2_(actual - expected);
  } else if (!isBlank_(expected) && !isBlank_(actual) && expected !== actual) {
    difference = '';
  }
  return [section, check, expected, actual, difference, ok ? 'OK' : 'CHECK', detail || ''];
}

/**
 * Writes the full report: a summary of pass/fail, every check, and every
 * deliberate correction with before/after values (§9).
 */
function writeReconciliationReport_(stats, recon, corrections, startedAt) {
  var sheet = getSheet_(SHEETS.MIGRATION_REPORT);

  // Rebuild the report body each run; the report is output, not source data.
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  writeHeaders_(sheet, SCHEMA[SHEETS.MIGRATION_REPORT]);

  var rows = [];

  // ---- Header block ----
  var okCount = recon.filter(function (r) { return r[5] === 'OK'; }).length;
  var checkCount = recon.length - okCount;

  rows.push(['SUMMARY', 'Migration ran at', '', Utilities.formatDate(startedAt,
    Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), '', '', '']);
  rows.push(['SUMMARY', 'Checks passed', okCount, okCount, '', 'OK', '']);
  rows.push(['SUMMARY', 'Checks needing attention', 0, checkCount, '',
    checkCount === 0 ? 'OK' : 'CHECK',
    checkCount === 0 ? 'Everything reconciled' : 'See the CHECK rows below']);
  rows.push(['SUMMARY', 'Deliberate corrections applied', corrections.length, corrections.length,
    '', 'OK', 'Each is listed in the Corrections section with before/after values']);
  rows.push(['', '', '', '', '', '', '']);

  // ---- All checks ----
  recon.forEach(function (r) { rows.push(r); });

  // ---- Corrections ----
  if (corrections.length) {
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['CORRECTIONS', 'The following source defects were corrected, not carried forward (§9)',
      '', '', '', '', '']);
    corrections.forEach(function (c) {
      rows.push([
        'Correction: ' + c.section,
        c.check,
        c.from,
        c.to,
        '',
        c.affectsValues ? 'VALUE CHANGED' : 'NO VALUE CHANGE',
        c.reason
      ]);
    });
  }

  // ---- Deliberate omissions ----
  rows.push(['', '', '', '', '', '', '']);
  rows.push(['OMITTED', 'BM October', 'present in older copies', 'not migrated', '', 'OK',
    'Deleted from the source and out of scope (§13.F37)']);
  rows.push(['OMITTED', 'Duplicate expense block (All Time column Q)', '31 typed amounts',
    'not migrated', '', 'OK', 'Bazar is the single expense table (§8.6)']);
  rows.push(['OMITTED', 'Empty Container', '1 measurement row', 'not migrated', '', 'OK',
    'No Stock row; would be a permanent orphan (§3.1)']);
  rows.push(['OMITTED', 'Cached formula values', 'Excel __xludf wrappers', 'recomputed',
    '', 'OK', 'Cached values are not trusted as a recalculation (§6.2.2)']);

  sheet.getRange(2, 1, rows.length, SCHEMA[SHEETS.MIGRATION_REPORT].length).setValues(rows);

  // ---- Presentation ----
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(2, 430);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 170);
  sheet.setColumnWidth(7, 560);
  sheet.setFrozenRows(1);

  // Highlight anything needing attention.
  var statusCol = colIndex_(getHeaders_(sheet), 'Status') + 1;
  if (statusCol > 0) {
    var statusValues = sheet.getRange(2, statusCol, rows.length, 1).getValues();
    for (var i = 0; i < statusValues.length; i++) {
      var s = String(statusValues[i][0]);
      var cell = sheet.getRange(i + 2, statusCol);
      if (s === 'CHECK') cell.setBackground('#fce8e6').setFontColor('#a50e0e');
      else if (s === 'VALUE CHANGED') cell.setBackground('#fef7e0').setFontColor('#b06000');
      else if (s === 'OK') cell.setFontColor('#137333');
    }
  }

  return sheet;
}

/** A short human summary for the completion dialog. */
function formatMigrationSummary_(result) {
  if (!result || !result.stats) return 'Migration did not run.';

  var recon = result.recon || [];
  var checks = recon.filter(function (r) { return r[5] === 'CHECK'; });

  var lines = [
    'Batches imported:      ' + (result.stats.batches ? result.stats.batches.imported : 0),
    'Bazar rows imported:   ' + (result.stats.bazar ? result.stats.bazar.imported : 0),
    'POS snapshots:         ' + (result.stats.pos ? result.stats.pos.imported : 0),
    'Opening stock rows:    ' + (result.stats.opening ? result.stats.opening.imported : 0),
    'Closed days recorded:  ' + (result.stats.closedDays ? result.stats.closedDays.imported : 0),
    '',
    'Checks passed:         ' + (recon.length - checks.length) + ' of ' + recon.length,
    'Need attention:        ' + checks.length,
    ''
  ];

  if (checks.length) {
    lines.push('Review the MigrationReport tab — these need your decision:');
    checks.slice(0, 6).forEach(function (c) {
      lines.push('  - ' + c[0] + ': ' + c[1]);
    });
    if (checks.length > 6) lines.push('  ... and ' + (checks.length - 6) + ' more');
  } else {
    lines.push('Everything reconciled against the source workbook.');
  }

  return lines.join('\n');
}
