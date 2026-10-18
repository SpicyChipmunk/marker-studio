// v318.15: Light from › The edges (each section darker along its lines, lighter in its middle; saved as the sun to an
// older copy); the shading presets (set the mode, Light from and the three amounts; chosen while they still match);
// Flow › Rings (out from the section under the centre through touching sections; islands next to their nearest);
// Matching shapes alike (each ring's matching shapes one marker, pins and coloured sections kept). Fails on v318.14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a picture of sections found from ink where ink(x, y), each in the guide with one marker, shading on
function built(W, H, ink) {
  const app = createApp(),
    t = app.__mstest,
    E = app.__eval;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  const g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  t.applyBg(true);
  const COLORS = E('COLORS'),
    lab = E('hexToLab'),
    mk = (c) => ({
      mkey: c.brand + '|' + c.code,
      code: c.code,
      brand: c.brand,
      hex: c.hex,
      name: c.name,
      fam: c.fam,
      lab: lab(c.hex),
    }),
    all = COLORS.filter((c) => c.brand === 'Ohuhu' && !/blender/i.test(c.name)).map(mk),
    cl = Array.from(t.countedList()),
    assign = {};
  cl.forEach((l, i) => (assign[l] = all[(i * 7) % all.length]));
  t.assignData = { assign, order: cl.slice(), N: cl.length, base: { ...assign } };
  t.labelPts = null;
  t.colored = new Uint8Array(t.comps.length);
  t.setCollection(all);
  t.shadeMode = 'full';
  t.shadeRound = 0.5;
  return { t, E, cl, all };
}
const sq = (x0, y0, s) => (x, y) =>
  (x >= x0 && x < x0 + s && (y === y0 || y === y0 + 1 || y === y0 + s - 1 || y === y0 + s - 2)) ||
  (y >= y0 && y < y0 + s && (x === x0 || x === x0 + 1 || x === x0 + s - 1 || x === x0 + s - 2));

test('Light from the edges: darker along the lines and into the corners, lighter in the middle, the same each side', () => {
  // (a square 120 px across: not so big it's taken for a frame round the picture)
  const { t } = built(300, 300, sq(90, 90, 120));
  t.styleVars.shadeLight = 'edges';
  // (a copy: the field is worked out again in place)
  const V = t.shadeField(1).slice(),
    at = (x, y) => V[y * 300 + x];
  const mid = at(150, 150),
    near = at(150, 96),
    corner = at(95, 95);
  assert.ok(near > mid + 100, `by the line ${near}, middle ${mid}`);
  assert.ok(corner >= near, `corner ${corner}`);
  // the same on each side, whatever the sun
  for (const [a, b] of [
    [at(96, 150), at(203, 150)],
    [at(150, 96), at(150, 203)],
    [at(120, 150), at(179, 150)],
  ])
    assert.ok(Math.abs(a - b) <= 2, `${a} ${b}`);
  t.shadeSun = { x: 0.9, y: 0.9 };
  const V2 = t.shadeField(1);
  assert.equal(V2[96 * 300 + 150], near);
  // rounder: the shadow reaches further in
  t.zshSet(t.zoneCur, 'round', 0.9);
  const V3 = t.shadeField(1);
  assert.ok(V3[150 * 300 + 120] > at(120, 150), `${V3[150 * 300 + 120]} > ${at(120, 150)}`);
});

test('Light from the sun is as it was; the edges are saved as the sun to an older copy, and read back', () => {
  const { t } = built(300, 300, sq(90, 90, 120));
  t.styleVars.shadeLight = 'sun';
  t.shadeSun = { x: 0.1, y: 0.1 };
  const V = t.shadeField(1);
  // with the sun at the top left, the top left of the square is lighter than its bottom right
  assert.ok(V[100 * 300 + 100] < V[200 * 300 + 200]);
  const fields = [...t.styleFields],
    src = fields.find((f) => f.key === 'lightSrc'),
    legacy = fields.find((f) => f.key === 'light');
  t.styleVars.shadeLight = 'edges';
  assert.equal(legacy.save(), 'sun');
  assert.equal(src.check('edges', src.def), 'edges');
  // an older copy's unknown value falls back to the sun it wrote alongside
  assert.equal(src.check('glow', src.def, { light: 'sun' }), 'sun');
});

test('presets: each sets the mode, Light from and the three amounts; chosen while all still match', () => {
  const { t } = built(300, 300, sq(50, 50, 200));
  const P = [...t.SH_PRESETS];
  assert.deepEqual(
    P.map((p) => p.k),
    ['soft', 'dramatic', 'rounded', 'neuro'],
  );
  for (const p of P) {
    assert.equal(t.shPresetApply(p.k), true);
    assert.equal(t.shadeMode, p.mode);
    // (v318.16: a sun style leaves Light from as it was unless it was the edges: auto here, the sun with no photo)
    assert.ok(
      t.styleVars.shadeLight === p.light || (p.light === 'sun' && t.styleVars.shadeLight === 'auto'),
      p.k,
    );
    const z = t.zsh(t.zoneCur);
    assert.equal(z.round, p.round);
    assert.equal(z.hi, p.hi);
    assert.equal(z.lo, p.lo);
    assert.deepEqual(
      P.filter((q) => t.shPresetOn(q)).map((q) => q.k),
      [p.k],
    );
  }
  // a slider moved: none chosen
  t.zshSet(t.zoneCur, 'hi', 0.47);
  assert.equal(
    P.some((q) => t.shPresetOn(q)),
    false,
  );
  assert.equal(t.shPresetApply('nope'), false);
});

