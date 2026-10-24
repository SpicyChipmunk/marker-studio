// Colour maths, matching and names.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, createApp, matching, memoryStorage } from './harness.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ---- from color.test.mjs ----
// Tests for the pure colour / format helpers used throughout the app.
// These run against the real functions loaded from index.html via the harness.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const close = (a, b, eps = 0.1) => Math.abs(a - b) <= eps;
  test('rgb() parses hex to [r,g,b]', () => {
    assert.deepEqual([...app.rgb('#ff0000')], [255, 0, 0]);
    assert.deepEqual([...app.rgb('#00ff00')], [0, 255, 0]);
    assert.deepEqual([...app.rgb('#0000ff')], [0, 0, 255]);
    assert.deepEqual([...app.rgb('#ffffff')], [255, 255, 255]);
    assert.deepEqual([...app.rgb('#000000')], [0, 0, 0]);
  });
  test('rgba() formats an rgba() string', () => {
    assert.equal(app.rgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
    assert.equal(app.rgba('#000000', 1), 'rgba(0,0,0,1)');
  });
  test('hexToLab() matches known CIELAB values', () => {
    const [Lw, aw, bw] = app.hexToLab('#ffffff');
    assert.ok(close(Lw, 100, 0.5), `white L=${Lw}`);
    assert.ok(close(aw, 0, 0.5) && close(bw, 0, 0.5), `white a,b=${aw},${bw}`);

    const [Lk] = app.hexToLab('#000000');
    assert.ok(close(Lk, 0, 0.5), `black L=${Lk}`);

    const [Lr, ar, br] = app.hexToLab('#ff0000');
    assert.ok(close(Lr, 53.24, 0.3), `red L=${Lr}`);
    assert.ok(ar > 70 && br > 60, `red a,b=${ar},${br}`); // strongly +a (red), +b (yellow)

    // mid-grey: L around 53, near-zero chroma
    const [Lg, ag, bg] = app.hexToLab('#808080');
    assert.ok(Lg > 50 && Lg < 56, `grey L=${Lg}`);
    assert.ok(close(ag, 0, 0.5) && close(bg, 0, 0.5), `grey chroma=${ag},${bg}`);
  });
  test('hexToLab() L is monotonic with lightness', () => {
    const L = (h) => app.hexToLab(h)[0];
    assert.ok(L('#000000') < L('#404040'));
    assert.ok(L('#404040') < L('#808080'));
    assert.ok(L('#808080') < L('#c0c0c0'));
    assert.ok(L('#c0c0c0') < L('#ffffff'));
  });
  test('hsl() reports the right hue and zero saturation for greys', () => {
    assert.ok(close(app.hsl('#ff0000').h, 0, 1) || close(app.hsl('#ff0000').h, 360, 1));
    assert.ok(close(app.hsl('#00ff00').h, 120, 1));
    assert.ok(close(app.hsl('#0000ff').h, 240, 1));
    assert.ok(close(app.hsl('#808080').s, 0, 0.001), 'grey has zero saturation');
  });
  test('mix() interpolates between two colours', () => {
    assert.equal(app.mix('#000000', '#ffffff', 0), 'rgb(0,0,0)');
    assert.equal(app.mix('#000000', '#ffffff', 1), 'rgb(255,255,255)');
    assert.equal(app.mix('#000000', '#ffffff', 0.5), 'rgb(128,128,128)');
  });
  test('hueDist() is a symmetric circular distance in [0,180]', () => {
    assert.equal(app.hueDist(0, 0), 0);
    assert.equal(app.hueDist(0, 180), 180);
    assert.equal(app.hueDist(0, 90), 90);
    assert.equal(app.hueDist(10, 350), 20); // wraps the short way
    assert.equal(app.hueDist(350, 10), 20); // symmetric
    assert.equal(app.hueDist(0, 270), 90); // never exceeds 180
  });
  test('txt() picks readable text colour for a background', () => {
    assert.equal(app.txt('#ffffff'), '#141216'); // dark text on light bg
    assert.equal(app.txt('#000000'), '#fff'); // light text on dark bg
  });
  test('normCode() inserts the dash in Copic C/W codes only', () => {
    assert.equal(app.normCode('C1'), 'C-1');
    assert.equal(app.normCode('W5'), 'W-5');
    assert.equal(app.normCode('E49'), 'E49'); // untouched
    assert.equal(app.normCode('120'), '120'); // untouched
  });
  // Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula": reference pairs, to four decimals
  test('de2000() matches the published CIEDE2000 test data', () => {
    const pairs = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    for (const [a, b, want] of pairs) {
      assert.ok(Math.abs(app.de2000(a, b) - want) < 1e-4, `${a} / ${b}: ${app.de2000(a, b)} vs ${want}`);
      assert.ok(Math.abs(app.de2000(b, a) - want) < 1e-4, 'symmetric');
    }
  });
  test('the six looks: each marker fits the regions it should, and widening takes the nearest first', () => {
    const E = app.__eval;
    assert.deepEqual(
      [...E('MOOD_KEYS.map((k) => MOODS[k].label)')],
      ['Any', 'Bright', 'Soft', 'Pastel', 'Deep', 'Earthy'],
    );
    assert.equal(app.moodOff('pastel', [85, 20, 0]), 0);
    assert.equal(app.moodOff('pastel', [70, 20, 0]), 8);
    assert.equal(app.moodOff('deep', [40, 30, 0]), 0);
    const list = [
      [90, 20],
      [60, 20],
      [80, 5],
      [75, 20],
    ];
    const r = app.moodPick(list, 'pastel', 2, (x) => [x[0], x[1], 0]);
    assert.deepEqual(
      r.items.map((x) => [...x]),
      [
        [90, 20],
        [75, 20],
      ],
    );
    assert.equal(r.widened, 1);
  });
  test('lighting correction: grey, tinted paper comes back to white, pale colours are not clipped, white paper is left alone', () => {
    const E = app.__eval;
    // paper photographed as a warm grey (about L* 72, like Ben's photos)
    const paper = [...E('[srgbToLin(186), srgbToLin(176), srgbToLin(160)]')];
    const fix = E(`lightFix(${JSON.stringify(paper)})`);
    assert.ok(fix && fix.gain.length === 3);
    const out = [...app.lightApply(fix, 186, 176, 160)],
      lab = app.hexToLab('#' + out.map((v) => v.toString(16).padStart(2, '0')).join(''));
    assert.ok(lab[0] > 92 && lab[0] < 97, 'paper back to about L* 95: ' + lab[0]);
    assert.ok(Math.hypot(lab[1], lab[2]) < 3, 'and neutral');
    // a pale yellow a little lighter than the paper stays yellow, not white
    const py = [...app.lightApply(fix, 200, 190, 120)];
    assert.ok(py[2] < py[0] - 20, 'pale yellow keeps its colour: ' + py);
    // white paper: nothing to correct; a dark or strongly coloured spot is not paper
    assert.equal(E('lightFix([0.88, 0.88, 0.88])'), null);
    assert.equal(E('lightFix([0.02, 0.02, 0.02])'), null);
    assert.equal(E('lightFix([0.6, 0.2, 0.1])'), null);
    // paperOf finds the paper in a buffer that is mostly paper with some ink and colour
    const n = 400,
      d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const c = i % 10 === 0 ? [20, 20, 20] : i % 7 === 0 ? [200, 40, 60] : [186, 176, 160];
      d.set([...c, 255], i * 4);
    }
    const p = E('(d) => paperOf(d)')(d);
    assert.ok(p && Math.abs(p[0] - paper[0]) < 0.01 && Math.abs(p[2] - paper[2]) < 0.01);
  });
  test('text on a marker colour is whichever of dark or white reads better: every marker at least 3:1', () => {
    const E = app.__eval,
      C = E('COLORS');
    const lin = (v) => {
      v /= 255;
      return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
    };
    const long = (h) => (h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h);
    const Y = (h0) => {
      const h = long(h0);
      return (
        0.2126 * lin(parseInt(h.slice(1, 3), 16)) +
        0.7152 * lin(parseInt(h.slice(3, 5), 16)) +
        0.0722 * lin(parseInt(h.slice(5, 7), 16))
      );
    };
    const cr = (a, b) => {
      const x = Y(a),
        y = Y(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    // blue B111 had white text at 2.9:1 under the old brightness rule; dark text reads at 6.4:1
    const b111 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B111');
    assert.equal(app.txt(b111.hex), '#141216');
    for (const c of C) {
      const t = app.txt(c.hex),
        other = t === '#fff' ? '#141216' : '#fff';
      assert.ok(cr(c.hex, t) >= 3, `${c.brand} ${c.code}: ${cr(c.hex, t).toFixed(2)}`);
      assert.ok(cr(c.hex, t) >= cr(c.hex, other) - 1e-9, `${c.brand} ${c.code} has the better of the two`);
      assert.equal(E('darkText')(c.hex), t !== '#fff');
    }
  });
}

// ---- from colour-engines.test.mjs ----
// The lookups and colour rules several patterns share (js/colour.js, js/guide/30-palette-assign.js,
// js/guide/88-coverage-blend.js): the closest marker by eye (Blend, the Photo pattern, stand-ins for dry or missing
// markers), CIEDE2000 split into lightness and colour (Expand with nearby markers), Blend's three mixes, which markers
// are warm and which cool, blend companions, and which sections touch (Random). The browser tests cover the controls.
{
  // an app whose guide uses the whole catalogue (as in demo mode), or these marker sets
  function appWith(sets = []) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    core.coll = E('sfCollection()');
    return { app, E, core, K: core.colour, coll: core.coll };
  }
  const lch = (l) => {
    let h = (Math.atan2(l[2], l[1]) * 180) / Math.PI;
    if (h < 0) h += 360;
    return [l[0], Math.hypot(l[1], l[2]), h];
  };
  const hueDiff = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };
  const d76 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // a repeatable run of random numbers
  function rng(s) {
    return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  }
  // a picture of cols × rows sections with lines lw px thick between them (and round the edge)
  function thickGrid(core, cols, rows, cw, ch, lw) {
    const W = cols * cw,
      H = rows * ch,
      labels = new Int32Array(W * H),
      comps = [null];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        comps.push({ cx: (i + 0.5) * cw, cy: (j + 0.5) * ch, area: cw * ch, merged: false, bg: false });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = Math.floor(x / cw),
          j = Math.floor(y / ch),
          ix = x - i * cw,
          jy = y - j * ch;
        labels[y * W + x] =
          ix < lw / 2 || ix >= cw - lw / 2 || jy < lw / 2 || jy >= ch - lw / 2 ? -1 : 1 + j * cols + i;
      }
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = comps;
    core.secState = new Uint8Array(comps.length).fill(1);
    core.assignData = null;
    return (i, j) => 1 + j * cols + i;
  }
  test('CIEDE2000 split: its lightness and colour parts add up to it squared; a change of lightness alone is all lightness, of hue alone all colour', () => {
    const { app } = appWith();
    const r = rng(3);
    for (let i = 0; i < 400; i++) {
      const a = [r() * 100, r() * 160 - 80, r() * 160 - 80],
        b = [r() * 100, r() * 160 - 80, r() * 160 - 80];
      const [pl, pc] = app.de2000Split(a, b),
        d = app.de2000(a, b);
      assert.ok(pl >= 0 && pc >= 0, 'never below 0');
      assert.ok(Math.abs(Math.sqrt(pl + pc) - d) < 1e-9, `${Math.sqrt(pl + pc)} vs ${d}`);
    }
    const [l1, c1] = app.de2000Split([40, 20, 30], [70, 20, 30]);
    assert.ok(l1 > 100 && c1 < 1e-9, 'lightness only');
    const [l2, c2] = app.de2000Split([60, 40, 0], [60, 0, 40]);
    assert.ok(l2 === 0 && c2 > 100, 'hue only');
    // (de2000 itself is unchanged: the published test data are in color.test.mjs)
  });
  test('the closest marker by eye: CIEDE2000 over a small pool; a big pool’s quick shortlist finds the same one nearly always', () => {
    const { app, K, coll } = appWith();
    const exact = (lab, pool) => {
      let b = null,
        v = Infinity;
      for (const m of pool) {
        const d = app.de2000(lab, m.lab);
        if (d < v) {
          v = d;
          b = m;
        }
      }
      return b;
    };
    const r = rng(11),
      small = coll.filter((_, i) => i % Math.ceil(coll.length / 36) === 0);
    assert.ok(small.length <= 40 && small.length > 20);
    let same = 0,
      n = 0,
      worse = 0,
      oldDiffers = 0;
    for (let i = 0; i < 600; i++) {
      const lab = app.hexToLab(
        '#' +
          Math.floor(r() * 0xffffff)
            .toString(16)
            .padStart(6, '0'),
      );
      assert.equal(K.nearest(lab, small), exact(lab, small), 'a pool of 40 or fewer is searched whole');
      const want = exact(lab, coll),
        got = K.nearest(lab, coll);
      n++;
      if (got === want) same++;
      else worse = Math.max(worse, app.de2000(lab, got.lab) - app.de2000(lab, want.lab));
      // (plain L*a*b* distance, as it was: often another marker)
      let o = null,
        ov = Infinity;
      for (const m of coll) {
        const d = d76(lab, m.lab);
        if (d < ov) {
          ov = d;
          o = m;
        }
      }
      if (o !== want) oldDiffers++;
    }
    assert.ok(same / n >= 0.97, `the shortlist found the closest by eye ${same} of ${n} times`);
    assert.ok(worse < 3, 'when it misses, it is by a hair: ' + worse);
    assert.ok(oldDiffers / n > 0.2, 'plain distance disagreed with the eye often: ' + oldDiffers);
    // a colour where plain L*a*b* distance and the eye disagree (a stronger red of the same lightness looks nearer
    // than a lighter one of the same strength): the eye wins
    const two = [
        { mkey: 'a', lab: [50, 60, 0] },
        { mkey: 'b', lab: [66, 30, 0] },
      ],
      lab = [50, 30, 0];
    assert.ok(
      d76(lab, two[0].lab) > d76(lab, two[1].lab) &&
        app.de2000(lab, two[0].lab) < app.de2000(lab, two[1].lab),
    );
    assert.equal(K.nearest(lab, two).mkey, 'a');
    // equals: the first in the pool; a marker without a colour is passed over
    const same2 = [
      { mkey: 'x', lab: [50, 0, 0] },
      { mkey: 'y', lab: [50, 0, 0] },
    ];
    assert.equal(K.nearest([52, 1, 1], same2).mkey, 'x');
    assert.equal(K.nearest([52, 1, 1], [{ mkey: 'n' }, ...same2]).mkey, 'x');
    const big = coll.concat([{ mkey: 'dup', lab: coll[5].lab.slice() }]);
    assert.equal(K.nearest(coll[5].lab.slice(), big), coll[5], 'the first of equals in a big pool too');
  });
  test('Blend’s Mix, Soft: the weighted average in L*a*b*, as it always was', () => {
    const { K } = appWith();
    const ax = [
      { lab: [40, 60, 20], hex: '#000000' },
      { lab: [80, -20, 50], hex: '#000000' },
    ];
    const m = K.mixer(ax, 'soft');
    assert.deepEqual([...m([1, 0])], [40, 60, 20]);
    const h = m([1, 3]);
    [70, 0, 42.5].forEach((v, i) => assert.ok(Math.abs(h[i] - v) < 1e-9, `${h[i]} vs ${v}`));
  });
  test('Blend’s Mix, Vivid: round the colour wheel the shorter way, at full strength; exactly opposite goes by yellow; a grey has no say in the hue', () => {
    const { K, app } = appWith();
    const at = (L, C, h) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
    const ax = (...labs) => labs.map((lab) => ({ lab }));
    // red (30°) to blue (290°): the shorter way is through 340° (purple), not through green
    const rb = K.mixer(ax(at(50, 50, 30), at(50, 50, 290)), 'vivid');
    let x = lch(rb([1, 1]));
    assert.ok(hueDiff(x[2], 340) < 1, 'purple: ' + x[2]);
    assert.ok(Math.abs(x[1] - 50) < 1, 'as strong as the two: ' + x[1]);
    x = lch(rb([3, 1]));
    assert.ok(hueDiff(x[2], 5) < 1, 'a quarter of the way: ' + x[2]);
    // the soft mix of the same two is much weaker
    assert.ok(lch(K.mixer(ax(at(50, 50, 30), at(50, 50, 290)), 'soft')([1, 1]))[1] < 35);
    // lightness and chroma are averaged
    x = lch(K.mixer(ax(at(40, 20, 100), at(80, 60, 140)), 'vivid')([1, 1]));
    assert.ok(
      Math.abs(x[0] - 60) < 1e-6 && Math.abs(x[1] - 40) < 1e-6 && hueDiff(x[2], 120) < 1e-6,
      x.join(),
    );
    // exactly opposite (0° and 180°): through the yellow side (90°), from either end
    const op = K.mixer(ax(at(60, 30, 0), at(60, 30, 180)), 'vivid');
    for (const [w, want] of [
      [[1, 1], 90],
      [[3, 1], 45],
      [[1, 3], 135],
    ])
      assert.ok(hueDiff(lch(op(w))[2], want) < 1e-6, `${w}: ${lch(op(w))[2]}`);
    const op2 = K.mixer(ax(at(60, 30, 250), at(60, 30, 70)), 'vivid');
    assert.ok(
      hueDiff(lch(op2([1, 1]))[2], 160) < 1e-6,
      'via 160°, the side nearer yellow: ' + lch(op2([1, 1]))[2],
    );
    // a grey anchor lowers the strength but doesn't turn the hue
    x = lch(K.mixer(ax(at(50, 40, 200), [50, 0, 0]), 'vivid')([1, 1]));
    assert.ok(hueDiff(x[2], 200) < 1e-6 && Math.abs(x[1] - 20) < 1e-6, x.join());
    // (a near-grey, chroma 3, only a little)
    x = lch(K.mixer(ax(at(50, 40, 200), at(50, 3, 290)), 'vivid')([1, 1]));
    assert.ok(hueDiff(x[2], 200) < 20, 'near-grey: ' + x[2]);
    // three anchors round the wheel: their weighted average on it
    x = lch(K.mixer(ax(at(50, 40, 350), at(50, 40, 10), at(50, 40, 30)), 'vivid')([1, 1, 1]));
    assert.ok(hueDiff(x[2], 10) < 1e-6, 'three: ' + x[2]);
    // a colour too strong for the screen comes back to one it can show
    const clip = app.labClip([60, 120, -120]),
      back = app.labClip(clip);
    assert.deepEqual([...back], [...clip]);
    assert.ok(Math.hypot(clip[1], clip[2]) < 120 * Math.SQRT2);
    assert.deepEqual([...app.labClip([50, 10, 10])], [50, 10, 10], 'one it can show is left as it was');
  });
  test('Blend’s Mix, Like paint: layers of ink (a weighted geometric mean of the light), so blue and yellow make green', () => {
    const { K, app } = appWith();
    const ax = (...hex) => hex.map((h) => ({ lab: app.hexToLab(h), hex: h }));
    const by = K.mixer(ax('#2050e0', '#f8d000'), 'paint');
    const g = lch(by([1, 1]));
    assert.ok(g[2] > 105 && g[2] < 200, 'green: ' + g[2]);
    // the soft mix of the same two is a grey or pink, not green
    const s = lch(K.mixer(ax('#2050e0', '#f8d000'), 'soft')([1, 1]));
    assert.ok(!(s[2] > 105 && s[2] < 200) || s[1] < 12, 'soft: ' + s.join());
    // darker than the plain average; at either end, the anchor itself
    assert.ok(g[0] < (app.hexToLab('#2050e0')[0] + app.hexToLab('#f8d000')[0]) / 2);
    const end = by([1, 0]),
      a = app.hexToLab('#2050e0');
    a.forEach((v, i) => assert.ok(Math.abs(end[i] - v) < 1e-6));
    // the same colour twice stays that colour
    const same = K.mixer(ax('#c04080', '#c04080'), 'paint')([2, 5]),
      c = app.hexToLab('#c04080');
    c.forEach((v, i) => assert.ok(Math.abs(same[i] - v) < 1e-6));
  });
  test('warm and cool: every coloured marker is exactly one; reds to yellows and red-violets warm, yellow-greens to violets cool; greys by their tint, neutral ones and black both', () => {
    const { K, coll } = appWith();
    const find = (b, c) => {
      const m = coll.find((x) => x.brand === b && x.code === c);
      assert.ok(m, b + ' ' + c);
      return m;
    };
    const t = (b, c) => K.temp(find(b, c));
    for (const m of coll) {
      const x = lch(m.lab),
        v = K.temp(m);
      if (x[1] >= 12) assert.ok(v === 'warm' || v === 'cool', `${m.brand} ${m.code}: ${v}`);
      else assert.ok(['warm', 'cool', 'both'].includes(v));
    }
    // clear colours either side of the two lines, and ones that used to be in neither or both
    for (const [b, c, want] of [
      ['Ohuhu', 'R16', 'warm'],
      ['Ohuhu', 'YR111', 'warm'],
      ['Copic', 'Y17', 'warm'],
      ['Ohuhu', 'YG06', 'warm'],
      ['Ohuhu', 'YG211', 'warm'],
      ['Ohuhu', 'YG29', 'cool'],
      ['Ohuhu', 'YG66', 'cool'],
      ['Copic', 'G85', 'cool'],
      ['Ohuhu', 'G410', 'cool'],
      ['Ohuhu', 'B06', 'cool'],
      ['Ohuhu', 'V112', 'cool'],
      ['Ohuhu', 'RV316', 'warm'],
      ['Copic', 'V12', 'warm'],
      ['Ohuhu', 'RV111', 'warm'],
    ])
      assert.equal(t(b, c), want, `${b} ${c}`);
    // named greys: Warm Greys warm (or both, the untinted ones), Cool and Green Greys cool (or both)
    for (const c of ['WG01', 'WG04', 'WG06', 'WG08', 'WG26', 'WG27']) assert.equal(t('Ohuhu', c), 'warm', c);
    for (const c of ['WG10', 'WG38']) assert.equal(t('Ohuhu', c), 'both', c);
    for (const c of ['CG17', 'CG18', 'CG28', 'GG05', 'GG15']) assert.equal(t('Ohuhu', c), 'cool', c);
    assert.equal(t('Ohuhu', 'CG01'), 'both');
    assert.equal(t('Copic', 'C-8'), 'cool');
    // black
    assert.equal(t('Ohuhu', '120'), 'both');
    assert.equal(t('Copic', '100'), 'both');
    // Temperature's pools: warm and cool together are every marker, the ones in both counted twice
    const w = K.poolFor('warm'),
      c = K.poolFor('cool'),
      all = K.poolFor('all');
    const both = all.filter((m) => K.temp(m) === 'both').length;
    assert.equal(w.length + c.length, all.length + both);
    assert.ok(w.includes(find('Ohuhu', 'WG10')) && c.includes(find('Ohuhu', 'WG10')));
  });
  test('blend companions: really lighter or darker by a step you can see, the same hue; a family member that isn’t is passed over (Ohuhu BV31/BV32, Copic Y17/Y18)', () => {
    const { K, coll, app } = appWith();
    const find = (b, c) => coll.find((x) => x.brand === b && x.code === c);
    const comp = (b, c, side, pool = coll) => {
      const m = find(b, c);
      return K.companion(m.lab, m, pool, side);
    };
    const bv31 = find('Ohuhu', 'BV31'),
      bv32 = find('Ohuhu', 'BV32');
    assert.ok(bv32.lab[0] >= bv31.lab[0], 'BV32 is the lighter of the two');
    const d = comp('Ohuhu', 'BV31', 1);
    assert.ok(d && d.mkey !== bv32.mkey && bv31.lab[0] - d.lab[0] >= 4, 'BV31 darker: ' + (d && d.code));
    const l = comp('Ohuhu', 'BV32', -1);
    assert.ok(!l || (l.mkey !== bv31.mkey && l.lab[0] - bv32.lab[0] >= 4), 'BV32 lighter: ' + (l && l.code));
    const y17 = find('Copic', 'Y17'),
      y18 = find('Copic', 'Y18');
    assert.ok(y18.lab[0] > y17.lab[0], 'Copic Y18 is lighter than Y17');
    const yd = comp('Copic', 'Y17', 1),
      yl = comp('Copic', 'Y18', -1);
    assert.ok(yd && yd.code !== 'Y18' && y17.lab[0] - yd.lab[0] >= 4, 'Y17 darker: ' + (yd && yd.code));
    assert.ok(!yl || (yl.code !== 'Y17' && yl.lab[0] - y18.lab[0] >= 4), 'Y18 lighter: ' + (yl && yl.code));
    // a family member that is right stays first: Ohuhu R25's darker is its own family's
    const r = comp('Ohuhu', 'R25', 1);
    assert.ok(r && /^R2\d$/.test(r.code) && r.brand === 'Ohuhu', 'R25 darker: ' + (r && r.code));
    // the whole catalogue: every companion the right way, a visible step, the same hue (a grey’s a grey)
    let n = 0;
    for (const m of coll)
      for (const side of [-1, 1]) {
        const c = K.companion(m.lab, m, coll, side);
        if (!c) continue;
        n++;
        assert.ok((c.lab[0] - m.lab[0]) * -side >= 4, `${m.brand} ${m.code} ${side}: ${c.code} lightness`);
        assert.ok(app.de2000(m.lab, c.lab) >= 3, `${m.code} ${side}: ${c.code} too close`);
        const a = lch(m.lab),
          b = lch(c.lab),
          fam = c.brand === m.brand && c.code.replace(/\d$/, '') === m.code.replace(/\d$/, '');
        if (a[1] >= 12 || fam) {
          if (Math.min(a[1], b[1]) >= 6)
            assert.ok(hueDiff(a[2], b[2]) <= 25, `${m.brand} ${m.code} ${side}: ${c.code} hue`);
        } else assert.ok(b[1] < 12, `${m.brand} ${m.code} ${side}: ${c.code} a grey's is a grey`);
      }
    assert.ok(n > coll.length, n + ' companions');
  });
  test('touching sections: found across thick lines (up to a 40th of the picture), side by side but not corner to corner', () => {
    const { core, K } = appWith();
    // 1200 × 800, 8 × 5 sections, lines 26 px thick (a 250th of the picture, 5 px, is how far it used to look)
    const at = thickGrid(core, 8, 5, 150, 160, 26);
    const a = K.adj();
    let pairs = 0;
    for (const l in a) pairs += a[l].size;
    assert.equal(pairs / 2, 8 * 4 + 7 * 5, 'every side-by-side pair');
    assert.deepEqual(
      [...a[at(2, 2)]].sort((x, y) => x - y),
      [at(2, 1), at(1, 2), at(3, 2), at(2, 3)].sort((x, y) => x - y),
    );
    assert.ok(!a[at(2, 2)].has(at(3, 3)), 'corner to corner is not touching');
    // lines thicker than a 40th of the picture's longer side (30 px here) are too far across
    thickGrid(core, 8, 5, 150, 160, 40);
    assert.equal(Object.keys(K.adj()).length, 0);
    // thin lines, and none at all
    thickGrid(core, 8, 5, 150, 160, 2);
    let p2 = 0;
    for (const s of Object.values(K.adj())) p2 += s.size;
    assert.equal(p2 / 2, 67);
    thickGrid(core, 8, 5, 150, 160, 0);
    let p0 = 0;
    for (const s of Object.values(K.adj())) p0 += s.size;
    assert.equal(p0 / 2, 67);
    // a speck: a section that meets another over only a pixel or two doesn't count as touching it (300 px: it looks
    // 8 px across; 1 | a 6 px line | 3, with a 2 × 2 speck of 2 on 3's edge)
    const W = 300,
      H = 300,
      L = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        L[y * W + x] = x < 140 ? 1 : x < 146 ? -1 : x < 148 && y >= 100 && y < 102 ? 2 : 3;
    core.W = W;
    core.H = H;
    core.labels = L;
    core.comps = [
      null,
      { cx: 70, cy: 150, area: 42000 },
      { cx: 147, cy: 101, area: 4 },
      { cx: 220, cy: 150, area: 46196 },
    ];
    // (real areas, and nothing kept by a tap: v304 looks across specks smaller than Min section size, adjTiny)
    core.secState = new Uint8Array(4);
    const a3 = K.adj();
    assert.ok(a3[1].has(3), 'across a 6 px line');
    assert.ok(!a3[1].has(2), 'the speck of 2 is not touching 1');
  });
  test('Random, Keep touching sections clearly different: no touching sections share a marker or look alike; pins go first; with too few markers it gives way step by step', () => {
    const { core, app, coll } = appWith();
    const at = thickGrid(core, 10, 8, 120, 100, 20),
      sv = core.styleVars;
    Object.assign(sv, {
      family: 'random',
      noAdj: true,
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
    });
    const pairs = [];
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 10; i++) {
        if (i < 9) pairs.push([at(i, j), at(i + 1, j)]);
        if (j < 7) pairs.push([at(i, j), at(i, j + 1)]);
      }
    const cl = core.countedList(),
      K = core.colour;
    const pick = (k) => coll.filter((_, i) => i % Math.floor(coll.length / k) === 0).slice(0, k);
    const random = Math.random;
    Math.random = rng(5);
    for (let roll = 0; roll < 10; roll++) {
      K.random(cl, pick(16));
      const as = core.assignData.assign;
      for (const [p, q] of pairs) {
        assert.notEqual(as[p].mkey, as[q].mkey, 'same marker');
        assert.ok(app.de2000(as[p].lab, as[q].lab) >= 10, `look alike: ${as[p].code} ${as[q].code}`);
      }
    }
    // a pinned section keeps its marker, and its neighbours keep clear of it
    const pin = pick(16)[3];
    core.locks[at(4, 4)] = pin.mkey;
    K.random(cl, pick(16));
    assert.equal(core.assignData.assign[at(4, 4)].mkey, pin.mkey);
    for (const nb of [at(3, 4), at(5, 4), at(4, 3), at(4, 5)])
      assert.ok(app.de2000(core.assignData.assign[nb].lab, pin.lab) >= 10);
    delete core.locks[at(4, 4)];
    // two markers that look alike: touching sections can't be clearly different, but they aren't the same marker
    let twins = null;
    for (let i = 0; i < coll.length && !twins; i++)
      for (let j = i + 1; j < coll.length; j++)
        if (coll[i].mkey !== coll[j].mkey && app.de2000(coll[i].lab, coll[j].lab) < 5) {
          twins = [coll[i], coll[j]];
          break;
        }
    K.random(cl, twins);
    for (const [p, q] of pairs)
      assert.notEqual(core.assignData.assign[p].mkey, core.assignData.assign[q].mkey);
    // and one marker: that one everywhere
    K.random(cl, twins.slice(0, 1));
    assert.ok(cl.every((l) => core.assignData.assign[l] === twins[0]));
    // off: markers at random, as before (only the pool's)
    sv.noAdj = false;
    K.random(cl, pick(3));
    assert.ok(cl.every((l) => pick(3).includes(core.assignData.assign[l])));
    Math.random = random;
  });
}

