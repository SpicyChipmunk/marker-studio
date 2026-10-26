/* ---- (v325) A colouring page from any photo ----
    Any photo becomes a page of closed sections, each one of your markers, then a guide like any other
    (docs/PLAN-photo-to-page.md: the decisions, and the spike they came from). The photo is smoothed (keeping its
    edges), grouped by the markers that cover it best (so two touching sections never share a marker), split into
    areas, and the areas too small or too narrow to colour are merged into their most alike neighbour, until the
    Detail step's smallest width holds and its ceiling isn't passed. Out comes a section map in the app's own form
    (a line between sections, labelled as a photographed page's ink is), so everything after it works unchanged.
    The pure steps (pp*Core, below the marker) run in the JOBS worker, or on the page where there's none; the rest
    puts the page in place and gives it its controls. */

// ---- the builder's steps: pure functions of what they're given, no state of the guide's (copied into the worker,
// ppWorkerSrc) ----
// @@pp-core-start

// RGB (0-255) to CIE L*a*b* (D65), through a 64-level-per-channel table worked out once (as the Photo pattern's
// rgbLab: the same colours, a marker step's error at most)
function ppLabTable() {
  if (self._ppLabT) return self._ppLabT;
  const T = new Float32Array(64 * 64 * 64 * 3),
    f = function (v) {
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
      for (let B = 0; B < 64; B++) {
        const rr = lin[R],
          gg = lin[G],
          bb = lin[B],
          x = t((rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047),
          y = t(rr * 0.2126 + gg * 0.7152 + bb * 0.0722),
          z = t((rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883),
          j = ((R * 64 + G) * 64 + B) * 3;
        T[j] = 116 * y - 16;
        T[j + 1] = 500 * (x - y);
        T[j + 2] = 200 * (y - z);
      }
  self._ppLabT = T;
  return T;
}
// The photo smoothed, its edges kept: two passes of a bilateral filter at half size, then back to full size. (The
// spike's mean-shift filter took 80% of its time and made the same pages: counts within 10%, the same likeness.)
// rgb: w × h × 3 bytes. Returns w × h × 3 bytes.
function ppSmoothCore(rgb, w, h) {
  const hw = Math.max(1, w >> 1),
    hh = Math.max(1, h >> 1);
  let a = new Float32Array(hw * hh * 3);
  // (each half-size pixel the mean of the 2 × 2 under it; a last odd row or column is left out, as it's half a pixel)
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < hw; x++) {
      const o = (y * hw + x) * 3;
      for (let c = 0; c < 3; c++) {
        let s = 0,
          k = 0;
        for (let dy = 0; dy < 2; dy++) {
          const yy = Math.min(h - 1, y * 2 + dy);
          for (let dx = 0; dx < 2; dx++) {
            const xx = Math.min(w - 1, x * 2 + dx);
            s += rgb[(yy * w + xx) * 3 + c];
            k++;
          }
        }
        a[o + c] = s / k;
      }
    }
  // the bilateral filter: radius 3, spatial sigma 5 (half-size pixels), colour sigma 30 (RGB units)
  const R = 3,
    sw = new Float32Array((2 * R + 1) * (2 * R + 1)),
    cw = new Float32Array(3 * 255 * 255 + 1);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++)
      sw[(dy + R) * (2 * R + 1) + dx + R] = Math.exp(-(dx * dx + dy * dy) / (2 * 25));
  for (let d2 = 0; d2 < cw.length; d2++) cw[d2] = Math.exp(-d2 / (2 * 900));
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length);
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < hw; x++) {
        const o = (y * hw + x) * 3,
          r0 = a[o],
          g0 = a[o + 1],
          b0 = a[o + 2];
        let sr = 0,
          sg = 0,
          sb = 0,
          sum = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= hh) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= hw) continue;
            const q = (yy * hw + xx) * 3,
              dr = a[q] - r0,
              dg = a[q + 1] - g0,
              db = a[q + 2] - b0,
              d2 = (dr * dr + dg * dg + db * db) | 0,
              wgt = sw[(dy + R) * (2 * R + 1) + dx + R] * cw[d2 < cw.length ? d2 : cw.length - 1];
            sr += a[q] * wgt;
            sg += a[q + 1] * wgt;
            sb += a[q + 2] * wgt;
            sum += wgt;
          }
        }
        b[o] = sr / sum;
        b[o + 1] = sg / sum;
        b[o + 2] = sb / sum;
      }
    a = b;
  }
  // back to full size, bilinear
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(hh - 1, Math.max(0, (y + 0.5) / 2 - 0.5)),
      y0 = Math.floor(fy),
      y1 = Math.min(hh - 1, y0 + 1),
      ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(hw - 1, Math.max(0, (x + 0.5) / 2 - 0.5)),
        x0 = Math.floor(fx),
        x1 = Math.min(hw - 1, x0 + 1),
        tx = fx - x0,
        o = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v =
          (a[(y0 * hw + x0) * 3 + c] * (1 - tx) + a[(y0 * hw + x1) * 3 + c] * tx) * (1 - ty) +
          (a[(y1 * hw + x0) * 3 + c] * (1 - tx) + a[(y1 * hw + x1) * 3 + c] * tx) * ty;
        out[o + c] = v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0;
      }
    }
  }
  return out;
}
// CIEDE2000 (colour.js's de2000, without its split): copied here so the worker has it
function ppDe(a0, a1, a2, b0, b1, b2) {
  const rad = Math.PI / 180,
    C1 = Math.hypot(a1, a2),
    C2 = Math.hypot(b1, b2),
    Cm7 = Math.pow((C1 + C2) / 2, 7),
    G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625))),
    ap1 = (1 + G) * a1,
    ap2 = (1 + G) * b1,
    Cp1 = Math.hypot(ap1, a2),
    Cp2 = Math.hypot(ap2, b2);
  let hp1 = Math.atan2(a2, ap1) / rad,
    hp2 = Math.atan2(b2, ap2) / rad;
  if (hp1 < 0) hp1 += 360;
  if (hp2 < 0) hp2 += 360;
  const dL = b0 - a0,
    dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad),
    Lm = (a0 + b0) / 2,
    Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2) {
    if (Math.abs(hp1 - hp2) > 180) hm += hm < 360 ? 360 : -360;
    hm /= 2;
  }
  const T =
      1 -
      0.17 * Math.cos((hm - 30) * rad) +
      0.24 * Math.cos(2 * hm * rad) +
      0.32 * Math.cos((3 * hm + 6) * rad) -
      0.2 * Math.cos((4 * hm - 63) * rad),
    dth = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2)),
    Cpm7 = Math.pow(Cpm, 7),
    RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 6103515625)),
    SL = 1 + (0.015 * (Lm - 50) * (Lm - 50)) / Math.sqrt(20 + (Lm - 50) * (Lm - 50)),
    SC = 1 + 0.045 * Cpm,
    SH = 1 + 0.015 * Cpm * T,
    RT = -Math.sin(2 * dth * rad) * RC;
  return Math.sqrt(
    (dL / SL) * (dL / SL) + (dC / SC) * (dC / SC) + (dH / SH) * (dH / SH) + RT * (dC / SC) * (dH / SH),
  );
}
// Each pixel's marker: the nearest of pal (K markers' L*a*b*, by eye: CIEDE2000) to its smoothed colour, looked up
// by its colour at 32 levels a channel (worked out once for each level the photo has: a few thousand). Then two
// passes of a 3 × 3 majority, so a lone pixel takes its neighbours' marker. Returns w × h marker indices.
function ppQuantCore(sm, w, h, pal, K) {
  const T = ppLabTable(),
    n = w * h,
    near = new Int16Array(32768).fill(-1),
    q = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = sm[i * 3],
      g = sm[i * 3 + 1],
      b = sm[i * 3 + 2],
      key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let m = near[key];
    if (m < 0) {
      // (the level's middle colour)
      const j = ((((r >> 3) * 2 + 1) * 64 + (g >> 3) * 2 + 1) * 64 + (b >> 3) * 2 + 1) * 3,
        L = T[j],
        A = T[j + 1],
        B = T[j + 2];
      let bd = Infinity;
      m = 0;
      for (let k = 0; k < K; k++) {
        const d = ppDe(L, A, B, pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2]);
        if (d < bd) {
          bd = d;
          m = k;
        }
      }
      near[key] = m;
    }
    q[i] = m;
  }
  // (the 3 × 3 majority: the centre kept on a tie)
  const cnt = new Int32Array(K);
  for (let pass = 0; pass < 2; pass++) {
    const o = new Uint8Array(q);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = q[y * w + x];
        let best = c,
          bn = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            cnt[q[yy * w + xx]]++;
          }
        }
        bn = cnt[c];
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const v = q[yy * w + xx];
            if (cnt[v] > bn) {
              bn = cnt[v];
              best = v;
            }
          }
        }
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            cnt[q[yy * w + xx]] = 0;
          }
        }
        o[y * w + x] = best;
      }
    q.set(o);
  }
  return q;
}
// the areas of one marker, each a region (4-connected): region ids 0..R-1 for each pixel, and each region's marker
function ppRegionsCore(q, w, h) {
  const n = w * h,
    L = new Int32Array(n).fill(-1),
    st = new Int32Array(n),
    mk = [];
  let R = 0;
  for (let p = 0; p < n; p++) {
    if (L[p] >= 0) continue;
    const m = q[p];
    let sp = 0;
    st[sp++] = p;
    L[p] = R;
    while (sp) {
      const s = st[--sp],
        x = s % w;
      if (x > 0 && L[s - 1] < 0 && q[s - 1] === m) {
        L[s - 1] = R;
        st[sp++] = s - 1;
      }
      if (x < w - 1 && L[s + 1] < 0 && q[s + 1] === m) {
        L[s + 1] = R;
        st[sp++] = s + 1;
      }
      if (s >= w && L[s - w] < 0 && q[s - w] === m) {
        L[s - w] = R;
        st[sp++] = s - w;
      }
      if (s + w < n && L[s + w] < 0 && q[s + w] === m) {
        L[s + w] = R;
        st[sp++] = s + w;
      }
    }
    mk.push(m);
    R++;
  }
  return { L: L, mk: Int32Array.from(mk), R: R };
}
// the squared distance from each pixel to the nearest pixel where f is 0 (exact, Felzenszwalb and Huttenlocher's two
// passes of a 1-D lower envelope)
function ppEdtCore(f, w, h) {
  const INF = 1e20,
    d = new Float64Array(w * h),
    nmax = Math.max(w, h),
    v = new Int32Array(nmax),
    z = new Float64Array(nmax + 1),
    g = new Float64Array(nmax),
    o = new Float64Array(nmax);
  for (let i = 0; i < w * h; i++) d[i] = f[i] ? INF : 0;
  const pass = function (n) {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      o[q] = (q - v[k]) * (q - v[k]) + g[v[k]];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) g[y] = d[y * w + x];
    pass(h);
    for (let y = 0; y < h; y++) d[y * w + x] = o[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) g[x] = d[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) d[y * w + x] = o[x];
  }
  return d;
}
// Merge the regions (L: ids 0..R-1, mk: each one's marker) until none is too small or too narrow:
//   - two touching regions with the same marker are one region (always, first)
//   - a region under minArea pixels, or whose widest inside circle is under minR across its half (its radius), joins
//     the neighbour most like it (the markers' difference by eye, over the square root of the border they share:
//     a long border makes a better home); the smallest go first
//   - past the ceiling (cap regions), minArea grows and it goes on
// sal (optional): how much each pixel is the photo's subject (0-1, v325.1 Focus); areaK: [subject, rest] scales for
// minArea; pal: the markers' L*a*b*. (v326) bgK (Subject only, else -1): the background's marker index (the paper):
// a background region is never small or narrow, nor a home for a small one, so the subject's edge isn't handed to
// it (0.4-6.4% of the subject had been, the photo's background made white first instead); a small region with
// only the background round it goes into it, so no speck is left to colour. Changes L in place. Returns
// { L, mk, R, minArea }.
function ppMergeCore(L, mk0, w, h, pal, o) {
  const n = w * h;
  let mk = mk0,
    R = mk.length,
    minArea = o.minArea;
  const minR2 = o.minR * o.minR,
    // (union-find over the current ids)
    find = function (par, x) {
      while (par[x] !== x) {
        par[x] = par[par[x]];
        x = par[x];
      }
      return x;
    },
    // the current ids made 0..R-1 again (in order of first appearance), each keeping its root's marker
    relabel = function (par) {
      const map = new Int32Array(R).fill(-1),
        nm = [];
      let k = 0;
      for (let i = 0; i < n; i++) {
        const r = find(par, L[i]);
        let t = map[r];
        if (t < 0) {
          t = map[r] = k++;
          nm.push(mk[r]);
        }
        L[i] = t;
      }
      mk = Int32Array.from(nm);
      R = k;
    },
    // each pair of touching regions and how long their border is (pixels side by side)
    borders = function () {
      const B = new Map();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = y * w + x,
            a = L[p];
          if (x < w - 1) {
            const b = L[p + 1];
            if (a !== b) {
              const k = a < b ? a * 4194304 + b : b * 4194304 + a;
              B.set(k, (B.get(k) || 0) + 1);
            }
          }
          if (y < h - 1) {
            const b = L[p + w];
            if (a !== b) {
              const k = a < b ? a * 4194304 + b : b * 4194304 + a;
              B.set(k, (B.get(k) || 0) + 1);
            }
          }
        }
      return B;
    };
  let iters = 0,
    rounds = 0;
  for (;;) {
    if (++iters > 80) break;
    const B = borders();
    // (1) same-marker neighbours: one region
    let par = new Int32Array(R);
    for (let i = 0; i < R; i++) par[i] = i;
    let joined = false;
    B.forEach(function (c, k) {
      const a = Math.floor(k / 4194304),
        b = k - a * 4194304;
      if (mk[a] === mk[b]) {
        const ra = find(par, a),
          rb = find(par, b);
        if (ra !== rb) {
          par[ra] = rb;
          joined = true;
        }
      }
    });
    if (joined) {
      relabel(par);
      continue;
    }
    // (2) the small, then (once none is) the narrow: the widest circle inside each region, from the distance to its
    // edge (worked out only when no region is too small, as it's the slowest step)
    const area = new Int32Array(R);
    for (let i = 0; i < n; i++) area[L[i]]++;
    let ma = null;
    if (o.sal) {
      // (Focus: a region mostly on the subject may be smaller, one mostly off it bigger; never narrower than minR)
      const s = new Float64Array(R);
      for (let i = 0; i < n; i++) s[L[i]] += o.sal[i];
      ma = new Float64Array(R);
      for (let r = 0; r < R; r++)
        ma[r] = minArea * (s[r] / Math.max(1, area[r]) > 0.5 ? o.areaK[0] : o.areaK[1]);
    }
    const small = new Uint8Array(R),
      bgK = o.bgK >= 0 ? o.bgK : -1;
    let ns = 0;
    for (let r = 0; r < R; r++)
      if (mk[r] !== bgK && area[r] < (ma ? ma[r] : minArea)) {
        small[r] = 1;
        ns++;
      }
    if (!ns) {
      const edge = new Uint8Array(n);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = y * w + x,
            a = L[p];
          // (a region's inside: not next to another region; the picture's edge counts as inside, so a region along
          // it isn't judged narrow for being cut by the frame)
          edge[p] =
            (x > 0 && L[p - 1] !== a) ||
            (x < w - 1 && L[p + 1] !== a) ||
            (y > 0 && L[p - w] !== a) ||
            (y < h - 1 && L[p + w] !== a)
              ? 0
              : 1;
        }
      const D = ppEdtCore(edge, w, h),
        r2 = new Float64Array(R);
      for (let i = 0; i < n; i++) if (D[i] > r2[L[i]]) r2[L[i]] = D[i];
      for (let r = 0; r < R; r++)
        if (mk[r] !== bgK && r2[r] < minR2) {
          small[r] = 1;
          ns++;
        }
    }
    if (!ns) {
      // (3) the ceiling
      if (o.cap && R > o.cap * 1.05 && rounds < 8) {
        rounds++;
        minArea *= Math.pow(R / o.cap, 1.1);
        continue;
      }
      break;
    }
    // each small region's best neighbour (never the background, Subject only: its own neighbour there, for a region
    // with no other, nearBg)
    const bestS = new Float64Array(R).fill(Infinity),
      bestN = new Int32Array(R).fill(-1),
      nearBg = bgK >= 0 ? new Int32Array(R).fill(-1) : null;
    B.forEach(function (c, k) {
      const a = Math.floor(k / 4194304),
        b = k - a * 4194304;
      if (nearBg && (mk[a] === bgK || mk[b] === bgK)) {
        if (mk[a] === bgK && mk[b] !== bgK) nearBg[b] = a;
        else if (mk[b] === bgK && mk[a] !== bgK) nearBg[a] = b;
        return;
      }
      const ma0 = mk[a] * 3,
        mb0 = mk[b] * 3,
        dl = pal[ma0] - pal[mb0],
        da = pal[ma0 + 1] - pal[mb0 + 1],
        db = pal[ma0 + 2] - pal[mb0 + 2],
        s = Math.sqrt(dl * dl + da * da + db * db) / Math.sqrt(c);
      if (small[a] && s < bestS[a]) {
        bestS[a] = s;
        bestN[a] = b;
      }
      if (small[b] && s < bestS[b]) {
        bestS[b] = s;
        bestN[b] = a;
      }
    });
    if (nearBg)
      for (let r = 0; r < R; r++) if (small[r] && bestN[r] < 0 && nearBg[r] >= 0) bestN[r] = nearBg[r];
    const ord = [];
    for (let r = 0; r < R; r++) if (small[r] && bestN[r] >= 0) ord.push(r);
    if (!ord.length) break;
    ord.sort(function (a, b) {
      return area[a] - area[b] || a - b;
    });
    par = new Int32Array(R);
    for (let i = 0; i < R; i++) par[i] = i;
    // (a region joins its neighbour's set; that set keeps the neighbour's marker: the root is the neighbour's)
    ord.forEach(function (r) {
      const ra = find(par, r),
        rb = find(par, bestN[r]);
      if (ra !== rb) par[ra] = rb;
    });
    relabel(par);
  }
  return { L: L, mk: mk, R: R, minArea: minArea };
}
// The thin parts of the regions given to their neighbours: a pixel whose region is T pixels or less across it, along
// a row, a column or either diagonal, takes the region most of its eight neighbours have (one of another region), a
// few passes over (a tail, a neck, a sliver between two others: too narrow to colour, and narrower at the guide's
// size than its line). Then each region's parts are regions of their own again (4-connected). (v326) bgK (Subject
// only, else -1): the background's marker: its pixels keep it, and none takes it. Returns { L, mk, R }.
function ppThinCore(L, mk, w, h, T, bgK) {
  if (bgK == null) bgK = -1;
  const n = w * h,
    run = new Uint16Array(n),
    best = new Uint16Array(n),
    dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
  for (let pass = 0; pass < 4; pass++) {
    best.fill(65535);
    for (let d = 0; d < 4; d++) {
      const dx = dirs[d][0],
        dy = dirs[d][1];
      run.fill(0);
      // (each pixel's run: walk each line in the direction, measure each run, write its length on its pixels)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (run[p]) continue;
          const px = x - dx,
            py = y - dy;
          // (a run's first pixel: the one before it is another region, or off the picture)
          if (px >= 0 && px < w && py >= 0 && py < h && L[py * w + px] === L[p]) continue;
          let k = 0,
            xx = x,
            yy = y;
          while (xx >= 0 && xx < w && yy >= 0 && yy < h && L[yy * w + xx] === L[p]) {
            k++;
            xx += dx;
            yy += dy;
          }
          // (a run that reaches the picture's edge isn't narrow there: the frame cuts it)
          const edge = !(xx >= 0 && xx < w && yy >= 0 && yy < h) || !(px >= 0 && px < w && py >= 0 && py < h);
          const v = edge ? 65535 : Math.min(65534, k);
          xx = x;
          yy = y;
          for (let i = 0; i < k; i++) {
            const q = yy * w + xx;
            run[q] = v;
            if (v < best[q]) best[q] = v;
            xx += dx;
            yy += dy;
          }
        }
    }
    const nl = L.slice(),
      cnt = new Map();
    let ch = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (best[p] > T) continue;
        if (bgK >= 0 && mk[L[p]] === bgK) continue;
        cnt.clear();
        let b = -1,
          bn = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const r = L[yy * w + xx];
            if (r === L[p] || (bgK >= 0 && mk[r] === bgK)) continue;
            const c = (cnt.get(r) || 0) + 1;
            cnt.set(r, c);
            if (c > bn) {
              bn = c;
              b = r;
            }
          }
        }
        if (b >= 0) {
          nl[p] = b;
          ch++;
        }
      }
    L.set(nl);
    if (!ch) break;
  }
  // (the regions' parts, each a region: by label, 4-connected)
  const out = new Int32Array(n).fill(-1),
    st = new Int32Array(n),
    nm = [];
  let R = 0;
  for (let p = 0; p < n; p++) {
    if (out[p] >= 0) continue;
    const l = L[p];
    let sp = 0;
    st[sp++] = p;
    out[p] = R;
    while (sp) {
      const q = st[--sp],
        x = q % w;
      if (x > 0 && out[q - 1] < 0 && L[q - 1] === l) {
        out[q - 1] = R;
        st[sp++] = q - 1;
      }
      if (x < w - 1 && out[q + 1] < 0 && L[q + 1] === l) {
        out[q + 1] = R;
        st[sp++] = q + 1;
      }
      if (q >= w && out[q - w] < 0 && L[q - w] === l) {
        out[q - w] = R;
        st[sp++] = q - w;
      }
      if (q + w < n && out[q + w] < 0 && L[q + w] === l) {
        out[q + w] = R;
        st[sp++] = q + w;
      }
    }
    nm.push(mk[l]);
    R++;
  }
  return { L: out, mk: Int32Array.from(nm), R: R };
}
// The page at the guide's size (GW × GH) from the merged regions at the working size (w × h): each pixel takes the
// region the working picture has there, its outlines smoothed (near a border, the region with the most weight in a
// small Gaussian round the point: a corner rounds off over about a working pixel), then a line two pixels wide
// between every two regions. The line cuts each region into sections (the flood fill), and a piece cut off too
// small to colour (under fragMin pixels) goes back into the section it was cut from, or the one it touches most.
// Returns { lab: guide-size labels (-1 a line, 1..S a section), S, reg: each section's region, box: 8 numbers a
// section (area, edge pixels, cx, cy, x0, y0, x1, y1) }.
function ppPageCore(L, rmk, w, h, GW, GH, fragMin) {
  const N = GW * GH,
    G = new Int32Array(N),
    sx = w / GW,
    sy = h / GH,
    SIG = 1.2,
    IS2 = 1 / (2 * SIG * SIG),
    // (a working pixel's neighbours' weights, by where in it the point is: eighths each way, 9 × 9 places)
    WT = new Float64Array(81 * 25),
    vr = new Int32Array(25),
    vw = new Float64Array(25),
    // (a working pixel with its own region all round it, two pixels each way: a guide pixel there needs no vote)
    inner = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = L[y * w + x];
      let same = 1;
      for (let dy = -2; dy <= 2 && same; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (L[yy * w + xx] !== c) {
            same = 0;
            break;
          }
        }
      }
      inner[y * w + x] = same;
    }
  for (let ty = 0; ty < 9; ty++)
    for (let tx = 0; tx < 9; tx++)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const ox = dx - (tx / 8 - 0.5),
            oy = dy - (ty / 8 - 0.5);
          WT[(ty * 9 + tx) * 25 + (dy + 2) * 5 + dx + 2] = Math.exp(-(ox * ox + oy * oy) * IS2);
        }
  for (let Y = 0; Y < GH; Y++) {
    const v = (Y + 0.5) * sy - 0.5,
      iy = Math.round(v);
    for (let X = 0; X < GW; X++) {
      const u = (X + 0.5) * sx - 0.5,
        ix = Math.round(u),
        cx = ix < 0 ? 0 : ix >= w ? w - 1 : ix,
        cy = iy < 0 ? 0 : iy >= h ? h - 1 : iy,
        c = L[cy * w + cx];
      // (the same region all round: no border near)
      if (inner[cy * w + cx]) {
        G[Y * GW + X] = c;
        continue;
      }
      // (the weights by region, in two small arrays: at most 25 regions)
      let nv = 0,
        best = c,
        bw = -1;
      // (the weights from a table: the point's place within its working pixel in eighths, each way)
      const tx = Math.max(0, Math.min(8, Math.round((u - ix + 0.5) * 8))),
        ty = Math.max(0, Math.min(8, Math.round((v - iy + 0.5) * 8))),
        wb = (ty * 9 + tx) * 25;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = cy + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = cx + dx;
          if (xx < 0 || xx >= w) continue;
          const r = L[yy * w + xx],
            e = WT[wb + (dy + 2) * 5 + dx + 2];
          let i = 0;
          while (i < nv && vr[i] !== r) i++;
          if (i === nv) {
            vr[nv] = r;
            vw[nv++] = 0;
          }
          const t = (vw[i] += e);
          if (t > bw) {
            bw = t;
            best = r;
          }
        }
      }
      G[Y * GW + X] = best;
    }
  }
  // the lines: a pixel next to (left, right, above, below) one of another region
  const lab = new Int32Array(N);
  for (let Y = 0; Y < GH; Y++)
    for (let X = 0; X < GW; X++) {
      const p = Y * GW + X,
        a = G[p];
      lab[p] =
        (X > 0 && G[p - 1] !== a) ||
        (X < GW - 1 && G[p + 1] !== a) ||
        (Y > 0 && G[p - GW] !== a) ||
        (Y < GH - 1 && G[p + GW] !== a)
          ? -1
          : 0;
    }
  const st = new Int32Array(N);
  let S = 0,
    reg = [],
    box = [];
  // the sections: each run of paper between lines (4-connected), as labelFill finds them
  const fill = function () {
    S = 0;
    reg = [0];
    box = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let p = 0; p < N; p++) if (lab[p] > 0) lab[p] = 0;
    for (let p = 0; p < N; p++) {
      if (lab[p] !== 0) continue;
      S++;
      let sp = 0,
        area = 0,
        bpx = 0,
        sxx = 0,
        syy = 0,
        x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
      st[sp++] = p;
      lab[p] = S;
      while (sp) {
        const q = st[--sp],
          x = q % GW,
          y = (q / GW) | 0;
        area++;
        sxx += x;
        syy += y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) bpx++;
        if (x > 0 && lab[q - 1] === 0) {
          lab[q - 1] = S;
          st[sp++] = q - 1;
        }
        if (x < GW - 1 && lab[q + 1] === 0) {
          lab[q + 1] = S;
          st[sp++] = q + 1;
        }
        if (y > 0 && lab[q - GW] === 0) {
          lab[q - GW] = S;
          st[sp++] = q - GW;
        }
        if (y < GH - 1 && lab[q + GW] === 0) {
          lab[q + GW] = S;
          st[sp++] = q + GW;
        }
      }
      reg.push(G[p]);
      box.push(area, bpx, sxx / area, syy / area, x0, y0, x1, y1);
    }
  };
  fill();
  // Tidying, up to three rounds, the sections found again after each:
  //   - a hole of a few pixels where lines meet becomes line;
  //   - a piece too small to colour goes into the section it touches most (its own region's first);
  //   - two sections either side of a line with the same marker are one (a sliver of another region narrower
  //     than the line had become the line between them, or a region's thin neck was cut);
  // the line pixels between sections made one are taken away.
  const par = [],
    find = function (x) {
      while (par[x] !== x) {
        par[x] = par[par[x]];
        x = par[x];
      }
      return x;
    },
    win = new Int32Array(12),
    // (the 12 places looked at round a line pixel: one and two away along the row and the column, and the four
    // diagonal neighbours. A line is two wide, so the sections either side are up to two away)
    OX = [-1, 1, -2, 2, 0, 0, 0, 0, -1, 1, -1, 1],
    OY = [0, 0, 0, 0, -1, 1, -2, 2, -1, -1, 1, 1],
    around = function (p) {
      const x = p % GW,
        y = (p / GW) | 0;
      let k = 0;
      for (let o = 0; o < 12; o++) {
        const xx = x + OX[o],
          yy = y + OY[o];
        if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
        const s = lab[yy * GW + xx];
        if (s <= 0) continue;
        let i = 0;
        while (i < k && win[i] !== s) i++;
        if (i === k) win[k++] = s;
      }
      return k;
    };
  for (let round = 0; round < 5; round++) {
    par.length = S + 1;
    for (let i = 0; i <= S; i++) par[i] = i;
    const hole = new Uint8Array(S + 1),
      small = new Uint8Array(S + 1);
    let any = false;
    for (let s = 1; s <= S; s++) {
      const a = box[s * 8];
      if (a < 12) hole[s] = 1;
      else if (a < fragMin) small[s] = 1;
    }
    const touch = new Map();
    for (let p = 0; p < N; p++) {
      if (lab[p] !== -1) continue;
      const k = around(p);
      if (k < 2) continue;
      for (let i = 0; i < k; i++) {
        const a = win[i];
        for (let j = 0; j < k; j++) {
          if (i === j) continue;
          const b = win[j];
          if (small[a] && !hole[b]) {
            const key = a * 4194304 + b;
            touch.set(key, (touch.get(key) || 0) + 1);
          }
          // (the same marker either side: one section)
          if (i < j && rmk[reg[a]] === rmk[reg[b]] && !hole[a] && !hole[b]) {
            const ra = find(a),
              rb = find(b);
            if (ra !== rb) {
              par[ra] = rb;
              any = true;
            }
          }
        }
      }
    }
    const into = new Int32Array(S + 1),
      bc = new Float64Array(S + 1);
    touch.forEach(function (c, key) {
      const a = Math.floor(key / 4194304),
        b = key - a * 4194304,
        sc = c + (reg[a] === reg[b] ? 1e6 : 0) + (small[b] ? 0 : 1e3);
      if (sc > bc[a]) {
        bc[a] = sc;
        into[a] = b;
      }
    });
    for (let s = 1; s <= S; s++) {
      if (hole[s]) any = true;
      // (a small piece into another small one only if it's the smaller of the two)
      const t = into[s];
      if (!small[s] || !t || (small[t] && box[t * 8] < box[s * 8])) continue;
      const ra = find(s),
        rb = find(t);
      if (ra !== rb) {
        par[ra] = rb;
        any = true;
      }
    }
    if (!any) break;
    const root = new Int32Array(S + 1);
    for (let s = 1; s <= S; s++) root[s] = find(s);
    // (a set takes the region, and so the marker, of its biggest section)
    const big = new Int32Array(S + 1);
    for (let s = 1; s <= S; s++) {
      const r = root[s];
      if (!big[r] || box[s * 8] > box[big[r] * 8]) big[r] = s;
    }
    for (let p = 0; p < N; p++) {
      const s = lab[p];
      if (s <= 0) continue;
      if (hole[s]) {
        lab[p] = -1;
        continue;
      }
      const b = big[root[s]];
      if (b !== s) G[p] = reg[b];
    }
    // the line pixels with only one set round them, by a section that changed
    for (let p = 0; p < N; p++) {
      if (lab[p] !== -1) continue;
      const k = around(p);
      if (!k) continue;
      const r0 = root[win[0]];
      let one = true,
        moved = false;
      for (let i = 0; i < k; i++) {
        if (root[win[i]] !== r0) one = false;
        if (big[root[win[i]]] !== win[i] || root[win[i]] !== win[i]) moved = true;
      }
      if (one && moved && k > 1) {
        lab[p] = 0;
        G[p] = reg[big[r0]];
      } else if (one && moved && k === 1) {
        // (a line pixel beside one section only, which was joined to another: the line was between them, or a
        // small piece's own edge)
        lab[p] = 0;
        G[p] = reg[big[r0]];
      }
    }
    fill();
  }
  // (a hole of a few pixels left after the last round: line too)
  let holes = false;
  for (let s = 1; s <= S; s++) if (box[s * 8] < 12) holes = true;
  if (holes) {
    for (let p = 0; p < N; p++) if (lab[p] > 0 && box[lab[p] * 8] < 12) lab[p] = -1;
    fill();
  }
  return { lab: lab, S: S, reg: Int32Array.from(reg), box: Float64Array.from(box) };
}
// The markers for a page, chosen as the Photo pattern chooses them (46-photo's _photoChoose: a greedy first step, then
// swaps) and in the same job as the page, so none of it holds the screen. m.tl / m.tw: the photo's colours (T × 3
// L*a*b*) and each one's share; m.pl: the markers it may use (P × 3); m.n: how many (0: the photo's own suggestion, as
// 46-photo's PH_SUG_* rule, at most m.mkCap); m.fl: the full range of your brands (to say how many of it suit the photo),
// or null. Returns { chosen: indices into m.pl, n: the count asked for (the pool's size at most), sug: the
// suggestion (0: none), suits: the markers near some colour of the photo, suitsFull: of m.fl }
function ppPickCore(m) {
  const T0 = m.tw.length,
    P0 = m.pl.length / 3,
    CAP = PH_CAP,
    gm = new Map(),
    tg = [];
  // (colours within 1.5 units as one, as _photoPrep)
  for (let i = 0; i < T0; i++) {
    const a0 = m.tl[i * 3],
      a1 = m.tl[i * 3 + 1],
      a2 = m.tl[i * 3 + 2],
      k = Math.round(a0 / 1.5) + '|' + Math.round(a1 / 1.5) + '|' + Math.round(a2 / 1.5);
    let j = gm.get(k);
    if (j == null) {
      j = tg.length;
      gm.set(k, j);
      tg.push({ lab: [a0, a1, a2], w: 0 });
    }
    tg[j].w += m.tw[i];
  }
  const T = tg.length,
    near = function (L, j) {
      for (let i = 0; i < T; i++) {
        const a = tg[i].lab;
        if (ppDe(a[0], a[1], a[2], L[j * 3], L[j * 3 + 1], L[j * 3 + 2]) < CAP) return true;
      }
      return false;
    },
    idx = [];
  for (let j = 0; j < P0; j++) if (near(m.pl, j)) idx.push(j);
  let suitsFull = 0;
  if (m.fl) for (let j = 0, F = m.fl.length / 3; j < F; j++) if (near(m.fl, j)) suitsFull++;
  const P = idx.length;
  let n = m.n,
    sug = 0;
  if (!P) {
    // (no marker near any colour: each colour's nearest, the n most of the photo would take, as photoPick)
    const wt = new Float64Array(P0);
    for (let i = 0; i < T; i++) {
      const a = tg[i].lab;
      let bj = 0,
        bd = Infinity;
      for (let j = 0; j < P0; j++) {
        const d = ppDe(a[0], a[1], a[2], m.pl[j * 3], m.pl[j * 3 + 1], m.pl[j * 3 + 2]);
        if (d < bd) {
          bd = d;
          bj = j;
        }
      }
      wt[bj] += tg[i].w;
    }
    n = Math.max(1, Math.min(n || m.mkCap, P0));
    const ch = [];
    for (let j = 0; j < P0; j++) if (wt[j] > 0) ch.push(j);
    ch.sort(function (a, b) {
      return wt[b] - wt[a];
    });
    return { chosen: Int32Array.from(ch.slice(0, n)), n: n, sug: 0, suits: 0, suitsFull: suitsFull };
  }
  const D = new Float32Array(T * P);
  for (let i = 0; i < T; i++) {
    const a = tg[i].lab;
    for (let j = 0; j < P; j++) {
      const q = idx[j] * 3;
      D[i * P + j] = Math.min(CAP, ppDe(a[0], a[1], a[2], m.pl[q], m.pl[q + 1], m.pl[q + 2]));
    }
  }
  if (!n) {
    // the fewest that get as close as all of them can on PH_SUG_SHARE of the photo (as ppSuggest did, 46-photo's rule)
    if (P === 1) sug = 1;
    else {
      const best = new Float32Array(T),
        cur = new Float32Array(T).fill(CAP * 1.5),
        used = new Uint8Array(P);
      let Wt = 0;
      for (let i = 0; i < T; i++) {
        let b = Infinity;
        for (let j = 0; j < P; j++) if (D[i * P + j] < b) b = D[i * P + j];
        best[i] = b;
        Wt += tg[i].w;
      }
      const max = Math.min(PH_SUG_MAX, P);
      for (let k = 1; k <= max; k++) {
        const bj = _photoBest(tg, D, P, cur, used);
        if (bj < 0) {
          sug = k - 1;
          break;
        }
        used[bj] = 1;
        for (let i = 0; i < T; i++) if (D[i * P + bj] < cur[i]) cur[i] = D[i * P + bj];
        let ok = 0;
        for (let i = 0; i < T; i++) if (cur[i] <= best[i] + PH_SUG_DE) ok += tg[i].w;
        if (ok >= PH_SUG_SHARE * Wt) {
          sug = k;
          break;
        }
      }
    }
    n = Math.min(sug || m.mkCap, m.mkCap);
  }
  n = Math.max(1, Math.min(n, P0));
  const ch = _photoChoose(tg, D, P, n, false).map(function (j) {
    return idx[j];
  });
  return { chosen: Int32Array.from(ch), n: n, sug: sug, suits: P, suitsFull: suitsFull };
}
// The whole page, for a job (m): the photo's smoothed copy (kept for the next job on the same photo: m.pid), its
// markers, its regions merged for the Detail step, white where the photo is nearer the paper than its marker, and
// the page at the guide's size. m: { pid, rgb, w, h, GW, GH, the marker choice's (ppPickCore: tl, tw, pl, n, mkCap, fl,
// and ck, its key), minArea, minR, cap, minCount, paper ([L, a, b]), fragMin, sal, areaK, bgm (v326 Subject only:
// 1 where the photo is its background) }. Returns the page (ppPageCore's) and, for each section, its marker (an index
// into pick.chosen) and whether it's left white, and with bgm whether it's the background (secBg); R: the regions;
// pick: the marker choice; t: each step's time in ms.
function ppBuildCore(m) {
  const t0 = Date.now(),
    t = {},
    w = m.w,
    h = m.h,
    n = w * h;
  let sm = self._ppSm && self._ppSm.pid === m.pid ? self._ppSm.sm : null;
  if (!sm) {
    sm = ppSmoothCore(m.rgb, w, h);
    self._ppSm = { pid: m.pid, sm: sm };
  }
  t.smooth = Date.now() - t0;
  // the markers (kept for the next job on the same photo and markers: m.ck)
  let pk = self._ppCh && self._ppCh.k === m.ck ? self._ppCh.r : null;
  if (!pk) {
    pk = ppPickCore(m);
    self._ppCh = { k: m.ck, r: pk };
  }
  const K = pk.chosen.length,
    pal = new Float32Array(K * 3);
  for (let i = 0; i < K; i++) {
    const q = pk.chosen[i] * 3;
    pal[i * 3] = m.pl[q];
    pal[i * 3 + 1] = m.pl[q + 1];
    pal[i * 3 + 2] = m.pl[q + 2];
  }
  t.pick = Date.now() - t0 - t.smooth;
  const q = ppQuantCore(sm, w, h, pal, K);
  // (v326 Subject only: the background's pixels a marker of their own, K, the paper's colour, after the smoothing so
  // the subject's edge keeps its own colours)
  const bgK = m.bgm ? K : -1;
  if (m.bgm) {
    for (let i = 0; i < n; i++) if (m.bgm[i]) q[i] = K;
    const p2 = new Float32Array(K * 3 + 3);
    p2.set(pal);
    p2[K * 3] = m.paper[0];
    p2[K * 3 + 1] = m.paper[1];
    p2[K * 3 + 2] = m.paper[2];
    m.pal = p2;
  } else m.pal = pal;
  t.quant = Date.now() - t0 - t.smooth - t.pick;
  const rg = ppRegionsCore(q, w, h),
    base = rg.L.slice();
  let mg = null,
    minArea = m.minArea,
    it = 0;
  for (let k = 0; k < 4; k++) {
    it = k;
    mg = ppMergeCore(k ? base.slice() : rg.L, rg.mk, w, h, m.pal, {
      minArea: minArea,
      minR: m.minR,
      cap: m.cap,
      sal: m.sal || null,
      areaK: m.areaK || [1, 1],
      bgK: bgK,
    });
    // (the thin parts given to their neighbours, then merged again: the pieces they leave, and same-marker
    // neighbours they make)
    const th = ppThinCore(mg.L, mg.mk, w, h, Math.max(2, Math.round(m.minR * 0.5)), bgK);
    mg = ppMergeCore(th.L, th.mk, w, h, m.pal, {
      minArea: mg.minArea,
      minR: m.minR,
      cap: m.cap,
      sal: m.sal || null,
      areaK: m.areaK || [1, 1],
      bgK: bgK,
    });
    // (a finer step never has fewer sections than a coarser one: m.minCount, that one's count)
    if (!m.minCount || mg.R >= m.minCount) break;
    minArea *= 0.75;
  }
  t.merge = Date.now() - t0 - t.smooth - t.pick - t.quant;
  // each region's colour in the photo, and whether the paper is nearer it than its marker
  const T = ppLabTable(),
    R = mg.R,
    acc = new Float64Array(R * 4);
  for (let i = 0; i < n; i++) {
    const j = (((sm[i * 3] >> 2) * 64 + (sm[i * 3 + 1] >> 2)) * 64 + (sm[i * 3 + 2] >> 2)) * 3,
      r = mg.L[i] * 4;
    acc[r] += T[j];
    acc[r + 1] += T[j + 1];
    acc[r + 2] += T[j + 2];
    acc[r + 3]++;
  }
  const white = new Uint8Array(R),
    P = m.paper;
  for (let r = 0; r < R; r++) {
    const c = acc[r * 4 + 3] || 1,
      L0 = acc[r * 4] / c,
      a0 = acc[r * 4 + 1] / c,
      b0 = acc[r * 4 + 2] / c,
      k = mg.mk[r] * 3;
    if (
      mg.mk[r] === bgK ||
      (L0 >= 88 &&
        ppDe(L0, a0, b0, P[0], P[1], P[2]) < ppDe(L0, a0, b0, m.pal[k], m.pal[k + 1], m.pal[k + 2]))
    )
      white[r] = 1;
  }
  const pg = ppPageCore(mg.L, mg.mk, w, h, m.GW, m.GH, m.fragMin || 24),
    S = pg.S,
    secMk = new Int16Array(S + 1).fill(-1),
    secWhite = new Uint8Array(S + 1),
    secBg = new Uint8Array(S + 1);
  for (let s = 1; s <= S; s++) {
    secMk[s] = mg.mk[pg.reg[s]];
    secWhite[s] = white[pg.reg[s]];
    if (secMk[s] === bgK) secBg[s] = 1;
  }
  t.page = Date.now() - t0 - t.smooth - t.pick - t.quant - t.merge;
  t.all = Date.now() - t0;
  return {
    lab: pg.lab,
    S: S,
    box: pg.box,
    secMk: secMk,
    secWhite: secWhite,
    secBg: secBg,
    R: R,
    // (v326: how many times the smallest area was made smaller for m.minCount, 0 when the first try met it: a page
    // kept for another minCount is the same page then, ppMemGet)
    it: it,
    minArea: mg.minArea,
    pick: pk,
    t: t,
  };
}
// (v326) The markers that would help this photo most (docs/PLAN-v326-photo-page.md, 1). Coverage: the share of the
// photo's colours (m.tl / m.tw, the page's own targets, by weight) within 10 by eye (m.de) of a marker in m.pl (the
// markers the page may use); with m.paper, the photo's white areas count as matched by the paper. Then, again and
// again, the candidate (m.cl, catalogue markers you don't own) that matches the most of what's left, while each adds
// 5 points or more (m.step), at most 6 (m.max): from those with m.cg[c] 1 (the brands you'd buy, or your own),
// and with m.both, a second list from all of them. m.ml: the markers the page was made with, for what newer ones
// would add. Returns { own, made (-1 without m.ml), a: { i: candidates, c: the coverage after each }, b (or null) },
// percentages, whole numbers. Lightness more than 20 apart is never within 10 (CIEDE2000's lightness term alone is
// over 10 there), so those pairs aren't measured.
function ppFillCore(m) {
  const T = m.tw.length,
    tl = m.tl,
    tw = m.tw,
    DE = m.de || 10,
    STEP = m.step || 5,
    MAX = m.max || 6;
  let Wt = 0;
  for (let t = 0; t < T; t++) Wt += tw[t];
  if (!Wt) return { own: 0, made: -1, a: { i: [], c: [] }, b: null };
  const pct = function (ok) {
      let s = 0;
      for (let t = 0; t < T; t++) if (ok[t]) s += tw[t];
      return Math.round((100 * s) / Wt);
    },
    cover = function (labs, ok) {
      for (let j = 0, P = labs.length / 3; j < P; j++) {
        const L = labs[j * 3],
          a = labs[j * 3 + 1],
          b = labs[j * 3 + 2];
        for (let t = 0; t < T; t++)
          if (
            !ok[t] &&
            Math.abs(tl[t * 3] - L) < 20 &&
            ppDe(tl[t * 3], tl[t * 3 + 1], tl[t * 3 + 2], L, a, b) < DE
          )
            ok[t] = 1;
      }
    },
    base = new Uint8Array(T);
  if (m.paper)
    for (let t = 0; t < T; t++)
      if (tl[t * 3] >= 88 && Math.hypot(tl[t * 3 + 1], tl[t * 3 + 2]) <= 9) base[t] = 1;
  const own = base.slice();
  cover(m.pl, own);
  let made = -1;
  if (m.ml) {
    const mo = base.slice();
    cover(m.ml, mo);
    made = pct(mo);
  }
  // each candidate's targets, of those your markers don't match
  const C = m.cl.length / 3,
    lists = new Array(C);
  for (let c = 0; c < C; c++) {
    const L = m.cl[c * 3],
      a = m.cl[c * 3 + 1],
      b = m.cl[c * 3 + 2],
      l = [];
    for (let t = 0; t < T; t++)
      if (
        !own[t] &&
        Math.abs(tl[t * 3] - L) < 20 &&
        ppDe(tl[t * 3], tl[t * 3 + 1], tl[t * 3 + 2], L, a, b) < DE
      )
        l.push(t);
    lists[c] = l;
  }
  const pick = function (all) {
    const ok = own.slice(),
      used = new Uint8Array(C),
      out = { i: [], c: [] };
    for (let k = 0; k < MAX; k++) {
      let bc = -1,
        bg = 0;
      for (let c = 0; c < C; c++) {
        if (used[c] || (!all && !m.cg[c])) continue;
        let g = 0;
        const l = lists[c];
        for (let j = 0; j < l.length; j++) if (!ok[l[j]]) g += tw[l[j]];
        if (g > bg) {
          bg = g;
          bc = c;
        }
      }
      if (bc < 0 || (100 * bg) / Wt < STEP) break;
      used[bc] = 1;
      const l = lists[bc];
      for (let j = 0; j < l.length; j++) ok[l[j]] = 1;
      out.i.push(bc);
      out.c.push(pct(ok));
    }
    return out;
  };
  return {
    own: pct(own),
    made: made,
    a: pick(false),
    b: m.both ? pick(true) : null,
    more: m.mcap ? ppMoreCore(m) : null,
  };
}
// (v327) Whether twice the markers would bring back colours the page's lose (docs/PLAN-v327-photo-tones.md, A): the
// marker choice (ppPickCore, the page's own) at the cap, m.mcap, and at twice it, from the markers the page may use
// (m.pl), against the photo's colours (m.tl / m.tw). lost: the share of the photo more than 15 from the cap's markers
// that one of them all matches within 10 (a small object of its own colour gone, as a turquoise glass drawn grey);
// gain: how much nearer the photo's colours are on average with twice the markers. Both as fractions of the photo.
function ppMoreCore(m) {
  const T = m.tw.length,
    P = m.pl.length / 3,
    tl = m.tl,
    tw = m.tw;
  let Wt = 0;
  for (let t = 0; t < T; t++) Wt += tw[t];
  if (!Wt || !P) return { lost: 0, gain: 0 };
  const near = function (chosen, t) {
      let b = Infinity;
      for (let i = 0; i < chosen.length; i++) {
        const q = chosen[i] * 3,
          d = ppDe(tl[t * 3], tl[t * 3 + 1], tl[t * 3 + 2], m.pl[q], m.pl[q + 1], m.pl[q + 2]);
        if (d < b) b = d;
      }
      return b;
    },
    c1 = ppPickCore({ tl: tl, tw: tw, pl: m.pl, n: 0, mkCap: m.mcap, fl: null }).chosen,
    c2 = ppPickCore({ tl: tl, tw: tw, pl: m.pl, n: 0, mkCap: m.mcap * 2, fl: null }).chosen;
  let lost = 0,
    s1 = 0,
    s2 = 0;
  for (let t = 0; t < T; t++) {
    const b1 = near(c1, t),
      b2 = near(c2, t);
    s1 += b1 * tw[t];
    s2 += b2 * tw[t];
    if (b1 > 15) {
      let ba = Infinity;
      for (let j = 0; j < P && ba >= 10; j++) {
        const d = ppDe(
          tl[t * 3],
          tl[t * 3 + 1],
          tl[t * 3 + 2],
          m.pl[j * 3],
          m.pl[j * 3 + 1],
          m.pl[j * 3 + 2],
        );
        if (d < ba) ba = d;
      }
      if (ba < 10) lost += tw[t];
    }
  }
  return { lost: lost / Wt, gain: (s1 - s2) / Wt };
}
// @@pp-core-end

