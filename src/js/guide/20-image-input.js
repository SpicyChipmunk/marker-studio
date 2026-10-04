/* ---- image input ---- */
// Everything that belongs to the picture that was open (not the user's style choices), cleared before a new
// photo, the sample or a saved guide takes its place. Returns a token: a slow load that finds loadGen has moved on
// (the user opened something else meanwhile) must stop. A change still waiting to be saved is saved first, into the
// guide it was made in (the Library entry or the autosave slot).
function resetForNewPicture() {
  if (paintOn) setPaint(false);
  zoneEditEnd(true);
  // (a change waiting to be saved goes into the guide it was made in, zones and all, before they're cleared)
  flushAutosave();
  // (a new picture has none of the old one's zones; it keeps Main's style, as it keeps the style without zones)
  if (zoneCur) zoneSelect(0);
  zoneReset();
  zoneNoneLeft();
  // (Radial's centre was a place on the old picture)
  radC = null;
  // (a new picture, the sample too, starts at Polished with no rough spots smoothed: Scatter is chosen per guide, v306)
  gradScat = 0;
  gradJit = 0;
  gradFix = false;
  relWake();
  const gen = ++loadGen;
  clearTimeout(autoT);
  autoT = null;
  clearTimeout(reTimer);
  imgCancel();
  // (asked about a dense page: asked again for the next picture, v304)
  _denseAsked = 0;
  saveReset();
  renaming = false;
  clearTimeout(lpT);
  _fnLast = -1;
  alDone = [];
  alDoneOpen = false;
  blendOpen = {};
  srcK = 1;
  _origKeys = {};
  _lostKeys = {};
  _openEmpty = false;
  _gone = {};
  _built = null;
  _edResumed = false;
  _edDisc = false;
  _reFrom = null;
  if (root && root.classList.contains('sfrev')) {
    try {
      endReveal();
    } catch (_) {}
  }
  curId = null;
  guideSig = null;
  clearUndo();
  pgReset();
  photoReset();
  rot90 = 0;
  tilt = 0;
  // (Enhance and its line sensitivity were set for the old picture's lighting, as its turn and crop were, v298)
  enhance = true;
  adaptC = 9;
  _tickHeld = {};
  cropRect = null;
  cropMode = false;
  cropFull = null;
  cropPx = null;
  cropDrag = null;
  cropStart = null;
  cropAnchor = null;
  mergeSel = -1;
  segWarn = null;
  guideDirty = false;
  hasEdits = false;
  _segFresh = false;
  editMode = 'toggle';
  focus = false;
  var _rt = document.getElementById('sfRoot');
  if (_rt) _rt.classList.remove('sffoc');
  if (sfView) sfView.style.paddingTop = sfView.style.paddingBottom = '';
  assignData = null;
  hlKey = null;
  hlZone = null;
  curName = null;
  shadeFlat = {};
  shadeFlatMode = false;
  _flatVer++;
  anchors = [];
  selAnchor = -1;
  locks = {};
  layStatReset();
  lockMode = false;
  revealF = null;
  revOrder = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
  hideTip();
  closeSwatchPop(false);
  planReset();
  return gen;
}
function note(m) {
  if (metaEl) metaEl.innerHTML = m;
  const _plain = typeof m === 'string' ? m.replace(/<[^>]*>/g, '') : '',
    _prog = /(\u2026|\.\.\.)\s*$/.test(_plain);
  // a failure is shown as a card where the guide is, not as a passing toast
  if (/^(could not|couldn|that file|that is not|that image|no markers|not enough)/i.test(_plain.trim())) {
    const a = document.getElementById(workEl && workEl.offsetParent !== null ? 'sfHead' : 'sfStart');
    if (a && a.offsetParent !== null) errCard(a, m);
    else toast(m, 6500);
    return;
  }
  if (!_prog && root) clearErrs(root);
  // work finished: a progress toast ("Detecting sections…") has nothing more to say
  if (m === metaText()) {
    const t = document.getElementById('msToast');
    if (t && t.classList.contains('on') && /\u2026\s*$/.test(t.textContent)) t.classList.remove('on');
  }
  if (m && !_prog && workEl && workEl.offsetParent !== null && m !== metaText())
    toast(m, /could not|couldn|failed|full|not enough|no longer/i.test(m) ? 6500 : 3200);
}
function evCanvas(e) {
  const r = cv.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(cv.width, ((e.clientX - r.left) / r.width) * cv.width)),
    y: Math.max(0, Math.min(cv.height, ((e.clientY - r.top) / r.height) * cv.height)),
  };
}
function drawCropOverlay() {
  _rg = null;
  if (!cropFull) return;
  sizeCanvas();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cropFull, 0, 0);
  if (!cropPx) return;
  const r = cropPx;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(0, 0, cv.width, r.y);
  ctx.fillRect(0, r.y + r.h, cv.width, cv.height - (r.y + r.h));
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, cv.width - (r.x + r.w), r.h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, cv.width / 400);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  const hs = Math.max(7, cv.width / 115);
  ctx.fillStyle = '#fff';
  [
    [r.x, r.y],
    [r.x + r.w / 2, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h / 2],
    [r.x + r.w, r.y + r.h / 2],
    [r.x, r.y + r.h],
    [r.x + r.w / 2, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ].forEach(function (c) {
    ctx.beginPath();
    ctx.arc(c[0], c[1], hs, 0, 6.283);
    ctx.fill();
  });
}
function cropHit(P) {
  const r = cropPx,
    tol = Math.max(24, cv.width * 0.05);
  const dl = Math.abs(P.x - r.x),
    dr = Math.abs(P.x - (r.x + r.w)),
    dt = Math.abs(P.y - r.y),
    db = Math.abs(P.y - (r.y + r.h));
  const wX = P.x >= r.x - tol && P.x <= r.x + r.w + tol,
    wY = P.y >= r.y - tol && P.y <= r.y + r.h + tol;
  if (dl < tol && dt < tol) return 'nw';
  if (dr < tol && dt < tol) return 'ne';
  if (dl < tol && db < tol) return 'sw';
  if (dr < tol && db < tol) return 'se';
  if (dl < tol && wY) return 'w';
  if (dr < tol && wY) return 'e';
  if (dt < tol && wX) return 'n';
  if (db < tol && wX) return 's';
  if (P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h) return 'move';
  return 'new';
}
function autoCrop() {
  if (!labels || !srcImg) return;
  okGeom(function () {
    const rowInk = new Int32Array(H),
      colInk = new Int32Array(W);
    for (let y = 0; y < H; y++) {
      const ro = y * W;
      for (let x = 0; x < W; x++)
        if (labels[ro + x] === -1) {
          rowInk[y]++;
          colInk[x]++;
        }
    }
    const rowThr = Math.max(1, W * 0.012),
      colThr = Math.max(1, H * 0.012);
    let y0 = 0;
    while (y0 < H && rowInk[y0] < rowThr) y0++;
    let y1 = H - 1;
    while (y1 > y0 && rowInk[y1] < rowThr) y1--;
    let x0 = 0;
    while (x0 < W && colInk[x0] < colThr) x0++;
    let x1 = W - 1;
    while (x1 > x0 && colInk[x1] < colThr) x1--;
    if (x1 - x0 < W * 0.2 || y1 - y0 < H * 0.2) {
      geoCancel();
      note('Couldn\u2019t find the drawing \u2014 use Crop to choose it.');
      return;
    }
    const padX = W * 0.03,
      padY = H * 0.03;
    x0 = Math.max(0, x0 - padX);
    x1 = Math.min(W - 1, x1 + padX);
    y0 = Math.max(0, y0 - padY);
    y1 = Math.min(H - 1, y1 + padY);
    const cr = cropRect || { x: 0, y: 0, w: 1, h: 1 };
    cropRect = {
      x: cr.x + (x0 / W) * cr.w,
      y: cr.y + (y0 / H) * cr.h,
      w: ((x1 - x0) / W) * cr.w,
      h: ((y1 - y0) / H) * cr.h,
    };
    reprocessImg();
  });
}
function enterCrop() {
  if (!srcImg) return;
  cropMode = true;
  resetZoom();
  cropFull = buildRotatedFull();
  cropFullW = cropFull.width;
  cropFullH = cropFull.height;
  cv.width = cropFullW;
  cv.height = cropFullH;
  if (cropRect) {
    cropPx = {
      x: cropRect.x * cropFullW,
      y: cropRect.y * cropFullH,
      w: cropRect.w * cropFullW,
      h: cropRect.h * cropFullH,
    };
  } else {
    cropPx = null;
  }
  cropStart = null;
  cropDrag = null;
  cropAnchor = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = 'none';
  drawCropOverlay();
  renderControls();
}
function applyCrop() {
  if (!(cropPx && cropPx.w > 8 && cropPx.h > 8)) {
    cancelCrop();
    return;
  }
  okGeom(function () {
    cropRect = {
      x: cropPx.x / cropFullW,
      y: cropPx.y / cropFullH,
      w: cropPx.w / cropFullW,
      h: cropPx.h / cropFullH,
    };
    cropMode = false;
    cropFull = null;
    const z = document.getElementById('sfZoomCtl');
    if (z) z.style.display = '';
    reprocessImg();
  });
}
function cancelCrop() {
  cropMode = false;
  cropFull = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
  cv.width = W;
  cv.height = H;
  renderControls();
  render();
  note(metaText());
}
function buildRotatedFull() {
  const rad = ((rot90 + tilt) * Math.PI) / 180,
    sw = srcImg.width,
    sh = srcImg.height,
    cos = Math.abs(Math.cos(rad)),
    sin = Math.abs(Math.sin(rad)),
    bw = sw * cos + sh * sin,
    bh = sw * sin + sh * cos,
    sc = Math.min(1, MAXSIDE / Math.max(bw, bh)),
    fw = Math.round(bw * sc),
    fh = Math.round(bh * sc);
  const oc = document.createElement('canvas');
  oc.width = fw;
  oc.height = fh;
  const ox = oc.getContext('2d');
  ox.fillStyle = '#fff';
  ox.fillRect(0, 0, fw, fh);
  ox.translate(fw / 2, fh / 2);
  ox.rotate(rad);
  ox.scale(sc, sc);
  ox.drawImage(srcImg, -sw / 2, -sh / 2);
  return oc;
}
// A grey picture w x h enlarged to w2 x h2 by bicubic (Catmull-Rom) interpolation, the same in every browser (a
// canvas's own smoothing differs between them, and Chrome's is softer). A line's soft grey edge becomes a clean gap
// between two lines that run close together, which at the small size had run into one. (v303)
function grayUp(g, w, h, w2, h2) {
  const taps = function (n, n2) {
    const ix = new Int32Array(n2 * 4),
      wt = new Float32Array(n2 * 4),
      k = n / n2;
    for (let o = 0; o < n2; o++) {
      const x = (o + 0.5) * k - 0.5,
        x0 = Math.floor(x),
        t = x - x0;
      const t2 = t * t,
        t3 = t2 * t;
      const ws = [
        (-t3 + 2 * t2 - t) / 2,
        (3 * t3 - 5 * t2 + 2) / 2,
        (-3 * t3 + 4 * t2 + t) / 2,
        (t3 - t2) / 2,
      ];
      for (let i = 0; i < 4; i++) {
        ix[o * 4 + i] = Math.min(n - 1, Math.max(0, x0 - 1 + i));
        wt[o * 4 + i] = ws[i];
      }
    }
    return { ix: ix, wt: wt };
  };
  const tx = taps(w, w2),
    ty = taps(h, h2),
    mid = new Float32Array(w2 * h),
    out = new Uint8Array(w2 * h2);
  for (let y = 0; y < h; y++) {
    const r = y * w,
      m = y * w2;
    for (let o = 0, q = 0; o < w2; o++, q += 4)
      mid[m + o] =
        g[r + tx.ix[q]] * tx.wt[q] +
        g[r + tx.ix[q + 1]] * tx.wt[q + 1] +
        g[r + tx.ix[q + 2]] * tx.wt[q + 2] +
        g[r + tx.ix[q + 3]] * tx.wt[q + 3];
  }
  for (let o = 0, q = 0; o < h2; o++, q += 4) {
    const a = ty.ix[q] * w2,
      b = ty.ix[q + 1] * w2,
      c = ty.ix[q + 2] * w2,
      d = ty.ix[q + 3] * w2,
      wa = ty.wt[q],
      wb = ty.wt[q + 1],
      wc = ty.wt[q + 2],
      wd = ty.wt[q + 3],
      m = o * w2;
    for (let x = 0; x < w2; x++) {
      const v = mid[a + x] * wa + mid[b + x] * wb + mid[c + x] * wc + mid[d + x] * wd;
      out[m + x] = v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
    }
  }
  return out;
}
function processSrc() {
  _rg = null;
  if (!srcImg) return;
  const oc = buildRotatedFull(),
    fw = oc.width,
    fh = oc.height;
  const cr = cropRect || { x: 0, y: 0, w: 1, h: 1 },
    cx = Math.round(cr.x * fw),
    cy = Math.round(cr.y * fh),
    // (no wider than what's left of the photo: rounded up past its edge, the last column was left empty and read as
    // a line of ink, v296)
    cw = Math.max(8, Math.min(Math.round(cr.w * fw), fw - cx)),
    ch = Math.max(8, Math.min(Math.round(cr.h * fh), fh - cy)),
    // a small picture of the person's own (a page downloaded at 400-800 pixels, say) is enlarged to UPSIDE on its long
    // side before its sections are found; not the sample, whose sections are its own (v303)
    up = srcUp ? Math.min(8, MAXSIDE / Math.max(cw, ch), Math.max(1, UPSIDE / Math.max(cw, ch))) : 1;
  // (the picture changes shape: the zones can't be placed on the sections found from it)
  zoneGeoLost();
  cv.width = cw;
  cv.height = ch;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // (on white: a picture under 8 pixels across is made 8, and the part past its edge would read as ink, v298)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(oc, cx, cy, cw, ch, 0, 0, cw, ch);
  freeCanvas(oc);
  const d = ctx.getImageData(0, 0, cw, ch).data,
    n = cw * ch,
    g0 = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g0[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
  W = cw;
  H = ch;
  gray = g0;
  srcK = 1;
  if (up > 1.05) {
    W = Math.round(cw * up);
    H = Math.round(ch * up);
    gray = grayUp(g0, cw, ch, W, H);
    srcK = W / cw;
    cv.width = W;
    cv.height = H;
  }
  segment();
  // (the Photo pattern's photo goes with the picture: 46-photo, v304)
  photoGeoAfter();
}
// Sensitivity and Enhance: the sections are found again. On a guide with progress or section edits that asks first,
// as turning the picture does (once: the Undo step kept covers the changes that follow); No puts the control back.
// (v288: asked in the app's own dialog; while it's open, further changes to the slider wait for the answer, which then
// goes with the setting as it is by then)
let _reAsk = false;
function geomWords(p, what) {
  return p
    ? 'This redraws the sections and clears your colouring progress (ticks, part-done tones, pins and flat sections)' +
        (hasEdits ? ' and your section edits' : '') +
        '. Undo in Edit sections brings it all back.'
    : what + ' clears your section edits. Undo brings them back.';
}
function resegment() {
  if (!gray || _reAsk) return;
  const top = undoStack[undoStack.length - 1],
    p = !!assignData && hasProgress();
  if (assignData && (hasEdits || p) && !(top && top.reseg && !top.sealed)) {
    _reAsk = true;
    askBox(
      'Detect the sections again?',
      geomWords(p, 'Detecting the sections again'),
      '<button type="button" class="btn-primary" data-a="go">Detect again</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
      true,
    ).then(function (a) {
      _reAsk = false;
      if (a === 'go') {
        reseg();
        return;
      }
      const f = _reFrom;
      _reFrom = null;
      if (f) {
        adaptC = f.c;
        enhance = f.e;
      }
      renderControls();
    });
    return false;
  }
  reseg();
  return true;
}
function reseg() {
  keepSnap(false);
  _reFrom = null;
  segment();
  hasEdits = false;
  if (sfmode === 'review') {
    render();
    segWarnSync();
  }
  note('Sections detected again \u2014 tap Undo to go back.');
  return true;
}
// the detection settings before a change to them (put back if the person says No above)
let _reFrom = null;
function reFrom() {
  if (!_reFrom) _reFrom = { c: adaptC, e: enhance };
}
// Before the sections are found afresh: one Undo step that brings back the sections and all that hangs on them (ticks,
// part-done tones, pins, flat sections, the guide's colours); geo: also the picture as it was (turned, tilted,
// cropped, straightened). Several re-detections in a row share one step, until the guide is built again (sealed);
// each change to the picture itself (turn, crop, straighten) is a step of its own, so Undo goes back one at a time.
function keepSnap(geo) {
  if (!labels || !comps) return null;
  const top = undoStack[undoStack.length - 1];
  if (!geo && top && top.reseg && !top.sealed) return null;
  const ad = assignData
    ? {
        assign: Object.assign({}, assignData.assign),
        order: assignData.order.slice(),
        N: assignData.N,
        base: Object.assign({}, assignData.base || {}),
        paper: assignData.paper ? Object.assign({}, assignData.paper) : undefined,
      }
    : null;
  const s = {
    t: 'seg',
    reseg: true,
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
            framed: c.framed,
            // (what it was merged into or split off from, since the last build: tickCarry)
            into: c.into,
            from: c.from,
            at: c.at,
          }
        : null;
    }),
    sec: secColor.slice(),
    ov: secState.slice(),
    col: colored.slice(),
    keep: {
      tones: tonePart && tonePart._c === colored ? tonePart.slice() : null,
      // (v284: when colouring started and finished, and the shading coloured sections keep)
      progAt: Object.assign({}, progAt),
      held: Object.assign({}, heldSh),
      locks: Object.assign({}, locks),
      flat: Object.assign({}, shadeFlat),
      fresh: _segFresh,
      edits: hasEdits,
      // (Enhance and Sensitivity as they were, v304)
      det: _reFrom ? { e: _reFrom.e, c: _reFrom.c } : { e: enhance, c: adaptC },
      bgMaxB: bgMaxB,
      ad: ad,
      sig: guideSig,
      plan: ad ? planStack.slice() : null,
      orig: Object.assign({}, _origKeys),
      lost: Object.assign({}, _lostKeys),
      gone: Object.assign({}, _gone),
      zones: zoneKeep(),
      geo:
        geo && gray
          ? {
              W: W,
              H: H,
              k: srcK,
              gray: gray,
              src: srcImg,
              pgQ: pgQ,
              pgShape: pgShape,
              rot90: rot90,
              tilt: tilt,
              crop: cropRect ? Object.assign({}, cropRect) : null,
              // (the Photo pattern's placement on the picture as it was, the photo it was for, and whether it was still to be
              // placed again, v304)
              phXf: photoXf ? Object.assign({}, photoXf) : null,
              phRef: photoRef,
              phGeo: _phGeo,
              phRefit: _phRefit,
            }
          : null,
    },
  };
  pushUndo(s);
  return s;
}
// anything of the guide's own that redrawing the sections would clear
function hasProgress() {
  if (Object.keys(locks).length || Object.keys(shadeFlat).length) return true;
  if (!assignData || !colored) return false;
  const P = tonePart && tonePart._c === colored ? tonePart : null;
  for (let l = 1; l < colored.length; l++) if (colored[l] || (P && P[l])) return true;
  return false;
}
// asked before the picture is turned, tilted, cropped or straightened; on yes the way back is kept for Undo, then go()
// runs (at once when there's nothing to ask). v288: the app's own dialog, not the browser's.
let _geoSnap = null,
  _geoAsk = false;
