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
    testReportRowFormatting
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