// ---- on the page: the photo-made guide's state, and making its page ----
// The Detail steps (decided in docs/PLAN-photo-to-page.md): the smallest section's width on the printed page (mm),
// about how many sections at most, and the most markers the photo's own suggestion is allowed
const PP_STEPS = [
    { n: 'Very simple', mm: 6, cap: 60, mk: 12 },
    { n: 'Simple', mm: 4, cap: 120, mk: 18 },
    { n: 'Medium', mm: 3, cap: 220, mk: 24 },
    { n: 'Detailed', mm: 2, cap: 400, mk: 36 },
    { n: 'Very detailed', mm: 1.5, cap: 700, mk: 48 },
  ],
  PP_DEF = 2,
  // (the working picture's long side, and the guide's: 2000 is 200 dots an inch over Letter's printed page)
  PP_WORK = 900,
  PP_SIDE = 2000,
  // (the paper the page is printed on: near-white photo areas nearer it than to their marker are left white)
  PP_PAPER = [100, 0, 0],
  // (the most colours of the photo the markers are chosen for: ppPrepare)
  PP_TARGETS = 500;
// The open picture is a photo made into a page (not a photographed colouring page): its settings, saved with the
// guide (payload.pp) and kept in each Undo step of Edit sections. null for any other picture.
//   d: the Detail step (0-4); f: Focus ('even', 'sharp', 'calm': v325.1; 'subject': v326); n: how many markers it was
//   made with; hand: n was set by hand (Markers in this guide), so the photo's suggestion doesn't replace it; paper:
//   the paper it was made for; full: made from the full range of your brands, not only the markers you own; more
//   (v327): Use up to 48 markers, each Detail step's cap doubled (ppCap); add
//   (v326): made with these catalogue markers added to yours (Try it with these: mkeys); made: each section's
//   marker as made ({ section: mkey }); white: the sections left white ({ section: the nearest marker's mkey });
//   sig: the markers it could use, as made (ppSig); sm (v326): which kind of pool that was (ppSigMode); tg (v326):
//   the photo's colours the markers were chosen for ({ l: L*a*b* × T, w: each one's share }), kept so a guide
//   opened again has its markers-to-add line without reading the photo; bgs (v326, Subject only): the sections
//   that are the photo's background
let pp = null;
// the photo as it's made into a page (turned and cropped as it is now): { key, pid, rgb, w, h, GW, GH, ref, targets }
let _ppPrep = null,
  _ppPid = 0,
  _ppGen = 0,
  // (each step's count for the photo prepared: a finer step never has fewer, ppBuildCore's minCount)
  _ppCounts = {},
  // (the suggestion and the chosen markers, kept for the photo prepared and the markers it may use)
  _ppPick = {},
  // (a make is under way: the controls wait)
  _ppBusy = false;
