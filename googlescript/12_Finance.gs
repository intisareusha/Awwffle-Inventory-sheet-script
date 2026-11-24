/**
 * Awwffle Inventory System — 12_Finance.gs
 *
 * Discounts and dues, and the cash-in-hand figure that uses them.
 *
 * README §8.1 (Original Sale is already net of discount), §13.B14 (discount is one
 * dated daily amount), §13.B16 (due is a dated record with an optional customer),
 * §13.G3 (no per-invoice records), §11 (one source, one truth).
 *
 * THE ARITHMETIC
 *
 *     Sale after discount = gross POS sale − discount in range
 *     Cash in hand        = Sale after discount − outstanding due − Bazar in range
 *
 * Only OUTSTANDING dues reduce cash. A due marked Paid has already come back, so it
 * stops reducing cash and its row becomes inert history: deleting it changes
 * nothing. Deleting an outstanding due removes a deduction, so cash rises by that
 * amount — the owner's "no money drop" rule.
 *
 * ONE DISCOUNT PER DAY
 * A discount row is keyed by date: saving the same date corrects it instead of
 * adding a second row, so a day can never be discounted twice.
 *
 * WHY THE LEGACY `DiscountDue` SHEET IS NOT READ
 * Migration imported two monthly lumps (Oct 6,032 / Nov 2,826). The owner is now
 * entering daily figures for that same period, so reading both would double-count.
 * This module reads only `Discounts` and `Dues`.
 */

// ---------------------------------------------------------------------------
// Public API (called from the sidebars via google.script.run)
// ---------------------------------------------------------------------------

/** Bootstrap for the discount sidebar: range extent and all records. */
function getDiscountPanel() {
  return getDiscountPanel_();
}

/** Discounts filtered to a date range, newest first. */
function getDiscountList(startDate, endDate) {
  return buildDiscountList_(startDate, endDate);
}

/** Records or corrects one day's discount. */
function saveDiscount(payload) {
  return saveDiscount_(payload);
}

/** Deletes one discount row by ID. */
function deleteDiscount(discountId) {
  return deleteDiscount_(discountId);
}

/** Bootstrap for the due sidebar: customers, range extent, all records. */
function getDuePanel() {
  return getDuePanel_();
}

/** Dues filtered to a date range, newest first, with per-customer outstanding. */
function getDueList(startDate, endDate) {
  return buildDueList_(startDate, endDate);
}

/** Records a new due or edits an existing one. */
function saveDue(payload) {
  return saveDue_(payload);
}

/** Marks a due Paid (money received) or Outstanding again. */
function setDuePaid(payload) {
  return setDuePaid_(payload);
}

/** Deletes one due row by ID. */
function deleteDue(dueId) {
  return deleteDue_(dueId);
}

/**
 * Resolves a preset ('all', 'today', 'last7', …) to concrete start/end dates for
 * the finance sidebars, using the same resolver the Summary tabs use. "All time"
 * spans the whole system extent (opening date → today), so the picker shows the
 * real start and end instead of collapsing to today.
 */
function resolveFinancePreset(preset, todayStr) {
  var today = dateKey_(toDate_(todayStr) || toDate_(new Date()));

  if (preset === 'all') {
    var extent = financeRangeExtent_(readDiscountRows_().concat(readDueRows_()), today);
    return { start: extent.start, end: extent.end };
  }

  var range = resolvePreset_(preset, today);
  return range || { start: today, end: today };
}

// ---------------------------------------------------------------------------
// Pure helpers — testable without a spreadsheet
// ---------------------------------------------------------------------------

/** Customer identity: trimmed, case-insensitive. Keeps "Riyad" and "riyad" one. */
function normaliseCustomer_(name) {
  return String(name === null || name === undefined ? '' : name).trim().toLowerCase();
}

/** True when a date value falls inside [start, end]; null bounds are open. */
function inDateRange_(value, start, end) {
  var d = toDate_(value);
  if (!d) return false;
  var s = start ? toDate_(start) : null;
  var e = end ? toDate_(end) : null;
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}

