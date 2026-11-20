/**
 * Awwffle Inventory System — 10_POS.gs
 *
 * Phase 7 — POS stock snapshots, daily sales derivation, and Daily Waffles.
 *
 * README §7 (POS workflow), §7.2 (calculation + counter reset), §7.4 (filters),
 * §13.A (POS and sales data), §14.7 (gate).
 *
 * THE ONE FIGURE THE OWNER ENTERS
 * The POS export's `Qty` column is `Cr. Stock`. Everything else — units sold,
 * revenue, invoices — is derived from it. Nothing here invents a sale.
 *
 * UNITS SOLD = PREVIOUS Cr. STOCK − CURRENT Cr. STOCK
 *
 * COUNTER RESETS (§7.2)
 * Counters run down from a baseline (normally 10,000) and restart at the baseline
 * when they hit 0. A rise is therefore not negative sales: it is a reset. The true
 * units sold that day is what was consumed on the old counter PLUS the gap implied
 * by the restarted one: `prev + (baseline - curr)`. A rise that is not consistent
 * with a restart is a data-entry error and is refused, never recorded as a sale.
 *
 * SNAPSHOTS ARE THE SOURCE; Prev Stock and Units Sold ARE DERIVED
 * Storing them per row is a convenience for the sheet, but every save recomputes
 * them forward from the edited date, so a corrected snapshot cascades correctly
 * instead of leaving later days based on a stale counter.
 */

// ---------------------------------------------------------------------------
// Public API (called from the sidebar via google.script.run)
// ---------------------------------------------------------------------------
//
// Apps Script's runner only sees functions WITHOUT a trailing underscore, so the
// wrappers below are the boundary between the UI and the logic.

/** Products, baseline, today, and whether history exists. */
function getPosEntryOptions() {
  return getPosEntryOptions_();
}

/** The entry panel for one date: previous counters, any saved snapshot, invoice. */
function getPosDatePanel(dateString) {
  return getPosDatePanel_(dateString);
}

/** Parses a pasted POS export into product / Cr. Stock values. */
function parsePosExport(text) {
  return parsePosExport_(text);
}

/** Saves (or corrects) the snapshot for one date, optionally with the invoice. */
function savePosSnapshot(payload) {
  return savePosSnapshot_(payload);
}

/** Saves only the invoice number for a date. */
function savePosInvoice(payload) {
  return savePosInvoice_(payload);
}

/** Daily Waffles: units sold per item and totals over a date range. */
function getDailyWaffles(startDate, endDate, filters) {
  return getDailyWaffles_(startDate, endDate, filters);
}

// ---------------------------------------------------------------------------
// Products and snapshots
// ---------------------------------------------------------------------------

/** Active POS products, in display order (extras first, then waffles — D2). */
function posProducts_() {
  return readRecords_(SHEETS.POS_PRODUCTS)
    .filter(function (r) { return String(r['Active']) !== 'FALSE' && String(r['Product Name'] || ''); })
    .map(function (r) {
      return {
        name: String(r['Product Name']),
        kind: String(r['Kind'] || ''),
        order: toNumber_(r['Display Order']) || 0,
        cost: toNumber_(r['Cost']),
        sale: toNumber_(r['Sale']),
        baseline: toNumber_(r['Baseline']) || 10000,
        cumulative: toNumber_(r['Cumulative Sold']) || 0
      };
    })
    .sort(function (a, b) { return a.order - b.order; });
}

/** Snapshot rows with the sheet row number attached, for in-place rewrites. */
function snapshotRecords_() {
  var sheet = getSheet_(SHEETS.POS_SNAPSHOTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var headers = getHeaders_(sheet);
  if (!headers.length) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (isBlank_(values[i][0]) && isBlank_(values[i][2])) continue;   // blank row
    var rec = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) rec[String(headers[c])] = values[i][c];
    }
    rec.__row = i + 2;
    out.push(rec);
  }
  return out;
}

