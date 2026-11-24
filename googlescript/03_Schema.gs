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
  'Source',             // Daily | Monthly aggregate (migration only, §7.2)
  'Entered At'
];

/**
 * OpeningStock — the pre-Bazar stock layer (README §6.3).
 * Kept as its own sheet, NOT folded into purchases, so the October purchase
 * history stays visible and auditable instead of being baked into a number.
 */
SCHEMA[SHEETS.OPENING_STOCK] = [
  'Item',
  'As Of Date',         // the cut-off date, 2026-10-09
  'Quantity',           // in the item's base unit
  'Rate',               // per kg / l / p, from the Stock sheet
  'Value',
  'Source Row',         // where in the source workbook this came from
  'Note'
];

SCHEMA[SHEETS.MIGRATION_REPORT] = [
  'Section',
  'Check',
  'Expected',
  'Actual',
  'Difference',
  'Status',
  'Detail'
];

/**
 * DiscountDue — LEGACY monthly aggregates from migration.
 *
 * Kept only as an audit artifact: finance reads Discounts/Dues instead, so the
 * old monthly lumps cannot double-count the daily entries the owner now makes.
 */
SCHEMA[SHEETS.DISCOUNT_DUE] = [
  'Date',
  'Discount',
  'Due Accrued',
  'Due Settled',
  'Customer',           // optional (§13.B16)
  'Source',             // Daily | Monthly aggregate (migration only)
  'Entered At',
  'Notes'
];

/**
 * Discounts — ONE dated daily amount (README §8.1, §13.B14).
 * Saving the same date corrects that day rather than adding a second row, so the
 * day's discount can never be counted twice.
 */
SCHEMA[SHEETS.DISCOUNTS] = [
  'Discount ID',
  'Date',
  'Amount',
  'Notes',
  'Entered At'
];

/**
 * Dues — one row per customer amount owed (README §13.B16).
 * `Status` decides whether the money is still outstanding (and therefore reduces
 * cash in hand) or has been paid. `Paid Date` records when it came back.
 */
SCHEMA[SHEETS.DUES] = [
  'Due ID',
  'Date',
  'Customer',
  'Amount',
  'Status',             // Outstanding | Paid
  'Paid Date',
  'Notes',
  'Entered At'
];

/** Customers — dropdown list for dues; new names are appended on first use. */
SCHEMA[SHEETS.CUSTOMERS] = [
  'Customer',
  'Active',
  'Note'
];

/**
 * CashInHand — one daily snapshot of where the cash physically sits (notes at
 * home, bKash, bank, shop counter), reconciled against the system "Cash in Hand".
 * Only the entered figures and the system snapshot are stored; every total is
 * derived on read so the sheet can never disagree with itself.
 */
SCHEMA[SHEETS.CASH_IN_HAND] = [
  'Cash ID',
  'Date',
  'Count 1000',
  'Count 500',
  'Count 200',
  'Count 100',
  'Count 50',
  'Count 20',
  'Count 10',
  'Count 5',
  'Bkash',
  'Bank',
  'Cash Counter',
  'System Cash in Hand',
  'Notes',
  'Entered At'
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
  'Total Qty',          // opening + purchased
  'Avg. Rate',          // weighted average, per entry unit (kg / l / piece)
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
  'Total Cost',         // used cost + remaining value = what the stock cost
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
    SHEETS.DISCOUNTS,
    SHEETS.DUES,
    SHEETS.CUSTOMERS,
    SHEETS.CASH_IN_HAND,
    SHEETS.DISCOUNT_DUE,
    SHEETS.CLOSED_DAYS,
    SHEETS.ADJUSTMENTS,
    SHEETS.OPENING_STOCK,
    SHEETS.MIGRATION_REPORT
  ];
}

/** Headers for a sheet, resolving the one that lives outside SCHEMA. */
function headersFor_(sheetName) {
  if (sheetName === SHEETS.ITEM_MASTER) return itemMasterHeaders_();
  return SCHEMA[sheetName] || [];
}
