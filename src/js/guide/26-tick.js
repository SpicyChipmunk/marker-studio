/* ---- (v328, decisions 11.1-11.6) Tick off from a photo: lining a later photo up with the guide's picture ----
    A photo of the page, coloured some more on paper since, is lined up with the picture the guide was made from (or,
    for a printout, the page as printed: Part D), and the sections that have changed from plain paper are offered as
    done (tickRead). The lining up follows the trial on the author's 8 photos (scratchpad ov/, OpenCV there): every
    shot lined up to a median of 0 px and 1 px at the 90th percentile, over the whole page, the hard shadow included.
    Plain JS here, in the worker (JOBS 'tick', 03-jobs) or on the page:
      1. both pictures in grey at half the guide's size, and their ink: the dark lines against the paper round them
         (tkInk: a marker's fill is far lighter than the ink, so it's left out, and the lines are what's lined up);
      2. the turn, by trying the four (the best overlap of ink at 1/8 size);
      3. a homography by ECC (Evangelidis and Psarakis, 2008, as OpenCV's findTransformECC) at 1/8 then 1/4 size;
      4. the paper's own bends: a grid of 4 x 6 (6 x 4 when wide) translations, one per tile, by ECC at half size,
         blended between the tiles' middles.
    Not lined up when the ink agrees too little (TICK_CC): another page, or too little of it in the photo. */
const TICK_CC = 0.45,
  // (the coarsest picture lined up: no fewer pixels than this across its short side)
  TICK_COARSE = 100,
  // (the tiles: how far each may move from the homography, of the guide's long side, and how well they must agree)
  TICK_TILE_MAX = 0.012,
  TICK_TILE_CC = 0.3;
// grey (0-255) of RGBA d, w x h, area-averaged down by f (an integer)
function tkGrey(d, w, h, f) {
  const ow = Math.max(1, Math.floor(w / f)),
    oh = Math.max(1, Math.floor(h / f)),
    o = new Float32Array(ow * oh),
    k = 1 / (f * f);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      let s = 0;
      for (let j = 0; j < f; j++) {
        let i = ((y * f + j) * w + x * f) * 4;
        for (let q = 0; q < f; q++, i += 4) s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      }
      o[y * ow + x] = s * k;
    }
  return { a: o, w: ow, h: oh };
}
// a Float32 picture area-averaged down by f
function tkDown(p, f) {
  const ow = Math.max(1, Math.floor(p.w / f)),
    oh = Math.max(1, Math.floor(p.h / f)),
    o = new Float32Array(ow * oh),
    k = 1 / (f * f),
    a = p.a,
    w = p.w;
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      let s = 0;
      for (let j = 0; j < f; j++) {
        const r = (y * f + j) * w + x * f;
        for (let q = 0; q < f; q++) s += a[r + q];
      }
      o[y * ow + x] = s * k;
    }
  return { a: o, w: ow, h: oh };
}
// a box blur of radius r along rows then columns (edges held), in place
function tkBox(a, w, h, r, t) {
  if (r < 1) return;
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = a[o] * (r + 1);
    for (let x = 1; x <= r; x++) s += a[o + Math.min(x, w - 1)];
    for (let x = 0; x < w; x++) {
      t[x] = s / n;
      s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
    }
    for (let x = 0; x < w; x++) a[o + x] = t[x];
  }
  for (let x = 0; x < w; x++) {
    let s = a[x] * (r + 1);
    for (let y = 1; y <= r; y++) s += a[Math.min(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      t[y] = s / n;
      s += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x];
    }
    for (let y = 0; y < h; y++) a[y * w + x] = t[y];
  }
}
// a Gaussian blur of sigma s, as three box blurs (a copy)
function tkBlur(p, s) {
  const a = Float32Array.from(p.a);
  if (s > 0.3) {
    const t = new Float32Array(Math.max(p.w, p.h)),
      wi = Math.sqrt((12 * s * s) / 3 + 1),
      r = Math.max(1, Math.round((wi - 1) / 2));
    for (let k = 0; k < 3; k++) tkBox(a, p.w, p.h, r, t);
  }
  return { a: a, w: p.w, h: p.h };
}
// the greatest over a square of radius r (a dilation), along rows then columns
function tkMax(p, r) {
  const w = p.w,
    h = p.h,
    a = Float32Array.from(p.a),
    t = new Float32Array(Math.max(w, h));
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let m = -1e9;
      for (let q = Math.max(0, x - r), e = Math.min(w - 1, x + r); q <= e; q++)
        if (p.a[o + q] > m) m = p.a[o + q];
      t[x] = m;
    }
    for (let x = 0; x < w; x++) a[o + x] = t[x];
  }
  const b = Float32Array.from(a);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = -1e9;
      for (let q = Math.max(0, y - r), e = Math.min(h - 1, y + r); q <= e; q++)
        if (a[q * w + x] > m) m = a[q * w + x];
      t[y] = m;
    }
    for (let y = 0; y < h; y++) b[y * w + x] = t[y];
  }
  return { a: b, w: w, h: h };
}
// the ink: how much darker than the paper round it (the paper: the lightest nearby, smoothed), 0-1, and nothing
// lighter than 0.55 of the paper (a marker's fill is far lighter than ink). r and s in the picture's pixels
function tkInk(g, r, s) {
  const bg = tkBlur(tkMax(g, r), s),
    o = new Float32Array(g.a.length);
  for (let i = 0; i < o.length; i++) {
    const b = bg.a[i],
      v = g.a[i];
    // (a soft step from 0.7 to 0.55 of the paper, not a cut at 0.55: a 2 px line halved by the grid read as 0.56 and
    // was gone, so a photo's ink and the guide's disagreed by where their lines fell on the pixels)
    o[i] =
      Math.max(0, Math.min(1, (0.7 * b - v) / (0.15 * Math.max(b, 1)))) *
      Math.max(0, Math.min(1, ((b - v) / Math.max(b, 1)) * 2.5));
  }
  return { a: o, w: g.w, h: g.h };
}
// turned a quarter k times anticlockwise (as numpy's rot90): RGBA when ch is 4, else one value a pixel
function tkRot(a, w, h, k, ch) {
  k = ((k % 4) + 4) % 4;
  if (!k) return { a: a, w: w, h: h };
  const ow = k === 2 ? w : h,
    oh = k === 2 ? h : w,
    o = new a.constructor(a.length);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      // (where it came from)
      const sx = k === 1 ? w - 1 - y : k === 2 ? w - 1 - x : y,
        sy = k === 1 ? x : k === 2 ? h - 1 - y : h - 1 - x,
        si = sy * w + sx,
        di = y * ow + x;
      if (ch === 4) {
        o[di * 4] = a[si * 4];
        o[di * 4 + 1] = a[si * 4 + 1];
        o[di * 4 + 2] = a[si * 4 + 2];
        o[di * 4 + 3] = a[si * 4 + 3];
      } else o[di] = a[si];
    }
  return { a: o, w: ow, h: oh };
}
// bilinear, the edge held
function tkAt(a, w, h, x, y) {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0,
    y0 = y | 0,
    x1 = x0 < w - 1 ? x0 + 1 : x0,
    y1 = y0 < h - 1 ? y0 + 1 : y0,
    fx = x - x0,
    fy = y - y0,
    r0 = y0 * w,
    r1 = y1 * w;
  return (
    (a[r0 + x0] * (1 - fx) + a[r0 + x1] * fx) * (1 - fy) + (a[r1 + x0] * (1 - fx) + a[r1 + x1] * fx) * fy
  );
}
// resized to ow x oh, bilinear (pixel centres kept in place)
function tkSize(p, ow, oh) {
  const o = new Float32Array(ow * oh),
    kx = p.w / ow,
    ky = p.h / oh;
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++)
      o[y * ow + x] = tkAt(p.a, p.w, p.h, (x + 0.5) * kx - 0.5, (y + 0.5) * ky - 0.5);
  return { a: o, w: ow, h: oh };
}
// how alike two pictures of one size are: their correlation, -1 to 1
function tkCorr(a, b) {
  const n = a.length;
  let ma = 0,
    mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let s = 0,
    sa = 0,
    sb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma,
      y = b[i] - mb;
    s += x * y;
    sa += x * x;
    sb += y * y;
  }
  return s / (Math.sqrt(sa * sb) + 1e-12);
}
// the inverse of a small n x n matrix (row-major); null when it's singular
function tkInv(M, n) {
  const A = Float64Array.from(M),
    I = new Float64Array(n * n);
  for (let i = 0; i < n; i++) I[i * n + i] = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
    const v = A[p * n + c];
    if (!(Math.abs(v) > 1e-300)) return null;
    if (p !== c)
      for (let k = 0; k < n; k++) {
        let t = A[c * n + k];
        A[c * n + k] = A[p * n + k];
        A[p * n + k] = t;
        t = I[c * n + k];
        I[c * n + k] = I[p * n + k];
        I[p * n + k] = t;
      }
    for (let k = 0; k < n; k++) {
      A[c * n + k] /= v;
      I[c * n + k] /= v;
    }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r * n + c];
      if (!f) continue;
      for (let k = 0; k < n; k++) {
        A[r * n + k] -= f * A[c * n + k];
        I[r * n + k] -= f * I[c * n + k];
      }
    }
  }
  return I;
}
/* ECC (as OpenCV's findTransformECC): the warp that best lines the input picture I up with the template T, in T's
   pixels: T(x) ~ I(warp(x)). hom: a homography (p: 9 numbers, row-major, p[8] 1), else a translation (p: [tx, ty]).
   T and I blurred already. Returns { cc, p } (cc the correlation reached), or null when it can't (no overlap, or
   the pictures don't correlate). */
