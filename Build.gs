/**
 * Awwffle — Business Management Workbook
 * File: Build.gs
 * Purpose: builds every sheet, writes the seeded history, and installs formulas.
 *
 * Formula policy: SUMIFS / COUNTIFS / SUMPRODUCT / INDEX-MATCH / IF / IFERROR only — all of
 * these behave identically in Google Sheets and Excel, and survive .xlsx export.
 */

var HEADER_ROW = 2;
var DATA_ROW   = 3;

/** Wipe the workbook down to one sheet, renamed to START HERE. */
function prepareWorkbook() {
  var ss = SS();
  var all = ss.getSheets();
  var keep = all[0];
  for (var i = 1; i < all.length; i++) ss.deleteSheet(all[i]);
  keep.setName(SH.README);
  return keep;
}

function buildAll() {
  prepareWorkbook();

  // Build in dependency order so every referenced sheet already exists when
  // formulas are written (a formula written before its target sheet exists can
  // bake in a #REF!). Tabs are reordered to the logical order afterwards.
  buildReadme();
  buildLists();
  buildItemMaster();
  buildProductMaster();
  buildPosRaw();
  buildSalesLog();
  buildConversions();   // before Purchases (Purchases looks up conversion factors)
  buildProduction();
  buildRecipes();
  buildPurchases();
  buildExpenses();      // before Daily Finance
  buildDailyFinance();  // references Purchases + Expense Log
  buildPeriod();        // references Daily Finance
  buildInventory();     // references Purchases + Recipes
  buildPackaging();     // references Purchases
  buildStocktake();
  buildDashExec();
  buildDashProduct();
  buildDashInventory();
  buildDashFinance();
  buildReports();
  buildReconciliation();

  reorderTabs();
  SS().setActiveSheet(SS().getSheetByName(SH.README));
}

/** Arrange tabs in the documented logical order. */
function reorderTabs() {
  var ss = SS();
  for (var i = 0; i < SHEET_ORDER.length; i++) {
    var sh = ss.getSheetByName(SHEET_ORDER[i]);
    if (sh) {
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    }
  }
}

/* ============================== START HERE ================================= */
function buildReadme() {
  var sheet = resetSheet(SH.README);
  writeTitle(sheet, 'AWWFFLE — Business Management Workbook  (v' + AWWFFLE_VERSION + ')', 2);
  var lines = [
    ['', ''],
    ['WHAT THIS IS', 'One workbook that tracks sales, production, recipes, purchases, inventory,'],
    ['', 'expenses, cash and profit for the Awwffle waffle shop.'],
    ['', ''],
    ['HOW TO USE IT DAILY', ''],
    ['1. Import POS', 'Paste today\'s POS stock report into the "POS Raw Data" sheet (append, never overwrite).'],
    ['2. Daily figures', 'On "Daily Finance", enter invoice count, discount, due, and confirm the daily sale.'],
    ['3. Production', 'On "Production Log", enter the batches prepared today (numeric columns).'],
    ['4. Purchases', 'On "Purchases", add each bazar item bought (one row per item).'],
    ['5. Expenses', 'On "Expense Log", add salary / electricity / maintenance / other.'],
    ['6. Review', 'Open the dashboards — they update automatically.'],
    ['', ''],
    ['COLOUR KEY', 'Cream cells = you type here.   Blue cells = calculated, do not edit.'],
    ['', 'Immutable source data (POS snapshots, period summary) must never be overwritten.'],
    ['', ''],
    ['UNITS', 'Weight is tracked in grams (g); countable items in pieces (pcs).'],
    ['', 'Litres are converted at the owner-approved 1 L = 1,000 g. Jars and packs'],
    ['', 'stay unconverted until their pack weight is confirmed (see "Unit Conversions").'],
    ['', ''],
    ['ONE NAME PER ITEM', 'Add new products/ingredients to "Item Master" or "Product Master" first.'],
    ['', 'Every other sheet reads from those masters, so dashboards never need rebuilding.'],
    ['', ''],
    ['KNOWN LIMITS', 'See the "Reconciliation" sheet — it lists every figure still needing confirmation.'],
    ['', 'No number is ever invented: missing values show a clear status instead.']
  ];
  fill(sheet, 3, 1, lines);
  sheet.getRange(3, 1, lines.length, 1).setFontWeight('bold');
  sheet.getRange(2, 1, lines.length + 1, 2).setVerticalAlignment('top');
  setWidths(sheet, [[1, 220], [2, 620]]);
  sheet.getRange(2, 1, lines.length + 1, 2).setWrap(true);
}

/* ================================ LISTS =================================== */
function buildLists() {
  var sheet = resetSheet(SH.LISTS);
  writeTitle(sheet, 'LISTS / SETTINGS — controlled vocabularies that feed every dropdown', 8);
  writeHeader(sheet, HEADER_ROW, ['Item Categories', 'Product Categories', 'Batch Types',
    'Expense Categories', 'Payment Methods', 'Status', 'Company', 'Version']);
  var maxLen = Math.max(ITEM_CATEGORIES.length, PRODUCT_CATEGORIES.length, BATCH_TYPES.length,
    EXPENSE_CATEGORIES.length, PAYMENT_METHODS.length, STATUS_LIST.length, 1);
  var rows = [];
  for (var i = 0; i < maxLen; i++) {
    rows.push([
      ITEM_CATEGORIES[i] || '', PRODUCT_CATEGORIES[i] || '', BATCH_TYPES[i] || '',
      EXPENSE_CATEGORIES[i] || '', PAYMENT_METHODS[i] || '', STATUS_LIST[i] || '',
      i === 0 ? 'Awwffle' : '', i === 0 ? AWWFFLE_VERSION : ''
    ]);
  }
  fill(sheet, DATA_ROW, 1, rows);
  for (var c = 1; c <= 8; c++) sheet.setColumnWidth(c, 150);

  addNamedRange('ItemCategoryList', SH.LISTS, 'A' + DATA_ROW + ':A' + (DATA_ROW + maxLen - 1));
  addNamedRange('ProductCategoryList', SH.LISTS, 'B' + DATA_ROW + ':B' + (DATA_ROW + maxLen - 1));
  addNamedRange('BatchTypeList', SH.LISTS, 'C' + DATA_ROW + ':C' + (DATA_ROW + maxLen - 1));
  addNamedRange('ExpenseCategoryList', SH.LISTS, 'D' + DATA_ROW + ':D' + (DATA_ROW + maxLen - 1));
  addNamedRange('PaymentMethodList', SH.LISTS, 'E' + DATA_ROW + ':E' + (DATA_ROW + maxLen - 1));
  addNamedRange('StatusList', SH.LISTS, 'F' + DATA_ROW + ':F' + (DATA_ROW + maxLen - 1));
}

