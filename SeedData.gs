/**
 * Awwffle — Business Management Workbook
 * File: SeedData.gs
 * Purpose: every supplied historical figure, transcribed exactly from the master brief.
 *          Nothing here is calculated or invented — the builder writes these verbatim.
 */

/* ---- POS daily stock snapshots — Oct 17..30, 2026 (Oct 22 = weekly off) ----- */
/* Stock arrays follow the PRODUCTS order (Extra Banana -> Awwffle): [prev, curr].*/
var POS_DAYS = [
  { date: '2026-10-17', label: 'Oct 17', sold: 28, sales: 2891, batch: 'B1:N1:C0', stock: [
    [10000,10000],[10000,10000],[10000,9999],[10000,10000],[10000,10000],[10000,10000],
    [10000,9999],[10000,9999],[10000,10000],[10000,9999],[10000,9996],[10000,10000],
    [10000,9999],[10000,9994],[10000,9999],[10000,9999],[10000,9994],[10000,9994]] },
  { date: '2026-10-18', label: 'Oct 18', sold: 31, sales: 3847, batch: 'B1:N1:C0', stock: [
    [10000,10000],[10000,10000],[9999,9999],[10000,10000],[10000,10000],[10000,10000],
    [9999,9987],[9999,9999],[10000,10000],[9999,9998],[9996,9995],[10000,9997],
    [9999,9999],[9994,9993],[9999,9999],[9999,9998],[9994,9985],[9994,9991]] },
  { date: '2026-10-19', label: 'Oct 19', sold: 47, sales: 5955, batch: 'B2:N2:C2', stock: [
    [10000,10000],[10000,10000],[9999,9999],[10000,10000],[10000,10000],[10000,9998],
    [9987,9973],[9999,9999],[10000,10000],[9998,9998],[9995,9988],[9997,9997],
    [9999,9998],[9993,9992],[9999,9994],[9998,9996],[9985,9979],[9991,9980]] },
  { date: '2026-10-20', label: 'Oct 20', sold: 40, sales: 4627, batch: 'B1:N1:C0', stock: [
    [10000,10000],[10000,10000],[9999,9999],[10000,9999],[10000,10000],[9998,9998],
    [9973,9960],[9999,9997],[10000,10000],[9998,9998],[9988,9987],[9997,9997],
    [9998,9998],[9992,9988],[9994,9991],[9996,9995],[9979,9972],[9980,9971]] },
  { date: '2026-10-21', label: 'Oct 21', sold: 23, sales: 2599, batch: 'B2:N1:C1', stock: [
    [10000,10000],[10000,10000],[9999,9997],[9999,9999],[10000,10000],[9998,9998],
    [9960,9957],[9997,9996],[10000,10000],[9998,9998],[9987,9985],[9997,9996],
    [9998,9996],[9988,9986],[9991,9990],[9995,9993],[9972,9965],[9971,9969]] },
  { date: '2026-10-23', label: 'Oct 23', sold: 51, sales: 6174, batch: 'B1:N0:C0', stock: [
    [10000,10000],[10000,10000],[9997,9997],[9999,9999],[10000,10000],[9998,9998],
    [9957,9950],[9996,9996],[10000,10000],[9998,9996],[9985,9985],[9996,9994],
    [9996,9993],[9986,9984],[9990,9983],[9993,9989],[9965,9953],[9969,9957]] },
  { date: '2026-10-24', label: 'Oct 24', sold: 55, sales: 7131, batch: 'B2:N1:C1', stock: [
    [10000,10000],[10000,10000],[9997,9991],[9999,9999],[10000,10000],[9998,9996],
    [9950,9942],[9996,9995],[10000,10000],[9996,9995],[9985,9979],[9994,9994],
    [9993,9981],[9984,9978],[9983,9979],[9989,9986],[9953,9943],[9957,9953]] },
  { date: '2026-10-25', label: 'Oct 25', sold: 38, sales: 5153, batch: 'B2:N1:C0', stock: [
    [10000,10000],[10000,10000],[9991,9990],[9999,9999],[10000,10000],[9996,9996],
    [9942,9934],[9995,9994],[10000,9998],[9995,9993],[9979,9977],[9994,9991],
    [9981,9980],[9978,9977],[9979,9978],[9986,9984],[9943,9931],[9953,9950]] },
  { date: '2026-10-26', label: 'Oct 26', sold: 42, sales: 5407, batch: 'B1:N0:C1', stock: [
    [10000,10000],[10000,10000],[9990,9990],[9999,9999],[10000,10000],[9996,9995],
    [9934,9930],[9994,9991],[9998,9997],[9993,9991],[9977,9975],[9991,9991],
    [9980,9978],[9977,9969],[9978,9978],[9984,9983],[9931,9920],[9950,9942]] },
  { date: '2026-10-27', label: 'Oct 27', sold: 22, sales: 3139, batch: 'B2:N1:C1', stock: [
    [10000,10000],[10000,10000],[9990,9989],[9999,9999],[10000,10000],[9995,9995],
    [9930,9922],[9991,9991],[9997,9997],[9991,9991],[9975,9975],[9991,9991],
    [9978,9974],[9969,9967],[9978,9978],[9983,9980],[9920,9916],[9942,9941]] },
  { date: '2026-10-28', label: 'Oct 28', sold: 23, sales: 2935, batch: 'B0:N0:C0', stock: [
    [10000,10000],[10000,10000],[9989,9989],[9999,9999],[10000,10000],[9995,9995],
    [9922,9918],[9991,9989],[9997,9997],[9991,9991],[9975,9974],[9991,9991],
    [9974,9971],[9967,9966],[9978,9978],[9980,9980],[9916,9913],[9941,9932]] },
  { date: '2026-10-29', label: 'Oct 29', sold: 33, sales: 4363, batch: 'B2:N0:C1', stock: [
    [10000,10000],[10000,10000],[9989,9988],[9999,9999],[10000,10000],[9995,9995],
    [9918,9914],[9989,9988],[9997,9997],[9991,9991],[9974,9971],[9991,9991],
    [9971,9966],[9966,9964],[9978,9975],[9980,9978],[9913,9909],[9932,9923]] },
  { date: '2026-10-30', label: 'Oct 30', sold: 34, sales: 4469, batch: 'B2:N2:C1', stock: [
    [10000,10000],[10000,10000],[9988,9987],[9999,9999],[10000,10000],[9995,9995],
    [9914,9905],[9988,9987],[9997,9997],[9991,9991],[9971,9971],[9991,9990],
    [9966,9964],[9964,9959],[9975,9972],[9978,9976],[9909,9899],[9923,9922]] }
];