function tkECC(T, I, hom, p0, iters, eps) {
  const w = T.w,
    h = T.h,
    n = w * h,
    np = hom ? 8 : 2,
    p = Float64Array.from(p0),
    gx = new Float32Array(I.w * I.h),
    gy = new Float32Array(I.w * I.h),
    Iw = new Float32Array(n),
    Gx = new Float32Array(n),
    Gy = new Float32Array(n),
    ok = new Uint8Array(n),
    J = new Float32Array(n * np),
    Hs = new Float64Array(np * np),
    ip = new Float64Array(np),
    tp = new Float64Array(np),
    ep = new Float64Array(np);
  // the input's gradients (central differences)
  for (let y = 0; y < I.h; y++)
    for (let x = 0; x < I.w; x++) {
      const i = y * I.w + x;
      gx[i] = (I.a[x < I.w - 1 ? i + 1 : i] - I.a[x > 0 ? i - 1 : i]) * (x > 0 && x < I.w - 1 ? 0.5 : 1);
      gy[i] = (I.a[y < I.h - 1 ? i + I.w : i] - I.a[y > 0 ? i - I.w : i]) * (y > 0 && y < I.h - 1 ? 0.5 : 1);
    }
  let rho = -1,
    last = -2;
  for (let it = 0; it < iters; it++) {
    // the input warped onto the template, with its gradients, and the template's pixels that land inside it
    let m = 0,
      sI = 0,
      sT = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let u, v;
        if (hom) {
          const d = p[6] * x + p[7] * y + 1;
          u = (p[0] * x + p[1] * y + p[2]) / d;
          v = (p[3] * x + p[4] * y + p[5]) / d;
        } else {
          u = x + p[0];
          v = y + p[1];
        }
        if (!(u >= 0 && v >= 0 && u <= I.w - 1 && v <= I.h - 1)) {
          ok[i] = 0;
          continue;
        }
        ok[i] = 1;
        m++;
        Iw[i] = tkAt(I.a, I.w, I.h, u, v);
        Gx[i] = tkAt(gx, I.w, I.h, u, v);
        Gy[i] = tkAt(gy, I.w, I.h, u, v);
        sI += Iw[i];
        sT += T.a[i];
      }
    if (m < np * 20) return null;
    const mI = sI / m,
      mT = sT / m;
    // the Jacobian, the Hessian (J'J) and the projections
    Hs.fill(0);
    ip.fill(0);
    tp.fill(0);
    let nI = 0,
      nT = 0,
      cor = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!ok[i]) continue;
        const iv = Iw[i] - mI,
          tv = T.a[i] - mT,
          o = i * np;
        if (hom) {
          const dn = 1 / (p[6] * x + p[7] * y + 1),
            hx = -(p[0] * x + p[1] * y + p[2]) * dn,
            hy = -(p[3] * x + p[4] * y + p[5]) * dn,
            a = Gx[i] * dn,
            b = Gy[i] * dn,
            c = hx * a + hy * b;
          J[o] = a * x;
          J[o + 1] = a * y;
          J[o + 2] = a;
          J[o + 3] = b * x;
          J[o + 4] = b * y;
          J[o + 5] = b;
          J[o + 6] = c * x;
          J[o + 7] = c * y;
        } else {
          J[o] = Gx[i];
          J[o + 1] = Gy[i];
        }
        for (let r = 0; r < np; r++) {
          const jr = J[o + r];
          ip[r] += jr * iv;
          tp[r] += jr * tv;
          for (let c = r; c < np; c++) Hs[r * np + c] += jr * J[o + c];
        }
        nI += iv * iv;
        nT += tv * tv;
        cor += iv * tv;
      }
    for (let r = 0; r < np; r++) for (let c = 0; c < r; c++) Hs[r * np + c] = Hs[c * np + r];
    rho = cor / (Math.sqrt(nI * nT) + 1e-12);
    if (Math.abs(rho - last) < eps) break;
    last = rho;
    const Hi = tkInv(Hs, np);
    if (!Hi) return null;
    // (lambda: as findTransformECC)
    let ln = nI,
      ld = cor;
    for (let r = 0; r < np; r++) {
      let s = 0;
      for (let c = 0; c < np; c++) s += Hi[r * np + c] * ip[c];
      ln -= ip[r] * s;
      ld -= tp[r] * s;
    }
    if (!(ld > 0)) return null;
    const lam = ln / ld;
    // the error's projection, and the step
    ep.fill(0);
    for (let i = 0; i < n; i++) {
      if (!ok[i]) continue;
      const e = lam * (T.a[i] - mT) - (Iw[i] - mI),
        o = i * np;
      for (let r = 0; r < np; r++) ep[r] += J[o + r] * e;
    }
    for (let r = 0; r < np; r++) {
      let s = 0;
      for (let c = 0; c < np; c++) s += Hi[r * np + c] * ep[c];
      p[r] += s;
    }
  }
  return { cc: rho, p: p };
}
// a homography for pictures k times the size (k < 1 smaller): S H S^-1
function tkHScale(p, k) {
  return [p[0], p[1], p[2] * k, p[3], p[4], p[5] * k, p[6] / k, p[7] / k, 1];
}
/* The photo lined up with the reference. ref: RGBA, W x H (the guide's picture, or the page as printed); pho: RGBA,
   pw x ph (the photo's page, straightened, about the guide's size). Returns { ok, cc, rot, h: the homography (W x H
   to the photo turned and sized to W x H), nx, ny, tx, ty: the tiles' shifts (px) } or { ok: false, why }. */
