/**
 * Awwffle Inventory System — 00_Config.gs
 *
 * Global constants. No logic beyond trivial lookups lives here.
 *
 * PHASE 2 — data model and configuration.
 * Rules implemented from README §13. See §13.C (units), §13.D (recipes/costs).
 */

/** Sheet names. Changing a value here renames the sheet on the next setup run. */
var SHEETS = {
  SETTINGS: 'Settings',
  ITEM_MASTER: 'ItemMaster',
  EXPENSE_TYPES: 'ExpenseTypes',
  MEASUREMENTS: 'Measurements',
  BATCHES: 'Batches',
  BAZAR: 'Bazar',
  POS_SNAPSHOTS: 'POS_Snapshots',
  POS_PRODUCTS: 'POS_Products',
  PRICE_HISTORY: 'PriceHistory',
  INVOICES: 'Invoices',
  DISCOUNT_DUE: 'DiscountDue',
  CLOSED_DAYS: 'ClosedDays',
  ADJUSTMENTS: 'Adjustments',
  OPENING_STOCK: 'OpeningStock',
  MIGRATION_REPORT: 'MigrationReport',

  // View sheets — formula driven, never written with data.
  STOCK: 'Stock',
  DAILY_WAFFLES: 'DailyWaffles',
  ALL_TIME: 'AllTime'
};

/** Groups, in the order they must appear in the item master (README §4). */
var GROUPS = ['Recipes', 'Toppings', 'Equipments'];

/**
 * Preparations, in the required order (README §3.2).
 * A "batch" is the owner's own unit; one batch consumes the Measurements row.
 */
var PREPARATIONS = ['Batter', 'Nutella Mix', 'Cream', 'White Mix', 'Cheese'];

/** Units accepted at entry (README §13.C21). */
var ENTRY_UNITS = ['p', 'kg', 'gm', 'l', 'ml'];

/** Base units used for all calculation (README §6.1). */
var BASE_UNITS = { WEIGHT: 'gm', VOLUME: 'ml', COUNT: 'p' };

/**
 * Unit conversion factors — README §6.1 and the D7 ruling.
 *
 * TWO separate factors are required, and conflating them drops values by 1000x.
 * The source workbook proves this with its amount formula:
 *
 *   =IF(C="p",  B*D,
 *    IF(C="kg", B*D,
 *    IF(C="gm", (B/1000)*D,
 *    IF(C="l",  B*D,
 *    IF(C="ml", (B/1000)*D, 0)))))
 *
 * `rateDivisor`    : what to divide the entry quantity by so it matches the rate's basis.
 * `baseMultiplier` : what to multiply the entry quantity by to reach the base unit.
 *
 * Note gm and kg have OPPOSITE factors: gm divides the rate, kg multiplies the stock.
 */
var UNIT_RULES = {
  kg: { rateDivisor: 1,    baseMultiplier: 1000, baseUnit: 'gm', dimension: 'weight' },
  gm: { rateDivisor: 1000, baseMultiplier: 1,    baseUnit: 'gm', dimension: 'weight' },
  l:  { rateDivisor: 1,    baseMultiplier: 1000, baseUnit: 'ml', dimension: 'volume' },
  ml: { rateDivisor: 1000, baseMultiplier: 1,    baseUnit: 'ml', dimension: 'volume' },
  p:  { rateDivisor: 1,    baseMultiplier: 1,    baseUnit: 'p',  dimension: 'count' }
};

/** Expense types. Only INVENTORY touches stock (README §13.C18). */
var EXPENSE_TYPES = ['Inventory purchase', 'Salary', 'Courier', 'Maintenance', 'Other'];
var EXPENSE_TYPE_INVENTORY = 'Inventory purchase';

/**
 * Bazar payment status.
 *
 * NOTE ON THE WORD "Due": the owner asked for "Paid" and "Due" here, meaning a
 * supplier bill not yet paid. That is a DIFFERENT sense from §13.B13, where `Due`
 * means money customers owe Awwffle. They never share a column — Bazar.Status is
 * unrelated to the DiscountDue sheet — so this is a labelling choice only, not a
 * data collision. The label is kept as the owner asked.
 */
var BAZAR_STATUSES = ['Paid', 'Due'];

/** Item populations (README §3.3, §17.3, §13.G1). */
var POPULATION = {
  RECIPE: 'Recipe-driven',      // consumption from Measurements x Batches
  MANUAL: 'Manual',             // owner enters used quantity
  RESALE: 'Resale'              // POS sales consume one unit per sale
};

/**
 * Settings keys with seeded defaults.
 * README §13.E34 (thresholds), §13.D (waffles per batch, benchmarks), §13.G8.
 *
 * `type` drives validation. `editable` false means the owner should not change it
 * without understanding the consequence.
 */
var SETTINGS_SCHEMA = [
  // Business identity
  { key: 'business_name',        type: 'text',    value: 'Awwffle',  editable: true },
  { key: 'currency',             type: 'text',    value: 'BDT',      editable: false },
  { key: 'opening_cutoff_date',  type: 'date',    value: '2026-10-10', editable: false,
    note: 'First Bazar purchase date. Purchases on or before this are opening stock; later ones are Purchased Qty.' },

  // POS behaviour
  { key: 'pos_baseline',         type: 'number',  value: 10000, editable: true,
    note: 'Counter start value. A reset restarts at this number (README §7.2).' },
  { key: 'pos_reset_auto',       type: 'boolean', value: 'TRUE', editable: true,
    note: 'Detect counter resets silently instead of asking (D/§13.G7).' },

  // Closed days (README §8.4)
  { key: 'closed_day_note',      type: 'text',    value: 'Wednesday is currently closed. Store dates, never a weekday rule.',
    editable: true },

  // Cost benchmark + yield (README §13.D, §13.G2)
  { key: 'benchmark_cost_per_waffle', type: 'number', value: '', editable: true,
    note: 'Target real cost per waffle. Blank means no comparison is shown.' },
  { key: 'benchmark_cost_percent',    type: 'number', value: '', editable: true,
    note: 'Target cost as a share of sale price, e.g. 45 for 45%.' },

  // Low stock defaults (README §13.E34, §13.G8) — seeded, owner-editable per item.
  { key: 'default_low_stock_days',      type: 'number', value: 3, editable: true,
    note: 'Warn when remaining stock is under this many TRADING days.' },
  { key: 'default_low_batches',         type: 'number', value: 2, editable: true,
    note: 'Warn when remaining stock supports fewer than this many batches.' },

  // Migration (Phase 3). The source lives in a SEPARATE spreadsheet, because its
  // tab names (Batches, Bazar, Measurements) are identical to the new ones.
  { key: 'migration_source_name', type: 'text', value: 'Current Blueprint', editable: true,
    note: 'File name in Drive of the Google Sheet copy of the old workbook.' },
  { key: 'migration_source_id',   type: 'text', value: '', editable: true,
    note: 'Optional: paste the spreadsheet ID to skip the name lookup.' },
  { key: 'migration_completed_at', type: 'text', value: '', editable: false,
    note: 'Guard set automatically after a migration run. Blank it before re-running.' }
];

/**
 * Waffles-per-batch seeds (README §13.D30, D8).
 * Derived once from observed history and written to Settings so the owner edits
 * them rather than a script silently recomputing them.
 */
var WAFFLES_PER_BATCH_SEED = {
  'Batter': 24.8,
  'Nutella Mix': 33.2,
  'Cream': 63.9,
  'White Mix': 0,
  'Cheese': 0
};

/** Protected sheet names — the owner must not edit these ranges directly. */
var PROTECTED_SHEETS = [SHEETS.MEASUREMENTS];
