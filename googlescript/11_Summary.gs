/**
 * Awwffle Inventory System — 11_Summary.gs
 *
 * Phase 6.5 — date-range and filtered summaries.
 *
 * README §5.4 (Bazar filters), §6.2 (Stock filters), §8.4 (open days), §11.
 *
 * DESIGN RULE: ONE SOURCE, ONE TRUTH
 * Nothing here stores a figure. Every number is recomputed from the source rows
 * each time it is asked for. If a summary ever disagreed with the underlying
 * sheet, that would be a bug — not a discrepancy to reconcile by hand (§11).
 *
 * SNAPSHOT vs RANGE
 * Batches and Bazar are ranges: they accumulate between two dates.
 * Stock is a SNAPSHOT: a position at one moment. "Stock between 1 and 15 Nov" is
 * not a meaningful question, so the stock summary takes an "as of" date. Being
 * deliberate about this stops the UI implying something it cannot compute.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Sidebar bootstrap: available ranges, groups, and item lists. */
function getSummaryOptions() {
  return getSummaryOptions_();
}

/** Batches summary for a date range, optionally narrowed to one preparation. */
function summaryBatches(startDate, endDate, preparation) {
  return summaryBatches_(startDate, endDate, preparation);
}

/** Bazar summary for a date range. */
function summaryBazar(startDate, endDate) {
  return summaryBazar_(startDate, endDate);
}

/** Stock position at a date, with filters applied. */
function summaryStock(asOf, filters) {
  return summaryStock_(asOf, filters);
}

/** Turns a preset name ('thisMonth', 'last7', …) into a concrete range. */
function resolveSummaryPreset(preset, todayStr) {
  return resolvePreset_(preset, todayStr);
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function getSummaryOptions_() {
  var posDates = readRecords_(SHEETS.POS_SNAPSHOTS).map(function (r) {
    return toDate_(r['Date']);
  }).filter(Boolean);

  var batchDates = readRecords_(SHEETS.BATCHES).map(function (r) {
    return toDate_(r['Date']);
  }).filter(Boolean);

  var bazarDates = readRecords_(SHEETS.BAZAR).map(function (r) {
    return toDate_(r['Date']);
  }).filter(Boolean);

  var all = posDates.concat(batchDates, bazarDates).sort(function (a, b) { return a - b; });

  // Shortcuts the owner is actually likely to ask for.
  var today = toDate_(new Date());
  var thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  var items = readRecords_(SHEETS.ITEM_MASTER).map(function (r) {
    return { name: String(r['Item Name']), group: String(r['Group']) };
  }).filter(function (i) { return i.name; });

  var groups = {};
  items.forEach(function (i) { groups[i.group] = true; });

  return {
    today: dateKey_(today),
    dataStart: all.length ? dateKey_(all[0]) : '',
    dataEnd: all.length ? dateKey_(all[all.length - 1]) : '',
    thisMonthStart: dateKey_(thisMonthStart),
    items: items,
    groups: Object.keys(groups).sort(),
    preparations: PREPARATIONS.slice(),
    populations: [POPULATION.RECIPE, POPULATION.MANUAL, POPULATION.RESALE],
    presets: [
      { key: 'all', label: 'All time' },
      { key: 'thisMonth', label: 'This month' },
      { key: 'lastMonth', label: 'Last month' },
      { key: 'last7', label: 'Last 7 days' },
      { key: 'last30', label: 'Last 30 days' }
    ]
  };
}

/** Resolves a preset name into a concrete start/end pair. */
function resolvePreset_(preset, todayStr) {
  var today = toDate_(todayStr) || toDate_(new Date());
  if (!today) return null;

  if (preset === 'thisMonth') {
    return {
      start: dateKey_(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: dateKey_(today)
    };
  }
  if (preset === 'lastMonth') {
    return {
      start: dateKey_(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: dateKey_(new Date(today.getFullYear(), today.getMonth(), 0))
    };
  }
  if (preset === 'last7') {
    return {
      start: dateKey_(new Date(today.getTime() - 6 * 86400000)),
      end: dateKey_(today)
    };
  }
  if (preset === 'last30') {
    return {
      start: dateKey_(new Date(today.getTime() - 29 * 86400000)),
      end: dateKey_(today)
    };
  }
  return null;   // 'all' means no bounds
}

// ---------------------------------------------------------------------------
// Batches summary
// ---------------------------------------------------------------------------

/**
 * Batch totals over a range, with a per-day breakdown.
 *
 * An optional preparation narrows the whole summary to that one recipe: only the
 * days that produced it are counted. Batches are never alike, so a single grand
 * total says nothing useful — the per-recipe figures are the real answer.
 *
 * The per-day table is the maintenance tool: it is how an odd entry (12 Batter on
 * one day) gets noticed. Totals alone would hide it.
 */
function summaryBatches_(startDate, endDate, preparation) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);
  var wanted = String(preparation || '');
  var filter = PREPARATIONS.indexOf(wanted) !== -1 ? wanted : '';

  var totals = {};
  PREPARATIONS.forEach(function (p) { totals[p] = 0; });

  var perDay = [];
  var recordCount = 0;
  var first = null;
  var last = null;

  readRecords_(SHEETS.BATCHES).forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    var values = {};
    PREPARATIONS.forEach(function (p) {
      var n = toNumber_(r[p]);
      values[p] = n === null ? 0 : n;
    });

    // A day with no batch of the chosen preparation is not part of that recipe's
    // story, so it must not pad the record count or the averages.
    if (filter && !values[filter]) return;

    recordCount++;
    if (!first || d < first) first = d;
    if (!last || d > last) last = d;

    PREPARATIONS.forEach(function (p) { totals[p] += values[p]; });

    perDay.push({
      date: dateKey_(d),
      weekday: WEEKDAY_NAMES_[d.getDay()],
      values: values
    });
  });

  perDay.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  // Open days come from the dated closure list, never a weekday rule (§8.4).
  // The requested range is the denominator: "average per open day between these
  // dates" must not shrink just because the last few days had no entry.
  var spanStart = start || first;
  var spanEnd = end || last;
  var breakdown = spanStart && spanEnd ? openDayBreakdown_(spanStart, spanEnd) : null;
  var openDays = breakdown ? breakdown.openDays : 0;

  var avgByPreparation = {};
  PREPARATIONS.forEach(function (p) {
    avgByPreparation[p] = openDays > 0 ? round2_(totals[p] / openDays) : '';
  });

  return {
    range: { start: start ? dateKey_(start) : '', end: end ? dateKey_(end) : '' },
    preparation: filter,
    totals: totals,
    avgByPreparation: avgByPreparation,
    recordCount: recordCount,
    firstDate: first ? dateKey_(first) : '',
    lastDate: last ? dateKey_(last) : '',
    openDays: openDays,
    calendarDays: breakdown ? breakdown.calendarDays : 0,
    closedDays: breakdown ? breakdown.closedDays : 0,
    perDay: perDay
  };
}