function tickAlign(ref, W, H, pho, pw, ph) {
  const f = 2,
    w2 = Math.floor(W / f),
    h2 = Math.floor(H / f),
    // (the ink's paper: the lightest within about 4 px at half the guide's size, smoothed as much: the trial's 15 px
    // square and 15 at full size)
    R = Math.max(2, Math.round(Math.max(W, H) / 600)),
    gR = tkGrey(ref, W, H, f),
    iR = tkInk(gR, R, R * 1.07),
    // the photo in grey at its own half size
    pf = Math.max(1, Math.round(Math.max(pw, ph) / Math.max(w2, h2))),
    gP0 = tkGrey(pho, pw, ph, pf),
    // (the coarsest: 1/8 of the guide, or less coarse for a small guide, at least TICK_COARSE across its short side)
    dc = Math.max(1, Math.min(4, Math.floor(Math.min(w2, h2) / TICK_COARSE))),
    a8 = tkBlur(tkDown(iR, dc), 2);
  let best = null;
  for (let k = 0; k < 4; k++) {
    const r = tkRot(gP0.a, gP0.w, gP0.h, k, 1),
      g = tkSize(r, w2, h2),
      ink = tkInk(g, R, R * 1.07),
      b8 = tkBlur(tkDown(ink, dc), 2),
      c = tkCorr(a8.a, b8.a);
    if (!best || c > best.c) best = { c: c, k: k, ink: ink };
  }
  const iP = best.ink;
  // the homography, at 1/8 then 1/4 of the guide's size (iR and iP are at 1/2)
  let Hm = [1, 0, 0, 0, 1, 0, 0, 0, 1],
    cc = -1;
  (dc > 1 ? [dc, Math.max(1, dc >> 1)] : [1]).forEach(function (d, j) {
    const A = tkBlur(tkDown(iR, d), 1.5),
      B = tkBlur(tkDown(iP, d), 1.5),
      k = 1 / (f * d),
      r = tkECC(A, B, true, tkHScale(Hm, k), j ? 60 : 120, 1e-5);
    if (r) {
      Hm = tkHScale(r.p, 1 / k);
      cc = r.cc;
    }
  });
  if (!(cc >= TICK_CC)) return { ok: false, why: 'match', cc: cc, rot: best.k };
  // the photo's ink warped by it at half size, and the tiles' shifts there
  const Hh = tkHScale(Hm, 1 / f),
    iPw = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++) {
      const d = Hh[6] * x + Hh[7] * y + 1;
      iPw[y * w2 + x] = tkAt(
        iP.a,
        iP.w,
        iP.h,
        (Hh[0] * x + Hh[1] * y + Hh[2]) / d,
        (Hh[3] * x + Hh[4] * y + Hh[5]) / d,
      );
    }
  const nx = H > W ? 4 : 6,
    ny = H > W ? 6 : 4,
    tx = new Float32Array(nx * ny),
    ty = new Float32Array(nx * ny),
    lim = (TICK_TILE_MAX * Math.max(W, H)) / f;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x0 = Math.floor((i * w2) / nx),
        x1 = Math.floor(((i + 1) * w2) / nx),
        y0 = Math.floor((j * h2) / ny),
        y1 = Math.floor(((j + 1) * h2) / ny),
        tw = x1 - x0,
        th = y1 - y0,
        a = new Float32Array(tw * th),
        b = new Float32Array(tw * th);
      let s = 0;
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          a[y * tw + x] = iR.a[(y0 + y) * w2 + x0 + x];
          b[y * tw + x] = iPw[(y0 + y) * w2 + x0 + x];
          s += a[y * tw + x];
        }
      if (s < 0.01 * tw * th) continue;
      const r = tkECC(
        tkBlur({ a: a, w: tw, h: th }, 1.5),
        tkBlur({ a: b, w: tw, h: th }, 1.5),
        false,
        [0, 0],
        100,
        1e-5,
      );
      if (r && r.cc > TICK_TILE_CC && Math.hypot(r.p[0], r.p[1]) < lim) {
        tx[j * nx + i] = r.p[0] * f;
        ty[j * nx + i] = r.p[1] * f;
      }
    }
  return { ok: true, cc: cc, c0: best.c, rot: best.k, h: Hm, nx: nx, ny: ny, tx: tx, ty: ty };
}
// a tile shift at (x, y) of the guide's picture: bilinear between the tiles' middles, held past them
function tkShift(al, W, H, x, y, t) {
  const gx = (x / W) * al.nx - 0.5,
    gy = (y / H) * al.ny - 0.5;
  return tkAt(t, al.nx, al.ny, gx, gy);
}
// the photo drawn lined up with the reference: RGBA, W x H
// (v328 review) exactly as tickAlign sampled the photo: the guide at half size, the photo in grey at its own size
// divided by pf (its last pf - 1 rows and columns left out, where the turn puts them), turned, and sized to the
// guide's half: drawn as if the turned photo filled W x H, every pixel was 0.5-1 px off for an odd size or a turn.
// A pixel whose place is outside the photo is left transparent (alpha 0): tickRead doesn't read it.
function tickWarp(al, W, H, pho, pw, ph) {
  const f = 2,
    w2 = Math.floor(W / f),
    h2 = Math.floor(H / f),
    pf = Math.max(1, Math.round(Math.max(pw, ph) / Math.max(w2, h2))),
    gw0 = Math.max(1, Math.floor(pw / pf)),
    gh0 = Math.max(1, Math.floor(ph / pf)),
    rx = pw - pf * gw0,
    ry = ph - pf * gh0,
    k = al.rot,
    gw = k % 2 ? gh0 : gw0,
    gh = k % 2 ? gw0 : gh0,
    offU = k === 2 ? rx : k === 3 ? ry : 0,
    offV = k === 1 ? rx : k === 2 ? ry : 0,
    sx = (pf * gw) / w2,
    sy = (pf * gh) / h2,
    p = tkHScale(al.h, 1 / f),
    r = tkRot(pho, pw, ph, k, 4),
    o = new Uint8ClampedArray(W * H * 4),
    rw = r.w,
    rh = r.h,
    a = r.a;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xs = x + tkShift(al, W, H, x, y, al.tx),
        ys = y + tkShift(al, W, H, x, y, al.ty),
        xh = (xs + 0.5) / f - 0.5,
        yh = (ys + 0.5) / f - 0.5,
        d = p[6] * xh + p[7] * yh + 1,
        di = (y * W + x) * 4;
      let u = sx * ((p[0] * xh + p[1] * yh + p[2]) / d + 0.5) - 0.5 + offU,
        v = sy * ((p[3] * xh + p[4] * yh + p[5]) / d + 0.5) - 0.5 + offV;
      if (!(u > -0.5 && v > -0.5 && u < rw - 0.5 && v < rh - 0.5)) continue;
      if (u < 0) u = 0;
      else if (u > rw - 1) u = rw - 1;
      if (v < 0) v = 0;
      else if (v > rh - 1) v = rh - 1;
      const x0 = u | 0,
        y0 = v | 0,
        x1 = x0 < rw - 1 ? x0 + 1 : x0,
        y1 = y0 < rh - 1 ? y0 + 1 : y0,
        fx = u - x0,
        fy = v - y0,
        i00 = (y0 * rw + x0) * 4,
        i01 = (y0 * rw + x1) * 4,
        i10 = (y1 * rw + x0) * 4,
        i11 = (y1 * rw + x1) * 4;
      for (let c = 0; c < 3; c++)
        o[di + c] =
          (a[i00 + c] * (1 - fx) + a[i01 + c] * fx) * (1 - fy) +
          (a[i10 + c] * (1 - fx) + a[i11 + c] * fx) * fy;
      o[di + 3] = 255;
    }
  return o;
}
/* ---- (v328, 11.2-11.5) the reading: which sections have been coloured since ----
    ref and pho (lined up: tickWarp) RGBA, W x H; labels the guide's sections. Each section's middle (TICK_IN px in
    from its lines) is compared, in CIELAB, after the light's difference between the two pictures is taken out (the
    change smoothed over the middles that haven't changed, TICK_LIGHT across, again and again without those far from
    it; then again, more closely, TICK_LIGHT2, without the sections that looked changed: a hard shadow's edge is
    followed). A section has changed when its median change in colour (a*b*) is TICK_AB or more, or it's TICK_DARK or
    more darker. Offered only where the reference was plain paper: within TICK_PLAIN_AB of the paper there in a*b* and less
    than TICK_PLAIN_L darker (paperSurf, 10-segment); so the pale-colour reading never comes into it. Measured on the
    author's photos (as the trial, in plain JS: lined up within about 1 px of OpenCV's): 40 of 40 newly coloured
    found and nothing else in any of the 8 shots, the hard shadow included; the palest new one read 8.5 (a pale
    yellow), the worst blank one 6.25 (with one smoothing, as the trial, 9.3 and 7.75); no coloured section of the
    page was plain paper, 279 of its 288 blank ones were. A printout (D5: the real PDF's page 1 of the letter page,
    Page to colour and the Labelled page, 10 sections coloured by simulation, the light falling off, blurred, noisy):
    10 of 10, nothing else. One page's photos: Check them is the safety net. Returns { on: sections offered,
    blank: ticked sections plain paper in both (unchanged: dashed in Check them), plain: how many plain-paper
    sections were read }. */
const TICK_IN = 2,
  TICK_LIGHT = 60,
  // (the second, closer smoothing, without the sections that look changed at first: TICK_SUSPECT of the thresholds)
  TICK_LIGHT2 = 30,
  TICK_SUSPECT = 0.8,
  // (the light's cast: no further than this in a*b* from the page's usual change, to be taken as light at all. At 10,
  // a soft shadow's own cast was left out too, and 60 blank sections of the author's photo offered; at 22 none, and on
  // a printout of the letter page with a third of it coloured, 24 blank sections offered became none)
  TICK_CAST = 22,
  TICK_CAST_FROM = 15,
  TICK_AB = 8,
  TICK_DARK = 25,
  TICK_PLAIN_AB = 2.5,
  TICK_PLAIN_L = 5,
  // (unchanged enough to be blank: under these)
  TICK_SAME_AB = 4,
  TICK_SAME_L = 8;
