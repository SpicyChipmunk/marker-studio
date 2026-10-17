// The benchmark's drawing surface (scripts/bench): two layers at S× supersampling, the CLEAN drawing (what the artist
// meant as boundaries: truth is made from it) and the RENDER (what reaches the app: grey, with render-only marks such as
// hatching, text, faint stray marks, specks and the gaps a pen leaves). Hand-drawn line quality (wobble, width
// variation, rounded junctions, over/undershoot), polygon fills, region-clipped pattern fills, SDF envelopes.
// Truth, sizes and tags are made from a finished Raster in design.mjs.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const TAU = Math.PI * 2;

export class Raster {
  constructor(W, H, S) {
    this.W = W;
    this.H = H;
    this.S = S;
    this.HW = W * S;
    this.HH = H * S;
    this.clean = new Uint8Array(this.HW * this.HH);
    this.dark = new Uint8Array(this.HW * this.HH).fill(255);
    this.hazards = [];
    this.sepStrokes = [];
    this.paths = [];
    this.junctions = [];
    this.envelope = null; // {sdf(x,y)} page px, inside <= 0
    this.lw = 4; // the page's main line width (page px): truth's closing (design.mjs) is set from it
    this.textSpecs = [];
    this.marginRule = 'none';
  }
  disc(x, y, r, into, grey, clip) {
    const { HW, HH } = this;
    const x0 = Math.max(0, Math.floor(x - r)),
      x1 = Math.min(HW - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r)),
      y1 = Math.min(HH - 1, Math.ceil(y + r));
    const r2 = r * r,
      cl = this.clean,
      dk = this.dark;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - y,
        row = yy * HW;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x;
        if (dx * dx + dy * dy > r2) continue;
        const p = row + xx;
        if (clip && clip.lab[p] !== clip.L && !cl[p]) continue;
        if (into !== 'render') cl[p] = 1;
        if (into !== 'clean' && grey < dk[p]) dk[p] = grey;
      }
    }
  }
  // pts: [x,y] or [x,y,wf] (width factor). o: grey, renderOnly, cleanOnly, gaps [{at,len}], startCut, endCut (page px of
  // centre-line removed from the RENDER only), clip {lab,L}, sep (hazard record for separated pairs), noJunction
  stroke(pts, lw, o = {}) {
    if (pts.length < 2) return;
    const S = this.S,
      grey = o.grey == null ? 0 : o.grey;
    const into = o.renderOnly ? 'render' : o.cleanOnly ? 'clean' : 'both';
    const segL = [];
    let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segL.push(l);
      tot += l;
    }
    const gaps = (o.gaps || []).map((g) => ({
      a: g.at * tot - (g.len + lw) / 2,
      b: g.at * tot + (g.len + lw) / 2,
      g,
    }));
    for (const gp of gaps) {
      let d = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const L = segL[i];
        if (d + L >= gp.g.at * tot) {
          const t = (gp.g.at * tot - d) / L;
          gp.g.mid = [
            pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
            pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
          ];
          break;
        }
        d += L;
      }
    }
    const sc = o.startCut || 0,
      ec = o.endCut || 0;
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const L = segL[i],
        n = Math.max(1, Math.ceil((L * S) / 0.5));
      const w0 = pts[i][2] == null ? 1 : pts[i][2],
        w1 = pts[i + 1][2] == null ? 1 : pts[i + 1][2];
      for (let k = 0; k <= n; k++) {
        const t = k / n,
          d = acc + t * L;
        const x = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t) * S,
          y = (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t) * S;
        const r = (lw * (w0 + (w1 - w0) * t) * S) / 2;
        let cut = d < sc || d > tot - ec;
        if (!cut && gaps.length)
          for (const g of gaps)
            if (d >= g.a && d <= g.b) {
              cut = true;
              break;
            }
        if (cut) {
          if (into === 'both') this.disc(x, y, r, 'clean', 0, o.clip);
          continue;
        }
        this.disc(x, y, r, into, grey, o.clip);
      }
      acc += L;
    }
    if (o.sep) this.sepStrokes.push({ pts, lw, hazard: o.sep });
    if (!o.noJunction && into === 'both' && !o.clip)
      this.paths.push({
        pts,
        lw,
        grey,
        cutStart: sc,
        cutEnd: ec,
        tot,
        gapsD: gaps.map((g) => ({ d: g.g.at * tot, len: g.g.len })),
      });
  }
  // scanline even-odd polygon fill (page px) at hi-res
  fillPoly(poly, o = {}) {
    const S = this.S,
      HW = this.HW,
      HH = this.HH,
      grey = o.grey == null ? 0 : o.grey;
    const into = o.renderOnly ? 'render' : o.cleanOnly ? 'clean' : 'both';
    const P = poly.map((p) => [p[0] * S, p[1] * S]);
    let y0 = Infinity,
      y1 = -Infinity;
    for (const p of P) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    y0 = Math.max(0, Math.floor(y0));
    y1 = Math.min(HH - 1, Math.ceil(y1));
    const xs = [];
    for (let yy = y0; yy <= y1; yy++) {
      const y = yy + 0.5;
      xs.length = 0;
      for (let i = 0, n = P.length; i < n; i++) {
        const a = P[i],
          b = P[(i + 1) % n];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])),
          xb = Math.min(HW - 1, Math.round(xs[k + 1]) - 1);
        for (let xx = xa; xx <= xb; xx++) {
          const p = yy * HW + xx;
          if (into !== 'render') this.clean[p] = 1;
          if (into !== 'clean' && grey < this.dark[p]) this.dark[p] = grey;
        }
      }
    }
  }
  // connected components of the clean paper at hi-res (4-connected): {lab, n, area (hi px)}
  labels() {
    const { HW, HH } = this,
      N = HW * HH,
      cl = this.clean;
    const lab = new Int32Array(N).fill(-1),
      st = new Int32Array(N),
      area = [0];
    let cur = 0;
    for (let p = 0; p < N; p++) {
      if (cl[p] || lab[p] !== -1) continue;
      cur++;
      let sp = 0,
        a = 0;
      st[sp++] = p;
      lab[p] = cur;
      while (sp) {
        const q = st[--sp];
        a++;
        const x = q % HW;
        if (x > 0 && !cl[q - 1] && lab[q - 1] === -1) {
          lab[q - 1] = cur;
          st[sp++] = q - 1;
        }
        if (x < HW - 1 && !cl[q + 1] && lab[q + 1] === -1) {
          lab[q + 1] = cur;
          st[sp++] = q + 1;
        }
        if (q >= HW && !cl[q - HW] && lab[q - HW] === -1) {
          lab[q - HW] = cur;
          st[sp++] = q - HW;
        }
        if (q < N - HW && !cl[q + HW] && lab[q + HW] === -1) {
          lab[q + HW] = cur;
          st[sp++] = q + HW;
        }
      }
      area.push(a);
    }
    return { lab, n: cur, area };
  }
  labelAt(lab, x, y) {
    const S = this.S;
    return lab[Math.round(y * S) * this.HW + Math.round(x * S)];
  }
  fillLabel(lab, L, o = {}) {
    const into = o.renderOnly ? 'render' : 'both',
      grey = o.grey == null ? 0 : o.grey;
    let a = 0;
    for (let p = 0; p < lab.length; p++)
      if (lab[p] === L) {
        a++;
        if (into !== 'render') this.clean[p] = 1;
        if (grey < this.dark[p]) this.dark[p] = grey;
      }
    return a / (this.S * this.S);
  }
  bboxLabel(lab, L) {
    const { HW, HH, S } = this;
    let x0 = HW,
      y0 = HH,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < HH; y += 2)
      for (let x = 0; x < HW; x += 2)
        if (lab[y * HW + x] === L) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    return x1 < 0 ? null : [x0 / S, y0 / S, x1 / S, y1 / S];
  }
  // ---- junctions: crossings of drawn paths, rounded with a tapered blob (neurographic "rounding") ----
  findJunctions(minSep) {
    const cell = 24,
      grid = new Map(),
      segs = [];
    this.paths.forEach((pa, pi) => {
      const pts = pa.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i],
          b = pts[i + 1],
          id = segs.length;
        segs.push({ pi, i, a, b });
        const x0 = Math.floor(Math.min(a[0], b[0]) / cell),
          x1 = Math.floor(Math.max(a[0], b[0]) / cell),
          y0 = Math.floor(Math.min(a[1], b[1]) / cell),
          y1 = Math.floor(Math.max(a[1], b[1]) / cell);
        for (let gy = y0; gy <= y1; gy++)
          for (let gx = x0; gx <= x1; gx++) {
            const k = gx * 100003 + gy;
            let l = grid.get(k);
            if (!l) grid.set(k, (l = []));
            l.push(id);
          }
      }
    });
    const found = [],
      seen = new Set();
    for (const list of grid.values()) {
      for (let u = 0; u < list.length; u++)
        for (let v = u + 1; v < list.length; v++) {
          const s1 = segs[list[u]],
            s2 = segs[list[v]];
          if (s1.pi === s2.pi && Math.abs(s1.i - s2.i) < 4) continue;
          const key = list[u] < list[v] ? list[u] * 1e7 + list[v] : list[v] * 1e7 + list[u];
          if (seen.has(key)) continue;
          seen.add(key);
          const hit = segHit(s1.a, s1.b, s2.a, s2.b);
          if (!hit) continue;
          found.push({ x: hit[0], y: hit[1], s1, s2 });
        }
    }
    // merge near-duplicates, build arms with their available length along each path; skip junctions inside a cut
    // or a gap of either path (the render has no ink there, so no blob)
    const cum = this.paths.map((pa) => {
      const c = [0];
      for (let i = 0; i < pa.pts.length - 1; i++)
        c.push(c[i] + Math.hypot(pa.pts[i + 1][0] - pa.pts[i][0], pa.pts[i + 1][1] - pa.pts[i][1]));
      return c;
    });
    const out = [];
    for (const f of found) {
      if (out.some((j) => Math.hypot(j.x - f.x, j.y - f.y) < minSep)) continue;
      const arms = [],
        lw = Math.max(this.paths[f.s1.pi].lw, this.paths[f.s2.pi].lw);
      let skip = false;
      for (const s of [f.s1, f.s2]) {
        const pa = this.paths[s.pi],
          d = norm([s.b[0] - s.a[0], s.b[1] - s.a[1]]);
        const pos = cum[s.pi][s.i] + Math.hypot(f.x - s.a[0], f.y - s.a[1]),
          total = pa.tot;
        if (pa.grey > 60) skip = true; // faint lines are not rounded
        if (pa.cutStart && pos < pa.cutStart + lw * 1.5) skip = true;
        if (pa.cutEnd && pos > total - pa.cutEnd - lw * 1.5) skip = true;
        for (const g of pa.gapsD) if (Math.abs(pos - g.d) < g.len / 2 + lw * 2) skip = true;
        arms.push({ u: d, len: total - pos }, { u: [-d[0], -d[1]], len: pos });
      }
      if (skip) continue;
      out.push({ x: f.x, y: f.y, arms, lw });
    }
    return out;
  }
  // neurographic rounding: concave fillets (webs) between neighbouring arms + a slight tapered swell along the arms
  drawJunction(j, k = 0.5, reachMul = 2.0, skew = 0, fillet = 1.0) {
    const lw = j.lw,
      reach = lw * reachMul;
    const arms = j.arms.filter((a) => a.len > -lw / 2);
    for (const a of arms) {
      const len = Math.min(reach, a.len + lw / 2);
      if (len <= 0) continue;
      for (let t = 0; t <= len; t += 0.5) {
        const q = 1 - t / reach,
          r = (lw / 2) * (1 + k * q * q * (1 + skew));
        this.disc((j.x + a.u[0] * t) * this.S, (j.y + a.u[1] * t) * this.S, r * this.S, 'both', 0);
      }
    }
    if (!fillet) return;
    const sorted = arms.map((a) => ({ ...a, ang: Math.atan2(a.u[1], a.u[0]) })).sort((p, q) => p.ang - q.ang);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i],
        b = sorted[(i + 1) % sorted.length];
      let th = b.ang - a.ang;
      if (i === sorted.length - 1) th += TAU;
      if (th <= 0.05 || th > 2.8) continue;
      const c = Math.cos(th / 2),
        L = lw * (1.5 + 2.0 * c) * fillet * (1 + skew);
      const La = Math.min(L, a.len + lw * 0.4),
        Lb = Math.min(L, b.len + lw * 0.4);
      if (La <= 0 || Lb <= 0) continue;
      const A = [j.x + a.u[0] * La, j.y + a.u[1] * La],
        B = [j.x + b.u[0] * Lb, j.y + b.u[1] * Lb],
        P = [j.x, j.y];
      const bez = quad(A, P, B, 10);
      this.fillPoly([...bez, P]);
    }
  }
  roundJunctions(r, o = {}) {
    const js = this.findJunctions(o.minSep || 6);
    let n = 0;
    for (const j of js) {
      if (o.skip && r() < o.skip) continue;
      if (o.avoid && o.avoid.some((a) => Math.hypot(a[0] - j.x, a[1] - j.y) < a[2])) continue;
      this.drawJunction(
        j,
        o.k == null ? 0.5 : o.k,
        o.reach || 2.0,
        (r() - 0.5) * 0.4,
        o.fillet == null ? 1 : o.fillet,
      );
      n++;
    }
    return n;
  }
  inkEdge(p, u, maxLen = 20) {
    const S = this.S;
    let t = 0;
    const g = (t) => {
      const x = Math.round((p[0] + u[0] * t) * S),
        y = Math.round((p[1] + u[1] * t) * S);
      return x < 0 || y < 0 || x >= this.HW || y >= this.HH ? 255 : this.dark[y * this.HW + x];
    };
    while (t < maxLen && g(t) < 128) t += 1 / S;
    return t;
  }
  // measure the opening (paper px) along direction u from point p, skipping ink first: for gap verification
  measureOpening(p, u, maxLen = 30) {
    const S = this.S,
      g = (t) => {
        const x = Math.round((p[0] + u[0] * t) * S),
          y = Math.round((p[1] + u[1] * t) * S);
        return x < 0 || y < 0 || x >= this.HW || y >= this.HH ? 0 : this.dark[y * this.HW + x];
      };
    let t = -maxLen;
    while (t < maxLen && g(t) > 128) t += 1 / S; // find ink of the line being met (going backwards first)
    // walk forward from p: inside ink of the met line, then paper, then the branch's ink
    t = 0;
    while (t < maxLen && g(t) < 128) t += 1 / S;
    const a = t;
    while (t < maxLen && g(t) > 128) t += 1 / S;
    return t >= maxLen ? -1 : +(t - a).toFixed(1);
  }
  // render-only ink coverage (0..255) for a block of the hi-res render: text (text.mjs)
  applyMask(x0, y0, w, h, alpha, grey) {
    const { HW, HH } = this,
      dk = this.dark;
    for (let y = 0; y < h; y++) {
      const yy = y0 + y;
      if (yy < 0 || yy >= HH) continue;
      for (let x = 0; x < w; x++) {
        const xx = x0 + x,
          a = alpha[y * w + x];
        if (xx < 0 || xx >= HW || !a) continue;
        const v = Math.round(255 - ((255 - grey) * a) / 255),
          p = yy * HW + xx;
        if (v < dk[p]) dk[p] = v;
      }
    }
  }
}

