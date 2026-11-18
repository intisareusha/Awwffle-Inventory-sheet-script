/**
 * Awwffle Inventory System — 06_Bazar.gs
 *
 * Phase 4 — purchasing. This is the single place expenses are recorded.
 *
 * README §5 (Bazar), §5.3 (two-field model), §11 (validation), §13.C18.
 *
 * THE CENTRAL DESIGN POINT:
 * There is no separate "stock balance" to update. The Stock sheet is a VIEW
 * computed from opening stock + purchased quantity - consumption. So writing one
 * Bazar row makes stock rise automatically and exactly once, by construction.
 * This is what removes the double-entry the old workbook required (§5.1) and
 * makes "increases stock exactly once" impossible to violate rather than merely
 * promised (§11).
 *
 * Rules enforced here:
 *   - Amount is ALWAYS derived (quantity / rateDivisor * rate). Never typed.
 *   - Only `Inventory purchase` touches stock (§13.C18).
 *   - An unknown item name is rejected, never silently created (§5.3).
 *   - One row per item; several rows may share one `Ref` = one shop invoice.
 *   - Nothing is validated against a weekday or hard-coded list (§12).
 */

// ---------------------------------------------------------------------------
// Public API called from the sidebar
// ---------------------------------------------------------------------------
//
// Apps Script's `google.script.run` can only see functions with NO trailing
// underscore. The internal helpers end in `_` by convention, so these thin
// wrappers are the boundary between the UI and the logic.
//
// If the sidebar ever renders empty, the cause is almost always one of these
// names not matching what the HTML calls.

/** Sidebar bootstrap: items, expense types, units, recent refs. */
function getBazarFormOptions() {
  return getBazarFormOptions_();
}

/** Saves one invoice (one or more lines sharing a Ref). */
function addBazarInvoice(payload) {
  return addBazarInvoice_(payload);
}

/** Invoice-level totals, used by the sidebar's live summary. */
function bazarInvoices() {
  return bazarInvoices_();
}

/** Recent purchase lines for the sidebar's edit list. */
function getRecentBazarLines(limit, dateFilter) {
  return getRecentBazarLines_(limit, dateFilter);
}

/** One saved line, for editing. */
function getBazarLine(recordId) {
  return getBazarLine_(recordId);
}

/** Updates one existing line in place, keeping its Record ID. */
function updateBazarLine(payload) {
  return updateBazarLine_(payload);
}

/** Deletes one line by Record ID. */
function deleteBazarLine(recordId) {
  return deleteBazarLine_(recordId);
}

// ---------------------------------------------------------------------------
// Form options
// ---------------------------------------------------------------------------

/** Everything the sidebar needs to render its dropdowns. */
function getBazarFormOptions_() {
  var items = readRecords_(SHEETS.ITEM_MASTER)
    .filter(function (r) { return String(r['Active']) !== 'FALSE'; })
    .map(function (r) {
      return {
        name: String(r['Item Name']),
        group: String(r['Group']),
        unit: String(r['Display Unit']),
        baseUnit: String(r['Base Unit']),
        perPiece: toNumber_(r['Per Piece Weight']),
        latestRate: toNumber_(r['Latest Purchase Rate']),
        population: String(r['Population'])
      };
    })
    .filter(function (i) { return i.name; });

  // If ItemMaster is empty the form is useless, so fail loudly rather than
  // rendering blank dropdowns that look like a bug in the UI.
  if (!items.length) {
    throw new Error(
      'The ItemMaster sheet is empty. Run Awwffle > Setup / Update structure first.'
    );
  }

  var expenseTypes = readRecords_(SHEETS.EXPENSE_TYPES)
    .filter(function (r) { return String(r['Active']) !== 'FALSE'; })
    .map(function (r) {
      return {
        name: String(r['Expense Type']),
        affectsStock: String(r['Affects Stock']) === 'true' ||
                      String(r['Affects Stock']) === 'TRUE'
      };
    })
    .filter(function (t) { return t.name; });

  // Fall back to the configured list if the sheet has not been seeded yet, so an
  // empty dropdown can never be the result of a missing sheet row.
  if (!expenseTypes.length) {
    expenseTypes = EXPENSE_TYPES.map(function (t) {
      return { name: t, affectsStock: t === EXPENSE_TYPE_INVENTORY };
    });
  }

  // Recent invoice refs, so the owner can pick up an unfinished invoice.
  var refs = {};
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    var ref = String(r['Ref'] || '').trim();
    if (ref) refs[ref] = (refs[ref] || 0) + 1;
  });

  return {
    items: items,
    expenseTypes: expenseTypes,
    units: ENTRY_UNITS,
    statuses: BAZAR_STATUSES,
    inventoryType: EXPENSE_TYPE_INVENTORY,
    recentRefs: Object.keys(refs).sort().reverse().slice(0, 30),
    today: dateKey_(new Date())
  };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * Adds one or more purchase lines, optionally sharing one invoice reference.
 *
 * `payload` = {
 *   date: 'yyyy-MM-dd',
 *   expenseType: 'Inventory purchase' | 'Salary' | ...,
 *   ref: '#DCC03',
 *   status: 'Paid' | 'Due',
 *   paymentMethod: 'Cash' | 'bKash' | ...,
 *   lines: [ { item|expenseName, quantity, unit, rate } ]
 * }
 *
 * All lines are validated BEFORE anything is written. A single bad line rejects
 * the whole invoice, so a half-written bill can never exist.
 */
