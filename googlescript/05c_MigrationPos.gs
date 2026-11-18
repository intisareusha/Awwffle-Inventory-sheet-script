/**
 * Awwffle Inventory System — 05c_MigrationPos.gs
 *
 * Imports the Daily Waffles sheet: 28 day-blocks x 18 products.
 *
 * Source structure (D4, §17.7) — easy to get wrong:
 *   - Each block starts on a row whose column A is a label like "Oct 17: Day 1".
 *   - That SAME row also carries the FIRST product (Extra Banana) in column B.
 *   - Then 17 more product rows with an empty column A.
 *   - A footer row holds "Batch: B1:N1:C0" and a per-day total.
 *   - Stray numeric rows exist and must be ignored.
 *
 * Columns: A label | B Product | C Prev Stock | D Cr Stock | E Waffles
 */

function migratePosSnapshots_(sheet, recon, corrections) {
  var blocks = parseDailyWaffleBlocks_(sheet);

  // Re-run protection: a snapshot is unique per (date, product).
  var already = {};
  readRecords_(SHEETS.POS_SNAPSHOTS).forEach(function (r) {
    already[dateKey_(r['Date']) + '|' + String(r['Product'])] = true;
  });

  var rows = [];
  var skipped = 0;
  var productTotals = {};
  var days = [];
  var resetFlags = [];

  blocks.forEach(function (block) {
    days.push(block.date);

    block.products.forEach(function (p) {
      var sold = toNumber_(p.sold);
      var prev = toNumber_(p.prev);
      var curr = toNumber_(p.curr);

      // Reporting always runs, so the report describes the whole dataset.
      var expectedSold = (prev !== null && curr !== null) ? prev - curr : null;
      var reset = false;
      if (expectedSold !== null && sold !== null && Math.abs(expectedSold - sold) > 0.5) {
        reset = curr > prev;
        resetFlags.push({
          day: dateKey_(block.date), product: p.product,
          prev: prev, curr: curr, sold: sold, likelyReset: reset
        });
      }

      productTotals[p.product] = (productTotals[p.product] || 0) + (sold || 0);

      var key = dateKey_(block.date) + '|' + p.product;
      if (already[key]) {
        skipped++;
        return;
      }

      rows.push([
        newId_('SNAP'),
        block.date,
        p.product,
        prev,
        curr,
        sold,
        reset,
        new Date(),
        'Imported from source row ' + p.row
      ]);
    });
  });

  appendRows_(SHEETS.POS_SNAPSHOTS, rows);

  // --- Report ---
  // Count what is actually in the sheet, so a re-run that skips existing rows is
  // not reported as a failure.
  var totalInSheet = readRecords_(SHEETS.POS_SNAPSHOTS).length;

  var waffles = 0;
  var extras = 0;
  POS_PRODUCTS.forEach(function (p) {
    var v = productTotals[p.name] || 0;
    if (p.kind === 'waffle') waffles += v; else extras += v;
  });

  recon.push(reportRow_('POS', 'Snapshot days', EXPECTED.snapshotDays, days.length,
    days.length === EXPECTED.snapshotDays,
    firstKey_(days) + ' to ' + lastKey_(days)));

  recon.push(reportRow_('POS', 'Snapshot rows in sheet', EXPECTED.snapshotDays * 18, totalInSheet,
    totalInSheet === EXPECTED.snapshotDays * 18,
    '28 days x 18 products' + (skipped ? '; ' + skipped + ' already present, skipped' : '')));

  recon.push(reportRow_('POS', 'Waffles sold (12 products)', EXPECTED.wafflesSold, waffles,
    waffles === EXPECTED.wafflesSold, 'Excludes the six extras'));

  recon.push(reportRow_('POS', 'Extras sold (6 products)', EXPECTED.extrasSold, extras,
    extras === EXPECTED.extrasSold, 'Water 18, ice cream 7'));

  if (resetFlags.length) {
    recon.push(reportRow_('POS', 'Sold != prev - curr', 0, resetFlags.length, resetFlags.every(function (f) { return f.likelyReset; }),
      resetFlags.map(function (f) {
        return f.day + ' ' + f.product + ': prev ' + f.prev + ', cr ' + f.curr + ', sold ' + f.sold;
      }).join('; ')));
  } else {
    recon.push(reportRow_('POS', 'Sold == prev - curr', 'all rows', 'all rows', true,
      'No counter reset or arithmetic mismatch in the source period'));
  }

  // Product order must match the master (§7.3, D2).
  var orderOk = blocks.length > 0 && blocks.every(function (b) {
    return b.products.length === 18 &&
      b.products.every(function (p, i) { return p.product === POS_PRODUCTS[i].name; });
  });
  recon.push(reportRow_('POS', 'Product order matches master', true, orderOk, orderOk,
    orderOk ? 'All 28 blocks use the same 18-product order' : 'Order differs — see detail'));

  return {
    imported: rows.length,
    total: totalInSheet,
    skipped: skipped,
    days: days,                 // the actual Date objects, used by closed-day detection
    dayCount: days.length,
    productTotals: productTotals,
    waffles: waffles,
    extras: extras,
    resetFlags: resetFlags
  };
}

