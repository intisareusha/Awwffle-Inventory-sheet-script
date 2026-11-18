/**
 * Awwffle Inventory System — 10_ClosedDays.gs
 *
 * Phase 6.5 — closed-day tracking.
 *
 * README §8.4, §13.A6, §13.A7.
 *
 * WHY THIS IS A DATED LIST AND NOT A WEEKDAY RULE
 * The owner's own history proves a weekday rule is wrong:
 *
 *   21 Oct (Wed) OPEN     — normally closed, traded that week
 *   22 Oct (Thu) CLOSED   — the day off moved to Thursday
 *   28 Oct (Wed) OPEN     — traded again
 *   4 Nov  (Wed) CLOSED
 *   11 Nov (Wed) CLOSED
 *
 * The closed day moved inside three weeks. It may later be two days, a different
 * day, or none. So a closure is always an explicit dated record, never inferred.
 *
 * WHAT THIS FILE GUARANTEES
 *   - Open-day counts come from the dated list only (§8.4), never a weekday.
 *   - A missing snapshot is reported as "missed" only when the day is NOT closed,
 *     which is the §13.A7 distinction the whole reporting layer depends on.
 *   - Adding or removing a closure immediately changes every per-day average.
 */

// ---------------------------------------------------------------------------
// Public API for the sidebar
// ---------------------------------------------------------------------------

/** Everything the closed-days sidebar needs, in one call. */
function getClosedDaysPanel() {
  return getClosedDaysPanel_();
}

/** Adds a closure. Date required, reason optional. */
function addClosedDay(payload) {
  return addClosedDay_(payload);
}

/** Removes a closure by date. */
function removeClosedDay(dateString) {
  return removeClosedDay_(dateString);
}

// ---------------------------------------------------------------------------
// Reading closures
// ---------------------------------------------------------------------------

/** A set of date keys that are closed. The single source for open-day maths. */
function closedDaySet_() {
  var set = {};
  readRecords_(SHEETS.CLOSED_DAYS).forEach(function (r) {
    var k = dateKey_(r['Date']);
    if (k) set[k] = true;
  });
  return set;
}

