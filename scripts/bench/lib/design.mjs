// From a drawn Raster to what the benchmark scores against (scripts/bench):
//  - TRUTH: the clean drawing's paper after a morphological closing, so a passage narrower than about half a line (at
//    most 1.5 px) is closed in truth as it is on paper (the first pressure test's N1). One truth per page: the sections
//    on paper don't change with the size the page is downloaded at; paper specks under a page pixel aren't sections.
//  - AMBIGUITY, per size: regions that a stronger closing (about a whole line, at most 4 px, at least 1.5 input pixels)
//    splits apart or all but fills (slivers: what that size can't show), and pairs a weaker closing (half truth's
//    radius) joins, are near-tangent: a don't-care (flagged, counted, never a defect, left out of the matched share).
//  - TAGS per truth region: drawing | margin (paper outside the drawing's envelope AND touching the page's edge, or a
//    page corner for styles with a printed border) | frameInterior (paper inside a frame round the drawing: answer 5).
//  - PAIRS each hazard stroke separates (merges are attributed to the hazard whose pair it is).
//  - COLOURED regions (a partly coloured page: answer 4).
// Every size is derived from the same hi-res layers, through the app's own size rules (fitSource, UPSIDE enlargement).
const INF = 1e20,
  BIG = 1e12; // BIG: 'no source' (finite, so the envelope maths stays exact)

// squared Euclidean distance transform (Felzenszwalb & Huttenlocher) of a mask: 0 where src[p] === on, else the squared
// distance to the nearest such pixel. Pixels outside the image are not sources.
export function edt2(src, on, W, H) {
  const out = new Float32Array(W * H),
    n = Math.max(W, H),
    f = new Float64Array(n),
    d = new Float64Array(n);
  const v = new Int32Array(n),
    z = new Float64Array(n + 1);
  const pass = (len) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let p = v[k],
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      while (s <= z[k]) {
        k--;
        p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  };
  // columns
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = src[y * W + x] === on ? 0 : BIG;
    pass(H);
    for (let y = 0; y < H; y++) out[y * W + x] = d[y];
  }
  // rows
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) f[x] = out[r + x];
    pass(W);
    for (let x = 0; x < W; x++) out[r + x] = d[x];
  }
  return out;
}

// 4-connected labels of the paper (mask 0); -1 on ink. {lab, n, area (hi px)}
export function labelPaper(ink, W, H) {
  const N = W * H,
    lab = new Int32Array(N).fill(-1),
    st = new Int32Array(N),
    area = [0];
  let cur = 0;
  for (let p = 0; p < N; p++) {
    if (ink[p] || lab[p] !== -1) continue;
    cur++;
    let sp = 0,
      a = 0;
    st[sp++] = p;
    lab[p] = cur;
    while (sp) {
      const q = st[--sp];
      a++;
      const x = q % W;
      if (x > 0 && !ink[q - 1] && lab[q - 1] === -1) {
        lab[q - 1] = cur;
        st[sp++] = q - 1;
      }
      if (x < W - 1 && !ink[q + 1] && lab[q + 1] === -1) {
        lab[q + 1] = cur;
        st[sp++] = q + 1;
      }
      if (q >= W && !ink[q - W] && lab[q - W] === -1) {
        lab[q - W] = cur;
        st[sp++] = q - W;
      }
      if (q < N - W && !ink[q + W] && lab[q + W] === -1) {
        lab[q + W] = cur;
        st[sp++] = q + W;
      }
    }
    area.push(a);
  }
  return { lab, n: cur, area };
}

// paper specks under one page pixel (hi-res area < minArea) are not sections: made ink (don't-care), labels renumbered
function dropSpecks(L, minArea) {
  if (!L.area.some((a, l) => l > 0 && a < minArea)) return L;
  const map = new Int32Array(L.n + 1).fill(-1),
    area = [0];
  for (let l = 1; l <= L.n; l++)
    if (L.area[l] >= minArea) {
      map[l] = area.length;
      area.push(L.area[l]);
    }
  const lab = L.lab;
  for (let p = 0; p < lab.length; p++) if (lab[p] > 0) lab[p] = map[lab[p]];
  return { lab, n: area.length - 1, area };
}

