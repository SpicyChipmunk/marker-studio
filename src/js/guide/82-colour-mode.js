function reqWake() {
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock
        .request('screen')
        .then(function (w) {
          wakeLock = w;
          // (the first time, say so: people put their phone down between sections)
          let told = true;
          try {
            told = !!localStorage.getItem('ms-wake-told');
            localStorage.setItem('ms-wake-told', '1');
          } catch (_) {}
          // (v308: in the tool row's status for a few seconds, "12 of 216 coloured · screen stays on", not a toast,
          // which covered the rows)
          if (!told && sfmode === 'color') wakeSay();
          if (w && w.addEventListener)
            w.addEventListener('release', function () {
              wakeLock = null;
            });
        })
        .catch(function () {});
    }
  } catch (_) {}
}
function wakeSay() {
  _wakeUntil = Date.now() + 5000;
  renderTools();
  // (v308 debug: side by side, as on an iPad held sideways, and on a phone, the tool row shows only "12 of 216": there
  // the toast says it, as before v308, or it was never seen, the one time it's said)
  requestAnimationFrame(function () {
    const s = document.querySelector('#sfStat .sfsp2');
    if (sfmode === 'color' && !(s && s.getBoundingClientRect().width > 0)) {
      _wakeUntil = 0;
      renderTools();
      toast(WAKE_SAY, 3600);
    } else sayLive(WAKE_SAY);
  });
  setTimeout(function () {
    _wakeUntil = 0;
    renderTools();
  }, 5000);
}
const WAKE_SAY = 'Your screen stays on while you colour along.';
function relWake() {
  _wakeUntil = 0;
  if (wakeLock) {
    try {
      wakeLock.release();
    } catch (_) {}
    wakeLock = null;
  }
}
// ✓ Mark all coloured / Clear for the open marker (the highlighted one). Clearing says so with an Undo that puts
// the ticks (and tones part-way done) back, keeping any ticked since
function markActive(done) {
  if (!hlKey || !assignData) return;
  guideDirty = true;
  const _P = tp(),
    k = hlKey,
    was = {},
    g = loadGen,
    K = comps.length;
  let mk = null;
  assignData.order.forEach(function (l) {
    const m = assignData.assign[l];
    if (m.mkey === k && hlMatch(l)) {
      mk = m;
      if (done ? !colored[l] : colored[l] || _P[l]) was[l] = [colored[l], _P[l], heldSh[l] || null];
      colored[l] = done ? 1 : 0;
      _P[l] = 0;
    }
  });
  const wasC = celebrated;
  checkComplete();
  renderGuide();
  updateProgress();
  renderFocusMarkers();
  // (marking all done says so with an Undo too, putting back which were really done: a mis-tap lost that, v299;
  // not when that finished the page: "Page finished!" is said then, with nothing over it)
  if (Object.keys(was).length && !(done && celebrated && !wasC))
    toastActionHTML(
      // (v307: the code with its brand, as a code in both brands needs)
      (done ? 'Marked all ' : 'Cleared ') + mcodeHTML(mk) + (done ? ' coloured' : ''),
      'Undo',
      function () {
        if (g !== loadGen || !assignData || comps.length !== K) return;
        markBack(was, done);
        renderGuide();
        updateProgress();
        renderFocusMarkers();
        // (v308.2: Focus mode opened since, the toast still up: its section's Done and Undo redrawn too)
        if (focus && typeof renderFocusUI === 'function') renderFocusUI();
        sayLive((done ? 'Ticks as they were for ' : 'Ticks back for ') + msay(mk));
      },
    );
}
// Undo of Mark all (or Clear), here and in Focus mode (75-focus focusAllOfColour, v311: its own had left the kept
// shading as Mark all made it): the ticks and part-done tones as they were, with the shading they were coloured with
// (34-zones), keeping any ticked (or, after Clear, unticked) since. was: { section: [tick, tones, kept shading] }
function markBack(was, done) {
  const P = tp();
  for (const l in was) {
    if (!assignData.assign[l] || (done ? !colored[l] : colored[l])) continue;
    colored[l] = was[l][0];
    P[l] = was[l][1];
    if (was[l][2]) heldSet(l, was[l][2]);
    else if (done) heldSet(l, null);
  }
  guideDirty = true;
  // (no longer finished: finishing it again celebrates again)
  if (done) celebrated = false;
  normalizeTones();
}
// (v318.35) A page partly coloured in already (E1-3): once its guide is built from sections found afresh, the sections
// coloured in (colourSecs, 10-segment) are offered as done, in a toast with a button, after the first build's bloom.
// Never marked done by themselves: a fill the app reads as a marker's may be a wash or a print's tint. Taking the
// offer ticks them, and says so with an Undo that puts the ticks back as they were (markBack, as Mark all has)
function colourOffer() {
  if (!assignData || !chroma) return;
  let secs;
  try {
    secs = colourSecs().filter(function (l) {
      return assignData.assign[l] && !colored[l];
    });
  } catch (e) {
    return;
  }
  const n = secs.length;
  if (!n) return;
  const g = loadGen,
    K = comps.length;
  bloomAfter(function () {
    if (g !== loadGen || !assignData || comps.length !== K) return;
    toastAction(
      n === 1 ? 'One section looks coloured in already.' : n + ' sections look coloured in already.',
      n === 1 ? 'Mark it done' : 'Mark them done',
      function () {
        if (g !== loadGen || !assignData || comps.length !== K) return;
        const was = {},
          P = tp();
        secs.forEach(function (l) {
          if (!assignData.assign[l] || colored[l]) return;
          was[l] = [colored[l], P[l], heldSh[l] || null];
          colored[l] = 1;
          P[l] = 0;
        });
        const k = Object.keys(was).length;
        if (!k) return;
        guideDirty = true;
        const wasC = celebrated;
        checkComplete();
        renderGuide();
        updateProgress();
        if (sfmode === 'color') renderFocusMarkers();
        if (celebrated && !wasC) return;
        toastAction(
          k === 1 ? 'Marked 1 section done' : 'Marked ' + k + ' sections done',
          'Undo',
          function () {
            if (g !== loadGen || !assignData || comps.length !== K) return;
            markBack(was, true);
            renderGuide();
            updateProgress();
            if (sfmode === 'color') renderFocusMarkers();
            sayLive('Ticks as they were');
          },
        );
      },
      12000,
    );
  });
}
// how many sections are ticked, or part-way done (a tone ticked): what Reset progress would clear
function progressCount() {
  if (!assignData || !colored) return 0;
  const pt = tonePart && tonePart._c === colored ? tonePart : null;
  let n = 0;
  for (let l = 1; l < colored.length; l++) if (colored[l] || (pt && pt[l])) n++;
  return n;
}
// Reset progress (⋯ in Colour along) asks first, in the guide's own sheet; it isn't offered with nothing ticked
function askResetProgress() {
  const n = progressCount();
  if (!n) return;
  const el = openSheet({
    title: 'Reset progress?',
    body:
      '<p class="sfshtext">This clears what you\u2019ve coloured on ' +
      n +
      (n === 1 ? ' section' : ' sections') +
      '.' +
      // (v314: the photo of the finished page stays)
      (finHas() ? ' Your photo of the page is kept, and shows again once the page is finished.' : '') +
      '</p>',
    foot: '<button type="button" class="sfghost" data-rp="cancel">Cancel</button><button type="button" id="sfResetGo" class="sfprimary" data-rp="go">Reset</button>',
    fit: true,
  });
  el.classList.add('sfasksh');
  el.addEventListener('click', function (e) {
    const b = e.target.closest('[data-rp]');
    if (!b) return;
    closeSheet();
    if (b.dataset.rp === 'go') resetProgress();
  });
}
function resetProgress() {
  if (!assignData) return;
  const pc = colored,
    pt = tonePart && tonePart._c === colored ? tonePart : null,
    pcel = celebrated,
    pat = progAt,
    phs = Object.assign({}, heldSh),
    g = loadGen,
    K = comps.length;
  let any = false;
  for (let l = 1; l < pc.length && !any; l++) if (pc[l] || (pt && pt[l])) any = true;
  guideDirty = true;
  colored = new Uint8Array(comps.length);
  celebrated = false;
  progAt = { s: 0, e: 0 };
  hlKey = null;
  hlZone = null;
  renderGuide();
  updateProgress();
  // Undo puts the ticks (and tones part-way done) back, keeping any ticked since
  if (any)
    toastAction('Progress reset', 'Undo', function () {
      if (g !== loadGen || !assignData || comps.length !== K || pc.length !== K) return;
      const now = colored;
      for (let l = 1; l < K; l++)
        if (now[l]) {
          pc[l] = 1;
          if (pt) pt[l] = 0;
        }
      colored = pc;
      tonePart = pt;
      celebrated = pcel;
      progAt = pat;
      for (const l in phs) if (!heldSh[l]) heldSet(l, phs[l]);
      progStamp();
      guideDirty = true;
      normalizeTones();
      renderGuide();
      updateProgress();
    });
}
function renderFocusMarkers() {
  var el = document.getElementById('sfFocMk');
  if (!el || !assignData) return;
  // (Colour along zone by zone: a chip for each marker in each zone, as the list has a row for each, zone by zone)
  var map = {},
    byZ = alongZones(),
    zi = {};
  zoneIds().forEach(function (id, i) {
    zi[id] = i;
  });
  assignData.order.forEach(function (l) {
    var z = byZ ? zoneOf(l) : null,
      k = alongKey(assignData.assign[l].mkey, z);
    if (!map[k]) map[k] = { m: assignData.assign[l], n: 0, d: 0, k: k, z: z };
    map[k].n++;
    if (colored[l]) map[k].d++;
  });
  var arr = Object.keys(map).map(function (k) {
    return map[k];
  });
  var fo = {};
  focusOrd.forEach(function (l, i) {
    var k = alongKey(assignData.assign[l].mkey, byZ ? zoneOf(l) : null);
    if (!(k in fo)) fo[k] = i;
  });
  arr.sort(function (a, b) {
    var af = a.d >= a.n,
      bf = b.d >= b.n;
    if (af !== bf) return af ? 1 : -1;
    return (
      (byZ ? zi[a.z] - zi[b.z] : 0) ||
      (fo[a.k] != null ? fo[a.k] : 1e9) - (fo[b.k] != null ? fo[b.k] : 1e9) ||
      b.n - b.d - (a.n - a.d)
    );
  });
  el.innerHTML = arr
    .map(function (e) {
      var full = e.d >= e.n,
        act = hlKey === e.m.mkey && (e.z == null || hlZone === e.z),
        // (v320, G1-11) a colour neither text reads on at 4.5:1 (Ohuhu RV212's pink: 4.2 white, 4.4 dark) takes white
        // words with a dark halo: dark words with a light halo read as pink on pink
        weak = txtWeak(e.m.hex),
        tc = weak ? '#fff' : txt(e.m.hex);
      return (
        '<button class="focmk' +
        (act ? ' on' : '') +
        (full ? ' done' : '') +
        // (v308.3: a colour neither text reads on at 4.5:1 gets a halo round its words, dark under white, light under dark)
        (weak ? ' fmhalo' : '') +
        '" data-k="' +
        esc(e.k) +
        '" style="background:' +
        e.m.hex +
        ';color:' +
        tc +
        '"><span class="fmc">' +
        // (v307: a screen reader hears the brand too)
        (brandsMixed() ? '<span class="sfsr">' + esc(e.m.brand) + ' </span>' : '') +
        esc(capLabel(e.m)) +
        '</span>' +
        (e.z != null ? '<span class="fmz">' + esc(zoneName(e.z)) + '</span>' : '') +
        '<span class="fmn">' +
        e.d +
        '/' +
        e.n +
        (full ? ' <span aria-hidden="true">\u2713</span>' : '') +
        '</span></button>'
      );
    })
    .join('');
}

