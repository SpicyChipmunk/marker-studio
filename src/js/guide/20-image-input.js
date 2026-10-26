/* ---- image input ---- */
// Everything that belongs to the picture that was open (not the user's style choices), cleared before a new
// photo, the sample or a saved guide takes its place. Returns a token: a slow load that finds loadGen has moved on
// (the user opened something else meanwhile) must stop. A change still waiting to be saved is saved first, into the
// guide it was made in (the Library entry or the autosave slot).
function resetForNewPicture() {
  // (v318.14: sections still being found for the picture before go with it)
  segStop();
  // (v320: a wait for a photo before this ends; a new photo's own starts again in detect)
  waitEnd();
  // (v318.35: Treat hatching as one section starts again from the picture's own default, pgProceed)
  hatchOne = true;
  hatchSet = false;
  // (v318.37: the hatched patches found were the old picture's; a saved guide opened runs no detection, and its Edit
  // sections had said "Found N hatched patches" about the picture before, X1-6)
  hatchMade = 0;
  hatchWould = 0;
  // (v319: the page finder's findings were the old picture's too: a camera photo kept as photographed (pgHint 'kept',
  // its lens pgF35) had left the sample, or a guide saved before v318.34, 'kept' as well, so their hatching never
  // merged and Edit sections' note said to straighten the page first, Y1-3. pgBegin and srcOpen set them again)
  pgHint = null;
  pgF35 = 0;
  pgSteep = false;
  _preview = false;
  // (v318.15: its own bands, found as it's prepared: srcPrep)
  edgeBands = null;
  photoSettleNow();
  // (v318.13: its own Min section size, from its size: minPosAuto, set in processSrc)
  minAuto = true;
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
  // (v308: a new guide, the sample too, has the Include row, with the Mood's choices; a guide saved before has none)
  if (!gradIncl) gradIncl = {};
  // (v313: a new guide, the sample too, takes a marker's family from its code's letters and first digit: famRule; v315:
  // and Copic's greys theirs; v316: blend companions outside the family a step a blend can make; v318: a companion a
  // clear step away by eye)
  famRule = 4;
  // (the running-low lines closed: the guide's own, none for a new one)
  lowX = null;
  colOffer = null;
  focusAt = null;
  smpTry = 0;
  // (v314: a new guide, the sample too, shares a Gradient's run out by its sections' areas softened: gradArea; v315: the
  // adapting rule, pins bigger than a share counting for nothing, and no two markers too alike in the run; v318:
  // touching sections kept off near twins; v318.10: no near twins picked for the run while other markers will do;
  // v318.11: Shuffle on a light-to-dark run moves its handovers)
  gradArea = 5;
  // (v318.12: an edge-to-edge drawing keeps its edge shapes)
  bgRule = 1;
  _mkOpened = {};
  _blendSel = {};
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
  srcDims = null;
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
  // (v318.34: how the picture came in, and a reopened guide's picture settings: 25-source-photo)
  srcFrom = null;
  _srcSet = null;
  // (v325: a photo made into a page is the old picture's: 47-photo-page)
  pp = null;
  // (v327: a new picture: no photo tones kept)
  ptReset();
  _ppPrep = null;
  _ppGen++;
  _ppBusy = false;
  photoReset();
  rot90 = 0;
  tilt = 0;
  // (Enhance and its line sensitivity were set for the old picture's lighting, as its turn and crop were, v298)
  enhance = true;
  adaptC = 9;
  sensUser = false;
  faintCut = 0;
  faintOffer = 0;
  srcColour = null;
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
  railSync();
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
  whitePins = {};
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
// (quiet, v327.1: the meta line only, no toast)
function note(m, quiet) {
  // (v310: not while a Mood picture is made, 32-mood-pics: the guide on screen hasn't changed)
  if (_mpQuiet) return;
  const _plain = typeof m === 'string' ? m.replace(/<[^>]*>/g, '') : '',
    _prog = /(\u2026|\.\.\.)\s*$/.test(_plain);
  if (metaEl) metaEl.innerHTML = m;
  // a failure is shown as a card where the guide is, not as a passing toast
  if (
    /^(could not|couldn|that file|that is not|that image|that\u2019s a pdf|that pdf|this browser can|no markers|not enough)/i.test(
      _plain.trim(),
    )
  ) {
    const a = document.getElementById(workEl && workEl.offsetParent !== null ? 'sfHead' : 'sfStart');
    if (a && a.offsetParent !== null) {
      const c = errCard(a, m);
      // (v308: under the start card, the card's own line goes back to what it says: the message was shown twice)
      if (a.id === 'sfStart' && metaEl) metaEl.innerHTML = metaText();
      // (v318 review: on a phone the card under the start card was below the screen's foot, so a PDF or photo that
      // wouldn't open seemed to do nothing at all: brought into view)
      if (c && c.getBoundingClientRect) {
        const r = c.getBoundingClientRect();
        if (r.bottom > window.innerHeight || r.top < 0)
          try {
            c.scrollIntoView({ block: 'nearest' });
          } catch (_) {}
      }
    } else toastHTML(m, 6500);
    return;
  }
  if (!_prog && root) clearErrs(root);
  // work finished: a progress toast ("Detecting sections…") has nothing more to say
  if (m === metaText()) {
    const t = document.getElementById('msToast');
    if (t && t.classList.contains('on') && /\u2026\s*$/.test(t.textContent)) t.classList.remove('on');
  }
  if (m && !quiet && !_prog && workEl && workEl.offsetParent !== null && m !== metaText())
    toastHTML(m, /could not|couldn|failed|full|not enough|no longer/i.test(m) ? 6500 : 3200);
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
// Auto crop (v308): to the inside of the largest ruled rectangle when there is one (a page's own frame, in a
// screenshot with the browser round it), padded 3%; otherwise to where the ink is, as before. Worked out before
// anything changes: when it would trim almost nothing (97% or more of the picture both ways) it says so and adds no
// Undo step. The rectangle is used only when the sections outside it, those not running to the picture's edge, come to
// at most CROP_OUT of the picture (a screenshot's status text and tab dots; not a drawing round a board in its middle).
const CROP_OUT = 0.03;
function autoCropBox() {
  let fb = ruledBox();
  const out = fb ? frameOutside(fb, true) : null;
  if (fb && out > CROP_OUT) fb = 0;
  let x0,
    y0,
    x1,
    y1,
    // (how far the padding may reach: the picture, or inside the binding or table, v318.15)
    pb = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  if (fb) {
    const c = comps[fb];
    x0 = c.x0;
    y0 = c.y0;
    x1 = c.x1;
    y1 = c.y1;
  } else {
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
      colThr = Math.max(1, H * 0.012),
      // (v318.15: the binding or table along an edge isn't the drawing: trimOffer's bands, not counted as ink)
      eb = trimBands() ? edgeBands : null,
      et = eb ? Math.ceil(eb.t * H) : 0,
      ebt = eb ? H - 1 - Math.ceil(eb.b * H) : H - 1,
      el = eb ? Math.ceil(eb.l * W) : 0,
      er = eb ? W - 1 - Math.ceil(eb.r * W) : W - 1;
    if (eb) {
      rowInk.fill(0);
      colInk.fill(0);
      for (let y = et; y <= ebt; y++) {
        const ro = y * W;
        for (let x = el; x <= er; x++)
          if (labels[ro + x] === -1) {
            rowInk[y]++;
            colInk[x]++;
          }
      }
    }
    y0 = et;
    while (y0 < H && rowInk[y0] < rowThr) y0++;
    y1 = ebt;
    while (y1 > y0 && rowInk[y1] < rowThr) y1--;
    x0 = el;
    while (x0 < W && colInk[x0] < colThr) x0++;
    x1 = er;
    while (x1 > x0 && colInk[x1] < colThr) x1--;
    if (x1 - x0 < W * 0.2 || y1 - y0 < H * 0.2) return null;
    pb = { x0: el, y0: et, x1: er, y1: ebt };
  }
  const padX = W * 0.03,
    padY = H * 0.03;
  x0 = Math.max(pb.x0, x0 - padX);
  x1 = Math.min(pb.x1, x1 + padX);
  y0 = Math.max(pb.y0, y0 - padY);
  y1 = Math.min(pb.y1, y1 + padY);
  return { x0: x0, y0: y0, x1: x1, y1: y1, ruled: !!fb, out: out };
}
function autoCrop() {
  if (!labels || !srcImg) return;
  const b = autoCropBox();
  if (!b) {
    note('Couldn\u2019t find the drawing \u2014 use Crop to choose it.');
    return;
  }
  if (b.x1 - b.x0 >= W * 0.97 && b.y1 - b.y0 >= H * 0.97) {
    note('Nothing to trim.');
    return;
  }
  okGeom(function () {
    const cr = cropRect || { x: 0, y: 0, w: 1, h: 1 };
    cropRect = {
      x: cr.x + (b.x0 / W) * cr.w,
      y: cr.y + (b.y0 / H) * cr.h,
      w: ((b.x1 - b.x0) / W) * cr.w,
      h: ((b.y1 - b.y0) / H) * cr.h,
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
  }, ppOn());
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
// The picture turned and tilted, at working size. edge (v308, for finding the sections: processSrc): a tilt's
// turned-in corners are filled with the photo's own edge carried outwards, not white, so the grey paper of a
// photographed page doesn't meet a white wedge that reads as a line and specks (Ben's page tilted 1°: 216 sections
// became 446). Crop's view keeps white, to show where the photo ends.
function buildRotatedFull(edge) {
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
  const tr = Math.abs(Math.sin((tilt * Math.PI) / 180));
  if (edge && tr > 1e-4) {
    const w = Math.max(1, Math.round(sw * sc)),
      h = Math.max(1, Math.round(sh * sc)),
      P = Math.ceil(Math.max(w, h) * tr) + 4,
      pc = edgePadded(srcImg, w, h, P);
    ox.drawImage(pc, -w / 2 - P, -h / 2 - P);
    freeCanvas(pc);
    return oc;
  }
  ox.scale(sc, sc);
  ox.drawImage(srcImg, -sw / 2, -sh / 2);
  return oc;
}
// img drawn at w x h with a border P wide all round, the border each side's edge carried outwards: the average of 8
// rows (or columns) starting 2 px in from that side, smoothed over 2 px either way along it; the corners carry the
// ends of the top and bottom strips. (One row copied outwards turned the photo's grain into streaks.) v308
function edgePadded(img, w, h, P) {
  const c = document.createElement('canvas'),
    cw = w + 2 * P,
    ch = h + 2 * P;
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cw, ch);
  g.drawImage(img, P, P, w, h);
  if (w < 16 || h < 16) return c;
  const D = 8,
    IN = 2;
  // the average colour along one side: n places, each the mean of D pixels across it
  const strip = function (x, y, sw, sh, along) {
    const d = g.getImageData(x, y, sw, sh).data,
      n = along ? sw : sh,
      a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      let r = 0,
        gg = 0,
        b = 0;
      for (let j = 0; j < D; j++) {
        const p = (along ? j * sw + k : k * sw + j) * 4;
        r += d[p];
        gg += d[p + 1];
        b += d[p + 2];
      }
      a[k * 3] = r / D;
      a[k * 3 + 1] = gg / D;
      a[k * 3 + 2] = b / D;
    }
    // (smoothed along the side, 2 px either way)
    const o = new Uint8ClampedArray(n * 3);
    for (let k = 0; k < n; k++) {
      const k0 = Math.max(0, k - 2),
        k1 = Math.min(n - 1, k + 2);
      for (let ch2 = 0; ch2 < 3; ch2++) {
        let s = 0;
        for (let q = k0; q <= k1; q++) s += a[q * 3 + ch2];
        o[k * 3 + ch2] = Math.round(s / (k1 - k0 + 1));
      }
    }
    return o;
  };
  const top = strip(P, P + IN, w, D, true),
    bot = strip(P, P + h - IN - D, w, D, true),
    lef = strip(P + IN, P, D, h, false),
    rig = strip(P + w - IN - D, P, D, h, false);
  // the bands above and below (the full width, corners included), then left and right of the photo
  const band = function (s, y0) {
    const im = g.createImageData(cw, P),
      d = im.data;
    for (let x = 0; x < cw; x++) {
      const k = Math.max(0, Math.min(w - 1, x - P)) * 3;
      for (let y = 0; y < P; y++) {
        const p = (y * cw + x) * 4;
        d[p] = s[k];
        d[p + 1] = s[k + 1];
        d[p + 2] = s[k + 2];
        d[p + 3] = 255;
      }
    }
    g.putImageData(im, 0, y0);
  };
  const side = function (s, x0) {
    const im = g.createImageData(P, h),
      d = im.data;
    for (let y = 0; y < h; y++) {
      const k = y * 3;
      for (let x = 0; x < P; x++) {
        const p = (y * P + x) * 4;
        d[p] = s[k];
        d[p + 1] = s[k + 1];
        d[p + 2] = s[k + 2];
        d[p + 3] = 255;
      }
    }
    g.putImageData(im, x0, P);
  };
  band(top, 0);
  band(bot, P + h);
  side(lef, 0);
  side(rig, P + w);
  return c;
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
  const pic = srcPrep();
  if (!pic) return;
  srcCommit(pic);
  segment();
  // (the Photo pattern's photo goes with the picture: 46-photo, v304)
  photoGeoAfter();
}
// (v318.14) processSrc with a paint between its steps (segRun, 10-segment): resolves true once the new picture and its
// sections are in place, false when something newer took over. hide: the controls out of sight meanwhile
function processSrcAsync(hide) {
  _rg = null;
  if (!srcImg) return Promise.resolve(false);
  return segRun(
    function () {
      const p = srcPrep();
      if (!p) throw new Error('no picture');
      return p;
    },
    function (p) {
      _rg = null;
      srcCommit(p);
    },
    hide,
  ).then(function (ok) {
    if (ok) photoGeoAfter();
    return ok;
  });
}
// the picture as it will be worked on: turned, tilted, cropped, in grey, enlarged when small (v318.14: drawn on a canvas
// of its own, the picture on the page left as it is until srcCommit)
function srcPrep() {
  if (!srcImg) return null;
  const oc = buildRotatedFull(true),
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
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true });
  // (on white: a picture under 8 pixels across is made 8, and the part past its edge would read as ink, v298)
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cw, ch);
  g.drawImage(oc, cx, cy, cw, ch, 0, 0, cw, ch);
  freeCanvas(oc);
  const d = g.getImageData(0, 0, cw, ch).data,
    n = cw * ch,
    g0 = new Uint8Array(n);
  freeCanvas(c);
  for (let i = 0, j = 0; i < n; i++, j += 4) g0[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
  // (how much of it is coloured in, for the warning about a page coloured already: segQuality, v308)
  const colour = colourShare(d, n),
    p = {
      W: cw,
      H: ch,
      gray: g0,
      // (v318.35: each pixel's colour, for a page with colour on it: the ink and the offer to mark sections done)
      chroma: chromaOf(d, n, colour),
      srcK: 1,
      dims: { w: cw, h: ch },
      colour: colour,
      // (v318.15) a photo as taken, as it came: the binding or the table along its edges (Auto crop leaves them out).
      // Found while it's as taken and kept through a crop or a turn (trimOffer asks for neither), so Undo of Trim it
      // offers it again; a new picture starts without (resetForNewPicture)
      bands: pgOrig && !pgQ && !cropRect && !rot90 && !tilt ? edgeBandsOf(d, cw, ch) : undefined,
    };
  if (up > 1.05) {
    p.W = Math.round(cw * up);
    p.H = Math.round(ch * up);
    p.gray = grayUp(g0, cw, ch, p.W, p.H);
    if (p.chroma) p.chroma = grayUp(p.chroma, cw, ch, p.W, p.H);
    p.srcK = p.W / cw;
  }
  return p;
}
// the prepared picture put in place, before its sections are found
function srcCommit(p) {
  // (the picture changes shape: the zones can't be placed on the sections found from it)
  zoneGeoLost();
  cv.width = p.W;
  cv.height = p.H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  srcColour = p.colour;
  W = p.W;
  H = p.H;
  gray = p.gray;
  chroma = p.chroma || null;
  srcK = p.srcK;
  srcDims = p.dims;
  if (p.bands !== undefined) edgeBands = p.bands;
  if (minAuto) minPos = minPosAuto();
}
// (v318.15) A sketchbook page photographed as it is keeps its spiral binding and a strip of the table along its
// edges, dark blobs that Auto crop kept (they're ink) and the guide printed. edgeBandsOf finds them: from each edge in,
// rows (or columns) over a quarter of whose pixels are off the paper (dark grey: under 0.45 of the paper's
// brightness and nearly colourless; or a brownish table), in runs averaging EDGE_RUN px or more (a binding's holes,
// a table: not a page's hatching or lines, whose runs are a line's width), up to EDGE_MAX of the picture. As
// fractions of the picture: { t, b, l, r }, or null with none of 1% or more. Only for a page that isn't coloured in
// (trimOffer): on Ben's coloured sketchbook pages the colour ran into the bands (left 5-12% on 3 of 7).
let edgeBands = null;
const EDGE_MAX = 0.06,
  EDGE_RUN = 12;