/**
 * Sum of discounts in a range. Pure: rows are plain objects, so the same function
 * is used by the written record and by the tests.
 */
function sumDiscountsInRange_(rows, start, end) {
  var total = 0;
  (rows || []).forEach(function (r) {
    if (!inDateRange_(r.date, start, end)) return;
    total += toNumber_(r.amount) || 0;
  });
  return round2_(total);
}

/**
 * Sum of dues in a range. `onlyOutstanding` is the normal cash-in-hand case;
 * passing false totals every due that was accrued.
 */
function sumDuesInRange_(rows, start, end, onlyOutstanding) {
  var total = 0;
  (rows || []).forEach(function (r) {
    if (!inDateRange_(r.date, start, end)) return;
    if (onlyOutstanding && String(r.status) !== 'Paid') {
      total += toNumber_(r.amount) || 0;
    } else if (!onlyOutstanding) {
      total += toNumber_(r.amount) || 0;
    }
  });
  return round2_(total);
}

/** Cash in hand, exactly as the README defines it (discount applied once). */
function cashInHand_(grossSale, discount, dueOutstanding, bazar) {
  var gross = toNumber_(grossSale) || 0;
  var disc = toNumber_(discount) || 0;
  var due = toNumber_(dueOutstanding) || 0;
  var exp = toNumber_(bazar) || 0;
  return round2_(gross - disc - due - exp);
}

/** Earliest and latest date keys across plain records. */
function recordDateExtent_(rows) {
  var first = '';
  var last = '';
  (rows || []).forEach(function (r) {
    var k = dateKey_(r.date);
    if (!k) return;
    if (!first || k < first) first = k;
    if (!last || k > last) last = k;
  });
  return { start: first, end: last };
}

/** Earliest `date` key across already-mapped rows, or ''. */
function earliestRecordKey_(rows) {
  var first = '';
  (rows || []).forEach(function (r) {
    var k = String(r.date || '');
    if (k && (!first || k < first)) first = k;
  });
  return first;
}

/** Latest `date` key across already-mapped rows, or ''. */
function latestRecordKey_(rows) {
  var last = '';
  (rows || []).forEach(function (r) {
    var k = String(r.date || '');
    if (k && (!last || k > last)) last = k;
  });
  return last;
}

/**
 * The "All time" extent for the finance sidebars.
 *
 * Derived from the finance ledgers themselves — the earliest date across
 * Discounts and Dues through today. It deliberately does NOT depend on POS /
 * Batches / Bazar: those can be empty (or slow to read), and when they were empty
 * the old start fell back to *today*, making "All time" a one-day range and every
 * query return nothing. The first discount (17 Oct 2026) is the real first day.
 *
 * Each panel passes both ledgers so both sidebars report the same opening date,
 * even when one ledger starts later than the other.
 */
function financeRangeExtent_(records, today) {
  var start = earliestRecordKey_(records) || today;

  var end = today;
  var latest = latestRecordKey_(records);
  if (latest && latest > end) end = latest;

  return { start: start, end: end };
}

// ---------------------------------------------------------------------------
// Reading records
// ---------------------------------------------------------------------------

/**
 * Finance records keyed by header.
 *
 * Unlike the generic `readRecords_`, this does NOT discard a row just because the
 * ID column is blank. The owner may type a discount or due straight into the tab,
 * leaving the generated ID empty; dropping those rows made real data invisible.
 * A missing ID is filled in once (self-healing) so edit / paid / delete keep a
 * stable handle on the row.
 */
function readFinanceRows_(sheetName, idHeader, idPrefix) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idCol = colIndex_(headers, idHeader);
  var records = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var hasData = row.some(function (cell) { return !isBlank_(cell); });
    if (!hasData) continue;

    var record = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) record[headers[c]] = row[c];
    }

    // A row that has neither a date nor an amount is padding, not a record.
    if (isBlank_(record['Date']) && isBlank_(record['Amount'])) continue;

    if (idCol >= 0 && isBlank_(record[idHeader])) {
      record[idHeader] = newId_(idPrefix);
      sheet.getRange(r + 1, idCol + 1).setValue(record[idHeader]);
    }

    records.push(record);
  }

  return records;
}