// ---- from match-and-photo.test.mjs ----
// Match a colour's ranking (colour.js matchNearest, matchWord) and Palette › From photo's markers (picker.js
// extractPhotoPalette), and "Tap the white paper"'s spot (colour.js patchLin, paperSpot).
{
  function appWith(set) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
    if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return a;
  }
  // a seeded random number generator (mulberry32)
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // an image for the harness's canvas: RGBA pixels as a data URL it reads back exactly (width × height ≤ 9000, so
  // extractPhotoPalette doesn't scale it)
  function img(a, w, h, fill) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...fill(x, y), 255], (y * w + x) * 4);
    const im = new (a.__eval('Image'))();
    im.src = 'data:image/x-mslabels;' + w + ',' + h + ',' + Buffer.from(d.buffer).toString('base64');
    return im;
  }
  const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  // a page: paper over the left 60%, colour patches in columns on the right
  function page(a, paper, cols) {
    return img(a, 100, 60, (x, y) =>
      x < 60
        ? hexRgb(paper)
        : hexRgb(cols[Math.min(cols.length - 1, Math.floor(((x - 60) / 40) * cols.length))]),
    );
  }
  const COLS = [
    '#c0392b',
    '#c43d30',
    '#e67e22',
    '#f1c40f',
    '#27ae60',
    '#2980b9',
    '#8e44ad',
    '#6d4c41',
    '#1b1b1b',
    '#7f8c8d',
  ];
  test('Match: the words for a match, on CIEDE2000 steps', () => {
    const a = appWith(null),
      w = a.__eval('matchWord');
    const cases = [
      [0, 'Near-exact'],
      [1.99, 'Near-exact'],
      [2, 'Very close'],
      [3.99, 'Very close'],
      [4, 'Close'],
      [6.99, 'Close'],
      [7, 'Rough'],
      [11.99, 'Rough'],
      [12, 'Loose'],
      [40, 'Loose'],
    ];
    for (const [d, word] of cases) assert.equal(w(d), word, String(d));
  });
  test('Match: nearest by eye among your markers (not dry); markers to buy only when at least 2 ΔE00 closer', () => {
    const a = appWith('Honolulu 48'),
      E = a.__eval,
      de = a.de2000;
    const LAB = E('LAB'),
      N = LAB.length;
    // one of your markers has run dry: it's listed with the ones you could buy, not as yours
    const dry = E('COLORS.findIndex((c, i) => isOwned(i))');
    E(`state.ink[mkey(${dry})] = 'dry'`);
    // (v309.1: Honolulu 48 comes with a Colorless Blender, which no colour is matched to: NOINK)
    const usable = (i) => E(`isOwned(${i}) && !isDry(${i}) && !NOINK.has(${i})`);
    const use = [];
    for (let i = 0; i < N; i++) if (usable(i)) use.push(i);
    const rnd = seeded(5),
      nearest = E('matchNearest');
    const targets = [LAB[dry]];
    for (let k = 0; k < 60; k++) targets.push([rnd() * 100, rnd() * 160 - 80, rnd() * 160 - 80]);
    let listed = 0,
      hidden = 0;
    for (const t of targets) {
      const all = [...Array(N).keys()]
        .map((i) => ({ i, d: de(t, LAB[i]) }))
        .sort((x, y) => x.d - y.d || x.i - y.i);
      // (v304: the markers to buy are of your brands, here Ohuhu; another brand's has its own place, test/v304-match)
      const mine = all.filter((o) => use.includes(o.i)).slice(0, 5),
        others = all.filter((o) => !use.includes(o.i) && E(`COLORS[${o.i}].brand`) === 'Ohuhu').slice(0, 3);
      const r = nearest(t);
      assert.deepEqual(
        [...r.owned.map((o) => o.i)],
        mine.map((o) => o.i),
        'your five nearest by eye',
      );
      assert.deepEqual(
        [...r.buy.map((o) => o.i)],
        others.filter((o) => o.d <= mine[0].d - 2).map((o) => o.i),
        'to buy: clearly closer only',
      );
      if (others[0].d < mine[0].d) r.buy.length ? listed++ : hidden++;
    }
    assert.ok(listed > 0 && hidden > 0, `both cases seen: ${listed} listed, ${hidden} near-ties left out`);
    // the dry marker's own colour: it is the nearest to buy (0 away), and not among yours
    const r = nearest(LAB[dry]);
    assert.equal(r.buy[0].i, dry);
    assert.ok(!r.owned.some((o) => o.i === dry));
    // no markers: nothing of yours, the three nearest to buy
    const b = appWith(null),
      rb = b.__eval('matchNearest')([50, 20, -30]);
    assert.equal(rb.owned.length, 0);
    assert.equal(rb.buy.length, 3);
  });
  test('From photo: n markers in play, every two at least 6 ΔE00 apart, no near-white for the paper, near-black and grey kept', () => {
    const a = appWith('Honolulu 120'),
      E = a.__eval,
      de = a.de2000,
      LAB = E('LAB'),
      LCH = E('LCH');
    const im = page(a, '#fbfbf8', COLS);
    for (const n of [4, 6, 8, 12, 16]) {
      const r = a.extractPhotoPalette(im, n),
        pal = [...r.markers];
      assert.equal(pal.length, n, `${n} markers`);
      assert.equal(r.labs.length, n);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) assert.ok(de(LAB[pal[i]], LAB[pal[j]]) >= 6, `${n}: ${i},${j} apart`);
      assert.ok(
        pal.every((i) => E(`inPool(${i})`)),
        'in play',
      );
      assert.ok(!pal.some((i) => LAB[i][0] >= 90 && LCH[i][1] < 12), `${n}: no near-white`);
      if (n >= 12) {
        assert.ok(
          pal.some((i) => LAB[i][0] < 25),
          'a near-black',
        );
        assert.ok(
          pal.some((i) => LCH[i][1] < 12 && LAB[i][0] > 30 && LAB[i][0] < 75),
          'a mid-grey',
        );
      }
    }
  });
  // (v308: it stops once the markers left are more than 18 from the photo's colours, rather than make colours up; the
  // bands come in hue order, not the photo's two colours first)
  test('From photo: a photo of few colours gives a second marker each while one is near; the markers in play are the limit', () => {
    const a = appWith('Honolulu 120'),
      E = a.__eval,
      de = a.de2000,
      LAB = E('LAB');
    const two = img(a, 40, 20, (x) => (x < 20 ? [221, 51, 51] : [51, 153, 204]));
    const r2 = a.extractPhotoPalette(two, 8),
      pal = [...r2.markers];
    assert.ok(pal.length > 2 && pal.length <= 8, pal.length + '');
    assert.equal(new Set(pal).size, pal.length);
    assert.equal(r2.few, pal.length < 8);
    [...r2.labs].forEach((l, k) => assert.ok(de(l, LAB[pal[k]]) <= 18, 'near its colour'));
    // the photo's two colours are in it
    const near = (hex) => {
      const t = a.hexToLab(hex);
      return E('COLORS.map((_, i) => i).filter((i) => inPool(i))').reduce((b, i) =>
        de(t, LAB[i]) < de(t, LAB[b]) ? i : b,
      );
    };
    assert.ok(pal.includes(near('#dd3333')) && pal.includes(near('#3399cc')));
    // only three markers in play: those three (v308: the three nearest the photo's colours; markers far from every colour
    // in it aren't used at all)
    const three = [...pal].slice(0, 3);
    E(`setPool(${JSON.stringify(three)})`);
    assert.equal(a.extractPhotoPalette(two, 8).markers.length, 3);
    E(
      'setPool(COLORS.map((_, i) => i).filter((i) => isOwned(i) && LCH[i][1] >= 20 && LCH[i][2] > 100 && LCH[i][2] < 160))',
    );
    assert.ok(E('state.pool.length') >= 3);
    assert.equal(
      a.extractPhotoPalette(two, 8).markers.length,
      0,
      'only greens in play: none near a red or a blue',
    );
    // a photo that is all white has nothing a marker can make
    E('setPool(null)');
    const white = a.extractPhotoPalette(
      img(a, 20, 20, () => [252, 252, 250]),
      6,
    );
    assert.equal(white.none, true);
    assert.equal(white.markers.length, 0);
  });
  test('From photo: with the paper tapped, the palette comes from the corrected photo (the grey paper becomes white and takes no marker)', () => {
    const a = appWith('Honolulu 120'),
      E = a.__eval,
      LAB = E('LAB'),
      LCH = E('LCH');
    const im = page(a, '#baafa0', COLS.slice(2, 8));
    const greyish = (pal) => pal.filter((i) => LCH[i][1] < 12 && LAB[i][0] > 55);
    const before = [...a.extractPhotoPalette(im, 6).markers];
    assert.ok(greyish(before).length >= 1, 'the grey paper as photographed takes a grey marker');
    const fix = E('lightFix([srgbToLin(0xba), srgbToLin(0xaf), srgbToLin(0xa0)])');
    const after = [...a.extractPhotoPalette(im, 6, fix).markers];
    assert.equal(after.length, 6);
    assert.deepEqual(greyish(after), [], 'the paper, now white, is skipped');
  });
  test('Tap the white paper: the spot is averaged in linear light; paper, white paper and a coloured or dark spot', () => {
    const a = appWith(null),
      E = a.__eval;
    // a 5 × 5 patch, half black and half white: the average in linear light is 0.5 (sRGB would say 0.21)
    const w = 5,
      h = 5,
      d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) d.set(i % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
    const lin = [...E('patchLin')(d, w, h, 2, 2, 2)];
    assert.ok(Math.abs(lin[0] - 12 / 25) < 1e-9, String(lin));
    // see-through pixels don't count, and all see-through is nothing
    const t = new Uint8ClampedArray(4 * 4);
    assert.equal(E('patchLin')(t, 2, 2, 0, 0, 1), null);
    const spot = E('paperSpot'),
      lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
    const grey = spot(lin8(186, 176, 160));
    assert.ok(grey.fix && !grey.bad && grey.note === '');
    const white = spot(lin8(242, 242, 242));
    assert.equal(white.fix, null);
    assert.ok(!white.bad);
    assert.equal(white.note, 'That already looks white: nothing to correct.');
    for (const c of [
      [200, 50, 60],
      [15, 15, 15],
    ]) {
      const r = spot(lin8(...c));
      assert.equal(r.bad, true, String(c));
      assert.equal(r.fix, null);
      assert.equal(
        r.note,
        'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
      );
    }
  });
}