// the app's own size rules for a picture of the person's own w0 x h0: fitSource (MAXSIDE 2400 long side) then the
// UPSIDE enlargement (20-image-input processSrc: min(8, MAXSIDE/long, max(1, UPSIDE/long)), only when over 1.05)
export const MAXSIDE = 2400,
  UPSIDE = 1600;
export function appSize(w0, h0) {
  let w = w0,
    h = h0;
  const s = MAXSIDE / Math.max(w, h);
  if (s < 1) {
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const up = Math.min(8, MAXSIDE / Math.max(w, h), Math.max(1, UPSIDE / Math.max(w, h)));
  if (up > 1.05)
    return { inW: w, inH: h, W: Math.round(w * up), H: Math.round(h * up), srcK: Math.round(w * up) / w };
  return { inW: w, inH: h, W: w, H: h, srcK: 1 };
}

// closing radii (hi-res px, not rounded: a whole-pixel radius sits exactly on common gap widths and leaves them half
// closed) for a page reaching the app at input width inW
export function radii(R, inW) {
  const S = R.S,
    perIn = R.W / inW; // design px per input px
  return {
    // truth's closing, one per page: a quarter of a line, but never over 0.75 px (the app's ink doesn't grow with the
    // line, so a 4 px passage between two 12 px lines is open on paper and in the app alike)
    r1: Math.max(1, S * Math.min(R.lw / 4, 0.75)),
    // the ambiguity band's, per size: about a line (at most 2 px), and at least 1.5 pixels of the picture as it came
    r2: Math.max(2, S * Math.max(Math.min(R.lw / 2, 2), 1.5 * perIn)),
  };
}
// the weaker closing for the other side of the near-tangent band: half of r1
export function radius0(r1) {
  return r1 / 2 < 0.75 ? 0 : r1 / 2;
}

// The hi-res products of a finished Raster, computed lazily per closing radius.
export class Design {
  constructor(R, meta = {}) {
    this.R = R;
    this.meta = meta;
    this._d2ink = null;
    this._lab = new Map();
    this.rgb = null; // hi-res RGB (Uint8 x3) when coloured in, else null (grey = R.dark)
    this.colouredBase = null; // Set of base-labelling labels coloured in
  }
  d2ink() {
    return this._d2ink || (this._d2ink = edt2(this.R.clean, 1, this.R.HW, this.R.HH));
  }
  // the closed clean mask's paper labels at radius r (hi px)
  labelsAt(r) {
    if (this._lab.has(r)) return this._lab.get(r);
    const { HW, HH } = this.R,
      N = HW * HH;
    if (r === 0) {
      const L0 = dropSpecks(labelPaper(this.R.clean, HW, HH), this.R.S * this.R.S);
      this._lab.set(0, L0);
      return L0;
    }
    const D = this.d2ink(),
      r2 = r * r;
    const notDil = new Uint8Array(N);
    for (let p = 0; p < N; p++) notDil[p] = D[p] > r2 ? 1 : 0;
    const E = edt2(notDil, 1, HW, HH),
      ink = new Uint8Array(N);
    for (let p = 0; p < N; p++) ink[p] = this.R.clean[p] || (!notDil[p] && E[p] > r2) ? 1 : 0;
    const L = dropSpecks(labelPaper(ink, HW, HH), this.R.S * this.R.S);
    this._lab.set(r, L);
    return L;
  }
  drop(r) {
    this._lab.delete(r);
  }
  // tags per label of labelling L: 'drawing' | 'margin' | 'frameInterior'
  tags(L) {
    const R = this.R,
      { HW, HH, S } = R,
      { lab, n, area } = L,
      tag = new Array(n + 1).fill('drawing');
    const edge = new Set();
    for (let x = 0; x < HW; x++) {
      edge.add(lab[x]);
      edge.add(lab[(HH - 1) * HW + x]);
    }
    for (let y = 0; y < HH; y++) {
      edge.add(lab[y * HW]);
      edge.add(lab[y * HW + HW - 1]);
    }
    edge.delete(-1);
    if (R.marginRule === 'envelope' && R.envelope) {
      const outside = new Float64Array(n + 1);
      for (let y = 0; y < HH; y += 3)
        for (let x = 0; x < HW; x += 3) {
          const l = lab[y * HW + x];
          if (l > 0 && R.envelope.sdf((x + 0.5) / S, (y + 0.5) / S) > 0) outside[l] += 9;
        }
      for (let l = 1; l <= n; l++) if (outside[l] > 0.02 * area[l] && edge.has(l)) tag[l] = 'margin';
    } else if (R.marginRule === 'corners') {
      for (const p of [0, HW - 1, (HH - 1) * HW, HH * HW - 1]) if (lab[p] > 0) tag[lab[p]] = 'margin';
    }
    let frameLabel = 0;
    if (R.frameBox) {
      const fb = R.frameBox,
        l = lab[Math.round((fb.y0 + 4) * S) * HW + Math.round(((fb.x0 + fb.x1) / 2) * S)];
      if (l > 0 && tag[l] !== 'margin') {
        tag[l] = 'frameInterior';
        frameLabel = l;
      }
    }
    return { tag, edge, frameLabel };
  }
  // pairs of labels each hazard stroke separates, in labelling L
  pairs(L) {
    const R = this.R,
      { HW, HH, S } = R,
      lab = L.lab,
      out = [];
    for (const s of R.sepStrokes) {
      const pairs = new Map(),
        pts = s.pts,
        off = (s.lw / 2 + 2.5) * S;
      const g = (sx, sy) => {
        const xx = Math.round(sx),
          yy = Math.round(sy);
        return xx < 0 || yy < 0 || xx >= HW || yy >= HH ? -1 : lab[yy * HW + xx];
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1][0] - pts[i][0],
          dy = pts[i + 1][1] - pts[i][1],
          len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        const nx = -dy / len,
          ny = dx / len,
          k = Math.max(1, Math.ceil(len / 2));
        for (let j = 0; j < k; j++) {
          const t = j / k,
            x = (pts[i][0] + dx * t) * S,
            y = (pts[i][1] + dy * t) * S;
          const a = g(x + nx * off, y + ny * off),
            b = g(x - nx * off, y - ny * off);
          if (a > 0 && b > 0 && a !== b) {
            const key = a < b ? a + ':' + b : b + ':' + a;
            pairs.set(key, (pairs.get(key) || 0) + 1);
          }
        }
      }
      out.push({
        hazard: s.hazard,
        pairs: [...pairs].filter(([, c]) => c >= 3).map(([k]) => k.split(':').map(Number)),
      });
    }
    return out;
  }
  // labels of L that the stronger closing L2 splits into two or more real parts (near-tangent), or fills: ambiguous
  ambiguous(L, L2) {
    const { lab, n, area } = L,
      lab2 = L2.lab,
      N = lab.length,
      minPart = Math.max(9 * this.R.S * this.R.S, (this.R.lw * this.R.S) ** 2);
    const parts = new Map(),
      kept = new Float64Array(n + 1);
    for (let p = 0; p < N; p += 2) {
      const a = lab[p],
        b = lab2[p];
      if (a < 1 || b < 1) continue;
      kept[a] += 2;
      const k = a * 4194304 + b; // a, b < 2^22
      parts.set(k, (parts.get(k) || 0) + 2);
    }
    const count = new Int32Array(n + 1);
    for (const [k, c] of parts) {
      const a = Math.floor(k / 4194304);
      if (c >= minPart && c >= 0.04 * area[a]) count[a]++;
    }
    const amb = new Set(),
      slivers = new Set();
    // (and slivers: a region the stronger closing all but fills is narrower than about a line everywhere, or than a
    // pixel and a half of the picture as it came: whether it shows is a toss-up, for the app and for the eye)
    for (let l = 1; l <= n; l++) {
      if (kept[l] < 0.2 * area[l]) slivers.add(l);
      if (count[l] >= 2 || slivers.has(l)) amb.add(l);
    }
    amb.slivers = slivers;
    return amb;
  }
  // pairs of labels of L that a weaker closing L0 joins: the line between them nearly opens (near-tangent the other way:
  // a merge across it is a don't-care)
  ambiguousPairs(L, L0) {
    const { lab, area } = L,
      lab0 = L0.lab,
      N = lab.length,
      minPart = Math.max(9 * this.R.S * this.R.S, (this.R.lw * this.R.S) ** 2);
    const parts = new Map();
    for (let p = 0; p < N; p += 2) {
      const a = lab0[p],
        b = lab[p];
      if (a < 1 || b < 1) continue;
      const k = a * 4194304 + b;
      parts.set(k, (parts.get(k) || 0) + 2);
    }
    const by = new Map();
    for (const [k, c] of parts) {
      const a = Math.floor(k / 4194304),
        b = k % 4194304;
      if (c >= minPart && c >= 0.04 * area[b]) (by.get(a) || by.set(a, []).get(a)).push(b);
    }
    const out = new Set();
    for (const ls of by.values())
      for (let i = 0; i < ls.length; i++)
        for (let j = i + 1; j < ls.length; j++)
          out.add(ls[i] < ls[j] ? ls[i] + ':' + ls[j] : ls[j] + ':' + ls[i]);
    return [...out].map((k) => k.split(':').map(Number));
  }
  // which labels of L lie (by majority) in a coloured-in base region
  colouredIn(L) {
    if (!this.colouredBase) return new Set();
    const base = this.labelsAt(this.baseR).lab,
      { lab, n } = L,
      inCol = new Float64Array(n + 1),
      tot = new Float64Array(n + 1);
    for (let p = 0; p < lab.length; p += 3) {
      const l = lab[p];
      if (l < 1) continue;
      tot[l]++;
      if (this.colouredBase.has(base[p])) inCol[l]++;
    }
    const s = new Set();
    for (let l = 1; l <= n; l++) if (tot[l] && inCol[l] > 0.5 * tot[l]) s.add(l);
    return s;
  }
}

