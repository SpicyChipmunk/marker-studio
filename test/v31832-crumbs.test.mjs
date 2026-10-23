// v318.32: the crumbs of paper a photo's grain and edge leave (crumbClean). A textured band along the picture's edge
// (one ink blob, shallow, a solid strip pocked with holes under 3 mm²) is made paper with its holes; a clump of grain
// dots in the margin keeps its ink but the crumbs between its dots (under 3 mm²) go to the paper. The drawing's own
// small sections stay, and so do a small shape drawn on its own, a hole inside one ring, bead, letter or flower (Fable
// P1-1), a hole counted at a hand-set Min section size (P1-2), and the ink of a lace strip or fine hatching along the
// edge (P1-5). segQuality counts only the crumbs under its reference size (P1-3), read off the sections, so an Undo
// counts the restored detection's (P1-4). Fails on v318.31 (no crumbClean) and on the first v318.32 (one ring's hole
// taken, limits from the user's Min, every crumb a speck, stale count after Undo, lace erased).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1040,
  M = 120;
// a page with a 120 px blank margin round a grid of lines (grey 30)
function page(draw) {
  const g = new Uint8Array(W * H).fill(245);
  for (let y = M; y < H - M; y++)
    for (let x = M; x < W - M; x++)
      if ((x - M) % 80 < 3 || (y - M) % 80 < 3 || x >= W - M - 3 || y >= H - M - 3) g[y * W + x] = 30;
  if (draw) draw(g);
  return g;
}
const px = (g, x, y, v) => {
  if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = v == null ? 30 : v;
};
const box = (g, x0, y0, s, v) => {
  for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) px(g, x, y, v);
};
const ring = (g, x0, y0, s, v, t) => {
  t = t || 2;
  for (let y = y0; y < y0 + s; y++)
    for (let x = x0; x < x0 + s; x++)
      if (x < x0 + t || x >= x0 + s - t || y < y0 + t || y >= y0 + s - t) px(g, x, y, v);
};
// four 3 px grain dots touching at their corners round a 3 × 3 crumb of paper
const dots4 = (g, x, y) => {
  box(g, x + 3, y, 3);
  box(g, x, y + 3, 3);
  box(g, x + 6, y + 3, 3);
  box(g, x + 3, y + 6, 3);
};
// the page's edge in shadow down the left: dark, 30 px wide, pocked with 3 px holes of paper every 7 px
function edgeBand(g) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 30; x++) g[y * W + x] = x % 7 < 3 && y % 7 < 3 && x > 2 ? 245 : 40;
}
// (o.minPos: a hand-set Min section size; otherwise the picture's own, as a new picture gets, minPosAuto)
function seg(g, o) {
  o = o || {};
  const app = createApp(),
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.srcDims = { w: W, h: H };
  t.minPos = o.minPos == null ? t.minPosAuto() : o.minPos;
  if (o.srcColour != null) t.srcColour = o.srcColour;
  t.segment();
  return t;
}
const what = (t, x, y) => {
  const l = t.labels[y * W + x];
  return l < 1 ? 'ink' : t.comps[l].bg ? 'paper' : 'section';
};
const counted = (t) => {
  let k = 0;
  for (let l = 1; l < t.comps.length; l++) {
    const c = t.comps[l];
    if (c && !c.bg && !c.merged && c.area >= t.minPx()) k++;
  }
  return k;
};
const ink = (t) => {
  let k = 0;
  for (let i = 0; i < t.labels.length; i++) if (t.labels[i] === -1) k++;
  return k;
};

test('a textured band along the edge goes to the paper, its holes with it; the drawing is untouched', () => {
  const plain = seg(page());
  const t = seg(page(edgeBand));
  assert.ok(t.crumbGone >= 20, 'holes gone: ' + t.crumbGone);
  assert.equal(what(t, 4, 400), 'paper', 'a hole');
  assert.equal(what(t, 10, 405), 'paper', 'the band itself');
  // the paper round the drawing reaches into the band
  assert.equal(t.labels[400 * W + 4], t.labels[400 * W + 60]);
  // the same sections as the page without the band
  assert.equal(counted(t), counted(plain));
  assert.equal(what(t, M + 1, M + 40), 'ink', 'the lines stay');
});

test('grain dots in the margin keep their ink, the crumb between them goes; one ring or a small shape on its own keeps its hole', () => {
  const t = seg(
    page((g) => {
      dots4(g, 40, 500); // four grain dots touching at the corners: a crumb of 9 px between them
      ring(g, 40, 600, 8); // a speck ring in the margin: a hole of 16 px inside one piece of ink (P1-1)
      ring(g, 40, 700, 13); // a small closed shape on its own (a heart at 400 px): 81 px inside
      dots4(g, 300, 300); // grain dots inside a grid cell
      ring(g, 300, 400, 8); // a speck ring inside a grid cell
    }),
  );
  assert.equal(what(t, 44, 501), 'ink', 'a grain dot stays');
  assert.equal(what(t, 44, 504), 'paper', 'the crumb between the dots goes');
  assert.equal(t.crumbGone, 1, 'one crumb: the dots’ (not the rings’)');
  assert.equal(what(t, 40, 603), 'ink', 'the margin ring stays');
  assert.equal(what(t, 43, 603), 'section', 'its hole stays: a drawn shape');
  assert.equal(what(t, 46, 706), 'section', 'the small shape keeps its inside');
  assert.equal(what(t, 304, 304), 'section', 'a crumb inside a section is the drawing’s');
  assert.equal(what(t, 303, 403), 'section', 'a closed mark inside a section keeps its hole');
});

