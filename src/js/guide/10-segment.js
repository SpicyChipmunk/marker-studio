/* ---- colour ---- */
function hsl2rgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l),
    f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
/* ---- threshold ---- */
function otsu(g, n) {
  const h = new Uint32Array(256);
  for (let i = 0; i < n; i++) h[g[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * h[t];
  let sB = 0,
    wB = 0,
    mx = 0,
    thrLo = 127,
    thrHi = 127;
  for (let t = 0; t < 256; t++) {
    wB += h[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += t * h[t];
    const mB = sB / wB,
      mF = (sum - sB) / wF,
      v = wB * wF * (mB - mF) * (mB - mF);
    if (v > mx) {
      mx = v;
      thrLo = thrHi = t;
    } else if (v === mx && mx > 0) thrHi = t;
  }
  return (thrLo + thrHi) >> 1;
}
function autoStretch(g, n) {
  const h = new Uint32Array(256);
  for (let i = 0; i < n; i++) h[g[i]]++;
  let lo = 0,
    hi = 255,
    acc = 0;
  const cut = n * 0.01;
  for (let t = 0; t < 256; t++) {
    acc += h[t];
    if (acc > cut) {
      lo = t;
      break;
    }
  }
  acc = 0;
  for (let t = 255; t >= 0; t--) {
    acc += h[t];
    if (acc > cut) {
      hi = t;
      break;
    }
  }
  if (hi - lo < 8) return g;
  const out = new Uint8Array(n),
    sc = 255 / (hi - lo);
  for (let i = 0; i < n; i++) {
    let v = (g[i] - lo) * sc;
    out[i] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }
  return out;
}
// (v313: the running sums as whole numbers, Uint32, while they fit — 255 × W × H under 2³²: up to about 4,100 × 4,100,
// and MAXSIDE is 2400 — half the memory of Float64 and faster, the same sums; Float64 beyond)
function adaptiveInk(g, n) {
  const w1 = W + 1,
    ii = 255 * W * H < 4294967295 ? new Uint32Array(w1 * (H + 1)) : new Float64Array(w1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let rs = 0;
    const o = (y + 1) * w1,
      po = y * w1;
    for (let x = 0; x < W; x++) {
      rs += g[y * W + x];
      ii[o + x + 1] = ii[po + x + 1] + rs;
    }
  }
  const r = Math.max(10, (Math.min(W, H) / 20) | 0),
    C = adaptC,
    ink = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    const y0 = y > r ? y - r : 0,
      y1 = y + r < H ? y + r : H - 1,
      a0 = y0 * w1,
      a1 = (y1 + 1) * w1,
      ry = y * W;
    for (let x = 0; x < W; x++) {
      const x0 = x > r ? x - r : 0,
        x1 = x + r < W ? x + r : W - 1;
      const mean =
        (ii[a1 + x1 + 1] - ii[a0 + x1 + 1] - ii[a1 + x0] + ii[a0 + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1));
      if (g[ry + x] < mean - C) ink[ry + x] = 1;
    }
  }
  return ink;
}
// camera noise and paper grain: measure how much pixels jitter against their neighbours, and smooth just
// enough to stop the jitter reading as ink. Clean line art measures near zero and is left untouched.
function noiseLevel(g) {
  const d = [],
    st = Math.max(1, Math.floor(Math.sqrt((W * H) / 60000)));
  for (let y = 1; y < H - 1; y += st)
    for (let x = 1; x < W - 1; x += st) {
      const p = y * W + x,
        m = (g[p - 1] + g[p + 1] + g[p - W] + g[p + W]) * 0.25,
        v = g[p];
      if (v < 160) continue;
      d.push(Math.abs(v - m));
    }
  if (d.length < 100) return 0;
  d.sort(function (a, b) {
    return a - b;
  });
  return d[(d.length * 0.5) | 0];
}
// a box blur reaching r pixels each way (r 1: 3 x 3), as a row pass then a column pass of running sums (whole numbers,
// so the mean comes out exactly as summing the box would); at the picture's edges, the mean of what's inside it
function boxBlur(g, r) {
  r = r || 1;
  const n = g.length,
    mid = new Int32Array(n),
    out = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    let s = 0;
    for (let x = 0; x <= Math.min(r, W - 1); x++) s += g[ro + x];
    for (let x = 0; x < W; x++) {
      mid[ro + x] = s;
      if (x + r + 1 < W) s += g[ro + x + r + 1];
      if (x - r >= 0) s -= g[ro + x - r];
    }
  }
  const col = new Int32Array(W),
    cw = new Int32Array(W);
  for (let x = 0; x < W; x++) cw[x] = Math.min(W - 1, x + r) - Math.max(0, x - r) + 1;
  for (let y = 0; y <= Math.min(r, H - 1); y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) col[x] += mid[o + x];
  }
  for (let y = 0; y < H; y++) {
    const ch = Math.min(H - 1, y + r) - Math.max(0, y - r) + 1,
      o = y * W,
      ad = y + r + 1 < H ? (y + r + 1) * W : -1,
      sb = y - r >= 0 ? (y - r) * W : -1;
    for (let x = 0; x < W; x++) {
      out[o + x] = (col[x] / (cw[x] * ch) + 0.5) | 0;
      if (ad >= 0) col[x] += mid[ad + x];
      if (sb >= 0) col[x] -= mid[sb + x];
    }
  }
  return out;
}

// grainy paper and camera noise leave specks of 'ink' that chop the paper into crumbs: drop any ink blob too
// small to be part of a line (lines are long and connected; a dot eye is still far bigger than a speck)
// (v313) despeckle's figures for the faint-marks split (faintSplitFast), valid straight after it, as segment uses them
let _faintStats = null;
// (v318.15) the blobs too big to be dropped here but small enough to be a speck in the blank paper (under SPECK_MARGIN_MM mm²
// on the page, the picture's long side taken as a Letter page's), with their pixels, 10th-percentile grey and box;
// speckClean (segEnd) decides once the background is known. And the lines' own typical grey (the ink-weighted median
// of the bigger blobs' cores). Valid straight after despeckle, as _faintStats is.
let _speckCands = null;
// (faint specks anywhere in the background up to SPECK_MM mm², grain lighter than the lines in the margin up to
// SPECK_MARGIN_MM: a clump of grain on a photographed page, with crumbs of paper in it, runs to 5-6 mm²)
const SPECK_MM = 3,
  SPECK_MARGIN_MM = 10;
