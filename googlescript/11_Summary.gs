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

/** Bazar summary for a date range, with optional item / type / invoice filters. */
function summaryBazar(startDate, endDate, filters) {
  return summaryBazar_(startDate, endDate, filters);
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

  // Read Bazar once: it supplies the date extent and all three filter lists.
  var bazarRows = readRecords_(SHEETS.BAZAR);
  var bazarDates = bazarRows.map(function (r) {
    return toDate_(r['Date']);
  }).filter(Boolean);

  var bazarTypes = {};
  var bazarItems = {};
  var invoices = {};

  bazarRows.forEach(function (r) {
    var type = String(r['Expense Type'] || '');
    var name = String(r['Item'] || r['Expense Name'] || '');
    var ref = String(r['Ref'] || '').trim();

    if (type) bazarTypes[type] = true;
    if (name) bazarItems[type + '|' + name] = { name: name, type: type };

    if (!ref) return;
    if (!invoices[ref]) {
      invoices[ref] = { ref: ref, date: dateKey_(r['Date']), lines: 0, total: 0 };
    }
    invoices[ref].lines++;
    invoices[ref].total += toNumber_(r['Amount']) || 0;
  });

  var all = posDates.concat(batchDates, bazarDates).sort(function (a, b) { return a - b; });

  // Shortcuts the owner is actually likely to ask for.
  var today = toDate_(new Date());
  var thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  var items = readRecords_(SHEETS.ITEM_MASTER).map(function (r) {
    return { name: String(r['Item Name']), group: String(r['Group']) };
  }).filter(function (i) { return i.name; });

  var groups = {};
  items.forEach(function (i) { groups[i.group] = true; });

  var bazarItemList = Object.keys(bazarItems).map(function (k) { return bazarItems[k]; })
    .sort(function (a, b) {
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });

  var bazarInvoiceList = Object.keys(invoices).map(function (k) { return invoices[k]; })
    .sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;   // newest first
      return a.ref < b.ref ? -1 : 1;
    });

  return {
    today: dateKey_(today),
    dataStart: all.length ? dateKey_(all[0]) : '',
    dataEnd: all.length ? dateKey_(all[all.length - 1]) : '',
    thisMonthStart: dateKey_(thisMonthStart),
    items: items,
    groups: Object.keys(groups).sort(),
    preparations: PREPARATIONS.slice(),
    populations: [POPULATION.RECIPE, POPULATION.MANUAL, POPULATION.RESALE],
    bazarTypes: Object.keys(bazarTypes).sort(),
    bazarItems: bazarItemList,
    bazarInvoices: bazarInvoiceList,
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
// Batch cost model
// ---------------------------------------------------------------------------
//
// A batch costs the ingredients it consumes, valued at their weighted-average
// cost per base unit — the same figure the Stock view uses. No stored price, no
// hard-coded rate: if a purchase price moves, the next summary reflects it.
//
// COST BASIS FOR A RANGE
// The average price is taken as of the range end, using opening stock plus every
// purchase up to that date. A range that ends before a price rise is therefore
// costed at the prices that were actually in force, which is what makes the
// Cost comparison table meaningful.

/**
 * Pure cost maths: cost of one batch of each preparation.
 *
 * `matrix`  ingredient -> { Batter: 500, ... } in base units per batch
 * `avgCost` ingredient -> money per base unit
 *
 * Returns { perBatch: { Batter: 1234.5, ... }, unpriced: [ingredient, ...] }.
 * Unpriced ingredients have no purchase history yet, so their cost is 0 — they
 * are reported so the UI can say the figure excludes them instead of pretending.
 */
function batchCostPerPreparationFrom_(matrix, avgCost) {
  var perBatch = {};
  PREPARATIONS.forEach(function (p) { perBatch[p] = 0; });

  var unpriced = [];

  Object.keys(matrix).forEach(function (ingredient) {
    var row = matrix[ingredient] || {};
    var used = PREPARATIONS.some(function (p) { return !isBlank_(row[p]); });
    if (!used) return;

    var avg = Number(avgCost[ingredient] || 0);
    if (!(avg > 0)) unpriced.push(ingredient);

    PREPARATIONS.forEach(function (p) {
      if (isBlank_(row[p])) return;
      perBatch[p] += Number(row[p]) * avg;
    });
  });

  return { perBatch: perBatch, unpriced: unpriced };
}

/** Builds the live cost model, optionally at a historical date. */
function batchCostModel_(bazarRows, openingRows, cutOff, asOfDate) {
  var limit = asOfDate ? toDate_(asOfDate) : null;
  var rows = limit ? bazarRows.filter(function (r) {
    var d = toDate_(r['Date']);
    return d && d <= limit;
  }) : bazarRows;

  var matrix = readMeasurementMatrix_();
  var avgCost = {};

  Object.keys(matrix).forEach(function (ingredient) {
    avgCost[ingredient] = itemCosting_(ingredient, {
      openingRows: openingRows,
      bazarRows: rows,
      cutOff: cutOff
    }).avg;
  });

  return batchCostPerPreparationFrom_(matrix, avgCost);
}

/** Totals per preparation from already-read batch rows, for one range. */
function batchTotalsFromRows_(rows, startDate, endDate) {
  var start = startDate ? toDate_(startDate) : null;
  var end = endDate ? toDate_(endDate) : null;

  var totals = {};
  PREPARATIONS.forEach(function (p) { totals[p] = 0; });
  var records = 0;

  rows.forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    records++;
    PREPARATIONS.forEach(function (p) {
      var n = toNumber_(r[p]);
      if (n !== null) totals[p] += n;
    });
  });

  return { totals: totals, records: records };
}

