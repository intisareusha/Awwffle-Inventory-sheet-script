/**
 * Awwffle Inventory System — 02_ItemMaster.gs
 *
 * The canonical catalogue: 43 items in the required order and grouping.
 * README §4 (names and order), §6.1 (units), §13.C20 (one canonical name).
 *
 * Names here are the CANONICAL names. Two are corrected from the source workbook
 * under the D10 ruling ("keep one naming convention"):
 *   - 'Kitkat '            -> 'Kitkat'           (trailing space removed)
 *   - ' Syrup Hersheys'    -> 'Syrup Hersheys'   (leading space removed)
 * Both were defects in the Stock sheet itself, not just in Bazar.
 */

/**
 * Item definitions.
 *
 * Fields:
 *   name           canonical name (unique, exact)
 *   group          one of GROUPS
 *   unit           entry/display unit — what the owner types and sees
 *   baseUnit       calculation unit — always gm, ml, or p
 *   perPieceWeight for unit 'p' only: grams (or ml) per piece. 1 for true counts.
 *   rate           seeded reference rate, taken from the source Stock sheet.
 *                  A SEED only — purchases set the real weighted average.
 *   population     POPULATION.RECIPE | MANUAL | RESALE  (README §3.3, §17.3)
 *   recipeItem     true when the item appears in Measurements
 *   posLink        POS product name that consumes this stock, if any (§13.G1)
 *   notes          short reason where the item is unusual
 */