/** Builds a schema-ordered row for the PosSnapshots sheet. */
function posSnapshotRow_(rec) {
  return [
    String(rec['Snapshot ID'] || ''),
    rec['Date'],
    String(rec['Product'] || ''),
    rec['Prev Stock'],
    rec['Cr Stock'],
    rec['Units Sold'],
    rec['Reset Occurred'] === true,
    rec['Entered At'] || new Date(),
    String(rec['Notes'] || '')
  ];
}

// ---------------------------------------------------------------------------
// Units sold — the one piece of arithmetic that must never be wrong
// ---------------------------------------------------------------------------

/**
 * Units sold for one day. Pure, so it is measurable without a spreadsheet.
 *
 * Returns { ok, sold, reset, error }. A counter rise that is not consistent with
 * a restart returns ok:false with a message; the caller refuses the save rather
 * than recording a negative or invented figure.
 */
function computeUnitsSold_(prev, curr, baseline) {
  var base = toNumber_(baseline);
  if (base === null || base <= 0) base = 10000;
  var p = toNumber_(prev);
  var c = toNumber_(curr);

  if (p === null || c === null) return { ok: false, error: 'A counter value is missing.' };
  if (p < 0 || c < 0) return { ok: false, error: 'A counter cannot be negative.' };

  if (c <= p) {
    return { ok: true, sold: p - c, reset: false };
  }

  // A rise. After a restart the NEW counter sits near the baseline, so that — not
  // the old value — is what makes a rise consistent with a reset. A small old
  // counter rising to a small new one (100 -> 300) is a typo, not a reset.
  var looksRestarted = c >= base * POS_RESET_MIN_CURR_SHARE;
  if (!looksRestarted) {
    return {
      ok: false,
      error: 'counter rose from ' + p + ' to ' + c + ', which is not a restart at ' +
             'the ' + base + ' baseline. Check the pasted value.'
    };
  }

  return { ok: true, sold: p + (base - c), reset: true };
}

// ---------------------------------------------------------------------------
// Parsing the POS export
// ---------------------------------------------------------------------------

/**
 * Parses the six-column POS export:
 *   SL.  Product  Cost  Qty  Sale  Stock Value
 *
 * Product names contain spaces, so the five trailing/leading fields are read from
 * the ends and the middle is the name. Handles ৳, thousands separators, tabs (a
 * spreadsheet copy) and whitespace (a printed/copied table). `Stock Value` is
 * discarded: it is derived (Qty x Cost) and trusting it would let a typo through.
 *
 * Returns { ok, errors, products: [{ product, crStock, cost, sale }] }.
 */
function parsePosExport_(text) {
  if (isBlank_(text)) return { ok: false, errors: ['Paste the POS export first.'], products: [] };

  var lines = String(text).split(/\r?\n/);
  var products = [];
  var errors = [];

  lines.forEach(function (line) {
    if (!line.trim()) return;

    var parts = line.indexOf('\t') !== -1 ? line.split('\t') : line.trim().split(/\s+/);
    parts = parts.map(function (x) { return String(x).trim(); })
      .filter(function (x) { return x !== ''; });

    if (parts.length < 6) return;                 // header or stray line
    var sl = toNumber_(parts[0]);
    if (sl === null) return;                       // header row, e.g. "SL. Product ..."

    var n = parts.length;
    var product = parts.slice(1, n - 4).join(' ');
    var cost = parsePosMoney_(parts[n - 4]);
    var qty = parsePosMoney_(parts[n - 3]);
    var sale = parsePosMoney_(parts[n - 2]);
    // parts[n - 1] is Stock Value — deliberately ignored.

    if (!product) { errors.push('Line ' + sl + ': could not read the product name.'); return; }
    if (qty === null || qty < 0) {
      errors.push(product + ': could not read a valid Qty (Cr. Stock).');
      return;
    }

    products.push({ product: product, crStock: qty, cost: cost, sale: sale });
  });

  if (!products.length && !errors.length) {
    errors.push('No product rows found. Paste the POS export table ' +
                '(SL, Product, Cost, Qty, Sale, Stock Value).');
  }

  return { ok: errors.length === 0, errors: errors, products: products };
}