function addBazarInvoice_(payload) {
  var result = validateBazarInvoice_(payload);
  if (!result.ok) return { ok: false, errors: result.errors };

  var rows = result.rows;
  appendRows_(SHEETS.BAZAR, rows);

  // A backdated entry would otherwise sit at the bottom of the sheet, so the
  // table is kept in date order after every write.
  sortBazarByDate_();

  // Touch the item master's display-only latest rate. This is a convenience for
  // reorder decisions and must NEVER feed valuation (§6.2.1).
  result.rows.forEach(function (row) {
    updateLatestRate_(row[3], row[7]);
  });

  logEvent_('BAZAR', 'Purchases recorded',
    rows.length + ' line(s), ref ' + (payload.ref || '(none)'));

  return {
    ok: true,
    added: rows.length,
    total: result.total,
    ref: payload.ref || '',
    message: rows.length + ' line(s) recorded, total ' + result.total + ' BDT'
  };
}

/**
 * Validates the whole invoice and builds the rows. Pure: writes nothing.
 * Returns { ok, errors, rows, total }.
 *
 * `existingRecords` is a test seam. When omitted it reads the Bazar sheet, which
 * is what production does. Passing an array makes the duplicate check testable
 * without a spreadsheet.
 */
function validateBazarInvoice_(payload, existingRecords) {
  var errors = [];

  if (!payload) return { ok: false, errors: ['No data received.'] };

  var date = toDate_(payload.date);
  if (!date) errors.push('A valid date is required.');

  // A future purchase is almost certainly a typo.
  if (date && date > toDate_(new Date())) {
    errors.push('The date ' + dateKey_(date) + ' is in the future.');
  }

  var expenseType = String(payload.expenseType || '').trim();
  var knownType = EXPENSE_TYPES.filter(function (t) { return t === expenseType; }).length > 0;
  if (!knownType) errors.push('Choose an expense type.');

  var isInventory = expenseType === EXPENSE_TYPE_INVENTORY;

  var lines = payload.lines || [];
  if (!lines.length) errors.push('Add at least one line.');

  var ref = String(payload.ref || '').trim();

  var status = String(payload.status || 'Paid').trim();
  if (BAZAR_STATUSES.indexOf(status) === -1) {
    errors.push('Status must be one of: ' + BAZAR_STATUSES.join(', ') + '.');
  }

  var method = String(payload.paymentMethod || '').trim();

  var rows = [];
  var total = 0;

  lines.forEach(function (line, i) {
    var label = 'Line ' + (i + 1) + ': ';

    var quantity = toNumber_(line.quantity);
    if (quantity === null || quantity <= 0) {
      errors.push(label + 'quantity must be a number greater than zero.');
    }

    var rate = toNumber_(line.rate);
    if (rate === null || rate < 0) {
      errors.push(label + 'rate must be zero or more.');
    }

    var unit = String(line.unit || '').trim();
    if (ENTRY_UNITS.indexOf(unit) === -1) {
      errors.push(label + 'choose a unit (' + ENTRY_UNITS.join(', ') + ').');
    }

    var itemName = '';
    var expenseName = '';
    var baseQty = '';
    var perPiece = null;

    if (isInventory) {
      var rawItem = String(line.item || '').trim();
      if (!rawItem) {
        errors.push(label + 'choose an item.');
      } else {
        // Reject unknown names outright: silently creating one is what caused the
        // `Kitkat` / `Kitkat (4 fingers)` split in the old workbook (§5.3).
        var item = findItem_(rawItem);
        if (!item) {
          errors.push(label + '"' + rawItem + '" is not in the item master. ' +
                      'Add it to ItemMaster first, or pick an existing item.');
        } else {
          itemName = item.name;
          perPiece = item.perPieceWeight || null;

          // Base quantity drives the Stock view. Computed here so the view never
          // has to re-derive a conversion at read time.
          if (quantity !== null && UNIT_RULES[unit]) {
            baseQty = toBaseQuantity_(quantity, unit, perPiece);
          }
        }
      }
    } else {
      expenseName = String(line.expenseName || '').trim();
      if (!expenseName) {
        errors.push(label + 'enter what this expense was for.');
      }
    }

    var amount = null;
    if (quantity !== null && rate !== null && UNIT_RULES[unit]) {
      amount = amountFor_(quantity, unit, rate);
      if (amount !== null) total += amount;
    }

    rows.push([
      newId_('BAZAR'),
      date,
      expenseType,
      itemName,
      expenseName,
      quantity,
      unit,
      rate,
      amount,
      ref,
      status,
      method,
      baseQty,
      isInventory,
      new Date(),
      'Entered via form' + (expenseName ? '' : '')
    ]);
  });

  // Duplicate guard (§11). Identical line, same day, same ref, is almost always a
  // double submission rather than a genuine repeat purchase.
  if (!errors.length) {
    var duplicate = findDuplicateBazarLine_(date, rows[0], lines, existingRecords);
    if (duplicate) errors.push(duplicate);
  }

  return { ok: errors.length === 0, errors: errors, rows: rows, total: round2_(total) };
}

