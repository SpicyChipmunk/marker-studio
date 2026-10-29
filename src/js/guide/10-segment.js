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
// (v318.32) despeckle's labelling of the ink blobs (8-connected), kept for crumbClean so it needn't walk the ink again
// (E1-7): each pixel's blob number (0: paper), each blob's size, box and how much of it lies within EDGE_BAND of each
// edge (left, right, top, bottom). Valid from despeckle to crumbClean, which takes it.
let _inkBlobs = null;
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
    // (v318.32: the blob each pixel is in, in place of a seen flag: crumbClean reads it, _inkBlobs)
    bid = new Int32Array(n),
    bsz = [0],
    bbox = [null],
    bandX = EDGE_BAND * W,
    bandY = EDGE_BAND * H,
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
    tot = 0,
    nb = 0;
  for (let p = 0; p < n; p++) {
    if (L[p] !== -1 || bid[p]) continue;
    nb++;
    let sn = 0,
      bn = 0,
      cnt = 0,
      bx0 = W,
      by0 = H,
      bx1 = -1,
      by1 = -1,
      nL = 0,
      nR = 0,
      nT = 0,
      nB = 0,
      big = false;
    st[sn++] = p;
    bid[p] = nb;
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
      cnt++;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      if (x < bandX) nL++;
      if (x > W - 1 - bandX) nR++;
      if (y < bandY) nT++;
      if (y > H - 1 - bandY) nB++;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const r = yy * W + xx;
          if (L[r] === -1 && !bid[r]) {
            bid[r] = nb;
            st[sn++] = r;
          }
        }
      }
    }
    bsz.push(cnt);
    bbox.push([bx0, by0, bx1, by1, nL, nR, nT, nB]);
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
  _inkBlobs = { bid: bid, sz: bsz, box: bbox };
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
// (v318.32) Crumbs in a cluster of specks. On a photo, a lighting gradient along the page's edge, a crease's shadow, a
// perforated strip or the table at the edge read as many small ink blobs as dark as the lines (so speckClean keeps
// them), and the paper between them as crumbs bigger than Min section size: tiny sections, given markers, drawn in
// clusters along the edge (Ben's photos: purple specks at Sensitivity 7, gone only at 1). A crumb is a section under
// 12 mm² (3 mm² away from the edge's band) closed in only by ink blobs too small to be the drawing's lines (under
// CLUSTER_MM mm² each). The sizes are the page's (mmPx: the picture's long side as a Letter page's), never Min section
// size, which only says what's counted: a hole counted at a hand-set Min is never taken (P1-2).
// Away from the edge's band a crumb must lie between two or more pieces of ink (P1-1): grain is dots that touch at a
// corner, with paper between them; a hole drawn inside one ring, bead, letter or flower is one piece's and stays. (The
// pieces are 4-connected: the ink round any hole is one 8-connected blob, so the blobs can't tell them apart.)
// Crumbs reached from the background through such blobs (a blob touching the background and nothing but crumbs, then
// the crumbs beside it, and so on) become background; the blobs stay as they are (a letter's hole goes white, the
// letter stays). The drawing's own small sections touch its lines and are never crumbs. And the textured band along
// the picture's edge (the page's own edge in shadow, a strip of table or binding the corners took in): one big ink blob
// touching the edge, three quarters of it within EDGE_BAND of it, pocked with EDGE_CRUMBS holes or more, is made
// background with its holes, as the margin's specks are, when its holes are mostly under 3 mm² (lines leave bigger
// cells; the pocks of a photographed edge run from a few pixels to 2 mm²), it's a solid strip (EDGE_INK times as much
// ink as holes, and ink over EDGE_FILL of its box: lace or hatching along the edge is mostly paper, a lace's line long
// and thin, and they keep their ink, P1-5) and it's under EDGE_CAP of the picture. Saved guides keep their sections:
// only a new build or a re-detection does this. A crumb that went keeps its size in c.crumb (segQuality counts the
// small ones; an Undo snapshot carries it, P1-4). The ink blobs are despeckle's (_inkBlobs): the ink isn't walked
// again (E1-7).
const CLUSTER_MM = 40,
  EDGE_BAND = 0.05,
  EDGE_CRUMBS = 20,
  EDGE_SUB = 0.75,
  EDGE_INK = 1.5,
  // (0.3: a photographed edge band, its ink broken by the paper's grain, fills 37–44% of its box on the owner's photos;
  // lace and fine hatching along an edge are kept by the holes' size and the ink-to-holes test in any case)
  EDGE_FILL = 0.3,
  EDGE_CAP = 0.1;
// (v318.32) one mm² on the page, in the picture's pixels: Min section size's own first place, never under MIN_DEF's
// (minPosAuto), from the picture itself rather than srcDims
function mmPx() {
  const pad = Math.round((MIN_MM * Math.max(W, H)) / PAGE_MM);
  return Math.max(minPx(MIN_DEF), pad * pad);
}
// (v318.32) the crumbs crumbClean made paper, under lim pixels when they went (all of them without lim)
function crumbCount(lim) {
  let k = 0;
  if (comps)
    for (let l = 1; l < comps.length; l++) {
      const c = comps[l];
      if (c && c.crumb && (lim == null || c.crumb < lim)) k++;
    }
  return k;
}
function crumbClean() {
  const B = _inkBlobs;
  _inkBlobs = null;
  if (!labels || !comps || !B) return 0;
  const n = W * H,
    mm1 = mmPx(),
    cap = speckCap(CLUSTER_MM),
    small = 12 * mm1,
    tiny = 3 * mm1,
    bid = B.bid,
    bsz = B.sz,
    bbox = B.box;
  // who touches whom (4-neighbours): each section's blobs, each blob's sections (the ink as it is now: the specks
  // speckClean made paper are no blob's)
  const secB = new Map(),
    bSec = new Map(),
    link = function (l, b) {
      let a = secB.get(l);
      if (!a) secB.set(l, (a = new Set()));
      a.add(b);
      let c = bSec.get(b);
      if (!c) bSec.set(b, (c = new Set()));
      c.add(l);
    };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (labels[i] !== -1) continue;
      const b = bid[i];
      if (x > 0 && labels[i - 1] > 0) link(labels[i - 1], b);
      if (x < W - 1 && labels[i + 1] > 0) link(labels[i + 1], b);
      if (y > 0 && labels[i - W] > 0) link(labels[i - W], b);
      if (y < H - 1 && labels[i + W] > 0) link(labels[i + W], b);
    }
  if (!bSec.size) return 0;
  // the edge's textured band: a blob along one edge, shallow, pocked with holes under 3 mm², a solid strip
  const edgeB = new Set(),
    inkCap = EDGE_CAP * n;
  for (const [b, ls] of bSec) {
    const q = bbox[b],
      m = 0.75 * bsz[b];
    if (bsz[b] > inkCap) continue;
    const along =
      (q[0] === 0 && q[4] >= m) ||
      (q[2] === W - 1 && q[5] >= m) ||
      (q[1] === 0 && q[6] >= m) ||
      (q[3] === H - 1 && q[7] >= m);
    if (!along) continue;
    let k = 0,
      kb = 0,
      holes = 0;
    for (const l of ls) {
      const c = comps[l];
      if (!c || c.bg || c.merged) continue;
      holes += c.area;
      if (c.area < tiny) k++;
      else kb++;
    }
    if (
      k >= EDGE_CRUMBS &&
      k >= EDGE_SUB * (k + kb) &&
      bsz[b] >= EDGE_INK * holes &&
      bsz[b] >= EDGE_FILL * (q[2] - q[0] + 1) * (q[3] - q[1] + 1)
    )
      edgeB.add(b);
  }
  const isBg = function (l) {
      const c = comps[l];
      return !!(c && c.bg);
    },
    loose = function (b) {
      return bsz[b] < cap || edgeB.has(b);
    };
  // the pieces of ink (4-connected) round a crumb away from the edge, numbered as they're met: two or more, and the
  // crumb lies between dots (a piece is walked once; the walk stays inside one loose blob, so it's short)
  let pid = null,
    np = 0;
  const pst = [],
    piece = function (r) {
      const id = ++np;
      pid[r] = id;
      pst.push(r);
      while (pst.length) {
        const q = pst.pop(),
          qx = q % W,
          qy = (q / W) | 0;
        if (qx > 0 && labels[q - 1] === -1 && !pid[q - 1]) {
          pid[q - 1] = id;
          pst.push(q - 1);
        }
        if (qx < W - 1 && labels[q + 1] === -1 && !pid[q + 1]) {
          pid[q + 1] = id;
          pst.push(q + 1);
        }
        if (qy > 0 && labels[q - W] === -1 && !pid[q - W]) {
          pid[q - W] = id;
          pst.push(q - W);
        }
        if (qy < H - 1 && labels[q + W] === -1 && !pid[q + W]) {
          pid[q + W] = id;
          pst.push(q + W);
        }
      }
      return id;
    },
    pieces = function (c, l) {
      if (!pid) pid = new Int32Array(n);
      const seen = new Set();
      for (let y = c.y0; y <= c.y1 && seen.size < 2; y++)
        for (let x = c.x0; x <= c.x1 && seen.size < 2; x++) {
          const i = y * W + x;
          if (labels[i] !== l) continue;
          if (x > 0 && labels[i - 1] === -1) seen.add(pid[i - 1] || piece(i - 1));
          if (x < W - 1 && labels[i + 1] === -1) seen.add(pid[i + 1] || piece(i + 1));
          if (y > 0 && labels[i - W] === -1) seen.add(pid[i - W] || piece(i - W));
          if (y < H - 1 && labels[i + W] === -1) seen.add(pid[i + W] || piece(i + W));
        }
      return seen.size;
    },
    crumbTest = function (l) {
      const c = comps[l];
      if (!c || c.bg || c.merged || c.area >= small) return false;
      const bs = secB.get(l);
      if (!bs) return false;
      let edge = false;
      for (const b of bs) {
        if (!loose(b)) return false;
        if (edgeB.has(b)) edge = true;
      }
      if (edge) return true;
      // away from the edge's band: under 3 mm² (a small heart drawn on its own, at 400 px, is a section of about 4 and
      // stays) and between two or more pieces of ink
      return c.area < tiny && pieces(c, l) >= 2;
    },
    crumbMemo = new Map(),
    crumb = function (l) {
      let r = crumbMemo.get(l);
      if (r === undefined) crumbMemo.set(l, (r = crumbTest(l)));
      return r;
    };
  // from the background inwards: a small blob whose sections are all background or crumbs, touching the background or a
  // crumb already reached; then the crumbs beside it whose blobs are all such blobs
  const okB = new Map(),
    goneTo = new Map();
  let grew = true;
  for (let pass = 0; grew && pass < 12; pass++) {
    grew = false;
    for (const [b, ls] of bSec) {
      if (okB.has(b) || !loose(b)) continue;
      let to = 0,
        fine = true;
      for (const l of ls) {
        if (isBg(l)) {
          if (!to) to = l;
        } else if (goneTo.has(l)) {
          if (!to) to = goneTo.get(l);
        } else if (!crumb(l)) {
          fine = false;
          break;
        }
      }
      if (fine && to) {
        okB.set(b, to);
        grew = true;
      }
    }
    for (const [b, to] of okB)
      for (const l of bSec.get(b)) {
        if (isBg(l) || goneTo.has(l) || !crumb(l)) continue;
        let all = true;
        for (const b2 of secB.get(l))
          if (!okB.has(b2)) {
            all = false;
            break;
          }
        if (all) {
          goneTo.set(l, to);
          grew = true;
        }
      }
  }
  let inkGone = 0;
  for (const b of edgeB) if (okB.has(b)) inkGone += bsz[b];
  if (!goneTo.size && !inkGone) return 0;
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0 && goneTo.has(l)) labels[i] = goneTo.get(l);
    else if (l === -1 && edgeB.has(bid[i]) && okB.has(bid[i])) {
      const to = okB.get(bid[i]);
      labels[i] = to;
      comps[to].area++;
    }
  }
  goneTo.forEach(function (to, l) {
    const c = comps[l];
    comps[to].area += c.area;
    c.crumb = c.area;
    c.area = 0;
    c.bg = true;
    c.merged = true;
    c.into = to;
  });
  return goneTo.size;
}
/* ---- (v318.35) hatching as one section (Fable E1-2; plan Stage 4.3) ----
   Hatching or shading drawn as close parallel lines (and cross-hatching) left every gap between its lines a section
   of its own: the zentangle page of the guide benchmark counted 1,594 "hatch slivers" at 1200 px, and the app's only
   answer was the "hatched" warning (raise Min section size, which loses real small cells too). hatchMerge, a step of
   its own after crumbClean, merges each hatched patch into one section, its ink lines kept as drawn, while a striped
   motif meant to be coloured stripe by stripe keeps its stripes. A section is a sliver when it's elongated (its minor
   axis, from its second moments, under HATCH_MM on the page, taking the picture as a Letter page as Min section size
   does, and HATCH_ASPECT times shorter than its length), or a cell when both its axes are that small (cross-hatching
   leaves near-square cells). Slivers are neighbours when a probe across one of them along its normal, through a run
   of ink no longer than HATCH_LINE times the thinner one's own lines (the hatched patch's outline is thicker than its
   hatching), reaches the other, and they run within HATCH_ANGLE degrees of each other; cells, probed in eight
   directions, are neighbours of cells (never of slivers: a cross-hatched patch beside a hatched one stays its own).
   A connected group of HATCH_GROUP or more merges when its spacing is regular (HATCH_EVEN: most of its members' widths
   within that share of the median) and its gaps are at most HATCH_LW of its own line widths wide (hairlines far apart
   are stripes, not shading). The widths were measured on the benchmark's zentangle pages at 400-2400 px: hatching
   0.5-1.3 mm wide, cross-hatch cells 1.2 mm, its wavy stripes meant to be coloured 1.7-2.0 mm, a pattern fill's
   cells 3 mm and more; the gap-to-line ratio alone didn't separate them (hatching 1.7-5.7, the stripes 2.5-3.7). */