/** Discount rows as plain objects, in sheet order. */
function readDiscountRows_() {
  return readFinanceRows_(SHEETS.DISCOUNTS, 'Discount ID', 'DISC').map(function (r) {
    return {
      discountId: String(r['Discount ID'] || ''),
      date: dateKey_(r['Date']),
      amount: toNumber_(r['Amount']),
      notes: String(r['Notes'] || ''),
      enteredAt: r['Entered At'] || ''
    };
  }).filter(function (r) { return r.discountId || r.date; });
}

/** Due rows as plain objects, in sheet order. */
function readDueRows_() {
  return readFinanceRows_(SHEETS.DUES, 'Due ID', 'DUE').map(function (r) {
    var status = String(r['Status'] || '').trim();
    if (status !== 'Paid') status = 'Outstanding';
    return {
      dueId: String(r['Due ID'] || ''),
      date: dateKey_(r['Date']),
      customer: String(r['Customer'] || ''),
      amount: toNumber_(r['Amount']),
      status: status,
      paidDate: dateKey_(r['Paid Date']),
      notes: String(r['Notes'] || ''),
      enteredAt: r['Entered At'] || ''
    };
  }).filter(function (r) { return r.dueId || r.date; });
}

/** Customer names for the dropdown: configured list, then any used in Dues. */
function customerNames_() {
  var out = [];
  var seen = {};

  function add(name) {
    var clean = String(name === null || name === undefined ? '' : name).trim();
    if (!clean) return;
    var key = normaliseCustomer_(clean);
    if (seen[key]) return;
    seen[key] = true;
    out.push(clean);
  }

  // Read the Customers tab by position (column A = name, column B = Active).
  // Header-key reads silently return nothing when a header has stray whitespace,
  // which left the sidebar dropdown empty even though the tab was populated.
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow >= 2 && lastCol >= 1) {
      sheet.getRange(2, 1, lastRow - 1, lastCol).getValues().forEach(function (row) {
        var active = String(row.length > 1 ? row[1] : '').trim().toUpperCase();
        if (active === 'FALSE') return;   // deactivated customers are hidden
        add(row[0]);
      });
    }
  }

  // A due may reference a name that was never written to Customers (e.g. imported),
  // so include those too rather than silently hiding them from the dropdown.
  readDueRows_().forEach(function (r) { add(r.customer); });

  return out;
}

/** Appends a customer the first time it is used, so the dropdown learns it. */
function addCustomerIfNew_(name) {
  var clean = String(name || '').trim();
  if (!clean) return false;

  var sheet = getSheet_(SHEETS.CUSTOMERS);
  if (!getHeaders_(sheet).length) writeHeaders_(sheet, SCHEMA[SHEETS.CUSTOMERS]);

  var key = normaliseCustomer_(clean);
  var exists = readRecords_(SHEETS.CUSTOMERS).some(function (r) {
    return normaliseCustomer_(r['Customer']) === key;
  });
  if (exists) return false;

  appendRows_(SHEETS.CUSTOMERS, [[clean, true, 'Added from a due entry']]);
  return true;
}

/** Sheet row number holding an ID in column A, or -1. */
function findFinanceRow_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) return i + 2;
  }
  return -1;
}

/** Row number of the discount for a date key, or -1 (one row per day). */
function findDiscountRowByDate_(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var dates = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (dateKey_(dates[i][0]) === key) return i + 2;
  }
  return -1;
}

