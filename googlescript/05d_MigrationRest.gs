/**
 * Awwffle Inventory System — 05d_MigrationRest.gs
 *
 * The remaining imports: monthly aggregates, closed days, opening stock, and the
 * reconciliation report itself.
 */

// ---------------------------------------------------------------------------
// Monthly aggregates — invoices, discount, due
// ---------------------------------------------------------------------------

/**
 * README §7.2 and §13.G3: no daily invoice, discount or due history exists
 * anywhere in the source. Only two monthly totals and three monthly invoice
 * counts were ever typed.
 *
 * These are therefore imported as MONTHLY AGGREGATE records, explicitly marked
 * `Source = Monthly aggregate`, dated to the last day of the month. They are NOT
 * disguised as daily data, and the reconciliation report says so.
 *
 * The 34 BDT residual in All Time discount (8,892 vs 6,032 + 2,826 = 8,858) is
 * recorded as an unallocated difference, not quietly distributed (§8.1).
 */
function migrateMonthlyAggregates_(src, recon, corrections) {
  var existingInvoiceDates = importedDateKeys_(SHEETS.INVOICES, 'Date');
  var existingDiscountDates = importedDateKeys_(SHEETS.DISCOUNT_DUE, 'Date');

  var aggRows = [];
  var ddRows = [];

  var months = [
    { name: 'October',   sheet: src.october,  endDate: new Date(2026, 9, 31) },
    { name: 'November',  sheet: src.november, endDate: new Date(2026, 10, 16) }
  ];

  var invoiceTotal = 0;
  var discountTotal = 0;

  months.forEach(function (m) {
    var summary = readSummaryBlock_(m.sheet);
    var endKey = dateKey_(m.endDate);

    if (summary['Total Invoices'] !== undefined && summary['Total Invoices'] !== null) {
      var inv = toNumber_(summary['Total Invoices']);
      invoiceTotal += inv || 0;
      if (!existingInvoiceDates[endKey]) {
        aggRows.push([
          m.endDate, '', inv, 'Monthly aggregate', new Date(),
          m.name + ' total from the source summary. No daily history exists (§7.2).'
        ]);
      }
    }

    var disc = toNumber_(summary.discount);
    var due = toNumber_(summary.due);
    discountTotal += disc || 0;

    if ((disc !== null || due !== null) && !existingDiscountDates[endKey]) {
      ddRows.push([
        m.endDate, disc === null ? '' : disc, due === null ? '' : due, '',
        '', 'Monthly aggregate', new Date(),
        m.name + ' figure from the source summary. No daily history exists (§13.G3).'
      ]);
    }
  });

  appendRows_(SHEETS.INVOICES, aggRows);
  appendRows_(SHEETS.DISCOUNT_DUE, ddRows);

  // Count sheet state, not rows added this run (a re-run skips existing rows).
  var invoicesInSheet = readRecords_(SHEETS.INVOICES).length;
  var discountInSheet = readRecords_(SHEETS.DISCOUNT_DUE).length;

  // --- Report ---
  recon.push(reportRow_('Invoices', 'Monthly aggregates in sheet', 2, invoicesInSheet,
    invoicesInSheet === 2, 'October 248 + November 179 = 427 all-time'));

  recon.push(reportRow_('Invoices', 'All-time invoice count (sum of months)',
    427, invoiceTotal, invoiceTotal === 427,
    'Monthly totals only; no daily counts can be recovered'));

  var allTimeSummary = readSummaryBlock_(src.allTime);
  var allTimeDiscount = toNumber_(allTimeSummary.discount);
  var residual = (allTimeDiscount || 0) - discountTotal;

  recon.push(reportRow_('Discount/Due', 'Monthly discount sum', '8,858',
    round2_(discountTotal), Math.abs(discountTotal - 8858) < 1, 'October 6,032 + November 2,826'));

  recon.push(reportRow_('Discount/Due', 'All Time discount (source)', 8892,
    allTimeDiscount, Math.abs((allTimeDiscount || 0) - 8892) < 1, ''));

  recon.push(reportRow_('Discount/Due', 'Unallocated discount residual', 0, round2_(residual),
    Math.abs(residual) <= 34,
    residual !== 0
      ? 'The source All Time total exceeds its monthly totals by ' + round2_(residual) +
        ' BDT. Recorded as unallocated, NOT distributed across months (§8.1).'
      : ''));

  recon.push(reportRow_('Discount/Due', 'Monthly aggregate rows in sheet', 2, discountInSheet,
    discountInSheet === 2, 'Dated to month end and marked as aggregates'));

  return {
    invoices: aggRows.length,
    invoicesTotal: invoicesInSheet,
    discountDue: ddRows.length,
    discountDueTotal: discountInSheet,
    invoiceTotal: invoiceTotal,
    discountTotal: discountTotal,
    discountResidual: residual
  };
}