/* ============================== ITEM MASTER ================================ */
function buildItemMaster() {
  var sheet = resetSheet(SH.ITEM_MASTER);
  writeTitle(sheet, 'ITEM MASTER — one canonical name and base unit per item', 8);
  writeHeader(sheet, HEADER_ROW, ['Item ID', 'Item Name (canonical)', 'Category', 'Base Unit',
    'Reorder Level', 'Last Purchase Date', 'Status', 'Notes']);
  var rows = ITEMS.map(function (it) {
    return [it.id, it.name, it.cat, it.unit, STATUS.NOT_SUPPLIED, '', 'Active', ''];
  });
  fill(sheet, DATA_ROW, 1, rows);
  addListValidation(sheet, DATA_ROW, 3, ITEMS.length, ITEM_CATEGORIES);
  addListValidation(sheet, DATA_ROW, 7, ITEMS.length, STATUS_LIST);
  setWidths(sheet, [[1, 90], [2, 220], [3, 170], [4, 80], [5, 120], [6, 130], [7, 80], [8, 220]]);
  freeze(sheet, HEADER_ROW, 0);
  var n = ITEMS.length;
  addNamedRange('ItemNames', SH.ITEM_MASTER, 'B' + DATA_ROW + ':B' + (DATA_ROW + n - 1));
  addNamedRange('ItemUnits', SH.ITEM_MASTER, 'D' + DATA_ROW + ':D' + (DATA_ROW + n - 1));
}

/* ============================ PRODUCT MASTER =============================== */
function buildProductMaster() {
  var sheet = resetSheet(SH.PRODUCT_MASTER);
  writeTitle(sheet, 'PRODUCT MASTER — POS products, unit costs and selling prices', 8);
  writeHeader(sheet, HEADER_ROW, ['POS No', 'Product ID', 'Product Name', 'Category',
    'Unit Cost', 'Selling Price', 'Status', 'Notes']);
  var rows = PRODUCTS.map(function (p, i) {
    return [p.no, 'PRD-' + ('000' + (i + 1)).slice(-3), p.name, p.cat,
      p.cost, p.price, 'Active', ''];
  });
  fill(sheet, DATA_ROW, 1, rows);
  addListValidation(sheet, DATA_ROW, 4, PRODUCTS.length, PRODUCT_CATEGORIES);
  addListValidation(sheet, DATA_ROW, 7, PRODUCTS.length, STATUS_LIST);
  setFormat(sheet, DATA_ROW, 5, PRODUCTS.length, 2, FMT_CURRENCY);
  setWidths(sheet, [[1, 70], [2, 100], [3, 200], [4, 120], [5, 100], [6, 110], [7, 80], [8, 240]]);
  freeze(sheet, HEADER_ROW, 0);
  var n = PRODUCTS.length;
  addNamedRange('ProductNames', SH.PRODUCT_MASTER, 'C' + DATA_ROW + ':C' + (DATA_ROW + n - 1));
  // Note the price gap explicitly.
  addNote(sheet, HEADER_ROW, 5, 'POS unit costs supplied 1 Nov 2026. At the supplied daily volumes they reproduce the period POS cost of 30,659 exactly.');
  addNote(sheet, HEADER_ROW, 6, 'POS selling prices supplied 1 Nov 2026. At the supplied daily volumes they reproduce gross POS sales of 64,392 exactly.');
}

/* ============================== POS RAW DATA =============================== */
function buildPosRaw() {
  var sheet = resetSheet(SH.POS_RAW);
  writeTitle(sheet, 'POS RAW DATA — immutable daily stock snapshots (append only, never overwrite)', 10);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Day', 'POS No', 'Product', 'Previous Stock',
    'Current Stock', 'Units Sold (calc)', 'Prev-day Close', 'Prev Match', 'Flag']);

  var values = [];
  var productNo = {};
  for (var p = 0; p < PRODUCTS.length; p++) productNo[PRODUCTS[p].name] = PRODUCTS[p].no;

  for (var d = 0; d < POS_DAYS.length; d++) {
    var day = POS_DAYS[d];
    var dt = new Date(day.date + 'T00:00:00');
    for (var i = 0; i < PRODUCTS.length; i++) {
      values.push([dt, day.label, productNo[PRODUCTS[i].name], PRODUCTS[i].name,
        day.stock[i][0], day.stock[i][1]]);
    }
  }
  fill(sheet, DATA_ROW, 1, values);

  var last = DATA_ROW + values.length - 1;
  var D_RNG = '$D$' + DATA_ROW + ':$D$' + R_END;
  var A_RNG = '$A$' + DATA_ROW + ':$A$' + R_END;
  var F_RNG = '$F$' + DATA_ROW + ':$F$' + R_END;
  var f = [];
  for (var r = DATA_ROW; r <= last; r++) {
    // Prev-day close = the closing stock of this product's most recent earlier
    // snapshot. Guarded by COUNTIFS so the first record yields "" — a bare
    // SUMIFS would return 0 there and be mis-read as a stock mismatch.
    // SUMPRODUCT(MAX(...)) replaces MAXIFS so the workbook still opens in
    // Excel versions older than 2019.
    var prevClose =
      'IF(COUNTIFS(' + D_RNG + ',D' + r + ',' + A_RNG + ',"<"&A' + r + ')=0,"",' +
      'SUMIFS(' + F_RNG + ',' + D_RNG + ',D' + r + ',' + A_RNG + ',' +
      'SUMPRODUCT(MAX((' + D_RNG + '=D' + r + ')*(' + A_RNG + '<A' + r + ')*' + A_RNG + '))))';
    f.push([
      '=E' + r + '-F' + r,
      '=' + prevClose,
      '=IF(H' + r + '="","First record",IF(H' + r + '=E' + r + ',"OK","Check"))',
      '=IF(G' + r + '<0,"Negative units - review",IF(I' + r + '="Check","Prev stock mismatch",""))'
    ]);
  }
  fillFormulas(sheet, DATA_ROW, 7, f);

  setFormat(sheet, DATA_ROW, 1, values.length, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 5, values.length, 3, FMT_NUMBER);
  shadeBand(sheet, DATA_ROW, 1, values.length, 6, CLR.RAW_BG, null);
  shadeBand(sheet, DATA_ROW, 7, values.length, 4, CLR.FORMULA_BG, null);
  setWidths(sheet, [[1, 95], [2, 70], [3, 70], [4, 200], [5, 110], [6, 110], [7, 110], [8, 110], [9, 90], [10, 170]]);
  freeze(sheet, HEADER_ROW, 4);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Negative units - review').setBackground(CLR.BAD_BG)
      .setRanges([sheet.getRange(DATA_ROW, 10, values.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Prev stock mismatch').setBackground(CLR.WARN_BG)
      .setRanges([sheet.getRange(DATA_ROW, 10, values.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0).setBackground(CLR.BAD_BG)
      .setRanges([sheet.getRange(DATA_ROW, 7, values.length, 1)]).build()
  ]);
}

/* =============================== SALES LOG ================================= */
function buildSalesLog() {
  var sheet = resetSheet(SH.SALES_LOG);
  writeTitle(sheet, 'SALES LOG — product sales derived from POS snapshots (formula-driven)', 6);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Product', 'Category', 'Units Sold',
    'Revenue', 'Estimated Cost']);

  var n = POS_DAYS.length * PRODUCTS.length;
  var last = DATA_ROW + n - 1;
  var f = [];
  var pCat = rng(SH.PRODUCT_MASTER, 'D');
  var pName = rng(SH.PRODUCT_MASTER, 'C');
  var pCost = rng(SH.PRODUCT_MASTER, 'E');
  var pPrice = rng(SH.PRODUCT_MASTER, 'F');
  for (var r = DATA_ROW; r <= last; r++) {
    var src = DATA_ROW + (r - DATA_ROW);
    f.push([
      "='" + SH.POS_RAW + "'!A" + src,
      "='" + SH.POS_RAW + "'!D" + src,
      '=IFERROR(INDEX(' + pCat + ',MATCH(B' + r + ',' + pName + ',0)),"Not in master")',
      "='" + SH.POS_RAW + "'!G" + src,
      '=IF(INDEX(' + pPrice + ',MATCH(B' + r + ',' + pName + ',0))="","Needs price",D' + r + '*INDEX(' + pPrice + ',MATCH(B' + r + ',' + pName + ',0)))',
      '=IF(INDEX(' + pCost + ',MATCH(B' + r + ',' + pName + ',0))="","Needs cost",D' + r + '*INDEX(' + pCost + ',MATCH(B' + r + ',' + pName + ',0)))'
    ]);
  }
  fillFormulas(sheet, DATA_ROW, 1, f);
  setFormat(sheet, DATA_ROW, 1, n, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 4, n, 3, FMT_NUMBER);
  setWidths(sheet, [[1, 95], [2, 200], [3, 120], [4, 100], [5, 110], [6, 120]]);
  freeze(sheet, HEADER_ROW, 0);
}

