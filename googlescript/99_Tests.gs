/**
 * Awwffle Inventory System — 99_Tests.gs
 *
 * Self-tests. Run `runAllTests()` from the Apps Script editor.
 *
 * These are not decorative: the expected values are taken from the source
 * workbook, so a passing run proves the rebuild still reproduces real business
 * numbers (README §14 "Test fixtures that already exist").
 *
 * Nothing here writes to the spreadsheet. Tests are pure functions wherever
 * possible so they can run before any sheet exists.
 */

/** Runs every test and reports pass/fail counts. */
function runAllTests() {
  var suites = [
    testUnitConversion,
    testAmountsMatchWorkbook,
    testItemMasterIntegrity,
    testAliasMapping,
    testDateHelpers,
    testMeasurementMatrix,
    testExpenseClassification,
    testDailyWaffleParsing,
    testReportRowFormatting,
    testBazarValidation,
    testBazarDuplicates,
    testBazarEditValidation,
    testSidebarContract,
    testBatchValidation,
    testMeasurementsValidation,
    testConsumptionFormula,
    testBatchFunctionsExist
  ];

  var passed = 0;
  var failures = [];

  suites.forEach(function (suite) {
    var result;
    try {
      result = suite();
    } catch (err) {
      failures.push(suite.name + ' threw: ' + err.message);
      return;
    }
    passed += result.passed;
    result.failures.forEach(function (f) { failures.push(suite.name + ' :: ' + f); });
  });

  var message = passed + ' passed';
  if (failures.length) {
    message += ', ' + failures.length + ' FAILED\n\n' + failures.join('\n');
    Logger.log(message);
  } else {
    message += ', 0 failed';
    Logger.log(message);
  }
  return { passed: passed, failures: failures, message: message };
}

// ---------------------------------------------------------------------------
// Tiny assertion harness
// ---------------------------------------------------------------------------

function newSuite_() {
  return { passed: 0, failures: [] };
}

function eq_(suite, label, actual, expected) {
  var a = typeof actual === 'number' ? round2_(actual) : actual;
  var e = typeof expected === 'number' ? round2_(expected) : expected;
  if (a === e) {
    suite.passed++;
  } else {
    suite.failures.push(label + ': expected ' + e + ', got ' + a);
  }
}

function closeTo_(suite, label, actual, expected, tolerance) {
  var tol = tolerance || 0.01;
  if (actual !== null && actual !== undefined && Math.abs(actual - expected) <= tol) {
    suite.passed++;
  } else {
    suite.failures.push(label + ': expected ~' + expected + ', got ' + actual);
  }
}

// ---------------------------------------------------------------------------
// Unit conversion — README §6.1, D7, D8
// ---------------------------------------------------------------------------

function testUnitConversion() {
  var s = newSuite_();

  // rateDivisor: gm and ml divide the rate, kg and l do not.
  eq_(s, 'rateDivisor kg', rateDivisor_('kg'), 1);
  eq_(s, 'rateDivisor l', rateDivisor_('l'), 1);
  eq_(s, 'rateDivisor p', rateDivisor_('p'), 1);
  eq_(s, 'rateDivisor gm', rateDivisor_('gm'), 1000);
  eq_(s, 'rateDivisor ml', rateDivisor_('ml'), 1000);

  // baseMultiplier: kg and l multiply the stock, gm and ml do not.
  eq_(s, 'baseMultiplier kg', baseMultiplier_('kg'), 1000);
  eq_(s, 'baseMultiplier l', baseMultiplier_('l'), 1000);
  eq_(s, 'baseMultiplier gm', baseMultiplier_('gm'), 1);
  eq_(s, 'baseMultiplier ml', baseMultiplier_('ml'), 1);

  // Piece items with a known weight (D8).
  eq_(s, 'baseMultiplier p default', baseMultiplier_('p'), 1);
  eq_(s, 'baseMultiplier Nutella 350', baseMultiplier_('p', 350), 350);
  eq_(s, 'baseMultiplier Whipped 1000', baseMultiplier_('p', 1000), 1000);

  // The gm/kg opposition is the specific bug this test exists to prevent.
  eq_(s, 'gm and kg are opposite', rateDivisor_('gm') / baseMultiplier_('gm'),
                                  1000 / (rateDivisor_('kg') * baseMultiplier_('kg')) * 1000);

  return s;
}

// ---------------------------------------------------------------------------
// Monetary amounts — verified against the workbook's own stored values
// ---------------------------------------------------------------------------