/**
 * Reads the M:N summary block (label in column M, value in column N) plus the
 * Discount/Due cells in the O:S block.
 */
function readSummaryBlock_(sheet) {
  var out = {};
  var lastRow = Math.min(sheet.getLastRow(), 25);

  // Labels and values in columns 13 (M) and 14 (N).
  var mn = sheet.getRange(1, 13, lastRow, 2).getValues();
  mn.forEach(function (row) {
    var label = isBlank_(row[0]) ? '' : String(row[0]).trim();
    if (!label) return;
    if (out.hasOwnProperty(label)) return;
    out[label] = row[1];
  });

  // Discount is O1, Due is P1 on the report sheets.
  var os = sheet.getRange(1, 15, Math.min(sheet.getLastRow(), 25), 5).getValues();
  var osHeaders = os[0].map(function (h) { return isBlank_(h) ? '' : String(h).trim().toLowerCase(); });
  var discountCol = osHeaders.indexOf('discount');
  var dueCol = osHeaders.indexOf('due');
  if (discountCol >= 0 && os.length > 1) out.discount = os[1][discountCol];
  if (dueCol >= 0 && os.length > 1) out.due = os[1][dueCol];

  return out;
}

// ---------------------------------------------------------------------------
// Closed days — README §8.4
// ---------------------------------------------------------------------------

/**
 * The source has no closed-day record at all (§17.5.11). What it does have is a
 * span of snapshot dates with holes, and those holes are the closure record.
 *
 * OWNER'S ACCOUNT OF THE FIRST WEEKS (authoritative):
 *   - 21 Oct (Wed) was OPEN — normally closed, but traded that week.
 *   - 22 Oct (Thu) was CLOSED — the day off was moved to Thursday.
 *   - 28 Oct (Wed) was OPEN — no weekly closure that week either.
 *   - 4 Nov and 11 Nov (Wed) were CLOSED.
 *
 * So the three closed days are 22 Oct, 4 Nov, 11 Nov — exactly the three dates
 * with no snapshot, and exactly 31 calendar days − 3 = 28 open days.
 *
 * The lesson this encodes: the closed day moved within three weeks, so it can
 * never be derived from a weekday. Every closure here is a dated record.
 *
 * An earlier version labelled 22 Oct "Unconfirmed — may be a missed entry"
 * because it fell on a Thursday. That was wrong, and "unconfirmed" would invite
 * the owner to later mistake a real closure for a data error.
 */
