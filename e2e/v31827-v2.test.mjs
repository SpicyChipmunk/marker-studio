// v318.27: Random's "Keep touching sections clearly different" on the sample, roll after roll. The test in
// random-and-blend.test.mjs rolls a few times from one seed (7), which happened to be a clean one: before v318.27, Main
// colour left touching sections alike on many rolls (by its pairing: up to 9 in 12 at the sample's 16 markers, every roll
// at 8), and No repeats on some. Here each roll is laid from a seed of its own, for Mixed, Main colour and No repeats;
// which sections touch is worked out here, the test's own way (as random-and-blend.test.mjs does). And where too few
// markers can't keep them apart, the note under the box says so (#sfNoAdjNote), and More options' bar doesn't claim it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};

// the guide's touching pairs among its sections, found by walking right and down across the line from every pixel at a
// section's edge, up to a 40th of the picture's longer side: two sections touch when they meet along 6 px or more
const touching = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      L = t.labels,
      W = t.W,
      H = t.H,
      D = Math.round(Math.max(W, H) / 40),
      cnt = new Map();
    const walk = (x, y, dx, dy, l) => {
      for (let k = 1; k <= D; k++) {
        const X = x + dx * k,
          Y = y + dy * k;
        if (X >= W || Y >= H) return;
        const r = L[Y * W + X];
        if (r === l) return;
        if (r >= 1) {
          const key = Math.min(l, r) + ',' + Math.max(l, r);
          cnt.set(key, (cnt.get(key) || 0) + 1);
          return;
        }
      }
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const l = L[y * W + x];
        if (l < 1) continue;
        if (x + 1 < W && L[y * W + x + 1] !== l) walk(x, y, 1, 0, l);
        if (y + 1 < H && L[(y + 1) * W + x] !== l) walk(x, y, 0, 1, l);
      }
    const inG = new Set(t.assignData.order);
    return [...cnt]
      .filter(([, n]) => n >= 6)
      .map(([k]) => k.split(',').map(Number))
      .filter(([a, b]) => inG.has(a) && inG.has(b));
  });

// `rolls` layings of the plan (as Shuffle lays it), each from its own seed: the rolls with touching pairs on one marker
// or on markers alike by eye (CIEDE2000 under 10), and the rolls the note under the box showed on
const roll = (page, pairs, limitN, rolls) =>
  page.evaluate(
    ({ pairs, limitN, rolls }) => {
      const t = __mstest,
        R = Math.random,
        bad = [],
        noted = [];
      t.styleVars.limitN = limitN;
      for (let s = 1; s <= rolls; s++) {
        let a = s * 7919;
        Math.random = function () {
          a = (a + 0x6d2b79f5) | 0;
          let q = Math.imul(a ^ (a >>> 15), 1 | a);
          q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
          return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
        };
        try {
          t.reassign();
        } finally {
          Math.random = R;
        }
        const as = t.assignData.assign;
        let n = 0;
        for (const [p, q] of pairs)
          if (as[p] && as[q] && (as[p].mkey === as[q].mkey || de2000(as[p].lab, as[q].lab) < 10)) n++;
        if (n) bad.push('seed ' + s + ': ' + n);
        if (document.getElementById('sfNoAdjNote')) noted.push('seed ' + s);
      }
      return { bad, noted };
    },
    { pairs, limitN, rolls },
  );

