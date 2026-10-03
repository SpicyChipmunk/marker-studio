// v304, Match a colour (colour.js matchNearest): the markers to buy are of your brands (those of the markers you own
// that lay down colour, dry ones too; an empty collection counts as both), and another brand's marker is offered,
// at most one, only when it is clearly closer (2 ΔE00) than both your best and anything of your brands. Find similar
// leaves out the marker it came from (opt.exclude), and only that one. The screen side is in e2e/v304-match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
function appWith(setup) {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
  if (setup) a.__eval(setup);
  return a;
}
const preset = (n) => `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`;
const own = (keys) => `${JSON.stringify(keys)}.forEach((k) => state.owned.add(k))`;
const near = (a, hex, opt) => JSON.parse(a.__eval(`(() => { const r = matchNearest(hexToLab(${JSON.stringify(hex)}), ${JSON.stringify(opt || null)}); const f = (o) => ({ k: COLORS[o.i].brand + '|' + COLORS[o.i].code, d: +o.d.toFixed(2), i: o.i }); return JSON.stringify({ owned: r.owned.map(f), buy: r.buy.map(f), other: (r.other || []).map(f) }); })()`));
const grid = (n) => {
  const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2), out = [];
  for (let r = 0; r < n; r++) for (let g = 0; g < n; g++) for (let b = 0; b < n; b++) out.push('#' + h((r * 255) / (n - 1)) + h((g * 255) / (n - 1)) + h((b * 255) / (n - 1)));
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
  for (const setup of [preset('Honolulu 120'), preset('Ciao 36 - Set A'), preset('Honolulu 48') + `; COLORS.forEach((c, i) => { if (isOwned(i) && i % 3 === 0) state.ink[mkey(i)] = 'dry'; })`]) {
    const a = appWith(setup), E = a.__eval;
    const LAB = E('LAB'), de = a.de2000, noink = new Set(E('[...NOINK]')), brand = E('COLORS.map((c) => c.brand)');
    const usable = E('COLORS.map((c, i) => isOwned(i) && !isDry(i))'), mine = new Set(E('[...state.owned].map((k) => k.split("|")[0])'));
    let others = 0;
    for (const hex of grid(7)) {
      const t = a.hexToLab(hex), r = near(a, hex);
      const all = [];
      for (let i = 0; i < LAB.length; i++) if (!noink.has(i)) all.push({ i, d: de(t, LAB[i]) });
      all.sort((x, y) => x.d - y.d || x.i - y.i);
      const best = r.owned.length ? r.owned[0].d : Infinity, yours = all.find((o) => mine.has(brand[o.i])).d;
      const want = all.filter((o) => mine.has(brand[o.i]) && !usable[o.i]).slice(0, 3).filter((o) => o.d <= all.find((x) => usable[x.i]).d - 2).map((o) => o.i);
      assert.deepEqual(r.buy.map((o) => o.i), want, hex + ': up to 3 of your brands, clearly closer');
      const oth = all.find((o) => !mine.has(brand[o.i]));
      assert.deepEqual(r.other.map((o) => o.i), oth && oth.d <= Math.min(best, yours) - 2 ? [oth.i] : [], hex + ': the other brand');
      others += r.other.length;
    }
    assert.ok(others > 0, 'the other brand is offered somewhere');
  }
});

test('a dry marker still makes its brand yours; both brands, or none, or only a Colorless Blender: no other-brand row', () => {
  const dry = appWith(preset('Honolulu 120') + `; COLORS.forEach((c, i) => { if (isOwned(i)) state.ink[mkey(i)] = 'dry'; })`);
  const r = near(dry, '#3a7bd5');
  assert.equal(r.owned.length, 0);
  assert.ok(r.buy.length === 3 && r.buy.every((o) => o.k.startsWith('Ohuhu|')), JSON.stringify(r.buy));
  assert.deepEqual(r.other.map((o) => o.k), ['Copic|B06'], 'Copic only as the one clearly closer');
  for (const setup of [preset('Honolulu 120') + ';' + preset('Ciao 36 - Set A'), '', `state.owned.add('Copic|0')`]) {
    const a = appWith(setup);
    for (const hex of grid(5)) assert.deepEqual(near(a, hex).other, [], setup + ' ' + hex);
  }
  // none: the three nearest of both brands, as before
  const e = near(appWith(''), '#3a7bd5');
  assert.equal(e.buy.length, 3);
  assert.equal(e.buy[0].k, 'Copic|B06', 'the nearest of the whole range');
  assert.deepEqual(near(appWith(''), '#005ab4').buy.map((o) => o.k), ['Copic|B37', 'Ohuhu|B115', 'Ohuhu|BV312']);
});

test('the Markers screen’s brand filter doesn’t change a match', () => {
  const a = appWith(own(OWN));
  const before = near(a, '#3a7bd5');
  a.__eval(`state.brands = new Set(['Copic'])`);
  assert.deepEqual(near(a, '#3a7bd5'), before);
});

test('Find similar: the marker itself left out, and only it (Ohuhu RV33 and RV34 are the same colour)', () => {
  const a = appWith(preset('Honolulu 320 (complete set)')), E = a.__eval;
  const i = E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'RV33')`), j = E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'RV34')`);
  const hex = E(`COLORS[${i}].hex`);
  assert.equal(hex, E(`COLORS[${j}].hex`));
  const plain = near(a, hex), sim = near(a, hex, { exclude: i });
  assert.ok(plain.owned.some((o) => o.i === i), 'a typed hex still finds the marker');
  assert.ok(!sim.owned.some((o) => o.i === i) && !sim.buy.some((o) => o.i === i) && !sim.other.some((o) => o.i === i));
  assert.equal(sim.owned[0].i, j, 'its same-colour twin first');
  assert.equal(sim.owned[0].d, 0);
  // a marker you don't own: not offered to buy as like itself
  const b = appWith(own(OWN)), k = b.__eval(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'B115')`);
  const bh = b.__eval(`COLORS[${k}].hex`);
  assert.ok(near(b, bh).buy.some((o) => o.i === k));
  assert.ok(!near(b, bh, { exclude: k }).buy.some((o) => o.i === k));
});