// ---- from matching.test.mjs ----
// Tests for the colour-matching subsystem (nearest, pool filtering, keyIdx).
// The matching functions are reachable; COLORS/HS come from a read-only seam.
// The pool is controlled via setPool(), and nearest() is checked against an
// exact reimplementation of its own cost function.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    matching = _app.__match;
  const COLORS = matching.COLORS,
    HS = matching.HS;
  const hueDist = app.hueDist;
  // Exact reference of nearest()'s two-pass cost, over a given pool (index order).
  function refNearest(target, pool, opt = {}) {
    const ex = opt.exclude || new Set();
    const minS = opt.minS != null ? opt.minS : 0.16;
    const P = [...pool].sort((a, b) => a - b);
    let best = -1,
      bc = 1e9;
    for (const i of P) {
      if (ex.has(i)) continue;
      const o = HS[i];
      if (o.s < minS) continue;
      const cost =
        hueDist(o.h, target) / 180 +
        (1 - o.s) * 0.15 +
        (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
      if (cost < bc) {
        bc = cost;
        best = i;
      }
    }
    if (best < 0)
      for (const i of P) {
        if (ex.has(i)) continue;
        const o = HS[i];
        const cost =
          hueDist(o.h, target) / 180 + (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
        if (cost < bc) {
          bc = cost;
          best = i;
        }
      }
    return best;
  }
  // A spread of saturated markers, and a set of near-neutral (low-sat) markers.
  const satPool = [];
  for (let i = 0; i < COLORS.length; i++) if (HS[i].s > 0.25) satPool.push(i);
  const satSpread = satPool.filter((_, k) => k % 12 === 0).slice(0, 20);
  const lowSat = [];
  for (let i = 0; i < COLORS.length && lowSat.length < 8; i++) if (HS[i].s < 0.1) lowSat.push(i);
  test('fixture sanity: pools are non-trivial', () => {
    assert.ok(satSpread.length >= 8, `sat pool ${satSpread.length}`);
    assert.ok(lowSat.length >= 3, `low-sat pool ${lowSat.length}`);
  });
  test('nearest() picks the exact minimum-cost marker in the pool', () => {
    app.setPool(satSpread);
    for (const target of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const got = app.nearest(target);
      assert.equal(got, refNearest(target, satSpread), `target ${target}`);
      assert.ok(satSpread.includes(got), `result ${got} in pool`);
    }
    app.setPool(null);
  });
  test('nearest() honours exclude', () => {
    app.setPool(satSpread);
    const t = 30;
    const first = app.nearest(t);
    const second = app.nearest(t, { exclude: new Set([first]) });
    assert.notEqual(second, first);
    assert.equal(second, refNearest(t, satSpread, { exclude: new Set([first]) }));
    app.setPool(null);
  });
  test('nearest() returns -1 when everything is excluded', () => {
    const p = satSpread.slice(0, 3);
    app.setPool(p);
    assert.equal(app.nearest(100, { exclude: new Set(p) }), -1);
    app.setPool(null);
  });
  test('nearest() falls back past the saturation floor for a neutral-only pool', () => {
    app.setPool(lowSat);
    const got = app.nearest(200);
    assert.notEqual(got, -1, 'still returns a marker via the fallback pass');
    assert.ok(lowSat.includes(got));
    assert.equal(got, refNearest(200, lowSat));
    app.setPool(null);
  });
  test('nearest() respects the preferL (lightness) term', () => {
    app.setPool(satSpread);
    const t = 60;
    assert.equal(app.nearest(t, { preferL: 0.2 }), refNearest(t, satSpread, { preferL: 0.2 }));
    assert.equal(app.nearest(t, { preferL: 0.9 }), refNearest(t, satSpread, { preferL: 0.9 }));
    app.setPool(null);
  });
  test('nearest() is deterministic', () => {
    app.setPool(satSpread);
    assert.equal(app.nearest(123), app.nearest(123));
    app.setPool(null);
  });
  test('keyIdx() round-trips a marker key (brand|code)', () => {
    for (const i of [0, 50, 200, 400, 700]) {
      const key = COLORS[i].brand + '|' + COLORS[i].code;
      assert.equal(app.keyIdx(key), i, `keyIdx for ${key}`);
    }
    assert.equal(app.keyIdx('NoSuch|000'), null);
  });
}

// ---- from names.test.mjs ----
// Guide name generator: descriptive (reads the palette), varied, tidy.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    matching = _app.__match;
  const H = app.EVO_HUES,
    N = app.EVO_NEUTRAL;
  const has = (name, words) => words.some((w) => name.includes(w));
  const names = (hexes, k = 30) => Array.from({ length: k }, (_, i) => app.evoName(hexes, i * 7919));
  test('deterministic for the same palette and seed', () => {
    const h = ['#7a1f2b', '#9b2335'];
    assert.equal(app.evoName(h, 42), app.evoName(h, 42));
  });
  test('deep reds read as deep reds', () => {
    const out = names(['#7a1f2b', '#9b2335', '#5c1a22', '#a83244']);
    const deep = [...H.red.deep, ...H.red.mid, ...app.EVO_MOOD.deep];
    assert.ok(
      out.every((n) => has(n, deep) || has(n, app.EVO_VIBE)),
      out.join(' | '),
    );
    assert.ok(
      !out.some((n) => has(n, H.red.pale.concat(H.pink.pale))),
      'no pale words for deep reds: ' + out.join(' | '),
    );
  });
  test('two-colour palettes name both families', () => {
    const out = names(['#1f2f5c', '#243a73', '#d4a017', '#c8961e', '#1b2a52']);
    const blue = Object.values(H.blue).flat(),
      yellow = Object.values(H.yellow).flat();
    assert.ok(
      out.some((n) => has(n, blue) && has(n, yellow)),
      out.join(' | '),
    );
  });
  test('greys get neutral words, never a chromatic colour name', () => {
    const out = names(['#8a8a8a', '#b0b0b0', '#6e6e6e', '#c8c8c8']);
    const neutral = Object.values(N).flat();
    assert.ok(
      out.every((n) => has(n, neutral)),
      out.join(' | '),
    );
  });
  test('soft pastel greens are not mistaken for greys', () => {
    const out = names(['#9fbf9f', '#b8d8c0', '#8fb39a', '#c9e3d1']);
    const green = Object.values(H.green).flat();
    assert.ok(out.filter((n) => has(n, green)).length >= out.length * 0.6, out.join(' | '));
  });
  test('rainbow palettes get a spectrum word', () => {
    const out = names(['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#7b2cbf', '#ff70a6']);
    assert.ok(
      out.every((n) => has(n, app.EVO_SPECTRUM)),
      out.join(' | '),
    );
  });
  test('names are short, never repeat a word, and vary a lot', () => {
    const C = matching.COLORS;
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
    const seen = new Set();
    for (let t = 0; t < 1500; t++) {
      const k = 3 + ((rnd() * 14) | 0),
        base = (rnd() * C.length) | 0,
        spread = rnd() < 0.5 ? 12 : C.length;
      const hexes = [];
      for (let i = 0; i < k; i++) hexes.push(C[(base + ((rnd() * spread) | 0)) % C.length].hex);
      const n = app.evoName(hexes, t);
      assert.ok(n.length <= 24, n);
      const w = n
        .toLowerCase()
        .split(/[\s&-]+/)
        .filter(Boolean);
      assert.equal(new Set(w).size, w.length, 'repeated word in ' + n);
      seen.add(n);
    }
    assert.ok(seen.size >= 1200, `only ${seen.size} distinct names in 1500`);
  });
  test('avoids names already in the Library', () => {
    const h = ['#1f8a8a', '#27a0a0', '#ff7f6a', '#f06c58'];
    const first = app.evoName(h, 1);
    const second = app.evoName(h, 1, new Set([first.toLowerCase()]));
    assert.notEqual(second, first);
  });
  test('paletteName names a palette from its colours and skips names already in the Library', () => {
    const idxs = [0, 37, 74, 111];
    const hexes = app.__eval('[0, 37, 74, 111].map((i) => COLORS[i].hex)');
    app.__eval('state.saved = []');
    const first = app.paletteName(idxs);
    assert.equal(first, app.evoName([...hexes], 0, new Set()));
    assert.doesNotMatch(first, /·|\d/, 'no date: ' + first);
    app.__eval(
      `state.saved = [{ id: 1, type: 'guide', name: ${JSON.stringify(first.toUpperCase())}, keys: [] }]`,
    );
    assert.equal([...app.usedSavedNames()][0], first.toLowerCase(), 'used names are lower case');
    const second = app.paletteName(idxs);
    assert.notEqual(
      second.toLowerCase(),
      first.toLowerCase(),
      'a name in use (any case, any type) is not repeated',
    );
    assert.equal(app.paletteName([]), 'Palette', 'no colours: the plain fallback');
    app.__eval('state.saved = []');
  });
  // (v308: "… (2)", "… (3)" for every name clash — Save a copy, Duplicate, a guide imported again — was "(copy)", "(copy 2)")
  test('copyName: "(2)", then the next number, never a name already in the Library, and a copy of a copy counts on', () => {
    app.__eval(
      `state.saved = [{ id: 1, type: 'guide', name: 'Rose Tango', keys: [] }, { id: 2, type: 'palette', name: 'Rose Tango (2)', keys: [] }]`,
    );
    assert.equal(app.copyName('Rose Tango'), 'Rose Tango (3)', 'any item, any case, counts as taken');
    assert.equal(
      app.copyName('Rose Tango (3)', new Set(['rose tango', 'rose tango (2)', 'rose tango (3)'])),
      'Rose Tango (4)',
    );
    assert.equal(
      app.copyName('Rose Tango (copy 2)', new Set(['rose tango'])),
      'Rose Tango (2)',
      'v307’s “(copy)” names count on too',
    );
    assert.equal(app.copyName('Moss', new Set()), 'Moss (2)');
    assert.equal(app.copyName('', new Set()), 'Colouring guide (2)');
    assert.ok(app.copyName('x'.repeat(200), new Set()).length <= 120, 'fits the name limit');
    assert.match(app.copyName('x'.repeat(200), new Set()), / \(2\)$/, 'with its number');
    app.__eval('state.saved = []');
  });
}

