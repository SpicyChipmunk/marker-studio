// v308 after the merge (reviewer 1): where the colour and palette branches meet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function appWith(set) {
  const a = createApp({ localStorage: memoryStorage() }),
    E = a.__eval;
  E('state.owned = new Set(); state.pool = null');
  if (set === 'ben') E('state.owned = new Set(defaultOwned())');
  else
    E(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
    );
  return { a, E };
}
const codes = (E, s) => JSON.parse(E(`JSON.stringify((${s} || []).map((i) => COLORS[i].code))`));

test('Palette’s Rainbow from a small collection: past the vivid ones it takes the other clear colours before a brown, so it keeps its yellow and starts at red', () => {
  for (const set of ['Sketch 12', 'Ciao 12']) {
    const { E } = appWith(set);
    for (let n = 6; n <= 10; n++) {
      const p = JSON.parse(E(`JSON.stringify(genPalette(${n}, 'rainbow', {}))`));
      const lch = JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.map((i) => LCH[i]))`)),
        c = codes(E, JSON.stringify(p));
      assert.ok(lch[0][2] < 50 || lch[0][2] > 345, set + ' ' + n + ': starts at red, not ' + c[0]);
      assert.ok(
        lch.some((x) => x[2] >= 80 && x[2] <= 105 && x[0] >= 80),
        set + ' ' + n + ': a yellow in ' + c.join(' '),
      );
      // (a brown only once the other clear colours are used up: Sketch 12 has 10 that aren't browns)
      if (n <= 10) assert.ok(!c.some((k) => /^E/.test(k)), set + ' ' + n + ': no brown in ' + c.join(' '));
    }
  }
});