var ITEMS = [
  // ---- Recipes (README §4.1) — 17 items, all recipe-driven ----
  { name: 'Flour',              group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 67,   population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Corn Flour',         group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 190,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Sugar',              group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 106,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Salt',               group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 38,   population: POPULATION.RECIPE, recipeItem: true },
  { name: 'B. Powder',          group: 'Recipes', unit: 'gm', baseUnit: 'gm', rate: 450,  population: POPULATION.RECIPE, recipeItem: true,
    notes: 'Rate is per kg even though quantity is entered in gm (D7).' },
  { name: 'B. Soda',            group: 'Recipes', unit: 'gm', baseUnit: 'gm', rate: 60,   population: POPULATION.RECIPE, recipeItem: true,
    notes: 'Rate is per kg (D7).' },
  { name: 'Egg',                group: 'Recipes', unit: 'p',  baseUnit: 'p',  rate: 10,   population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Milk',               group: 'Recipes', unit: 'l',  baseUnit: 'ml', rate: 80,   population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Oil',                group: 'Recipes', unit: 'l',  baseUnit: 'ml', rate: 200,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Butter',             group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 480,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Vanilla',            group: 'Recipes', unit: 'gm', baseUnit: 'gm', rate: 2600, population: POPULATION.RECIPE, recipeItem: true,
    notes: 'Rate is per kg (D7).' },
  { name: 'Nutella',            group: 'Recipes', unit: 'p',  baseUnit: 'gm', rate: 830,  population: POPULATION.RECIPE, recipeItem: true,
    perPieceWeight: 350, notes: '1 piece = one 350 gm jar. Held in pieces, consumed in grams.' },
  { name: 'White Chocolate',    group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 560,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Milk Chocolate',     group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 590,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Icing Sugar',        group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 700,  population: POPULATION.RECIPE, recipeItem: true },
  { name: 'Whipped Cream',      group: 'Recipes', unit: 'p',  baseUnit: 'gm', rate: 215,  population: POPULATION.RECIPE, recipeItem: true,
    perPieceWeight: 1000, notes: '1 piece = one 1 kg tub. Held in pieces, consumed in grams (D8).' },
  { name: 'Cream Cheese',       group: 'Recipes', unit: 'kg', baseUnit: 'gm', rate: 2100, population: POPULATION.RECIPE, recipeItem: true },

  // ---- Toppings (README §4.2) — manually maintained, no per-waffle pattern yet ----
  { name: 'Dark Chocolate',     group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 560,  population: POPULATION.MANUAL },
  { name: 'Kitkat',             group: 'Toppings', unit: 'p',  baseUnit: 'p',  rate: 70,   population: POPULATION.MANUAL,
    notes: 'Canonical name. Source had a trailing space (D10).' },
  { name: 'Oreo',               group: 'Toppings', unit: 'p',  baseUnit: 'p',  rate: 28,   population: POPULATION.MANUAL },
  { name: 'Almond Slice',       group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1800, population: POPULATION.MANUAL },
  { name: 'Almond Nut',         group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1400, population: POPULATION.MANUAL },
  { name: 'Almond Kaju',        group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1300, population: POPULATION.MANUAL },
  { name: 'Blue Berry Filling', group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1400, population: POPULATION.MANUAL },
  { name: 'Strawberry Filling', group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1400, population: POPULATION.MANUAL },
  { name: 'Syrup Hersheys',     group: 'Toppings', unit: 'p',  baseUnit: 'p',  rate: 250,  population: POPULATION.MANUAL,
    notes: 'Canonical name. Source had a leading space (D10).' },
  { name: 'Chocolate Chips Dark', group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 750, population: POPULATION.MANUAL },
  { name: 'Chocolate Rice Dark', group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 1050, population: POPULATION.MANUAL },
  { name: 'Chocolate Sprinkles', group: 'Toppings', unit: 'gm', baseUnit: 'gm', rate: 1300, population: POPULATION.MANUAL,
    notes: 'Rate is per kg (D7).' },
  { name: 'Ice cream (vanilla)',    group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 300, population: POPULATION.MANUAL,
    notes: 'Sold on POS but consumed as a topping by hand. POS sales never reduce stock (§13.G1).' },
  { name: 'Ice cream (chocolate)',  group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 300, population: POPULATION.MANUAL,
    notes: 'Topping stock, entered by hand when a can finishes (§13.G1).' },
  { name: 'Ice cream (strawberry)', group: 'Toppings', unit: 'kg', baseUnit: 'gm', rate: 300, population: POPULATION.MANUAL,
    notes: 'Topping stock, entered by hand when a can finishes (§13.G1).' },

  // ---- Resale (one item) — POS sales drive stock, not a recipe or a count ----
  //
  // Named exactly as the POS product, per the owner's instruction. The name and
  // the POS product are the SAME string here, which is deliberate and harmless:
  // they live in different sheets and are matched through `posLink`, never by
  // assuming a name match (README §13.C20, §13.G1).
  { name: 'Water 500ml',        group: 'Resale', unit: 'p',  baseUnit: 'p',  rate: 8,    population: POPULATION.RESALE,
    posLink: 'Water 500ml', notes: 'Resale item: one POS sale removes one piece (D/§13.G1).' },

  // ---- Packaging — per-waffle consumables ----
  { name: 'Waffle Sticks Large', group: 'Packaging', unit: 'p', baseUnit: 'p', rate: 1.3, population: POPULATION.MANUAL,
    notes: 'Bazar calls this "Waffle Stick" — mapped during migration (§9).' },
  { name: 'Waffle Box',          group: 'Packaging', unit: 'p', baseUnit: 'p', rate: 5,   population: POPULATION.MANUAL },
  { name: 'Waffle Tray',         group: 'Packaging', unit: 'p', baseUnit: 'p', rate: 5.9, population: POPULATION.MANUAL },
  { name: 'Bento Box',           group: 'Packaging', unit: 'p', baseUnit: 'p', rate: 5,   population: POPULATION.MANUAL },
  { name: 'Poly bag',            group: 'Packaging', unit: 'kg', baseUnit: 'gm', rate: 274, population: POPULATION.MANUAL,
    notes: 'Canonical name. Bazar had "Poly Bag" (D3).' },
  { name: 'Tissue',              group: 'Packaging', unit: 'p', baseUnit: 'p', rate: 55,  population: POPULATION.MANUAL },

  // ---- Equipments — operating supplies, not consumed per waffle ----
  { name: 'One Time box',        group: 'Equipments', unit: 'p', baseUnit: 'p', rate: 3.5, population: POPULATION.MANUAL },
  { name: 'Room Freshner',       group: 'Equipments', unit: 'p', baseUnit: 'p', rate: 300, population: POPULATION.MANUAL },
  { name: 'Arosole Spray',       group: 'Equipments', unit: 'p', baseUnit: 'p', rate: 8,   population: POPULATION.MANUAL,
    notes: 'Spelling retained from source. Zero stock and zero rate in the source workbook.' },
  { name: 'POS Roll',            group: 'Equipments', unit: 'p', baseUnit: 'p', rate: 45,  population: POPULATION.MANUAL }
];

/**
 * Item Master sheet columns.
 * `population` and `posLink` are what make the three populations explicit rather
 * than inferred from which sheet a row happens to be in.
 */
function itemMasterHeaders_() {
  return [
    'Item ID',            // stable ID
    'Item Name',          // canonical, unique
    'Group',              // Recipes | Toppings | Equipments
    'Display Unit',       // what the owner types
    'Base Unit',          // gm | ml | p
    'Per Piece Weight',   // for 'p' items with a known weight; 1 otherwise
    'Population',         // Recipe-driven | Manual | Resale
    'Recipe Item',        // TRUE when in Measurements
    'POS Link',           // POS product that consumes this stock
    'Seed Rate',          // starting reference only
    'Latest Purchase Rate', // display-only, never used for valuation (§6.2.1)
    'Weighted Avg Cost',  // valuation basis (§6.2.1)
    'Low Stock Days',     // per-item threshold (§13.E34)
    'Low Batches',        // per-item threshold
    'Active',             // FALSE retires an item without deleting history
    'Notes'
  ];
}

/** Builds the item master row array in sheet column order. */
function itemMasterRows_(settings) {
  var lowDays = settingsLookup_(settings, 'default_low_stock_days', 3);
  var lowBatches = settingsLookup_(settings, 'default_low_batches', 2);

  return ITEMS.map(function (item) {
    var perPiece = item.perPieceWeight || (item.unit === 'p' ? 1 : '');
    return [
      '',                                  // Item ID filled by setup
      item.name,
      item.group,
      item.unit,
      item.baseUnit,
      perPiece,
      item.population,
      item.recipeItem === true,
      item.posLink || '',
      item.rate,
      item.rate,                           // latest purchase rate seeds to the same value
      item.rate,                           // weighted average seeds to the same value
      lowDays,
      lowBatches,
      true,
      item.notes || ''
    ];
  });
}

/** Convenience: the canonical item names, in order. */
function itemNames_() {
  return ITEMS.map(function (i) { return i.name; });
}

/**
 * Lazily built lookup from normalised name to item. `ITEMS` never changes, so the
 * map is built once per execution. Without it, every lookup walked all 43 items
 * and re-normalised each name — and the Stock view looks up items hundreds of
 * times (valuation, consumption, measurements, flags).
 */
var ITEM_LOOKUP_ = null;

/** Looks up one item definition by canonical name (case- and space-insensitive). */
function findItem_(name) {
  if (!ITEM_LOOKUP_) {
    ITEM_LOOKUP_ = {};
    for (var i = 0; i < ITEMS.length; i++) {
      ITEM_LOOKUP_[normaliseItemName_(ITEMS[i].name)] = ITEMS[i];
    }
  }
  return ITEM_LOOKUP_[normaliseItemName_(name)] || null;
}

/**
 * Normalises a name for comparison: trims, collapses inner whitespace, lowercases.
 * Used for validation only — stored names are always the canonical ones.
 */
function normaliseItemName_(name) {
  return String(name === null || name === undefined ? '' : name)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Alias map for the ONE-TIME migration only (README §9, §13.C20).
 * Aliases never exist at query time; they are folded in during import.
 * Keys are normalised the same way normaliseItemName_ does.
 */
var MIGRATION_ALIASES = {
  'kitkat (4 fingers)': 'Kitkat',
  'kitkat':             'Kitkat',
  'waffle stick':       'Waffle Sticks Large',
  'poly bag':           'Poly bag',
  'syrup hersheys':     'Syrup Hersheys'
};

/** Resolves a historical name to its canonical item name, or null. */
function resolveAlias_(historicalName) {
  var key = normaliseItemName_(historicalName);
  if (MIGRATION_ALIASES.hasOwnProperty(key)) return MIGRATION_ALIASES[key];
  var item = findItem_(historicalName);
  return item ? item.name : null;
}
