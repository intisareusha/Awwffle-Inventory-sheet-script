/**
 * Awwffle Inventory System — 03c_MeasurementsSeed.gs
 *
 * The fixed recipe matrix: 17 ingredients x 5 preparations, in the source order.
 *
 * README §3.1, §13.D27 — these values are fixed indefinitely. There is no
 * effective-dated recipe versioning in v1.
 *
 * Two deliberate properties:
 *   1. Blanks are EMPTY STRINGS, not zeros. A blank means "not used in this
 *      preparation" and must never be summed (README §3.1).
 *   2. 'Empty Container' is EXCLUDED. It has values in all five preparations but
 *      has no Stock row, so migrating it would create a permanent orphan across
 *      every stock total (README §3.1, §9).
 *
 * Units: grams per batch for solids, millilitres per batch for liquids.
 * One batch of each preparation consumes exactly these numbers.
 */

var MEASUREMENTS_SEED = [
  { ingredient: 'Flour',           Batter: 500,  'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Corn Flour',      Batter: 150,  'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Sugar',           Batter: 100,  'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Salt',            Batter: 6,    'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'B. Powder',       Batter: 10,   'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'B. Soda',         Batter: 6,    'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Egg',             Batter: 6,    'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Milk',            Batter: 1000, 'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Oil',             Batter: '',   'Nutella Mix': 750,  Cream: '',   'White Mix': 500,  Cheese: '' },
  { ingredient: 'Butter',          Batter: 150,  'Nutella Mix': 120,  Cream: '',   'White Mix': 150,  Cheese: 60 },
  { ingredient: 'Vanilla',         Batter: 10,   'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Nutella',         Batter: '',   'Nutella Mix': 175,  Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'White Chocolate', Batter: '',   'Nutella Mix': '',   Cream: '',   'White Mix': 500,  Cheese: '' },
  { ingredient: 'Milk Chocolate',  Batter: '',   'Nutella Mix': 550,  Cream: '',   'White Mix': '',   Cheese: '' },
  { ingredient: 'Icing Sugar',     Batter: '',   'Nutella Mix': '',   Cream: 50,   'White Mix': '',   Cheese: 30 },
  { ingredient: 'Whipped Cream',   Batter: '',   'Nutella Mix': '',   Cream: 500,  'White Mix': '',   Cheese: 200 },
  { ingredient: 'Cream Cheese',    Batter: '',   'Nutella Mix': '',   Cream: '',   'White Mix': '',   Cheese: 175 }
];

/** The measurement requirement for one ingredient in one preparation, or 0. */
function measurementFor_(ingredient, preparation) {
  var item = findItem_(ingredient);
  var key = item ? item.name : String(ingredient);
  for (var i = 0; i < MEASUREMENTS_SEED.length; i++) {
    if (MEASUREMENTS_SEED[i].ingredient === key) {
      var v = MEASUREMENTS_SEED[i][preparation];
      return isBlank_(v) ? 0 : Number(v);
    }
  }
  return 0;
}

/** True when the ingredient is used in at least one preparation. */
function isRecipeIngredient_(ingredient) {
  for (var i = 0; i < MEASUREMENTS_SEED.length; i++) {
    if (MEASUREMENTS_SEED[i].ingredient === ingredient) {
      return PREPARATIONS.some(function (p) {
        return !isBlank_(MEASUREMENTS_SEED[i][p]);
      });
    }
  }
  return false;
}
