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
  entry.addItem('Record POS snapshot', 'menuOpenPosForm');
  entry.addItem('Record a discount', 'menuOpenDiscountForm');
  entry.addItem('Record a due', 'menuOpenDueForm');
  entry.addItem('Record cash in hand', 'menuOpenCashInHandForm');
  entry.addItem('Record manual stock count', 'menuOpenManualStock');
  entry.addItem('Record a closed day', 'menuOpenClosedDays');
  menu.addSubMenu(entry);

  // Summaries — read-only views over the same source records.
  var summary = ui.createMenu('Summary');
  summary.addItem('Batches / Bazar / Stock…', 'menuOpenSummary');
  summary.addItem('Daily waffles / POS…', 'menuOpenPosForm');
  menu.addSubMenu(summary);

  menu.addSeparator();
  menu.addItem('Refresh stock view', 'menuRefreshStock');
  menu.addItem('Check stock valuation', 'menuVerifyStock');
  menu.addSeparator();

  // One-off maintenance. Idempotent, so leaving it here is harmless and lets the
  // owner re-apply a regroup after pasting updated files.
  menu.addItem('Apply item groups', 'menuApplyItemGroups');
  menu.addItem('Repair duplicate items', 'menuRepairDuplicateItems');
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

function menuOpenDiscountForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_Discount')
    .setTitle('Record a discount');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenDueForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_Due')
    .setTitle('Record a due');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenCashInHandForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_CashInHand')
    .setTitle('Record cash in hand');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenSummary() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_Summary')
    .setTitle('Summary');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenClosedDays() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_ClosedDays')
    .setTitle('Closed days');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenManualStock() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_ManualStock')
    .setTitle('Manual stock count');
  SpreadsheetApp.getUi().showSidebar(html);
}

function menuOpenPosForm() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar_POS')
    .setTitle('POS / Daily sales');
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

/**
 * Applies the item groups currently defined in code to the live ItemMaster sheet.
 *
 * Group is a label, so this changes no figure. It exists because setup never
 * rewrites an existing row, so a regroup in code would otherwise never reach a
 * sheet that is already in use.
 */
function menuApplyItemGroups() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'Apply item groups',
    'Sets the Group column from the item catalogue (Recipes, Toppings, ' +
    'Packaging, Equipments, Resale).\n\n' +
    'Only Group changes. No rate, unit, quantity or history is touched.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  var res = applyItemGroups_();

  if (!res.ok) {
    ui.alert('Apply item groups', res.message, ui.ButtonSet.OK);
    return;
  }

  var lines = [res.message, ''];
  if (res.changed.length) {
    res.changed.forEach(function (c) {
      lines.push('  ' + c.name + ': ' + (c.from || '(blank)') + ' -> ' + c.to);
    });
  }
  if (res.unknown.length) {
    lines.push('', 'Not in the item catalogue (left alone):');
    res.unknown.forEach(function (n) { lines.push('  ' + n); });
  }
  if (res.refresh && res.refresh.error) {
    lines.push('', 'Stock view refresh failed: ' + res.refresh.error);
  }

  ui.alert('Apply item groups', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Removes duplicate ItemMaster rows left behind by a rename.
 *
 * Shown as its own action because the duplicate is visible immediately in the Bazar
 * and Stock item dropdowns, and the owner should be able to clear it without
 * thinking about what else a full setup run does.
 */
function menuRepairDuplicateItems() {
  var ui = SpreadsheetApp.getUi();

  // Report before deleting, so the owner sees exactly what will go.
  var preview = cleanupDuplicateItemRowsPreview_();

  if (!preview.remove.length && !preview.suspicious.length) {
    ui.alert('Repair duplicate items',
      'No duplicate item rows found. Nothing to do.', ui.ButtonSet.OK);
    return;
  }

  var lines = [];
  if (preview.remove.length) {
    lines.push(preview.remove.length + ' duplicate row(s) to remove:', '');
    preview.remove.forEach(function (d) {
      lines.push('  ' + d.name + ' — row ' + d.row + ' (keeping row ' + d.keptRow + ')');
    });
    lines.push('', 'The kept row is the original one, with your rates and settings.',
      'No purchase, count or sales history is touched.', '');
  }
  if (preview.suspicious.length) {
    lines.push('Left alone — same name but not a rename duplicate:', '');
    preview.suspicious.forEach(function (d) {
      lines.push('  ' + d.name + ' — rows ' + d.keptRow + ' and ' + d.row);
    });
    lines.push('');
  }
  lines.push('Continue?');

  var answer = ui.alert('Repair duplicate items', lines.join('\n'), ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  var res = cleanupDuplicateItemRows_(ITEM_RENAMES);

  var msg = res.removed.length
    ? res.removed.length + ' duplicate row(s) removed.'
    : 'Nothing removed.';

  try { refreshStockSheet_(); } catch (e) {
    msg += '\n\nThe Stock view could not be refreshed: ' +
      (e && e.message ? e.message : String(e));
  }

  ui.alert('Repair duplicate items', msg, ui.ButtonSet.OK);
}

/** Dry run of cleanupDuplicateItemRows_, so a menu action can show it first. */
function cleanupDuplicateItemRowsPreview_() {
  var sheet = getSheet_(SHEETS.ITEM_MASTER);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { remove: [], suspicious: [] };

  var headers = getHeaders_(sheet);
  var nameCol = colIndex_(headers, 'Item Name');
  if (nameCol < 0) return { remove: [], suspicious: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var rows = [];
  values.forEach(function (row, i) {
    var name = String(row[nameCol] === null ? '' : row[nameCol]).trim();
    if (name) rows.push({ row: i + 2, name: name });
  });

  return planDuplicateItemRows_(rows, ITEM_RENAMES);
}
