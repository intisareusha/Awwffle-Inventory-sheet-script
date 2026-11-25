/**
 * Awwffle Inventory System — 15_CashInHand.gs
 *
 * Daily physical-cash snapshot, reconciled against the system's Cash in Hand.
 *
 * THE IDEA
 * The system knows one figure — Cash in Hand:
 *
 *     Cash in Hand = (Gross Sales − Discount) − outstanding Due − Bazar   (all time)
 *
 * The owner actually keeps that money in several places: notes at home, bKash,
 * bank, and the shop counter. This module records where it sits on a given day
 * and compares the physical total with the system figure:
 *
 *     Physical Holding = notes + bKash + bank + cash counter
 *     Extra            = Physical Holding − System Cash in Hand
 *
 *     Extra < 0  → the owner is short; they must fill the gap from their own pocket.
 *     Extra > 0  → the owner has put in extra.
 *
 * Only the entered figures and a snapshot of the system figure are stored; every
 * total (notes, physical, extra) is derived on read, so the sheet cannot disagree
 * with itself. One row per date: saving the same date corrects that day.
 *
 * The system figure is taken from `getDailyWaffles_` with no range, i.e. exactly
 * the number the Daily Waffles tab shows. Nothing here re-implements that formula.
 */

/** Note denominations, largest first, as used in the counts grid. */
var CASH_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5];

// ---------------------------------------------------------------------------
// Public API (called from the sidebar via google.script.run)
// ---------------------------------------------------------------------------

/** Bootstrap: the system figure and any saved record for a date. */
function getCashInHandPanel(date) {
  return getCashInHandPanel_(date);
}

/** Records or corrects one day's cash holding. */
function saveCashInHand(payload) {
  return saveCashInHand_(payload);
}

/** Deletes one cash-holding row by ID. */
function deleteCashInHand(cashId) {
  return deleteCashInHand_(cashId);
}

// ---------------------------------------------------------------------------
// Pure helpers — testable without a spreadsheet
// ---------------------------------------------------------------------------

/** Counts (array aligned to CASH_DENOMS) × denomination. */
function notesTotal_(counts) {
  var arr = counts || [];
  var total = 0;
  CASH_DENOMS.forEach(function (d, i) {
    total += (toNumber_(arr[i]) || 0) * d;
  });
  return round2_(total);
}

/** Cash notes + bKash + bank + shop counter. */
function physicalTotal_(notes, bkash, bank, counter) {
  return round2_((toNumber_(notes) || 0) + (toNumber_(bkash) || 0) +
    (toNumber_(bank) || 0) + (toNumber_(counter) || 0));
}

/** Physical holding minus the system figure. Negative = short. */
function extraOf_(physical, system) {
  return round2_((toNumber_(physical) || 0) - (toNumber_(system) || 0));
}

/** The counts object keyed by denomination → array aligned to CASH_DENOMS. */
function cashCountsArray_(countsObj) {
  return CASH_DENOMS.map(function (d) {
    return toNumber_(countsObj && countsObj[d]) || 0;
  });
}

/**
 * The most recently dated holding, or null when nothing is saved.
 *
 * Pure. Date keys are zero-padded yyyy-mm-dd, so comparing them as strings is the
 * same as comparing them as dates — no parsing and no timezone in the comparison.
 * The owner opens the form to "what I have right now", which is the latest row,
 * not necessarily yesterday's.
 */
