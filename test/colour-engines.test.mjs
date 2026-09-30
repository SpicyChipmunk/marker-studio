// The lookups and colour rules several patterns share (js/colour.js, js/guide/30-palette-assign.js,
// js/guide/88-coverage-blend.js): the closest marker by eye (Blend, the Photo pattern, stand-ins for dry or missing
// markers), CIEDE2000 split into lightness and colour (Expand with nearby markers), Blend's three mixes, which markers
// are warm and which cool, blend companions, and which sections touch (Random). The browser tests cover the controls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// an app whose guide uses the whole catalogue (as in demo mode), or these marker sets
function appWith(sets = []) {
  const app = createApp(), E = app.__eval, core = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets) E(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`);
  core.coll = E('sfCollection()');
  return { app, E, core, K: core.colour, coll: core.coll };
}
const lch = (l) => { let h = (Math.atan2(l[2], l[1]) * 180) / Math.PI; if (h < 0) h += 360; return [l[0], Math.hypot(l[1], l[2]), h]; };
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const d76 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// a repeatable run of random numbers
function rng(s) { return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }

test('CIEDE2000 split: its lightness and colour parts add up to it squared; a change of lightness alone is all lightness, of hue alone all colour', () => {
  const { app } = appWith();
  const r = rng(3);
  for (let i = 0; i < 400; i++) {
    const a = [r() * 100, r() * 160 - 80, r() * 160 - 80], b = [r() * 100, r() * 160 - 80, r() * 160 - 80];
    const [pl, pc] = app.de2000Split(a, b), d = app.de2000(a, b);
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
  const exact = (lab, pool) => { let b = null, v = Infinity; for (const m of pool) { const d = app.de2000(lab, m.lab); if (d < v) { v = d; b = m; } } return b; };
  const r = rng(11), small = coll.filter((_, i) => i % Math.ceil(coll.length / 36) === 0);
  assert.ok(small.length <= 40 && small.length > 20);
  let same = 0, n = 0, worse = 0, oldDiffers = 0;
  for (let i = 0; i < 600; i++) {
    const lab = app.hexToLab('#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0'));
    assert.equal(K.nearest(lab, small), exact(lab, small), 'a pool of 40 or fewer is searched whole');
    const want = exact(lab, coll), got = K.nearest(lab, coll);
    n++;
    if (got === want) same++;
    else worse = Math.max(worse, app.de2000(lab, got.lab) - app.de2000(lab, want.lab));
    // (plain L*a*b* distance, as it was: often another marker)
    let o = null, ov = Infinity;
    for (const m of coll) { const d = d76(lab, m.lab); if (d < ov) { ov = d; o = m; } }
    if (o !== want) oldDiffers++;
  }
  assert.ok(same / n >= 0.97, `the shortlist found the closest by eye ${same} of ${n} times`);
  assert.ok(worse < 3, 'when it misses, it is by a hair: ' + worse);
  assert.ok(oldDiffers / n > 0.2, 'plain distance disagreed with the eye often: ' + oldDiffers);
  // a colour where plain L*a*b* distance and the eye disagree (a stronger red of the same lightness looks nearer
  // than a lighter one of the same strength): the eye wins
  const two = [{ mkey: 'a', lab: [50, 60, 0] }, { mkey: 'b', lab: [66, 30, 0] }], lab = [50, 30, 0];
  assert.ok(d76(lab, two[0].lab) > d76(lab, two[1].lab) && app.de2000(lab, two[0].lab) < app.de2000(lab, two[1].lab));
  assert.equal(K.nearest(lab, two).mkey, 'a');
  // equals: the first in the pool; a marker without a colour is passed over
  const same2 = [{ mkey: 'x', lab: [50, 0, 0] }, { mkey: 'y', lab: [50, 0, 0] }];
  assert.equal(K.nearest([52, 1, 1], same2).mkey, 'x');
  assert.equal(K.nearest([52, 1, 1], [{ mkey: 'n' }, ...same2]).mkey, 'x');
  const big = coll.concat([{ mkey: 'dup', lab: coll[5].lab.slice() }]);
  assert.equal(K.nearest(coll[5].lab.slice(), big), coll[5], 'the first of equals in a big pool too');
});

test('Blend’s Mix, Soft: the weighted average in L*a*b*, as it always was', () => {
  const { K } = appWith();
  const ax = [{ lab: [40, 60, 20], hex: '#000000' }, { lab: [80, -20, 50], hex: '#000000' }];
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
  assert.ok(Math.abs(x[0] - 60) < 1e-6 && Math.abs(x[1] - 40) < 1e-6 && hueDiff(x[2], 120) < 1e-6, x.join());
  // exactly opposite (0° and 180°): through the yellow side (90°), from either end
  const op = K.mixer(ax(at(60, 30, 0), at(60, 30, 180)), 'vivid');
  for (const [w, want] of [[[1, 1], 90], [[3, 1], 45], [[1, 3], 135]]) assert.ok(hueDiff(lch(op(w))[2], want) < 1e-6, `${w}: ${lch(op(w))[2]}`);
  const op2 = K.mixer(ax(at(60, 30, 250), at(60, 30, 70)), 'vivid');
  assert.ok(hueDiff(lch(op2([1, 1]))[2], 160) < 1e-6, 'via 160°, the side nearer yellow: ' + lch(op2([1, 1]))[2]);
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
  const clip = app.labClip([60, 120, -120]), back = app.labClip(clip);
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
  const end = by([1, 0]), a = app.hexToLab('#2050e0');
  a.forEach((v, i) => assert.ok(Math.abs(end[i] - v) < 1e-6));
  // the same colour twice stays that colour
  const same = K.mixer(ax('#c04080', '#c04080'), 'paint')([2, 5]), c = app.hexToLab('#c04080');
  c.forEach((v, i) => assert.ok(Math.abs(same[i] - v) < 1e-6));
});

test('warm and cool: every coloured marker is exactly one; reds to yellows and red-violets warm, yellow-greens to violets cool; greys by their tint, neutral ones and black both', () => {
  const { K, coll } = appWith();
  const find = (b, c) => { const m = coll.find((x) => x.brand === b && x.code === c); assert.ok(m, b + ' ' + c); return m; };
  const t = (b, c) => K.temp(find(b, c));
  for (const m of coll) {
    const x = lch(m.lab), v = K.temp(m);
    if (x[1] >= 12) assert.ok(v === 'warm' || v === 'cool', `${m.brand} ${m.code}: ${v}`);
    else assert.ok(['warm', 'cool', 'both'].includes(v));
  }
  // clear colours either side of the two lines, and ones that used to be in neither or both
  for (const [b, c, want] of [
    ['Ohuhu', 'R16', 'warm'], ['Ohuhu', 'YR111', 'warm'], ['Copic', 'Y17', 'warm'], ['Ohuhu', 'YG06', 'warm'],
    ['Ohuhu', 'YG211', 'warm'], ['Ohuhu', 'YG29', 'cool'], ['Ohuhu', 'YG66', 'cool'], ['Copic', 'G85', 'cool'],
    ['Ohuhu', 'G410', 'cool'], ['Ohuhu', 'B06', 'cool'], ['Ohuhu', 'V112', 'cool'], ['Ohuhu', 'RV316', 'warm'],
    ['Copic', 'V12', 'warm'], ['Ohuhu', 'RV111', 'warm'],
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
  const w = K.poolFor('warm'), c = K.poolFor('cool'), all = K.poolFor('all');
  const both = all.filter((m) => K.temp(m) === 'both').length;
  assert.equal(w.length + c.length, all.length + both);
  assert.ok(w.includes(find('Ohuhu', 'WG10')) && c.includes(find('Ohuhu', 'WG10')));
});

test('blend companions: really lighter or darker by a step you can see, the same hue; a family member that isn’t is passed over (Ohuhu BV31/BV32, Copic Y17/Y18)', () => {
  const { K, coll, app } = appWith();
  const find = (b, c) => coll.find((x) => x.brand === b && x.code === c);
  const comp = (b, c, side, pool = coll) => { const m = find(b, c); return K.companion(m.lab, m, pool, side); };
  const bv31 = find('Ohuhu', 'BV31'), bv32 = find('Ohuhu', 'BV32');
  assert.ok(bv32.lab[0] >= bv31.lab[0], 'BV32 is the lighter of the two');
  const d = comp('Ohuhu', 'BV31', 1);
  assert.ok(d && d.mkey !== bv32.mkey && bv31.lab[0] - d.lab[0] >= 4, 'BV31 darker: ' + (d && d.code));
  const l = comp('Ohuhu', 'BV32', -1);
  assert.ok(!l || (l.mkey !== bv31.mkey && l.lab[0] - bv32.lab[0] >= 4), 'BV32 lighter: ' + (l && l.code));
  const y17 = find('Copic', 'Y17'), y18 = find('Copic', 'Y18');
  assert.ok(y18.lab[0] > y17.lab[0], 'Copic Y18 is lighter than Y17');
  const yd = comp('Copic', 'Y17', 1), yl = comp('Copic', 'Y18', -1);
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
      const a = lch(m.lab), b = lch(c.lab), fam = c.brand === m.brand && c.code.replace(/\d$/, '') === m.code.replace(/\d$/, '');
      if (a[1] >= 12 || fam) {
        if (Math.min(a[1], b[1]) >= 6) assert.ok(hueDiff(a[2], b[2]) <= 25, `${m.brand} ${m.code} ${side}: ${c.code} hue`);
      } else assert.ok(b[1] < 12, `${m.brand} ${m.code} ${side}: ${c.code} a grey's is a grey`);
    }
  assert.ok(n > coll.length, n + ' companions');
});

