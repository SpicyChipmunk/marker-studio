/* ---- colour from a photo ----
    A reference photo is laid over the picture. You line it up (drag, pinch to size and turn), then each section
    takes the typical colour of the photo under its middle (away from the lines, so small misalignments and the
    black outlines don't leak in), matched to your markers. With "Markers in this guide" at N, it picks the N
    markers that together cover the photo best, not just the N closest one by one. */
let photoChecking = false,
  photoRef = null,
  photoXf = null,
  photoAlign = false,
  photoOp = 0.65,
  photoEl = null,
  photoFileEl = null,
  _phPts = null,
  _phCol = null,
  // (sections narrower than this, in pixels from their middle to a line, don't choose the Photo pattern's markers)
  PH_THIN = 2,
  _phLab = null,
  _phBumped = false;
// a reopened guide's photo still decoding ({url, xf, op, paper}): saved as it was until it decodes or is replaced
let _phPend = null;
// Photo chosen before its photo is picked (the picker open, or closed without one): the pattern it was, still laid
// and saved as the guide's until a photo comes (assignOne, the family's save), so a guide never keeps a Photo label
// over another pattern's colours (v284). One for each zone, by its id (pwKey)
let photoWait = {};
function pwKey() {
  return String(zoneBuilding != null ? zoneBuilding : zoneCur);
}
// PH_CAP: "close enough to some colour in the photo", by eye (CIEDE2000). 23 reaches as far as the plain L*a*b*
// distance of 40 it replaced: on a 451-marker collection the same share of photo-colour / marker pairs falls within it
const PH_MAX = 1000,
  PH_SAMPLES = 160,
  PH_CAP = 23;
// a working copy of the photo: at most 1000 px on its long side, kept as JPEG with the guide
function photoFromImage(img, url) {
  const w0 = img.naturalWidth || img.width,
    h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) return null;
  const s = Math.min(1, PH_MAX / Math.max(w0, h0)),
    w = Math.max(1, Math.round(w0 * s)),
    h = Math.max(1, Math.round(h0 * s)),
    c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  drawShrunk(g, img, w, h);
  let data;
  try {
    data = g.getImageData(0, 0, w, h).data;
  } catch (e) {
    return null;
  }
  const u = url || c.toDataURL('image/jpeg', 0.82);
  freeCanvas(c);
  return { w: w, h: h, data: data, url: u, flatSrc: !!img._pgFlat };
}
/* ---- the photo's lighting ----
    A phone photo of a page shows the white paper as a darker, often warm grey, and every colour on it is shifted the
    same way. When the photo looks like a page, or once it is lined up as a coloured version of this page (then the
    parts of the page left white say exactly where the paper is), one correction for the whole photo (colour.js:
    paperOf, lightFix) takes the paper back to white before any colour is read. Other photos are left as they are:
    a sunset's warm light is the picture. The corrected photo is what's shown over the picture and what the colours
    come from. The photo object keeps the original (raw, and url, which is what's saved) and the correction found
    (lit: {fix, from: 'page' | 'lined', on, white}); switching it on or off makes a new photo object, so Undo (which
    keeps the photo object with each step) brings the other one back. */
// a photo looks like a page when this share of it is within a small colour difference of its paper, and that paper
// is an even patch (the lighter part of its light, near-neutral pixels spans at most this many lightness steps).
// Measured: Ben's page photos 34-78% and 4-8; his landscapes and the standard test photos at most 23% or at least 10.
const PH_PAGE_NEAR = 0.28,
  PH_PAGE_SPREAD = 10;
// the correction for this paper, when it would brighten the photo visibly: paper that's already about white (a scan,
// a picture made on screen) is left as it is rather than darkened to paper white (colour.js: PAPER_LIN)
function photoFix(paper) {
  const f = lightFix(paper);
  return f && Math.max(f.gain[0], f.gain[1], f.gain[2]) >= 1.05 ? f : null;
}
// a grid of about 40 000 of the photo's original pixels (RGBA), and where each one came from
function _phSample(ref) {
  const st = Math.max(1, Math.round(Math.sqrt((ref.w * ref.h) / 40000))),
    n = Math.ceil(ref.w / st) * Math.ceil(ref.h / st),
    s = ref.raw || ref.data,
    d = new Uint8ClampedArray(n * 4),
    at = new Int32Array(n);
  let k = 0;
  for (let y = 0; y < ref.h; y += st)
    for (let x = 0; x < ref.w; x += st, k++) {
      const p = y * ref.w + x,
        j = p * 4;
      d[k * 4] = s[j];
      d[k * 4 + 1] = s[j + 1];
      d[k * 4 + 2] = s[j + 2];
      d[k * 4 + 3] = s[j + 3];
      at[k] = p;
    }
  return { d: d, at: at, n: k };
}
// does the whole photo look like a page? Its paper (linear RGB), how much of it is near that paper, how even it is
function photoPageCheck(ref) {
  const S = _phSample(ref),
    paper = paperOf(S.d);
  if (!paper) return { paper: null, near: 0, spread: 99, page: false };
  const P = rgbLab8(linToSrgb(paper[0]), linToSrgb(paper[1]), linToSrgb(paper[2])),
    d = S.d,
    ls = [];
  let near = 0;
  for (let i = 0; i < d.length; i += 4) {
    const c = rgbLab(d[i], d[i + 1], d[i + 2]);
    if (_dE(c, P) <= 6) near++;
    if (c[0] > 30 && Math.hypot(c[1], c[2]) < 14) ls.push(c[0]);
  }
  ls.sort(function (a, b) {
    return a - b;
  });
  const top = ls.slice(Math.floor(ls.length * 0.4)),
    spread = top.length ? top[Math.floor(top.length * 0.9)] - top[Math.floor(top.length * 0.1)] : 99;
  near /= S.n;
  return { paper: paper, near: near, spread: spread, page: near >= PH_PAGE_NEAR && spread <= PH_PAGE_SPREAD };
}
// the photo, with correction `lit` ({fix, from, on}; null for none) applied or not, as a new photo object
function photoLitSet(ref, lit) {
  const raw = ref.raw || ref.data,
    r = {
      w: ref.w,
      h: ref.h,
      data: raw,
      raw: raw,
      url: ref.url,
      flatSrc: ref.flatSrc,
      flat: ref.flat,
      lit: null,
    };
  if (lit && lit.fix) {
    // the paper after the correction: what "white" means in this photo
    const p = lit.fix.gain.map(function (g) {
        return linToSrgb(PAPER_LIN / g);
      }),
      q = lightApply(lit.fix, p[0], p[1], p[2]);
    r.lit = { fix: lit.fix, from: lit.from, on: !!lit.on, white: rgbLab8(q[0], q[1], q[2]) };
    if (r.lit.on) r.data = lightApplyData(lit.fix, new Uint8ClampedArray(raw));
  }
  return r;
}
// a newly chosen photo: corrected when it looks like a page (on: false finds the correction but leaves it off)
function photoLitNew(ref, on) {
  const c = photoPageCheck(ref),
    fix = c.page ? photoFix(c.paper) : null;
  return photoLitSet(ref, fix ? { fix: fix, from: 'page', on: on !== false } : null);
}
// once lined up as a coloured version of this page: the paper is where the page is left white (the page around the
// drawing, and sections whose photo colour reads as white), away from the lines
function photoLitLined() {
  if (!photoRef || !photoXf || !labels) return;
  if (!labelPts || !_ldq || _ldq._lp !== labelPts) buildLabelPts();
  _phCol = null;
  const C = photoColours(),
    K = comps.length,
    ok = new Uint8Array(K);
  for (let l = 1; l < K; l++)
    if (
      comps[l] &&
      (comps[l].bg || (C.has[l] && photoIsWhite([C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]])))
    )
      ok[l] = 1;
  const S = _phSample(photoRef),
    X = photoXf,
    cs = Math.cos(X.r),
    sn = Math.sin(X.r),
    pw = photoRef.w,
    ph = photoRef.h,
    m = new Uint8Array(S.n);
  for (let k = 0; k < S.n; k++) {
    const u = ((S.at[k] % pw) + 0.5 - pw / 2) * X.sx,
      v = (((S.at[k] / pw) | 0) + 0.5 - ph / 2) * X.sy,
      x = Math.floor(X.cx + u * cs - v * sn),
      y = Math.floor(X.cy + u * sn + v * cs);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x,
      l = labels[i];
    if (l > 0 && l < K && ok[l] && _ldq[i] >= 32 * srcK) m[k] = 1;
  }
  const paper = paperOf(S.d, function (p) {
    return m[p] === 1;
  });
  // (too little paper showing to tell: the correction stays as it was)
  if (!paper) return;
  const fix = photoFix(paper);
  // the page's own paper is white already: no correction, even if the whole photo looked darker
  if (!fix) photoRef = photoLitSet(photoRef, null);
  else
    photoRef = photoLitSet(photoRef, { fix: fix, from: 'lined', on: photoRef.lit ? photoRef.lit.on : true });
  _phCol = null;
}
// the correction switched on or off (a new photo object, so Undo brings the other back)
function photoLitToggle(on) {
  if (!photoRef || !photoRef.lit || photoRef.lit.on === !!on) return;
  photoRef = photoLitSet(photoRef, Object.assign({}, photoRef.lit, { on: !!on }));
  _phCol = null;
  photoRecolour();
  positionPhoto();
}
// saved with the guide: the correction found (so a reopened guide reads the same colours), or false for none
function photoLitSave(ref) {
  if (!ref || !ref.lit) return false;
  return {
    on: ref.lit.on,
    from: ref.lit.from,
    gain: ref.lit.fix.gain.map(function (g) {
      return Math.round(g * 1e4) / 1e4;
    }),
  };
}
// a reopened guide's photo: its saved correction; a guide saved before there was one (undefined) is offered the
// correction switched off, so its colours stay as they were saved
function photoLitOpen(ref, s) {
  if (s === false) return photoLitSet(ref, null);
  if (s && typeof s === 'object' && Array.isArray(s.gain) && s.gain.length === 3) {
    const g = s.gain.map(Number);
    if (
      g.every(function (v) {
        return isFinite(v) && v > 0.1 && v < 20;
      })
    )
      return photoLitSet(ref, {
        fix: { gain: g },
        from: s.from === 'lined' ? 'lined' : 'page',
        on: s.on !== false,
      });
  }
  return photoLitNew(ref, false);
}
// what's shown of the photo (over the picture and as its thumbnail): the corrected photo when corrected
function photoViewUrl(ref) {
  if (!ref || ref.data === ref.raw || !ref.raw) return ref ? ref.url : '';
  if (!ref.view) {
    const c = document.createElement('canvas');
    c.width = ref.w;
    c.height = ref.h;
    try {
      const g = c.getContext('2d'),
        im = g.createImageData(ref.w, ref.h);
      im.data.set(ref.data);
      g.putImageData(im, 0, 0);
      ref.view = c.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      ref.view = ref.url;
    }
    freeCanvas(c);
  }
  return ref.view;
}
function photoReset() {
  _phGeo = null;
  _phRefit = false;
  _phPD = null;
  photoWait = {};
  photoRef = null;
  photoXf = null;
  _phPend = null;
  photoAlign = false;
  photoPeek = false;
  photoRoughOnly = false;
  photoPaper = true;
  photoGreys = false;
  _phNone = {};
  _phPick++;
  _phAlFail = false;
  _phErr = null;
  _phStats = null;
  _phCol = null;
  _phBumped = false;
  if (photoEl) photoEl.style.display = 'none';
}
/* ---- the photo through a change to the picture (v304) ----
    The photo's placement is in the guide's pixels. Turning, tilting, cropping (by hand or Auto) and, since v303, the
    enlarging that follows a crop change what a guide pixel is, so the placement is carried through the change: the
    picture as it came (srcImg) is the fixed frame both guides are drawn from. Straightening makes a new srcImg (not a
    turn and a size), so then the photo is placed again: lined up by itself if it can be, else Fill and lining up on. */
