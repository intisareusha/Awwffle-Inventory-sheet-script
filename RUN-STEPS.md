# RUN STEPS — build the Awwffle workbook in your own Google account

You do **not** need Microsoft Excel. You do **not** need to give anyone access.
Everything happens inside your own Google Drive. Just follow these steps once.

---

## Step 1 — Create a blank Google Sheet

1. Go to <https://sheets.google.com> and sign in with your Google account.
2. Click **Blank spreadsheet**.
3. Click the title (top-left, says "Untitled spreadsheet") and rename it to
   **Awwffle Business Workbook**.

Leave this tab open — you'll come back to it at the end.

---

## Step 2 — Open the script editor

1. In that spreadsheet, open the menu **Extensions → Apps Script**.
2. A new tab opens with a code editor. This is a "project" attached to your sheet.
3. Click the project name at the top-left ("Untitled project") and rename it to
   **Awwffle Workbook**.

On the left you will see a file called **`Code.gs`** containing:

```js
function myFunction() {
}
```

---

## Step 3 — Paste the six files

You will create **6 files** in this editor. For each one, do the same three actions:

- Click the **`+`** next to **Files** → choose **Script**.
- Name the file exactly as shown (the editor adds `.gs` automatically).
- Delete whatever is in it, then paste the matching file contents from the
  `Awwffle` folder of this project.

| # | Create a file named | Paste the contents of |
|---|---|---|
| 1 | `Config` | `Config.gs` |
| 2 | `SheetBuilder` | `SheetBuilder.gs` |
| 3 | `SeedData` | `SeedData.gs` |
| 4 | `Build` | `Build.gs` |
| 5 | `Reconciliation` | `Reconciliation.gs` |
| 6 | `Main` | `Main.gs` |

> Tip: for file #1 you can just **rename the existing `Code.gs`** to `Config`
> (click the three-dot menu next to it → Rename), then paste the Config contents.
> Then add the remaining five with the **`+`** button.

When all six are done, click the **💾 Save** icon (or press `Ctrl+S`).

---

## Step 4 — Run the builder

1. Near the top of the editor there is a function dropdown (it currently says
   something like `myFunction`). Click it and choose **`buildWorkbook`**.
2. Click the **▶ Run** button.
3. The first time, Google asks for permission:
   - Click **Review permissions**.
   - Choose the Google account you used.
   - You may see *"Google hasn't verified this app"* — click **Advanced**, then
     **Go to Awwffle Workbook (unsafe)**. This warning is normal for a personal
     script that only touches its own spreadsheet. It is safe.
   - Click **Allow**.

The script now builds every tab. It takes a few seconds.

---

## Step 5 — See the result

1. Go back to your spreadsheet tab (or reload it).
2. You will see all the tabs: **START HERE, Lists, Item Master, Product Master,
   POS Raw Data, Sales Log, Daily Finance, Period Summary, Production Log,
   Recipes BOM, Purchases, Expense Log, Inventory, Packaging Stock,
   Unit Conversions, Stocktake, Executive Dashboard, Product Performance,
   Inventory Dashboard, Financial Dashboard, Reports, Reconciliation**.
3. Reload the page once more so the custom **Awwffle** menu appears in the menu
   bar (next to Help). That menu gives you quick actions:
   - **Refresh reconciliation checks**
   - **Rebuild whole workbook** (asks for confirmation — it clears and rebuilds)

---

## Step 6 — Day-to-day use

1. Paste each day's POS stock report into **POS Raw Data** (add rows at the
   bottom — never delete the old ones).
2. On **Daily Finance**, enter invoice count, discount, due and confirm the sale.
3. On **Production Log**, type the batches prepared (numbers only).
4. On **Purchases**, add each bazar item as its own row.
5. On **Expense Log**, add salary / electricity / maintenance / other.
6. Open the dashboards — they update on their own.

That's it. The **Reconciliation** tab always tells you what still needs attention.

---

## Updating later (revisions)

When the code is improved, you don't start over:

1. In the script editor, open the file that changed (e.g. `Build`).
2. Select all its contents, delete, and paste the new version.
3. Save, pick **`buildWorkbook`**, and click **Run** again.

> ⚠️ Rebuilding **clears the tabs and reloads the original history**, so any daily
> data you have typed in will be lost. While we are still setting things up that
> is fine. Once you start entering real daily data, we will switch to a
> "refresh only" update that keeps your entries — just ask.

---

## If something goes wrong

- **Red error on Run:** copy the red text and send it to me. Nothing is broken
  permanently — the sheet can always be rebuilt.
- **Tabs missing:** reload the spreadsheet tab.
- **No "Awwffle" menu:** reload the spreadsheet once (the menu is created when
  the sheet opens).