function testAmountsMatchWorkbook() {
  var s = newSuite_();

  // Stock sheet rows: name, qty, unit, rate, expected amount, expected base qty
  var rows = [
    ['Flour',             37.5, 'kg', 67,   2512.5,  37500],
    ['Corn Flour',          8.5, 'kg', 190,  1615,     8500],
    ['B. Powder',         800,   'gm', 450,   360,      800],
    ['B. Soda',           350,   'gm', 60,     21,      350],
    ['Egg',               271,   'p',  10,   2710,      271],
    ['Milk',               39.5, 'l',  80,   3160,    39500],
    ['Oil',              23.25,  'l',  200,  4650,    23250],
    ['Vanilla',           550,   'gm', 2600, 1430,      550],
    ['Nutella',            22,   'p',  830, 18260,     7700],
    ['Whipped Cream',      12,   'p',  215,  2580,    12000],
    ['Chocolate Sprinkles', 400, 'gm', 1300,  520,      400],
    ['Poly bag',           1.5,  'kg', 274,   411,     1500]
  ];

  rows.forEach(function (row) {
    var name = row[0], qty = row[1], unit = row[2], rate = row[3];
    var expectedAmount = row[4], expectedBase = row[5];
    var item = findItem_(name);

    eq_(s, 'amount ' + name, amountFor_(qty, unit, rate), expectedAmount);

    var perPiece = item && item.perPieceWeight ? item.perPieceWeight : null;
    eq_(s, 'base qty ' + name, toBaseQuantity_(qty, unit, perPiece), expectedBase);
  });

  // The historical defect: one Bazar row entered Milk in 'p' instead of 'l'.
  // Both are 1:1 for the rate, so the amount is the same — only the stock basis differs.
  eq_(s, 'Milk in litres amount', amountFor_(6, 'l', 80), 480);
  eq_(s, 'Milk in litres base', toBaseQuantity_(6, 'l', null), 6000);

  return s;
}

// ---------------------------------------------------------------------------
// Item master integrity — README §4
// ---------------------------------------------------------------------------

function testItemMasterIntegrity() {
  var s = newSuite_();

  eq_(s, 'item count is 43', ITEMS.length, 43);

  // Every name must be unique after normalisation.
  var seen = {};
  var duplicates = [];
  ITEMS.forEach(function (i) {
    var key = normaliseItemName_(i.name);
    if (seen[key]) duplicates.push(i.name);
    seen[key] = true;
  });
  eq_(s, 'no duplicate names', duplicates.join(', '), '');

  // No leading or trailing whitespace anywhere (D10).
  var dirty = ITEMS.filter(function (i) {
    return i.name !== i.name.trim() || /\s{2,}/.test(i.name);
  }).map(function (i) { return i.name; });
  eq_(s, 'names are trimmed', dirty.join(', '), '');

  // Group counts per README §4.
  var counts = { Recipes: 0, Toppings: 0, Equipments: 0 };
  ITEMS.forEach(function (i) { counts[i.group]++; });
  eq_(s, 'Recipes count', counts.Recipes, 17);
  eq_(s, 'Toppings count', counts.Toppings, 16);
  eq_(s, 'Equipments count', counts.Equipments, 10);

  // Every item has a valid unit and base unit.
  var badUnits = ITEMS.filter(function (i) {
    return !UNIT_RULES[i.unit] || [ 'gm', 'ml', 'p' ].indexOf(i.baseUnit) === -1;
  }).map(function (i) { return i.name; });
  eq_(s, 'all units valid', badUnits.join(', '), '');

  // Piece items with a non-count basis must declare a per-piece weight (D8).
  var missingWeight = ITEMS.filter(function (i) {
    return i.unit === 'p' && i.baseUnit !== 'p' && !i.perPieceWeight;
  }).map(function (i) { return i.name; });
  eq_(s, 'piece items with weight declared', missingWeight.join(', '), '');

  // Specific unit rules the README calls out (§6.1).
  eq_(s, 'B. Powder held in gm', findItem_('B. Powder').unit, 'gm');
  eq_(s, 'Vanilla held in gm', findItem_('Vanilla').unit, 'gm');
  eq_(s, 'Chocolate Sprinkles held in gm', findItem_('Chocolate Sprinkles').unit, 'gm');
  eq_(s, 'Milk held in l', findItem_('Milk').unit, 'l');
  eq_(s, 'Oil held in l', findItem_('Oil').unit, 'l');
  eq_(s, 'Nutella held in pieces', findItem_('Nutella').unit, 'p');
  eq_(s, 'Nutella per piece 350', findItem_('Nutella').perPieceWeight, 350);
  eq_(s, 'Whipped Cream per piece 1000', findItem_('Whipped Cream').perPieceWeight, 1000);

  // Populations (§3.3, §13.G1).
  eq_(s, 'Water is resale', findItem_('Water').population, POPULATION.RESALE);
  eq_(s, 'Water links to POS', findItem_('Water').posLink, 'Water 500ml');
  eq_(s, 'Ice cream vanilla is manual', findItem_('Ice cream (vanilla)').population, POPULATION.MANUAL);
  eq_(s, 'Ice cream chocolate is manual', findItem_('Ice cream (chocolate)').population, POPULATION.MANUAL);
  eq_(s, 'Ice cream strawberry is manual', findItem_('Ice cream (strawberry)').population, POPULATION.MANUAL);

  // Only Water may be POS-linked (§12 non-goal).
  var posLinked = ITEMS.filter(function (i) { return i.posLink; }).map(function (i) { return i.name; });
  eq_(s, 'only Water has a POS link', posLinked.join(','), 'Water');

  // Empty Container must not exist (§3.1, §9).
  eq_(s, 'Empty Container absent', findItem_('Empty Container'), null);

  // Corrected names are present, defective ones absent (D10).
  // Note: findItem_ normalises whitespace, so it deliberately tolerates a padded
  // lookup. The stored names themselves are what must be clean, so test the array.
  var storedNames = ITEMS.map(function (i) { return i.name; });
  eq_(s, 'Kitkat canonical', storedNames.indexOf('Kitkat') !== -1, true);
  eq_(s, 'Kitkat stored without trailing space', storedNames.indexOf('Kitkat ') === -1, true);
  eq_(s, 'Syrup Hersheys canonical', storedNames.indexOf('Syrup Hersheys') !== -1, true);
  eq_(s, 'Syrup stored without leading space', storedNames.indexOf(' Syrup Hersheys') === -1, true);

  // The tolerant lookup is still expected to resolve a padded historical name.
  eq_(s, 'padded lookup still resolves', findItem_('Kitkat ') !== null, true);

  // POS product list (D2).
  eq_(s, 'POS product count', POS_PRODUCTS.length, 18);
  eq_(s, 'first product is an extra', POS_PRODUCTS[0].kind, 'extra');
  eq_(s, 'first product is Extra Banana', POS_PRODUCTS[0].name, 'Extra Banana');
  eq_(s, 'last product is Awwffle', POS_PRODUCTS[POS_PRODUCTS.length - 1].name, 'Awwffle');
  eq_(s, 'waffle count', POS_PRODUCTS.filter(function (p) { return p.kind === 'waffle'; }).length, 12);
  eq_(s, 'extra count', POS_PRODUCTS.filter(function (p) { return p.kind === 'extra'; }).length, 6);

  return s;
}