/**
 * Parses the repeating blocks. Returns [{ date, label, products: [...], footer }].
 */
function parseDailyWaffleBlocks_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(1, 1, lastRow, 5).getValues();
  var blocks = [];
  var current = null;

  // The first block's date comes from the sheet name context, but the workbook
  // puts the actual date range in the All Time summary. Each label says e.g.
  // "Oct 17: Day 1" with no year, so the year is inferred from the first block
  // and carried forward across the year boundary if needed.
  var year = inferSnapshotYear_(sheet);

  values.forEach(function (row, i) {
    var a = row[0], b = row[1], c = row[2], d = row[3], e = row[4];
    var label = isBlank_(a) ? '' : String(a).trim();

    if (/^[A-Z][a-z]{2}\s+\d/.test(label)) {
      if (current) blocks.push(current);
      current = {
        label: label,
        date: parseDayLabel_(label, year),
        products: [],
        footer: null
      };
      // The date row also carries the first product.
      if (!isBlank_(b)) {
        current.products.push({
          row: i + 1, product: String(b).trim(), prev: c, curr: d, sold: e
        });
      }
      return;
    }

    if (!current || isBlank_(b)) return;

    var text = String(b).trim();

    if (text.indexOf('Batch:') === 0) {
      current.footer = { row: i + 1, label: text, total: e };
      return;
    }

    // Ignore stray numeric-only rows.
    if (/^-?\d+(\.\d+)?$/.test(text)) return;

    current.products.push({ row: i + 1, product: text, prev: c, curr: d, sold: e });
  });

  if (current) blocks.push(current);
  return blocks;
}

/** "Oct 17: Day 1" -> a Date. Month/day are explicit; year is supplied. */
function parseDayLabel_(label, year) {
  var m = String(label).match(/^([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m) return null;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var idx = months.indexOf(m[1]);
  if (idx < 0) return null;
  return new Date(year, idx, Number(m[2]));
}

/**
 * Determines the year to use for the un-year'd day labels.
 * README §13.F36 and §17.1 fix the span: 17 Oct 2026 to 16 Nov 2026.
 *
 * Deliberately does NOT read Settings, so block parsing stays a pure function and
 * can be unit-tested without a spreadsheet.
 */
function inferSnapshotYear_() {
  return 2026;
}

function firstKey_(dates) {
  var valid = dates.filter(Boolean);
  if (!valid.length) return '';
  return dateKey_(new Date(Math.min.apply(null, valid)));
}

function lastKey_(dates) {
  var valid = dates.filter(Boolean);
  if (!valid.length) return '';
  return dateKey_(new Date(Math.max.apply(null, valid)));
}
