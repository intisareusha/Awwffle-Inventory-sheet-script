# AWWFFLE — MASTER BUSINESS CONTEXT, DATA & SPREADSHEET PROJECT BRIEF

Document purpose: This document contains the business context, operating data, inventory information, financial records, requirements, and technical specifications for building an Awwffle business management system in Excel / Google Sheets.

The goal is to make this document portable. Any AI assistant receiving it should be able to understand the project without asking the owner to repeat all previously shared information.

---

# 1. PROJECT OVERVIEW

## 1.1 Business

Business name: Awwffle

Business type: Waffle shop / food business

Location: Abhaynagar, Noapara, Bangladesh.

Awwffle was originally developed as a dedicated waffle shop concept for the local area. The business focuses on freshly prepared waffles, quality ingredients, product consistency, and customer satisfaction.

The owner wants to build a sustainable business rather than expand too quickly.

Currently, the business operates from one outlet. The owner does not want to expand to multiple outlets until the existing operation can consistently satisfy customers.

## 1.2 Business positioning

Awwffle aims to maintain:
- Freshly prepared waffles.
- Consistent ingredient quality.
- Good portion sizes.
- Proper food preparation.
- Customer satisfaction.
- Reasonable operational costs.
- Long-term brand trust.

The business should not compromise product quality simply to increase short-term profit.

## 1.3 Operating model

The owner primarily manages the business, marketing, planning, and business administration.

The actual waffle preparation and serving are handled by the shop's operational team.

The business has a small-scale operating model, so the management system must be practical and easy to maintain.

It should not require excessive manual data entry every day.

## 1.4 Delivery

Delivery is currently limited to the area surrounding the Noapara outlet.

The reason is product quality: waffles are best enjoyed fresh and warm, while excessive delivery distance can affect their crispiness and overall experience.

---

# 2. MAIN OBJECTIVE

I want to build a complete business management control center using Google Sheets or Microsoft Excel.

This should not be a basic sales tracker.

It should be a scalable, production-grade business management system that allows me to monitor the entire operation from one workbook.

The workbook should help me understand:

1. How much the business sells.
2. Which products sell the most.
3. How many waffles are sold each day.
4. How much revenue is generated.
5. How much discount is given.
6. How much money is outstanding as customer due.
7. How much cash should be available.
8. How much money is spent on bazar purchases.
9. How much is spent on salaries, electricity, maintenance, and other operating expenses.
10. How much raw material is consumed.
11. How much raw material remains.
12. How much production is happening.
13. How much each production batch consumes.
14. How long current inventory is expected to last.
15. Which items need to be reordered.
16. What the estimated profit and actual operating performance look like.
17. How the business performs monthly and over its entire lifetime.

The system should be easy to maintain, scalable, auditable, and resistant to accidental data loss.

I do not want to overwrite historical information to update current values.

Historical data must remain available.

---

# 3. IMPORTANT SYSTEM DESIGN PRINCIPLES

The AI building this workbook must follow these principles.

## 3.1 Scalability

The business may introduce new:
- Waffle products.
- Add-ons.
- Ingredients.
- Toppings.
- Packaging materials.
- Consumables.
- Cleaning supplies.
- Resale products.
- Expense categories.
- Production batches.
- Recipes.

The workbook must support adding these items without rebuilding formulas or dashboards.

Use expandable master tables and structured transaction logs.

Do not hardcode a fixed list of products or ingredients into formulas.

## 3.2 One canonical name per item

An item must have one consistent name throughout the workbook.

Do not create different spellings of the same item in different sheets.

Use a central Item Master / Product Master.

Every other sheet should reference that master list.

Examples of canonical names:

- Ice Cream - Vanilla
- Ice Cream - Chocolate
- Ice Cream - Strawberry
- Chocolate Explosion
- Kit-Kat Kraze
- Midnight Oreo
- Waffle Box
- Waffle Tray
- Waffle Sticks Large

The three ice cream flavours are Vanilla, Chocolate, and Strawberry.

There must be no duplicate vanilla ice cream item.

If a new item is introduced, add it to the master table first.

## 3.3 Historical records must never be overwritten

For example, POS stock snapshots must be appended daily.

Do not replace yesterday's closing stock with today's closing stock.

Keep all historical snapshots.

The system should calculate stock movement using historical records.

## 3.4 Separate operational concepts

Do not mix up:
- Sales revenue.
- Discounts.
- Customer dues.
- Cash received.
- Bazar purchases.
- Inventory consumption.
- Operating expenses.
- Cost of goods sold.
- Estimated profit.
- Actual profit.

Each should have a clearly defined purpose.

Avoid double-counting the same purchase or expense.

## 3.5 Data integrity

Use:
- Unique IDs.
- Data validation.
- Dropdowns.
- Formula-driven calculations.
- Duplicate detection.
- Missing-data warnings.
- Reconciliation checks.
- Clear input/formula separation.
- Protected formula areas where supported.

The workbook should identify errors rather than silently producing incorrect totals.

---

# 4. POS SYSTEM AND SALES DATA

## 4.1 How the POS stock system works

The POS system maintains stock quantities for each product.

Initially, product stock was configured as 10,000 units.

Every day, the POS provides a stock report containing:

- Product name.
- Previous stock.
- Current stock.
- Units sold.

The actual units sold can be calculated as:

Units Sold = Previous Stock - Current Stock

For example:

Previous Stock = 10,000
Current Stock = 9,970

Units Sold = 30

The next day's previous stock should normally equal the previous day's closing stock.

The workbook must preserve each daily stock snapshot.

## 4.2 POS import workflow

The preferred daily workflow is:

1. Export the POS stock report.
2. Paste or import the complete daily report into a POS Raw Data sheet.
3. The workbook identifies the product names.
4. The workbook calculates the difference between previous and current stock.
5. Product-level units sold are calculated automatically.
6. Product revenue and estimated cost are calculated automatically.
7. Daily totals are displayed in the dashboard.

Do not require the owner to calculate individual product sales manually.

## 4.3 POS stock validation

The workbook must identify:

- Duplicate date/product records.
- Missing products.
- Newly introduced products.
- Product name mismatches.
- Unexpected stock increases.
- Negative calculated sales.
- Incorrect previous stock.
- Stock resets.
- Missing daily snapshots.

A negative sales result should not automatically be treated as a sale or silently corrected.

It may indicate a stock reset, correction, return, or import problem.

Flag it for review.

## 4.4 Product list

The following products have appeared in the POS system:

1. Extra Banana
2. Extra Nut
3. Water 500ml
4. Ice Cream - Strawberry
5. Ice Cream - Chocolate
6. Ice Cream - Vanilla
7. Chocolate Explosion
8. Bluelicious
9. Bananutella
10. Very Strawberry
11. Kit-Kat Kraze
12. Rustic Sweet
13. Midnight Oreo
14. Dark Night
15. Snowy Bliss
16. Unicorn Bliss
17. Nutella Nut
18. Awwffle

The product master should preserve the original POS item numbers and orders where available.

New products should receive unique IDs.

## 4.5 POS daily history

The following daily POS data was supplied for October 17–30, 2026.

October 22 is not included in the supplied sales records.