/** All closures, newest first, with weekday for readability. */
function closedDaysList_() {
  var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return readRecords_(SHEETS.CLOSED_DAYS).map(function (r) {
    var d = toDate_(r['Date']);
    if (!d) return null;
    return {
      date: dateKey_(d),
      weekday: names[d.getDay()],
      reason: String(r['Reason'] || ''),
      recordedAt: r['Recorded At'] || ''
    };
  }).filter(Boolean).sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

/**
 * Builds the sidebar payload: closures, plus a live open-day picture for the
 * current data range so a new closure can be seen taking effect immediately.
 */
function getClosedDaysPanel_() {
  var posDays = readRecords_(SHEETS.POS_SNAPSHOTS).map(function (r) {
    return dateKey_(r['Date']);
  }).filter(Boolean);

  var batchDays = readRecords_(SHEETS.BATCHES).map(function (r) {
    return dateKey_(r['Date']);
  }).filter(Boolean);

  var firstPos = posDays.length ? posDays.slice().sort()[0] : '';
  var lastPos = posDays.length ? posDays.slice().sort().pop() : '';

  var range = firstPos && lastPos ? openDayBreakdown_(firstPos, lastPos) : null;
  var missed = range ? findMissedEntries_() : [];

  return {
    today: dateKey_(new Date()),
    closedDays: closedDaysList_(),
    posRange: { first: firstPos, last: lastPos },
    posOpenDays: range,
    batchOpenDays: batchDays.length
      ? openDayBreakdown_(batchDays.slice().sort()[0], batchDays.slice().sort().pop())
      : null,
    missedEntries: missed,
    suggestions: suggestWeekdays_()
  };
}

/**
 * Splits a date range into calendar days, closed days and open days.
 *
 * Returns null for an unusable range so callers show a blank rather than a zero
 * that looks like real data.
 */
function openDayBreakdown_(start, end) {
  var a = toDate_(start);
  var b = toDate_(end);
  if (!a || !b || a > b) return null;

  var closedSet = closedDaySet_();
  var calendar = daysBetweenInclusive_(a, b);
  var closedCount = 0;

  dateRange_(a, b).forEach(function (d) {
    if (closedSet[dateKey_(d)]) closedCount++;
  });

  return {
    start: dateKey_(a),
    end: dateKey_(b),
    calendarDays: calendar,
    closedDays: closedCount,
    openDays: calendar - closedCount
  };
}

/**
 * Days inside the POS span that have no snapshot AND are not marked closed.
 *
 * This is the §13.A7 distinction: a day is either deliberately closed or a missed
 * entry, never both and never silently neither. Only open days can be missed.
 */
function findMissedEntries_() {
  var posDates = {};
  readRecords_(SHEETS.POS_SNAPSHOTS).forEach(function (r) {
    var k = dateKey_(r['Date']);
    if (k) posDates[k] = true;
  });

  var keys = Object.keys(posDates).sort();
  if (!keys.length) return [];

  var closedSet = closedDaySet_();
  var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var missed = [];

  dateRange_(keys[0], keys[keys.length - 1]).forEach(function (d) {
    var k = dateKey_(d);
    if (posDates[k]) return;        // traded
    if (closedSet[k]) return;       // deliberately closed: fine

    missed.push({ date: k, weekday: names[d.getDay()] });
  });

  return missed;
}

/**
 * Suggests weekdays that appear closed consistently, purely as a nudge.
 *
 * Never applied automatically: the owner's history already shows the pattern
 * shifting, so this is information, not a rule.
 */
function suggestWeekdays_() {
  var list = closedDaysList_();
  if (!list.length) return [];

  var counts = {};
  list.forEach(function (c) { counts[c.weekday] = (counts[c.weekday] || 0) + 1; });

  var total = list.length;
  return Object.keys(counts).map(function (w) {
    return { weekday: w, count: counts[w], share: Math.round((counts[w] / total) * 100) };
  }).sort(function (a, b) { return b.count - a.count; });
}

// ---------------------------------------------------------------------------
// Add / remove
// ---------------------------------------------------------------------------

/**
 * Marks a date closed.
 *
 * Validation is deliberately light: a closure is a fact the owner records, not
 * something to argue with. It refuses only things that cannot be true — an
 * unusable date, a duplicate, or a closure in the far future.
 */
function addClosedDay_(payload) {
  var date = toDate_(payload && payload.date);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };

  var key = dateKey_(date);
  var reason = String((payload && payload.reason) || '').trim();

  var existing = readRecords_(SHEETS.CLOSED_DAYS).filter(function (r) {
    return dateKey_(r['Date']) === key;
  });
  if (existing.length) {
    return { ok: false, errors: [key + ' is already marked closed.'] };
  }

  appendRows_(SHEETS.CLOSED_DAYS, [[date, reason || 'Closed', new Date()]]);
  logEvent_('CLOSED_DAY', 'Closure added', key + ' ' + (reason || '(no reason)'));

  return {
    ok: true,
    date: key,
    message: key + ' marked closed.',
    panel: getClosedDaysPanel_()
  };
}

/** Removes a closure. Removing a non-closure is a no-op with a clear message. */
function removeClosedDay_(dateString) {
  var date = toDate_(dateString);
  if (!date) return { ok: false, errors: ['A valid date is required.'] };

  var key = dateKey_(date);
  var sheet = getSheet_(SHEETS.CLOSED_DAYS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, errors: [key + ' is not marked closed.'] };

  var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    if (dateKey_(dates[i][0]) === key) {
      sheet.deleteRow(i + 2);
      logEvent_('CLOSED_DAY', 'Closure removed', key);
      return {
        ok: true,
        date: key,
        message: key + ' is now an open day.',
        panel: getClosedDaysPanel_()
      };
    }
  }

  return { ok: false, errors: [key + ' is not marked closed.'] };
}
