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

/**
 * Stock position at a date, with filters applied.
 */
function summaryStock(asOf, filters) {
  return summaryStock_(asOf, filters);
}

/**
 * Food cost for a range: the real cost of a waffle, built from four sources.
 *
 * README §13.D30/§13.D31 and the owner's decided rules (see topping-packaging-group.md):
 *   - recipe cost is EXACT (Measurements x Batches, already in summaryBatches_);
 *   - topping cost is an ESTIMATE, only valid between two physical counts;
 *   - packaging is shown twice — a standard per-waffle rule and the actual usage;
 *   - equipment and tissue are period expenses, never per waffle.
 */
function summaryFoodCost(startDate, endDate) {
  return summaryFoodCost_(startDate, endDate);
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

  // Groups in the catalogue's own order (README §4.4), not alphabetically — an
  // alphabetical list would read Equipments, Packaging, Recipes, Resale, Toppings.
  // Any group present in the sheet but unknown to the catalogue is appended, so a
  // stray value is visible rather than dropped from the filter.
  var groups = {};
  items.forEach(function (i) { if (i.group) groups[i.group] = true; });
  var groupList = GROUPS.filter(function (g) { return groups[g]; });
  Object.keys(groups).forEach(function (g) {
    if (groupList.indexOf(g) === -1) groupList.push(g);
  });

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
    groups: groupList,
    preparations: PREPARATIONS.slice(),
    populations: [POPULATION.RECIPE, POPULATION.MANUAL, POPULATION.RESALE],
    bazarTypes: Object.keys(bazarTypes).sort(),
    bazarItems: bazarItemList,
    bazarInvoices: bazarInvoiceList,
    bazarStatuses: BAZAR_STATUSES.slice(),
    presets: [
      { key: 'all', label: 'All time' },
      { key: 'thisMonth', label: 'This month' },
      { key: 'lastMonth', label: 'Last month' },
      { key: 'today', label: 'Today' },
      { key: 'yesterday', label: 'Yesterday' },
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
  if (preset === 'today') {
    return { start: dateKey_(today), end: dateKey_(today) };
  }
  if (preset === 'yesterday') {
    var y = dateKey_(new Date(today.getTime() - 86400000));
    return { start: y, end: y };
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

  // Index the (date-limited) purchase rows once, then each ingredient only visits
  // its own rows. Previously every ingredient scanned every purchase row.
  var openingIndex = indexByItem_(openingRows, 'Item');
  var bazarIndex = indexByItem_(rows, 'Item');

  Object.keys(matrix).forEach(function (ingredient) {
    avgCost[ingredient] = itemCosting_(ingredient, {
      openingRows: openingRows,
      bazarRows: rows,
      openingIndex: openingIndex,
      bazarIndex: bazarIndex,
      cutOff: cutOff
    }).avg;
  });

  return batchCostPerPreparationFrom_(matrix, avgCost);
}

/**
 * A cost-model getter that builds each end date at most once.
 *
 * The batches summary and its cost comparison ask for the same end dates over and
 * over: Last 7, Last 30 and This month all end today, All time ends on the last
 * batch date, and the selected range often lands on one of those too. Rebuilding
 * the model for each was pure duplication — same rows, same arithmetic. Memoising
 * by date key keeps the numbers identical while doing one build per distinct end.
 */
function makeBatchModelGetter_(bazarRows, openingRows, cutOff) {
  var cache = {};
  return function (end) {
    var k = end ? dateKey_(end) : '';
    if (!cache[k]) cache[k] = batchCostModel_(bazarRows, openingRows, cutOff, end);
    return cache[k];
  };
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
function summaryCostComparison_(selectedStart, selectedEnd, preparation, sources) {
  var wanted = String(preparation || '');
  var filter = PREPARATIONS.indexOf(wanted) !== -1 ? wanted : '';

  // Accept rows already read by the caller. Reading them again here was pure
  // duplication: same data, same call, same storage quota.
  var src = sources || {};
  var batchRows = src.batchRows || readRecords_(SHEETS.BATCHES);
  var bazarRows = src.bazarRows || readRecords_(SHEETS.BAZAR);
  var openingRows = src.openingRows || readRecords_(SHEETS.OPENING_STOCK);
  var cutOff = src.cutOff || openingCutOff_();

  // Reuse the caller's memoised cost model when it has one; build one otherwise.
  var getModel = src.modelGetter || makeBatchModelGetter_(bazarRows, openingRows, cutOff);

  // One closure read for every row below, not one per row.
  var closedSet = src.closedSet || closedDaySet_();

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
      ? openDayBreakdown_(def.range.start, def.range.end, closedSet) : null;
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

    var model = getModel(def.range.end);

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

  // Every source this summary needs is read ONCE. The cost comparison below used
  // to re-read Batches, Bazar and OpeningStock itself, and each of its six rows
  // re-read the closure list — which is what pushed the call into
  // DEADLINE_EXCEEDED. Reading up front and passing the rows down removes the
  // repeats without changing a single number.
  var batchRows = readRecords_(SHEETS.BATCHES);
  var bazarRows = readRecords_(SHEETS.BAZAR);
  var openingRows = readRecords_(SHEETS.OPENING_STOCK);
  var cutOff = openingCutOff_();
  var closedSet = closedDaySet_();
  var getModel = makeBatchModelGetter_(bazarRows, openingRows, cutOff);

  var totals = {};
  PREPARATIONS.forEach(function (p) { totals[p] = 0; });

  var perDay = [];
  var recordCount = 0;
  var first = null;
  var last = null;

  batchRows.forEach(function (r) {
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
  var breakdown = spanStart && spanEnd
    ? openDayBreakdown_(spanStart, spanEnd, closedSet) : null;
  var openDays = breakdown ? breakdown.openDays : 0;

  var avgByPreparation = {};
  PREPARATIONS.forEach(function (p) {
    avgByPreparation[p] = openDays > 0 ? round2_(totals[p] / openDays) : '';
  });

  // Ingredient cost of what was made. Valued at the prices in force at the end of
  // the range, so an old range is not restated at today's prices.
  var model = getModel(end || last);

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
    costComparison: summaryCostComparison_(startDate, endDate, filter, {
      batchRows: batchRows,
      bazarRows: bazarRows,
      openingRows: openingRows,
      cutOff: cutOff,
      closedSet: closedSet,
      modelGetter: getModel
    }),
    recordCount: recordCount,
    firstDate: first ? dateKey_(first) : '',
    lastDate: last ? dateKey_(last) : '',
    openDays: openDays,
    calendarDays: breakdown ? breakdown.calendarDays : 0,
    closedDays: breakdown ? breakdown.closedDays : 0,
    perDay: perDay
  };
}

// ---------------------------------------------------------------------------
// Bazar summary
// ---------------------------------------------------------------------------

/**
 * Rate stats for ONE item: average paid per unit, and the rate on the last buy.
 *
 * Kept as a pure function because this is the arithmetic most likely to be wrong
 * by a factor of 1,000: spend is money over BASE quantity (gm / ml / p), while
 * the owner reads rates per kg / litre / piece. Returns null when the item is
 * unknown or no quantity was ever recorded, so the UI shows nothing rather than
 * a zero that reads like a real rate.
 */
function bazarRateStats_(itemName, amount, baseQty, lastRate, lastDate, lines) {
  var item = findItem_(itemName);
  if (!item) return null;

  var qty = toNumber_(baseQty);
  var spent = toNumber_(amount) || 0;

  // Quantity in the unit the owner buys in (kg / l / pieces), plus the base-unit
  // total (gm / ml / pieces). The base figure is only worth a second tile when it
  // differs from the display unit — "how many pieces AND how many grams" for
  // Nutella, "how many kg AND total grams" for Flour, but just "pieces" for Egg.
  // baseMultiplier_ maps display -> base, so dividing goes back the other way.
  var factor = baseMultiplier_(item.unit, item.perPieceWeight);
  var displayQty = (qty === null || !factor) ? '' : round2_(qty / factor);

  return {
    item: itemName,
    avgRate: qty > 0 ? round2_(entryRateFromPerBase_(item, spent / qty)) : '',
    lastRate: lastRate === null || lastRate === undefined ? '' : round2_(lastRate),
    lastDate: lastDate || '',
    purchaseCount: Number(lines) || 0,
    rateUnit: item.unit,
    quantity: {
      value: displayQty,
      unit: item.unit,
      baseValue: qty === null ? '' : round2_(qty),
      baseUnit: item.baseUnit,
      showBase: item.unit !== item.baseUnit
    }
  };
}

/**
 * Spending over a range: by expense type, by item, by purchase line, and by invoice.
 *
 * Optional filters narrow the whole view the same way the batch preparation
 * filter does: type, item name, invoice ref, payment status. They combine (AND),
 * and every figure — totals, tables, rate stats, invoice count — follows the
 * filtered set.
 *
 * Quantity is reported alongside money but never summed across items — grams and
 * pieces cannot be added. Only the money column totals meaningfully.
 *
 * RATE STATS ONLY MAKE SENSE FOR ONE ITEM
 * An average rate or a "last purchase rate" across flour and napkins is a number
 * about nothing. So `itemStats` is populated only when the filtered set is a
 * single item, and the UI shows those tiles only then.
 */
function summaryBazar_(startDate, endDate, filters) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var f = filters || {};
  var wantType = String(f.type || '');
  var wantItem = String(f.item || '');
  var wantInvoice = String(f.invoice || '');
  var wantStatus = String(f.status || '');

  var total = 0;
  var count = 0;
  var byType = {};
  var byItem = {};
  var byMonth = {};
  var byStatus = {};
  var invoiceMap = {};
  var purchases = [];

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
    var rate = toNumber_(r['Rate']);
    var status = String(r['Status'] || 'Paid');
    var ref = String(r['Ref'] || '').trim();
    var month = dateKey_(d).substring(0, 7);

    if (wantType && type !== wantType) return;
    if (wantItem && name !== wantItem) return;
    if (wantInvoice && ref !== wantInvoice) return;
    if (wantStatus && status !== wantStatus) return;

    total += amount;
    count++;

    byType[type] = (byType[type] || 0) + amount;
    byStatus[status] = (byStatus[status] || 0) + amount;
    byMonth[month] = (byMonth[month] || 0) + amount;

    var baseQty = toNumber_(r['Base Quantity']);
    if (baseQty === null && qty !== null && UNIT_RULES[unit]) {
      // Older rows may predate Base Quantity; convert using the item's own
      // per-piece weight so a jar is not counted as one gram.
      var itemForQty = findItem_(name);
      baseQty = toBaseQuantity_(qty, unit, itemForQty ? itemForQty.perPieceWeight : null);
    }

    if (!byItem[name]) {
      byItem[name] = {
        item: name, amount: 0, lines: 0, units: {}, type: type,
        baseQty: 0, lastStamp: '', lastDate: '', lastRate: null
      };
    }
    var bucket = byItem[name];
    bucket.amount += amount;
    bucket.lines++;
    if (baseQty !== null) bucket.baseQty += baseQty;
    if (unit && qty !== null) {
      bucket.units[unit] = (bucket.units[unit] || 0) + qty;
    }

    // "Last purchase rate" is the rate on the newest purchase line, which is what
    // tells the owner whether the next buy will cost more. Rows are ordered by
    // date, then by Entered At, so same-day entries keep entry order. Entered At
    // can come back as a real Date, so it is compared as a timestamp, not text.
    var enteredAt = r['Entered At'];
    var enteredMs = enteredAt instanceof Date ? enteredAt.getTime()
      : (enteredAt ? Date.parse(String(enteredAt)) : NaN);
    if (isNaN(enteredMs)) enteredMs = 0;
    var stamp = d.getTime() + enteredMs;
    if (bucket.lastRate === null || stamp >= bucket.lastStamp) {
      bucket.lastStamp = stamp;
      bucket.lastDate = dateKey_(d);
      bucket.lastRate = rate;
    }

    if (ref) {
      if (!invoiceMap[ref]) invoiceMap[ref] = { ref: ref, date: dateKey_(d), lines: 0, total: 0 };
      invoiceMap[ref].lines++;
      invoiceMap[ref].total += amount;
    }

    purchases.push({
      date: dateKey_(d),
      ref: ref,
      item: name,
      type: type,
      quantity: qty,
      unit: unit,
      rate: rate,
      amount: round2_(amount),
      status: status
    });
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

  purchases.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;   // newest first
    return a.item < b.item ? -1 : 1;
  });

  // Rate stats, only when one item is in view. The average is money spent divided
  // by base quantity, then read back in the unit the owner buys in (per kg / l /
  // piece), so it is comparable with the rate on a purchase row.
  var itemStats = null;
  if (wantItem) {
    var x = byItem[wantItem];
    if (x) {
      itemStats = bazarRateStats_(
        wantItem, x.amount, x.baseQty, x.lastRate, x.lastDate, x.lines);
    }
  }

  return {
    range: { start: start ? dateKey_(start) : '', end: end ? dateKey_(end) : '' },
    filters: { type: wantType, item: wantItem, invoice: wantInvoice, status: wantStatus },
    total: round2_(total),
    count: count,
    itemCount: items.length,
    byType: byType,
    byStatus: byStatus,
    byMonth: byMonth,
    items: items,
    purchases: purchases,
    invoices: invoices,
    itemStats: itemStats
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
      var item = findItem_(r.item);
      // Quantity in the buying unit too (pieces for Nutella/Whip Cream, kg for
      // Flour). The UI shows it by itself only for piece-items held in grams,
      // which is the "pieces AND grams" case.
      var factor = item ? baseMultiplier_(item.unit, item.perPieceWeight) : 1;
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
        flags: r.flags.join(', '),

        // Display-unit figures and state for the tiles.
        displayUnit: item ? item.unit : r.baseUnit,
        pieceBase: !!(item && item.unit === 'p' && item.baseUnit !== 'p'),
        usedDisplay: factor ? round2_(r.totalUsed / factor) : '',
        remainingDisplay: factor ? round2_(r.remainingQty / factor) : '',
        lowStock: !!r.lowStock,
        negative: r.remainingQty < 0
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

// ---------------------------------------------------------------------------
// Food cost — the real cost of a waffle
// ---------------------------------------------------------------------------
//
// WHAT IS EXACT AND WHAT IS NOT
// This view mixes figures of very different confidence, so every line carries its
// nature and the UI prints it. Presenting an estimate as if it were exact is worse
// than showing nothing:
//
//   recipe    exact    Measurements x Batches, valued at weighted-average cost
//   sold      exact    POS Units Sold for Kind = waffle
//   produced  exact    Batter batches x waffles-per-batch
//   standard  rule     per-waffle packaging rules x average cost
//   actual    estimate Packaging stock used between two physical counts
//   toppings  estimate Toppings stock used between two physical counts
//   equipment period   operating supplies, never divided per waffle
//   tissue    period   excluded from both packaging figures by owner decision
//
// WHY COUNT-TO-COUNT
// A manual count is a SET-TO statement, not a usage delta (13_Adjustments.gs). Usage
// is only recognised when a LATER count exists, so a range that does not end on a
// count shows purchases but not consumption. Rather than print that low number as
// if it were usage, the view reports "not measured".

/**
 * The packaging rules, per waffle, as decided by the owner.
 *
 * Bento is 0.5 because one box has two sides and each side serves one waffle: two
 * waffles use one box, one waffle uses one box and wastes a side. The wasted half is
 * real cost, so 0.5 is exact rather than an average — do not "correct" it down.
 *
 * Tissue is deliberately absent: it has no per-waffle rule, so it cannot sit in a
 * standard pack. It is reported as a period expense instead (see §6.4 of the plan).
 */
var PACKAGING_RULES = {
  walkIn: {
    'Waffle Sticks Large': 1,
    'Bento Box': 0.5,
    'Poly bag': { quantity: 5, unit: 'gm' }
  },
  delivery: {
    'Waffle Sticks Large': 1,
    'Waffle Box': 1,
    'Waffle Tray': 1,
    'Poly bag': { quantity: 5, unit: 'gm' }
  }
};

/** Cost of one packaging item at a quantity, handling gram-based items (Poly bag). */
function packagingLineCost_(itemName, rule, avgCostByItem, itemByMatch) {
  var item = findItem_(itemName);
  if (!item) return 0;

  var avgPerBase = Number(avgCostByItem[normaliseItemName_(itemName)] || 0);
  if (!(avgPerBase > 0)) return 0;

  // A piece rule is a straight count. A {quantity, unit} rule converts to the base
  // unit first, which is why Poly bag (held in kg, used in grams) works.
  if (typeof rule === 'number') {
    var perBase = baseMultiplier_(item.unit, item.perPieceWeight);
    return rule * perBase * avgPerBase;
  }

  var baseQty = toBaseQuantity_(rule.quantity, rule.unit, item.perPieceWeight);
  return (baseQty === null ? 0 : baseQty) * avgPerBase;
}

/**
 * Standard packaging cost for one waffle of each channel, priced from live costs.
 *
 * Pure: takes the average cost per item and returns money per waffle.
 */
function standardPackCost_(avgCostByItem) {
  function channel(rules) {
    var total = 0;
    Object.keys(rules).forEach(function (name) {
      total += packagingLineCost_(name, rules[name], avgCostByItem);
    });
    return round2_(total);
  }
  return { walkIn: channel(PACKAGING_RULES.walkIn), delivery: channel(PACKAGING_RULES.delivery) };
}

/**
 * Blends the two channel costs by how much of the period was delivery.
 *
 * The delivery share is BACK-SOLVED from how many Waffle Boxes were used, because
 * the POS cannot tell a walk-in from a delivery order. Clamped to 0..1: a share
 * outside that range means the box count and the sales count disagree, which is a
 * data problem the caller should surface rather than hide behind a clamped number.
 */
function blendPackCost_(walkInCost, deliveryCost, deliveryShare) {
  // An absent share must stay absent. `Number('')` is 0, which would silently read
  // as "every waffle was walk-in" and understate packaging by the delivery premium.
  if (deliveryShare === '' || deliveryShare === null || deliveryShare === undefined) {
    return { cost: '', clamped: false };
  }

  var share = Number(deliveryShare);
  if (!isFinite(share)) return { cost: '', clamped: false };

  var clamped = share < 0 || share > 1;
  var s = Math.min(1, Math.max(0, share));
  return {
    cost: round2_(walkInCost * (1 - s) + deliveryCost * s),
    clamped: clamped
  };
}

/**
 * Snapshot of stock at one date, shaped for cost-by-group maths.
 *
 * WHY A SNAPSHOT
 * `computeStock_` reads and values every item, so calling it once per group per
 * date meant twelve full valuations for one view — the same quadratic pattern that
 * previously pushed this module into DEADLINE_EXCEEDED. The food-cost view needs at
 * most two dates, so it values each ONCE and reads every group from that result.
 *
 * Returns { byItem, avgCost } where `byItem` maps a normalised name to
 * { usedCost, countDate, counted }.
 */
function stockSnapshotAt_(asOf) {
  var computed = computeStock_(asOf);
  var byItem = {};
  var avgCost = {};

  computed.rows.forEach(function (r) {
    var key = normaliseItemName_(r.item);
    byItem[key] = {
      usedCost: r.usedCost || 0,
      countDate: r.countDate || '',
      counted: !!r.countDate
    };
    avgCost[key] = r.avgCost || 0;
  });

  return { byItem: byItem, avgCost: avgCost };
}

/**
 * Used cost of a set of items from one snapshot, plus the newest count date.
 *
 * `counted` is true only when EVERY item in the group has a count, because a group
 * total is only as trustworthy as its weakest member: one uncounted item drags the
 * group figure down silently.
 */
function groupUsageFrom_(snapshot, itemNames) {
  var usedCost = 0;
  var latestCount = '';
  var allCounted = (itemNames || []).length > 0;

  (itemNames || []).forEach(function (name) {
    var row = snapshot.byItem[normaliseItemName_(name)];
    if (!row) { allCounted = false; return; }
    usedCost += row.usedCost;
    if (!row.counted) allCounted = false;
    if (row.countDate && row.countDate > latestCount) latestCount = row.countDate;
  });

  return { usedCost: round2_(usedCost), countDate: latestCount, counted: allCounted };
}

/** Items in one group, from the live item master. */
function itemsInGroup_(group) {
  return readRecords_(SHEETS.ITEM_MASTER)
    .filter(function (r) {
      return String(r['Active']) !== 'FALSE' &&
             String(r['Group']) === group &&
             String(r['Item Name'] || '');
    })
    .map(function (r) { return String(r['Item Name']); });
}

/** Waffles sold in a range: POS Units Sold for Kind = waffle (extras excluded). */
function wafflesSoldIn_(startDate, endDate) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var kindOf = {};
  posProducts_().forEach(function (p) { kindOf[normaliseItemName_(p.name)] = p.kind; });

  var sold = 0;
  readRecords_(SHEETS.POS_SNAPSHOTS).forEach(function (r) {
    var product = String(r['Product'] || '');
    if (!product) return;
    if (kindOf[normaliseItemName_(product)] !== 'waffle') return;

    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    var n = toNumber_(r['Units Sold']);
    if (n !== null) sold += n;
  });

  return round2_(sold);
}

/**
 * Builds the food-cost view for a range.
 *
 * Reads every source once. The expensive parts — computeStock_ for two dates and
 * the batch cost model — are called once each, not per line.
 */
function summaryFoodCost_(startDate, endDate) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var bazarRows = readRecords_(SHEETS.BAZAR);
  var openingRows = readRecords_(SHEETS.OPENING_STOCK);
  var cutOff = openingCutOff_();
  var settings = readSettings_();
  var closedSet = closedDaySet_();

  // ---- Waffles produced: Batter batches x waffles per batch -----------------
  // Batter is the base mix, so its batch count is what a waffle comes from. The
  // other preparations have different yields and are not used as the denominator.
  var batchRows = readRecords_(SHEETS.BATCHES);
  var batterBatches = 0;
  batchRows.forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;
    var n = toNumber_(r['Batter']);
    if (n !== null) batterBatches += n;
  });

  var wafflesPerBatch = toNumber_(settingsLookup_(settings, 'waffles_per_batch:Batter', 0)) || 0;
  var wafflesProduced = wafflesPerBatch > 0
    ? round2_(batterBatches * wafflesPerBatch) : '';

  // ---- Waffles sold ---------------------------------------------------------
  var sold = wafflesSoldIn_(start, end);

  // ---- Recipe cost: exact, computed WITHOUT the batches trend table ---------
  //
  // summaryBatches_ also builds the six-row cost comparison, which is another six
  // full cost models — work this view never displays and the main reason the tab
  // felt slow. The recipe figure only needs the batch totals for the range and ONE
  // cost model, so it is computed directly from the same two helpers.
  var batchStats = batchTotalsFromRows_(batchRows, startDate, endDate);
  var lastBatchDate = null;
  batchRows.forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;
    if (!lastBatchDate || d > lastBatchDate) lastBatchDate = d;
  });

  var costModel = batchCostModel_(bazarRows, openingRows, cutOff, end || lastBatchDate);
  var recipeCost = 0;
  var costByPreparation = {};
  PREPARATIONS.forEach(function (p) {
    // Round per preparation, then sum — exactly what summaryBatches_ does. Summing
    // raw values and rounding once could differ by a cent, and two tabs showing
    // different totals for the same figure destroys trust in both.
    var cost = round2_((batchStats.totals[p] || 0) * (costModel.perBatch[p] || 0));
    costByPreparation[p] = cost;
    recipeCost += cost;
  });
  recipeCost = round2_(recipeCost);
  var batchesRecorded = batchStats.records;

  // ---- Group usage, at both ends of the range -------------------------------
  // Two valuations total, not one per group per date.
  var endDate = end || new Date();
  var startDateForUsage = start || cutOff;

  var endSnap = stockSnapshotAt_(endDate);
  var startSnap = stockSnapshotAt_(startDateForUsage);

  var packagingItems = itemsInGroup_('Packaging');
  var toppingItems = itemsInGroup_('Toppings');
  var equipmentItems = itemsInGroup_('Equipments');
  var tissueItems = ['Tissue'];

  // Packaging actual deliberately excludes Tissue: it is a period expense, and
  // keeping it out of both the standard and actual figures keeps them comparable.
  var packagingForCost = packagingItems.filter(function (n) {
    return normaliseItemName_(n) !== normaliseItemName_('Tissue');
  });

  var packEnd = groupUsageFrom_(endSnap, packagingForCost);
  var packStart = groupUsageFrom_(startSnap, packagingForCost);
  var toppingEnd = groupUsageFrom_(endSnap, toppingItems);
  var toppingStart = groupUsageFrom_(startSnap, toppingItems);
  var equipEnd = groupUsageFrom_(endSnap, equipmentItems);
  var equipStart = groupUsageFrom_(startSnap, equipmentItems);
  var tissueEnd = groupUsageFrom_(endSnap, tissueItems);
  var tissueStart = groupUsageFrom_(startSnap, tissueItems);

  // A count-bracketed delta is only meaningful when BOTH ends are fully counted.
  function delta(endState, startState) {
    if (!endState.counted || !startState.counted) {
      return { cost: '', measured: false, fromCount: startState.countDate, toCount: endState.countDate };
    }
    return {
      cost: round2_(endState.usedCost - startState.usedCost),
      measured: true,
      fromCount: startState.countDate,
      toCount: endState.countDate
    };
  }

  var packagingActual = delta(packEnd, packStart);
  var toppingCost = delta(toppingEnd, toppingStart);
  var equipmentCost = delta(equipEnd, equipStart);
  var tissueCost = delta(tissueEnd, tissueStart);

  // ---- Standard packaging, priced from live averages ------------------------
  var packStandard = standardPackCost_(endSnap.avgCost);

  // Delivery share, back-solved from Waffle Box usage. Waffle Box is delivery-only,
  // so boxes used / waffles sold is the share of waffles that went out for delivery.
  var boxEnd = groupUsageFrom_(endSnap, ['Waffle Box']);
  var boxStart = groupUsageFrom_(startSnap, ['Waffle Box']);
  var boxesUsed = 0;
  var deliveryShare = '';
  var boxAvg = Number(endSnap.avgCost[normaliseItemName_('Waffle Box')] || 0);

  if (boxEnd.counted && boxStart.counted && boxAvg > 0) {
    boxesUsed = round2_((boxEnd.usedCost - boxStart.usedCost) / boxAvg);
    deliveryShare = sold > 0 ? round2_(boxesUsed / sold) : '';
  }

  // When the mix is not derivable the standard figure is left blank rather than
  // assumed to be all walk-in — the cheaper channel would flatter the result.
  var blended = blendPackCost_(packStandard.walkIn, packStandard.delivery, deliveryShare);

  var standardPerWaffle = blended.cost;

  // ---- Per-waffle figures ---------------------------------------------------
  function perWaffle(total, denominator) {
    if (total === '' || total === null || !denominator || denominator <= 0) return '';
    return round2_(total / denominator);
  }

  var packagingActualPerWaffle = packagingActual.measured
    ? perWaffle(packagingActual.cost, sold) : '';
  var toppingPerWaffle = toppingCost.measured ? perWaffle(toppingCost.cost, sold) : '';

  // Recipe cost per waffle is per PRODUCED waffle: it is what was made, not sold.
  var recipePerWaffle = perWaffle(recipeCost, wafflesProduced);

  // ---- The two blended totals ----------------------------------------------
  // A = recipe + toppings + standard packaging. B = recipe + toppings + actual.
  // Both exclude tissue and equipment, so the gap isolates packaging.
  var totalA = '';
  var totalB = '';
  var recipeBase = recipePerWaffle === '' ? 0 : recipePerWaffle;
  var toppingBase = toppingPerWaffle === '' ? 0 : toppingPerWaffle;

  if (recipePerWaffle !== '' && toppingPerWaffle !== '' && standardPerWaffle !== '') {
    totalA = round2_(recipeBase + toppingBase + standardPerWaffle);
  }
  if (recipePerWaffle !== '' && toppingPerWaffle !== '' && packagingActualPerWaffle !== '') {
    totalB = round2_(recipeBase + toppingBase + packagingActualPerWaffle);
  }

  var breakdown = (start && end) ? openDayBreakdown_(start, end, closedSet) : null;

  return {
    range: { start: start ? dateKey_(start) : '', end: end ? dateKey_(end) : '' },
    openDays: breakdown ? breakdown.openDays : 0,

    wafflesSold: sold,
    wafflesProduced: wafflesProduced,
    batterBatches: round2_(batterBatches),
    wafflesPerBatch: wafflesPerBatch,

    recipeCost: recipeCost,
    recipePerWaffle: recipePerWaffle,
    batchesRecorded: batchesRecorded,

    toppingCost: toppingCost.cost,
    toppingPerWaffle: toppingPerWaffle,
    toppingMeasured: toppingCost.measured,
    toppingFromCount: toppingCost.fromCount,
    toppingToCount: toppingCost.toCount,

    packagingStandardPerWaffle: standardPerWaffle,
    packagingStandardWalkIn: packStandard.walkIn,
    packagingStandardDelivery: packStandard.delivery,
    packagingActualCost: packagingActual.cost,
    packagingActualPerWaffle: packagingActualPerWaffle,
    packagingMeasured: packagingActual.measured,
    packagingFromCount: packagingActual.fromCount,
    packagingToCount: packagingActual.toCount,

    deliveryShare: deliveryShare,
    deliveryShareClamped: blended.clamped,
    boxesUsed: boxesUsed,

    equipmentCost: equipmentCost.cost,
    equipmentMeasured: equipmentCost.measured,
    tissueCost: tissueCost.cost,
    tissueMeasured: tissueCost.measured,

    totalA: totalA,
    totalB: totalB,
    gapBminusA: (totalA !== '' && totalB !== '') ? round2_(totalB - totalA) : '',

    exclusionNote: 'Both totals exclude tissue and equipment. ' +
      'Recipe cost is per waffle produced; toppings and packaging are per waffle sold.'
  };
}
