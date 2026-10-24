// Colour along, Focus mode, the share card.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core, createApp, memoryStorage } from './harness.mjs';

// ---- from focus-mode.test.mjs ----
// Focus mode walks one section at a time: colours light -> dark, and within a
// colour from its top-most section to the nearest remaining one.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  // 10 x 10 grid of 10px cells; section id = 1 + row*10 + col.
  function grid(assignFor) {
    const W = 100,
      H = 100,
      labels = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) labels[y * W + x] = 1 + ((y / 10) | 0) * 10 + ((x / 10) | 0);
    const assign = {},
      order = [];
    for (let l = 1; l <= 100; l++) {
      const r = ((l - 1) / 10) | 0,
        c = (l - 1) % 10,
        a = assignFor(r, c);
      if (a) {
        assign[l] = a;
        order.push(l);
      }
    }
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = [null, ...Array.from({ length: 100 }, () => ({ area: 100, cx: 0, cy: 0 }))];
    core.colored = new Uint8Array(101);
    core.assignData = { order, assign, N: order.length };
    core.buildFocusOrder();
    return [...core.focusOrd];
  }
  const LIGHT = { mkey: 'Ohuhu|L', hex: '#f4f0e8' },
    MID = { mkey: 'Ohuhu|M', hex: '#80a0c0' },
    DARK = { mkey: 'Ohuhu|D', hex: '#202030' };
  test('every counted section appears exactly once', () => {
    const ord = grid((r, c) => (c < 3 ? LIGHT : c < 7 ? DARK : r < 5 ? MID : null));
    assert.equal(ord.length, core.assignData.N);
    assert.equal(new Set(ord).size, ord.length);
  });
  test('colours are ordered light to dark, one colour at a time', () => {
    const ord = grid((r, c) => (c < 3 ? DARK : c < 6 ? LIGHT : MID));
    const runs = [];
    for (const l of ord) {
      const k = core.assignData.assign[l].mkey;
      if (runs[runs.length - 1] !== k) runs.push(k);
    }
    assert.deepEqual(runs, ['Ohuhu|L', 'Ohuhu|M', 'Ohuhu|D']);
  });
  test('within a colour it starts at the top and steps to a neighbour', () => {
    // one colour in a diagonal band; each step should move at most one cell
    const ord = grid((r, c) => (Math.abs(r - c) <= 1 ? LIGHT : null));
    const rc = (l) => [((l - 1) / 10) | 0, (l - 1) % 10];
    assert.equal(rc(ord[0])[0], 0, 'starts on the top row');
    for (let i = 1; i < ord.length; i++) {
      const [r0, c0] = rc(ord[i - 1]),
        [r1, c1] = rc(ord[i]);
      assert.ok(Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) <= 1, `hop ${i} is to an adjacent cell`);
    }
  });
  test('next skips finished sections and wraps; -1 when all are done', () => {
    const ord = grid((r, c) => (r === 0 && c < 4 ? LIGHT : null));
    core.colored[ord[1]] = 1;
    assert.equal(core.nextUndone(0), 2, 'skips the coloured one');
    core.colored[ord[2]] = 1;
    core.colored[ord[3]] = 1;
    assert.equal(core.nextUndone(3), 0, 'wraps to the start');
    core.colored[ord[0]] = 1;
    assert.equal(core.nextUndone(0), -1);
  });
}