function ppOn() {
  return !!pp;
}
function ppNew() {
  return {
    d: PP_DEF,
    f: 'even',
    n: 0,
    hand: false,
    paper: paper,
    full: false,
    add: null,
    more: false,
    made: null,
    white: null,
    sig: '',
    sm: '',
    tg: null,
    bgs: null,
  };
}
function ppCopy(o) {
  return o
    ? Object.assign({}, o, {
        made: o.made ? Object.assign({}, o.made) : null,
        white: o.white ? Object.assign({}, o.white) : null,
        add: o.add ? o.add.slice() : null,
        bgs: o.bgs ? o.bgs.slice() : null,
      })
    : null;
}
// a saved guide's pp, checked (null when it's not a photo-made guide, or it can't be read); map: the saved section
// numbers to the numbers they have now (97-open), when they changed
function ppCheck(o, map) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return null;
  const keyMap = function (m) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
      const out = {};
      for (const k in m) {
        if (!/^\d+$/.test(k) || typeof m[k] !== 'string') continue;
        const l = map ? map[k] : +k;
        if (l > 0) out[l] = m[k];
      }
      return out;
    },
    p = ppNew();
  p.d = [0, 1, 2, 3, 4].indexOf(o.d) >= 0 ? o.d : PP_DEF;
  p.f = ['even', 'sharp', 'calm', 'subject'].indexOf(o.f) >= 0 ? o.f : 'even';
  p.n = typeof o.n === 'number' && o.n > 0 && o.n < 10000 ? Math.round(o.n) : 0;
  p.hand = o.hand === 1;
  p.paper =
    typeof o.paper === 'string' && Object.prototype.hasOwnProperty.call(PAPERS, o.paper) ? o.paper : paper;
  p.full = o.full === 1;
  // (v327) Use up to 48 markers: each Detail step's cap doubled
  p.more = o.more === 1;
  // (v326) the markers added (Try it with these): catalogue keys only, a few
  p.add =
    !p.full && Array.isArray(o.add)
      ? o.add
          .filter(function (k) {
            return typeof k === 'string' && k.length < 40 && /\|/.test(k);
          })
          .slice(0, 12)
      : null;
  if (p.add && !p.add.length) p.add = null;
  p.made = keyMap(o.made);
  p.white = keyMap(o.white);
  p.sig = typeof o.sig === 'string' ? o.sig.slice(0, 20000) : '';
  p.sm = typeof o.sm === 'string' ? o.sm.slice(0, 40) : '';
  // (v326) the photo's colours, as saved: whole L*a*b* triples, and their shares
  if (
    o.tg &&
    Array.isArray(o.tg.l) &&
    Array.isArray(o.tg.w) &&
    o.tg.w.length &&
    o.tg.w.length <= 2000 &&
    o.tg.l.length === o.tg.w.length * 3 &&
    o.tg.l.every(function (v) {
      return typeof v === 'number' && isFinite(v) && Math.abs(v) < 200;
    }) &&
    o.tg.w.every(function (v) {
      return typeof v === 'number' && isFinite(v) && v >= 0;
    })
  )
    p.tg = { l: Float32Array.from(o.tg.l), w: Float32Array.from(o.tg.w) };
  // (v326) Subject only's background sections, renumbered as the sections are (map)
  if (Array.isArray(o.bgs)) {
    const b = o.bgs
      .map(function (k) {
        return map ? map[k] : k;
      })
      .filter(function (l) {
        return typeof l === 'number' && l > 0;
      });
    p.bgs = b.length ? b : null;
  }
  return p;
}
// what's saved with the guide
function ppSave() {
  if (!pp) return undefined;
  return {
    v: 1,
    d: pp.d,
    f: pp.f,
    n: pp.n,
    hand: pp.hand ? 1 : undefined,
    paper: pp.paper,
    full: pp.full ? 1 : undefined,
    more: pp.more ? 1 : undefined,
    add: pp.add && pp.add.length ? pp.add : undefined,
    made: pp.made || undefined,
    white: pp.white && Object.keys(pp.white).length ? pp.white : undefined,
    sig: pp.sig || undefined,
    sm: pp.sm || undefined,
    // (rounded: a tenth of a unit, about 10 KB for 500 colours)
    tg: pp.tg
      ? {
          l: Array.prototype.map.call(pp.tg.l, function (v) {
            return Math.round(v * 10) / 10;
          }),
          w: Array.prototype.map.call(pp.tg.w, function (v) {
            return Math.round(v * 10) / 10;
          }),
        }
      : undefined,
    bgs: pp.bgs && pp.bgs.length ? pp.bgs : undefined,
    // (v327 photo tones: the markers added and what they were chosen for; each coloured section's highlight and
    // shadow, as coloured: 45-shading)
    tx: ptSaveState().tx,
    th: ptSaveState().th,
  };
}
// the markers a photo-made page may use: those the Photo pattern would (photoPool: your markers, or a palette you
// chose), or with pp.full the whole range of your brands (catalogue markers you don't own among them); with pp.add
// (v326, Try it with these), those and the markers added
// (v327.1) how many of ppPool's are your own (or your palette's): without the markers added
function ppOwnN() {
  return photoPool().filter(function (m) {
    return !!m.lab;
  }).length;
}
function ppPool() {
  if (pp && pp.full) return ppFullPool();
  const pool = photoPool().filter(function (m) {
    return !!m.lab;
  });
  if (!pp || !pp.add) return pool;
  const have = {};
  pool.forEach(function (m) {
    have[m.mkey] = 1;
  });
  pp.add.forEach(function (k) {
    const m = ppCatMap().get(k);
    if (m && !have[k]) {
      have[k] = 1;
      pool.push(m);
    }
  });
  return pool;
}
// (a catalogue marker as the guide's markers are: ppFullPool's, and Try it with these's)
function ppEntry(i) {
  const c = COLORS[i];
  return {
    mkey: mkey(i),
    code: c.code,
    brand: c.brand,
    hex: c.hex,
    name: c.name,
    hue: HS[i].h,
    lab: hexToLab(c.hex),
    sat: HS[i].s,
    pass: passes(i),
    fam: c.fam,
  };
}
// every catalogue marker that lays down colour, by mkey (made once)
let _ppCat = null;
function ppCatMap() {
  if (!_ppCat) {
    _ppCat = new Map();
    for (let i = 0; i < COLORS.length; i++) if (!NOINK.has(i)) _ppCat.set(mkey(i), ppEntry(i));
  }
  return _ppCat;
}
let _ppFull = null;
function ppFullPool() {
  const br = {};
  coll.forEach(function (m) {
    br[m.brand] = 1;
  });
  const key = Object.keys(br).sort().join('|');
  if (_ppFull && _ppFull.key === key) return _ppFull.list;
  const list = [];
  ppCatMap().forEach(function (m) {
    if (!key || br[m.brand]) list.push(m);
  });
  _ppFull = { key: key, list: list };
  return list;
}
// the markers a page may use, as a key (v326: as a set, in mkey order, so the same markers listed another way are
// the same key): the cache keys of the marker choice and of each step's count (ppChoose, ppCountKey)
function ppSig(pool) {
  return (
    ppSigMode() +
    '|' +
    pool
      .map(function (m) {
        return m.mkey;
      })
      .sort()
      .join(',')
  );
}
// (v326) which kind of pool: the full range, yours with markers added, yours or a palette's
function ppSigMode() {
  return (pp && pp.full ? 'full|' : pp && pp.add ? 'add|' : '') + paletteSource;
}
// (v326) whether the plan is as made from this pool: the same kind of pool, Markers in this guide the count it was
// made for, and every marker it was made with still in it (the white sections' too, when they take a marker: Leave
// white areas white off). Markers added since don't change it: a page made before you bought the markers it
// suggested stays as it is (v325 had planned it afresh, side-by-side sections sharing a marker). A guide saved
// before v326 (no sm) is as made only with the very same markers, as v325 had it
function ppAsMade(pool) {
  if (!pp || !pp.made) return false;
  if (ppWant(pool) !== pp.n) return false;
  if (!pp.sm) return ppSig(pool) === pp.sig || ppSigOld(pool) === pp.sig;
  if (pp.sm !== ppSigMode()) return false;
  const have = {};
  pool.forEach(function (m) {
    have[m.mkey] = 1;
  });
  for (const l in pp.made) if (!have[pp.made[l]]) return false;
  if (!photoPaper && pp.white) for (const l in pp.white) if (!have[pp.white[l]]) return false;
  return true;
}
// (v326) the markers the page could use as made, from its key (sorted), or null when that can't be told
function ppMadePoolKeys() {
  if (!pp || !pp.sig) return null;
  let s = pp.sig;
  if (typeof pp.sm === 'string' && s.indexOf(pp.sm + '|') === 0) s = s.slice(pp.sm.length + 1);
  else {
    // (a v325 guide's: "full|" and its palette's source before the markers, in the pool's own order)
    if (s.indexOf('full|') === 0) s = s.slice(5);
    const i = s.indexOf('|');
    if (i < 0) return null;
    s = s.slice(i + 1);
  }
  return s ? s.split(',').sort() : null;
}
// (a v325 guide's key: the pool in its own order)
function ppSigOld(pool) {
  return (
    (pp && pp.full ? 'full|' : '') +
    paletteSource +
    '|' +
    pool
      .map(function (m) {
        return m.mkey;
      })
      .join(',')
  );
}
// mm on the paper for one pixel of a W × H page, printed on paper p (as the PDF's first page fits it: its margins
// and title room, turned when that's bigger, pdfLandFirst)
function ppMmPx(w, h, p) {
  const P = PAPERS[p] || PAPERS.letter,
    m = 36,
    head = m + 36 + 11 + m + 14,
    kp = Math.min((P[0] - 2 * m) / w, (P[1] - head) / h),
    kl = Math.min((P[1] - 2 * m) / w, (P[0] - head) / h);
  return (Math.max(kp, kl) * 25.4) / 72;
}
// The photo as it'll be made into a page: turned and cropped as set, at the working size (its RGB) and the guide's
// (GW × GH), the Photo pattern's copy of it (the same picture: it lines up exactly), and its colours as the targets
// the markers are chosen for (a few thousand, each with its share of the photo). Kept until the photo, its turn or
// its crop changes.
function ppPrepKey() {
  return srcImg
    ? [
        _ppSrcId(srcImg),
        rot90,
        tilt,
        cropRect ? [cropRect.x, cropRect.y, cropRect.w, cropRect.h].join(',') : '',
      ].join('|')
    : '';
}
function ppPrepare() {
  if (!srcImg) return null;
  const key = ppPrepKey();
  if (_ppPrep && _ppPrep.key === key) return _ppPrep;
  // (not turned: the crop drawn from the photo itself, without a turned copy of all of it first)
  const z = ppSize(),
    oc = rot90 || tilt ? buildRotatedFull(false) : null,
    cx = z.cx,
    cy = z.cy,
    cw = z.cw,
    ch = z.ch,
    c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cw, ch);
  if (oc) {
    g.drawImage(oc, cx, cy, cw, ch, 0, 0, cw, ch);
    freeCanvas(oc);
  } else g.drawImage(srcImg, cx / z.sc, cy / z.sc, cw / z.sc, ch / z.sc, 0, 0, cw, ch);
  const k = PP_WORK / Math.max(cw, ch),
    w = Math.max(8, Math.round(cw * k)),
    h = Math.max(8, Math.round(ch * k)),
    wc = document.createElement('canvas');
  wc.width = w;
  wc.height = h;
  const wg = wc.getContext('2d', { willReadFrequently: true });
  wg.imageSmoothingEnabled = true;
  wg.imageSmoothingQuality = 'high';
  drawShrunk(wg, c, w, h);
  const d = wg.getImageData(0, 0, w, h).data,
    n = w * h,
    rgb = new Uint8Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    rgb[i * 3] = d[j];
    rgb[i * 3 + 1] = d[j + 1];
    rgb[i * 3 + 2] = d[j + 2];
  }
  freeCanvas(wc);
  // the colours to cover: the working picture's (every pixel, or every st-th each way past 20 000), in bins of q
  // L*a*b* units, each the mean of its pixels with its share: q from 3, wider until there are PP_TARGETS or fewer
  // ("a few hundred of the photo's colours", as decided; the marker choice's time grows with their number: 4000 at
  // 3 units had held the screen 2–5 s, stage 0)
  const st = Math.max(1, Math.floor(Math.sqrt(n / 20000))),
    px = [];
  for (let y = 0; y < h; y += st)
    for (let x = 0; x < w; x += st) {
      const i = (y * w + x) * 3;
      px.push(rgbLab(rgb[i], rgb[i + 1], rgb[i + 2]));
    }
  let bins = null;
  for (let q = 3; q <= 12; q++) {
    bins = new Map();
    for (let i = 0; i < px.length; i++) {
      const L = px[i],
        bk = Math.round(L[0] / q) * 1000000 + Math.round(L[1] / q + 200) * 1000 + Math.round(L[2] / q + 200),
        b = bins.get(bk);
      if (b) {
        b.w++;
        b.s[0] += L[0];
        b.s[1] += L[1];
        b.s[2] += L[2];
      } else bins.set(bk, { w: 1, s: [L[0], L[1], L[2]] });
    }
    if (bins.size <= PP_TARGETS) break;
  }
  const tl = new Float32Array(bins.size * 3),
    tw = new Float32Array(bins.size);
  let ti = 0;
  bins.forEach(function (b) {
    tl[ti * 3] = b.s[0] / b.w;
    tl[ti * 3 + 1] = b.s[1] / b.w;
    tl[ti * 3 + 2] = b.s[2] / b.w;
    tw[ti++] = b.w;
  });
  // (the guide's size: the long side PP_SIDE, the shape the crop's)
  const GW = z.GW,
    GH = z.GH;
  // (no lighting correction from the paper: the photo isn't of a page, and the page was made from its own colours)
  const ref = photoLitSet(photoFromImage(c), null);
  freeCanvas(c);
  _ppPrep = {
    key: key,
    pid: ++_ppPid,
    rgb: rgb,
    w: w,
    h: h,
    GW: GW,
    GH: GH,
    ref: ref,
    tl: tl,
    tw: tw,
    // (v326: what part of which photo this is, for the subject maps kept, 48-subject subKeepAdd)
    keep: {
      src: _ppSrcId(srcImg),
      rot: rot90,
      tilt: tilt,
      rect: cropRect
        ? { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h }
        : { x: 0, y: 0, w: 1, h: 1 },
    },
  };
  // (v326: a crop of a photo whose subject was found, an Undo of one, a quarter turn: the map from the one found,
  // not found again, 48-subject subFromKept)
  const ks = typeof subFromKept === 'function' ? subFromKept(_ppPrep) : null;
  if (ks) {
    _ppPrep.sal = ks;
    subKeepAdd(_ppPrep);
  }
  _ppCounts = {};
  _ppPick = {};
  return _ppPrep;
}
// the sizes ppPrepare works at, from the open photo, its turn and its crop (as buildRotatedFull turns it): the turned
// photo's (fw × fh, the photo's pixels times sc), the crop in it, and the guide's (GW × GH, the long side PP_SIDE)
function ppSize() {
  const rad = ((rot90 + tilt) * Math.PI) / 180,
    sw = srcImg.width,
    sh = srcImg.height,
    cs = Math.abs(Math.cos(rad)),
    sn = Math.abs(Math.sin(rad)),
    bw = sw * cs + sh * sn,
    bh = sw * sn + sh * cs,
    sc = Math.min(1, MAXSIDE / Math.max(bw, bh)),
    fw = Math.round(bw * sc),
    fh = Math.round(bh * sc),
    cr = cropRect || { x: 0, y: 0, w: 1, h: 1 },
    cx = Math.round(cr.x * fw),
    cy = Math.round(cr.y * fh),
    cw = Math.max(8, Math.min(Math.round(cr.w * fw), fw - cx)),
    ch = Math.max(8, Math.min(Math.round(cr.h * fh), fh - cy)),
    kg = PP_SIDE / Math.max(cw, ch);
  return {
    sc: sc,
    fw: fw,
    fh: fh,
    cx: cx,
    cy: cy,
    cw: cw,
    ch: ch,
    GW: Math.max(16, Math.round(cw * kg)),
    GH: Math.max(16, Math.round(ch * kg)),
  };
}
// (v326) the colours the page's markers are chosen for: the photo's (ppPrepare); with Subject only, its subject's
// (ppSubjectTargets, 48-subject)
function ppTargets(prep) {
  if (pp && pp.f === 'subject' && prep.sal && typeof ppSubjectTargets === 'function')
    return ppSubjectTargets(prep);
  return { l: prep.tl, w: prep.tw };
}
// (each picture object its own number, for the key above: a turn or crop makes a new working picture, not a new photo)
const _ppIds = new WeakMap();
let _ppIdN = 0;
function _ppSrcId(o) {
  let i = _ppIds.get(o);
  if (!i) _ppIds.set(o, (i = ++_ppIdN));
  return i;
}
// the markers for Detail step d: those it may use (the pool, and its key: sig), how many (by hand; else 0, the
// photo's suggestion, at most the step's), and the choice's key (ppBuildCore keeps a choice for the same photo,
// markers and count). The choice itself is made in the job (ppPickCore)
function ppChoose(prep, d) {
  // (v326: in mkey order: the choice's key is the pool as a set, ppSig, so a choice kept for it, in the worker and in
  // the pages kept, must index the same order, whatever order the collection lists them in)
  const pool = ppPool()
    .slice()
    .sort(function (a, b) {
      return a.mkey < b.mkey ? -1 : a.mkey > b.mkey ? 1 : 0;
    });
  if (!pool.length) return null;
  const sig = ppSig(pool),
    n = pp.hand ? Math.max(1, Math.min(limitN >= MK_ALL ? pool.length : limitN, pool.length)) : 0,
    cap = ppCap(d);
  // (v326: Subject only chooses for the subject's colours: a choice of its own, or the whole photo's would be reused)
  return {
    pool: pool,
    sig: sig,
    n: n,
    cap: cap,
    ck:
      prep.pid +
      '|' +
      sig +
      '|' +
      n +
      '|' +
      (n ? 0 : cap) +
      (pp.f === 'subject' && prep.sal ? '|subject' : ''),
  };
}
// (the colours of a list of markers, for the job)
function ppLabs(list) {
  const a = new Float32Array(list.length * 3);
  list.forEach(function (m, i) {
    a[i * 3] = m.lab[0];
    a[i * 3 + 1] = m.lab[1];
    a[i * 3 + 2] = m.lab[2];
  });
  return a;
}
// what the job is sent for step d with these markers: sizes in working pixels from mm on the paper the page is for
function ppJobData(prep, d, ch) {
  const st = PP_STEPS[d],
    mmpx = ppMmPx(prep.GW, prep.GH, pp.paper),
    // (working pixels for a mm on the paper)
    wpm = prep.w / prep.GW / mmpx,
    gpm = 1 / mmpx;
  const minCount = ppMinCount(ch, d);
  // (the colours the markers are chosen for, kept with the page as made: ppCommit)
  const tg = ppTargets(prep);
  ch.tl = tg.l;
  ch.tw = tg.w;
  return {
    pid: prep.pid,
    rgb: prep.rgb.slice(),
    w: prep.w,
    h: prep.h,
    GW: prep.GW,
    GH: prep.GH,
    tl: tg.l,
    tw: tg.w,
    pl: ppLabs(ch.pool),
    n: ch.n,
    mkCap: ch.cap,
    // (v326: no longer how many of the full range suit the photo: the markers-to-add line has its own job, ppFill)
    fl: null,
    ck: ch.ck,
    minArea: Math.pow(2.2 * st.mm * wpm, 2),
    minR: (st.mm * wpm) / 2,
    cap: st.cap,
    minCount: minCount,
    paper: PP_PAPER,
    fragMin: Math.max(24, 0.5 * Math.pow((st.mm * gpm) / 2, 2)),
    // (v325.1 Focus: the photo's subject, and the smallest areas there and elsewhere, 48-subject)
    sal: pp.f !== 'even' && pp.f !== 'subject' && prep.sal ? prep.sal : null,
    areaK: pp.f !== 'even' && pp.f !== 'subject' && prep.sal ? SUB_AREA[pp.f] : [1, 1],
    // (v326 Subject only: the background, kept apart from the subject as the page is made, ppBuildCore)
    bgm: pp.f === 'subject' && prep.sal ? ppSubjectMask(prep) : null,
  };
}
// (a finer step's count never under a coarser one's, for this photo, these markers and this Focus)
function ppMinCount(ch, d) {
  let minCount = 0;
  for (let k = 0; k < d; k++) {
    const c = _ppCounts[ppCountKey(ch, k)];
    if (c > minCount) minCount = c;
  }
  return minCount;
}
// (each step's count is kept for the photo, its markers and its Focus: ppJobData's minCount; v327: and Use up to 48
// markers, whose steps have caps of their own)
function ppCountKey(ch, d) {
  return ch.sig + '|' + (pp.f || 'even') + '|' + d + (pp.more ? '|more' : '');
}
// (v327) the most markers Detail step d's page may use: twice as many with Use up to 48 markers (pp.more)
function ppCap(d) {
  return PP_STEPS[d].mk * (pp && pp.more ? 2 : 1);
}
// (v326) the pages made this session for the last PP_MEM Detail steps (docs/PLAN-v326-photo-page.md, 6), by
// everything a page is made from: the photo prepared (its turn and crop: pid), the markers it may use and how many
// (the choice's key), Focus, Detail, the paper, the coarser steps' count it keeps to. Going back to a step seen is
// instant; any change to those is another key. Not made ahead of time: one worker, and a job can't be stopped. Each
// kept with its own copy of the section map (Edit sections changes the page's in place)
const PP_MEM = 3;
let _ppMem = new Map();
function ppMemKey(prep, ch) {
  return [
    prep.pid,
    ch.ck,
    pp.d,
    pp.paper,
    pp.f,
    prep.sal ? 1 : 0,
    pp.f === 'subject' && prep.sal ? 1 : 0,
  ].join('|');
}
// (the coarser steps' count it keeps to, mc: a page made at the first try, it 0, with as many regions as that or more
// is the very page a make for it gives; else only for the same count. Medium, Simple, then Medium again: Simple's
// count is Medium's to keep to now, and Medium met it at the first try)
function ppMemGet(k, mc) {
  const h = _ppMem.get(k);
  if (!h || !((h.it === 0 && (!mc || h.R >= mc)) || h.mc === mc)) return null;
  return h;
}
function ppMemPut(k, prep, r, mc) {
  _ppMem.forEach(function (v, kk) {
    if (v.pid !== prep.pid) _ppMem.delete(kk);
  });
  _ppMem.delete(k);
  _ppMem.set(k, Object.assign({}, r, { lab: r.lab.slice(), pid: prep.pid, mc: mc }));
  while (_ppMem.size > PP_MEM) _ppMem.delete(_ppMem.keys().next().value);
}
// the page made: in the worker (JOBS 'ppage'), or here where there's none
function ppRun(data) {
  return JOBS.run('ppage', data, [data.rgb.buffer]).catch(function (e) {
    if (e && e.message === 'superseded') throw e;
    // (the worker's copy went with it: a fresh one for the page)
    if (!data.rgb.length) data.rgb = _ppPrep.rgb.slice();
    return ppBuildCore(data);
  });
}
// Make the page for the open photo at its Detail step, and put it in place (ppCommit). geo: the photo's turn or crop
// changed (the zones can't follow); quiet: no line under the picture. Resolves true when it's in place, false when a
// newer make or another picture took over. The controls wait meanwhile.
function ppMake(geo, quiet) {
  if (!pp || !srcImg) return Promise.resolve(false);
  const gen = ++_ppGen,
    lg = loadGen;
  _ppBusy = true;
  segBusySet(true, false, true);
  if (!quiet) note('Making the page…');
  return new Promise(function (res, rej) {
    afterPaint(function () {
      let prep, ch;
      try {
        if (gen !== _ppGen || lg !== loadGen) return res(false);
        // (timed for Copy diagnostics: once a photo, turn or crop, it's on the page's thread)
        prep =
          _ppPrep && _ppPrep.key === ppPrepKey()
            ? _ppPrep
            : holdTime('Photo got ready for its page', ppPrepare);
        if (!prep) throw new Error('no photo');
        ch = ppChoose(prep, pp.d);
        if (!ch) throw new Error('no markers');
      } catch (e) {
        rej(e);
        return;
      }
      const t0 = Date.now();
      // (v325.1 Focus: the photo's subject found first, 48-subject; when it can't be, the page is made Even and said)
      const subj =
        pp.f !== 'even'
          ? subMap(prep).catch(function (e) {
              if (gen !== _ppGen || !pp) return null;
              pp.f = 'even';
              // (said once the page is made, in place of its usual line: ppSaid)
              _ppSaid = /not stored/.test(String(e && e.message))
                ? 'Focus is back on Even: the subject finder isn’t on this device. Choose Sharper subject to download it.'
                : errNote('Couldn’t find the photo’s subject, so the page is made Even.', 'Focus', e);
              return null;
            })
          : Promise.resolve(null);
      subj
        .then(function () {
          if (gen !== _ppGen || lg !== loadGen || !pp) return null;
          // (v326 Subject only: a subject the finder calls under SUB_FEW of the photo isn't one, Even instead, said)
          if (pp.f === 'subject' && prep.sal && ppSubjectShare(prep) < SUB_FEW) {
            pp.f = 'even';
            _ppSaid = 'No clear subject found in this photo, so the background stays.';
          }
          // (chosen again now the map is in: Subject only's choice has a key of its own, ppChoose)
          ch = ppChoose(prep, pp.d) || ch;
          const mk = ppMemKey(prep, ch),
            hit = ppMemGet(mk, ppMinCount(ch, pp.d));
          // (v326: a Detail step seen already, for this photo, markers, Focus and paper: the page as it was made,
          // at once, 6; its colours as the job would have them, for pp.tg)
          if (hit) {
            const tg = ppTargets(prep);
            ch.tl = tg.l;
            ch.tw = tg.w;
            _ppMem.delete(mk);
            _ppMem.set(mk, hit);
            return Object.assign({}, hit, { lab: hit.lab.slice() });
          }
          const jd = ppJobData(prep, pp.d, ch);
          return ppRun(jd).then(function (r) {
            ppMemPut(mk, prep, r, jd.minCount);
            return r;
          });
        })
        .then(function (r) {
          if (!r) return res(false);
          if (gen !== _ppGen || lg !== loadGen || !pp) return res(false);
          // the markers the job chose, and what it found about the photo (the suggested count)
          const pk = r.pick;
          ch.chosen = Array.prototype.map.call(pk.chosen, function (j) {
            return ch.pool[j];
          });
          ch.n = pk.n;
          _ppPick[ch.sig] = { suits: pk.suits, full: pk.suitsFull, sug: pk.sug };
          _ppCounts[ppCountKey(ch, pp.d)] = r.S;
          // (how long the page took, and putting it in place, for Copy diagnostics and Send feedback: holdAdd in
          // safety.js, as the section finder's steps are timed)
          const sz = prep.GW + ' × ' + prep.GH + ', ' + r.S + ' sections, ' + ch.chosen.length + ' markers';
          holdAdd('Page made in the background (' + PP_STEPS[pp.d].n + ')', Date.now() - t0, sz);
          holdTime(
            'Page put in place',
            function () {
              ppCommit(r, ch, prep, geo);
            },
            sz,
          );
          res(true);
        })
        .catch(rej);
    });
  }).finally(function () {
    if (gen === _ppGen) {
      _ppBusy = false;
      segBusySet(false);
    }
  });
}
// The made page put in place as the open picture's sections, as segPlace puts found ones; the Photo pattern given the
// photo, lined up exactly, and the sections' markers as made (ppMadeLay lays them)
function ppCommit(r, ch, prep, geo) {
  // (where the zones were, to place them on the new sections; the picture's shape changed and they can't be)
  if (geo) zoneGeoLost();
  else zonePixCapture();
  _tickHeld = {};
  mergeSel = -1;
  _preview = false;
  W = prep.GW;
  H = prep.GH;
  cv.width = W;
  cv.height = H;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  labels = r.lab;
  const n = W * H,
    g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = labels[i] < 0 ? 40 : 255;
  gray = g;
  chroma = null;
  srcK = 1;
  srcDims = null;
  srcColour = null;
  comps = [null];
  for (let s = 1; s <= r.S; s++) {
    const b = s * 8;
    comps.push({
      area: r.box[b],
      bg: false,
      bpx: r.box[b + 1],
      cx: r.box[b + 2],
      cy: r.box[b + 3],
      h: r.box[b + 7] - r.box[b + 5],
      x0: r.box[b + 4],
      y0: r.box[b + 5],
      x1: r.box[b + 6],
      y1: r.box[b + 7],
    });
  }
  // (nothing is background: the whole photo is the picture)
  bgMaxB = 0;
  bgEdgeAll = true;
  secColor = new Array(comps.length);
  for (let l = 1; l < comps.length; l++) {
    const hh = (l * 137.508) % 248,
      s = 22 + ((l * 37) % 14),
      li = 61 + ((l * 29) % 13);
    secColor[l] = hsl2rgb(hh, s, li);
  }
  secState = new Uint8Array(comps.length).fill(1);
  secState[0] = 0;
  colored = new Uint8Array(comps.length);
  heldReset();
  progAt = { s: 0, e: 0 };
  celebrated = false;
  rgbOut = new Uint8ClampedArray(n * 4);
  imgData = new ImageData(rgbOut, W, H);
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  locks = {};
  whitePins = {};
  shadeFlat = {};
  _flatVer++;
  _segFresh = true;
  _origKeys = {};
  _lostKeys = {};
  _gone = {};
  hasEdits = false;
  segWarn = { ok: true };
  // the markers as made (first: the photo's first page, which starts on the Photo pattern; a remake keeps the pattern
  // chosen since, as a colouring page's sections found again do)
  const first = !pp.made,
    made = {},
    white = {},
    bgs = [];
  for (let s = 1; s <= r.S; s++) {
    // (v326 Subject only: the photo's background, the paper: not coloured, not counted, as a colouring page's
    // background is, 10-segment; Edit sections can't bring it back, 80-input)
    if (r.secBg && r.secBg[s]) {
      comps[s].bg = true;
      secState[s] = 0;
      bgs.push(s);
      continue;
    }
    const m = ch.chosen[r.secMk[s]];
    if (!m) continue;
    if (r.secWhite[s]) white[s] = m.mkey;
    else made[s] = m.mkey;
  }
  pp.made = made;
  pp.white = white;
  pp.bgs = bgs.length ? bgs : null;
  // (the count it was made for: the one asked for, though fewer may suit the photo, so the plan is as made while
  // Markers in this guide says it: ppWant)
  pp.n = ch.n;
  pp.sig = ch.sig;
  pp.sm = ppSigMode();
  // (v326) the colours the markers were chosen for, kept with the page (ppSave), for its markers-to-add line
  pp.tg = { l: ch.tl, w: ch.tw };
  if (!pp.hand) limitN = ch.n;
  // the Photo pattern's photo: this one, over the whole page
  photoRef = prep.ref;
  photoXf = { cx: W / 2, cy: H / 2, sx: W / prep.ref.w, sy: H / prep.ref.h, r: 0 };
  _phPlace = 'stretch';
  _phCol = null;
  _phRefit = false;
  _phGeo = null;
  _phAlFail = false;
  photoAlign = false;
  photoWait = {};
  _phPend = null;
  _phBumped = true;
  // (v326: the Photo button's photo, of the page before, off: 8)
  photoPeek = false;
  if (first) family = 'photo';
  // (v327) photo tones: on a new page, Highlights and Shadows are Matched to the photo (until changed), and nothing
  // is kept from the page before
  if (first && shadeMode === 'off') {
    shadeShadow = 'photo';
    shadeHilite = 'photo';
  }
  ptReset();
  waitEnd();
  resetZoom();
  render();
  renderControls();
}
// The Photo pattern on a photo-made page, as made: each section the marker the page was made with, the white ones
// white (pins keep theirs), while the markers it may use are those it was made with and Markers in this guide is the
// count it was made for (sections made since by Edit sections take the nearest of its markers). Anything else (other
// markers, a palette, another count) and null: the Photo pattern chooses afresh (buildPhoto), and the Plan offers to
// remake the page.
function ppMadeLay(cl) {
  const a = ppMadeAssign(cl);
  if (!a) return null;
  const assign = a.assign,
    paperS = a.paperS;
  const order = cl
    .filter(function (l) {
      return !paperS[l];
    })
    .sort(function (a, b) {
      return comps[a].cy - comps[b].cy || comps[a].cx - comps[b].cx;
    });
  const used = {};
  order.forEach(function (l) {
    used[assign[l].mkey] = 1;
  });
  lastPoolN = Object.keys(used).length;
  assignData = {
    assign: assign,
    order: order,
    N: order.length,
    base: Object.assign({}, assign),
    paper: Object.keys(paperS).length ? paperS : null,
  };
  applyLocks();
  photoStats();
  return true;
}
// (v326) The page step in its markers' colours (docs/PLAN-v326-photo-page.md, 2): each section the marker Build will
// give it (ppMadeAssign, Build's own), pins and sections coloured in keeping theirs, Leave white's sections the
// paper. cn: the sections counted (10-segment render). Returns an RGB triple a section (null for paper), or null
// when Build would plan afresh (ppStepWhy says why: the step shows the sections' tints then), or while Edit
// sections is open, whose tints tell sections apart (a split's two halves take one marker; Merge's first pick is
// yellow)
function ppStepColours(cn) {
  if (!pp || !pp.made || _ppTools || ppStepWhy()) return null;
  const cl = [];
  for (let l = 1; l < comps.length; l++) if (cn[l]) cl.push(l);
  const a = ppMadeAssign(cl);
  if (!a) return null;
  const bk = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  const rgb = function (h) {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    },
    out = new Array(comps.length).fill(null);
  cl.forEach(function (l) {
    if (whitePins[l] !== undefined || a.paperS[l]) return;
    let m = a.assign[l];
    // (as applyLocks lays a pin, or a section coloured in, over the plan)
    if (locks[l] !== undefined) {
      const lm =
        bk[locks[l]] || (_heldObj && _heldObj[l] && _heldObj[l].mkey === locks[l] ? _heldObj[l] : null);
      if (lm) m = lm;
    }
    if (m && m.hex) out[l] = rgb(m.hex);
  });
  return out;
}
// why the step can't show the markers as made (the tints, then), or '' when it can
function ppStepWhy() {
  if (!pp || !pp.made) return 'none';
  if (family !== 'photo') return 'Shown as sections: the plan uses another pattern now.';
  if (
    zones.length &&
    zoneIds().some(function (id) {
      return zoneFamily(id) !== 'photo';
    })
  )
    return 'Shown as sections: part of the plan uses another pattern.';
  if (!ppAsMade(ppPool()))
    return 'Shown as sections: your markers changed since this page was made. Remake it to see its colours.';
  return '';
}
// (the page step's lines, as they print: light grey, dark with Print's Darker lines, 90-export)
function ppStepLine() {
  let dk = pdfPpDark;
  try {
    dk = localStorage.getItem('ms-pdf-pplines') === '1';
  } catch (_) {}
  return dk ? LINE : PP_LINE;
}
// (v326) the sections' markers as made, without laying them: { assign: { section: marker }, paperS: { section: 1 } }
// for the sections cl, or null when the plan wouldn't be as made. One function for Build (ppMadeLay) and the page
// step's colours (ppStepColours), so what the step shows is what Build gives
function ppMadeAssign(cl) {
  if (!pp || !pp.made) return null;
  const pool = ppPool();
  if (!ppAsMade(pool)) return null;
  const bk = {};
  pool.forEach(function (m) {
    bk[m.mkey] = m;
  });
  coll.forEach(function (m) {
    if (!bk[m.mkey]) bk[m.mkey] = m;
  });
  const assign = {},
    paperS = {},
    miss = [];
  for (let i = 0; i < cl.length; i++) {
    const l = cl[i],
      k = pp.made[l];
    if (k) {
      if (!bk[k]) return null;
      assign[l] = bk[k];
    } else if (pp.white && pp.white[l] && photoPaper) paperS[l] = 1;
    else if (pp.white && pp.white[l] && bk[pp.white[l]]) assign[l] = bk[pp.white[l]];
    else miss.push(l);
  }
  // sections made since by Edit sections (a split's new part, one added): the page's own marker nearest the photo
  // under it, so one edit doesn't choose every section's marker afresh
  if (miss.length) {
    if (!photoRef || !photoXf) return null;
    const C = photoColours(),
      seen = {},
      mine = [];
    for (const l in pp.made) {
      const m = bk[pp.made[l]];
      if (m && m.lab && !seen[m.mkey]) {
        seen[m.mkey] = 1;
        mine.push(m);
      }
    }
    if (!mine.length) return null;
    for (let i = 0; i < miss.length; i++) {
      const l = miss[i];
      if (!C.has[l]) return null;
      assign[l] = nearestInPool([C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]], mine);
    }
  }
  return { assign: assign, paperS: paperS };
}
// the plan isn't as made any more (the markers it may use, or how many, changed since): the count the page would be
// remade for, else 0
function ppRemakeFor() {
  if (!pp || !pp.made || !assignData || family !== 'photo') return 0;
  const pool = ppPool(),
    n = ppWant(pool);
  if (!pool.length || ppAsMade(pool)) return 0;
  return n;
}
// how many markers the plan asks for from this pool: Markers in this guide (a make sets it to the count it chose,
// unless it was set by hand), at most the pool
function ppWant(pool) {
  return Math.max(1, Math.min(limitN >= MK_ALL ? pool.length : limitN, pool.length));
}
// (the Plan's Photo pattern, 51-controls-plan) where its colours come from
function ppPlanLine() {
  return ppRemakeFor()
    ? 'Colours come from your photo, matched to your markers as they are now.'
    : 'Colours come from your photo, as the page was made.';
}
// the offer to make the page again, when the plan isn't as made: fewer markers (or others) than it was made for can
// put one marker on sections side by side, and merged sections can't come apart
function ppRemakeHTML() {
  const n = ppRemakeFor();
  if (!n) return '';
  return (
    '<div class="sfc-note sfc-mt8" id="sfPpRemake">' +
    (n !== pp.n
      ? 'This page was made for ' + pp.n + ' marker' + (pp.n === 1 ? '' : 's') + ', so with ' + n
      : 'Your markers changed since this page was made, so') +
    ' some sections side by side may share a marker. <button type="button" class="sflink" id="sfPpRemakeGo">Remake page for ' +
    n +
    ' marker' +
    (n === 1 ? '' : 's') +
    '</button></div>'
  );
}
// Remake page from the Plan: asked first when there's something to lose (one Undo step), then made again and shown
// in Edit sections' place, to be built again
function ppRemakeGo() {
  if (!ppRemakeFor() || _ppBusy) return;
  ppFromPlan(function () {
    pp.hand = pp.hand || limitN !== pp.n;
    _ppPick = {};
  });
}
// (the Plan's and the Print sheet's remakes) asked first, then the change (set), Edit sections' step, and the page made
// again there; a guide opened again reads its photo first (srcLoad), and with none kept there's nothing to remake from
function ppFromPlan(set) {
  if (!srcImg && !srcMay()) {
    note(
      'The photo isn’t kept with this guide, so its page can’t be made again. Choose the photo again for a new page.',
    );
    return;
  }
  okGeom(function () {
    set();
    if (typeof closeSheet === 'function') closeSheet();
    stageGo();
    backToReview();
    ppWithPhoto(function () {
      ppRemade(false);
    });
  }, true);
}
// fn once the photo is in memory: now, or when srcLoad has read it (ppLoaded); not at all if it can't be read
let _ppAfter = null;
function ppWithPhoto(fn) {
  if (srcImg) return fn();
  _ppAfter = { fn: fn, gen: loadGen };
  srcLoad();
}
// (25-source-photo srcLoad: the photo read, or not)
function ppLoaded(ok) {
  const a = _ppAfter;
  _ppAfter = null;
  if (a && ok && a.gen === loadGen && pp && srcImg) a.fn();
  else if (a && !ok) {
    geoCancel();
    note('Couldn’t read this guide’s photo, so the page wasn’t made again.');
  }
}
// (the Print sheet, 90-export) printed on a smaller paper than the page was made for, its smallest sections come out
// smaller than Detail's: said, with a remake for that paper
function ppPaperHTML() {
  if (!pp || !pp.made || paper === pp.paper || pdfWhat !== 'page' || !W || !H) return '';
  const k = ppMmPx(W, H, paper) / ppMmPx(W, H, pp.paper);
  if (k >= 0.95) return '';
  const mm = Math.round(PP_STEPS[pp.d].mm * k * 10) / 10;
  return (
    'This page was made for ' +
    esc(ppPaperName(pp.paper)) +
    ': on ' +
    esc(ppPaperName(paper)) +
    ' its smallest sections are about ' +
    mm +
    ' mm across.' +
    (srcImg || srcMay()
      ? ' <button type="button" class="sflink" id="sfPrPpGo">Remake page for ' +
        esc(ppPaperName(paper)) +
        '</button>'
      : '')
  );
}
function ppPaperGo() {
  const p = paper;
  if (!pp || _ppBusy) return;
  ppFromPlan(function () {
    pp.paper = p;
  });
}