// a picture of cols × rows sections touching (no lines), each rw × rh
function grid(cols, rows, rw = 40, rh = 40) {
  const app = createApp(),
    t = app.__mstest,
    W = cols * rw,
    H = rows * rh,
    labels = new Int32Array(W * H),
    comps = [null];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const l = comps.length;
      comps.push({
        cx: x * rw + rw / 2,
        cy: y * rh + rh / 2,
        area: rw * rh,
        merged: false,
        bg: false,
        x0: x * rw,
        y0: y * rh,
        x1: x * rw + rw - 1,
        y1: y * rh + rh - 1,
      });
      for (let py = y * rh; py < (y + 1) * rh; py++) labels.fill(l, py * W + x * rw, py * W + x * rw + rw);
    }
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.assignData = null;
  return { t, cl: Array.from(t.countedList()), at: (x, y) => 1 + y * cols + x };
}

test('Rings: steps through touching sections from the one under the centre; islands next to the nearest reached', () => {
  const { t, cl, at } = grid(5, 5);
  t.styleVars.radC = { x: 0.5, y: 0.5 };
  const d = t.ringDepths(cl);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) assert.equal(d[at(x, y)], Math.abs(x - 2) + Math.abs(y - 2), `${x},${y}`);
  // from a corner
  t.styleVars.radC = { x: 0.05, y: 0.05 };
  assert.equal(t.ringDepths(cl)[at(4, 4)], 8);
  // a zone of rows 0 and 2 only, the centre in row 2: row 0 is cut off, each next to the one below it
  t.styleVars.radC = { x: 0.5, y: 0.5 };
  const z = cl.filter((l) => [0, 2].includes(Math.floor((l - 1) / 5))),
    dz = t.ringDepths(z);
  assert.equal(dz[at(2, 2)], 0);
  assert.equal(dz[at(0, 2)], 2);
  assert.equal(dz[at(2, 0)], 1);
  assert.equal(dz[at(0, 0)], 3);
  assert.equal(dz[at(2, 1)], undefined, 'not in the zone');
  // the centre over a section not in the zone: the zone's nearest
  t.styleVars.radC = { x: 0.5, y: 0.38 };
  assert.equal(t.ringDepths(z)[at(2, 2)], 0);
  // ordered ring by ring
  t.styleVars.radC = { x: 0.5, y: 0.5 };
  t.styleVars.gradShape = 'rings';
  const o = t.grad.order(cl),
    dd = t.ringDepths(cl);
  assert.equal(o[0], at(2, 2));
  for (let i = 1; i < o.length; i++) assert.ok(dd[o[i]] >= dd[o[i - 1]]);
});

// a mandala: a disc in the middle and rings of 8, 16 and 24 cells round it
const mandala = (cx, cy) => (x, y) => {
  const r = Math.hypot(x - cx, y - cy),
    a = ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 360) % 360,
    spoke = (r0, r1, k) =>
      r > r0 && r < r1 && Math.min(a % (360 / k), 360 / k - (a % (360 / k))) * (Math.PI / 180) * r < 1.5;
  return (
    [30, 80, 140, 200].some((R) => Math.abs(r - R) < 2) ||
    spoke(30, 80, 8) ||
    spoke(80, 140, 16) ||
    spoke(140, 200, 24)
  );
};

test('Matching shapes alike: each ring’s matching shapes are a group, laid in one marker; pins and coloured kept', () => {
  const { t, cl, all } = built(440, 440, mandala(220, 220));
  assert.ok(t.grad.mandala(cl), 'looks like a mandala');
  const groups = [...t.mandalaGroups(cl)].map((g) => [...g]).sort((a, b) => a.length - b.length);
  assert.deepEqual(
    groups.map((g) => g.length),
    [8, 16, 24],
  );
  const A = t.assignData.assign,
    [g8, g16, g24] = groups;
  // the ring of 8 takes its pinned member's marker; the ring of 16 a coloured member's (which isn't changed); the
  // ring of 24 the marker most of it has
  const pin = g8[3],
    col = g16[5],
    pm = A[pin],
    cm = A[col],
    most = all.find((m) => m !== pm && m !== cm);
  g24.slice(0, 13).forEach((l) => (A[l] = most));
  t.locks[pin] = pm.mkey;
  t.colored[col] = 1;
  const n = t.matchUnify(cl);
  assert.equal(n, 7 + 15 + 11);
  assert.ok(g8.every((l) => A[l] === pm));
  assert.ok(g16.every((l) => A[l] === cm));
  assert.ok(g24.every((l) => A[l] === most));
  // the pattern's own marker follows for each one changed (what Unpin brings back; the 13 above were set by hand)
  assert.ok([...g8, ...g16, ...g24.slice(13)].every((l) => t.assignData.base[l] === A[l]));
  // the disc in the middle keeps its own
  const rest = cl.filter((l) => !g8.includes(l) && !g16.includes(l) && !g24.includes(l));
  assert.equal(rest.length, 1);
  assert.ok(rest.every((l) => A[l] === t.assignData.base[l]));
  // again: nothing more to do
  assert.equal(t.matchUnify(cl), 0);
  // a page that isn't a mandala has no groups
  const g = built(300, 300, sq(90, 90, 120));
  assert.equal(g.t.mandalaGroups(g.cl).length, 0);
});

test('Matching shapes alike is saved only when on, and a guide saved before reads it as off', () => {
  const t = createApp().__mstest,
    f = [...t.styleFields].find((x) => x.key === 'matchAlike');
  assert.equal(f.def, false);
  t.styleVars.matchAlike = false;
  assert.equal(f.save(), undefined);
  t.styleVars.matchAlike = true;
  assert.equal(f.save(), true);
  assert.equal(f.check(undefined, f.def), false);
  const s = [...t.styleFields].find((x) => x.key === 'gradShape');
  assert.equal(s.check('rings', s.def), 'rings');
});
