// v306 (home branch): Markers' search keeps "Old code" for an old code the search names whole; old codes that only
// start with it go under "Old codes starting …", or with their families after an exact match ("Y26" had filed Y39,
// once Y260, under Old code; "R25" R54, once R250).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const app = () => createApp({ localStorage: memoryStorage() });

function searcher() {
  const { __eval: E } = app();
  E(
    `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
  );
  return (q) =>
    JSON.parse(
      E(`searchStr = ${JSON.stringify(q)}; JSON.stringify(searchGroups(finderMatches()).map((g) => [g.f.name,
        g.list.map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code)]))`),
    );
}
const group = (g, name) => (g.find((x) => x[0] === name) || [name, []])[1];

test('Search "Y26": both Y26s, and Y39 (once Y260) is not under Old code', () => {
  const groups = searcher();
  const g = groups('y26');
  assert.deepEqual(g[0], ['Best match', ['O:Y26', 'C:Y26']]);
  assert.ok(!g.some((x) => /^Old code/.test(x[0])), g.map((x) => x[0]).join(', '));
  assert.ok(group(g, 'Yellow').includes('O:Y39'), 'Y39 still found, with its family');
});

test('Search "R25": BV26 (once R25) stays under Old code; R54 (once R250) goes with the reds', () => {
  const g = searcher()('r25');
  assert.deepEqual(g[0], ['Best match', ['O:R25']]);
  assert.deepEqual(group(g, 'Old code'), ['O:BV26']);
  assert.ok(!group(g, 'Old code').includes('O:R54'));
  assert.ok(!g.some((x) => /^Old codes starting/.test(x[0])));
  assert.ok(group(g, 'Red').includes('O:R54'));
});

test('Without an exact match, old codes that start so get their own group after the exact old code', () => {
  const groups = searcher();
  let g = groups('y2');
  const names = g.map((x) => x[0]);
  assert.deepEqual(names.slice(0, 3), ['Codes starting Y2', 'Old code', 'Old codes starting Y2']);
  assert.deepEqual(group(g, 'Old code'), ['O:Y111']);
  assert.ok(group(g, 'Old codes starting Y2').includes('O:Y39'));
  // the whole old code still files under Old code
  assert.deepEqual(groups('y260')[0], ['Old code', ['O:Y39']]);
  assert.deepEqual(groups('r250')[0], ['Old code', ['O:R54']]);
  // "g410": its own code, then G24, whose old code it was (v304)
  g = groups('g410');
  assert.deepEqual(g[0], ['Best match', ['O:G410']]);
  assert.deepEqual(group(g, 'Old code'), ['O:G24']);
});

// ---- Palette › From photo: "Paper looks warm · Make it white" -----------------------------------------------------
// Synthetic photos drawn here (160 × 120, as the app reads a small copy): coloured caps on paper under a lamp, cream
// paper, sunsets, caps on a wooden desk, a portrait, a beach, pale fur.
const W = 160,
  H = 120;
function canvas(bg) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) d.set([...bg, 255], p * 4);
  return d;
}
function rect(d, x0, y0, x1, y1, c) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) d.set(c, (y * W + x) * 4);
}
function ellipse(d, cx, cy, rx, ry, c) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) d.set(c, (y * W + x) * 4);
}
const toLin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
const toS = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
// the light's colour, per channel in linear light
function cast(d, k) {
  for (let i = 0; i < d.length; i += 4)
    for (let c = 0; c < 3; c++) d[i + c] = toS(Math.min(1, toLin(d[i + c]) * k[c]));
  return d;
}
const CAPS = [
  [230, 30, 40],
  [250, 120, 20],
  [250, 220, 30],
  [120, 200, 60],
  [20, 150, 90],
  [20, 170, 200],
  [30, 90, 200],
  [110, 60, 180],
  [220, 60, 150],
  [240, 170, 190],
  [150, 90, 50],
  [60, 60, 60],
];
function caps(k, bg = [255, 255, 255]) {
  const d = canvas(bg);
  CAPS.forEach((c, i) =>
    rect(d, 8 + (i % 6) * 25, 30 + ((i / 6) | 0) * 45, 26 + (i % 6) * 25, 62 + ((i / 6) | 0) * 45, c),
  );
  return cast(d, k);
}
const PHOTOS = {
  // white paper under lamps: shown
  'caps on paper, slightly warm lamp': [caps([1, 0.88, 0.7]), true],
  // a phone photo of a page under a lamp: grey and warm (L about 80, b* about 10)
  'a page photographed under a lamp': [caps([0.62, 0.55, 0.45]), true],
  // the same, darker: too dark to be sure it's paper (L about 68)
  'a darker photo under a lamp': [caps([0.42, 0.38, 0.3]), false],
  // cream paper in daylight reads warm too (the wording says what is seen)
  'cream paper in daylight': [
    (() => {
      const d = canvas([245, 236, 215]);
      CAPS.slice(0, 8).forEach((c, i) => ellipse(d, 12 + i * 19, 60, 8, 8, c));
      return d;
    })(),
    true,
  ],
  // not shown
  'caps on paper in daylight': [caps([1, 1, 1]), false],
  'caps on paper in cool light': [caps([0.8, 0.9, 1]), false],
  'caps on paper under a strong lamp (too coloured to be paper)': [caps([1, 0.78, 0.5]), false],
  'caps on a wooden desk, daylight': [caps([1, 1, 1], [160, 110, 70]), false],
  'caps on a wooden desk, warm lamp': [caps([1, 0.8, 0.55], [160, 110, 70]), false],
  sunset: [
    (() => {
      const d = canvas([30, 25, 40]);
      for (let y = 0; y < 80; y++) {
        const t = y / H;
        rect(
          d,
          0,
          y,
          W,
          y + 1,
          [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round),
        );
      }
      ellipse(d, 80, 60, 12, 12, [255, 240, 200]);
      // pale warm clouds
      ellipse(d, 40, 20, 30, 8, [250, 214, 190]);
      ellipse(d, 115, 26, 28, 7, [250, 214, 190]);
      return d;
    })(),
    false,
  ],
  'a portrait in a white shirt (skin too dark to be paper)': [
    (() => {
      const d = canvas([90, 70, 60]);
      ellipse(d, 80, 55, 28, 38, [232, 190, 160]);
      ellipse(d, 80, 35, 20, 12, [245, 215, 190]);
      rect(d, 40, 92, 120, H, [240, 236, 230]);
      return d;
    })(),
    false,
  ],
  'a beach': [
    (() => {
      const d = canvas([225, 200, 160]);
      rect(d, 0, 0, W, 48, [140, 190, 235]);
      rect(d, 0, 48, W, 60, [40, 110, 160]);
      return d;
    })(),
    false,
  ],
  'pale fur (light, but not paper-light)': [canvas([178, 166, 150]), false],
  'a little white paper among colour (under 15%)': [
    (() => {
      const d = canvas([200, 60, 50]);
      rect(d, 0, 0, 30, 60, [250, 235, 205]);
      return d;
    })(),
    false,
  ],
};

test('Paper looks warm: shown for clearly warm paper (L 75+, 15% of the picture, b* 8+), never for sunsets, wood or skin', () => {
  const { __eval: E } = app();
  const got = {};
  for (const [name, [d]] of Object.entries(PHOTOS))
    got[name] = JSON.parse(
      E(`(function () { const r = paperWarm(new Uint8ClampedArray(${JSON.stringify([...d])}));
        return JSON.stringify(r && { L: r.lab[0], b: r.lab[2], share: r.share, gain: [...r.fix.gain] }); })()`),
    );
  for (const [name, [, want]] of Object.entries(PHOTOS))
    assert.equal(!!got[name], want, name + ': ' + JSON.stringify(got[name]));
  for (const r of Object.values(got).filter(Boolean)) {
    assert.ok(r.L >= 75 && r.b >= 8 && r.share >= 0.15, JSON.stringify(r));
    // the correction cools the picture: blue gains more than red
    assert.ok(r.gain[2] > r.gain[0] * 1.1, JSON.stringify(r));
  }
});

test('Paper looks warm: the correction is what tapping that paper does (paperSpot of paperOf), and it whitens the paper', () => {
  const { __eval: E } = app();
  const d = JSON.stringify([...PHOTOS['caps on paper, slightly warm lamp'][0]]);
  const r = JSON.parse(
    E(`(function () { const d = new Uint8ClampedArray(${d}), w = paperWarm(d), s = paperSpot(paperOf(d));
      const px = lightApply(w.fix, d[0], d[1], d[2]), lab = rgbLab8(px[0], px[1], px[2]);
      return JSON.stringify({ same: JSON.stringify([...w.fix.gain]) === JSON.stringify([...s.fix.gain]), lab: [...lab] }); })()`),
  );
  assert.ok(r.same, 'the same correction as a tap on the paper');
  assert.ok(
    Math.hypot(r.lab[1], r.lab[2]) < 3,
    'the paper comes out white: ' + r.lab.map((v) => v.toFixed(1)).join(' '),
  );
});

// ---- Palette's Rainbow scheme (U5) ---------------------------------------------------------------------------------
// an app with Ben's own markers (defaultOwned: 451), or these sets, owned; the guide's collection to match
function rainbowApp(sets) {
  const a = createApp(),
    E = a.__eval,
    t = a.__mstest;
  if (sets) {
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
  } else E('state.owned = new Set(defaultOwned())');
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { a, E, t };
}
const rb = (E, n, opts = '{}') => JSON.parse(E(`JSON.stringify(genPalette(${n}, 'rainbow', ${opts}))`));
const codes = (E, pal) => JSON.parse(E(`JSON.stringify(${JSON.stringify(pal)}.map((i) => mkey(i)))`));
// the Gradient's markers in the order they run, for n markers on a page of many sections, Smooth (one per band)
function gradientRun(t, n, src) {
  const N = 300,
    labels = new Int32Array(N + 1).map((_, i) => i),
    comps = [null];
  for (let l = 1; l <= N; l++)
    comps.push({
      area: 10,
      bg: false,
      bpx: 0,
      cx: l,
      cy: 1,
      h: 1,
      x0: l,
      y0: 0,
      x1: l,
      y1: 1,
      merged: false,
    });
  t.W = N + 1;
  t.H = 1;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.colored = new Uint8Array(comps.length);
  Object.assign(t.styleVars, {
    family: 'gradient',
    paletteSource: 'owned',
    palette: 'all',
    emphasis: 'neutral',
    gradSeed: 0,
    dir: 1,
    look: 'smooth',
    gradShape: 'serpentine',
    limitN: n,
    expand: false,
    // (v308: a new guide's Gradient, Include as the Mood has it, as Palette's Rainbow picks)
    gradIncl: {},
    ...src,
  });
  return [...t.grad.plan(t.grad.poolSource(n), N).seq].map((m) => m.mkey);
}

// (v308) the same markers in the same order round the loop: Palette's Rainbow starts at red (rainbowOrder), wherever
// the Gradient's loop starts and whichever way it runs
function sameLoop(a, b) {
  if (a.length !== b.length) return false;
  for (const s of [b, b.slice().reverse()])
    for (let k = 0; k < s.length; k++) if (a.every((x, j) => x === s[(j + k) % s.length])) return true;
  return false;
}
test('Rainbow: the Gradient’s markers in its order at the same count; a saved or generated Rainbow lays the same', () => {
  const { E, t } = rainbowApp();
  for (const n of [6, 8, 10, 12, 14]) {
    const pal = codes(E, rb(E, n));
    assert.equal(pal.length, n);
    assert.ok(sameLoop(pal, gradientRun(t, n)), n + ': the Gradient’s own');
    assert.ok(sameLoop(gradientRun(t, n, { paletteSource: 'generate', genPal: pal }), pal), n + ': laid from the palette');
  }
});

test('Rainbow: no two colours under ΔE 5 where another marker near that hue will do (Ben’s teal–cyan at 16)', () => {
  const { E, t } = rainbowApp();
  const own = gradientRun(t, 16),
    min = (keys) => E(`palMinDE(${JSON.stringify(keys)}.map(keyIdx))`);
  // (v308: the Gradient's own 16, from Ben's vivid markers with lightness following hue, no longer has a pair under 5,
  // B111 and B112 3.9 apart before; the Rainbow is the Gradient's 16)
  assert.ok(min(own) >= 5, 'the Gradient’s: ' + min(own));
  const pal = codes(E, rb(E, 16));
  assert.equal(pal.length, 16);
  assert.ok(min(pal) >= 5, 'the Rainbow’s: ' + min(pal));
  assert.equal(pal.filter((k) => own.includes(k)).length, 16, 'the Gradient’s own');
  assert.ok(E(`palOnScheme(${JSON.stringify(pal)}.map(keyIdx), 'rainbow')`));
  // lightness follows hue now (yellow light, violet dark), within the vivid band
  const L = JSON.parse(E(`JSON.stringify(${JSON.stringify(pal)}.map((k) => LCH[keyIdx(k)][0]))`));
  assert.ok(Math.max(...L) - Math.min(...L) < 55, L.join(' '));
});

test('Rainbow: Generate rolls others (seeded), each a rainbow; locked colours stay where they are', () => {
  const { E } = rainbowApp();
  const first = rb(E, 8),
    seen = new Set();
  for (let k = 0; k < 6; k++) {
    const p = rb(E, 8, '{ reroll: true }');
    assert.equal(p.length, 8);
    assert.equal(new Set(p).size, 8, 'no marker twice');
    assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`), 'round the wheel');
    seen.add(p.join());
  }
  assert.ok(seen.size >= 3, seen.size + ' different rolls of 6');
  // the same seed gives the same palette
  const s1 = E(
      `JSON.stringify(SF.rainbowPick(8, 'neutral', COLORS.map((c, i) => i).filter(inPool), { seed: 0.3 }))`,
    ),
    s2 = E(
      `JSON.stringify(SF.rainbowPick(8, 'neutral', COLORS.map((c, i) => i).filter(inPool), { seed: 0.3 }))`,
    );
  assert.equal(s1, s2);
  // locks: two colours kept, the others picked round them, still round the wheel (v308: in rainbow order from red, the
  // locked ones in their places in it)
  const lk = { 0: first[3], 5: first[0] };
  for (let k = 0; k < 4; k++) {
    const p = rb(E, 8, `{ reroll: true, locked: ${JSON.stringify(lk)} }`);
    assert.equal(p.length, 8);
    assert.ok(p.includes(first[3]));
    assert.ok(p.includes(first[0]));
    assert.equal(new Set(p).size, 8);
    assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`));
  }
});

test('Rainbow: from the markers in play (filters, a selection), the catalogue with none owned, capped at the clear ones', () => {
  let { E } = rainbowApp();
  // a family filtered out stays out
  E(`state.excluded = new Set(['Fluorescent'])`);
  let p = rb(E, 12);
  assert.equal(p.length, 12);
  assert.ok(
    JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => COLORS[i].fam !== 'Fluorescent'))`)),
  );
  E(`state.excluded = new Set()`);
  // a selection: only its markers
  E(
    `setPool(COLORS.map((c, i) => i).filter((i) => isOwned(i) && LCH[i][1] >= 25).filter((_, k) => k % 3 === 0))`,
  );
  p = rb(E, 10);
  assert.equal(p.length, 10);
  assert.ok(JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => state.pool.includes(i)))`)));
  E('setPool(null)');
  // none owned: the whole catalogue
  E('state.owned = new Set()');
  p = rb(E, 16);
  assert.equal(p.length, 16);
  assert.ok(E(`palMinDE(${JSON.stringify(p)})`) >= 5);
  // Ciao 12: 11 clear colours and a black; 12 or 16 gives the 11, never the black (v308: past its vivid ones, the
  // other clear ones, as Palette says there are)
  ({ E } = rainbowApp(['Ciao 12']));
  for (const n of [12, 16]) {
    p = rb(E, n);
    const clear = E(`COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] >= GREY_C).length`);
    assert.equal(p.length, Math.min(n, clear), n + '');
    assert.ok(
      JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => LCH[i][1] >= GREY_C))`)),
      'no grey',
    );
  }
  // too few clear markers for 6: none
  ({ E } = rainbowApp());
  E(`setPool(COLORS.map((c, i) => i).filter((i) => isOwned(i) && LCH[i][1] >= 25).slice(0, 4))`);
  assert.equal(E(`genPalette(6, 'rainbow', {})`), null);
});