// ---- the worker's part (03-jobs: the 'ppage' job) ----
// the builder's steps as source, for the worker (as segWorkerSrc does the section finder's)
function ppWorkerSrc() {
  return (
    // (the Photo pattern's marker choice, 46-photo, and its constants)
    'const PH_CAP = ' +
    PH_CAP +
    ', PH_SWAP_ROUNDS = ' +
    PH_SWAP_ROUNDS +
    ', PH_SUG_DE = ' +
    PH_SUG_DE +
    ', PH_SUG_SHARE = ' +
    PH_SUG_SHARE +
    ', PH_SUG_MAX = ' +
    PH_SUG_MAX +
    ';\n' +
    [
      _photoBest,
      _photoSwap,
      _photoChoose,
      ppPickCore,
      ppLabTable,
      ppSmoothCore,
      ppDe,
      ppQuantCore,
      ppRegionsCore,
      ppEdtCore,
      ppMergeCore,
      ppThinCore,
      ppPageCore,
      ppBuildCore,
      ppWork,
      ppFillCore,
      ppMoreCore,
    ]
      .map(function (f) {
        return f.toString();
      })
      .join('\n')
  );
}
// (runs in the worker) a page made, its arrays handed back rather than copied
function ppWork(m) {
  const r = ppBuildCore(m);
  return { v: r, t: [r.lab.buffer, r.box.buffer, r.secMk.buffer, r.secWhite.buffer, r.secBg.buffer] };
}

