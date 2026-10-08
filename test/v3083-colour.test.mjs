// v308.3 (colour): the Gradient's vivid set keeps every colour family the collection has (Any and Bright), Ben's
// 451 laid exactly as before; the data fix (Ohuhu V013 "Violet"); the colours neither text reads on at 4.5:1 (Focus
// mode's chips give their words a halo: txtWeak).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

// an app with Ben's own markers (defaultOwned: 451), or these sets, owned
function appWith(sets) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  if (sets) {
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
  } else E('state.owned = new Set(defaultOwned())');
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, E, t };
}
function setPage(t, W, H, labels, n, given) {
  const comps = given || [null];
  if (!given) {
    for (let l = 1; l <= n; l++)
      comps.push({ area: 0, sx: 0, sy: 0, bg: false, bpx: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const l = labels[y * W + x];
        if (l < 1) continue;
        const c = comps[l];
        c.area++;
        c.sx += x;
        c.sy += y;
        c.x0 = Math.min(c.x0, x);
        c.y0 = Math.min(c.y0, y);
        c.x1 = Math.max(c.x1, x);
        c.y1 = Math.max(c.y1, y);
      }
    comps.forEach((c) => {
      if (!c) return;
      c.cx = c.sx / c.area;
      c.cy = c.sy / c.area;
      c.h = c.y1 - c.y0;
    });
  }
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.colored = new Uint8Array(comps.length);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  for (const k in t.locks) delete t.locks[k];
  return t.countedList();
}
// cols × rows sections of uneven sizes (from a seed), lines lw px between them
function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
    ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
    hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
    W = ws.reduce((a, b) => a + b + lw, lw),
    H = hs.reduce((a, b) => a + b + lw, lw),
    labels = new Int32Array(W * H).fill(-1);
  const comps = [null];
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
  return setPage(t, W, H, labels, comps.length - 1, comps);
}
// a mandala: a middle, then rings of `k` matching petals (lines between them)
function mandala(t, rings = 4, k = 12, S = 400) {
  const labels = new Int32Array(S * S).fill(-1),
    c = S / 2,
    band = (S / 2 - 30) / rings;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r < 18) {
        labels[y * S + x] = 1;
        continue;
      }
      const ri = Math.floor((r - 20) / band);
      if (r < 20 || ri >= rings || r - 20 - ri * band < 2) continue;
      const a = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360,
        si = Math.floor(a / (360 / k));
      if (a - si * (360 / k) < 2) continue;
      labels[y * S + x] = 2 + ri * k + si;
    }
  return setPage(t, S, S, labels, 1 + rings * k);
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
      gradIncl: {},
    },
    o,
  );
const usedMs = (t) => {
  const seen = new Map();
  t.assignData.order.forEach((l) => seen.set(t.assignData.assign[l].mkey, t.assignData.assign[l]));
  return [...seen.values()];
};
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const laid = (t) => hash(t.assignData.order.map((l) => l + ':' + t.assignData.assign[l].mkey).join(','));
const SETS = JSON.parse(
  createApp().__eval('JSON.stringify(MARKER_SETS.map((s) => [s.n, presetMkeys(s).length]))'),
).filter((s) => s[1] <= 60);
// the families a set has inside the Mood: colours (no Include group) of chroma over 20
function hasFams(t, mood) {
  const M = { neutral: [12, 999], vivid: [45, 999] }[mood];
  return new Set(
    t.coll
      .filter((m) => {
        const C = t.colour.lch(m)[1];
        return !t.grad.inclGroup(m) && C > 20 && C >= M[0];
      })
      .map((m) => t.grad.fam8(m)),
  );
}

test('the eight families go by how the colour looks: B29 a blue, V09 and BV08 violets, BG09 a cyan, RV04 a pink, R29 a red', () => {
  const { t } = appWith(['Ciao 12', 'Honolulu 24']);
  const f = (c) => t.grad.fam8(t.coll.find((m) => m.code === c));
  assert.deepEqual(
    ['B29', 'V09', 'BV08', 'BG09', 'RV04', 'R29', 'YR07', 'Y06', 'G17', 'V010', 'V416'].map(f),
    ['blue', 'violet', 'violet', 'cyan', 'pink', 'red', 'orange', 'yellow', 'green', 'violet', 'violet'],
  );
});

