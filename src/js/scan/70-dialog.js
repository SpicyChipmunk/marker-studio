/* ===== Scan: the dialog (scan.js 2695–3658 until v318.8) =====
   Drawing the list (scanRender), Add's state, Find mode's line, the brand buttons, the lens line, openScan and
   closeScan, Add, and the wiring of the box, the buttons and the keyboard (the IIFE at the end: it runs at load, after
   everything above, and must stay the last of Scan's files). */
function scanRender() {
  const list = $('scList');
  if (!list) return;
  const fresh = scanNew().length,
    asks = scanAsks(),
    marks = scanList.length - asks;
  // (v318.7) the switch to both brands, said at the top of the list for the visit, with Keep Ohuhu: not a question,
  // not saved, not counted
  const auto = scanAuto(),
    swRow =
      scanSw.on && scanSw.row && auto
        ? '<li class="scrow scask scswitch"><span class="scmark" aria-hidden="true">=</span><span class="scname"><b>Reading both brands: ' +
          esc(scanOtherBrand(auto)) +
          ' caps were read</b>' +
          (scanSw.added.length
            ? '<small>' +
              esc(scanSw.added.join(', ')) +
              ' went into your collection as ' +
              esc(auto) +
              '</small>'
            : '') +
          '<span class="scpick"><button type="button" class="scswkeep">Keep ' +
          esc(auto) +
          '</button></span></span><button type="button" class="scdel scswx" aria-label="Take this off the list">' +
          ic('x') +
          '</button></li>'
        : '';
  // (v318.7) a small heading over each photo's markers, "Photo 1 · 58 markers · 3 to choose", so each tray's count sits
  // with its markers: a run of entries of one photo in the list (a photo's entries go in together, newest first; an
  // answer takes its question's place; Undo this photo gives a question back at its group), as an <li> a screen reader
  // hears whole. Markers typed or scanned get one too, "Typed or scanned · 12", only while photo groups are there. Not
  // in Find mode
  const groups = !scanFind && scanList.some((e) => e.photo),
    heading = function (n) {
      const g = scanList[n].photo || 0;
      let m = 0,
        q = 0;
      for (let k = n; k < scanList.length && (scanList[k].photo || 0) === g; k++) scanList[k].ask ? q++ : m++;
      const parts = [
        g ? (m ? m + (m === 1 ? ' marker' : ' markers') : '') : m ? String(m) : '',
        q ? q + ' to choose' : '',
      ].filter(Boolean);
      return (
        '<li class="scgroup" data-g="' +
        g +
        '"><b>' +
        (g ? 'Photo ' + g : 'Typed or scanned') +
        '</b>' +
        (parts.length ? '<span> · ' + parts.join(' · ') + '</span>' : '') +
        '</li>'
      );
    };
  let lastG = -1;
  list.innerHTML =
    swRow +
    scanList
      .map(function (e, n) {
        let head = '';
        if (groups && (e.photo || 0) !== lastG) {
          lastG = e.photo || 0;
          head = heading(n);
        }
        return head + row(e, n);
      })
      .join('');
  function row(e, n) {
    {
      const del =
        '<button type="button" class="scdel" data-n="' +
        n +
        '" aria-label="Take ' +
        esc(e.ask ? e.title : COLORS[e.i].code) +
        ' off the list">' +
        ic('x') +
        '</button>';
      if (e.ask)
        return (
          '<li class="scrow scask' +
          (e.crop ? ' sccropped' : '') +
          '" data-n="' +
          n +
          // (v318.3) a question from a photo: the cap it's about, from the photo, a tap to see it larger
          (e.crop
            ? '"><button type="button" class="sccrop" data-n="' +
              n +
              '" aria-label="See the cap in the photo larger"><img src="' +
              esc(e.crop) +
              '" alt=""></button>'
            : '"><span class="scmark" aria-hidden="true">?</span>') +
          // (v318.7: the question's words, which each answer's chip is described by: a screen reader had heard the
          // chip, "B05 Light Cerulean · Ohuhu, button", without the question)
          '<span class="scname"><b id="scq' +
          n +
          '">' +
          esc(e.title) +
          '</b><span class="scpick">' +
          e.opts
            .map(
              (o) =>
                '<button type="button" class="scchoose" data-n="' +
                n +
                '" data-i="' +
                o.i +
                '" data-how="' +
                esc(o.how) +
                '" aria-describedby="scq' +
                n +
                '">' +
                scanChip(o) +
                '</button>',
            )
            .join('') +
          '</span></span>' +
          del +
          '</li>'
        );
      const c = COLORS[e.i],
        mine = state.owned.has(mkey(e.i)),
        // (v318.21) the cap as read: an older one's code and name, "now R213" (caps.js); else, one of yours, what its
        // cap says
        old = e.cv ? e.cv === 'old' && capHasOld(c) : e.how === 'old' ? capHasOld(c) : capIsOld(e.i);
      return (
        '<li class="scrow' +
        (mine ? ' mine' : '') +
        '" data-n="' +
        n +
        '"><span class="scsw" style="background:' +
        c.hex +
        '"></span><span class="sccode">' +
        esc(old ? oldCode(c) : c.code) +
        '</span><span class="scname">' +
        esc(old ? capOldName(c) : c.name) +
        '<small>' +
        esc(c.brand) +
        (old ? ' · <i>now ' + esc(c.code) + '</i>' : '') +
        (mine
          ? ' · <i>already yours</i>'
          : e.how === 'upside'
            ? ' · <i>read upside down</i>'
            : e.how === 'old'
              ? old
                ? ''
                : ' · <i>by its old code</i>'
              : // (v318.21) a code misread by a character, put right by the name read beside it
                e.how === 'fixed' && e.as
                ? ' · <i>read as “' + esc(e.as) + '”</i>'
                : '') +
        '</small></span>' +
        del +
        '</li>'
      );
    }
  }
  $('scEmpty').hidden = scanList.length > 0;
  const card = list.closest('.sccard');
  if (card) card.classList.toggle('scsome', scanList.length > 0);
  // (v309: the number of markers read big, to see it go up cap after cap from across the table)
  $('scCount').innerHTML = scanList.length
    ? // (each part kept on one line: "2 to / choose" had broken in two on a phone, v300)
      (marks ? '<b>' + marks + '</b>' + (marks === 1 ? '\u00a0marker' : '\u00a0markers') : '') +
      (!scanFind && fresh < marks ? ' · ' + fresh + '\u00a0new' : '') +
      (asks ? (marks ? ' · ' : '') + asks + '\u00a0to\u00a0choose' : '')
    : '';
  const add = $('scAdd');
  scanAddState();
  add.textContent = scanFind
    ? 'Find my set'
    : fresh
      ? 'Add ' + fresh + ' to my collection'
      : marks
        ? 'All already in your collection'
        : 'Add to my collection';
  scanFindNote(marks);
  $('scClear').hidden = !scanList.length;
  scanSaveList();
}
// Add: on with new markers in the list, or (v303) text in the box, which it reads first
function scanAddState() {
  const add = $('scAdd'),
    bx = $('scBox');
  if (add)
    // (v318.21: or what caps you have already say, read with their codes: caps.js)
    add.disabled =
      !(scanFind ? scanList.some((e) => !e.ask) : scanNew().length || capPending()) &&
      !(bx && bx.value.trim());
}
// (v309) Find mode's line under the list: which set the caps read so far fit, best first (findSets, events.js)
function scanFindNote(marks) {
  const el = $('scFind');
  if (!el) return;
  el.hidden = !scanFind;
  if (!scanFind) return;
  const keys = scanList.filter((e) => !e.ask).map((e) => mkey(e.i));
  if (!keys.length) {
    el.innerHTML = 'Each cap narrows it down. Different colours tell sets apart best.';
    return;
  }
  // (v309.1: not "Fits so far: All Copic markers" for caps from two sets, unless more than 250 was answered)
  const r = findSets(scanFind.brand, scanFind.bucket, keys),
    full = r.filter((x) => x.all && !x.far);
  const more = marks < 3 ? ' One more cap to be sure.' : '';
  if (!full.length) {
    el.innerHTML = r.length
      ? '<b>No set has all of these.</b> Check the last code read, or take it off the list.'
      : '<b>No ' + esc(scanFind.brand) + ' set has these.</b> You can add them one by one instead.';
    return;
  }
  const nm = (x) => esc(MARKER_SETS[x.i].n);
  el.innerHTML =
    '<b>Fits so far: ' +
    nm(full[0]) +
    '.</b>' +
    (full.length === 2
      ? ' ' + nm(full[1]) + ' has these too.'
      : full.length > 2
        ? ' ' + (full.length - 1) + ' other sets have these too.'
        : '') +
    more;
}
// (v318 review) text too long to be a list of markers: 200,000 characters, ten times a list of every Ohuhu and Copic
// code with its name; reading that much takes about a second in Chrome on a desktop, more on an iPad
const SCAN_MAX = 200000;
function scanTooBig(text, what) {
  if (String(text).length <= SCAN_MAX) return false;
  scanSay('none', 'Too much text for a list of markers', what + ': paste or open just the list', -1);
  scanBeep('none');
  scanFocusBox();
  return true;
}
function scanFocusBox() {
  const b = $('scBox');
  if (b) b.focus({ preventScroll: true });
}
function scanBrandButtons() {
  const seg = $('scBrand'),
    brands = [...new Set(COLORS.map((c) => c.brand))];
  if (scanBrand && brands.indexOf(scanBrand) < 0) scanBrand = '';
  seg.innerHTML =
    '<button type="button" data-b="">Either brand</button>' +
    brands.map((b) => '<button type="button" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('');
  seg
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.b === scanBrand)));
}
const SCAN_ANDROID = /Android/i.test(navigator.userAgent || '');
// (v318) the line under the steps: a whole tray, a set's box or an order email, pasted (Android: Google Lens, then the
// box's long-press Paste), or a list file opened; in Find mode, the set's box or order to find it by its name
function scanLensLine() {
  const t = $('scLensT'),
    f = $('scFile');
  if (!t) return;
  t.textContent = scanFind
    ? 'Got the box or an order email? Paste its text: the set’s name finds it.'
    : SCAN_ANDROID
      ? 'A whole tray, the set’s box or an order email: copy its text with Google Lens, then long-press the box \u203a Paste. A set’s name adds the whole set, asked first.'
      : 'A whole tray, the set’s box or an order email: copy its text (Live Text in Photos, or Google Lens) and paste it here. A set’s name adds the whole set, asked first.';
  if (f) f.style.display = scanFind ? 'none' : '';
}
function openScan(opts) {
  const ov = $('scanOverlay');
  if (!ov) return;
  // (v309: from the welcome; a tap on Markers' Scan or type codes passes its click, which is neither)
  const o = opts && !opts.type ? opts : {};
  scanAfter = o.added || null;
  scanUndone = o.undone || null;
  if (o.find && !scanFind) {
    scanKept = { list: scanList, brand: scanBrand, last: scanLast };
    scanList = [];
    scanLast = { i: -1, at: 0 };
    scanBrand = o.find.brand;
    scanFind = o.find;
  }
  ov.classList.toggle('scfind', !!scanFind);
  $('scTitle').textContent = scanFind ? 'Scan 3 caps' : 'Scan or type codes';
  scanLensLine();
  if (typeof ocrCard === 'function') ocrCard();
  // (v303: sound can only start from a tap; the one that opened this counts, not only a tap in the box)
  try {
    if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
    const pr = scanAudio.resume();
    if (pr && pr.catch) pr.catch(function () {});
  } catch (_) {}
  scanOpener = document.activeElement;
  // (no Scan Text session can be open yet: a composition left marked open by an earlier visit is over)
  scanIme = false;
  const auto = scanFind ? '' : scanBrandAuto();
  if (!scanFind && !scanBrandChosen) {
    // (v318.7) the switch to both brands stands for the visit, while the brand it switched from is still the one set
    // for you (scanSw)
    if (scanSw.on && auto !== scanAutoB) scanSwitchEnd(false);
    scanAutoB = auto;
    if (!scanSw.on) scanBrand = auto;
  }
  scanBrandButtons();
  // (v318.7: the set nearly all here when Add was tapped, its missing markers to add to the list, kept for this opening)
  // (v318.7 debug: not let go by an opening in Find mode, which doesn't show it)
  const gaps = scanFind ? null : scanGapPending;
  if (!scanFind) scanGapPending = null;
  scanSay(
    '',
    'Ready',
    scanFind
      ? 'Any 3 ' + scanFind.brand + ' markers from the set'
      : scanSw.on && auto
        ? 'Reading both brands: ' +
          scanOtherBrand(auto) +
          ' caps were read · Keep ' +
          auto +
          ' is at the top of the list'
        : auto
          ? 'Set to ' + auto + ', the brand of all your markers · Either brand reads both'
          : 'Each marker read shows here, with a sound',
    -1,
    gaps ? scanGapChoices(gaps) : null,
  );
  scanRender();
  openDialog(ov);
  // (v318) from Photograph your caps: straight on to the reader, in the same tap (the photo picker opens only from one),
  // and no keyboard
  if (o.photo && !scanFind && typeof ocrCan === 'function' && ocrCan()) {
    ocrOpenTap('entry');
    return;
  }
  // (v318.7) from Add markers' "Answer them": at the questions, the first one's first answer, and no keyboard (on an
  // iPad it had come up over the list)
  if (o.questions && !scanFind) {
    const q = $('scList').querySelector('.scask:not(.scswitch) .scchoose');
    if (q) {
      try {
        q.scrollIntoView({ block: 'center' });
      } catch (_) {}
      q.focus({ preventScroll: true });
      return;
    }
  }
  // (straight into the box: what's done here is typing or Scan Text, which the box's own menu starts)
  scanFocusBox();
}
// (v303) text still in the box, typed without Enter or just put in by Scan Text, is read before the box is let go of
// (Add and Close had thrown it away)
// (v308.6: Scan Text's text, a composition still open, is read but left for Scan Text to take out: see the box's set)
let scanIme = false;
function scanFlushBox(loud) {
  const bx = $('scBox');
  if (!bx || !bx.value.trim()) return;
  clearTimeout(scanStill);
  const v = bx.value;
  if (v !== scanText) scanHandle(v, loud);
  if (scanIme) {
    scanText = v;
    scanRender();
    return;
  }
  scanText = '';
  bx.value = '';
  bx.dispatchEvent(new Event('scanreset'));
  scanRender();
}
function closeScan() {
  const ov = $('scanOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  // (v318: a photo being read stopped, the reader's worker ended)
  if (typeof ocrClose === 'function') ocrClose();
  scanMute = true;
  try {
    scanFlushBox(false);
  } finally {
    scanMute = false;
  }
  closeDialog(ov);
  clearTimeout(scanStill);
  scanText = '';
  const bx = $('scBox');
  bx.value = '';
  bx.dispatchEvent(new Event('scanreset'));
  scanAfter = null;
  scanUndone = null;
  if (scanFind) {
    // (v309) Find mode over: the list kept for Add, and its brand, come back
    scanFind = null;
    scanList = scanKept.list;
    scanBrand = scanKept.brand;
    scanLast = scanKept.last;
    scanKept = null;
    scanUnread = 0;
    ov.classList.remove('scfind');
    $('scTitle').textContent = 'Scan or type codes';
    scanRender();
  }
  // (v318 review) what opened Scan gone (the toast's Open, which went with its toast): the keyboard's place on Markers'
  // Add markers, or on the welcome's step, not lost to the page
  const vis = (e) => !!e && e.isConnected && e.getClientRects().length > 0;
  let back = scanOpener;
  if (back && back.closest && back.closest('#msToast')) back = null;
  if (!vis(back) && !(back && back.closest && back.closest('#mkAddCard')))
    back = [$('mkAddBtn'), ...document.querySelectorAll('#welcome .wctitle[tabindex]')].find(vis) || back;
  openerBack(back);
  scanOpener = null;
  // (v318.7: Add markers' line on the questions waiting, told)
  scanWaitSync();
}
// (v309) Find my set: the caps read (with any left in the box) go back to the welcome
function scanFindDone() {
  const asks0 = scanAsks();
  scanFlushBox(true);
  // (v318.1: a set's name left in the box has handed the caps on and closed Scan already, scanHandle; the list here is
  // now the one kept for Add, and Find's own is over: nothing more to hand on, no "Something went wrong")
  if (!scanFind) return;
  if (scanAsks() > asks0) return;
  const keys = scanList.filter((e) => !e.ask).map((e) => mkey(e.i));
  if (!keys.length) return;
  const f = scanFind;
  closeScan();
  f.done(keys);
}
function scanAdd() {
  if (scanFind) return scanFindDone();
  const after = scanAfter,
    undone = scanUndone;
  const asks0 = scanAsks();
  scanFlushBox(true);
  const fresh = scanNew();
  // (v303: the text left in the box raised a question: shown, with the dialog left open, before anything's added;
  // v318.21 debug: before the caps-only Add too, which had closed Scan over the new question)
  if (scanAsks() > asks0) return;
  // (v318.21: nothing new, but what caps you have already say, read with their codes: noted)
  if (!fresh.length) return capPending() ? scanAddCaps() : undefined;
  // (v318.7) the set nearly all here, with what's missing, worked out while the list still holds the markers: said by
  // the toast, and by the card when Scan's opened next (scanGapPending)
  const gaps = scanSetGaps(true);
  if (gaps) scanGapsSaid.add(gaps.name);
  const keys = fresh.map((e) => mkey(e.i)),
    wishWas = state.wish.slice(),
    // (v318.7) codes both brands use that go in as the brand set for you: named on the row at the top of the list
    // should the sweep turn out to be the other brand's (scanSw), as they aren't rewritten then
    autoIn = scanAuto() && !scanSw.on ? fresh.filter((e) => e.auto).map((e) => COLORS[e.i].code) : [];
  keys.forEach((k) => state.owned.add(k));
  // (v318.21) what each cap in the list says, by the code read: on the markers yours now (caps.js)
  const capCh = capFromList(scanList),
    offer = capOfferFor(scanList);
  capApply(capCh);
  if (offer) state.capOffer = 1;
  scanSw.added = scanSw.added.concat(autoIn);
  // (bought: off the To buy list, as its Bought button does, and fresh: a Running low or Dry mark from before it was
  // unticked goes, v308.3; Undo gives it back)
  const ink = inkAddedOff(keys);
  state.wish = state.wish.filter((w) => keys.indexOf(w.k) < 0);
  const offList = wishWas.length - state.wish.length;
  if (
    !keep(function () {
      keys.forEach((k) => state.owned.delete(k));
      state.wish = wishWas;
      inkPutBack(ink);
      capApply(capCh, true);
      if (offer) state.capOffer = 0;
    })
  )
    return;
  if (Object.keys(capCh).length) capChanged();
  // (questions not yet answered stay for next time; what was added, and what was already yours, go; Undo brings
  // the list back too, to put right and add again)
  const listWas = scanList.slice(),
    dropped = [];
  scanList = scanList.filter((e) => e.ask);
  // (v318.7: a question every answer of which is yours now is answered: dropped, its picture with it; Undo gives it
  // back, dropped)
  scanDropOwned(dropped);
  scanSaveList();
  // (v303: drawn first, then closed: the first markers in an empty collection move Add a set and this button with it,
  // and focus went back to the top tab; the sets' ticks and counts follow too)
  fullRender();
  if (typeof presetRelist === 'function') presetRelist();
  closeScan();
  if (offList || Object.keys(ink).length) wishChanged();
  // (v308) the questions still to answer, and lines not read, are said, with Open to go back to them
  const left = scanAsks(),
    unread = scanUnread,
    setIn = scanSetIn;
  scanUnread = 0;
  scanSetIn = false;
  // (v318: a set's Colorless Blender, now a set can come in by its name, said as Add a set says it, not counted)
  const cols = setKeys(keys).length,
    bl = cols > 0 && keys.indexOf('Ohuhu|0') >= 0;
  if (gaps) scanGapPending = gaps;
  const said =
    addedManyLine(cols || keys.length, offList, bl) +
    (left ? ' \u00b7 ' + left + ' still to choose' : '') +
    (unread ? ' \u00b7 ' + unread + (unread === 1 ? ' line' : ' lines') + ' not read' : '') +
    // (v318.7: "Honolulu 120: B64 and G1 weren't read"; more than four, their number)
    (gaps
      ? ' \u00b7 ' +
        gaps.p.n +
        ': ' +
        (gaps.miss.length > 4
          ? gaps.miss.length + ' weren\u2019t read'
          : scanGapCodes(gaps) + (gaps.miss.length === 1 ? ' wasn\u2019t' : ' weren\u2019t') + ' read')
      : '');
  toastActions(
    said + (offer ? capOfferSay(offer) : ''),
    // (v309.1: Open from the welcome's Scan is the welcome's again: what's added then is counted there)
    // (v318.7: and Open for the set's missing markers, the card with Add these 2 when Scan opens)
    [{ label: 'Undo', fn: scanUndoAdd }]
      .concat(left || gaps ? [{ label: 'Open', fn: () => openScan({ added: after, undone: undone }) }] : [])
      // (v318.21) most caps read show the other codes than your other Ohuhu markers do: once, to switch them
      .concat(offer ? [capOfferAction(offer)] : []),
    offer ? 14000 : left || unread || gaps ? 10000 : 8000,
  );
  if (after) after(cols || keys.length, 0, setIn);
  function scanUndoAdd() {
    const wishNow = state.wish.slice();
    scanSw.added = scanSw.added.filter((c) => autoIn.indexOf(c) < 0);
    // (v303: the markers it added back on the list, once each; its questions are as they are now. v318.7 debug: and
    // the questions this Add dropped as answered by owning, with their pictures, unless asked again meanwhile: with
    // the markers taken back out of the collection they're open again, and they had gone for good. Not one whose
    // answers were all yours before this Add: it would only be dropped again)
    scanList = scanList.concat(
      listWas.filter((e) =>
        e.ask
          ? dropped.indexOf(e) >= 0 &&
            e.opts.some((o) => keys.indexOf(mkey(o.i)) >= 0) &&
            !scanList.some((x) => x.ask === e.ask)
          : !scanList.some((x) => x.i === e.i),
      ),
    );
    scanSaveList();
    keys.forEach((k) => state.owned.delete(k));
    const inkNow = Object.assign({}, state.ink);
    inkPutBack(ink);
    // (what the caps said goes back with them, and the offer, once, is to be made again)
    capApply(capCh, true);
    if (offer) state.capOffer = 0;
    // (back on the To buy list, unless put back there since: v303, where they were in it, not at its end)
    const back = wishWas.filter((w) => keys.indexOf(w.k) >= 0 && !state.wish.some((x) => x.k === w.k));
    if (back.length) {
      const order = wishWas.map((w) => w.k),
        all = state.wish.concat(back);
      state.wish = all
        .map((w, n) => ({ w: w, at: order.indexOf(w.k) >= 0 ? order.indexOf(w.k) : 1e6 + n }))
        .sort((a, b) => a.at - b.at)
        .map((x) => x.w);
    }
    if (
      keep(function () {
        keys.forEach((k) => state.owned.add(k));
        state.wish = wishNow;
        state.ink = inkNow;
        capApply(capCh);
        if (offer) state.capOffer = 1;
      })
    ) {
      fullRender();
      if (typeof presetRelist === 'function') presetRelist();
      wishChanged();
      capChanged();
      if (undone) undone();
    }
  }
}
// (v318.21) Add with nothing new in the list, but what caps you have already say, read with their codes: noted, the
// list emptied of them as Add empties it, with Undo
function scanAddCaps() {
  const capCh = capFromList(scanList),
    offer = capOfferFor(scanList),
    n = Object.keys(capCh).length;
  capApply(capCh);
  if (offer) state.capOffer = 1;
  if (
    !keep(function () {
      capApply(capCh, true);
      if (offer) state.capOffer = 0;
    })
  )
    return;
  const listWas = scanList.slice();
  scanList = scanList.filter((e) => e.ask);
  scanSaveList();
  capChanged();
  fullRender();
  closeScan();
  toastActions(
    'Noted what ' +
      nWord(n, 'cap') +
      ' of yours ' +
      (n === 1 ? 'says' : 'say') +
      (offer ? capOfferSay(offer) : ''),
    [
      {
        label: 'Undo',
        fn: function () {
          capApply(capCh, true);
          if (offer) state.capOffer = 0;
          scanList = scanList.concat(listWas.filter((e) => !e.ask && !scanList.some((x) => x.i === e.i)));
          scanSaveList();
          save(true);
          capChanged();
          fullRender();
        },
      },
    ].concat(offer ? [capOfferAction(offer)] : []),
    offer ? 14000 : 8000,
  );
}
(function () {
  const ov = $('scanOverlay'),
    box = $('scBox');
  if (!ov || !box) return;
  // (v311: opened from Markers' Add markers, events.js addWay; no button of its own on the page)
  $('scClose').addEventListener('click', closeScan);
  $('scAdd').addEventListener('click', scanAdd);
  $('scClear').addEventListener('click', function () {
    // (a second tap, as Clear collection: one mis-tap lost a whole sweep, v299)
    const cb = $('scClear');
    if (cb.dataset.arm !== '1') {
      cb.dataset.arm = '1';
      cb.textContent = 'Tap again to clear';
      clearTimeout(cb._t);
      cb._t = setTimeout(function () {
        cb.dataset.arm = '';
        cb.textContent = 'Clear list';
      }, 3000);
      return;
    }
    clearTimeout(cb._t);
    cb.dataset.arm = '';
    cb.textContent = 'Clear list';
    scanList = [];
    scanUnread = 0;
    scanSetIn = false;
    scanLast = { i: -1, at: 0 };
    // (v318.7 debug: and numbers its photos afresh, Photo 1 next, not Photo 3 over an empty list; not while a photo's
    // being read, whose number stands)
    if (typeof ocrPhotos !== 'undefined' && !(typeof ocrRun !== 'undefined' && ocrRun && !ocrRun.done))
      ocrPhotos = scanPhotoMax();
    // (v303: a cleared list asks afresh)
    scanTookAt.clear();
    scanAnsweredAt.clear();
    // (v318.7: and the sweep's brand afresh, the brand set for you back)
    scanSwitchEnd(true);
    scanSay('', 'Ready', 'List cleared', -1);
    scanRender();
    scanFocusBox();
  });
  // (v318) Open a list file: a .csv or .txt (a spreadsheet saved as CSV, notes), read as a paste is, a line at a time
  const fileIn = $('scFileIn');
  $('scFile').addEventListener('click', function () {
    fileIn.value = '';
    fileIn.click();
  });
  fileIn.addEventListener('change', function () {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    const no = function (why) {
      scanSay('none', why, f.name, -1);
      scanBeep('none');
      scanFocusBox();
    };
    if (f.size > 2e6) return no('Too big for a list of markers');
    const rd = new FileReader();
    rd.onload = function () {
      if (scanTooBig(String(rd.result || ''), f.name)) return;
      scanHandle(String(rd.result || '').replace(/^\uFEFF/, ''), true);
      scanRender();
      scanFocusBox();
    };
    rd.onerror = function () {
      no('That file couldn’t be read');
    };
    rd.readAsText(f);
  });
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return closeScan();
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    // (v318.7) the row at the top of the list after the switch to both brands: Keep Ohuhu, or × to take the row off
    // (after any of these, the keyboard's place follows the keyboard, scanFocusAfter: the box again when it had the
    // keyboard as the tap began — the button tapped is gone, and on an iPad the keyboard and Scan Text with it — else
    // the next question. v303 had gone back to the box every time, and on an iPad that raised the keyboard over the
    // list after every answer to a photo's questions)
    const sw = t.closest('.scswitch button');
    if (sw) {
      if (sw.classList.contains('scswkeep')) scanSwitchOff();
      else {
        scanSw.row = false;
        scanRender();
      }
      scanFocusAfter(-1);
      return;
    }
    const d = t.closest('.scdel');
    if (d) {
      const n = +d.dataset.n,
        e2 = scanList[n];
      scanRemove(n);
      scanFocusAfter(n, !!(e2 && !e2.ask));
      return;
    }
    const cz = t.closest('.sccrop');
    if (cz) return scanZoom(scanList[+cz.dataset.n], cz);
    const ch = t.closest('.scchoose');
    if (ch) {
      // the answer takes the question's place (v318.7: in the list too, not the top)
      const n = scanAnswer(scanList[+ch.dataset.n], +ch.dataset.i, ch.dataset.how);
      scanFocusAfter(n < 0 ? +ch.dataset.n : n);
      return;
    }
    const b = t.closest('#scBrand button');
    if (b) {
      // (v318.7: a brand tapped ends the sweep's switch to both brands, and its row)
      scanSwitchEnd(false);
      scanBrand = b.dataset.b;
      scanBrandChosen = true;
      try {
        localStorage.setItem(SCAN_BRAND_KEY, scanBrand);
      } catch (_) {}
      $('scBrand')
        .querySelectorAll('button')
        .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      // a question between the two brands that the brand just chosen answers: answered
      // (v303: and "another brand than the one chosen" for a marker of the brand now chosen, or with Either brand, is
      // answered too; other questions keep only the brand chosen's answers, where it has any; and it's said)
      let done = 0;
      const out = [];
      scanList.forEach(function (e) {
        if (!e.ask) return out.push(e);
        // (from all its answers as first asked: switching back to Either brand brings them back)
        const all = e.opts0 || e.opts,
          o = scanBrand ? all.filter((x) => COLORS[x.i].brand === scanBrand) : all,
          // (v318.7: and "Which R29?" between two brands' markers, Ohuhu YR47 once R29 and Copic's R29)
          twoBrands = /^old /.test(e.ask) && new Set(all.map((x) => COLORS[x.i].brand)).size > 1;
        const answer =
          ((/^(brands|bynames) /.test(e.ask) || twoBrands) && scanBrand && o.length === 1) ||
          (/^other /.test(e.ask) && o.length === 1);
        if (answer) {
          done++;
          // (its answer already in the list: the question just goes, v299)
          if (!scanList.some((y) => y.i === o[0].i) && !out.some((y) => y.i === o[0].i))
            out.push({ i: o[0].i, how: o[0].how === 'name' || o[0].how === 'old' ? o[0].how : 'chosen' });
          return;
        }
        out.push(
          o.length && o.length < all.length
            ? Object.assign({}, e, { opts: o, opts0: all })
            : Object.assign({}, e, { opts: all, opts0: undefined }),
        );
      });
      scanList = out;
      scanRender();
      if (done)
        scanSay(
          'ok',
          done === 1 ? '1 question answered' : done + ' questions answered',
          scanBrand ? 'By the brand chosen: ' + scanBrand : 'Either brand',
          -1,
        );
      // (v318 review: else the brand now reading, said; the card had gone on naming the brand before, "By the brand
      // chosen: Ohuhu" with Copic pressed, or "Set to Ohuhu, the brand of all your markers")
      else
        scanSay(
          '',
          'Ready',
          scanBrand
            ? scanBrand + ' codes only · Either brand reads both'
            : 'Ohuhu and Copic codes, either brand',
          -1,
        );
      scanFocusBox();
    }
  });
  // (v318.7) whether the box had the keyboard as a tap in the card began (scanFocusAfter): noted before the tap moves
  // focus, and forgotten once its click is handled
  const card = ov.querySelector('.sccard');
  card.addEventListener('pointerdown', scanNoteBox, true);
  ov.addEventListener('click', function () {
    scanBoxHad = false;
    clearTimeout(scanBoxHadT);
  });
  // (v308.5) Copy diagnostics' trace of what the box is sent (safety.js scanTraceAdd)
  const tr = function (what, e) {
    if (typeof scanTraceAdd !== 'function') return;
    const v = box.value || '';
    scanTraceAdd(
      what +
        (e && e.inputType ? ' ' + e.inputType : '') +
        (e && e.isComposing ? ' composing' : '') +
        (e && typeof e.data === 'string' ? ' data:' + e.data.length : '') +
        ' value:' +
        v.length +
        (v ? ' "' + v.slice(0, 18) + '"' : '') +
        (document.activeElement === box ? '' : ' (box not focused)'),
    );
  };
  ['beforeinput', 'compositionstart', 'compositionupdate', 'compositionend', 'focus', 'blur'].forEach(
    function (k) {
      box.addEventListener(k, function (e) {
        tr(k, e);
      });
    },
  );
  // (v318 review) the keyboard or Scan Text's camera up: the box has focus and the visible part of the page is
  // shorter than the page by more than a toolbar (an iPad's and an iPhone's keyboard leave the page its height and
  // shorten what's seen, visualViewport); the card drops what's not needed while scanning (11-scan.css)
  const kb = function () {
    const vv = window.visualViewport,
      card = ov.querySelector('.sccard'),
      up =
        !!vv &&
        document.activeElement === box &&
        document.documentElement.clientHeight - vv.height * (vv.scale || 1) > 150;
    if (card.classList.contains('sckb') !== up) {
      card.classList.toggle('sckb', up);
      // (the box kept in view as what's above it goes)
      if (up) box.scrollIntoView({ block: 'nearest' });
    }
  };
  box.addEventListener('focus', kb);
  box.addEventListener('blur', function () {
    // (after the tap that took focus has landed: what's under the finger doesn't move before it lands)
    setTimeout(kb, 0);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', kb);
  // sound can only start from a tap
  box.addEventListener('pointerdown', function () {
    try {
      if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
      const pr = scanAudio.resume();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (_) {}
  });
  // Scan Text puts in what it reads while you aim, and swaps it as the camera moves: read once the text has held
  // still for a moment, then the box clears for the next cap. Text with nothing in it to read is cleared too, a moment
  // later, so it can't run on into the next cap's. Typing (a letter at a time) waits for Enter; a paste is read at once.
  // (v298: the same text coming back is read once but still cleared — it was left in the box for good — and a
  // letter added to the end of a word being composed is typing too: Android's keyboards send each letter that way, and
  // a pause half-way through a code read what was there)
  let was = '',
    wasN = 0,
    keyAt = 0;
  const ANDROID = SCAN_ANDROID;
  // (v317) on Android the steps say Gboard's way: its Scan text tool photographs a cap and puts the text it reads in on
  // Insert (the page never sees the camera, here as on an iPad). Gboard's tools open from the four-squares icon at
  // the left of its toolbar, and the tool stays open for the next cap. (Samsung Keyboard's Extract text went in One
  // UI 8.5.) The steps are shown on touch screens only (11-scan.css)
  if (ANDROID) {
    const how = $('scHow');
    if (how)
      how.innerHTML =
        '<li><b>Tap the box</b>The keyboard opens. To type a code, tap \u2713 after it.</li>' +
        '<li><b>Gboard \u203a Scan text</b>With Gboard (free on Google Play): open its tools (the four squares, left of its toolbar) and tap Scan text.</li>' +
        '<li><b>Snap, then Insert</b>Photograph one cap and tap Insert: its code is read, with a beep. Then \u2190 for the next cap.</li>';
    // (the paragraph a mouse and keyboard see, an Android tablet's or Chromebook's)
    const hint = ov.querySelector('.schint');
    if (hint)
      hint.innerHTML =
        'Type or paste codes, then press Enter. With Gboard (free on Google Play), tap the box, open its tools and tap <b>Scan text</b>: photograph a cap and tap Insert, and its code is read.';
  }
  // (v303) a key pressed just before text arrives: typing. Scan Text puts its text in without any key, so composed text
  // (a pinyin or Japanese keyboard) that follows keys is typing on an iPad too, not a cap read half-way
  box.addEventListener('keydown', function () {
    keyAt = Date.now();
  });
  // (v308.6) Scan Text on iPadOS 27 puts what it reads in as a composition (insertCompositionText) and takes it out
  // itself (deleteCompositionText) when the cap leaves view. Clearing the box while that composition is open broke
  // Scan Text for the rest of the visit: the camera went on reading, nothing more arrived. So the box is never cleared
  // by the app during a composition; Scan Text clears its own text, and the next cap is read as it arrives.
  box.addEventListener('compositionstart', function () {
    scanIme = true;
  });
  // (v317) Android: text read during a composition that a keyboard then leaves in the box (Gboard's Scan text, if it
  // puts its text in as a composition) is cleared once the composition ends, so the next cap's text can't run on
  // into it. Not on an iPad: Scan Text takes its own text out (above)
  let imeLeft = '';
  box.addEventListener('compositionend', function () {
    scanIme = false;
    if (ANDROID && imeLeft && box.value === imeLeft) {
      set('');
      scanText = '';
      box.dispatchEvent(new Event('scanreset'));
    }
    imeLeft = '';
  });
  const set = function (v) {
    if (scanIme && v === '') {
      if (typeof scanTraceAdd === 'function') scanTraceAdd('left for Scan Text to clear');
      imeLeft = box.value;
      return;
    }
    box.value = v;
    was = v;
    scanAddState();
    if (typeof scanTraceAdd === 'function') scanTraceAdd('cleared by the app' + (v ? ' to ' + v.length : ''));
  };
  // (v299) pend: text read and about to be cleared; waiting: text arrived and waits to hold still
  let pend = '',
    waiting = false;
  const settle = function () {
    waiting = false;
    const text = box.value;
    if (text !== scanText) {
      scanText = text;
      wasN = scanHandle(text, false);
      if (typeof scanTraceAdd === 'function') scanTraceAdd('read: ' + wasN + ' found');
    } else if (typeof scanTraceAdd === 'function') scanTraceAdd('held still, read already');
    pend = text;
    scanStill = setTimeout(
      function () {
        pend = '';
        if (box.value === text) set('');
        scanText = '';
      },
      wasN ? 250 : 1500,
    );
  };
  box.addEventListener('scanreset', function () {
    was = '';
    pend = '';
    waiting = false;
  });
  box.addEventListener('input', function (e) {
    tr('input', e);
    clearTimeout(scanStill);
    // (Add reads text left in the box: on while there's some)
    scanAddState();
    const wasWaiting = waiting;
    waiting = false;
    const v = box.value,
      before = was,
      typed = e.inputType === 'insertText' && !e.isComposing && e.data && e.data.length === 1;
    was = v;
    // a letter typed while what Scan Text left is about to be cleared: that goes, the letter stays (v299: they ran
    // together, "R014E4")
    if (
      pend &&
      before === pend &&
      typed &&
      v.length === pend.length + 1 &&
      v.slice(0, pend.length) === pend
    ) {
      set(v.slice(pend.length));
      pend = '';
      scanText = '';
      return;
    }
    pend = '';
    if (typed) return; // typing
    if (e.inputType === 'deleteCompositionText' && !v) {
      // (Scan Text took its text out: the next cap is read afresh)
      pend = '';
      scanText = '';
      return;
    }
    if (e.inputType && e.inputType.indexOf('delete') === 0) return;
    // (v317) Android: text arriving two or more characters at once (Gboard's Scan text on Insert, voice typing, a
    // clipboard chip; Copic's W1 is two), whether or not it comes as a composition or after Gboard's key 229, is a read: Gboard composes
    // what's typed a letter at a time, and a cap's text has no Enter after it. (Chrome's IME, driven from the test
    // harness, put "E75 Light Rose Taupe" in as one composition after key 229: the rules below took it for typing, and
    // it waited for Enter.) Not a word being typed that grows by a suggestion tapped or a correction ("Ta" to
    // "Taupe ", "e75" to "E75 "): still one word, the same word
    if (ANDROID) {
      let p = 0;
      while (p < before.length && p < v.length && before[p] === v[p]) p++;
      const added = v.length - p,
        word = before.slice(before.search(/\S*$/)),
        stem = before.length - word.length,
        oneWord = !!word && p >= stem && !/\s\S/.test(v.slice(stem).trim());
      // (the same text sent again as the composition is committed, after Gboard's key: still that read, not typing)
      if ((added >= 2 && !oneWord) || (wasWaiting && v === before)) {
        if (typeof scanTraceAdd === 'function')
          scanTraceAdd(
            added ? 'android: ' + added + ' characters at once, a read' : 'android: the same, still a read',
          );
        waiting = true;
        scanStill = setTimeout(settle, 600);
        return;
      }
    }
    if (
      ANDROID &&
      (e.isComposing || e.inputType === 'insertCompositionText') &&
      v.length === before.length + 1 &&
      v.slice(0, before.length) === before
    )
      return; // typing, composed (Android only: what Scan Text shows as it reads could come the same way, v299)
    if ((e.isComposing || e.inputType === 'insertCompositionText') && Date.now() - keyAt < 1000) return;
    waiting = true;
    scanStill = setTimeout(settle, 600);
  });
  // a paste is read at once, as pasted (a one-line box would run a list's lines together)
  box.addEventListener('paste', function (e) {
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    // (v318 review) more text than any list of markers (a whole web page copied): said, not read, as a file too big is;
    // reading it froze the page for seconds
    if (scanTooBig(text, 'What was pasted')) return;
    clearTimeout(scanStill);
    // (what Scan Text had put in the box, waiting to hold still, is read first and cleared; v299: it was left there)
    if (waiting && box.value.trim()) {
      if (box.value !== scanText) scanHandle(box.value, false);
      set('');
    } else if (pend && box.value === pend) set('');
    waiting = false;
    pend = '';
    scanText = '';
    scanHandle(text, true);
  });
  // (v303) a composition (a pinyin or Japanese keyboard) under way, or just ended: Safari's Enter that ends one can come
  // as key 229 with isComposing false, and isn't an Enter to read the box
  let composing = false,
    composedAt = 0;
  box.addEventListener('compositionstart', function () {
    composing = true;
  });
  box.addEventListener('compositionend', function () {
    composing = false;
    composedAt = Date.now();
  });
  box.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || composing) return;
    if (e.keyCode === 229 && Date.now() - composedAt < 200) return;
    e.preventDefault();
    clearTimeout(scanStill);
    // (read now; the same text arriving again afterwards is read again, a new cap)
    scanText = '';
    pend = '';
    waiting = false;
    if (scanHandle(box.value, true)) set('');
  });
})();
