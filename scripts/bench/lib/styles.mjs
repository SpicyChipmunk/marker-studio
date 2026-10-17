// Page styles (scripts/bench). Each returns { R } (a drawn Raster with R.lw, R.textSpecs). Ported from the preview set
// the benchmark was designed with; changes: neurographic pages round EVERY junction (skipJ 0, as Ben's answer 6 says),
// R.lw is recorded for truth's closing, text specs ride on the Raster.
import {
  rng,
  Raster,
  TAU,
  catmull,
  circle,
  arc,
  ellipse,
  quad,
  petal,
  blob,
  scallop,
  roundRectPts,
  sdfRoundRect,
  sdfCircle,
  resample,
  hand,
  clipTo,
  flowLine,
  along,
  pointIn,
  hatchRegion,
  scalesRegion,
  gridRegion,
  circlesRegion,
  dotsRegion,
  norm,
} from './raster.mjs';

// a few points inside region L of a draw-time labelling (page px): the scorer finds the truth section they fall in
function samplePts(R, lab, L, n = 9) {
  const { HW, HH, S } = R,
    hits = [];
  for (let y = 0; y < HH; y += 3)
    for (let x = 0; x < HW; x += 3) if (lab[y * HW + x] === L) hits.push([x / S, y / S]);
  const out = [];
  for (let i = 0; i < n && hits.length; i++) out.push(hits[Math.floor(((i + 0.5) * hits.length) / n)]);
  return out;
}
const polar = (cx, cy, rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
const pick = (r, arr) => arr[(r() * arr.length) | 0];
const sdfPoly = (poly) => ({ sdf: (x, y) => (pointIn(poly, x, y) ? -1 : 1) });
const sdfAnd = (a, b) => ({ sdf: (x, y) => Math.max(a.sdf(x, y), b.sdf(x, y)), box: a.box });
const sdfNot = (a) => ({ sdf: (x, y) => -a.sdf(x, y) });

// line spreader: keeps a coarse occupancy grid of drawn lines; scores a candidate by closeness to existing lines
// (bad) and by how much empty area it crosses (good). Picks the best of K candidates.
class Spread {
  constructor(W, H, cell = 12) {
    this.W = W;
    this.H = H;
    this.c = cell;
    this.nx = Math.ceil(W / cell) + 1;
    this.occ = new Uint8Array(this.nx * (Math.ceil(H / cell) + 1));
    this.cover = new Uint8Array(Math.ceil(W / 100) * Math.ceil(H / 100) + 40);
  }
  key(x, y) {
    const i = Math.floor(x / this.c),
      j = Math.floor(y / this.c);
    return i < 0 || j < 0 || i >= this.nx ? -1 : j * this.nx + i;
  }
  add(pts) {
    for (const p of resample(pts, 4)) {
      const k = this.key(p[0], p[1]);
      if (k >= 0 && k < this.occ.length) this.occ[k] = 1;
      const ck = Math.floor(p[0] / 100) + Math.floor(p[1] / 100) * Math.ceil(this.W / 100);
      if (ck >= 0 && ck < this.cover.length) this.cover[ck] = 1;
    }
  }
  score(pts, coverW = 0.6) {
    const P = resample(pts, 6);
    let near = 0,
      fresh = 0;
    for (const p of P) {
      let hit = false;
      for (let dj = -1; dj <= 1 && !hit; dj++)
        for (let di = -1; di <= 1 && !hit; di++) {
          const k = this.key(p[0] + di * this.c, p[1] + dj * this.c);
          if (k >= 0 && k < this.occ.length && this.occ[k]) hit = true;
        }
      if (hit) near++;
      const ck = Math.floor(p[0] / 100) + Math.floor(p[1] / 100) * Math.ceil(this.W / 100);
      if (ck >= 0 && ck < this.cover.length && !this.cover[ck]) fresh++;
    }
    return near / P.length - coverW * (fresh / P.length);
  }
  best(r, make, K = 6) {
    let b = null,
      bs = Infinity;
    for (let k = 0; k < K; k++) {
      const c = make();
      const s = this.score(c);
      if (s < bs) {
        bs = s;
        b = c;
      }
    }
    return b;
  }
}

// ------------------------------------------------------------------ neurographic family
export function neuro(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    m = o.margin || 0,
    lw = o.lw || 5;
  const hz = R.hazards,
    amp = o.amp == null ? 1.0 : o.amp,
    wv = o.wv == null ? 0.22 : o.wv,
    sp = new Spread(W, H);
  let env = null,
    outlinePts = null;
  if (m) {
    if (o.outline === 'circle') {
      const rad = Math.min(W, H) / 2 - m;
      env = sdfCircle(W / 2, H / 2, rad);
      outlinePts = circle(W / 2, H / 2, rad);
    } else {
      const rr = o.rr == null ? 70 : o.rr;
      env = sdfRoundRect(m, m, W - m, H - m, rr);
      outlinePts = roundRectPts(m, m, W - m, H - m, rr);
    }
    R.envelope = env;
    R.marginRule = 'envelope';
  }
  const pageBox = [-40, -40, W + 40, H + 40];
  const box = m
    ? o.outline === 'circle'
      ? [m - 10, m - 10, W - m + 10, H - m + 10]
      : [m - 4, m - 4, W - m + 4, H - m + 4]
    : pageBox;
  if (outlinePts) R.stroke(hand(r, outlinePts, { amp: amp * 0.6, wv: wv * 0.6 }), lw * 1.05);
  const nLines = o.lines == null ? 11 : o.lines,
    escape = o.escape || 0,
    faint = o.faint || [],
    breaks = o.breaks || [];
  const lines = [];
  for (let i = 0; i < nLines; i++) {
    const esc = m && i < escape;
    const pts = sp.best(r, () => flowLine(r, esc ? pageBox : box, { swing: o.swing, inset: 0.08 }));
    const hp = hand(r, pts, { amp, wv });
    const w = lw * (0.85 + 0.3 * r()),
      opts = {};
    let haz = null;
    const fi = faint.findIndex((f) => f.line === i);
    if (fi >= 0) {
      opts.grey = faint[fi].grey;
      haz = { kind: 'faintLine', grey: faint[fi].grey, lw: +w.toFixed(1), line: i };
    }
    const bi = breaks.findIndex((b) => b.line === i);
    if (bi >= 0) {
      const gg = { at: 0.3 + 0.4 * r(), len: breaks[bi].px };
      opts.gaps = [gg];
      haz = { kind: 'gap', sub: 'break', px: breaks[bi].px, g: gg, line: i };
    }
    if (haz) {
      hz.push(haz);
      opts.sep = haz;
    }
    const pieces = esc ? [hp] : clipTo(env, hp, () => (o.over == null ? 1 + 5 * r() : o.over));
    for (const pc of pieces) {
      R.stroke(pc, w, opts);
      lines.push({ pts: pc, w });
      sp.add(pc);
    }
    if (esc) hz.push({ kind: 'escape', line: i });
  }
  // branches: lines that start on another line (over- or undershoot there) and run away to the outline / edge
  const clipEnv = env || sdfRoundRect(-30, -30, W + 30, H + 30, 1);
  const branches = o.branches || [],
    protect = [];
  for (const b of branches) {
    let best = null,
      bs = Infinity;
    const jsNow = b.under ? R.findJunctions(6) : [];
    for (let k = 0; k < 10; k++) {
      const L = pick(r, lines),
        t = 0.2 + 0.6 * r(),
        { p, d } = along(L.pts, t),
        side = r() < 0.5 ? 1 : -1;
      if (
        b.under &&
        (jsNow.some((j) => Math.hypot(j.x - p[0], j.y - p[1]) < 30) ||
          protect.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 45))
      )
        continue;
      const n = [-d[1] * side, d[0] * side],
        far = 1.2 * Math.max(W, H),
        ctrl = [p];
      for (let q = 1; q <= 4; q++) {
        const s = (far * q) / 4,
          j = (r() - 0.5) * 220 * q;
        ctrl.push([p[0] + n[0] * s + d[0] * j, p[1] + n[1] * s + d[1] * j]);
      }
      const hp = hand(r, catmull(ctrl, 32), { amp, wv }),
        pieces = clipTo(clipEnv, hp, () => (env ? 1 + 5 * r() : 0));
      if (!pieces.length) continue;
      const pc = pieces[0];
      if (Math.hypot(pc[0][0] - p[0], pc[0][1] - p[1]) > 3 || pc.length < 20) continue;
      const s = sp.score(pc, 0.15);
      if (s < bs) {
        bs = s;
        best = { L, p, n, pc };
      }
    }
    if (!best) continue;
    let { L, p, n, pc } = best;
    const w = lw * (0.85 + 0.3 * r());
    if (b.under) {
      const cut = R.inkEdge(p, n) + b.under + (w * (pc[0][2] || 1)) / 2;
      const haz = {
        kind: 'gap',
        sub: 'undershoot',
        px: b.under,
        at: [Math.round(p[0]), Math.round(p[1])],
        dir: [+n[0].toFixed(3), +n[1].toFixed(3)],
      };
      hz.push(haz);
      protect.push([p[0], p[1], 3.5 * lw]);
      R.stroke(pc, w, { startCut: cut, sep: haz });
    } else {
      const over = b.over == null ? 2 + 5 * r() : b.over;
      pc = [[p[0] - n[0] * over, p[1] - n[1] * over, pc[0][2]], ...pc];
      R.stroke(pc, w);
    }
    lines.push({ pts: pc, w });
    sp.add(pc);
  }
  // circles: about half sit on junctions (the artist rounds a crossing into a circle), the rest free; sizes mixed
  const nC = o.circles == null ? 18 : o.circles,
    placed = [],
    js = R.findJunctions(6);
  for (let i = 0; i < nC; i++) {
    const u = r(),
      rad = u < 0.55 ? 12 + 26 * r() : u < 0.9 ? 40 + 60 * r() : 100 + 90 * r();
    let cx,
      cy,
      ok = false;
    if (js.length && rad < 60 && r() < 0.5) {
      const k = (r() * js.length) | 0,
        j = js[k];
      cx = j.x;
      cy = j.y;
      ok = !env || env.sdf(cx, cy) <= -rad * 0.6;
      if (ok) js.splice(k, 1);
    }
    for (let t = 0; t < 40 && !ok; t++) {
      cx = rad + (W - 2 * rad) * r();
      cy = rad + (H - 2 * rad) * r();
      ok = !env || env.sdf(cx, cy) <= -rad * 0.8 - 8;
    }
    if (!ok) continue;
    if (
      placed.some(
        (c) => Math.hypot(c.cx - cx, c.cy - cy) < Math.max(Math.abs(c.rad - rad) + 6, 0.5 * (c.rad + rad)),
      )
    )
      continue;
    const w = lw * (0.8 + 0.3 * r());
    R.stroke(hand(r, circle(cx, cy, rad), { amp: amp * 0.5, wv: wv * 0.7 }), w);
    if (rad > 40 && r() < 0.35)
      R.stroke(hand(r, circle(cx, cy, rad * (0.55 + 0.25 * r())), { amp: amp * 0.5, wv: wv * 0.7 }), w * 0.9);
    placed.push({ cx, cy, rad });
  }
  // rounded junctions (the neurographic look)
  const nj = R.roundJunctions(r, { k: o.k, reach: o.reach, skip: o.skipJ || 0, avoid: protect });
  for (const h of hz)
    if (h.kind === 'gap' && h.sub === 'undershoot') {
      h.measuredPx = R.measureOpening(h.at, h.dir);
      if (h.measuredPx < h.px - 0.7 || h.measuredPx > h.px + 1.5)
        console.warn(`  !! ${h.px} px undershoot at ${h.at} measures ${h.measuredPx}`);
    }
  hz.push({ kind: 'junctionBlobs', n: nj });
  // hatched patch: one circle filled with parallel lines (render only: one section)
  if (o.hatch) {
    const { lab, area } = R.labels();
    let bestC = null,
      bestA = 0;
    for (const c of placed) {
      if (c.rad < 40 || c.rad > 130) continue;
      const L = R.labelAt(lab, c.cx, c.cy);
      if (L < 1) continue;
      const a = area[L] / (S * S);
      if (a > bestA && a > 0.4 * Math.PI * c.rad * c.rad && a < 1.1 * Math.PI * c.rad * c.rad) {
        bestA = a;
        bestC = { ...c, L };
      }
    }
    if (bestC) {
      const c = bestC,
        sp2 = o.hatch.spacing || 8;
      const n = hatchRegion(
        R,
        lab,
        c.L,
        [c.cx - c.rad, c.cy - c.rad, c.cx + c.rad, c.cy + c.rad],
        sp2,
        o.hatch.angle == null ? 0.9 : o.hatch.angle,
        o.hatch.lw || 2,
        { renderOnly: true, hand: true, r },
      );
      hz.push({
        kind: 'hatch',
        spacing: sp2,
        lines: n,
        lw: o.hatch.lw || 2,
        at: [Math.round(c.cx), Math.round(c.cy)],
        rad: Math.round(c.rad),
        area: Math.round(bestA),
        pts: samplePts(R, lab, c.L),
      });
    }
  }
  // specks and faint isolated marks (render only)
  const ns = o.specks || 0;
  for (let i = 0; i < ns; i++) {
    const x = W * r(),
      y = H * r();
    R.stroke(
      [
        [x, y],
        [x + 0.5, y],
      ],
      2,
      { renderOnly: true },
    );
  }
  if (ns) hz.push({ kind: 'specks', n: ns, px: 2 });
  const fm = o.faintMarks || [];
  for (const f of fm) {
    let cx, cy;
    for (let t = 0; t < 20; t++) {
      cx = W * (0.1 + 0.8 * r());
      cy = H * (0.1 + 0.8 * r());
      if (!env || env.sdf(cx, cy) < -40) break;
    }
    if (f.shape === 'swirl') {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * TAU * 1.6,
          rr = f.size * (k / 40);
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      R.stroke(hand(r, pts, { amp: 0.4 }), f.lw || 2.5, { renderOnly: true, grey: f.grey });
    } else if (f.shape === 'dash')
      R.stroke(
        hand(
          r,
          [
            [cx - f.size, cy],
            [cx + f.size, cy + 6],
          ],
          { amp: 0.4 },
        ),
        f.lw || 2.5,
        { renderOnly: true, grey: f.grey },
      );
    else if (f.shape === 'loop')
      R.stroke(hand(r, circle(cx, cy, f.size), { amp: 0.4 }), f.lw || 2.5, {
        renderOnly: true,
        grey: f.grey,
      });
    else if (f.shape === 'smudge') {
      const b = blob(r, cx, cy, f.size, 0.25);
      for (let k = 0; k < 4; k++)
        R.fillPoly(
          b.map((p) => [cx + (p[0] - cx) * (1 - k * 0.22), cy + (p[1] - cy) * (1 - k * 0.22)]),
          { renderOnly: true, grey: 255 - (255 - f.grey) * (0.4 + 0.2 * k) },
        );
    } else if (f.shape === 'dots')
      for (let k = 0; k < 7; k++) {
        const x = cx + (r() - 0.5) * f.size * 2,
          y = cy + (r() - 0.5) * f.size * 2;
        R.stroke(
          [
            [x, y],
            [x + 0.5, y],
          ],
          3,
          { renderOnly: true, grey: f.grey },
        );
      }
    hz.push({
      kind: 'faintMark',
      shape: f.shape,
      grey: f.grey,
      size: f.size,
      at: [Math.round(cx), Math.round(cy)],
    });
  }
  if (!m) hz.push({ kind: 'edgeToEdge' });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ mandala
export function mandala(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 2.6;
  const cx = W / 2,
    cy = o.cy || H / 2,
    Rmax = o.Rmax || Math.min(W, H) * 0.45,
    hz = R.hazards,
    sc = Rmax / 540;
  R.envelope = sdfCircle(cx, cy, Rmax + lw);
  R.marginRule = o.frame ? 'corners' : 'envelope';
  const st = (pts, w) => R.stroke(o.hand ? hand(r, pts, { amp: 0.5, wv: 0.15 }) : pts, w || lw);
  const dot = (x, y, rad) => R.fillPoly(circle(x, y, rad, 20));
  // centre
  let rad = Rmax * 0.045;
  st(circle(cx, cy, rad));
  dot(cx, cy, rad * 0.35);
  const n0 = 8;
  for (let k = 0; k < n0; k++) {
    const p = polar(cx, cy, rad * 1.7, (k / n0) * TAU);
    dot(p[0], p[1], rad * 0.22);
  }
  rad *= 2.4;
  st(circle(cx, cy, rad));
  const types = o.types || [
    'petal',
    'scallop',
    'petal',
    'lace',
    'petal',
    'spokes',
    'petal',
    'triangles',
    'petal',
    'scallop',
  ];
  let ring = 0,
    offset = 0;
  const drawRing = (type, r0, r1) => {
    const th = r1 - r0;
    let n = Math.max(
      6,
      Math.round(
        (TAU * (r0 + r1)) /
          2 /
          (type === 'petal'
            ? (70 + 20 * r()) * sc
            : type === 'lace'
              ? 1.9 * th
              : type === 'scallop'
                ? 2.1 * th
                : 46 * sc),
      ),
    );
    if (type === 'petal' && n % 2) n++;
    const da = TAU / n,
      a0 = offset * da;
    if (type === 'petal') {
      const inner = r() < 0.7,
        fat = 0.75 + 0.2 * r(),
        pointed = r() < 0.4;
      for (let k = 0; k < n; k++) {
        const a = a0 + k * da,
          A = polar(cx, cy, r0 + lw * 0.3, a),
          B = polar(cx, cy, r1 - lw * 0.3, a),
          L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const halfW = ((r0 + r1) / 2) * Math.sin(da / 2) * fat,
          b = halfW / L;
        if (pointed) {
          const M1 = polar(cx, cy, r0 + th * 0.55, a - da * 0.42 * fat),
            M2 = polar(cx, cy, r0 + th * 0.55, a + da * 0.42 * fat);
          st([
            ...quad(A, polar(cx, cy, r0 + th * 0.25, a - da * 0.55 * fat), M1, 10),
            ...quad(M1, polar(cx, cy, r0 + th * 0.9, a - da * 0.2), B, 10),
            ...quad(B, polar(cx, cy, r0 + th * 0.9, a + da * 0.2), M2, 10),
            ...quad(M2, polar(cx, cy, r0 + th * 0.25, a + da * 0.55 * fat), A, 10),
          ]);
        } else st(petal(A, B, b, 20));
        if (inner) {
          const A2 = polar(cx, cy, r0 + th * 0.18, a),
            B2 = polar(cx, cy, r1 - th * 0.25, a);
          st(petal(A2, B2, b * 0.5, 16), lw * 0.85);
        } else if (th > 70 * sc) {
          const mid = polar(cx, cy, (r0 + r1) / 2, a);
          dot(mid[0], mid[1], Math.min(5 * sc, halfW * 0.25));
        }
      }
      if (r() < 0.75 || r1 >= Rmax - 1) st(circle(cx, cy, r1));
    } else if (type === 'scallop') {
      st(circle(cx, cy, r0));
      for (let k = 0; k < n; k++) {
        const P0 = polar(cx, cy, r0, a0 + k * da),
          P1 = polar(cx, cy, r0, a0 + (k + 1) * da),
          M = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2];
        const rr = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) / 2,
          t0 = Math.atan2(P0[1] - M[1], P0[0] - M[0]);
        let pts = arc(M[0], M[1], rr, t0, t0 - Math.PI);
        const mid = pts[pts.length >> 1];
        if (Math.hypot(mid[0] - cx, mid[1] - cy) < r0) pts = arc(M[0], M[1], rr, t0, t0 + Math.PI);
        st(pts);
      }
    } else if (type === 'lace') {
      st(circle(cx, cy, r0));
      st(circle(cx, cy, r1));
      const rm = (r0 + r1) / 2,
        rr = th / 2 - lw * 0.9;
      for (let k = 0; k < n; k++) {
        const p = polar(cx, cy, rm, a0 + k * da);
        st(circle(p[0], p[1], rr));
        if (rr > 9 * sc) dot(p[0], p[1], 2.2 * sc);
      }
    } else if (type === 'spokes') {
      st(circle(cx, cy, r0));
      st(circle(cx, cy, r1));
      for (let k = 0; k < n; k++) {
        const a = a0 + k * da;
        st([polar(cx, cy, r0, a), polar(cx, cy, r1, a)]);
        if (k % 2 === 0) {
          const q = polar(cx, cy, (r0 + r1) / 2, a + da / 2);
          st(circle(q[0], q[1], Math.min(th * 0.3, 10 * sc)));
        }
      }
    } else if (type === 'triangles') {
      st(circle(cx, cy, r0));
      st(circle(cx, cy, r1));
      const zz = [];
      for (let k = 0; k <= n; k++) {
        zz.push(polar(cx, cy, r0, a0 + k * da));
        zz.push(polar(cx, cy, r1, a0 + (k + 0.5) * da));
      }
      zz.pop();
      st(zz);
    }
    offset += 0.5;
  };
  while (rad < Rmax - 2 && ring < types.length) {
    const type = types[ring],
      left = Rmax - rad;
    let th =
      type === 'petal'
        ? Rmax * (0.11 + 0.08 * r())
        : type === 'scallop'
          ? Rmax * 0.045
          : type === 'lace'
            ? Rmax * 0.07
            : Rmax * 0.08;
    if (left - th < Rmax * 0.07) {
      if (type === 'petal' || left < Rmax * 0.12) th = left;
      else {
        drawRing('petal', rad, Rmax);
        rad = Rmax;
        break;
      }
    }
    drawRing(type, rad, rad + th);
    rad += th;
    ring++;
  }
  if (rad < Rmax - 2) {
    drawRing('petal', rad, Rmax);
    rad = Rmax;
  }
  st(circle(cx, cy, Rmax));
  if (o.frame) {
    const f = o.frame,
      m = f.margin,
      g = f.gap || 10,
      w1 = f.lw || lw * 1.3;
    R.stroke(
      [
        [m, m],
        [W - m, m],
        [W - m, H - m],
        [m, H - m],
        [m, m],
      ],
      w1,
    );
    R.stroke(
      [
        [m + g, m + g],
        [W - m - g, m + g],
        [W - m - g, H - m - g],
        [m + g, H - m - g],
        [m + g, m + g],
      ],
      lw * 0.8,
    );
    R.frameBox = { x0: m + g + lw, y0: m + g + lw, x1: W - m - g, y1: H - m - g };
    // corner florets just inside the frame
    for (const [sx, sy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const ox = sx ? W - m - g : m + g,
        oy = sy ? H - m - g : m + g,
        dx = sx ? -1 : 1,
        dy = sy ? -1 : 1,
        s = f.ornament || 30;
      const c = [ox + dx * s * 1.5, oy + dy * s * 1.5];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        R.stroke(petal(polar(c[0], c[1], s * 0.25, a), polar(c[0], c[1], s, a), 0.3, 14), lw * 0.9);
      }
      R.stroke(circle(c[0], c[1], s * 0.25), lw * 0.9);
      dot(c[0], c[1], s * 0.08);
      R.stroke(
        arc(
          ox,
          oy,
          s * 2.6,
          sx ? (sy ? Math.PI : Math.PI / 2) : sy ? 1.5 * Math.PI : 0,
          sx ? (sy ? 1.5 * Math.PI : Math.PI) : sy ? TAU : Math.PI / 2,
          24,
        ),
        lw * 0.8,
      );
    }
    hz.push({ kind: 'frame', double: true, ornaments: 4 });
  }
  hz.push({ kind: 'thinLines', lw });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ geometric tessellation (hex + star / rosette)
