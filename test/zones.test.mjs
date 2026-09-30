// Zones (v279–v281, js/guide/34-zones.js): how a step that changed the zones is named for Undo, and how a saved guide's
// zones are read (each setting checked as a guide's own are; zones with no sections, or past the limit, dropped).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const Z = (list, cur = 0) => ({ cur, main: null, next: 9, list: list.map(([id, name, secs]) => ({ id, name, secs, st: null, an: null })) });

test('Undo names a zone step: made, deleted, renamed, sections added or taken out', () => {
  const t = createApp().__mstest, L = t.zoneStepLabel;
  assert.equal(L(null, Z([[1, 'Bell', [3, 4]]])), 'New zone: Bell (2 sections)');
  assert.equal(L(Z([[1, 'Bell', [3]]]), null), 'Zone deleted: Bell');
  assert.equal(L(Z([[1, 'Zone 1', [3]]]), Z([[1, 'Bell', [3]]])), 'Zone renamed: Bell');
  assert.equal(L(Z([[1, 'Bell', [3]]]), Z([[1, 'Bell', [3, 7, 8]]])), 'Bell: 2 sections added');
  assert.equal(L(Z([[1, 'Bell', [3, 7]]]), Z([[1, 'Bell', [3]]])), 'Bell: 1 section taken out');
  assert.equal(L(Z([[1, 'Bell', [3, 7]]]), Z([[1, 'Bell', [3, 9]]])), 'Bell: sections changed');
  assert.equal(L(Z([[1, 'Bell', [3]]]), Z([[1, 'Bell', [3]]], 1)), '', 'switching zones is no step of its own');
  assert.equal(L(null, null), '');
});

test('a saved zone\'s settings are checked as a guide\'s are: odd values open as the default, good ones as saved', () => {
  const t = createApp().__mstest, keys = t.ZONE_KEYS;
  assert.deepEqual([...keys].sort(), ['balA', 'balM', 'balS', 'balSeed', 'balance', 'blendFall', 'blendMix', 'dir', 'emphasis', 'expand', 'expandChar', 'family', 'genHarmony', 'genPal', 'gradSeed', 'gradShape', 'limitN', 'look', 'noAdj', 'noRep', 'palette', 'paletteSource', 'radC', 'savedPalId'].sort(), 'the zone\'s own settings: pattern and colours (and Radial\'s centre), not shading, texture or the photo');
  const good = t.zoneStOpen({ family: 'random', gradShape: 'radial', dir: -1, limitN: 9, palette: 'warm', look: 'ltd', blendMix: 'paint', radC: { x: 0.25, y: 0.8 } });
  assert.deepEqual([good.family, good.gradShape, good.dir, good.limitN, good.palette, good.look, good.blendMix, good.radC], ['random', 'radial', -1, 9, 'warm', 'ltd', 'paint', { x: 0.25, y: 0.8 }]);
  const odd = t.zoneStOpen({ family: 'rainbow', gradShape: 5, dir: 0, limitN: 'x', palette: null, gradSeed: 7, radC: { x: 'a', y: 2 } });
  assert.deepEqual([odd.family, odd.gradShape, odd.dir, odd.limitN, odd.palette, odd.gradSeed, odd.radC], ['gradient', 'serpentine', 1, 16, 'all', 1, null]);
  // (a centre past the picture's edge is brought back onto it)
  assert.deepEqual(t.zoneStOpen({ radC: { x: 1.5, y: -0.2 } }).radC, { x: 1, y: 0 });
  // (reading them leaves the settings in use as they were)
  assert.equal(t.styleVars.family, 'gradient');
});

test('a saved guide\'s zones: sections through the map, none twice, empty zones and ones past eight dropped, names kept short', () => {
  const t = createApp().__mstest;
  t.W = 10; t.H = 10;
  const map = { 1: 11, 2: 12, 3: 13, 4: 14 };
  const many = Array.from({ length: 10 }, (_, i) => ({ name: 'Z' + i, secs: [1 + (i % 4)] }));
  t.zoneOpen([
    { name: '  Bell  ', secs: [1, 2, 99], style: { family: 'random' }, anchors: [{ x: 5, y: 50, mkey: 'Ohuhu|R16' }, { x: 'a' }] },
    { name: 'Again', secs: [2] },
    { name: 'x'.repeat(40), secs: [3] },
    { secs: [] },
    'nonsense',
    ...many,
  ], map);
  const z = t.zones;
  assert.deepEqual(Array.from(z, (x) => x.name), ['Bell', 'x'.repeat(24), 'Z3'], 'Bell; "Again" (its one section is Bell\'s), the empty ones and the odd one dropped');
  assert.deepEqual(Object.keys(z[0].secs).map(Number), [11, 12]);
  assert.equal(z[0].st.family, 'random');
  assert.deepEqual(JSON.parse(JSON.stringify(z[0].an)), [{ x: 5, y: 10, mkey: 'Ohuhu|R16' }], 'anchors checked and kept on the picture');
});

test('no more than eight zones are opened', () => {
  const t = createApp().__mstest;
  t.W = 10; t.H = 10;
  const map = {};
  for (let i = 1; i <= 20; i++) map[i] = i;
  t.zoneOpen(Array.from({ length: 12 }, (_, i) => ({ name: 'Z' + i, secs: [i + 1] })), map);
  assert.equal(t.zones.length, 8);
});