// Colour along: markers already finished are gathered in a collapsed "Done (n)" group at the bottom of the list
// (paint false: not painted here, as something else paints it next: Home's Continue, v307)
function enterColor(paint) {
  photoSettleNow();
  zoneEditEnd(true);
  heldNoteClear();
  if (!assignData || guideWhite()) return;
  // (v318.28) a plan step's toast Undo does nothing in Colour along: it goes
  planToastOff();
  if (popOpen()) closeSwatchPop();
  hideTip();
  normalizeTones();
  sfmode = 'color';
  // (v318.34: a guide you've worked with, for Random; library.js)
  if (typeof guideWorked === 'function') guideWorked(curId);
  hlKey = null;
  hlZone = null;
  blendOpen = {};
  alDoneOpen = false;
  // (a marker finished before now doesn't light up as just finished: alongFlash)
  _alFull = null;
  findForget();
  alDone = alongList()
    .filter(function (e) {
      return e.d >= e.n;
    })
    .map(function (e) {
      return e.key;
    });
  reqWake();
  stageGo();
  renderControls();
  if (paint !== false) renderGuide();
  updateProgress();
}
function exitColor() {
  if (focus) focusModal(false);
  if (_fnOl) {
    _fnOl = false;
    outlineSecs(null);
  }
  sfmode = 'guide';
  // (coloured sections keep their shading from here on: heldSh; the plan's toast about them may say so again)
  heldSweep();
  _heldTold = 0;
  hlKey = null;
  hlZone = null;
  focus = false;
  if (sfView) sfView.style.paddingTop = sfView.style.paddingBottom = '';
  var _rt = document.getElementById('sfRoot');
  if (_rt) _rt.classList.remove('sffoc');
  railSync();
  relWake();
  stageGo();
  renderControls();
  renderGuide();
}
// leaving focus mode opens the list's row that was open before it again (focus mode moves the highlight meanwhile)
let _focK = null,
  _focAt = -1;
