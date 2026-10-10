/* ---- Mood pictures (v310) ----
   The Colours tab's Mood as six small pictures of the page, each laid in that mood with your markers: you see what a
   mood does before you tap it. The current mood's picture is the guide itself. Shown where Mood can change the guide
   by itself: not with zones, the Photo or Manual pattern, or a palette used as it is (where Mood is the row of buttons
   it was, in its place, greyed out as before).

   How a picture is made, while nothing else is going on (mpStep): everything laying the plan can change is kept
   (mpSave), the mood is laid by exactly the steps a tap takes (Mood's handler: generatePalette when the palette is
   generated, then layPlan, 30-palette-assign) with Math.random drawn from a seed, its colours read, and everything put
   back (mpRestore) — all in one go, so nothing draws in between. Then a check: the plan as Undo sees it, and every
   value kept, must be as before; if not, it is put back as Undo would and the pictures stop for this visit (in the
   tests, an error). A tap on a mood whose picture was made from the guide as it is now lays it with that picture's
   seed, so it comes out as the picture showed; the pictures are made again, with new seeds, after every change, so a
   mood left and come back to is a new roll, as a tap on it was before. Nothing here is saved or is an Undo step. */
const MP_WAIT = 600, // after the Plan last changed or was drawn
  MP_GAP = 30, // between one mood's picture and the next
  MP_MAX = 220; // a picture's longer side, in pixels
let _mp = { key: '', pics: {}, seeds: {}, sigs: {}, t: 0, off: false },
  _mpQuiet = false,
  _mpBins = null;
// the fingers (or the mouse button) down: no picture is made meanwhile, the page stays as it is under them
const _mpPtrs = new Set();