// ---- from v305-show.test.mjs ----
// v305 show: the share card's title fits (one line, a little smaller, or two lines cut with "…"); the ribbon smooths
// many markers into bands; the keys' colour-family order; Colour along's list orders (Lightest first, Rainbow, By brand)
// while Home's Continue keeps lightest first; Save image's codes go automatic (on until every section is ticked) unless
// you've chosen.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    core = _app.__mstest;
  const COLORS = app.__eval('COLORS'),
    FAM_ORDER = app.__eval('FAM_ORDER'),
    lab = app.__eval('hexToLab');
  const mk = (c) => ({
    mkey: c.brand + '|' + c.code,
    code: c.code,
    brand: c.brand,
    hex: c.hex,
    name: c.name,
    lab: lab(c.hex),
  });
  const pick = (n, f = () => true) =>
    COLORS.filter((c) => !/colou?rless blender/i.test(c.name) && f(c))
      .slice(0, n)
      .map(mk);
  // a guide of n sections, section l (1…n) in markers[l-1]
  function guide(markers) {
    const n = markers.length,
      assign = {},
      order = [];
    core.comps = [null].concat(markers.map((m, i) => ({ area: 100 + i, cx: i, cy: 0 })));
    markers.forEach((m, i) => {
      assign[i + 1] = m;
      order.push(i + 1);
    });
    core.assignData = { assign, order, N: n, base: { ...assign } };
    core.colored = new Uint8Array(n + 1);
    return order;
  }
  // a measuring context: each letter half the font's size wide
  const fakeG = () => ({
    font: '',
    measureText(t) {
      const px = parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]);
      return { width: String(t).length * px * 0.5 };
    },
  });
  test('the card’s title: one line when it fits, a little smaller, else two lines with the rest cut short by “…”', () => {
    const g = fakeG();
    let r = core.showTitleFit(g, 'Spectrum Siren', 900, 58);
    assert.deepEqual([...r.lines], ['Spectrum Siren']);
    assert.equal(r.fs, 58);
    // 34 letters × 29 = 986 > 900, at 82% 808: one line, smaller
    r = core.showTitleFit(g, 'A rather long name for a mandala!!', 900, 58);
    assert.equal(r.lines.length, 1);
    assert.ok(r.fs < 58);
    const long =
      'The great big spiral mandala with the jellyfish and the octopus and all their friends under the sea';
    r = core.showTitleFit(g, long, 600, 58);
    assert.equal(r.lines.length, 2, 'two lines at most');
    for (const l of r.lines) assert.ok(l.length * r.fs * 0.5 <= 600 + 0.01, 'inside the width: ' + l);
    assert.match(r.lines[1], /…$/, 'the rest cut short');
    // a single word longer than the line
    r = core.showTitleFit(g, 'Supercalifragilisticexpialidocious'.repeat(2), 300, 40);
    assert.equal(r.lines.length, 1);
    assert.ok(r.lines[0].length * r.fs * 0.5 <= 300 + 0.01);
    assert.match(r.lines[0], /…$/);
  });
  test('the ribbon: each marker its own colour up to 24, past that 24 bands', () => {
    guide(pick(10));
    assert.equal(core.showBands(core.showMarkers()).length, 10);
    const many = pick(60);
    guide(many);
    const b = core.showBands(core.showMarkers());
    assert.equal(b.length, 24);
    for (const c of b) assert.ok(c.every((v) => v >= 0 && v <= 255));
  });
  test('the keys’ order: colour families round the wheel, lightest first in each', () => {
    const ms = pick(80);
    const sorted = ms.slice().sort(core.famCmp);
    const fam = (m) => COLORS.find((c) => c.brand === m.brand && c.code === m.code).fam;
    for (let i = 1; i < sorted.length; i++) {
      const a = FAM_ORDER.indexOf(fam(sorted[i - 1])),
        b = FAM_ORDER.indexOf(fam(sorted[i]));
      assert.ok((a < 0 ? 99 : a) <= (b < 0 ? 99 : b), 'families in order');
      if (fam(sorted[i - 1]) === fam(sorted[i]))
        assert.ok(sorted[i - 1].lab[0] >= sorted[i].lab[0], 'lightest first');
    }
  });
  test('Colour along’s list orders; Home’s Continue still goes lightest first', () => {
    const ms = pick(6, (c) => c.brand === 'Ohuhu').concat(pick(6, (c) => c.brand === 'Copic'));
    guide(ms);
    const keys = (L) => [...L].map((e) => e.key);
    const light = keys(core.alongList());
    const lum = (h) => {
      const n = parseInt(h.slice(1), 16);
      return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    const byKey = Object.fromEntries(ms.map((m) => [m.mkey, m]));
    for (let i = 1; i < light.length; i++)
      assert.ok(lum(byKey[light[i - 1]].hex) >= lum(byKey[light[i]].hex), 'lightest first');
    const rb = [...core.alongList('rainbow')].map((e) => e.m);
    for (let i = 1; i < rb.length; i++)
      assert.ok(core.famCmp(rb[i - 1], rb[i]) <= 0, 'rainbow: as the keys go');
    assert.notDeepEqual(
      rb.map((m) => m.mkey),
      light,
      'not the same as lightest first here',
    );
    const br = [...core.alongList('brand')].map((e) => e.m);
    assert.deepEqual(
      br.map((m) => m.brand),
      [
        'Copic',
        'Copic',
        'Copic',
        'Copic',
        'Copic',
        'Copic',
        'Ohuhu',
        'Ohuhu',
        'Ohuhu',
        'Ohuhu',
        'Ohuhu',
        'Ohuhu',
      ],
      'by brand',
    );
    for (let i = 1; i < br.length; i++)
      if (br[i].brand === br[i - 1].brand)
        assert.ok(br[i - 1].code.localeCompare(br[i].code, 'en', { numeric: true }) <= 0, 'by code');
    assert.equal(core.alongSort(), 'light', 'lightest first unless chosen');
  });
  test('Save image’s codes: on until every section is ticked, then off; a choice made is kept', () => {
    const order = guide(pick(5));
    core.exCodes = null;
    assert.equal(core.exCodesNow(), true, 'codes while there is colouring to do');
    order.slice(0, 4).forEach((l) => (core.colored[l] = 1));
    assert.equal(core.exCodesNow(), true);
    core.colored[order[4]] = 1;
    assert.equal(core.exCodesNow(), false, 'finished: the picture as it is');
    core.exCodes = true;
    assert.equal(core.exCodesNow(), true, 'your choice stands');
    core.colored[order[4]] = 0;
    core.exCodes = false;
    assert.equal(core.exCodesNow(), false);
    core.exCodes = null;
  });
}