| Date | Waffles Sold | Daily POS Sale (BDT) |
|---|---:|---:|
| Oct 17 | 28 | 2,891 |
| Oct 18 | 31 | 3,847 |
| Oct 19 | 47 | 5,955 |
| Oct 20 | 40 | 4,627 |
| Oct 21 | 23 | 2,599 |
| Oct 23 | 51 | 6,174 |
| Oct 24 | 55 | 7,131 |
| Oct 25 | 38 | 5,153 |
| Oct 26 | 42 | 5,407 |
| Oct 27 | 22 | 3,139 |
| Oct 28 | 23 | 2,935 |
| Oct 29 | 33 | 4,363 |
| Oct 30 | 34 | 4,469 |

Total waffles sold: 467.

Sum of the daily POS sale figures above: BDT 58,682.

Important: The supplied period summary reports BDT 58,690 as net/original sales.

Do not silently change the daily figures or period total. Preserve both and display the reconciliation difference.

The complete product-by-product POS stock history is in the original attachment:

POS stock history — October 17–30, 2026

### October 17 — Day 1
Daily batch notation: B1:N1:C0
Waffles sold: 28
POS sales: ৳2,891

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 10000 | 9999 | 1 |
| Ice Cream - Strawberry | 10000 | 10000 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 10000 | 10000 | 0 |
| Chocolate Explosion | 10000 | 9999 | 1 |
| Bluelicious | 10000 | 9999 | 1 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 10000 | 9999 | 1 |
| Kit-Kat Kraze | 10000 | 9996 | 4 |
| Rustic Sweet | 10000 | 10000 | 0 |
| Midnight Oreo | 10000 | 9999 | 1 |
| Dark Night | 10000 | 9994 | 6 |
| Snowy Bliss | 10000 | 9999 | 1 |
| Unicorn Bliss | 10000 | 9999 | 1 |
| Nutella Nut | 10000 | 9994 | 6 |
| Awwffle | 10000 | 9994 | 6 |

### October 18 — Day 2
Daily batch notation: B1:N1:C0
Waffles sold: 31
POS sales: ৳3,847

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9999 | 9999 | 0 |
| Ice Cream - Strawberry | 10000 | 10000 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 10000 | 10000 | 0 |
| Chocolate Explosion | 9999 | 9987 | 12 |
| Bluelicious | 9999 | 9999 | 0 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9999 | 9998 | 1 |
| Kit-Kat Kraze | 9996 | 9995 | 1 |
| Rustic Sweet | 10000 | 9997 | 3 |
| Midnight Oreo | 9999 | 9999 | 0 |
| Dark Night | 9994 | 9993 | 1 |
| Snowy Bliss | 9999 | 9999 | 0 |
| Unicorn Bliss | 9999 | 9998 | 1 |
| Nutella Nut | 9994 | 9985 | 9 |
| Awwffle | 9994 | 9991 | 3 |

### October 19 — Day 3
Daily batch notation: B2:N2:C2
Waffles sold: 47
POS sales: ৳5,955

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9999 | 9999 | 0 |
| Ice Cream - Strawberry | 10000 | 10000 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 10000 | 9998 | 2 |
| Chocolate Explosion | 9987 | 9973 | 14 |
| Bluelicious | 9999 | 9999 | 0 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9998 | 9998 | 0 |
| Kit-Kat Kraze | 9995 | 9988 | 7 |
| Rustic Sweet | 9997 | 9997 | 0 |
| Midnight Oreo | 9999 | 9998 | 1 |
| Dark Night | 9993 | 9992 | 1 |
| Snowy Bliss | 9999 | 9994 | 5 |
| Unicorn Bliss | 9998 | 9996 | 2 |
| Nutella Nut | 9985 | 9979 | 6 |
| Awwffle | 9991 | 9980 | 11 |

### October 20 — Day 4
Daily batch notation: B1:N1:C0
Waffles sold: 40
POS sales: ৳4,627

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9999 | 9999 | 0 |
| Ice Cream - Strawberry | 10000 | 9999 | 1 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9998 | 9998 | 0 |
| Chocolate Explosion | 9973 | 9960 | 13 |
| Bluelicious | 9999 | 9997 | 2 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9998 | 9998 | 0 |
| Kit-Kat Kraze | 9988 | 9987 | 1 |
| Rustic Sweet | 9997 | 9997 | 0 |
| Midnight Oreo | 9998 | 9998 | 0 |
| Dark Night | 9992 | 9988 | 4 |
| Snowy Bliss | 9994 | 9991 | 3 |
| Unicorn Bliss | 9996 | 9995 | 1 |
| Nutella Nut | 9979 | 9972 | 7 |
| Awwffle | 9980 | 9971 | 9 |

### October 21 — Day 5
Daily batch notation: B2:N1:C1
Waffles sold: 23
POS sales: ৳2,599

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9999 | 9997 | 2 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9998 | 9998 | 0 |
| Chocolate Explosion | 9960 | 9957 | 3 |
| Bluelicious | 9997 | 9996 | 1 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9998 | 9998 | 0 |
| Kit-Kat Kraze | 9987 | 9985 | 2 |
| Rustic Sweet | 9997 | 9996 | 1 |
| Midnight Oreo | 9998 | 9996 | 2 |
| Dark Night | 9988 | 9986 | 2 |
| Snowy Bliss | 9991 | 9990 | 1 |
| Unicorn Bliss | 9995 | 9993 | 2 |
| Nutella Nut | 9972 | 9965 | 7 |
| Awwffle | 9971 | 9969 | 2 |

### October 23 — Day 6
Daily batch notation: B1:N0:C0
Waffles sold: 51
POS sales: ৳6,174

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9997 | 9997 | 0 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9998 | 9998 | 0 |
| Chocolate Explosion | 9957 | 9950 | 7 |
| Bluelicious | 9996 | 9996 | 0 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9998 | 9996 | 2 |
| Kit-Kat Kraze | 9985 | 9985 | 0 |
| Rustic Sweet | 9996 | 9994 | 2 |
| Midnight Oreo | 9996 | 9993 | 3 |
| Dark Night | 9986 | 9984 | 2 |
| Snowy Bliss | 9990 | 9983 | 7 |
| Unicorn Bliss | 9993 | 9989 | 4 |
| Nutella Nut | 9965 | 9953 | 12 |
| Awwffle | 9969 | 9957 | 12 |

### October 24 — Day 7
Daily batch notation: B2:N1:C1
Waffles sold: 55
POS sales: ৳7,131

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9997 | 9991 | 6 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9998 | 9996 | 2 |
| Chocolate Explosion | 9950 | 9942 | 8 |
| Bluelicious | 9996 | 9995 | 1 |
| Bananutella | 10000 | 10000 | 0 |
| Very Strawberry | 9996 | 9995 | 1 |
| Kit-Kat Kraze | 9985 | 9979 | 6 |
| Rustic Sweet | 9994 | 9994 | 0 |
| Midnight Oreo | 9993 | 9981 | 12 |
| Dark Night | 9984 | 9978 | 6 |
| Snowy Bliss | 9983 | 9979 | 4 |
| Unicorn Bliss | 9989 | 9986 | 3 |
| Nutella Nut | 9953 | 9943 | 10 |
| Awwffle | 9957 | 9953 | 4 |

