/* ===== Scan: the questions waiting, said on Add markers; the list read again after another tab's save (scan.js 1259–1359 until v318.8) ===== */
// Questions not yet answered stay in the list after Add, for next time; Markers' Add markers sheet (and the card at the
// top with no markers yet) says so in a line above its ways in, "2 questions still to answer · Answer them", which
// opens Scan at the questions without the keyboard. A question every answer of which is in your collection is dropped
// (its picture with it), not counted: after Add, and when the sheet opens. Not one with no answers, and not the row at
// the top after the switch to both brands, which isn't a question. With two tabs open, the list is read again from
// what the other tab saved (another tab's save event, the tab coming back into view, the sheet opening) while Scan
// isn't open here and no photo is being read, its pictures found again (scanPics)
// out (v318.7 debug): an array the questions dropped are added to, for Add's Undo to give them back
function scanDropOwned(out) {
  const n0 = scanList.length;
  scanList = scanList.filter(function (e) {
    const go = e.ask && e.opts.length && e.opts.every((o) => state.owned.has(mkey(o.i)));
    if (go && out) out.push(e);
    return !go;
  });
  if (scanList.length === n0) return false;
  scanSaveList();
  return true;
}
// the questions waiting, counted for the line (the list read again first, and the answered-by-owning dropped)
function scanWaiting() {
  scanReread();
  scanDropOwned();
  return scanFind ? 0 : scanAsks();
}
// the line itself (events.js addWaysHTML puts it above the ways in; empty and hidden with no question waiting)
function scanWaitInner(where, n) {
  return n
    ? '<span>' +
        (n === 1 ? '1 question' : n + ' questions') +
        ' still to answer</span><button type="button" class="sflink wcscan" data-add="questions" id="' +
        where +
        'Questions">Answer them</button>'
    : '';
}
function scanWaitHTML(where) {
  const n = scanWaiting();
  return (
    '<div class="mkwait" id="' +
    where +
    'Wait"' +
    (n ? '' : ' hidden') +
    '>' +
    scanWaitInner(where, n) +
    '</div>'
  );
}
// the line, where it's showing, told the count now (the list drawn or saved, the sheet or the card up)
function scanWaitSync() {
  let els;
  try {
    els = document.querySelectorAll('.mkwait');
  } catch (_) {
    return;
  }
  if (!els || !els.length) return;
  const n = scanFind ? 0 : scanAsks();
  els.forEach(function (el) {
    const html = scanWaitInner(el.id.replace(/Wait$/, ''), n);
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = !n;
  });
}
// the list read again from what another tab saved, when it's safe to: true when it changed
function scanReread() {
  const ov = $('scanOverlay');
  if (scanFind || (ov && ov.classList && ov.classList.contains('on'))) return false;
  if (typeof ocrRun !== 'undefined' && ocrRun && !ocrRun.done) return false;
  let raw = null;
  try {
    raw = localStorage.getItem(SCAN_LIST_KEY);
  } catch (_) {
    return false;
  }
  if (raw === scanListRaw) return false;
  scanListRaw = raw;
  scanList = scanParseList(raw);
  // (v318.22 debug: and the questions answered by earlier photos, their numbers maybe another's now)
  if (typeof ocrPhotos !== 'undefined') {
    ocrPhotos = scanPhotoMax();
    ocrAnswered = [];
  }
  try {
    scanPics.load(scanPicsShow);
  } catch (_) {}
  scanWaitSync();
  return true;
}
try {
  addEventListener('storage', function (e) {
    if (e.key === SCAN_LIST_KEY || e.key === null) {
      if (!scanReread())
        try {
          scanPics.forget();
        } catch (_) {}
    }
  });
  addEventListener('pageshow', function (e) {
    if (e.persisted) scanReread();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') scanReread();
  });
} catch (_) {}