/** Writes a plain record into a sheet row, mapped by header name. */
function writeFinanceRow_(sheet, rowNumber, record) {
  var headers = getHeaders_(sheet);
  var values = headers.map(function (h) {
    return record.hasOwnProperty(h) ? record[h] : '';
  });
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

function getDiscountPanel_() {
  var list = buildDiscountList_('', '');
  var today = dateKey_(new Date());
  var extent = financeRangeExtent_(list.records.concat(readDueRows_()), today);

  return {
    today: today,
    dataStart: extent.start,
    dataEnd: extent.end,
    records: list.records,
    total: list.total,
    count: list.count
  };
}

function buildDiscountList_(startDate, endDate) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;

  var records = readDiscountRows_().filter(function (r) {
    return inDateRange_(r.date, start, end);
  });

  records.sort(function (a, b) {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;   // newest first
  });

  var total = sumDiscountsInRange_(records, null, null);

  return {
    range: {
      start: start ? dateKey_(start) : '',
      end: end ? dateKey_(end) : ''
    },
    records: records,
    total: total,
    count: records.length
  };
}

function saveDiscount_(payload) {
  var p = payload || {};

  var date = toDate_(p.date);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };
  if (date > toDate_(new Date())) {
    return { ok: false, errors: ['The discount date cannot be in the future.'] };
  }

  var amount = toNumber_(p.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, errors: ['Enter a discount amount greater than zero.'] };
  }

  var sheet = getSheet_(SHEETS.DISCOUNTS);
  if (!getHeaders_(sheet).length) writeHeaders_(sheet, SCHEMA[SHEETS.DISCOUNTS]);

  var key = dateKey_(date);
  var notes = String(p.notes || '').trim();
  var explicitId = String(p.discountId || '').trim();

  // One discount per day is the invariant. Find the row for this date, and when an
  // edit moves a row onto a different existing day, collapse them into one instead
  // of leaving two rows for the same date.
  var byDateRow = findDiscountRowByDate_(sheet, key);
  var targetRow = explicitId ? findFinanceRow_(sheet, explicitId) : -1;
  var collapseRow = -1;

  if (targetRow >= 2 && byDateRow >= 2 && targetRow !== byDateRow) {
    collapseRow = targetRow;
    targetRow = byDateRow;
  } else if (targetRow < 2) {
    targetRow = byDateRow;
  }

  var verb = 'recorded';
  var id;

  if (targetRow >= 2) {
    var existing = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    id = String(existing[0] || '').trim() || explicitId || newId_('DISC');
    writeFinanceRow_(sheet, targetRow, {
      'Discount ID': id,
      'Date': date,
      'Amount': round2_(amount),
      'Notes': notes,
      // Keep the original entry stamp when correcting an existing day.
      'Entered At': existing[4] || new Date()
    });
    // Remove the now-duplicate row from the date this edit moved away from.
    if (collapseRow >= 2) sheet.deleteRow(collapseRow);
    verb = 'corrected';
  } else {
    id = newId_('DISC');
    appendRows_(SHEETS.DISCOUNTS, [[id, date, round2_(amount), notes, new Date()]]);
  }

  logEvent_('DISCOUNT', 'Discount ' + verb, key + ' = ' + round2_(amount) +
    (notes ? ' (' + notes + ')' : ''));

  return {
    ok: true,
    discountId: id,
    date: key,
    amount: round2_(amount),
    message: 'Discount ' + verb + ' for ' + key + ': ' + round2_(amount) + ' BDT.',
    panel: getDiscountPanel_()
  };
}

function deleteDiscount_(discountId) {
  var id = String(discountId || '').trim();
  if (!id) return { ok: false, errors: ['No discount was selected.'] };

  var sheet = getSheet_(SHEETS.DISCOUNTS);
  var row = findFinanceRow_(sheet, id);
  if (row < 2) {
    return { ok: false, errors: ['That discount no longer exists. It may already be deleted.'] };
  }

  var record = readDiscountRows_().filter(function (r) { return r.discountId === id; })[0];
  var label = record ? (record.date + ' · ' + round2_(record.amount) + ' BDT') : id;

  sheet.deleteRow(row);
  logEvent_('DISCOUNT', 'Discount deleted', label + ' (' + id + ')');

  return {
    ok: true,
    deleted: id,
    message: 'Deleted discount: ' + label + '.',
    panel: getDiscountPanel_()
  };
}

// ---------------------------------------------------------------------------
// Dues
// ---------------------------------------------------------------------------