// the row is pictures (else Mood's buttons, as before)
function mpShow() {
  return (
    !!labels &&
    !!assignData &&
    family !== 'photo' &&
    family !== 'manual' &&
    !zones.length &&
    !((paletteSource === 'saved' || (paletteSource === 'generate' && !!fromPal)) && curSeedLen() > 0)
  );
}
// the pictures are made (the tests turn them on where they look at them: they take a moment after each change)
function mpOn() {
  if (_mp.off) return false;
  if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST) {
    try {
      return localStorage.getItem('ms-test-moodpics') === '1';
    } catch (_) {
      return false;
    }
  }
  return true;
}
// what the pictures were made from: the plan as Undo keeps it, the filters, the markers to use and what's coloured
// (sections with ink keep their markers when a plan is laid again)
function mpKey() {
  const p = planSnap();
  if (!p) return '';
  let ink = '';
  if (colored) for (let l = 1; l < comps.length; l++) if (inkOn(l)) ink += l + ',';
  return (
    p.js +
    '|' +
    p.filt +
    '|' +
    coll
      .map(function (m) {
        return m.mkey;
      })
      .join(',') +
    '|' +
    ink
  );
}
// Math.random drawn from `seed` while fn runs (a mulberry32), and given back after
function mpSeeded(seed, fn) {
  const was = Math.random;
  let a = seed >>> 0;
  Math.random = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = was;
  }
}
// what laying a plan can change, kept: the values as they are (objects changed in place, as copies). From the audit
// of v310: assignData and the style values are replaced, never changed in place, when a plan is laid.
function mpSave() {
  const st = {};
  ZONE_KEYS.forEach(function (k) {
    st[k] = STYLE_VAR[k];
  });
  return {
    st: st,
    radC: radC,
    assignData: assignData,
    locks: locks,
    anchors: anchors,
    zSig: _zSig,
    origKeys: _origKeys,
    origCopy: Object.assign({}, _origKeys),
    selAnchor: selAnchor,
    guideDirty: guideDirty,
    lastPoolN: lastPoolN,
    heldRun: _heldRun,
    mk: _mkOpened,
    mkCopy: Object.assign({}, _mkOpened),
    bs: _blendSel,
    bsCopy: Object.assign({}, _blendSel),
    bst: balStat,
    bstCopy: Object.assign({}, balStat),
    held: heldSh,
    heldCopy: Object.assign({}, heldSh),
    heldVer: _heldVer,
    phNone: _phNone,
    phNoneCopy: Object.assign({}, _phNone),
    phErr: _phErr,
    phStats: _phStats,
    phCol: _phCol,
    phSug: _phSug,
    tests: [gradScatLast, gradSmoothLast, gradFixLast, gradSameLast, gradTourWork],
    planLast: planLast,
    planN: planStack.length,
    planFwdN: planFwd.length,
  };
}
// everything mpSave kept, back as it was
function mpRestore(s) {
  ZONE_KEYS.forEach(function (k) {
    if (k !== 'radC') STYLE_VAR[k] = s.st[k];
  });
  // (radC's setter makes a copy: the very value, back)
  radC = s.radC;
  assignData = s.assignData;
  locks = s.locks;
  anchors = s.anchors;
  _zSig = s.zSig;
  // (the same objects, their contents as they were: other code may hold them)
  mpRefill(s.origKeys, s.origCopy);
  _origKeys = s.origKeys;
  selAnchor = s.selAnchor;
  guideDirty = s.guideDirty;
  lastPoolN = s.lastPoolN;
  _heldRun = s.heldRun;
  mpRefill(s.mk, s.mkCopy);
  _mkOpened = s.mk;
  mpRefill(s.bs, s.bsCopy);
  _blendSel = s.bs;
  mpRefill(s.bst, s.bstCopy);
  balStat = s.bst;
  // (the held shading only through heldReset, whose count the caches go by: a count never goes back, v304)
  if (_heldVer !== s.heldVer || heldSh !== s.held) heldReset(s.heldCopy);
  mpRefill(s.phNone, s.phNoneCopy);
  _phNone = s.phNone;
  _phErr = s.phErr;
  _phStats = s.phStats;
  _phCol = s.phCol;
  if (_phSug !== s.phSug) {
    if (_phSug && _phSug.timer) clearTimeout(_phSug.timer);
    _phSug = s.phSug;
  }
  gradScatLast = s.tests[0];
  gradSmoothLast = s.tests[1];
  gradFixLast = s.tests[2];
  gradSameLast = s.tests[3];
  gradTourWork = s.tests[4];
}
function mpRefill(o, copy) {
  for (const k in o) if (!(k in copy)) delete o[k];
  for (const k in copy) o[k] = copy[k];
}
// what's different from what mpSave kept (empty: nothing)
function mpDiff(s, js) {
  const d = [];
  ZONE_KEYS.forEach(function (k) {
    if (k !== 'radC' && STYLE_VAR[k] !== s.st[k]) d.push(k);
  });
  if (radC !== s.radC) d.push('radC');
  if (assignData !== s.assignData) d.push('assignData');
  if (locks !== s.locks) d.push('locks');
  if (anchors !== s.anchors) d.push('anchors');
  if (_zSig !== s.zSig) d.push('_zSig');
  if (selAnchor !== s.selAnchor) d.push('selAnchor');
  if (guideDirty !== s.guideDirty) d.push('guideDirty');
  if (lastPoolN !== s.lastPoolN) d.push('lastPoolN');
  if (_heldRun !== s.heldRun) d.push('_heldRun');
  if (planLast !== s.planLast || planStack.length !== s.planN || planFwd.length !== s.planFwdN)
    d.push('undo');
  if (JSON.stringify(_mkOpened) !== JSON.stringify(s.mkCopy)) d.push('_mkOpened');
  if (JSON.stringify(_origKeys) !== JSON.stringify(s.origCopy)) d.push('_origKeys');
  const p = planSnap();
  if (!p || p.js !== js) d.push('plan');
  return d;
}
// one mood laid from the guide as it is, with `seed`: its colours, section by section ({ l: hex }), or null when the
// plan couldn't be laid in it. The guide is left exactly as it was.
function mpLay(k, seed) {
  const before = planSnap();
  if (!before) return null;
  const s = mpSave();
  let out = null,
    err = null;
  _mpQuiet = true;
  try {
    // (the same steps, in the same order, as a tap on it: mpTap, reassign's `how`)
    emphasis = k;
    if (
      mpSeeded(seed, function () {
        if (genMade()) generatePalette();
        return layPlan();
      }) !== false &&
      assignData
    ) {
      out = {};
      for (const l in assignData.assign) out[l] = assignData.assign[l].hex;
      if (assignData.paper) for (const l in assignData.paper) delete out[l];
    }
  } catch (e) {
    err = e;
  } finally {
    _mpQuiet = false;
    mpRestore(s);
  }
  // (checked however the laying ended: something it changed that wasn't kept, or an error part way, and the guide is
  // put back as Undo would, with no more pictures this visit)
  const d = mpDiff(s, before.js);
  if (d.length || err) {
    _mp.off = true;
    if (d.length)
      try {
        planRestore(before, true);
      } catch (_) {}
    if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST)
      throw err || new Error('Mood picture left the guide changed: ' + d.join(', '));
    return null;
  }
  return out;
}
// a picture's colours, as a short signature (to check a tap laid what its picture showed)
function mpSig(cols) {
  if (!cols) return '';
  let s = '';
  for (const l in cols) s += l + cols[l] + ';';
  return s;
}
function mpSigNow() {
  if (!assignData) return '';
  const cols = {};
  for (const l in assignData.assign) cols[l] = assignData.assign[l].hex;
  if (assignData.paper) for (const l in assignData.paper) delete cols[l];
  return mpSig(cols);
}