function tickRead(ref, pho, labels, W, H, nl, list, done, skip) {
  const n = W * H,
    r = TICK_IN,
    mid = new Uint8Array(n),
    D = new Float32Array(n * 3),
    LR = new Float32Array(n * 3);
  for (let y = r; y < H - r; y++)
    for (let x = r, i = y * W + r; x < W - r; x++, i++) {
      const l = labels[i];
      if (
        l > 0 &&
        l < nl &&
        pho[i * 4 + 3] &&
        labels[i - r] === l &&
        labels[i + r] === l &&
        labels[i - r * W] === l &&
        labels[i + r * W] === l
      )
        mid[i] = 1;
    }
  // the light's difference: the change smoothed over the middles (light enough to read: L* over 30) that haven't
  // changed, at a quarter of the size
  // (in CIELAB worked out in full: labLut's 6 bits a channel put a flat paper's pixels in the same few steps, and the
  // steps' error, up to about 2 in a*b*, then didn't average out: a blank section in a hard shadow read 9, not 7)
  const lin = new Float32Array(256),
    t3 = [0, 0, 0],
    t4 = [0, 0, 0];
  for (let k = 0; k < 256; k++) {
    const c = k / 255;
    lin[k] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  for (let i = 0; i < n; i++) {
    if (!mid[i]) continue;
    tkLab(ref, i, lin, t3);
    tkLab(pho, i, lin, t4);
    for (let c = 0; c < 3; c++) {
      LR[i * 3 + c] = t3[c];
      D[i * 3 + c] = t4[c] - t3[c];
    }
  }
  // the plain-paper test: each section's median distance from the paper in the reference
  // (the histograms for the sections read only, numbered 0..kN-1 by ix: sized by every section, 50,000 of them took
  // 100 MB)
  const ix = new Int32Array(nl).fill(-1);
  let kN = 0;
  list.forEach(function (l) {
    if (l > 0 && l < nl && ix[l] < 0) ix[l] = kN++;
  });
  const P = paperSurf(ref, labels, W, H),
    LUT = labLut(),
    B = 256,
    hPA = new Uint32Array(kN * B),
    hPL = new Uint32Array(kN * B),
    cnt = new Uint32Array(kN);
  for (let y = 0; y < H; y++)
    for (let x = 0, i = y * W; x < W; x++, i++) {
      if (!mid[i]) continue;
      const j = ix[labels[i]];
      if (j < 0) continue;
      const o = j * B;
      cnt[j]++;
      if (P) {
        // (in labLut's steps, as the surface was fitted in them: against the exact colour, a flat cream paper read
        // 1-1.6 from its own surface, of the 2.5 allowed)
        const c = (((y / P.G) | 0) * P.gw + ((x / P.G) | 0)) * 3,
          q = labAt(ref, i);
        hPA[o + tkBin(Math.hypot(LUT[q + 1] - P.S[c + 1], LUT[q + 2] - P.S[c + 2]), 10)]++;
        hPL[o + tkBin(P.S[c] - LUT[q], 10)]++;
      }
    }
  const sk = {};
  (skip || []).forEach(function (l) {
    sk[l] = 1;
  });
  // (and the sections the paper grown from section to section calls paper, paperSecsOf, 10-segment, however much
  // darker than the surface: those in a soft shadow in the reference; by the surface alone, 18 of 80 sections in a 35%
  // shadow, or 27 of 192 the surface half followed into one, were never read. Still as near the surface in a*b*: a
  // ticked pastel the growing takes for paper had been said to look blank)
  const back = {};
  if (P) {
    const g1 = {};
    paperSecsOf(ref, labels, W, H, nl, list).forEach(function (l) {
      g1[l] = 1;
    });
    list.forEach(function (l) {
      if (!g1[l]) back[l] = 1;
    });
  }
  const read = list.filter(function (l) {
    const j = ix[l];
    return (
      j >= 0 &&
      cnt[j] >= 20 &&
      !sk[l] &&
      P &&
      tkMed(hPA, cnt, j, 10) < TICK_PLAIN_AB &&
      (tkMed(hPL, cnt, j, 10) < TICK_PLAIN_L || back[l])
    );
  });
  // the change, the light taken out: first smoothed widely; then again more closely, without the sections that
  // look changed at first (a hard shadow's edge is followed, and a big fill isn't taken for the light)
  const ok = new Uint8Array(n);
  // (not the sections ticked already: coloured in the photo, a background of one colour, half the page, had become
  // the light's change, and every blank section read as coloured)
  for (let i = 0; i < n; i++) ok[i] = mid[i] && LR[i * 3] > 30 && !done[labels[i]] ? 1 : 0;
  // (and not what's clearly a colour from the start: far, in a*b*, from the page's usual change, the light's cast. A
  // big section coloured, a third of the page, was taken for the light round it, and the blank ones by it then read
  // as coloured: 24 on a printout of the letter page)
  const ha = new Uint32Array(512),
    hb = new Uint32Array(512);
  let no = 0;
  // (the cast: the median change, then the median of the changes near it, TICK_CAST_FROM, a light's not a marker's.
  // From zero instead, a warm lamp's cast of 17 in b* had left nothing to take the light from)
  const hmed = function (h, d) {
      let s = 0;
      for (let b = 0; b < 512; b++) {
        s += h[b];
        if (s * 2 >= no) return (b - 256) / 4;
      }
      return d;
    },
    castOf = function (ca, cb, lim) {
      ha.fill(0);
      hb.fill(0);
      no = 0;
      for (let i = 0; i < n; i++)
        if (ok[i] && (lim < 0 || Math.hypot(D[i * 3 + 1] - ca, D[i * 3 + 2] - cb) < lim)) {
          ha[Math.max(0, Math.min(511, Math.round(D[i * 3 + 1] * 4) + 256))]++;
          hb[Math.max(0, Math.min(511, Math.round(D[i * 3 + 2] * 4) + 256))]++;
          no++;
        }
      return no ? [hmed(ha, ca), hmed(hb, cb)] : [ca, cb];
    },
    c0 = castOf(0, 0, -1),
    c1 = castOf(c0[0], c0[1], TICK_CAST_FROM),
    ma = c1[0],
    mb = c1[1];
  for (let i = 0; i < n; i++)
    if (ok[i] && Math.hypot(D[i * 3 + 1] - ma, D[i * 3 + 2] - mb) >= TICK_CAST) ok[i] = 0;
  const m1 = tkMeds(D, mid, labels, W, H, ix, kN, cnt, tkLight(D, mid, LR, ok, W, H, TICK_LIGHT)),
    sus = new Uint8Array(nl);
  read.forEach(function (l) {
    const j = ix[l];
    if (m1.ab[j] >= TICK_SUSPECT * TICK_AB || m1.dl[j] >= TICK_SUSPECT * TICK_DARK) sus[l] = 1;
  });
  for (let i = 0; i < n; i++) if (ok[i] && sus[labels[i]]) ok[i] = 0;
  const m2 = tkMeds(D, mid, labels, W, H, ix, kN, cnt, tkLight(D, mid, LR, ok, W, H, TICK_LIGHT2)),
    on = [],
    blank = [];
  read.forEach(function (l) {
    const ab = m2.ab[ix[l]],
      dl = m2.dl[ix[l]];
    if (ab >= TICK_AB || dl >= TICK_DARK) {
      if (!done[l]) on.push(l);
    } else if (done[l] && ab < TICK_SAME_AB && dl < TICK_SAME_L) blank.push(l);
  });
  return { on: on, blank: blank, plain: read.length };
}
// a value's step in the histograms (k steps a unit, 256 of them)
function tkBin(v, k) {
  v = Math.round(v * k);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
// a section's median from its histogram
function tkMed(h, cnt, l, k) {
  const o = l * 256,
    half = cnt[l] / 2;
  let s = 0;
  for (let b = 0; b < 256; b++) {
    s += h[o + b];
    if (s >= half) return b / k;
  }
  return 255 / k;
}
// the light's difference between the two pictures: D (the change, CIELAB) smoothed over sigma px of the middles in
// ok, again and again without those far from it (ok is changed); at a quarter of the size: { F, qw, qh, q }
function tkLight(D, mid, LR, ok, W, H, sigma) {
  const q = 4,
    qw = Math.ceil(W / q),
    qh = Math.ceil(H / q),
    F = new Float32Array(qw * qh * 3),
    use = Uint8Array.from(ok);
  for (let it = 0; it < 4; it++) {
    const wq = new Float32Array(qw * qh),
      sq = [new Float32Array(qw * qh), new Float32Array(qw * qh), new Float32Array(qw * qh)];
    for (let y = 0; y < H; y++)
      for (let x = 0, i = y * W; x < W; x++, i++) {
        if (!use[i]) continue;
        const k = ((y / q) | 0) * qw + ((x / q) | 0);
        wq[k]++;
        for (let c = 0; c < 3; c++) sq[c][k] += D[i * 3 + c];
      }
    const bw = tkBlur({ a: wq, w: qw, h: qh }, sigma / q).a;
    for (let c = 0; c < 3; c++) {
      const b = tkBlur({ a: sq[c], w: qw, h: qh }, sigma / q).a;
      for (let k = 0; k < qw * qh; k++) F[k * 3 + c] = bw[k] > 1e-6 ? b[k] / bw[k] : 0;
    }
    if (it === 3) break;
    // (the middles near the smoothed change, for the next pass)
    for (let y = 0; y < H; y++)
      for (let x = 0, i = y * W; x < W; x++, i++) {
        if (!ok[i]) continue;
        const fx = (x + 0.5) / q - 0.5,
          fy = (y + 0.5) / q - 0.5;
        let e = 0;
        for (let c = 0; c < 3; c++) {
          const v = D[i * 3 + c] - tkAtC(F, qw, qh, fx, fy, c);
          e += v * v;
        }
        use[i] = e < 36 ? 1 : 0;
      }
  }
  return { F: F, qw: qw, qh: qh, q: q };
}
// each section's median change with the light taken out: in a*b* (ab) and how much darker (dl), for the sections
// numbered by ix (0..kN-1)
function tkMeds(D, mid, labels, W, H, ix, kN, cnt, Lt) {
  const hAB = new Uint32Array(kN * 256),
    hDL = new Uint32Array(kN * 256),
    F = Lt.F,
    q = Lt.q;
  for (let y = 0; y < H; y++)
    for (let x = 0, i = y * W; x < W; x++, i++) {
      if (!mid[i]) continue;
      const j = ix[labels[i]];
      if (j < 0) continue;
      const fx = (x + 0.5) / q - 0.5,
        fy = (y + 0.5) / q - 0.5,
        eL = D[i * 3] - tkAtC(F, Lt.qw, Lt.qh, fx, fy, 0),
        ea = D[i * 3 + 1] - tkAtC(F, Lt.qw, Lt.qh, fx, fy, 1),
        eb = D[i * 3 + 2] - tkAtC(F, Lt.qw, Lt.qh, fx, fy, 2),
        o = j * 256;
      hAB[o + tkBin(Math.hypot(ea, eb), 4)]++;
      hDL[o + tkBin(-eL, 2)]++;
    }
  const ab = new Float32Array(kN),
    dl = new Float32Array(kN);
  for (let j = 0; j < kN; j++)
    if (cnt[j]) {
      ab[j] = tkMed(hAB, cnt, j, 4);
      dl[j] = tkMed(hDL, cnt, j, 2);
    }
  return { ab: ab, dl: dl };
}
// pixel i of RGBA d in CIELAB (D65), into o; lin: sRGB's 256 levels made linear
function tkLab(d, i, lin, o) {
  const R = lin[d[i * 4]],
    G = lin[d[i * 4 + 1]],
    B = lin[d[i * 4 + 2]],
    f = function (t) {
      return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    },
    fx = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047),
    fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722),
    fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  o[0] = 116 * fy - 16;
  o[1] = 500 * (fx - fy);
  o[2] = 200 * (fy - fz);
}
// tkAt for one channel of an interleaved 3-channel grid
function tkAtC(a, w, h, x, y, c) {
  if (x < 0) x = 0;
  else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0;
  else if (y > h - 1) y = h - 1;
  const x0 = x | 0,
    y0 = y | 0,
    x1 = x0 < w - 1 ? x0 + 1 : x0,
    y1 = y0 < h - 1 ? y0 + 1 : y0,
    fx = x - x0,
    fy = y - y0;
  return (
    (a[(y0 * w + x0) * 3 + c] * (1 - fx) + a[(y0 * w + x1) * 3 + c] * fx) * (1 - fy) +
    (a[(y1 * w + x0) * 3 + c] * (1 - fx) + a[(y1 * w + x1) * 3 + c] * fx) * fy
  );
}
/* ---- (v328, D3) a printout's thin dark marks: codes, numbers, tone lines, close-up letters ----
    Printed on the page and coloured over, they'd read as a change: left out of the reading. A black top-hat (the
    picture closed, the lightest within r, then the darkest within r of that, less the picture) is what's thinner than
    2r + 1 and darker than round it; the drawing's own lines are in neither picture's middles. Returns a mask, 1 to
    leave out. */
