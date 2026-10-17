// Registration of a photo of a printed sheet (scripts/bench, step 4): find the four ring squares, map the sheet's
// millimetres onto the photo, read the page code. Independent of the app's page finder, which it is there to judge.
import { homog, apply } from './photo.mjs';
import { PAPER, squareCentres, BITS } from './paper.mjs';

function boxMean(g, W, H, r) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = 0; x < W; x++) {
      s += g[y * W + x];
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + s;
    }
  }
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(W, x + r + 1);
      m[y * W + x] =
        (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) /
        ((y1 - y0) * (x1 - x0));
    }
  }
  return m;
}

// {W, H, d (RGBA)} -> {ok, H (mm -> photo px), C (sheet corners in photo px), n (page), bits, why}
export function register(ph) {
  const { W, H, d } = ph,
    n = W * H,
    g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  // the paper's own level nearby: the lightest of each 8 x 8 block, averaged over a few blocks round (a plain local
  // mean is pulled down by a dark desk beside the sheet's edge, and a far square there, small and soft, fell apart)
  const B = 8,
    bw0 = Math.ceil(W / B),
    bh0 = Math.ceil(H / B),
    bmax = new Uint8Array(bw0 * bh0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = ((y / B) | 0) * bw0 + ((x / B) | 0);
      if (g[y * W + x] > bmax[k]) bmax[k] = g[y * W + x];
    }
  const lvl = boxMean(bmax, bw0, bh0, 3);
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const L = lvl[((((i / W) | 0) / B) | 0) * bw0 + (((i % W) / B) | 0)];
    dark[i] = g[i] < 0.65 * L && g[i] < 160 ? 1 : 0;
  }
  // dark components (8-connected)
  const lab = new Int32Array(n),
    st = new Int32Array(n),
    comps = [];
  for (let p = 0; p < n; p++) {
    if (!dark[p] || lab[p]) continue;
    const id = comps.length + 1;
    let sp = 0,
      a = 0,
      sx = 0,
      sy = 0,
      x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0;
    st[sp++] = p;
    lab[p] = id;
    while (sp) {
      const q = st[--sp],
        x = q % W,
        y = (q / W) | 0;
      a++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const r = yy * W + xx;
          if (dark[r] && !lab[r]) {
            lab[r] = id;
            st[sp++] = r;
          }
        }
      if (a > 40000) break;
    }
    comps.push({ id, a, cx: sx / a, cy: sy / a, x0, y0, x1, y1 });
  }
  // ring squares: square-ish (up to 4:1 when the sheet is seen at a slant), mostly dark, light at the middle (the
  // hole); and, as weaker candidates, solid ones (a far square seen at a slant can lose its hole to blur)
  const side = Math.min(W, H),
    ring = [],
    solid = [];
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1,
      bh = c.y1 - c.y0 + 1;
    if (Math.min(bw, bh) < 5 || Math.max(bw, bh) < 8 || bw > side * 0.08 || bh > side * 0.08) continue;
    if (bw / bh > 4 || bh / bw > 4) continue;
    const fill = c.a / (bw * bh);
    if (fill < 0.45 || fill > 0.97) continue;
    const mx = Math.round(c.cx),
      my = Math.round(c.cy);
    if (lab[my * W + mx] === c.id) {
      if (fill > 0.7) solid.push({ ...c, q: fill });
      continue;
    }
    // the hole: light pixels around the middle, enclosed (the ring on all four sides)
    let ringHits = 0;
    for (const [ux, uy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let t = 1; t < Math.max(bw, bh); t++) {
        const x = mx + ux * t,
          y = my + uy * t;
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        if (lab[y * W + x] === c.id) {
          ringHits++;
          break;
        }
      }
    }
    // (three sides will do: a far square seen at a slant can lose the side of its ring nearest the camera to blur)
    if (ringHits >= 3 && fill <= 0.95) ring.push(c);
    else if (fill > 0.7) solid.push({ ...c, q: fill });
  }
  if (ring.length + solid.length < 4)
    return { ok: false, why: `found ${ring.length + solid.length} of 4 squares` };
  const S = squareCentres(),
    px = (x, y) => (x < 0 || y < 0 || x >= W - 1 || y >= H - 1 ? -1 : g[Math.round(y) * W + Math.round(x)]);
  // a quad is the sheet's when the band between the squares and the drawing is blank paper all round, and the page
  // code reads clearly with odd parity (dark where it's 1, paper where it's 0); tried at each of the four turns
  const band = [];
  for (let t = 0; t <= 12; t++) {
    const x = 20 + (t * (PAPER.w - 40)) / 12,
      y = 20 + (t * (PAPER.h - 40)) / 12;
    band.push([x, 16.5], [x, PAPER.h - 16.5], [16.5, y], [PAPER.w - 16.5, y]);
  }
  const lo3 = (x, y) => {
    let m = 255;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const v = px(x + dx, y + dy);
        if (v < 0) return -1;
        m = Math.min(m, v);
      }
    return m;
  };
  const area4 = (P) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const a = P[i],
        b = P[(i + 1) % 4];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  };
  const tryQuad = (best, blobs) => {
    let pick = null;
    for (let r = 0; r < 4; r++) {
      const dst = [0, 1, 2, 3].map((i) => best[(i + r) % 4]),
        Hm = homog(S, dst);
      // (each square the size the mapping says a 5 mm square is there, give or take a turned square's box)
      const sizeOk = [0, 1, 2, 3].every((i) => {
        const [cx, cy] = S[i],
          c = blobs[(i + r) % 4],
          q = [
            [cx - 2.5, cy - 2.5],
            [cx + 2.5, cy - 2.5],
            [cx + 2.5, cy + 2.5],
            [cx - 2.5, cy + 2.5],
          ].map(([x, y]) => apply(Hm, x, y)),
          want = Math.sqrt(area4(q)),
          got = Math.sqrt((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1));
        return got > want / 1.5 && got < want * 1.9;
      });
      if (!sizeOk) continue;
      const bv = band.map(([x, y]) => lo3(...apply(Hm, x, y)));
      if (bv.some((v) => v < 0)) continue;
      // (each against its neighbours along the same side: a shadow across the sheet is gradual, a line isn't)
      let bad = 0;
      for (let i = 0; i < bv.length; i++) {
        const line = i & 3,
          t = i >> 2,
          nb = [];
        for (let u = Math.max(0, t - 2); u <= Math.min(12, t + 2); u++)
          if (u !== t) nb.push(bv[u * 4 + line]);
        nb.sort((a, b) => a - b);
        const ref = nb[nb.length >> 1];
        if (ref < 50 || bv[i] < 0.7 * ref) bad++;
      }
      if (bad > bv.length * 0.08) continue;
      // (each code square against the paper right round it: a shadow can lie across the row)
      const vals = BITS.xs.map((x) => {
        const [qx, qy] = apply(Hm, x, BITS.y);
        if (qx < 2 || qy < 2 || qx >= W - 2 || qy >= H - 2) return 1;
        let s = 0,
          k = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            s += g[Math.round(qy + dy) * W + Math.round(qx + dx)];
            k++;
          }
        const paper = Math.max(px(...apply(Hm, x, BITS.y - 5)), px(...apply(Hm, x, BITS.y + 5.5)), 0);
        return paper > 0 ? s / k / paper : 1;
      });
      if (vals.some((v) => v >= 0.6 && v <= 0.8)) continue; // not clear either way
      // (and the code row is blank paper either side of the code)
      const paperAt = (x) => Math.max(px(...apply(Hm, x, BITS.y - 5)), px(...apply(Hm, x, BITS.y + 5.5)), 1);
      if ([40, 55, 65, 140, 155, 170].some((x) => lo3(...apply(Hm, x, BITS.y)) < 0.7 * paperAt(x))) continue;
      const bits = vals.map((v) => (v < 0.6 ? 1 : 0)),
        parity = (bits[0] + bits[1] + bits[2] + bits[3]) & 1;
      const contrast = Math.min(...vals.filter((v, i) => bits[i]).map((v) => 1 - v), 9);
      if (parity === 1 && (!pick || contrast > pick.contrast)) pick = { Hm, bits, contrast, turn: r };
    }
    return pick;
  };
  // the quads, largest first, among the ring squares, then with the solid ones too (at most 48 candidates)
  const search = (cs) => {
    const quads = [];
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++)
        for (let k = j + 1; k < cs.length; k++)
          for (let l = k + 1; l < cs.length; l++) {
            const Q = [cs[i], cs[j], cs[k], cs[l]],
              sz = Q.map((c) => Math.sqrt((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)));
            // (the four are the same square seen in perspective: sizes within a factor of 3.5)
            if (Math.max(...sz) > 3.5 * Math.min(...sz)) continue;
            const m = [Q.reduce((s, c) => s + c.cx, 0) / 4, Q.reduce((s, c) => s + c.cy, 0) / 4];
            Q.sort((a, b) => Math.atan2(a.cy - m[1], a.cx - m[0]) - Math.atan2(b.cy - m[1], b.cx - m[0]));
            const P = Q.map((c) => [c.cx, c.cy]),
              A = area4(P);
            if (A >= 0.03 * W * H) quads.push({ P, Q, A });
          }
    quads.sort((a, b) => b.A - a.A);
    for (const q of quads) {
      const pick = tryQuad(q.P, q.Q);
      if (pick) return pick;
    }
    return null;
  };
  const bySize = (a, b) => b.a - a.a;
  let pick = ring.length >= 4 ? search(ring.sort(bySize).slice(0, 40)) : null;
  if (!pick)
    pick = search([
      ...ring.sort(bySize).slice(0, 24),
      ...solid.sort((a, b) => b.q - a.q || b.a - a.a).slice(0, 24),
    ]);
  if (!pick) return { ok: false, why: `no sheet found (${ring.length} ring squares, ${solid.length} solid)` };
  const nPage = ((pick.bits[0] << 2) | (pick.bits[1] << 1) | pick.bits[2]) + 1;
  const C = [
    [0, 0],
    [PAPER.w, 0],
    [PAPER.w, PAPER.h],
    [0, PAPER.h],
  ].map(([x, y]) => apply(pick.Hm, x, y));
  return { ok: true, Hm: pick.Hm, C, n: nPage, bits: pick.bits, turn: pick.turn };
}
