/* ---- undo for the guide ----
    Everything that decides how the guide looks (Shuffle, Surprise, pattern, markers, filters, pins, section colours,
    blend anchors, shading, texture, the photo) can be taken back, one step at a time. planLast is always the plan as
    it stands; each change calls planCommit() once it's made, and if the plan now differs, the one before goes on the
    stack. A slider counts as one step however far it's dragged (nothing is committed until it's let go). Colour-along
    ticks are not part of this (Reset progress has its own Undo). The stack is cleared when another picture or guide
    opens, and when the sections are rebuilt. */
let planStack = [],
  planLast = null,
  planDrag = false,
  planWhy = null;
const PLANMAX = 30;
// Part-done tones a change of marker cleared (Change colour, Everywhere, Paint, Unpin, Fill): noted as they go
// (toneDrop), kept with the plan step that change makes, and put back by its Undo (unless the section was ticked since)
let _toneLost = {};
function toneDrop(l) {
  const P = tp();
  if (!P[l]) return;
  if (!(l in _toneLost)) _toneLost[l] = P[l];
  P[l] = 0;
}
// a reopened guide's photo decoded after steps were already taken: they had it too
function planPhotoIn(ref) {
  planStack.concat(planLast ? [planLast] : []).forEach(function (e) {
    if (e.ref || !e.s || e.s.xf) return;
    e.ref = ref;
    e.s.xf = photoXf ? Object.assign({}, photoXf) : null;
    e.js = JSON.stringify(e.s);
  });
}
function planFilt() {
  try {
    return JSON.stringify([
      [...state.brands].sort(),
      [...state.tones].sort(),
      [...state.sats].sort(),
      [...state.excluded].sort(),
    ]);
  } catch (_) {
    return '';
  }
}
function planSnap() {
  if (!assignData || !assignData.order) return null;
  const a = {},
    b = {},
    bs = assignData.base || {};
  assignData.order.forEach(function (l) {
    const m = assignData.assign[l];
    if (m) a[l] = m.mkey;
    if (bs[l]) b[l] = bs[l].mkey;
  });
  // the style settings Undo keeps (STYLE_FIELDS, 05-style-fields: family, palette..., shading in s.shade)
  const s = styleSnap({
    a: a,
    o: assignData.order.slice(),
    b: b,
    p: assignData.paper ? Object.keys(assignData.paper).map(Number) : null,
    locks: Object.assign({}, locks),
    anchors: anchors.map(function (x) {
      return { x: x.x, y: x.y, mkey: x.mkey };
    }),
  });
  // the zones: which sections each has, and the settings of those not being edited (34-zones)
  const z = zoneSnap();
  if (z) s.z = z;
  // the photo's placement, see-through and white areas (the photo itself is kept beside the snapshot, as ref)
  s.xf = photoXf ? { cx: photoXf.cx, cy: photoXf.cy, sx: photoXf.sx, sy: photoXf.sy, r: photoXf.r } : null;
  s.op = photoOp;
  s.ppaper = photoPaper;
  return { s: s, js: JSON.stringify(s), ref: photoRef, filt: planFilt() };
}
function planSame(p, q, noFilt) {
  return !!(p && q && p.js === q.js && p.ref === q.ref && (noFilt || p.filt === q.filt));
}
// what a step did, in a few words, for its toast and the Undo button's label; with zones, a change to a zone's own
// settings says which zone ("Bell: Flow: Radial")
function planLabel(p, q) {
  const zl = zoneStepLabel(p.s.z, q.s.z) || zoneShadeLabel(p.s.z, q.s.z);
  if (zl) return zl;
  const l = planLabel1(p, q),
    zb = q.s.z;
  if (zb && zb.list.length && zoneKeysDiffer(p.s, q.s)) return zoneNameIn(zb, zb.cur) + ': ' + l;
  // (Main's own shading, beside other zones: "Main: Roundness changed")
  if (zb && zb.list.length && shadeLabel(p.s.shade, q.s.shade)) return 'Main: ' + l;
  return l;
}
// a change to one zone's own shading: "Bell: Highlights: Paper white" (its record: 34-zones zsh)
function zoneShadeLabel(za, zb) {
  if (!za || !zb) return '';
  const ia = {};
  za.list.forEach(function (x) {
    ia[x.id] = x;
  });
  for (let i = 0; i < zb.list.length; i++) {
    const x = zb.list[i],
      y = ia[x.id];
    if (!y || !x.sh || !y.sh) continue;
    const l = shadeLabel(Object.assign({ main: y.sh.on }, y.sh), Object.assign({ main: x.sh.on }, x.sh));
    if (l) return x.name + ': ' + l;
  }
  return '';
}
// what changed in the shading a zone has of its own (sa, sb: the shade settings, Main's `main` its "Shade Main")
function shadeLabel(sa, sb) {
  if (!sa || !sb) return '';
  if (sa.main !== sb.main) return 'Shading: ' + (sb.main ? 'Shaded' : 'Flat');
  if (sa.round !== sb.round) return 'Roundness changed';
  if (sa.shadow !== sb.shadow) return 'Shadows: ' + (SHADE_SHADOW_LABEL[sb.shadow] || sb.shadow);
  if (sa.hilite !== sb.hilite) return 'Highlights: ' + (SHADE_HILITE_LABEL[sb.hilite] || sb.hilite);
  if (sa.hi !== sb.hi) return 'Highlight changed';
  if (sa.lo !== sb.lo) return 'Shadow changed';
  return '';
}
function planLabel1(p, q) {
  const a = p.s,
    b = q.s,
    cap = function (t) {
      t = String(t);
      return t.charAt(0).toUpperCase() + t.slice(1);
    },
    onoff = function (v) {
      return v ? 'on' : 'off';
    },
    sa = a.shade,
    sb = b.shade;
  if (a.family !== b.family) return 'Pattern: ' + cap(b.family);
  // (the same photo with its lighting correction switched on or off is a new photo object: see 46-photo)
  const sameRaw = !!(p.ref && q.ref && p.ref.raw && p.ref.raw === q.ref.raw);
  if (p.ref !== q.ref && !sameRaw) return q.ref ? 'New photo' : 'Photo removed';
  if (a.paletteSource !== b.paletteSource)
    return (
      'Colours from: ' +
      ({ owned: 'Owned', saved: 'Saved palette', generate: 'Generate palette' }[b.paletteSource] ||
        b.paletteSource)
    );
  if (a.savedPalId !== b.savedPalId) return 'Saved palette changed';
  if (a.genHarmony !== b.genHarmony) return 'Palette: ' + (HARM[b.genHarmony] || b.genHarmony);
  if (p.filt !== q.filt) return 'Filters changed';
  if (a.limitN !== b.limitN) return 'Markers: ' + b.limitN;
  if (a.palette !== b.palette)
    return 'Temperature: ' + ({ cool: 'Cool', warm: 'Warm', all: 'Any' }[b.palette] || b.palette);
  if (a.emphasis !== b.emphasis) return 'Mood: ' + (MOODS[b.emphasis] ? MOODS[b.emphasis].label : b.emphasis);
  if (a.expand !== b.expand) return 'Nearby markers ' + onoff(b.expand);
  if (a.expandChar !== b.expandChar) return 'Nearby colours changed';
  if (a.gradShape !== b.gradShape) return 'Flow: ' + cap(b.gradShape);
  if (JSON.stringify(a.radC) !== JSON.stringify(b.radC))
    return b.radC ? 'Radial centre moved' : 'Radial centre back to the middle';
  if (a.dir !== b.dir) return 'Direction: ' + (b.dir < 0 ? 'Reversed' : 'Forward');
  if (a.look !== b.look) return 'Look: ' + (LOOK_LABEL[b.look] || b.look);
  if (a.noAdj !== b.noAdj) return 'Touching sections different ' + onoff(b.noAdj);
  if (a.balance !== b.balance) return 'Balance: ' + (b.balance === 'main' ? 'Main colour' : 'Mixed');
  if (a.balM !== b.balM) return 'Main colour: ' + (BAL_FAM[b.balM] ? BAL_FAM[b.balM].n : 'Auto');
  if (a.balS !== b.balS) return 'Second colour: ' + (BAL_FAM[b.balS] ? BAL_FAM[b.balS].n : 'Auto');
  if (a.balA !== b.balA) return 'Accent: ' + (BAL_FAM[b.balA] ? BAL_FAM[b.balA].n : 'Auto');
  if (a.balSeed !== b.balSeed) return 'Other pairings';
  if (a.noRep !== b.noRep) return 'No repeats ' + onoff(b.noRep);
  if (a.blendFall !== b.blendFall) return 'Spread changed';
  if (a.blendMix !== b.blendMix) return 'Mix: ' + (BLEND_MIX_LABEL[b.blendMix] || b.blendMix);
  if (a.anchors.length !== b.anchors.length)
    return b.anchors.length > a.anchors.length ? 'Anchor added' : 'Anchor removed';
  if (JSON.stringify(a.anchors) !== JSON.stringify(b.anchors))
    return a.anchors.some(function (x, i) {
      return x.mkey !== b.anchors[i].mkey;
    })
      ? 'Anchor colour changed'
      : 'Anchor moved';
  if (sa.mode !== sb.mode)
    return 'Shading: ' + ({ off: 'Off', shadow: 'Shadows', full: 'Light & shadow' }[sb.mode] || sb.mode);
  if (sa.lightSrc !== sb.lightSrc)
    return (
      'Light from ' +
      (sb.lightSrc === 'sun'
        ? 'the sun'
        : sb.lightSrc === 'photo'
          ? 'the photo'
          : 'the photo if Main uses it')
    );
  if (sa.x !== sb.x || sa.y !== sb.y) return 'Light moved';
  const _sl = shadeLabel(sa, sb);
  if (_sl) return _sl;
  if (sa.lines !== sb.lines) return 'Tone guides ' + onoff(sb.lines);
  if (sa.flat.join() !== sb.flat.join())
    return sb.flat.length > sa.flat.length ? 'Section left flat' : 'Section shaded again';
  if (a.texAmt !== b.texAmt) return 'Texture: ' + Math.round(b.texAmt * 100) + '%';
  if (JSON.stringify(a.xf) !== JSON.stringify(b.xf)) return 'Photo moved';
  if (a.op !== b.op) return 'See-through changed';
  if (a.ppaper !== b.ppaper) return b.ppaper ? 'White areas left white' : 'White areas coloured';
  if (p.ref !== q.ref) return 'Lighting correction ' + onoff(q.ref.lit && q.ref.lit.on);
  const lk = {};
  Object.keys(a.locks)
    .concat(Object.keys(b.locks))
    .forEach(function (l) {
      lk[l] = 1;
    });
  for (const l in lk) {
    if (a.locks[l] === b.locks[l]) continue;
    if (b.locks[l] === undefined) return 'Section unpinned';
    return a.a[l] !== b.a[l] ? 'Section colour changed' : 'Section pinned';
  }
  if (
    a.gradSeed !== b.gradSeed ||
    JSON.stringify(a.genPal) !== JSON.stringify(b.genPal) ||
    b.family === 'random'
  )
    return 'Colours shuffled';
  return 'Colours changed';
}
// after a change: if the plan differs from the last one, keep the last one to go back to. ↶ Undo in the tool row
// offers it (its label says what it takes back) and a screen reader hears what changed, so no toast covers the
// picture: except ✨ Surprise's, which says what it chose, and any step made while ↶ Undo isn't showing (quiet: not
// even then, for steps that come thick and fast like paint strokes)
function planCommit(why, quiet) {
  const w = why || planWhy;
  planWhy = null;
  if (planDrag || popCtx || sfmode !== 'guide' || !assignData || !labels) return;
  const cur = planSnap();
  if (!cur) return;
  const lost = _toneLost;
  _toneLost = {};
  if (!planLast) {
    planLast = cur;
    return;
  }
  if (planSame(planLast, cur)) return;
  const prev = planLast;
  prev.label = w || planLabel(prev, cur);
  if (Object.keys(lost).length) prev.tones = lost;
  prev.filtStep = prev.filt !== cur.filt;
  planStack.push(prev);
  if (planStack.length > PLANMAX) planStack.shift();
  planLast = cur;
  planBtn();
  if (quiet) return;
  const ub = document.getElementById('sfPlanUndo');
  if (
    /^\u2728 Surprise/.test(prev.label) ||
    !ub ||
    ub.style.display === 'none' ||
    !ub.getClientRects().length
  )
    toastAction(esc(prev.label), 'Undo', planUndo);
  // (a change that has just said what it did in its own words, like a picker's Done, keeps them: said in this same
  // task, or less than 100 ms ago. Timing alone let a slow redraw in between, on a busy phone, replace a picker's
  // "B03 → Y315 …, 1 section" with the vaguer "Section colour changed")
  else if (!sayLive.now && !(Date.now() - (sayLive.at || 0) < 100)) sayLive(prev.label);
}
// the plan as it stands becomes the starting point (after something that isn't a step of its own)
function planSync() {
  planLast = assignData && labels ? planSnap() : null;
  _toneLost = {};
}
function planReset() {
  planStack = [];
  planDrag = false;
  planWhy = null;
  planSync();
  planBtn();
}
function planRestore(e, noFilt) {
  const s = e.s;
  if (!noFilt && e.filtStep && e.filt && e.filt !== planFilt()) {
    try {
      const f = JSON.parse(e.filt);
      state.brands = new Set(f[0]);
      state.tones = new Set(f[1]);
      state.sats = new Set(f[2]);
      state.excluded = new Set(f[3]);
      save();
      setCollection(sfCollection());
    } catch (_) {}
  }
  const bk = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  const res = function (k) {
    let m = bk[k];
    if (!m && k) {
      const info = api.markerInfo ? api.markerInfo(k) : null;
      if (info && info.lab && coll.length) m = nearestInPool(info.lab, coll);
    }
    return m || (k ? catMarker(k) : null);
  };
  const assign = {},
    base = {};
  s.o.forEach(function (l) {
    const m = res(s.a[l]);
    if (m) {
      assign[l] = m;
      base[l] = (s.b[l] && res(s.b[l])) || m;
    }
  });
  const order = s.o.filter(function (l) {
    return !!assign[l];
  });
  assignData = { assign: assign, order: order, N: order.length, base: base };
  if (s.p && s.p.length) {
    const pp = {};
    s.p.forEach(function (l) {
      pp[l] = 1;
    });
    assignData.paper = pp;
  }
  locks = Object.assign({}, s.locks);
  anchors = s.anchors.map(function (x) {
    return { x: x.x, y: x.y, mkey: x.mkey };
  });
  // the zones first (which one is edited decides whose settings the live ones are), then those settings
  zoneRestore(s.z);
  styleRestore(s);
  zStash(zoneCur);
  if (zoneEdit && !zoneCur) zoneEdit = false;
  // (every zone's markers are as the step had them: a change to one zone next lays just that one)
  zoneSigSync();
  if (photoRef !== e.ref) {
    photoRef = e.ref;
    _phCol = null;
  }
  photoXf = s.xf ? Object.assign({}, s.xf) : null;
  photoOp = s.op;
  photoPaper = s.ppaper;
  if (!photoRef || family !== 'photo') {
    photoAlign = false;
    photoPeek = false;
  }
  if (shadeMode === 'off') shadeFlatMode = false;
  if (family === 'blend' || family === 'manual') lockMode = false;
  selAnchor = -1;
  guideDirty = true;
  _rg = null;
  // the part-done tones the step's change of marker cleared
  if (e.tones && colored) {
    const P = tp();
    for (const l in e.tones) if (assignData.assign[l] && !colored[l]) P[l] |= e.tones[l];
  }
  // the "only N markers close enough" note reads the size of the last pool
  if (family !== 'manual' && family !== 'photo' && !(paletteSource === 'generate' && !genPal.length))
    try {
      activePool();
    } catch (_) {}
  hideTip();
  normalizeTones();
  renderGuide();
  renderControls();
  positionPhoto();
  // (a step back to before the zone being edited was made closes its editor: the picture leaves keyboard mode)
  zoneKbSync();
  planSync();
  planBtn();
}
function planUndo() {
  if (popOpen()) {
    const c = document.getElementById('sfPopCancel');
    if (c) c.click();
    else closeSwatchPop();
    return;
  }
  if (sfmode !== 'guide' || !assignData) return;
  clearTimeout(reTimer);
  planDrag = false;
  // a change that was never committed (a drag still going) is undone first
  const cur = planSnap();
  if (planLast && cur && !planSame(planLast, cur, true)) {
    planRestore(planLast, true);
    return;
  }
  if (!planStack.length) return;
  const e = planStack.pop();
  planRestore(e);
  sayLive('Undone: ' + e.label);
  toast('Undone: ' + esc(e.label), 1800);
}
// ↶ Undo in the tool row, only while there is something to undo: the plan's last step, or in Edit sections the last
// section edit. Not while a marker picker is open (the sheet's own Cancel takes its pick back).
function planBtn() {
  const b = document.getElementById('sfPlanUndo');
  if (!b) return;
  const rev = sfmode === 'review' && !!labels && undoStack.length > 0 && !pgMode && !cropMode,
    on =
      rev ||
      (sfmode === 'guide' && !!assignData && planStack.length > 0 && !pgMode && !cropMode && !popOpen());
  b.style.display = on ? '' : 'none';
  if (on) {
    const l = rev ? 'Undo the last section edit' : 'Undo: ' + planStack[planStack.length - 1].label;
    b.setAttribute('aria-label', l);
    b.title = l;
  }
  planFit();
}
function toolUndo() {
  if (sfmode === 'review') {
    doUndo();
    planBtn();
  } else planUndo();
}
// on a narrow row the status's second part goes first ("· 16 markers"), then the word "Undo" (the icon stays), then
// the rest of the status; parts go whole, never cut mid-number. Side by side the status is one part (CSS).
function planFit() {
  const z = document.getElementById('sfZoomCtl');
  if (!z) return;
  z.classList.remove('sfzc1', 'sfzc2', 'sfzc3');
  if (z.offsetParent === null || (workEl && workEl.classList.contains('sftoolsv'))) return;
  const st = document.getElementById('sfStat'),
    over = function () {
      return z.scrollWidth > z.clientWidth + 1 || (!!st && st.scrollWidth > st.clientWidth + 1);
    };
  ['sfzc1', 'sfzc2', 'sfzc3'].forEach(function (c) {
    if (over()) z.classList.add(c);
  });
}
function planInit() {
  const b = document.getElementById('sfPlanUndo');
  if (b) b.addEventListener('click', toolUndo);
  if (ctlEl) {
    ctlEl.addEventListener(
      'pointerdown',
      function (e) {
        if (sfmode === 'guide' && e.target && e.target.type === 'range') planDrag = true;
      },
      true,
    );
    // most controls change the plan in their own handlers; one listener after them all records the step
    ctlEl.addEventListener('click', function () {
      if (sfmode === 'guide') planCommit();
    });
    ctlEl.addEventListener('change', function () {
      if (sfmode !== 'guide') return;
      planDrag = false;
      planCommit();
    });
  }
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    document.addEventListener(
      ev,
      function () {
        planDrag = false;
      },
      true,
    );
  });
  window.addEventListener('resize', function () {
    requestAnimationFrame(planFit);
  });
  // Ctrl+Z / Cmd+Z in Plan and in Edit sections (as ↶ Undo in the tool row), except while typing
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 'z') return;
    const rev = sfmode === 'review' && !!labels && !pgMode && !cropMode;
    if (!(rev || (sfmode === 'guide' && assignData)) || !workEl || workEl.offsetParent === null) return;
    const t = e.target,
      tn = t && t.tagName;
    if (
      tn === 'TEXTAREA' ||
      tn === 'SELECT' ||
      (t && t.isContentEditable) ||
      (tn === 'INPUT' && !/^(range|checkbox|radio|button|submit)$/.test(t.type))
    )
      return;
    if (dialogOpen() || sheetOpen()) return;
    e.preventDefault();
    toolUndo();
  });
}