/** "5.00৳" / "50,000.00৳" / 5 -> 5 / 50000 / 5. */
function parsePosMoney_(v) {
  if (isBlank_(v)) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var cleaned = String(v).replace(/[৳,\s]/g, '');
  var n = Number(cleaned);
  return isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Bootstrap and per-date panel
// ---------------------------------------------------------------------------

/** Everything the sidebar needs to render its first screen. */
function getPosEntryOptions_() {
  var products = posProducts_();
  if (!products.length) {
    throw new Error('POS_Products is empty. Run Awwffle > Setup / Update structure first.');
  }

  // Seed the lifetime totals from the migrated snapshots the first time (or after
  // any correction): Cumulative Sold = sum of every day's Units Sold.
  syncCumulativeFromSnapshots_();

  products = posProducts_();
  var snapshotRows = snapshotRecords_();
  var firstDate = '';
  var lastDate = '';
  snapshotRows.forEach(function (r) {
    var k = dateKey_(r['Date']);
    if (!k) return;
    if (!firstDate || k < firstDate) firstDate = k;
    if (!lastDate || k > lastDate) lastDate = k;
  });

  return {
    today: dateKey_(new Date()),
    products: products,
    dataStart: firstDate,
    dataEnd: lastDate,
    snapshotCount: snapshotRows.length
  };
}

/**
 * The entry panel for a date: for each product, the counter on the previous day
 * (or the baseline), any already-saved value for this date, and the invoice state.
 */
function getPosDatePanel_(dateString) {
  var d = toDate_(dateString);
  if (!d) return { ok: false, errors: ['A valid date is required.'] };
  var key = dateKey_(d);

  var products = posProducts_();
  var rows = snapshotRecords_();

  var byProduct = {};
  rows.forEach(function (r) {
    var p = String(r['Product'] || '');
    if (!p) return;
    (byProduct[p] || (byProduct[p] = [])).push(r);
  });
  Object.keys(byProduct).forEach(function (p) {
    byProduct[p].sort(function (a, b) { return toDate_(a['Date']) - toDate_(b['Date']); });
  });

  var anySaved = false;
  var out = products.map(function (p) {
    var list = byProduct[p.name] || [];
    var prev = p.baseline;
    var saved = null;

    for (var i = 0; i < list.length; i++) {
      var k = dateKey_(list[i]['Date']);
      if (k < key) prev = toNumber_(list[i]['Cr Stock']);
      else if (k === key) saved = list[i];
    }

    if (saved) anySaved = true;
    return {
      name: p.name,
      kind: p.kind,
      order: p.order,
      baseline: p.baseline,
      cost: p.cost,
      sale: p.sale,
      cumulative: p.cumulative,
      prev: prev,
      current: saved ? toNumber_(saved['Cr Stock']) : '',
      sold: saved ? toNumber_(saved['Units Sold']) : ''
    };
  });

  return {
    ok: true,
    date: key,
    today: dateKey_(new Date()),
    isClosedDay: isClosedDay_(d),
    isEditing: anySaved,
    products: out,
    invoice: invoiceInfo_(key)
  };
}

/** Existing invoice for a date plus the newest earlier numeric invoice number. */
function invoiceInfo_(key) {
  var rows = readRecords_(SHEETS.INVOICES);
  var existing = null;
  var prevLast = null;
  var prevDate = null;

  rows.forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    var k = dateKey_(d);

    if (k === key) existing = r;

    var last = toNumber_(r['Last Invoice No']);
    if (last !== null && k < key && (prevDate === null || d > prevDate)) {
      prevDate = d;
      prevLast = last;
    }
  });

  return {
    existing: existing ? {
      lastInvoiceNo: toNumber_(existing['Last Invoice No']),
      invoiceCount: toNumber_(existing['Invoice Count']),
      baselineUsed: String(existing['Baseline Used'] || ''),
      source: String(existing['Source'] || '')
    } : null,
    prevLast: prevLast
  };
}

// ---------------------------------------------------------------------------
// Saving a snapshot
// ---------------------------------------------------------------------------