function speckCap(mm) {
  return Math.max(
    Math.round(10 * srcK * srcK),
    Math.round((mm || SPECK_MARGIN_MM) * Math.pow((MIN_MM * Math.max(W, H)) / PAGE_MM, 2)),
  );
}
function despeckle(L) {
  const n = W * H,
    // (an enlarged picture's specks are srcK² times as big: cleared as they were before it was enlarged, v303)
    sp = Math.max(Math.round(4 * srcK * srcK), Math.round(n / 500000) * 2),
    cap = Math.max(sp, speckCap()),
    cands = [],
    lh = new Float64Array(256),
    seen = new Uint8Array(n),
    st = new Int32Array(n),
    blob = new Int32Array(cap + 1),
    // (v313) the faint-marks split's figures, gathered on this same walk over the ink blobs (faintSplit walked them all
    // again, about a tenth of the time to find the sections): each kept blob's grey histogram, scored by its
    // 10th-percentile grey, as faintSplit does
    hs = new Uint32Array(256),
    fh = new Float64Array(256),
    stats = gray && gray.length === n;
  let gone = 0,
    dark = 0,
    mid = 0,
    faint = 0,
    tot = 0;
  for (let p = 0; p < n; p++) {
    if (L[p] !== -1 || seen[p]) continue;
    let sn = 0,
      bn = 0,
      big = false;
    st[sn++] = p;
    seen[p] = 1;
    if (stats) hs.fill(0);
    while (sn > 0) {
      const q = st[--sn];
      if (!big) {
        if (bn <= cap) blob[bn++] = q;
        if (bn > cap) big = true;
      }
      if (stats) hs[gray[q]]++;
      const x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const r = yy * W + xx;
          if (L[r] === -1 && !seen[r]) {
            seen[r] = 1;
            st[sn++] = r;
          }
        }
      }
    }
    if (!big && bn <= sp) {
      for (let k = 0; k < bn; k++) L[blob[k]] = 0;
      gone += bn;
    } else if (stats) {
      let cnt = 0;
      for (let g = 0; g < 256; g++) cnt += hs[g];
      const k = Math.max(1, Math.ceil(cnt * 0.1));
      let core = 0,
        acc = 0;
      while (core < 255 && acc + hs[core] < k) acc += hs[core++];
      tot += cnt;
      if (core < 64) dark += cnt;
      else if (core >= 160) {
        faint += cnt;
        fh[core] += cnt;
      } else mid += cnt;
      if (!big) {
        let x0 = W,
          y0 = H,
          x1 = -1,
          y1 = -1;
        for (let j = 0; j < bn; j++) {
          const q = blob[j],
            x = q % W,
            y = (q / W) | 0;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        cands.push({ px: blob.slice(0, bn), core: core, x0: x0, y0: y0, x1: x1, y1: y1 });
      } else lh[core] += cnt;
    }
  }
  _faintStats = stats ? { dark: dark, mid: mid, faint: faint, tot: tot, fh: fh } : null;
  let lc = 0;
  if (stats) {
    let all = 0,
      acc = 0;
    for (let g = 0; g < 256; g++) all += lh[g];
    while (lc < 255 && acc + lh[lc] < all / 2) acc += lh[lc++];
  }
  _speckCands = stats ? { list: cands, line: lc } : null;
  return gone;
}
// (v318.15) Specks in the blank paper. Grain, dust and a printer's specks round a page became ink blobs too big for
// despeckle and too small to matter, drawn as the line and printed with the guide: on a photo of a printed page, 233
// round its margin. A blob (despeckle's _speckCands) that touches only background (or crumbs of paper it closes in)
// is made paper (the label of the background round it, whose area grows) when it's faint (its core grey 160 or more,
// what Ignore faint grey marks calls faint) and under SPECK_MM mm², or when it lies in the margin, outside the box
// round the sections (padded 1 mm), and is lighter than the lines (by 30 greys), under SPECK_MARGIN_MM mm²: a full stop, a signature's dot or a letter in a caption, as dark as the
// drawing, stays. Inside the drawing's extent a dark dot stays too (stars in a sky that's background). The faint-marks
// figures lose what went, so Ignore faint grey marks isn't offered for them (and never offered because of them). Saved guides keep their sections: only a
// new build or a re-detection does this.
function speckClean() {
  const S = _speckCands;
  _speckCands = null;
  if (!S || !S.list.length || !labels || !comps) return 0;
  const mpx = minPx(),
    fcap = speckCap(SPECK_MM),
    pad = Math.round((MIN_MM * Math.max(W, H)) / PAGE_MM),
    mm1 = Math.max(mpx, pad * pad);
  let bx0 = W,
    by0 = H,
    bx1 = -1,
    by1 = -1;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    // (the drawing's extent: its sections of 20 mm² or more, not the crumbs of paper a clump of grain closes in)
    if (!c || c.merged || c.bg || c.area < 20 * mm1) continue;
    if (c.x0 < bx0) bx0 = c.x0;
    if (c.y0 < by0) by0 = c.y0;
    if (c.x1 > bx1) bx1 = c.x1;
    if (c.y1 > by1) by1 = c.y1;
  }
  bx0 -= pad;
  by0 -= pad;
  bx1 += pad;
  by1 += pad;
  const fs = _faintStats;
  let gone = 0;
  for (let i = 0; i < S.list.length; i++) {
    const b = S.list[i],
      faint = b.core >= 160 && b.px.length <= fcap,
      margin = bx1 < 0 || b.x1 < bx0 || b.x0 > bx1 || b.y1 < by0 || b.y0 > by1;
    if (!faint && !(margin && b.core > S.line + 30)) continue;
    // every pixel round it background, or a crumb of paper it closes in (a section under Min section size inside its
    // box: a speck's clump of grain has them), which goes with it
    let to = 0,
      ok = true;
    const crumbs = [];
    for (let j = 0; j < b.px.length && ok; j++) {
      const q = b.px[j],
        x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const l = labels[yy * W + xx];
          if (l === -1) continue;
          const c = l > 0 ? comps[l] : null;
          if (c && c.bg) {
            if (!to) to = l;
            continue;
          }
          if (
            c &&
            !c.merged &&
            c.area < mpx &&
            c.x0 >= b.x0 &&
            c.x1 <= b.x1 &&
            c.y0 >= b.y0 &&
            c.y1 <= b.y1
          ) {
            if (crumbs.indexOf(l) < 0) crumbs.push(l);
            continue;
          }
          ok = false;
          break;
        }
      }
    }
    if (!ok || !to) continue;
    for (let j = 0; j < b.px.length; j++) labels[b.px[j]] = to;
    let cn = 0;
    crumbs.forEach(function (l) {
      const c = comps[l];
      for (let y = c.y0; y <= c.y1; y++)
        for (let x = c.x0; x <= c.x1; x++) {
          const q = y * W + x;
          if (labels[q] === l) {
            labels[q] = to;
            cn++;
          }
        }
      // (gone into the background: no pixels of its own now)
      c.area = 0;
      c.bg = true;
      c.merged = true;
      c.into = to;
    });
    comps[to].area += b.px.length + cn;
    gone += b.px.length;
    if (fs) {
      fs.tot -= b.px.length;
      if (b.core < 64) fs.dark -= b.px.length;
      else if (b.core >= 160) {
        fs.faint -= b.px.length;
        fs.fh[b.core] -= b.px.length;
      } else fs.mid -= b.px.length;
    }
  }
  // (only ever taking the offer away: with dark specks gone the faint share can rise, and a page with no faint marks
  // was offered Ignore faint grey marks on the guide benchmark's doodles-and-text page)
  if (gone && !faintCut && faintOffer) faintOffer = faintSplitFast();
  speckGone = gone;
  return gone;
}
let speckGone = 0;
// the faint-marks split from the figures despeckle gathered (the same answer as faintSplit, without the second walk;
// faintSplit stays, for when there are none and for the tests)
function faintSplitFast() {
  const s = _faintStats;
  if (!s) return faintSplit();
  if (!s.tot || s.dark < 0.5 * s.tot || s.faint < 0.05 * s.tot || s.mid >= 0.5 * s.faint) return 0;
  let c = 160,
    acc = 0;
  while (c < 255 && acc + s.fh[c] < s.faint / 2) acc += s.fh[c++];
  return Math.max(160, c - 32);
}
// (v308) Faint grey marks: a watermark, or light decorative swirls, drawn much paler than the outlines. The ink is
// grouped into blobs, each scored by its core (its 10th-percentile grey: a single pixel's grey can't tell them apart,
// as the soft edges of black lines fill the gap). Ignore faint grey marks is offered only on a clear split: blobs with
// dark cores (under 64) at least half the ink, faint ones (160 or more) at least 5%, and those between them under half
// the faint share. Returns the grey above which ink would be ignored (the faint cores' typical grey less 32, never
// below 160), or 0 when it isn't offered. (A page whose lines are all mid-grey is never offered it.)
function faintSplit() {
  const n = W * H;
  if (!labels || !gray || gray.length !== n) return 0;
  const seen = new Uint8Array(n),
    st = new Int32Array(n),
    hs = new Uint32Array(256),
    fh = new Float64Array(256);
  let dark = 0,
    mid = 0,
    faint = 0,
    tot = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== -1 || seen[p]) continue;
    let sn = 0,
      cnt = 0;
    st[sn++] = p;
    seen[p] = 1;
    hs.fill(0);
    while (sn > 0) {
      const q = st[--sn];
      hs[gray[q]]++;
      cnt++;
      const x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const r = yy * W + xx;
          if (labels[r] === -1 && !seen[r]) {
            seen[r] = 1;
            st[sn++] = r;
          }
        }
      }
    }
    // its core: the 10th-percentile grey
    const k = Math.max(1, Math.ceil(cnt * 0.1));
    let core = 0,
      acc = 0;
    while (core < 255 && acc + hs[core] < k) acc += hs[core++];
    tot += cnt;
    if (core < 64) dark += cnt;
    else if (core >= 160) {
      faint += cnt;
      fh[core] += cnt;
    } else mid += cnt;
  }
  if (!tot || dark < 0.5 * tot || faint < 0.05 * tot || mid >= 0.5 * faint) return 0;
  // the faint cores' typical grey (the median, by ink)
  let c = 160,
    acc = 0;
  while (c < 255 && acc + fh[c] < faint / 2) acc += fh[c++];
  return Math.max(160, c - 32);
}
/* ---- connected components ---- */
// (v318.12) an edge-to-edge drawing: its lines run off the picture's edges at many points, the picture's edge is
// mostly paper, and no region holds much of it. The edge rule below takes the regions with the most edge as the
// background, as it should for a page with a margin; here they're the drawing's own edge shapes, a sixth to a
// quarter of the page (the guide benchmark: 7–11 lost a page). On the benchmark's pages: edge-to-edge ones 28–44 runs
// of ink along the edge, the longest region 7–13% of it, ink 5–9% of it; pages with a margin 0–4 runs, one region
// 69–100% (or a margin cut by a few lines: 4 runs, 33%; straightened, 33–91%). A photo with the table round it is
// never one: its edge is 18–74% dark (wood, stone, the binding).
function bgEdgeTest() {
  if (!labels || !(W > 8 && H > 8) || !(bgMaxB > 0)) return false;
  const P = 2 * (W + H) - 4;
  if (bgMaxB > 0.2 * P) return false;
  // (along a ring a little inside the picture's edge: a straightened photo keeps a sliver of table or shadow at its
  // very edge, the page's corners found to within a few pixels)
  const d = Math.max(1, Math.min(Math.round(0.01 * Math.min(W, H)), (Math.min(W, H) >> 2) - 1)),
    x0 = d,
    y0 = d,
    x1 = W - 1 - d,
    y1 = H - 1 - d;
  let ink = 0,
    runs = 0,
    n = 0,
    prev = labels[y0 * W + x0 + 1] <= 0;
  const at = function (p) {
    const i = labels[p] <= 0;
    n++;
    if (i) ink++;
    if (i && !prev) runs++;
    prev = i;
  };
  for (let x = x0; x <= x1; x++) at(y0 * W + x);
  for (let y = y0 + 1; y <= y1; y++) at(y * W + x1);
  for (let x = x1 - 1; x >= x0; x--) at(y1 * W + x);
  for (let y = y1 - 1; y > y0; y--) at(y * W + x0);
  return runs >= 12 && ink <= 0.15 * n;
}
function applyBg(fresh) {
  const n = comps.length,
    bgRel = 0.6 - (bgTrim / 100) * 0.5;
  if (fresh || !(bgMaxB > 0)) {
    let mx = 0;
    for (let l = 1; l < n; l++) {
      const c = comps[l];
      if (c && !c.merged && c.bpx > mx) mx = c.bpx;
    }
    bgMaxB = mx;
    bgEdgeAll = bgRule >= 1 && bgEdgeTest();
  }
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged) continue;
    c.bg = !bgEdgeAll && bgMaxB > 0 && c.bpx >= bgRel * bgMaxB;
  }
  let pl = 0;
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (c && c.page && !c.merged) {
      pl = l;
      break;
    }
  }
  const pg = pl ? comps[pl] : null;
  if (pg) {
    pg.bg = true;
    for (let l = 1; l < n; l++) {
      const c = comps[l];
      if (!c || c.merged || l === pl) continue;
      if (c.bpx > 0 || c.cx < pg.x0 || c.cx > pg.x1 || c.cy < pg.y0 || c.cy > pg.y1) c.bg = true;
    }
  }
  // the paper inside a drawn frame (findFrame) is left white, and so is anything whose middle is outside the frame (a
  // watermark's letters)
  for (let l = 1; l < n; l++) {
    const f = comps[l];
    if (!f || f.merged || !f.framed) continue;
    f.bg = true;
    for (let k = 1; k < n; k++) {
      const c = comps[k];
      if (!c || c.merged || k === l) continue;
      if (c.cx < f.x0 || c.cx > f.x1 || c.cy < f.y0 || c.cy > f.y1) c.bg = true;
    }
    break;
  }
}
// a phone photo that shows the table around the page: the paper's blank margin is one big region that rings
// the drawing on all four sides, brighter than what lies outside it. That margin (and the table) is background.
function findPage() {
  const n = comps.length,
    N = W * H;
  let best = 0,
    ba = 0;
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged || c.bg || c.bpx > 0) continue;
    if (c.area > ba) {
      ba = c.area;
      best = l;
    }
  }
  if (!best || ba < N * 0.08 || !gray || gray.length !== N) return;
  const c = comps[best];
  if (c.x1 - c.x0 < W * 0.5 || c.y1 - c.y0 < H * 0.5) return;
  const skip = function (q) {
    const v = labels[q];
    if (v === -1) return true;
    const k = comps[v];
    return !k || k.bg || k.area < Math.max(40 * srcK * srcK, N * 0.00002);
  };
  const S = 24,
    side = function (fn) {
      let hit = 0,
        tot = 0;
      for (let i = 1; i <= S; i++) {
        const f = 0.2 + (0.6 * i) / (S + 1),
          r = fn(f);
        if (r < 0) continue;
        tot++;
        if (r === best) hit++;
      }
      return tot ? hit / tot : 0;
    };
  const walk = function (x, y, dx, dy) {
    while (x >= 0 && y >= 0 && x < W && y < H) {
      const q = y * W + x;
      if (!skip(q)) return labels[q];
      x += dx;
      y += dy;
    }
    return -1;
  };
  const sides = [
    side(function (f) {
      return walk(0, (f * H) | 0, 1, 0);
    }),
    side(function (f) {
      return walk(W - 1, (f * H) | 0, -1, 0);
    }),
    side(function (f) {
      return walk((f * W) | 0, 0, 0, 1);
    }),
    side(function (f) {
      return walk((f * W) | 0, H - 1, 0, -1);
    }),
  ];
  if (Math.min.apply(null, sides) < 0.7) return;
  // brighter than outside: the page, not a drawn frame on the same paper
  let si = 0,
    ni = 0,
    so = 0,
    no = 0;
  const st = Math.max(1, Math.floor(Math.sqrt(N / 200000)));
  for (let y = 0; y < H; y += st)
    for (let x = 0; x < W; x += st) {
      const q = y * W + x,
        v = labels[q];
      if (v === best) {
        si += gray[q];
        ni++;
      } else if (v > 0 && comps[v] && comps[v].bg) {
        so += gray[q];
        no++;
      }
    }
  if (!ni || !no || si / ni - so / no < 18) return;
  c.page = true;
}
/* A frame drawn round the picture on the same paper (v305): the paper inside it is one big section whose box runs
   along the frame's inner edge on all four sides, with the drawing inside that box. A page without a frame leaves its
   paper white, so a frame doesn't change that: the section is marked framed and left white (applyBg), with a line
   to Colour it (frameLeft). Only when a picture's sections are found (segment), not when a guide opens again: a
   guide saved before keeps its sections as they were saved. The rule:
   - the biggest section (not background, not the page in a photo) is at least 8% of the picture;
   - its box spans at least half the picture's width and height;
   - each of the box's four edges is at least 75% that section (looked at 4 px in from the edge, every other px);
   - the sections outside its box add up to at most 0.5% of the picture (v308: not counting the frame's own parts
     just outside it, the strips between two frame lines and its corner ornaments: frameOwn).
   On the downloaded pages tried it finds the mandala's and the paisley's frames (2 of 15), and no other page (the
   octopus and otter frames have art breaking out of them); a sky over a horizon, a board in the middle of a
   drawing, art breaking out of a frame and a frame of tiles don't count. */