// ---- the way in: a photo chosen to be made into a page ----
// (the picker of its own, #sfPpFile: a colouring page's goes through the photo tips and the page finder)
let _ppPickCb = null;
function ppFileEl() {
  if (!document.getElementById('sfPick')) mount();
  return document.getElementById('sfPpFile');
}
// Home's and the Guide screen's "make a colouring page from any photo": the picker straight away, in the tap (iOS);
// onPick (the switch to the Guide screen) once a photo is chosen
function ppPick(onPick) {
  const el = ppFileEl();
  _ppPickCb = onPick || null;
  if (el) el.click();
}
// the picker's photo: what's open is put away first (stashDirty), then the photo is read
function ppPicked(file) {
  const cb = _ppPickCb;
  _ppPickCb = null;
  if (!file) return;
  if (cb) cb();
  stashDirty().then(function (ok) {
    if (ok) ppLoadImage(file);
  });
}
// A photo read and made into a page, as _loadImage reads one for a colouring page (the lens from its camera data, the
// photo decoded off the page first), but no page is looked for in it: it is the picture
function ppLoadImage(file) {
  _smpLoad = false;
  if (isPdf(file)) {
    note('That’s a PDF. Choose a photo to make a colouring page from.');
    return;
  }
  note('Reading photo…');
  const gen = ++loadGen,
    lens =
      file && file.slice && file.slice(0, 262144).arrayBuffer
        ? file
            .slice(0, 262144)
            .arrayBuffer()
            .then(pgExifFocal)
            .catch(function () {
              return 0;
            })
        : Promise.resolve(0);
  let url = null;
  try {
    url = URL.createObjectURL(file);
  } catch (e) {}
  const go = function (src) {
    const img = new Image();
    img.onload = function () {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      if (gen !== loadGen) return;
      if (!img.width || !img.height) {
        note('That image looked empty — try another file.');
        return;
      }
      let dec = null;
      try {
        dec = img.decode ? img.decode() : null;
      } catch (e) {}
      Promise.all([lens, Promise.resolve(dec).catch(function () {})]).then(function (r) {
        if (gen !== loadGen) return;
        afterPaint(function () {
          if (gen !== loadGen) return;
          let tok = 0;
          try {
            tok = resetForNewPicture();
            takeNextPal();
            srcImg = fitSource(img);
          } catch (err) {
            note(errNote('Couldn’t read that photo. Try it again, or another photo.', 'Making a page', err));
            return;
          }
          ppBegin(tok, r[0]);
        });
      });
    };
    img.onerror = function () {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
      if (gen !== loadGen) return;
      note('That file couldn’t be opened as a picture — try a JPEG or PNG.');
    };
    img.src = src;
  };
  if (url) go(url);
  else {
    const fr = new FileReader();
    fr.onload = function () {
      if (gen === loadGen) go(fr.result);
    };
    fr.onerror = function () {
      if (gen === loadGen) note('Couldn’t read that file.');
    };
    fr.readAsDataURL(file);
  }
}
// A picture opened as a colouring page that looks like a photo is offered a page made from it: in the warnings that
// say it isn't line art (it looks like a photo, no distinct sections, coloured in already), and, for a colourful one,
// in the hatching warning or a line of its own when there's no warning at all. Measured (stage 0) on the author's 17
// photos: 10 got one of those warnings, 2 the hatching one and 5 none, their colour (srcColour, the share of the page
// read as coloured) 0.23 and 0.09, and 0.49, 0.46, 0.06, 0.05, 0.004; on 18 colouring pages (downloads, scans, photos
// of pages) 0.00, and on the author's partly coloured drawings with no warning up to 0.14, which a lower bar would
// have called photos. So 0.2: 13 of the 17 photos are offered a page, no colouring page is; the greyest photos are
// left to the start card's link. Only for a picture chosen now (a photo or a download: not the sample, a PDF's page
// or a guide opened again), and not once it's a guide. 'warn': in the warning box; 'line': a line of its own; '' none
const PP_OFFER = { dark: 1, noisy: 1, few: 1, coloured: 1 },
  PP_OFFER_C = 0.2;