/* ---- Production log — newly prepared batches (not necessarily consumed) ----- */
var PRODUCTION_ROWS = [
  { date: '2026-10-14', batter: 0.5, nutella: 1, cream: 1, white: 1, cheese: 1, note: 'Training/trial day' },
  { date: '2026-10-16', batter: 1.5, nutella: 1, cream: 0, white: 0, cheese: 0, note: 'Training/trial day' },
  { date: '2026-10-17', batter: 1,   nutella: 1, cream: 0, white: 0, cheese: 0, note: 'B1:N1:C0' },
  { date: '2026-10-18', batter: 1,   nutella: 1, cream: 0, white: 0, cheese: 0, note: 'B1:N1:C0' },
  { date: '2026-10-19', batter: 2,   nutella: 2, cream: 1, white: 0, cheese: 0, note: 'B2:N2:C2 (notation)' },
  { date: '2026-10-20', batter: 1,   nutella: 1, cream: 0, white: 0, cheese: 0, note: 'B1:N1:C0' },
  { date: '2026-10-21', batter: 2,   nutella: 2, cream: 1, white: 0, cheese: 0, note: 'B2:N1:C1 (notation)' },
  { date: '2026-10-23', batter: 1,   nutella: 0, cream: 0, white: 0, cheese: 0, note: 'B1:N0:C0' },
  { date: '2026-10-24', batter: 2,   nutella: 2, cream: 1, white: 0, cheese: 0, note: 'B2:N1:C1 (notation)' },
  { date: '2026-10-25', batter: 2,   nutella: 2, cream: 0, white: 0, cheese: 0, note: 'B2:N1:C0 (notation)' },
  { date: '2026-10-26', batter: 1,   nutella: 0, cream: 1, white: 0, cheese: 0, note: 'B1:N0:C1' },
  { date: '2026-10-27', batter: 2,   nutella: 2, cream: 1, white: 0, cheese: 0, note: 'B2:N1:C1 (notation)' },
  { date: '2026-10-28', batter: 0,   nutella: 0, cream: 0, white: 0, cheese: 0, note: 'B0:N0:C0 — sold 23 on carried-over batter' },
  { date: '2026-10-29', batter: 2,   nutella: 0, cream: 1, white: 0, cheese: 0, note: 'B2:N0:C1' },
  { date: '2026-10-30', batter: 2,   nutella: 2, cream: 1, white: 0, cheese: 0, note: 'B2:N2:C1' }
];