// ---------------------------------------------------------------------------
// Alias mapping — migration only, README §9
// ---------------------------------------------------------------------------

function testAliasMapping() {
  var s = newSuite_();

  eq_(s, 'alias Kitkat (4 fingers)', resolveAlias_('Kitkat (4 fingers)'), 'Kitkat');
  eq_(s, 'alias Kitkat bare', resolveAlias_('Kitkat'), 'Kitkat');
  eq_(s, 'alias Kitkat padded', resolveAlias_('Kitkat '), 'Kitkat');
  eq_(s, 'alias Waffle Stick', resolveAlias_('Waffle Stick'), 'Waffle Sticks Large');
  eq_(s, 'alias Poly Bag', resolveAlias_('Poly Bag'), 'Poly bag');
  eq_(s, 'alias Syrup padded', resolveAlias_(' Syrup Hersheys'), 'Syrup Hersheys');

  // A clean canonical name resolves to itself.
  eq_(s, 'exact name resolves', resolveAlias_('Flour'), 'Flour');

  // Unknown names must not silently resolve.
  eq_(s, 'unknown returns null', resolveAlias_('Unobtanium'), null);

  // The ingredient and the finished product are different things (§13.C20).
  eq_(s, 'Kitkat is not Kit-Kat Kraze', resolveAlias_('Kit-Kat Kraze'), null);

  return s;
}

// ---------------------------------------------------------------------------
// Dates and open-day arithmetic — README §8.4
// ---------------------------------------------------------------------------

function testDateHelpers() {
  var s = newSuite_();

  eq_(s, 'dateKey ISO', dateKey_('2026-10-17'), '2026-10-17');
  eq_(s, 'dateKey from Date', dateKey_(new Date(2026, 9, 17)), '2026-10-17');
  eq_(s, 'dateKey dd/mm/yyyy', dateKey_('17/10/2026'), '2026-10-17');

  // A yyyy-mm-dd string must NOT be parsed as UTC. `new Date('2026-11-18')` is
  // UTC midnight, which is the previous day in any timezone behind UTC — a
  // silent one-day shift on every saved date. Parsing must be explicit.
  eq_(s, 'ISO date keeps its day', dateKey_('2026-11-18'), '2026-11-18');
  eq_(s, 'ISO date is local midnight',
    toDate_('2026-11-18').getHours(), 0);
  eq_(s, 'ISO date day-of-month', toDate_('2026-11-18').getDate(), 18);
  eq_(s, 'ISO date month', toDate_('2026-11-18').getMonth(), 10);   // zero-based
  eq_(s, 'ISO round-trip', dateKey_(toDate_('2026-11-18')), '2026-11-18');

  // End of month and year boundaries must survive the round trip.
  eq_(s, 'month end round-trip', dateKey_(toDate_('2026-10-31')), '2026-10-31');
  eq_(s, 'year end round-trip', dateKey_(toDate_('2026-12-31')), '2026-12-31');
  eq_(s, 'leap day round-trip', dateKey_(toDate_('2028-02-29')), '2028-02-29');

  eq_(s, 'days inclusive single', daysBetweenInclusive_('2026-10-17', '2026-10-17'), 1);
  eq_(s, 'days inclusive span', daysBetweenInclusive_('2026-10-17', '2026-11-16'), 31);

  eq_(s, 'range length', dateRange_('2026-10-17', '2026-10-19').length, 3);
  eq_(s, 'range empty when reversed', dateRange_('2026-10-19', '2026-10-17').length, 0);

  // Bad input must not become the year 2000 or NaN.
  eq_(s, 'null date', toDate_(null), null);
  eq_(s, 'garbage date', toDate_('not a date'), null);

  return s;
}

// ---------------------------------------------------------------------------
// Recipe matrix — README §3.1
// ---------------------------------------------------------------------------