// ---- from v306-along.test.mjs ----
// v306 (along): the same code in both brands (warnings only, worked out from the guide as shown), finding a marker by
// its code in Colour along, and "Did any run low?" once a page is finished.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  // Ben's 451 markers as the guide's collection, and a guide whose sections (1, 2, …) take the markers given by key
  function benApp(opts = {}) {
    const app = createApp(opts),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set([...defaultOwned()]); state.ink = {}; state.wish = [];');
    t.coll = E('sfCollection()');
    return { app, E, t };
  }
  function guideOf(t, keys) {
    const by = {};
    t.coll.forEach((m) => {
      by[m.mkey] = m;
    });
    const assign = {},
      order = [];
    keys.forEach((k, i) => {
      assert.ok(by[k], 'owned: ' + k);
      assign[i + 1] = by[k];
      order.push(i + 1);
    });
    t.comps = [null].concat(keys.map((k, i) => ({ area: 100 * (keys.length - i), cx: 0, cy: 0 })));
    t.assignData = { assign, order, N: order.length };
  }
  const sorted = (o) => Object.keys(o).sort();
  // the shell's side: one tap is Running low and on To buy in one save, and Undo takes off only what it put on
  function shell(full) {
    const ls = memoryStorage();
    ls.setItem(
      KEY,
      JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R310', 'Ohuhu|Y26', 'Copic|Y26'],
        saved: [],
        wish: [{ k: 'Ohuhu|Y26', why: 'from Markers', ts: 1 }],
      }),
    );
    const app = createApp({ localStorage: ls }),
      E = app.__eval;
    if (full) {
      const set = ls.setItem;
      ls.setItem = (k, v) => {
        if (k === KEY) throw new Error('QuotaExceededError');
        return set(k, v);
      };
    }
    return { E, ls };
  }
  const st = (E) =>
    JSON.parse(E("JSON.stringify({ ink: state.ink, wish: state.wish.map((w) => w.k + ':' + w.why) })"));
  // (v318.21: sameCodeScan gives {b: another brand's, s: the same brand's, an older cap's and one of now}; b here)
  test('same code: every code Ben owns in both brands (18) is marked when the guide has both, whatever the colour difference', () => {
    const { E, t } = benApp();
    const both = JSON.parse(
      E(
        `JSON.stringify((function () { const b = {}; for (const k of state.owned) { const [br, c] = k.split('|'); (b[c] = b[c] || new Set()).add(br); } return Object.keys(b).filter((c) => b[c].size > 1 && c !== '0').sort(); })())`,
      ),
    );
    assert.equal(both.length, 18, both.join(' '));
    // (Y06, B21, Y19 and B02 differ least, ΔE 11–14: still marked)
    for (const c of ['Y06', 'B21', 'Y19', 'B02', 'Y26', 'RV19']) assert.ok(both.includes(c), c);
    for (const c of both) {
      guideOf(t, ['Ohuhu|' + c, 'Copic|' + c, 'Copic|R20']);
      const s = t.sameCodeScan().b;
      assert.deepEqual(sorted(s), ['Copic|' + c, 'Ohuhu|' + c], c);
      assert.deepEqual(
        [...s['Ohuhu|' + c]].map((m) => m.mkey),
        ['Copic|' + c],
      );
      assert.equal(t.sameName(t.assignData.assign[1]), 'Copic ' + c);
      assert.equal(t.sameName(t.assignData.assign[3]), '', 'R20: one code, one brand');
    }
  });
  test('same code: one brand of a code is no warning; two sections of the same marker are none either', () => {
    const { t } = benApp();
    guideOf(t, ['Ohuhu|Y26', 'Ohuhu|Y26', 'Ohuhu|Y28']);
    assert.deepEqual(sorted(t.sameCodeScan().b), []);
    // (zones: each zone's sections are the guide's too, so a Copic Y26 laid in another zone counts)
    guideOf(t, ['Ohuhu|Y26', 'Ohuhu|G24', 'Copic|Y26', 'Copic|G24']);
    assert.deepEqual(sorted(t.sameCodeScan().b), ['Copic|G24', 'Copic|Y26', 'Ohuhu|G24', 'Ohuhu|Y26']);
  });
  test('find by code: the exact current code, both brands, codes that start another code, old codes left out, unknown codes', () => {
    const { E, t } = benApp();
    // Ohuhu RV18 was R14 (and Copic R14 is another marker); Copic Y21 and Ohuhu Y210; both brands' Y26
    guideOf(t, ['Ohuhu|RV18', 'Copic|Y21', 'Ohuhu|Y210', 'Ohuhu|Y26', 'Copic|Y26', 'Copic|R20']);
    assert.equal(E(`COLORS.find((c) => c.brand === 'Ohuhu' && c.code === 'RV18').old`), 'R14');
    let r = t.codeFind('y21');
    assert.deepEqual(
      r.base.map((m) => m.mkey),
      ['Copic|Y21'],
      'Y21 is Y21, not Y210',
    );
    assert.equal(t.findLine(r), 'Y21 ' + r.base[0].name);
    r = t.codeFind('Y2');
    assert.equal(r.base.length, 0);
    assert.deepEqual([...r.pre], ['Y21', 'Y26', 'Y210']);
    assert.equal(t.findLine(r), 'Codes starting Y2: Y21, Y26, Y210');
    r = t.codeFind(' y-26 ');
    assert.deepEqual(
      r.base.map((m) => m.mkey),
      ['Copic|Y26', 'Ohuhu|Y26'],
    );
    assert.match(t.findLine(r), /^Copic Y26 Mustard · Ohuhu Y26 /);
    // old codes find nothing: R14 is Copic R14's code, and only an old code here
    r = t.codeFind('R14');
    assert.equal(r.base.length + r.part.length, 0);
    assert.equal(t.findLine(r), 'R14 isn’t in this guide');
    assert.equal(t.findLine(t.codeFind('r99')), 'No marker R99');
    assert.equal(t.findLine(t.codeFind('')), '');
  });
  test('run low: the five that covered most of the page, yours and not dry, never the Colorless Blender', () => {
    const { app, t } = benApp();
    guideOf(t, [
      'Copic|R20',
      'Ohuhu|Y26',
      'Copic|Y26',
      'Ohuhu|B02',
      'Ohuhu|G24',
      'Copic|R20',
      'Ohuhu|V13',
      'Ohuhu|E311',
    ]);
    // (the shell's own lowInk, given to the guide with its api: Ohuhu Y26 marked dry, B02 no longer yours)
    app.__eval(`state.ink['Ohuhu|Y26'] = 'dry'; state.owned.delete('Ohuhu|B02');`);
    app.SF.configure({});
    // (areas 800, 700, …: R20 has sections 1 and 6, 800 + 300)
    const cov = t.lowCover();
    assert.equal(cov[0].k, 'Copic|R20');
    assert.equal(cov[0].a, 1100);
    assert.deepEqual(
      [...t.lowTop()],
      ['Copic|R20', 'Copic|Y26', 'Ohuhu|G24', 'Ohuhu|V13', 'Ohuhu|E311'],
      'no dry Y26, no B02 (not yours)',
    );
  });
  test('run low (the shell): one tap marks it and puts it on To buy, in one save; taking it back takes off only what it added', () => {
    const { E, ls } = shell();
    assert.equal(E(`lowInk('Ohuhu|R310')`), '');
    assert.equal(E(`lowInk('Copic|R20')`), null, 'not yours');
    assert.equal(
      E(`lowInk(COLORS.map((c, i) => mkey(i)).find((k, i) => NOINK.has(i)))`),
      null,
      'the Colorless Blender',
    );
    assert.equal(E(`JSON.stringify(lowMark('Ohuhu|R310'))`), '{"k":"Ohuhu|R310","added":true}');
    assert.deepEqual(st(E), {
      ink: { 'Ohuhu|R310': 'low' },
      wish: ['Ohuhu|Y26:from Markers', 'Ohuhu|R310:running low'],
    });
    const saved = JSON.parse(ls.getItem(KEY));
    assert.equal(saved.ink['Ohuhu|R310'], 'low', 'saved');
    assert.ok(saved.wish.some((w) => w.k === 'Ohuhu|R310'));
    assert.equal(E(`lowMark('Ohuhu|R310')`), null, 'already low');
    assert.equal(E(`lowUnmark('Ohuhu|R310', true)`), true);
    assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
    // already on To buy: marked low, and Undo leaves the entry it found there
    assert.equal(E(`JSON.stringify(lowMark('Ohuhu|Y26'))`), '{"k":"Ohuhu|Y26","added":false}');
    assert.equal(E(`lowUnmark('Ohuhu|Y26', false)`), true);
    assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
    // dry: not offered
    E(`state.ink['Copic|Y26'] = 'dry'`);
    assert.equal(E(`lowMark('Copic|Y26')`), null);
  });
  test('run low (the shell): storage full keeps neither the ink nor the To buy entry', () => {
    const { E } = shell(true);
    assert.equal(E(`lowMark('Ohuhu|R310')`), null);
    assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
  });
}