test('Any and Bright keep every colour family a set of 60 or fewer has: Honolulu 24 its violets V010 and V416 (14), Ciao 12 its V09', () => {
  for (const [n] of SETS) {
    const { t } = appWith([n]);
    page(t, 18, 12);
    for (const mood of ['neutral', 'vivid']) {
      style(t, { emphasis: mood });
      const kept = new Set([...t.grad.inclPool(216).items].map((m) => t.grad.fam8(m)));
      const lost = [...hasFams(t, mood)].filter((f) => !kept.has(f));
      assert.deepEqual(lost, [], `${n} ${mood}: lost ${lost.join(', ')}`);
    }
  }
  const { t } = appWith(['Honolulu 24']);
  page(t, 18, 12);
  style(t, {});
  const h24 = [...t.grad.inclPool(216).items].map((m) => m.code);
  assert.equal(h24.length, 14);
  assert.ok(h24.includes('V010') && h24.includes('V416'), h24.join(' '));
  // (as many as a kept family has on average: Ciao 12's have one each, so its violet gets one, the more vivid V09)
  const c = appWith(['Ciao 12']).t;
  page(c, 18, 12);
  style(c, {});
  const c12 = [...c.grad.inclPool(216).items].map((m) => m.code);
  assert.ok(c12.includes('V09') && !c12.includes('BV08'), c12.join(' '));
});

test('browns, greys and fluorescents still go by Include: a kept-back marker is never one of theirs; Browns on adds its browns to them', () => {
  for (const [n] of SETS) {
    const { t } = appWith([n]);
    page(t, 18, 12);
    style(t, {});
    const off = [...t.grad.inclPool(216).items].filter((m) => t.grad.inclGroup(m));
    // (a set with fewer than 2 vivid markers, or too few for the Mood, is widened from outside it as before: Skin
    // Tones, Gray Tones)
    if (t.grad.inclPool(216).widened || t.coll.filter((m) => t.grad.vivid(m)).length < 2) continue;
    assert.deepEqual(
      off.map((m) => m.code),
      [],
      n,
    );
  }
  const { t } = appWith(['Honolulu 24']);
  page(t, 18, 12);
  style(t, { gradIncl: { browns: true } });
  const items = [...t.grad.inclPool(216).items];
  assert.ok(items.some((m) => m.code === 'V010') && items.some((m) => t.grad.inclGroup(m) === 'browns'));
  assert.ok(items.every((m) => ['', 'browns'].includes(t.grad.inclGroup(m))));
});

test('the other Moods (Soft, Pastel, Deep, Earthy) are as they were', () => {
  const want = {
    'Honolulu 24 muted': 'B08 BG114 BG311 BV310 G36 RV08 V010 V18',
    'Honolulu 24 muted grad': 'c521a82a6170d893',
    'Honolulu 24 pastel': 'B08 BG114 G36 G410 RV08 V18 Y111 Y26',
    'Honolulu 24 pastel grad': 'b2d7c91c9866fc64',
    'Honolulu 24 deep': 'B111 BV310 G312 R014 R413 RV311 V010 V416',
    'Honolulu 24 deep grad': 'd5b65fedd4a9b6e1',
    'Honolulu 24 earthy': 'B111 BG114 BG311 BV310 G310 R210 V010 YR313',
    'Honolulu 24 earthy grad': '568a6e4f2a11ea8d',
    'Ciao 12 muted': 'BG09 BV08 G17 R29 RV04 V09 YG06 YR07',
    'Ciao 12 muted grad': '7d25606b7d1ee62a',
    'Ciao 12 pastel': 'B29 BG09 G17 R29 RV04 Y06 YG06 YR07',
    'Ciao 12 pastel grad': 'aada9fc725cb1f9e',
    'Ciao 12 deep': 'B29 BG09 BV08 G17 R29 RV04 V09 YR07',
    'Ciao 12 deep grad': '45aed36deaa0dd15',
    'Ciao 12 earthy': 'BG09 BV08 E29 G17 R29 RV04 V09 YR07',
    'Ciao 12 earthy grad': '938085ecab7e2116',
    '48 Mid-tone Set muted': 'B09 B311 BG211 BV08 BV415 BV48 BV58 G44 R57 RV57 V29 V412 V46 YG36',
    '48 Mid-tone Set muted grad': '422f1dabb365bad8',
    '48 Mid-tone Set pastel': 'G44 R23 Y09 Y39 Y46 YG111 YG112 YG36',
    '48 Mid-tone Set pastel grad': '84ae2d34fdebf7a9',
    '48 Mid-tone Set deep': 'BV013 BV28 BV415 R410 R48 RV29 V29 V412',
    '48 Mid-tone Set deep grad': '145621e71f003f7c',
    '48 Mid-tone Set earthy': 'BV28 BV415 E413 E610 R57 V29 V412 YR312',
    '48 Mid-tone Set earthy grad': '2654fe5578e59468',
  };
  for (const set of ['Honolulu 24', 'Ciao 12', '48 Mid-tone Set']) {
    const { t } = appWith([set]);
    for (const mood of ['muted', 'pastel', 'deep', 'earthy']) {
      const cl = page(t, 18, 12);
      style(t, { emphasis: mood });
      assert.equal(
        [...t.grad.inclPool(216).items]
          .map((m) => m.code)
          .sort()
          .join(' '),
        want[`${set} ${mood}`],
        `${set} ${mood}`,
      );
      t.grad.build(cl);
      assert.equal(laid(t), want[`${set} ${mood} grad`], `${set} ${mood} laid`);
    }
  }
});