/* ============================= DAILY FINANCE =============================== */
function buildDailyFinance() {
  var sheet = resetSheet(SH.DAILY_FINANCE);
  writeTitle(sheet, 'DAILY FINANCE — one row per operating day', 13);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Day', 'Operating Status', 'Waffles Sold (reported)',
    'Product Units (calc)', 'Invoice Count', 'Gross POS Sales', 'Discount', 'Net Sales (reported)',
    'Due Generated', 'Bazar (from Purchases)', 'Operating Expenses', 'Expected Cash (indicative)']);

  var rows = [];
  for (var d = 0; d < POS_DAYS.length; d++) {
    var day = POS_DAYS[d];
    rows.push([new Date(day.date + 'T00:00:00'), day.label, 'Operating', day.sold,
      '', STATUS.NOT_SUPPLIED, STATUS.NOT_SUPPLIED, STATUS.NOT_SUPPLIED, day.sales,
      STATUS.NOT_SUPPLIED, '', '', '']);
  }
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  var posDate = rng(SH.POS_RAW, 'A');
  var posUnits = rng(SH.POS_RAW, 'G');
  var purDate = rng(SH.PURCHASES, 'A');
  var purTotal = rng(SH.PURCHASES, 'G');
  var expDate = rng(SH.EXPENSES, 'A');
  var expAmt = rng(SH.EXPENSES, 'E');

  // Column E = product units, K = bazar, L = expenses, M = expected cash.
  // Expected cash = net sales - due - bazar - expenses. Non-numeric cells
  // ("Not supplied") count as zero so the line still calculates.
  var unitsF = [], bazarF = [], expF = [], cashF = [];
  for (var r2 = DATA_ROW; r2 <= last; r2++) {
    unitsF.push(['=SUMIF(' + posDate + ',A' + r2 + ',' + posUnits + ')']);
    bazarF.push(['=IFERROR(SUMIFS(' + purTotal + ',' + purDate + ',A' + r2 + '),"")']);
    expF.push(['=IFERROR(SUMIFS(' + expAmt + ',' + expDate + ',A' + r2 + '),"")']);
    cashF.push(['=IFERROR(I' + r2 + '-IF(ISNUMBER(J' + r2 + '),J' + r2 + ',0)-IF(ISNUMBER(K' + r2 + '),K' + r2 + ',0)-IF(ISNUMBER(L' + r2 + '),L' + r2 + ',0),"")']);
  }
  fillFormulas(sheet, DATA_ROW, 5, unitsF);
  fillFormulas(sheet, DATA_ROW, 11, bazarF);
  fillFormulas(sheet, DATA_ROW, 12, expF);
  fillFormulas(sheet, DATA_ROW, 13, cashF);

  // Totals row
  var tr = last + 1;
  writeCells(sheet, tr, 1, [['TOTAL', '', '', '=SUM(D' + DATA_ROW + ':D' + last + ')',
    '=SUM(E' + DATA_ROW + ':E' + last + ')', '', '', '', '=SUM(I' + DATA_ROW + ':I' + last + ')',
    '', '=SUM(K' + DATA_ROW + ':K' + last + ')', '=SUM(L' + DATA_ROW + ':L' + last + ')',
    '=SUM(M' + DATA_ROW + ':M' + last + ')']]);
  sheet.getRange(tr, 1, 1, 13).setFontWeight('bold').setBackground(CLR.SECTION_BG);

  setFormat(sheet, DATA_ROW, 1, rows.length, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 4, rows.length + 1, 1, FMT_NUMBER);
  setFormat(sheet, DATA_ROW, 7, rows.length + 1, 7, FMT_CURRENCY);
  shadeBand(sheet, DATA_ROW, 6, rows.length, 1, CLR.INPUT_BG, null);
  shadeBand(sheet, DATA_ROW, 8, rows.length, 1, CLR.INPUT_BG, null);
  shadeBand(sheet, DATA_ROW, 10, rows.length, 1, CLR.INPUT_BG, null);
  setWidths(sheet, [[1, 95], [2, 65], [3, 110], [4, 120], [5, 120], [6, 100], [7, 110],
    [8, 95], [9, 120], [10, 110], [11, 130], [12, 130], [13, 150]]);
  freeze(sheet, HEADER_ROW, 2);
  addNote(sheet, HEADER_ROW, 6, 'Daily invoice counts were not supplied — enter them as you go.');
}