### October 25 — Day 8
Daily batch notation: B2:N1:C0
Waffles sold: 38
POS sales: ৳5,153

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9991 | 9990 | 1 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9996 | 9996 | 0 |
| Chocolate Explosion | 9942 | 9934 | 8 |
| Bluelicious | 9995 | 9994 | 1 |
| Bananutella | 10000 | 9998 | 2 |
| Very Strawberry | 9995 | 9993 | 2 |
| Kit-Kat Kraze | 9979 | 9977 | 2 |
| Rustic Sweet | 9994 | 9991 | 3 |
| Midnight Oreo | 9981 | 9980 | 1 |
| Dark Night | 9978 | 9977 | 1 |
| Snowy Bliss | 9979 | 9978 | 1 |
| Unicorn Bliss | 9986 | 9984 | 2 |
| Nutella Nut | 9943 | 9931 | 12 |
| Awwffle | 9953 | 9950 | 3 |

### October 26 — Day 9
Daily batch notation: B1:N0:C1
Waffles sold: 42
POS sales: ৳5,407

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9990 | 9990 | 0 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9996 | 9995 | 1 |
| Chocolate Explosion | 9934 | 9930 | 4 |
| Bluelicious | 9994 | 9991 | 3 |
| Bananutella | 9998 | 9997 | 1 |
| Very Strawberry | 9993 | 9991 | 2 |
| Kit-Kat Kraze | 9977 | 9975 | 2 |
| Rustic Sweet | 9991 | 9991 | 0 |
| Midnight Oreo | 9980 | 9978 | 2 |
| Dark Night | 9977 | 9969 | 8 |
| Snowy Bliss | 9978 | 9978 | 0 |
| Unicorn Bliss | 9984 | 9983 | 1 |
| Nutella Nut | 9931 | 9920 | 11 |
| Awwffle | 9950 | 9942 | 8 |

### October 27 — Day 10
Daily batch notation: B2:N1:C1
Waffles sold: 22
POS sales: ৳3,139 (corrected from the original ৳3,131)

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9990 | 9989 | 1 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9995 | 9995 | 0 |
| Chocolate Explosion | 9930 | 9922 | 8 |
| Bluelicious | 9991 | 9991 | 0 |
| Bananutella | 9997 | 9997 | 0 |
| Very Strawberry | 9991 | 9991 | 0 |
| Kit-Kat Kraze | 9975 | 9975 | 0 |
| Rustic Sweet | 9991 | 9991 | 0 |
| Midnight Oreo | 9978 | 9974 | 4 |
| Dark Night | 9969 | 9967 | 2 |
| Snowy Bliss | 9978 | 9978 | 0 |
| Unicorn Bliss | 9983 | 9980 | 3 |
| Nutella Nut | 9920 | 9916 | 4 |
| Awwffle | 9942 | 9941 | 1 |

### October 28 — Day 11
Daily batch notation: B0:N0:C0
Waffles sold: 23
POS sales: ৳2,935

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9989 | 9989 | 0 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9995 | 9995 | 0 |
| Chocolate Explosion | 9922 | 9918 | 4 |
| Bluelicious | 9991 | 9989 | 2 |
| Bananutella | 9997 | 9997 | 0 |
| Very Strawberry | 9991 | 9991 | 0 |
| Kit-Kat Kraze | 9975 | 9974 | 1 |
| Rustic Sweet | 9991 | 9991 | 0 |
| Midnight Oreo | 9974 | 9971 | 3 |
| Dark Night | 9967 | 9966 | 1 |
| Snowy Bliss | 9978 | 9978 | 0 |
| Unicorn Bliss | 9980 | 9980 | 0 |
| Nutella Nut | 9916 | 9913 | 3 |
| Awwffle | 9941 | 9932 | 9 |

### October 29 — Day 12
Daily batch notation: B2:N0:C1
Waffles sold: 33
POS sales: ৳4,363

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9989 | 9988 | 1 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9995 | 9995 | 0 |
| Chocolate Explosion | 9918 | 9914 | 4 |
| Bluelicious | 9989 | 9988 | 1 |
| Bananutella | 9997 | 9997 | 0 |
| Very Strawberry | 9991 | 9991 | 0 |
| Kit-Kat Kraze | 9974 | 9971 | 3 |
| Rustic Sweet | 9991 | 9991 | 0 |
| Midnight Oreo | 9971 | 9966 | 5 |
| Dark Night | 9966 | 9964 | 2 |
| Snowy Bliss | 9978 | 9975 | 3 |
| Unicorn Bliss | 9980 | 9978 | 2 |
| Nutella Nut | 9913 | 9909 | 4 |
| Awwffle | 9932 | 9923 | 9 |

### October 30 — Day 13
Daily batch notation: B2:N2:C1
Waffles sold: 34
POS sales: ৳4,469

| Product | Previous Stock | Current Stock | Waffles Sold |
|---|---:|---:|---:|
| Extra Banana | 10000 | 10000 | 0 |
| Extra Nut | 10000 | 10000 | 0 |
| Water 500ml | 9988 | 9987 | 1 |
| Ice Cream - Strawberry | 9999 | 9999 | 0 |
| Ice Cream - Chocolate | 10000 | 10000 | 0 |
| Ice Cream - Vanilla | 9995 | 9995 | 0 |
| Chocolate Explosion | 9914 | 9905 | 9 |
| Bluelicious | 9988 | 9987 | 1 |
| Bananutella | 9997 | 9997 | 0 |
| Very Strawberry | 9991 | 9991 | 0 |
| Kit-Kat Kraze | 9971 | 9971 | 0 |
| Rustic Sweet | 9991 | 9990 | 1 |
| Midnight Oreo | 9966 | 9964 | 2 |
| Dark Night | 9964 | 9959 | 5 |
| Snowy Bliss | 9975 | 9972 | 3 |
| Unicorn Bliss | 9978 | 9976 | 2 |
| Nutella Nut | 9909 | 9899 | 10 |
| Awwffle | 9923 | 9922 | 1 |

This contains the daily product-level previous stock, current stock, and reported units for October 17–30.

## 4.6 POS unit prices and costs

The POS has configured unit costs and selling prices for products.

These values are used to calculate:
- Total units sold.
- Total POS sales.
- Total POS cost.
- POS estimated profit.

The workbook should have a Product Master containing:
- POS item number.
- Product name.
- Category.
- Unit cost.
- Selling price.
- Active/inactive status.

The owner supplied the POS unit costs and selling prices on 1 Nov 2026. These are authoritative and are entered in the Product Master.

### 4.6.1 Supplied POS unit costs and selling prices (BDT)

Products are listed in POS order (Extra Banana → Awwffle).

| POS No | Product | Unit Cost | Selling Price |
|---:|---|---:|---:|
| 1  | Extra Banana           | 5  | 15  |
| 2  | Extra Nut              | 8  | 20  |
| 3  | Water 500ml            | 8  | 20  |
| 4  | Ice Cream - Strawberry | 20 | 35  |
| 5  | Ice Cream - Chocolate  | 20 | 35  |
| 6  | Ice Cream - Vanilla    | 20 | 35  |
| 7  | Chocolate Explosion    | 75 | 155 |
| 8  | Bluelicious            | 70 | 140 |
| 9  | Bananutella            | 60 | 140 |
| 10 | Very Strawberry        | 65 | 135 |
| 11 | Kit-Kat Kraze          | 85 | 195 |
| 12 | Rustic Sweet           | 70 | 140 |
| 13 | Midnight Oreo          | 70 | 155 |
| 14 | Dark Night             | 70 | 145 |
| 15 | Snowy Bliss            | 60 | 150 |
| 16 | Unicorn Bliss          | 60 | 130 |
| 17 | Nutella Nut            | 60 | 120 |
| 18 | Awwffle                | 50 | 99  |

