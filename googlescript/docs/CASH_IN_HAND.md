# Cash in hand

A daily snapshot of **where the money physically sits**, reconciled against the
system's `Cash in Hand`.

Open it from **Awwffle → Daily entry → Record cash in hand**.

## The maths

```
System Cash in Hand = (Gross Sales − Discount) − outstanding Due − Bazar   (all time)

Physical Holding    = notes at home + bKash + Bank + Cash Counter
Extra               = Physical Holding − System Cash in Hand
```

- `Extra < 0` → the owner is short; they must put that amount in.
- `Extra > 0` → the owner has put in extra.
- `Extra = 0` → the physical count matches the system exactly.

The system figure is taken from `getDailyWaffles_` with no range, so it is exactly
the number the **Daily Waffles** tab shows. Nothing here re-implements that formula.

## Opening the form

The form opens on **today's date filled with your latest saved holding** — the
same figures you would get by picking the most recent day — so you do not
re-count notes every day. Adjust whatever changed and save; that writes a **new
row for today** and leaves every earlier row exactly as it was.

A note above the boxes says which day the starting figures came from.

Two other cases:

- **Pick a date that already has a row** → that row loads with its own figures
  and its own note, and saving corrects it in place.
- **Pick a gap date with no row** → you start from the newest holding on or
  before that date, and saving adds a row for it.

The note box is never carried forward: a note describes the day it was written
on, so a new day starts with an empty note.

## The sheet

`CashInHand` holds one row per date (saving the same date corrects it):

| Column | Meaning |
|---|---|
| `Cash ID` | generated ID |
| `Date` | the day (no future dates) |
| `Count 1000` … `Count 5` | note counts (whole numbers ≥ 0) |
| `Bkash` | bKash balance that day |
| `Bank` | bank balance that day |
| `Cash Counter` | shop counter / drawer balance |
| `System Cash in Hand` | snapshot of the system figure at save time |
| `Notes` | optional |
| `Entered At` | timestamp |

Only the entered figures and the system snapshot are stored. `Cash Holding`,
`Total Holding` and `Extra` are derived on read, so the sheet can never disagree
with itself.

## Code map

| File | Role |
|---|---|
| `15_CashInHand.gs` | read/write the snapshot, `notesTotal_`, `physicalTotal_`, `extraOf_`, `systemCashInHand_` |
| `ui/Sidebar_CashInHand.html` | the form and live totals |
| `14_Menu.gs` | Daily entry → Record cash in hand |
| `00_Config.gs` / `03_Schema.gs` | sheet name, columns, setup ordering |
| `99_Tests.gs` | `testCashInHand` |
