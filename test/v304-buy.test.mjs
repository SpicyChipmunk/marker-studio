// v304, Brands I'd buy: which brands a marker to buy is suggested from, kept with the collection. Automatic (none
// ticked): your brands first, another brand only when it's clearly closer, as before. With brands ticked: only
// those, in Match; your markers still count whatever their brand. Saved, read back (brands the data doesn't have
// dropped, none ticked is automatic), in backups and restored with them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';
const app = (extra = {}) => {
  const ls = memoryStorage();
  ls.setItem(KEY, JSON.stringify({ mode: 'collection', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: ['Ohuhu|BG311', 'Ohuhu|B08', 'Ohuhu|R014'], saved: [], ...extra }));
  return createApp({ localStorage: ls });
};
const near = (E, hex) => JSON.parse(E(`(function () { const r = matchNearest(hexToLab(${JSON.stringify(hex)})); const b = (o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code; return JSON.stringify({ owned: r.owned.map(b), buy: r.buy.map(b), other: r.other.map(b) }); })()`));

test('automatic: your brands first, another brand only when clearly closer (as v304 first had it)', () => {
  const E = app().__eval;
  assert.equal(E('JSON.stringify(state.buyBrands)'), 'null');
  const r = near(E, '#40e0d0');
  assert.ok(r.owned.every((x) => x.startsWith('Ohuhu ')));
  assert.ok(r.buy.every((x) => x.startsWith('Ohuhu ')), r.buy.join());
  assert.ok(r.other.length <= 1);
});

test('only the brands ticked: Match suggests from them, and your own markers still count', () => {
  const E = app({ buyBrands: ['Copic'] }).__eval;
  assert.equal(E('JSON.stringify(state.buyBrands)'), '["Copic"]');
  const r = near(E, '#40e0d0');
  assert.ok(r.owned[0].startsWith('Ohuhu '), 'your Ohuhu marker is still your best');
  assert.ok(r.buy.length && r.buy.every((x) => x.startsWith('Copic ')), r.buy.join());
  assert.deepEqual(r.other, []);
  const E2 = app({ buyBrands: ['Ohuhu'] }).__eval;
  const r2 = near(E2, '#40e0d0');
  assert.ok(r2.buy.every((x) => x.startsWith('Ohuhu ')));
  assert.deepEqual(r2.other, [], 'no other-brand row once brands are ticked');
});

test('saved and read back: brands the data doesn’t have are dropped, none ticked is automatic', () => {
  assert.equal(app({ buyBrands: ['Copic', 'Nope'] }).__eval('JSON.stringify(state.buyBrands)'), '["Copic"]');
  assert.equal(app({ buyBrands: [] }).__eval('JSON.stringify(state.buyBrands)'), 'null');
  assert.equal(app({ buyBrands: 'Copic' }).__eval('JSON.stringify(state.buyBrands)'), 'null');
  const a = app(), E = a.__eval;
  E(`state.buyBrands = ['Ohuhu']; save()`);
  assert.deepEqual(JSON.parse(E(`localStorage.getItem(${JSON.stringify(KEY)})`)).buyBrands, ['Ohuhu']);
});

test('a backup carries it, and a restore of the collection brings it back (a file without it leaves it)', () => {
  const E = app({ buyBrands: ['Copic'] }).__eval;
  const own = JSON.parse(E('JSON.stringify([...state.owned])'));
  assert.equal(E('typeof applyCollectionBackup'), 'function');
  E(`applyCollectionBackup({ owned: ${JSON.stringify(own)}, wish: [], ink: {}, saved: [], buyBrands: ['Ohuhu'] }, Date.now(), true)`);
  assert.equal(E('JSON.stringify(state.buyBrands)'), '["Ohuhu"]');
  E(`applyCollectionBackup({ owned: ${JSON.stringify(own)}, wish: [], ink: {}, saved: [] }, Date.now(), true)`);
  assert.equal(E('JSON.stringify(state.buyBrands)'), '["Ohuhu"]', 'a file without it leaves it');
});
