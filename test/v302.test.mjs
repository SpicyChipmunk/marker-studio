// v302: old codes stored with the Roman numeral Ⅱ ("CGⅡ00") are shown and searched with plain letters, and saved work
// using them still opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

test('an old code with Ⅱ is shown as II, found by "CGII00" (and by "CGⅡ00"), and a saved key using it is still known', () => {
  const a = createApp({ localStorage: memoryStorage() }), E = a.__eval;
  const i = E(`COLORS.findIndex((c) => c.old === 'CGⅡ00')`);
  assert.ok(i >= 0, 'the data keeps the code as printed');
  assert.equal(E(`oldCode(COLORS[${i}])`), 'CGII00');
  for (const q of ['cgii00', 'cgⅱ00']) {
    E(`searchStr = ${JSON.stringify(q)}`);
    assert.equal(E(`matchesSearch(${i})`), true, q);
  }
  E(`searchStr = ''`);
  assert.equal(E(`knownMkey('Ohuhu|CGⅡ00')`), E(`mkey(${i})`), 'saved work from before the rename');
});