// a picture of cols × rows sections with lines lw px thick between them (and round the edge)
function thickGrid(core, cols, rows, cw, ch, lw) {
  const W = cols * cw, H = rows * ch, labels = new Int32Array(W * H), comps = [null];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) comps.push({ cx: (i + 0.5) * cw, cy: (j + 0.5) * ch, area: cw * ch, merged: false, bg: false });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = Math.floor(x / cw), j = Math.floor(y / ch), ix = x - i * cw, jy = y - j * ch;
      labels[y * W + x] = ix < lw / 2 || ix >= cw - lw / 2 || jy < lw / 2 || jy >= ch - lw / 2 ? -1 : 1 + j * cols + i;
    }
  core.W = W; core.H = H; core.labels = labels; core.comps = comps;
  core.secState = new Uint8Array(comps.length).fill(1);
  core.assignData = null;
  return (i, j) => 1 + j * cols + i;
}

test('touching sections: found across thick lines (up to a 40th of the picture), side by side but not corner to corner', () => {
  const { core, K } = appWith();
  // 1200 × 800, 8 × 5 sections, lines 26 px thick (a 250th of the picture, 5 px, is how far it used to look)
  const at = thickGrid(core, 8, 5, 150, 160, 26);
  const a = K.adj();
  let pairs = 0;
  for (const l in a) pairs += a[l].size;
  assert.equal(pairs / 2, 8 * 4 + 7 * 5, 'every side-by-side pair');
  assert.deepEqual([...a[at(2, 2)]].sort((x, y) => x - y), [at(2, 1), at(1, 2), at(3, 2), at(2, 3)].sort((x, y) => x - y));
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
  const W = 300, H = 300, L = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = x < 140 ? 1 : x < 146 ? -1 : x < 148 && y >= 100 && y < 102 ? 2 : 3;
  core.W = W; core.H = H; core.labels = L; core.comps = [null, { cx: 70, cy: 150, area: 1 }, { cx: 147, cy: 101, area: 4 }, { cx: 220, cy: 150, area: 1 }];
  const a3 = K.adj();
  assert.ok(a3[1].has(3), 'across a 6 px line');
  assert.ok(!a3[1].has(2), 'the speck of 2 is not touching 1');
});

