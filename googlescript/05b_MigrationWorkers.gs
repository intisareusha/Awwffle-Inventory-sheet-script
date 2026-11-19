/**
 * Awwffle Inventory System — 05b_MigrationWorkers.gs
 *
 * The individual import routines. Each returns { imported, skipped } and appends
 * rows to the reconciliation report. Nothing here writes to the source.
 */

// ---------------------------------------------------------------------------
// Batches — README §3.2, §17.7
// ---------------------------------------------------------------------------

/**
 * Source layout: row 1 = totals, row 2 = header, row 3+ = data (D4).
 * Fractional batches are preserved exactly; blanks stay blank.
 */
function migrateBatches_(sheet, recon, corrections) {
  var records = readSourceRecords_(sheet, 2).filter(function (r) {
    return toDate_(r['Date']) !== null;
  });

  // Dates already imported — used only for a re-run guard, never for normal flow.
  var existingDates = {};
  readRecords_(SHEETS.BATCHES).forEach(function (r) {
    existingDates[dateKey_(r['Date'])] = true;
  });

  var rows = [];
  var skipped = 0;
  var totals = [0, 0, 0, 0, 0];

  records.forEach(function (r) {
    var d = toDate_(r['Date']);

    PREPARATIONS.forEach(function (prep, i) {
      var n = toNumber_(r[prep]);
      if (n !== null) totals[i] += n;
    });

    if (existingDates[dateKey_(d)]) {
      skipped++;
      return;
    }

    rows.push([
      newId_('BATCH'),
      d,
      blankOrNumber_(r['Batter']),
      blankOrNumber_(r['Nutella Mix']),
      blankOrNumber_(r['Cream']),
      blankOrNumber_(r['White Mix']),
      blankOrNumber_(r['Cheese']),
      new Date(),
      'Imported from source row ' + r._row
    ]);
  });

  appendRows_(SHEETS.BATCHES, rows);

  // Report the sheet's TOTAL, not rows added this run. Comparing "added now"
  // against "expected total" makes a correct re-run look like a failure.
  var totalInSheet = readRecords_(SHEETS.BATCHES).length;

  recon.push(reportRow_('Batches', 'Records in sheet', EXPECTED.batchRecords, totalInSheet,
    totalInSheet === EXPECTED.batchRecords,
    'Source span ' + firstDate_(records) + ' to ' + lastDate_(records) +
    (skipped ? '; ' + skipped + ' already present, skipped' : '')));

  recon.push(reportRow_('Batches', 'Batter batches', 33.5, totals[0],
    Math.abs(totals[0] - 33.5) < 0.001, 'Derived from imported rows'));
  recon.push(reportRow_('Batches', 'Nutella Mix batches', 25, totals[1],
    Math.abs(totals[1] - 25) < 0.001, ''));
  recon.push(reportRow_('Batches', 'Cream batches', 13, totals[2],
    Math.abs(totals[2] - 13) < 0.001, ''));
  recon.push(reportRow_('Batches', 'White Mix batches', 1, totals[3],
    Math.abs(totals[3] - 1) < 0.001, ''));
  recon.push(reportRow_('Batches', 'Cheese batches', 1, totals[4],
    Math.abs(totals[4] - 1) < 0.001, ''));

  return { imported: rows.length, total: totalInSheet, skipped: skipped, totals: totals };
}

function blankOrNumber_(v) {
  var n = toNumber_(v);
  // Preserve a blank as blank: a blank means "not used", not zero (§3.1).
  return n === null ? '' : n;
}

function firstDate_(records) {
  var dates = records.map(function (r) { return toDate_(r['Date']); }).filter(Boolean);
  if (!dates.length) return '';
  return dateKey_(new Date(Math.min.apply(null, dates)));
}

function lastDate_(records) {
  var dates = records.map(function (r) { return toDate_(r['Date']); }).filter(Boolean);
  if (!dates.length) return '';
  return dateKey_(new Date(Math.max.apply(null, dates)));
}

// ---------------------------------------------------------------------------
// Bazar — README §5, §9, D1
// ---------------------------------------------------------------------------

/**
 * Source columns: Date | Category | Expense For | Unit | Rate | Amount | Ref | Status
 *
 * Under the D1 ruling:
 *   Category    -> the ITEM NAME (or the expense name)
 *   Expense For -> the QUANTITY
 *
 * The two-field model (§5.3) splits the item name into an expense type plus a
 * name. Non-inventory rows never touch stock.
 */
