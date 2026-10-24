/* ---- (v323) Sharp outlines when magnified: Focus mode's zoom and the PDF's close-ups ----
   The guide is drawn one pixel per pixel of the picture (921 across for the sample), and magnified its outlines show
   those pixels as steps. Here the outlines are drawn again at the size they're shown: a signed distance field of the
   line pixels (the exact distance from each pixel to the nearest pixel of the other kind, labels -1 being the lines),
   smoothed a touch, is read between pixels and its zero is the line's edge, drawn with a pixel of soft edge. Under it,
   the colours are the picture's own with the lines taken out (each line pixel given the colour of the section nearest
   it), read between pixels too. So the lines keep their width and place, and their steps become curves; the colours,
   the codes and the shading are the picture's, magnified as before.
   sharpField() is worked out once for the sections (about 0.1 s for the sample) and kept while they stand;
   sharpPaint(base, crop, ow, oh, ink) draws the crop [x0, y0, x1, y1] of the picture (in picture pixels) at ow × oh
   from base (an ImageData of the picture, W × H) into a new ImageData; ink: the lines' colour. */
let _shF = null;
// the field for these sections: { sdf: Float32Array (picture pixels, negative inside a line), near: Int32Array (each
// line pixel's nearest pixel not a line, or -1), k: the sections it was made for }
function sharpField() {
  if (!labels || !W || !H) return null;
  const key = labels.length + ':' + W + 'x' + H + ':' + (typeof labelsSig === 'function' ? labelsSig() : '');
  if (_shF && _shF.k === key && _shF.lab === labels) return _shF;
  const n = W * H,
    INF = 1e20,
    // squared distances to the nearest line pixel (for the others), and to the nearest pixel not a line (for lines)
    dOut = new Float32Array(n),
    dIn = new Float32Array(n),
    near = new Int32Array(n).fill(-1);
  sharpEdt(
    function (p) {
      return labels[p] === -1;
    },
    dOut,
    null,
  );
  sharpEdt(
    function (p) {
      return labels[p] !== -1;
    },
    dIn,
    near,
  );
  const sdf = new Float32Array(n);
  for (let p = 0; p < n; p++)
    sdf[p] =
      labels[p] === -1
        ? -(Math.sqrt(dIn[p] >= INF ? 0 : dIn[p]) - 0.5)
        : Math.sqrt(dOut[p] >= INF ? 0 : dOut[p]) - 0.5;
  // smoothed (about 1.4 pixels): a line's pixel steps, and the wobble a photo leaves along its edges, round off into
  // its curve. A thin line (under about 3 pixels across) would thin away, so near one it never gets less deep than it
  // was (thick: within 2 pixels of a pixel 1.5 or more inside a line)
  const bl = sharpBlur(sharpBlur(sdf)),
    deep = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (labels[p] === -1 && dIn[p] >= 2.25) deep[p] = 1;
  const thick = sharpNear(deep, 2);
  // (and a small section, the sample's pinholes, never shrinks: smoothed into the lines round it, it was gone)
  for (let p = 0; p < n; p++) {
    const l = labels[p];
    if (l >= 0 && comps[l] && comps[l].area < 60) sdf[p] = Math.max(sdf[p], bl[p]);
    else sdf[p] = thick[p] || bl[p] < sdf[p] ? bl[p] : sdf[p];
  }
  _shF = { sdf: sdf, near: near, k: key, lab: labels };
  return _shF;
}
// Felzenszwalb and Huttenlocher's exact distance transform, columns then rows, keeping (near) the nearest feature
function sharpEdt(isF, out, near) {
  const INF = 1e20,
    m = Math.max(W, H),
    f = new Float64Array(m),
    d = new Float64Array(m),
    v = new Int32Array(m),
    z = new Float64Array(m + 1),
    arg = new Int32Array(m),
    colRow = near ? new Int32Array(W * H) : null;
  // columns
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = isF(y * W + x) ? 0 : INF;
    sharp1d(f, H, d, v, z, arg);
    for (let y = 0; y < H; y++) {
      out[y * W + x] = d[y];
      if (colRow) colRow[y * W + x] = arg[y];
    }
  }
  // rows
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) f[x] = out[r + x];
    sharp1d(f, W, d, v, z, arg);
    for (let x = 0; x < W; x++) {
      out[r + x] = d[x];
      if (near) {
        const ax = arg[x];
        near[r + x] = f[ax] >= INF ? -1 : colRow[r + ax] * W + ax;
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
function sharpBlur(a) {
  const n = W * H,
    t = new Float32Array(n),
    o = new Float32Array(n),
    Wm = W - 1,
    Hm = H - 1;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const x1 = x > 0 ? x - 1 : 0,
        x2 = x > 1 ? x - 2 : 0,
        x3 = x < Wm ? x + 1 : Wm,
        x4 = x < Wm - 1 ? x + 2 : Wm;
      t[r + x] = (a[r + x2] + 4 * a[r + x1] + 6 * a[r + x] + 4 * a[r + x3] + a[r + x4]) * 0.0625;
    }
  }
  for (let y = 0; y < H; y++) {
    const r = y * W,
      u1 = (y > 0 ? y - 1 : 0) * W,
      u2 = (y > 1 ? y - 2 : 0) * W,
      d1 = (y < Hm ? y + 1 : Hm) * W,
      d2 = (y < Hm - 1 ? y + 2 : Hm) * W;
    for (let x = 0; x < W; x++)
      o[r + x] = (t[u2 + x] + 4 * t[u1 + x] + 6 * t[r + x] + 4 * t[d1 + x] + t[d2 + x]) * 0.0625;
  }
  return o;
}
// within rad pixels (a square) of a marked pixel
function sharpNear(m, rad) {
  const n = W * H,
    t = new Uint8Array(n),
    o = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    const r = y * W;
    let last = -1e9;
    for (let x = 0; x < W; x++) {
      if (m[r + x]) last = x;
      if (x - last <= rad) t[r + x] = 1;
    }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) {
      if (m[r + x]) last = x;
      if (last - x <= rad) t[r + x] = 1;
    }
  }
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++) {
      if (t[y * W + x]) last = y;
      if (y - last <= rad) o[y * W + x] = 1;
    }
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) {
      if (t[y * W + x]) last = y;
      if (last - y <= rad) o[y * W + x] = 1;
    }
  }
  return o;
}
// the picture's colours with its lines taken out (each line pixel the colour of its nearest section pixel). A line
// pixel drawn over in something else (Focus mode's mark on a section in a line, a code) keeps it, and no sharp line is
// drawn there (_ov)
function sharpFill(base, F, ink) {
  const d = base.data,
    n = W * H,
    o = new Uint8ClampedArray(d.length),
    ov = new Uint8Array(n),
    near = F.near;
  o.set(d);
  for (let p = 0; p < n; p++) {
    if (labels[p] !== -1) continue;
    const j = p * 4;
    if (Math.abs(d[j] - ink[0]) + Math.abs(d[j + 1] - ink[1]) + Math.abs(d[j + 2] - ink[2]) > 48) {
      ov[p] = 1;
      continue;
    }
    const q = near[p];
    if (q < 0) continue;
    const k = q * 4;
    o[j] = d[k];
    o[j + 1] = d[k + 1];
    o[j + 2] = d[k + 2];
  }
  o._ov = ov;
  o._d = d;
  return o;
}
function sharpPaint(base, crop, ow, oh, ink, fill) {
  const F = sharpField();
  if (!F || !base || ow < 1 || oh < 1) return null;
  const C0 = fill || sharpFill(base, F, ink),
    OV = C0._ov,
    S = F.sdf,
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
    Wm = W - 1,
    Hm = H - 1;
  for (let oy = 0, j = 0; oy < oh; oy++) {
    let fy = y0 + (oy + 0.5) * sy - 0.5;
    if (fy < 0) fy = 0;
    else if (fy > Hm) fy = Hm;
    const iy = fy | 0,
      ty = fy - iy,
      iy1 = iy < Hm ? iy + 1 : iy,
      r0 = iy * W,
      r1 = iy1 * W;
    for (let ox = 0; ox < ow; ox++, j += 4) {
      let fx = x0 + (ox + 0.5) * sx - 0.5;
      if (fx < 0) fx = 0;
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
      const over = OV && OV[p00] | OV[p01] | OV[p10] | OV[p11],
        C = over ? C0._d : C0;
      let a = 0.5 - s * k;
      a = a < 0 || over ? 0 : a > 1 ? 1 : a;
      const q00 = p00 * 4,
        q01 = p01 * 4,
        q10 = p10 * 4,
        q11 = p11 * 4,
        r = C[q00] * w00 + C[q01] * w01 + C[q10] * w10 + C[q11] * w11,
        g = C[q00 + 1] * w00 + C[q01 + 1] * w01 + C[q10 + 1] * w10 + C[q11 + 1] * w11,
        b = C[q00 + 2] * w00 + C[q01 + 2] * w01 + C[q10 + 2] * w10 + C[q11 + 2] * w11;
      od[j] = r + (ir - r) * a;
      od[j + 1] = g + (ig - g) * a;
      od[j + 2] = b + (ib - b) * a;
      od[j + 3] = 255;
    }
  }
  return out;
}

