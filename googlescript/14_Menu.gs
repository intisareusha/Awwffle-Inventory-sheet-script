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
    'Opening cutoff: ' + (settings.opening_cutoff_date || '(not set)'),
    '',
    'This build is Phase 2: data model and configuration only.',
    'Bazar, batches, stock and POS entry arrive in later phases.'
  ];
  SpreadsheetApp.getUi().alert('Awwffle — system info', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