// ---- geometry helpers ----
export const norm = (v) => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
function segHit(p, p2, q, q2) {
  const rx = p2[0] - p[0],
    ry = p2[1] - p[1],
    sx = q2[0] - q[0],
    sy = q2[1] - q[1],
    den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qpx = q[0] - p[0],
    qpy = q[1] - p[1],
    t = (qpx * sy - qpy * sx) / den,
    u = (qpx * ry - qpy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p[0] + rx * t, p[1] + ry * t];
}
export function catmull(ctrl, per = 24, closed = false) {
  const out = [],
    n = ctrl.length,
    at = (i) => ctrl[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per,
        t2 = t * t,
        t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(closed ? [...out[0]] : [...ctrl[n - 1]]);
  return out;
}
export function circle(cx, cy, rad, n) {
  n = n || Math.max(24, Math.ceil((TAU * rad) / 3));
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    o.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return o;
}
export function arc(cx, cy, rad, a0, a1, n) {
  n = n || Math.max(6, Math.ceil((Math.abs(a1 - a0) * rad) / 3));
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return o;
}
export function ellipse(cx, cy, rx, ry, rot = 0, n) {
  n = n || Math.max(24, Math.ceil((TAU * Math.max(rx, ry)) / 3));
  const o = [],
    c = Math.cos(rot),
    s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU,
      x = rx * Math.cos(a),
      y = ry * Math.sin(a);
    o.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return o;
}
// quadratic bezier
export function quad(p0, c, p1, n = 16) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    o.push([
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ]);
  }
  return o;
}
// lens / petal from base point A to tip B with bulge b (fraction of length) each side; closed
export function petal(A, B, b = 0.3, n = 18) {
  const mx = (A[0] + B[0]) / 2,
    my = (A[1] + B[1]) / 2,
    dx = B[0] - A[0],
    dy = B[1] - A[1],
    L = Math.hypot(dx, dy),
    nx = -dy / L,
    ny = dx / L;
  const c1 = [mx + nx * b * L * 2, my + ny * b * L * 2],
    c2 = [mx - nx * b * L * 2, my - ny * b * L * 2];
  const s1 = quad(A, c1, B, n),
    s2 = quad(B, c2, A, n);
  s1.pop();
  return s1.concat(s2);
}
// organic blob: radial noise around (cx,cy)
export function blob(r, cx, cy, rad, rough = 0.18, n = 64) {
  const k = 3 + ((r() * 3) | 0),
    ph = r() * TAU,
    k2 = 6 + ((r() * 4) | 0),
    ph2 = r() * TAU,
    out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU,
      rr = rad * (1 + rough * Math.sin(k * a + ph) + rough * 0.5 * Math.sin(k2 * a + ph2));
    out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return out;
}
// scalloped outline (cloud / tree canopy) around an ellipse: bumps of radius ~ bump
export function scallop(cx, cy, rx, ry, bumps, depth = 0.5, n = 10) {
  const out = [];
  for (let b = 0; b < bumps; b++) {
    const a0 = (b / bumps) * TAU,
      a1 = ((b + 1) / bumps) * TAU,
      am = (a0 + a1) / 2;
    const P0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)],
      P1 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
    const push = 1 + depth * (TAU / bumps);
    const C = [cx + rx * push * Math.cos(am), cy + ry * push * Math.sin(am)];
    const q = quad(P0, C, P1, n);
    if (b) q.shift();
    out.push(...q);
  }
  return out;
}
export function roundRectPts(x0, y0, x1, y1, rr) {
  const pts = [];
  const corners = [
    [x1 - rr, y0 + rr, -Math.PI / 2, 0],
    [x1 - rr, y1 - rr, 0, Math.PI / 2],
    [x0 + rr, y1 - rr, Math.PI / 2, Math.PI],
    [x0 + rr, y0 + rr, Math.PI, 1.5 * Math.PI],
  ];
  for (const [cx, cy, a0, a1] of corners) pts.push(...arc(cx, cy, rr, a0, a1, 16));
  pts.push([...pts[0]]);
  return pts;
}
export const sdfRoundRect = (x0, y0, x1, y1, rr) => ({
  sdf: (x, y) => {
    const cx = Math.min(Math.max(x, x0 + rr), x1 - rr),
      cy = Math.min(Math.max(y, y0 + rr), y1 - rr);
    return Math.hypot(x - cx, y - cy) - rr;
  },
  box: [x0, y0, x1, y1],
});
export const sdfCircle = (cx, cy, rad) => ({
  sdf: (x, y) => Math.hypot(x - cx, y - cy) - rad,
  box: [cx - rad, cy - rad, cx + rad, cy + rad],
});

