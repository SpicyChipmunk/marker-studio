// The Photo pattern's marker choice (js/guide/46-photo.js): the full search (greedy, then swaps) against the quick
// one used while the marker slider is dragged, and the suggested marker count. The browser tests
// (e2e/photo-choice.test.mjs) cover the summary, the tips, "Closer with" and the Use button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp(),
  E = app.__eval,
  core = app.__mstest;
E('state.owned = new Set()');
E("presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 320 (complete set)')).forEach((k) => state.owned.add(k))");
const coll = E('sfCollection()').filter((m) => m.lab);
const de = (a, b) => E(`de2000(${JSON.stringify([...a])}, ${JSON.stringify([...b])})`);
// weighted mean difference (by eye) from each target to its nearest chosen marker
const cost = (t, chosen) => {
  let s = 0, w = 0;
  for (const x of t) { s += x.w * Math.min(...chosen.map((m) => de(x.lab, m.lab))); w += x.w; }
  return s / w;
};
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('swaps get out of the centre trap: three colours and a marker between them, two markers wanted', () => {
  // the greedy first pick is the in-between marker (it helps all three a little); swaps replace it with a real one
  const A = [60, 10, 0], B = [60, -5, 8.66], C = [60, -5, -8.66], M = [60, 0, 0];
  const pool = [{ mkey: 'A', lab: A }, { mkey: 'B', lab: B }, { mkey: 'C', lab: C }, { mkey: 'M', lab: M }];
  const t = [A, B, C].flatMap((x) => [0, 1, 2].map(() => ({ lab: x.slice(), w: 1 })));
  const quick = core.photoPick(t, pool, 2, true).chosen, full = core.photoPick(t, pool, 2, false).chosen;
  assert.ok(quick.some((m) => m.mkey === 'M'), 'the quick choice keeps the in-between marker');
  assert.ok(!full.some((m) => m.mkey === 'M'), 'the full choice has two of the real colours');
  assert.ok(cost(t, full) < cost(t, quick));
});

test('the full choice is never worse than the quick one, and is the same every time', () => {
  const r = rnd(11);
  for (let k = 0; k < 6; k++) {
    // photo colours: jittered copies of 12 random markers, with random weights
    const base = Array.from({ length: 12 }, () => coll[Math.floor(r() * coll.length)]);
    const t = Array.from({ length: 80 }, () => { const m = base[Math.floor(r() * 12)]; return { lab: [m.lab[0] + (r() - 0.5) * 8, m.lab[1] + (r() - 0.5) * 10, m.lab[2] + (r() - 0.5) * 10], w: 1 + r() * 9 }; });
    for (const N of [4, 8, 12]) {
      const quick = core.photoPick(t, coll, N, true), full = core.photoPick(t, coll, N, false);
      assert.ok(full.chosen.length <= N);
      assert.ok(cost(t, full.chosen) <= cost(t, quick.chosen) + 1e-9, `set ${k}, ${N} markers`);
      assert.deepEqual(core.photoPick(t, coll, N, false).chosen.map((m) => m.mkey), full.chosen.map((m) => m.mkey), 'deterministic');
    }
  }
});

test('suggested count: a photo made of 8 clearly different markers suggests 8; of 5, 5; none when more always help', () => {
  const r = rnd(5);
  // markers at least 10 apart by eye, none near white
  const pick = (n) => {
    const out = [];
    while (out.length < n) {
      const m = coll[Math.floor(r() * coll.length)];
      if (m.lab[0] > 85 || out.some((o) => de(o.lab, m.lab) < 10)) continue;
      out.push(m);
    }
    return out;
  };
  for (const n of [8, 5]) {
    const truth = pick(n);
    const t = Array.from({ length: 60 }, (_, i) => ({ lab: truth[i % n].lab.slice(), w: 1 + (i % 7) }));
    assert.equal(core.photoSuggest(t, coll), n, n + ' markers');
  }
  // a smooth run of colours much finer than the markers: every added marker helps somewhere, so no suggestion
  const ramp = Array.from({ length: 400 }, (_, i) => ({ lab: [20 + (i % 20) * 3.5, -40 + Math.floor(i / 20) * 4, ((i * 7) % 60) - 30], w: 1 }));
  assert.equal(core.photoSuggest(ramp, coll), 0);
});