function migrateBazar_(sheet, recon, corrections) {
  var records = readSourceRecords_(sheet, 1);
  var rows = [];
  var skipped = 0;

  // Re-run protection: source row numbers already imported.
  var alreadyImported = importedSourceRows_(SHEETS.BAZAR);

  // The owner corrected the 10 Oct Milk purchase by hand. If Bazar already has a
  // Milk row on that date, the source row must never be imported a second time —
  // deleting the duplicate and re-running would otherwise bring it straight back.
  var milkOnSetupDate = {};
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Item']) !== 'Milk') return;
    var k = dateKey_(r['Date']);
    if (k === CORRECTIONS.MILK_SETUP_DATE) milkOnSetupDate[k] = true;
  });

  var monthTotals = {};
  var expenseTypeCounts = {};
  var aliasHits = [];
  var unknownItems = [];
  var amountMismatches = [];

  records.forEach(function (r) {
    var category = String(r['Category'] === null ? '' : r['Category']).trim();
    if (!category) return;

    // Classification and reporting run on every row so the report describes the
    // full dataset. Only the append is skipped on a re-run.
    var isNewRow = !alreadyImported['row:' + r._row];
    if (!isNewRow) skipped++;

    var date = toDate_(r['Date']);
    var qty = toNumber_(r['Expense For']);      // D1: this is the quantity
    var unit = String(r['Unit'] || '').trim();
    var rate = toNumber_(r['Rate']);
    var sourceAmount = toNumber_(r['Amount (BDT)']);
    var ref = isBlank_(r['Ref']) ? '' : String(r['Ref']).trim();
    var status = isBlank_(r['Status']) ? '' : String(r['Status']).trim();

    // --- Classify: inventory purchase or one of the four expense types ---
    var classification = classifyExpense_(category);
    var expenseType = classification.expenseType;
    var itemName = classification.itemName;
    var expenseName = classification.expenseName;

    if (classification.aliasUsed) {
      // For a non-inventory row the mapping is to an expense TYPE, not an item,
      // so name that instead of showing an empty item name.
      var mappedTo = itemName
        ? itemName
        : expenseType + (expenseName ? ' (' + expenseName + ')' : '');
      aliasHits.push({ row: r._row, from: category, to: mappedTo });
    }
    if (classification.unknown) {
      unknownItems.push({ row: r._row, name: category });
      expenseType = 'Other';
      expenseName = category;
      itemName = '';
    }

    // --- Unit correction (the one known defect that changes a value) ---
    var correctedUnit = unit;
    if (r._row === CORRECTIONS.MILK_ROW && unit === CORRECTIONS.MILK_FROM_UNIT) {
      correctedUnit = CORRECTIONS.MILK_TO_UNIT;
      corrections.push({
        section: 'Bazar',
        check: 'Row ' + r._row + ' Milk unit',
        from: qty + ' ' + unit,
        to: qty + ' ' + correctedUnit,
        reason: 'Every other Milk purchase is in litres; "p" was a typo (§9).',
        affectsValues: true
      });
    }

    // The 10 Oct Milk line is the one purchase the owner maintains by hand.
    // A re-run must not create a second one beside her corrected row.
    var isMilkSetupRow = !!date && itemName === 'Milk' &&
      dateKey_(date) === CORRECTIONS.MILK_SETUP_DATE;

    // --- Amount is always derived, never trusted (§5.2) ---
    var derivedAmount = null;
    if (expenseType === EXPENSE_TYPE_INVENTORY && qty !== null && rate !== null) {
      derivedAmount = amountFor_(qty, correctedUnit, rate);
    } else if (qty !== null && rate !== null) {
      // Non-inventory expenses: the source recorded an actual money amount whose
      // "quantity" is really the amount and whose rate is 1. Preserve the money.
      derivedAmount = round2_(qty * rate);
    }

    if (sourceAmount !== null && derivedAmount !== null &&
        Math.abs(sourceAmount - derivedAmount) > 0.01) {
      amountMismatches.push({ row: r._row, source: sourceAmount, derived: derivedAmount });
    }

    // --- Base quantity, for stock calculations ---
    var baseQty = null;
    if (expenseType === EXPENSE_TYPE_INVENTORY && qty !== null) {
      var item = itemName ? findItem_(itemName) : null;
      baseQty = toBaseQuantity_(qty, correctedUnit, item && item.perPieceWeight);
    }

    var monthKey = date ? dateKey_(date).substring(0, 7) : 'unknown';
    monthTotals[monthKey] = (monthTotals[monthKey] || 0) + (sourceAmount || 0);
    expenseTypeCounts[expenseType] = (expenseTypeCounts[expenseType] || 0) + 1;

    if (isNewRow) {
      if (isMilkSetupRow && milkOnSetupDate[CORRECTIONS.MILK_SETUP_DATE]) {
        skipped++;
        corrections.push({
          section: 'Bazar',
          check: 'Row ' + r._row + ' Milk on ' + CORRECTIONS.MILK_SETUP_DATE,
          from: 'source row would import ' + qty + ' ' + correctedUnit,
          to: 'skipped — a Milk row already exists on that date',
          reason: 'The owner corrected this purchase by hand. Importing it again ' +
                  'would duplicate the setup buy and distort Milk stock.',
          affectsValues: true
        });
        return;
      }

      rows.push([
        newId_('BAZAR'),
        date,
        expenseType,
        itemName,
        expenseName,
        qty,
        correctedUnit,
        rate,
        derivedAmount,
        ref,
        status,
        '',                                 // Payment Method — none in source
        baseQty,
        expenseType === EXPENSE_TYPE_INVENTORY,
        new Date(),
        'Imported from source row ' + r._row
      ]);
    }
  });

  appendRows_(SHEETS.BAZAR, rows);

  // --- Report ---
  // Report the sheet's TOTAL, so a re-run that correctly skips existing rows is
  // not mistaken for a failed import.
  var totalInSheet = readRecords_(SHEETS.BAZAR).length;

  recon.push(reportRow_('Bazar', 'Rows in sheet', EXPECTED.bazarRows, totalInSheet,
    totalInSheet === EXPECTED.bazarRows,
    'One row per item purchased' + (skipped ? '; ' + skipped + ' already present, skipped' : '')));

  var oct = monthTotals['2026-10'] || 0;
  var nov = monthTotals['2026-11'] || 0;
  var total = oct + nov;

  recon.push(reportRow_('Bazar', 'October total', EXPECTED.bazarOctober, round2_(oct),
    Math.abs(oct - EXPECTED.bazarOctober) < 0.01, 'Investment month (§13.F38)'));
  recon.push(reportRow_('Bazar', 'November total', EXPECTED.bazarNovember, round2_(nov),
    Math.abs(nov - EXPECTED.bazarNovember) < 0.01, ''));
  recon.push(reportRow_('Bazar', 'All-time total', EXPECTED.bazarAllTime, round2_(total),
    Math.abs(total - EXPECTED.bazarAllTime) < 0.01, 'October + November'));

  Object.keys(expenseTypeCounts).sort().forEach(function (t) {
    recon.push(reportRow_('Bazar', 'Expense type: ' + t, '', expenseTypeCounts[t], true, ''));
  });

  if (aliasHits.length) {
    recon.push(reportRow_('Bazar', 'Alias names mapped', '', aliasHits.length, true,
      aliasHits.map(function (a) { return 'row ' + a.row + ': "' + a.from + '" to "' + a.to + '"'; }).join('; ')));
  }
  if (unknownItems.length) {
    recon.push(reportRow_('Bazar', 'Unknown item names', 0, unknownItems.length, false,
      unknownItems.map(function (u) { return 'row ' + u.row + ': ' + u.name; }).join('; ')));
  }
  if (amountMismatches.length) {
    recon.push(reportRow_('Bazar', 'Source amount vs derived', 0, amountMismatches.length, false,
      amountMismatches.map(function (m) {
        return 'row ' + m.row + ': source ' + m.source + ', derived ' + m.derived;
      }).join('; ')));
  } else {
    recon.push(reportRow_('Bazar', 'Source amount vs derived', 0, 0, true,
      'Every derived amount matches the source amount'));
  }

  return {
    imported: rows.length,
    total: totalInSheet,
    skipped: skipped,
    monthTotals: monthTotals,
    expenseTypeCounts: expenseTypeCounts,
    aliasHits: aliasHits,
    unknownItems: unknownItems,
    amountMismatches: amountMismatches
  };
}