test('the count’s end, “all”, what all lays and the line under Include agree, on a big page and a small one', () => {
  for (const n of [
    'Honolulu 24',
    'Honolulu 48',
    'Ciao 12',
    'Ciao 24',
    'Ciao 36 - Set D',
    '48 Mid-tone Set',
    'Sketch 12',
  ]) {
    const { t } = appWith([n]);
    for (const [cols, rows] of [
      [18, 12],
      [4, 3],
    ]) {
      const cl = page(t, cols, rows);
      for (const mood of ['neutral', 'vivid']) {
        style(t, { emphasis: mood });
        // (the slider's end, mkCap: the smaller of the sections and the markers left)
        const left = t.grad.sliderMax(),
          cap = t.grad.mkCap(),
          at = `${n} ${cols}×${rows} ${mood}`;
        assert.equal(cap, Math.min(cl.length, left), `${at}: slider ends at ${cap}, ${left} left`);
        assert.equal(t.grad.mkCountLabel(), 'all · ' + cap, at);
        // the line under Include says the markers left
        assert.equal(+t.grad.inclStatus().match(/^(\d+) of your markers/)[1], left, at);
        // and all lays as many as it says
        t.grad.build(cl);
        assert.equal(usedMs(t).length, cap, `${at}: all lays ${cap}`);
      }
    }
  }
});