let _phGeo = null,
  _phRefit = false;
// how the guide's pixels come from srcImg now (as buildRotatedFull and processSrc make them), or null
function photoGeoNow() {
  if (!srcImg || !W || !H) return null;
  const rad = ((rot90 + tilt) * Math.PI) / 180,
    sw = srcImg.width,
    sh = srcImg.height,
    c = Math.abs(Math.cos(rad)),
    s = Math.abs(Math.sin(rad)),
    bw = sw * c + sh * s,
    bh = sw * s + sh * c,
    sc = Math.min(1, MAXSIDE / Math.max(bw, bh)),
    fw = Math.round(bw * sc),
    fh = Math.round(bh * sc),
    cr = cropRect || { x: 0, y: 0, w: 1, h: 1 },
    ox = Math.round(cr.x * fw),
    oy = Math.round(cr.y * fh),
    cw = Math.max(8, Math.min(Math.round(cr.w * fw), fw - ox)),
    ch = Math.max(8, Math.min(Math.round(cr.h * fh), fh - oy));
  return {
    src: srcImg,
    rad: rad,
    sw: sw,
    sh: sh,
    sc: sc,
    fw: fw,
    fh: fh,
    ox: ox,
    oy: oy,
    kx: W / cw,
    ky: H / ch,
  };
}
// a guide point under geometry g to srcImg, and back
function _phToSrc(g, x, y) {
  const dx = (x / g.kx + g.ox - g.fw / 2) / g.sc,
    dy = (y / g.ky + g.oy - g.fh / 2) / g.sc,
    cs = Math.cos(g.rad),
    sn = Math.sin(g.rad);
  return [cs * dx + sn * dy + g.sw / 2, -sn * dx + cs * dy + g.sh / 2];
}
function _phFromSrc(g, x, y) {
  const a = x - g.sw / 2,
    b = y - g.sh / 2,
    cs = Math.cos(g.rad),
    sn = Math.sin(g.rad);
  return [
    ((cs * a - sn * b) * g.sc + g.fw / 2 - g.ox) * g.kx,
    ((sn * a + cs * b) * g.sc + g.fh / 2 - g.oy) * g.ky,
  ];
}
// carry the placement from geometry g0 to g1; false when it can't be (no placement, or another srcImg)
function photoGeoMove(g0, g1) {
  if (!photoXf || !g0 || !g1 || g0.src !== g1.src) return false;
  const p = _phToSrc(g0, photoXf.cx, photoXf.cy),
    q = _phFromSrc(g1, p[0], p[1]),
    k = (g1.sc * Math.sqrt(g1.kx * g1.ky)) / (g0.sc * Math.sqrt(g0.kx * g0.ky));
  photoXf = { cx: q[0], cy: q[1], sx: photoXf.sx * k, sy: photoXf.sy * k, r: photoXf.r + g1.rad - g0.rad };
  _phCol = null;
  return true;
}
// the picture was made again (processSrc): carry the photo, or place it again once the guide is laid (assignOne)
function photoGeoAfter() {
  const g1 = photoGeoNow();
  if (photoRef && photoXf && !photoGeoMove(_phGeo, g1)) _phRefit = true;
  _phGeo = g1;
}
// placed again from scratch: lined up by itself when the photo matches the picture, else Fill with lining up on
function photoGeoRefit() {
  _phRefit = false;
  if (!photoRef || !labels) return;
  photoFit('fill');
  let xf = null;
  try {
    const fa = photoAlignRaw(photoFlatAlign);
    if (fa) xf = fa.xf;
    else {
      const r = photoAlignRaw(photoAutoAlign);
      if (r && r.score >= PH_ALIGN_MIN && r.peak >= PH_ALIGN_PEAK && r.lineShare >= 0.03) xf = r.xf;
    }
  } catch (_) {}
  if (xf) photoXf = xf;
  else photoAlign = true;
  // (the no-colour line then says to line it up first, v304)
  _phAlFail = !xf;
  _phCol = null;
}
// bounding box of the sections in the guide (the artwork, not the paper around it)
function artBox() {
  const B = secBoxes();
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  const ls = countedList();
  ls.forEach(function (k) {
    const l = +k;
    if (!(l < B.K) || B.x1[l] < 0) return;
    if (B.x0[l] < x0) x0 = B.x0[l];
    if (B.y0[l] < y0) y0 = B.y0[l];
    if (B.x1[l] > x1) x1 = B.x1[l];
    if (B.y1[l] > y1) y1 = B.y1[l];
  });
  if (x1 < 0) return { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}
// place the photo over the artwork: fill (cover, no gaps), fit (whole photo visible) or stretch (exactly the box)
function photoFit(mode) {
  if (!photoRef) return;
  const b = artBox(),
    bw = b.x1 - b.x0 + 1,
    bh = b.y1 - b.y0 + 1,
    pw = photoRef.w,
    ph = photoRef.h;
  let sx, sy;
  if (mode === 'stretch') {
    sx = bw / pw;
    sy = bh / ph;
  } else {
    const s = mode === 'fit' ? Math.min(bw / pw, bh / ph) : Math.max(bw / pw, bh / ph);
    sx = sy = s;
  }
  photoXf = { cx: (b.x0 + b.x1 + 1) / 2, cy: (b.y0 + b.y1 + 1) / 2, sx: sx, sy: sy, r: 0 };
  _phCol = null;
}
// the size at which the photo fills the drawing (photoFit's Fill)
function photoFillScale() {
  const b = artBox();
  return Math.max((b.x1 - b.x0 + 1) / photoRef.w, (b.y1 - b.y0 + 1) / photoRef.h);
}
function photoXfOK(x) {
  return !!(
    x &&
    [x.cx, x.cy, x.sx, x.sy, x.r].every(function (v) {
      return typeof v === 'number' && isFinite(v);
    }) &&
    x.sx > 0 &&
    x.sy > 0
  );
}
// photo pixel under guide point (x,y); outside the photo, the nearest edge pixel
function photoAt(x, y, out) {
  const X = photoXf,
    cs = Math.cos(X.r),
    sn = Math.sin(X.r),
    dx = x - X.cx,
    dy = y - X.cy,
    u = dx * cs + dy * sn,
    v = -dx * sn + dy * cs;
  let px = Math.floor(u / X.sx + photoRef.w / 2),
    py = Math.floor(v / X.sy + photoRef.h / 2);
  px = px < 0 ? 0 : px >= photoRef.w ? photoRef.w - 1 : px;
  py = py < 0 ? 0 : py >= photoRef.h ? photoRef.h - 1 : py;
  const j = (py * photoRef.w + px) * 4,
    d = photoRef.data;
  out[0] = d[j];
  out[1] = d[j + 1];
  out[2] = d[j + 2];
  return out;
}
// is picture point (x, y) on the photo? (photoAt gives the nearest edge pixel for a point past it)
function photoIn(x, y) {
  const X = photoXf,
    dx = x - X.cx,
    dy = y - X.cy,
    u = (dx * Math.cos(X.r) + dy * Math.sin(X.r)) / X.sx + photoRef.w / 2,
    v = (-dx * Math.sin(X.r) + dy * Math.cos(X.r)) / X.sy + photoRef.h / 2;
  return u >= 0 && v >= 0 && u < photoRef.w && v < photoRef.h;
}
// does the photo cover section l? (most of it on the photo: the light can come from the photo there)
function photoCovers(l) {
  if (!photoRef || !photoXf) return false;
  const C = photoColours();
  return !!C.inn && C.inn[l] >= 0.5;
}
// RGB -> Lab through a 64-level-per-channel table (worked out once; error well under a marker step)
function rgbLab(r, g, b) {
  if (!_phLab) {
    _phLab = new Float32Array(64 * 64 * 64 * 3);
    const f = function (v) {
        v /= 255;
        return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
      },
      t = function (v) {
        return v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
      },
      lin = new Float32Array(64);
    for (let i = 0; i < 64; i++) lin[i] = f(i * 4 + 2);
    for (let R = 0; R < 64; R++)
      for (let G = 0; G < 64; G++)
        for (let Bb = 0; Bb < 64; Bb++) {
          const rr = lin[R],
            gg = lin[G],
            bb = lin[Bb],
            x = t((rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047),
            y = t(rr * 0.2126 + gg * 0.7152 + bb * 0.0722),
            z = t((rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883),
            j = ((R * 64 + G) * 64 + Bb) * 3;
          _phLab[j] = 116 * y - 16;
          _phLab[j + 1] = 500 * (x - y);
          _phLab[j + 2] = 200 * (y - z);
        }
  }
  const j = (((r >> 2) * 64 + (g >> 2)) * 64 + (b >> 2)) * 3;
  return [_phLab[j], _phLab[j + 1], _phLab[j + 2]];
}
// up to PH_SAMPLES points per section, kept away from its edges (worked out once per set of sections)
function photoPoints() {
  if (!labelPts || !_ldq || _ldq._lp !== labelPts) buildLabelPts();
  if (_phPts && _phPts.lp === labelPts) return _phPts;
  const K = comps.length,
    n = W * H,
    Q = _ldq,
    thr = new Float32Array(K),
    cnt = new Int32Array(K);
  for (let l = 1; l < K; l++) {
    const p = labelPts[l];
    // (3 pixels of the picture as it came: an enlarged one's are srcK times as many, v303)
    thr[l] = p ? Math.min(3 * srcK, p.r * 0.5) * 8 : 0;
  }
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0 && l < K && Q[i] >= thr[l]) cnt[l]++;
  }
  const st = new Int32Array(K),
    start = new Int32Array(K + 1),
    seen = new Int32Array(K);
  let tot = 0;
  for (let l = 1; l < K; l++) {
    st[l] = Math.max(1, Math.ceil(cnt[l] / PH_SAMPLES));
    start[l] = tot;
    tot += Math.ceil(cnt[l] / st[l]);
  }
  start[K] = tot;
  const pts = new Int32Array(tot),
    fill = new Int32Array(K);
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l < 1 || l >= K || Q[i] < thr[l]) continue;
    const k = seen[l]++;
    if (k % st[l] === 0 && fill[l] < start[l + 1] - start[l]) pts[start[l] + fill[l]++] = i;
  }
  _phPts = { lp: labelPts, start: start, fill: fill, pts: pts };
  return _phPts;
}
// each section's typical photo colour (Lab): the most common colour under it, not the average,
// so a mostly-blue section with a white highlight stays blue. Also how much of the section agrees (0..1).
function photoColours() {
  const key = [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r].join('|');
  const P = photoPoints();
  if (_phCol && _phCol.key === key && _phCol.lp === P.lp && _phCol.ref === photoRef) return _phCol;
  const K = comps.length,
    lab = new Float32Array(K * 3),
    agree = new Float32Array(K),
    has = new Uint8Array(K),
    inn = new Float32Array(K),
    rgb = [0, 0, 0],
    W2 = W;
  for (let l = 1; l < K; l++) {
    const s = P.start[l],
      m = P.fill[l];
    if (!m) continue;
    const Ls = new Float32Array(m * 3),
      bins = new Map();
    let bk = -1,
      bn = 0;
    let ni = 0;
    for (let k = 0; k < m; k++) {
      const p = P.pts[s + k],
        px = (p % W2) + 0.5,
        py = ((p / W2) | 0) + 0.5;
      if (photoIn(px, py)) ni++;
      photoAt(px, py, rgb);
      const c = rgbLab(rgb[0], rgb[1], rgb[2]);
      Ls[k * 3] = c[0];
      Ls[k * 3 + 1] = c[1];
      Ls[k * 3 + 2] = c[2];
      const key2 = ((c[0] / 7) | 0) * 10000 + (((c[1] + 128) / 9) | 0) * 100 + (((c[2] + 128) / 9) | 0),
        v = (bins.get(key2) || 0) + 1;
      bins.set(key2, v);
      if (v > bn) {
        bn = v;
        bk = k;
      }
    }
    // refine: average the samples close to the most common colour
    const c0 = [Ls[bk * 3], Ls[bk * 3 + 1], Ls[bk * 3 + 2]];
    let sL = 0,
      sa = 0,
      sb = 0,
      sw = 0;
    for (let k = 0; k < m; k++) {
      const dl = Ls[k * 3] - c0[0],
        da = Ls[k * 3 + 1] - c0[1],
        db = Ls[k * 3 + 2] - c0[2];
      if (dl * dl + da * da + db * db <= 144) {
        sL += Ls[k * 3];
        sa += Ls[k * 3 + 1];
        sb += Ls[k * 3 + 2];
        sw++;
      }
    }
    lab[l * 3] = sL / sw;
    lab[l * 3 + 1] = sa / sw;
    lab[l * 3 + 2] = sb / sw;
    agree[l] = sw / m;
    has[l] = 1;
    inn[l] = ni / m;
  }
  _phCol = { key: key, lp: P.lp, ref: photoRef, lab: lab, agree: agree, has: has, inn: inn };
  return _phCol;
}
// choose up to N markers from the pool that together cover the targets best, then give each target its closest chosen
// marker. First greedily (each step adds the marker that reduces the total colour difference most), then, unless
// `quick` (while the marker slider is being dragged), by swaps: a chosen marker is replaced by any other in the pool
// while that brings the total down. On a photo of a page coloured with known markers the swaps found 22 of 24 where
// the greedy choice found 17. targets: [{l, lab:[L,a,b], w}]. Distances are capped so one odd section can't pull in
// a marker by itself.
function photoPick(targets0, pool0, N, quick) {
  if (!targets0.length || !pool0.length) return { chosen: [], pick: [] };
  const PD = _photoPrepDist(targets0, pool0),
    pr = PD.pr;
  if (!pr.pool.length) {
    // (no marker is near any of the colours: the closest ones, but still no more than N of them — the ones the most
    // of the picture would take — each colour then taking the closest of those, v298)
    let nn = targets0.map(function (t) {
      return nearestInPool(t.lab, pool0);
    });
    const wt = new Map();
    nn.forEach(function (m, i) {
      if (m) wt.set(m, (wt.get(m) || 0) + (targets0[i].w || 0));
    });
    if (N > 0 && wt.size > N) {
      const keep = [...wt.keys()]
        .sort(function (a, b) {
          return wt.get(b) - wt.get(a);
        })
        .slice(0, N);
      nn = targets0.map(function (t) {
        return nearestInPool(t.lab, keep);
      });
    }
    return { chosen: [...new Set(nn)], pick: nn };
  }
  const targets = pr.targets,
    pool = pr.pool,
    D = PD.D,
    cm = _photoChoose(targets, D, pool.length, N, quick).map(function (j) {
      return pool[j];
    }),
    pick = new Array(targets0.length);
  // (each colour then takes the chosen marker closest by eye)
  for (let i = 0; i < targets0.length; i++) pick[i] = nearestInPool(targets[pr.back[i]].lab, cm);
  return { chosen: cm, pick: pick };
}
// the merged targets, the pool near them and their distances, for these targets and pool: worked out once per laying,
// shared by the marker choice and the suggested count (buildPhoto hands both the same arrays, v304)
let _phPD = null;
function _photoPrepDist(targets0, pool0) {
  if (_phPD && _phPD.t === targets0 && _phPD.p === pool0) return _phPD;
  const pr = _photoPrep(targets0, pool0);
  _phPD = { t: targets0, p: pool0, pr: pr, D: pr.pool.length ? _photoDist(pr.targets, pr.pool) : null };
  return _phPD;
}
// sections with (nearly) the same colour are merged (their weights added), and markers far from every colour are
// dropped, before the search. back: each original target's merged one.
function _photoPrep(targets0, pool0) {
  const gm = new Map(),
    targets = [],
    back = new Int32Array(targets0.length);
  for (let i = 0; i < targets0.length; i++) {
    const a = targets0[i].lab,
      k = Math.round(a[0] / 1.5) + '|' + Math.round(a[1] / 1.5) + '|' + Math.round(a[2] / 1.5);
    let j = gm.get(k);
    if (j == null) {
      j = targets.length;
      gm.set(k, j);
      targets.push({ lab: a, w: 0 });
    }
    targets[j].w += targets0[i].w;
    back[i] = j;
  }
  const pool = pool0.filter(function (m) {
    if (!m.lab) return false;
    for (let i = 0; i < targets.length; i++) if (de2000(targets[i].lab, m.lab) < PH_CAP) return true;
    return false;
  });
  return { targets: targets, pool: pool, back: back };
}
// how far each target is from each marker (target by marker), by eye, capped at PH_CAP
function _photoDist(targets, pool) {
  const T = targets.length,
    P = pool.length,
    D = new Float32Array(T * P);
  for (let i = 0; i < T; i++) {
    const a = targets[i].lab;
    for (let j = 0; j < P; j++) D[i * P + j] = Math.min(PH_CAP, de2000(a, pool[j].lab));
  }
  return D;
}
// the chosen markers (indices into the pool): greedily, then by swaps unless `quick`
function _photoChoose(targets, D, P, N, quick) {
  const T = targets.length;
  N = Math.max(1, Math.min(N, P));
  const cur = new Float32Array(T).fill(PH_CAP * 1.5),
    used = new Uint8Array(P),
    chosen = [];
  for (let it = 0; it < N; it++) {
    const bj = _photoBest(targets, D, P, cur, used);
    if (bj < 0) break;
    used[bj] = 1;
    chosen.push(bj);
    for (let i = 0; i < T; i++) {
      const d = D[i * P + bj];
      if (d < cur[i]) cur[i] = d;
    }
  }
  if (!quick) _photoSwap(targets, D, P, chosen, used);
  return chosen;
}
// the unused marker that brings the targets' total difference down most from `cur` (-1 when none helps)
function _photoBest(targets, D, P, cur, used) {
  const T = targets.length;
  let bj = -1,
    bg = 0;
  for (let j = 0; j < P; j++) {
    if (used[j]) continue;
    let g = 0;
    for (let i = 0; i < T; i++) {
      const d = D[i * P + j];
      if (d < cur[i]) g += targets[i].w * (cur[i] - d);
    }
    if (g > bg) {
      bg = g;
      bj = j;
    }
  }
  return bj;
}
// improve a greedy choice by swaps: for each chosen marker in turn, the marker in the pool that would lower the total
// most in its place (if any does) takes it; rounds repeat until one changes nothing (at most PH_SWAP_ROUNDS).
// D: capped distances, target by pool marker; chosen, used: the choice, changed in place.
const PH_SWAP_ROUNDS = 8;
function _photoSwap(targets, D, P, chosen, used) {
  const T = targets.length,
    N = chosen.length,
    far = PH_CAP * 1.5,
    rest = new Float32Array(T);
  for (let round = 0; round < PH_SWAP_ROUNDS; round++) {
    let changed = false;
    for (let a = 0; a < N; a++) {
      // each target's best among the other chosen markers
      rest.fill(far);
      for (let k = 0; k < N; k++) {
        if (k === a) continue;
        const j = chosen[k];
        for (let i = 0; i < T; i++) if (D[i * P + j] < rest[i]) rest[i] = D[i * P + j];
      }
      let now = 0;
      for (let i = 0; i < T; i++) now += targets[i].w * Math.min(D[i * P + chosen[a]], rest[i]);
      let bj = -1,
        bc = now - 1e-6;
      for (let j = 0; j < P; j++) {
        if (used[j]) continue;
        let c = 0;
        for (let i = 0; i < T && c < bc; i++) {
          const d = D[i * P + j];
          c += targets[i].w * (d < rest[i] ? d : rest[i]);
        }
        if (c < bc) {
          bc = c;
          bj = j;
        }
      }
      if (bj >= 0) {
        used[chosen[a]] = 0;
        used[bj] = 1;
        chosen[a] = bj;
        changed = true;
      }
    }
    if (!changed) break;
  }
}
/* A suggested marker count: the fewest markers that look as good as all of them on nearly the whole picture, that is
   within PH_SUG_DE (by eye; about the smallest difference you can see) of each colour's best in the pool, on
   PH_SUG_SHARE of the picture (by weight). Measured on photos of Ben's drawing coloured with 12, 24 and 40 known
   markers it suggests 12, 22 and 32 (the markers it leaves out are within a just-noticeable step of others); on his
   five photos 7-36. None when more markers keep helping up to PH_SUG_MAX (a photo of a real coloured page: each
   section's colour differs a little from its marker's swatch). Worked out after the guide is drawn, a step at a time,
   and kept for the same photo placement, white areas and markers. */