const FRAME_MIN = 0.08,
  FRAME_SPAN = 0.5,
  FRAME_EDGE = 0.75,
  FRAME_OUT = 0.005,
  // (v308) what may lie just outside a frame without counting as art outside it: within FRAME_BAND of the short side
  // beyond the frame, the strips between two frame lines (thinner than FRAME_STRIP of the short side, running along
  // FRAME_RUN of a side or more: corner ornaments cut that strip into four) and the ornaments themselves (each at most
  // FRAME_ORN of the picture, its middle within FRAME_CORNER of the short side from a corner of the frame)
  FRAME_BAND = 0.06,
  FRAME_STRIP = 0.03,
  FRAME_RUN = 0.3,
  FRAME_ORN = 0.003,
  FRAME_CORNER = 0.1;
// The biggest section (not background, not the page in a photo) when it's the paper inside a ruled rectangle: at
// least FRAME_MIN of the picture, its box spanning FRAME_SPAN of the width and height, and each edge of its box
// FRAME_EDGE that section. Its number, or 0. (findFrame, and Auto crop: 20-image-input, v308)
function ruledBox() {
  const n = comps.length,
    N = W * H;
  let best = 0,
    ba = 0;
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged || c.bg || c.page) continue;
    if (c.area > ba) {
      ba = c.area;
      best = l;
    }
  }
  if (!best || ba < N * FRAME_MIN) return 0;
  const c = comps[best];
  if (c.x1 - c.x0 < W * FRAME_SPAN || c.y1 - c.y0 < H * FRAME_SPAN) return 0;
  // how much of one edge of its box is the section (horiz: a top or bottom edge, at row `at`; dir: inwards)
  const edge = function (horiz, at, from, to, dir) {
    let hit = 0,
      tot = 0;
    for (let v = from; v <= to; v += 2) {
      tot++;
      for (let k = 0; k < 4; k++) {
        const x = horiz ? v : at + dir * k,
          y = horiz ? at + dir * k : v;
        if (x >= 0 && y >= 0 && x < W && y < H && labels[y * W + x] === best) {
          hit++;
          break;
        }
      }
    }
    return tot ? hit / tot : 0;
  };
  if (
    Math.min(
      edge(true, c.y0, c.x0, c.x1, 1),
      edge(true, c.y1, c.x0, c.x1, -1),
      edge(false, c.x0, c.y0, c.y1, 1),
      edge(false, c.x1, c.y0, c.y1, -1),
    ) < FRAME_EDGE
  )
    return 0;
  return best;
}
// a part outside the frame's box c that is only the frame itself: a strip between two frame lines, or a corner
// ornament (v308)
function frameOwn(d, c) {
  const S = Math.min(W, H),
    b = S * FRAME_BAND;
  if (d.x0 < c.x0 - b || d.x1 > c.x1 + b || d.y0 < c.y0 - b || d.y1 > c.y1 + b) return false;
  const dw = d.x1 - d.x0 + 1,
    dh = d.y1 - d.y0 + 1;
  if (Math.min(dw, dh) < S * FRAME_STRIP) {
    if (dw >= dh && dw >= FRAME_RUN * (c.x1 - c.x0)) return true;
    if (dh > dw && dh >= FRAME_RUN * (c.y1 - c.y0)) return true;
  }
  if (d.area <= W * H * FRAME_ORN) {
    const r = S * FRAME_CORNER;
    for (const p of [
      [c.x0, c.y0],
      [c.x1, c.y0],
      [c.x1, c.y1],
      [c.x0, c.y1],
    ])
      if (Math.hypot(d.cx - p[0], d.cy - p[1]) <= r) return true;
  }
  return false;
}
// the share of the picture in sections outside the box of section `best` (their middles outside it), leaving out
// specks under Min section size and the frame's own parts (frameOwn); inner: only those not touching the picture's
// edge (Auto crop: a screenshot's browser bar runs to the edge, a drawing round a board doesn't)
function frameOutside(best, inner) {
  const n = comps.length,
    mp = minPx(),
    c = comps[best];
  let out = 0;
  for (let l = 1; l < n; l++) {
    const d = comps[l];
    if (!d || d.merged || d.bg || l === best || d.area < mp || (inner && d.bpx > 0)) continue;
    if ((d.cx < c.x0 || d.cx > c.x1 || d.cy < c.y0 || d.cy > c.y1) && !frameOwn(d, c)) out += d.area;
  }
  return out / (W * H);
}
function findFrame() {
  const best = ruledBox();
  if (!best || frameOutside(best) > FRAME_OUT) return;
  comps[best].framed = true;
}
// the paper inside a frame, while it's left white (not brought back as a section): its number, else 0
function frameLeft() {
  if (!comps || !labels) return 0;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    if (c && c.framed && !c.merged) return counted(l) ? 0 : l;
  }
  return 0;
}
// the paper inside a frame, left white or brought back: its number, saved with the guide (`frame`, v306) so a guide
// opened again has its line to Colour it; undefined when there's none
function frameSaved() {
  if (!comps) return undefined;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    if (c && c.framed && !c.merged) return l;
  }
  return undefined;
}
// (v308) The paper's tint in a picture's pixels (RGBA d, n of them, looked at every step-th): the mean colour of the
// brightest 5%, as gains for each channel that make it white, each at most x2; null when the paper is neutral already
// (its brightest channel no more than 1.04 times its dimmest). Used to find a page photographed under a warm lamp
// (pgFind) and to tell a coloured-in page from tinted paper (colourShare).
function paperGains(d, n, step) {
  step = step || 1;
  const hs = new Uint32Array(256);
  let m = 0;
  for (let i = 0; i < n; i += step) {
    const j = i * 4;
    hs[(d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8]++;
    m++;
  }
  if (!m) return null;
  const want = Math.max(1, m * 0.05);
  let t = 255,
    acc = 0;
  while (t > 0 && acc + hs[t] < want) acc += hs[t--];
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < n; i += step) {
    const j = i * 4;
    if ((d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8 < t) continue;
    r += d[j];
    g += d[j + 1];
    b += d[j + 2];
  }
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b);
  if (!(mx > 0) || mx <= 1.04 * mn) return null;
  return [
    Math.min(2, mx / Math.max(1, r)),
    Math.min(2, mx / Math.max(1, g)),
    Math.min(2, mx / Math.max(1, b)),
  ];
}
// how much of a picture (RGBA d, n pixels) is coloured: its share of pixels still clearly coloured once the paper's
// tint is taken out (v308). A line-art page, photographed or downloaded, is well under 1%; a coloured-in one a third.
const COLOUR_CHROMA = 60;
function colourShare(d, n) {
  if (!d || !n) return null;
  const st = Math.max(1, Math.floor(n / 250000)),
    k = paperGains(d, n, st) || [1, 1, 1];
  let c = 0,
    m = 0;
  for (let i = 0; i < n; i += st) {
    const j = i * 4,
      r = Math.min(255, d[j] * k[0]),
      g = Math.min(255, d[j + 1] * k[1]),
      b = Math.min(255, d[j + 2] * k[2]);
    m++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > COLOUR_CHROMA) c++;
  }
  return m ? c / m : null;
}
// (v309.2) The least picture, on its shorter side as it came (before it's enlarged), that's worth finding sections in.
// A page scaled down to a short side of 24–48 px gave 0–11 sections of the 125 it has at full size; 64 px, 24; 80, 55;
// 120, 70 (e2e/fixtures/letter-page.png; a photo of a page went the same way). Under it, the warning says the picture is
// too small: the fragments warning it had got told you to raise Min section size, which left 0 sections. Under
// SMALLISH_PIC, a picture that would get the fragments warning gets this one instead: Safari's own scaling down left
// the same page at 120 px in fragments.
const SMALL_PIC = 100,
  SMALLISH_PIC = 200;