export function tessellation(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 2.6,
    m = o.margin || 80;
  const env = sdfRoundRect(m, m, W - m, H - m, 0.01);
  R.envelope = env;
  R.marginRule = 'corners';
  R.stroke(
    [
      [m, m],
      [W - m, m],
      [W - m, H - m],
      [m, H - m],
      [m, m],
    ],
    lw * 1.4,
  );
  const Rh = o.hex || 76,
    dx = Rh * 1.5,
    dy = Rh * Math.sqrt(3),
    seen = new Set();
  const seg = (a, b, w) => {
    for (const pc of clipTo(env, [a, b], () => 0)) R.stroke(pc, w || lw);
  };
  let cells = 0;
  for (let col = -1; m + col * dx < W + Rh; col++)
    for (let row = -1; m + row * dy < H + dy; row++) {
      const cx = m + col * dx,
        cy = m + row * dy + (((col % 2) + 2) % 2 ? dy / 2 : 0);
      if (cx < m - Rh || cx > W - m + Rh || cy < m - Rh || cy > H - m + Rh) continue;
      const V = [];
      for (let k = 0; k < 6; k++) V.push(polar(cx, cy, Rh, (k / 6) * TAU));
      for (let k = 0; k < 6; k++) {
        const a = V[k],
          b = V[(k + 1) % 6],
          key = [a, b]
            .map((p) => Math.round(p[0]) + ',' + Math.round(p[1]))
            .sort()
            .join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        seg(a, b);
      }
      const motif = ((((col % 2) + 2) % 2) + (((row % 2) + 2) % 2)) % 2;
      if (motif === 0) {
        const Mv = [];
        for (let k = 0; k < 6; k++) Mv.push(polar(cx, cy, Rh * 0.78, ((k + 0.5) / 6) * TAU));
        for (let k = 0; k < 6; k++) seg(Mv[k], Mv[(k + 2) % 6], lw * 0.85);
        if (env.sdf(cx, cy) < -Rh * 0.5)
          for (const pc of clipTo(env, circle(cx, cy, Rh * 0.22), () => 0)) R.stroke(pc, lw * 0.85);
      } else {
        // rosette: 6 petals from the centre to the vertices
        for (let k = 0; k < 6; k++)
          for (const pc of clipTo(
            env,
            petal(polar(cx, cy, Rh * 0.12, (k / 6) * TAU), polar(cx, cy, Rh * 0.92, (k / 6) * TAU), 0.3, 14),
            () => 0,
          ))
            R.stroke(pc, lw * 0.85);
        for (const pc of clipTo(env, circle(cx, cy, Rh * 0.12), () => 0)) R.stroke(pc, lw * 0.85);
      }
      if (env.sdf(cx, cy) < -Rh * 0.5) cells++;
    }
  R.hazards.push({ kind: 'frame' }, { kind: 'geometric', hexes: cells, lw });
  R.lw = lw;
  return { R };
}