/**
 * Average batch cost per preset range, compared with All time.
 *
 * This is the trend view: "is what I make getting more expensive?" Each range is
 * costed at the prices in force at its own end, so a purchase-price rise shows up
 * in the periods after it rather than retroactively rewriting every past figure.
 */
function summaryCostComparison_(selectedStart, selectedEnd, preparation) {
  var wanted = String(preparation || '');
  var filter = PREPARATIONS.indexOf(wanted) !== -1 ? wanted : '';

  var batchRows = readRecords_(SHEETS.BATCHES);
  var bazarRows = readRecords_(SHEETS.BAZAR);
  var openingRows = readRecords_(SHEETS.OPENING_STOCK);
  var cutOff = openingCutOff_();

  var dates = batchRows.map(function (r) { return toDate_(r['Date']); })
    .filter(Boolean).sort(function (a, b) { return a - b; });

  var dataStart = dates.length ? dateKey_(dates[0]) : '';
  var dataEnd = dates.length ? dateKey_(dates[dates.length - 1]) : '';
  var today = dateKey_(new Date());

  function rangeOf(preset) {
    return resolvePreset_(preset, today) || { start: dataStart, end: dataEnd };
  }

  var definitions = [
    { key: 'selected', label: 'Date range', range: {
      start: selectedStart || dataStart, end: selectedEnd || dataEnd } },
    { key: 'last7', label: 'Last 7 days', range: rangeOf('last7') },
    { key: 'last30', label: 'Last 30 days', range: rangeOf('last30') },
    { key: 'thisMonth', label: 'This month', range: rangeOf('thisMonth') },
    { key: 'lastMonth', label: 'Last month', range: rangeOf('lastMonth') },
    { key: 'all', label: 'All time', range: { start: dataStart, end: dataEnd } }
  ];

  var rows = definitions.map(function (def) {
    var stats = batchTotalsFromRows_(batchRows, def.range.start, def.range.end);
    var breakdown = (def.range.start && def.range.end)
      ? openDayBreakdown_(def.range.start, def.range.end) : null;
    var openDays = breakdown ? breakdown.openDays : 0;

    var batches = 0;
    PREPARATIONS.forEach(function (p) {
      if (filter && p !== filter) return;
      batches += stats.totals[p];
    });

    // An empty range has nothing to price, and building the model would only
    // produce a zero that reads like a real figure. Cost per open day is left
    // blank too: no batches means no production cost, not a cheap day.
    if (!batches) {
      return {
        key: def.key,
        label: def.label,
        start: def.range.start || '',
        end: def.range.end || '',
        batches: 0,
        cost: 0,
        avgCost: '',
        openDays: openDays,
        costPerOpenDay: ''
      };
    }

    var model = batchCostModel_(bazarRows, openingRows, cutOff, def.range.end);

    var cost = 0;
    PREPARATIONS.forEach(function (p) {
      if (filter && p !== filter) return;
      cost += stats.totals[p] * model.perBatch[p];
    });

    return {
      key: def.key,
      label: def.label,
      start: def.range.start || '',
      end: def.range.end || '',
      batches: round2_(batches),
      cost: round2_(cost),
      avgCost: round2_(cost / batches),
      openDays: openDays,
      costPerOpenDay: openDays > 0 ? round2_(cost / openDays) : ''
    };
  });

  // Every row is judged against the all-time figure, which is the stable
  // baseline; comparing adjacent rows would make the arrows jump for no reason.
  var baseline = rows[rows.length - 1];
  rows.forEach(function (r) {
    if (r.key === 'all') return;

    if (r.avgCost !== '' && baseline.avgCost !== '') {
      r.deltaPct = round2_(((r.avgCost - baseline.avgCost) / baseline.avgCost) * 100);
    }
    if (r.costPerOpenDay !== '' && baseline.costPerOpenDay !== '') {
      r.deltaCostPerOpenDayPct = round2_(
        ((r.costPerOpenDay - baseline.costPerOpenDay) / baseline.costPerOpenDay) * 100);
    }
  });

  return { preparation: filter, rows: rows };
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

  // Ingredient cost of what was made. Valued at the prices in force at the end of
  // the range, so an old range is not restated at today's prices.
  var model = batchCostModel_(
    readRecords_(SHEETS.BAZAR),
    readRecords_(SHEETS.OPENING_STOCK),
    openingCutOff_(),
    end || last
  );

  var costByPreparation = {};
  var costPerOpenDay = {};
  PREPARATIONS.forEach(function (p) {
    costByPreparation[p] = round2_(totals[p] * model.perBatch[p]);
    costPerOpenDay[p] = openDays > 0
      ? round2_(costByPreparation[p] / openDays) : '';
  });

  return {
    range: { start: start ? dateKey_(start) : '', end: end ? dateKey_(end) : '' },
    preparation: filter,
    totals: totals,
    avgByPreparation: avgByPreparation,
    costPerBatch: model.perBatch,
    costByPreparation: costByPreparation,
    costPerOpenDay: costPerOpenDay,
    unpricedIngredients: model.unpriced,
    costComparison: summaryCostComparison_(startDate, endDate, filter),
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
 * Optional filters narrow the whole view the same way the batch preparation
 * filter does: type, item name, or invoice ref. They combine (AND), and every
 * figure — totals, tables, averages, invoice count — follows the filtered set.
 *
 * Quantity is reported alongside money but never summed across items — grams and
 * pieces cannot be added. Only the money column totals meaningfully.
 */
function summaryBazar_(startDate, endDate, filters) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var f = filters || {};
  var wantType = String(f.type || '');
  var wantItem = String(f.item || '');
  var wantInvoice = String(f.invoice || '');

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

    if (wantType && type !== wantType) return;
    if (wantItem && name !== wantItem) return;
    if (wantInvoice && ref !== wantInvoice) return;

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
    filters: { type: wantType, item: wantItem, invoice: wantInvoice },
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
