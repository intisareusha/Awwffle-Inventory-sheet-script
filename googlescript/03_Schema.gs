/**
 * Awwffle Inventory System — 03_Schema.gs
 *
 * Every sheet's column layout, defined once.
 *
 * Why this file exists: setup reads it to create headers, and every other module
 * reads it to find columns BY NAME. No module should ever hard-code a column
 * letter. Adding a column later is a one-line change here plus a setup re-run.
 *
 * Sheets are split into two kinds:
 *   SOURCE  — written by the scripts, append-only, one row per event.
 *   VIEW    — formulas only, regenerated from source. Never hand-edited.
 */

/** Header definitions for every SOURCE sheet. */
var SCHEMA = {};

// ---------------------------------------------------------------------------
// Configuration sheets
// ---------------------------------------------------------------------------

SCHEMA[SHEETS.SETTINGS] = [
  'Setting',    // key
  'Value',
  'Type',       // text | number | date | boolean
  'Editable',   // FALSE means: understand the consequence before changing
  'Note'
];

SCHEMA[SHEETS.EXPENSE_TYPES] = [
  'Expense Type',
  'Affects Stock',   // TRUE only for 'Inventory purchase'
  'Active',
  'Note'
];

SCHEMA[SHEETS.CLOSED_DAYS] = [
  'Date',
  'Reason',
  'Recorded At'
];

// ItemMaster headers live in 02_ItemMaster.gs as itemMasterHeaders_().

// ---------------------------------------------------------------------------
// Recipe configuration
// ---------------------------------------------------------------------------

SCHEMA[SHEETS.MEASUREMENTS] = ['Ingredient', 'Batter', 'Nutella Mix', 'Cream', 'White Mix', 'Cheese'];

// ---------------------------------------------------------------------------
// Operational source sheets
// ---------------------------------------------------------------------------

SCHEMA[SHEETS.BATCHES] = [
  'Batch ID',
  'Date',
  'Batter',
  'Nutella Mix',
  'Cream',
  'White Mix',
  'Cheese',
  'Entered At',
  'Notes'
];

/**
 * Bazar — one row per item purchased.
 * README §5.2 plus the D1 ruling: the source's `Expense For` column actually held
 * the QUANTITY, so it is named `Quantity` here, and the item name gets its own
 * column. `Ref` groups rows belonging to one shop invoice (D/§13.G5).
 */
SCHEMA[SHEETS.BAZAR] = [
  'Record ID',
  'Date',
  'Expense Type',       // Inventory purchase | Salary | Courier | Maintenance | Other
  'Item',               // canonical item name for inventory purchases
  'Expense Name',       // free text for non-inventory, e.g. a specific salary
  'Quantity',
  'Unit',
  'Rate',               // per kg / per litre / per piece (D7)
  'Amount',             // always derived: quantity / rateDivisor * rate
  'Ref',                // invoice grouping key, NOT unique
  'Status',
  'Payment Method',
  'Base Quantity',      // quantity converted to the item's base unit
  'Affects Stock',      // TRUE only for inventory purchases
  'Entered At',
  'Notes'
];

// ---------------------------------------------------------------------------
// POS sheets
// ---------------------------------------------------------------------------

SCHEMA[SHEETS.POS_PRODUCTS] = [
  'Product ID',
  'Product Name',       // must match the POS export spelling
  'Kind',               // waffle | extra
  'Display Order',      // extras first, then waffles (D2)
  'Cost',               // current assumed cost, from the POS
  'Sale',               // current selling price
  'Baseline',           // counter start, normally 10,000
  'Cumulative Sold',    // lifetime total, survives resets (§7.2)
  'Active'
];

SCHEMA[SHEETS.POS_SNAPSHOTS] = [
  'Snapshot ID',
  'Date',
  'Product',
  'Prev Stock',
  'Cr Stock',
  'Units Sold',
  'Reset Occurred',
  'Entered At',
  'Notes'
];

/**
 * PriceHistory — dated POS cost/sale changes (README §13.D29).
 * A price change takes effect from Effective From and never rewrites earlier periods.
 */