Verification: applying these values to the supplied daily unit volumes reproduces the period figures exactly — product revenue sums to BDT 64,392 (gross POS sales) and product cost sums to BDT 30,659 (POS cost). The Reconciliation sheet checks this automatically.

POS-reported cost and profit are estimates based on configured POS prices. They are not automatically equivalent to actual ingredient-level COGS.

---

# 5. OCTOBER 17–30 PERIOD SUMMARY

The owner supplied the following period summary:

| Metric | Value |
|---|---:|
| First day | 17 Oct 2026 |
| Last day | 30 Oct 2026 |
| Total operating days | 13 |
| Total invoices | 182 |
| Waffles sold | 467 |
| Average waffles per invoice | 2.6 |
| Average invoice value | BDT 322 |
| Original / net sales | BDT 58,690 |
| POS cost | BDT 30,659 |
| POS profit | BDT 28,031 |
| Cash in hand | BDT 52,320 |
| Average daily sale | BDT 4,515 |
| Average selling price per waffle | BDT 126 |
| Average cost per waffle | BDT 66 |
| Average waffles per operating day | 36 |
| Discount | BDT 5,702 |
| Due | BDT 840 |
| Bazar | BDT 5,530 |

## 5.1 Important financial interpretation

The figures reconcile as follows:

Gross POS sales = BDT 64,392

Discount = BDT 5,702

Net sales = BDT 58,690

Due = BDT 840

Bazar = BDT 5,530

Expected cash:

58,690 - 840 - 5,530 = BDT 52,320

This matches the supplied cash-in-hand figure.

The workbook should preserve any difference ambiguity and flag it.

## 5.2 POS profit ambiguity

The period summary says:

POS cost = BDT 30,659
POS profit = BDT 28,031

BDT 58,690 - BDT 30,659 = BDT 28,031.

This suggests the reported POS profit is calculated from net sales.

But gross sales less POS cost would be:

BDT 64,392 - BDT 30,659 = BDT 33,733.

Preserve both calculations until the exact POS profit definition is confirmed.

Do not label an estimated POS profit as actual net business profit.

---

# 6. FINANCIAL MANAGEMENT

The financial system must separate the following.

## 6.1 Sales

Gross POS sales are the total value before discounts.

## 6.2 Discounts

Discounts reduce sales revenue.

Net Sales = Gross Sales - Discount

Discounts should be recorded separately.

## 6.3 Customer due

Due is an outstanding receivable.

It is not cash received.

Track:
- Due generated.
- Due collected.
- Outstanding due.
- Date.
- Reference or customer note, where available.

## 6.4 Bazar purchases

Bazar refers to purchases made for the business.

Examples:
- Ingredients.
- Toppings.
- Packaging.
- Cleaning supplies.
- Consumables.

These purchases should be recorded in the Purchases Log.

Do not automatically record the same bazar purchase again as a general operating expense.

## 6.5 Operating expenses

The workbook must include a separate Expense Log.

Expense categories must be expandable.

Initial categories:

- Employee salaries.
- Electricity bill.
- Maintenance bill.
- Other expenses.

Current values for these categories are BDT 0.

Expense records should support:

- Date.
- Expense category.
- Description.
- Amount.
- Payment method.
- Paid / unpaid status.
- Receipt or reference.
- Notes.

Monthly and all-time expense totals should be automatic.

## 6.6 Cash reconciliation

A basic expected cash calculation is:

Expected Cash from Sales = Net Sales - Due - Relevant Cash Outflows

However, the workbook must distinguish:
- Sales cash received.
- Bazar payments.
- General expense payments.
- Cash retained.
- Bank/mobile payments.
- Outstanding payables.

Do not subtract the same bazar or expense twice.

## 6.7 Profit calculations

The system should display separate figures:

1. Gross POS sales.
2. Discounts.
3. Net sales.
4. POS estimated cost.
5. POS estimated gross profit.
6. Recipe-based ingredient consumption.
7. Actual inventory cost, once reliable costing data is available.
8. Operating expenses.
9. Estimated operating profit.

Do not claim that POS profit is the actual net profit of the business.

---

# 7. PRODUCTION MANAGEMENT

The business tracks production using batches.

A batch log records how many batches of each mixture were prepared on a given date.

The workbook should use numeric columns rather than requiring the owner to type and parse a text code.

## 7.1 Batch notation

The owner sometimes uses notation such as:

B2:N2:C1:W0

Meaning:

- B2 = 2 Batter batches.
- N2 = 2 Nutella Mix batches.
- C1 = 1 Cream batch.
- W0 = 0 White Mix batches.

The spreadsheet should use separate numeric fields.

The notation may be retained as a human-readable note, but it should not be the primary data structure.

## 7.2 Daily production records

| Date | Batter | Nutella Mix | Cream | White Mix | Cheese |
|---|---:|---:|---:|---:|---:|
| Oct 14 | 0.5 | 1 | 1 | 1 | 1 |
| Oct 16 | 1.5 | 1 | 0 | 0 | 0 |
| Oct 17 | 1 | 1 | 0 | 0 | 0 |
| Oct 18 | 1 | 1 | 0 | 0 | 0 |
| Oct 19 | 2 | 2 | 1 | 0 | 0 |
| Oct 20 | 1 | 1 | 0 | 0 | 0 |
| Oct 21 | 2 | 2 | 1 | 0 | 0 |
| Oct 23 | 1 | 0 | 0 | 0 | 0 |
| Oct 24 | 2 | 2 | 1 | 0 | 0 |
| Oct 25 | 2 | 2 | 0 | 0 | 0 |
| Oct 26 | 1 | 0 | 1 | 0 | 0 |
| Oct 27 | 2 | 2 | 1 | 0 | 0 |
| Oct 28 | 0 | 0 | 0 | 0 | 0 |
| Oct 29 | 2 | 0 | 1 | 0 | 0 |
| Oct 30 | 2 | 2 | 1 | 0 | 0 |

Important:
- October 14 and October 16 were training/trial days.
- They had ingredient consumption even though regular sales had not started.
- Training and trial production must be included in ingredient usage and costing.
- October 22 is absent from the supplied production data since it was a off day.
- For now Awwffle will have Wednesday off in every week, later it can vary.
- Do not assume that zero recorded production means zero ingredient consumption.

Batter prepared on one day may be carried over and used on the following day. We do not discard leftover batter before the end of the second day, but we never carry it over to a third day.

This means the production log records newly prepared batches, not necessarily all the batter used for sales on that date. For example, if we have leftover batter from the previous day, we may sell waffles without preparing a new batter batch. In that case, the production log can correctly show zero new batter production even though waffles were sold.

October 28 is an example:
- New production batches recorded: zero.
- Waffles sold: 23.
- Reason: batter prepared earlier was carried over and used.

The inventory and production system must account for this carryover. It must not automatically flag a day as incorrect simply because waffles were sold with zero new batter production.

The same principle should be considered when designing production and ingredient-consumption calculations. Newly prepared batches and actual batches consumed are not always the same thing.

White Mix and Cheese batches were prepared only during training/trial production. They were not used for regular commercial sales during the October 17–30 period. They may be used in future operations, so their recipes and batch types should remain in the system, but their regular production and consumption should remain zero until they are actually used.