const HATCH_MM = 1.5,
  HATCH_ASPECT = 4,
  HATCH_CELL = 1.8,
  HATCH_SIDES = 3,
  HATCH_GROUP = 6,
  HATCH_ANGLE = 15,
  HATCH_LINE = 1.6,
  HATCH_LINK = 1.3,
  HATCH_STEP = 1.15,
  HATCH_LW = 6,
  HATCH_EVEN = 0.4;
// (the hatched patches merged by the last detection, for Edit sections' line and the softened warning; a section made
// this way has c.hatch, the number of slivers in it, and each sliver merged away c.merged, c.into and c.hatched)
let hatchMade = 0;
// (v319) how many patches the last detection would have merged with Treat hatching as one section off (hatchMerge
// dry, once, in segHatch): segQuality's 'hatched' test had run the dry merge on every call, a 0.4 s stall on a
// closely hatched 2400 px page at each Min section size release and each Undo (Y1-6). Kept with hatchMade in Undo
let hatchWould = 0;
// (v318.35) a photo kept as photographed (pgHint, 22-straighten: a camera photo the finder left as it was, Keep as is
// on its outline, or Undo of a straightening): the page's scale in it isn't known, and a pattern fill's cells, 3 mm
// and more on the page, had come under the cap at the far end of a tilted page and merged (the benchmark's zentangle
// photo as taken: 95 merged sections became 292). Such a photo keeps its slivers, and the "hatched" warning, until
// the page is straightened. (A photo without a lens in its file that the finder sees no page in gets no hint, as it
// gets no Straighten offer, and is taken for a page as it is: its hatching merges at the picture's scale.)
// (v318.37: a camera photo only, pgF35: Keep as is on the unsure outline of a scan or a download, a drawn frame or
// grid the finder took for a page, had left it 'kept' too, and the switch a silent no-op on it, X1-2. The note on
// Edit sections says when the merge waits, hatchNoteText)
function hatchUnsure() {
  return pgHint === 'kept' && !pgQ && pgF35 > 0;
}
// (v318.37: dry, how many patches it would merge, the sections left as they are: segQuality asks before it calls a
// page noisy, X1-5)
function hatchMerge(dry) {
  if (!dry) hatchMade = 0;
  if (!labels || !comps) return 0;
  if (hatchUnsure()) return 0;
  const n = W * H,
    N = comps.length,
    // (one mm in pixels: the picture as a Letter page, as Min section size takes it)
    mmpx = Math.max(W, H) / PAGE_MM,
    capW = Math.max(3, HATCH_MM * mmpx),
    runCap = Math.max(3, Math.round(mmpx));
  // the second moments of every section (one pass; the centre is known from labelFill)
  const sxx = new Float64Array(N),
    syy = new Float64Array(N),
    sxy = new Float64Array(N),
    cxs = new Float64Array(N),
    cys = new Float64Array(N);
  for (let l = 1; l < N; l++)
    if (comps[l]) {
      cxs[l] = comps[l].cx;
      cys[l] = comps[l].cy;
    }
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const l = labels[i];
      if (l <= 0) continue;
      const dx = x - cxs[l],
        dy = y - cys[l];
      sxx[l] += dx * dx;
      syy[l] += dy * dy;
      sxy[l] += dx * dy;
    }
  // kind: 1 a sliver, 2 a cell; its width (minor axis), length and direction
  const kind = new Uint8Array(N),
    wid = new Float32Array(N),
    len = new Float32Array(N),
    ang = new Float32Array(N);
  let cands = 0;
  for (let l = 1; l < N; l++) {
    const c = comps[l];
    if (!c || c.bg || c.merged || c.area < 2) continue;
    const a = c.area,
      xx = sxx[l] / a,
      yy = syy[l] / a,
      xy = sxy[l] / a,
      tr = xx + yy,
      d = Math.sqrt(Math.max(0, (tr * tr) / 4 - (xx * yy - xy * xy))),
      w = Math.sqrt(12 * Math.max(1 / 12, tr / 2 - d)),
      L = Math.sqrt(12 * Math.max(1 / 12, tr / 2 + d));
    if (w >= capW) continue;
    if (L > HATCH_ASPECT * w) kind[l] = 1;
    else if (L <= HATCH_CELL * w && L < 2 * capW) kind[l] = 2;
    else continue;
    wid[l] = w;
    len[l] = L;
    ang[l] = 0.5 * Math.atan2(2 * xy, xx - yy);
    cands++;
  }
  if (cands < HATCH_GROUP) return 0;
  // the probes: from a point inside l, step by (dx, dy) out of it and through ink to the next section; the run of
  // ink crossed and the section reached (0: nothing within runCap, or paper that is background)
  const lwSum = new Float32Array(N),
    lwN = new Uint16Array(N),
    edges = new Map(),
    probe = function (l, x0, y0, dx, dy) {
      let x = x0,
        y = y0,
        inside = true,
        run = 0;
      for (let t = 0; t < 4 * capW + runCap + 2; t++) {
        x += dx;
        y += dy;
        const px = Math.round(x),
          py = Math.round(y);
        if (px < 0 || py < 0 || px >= W || py >= H) return;
        const v = labels[py * W + px];
        if (inside) {
          if (v === l) continue;
          inside = false;
        }
        if (v === -1) {
          if (++run > runCap) return;
          continue;
        }
        if (v === l) continue;
        if (!run || v <= 0 || !comps[v] || comps[v].bg || comps[v].merged) return;
        lwSum[l] += run;
        lwN[l]++;
        if (kind[v] && kind[v] === kind[l]) {
          const k = l < v ? l * N + v : v * N + l,
            was = edges.get(k);
          if (was === undefined || run < was) edges.set(k, run);
        }
        return;
      }
    };
  for (let l = 1; l < N; l++) {
    if (!kind[l]) continue;
    const c = comps[l];
    if (kind[l] === 1) {
      const ux = Math.cos(ang[l]),
        uy = Math.sin(ang[l]),
        h = len[l] / 2;
      for (let f = -0.6; f <= 0.61; f += 0.3) {
        const x = c.cx + f * h * ux,
          y = c.cy + f * h * uy,
          px = Math.round(x),
          py = Math.round(y);
        if (px < 0 || py < 0 || px >= W || py >= H || labels[py * W + px] !== l) continue;
        probe(l, x, y, -uy, ux);
        probe(l, x, y, uy, -ux);
      }
    } else {
      const px = Math.round(c.cx),
        py = Math.round(c.cy);
      if (labels[py * W + px] !== l) continue;
      for (let k = 0; k < 8; k++) {
        const t = (k * Math.PI) / 4;
        probe(l, c.cx, c.cy, Math.cos(t), Math.sin(t));
      }
    }
  }
  if (!edges.size) return 0;
  // each member's own line width: the mean run of ink its probes crossed
  const lw = new Float32Array(N);
  for (let l = 1; l < N; l++) if (lwN[l]) lw[l] = lwSum[l] / lwN[l];
  // the links: slivers side by side across one line, running the same way; with the run of ink crossed and the step
  // between the two (centre to centre for cells; across the slivers, along their normal)
  const lim = (HATCH_ANGLE * Math.PI) / 180,
    links = [];
  edges.forEach(function (run, k) {
    const a = (k / N) | 0,
      b = k % N;
    if (run > HATCH_LINE * Math.min(lw[a], lw[b]) + 0.5) return;
    const A = comps[a],
      B = comps[b];
    let step;
    if (kind[a] === 1) {
      // (directions are modulo a half turn)
      let dd = Math.abs(ang[a] - ang[b]) % Math.PI;
      if (dd > Math.PI / 2) dd = Math.PI - dd;
      if (dd > lim) return;
      step = Math.abs(-(B.cx - A.cx) * Math.sin(ang[a]) + (B.cy - A.cy) * Math.cos(ang[a]));
    } else step = Math.hypot(B.cx - A.cx, B.cy - A.cy);
    links.push([a, b, run, step]);
  });
  // the groups, twice: all the links first, for each patch's own line and spacing (their medians); then only the
  // links no thicker or farther than those, so a patch doesn't take the one beside it across its outline (two
  // cross-hatched cells of a circle and the shape round it, hatched alike, had joined across the circle's line)
  const par = new Int32Array(N),
    find = function (l) {
      while (par[l] !== l) l = par[l] = par[par[l]];
      return l;
    },
    med = function (arr) {
      const s = arr.slice().sort(function (a, b) {
        return a - b;
      });
      return s[s.length >> 1];
    };
  for (let l = 0; l < N; l++) par[l] = l;
  links.forEach(function (e) {
    const ra = find(e[0]),
      rb = find(e[1]);
    if (ra !== rb) par[ra] = rb;
  });
  const runsOf = new Map(),
    stepsOf = new Map();
  links.forEach(function (e) {
    const r = find(e[0]);
    let a = runsOf.get(r);
    if (!a) {
      runsOf.set(r, (a = []));
      stepsOf.set(r, []);
    }
    a.push(e[2]);
    stepsOf.get(r).push(e[3]);
  });
  const runCapOf = new Map(),
    stepCapOf = new Map();
  runsOf.forEach(function (runs, r) {
    runCapOf.set(r, HATCH_LINK * med(runs) + 0.5);
    stepCapOf.set(r, HATCH_STEP * med(stepsOf.get(r)) + 0.5);
  });
  const root1 = new Int32Array(N);
  for (let l = 1; l < N; l++) if (kind[l]) root1[l] = find(l);
  for (let l = 0; l < N; l++) par[l] = l;
  const deg = new Uint8Array(N);
  links.forEach(function (e) {
    const r = root1[e[0]];
    if (e[2] > runCapOf.get(r) || e[3] > stepCapOf.get(r)) return;
    if (deg[e[0]] < 255) deg[e[0]]++;
    if (deg[e[1]] < 255) deg[e[1]]++;
    const ra = find(e[0]),
      rb = find(e[1]);
    if (ra !== rb) par[ra] = rb;
  });
  // (a cell of cross-hatching has cells on three or four sides; one with fewer is a corner, or a scrap of paper at
  // a junction outside the patch that reached in across its outline: left as it is)
  const groups = new Map();
  for (let l = 1; l < N; l++) {
    if (!kind[l] || (kind[l] === 2 && deg[l] < HATCH_SIDES)) continue;
    const r = find(l);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(l);
  }
  const goneTo = new Int32Array(N);
  let made = 0;
  groups.forEach(function (g) {
    if (g.length < HATCH_GROUP) return;
    const ws = g.map(function (l) {
        return wid[l];
      }),
      mw = med(ws),
      lws = g
        .map(function (l) {
          return lw[l];
        })
        .filter(function (v) {
          return v > 0;
        });
    // (regular spacing: a member wider or narrower than the rest by more than HATCH_EVEN of the median is left out,
    // a scrap of paper at a junction on the patch's edge among them)
    // (and cells are all of a size: their length too, as a clipped cell on the patch's edge isn't)
    const ml =
      kind[g[0]] === 2
        ? med(
            g.map(function (l) {
              return len[l];
            }),
          )
        : 0;
    g = g.filter(function (l) {
      return Math.abs(wid[l] - mw) <= HATCH_EVEN * mw && (!ml || Math.abs(len[l] - ml) <= HATCH_EVEN * ml);
    });
    if (g.length < HATCH_GROUP) return;
    if (!lws.length || mw > HATCH_LW * med(lws)) return;
    made++;
    if (dry) return;
    // into the biggest of them
    let to = g[0];
    for (let i = 1; i < g.length; i++) if (comps[g[i]].area > comps[to].area) to = g[i];
    const A = comps[to];
    let area = A.area,
      sx = A.cx * A.area,
      sy = A.cy * A.area;
    for (let i = 0; i < g.length; i++) {
      const l = g[i];
      if (l === to) continue;
      const B = comps[l];
      goneTo[l] = to;
      area += B.area;
      sx += B.cx * B.area;
      sy += B.cy * B.area;
      A.bpx = (A.bpx || 0) + (B.bpx || 0);
      A.x0 = Math.min(A.x0, B.x0);
      A.y0 = Math.min(A.y0, B.y0);
      A.x1 = Math.max(A.x1, B.x1);
      A.y1 = Math.max(A.y1, B.y1);
      B.merged = true;
      B.hatched = true;
      B.into = to;
      B.area = 0;
    }
    A.area = area;
    A.cx = sx / area;
    A.cy = sy / area;
    A.h = A.y1 - A.y0;
    A.hatch = g.length;
  });
  if (!made || dry) return made;
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0 && goneTo[l]) labels[i] = goneTo[l];
  }
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  hatchMade = made;
  return made;
}
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
  // (v325: on a photo-made page nothing is background: the whole photo is the picture, 47-photo-page; v326: but
  // Subject only's, pp.bgs)
  if (ppOn()) {
    bgEdgeAll = true;
    const bs = {};
    if (pp.bgs)
      pp.bgs.forEach(function (l) {
        bs[l] = 1;
      });
    for (let l = 1; l < comps.length; l++) if (comps[l]) comps[l].bg = !!bs[l];
    return;
  }
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
// (v318.35) Each pixel's colour: max - min of its RGB once the paper's tint is taken out (paperGains, as colourShare),
// 0-255. For a picture with colour on it (its colourShare over COLOUR_PAGE: a page with a few sections coloured in is
// 1-3%, a clean page well under 1%); null otherwise, so a greyscale page's sections are found exactly as before. The
// ink reads it (inkDone): a mid or dark marker fill is darker than the paper, so on the grey alone it was ink and the
// section vanished (E1-3); and the offer to mark the coloured sections done counts it (colourSecs).
const COLOUR_PAGE = 0.01,
  // (a pixel this dark stays ink whatever its colour: a line's pixel beside a fill, the fill's colour smeared onto it
  // by a JPEG, had cut the line and let the fill leak into the next section)
  INK_DARK = 48;