const TICK_THIN = 28,
  TICK_THIN_C = 30;
function tkThin(d, W, H) {
  const g = tkGrey(d, W, H, 1),
    r = Math.max(2, Math.round(Math.max(W, H) / 700)),
    mx = tkMax(g, r),
    neg = { a: new Float32Array(mx.a.length), w: W, h: H };
  for (let i = 0; i < neg.a.length; i++) neg.a[i] = -mx.a[i];
  const cl = tkMax(neg, r),
    o = new Uint8Array(W * H);
  // (and only grey or black, as the printed codes, numbers, letters and tone lines are: a marker's hatching is
  // coloured, and read as such; v328 review: grey by the paper's own colour, the lightest tenth of the photo, so a
  // lamp's warm cast doesn't make a grey mark coloured)
  const hg = new Uint32Array(256);
  for (let i = 0; i < g.a.length; i++) hg[Math.max(0, Math.min(255, g.a[i] | 0))]++;
  let t = 255,
    acc = 0;
  while (t > 0 && acc + hg[t] < g.a.length * 0.1) acc += hg[t--];
  const pw = [0, 0, 0];
  let pn = 0;
  for (let i = 0; i < g.a.length; i++)
    if (g.a[i] >= t) {
      pw[0] += d[i * 4];
      pw[1] += d[i * 4 + 1];
      pw[2] += d[i * 4 + 2];
      pn++;
    }
  const pm = Math.max(pw[0], pw[1], pw[2]) / Math.max(1, pn),
    kr = pn && pw[0] ? (pm * pn) / pw[0] : 1,
    kg = pn && pw[1] ? (pm * pn) / pw[1] : 1,
    kb = pn && pw[2] ? (pm * pn) / pw[2] : 1;
  for (let i = 0; i < o.length; i++)
    if (-cl.a[i] - g.a[i] > TICK_THIN) {
      const r = d[i * 4] * kr,
        gg = d[i * 4 + 1] * kg,
        b = d[i * 4 + 2] * kb;
      if (Math.max(r, gg, b) - Math.min(r, gg, b) < TICK_THIN_C) o[i] = 1;
    }
  // (and a pixel round each, for the mark's soft edge)
  const o2 = Uint8Array.from(o);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1, i = y * W + 1; x < W - 1; x++, i++)
      if (o[i]) o2[i - 1] = o2[i + 1] = o2[i - W] = o2[i + W] = 1;
  return o2;
}
// (the worker's job, or the page's when there's none: 'align' lines up, 'read' draws the photo lined up and reads it)
function tickWork(m) {
  if (m.step === 'align') return { v: tickAlign(m.ref, m.W, m.H, m.pho, m.pw, m.ph), t: [] };
  // (v328 review: the coloured-in offer's paper reading, 82-colour-mode colourOffer)
  if (m.step === 'paper') return { v: paperSecsOf(m.d, m.labels, m.W, m.H, m.nl, m.list, true, m.ab), t: [] };
  const pw = tickWarp(m.al, m.W, m.H, m.pho, m.pw, m.ph),
    lab = m.labels;
  let L = lab;
  if (m.thin) {
    // (the marks left out as if they were lines: they're nobody's middle)
    const t = tkThin(pw, m.W, m.H);
    L = Int32Array.from(lab);
    for (let i = 0; i < L.length; i++) if (t[i] && L[i] > 0) L[i] = -2;
  }
  return { v: tickRead(m.ref, pw, L, m.W, m.H, m.nl, m.list, m.done, m.skip), t: [] };
}
function tickWorkerSrc() {
  const K = {
    TICK_CC: TICK_CC,
    TICK_COARSE: TICK_COARSE,
    TICK_TILE_MAX: TICK_TILE_MAX,
    TICK_TILE_CC: TICK_TILE_CC,
    TICK_IN: TICK_IN,
    TICK_LIGHT: TICK_LIGHT,
    TICK_LIGHT2: TICK_LIGHT2,
    TICK_SUSPECT: TICK_SUSPECT,
    TICK_CAST: TICK_CAST,
    TICK_CAST_FROM: TICK_CAST_FROM,
    TICK_AB: TICK_AB,
    TICK_DARK: TICK_DARK,
    TICK_PLAIN_AB: TICK_PLAIN_AB,
    TICK_PLAIN_L: TICK_PLAIN_L,
    TICK_SAME_AB: TICK_SAME_AB,
    TICK_SAME_L: TICK_SAME_L,
    TICK_THIN: TICK_THIN,
    TICK_THIN_C: TICK_THIN_C,
    PAPER_CELLS: PAPER_CELLS,
    PAPER_NEAR: PAPER_NEAR,
    PAPER_TERMS: PAPER_TERMS,
    PAPER_AB: PAPER_AB,
    PAPER_DARK: PAPER_DARK,
    PAPER_IN: PAPER_IN,
    PAPER_GROW_AB: PAPER_GROW_AB,
    PAPER_GROW_L: PAPER_GROW_L,
    PAPER_GAP: PAPER_GAP,
    PAPER_SEED: PAPER_SEED,
    PAPER_SEED_L: PAPER_SEED_L,
    PAPER_AB_PX: PAPER_AB_PX,
  };
  return (
    [
      tkGrey,
      tkDown,
      tkBox,
      tkBlur,
      tkMax,
      tkInk,
      tkRot,
      tkAt,
      tkSize,
      tkCorr,
      tkInv,
      tkECC,
      tkHScale,
      tickAlign,
      tkShift,
      tickWarp,
      tickRead,
      tkBin,
      tkMed,
      tkLight,
      tkMeds,
      tkLab,
      tkAtC,
      tkThin,
      tickWork,
      labLut,
      labAt,
      paperBasis,
      solveSmall,
      paperSurf,
      paperSecsOf,
      secNeighbours,
    ]
      .map(function (f) {
        return f.toString();
      })
      .join('\n') +
    '\nlet _labLut = null;\nconst ' +
    Object.keys(K)
      .map(function (k) {
        return k + ' = ' + K[k];
      })
      .join(', ') +
    ';\n'
  );
}
// a job: in the worker when there is one, else here
function tickJob(m, tr) {
  return JOBS.run('tick', m, tr).then(
    function (v) {
      return v;
    },
    function (e) {
      // (the worker given up on as too slow: not done again here, where it would hold the page as long again)
      if (e && /timed out/.test(e.message || '')) return Promise.reject(e);
      // (on the page: a moment first, for the line saying so to show)
      return new Promise(function (res, rej) {
        setTimeout(function () {
          try {
            res(tickWork(m).v);
          } catch (e) {
            rej(e);
          }
        }, 50);
      });
    },
  );
}