const PH_SUG_DE = 2,
  PH_SUG_SHARE = 0.95,
  PH_SUG_MAX = 64;
let _phSug = null; // { key, n (0: none; null: still working), timer }
// the steps: a greedy run to PH_SUG_MAX gives an upper bound, then the full choice is tried at one fewer at a time
function _photoSugSteps(targets0, pool0) {
  const PD = _photoPrepDist(targets0, pool0),
    pr = PD.pr,
    targets = pr.targets,
    P = pr.pool.length,
    T = targets.length;
  if (!T || P < 2) return null;
  const D = PD.D,
    best = new Float32Array(T),
    W = targets.reduce(function (a, t) {
      return a + t.w;
    }, 0);
  for (let i = 0; i < T; i++) {
    let b = Infinity;
    for (let j = 0; j < P; j++) if (D[i * P + j] < b) b = D[i * P + j];
    best[i] = b;
  }
  // does this choice (pool indices) look as good as all of them?
  const good = function (cur) {
    let w = 0;
    for (let i = 0; i < T; i++) if (cur[i] <= best[i] + PH_SUG_DE) w += targets[i].w;
    return w >= PH_SUG_SHARE * W;
  };
  const curOf = function (chosen) {
    const cur = new Float32Array(T).fill(PH_CAP * 1.5);
    chosen.forEach(function (j) {
      for (let i = 0; i < T; i++) if (D[i * P + j] < cur[i]) cur[i] = D[i * P + j];
    });
    return cur;
  };
  let n = 0;
  const steps = [
    function () {
      const cur = new Float32Array(T).fill(PH_CAP * 1.5),
        used = new Uint8Array(P),
        max = Math.min(PH_SUG_MAX, P);
      for (let k = 1; k <= max; k++) {
        const bj = _photoBest(targets, D, P, cur, used);
        if (bj < 0) break;
        used[bj] = 1;
        for (let i = 0; i < T; i++) if (D[i * P + bj] < cur[i]) cur[i] = D[i * P + bj];
        if (good(cur)) {
          n = k;
          return true;
        }
      }
      return false; // more markers keep helping: no suggestion
    },
  ];
  // one fewer at a time, with the full choice (greedy + swaps), while it still looks as good
  for (let k = 0; k < 8; k++)
    steps.push(function () {
      if (n <= 1 || !good(curOf(_photoChoose(targets, D, P, n - 1, false)))) return false;
      n--;
      return true;
    });
  return {
    steps: steps,
    result: function () {
      return n;
    },
  };
}
// the suggestion straight away (for the tests): the count, or 0 for none
function photoSuggest(targets0, pool0) {
  const s = _photoSugSteps(targets0, pool0);
  if (!s) return 0;
  for (let k = 0; k < s.steps.length; k++) if (!s.steps[k]()) break;
  return s.result();
}
// after a rebuild: work out the suggestion for these colours and markers, unless it is already known or on its way
function photoSugPlan(targets0, pool0) {
  const key = [
    photoPaper ? 1 : 0,
    pool0
      .map(function (m) {
        return m.mkey;
      })
      .join(','),
  ].join('|');
  if (_phSug && _phSug.col === _phCol && _phSug.key === key) return;
  if (_phSug && _phSug.timer) clearTimeout(_phSug.timer);
  const job = { col: _phCol, key: key, n: null, timer: 0 },
    s = _photoSugSteps(targets0, pool0);
  _phSug = job;
  if (!s) {
    job.n = 0;
    return;
  }
  let k = 0;
  const next = function () {
    job.timer = 0;
    if (_phSug !== job) return;
    if (k < s.steps.length && s.steps[k++]()) {
      job.timer = setTimeout(next, 0);
      return;
    }
    job.n = s.result();
    photoSugShow();
  };
  job.timer = setTimeout(next, 0);
}
// the suggestion line, when there is one and it differs from what the guide uses by 2 or more
function photoSugHTML() {
  const n = _phSug && _phSug.col === _phCol ? _phSug.n : 0;
  // (lastPoolN is 0 after an Undo, which lays nothing: the markers the guide is set to use then, v304)
  if (!n || Math.abs(n - (lastPoolN || limitN)) < 2) return '';
  return (
    '<span>About <b>' +
    n +
    ' markers</b> get as close as all your markers can.</span> <button type="button" class="sflink" id="sfPhUse">Use ' +
    n +
    '</button>'
  );
}
// put the finished suggestion into the Pattern tab, if it's showing
function photoSugShow() {
  const el = document.getElementById('sfPhSug');
  if (!el) return;
  el.innerHTML = photoSugHTML();
  const b = document.getElementById('sfPhUse');
  if (b) b.addEventListener('click', photoSugUse);
}
function photoSugUse() {
  if (!_phSug || !_phSug.n) return;
  limitN = _phSug.n;
  photoRecolour();
}
// the markers photo mode chooses from: the whole filtered collection (or the saved / generated palette), not thinned
function photoPool() {
  if (paletteSource === 'saved' || paletteSource === 'generate') {
    let seed;
    if (paletteSource === 'saved') seed = palettePoolFromSaved();
    else {
      if (!genPal.length) generatePalette();
      seed = resolveKeys(genPal);
    }
    if (seed.length) return expand && limitN > seed.length ? expandToN(seed, limitN, expandChar) : seed;
  }
  return poolFor('all');
}
/* ---- a photo with no colour (v304) ----
    A photo of the page before it was coloured (or a blank one) has nothing for the markers to match: with white areas
    left white, its paper and the shadows on it took near-white greys, and lines read as Black. So when no section
    reads as a colour (chroma PH_NONE_C or more from the photo's own paper; measured: an uncoloured page at most 3,
    pale pastels 13 or more), every section is left white and the Pattern panel says so. Grey shading can be coloured
    anyway (photoGreys: Use grey markers for the grey parts, saved with the photo). Most of the sections past the
    photo's edge: it isn't over the drawing, which is said instead. One record per zone (pwKey), for the panel. */