/**
 * `payload` = {
 *   date: 'yyyy-MM-dd',
 *   notes: '',
 *   products: [ { product, crStock, cost, sale } ],
 *   invoice: { lastInvoiceNo, invoiceCount }   // optional
 * }
 *
 * One row per product per date. Saving a date that already has rows corrects it;
 * saving a new date appends. Prev Stock / Units Sold are recomputed forward from
 * the edited date for every affected product, so a correction never leaves later
 * days based on a stale counter. Nothing is written if any row fails validation.
 */
function savePosSnapshot_(payload) {
  payload = payload || {};
  var errors = [];

  var date = toDate_(payload.date);
  if (!date) errors.push('A valid date is required.');
  else if (date > toDate_(new Date())) errors.push('The snapshot date is in the future.');
  var key = date ? dateKey_(date) : '';

  var products = posProducts_();
  if (!products.length) errors.push('POS_Products is empty. Run Setup first.');

  var byName = {};
  products.forEach(function (p) { byName[normaliseItemName_(p.name)] = p; });

  var valuesByName = {};
  (payload.products || []).forEach(function (x) {
    var p = byName[normaliseItemName_(x && x.product)];
    if (!p) {
      errors.push('"' + ((x && x.product) || '') + '" is not a POS product.');
      return;
    }
    var cr = toNumber_(x.crStock);
    if (cr === null || cr < 0) {
      errors.push(p.name + ': Cr. Stock must be zero or more.');
      return;
    }
    valuesByName[p.name] = { cr: cr, cost: toNumber_(x.cost), sale: toNumber_(x.sale) };
  });

  products.forEach(function (p) {
    if (!valuesByName.hasOwnProperty(p.name)) {
      errors.push('Missing Cr. Stock for ' + p.name + '.');
    }
  });

  // Invoice is optional, but if a number is given it must be valid.
  var invoiceRow = null;
  var inv = payload.invoice || {};
  if (!isBlank_(inv.lastInvoiceNo)) {
    var built = buildInvoice_(date, inv.lastInvoiceNo, inv.invoiceCount);
    if (!built.ok) built.errors.forEach(function (e) { errors.push(e); });
    else invoiceRow = built.row;
  } else if (!isBlank_(inv.invoiceCount)) {
    errors.push('Enter the last invoice number from the POS, or clear the invoice fields.');
  }

  if (errors.length) return { ok: false, errors: errors };

  // ---- Build the in-memory snapshot model ----
  var rows = snapshotRecords_();
  var groups = {};
  products.forEach(function (p) { groups[p.name] = []; });
  rows.forEach(function (r) {
    var p = String(r['Product'] || '');
    if (groups.hasOwnProperty(p)) groups[p].push(r);
  });
  products.forEach(function (p) { sortByDate_(groups[p]); });

  // Upsert this date's value for every product.
  products.forEach(function (p) {
    var list = groups[p.name];
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (dateKey_(list[i]['Date']) === key) { found = list[i]; break; }
    }
    if (found) {
      found['Cr Stock'] = valuesByName[p.name].cr;
    } else {
      var rec = {
        'Snapshot ID': newId_('SNAP'),
        'Date': date,
        'Product': p.name,
        'Prev Stock': '',
        'Cr Stock': valuesByName[p.name].cr,
        'Units Sold': '',
        'Reset Occurred': false,
        'Entered At': new Date(),
        'Notes': String(payload.notes || '')
      };
      rec.__new = true;
      list.push(rec);
    }
  });
  products.forEach(function (p) { sortByDate_(groups[p]); });

  // ---- Recompute Prev / Units Sold / Reset from this date forward ----
  var resetProducts = [];
  products.forEach(function (p) {
    var list = groups[p.name];
    var start = 0;
    while (start < list.length && dateKey_(list[start]['Date']) < key) start++;

    for (var i = start; i < list.length; i++) {
      var e = list[i];
      var prev = i === 0 ? p.baseline : toNumber_(list[i - 1]['Cr Stock']);
      var curr = toNumber_(e['Cr Stock']);
      var res = computeUnitsSold_(prev, curr, p.baseline);
      if (!res.ok) {
        errors.push(p.name + ' on ' + dateKey_(e['Date']) + ': ' + res.error);
        return;
      }
      e['Prev Stock'] = prev;
      e['Units Sold'] = res.sold;
      e['Reset Occurred'] = res.reset;
      if (res.reset && dateKey_(e['Date']) === key) resetProducts.push(p.name);
    }
  });

  if (errors.length) return { ok: false, errors: errors };

  // ---- Write ----
  var appends = [];
  var updates = [];
  products.forEach(function (p) {
    groups[p.name].forEach(function (e) {
      if (e.__new) {
        appends.push(posSnapshotRow_(e));
      } else if (dateKey_(e['Date']) >= key) {
        updates.push({ row: e.__row, values: posSnapshotRow_(e) });
      }
    });
  });

  if (appends.length) appendRows_(SHEETS.POS_SNAPSHOTS, appends);

  var snapSheet = getSheet_(SHEETS.POS_SNAPSHOTS);
  updates.forEach(function (u) {
    if (u.row && u.row >= 2) {
      snapSheet.getRange(u.row, 1, 1, u.values.length).setValues([u.values]);
    }
  });

  // ---- Cumulative lifetime totals (derived, never hand-entered) ----
  var totals = {};
  products.forEach(function (p) {
    var sum = 0;
    groups[p.name].forEach(function (e) {
      var n = toNumber_(e['Units Sold']);
      if (n !== null) sum += n;
    });
    totals[p.name] = round2_(sum);
  });
  writeCumulativeSold_(totals);

  // ---- Cost / sale changes, only when this is the newest day ----
  var hasLater = false;
  products.forEach(function (p) {
    groups[p.name].forEach(function (e) {
      if (dateKey_(e['Date']) > key) hasLater = true;
    });
  });
  if (!hasLater) applyPriceChanges_(products, valuesByName, date);

  // ---- Invoice ----
  if (invoiceRow) upsertInvoiceRow_(date, invoiceRow);

  var totalUnits = products.reduce(function (s, p) { return s + totals[p.name]; }, 0);
  logEvent_('POS', 'Snapshot saved',
    key + ', ' + (payload.products || []).length + ' products' +
    (invoiceRow ? ', invoice saved' : ''));

  return {
    ok: true,
    date: key,
    savedProducts: (payload.products || []).length,
    totalUnits: round2_(totalUnits),
    resets: resetProducts,
    invoiceSaved: !!invoiceRow,
    message: 'Saved POS snapshot for ' + key + '.' +
      (resetProducts.length ? ' Counter reset handled for: ' + resetProducts.join(', ') + '.' : '')
  };
}