var WEEKDAY_NAMES_ = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Bazar summary
// ---------------------------------------------------------------------------

/**
 * Spending over a range: by expense type, by item, by month, and by invoice.
 *
 * Quantity is reported alongside money but never summed across items — grams and
 * pieces cannot be added. Only the money column totals meaningfully.
 */
function summaryBazar_(startDate, endDate) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var total = 0;
  var count = 0;
  var byType = {};
  var byItem = {};
  var byMonth = {};
  var byStatus = {};
  var invoiceMap = {};

  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    var amount = toNumber_(r['Amount']) || 0;
    var type = String(r['Expense Type'] || '');
    var name = String(r['Item'] || r['Expense Name'] || '');
    var unit = String(r['Unit'] || '');
    var qty = toNumber_(r['Quantity']);
    var status = String(r['Status'] || 'Paid');
    var ref = String(r['Ref'] || '').trim();
    var month = dateKey_(d).substring(0, 7);

    total += amount;
    count++;

    byType[type] = (byType[type] || 0) + amount;
    byStatus[status] = (byStatus[status] || 0) + amount;
    byMonth[month] = (byMonth[month] || 0) + amount;

    if (!byItem[name]) {
      byItem[name] = { item: name, amount: 0, lines: 0, units: {}, type: type };
    }
    byItem[name].amount += amount;
    byItem[name].lines++;
    if (unit && qty !== null) {
      byItem[name].units[unit] = (byItem[name].units[unit] || 0) + qty;
    }

    if (ref) {
      if (!invoiceMap[ref]) invoiceMap[ref] = { ref: ref, date: dateKey_(d), lines: 0, total: 0 };
      invoiceMap[ref].lines++;
      invoiceMap[ref].total += amount;
    }
  });

  var items = Object.keys(byItem).map(function (k) {
    var x = byItem[k];
    // A readable quantity: units are kept separate so font sizes never imply a sum.
    var unitParts = Object.keys(x.units).map(function (u) {
      return round2_(x.units[u]) + ' ' + u;
    });
    return {
      item: x.item,
      type: x.type,
      amount: round2_(x.amount),
      lines: x.lines,
      quantityText: unitParts.join(', ')
    };
  }).sort(function (a, b) { return b.amount - a.amount; });

  var invoices = Object.keys(invoiceMap).map(function (k) {
    var x = invoiceMap[k];
    return { ref: x.ref, date: x.date, lines: x.lines, total: round2_(x.total) };
  }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  var breakdown = start && end ? openDayBreakdown_(start, end) : null;

  return {
    range: { start: start ? dateKey_(start) : '', end: end ? dateKey_(end) : '' },
    total: round2_(total),
    count: count,
    byType: byType,
    byStatus: byStatus,
    byMonth: byMonth,
    items: items,
    invoices: invoices,
    openDays: breakdown ? breakdown.openDays : 0,
    calendarDays: breakdown ? breakdown.calendarDays : 0,
    avgPerOpenDay: (breakdown && breakdown.openDays > 0)
      ? round2_(total / breakdown.openDays) : ''
  };
}