/**
 * Detects an exact repeat: same date, item/expense, quantity, unit, rate and ref.
 * Returns a message, or null.
 */
function findDuplicateBazarLine_(date, firstRow, lines, existingRecords) {
  var existing = existingRecords || readRecords_(SHEETS.BAZAR);
  var dayKey = dateKey_(date);

  var suspects = existing.filter(function (r) {
    return dateKey_(r['Date']) === dayKey;
  });
  if (!suspects.length) return null;

  var ref = String(firstRow[9] || '');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var itemName = String(line.item || '').trim();
    var expenseName = String(line.expenseName || '').trim();
    var qty = toNumber_(line.quantity);
    var rate = toNumber_(line.rate);
    var unit = String(line.unit || '').trim();

    var match = suspects.some(function (r) {
      var sameItem = itemName
        ? normaliseItemName_(r['Item']) === normaliseItemName_(itemName)
        : normaliseItemName_(r['Expense Name']) === normaliseItemName_(expenseName);
      return sameItem &&
        toNumber_(r['Quantity']) === qty &&
        toNumber_(r['Rate']) === rate &&
        String(r['Unit']) === unit &&
        String(r['Ref'] || '').trim() === ref;
    });

    if (match) {
      return 'Line ' + (i + 1) + ' looks like a duplicate: ' +
             (itemName || expenseName) + ', ' + qty + ' ' + unit +
             ' at ' + rate + ' on ' + dayKey + ' already exists' +
             (ref ? ' under ref ' + ref : '') + '. ' +
             'If this is genuinely a second purchase, change the ref or add a note.';
    }
  }
  return null;
}

/**
 * Keeps ItemMaster's display-only latest rate current (§6.2.1).
 * Never used for valuation; the weighted average is computed in Phase 6.
 */