test('Rainbow: on its scheme as Palette judges it; a re-rolled colour fills its own gap and keeps it a rainbow', () => {
  const { E } = rainbowApp();
  const p = rb(E, 10);
  assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`));
  // a palette of blues and reds isn't a rainbow
  const two = rb(E, 10).filter((_, k) => k < 2);
  assert.equal(E(`palOnScheme(${JSON.stringify(two.concat(two))}, 'rainbow')`), false);
  assert.equal(E(`genNeed('rainbow')`), 5);
  for (let k = 0; k < 10; k++) {
    const pick = E(`rerollPick(${JSON.stringify(p)}, ${k}, 'rainbow')`);
    assert.ok(pick >= 0 && !p.includes(pick), k + ': another marker');
    const np = p.slice();
    np[k] = pick;
    assert.ok(E(`palOnScheme(${JSON.stringify(np)}, 'rainbow')`), k + ': still a rainbow');
    // near the hue it had (its gap's middle), not across the wheel
    const d = E(`hueDist(LCH[${pick}][2], LCH[${p[k]}][2])`);
    assert.ok(d <= 45, k + ': ' + d.toFixed(0) + '°');
  }
});

// ---- Home's latest piece: which guide ------------------------------------------------------------------------------
test('Home’s latest piece: the newest guide when finished and nothing is in progress; none otherwise', () => {
  const { __eval: E } = app();
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
  assert.equal(pick([]), null, 'empty Home');
  assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 0, 2)]), 'A');
  assert.equal(pick([g('A', 10, 0, 3), g('B', 10, 10, 2)]), null, 'the newest isn’t finished');
  assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 4, 2)]), null, 'Continue keeps priority');
  assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 0, 2, { tn: 2 })]), null, 'some tones: in progress');
  assert.equal(pick([g('A', 12, 10, 3)]), null, 'sections added in Edit sections');
  assert.equal(pick([g('A', 0, 0, 3)]), null, 'no sections');
  // a picture that couldn't be read: none
  E(`_heroBad['3|3'] = 1`);
  assert.equal(pick([g('A', 10, 10, 3)]), null);
  assert.equal(E(`heroDate(new Date(new Date().getFullYear(), 9, 4).getTime())`), '4 Oct');
  assert.equal(E(`heroDate(new Date(2024, 9, 4).getTime())`), '4 Oct 2024');
});