test('Ben’s 451: the same markers left and the same Gradients as v308.2, every Mood and Temperature; Palette’s Rainbow too', () => {
  const want = {
    'pool neutral all': '1f001b85c67ab078',
    'pool neutral warm': 'ddb575ac82d9f18b',
    'pool neutral cool': 'df16ace2f366412a',
    'pool vivid all': '3b58e842409145c5',
    'pool vivid warm': '2f21c1d37e9375bf',
    'pool vivid cool': '091a0b3e33ff4c13',
    'pool muted all': 'c4632db417638a73',
    'pool muted warm': 'e89ac395f003388f',
    'pool muted cool': '0a60a18f38ab52aa',
    'pool pastel all': '82a59410d9221b95',
    'pool pastel warm': '91bc6b12a4677252',
    'pool pastel cool': 'aa3360f80055caf2',
    'pool deep all': '3a1e2aaf491f03ff',
    'pool deep warm': '13af5050f5b9405e',
    'pool deep cool': '32797dbcb95089e5',
    'pool earthy all': 'f0400e2466a924ac',
    'pool earthy warm': '48f3519f72e87465',
    'pool earthy cool': '42886b042d24462a',
    'grad neutral all 16 serpentine': 'e2c7a562423d5f80',
    'grad neutral all 24 radial': '38bae292f012e9a7',
    'grad neutral all 999 serpentine': '27e27b385c58924c',
    'grad neutral warm 16 serpentine': '3dff30d3f12b0d75',
    'grad neutral warm 24 radial': '307f7f655c5c0f1c',
    'grad neutral warm 999 serpentine': '16c3393e99d2f4ac',
    'grad neutral cool 16 serpentine': 'aff5acfe5ce1cd67',
    'grad neutral cool 24 radial': '16d49b249b463a21',
    'grad neutral cool 999 serpentine': '0a5b3b3dc009c77d',
    'grad vivid all 16 serpentine': '1a45d42e59e3d588',
    'grad vivid all 24 radial': '1bd9318cdacd0cda',
    'grad vivid all 999 serpentine': 'd38762645e39f26d',
    'grad vivid warm 16 serpentine': '40f113fac6743a9a',
    'grad vivid warm 24 radial': '8a6526f7082c6499',
    'grad vivid warm 999 serpentine': 'aff0a9fad973ea91',
    'grad vivid cool 16 serpentine': 'be059fde218804de',
    'grad vivid cool 24 radial': 'ed6b84ef5e4b9b40',
    'grad vivid cool 999 serpentine': '5079bd2ab3945366',
    'rainbow neutral 6': '331,557,526,297,237,115',
    'rainbow neutral 8': '8,352,547,526,298,630,270,115',
    'rainbow neutral 12': '331,352,557,185,526,301,297,630,237,641,115,25',
    'rainbow neutral 16': '557,547,540,526,517,298,661,630,621,270,282,115,21,8,57,352',
    'rainbow vivid 6': '331,557,526,297,237,481',
    'rainbow vivid 8': '331,352,547,526,298,630,270,481',
    'rainbow vivid 12': '331,57,352,557,185,526,301,297,630,237,641,481',
    'rainbow vivid 16': '331,57,352,557,547,540,526,313,298,661,630,621,270,282,481,487',
  };
  const { E, t } = appWith();
  for (const mood of ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'])
    for (const pal of ['all', 'warm', 'cool']) {
      page(t, 18, 12);
      style(t, { emphasis: mood, palette: pal });
      const k = `pool ${mood} ${pal}`;
      assert.equal(
        hash(
          [...t.grad.inclPool(1).items]
            .map((m) => m.mkey)
            .sort()
            .join(','),
        ),
        want[k],
        k,
      );
    }
  for (const mood of ['neutral', 'vivid'])
    for (const pal of ['all', 'warm', 'cool'])
      for (const [n, shape] of [
        [16, 'serpentine'],
        [24, 'radial'],
        [999, 'serpentine'],
      ]) {
        const cl = page(t, 18, 12);
        style(t, { emphasis: mood, palette: pal, limitN: n, gradShape: shape });
        t.grad.build(cl);
        const k = `grad ${mood} ${pal} ${n} ${shape}`;
        assert.equal(laid(t), want[k], k);
      }
  const idx = JSON.parse(
    E('JSON.stringify(COLORS.map((c, i) => i).filter((i) => state.owned.has(mkey(i))))'),
  );
  for (const mood of ['neutral', 'vivid'])
    for (const n of [6, 8, 12, 16])
      assert.equal(
        [...t.grad.rainbow(n, mood, idx)].join(','),
        want[`rainbow ${mood} ${n}`],
        `rainbow ${mood} ${n}`,
      );
});

test('a Temperature keeps its own families: Warm’s one plum at its red-violet edge (RV316) isn’t brought back as a violet', () => {
  const { t } = appWith();
  page(t, 18, 12);
  style(t, { palette: 'warm' });
  const items = [...t.grad.inclPool(216).items];
  assert.ok(!items.some((m) => m.code === 'RV316'));
  assert.ok(items.every((m) => t.grad.vivid(m)));
});

test('data: Ohuhu V013 is “Violet”; E415, E69 and Y34 as they were', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/markers.json', import.meta.url), 'utf8'));
  const name = (c) => data.find((m) => m.brand === 'Ohuhu' && m.code === c).name;
  assert.equal(name('V013'), 'Violet');
  assert.equal(name('E415'), 'Cedar brown');
  assert.equal(name('E69'), 'Russet brown');
  assert.equal(name('Y34'), 'Eggnog yellow');
});

test('txtWeak: the 21 of the 722 colours neither dark text nor white reads on at 4.5:1 (R413, B315, V015…; not Y28)', () => {
  const { E } = appWith();
  const weak = JSON.parse(
    E('JSON.stringify(COLORS.filter((c) => txtWeak(c.hex)).map((c) => c.brand + " " + c.code))'),
  );
  assert.equal(weak.length, 21);
  for (const c of ['Ohuhu R413', 'Ohuhu B315', 'Ohuhu V015', 'Ohuhu R014', 'Copic YR18', 'Copic B06'])
    assert.ok(weak.includes(c), c);
  assert.ok(!weak.includes('Ohuhu Y28'));
  assert.equal(E('txtWeak("#ffffff") || txtWeak("#000000")'), false);
});