test("the drawing's own small sections stay (they touch its lines), and a solid edge band without holes is left", () => {
  const t = seg(
    page((g) => {
      // a small cell made by an extra line in the grid's corner cell: a section 6 px wide, touching the grid
      for (let y = M; y < M + 80; y++) for (let x = M + 9; x < M + 11; x++) g[y * W + x] = 30;
      box(g, 0, 0, 30, 40); // a solid dark corner (no holes)
      for (let y = 0; y < H; y++) for (let x = W - 20; x < W; x++) g[y * W + x] = 40;
    }),
  );
  assert.equal(what(t, M + 6, M + 40), 'section', 'the thin cell');
  assert.equal(what(t, 10, 10), 'ink');
  assert.equal(what(t, W - 10, 500), 'ink');
  assert.equal(t.crumbGone, 0);
});

test('a page with no margin (edge to edge) loses nothing', () => {
  const g = new Uint8Array(W * H).fill(245);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 80 < 3 || y % 80 < 3) g[y * W + x] = 30;
  const t = seg(g);
  assert.equal(t.crumbGone, 0);
});

// ---- Fable P1's drawings: small closed shapes on their own (P1-1) ----
test('a dotted mandala of separate rings keeps every section', () => {
  const g = new Uint8Array(W * H).fill(245),
    cx = 400,
    cy = 500;
  let rings = 0;
  for (let r = 40; r <= 240; r += 20) {
    const k = Math.floor((2 * Math.PI * r) / 14);
    for (let i = 0; i < k; i++, rings++) {
      const a = (i / k) * 2 * Math.PI;
      ring(g, Math.round(cx + r * Math.cos(a)) - 4, Math.round(cy + r * Math.sin(a)) - 4, 9);
    }
  }
  const t = seg(g);
  assert.equal(t.crumbGone, 0);
  assert.equal(counted(t), rings, 'every ring’s hole a section (' + rings + ')');
});

test('a border of separate rings and a border of small flowers keep theirs', () => {
  const motifs = seg(
    page((g) => {
      for (let x = 20; x < W - 20; x += 30) {
        ring(g, x, 20, 9);
        ring(g, x, H - 29, 9);
      }
      for (let y = 50; y < H - 50; y += 30) {
        ring(g, 20, y, 9);
        ring(g, W - 29, y, 9);
      }
    }),
  );
  assert.equal(motifs.crumbGone, 0, 'rings');
  assert.equal(counted(motifs), counted(seg(page())) + 116, 'the 116 rings’ holes are sections');
  const flower = (g, cx, cy) => {
    ring(g, cx - 3, cy - 3, 7, 30, 1);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ring(g, Math.round(cx + 8 * Math.cos(a)) - 4, Math.round(cy + 8 * Math.sin(a)) - 4, 8, 30, 1);
    }
  };
  const flowers = seg(
    page((g) => {
      for (let x = 30; x < W - 30; x += 36) {
        flower(g, x, 30);
        flower(g, x, H - 30);
      }
    }),
  );
  assert.equal(flowers.crumbGone, 0, 'flowers');
  assert.ok(counted(flowers) > counted(seg(page())) + 250, 'the petals are sections: ' + counted(flowers));
});

test('a 5-bead chain keeps its holes; a margin caption keeps its letter holes', () => {
  const t = seg(
    page((g) => {
      for (let i = 0; i < 5; i++) ring(g, 40 + i * 10, 800, 10);
      for (let x = 340; x < 460; x += 12) ring(g, x, 900, 8);
    }),
  );
  assert.equal(t.crumbGone, 0);
  for (let i = 0; i < 5; i++) assert.equal(what(t, 44 + i * 10, 804), 'section', 'bead ' + i);
  for (let x = 340; x < 460; x += 12) assert.equal(what(t, x + 3, 903), 'section', 'letter at ' + x);
});

// ---- the limits are the page's, not Min section size's (P1-2) ----
test('a hole counted at a hand-set Min section size (its slider at 100) is never removed', () => {
  const draw = (g) => {
    // six 30 px rings on their own (676 px inside, counted at 400 px), coarse hatching along the edge (121 px cells)
    for (let i = 0; i < 6; i++) ring(g, 40 + i * 60, 800, 30);
    for (let y = 100; y < 900; y++)
      for (let x = 0; x < 40; x++) if (x % 12 === 0 || y % 12 === 0) px(g, x, y);
  };
  const t = seg(page(draw), { minPos: 100 }),
    auto = seg(page(draw));
  assert.equal(t.minPx(), 400);
  assert.equal(t.crumbGone, 0, 'nothing taken');
  for (let i = 0; i < 6; i++) assert.equal(what(t, 55 + i * 60, 815), 'section', 'ring ' + i);
  assert.equal(what(t, 12, 500), 'ink', 'the hatching keeps its ink');
  assert.equal(what(t, 6, 506), 'section', 'and its cells');
  assert.equal(ink(t), ink(auto), 'the same ink as at the picture’s own Min');
});

