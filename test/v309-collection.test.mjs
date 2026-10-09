// v309: "I'm not sure which set" — findSets ranks a brand's sets from about how many markers and a few caps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp();
const set = (n) => app.__eval(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
const keysOf = (n) => app.__eval(`presetMkeys(MARKER_SETS[${set(n)}])`);
const name = (r) => app.__eval(`MARKER_SETS[${r.i}].n`);
const key = (b, code) => b + '|' + code;
const bucket = (t) => app.__eval(`FIND_BUCKETS.findIndex((b) => b.t === ${JSON.stringify(t)})`);

test('the count only ranks: Honolulu sets sit inside each other, and the one in the range comes first', () => {
  const caps = [key('Ohuhu', 'R014'), key('Ohuhu', 'Y28'), key('Ohuhu', 'BG314')];
  for (const k of caps) assert.ok(keysOf('Honolulu 120').includes(k), k);
  const r = app.findSets('Ohuhu', bucket('101–150'), caps);
  assert.equal(name(r[0]), 'Honolulu 120');
  assert.ok(r[0].all && r[0].hits === 3);
  // (Honolulu 72 hasn't BG314 or Y28) the sets with all three follow, nearest size first
  assert.deepEqual(
    [...r.slice(1, 3)].map(name),
    ['Honolulu 168', 'Honolulu 216'],
    'the bigger sets that have all three, nearest first',
  );
  const off = app.findSets('Ohuhu', bucket('151–250'), caps);
  assert.ok(off.slice(0, 3).map(name).includes('Honolulu 120'), 'one range off: still in the first three');
});

test('only the brand chosen; sets with none of the caps left out; with no caps, all of the brand', () => {
  const r = app.findSets('Copic', bucket('Up to 30'), [key('Copic', 'E00'), key('Copic', 'R29')]);
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => app.__eval(`MARKER_SETS[${x.i}].b`) === 'Copic'));
  assert.ok(r.every((x) => x.hits > 0));
  assert.equal(name(r[0]), 'Ciao 24', 'the smallest in range with both');
  const all = app.findSets('Ohuhu', -1, []);
  assert.equal(all.length, app.__eval("MARKER_SETS.filter((p) => p.b === 'Ohuhu').length"));
});

// (v309.1: a cap in no set no longer counts against a set; that test is below. Here, a cap from another set does)
test('a cap from another set: the sets with the others first, marked as not having all', () => {
  const caps = [key('Ohuhu', 'R014'), key('Ohuhu', 'Y28'), key('Ohuhu', 'B03')];
  const r = app.findSets('Ohuhu', bucket('101–150'), caps);
  assert.ok(!keysOf('Honolulu 120').includes(key('Ohuhu', 'B03')), 'B03 isn’t in Honolulu 120');
  assert.ok(r[0].all, 'a bigger set has all three');
  const h120 = [...r].find((x) => name(x) === 'Honolulu 120');
  assert.equal(h120.hits, 2);
  assert.equal(h120.all, false);
});

test('measured: with the right count and 3 caps, the set is first almost always and in the first two always', () => {
  const sets = app.__eval('MARKER_SETS.map((p) => ({ b: p.b, keys: presetMkeys(p) }))');
  const B = app.__eval('FIND_BUCKETS');
  const bk = (n) => B.findIndex((b) => n >= b.lo && n <= b.hi);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let first = 0,
    two = 0,
    n = 0;
  sets.forEach((S) => {
    for (let t = 0; t < 30; t++) {
      const pick = [...S.keys]
        .map((k) => [rnd(), k])
        .sort((a, b) => a[0] - b[0])
        .slice(0, 3)
        .map((x) => x[1]);
      const r = app.findSets(S.b, bk(S.keys.length), pick);
      const same = (x) => {
        const k = sets[x.i].keys;
        return k.length === S.keys.length && k.every((q) => S.keys.includes(q));
      };
      n++;
      if (same(r[0])) first++;
      if (r.slice(0, 2).some(same)) two++;
    }
  });
  assert.ok(first / n >= 0.95, 'first: ' + ((100 * first) / n).toFixed(1) + '%');
  assert.equal(two, n, 'in the first two');
});

// v309.1: a cap in none of the brand's sets (a colour sold on its own, such as Ohuhu B04) says nothing about the set:
// it doesn't count. The Colorless Blender comes with most Ohuhu sets (not the 24 or 24 Portrait), so it counts.
test('a cap in no set is left out of the count; with only such caps, nothing fits; the blender comes with the sets', () => {
  const caps = [key('Ohuhu', 'B04'), key('Ohuhu', 'R014'), key('Ohuhu', 'BG314')];
  for (const p of app.__eval("MARKER_SETS.filter((p) => p.b === 'Ohuhu').map((p) => p.n)"))
    assert.ok(!keysOf(p).includes(key('Ohuhu', 'B04')), p);
  const r = app.findSets('Ohuhu', bucket('101–150'), caps);
  assert.equal(name(r[0]), 'Honolulu 120');
  assert.ok(r[0].all, 'all of the caps that count');
  assert.equal(r[0].of, 2);
  assert.equal(r[0].n, 120, 'its size: the colours, not the blender');
  assert.equal(app.findSets('Ohuhu', bucket('101–150'), [key('Ohuhu', 'B04')]).length, 0);
  assert.ok(keysOf('Honolulu 120').includes(key('Ohuhu', '0')));
  assert.ok(!keysOf('Honolulu 24').includes(key('Ohuhu', '0')));
  assert.equal(app.__eval("presetSize(MARKER_SETS.find((p) => p.n === 'Honolulu 320 (complete set)'))"), 320);
});