function edgeBandsOf(d, w, h) {
  try {
    const n = w * h,
      g = new Uint8Array(n),
      hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const v = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
      g[i] = v;
      hist[v]++;
    }
    let paper = 255,
      acc = 0;
    while (paper > 0 && acc + hist[paper] < n * 0.05) acc += hist[paper--];
    const off = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = d[j],
        gg = d[j + 1],
        b = d[j + 2],
        ch = Math.max(r, gg, b) - Math.min(r, gg, b),
        v = g[i];
      off[i] = (v < paper * 0.45 && ch < 28) || (v < paper * 0.75 && ch >= 28 && ch < 70 && r > b) ? 1 : 0;
    }
    // one line of pixels (count of them, start, step): off the paper?
    // (or in runs half that long on a line darker overall than the paper's 0.8: a binding's wire and holes, in the
    // shadow along it)
    const offLine = function (len, at, step) {
      let k = 0,
        runs = 0,
        sum = 0,
        inRun = false;
      for (let i = 0, q = at; i < len; i++, q += step) {
        sum += g[q];
        if (off[q]) {
          k++;
          if (!inRun) runs++;
          inRun = true;
        } else inRun = false;
      }
      const rl = k / Math.max(1, runs);
      return k > len * 0.25 && (rl >= EDGE_RUN || (rl >= EDGE_RUN / 2 && sum < len * paper * 0.8));
    };
    const run = function (count, line) {
      let k = 0;
      const lim = Math.floor(count * EDGE_MAX);
      while (k < lim && line(k)) k++;
      return k / count;
    };
    const B = {
      t: run(h, function (k) {
        return offLine(w, k * w, 1);
      }),
      b: run(h, function (k) {
        return offLine(w, (h - 1 - k) * w, 1);
      }),
      l: run(w, function (k) {
        return offLine(h, k, w);
      }),
      r: run(w, function (k) {
        return offLine(h, w - 1 - k, w);
      }),
    };
    return Math.max(B.t, B.b, B.l, B.r) >= 0.01 ? B : null;
  } catch (e) {
    return null;
  }
}
// the trim offered on its own line (53-controls-stages): a photo as taken, as it came, not coloured in, and only
// when Auto crop would then crop (a thin band on a drawing that fills the page leaves "Nothing to trim": autoCrop)
let _trimMemo = null;
function trimOffer() {
  if (!trimBands()) return false;
  if (!_trimMemo || _trimMemo.l !== labels || _trimMemo.c !== comps || _trimMemo.b !== edgeBands) {
    let ok = false;
    try {
      const b = labels ? autoCropBox() : null;
      ok = !!b && !(b.x1 - b.x0 >= W * 0.97 && b.y1 - b.y0 >= H * 0.97);
    } catch (e) {
      ok = false;
    }
    _trimMemo = { l: labels, c: comps, b: edgeBands, ok: ok };
  }
  return _trimMemo.ok;
}
// (the bands, for a photo they apply to: what autoCropBox leaves out)
function trimBands() {
  return !!(
    edgeBands &&
    pgOrig &&
    !pgQ &&
    !cropRect &&
    !rot90 &&
    !tilt &&
    srcColour != null &&
    srcColour <= 0.05
  );
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
  // (v325: a photo-made page has no lines to find: its sections are made, 47-photo-page)
  if (!gray || _reAsk || ppOn()) return;
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
        faintCut = f.f || 0;
        hatchOne = f.h !== false;
      }
      renderControls();
    });
    return false;
  }
  reseg();
  return true;
}
// (v318.25) while sections are being found again: the settings the sections still in place were found with, and the
// Undo step this re-detection made (s: none when it shares an earlier one). A turn, crop or tilt before they're found
// keeps those settings with those sections (it had kept the new ones, so its Undo brought back the old sections with
// the new Sensitivity), and takes the place of that step (whose Undo then changed nothing on the picture). n: the
// newest re-detection, which alone clears it when done (or taken over)
let _segIn = null,
  _resegN = 0;
