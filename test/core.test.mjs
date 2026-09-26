// Tests for the section-finder core (segmentation, background detection, undo),
// driven through the test-export seam. These exercise the real shipped code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const realComps = () => [...core.comps].filter((c) => c && !c.merged);

// A WxH image: white (255) except a black plus that fully separates it into
// four quadrants.
function plusGray(W, H) {
  const g = new Uint8Array(W * H).fill(255);
  const cx = (W / 2) | 0, cy = (H / 2) | 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2) g[y * W + x] = 0;
  }
  return g;
}
// The same plus as a label map (-1 = ink, 0 = fillable) for testing labelCells
// directly, independent of the thresholding step.
function plusLabels(W, H) {
  const lab = new Int32Array(W * H);
  const cx = (W / 2) | 0, cy = (H / 2) | 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    lab[y * W + x] = (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2) ? -1 : 0;
  }
  return lab;
}

test('segment() (default enhance path) splits a plus into four sections', () => {
  core.W = 40; core.H = 40; core.enhance = true; core.gray = plusGray(40, 40);
  core.segment();
  assert.equal(realComps().length, 4, `expected 4 quadrants, got ${realComps().length}`);
});

test('labelCells() labels regions with valid area, bbox and border count', () => {
  core.W = 40; core.H = 40; core.labels = plusLabels(40, 40);
  core.labelCells();
  const cells = realComps();
  assert.equal(cells.length, 4, 'four quadrants');
  for (const c of cells) {
    assert.ok(c.area > 250 && c.area < 400, `quadrant area ${c.area}`);
    for (const f of ['x0', 'y0', 'x1', 'y1']) {
      assert.equal(typeof c[f], 'number', `bbox.${f} present`); // data the v226 bug dropped
    }
    assert.ok(c.x0 >= 0 && c.x1 < 40 && c.y0 >= 0 && c.y1 < 40 && c.x1 >= c.x0 && c.y1 >= c.y0, 'bbox valid');
    assert.ok(c.bpx > 0, 'quadrant touches the image border');
  }
});

test('applyBg() reference is stable across edits (v227 fix)', () => {
  core.comps = [null,
    { bpx: 1000, merged: false, bg: false },
    { bpx: 300, merged: false, bg: false },
    { bpx: 100, merged: false, bg: false },
  ];
  core.bgTrim = 50;      // bgRel = 0.35
  core.applyBg(true);    // fresh -> reference 1000, threshold 350
  assert.equal(core.comps[1].bg, true);
  assert.equal(core.comps[2].bg, false);

  core.comps[1].bpx = 600; // an edit shrinks the biggest border
  core.applyBg();          // stable reference stays 1000
  assert.equal(core.comps[2].bg, false, 'unrelated cell must not flip to background');
  assert.equal(core.comps[1].bg, true);
});

test('snapshot/restore preserves every section field (v226 fix)', () => {
  core.labels = new Int32Array(16).fill(1);
  core.secColor = [null, [10, 20, 30]];
  core.secState = new Uint8Array([0, 1]);
  core.colored = new Uint8Array([0, 0]);
  core.comps = [null,
    { area: 100, bg: true, bpx: 42, cx: 5, cy: 6, h: 9, x0: 1, y0: 2, x1: 10, y1: 11, merged: false },
  ];
  core.snapshotSeg();
  core.comps[1].bpx = 999; core.comps[1].x0 = -1; core.comps[1].x1 = -1; core.comps[1].area = 0;
  core.restoreSnap();
  const c = core.comps[1];
  assert.equal(c.bpx, 42, 'bpx restored (dropped before the fix)');
  assert.equal(c.x0, 1); assert.equal(c.y0, 2); assert.equal(c.x1, 10); assert.equal(c.y1, 11);
  assert.equal(c.area, 100);
});

// Regression: otsu() used to return 0 for a perfectly bimodal (pure 0/255)
// image, collapsing a crisp digital PNG into one section when enhance=false.
// Fixed by returning the midpoint of the max-variance plateau.
test('otsu() separates a perfectly bimodal image', () => {
  const t = core.otsu(plusGray(40, 40), 40 * 40);
  assert.ok(t > 0 && t < 255, `threshold ${t} must sit between the two peaks`);
});

test('segment() with enhance=false also handles clean digital line art', () => {
  core.W = 40; core.H = 40; core.enhance = false; core.gray = plusGray(40, 40);
  core.segment();
  assert.equal(realComps().length, 4);
});