function chromaOf(d, n, share) {
  if (!d || !n || !(share > COLOUR_PAGE)) return null;
  const st = Math.max(1, Math.floor(n / 250000)),
    k = paperGains(d, n, st) || [1, 1, 1],
    out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4,
      r = Math.min(255, d[j] * k[0]),
      g = Math.min(255, d[j + 1] * k[1]),
      b = Math.min(255, d[j + 2] * k[2]);
    out[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return out;
}
// (v318.35) The sections coloured in already: those in the guide (countedList) over COLOUR_SEC of whose pixels are
// clearly coloured (chroma over COLOUR_CHROMA), as a list of section numbers; [] for a page without colour. Read from
// the sections as they are, so merges and splits since count their own pixels. Offered as done after Build, never
// marked so by itself (30-palette-assign colourOffer).
const COLOUR_SEC = 0.5;
function colourSecs() {
  if (!chroma || !labels || !comps || chroma.length !== labels.length) return [];
  const n = labels.length,
    cnt = new Uint32Array(comps.length),
    tot = new Uint32Array(comps.length);
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l <= 0) continue;
    tot[l]++;
    if (chroma[i] > COLOUR_CHROMA) cnt[l]++;
  }
  const out = [];
  countedList().forEach(function (l) {
    if (tot[l] && cnt[l] >= COLOUR_SEC * tot[l]) out.push(l);
  });
  return out;
}
/* ---- (v327.2) the sections coloured in, read against the paper ----
    colourSecs counts a section only when half its pixels are clearly coloured (chroma over COLOUR_CHROMA, 60): on a
    real part-coloured page (the author's, 405 sections, 97 coloured) it found 63, missing the pastels, peaches and
    pale blues. paperSecsOf reads the picture's own colours (RGBA d, W x H, as the sections were found from it: srcRGBA,
    20-image-input) against the paper's colour where each section is: a smooth surface (PAPER_TERMS, a cubic in x and
    y, CIELAB) fitted to cells of the page's paper again and again, each time without the pixels far from it (the
    colour drops out of the fit, the light across the page stays in it). A section is coloured when over half its
    middle (PAPER_IN px in from its lines; the whole of a section too thin for that) is coloured or a darker grey than
    the paper there: its colour (a*, b*) PAPER_AB or more from the paper's, or PAPER_DARK or more darker. Lighter than
    the paper is never a marker. Measured (scratchpad cs/): the real page, 95 of its 97 and nothing blank; the author's
    blank photo, nothing; a fully coloured photo, 334 of 338 sections and nothing blank; those with the light falling
    away across the page or a shadow over a quarter of it (a quarter to 30% darker), no more than one blank section
    called coloured (on the colour alone with the lightness too, 13-46; with PAPER_DARK at 15, a shadow's middle, 2).
    Pale greys (lightness only, under PAPER_DARK) aren't counted, as colourSecs never counted them: a shadow looks
    the same. Offered only, with colourSecs' (82-colour-mode colourOffer). */
const PAPER_AB = 5,
  PAPER_DARK = 20,
  // (the fit: cells about 1/150 of the picture's long side, sampled every st-th pixel; a cell counts with a tenth of
  // its samples near the paper; passes after the first keep what's within PAPER_NEAR of the surface)
  PAPER_CELLS = 150,
  PAPER_NEAR = 8,
  PAPER_IN = 2,
  PAPER_TERMS = 10,
  // (v328: the growing, and how far apart across a line two sections may be, of the picture's long side)
  PAPER_GROW_AB = 3.5,
  PAPER_GROW_L = 6,
  PAPER_GAP = 0.012,
  // (v328 review: on a page with no clear colour, a section coloured has most of its middle's pixels this far off the
  // paper's tint line, colour only: paperSecsOf)
  PAPER_AB_PX = 3,
  // (the growing's seeds: within PAPER_AB of the paper in a*, and in b* towards yellow, and PAPER_SEED more a unit of
  // L* darker; towards blue, as a shadow goes, PAPER_SEED_L more. Measured: the author's 9 photos as before the
  // review, 1-9 blank sections offered, and pale fills kept as the surface alone reads them: an 8 x 8 block of pink 52
  // of 64, a 6 x 6 of pale blue 14 of 36; any section read as paper a seed, those went to 0)
  PAPER_SEED = 0.3,
  PAPER_SEED_L = 1;