const PH_NONE_C = 6,
  PH_NONE_IN = 0.5,
  PH_NONE_GREY = 0.05;
let photoGreys = false,
  _phNone = {},
  _phAlFail = false;
// null: colour to lay; {off: true}: the photo is mostly off these sections; {grey}: no colour (grey: the share of
// their area that reads as grey, not paper and not line)
function photoNoColour(t) {
  const C = _phCol,
    ref = photoRef,
    wh = ref.lit && ref.lit.white ? ref.lit.white : [100, 0, 0];
  let A = 0,
    inn = 0,
    grey = 0,
    col = false;
  for (let i = 0; i < t.length; i++) {
    const l = t[i].l,
      lab = t[i].lab,
      a = (comps[l] && comps[l].area) || 1,
      ch = Math.hypot(lab[1] - wh[1], lab[2] - wh[2]);
    A += a;
    inn += (C.inn ? C.inn[l] : 1) * a;
    if (photoIsWhite(lab) || (lab[0] >= wh[0] - PH_WHITE_L && ch <= PH_WHITE_C)) continue;
    if (ch >= PH_NONE_C) col = true;
    else if (lab[0] >= 35) grey += a;
  }
  if (!A) return null;
  if (inn / A < PH_NONE_IN) return { off: true };
  if (col || !photoPaper || photoGreys) return null;
  return { grey: grey / A };
}
// the Pattern panel's line for it
function photoNoneHTML() {
  const nc = _phNone[pwKey()];
  if (!nc) return '';
  if (nc.off)
    return '<div class="sfphstat">The photo isn’t over the picture. Drag it onto the drawing, or tap Line up photo.</div>';
  return (
    '<div class="sfphstat">' +
    (zones.length ? 'No colour in the photo over this zone' : 'No colour in this photo') +
    ', so every section is left white. Choose a photo of the page once it’s coloured in.' +
    (_phAlFail ? ' If it’s a coloured page, line it up first.' : '') +
    (nc.grey >= PH_NONE_GREY
      ? ' <button type="button" class="sflink" id="sfPhGreys">Use grey markers for the grey parts</button>'
      : '') +
    '</div>'
  );
}
// quick: the quick marker choice (while the marker slider is dragged, and right after the photo is moved; the full one
// follows once it's let go: photoRecolour)
function buildPhoto(cl, quick) {
  // (what's said about a photo with no colour is about this laying, v304)
  const zk = pwKey(),
    was = _phNone[zk];
  delete _phNone[zk];
  const pool = photoPool().filter(function (m) {
    return m.lab;
  });
  if (!pool.length) return false;
  const C = photoColours(),
    t = [];
  cl.forEach(function (l) {
    if (!C.has[l]) return;
    // (a sliver narrower than PH_THIN has no pixel clear of the lines, so its colour is partly line: it doesn't
    // choose markers, and takes the nearest of those chosen, as a section too thin to sample does, below)
    const pt = labelPts && labelPts[l];
    if (pt && pt.r < PH_THIN * srcK) return;
    const a = comps[l] ? comps[l].area : 1;
    t.push({ l: l, lab: [C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]], w: Math.sqrt(Math.max(1, a)) });
  });
  if (!t.length) return false;
  // (v304) no colour in the photo over these sections, with white areas left white: every one stays white (pins keep
  // their markers), and the Pattern panel says so; a photo mostly off the drawing is laid as before, and said
  const nc = photoNoColour(t);
  if (nc) _phNone[zk] = nc;
  if (nc && !nc.off) {
    if (!was || was.off) sayLive('No colour in this photo, so every section is left white.');
    const bk = {},
      asg = {};
    coll.forEach(function (m) {
      bk[m.mkey] = m;
    });
    const pp = {};
    t.forEach(function (x) {
      if (locks[x.l] !== undefined && bk[locks[x.l]]) asg[x.l] = bk[locks[x.l]];
      else pp[x.l] = 1;
    });
    const od = cl.filter(function (l) {
      return !!asg[l];
    });
    lastPoolN = 0;
    assignData = {
      assign: asg,
      order: od,
      N: od.length,
      base: Object.assign({}, asg),
      paper: Object.keys(pp).length ? pp : null,
    };
    photoStats();
    return true;
  }
  // near-white photo areas are left white (not coloured, not labelled), unless pinned
  const paper = {},
    tc = [];
  for (let i = 0; i < t.length; i++) {
    if (photoPaper && !locks[t[i].l] && photoIsWhite(t[i].lab)) paper[t[i].l] = 1;
    else tc.push(t[i]);
  }
  const r = photoPick(tc.length ? tc : t, pool, limitN, planDrag || !!quick),
    assign = {};
  if (tc.length) {
    for (let i = 0; i < tc.length; i++) assign[tc[i].l] = r.pick[i];
  } else {
    for (let i = 0; i < t.length; i++) assign[t[i].l] = r.pick[i];
    for (const k in paper) delete paper[k];
  }
  // a section too thin to sample, or a sliver, takes the colour of the photo at its middle
  const rgb = [0, 0, 0];
  cl.forEach(function (l) {
    if (assign[l] || paper[l]) return;
    const c = comps[l];
    photoAt(c.cx, c.cy, rgb);
    assign[l] = nearestInPool(rgbLab(rgb[0], rgb[1], rgb[2]), r.chosen.length ? r.chosen : pool);
  });
  const order = cl.slice().sort(function (a, b) {
    return comps[a].cy - comps[b].cy || comps[a].cx - comps[b].cx;
  });
  lastPoolN = r.chosen.length;
  photoSugPlan(tc.length ? tc : t, pool);
  const ord = order.filter(function (l) {
    return !paper[l];
  });
  assignData = {
    assign: assign,
    order: ord,
    N: ord.length,
    base: Object.assign({}, assign),
    paper: Object.keys(paper).length ? paper : null,
  };
  applyLocks();
  photoStats();
  return true;
}
// quick: the quick marker choice, not recorded as an Undo step (the full recolour that follows is)
function photoRecolour(quick) {
  if (!photoRef || !photoXf || sfmode !== 'guide' || family !== 'photo') return;
  guideDirty = true;
  // (every zone with the Photo pattern takes its colours from the one photo: all of them follow it, this one last)
  const ids = zones.length
    ? zoneIds().filter(function (id) {
        return zoneFamily(id) === 'photo';
      })
    : [0];
  if (
    holdRun(ids, function (cl) {
      return buildPhoto(cl, quick);
    })
  ) {
    // (the photo moved: with the light from it, which sections it covers, so which are shaded, may have changed)
    if (!quick) normalizeTones();
    renderGuide();
    renderControls();
    if (!quick) planCommit();
  }
}
// lining up is over (Done lining up, or leaving the Pattern tab): the see-through photo goes, and dragging the
// picture scrolls the page again
function photoEndAlign() {
  if (!photoAlign) return;
  photoAlign = false;
  hideTip();
  touchRule();
  positionPhoto();
}
// the see-through photo over the picture while lining up
function positionPhoto() {
  positionPeekBtn();
  const show = !!(
    (photoAlign || photoPeek) &&
    photoRef &&
    photoXf &&
    cv &&
    sfView &&
    sfmode === 'guide' &&
    family === 'photo' &&
    !root.classList.contains('sfrev')
  );
  if (!show) {
    if (photoEl) photoEl.style.display = 'none';
    return;
  }
  if (!photoEl) {
    photoEl = document.createElement('img');
    photoEl.className = 'sfphov';
    photoEl.alt = '';
    photoEl.setAttribute('aria-hidden', 'true');
    (picEl || sfView).appendChild(photoEl);
  }
  const src = photoViewUrl(photoRef);
  if (photoEl.getAttribute('src') !== src) photoEl.src = src;
  const r0 = cv.getBoundingClientRect(),
    vr = picHost().getBoundingClientRect(),
    q = picK(),
    k = r0.width / q / W,
    X = photoXf,
    r = { left: vr.left + (r0.left - vr.left) / q, top: vr.top + (r0.top - vr.top) / q };
  photoEl.style.display = '';
  photoEl.style.width = photoRef.w + 'px';
  photoEl.style.height = photoRef.h + 'px';
  photoEl.style.opacity = photoPeek ? 1 : photoOp;
  photoEl.style.transform =
    'translate(' +
    (r.left - vr.left + X.cx * k) +
    'px,' +
    (r.top - vr.top + X.cy * k) +
    'px) rotate(' +
    X.r +
    'rad) scale(' +
    X.sx * k +
    ',' +
    X.sy * k +
    ') translate(' +
    -photoRef.w / 2 +
    'px,' +
    -photoRef.h / 2 +
    'px)';
}
// lining up: one finger moves the photo, two fingers size and turn it (around the point between them)
const _phP = new Map();
let _phPrev = null,
  _phT = 0;