/* ---- (v328, 11.1, 11.5, 11.6) Tick off from a photo: the lines, the photo and the offer ----
    The ways in: a line under the Plan's tabs when the guide is opened again ("Coloured some on paper since? Tick
    them off from a photo ✕": from Home or the Library, not within a visit, not finished, nothing ticked the visit
    before (counted on this device, TICK_VISITS: v328 review, a visit with nothing ticked isn't saved, so a count kept
    in the guide stayed at the visit before's), not straight after Build, one at a time with the other lines; ✕ until the
    next opening), and "Coloured on paper? Tick them off from a photo" always under Colour along's hint. The photo:
    the finished-page photo's way in (24-page-photo), read at the guide's size, the page found and straightened when
    the finder is sure, else the four corners; then dropped (11.5). The reference: the guide's own picture (srcRGBA)
    or, for a printout, the page as printed (Part D, tickPrintRef). The offer, in Colour along: "8 sections look
    coloured since. Mark them done · Check them ✕", with the ticked sections that look blank here outlined apart in
    Check them (11.3). */
let _tickAt = null,
  // (the Plan's line this opening: 1 up, -1 closed or used, 0 not this time)
  _tickLn = 0,
  // (the offer: { secs, blank, g: loadGen })
  tickOffer = null,
  _tickBusy = false;
// the ticks as they stand: what this visit's ticks are counted from (an opening, or Build)
function tickBase() {
  _tickAt = colored ? Uint8Array.from(colored) : null;
}
// how many sections were ticked in this visit (the next opening's "nothing ticked the visit before")
function tickVisNow() {
  if (!_tickAt || !colored || _tickAt.length !== colored.length || !assignData) return undefined;
  let n = 0;
  for (const l in assignData.assign) if (colored[l] && !_tickAt[l]) n++;
  return n;
}
function tickFinished() {
  if (!assignData || !colored) return false;
  for (const l in assignData.assign) if (!colored[l]) return false;
  return true;
}
// (a guide Tick off from a photo works for: built, not the sample, not a photo made into a page, not finished; with
// every marker as well as your own, as a printout of it can be coloured with any)
function tickCan() {
  return !!assignData && !ppOn() && !curSample && !tickFinished();
}
// (each guide's ticks in its last visit, on this device: { id: count }, the most recent TICK_VIS_MAX)
const TICK_VISITS = 'ms-tick-visits',
  TICK_VIS_MAX = 200;
function tickVisits() {
  try {
    const o = JSON.parse(localStorage.getItem(TICK_VISITS) || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (_) {
    return {};
  }
}
// (keyed 'g' and the guide's id: a number's key would keep the numbers' order, not the order they were set in)
function tickVisSet(id, n) {
  if (id == null || !(n >= 0)) return;
  try {
    const o = tickVisits(),
      k0 = 'g' + id;
    if (o[k0] === n) return;
    delete o[k0];
    o[k0] = n;
    const k = Object.keys(o);
    for (let i = 0; i < k.length - TICK_VIS_MAX; i++) delete o[k[i]];
    localStorage.setItem(TICK_VISITS, JSON.stringify(o));
  } catch (_) {}
}
// (as the ticks change: updateProgress, 88-coverage-blend; and as the guide is saved or left)
function tickVisNote() {
  if (curId != null && _tickAt) tickVisSet(curId, tickVisNow() + _tickAdd);
}
// (the sections found again, Edit sections and Build: the count so far kept, counted on from the ticks as they are)
let _tickAdd = 0;
function tickRebase() {
  if (curId != null) {
    const v = tickVisits()['g' + curId];
    _tickAdd = v > 0 ? v : 0;
  }
  tickBase();
}
// (a reload in place, another tab's save: the visit goes on, its count and its baseline as they were)
function tickReloaded(keep) {
  if (keep && keep.id === curId && keep.at && colored && keep.at.length === colored.length) {
    _tickAt = keep.at;
    _tickAdd = keep.add;
  } else tickRebase();
}
// a guide opened (from Home or the Library: not reloaded in place)
function tickOpened() {
  _tickRun++;
  const before = curId != null ? tickVisits()['g' + curId] : undefined;
  _tickAdd = 0;
  tickBase();
  tickOffer = null;
  // (and a run left behind ends: its line, if it was up, with it)
  if (_tickBusy) tickBusy(null);
  _tickBusy = false;
  _tickLn = tickCan() && !(before > 0) ? 1 : 0;
  // (this visit's, from nothing: a visit that ticks none says so for the next)
  if (curId != null) tickVisSet(curId, 0);
}
// built: a new visit's count, and no line (straight after Build)
function tickBuilt() {
  _tickAdd = 0;
  tickBase();
  tickOffer = null;
  _tickLn = 0;
}
function tickLineUp() {
  // (v328 review: not once sections are ticked in this visit: coloured along on the screen, not on paper)
  return _tickLn === 1 && sfmode === 'guide' && tickCan() && !((tickVisNow() || 0) > 0);
}
function tickLineHTML() {
  if (!tickLineUp()) return '';
  if (
    _heldNote ||
    _pinNote ||
    lowLineUp() ||
    sampleNoteHTML() ||
    tapLineUp() ||
    _toolTip > 0 ||
    ppShadeLineUp()
  )
    return '';
  return (
    '<div id="sfTickLine" class="sfheldnote sfsamplenote" role="note"><span>Coloured some on paper since? ' +
    '<button type="button" id="sfTickGo" class="sflink">Tick them off from a photo</button></span>' +
    '<button type="button" id="sfTickX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
function tickLineWire() {
  const go = document.getElementById('sfTickGo'),
    x = document.getElementById('sfTickX');
  if (go) go.addEventListener('click', tickPick);
  if (x)
    x.addEventListener('click', function () {
      _tickLn = -1;
      const n = document.getElementById('sfTickLine');
      if (n) n.remove();
      ctlRefocus('#sfTab-' + gTab);
    });
}
// Colour along's line, under its hint
function tickAlongHTML() {
  if (!tickCan() || tickOfferOn()) return '';
  return (
    '<div id="sfTickAl" class="sftickal">Coloured on paper? <button type="button" id="sfTickAlGo" class="sflink">' +
    'Tick them off from a photo</button></div>'
  );
}
function tickAlongWire() {
  const b = document.getElementById('sfTickAlGo');
  if (b) b.addEventListener('click', tickPick);
}
// (v328 review) the line kept as it should be without the controls drawn again: gone on a finished page or while an
// offer is up, back when the offer goes (✕, or its sections ticked)
function tickAlongSync() {
  if (sfmode !== 'color' || focus || colCheckLive()) return;
  const el = document.getElementById('sfTickAl'),
    html = tickAlongHTML();
  if (!html) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  const host = document.getElementById('sfAlHint') || document.querySelector('#sfCtl .sfalongp .sfinfo');
  if (!host || !host.closest('.sfalongp')) return;
  host.insertAdjacentHTML('afterend', html);
  tickAlongWire();
}
/* -- the photo: the picker opens in the tap itself (iOS opens it only from a tap) -- */
function tickPick() {
  if (_tickBusy || !tickCan()) return;
  _tickLn = -1;
  // (the Plan's line goes now, the picker open or cancelled; the keyboard, if it was on it, to the tab)
  const ln = document.getElementById('sfTickLine');
  if (ln) {
    const had = ln.contains(document.activeElement);
    ln.remove();
    if (had) ctlRefocus('#sfTab-' + gTab);
  }
  let el = document.getElementById('sfTickFile');
  if (!el) {
    el = document.createElement('input');
    el.type = 'file';
    el.id = 'sfTickFile';
    el.className = 'fileinput';
    el.accept = 'image/*';
    el.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) tickFile(f);
    });
    document.body.appendChild(el);
  }
  el.click();
}
function tickSay(m) {
  toast(m, 6000);
}
function tickFile(file) {
  if (isPdf(file)) {
    tickSay('Choose a photo of your page (a JPEG or PNG).');
    return;
  }
  // (v328 review: the run's token taken now, so the guide left while the photo's read or its corners are set ends it)
  const g = loadGen,
    n = _tickRun;
  // (read at the guide's own size and a little more: FIN_SIDE is less than a big guide)
  finRead(file, Math.min(4096, Math.round(Math.max(W, H) * 1.25)))
    .then(function (r) {
      if (g !== loadGen || n !== _tickRun || !assignData) return freeCanvas(r.src);
      let f = { tier: 'none' };
      try {
        f = pgFind(r.src, { coloured: true });
      } catch (_) {}
      if (f.tier === 'sure') tickFlat(r.src, f.q, r.f35, g, n);
      else
        finEdit(
          null,
          r.src,
          f.tier === 'unsure' ? f.q : null,
          f.tier === 'unsure' ? f.why : 'none',
          function (q) {
            if (q === false || g !== loadGen || n !== _tickRun) freeCanvas(r.src);
            else if (q) tickFlat(r.src, q, r.f35, g, n);
            else tickGo(r.src, g, n);
          },
        );
    })
    .catch(function (e) {
      if (g !== loadGen || n !== _tickRun) return;
      tickSay(e && e.finMsg ? e.finMsg : 'Couldn’t read that photo. Try it again, or another photo.');
    });
}
function tickFlat(src, q, f35, g, n) {
  let out = null;
  try {
    out = pgWarp(src, q, finAspect(q, src.width, src.height, f35));
  } catch (_) {}
  if (out) freeCanvas(src);
  tickGo(out || src, g, n);
}
// the photo's pixels, at most the guide's long side across (RGBA, and its size)
function tickPixels(c) {
  const k = Math.min(1, Math.max(W, H) / Math.max(c.width, c.height)),
    w = Math.max(8, Math.round(c.width * k)),
    h = Math.max(8, Math.round(c.height * k)),
    t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  const g = t.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  if (k < 1) drawShrunk(g, c, w, h);
  else g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  freeCanvas(t);
  return { d: d, w: w, h: h };
}
/* -- (v328, D1, D2) the references: the guide's own picture, and the page as printed -- */
// the page as Print prints it, without labels or tone lines: the drawing's lines on white (RGBA, W x H)
function tickPrintRef() {
  const a = pdfArt(false, null, null),
    d = a.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  freeCanvas(a);
  return d;
}
// where the ink is: the longest run of rows (then columns, within them) with ink, gaps of up to 6% allowed: the
// drawing, not a printed header above it. ink: 0-1 a pixel, w x h. { x0, y0, x1, y1 } or null
function tkInkRange(ink, w, h) {
  const run = function (n, has) {
    const gap = Math.max(2, Math.round(n * 0.06));
    let best = null,
      s = -1,
      last = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && has(i);
      if (on) {
        if (s < 0 || i - last > gap) s = i;
        last = i;
        if (!best || last - s > best[1] - best[0]) best = [s, last];
      }
    }
    return best;
  };
  const rows = run(h, function (y) {
    let c = 0;
    for (let x = 0; x < w; x++) if (ink[y * w + x] > 0.3) c++;
    return c > w * 0.01;
  });
  if (!rows) return null;
  const cols = run(w, function (x) {
    let c = 0;
    for (let y = rows[0]; y <= rows[1]; y++) if (ink[y * w + x] > 0.3) c++;
    return c > (rows[1] - rows[0] + 1) * 0.01;
  });
  return cols ? { x0: cols[0], y0: rows[0], x1: cols[1], y1: rows[1] } : null;
}
// the guide's drawing's box: where its lines are
function tickRefBox() {
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++)
      if (labels[i] === -1) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x0: x0, y0: y0, x1: x1, y1: y1 };
}
/* The photo's drawing put where the guide's is (D2: a printout's drawing sits inside a sheet with a header and margins,
   printed as it is or shrunk to fit), as RGBA W x H: the photo's ink found (tkInkRange), on its side when that's the
   shape the drawing is, and stretched onto the guide's drawing's box; lining up does the rest. null when it can't. */