function getDuePanel_() {
  var list = buildDueList_('', '');
  var today = dateKey_(new Date());
  var extent = financeRangeExtent_(list.records.concat(readDiscountRows_()), today);

  return {
    today: today,
    dataStart: extent.start,
    dataEnd: extent.end,
    customers: customerNames_(),
    records: list.records,
    totalOutstanding: list.totalOutstanding,
    totalAccrued: list.totalAccrued,
    count: list.count,
    byCustomer: list.byCustomer
  };
}

function buildDueList_(startDate, endDate) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;

  var records = readDueRows_().filter(function (r) {
    return inDateRange_(r.date, start, end);
  });

  records.sort(function (a, b) {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;   // newest first
  });

  var totalOutstanding = 0;
  var totalAccrued = 0;
  var byCustomer = {};
  var outstandingCount = 0;

  records.forEach(function (r) {
    var amount = toNumber_(r.amount) || 0;
    totalAccrued += amount;

    var key = normaliseCustomer_(r.customer) || '(no customer)';
    if (!byCustomer[key]) {
      byCustomer[key] = {
        customer: String(r.customer || '').trim() || '(no customer)',
        accrued: 0, outstanding: 0, paid: 0, openCount: 0, count: 0
      };
    }
    var bucket = byCustomer[key];
    bucket.accrued += amount;
    bucket.count++;

    if (r.status === 'Paid') {
      bucket.paid += amount;
    } else {
      bucket.outstanding += amount;
      bucket.openCount++;
      totalOutstanding += amount;
      outstandingCount++;
    }
  });

  var customers = Object.keys(byCustomer).map(function (k) {
    var b = byCustomer[k];
    return {
      customer: b.customer,
      accrued: round2_(b.accrued),
      outstanding: round2_(b.outstanding),
      paid: round2_(b.paid),
      openCount: b.openCount,
      count: b.count
    };
  }).sort(function (a, b) {
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
    return a.customer < b.customer ? -1 : 1;
  });

  return {
    range: {
      start: start ? dateKey_(start) : '',
      end: end ? dateKey_(end) : ''
    },
    records: records,
    totalOutstanding: round2_(totalOutstanding),
    totalAccrued: round2_(totalAccrued),
    count: records.length,
    outstandingCount: outstandingCount,
    byCustomer: customers
  };
}

function saveDue_(payload) {
  var p = payload || {};

  var date = toDate_(p.date);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };
  if (date > toDate_(new Date())) {
    return { ok: false, errors: ['The due date cannot be in the future.'] };
  }

  var customer = String(p.customer || '').trim();
  if (!customer) return { ok: false, errors: ['Choose or type a customer.'] };

  var amount = toNumber_(p.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, errors: ['Enter a due amount greater than zero.'] };
  }

  var sheet = getSheet_(SHEETS.DUES);
  if (!getHeaders_(sheet).length) writeHeaders_(sheet, SCHEMA[SHEETS.DUES]);

  var notes = String(p.notes || '').trim();
  var explicitId = String(p.dueId || '').trim();
  var row = explicitId ? findFinanceRow_(sheet, explicitId) : -1;

  var addedCustomer = addCustomerIfNew_(customer);

  var verb = 'recorded';
  var id;

  if (row >= 2) {
    var existing = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    id = String(existing[0] || '').trim() || explicitId || newId_('DUE');
    // Editing a due keeps its paid/outstanding state; only the details change.
    var status = String(existing[4] || '').trim() === 'Paid' ? 'Paid' : 'Outstanding';
    writeFinanceRow_(sheet, row, {
      'Due ID': id,
      'Date': date,
      'Customer': customer,
      'Amount': round2_(amount),
      'Status': status,
      'Paid Date': status === 'Paid' ? existing[5] : '',
      'Notes': notes,
      'Entered At': existing[7] || new Date()
    });
    verb = 'updated';
  } else {
    id = newId_('DUE');
    appendRows_(SHEETS.DUES, [[
      id, date, customer, round2_(amount), 'Outstanding', '', notes, new Date()
    ]]);
  }

  logEvent_('DUE', 'Due ' + verb, customer + ' ' + dateKey_(date) + ' = ' + round2_(amount) +
    (addedCustomer ? ' (new customer remembered)' : ''));

  return {
    ok: true,
    dueId: id,
    date: dateKey_(date),
    customer: customer,
    amount: round2_(amount),
    message: 'Due ' + verb + ': ' + customer + ' owes ' + round2_(amount) + ' BDT from ' +
      dateKey_(date) + '.' + (addedCustomer ? ' Customer saved to the dropdown.' : ''),
    panel: getDuePanel_()
  };
}

