/* ---- Paint (Manual pattern) ----
    With Paint on, one finger (or the mouse) fills every section it passes over with the brush marker, pinning each
    one; two fingers still move and zoom the picture. A touch waits a moment (or until it moves) before the first
    section is filled, so a second finger landing for a pinch paints nothing. One stroke is one Undo step. The picture
    is redrawn once a frame, and only the sections that changed (renderGuide's incremental redraw). */
let paintOn = false,
  paintKey = null,
  paintS = null,
  paintRaf = 0;
function paintActive() {
  return (
    paintOn &&
    sfmode === 'guide' &&
    family === 'manual' &&
    !!assignData &&
    !!labels &&
    !pgMode &&
    !cropMode &&
    !shadeFlatMode &&
    !root.classList.contains('sfrev')
  );
}
// the brush: the marker last chosen for painting, else the most recently used one, else the guide's first
function paintBrush() {
  let m = paintKey ? mkByKey(paintKey) : null;
  if (!m) {
    const r = recentMk();
    for (let i = 0; i < r.length && !m; i++) m = mkByKey(r[i]);
  }
  if (!m && assignData && assignData.order.length) m = mkByKey(assignData.assign[assignData.order[0]].mkey);
  if (!m) m = coll[0] || null;
  paintKey = m ? m.mkey : null;
  return m;
}
// Paint on or off (a stroke in progress keeps what it has painted); the canvas shows a crosshair while it's on
function setPaint(on) {
  paintOn = !!on && sfmode === 'guide' && family === 'manual';
  if (paintS) paintEnd(false);
  if (paintOn) {
    paintBrush();
    shadeFlatMode = false;
    hideTip();
    if (popOpen()) closeSwatchPop();
  }
  if (cv) cv.style.cursor = paintOn ? 'crosshair' : '';
}
// the brush picker (#sfBrush): the same marker picker sheet as Change colour; a pick counts as recently used
function openBrushPop() {
  const _o = paintBrush() ? paintKey : null;
  openSwatchPop({
    title: 'Paint with',
    sub: '<span>Tap or drag across sections to fill them</span>',
    pool: coll,
    curKey: paintKey,
    onPick: function (k) {
      paintKey = k;
      renderControls();
    },
    onCancel: function () {
      paintKey = _o;
      renderControls();
    },
  });
}
function paintStart(e) {
  const P = evPt(e);
  paintS = {
    id: e.pointerId,
    m: paintBrush(),
    p0: P,
    last: P,
    sx: e.clientX,
    sy: e.clientY,
    pend: true,
    n: 0,
    seen: {},
    t: 0,
  };
  if (!paintS.m) {
    paintS = null;
    return;
  }
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') paintGo(paintS);
  else {
    const s = paintS;
    s.t = setTimeout(function () {
      if (paintS === s) paintGo(s);
    }, 110);
  }
}
// the stroke is really painting now: fill where it started
function paintGo(s) {
  if (!s.pend) return;
  clearTimeout(s.t);
  s.pend = false;
  paintDot(s, s.p0);
  paintQueue();
}
function paintMove(e) {
  const s = paintS;
  if (!s) return;
  const P = evPt(e);
  if (s.pend) {
    if (Math.abs(e.clientX - s.sx) + Math.abs(e.clientY - s.sy) <= 6) return;
    paintGo(s);
  }
  paintLine(s, s.last, P);
  s.last = P;
  paintQueue();
}
// every section under the straight line a..b (picture pixels), so a fast drag skips nothing between two events
function paintLine(s, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 1; i <= n; i++)
    paintDot(s, { x: Math.round(a.x + (dx * i) / n), y: Math.round(a.y + (dy * i) / n) });
}
function paintDot(s, P) {
  if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return;
  const l = labels[P.y * W + P.x];
  if (l > 0 && !s.seen[l]) paintSec(s, l);
}
// one section takes the brush and is pinned (a new marker starts its tones afresh, as Change colour does)
function paintSec(s, l) {
  s.seen[l] = 1;
  const A = assignData.assign,
    m = A[l],
    b = s.m;
  if (!m) return;
  // (only the zone being edited: another zone's sections are its own pattern's)
  if (zones.length && zoneOf(l) !== zoneCur) {
    s.skip = (s.skip || 0) + 1;
    return;
  }
  if (m.mkey === b.mkey && locks[l] === b.mkey) return;
  if (m.mkey !== b.mkey && colored) toneDrop(l);
  A[l] = b;
  locks[l] = b.mkey;
  s.n++;
  guideDirty = true;
}
function paintQueue() {
  if (!paintRaf)
    paintRaf = requestAnimationFrame(function () {
      paintRaf = 0;
      renderGuide();
    });
}
// the stroke is over: a touch that never moved is a tap and fills its section; a second finger or a cancelled
// touch drops only what was still waiting. Whatever was painted becomes one Undo step.
function paintEnd(tap) {
  const s = paintS;
  if (!s) return;
  paintS = null;
  clearTimeout(s.t);
  if (tap && s.pend) {
    s.pend = false;
    paintDot(s, s.p0);
  }
  if (paintRaf) {
    cancelAnimationFrame(paintRaf);
    paintRaf = 0;
  }
  if (s.skip && assignData) {
    const zn = zoneName(zoneCur);
    toast(
      s.n
        ? 'Painted ' +
            zn +
            '’s sections only: ' +
            (s.skip === 1
              ? 'one in another zone was left as it was.'
              : s.skip + ' in other zones were left as they were.')
        : 'Paint only colours ' +
            zn +
            '’s sections: ' +
            (s.skip === 1
              ? 'that one is in another zone.'
              : 'the ' + s.skip + ' you went over are in other zones.'),
      2600,
    );
  }
  if (!s.n || !assignData) return;
  const w = 'Painted ' + s.n + ' section' + (s.n === 1 ? '' : 's') + ' with ' + s.m.code;
  normalizeTones();
  renderGuide();
  renderControls();
  pushRecent(s.m.mkey);
  planCommit(w, true);
  sayLive(w);
}