// ---------------------------------------------------------------------------
// Stock summary
// ---------------------------------------------------------------------------

/**
 * Stock at a date, filtered.
 *
 * Filters: group, population, item name, lowStockOnly, negativeOnly.
 *
 * Totals are money only. Summing quantity across items would add grams to pieces,
 * which is meaningless — so the quantity total is reported per unit instead.
 */
function summaryStock_(asOf, filters) {
  var f = filters || {};
  var computed = computeStock_(asOf);

  var rows = computed.rows.filter(function (r) {
    if (f.group && r.group !== f.group) return false;
    if (f.population && r.population !== f.population) return false;
    if (f.item && r.item !== f.item) return false;
    if (f.lowStockOnly && !r.lowStock) return false;
    if (f.negativeOnly && !(r.remainingQty < 0)) return false;
    return true;
  });

  var totals = {
    usedCost: 0,
    remainingValue: 0,
    totalCost: 0,
    openingValue: 0,
    purchaseValue: 0
  };

  // Quantity is grouped by unit so nothing is summed across incompatible units.
  var quantityByUnit = {};
  var lowCount = 0;
  var negativeCount = 0;

  rows.forEach(function (r) {
    totals.usedCost += r.usedCost || 0;
    totals.remainingValue += r.remainingValue || 0;
    totals.totalCost += r.totalCost || 0;
    totals.openingValue += r.openingValue || 0;
    totals.purchaseValue += r.purchaseValue || 0;

    var u = r.baseUnit || '';
    if (!quantityByUnit[u]) quantityByUnit[u] = { unit: u, remaining: 0, used: 0, total: 0 };
    quantityByUnit[u].remaining += r.remainingQty || 0;
    quantityByUnit[u].used += r.totalUsed || 0;
    quantityByUnit[u].total += r.totalAvailable || 0;

    if (r.remainingQty < 0) negativeCount++;
    else if (r.lowStock) lowCount++;
  });

  Object.keys(quantityByUnit).forEach(function (u) {
    var x = quantityByUnit[u];
    x.remaining = round2_(x.remaining);
    x.used = round2_(x.used);
    x.total = round2_(x.total);
  });

  return {
    asOf: computed.asOf || dateKey_(new Date()),
    rowCount: rows.length,
    totalItemCount: computed.rows.length,
    rows: rows.map(function (r) {
      return {
        item: r.item,
        group: r.group,
        population: r.population,
        baseUnit: r.baseUnit,
        totalQty: round2_(r.totalAvailable),
        avgRate: r.avgRate,
        totalUsed: round2_(r.totalUsed),
        usedCost: r.usedCost,
        remainingQty: round2_(r.remainingQty),
        remainingValue: r.remainingValue,
        totalCost: r.totalCost,
        estDays: r.estDays,
        estBatches: r.estBatches,
        flags: r.flags.join(', ')
      };
    }),
    totals: {
      usedCost: round2_(totals.usedCost),
      remainingValue: round2_(totals.remainingValue),
      totalCost: round2_(totals.totalCost),
      openingValue: round2_(totals.openingValue),
      purchaseValue: round2_(totals.purchaseValue)
    },
    quantityByUnit: Object.keys(quantityByUnit).map(function (u) { return quantityByUnit[u]; }),
    lowCount: lowCount,
    negativeCount: negativeCount,
    batchOpenDays: computed.openDays
  };
}
