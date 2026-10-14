// v318 (gradArea 3, new guides only): smoothing keeps touching sections off markers under TWIN_DE (2.5 CIEDE2000) of
// each other, which read as one colour; the markers a run picks are as before. A guide saved before (gradArea 2) lays
// as it did. Fails on v318 as shipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a grid of cells w x h, each a section, every one counted
function gridApp(cols, rows, ownedJs) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(ownedJs || 'state.owned = defaultOwned()');
  t.coll = E('sfCollection()');
  const cell = 20,
    lw = 2,
    W = cols * (cell + lw) + lw,
    H = rows * (cell + lw) + lw,
    g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (x % (cell + lw) < lw || y % (cell + lw) < lw) g[y * W + x] = 0;
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  return { E, t, de: E('de2000') };
}
function lay(a, vars) {
  const t = a.t;
  Object.assign(
    t.styleVars,
    { family: 'gradient', gradShape: 'serpentine', look: 'auto', paletteSource: 'owned', palette: 'all', gradScat: 0 },
    vars,
  );
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  t.assign.buildGuide();
  return t.assignData;
}
const markers = (ad) => [...new Map(Object.values(ad.assign).map((m) => [m.mkey, m])).values()];
function twins(a, ms) {
  let n = 0;
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (a.de(ms[i].lab, ms[j].lab) < 2.5) n++;
  return n;
}

test('a new guide takes gradArea 3', () => {
  const a = gridApp(4, 4);
  assert.equal(a.t.styleVars.gradArea, 3);
});

test('Pastel 24, Soft 24, Deep 32 on Ben’s markers: gradArea 3 picks the same markers as 2', () => {
  const a = gridApp(12, 10);
  const k = (ad) =>
    markers(ad)
      .map((m) => m.mkey)
      .sort()
      .join();
  for (const [emphasis, limitN] of [
    ['pastel', 24],
    ['muted', 24],
    ['deep', 32],
  ])
    assert.equal(k(lay(a, { gradArea: 2, emphasis, limitN })), k(lay(a, { gradArea: 3, emphasis, limitN })), emphasis);
});

test('Any and Bright pick from the whole set as before (no tiers): the same markers under 2 and 3', () => {
  const a = gridApp(12, 10);
  for (const emphasis of ['neutral', 'vivid']) {
    const k = (ad) =>
      markers(ad)
        .map((m) => m.mkey)
        .sort()
        .join();
    assert.equal(k(lay(a, { gradArea: 2, emphasis, limitN: 16 })), k(lay(a, { gradArea: 3, emphasis, limitN: 16 })));
  }
});

test('smoothing at all your markers: fewer touching sections on near twins at gradArea 3', () => {
  const a = gridApp(14, 12);
  const touchTwins = (ad) => {
    const adj = a.t.adj;
    let n = 0;
    for (const l of ad.order)
      for (const q of adj[l] || [])
        if (q > l && ad.assign[q] && ad.assign[q].mkey !== ad.assign[l].mkey && a.de(ad.assign[q].lab, ad.assign[l].lab) < 2.5) n++;
    return n;
  };
  const was = touchTwins(lay(a, { gradArea: 2, emphasis: 'neutral', limitN: 999 })),
    now = touchTwins(lay(a, { gradArea: 3, emphasis: 'neutral', limitN: 999 }));
  assert.ok(now < was, `touching twins ${was} → ${now}`);
});