function updateLatestRate_(itemName, rate) {
  if (!itemName) return;
  var sheet = getSheet_(SHEETS.ITEM_MASTER);
  var headers = getHeaders_(sheet);
  var nameCol = colIndex_(headers, 'Item Name');
  var rateCol = colIndex_(headers, 'Latest Purchase Rate');
  if (nameCol < 0 || rateCol < 0) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var names = sheet.getRange(2, nameCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (normaliseItemName_(names[i][0]) === normaliseItemName_(itemName)) {
      sheet.getRange(i + 2, rateCol + 1).setValue(rate);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Row ordering
// ---------------------------------------------------------------------------

/**
 * Sorts the Bazar sheet by date, oldest first, and returns how many rows moved.
 *
 * Why this exists: a backdated purchase is appended to the bottom by the Sheets
 * API, which leaves the table out of chronological order. Sorting keeps the sheet
 * readable and keeps month/date-range reads sane.
 *
 * Ties keep their relative order (a stable sort on date only), so rows recorded
 * in one invoice stay together and in the order they were entered.
 *
 * Row IDs are NOT touched: Record ID is the identity (§2.7), not the row number.
 */
function sortBazarByDate_() {
  var sheet = getSheet_(SHEETS.BAZAR);
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;          // 0 or 1 data row cannot be out of order

  var width = Math.max(sheet.getLastColumn(), 1);
  var range = sheet.getRange(2, 1, lastRow - 1, width);
  var values = range.getValues();

  var dateCol = colIndex_(getHeaders_(sheet), 'Date');
  if (dateCol < 0) return 0;

  // Decorate with the original index so equal dates keep their order.
  var indexed = values.map(function (row, i) {
    return { row: row, i: i, key: toDate_(row[dateCol]) };
  });

  indexed.sort(function (a, b) {
    var at = a.key ? a.key.getTime() : Number.MAX_SAFE_INTEGER;
    var bt = b.key ? b.key.getTime() : Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.i - b.i;                 // stable tie-break
  });

  var moved = 0;
  var sorted = indexed.map(function (x, i) {
    if (x.i !== i) moved++;
    return x.row;
  });

  // Only write when something actually changed: a needless write is slow and
  // would rewrite every formatted cell for no reason.
  if (moved > 0) range.setValues(sorted);
  return moved;
}

// ---------------------------------------------------------------------------
// Edit and delete — same idea as Batches, keyed by the stable Record ID
// ---------------------------------------------------------------------------

/**
 * Recent purchase lines, newest first, for the sidebar's edit list.
 *
 * `dateFilter` narrows to one day when supplied, matching how the batch form
 * shows the batches for the date currently selected.
 */
function getRecentBazarLines_(limit, dateFilter) {
  var filter = dateFilter ? dateKey_(toDate_(dateFilter)) : null;

  var rows = readRecords_(SHEETS.BAZAR).map(function (r, i) {
    var d = toDate_(r['Date']);
    if (filter && dateKey_(d) !== filter) return null;

    var isInventory = String(r['Affects Stock']) === 'true' ||
                      String(r['Affects Stock']) === 'TRUE';

    return {
      recordId: String(r['Record ID'] || ''),
      date: dateKey_(d),
      expenseType: String(r['Expense Type'] || ''),
      item: String(r['Item'] || ''),
      expenseName: String(r['Expense Name'] || ''),
      quantity: toNumber_(r['Quantity']),
      unit: String(r['Unit'] || ''),
      rate: toNumber_(r['Rate']),
      amount: toNumber_(r['Amount']),
      ref: String(r['Ref'] || ''),
      status: String(r['Status'] || ''),
      paymentMethod: String(r['Payment Method'] || ''),
      isInventory: isInventory,
      label: isInventory
        ? String(r['Item'] || '')
        : String(r['Expense Name'] || r['Expense Type'] || '')
    };
  }).filter(function (x) { return x && x.recordId; });

  // readRecords returns sheet order (oldest first); the UI wants newest first.
  rows.sort(function (a, b) {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });

  return limit ? rows.slice(0, limit) : rows;
}

/** One saved line by Record ID, or null. */
function getBazarLine_(recordId) {
  var id = String(recordId || '').trim();
  if (!id) return null;

  var found = readRecords_(SHEETS.BAZAR).filter(function (r) {
    return String(r['Record ID'] || '') === id;
  })[0];

  if (!found) return null;

  var isInventory = String(found['Affects Stock']) === 'true' ||
                    String(found['Affects Stock']) === 'TRUE';

  return {
    recordId: id,
    date: dateKey_(found['Date']),
    expenseType: String(found['Expense Type'] || ''),
    item: String(found['Item'] || ''),
    expenseName: String(found['Expense Name'] || ''),
    quantity: toNumber_(found['Quantity']),
    unit: String(found['Unit'] || ''),
    rate: toNumber_(found['Rate']),
    amount: toNumber_(found['Amount']),
    ref: String(found['Ref'] || ''),
    status: String(found['Status'] || ''),
    paymentMethod: String(found['Payment Method'] || ''),
    isInventory: isInventory
  };
}

/** Finds the sheet row number holding a Record ID, or -1. */
function findBazarRow_(sheet, recordId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === recordId) return i + 2;
  }
  return -1;
}

/**
 * Updates one existing line in place.
 *
 * Reuses validateBazarInvoice_ so an edited line obeys exactly the same rules as
 * a new one — no second validation path that can drift.
 *
 * The Record ID and the original "Entered At" are preserved so the row keeps its
 * identity (§11: history is edited, not replaced).
 */
function updateBazarLine_(payload) {
  var recordId = String(payload && payload.recordId || '').trim();
  if (!recordId) return { ok: false, errors: ['No record was selected to update.'] };

  var sheet = getSheet_(SHEETS.BAZAR);
  var realRow = findBazarRow_(sheet, recordId);
  if (realRow < 2) {
    return { ok: false, errors: ['That purchase no longer exists. Refresh and try again.'] };
  }

  var existing = readRecords_(SHEETS.BAZAR).filter(function (r) {
    return String(r['Record ID'] || '') === recordId;
  })[0];

  // Validate as a single-line invoice, excluding this record from the duplicate
  // check — otherwise saving a line unchanged would flag itself as a duplicate.
  var single = {
    date: payload.date,
    expenseType: payload.expenseType,
    ref: payload.ref,
    status: payload.status,
    paymentMethod: payload.paymentMethod,
    lines: payload.lines && payload.lines.length ? [payload.lines[0]] : []
  };

  var others = readRecords_(SHEETS.BAZAR).filter(function (r) {
    return String(r['Record ID'] || '') !== recordId;
  });

  var result = validateBazarInvoice_(single, others);
  if (!result.ok) return { ok: false, errors: result.errors };

  var row = result.rows[0];
  row[0] = recordId;                                  // keep the identity
  row[14] = existing && existing['Entered At'] ? existing['Entered At'] : new Date();
  row[15] = 'Edited via form';

  sheet.getRange(realRow, 1, 1, row.length).setValues([row]);

  // Editing can change the date, which may take the row out of order.
  sortBazarByDate_();

  // The item's display-only latest rate may have moved with this edit.
  if (row[3]) updateLatestRate_(row[3], row[7]);

  logEvent_('BAZAR', 'Purchase edited', recordId + ' ' + dateKey_(result.date));
  return {
    ok: true,
    updated: true,
    recordId: recordId,
    total: result.total,
    message: 'Updated: ' + (row[3] || row[4]) + ' ' + row[5] + ' ' + row[6] +
             ' at ' + row[7] + ' (' + row[8] + ' BDT)'
  };
}

/** Deletes one line by Record ID. */
function deleteBazarLine_(recordId) {
  var id = String(recordId || '').trim();
  if (!id) return { ok: false, errors: ['No record was selected to delete.'] };

  var sheet = getSheet_(SHEETS.BAZAR);
  var realRow = findBazarRow_(sheet, id);
  if (realRow < 2) {
    return { ok: false, errors: ['That purchase no longer exists. It may already be deleted.'] };
  }

  var existing = readRecords_(SHEETS.BAZAR).filter(function (r) {
    return String(r['Record ID'] || '') === id;
  })[0];

  var description = existing
    ? (existing['Item'] || existing['Expense Name'] || '') + ' ' +
      (existing['Quantity'] || '') + ' ' + (existing['Unit'] || '')
    : id;

  sheet.deleteRow(realRow);
  logEvent_('BAZAR', 'Purchase deleted', id + ' ' + description);

  return {
    ok: true,
    deleted: id,
    message: 'Deleted: ' + description
  };
}

// ---------------------------------------------------------------------------
// Queries used by the form and by later phases
// ---------------------------------------------------------------------------

/** Purchased quantity per item, in base units (used by the Stock view). */
function purchasedBaseQuantity_() {
  var out = {};
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    if (String(r['Affects Stock']) !== 'true' && String(r['Affects Stock']) !== 'TRUE') return;
    var item = String(r['Item'] || '');
    if (!item) return;
    var base = toNumber_(r['Base Quantity']);
    if (base === null) return;
    out[item] = (out[item] || 0) + base;
  });
  return out;
}

