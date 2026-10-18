// v318.14: Photograph your caps reads Ohuhu codes that lost their first letter again too (G24 for BG24, CG24 or GG24),
// as v318.12 did for Copic's. Whose codes: the brand chosen, else the only brand you own, else both; a code waits for
// its read again exactly when the engine is given it to read again. Fails on v318.13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const own = (E, keys) => E(`state.owned = new Set(${JSON.stringify(keys)})`);

test('each brand’s pairs: Ohuhu’s G24 with BG24, CG24, GG24; Copic’s G03 with YG03; never across brands', () => {
  const E = createApp().__eval;
  const o = E("ocrWidenSets('Ohuhu')"),
    c = E("ocrWidenSets('Copic')"),
    both = E('ocrWidenSets(null)');
  for (const k of ['G24', 'R25', 'V08', 'Y00']) assert.ok(o.short.includes(k), k);
  for (const k of ['BG24', 'CG24', 'GG24']) assert.ok(o.long.includes(k), k);
  assert.ok(c.short.includes('G03') && c.long.includes('YG03'));
  assert.ok(!o.long.includes('YG03'), 'not a Copic code in Ohuhu’s');
  // each long code is a code of that brand, with a letter more than one of its short ones
  const codes = (b) => new Set(E(`COLORS.filter((m) => m.brand === '${b}').map((m) => scanKey(m.code))`));
  for (const [set, b] of [
    [o, 'Ohuhu'],
    [c, 'Copic'],
  ]) {
    const cc = codes(b);
    assert.ok(
      set.long.every((w) => cc.has(w) && /^[A-Z]/.test(w) && set.short.includes(w.slice(1))),
      b,
    );
    assert.ok(
      set.short.every((k) => cc.has(k)),
      b,
    );
  }
  // both: the two brands' put together
  assert.deepEqual([...both.short], [...new Set([...o.short, ...c.short])].sort());
  assert.deepEqual([...both.long], [...new Set([...o.long, ...c.long])].sort());
});

test('whose codes are read again: the brand chosen, else the only brand you own, else both; the wait follows', () => {
  const E = createApp().__eval;
  const idx = (b, c) => E(`COLORS.findIndex((m) => m.brand === '${b}' && m.code === '${c}')`);
  E("scanBrand = ''");
  own(E, ['Ohuhu|R1', 'Ohuhu|G24']);
  assert.equal(E('ocrWidenBrand()'), 'Ohuhu');
  assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
  assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'BG24')})`), false);
  // a Copic-only short code isn't read again for an Ohuhu-only collection, so it doesn't wait
  assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), false);
  own(E, ['Copic|G03']);
  assert.equal(E('ocrWidenBrand()'), 'Copic');
  assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), true);
  own(E, ['Copic|G03', 'Ohuhu|G24']);
  assert.equal(E('ocrWidenBrand()'), null);
  assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
  own(E, []);
  assert.equal(E('ocrWidenBrand()'), null);
  // the brand chosen wins
  E("scanBrand = 'Ohuhu'");
  own(E, ['Copic|G03']);
  assert.equal(E('ocrWidenBrand()'), 'Ohuhu');
  assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
  assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), false);
});