function latestCashRow_(rows) {
  var latest = null;
  (rows || []).forEach(function (r) {
    if (!r || !r.date) return;
    if (!latest || r.date > latest.date) latest = r;
  });
  return latest;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Cash rows as plain objects. Reuses the finance reader (self-heals blank IDs). */
function readCashRows_() {
  return readFinanceRows_(SHEETS.CASH_IN_HAND, 'Cash ID', 'CASH').map(function (r) {
    var rec = {
      cashId: String(r['Cash ID'] || ''),
      date: dateKey_(r['Date']),
      bkash: toNumber_(r['Bkash']) || 0,
      bank: toNumber_(r['Bank']) || 0,
      counter: toNumber_(r['Cash Counter']) || 0,
      system: toNumber_(r['System Cash in Hand']) || 0,
      notes: String(r['Notes'] || ''),
      enteredAt: r['Entered At'] || '',
      counts: {}
    };
    CASH_DENOMS.forEach(function (d) { rec.counts[d] = toNumber_(r['Count ' + d]) || 0; });
    return rec;
  }).filter(function (r) { return r.cashId || r.date; });
}

/** The live system figures, taken from the same path Daily Waffles uses. */
function systemCashInHand_() {
  var w = getDailyWaffles_('', '', {});
  return {
    cashInHand: round2_(toNumber_(w && w.cashInHand) || 0),
    saleAfterDiscount: round2_(toNumber_(w && w.totalSaleAfterDiscount) || 0),
    due: round2_(toNumber_(w && w.totalDue) || 0),
    bazar: round2_(toNumber_(w && w.totalBazar) || 0)
  };
}

/**
 * The form's opening state.
 *
 * The date is always the one being recorded (today when none is asked for), but
 * the figures are the newest holding on or before it. So opening the form shows
 * what the owner has right now, ready to adjust; saving writes a NEW row for the
 * chosen day and leaves every earlier row untouched. Picking a past date with a
 * saved row shows that row so it can be corrected in place.
 *
 * A carried-forward record deliberately has NO cashId: it is a starting point,
 * not an existing row, and must never update the day it was copied from.
 */
function getCashInHandPanel_(date) {
  var today = dateKey_(new Date());
  var key = dateKey_(date) || today;

  var rows = readCashRows_();
  var existing = null;
  rows.forEach(function (r) {
    if (r.date === key) existing = r;   // last wins; one row per date is enforced on save
  });

  var source = existing || latestCashRow_(rows.filter(function (r) {
    return r.date && r.date <= key;
  }));

  var record = null;
  if (source) {
    record = {
      cashId: existing ? existing.cashId : '',
      date: existing ? existing.date : '',
      counts: source.counts,
      bkash: source.bkash,
      bank: source.bank,
      counter: source.counter,
      // A note describes the day it was written on, so a carried-forward record
      // starts with an empty note rather than repeating the earlier day's.
      notes: existing ? existing.notes : ''
    };
  }

  return {
    today: today,
    date: key,
    system: systemCashInHand_(),
    record: record,
    carriedFrom: source && !existing ? source.date : ''
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Sheet row whose Date column matches a key, or -1 (one row per day). */
function findCashRowByDate_(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var dates = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (dateKey_(dates[i][0]) === key) return i + 2;
  }
  return -1;
}

function saveCashInHand_(payload) {
  var p = payload || {};

  var date = toDate_(p.date);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };
  if (date > toDate_(new Date())) {
    return { ok: false, errors: ['The date cannot be in the future.'] };
  }
  var key = dateKey_(date);

  // Note counts: whole numbers, zero or more.
  var counts = {};
  for (var i = 0; i < CASH_DENOMS.length; i++) {
    var d = CASH_DENOMS[i];
    var raw = p.counts ? p.counts[String(d)] : '';
    var c = isBlank_(raw) ? 0 : toNumber_(raw);
    if (c === null || c < 0 || Math.round(c) !== c) {
      return { ok: false, errors: ['Note counts must be whole numbers, zero or more.'] };
    }
    counts[d] = c;
  }

  function numberField(name) {
    return isBlank_(p[name]) ? 0 : toNumber_(p[name]);
  }
  var bkash = numberField('bkash');
  var bank = numberField('bank');
  var counter = numberField('counter');
  if (bkash === null || bank === null || counter === null) {
    return { ok: false, errors: ['bKash, bank and counter must be numbers.'] };
  }

  var notes = String(p.notes || '').trim();
  var system = systemCashInHand_();

  var sheet = getSheet_(SHEETS.CASH_IN_HAND);
  if (!getHeaders_(sheet).length) writeHeaders_(sheet, SCHEMA[SHEETS.CASH_IN_HAND]);

  var explicitId = String(p.cashId || '').trim();
  var row = explicitId ? findFinanceRow_(sheet, explicitId) : -1;
  if (row < 2) row = findCashRowByDate_(sheet, key);

  var id;
  var verb;

  if (row >= 2) {
    var headers = getHeaders_(sheet);
    var existing = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    var enteredAtCol = colIndex_(headers, 'Entered At');

    id = String(existing[0] || '').trim() || explicitId || newId_('CASH');

    var record = {
      'Cash ID': id,
      'Date': date,
      'Bkash': round2_(bkash),
      'Bank': round2_(bank),
      'Cash Counter': round2_(counter),
      'System Cash in Hand': system.cashInHand,
      'Notes': notes,
      'Entered At': enteredAtCol >= 0 ? (existing[enteredAtCol] || new Date()) : new Date()
    };
    CASH_DENOMS.forEach(function (d) { record['Count ' + d] = counts[d]; });
    writeFinanceRow_(sheet, row, record);

    verb = 'corrected';
  } else {
    id = newId_('CASH');
    var rowValues = SCHEMA[SHEETS.CASH_IN_HAND].map(function (h) {
      if (h === 'Cash ID') return id;
      if (h === 'Date') return date;
      if (h === 'Bkash') return round2_(bkash);
      if (h === 'Bank') return round2_(bank);
      if (h === 'Cash Counter') return round2_(counter);
      if (h === 'System Cash in Hand') return system.cashInHand;
      if (h === 'Notes') return notes;
      if (h === 'Entered At') return new Date();
      if (h.indexOf('Count ') === 0) return counts[Number(h.slice(6))] || 0;
      return '';
    });
    appendRows_(SHEETS.CASH_IN_HAND, [rowValues]);

    verb = 'recorded';
  }

  var holding = physicalTotal_(notesTotal_(cashCountsArray_(counts)), bkash, bank, counter);

  logEvent_('CASH', 'Cash in hand ' + verb,
    key + ' physical ' + holding + ' vs system ' + system.cashInHand);

  return {
    ok: true,
    cashId: id,
    date: key,
    message: 'Cash in hand ' + verb + ' for ' + key + '.',
    panel: getCashInHandPanel_(key)
  };
}

function deleteCashInHand_(cashId) {
  var id = String(cashId || '').trim();
  if (!id) return { ok: false, errors: ['No cash record was selected.'] };

  var sheet = getSheet_(SHEETS.CASH_IN_HAND);
  var row = findFinanceRow_(sheet, id);
  if (row < 2) {
    return { ok: false, errors: ['That record no longer exists. It may already be deleted.'] };
  }

  sheet.deleteRow(row);
  logEvent_('CASH', 'Cash in hand deleted', id);

  return {
    ok: true,
    deleted: id,
    message: 'Deleted cash in hand record.',
    panel: getCashInHandPanel_()
  };
}