/* ============================= PERIOD SUMMARY ============================== */
function buildPeriod() {
  var sheet = resetSheet(SH.PERIOD);
  writeTitle(sheet, 'PERIOD SUMMARY — Oct 17-30 2026 (supplied) + reconciliation', 3);
  writeHeader(sheet, HEADER_ROW, ['Metric', 'Value', 'Notes / source']);

  var rows = [];
  for (var i = 0; i < PERIOD_SUMMARY.length; i++) {
    rows.push([PERIOD_SUMMARY[i][0], PERIOD_SUMMARY[i][1], PERIOD_SUMMARY[i][2] || '']);
  }
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  // apply formats by row type
  for (var r = DATA_ROW; r <= last; r++) {
    var type = PERIOD_SUMMARY[r - DATA_ROW][2];
    if (type === 'currency') sheet.getRange(r, 2).setNumberFormat(FMT_CURRENCY);
    else if (type === 'decimal') sheet.getRange(r, 2).setNumberFormat(FMT_DECIMAL);
    else if (type === 'number') sheet.getRange(r, 2).setNumberFormat(FMT_NUMBER);
  }

  var reconRow = last + 2;
  writeHeader(sheet, reconRow, ['Reconciliation (formula-driven)', 'Value', 'Check']);
  var rr = reconRow + 1;

  var netCell  = 'B' + (DATA_ROW + 7);  // Original / net sales
  var discCell = 'B' + (DATA_ROW + 15); // Discount
  var dueCell  = 'B' + (DATA_ROW + 16); // Due
  var bazarCell= 'B' + (DATA_ROW + 17); // Bazar
  var costCell = 'B' + (DATA_ROW + 8);  // POS cost
  var profitCell='B' + (DATA_ROW + 9);  // POS profit
  var cashCell = 'B' + (DATA_ROW + 10); // Cash in hand

  var recon = [
    ['Gross POS sales = net + discount', '=' + netCell + '+' + discCell, 'Expected 64,392'],
    ['Expected cash = net - due - bazar', '=' + netCell + '-' + dueCell + '-' + bazarCell, 'Matches cash in hand 52,320'],
    ['Daily net sum (from Daily Finance)', "=SUM('" + SH.DAILY_FINANCE + "'!I" + DATA_ROW + ':I' + (DATA_ROW + POS_DAYS.length - 1) + ')', 'Supplied period net 58,690'],
    ['Daily vs period difference', "=SUM('" + SH.DAILY_FINANCE + "'!I" + DATA_ROW + ':I' + (DATA_ROW + POS_DAYS.length - 1) + ')-' + netCell, 'Known gap = -8'],
    ['POS profit from net (net - cost)', '=' + netCell + '-' + costCell, 'Matches supplied 28,031'],
    ['POS profit from gross (gross - cost)', '=(' + netCell + '+' + discCell + ')-' + costCell, 'Alternative = 33,733'],
    ['Daily reported waffles sum', "=SUM('" + SH.DAILY_FINANCE + "'!D" + DATA_ROW + ':D' + (DATA_ROW + POS_DAYS.length - 1) + ')', 'Supplied 467'],
    ['Cash in hand (supplied)', '=' + cashCell, 'Must equal expected cash above']
  ];
  writeCells(sheet, rr, 1, recon);
  for (var k = 0; k < recon.length; k++) {
    sheet.getRange(rr + k, 2).setNumberFormat(FMT_CURRENCY);
  }
  shadeBand(sheet, rr, 2, recon.length, 1, CLR.FORMULA_BG, null);
  setWidths(sheet, [[1, 300], [2, 130], [3, 260]]);
}

/* ============================= PRODUCTION LOG ============================== */
function buildProduction() {
  var sheet = resetSheet(SH.PRODUCTION);
  writeTitle(sheet, 'PRODUCTION LOG — batches newly prepared (not necessarily consumed same day)', 7);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Batter', 'Nutella Mix', 'Cream', 'White Mix', 'Cheese', 'Note']);

  var rows = PRODUCTION_ROWS.map(function (p) {
    return [new Date(p.date + 'T00:00:00'), p.batter, p.nutella, p.cream, p.white, p.cheese, p.note];
  });
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;
  var tr = last + 1;
  writeCells(sheet, tr, 1, [['TOTAL', '=SUM(B' + DATA_ROW + ':B' + last + ')', '=SUM(C' + DATA_ROW + ':C' + last + ')',
    '=SUM(D' + DATA_ROW + ':D' + last + ')', '=SUM(E' + DATA_ROW + ':E' + last + ')',
    '=SUM(F' + DATA_ROW + ':F' + last + ')', 'Correct totals: 21 / 17 / 8 / 1 / 1']]);
  sheet.getRange(tr, 1, 1, 7).setFontWeight('bold').setBackground(CLR.SECTION_BG);
  setFormat(sheet, DATA_ROW, 1, rows.length, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 2, rows.length + 1, 5, FMT_DECIMAL);
  setWidths(sheet, [[1, 95], [2, 80], [3, 110], [4, 80], [5, 90], [6, 80], [7, 340]]);
  freeze(sheet, HEADER_ROW, 0);
  addNote(sheet, HEADER_ROW, 1,
    'Oct 14 & 16 were training/trial days. Oct 28 shows zero new batches but 23 waffles sold on carried-over batter — this is expected, not an error.');
  addNote(sheet, HEADER_ROW, 2, 'Batter may carry over one day and is never kept to a third day. Zero new batches does not mean zero sales.');
}

/* =============================== RECIPES / BOM ============================= */
function buildRecipes() {
  var sheet = resetSheet(SH.RECIPES);
  writeTitle(sheet, 'RECIPES / BOM — quantity of each ingredient per batch', 6);
  writeHeader(sheet, HEADER_ROW, ['Batch Type', 'Ingredient', 'Qty per Batch', 'Unit',
    'Batches Produced (all-time)', 'Recipe Consumption (all-time)']);

  var rows = RECIPE_ROWS.map(function (r) { return [r.batch, r.ing, r.qty, r.unit, '', '']; });
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  var prodTotalRow = DATA_ROW + PRODUCTION_ROWS.length; // totals row on Production
  var prodHead = "'" + SH.PRODUCTION + "'!$B$" + HEADER_ROW + ':$F$' + HEADER_ROW;
  var prodTotals = "'" + SH.PRODUCTION + "'!$B$" + prodTotalRow + ':$F$' + prodTotalRow;

  var f = [];
  for (var r = DATA_ROW; r <= last; r++) {
    f.push([
      '=IFERROR(INDEX(' + prodTotals + ',MATCH(A' + r + ',' + prodHead + ',0)),0)',
      '=C' + r + '*E' + r
    ]);
  }
  fillFormulas(sheet, DATA_ROW, 5, f);
  setFormat(sheet, DATA_ROW, 3, rows.length, 1, FMT_DECIMAL);
  setFormat(sheet, DATA_ROW, 5, rows.length, 2, FMT_DECIMAL);

  // Missing recipe blocks (no invented composition)
  var miss = last + 2;
  writeHeader(sheet, miss, ['Missing recipe / BOM — needs owner input', '', '', '', '', '']);
  var missRows = [
    ['Dark Chocolate', 'Purchased and consumed; composition not supplied', 'No recipe defined'],
    ['Cream Cheese', 'Manual consumption supplied; composition not supplied', 'No recipe defined'],
    ['Cheese (batch)', 'Production quantity supplied; composition not supplied', 'No recipe defined'],
    ['Direct toppings', 'KitKat, Oreo, almond varieties, fillings, syrup — no per-product BOM', 'No recipe defined']
  ];
  fill(sheet, miss + 1, 1, missRows);
  setWidths(sheet, [[1, 130], [2, 150], [3, 110], [4, 70], [5, 140], [6, 150]]);
  freeze(sheet, HEADER_ROW, 0);
}