// ------------------------------------------------------------------ dense Voronoi mosaic (2,000+ cells) with a motif
export function mosaic(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 2.2,
    m = o.margin || 70,
    p = o.pitch || 25;
  const env = sdfRoundRect(m, m, W - m, H - m, 0.01);
  R.envelope = env;
  R.marginRule = 'corners';
  R.stroke(
    [
      [m, m],
      [W - m, m],
      [W - m, H - m],
      [m, H - m],
      [m, m],
    ],
    lw * 1.8,
  );
  const nx = Math.ceil((W - 2 * m) / p) + 2,
    ny = Math.ceil((H - 2 * m) / p) + 2,
    pts = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      pts.push([m - p + (i + 0.5 + (r() - 0.5) * 0.9) * p, m - p + (j + 0.5 + (r() - 0.5) * 0.9) * p]);
  const idx = (i, j) => j * nx + i,
    seen = new Set();
  let cells = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const c = pts[idx(i, j)];
      let poly = [
        [c[0] - 3 * p, c[1] - 3 * p],
        [c[0] + 3 * p, c[1] - 3 * p],
        [c[0] + 3 * p, c[1] + 3 * p],
        [c[0] - 3 * p, c[1] + 3 * p],
      ];
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          if (!di && !dj) continue;
          const ii = i + di,
            jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const q = pts[idx(ii, jj)],
            mx = (c[0] + q[0]) / 2,
            my = (c[1] + q[1]) / 2,
            ax = q[0] - c[0],
            ay = q[1] - c[1];
          const out = [];
          for (let k = 0; k < poly.length; k++) {
            const A = poly[k],
              B = poly[(k + 1) % poly.length],
              da = (A[0] - mx) * ax + (A[1] - my) * ay,
              db = (B[0] - mx) * ax + (B[1] - my) * ay;
            if (da <= 0) out.push(A);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
              const t = da / (da - db);
              out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
            }
          }
          poly = out;
          if (poly.length < 3) break;
        }
      if (poly.length < 3) continue;
      if (env.sdf(c[0], c[1]) < 0) cells++;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k],
          b = poly[(k + 1) % poly.length],
          key = [a, b]
            .map((q) => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2))
            .sort()
            .join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        for (const pc of clipTo(env, [a, b], () => 0)) R.stroke(pc, lw);
      }
    }
  // motif drawn over the mosaic with a heavier line: a big circle with a 6-petal flower and a heart
  const cx = W / 2,
    cy = H * 0.42,
    Rm = W * 0.33,
    wl = lw * 2.4;
  R.stroke(circle(cx, cy, Rm), wl);
  R.stroke(circle(cx, cy, Rm * 0.82), wl * 0.8);
  for (let k = 0; k < 6; k++)
    R.stroke(
      petal(polar(cx, cy, Rm * 0.08, (k / 6) * TAU), polar(cx, cy, Rm * 0.78, (k / 6) * TAU), 0.33, 24),
      wl * 0.8,
    );
  R.stroke(circle(cx, cy, Rm * 0.08), wl * 0.8);
  const hx = W / 2,
    hy = H * 0.84,
    hs = 120,
    hp = [];
  for (let k = 0; k <= 60; k++) {
    const t = (k / 60) * TAU;
    hp.push([
      hx + hs * Math.pow(Math.sin(t), 3),
      hy - (hs / 16) * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  R.stroke(hp, wl);
  R.hazards.push(
    { kind: 'frame' },
    { kind: 'dense', cellsApprox: cells, pitch: p, lw },
    { kind: 'mixedWidths', lw: [lw, +wl.toFixed(1)] },
  );
  R.lw = lw;
  return { R };
}

// ------------------------------------------------------------------ zentangle: strings + patterns per patch
export function zentangle(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 2.8,
    m = o.margin || 90,
    hz = R.hazards;
  const env = sdfRoundRect(m, m, W - m, H - m, 0.01);
  R.envelope = env;
  R.marginRule = 'corners';
  const sp = new Spread(W, H);
  R.stroke(
    hand(
      r,
      [
        [m, m],
        [W - m, m],
        [W - m, H - m],
        [m, H - m],
        [m, m],
      ],
      { amp: 0.6, wv: 0.15 },
    ),
    lw * 1.2,
  );
  const box = [m - 4, m - 4, W - m + 4, H - m + 4];
  for (let i = 0; i < (o.strings || 7); i++) {
    const hp = hand(
      r,
      sp.best(r, () => flowLine(r, box, { swing: 0.3, inset: 0.08 })),
      { amp: 1.0, wv: 0.2 },
    );
    for (const pc of clipTo(env, hp, () => 2 + 3 * r())) {
      R.stroke(pc, lw * 1.1);
      sp.add(pc);
    }
  }
  for (let i = 0; i < 3; i++) {
    const rad = 70 + 90 * r(),
      cx = m + rad + (W - 2 * m - 2 * rad) * r(),
      cy = m + rad + (H - 2 * m - 2 * rad) * r();
    R.stroke(hand(r, circle(cx, cy, rad), { amp: 0.7 }), lw * 1.1);
  }
  R.roundJunctions(r, { k: 0.3, reach: 1.5, fillet: 0.6 });
  const { lab, area } = R.labels(),
    regions = [];
  for (let L = 1; L < area.length; L++) {
    const a = area[L] / (S * S);
    if (a < 2500) continue;
    const bb = R.bboxLabel(lab, L);
    if (!bb || bb[0] < m - 5 || bb[1] < m - 5) continue;
    regions.push({ L, a, bb });
  }
  regions.sort((a, b) => b.a - a.a);
  const big = ['empty', 'scales', 'pebbles', 'empty'],
    plan = o.plan || [
      'hatch',
      'grid',
      'waves',
      'crosshatch',
      'solid',
      'dots',
      'hatchClose',
      'scales',
      'pebbles',
      'hatch',
      'empty',
      'grid',
      'waves',
    ];
  let bi = 0,
    pi = 0;
  regions.forEach((rg) => {
    const t = rg.a > 140000 ? big[bi++ % big.length] : plan[pi++ % plan.length],
      { L, bb } = rg;
    if (t === 'hatch') {
      const s = 7 + 3 * r(),
        ang = r() * Math.PI,
        n = hatchRegion(R, lab, L, bb, s, ang, 1.8, { renderOnly: true, hand: true, r });
      hz.push({
        kind: 'hatch',
        spacing: +s.toFixed(1),
        lines: n,
        lw: 1.8,
        area: Math.round(rg.a),
        pts: samplePts(R, lab, L),
      });
    } else if (t === 'hatchClose') {
      const s = 4.5,
        n = hatchRegion(R, lab, L, bb, s, 0.3 + r(), 1.6, { renderOnly: true, hand: true, r });
      hz.push({
        kind: 'hatch',
        spacing: s,
        lines: n,
        lw: 1.6,
        area: Math.round(rg.a),
        note: 'close',
        pts: samplePts(R, lab, L),
      });
    } else if (t === 'crosshatch') {
      const s = 9,
        n =
          hatchRegion(R, lab, L, bb, s, 0.7, 1.6, { renderOnly: true, hand: true, r }) +
          hatchRegion(R, lab, L, bb, s, 0.7 + Math.PI / 2, 1.6, { renderOnly: true, hand: true, r });
      hz.push({
        kind: 'hatch',
        spacing: s,
        lines: n,
        lw: 1.6,
        area: Math.round(rg.a),
        note: 'cross',
        pts: samplePts(R, lab, L),
      });
    } else if (t === 'scales') scalesRegion(R, lab, L, bb, 24 + 12 * r(), lw * 0.8);
    else if (t === 'pebbles') circlesRegion(R, r, lab, L, bb, 8, 26, lw * 0.8);
    else if (t === 'grid') gridRegion(R, lab, L, bb, 22, Math.PI / 4 + (r() - 0.5) * 0.4, lw * 0.75);
    else if (t === 'waves') {
      const n = hatchRegion(R, lab, L, bb, 14, r() * 0.5 - 0.25, lw * 0.8, {
        renderOnly: false,
        hand: true,
        r,
      });
      hz.push({ kind: 'parallel', spacing: 14, lines: n, note: 'wavy stripes (real sections)' });
    } else if (t === 'solid') {
      const a = R.fillLabel(lab, L);
      hz.push({ kind: 'solidFill', area: Math.round(a) });
    } else if (t === 'dots') {
      const n = dotsRegion(R, r, lab, L, bb, Math.round(rg.a / 180), 3);
      hz.push({ kind: 'stipple', n, px: 3, note: 'stipple patch', pts: samplePts(R, lab, L) });
    }
  });
  hz.push({ kind: 'frame' }, { kind: 'thinLines', lw: 1.6 });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ botanical fine-line spray
export function botanical(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 1.9;
  R.marginRule = 'corners';
  const hp = (pts, a = 0.35) => hand(r, pts, { amp: a, wv: 0.18, wspread: 0.1 });
  const leaf = (base, dir, len, wid, w) => {
    const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    R.stroke(hp(petal(base, tip, wid, 22)), w || lw);
    const mid = [base[0] + dir[0] * len * 0.82, base[1] + dir[1] * len * 0.82];
    R.stroke(hp([base, mid]), lw * 0.8);
    const n = norm([-dir[1], dir[0]]),
      k = 3 + ((r() * 3) | 0);
    for (let i = 1; i <= k; i++) {
      const t = (i / (k + 1)) * 0.8,
        p = [base[0] + dir[0] * len * t, base[1] + dir[1] * len * t],
        vl = wid * len * 0.9 * Math.sin(Math.PI * Math.min(1, t / 0.8 + 0.1));
      for (const s of [1, -1])
        R.stroke(
          hp(
            [p, [p[0] + (dir[0] * 0.5 + n[0] * s) * vl * 0.7, p[1] + (dir[1] * 0.5 + n[1] * s) * vl * 0.7]],
            0.2,
          ),
          lw * 0.7,
        );
    }
  };
  const flower = (c, rad, n, w) => {
    R.stroke(hp(circle(c[0], c[1], rad * 0.28)), w);
    for (let k = 0; k < 9; k++) {
      const p = polar(c[0], c[1], rad * 0.17 * r(), r() * TAU);
      R.fillPoly(circle(p[0], p[1], 2.2, 10));
    }
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + r() * 0.1,
        A = polar(c[0], c[1], rad * 0.28, a),
        B = polar(c[0], c[1], rad, a),
        halfW = rad * 0.64 * Math.sin(Math.PI / n) * 0.95;
      R.stroke(hp(petal(A, B, halfW / (rad * 0.72), 18)), w);
      const Bm = polar(c[0], c[1], rad * 0.75, a);
      R.stroke(hp([polar(c[0], c[1], rad * 0.36, a), Bm]), lw * 0.7);
    }
  };
  const bell = (c, size, ang) => {
    const d = [Math.cos(ang), Math.sin(ang)],
      n = [-d[1], d[0]],
      P = (u, v) => [c[0] + d[0] * u * size + n[0] * v * size, c[1] + d[1] * u * size + n[1] * v * size];
    R.stroke(
      hp([
        P(0, -0.12),
        P(0.5, -0.4),
        P(0.85, -0.5),
        P(1, -0.3),
        P(1.05, 0),
        P(1, 0.3),
        P(0.85, 0.5),
        P(0.5, 0.4),
        P(0, 0.12),
        P(0, -0.12),
      ]),
      lw,
    );
    R.stroke(hp([P(0.1, 0), P(0.75, 0)]), lw * 0.7);
  };
  const stems = o.stems || 4;
  for (let s = 0; s < stems; s++) {
    const x0 = W * (0.32 + 0.36 * r()),
      top = H * (0.1 + 0.22 * r()),
      xt = W * (0.12 + 0.76 * r());
    const ctrl = [
      [x0, H * 0.92],
      [x0 + (xt - x0) * 0.3 + (r() - 0.5) * 240, H * 0.72],
      [x0 + (xt - x0) * 0.65 + (r() - 0.5) * 240, H * 0.45],
      [xt, top],
    ];
    const stem = catmull(ctrl, 40);
    R.stroke(hp(stem, 0.5), lw * 1.2);
    const nl = 5 + ((r() * 4) | 0);
    for (let i = 0; i < nl; i++) {
      const t = 0.12 + (0.78 * i) / nl + r() * 0.05,
        { p, d } = along(stem, t),
        side = i % 2 ? 1 : -1,
        ang = Math.atan2(d[1], d[0]) + side * (0.7 + 0.4 * r());
      leaf(p, [Math.cos(ang), Math.sin(ang)], 90 + 80 * r(), 0.26 + 0.1 * r());
    }
    const kind = r();
    if (kind < 0.5) flower([xt, top], 85 + 45 * r(), 7 + ((r() * 5) | 0), lw);
    else if (kind < 0.8) {
      const { d } = along(stem, 0.98);
      bell([xt, top], 70 + 30 * r(), Math.atan2(d[1], d[0]));
      for (const sgn of [-1, 1]) {
        const { p, d: d2 } = along(stem, 0.9);
        const a = Math.atan2(d2[1], d2[0]) + sgn * 0.9;
        bell(p, 45 + 20 * r(), a);
      }
    } else {
      for (let k = 0; k < 6; k++) {
        const p = [xt + (r() - 0.5) * 70, top + (r() - 0.5) * 70];
        R.stroke(hp(circle(p[0], p[1], 10 + 7 * r())), lw);
        R.stroke(hp([[xt, top + 36], p]), lw * 0.8);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = W * (0.12 + 0.76 * r()),
      y = H * (0.5 + 0.4 * r());
    const pts = catmull(
      [
        [x, y],
        [x + 50, y - 70],
        [x + 60, y - 170],
      ],
      20,
    );
    R.stroke(hp(pts), lw);
    for (let k = 0; k < 5; k++) {
      const { p, d } = along(pts, 0.25 + 0.17 * k),
        n = [-d[1], d[0]];
      const side = k % 2 ? 1 : -1,
        q = [p[0] + n[0] * side * 26, p[1] + n[1] * side * 26];
      R.stroke(hp([p, q]), lw * 0.8);
      R.stroke(hp(circle(q[0], q[1], 8 + 4 * r())), lw);
    }
  }
  R.hazards.push(
    { kind: 'thinLines', lw },
    { kind: 'floating', note: 'no frame: paper around the drawing is the margin' },
  );
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ cartoon scene with thick outlines
export function cartoon(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 9,
    m = o.margin || 60,
    hz = R.hazards;
  const env = sdfRoundRect(m, m, W - m, H - m, 30);
  R.envelope = env;
  R.marginRule = 'corners';
  const hp = (pts, a = 0.4) => hand(r, pts, { amp: a, wv: 0.12, wspread: 0.05 });
  R.stroke(roundRectPts(m, m, W - m, H - m, 30), lw * 1.1);
  const horizon = H * 0.62;
  const hx = W * 0.58,
    hy = horizon - 20,
    hw = 240,
    hh = 200,
    tx = W * 0.22,
    ty = horizon + 10;
  const housePoly = [
    [hx - hw / 2, hy],
    [hx + hw / 2, hy],
    [hx + hw / 2, hy - hh],
    [hx + hw / 2 + 30, hy - hh],
    [hx, hy - hh - 130],
    [hx - hw / 2 - 30, hy - hh],
    [hx - hw / 2, hy - hh],
  ];
  const trunkPoly = [
    [tx - 24, ty + 34],
    [tx + 24, ty + 34],
    [tx + 20, ty - 160],
    [tx - 20, ty - 160],
  ];
  const hillEnv = sdfAnd(sdfAnd(env, sdfNot(sdfPoly(housePoly))), sdfNot(sdfPoly(trunkPoly)));
  for (const pc of clipTo(
    hillEnv,
    catmull(
      [
        [m - 20, horizon + 80],
        [W * 0.25, horizon - 90],
        [W * 0.5, horizon + 20],
        [W * 0.75, horizon - 60],
        [W - m + 20, horizon + 40],
      ],
      40,
    ),
    () => 3,
  ))
    R.stroke(hp(pc), lw);
  for (const pc of clipTo(
    env,
    catmull(
      [
        [m - 20, horizon + 260],
        [W * 0.3, horizon + 180],
        [W * 0.6, horizon + 300],
        [W - m + 20, horizon + 220],
      ],
      40,
    ),
    () => 3,
  ))
    R.stroke(hp(pc), lw);
  // sun with triangle rays and a face
  const sx = W * 0.2,
    sy = H * 0.18,
    sr = 85;
  R.stroke(hp(circle(sx, sy, sr)), lw);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU,
      A = polar(sx, sy, sr + 6, a - 0.11),
      B = polar(sx, sy, sr + 6, a + 0.11),
      T = polar(sx, sy, sr + 55, a);
    R.stroke(hp([A, T, B]), lw * 0.75);
  }
  for (const s of [-1, 1]) R.fillPoly(circle(sx + s * 28, sy - 12, 7, 16));
  R.stroke(hp(arc(sx, sy - 5, 42, 0.3, Math.PI - 0.3)), lw * 0.7);
  // clouds
  R.stroke(hp(scallop(W * 0.62, H * 0.15, 120, 55, 9, 0.6)), lw);
  R.stroke(hp(scallop(W * 0.82, H * 0.3, 80, 38, 7, 0.6)), lw * 0.9);
  // house
  R.stroke(
    hp([
      [hx - hw / 2, hy],
      [hx + hw / 2, hy],
      [hx + hw / 2, hy - hh],
      [hx - hw / 2, hy - hh],
      [hx - hw / 2, hy],
    ]),
    lw,
  );
  R.stroke(
    hp([
      [hx - hw / 2 - 30, hy - hh],
      [hx, hy - hh - 130],
      [hx + hw / 2 + 30, hy - hh],
      [hx - hw / 2 - 30, hy - hh],
    ]),
    lw,
  );
  R.stroke(
    hp([
      [hx + 60, hy - hh - 50],
      [hx + 60, hy - hh - 110],
      [hx + 95, hy - hh - 110],
      [hx + 95, hy - hh - 32],
    ]),
    lw * 0.8,
  );
  R.stroke(
    hp([[hx - 30, hy], [hx - 30, hy - 100], ...arc(hx, hy - 100, 30, Math.PI, TAU, 14), [hx + 30, hy]]),
    lw * 0.8,
  );
  R.fillPoly(circle(hx + 18, hy - 50, 5, 12));
  for (const wx of [hx - 85, hx + 85]) {
    const w2 = 32,
      wy = hy - 130;
    R.stroke(
      hp([
        [wx - w2, wy - w2],
        [wx + w2, wy - w2],
        [wx + w2, wy + w2],
        [wx - w2, wy + w2],
        [wx - w2, wy - w2],
      ]),
      lw * 0.8,
    );
    R.stroke(
      hp([
        [wx, wy - w2],
        [wx, wy + w2],
      ]),
      lw * 0.6,
    );
    R.stroke(
      hp([
        [wx - w2, wy],
        [wx + w2, wy],
      ]),
      lw * 0.6,
    );
  }
  // tree
  R.stroke(
    hp([
      [tx - 22, ty + 30],
      [tx - 18, ty - 160],
      [tx - 40, ty - 230],
    ]),
    lw,
  );
  R.stroke(
    hp([
      [tx + 22, ty + 30],
      [tx + 18, ty - 160],
      [tx + 45, ty - 230],
    ]),
    lw,
  );
  R.stroke(hp(arc(tx, ty + 30, 22, 0, Math.PI)), lw * 0.8);
  R.stroke(hp(scallop(tx, ty - 300, 130, 110, 12, 0.5)), lw);
  // flowers in the foreground
  for (let i = 0; i < 4; i++) {
    const fx = W * (0.12 + 0.76 * (i / 3)) + (r() - 0.5) * 60,
      fy = H * 0.84 + (r() - 0.5) * 60,
      fr = 26 + 8 * r();
    R.stroke(
      hp([
        [fx, fy + fr * 1.6],
        [fx + 8, fy + 150],
      ]),
      lw * 0.8,
    );
    R.stroke(hp(petal([fx + 4, fy + 90], [fx + 60, fy + 70], 0.3, 14)), lw * 0.8);
    for (let k = 0; k < 6; k++) {
      const p = polar(fx, fy, fr * 1.25, (k / 6) * TAU);
      R.stroke(hp(circle(p[0], p[1], fr * 0.75)), lw * 0.8);
    }
    R.stroke(hp(circle(fx, fy, fr * 0.7)), lw * 0.8);
  }
  // grass blades (curved open strokes) and a butterfly
  for (let i = 0; i < 16; i++) {
    const gx = m + 30 + (W - 2 * m - 60) * r(),
      gy = H * (0.7 + 0.22 * r());
    for (const s of [-1, 0, 1])
      R.stroke(
        hp(quad([gx + s * 6, gy], [gx + s * 14, gy - 18], [gx + s * 30, gy - 34 - 10 * r()], 8)),
        lw * 0.55,
      );
  }
  const bx = W * 0.85,
    by = H * 0.5;
  R.stroke(hp(ellipse(bx, by, 9, 28)), lw * 0.7);
  for (const s of [-1, 1]) {
    R.stroke(hp(ellipse(bx + s * 30, by - 18, 24, 20, s * 0.4)), lw * 0.8);
    R.stroke(hp(ellipse(bx + s * 26, by + 20, 20, 16, -s * 0.3)), lw * 0.8);
    R.stroke(
      hp([
        [bx, by - 28],
        [bx + s * 14, by - 50],
      ]),
      lw * 0.6,
    );
  }
  hz.push(
    { kind: 'thickLines', lw },
    { kind: 'solidFill', n: 3, note: 'eyes, door knob' },
    { kind: 'frame' },
  );
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ stained glass: thick leading, solid black pieces
export function stainedGlass(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 12,
    m = o.margin || 110,
    hz = R.hazards;
  R.marginRule = 'corners';
  const cx = W / 2,
    top = m + (W / 2 - m),
    rad = W / 2 - m;
  const outline = [[m, H - m], [m, top], ...arc(cx, top, rad, Math.PI, TAU, 60), [W - m, H - m], [m, H - m]];
  const env = {
    sdf: (x, y) =>
      y < top ? Math.hypot(x - cx, y - top) - rad : Math.max(Math.abs(x - cx) - rad, y - (H - m)),
  };
  R.envelope = env;
  R.stroke(outline, lw * 1.3);
  const b = 44,
    inner = [
      [m + b, H - m - b],
      [m + b, top],
      ...arc(cx, top, rad - b, Math.PI, TAU, 60),
      [W - m - b, H - m - b],
      [m + b, H - m - b],
    ];
  R.stroke(inner, lw * 0.8);
  const per = resample(inner, 1),
    step = 72;
  for (let i = step; i < per.length - 10; i += step) {
    const p = per[i];
    let q;
    if (p[1] < top - 1) q = polar(cx, top, rad + 2, Math.atan2(p[1] - top, p[0] - cx));
    else if (p[1] > H - m - b - 1) q = [p[0], H - m + 2];
    else q = [p[0] < cx ? m - 2 : W - m + 2, p[1]];
    R.stroke([p, q], lw * 0.7);
  }
  // rose: a circle with spokes and an inner ring
  const ry = top + 40,
    rr = rad * 0.42;
  R.stroke(circle(cx, ry, rr), lw);
  R.stroke(circle(cx, ry, rr * 0.45), lw * 0.8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    R.stroke([polar(cx, ry, rr * 0.45, a), polar(cx, ry, rr, a)], lw * 0.8);
  }
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * TAU,
      A = polar(cx, ry, rr * 0.45, a),
      B = polar(cx, ry, rr * 0.98, a);
    R.stroke(petal(A, B, 0.22, 16), lw * 0.7);
  }
  // field: flowing leading lines entering from outside the window, clipped to the border and the rose; plus circles
  const fieldEnv = { sdf: (x, y) => Math.max(env.sdf(x, y) + b, -(Math.hypot(x - cx, y - ry) - rr)) };
  const sp = new Spread(W, H),
    pageBox = [m + b - 60, ry - rr, W - m - b + 60, H - m + 40];
  for (let i = 0; i < 9; i++) {
    const pts = sp.best(r, () => flowLine(r, pageBox, { swing: 0.25, sides: [1, 2, 3] }));
    for (const pc of clipTo(fieldEnv, pts, () => 2)) {
      R.stroke(pc, lw * 0.85);
      sp.add(pc);
    }
  }
  for (const a of [Math.PI * 0.62, Math.PI * 0.38]) {
    const A = polar(cx, ry, rr, a),
      B = [A[0] + (A[0] - cx) * 1.6, H - m + 4];
    for (const pc of clipTo(
      fieldEnv,
      catmull([A, [(A[0] + B[0]) / 2 + (r() - 0.5) * 80, (A[1] + B[1]) / 2], B], 30),
      () => 2,
    ))
      R.stroke(pc, lw * 0.85);
  }
  for (let i = 0; i < 5; i++) {
    const R2 = 50 + 60 * r(),
      x = m + b + R2 + (W - 2 * m - 2 * b - 2 * R2) * r(),
      y = ry + rr + R2 + (H - m - b - ry - rr - 2 * R2) * r();
    for (const pc of clipTo(fieldEnv, circle(x, y, R2), () => 0)) R.stroke(pc, lw * 0.85);
  }
  // solid black pieces: some border cells and a few field pieces
  const { lab, area } = R.labels();
  const S2 = S * S;
  const cands = [];
  for (let L = 1; L < area.length; L++) {
    const a = area[L] / S2;
    if (a > 600 && a < 12000) cands.push(L);
  }
  let nFill = 0,
    fillArea = 0;
  for (let i = 0; i < cands.length && nFill < (o.fills || 9); i++) {
    if (r() < 0.22) {
      fillArea += R.fillLabel(lab, cands[i]);
      nFill++;
    }
  }
  hz.push({ kind: 'solidFill', n: nFill, area: Math.round(fillArea) }, { kind: 'thickLines', lw });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ wave bands: close parallel lines
export function waveBands(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 2,
    m = o.margin || 70,
    hz = R.hazards;
  const env = sdfRoundRect(m, m, W - m, H - m, 0.01);
  R.envelope = env;
  R.marginRule = 'corners';
  R.stroke(
    [
      [m, m],
      [W - m, m],
      [W - m, H - m],
      [m, H - m],
      [m, m],
    ],
    lw * 1.6,
  );
  const bands = o.bands || [
    { gap: 2, n: 9 },
    { gap: 3, n: 8 },
    { gap: 5, n: 7 },
    { gap: 8, n: 6 },
    { gap: 12, n: 6 },
    { gap: 18, n: 5 },
    { gap: 3, n: 7 },
    { gap: 26, n: 4 },
  ];
  const ys = bands.map((_, i) => m + 70 + ((H - 2 * m - 140) * i) / (bands.length - 1));
  bands.forEach((bd, i) => {
    const ctrl = [];
    for (let k = 0; k <= 6; k++) ctrl.push([m - 30 + ((W - 2 * m + 60) * k) / 6, ys[i] + (r() - 0.5) * 150]);
    const base = catmull(ctrl, 40),
      spacing = lw + bd.gap;
    for (let j = 0; j < bd.n; j++) {
      const off = (j - (bd.n - 1) / 2) * spacing;
      const pts = base.map((p, q) => {
        const a = base[Math.max(0, q - 1)],
          b2 = base[Math.min(base.length - 1, q + 1)],
          d = norm([b2[0] - a[0], b2[1] - a[1]]);
        return [p[0] - d[1] * off, p[1] + d[0] * off];
      });
      for (const pc of clipTo(env, bd.gap >= 5 ? hand(r, pts, { amp: 0.3, wv: 0.1 }) : pts, () => 0))
        R.stroke(pc, lw);
    }
    hz.push({ kind: 'parallel', gap: bd.gap, lines: bd.n, lw });
  });
  // a crescent moon and stars in the open areas between bands
  R.stroke(circle(W * 0.72, (ys[1] + ys[2]) / 2, 90), lw * 1.3);
  R.stroke(circle(W * 0.72 + 34, (ys[1] + ys[2]) / 2 - 18, 78), lw * 1.3);
  for (let i = 0; i < 7; i++) {
    const k = 2 + ((r() * 5) | 0),
      x = m + 60 + (W - 2 * m - 120) * r(),
      y = (ys[k] + ys[k + 1]) / 2 + (r() - 0.5) * 30,
      s = 16 + 14 * r(),
      pts = [];
    for (let q = 0; q <= 10; q++) {
      const a = (q / 10) * TAU - Math.PI / 2,
        rr = q % 2 ? s * 0.45 : s;
      pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
    }
    R.stroke(pts, lw * 1.2);
  }
  hz.push({ kind: 'frame' }, { kind: 'thinLines', lw });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}

// ------------------------------------------------------------------ flower doodles (used with title / URL / watermark)
export function doodles(seed, o = {}) {
  const W = o.W || 1200,
    H = o.H || 1600,
    S = o.S || 3,
    r = rng(seed),
    R = new Raster(W, H, S),
    lw = o.lw || 4,
    hz = R.hazards;
  R.marginRule = 'corners';
  const hp = (pts, a = 0.8) => hand(r, pts, { amp: a, wv: 0.2 });
  const top = o.top || 220,
    bot = o.bottom || H - 170;
  const daisy = (c, rad, n) => {
    R.stroke(hp(circle(c[0], c[1], rad * 0.3)), lw);
    const halfW = rad * 0.65 * Math.sin(Math.PI / n) * 0.9,
      b = halfW / (rad * 0.7);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU,
        A = polar(c[0], c[1], rad * 0.3, a),
        B = polar(c[0], c[1], rad, a);
      R.stroke(hp(petal(A, B, b, 18)), lw);
    }
    for (let k = 0; k < 6; k++) {
      const p = polar(c[0], c[1], rad * 0.14, (k / 6) * TAU);
      R.fillPoly(circle(p[0], p[1], 2.5, 12));
    }
  };
  const flowers = o.flowers || [
    [W * 0.28, top + 240, 190, 12],
    [W * 0.72, top + 500, 150, 10],
    [W * 0.33, bot - 290, 170, 11],
    [W * 0.78, top + 150, 100, 8],
    [W * 0.8, bot - 110, 115, 9],
  ];
  for (const f of flowers) daisy([f[0], f[1]], f[2], f[3]);
  const free = (x, y, pad) => flowers.every((f) => Math.hypot(f[0] - x, f[1] - y) > f[2] + pad);
  const spot = (pad) => {
    for (let t = 0; t < 60; t++) {
      const x = W * (0.08 + 0.84 * r()),
        y = top + 60 + (bot - top - 120) * r();
      if (free(x, y, pad)) return [x, y];
    }
    return null;
  };
  for (let i = 0; i < 9; i++) {
    const s = spot(60);
    if (!s) continue;
    const [x, y] = s,
      a = r() * TAU,
      d = [Math.cos(a), Math.sin(a)],
      len = 80 + 70 * r(),
      tip = [x + d[0] * len, y + d[1] * len];
    if (!free(tip[0], tip[1], 10)) continue;
    R.stroke(hp(petal([x, y], tip, 0.28, 20)), lw);
    R.stroke(
      hp([
        [x, y],
        [x + d[0] * len * 0.8, y + d[1] * len * 0.8],
      ]),
      lw * 0.7,
    );
  }
  for (let i = 0; i < 7; i++) {
    const s0 = spot(70);
    if (!s0) continue;
    const [x, y] = s0,
      s = 25 + 30 * r(),
      pts = [];
    for (let k = 0; k <= 60; k++) {
      const a = (k / 60) * TAU * 2.2,
        rr = s * (k / 60);
      pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
    }
    R.stroke(hp(pts, 0.5), lw * 0.9);
  }
  for (let i = 0; i < 5; i++) {
    const s0 = spot(50);
    if (!s0) continue;
    const [x, y] = s0,
      s = 18 + 16 * r(),
      pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = (k / 40) * TAU;
      pts.push([
        x + s * Math.pow(Math.sin(t), 3),
        y - (s / 16) * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      ]);
    }
    R.stroke(hp(pts, 0.5), lw);
  }
  // little dots sprinkled (ink, both layers)
  for (let i = 0; i < 20; i++) {
    const s0 = spot(30);
    if (s0) R.fillPoly(circle(s0[0], s0[1], 3, 10));
  }
  hz.push({ kind: 'floating' });
  R.lw = lw;
  R.textSpecs = o.text || [];
  return { R };
}