function setDuePaid_(payload) {
  var p = payload || {};
  var id = String(p.dueId || '').trim();
  if (!id) return { ok: false, errors: ['No due was selected.'] };

  var paid = p.paid === true || String(p.paid) === 'true';

  var sheet = getSheet_(SHEETS.DUES);
  var row = findFinanceRow_(sheet, id);
  if (row < 2) {
    return { ok: false, errors: ['That due no longer exists. It may already be deleted.'] };
  }

  var headers = getHeaders_(sheet);
  var statusCol = colIndex_(headers, 'Status');
  var paidDateCol = colIndex_(headers, 'Paid Date');
  if (statusCol < 0 || paidDateCol < 0) {
    return { ok: false, errors: ['The Dues sheet is missing Status / Paid Date columns.'] };
  }

  var paidDate = paid ? (toDate_(p.paidDate) || toDate_(new Date())) : '';
  sheet.getRange(row, statusCol + 1).setValue(paid ? 'Paid' : 'Outstanding');
  sheet.getRange(row, paidDateCol + 1).setValue(paidDate);

  var record = readDueRows_().filter(function (r) { return r.dueId === id; })[0];
  var label = record ? (record.customer + ' · ' + record.date + ' · ' + round2_(record.amount)) : id;

  logEvent_('DUE', paid ? 'Due marked paid' : 'Due reopened', label + ' (' + id + ')');

  return {
    ok: true,
    dueId: id,
    paid: paid,
    message: paid
      ? 'Marked paid: ' + label + '. It no longer reduces cash in hand.'
      : 'Reopened as outstanding: ' + label + '.',
    panel: getDuePanel_()
  };
}

function deleteDue_(dueId) {
  var id = String(dueId || '').trim();
  if (!id) return { ok: false, errors: ['No due was selected.'] };

  var sheet = getSheet_(SHEETS.DUES);
  var row = findFinanceRow_(sheet, id);
  if (row < 2) {
    return { ok: false, errors: ['That due no longer exists. It may already be deleted.'] };
  }

  var record = readDueRows_().filter(function (r) { return r.dueId === id; })[0];
  var label = record
    ? (record.customer + ' · ' + record.date + ' · ' + round2_(record.amount) +
       ' · ' + record.status)
    : id;

  sheet.deleteRow(row);
  logEvent_('DUE', 'Due deleted', label + ' (' + id + ')');

  return {
    ok: true,
    deleted: id,
    message: 'Deleted due: ' + label + '.',
    panel: getDuePanel_()
  };
}

// ---------------------------------------------------------------------------
// Finance totals for the sales summary
// ---------------------------------------------------------------------------

/**
 * The four figures the cash formula needs, over one range.
 *
 * Bazar is every expense row in the range (README §13.B15): a purchase reduces
 * cash when recorded, not when later marked paid.
 */
function financeTotals_(startDate, endDate) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;

  var discount = sumDiscountsInRange_(readDiscountRows_(), start, end);

  var dueRows = readDueRows_();
  var dueOutstanding = sumDuesInRange_(dueRows, start, end, true);
  var dueAccrued = sumDuesInRange_(dueRows, start, end, false);

  var bazar = 0;
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (!inDateRange_(r['Date'], start, end)) return;
    bazar += toNumber_(r['Amount']) || 0;
  });

  return {
    discount: round2_(discount),
    dueOutstanding: round2_(dueOutstanding),
    dueAccrued: round2_(dueAccrued),
    bazar: round2_(bazar)
  };
}