/* ================================ PURCHASES ================================ */
function buildPurchases() {
  var sheet = resetSheet(SH.PURCHASES);
  writeTitle(sheet, 'PURCHASES / BAZAR — one row per item purchased (source of truth for buying)', 12);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Item', 'Qty', 'Unit', 'Rate (source)', 'Unit Rate (calc)',
    'Total', 'Normalized Qty', 'Normalized Unit', 'Group', 'Supplier', 'Notes']);

  var rows = PURCHASE_ROWS.map(function (p) {
    return ['', p.item, p.qty, p.unit, p.rateText, '', p.total, '', '', p.group, '', ''];
  });
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  var conv = "'" + SH.CONVERSIONS + "'!$A$" + DATA_ROW + ':$C$' + (DATA_ROW + 200);
  var convG = "'" + SH.CONVERSIONS + "'!$A$" + DATA_ROW + ':$B$' + (DATA_ROW + 200);
  var f = [];
  for (var r = DATA_ROW; r <= last; r++) {
    f.push([
      '=IFERROR(G' + r + '/C' + r + ',"")',
      '=IFERROR(C' + r + '*VLOOKUP(D' + r + ',' + convG + ',2,FALSE),"Conversion required")',
      '=IFERROR(VLOOKUP(D' + r + ',' + conv + ',3,FALSE),"")'
    ]);
  }
  // columns F (6), H (8), I (9)
  var fF = [], fH = [], fI = [];
  for (var r2 = DATA_ROW; r2 <= last; r2++) {
    fF.push(['=IFERROR(G' + r2 + '/C' + r2 + ',"")']);
    fH.push(['=IFERROR(C' + r2 + '*VLOOKUP(D' + r2 + ',' + convG + ',2,FALSE),"Conversion required")']);
    fI.push(['=IFERROR(VLOOKUP(D' + r2 + ',' + conv + ',3,FALSE),"")']);
  }
  fillFormulas(sheet, DATA_ROW, 6, fF);
  fillFormulas(sheet, DATA_ROW, 8, fH);
  fillFormulas(sheet, DATA_ROW, 9, fI);

  var tr = last + 1;
  writeCells(sheet, tr, 1, [['TOTAL', '', '', '', '', '', '=SUM(G' + DATA_ROW + ':G' + last + ')',
    '=SUM(H' + DATA_ROW + ':H' + last + ')', '', '', '', '']]);
  sheet.getRange(tr, 1, 1, 12).setFontWeight('bold').setBackground(CLR.SECTION_BG);

  setFormat(sheet, DATA_ROW, 1, rows.length, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 6, rows.length + 1, 1, FMT_DECIMAL);
  setFormat(sheet, DATA_ROW, 7, rows.length + 1, 1, FMT_CURRENCY);
  setFormat(sheet, DATA_ROW, 8, rows.length + 1, 1, FMT_DECIMAL);
  setWidths(sheet, [[1, 95], [2, 210], [3, 70], [4, 60], [5, 120], [6, 120], [7, 100],
    [8, 120], [9, 120], [10, 110], [11, 120], [12, 200]]);
  freeze(sheet, HEADER_ROW, 2);
  addNote(sheet, HEADER_ROW, 1, 'Purchase dates were not supplied. Add dates as records are entered so monthly Bazar totals calculate automatically.');
  addNote(sheet, HEADER_ROW, 8, 'Normalized Qty converts kg/L to g. "Conversion required" means the unit (jar/pack) has no confirmed factor yet.');
}

/* =============================== EXPENSE LOG =============================== */
function buildExpenses() {
  var sheet = resetSheet(SH.EXPENSES);
  writeTitle(sheet, 'EXPENSE LOG — salaries, electricity, maintenance and future categories', 9);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Expense Category', 'Description', 'Amount',
    'Payment Method', 'Paid / Unpaid', 'Receipt / Reference', 'Notes', 'Month']);
  // one illustrative blank-row band with validation
  var blankRows = 50;
  addListValidation(sheet, DATA_ROW, 2, blankRows, EXPENSE_CATEGORIES);
  addListValidation(sheet, DATA_ROW, 5, blankRows, PAYMENT_METHODS);
  addListValidation(sheet, DATA_ROW, 6, blankRows, ['Paid', 'Unpaid']);
  var mf = [];
  for (var r = DATA_ROW; r < DATA_ROW + blankRows; r++) {
    mf.push(['=IFERROR(TEXT(A' + r + ',"yyyy-mm"),"")']);
  }
  fillFormulas(sheet, DATA_ROW, 9, mf);
  shadeBand(sheet, DATA_ROW, 1, blankRows, 8, CLR.INPUT_BG, null);
  setFormat(sheet, DATA_ROW, 1, blankRows, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 4, blankRows, 1, FMT_CURRENCY);
  setWidths(sheet, [[1, 95], [2, 160], [3, 220], [4, 100], [5, 120], [6, 100], [7, 150], [8, 200], [9, 90]]);
  freeze(sheet, HEADER_ROW, 0);
}

