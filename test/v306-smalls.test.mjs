// v306 small changes: Smooth them steers clear of the other brand of a highlight's or shadow's code; Home's latest
// piece leaves out "(section edits)" copies; the shorter untick toast; find by code's line for a code that's only a
// highlight or shadow in the guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function appWith() {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E('state.owned = new Set(defaultOwned())');
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, E, t };
}
// cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
function page(t, cols, rows, seed = 1, cell = 24, lw = 2) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
    ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
    hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
    W = ws.reduce((a, b) => a + b + lw, lw),
    H = hs.reduce((a, b) => a + b + lw, lw),
    labels = new Int32Array(W * H).fill(-1),
    comps = [null];
  let y0 = lw;
  for (let rr = 0; rr < rows; rr++) {
    let x0 = lw;
    for (let c = 0; c < cols; c++) {
      const l = comps.length,
        w = ws[c],
        h = hs[rr];
      comps.push({
        area: w * h,
        bg: false,
        bpx: 0,
        cx: x0 + w / 2,
        cy: y0 + h / 2,
        h: h - 1,
        x0,
        y0,
        x1: x0 + w - 1,
        y1: y0 + h - 1,
        merged: false,
      });
      for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
      x0 += w + lw;
    }
    y0 += hs[rr] + lw;
  }
  Object.assign(t, { W, H, labels, comps });
  t.secState = new Uint8Array(comps.length).fill(1);
  t.colored = new Uint8Array(comps.length);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  for (const k in t.locks) delete t.locks[k];
  return t.countedList();
}
const style = (t, o) =>
  Object.assign(
    t.styleVars,
    {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      gradScat: 0,
      gradJit: 0,
      gradFix: false,
      dir: 1,
      look: 'auto',
      gradShape: 'serpentine',
      limitN: 999,
      shadeMode: 'off',
    },
    o,
  );

// ---- 1. Smooth them and shading's highlights and shadows ----

test('Smooth them never brings in the other brand of a code the guide’s highlights or shadows use', () => {
  const { t } = appWith();
  for (const [cols, rows, seed, shadeMode, gradSeed] of [
    [16, 10, 2, 'shadow', 0],
    [18, 12, 4, 'shadow', 0.3],
    [20, 12, 4, 'shadow', 0],
    [20, 12, 5, 'shadow', 0],
    [18, 12, 1, 'full', 0],
  ]) {
    const cl = page(t, cols, rows, seed),
      what = [cols, rows, seed, shadeMode, gradSeed].join(' ');
    style(t, { shadeMode, gradSeed });
    t.grad.build(cl);
    // the highlights and shadows as laid before the fix: { code: { marker key } }
    const part = {};
    for (const l of cl) {
      const x = t.shadeSec(l);
      if (x) for (const p of [x.light, x.dark]) if (p) (part[p.code] ||= new Set()).add(p.mkey);
    }
    style(t, { shadeMode, gradSeed, gradFix: true });
    t.grad.build(cl);
    const f = t.grad.fixed;
    assert.ok(f && f.swaps.length > 0, what + ': smoothed');
    for (const [l, k] of f.swaps) {
      const m = t.assignData.assign[l];
      assert.equal(m.mkey, k);
      assert.ok(
        !part[m.code] || part[m.code].has(k),
        `${what}: ${k} is the other brand of a highlight or shadow`,
      );
    }
  }
});

test('Smooth them: fixRun leaves out a marker whose code another brand’s highlight or shadow has (ext.part)', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, {});
  t.grad.build(cl);
  const A = { ...t.assignData.assign },
    none = { used: new Set(), codes: new Set() },
    r = t.grad.fixRun(cl, { ...A }, t.coll, () => false, none);
  assert.ok(r.swaps.length > 0);
  const k = r.swaps[0][1],
    m = t.coll.find((x) => x.mkey === k),
    other = (m.brand === 'Ohuhu' ? 'Copic|' : 'Ohuhu|') + m.code;
  // its code a highlight in the other brand: not that marker; in its own brand: still fine
  const r2 = t.grad.fixRun(cl, { ...A }, t.coll, () => false, {
    ...none,
    part: { [m.code]: { [other]: 1 } },
  });
  assert.ok(!r2.swaps.some((s) => s[1] === k), k + ' left out');
  const r3 = t.grad.fixRun(cl, { ...A }, t.coll, () => false, { ...none, part: { [m.code]: { [k]: 1 } } });
  assert.deepEqual(r3.swaps, r.swaps);
});

// ---- 3. Home's latest piece ----

