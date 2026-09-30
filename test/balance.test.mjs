// Random's Balance (v283, js/guide/31-balance.js): colour families by how markers look, the three roles Auto or by
// hand (with borrowing for a thin family, two roles when one can't be filled, none when there's no main colour), the
// areas about 60/30/10 with accents on middling sections spread out, pins counting towards their role, and Mixed's
// No repeats. The browser tests (e2e/balance.test.mjs) cover the bar, the sheet, Undo and saving.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, cpuMs } from './harness.mjs';

function appWith(sets) {
  const app = createApp(), E = app.__eval, core = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets) E(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`);
  core.coll = E('sfCollection()');
  const sv = core.styleVars;
  Object.assign(sv, { family: 'random', balance: 'main', balM: 'auto', balS: 'auto', balA: 'auto', balSeed: 0.3, noRep: false, paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 16 });
  return { app, E, core, sv };
}
// cols × rows sections, the sizes varied (every third column twice as wide, every fifth row half as tall)
function grid(core, cols, rows) {
  const xs = [0];
  for (let x = 0; x < cols; x++) xs.push(xs[x] + (x % 3 === 0 ? 40 : 20));
  const ys = [0];
  for (let y = 0; y < rows; y++) ys.push(ys[y] + (y % 5 === 0 ? 10 : 20));
  const W = xs[cols], H = ys[rows], labels = new Int32Array(W * H), comps = [null];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const l = comps.length;
      comps.push({ cx: (xs[x] + xs[x + 1]) / 2, cy: (ys[y] + ys[y + 1]) / 2, area: (xs[x + 1] - xs[x]) * (ys[y + 1] - ys[y]), merged: false, bg: false });
      for (let py = ys[y]; py < ys[y + 1]; py++) labels.fill(l, py * W + xs[x], py * W + xs[x + 1]);
    }
  core.W = W; core.H = H; core.labels = labels; core.comps = comps;
  core.secState = new Uint8Array(comps.length).fill(1);
  core.assignData = null;
  return core.countedList();
}
const COLORS = createApp().__eval('COLORS');
const byCode = (core, code) => core.coll.find((m) => m.code === code);
// each role's share of the area, in whole percent
function shares(core, p) {
  const role = {}, a = core.assignData, r = { m: 0, s: 0, a: 0, x: 0 };
  let tot = 0;
  ['m', 's', 'a'].forEach((k) => p.roles[k] && p.roles[k].markers.forEach((m) => { role[m.mkey] = k; }));
  a.order.forEach((l) => { const k = role[a.assign[l].mkey] || 'x', ar = core.comps[l].area; r[k] += ar; tot += ar; });
  for (const k in r) r[k] = Math.round((100 * r[k]) / tot);
  return r;
}

test('colour families go by how a marker looks: blues, reds, browns and greys by their colour, not their code', () => {
  const { core } = appWith(['Honolulu 320 (complete set)']);
  const fam = (c) => core.balFamOf(byCode(core, c));
  assert.equal(fam('B112'), 'blue');
  // (a saturated blue is a blue, not a violet: Copic's B29 and V09 by how they look)
  const { core: cc } = appWith(['Ciao 12']);
  assert.equal(cc.balFamOf(byCode(cc, 'B29')), 'blue');
  assert.equal(cc.balFamOf(byCode(cc, 'V09')), 'violet');
  assert.equal(cc.balFamOf(byCode(cc, 'Y06')), 'yellow', 'a lemon yellow is a yellow');
  assert.equal(fam('R16'), 'red');
  // (most of the Green family's markers are greens, the yellowish ones yellow-greens)
  const gr = core.coll.filter((m) => m.fam === 'Green'), gn = gr.filter((m) => core.balFamOf(m) === 'green').length;
  assert.ok(gn >= gr.length * 0.5 && gr.every((m) => ['green', 'ygreen', 'teal', 'grey', 'brown'].includes(core.balFamOf(m))), gn + ' of ' + gr.length);
  assert.equal(fam('CG17'), 'grey');
  assert.equal(fam('120'), 'grey', 'black');
  const browns = core.coll.filter((m) => m.fam && /Earth/.test(m.fam) && core.balFamOf(m) === 'brown');
  assert.ok(browns.length >= 20, 'most browns are browns: ' + browns.length);
  // every marker has a family, one of the eleven
  const all = new Set(core.coll.map((m) => core.balFamOf(m)));
  for (const f of all) assert.ok(['pink', 'red', 'orange', 'yellow', 'ygreen', 'green', 'teal', 'blue', 'violet', 'brown', 'grey'].includes(f), f);
  assert.ok(all.size >= 10);
});

test('Auto: a main colour with 3+ markers, an accent across the wheel from it (bright), a second next to it; the marker count shared about half, a third and 2 accents', () => {
  const { core, sv } = appWith(['Honolulu 120']);
  const hues = { pink: 350, red: 18, orange: 53, yellow: 89, ygreen: 121, green: 150, teal: 192, blue: 250, violet: 305, brown: 50 };
  const d = (a, b) => { const x = Math.abs(hues[a] - hues[b]) % 360; return Math.min(x, 360 - x); };
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    sv.balSeed = (i + 0.5) / 40;
    const p = core.balPlan();
    assert.ok(p.ok);
    const { m, s, a } = p.roles;
    assert.ok(m && s && a, 'three roles');
    // (9, 5 and 2 of the 16, or all a family has when it has fewer)
    assert.equal(m.markers.length, Math.min(9, m.list.length)); assert.equal(s.markers.length, Math.min(5, s.list.length)); assert.equal(a.markers.length, Math.min(2, a.list.length));
    assert.ok(d(m.k, a.k) >= 100, `accent ${a.k} across the wheel from ${m.k}`);
    assert.ok(new Set([m.k, s.k, a.k]).size === 3);
    assert.ok(a.k !== 'grey' && a.k !== 'brown' && m.k !== 'grey' && s.k !== 'grey', 'Auto picks no greys, and no brown accent');
    // no marker in two roles
    const keys = [...m.markers, ...s.markers, ...a.markers].map((x) => x.mkey);
    assert.equal(new Set(keys).size, keys.length);
    seen.add(m.k);
  }
  assert.ok(seen.size >= 5, 'Other pairings reaches many main colours: ' + [...seen].join(' '));
  // Temperature steers Auto's main colour
  sv.palette = 'cool';
  for (let i = 0; i < 20; i++) {
    sv.balSeed = (i + 0.5) / 20;
    assert.ok(['ygreen', 'green', 'teal', 'blue', 'violet'].includes(core.balPlan().roles.m.k));
  }
  // ... but not once a colour is chosen by hand
  sv.balA = 'orange';
  const warm = new Set();
  for (let i = 0; i < 20; i++) { sv.balSeed = (i + 0.5) / 20; warm.add(core.balPlan().roles.m.k); }
  assert.ok([...warm].some((k) => !['ygreen', 'green', 'teal', 'blue', 'violet'].includes(k)));
});

test('by hand: each role takes the family chosen; a family chosen twice goes back to Auto for the later role; greys can be the main colour, not the accent', () => {
  const { core, sv } = appWith(['Honolulu 120', '36 Gray Tones']);
  Object.assign(sv, { balM: 'blue', balS: 'teal', balA: 'orange' });
  let p = core.balPlan();
  assert.deepEqual([p.roles.m.k, p.roles.s.k, p.roles.a.k], ['blue', 'teal', 'orange']);
  assert.ok(p.roles.m.markers.every((m) => core.balFamOf(m) === 'blue'));
  Object.assign(sv, { balM: 'blue', balS: 'auto', balA: 'blue' });
  p = core.balPlan();
  assert.equal(p.roles.m.k, 'blue'); assert.notEqual(p.roles.a.k, 'blue');
  Object.assign(sv, { balM: 'grey', balS: 'auto', balA: 'grey' });
  p = core.balPlan();
  assert.equal(p.roles.m.k, 'grey'); assert.notEqual(p.roles.a && p.roles.a.k, 'grey');
});

test('a thin family borrows the nearest in hue from next to it; with none to borrow, fewer roles; with no main colour at all, not ok', () => {
  const { core, sv } = appWith(['Ciao 12']);
  const fams = {};
  core.coll.forEach((m) => { const f = core.balFamOf(m); fams[f] = (fams[f] || 0) + 1; });
  const thin = Object.keys(fams).find((f) => f !== 'grey' && fams[f] < 3);
  assert.ok(thin, 'Ciao 12 has a family of fewer than 3');
  sv.balM = thin;
  const p = core.balPlan();
  assert.ok(p.ok);
  assert.ok(p.roles.m.markers.length >= 3, 'three markers for the main colour');
  assert.ok(Object.keys(p.roles.m.borrowed).length > 0, 'borrowed from next to it');
  // two markers in all: no main colour to be had
  const { core: c2, E: E2 } = (() => { const x = appWith([]); return x; })();
  c2.coll = c2.coll.filter((m) => m.code === 'R16' || m.code === 'B112');
  assert.equal(c2.balPlan().ok, false);
  void E2;
});

test('laying it out: about 60/30/10 of the area, accents on middling sections spread out, pinned sections kept and counted', () => {
  const { core, sv } = appWith(['Honolulu 120']);
  const cl = grid(core, 15, 14);
  const p = core.balPlan();
  core.buildBalance(cl, p);
  const r = shares(core, p);
  assert.ok(Math.abs(r.m - 60) <= 3 && Math.abs(r.s - 30) <= 3 && Math.abs(r.a - 10) <= 3, JSON.stringify(r));
  assert.equal(r.x, 0);
  // accents: never on the biggest tenth of sections, and not bunched (mean nearest-neighbour distance well above a section)
  const accKeys = new Set(p.roles.a.markers.map((m) => m.mkey)), a = core.assignData;
  const acc = a.order.filter((l) => accKeys.has(a.assign[l].mkey));
  const areas = a.order.map((l) => core.comps[l].area).sort((x, y) => x - y), top = areas[Math.floor(areas.length * 0.9)];
  assert.ok(acc.every((l) => core.comps[l].area <= top));
  const nn = acc.map((l) => Math.min(...acc.filter((q) => q !== l).map((q) => Math.hypot(core.comps[l].cx - core.comps[q].cx, core.comps[l].cy - core.comps[q].cy))));
  assert.ok(nn.reduce((t, x) => t + x, 0) / nn.length > 45, 'spread out');
  // neighbours never the same marker
  const adj = core.colour.adj();
  for (const l of a.order) for (const q of adj[l] || []) assert.notEqual(a.assign[l].mkey, a.assign[q].mkey);
  // a pinned section keeps its marker, and its area counts towards its role
  const accM = p.roles.a.markers[0], big = a.order.slice().sort((x, y) => core.comps[y].area - core.comps[x].area).slice(0, 8);
  big.forEach((l) => { core.locks[l] = accM.mkey; });
  core.buildBalance(cl, core.balPlan());
  big.forEach((l) => assert.equal(core.assignData.assign[l].mkey, accM.mkey));
  const r2 = shares(core, core.balPlan());
  assert.ok(r2.a <= 14, 'the pinned accents use up the accent’s share: ' + JSON.stringify(r2));
  big.forEach((l) => { delete core.locks[l]; });
  // a zone of fewer than 10 sections has no accent of its own
  const small = cl.slice(0, 8);
  core.buildBalance(small, core.balPlan());
  const r3 = shares(core, core.balPlan());
  assert.equal(r3.a, 0);
  void sv;
});

test('saved palettes: every one of the palette’s markers is used, each in the role nearest it in colour', () => {
  const { core, sv, E } = appWith(['Honolulu 120']);
  const keys = ['B112', 'B111', 'B114', 'BG11', 'R16', 'Y26', 'G410', 'B05', 'B09'].map((c) => byCode(core, c)).filter(Boolean).map((m) => m.mkey);
  E(`state.saved.push({ type: 'palette', id: 777, name: 'Mine', keys: ${JSON.stringify(keys)} })`);
  E(`SF.configure({ listPalettes: () => state.saved.filter((x) => x.type === 'palette'), markerInfo: () => null })`);
  Object.assign(sv, { paletteSource: 'saved', savedPalId: 777, limitN: 16 });
  const p = core.balPlan();
  assert.ok(p.seeded, 'from the saved palette');
  const used = new Set(p.markers.map((m) => m.mkey));
  keys.forEach((k) => assert.ok(used.has(k), k + ' used'));
  assert.equal(p.roles.m.k, 'blue', 'the palette’s biggest colour');
});

test('Mixed’s No repeats: one marker per section while there are enough; with fewer, each used once before any twice', () => {
  const { core } = appWith(['Honolulu 120']);
  const cl = grid(core, 10, 8);
  const pool = core.noRepPool(cl);
  assert.equal(pool.length, 80);
  core.buildNoRep(cl, pool);
  const a = core.assignData;
  assert.equal(new Set(a.order.map((l) => a.assign[l].mkey)).size, 80, 'all different');
  // 30 markers for 80 sections: each 2 or 3 times
  core.buildNoRep(cl, pool.slice(0, 30));
  const n = {};
  core.assignData.order.forEach((l) => { const k = core.assignData.assign[l].mkey; n[k] = (n[k] || 0) + 1; });
  const counts = Object.values(n);
  assert.equal(counts.length, 30);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, 'evenly: ' + counts.join(','));
  // neighbours still differ
  const adj = core.colour.adj();
  for (const l of core.assignData.order) for (const q of adj[l] || []) assert.notEqual(core.assignData.assign[l].mkey, core.assignData.assign[q].mkey);
});

test('a guide saved before Balance: Random opens as Mixed (as it looked), any other pattern opens on Main colour', () => {
  const core = createApp().__mstest, f = [...core.styleFields].find((x) => x.key === 'balance');
  assert.equal(f.check(undefined, f.def, { family: 'random' }), 'mixed');
  assert.equal(f.check(undefined, f.def, { family: 'gradient' }), 'main');
  assert.equal(f.check(undefined, f.def, {}), 'main');
  assert.equal(f.check('mixed', f.def, { family: 'gradient' }), 'mixed');
  assert.equal(f.check('loud', f.def, { family: 'random' }), 'mixed');
  const m = [...core.styleFields].find((x) => x.key === 'balM');
  assert.equal(m.check('blue', m.def), 'blue');
  assert.equal(m.check('purple', m.def), 'auto');
  void COLORS;
});

test('touching sections never share a marker while another would do: No repeats with few markers, and Main colour at its fewest', () => {
  const { core, sv } = appWith(['Honolulu 120']);
  const cl = grid(core, 20, 20);
  const adj = core.colour.adj();
  const clashes = () => { const a = core.assignData; let n = 0; for (const l of a.order) for (const q of adj[l] || []) if (a.assign[l].mkey === a.assign[q].mkey) n++; return n; };
  sv.noAdj = true;
  for (let i = 0; i < 5; i++) { core.buildNoRep(cl, core.noRepPool(cl).slice(0, 13)); assert.equal(clashes(), 0, 'No repeats, 13 markers'); }
  sv.limitN = 6;
  for (let i = 0; i < 5; i++) { core.buildBalance(cl, core.balPlan()); assert.equal(clashes(), 0, 'Main colour, 6 markers'); }
  sv.noAdj = false; sv.limitN = 16;
});

test('speed: 3,600 sections and the whole catalogue (721 markers) lay out in well under a few seconds, Main colour and No repeats alike', () => {
  const { core, sv, E } = appWith([]);
  E('state.owned = new Set()');
  core.coll = E('sfCollection()');
  const cl = grid(core, 60, 60);
  let t = cpuMs();
  core.buildBalance(cl, core.balPlan());
  assert.ok(cpuMs() - t < 1500, 'Main colour ' + Math.round(cpuMs() - t) + 'ms');
  sv.noAdj = true;
  t = cpuMs();
  core.buildNoRep(cl, core.noRepPool(cl));
  assert.ok(cpuMs() - t < 3000, 'No repeats ' + Math.round(cpuMs() - t) + 'ms');
  sv.noAdj = false;
});