function enterFocus() {
  if (sfmode !== 'color' || !assignData) return;
  if (typeof guideWorked === 'function') guideWorked(curId);
  if (_fnOl) {
    _fnOl = false;
    outlineSecs(null);
  }
  exitFull();
  var pref = hlKey,
    prefZ = hlZone;
  _focK = alongKey(hlKey, hlZone);
  closeSheet();
  holdScroll();
  focus = true;
  // (v315: the hand-off card's side chosen afresh for each visit)
  handFrame.last = null;
  focusFin = false;
  focusSheet = false;
  focusHist = [];
  focusPos = -1;
  _hand = -1;
  root.classList.add('sffoc');
  renderControls();
  buildFocusOrder();
  var start = -1;
  if (pref) {
    for (var i = 0; i < focusOrd.length; i++) {
      var l = focusOrd[i];
      if (
        assignData.assign[l].mkey === pref &&
        (prefZ == null || zoneOf(l) === prefZ) &&
        !stepDone(l, stepBits(i))
      ) {
        start = i;
        break;
      }
    }
  }
  if (start < 0) start = nextUndone(-1);
  focusPos = start < 0 ? focusOrd.length - 1 : start;
  if (start < 0) focusFin = true;
  renderFocusUI();
  fitFocus();
  if (start < 0) finishFocus();
  else goFocus(start, false);
  _focAt = focusPos;
  // (v318.32 decision 6.10) framed again once the bars have measured: on an iPad held upright, Safari had laid out the
  // bars after the entry's frame, which used their heights before (and the picture showed whole, with a blank band
  // above, until Done framed the next section). Nothing moves when their measure is unchanged
  focusRefit(true);
  requestAnimationFrame(function () {
    requestAnimationFrame(focusRefit);
  });
  setTimeout(focusRefit, 350);
  // modal for the keyboard (75-focus.js); a toast from the list would sit over its buttons
  hideToast();
  focusModal(true);
  focusIn();
}
// (v318.32 decision 6.10) the room between the bars as it was last framed, and the frame done again when it has changed
// since (remember: only notes the measure; from a frame or a timer after Focus is entered: fits and frames again)
var _focFit = null;
function focusRefit(remember) {
  if (!focus || !sfView || !root.classList.contains('sffoc')) return;
  var tb = document.querySelector('.sffocbar'),
    bb = document.querySelector('.sffocbot');
  if (tb) document.documentElement.style.setProperty('--focTop', tb.offsetHeight + 'px');
  if (bb) document.documentElement.style.setProperty('--focBot', bb.offsetHeight + 'px');
  var g = focusGeo(true),
    was = _focFit;
  _focFit = { t: g.t, b: g.b, aw: g.aw, ah: g.ah };
  if (remember === true) return;
  if (was && was.t === g.t && was.b === g.b && was.aw === g.aw && was.ah === g.ah) return;
  fitFocus();
  if (handOn()) return handReframe();
  var l = focusCur();
  if (focusFin || l < 0) return;
  focusZ = focusZoomFor(l);
  frameFocus(false);
}
function fitFocus() {
  if (!root.classList.contains('sffoc') || !sfView) return;
  railSync();
  var g = focusGeo();
  sfView.style.paddingTop = g.t + 'px';
  sfView.style.paddingBottom = g.b + 'px';
  sizeCanvas();
}
function exitFocus() {
  const _fl = focusCur(),
    ae = document.activeElement,
    back =
      !ae ||
      ae === document.body ||
      focusParts().some(function (p) {
        return p.contains(ae);
      });
  focusModal(false);
  handClose(false);
  focus = false;
  focusFin = false;
  focusSheet = false;
  // (the row of the marker Focus mode was on once it has moved on from where it started, so you carry on where you
  // were; left at once, or finished, the row it started from, v287)
  // (v307: a page finished leaves no row open, so the whole picture shows in its colours)
  let _fk = _focK && alongEntry(_focK) && !pageDone() ? _focK : null;
  if (_fl >= 0 && focusPos !== _focAt && !pageDone()) {
    const _l = _fl,
      _m = _l >= 0 && assignData && assignData.assign[_l];
    const _k = _m ? alongKey(_m.mkey, zoneOf(_l)) : null;
    if (_k && alongEntry(_k)) _fk = _k;
  }
  alongSet(_fk);
  _focK = null;
  if (_fk && alDone.indexOf(_fk) >= 0) alDoneOpen = true;
  clearTimeout(_ftT);
  if (cv) cv.style.transition = '';
  if (sfView) {
    sfView.style.paddingTop = sfView.style.paddingBottom = '';
  }
  root.classList.remove('sffoc');
  railSync();
  resetZoom();
  renderControls();
  renderGuide();
  backScroll();
  doneAfterFocus();
  if (_fk)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        alongReveal(true);
      });
    });
  if (back) {
    const b = document.getElementById('sfFocus');
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
  }
}