// sRGB to CIELAB (D65), looked up at 6 bits a channel (under 1 ΔE off; a 4-megapixel page read in a tenth of the time
// of working each pixel out): 64^3 colours, L* a* b* each, made the first time it's needed
let _labLut = null;
function labLut() {
  if (_labLut) return _labLut;
  const lin = new Float32Array(64);
  for (let i = 0; i < 64; i++) {
    const c = (i * 4 + 2) / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  const f = function (t) {
      return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    },
    o = new Float32Array(64 * 64 * 64 * 3);
  for (let r = 0; r < 64; r++)
    for (let g = 0; g < 64; g++)
      for (let b = 0; b < 64; b++) {
        const R = lin[r],
          G = lin[g],
          B = lin[b],
          fx = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047),
          fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722),
          fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883),
          k = ((r << 12) | (g << 6) | b) * 3;
        o[k] = 116 * fy - 16;
        o[k + 1] = 500 * (fx - fy);
        o[k + 2] = 200 * (fy - fz);
      }
  return (_labLut = o);
}
// the look-up's index for pixel i of RGBA d
function labAt(d, i) {
  return (((d[i * 4] >> 2) << 12) | ((d[i * 4 + 1] >> 2) << 6) | (d[i * 4 + 2] >> 2)) * 3;
}
function paperBasis(x, y, o) {
  o[0] = 1;
  o[1] = x;
  o[2] = y;
  o[3] = x * x;
  o[4] = x * y;
  o[5] = y * y;
  o[6] = x * x * x;
  o[7] = y * y * y;
  o[8] = x * x * y;
  o[9] = x * y * y;
}
// A x = b (A n x n, row-major, overwritten), by elimination with partial pivoting; null when it's singular
function solveSmall(A, b, n) {
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
    if (!(Math.abs(A[p * n + c]) > 1e-12)) return null;
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        const t = A[c * n + k];
        A[c * n + k] = A[p * n + k];
        A[p * n + k] = t;
      }
      const t = b[c];
      b[c] = b[p];
      b[p] = t;
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / A[c * n + c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    x[r] = s / A[r * n + r];
  }
  return x;
}
// (grow false: without the growing below, as v327.2 read; for the tests. abOnly: coloured by a*b* only, not by being
// PAPER_DARK darker, for a page with no clear colour; colourOffer, 82-colour-mode, reads it in the JOBS worker)
// (v328) the paper's colour across the page, as a surface fitted to its sections' paper (paperSecsOf, and Tick off
// from a photo's plain-paper test, 26-tick): { S: CIELAB per cell, G: a cell's side, gw, gh } or null
function paperSurf(d, labels, W, H) {
  const n = W * H,
    G = Math.max(8, Math.round(Math.max(W, H) / PAPER_CELLS)),
    gw = Math.ceil(W / G),
    gh = Math.ceil(H / G),
    nc = gw * gh,
    st = Math.max(1, Math.round(Math.sqrt(n / 500000))),
    // the samples: every st-th pixel each way that's in a section (or the paper round the picture), its CIELAB and
    // cell
    sx = Math.ceil(W / st),
    sy = Math.ceil(H / st),
    lab = new Float32Array(sx * sy * 3),
    cell = new Int32Array(sx * sy),
    LUT = labLut();
  let m = 0;
  for (let y = 0; y < H; y += st)
    for (let x = 0; x < W; x += st) {
      const i = y * W + x;
      if (labels[i] <= 0) continue;
      const q = labAt(d, i);
      lab[m * 3] = LUT[q];
      lab[m * 3 + 1] = LUT[q + 1];
      lab[m * 3 + 2] = LUT[q + 2];
      cell[m++] = ((y / G) | 0) * gw + ((x / G) | 0);
    }
  if (m < 100) return null;
  // the paper to start from: the mean of the lightest 5% of the samples
  const hs = new Uint32Array(401);
  for (let k = 0; k < m; k++) hs[Math.max(0, Math.min(400, Math.round(lab[k * 3] * 4)))]++;
  let t = 400,
    acc = 0;
  while (t > 0 && acc + hs[t] < m * 0.05) acc += hs[t--];
  const p0 = [0, 0, 0];
  let c0 = 0;
  for (let k = 0; k < m; k++)
    if (lab[k * 3] * 4 >= t - 0.5) {
      p0[0] += lab[k * 3];
      p0[1] += lab[k * 3 + 1];
      p0[2] += lab[k * 3 + 2];
      c0++;
    }
  for (let c = 0; c < 3; c++) p0[c] /= c0 || 1;
  // the surface, one CIELAB colour per cell; the passes: the first loose (the light across the page can be far from
  // the lightest paper), then near
  const S = new Float32Array(nc * 3),
    cnt = new Float64Array(nc),
    sum = new Float64Array(nc * 3),
    bs = new Float64Array(PAPER_TERMS),
    cellMin = Math.max(4, 0.1 * (G / st) * (G / st));
  for (let c = 0; c < nc; c++) S.set(p0, c * 3);
  [50, PAPER_NEAR, PAPER_NEAR, PAPER_NEAR, PAPER_NEAR].forEach(function (near) {
    cnt.fill(0);
    sum.fill(0);
    for (let k = 0; k < m; k++) {
      const L = lab[k * 3];
      if (L <= 50) continue;
      const c = cell[k],
        dL = L - S[c * 3],
        da = lab[k * 3 + 1] - S[c * 3 + 1],
        db = lab[k * 3 + 2] - S[c * 3 + 2];
      if (dL * dL + da * da + db * db >= near * near) continue;
      cnt[c]++;
      sum[c * 3] += L;
      sum[c * 3 + 1] += lab[k * 3 + 1];
      sum[c * 3 + 2] += lab[k * 3 + 2];
    }
    // weighted least squares on the cells' means, weighted by their samples
    const A = new Float64Array(PAPER_TERMS * PAPER_TERMS),
      R = [new Float64Array(PAPER_TERMS), new Float64Array(PAPER_TERMS), new Float64Array(PAPER_TERMS)];
    let used = 0;
    for (let c = 0; c < nc; c++) {
      const w = cnt[c];
      if (w < cellMin) continue;
      used++;
      paperBasis(((c % gw) + 0.5) / gw, (((c / gw) | 0) + 0.5) / gh, bs);
      for (let i = 0; i < PAPER_TERMS; i++) {
        for (let j = 0; j < PAPER_TERMS; j++) A[i * PAPER_TERMS + j] += w * bs[i] * bs[j];
        for (let ch = 0; ch < 3; ch++) R[ch][i] += bs[i] * sum[c * 3 + ch];
      }
    }
    // (too little paper to fit: the surface stays as it was)
    if (used < 2 * PAPER_TERMS) return;
    const K = [];
    for (let ch = 0; ch < 3; ch++) {
      const x = solveSmall(A.slice(), R[ch], PAPER_TERMS);
      if (!x) return;
      K.push(x);
    }
    for (let c = 0; c < nc; c++) {
      paperBasis(((c % gw) + 0.5) / gw, (((c / gw) | 0) + 0.5) / gh, bs);
      for (let ch = 0; ch < 3; ch++) {
        let v = 0;
        for (let i = 0; i < PAPER_TERMS; i++) v += K[ch][i] * bs[i];
        S[c * 3 + ch] = v;
      }
    }
  });
  return { S: S, G: G, gw: gw, gh: gh, p0: p0 };
}
function paperSecsOf(d, labels, W, H, nl, list, grow, abOnly) {
  const P = paperSurf(d, labels, W, H);
  if (!P) return [];
  const S = P.S,
    G = P.G,
    gw = P.gw,
    LUT = labLut();
  // each section's pixels, its middle's apart: how many, and how many coloured; and its middle's colour, for the
  // growing below
  const tot = new Uint32Array(nl),
    mL = new Float64Array(nl * 3),
    hit = new Uint32Array(nl),
    inTot = new Uint32Array(nl),
    inHit = new Uint32Array(nl),
    // (abOnly: the surface under each section's middle, averaged)
    sM = abOnly ? new Float64Array(nl * 3) : null,
    // (abOnly: how many of the middle's pixels are off the paper's line themselves, PAPER_AB_PX or more)
    inOff = abOnly ? new Uint32Array(nl) : null,
    r = PAPER_IN;
  for (let y = 0; y < H; y++) {
    const row = ((y / G) | 0) * gw,
      mid = y >= r && y < H - r;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const l = labels[i];
      if (l <= 0 || l >= nl) continue;
      const q = labAt(d, i),
        c = (row + ((x / G) | 0)) * 3,
        da = LUT[q + 1] - S[c + 1],
        db = LUT[q + 2] - S[c + 2],
        on = da * da + db * db >= PAPER_AB * PAPER_AB || (!abOnly && S[c] - LUT[q] >= PAPER_DARK);
      tot[l]++;
      if (on) hit[l]++;
      if (
        mid &&
        x >= r &&
        x < W - r &&
        labels[i - r] === l &&
        labels[i + r] === l &&
        labels[i - r * W] === l &&
        labels[i + r * W] === l
      ) {
        inTot[l]++;
        if (on) inHit[l]++;
        mL[l * 3] += LUT[q];
        mL[l * 3 + 1] += LUT[q + 1];
        mL[l * 3 + 2] += LUT[q + 2];
        if (sM) {
          sM[l * 3] += S[c];
          sM[l * 3 + 1] += S[c + 1];
          sM[l * 3 + 2] += S[c + 2];
          const qa = LUT[q + 1],
            qb = LUT[q + 2],
            p2 = S[c + 1] * S[c + 1] + S[c + 2] * S[c + 2],
            u = p2 > 1e-6 ? Math.max(0, Math.min(1, (qa * S[c + 1] + qb * S[c + 2]) / p2)) : 1,
            ea = qa - u * S[c + 1],
            eb = qb - u * S[c + 2];
          if (ea * ea + eb * eb >= PAPER_AB_PX * PAPER_AB_PX) inOff[l]++;
        }
      }
    }
  }
  const out = [],
    isOn = new Uint8Array(nl),
    seen = new Uint8Array(nl);
  list.forEach(function (l) {
    const a = inTot[l] >= 20 ? inTot[l] : tot[l],
      h = inTot[l] >= 20 ? inHit[l] : hit[l];
    if (a < 20) return;
    seen[l] = 1;
    if (!sM) {
      if (h * 2 > a) isOn[l] = 1;
      return;
    }
    // (v328 review, abOnly: a page with no clear colour. By the section's middle averaged, so a photo's grain
    // averages out; and against the line from no tint to the paper's own in a*b*, where a printed grey falls under any
    // light, its cast fainter than the paper's the darker it is: a lamp's warm cast had made the greys read as
    // coloured. A marker's colour is off that line, or along it further than the paper)
    const k = inTot[l];
    if (k < 20) return;
    const pa = sM[l * 3 + 1] / k,
      pb = sM[l * 3 + 2] / k,
      va = mL[l * 3 + 1] / k,
      vb = mL[l * 3 + 2] / k,
      pp = pa * pa + pb * pb,
      tt = pp > 1e-6 ? Math.max(0, Math.min(1, (va * pa + vb * pb) / pp)) : 1,
      da = va - tt * pa,
      db = vb - tt * pb;
    // (and most of the middle off the line itself: a small strong patch, an eye coloured in a face, moves the
    // average but isn't the section coloured)
    if (da * da + db * db >= PAPER_AB * PAPER_AB && inOff[l] * 2 > k) isOn[l] = 1;
  });
  // (v328, P2) A soft shadow: the surface can't follow it, and its sections read as coloured (on the author's photos,
  // 28-67 blank sections offered in the four with soft shadows). The paper is grown from section to neighbouring
  // section across the lines instead: a section next to one that's paper, of nearly its colour (PAPER_GROW_AB in
  // a*b*, PAPER_GROW_L in L*, each section's middle averaged), is paper too, however far it is from the surface; a
  // shadow darkens step by step and is crossed, a marker's fill is a jump and isn't.
  const mid = new Float64Array(nl * 3);
  for (let l = 1; l < nl; l++)
    if (inTot[l]) for (let c = 0; c < 3; c++) mid[l * 3 + c] = mL[l * 3 + c] / inTot[l];
  const front = [],
    vis = new Uint8Array(nl),
    p0 = P.p0;
  // (the seeds: sections read as paper whose middle is the paper's own colour, or a darker grey of it, as a shadow is.
  // Not every section read as paper: on a big pale fill the surface bends to the fill's colour, its middle sections
  // read as paper, and grown from them the whole fill went back to paper: an 8 x 8 block of pink, 52 sections, to 0)
  if (grow !== false)
    for (let l = 1; l < nl; l++) {
      if (!seen[l] || isOn[l] || !inTot[l]) continue;
      const da = mid[l * 3 + 1] - p0[1],
        db = mid[l * 3 + 2] - p0[2],
        dl = Math.max(0, p0[0] - mid[l * 3]),
        lim = PAPER_AB + PAPER_SEED * dl;
      // (darker and bluer, as a shadow is, allowed further: PAPER_SEED_L)
      if (Math.abs(da) < lim && db < lim && db > -(PAPER_AB + PAPER_SEED_L * dl)) {
        front.push(l);
        vis[l] = 1;
      }
    }
  // (the neighbours only when there's something to grow from)
  const nb = front.length
    ? secNeighbours(labels, W, H, nl, Math.max(6, Math.round(Math.max(W, H) * PAPER_GAP)))
    : null;
  while (front.length) {
    const p = front.pop(),
      ns = nb[p];
    if (!ns) continue;
    for (let k = 0; k < ns.length; k++) {
      const q = ns[k];
      // (through sections read as paper too, not only into those read as coloured)
      if (vis[q] || !seen[q] || !inTot[q]) continue;
      const da = mid[q * 3 + 1] - mid[p * 3 + 1],
        db = mid[q * 3 + 2] - mid[p * 3 + 2];
      if (
        da * da + db * db < PAPER_GROW_AB * PAPER_GROW_AB &&
        Math.abs(mid[q * 3] - mid[p * 3]) < PAPER_GROW_L
      ) {
        isOn[q] = 0;
        vis[q] = 1;
        front.push(q);
      }
    }
  }
  list.forEach(function (l) {
    if (isOn[l]) out.push(l);
  });
  return out;
}
// the sections side by side across a line (no more than gap px of it between them, along a row or a column): for each
// section, the list of its neighbours
function secNeighbours(labels, W, H, nl, gap) {
  const seen = new Set(),
    nb = new Array(nl);
  const pair = function (a, b) {
    if (a === b) return;
    const k = a < b ? a * nl + b : b * nl + a;
    if (seen.has(k)) return;
    seen.add(k);
    (nb[a] || (nb[a] = [])).push(b);
    (nb[b] || (nb[b] = [])).push(a);
  };
  for (let y = 0; y < H; y++) {
    let last = 0,
      at = -1e9;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const l = labels[i];
      if (l > 0 && l < nl) {
        if (last && l !== last && x - at <= gap) pair(last, l);
        last = l;
        at = x;
      }
    }
  }
  for (let x = 0; x < W; x++) {
    let last = 0,
      at = -1e9;
    for (let y = 0, i = x; y < H; y++, i += W) {
      const l = labels[i];
      if (l > 0 && l < nl) {
        if (last && l !== last && y - at <= gap) pair(last, l);
        last = l;
        at = y;
      }
    }
  }
  return nb;
}
/* ---- (v328, P1 and P6) a spiral binding, found by its sections ----
    A sketchbook page photographed with its spiral binding: the loops are sections, which the guide and the print
    then have, and every reading of the page took some of them for coloured in (on the author's glass table, 14-22 of
    them). edgeBandsOf (20-image-input) finds a binding as dark bands along an edge, but on the glass table the loops
    are separated by paper and the table shows through: it found 3 of the author's 9 photos. spiralOf reads the
    sections instead: a row of SPIRAL_MIN or more small sections (no more than SPIRAL_AREA of the picture each), their
    middles within SPIRAL_EDGE of one edge and in a line (within SPIRAL_LINE of the row's median), evenly spaced (most
    gaps within 35% of the median gap), alike in size (most within 60% of the median), over SPIRAL_SPAN of the edge.
    Measured: 8 of the 9 photos, and nothing on three test pages without a binding (the
    letter page, a mandala, a mandala on a table). A drawn border of beads read as one, 7% deep: bindingNow
    (20-image-input) takes it only from a photo of a page, and no deeper than 5%. { side: 't' | 'b' | 'l' | 'r', d: how deep from that edge, of the picture, secs: its sections }, or
    null. */