function testMeasurementMatrix() {
  var s = newSuite_();

  eq_(s, 'measurement row count', MEASUREMENTS_SEED.length, 17);

  // Blanks must stay blank, not become zero — this is the specific §3.1 rule.
  var flour = MEASUREMENTS_SEED.filter(function (r) { return r.ingredient === 'Flour'; })[0];
  eq_(s, 'Flour Batter value', flour.Batter, 500);
  eq_(s, 'Flour Cream is blank not zero', flour.Cream, '');
  eq_(s, 'Flour Cream is not 0', flour.Cream === 0, false);

  // A shared ingredient across preparations.
  var butter = MEASUREMENTS_SEED.filter(function (r) { return r.ingredient === 'Butter'; })[0];
  eq_(s, 'Butter in Batter', butter.Batter, 150);
  eq_(s, 'Butter in Nutella Mix', butter['Nutella Mix'], 120);
  eq_(s, 'Butter in Cream is blank', butter.Cream, '');
  eq_(s, 'Butter in White Mix', butter['White Mix'], 150);
  eq_(s, 'Butter in Cheese', butter.Cheese, 60);

  eq_(s, 'Empty Container excluded',
      MEASUREMENTS_SEED.some(function (r) { return r.ingredient === 'Empty Container'; }), false);

  // Every measurement ingredient must exist in the item master.
  var orphans = MEASUREMENTS_SEED.filter(function (r) {
    return findItem_(r.ingredient) === null;
  }).map(function (r) { return r.ingredient; });
  eq_(s, 'no measurement orphans', orphans.join(', '), '');

  // Accessor respects blanks.
  eq_(s, 'measurementFor Flour/Batter', measurementFor_('Flour', 'Batter'), 500);
  eq_(s, 'measurementFor Flour/Cream', measurementFor_('Flour', 'Cream'), 0);
  eq_(s, 'isRecipeIngredient Flour', isRecipeIngredient_('Flour'), true);
  eq_(s, 'isRecipeIngredient Tissue', isRecipeIngredient_('Tissue'), false);

  return s;
}

// ---------------------------------------------------------------------------
// Expense classification — README §5.3, §9, D1
// ---------------------------------------------------------------------------

function testExpenseClassification() {
  var s = newSuite_();

  // Non-inventory names from the source map to their expense type (§5.3).
  var salary = classifyExpense_('Salary');
  eq_(s, 'Salary type', salary.expenseType, 'Salary');
  eq_(s, 'Salary never touches stock', salary.expenseType === EXPENSE_TYPE_INVENTORY, false);

  var courier = classifyExpense_('Currier Charge');
  eq_(s, 'Currier Charge -> Courier', courier.expenseType, 'Courier');
  eq_(s, 'Currier reported as alias', courier.aliasUsed, true);

  var insect = classifyExpense_('Insect Light');
  eq_(s, 'Insect Light -> Maintenance', insect.expenseType, 'Maintenance');

  // An ordinary item is an inventory purchase.
  var flour = classifyExpense_('Flour');
  eq_(s, 'Flour -> Inventory purchase', flour.expenseType, EXPENSE_TYPE_INVENTORY);
  eq_(s, 'Flour item name', flour.itemName, 'Flour');

  // Aliases resolve to canonical names.
  eq_(s, 'Kitkat alias item', classifyExpense_('Kitkat (4 fingers)').itemName, 'Kitkat');
  eq_(s, 'Waffle Stick alias', classifyExpense_('Waffle Stick').itemName, 'Waffle Sticks Large');
  eq_(s, 'Poly Bag alias', classifyExpense_('Poly Bag').itemName, 'Poly bag');
  eq_(s, 'padded Syrup alias', classifyExpense_(' Syrup Hersheys').itemName, 'Syrup Hersheys');

  // Padded and unpadded Kitkat are the same item, both flagged as alias hits.
  eq_(s, 'Kitkat padded is alias', classifyExpense_('Kitkat ').aliasUsed, true);
  eq_(s, 'Kitkat clean is not alias', classifyExpense_('Kitkat').aliasUsed, false);
  eq_(s, 'padded Syrup is alias', classifyExpense_(' Syrup Hersheys').aliasUsed, true);
  eq_(s, 'clean Syrup is not alias', classifyExpense_('Syrup Hersheys').aliasUsed, false);

  // Unknown names must be flagged, never silently created (§5.3).
  var unknown = classifyExpense_('Unobtanium');
  eq_(s, 'unknown flagged', unknown.unknown, true);
  eq_(s, 'unknown is Other', unknown.expenseType, 'Other');
  eq_(s, 'unknown has no item', unknown.itemName, '');

  // The finished product is not an ingredient (§13.C20).
  eq_(s, 'Kit-Kat Kraze is unknown as item', classifyExpense_('Kit-Kat Kraze').unknown, true);

  return s;
}

// ---------------------------------------------------------------------------
// Daily Waffles block parsing — README §17.7, D4
// ---------------------------------------------------------------------------

