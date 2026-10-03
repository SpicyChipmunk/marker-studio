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
          if (!told && sfmode === 'color') toast('Your screen stays on while you colour along.', 3600);
          if (w && w.addEventListener)
            w.addEventListener('release', function () {
              wakeLock = null;
            });
        })
        .catch(function () {});
    }
  } catch (_) {}
}
function relWake() {
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
  let code = '';
  assignData.order.forEach(function (l) {
    const m = assignData.assign[l];
    if (m.mkey === k && hlMatch(l)) {
      code = m.code;
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
    toastAction(
      (done ? 'Marked all ' : 'Cleared ') + esc(code) + (done ? ' coloured' : ''),
      'Undo',
      function () {
        if (g !== loadGen || !assignData || comps.length !== K) return;
        const P = tp();
        for (const l in was) {
          if (!assignData.assign[l] || (done ? !colored[l] : colored[l])) continue;
          colored[l] = was[l][0];
          P[l] = was[l][1];
          // (with the shading they were coloured with: 34-zones)
          if (was[l][2]) heldSet(l, was[l][2]);
          else if (done) heldSet(l, null);
        }
        guideDirty = true;
        if (done) celebrated = false;
        normalizeTones();
        renderGuide();
        updateProgress();
        renderFocusMarkers();
        sayLive((done ? 'Ticks as they were for ' : 'Ticks back for ') + code);
      },
    );
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
      '.</p>',
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
        tc = txt(e.m.hex);
      return (
        '<button class="focmk' +
        (act ? ' on' : '') +
        (full ? ' done' : '') +
        '" data-k="' +
        esc(e.k) +
        '" style="background:' +
        e.m.hex +
        ';color:' +
        tc +
        '"><span class="fmc">' +
        e.m.code +
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
function enterColor() {
  zoneEditEnd(true);
  heldNoteClear();
  if (!assignData) return;
  if (popOpen()) closeSwatchPop();
  hideTip();
  normalizeTones();
  sfmode = 'color';
  hlKey = null;
  hlZone = null;
  blendOpen = {};
  alDoneOpen = false;
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
  renderGuide();
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
  focusFin = false;
  focusSheet = false;
  focusHist = [];
  focusPos = -1;
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
  // modal for the keyboard (75-focus.js); a toast from the list would sit over its buttons
  hideToast();
  focusModal(true);
  focusIn();
}
function fitFocus() {
  if (!root.classList.contains('sffoc') || !sfView) return;
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
  focus = false;
  focusFin = false;
  focusSheet = false;
  // (the row of the marker Focus mode was on once it has moved on from where it started, so you carry on where you
  // were; left at once, or finished, the row it started from, v287)
  let _fk = _focK && alongEntry(_focK) ? _focK : null;
  if (_fl >= 0 && focusPos !== _focAt) {
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
  resetZoom();
  renderControls();
  renderGuide();
  backScroll();
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