test('a file made by hand: only whole section numbers the map has count ("__proto__" and the like make no zone)', () => {
  const t = createApp().__mstest;
  t.W = 10; t.H = 10;
  const map = { 1: 11, 2: 12 };
  t.zoneOpen([
    { name: 'Ghost', secs: ['__proto__', 'constructor', 'toString', '1', 1.5, null, {}] },
    { name: 'Real', secs: [2, 2, -1] },
  ], map);
  assert.deepEqual(Array.from(t.zones, (x) => x.name), ['Real']);
  assert.deepEqual(Object.keys(t.zones[0].secs), ['12']);
});

test('the Undo label names the zone being edited first: a section it takes from another zone is "added" to it', () => {
  const t = createApp().__mstest, L = t.zoneStepLabel;
  assert.equal(L(Z([[1, 'Bell', [3, 4]], [2, 'Foot', [5]]], 2), Z([[1, 'Bell', [3]], [2, 'Foot', [5, 4]]], 2)), 'Foot: 1 section added');
});

// ---- shading per zone (v281) ----
test('a zone’s shading from a saved guide: each setting checked as the guide’s own are; one it doesn’t have (a zone from before v281) is Main’s', () => {
  const t = createApp().__mstest, sv = t.styleVars;
  sv.shadeRound = 0.2; sv.shadeHi = 0.7; sv.shadeLo = 0.4; sv.shadeShadow = 'grey'; sv.shadeHilite = 'warm';
  assert.deepEqual(plain(t.zshOpen(undefined)), { on: true, round: 0.2, hi: 0.7, lo: 0.4, shadow: 'grey', hilite: 'warm' });
  assert.deepEqual(plain(t.zshOpen({ on: false, round: 0.9, hi: 0.1, lo: 1, shadow: 'cool', hilite: 'paper' })), { on: false, round: 0.9, hi: 0.1, lo: 1, shadow: 'cool', hilite: 'paper' });
  // odd values: as the guide's own fields check them (out of range kept in range; one that can't be used is Main's)
  assert.deepEqual(plain(t.zshOpen({ on: 'yes', round: 7, hi: -1, lo: 'x', shadow: 'dark', hilite: 3 })), { on: true, round: 1, hi: 0, lo: 0.4, shadow: 'grey', hilite: 'warm' });
});

test('a marker’s tones with a zone’s shading: where they hand over is the zone’s amounts; the same markers with other amounts tell apart by object, not by which markers (sig)', () => {
  const app = createApp(), t = app.__mstest, COLORS = app.__eval('COLORS'), lab = app.__eval('hexToLab');
  const mk = (code) => { const c = COLORS.find((x) => x.brand === 'Ohuhu' && x.code === code); return { mkey: 'Ohuhu|' + code, code, brand: 'Ohuhu', hex: c.hex, name: c.name, lab: lab(c.hex) }; };
  const base = mk('B112');
  t.setCollection([base, mk('B114'), mk('B111')]);
  t.shadeMode = 'full';
  const z = (o) => Object.assign({ on: true, round: 0.5, hi: 0.5, lo: 0.5, shadow: 'same', hilite: 'same' }, o);
  const a = t.shadeTones(base, z({})), b = t.shadeTones(base, z({ lo: 0.9 })), c = t.shadeTones(base, z({ hilite: 'paper' }));
  assert.equal(t.shadeTones(base, z({})), a, 'one object per marker and shading');
  assert.notEqual(b, a);
  assert.equal(b.sig, a.sig, 'the same markers');
  assert.ok(b.T3 < a.T3, 'more shadow');
  assert.equal(a.T2.toFixed(2), '0.34');
  assert.equal(c.paper, true);
  assert.notEqual(c.sig, a.sig);
  assert.ok(c.T2 < a.T2, 'a paper highlight is the brightest part only');
});

test('Undo names a change to one zone’s shading by the zone', () => {
  const t = createApp().__mstest, L = t.zoneShadeLabel;
  const sh = (o) => Object.assign({ on: true, round: 0.5, hi: 0.5, lo: 0.5, shadow: 'same', hilite: 'same' }, o);
  const Zs = (s) => ({ cur: 1, main: null, next: 2, list: [{ id: 1, name: 'Bell', secs: [3], st: null, an: null, sh: s }] });
  assert.equal(L(Zs(sh({})), Zs(sh({ on: false }))), 'Bell: Shading: Flat');
  assert.equal(L(Zs(sh({ on: false })), Zs(sh({}))), 'Bell: Shading: Shaded');
  assert.equal(L(Zs(sh({})), Zs(sh({ round: 0.9 }))), 'Bell: Roundness changed');
  assert.equal(L(Zs(sh({})), Zs(sh({ hilite: 'paper' }))), 'Bell: Highlights: Paper white');
  assert.equal(L(Zs(sh({})), Zs(sh({ shadow: 'cool' }))), 'Bell: Shadows: Cooler');
  assert.equal(L(Zs(sh({})), Zs(sh({ hi: 0.1 }))), 'Bell: Highlight changed');
  assert.equal(L(Zs(sh({})), Zs(sh({}))), '');
});

test('a guide that opens with none of its zones left (none of their sections found) has Main shaded, as when the last zone is deleted', () => {
  const t = createApp().__mstest;
  t.W = 10; t.H = 10;
  t.styleVars.shadeMain = false;
  t.zoneOpen([{ name: 'Gone', secs: [99] }], { 1: 11 });
  assert.equal(t.zones.length, 0);
  assert.equal(t.styleVars.shadeMain, true);
});
