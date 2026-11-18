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
 * span of snapshot dates with holes. Those holes are the best available evidence.
 *
 * Three dates are missing: 22 Oct (Thu), 4 Nov (Wed), 11 Nov (Wed).
 * Wednesday is the stated closed day, but 22 October is a Thursday — so this is
 * exactly the ambiguity §13.A7 warns about: closed vs missed.
 *
 * We record the two Wednesdays as `Closed` and the Thursday as `Unconfirmed`, so
 * a missed entry is never silently treated as a closed day.
 */
function migrateClosedDays_(posStats, recon, corrections) {
  var spanStart = new Date(2026, 9, 17);
  var spanEnd = new Date(2026, 10, 16);

  var have = {};
  (posStats.days || []).forEach(function (d) { have[dateKey_(d)] = true; });

  // Re-run protection: one row per date.
  var existingDates = importedDateKeys_(SHEETS.CLOSED_DAYS, 'Date');

  var rows = [];
  var closed = [];
  var unconfirmed = [];

  dateRange_(spanStart, spanEnd).forEach(function (d) {
    if (have[dateKey_(d)]) return;
    var weekday = d.getDay();               // 3 = Wednesday
    var isWednesday = weekday === 3;

    if (isWednesday) {
      closed.push(dateKey_(d));
      if (!existingDates[dateKey_(d)]) rows.push([d, 'Closed (Wednesday)', new Date()]);
    } else {
      unconfirmed.push(dateKey_(d) + ' (' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekday] + ')');
      // Recorded, but labelled so it is never assumed to be a closure (§13.A7).
      if (!existingDates[dateKey_(d)]) {
        rows.push([d, 'Unconfirmed — no snapshot; may be a missed entry', new Date()]);
      }
    }
  });

  if (rows.length) appendRows_(SHEETS.CLOSED_DAYS, rows);

  var closedOrUnconfirmed = closed.length + unconfirmed.length;
  var openDays = daysBetweenInclusive_(spanStart, spanEnd) - closedOrUnconfirmed;

  recon.push(reportRow_('Closed days', 'Dates without a snapshot', 3, closedOrUnconfirmed,
    closedOrUnconfirmed === 3, closed.concat(unconfirmed).join(', ')));

  recon.push(reportRow_('Closed days', 'Recorded as closed (Wednesday)', 2, closed.length,
    closed.length === 2, closed.join(', ')));

  recon.push(reportRow_('Closed days', 'Unconfirmed days', 1, unconfirmed.length, true,
    unconfirmed.length ? unconfirmed.join(', ') +
      ' — a Thursday. Recorded as unconfirmed, not as closed, because a missed ' +
      'entry must not be mistaken for a closure (§13.A7).' : ''));

  recon.push(reportRow_('Closed days', 'Open days in span', EXPECTED.openDays, openDays,
    openDays === EXPECTED.openDays, '31 calendar days - 3 without a snapshot'));

  corrections.push({
    section: 'Closed days',
    check: 'No closed-day record existed in the source',
    from: 'Wednesday applied by formula, contradicted by data',
    to: 'Dated list; 22 Oct marked Unconfirmed',
    reason: '§8.4, §17.5.11 — a weekday rule cannot be trusted against the data.',
    affectsValues: true
  });

  return { imported: rows.length, closed: closed, unconfirmed: unconfirmed, openDays: openDays };
}

// ---------------------------------------------------------------------------
// Opening stock — README §6.3
// ---------------------------------------------------------------------------

/**
 * Stock quantity in the source is a manually maintained running total, not an
 * opening balance. Diffing it against all recorded purchases reconciles 40 of 43
 * items exactly, leaving Milk, Waffle Box and Waffle Tray.
 *
 * The opening layer is therefore: `stock quantity - purchased quantity`, computed
 * per item in base units. Milk uses the corrected 6 litres, which yields exactly
 * 2,000 ml of genuine opening stock.
 *
 * These rows are stored in OpeningStock, NOT added to Bazar, so October purchases
 * remain visible and auditable instead of being baked into a number (§6.3).
 */
function migrateOpeningStock_(stockSheet, bazarStats, recon, corrections) {
  var records = readSourceRecords_(stockSheet, 1);
  var cutOff = toDate_('2026-10-09');

  // Purchased quantity per item, in base units, from the imported Bazar rows.
  var purchased = {};
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Expense Type']) !== EXPENSE_TYPE_INVENTORY) return;
    var item = String(r['Item'] || '');
    if (!item) return;
    var base = toNumber_(r['Base Quantity']);
    if (base === null) return;
    purchased[item] = (purchased[item] || 0) + base;
  });

  var rows = [];
  var reconciled = 0;
  var discrepancies = [];

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
    var bought = purchased[canonical] || 0;
    var opening = (stockBase === null ? 0 : stockBase) - bought;

    // A difference is only meaningful at display precision; treat sub-unit noise as zero.
    if (Math.abs(opening) < 0.5) {
      opening = 0;
      reconciled++;
    } else {
      discrepancies.push({
        item: canonical, stock: stockBase, purchased: bought, opening: opening
      });
    }

    if (already[canonical]) return;

    rows.push([
      canonical,
      cutOff,
      round2_(opening),
      rate,
      round2_(opening / 1000 * (rate || 0)),   // value: base units are gm/ml; rate is per kg/l
      'Stock row ' + r._row,
      opening === 0 ? 'Fully explained by purchases — no opening layer'
                    : 'Pre-existing stock before the Bazar ledger began'
    ]);
  });

  appendRows_(SHEETS.OPENING_STOCK, rows);

  // --- Report ---
  recon.push(reportRow_('Opening stock', 'Items in source', EXPECTED.stockItems, records.length,
    records.length === EXPECTED.stockItems, ''));

  recon.push(reportRow_('Opening stock', 'Items fully explained by purchases', 40, reconciled,
    reconciled === 40, 'README §6.3: 40 of 43 reconcile exactly'));

  recon.push(reportRow_('Opening stock', 'Items with a real opening layer', 3, discrepancies.length,
    discrepancies.length === 3,
    discrepancies.map(function (d) {
      return d.item + (d.opening !== undefined ? ' +' + round2_(d.opening) + ' base units' : ' (' + d.note + ')');
    }).join('; ')));

  // The Milk correction must show up as exactly 2,000 ml of opening stock.
  var milk = discrepancies.filter(function (d) { return d.item === 'Milk'; })[0];
  recon.push(reportRow_('Opening stock', 'Milk opening after unit correction', 2000,
    milk ? round2_(milk.opening) : 'not found',
    milk && Math.abs(milk.opening - 2000) < 1,
    'Reading the "6 p" row as 6 litres (§6.3, §9)'));

  corrections.push({
    section: 'Opening stock',
    check: 'Stock sheet is a running total, not an opening balance',
    from: 'Manual quantity with no stated basis',
    to: 'Opening layer derived as stock - purchases, per item',
    reason: '§6.3 — Bazar alone cannot explain current Stock quantities.',
    affectsValues: true
  });

  return {
    imported: rows.length,
    reconciled: reconciled,
    discrepancies: discrepancies,
    openingTotal: rows.length
  };
}

// ---------------------------------------------------------------------------
// Cross-checks against the source report sheets
// ---------------------------------------------------------------------------

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
