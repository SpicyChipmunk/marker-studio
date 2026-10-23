// v318.35: the page finder's edge fallback (Fable E1-1). A page on a desk nearly as bright as the paper, under light
// that falls off across the photo, has no paper/table split the block views can find (the paper candidate "fills"),
// yet its edge is a sharp step everywhere: four lines fitted to the strongest long gradient ridges give the page,
// judged as any other candidate. Fails on v318.34 (tier 'none', why 'fills').
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 640,
  H = 480;
// a photo W x H of a page (pw x ph, centred at cx,cy, turned by deg) on a desk: the light falls from `light` at the
// top to `light * (1 - fall)` at the bottom, the desk is `desk` bright, the paper `paper`, with a drawing (a grid of
// ink lines inside a margin), the edges blended over a pixel and a little noise. o.shadow: a soft shadow on the desk
// below the page's bottom edge. Returns {d (RGBA), C (the true corners)}.
function photo(o) {
  const pw = o.pw || 360,
    ph = o.ph || 270,
    cx = o.cx == null ? W / 2 : o.cx,
    cy = o.cy == null ? H / 2 : o.cy,
    a = ((o.deg || 0) * Math.PI) / 180,
    ca = Math.cos(a),
    sa = Math.sin(a),
    d = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const rnd = function () {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // page coordinates (u, v) from the page's centre
      const u = (x - cx) * ca + (y - cy) * sa,
        v = -(x - cx) * sa + (y - cy) * ca,
        du = pw / 2 - Math.abs(u),
        dv = ph / 2 - Math.abs(v),
        inside = Math.min(du, dv), // signed distance in from the page's edge
        cov = Math.max(0, Math.min(1, inside + 0.5));
      let desk = o.desk;
      if (o.shadow && v > ph / 2 && Math.abs(u) < pw / 2 + 20) {
        const s = Math.max(0, 1 - (v - ph / 2) / 40);
        desk *= 1 - 0.3 * s;
      }
      let paper = o.paper;
      if (du > 24 && dv > 24 && ((u + 1000) % 36 < 2.5 || (v + 1000) % 36 < 2.5)) paper = 30;
      const light = (o.light || 1) * (1 - (o.fall || 0) * (y / H)),
        g = Math.max(0, Math.min(255, (paper * cov + desk * (1 - cov)) * light + (rnd() - 0.5) * 4)),
        j = (y * W + x) * 4;
      d[j] = g;
      d[j + 1] = g;
      d[j + 2] = g;
      d[j + 3] = 255;
    }
  const C = [
    [-pw / 2, -ph / 2],
    [pw / 2, -ph / 2],
    [pw / 2, ph / 2],
    [-pw / 2, ph / 2],
  ].map(function (p) {
    return [cx + p[0] * ca - p[1] * sa, cy + p[0] * sa + p[1] * ca];
  });
  return { d: d, C: C };
}
function find(p) {
  const t = createApp().__mstest;
  return t.pgFind({ width: W, height: H, naturalWidth: W, naturalHeight: H, __buf: p.d, __w: W, __h: H });
}
// the worst corner's distance from the truth, as a share of the photo's diagonal (either way round, from any corner)
function cornerErr(q, C) {
  let best = Infinity;
  for (let s = 0; s < 4; s++)
    for (const dir of [1, -1]) {
      let worst = 0;
      q.forEach(function (p, i) {
        const c = C[(((s + dir * i) % 4) + 4) % 4];
        worst = Math.max(worst, Math.hypot(p[0] - c[0], p[1] - c[1]));
      });
      best = Math.min(best, worst);
    }
  return best / Math.hypot(W, H);
}

// the light falls by a third down the photo, so the desk at the top is brighter than the paper at the bottom: no
// one paper/table split works (v318.34: 'fills'); the page's edge is still a step everywhere
const LIGHT = { desk: 205, paper: 240, light: 1.0, fall: 0.35 };

test('a light page on a light desk under falling light: found sure by its edges, corners right', () => {
  const p = photo({ ...LIGHT, deg: 6 }),
    r = find(p);
  assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
  assert.equal(r.kind, 'edges');
  assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1% of the diagonal: ' + cornerErr(r.q, p.C));
});

test('a shadowed edge (the desk darker just below the page): still found, corners right', () => {
  const p = photo({ ...LIGHT, deg: -5, shadow: true }),
    r = find(p);
  assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
  assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1%: ' + cornerErr(r.q, p.C));
});

test('a page turned 22 degrees: found sure, corners right', () => {
  const p = photo({ ...LIGHT, deg: 22, pw: 300, ph: 220 }),
    r = find(p);
  assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
  assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1%: ' + cornerErr(r.q, p.C));
});

test('a page cut off by the photo edge: the fallback invents no fourth side', () => {
  // the page's bottom runs off the photo: three edges only
  const p = photo({ ...LIGHT, deg: 4, cy: H / 2 + 160 }),
    r = find(p);
  assert.notEqual(r.kind, 'edges', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind }));
  assert.notEqual(r.tier, 'sure');
});

test('the drawing itself offers no page: a grid drawn to the edge of a plain copy is not an outline (edges)', () => {
  // the page fills the photo (no desk at all): nothing to find, and the fallback does not take the grid for a page
  const p = photo({ desk: 240, paper: 240, light: 1, fall: 0, pw: W + 40, ph: H + 40 }),
    r = find(p);
  assert.notEqual(r.kind, 'edges', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind }));
  assert.notEqual(r.tier, 'sure');
});