function ppOffer() {
  if (ppOn() || srcFrom !== 'pic' || !(pgOrig || srcImg) || assignData || !segWarn) return '';
  const col = srcColour != null && srcColour >= PP_OFFER_C;
  if (!segWarn.ok) return PP_OFFER[segWarn.code] || (segWarn.code === 'hatched' && col) ? 'warn' : '';
  return col ? 'line' : '';
}
// (Edit sections, 53-controls-stages: beside the warning box, and kept in step with it by segWarnSync)
function ppOfferHTML() {
  return ppOffer() === 'line'
    ? '<div class="sfc-note sfc-mt8" id="sfPpOffer">Is this a photo rather than a colouring page? <button type="button" class="sflink" id="sfPpFrom">Make a colouring page from it</button></div>'
    : '';
}
// (the warning on a photo opened as a colouring page: "Make a colouring page from it instead", segWarnHTML) the picture
// as it came, made into a page
function ppFromPicture() {
  const pic = pgOrig || srcImg,
    f35 = pgF35;
  if (!pic) return;
  stashDirty().then(function (ok) {
    if (!ok) return;
    const tok = resetForNewPicture();
    srcImg = pic;
    ppBegin(tok, f35);
  });
}
// the photo in place (srcImg, at most MAXSIDE): a photo-made picture from now on, its page made at the default step
function ppBegin(tok, f35) {
  pp = ppNew();
  srcUp = false;
  srcFrom = 'pic';
  // (the photo as it came: kept with the guide once it's saved, 25-source-photo, and what Undo goes back to)
  pgOrig = srcImg;
  pgF35 = f35 || 0;
  enterWork();
  const rs = document.getElementById('sfResume');
  if (rs) rs.style.display = 'none';
  photoPreview(srcImg);
  afterPaint(function () {
    if (tok !== loadGen) return;
    try {
      srcPrewarm(srcImg, false);
    } catch (_) {}
    ppMake(true)
      .then(function (ok) {
        if (!ok || tok !== loadGen) return;
        ppNote(ppSaid());
        sayLive('Your colouring page: ' + ppCountText() + '.');
      })
      .catch(function (err) {
        if (tok !== loadGen) return;
        _preview = false;
        note(
          errNote(
            'Couldn’t make a page from that photo. Try it again, or another photo.',
            'Making a page',
            err,
          ),
        );
      });
  });
}