/* Focus mode: a canvas over the part of the picture on the screen, drawn sharp once a zoom or a move settles (and
   hidden while the picture moves). Only where the picture is magnified enough for its steps to show. */
let _shEl = null,
  _shT = 0,
  _shBase = null;
function sharpOn() {
  return !!(
    focus &&
    !focusFin &&
    sfmode === 'color' &&
    cv &&
    sfView &&
    labels &&
    assignData &&
    !root.classList.contains('sfrev')
  );
}
// the picture moved or was drawn again: the sharp copy goes until it settles
function sharpStale(drawn) {
  if (drawn) _shBase = null;
  if (_shEl) _shEl.style.visibility = 'hidden';
  clearTimeout(_shT);
  if (!sharpOn()) {
    if (_shEl) _shEl.hidden = true;
    return;
  }
  _shT = setTimeout(sharpDraw, 420);
}
function sharpDraw() {
  if (!sharpOn()) {
    if (_shEl) _shEl.hidden = true;
    return;
  }
  const host = picEl || sfView,
    r0 = cv.getBoundingClientRect(),
    vr = sfView.getBoundingClientRect(),
    dpr = Math.min(3, window.devicePixelRatio || 1),
    k = r0.width / W;
  // (no steps to see below about 1.3 screen pixels to a picture pixel)
  if (!(k > 0) || k * dpr < 1.3) {
    if (_shEl) _shEl.hidden = true;
    return;
  }
  // the part of the picture on the screen
  const L = Math.max(r0.left, vr.left),
    T = Math.max(r0.top, vr.top),
    R = Math.min(r0.right, vr.right),
    B = Math.min(r0.bottom, vr.bottom);
  if (R - L < 4 || B - T < 4) return;
  const crop = [(L - r0.left) / k, (T - r0.top) / k, (R - r0.left) / k, (B - r0.top) / k];
  let ow = Math.round((R - L) * dpr),
    oh = Math.round((B - T) * dpr);
  // (at most about 4 million pixels)
  const cap = Math.sqrt(4e6 / (ow * oh));
  if (cap < 1) {
    ow = Math.round(ow * cap);
    oh = Math.round(oh * cap);
  }
  if (!_shBase) {
    try {
      _shBase = cv.getContext('2d').getImageData(0, 0, W, H);
    } catch (_) {
      return;
    }
    _shBase._fill = null;
  }
  const F = sharpField();
  if (!F) return;
  if (!_shBase._fill) _shBase._fill = sharpFill(_shBase, F, LINE);
  const im = sharpPaint(_shBase, crop, ow, oh, LINE, _shBase._fill);
  if (!im) return;
  if (!_shEl) {
    _shEl = document.createElement('canvas');
    _shEl.id = 'sfSharp';
    _shEl.className = 'sfsharp';
    _shEl.setAttribute('aria-hidden', 'true');
  }
  // (just over the picture: under the ring, the outline and the bars)
  if (_shEl.parentNode !== host) host.insertBefore(_shEl, cv.nextSibling);
  _shEl.width = ow;
  _shEl.height = oh;
  _shEl.getContext('2d').putImageData(im, 0, 0);
  const hr = host.getBoundingClientRect(),
    q = picK();
  _shEl.style.left = (L - hr.left) / q + 'px';
  _shEl.style.top = (T - hr.top) / q + 'px';
  _shEl.style.width = (R - L) / q + 'px';
  _shEl.style.height = (B - T) / q + 'px';
  _shEl.hidden = false;
  _shEl.style.visibility = '';
}