function tickFit(pho) {
  const rb = tickRefBox();
  if (!rb) return null;
  const ra = (rb.x1 - rb.x0 + 1) / (rb.y1 - rb.y0 + 1),
    look = function (p) {
      const f = Math.max(1, Math.round(Math.max(p.w, p.h) / 1000)),
        g = tkGrey(p.d, p.w, p.h, f),
        ink = tkInk(g, Math.max(2, Math.round(Math.max(g.w, g.h) / 300)), 6),
        b = tkInkRange(ink.a, ink.w, ink.h);
      return b ? { x0: b.x0 * f, y0: b.y0 * f, x1: (b.x1 + 1) * f - 1, y1: (b.y1 + 1) * f - 1 } : null;
    };
  let p = pho,
    b = look(p);
  if (!b) return null;
  const pa = (b.x1 - b.x0 + 1) / (b.y1 - b.y0 + 1);
  // (on its side: a quarter turn the other way round fits the drawing's shape better)
  if (Math.abs(Math.log(1 / pa / ra)) < Math.abs(Math.log(pa / ra)) - 0.2) {
    const r = tkRot(pho.d, pho.w, pho.h, 1, 4);
    p = { d: r.a, w: r.w, h: r.h };
    b = look(p);
    if (!b) return null;
  }
  const o = new Uint8ClampedArray(W * H * 4).fill(255),
    sx = (b.x1 - b.x0 + 1) / (rb.x1 - rb.x0 + 1),
    sy = (b.y1 - b.y0 + 1) / (rb.y1 - rb.y0 + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = Math.round(b.x0 + (x - rb.x0 + 0.5) * sx - 0.5),
        v = Math.round(b.y0 + (y - rb.y0 + 0.5) * sy - 0.5);
      if (u < 0 || v < 0 || u >= p.w || v >= p.h) continue;
      const si = (v * p.w + u) * 4,
        di = (y * W + x) * 4;
      o[di] = p.d[si];
      o[di + 1] = p.d[si + 1];
      o[di + 2] = p.d[si + 2];
    }
  return { d: o, w: W, h: H };
}
// the line while it works, and its end
let _tickToast = '';
function tickBusy(m) {
  _tickBusy = !!m;
  if (m) {
    // (the toast says it to a screen reader: not twice)
    toast(m, 60000);
    _tickToast = m;
    return;
  }
  // (only its own: an Undo toast made meanwhile, Mark all or Check them's, stays)
  const t = document.getElementById('msToast');
  if (_tickToast && t && t.classList.contains('on') && t.textContent === _tickToast) hideToast();
  _tickToast = '';
}
// lined up with one reference (k: 'o' the guide's own picture, 'p' as printed): { k, ref, pho, al } or null
function tickTry(k, ref, pho) {
  const one = function (p) {
    return tickJob({ step: 'align', ref: ref, W: W, H: H, pho: p.d, pw: p.w, ph: p.h }).then(function (al) {
      return al && al.ok ? { k: k, ref: ref, pho: p, al: al } : null;
    });
  };
  // (the guide's own page: as straightened first, as measured; a printout, and anything that didn't line up, with
  // its drawing put in the guide's drawing's place)
  return (k === 'o' ? one(pho) : Promise.resolve(null)).then(function (r) {
    if (r) return r;
    const f = tickFit(pho);
    return f ? one(f) : null;
  });
}
const TICK_ASK =
  'Is this a printout from Marker Studio, or your own copy of the page this guide was made from? Your answer is kept with the guide.';