/* ---- Drawing: the page small, its lines and each section's colour (no codes, shading or texture) ---- */
function mpSize() {
  const k = MP_MAX / Math.max(W, H);
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}
// which small pixel each pixel of the page falls in, worked out once for the page (labels: the sections map)
function mpBins() {
  if (_mpBins && _mpBins.labels === labels && _mpBins.W === W && _mpBins.H === H) return _mpBins;
  const sz = mpSize(),
    // (every pixel at most 2 apart counted: enough for the lines to show, quick on a big page)
    step = Math.max(1, Math.floor(Math.min(W / sz.w, H / sz.h) / 3)),
    px = [],
    bin = [];
  for (let y = 0; y < H; y += step) {
    const by = Math.min(sz.h - 1, ((y * sz.h) / H) | 0);
    for (let x = 0; x < W; x += step) {
      px.push(y * W + x);
      bin.push(by * sz.w + Math.min(sz.w - 1, ((x * sz.w) / W) | 0));
    }
  }
  _mpBins = {
    labels: labels,
    W: W,
    H: H,
    w: sz.w,
    h: sz.h,
    px: Int32Array.from(px),
    bin: Int32Array.from(bin),
  };
  return _mpBins;
}
// the picture's pixels, from each section's colour (cols: { l: hex }; null: the lines only, for a picture to come)
function mpImage(cols) {
  const b = mpBins(),
    n = b.w * b.h,
    r = new Float32Array(n),
    g = new Float32Array(n),
    bl = new Float32Array(n),
    c = new Uint16Array(n),
    rgb = {};
  for (let i = 0; i < b.px.length; i++) {
    const l = labels[b.px[i]],
      o = b.bin[i];
    let col;
    if (l === -1) col = cols ? LINE : [150, 154, 152];
    else if (cols && cols[l]) col = rgb[l] || (rgb[l] = hexRgb(cols[l]));
    else col = PAPER;
    r[o] += col[0];
    g[o] += col[1];
    bl[o] += col[2];
    c[o]++;
  }
  const im = new ImageData(b.w, b.h),
    d = im.data;
  for (let o = 0, j = 0; o < n; o++, j += 4) {
    const k = c[o] || 1;
    d[j] = c[o] ? r[o] / k : PAPER[0];
    d[j + 1] = c[o] ? g[o] / k : PAPER[1];
    d[j + 2] = c[o] ? bl[o] / k : PAPER[2];
    d[j + 3] = 255;
  }
  return im;
}
function mpNowCols() {
  if (!assignData) return null;
  const cols = {};
  for (const l in assignData.assign) cols[l] = assignData.assign[l].hex;
  if (assignData.paper) for (const l in assignData.paper) delete cols[l];
  return cols;
}
// each card's picture: the guide for the mood it's in, a picture made for the others, the lines while one is to come
function mpPaint() {
  const row = document.getElementById('sfMood');
  if (!row || !row.classList.contains('sfmoodpics') || !labels) return;
  const fresh = mpOn() && !!_mp.key && _mp.key === mpKeyCached();
  row.querySelectorAll('.sfmp').forEach(function (bt) {
    const k = bt.dataset.v,
      cv = bt.querySelector('canvas');
    if (!cv) return;
    let im;
    if (k === emphasis) im = mpNowImage();
    else if (_mp.pics[k] && _mp.pics[k].im) im = _mp.pics[k].im;
    if (!im) im = mpLinesImage();
    if (cv.width !== im.width) cv.width = im.width;
    if (cv.height !== im.height) cv.height = im.height;
    cv.getContext('2d').putImageData(im, 0, 0);
    const p = _mp.pics[k];
    bt.classList.toggle('sfmpwait', k !== emphasis && !(p && p.im && fresh));
    const none = !!(p && p.none && fresh);
    bt.classList.toggle('sfmpnone', none);
    const sub = bt.querySelector('.sfmpsub');
    if (sub) sub.textContent = none ? 'Too few markers' : '';
  });
}
// (the key is worked out once per drawing of the Plan: planSnap goes through every section)
let _mpKeyAt = null;
function mpKeyCached() {
  if (!_mpKeyAt || _mpKeyAt.a !== assignData || _mpKeyAt.v !== _mpVer)
    _mpKeyAt = { a: assignData, v: _mpVer, k: mpKey() };
  return _mpKeyAt.k;
}
// goes up whenever the Plan is drawn (a change to anything the key reads draws it again)
let _mpVer = 0;
let _mpNowAt = null,
  _mpLinesAt = null;