test('Random, Keep touching sections clearly different: no touching sections share a marker or look alike; pins go first; with too few markers it gives way step by step', () => {
  const { core, app, coll } = appWith();
  const at = thickGrid(core, 10, 8, 120, 100, 20), sv = core.styleVars;
  Object.assign(sv, { family: 'random', noAdj: true, paletteSource: 'owned', palette: 'all', emphasis: 'neutral' });
  const pairs = [];
  for (let j = 0; j < 8; j++) for (let i = 0; i < 10; i++) { if (i < 9) pairs.push([at(i, j), at(i + 1, j)]); if (j < 7) pairs.push([at(i, j), at(i, j + 1)]); }
  const cl = core.countedList(), K = core.colour;
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
  for (const nb of [at(3, 4), at(5, 4), at(4, 3), at(4, 5)]) assert.ok(app.de2000(core.assignData.assign[nb].lab, pin.lab) >= 10);
  delete core.locks[at(4, 4)];
  // two markers that look alike: touching sections can't be clearly different, but they aren't the same marker
  let twins = null;
  for (let i = 0; i < coll.length && !twins; i++)
    for (let j = i + 1; j < coll.length; j++) if (coll[i].mkey !== coll[j].mkey && app.de2000(coll[i].lab, coll[j].lab) < 5) { twins = [coll[i], coll[j]]; break; }
  K.random(cl, twins);
  for (const [p, q] of pairs) assert.notEqual(core.assignData.assign[p].mkey, core.assignData.assign[q].mkey);
  // and one marker: that one everywhere
  K.random(cl, twins.slice(0, 1));
  assert.ok(cl.every((l) => core.assignData.assign[l] === twins[0]));
  // off: markers at random, as before (only the pool's)
  sv.noAdj = false;
  K.random(cl, pick(3));
  assert.ok(cl.every((l) => pick(3).includes(core.assignData.assign[l])));
  Math.random = random;
});
