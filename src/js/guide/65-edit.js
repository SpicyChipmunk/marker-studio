// undo snapshots keep the section map run-length packed ([value, count] pairs): line art is long runs, so a
// 2400 x 1800 map is ~1-2 MB instead of 17 MB and many more undo steps fit in the memory budget
function packLabels(a) {
  const n = a.length;
  let buf = new Int32Array(65536),
    k = 0;
  for (let i = 0; i < n;) {
    const v = a[i];
    let j = i + 1;
    while (j < n && a[j] === v) j++;
    if (k + 2 > buf.length) {
      const b = new Int32Array(buf.length * 2);
      b.set(buf);
      buf = b;
    }
    buf[k++] = v;
    buf[k++] = j - i;
    i = j;
  }
  const r = buf.slice(0, k);
  return { z: r, n: n };
}
function unpackLabels(p) {
  if (!p || !p.z) return p;
  const a = new Int32Array(p.n),
    z = p.z;
  let o = 0;
  for (let k = 0; k < z.length; k += 2) {
    const c = z[k + 1];
    a.fill(z[k], o, o + c);
    o += c;
  }
  return a;
}
function snapBytes(s) {
  return s.t === 'seg'
    ? (s.labels ? (s.labels.z ? s.labels.z.length : s.labels.length) * 4 : 0) +
        (s.ov ? s.ov.length : 0) +
        (s.col ? s.col.length : 0) +
        (s.comps ? s.comps.length * 48 : 0) +
        (s.keep && s.keep.geo && s.keep.geo.gray ? s.keep.geo.gray.length : 0)
    : s.d
      ? s.d.length
      : 0;
}
function pushUndo(s) {
  s._b = snapBytes(s);
  undoStack.push(s);
  undoBytes += s._b;
  while (undoStack.length > 1 && (undoStack.length > MAXUNDO || undoBytes > UNDOBUDGET)) {
    undoBytes -= undoStack[0]._b;
    undoStack.shift();
  }
  updateUndoUI();
}
function popUndo() {
  const s = undoStack.pop();
  if (s) undoBytes -= s._b;
  updateUndoUI();
  return s;
}
function clearUndo() {
  undoStack.length = 0;
  undoBytes = 0;
  updateUndoUI();
}
function updateUndoUI() {
  planBtn();
}
function snapshotSeg() {
  pushUndo({
    t: 'seg',
    labels: packLabels(labels),
    comps: comps.map(function (c) {
      return c
        ? {
            area: c.area,
            bg: c.bg,
            bpx: c.bpx,
            cx: c.cx,
            cy: c.cy,
            h: c.h,
            x0: c.x0,
            y0: c.y0,
            x1: c.x1,
            y1: c.y1,
            merged: c.merged,
            page: c.page,
          }
        : null;
    }),
    sec: secColor.slice(),
    ov: secState.slice(),
    col: colored.slice(),
  });
}
function doUndo() {
  const u = popUndo();
  if (!u) return;
  if (u.t === 'ov') {
    secState.set(u.d.length > secState.length ? u.d.subarray(0, secState.length) : u.d);
    render();
  } else if (u.t === 'seg') {
    const g = u.keep && u.keep.geo;
    // the picture as it was before it was turned, cropped or straightened
    if (g) {
      W = g.W;
      H = g.H;
      gray = g.gray;
      srcImg = g.src;
      pgQ = g.pgQ;
      pgShape = g.pgShape;
      rot90 = g.rot90;
      tilt = g.tilt;
      cropRect = g.crop;
      cv.width = W;
      cv.height = H;
      rgbOut = new Uint8ClampedArray(W * H * 4);
      imgData = new ImageData(rgbOut, W, H);
      _rg = null;
      resetZoom();
    }
    labels = unpackLabels(u.labels);
    comps = u.comps;
    secColor = u.sec;
    secState = u.ov;
    if (u.keep) {
      setColored(u.col);
      if (u.keep.tones) {
        const P = tp();
        P.set(u.keep.tones.subarray(0, Math.min(u.keep.tones.length, P.length)));
      }
    } else keepProgress(u.col);
    if (u.keep) {
      locks = u.keep.locks;
      shadeFlat = u.keep.flat;
      _flatVer++;
      _segFresh = u.keep.fresh;
      hasEdits = u.keep.edits;
      bgMaxB = u.keep.bgMaxB;
      _origKeys = u.keep.orig || {};
      _lostKeys = u.keep.lost || {};
      _gone = u.keep.gone || {};
      // (the zones as they were then, and where they were on the picture: 34-zones)
      zoneUnkeep(u.keep.zones);
      // the guide's colours as they were, so Build guide puts it back just as it was
      if (u.keep.ad) {
        assignData = u.keep.ad;
        guideSig = u.keep.sig;
        planStack = (u.keep.plan || []).slice();
        planSync();
      }
    }
    mergeSel = -1;
    adj = null;
    edgeDist = null;
    labelPts = null;
    texField = null;
    render();
    if (g) {
      renderControls();
      note('Back to the picture as it was.');
    }
  }
}
function growArrays() {
  const n = comps.length;
  if (secState.length < n) {
    const o = new Uint8Array(n);
    o.set(secState);
    secState = o;
  }
  if (colored.length < n) {
    const c = new Uint8Array(n);
    c.set(colored);
    setColored(c);
  }
  while (secColor.length < n) {
    const l = secColor.length;
    secColor.push(hsl2rgb((l * 137.508) % 248, 22 + ((l * 37) % 14), 61 + ((l * 29) % 13)));
  }
}
function mergeCells(a, b) {
  if (a === b || !comps[a] || !comps[b] || comps[a].merged || comps[b].merged) return;
  for (let i = 0; i < W * H; i++) if (labels[i] === b) labels[i] = a;
  const A = comps[a],
    B = comps[b],
    ta = A.area,
    tb = B.area || 1;
  A.cx = (A.cx * ta + B.cx * tb) / (ta + tb);
  A.cy = (A.cy * ta + B.cy * tb) / (ta + tb);
  A.area = ta + tb;
  A.bpx = (A.bpx || 0) + (B.bpx || 0);
  A.bg = A.bg || B.bg;
  if (A.x0 == null) {
    A.x0 = B.x0;
    A.y0 = B.y0;
    A.x1 = B.x1;
    A.y1 = B.y1;
  } else if (B.x0 != null) {
    A.x0 = Math.min(A.x0, B.x0);
    A.y0 = Math.min(A.y0, B.y0);
    A.x1 = Math.max(A.x1, B.x1);
    A.y1 = Math.max(A.y1, B.y1);
  }
  if (A.y1 != null && A.y0 != null) A.h = A.y1 - A.y0;
  comps[b].merged = true;
  comps[b].area = 0;
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
}
function relabelRegion(L) {
  const n = W * H;
  for (let i = 0; i < n; i++) if (labels[i] === L) labels[i] = -3;
  const stk = [];
  let first = true,
    made = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== -3) continue;
    const lab = first ? L : comps.length;
    if (!first)
      comps.push({
        area: 0,
        bg: false,
        bpx: 0,
        cx: 0,
        cy: 0,
        h: 0,
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
        merged: false,
      });
    let sp = 0;
    stk[sp++] = p;
    labels[p] = lab;
    let area = 0,
      sx = 0,
      sy = 0,
      bpx = 0,
      mny = 1e9,
      mxy = -1,
      mnx = 1e9,
      mxx = -1;
    while (sp > 0) {
      const q = stk[--sp];
      area++;
      const x = q % W,
        y = (q / W) | 0;
      sx += x;
      sy += y;
      if (y < mny) mny = y;
      if (y > mxy) mxy = y;
      if (x < mnx) mnx = x;
      if (x > mxx) mxx = x;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) bpx++;
      if (x > 0 && labels[q - 1] === -3) {
        labels[q - 1] = lab;
        stk[sp++] = q - 1;
      }
      if (x < W - 1 && labels[q + 1] === -3) {
        labels[q + 1] = lab;
        stk[sp++] = q + 1;
      }
      if (y > 0 && labels[q - W] === -3) {
        labels[q - W] = lab;
        stk[sp++] = q - W;
      }
      if (y < H - 1 && labels[q + W] === -3) {
        labels[q + W] = lab;
        stk[sp++] = q + W;
      }
    }
    comps[lab].area = area;
    comps[lab].cx = sx / area;
    comps[lab].cy = sy / area;
    comps[lab].bpx = bpx;
    comps[lab].bg = false;
    comps[lab].h = mxy - mny;
    comps[lab].x0 = mnx;
    comps[lab].y0 = mny;
    comps[lab].x1 = mxx;
    comps[lab].y1 = mxy;
    comps[lab].merged = false;
    if (!first) made++;
    first = false;
  }
  growArrays();
  applyBg();
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  return made;
}
function paintStroke(pts, L) {
  const rad = 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x,
      y0 = pts[i].y,
      x1 = pts[i + 1].x,
      y1 = pts[i + 1].y,
      steps = Math.max(1, Math.hypot(x1 - x0, y1 - y0) | 0);
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(x0 + ((x1 - x0) * s) / steps),
        cy = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = cx + dx,
            yy = cy + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (labels[q] === L) labels[q] = -1;
        }
    }
  }
}
// Split: a stroke that doesn't divide the section is taken back (no ink line left, no undo step, no edit)
function splitAt(startL, pts) {
  if (pts.length < 2) return 0;
  snapshotSeg();
  paintStroke(pts, startL);
  if (relabelRegion(startL) < 1) {
    restoreSnap();
    const h = document.getElementById('sfHint');
    if (h)
      h.textContent =
        'That stroke didn\u2019t divide the section \u2014 draw it right across, from edge to edge.';
    note('That stroke didn\u2019t divide the section.');
    return 0;
  }
  hasEdits = true;
  return 1;
}
function edgeCut(startL, pts) {
  if (pts.length < 2) return 0;
  snapshotSeg();
  var pp = addAutoClose ? pts.concat([{ x: pts[0].x, y: pts[0].y }]) : pts;
  paintStroke(pp, startL);
  var made = relabelRegion(startL);
  if (made < 1) {
    restoreSnap();
    return 0;
  }
  hasEdits = true;
  return 1;
}
function restoreSnap() {
  const s = popUndo();
  if (!s) return;
  labels = unpackLabels(s.labels);
  comps = s.comps;
  secColor = s.sec;
  secState = s.ov;
  keepProgress(s.col);
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
}

function setEditMode(m) {
  editMode = m;
  mergeSel = -1;
  ['sfEmToggle', 'sfEmMerge', 'sfEmSplit', 'sfEmAdd'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('on', b.dataset.m === m);
  });
  const hint = document.getElementById('sfHint');
  if (hint)
    hint.textContent =
      m === 'merge'
        ? 'Tap two sections to combine them.'
        : m === 'split'
          ? 'Drag a line across a section to divide it in two. Pinch to zoom; two fingers move around.'
          : m === 'add'
            ? (addAutoClose
                ? 'Add: draw a loop to enclose a new section \u2014 the ends join automatically.'
                : 'Add: draw across a region to a line or the page edge to slice off a section.') +
              ' Pinch to zoom; two fingers move around.'
            : 'Include / exclude: tap a coloured section to exclude it (turns magenta), or a teal area to include it.';
  if (cv) cv.style.touchAction = m === 'split' || m === 'add' ? 'none' : '';
  var _ac = document.getElementById('sfAutoCloseWrap');
  if (_ac) _ac.style.display = m === 'add' ? 'flex' : 'none';
  if (labels && sfmode === 'review') render();
}
