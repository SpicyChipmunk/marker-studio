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
// Ticks (and part-done tones, and the shading kept with them) Recolour them too took away: kept with its step and
// put back by its Undo
let _tickLost = {};
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
  // (Use grey markers for the grey parts, v304)
  if (photoGreys) s.pgrey = 1;
  // (what the Pattern panel says about a photo with no colour, as this laying found it: 46-photo, v304)
  return { s: s, js: JSON.stringify(s), ref: photoRef, filt: planFilt(), none: Object.assign({}, _phNone) };
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
  const lost = _toneLost,
    tl = _tickLost,
    hr = _heldRun;
  _toneLost = {};
  _tickLost = {};
  _heldRun = null;
  if (!planLast) {
    planLast = cur;
    return;
  }
  // (Recolour them too that gave its sections the markers they had still took ticks away: a step, to put them back)
  if (planSame(planLast, cur) && !Object.keys(tl).length) return;
  const prev = planLast;
  prev.label = w || planLabel(prev, cur);
  if (Object.keys(lost).length) prev.tones = lost;
  if (Object.keys(tl).length) prev.ticks = tl;
  prev.filtStep = prev.filt !== cur.filt;
  planStack.push(prev);
  if (planStack.length > PLANMAX) planStack.shift();
  planLast = cur;
  planBtn();
  if (quiet) return;
  // coloured sections kept their markers where the change would have recoloured them: say so, with Recolour them too
  // (once per visit to the plan, and again when more are kept)
  let held = null,
    would = false;
  if (hr && hr.secs.length) {
    const hs = {};
    hr.secs.forEach(function (l) {
      hs[l] = 1;
    });
    would = cur.s.o.some(function (l) {
      return !hs[l] && prev.s.a[l] !== cur.s.a[l];
    });
    if (would && hr.secs.length > _heldTold) {
      held = hr;
      _heldTold = hr.secs.length;
    }
  }
  // (said on a line under the tabs, not in a toast: a toast sits where Shuffle and Pin colours are, and a tap meant
  // for them could recolour the sections by mistake; the kept sections flash on the picture. A line still showing
  // follows each later change: this one's sections, quietly, or gone when it kept none)
  if (held) heldNoteShow(held);
  else if (_heldNote) {
    if (would) heldNoteSet(hr);
    else heldNoteClear();
  }
  const ub = document.getElementById('sfPlanUndo');
  if (/^Surprise\b/.test(prev.label) || !ub || ub.style.display === 'none' || !ub.getClientRects().length) {
    toastAction(esc(prev.label), 'Undo', planUndo);
    return;
  }
  // (a change that has just said what it did in its own words, like a picker's Done, keeps them: said in this same
  // task, or less than 100 ms ago. Timing alone let a slow redraw in between, on a busy phone, replace a picker's
  // "B03 → Y315 …, 1 section" with the vaguer "Section colour changed")
  if (!sayLive.now && !(Date.now() - (sayLive.at || 0) < 100))
    sayLive(prev.label + (held ? '. ' + heldNoteText(held) + '.' : ''));
}
// The line under the Plan's tabs saying which coloured sections a change kept, with Recolour them too and ✕: shown
// until it's used, closed, or the plan is left (_heldNote)
let _heldNote = null;
function heldNoteText(h) {
  const n = h.secs.length;
  return n === 1 ? 'Kept 1 coloured section as it is' : 'Kept ' + n + ' coloured sections as they are';
}
function heldNoteHTML() {
  const h = _heldNote;
  if (!h) return '';
  return (
    '<div id="sfHeldNote" class="sfheldnote" role="status"><span>' +
    esc(heldNoteText(h)) +
    '</span><button type="button" id="sfHeldGo" class="sflink">' +
    (h.secs.length === 1 ? 'Recolour it too' : 'Recolour them too') +
    '</button><button type="button" id="sfHeldX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
function heldNoteShow(h) {
  _heldNote = h;
  const tabs = ctlEl && ctlEl.querySelector('.sftabs');
  if (tabs) {
    const old = document.getElementById('sfHeldNote');
    if (old) old.remove();
    tabs.insertAdjacentHTML('afterend', heldNoteHTML());
    heldNoteWire();
  }
  // (which ones: outlined on the picture for a moment)
  const s = h.secs.slice();
  outlineSecs(s);
  setTimeout(function () {
    if (olSet && olSet.length === s.length && olSet[0] === s[0]) outlineSecs(null);
  }, 1800);
}
// (the line showing, brought up to date without a flash)
function heldNoteSet(h) {
  _heldNote = h;
  const el = document.getElementById('sfHeldNote');
  if (!el) return;
  el.querySelector('span').textContent = heldNoteText(h);
  document.getElementById('sfHeldGo').textContent =
    h.secs.length === 1 ? 'Recolour it too' : 'Recolour them too';
}
function heldNoteClear() {
  _heldNote = null;
  const el = document.getElementById('sfHeldNote');
  if (el) el.remove();
}
// Change colour pins the section (v288): the first time, a line under the tabs says so, with Unpin. One line at a time
// under the tabs: not beside the kept-sections line or the sample's (the tip queue's rule).
let _pinNote = null;
function pinNoteHTML() {
  const p = _pinNote;
  if (!p || _heldNote) return '';
  const one = p.secs.length === 1;
  return (
    '<div id="sfPinNote" class="sfheldnote" role="status"><span>Pinned \u2014 changes to the plan leave ' +
    (one ? 'it as it is.' : 'them as they are.') +
    '</span><button type="button" id="sfPinUn" class="sflink">' +
    (one ? 'Unpin' : 'Unpin them') +
    '</button><button type="button" id="sfPinX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
function pinNoteWire() {
  const un = document.getElementById('sfPinUn'),
    x = document.getElementById('sfPinX');
  if (un)
    un.addEventListener('click', function () {
      const p = _pinNote;
      pinNoteClear();
      if (!p || !assignData) return;
      p.secs.forEach(function (l) {
        delete locks[l];
      });
      renderGuide();
      planCommit(p.secs.length === 1 ? 'Unpinned' : 'Unpinned ' + p.secs.length + ' sections');
      sayLive(p.secs.length === 1 ? 'Unpinned' : 'Unpinned ' + p.secs.length + ' sections');
      ctlRefocus('#sfTab-' + gTab);
    });
  if (x)
    x.addEventListener('click', function () {
      pinNoteClear();
      ctlRefocus('#sfTab-' + gTab);
    });
}
function pinNoteClear() {
  _pinNote = null;
  const el = document.getElementById('sfPinNote');
  if (el) el.remove();
}
// the first Change colour ever (stored with the hints): the line, announced
function pinNoteFirst(secs) {
  if (!secs.length || hintSeen('pinline')) return;
  markHint('pinline');
  _pinNote = { secs: secs.slice() };
  // (after what the picker has just said, not instead of it; when that already ends "pinned", not twice, v289)
  const prev = sayLive.last && Date.now() - (sayLive.at || 0) < 1500 ? sayLive.last : '',
    tail = 'changes to the plan leave ' + (secs.length === 1 ? 'it as it is.' : 'them as they are.'),
    own = 'Pinned: ' + tail;
  sayLive(
    !prev
      ? own
      : prev.replace(/[.!?]?$/, '.') +
          ' ' +
          (/pinned\.?$/.test(prev) ? tail.charAt(0).toUpperCase() + tail.slice(1) : own),
  );
}
// The sample, as it was built: a line under the tabs says it isn't in the Library yet (v285), until it's changed (then
// it is) or closed. (Not beside the kept-sections line: a sample with coloured sections was changed, so is kept.)
// (v289: not while the first-time "Tap a section" line is up — it goes at the next tab, and this line comes then)
function sampleNoteHTML() {
  if (!curSample || _sampleNoteX || _heldNote || _pinNote || libEntry() || sampleTouched() || tapLineUp())
    return '';
  return (
    '<div id="sfSampleNote" class="sfheldnote sfsamplenote" role="note"><span>This sample isn\u2019t in your Library yet. Change anything to keep it.</span><button type="button" id="sfSampleX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
function sampleNoteWire() {
  const x = document.getElementById('sfSampleX');
  if (x)
    x.addEventListener('click', function () {
      _sampleNoteX = true;
      const n = document.getElementById('sfSampleNote');
      if (n) n.remove();
      ctlRefocus('#sfTab-' + gTab);
    });
}
// The first-time "Tap a section…" line under the tabs: the first visit to the Plan, on the tab it opened on (v289: it
// goes when you change tab, so the sample's line can have its turn)
let _tapTab = null; // the tab it showed on; false once it has gone
function tapLineUp() {
  if (family === 'manual' || paintOn || zoneEditOn() || _heldNote || _pinNote) return false;
  if (_tapTab === false || (hintSeen('tap') && !_hNow.tap)) return false;
  if (_tapTab == null) _tapTab = gTab;
  return gTab === _tapTab;
}
// The tool row's names (v288): where the row is icons only (a phone, or the side-by-side strip), a one-time line under
// the tabs names Codes, Greyscale and Full screen. The tip queue: one line at a time, and it waits for a visit when
// nothing else is said first (the kept-sections, pinned or sample line, or the first-time "Tap a section" hint).
let _toolTip = 0; // 1: shown in this visit (stays until closed or reload), -1: closed
function toolsIconOnly() {
  return (window.innerWidth || 0) < 700 || !!(workEl && workEl.classList.contains('sftoolsv'));
}
function toolTipHTML() {
  if (_toolTip < 0 || sfmode !== 'guide' || _heldNote || _pinNote || sampleNoteHTML()) return '';
  if (!_toolTip) {
    if (hintSeen('tools') || !hintSeen('tap') || _hNow.tap || !toolsIconOnly()) return '';
    if (_smpLoad || (curSample && !_sampleNoteX && !libEntry() && !sampleTouched())) return '';
    markHint('tools');
    _toolTip = 1;
  }
  const one = function (k, w) {
    return '<span class="sftti">' + TIC[k] + w + '</span>';
  };
  return (
    '<div id="sfToolTip" class="sfheldnote sfsamplenote sftooltip" role="note"><span>' +
    (workEl && workEl.classList.contains('sftoolsv') ? 'Beside' : 'Under') +
    ' the picture: ' +
    one('codes', 'Codes') +
    ' shows the marker codes, ' +
    one('values', 'Greyscale') +
    ' the picture in greys, and ' +
    one('full', 'Full screen') +
    ' fills the screen.</span><button type="button" id="sfToolTipX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
function toolTipWire() {
  const x = document.getElementById('sfToolTipX');
  if (x)
    x.addEventListener('click', function () {
      _toolTip = -1;
      const n = document.getElementById('sfToolTip');
      if (n) n.remove();
      ctlRefocus('#sfTab-' + gTab);
    });
}
function heldNoteWire() {
  const go = document.getElementById('sfHeldGo'),
    x = document.getElementById('sfHeldX');
  if (go)
    go.addEventListener('click', function () {
      const h = _heldNote;
      heldNoteClear();
      if (h) heldRecolour(h);
    });
  if (x)
    x.addEventListener('click', function () {
      heldNoteClear();
      ctlRefocus('#sfTab-' + gTab);
    });
}
// the plan as it stands becomes the starting point (after something that isn't a step of its own)
function planSync() {
  planLast = assignData && labels ? planSnap() : null;
  _toneLost = {};
  _tickLost = {};
}
// Recolour them too: the coloured sections a change kept (hr, _heldRun's) laid again with the rest, unticked, their
// part-done tones and kept shading let go; one Undo step, which puts the ticks back too
function heldRecolour(hr) {
  if (sfmode !== 'guide' || !assignData || !colored) return;
  const P = tp(),
    lost = {};
  hr.secs.forEach(function (l) {
    if (!inkOn(l) || locks[l] !== undefined) return;
    lost[l] = { c: colored[l], t: P[l], h: heldSh[l] || null };
    colored[l] = 0;
    P[l] = 0;
    heldSet(l, null);
  });
  const n = Object.keys(lost).length;
  if (!n) return;
  _tickLost = lost;
  planWhy = 'Recoloured ' + n + ' coloured section' + (n === 1 ? '' : 's');
  reassign(zones.length ? hr.run : null);
  updateProgress();
}
function planReset() {
  _heldTold = 0;
  heldNoteClear();
  pinNoteClear();
  planStack = [];
  planDrag = false;
  planWhy = null;
  planSync();
  planBtn();
}
function planRestore(e, noFilt) {
  const s = e.s;
  layStatReset();
  // (Undo: a line about kept sections spoke of the change undone)
  heldNoteClear();
  pinNoteClear();
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
  // (sections with ink on the paper keep the markers they have now: holdOn, 30-palette-assign; but not one whose pin
  // the step being undone made or changed: Change colour or Paint on it, which Undo puts back, v298)
  const keep = {},
    was = s.locks || {};
  if (assignData && colored)
    assignData.order.forEach(function (l) {
      if (assignData.assign[l] && inkOn(l) && (locks[l] || '') === (was[l] || ''))
        keep[l] = assignData.assign[l];
    });
  const assign = {},
    base = {};
  s.o.forEach(function (l) {
    const m = res(s.a[l]);
    if (m) {
      assign[l] = m;
      base[l] = (s.b[l] && res(s.b[l])) || m;
    }
  });
  for (const l in keep) if (assign[l]) assign[l] = keep[l];
  const order = s.o.filter(function (l) {
    return !!assign[l];
  });
  assignData = { assign: assign, order: order, N: order.length, base: base };
  // (Recolour them too's ticks, tones and kept shading, back)
  if (e.ticks && colored) {
    const P = tp();
    for (const l in e.ticks) {
      const t = e.ticks[l];
      if (!assign[l]) continue;
      colored[l] = t.c;
      P[l] = t.t;
      if (t.h) heldSet(l, t.h);
    }
  }
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
  photoGreys = !!s.pgrey;
  _phNone = e.none ? Object.assign({}, e.none) : {};
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
  if (e.ticks) updateProgress();
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
// the rest of the status, then the buttons narrow a little; parts go whole, never cut mid-number. Side by side the
// status is one part (CSS).
// v288: in a row 700px wide or more (an iPad's one column), Codes, Greyscale and Full screen show their word too
// (sftw); when tight, after the status's second part the words go first (sfzcw), then as before.
function planFit() {
  const z = document.getElementById('sfZoomCtl');
  if (!z) return;
  z.classList.remove('sfzc1', 'sfzcw', 'sfzc2', 'sfzc3', 'sfzc4', 'sftw');
  if (z.offsetParent === null || (workEl && workEl.classList.contains('sftoolsv'))) return;
  if (
    (window.innerWidth || 0) >= 700 &&
    !root.classList.contains('sffoc') &&
    !root.classList.contains('sffull')
  )
    z.classList.add('sftw');
  const st = document.getElementById('sfStat'),
    over = function () {
      return z.scrollWidth > z.clientWidth + 1 || (!!st && st.scrollWidth > st.clientWidth + 1);
    };
  ['sfzc1', 'sfzcw', 'sfzc2', 'sfzc3', 'sfzc4'].forEach(function (c) {
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