// ---- from v304-match.test.mjs ----
// v304, Match a colour (colour.js matchNearest): the markers to buy are of your brands (those of the markers you own
// that lay down colour, dry ones too; an empty collection counts as both), and another brand's marker is offered,
// at most one, only when it is clearly closer (2 ΔE00) than both your best and anything of your brands. Find similar
// leaves out the marker it came from (opt.exclude), and only that one. The screen side is in e2e/v304-match.
{
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  function appWith(setup) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
    if (setup) a.__eval(setup);
    return a;
  }
  const preset = (n) =>
    `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`;
  const own = (keys) => `${JSON.stringify(keys)}.forEach((k) => state.owned.add(k))`;
  const near = (a, hex, opt) =>
    JSON.parse(
      a.__eval(
        `(() => { const r = matchNearest(hexToLab(${JSON.stringify(hex)}), ${JSON.stringify(opt || null)}); const f = (o) => ({ k: COLORS[o.i].brand + '|' + COLORS[o.i].code, d: +o.d.toFixed(2), i: o.i }); return JSON.stringify({ owned: r.owned.map(f), buy: r.buy.map(f), other: (r.other || []).map(f) }); })()`,
      ),
    );
  const grid = (n) => {
    const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2),
      out = [];
    for (let r = 0; r < n; r++)
      for (let g = 0; g < n; g++)
        for (let b = 0; b < n; b++)
          out.push('#' + h((r * 255) / (n - 1)) + h((g * 255) / (n - 1)) + h((b * 255) / (n - 1)));
    return out;
  };
  test('an Ohuhu collection is offered Ohuhu markers to buy, not a Copic one barely closer (#005ab4: Copic B37 4.6 against Ohuhu B115 4.7)', () => {
    const r = near(appWith(own(OWN)), '#005ab4');
    assert.ok(r.buy.length > 0 && r.buy.every((o) => o.k.startsWith('Ohuhu|')), JSON.stringify(r.buy));
    assert.equal(r.buy[0].k, 'Ohuhu|B115');
    assert.deepEqual(r.other, [], 'Copic B37 is not clearly closer than B115');
  });
  test('another brand only when clearly closer than anything of yours (#3a7bd5: Copic B06 2.9, your best 5.5, no Ohuhu within 3.5)', () => {
    const r = near(appWith(own(OWN)), '#3a7bd5');
    assert.deepEqual(r.buy, []);
    assert.equal(r.other.length, 1);
    assert.equal(r.other[0].k, 'Copic|B06');
  });
  test('the rule on a grid of colours, for one brand (Honolulu 120), the other (Ciao 36) and some markers dry', () => {
    for (const setup of [
      preset('Honolulu 120'),
      preset('Ciao 36 - Set A'),
      preset('Honolulu 48') +
        `; COLORS.forEach((c, i) => { if (isOwned(i) && i % 3 === 0) state.ink[mkey(i)] = 'dry'; })`,
    ]) {
      const a = appWith(setup),
        E = a.__eval;
      const LAB = E('LAB'),
        de = a.de2000,
        noink = new Set(E('[...NOINK]')),
        brand = E('COLORS.map((c) => c.brand)');
      const usable = E('COLORS.map((c, i) => isOwned(i) && !isDry(i))'),
        mine = new Set(E('[...state.owned].map((k) => k.split("|")[0])'));
      let others = 0;
      for (const hex of grid(7)) {
        const t = a.hexToLab(hex),
          r = near(a, hex);
        const all = [];
        for (let i = 0; i < LAB.length; i++) if (!noink.has(i)) all.push({ i, d: de(t, LAB[i]) });
        all.sort((x, y) => x.d - y.d || x.i - y.i);
        const best = r.owned.length ? r.owned[0].d : Infinity,
          yours = all.find((o) => mine.has(brand[o.i])).d;
        const want = all
          .filter((o) => mine.has(brand[o.i]) && !usable[o.i])
          .slice(0, 3)
          .filter((o) => o.d <= all.find((x) => usable[x.i]).d - 2)
          .map((o) => o.i);
        assert.deepEqual(
          r.buy.map((o) => o.i),
          want,
          hex + ': up to 3 of your brands, clearly closer',
        );
        const oth = all.find((o) => !mine.has(brand[o.i]));
        assert.deepEqual(
          r.other.map((o) => o.i),
          oth && oth.d <= Math.min(best, yours) - 2 ? [oth.i] : [],
          hex + ': the other brand',
        );
        others += r.other.length;
      }
      assert.ok(others > 0, 'the other brand is offered somewhere');
    }
  });
  test('a dry marker still makes its brand yours; both brands, or none, or only a Colorless Blender: no other-brand row', () => {
    const dry = appWith(
      preset('Honolulu 120') + `; COLORS.forEach((c, i) => { if (isOwned(i)) state.ink[mkey(i)] = 'dry'; })`,
    );
    const r = near(dry, '#3a7bd5');
    assert.equal(r.owned.length, 0);
    assert.ok(r.buy.length === 3 && r.buy.every((o) => o.k.startsWith('Ohuhu|')), JSON.stringify(r.buy));
    assert.deepEqual(
      r.other.map((o) => o.k),
      ['Copic|B06'],
      'Copic only as the one clearly closer',
    );
    for (const setup of [
      preset('Honolulu 120') + ';' + preset('Ciao 36 - Set A'),
      '',
      `state.owned.add('Copic|0')`,
    ]) {
      const a = appWith(setup);
      for (const hex of grid(5)) assert.deepEqual(near(a, hex).other, [], setup + ' ' + hex);
    }
    // none: the three nearest of both brands, as before
    const e = near(appWith(''), '#3a7bd5');
    assert.equal(e.buy.length, 3);
    assert.equal(e.buy[0].k, 'Copic|B06', 'the nearest of the whole range');
    assert.deepEqual(
      near(appWith(''), '#005ab4').buy.map((o) => o.k),
      ['Copic|B37', 'Ohuhu|B115', 'Ohuhu|BV312'],
    );
  });
  test('the Markers screen’s brand filter doesn’t change a match', () => {
    const a = appWith(own(OWN));
    const before = near(a, '#3a7bd5');
    a.__eval(`state.brands = new Set(['Copic'])`);
    assert.deepEqual(near(a, '#3a7bd5'), before);
  });
  test('Find similar: the marker itself left out, and only it (a same-colour twin, as Ohuhu RV33 and RV34 were until v318.29)', () => {
    const a = appWith(preset('Honolulu 320 (complete set)')),
      E = a.__eval;
    const i = E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'RV33')`),
      j = E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'RV34')`);
    E(`COLORS[${i}].hex = COLORS[${j}].hex; LAB[${i}] = LAB[${j}]`);
    const hex = E(`COLORS[${i}].hex`);
    assert.equal(hex, E(`COLORS[${j}].hex`));
    const plain = near(a, hex),
      sim = near(a, hex, { exclude: i });
    assert.ok(
      plain.owned.some((o) => o.i === i),
      'a typed hex still finds the marker',
    );
    assert.ok(
      !sim.owned.some((o) => o.i === i) &&
        !sim.buy.some((o) => o.i === i) &&
        !sim.other.some((o) => o.i === i),
    );
    assert.equal(sim.owned[0].i, j, 'its same-colour twin first');
    assert.equal(sim.owned[0].d, 0);
    // a marker you don't own: not offered to buy as like itself
    const b = appWith(own(OWN)),
      k = b.__eval(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'B115')`);
    const bh = b.__eval(`COLORS[${k}].hex`);
    assert.ok(near(b, bh).buy.some((o) => o.i === k));
    assert.ok(!near(b, bh, { exclude: k }).buy.some((o) => o.i === k));
  });
}

// ---- from v305-photo.test.mjs ----
// v305 (Palette › From photo): the photo's colours come from clustering in L*a*b* rather than median cut, ranked by
// share and colourfulness, so bright colours on a dark or cream ground keep their own hues; a grey subject among
// colours keeps its grey, a small bold colour in a grey scene is kept, a grey photo gives greys, and the same photo
// always gives the same palette. All pictures are drawn here, against Ben's collection (defaultOwned).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  function appBen() {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = defaultOwned(); state.pool = null; state.ink = {}');
    return a;
  }
  // a seeded random number generator (mulberry32)
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a picture for the harness's canvas (at most 9000 pixels, so extractPhotoPalette reads it as it is)
  const W = 114,
    H = 76;
  function img(a, fill) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        d.set([...fill(x, y).map((v) => Math.max(0, Math.min(255, Math.round(v)))), 255], (y * W + x) * 4);
    const im = new (a.__eval('Image'))();
    im.src = 'data:image/x-mslabels;' + W + ',' + H + ',' + Buffer.from(d.buffer).toString('base64');
    return im;
  }
  const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const SIX = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
  // six discs over 30% of a plain ground
  function discs(a, ground) {
    const r = Math.sqrt((0.3 * W * H) / 6 / Math.PI);
    return img(a, (x, y) => {
      for (let k = 0; k < 6; k++) {
        const cx = ((k % 3) + 0.5) * (W / 3),
          cy = (Math.floor(k / 3) + 0.5) * (H / 2);
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return hexRgb(SIX[k]);
      }
      return hexRgb(ground);
    });
  }
  const hueGap = (p, q) => Math.min(Math.abs(p - q), 360 - Math.abs(p - q));
  function palette(a, im, n) {
    return [...a.extractPhotoPalette(im, n).markers];
  }
  // every one of the six colours has a marker of its own hue (within 25°) that is clearly coloured
  function sixHues(a, pal, what) {
    const LCH = a.__eval('LCH'),
      COLORS = a.__eval('COLORS');
    for (const hex of SIX) {
      const t = a.hexToLab(hex),
        h = (Math.atan2(t[2], t[1]) * 180) / Math.PI;
      assert.ok(
        pal.some((i) => LCH[i][1] >= 25 && hueGap(LCH[i][2], (h + 360) % 360) <= 25),
        `${what}: a marker for ${hex} among ${pal.map((i) => COLORS[i].code).join(' ')}`,
      );
    }
  }
  test('From photo: six bright blocks, and six discs on a dark or a cream ground, give all six hues at 6 colours', () => {
    const a = appBen(),
      LCH = a.__eval('LCH');
    sixHues(
      a,
      palette(
        a,
        img(a, (x) => hexRgb(SIX[Math.floor((x * 6) / W)])),
        6,
      ),
      'blocks',
    );
    for (const ground of ['#1b1c22', '#efe6d2']) {
      const pal = palette(a, discs(a, ground), 6);
      sixHues(a, pal, ground);
      // the ground takes no marker: all six are clearly coloured (v304 gave white, black and browns for the dark one)
      assert.ok(
        pal.every((i) => LCH[i][1] >= 25),
        ground + ': no grey, black or brown',
      );
    }
  });
  test('From photo: a grey cat on grass under a blue sky keeps a grey at 4 colours', () => {
    const a = appBen(),
      LCH = a.__eval('LCH'),
      r = seeded(3);
    const cat = img(a, (x, y) => {
      if (y < H * 0.19) {
        const v = r() * 12 - 6;
        return [155 + v, 190 + v, 235 + v];
      }
      const dx = (x - W / 2) / (W * 0.32),
        dy = (y - H * 0.58) / (H * 0.35);
      if (dx * dx + dy * dy <= 1) {
        const v = 40 + r() * 180;
        return [v, v, v];
      }
      const v = r() * 30 - 15;
      return [50 + v, 130 + v, 45 + v];
    });
    const pal = palette(a, cat, 4);
    assert.ok(
      pal.some((i) => LCH[i][1] < 12),
      'a grey for the cat',
    );
    assert.ok(
      pal.some((i) => LCH[i][1] >= 25 && hueGap(LCH[i][2], 140) <= 30),
      'a green for the grass',
    );
  });
  test('From photo: a small red umbrella (under 2% of the photo) in a grey street keeps its red at 4 colours', () => {
    const a = appBen(),
      LCH = a.__eval('LCH'),
      r = seeded(5);
    const street = img(a, (x, y) => {
      if (x >= 48 && x < 61 && y >= 28 && y < 39) return [200, 30, 38];
      const v = 80 + (110 * x) / W + r() * 10 - 5;
      return [v, v, v];
    });
    const pal = palette(a, street, 4),
      red = a.hexToLab('#c81e26'),
      h = (Math.atan2(red[2], red[1]) * 180) / Math.PI;
    assert.ok(
      pal.some((i) => LCH[i][1] >= 40 && hueGap(LCH[i][2], h) <= 20),
      'a red for the umbrella',
    );
    assert.ok(pal.filter((i) => LCH[i][1] < 12).length >= 2, 'and greys for the street');
  });
  test('From photo: a photo with no colour gives only greys', () => {
    const a = appBen(),
      LCH = a.__eval('LCH'),
      r = seeded(9);
    const grey = img(a, (x) => {
      const v = 30 + (200 * x) / W + r() * 10 - 5;
      return [v, v, v + 2];
    });
    for (const n of [4, 6, 8]) {
      const pal = palette(a, grey, n);
      assert.equal(pal.length, n);
      assert.ok(
        pal.every((i) => LCH[i][1] < 15),
        n + ': ' + pal.map((i) => Math.round(LCH[i][1])).join(' '),
      );
    }
  });
  test('From photo: the same photo always gives the same palette (in one app and in another)', () => {
    const a = appBen(),
      b = appBen(),
      r = seeded(11);
    const noise = Array.from({ length: W * H }, () => [r() * 255, r() * 255, r() * 255]),
      fill = (x, y) => noise[y * W + x];
    for (const n of [4, 8, 12]) {
      const first = palette(a, img(a, fill), n);
      assert.equal(first.length, n);
      assert.deepEqual(palette(a, img(a, fill), n), first, n + ': again in the same app');
      assert.deepEqual(palette(b, img(b, fill), n), first, n + ': in another app');
    }
  });
}

// ---- from v307-markers.test.mjs ----
// v307 (markers branch): Palette › From photo's "Photo looks warm · Balance it" for a photo with no paper (a tray of
// caps under a lamp) and "Tap something white"; the service worker's page loads; Markers' search for a hex code;
// Help › Your data.
{
  const app = () => createApp({ localStorage: memoryStorage() });
  // ---- synthetic photos (drawn here) -------------------------------------------------------------------------------
  function canvas(w, h, bg) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) d.set([...bg, 255], p * 4);
    return { w, h, d };
  }
  function rect(im, x0, y0, x1, y1, c) {
    for (let y = Math.max(0, y0); y < Math.min(im.h, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(im.w, x1); x++) im.d.set(c, (y * im.w + x) * 4);
  }
  function ellipse(im, cx, cy, rx, ry, c) {
    for (let y = 0; y < im.h; y++)
      for (let x = 0; x < im.w; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) im.d.set(c, (y * im.w + x) * 4);
  }
  const toLin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const toS = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  // the light's colour, per channel in linear light
  function cast(im, k) {
    for (let i = 0; i < im.d.length; i += 4)
      for (let c = 0; c < 3; c++) im.d[i + c] = toS(Math.min(1, toLin(im.d[i + c]) * k[c]));
    return im;
  }
  function hsl(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12,
        a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }
  // a tray of caps seen from above, as Ben photographs his: a rainbow of round caps (strong and pale rows) on a dark
  // bag, each with a small white label, under a dim, warm lamp (the light measured on his photo: white labels at
  // linear 0.53 / 0.39 / 0.25)
  const TRAY_LIGHT = [0.55, 0.41, 0.26];
  function tray(w, h, light = TRAY_LIGHT) {
    const im = canvas(w, h, [26, 22, 24]),
      cols = 10,
      rows = 7,
      cw = w / cols,
      rh = h / rows,
      r = Math.min(cw, rh) * 0.45;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const cx = (i + 0.5) * cw,
          cy = (j + 0.5) * rh;
        ellipse(im, cx, cy, r, r, hsl(((i + j * 0.3) / cols) * 330, 0.6, j % 2 ? 0.62 : 0.4));
        const lw = Math.max(1, Math.round(r * 0.7));
        rect(
          im,
          Math.round(cx - lw / 2),
          Math.round(cy - lw / 2),
          Math.round(cx + lw / 2),
          Math.round(cy + lw / 2),
          [246, 245, 240],
        );
      }
    return cast(im, light);
  }
  // sunsets: a sky from violet to orange over dark land, a pale sun and warm clouds (the sun blown out to near-white in
  // one); the same exposed darker
  function sunset(w, h, { sun = [255, 240, 200], light = [1, 1, 1] } = {}) {
    const im = canvas(w, h, [30, 25, 40]);
    for (let y = 0; y < h * 0.66; y++) {
      const t = y / h;
      rect(
        im,
        0,
        y,
        w,
        y + 1,
        [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round),
      );
    }
    ellipse(im, w / 2, h / 2, w * 0.075, w * 0.075, sun);
    ellipse(im, w / 4, h / 6, w * 0.19, h * 0.07, [250, 214, 190]);
    ellipse(im, w * 0.72, h * 0.22, w * 0.18, h * 0.06, [250, 214, 190]);
    return cast(im, light);
  }
  const SUNSETS = {
    'a sunset': sunset(160, 120),
    'a sunset with the sun blown out': sunset(160, 120, { sun: [255, 253, 248] }),
    'a sunset exposed darker': sunset(160, 120, { light: [0.55, 0.5, 0.45] }),
    'a dim sunset, warm all over': sunset(160, 120, { light: [0.6, 0.45, 0.3] }),
  };
  const arr = (im) => JSON.stringify([...im.d]);
  // paperWarm and photoWarm on one photo (as the app reads it: 160 × 120)
  function offers(E, im) {
    return JSON.parse(
      E(`(function () { const d = new Uint8ClampedArray(${arr(im)}), p = paperWarm(d), q = photoWarm(d, ${im.w});
      return JSON.stringify({ paper: !!p, photo: q && { lab: [...q.lab], warm: q.warm, gain: [...q.fix.gain] } }); })()`),
    );
  }
  // an image the harness's canvas reads back exactly, for extractPhotoPalette (no more than 9000 pixels: not scaled)
  function harnessImage(a, im) {
    const x = new (a.__eval('Image'))();
    x.src = 'data:image/x-mslabels;' + im.w + ',' + im.h + ',' + Buffer.from(im.d.buffer).toString('base64');
    return x;
  }
  // ---- the service worker: page loads ignore the query ------------------------------------------------------------
  // service-worker.js run in a sandbox with a made-up Cache Storage (caches.match with ignoreSearch, as browsers do it)
  // and network; `online` says whether fetch reaches the server
  function swSandbox() {
    const ORIGIN = 'https://ms.test/';
    const stores = new Map(),
      fetched = [],
      handlers = {};
    const key = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN).href;
    const cache = (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return {
        match: async (r, o) => {
          const u = new URL(key(r));
          for (const [k, v] of m) {
            const c = new URL(k);
            if (o && o.ignoreSearch ? c.origin + c.pathname === u.origin + u.pathname : k === u.href)
              return v;
          }
        },
        put: async (r, res) => void m.set(key(r), res),
        add: async (u) =>
          void m.set(key(u), {
            ok: true,
            body: 'file ' + key(u),
            clone() {
              return this;
            },
          }),
        addAll: async (l) =>
          l.forEach((u) =>
            m.set(key(u), {
              ok: true,
              body: 'file ' + key(u),
              clone() {
                return this;
              },
            }),
          ),
      };
    };
    const ctx = {
      online: true,
      URL,
      Promise,
      Request: function (u) {
        return { url: key(u), method: 'GET', mode: 'cors' };
      },
      caches: {
        open: async (n) => cache(n),
        keys: async () => [...stores.keys()],
        delete: async (n) => stores.delete(n),
        match: async (r, o) => {
          for (const n of stores.keys()) {
            const hit = await cache(n).match(r, o);
            if (hit) return hit;
          }
        },
      },
      fetch: async (r) => {
        fetched.push(key(r));
        if (!ctx.online) throw new TypeError('offline');
        return {
          ok: true,
          body: 'net ' + key(r),
          clone() {
            return this;
          },
        };
      },
      self: null,
    };
    ctx.self = {
      // (v318.32: the worker stores only its own origin's files, D3-2)
      location: { origin: ORIGIN.slice(0, -1), href: ORIGIN + 'service-worker.js' },
      addEventListener: (t, f) => (handlers[t] = f),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    };
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), ctx);
    const life = async (t) => {
      let p;
      handlers[t]({ waitUntil: (x) => (p = x) });
      await p;
    };
    // a request through the worker: what it answered with
    const get = async (path, mode = 'navigate') => {
      let p;
      handlers.fetch({ request: { url: ORIGIN + path, method: 'GET', mode }, respondWith: (x) => (p = x) });
      const res = await p;
      await new Promise((r) => setTimeout(r, 0));
      return res && res.body;
    };
    const stored = () =>
      [...stores.values()].flatMap((m) => [...m.keys()]).map((k) => k.slice(ORIGIN.length));
    return { ctx, stores, fetched, life, get, stored };
  }
  test('Photo looks warm: a warm, dim tray of caps with no paper is offered a balance from its white labels', () => {
    const E = app().__eval;
    const r = offers(E, tray(160, 120));
    assert.equal(r.paper, false, 'no paper in the photo');
    assert.ok(r.photo, 'offered');
    assert.equal(r.photo.warm, true, 'warm, not only dim: ' + r.photo.lab);
    assert.ok(r.photo.lab[0] >= 35 && r.photo.lab[0] < 80, 'the labels are dim: L* ' + r.photo.lab[0]);
    assert.ok(r.photo.gain[2] > r.photo.gain[0] * 1.5, 'it cools the picture: ' + r.photo.gain);
    // the white labels come out about paper white (L* 95) and grey
    const lab = JSON.parse(
      E(`(function () { const d = new Uint8ClampedArray(${arr(tray(160, 120))}), q = photoWarm(d, 160);
      let best = null;
      for (let i = 0; i < d.length; i += 4) if (!best || d[i] + d[i + 1] + d[i + 2] > best[0] + best[1] + best[2]) best = [d[i], d[i + 1], d[i + 2]];
      const px = lightApply(q.fix, best[0], best[1], best[2]); return JSON.stringify([...rgbLab8(px[0], px[1], px[2])]); })()`),
    );
    assert.ok(lab[0] > 92 && lab[0] < 98, 'about L* 95: ' + lab);
    assert.ok(Math.hypot(lab[1], lab[2]) < 4, 'the cast gone: ' + lab);
    // the same tray in a darker, neutral room: offered as dim, not warm
    const dim = offers(E, tray(160, 120, [0.4, 0.4, 0.4]));
    assert.ok(dim.photo && dim.photo.warm === false, JSON.stringify(dim));
    // and in daylight: nothing to offer
    assert.equal(offers(E, tray(160, 120, [1, 1, 1])).photo, null);
  });
  test('Photo looks warm: balancing the tray brings back its blues, greens and violets (Ben’s markers)', () => {
    const a = createApp(),
      E = a.__eval;
    const im = tray(100, 75),
      fix = E(`photoWarm(new Uint8ClampedArray(${arr(tray(160, 120))}), 160).fix`);
    const hues = (fixOrNull) =>
      [...a.extractPhotoPalette(harnessImage(a, im), 8, fixOrNull).markers]
        .map((i) => E(`LCH[${i}]`))
        .map((l) => [...l]);
    const cool = (pal) => pal.filter((l) => l[1] >= 15 && l[2] >= 130 && l[2] <= 320).length,
      browns = (pal) => pal.filter((l) => l[2] >= 30 && l[2] < 100 && l[0] < 72 && l[1] < 45).length;
    const before = hues(null),
      after = hues(fix);
    // (v308: From photo's first pass keeps hues apart, so the tray as photographed has some already)
    assert.ok(cool(after) >= cool(before), `cool colours ${cool(before)} → ${cool(after)}`);
    assert.ok(
      browns(before) >= 1,
      'as photographed it gives browns and beiges: ' + JSON.stringify(before.map((l) => l.map(Math.round))),
    );
    assert.equal(
      browns(after),
      0,
      'none once balanced: ' + JSON.stringify(after.map((l) => l.map(Math.round))),
    );
    assert.ok(
      cool(after) >= 3,
      'blues, greens and violets: ' + JSON.stringify(after.map((l) => l.map(Math.round))),
    );
  });
  test('Photo looks warm: never offered for a sunset, pale fur, a beach or one lamp; paper under a lamp is still "Paper looks warm"', () => {
    const E = app().__eval;
    const others = {
      ...SUNSETS,
      'pale fur': canvas(160, 120, [178, 166, 150]),
      'a beach': (() => {
        const im = canvas(160, 120, [225, 200, 160]);
        rect(im, 0, 0, 160, 48, [140, 190, 235]);
        rect(im, 0, 48, 160, 60, [40, 110, 160]);
        return im;
      })(),
      'a dim, warm room with one white lamp shade': (() => {
        const im = canvas(160, 120, [70, 60, 55]);
        rect(im, 20, 60, 140, 120, [110, 70, 50]);
        ellipse(im, 40, 30, 10, 12, [245, 245, 240]);
        return cast(im, TRAY_LIGHT);
      })(),
    };
    for (const [name, im] of Object.entries(others)) {
      const r = offers(E, im);
      assert.equal(r.photo, null, name + ': ' + JSON.stringify(r));
      assert.equal(r.paper, false, name);
    }
    // caps on white paper under a lamp: the paper is found, so the app offers "Paper looks warm · Make it white" (v306)
    const page = canvas(160, 120, [250, 250, 248]);
    for (let i = 0; i < 12; i++)
      ellipse(page, 15 + (i % 6) * 26, 40 + ((i / 6) | 0) * 40, 9, 9, hsl(i * 28, 0.7, 0.5));
    assert.equal(offers(E, cast(page, [1, 0.88, 0.7])).paper, true);
  });
  test('Tap something white: a small white label among dark caps can be tapped; red, a pale yellow cap or the dark can’t', () => {
    const E = app().__eval;
    const im = tray(160, 120);
    const at = (x, y, loose = true, fn = 'whiteLin') =>
      JSON.parse(
        E(`(function () { const d = new Uint8ClampedArray(${arr(im)}), lin = ${fn}(d, 160, 120, ${x}, ${y}, 3);
        const r = paperSpot(lin, ${loose}); return JSON.stringify({ bad: !!r.bad, fix: !!r.fix, note: r.note }); })()`),
      );
    // the first cap's label is at (8, 8.6); the patch (7 × 7) is mostly cap and bag
    assert.deepEqual(at(8, 9), { bad: false, fix: true, note: '' }, 'the label');
    assert.equal(at(8, 9, false).bad, true, 'paper’s limits (v306) refused it');
    assert.equal(at(8, 9, true, 'patchLin').bad, true, 'the average of the patch is the cap, not white');
    assert.equal(at(0, 0).bad, true, 'the bag');
    const spot = E('paperSpot'),
      lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
    for (const c of [
      [200, 50, 60],
      [15, 15, 15],
      [250, 235, 150],
      [180, 220, 140],
    ]) {
      const r = spot(lin8(...c), true);
      assert.equal(r.bad, true, String(c));
      assert.equal(
        r.note,
        'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
      );
    }
    // a plain white thing: the brightest quarter of the patch is the patch
    const flat = new Uint8ClampedArray(5 * 5 * 4).fill(200);
    const wl = [...E('whiteLin')(flat, 5, 5, 2, 2, 2)],
      pl = [...E('patchLin')(flat, 5, 5, 2, 2, 2)];
    wl.forEach((v, k) => assert.ok(Math.abs(v - pl[k]) < 1e-9, wl + ' / ' + pl));
    // paper as before: the grey paper of a phone photo, and paper already white
    assert.ok(spot(lin8(186, 176, 160), true).fix);
    assert.equal(spot(lin8(242, 242, 242), true).note, 'That already looks white: nothing to correct.');
  });
  test('service worker: a page load with a query (?back=1) is the cached page, and no copy of it is stored', async () => {
    const sw = swSandbox();
    await sw.life('install');
    await sw.life('activate');
    const before = sw.stored().sort();
    // (v308: the page is stored once, as index.html, not also as ./)
    assert.ok(!before.includes('') && before.includes('index.html'), String(before));
    sw.fetched.length = 0;
    assert.equal(await sw.get('?back=1'), 'file https://ms.test/index.html', 'the cached page');
    assert.equal(await sw.get('index.html?from=home'), 'file https://ms.test/index.html');
    assert.deepEqual(sw.fetched, [], 'no network for a page the cache has');
    assert.deepEqual(sw.stored().sort(), before, 'no copy per address');
    // offline too
    sw.ctx.online = false;
    assert.equal(await sw.get('?back=1&x=2'), 'file https://ms.test/index.html');
    // anything else is matched exactly, as before: a file with a query is its own entry, kept once fetched
    sw.ctx.online = true;
    assert.equal(await sw.get('icon-192.png?v=2', 'no-cors'), 'net https://ms.test/icon-192.png?v=2');
    assert.ok(sw.stored().includes('icon-192.png?v=2'));
    // a page with a query the cache doesn't have (another path) comes from the network and isn't stored
    assert.equal(await sw.get('other.html?a=1'), 'net https://ms.test/other.html?a=1');
    assert.ok(!sw.stored().some((k) => k.startsWith('other.html')));
    // without a query it is, as before
    assert.equal(await sw.get('other.html'), 'net https://ms.test/other.html');
    assert.ok(sw.stored().includes('other.html'));
  });
  test('service worker: updates as before (the new version’s cache, the old one deleted on activate)', async () => {
    const sw = swSandbox();
    sw.stores.set('marker-studio-v1', new Map([['https://ms.test/', { body: 'old' }]]));
    // (v313: PDF.js's cache, named after its version, is kept from one release to the next; an older PDF.js's goes)
    const src = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'),
      pdfc = 'marker-studio-pdfjs-' + src.match(/PDFJS='([^']+)'/)[1];
    sw.stores.set(pdfc, new Map([['https://ms.test/vendor/kept', { body: 'kept' }]]));
    sw.stores.set('marker-studio-pdfjs-0.0.1', new Map());
    await sw.life('install');
    await sw.life('activate');
    const name = src.match(/CACHE='([^']+)'/)[1];
    assert.deepEqual([...sw.stores.keys()].sort(), [name, pdfc].sort());
    assert.ok(sw.stores.get(pdfc).has('https://ms.test/vendor/kept'), 'PDF.js kept as it was');
    assert.equal(await sw.get('?back=1'), 'file https://ms.test/index.html');
    // a PDF.js file is fetched once, then comes from its own cache
    const f = 'vendor/pdfjs/' + src.match(/PDFJS='([^']+)'/)[1] + '/pdf.min.mjs';
    await sw.get(f, 'no-cors');
    assert.ok(
      [...sw.stores.get(pdfc).keys()].some((k) => String(k).endsWith(f)),
      'stored in its own cache',
    );
    sw.ctx.online = false;
    assert.match(await sw.get(f, 'no-cors'), /pdf\.min\.mjs/);
  });
  // ---- Markers' search: a hex code offers Match this colour ---------------------------------------------------------
  test('Markers search: a hex code (#ff0000, ff0000, f00) is read as a colour; codes and words aren’t', () => {
    const E = app().__eval,
      hex = E('searchHex');
    assert.equal(hex('#ff0000'), '#ff0000');
    assert.equal(hex('FF0000'), '#ff0000');
    assert.equal(hex(' f00 '), '#ff0000');
    assert.equal(hex('#3A7bD5'), '#3a7bd5');
    for (const q of ['R22', 'Y26', 'cool grey 3', 'ff00', '#ff00000', 'red', 'BG0000', ''])
      assert.equal(hex(q), null, q);
    // (the offer is only for a search that finds no marker: "E00" is a Copic code as well as a hex code)
    E(
      `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
    );
    assert.ok(E(`searchStr = 'e00'; finderMatches().length`) > 0);
    assert.equal(E(`searchStr = '#ff0000'; finderMatches().length`), 0);
  });
}

