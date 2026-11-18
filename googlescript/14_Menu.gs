/**
 * Awwffle Inventory System — 14_Menu.gs
 *
 * The onOpen menu. One place that exposes every action to the owner.
 * `onOpen` must stay trivial — Apps Script only allows light work there.
 */

function onOpen() {
  installMenu_();
}

function installMenu_() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Awwffle');

  menu.addItem('Setup / Update structure', 'menuRunSetup');
  menu.addSeparator();

  // Daily entry — each opens a labelled form, not a raw row (§13.E33).
  var entry = ui.createMenu('Daily entry');
  entry.addItem('Record a purchase (Bazar)', 'menuOpenBazarForm');
  entry.addItem('Record daily batches', 'menuOpenBatchForm');
  menu.addSubMenu(entry);

  menu.addSeparator();
  menu.addItem('Refresh stock view', 'menuRefreshStock');
  menu.addItem('Rebuild opening stock', 'menuRebuildOpeningStock');
  menu.addItem('Check stock valuation', 'menuVerifyStock');
  menu.addSeparator();
  menu.addItem('Import historical data', 'menuRunMigration');
  menu.addItem('Open migration report', 'menuOpenMigrationReport');
  menu.addSeparator();

  // Later phases add their entries here. Items are added as each phase lands so
  // the menu never offers something that does not work yet.
  menu.addItem('System info', 'menuShowSystemInfo');

  menu.addToUi();
}

function menuRunSetup() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Setup / update structure',
    'This creates missing sheets, columns, settings and seeded values.\n\n' +
    'It never deletes or overwrites existing records.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;
  runSetup();
}

function menuRunMigration() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Import historical data',
    'This reads the old workbook from Drive and imports its history into this sheet.\n\n' +
    'The source file is never modified. A reconciliation report is written so you ' +
    'can check every imported figure.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;
  runMigration();
}

function menuOpenMigrationReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MIGRATION_REPORT);
  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('Migration report',
      'No report yet. Run "Import historical data" first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  ss.setActiveSheet(sheet);
}

function menuShowSystemInfo() {
  var settings = readSettings_();
  var lines = [
    'Business: ' + (settings.business_name || '(not set)'),
    'Items: ' + readRecords_(SHEETS.ITEM_MASTER).length,
    'POS products: ' + readRecords_(SHEETS.POS_PRODUCTS).length,
    'Bazar lines: ' + readRecords_(SHEETS.BAZAR).length,
    'Opening cutoff: ' + (settings.opening_cutoff_date || '(not set)'),
    '',
    'This build covers Phase 4: purchasing entry.',
    'Batches, stock calculation and POS entry arrive in later phases.'
  ];
  SpreadsheetApp.getUi().alert('Awwffle — system info', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// Daily entry
// ---------------------------------------------------------------------------

function menuOpenBazarForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_Bazar')
    .setTitle('Record a purchase');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenBatchForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_Batches')
    .setTitle('Daily batches');
  SpreadsheetApp.getUi().showSidebar(html);
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

function menuRefreshStock() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Refresh stock view',
    'Rebuilds the Stock tab from purchases, batches and adjustments.\n\n' +
    'The Stock tab is a calculated view — nothing you type there is kept.',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;

  var res = refreshStockSheet_();
  toast_(res.written + ' items valued.', 'Stock refreshed');
}

function menuRebuildOpeningStock() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Rebuild opening stock',
    'Recomputes the OpeningStock tab from the purchases currently in Bazar.\n\n' +
    'Opening stock = everything bought on or before the cut-off date (10 Oct),\n' +
    'plus stock that was never purchased (Waffle Box, Waffle Tray).\n\n' +
    'Use this after correcting a Bazar row. Safe to run repeatedly.',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer !== ui.Button.OK) return;

  var res = rebuildOpeningStock_();

  var msg = res.itemsWithOpening + ' items with opening stock, total ' +
    res.totalOpeningValue + ' BDT (cut-off ' + res.cutOff + ').';

  if (res.duplicates && res.duplicates.length) {
    msg += '\n\nWARNING — the same item is recorded more than once on one day:';
    res.duplicates.slice(0, 6).forEach(function (d) {
      msg += '\n  ' + d.item + ' on ' + d.date + ': ' +
             d.quantities.join(' + ') + ' ' + d.unit +
             (d.identical ? ' (identical)' : ' (different amounts)');
    });
    if (res.duplicates.length > 6) {
      msg += '\n  ... and ' + (res.duplicates.length - 6) + ' more';
    }
    msg += '\n\nThis inflates stock. If it was a correction, open the Bazar form ' +
           'on that date and delete the extra line, then rebuild again.';
  }

  // An alert, not a toast: a duplicate warning must not disappear in 5 seconds.
  ui.alert('Opening stock rebuilt', msg, ui.ButtonSet.OK);
}

function menuVerifyStock() {
  var check = verifyValuationIdentity_();
  var ui = SpreadsheetApp.getUi();

  var lines = [
    'Items valued: ' + check.rows,
    '',
    'Used cost + remaining value must equal what the stock is worth.',
    'Available value: ' + round2_(check.totals.availableValue) + ' BDT'
  ];

  if (check.ok) {
    lines.push('', 'Every item reconciles. No gaps.');
    ui.alert('Stock valuation — OK', lines.join('\n'), ui.ButtonSet.OK);
    return;
  }

  lines.push('', check.failures.length + ' item(s) do NOT reconcile:');
  check.failures.slice(0, 8).forEach(function (f) {
    lines.push('  ' + f.item + ': gap ' + f.difference + ' BDT');
  });
  if (check.failures.length > 8) {
    lines.push('  ... and ' + (check.failures.length - 8) + ' more');
  }
  ui.alert('Stock valuation — PROBLEM', lines.join('\n'), ui.ButtonSet.OK);
}