function _phGuidePt(cx, cy) {
  const r = cv.getBoundingClientRect();
  return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
}
function _phState() {
  const p = [..._phP.values()].map(function (q) {
    return _phGuidePt(q.x, q.y);
  });
  if (p.length === 1) return { m: p[0], d: 1, a: 0, n: 1 };
  const a = p[0],
    b = p[1];
  return {
    m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    d: Math.hypot(b.x - a.x, b.y - a.y) || 1,
    a: Math.atan2(b.y - a.y, b.x - a.x),
    n: 2,
  };
}
function photoPtr(e, kind) {
  if (kind === 'down') {
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    _phP.set(e.pointerId, { x: e.clientX, y: e.clientY });
    _phPrev = _phState();
    clearTimeout(_phT);
    return;
  }
  if (!_phP.has(e.pointerId)) return;
  if (kind === 'move') {
    _phP.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = _phState();
    if (_phPrev && s.n === _phPrev.n) {
      photoMove(_phPrev.m, s.m, s.n === 2 ? s.d / _phPrev.d : 1, s.n === 2 ? s.a - _phPrev.a : 0);
    }
    _phPrev = s;
    return;
  }
  _phP.delete(e.pointerId);
  try {
    cv.releasePointerCapture(e.pointerId);
  } catch (_) {}
  _phPrev = _phP.size ? _phState() : null;
  if (!_phP.size) {
    // the colours follow straight away with the quick choice, then the full one once the photo is left alone
    clearTimeout(_phT);
    _phT = setTimeout(function () {
      photoRecolour(true);
      _phT = setTimeout(photoRecolour, PH_SETTLE);
    }, 60);
  }
}
const PH_SETTLE = 500;
// move from point m0 to m1, scaling by f and turning by da around that point
function photoMove(m0, m1, f, da) {
  const X = photoXf;
  if (!X) return;
  const cs = Math.cos(da),
    sn = Math.sin(da),
    dx = X.cx - m0.x,
    dy = X.cy - m0.y;
  let ff = f;
  // (the size is kept between 1/50 and 30 times the size that fills the drawing, and only while it's being sized:
  // a fixed 0.02-50 shrank a small photo, whose Fill is past 50, as soon as it was dragged, v304)
  if (ff !== 1) {
    const fs = photoFillScale(),
      lo = fs / 50,
      hi = fs * 30,
      mn = Math.min(X.sx, X.sy),
      mx = Math.max(X.sx, X.sy);
    if (ff < 1 && mn * ff < lo) ff = Math.min(1, Math.max(ff, lo / mn));
    if (ff > 1 && mx * ff > hi) ff = Math.max(1, Math.min(ff, hi / mx));
  }
  X.cx = m1.x + ff * (dx * cs - dy * sn);
  X.cy = m1.y + ff * (dx * sn + dy * cs);
  X.sx *= ff;
  X.sy *= ff;
  X.r += da;
  _phCol = null;
  _phAlFail = false;
  guideDirty = true;
  positionPhoto();
}
function photoWheel(e) {
  e.preventDefault();
  const m = _phGuidePt(e.clientX, e.clientY);
  if (e.shiftKey) photoMove(m, m, 1, ((e.deltaY > 0 ? 1 : -1) * Math.PI) / 90);
  else photoMove(m, m, Math.exp(-e.deltaY * 0.0015), 0);
  clearTimeout(_phT);
  _phT = setTimeout(photoRecolour, 160);
}
function pickPhotoRef() {
  if (!photoFileEl) {
    photoFileEl = document.createElement('input');
    photoFileEl.type = 'file';
    photoFileEl.accept = 'image/*';
    photoFileEl.className = 'fileinput';
    document.body.appendChild(photoFileEl);
    photoFileEl.addEventListener('change', function () {
      const f = photoFileEl.files && photoFileEl.files[0];
      photoFileEl.value = '';
      if (f) loadPhotoRef(f);
    });
  }
  photoFileEl.click();
}
// the photo belongs to the guide open when it was picked: if another opens while it decodes, it is dropped quietly
// (v304) each pick has its own number: a photo still decoding when another is picked, or after another pattern was
// chosen, is dropped rather than replacing the newer one or switching the pattern back to Photo
let _phPick = 0;
function loadPhotoRef(file) {
  const gen = loadGen,
    pick = ++_phPick;
  let url = null;
  try {
    url = URL.createObjectURL(file);
  } catch (e) {}
  if (!url) {
    note('Couldn’t read that photo.');
    return;
  }
  const here = function () {
    return gen === loadGen && !!assignData && pick === _phPick && family === 'photo';
  };
  const lens =
    file.slice && file.slice(0, 262144).arrayBuffer
      ? file
          .slice(0, 262144)
          .arrayBuffer()
          .then(pgExifFocal)
          .catch(function () {
            return 0;
          })
      : Promise.resolve(0);
  const img = new Image();
  img.onload = function () {
    URL.revokeObjectURL(url);
    if (!here()) return;
    lens.then(function (f35) {
      if (!here()) return;
      const flat = pgRefFlat(img, f35),
        ref = photoFromImage(flat || img);
      // (the flattened page was only needed to read it from, v296)
      if (flat) freeCanvas(flat);
      if (!ref) {
        note('Couldn’t read that photo.');
        return;
      }
      ref.flat = !!ref.flatSrc;
      setPhotoRef(ref);
    });
  };
  img.onerror = function () {
    URL.revokeObjectURL(url);
    if (here()) note('That file couldn’t be opened as a picture — try a JPEG or PNG.');
  };
  img.src = url;
}
function setPhotoRef(ref, noAuto) {
  if (!ref.raw) ref = photoLitNew(ref);
  photoRef = ref;
  photoWait = {};
  _phPend = null;
  // (placed afresh on the picture as it is now, v304)
  _phRefit = false;
  _phAlFail = false;
  photoGreys = false;
  photoFit('fill');
  photoAlign = true;
  family = 'photo';
  if (!_phBumped) {
    _phBumped = true;
    if (limitN < 24) limitN = Math.min(24, sliderMax());
  }
  photoRecolour();
  positionPhoto();
  // if the photo is a coloured version of this page, line it up by itself (quietly skipped when it isn't)
  if (!noAuto) {
    photoChecking = true;
    renderControls();
    setTimeout(function () {
      if (photoRef !== ref) {
        photoChecking = false;
        return;
      }
      try {
        photoTryAutoAlign(true);
      } finally {
        photoChecking = false;
        renderControls();
      }
    }, 60);
  }
}
/* ---- phase 2: how close the result is, white left white, and comparing with the photo ---- */
let photoPaper = true,
  photoPeek = false,
  photoRoughOnly = false,
  _phErr = null,
  _phStats = null,
  peekBtn = null;