// ---- the page step's controls (in Edit sections' place: _renderControls) ----
// the sections and markers on the page, in words
function ppCountText() {
  if (!comps) return '';
  // (v326: Subject only's background isn't a section to colour)
  const nb = pp && pp.bgs ? pp.bgs.length : 0,
    n = comps.length - 1 - nb,
    k = {};
  if (pp && pp.made) for (const l in pp.made) k[pp.made[l]] = 1;
  const m = Object.keys(k).length;
  return (
    n +
    ' section' +
    (n === 1 ? '' : 's') +
    ', ' +
    m +
    ' marker' +
    (m === 1 ? '' : 's') +
    (nb ? ' · background left white' : '')
  );
}
// (v327.1) the page made, said: what's worth saying as a toast (m: no clear subject, made again with edits); the
// routine line only in the guide's meta line, not as a toast over Detail and Focus, which the count line already
// says (docs/PLAN-v327.1.md, 3); a one-colour photo's line is a toast still
function ppNote(m) {
  if (m) return note(m);
  const l = ppLine();
  if (comps && comps.length < 3) return note(l);
  note(l, true);
}
// the line under the picture once a page is made
function ppLine() {
  // (a guide needs two sections or more, as Build says by waiting: a photo of one colour all over gives one)
  if (comps && comps.length < 3)
    return 'This photo is nearly one colour all over, so its page has only one section. Try a finer Detail, or another photo.';
  return 'Colouring page made: ' + ppCountText() + '. Build guide when it looks right.';
}
// the markers the page could use, in words: "your 36 markers", "the full Ohuhu range"
function ppMadeFor() {
  const full = 'the full ' + ppBrandWords() + (Object.keys(ppBrands()).length > 1 ? ' ranges' : ' range'),
    pool = ppPool();
  if (pp.full) return full;
  if (paletteSource === 'saved' || paletteSource === 'generate')
    return 'your palette’s ' + pool.length + ' markers';
  // (no markers added yet: every one in the catalogue, as the rest of the app says it)
  if (isDemo()) return full;
  // (v327.1: the markers added by Try it with these said apart: they'd been counted in, "your 39 markers")
  const own = pp.add && pp.add.length ? ppOwnN() : pool.length,
    more = pool.length - own;
  return 'your ' + own + ' marker' + (own === 1 ? '' : 's') + (more > 0 ? ' and the ' + more + ' added' : '');
}
function ppBrands() {
  const b = {};
  coll.forEach(function (m) {
    b[m.brand] = 1;
  });
  return b;
}
// (Ohuhu first, as the app names them everywhere: "Ohuhu + Copic")
function ppBrandWords() {
  const b = Object.keys(ppBrands()).sort(function (x, y) {
    return (x === 'Ohuhu' ? 0 : 1) - (y === 'Ohuhu' ? 0 : 1) || (x < y ? -1 : x > y ? 1 : 0);
  });
  return b.length ? b.join(' and ') : 'catalogue';
}
// (v326) Plan's Photo panel on a photo-made page (46-photo photoStatsHTML0): the page step's line, the figure said
// even with nothing to suggest; the sections left white; and the loose matches (further than Match's Rough, 12, by
// each section's average colour: photoRoughAt), in place of v325's "N% of sections are a close match", "Closer
// with" and the suggested count (the Remake offer covers that)
function ppPlanStatsHTML() {
  const s = _phStats;
  let h = ppHelpHTML('plan');
  if (s && s.paper)
    h +=
      '<div class="sfc-note sfc-mt8">' +
      s.paper +
      ' section' +
      (s.paper === 1 ? '' : 's') +
      ' left white.</div>';
  if (s && s.rough)
    h +=
      '<label class="sfchk sfphrough"><input type="checkbox" id="sfPhRough"' +
      (photoRoughOnly ? ' checked' : '') +
      '> Show the loose matches (' +
      s.rough +
      ')</label>';
  return h;
}
// the markers a page made from the full range, or with markers added, uses that you don't own (v326: owned anywhere,
// set aside or not, as To buy has it)
function ppNotOwned() {
  if (!pp || !pp.made) return [];
  const out = {};
  for (const l in pp.made) if (!state.owned.has(pp.made[l])) out[pp.made[l]] = 1;
  return Object.keys(out);
}

/* ---- (v326) the markers that would help this photo most (docs/PLAN-v326-photo-page.md, 1) ----
    In place of v325's small-collection note (it counted markers near any of the photo's colours, and never showed
    for a small set). Coverage: the share of the photo within 10 by eye of one of the page's markers (ppFillCore, in
    the worker). Suggested: the catalogue markers that each add 5 points or more, at most 6, from the brands ticked
    in Brands I'd buy, or your own brands with a second list from both when that
    does PP_FILL_OTHER points better. Shown on the page step when they add PP_FILL_SHOW points or more; in Plan's
    Photo panel the figure is always said. Measured on 17 photos: Honolulu 24 gets 1-5 markers, Honolulu 216 0-3,
    392 markers none. */
const PP_FILL_SHOW = 15,
  PP_FILL_OTHER = 10,
  // (newer markers than the page was made with, that would match this much more: Remake to use them)
  PP_FILL_NEW = 5,
  // (v327, Use up to 48 markers: offered when twice the markers would bring back this share of the photo, lost to
  // the cap, or bring its colours this much nearer on average; measured: photos 02, 05, 06 and 15 of 17 with 392
  // markers, never with 120 or fewer)
  PP_MORE_LOST = 0.005,
  PP_MORE_GAIN = 0.45;
let _ppFill = null; // { key, res (null while it's worked out), cand: the candidates, in ppFillCore's order }
const _ppTgIds = new WeakMap();
let _ppTgN = 0;
// the candidates: catalogue markers you don't own (any you own, set aside or not, isn't one), from Brands I'd buy's
// brands, else every brand with your own brands' first (cg 1) and both, so the second list can be worked out
function ppFillCands() {
  const buy = buyBrands(),
    prefer = {};
  if (buy)
    buy.forEach(function (b) {
      prefer[b] = 1;
    });
  else
    state.owned.forEach(function (k) {
      prefer[k.slice(0, k.indexOf('|'))] = 1;
    });
  const list = [];
  ppCatMap().forEach(function (m) {
    if (state.owned.has(m.mkey) || !m.lab) return;
    if (buy && !prefer[m.brand]) return;
    list.push(m);
  });
  const cg = new Uint8Array(list.length);
  let other = false;
  list.forEach(function (m, i) {
    if (prefer[m.brand]) cg[i] = 1;
    else other = true;
  });
  return { list: list, cg: cg, both: !buy && other, buy: buy ? buy.slice().sort().join('+') : '' };
}
// the line's numbers for the page as it is (null while they're worked out, or when there's nothing to say); starts
// the job when what they depend on changed: the page's colours, the markers it may use, the candidates (what you
// own, Brands I'd buy), Leave white areas white, the markers it was made with
function ppFillGet() {
  if (!pp || !pp.made || isDemo()) return null;
  // (a guide saved before v326 has no colours kept: the photo's, once it's been read)
  if (!pp.tg && _ppPrep && _ppPrep.key === ppPrepKey()) pp.tg = ppTargets(_ppPrep);
  if (!pp.tg) return null;
  const pool = ppPool();
  if (!pool.length) return null;
  const pal = paletteSource === 'saved' || paletteSource === 'generate',
    cand = pal || pp.full ? null : ppFillCands();
  let tid = _ppTgIds.get(pp.tg);
  if (!tid) _ppTgIds.set(pp.tg, (tid = ++_ppTgN));
  // (the markers it could use as made, against those it can now: what newer ones would add. Not the markers it
  // used: a page uses some of its pool, and the rest aren't newer)
  const mk = ppMadePoolKeys(),
    nowK = pool
      .map(function (m) {
        return m.mkey;
      })
      .sort()
      .join(','),
    newer = !!mk && mk.join(',') !== nowK,
    // (v327: whether to offer Use up to 48 markers: a page at its step's cap, the count not set by hand)
    mcap = !pal && !pp.hand && !pp.more && pp.n >= ppCap(pp.d) ? ppCap(pp.d) : 0,
    key = [
      tid,
      ppSig(pool),
      cand ? cand.buy + '|' + Array.from(state.owned).sort().join(',') : '-',
      photoPaper ? 1 : 0,
      newer ? mk.join(',') : '-',
      mcap,
    ].join('#');
  if (_ppFill && _ppFill.key === key) return _ppFill.res;
  const cat = ppCatMap(),
    data = {
      tl: pp.tg.l,
      tw: pp.tg.w,
      pl: ppLabs(pool),
      ml: newer
        ? ppLabs(
            mk
              .map(function (k) {
                return cat.get(k);
              })
              .filter(Boolean),
          )
        : null,
      cl: cand ? ppLabs(cand.list) : new Float32Array(0),
      cg: cand ? cand.cg : new Uint8Array(0),
      both: !!(cand && cand.both),
      paper: photoPaper ? 1 : 0,
      mcap: mcap,
    },
    job = { key: key, res: null, cand: cand ? cand.list : [] };
  _ppFill = job;
  JOBS.run('ppfill', data)
    .catch(function () {
      return ppFillCore(data);
    })
    .then(function (r) {
      if (_ppFill !== job) return;
      job.res = r;
      ppHelpRefresh();
    })
    .catch(function (e) {
      errLog('Photo page', 'markers to add: ' + ((e && e.message) || e));
    });
  return null;
}
// (a list's markers as chips you can add to To buy; mixed: with their brands' letters, else when the list or your
// collection mixes brands)
function ppChipsHTML(list, mixed) {
  if (mixed === undefined)
    mixed =
      list.some(function (m) {
        return m.brand !== list[0].brand;
      }) || collMixed();
  return list
    .map(function (m) {
      const inner =
        '<span><i style="background:' +
        esc(m.hex) +
        '"></i>' +
        esc((mixed ? bTag(m.brand) + ' ' : '') + capLabel(m)) +
        '</span>';
      return api.wishChip ? api.wishChip(m.mkey, 'closer to your photo', inner) : inner;
    })
    .join(' ');
}
// (a list's words: "Copic", "Ohuhu and Copic")
function ppBrandList(list) {
  const b = {};
  list.forEach(function (m) {
    b[m.brand] = 1;
  });
  return Object.keys(b)
    .sort(function (x, y) {
      return (x === 'Ohuhu' ? 0 : 1) - (y === 'Ohuhu' ? 0 : 1) || (x < y ? -1 : x > y ? 1 : 0);
    })
    .join(' and ');
}
// the line, on the page step (w 'step') or in Plan's Photo panel ('plan'): its own element, filled in again when the
// numbers come (ppHelpRefresh)
function ppHelpHTML(w) {
  return (
    '<div class="sfc-note sfc-mt8 sfpphelp" id="sfPpHelp" data-w="' +
    w +
    '" aria-live="polite">' +
    ppHelpBody(w) +
    '</div>'
  );
}
function ppHelpBody(w) {
  if (!pp || !pp.made || isDemo()) return '';
  const keep = !!(srcImg || srcMay()),
    noPhoto = 'Its photo isn’t kept with this guide, so the page can’t be made again.';
  if (pp.full) {
    const no = ppNotOwned();
    return (
      'Made from ' +
      esc(ppMadeFor()) +
      (no.length
        ? ': ' +
          no.length +
          ' of its markers aren’t yours. <button type="button" class="sflink" data-pp="wish">Add ' +
          (no.length === 1 ? 'it' : 'them') +
          ' to To buy</button>'
        : '.') +
      (keep ? ' · <button type="button" class="sflink" data-pp="own">Use only yours</button>' : '') +
      ppMoreBackHTML()
    );
  }
  const cat = ppCatMap();
  if (pp.add) {
    const no = ppNotOwned();
    if (no.length)
      return (
        'Made with your markers and ' +
        no.length +
        ' you don’t own: ' +
        ppChipsHTML(
          no.map(function (k) {
            return cat.get(k);
          }),
        ) +
        (keep ? ' · <button type="button" class="sflink" data-pp="own">Use only yours</button>' : '') +
        ppMoreBackHTML()
      );
  }
  const r = ppFillGet();
  if (!r) return ppMoreBackHTML();
  const pal = paletteSource === 'saved' || paletteSource === 'generate',
    // (v327.1: whose markers, counted, as the page step's Made for line: the figure is all of them, not the page's)
    whose = pal
      ? 'Your palette matches '
      : 'Your ' + ppPool().length + (ppPool().length === 1 ? ' marker matches ' : ' markers match '),
    list = function (o) {
      return o.i.map(function (i) {
        return _ppFill.cand[i];
      });
    },
    lastA = r.a.c.length ? r.a.c[r.a.c.length - 1] : r.own,
    lastB = r.b && r.b.c.length ? r.b.c[r.b.c.length - 1] : r.own,
    showA = !pal && lastA - r.own >= PP_FILL_SHOW,
    showB =
      !pal &&
      !!r.b &&
      lastB - r.own >= PP_FILL_SHOW &&
      lastB - lastA >= PP_FILL_OTHER &&
      list(r.b).some(function (m) {
        return !r.a.i.length || m.brand !== list(r.a)[0].brand;
      });
  let h = '';
  if (showA || showB) {
    const A = showA ? list(r.a) : list(r.b),
      B = showA && showB ? list(r.b) : null,
      to = showA ? lastA : lastB,
      // (the brands' letters on both lists when either mixes them, or has a brand you don't have: an Ohuhu E19 and
      // a Copic E19 told apart, and a Copic list never read as your Ohuhu codes)
      ownB = {},
      foreign = function (L) {
        return L.some(function (m) {
          return !ownB[m.brand];
        });
      };
    state.owned.forEach(function (k) {
      ownB[k.slice(0, k.indexOf('|'))] = 1;
    });
    const mixed =
        collMixed() || ppBrandList(A.concat(B || [])).indexOf(' and ') > 0 || foreign(A.concat(B || [])),
      tryB = function (l, n) {
        return (
          '<button type="button" class="sflink" data-pp="try" data-l="' +
          l +
          '">Try it with ' +
          (n === 1 ? 'this one' : B ? 'these ' + n : 'these') +
          '</button>'
        );
      };
    h =
      '<div>' +
      whose +
      r.own +
      '% of this photo.</div><div class="sfppfl">' +
      // (the second list alone, from brands you don't have: said whose, as when it's shown second)
      (!showA && foreign(A) ? 'From ' + esc(ppBrandList(A)) + ': ' : 'Adding ') +
      ppChipsHTML(A, mixed) +
      ' would make it ' +
      to +
      '%.</div>' +
      (B
        ? '<div class="sfppfl">From ' +
          esc(ppBrandList(B)) +
          ': ' +
          ppChipsHTML(B, mixed) +
          ' would make it ' +
          lastB +
          '%.</div>'
        : '') +
      '<div class="sfppfl">' +
      (keep
        ? tryB(showA ? 'a' : 'b', A.length) +
          (B ? ' · ' + tryB('b', B.length) : '') +
          ' · <button type="button" class="sflink" data-pp="any">See it with any marker</button>'
        : noPhoto) +
      '</div>';
  } else if (w === 'plan') h = whose + r.own + '% of this photo.';
  // markers you have now that the page wasn't made with, and would match more of the photo
  if (!pal && !pp.add && r.made >= 0 && r.own - r.made >= PP_FILL_NEW && ppAsMade(ppPool()))
    h +=
      (h ? ' ' : '') +
      'Your newer markers match more of it (' +
      r.made +
      '% as made, ' +
      r.own +
      '% now).' +
      (keep
        ? ' <button type="button" class="sflink" data-pp="new">Remake to use them</button>'
        : ' ' + noPhoto);
  // (v327) Use up to 48 markers: colours of the photo the step's cap of markers can't cover
  const mo = r.more;
  if (keep && mo && !pp.more && (mo.lost >= PP_MORE_LOST || mo.gain >= PP_MORE_GAIN))
    h +=
      '<div class="sfppfl" id="sfPpMore">Some of this photo’s colours aren’t on the page: the page’s ' +
      ppCap(pp.d) +
      ' markers can’t cover them all. <button type="button" class="sflink" data-pp="more">Use up to ' +
      ppCap(pp.d) * 2 +
      ' markers</button></div>';
  return h + ppMoreBackHTML();
}
// (v327) with Use up to 48 markers on: said, with the way back
function ppMoreBackHTML() {
  if (!pp || !pp.more) return '';
  const c = ppCap(pp.d);
  return (
    '<div class="sfppfl" id="sfPpMore">Up to ' +
    c +
    ' markers · <button type="button" class="sflink" data-pp="less">Back to ' +
    c / 2 +
    '</button></div>'
  );
}
// the numbers came: the line filled in where it shows, its buttons wired
function ppHelpRefresh() {
  const el = document.getElementById('sfPpHelp');
  if (!el) return;
  const h = ppHelpBody(el.getAttribute('data-w'));
  if (el.innerHTML !== h) el.innerHTML = h;
}
// the line's buttons (one listener on the line, as its contents change): wired where it's put (ctlPhotoPage, the
// Plan's Photo panel)
function ppHelpWire() {
  const el = document.getElementById('sfPpHelp');
  if (!el || el._ppw) return;
  el._ppw = 1;
  el.addEventListener('click', function (e) {
    const b = e.target.closest('[data-pp]');
    if (!b || !pp || _ppBusy) return;
    const k = b.getAttribute('data-pp');
    if (k === 'wish') {
      const no = ppNotOwned();
      if (api.addWish)
        no.forEach(function (x) {
          api.addWish(x, 'photo page', true);
        });
      note(no.length + ' marker' + (no.length === 1 ? '' : 's') + ' added to To buy.');
      ppHelpRefresh();
    } else if (k === 'own')
      ppRemakeWith(function () {
        pp.full = false;
        pp.add = null;
        _ppPick = {};
      });
    else if (k === 'any')
      ppRemakeWith(function () {
        pp.full = true;
        pp.add = null;
        _ppPick = {};
      });
    else if (k === 'try') {
      const r = _ppFill && _ppFill.res,
        o = r && (b.getAttribute('data-l') === 'b' ? r.b : r.a);
      if (!o || !o.i.length) return;
      const keys = o.i.map(function (i) {
        return _ppFill.cand[i].mkey;
      });
      ppRemakeWith(function () {
        pp.full = false;
        pp.add = keys;
        _ppPick = {};
      });
    } else if (k === 'new')
      ppRemakeWith(function () {
        _ppPick = {};
      });
    // (v327) Use up to 48 markers, and back
    else if (k === 'more' || k === 'less')
      ppRemakeWith(function () {
        pp.more = k === 'more';
        _ppPick = {};
      });
  });
}
/* (v327.1) Shade it like the photo (docs/PLAN-v327.1.md, 4): right after a photo-made page's first Build in this
   visit, with shading off and nothing coloured, a line under the tabs offers the Photo style. Gone once tapped or
   closed, once a section is ticked or shading is turned on, after a remake, and for any other picture (loadGen); never
   saved, so a reload or the Library never shows it. Shade it is the Photo style as its button applies it: one Undo
   step, Shading opened, a toast with Undo (which doesn't bring the line back). */