function segQuality() {
  if (!labels || !comps) return { ok: true };
  var w0 = srcDims ? srcDims.w : 0,
    h0 = srcDims ? srcDims.h : 0,
    tooSmall = {
      ok: false,
      code: 'small',
      retake: true,
      msg: 'This picture is very small (' + w0 + ' \u00d7 ' + h0 + ' pixels).',
      tip: 'Find a bigger copy of the page: a saved thumbnail is often this size. A photo of the printed page works too.',
    };
  if (srcDims && Math.min(w0, h0) < SMALL_PIC) return tooSmall;
  var px = W * H,
    ink = 0;
  for (var i = 0; i < px; i++) if (labels[i] === -1) ink++;
  // (tiny: on the picture as it came, an enlarged one's srcK² times as many pixels, v303)
  var inkFrac = px ? ink / px : 0,
    N = 0,
    tiny = 0,
    kept = 0,
    keptTiny = 0,
    // (v308: sections in the guide under 3x Min section size)
    keptSmall = 0,
    mp = minPx(),
    // (v318.13: the coloured page's specks and sections at the size its rule was tuned at, MIN_DEF's, whatever Min
    // section size is now: a new picture's starts bigger, and a photo of a page on a wooden table, as taken, had been
    // told it was coloured in)
    ref = minPx(MIN_DEF),
    keptRef = 0,
    specksRef = 0,
    tc = Math.max(20 * srcK * srcK, px * 0.00002);
  for (var l = 1; l < comps.length; l++) {
    var c = comps[l];
    if (!c || c.merged) continue;
    N++;
    if (c.area < tc && !c.bg) tiny++;
    if (!c.bg) {
      if (c.area >= ref) keptRef++;
      else specksRef++;
    }
    if (!c.bg && c.area >= mp) {
      kept++;
      if (c.area < tc) keptTiny++;
      if (c.area < 3 * mp) keptSmall++;
    }
  }
  var tinyFrac = N ? tiny / N : 0;
  if (inkFrac < 0.02 && N < 5)
    return {
      ok: false,
      code: 'faint',
      retake: true,
      msg: 'Barely any outlines were detected \u2014 the image may be blank, faint, or low-contrast.',
      // (v318.13: Enhance is on for a new picture: then it's Sensitivity, beside it)
      tip:
        'Use line art with dark outlines on a light background, or ' +
        (enhance ? 'raise Sensitivity' : 'turn on Enhance') +
        ' (under Adjust photo).',
    };
  if (N < 2)
    return {
      ok: false,
      code: 'few',
      msg: 'Couldn\u2019t find distinct sections to colour.',
      tip: 'This works best with solid outlines separating white areas.',
    };
  if (inkFrac > 0.55)
    return {
      ok: false,
      code: 'dark',
      retake: true,
      msg: 'Most of the image is dark \u2014 this looks like a photo or heavily shaded drawing rather than outlines.',
      tip: 'Try high-contrast line art on white, or crop to just the drawing.',
    };
  // (v308) a page coloured in already: much of it coloured (the paper's tint taken out) and its colour broken into
  // specks, more than 3 for every section. Real line-art pages are under 1% and 2 specks a section. Only with the
  // picture itself to look at (srcColour): a guide opened again without it isn't checked. Before the warning about
  // fragments: it says more.
  if (srcColour != null && srcColour > 0.15 && specksRef > 3 * keptRef)
    return {
      ok: false,
      code: 'coloured',
      retake: true,
      msg: 'This page looks coloured in already — its colours break up into specks.',
      tip: 'Use the page before it was coloured, with plain outlines on white.',
    };
  // (v303: only when the fragments are in the guide, not just left out by Min section size: a clean page with a
  // scanner's specks, all left out, had been told it was a photo or textured image)
  if (tinyFrac > 0.8 && (kept === 0 || keptTiny > 0.3 * kept)) {
    if (srcDims && Math.min(w0, h0) < SMALLISH_PIC) return tooSmall;
    return {
      ok: false,
      code: 'noisy',
      retake: true,
      msg: 'Found a lot of tiny fragments \u2014 usually a photo or textured image rather than clean line art.',
      tip: 'Use line art with solid outlines, or raise Min section size in Edit sections.',
    };
  }
  // (v308) hatching or shading lines: 200 sections or more, over half of them under 3x Min section size (a
  // hatched page 72%; the most of any real page tried, 29%)
  if (kept >= 200 && keptSmall > 0.5 * kept)
    return {
      ok: false,
      code: 'hatched',
      msg: 'Lots of slivers — this page looks hatched or shaded with lines.',
      tip: 'The lines between the hatching become sections. Raise Min section size in Edit sections, or use a page with plain outlines.',
    };
  // (v318.13) a page the finder was sure of, photographed at a steep angle (pgSteep, pgBegin): last, as the others
  // say more; once said here it stays for this photo
  if (pgSteep && pgOrig)
    return {
      ok: false,
      code: 'steep',
      retake: true,
      msg: 'This page was photographed at a steep angle, so some sections may be missed.',
      tip: 'For best results, photograph it again holding the phone flatter, right above the page.',
    };
  return { ok: true };
}
function labelCells() {
  labelFill();
  labelTail();
}
// (v318.14) labelCells in two: the flood fill (each region of paper a section, its area, box and centre) and what
// follows it (the background, the page and the frame, the per-section arrays), so a paint can come between them
function labelFill() {
  const n = W * H,
    stack = new Int32Array(n);
  comps = [null];
  let cur = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== 0) continue;
    cur++;
    let sp = 0;
    stack[sp++] = p;
    labels[p] = cur;
    let area = 0,
      bpx = 0,
      sx = 0,
      sy = 0,
      mny = 1e9,
      mxy = -1,
      mnx = 1e9,
      mxx = -1;
    while (sp > 0) {
      const q = stack[--sp];
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
      if (x > 0) {
        const r = q - 1;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (x < W - 1) {
        const r = q + 1;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (y > 0) {
        const r = q - W;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (y < H - 1) {
        const r = q + W;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
    }
    comps.push({
      area: area,
      bg: false,
      bpx: bpx,
      cx: sx / area,
      cy: sy / area,
      h: mxy - mny,
      x0: mnx,
      y0: mny,
      x1: mxx,
      y1: mxy,
    });
  }
}
function labelTail() {
  const n = W * H;
  applyBg(true);
  findPage();
  applyBg(false);
  findFrame();
  applyBg(false);
  secColor = new Array(comps.length);
  for (let l = 1; l < comps.length; l++) {
    const hh = (l * 137.508) % 248,
      s = 22 + ((l * 37) % 14),
      li = 61 + ((l * 29) % 13);
    secColor[l] = hsl2rgb(hh, s, li);
  }
  secState = new Uint8Array(comps.length);
  colored = new Uint8Array(comps.length);
  heldReset();
  progAt = { s: 0, e: 0 };
  celebrated = false;
  rgbOut = new Uint8ClampedArray(n * 4);
  imgData = new ImageData(rgbOut, W, H);
}
// (v313) the byte order of a Uint32 write into a canvas's pixels (render): little-endian on every device the app runs on
const LITTLE_END = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
function segment() {
  segBegin();
  segInk();
  segSpeck();
  labelFill();
  segEnd();
}
// (v318.14) segment()'s steps, run one after another (segment) or with a paint between each (segRun)
function segBegin() {
  // (sections found afresh: ticks held for an Undo of a merge were the old sections', 65-edit)
  _tickHeld = {};
  // (a section picked to merge is a number in the old sections, v304)
  mergeSel = -1;
  // (where the zones were, pixel by pixel, to place them again on the new sections: 34-zones)
  zonePixCapture();
}
// the ink: -1 for a line's pixel, 0 for paper
// (v318.23) segInk in parts, so segRun can paint between them: the grey stretched and its noise measured (inkPrep),
// each blur pass (inkBlur), the ink (inkDone). segInk() runs them in one go, the same code
function inkPrep() {
  const n = W * H;
  if (!enhance) return { n: n, src: null, passes: 0 };
  const st = autoStretch(gray, n),
    nl = noiseLevel(st);
  // (the noise measured on the stretched grey, and up to two 3 × 3 box blurs: denoise, until v318.23)
  // (v303: a 3 x 3 box on an enlarged picture too, measured on it as it is. Measured and blurred on the picture as it
  // came instead, a downloaded page's JPEG grain called for a blur that ran close lines together again, undoing what
  // enlarging it is for: the zentangle 1,423 sections -> 1,040, the otter 238 -> 199)
  return { n: n, src: st, passes: nl < 3 ? 0 : nl < 7 ? 1 : 2 };
}
function inkBlur(k) {
  k.src = boxBlur(k.src, 1);
  k.passes--;
}
function inkDone(k) {
  const n = k.n;
  labels = new Int32Array(n);
  if (k.src) {
    const ink = adaptiveInk(k.src, n);
    k.src = null;
    for (let i = 0; i < n; i++) labels[i] = ink[i] ? -1 : 0;
  } else {
    const thr = otsu(gray, n);
    for (let i = 0; i < n; i++) labels[i] = gray[i] < thr ? -1 : 0;
  }
  // (v308: faint grey marks ignored, when asked: the ink lighter than faintCut is paper)
  if (faintCut > 0) for (let i = 0; i < n; i++) if (labels[i] === -1 && gray[i] > faintCut) labels[i] = 0;
}
function segInk() {
  const k = inkPrep();
  while (k.passes > 0) inkBlur(k);
  inkDone(k);
}
function segSpeck() {
  despeckle(labels);
  // (whether to offer to ignore them: measured while they're still there)
  if (!faintCut) faintOffer = faintSplitFast();
}
function segEnd() {
  // (v318.15: the new picture's sections are in place: render() draws them, not the photo shown meanwhile)
  _preview = false;
  labelTail();
  speckClean();
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  segWarn = segQuality();
  // sections were found afresh, so their numbers mean different shapes now: per-section choices can't carry over
  locks = {};
  shadeFlat = {};
  _flatVer++;
  _segFresh = true;
  _origKeys = {};
  _lostKeys = {};
  _gone = {};
}
/* ---- (v318.14) finding the sections with the page free between steps ----
   A 12-megapixel photo's sections took the page for 0.7-1.1 s in one go (on a computer; 2-3 s on an iPad): nothing
   moved, and a tap waited. segRun does the same steps, the same code, with a paint between each, so no step holds the
   page for long. The steps work on a picture of their own (pic: W, H, gray, srcK and what they make, labels, comps,
   the despeckle's figures and the faint offer), put in place of the open one's only while a step runs (picIn/picOut,
   all in one task), so until the last step everything on the page is the open guide as it was, whole. The last step
   puts the new picture and its sections in place in one task (commit), then the rest of segment() and the caller's
   own after-steps (then). A newer run (another Sensitivity, another photo, a guide opened: segStop) stops an older
   one between steps, before it puts anything in place. While one runs (segBusy), the picture and its controls can't
   be used (inert), and Undo/Redo, Build and the photo's own buttons wait. */
let segGen = 0,
  segBusy = false;
const PIC_KEYS = ['W', 'H', 'gray', 'srcK', 'labels', 'comps', '_faintStats', 'faintOffer', '_speckCands'];
function picOut() {
  return {
    W: W,
    H: H,
    gray: gray,
    srcK: srcK,
    labels: labels,
    comps: comps,
    _faintStats: _faintStats,
    faintOffer: faintOffer,
    _speckCands: _speckCands,
  };
}
function picIn(p) {
  W = p.W;
  H = p.H;
  gray = p.gray;
  srcK = p.srcK;
  labels = p.labels;
  comps = p.comps;
  _faintStats = p._faintStats;
  faintOffer = p.faintOffer;
  _speckCands = p._speckCands;
}
// fn run on pic (its results kept in it), the open picture back in place after
function onPic(pic, fn) {
  const was = picOut();
  picIn(pic);
  try {
    fn();
  } finally {
    const got = picOut();
    for (let i = 0; i < PIC_KEYS.length; i++) pic[PIC_KEYS[i]] = got[PIC_KEYS[i]];
    picIn(was);
  }
}
// (the tests' geoSet and autoCrop, which change the picture and read it in the same breath: the steps all at once, as
// before v318.14, and the caller's after-steps straight after; 99-close)
let segSync = false;
// run(): the steps (a promise from segRun); once(): the same in one go; after(ok) the caller's after-steps; fail(err)
function segThen(run, once, after, fail) {
  if (segSync) {
    segStop();
    try {
      once();
    } catch (e) {
      fail(e);
      return;
    }
    after(true);
    return;
  }
  run().then(function (ok) {
    // (the after-steps run in the last step's own task: timed with it, as one wait)
    holdTime('Sections drawn', function () {
      after(ok);
    });
  }, fail);
}
function segStop() {
  segGen++;
  segBusySet(false);
}
// (hide: the controls out of sight meanwhile, for a new picture, whose controls are drawn once it's ready. ctl: the
// controls can't be used either, for a picture that changes; not when only the sections are found again, so the
// Sensitivity slider being dragged or stepped with the keyboard keeps going: each change takes over (Build, Undo and
// Redo are held by segBusy). The keyboard goes back where it was after.)
let _segFocus = null;
function segBusySet(on, hide, ctl) {
  segBusy = on;
  const v = document.getElementById('sfView');
  if (v) v.inert = on;
  if (ctlEl) {
    if (on && ctl && workEl && workEl.contains(document.activeElement)) _segFocus = document.activeElement;
    ctlEl.inert = on && !!ctl;
    ctlEl.style.visibility = on && hide ? 'hidden' : '';
    // (the bar of the controls' buttons, Build among them, is docked below the picture: 72-frame dockBar)
    const bar = barEl();
    if (bar) {
      bar.inert = on && !!ctl;
      bar.style.visibility = on && hide ? 'hidden' : '';
    }
    if (!on && _segFocus) {
      const f = _segFocus;
      _segFocus = null;
      if (f.isConnected && document.activeElement !== f) f.focus({ preventScroll: true });
    }
  }
}
// prep(): a new picture (W, H, gray, srcK, and anything else its commit needs), or null to find the sections again on
// the open one; commit(pic): put it in place (before the sections). Resolves true when done, false when a newer run
// took over; rejects on an error (nothing put in place). hide: the controls out of sight meanwhile (segBusySet).
// (v318.23: the steps' names, for the waits Copy diagnostics lists)
const SEG_STEP_NAMES = ['prepare', 'ink', 'smooth', 'specks', 'sections', 'put in place'];
function segRun(prep, commit, hide) {
  const my = ++segGen;
  segBusySet(true, hide, !!prep);
  let pic = null;
  const steps = [
    function () {
      pic = prep ? prep() : { W: W, H: H, gray: gray, srcK: srcK };
      pic.labels = null;
      pic.comps = null;
      pic._faintStats = null;
      pic._speckCands = null;
      // (kept as it is when faint marks are ignored: segSpeck measures it only when they aren't)
      pic.faintOffer = faintOffer;
      if (!pic.gray) throw new Error('no picture');
    },
    function () {
      onPic(pic, function () {
        pic._ink = inkPrep();
        if (!pic._ink.passes) inkDone(pic._ink);
      });
    },
    function () {
      const k = pic._ink;
      if (!k.passes) return;
      onPic(pic, function () {
        inkBlur(k);
        if (!k.passes) inkDone(k);
      });
      if (k.passes) return 'again';
    },
    function () {
      onPic(pic, segSpeck);
    },
    function () {
      onPic(pic, labelFill);
    },
    function () {
      if (commit) commit(pic);
      segBegin();
      picIn(pic);
      segEnd();
    },
  ];
  return new Promise(function (res, rej) {
    let i = 0;
    const next = function () {
      if (my !== segGen) return res(false);
      try {
        // (v318.23: each step timed for Copy diagnostics, holdTime in safety.js)
        const r = holdTime(
          (prep ? 'New photo: ' : 'Sections again: ') + SEG_STEP_NAMES[i],
          function () {
            return steps[i]();
          },
          function () {
            return pic && pic.W ? pic.W + '×' + pic.H : '';
          },
        );
        if (r !== 'again') i++;
      } catch (e) {
        if (my === segGen) {
          segBusySet(false);
          // (v318.15: a new photo shown meanwhile, photoPreview, goes: the open picture is drawn again as it was)
          if (_preview) {
            _preview = false;
            try {
              render();
            } catch (e2) {
              /* drawn with the next change */
            }
          }
        }
        rej(e);
        return;
      }
      if (i < steps.length) afterPaint(next);
      else {
        segBusySet(false);
        res(true);
      }
    };
    afterPaint(next);
  });
}
function render() {
  // (v318.15: a new photo shown while its sections are found: photoPreview, 20-image-input)
  if (_preview) return;
  _rg = null;
  positionPhoto();
  positionSun();
  if (zoneEl) zoneEl.innerHTML = '';
  if (sfmode === 'review' && popOpen()) closeSwatchPop(false);
  if (!labels) return;
  sizeCanvas();
  const n = W * H,
    mv = minPx(),
    cn = new Uint8Array(comps.length);
  let cnt = 0;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    let ct = false;
    if (c && !c.merged) {
      const s = secState[l];
      ct = s === 1 ? true : s === 2 ? false : !c.bg && c.area >= mv;
    }
    if (ct) {
      cn[l] = 1;
      cnt++;
    }
  }
  // (v313) one colour per section worked out once, then one lookup a pixel: the per-pixel branches took about 0.3 s a
  // redraw on a 2400 x 2400 photo at an iPad's speed, after every tap in Edit sections. Pixel for pixel as before.
  const lut = new Uint32Array(comps.length + 1),
    // (clamped and rounded as a write into rgbOut would be)
    cl = new Uint8ClampedArray(3),
    pack = function (c) {
      cl[0] = c[0];
      cl[1] = c[1];
      cl[2] = c[2];
      return (255 << 24) | (cl[2] << 16) | (cl[1] << 8) | cl[0];
    };
  lut[0] = pack(LINE);
  // (label 0 doesn't survive labelCells; drawn as a left-out section if it ever did, not as nothing)
  lut[1] = pack(MAG);
  for (let l = 1; l < comps.length; l++) {
    let col;
    if (l === mergeSel) col = HILITE;
    else if (cn[l]) {
      // (v288: paler tints, still one per section, so a gap that let two shapes run together shows, without looking
      // like a colour plan)
      const c0 = secColor[l];
      col = [(c0[0] + 357) / 2.4, (c0[1] + 357) / 2.4, (c0[2] + 357) / 2.4];
    } else if (comps[l] && comps[l].bg) col = TEAL;
    else col = MAG;
    lut[l + 1] = pack(col);
  }
  if (LITTLE_END) {
    const out32 = new Uint32Array(rgbOut.buffer, rgbOut.byteOffset, n);
    for (let p = 0; p < n; p++) out32[p] = lut[labels[p] + 1];
  } else
    for (let p = 0, j = 0; p < n; p++, j += 4) {
      const v = lut[labels[p] + 1];
      rgbOut[j] = v & 255;
      rgbOut[j + 1] = (v >>> 8) & 255;
      rgbOut[j + 2] = (v >>> 16) & 255;
      rgbOut[j + 3] = 255;
    }
  ctx.putImageData(imgData, 0, 0);
  const _ct = cnt + ' section' + (cnt === 1 ? '' : 's');
  // (v312.1: after a merge, split, add or leave-out, the new count is said; the count line had been read once only)
  if (_secSayNext) {
    if (countEl.textContent !== _ct) sayLive(_secSayNext + _ct);
    _secSayNext = '';
  }
  countEl.textContent = _ct;
  secQuickN();
  renderTools();
  {
    const bb = document.getElementById('sfBuild');
    if (bb && bb.textContent.indexOf('Building') < 0) bb.disabled = cnt < 2;
  }
  // an edit may have made (or undone) section edits still to be built: the line under the name says so, and the bar
  saveStatus();
  edBarSync();
  frameLineSync();
  outlineMerge();
}