test('Random on the sample, 24 rolls each from its own seed: Mixed, Main colour and No repeats keep touching sections clearly different', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]');
  await idle(page);
  await click(page, '#sfBal [data-v="mixed"]');
  await idle(page);
  await click(page, '#sfNoAdj');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.noAdj), true);
  const pairs = await touching(page);
  assert.ok(pairs.length > 40, pairs.length + ' touching pairs');
  const out = {};
  for (const limitN of [8, 16]) out['Mixed ' + limitN] = await roll(page, pairs, limitN, 24);
  // (Main colour: its pairing (Other pairings) set, as choosing Main colour draws one at random. Before v318.27, of
  // these at 16 markers 0.15 left touching sections alike on 5 rolls in 12, 0.25 and 0.75 on 6 to 9; at 8, 0.85 on 4)
  await click(page, '#sfBal [data-v="main"]');
  await idle(page);
  const pairing = (bs) =>
    page.evaluate((bs) => {
      __mstest.styleVars.balSeed = bs;
    }, bs);
  for (const bs of [0.15, 0.25, 0.75]) {
    await pairing(bs);
    out['Main colour ' + bs + ' 16'] = await roll(page, pairs, 16, 24);
  }
  await pairing(0.85);
  out['Main colour 0.85 8'] = await roll(page, pairs, 8, 24);
  await click(page, '#sfBal [data-v="mixed"]');
  await idle(page);
  await click(page, '#sfNoRep');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.noRep), true);
  out['No repeats'] = await roll(page, pairs, 16, 24);
  for (const k in out) assert.deepEqual(out[k], { bad: [], noted: [] }, k);
  // (and Shuffle itself, tapped: still none)
  await click(page, '#sfNoRep');
  await idle(page);
  await click(page, '#sfBal [data-v="main"]');
  await idle(page);
  await pairing(0.25);
  for (let r = 0; r < 4; r++) {
    await click(page, '#sfShuffle');
    await idle(page);
    const n = await page.evaluate((pairs) => {
      const as = __mstest.assignData.assign;
      return pairs.filter(([p, q]) => as[p].mkey === as[q].mkey || de2000(as[p].lab, as[q].lab) < 10).length;
    }, pairs);
    assert.equal(n, 0, 'Shuffle ' + r);
  }
  assert.deepEqual(errors, []);
});

test('Main colour with a pairing whose colours have too few markers at 8: every roll that leaves touching sections alike says so under the box', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]');
  await idle(page);
  await click(page, '#sfBal [data-v="main"]');
  await idle(page);
  await click(page, '#sfNoAdj');
  await idle(page);
  const pairs = await touching(page);
  // (browns, reds and a teal: the accent's marker is never given to the others' sections, so a section touching
  // all of its role's few markers keeps one)
  await page.evaluate(() => {
    __mstest.styleVars.balSeed = 0.05;
  });
  const r = await roll(page, pairs, 8, 12);
  assert.ok(r.bad.length > 0, "some rolls can't");
  assert.deepEqual(
    r.noted,
    r.bad.map((b) => b.split(':')[0]),
  );
  assert.deepEqual(errors, []);
});

test('too few markers to keep touching sections apart: the note under the box says how many, and goes when there are enough', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]');
  await idle(page);
  await click(page, '#sfBal [data-v="mixed"]');
  await idle(page);
  await click(page, '#sfNoAdj');
  await idle(page);
  assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'none at 16 markers');
  // (on a phone the box is under More options, whose bar says what's on)
  const sum = () => page.textContent('#sfMore-pattern .fb-sum');
  assert.equal(await sum(), 'Kept apart');
  // (2 markers: three sections that all touch one another can't all be different)
  await page.evaluate(() => {
    __mstest.styleVars.limitN = 2;
  });
  await click(page, '#sfShuffle');
  await idle(page);
  const n = await page.evaluate(() => __mstest.assign.adjLeft['0']);
  assert.ok(n > 1, n + ' left');
  const note = page.locator('#sfNoAdjNote');
  assert.equal(
    (await note.textContent()).trim(),
    n + ' touching sections couldn’t be kept clearly different: too few different markers.',
  );
  assert.equal(await sum(), 'Mostly kept apart');
  // (it sits under the box)
  const box = await page.locator('label:has(#sfNoAdj)').boundingBox(),
    nb = await note.boundingBox();
  assert.ok(nb && box && nb.y >= box.y + box.height - 1, JSON.stringify([box, nb]));
  // (off: nothing's claimed, no note)
  await click(page, '#sfNoAdj');
  await idle(page);
  assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'off');
  await click(page, '#sfNoAdj');
  await idle(page);
  assert.equal(await page.locator('#sfNoAdjNote').count(), 1, 'on again');
  await page.evaluate(() => {
    __mstest.styleVars.limitN = 16;
  });
  await click(page, '#sfShuffle');
  await idle(page);
  assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'enough markers');
  assert.equal(await sum(), 'Kept apart');
  assert.deepEqual(errors, []);
});