/* ---- Recipes / Bill of Materials (per batch) -------------------------------- */
var RECIPE_ROWS = [
  { batch: 'Batter',      ing: 'Flour',         qty: 500,  unit: 'g'   },
  { batch: 'Batter',      ing: 'Corn Flour',    qty: 150,  unit: 'g'   },
  { batch: 'Batter',      ing: 'Sugar',         qty: 100,  unit: 'g'   },
  { batch: 'Batter',      ing: 'Salt',          qty: 6,    unit: 'g'   },
  { batch: 'Batter',      ing: 'Baking Powder', qty: 10,   unit: 'g'   },
  { batch: 'Batter',      ing: 'Baking Soda',   qty: 6,    unit: 'g'   },
  { batch: 'Batter',      ing: 'Egg',           qty: 6,    unit: 'pcs' },
  { batch: 'Batter',      ing: 'Milk',          qty: 1000, unit: 'g'   },
  { batch: 'Batter',      ing: 'Butter',        qty: 150,  unit: 'g'   },
  { batch: 'Batter',      ing: 'Vanilla',       qty: 10,   unit: 'g'   },
  { batch: 'Nutella Mix', ing: 'Oil',           qty: 750,  unit: 'g'   },
  { batch: 'Nutella Mix', ing: 'Butter',        qty: 120,  unit: 'g'   },
  { batch: 'Nutella Mix', ing: 'Nutella',       qty: 175,  unit: 'g'   },
  { batch: 'Nutella Mix', ing: 'Milk Chocolate',qty: 550,  unit: 'g'   },
  { batch: 'White Mix',   ing: 'Oil',           qty: 500,  unit: 'g'   },
  { batch: 'White Mix',   ing: 'Butter',        qty: 150,  unit: 'g'   },
  { batch: 'White Mix',   ing: 'White Chocolate',qty: 500, unit: 'g'   },
  { batch: 'Cream',       ing: 'Icing Sugar',   qty: 50,   unit: 'g'   },
  { batch: 'Cream',       ing: 'Whipped Cream', qty: 500,  unit: 'g'   }
];