let _ppShFor = -1, // the picture (loadGen) it's offered for
  _ppShGone = -1; // the picture it's gone for
function ppShadeArm() {
  // (the demo, with no markers of your own yet, too: its page is shaded from the whole range, as its plan is)
  if (ppOn() && shadeMode === 'off' && _ppShFor !== loadGen && _ppShGone !== loadGen) _ppShFor = loadGen;
}
function ppShadeGone() {
  if (_ppShFor === loadGen) _ppShGone = loadGen;
}
function ppShadeLineUp() {
  if (_ppShFor !== loadGen || _ppShGone === loadGen) return false;
  if (!ppOn() || !assignData || shadeMode !== 'off' || hasProgress()) {
    ppShadeGone();
    return false;
  }
  // (one line at a time: the kept-sections, pinned and running-low lines first)
  return sfmode === 'guide' && !(_heldNote || _pinNote || lowLineUp());
}
function ppShadeLineHTML() {
  if (!ppShadeLineUp()) return '';
  return (
    '<div id="sfPpShLine" class="sfheldnote sfsamplenote" role="note"><span>Shade it like the photo? A lighter and a ' +
    'darker tone in many sections, from the photo’s own light. <button type="button" id="sfPpShGo" class="sflink">' +
    'Shade it</button></span><button type="button" id="sfPpShX" class="sfheldx" aria-label="Not now">' +
    ic('x') +
    '</button></div>'
  );
}
function ppShadeLineWire() {
  const go = document.getElementById('sfPpShGo'),
    x = document.getElementById('sfPpShX');
  if (go)
    go.addEventListener('click', function () {
      ppShadeGone();
      // (as the Shading row's Photo: 52-controls-plan-wire)
      if (!shPresetApply('photo')) return;
      planWhy = 'Shading: Photo';
      shadeFlatMode = false;
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      gTab = 'shading';
      renderControls();
      renderGuide();
      ctlRefocus('#sfTab-shading');
      toastAction('Shaded like the photo.', 'Undo', function () {
        planUndo();
      });
    });
  if (x)
    x.addEventListener('click', function () {
      ppShadeGone();
      const n = document.getElementById('sfPpShLine');
      if (n) n.remove();
      ctlRefocus('#sfTab-' + gTab);
    });
}
// the page made again for a change of its markers (set): on the page step as Detail does (asked first when there's
// something to lose; one Undo step), from Plan as its Remake does (then shown on the page step)
function ppRemakeWith(set) {
  if (!pp || _ppBusy) return;
  if (sfmode === 'review')
    okGeom(function () {
      set();
      ppRemade(false);
    }, true);
  else ppFromPlan(set);
}
let _ppTools = false;
function ctlPhotoPage() {
  const d = pp.d,
    st = PP_STEPS[d],
    cntTxt = countEl ? countEl.textContent : '',
    hand = pp.hand ? ' (set by you)' : '',
    adjust =
      '<button id="sfAdjToggle" class="sfexp sfc-mt12" aria-expanded="' +
      !!showAdjust +
      '">' +
      ic(showAdjust ? 'chevron-down' : 'chevron-right') +
      ' Adjust photo</button>' +
      (showAdjust && !srcImg && srcMay()
        ? '<div class="sfc-note sfc-mt8" id="sfAdjLoad" role="status">Getting the photo ready…</div>'
        : '') +
      (showAdjust && !srcImg && !srcMay()
        ? '<div class="sfc-note sfc-mt8" id="sfAdjNone">The photo isn’t kept with this guide, so it can’t be turned, cropped or made into a page again. Choose the photo again for a new page.</div>'
        : '') +
      (showAdjust && srcImg
        ? '<div id="sfAdjPanel"><div class="sfc-adjrow"><button id="sfRotL" class="sfghost" aria-label="Turn left 90°">' +
          ic('rotate-ccw') +
          ' 90°</button><button id="sfRotR" class="sfghost" aria-label="Turn right 90°">' +
          ic('rotate-cw') +
          ' 90°</button><button id="sfCrop" class="sfghost">Crop</button></div></div>'
        : ''),
    tools =
      '<button type="button" id="sfPpTools" class="sfexp sfc-mt8" aria-expanded="' +
      _ppTools +
      '">' +
      ic(_ppTools ? 'chevron-down' : 'chevron-right') +
      ' Edit sections</button>' +
      '<div class="sfedtools"' +
      (_ppTools ? '' : ' hidden') +
      '><div id="sfEdit" role="group" aria-label="Edit tool" class="sfc-segs sfc-mt8"><button type="button" id="sfEmToggle" data-m="toggle" class="sfedit">Leave out</button><button type="button" id="sfEmMerge" data-m="merge" class="sfedit">Merge</button><button type="button" id="sfEmSplit" data-m="split" class="sfedit">Split</button><button type="button" id="sfEmAdd" data-m="add" class="sfedit">Add</button></div><div id="sfHint" class="sfc-note sfc-mt8"></div><div class="sfc-note sfc-mt8">Each section shows in its own tint while you edit. Edits go if the page is made again (Detail, a turn or a crop); Undo brings them back.</div></div>';
  ctlEl.innerHTML =
    '<div class="sfpane"><h3 class="sfedhead" id="sfSecHead" tabindex="-1">Your colouring page</h3><div class="sfc-note sfedline">Made from your photo, each section one marker. Choose how much detail, then Build guide.</div>' +
    '<label class="sfrng sfc-mt12">Detail <b id="sfPpDetName">' +
    esc(st.n) +
    '</b><input type="range" id="sfPpDet" min="0" max="4" step="1" value="' +
    d +
    '" aria-valuetext="' +
    esc(st.n) +
    '" aria-describedby="sfPpCount"' +
    (srcImg ? '' : ' disabled') +
    '></label>' +
    // (a guide opened again: its photo is read first, 25-source-photo srcLoad; not kept, the page stays as it is)
    (srcImg
      ? ''
      : srcMay()
        ? '<div class="sfc-note sfc-mt8" id="sfPpLoad" role="status">Getting the photo ready…</div>'
        : '<div class="sfc-note sfc-mt8" id="sfPpNone">The photo isn’t kept with this guide, so its page can’t be made again. Choose the photo again for a new page.</div>') +
    '<div class="sfrnghint" id="sfPpHint">Smallest section about ' +
    st.mm +
    ' mm across on ' +
    esc(ppPaperName(pp.paper)) +
    '</div>' +
    // (v325.1: Focus, 48-subject; v326: Subject only's crop offer)
    ppFocusHTML() +
    ppCropOfferHTML() +
    '<div class="sfc-note sfc-mt8" id="sfPpCount" role="status">This page: ' +
    esc(ppCountText()) +
    esc(hand) +
    '</div>' +
    '<div class="sfc-note" id="sfPpMade">Made for ' +
    esc(ppMadeFor()) +
    '.</div>' +
    // (v326: the step in its markers' colours, unless the plan isn't as made, 2)
    (!_ppTools && ppStepWhy() && ppStepWhy() !== 'none'
      ? '<div class="sfc-note sfc-mt8" id="sfPpWhy">' + esc(ppStepWhy()) + '</div>'
      : '') +
    ppHelpHTML('step') +
    '<span id="sfCount" hidden>' +
    esc(cntTxt || '0 sections') +
    '</span>' +
    adjust +
    tools +
    '<div id="sfKeepLine" class="sfc-note sfc-mt10" style="display:none"></div></div>' +
    edBarHTML(false);
  minEl = null;
  countEl = document.getElementById('sfCount');
  const wire = function (id, ev, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  };
  const det = document.getElementById('sfPpDet');
  if (det) {
    det.addEventListener('input', function () {
      const s = PP_STEPS[+det.value],
        nm = document.getElementById('sfPpDetName'),
        hi = document.getElementById('sfPpHint');
      if (nm) nm.textContent = s.n;
      if (hi) hi.textContent = 'Smallest section about ' + s.mm + ' mm across on ' + ppPaperName(pp.paper);
      det.setAttribute('aria-valuetext', s.n);
    });
    // (made again once it's let go: a page takes a second or more, so not while it's dragged)
    det.addEventListener('change', function () {
      ppSetDetail(+det.value);
    });
  }
  const foc = document.getElementById('sfPpFoc');
  if (foc)
    foc.addEventListener('click', function (e) {
      const b = e.target.closest('[data-v]');
      if (b && !b.disabled) ppSetFocus(b.dataset.v);
    });
  ppHelpWire();
  wire('sfPpCropGo', 'click', ppCropSubject);
  wire('sfAdjToggle', 'click', function () {
    showAdjust = !showAdjust;
    renderControls();
    if (showAdjust) adjReveal();
  });
  if (!srcImg && srcMay()) srcLoad();
  wire('sfCrop', 'click', enterCrop);
  wire('sfRotL', 'click', function () {
    okGeom(function () {
      rot90 = (rot90 + 270) % 360;
      cropRect = null;
      reprocessImg();
    }, true);
  });
  wire('sfRotR', 'click', function () {
    okGeom(function () {
      rot90 = (rot90 + 90) % 360;
      cropRect = null;
      reprocessImg();
    }, true);
  });
  wire('sfPpTools', 'click', function () {
    _ppTools = !_ppTools;
    renderControls();
    // (v326: the tints while the tools are open, the markers' colours again after, 2; the Photo button's photo off, 8)
    render();
    positionPeekBtn();
    if (_ppTools) ctlRefocus('#sfEmToggle');
  });
  ['sfEmToggle', 'sfEmMerge', 'sfEmSplit', 'sfEmAdd'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b)
      b.addEventListener('click', function () {
        setEditMode(b.dataset.m);
        editPressed();
      });
  });
  edBarWire();
  setEditMode(editMode);
  editPressed();
  updateUndoUI();
}
function ppPaperName(p) {
  return { letter: 'Letter', a4: 'A4', a5: 'A5', half: 'Half Letter' }[p] || 'Letter';
}
// Detail moved: the page made again at step d (asked first when there's something to lose; one Undo step)
function ppSetDetail(d) {
  if (!pp || d === pp.d || _ppBusy || !srcImg) {
    renderControls();
    return;
  }
  okGeom(
    function () {
      pp.d = d;
      ppRemade(false);
    },
    true,
    function () {
      // (not remade: the slider back where it was)
      renderControls();
    },
  );
}
// the page made again for a change (Detail, the markers, the paper, a turn or crop: geo), as reprocessImg does it for
// a colouring page: its Undo step kept already (okGeom), the step drawn again once it's in place
// (what a make has to say instead of its usual line: Focus gone back to Even, ppMake)
let _ppSaid = null;
function ppSaid() {
  const t = _ppSaid;
  _ppSaid = null;
  return t;
}
function ppRemade(geo) {
  const he = hasEdits || hasProgress();
  // (v327.1: a remade page isn't offered Shade it again)
  ppShadeGone();
  return ppMake(geo)
    .then(function (ok) {
      if (!ok) return false;
      geoUndoOK();
      editMode = 'toggle';
      if (sfmode !== 'review') sfmode = 'review';
      renderControls();
      render();
      ppNote(ppSaid() || (he ? 'Page made again — tap Undo to bring back your edits and progress.' : null));
      return true;
    })
    .catch(function (err) {
      geoCancel();
      renderControls();
      note(errNote('Couldn’t make the page again.', 'Making a page', err));
      return false;
    });
}