The production table originally displayed these totals:

The original production table displayed incorrect totals. The correct totals, calculated from the individual daily entries, are:

- Batter: 21 batches
- Nutella Mix: 17 batches
- Cream: 8 batches
- White Mix: 1 batch
- Cheese: 1 batch

The number 15 was the total number of calendar dates/production-log entries considered in the original table, not the total number of Batter batches.

These totals must be calculated from the individual daily production records rather than manually typed or copied from an incorrect summary.

---

# 8. RECIPE / BILL OF MATERIALS

The following recipes were provided.

Recipe quantities are in grams except where an ingredient is countable or the original unit is uncertain.

Each recipe row should be represented as:

Batch Type | Ingredient | Quantity per Batch | Unit

## 8.1 Batter

| Ingredient | Quantity | Unit |
|---|---:|---|
| Flour | 500 | g |
| Corn Flour | 150 | g |
| Sugar | 100 | g |
| Salt | 6 | g |
| Baking Powder | 10 | g |
| Baking Soda | 6 | g |
| Egg | 6 | pcs |
| Milk | 1,000 | g (as supplied; verify) |
| Butter | 150 | g |
| Vanilla | 10 | g |

## 8.2 Nutella Mix

| Ingredient | Quantity | Unit |
|---|---:|---|
| Oil | 750 | g |
| Butter | 120 | g |
| Nutella | 175 | g |
| Milk Chocolate | 550 | g |

## 8.3 White Mix

| Ingredient | Quantity | Unit |
|---|---:|---|
| Oil | 500 | g |
| Butter | 150 | g |
| White Chocolate | 500 | g |

## 8.4 Cream

| Ingredient | Quantity | Unit |
|---|---:|---|
| Icing Sugar | 50 | g |
| Whipped Cream | 500 | g |

## 8.5 Missing recipes

The following ingredients or batch types need further information:

- Dark Chocolate: purchased and consumed, but no recipe composition supplied.
- Cream Cheese: manual consumption supplied, but no recipe composition supplied.
- Cheese batch: production quantity supplied, but recipe composition missing.
- Direct toppings: KitKat, Oreo, almond varieties, fillings, syrup, etc. No complete per-product recipe/BOM supplied.

Do not assume these ingredients have zero usage.

The recipe system should allow new batch types and ingredients to be added later.

---

# 9. BAZAR / PURCHASE DATA

The following purchases were supplied.

Amounts are in Bangladeshi Taka (BDT).

| Item | Purchased Quantity | Purchase Unit | Unit Rate | Total |
|---|---:|---|---:|---:|
| Nutella 350g Jar | 12 | pcs | 830 | 9,960 |
| Dark Chocolate (Bluebell) | 5 | kg | 560/kg | 2,800 |
| Milk Chocolate (Bluebell) | 15 | kg | 590/kg | 8,850 |
| White Chocolate (Bluebell) | 1 | kg | 560/kg | 560 |
| Tropical Whipped Cream | 7 | pcs | 215 | 1,505 |
| Butter Zoya | 14.5 | kg | 480/kg | 6,960 |
| Sis Icing Sugar | 1 | kg | 700/kg | 700 |
| Vanilla Redman | 500 | g | 2,600/kg | 1,300 |
| Baking Soda | 200 | g | 60/kg | 12 |
| Baking Powder | 500 | g | 450/kg | 225 |
| Corn Flour | 8 | kg | 190/kg | 1,520 |
| Flour | 10.5 | kg | 60/kg | 630 |
| Sugar | 5 | kg | 106/kg | 530 |
| Salt | 2 | kg | 38/kg | 76 |
| Oil | 15 | L | 200/L | 3,000 |
| Egg | 126 | pcs | 11 | 1,386 |
| Milk | 21 | L | 80/L | 1,680 |
| KitKat (4 fingers) | 15 | pcs | 70 | 1,050 |
| Oreo | 10 | pcs | 28 | 280 |
| Almond Slice | 1 | kg | 1,800/kg | 1,800 |
| Almond Nut | 1 | kg | 1,400/kg | 1,400 |
| Kaju Badam | 1 | kg | 1,300/kg | 1,300 |
| Blueberry Filling | 500 | g | 1,400/kg | 700 |
| Strawberry Filling | 500 | g | 1,400/kg | 700 |
| Hershey's Chocolate Syrup | 5 | pcs | 250 | 1,250 |

## 9.1 Additional consumables and inventory items

| Item | Quantity | Unit | Rate | Total |
|---|---:|---|---:|---:|
| Tissue | 2 | pcs | 55 | 110 |
| Aerosol Spray | 0 | pcs | 8 | 0 |
| Room Freshener | 1 | pcs | 300 | 300 |
| White Poly Bag | 1 | kg | 200 | 200 |
| One Time Box | 60 | pcs | 5 | 300 |
| Water | 24 | pcs | 8 | 192 |
| Ice Cream - Vanilla | 0 | kg | 0 | 0 |
| Ice Cream - Chocolate | 0 | kg | 0 | 0 |
| Ice Cream - Strawberry | 0 | kg | 0 | 0 |

There must be exactly one record for each of the three ice cream flavours.

The original source accidentally repeated vanilla ice cream. The corrected master list must not contain a duplicate.

## 9.2 Packaging and serving materials

| Item | Quantity | Unit | Rate | Total |
|---|---:|---|---:|---:|
| Waffle Sticks Large | 1,000 | pcs | 1.3 | 1,300 |
| Waffle Box | 1,200 | pcs | 5 | 6,000 |
| Waffle Tray | 1,200 | pcs | 5.9 | 7,080 |

These must be tracked as countable inventory items.

The workbook should track:
- Purchased quantity.
- Unit purchase cost.
- Total purchase value.
- Quantity consumed.
- Current quantity.
- Reorder level.
- Estimated days remaining.

---

# 10. UNIT MANAGEMENT

The owner wants consistent measurement across the entire workbook.

## 10.1 Mass

Use grams (g) as the standard unit for weight-based inventory.

Conversion:

1 kg = 1,000 g

Examples:
- 5 kg = 5,000 g.
- 500 g = 500 g.
- 14.5 kg = 14,500 g.

All recipe quantities and weight-based stock quantities should use grams.

## 10.2 Countable items

Some items cannot meaningfully be tracked in grams for day-to-day inventory.

The owner explicitly clarified that "p" means piece.

Use pcs as the base unit for:
- Water bottles.
- Tissues.
- Aerosol cans.
- One-time boxes.
- Waffle boxes.
- Waffle trays.
- Waffle sticks.
- Eggs, where count is the natural measurement.
- Other discrete products.

Do not invent gram weights for these items.

## 10.3 Liquid conversions

Some purchases are in litres, while recipes or usage are expressed in grams.

Examples:
- Oil purchased in litres, recipe in grams.
- Milk purchased in litres, recipe in grams.

Do not automatically assume 1 litre = 1,000 grams.

Use a configurable conversion table.

Only convert when the actual density or measured weight is confirmed.

## 10.4 Packaging conversion

White Poly Bag was purchased in kg.

It should be tracked as grams for weight-based stock.

Waffle boxes, trays, and sticks remain pcs.

## 10.5 Original purchase data

Always preserve:
- Original quantity.
- Original purchase unit.
- Original unit rate.
- Original purchase amount.