/* ---- Purchases (Bazar / inventory) — no purchase dates were supplied ------- */
/* unit 'jar' and 'pack' deliberately have no conversion factor yet.          */
var PURCHASE_ROWS = [
  { item: 'Nutella',                   qty: 12,   unit: 'jar', rateText: '৳830 / jar',   total: 9960, group: 'Ingredients' },
  { item: 'Dark Chocolate',            qty: 5,    unit: 'kg',  rateText: '৳560 / kg',    total: 2800, group: 'Ingredients' },
  { item: 'Milk Chocolate',            qty: 15,   unit: 'kg',  rateText: '৳590 / kg',    total: 8850, group: 'Ingredients' },
  { item: 'White Chocolate',           qty: 1,    unit: 'kg',  rateText: '৳560 / kg',    total: 560,  group: 'Ingredients' },
  { item: 'Whipped Cream',             qty: 7,    unit: 'pack',rateText: '৳215 / pack',  total: 1505, group: 'Ingredients' },
  { item: 'Butter',                    qty: 14.5, unit: 'kg',  rateText: '৳480 / kg',    total: 6960, group: 'Ingredients' },
  { item: 'Icing Sugar',               qty: 1,    unit: 'kg',  rateText: '৳700 / kg',    total: 700,  group: 'Ingredients' },
  { item: 'Vanilla',                   qty: 500,  unit: 'g',   rateText: '৳2,600 / kg',  total: 1300, group: 'Ingredients' },
  { item: 'Baking Soda',               qty: 200,  unit: 'g',   rateText: '৳60 / kg',     total: 12,   group: 'Ingredients' },
  { item: 'Baking Powder',             qty: 500,  unit: 'g',   rateText: '৳450 / kg',    total: 225,  group: 'Ingredients' },
  { item: 'Corn Flour',                qty: 8,    unit: 'kg',  rateText: '৳190 / kg',    total: 1520, group: 'Ingredients' },
  { item: 'Flour',                     qty: 10.5, unit: 'kg',  rateText: '৳60 / kg',     total: 630,  group: 'Ingredients' },
  { item: 'Sugar',                     qty: 5,    unit: 'kg',  rateText: '৳106 / kg',    total: 530,  group: 'Ingredients' },
  { item: 'Salt',                      qty: 2,    unit: 'kg',  rateText: '৳38 / kg',     total: 76,   group: 'Ingredients' },
  { item: 'Oil',                       qty: 15,   unit: 'L',   rateText: '৳200 / L',     total: 3000, group: 'Ingredients' },
  { item: 'Egg',                       qty: 126,  unit: 'pcs', rateText: '৳11 / pc',     total: 1386, group: 'Ingredients' },
  { item: 'Milk',                      qty: 21,   unit: 'L',   rateText: '৳80 / L',      total: 1680, group: 'Ingredients' },
  { item: 'KitKat',                    qty: 15,   unit: 'pcs', rateText: '৳70 / pc',     total: 1050, group: 'Ingredients' },
  { item: 'Oreo',                      qty: 10,   unit: 'pcs', rateText: '৳28 / pc',     total: 280,  group: 'Ingredients' },
  { item: 'Almond Slice',              qty: 1,    unit: 'kg',  rateText: '৳1,800 / kg',  total: 1800, group: 'Ingredients' },
  { item: 'Almond Nut',                qty: 1,    unit: 'kg',  rateText: '৳1,400 / kg',  total: 1400, group: 'Ingredients' },
  { item: 'Kaju Badam',                qty: 1,    unit: 'kg',  rateText: '৳1,300 / kg',  total: 1300, group: 'Ingredients' },
  { item: 'Blueberry Filling',         qty: 500,  unit: 'g',   rateText: '৳1,400 / kg',  total: 700,  group: 'Ingredients' },
  { item: 'Strawberry Filling',        qty: 500,  unit: 'g',   rateText: '৳1,400 / kg',  total: 700,  group: 'Ingredients' },
  { item: "Hershey's Chocolate Syrup", qty: 5,    unit: 'pcs', rateText: '৳250 / pc',    total: 1250, group: 'Ingredients' },
  { item: 'Tissue',                    qty: 2,    unit: 'pcs', rateText: '৳55 / pc',     total: 110,  group: 'Consumables' },
  { item: 'Aerosol Spray',             qty: 0,    unit: 'pcs', rateText: '৳8 / pc',      total: 0,    group: 'Consumables' },
  { item: 'Room Freshener',            qty: 1,    unit: 'pcs', rateText: '৳300 / pc',    total: 300,  group: 'Consumables' },
  { item: 'White Poly Bag',            qty: 1,    unit: 'kg',  rateText: '৳200 / kg',    total: 200,  group: 'Consumables' },
  { item: 'One Time Box',              qty: 60,   unit: 'pcs', rateText: '৳5 / pc',      total: 300,  group: 'Consumables' },
  { item: 'Water 500ml',               qty: 24,   unit: 'pcs', rateText: '৳8 / pc',      total: 192,  group: 'Resale' },
  { item: 'Ice Cream - Vanilla',       qty: 0,    unit: 'kg',  rateText: '৳0 / kg',      total: 0,    group: 'Ingredients' },
  { item: 'Ice Cream - Chocolate',     qty: 0,    unit: 'kg',  rateText: '৳0 / kg',      total: 0,    group: 'Ingredients' },
  { item: 'Ice Cream - Strawberry',    qty: 0,    unit: 'kg',  rateText: '৳0 / kg',      total: 0,    group: 'Ingredients' },
  { item: 'Waffle Sticks Large',       qty: 1000, unit: 'pcs', rateText: '৳1.3 / pc',    total: 1300, group: 'Packaging' },
  { item: 'Waffle Box',                qty: 1200, unit: 'pcs', rateText: '৳5 / pc',      total: 6000, group: 'Packaging' },
  { item: 'Waffle Tray',               qty: 1200, unit: 'pcs', rateText: '৳5.9 / pc',    total: 7080, group: 'Packaging' }
];