function testDailyWaffleParsing() {
  var s = newSuite_();

  // The tricky part: the date-label row ALSO carries the first product.
  eq_(s, 'parseDayLabel Oct 17', dateKey_(parseDayLabel_('Oct 17: Day 1', 2026)), '2026-10-17');
  eq_(s, 'parseDayLabel Nov 16', dateKey_(parseDayLabel_('Nov 16: Day 28', 2026)), '2026-11-16');
  eq_(s, 'parseDayLabel rejects junk', parseDayLabel_('Batch: B1:N1:C0', 2026), null);
  eq_(s, 'parseDayLabel rejects numbers', parseDayLabel_('2891.0', 2026), null);

  // A block-shaped fixture, including the footer and a stray numeric row.
  var fixture = [
    ['Date', 'Product', 'Pv. Stock', 'Cr. Stock', 'Waffles'],
    ['Oct 17: Day 1', 'Extra Banana', 10000, 10000, 0],
    ['', 'Extra Nut', 10000, 10000, 0],
    ['', 'Water 500ml', 10000, 9999, 1],
    ['', 'Batch: B1:N1:C0', '', '', 28],
    ['', 2891, '', '', ''],
    ['Oct 18: Day 2', 'Extra Banana', 10000, 9998, 2]
  ];
  var fakeSheet = {
    getLastRow: function () { return fixture.length; },
    getRange: function () {
      return { getValues: function () { return fixture; } };
    }
  };

  var blocks = parseDailyWaffleBlocks_(fakeSheet);
  eq_(s, 'blocks parsed', blocks.length, 2);
  eq_(s, 'first block product count', blocks[0].products.length, 3);
  eq_(s, 'first product is on the label row', blocks[0].products[0].product, 'Extra Banana');
  eq_(s, 'footer captured', blocks[0].footer.label, 'Batch: B1:N1:C0');
  eq_(s, 'footer total', toNumber_(blocks[0].footer.total), 28);
  eq_(s, 'stray numeric row ignored', blocks[0].products.length, 3);
  eq_(s, 'second block has its own products', blocks[1].products.length, 1);
  eq_(s, 'second block date', dateKey_(blocks[1].date), '2026-10-18');

  return s;
}

// ---------------------------------------------------------------------------
// Reconciliation report formatting — README §9.9
// ---------------------------------------------------------------------------

function testReportRowFormatting() {
  var s = newSuite_();

  var ok = reportRow_('Bazar', 'Rows imported', 72, 72, true, '');
  eq_(s, 'ok row section', ok[0], 'Bazar');
  eq_(s, 'ok row status', ok[5], 'OK');
  eq_(s, 'ok row difference', ok[4], 0);

  var bad = reportRow_('Bazar', 'Rows imported', 72, 70, false, 'two missing');
  eq_(s, 'bad row status', bad[5], 'CHECK');
  eq_(s, 'bad row difference', bad[4], -2);

  // Non-numeric expectations must not produce a bogus numeric difference.
  var text = reportRow_('POS', 'Sold == prev - curr', 'all rows', 'all rows', true, '');
  eq_(s, 'text row status', text[5], 'OK');

  return s;
}

// ---------------------------------------------------------------------------
// Bazar validation — README §5, §11, §13.C18
// ---------------------------------------------------------------------------

/**
 * All of these run against an empty existing-record list, so they exercise pure
 * validation with no spreadsheet access.
 */
function testBazarValidation() {
  var s = newSuite_();
  var none = [];

  var valid = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T1',
    lines: [{ item: 'Flour', quantity: 10, unit: 'kg', rate: 80 }]
  }, none);
  eq_(s, 'valid invoice accepted', valid.ok, true);
  eq_(s, 'valid invoice total', valid.total, 800);
  eq_(s, 'one row built', valid.rows.length, 1);

  // Derived columns.
  var row = valid.rows[0];
  eq_(s, 'amount derived not typed', row[8], 800);
  eq_(s, 'base qty kg->gm', row[12], 10000);
  eq_(s, 'inventory row affects stock', row[13], true);
  eq_(s, 'canonical item stored', row[3], 'Flour');

  // gm/ml divide the rate; kg/l/p do not (D7).
  var gm = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
    lines: [{ item: 'B. Powder', quantity: 800, unit: 'gm', rate: 450 }]
  }, none);
  eq_(s, 'gm amount divides by 1000', gm.total, 360);
  eq_(s, 'gm base qty identity', gm.rows[0][12], 800);

  // Piece item with a known per-piece weight (D8).
  var nutella = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
    lines: [{ item: 'Nutella', quantity: 2, unit: 'p', rate: 830 }]
  }, none);
  eq_(s, 'piece amount', nutella.total, 1660);
  eq_(s, 'Nutella 2 pieces = 700 gm', nutella.rows[0][12], 700);

  // Non-inventory: no stock impact, no item, amount is the money.
  var salary = validateBazarInvoice_({
    date: '2026-11-17', expenseType: 'Salary',
    lines: [{ expenseName: 'Monthly salary', quantity: 5000, unit: 'p', rate: 1 }]
  }, none);
  eq_(s, 'salary accepted', salary.ok, true);
  eq_(s, 'salary amount', salary.total, 5000);
  eq_(s, 'salary affects stock false', salary.rows[0][13], false);
  eq_(s, 'salary has no item', salary.rows[0][3], '');
  eq_(s, 'salary has no base qty', salary.rows[0][12], '');
  eq_(s, 'salary keeps its name', salary.rows[0][4], 'Monthly salary');

  // Rejections.
  eq_(s, 'missing date rejected',
    validateBazarInvoice_({ date: '', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 1 }] }, none).ok, false);

  eq_(s, 'missing expense type rejected',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: '',
      lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 1 }] }, none).ok, false);

  eq_(s, 'no lines rejected',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [] }, none).ok, false);

  eq_(s, 'zero quantity rejected',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: 0, unit: 'kg', rate: 1 }] }, none).ok, false);

  eq_(s, 'negative quantity rejected',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: -5, unit: 'kg', rate: 80 }] }, none).ok, false);

  eq_(s, 'unsupported unit rejected',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: 5, unit: 'lb', rate: 80 }] }, none).ok, false);

  eq_(s, 'pounds are not a unit', ENTRY_UNITS.indexOf('lb'), -1);

  eq_(s, 'future date rejected',
    validateBazarInvoice_({ date: '2099-01-01', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: 5, unit: 'kg', rate: 80 }] }, none).ok, false);

  // Unknown item must be rejected, never silently created (§5.3).
  var unknown = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
    lines: [{ item: 'Unobtanium', quantity: 1, unit: 'kg', rate: 10 }]
  }, none);
  eq_(s, 'unknown item rejected', unknown.ok, false);
  eq_(s, 'unknown item message names the master',
    unknown.errors.join(' ').indexOf('item master') !== -1, true);

  // Non-inventory needs a name.
  eq_(s, 'non-inventory needs a name',
    validateBazarInvoice_({ date: '2026-11-17', expenseType: 'Salary',
      lines: [{ expenseName: '', quantity: 100, unit: 'p', rate: 1 }] }, none).ok, false);

  return s;
}