// ---- from v306-smalls.test.mjs ----
// v306 small changes: Smooth them steers clear of the other brand of a highlight's or shadow's code; Home's latest
// piece leaves out "(section edits)" copies; the shorter untick toast; find by code's line for a code that's only a
// highlight or shadow in the guide.
{
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

  test('the untick toast is short enough for one line at 390: “Copic BG0000 unticked” (v318.32 wording)', () => {
    const { __eval: E } = createApp({ localStorage: memoryStorage() });
    assert.equal(E(`addedLine(true, COLORS[keyIdx('Copic|BG0000')], 0)`), 'Copic BG0000 unticked');
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
}

// ---- from v307-along.test.mjs ----
// v307 (along): the find-by-code line names the zones when a code is a highlight in some zones and a shadow in
// others; the markers a shaded guide's highlights and shadows take besides its colours.
{
  // Ben's 451 markers as the guide's collection, and a guide whose sections (1, 2, …) take the markers given by key
  function benApp() {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set([...defaultOwned()]); state.ink = {}; state.wish = [];');
    t.coll = E('sfCollection()');
    return { app, E, t };
  }
  function guideOf(t, keys) {
    const by = {};
    t.coll.forEach((m) => {
      by[m.mkey] = m;
    });
    const assign = {},
      order = [];
    keys.forEach((k, i) => {
      assert.ok(by[k], 'owned: ' + k);
      assign[i + 1] = by[k];
      order.push(i + 1);
    });
    t.comps = [null].concat(keys.map((k, i) => ({ area: 100 * (keys.length - i), cx: 0, cy: 0 })));
    t.assignData = { assign, order, N: order.length };
    return by;
  }
  // what codeFind gives for a code that's only a highlight or shadow here: the marker, the markers it's the highlight
  // or shadow of, and the zones it's each in (zn)
  function partOf(m, hi, sh, zh, zs) {
    const o = (ms) => Object.fromEntries(ms.map((x) => [x.mkey, x]));
    return { m, highlight: o(hi), shadow: o(sh), zn: { highlight: zh, shadow: zs } };
  }
  const found = (raw, part) => ({ q: raw, raw, base: [], part, pre: [], known: true });
  test('find by code: a highlight in one zone and a shadow in another names the zones; the same zones, or no zones, don’t', () => {
    const { t } = benApp();
    const by = guideOf(t, ['Ohuhu|Y07', 'Ohuhu|Y07', 'Copic|R20', 'Copic|Y21']);
    const y06 = by['Ohuhu|Y06'] || { mkey: 'Ohuhu|Y06', code: 'Y06', brand: 'Ohuhu' },
      y07 = by['Ohuhu|Y07'],
      r20 = by['Copic|R20'];
    // no zones: as before
    let r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { 0: 1 })]);
    assert.equal(t.findLine(r), 'Y06: highlight for Y07 and shadow for Y07, R20');
    assert.equal(t.findPartLine(r), 'Y06 is a highlight for Y07 and a shadow for Y07, R20');
    // a zone: Wings holds sections 2 and 3
    t.zoneOpen([{ name: 'Wings', secs: [2, 3] }], { 1: 1, 2: 2, 3: 3, 4: 4 });
    const w = t.zones[0].id;
    assert.equal(t.zoneOf(2), w);
    r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { [w]: 1 })]);
    assert.equal(t.findLine(r), 'Y06: highlight in Main for Y07 and shadow in Wings for Y07, R20');
    assert.equal(t.findPartLine(r), 'Y06 is a highlight in Main for Y07 and a shadow in Wings for Y07, R20');
    // in both zones as a shadow: said as such
    r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { 0: 1, [w]: 1 })]);
    assert.equal(
      t.findPartLine(r),
      'Y06 is a highlight in Main for Y07 and a shadow in Main, Wings for Y07, R20',
    );
    // the same zones for both: no names
    r = found('Y06', [partOf(y06, [y07], [r20], { 0: 1, [w]: 1 }, { 0: 1, [w]: 1 })]);
    assert.equal(t.findPartLine(r), 'Y06 is a highlight for Y07 and a shadow for R20');
    // one kind only: no names
    r = found('Y06', [partOf(y06, [y07], [], { 0: 1 }, {})]);
    assert.equal(t.findLine(r), 'Y06: highlight for Y07');
    // both brands of the code: each brand's part, the zones where they differ
    const cy06 = { mkey: 'Copic|Y06', code: 'Y06', brand: 'Copic' };
    r = found('Y06', [
      partOf(y06, [y07], [r20], { 0: 1 }, { [w]: 1 }),
      partOf(cy06, [], [by['Copic|Y21']], {}, { 0: 1 }),
    ]);
    assert.equal(
      t.findPartLine(r),
      'Y06 is a highlight and a shadow here: Copic shadow for Y21 · Ohuhu highlight in Main for Y07 and shadow in Wings for R20',
    );
  });
}