// How close a section's marker is to its photo colour: by eye (CIEDE2000), in Match's words (colour.js: MATCH_STEPS).
// From PH_ROUGH on, a match is Rough or Loose.
const PH_ROUGH = MATCH_STEPS[2][0];
// plain L*a*b* distance: only for finding a short list quickly, and the page check (whose limits were measured with it)
function _dE(a, b) {
  const dl = a[0] - b[0],
    da = a[1] - b[1],
    db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}
// near-white paper in the photo: very light and hardly any colour; in a photo whose lighting was corrected, close to
// its paper (the paper is white by then, but its texture, shadows and the lines' spread leave a section's colour a
// little below it)
function photoIsWhite(lab) {
  const P = photoRef && photoRef.lit && photoRef.lit.on ? photoRef.lit.white : null;
  if (!P) return lab[0] >= 88 && Math.hypot(lab[1], lab[2]) <= 9;
  return lab[0] >= P[0] - PH_WHITE_L && Math.hypot(lab[1] - P[1], lab[2] - P[2]) <= PH_WHITE_C;
}
const PH_WHITE_L = 8,
  PH_WHITE_C = 7;
// per section: how far its marker is from the photo colour; summary; and markers you don't own that would help most
function photoStats() {
  const C = _phCol,
    K = comps.length;
  if (!assignData || !C) {
    _phErr = null;
    _phStats = null;
    return;
  }
  _phErr = new Float32Array(K).fill(-1);
  let close = 0,
    rough = 0,
    tot = 0;
  const R = [];
  for (const k in assignData.assign) {
    const l = +k,
      m = assignData.assign[l];
    // (with zones, only the sections of zones with the Photo pattern: v304)
    if (!C.has[l] || !m.lab || locks[l] || (zones.length && zoneFamily(zoneOf(l)) !== 'photo')) continue;
    const t = [C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]],
      e = de2000(t, m.lab);
    _phErr[l] = e;
    tot++;
    if (e < PH_ROUGH) close++;
    else {
      rough++;
      R.push({ lab: t, e: e, w: Math.sqrt(Math.max(1, comps[l].area || 1)) });
    }
  }
  let want = [];
  if (R.length && !isDemo()) {
    // (from your brands, or the ones ticked in Brands I'd buy, v304)
    const brands = {},
      bb = buyBrands();
    if (bb)
      bb.forEach(function (b) {
        brands[b] = 1;
      });
    else
      coll.forEach(function (m) {
        brands[m.brand] = 1;
      });
    const own = {};
    coll.forEach(function (m) {
      own[m.mkey] = 1;
    });
    const cand = catPool().filter(function (m) {
      return brands[m.brand] && !own[m.mkey] && m.lab;
    });
    // as in Match: against the best of yours, not only the one this guide uses (with a low marker count a section can
    // be rough while a marker you own would do); only where even that is a rough match is a marker to buy wanted
    const pool = photoPool().filter(function (m) {
      return m.lab;
    });
    const R2 = [];
    R.forEach(function (r) {
      const e = pool.length ? Math.min(r.e, de2000(r.lab, nearestInPool(r.lab, pool).lab)) : r.e;
      if (e >= PH_ROUGH) R2.push({ lab: r.lab, e: e, w: r.w });
    });
    want = R2.length ? photoWant(R2, cand) : [];
  }
  _phStats = {
    close: close,
    rough: rough,
    tot: tot,
    paper: assignData.paper ? Object.keys(assignData.paper).length : 0,
    want: want,
  };
}
// up to 6 markers you don't own that bring the rough matches closest, by eye, chosen one at a time (each the one that
// helps most). A marker only counts for a section when it is clearly closer there than what it has, by Match's
// MATCH_BUY_GAIN, as in Match's "to buy". R: [{lab, e (by eye now), w}]; cand: the markers you could buy.
function photoWant(R, cand) {
  // for each section, its PH_SHORT nearest candidates by plain distance, then measured by eye
  const near = R.map(function (r) {
    const top = [];
    for (let j = 0; j < cand.length; j++) {
      const d = _dE(r.lab, cand[j].lab);
      if (top.length === PH_SHORT && d >= top[PH_SHORT - 1][1]) continue;
      let k = top.length === PH_SHORT ? PH_SHORT - 1 : top.length;
      while (k > 0 && top[k - 1][1] > d) {
        top[k] = top[k - 1];
        k--;
      }
      top[k] = [j, d];
    }
    return top.map(function (x) {
      return [x[0], de2000(r.lab, cand[x[0]].lab)];
    });
  });
  const picked = [],
    cur = R.map(function (r) {
      return r.e;
    });
  for (let it = 0; it < 6; it++) {
    const gain = new Map();
    for (let i = 0; i < R.length; i++)
      near[i].forEach(function (x) {
        if (x[1] <= cur[i] - MATCH_BUY_GAIN) gain.set(x[0], (gain.get(x[0]) || 0) + R[i].w * (cur[i] - x[1]));
      });
    let bj = -1,
      bg = 0;
    gain.forEach(function (g, j) {
      if (g > bg || (g === bg && j < bj)) {
        bg = g;
        bj = j;
      }
    });
    if (bj < 0) break;
    picked.push(cand[bj]);
    for (let i = 0; i < R.length; i++)
      near[i].forEach(function (x) {
        if (x[0] === bj && x[1] <= cur[i] - MATCH_BUY_GAIN) cur[i] = x[1];
      });
  }
  return picked;
}
const PH_SHORT = 12;
function photoStatsHTML() {
  if (family !== 'photo' || !photoRef) return '';
  // (no colour in the photo: said instead; the photo off the drawing: said first, v304)
  const none = photoNoneHTML();
  if (none && !_phNone[pwKey()].off) return none;
  return none + photoStatsHTML0();
}
function photoStatsHTML0() {
  if (!_phCol) photoColours();
  photoStats();
  if (!_phStats) return '';
  const s = _phStats;
  if (!s.tot) return '';
  const pct = Math.round((s.close / s.tot) * 100),
    // the suggested marker count (filled in when it's ready: photoSugShow)
    sug = '<div class="sfphsug" id="sfPhSug" aria-live="polite">' + photoSugHTML() + '</div>';
  let h =
    '<div class="sfphstat"><b>' +
    pct +
    '%</b> of sections are a close match to the photo or better' +
    (s.paper ? ' · ' + s.paper + ' left white' : '') +
    '.';
  if (s.rough) {
    h +=
      ' <span>' +
      s.rough +
      ' ' +
      (s.rough === 1 ? 'is' : 'are') +
      ' only a rough or loose match.</span></div>' +
      sug +
      '<label class="sfchk sfphrough"><input type="checkbox" id="sfPhRough"' +
      (photoRoughOnly ? ' checked' : '') +
      '> Show the rough matches</label>';
    if (s.want.length) {
      const mixed =
        s.want.some(function (m) {
          return m.brand !== s.want[0].brand;
        }) || brandsMixed();
      h +=
        '<div class="sfphwant">Closer with: ' +
        s.want
          .map(function (m) {
            const inner =
              '<span><i style="background:' +
              esc(m.hex) +
              '"></i>' +
              esc((mixed ? bTag(m.brand) + ' ' : '') + m.code) +
              '</span>';
            return api.wishChip ? api.wishChip(m.mkey, 'closer to your photo', inner) : inner;
          })
          .join(' ') +
        ' <em>(markers you don’t own)</em>' +
        (api.wishAll
          ? api.wishAll(
              s.want.map(function (m) {
                return [m.mkey, 'closer to your photo'];
              }),
            )
          : '') +
        '</div>';
    }
  } else h += '</div>' + sug;
  return h;
}
// the tip when you tap a section: photo colour next to its marker, and how close they are
// (for a section in a zone with the Photo pattern, whichever zone the tabs edit)
function photoTipHTML(l) {
  if (
    zoneFamily(zoneOf(l)) !== 'photo' ||
    !photoRef ||
    !_phCol ||
    !_phCol.has[l] ||
    !assignData ||
    !assignData.assign[l]
  )
    return '';
  const C = _phCol,
    t = [C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]],
    m = assignData.assign[l];
  if (!m.lab) return '';
  const w = matchWord(de2000(t, m.lab)).toLowerCase();
  return (
    '<div class="sftipsh"><i style="background:' +
    labHex(t) +
    '"></i>photo · ' +
    w +
    ' match' +
    (locks[l] ? ' (pinned)' : '') +
    '</div>'
  );
}
function labHex(lab) {
  const fy = (lab[0] + 16) / 116,
    fx = fy + lab[1] / 500,
    fz = fy - lab[2] / 200,
    f = function (t) {
      return t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787;
    },
    X = f(fx) * 0.95047,
    Y = f(fy),
    Z = f(fz) * 1.08883;
  const g = function (c) {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  const r = g(X * 3.2406 - Y * 1.5372 - Z * 0.4986),
    gg = g(-X * 0.9689 + Y * 1.8758 + Z * 0.0415),
    b = g(X * 0.0557 - Y * 0.204 + Z * 1.057);
  return (
    '#' +
    [r, gg, b]
      .map(function (v) {
        return (v < 16 ? '0' : '') + v.toString(16);
      })
      .join('')
  );
}
// the "Photo" button under the picture: show the photo on top (not see-through) to compare
function positionPeekBtn() {
  if (!peekBtn) {
    peekBtn = document.getElementById('sfPhPeek');
    if (!peekBtn) return;
    peekBtn.addEventListener('click', function () {
      photoPeek = !photoPeek;
      positionPhoto();
    });
  }
  const on = !!(photoRef && photoXf && sfmode === 'guide' && family === 'photo');
  peekBtn.style.display = on ? '' : 'none';
  if (!on) photoPeek = false;
  peekBtn.classList.toggle('on', photoPeek);
  peekBtn.setAttribute('aria-pressed', photoPeek ? 'true' : 'false');
  planFit();
}
/* ---- lining the photo up automatically ----
    For a coloured version of the same page (or the photo the line art was traced from): find the size, turn and
    position at which the photo's edges sit on the picture's lines. A coarse search over every quarter turn,
    a range of sizes and positions on a small grid, then the best few are refined on finer grids. */
// the picture as a grid of cells over the artwork (plus a margin): where each cell is and how much of it is line
let _alC = null;
function _alCache() {
  // (and on the sections themselves: placed again just after the picture changed, labelPts is null both times, v304)
  if (!_alC || _alC.ref !== photoRef || _alC.lp !== labelPts || _alC.lb !== labels)
    _alC = { ref: photoRef, lp: labelPts, lb: labels, g: {}, e: {} };
  return _alC;
}
function _alignGrid(NG) {
  const C = _alCache();
  if (C.g[NG]) return C.g[NG];
  const r = _alignGrid0(NG);
  C.g[NG] = r;
  return r;
}
function _alignEdges(px) {
  const f = Math.max(1, Math.round(px * 4) / 4),
    C = _alCache();
  if (C.e[f]) return C.e[f];
  const r = _alignEdges0(f);
  C.e[f] = r;
  return r;
}
function _alignGrid0(NG) {
  const bx = artBox(),
    mw = (bx.x1 - bx.x0 + 1) * 0.08,
    mh = (bx.y1 - bx.y0 + 1) * 0.08,
    x0 = Math.max(0, bx.x0 - mw),
    y0 = Math.max(0, bx.y0 - mh),
    x1 = Math.min(W, bx.x1 + 1 + mw),
    y1 = Math.min(H, bx.y1 + 1 + mh),
    cs = Math.max(x1 - x0, y1 - y0) / NG,
    gw = Math.max(2, Math.ceil((x1 - x0) / cs)),
    gh = Math.max(2, Math.ceil((y1 - y0) / cs)),
    cnt = new Float32Array(gw * gh),
    tot = new Float32Array(gw * gh);
  const xa = Math.floor(x0),
    xb = Math.ceil(x1),
    cx = new Int32Array(xb - xa);
  for (let x = xa; x < xb; x++) cx[x - xa] = Math.min(gw - 1, ((x - x0) / cs) | 0);
  for (let y = Math.floor(y0); y < y1; y++) {
    const go = Math.min(gh - 1, ((y - y0) / cs) | 0) * gw,
      ro = y * W;
    for (let x = xa; x < xb && x < W; x++) {
      const k = go + cx[x - xa];
      tot[k]++;
      if (labels[ro + x] === -1) cnt[k]++;
    }
  }
  const X = [],
    Y = [],
    G = [];
  for (let k = 0; k < gw * gh; k++) {
    if (!tot[k]) continue;
    X.push(x0 + ((k % gw) + 0.5) * cs);
    Y.push(y0 + (((k / gw) | 0) + 0.5) * cs);
    G.push(cnt[k] / tot[k]);
  }
  return { x: new Float32Array(X), y: new Float32Array(Y), g: new Float32Array(G), step: cs };
}
// the photo's edges (how sharply lightness changes), at a size where one pixel is about `px` photo pixels, softened a little
function _alignEdges0(px) {
  const d = photoRef.data,
    pw = photoRef.w,
    ph = photoRef.h,
    f = Math.max(1, px),
    ew = Math.max(3, Math.round(pw / f)),
    eh = Math.max(3, Math.round(ph / f)),
    L = new Float32Array(ew * eh),
    n = new Uint16Array(ew * eh);
  const ex = new Int32Array(pw);
  for (let x = 0; x < pw; x++) ex[x] = Math.min(ew - 1, (x / f) | 0);
  for (let y = 0; y < ph; y++) {
    const eo = Math.min(eh - 1, (y / f) | 0) * ew;
    let j = y * pw * 4;
    for (let x = 0; x < pw; x++, j += 4) {
      const k = eo + ex[x];
      L[k] += 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
      n[k]++;
    }
  }
  for (let k = 0; k < L.length; k++) L[k] /= n[k] || 1;
  const E = new Float32Array(ew * eh);
  for (let y = 1; y < eh - 1; y++)
    for (let x = 1; x < ew - 1; x++) {
      const k = y * ew + x,
        gx = L[k + 1] - L[k - 1] + 0.5 * (L[k - ew + 1] - L[k - ew - 1] + L[k + ew + 1] - L[k + ew - 1]),
        gy = L[k + ew] - L[k - ew] + 0.5 * (L[k + ew - 1] - L[k - ew - 1] + L[k + ew + 1] - L[k - ew + 1]);
      E[k] = Math.hypot(gx, gy);
    }
  const B = new Float32Array(ew * eh);
  for (let y = 0; y < eh; y++)
    for (let x = 0; x < ew; x++) {
      let s = 0,
        c = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= ew || yy >= eh) continue;
          s += E[yy * ew + xx];
          c++;
        }
      B[y * ew + x] = s / c;
    }
  return { E: B, w: ew, h: eh, f: f };
}
// how well placement X matches: correlation between "how much line" per cell and the photo's edges there (-1..1)
function _alignScore(P, Ed, X) {
  const cs = Math.cos(X.r),
    sn = Math.sin(X.r),
    pw = photoRef.w,
    ph = photoRef.h,
    E = Ed.E,
    ew = Ed.w,
    eh = Ed.h,
    f = Ed.f,
    N = P.g.length;
  let n = 0,
    sg = 0,
    se = 0,
    sgg = 0,
    see = 0,
    sge = 0;
  for (let i = 0; i < N; i++) {
    const dx = P.x[i] - X.cx,
      dy = P.y[i] - X.cy,
      u = (dx * cs + dy * sn) / X.s + pw / 2,
      v = (-dx * sn + dy * cs) / X.s + ph / 2;
    if (u < 0 || v < 0 || u >= pw || v >= ph) continue;
    const e = E[Math.min(eh - 1, (v / f) | 0) * ew + Math.min(ew - 1, (u / f) | 0)],
      g = P.g[i];
    n++;
    sg += g;
    se += e;
    sgg += g * g;
    see += e * e;
    sge += g * e;
  }
  if (n < N * 0.7) return -1;
  const vg = n * sgg - sg * sg,
    ve = n * see - se * se;
  if (vg <= 0 || ve <= 0) return -1;
  return (n * sge - sg * se) / Math.sqrt(vg * ve);
}
function photoAutoAlign() {
  if (!photoRef || !labels) return null;
  const b = artBox(),
    bw = b.x1 - b.x0 + 1,
    bh = b.y1 - b.y0 + 1,
    bcx = (b.x0 + b.x1 + 1) / 2,
    bcy = (b.y0 + b.y1 + 1) / 2,
    pw = photoRef.w,
    ph = photoRef.h;
  // where the drawing sits in the photo: the box around its edges (rows and columns busier than the paper around them)
  const E0 = _alignEdges(Math.max(1, Math.max(pw, ph) / 250)),
    rs = new Float32Array(E0.h),
    csum = new Float32Array(E0.w);
  let mr = 0,
    mc = 0;
  for (let y = 0; y < E0.h; y++)
    for (let x = 0; x < E0.w; x++) {
      const e = E0.E[y * E0.w + x];
      rs[y] += e;
      csum[x] += e;
    }
  for (let i = 0; i < E0.h; i++) mr = Math.max(mr, rs[i]);
  for (let i = 0; i < E0.w; i++) mc = Math.max(mc, csum[i]);
  const span = function (a, m) {
    let lo = 0,
      hi = a.length - 1;
    while (lo < hi && a[lo] < m * 0.18) lo++;
    while (hi > lo && a[hi] < m * 0.18) hi--;
    return [lo, hi + 1];
  };
  const ry = span(rs, mr),
    rx = span(csum, mc),
    cu = ((rx[0] + rx[1]) / 2) * E0.f,
    cv = ((ry[0] + ry[1]) / 2) * E0.f,
    cw = (rx[1] - rx[0]) * E0.f,
    ch = (ry[1] - ry[0]) * E0.f;
  const place = function (pu, pv, s, r) {
    const cs = Math.cos(r),
      sn = Math.sin(r),
      du = (pw / 2 - pu) * s,
      dv = (ph / 2 - pv) * s;
    return { cx: bcx + du * cs - dv * sn, cy: bcy + du * sn + dv * cs, s: s, r: r };
  };
  // try each quarter turn at the size and position that box suggests (and a little either side), plus the plain fill
  const P1 = _alignGrid(96),
    cands = [];
  for (let q = 0; q < 4; q++) {
    const r = (q * Math.PI) / 2,
      sw = q % 2 ? ch : cw,
      sh = q % 2 ? cw : ch,
      s0 = Math.sqrt((bw / Math.max(1, sw)) * (bh / Math.max(1, sh)));
    [0.72, 0.85, 1, 1.18, 1.38].forEach(function (m) {
      const s = s0 * m,
        Ed = _alignEdges(Math.max(1, P1.step / s));
      for (let oy = -2; oy <= 2; oy++)
        for (let ox = -2; ox <= 2; ox++) {
          const X = place(cu + (ox * P1.step) / s, cv + (oy * P1.step) / s, s, r),
            v = _alignScore(P1, Ed, X);
          if (v > -1) cands.push({ X: X, v: v });
        }
    });
  }
  if (!cands.length) return null;
  cands.sort(function (a, b) {
    return b.v - a.v;
  });
  // refine the best few on finer grids: nudge position, size and turn, halving the steps
  const refine = function (X, P, Ed, st, cap) {
    let best = _alignScore(P, Ed, X),
      ds = 0.05,
      dr = 0.04;
    for (let it = 0; it < (cap || 60) && st > P.step * 0.3; it++) {
      let moved = false;
      const tries = [
        [st, 0, 0, 0],
        [-st, 0, 0, 0],
        [0, st, 0, 0],
        [0, -st, 0, 0],
        [0, 0, ds, 0],
        [0, 0, -ds, 0],
        [0, 0, 0, dr],
        [0, 0, 0, -dr],
      ];
      for (let i = 0; i < tries.length; i++) {
        const t = tries[i],
          Y = { cx: X.cx + t[0], cy: X.cy + t[1], s: X.s * (1 + t[2]), r: X.r + t[3] };
        const v = _alignScore(P, Ed, Y);
        if (v > best) {
          best = v;
          X = Y;
          moved = true;
        }
      }
      if (!moved) {
        st /= 2;
        ds /= 2;
        dr /= 2;
      }
    }
    return { X: X, v: best };
  };
  // (the best few overall, and the best of each quarter turn: on the coarse grid a coloured page whose colours change
  // smoothly can score a little higher upside down, and only the finer grids tell them apart)
  const P2 = _alignGrid(180),
    pick = cands.slice(0, 4);
  for (let q = 0; q < 4; q++)
    cands
      .filter(function (x) {
        return Math.abs(x.X.r - (q * Math.PI) / 2) < 1e-6;
      })
      .slice(0, 2)
      .forEach(function (c) {
        if (pick.indexOf(c) < 0) pick.push(c);
      });
  let top = null;
  for (let i = 0; i < pick.length; i++) {
    const R = refine(pick[i].X, P2, _alignEdges(Math.max(1, P2.step / pick[i].X.s)), P1.step * 2);
    if (!top || R.v > top.v) top = R;
  }
  const P3 = _alignGrid(320),
    E3 = _alignEdges(Math.max(1, P3.step / top.X.s)),
    fin = refine(top.X, P3, E3, P2.step * 0.5, 40);
  // a real match is a sharp peak: moving the photo by an eighth of the drawing should lose most of it
  // (stripes, grids and other repeating photos stay high when moved, so they are turned away)
  const sh = [
    [bw * 0.12, 0],
    [-bw * 0.12, 0],
    [0, bh * 0.12],
    [0, -bh * 0.12],
  ].map(function (d) {
    return Math.max(
      0,
      _alignScore(P3, E3, { cx: fin.X.cx + d[0], cy: fin.X.cy + d[1], s: fin.X.s, r: fin.X.r }),
    );
  });
  const near = sh.reduce(function (a, v) {
    return Math.max(a, v);
  }, 0);
  let lines = 0;
  for (let i = 0; i < P3.g.length; i++) if (P3.g[i] > 0.05) lines++;
  return {
    xf: { cx: fin.X.cx, cy: fin.X.cy, sx: fin.X.s, sy: fin.X.s, r: fin.X.r },
    score: fin.v,
    peak: fin.v - near,
    lineShare: lines / P3.g.length,
  };
}
// try it; only use the result when the match is clear. Returns true when the photo was lined up.
// a photo whose page was straightened shows the same flat page as the picture, only perhaps turned: try the four
// quarter turns at full size and keep one that clearly matches (dark ink where the picture has lines)
function photoFlatAlign() {
  if (!photoRef || !photoRef.flat || !labels) return null;
  const b = artBox(),
    bw = b.x1 - b.x0 + 1,
    bh = b.y1 - b.y0 + 1,
    G = 48,
    gh = Math.max(8, Math.round((G * bh) / bw)),
    ink = new Float32Array(G * gh),
    cnt = new Float32Array(G * gh);
  for (let y = b.y0; y <= b.y1; y += 2)
    for (let x = b.x0; x <= b.x1; x += 2) {
      const k =
        Math.min(gh - 1, (((y - b.y0) * gh) / bh) | 0) * G + Math.min(G - 1, (((x - b.x0) * G) / bw) | 0);
      cnt[k]++;
      if (labels[y * W + x] === -1) ink[k]++;
    }
  for (let k = 0; k < ink.length; k++) ink[k] /= cnt[k] || 1;
  const keep = photoXf,
    rgb = [0, 0, 0],
    pw = photoRef.w,
    ph = photoRef.h,
    ncc = function (a, c) {
      let ma = 0,
        mc = 0;
      for (let i = 0; i < a.length; i++) {
        ma += a[i];
        mc += c[i];
      }
      ma /= a.length;
      mc /= c.length;
      let s = 0,
        sa = 0,
        sc = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i] - ma,
          y = c[i] - mc;
        s += x * y;
        sa += x * x;
        sc += y * y;
      }
      return s / Math.sqrt(sa * sc || 1);
    };
  const res = [];
  for (let k = 0; k < 4; k++) {
    const odd = k & 1,
      s = Math.max(bw / (odd ? ph : pw), bh / (odd ? pw : ph));
    photoXf = { cx: (b.x0 + b.x1 + 1) / 2, cy: (b.y0 + b.y1 + 1) / 2, sx: s, sy: s, r: (k * Math.PI) / 2 };
    const dk = new Float32Array(G * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < G; gx++) {
        let sm = 0;
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 3; i++) {
            photoAt(b.x0 + ((gx + (i + 0.5) / 3) * bw) / G, b.y0 + ((gy + (j + 0.5) / 3) * bh) / gh, rgb);
            sm += 255 - (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]);
          }
        dk[gy * G + gx] = sm / 9;
      }
    res.push({ xf: photoXf, score: ncc(ink, dk) });
  }
  res.sort(function (a, c) {
    return c.score - a.score;
  });
  if (!(res[0].score >= 0.4 && res[0].score - res[1].score >= 0.2)) {
    photoXf = keep;
    return null;
  }
  // the two pages' edges were found separately, so nudge place and size (each way) to where the lines agree best
  const F = Math.min(110, Math.max(50, Math.round(bw / 16))),
    fh = Math.max(8, Math.round((F * bh) / bw)),
    fi = new Float32Array(F * fh),
    fc = new Float32Array(F * fh),
    cw = bw / F,
    ch = bh / fh;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const k = Math.min(fh - 1, ((y - b.y0) / ch) | 0) * F + Math.min(F - 1, ((x - b.x0) / cw) | 0);
      fc[k]++;
      if (labels[y * W + x] === -1) fi[k]++;
    }
  for (let k = 0; k < fi.length; k++) fi[k] /= fc[k] || 1;
  // the photo's darkness, softened a little, looked up once per cell
  const pd0 = new Float32Array(pw * ph),
    pdk = new Float32Array(pw * ph),
    D = photoRef.data;
  for (let i = 0; i < pw * ph; i++)
    pd0[i] = 255 - (0.3 * D[i * 4] + 0.59 * D[i * 4 + 1] + 0.11 * D[i * 4 + 2]);
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      let sm = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ph) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= pw) continue;
          sm += pd0[yy * pw + xx];
          n++;
        }
      }
      pdk[y * pw + x] = sm / n;
    }
  const fd = new Float32Array(F * fh),
    score = function (X) {
      const cs = Math.cos(X.r),
        sn = Math.sin(X.r);
      for (let gy = 0; gy < fh; gy++) {
        const dy = b.y0 + (gy + 0.5) * ch - X.cy;
        for (let gx = 0; gx < F; gx++) {
          const dx = b.x0 + (gx + 0.5) * cw - X.cx;
          let px = ((dx * cs + dy * sn) / X.sx + pw / 2) | 0,
            py = ((-dx * sn + dy * cs) / X.sy + ph / 2) | 0;
          px = px < 0 ? 0 : px >= pw ? pw - 1 : px;
          py = py < 0 ? 0 : py >= ph ? ph - 1 : py;
          fd[gy * F + gx] = pdk[py * pw + px];
        }
      }
      return ncc(fi, fd);
    };
  let X = Object.assign({}, res[0].xf),
    best = score(X);
  for (let st = 0.012; st >= 0.0008; st /= 2) {
    let moved = true,
      guard = 0;
    while (moved && guard++ < 8) {
      moved = false;
      for (const key of ['cx', 'cy', 'sx', 'sy'])
        for (const sg of [1, -1]) {
          const Y = Object.assign({}, X);
          if (key === 'cx') Y.cx += sg * st * bw;
          else if (key === 'cy') Y.cy += sg * st * bh;
          else Y[key] *= 1 + sg * st;
          const v = score(Y);
          if (v > best + 1e-4) {
            best = v;
            X = Y;
            moved = true;
          }
        }
    }
  }
  photoXf = keep;
  return { xf: X, score: best, coarse: res[0].score };
}
// (lining up reads the photo as it was taken, as it was tuned on, not the lighting-corrected copy)
function photoAlignRaw(fn) {
  const keep = photoRef;
  if (keep && keep.raw && keep.data !== keep.raw) photoRef = Object.assign({}, keep, { data: keep.raw });
  try {
    return fn();
  } finally {
    photoRef = keep;
  }
}
function photoTryAutoAlign(quiet) {
  const fa = photoAlignRaw(photoFlatAlign);
  if (fa) {
    photoXf = fa.xf;
    _phAlFail = false;
    photoLitLined();
    _phCol = null;
    guideDirty = true;
    photoRecolour();
    positionPhoto();
    toast(
      'Straightened the page in the photo and lined it up with the picture \u2014 check it, and drag to adjust if needed.',
      4200,
    );
    return true;
  }
  const r = photoAlignRaw(photoAutoAlign);
  if (!r || r.score < PH_ALIGN_MIN || r.peak < PH_ALIGN_PEAK || r.lineShare < 0.03) {
    _phAlFail = true;
    if (!quiet)
      toast(
        'Couldn’t match this photo to the picture — line it up by hand (drag, pinch to size and turn).',
        5000,
      );
    return false;
  }
  photoXf = r.xf;
  _phAlFail = false;
  photoLitLined();
  _phCol = null;
  guideDirty = true;
  photoRecolour();
  positionPhoto();
  toast(
    (photoRef && photoRef.flat
      ? 'Straightened the page in the photo and lined it up with the picture'
      : 'Lined the photo up with the picture') + ' — check it, and drag to adjust if needed.',
    4200,
  );
  return true;
}
const PH_ALIGN_MIN = 0.28,
  PH_ALIGN_PEAK = 0.16;
