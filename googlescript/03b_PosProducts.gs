/**
 * Awwffle Inventory System — 03b_PosProducts.gs
 *
 * The 18 POS products in the workbook's own order: 6 extras first, then the
 * 12 waffles (D2 ruling — "keep that order").
 *
 * Names are the POS spellings, which sometimes differ from the Stock item spellings.
 * They are different things and must never be merged (README §13.C20):
 * `Kitkat` is an ingredient, `Kit-Kat Kraze` is a finished product.
 *
 * `Cost` and `Sale` here are SEEDS. Real values live in PriceHistory (§13.D29).
 */

var POS_PRODUCTS = [
  // ---- Extras (POS item numbers 1-6) ----
  { name: 'Extra Banana',        kind: 'extra',  order: 1,  cost: 5,  sale: 15 },
  { name: 'Extra Nut',           kind: 'extra',  order: 2,  cost: 8,  sale: 20 },
  { name: 'Water 500ml',         kind: 'extra',  order: 3,  cost: 8,  sale: 20,
    stockItem: 'Water 500ml', notes: 'Resale: one sale removes one piece of Water 500ml stock (§13.G1).' },
  { name: 'Ice Cream - Strawberry', kind: 'extra', order: 4, cost: 20, sale: 35,
    notes: 'Stock is topping, consumed by hand. A sale does NOT reduce stock (§13.G1).' },
  { name: 'Ice Cream - Chocolate',  kind: 'extra', order: 5, cost: 20, sale: 35,
    notes: 'Topping stock, entered by hand (§13.G1).' },
  { name: 'Ice Cream - Vanilla',    kind: 'extra', order: 6, cost: 20, sale: 35,
    notes: 'Topping stock, entered by hand (§13.G1).' },

  // ---- Waffles (POS item numbers 7-18) ----
  { name: 'Chocolate Explosion', kind: 'waffle', order: 7,  cost: 75, sale: 155 },
  { name: 'Bluelicious',         kind: 'waffle', order: 8,  cost: 70, sale: 140 },
  { name: 'Bananutella',         kind: 'waffle', order: 9,  cost: 60, sale: 140 },
  { name: 'Very Strawberry',     kind: 'waffle', order: 10, cost: 65, sale: 135 },
  { name: 'Kit-Kat Kraze',       kind: 'waffle', order: 11, cost: 85, sale: 195 },
  { name: 'Rustic Sweet',        kind: 'waffle', order: 12, cost: 70, sale: 140 },
  { name: 'Midnight Oreo',       kind: 'waffle', order: 13, cost: 70, sale: 155 },
  { name: 'Dark Night',          kind: 'waffle', order: 14, cost: 70, sale: 145 },
  { name: 'Snowy Bliss',         kind: 'waffle', order: 15, cost: 60, sale: 150 },
  { name: 'Unicorn Bliss',       kind: 'waffle', order: 16, cost: 60, sale: 130 },
  { name: 'Nutella Nut',         kind: 'waffle', order: 17, cost: 60, sale: 120 },
  { name: 'Awwffle',             kind: 'waffle', order: 18, cost: 50, sale: 99 }
];

/** Rows for the POS_Products sheet, in column order. */
function posProductRows_(baseline) {
  var start = baseline || 10000;
  return POS_PRODUCTS.map(function (p) {
    return [
      '',          // Product ID, filled by setup
      p.name,
      p.kind,
      p.order,
      p.cost,
      p.sale,
      start,
      0,           // Cumulative Sold
      true
    ];
  });
}

/** The only POS product that consumes stock directly (D/§13.G1). */
function posStockLinks_() {
  return POS_PRODUCTS
    .filter(function (p) { return p.stockItem; })
    .map(function (p) { return { product: p.name, item: p.stockItem }; });
}
