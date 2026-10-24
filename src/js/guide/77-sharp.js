/* ---- (v323) Sharp outlines when magnified: Focus mode's zoom and the PDF's close-ups ----
   The guide is drawn one pixel per pixel of the picture (921 across for the sample), and magnified its outlines show
   those pixels as steps. Here the outlines are drawn again at the size they're shown: a signed distance field of the
   line pixels (the exact distance from each pixel to the nearest pixel of the other kind, labels -1 being the lines),
   smoothed a touch, is read between pixels and its zero is the line's edge, drawn with a pixel of soft edge. Under it,
   the colours are the picture's own with the lines taken out (each line pixel given the colour of the section nearest
   it), read between pixels too. So the lines keep their width and place, and their steps become curves; the colours,
   the codes and the shading are the picture's, magnified as before.
   sharpField(R) is worked out for a window of the picture (R: { X0, Y0, w, h }, the part to be drawn and a margin; the
   whole picture without R) and kept while the sections stand and later crops fall inside it: the window on the screen
   in Focus mode is a few hundred picture pixels across (a few ms), where the whole of a 2400-pixel photo took about
   a second (v323 debugging pass). sharpPaint(base, crop, ow, oh, ink) draws the crop [x0, y0, x1, y1] of the picture
   (in picture pixels) at ow × oh from base (an ImageData of the picture, W × H) into a new ImageData; ink: the lines'
   colour. Within the margin the window's distances are the whole picture's: the drawing reads at most the smoothing's
   4 pixels and the edge's half pixel beyond a pixel, and a line pixel's nearest section pixel is found within it for
   any line up to twice the margin across (beyond that, the line's middle keeps its own colour, the ink). */