// (v310.1: by the colours, not the plan's object: Change colour, Unpin and Fill change a section's marker in place)
function mpNowImage() {
  const sig = mpSigNow();
  if (!_mpNowAt || _mpNowAt.s !== sig || _mpNowAt.l !== labels)
    _mpNowAt = { s: sig, l: labels, im: mpImage(mpNowCols()) };
  return _mpNowAt.im;
}
function mpLinesImage() {
  if (!_mpLinesAt || _mpLinesAt.l !== labels) _mpLinesAt = { l: labels, im: mpImage(null) };
  return _mpLinesAt.im;
}

/* ---- When: one mood at a time, once nothing has happened for a moment and the row is in view ---- */
function mpSchedule(wait) {
  clearTimeout(_mp.t);
  _mp.t = 0;
  if (!mpOn() || sfmode !== 'guide' || !mpShow()) return;
  if (!MOOD_KEYS.some(mpWanted)) return;
  _mp.t = setTimeout(mpStep, wait == null ? MP_WAIT : wait);
}
// a mood whose picture is still to be made, for the guide as it is
function mpWanted(k) {
  return k !== emphasis && (_mp.key !== mpKeyCached() || !(k in _mp.pics));
}
function mpReady() {
  if (sfmode !== 'guide' || !labels || !assignData || gTab !== 'colours' || focus) return false;
  if (planDrag || popOpen() || paintOn || photoAlign || _mpPtrs.size) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  // (not while the first Build's bloom shows, 41-bloom: its frames are kept clear of other work; looked at again once
  // it's over)
  if (_bloom) {
    bloomAfter(mpWake);
    return false;
  }
  const row = document.getElementById('sfMood');
  if (!row || !row.classList.contains('sfmoodpics')) return false;
  const r = row.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
}
function mpStep() {
  _mp.t = 0;
  if (!mpOn() || !mpShow()) return;
  if (!mpReady()) {
    // (in view later, or once the finger is up: looked at again then, mpWake)
    return;
  }
  // (worked out afresh: a picture is only ever filed under the guide it was made from)
  const key = mpKey();
  if (key !== _mp.key) _mp = { key: key, pics: {}, seeds: {}, sigs: {}, t: 0, off: _mp.off };
  const k = MOOD_KEYS.find(function (m) {
    return m !== emphasis && !(m in _mp.pics);
  });
  if (!k) return;
  const seed = (Math.random() * 4294967296) >>> 0,
    t0 = Date.now();
  let cols = null;
  try {
    cols = mpLay(k, seed);
  } catch (e) {
    _mp.off = true;
    throw e;
  }
  if (_mp.off) return;
  _mp.seeds[k] = seed;
  _mp.sigs[k] = mpSig(cols);
  _mp.pics[k] = cols ? { im: mpImage(cols) } : { none: true };
  mpPaint();
  // (v310.1: a slow one, as Random on a page of thousands of sections, leaves twice its time free before the next,
  // so taps and scrolling meanwhile aren't kept waiting)
  const took = Date.now() - t0;
  if (MOOD_KEYS.some(mpWanted)) _mp.t = setTimeout(mpStep, took > 120 ? 2 * took : MP_GAP);
}
// looked at again when the row may have come into view, or a finger was lifted
function mpWake() {
  if (!_mp.t && mpOn() && sfmode === 'guide' && mpShow() && MOOD_KEYS.some(mpWanted)) mpSchedule(MP_WAIT);
}
// Mood's tap: as before, with the seed of the mood's picture when it was made from the guide as it is now (so it lays
// as the picture showed). In the tests, a check that it did.
function mpTap(k) {
  const fresh = mpOn() && _mp.key && _mp.key === mpKey() && k in _mp.seeds && _mp.pics[k] && _mp.pics[k].im,
    before = function () {
      if (genMade()) generatePalette();
    };
  emphasis = k;
  if (!fresh) return reassign(null, null, { before: before });
  const want = _mp.sigs[k],
    r = reassign(null, null, { before: before, seed: _mp.seeds[k] });
  if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST && r !== false && mpSigNow() !== want)
    throw new Error('Mood ' + k + ' laid differently from its picture');
  return r;
}
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    function (e) {
      _mpPtrs.add(e.pointerId);
    },
    true,
  );
  const up = function (e) {
    _mpPtrs.delete(e.pointerId);
    if (!_mpPtrs.size) mpWake();
  };
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  // (a finger whose lifting was never heard, as when the app went to the background: not held down for ever)
  document.addEventListener('visibilitychange', function () {
    _mpPtrs.clear();
    if (document.visibilityState === 'visible') mpWake();
  });
  window.addEventListener('blur', function () {
    _mpPtrs.clear();
  });
  window.addEventListener('scroll', mpWake, { passive: true, capture: true });
}
// the Mood row: the six pictures (or Mood's buttons as before, where the pictures aren't shown: mpShow)
function moodPicsHTML() {
  return (
    '<div class="sfsublbl" id="sfMoodLbl">Mood</div><div class="sfmpwrap"><div id="sfMood" role="group" aria-labelledby="sfMoodLbl" class="sfmoodpics">' +
    MOOD_KEYS.map(function (k) {
      const on = emphasis === k;
      return (
        '<button type="button" class="sfmp' +
        (on ? ' on' : '') +
        '" data-v="' +
        k +
        '" aria-pressed="' +
        on +
        '"><canvas aria-hidden="true"></canvas><span class="sfmpname">' +
        MOODS[k].label +
        '</span><span class="sfmpsub"></span></button>'
      );
    }).join('') +
    '</div></div>'
  );
}
// after the Plan is drawn: the pictures in, and the next to make asked for
function mpAfterPlan() {
  _mpVer++;
  mpPaint();
  mpSchedule();
}