Normalized quantities should be stored separately.

Never discard the original source values.

---

# 11. MANUAL INGREDIENT USAGE AND REMAINING STOCK

The owner also supplied a manually calculated usage and remaining-stock table.

This data must be preserved independently from recipe-derived consumption.

| Ingredient | Used | Purchased | Remaining | Unit |
|---|---:|---:|---:|---|
| Flour | 10,500 | 10,500 | 0 | g |
| Corn Flour | 3,150 | 8,000 | 4,850 | g |
| Sugar | 2,100 | 5,000 | 2,900 | g |
| Salt | 126 | 2,000 | 1,874 | g |
| Baking Powder | 210 | 500 | 290 | g |
| Baking Soda | 126 | 200 | 74 | g |
| Egg | 126 | 126 | 0 | pcs |
| Milk | 21,000 | 21,000 | 0 | g |
| Oil | 13,250 | 15,000 | 1,750 | g |
| Butter | 5,340 | 14,500 | 9,160 | g |
| Vanilla | 210 | 500 | 290 | g |
| Nutella | 2,975 | 4,200 | 1,225 | g |
| White Chocolate | 500 | 1,000 | 500 | g |
| Dark Chocolate | 1,000 | 5,000 | 4,000 | g |
| Milk Chocolate | 9,350 | 15,000 | 5,650 | g |
| Icing Sugar | 400 | 1,000 | 600 | g |
| Whipped Cream | 4,000 | 7,000 | 3,000 | g |
| Cream Cheese | 175 | 500 | 325 | g |
| KitKat | 14 | 15 | 1 | pcs |
| Oreo | 9 | 10 | 1 | pcs |
| Almond Slice | 600 | 1,000 | 400 | g |
| Almond Nut | Not supplied | Not supplied | Not supplied | g |
| Kaju Badam | Not supplied | Not supplied | Not supplied | g |
| Blueberry Filling | Not supplied | Not supplied | Not supplied | g |
| Strawberry Filling | Not supplied | Not supplied | Not supplied | g |
| Hershey's Chocolate Syrup | Not supplied | Not supplied | Not supplied | pcs |

Important:
- Some values are manually reported.
- They may include training, wastage, extra usage, or other activities.
- They are not guaranteed to match theoretical recipe consumption.
- Preserve them as manual records.
- Do not force recipe-derived usage to equal manual usage.

There are unit differences between purchase records and manual stock records.

For example:
- Oil purchase: 15 L; manual stock: 15,000 g.
- Milk purchase: 21 L; manual stock: 21,000 g.
- Nutella purchase: 12 jars; manual stock: 4,200 g.
- Whipped cream purchase: 7 pieces; manual stock: 7,000 g.

These conversions need verification.

---

### Standard inventory units

For inventory tracking, use only two base units wherever possible:

- Weight-based ingredients and materials: grams (g)
- Countable items: pieces (pcs)

This includes liquids such as milk and oil. For this workbook, I am comfortable using the following conversion assumption:

1 litre = 1 kilogram = 1,000 grams.

Therefore:
- 1 L milk = 1,000 g
- 1 L oil = 1,000 g

Use grams as the normalized inventory unit for milk and oil instead of litres.

All purchase records must preserve the original purchase quantity and unit as entered, but the workbook should also calculate a normalized quantity in grams or pcs for inventory calculations.

Examples:
- 15 L oil → 15,000 g
- 21 L milk → 21,000 g
- 1 kg flour → 1,000 g
- 500 g chocolate → 500 g
- 15 KitKat pieces → 15 pcs

Do not mix kg, g, L, ml, or pcs in the main inventory calculations. Convert quantities to the appropriate base unit before calculating stock, consumption, costs, and remaining inventory.

Keep the original purchase unit and quantity available for historical reference.

---

### Variable purchase prices and historical unit costs

The purchase price of an item is not fixed permanently. The same ingredient or product may be purchased at different unit prices on different dates.

For example:
- KitKat may cost ৳70 per piece in one purchase.
- A later purchase may cost ৳80 per piece.

The workbook must never assume that an item has one permanent purchase price.

Every purchase must be recorded as an independent historical transaction, including:

- Purchase date
- Item name / Item ID
- Supplier (if available)
- Quantity purchased
- Original purchase unit
- Normalized quantity (g or pcs)
- Total purchase amount
- Unit purchase price
- Payment method
- Notes or reference

The unit price should be calculated from each individual purchase:

Unit Price = Total Purchase Amount ÷ Purchased Quantity

For inventory valuation and ingredient costing, the system should support a proper costing method that accounts for changing purchase prices.

A recommended approach is weighted average cost, where the average cost is recalculated as new purchases are added:

Weighted Average Unit Cost =
(Total Value of Existing Stock + Value of New Purchase)
÷
(Total Existing Quantity + New Purchase Quantity)

However, the system should retain every original purchase transaction and its actual unit price. Never overwrite an older purchase price when a new purchase is made.

This historical purchase data should allow the business to:
- See how the price of an ingredient changed over time.
- Compare supplier prices.
- Calculate the cost of ingredients using an appropriate inventory valuation method.
- Recalculate recipe costs when ingredient prices change.
- Review how much an item cost during a particular day, week, or month.

For example, a KitKat purchased at ৳70 and another purchased later at ৳80 must remain two separate purchase records. The workbook should not replace the old ৳70 price with ৳80.

---

### Bazar tracking and purchase history

Bazar is not necessarily one fixed daily or monthly expense amount. It represents the actual purchases made, and it may consist of many individual items purchased at different times.

The workbook must therefore use an item-based purchase log instead of relying only on a manually entered daily or monthly Bazar total.

Every time an item is purchased, I will enter its purchase details into the Purchases sheet. The workbook should automatically calculate the total purchase amount from those individual records.

For example, a single bazar trip may include:
- Flour
- Sugar
- Butter
- Nutella
- Milk chocolate
- Eggs
- Packaging materials
- Other ingredients or consumables

Each item must have its own purchase record, quantity, unit, unit price, and total amount.

The system should support multiple purchases on the same day and purchases on different dates.

It must provide:
- Daily purchase totals.
- Weekly purchase totals.
- Monthly purchase totals.
- All-time purchase totals.
- Item-wise purchase history.
- Date-wise purchase history.
- Historical unit price comparisons.
- Supplier-wise purchase history, if supplier details are available.

The monthly Bazar amount should be calculated automatically by summing all purchase transactions recorded during that month.

For example:

Monthly Bazar =
Sum of all individual purchase amounts recorded during that month.

Do not require me to manually enter a single monthly Bazar amount if the individual purchase records already exist.

Historical purchase records must never be overwritten or deleted just because a new month starts. This is important because I may need to backtrack at the end of a month to verify:
- What was purchased.
- When it was purchased.
- How much quantity was purchased.
- How much each item cost.
- How much money was spent in total.
- Whether the reported Bazar amount matches the actual purchase records.

The workbook should also distinguish between:
1. Purchases made for ingredients and inventory.
2. Purchases made for packaging and consumables.
3. Operating expenses such as salaries, electricity, and maintenance.

Bazar purchases must not be counted again as operating expenses if they are already recorded in the Purchases sheet.

The purchase log is the source of truth for Bazar and purchasing history. Daily, weekly, and monthly financial summaries should derive their purchase totals from this log.

---

# 12. ESTIMATED INVENTORY DAYS REMAINING