function geomAsks() {
  return hasEdits || hasProgress();
}
function okGeom(go) {
  _geoSnap = null;
  if (!geomAsks()) {
    _geoSnap = keepSnap(true);
    go();
    return;
  }
  if (_geoAsk) return;
  _geoAsk = true;
  askBox(
    'Rebuild the sections?',
    geomWords(hasProgress(), 'Rotating or cropping'),
    '<button type="button" class="btn-primary" data-a="go">Rebuild</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
    true,
  ).then(function (a) {
    _geoAsk = false;
    if (a !== 'go') return;
    _geoSnap = keepSnap(true);
    go();
  });
}
// okGeom said yes but nothing changed after all: its Undo step goes again
function geoCancel() {
  if (_geoSnap && undoStack[undoStack.length - 1] === _geoSnap) popUndo();
  _geoSnap = null;
}
// the picture changed: an Undo step from okGeom leads back to it; without one the older steps no longer fit the picture
function geoUndoOK() {
  const top = undoStack[undoStack.length - 1];
  if (!(top && top.reseg && !top.sealed && top.keep.geo)) clearUndo();
}
function reprocessImg() {
  if (!srcImg) return;
  _reFrom = null;
  const he = hasEdits || hasProgress();
  processSrc();
  hasEdits = false;
  geoUndoOK();
  resetZoom();
  editMode = 'toggle';
  if (sfmode !== 'review') sfmode = 'review';
  renderControls();
  render();
  note(
    he
      ? 'Sections rebuilt from the photo \u2014 tap Undo to bring back your edits and progress.'
      : metaText(),
  );
}
// (v304: a tilt waiting to be applied has a timer of its own, so a Sensitivity change, or a control on the Plan, no
// longer drops it; it finds the sections with the settings as they are by then)
let _imgT = 0;
function debSeg() {
  if (_imgT) return;
  clearTimeout(reTimer);
  reTimer = setTimeout(resegment, 80);
}
function debImg() {
  clearTimeout(reTimer);
  clearTimeout(_imgT);
  _imgT = setTimeout(function () {
    _imgT = 0;
    reprocessImg();
  }, 90);
}
// (a tilt still waiting, dropped: a new picture, or Undo, which puts back the picture as it was, v304)
function imgCancel() {
  clearTimeout(_imgT);
  _imgT = 0;
}
var SAMPLES = ['@@dataurl(assets/sample-jellyfish.png)'],
  SAMPLE_NAMES = ['jellyfish'],
  sampleIdx = 0,
  // (v300) the sample page coloured from its guide, codes on it: the start cards' picture of what the app makes
  SAMPLE_DONE = '@@dataurl(assets/sample-coloured.webp)',
  // (v306) the same, without its codes: the welcome's picture (src/assets/sample-plain.webp, the sample's guide as Save
  // image makes it with Codes unticked, 340 px wide)
  SAMPLE_PLAIN = '@@dataurl(assets/sample-plain.webp)';