const SPIRAL_MIN = 8,
  SPIRAL_AREA = 0.002,
  SPIRAL_EDGE = 0.08,
  SPIRAL_LINE = 0.015,
  SPIRAL_SPAN = 0.4;
function spiralOf(labels, W, H, nl) {
  if (!labels || labels.length !== W * H || W < 32 || H < 32) return null;
  const n = W * H,
    cnt = new Float64Array(nl),
    sx = new Float64Array(nl),
    sy = new Float64Array(nl),
    x0 = new Int32Array(nl).fill(W),
    y0 = new Int32Array(nl).fill(H),
    x1 = new Int32Array(nl).fill(-1),
    y1 = new Int32Array(nl).fill(-1);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const l = labels[i];
      if (l <= 0 || l >= nl) continue;
      cnt[l]++;
      sx[l] += x;
      sy[l] += y;
      if (x < x0[l]) x0[l] = x;
      if (x > x1[l]) x1[l] = x;
      if (y < y0[l]) y0[l] = y;
      if (y > y1[l]) y1[l] = y;
    }
  // (the least section: 30 px on the author's 1758 x 2149 guide, in proportion)
  const amin = Math.max(8, (30 * n) / 3.78e6),
    amax = SPIRAL_AREA * n,
    med = function (a) {
      const b = a.slice().sort(function (p, q) {
        return p - q;
      });
      return b[b.length >> 1];
    };
  let best = null;
  [
    ['l', W, H],
    ['r', W, H],
    ['t', H, W],
    ['b', H, W],
  ].forEach(function (e) {
    const side = e[0],
      size = e[1],
      len = e[2],
      c = [];
    for (let l = 1; l < nl; l++) {
      if (cnt[l] < amin || cnt[l] > amax) continue;
      const mx = sx[l] / cnt[l],
        my = sy[l] / cnt[l],
        pos = side === 'l' ? mx : side === 'r' ? W - 1 - mx : side === 't' ? my : H - 1 - my;
      if (pos < SPIRAL_EDGE * size) c.push({ l: l, pos: pos, at: side === 'l' || side === 'r' ? my : mx });
    }
    if (c.length < SPIRAL_MIN) return;
    const m = med(
        c.map(function (o) {
          return o.pos;
        }),
      ),
      g = c.filter(function (o) {
        return Math.abs(o.pos - m) < SPIRAL_LINE * size;
      });
    if (g.length < SPIRAL_MIN) return;
    const at = g
        .map(function (o) {
          return o.at;
        })
        .sort(function (p, q) {
          return p - q;
        }),
      gaps = [];
    for (let k = 1; k < at.length; k++) gaps.push(at[k] - at[k - 1]);
    const gm = med(gaps),
      reg =
        gm > 0
          ? gaps.filter(function (v) {
              return Math.abs(v - gm) < 0.35 * gm;
            }).length / gaps.length
          : 0,
      ar = g.map(function (o) {
        return cnt[o.l];
      }),
      am = med(ar),
      alike =
        ar.filter(function (v) {
          return Math.abs(v - am) < 0.6 * am;
        }).length / ar.length,
      span = (at[at.length - 1] - at[0]) / len;
    if (reg < 0.6 || alike < 0.6 || span < SPIRAL_SPAN) return;
    // how deep: the row's sections' far side from the edge, and a little more
    let deep = 0;
    g.forEach(function (o) {
      const l = o.l,
        f = side === 'l' ? x1[l] + 1 : side === 'r' ? W - x0[l] : side === 't' ? y1[l] + 1 : H - y0[l];
      if (f > deep) deep = f;
    });
    if (!best || g.length > best.secs.length)
      best = {
        side: side,
        d: Math.min(SPIRAL_EDGE * 1.5, deep / size + 0.005),
        secs: g.map(function (o) {
          return o.l;
        }),
      };
  });
  return best;
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
  // (v325: a photo-made page's sections are made to be coloured: none of these apply, 47-photo-page)
  if (!labels || !comps || ppOn()) return { ok: true };
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
  // fragments: it says more. (v318.32: the crumbs crumbClean made paper count as specks, those under ref: a page
  // scribbled over to its margins had lost most of them, and its warning, to the clean-up. Read off the sections, so an
  // Undo or a guide opened again counts its own, P1-3/4)
  // (v318.35: softened. A partly coloured page works now: its fills are paper to the ink, and after Build the
  // sections coloured in are offered as done, colourOffer. The page that still gets here is mostly coloured, or
  // coloured in a way that breaks up: it says what works)
  if (srcColour != null && srcColour > 0.15 && specksRef + crumbCount(ref) > 3 * keptRef)
    return {
      ok: false,
      code: 'coloured',
      retake: true,
      msg: 'This page looks coloured in already.',
      tip: 'A partly coloured page works: its coloured sections stay sections, and after Build guide you can mark them done. For a page that\u2019s mostly coloured, use the page before it was coloured, with plain outlines on white.',
    };
  // (v303: only when the fragments are in the guide, not just left out by Min section size: a clean page with a
  // scanner's specks, all left out, had been told it was a photo or textured image)
  // (v318.37: a page cross-hatched closely enough to be mostly tiny cells is hatched, not a photo: it gets the
  // 'hatched' warning below, which names Treat hatching as one section, when the merge made patches of it or, with the
  // switch off, would (hatchMerge dry), X1-5)
  // (v319: the dry merge's answer is the detection's, hatchWould, not run again here)
  const hatchy = kept >= 200 && keptSmall > 0.5 * kept && (hatchMade > 0 || (!hatchOne && hatchWould > 0));
  if (!hatchy && tinyFrac > 0.8 && (kept === 0 || keptTiny > 0.3 * kept)) {
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
  // (v318.35: softer once hatched patches were merged into one section each, hatchMerge: what's left is the hatching
  // it couldn't tell from stripes; with Treat hatching as one section off, the tip names it)
  if (kept >= 200 && keptSmall > 0.5 * kept)
    return hatchMade > 0
      ? {
          ok: false,
          code: 'hatched',
          msg: 'Still lots of slivers — some hatching or shading lines were kept as separate sections.',
          tip: 'Raise Min section size in Edit sections to leave the smallest out, or merge them by hand.',
        }
      : {
          ok: false,
          code: 'hatched',
          msg: 'Lots of slivers — this page looks hatched or shaded with lines.',
          tip:
            'The lines between the hatching become sections. ' +
            (hatchOne
              ? 'Raise Min section size in Edit sections, or use a page with plain outlines.'
              : 'Turn on Treat hatching as one section or raise Min section size in Edit sections, or use a page with plain outlines.'),
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
  const src = k.src;
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
  // (v318.35) ink is dark AND colourless: on a page with colour on it (chroma), a pixel clearly coloured (over
  // COLOUR_CHROMA, the paper's tint taken out) is paper, a marker's fill, unless it's as dark as a line (INK_DARK on
  // the grey the ink was read from, stretched when Enhance is on). A section coloured in with a mid or dark marker
  // had read as ink and vanished (E1-3)
  // (v318.37: not when the page's lines are themselves coloured: the cut had erased red, blue or green outlines, 0
  // sections, X1-1. v319: that was a page-level verdict, and a cliff between the two kinds of page; the cut is per
  // patch now, inkColourCut, and the picture keeps its colour for the mark-done offer, Y1-1/2/5)
  if (chroma && chroma.length === n) inkColourCut(src || gray, n);
}
// (v319) The colour cut, patch by patch: the coloured ink (labels -1, clearly coloured and not as dark as INK_DARK on
// g, the grey the ink was read from) is taken out as a marker's fill, all but a coloured line. A line is coloured
// ink within COLOUR_LINE_MM of open paper (uncoloured paper no nearer than that to black ink and not inside the
// coloured ink) in a patch of coloured ink bordered more by paper than by black ink: the outlines of a page drawn in
// colour, which face open paper on both sides, so a line up to twice COLOUR_LINE_MM wide stays whole beside any
// number of fills; a fill's side facing an uncoloured cell across a coloured line keeps that much of the fill as
// ink, the outline thicker there. A patch bordered mostly by black ink, a fill in a black-outlined cell, is cut
// whole, however thin, run over the line or not, so a black-line page's fills are as v318.35 cut them. Before
// (v318.37, inkLinesColoured) one verdict for the whole page cut every coloured line as soon as the fills' wide ink
// outweighed the lines' thin ink (five fills, or lines over 2 mm, Y1-1/2). Paper gaps under COLOUR_GAP_MM inside the
// coloured ink are closed first (a box closing), so a fill scribbled in strokes with hairline gaps, or one a JPEG
// has speckled, is one patch (Y1-4); the gaps themselves are paper already. Only coloured ink is ever changed: black
// ink and paper are as the ink read them. Each step is a sliding box count along the rows or down the columns
// (boxPass, 12 passes) and one walk of the patches; ~0.3 s at 2400 px (in the JOBS worker where there is one,
// v318.36); a page with no coloured ink to speak of skips it. Known limits: a coloured line between two fills is cut
// with them (the two cells merge: the eye tells them apart by hue, the ink by shape only); a line lighter than the
// dark fills either side of it was never ink to Enhance (as before); a coloured stripe over twice COLOUR_LINE_MM wide
// is hollowed to its two edges
const COLOUR_LINE_MM = 2,
  COLOUR_GAP_MM = 1;
// (v328) the middle grey on g of the pixels marked in a (k of them)
function inkMidGrey(a, g, n, k) {
  const h = new Uint32Array(256);
  for (let i = 0; i < n; i++) if (a[i]) h[g[i]]++;
  let c = 0;
  for (let v = 0; v < 256; v++) if ((c += h[v]) * 2 >= k) return v;
  return 255;
}
function inkColourCut(g, n) {
  const mmpx = Math.max(W, H) / PAGE_MM,
    R = Math.max(3, Math.round(COLOUR_LINE_MM * mmpx)),
    G = Math.max(2, Math.round(COLOUR_GAP_MM * mmpx)),
    a = new Uint8Array(n);
  let any = 0;
  for (let i = 0; i < n; i++)
    if (labels[i] === -1 && chroma[i] > COLOUR_CHROMA && g[i] >= INK_DARK) {
      a[i] = 1;
      any++;
    }
  // (fewer coloured pixels than a line's width squared: nothing to cut)
  if (any < R * R) return 0;
  const b = new Uint8Array(n),
    c = new Uint8Array(n),
    d = new Uint8Array(n);
  // the closing: dilate by G, then erode by G (the picture's edge counts as ink for it, so a fill at the edge keeps
  // its rim); kept in c
  boxPass(a, b, G, false, false, false, false);
  boxPass(b, d, G, false, false, false, true);
  boxPass(d, b, G, true, true, true, false);
  boxPass(b, c, G, true, true, true, true);
  // the black ink (d), and the uncoloured paper outside the closed coloured ink (b). (v328: black ink is darker than
  // the coloured ink's middle grey, gA: a coloured line's soft rim, read as ink in a grainy photo, is a grey lighter
  // than the line, and counted as black ink round it, it had cut a red or blue line page's lines as fills, 1,140
  // cells read as 5,701 at a noise of ±6. Known cost: a grey outline lighter than a dark fill beside it isn't black
  // ink, so with Enhance off the fill's side near uncoloured paper keeps a rim of ink, its outline a few pixels
  // thicker; a margin over gA brought the grainy page's cut back, its rim's darker specks enough to tip it)
  const gA = inkMidGrey(a, g, n, any);
  for (let i = 0; i < n; i++) {
    d[i] = labels[i] === -1 && !(chroma[i] > COLOUR_CHROMA && g[i] >= INK_DARK) && g[i] < gA ? 1 : 0;
    b[i] = labels[i] === 0 && chroma[i] <= COLOUR_CHROMA && !c[i] ? 1 : 0;
  }
  // the patches of the closed coloured ink (cid, from 1), and for each how many of its pixels border black ink and
  // how many paper: the lines of a coloured-outline page border paper, a fill in a black-outlined cell black
  const cid = new Int32Array(n),
    stack = new Int32Array(n),
    nBlack = [0],
    nPaper = [0];
  for (let p = 0; p < n; p++) {
    if (!c[p] || cid[p]) continue;
    const id = nBlack.length;
    let sp = 0,
      kb = 0,
      kp = 0;
    stack[sp++] = p;
    cid[p] = id;
    while (sp > 0) {
      const q = stack[--sp],
        x = q % W,
        y = (q / W) | 0;
      let tb = 0,
        tp = 0;
      if (x > 0) {
        const r = q - 1;
        if (c[r]) {
          if (!cid[r]) {
            cid[r] = id;
            stack[sp++] = r;
          }
        } else if (d[r]) tb = 1;
        else if (b[r]) tp = 1;
      }
      if (x < W - 1) {
        const r = q + 1;
        if (c[r]) {
          if (!cid[r]) {
            cid[r] = id;
            stack[sp++] = r;
          }
        } else if (d[r]) tb = 1;
        else if (b[r]) tp = 1;
      }
      if (y > 0) {
        const r = q - W;
        if (c[r]) {
          if (!cid[r]) {
            cid[r] = id;
            stack[sp++] = r;
          }
        } else if (d[r]) tb = 1;
        else if (b[r]) tp = 1;
      }
      if (y < H - 1) {
        const r = q + W;
        if (c[r]) {
          if (!cid[r]) {
            cid[r] = id;
            stack[sp++] = r;
          }
        } else if (d[r]) tb = 1;
        else if (b[r]) tp = 1;
      }
      kb += tb;
      kp += tp;
    }
    nBlack.push(kb);
    nPaper.push(kp);
  }
  // the black ink widened by R each way (a box of 2R + 1 centred); in d
  boxPass(d, b, R + 1, false, false, false, false);
  boxPass(b, d, R + 1, false, false, false, true);
  boxPass(d, b, R + 1, false, false, true, false);
  boxPass(b, d, R + 1, false, false, true, true);
  // open paper: uncoloured paper outside the closed coloured ink and away from black ink (the inside of a big dark
  // fill reads as paper to the adaptive ink, with its edge as ink: coloured, so no line is kept round it); then
  // everything within R of it, in c
  for (let i = 0; i < n; i++) c[i] = labels[i] === 0 && chroma[i] <= COLOUR_CHROMA && !c[i] && !d[i] ? 1 : 0;
  boxPass(c, b, R + 1, false, false, false, false);
  boxPass(b, d, R + 1, false, false, false, true);
  boxPass(d, b, R + 1, false, false, true, false);
  boxPass(b, c, R + 1, false, false, true, true);
  let cut = 0;
  for (let i = 0; i < n; i++)
    if (a[i]) {
      // (near open paper, in a patch that borders paper more than black ink: a line, kept)
      if (c[i] && !(nBlack[cid[i]] > nPaper[cid[i]])) continue;
      labels[i] = 0;
      cut++;
    }
  return cut;
}
// (v319) one pass of a box filter over src (0/1, W x H) into dst: along each row (cols false) or down each column, a
// window of k pixels from each pixel on (back false) or up to it (back true); dst is 1 where the window holds only
// 1s (all) or any 1 (not all). A window cut short by the picture's edge is taken as the shorter window when pad is
// true (the edge counts as inside), or never all 1s when pad is false (the window must fit). Row by row down the
// columns too, with a count for each column, so the picture is read in order; the edge's short windows are loops
// of their own, so the main loops are plain (a pass is 15-25 ms at 2400 px)
function boxPass(src, dst, k, all, pad, back, cols) {
  const thr = all ? k : 1;
  if (!cols) {
    if (back)
      for (let y = 0, o = 0; y < H; y++, o += W) {
        let c = 0,
          x = 0;
        for (; x < k - 1 && x < W; x++) {
          c += src[o + x];
          dst[o + x] = all ? (pad && c === x + 1 ? 1 : 0) : c > 0 ? 1 : 0;
        }
        if (x < W) {
          c += src[o + x];
          dst[o + x] = c >= thr ? 1 : 0;
          x++;
        }
        for (; x < W; x++) {
          c += src[o + x] - src[o + x - k];
          dst[o + x] = c >= thr ? 1 : 0;
        }
      }
    else
      for (let y = 0, o = 0; y < H; y++, o += W) {
        let c = 0,
          x = 0;
        for (; x < k && x < W; x++) c += src[o + x];
        for (x = 0; x < W - k; x++) {
          dst[o + x] = c >= thr ? 1 : 0;
          c += src[o + x + k] - src[o + x];
        }
        for (; x < W; x++) {
          dst[o + x] = all ? (c === W - x && (pad || W - x === k) ? 1 : 0) : c > 0 ? 1 : 0;
          c -= src[o + x];
        }
      }
    return;
  }
  const cnt = new Int32Array(W),
    kW = k * W;
  if (back) {
    let y = 0,
      o = 0;
    for (; y < k - 1 && y < H; y++, o += W)
      for (let x = 0; x < W; x++) {
        const c = (cnt[x] += src[o + x]);
        dst[o + x] = all ? (pad && c === y + 1 ? 1 : 0) : c > 0 ? 1 : 0;
      }
    if (y < H) {
      for (let x = 0; x < W; x++) {
        const c = (cnt[x] += src[o + x]);
        dst[o + x] = c >= thr ? 1 : 0;
      }
      y++;
      o += W;
    }
    for (; y < H; y++, o += W)
      for (let x = 0; x < W; x++) {
        const c = (cnt[x] += src[o + x] - src[o + x - kW]);
        dst[o + x] = c >= thr ? 1 : 0;
      }
  } else {
    let y = 0,
      o = 0;
    for (; y < k && y < H; y++, o += W) for (let x = 0; x < W; x++) cnt[x] += src[o + x];
    for (y = 0, o = 0; y < H - k; y++, o += W)
      for (let x = 0; x < W; x++) {
        const c = cnt[x];
        dst[o + x] = c >= thr ? 1 : 0;
        cnt[x] = c + src[o + x + kW] - src[o + x];
      }
    for (; y < H; y++, o += W) {
      const m = H - y,
        fit = pad || m === k;
      for (let x = 0; x < W; x++) {
        const c = cnt[x];
        dst[o + x] = all ? (fit && c === m ? 1 : 0) : c > 0 ? 1 : 0;
        cnt[x] = c - src[o + x];
      }
    }
  }
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
  segPlace();
  segTidy();
}
// (v318.32) segEnd in two, so segRun can paint between them: the sections put in place (segPlace), then the crumbs
// cleaned up and the picture judged (segTidy, P1-6)
function segPlace() {
  // (v318.15: the new picture's sections are in place: render() draws them, not the photo shown meanwhile)
  _preview = false;
  // (v320: and the wait is over: the quick check takes its place)
  waitEnd();
  labelTail();
  speckClean();
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  // sections were found afresh, so their numbers mean different shapes now: per-section choices can't carry over
  locks = {};
  whitePins = {};
  shadeFlat = {};
  _flatVer++;
  _segFresh = true;
  _origKeys = {};
  _lostKeys = {};
  _gone = {};
}
function segTidy() {
  crumbClean();
  segHatch();
}
// (v318.35) the hatched patches merged into one section each, when Treat hatching as one section is on (hatchMerge),
// then the picture judged: a step of its own in segRun, after the crumbs
function segHatch() {
  hatchWould = 0;
  if (hatchOne) hatchMerge();
  else {
    hatchMade = 0;
    // (v319: what the switch would merge, asked once here for segQuality's 'hatched' test, Y1-6)
    hatchWould = hatchMerge(true);
  }
  segWarn = segQuality();
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
const PIC_KEYS = [
  'W',
  'H',
  'gray',
  'chroma',
  'srcK',
  'labels',
  'comps',
  '_faintStats',
  'faintOffer',
  '_speckCands',
  '_inkBlobs',
];
function picOut() {
  return {
    W: W,
    H: H,
    gray: gray,
    chroma: chroma,
    srcK: srcK,
    labels: labels,
    comps: comps,
    _faintStats: _faintStats,
    faintOffer: faintOffer,
    _speckCands: _speckCands,
    _inkBlobs: _inkBlobs,
  };
}
function picIn(p) {
  W = p.W;
  H = p.H;
  gray = p.gray;
  chroma = p.chroma;
  srcK = p.srcK;
  labels = p.labels;
  comps = p.comps;
  _faintStats = p._faintStats;
  faintOffer = p.faintOffer;
  _speckCands = p._speckCands;
  _inkBlobs = p._inkBlobs;
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
/* ---- (v318.36) the steps up to the sections in the JOBS worker (Stage 5, decision 8.9) ----
   The ink, its smoothing, the specks and the flood fill are the bulk of finding a photo's sections (at 2400 px, 0.5 s
   or more a step on an iPad), and they read nothing of the page but the picture and the detection settings. They run
   in the JOBS worker (03-jobs), whose code is this file's own functions copied in (segWorkerSrc) with the same
   constants, on the same picture, in the same order: what comes back is what the page would have worked out itself,
   pixel for pixel (the e2e test v31836-worker runs both and compares). The page only paints meanwhile. The steps
   that need the page (segPlace: the background, the page and the frame; the crumbs; the hatching) stay on it, after
   the paint between them as before. A new picture's grey and colour are handed over to the worker and handed back
   (transferred, not copied; the page makes them again with prep() should the worker lose them); the open picture's
   own grey stays in place when the sections are found again on it, so it's copied for the worker (a few ms). The
   labels and the ink blobs come back handed over too. A newer run's job supersedes an older one in the worker as well
   (self.segWkLatest): the older job stops at its next step and answers 'superseded', which the page ignores (the run was
   stopped already, segGen). Anywhere there's no worker, or it fails or gives no answer in time (JOBS), the steps run on
   the page as before v318.36, said nowhere. */
// the worker's copy of the finder: its functions, the state they read and write (picIn/picOut's keys, the detection
// settings) and the constants, as this page has them
function segWorkerSrc() {
  return (
    [
      otsu,
      autoStretch,
      adaptiveInk,
      noiseLevel,
      boxBlur,
      speckCap,
      despeckle,
      faintSplitFast,
      faintSplit,
      labelFill,
      inkPrep,
      inkBlur,
      inkDone,
      inkColourCut,
      inkMidGrey,
      boxPass,
      segSpeck,
      picOut,
      picIn,
      onPic,
      segPack,
      segWork,
    ]
      .map(function (f) {
        return f.toString();
      })
      .join('\n') +
    '\nlet W, H, gray, chroma, srcK, labels, comps, _faintStats, faintOffer, _speckCands, _inkBlobs,' +
    ' enhance, adaptC, faintCut;' +
    '\nconst PIC_KEYS = ' +
    JSON.stringify(PIC_KEYS) +
    ', MIN_MM = ' +
    MIN_MM +
    ', PAGE_MM = ' +
    PAGE_MM +
    ', EDGE_BAND = ' +
    EDGE_BAND +
    ', SPECK_MM = ' +
    SPECK_MM +
    ', SPECK_MARGIN_MM = ' +
    SPECK_MARGIN_MM +
    ', COLOUR_CHROMA = ' +
    COLOUR_CHROMA +
    ', INK_DARK = ' +
    INK_DARK +
    ', COLOUR_LINE_MM = ' +
    COLOUR_LINE_MM +
    ', COLOUR_GAP_MM = ' +
    COLOUR_GAP_MM +
    ';\n'
  );
}
// (runs in the worker) the steps on the picture sent (m), the thread free between them so a newer picture's message
// is seen (self.segWkLatest, the newest job's gen) and this one dropped; each step on the picture's own state, with
// the settings it was sent (onPic), so two jobs' steps may follow each other. Resolves to the packed answer (segPack)
// and what's handed back
async function segWork(m) {
  if (!(m.gen <= self.segWkLatest)) self.segWkLatest = m.gen;
  const pic = {
    W: m.W,
    H: m.H,
    gray: m.gray,
    chroma: m.chroma || null,
    srcK: m.srcK,
    labels: null,
    comps: null,
    _faintStats: null,
    faintOffer: m.faintOffer,
    _speckCands: null,
    _inkBlobs: null,
  };
  const step = function (fn) {
    if (m.gen !== self.segWkLatest) throw new Error('superseded');
    enhance = m.enhance;
    adaptC = m.adaptC;
    faintCut = m.faintCut;
    onPic(pic, fn);
  };
  const free = function () {
    return new Promise(function (r) {
      setTimeout(r, 0);
    });
  };
  let k = null;
  step(function () {
    k = inkPrep();
    if (!k.passes) inkDone(k);
  });
  while (k.passes) {
    await free();
    step(function () {
      inkBlur(k);
      if (!k.passes) inkDone(k);
    });
  }
  await free();
  step(segSpeck);
  await free();
  step(labelFill);
  return segPack(pic, m.back);
}
// (runs in the worker) the steps' results as typed arrays, so they cross to the page handed over rather than built up
// object by object (a grainy photo has tens of thousands of blobs and crumbs): the labels; the sections (comps, nine
// numbers each); the faint-marks figures; the speck candidates (their pixels end to end, and six numbers each); the
// ink blobs (each pixel's, their sizes, their boxes, eight numbers each); and the grey and colour back when they were
// handed over (back). segUnpack puts them together again as despeckle and labelFill made them
function segPack(pic, back) {
  const comps = pic.comps,
    nc = comps.length,
    cm = new Float64Array(nc * 9),
    t = [pic.labels.buffer, cm.buffer];
  for (let l = 1; l < nc; l++) {
    const c = comps[l],
      o = l * 9;
    cm[o] = c.area;
    cm[o + 1] = c.bpx;
    cm[o + 2] = c.cx;
    cm[o + 3] = c.cy;
    cm[o + 4] = c.h;
    cm[o + 5] = c.x0;
    cm[o + 6] = c.y0;
    cm[o + 7] = c.x1;
    cm[o + 8] = c.y1;
  }
  const r = {
    labels: pic.labels,
    cm: cm,
    fo: pic.faintOffer,
    fs: null,
    sc: null,
    ib: null,
    gray: null,
    chroma: null,
  };
  const fs = pic._faintStats;
  if (fs) {
    r.fs = { dark: fs.dark, mid: fs.mid, faint: fs.faint, tot: fs.tot, fh: fs.fh };
    t.push(fs.fh.buffer);
  }
  const S = pic._speckCands;
  if (S) {
    const L = S.list,
      meta = new Int32Array(L.length * 6);
    let np = 0;
    for (let i = 0; i < L.length; i++) np += L[i].px.length;
    const px = new Int32Array(np);
    for (let i = 0, o = 0; i < L.length; i++) {
      const b = L[i],
        j = i * 6;
      px.set(b.px, o);
      o += b.px.length;
      meta[j] = b.px.length;
      meta[j + 1] = b.core;
      meta[j + 2] = b.x0;
      meta[j + 3] = b.y0;
      meta[j + 4] = b.x1;
      meta[j + 5] = b.y1;
    }
    r.sc = { meta: meta, px: px, line: S.line };
    t.push(meta.buffer, px.buffer);
  }
  const B = pic._inkBlobs;
  if (B) {
    const nb = B.sz.length,
      sz = new Int32Array(nb),
      box = new Int32Array(nb * 8);
    for (let i = 1; i < nb; i++) {
      sz[i] = B.sz[i];
      const b = B.box[i];
      for (let j = 0; j < 8; j++) box[i * 8 + j] = b[j];
    }
    r.ib = { bid: B.bid, sz: sz, box: box };
    t.push(B.bid.buffer, sz.buffer, box.buffer);
  }
  if (back) {
    r.gray = pic.gray;
    t.push(pic.gray.buffer);
    if (pic.chroma) {
      r.chroma = pic.chroma;
      t.push(pic.chroma.buffer);
    }
  }
  return { v: r, t: t };
}
// the worker's answer put into pic, as the steps leave it on the page (segPack's opposite)
function segUnpack(pic, r) {
  if (r.gray) pic.gray = r.gray;
  // (v318.37-v319: the colour had come back null, cn, when the ink dropped it for a coloured-line page; it keeps it now)
  if (r.chroma) pic.chroma = r.chroma;
  pic.labels = r.labels;
  const cm = r.cm,
    nc = cm.length / 9,
    comps = [null];
  for (let l = 1; l < nc; l++) {
    const o = l * 9;
    comps.push({
      area: cm[o],
      bg: false,
      bpx: cm[o + 1],
      cx: cm[o + 2],
      cy: cm[o + 3],
      h: cm[o + 4],
      x0: cm[o + 5],
      y0: cm[o + 6],
      x1: cm[o + 7],
      y1: cm[o + 8],
    });
  }
  pic.comps = comps;
  pic.faintOffer = r.fo;
  pic._faintStats = r.fs
    ? { dark: r.fs.dark, mid: r.fs.mid, faint: r.fs.faint, tot: r.fs.tot, fh: r.fs.fh }
    : null;
  if (r.sc) {
    const meta = r.sc.meta,
      px = r.sc.px,
      list = [];
    for (let i = 0, o = 0; i * 6 < meta.length; i++) {
      const j = i * 6,
        n = meta[j];
      list.push({
        px: px.slice(o, o + n),
        core: meta[j + 1],
        x0: meta[j + 2],
        y0: meta[j + 3],
        x1: meta[j + 4],
        y1: meta[j + 5],
      });
      o += n;
    }
    pic._speckCands = { list: list, line: r.sc.line };
  } else pic._speckCands = null;
  if (r.ib) {
    const nb = r.ib.sz.length,
      sz = [0],
      box = [null];
    for (let i = 1; i < nb; i++) {
      sz.push(r.ib.sz[i]);
      box.push(Array.prototype.slice.call(r.ib.box, i * 8, i * 8 + 8));
    }
    pic._inkBlobs = { bid: r.ib.bid, sz: sz, box: box };
  } else pic._inkBlobs = null;
}
// the steps up to the sections on pic in the worker: resolves true with pic filled in (segUnpack), false when the page
// is to do them itself (no worker, or the job failed, timed out or was superseded). fresh: pic is a new picture of
// its own (prep), whose grey and colour are handed over and back; otherwise they're the open picture's, and copied.
// gen: this run's segGen, so the worker drops it for a newer one. (for the tests: segOffCount, how many ran there)
let segOffCount = 0;
function segOff(pic, gen, fresh) {
  if (!JOBS.on) return Promise.resolve(false);
  const d = {
      W: pic.W,
      H: pic.H,
      gray: pic.gray,
      chroma: pic.chroma || null,
      srcK: pic.srcK,
      enhance: enhance,
      adaptC: adaptC,
      faintCut: faintCut,
      faintOffer: pic.faintOffer,
      gen: gen,
      back: !!fresh,
    },
    tr = [];
  if (fresh) {
    tr.push(pic.gray.buffer);
    if (pic.chroma) tr.push(pic.chroma.buffer);
  }
  return JOBS.run('seg', d, tr).then(
    function (r) {
      segUnpack(pic, r);
      segOffCount++;
      return true;
    },
    function () {
      return false;
    },
  );
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
  // (v318.32: a run stopped between its last two steps leaves no blob labelling behind, _inkBlobs)
  _inkBlobs = null;
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
      let f = _segFocus;
      _segFocus = null;
      // (v328 review 2: the controls drawn again meanwhile, as a photo-made page's remake does: the same control in the
      // new ones, by its id, or its group's id and its value)
      if (!f.isConnected) {
        const id = f.id,
          g = f.parentElement && f.parentElement.closest('[id]'),
          v = f.dataset && f.dataset.v;
        let n = id ? document.getElementById(id) : null;
        if (!n && g && g.id && v != null) {
          const gn = document.getElementById(g.id);
          if (gn)
            n =
              [].find.call(gn.querySelectorAll('[data-v]'), function (x) {
                return x.dataset.v === v;
              }) || null;
        }
        f = n;
      }
      if (f && f.isConnected && document.activeElement !== f) f.focus({ preventScroll: true });
    }
  }
}
// prep(): a new picture (W, H, gray, srcK, and anything else its commit needs), or null to find the sections again on
// the open one; commit(pic): put it in place (before the sections). Resolves true when done, false when a newer run
// took over; rejects on an error (nothing put in place). hide: the controls out of sight meanwhile (segBusySet).
// (v318.23: the steps' names, for the waits Copy diagnostics lists)
const SEG_STEP_NAMES = [
  'prepare',
  'off the page',
  'ink',
  'smooth',
  'specks',
  'sections',
  'put in place',
  'crumbs',
  'hatching',
];
function segRun(prep, commit, hide) {
  const my = ++segGen;
  segBusySet(true, hide, !!prep);
  // (v320: a new picture's sections being found: the wait's list back if the corner handles had it aside)
  // (a picture with no page to find, a scan or a download, goes straight to its sections)
  if (prep) waitPause(false);
  if (_wait) waitAt(2);
  let pic = null;
  // (v318.36: the 'put in place' step's place, where the run goes on once the worker has found the sections)
  const PLACE = SEG_STEP_NAMES.indexOf('put in place');
  const steps = [
    function () {
      // (v318.35: the picture's colour goes with its grey, chroma)
      pic = prep ? prep() : { W: W, H: H, gray: gray, chroma: chroma, srcK: srcK };
      pic.labels = null;
      pic.comps = null;
      pic._faintStats = null;
      pic._speckCands = null;
      pic._inkBlobs = null;
      // (kept as it is when faint marks are ignored: segSpeck measures it only when they aren't)
      pic.faintOffer = faintOffer;
      if (!pic.gray) throw new Error('no picture');
    },
    // (v318.36: the ink, smooth, specks and sections steps in the JOBS worker, segOff; a promise, which next waits on.
    // Done there, the run goes on at 'put in place'; otherwise with 'ink', on the page as before)
    function () {
      return segOff(pic, my, !!prep).then(function (off) {
        if (off) return PLACE;
        // (a new picture handed to a worker that then failed: its grey went with it, so it's made again)
        if (prep && !pic.gray.byteLength) {
          const p = prep();
          pic.gray = p.gray;
          pic.chroma = p.chroma;
        }
        return PLACE - 4;
      });
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
      segPlace();
    },
    // (v318.32: the crumbs on the picture in place, after a paint: at 2400 px they took a third of the time, P1-6)
    function () {
      crumbClean();
    },
    // (v318.35: the hatching merged, and the picture judged, after another)
    function () {
      segHatch();
    },
  ];
  return new Promise(function (res, rej) {
    let i = 0;
    const fail = function (e) {
        if (my === segGen) {
          segBusySet(false);
          waitEnd();
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
      },
      go = function () {
        if (i < steps.length) afterPaint(next);
        else {
          segBusySet(false);
          res(true);
        }
      },
      next = function () {
        if (my !== segGen) return res(false);
        let r;
        try {
          // (v318.23: each step timed for Copy diagnostics, holdTime in safety.js)
          r = holdTime(
            (prep ? 'New photo: ' : 'Sections again: ') + SEG_STEP_NAMES[i],
            function () {
              return steps[i]();
            },
            function () {
              return pic && pic.W ? pic.W + '×' + pic.H : '';
            },
          );
        } catch (e) {
          fail(e);
          return;
        }
        // (v318.36: a step that waits on the worker says which step comes next; the page is free meanwhile)
        if (r && typeof r.then === 'function') {
          r.then(function (at) {
            if (my !== segGen) return res(false);
            i = at;
            go();
          }, fail);
          return;
        }
        if (r !== 'again') i++;
        go();
      };
    afterPaint(next);
  });
}
function render() {
  // (v318.15: a new photo shown while its sections are found: photoPreview, 20-image-input)
  if (_preview) return;
  // (v328 review: Crop and the corners have their own drawing: sections found again meanwhile aren't drawn over them)
  if (cropMode) return drawCropOverlay();
  if (pgMode && pgEd) return pgDraw();
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
  // (v326) a photo-made page's step: its markers' colours, as Build will lay them (47-photo-page ppStepColours), the
  // lines as they print; the paper where nothing's coloured (left out, the background, left white)
  const ppc = sfmode === 'review' && ppOn() ? ppStepColours(cn) : null,
    PAPER_W = [255, 255, 255];
  lut[0] = pack(ppc ? ppStepLine() : LINE);
  // (label 0 doesn't survive labelCells; drawn as a left-out section if it ever did, not as nothing)
  lut[1] = pack(MAG);
  for (let l = 1; l < comps.length; l++) {
    let col;
    if (ppc) col = ppc[l] || PAPER_W;
    else if (l === mergeSel) col = HILITE;
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
  // (v329: the possible gaps in the lines, while they're shown; checked again after an Undo: 66-gaps)
  gapRendered();
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
  _sepOnce = {};
  try {
    saveStatus();
    edBarSync();
  } finally {
    _sepOnce = null;
  }
  frameLineSync();
  outlineMerge();
}