/* ================================ INVENTORY ================================ */
function buildInventory() {
  var sheet = resetSheet(SH.INVENTORY);
  writeTitle(sheet, 'INVENTORY — purchased vs consumed vs remaining, per item', 13);
  writeHeader(sheet, HEADER_ROW, ['Item', 'Category', 'Base Unit', 'Purchased (norm)',
    'Recipe Consumption', 'Manual Used', 'Manual Remaining', 'Calculated Closing', 'Variance',
    'Unit Cost (weighted)', 'Stock Value', 'Reorder Level', 'Est. Days Remaining']);

  var manByItem = {};
  for (var m = 0; m < MANUAL_USAGE.length; m++) manByItem[MANUAL_USAGE[m].item] = MANUAL_USAGE[m];

  var rows = ITEMS.map(function (it) {
    var man = manByItem[it.name];
    var mu = man ? man.used : 'Not supplied';
    var mr = man ? man.remaining : 'Not supplied';
    var dr = (DAYS_REMAINING[it.name] !== undefined) ? DAYS_REMAINING[it.name] : STATUS.NOT_SUPPLIED;
    return [it.name, it.cat, it.unit, '', '', mu, mr, '', '', '', '', STATUS.NOT_SUPPLIED, dr];
  });
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  var purItem = rng(SH.PURCHASES, 'B');
  var purTotal = rng(SH.PURCHASES, 'G');
  var purNorm = rng(SH.PURCHASES, 'H');
  var recIng = rng(SH.RECIPES, 'B');
  var recCons = rng(SH.RECIPES, 'F');
  var opsDays = POS_DAYS.length;

  var fD = [], fE = [], fH = [], fI = [], fJ = [], fK = [], fM = [];
  for (var r = DATA_ROW; r <= last; r++) {
    // Purchased: sum of normalized purchase quantities. When the only purchases
    // for this item are in an unconverted unit (jar/pack) the SUMIFS ignores the
    // text and returns 0 — surface that as a status instead of a fake zero.
    fD.push(['=IFERROR(IF(AND(SUMIFS(' + purNorm + ',' + purItem + ',A' + r + ')=0,' +
      'COUNTIFS(' + purItem + ',A' + r + ',' + purNorm + ',"Conversion required")>0),' +
      '"Conversion required",SUMIFS(' + purNorm + ',' + purItem + ',A' + r + ')),"")']);
    fE.push(['=IFERROR(SUMIF(' + recIng + ',A' + r + ',' + recCons + '),"")']);
    // Calculated closing is recipe-derived. Items with no recipe at all get a
    // status, not a fabricated number (previously they showed D-E as if the
    // recipe existed).
    fH.push(['=IF(NOT(ISNUMBER(D' + r + ')),"",IF(COUNTIF(' + recIng + ',A' + r + ')=0,"No recipe defined",D' + r + '-E' + r + '))']);
    // Variance = physical (manual remaining) minus calculated closing. Only
    // meaningful when both a physical count and a recipe-based figure exist.
    fI.push(['=IF(OR(G' + r + '="Not supplied",NOT(ISNUMBER(H' + r + '))),"",G' + r + '-H' + r + ')']);
    // Weighted average unit cost = total purchase value / total normalized qty.
    fJ.push(['=IF(NOT(ISNUMBER(D' + r + ')),IF(D' + r + '="","Not supplied",D' + r + '),' +
      'IFERROR(SUMIFS(' + purTotal + ',' + purItem + ',A' + r + ')/D' + r + ',""))']);
    fK.push(['=IF(OR(NOT(ISNUMBER(H' + r + ')),NOT(ISNUMBER(J' + r + '))),"",H' + r + '*J' + r + ')']);
    fM.push(['=IFERROR(IF(OR(G' + r + '="Not supplied",G' + r + '=""),"Needs consumption data",IF(ROUND(E' + r + '/' + opsDays + ',4)<=0,"Forecast unavailable",G' + r + '/(E' + r + '/' + opsDays + '))),"Forecast unavailable")']);
  }
  fillFormulas(sheet, DATA_ROW, 4, fD);
  fillFormulas(sheet, DATA_ROW, 5, fE);
  fillFormulas(sheet, DATA_ROW, 8, fH);
  fillFormulas(sheet, DATA_ROW, 9, fI);
  fillFormulas(sheet, DATA_ROW, 10, fJ);
  fillFormulas(sheet, DATA_ROW, 11, fK);
  fillFormulas(sheet, DATA_ROW, 13, fM);

  setFormat(sheet, DATA_ROW, 4, rows.length, 4, FMT_DECIMAL);
  setFormat(sheet, DATA_ROW, 8, rows.length, 2, FMT_DECIMAL);
  setFormat(sheet, DATA_ROW, 10, rows.length, 2, FMT_DECIMAL);
  setWidths(sheet, [[1, 210], [2, 170], [3, 80], [4, 120], [5, 130], [6, 110], [7, 130],
    [8, 130], [9, 100], [10, 130], [11, 110], [12, 110], [13, 130]]);
  freeze(sheet, HEADER_ROW, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0).setBackground(CLR.BAD_BG)
      .setRanges([sheet.getRange(DATA_ROW, 9, rows.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Conversion required').setBackground(CLR.WARN_BG)
      .setRanges([sheet.getRange(DATA_ROW, 4, rows.length, 1)]).build()
  ]);
  addNote(sheet, HEADER_ROW, 5, 'Recipe-derived consumption only. Missing recipes (Dark Chocolate, Cream Cheese, Cheese, toppings) will understate consumption.');
}

/* ============================= PACKAGING STOCK ============================= */
function buildPackaging() {
  var sheet = resetSheet(SH.PACKAGING);
  writeTitle(sheet, 'PACKAGING STOCK — countable serving materials (pcs)', 6);
  writeHeader(sheet, HEADER_ROW, ['Item', 'Purchased (pcs)', 'Consumed (pcs)',
    'Current Qty', 'Reorder Level', 'Est. Days Remaining']);
  var pk = ITEMS.filter(function (it) {
    return it.cat === 'Packaging' || it.cat === 'Serving Materials' || it.cat === 'Consumables';
  });
  var rows = pk.map(function (it) { return [it.name, '', STATUS.NOT_SUPPLIED, '', STATUS.NOT_SUPPLIED, STATUS.NOT_SUPPLIED]; });
  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;
  var purItem = rng(SH.PURCHASES, 'B');
  var purNorm = rng(SH.PURCHASES, 'H');
  var fB = [], fC = [], fD = [];
  for (var r = DATA_ROW; r <= last; r++) {
    fB.push(['=IFERROR(SUMIFS(' + purNorm + ',' + purItem + ',A' + r + '),"")']);
    fC.push(['=""']);
    fD.push(['=IFERROR(B' + r + '-C' + r + ',"")']);
  }
  fillFormulas(sheet, DATA_ROW, 2, fB);
  fillFormulas(sheet, DATA_ROW, 3, fC);
  fillFormulas(sheet, DATA_ROW, 4, fD);
  setFormat(sheet, DATA_ROW, 2, rows.length, 3, FMT_NUMBER);
  setWidths(sheet, [[1, 210], [2, 130], [3, 130], [4, 120], [5, 110], [6, 130]]);
  addNote(sheet, HEADER_ROW, 3, 'Packaging consumption data was not supplied — consumption stays blank until tracked.');
}

/* ============================ UNIT CONVERSIONS ============================= */
function buildConversions() {
  var sheet = resetSheet(SH.CONVERSIONS);
  writeTitle(sheet, 'UNIT CONVERSIONS — factor from a purchase unit to its base unit', 4);
  writeHeader(sheet, HEADER_ROW, ['Unit', 'Factor to Base', 'Base Unit', 'Note']);
  var rows = UNIT_CONVERSIONS.map(function (u) { return [u.unit, u.factor, u.base, u.note]; });
  // unconfirmed units (no invented factors)
  rows.push(['jar', 'needs confirmation', 'g', 'Nutella jar net weight — needs confirmation']);
  rows.push(['pack', 'needs confirmation', 'g', 'Whipped cream pack weight — needs confirmation']);
  fill(sheet, DATA_ROW, 1, rows);
  setFormat(sheet, DATA_ROW, 2, rows.length, 1, FMT_NUMBER);
  setWidths(sheet, [[1, 90], [2, 130], [3, 100], [4, 340]]);
}

/* =============================== STOCKTAKE ================================= */
function buildStocktake() {
  var sheet = resetSheet(SH.STOCKTAKE);
  writeTitle(sheet, 'STOCKTAKE / ADJUSTMENTS — physical counts, wastage and corrections', 6);
  writeHeader(sheet, HEADER_ROW, ['Date', 'Item', 'Type (Stocktake/Wastage/Adjustment)',
    'Qty', 'Reason / Notes', 'Entered By']);
  var blankRows = 50;
  addListValidation(sheet, DATA_ROW, 2, blankRows, ITEMS.map(function (it) { return it.name; }));
  addListValidation(sheet, DATA_ROW, 3, blankRows, ['Stocktake', 'Wastage', 'Adjustment']);
  shadeBand(sheet, DATA_ROW, 1, blankRows, 6, CLR.INPUT_BG, null);
  setFormat(sheet, DATA_ROW, 1, blankRows, 1, FMT_DATE);
  setFormat(sheet, DATA_ROW, 4, blankRows, 1, FMT_DECIMAL);
  setWidths(sheet, [[1, 95], [2, 210], [3, 200], [4, 90], [5, 260], [6, 120]]);
}

/* ============================== DASHBOARDS ================================= */
function helperKpiBlock(sheet, startRow, title, pairs) {
  writeHeader(sheet, startRow, [title, '', '']);
  var r = startRow + 1;
  var rows = pairs.map(function (p) { return [p[0], p[1], p[2] || '']; });
  writeCells(sheet, r, 1, rows);
  shadeBand(sheet, r, 2, rows.length, 1, CLR.FORMULA_BG, null);
  return r;
}

function buildDashExec() {
  var sheet = resetSheet(SH.DASH_EXEC);
  writeTitle(sheet, 'EXECUTIVE DASHBOARD — October 2026 (Oct 17-30)', 4);

  var d = "'" + SH.DAILY_FINANCE + "'";
  var dEnd = DATA_ROW + POS_DAYS.length - 1; // 15
  var p = "'" + SH.PERIOD + "'";

  var r = helperKpiBlock(sheet, HEADER_ROW, 'Sales', [
    ['Operating days', '=' + p + "!B" + (DATA_ROW + 2), 'Supplied'],
    ['Waffles sold (reported)', '=' + p + "!B" + (DATA_ROW + 4), 'Supplied'],
    ['Product units sold (calculated)', '=SUM(' + d + '!E' + DATA_ROW + ':E' + dEnd + ')', 'From POS stock movement'],
    ['Gross POS sales', '=' + p + "!B" + (DATA_ROW + 7) + '+' + p + "!B" + (DATA_ROW + 15), 'Net + discount'],
    ['Discount', '=' + p + "!B" + (DATA_ROW + 15), 'Supplied'],
    ['Net sales', '=' + p + "!B" + (DATA_ROW + 7), 'Supplied'],
    ['Average daily sale', '=' + p + "!B" + (DATA_ROW + 11), 'Supplied'],
    ['Average selling price / waffle', '=' + p + "!B" + (DATA_ROW + 12), 'Supplied']
  ]);

  var r2 = r + 9;
  helperKpiBlock(sheet, r2, 'Money', [
    ['Due (outstanding)', '=' + p + "!B" + (DATA_ROW + 16), 'Supplied'],
    ['Bazar (purchases)', '=' + p + "!B" + (DATA_ROW + 17), 'Supplied'],
    ['Cash in hand', '=' + p + "!B" + (DATA_ROW + 10), 'Supplied'],
    ['Expected cash (net - due - bazar)', '=' + p + "!B" + (DATA_ROW + 7) + '-' + p + "!B" + (DATA_ROW + 16) + '-' + p + "!B" + (DATA_ROW + 17), 'Should equal cash in hand'],
    ['POS estimated profit (from net)', '=' + p + "!B" + (DATA_ROW + 9), 'Estimated only'],
    ['Operating expenses', '=SUM(' + d + '!L' + DATA_ROW + ':L' + dEnd + ')', 'Currently 0']
  ]);

  var r3 = r2 + 8;
  helperKpiBlock(sheet, r3, 'Production (Oct 17-30 & trials)', [
    ['Batter batches', "='" + SH.PRODUCTION + "'!B" + (DATA_ROW + PRODUCTION_ROWS.length), 'Correct total 21'],
    ['Nutella Mix batches', "='" + SH.PRODUCTION + "'!C" + (DATA_ROW + PRODUCTION_ROWS.length), 'Correct total 17'],
    ['Cream batches', "='" + SH.PRODUCTION + "'!D" + (DATA_ROW + PRODUCTION_ROWS.length), 'Correct total 8']
  ]);

  setFormat(sheet, DATA_ROW + 3, 2, 5, 1, FMT_CURRENCY);   // gross..avg price
  setFormat(sheet, DATA_ROW + 10, 2, 6, 1, FMT_CURRENCY);  // money block
  setWidths(sheet, [[1, 300], [2, 140], [3, 220], [4, 60]]);
  try {
    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(SS().getSheetByName(SH.DAILY_FINANCE).getRange(DATA_ROW, 2, POS_DAYS.length, 1))
      .addRange(SS().getSheetByName(SH.DAILY_FINANCE).getRange(DATA_ROW, 9, POS_DAYS.length, 1))
      .setPosition(2, 5, 0, 0)
      .setOption('title', 'Daily net sales (৳)')
      .setOption('legend', { position: 'none' })
      .build();
    sheet.insertChart(chart);
  } catch (e) { /* chart is cosmetic */ }
}

function buildDashProduct() {
  var sheet = resetSheet(SH.DASH_PRODUCT);
  writeTitle(sheet, 'PRODUCT PERFORMANCE — units sold per POS product', 6);
  writeHeader(sheet, HEADER_ROW, ['POS No', 'Product', 'Category', 'Units Sold',
    'Revenue', 'Estimated Cost', 'Profit', '% of Units']);
  var sl = "'" + SH.SALES_LOG + "'";
  var slEnd = DATA_ROW + POS_DAYS.length * PRODUCTS.length - 1;
  var rows = [], f = [];
  for (var i = 0; i < PRODUCTS.length; i++) {
    var r = DATA_ROW + i;
    var pCat = rng(SH.PRODUCT_MASTER, 'D');
    var pName = rng(SH.PRODUCT_MASTER, 'C');
    var pCost = rng(SH.PRODUCT_MASTER, 'E');
    var pPrice = rng(SH.PRODUCT_MASTER, 'F');
    rows.push([PRODUCTS[i].no, PRODUCTS[i].name, PRODUCTS[i].cat, '', '', '', '', '']);
    f.push([
      '=SUMIF(' + sl + "!$B$" + DATA_ROW + ':$B$' + slEnd + ',B' + r + ',' + sl + "!$D$" + DATA_ROW + ':$D$' + slEnd + ')',
      '=IFERROR(IF(INDEX(' + pPrice + ',MATCH(B' + r + ',' + pName + ',0))="","Needs price",SUMIF(' + sl + "!$B$" + DATA_ROW + ':$B$' + slEnd + ',B' + r + ',' + sl + "!$E$" + DATA_ROW + ':$E$' + slEnd + ')),"Needs price")',
      '=IFERROR(IF(INDEX(' + pCost + ',MATCH(B' + r + ',' + pName + ',0))="","Needs cost",SUMIF(' + sl + "!$B$" + DATA_ROW + ':$B$' + slEnd + ',B' + r + ',' + sl + "!$F$" + DATA_ROW + ':$F$' + slEnd + ')),"Needs cost")',
      '=IF(OR(ISNUMBER(E' + r + ')=FALSE,ISNUMBER(F' + r + ')=FALSE),"Needs price & cost",E' + r + '-F' + r + ')',
      '=IFERROR(D' + r + '/SUM($D$' + DATA_ROW + ':$D$' + (DATA_ROW + PRODUCTS.length - 1) + '),"")'
    ]);
  }
  fill(sheet, DATA_ROW, 1, rows);
  // write F..H and revenue/cost columns directly per-row (columns E,F,G,H)
  var fE = [], fF = [], fG = [], fH = [];
  for (var r2 = DATA_ROW; r2 < DATA_ROW + PRODUCTS.length; r2++) {
    fE.push([f[r2 - DATA_ROW][1]]);
    fF.push([f[r2 - DATA_ROW][2]]);
    fG.push([f[r2 - DATA_ROW][3]]);
    fH.push([f[r2 - DATA_ROW][4]]);
  }
  var fD = f.map(function (x) { return [x[0]]; });
  fillFormulas(sheet, DATA_ROW, 4, fD);
  fillFormulas(sheet, DATA_ROW, 5, fE);
  fillFormulas(sheet, DATA_ROW, 6, fF);
  fillFormulas(sheet, DATA_ROW, 7, fG);
  fillFormulas(sheet, DATA_ROW, 8, fH);
  setFormat(sheet, DATA_ROW, 4, PRODUCTS.length, 1, FMT_NUMBER);
  setFormat(sheet, DATA_ROW, 5, PRODUCTS.length, 3, FMT_CURRENCY);
  setFormat(sheet, DATA_ROW, 8, PRODUCTS.length, 1, '0.0%');
  setWidths(sheet, [[1, 70], [2, 200], [3, 110], [4, 100], [5, 110], [6, 120], [7, 110], [8, 90]]);
  freeze(sheet, HEADER_ROW, 0);
  addNote(sheet, HEADER_ROW, 5, 'Revenue & cost are now computed from the supplied POS prices/costs entered in Product Master.');
}

function buildDashInventory() {
  var sheet = resetSheet(SH.DASH_INVENTORY);
  writeTitle(sheet, 'INVENTORY DASHBOARD — stock health', 3);
  var inv = "'" + SH.INVENTORY + "'";
  var invEnd = DATA_ROW + ITEMS.length - 1;
  var startRow = DATA_ROW;
  writeHeader(sheet, startRow, ['Metric', 'Value', 'Notes']);
  var rows = [
    ['Items tracked', '=COUNTA(' + inv + '!A' + DATA_ROW + ':A' + invEnd + ')', 'From Item Master'],
    ['Items that cannot be costed yet', '=COUNTA(' + inv + '!A' + DATA_ROW + ':A' + invEnd + ')-SUMPRODUCT(--ISNUMBER(' + inv + '!J' + DATA_ROW + ':J' + invEnd + '))', 'No normalized purchase data'],
    ['Items with conversion gaps', '=COUNTIF(' + inv + '!D' + DATA_ROW + ':D' + invEnd + ',"Conversion required")', 'jar / pack units'],
    ['Items with negative variance', '=COUNTIF(' + inv + '!I' + DATA_ROW + ':I' + invEnd + ',"<0")', 'Physical count below calculated closing'],
    ['Estimated days remaining (owner, min)', '=MIN(' + daysRange(inv, invEnd) + ')', 'Excludes blanks'],
    ['Out-of-stock items', '=COUNTIF(' + inv + '!M' + DATA_ROW + ':M' + invEnd + ',"Out of stock")', 'Forecast-driven']
  ];
  writeCells(sheet, startRow + 1, 1, rows);
  shadeBand(sheet, startRow + 1, 2, rows.length, 1, CLR.FORMULA_BG, null);
  setWidths(sheet, [[1, 300], [2, 160], [3, 240]]);
}

function daysRange(inv, end) {
  // helper returns the M column numeric range for the owner-estimate min
  return inv + '!M' + DATA_ROW + ':M' + end;
}

function buildDashFinance() {
  var sheet = resetSheet(SH.DASH_FINANCE);
  writeTitle(sheet, 'FINANCIAL DASHBOARD — cash, purchases, profit (October 2026)', 3);
  var d = "'" + SH.DAILY_FINANCE + "'";
  var dEnd = DATA_ROW + POS_DAYS.length - 1;
  var p = "'" + SH.PERIOD + "'";
  var startRow = DATA_ROW;
  writeHeader(sheet, startRow, ['Metric', 'Value', 'Notes']);
  var rows = [
    ['Gross revenue', '=' + p + "!B" + (DATA_ROW + 7) + '+' + p + "!B" + (DATA_ROW + 15), 'Net + discount'],
    ['Discounts', '=' + p + "!B" + (DATA_ROW + 15), ''],
    ['Net revenue', '=' + p + "!B" + (DATA_ROW + 7), ''],
    ['Due', '=' + p + "!B" + (DATA_ROW + 16), 'Receivable, not cash'],
    ['Cash in hand', '=' + p + "!B" + (DATA_ROW + 10), ''],
    ['Bazar purchases', "=SUM('" + SH.PURCHASES + "'!G" + DATA_ROW + ':G' + (DATA_ROW + PURCHASE_ROWS.length - 1) + ')', 'From Purchases log'],
    ['Operating expenses', '=SUM(' + d + '!L' + DATA_ROW + ':L' + dEnd + ')', 'Currently 0'],
    ['POS estimated cost', '=' + p + "!B" + (DATA_ROW + 8), 'Estimated'],
    ['POS estimated profit', '=' + p + "!B" + (DATA_ROW + 9), 'Not actual business profit'],
    ['Actual COGS (ingredient-level)', STATUS.CONVERSION, 'Pending verified costing']
  ];
  writeCells(sheet, startRow + 1, 1, rows);
  setFormat(sheet, startRow + 1, 2, rows.length, 1, FMT_CURRENCY);
  shadeBand(sheet, startRow + 1, 2, rows.length, 1, CLR.FORMULA_BG, null);
  setWidths(sheet, [[1, 300], [2, 160], [3, 240]]);
}

/* ================================= REPORTS ================================= */
function buildReports() {
  var sheet = resetSheet(SH.REPORTS);
  writeTitle(sheet, 'REPORTS — monthly and all-time (single underlying data source)', 4);
  writeHeader(sheet, HEADER_ROW, ['Month', 'Operating Days', 'Net Sales', 'Purchases']);
  // one month of data currently; formula-driven so future months roll forward
  var d = "'" + SH.DAILY_FINANCE + "'";
  var dEnd = DATA_ROW + POS_DAYS.length - 1;
  var p = "'" + SH.PERIOD + "'";
  var rows = [
    ['2026-10', '=' + p + "!B" + (DATA_ROW + 2), '=' + p + "!B" + (DATA_ROW + 7),
      "=SUM('" + SH.PURCHASES + "'!G" + DATA_ROW + ':G' + (DATA_ROW + PURCHASE_ROWS.length - 1) + ')']
  ];
  writeCells(sheet, DATA_ROW, 1, rows);
  setFormat(sheet, DATA_ROW, 3, 1, 2, FMT_CURRENCY);
  setWidths(sheet, [[1, 120], [2, 130], [3, 140], [4, 130]]);
}