// ---------------------------------------------------------------------------
// Bazar duplicate guard — README §11 "prevent duplicate submissions"
// ---------------------------------------------------------------------------

function testBazarDuplicates() {
  var s = newSuite_();
  var payload = {
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T1',
    lines: [{ item: 'Flour', quantity: 10, unit: 'kg', rate: 80 }]
  };

  // An identical existing line on the same date and ref.
  var existing = [{
    'Date': new Date(2026, 10, 17),
    'Item': 'Flour', 'Expense Name': '',
    'Quantity': 10, 'Unit': 'kg', 'Rate': 80, 'Ref': '#T1'
  }];

  var dup = validateBazarInvoice_(payload, existing);
  eq_(s, 'duplicate rejected', dup.ok, false);
  eq_(s, 'duplicate message mentions duplicate',
    dup.errors.join(' ').indexOf('duplicate') !== -1, true);

  // A different ref is a genuine second purchase of the same item.
  var otherRef = {
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T2',
    lines: [{ item: 'Flour', quantity: 10, unit: 'kg', rate: 80 }]
  };
  eq_(s, 'same line different ref allowed', validateBazarInvoice_(otherRef, existing).ok, true);

  // A different quantity is not a duplicate.
  var otherQty = {
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T1',
    lines: [{ item: 'Flour', quantity: 12, unit: 'kg', rate: 80 }]
  };
  eq_(s, 'different quantity allowed', validateBazarInvoice_(otherQty, existing).ok, true);

  // A different day is not a duplicate.
  var otherDay = {
    date: '2026-11-18', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T1',
    lines: [{ item: 'Flour', quantity: 10, unit: 'kg', rate: 80 }]
  };
  eq_(s, 'different date allowed', validateBazarInvoice_(otherDay, existing).ok, true);

  // Alias spelling must still be recognised as the same item (§13.C20).
  var aliasSpelling = {
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#T1',
    lines: [{ item: 'Kitkat', quantity: 2, unit: 'p', rate: 70 }]
  };
  var kitkatExisting = [{
    'Date': new Date(2026, 10, 17),
    'Item': 'Kitkat', 'Quantity': 2, 'Unit': 'p', 'Rate': 70, 'Ref': '#T1'
  }];
  eq_(s, 'same item same ref duplicate', validateBazarInvoice_(aliasSpelling, kitkatExisting).ok, false);

  return s;
}

// ---------------------------------------------------------------------------
// Bazar edit path — must obey the same rules as create
// ---------------------------------------------------------------------------

/**
 * Editing reuses validateBazarInvoice_, so the critical property to prove is that
 * a line does not collide with ITSELF. Without excluding the edited record, saving
 * a line unchanged would be rejected as a duplicate.
 */
function testBazarEditValidation() {
  var s = newSuite_();

  // Public surface the sidebar calls.
  eq_(s, 'getRecentBazarLines is public', typeof getRecentBazarLines, 'function');
  eq_(s, 'getBazarLine is public', typeof getBazarLine, 'function');
  eq_(s, 'updateBazarLine is public', typeof updateBazarLine, 'function');
  eq_(s, 'deleteBazarLine is public', typeof deleteBazarLine, 'function');

  // The server excludes the edited row before validating, so an unchanged save
  // passes. Simulate that: validate against the OTHER rows only.
  var editedPayload = {
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#E1',
    status: 'Paid',
    lines: [{ item: 'Flour', quantity: 10, unit: 'kg', rate: 80 }]
  };

  // The row being edited, as it currently exists.
  var selfRow = {
    'Date': new Date(2026, 10, 17), 'Item': 'Flour', 'Expense Name': '',
    'Quantity': 10, 'Unit': 'kg', 'Rate': 80, 'Ref': '#E1'
  };

  // Validated against itself, it looks like a duplicate...
  eq_(s, 'self looks like a duplicate if not excluded',
    validateBazarInvoice_(editedPayload, [selfRow]).ok, false);

  // ...but validated against the other rows only (what updateBazarLine_ does),
  // the same save is accepted.
  eq_(s, 'unchanged edit accepted when self excluded',
    validateBazarInvoice_(editedPayload, []).ok, true);

  // A genuine clash with a DIFFERENT row is still caught.
  var otherRow = {
    'Date': new Date(2026, 10, 17), 'Item': 'Sugar', 'Expense Name': '',
    'Quantity': 5, 'Unit': 'kg', 'Rate': 106, 'Ref': '#E2'
  };
  var clash = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, ref: '#E2',
    status: 'Paid',
    lines: [{ item: 'Sugar', quantity: 5, unit: 'kg', rate: 106 }]
  }, [otherRow]);
  eq_(s, 'editing into another row still rejected', clash.ok, false);

  // Edits are validated exactly like new lines.
  eq_(s, 'edit rejects unknown item',
    validateBazarInvoice_({
      date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Unobtanium', quantity: 1, unit: 'kg', rate: 10 }]
    }, []).ok, false);

  eq_(s, 'edit rejects future date',
    validateBazarInvoice_({
      date: '2099-01-01', expenseType: EXPENSE_TYPE_INVENTORY,
      lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 10 }]
    }, []).ok, false);

  eq_(s, 'edit rejects bad status',
    validateBazarInvoice_({
      date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, status: 'Nope',
      lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 10 }]
    }, []).ok, false);

  // An edited amount is recomputed, never taken from the payload.
  var revalued = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY,
    lines: [{ item: 'Flour', quantity: 12, unit: 'kg', rate: 85 }]
  }, []);
  eq_(s, 'edited amount recomputed', revalued.total, 1020);
  eq_(s, 'edited base quantity recomputed', revalued.rows[0][12], 12000);

  return s;
}

