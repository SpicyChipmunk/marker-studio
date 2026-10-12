// v314 (D8): a Gradient made since v314 (gradArea 1), laid Polished or Natural, shares its run of markers out by each
// section's area to the power 0.7, so one huge section takes less of the run and the small ones aren't left with
// markers seen only on specks; a guide saved before (gradArea 0), and Textured, Sparkle and Confetti, as v313 laid them.
// gradArea is saved only when 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// one big section (3000) and ten small ones (100 each), shared out to four markers
function split(soft) {
  const core = createApp().__mstest;
  core.comps = [null, { area: 3000 }, ...Array.from({ length: 10 }, () => ({ area: 100 }))];
  const items = Array.from({ length: 11 }, (_, i) => i + 1);
  return [...core.grad.splitByArea(items, [1, 1, 1, 1], [1, 1, 1, 1], soft)].map((p) => p.length);
}

test('a guide saved before v314: the run shared by plain area, as v313 did (the big section takes three markers’ worth, two markers get a speck each)', () => {
  assert.deepEqual(split(false), [1, 1, 1, 8]);
});

test('a guide made since v314: by area to the power 0.7, the small sections shared out more evenly', () => {
  assert.deepEqual(split(true), [1, 1, 4, 5]);
});

test('gradArea: saved beside the section settings when set (1 in v314; 2 since v315), opens as saved, 0 otherwise', () => {
  const core = createApp().__mstest,
    f = [...core.styleFields].find((x) => x.key === 'gradArea');
  assert.equal(f.in, 'payload');
  assert.equal(f.undo, false);
  assert.equal(f.check(1, f.def), 1);
  assert.equal(f.check(undefined, f.def), 0);
  assert.equal(f.check(0.7, f.def), 0);
  core.styleVars.gradArea = 0;
  assert.equal(f.save(), undefined);
  core.styleVars.gradArea = 1;
  assert.equal(f.save(), 1);
});