/** Stable sort on the Date column. */
function sortByDate_(rows) {
  rows.sort(function (a, b) { return toDate_(a['Date']) - toDate_(b['Date']); });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/**
 * Builds the invoice record for a date (pure). The owner enters only the POS's
 * last invoice number; the daily count is derived from the previous day.
 *
 * The first daily record after the monthly aggregates has no numeric predecessor,
 * so it takes the count from the POS day summary and records that fact — the
 * README requires the source to be recorded rather than guessed (§7.2).
 */
function buildInvoice_(date, lastNo, firstDayCount) {
  var d = toDate_(date);
  if (!d) return { ok: false, errors: ['A valid date is required.'] };
  var key = dateKey_(d);

  var last = toNumber_(lastNo);
  if (last === null || last < 0) {
    return { ok: false, errors: ['Enter the last invoice number shown by the POS.'] };
  }

  var existing = readRecords_(SHEETS.INVOICES).filter(function (r) {
    return dateKey_(r['Date']) === key;
  })[0];

  if (existing && String(existing['Source'] || '') !== 'Daily') {
    return {
      ok: false,
      errors: ['An aggregated invoice row already exists for ' + key +
               '. Record daily invoices on a date that has no monthly aggregate.']
    };
  }

  var info = invoiceInfo_(key);
  var derived = deriveInvoiceCount_(last, info.prevLast, firstDayCount);
  if (!derived.ok) return { ok: false, errors: [derived.error] };

  return {
    ok: true,
    count: derived.count,
    row: [d, last, derived.count, derived.baseline, 'Daily', new Date()]
  };
}

/**
 * Pure invoice arithmetic (README §7.2). The daily count is `last − previous
 * last`; the first day with no predecessor takes the count from the POS day
 * summary and says so, rather than guessing.
 */
function deriveInvoiceCount_(lastNo, prevLast, firstDayCount) {
  var last = toNumber_(lastNo);
  if (last === null || last < 0) {
    return { ok: false, error: 'Enter the last invoice number shown by the POS.' };
  }

  if (prevLast !== null && prevLast !== undefined && toNumber_(prevLast) !== null) {
    var p = toNumber_(prevLast);
    var count = last - p;
    if (count < 0) {
      return {
        ok: false,
        error: 'The last invoice number (' + last + ') is lower than the previous ' +
               'day\'s (' + p + '). Check both entries.'
      };
    }
    return { ok: true, count: count, baseline: 'Previous day last invoice ' + p, first: false };
  }

  var c = toNumber_(firstDayCount);
  if (c === null || c < 0) {
    return {
      ok: false,
      error: 'No previous invoice number exists yet. Enter how many invoices the ' +
             'POS day summary shows for this first day.'
    };
  }
  return { ok: true, count: c, baseline: 'First daily entry (POS day summary)', first: true };
}

/** Saves only the invoice for a date (used independently of a snapshot). */
function savePosInvoice_(payload) {
  payload = payload || {};
  var date = toDate_(payload.date);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };
  if (date > toDate_(new Date())) return { ok: false, errors: ['The date is in the future.'] };

  var built = buildInvoice_(date, payload.lastInvoiceNo, payload.invoiceCount);
  if (!built.ok) return { ok: false, errors: built.errors };

  upsertInvoiceRow_(date, built.row);
  logEvent_('POS', 'Invoice saved', dateKey_(date) + ' count ' + built.count);

  return {
    ok: true,
    date: dateKey_(date),
    count: built.count,
    message: 'Invoice saved for ' + dateKey_(date) + ': ' + built.count + ' invoices.'
  };
}

