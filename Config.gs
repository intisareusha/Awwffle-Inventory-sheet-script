/**
 * Awwffle — Business Management Workbook
 * File: Config.gs
 * Purpose: Central configuration — sheet names, colour palette, masters and lists.
 *
 * Built for Google Sheets (Apps Script). All formulas used in the workbook are
 * kept inside the Excel-portable set (SUMIFS / COUNTIFS / INDEX-MATCH / IF / IFERROR)
 * so the file can also be exported to .xlsx without breaking.
 */

var AWWFFLE_VERSION = '1.0.0';

/* ---- Number / date formats -------------------------------------------------- */
var FMT_CURRENCY = '"৳"#,##0';
var FMT_NUMBER   = '#,##0';
var FMT_DECIMAL  = '#,##0.##';
var FMT_DATE     = 'yyyy-mm-dd';

/* ---- Sheet names (single source of truth) ---------------------------------- */
var SH = {
  README:        'START HERE',
  LISTS:         'Lists',
  ITEM_MASTER:   'Item Master',
  PRODUCT_MASTER:'Product Master',
  POS_RAW:       'POS Raw Data',
  SALES_LOG:     'Sales Log',
  DAILY_FINANCE: 'Daily Finance',
  PERIOD:        'Period Summary',
  PRODUCTION:    'Production Log',
  RECIPES:       'Recipes BOM',
  PURCHASES:     'Purchases',
  EXPENSES:      'Expense Log',
  INVENTORY:     'Inventory',
  PACKAGING:     'Packaging Stock',
  CONVERSIONS:   'Unit Conversions',
  STOCKTAKE:     'Stocktake',
  DASH_EXEC:     'Executive Dashboard',
  DASH_PRODUCT:  'Product Performance',
  DASH_INVENTORY:'Inventory Dashboard',
  DASH_FINANCE:  'Financial Dashboard',
  REPORTS:       'Reports',
  RECON:         'Reconciliation'
};

/* Ordered build sequence (README + Lists first) */
var SHEET_ORDER = [
  SH.README, SH.LISTS, SH.ITEM_MASTER, SH.PRODUCT_MASTER,
  SH.POS_RAW, SH.SALES_LOG, SH.DAILY_FINANCE, SH.PERIOD,
  SH.PRODUCTION, SH.RECIPES, SH.PURCHASES, SH.EXPENSES,
  SH.INVENTORY, SH.PACKAGING, SH.CONVERSIONS, SH.STOCKTAKE,
  SH.DASH_EXEC, SH.DASH_PRODUCT, SH.DASH_INVENTORY, SH.DASH_FINANCE,
  SH.REPORTS, SH.RECON
];

/* ---- Colour palette (consistent visual language) --------------------------- */
var CLR = {
  TITLE_BG:   '#0B3D4F',
  TITLE_FG:   '#FFFFFF',
  HEADER_BG:  '#1F6F8B',
  HEADER_FG:  '#FFFFFF',
  SECTION_BG: '#DCE9EE',
  INPUT_BG:   '#FFF7E0',   // editable input cells
  FORMULA_BG: '#E8F1FB',   // calculated cells
  RAW_BG:     '#F1F3F4',   // immutable raw data
  OK_BG:      '#D9EAD3',
  WARN_BG:    '#FCE5CD',
  BAD_BG:     '#F4CCCC',
  NOTE_FG:    '#555555'
};

/* ---- Standard status vocab (never invent a number; show a status) ---------- */
var STATUS = {
  NOT_SUPPLIED:   'Not supplied',
  NEEDS_CONFIRM:  'Needs confirmation',
  NO_RECIPE:      'No recipe defined',
  NO_STOCKTAKE:   'No stocktake',
  CONVERSION:     'Conversion required',
  FORECAST_NA:    'Forecast unavailable',
  OUT_OF_STOCK:   'Out of stock',
  OK:             'OK'
};

/* ---- Expandable-range bounds ----------------------------------------------- */
var DATA_START = 3;   // first data row (title row 1, header row 2, data row 3)
var R_END      = 5000; // last row used by expandable formulas

