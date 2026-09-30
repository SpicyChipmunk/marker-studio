// Marker sets offered in the welcome dialog and on Markers. Checked against Ohuhu's
// official colour charts (ohuhu.com/pages/color-codes-index) in Sept 2026. Also: the set picker's state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, createApp, memoryStorage } from './harness.mjs';

const SETS = app.__eval('OHUHU_SETS');
const set = (k) => new Set(SETS[k].split(' '));
const codes = new Set(app.__eval('COLORS').filter((c) => c.brand === 'Ohuhu').map((c) => c.code));

test('every set has as many colours as its name says (blenders are extra)', () => {
  const size = { 24: 24, 48: 48, 72: 72, 104: 104, 120: 120, 168: 168, 216: 216, 320: 320, '48mid': 48, '36skin': 36, '36gray': 36, '48pastelS': 48, '48pastelB': 48, '24portrait': 24 };
  for (const [k, n] of Object.entries(size)) {
    const list = SETS[k].split(' ');
    assert.equal(new Set(list).size, list.length, `${k} has a duplicate`);
    assert.equal(list.length, n, `${k}`);
  }
});

test('every code in every set is a marker the app knows', () => {
  for (const k of Object.keys(SETS)) for (const c of set(k)) assert.ok(codes.has(c), `${k}: ${c}`);
});

test('sets build on each other the way Ohuhu sells them', () => {
  const union = (...ks) => new Set(ks.flatMap((k) => [...set(k)]));
  const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  const within = (a, b) => [...set(a)].filter((x) => !set(b).has(x));
  assert.deepEqual(within('72', '120'), [], '72 ⊂ 120');
  assert.ok(same(union('120', '48pastelS'), set('168')), '168 = 120 + 48 Sweetness pastels');
  assert.ok(same(union('168', '48mid'), set('216')), '216 = 168 + 48 Mid-tones');
  assert.ok(same(union('216', '104'), set('320')), '320 = 216 + 104');
  assert.deepEqual(within('24portrait', '36skin'), [], '24 skin tones ⊂ 36 skin tones');
});

// Copic sets are listed with the codes printed on copic.jp's set pages (Sept 2026).
test('every Copic set resolves to exactly the number of markers in its name', () => {
  const sets = app.__eval('MARKER_SETS').filter((s) => s.b === 'Copic' && s.c);
  assert.ok(sets.length >= 16);
  for (const s of sets) {
    const n = +s.n.match(/(\d+)/)[1], got = app.__eval(`presetMkeys(MARKER_SETS.find(function(x){return x.n===${JSON.stringify(s.n)};}))`).length;
    assert.equal(s.c.split(' ').length, n, `${s.n} lists ${n}`);
    assert.equal(got, n, `${s.n} finds all ${n} markers`);
  }
});

// ---- From the design pass ----
const KEY = 'ohuhu-hb320-picker-v3';
const base = (extra = {}) => JSON.stringify({ mode: 'home', tones: ['pale', 'light', 'mid', 'dark'], sats: ['neutral', 'muted', 'medium', 'vivid'], brands: ['Ohuhu', 'Copic'], satsUpgraded: true, scopeFlipped: true, ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, owned: [], saved: [], ...extra });

test('set picker marks sets you already fully own', () => {
  const probe = createApp({ localStorage: memoryStorage() });
  const set24 = probe.__eval("presetMkeys(MARKER_SETS[0])");
  const a = createApp({ localStorage: memoryStorage({ [KEY]: base({ owned: [...set24] }) }) });
  const html = a.presetListHTML();
  assert.match(html, /presetrow have"><input type="checkbox" data-i="0">/);
  assert.doesNotMatch(html, /presetrow have"><input type="checkbox" data-i="1">/, 'partially owned set is not marked');
});