// ---- from v31829.test.mjs ----
// v318.29: Ohuhu RV33 Thistle and RV34 Faded Lilac no longer share one colour. Measured on Ben's own scanned swatch card
// (Color Swatch 2, side by side): about 1.25 apart (CIEDE2000), RV33 the warmer. RV34 keeps the list's #efd4e7 (the
// nearer of the two to it); RV33 is that far from it, in the scanned direction.
{
  test('RV33 and RV34: two colours, about as far apart as on the swatch card, RV34 as before', () => {
    const a = createApp(),
      E = a.__eval;
    const ix = (c) => E(`COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === '${c}')`);
    const i = ix('RV33'),
      j = ix('RV34');
    assert.equal(E(`COLORS[${j}].hex`), '#efd4e7');
    assert.equal(E(`COLORS[${i}].hex`), '#edd5e5');
    const d = +E(`de2000(LAB[${i}], LAB[${j}])`);
    assert.ok(d > 1 && d < 1.5, 'apart by ' + d);
    // no two inked markers share a colour now (the Colorless Blenders are white, and aren't matched)
    const dup = E(
      `(() => { const s = new Map(); let n = 0; COLORS.forEach((m, k) => { if (NOINK.has(k)) return; const h = m.hex.toLowerCase(); if (s.has(h)) n++; s.set(h, k); }); return n; })()`,
    );
    assert.equal(dup, 0);
  });
  test('a rough spot’s ring sits on the line two sections share, not on the code of a shape inside another', () => {
    const core = createApp().__mstest;
    // a 100 × 100 page: a square (2) inside another (1), a 2 px line between them
    const W = 100,
      H = 100,
      labels = new Int32Array(W * H).fill(1);
    for (let y = 28; y < 72; y++)
      for (let x = 28; x < 72; x++) labels[y * W + x] = x < 30 || x >= 70 || y < 30 || y >= 70 ? 0 : 2;
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = [
      null,
      { cx: 50, cy: 15, area: 8064, merged: false, bg: false },
      { cx: 50, cy: 50, area: 1600, merged: false, bg: false },
    ];
    const [p] = core.grad.roughPts([[1, 2, 30]]);
    // on the line (within a few pixels of the inner square's edge), well away from its middle where its code is
    const edge = Math.min(Math.abs(p.x - 29), Math.abs(p.x - 70), Math.abs(p.y - 29), Math.abs(p.y - 70));
    assert.ok(edge <= 3, 'on the line: ' + JSON.stringify(p));
    assert.ok(Math.hypot(p.x - 50, p.y - 50) >= 15, 'away from the code: ' + JSON.stringify(p));
  });
}