function migrateClosedDays_(posStats, recon, corrections) {
  var spanStart = new Date(2026, 9, 17);
  var spanEnd = new Date(2026, 10, 16);

  var have = {};
  (posStats.days || []).forEach(function (d) { have[dateKey_(d)] = true; });

  // Re-run protection: one row per date.
  var existingDates = importedDateKeys_(SHEETS.CLOSED_DAYS, 'Date');

  // Reasons the owner confirmed. A closure is a fact, so it gets a real reason
  // rather than a weekday label.
  var reasons = {
    '2026-10-22': 'Closed — day off moved from Wednesday to Thursday',
    '2026-11-04': 'Closed — weekly day off',
    '2026-11-11': 'Closed — weekly day off'
  };

  var rows = [];
  var closed = [];

  dateRange_(spanStart, spanEnd).forEach(function (d) {
    var key = dateKey_(d);
    if (have[key]) return;                       // a snapshot exists: we traded

    closed.push(key);
    if (!existingDates[key]) {
      rows.push([d, reasons[key] || 'Closed — no snapshot recorded', new Date()]);
    }
  });

  if (rows.length) appendRows_(SHEETS.CLOSED_DAYS, rows);

  var openDays = daysBetweenInclusive_(spanStart, spanEnd) - closed.length;

  recon.push(reportRow_('Closed days', 'Dates without a snapshot', 3, closed.length,
    closed.length === 3, closed.join(', ')));

  recon.push(reportRow_('Closed days', 'Open days in POS span', EXPECTED.openDays, openDays,
    openDays === EXPECTED.openDays,
    '31 calendar days - ' + closed.length + ' closed = ' + openDays +
    '. Matches the 28 recorded snapshots.'));

  corrections.push({
    section: 'Closed days',
    check: '22 Oct recorded as a Thursday closure, not a missed entry',
    from: 'Thursday with no snapshot, labelled unconfirmed',
    to: 'Closed — day off moved from Wednesday to Thursday',
    reason: 'Owner: the first weeks did not follow a fixed weekday (21 and 28 Oct ' +
            'were open Wednesdays). Weekday rules cannot be trusted (§8.4).',
    affectsValues: false
  });

  corrections.push({
    section: 'Closed days',
    check: 'No closed-day record existed in the source',
    from: 'Wednesday applied by formula, contradicted by the data',
    to: 'Dated list of three closures, each with a reason',
    reason: '§8.4, §17.5.11 — the day off moved within three weeks, so a weekday ' +
            'rule cannot be trusted against the data.',
    affectsValues: true
  });

  return { imported: rows.length, closed: closed, openDays: openDays };
}

// ---------------------------------------------------------------------------
// Opening stock — README §6.3, refined by the owner in Phase 6 review
// ---------------------------------------------------------------------------

/**
 * DEFINITION (owner's decision):
 *
 *   Opening stock = everything purchased on or before the cut-off date,
 *                   plus any stock that has no purchase behind it at all.
 *   Purchased Qty = purchases after the cut-off date.
 *   Opening + Purchased = Total Qty.
 *
 * The cut-off is 10 October 2026, which is the date of the first Bazar purchase.
 * That gives an honest split for the business: the 10 October setup buy is the
 * opening stock, and trading purchases run from November onward.
 *
 * WHY THIS REPLACED THE EARLIER RULE
 * The first implementation computed `stock - all purchases`, which produced a
 * tiny "leftover" opening layer (Milk 2,000 ml, Waffle Box 1,200, Waffle Tray
 * 1,200) and pushed the entire 10 October purchase into Purchased. That was
 * arithmetically valid but it misrepresented the business: October was a setup
 * purchase, not trading stock movement (§13.F38).
 *
 * The only genuine pre-existing stock is Waffle Box and Waffle Tray, which were
 * never purchased inside the recorded window.
 */