The owner supplied these estimates:

| Ingredient | Estimated Days Remaining |
|---|---:|
| Flour | 0 |
| Corn Flour | 23 |
| Sugar | 21 |
| Salt | 223 |
| Baking Powder | 21 |
| Baking Soda | 9 |
| Egg | 0 |
| Milk | 0 |
| Oil | 2 |
| Butter | 26 |
| Vanilla | 21 |
| Nutella | 6 |
| White Chocolate | 15 |
| Dark Chocolate | 60 |
| Milk Chocolate | 9 |
| Icing Sugar | 23 |
| Whipped Cream | 11 |
| Cream Cheese | 28 |
| KitKat | 1 |
| Oreo | 2 |
| Almond Slice | 10 |

Other items have no supplied estimate.

These are owner-provided estimates, not independently calculated forecasts.

The workbook should preserve these values as initial estimates.

Eventually, calculate dynamic forecasts using:

Estimated Days Remaining =
Current Stock / Average Daily Consumption

However:
- Use actual tracked consumption.
- Account for production days.
- Account for off days.
- Include training/trial production where relevant.
- Do not use zero-consumption periods to create misleading forecasts.
- Distinguish "out of stock" from "forecast unavailable".
- If the average consumption is zero or unavailable, show an appropriate status instead of an invented number.

---

# 13. INVENTORY MANAGEMENT REQUIREMENTS

The inventory system should handle more than food ingredients.

Suggested categories:

1. Main ingredients.
2. Chocolate and toppings.
3. Fillings and syrups.
4. Ice cream.
5. Packaging.
6. Serving materials.
7. Cleaning supplies.
8. Consumables.
9. Resale products.
10. Other inventory.

For every item, where applicable, maintain:

- Unique item ID.
- Canonical name.
- Category.
- Base unit.
- Opening quantity.
- Purchases.
- Production consumption.
- Direct consumption.
- Sales consumption.
- Wastage.
- Adjustments.
- Closing quantity.
- Unit cost.
- Stock value.
- Reorder level.
- Estimated days remaining.
- Last purchase date.

A physical stocktake should be supported.

The workbook should compare:

Calculated Stock vs Physical Stock

Variance should be visible.

Do not assume that recipe calculations represent actual physical stock consumption.

---

# 14. DASHBOARDS AND REPORTING

The workbook should contain an executive dashboard and supporting reports.

## 14.1 Daily dashboard

Display:
- Date.
- Operating status.
- Total waffles sold.
- Total units sold.
- Invoice count.
- Average waffles per invoice.
- Gross POS sales.
- Discount.
- Net sales.
- Due.
- Bazar purchases.
- Operating expenses.
- Expected cash.
- POS estimated cost.
- POS estimated profit.
- Production batches.
- Inventory alerts.

## 14.2 Monthly dashboard

Display:
- Month.
- Operating days.
- Off days.
- Total invoices.
- Total waffles sold.
- Total product units sold.
- Gross sales.
- Discounts.
- Net sales.
- Due generated.
- Due collected.
- Outstanding due.
- Purchases.
- Operating expenses.
- POS estimated cost.
- POS estimated profit.
- Ingredient consumption.
- Average daily sales.
- Average waffles per day.
- Average invoice value.
- Top-selling products.
- Slow-moving products.
- Inventory alerts.

## 14.3 All-time dashboard

Show lifetime performance using the same underlying data.

The all-time view should begin from the original baseline stock setup, where POS products were initially set to 10,000.

Monthly reports should use the previous month's closing stock as the next month's opening stock.

Do not create separate disconnected data sources for each month.

## 14.4 Product performance

Show:
- Units sold by product.
- Revenue by product.
- Estimated cost by product.
- Estimated profit by product.
- Percentage contribution to sales.
- Top products.
- Lowest-selling products.

## 14.5 Inventory dashboard

Show:
- Current stock.
- Stock value.
- Daily consumption.
- Average daily consumption.
- Estimated days remaining.
- Reorder alerts.
- Out-of-stock items.
- Physical stocktake variance.

## 14.6 Financial dashboard

Show:
- Gross revenue.
- Discounts.
- Net revenue.
- Due.
- Cash collected.
- Purchases.
- Operating expenses.
- POS estimated cost.
- Actual COGS when available.
- Estimated operating profit.
- Cash movement.

All dashboard figures must be linked to the underlying logs.

---

# 15. SUGGESTED WORKBOOK ARCHITECTURE

Build one integrated workbook with the following logical sheets.

The exact sheet count may be optimized, but the responsibilities should remain clear.

## 15.1 START HERE / README

Explain:
- Workbook purpose.
- Daily workflow.
- Data entry instructions.
- Naming conventions.
- Unit rules.
- Formula/input distinction.
- How to add new products and ingredients.
- How to use dashboards.
- Known limitations.

## 15.2 Executive Dashboard

High-level business KPIs.

## 15.3 Item Master

Canonical item names, IDs, categories, units, and active status.

## 15.4 Product Master

POS products, item numbers, unit costs, selling prices, and categories.

## 15.5 POS Raw Data

Immutable imported daily POS snapshots.

## 15.6 Sales Log

Formula-derived product sales from POS snapshots.

## 15.7 Daily Finance

Daily sales, discounts, due, purchases, cash, and operating totals.

## 15.8 Period Summary

Preserve and reconcile historical aggregate reports.

## 15.9 Production Log

Daily production batch quantities.

## 15.10 Recipes / BOM

Batch recipes and ingredient quantities.

## 15.11 Purchases

Bazar and inventory purchases.

## 15.12 Expense Log

Salaries, electricity, maintenance, and future expense categories.

## 15.13 Inventory

Ingredient and consumable stock management.

## 15.14 Packaging Stock

Packaging and serving materials measured in pieces.

## 15.15 Unit Conversions

Verified conversion factors for litres, jars, packs, and other nonstandard purchase units.

## 15.16 Stocktake / Adjustments

Physical stock counts, wastage, corrections, and variances.

## 15.17 Lists / Settings

Dropdown values, categories, units, financial settings, and configuration.

The workbook should avoid unnecessary duplication of data.

---

# 16. DAILY WORKFLOW — KEEP IT SIMPLE

The system must be designed around minimal daily data entry.

Ideally, the owner should only need to:

### Step 1: Import POS

Paste the daily POS stock report into POS Raw Data.

The workbook calculates:
- Units sold.
- Product revenue.
- Estimated cost.
- Estimated product profit.
- Daily totals.

### Step 2: Enter daily financial information

Enter:
- Invoice count.
- Discount.
- Due generated or collected, as applicable.
- Bazar purchase total if it is not already calculated from purchase entries.
- Any additional daily financial information.

Avoid entering the same purchase amount twice.

### Step 3: Enter production batches

Enter the number of batches prepared:

- Batter.
- Nutella Mix.
- Cream.
- White Mix.
- Cheese.
- Future batch types.

### Step 4: Enter purchases

Record new purchases with:
- Date.
- Item.
- Quantity.
- Unit.
- Rate.
- Total.
- Supplier or receipt reference, if available.

### Step 5: Enter expenses

Record salary, electricity, maintenance, and other expenses.

### Step 6: Review dashboard

The workbook should update automatically.

Daily data entry should be straightforward enough that the business can maintain it consistently.

---

# 17. DATA RECONCILIATION AND ERROR CHECKS

