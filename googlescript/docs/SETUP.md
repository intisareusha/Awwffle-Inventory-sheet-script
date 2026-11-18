# Awwffle — First-time setup

This installs Phase 2 (data model and configuration). Later phases add entry
forms and calculations on top; you paste new files and re-run setup, and nothing
you have entered is lost.

---

## What you need

- A Google account.
- This repository, so you can copy the code.
- **A blank Google Sheet.** Create one and name it `Awwffle DEV` for now. Do not
  point this at your real data yet — Phase 3 imports the history, and you will
  want to test on a copy first.

---

## Steps

### 1. Create the blank sheet

In Google Drive: **New → Google Sheets → Blank spreadsheet**, then rename it
`Awwffle DEV`.

### 2. Open the script editor

In the sheet: **Extensions → Apps Script**.

A new tab opens with a file called `Code.gs` containing an empty `myFunction`.

### 3. Delete the placeholder

Click `Code.gs` in the left file list, then **⋮ → Delete**. Confirm if asked.

### 4. Create the files

For each file below, in the Apps Script editor:

1. Click **+** next to **Files**.
2. Choose **Script** (for `.gs`) or **HTML** (for `.html`).
3. Name it **exactly** as shown, **without** the extension — Apps Script adds it.
4. Paste the whole file contents from the repository.
5. Save (Ctrl+S / Cmd+S).

**Paste in this order.** The order does not affect whether it runs (Apps Script
loads everything together), but it makes the editor readable.

| # | File name in Apps Script | Contents from |
|---|---|---|
| 1 | `00_Config` | `googlescript/00_Config.gs` |
| 2 | `01_Utils` | `googlescript/01_Utils.gs` |
| 3 | `02_ItemMaster` | `googlescript/02_ItemMaster.gs` |
| 4 | `03_Schema` | `googlescript/03_Schema.gs` |
| 5 | `03b_PosProducts` | `googlescript/03b_PosProducts.gs` |
| 6 | `03c_MeasurementsSeed` | `googlescript/03c_MeasurementsSeed.gs` |
| 7 | `04_Setup` | `googlescript/04_Setup.gs` |
| 8 | `14_Menu` | `googlescript/14_Menu.gs` |
| 9 | `99_Tests` | `googlescript/99_Tests.gs` |

> **Why the numbers?** Apps Script has no folders, so a numeric prefix is the
> only way to keep related files adjacent and the paste order obvious.

### 5. Save and reload the spreadsheet

Press **Ctrl+S**, then go back to the spreadsheet tab and **reload the page**.
The Awwffle menu appears after reload, because `onOpen` runs when the sheet opens.

### 6. Run the tests first

In the Apps Script editor, choose `runAllTests` from the function dropdown and
click **Run**.

- The first run asks for authorisation. Choose your account → **Advanced** →
  **Go to (project name) (unsafe)** → **Allow**. This is normal for personal
  scripts Google has not reviewed.
- Look at **Execution log**. You want **106 passed, 0 failed**.

At this point no sheet has been touched — the tests only check the code itself.

### 7. Run setup

Choose `runSetup` from the function dropdown and click **Run**.

You should see a toast: *"Setup complete. 16 created, 0 unchanged, 7 seeded"*.

### 8. Check the result

Your sheet now has these tabs, in this order:

`Settings · ExpenseTypes · ItemMaster · Measurements · Batches · Bazar ·
POS_Products · POS_Snapshots · PriceHistory · Invoices · DiscountDue ·
ClosedDays · Adjustments · Stock · DailyWaffles · AllTime`

Confirm:

- **ItemMaster** has **43 rows**, starting with `Flour` and ending with `POS Roll`.
- **Measurements** has **17 rows**; `Empty Container` is **not** there.
- **POS_Products** has **18 rows**, starting with `Extra Banana` and ending with
  `Awwffle`.
- **Settings** has `opening_cutoff_date` = `2026-10-09`.
- The **Stock**, **DailyWaffles** and **AllTime** tabs have headers but no data
  yet — the formulas arrive in Phase 6 and 8.

---

## Running setup again

Setup is safe to re-run at any time. **⋮ Awwffle → Setup / Update structure.**

What it will and will not do:

| does | does not |
|---|---|
| create missing sheets | delete a sheet |
| add missing columns | remove or reorder existing columns |
| add missing settings | overwrite a setting you have edited |
| add missing items | overwrite an item you have renamed |
| re-apply the menu | clear any data |

This is what makes updates safe later (README §2.6): you can paste newer code,
run setup, and keep everything already entered.

---

## What this phase deliberately does not do

Phase 2 is configuration only. There is no entry form yet, no calculation, and
no history. Specifically:

- **No Bazar entry form** — Phase 4.
- **No batch entry form** — Phase 5.
- **No stock calculations** — Phase 6.
- **No POS paste** — Phase 7.
- **No reports** — Phase 8.
- **Historical data is not imported** — Phase 3.

If a menu item or tab looks empty, that is expected at this stage.

---

## If something goes wrong

**"Awwffle menu is missing."** Reload the spreadsheet. `onOpen` only fires when
the document opens, not while the script editor is active.

**"Script function not found: runSetup."** A file failed to paste completely.
Check that `04_Setup` exists and its first line is `/**`.

**"You do not have permission to call protect."** You are not the owner of the
sheet. Setup must run in the sheet's own bound script, not as a standalone script.

**Tests fail with "expected 43, got N".** A paste was truncated. Re-copy
`02_ItemMaster` in full — it is the longest file.

**Nothing happens when you run.** Check the **Execution log** in the editor; the
toast only appears inside the spreadsheet, not the editor.