// box-filter a hi-res layer to w x h (grey: one channel; rgb: three)
export function boxDown(src, HW, HH, w, h, ch = 1) {
  const out = new Uint8Array(w * h * ch),
    kx = HW / w,
    ky = HH / h;
  const xs = [],
    ys = [];
  for (let x = 0; x <= w; x++) xs.push(x * kx);
  for (let y = 0; y <= h; y++) ys.push(y * ky);
  const acc = new Float64Array(w * ch),
    wsum = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    acc.fill(0);
    wsum.fill(0);
    const ya = ys[y],
      yb = ys[y + 1];
    for (let yy = Math.floor(ya); yy < Math.min(HH, Math.ceil(yb)); yy++) {
      const wy = Math.min(yb, yy + 1) - Math.max(ya, yy);
      if (wy <= 0) continue;
      const row = yy * HW;
      for (let x = 0; x < w; x++) {
        const xa = xs[x],
          xb = xs[x + 1];
        for (let xx = Math.floor(xa); xx < Math.min(HW, Math.ceil(xb)); xx++) {
          const wx = Math.min(xb, xx + 1) - Math.max(xa, xx);
          if (wx <= 0) continue;
          const wgt = wx * wy,
            p = (row + xx) * ch;
          wsum[x] += wgt;
          for (let c = 0; c < ch; c++) acc[x * ch + c] += src[p + c] * wgt;
        }
      }
    }
    for (let x = 0; x < w; x++)
      for (let c = 0; c < ch; c++) out[(y * w + x) * ch + c] = Math.round(acc[x * ch + c] / wsum[x]);
  }
  return out;
}

// truth at w x h from a hi-res labelling: a pixel is a section's when every hi-res sample it covers is that section's,
// else -1 (ink, or a boundary pixel: don't-care)
export function truthDown(lab, HW, HH, w, h) {
  const out = new Int32Array(w * h),
    kx = HW / w,
    ky = HH / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * ky + 1e-9),
      y1 = Math.min(HH, Math.ceil((y + 1) * ky - 1e-9));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * kx + 1e-9),
        x1 = Math.min(HW, Math.ceil((x + 1) * kx - 1e-9));
      let l0 = -2;
      for (let yy = y0; yy < y1 && l0 !== -1; yy++) {
        const row = yy * HW;
        for (let xx = x0; xx < x1; xx++) {
          const l = lab[row + xx];
          if (l0 === -2) l0 = l;
          else if (l0 !== l) {
            l0 = -1;
            break;
          }
        }
      }
      out[y * w + x] = l0 < 0 ? -1 : l0;
    }
  }
  return out;
}