/**
 * Maps a source `Category` value to the two-field model (§5.3).
 *
 * Returns:
 *   expenseType  one of EXPENSE_TYPES
 *   itemName     canonical item name, for inventory purchases
 *   expenseName  free text, for non-inventory
 *   aliasUsed    true when a historical variant had to be mapped
 *   unknown      true when the name is not in the item master
 */
function classifyExpense_(category) {
  // Keep the untouched value: a stray leading or trailing space is itself a defect
  // that must be reported (§9), so it cannot be trimmed away before comparison.
  var original = String(category === null || category === undefined ? '' : category);
  var raw = original.trim();
  var key = normaliseItemName_(raw);

  // The three non-inventory names in the source (§5.3, §9).
  if (key === 'salary') {
    return { expenseType: 'Salary', itemName: '', expenseName: 'Salary',
             aliasUsed: false, unknown: false };
  }
  if (key === 'currier charge' || key === 'courier charge') {
    return { expenseType: 'Courier', itemName: '', expenseName: raw,
             aliasUsed: true, unknown: false };
  }
  if (key === 'insect light') {
    return { expenseType: 'Maintenance', itemName: '', expenseName: 'Insect Light',
             aliasUsed: false, unknown: false };
  }

  // Otherwise it should be an inventory item.
  var canonical = resolveAlias_(raw);
  if (!canonical) {
    return { expenseType: 'Other', itemName: '', expenseName: raw,
             aliasUsed: false, unknown: true };
  }

  // Anything that is not an exact byte-for-byte canonical match counts as an
  // alias hit, so stray whitespace is reported rather than silently accepted
  // (§9: `Kitkat ` and ` Syrup Hersheys`).
  var aliasUsed = String(canonical) !== original;
  return { expenseType: EXPENSE_TYPE_INVENTORY, itemName: canonical, expenseName: '',
           aliasUsed: aliasUsed, unknown: false };
}