SCHEMA[SHEETS.PRICE_HISTORY] = [
  'Product',
  'Effective From',
  'Cost',
  'Sale',
  'Recorded At',
  'Note'
];

SCHEMA[SHEETS.INVOICES] = [
  'Date',
  'Last Invoice No',
  'Invoice Count',
  'Baseline Used',      // how the first day was seeded (§7.2)
  'Entered At'
];

/**
 * DiscountDue — one dated daily total each (README §13.G3, §13.B14, §13.B16).
 * Not per-invoice records, because the POS supplies no per-sale identity.
 */
SCHEMA[SHEETS.DISCOUNT_DUE] = [
  'Date',
  'Discount',
  'Due Accrued',
  'Due Settled',
  'Customer',           // optional (§13.B16)
  'Entered At',
  'Notes'
];

/**
 * Adjustments — wastage, damage, manual corrections (README §13.C26).
 * Kept separate from recipe consumption so wastage is never double-counted.
 */
SCHEMA[SHEETS.ADJUSTMENTS] = [
  'Adjustment ID',
  'Date',
  'Item',
  'Quantity',           // positive number
  'Direction',          // Out (wastage/damage) | In (found stock) | Count (set to)
  'Reason',
  'Base Quantity',
  'Entered At',
  'Notes'
];

// ---------------------------------------------------------------------------
// View sheets — formulas only
// ---------------------------------------------------------------------------

SCHEMA[SHEETS.STOCK] = [
  'Item',
  'Group',
  'Population',
  'Opening Qty',        // in base unit
  'Purchased Qty',
  'Total Available',
  'Batter Used',
  'Nutella Mix Used',
  'Cream Used',
  'White Mix Used',
  'Cheese Used',
  'Manual Used',
  'Total Used',
  'Used Cost',
  'Remaining Qty',
  'Remaining Value',
  'Est. Open Days',     // labelled "Open days", not calendar days (D6)
  'Est. Batches',
  'Low Stock',
  'Latest Purchase Rate'
];

SCHEMA[SHEETS.DAILY_WAFFLES] = [
  'Date',
  'Product',
  'Prev Stock',
  'Cr Stock',
  'Units Sold'
];

SCHEMA[SHEETS.ALL_TIME] = [
  'Item No',
  'Item Name',
  'Prev Stock',
  'Cr Stock',
  'Unit Sold',
  'Cost',
  'Sale',
  'Total Sold',
  'Total Cost',
  'Total Profit'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Column index (1-based) for a header name, or -1. */
function schemaCol_(sheetName, headerName) {
  var headers = SCHEMA[sheetName] || [];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === headerName) return i + 1;
  }
  return -1;
}

/** Column letter for a header name, e.g. 'C'. Throws when missing. */
function schemaLetter_(sheetName, headerName) {
  var idx = schemaCol_(sheetName, headerName);
  if (idx < 1) throw new Error('Unknown column ' + headerName + ' on ' + sheetName);
  return columnLetter_(idx);
}

/** 1 -> A, 27 -> AA. */
function columnLetter_(index) {
  var letter = '';
  while (index > 0) {
    var rem = (index - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

/** All source sheet names, in creation order. */
function sourceSheetOrder_() {
  return [
    SHEETS.SETTINGS,
    SHEETS.EXPENSE_TYPES,
    SHEETS.ITEM_MASTER,
    SHEETS.MEASUREMENTS,
    SHEETS.BATCHES,
    SHEETS.BAZAR,
    SHEETS.POS_PRODUCTS,
    SHEETS.POS_SNAPSHOTS,
    SHEETS.PRICE_HISTORY,
    SHEETS.INVOICES,
    SHEETS.DISCOUNT_DUE,
    SHEETS.CLOSED_DAYS,
    SHEETS.ADJUSTMENTS
  ];
}

/** Headers for a sheet, resolving the one that lives outside SCHEMA. */
function headersFor_(sheetName) {
  if (sheetName === SHEETS.ITEM_MASTER) return itemMasterHeaders_();
  return SCHEMA[sheetName] || [];
}