/* ---- Owner's manual usage / remaining-stock table --------------------------- */
/* 'Not supplied' is retained exactly — never replace it with a number.        */
var MANUAL_USAGE = [
  { item: 'Flour',                    used: 10500,        purchased: 10500,        remaining: 0,          unit: 'g'   },
  { item: 'Corn Flour',               used: 3150,         purchased: 8000,         remaining: 4850,       unit: 'g'   },
  { item: 'Sugar',                    used: 2100,         purchased: 5000,         remaining: 2900,       unit: 'g'   },
  { item: 'Salt',                     used: 126,          purchased: 2000,         remaining: 1874,       unit: 'g'   },
  { item: 'Baking Powder',            used: 210,          purchased: 500,          remaining: 290,        unit: 'g'   },
  { item: 'Baking Soda',              used: 126,          purchased: 200,          remaining: 74,         unit: 'g'   },
  { item: 'Egg',                      used: 126,          purchased: 126,          remaining: 0,          unit: 'pcs' },
  { item: 'Milk',                     used: 21000,        purchased: 21000,        remaining: 0,          unit: 'g'   },
  { item: 'Oil',                      used: 13250,        purchased: 15000,        remaining: 1750,       unit: 'g'   },
  { item: 'Butter',                   used: 5340,         purchased: 14500,        remaining: 9160,       unit: 'g'   },
  { item: 'Vanilla',                  used: 210,          purchased: 500,          remaining: 290,        unit: 'g'   },
  { item: 'Nutella',                  used: 2975,         purchased: 4200,         remaining: 1225,       unit: 'g'   },
  { item: 'White Chocolate',          used: 500,          purchased: 1000,         remaining: 500,        unit: 'g'   },
  { item: 'Dark Chocolate',           used: 1000,         purchased: 5000,         remaining: 4000,       unit: 'g'   },
  { item: 'Milk Chocolate',           used: 9350,         purchased: 15000,        remaining: 5650,       unit: 'g'   },
  { item: 'Icing Sugar',              used: 400,          purchased: 1000,         remaining: 600,        unit: 'g'   },
  { item: 'Whipped Cream',            used: 4000,         purchased: 7000,         remaining: 3000,       unit: 'g'   },
  { item: 'Cream Cheese',             used: 175,          purchased: 500,          remaining: 325,        unit: 'g'   },
  { item: 'KitKat',                   used: 14,           purchased: 15,           remaining: 1,          unit: 'pcs' },
  { item: 'Oreo',                     used: 9,            purchased: 10,           remaining: 1,          unit: 'pcs' },
  { item: 'Almond Slice',             used: 600,          purchased: 1000,         remaining: 400,        unit: 'g'   },
  { item: 'Almond Nut',               used: 'Not supplied', purchased: 'Not supplied', remaining: 'Not supplied', unit: 'g' },
  { item: 'Kaju Badam',               used: 'Not supplied', purchased: 'Not supplied', remaining: 'Not supplied', unit: 'g' },
  { item: 'Blueberry Filling',        used: 'Not supplied', purchased: 'Not supplied', remaining: 'Not supplied', unit: 'g' },
  { item: 'Strawberry Filling',       used: 'Not supplied', purchased: 'Not supplied', remaining: 'Not supplied', unit: 'g' },
  { item: "Hershey's Chocolate Syrup",used: 'Not supplied', purchased: 'Not supplied', remaining: 'Not supplied', unit: 'pcs' }
];

/* ---- Owner's estimated days remaining (initial estimates) ------------------- */
var DAYS_REMAINING = {
  'Flour': 0, 'Corn Flour': 23, 'Sugar': 21, 'Salt': 223, 'Baking Powder': 21,
  'Baking Soda': 9, 'Egg': 0, 'Milk': 0, 'Oil': 2, 'Butter': 26, 'Vanilla': 21,
  'Nutella': 6, 'White Chocolate': 15, 'Dark Chocolate': 60, 'Milk Chocolate': 9,
  'Icing Sugar': 23, 'Whipped Cream': 11, 'Cream Cheese': 28, 'KitKat': 1,
  'Oreo': 2, 'Almond Slice': 10
};

/* ---- October 17–30 period summary (as supplied) ----------------------------- */
var PERIOD_SUMMARY = [
  ['First day', '17 Oct 2026', ''],
  ['Last day', '30 Oct 2026', ''],
  ['Total operating days', 13, 'number'],
  ['Total invoices', 182, 'number'],
  ['Waffles sold', 467, 'number'],
  ['Average waffles per invoice', 2.6, 'decimal'],
  ['Average invoice value', 322, 'currency'],
  ['Original / net sales', 58690, 'currency'],
  ['POS cost', 30659, 'currency'],
  ['POS profit', 28031, 'currency'],
  ['Cash in hand', 52320, 'currency'],
  ['Average daily sale', 4515, 'currency'],
  ['Average selling price per waffle', 126, 'currency'],
  ['Average cost per waffle', 66, 'currency'],
  ['Average waffles per operating day', 36, 'number'],
  ['Discount', 5702, 'currency'],
  ['Due', 840, 'currency'],
  ['Bazar', 5530, 'currency']
];
