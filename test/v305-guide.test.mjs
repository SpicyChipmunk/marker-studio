// v305 (guide: 30-palette-assign): a new Blend's three anchors are placed over the drawing's own extent (the sections
// being coloured: a zone's, in a zone), and one that lands off those sections moves to the nearest one's label point,
// a section to itself, so none sits on the paper round the drawing. Their markers are vivid ones nearest red, green
// and blue round the hue wheel (the first used to be the pool's first in hue order: with Ben's 451, the brown E713).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(owned) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E(owned);
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, t, A: t.assign };
}
// an L of square sections (a column down the left, a row along the bottom) in the middle of a page whose paper round
// it is a section of its own, not coloured
function lPage(t, n = 6, off = 200, size = 600, cell = 24, lw = 2) {
  const W = size,
    H = size,
    labels = new Int32Array(W * H).fill(1);
  const comps = [
    null,
    {
      area: W * H,
      bg: true,
      bpx: 0,
      cx: 10,
      cy: 10,
      h: H,
      x0: 0,
      y0: 0,
      x1: W - 1,
      y1: H - 1,
      merged: false,
    },
  ];
  const at = {};
  for (let y = off; y < off + n * (cell + lw) + lw; y++)
    labels.fill(-1, y * W + off, y * W + off + n * (cell + lw) + lw);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (c > 0 && r < n - 1) continue;
      const l = comps.length,
        x0 = off + lw + c * (cell + lw),
        y0 = off + lw + r * (cell + lw);
      comps.push({
        area: cell * cell,
        bg: false,
        bpx: 0,
        cx: x0 + cell / 2,
        cy: y0 + cell / 2,
        h: cell - 1,
        x0,
        y0,
        x1: x0 + cell - 1,
        y1: y0 + cell - 1,
        merged: false,
      });
      for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
      at[c + ',' + r] = l;
    }
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.secState[1] = 0;
  t.secColor = new Array(comps.length).fill([200, 200, 200]);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  return { at, secs: Object.values(at) };
}
const style = (t, o) =>
  Object.assign(
    t.styleVars,
    { family: 'blend', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 16 },
    o,
  );
const onSec = (t, a) => t.labels[Math.round(a.y) * t.W + Math.round(a.x)];

test('a new Blend’s anchors sit on the drawing’s sections, each on its own, not on the paper round it', () => {
  const { t, A } = appWith('state.owned = defaultOwned()');
  const g = lPage(t);
  style(t);
  A.buildGuide();
  assert.equal(t.sfmode, 'guide');
  const own = new Set(g.secs),
    on = t.anchors.map((a) => onSec(t, a));
  assert.equal(t.anchors.length, 3);
  for (const L of on) assert.ok(own.has(L), 'on section ' + L + ', one of the drawing’s');
  assert.equal(new Set(on).size, 3, 'three different sections');
  // laid again from nothing (Reset anchors): the same places
  const k = JSON.stringify(t.anchors);
  t.anchors.length = 0;
  A.blendNow();
  assert.equal(JSON.stringify(t.anchors), k);
});

test('in a zone, the anchors brought back sit on the zone’s own sections', () => {
  const { t, A } = appWith('state.owned = defaultOwned()');
  const g = lPage(t, 8);
  style(t);
  A.buildGuide();
  const z = A.zoneNew();
  A.zoneSelect(z.id);
  t.styleVars.family = 'blend';
  // the bottom row's right half
  const blk = [4, 5, 6, 7].map((c) => g.at[c + ',7']);
  t.reassign(t.zoneMove(blk, z.id));
  t.anchors.length = 0;
  A.blendNow();
  const own = new Set(blk);
  assert.equal(t.anchors.length, 3);
  for (const a of t.anchors)
    assert.ok(own.has(onSec(t, a)), `(${a.x}, ${a.y}) on one of the zone’s sections`);
});

test('a new Blend’s anchor markers: vivid, far apart round the hue wheel; with Ben’s 451 not the brown E713 first', () => {
  for (const [what, owned] of [
    ['Ben’s 451', 'state.owned = defaultOwned()'],
    ['Honolulu 24', 'state.owned = new Set(presetMkeys(MARKER_SETS[1]))'],
  ]) {
    const { t, A } = appWith(owned);
    lPage(t);
    style(t);
    A.buildGuide();
    const by = {};
    t.coll.forEach((m) => {
      by[m.mkey] = m;
    });
    const cs = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
      med = cs[Math.floor(cs.length / 2)];
    const a = t.anchors.map((x) => {
      const l = t.colour.lch(by[x.mkey]);
      return { k: x.mkey, c: l[1], h: ((l[2] % 360) + 360) % 360 };
    });
    assert.equal(new Set(a.map((x) => x.k)).size, 3, what + ': three markers');
    if (what === 'Ben’s 451') assert.notEqual(a[0].k, 'Ohuhu|E713');
    for (const x of a) assert.ok(x.c >= med, `${what}: ${x.k} as colourful as the middle or more`);
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) {
        const d = Math.abs(a[i].h - a[j].h);
        assert.ok(Math.min(d, 360 - d) >= 60, `${what}: ${a[i].k} and ${a[j].k} far apart in hue`);
      }
  }
});

test('a Blend with fewer than three markers still starts with three anchors', () => {
  const { t, A } = appWith('state.owned = new Set(presetMkeys(MARKER_SETS[0]).slice(0, 2))');
  lPage(t);
  style(t);
  A.buildGuide();
  assert.equal(t.anchors.length, 3);
  for (const a of t.anchors) assert.ok(t.coll.some((m) => m.mkey === a.mkey));
});