test('Home’s latest piece leaves out copies with section edits to build: the newest other guide, when finished', () => {
  const { __eval: E } = createApp({ localStorage: memoryStorage() });
  const pick = (list) =>
    E(`(function () { const all = ${JSON.stringify(list)}; const cont = all.find(homeStarted) || null;
      const h = homeHeroPick(all, cont); return h ? h.name : null; })()`);
  const g = (name, n, done, ts, extra = {}) => ({
    id: ts,
    type: 'guide',
    name,
    n,
    done,
    ts,
    keys: [],
    ...extra,
  });
  assert.equal(pick([g('Owl (section edits)', 10, 10, 4, { eds: 1 }), g('Owl', 10, 10, 3)]), 'Owl');
  // kept before rows said so: by its name
  assert.equal(pick([g('Owl (section edits)', 10, 10, 4), g('Owl', 10, 10, 3)]), 'Owl');
  // renamed, the row still says so
  assert.equal(pick([g('My owl', 10, 10, 4, { eds: 1 }), g('Owl', 10, 10, 3)]), 'Owl');
  // built and saved since: an ordinary guide again, whatever its name
  assert.equal(
    pick([g('Owl (section edits)', 10, 10, 4, { eds: 0 }), g('Owl', 10, 10, 3)]),
    'Owl (section edits)',
  );
  // the next one isn't finished: none
  assert.equal(pick([g('Owl (section edits)', 10, 10, 4, { eds: 1 }), g('Fox', 10, 0, 3)]), null);
  assert.equal(pick([g('Owl (section edits)', 10, 10, 4, { eds: 1 })]), null);
  // the Library row: eds from the payload's edits, 0 for a guide of that name saved built
  const meta = (d) => JSON.stringify(E(`guideMeta(${JSON.stringify(d)}, 77)`).eds);
  assert.equal(meta({ name: 'Owl (section edits)', n: 3, payload: { edits: 1, prog: [] } }), '1');
  assert.equal(meta({ name: 'Owl (section edits)', n: 3, payload: { prog: [] } }), '0');
  assert.equal(meta({ name: 'Owl', n: 3, payload: { prog: [] } }), undefined);
});

// ---- 4. the untick toast ----

test('the untick toast is short enough for one line at 390: “Removed Copic BG0000”', () => {
  const { __eval: E } = createApp({ localStorage: memoryStorage() });
  assert.equal(E(`addedLine(true, COLORS[keyIdx('Copic|BG0000')], 0)`), 'Removed Copic BG0000');
  assert.equal(
    E(`addedLine(false, COLORS[keyIdx('Copic|BG0000')], 0)`),
    'Added Copic BG0000 to your collection',
  );
});

// ---- 5. find by code: a code that's only a highlight or shadow here ----

test('find by code: a code that’s only a highlight or shadow says what it goes with, brand by brand only with both', () => {
  const { app } = appWith();
  const t = app.__mstest,
    m = (brand, code) => ({ brand, code, mkey: brand + '|' + code }),
    part = (pm, k, bases) => ({
      m: pm,
      highlight: k === 'highlight' ? Object.fromEntries(bases.map((b) => [b.mkey, b])) : {},
      shadow: k === 'shadow' ? Object.fromEntries(bases.map((b) => [b.mkey, b])) : {},
    }),
    r = (parts) => ({ q: 'Y06', raw: 'Y06', base: [], part: parts, pre: [], known: true });
  const O = m('Ohuhu', 'Y06'),
    C = m('Copic', 'Y06');
  assert.equal(
    t.findPartLine(r([part(O, 'highlight', [m('Ohuhu', 'Y07'), m('Ohuhu', 'Y09')])])),
    'Y06 is a highlight for Y07, Y09',
  );
  assert.equal(t.findPartLine(r([part(O, 'shadow', [m('Ohuhu', 'Y02')])])), 'Y06 is a shadow for Y02');
  assert.equal(
    t.findPartLine(
      r([
        part(O, 'highlight', [m('Ohuhu', 'Y07'), m('Ohuhu', 'Y09')]),
        part(C, 'highlight', [m('Copic', 'FY00')]),
      ]),
    ),
    'Y06 is a highlight here: Copic for FY00 · Ohuhu for Y07, Y09',
  );
  const both = {
    m: O,
    highlight: { 'Ohuhu|Y07': m('Ohuhu', 'Y07') },
    shadow: { 'Ohuhu|Y02': m('Ohuhu', 'Y02') },
  };
  assert.equal(t.findPartLine(r([both])), 'Y06 is a highlight for Y07 and a shadow for Y02');
  assert.equal(
    t.findPartLine(r([both, part(C, 'shadow', [m('Copic', 'FY00')])])),
    'Y06 is a highlight and a shadow here: Copic shadow for FY00 · Ohuhu highlight for Y07 and shadow for Y02',
  );
});