/* Build an absolute column range, e.g. rng('Purchases','G') -> 'Purchases'!$G$2:$G$5000 */
function rng(sheetName, col) {
  return "'" + sheetName + "'!$" + col + "$" + DATA_START + ":$" + col + "$" + R_END;
}

/* ---- POS product master (18 items, original POS order preserved) ------------ */
/* cost = POS unit cost, price = POS selling price (BDT), supplied 1 Nov 2026.   */
/* Verified: at the supplied daily volumes these reproduce gross sales 64,392    */
/* and POS cost 30,659 exactly.                                                 */
var PRODUCTS = [
  { no: 1,  name: 'Extra Banana',          cat: 'Add-on',    cost: 5,  price: 15  },
  { no: 2,  name: 'Extra Nut',             cat: 'Add-on',    cost: 8,  price: 20  },
  { no: 3,  name: 'Water 500ml',           cat: 'Beverage',  cost: 8,  price: 20  },
  { no: 4,  name: 'Ice Cream - Strawberry',cat: 'Ice Cream', cost: 20, price: 35  },
  { no: 5,  name: 'Ice Cream - Chocolate', cat: 'Ice Cream', cost: 20, price: 35  },
  { no: 6,  name: 'Ice Cream - Vanilla',   cat: 'Ice Cream', cost: 20, price: 35  },
  { no: 7,  name: 'Chocolate Explosion',   cat: 'Waffle',    cost: 75, price: 155 },
  { no: 8,  name: 'Bluelicious',           cat: 'Waffle',    cost: 70, price: 140 },
  { no: 9,  name: 'Bananutella',           cat: 'Waffle',    cost: 60, price: 140 },
  { no: 10, name: 'Very Strawberry',       cat: 'Waffle',    cost: 65, price: 135 },
  { no: 11, name: 'Kit-Kat Kraze',         cat: 'Waffle',    cost: 85, price: 195 },
  { no: 12, name: 'Rustic Sweet',          cat: 'Waffle',    cost: 70, price: 140 },
  { no: 13, name: 'Midnight Oreo',         cat: 'Waffle',    cost: 70, price: 155 },
  { no: 14, name: 'Dark Night',            cat: 'Waffle',    cost: 70, price: 145 },
  { no: 15, name: 'Snowy Bliss',           cat: 'Waffle',    cost: 60, price: 150 },
  { no: 16, name: 'Unicorn Bliss',         cat: 'Waffle',    cost: 60, price: 130 },
  { no: 17, name: 'Nutella Nut',           cat: 'Waffle',    cost: 60, price: 120 },
  { no: 18, name: 'Awwffle',               cat: 'Waffle',    cost: 50, price: 99  }
];

