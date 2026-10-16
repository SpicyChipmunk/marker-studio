/* ===== Scan: answering a question, a row taken off, where the keyboard goes after (scan.js 688–858 until v318.8) ===== */
// (v318.3) a question's cap from the photo, larger, over Scan. (v318.7) Its answers are under it, to answer from the
// picture, with Not this cap (the question goes, as its × does) and Not now; a tap on the picture or outside the card,
// Escape or Back closes it, nothing else (a tap meant to close that landed on an answer would add a marker), and the
// answers ignore the tail of the tap that opened it. The question is found again when a chip's tapped: a photo or a cap
// read meanwhile can have answered it or moved it
// (v318.3 debug: focus back on the picture tapped, from: Safari doesn't focus a button tapped, so what had focus before,
// the box after an answer, had it back, and on an iPad its keyboard over the list. Found again by its question when the
// list's been drawn again meanwhile. After an answer, the keyboard's place follows scanFocusAfter, not the picture)
function scanZoom(e, from) {
  if (!e || !e.crop) return;
  const o = document.createElement('div'),
    op = from || document.activeElement,
    t0 = Date.now();
  o.className = 'overlay on sczoom';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-modal', 'true');
  o.setAttribute('aria-label', 'The cap in the photo');
  o.innerHTML =
    '<div class="ocard dcard sczoomcard"><img src="' +
    esc(e.crop) +
    '" alt="The cap in the photo"><div class="dsub" id="sczTitle">' +
    esc(e.title) +
    '</div><div class="scpick sczpick">' +
    (e.opts || [])
      .map(
        (x, k) =>
          '<button type="button" class="scchoose" data-k="' +
          k +
          '" aria-describedby="sczTitle">' +
          scanChip(x) +
          '</button>',
      )
      .join('') +
    '</div><div class="sczrow"><button type="button" class="obGhost" data-a="not">Not this cap</button>' +
    '<button type="button" class="btn-primary" data-a="close">Not now</button></div></div>';
  const end = function (back) {
    o.remove();
    if (back === false) return;
    const n = scanList.indexOf(e),
      to =
        op && op.isConnected
          ? op
          : from && n >= 0
            ? document.querySelector('#scList .sccrop[data-n="' + n + '"]')
            : null;
    try {
      if (to && to !== document.body) to.focus({ preventScroll: true });
    } catch (_) {}
  };
  o.addEventListener('click', function (ev) {
    const t = ev.target,
      // (not the rest of the tap that opened it; Escape's click, detail 0, at once)
      soon = ev.detail !== 0 && Date.now() - t0 < 300,
      a = t.closest ? t.closest('[data-a]') : null,
      ch = t.closest ? t.closest('.scchoose') : null;
    if (soon) return;
    if (a && a.dataset.a === 'close') return end();
    if (ch || (a && a.dataset.a === 'not')) {
      const n = scanList.indexOf(e);
      end(false);
      if (n < 0) {
        scanSay('same', 'That question’s gone', 'Answered, or taken off the list, meanwhile', -1);
        scanFocusAfter(-1);
        return;
      }
      if (ch) {
        const x = e.opts[+ch.dataset.k];
        scanAnswer(e, x.i, x.how);
      } else scanRemove(n);
      scanFocusAfter(n);
      return;
    }
    if (t === o || (t.tagName === 'IMG' && t.closest('.sczoomcard'))) end();
  });
  document.body.appendChild(o);
  o.querySelector('[data-a="close"]').focus({ preventScroll: true });
}
// a question's answer as a chip's words: the marker, its brand, by its old code or upside down, already yours
function scanChip(o) {
  return (
    '<span class="scsw" style="background:' +
    COLORS[o.i].hex +
    // (v309.2: the words in one span, wrapping as a line: "already yours" had become a column of its own)
    '"></span><span class="scchtx">' +
    esc(scanName(o.i)) +
    ' · ' +
    esc(COLORS[o.i].brand) +
    // (v318.1: an answer that's the marker by its old code, or the code upside down, says so: "Which R14?"
    // had offered RV18 Bubblegum with no word of why. v318 audit: "was", as the marker picker says it, and
    // the old code as shown everywhere, CGII00 not CGⅡ00)
    (o.how === 'old'
      ? ' · <i>' + (oldCode(COLORS[o.i]) ? 'was ' + esc(oldCode(COLORS[o.i])) : 'by its old code') + '</i>'
      : o.how === 'upside'
        ? ' · <i>upside down</i>'
        : '') +
    // (v305: which of the answers you have)
    (state.owned.has(mkey(o.i)) ? ' · <i>already yours</i>' : '') +
    '</span>'
  );
}
/* ---- (v318.7) answering, and where the keyboard goes after ---- */
// One answer to a question, from the list's chips or the larger view's: the answer takes the question's place in the
// list (not the top: the eye and a screen reader stay put, and a photo's group stays together) and its photo, and the
// question isn't asked again while its cap's still in view. Returns the question's place, or -1 when it had gone
function scanAnswer(q, i, how) {
  const n = scanList.indexOf(q);
  if (n < 0) return -1;
  scanAnsweredAt.set(q.ask, Date.now());
  scanList.splice(n, 1);
  scanTake(i, how, true, false, { n: n, with: q.photo ? { photo: q.photo } : null });
  scanRender();
  return n;
}
// a row taken off the list (its ×, or the larger view's Not this cap): a question let go by isn't asked again while
// its cap's still in view (v303)
function scanRemove(n) {
  const e = scanList[n];
  if (!e) return;
  scanList.splice(n, 1);
  if (e.i === scanLast.i) scanLast = { i: -1, at: 0 };
  if (e.ask) scanAnsweredAt.set(e.ask, Date.now());
  scanRender();
}
// Follow the keyboard. Whether the box had the keyboard as a tap in Scan's card began, noted at pointerdown (before
// the tap moves focus) and forgotten after the click or a second (a touch that scrolls has no click, and mustn't
// count for a key pressed later). A chip answered with Enter or by VoiceOver has no pointerdown: the box hadn't it
let scanBoxHad = false,
  scanBoxHadT = 0;