// resample a polyline at `step` px
export function resample(pts, step = 2) {
  const out = [[...pts[0]]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) continue;
    let d = step - carry;
    while (d <= L) {
      const t = d / L;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = L - (d - step);
  }
  const last = pts[pts.length - 1],
    pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > 0.3) out.push([...last]);
  return out;
}
// hand-drawn quality: perpendicular wobble + width variation along the stroke. Returns [x,y,wf] points.
export function hand(r, pts, o = {}) {
  const amp = o.amp == null ? 1.0 : o.amp,
    wv = o.wv == null ? 0.22 : o.wv,
    step = o.step || 2;
  const P = resample(pts, step),
    n = P.length;
  const l1 = 90 + 110 * r(),
    l2 = 28 + 40 * r(),
    l3 = 7 + 8 * r(),
    p1 = r() * TAU,
    p2 = r() * TAU,
    p3 = r() * TAU;
  const m1 = 150 + 250 * r(),
    m2 = 40 + 50 * r(),
    q1 = r() * TAU,
    q2 = r() * TAU,
    base = 1 + (r() - 0.5) * (o.wspread == null ? 0.2 : o.wspread);
  const out = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(n - 1, i + 1)],
      d = norm([b[0] - a[0], b[1] - a[1]]);
    const off =
      amp *
      (0.6 * Math.sin((TAU * s) / l1 + p1) +
        0.3 * Math.sin((TAU * s) / l2 + p2) +
        0.12 * Math.sin((TAU * s) / l3 + p3));
    const wf = base * (1 + wv * (0.7 * Math.sin((TAU * s) / m1 + q1) + 0.3 * Math.sin((TAU * s) / m2 + q2)));
    out[i] = [P[i][0] - d[1] * off, P[i][1] + d[0] * off, wf];
  }
  // taper the very ends a little (pen lift)
  if (o.taper) {
    const k = Math.min(6, n >> 2);
    for (let i = 0; i < k; i++) {
      const f = 0.55 + 0.45 * (i / k);
      out[i][2] *= f;
      out[n - 1 - i][2] *= f;
    }
  }
  return out;
}
// clip a polyline to an envelope SDF (keeps inside pieces); each cut end is extended `over()` px beyond the boundary
export function clipTo(env, pts, over = () => 0) {
  if (!env) return [pts];
  const inside = (p) => env.sdf(p[0], p[1]) <= 0,
    pieces = [];
  let cur = null;
  const cross = (a, b) => {
    let lo = a,
      hi = b;
    for (let k = 0; k < 20; k++) {
      const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
      if (inside(m) === inside(a)) lo = m;
      else hi = m;
    }
    return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
  };
  const ext = (from, to, o) => {
    const d = norm([to[0] - from[0], to[1] - from[1]]);
    return [to[0] + d[0] * o, to[1] + d[1] * o, to[2]];
  };
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      inn = inside(p);
    if (inn) {
      if (!cur) {
        cur = [];
        if (i > 0) {
          const c = cross(pts[i - 1], p);
          c[2] = p[2];
          cur.push(ext(p, c, over()));
        }
      }
      cur.push(p);
    } else if (cur) {
      const c = cross(pts[i - 1], p);
      c[2] = pts[i - 1][2];
      cur.push(ext(pts[i - 1], c, over()));
      if (cur.length > 1) pieces.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length > 1) pieces.push(cur);
  return pieces;
}
// a flowing line from one side of the box to another, transverse random walk (neurographic line)
export function flowLine(r, box, o = {}) {
  const [x0, y0, x1, y1] = box,
    w = x1 - x0,
    h = y1 - y0;
  const sides = o.sides || [0, 1, 2, 3],
    sA = sides[(r() * sides.length) | 0];
  let sB = sides[(r() * sides.length) | 0];
  for (let k = 0; k < 8 && sB === sA; k++) sB = sides[(r() * sides.length) | 0];
  const onSide = (s, t) =>
    s === 0 ? [x0 + w * t, y0] : s === 1 ? [x1, y0 + h * t] : s === 2 ? [x0 + w * t, y1] : [x0, y0 + h * t];
  const A = onSide(sA, 0.1 + 0.8 * r()),
    B = onSide(sB, 0.1 + 0.8 * r());
  const n = o.n || 3 + ((r() * 4) | 0),
    ctrl = [A],
    L = Math.hypot(B[0] - A[0], B[1] - A[1]),
    nx = -(B[1] - A[1]) / L,
    ny = (B[0] - A[0]) / L;
  let d = 0,
    v = 0;
  const sw = (o.swing == null ? 0.22 : o.swing) * Math.min(w, h);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    v = v * 0.4 + (r() - 0.5) * sw * 1.6;
    d = Math.max(-sw * 1.5, Math.min(sw * 1.5, d + v));
    let px = A[0] + (B[0] - A[0]) * t + nx * d,
      py = A[1] + (B[1] - A[1]) * t + ny * d;
    const ins = o.inset == null ? 0.04 : o.inset;
    px = Math.max(x0 + ins * w, Math.min(x1 - ins * w, px));
    py = Math.max(y0 + ins * h, Math.min(y1 - ins * h, py));
    ctrl.push([px, py]);
  }
  ctrl.push(B);
  return catmull(ctrl, 32);
}
// a point and tangent at fraction t along a polyline
export function along(pts, t) {
  const segL = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segL.push(l);
    tot += l;
  }
  let d = t * tot;
  for (let i = 0; i < segL.length; i++) {
    if (d <= segL[i] || i === segL.length - 1) {
      const u = segL[i] ? d / segL[i] : 0,
        a = pts[i],
        b = pts[i + 1];
      return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], d: norm([b[0] - a[0], b[1] - a[1]]) };
    }
    d -= segL[i];
  }
  return { p: [...pts[0]], d: [1, 0] };
}
export function pointIn(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// ---- region patterns (zentangle); all clipped to the region L of label map lab ----
export function hatchRegion(R, lab, L, bbox, spacing, angle, lw, o = {}) {
  const [x0, y0, x1, y1] = bbox,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    D = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  const ux = Math.cos(angle),
    uy = Math.sin(angle),
    nx = -uy,
    ny = ux;
  let n = 0;
  for (let d = -D; d <= D; d += spacing) {
    const a = [cx + nx * d - ux * D, cy + ny * d - uy * D],
      b = [cx + nx * d + ux * D, cy + ny * d + uy * D];
    R.stroke(o.hand ? hand(o.r, [a, b], { amp: 0.4, wv: 0.15 }) : [a, b], lw, {
      renderOnly: o.renderOnly !== false,
      clip: { lab, L },
      grey: o.grey,
    });
    n++;
  }
  return n;
}
export function scalesRegion(R, lab, L, bbox, size, lw) {
  const [x0, y0, x1, y1] = bbox;
  let row = 0,
    n = 0;
  for (let y = y0 - size; y <= y1 + size; y += size * 0.55, row++)
    for (let x = x0 - size + (row % 2) * size * 0.5; x <= x1 + size; x += size) {
      R.stroke(arc(x, y, size / 2, Math.PI, TAU, 16), lw, { clip: { lab, L } });
      n++;
    }
  return n;
}
export function gridRegion(R, lab, L, bbox, pitch, angle, lw) {
  hatchRegion(R, lab, L, bbox, pitch, angle, lw, { renderOnly: false });
  hatchRegion(R, lab, L, bbox, pitch, angle + Math.PI / 2, lw, { renderOnly: false });
}
export function circlesRegion(R, r, lab, L, bbox, rmin, rmax, lw, tries = 400) {
  const [x0, y0, x1, y1] = bbox,
    placed = [];
  let n = 0;
  for (let t = 0; t < tries; t++) {
    const rad = rmin + (rmax - rmin) * r(),
      x = x0 + (x1 - x0) * r(),
      y = y0 + (y1 - y0) * r();
    let ok = true;
    for (let a = 0; a < TAU && ok; a += TAU / 12)
      if (R.labelAt(lab, x + (rad + lw) * Math.cos(a), y + (rad + lw) * Math.sin(a)) !== L) ok = false;
    if (ok && R.labelAt(lab, x, y) !== L) ok = false;
    for (const c of placed) if (ok && Math.hypot(c[0] - x, c[1] - y) < c[2] + rad + lw + 1) ok = false;
    if (!ok) continue;
    placed.push([x, y, rad]);
    R.stroke(circle(x, y, rad), lw, { clip: { lab, L } });
    n++;
  }
  return n;
}
export function dotsRegion(R, r, lab, L, bbox, count, px) {
  const [x0, y0, x1, y1] = bbox;
  let n = 0;
  for (let t = 0; t < count * 3 && n < count; t++) {
    const x = x0 + (x1 - x0) * r(),
      y = y0 + (y1 - y0) * r();
    if (R.labelAt(lab, x, y) !== L) continue;
    R.disc(x * R.S, y * R.S, (px * R.S) / 2, 'render', 0, { lab, L });
    n++;
  }
  return n;
}