/** Writes the invoice row for a date, updating an existing daily row in place. */
function upsertInvoiceRow_(date, row) {
  var sheet = getSheet_(SHEETS.INVOICES);
  var key = dateKey_(date);
  var lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (dateKey_(dates[i][0]) === key) {
        sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }

  appendRows_(SHEETS.INVOICES, [row]);
}

// ---------------------------------------------------------------------------
// Cumulative totals and price history
// ---------------------------------------------------------------------------

/** Recomputes Cumulative Sold per product from all snapshots and writes changes. */
function syncCumulativeFromSnapshots_() {
  var sums = {};
  snapshotRecords_().forEach(function (r) {
    var p = String(r['Product'] || '');
    if (!p) return;
    var n = toNumber_(r['Units Sold']);
    sums[p] = (sums[p] || 0) + (n === null ? 0 : n);
  });
  writeCumulativeSold_(sums);
}

/** Writes Cumulative Sold only where it differs, so a no-op remains a no-op. */
function writeCumulativeSold_(totals) {
  var sheet = getSheet_(SHEETS.POS_PRODUCTS);
  var headers = getHeaders_(sheet);
  var nameCol = colIndex_(headers, 'Product Name');
  var cumCol = colIndex_(headers, 'Cumulative Sold');
  if (nameCol < 0 || cumCol < 0) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var names = sheet.getRange(2, nameCol + 1, lastRow - 1, 1).getValues();
  var cumulative = sheet.getRange(2, cumCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    var name = String(names[i][0] || '');
    if (!name || !totals.hasOwnProperty(name)) continue;
    var current = toNumber_(cumulative[i][0]);
    var next = round2_(totals[name]);
    if (current !== next) sheet.getRange(i + 2, cumCol + 1).setValue(next);
  }
}

/**
 * Records a dated price change when the pasted Cost/Sale differs from the current
 * one. PriceHistory is dated, so an old period is never restated (§13.D29).
 */