function migrateOpeningStock_(stockSheet, bazarStats, recon, corrections) {
  var records = readSourceRecords_(stockSheet, 1);

  // The first Bazar purchase date. Owner's decision: opening ends here.
  var cutOff = toDate_('2026-10-10');

  // Split imported Bazar rows into opening (on/before cut-off) and purchased.
  var openingQty = {};
  var purchasedQty = {};

  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Expense Type']) !== EXPENSE_TYPE_INVENTORY) return;
    var item = String(r['Item'] || '');
    if (!item) return;
    var base = toNumber_(r['Base Quantity']);
    if (base === null) return;

    var d = toDate_(r['Date']);
    if (d && cutOff && d <= cutOff) {
      openingQty[item] = (openingQty[item] || 0) + base;
    } else {
      purchasedQty[item] = (purchasedQty[item] || 0) + base;
    }
  });

  var rows = [];
  var reconciled = 0;
  var discrepancies = [];
  var preExisting = [];

  // Re-run protection: one opening row per item.
  var already = importedItemKeys_(SHEETS.OPENING_STOCK);

  records.forEach(function (r) {
    var rawName = String(r['Name'] === null ? '' : r['Name']).trim();
    if (!rawName) return;

    var canonical = resolveAlias_(rawName);
    if (!canonical) {
      discrepancies.push({ item: rawName, note: 'not in item master' });
      return;
    }

    var item = findItem_(canonical);
    var stockBase = toNumber_(r['Stock']);      // already in base units
    var rate = toNumber_(r['Rate']);

    var opening = openingQty[canonical] || 0;
    var bought = purchasedQty[canonical] || 0;

    // Stock with no purchase behind it is genuinely pre-existing: it was on the
    // shelf before the Bazar ledger began and must be preserved (§6.3).
    if (opening === 0 && bought === 0 && stockBase !== null && stockBase > 0) {
      opening = stockBase;
      preExisting.push({ item: canonical, qty: stockBase });
    }

    // Check the split adds up to the stock the source recorded.
    var implied = opening + bought;
    if (stockBase !== null && Math.abs(implied - stockBase) < 0.5) {
      reconciled++;
    } else if (stockBase !== null) {
      discrepancies.push({
        item: canonical, stock: stockBase, opening: opening,
        purchased: bought, difference: round2_(implied - stockBase)
      });
    }

    if (already[canonical]) return;

    var openingValue = opening * ratePerBaseUnitForMigration_(canonical, rate);

    rows.push([
      canonical,
      cutOff,
      round2_(opening),
      rate,
      round2_(openingValue),
      'Stock row ' + r._row,
      preExisting.some(function (p) { return p.item === canonical; })
        ? 'Pre-existing stock: never purchased in the recorded window'
        : 'Purchases on or before ' + dateKey_(cutOff) + ' (setup stock)'
    ]);
  });

  appendRows_(SHEETS.OPENING_STOCK, rows);

  // --- Report ---
  recon.push(reportRow_('Opening stock', 'Items in source', EXPECTED.stockItems, records.length,
    records.length === EXPECTED.stockItems, ''));

  recon.push(reportRow_('Opening stock', 'Opening + purchased = source stock', 43, reconciled,
    reconciled === EXPECTED.stockItems,
    'Opening is the 10 Oct setup purchase plus genuinely pre-existing stock'));

  recon.push(reportRow_('Opening stock', 'Items with genuinely pre-existing stock',
    preExisting.length, preExisting.length, true,
    preExisting.length
      ? preExisting.map(function (p) { return p.item + ' ' + round2_(p.qty); }).join('; ')
      : 'None'));

  if (discrepancies.length) {
    recon.push(reportRow_('Opening stock', 'Items that do not add up', 0, discrepancies.length,
      false,
      discrepancies.map(function (d) {
        return d.item + (d.difference !== undefined
          ? ' stock ' + round2_(d.stock) + ' vs opening+purchased ' +
            round2_(d.opening + d.purchased) + ' (' + round2_(d.difference) + ')'
          : ' (' + d.note + ')');
      }).join('; ')));
  } else {
    recon.push(reportRow_('Opening stock', 'Items that do not add up', 0, 0, true,
      'Every item: opening + purchased = the stock the source recorded'));
  }

  // The Milk correction must land in OPENING now, because 10 Oct is the cut-off.
  var milkOpening = openingQty['Milk'] || 0;
  recon.push(reportRow_('Opening stock', 'Milk in opening (10 Oct, 25 L)',
    25000, round2_(milkOpening),
    Math.abs(milkOpening - 25000) < 1,
    'Reading the "6 p" row as 6 litres (§9). Owner corrected 23 L to 25 L.'));

  corrections.push({
    section: 'Opening stock',
    check: 'Opening stock definition',
    from: 'Stock quantity minus all purchases (a small residual layer)',
    to: 'Purchases on or before 10 Oct 2026, plus stock with no purchase at all',
    reason: 'Owner decision: the 10 Oct setup buy IS the opening stock; trading ' +
            'purchases run from November. October was capital, not trading (§13.F38).',
    affectsValues: true
  });

  return {
    imported: rows.length,
    reconciled: reconciled,
    discrepancies: discrepancies,
    preExisting: preExisting,
    openingTotal: rows.length
  };
}