// ---------------------------------------------------------------------------
// Sidebar contract — the bug that made every dropdown empty
// ---------------------------------------------------------------------------

/**
 * `google.script.run` can only call PUBLIC functions: a name ending in `_` is
 * invisible to it. A mismatch produces no error — the sidebar just renders empty,
 * which looks like a UI bug and is hard to diagnose.
 *
 * This test pins the exact names the sidebar calls.
 */
function testSidebarContract() {
  var s = newSuite_();

  // The three names hard-coded in ui/Sidebar_Bazar.html.
  eq_(s, 'getBazarFormOptions is public', typeof getBazarFormOptions, 'function');
  eq_(s, 'addBazarInvoice is public', typeof addBazarInvoice, 'function');
  eq_(s, 'bazarInvoices is public', typeof bazarInvoices, 'function');

  // No trailing underscore on the callable boundary.
  eq_(s, 'getBazarFormOptions has no trailing _', /_$/.test('getBazarFormOptions'), false);
  eq_(s, 'addBazarInvoice has no trailing _', /_$/.test('addBazarInvoice'), false);
  eq_(s, 'bazarInvoices has no trailing _', /_$/.test('bazarInvoices'), false);

  // Status list drives the dropdown, and uses the owner's wording.
  eq_(s, 'status list is Paid/Due', BAZAR_STATUSES.join('|'), 'Paid|Due');
  eq_(s, 'status list excludes Unpaid', BAZAR_STATUSES.indexOf('Unpaid'), -1);

  // An unknown status must be rejected rather than written.
  var badStatus = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, status: 'Unpaid',
    lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 80 }]
  }, []);
  eq_(s, 'unknown status rejected', badStatus.ok, false);

  var goodStatus = validateBazarInvoice_({
    date: '2026-11-17', expenseType: EXPENSE_TYPE_INVENTORY, status: 'Due',
    lines: [{ item: 'Flour', quantity: 1, unit: 'kg', rate: 80 }]
  }, []);
  eq_(s, 'Due status accepted', goodStatus.ok, true);
  eq_(s, 'Due status stored', goodStatus.rows[0][10], 'Due');

  return s;
}

// ---------------------------------------------------------------------------
// Batch validation — README §3.2
// ---------------------------------------------------------------------------

function testBatchValidation() {
  var s = newSuite_();

  var good = validateBatch_({
    date: '2026-11-17',
    values: { 'Batter': 1.5, 'Nutella Mix': 1, 'Cream': 0.5, 'White Mix': '', 'Cheese': '' }
  });
  eq_(s, 'valid batch accepted', good.ok, true);
  eq_(s, 'fractional batches allowed', good.values['Batter'], 1.5);
  eq_(s, 'fractional total', good.total, 3);
  // Batches store 0 rather than blank: "we made none" is a real fact, and it
  // matches the source workbook, which stored 0.0 in these cells.
  eq_(s, 'blank stored as 0', good.values['White Mix'], 0);
  eq_(s, 'blank is a number not a string', typeof good.values['White Mix'], 'number');

  var zero = validateBatch_({ date: '2026-11-17', values: { 'Batter': 0, 'Cream': 1 } });
  eq_(s, 'explicit zero stored as 0', zero.values['Batter'], 0);
  eq_(s, 'zero plus real value sums correctly', zero.total, 1);

  eq_(s, 'empty batch rejected',
    validateBatch_({ date: '2026-11-17', values: { 'Batter': '', 'Cream': '' } }).ok, false);
  eq_(s, 'all-zero batch rejected',
    validateBatch_({ date: '2026-11-17', values: { 'Batter': 0 } }).ok, false);
  eq_(s, 'negative rejected',
    validateBatch_({ date: '2026-11-17', values: { 'Batter': -1 } }).ok, false);
  eq_(s, 'non-numeric rejected',
    validateBatch_({ date: '2026-11-17', values: { 'Batter': 'abc' } }).ok, false);
  eq_(s, 'missing date rejected',
    validateBatch_({ date: '', values: { 'Batter': 1 } }).ok, false);
  eq_(s, 'future date rejected',
    validateBatch_({ date: '2099-01-01', values: { 'Batter': 1 } }).ok, false);
  eq_(s, 'no payload rejected', validateBatch_(null).ok, false);

  // A batch on a closed day is legitimate (the source has Wednesday batches) but warns.
  var closed = validateBatch_({ date: '2026-11-04', values: { 'Batter': 1 } }, true);
  eq_(s, 'closed-day batch still saves', closed.ok, true);
  eq_(s, 'closed-day batch warns', closed.warnings.length > 0, true);

  var open = validateBatch_({ date: '2026-11-04', values: { 'Batter': 1 } }, false);
  eq_(s, 'open-day batch does not warn', open.warnings.length, 0);

  return s;
}