function applyPriceChanges_(products, valuesByName, date) {
  var changes = [];
  products.forEach(function (p) {
    var v = valuesByName[p.name];
    if (!v) return;

    var cost = (v.cost === null || v.cost === undefined) ? null : v.cost;
    var sale = (v.sale === null || v.sale === undefined) ? null : v.sale;

    var costChanged = cost !== null && p.cost !== null && cost !== p.cost;
    var saleChanged = sale !== null && p.sale !== null && sale !== p.sale;
    if (!costChanged && !saleChanged) return;

    changes.push({
      name: p.name,
      cost: costChanged ? cost : p.cost,
      sale: saleChanged ? sale : p.sale
    });
  });

  if (!changes.length) return;

  var rows = changes.map(function (c) {
    return [c.name, date, c.cost, c.sale, new Date(), 'Changed in POS paste'];
  });
  appendRows_(SHEETS.PRICE_HISTORY, rows);

  changes.forEach(function (c) {
    updatePosProductFields_(c.name, { 'Cost': c.cost, 'Sale': c.sale });
  });
}

/** Sets named columns on one POS product row. */
function updatePosProductFields_(name, fields) {
  var sheet = getSheet_(SHEETS.POS_PRODUCTS);
  var headers = getHeaders_(sheet);
  var nameCol = colIndex_(headers, 'Product Name');
  if (nameCol < 0) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var names = sheet.getRange(2, nameCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0] || '') !== name) continue;

    Object.keys(fields).forEach(function (header) {
      var col = colIndex_(headers, header);
      if (col >= 0) sheet.getRange(i + 2, col + 1).setValue(fields[header]);
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// Daily Waffles — derived view over the snapshots
// ---------------------------------------------------------------------------

/**
 * Units sold per item over a range, with revenue at the configured Sale price.
 *
 * Filters: { product: '...' } (exact name), { kind: 'waffle' | 'extra' }.
 * Returns rows (date/product/prev/curr/sold), per-product totals, and grand totals.
 */
function getDailyWaffles_(startDate, endDate, filters) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;
  var f = filters || {};
  var wantProduct = String(f.product || '');
  var wantKind = String(f.kind || '');

  var products = posProducts_();
  var kindOf = {};
  var saleOf = {};
  products.forEach(function (p) { kindOf[p.name] = p.kind; saleOf[p.name] = p.sale; });

  var rows = [];
  var byProduct = {};

  snapshotRecords_().forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    var product = String(r['Product'] || '');
    if (!product) return;
    if (wantProduct && product !== wantProduct) return;
    if (wantKind && kindOf[product] !== wantKind) return;

    var sold = toNumber_(r['Units Sold']);
    if (sold === null) sold = 0;

    rows.push({
      date: dateKey_(d),
      product: product,
      prev: toNumber_(r['Prev Stock']),
      curr: toNumber_(r['Cr Stock']),
      sold: round2_(sold),
      reset: r['Reset Occurred'] === true || String(r['Reset Occurred']) === 'true'
    });

    if (!byProduct[product]) {
      byProduct[product] = { product: product, kind: kindOf[product] || '', units: 0, revenue: 0 };
    }
    byProduct[product].units += sold;
    var sale = toNumber_(saleOf[product]);
    if (sale !== null) byProduct[product].revenue += sold * sale;
  });

  rows.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;   // newest first
    return a.product < b.product ? -1 : 1;
  });

  var list = Object.keys(byProduct).map(function (k) {
    var x = byProduct[k];
    x.units = round2_(x.units);
    x.revenue = round2_(x.revenue);
    return x;
  });
  list.sort(function (a, b) {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return b.units - a.units;
  });

  var totalUnits = list.reduce(function (s, x) { return s + x.units; }, 0);
  var totalRevenue = list.reduce(function (s, x) { return s + x.revenue; }, 0);

  return {
    range: {
      start: start ? dateKey_(start) : '',
      end: end ? dateKey_(end) : ''
    },
    rows: rows,
    byProduct: list,
    totalUnits: round2_(totalUnits),
    totalRevenue: round2_(totalRevenue),
    rowCount: rows.length
  };
}