function reseg() {
  const s = keepSnap(false),
    my = ++_resegN;
  // (a re-detection taking over from one still under way: the sections in place are still those the first found)
  if (!segBusy || !_segIn)
    _segIn = {
      det: _reFrom
        ? { e: _reFrom.e, c: _reFrom.c, f: _reFrom.f, h: _reFrom.h }
        : { e: enhance, c: adaptC, f: faintCut, h: hatchOne },
      s: s,
    };
  _reFrom = null;
  // (v318.14: with a paint between its steps; a newer change takes over from it, segRun)
  note('Detecting sections\u2026');
  segThen(
    function () {
      return segRun(null, null);
    },
    segment,
    function (ok) {
      if (my === _resegN) _segIn = null;
      if (!ok) return;
      hasEdits = false;
      if (sfmode === 'review') {
        render();
        segWarnSync();
        faintLineSync();
        hatchLineSync();
      }
      note('Sections detected again \u2014 tap Undo to go back.');
    },
    function (err) {
      if (my === _resegN) _segIn = null;
      note(errNote('Couldn’t detect the sections again.', 'Detecting sections', err));
    },
  );
  return true;
}
// the detection settings before a change to them (put back if the person says No above)
let _reFrom = null;
function reFrom() {
  // (v318.35: and Treat hatching as one section, h)
  if (!_reFrom) _reFrom = { c: adaptC, e: enhance, f: faintCut, h: hatchOne };
}
// Before the sections are found afresh: one Undo step that brings back the sections and all that hangs on them (ticks,
// part-done tones, pins, flat sections, the guide's colours); geo: also the picture as it was (turned, tilted,
// cropped, straightened). Several re-detections in a row share one step, until the guide is built again (sealed);
// each change to the picture itself (turn, crop, straighten) is a step of its own, so Undo goes back one at a time.
function keepSnap(geo) {
  if (!labels || !comps) return null;
  const top = undoStack[undoStack.length - 1];
  if (!geo && top && top.reseg && !top.sealed) {
    // (still a new edit: Redo no longer follows on, v311)
    secFwd = [];
    return null;
  }
  // (v318.25: a turn, crop or tilt while sections are found again: in place of the step that re-detection made, which
  // holds the same sections, _segIn; kept with it, put back should the change come to nothing, geoCancel)
  const was = geo && segBusy && _segIn && _segIn.s && top === _segIn.s ? popUndo(true) : null;
  const s = keepObj(geo);
  pushUndo(s);
  if (was) s._was = was;
  return s;
}
// the step keepSnap keeps: the sections and all that hangs on them as they are now (also for Redo, 65-edit secNow)
function keepObj(geo) {
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
            // (v318.32: a crumb crumbClean made paper, its size then: segQuality counts them)
            crumb: c.crumb,
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
      // (v318.26: the sections left white)
      white: Object.assign({}, whitePins),
      flat: Object.assign({}, shadeFlat),
      fresh: _segFresh,
      edits: hasEdits,
      // (Enhance and Sensitivity as they were, v304)
      // (v308: and whether faint grey marks were ignored)
      // (v318.25: and while they're being found again, those of the sections still in place, _segIn)
      det:
        segBusy && _segIn
          ? Object.assign({}, _segIn.det)
          : _reFrom
            ? { e: _reFrom.e, c: _reFrom.c, f: _reFrom.f, h: _reFrom.h }
            : { e: enhance, c: adaptC, f: faintCut, h: hatchOne },
      bgMaxB: bgMaxB,
      bgEdgeAll: bgEdgeAll,
      // (v325: a photo-made page's settings and its markers as made, and Markers in this guide with them: a make sets
      // it to the count it chose, so the plan is as made after an Undo too, 47-photo-page)
      pp: ppCopy(pp),
      ppN: pp ? limitN : undefined,
      // (v308: the offer to ignore faint grey marks, as it was for those sections)
      fo: faintOffer,
      // (v318.35: the hatched patches merged in those sections, for Edit sections' note)
      hm: hatchMade,
      hw: hatchWould,
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
              // (v318.35: its colour, read with the grey)
              chroma: chroma,
              src: srcImg,
              pgQ: pgQ,
              pgShape: pgShape,
              // (v308: how coloured that picture was, for the warning)
              col: srcColour,
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
  return s;
}
// anything of the guide's own that redrawing the sections would clear
function hasProgress() {
  if (Object.keys(locks).length || Object.keys(shadeFlat).length || Object.keys(whitePins).length)
    return true;
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
// (v325) page: a photo-made page is made again (47-photo-page), and asked about in those words; stay: what to do when
// the answer is Cancel
function okGeom(go, page, stay) {
  _geoSnap = null;
  if (!geomAsks()) {
    _geoSnap = keepSnap(true);
    go();
    return;
  }
  if (_geoAsk) return;
  _geoAsk = true;
  askBox(
    page ? 'Make the page again?' : 'Rebuild the sections?',
    page
      ? hasProgress()
        ? 'This makes a new page and clears your colouring progress (ticks, part-done tones, pins and flat sections)' +
          (hasEdits ? ' and your section edits' : '') +
          '. Undo in Edit sections brings it all back.'
        : 'This makes a new page and clears your section edits. Undo brings them back.'
      : geomWords(hasProgress(), 'Rotating or cropping'),
    page
      ? '<button type="button" class="btn-primary" data-a="go">Make again</button><button type="button" class="sfghost" data-a="stay">Cancel</button>'
      : '<button type="button" class="btn-primary" data-a="go">Rebuild</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
    true,
  ).then(function (a) {
    _geoAsk = false;
    if (a !== 'go') {
      if (stay) stay();
      return;
    }
    _geoSnap = keepSnap(true);
    go();
  });
}
// okGeom said yes but nothing changed after all: its Undo step goes again
function geoCancel() {
  // (and Redo as it was before it, v311)
  if (_geoSnap && undoStack[undoStack.length - 1] === _geoSnap) {
    popUndo(true);
    // (v318.25: and the re-detection's step it took the place of, keepSnap: the way back from those sections)
    if (_geoSnap._was) pushUndo(_geoSnap._was);
  }
  _geoSnap = null;
}
// the picture changed: an Undo step from okGeom leads back to it; without one the older steps no longer fit the picture
function geoUndoOK() {
  // (v318.25: the change is made: the step it took the place of isn't needed again, keepSnap)
  if (_geoSnap) delete _geoSnap._was;
  const top = undoStack[undoStack.length - 1];
  if (!(top && top.reseg && !top.sealed && top.keep.geo)) clearUndo();
}
function reprocessImg() {
  if (!srcImg) return;
  // (v325: a photo-made page is made again from the photo as turned or cropped now, 47-photo-page)
  if (ppOn()) {
    ppRemade(true);
    return;
  }
  _reFrom = null;
  const he = hasEdits || hasProgress();
  // (v318.14: with a paint between its steps, segRun)
  note('Detecting sections\u2026');
  segThen(
    processSrcAsync,
    processSrc,
    function (ok) {
      if (!ok) return;
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
    },
    function (err) {
      note(
        errNote('Couldn’t process that photo. Try it again, or another photo.', 'Processing a photo', err),
      );
    },
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
// (v320) The sample is Ben's two jellyfish (src/assets/sample-dual.png, his drawing), and his own page of it coloured
// (sample-dual-coloured.webp: photographed, lined up with the drawing and its paper evened) is what the app makes: the
// start cards' "after" and the welcome's picture. Under test (window.__MS_TEST) the single jellyfish of v284–v319 stays
// the sample, as the tests were written for (window.__MS_SAMPLE_NEW: the new one under test too)
var SAMPLE_OLD = !!(window.__MS_TEST && !window.__MS_SAMPLE_NEW),
  SAMPLES = SAMPLE_OLD ? ['@@dataurl(assets/sample-jellyfish.png)'] : ['@@dataurl(assets/sample-dual.png)'],
  // (the guide's name: "Sample jellyfish", both; "Sample dual jellyfish" read as a file name)
  SAMPLE_NAMES = ['jellyfish'],
  // (the picture's shape, for the welcome's frame before it has loaded)
  SAMPLE_AR = SAMPLE_OLD ? '568 / 1500' : '921 / 1200',
  // (minPx(17) = 5)
  SAMPLE_MIN_POS = 17,
  sampleIdx = 0,
  // (v300) the sample page coloured from its guide, codes on it: the start cards' picture of what the app makes
  SAMPLE_DONE = SAMPLE_OLD
    ? '@@dataurl(assets/sample-coloured.webp)'
    : '@@dataurl(assets/sample-dual-coloured.webp)',
  // (v306) the same, without its codes: the welcome's picture (src/assets/sample-plain.webp, the sample's guide as Save
  // image makes it with Codes unticked, 340 px wide); v320: Ben's coloured page, which has none
  SAMPLE_PLAIN = SAMPLE_OLD ? '@@dataurl(assets/sample-plain.webp)' : SAMPLE_DONE;
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
  return { line: c, plain: SAMPLE_PLAIN, ar: SAMPLE_AR };
}
// (v320) the sample's two pictures, for the empty Library's
function sampleSrc() {
  return { line: SAMPLES[0], done: SAMPLE_DONE };
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
// (v323) The sample opening: its work is one block of about a second on an iPad (1.6 s here in Safari's engine, 2.6 s
// on a slowed Chromium), and nothing on the screen moved meanwhile, the tap seeming not to have taken. A small card says
// "Opening the sample…" at once, its ring turned by the browser off the page's thread (so it keeps turning while the
// work holds the page), and the work starts once it has been drawn (afterPaint). It goes as the guide appears.
function smpOpenShow() {
  if (document.getElementById('smpOpen')) return;
  const el = document.createElement('div');
  el.id = 'smpOpen';
  el.className = 'smpopen';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="smpring" aria-hidden="true"></span><span>Opening the sample\u2026</span>';
  document.body.appendChild(el);
}
function smpOpenHide() {
  const el = document.getElementById('smpOpen');
  if (el) el.remove();
}
function _loadSample() {
  var si = sampleIdx % SAMPLES.length,
    nm = SAMPLE_NAMES[si];
  sampleIdx++;
  _smpLoad = true;
  note('Loading sample\u2026');
  smpOpenShow();
  const gen = ++loadGen;
  var img = new Image();
  img.onload = function () {
    if (gen !== loadGen) {
      smpOpenHide();
      return;
    }
    afterPaint(function () {
      try {
        smpOpen(img, gen, nm);
      } finally {
        smpOpenHide();
      }
    });
  };
  img.onerror = function () {
    _smpLoad = false;
    smpOpenHide();
    if (gen === loadGen) note('Couldn\u2019t open the sample. Try again.');
  };
  var _sv = SAMPLES[si];
  img.src = _sv.slice(0, 5) === 'data:' ? _sv : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(_sv);
}
function smpOpen(img, gen, nm) {
  try {
    if (!img.width || !img.height) {
      note('Couldn\u2019t load the sample. Try again.');
      return;
    }
    if (gen !== loadGen) return;
    resetForNewPicture();
    // (v318.13) the sample keeps Min section size as it was: a clean drawing at its own size, whose smallest real
    // sections are under 1 mm on a page that size (its 166 sections at the default)
    minAuto = false;
    // (v320: Ben's two jellyfish have pinholes where their lines meet, white gaps of 5 to 10 pixels at the sample's
    // size that he counts as sections: Min section size 5 px for it, so all 311 are in the guide)
    if (!SAMPLE_OLD) minPos = SAMPLE_MIN_POS;
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
// (v308) a PDF colouring page; v313: opened with PDF.js (21-pdf)
function isPdf(file) {
  return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}
function _loadImage(file) {
  _smpLoad = false;
  // (v313: a PDF opens with PDF.js, 21-pdf)
  if (isPdf(file)) {
    loadPdf(file, ++loadGen);
    return;
  }
  note('Reading photo\u2026');
  const gen = ++loadGen;
  // (v320: the wait's steps from the moment the photo is chosen)
  waitBegin(1);
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
        waitEnd();
        note('That image looked empty \u2014 try another file.');
        return;
      }
      // (v318.14) the photo decoded away from the page first (img.decode: another thread, where the browser can), so
      // fitSource's drawing doesn't hold the page while it decodes; a refusal (or none) goes on as before
      let dec = null;
      try {
        dec = img.decode ? img.decode() : null;
      } catch (e) {}
      Promise.all([lens, Promise.resolve(dec).catch(function () {})]).then(function (r) {
        const f35 = r[0];
        if (gen !== loadGen) return;
        note('Detecting sections\u2026');
        // (v318 polish: drawn before the work below holds the page, or "Reading photo…" stayed up throughout)
        afterPaint(function () {
          if (gen !== loadGen) return;
          holdTime(
            'New photo: open',
            function () {
              detect(f35);
            },
            img.naturalWidth ? img.naturalWidth + '×' + img.naturalHeight : '',
          );
        });
      });
    };
    const detect = function (f35) {
      let tok = 0;
      try {
        tok = resetForNewPicture();
        // (once the photo has opened: one that won't leaves the open guide's palette alone, v289)
        takeNextPal();
        srcImg = fitSource(img);
        srcUp = true;
        // (v318.34: kept with the guide once it's saved, 25-source-photo)
        srcFrom = 'pic';
        enterWork();
        var _rs = document.getElementById('sfResume');
        if (_rs) _rs.style.display = 'none';
        // (v318.15) the new photo on the picture at once, the controls out of sight until it's ready (after enterWork,
        // whose controls' bar is drawn afresh: 72-frame dockBar), then a paint before the page is found
        photoPreview(srcImg);
        segBusySet(true, true, true);
        waitBegin(1);
      } catch (err) {
        segBusySet(false);
        waitEnd();
        note(
          errNote('Couldn’t process that photo. Try it again, or another photo.', 'Processing a photo', err),
        );
        return;
      }
      // a photographed page is found and flattened first (or its corners offered for checking); a scan goes straight
      // on. (resetForNewPicture moved loadGen on: its token is this photo's; a newer one's segStop cleared the busy state)
      // (v318.36: the page found in the JOBS worker, the page free meanwhile; pgBegin clears the busy state once it
      // goes on, and a newer photo's segStop cleared it already)
      afterPaint(function () {
        if (tok !== loadGen) return;
        // (v324.1: the picture's record for the first save, encoded while the page and sections are found)
        try {
          srcPrewarm(srcImg, !(f35 > 0));
        } catch (_) {}
        const failed = function (err) {
          if (tok !== loadGen) return;
          segBusySet(false);
          _preview = false;
          waitEnd();
          note(
            errNote(
              'Couldn’t process that photo. Try it again, or another photo.',
              'Processing a photo',
              err,
            ),
          );
        };
        try {
          pgBegin(f35, function () {
            return tok !== loadGen;
          }).catch(failed);
        } catch (err) {
          failed(err);
        }
      });
    };
    img.onerror = function () {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      if (gen !== loadGen) return;
      waitEnd();
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
      if (gen !== loadGen) return;
      waitEnd();
      note('Couldn’t read that file.');
    };
    fr.readAsDataURL(file);
  }
}
// (the tests' geoSet, 99-close: the picture turned, tilted, cropped or straightened as a person would)
function geoSet0(o) {
  okGeom(function () {
    // (q: the page's corners in the photo as taken, straightened)
    if (o.q) {
      srcImg = pgOrig;
      pgApply(o.q, false);
      return;
    }
    if ('rot90' in o) rot90 = o.rot90;
    if ('tilt' in o) tilt = o.tilt;
    if ('crop' in o) cropRect = o.crop;
    reprocessImg();
  });
}
// (v320, D2a; G1-1) The wait after a photo is chosen. The page had sat at 30% for about 3 s with nothing on it: the tab
// switch's fade (.swap, events.js) froze on its first frame while the photo was read (Safari), and the steps said
// nothing. Now the fade is skipped, the photo shows at full strength with a slow light passing over it, and a short
// list says what's being done, each step ticked as it really ends: the page found (pgBegin, 22-straighten), the
// sections found (segPlace, 10-segment), after which the quick check asks "Looks right?" and Build chooses the
// markers. While the corner handles wait for the person the list steps aside (waitPause). Each step is said to a
// screen reader as it starts. No percentage: the app can't know how far along a step is.
let _wait = 0;
const WAIT_STEPS = ['Finding the page', 'Finding the sections'];
function waitEl() {
  let el = document.getElementById('sfWait');
  if (!el && workEl) {
    el = document.createElement('div');
    el.id = 'sfWait';
    el.className = 'sfwait';
    el.setAttribute('aria-hidden', 'true');
    const v = document.getElementById('sfView');
    if (v && v.parentNode === workEl) v.after(el);
    else workEl.appendChild(el);
  }
  return el;
}
function waitDraw() {
  const el = waitEl();
  if (!el) return;
  el.innerHTML =
    '<ol class="sfwaitl">' +
    WAIT_STEPS.map(function (s, i) {
      const n = i + 1,
        st = n < _wait ? 'done' : n === _wait ? 'now' : '';
      return (
        '<li class="' +
        st +
        '"><span class="sfwaitd" aria-hidden="true">' +
        (st === 'done' ? '\u2713' : '') +
        '</span>' +
        WAIT_STEPS[i] +
        (st === 'now' ? '\u2026' : '') +
        '</li>'
      );
    }).join('') +
    '</ol>';
}
// step: 1 the page, 2 the sections (a scan, a PDF or a picture that isn't a camera photo skips the page)
function waitAt(step) {
  if (!_wait && step !== 1) {
    if (!root.classList.contains('sfwaiting')) return;
  }
  if (step <= _wait) return;
  _wait = step;
  root.classList.add('sfwaiting');
  root.classList.remove('sfwaitpause');
  waitDraw();
  sayLive(WAIT_STEPS[step - 1] + '\u2026');
}
function waitBegin(step) {
  // (no fade into the Guide screen for a new picture: it froze the page at 30% while the photo was read)
  const w = document.querySelector('.wrap');
  if (w) w.classList.remove('swap');
  // (begun already for this photo, when it was chosen: not said again as it shows)
  if (_wait && root.classList.contains('sfwaiting')) return;
  _wait = 0;
  root.classList.add('sfwaiting');
  waitAt(step || 1);
  renderHead();
}
function waitPause(on) {
  if (!_wait) return;
  root.classList.toggle('sfwaitpause', !!on);
}
function waitEnd() {
  if (!_wait && !root.classList.contains('sfwaiting')) return;
  _wait = 0;
  root.classList.remove('sfwaiting', 'sfwaitpause');
  const el = document.getElementById('sfWait');
  if (el) el.innerHTML = '';
  renderHead();
}
// (v318.15) A new photo shown on the picture as soon as it's opened, while its page and sections are found: the
// previous guide's picture had stayed on screen, under "Detecting sections…". Until its sections are in place
// (segEnd) render() leaves the picture alone (_preview), as it would draw the previous guide's sections.
let _preview = false;
function photoPreview(img) {
  if (!cv || !ctx || !img) return;
  try {
    const w = img.naturalWidth || img.width,
      h = img.naturalHeight || img.height;
    _preview = true;
    sfmode = 'review';
    resetZoom();
    cv.width = w;
    cv.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, 0, 0);
    if (zoneEl) zoneEl.innerHTML = '';
    sizeCanvas();
    positionSun();
    positionPhoto();
  } catch (e) {
    _preview = false;
  }
}