/** Summarises Bazar over a date range, groupable by item or expense type. */
function bazarSummary_(startDate, endDate) {
  var start = toDate_(startDate);
  var end = toDate_(endDate);

  var byItem = {};
  var byType = {};
  var total = 0;
  var count = 0;

  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;

    var amount = toNumber_(r['Amount']) || 0;
    var type = String(r['Expense Type'] || '');
    var name = String(r['Item'] || r['Expense Name'] || '');

    byType[type] = (byType[type] || 0) + amount;
    byItem[name] = (byItem[name] || 0) + amount;
    total += amount;
    count++;
  });

  return { total: round2_(total), count: count, byItem: byItem, byType: byType };
}

/** Invoice-level totals: rows grouped by Ref (§5.2). */
function bazarInvoices_() {
  var groups = {};
  readRecords_(SHEETS.BAZAR).forEach(function (r) {
    var ref = String(r['Ref'] || '').trim();
    if (!ref) return;
    if (!groups[ref]) groups[ref] = { ref: ref, date: r['Date'], lines: 0, total: 0 };
    groups[ref].lines++;
    groups[ref].total += toNumber_(r['Amount']) || 0;
  });
  return Object.keys(groups).map(function (k) {
    var g = groups[k];
    g.total = round2_(g.total);
    return g;
  }).sort(function (a, b) {
    return toDate_(b.date) - toDate_(a.date);
  });
}
