/**
 * Awwffle — Business Management Workbook
 * File: SheetBuilder.gs
 * Purpose: low-level helpers for creating and styling sheets.
 */

function SS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Insert a fresh sheet at the given position, or clear it if it already exists. */
function resetSheet(name, position) {
  var ss = SS();
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow > 0 && lastCol > 0) {
      sheet.getRange(1, 1, lastRow, lastCol).clear();
    }
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
    sheet.setConditionalFormatRules([]);
    return sheet;
  }
  if (typeof position === 'number') {
    sheet = ss.insertSheet(name, position);
  } else {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/** Write a title band across the top row. Not merged — a merge would conflict
 *  with frozen columns ("can't freeze columns which contain only part of a
 *  merged cell"). The band is styled across `span` columns with the text in A1. */
function writeTitle(sheet, text, span) {
  sheet.getRange(1, 1, 1, span).setBackground(CLR.TITLE_BG);
  sheet.getRange(1, 1)
    .setValue(text)
    .setBackground(CLR.TITLE_BG)
    .setFontColor(CLR.TITLE_FG)
    .setFontWeight('bold')
    .setFontSize(13)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 30);
}

/** Write a header row and style it; returns the range. */
function writeHeader(sheet, row, headers) {
  var r = sheet.getRange(row, 1, 1, headers.length);
  r.setValues([headers])
    .setBackground(CLR.HEADER_BG)
    .setFontColor(CLR.HEADER_FG)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setWrap(true);
  return r;
}

/** Bulk-write a 2-D array of values starting at (row, col). */
function fill(sheet, row, col, values) {
  if (!values || values.length === 0) return null;
  var r = sheet.getRange(row, col, values.length, values[0].length);
  r.setValues(values);
  return r;
}

/** Bulk-write a 2-D array of formulas starting at (row, col). */
function fillFormulas(sheet, row, col, formulas) {
  if (!formulas || formulas.length === 0) return null;
  var r = sheet.getRange(row, col, formulas.length, formulas[0].length);
  r.setFormulas(formulas);
  return r;
}

/**
 * Write a mixed 2-D block where individual cells may be text, numbers or formulas.
 * Any string beginning with "=" is written as a real formula; everything else is
 * written as a plain value. (setValues can leave "=" strings as literal text, so
 * blocks that mix labels and formulas go through here instead.)
 */
function writeCells(sheet, row0, col0, rows) {
  for (var i = 0; i < rows.length; i++) {
    for (var j = 0; j < rows[i].length; j++) {
      var v = rows[i][j];
      if (v === '' || v === null || v === undefined) continue;
      var cell = sheet.getRange(row0 + i, col0 + j);
      if (typeof v === 'string' && v.charAt(0) === '=') {
        cell.setFormula(v);
      } else {
        cell.setValue(v);
      }
    }
  }
}

/** Set column widths from an array like [ [col, px], ... ]. */
function setWidths(sheet, pairs) {
  for (var i = 0; i < pairs.length; i++) {
    sheet.setColumnWidth(pairs[i][0], pairs[i][1]);
  }
}

/** Apply a list-based dropdown to a range. */
function addListValidation(sheet, row, col, numRows, values) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .setHelpText('Choose a value from the list.')
    .build();
  sheet.getRange(row, col, numRows, 1).setDataValidation(rule);
}

/** Apply a range-based dropdown (points at a list kept in the Lists sheet). */
function addRangeValidation(sheet, row, col, numRows, sheetName, a1) {
  var target = SS().getSheetByName(sheetName).getRange(a1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(target, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, col, numRows, 1).setDataValidation(rule);
}

/** Set the number format of a rectangular block. */
function setFormat(sheet, row, col, numRows, numCols, fmt) {
  sheet.getRange(row, col, numRows, numCols).setNumberFormat(fmt);
}

/** Register a named range (used as the single source for lookups/validation). */
function addNamedRange(name, sheetName, a1) {
  var ss = SS();
  var existing = ss.getRangeByName(name);
  if (existing) ss.removeNamedRange(name);
  ss.setNamedRange(name, ss.getSheetByName(sheetName).getRange(a1));
}

/** Shade a whole band (used for input vs formula zones). */
function shadeBand(sheet, row, col, numRows, numCols, bg, fg) {
  var r = sheet.getRange(row, col, numRows, numCols);
  if (bg) r.setBackground(bg);
  if (fg) r.setFontColor(fg);
  return r;
}

/** Freeze rows/cols. */
function freeze(sheet, rows, cols) {
  sheet.setFrozenRows(rows || 0);
  sheet.setFrozenColumns(cols || 0);
}

/** Add a soft warning to a cell. */
function addNote(sheet, row, col, text) {
  sheet.getRange(row, col).setNote(text);
}