const SHARP_M = 24;
let _shF = null;
// the window for a crop: the crop, a quarter more each way (small moves stay inside it) and the margin
function sharpRegion(crop) {
  if (!crop) return { X0: 0, Y0: 0, w: W, h: H };
  const pw = (crop[2] - crop[0]) * 0.25 + SHARP_M,
    ph = (crop[3] - crop[1]) * 0.25 + SHARP_M,
    X0 = Math.max(0, Math.floor(crop[0] - pw)),
    Y0 = Math.max(0, Math.floor(crop[1] - ph)),
    X1 = Math.min(W, Math.ceil(crop[2] + pw)),
    Y1 = Math.min(H, Math.ceil(crop[3] + ph));
  return { X0: X0, Y0: Y0, w: Math.max(1, X1 - X0), h: Math.max(1, Y1 - Y0) };
}
// whether a field's window holds a crop with the margin round it (or reaches the picture's edge there)
function sharpHolds(F, crop) {
  if (!crop) return F.X0 === 0 && F.Y0 === 0 && F.w === W && F.h === H;
  return (
    (F.X0 === 0 || crop[0] - F.X0 >= SHARP_M) &&
    (F.Y0 === 0 || crop[1] - F.Y0 >= SHARP_M) &&
    (F.X0 + F.w === W || F.X0 + F.w - crop[2] >= SHARP_M) &&
    (F.Y0 + F.h === H || F.Y0 + F.h - crop[3] >= SHARP_M)
  );
}
// the field for these sections over a crop's window: { sdf: Float32Array (the window's pixels, negative inside a
// line), near: Int32Array (each line pixel's nearest pixel not a line, as a picture index, or -1), X0, Y0, w, h, k:
// the sections it was made for }
function sharpField(crop) {
  if (!labels || !W || !H) return null;
  const key = labels.length + ':' + W + 'x' + H + ':' + (typeof labelsSig === 'function' ? labelsSig() : '');
  if (_shF && _shF.k === key && _shF.lab === labels && sharpHolds(_shF, crop)) return _shF;
  const R = sharpRegion(crop),
    X0 = R.X0,
    Y0 = R.Y0,
    w = R.w,
    h = R.h,
    n = w * h,
    INF = 1e20,
    // (each window pixel's picture index)
    gi = function (p) {
      return (Y0 + ((p / w) | 0)) * W + X0 + (p % w);
    },
    // squared distances to the nearest line pixel (for the others), and to the nearest pixel not a line (for lines)
    dOut = new Float32Array(n),
    dIn = new Float32Array(n),
    near = new Int32Array(n).fill(-1),
    isLine = new Uint8Array(n);
  for (let y = 0, p = 0; y < h; y++) {
    const r = (Y0 + y) * W + X0;
    for (let x = 0; x < w; x++, p++) isLine[p] = labels[r + x] === -1 ? 1 : 0;
  }
  sharpEdt(isLine, 1, dOut, null, w, h);
  sharpEdt(isLine, 0, dIn, near, w, h);
  // (near: window index to picture index)
  for (let p = 0; p < n; p++) if (near[p] >= 0) near[p] = gi(near[p]);
  const sdf = new Float32Array(n);
  for (let p = 0; p < n; p++)
    sdf[p] = isLine[p]
      ? -(Math.sqrt(dIn[p] >= INF ? 0 : dIn[p]) - 0.5)
      : Math.sqrt(dOut[p] >= INF ? 0 : dOut[p]) - 0.5;
  // smoothed (about 1.4 pixels): a line's pixel steps, and the wobble a photo leaves along its edges, round off into
  // its curve. A thin line (under about 3 pixels across) would thin away, so near one it never gets less deep than it
  // was (thick: within 2 pixels of a pixel 1.5 or more inside a line)
  const bl = sharpBlur(sharpBlur(sdf, w, h), w, h),
    deep = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (isLine[p] && dIn[p] >= 2.25) deep[p] = 1;
  const thick = sharpNear(deep, 2, w, h);
  // (and a small section, the sample's pinholes, never shrinks: smoothed into the lines round it, it was gone)
  for (let y = 0, p = 0; y < h; y++) {
    const r = (Y0 + y) * W + X0;
    for (let x = 0; x < w; x++, p++) {
      const l = labels[r + x];
      if (l >= 0 && comps[l] && comps[l].area < 60) sdf[p] = Math.max(sdf[p], bl[p]);
      else sdf[p] = thick[p] || bl[p] < sdf[p] ? bl[p] : sdf[p];
    }
  }
  _shF = { sdf: sdf, near: near, X0: X0, Y0: Y0, w: w, h: h, k: key, lab: labels, fill: null, base: null };
  return _shF;
}
// Felzenszwalb and Huttenlocher's exact distance transform over a w × h window (the feature: isLine === want),
// columns then rows, keeping (near) the nearest feature as a window index
function sharpEdt(isLine, want, out, near, w, h) {
  const INF = 1e20,
    m = Math.max(w, h),
    f = new Float64Array(m),
    d = new Float64Array(m),
    v = new Int32Array(m),
    z = new Float64Array(m + 1),
    arg = new Int32Array(m),
    colRow = near ? new Int32Array(w * h) : null;
  // columns
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = isLine[y * w + x] === want ? 0 : INF;
    sharp1d(f, h, d, v, z, arg);
    for (let y = 0; y < h; y++) {
      out[y * w + x] = d[y];
      if (colRow) colRow[y * w + x] = arg[y];
    }
  }
  // rows
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) f[x] = out[r + x];
    sharp1d(f, w, d, v, z, arg);
    for (let x = 0; x < w; x++) {
      out[r + x] = d[x];
      if (near) {
        const ax = arg[x];
        near[r + x] = f[ax] >= INF ? -1 : colRow[r + ax] * w + ax;
      }
    }
  }
}
function sharp1d(f, n, d, v, z, arg) {
  const INF = 1e20;
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    if (f[q] >= INF && f[v[k]] >= INF) continue;
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = f[v[k]] >= INF ? INF : dq * dq + f[v[k]];
    arg[q] = v[k];
  }
}
// a 1-4-6-4-1 blur each way (about 1 pixel)
function sharpBlur(a, w, h) {
  const n = w * h,
    t = new Float32Array(n),
    o = new Float32Array(n),
    Wm = w - 1,
    Hm = h - 1;
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const x1 = x > 0 ? x - 1 : 0,
        x2 = x > 1 ? x - 2 : 0,
        x3 = x < Wm ? x + 1 : Wm,
        x4 = x < Wm - 1 ? x + 2 : Wm;
      t[r + x] = (a[r + x2] + 4 * a[r + x1] + 6 * a[r + x] + 4 * a[r + x3] + a[r + x4]) * 0.0625;
    }
  }
  for (let y = 0; y < h; y++) {
    const r = y * w,
      u1 = (y > 0 ? y - 1 : 0) * w,
      u2 = (y > 1 ? y - 2 : 0) * w,
      d1 = (y < Hm ? y + 1 : Hm) * w,
      d2 = (y < Hm - 1 ? y + 2 : Hm) * w;
    for (let x = 0; x < w; x++)
      o[r + x] = (t[u2 + x] + 4 * t[u1 + x] + 6 * t[r + x] + 4 * t[d1 + x] + t[d2 + x]) * 0.0625;
  }
  return o;
}
// within rad pixels (a square) of a marked pixel
function sharpNear(m, rad, w, h) {
  const n = w * h,
    t = new Uint8Array(n),
    o = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (m[r + x]) last = x;
      if (x - last <= rad) t[r + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (m[r + x]) last = x;
      if (last - x <= rad) t[r + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (t[y * w + x]) last = y;
      if (y - last <= rad) o[y * w + x] = 1;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (t[y * w + x]) last = y;
      if (last - y <= rad) o[y * w + x] = 1;
    }
  }
  return o;
}
// the picture's colours over the field's window with its lines taken out (each line pixel the colour of its nearest
// section pixel). A line pixel drawn over in something else (Focus mode's mark on a section in a line, a code) keeps
// it, and no sharp line is drawn there (_ov)
function sharpFill(base, F, ink) {
  const d = base.data,
    w = F.w,
    h = F.h,
    o = new Uint8ClampedArray(w * h * 4),
    ov = new Uint8Array(w * h),
    near = F.near;
  for (let y = 0, p = 0; y < h; y++) {
    const r = (F.Y0 + y) * W + F.X0;
    for (let x = 0; x < w; x++, p++) {
      const g = r + x,
        j = g * 4,
        i = p * 4;
      o[i] = d[j];
      o[i + 1] = d[j + 1];
      o[i + 2] = d[j + 2];
      if (labels[g] !== -1) continue;
      if (Math.abs(d[j] - ink[0]) + Math.abs(d[j + 1] - ink[1]) + Math.abs(d[j + 2] - ink[2]) > 48) {
        ov[p] = 1;
        continue;
      }
      const q = near[p];
      if (q < 0) continue;
      const k = q * 4;
      o[i] = d[k];
      o[i + 1] = d[k + 1];
      o[i + 2] = d[k + 2];
    }
  }
  o._ov = ov;
  return o;
}
function sharpPaint(base, crop, ow, oh, ink) {
  const job = sharpJob(base, crop, ow, oh, ink);
  if (!job) return null;
  job.rows(0, oh);
  return job.out;
}
// (v323.1) the drawing as a job whose rows can be drawn a few at a time (sharpDraw, between frames: on an older iPad the
// whole of it took a third of a second, and a tap meanwhile waited)
function sharpJob(base, crop, ow, oh, ink) {
  if (!base || ow < 1 || oh < 1) return null;
  const F = sharpField(crop);
  if (!F) return null;
  // (the colours for this picture over this window, kept with the field while the picture stands)
  if (F.base !== base || !F.fill) {
    F.fill = sharpFill(base, F, ink);
    F.base = base;
  }
  const C0 = F.fill,
    OV = C0._ov,
    D = base.data,
    S = F.sdf,
    fw = F.w,
    X0 = F.X0,
    Y0 = F.Y0,
    out = new ImageData(ow, oh),
    od = out.data,
    x0 = crop[0],
    y0 = crop[1],
    sx = (crop[2] - crop[0]) / ow,
    sy = (crop[3] - crop[1]) / oh,
    // output pixels to a picture pixel: the line's soft edge one output pixel wide
    k = 1 / Math.max(1e-6, Math.min(sx, sy)),
    ir = ink[0],
    ig = ink[1],
    ib = ink[2],
    // (read within the window: the picture's last pixel, or the window's)
    Wm = Math.min(W, X0 + fw) - 1,
    Hm = Math.min(H, Y0 + F.h) - 1;
  const rows = function (oyA, oyB) {
    for (let oy = oyA, j = oyA * ow * 4; oy < oyB; oy++) {
      let fy = y0 + (oy + 0.5) * sy - 0.5;
      if (fy < Y0) fy = Y0;
      else if (fy > Hm) fy = Hm;
      const iy = fy | 0,
        ty = fy - iy,
        iy1 = iy < Hm ? iy + 1 : iy,
        r0 = (iy - Y0) * fw - X0,
        r1 = (iy1 - Y0) * fw - X0,
        g0 = iy * W,
        g1 = iy1 * W;
      for (let ox = 0; ox < ow; ox++, j += 4) {
        let fx = x0 + (ox + 0.5) * sx - 0.5;
        if (fx < X0) fx = X0;
        else if (fx > Wm) fx = Wm;
        const ix = fx | 0,
          tx = fx - ix,
          ix1 = ix < Wm ? ix + 1 : ix,
          p00 = r0 + ix,
          p01 = r0 + ix1,
          p10 = r1 + ix,
          p11 = r1 + ix1,
          w00 = (1 - tx) * (1 - ty),
          w01 = tx * (1 - ty),
          w10 = (1 - tx) * ty,
          w11 = tx * ty,
          s = S[p00] * w00 + S[p01] * w01 + S[p10] * w10 + S[p11] * w11;
        // (next to a mark drawn over a line: the picture as it is there, no sharp line)
        const over = OV[p00] | OV[p01] | OV[p10] | OV[p11];
        let a = 0.5 - s * k;
        a = a < 0 || over ? 0 : a > 1 ? 1 : a;
        let q00, q01, q10, q11, C;
        if (over) {
          C = D;
          q00 = (g0 + ix) * 4;
          q01 = (g0 + ix1) * 4;
          q10 = (g1 + ix) * 4;
          q11 = (g1 + ix1) * 4;
        } else {
          C = C0;
          q00 = p00 * 4;
          q01 = p01 * 4;
          q10 = p10 * 4;
          q11 = p11 * 4;
        }
        const r = C[q00] * w00 + C[q01] * w01 + C[q10] * w10 + C[q11] * w11,
          g = C[q00 + 1] * w00 + C[q01 + 1] * w01 + C[q10 + 1] * w10 + C[q11 + 1] * w11,
          b = C[q00 + 2] * w00 + C[q01 + 2] * w01 + C[q10 + 2] * w10 + C[q11 + 2] * w11;
        od[j] = r + (ir - r) * a;
        od[j + 1] = g + (ig - g) * a;
        od[j + 2] = b + (ib - b) * a;
        od[j + 3] = 255;
      }
    }
  };
  return { out: out, rows: rows };
}

