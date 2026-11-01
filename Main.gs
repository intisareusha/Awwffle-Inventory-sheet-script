/**
 * Awwffle — Business Management Workbook
 * File: Main.gs
 * Purpose: entry point + custom menu. This is the file you run.
 *
 * FIRST RUN
 *   1. Run  buildWorkbook()  once. It creates every sheet and loads the history.
 *   2. Open the "Awwffle" menu afterwards for quick actions.
 */

/** THE ONE FUNCTION YOU RUN FIRST. */
function buildWorkbook() {
  var ss = SS();
  buildAll();
  ss.setActiveSheet(ss.getSheetByName(SH.README));
  ss.toast('Awwffle workbook built (v' + AWWFFLE_VERSION + '). Open "START HERE".', 'Awwffle', 8);
}

/** Rebuild only the reconciliation sheet (safe — reads other sheets, writes none of them). */
function rebuildReconciliation() {
  buildReconciliation();
  SS().toast('Reconciliation refreshed.', 'Awwffle', 5);
}

/** Jump to the START HERE sheet. */
function goToReadme() {
  SS().setActiveSheet(SS().getSheetByName(SH.README));
}

/** Adds the custom menu when the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Awwffle')
    .addItem('Rebuild whole workbook (careful — wipes current sheets)', 'confirmRebuild')
    .addItem('Refresh reconciliation checks', 'rebuildReconciliation')
    .addSeparator()
    .addItem('Go to START HERE', 'goToReadme')
    .addToUi();
}

/** Confirmation-guarded full rebuild, so the menu item cannot be hit by accident. */
function confirmRebuild() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'Rebuild workbook?',
    'This clears every Awwffle sheet and rebuilds it from the seed data. ' +
    'Any daily data you have entered will be lost. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (res === ui.Button.YES) {
    buildWorkbook();
  }
}
