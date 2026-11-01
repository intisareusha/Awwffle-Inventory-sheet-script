/**
 * Awwffle — Business Management Workbook
 * File: Reconciliation.gs
 * Purpose: active error-checks. Every unresolved mismatch is surfaced, never hidden.
 *          Results are formula-driven so they update as data is entered.
 */

function buildReconciliation() {
  var sheet = resetSheet(SH.RECON);
  writeTitle(sheet, 'RECONCILIATION — checks that identify errors instead of hiding them', 4);
  writeHeader(sheet, HEADER_ROW, ['Area', 'Check', 'Result', 'Interpretation']);

  var posD   = rng(SH.POS_RAW, 'D');
  var posG   = rng(SH.POS_RAW, 'G');
  var posI   = rng(SH.POS_RAW, 'I');
  var posA   = rng(SH.POS_RAW, 'A');
  var prodDates  = "'" + SH.PRODUCTION + "'!$A$" + DATA_ROW + ':$A$' + (DATA_ROW + PRODUCTION_ROWS.length - 1);
  var prodBatterCol = "'" + SH.PRODUCTION + "'!$B$" + DATA_ROW + ':$B$' + (DATA_ROW + PRODUCTION_ROWS.length - 1);
  var prodBatter = "'" + SH.PRODUCTION + "'!$B$" + (DATA_ROW + PRODUCTION_ROWS.length); // totals row batter
  var prodNutella= "'" + SH.PRODUCTION + "'!$C$" + (DATA_ROW + PRODUCTION_ROWS.length);
  var prodCream  = "'" + SH.PRODUCTION + "'!$D$" + (DATA_ROW + PRODUCTION_ROWS.length);
  var prodWhite  = "'" + SH.PRODUCTION + "'!$E$" + (DATA_ROW + PRODUCTION_ROWS.length);
  var prodCheese = "'" + SH.PRODUCTION + "'!$F$" + (DATA_ROW + PRODUCTION_ROWS.length);
  var invVar = "'" + SH.INVENTORY + "'!$I$" + DATA_ROW + ':$I$' + (DATA_ROW + ITEMS.length - 1);
  var purNorm = rng(SH.PURCHASES, 'H');
  var dfDate = "'" + SH.DAILY_FINANCE + "'!$A$" + DATA_ROW + ':$A$' + (DATA_ROW + POS_DAYS.length - 1);
  var dfUnits= "'" + SH.DAILY_FINANCE + "'!$E$" + DATA_ROW + ':$E$' + (DATA_ROW + POS_DAYS.length - 1);
  var dfNet  = "'" + SH.DAILY_FINANCE + "'!$I$" + DATA_ROW + ':$I$' + (DATA_ROW + POS_DAYS.length - 1);
  var p = "'" + SH.PERIOD + "'";
  var slEnd  = DATA_ROW + POS_DAYS.length * PRODUCTS.length - 1;
  var slRev  = "'" + SH.SALES_LOG + "'!$E$" + DATA_ROW + ':$E$' + slEnd;
  var slCost = "'" + SH.SALES_LOG + "'!$F$" + DATA_ROW + ':$F$' + slEnd;

  var rows = [
    /* --- POS --- */
    ['POS', 'Ice cream flavours appear exactly once each',
      '=IF(COUNTIF(ProductNames,"Ice Cream - Vanilla")+COUNTIF(ProductNames,"Ice Cream - Chocolate")+COUNTIF(ProductNames,"Ice Cream - Strawberry")=3,"PASS","REVIEW")',
      'Canonical names, no duplicates'],
    ['POS', 'Product names in POS Raw not found in Product Master',
      '=SUMPRODUCT(--(' + posD + '<>""),--(COUNTIF(ProductNames,' + posD + ')=0))',
      '0 = every imported product is known'],
    ['POS', 'Rows with negative calculated units',
      '=COUNTIF(' + posG + ',"<0")',
      'Negative = reset/return/import issue, not a sale'],
    ['POS', 'Rows where previous stock != prior closing stock',
      '=COUNTIF(' + posI + ',"Check")',
      'Continuity of daily snapshots'],
    ['POS', 'Missing daily snapshots (operating days not imported)',
      '=COUNTA(' + dfDate + ')-COUNTIF(' + posA + ',">0")/COUNTA(ProductNames)',
      'Should be 0'],
    ['POS', 'Daily POS sale sum vs supplied period net',
      '=SUM(' + dfNet + ')-' + p + '!B' + (DATA_ROW + 7),
      'Known gap = -8; preserve both, do not force'], // value shown is the difference

    /* --- Production --- */
    ['Production', 'Documented batch totals match the daily records',
      '=IF(AND(' + prodBatter + '=21,' + prodNutella + '=17,' + prodCream + '=8,' + prodWhite + '=1,' + prodCheese + '=1),"PASS","REVIEW")',
      'Expected 21 / 17 / 8 / 1 / 1'],
    ['Production', 'Operating days missing from the production log',
      '=COUNTA(' + dfDate + ')-SUMPRODUCT(--(COUNTIF(' + prodDates + ',' + dfDate + ')>0))',
      '0 = every operating day logged'],
    ['Production', 'Oct 28 sold waffles on zero new batches',
      '=IF(AND(SUMIF(' + prodDates + ',DATE(2026,10,28),' + prodBatterCol + ')=0,SUMIF(' + dfDate + ',DATE(2026,10,28),' + dfUnits + ')>0),"REVIEW (expected carryover)","PASS")',
      'Carryover is valid — never auto-flag as error'],
    ['Production', 'Operating days with sales but zero batter produced',
      '=SUMPRODUCT(--(' + dfUnits + '>0),--(SUMIF(' + prodDates + ',' + dfDate + ',' + prodBatterCol + ')=0))',
      '1 expected (Oct 28 carryover) — not an error'],

    /* --- Ingredients --- */
    ['Ingredients', 'Items where manual remaining differs from calculated closing',
      '=SUMPRODUCT(--(ISNUMBER(' + invVar + ')),--(' + invVar + '<>0))',
      'Expected — recipes are incomplete'],
    ['Ingredients', 'Purchase lines still requiring a unit conversion',
      '=COUNTIF(' + purNorm + ',"Conversion required")',
      'jar / pack factors unconfirmed'],
    ['Ingredients', 'Consumed ingredients with no recipe defined',
      "=COUNTIF('" + SH.RECIPES + "'!$A$" + (DATA_ROW + RECIPE_ROWS.length + 2) + ":$A$" + (DATA_ROW + RECIPE_ROWS.length + 5) + ',"No recipe defined")',
      'Dark Chocolate, Cream Cheese, Cheese, toppings'],

    /* --- Financial --- */
    ['Financial', 'Sum of product revenue = gross POS sales (64,392)',
      '=IF(ROUND(SUM(' + slRev + '),0)=64392,"PASS","REVIEW")',
      'Sales Log revenue from supplied selling prices'],
    ['Financial', 'Sum of product cost = POS cost (30,659)',
      '=IF(ROUND(SUM(' + slCost + '),0)=30659,"PASS","REVIEW")',
      'Sales Log cost from supplied unit costs'],
    ['Financial', 'Gross POS sales = net + discount (expected 64,392)',
      '=IF(ROUND((' + p + '!B' + (DATA_ROW + 7) + '+' + p + '!B' + (DATA_ROW + 15) + '),0)=64392,"PASS","REVIEW")',
      'Reconciles to supplied figure'],
    ['Financial', 'Expected cash equals supplied cash in hand',
      '=IF(ROUND(' + p + '!B' + (DATA_ROW + 7) + '-' + p + '!B' + (DATA_ROW + 16) + '-' + p + '!B' + (DATA_ROW + 17) + ',' + '0)=ROUND(' + p + '!B' + (DATA_ROW + 10) + ',0),"PASS","REVIEW")',
      'Net - due - bazar = cash in hand'],
    ['Financial', 'Purchases re-entered as operating expenses (double count)',
      '=IF(SUM(' + rng(SH.EXPENSES, 'E') + ')=0,"PASS - no expenses recorded yet","REVIEW")',
      'Bazar must not be recorded twice'],
    ['Financial', 'POS profit labelled as actual business profit',
      '=IF(TRUE,"INFO","")',
      'POS profit is an estimate only — never call it net profit']
  ];

  fill(sheet, DATA_ROW, 1, rows);
  var last = DATA_ROW + rows.length - 1;

  setWidths(sheet, [[1, 120], [2, 360], [3, 160], [4, 300]]);
  sheet.getRange(DATA_ROW, 1, rows.length, 4).setVerticalAlignment('top').setWrap(true);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('PASS').setBackground(CLR.OK_BG)
      .setRanges([sheet.getRange(DATA_ROW, 3, rows.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('REVIEW').setBackground(CLR.WARN_BG)
      .setRanges([sheet.getRange(DATA_ROW, 3, rows.length, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('INFO').setBackground(CLR.SECTION_BG)
      .setRanges([sheet.getRange(DATA_ROW, 3, rows.length, 1)]).build()
  ]);
  freeze(sheet, HEADER_ROW, 0);
}
