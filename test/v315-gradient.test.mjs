// v315 (Q5, Q11): a Gradient made since v315 (gradArea 2) shares its run out by plain area unless a marker would land
// only on specks (under 0.3% of the page), then softer and softer until none does; a section you pinned that is bigger
// than one marker's share counts for nothing, so the others spread over the rest (not a section kept only because it's
// coloured); and no two markers in the run are within RAINBOW_NEED of each other while one further off is near. A
// guide made in v314 (1) or before (0) is laid as it was. Fails on v314.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a page: one big section on the left, a grid of 16 px boxes on the right; Ben's markers
function setup() {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest,
    A = core.assign;
  if (A.quiet) A.quiet();
  const W = 400,
    H = 300,
    g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || (x >= 238 && x < 242),
        grid = x > 240 && (x % 16 < 2 || y % 16 < 2);
      if (edge || grid) g[y * W + x] = 0;
    }
  core.srcK = 1;
  core.W = W;
  core.H = H;
  core.gray = g;
  core.segment();
  E('state.owned = defaultOwned()');
  core.coll = E('sfCollection()');
  const lay = (ga) => {
    Object.assign(core.styleVars, {
      family: 'gradient',
      gradShape: 'serpentine',
      look: 'auto',
      paletteSource: 'owned',
      palette: 'all',
      limitN: 16,
      gradScat: 0,
      gradArea: ga,
    });
    A.adj = null;
    A.segFresh = true;
    A.sfmode = 'review';
    core.assignData = null;
    A.buildGuide();
  };
  // each marker's share of the page, and the markers on under 0.3% of it
  const shares = () => {
    const M = core.assignData.assign,
      a = {};
    let all = 0;
    for (const l of core.assignData.order) {
      a[M[l].mkey] = (a[M[l].mkey] || 0) + core.comps[l].area;
      all += core.comps[l].area;
    }
    for (const k in a) a[k] /= all;
    return a;
  };
  const specks = () => Object.values(shares()).filter((v) => v < 0.003).length;
  lay(2);
  const big = core.assignData.order.reduce((b, l) => (core.comps[l].area > core.comps[b].area ? l : b));
  return { app, core, A, lay, shares, specks, big };
}

test('splitByArea: rule 2 lays as the plain rule unless a part would be a speck, then softens', () => {
  const core = createApp().__mstest,
    split = (areas, soft, zero) => {
      core.comps = [null, ...areas.map((a) => ({ area: a }))];
      const items = areas.map((_, i) => i + 1),
        ones = [1, 1, 1, 1];
      return [...core.grad.splitByArea(items, ones, ones, soft, zero)].map((p) => p.length);
    };
  // no specks either way: as plain
  const even = [500, 400, 600, 300, 500, 400, 600, 300];
  assert.deepEqual(split(even, 2), split(even, 0));
  // a big section, ten tiny ones, four middling: plain leaves the second marker one tiny section (0.1% of the page);
  // rule 2 softens until no part is under 0.3%
  const areas = [3000, ...Array(10).fill(5), 400, 400, 400, 400],
    sums = (soft, zero) => {
      const cut = split(areas, soft, zero);
      let i = 0;
      return cut.map((n) => areas.slice(i, (i += n)).reduce((a, b) => a + b, 0));
    };
  assert.deepEqual(sums(0), [3000, 5, 445, 1200]);
  const tot = 4650;
  assert.ok(Math.min(...sums(2)) >= 0.003 * tot, 'no speck: ' + sums(2));
  // v314's rule as it was (true, as v314 passed it, is 1)
  assert.deepEqual(split(areas, true), split(areas, 1));
  // the big one counting for nothing: the run shared out over the rest
  const z = sums(2, { 1: 1 }),
    rest = [z[0] - 3000, ...z.slice(1)];
  assert.ok(Math.min(...rest) >= 400, 'each marker a fair part of the rest: ' + rest);
});

test('a new Gradient (rule 2): fewer markers on specks than the plain rule', () => {
  const { lay, specks } = setup();
  lay(0);
  const plain = specks();
  lay(2);
  assert.ok(specks() < plain, `${specks()} < ${plain}`);
});

test('pinning the big section (rule 2): the other markers spread over the rest; a coloured one held for a re-lay counts as before', () => {
  const { core, lay, shares, big } = setup();
  const others = () =>
    core.assignData.order
      .filter((l) => l !== big)
      .map((l) => core.assignData.assign[l].mkey)
      .join(',');
  lay(2);
  const plain = others();
  // coloured, not pinned: held by the re-lay, laid as before
  core.colored[big] = 1;
  core.reassign();
  assert.equal(others(), plain, 'a coloured section isn’t a pin');
  core.colored[big] = 0;
  // pinned
  lay(2);
  const pk = core.assignData.assign[big].mkey;
  core.locks[big] = pk;
  core.reassign();
  assert.notEqual(others(), plain);
  const s = shares();
  for (const k in s) if (k !== pk) assert.ok(s[k] > 0.01, k + ' on more than specks: ' + s[k]);
  delete core.locks[big];
  // rule 1 (v314): a pin changes nothing
  lay(1);
  const v314 = others();
  core.locks[big] = core.assignData.assign[big].mkey;
  core.reassign();
  assert.equal(others(), v314);
  delete core.locks[big];
});

test('rule 2: no two markers in the run within RAINBOW_NEED of each other (Ben’s B111 and B112); rule 1 as before', () => {
  const { core, lay, app } = setup();
  const close = () => {
    const ms = [
      ...new Map(
        core.assignData.order.map((l) => [core.assignData.assign[l].mkey, core.assignData.assign[l]]),
      ).values(),
    ];
    let n = 0;
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) if (app.de2000(ms[i].lab, ms[j].lab) < 5) n++;
    return n;
  };
  lay(1);
  assert.ok(close() > 0, 'v314’s run has a near pair here');
  lay(2);
  assert.equal(close(), 0);
});

test('gradArea: saved beside the section settings when set (2 for a new guide; 3 since v318, 4 since v318.10, 5 since v318.11), opens as saved, 0 otherwise', () => {
  const core = createApp().__mstest,
    f = [...core.styleFields].find((x) => x.key === 'gradArea');
  assert.equal(f.check(2, f.def), 2);
  assert.equal(f.check(1, f.def), 1);
  assert.equal(f.check(3, f.def), 3);
  assert.equal(f.check(4, f.def), 4);
  assert.equal(f.check(5, f.def), 5);
  assert.equal(f.check(6, f.def), 0);
  core.styleVars.gradArea = 2;
  assert.equal(f.save(), 2, 'a 2 is saved as 2, not 1');
  core.styleVars.gradArea = 0;
  assert.equal(f.save(), undefined);
});