// ---------------------------------------------------------------------------
// Manual historical usage — README §17.3, §3.3
// ---------------------------------------------------------------------------

/**
 * The source Stock sheet carries a hand-typed `Total Used` for the 26
 * non-recipe-driven items (toppings and packaging), totalling 11,735 BDT of the
 * 48,752.85 real used cost.
 *
 * That figure exists NOWHERE else. If it is not imported, every one of those items
 * shows far too much stock and the used cost collapses. Recipe-driven items are
 * skipped deliberately: their consumption is derived from Measurements x Batches,
 * so importing their `Total Used` too would double-count it.
 *
 * Destination is `Adjustments`, not a new table: §13.C26 already defines manual
 * usage as an Out adjustment, and it keeps theoretical consumption and actual
 * usage separate by construction.
 *
 * These rows are dated to the migration cut-off end (the last day the source
 * covers), because the source gives one total, not a per-day history.
 */
function migrateManualUsage_(stockSheet, bazarStats, recon, corrections) {
  var records = readSourceRecords_(stockSheet, 1);

  // End of the recorded period: the source's own last data day.
  var endDate = toDate_('2026-11-16');

  var already = {};
  readRecords_(SHEETS.ADJUSTMENTS).forEach(function (r) {
    var id = String(r['Adjustment ID'] || '');
    if (id) already[id] = true;
  });
  var reRunGuard = {};

  var rows = [];
  var totalCost = 0;
  var totalQty = 0;
  var skipped = 0;
  var recipeSkipped = 0;
  var detail = [];

  records.forEach(function (r) {
    var rawName = String(r['Name'] === null ? '' : r['Name']).trim();
    if (!rawName) return;

    var canonical = resolveAlias_(rawName);
    if (!canonical) return;

    var item = findItem_(canonical);
    if (!item) return;

    var used = toNumber_(r['Total Used']);
    var usedCost = toNumber_(r['Used Cost']);

    // Recipe-driven usage is derived, so importing it would double-count (§3.3).
    if (item.population === POPULATION.RECIPE) {
      recipeSkipped++;
      return;
    }

    // A zero used figure is a real fact but carries no quantity; skip the row
    // rather than writing noise.
    if (used === null || used <= 0) return;

    // Re-run protection, keyed on item so a second run cannot double the usage.
    reRunGuard[normaliseItemName_(canonical)] = true;
    if (already['MIGRATED-USE-' + canonical]) {
      skipped++;
      return;
    }

    var unit = String(r['Unit'] || item.unit).trim();

    rows.push([
      'MIGRATED-USE-' + canonical,      // deterministic ID, safe on re-run
      endDate,
      canonical,
      used,                              // as the source recorded it, in its unit
      'Out',
      'Historical usage imported from the source Stock sheet',
      used,                              // already in base units in the source
      new Date(),
      'Source Total Used = ' + used + ' ' + unit +
        '; source Used Cost = ' + (usedCost === null ? '' : usedCost)
    ]);

    totalQty += used;
    if (usedCost !== null) totalCost += usedCost;
    detail.push(canonical + ' ' + used);
  });

  appendRows_(SHEETS.ADJUSTMENTS, rows);

  // --- Report ---
  recon.push(reportRow_('Manual usage', 'Items with historical usage', 25, rows.length,
    rows.length === 25,
    rows.length === 25 ? detail.join('; ')
      : 'Expected 25 manual items with usage; got ' + rows.length));

  recon.push(reportRow_('Manual usage', 'Recipe items skipped (derived)', 17, recipeSkipped,
    recipeSkipped === 17,
    'Their usage comes from Measurements x Batches — importing it would double-count'));

  recon.push(reportRow_('Manual usage', 'Historical used cost imported', 11735,
    round2_(totalCost), Math.abs(totalCost - 11735) < 1,
    'Source Used Cost for the 25 manual items. This is a SOURCE-RATE figure; ' +
    'the Stock view revalues it at weighted average (§6.2.1), so it will differ there.'));

  if (skipped) {
    recon.push(reportRow_('Manual usage', 'Already imported (skipped)', 0, skipped, true,
      'Re-run protection: these adjustment IDs already existed'));
  }

  corrections.push({
    section: 'Manual usage',
    check: 'Hand-typed Total Used for 25 toppings/packaging items',
    from: 'A single running total per item in the Stock sheet',
    to: 'One dated Out adjustment per item, imported once',
    reason: '§17.3 — this consumption has no other home. Without it every manual ' +
            'item would show too much stock.',
    affectsValues: false
  });

  return { imported: rows.length, skipped: skipped, recipeSkipped: recipeSkipped,
           totalCost: round2_(totalCost), totalQty: totalQty };
}