This is a critical requirement.

The workbook should actively identify inconsistencies.

## POS checks

- Sum of product sales vs daily POS total.
- Previous stock vs previous day's closing stock.
- POS reported units vs calculated stock movement.
- Missing or duplicated product/date rows.
- Unexpected stock increases.
- Product names not found in master list.

## Production checks

- Batch totals vs individual production records.
- Sales on days with zero recorded production.
- Missing production dates.
- Training and trial production included in ingredient usage.

## Ingredient checks

- Recipe-derived usage vs manually reported usage.
- Purchases vs stock remaining.
- Unit conversion mismatches.
- Missing recipe definitions.
- Physical stocktake vs calculated stock.

## Financial checks

- Gross sales less discount equals net sales.
- Net sales less due and relevant cash outflows reconciles to expected cash.
- Daily sales sum vs period summary.
- Bazar purchases are not double-counted as expenses.
- POS estimated profit is not mislabeled as actual net profit.

Every unresolved mismatch should be visible.

Do not silently adjust source data to make totals match.

---

# 18. KNOWN DATA GAPS AND ITEMS REQUIRING CONFIRMATION

The workbook must be useful immediately while clearly identifying unresolved information.

The following items remain open.

1. POS unit costs and selling prices — supplied 1 Nov 2026 and entered in Product Master (see 4.6.1). Confirm they still match the current POS configuration.
2. Complete daily product-level POS history must be imported from the original attachment.
3. Daily invoice counts are not supplied.
4. Daily discounts are not supplied.
5. Daily due breakdowns are not supplied.
6. Daily bazar allocations are not supplied.
7. The period POS sale total differs from the daily total by BDT 8.
8. The exact definition of POS-reported profit needs confirmation.
9. Milk's recipe quantity is supplied as 1,000 g; confirm measurement basis.
10. Egg quantity is 6 pcs per Batter batch; confirm.
11. Oil density/conversion from litres to grams needs verification.
12. Milk density/conversion from litres to grams needs verification.
13. Nutella jar net weight needs confirmation.
14. Whipped cream pack weight needs confirmation.
15. Dark Chocolate recipe composition is missing.
16. Cream Cheese recipe composition is missing.
17. Cheese batch composition is missing.
18. Direct topping recipes are missing.
19. October 28 production reports zero batches despite 23 waffles sold.
20. October 22 is missing from supplied production and sales records.
21. Actual opening stock and physical stocktake values should be verified.
22. Packaging consumption data has not yet been supplied.
23. Reorder levels have not yet been supplied.
24. Salary, electricity, and maintenance expenses are currently BDT 0.
25. The purchase record for Water should be mapped to the appropriate POS product if they are the same item.
26. White Poly Bag is purchased by kg and should be tracked by weight.
27. Ice cream purchase quantities are currently zero.
28. Some manual ingredient records are incomplete.

Do not invent missing values.

Where necessary, leave an input blank and display a clear status such as:
- Not supplied.
- Needs confirmation.
- No stocktake.
- No recipe defined.
- Conversion required.
- Forecast unavailable.

---

# 19. TECHNICAL AND DESIGN REQUIREMENTS

The workbook should follow professional spreadsheet engineering practices.

## 19.1 Formula design

Prefer:
- Excel Tables / structured references.
- Expandable data ranges.
- SUMIFS.
- COUNTIFS.
- XLOOKUP or INDEX/MATCH where appropriate.
- Data validation.
- Conditional formatting.
- Pivot tables or formula-based dashboards.
- Clear formula/input separation.

For Google Sheets compatibility, use formulas supported by Google Sheets or provide compatible alternatives.

Avoid:
- Fragile fixed ranges.
- Repeated manual formulas.
- Excessive volatile functions.
- Hardcoded month-specific formulas.
- Duplicated source data.
- Complex formulas that are difficult to maintain.

## 19.2 Data entry design

Use a consistent visual language:

- Input cells: clearly distinguishable.
- Formula cells: visually distinct and protected where possible.
- Headers: consistent.
- Dates: consistent date format.
- Currency: BDT.
- Weight: grams.
- Countable items: pcs.

Add instructions at the top of sheets.

## 19.3 Performance

The workbook should remain responsive as the business grows.

Avoid formulas that recalculate huge unnecessary ranges.

Use a normalized transaction structure instead of separate sheets for every month.

## 19.4 Auditability

Preserve raw source data.

Keep calculated values separate from manually entered values.

Use transaction dates and unique IDs.

Do not delete historical transactions when correcting mistakes.

Use adjustment or correction records.

## 19.5 Protection

Where supported:
- Protect formula columns.
- Leave input cells editable.
- Avoid accidental overwriting of raw data.
- Clearly identify cells that should not be edited.

---

# 20. BUSINESS CONTEXT AND LONG-TERM DIRECTION

Awwffle is intended to become a sustainable business.

The owner wants to understand the business properly before expanding.

The management system should help answer practical questions:

- Is the business actually profitable?
- Which products contribute the most?
- Which products have weak margins?
- Are ingredient costs increasing?
- Is wastage too high?
- Are purchases being made efficiently?
- Which ingredients need urgent replenishment?
- Are packaging costs affecting margins?
- How much cash is being generated?
- Are outstanding dues increasing?
- How much does the business spend each month?
- Is the operation becoming more efficient over time?

The system should support future growth, but it must remain simple enough for a single outlet today.

Do not build an unnecessarily complicated enterprise system.

Build a robust foundation that can scale when the business grows.

---

# 21. INSTRUCTIONS TO THE AI ASSISTANT RECEIVING THIS DOCUMENT

You are helping design and build the Awwffle business management system.

Treat this document as the main project specification and business context.

Follow these instructions:

1. Do not ask the owner to repeat information already included here.
2. Preserve all supplied figures and original units.
3. Do not invent missing figures.
4. Do not silently correct discrepancies.
5. Keep one canonical name per item.
6. Do not create duplicate ice cream flavours.
7. Use grams for mass-based calculations.
8. Use pcs for countable items.
9. Do not assume litre-to-gram conversion without verified density.
10. Preserve historical POS snapshots.
11. Include training/trial production in ingredient usage.
12. Keep purchases separate from operating expenses.
13. Keep due separate from cash received.
14. Keep POS estimated profit separate from actual business profit.
15. Use a scalable master-data architecture.
16. Keep daily data entry minimal.
17. Use one underlying data source for daily, monthly, and all-time reports.
18. Build reconciliation checks into the system.
19. Explain any assumptions before implementing them.
20. Prioritize accuracy, maintainability, and usability over visual complexity.

## Current task

The owner has decided that enough initial information has been provided to proceed with building the workbook.

The next deliverable should be a complete, optimized Excel workbook that can also be imported into Google Sheets.

Do not generate a superficial template.

The workbook should include the available historical data, formulas, dashboards, inventory structure, production records, recipes, purchases, financial logs, and reconciliation checks.

Before considering the workbook finished:
- Verify that the supplied historical data is included.
- Verify formulas.
- Verify canonical names.
- Verify that the three ice cream flavours appear exactly once.
- Verify that new items can be added without rebuilding the system.
- Verify that historical POS records are preserved.
- Verify that financial figures are not double-counted.
- Document any remaining information that needs confirmation.

The owner may provide additional information later, so the workbook must remain expandable.

---

# END OF MASTER CONTEXT