function scanNoteBox() {
  const bx = $('scBox');
  scanBoxHad = !!bx && document.activeElement === bx;
  clearTimeout(scanBoxHadT);
  scanBoxHadT = setTimeout(function () {
    scanBoxHad = false;
  }, 1000);
}
// After a question's answered, a row's taken off, the row at the top's Keep Ohuhu or ×, or a card's button: the box
// again when it had the keyboard as the tap began (a sweep with Scan Text, or codes being typed on a Mac or PC: v303's
// way); else the keyboard stays down (on an iPad it had come up over the list after every answer to a photo's
// questions): focus goes to the next question's first answer, the nearest below the row answered, else the nearest
// above, else Add, else the count over the list (what's listed, read out). n: the row's place in the list; del: a plain
// marker row taken off, so the row that takes its place, its ×
function scanFocusAfter(n, del) {
  const had = scanBoxHad;
  scanBoxHad = false;
  clearTimeout(scanBoxHadT);
  if (had) return scanFocusBox();
  const list = $('scList'),
    go = function (el) {
      if (!el) return false;
      try {
        el.focus();
      } catch (_) {}
      return true;
    };
  if (!list) return;
  if (del) {
    const rows = [...list.querySelectorAll('.scrow:not(.scask) .scdel')],
      at = rows.find((d) => +d.dataset.n >= n) || rows.reverse().find((d) => +d.dataset.n < n);
    if (go(at)) return;
  }
  const qs = [...list.querySelectorAll('.scask:not(.scswitch)')].filter((q) => q.querySelector('.scchoose')),
    q = qs.find((x) => +x.dataset.n >= n) || qs.reverse().find((x) => +x.dataset.n < n);
  if (q && go(q.querySelector('.scchoose'))) return;
  const add = $('scAdd');
  if (add && !add.disabled && go(add)) return;
  // (v318.7 debug: with the list emptied, the count is empty too, and a screen reader heard nothing: the line that
  // says so instead, "Nothing yet. Each marker read joins this list")
  go(scanList.length ? $('scCount') : $('scEmpty') || $('scCount'));
}