// (v328 review) a photo's reading, from the photo to the offer: the guide and its sections as they were when it began.
// _tickRun moves on when the guide is left or another opened (tickOpened, 95-mount leave, 97-open's same-guide
// shortcut), and what's still running then ends without a word (a new picture moves loadGen on: said); a reload in place or the sections or picture changed meanwhile ends
// with one (tickStale)
let _tickRun = 0;
function tickRunOf(g) {
  return { g: g, n: _tickRun, id: curId, W: W, H: H, l: labels, e: secEdN };
}
// '' while it holds; null to end quietly; else what to say
function tickStale(run) {
  // (not by curId: Save a copy, or a guide's first save, gives it a new one, and it's still the same guide)
  if (run.n !== _tickRun || !assignData || root.style.display === 'none') return null;
  if (run.g !== loadGen)
    return 'Your guide was reloaded while the photo was read. Take it again from Colour along.';
  if (run.W !== W || run.H !== H || run.l !== labels || run.e !== secEdN)
    return 'Your sections changed while the photo was read. Take it again from Colour along.';
  return '';
}
// (ended: busy no more, and said if it's to be)
function tickEnd(run) {
  const m = tickStale(run);
  // (a run left behind, the guide left: a newer one may be busy now, and its line stays)
  if (run.n === _tickRun) tickBusy(null);
  if (m) tickSay(m);
}
// (failed: said only while it's still this guide's run)
function tickFail(run) {
  if (run.n !== _tickRun) return;
  tickBusy(null);
  if (tickStale(run) === '') tickSay('Couldn’t read that photo. Try it again, or another photo.');
}
function tickGo(c, g, n) {
  // (n: the run's token from tickFile; none from the tests' seam)
  if (g !== loadGen || (n != null && n !== _tickRun) || !assignData) return freeCanvas(c);
  let pho = null;
  try {
    pho = tickPixels(c);
  } catch (_) {}
  freeCanvas(c);
  if (!pho) {
    tickSay('Couldn’t read that photo. Try it again, or another photo.');
    return;
  }
  const run = tickRunOf(g);
  tickBusy('Lining your photo up with your page…');
  // (a guide opened again has its picture read only when it's wanted: srcLoad, 25-source-photo)
  tickSrcReady(g)
    .then(function () {
      if (tickStale(run) !== '') return tickEnd(run);
      let orig = null;
      try {
        orig = srcRGBA();
      } catch (_) {}
      tickGo2(pho, orig, run);
    })
    .catch(function () {
      tickFail(run);
    });
}
// the guide's picture read from this device, when it has one and it isn't in memory yet
function tickSrcReady(g) {
  if (srcImg || !srcMay()) return Promise.resolve();
  srcLoad();
  return new Promise(function (res) {
    const t0 = Date.now(),
      wait = function () {
        if (g !== loadGen || srcImg || !srcLoading() || Date.now() - t0 > 30000) res();
        else setTimeout(wait, 100);
      };
    wait();
  });
}
// (both kinds tried each time, the guide's own picture and the page as printed: the answer kept, tickRef, only picks
// between them when both line up, so a wrong answer, or a printout of a guide answered 'o' once, is still read right)
function tickGo2(pho, orig, run) {
  const ks = orig ? ['o', 'p'] : ['p'];
  let i = 0;
  const found = [],
    next = function () {
      if (tickStale(run) !== '') return Promise.resolve(null);
      if (i >= ks.length) return Promise.resolve(found);
      const k = ks[i++];
      return tickTry(k, k === 'o' ? orig : tickPrintRef(), pho).then(function (r) {
        if (r) found.push(r);
        return next();
      });
    };
  // (begun in a promise: a reference that can't be made, a canvas too big, ends in the catch below, not stuck busy)
  Promise.resolve()
    .then(next)
    .then(function (f) {
      if (!f || tickStale(run) !== '') return tickEnd(run);
      if (!f.length) {
        tickBusy(null);
        tickSay(
          !orig
            ? 'This photo doesn’t line up with the page as printed. If it’s the page you photographed for this guide, that picture isn’t on this device: Tick off from a photo works with a printout of it.'
            : 'This photo doesn’t line up with your page. Try again with the whole page in view.',
        );
        return;
      }
      if (f.length === 1) return tickReadNow(f[0], run);
      // (both lined up: one clearly better, or as answered before, or asked, once for this guide)
      const d = f[0].al.cc - f[1].al.cc;
      if (Math.abs(d) >= 0.04) return tickReadNow(d > 0 ? f[0] : f[1], run);
      if (tickRef === 'o' || tickRef === 'p') return tickReadNow(tickRef === f[0].k ? f[0] : f[1], run);
      tickBusy(null);
      return askBox(
        'A printout, or your own page?',
        TICK_ASK,
        '<button type="button" class="sfghost" data-a="o">My own page</button><button type="button" class="btn-primary" data-a="p">A printout</button>',
        true,
      ).then(function (a) {
        const m = tickStale(run);
        if (m !== '') {
          if (m) tickSay(m);
          return;
        }
        if (a !== 'p' && a !== 'o') {
          tickSay('Not read. Take the photo again from Colour along and choose which it is.');
          return;
        }
        tickRef = a;
        guideDirty = true;
        scheduleAutosave();
        tickReadNow(a === f[0].k ? f[0] : f[1], run);
      });
    })
    .catch(function () {
      tickFail(run);
    });
}
function tickReadNow(r, run) {
  if (tickStale(run) !== '') return tickEnd(run);
  tickBusy('Reading which sections are coloured…');
  const nl = comps.length,
    done = new Uint8Array(nl);
  for (let l = 1; l < nl && l < colored.length; l++) done[l] = colored[l] ? 1 : 0;
  tickJob({
    step: 'read',
    ref: r.ref,
    W: W,
    H: H,
    pho: r.pho.d,
    pw: r.pho.w,
    ph: r.pho.h,
    al: r.al,
    labels: labels,
    nl: nl,
    list: countedList(),
    done: done,
    skip: bindingSecs(),
    thin: r.k === 'p',
  })
    .then(function (v) {
      if (tickStale(run) !== '') return tickEnd(run);
      tickBusy(null);
      tickResult(v);
    })
    .catch(function () {
      tickFail(run);
    });
}
// the offer, in Colour along (82-colour-mode's offer line, colOfferLine)
function tickResult(v) {
  if (!(v.plain > 0)) {
    tickSay('This page can’t be read from a photo: none of it was plain paper in the guide’s picture.');
    return;
  }
  // (the guide left meanwhile: the offer would be for a screen that isn't there)
  if (root.style.display === 'none') {
    tickSay('Your photo was read after you’d left the guide. Take it again from Colour along.');
    return;
  }
  const A = assignData.assign,
    on = (v.on || []).filter(function (l) {
      return A[l] && !colored[l];
    }),
    bl = (v.blank || []).filter(function (l) {
      return A[l] && colored[l];
    });
  if (!on.length && !bl.length) {
    tickSay('Nothing looks newly coloured. Very pale markers may not show in a photo.');
    return;
  }
  // (v328 review: in Edit sections with edits made, a Build of them drops the offer: not made, said; with none, it
  // waits for the Plan, as going back keeps it)
  if (sfmode === 'review' && secEdPending()) {
    tickSay(
      'Your photo was read while your sections were being edited. Build guide, then take it again from Colour along.',
    );
    return;
  }
  tickOffer = { secs: on, blank: bl, g: loadGen };
  if (sfmode === 'review') {
    tickSay(tickOfferWords() + ' Go back to the Plan, then see Colour along.');
    return;
  }
  const full = root.classList.contains('sffull'),
    rev = root.classList.contains('sfrev');
  // (v328 review: shown where it can be seen: not under Focus mode, full screen, Reveal or Check them open, each said)
  if (sfmode === 'color' && !focus && !full && !rev && !colCheckLive()) {
    renderControls();
    renderGuide();
    sayLive(tickOfferWords());
    tickOfferFocus();
  } else if (sfmode === 'color' || (sfmode === 'guide' && (full || rev))) {
    // (Colour along under full screen: the line drawn now, there when full screen is left)
    if (sfmode === 'color' && full && !focus && !colCheckLive()) colOfferShow();
    tickSay(
      tickOfferWords() +
        (focus
          ? ' Leave Focus mode to see them.'
          : full
            ? sfmode === 'color'
              ? ' Leave full screen to see them.'
              : ' Leave full screen, then see Colour along.'
            : rev
              ? ' Close Reveal, then see Colour along.'
              : colCheckLive()
                ? ' Finish checking, then see them.'
                : ' See Colour along.'),
    );
  } else if (sfmode === 'guide' && !secEdPending()) {
    enterColor(true);
    sayLive(tickOfferWords());
    tickOfferFocus();
  }
  // (Straighten or Crop meanwhile: not taken from there; the offer waits in Colour along)
  else tickSay(tickOfferWords() + ' See Colour along.');
}
// (v328 review) the keyboard on the offer's first link: the controls drawn again had dropped it to the page
function tickOfferFocus() {
  const b = document.getElementById('sfColGo') || document.getElementById('sfColCk');
  const a = document.activeElement;
  if (!b || (a && a !== document.body && a.isConnected)) return;
  try {
    b.focus({ preventScroll: true });
  } catch (_) {}
}
// the ticked sections that look blank, while they're still ticked
function tickBlank() {
  if (!tickOffer || !assignData) return [];
  return tickOffer.blank.filter(function (l) {
    return assignData.assign[l] && colored[l];
  });
}
function tickOfferOn() {
  return !!(tickOffer && tickOffer.g === loadGen && assignData && (tickLeft().length || tickBlank().length));
}
// the offer's sections not ticked since
function tickLeft() {
  if (!tickOffer || !assignData) return [];
  return tickOffer.secs.filter(function (l) {
    return assignData.assign[l] && !colored[l];
  });
}
function tickOfferWords() {
  const n = tickLeft().length,
    b = tickBlank().length;
  // (v328 review: and the ticked ones that look blank, said there too, not only in Check them)
  return n
    ? (n === 1 ? 'One section looks coloured since.' : n + ' sections look coloured since.') +
        (b
          ? (b === 1 ? ' One ticked section doesn’t' : ' ' + b + ' ticked sections don’t') + ' look coloured.'
          : '')
    : 'Nothing looks newly coloured. ' +
        (b === 1 ? 'One ticked section doesn’t' : b + ' ticked sections don’t') +
        ' look coloured in your photo.';
}
function tickOfferLine() {
  const n = tickLeft().length;
  return (
    // (said as it comes, tickResult: not a live region as well)
    '<div id="sfColOffer" class="sfheldnote"><span>' +
    esc(tickOfferWords()) +
    ' ' +
    '<span class="sfoffacts">' +
    (n
      ? '<button type="button" id="sfColGo" class="sflink">' +
        (n === 1 ? 'Tick it' : 'Mark them done') +
        '</button> · '
      : '') +
    '<button type="button" id="sfColCk" class="sflink">' +
    (n + tickBlank().length === 1 ? 'Check it' : 'Check them') +
    '</button></span></span><button type="button" id="sfColX" class="sfheldx" aria-label="Close">' +
    ic('x') +
    '</button></div>'
  );
}
// Mark them done: as Check them's Done with nothing changed
function tickTake() {
  const secs = tickLeft();
  if (!secs.length) return;
  const set = {};
  secs.forEach(function (l) {
    set[l] = 1;
  });
  colCheckApply({ set: set, un: {}, blank: {}, g: loadGen, from: 'tick' });
}