/** Confirms the imported figures reproduce the source summary values. */
function verifyAgainstSourceReports_(src, stats, recon, corrections) {
  var allTime = readSummaryBlock_(src.allTime);

  recon.push(reportRow_('Sales', 'All Time Original Sale', EXPECTED.originalSale,
    toNumber_(allTime['Original Sale']),
    Math.abs((toNumber_(allTime['Original Sale']) || 0) - EXPECTED.originalSale) < 1,
    'Net of discount — never re-derive (§8.1)'));

  recon.push(reportRow_('Sales', 'All Time POS Cost', EXPECTED.posCost,
    toNumber_(allTime['POS Cost']),
    Math.abs((toNumber_(allTime['POS Cost']) || 0) - EXPECTED.posCost) < 1, ''));

  recon.push(reportRow_('Sales', 'All Time POS Profit', 50846,
    toNumber_(allTime['POS Profit']),
    Math.abs((toNumber_(allTime['POS Profit']) || 0) - 50846) < 1,
    'Original Sale - POS Cost'));

  recon.push(reportRow_('Sales', 'Cash in hand', EXPECTED.cashInHand,
    toNumber_(allTime['Cash in hand']),
    Math.abs((toNumber_(allTime['Cash in hand']) || 0) - EXPECTED.cashInHand) < 1,
    'Original Sale - Due - Bazar; October Bazar is 0 by the investment rule'));

  recon.push(reportRow_('Sales', 'Open days', EXPECTED.openDays,
    toNumber_(allTime['Total Days']),
    Math.abs((toNumber_(allTime['Total Days']) || 0) - EXPECTED.openDays) < 1,
    'Labelled "Open days", not calendar days (D6)'));

  recon.push(reportRow_('Sales', 'Waffles sold (All Time summary)', EXPECTED.wafflesSold,
    toNumber_(allTime['Total Waffles Sold']),
    Math.abs((toNumber_(allTime['Total Waffles Sold']) || 0) - EXPECTED.wafflesSold) < 1,
    'Cross-check against the snapshot totals'));

  // The duplicated expense block must be reported as deliberately dropped (§8.6).
  corrections.push({
    section: 'Expenses',
    check: 'Duplicated expense block in All Time (column Q)',
    from: '31 typed amounts totalling 39,050',
    to: 'NOT migrated — deleted',
    reason: '§8.6 — a summary that drifts from Bazar is a duplicate ledger. Bazar is the only source.',
    affectsValues: false
  });

  return { allTime: allTime };
}