// ---------------------------------------------------------------------------
// Measurements validation — README §3.1, §9
// ---------------------------------------------------------------------------

function testMeasurementsValidation() {
  var s = newSuite_();

  // The seed itself must satisfy every rule, since it is what seeds the sheet.
  eq_(s, 'seed has 17 ingredients', MEASUREMENTS_SEED.length, 17);

  var excluded = MEASUREMENTS_SEED.filter(function (r) {
    return normaliseItemName_(r.ingredient) === 'empty container' ||
           normaliseItemName_(r.ingredient) === 'waste';
  });
  eq_(s, 'seed excludes Empty Container and Waste', excluded.length, 0);

  var orphans = MEASUREMENTS_SEED.filter(function (r) { return !findItem_(r.ingredient); });
  eq_(s, 'every seed ingredient is in the item master', orphans.length, 0);

  // Blanks must be empty strings, never 0 (§3.1).
  var flour = MEASUREMENTS_SEED.filter(function (r) { return r.ingredient === 'Flour'; })[0];
  eq_(s, 'Flour Batter', flour.Batter, 500);
  eq_(s, 'Flour Cream is blank string', flour.Cream, '');
  eq_(s, 'Flour Cream is not numeric zero', typeof flour.Cream, 'string');

  // Blank must read as 0 through the accessor, without becoming a stored zero.
  eq_(s, 'measurementFor blank returns 0', measurementFor_('Flour', 'Cream'), 0);
  eq_(s, 'measurementFor real value', measurementFor_('Butter', 'Cheese'), 60);

  return s;
}

// ---------------------------------------------------------------------------
// Consumption formula — Measurements x Batches (README §3.3)
// ---------------------------------------------------------------------------

/**
 * The whole point of Phase 5 is that these numbers are exact. Expected values are
 * the source workbook's own Stock.TotalUsed for the real batch totals.
 */
function testConsumptionFormula() {
  var s = newSuite_();

  var totals = { 'Batter': 33.5, 'Nutella Mix': 25, 'Cream': 13, 'White Mix': 1, 'Cheese': 1 };

  var expected = [
    ['Flour', 16750], ['Corn Flour', 5025], ['Sugar', 3350], ['Salt', 201],
    ['B. Powder', 335], ['B. Soda', 201], ['Egg', 201], ['Milk', 33500],
    ['Oil', 19250], ['Butter', 8235], ['Vanilla', 335], ['Nutella', 4375],
    ['White Chocolate', 500], ['Milk Chocolate', 13750], ['Icing Sugar', 680],
    ['Whipped Cream', 6700], ['Cream Cheese', 175]
  ];

  expected.forEach(function (pair) {
    eq_(s, 'consumption ' + pair[0], consumptionFromSeed_(pair[0], totals), pair[1]);
  });

  // An ingredient used in exactly one preparation.
  eq_(s, 'Butter Batter component', 150 * 33.5, 5025);
  eq_(s, 'Butter Cheese component', 60 * 1, 60);
  eq_(s, 'Butter total', 5025 + 120 * 25 + 150 * 1 + 60 * 1, 8235);

  return s;
}

/** Seed-based consumption, mirroring ingredientConsumption_ without sheet access. */
function consumptionFromSeed_(ingredient, totals) {
  var row = null;
  for (var i = 0; i < MEASUREMENTS_SEED.length; i++) {
    if (MEASUREMENTS_SEED[i].ingredient === ingredient) { row = MEASUREMENTS_SEED[i]; break; }
  }
  if (!row) return null;
  var sum = 0;
  PREPARATIONS.forEach(function (prep) {
    var per = row[prep];
    if (isBlank_(per)) return;
    sum += Number(per) * (totals[prep] || 0);
  });
  return sum;
}

// ---------------------------------------------------------------------------
// Public function surface for the Batches sidebar
// ---------------------------------------------------------------------------

function testBatchFunctionsExist() {
  var s = newSuite_();

  // google.script.run can only see public (no trailing underscore) functions.
  eq_(s, 'getBatchFormOptions is public', typeof getBatchFormOptions, 'function');
  eq_(s, 'getBatchForDate is public', typeof getBatchForDate, 'function');
  eq_(s, 'saveBatch is public', typeof saveBatch, 'function');
  eq_(s, 'deleteBatch is public', typeof deleteBatch, 'function');
  eq_(s, 'getRecentBatches is public', typeof getRecentBatches, 'function');

  // Preparations must match the required order (§3.2).
  eq_(s, 'preparations in order', PREPARATIONS.join('|'),
    'Batter|Nutella Mix|Cream|White Mix|Cheese');

  return s;
}