// ---- the edge band's ink stays unless it's a pocked strip (P1-5) ----
test('a one-sided lace strip along the edge keeps its ink; so does fine hatching', () => {
  const plainInk = ink(seg(page()));
  const lace = seg(
    page((g) => {
      for (let y = 0; y < 3; y++) for (let x = 0; x < W; x++) px(g, x, y);
      for (let i = 0; i < 25; i++) ring(g, 10 + i * 7, 2, 5, 30, 1);
      for (let i = 0; i < 15; i++) ring(g, 200 + i * 14, 2, 11, 30, 1);
    }),
  );
  assert.equal(lace.crumbGone, 0, 'lace');
  assert.ok(
    ink(lace) > plainInk + 2000,
    'the lace’s line and loops are still ink: ' + (ink(lace) - plainInk),
  );
  assert.equal(what(lace, 400, 1), 'ink');
  const hatch = seg(
    page((g) => {
      for (let y = 100; y < 900; y++)
        for (let x = 0; x < 40; x++) if (x % 4 === 0 || y % 4 === 0) px(g, x, y);
    }),
  );
  assert.equal(hatch.crumbGone, 0, 'hatching');
  assert.ok(ink(hatch) > plainInk + 10000, 'the hatching is still ink: ' + (ink(hatch) - plainInk));
});

// ---- the coloured-page warning counts only small crumbs (P1-3), off the sections (P1-4) ----
test('a clean page photo with a tinted, textured edge band: no "coloured in already" warning', () => {
  const band = (g) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < 36; x++) {
        const hs = ((y / 9) | 0) % 2 ? 5 : 3;
        g[y * W + x] = x % 9 < hs && y % 9 < hs && x > 2 ? 245 : 40;
      }
  };
  const t = seg(page(band), { srcColour: 0.2 });
  assert.ok(t.crumbGone >= 20, 'the band went: ' + t.crumbGone);
  assert.equal(counted(t), counted(seg(page())), 'the drawing’s sections');
  assert.notEqual(t.segWarn && t.segWarn.code, 'coloured', JSON.stringify(t.segWarn));
  // the crumbs under the warning's reference size are all it counts
  assert.ok(t.crumbCount(t.minPx(30)) < t.crumbGone, 'the 25 px holes are not specks');
});

test('crumbGone after Undo is the restored detection’s', () => {
  const t = seg(page(edgeBand)),
    n1 = t.crumbGone;
  assert.ok(n1 >= 20);
  // the sections found again on the page without the band (as a Trim would), then Undo
  t.gray = page();
  t.segSync = true;
  try {
    assert.equal(t.resegment(), true);
  } finally {
    t.segSync = false;
  }
  assert.equal(t.crumbGone, 0, 'none on the plain page');
  t.doUndoSeg();
  assert.equal(t.crumbGone, n1, 'the band’s crumbs again');
  assert.ok(t.segWarn && t.segWarn.ok, JSON.stringify(t.segWarn));
});

// ---- cost (P1-6, E1-7): a 2400 px page with grain and a pocked band ----
test('the clean-up at 2400 × 1800 stays within budget', () => {
  const W2 = 2400,
    H2 = 1800,
    g = new Uint8Array(W2 * H2).fill(240),
    p = (x, y, v) => {
      if (x >= 0 && y >= 0 && x < W2 && y < H2) g[y * W2 + x] = v || 30;
    };
  for (let y = 300; y < H2 - 300; y++)
    for (let x = 300; x < W2 - 300; x++) if ((x - 300) % 120 < 4 || (y - 300) % 120 < 4) p(x, y);
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 6000; i++) {
    const x = Math.floor(rnd() * W2),
      y = Math.floor(rnd() * H2);
    if (x > 300 && x < W2 - 300 && y > 300 && y < H2 - 300) continue;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) p(x + dx, y + dy, 50);
  }
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < 90; x++) p(x, y, x % 12 < 7 && y % 12 < 7 && x > 4 ? 240 : 45);
  const app = createApp(),
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.srcK = 1;
  t.W = W2;
  t.H = H2;
  t.gray = g;
  t.srcDims = { w: W2, h: H2 };
  t.minPos = t.minPosAuto();
  const t0 = performance.now();
  t.segment();
  const ms = performance.now() - t0;
  assert.ok(t.crumbGone >= 1000, 'the band’s holes went: ' + t.crumbGone);
  assert.equal(t.labels[500 * W2 + 20], t.labels[500 * W2 + 200], 'the band is the paper round the drawing');
  // (whole segment(): 0.8-1.5 s on the shared test box; crumbClean a fifth of it)
  assert.ok(ms < 6000, 'segment took ' + ms.toFixed(0) + ' ms');
});