/* ---- Canonical item master (one name per item, one base unit each) ---------- */
var ITEMS = [
  { id: 'ITM-001', name: 'Flour',                   cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-002', name: 'Corn Flour',              cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-003', name: 'Sugar',                   cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-004', name: 'Salt',                    cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-005', name: 'Baking Powder',           cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-006', name: 'Baking Soda',             cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-007', name: 'Egg',                     cat: 'Main Ingredients',     unit: 'pcs' },
  { id: 'ITM-008', name: 'Milk',                    cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-009', name: 'Butter',                  cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-010', name: 'Vanilla',                 cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-011', name: 'Oil',                     cat: 'Main Ingredients',     unit: 'g'   },
  { id: 'ITM-012', name: 'Nutella',                 cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-013', name: 'Milk Chocolate',          cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-014', name: 'White Chocolate',         cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-015', name: 'Dark Chocolate',          cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-016', name: 'KitKat',                  cat: 'Chocolate & Toppings', unit: 'pcs' },
  { id: 'ITM-017', name: 'Oreo',                    cat: 'Chocolate & Toppings', unit: 'pcs' },
  { id: 'ITM-018', name: 'Almond Slice',            cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-019', name: 'Almond Nut',              cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-020', name: 'Kaju Badam',              cat: 'Chocolate & Toppings', unit: 'g'   },
  { id: 'ITM-021', name: 'Blueberry Filling',       cat: 'Fillings & Syrups',    unit: 'g'   },
  { id: 'ITM-022', name: 'Strawberry Filling',      cat: 'Fillings & Syrups',    unit: 'g'   },
  { id: 'ITM-023', name: "Hershey's Chocolate Syrup",cat: 'Fillings & Syrups',   unit: 'pcs' },
  { id: 'ITM-024', name: 'Icing Sugar',             cat: 'Fillings & Syrups',    unit: 'g'   },
  { id: 'ITM-025', name: 'Whipped Cream',           cat: 'Fillings & Syrups',    unit: 'g'   },
  { id: 'ITM-026', name: 'Cream Cheese',            cat: 'Fillings & Syrups',    unit: 'g'   },
  { id: 'ITM-027', name: 'Ice Cream - Vanilla',     cat: 'Ice Cream',            unit: 'g'   },
  { id: 'ITM-028', name: 'Ice Cream - Chocolate',   cat: 'Ice Cream',            unit: 'g'   },
  { id: 'ITM-029', name: 'Ice Cream - Strawberry',  cat: 'Ice Cream',            unit: 'g'   },
  { id: 'ITM-030', name: 'Waffle Box',              cat: 'Packaging',            unit: 'pcs' },
  { id: 'ITM-031', name: 'Waffle Tray',             cat: 'Packaging',            unit: 'pcs' },
  { id: 'ITM-032', name: 'Waffle Sticks Large',     cat: 'Serving Materials',    unit: 'pcs' },
  { id: 'ITM-033', name: 'White Poly Bag',          cat: 'Consumables',          unit: 'g'   },
  { id: 'ITM-034', name: 'Tissue',                  cat: 'Consumables',          unit: 'pcs' },
  { id: 'ITM-035', name: 'Aerosol Spray',           cat: 'Cleaning Supplies',    unit: 'pcs' },
  { id: 'ITM-036', name: 'Room Freshener',          cat: 'Cleaning Supplies',    unit: 'pcs' },
  { id: 'ITM-037', name: 'One Time Box',            cat: 'Packaging',            unit: 'pcs' },
  { id: 'ITM-038', name: 'Water 500ml',             cat: 'Resale Products',      unit: 'pcs' }
];

/* ---- Controlled vocabularies (feed every dropdown) ------------------------- */
var ITEM_CATEGORIES = [
  'Main Ingredients', 'Chocolate & Toppings', 'Fillings & Syrups', 'Ice Cream',
  'Packaging', 'Serving Materials', 'Cleaning Supplies', 'Consumables',
  'Resale Products', 'Other Inventory'
];

var PRODUCT_CATEGORIES = ['Waffle', 'Add-on', 'Beverage', 'Ice Cream', 'Resale'];

var BATCH_TYPES = ['Batter', 'Nutella Mix', 'Cream', 'White Mix', 'Cheese'];

var EXPENSE_CATEGORIES = ['Employee salaries', 'Electricity bill', 'Maintenance bill', 'Other expenses'];

var PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Bank', 'Card', 'Other'];

var STATUS_LIST = ['Active', 'Inactive'];

/* ---- Unit-conversion factors to base units -------------------------------- */
/* litres -> grams is the owner-approved assumption (1 L = 1,000 g).          */
/* Units not listed (jar, pack) stay blank on purpose — "Conversion required". */
var UNIT_CONVERSIONS = [
  { unit: 'g',   factor: 1,    base: 'g',   note: 'gram — base unit' },
  { unit: 'kg',  factor: 1000, base: 'g',   note: '1 kg = 1,000 g' },
  { unit: 'ml',  factor: 1,    base: 'g',   note: 'assumed 1 ml = 1 g (verify)' },
  { unit: 'L',   factor: 1000, base: 'g',   note: 'owner-approved 1 L = 1,000 g' },
  { unit: 'pcs', factor: 1,    base: 'pcs', note: 'piece — base unit' }
];