/* Focus mode and Colour along: a canvas over the part of the picture on the screen, drawn sharp once a zoom or a move
   settles, where the picture is magnified enough for its steps to show (v323.1: Colour along too). It is placed in the
   picture's own frame and given the picture's transform (and its transition, Focus mode's glide), so it moves and
   scales with the picture as it's panned or pinched, and is drawn again sharp for the new view once that stops.
   Drawn again after the picture is: in Focus mode it goes at once (Done moves on to the next section). In Colour
   along, after the picture is drawn again in part (a tick, its ✓ fading, renderIncremental) it stays, a hole cleared
   in it over each part drawn and where a tick's colour spreads (sharpHole), so each change is seen at once, and it's
   drawn again once they stop; after the whole picture is drawn again (a marker's row opened) it goes at once and is
   drawn again a moment later. */
let _shEl = null,
  _shT = 0,
  _shBase = null,
  // the crop it shows (picture pixels), and until when a tick's colour spreads under it (sharpHole)
  _shCrop = null,
  _shWait = 0,
  // (the drawing under way, a few rows at a time: a newer one, or the copy hidden, stops it)
  _shGen = 0,
  _shJobT = 0;
function sharpOn() {
  return !!(
    sfmode === 'color' &&
    (focus ? !focusFin : true) &&
    cv &&
    sfView &&
    labels &&
    assignData &&
    !root.classList.contains('sfrev')
  );
}
function sharpHide() {
  _shGen++;
  clearTimeout(_shJobT);
  if (_shEl) _shEl.hidden = true;
  _shCrop = null;
}
// the picture moved, or (drawn) was drawn again, in whole (true) or in part ('part'): drawn sharp again once it settles
function sharpStale(drawn) {
  if (drawn) _shBase = null;
  clearTimeout(_shT);
  // (a drawing under way is of the picture or the view as they were)
  _shGen++;
  clearTimeout(_shJobT);
  if (!sharpOn()) return sharpHide();
  if (drawn && (focus || drawn !== 'part')) sharpHide();
  sharpPlace();
  _shT = setTimeout(sharpDraw, drawn === true && !focus ? 30 : drawn ? 300 : 420);
}
// the copy given the picture's place and transform (applyXform: as the picture moves)
function sharpPlace() {
  if (!_shEl || _shEl.hidden || !_shCrop || !cv) return;
  const DW = cv.offsetWidth,
    DH = cv.offsetHeight,
    c = _shCrop;
  if (!DW || !DH) return sharpHide();
  const s = _shEl.style;
  s.left = cv.offsetLeft + 'px';
  s.top = cv.offsetTop + 'px';
  s.width = ((c[2] - c[0]) * DW) / W + 'px';
  s.height = ((c[3] - c[1]) * DH) / H + 'px';
  s.transition = cv.style.transition;
  s.transform =
    (cv.style.transform || '') + ' translate(' + (c[0] * DW) / W + 'px,' + (c[1] * DH) / H + 'px)';
}
// the picture drawn again over [x0, y0, x1, y1] (picture pixels, renderIncremental), or (spread) a tick's colour about
// to spread there (spreadBegin, 40-render): the copy cleared there so it shows, and drawn again after
function sharpHole(x0, y0, x1, y1, spread) {
  if (spread) _shWait = performance.now() + TICK_SPREAD + 150;
  if (!_shEl || _shEl.hidden || !_shCrop) return;
  const c = _shCrop,
    kx = _shEl.width / (c[2] - c[0]),
    ky = _shEl.height / (c[3] - c[1]);
  _shEl
    .getContext('2d')
    .clearRect((x0 - c[0]) * kx - 2, (y0 - c[1]) * ky - 2, (x1 - x0) * kx + 4, (y1 - y0) * ky + 4);
}
function sharpDraw() {
  if (!sharpOn()) return sharpHide();
  // (a tick's colour still spreading: after it)
  if (_spr || performance.now() < _shWait) {
    _shT = setTimeout(sharpDraw, 60);
    return;
  }
  const host = cv.parentNode,
    r0 = cv.getBoundingClientRect(),
    vr = sfView.getBoundingClientRect(),
    dpr = Math.min(3, window.devicePixelRatio || 1),
    k = r0.width / W;
  // (no steps to see below about 1.3 screen pixels to a picture pixel)
  if (!host || !(k > 0) || k * dpr < 1.3) return sharpHide();
  // the part of the picture on the screen and 15% beyond it each way, so a pan shows sharp lines till it's drawn again
  const mx = vr.width * 0.15,
    my = vr.height * 0.15,
    L = Math.max(r0.left, vr.left - mx),
    T = Math.max(r0.top, vr.top - my),
    R = Math.min(r0.right, vr.right + mx),
    B = Math.min(r0.bottom, vr.bottom + my);
  if (R - L < 4 || B - T < 4) return sharpHide();
  const ky = r0.height / H,
    crop = [(L - r0.left) / k, (T - r0.top) / ky, (R - r0.left) / k, (B - r0.top) / ky];
  let ow = Math.round((R - L) * dpr),
    oh = Math.round((B - T) * dpr);
  // (at most about 4 million pixels)
  const cap = Math.sqrt(4e6 / (ow * oh));
  if (cap < 1) {
    ow = Math.max(1, Math.round(ow * cap));
    oh = Math.max(1, Math.round(oh * cap));
  }
  if (!_shBase) {
    try {
      _shBase = cv.getContext('2d').getImageData(0, 0, W, H);
    } catch (_) {
      return;
    }
  }
  const job = sharpJob(_shBase, crop, ow, oh, LINE);
  if (!job) return;
  const gen = ++_shGen;
  let y = 0;
  const step = function () {
    if (gen !== _shGen) return;
    if (!sharpOn()) return sharpHide();
    const t0 = performance.now();
    while (y < oh && performance.now() - t0 < 8) {
      const y1 = Math.min(oh, y + 16);
      job.rows(y, y1);
      y = y1;
    }
    if (y < oh) {
      _shJobT = setTimeout(step, 0);
      return;
    }
    sharpShow(job.out, crop, ow, oh, host);
  };
  step();
}
function sharpShow(im, crop, ow, oh, host) {
  if (!_shEl) {
    _shEl = document.createElement('canvas');
    _shEl.id = 'sfSharp';
    _shEl.className = 'sfsharp';
    _shEl.setAttribute('aria-hidden', 'true');
  }
  // (just over the picture, in its frame: under the codes' highlight, the ring, the outline and the bars)
  if (_shEl.parentNode !== host || _shEl.previousSibling !== cv) host.insertBefore(_shEl, cv.nextSibling);
  _shEl.width = ow;
  _shEl.height = oh;
  _shEl.getContext('2d').putImageData(im, 0, 0);
  _shCrop = crop;
  _shEl.hidden = false;
  sharpPlace();
}