// the welcome's picture: the sample page (its white made the guide's paper, its black the guide's lines, so the coloured
// guide lies exactly over it) and its guide without codes. A canvas, drawn once the page has loaded: only for a first run
function samplePics() {
  const c = document.createElement('canvas'),
    img = new Image();
  img.onload = function () {
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(' + PAPER.join(',') + ')';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'lighten';
    g.fillStyle = 'rgb(' + LINE.join(',') + ')';
    g.fillRect(0, 0, c.width, c.height);
  };
  img.src = SAMPLES[0];
  return { line: c, plain: SAMPLE_PLAIN };
}
// the start cards' before and after (the page, then its guide), until there's a guide of one's own
function sampleBA() {
  return (
    '<span class="hcba"><img class="hcbal" alt="" src="' +
    SAMPLES[0] +
    '"><span class="hcbaar" aria-hidden="true">\u2192</span><img alt="" src="' +
    SAMPLE_DONE +
    '"></span>'
  );
}
function loadSample() {
  stashDirty().then(function (ok) {
    if (ok) _loadSample();
  });
}
function _loadSample() {
  var si = sampleIdx % SAMPLES.length,
    nm = SAMPLE_NAMES[si];
  sampleIdx++;
  _smpLoad = true;
  note('Loading sample\u2026');
  const gen = ++loadGen;
  var img = new Image();
  img.onload = function () {
    try {
      if (!img.width || !img.height) {
        note('Couldn\u2019t load the sample. Try again.');
        return;
      }
      if (gen !== loadGen) return;
      resetForNewPicture();
      // (a palette held for the next new guide is this one's, the sample too, v289)
      takeNextPal();
      pgOrig = null;
      srcImg = img;
      srcUp = false;
      processSrc();
      sfmode = 'review';
      resetZoom();
      enterWork();
      var _rs = document.getElementById('sfResume');
      if (_rs) _rs.style.display = 'none';
      renderControls();
      render();
      note(metaText());
      // the sample is already clean line art: go straight to the finished guide (\u2190 Sections still opens the editor).
      // It joins the Library only once it's changed (v285: sampleBuilt, 60-persist)
      buildGuide();
      // (only once it's built: a build that stopped short, every marker dry say, leaves a picture like any other)
      if (assignData) sampleBuilt('Sample ' + nm);
      renderHead();
      renderControls();
      saveStatus();
    } catch (err) {
      note('Couldn\u2019t open the sample. Try again.');
    }
  };
  img.onerror = function () {
    _smpLoad = false;
    if (gen === loadGen) note('Couldn\u2019t open the sample. Try again.');
  };
  var _sv = SAMPLES[si];
  img.src = _sv.slice(0, 5) === 'data:' ? _sv : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(_sv);
}
function loadImage(file) {
  stashDirty().then(function (ok) {
    if (ok) _loadImage(file);
  });
}
// phone photos are often 12-48 megapixels; nothing downstream uses more than MAXSIDE, so keep a copy at that size
// (a 48 MP photo held at full size takes ~190 MB of memory)
function fitSource(img) {
  const w = img.naturalWidth || img.width,
    h = img.naturalHeight || img.height,
    s = MAXSIDE / Math.max(w, h);
  if (s >= 1) return img;
  try {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    drawShrunk(g, img, c.width, c.height);
    return c;
  } catch (e) {
    return img;
  }
}
function _loadImage(file) {
  _smpLoad = false;
  note('Reading photo\u2026');
  const gen = ++loadGen;
  let url = null;
  // the lens's focal length from the photo's camera data, for the page's true shape when straightening
  const lens =
    file && file.slice && file.slice(0, 262144).arrayBuffer
      ? file
          .slice(0, 262144)
          .arrayBuffer()
          .then(pgExifFocal)
          .catch(function () {
            return 0;
          })
      : Promise.resolve(0);
  try {
    url = URL.createObjectURL(file);
  } catch (e) {}
  const fr = url ? null : new FileReader();
  const go = function (src) {
    const img = new Image();
    img.onload = function () {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      if (gen !== loadGen) return;
      if (!img.width || !img.height) {
        note('That image looked empty \u2014 try another file.');
        return;
      }
      lens.then(function (f35) {
        if (gen !== loadGen) return;
        try {
          note('Detecting sections\u2026');
          resetForNewPicture();
          // (once the photo has opened: one that won't leaves the open guide's palette alone, v289)
          takeNextPal();
          srcImg = fitSource(img);
          srcUp = true;
          enterWork();
          var _rs = document.getElementById('sfResume');
          if (_rs) _rs.style.display = 'none';
          // a photographed page is found and flattened first (or its corners offered for checking); a scan goes straight on
          pgBegin(f35);
        } catch (err) {
          note('Couldn’t process that photo: ' + ((err && err.message) || err));
        }
      });
    };
    img.onerror = function () {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      if (gen !== loadGen) return;
      note('That file couldn\u2019t be opened as a picture \u2014 try a JPEG or PNG.');
    };
    img.src = src;
  };
  if (url) go(url);
  else {
    fr.onload = function () {
      if (gen === loadGen) go(fr.result);
    };
    fr.onerror = function () {
      if (gen === loadGen) note('Couldn’t read that file.');
    };
    fr.readAsDataURL(file);
  }
}
