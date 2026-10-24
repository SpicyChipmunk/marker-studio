// Finding sections: ink, specks, frames, hatching, coloured pages, small pictures.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core, createApp } from './harness.mjs';

// ---- from quality-check.test.mjs ----
// Tests for segQuality(): detecting inputs that won't segment well, so the app
// can warn instead of silently producing a bad guide. Calibrated against the
// real jellyfish (good) vs blank / noisy / dark / gradient (bad).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  // Set up a synthetic segmentation state: px pixels, `ink` of them ink (-1),
  // and cells with the given areas.
  function setup(px, ink, areas) {
    const L = new Int32Array(px).fill(1);
    for (let i = 0; i < ink && i < px; i++) L[i] = -1;
    core.W = px;
    core.H = 1;
    core.labels = L;
    const comps = [null];
    for (const a of areas) comps.push({ area: a, merged: false });
    core.comps = comps;
  }
  const PX = 100000;
  // tc (tiny cutoff) = PX*0.0005 = 50

  test('flags a blank / near-empty image as "faint"', () => {
    setup(PX, 0, [PX]);
    assert.equal(core.segQuality().code, 'faint');
  });
  test('flags a single-blob (low-contrast) result as "few"', () => {
    setup(PX, 30000, [70000]); // inkFrac 0.3, one section
    assert.equal(core.segQuality().code, 'few');
  });
  test('flags a mostly-dark image (photo/shaded) as "dark"', () => {
    setup(PX, 60000, [4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000]); // inkFrac 0.6
    assert.equal(core.segQuality().code, 'dark');
  });
  test('flags an over-segmented (noisy/photo) result as "noisy"', () => {
    const areas = [];
    for (let i = 0; i < 90; i++) areas.push(12); // tiny fragments, over Min section size (9 px): in the guide
    for (let i = 0; i < 10; i++) areas.push(500); // a few bigger
    setup(PX, 40000, areas); // inkFrac 0.4, tinyFrac 0.9
    assert.equal(core.segQuality().code, 'noisy');
  });
  test('v303: not "noisy" when the tiny fragments are all under Min section size (left out of the guide anyway)', () => {
    const areas = [];
    for (let i = 0; i < 90; i++) areas.push(2); // specks, left out
    for (let i = 0; i < 10; i++) areas.push(500);
    setup(PX, 40000, areas);
    assert.equal(core.segQuality().ok, true);
  });
  test('passes clean line art (jellyfish-like profile)', () => {
    const areas = [];
    for (let i = 0; i < 54; i++) areas.push(2); // ~32% tiny, like the jellyfish
    for (let i = 0; i < 115; i++) areas.push(1000);
    setup(PX, 18000, areas); // inkFrac 0.18, N 169, tinyFrac 0.32
    assert.equal(core.segQuality().ok, true);
  });
  test('segment() sets segWarn end-to-end', () => {
    // blank image -> faint
    core.W = 100;
    core.H = 100;
    core.enhance = true;
    core.gray = new Uint8Array(10000).fill(250);
    core.segment();
    assert.equal(core.segWarn.ok, false);
    assert.equal(core.segWarn.code, 'faint');

    // clean plus -> good
    const W = 40,
      H = 40,
      g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (Math.abs(x - 20) < 2 || Math.abs(y - 20) < 2) g[y * W + x] = 0;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.segment();
    assert.equal(core.segWarn.ok, true);
  });
  // ---- From the persistence / import-safety fixes ----
  // v238: the quality check judges fragments by absolute size.
  test('quality check: clean dense line art is not flagged as noisy', () => {
    const W = 1000,
      H = 1000,
      g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 20 < 2 || y % 20 < 2) g[y * W + x] = 0;
    core.W = W;
    core.H = H;
    core.enhance = false;
    core.gray = g;
    core.segment();
    const n = [...core.comps].filter((c) => c && !c.merged).length;
    assert.ok(n > 2000, `fixture has ${n} cells`);
    assert.equal(core.segWarn.ok, true, JSON.stringify(core.segWarn));
  });
}

// ---- from segmentation.test.mjs ----
// Tests for the section-finder core (segmentation, background detection, undo, label placement),
// driven through the test-export seam. These exercise the real shipped code.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const realComps = () => [...core.comps].filter((c) => c && !c.merged);
  // A WxH image: white (255) except a black plus that fully separates it into
  // four quadrants.
  function plusGray(W, H) {
    const g = new Uint8Array(W * H).fill(255);
    const cx = (W / 2) | 0,
      cy = (H / 2) | 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2) g[y * W + x] = 0;
      }
    return g;
  }
  // The same plus as a label map (-1 = ink, 0 = fillable) for testing labelCells
  // directly, independent of the thresholding step.
  function plusLabels(W, H) {
    const lab = new Int32Array(W * H);
    const cx = (W / 2) | 0,
      cy = (H / 2) | 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        lab[y * W + x] = Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2 ? -1 : 0;
      }
    return lab;
  }
  test('segment() (default enhance path) splits a plus into four sections', () => {
    core.W = 40;
    core.H = 40;
    core.enhance = true;
    core.gray = plusGray(40, 40);
    core.segment();
    assert.equal(realComps().length, 4, `expected 4 quadrants, got ${realComps().length}`);
  });
  test('labelCells() labels regions with valid area, bbox and border count', () => {
    core.W = 40;
    core.H = 40;
    core.labels = plusLabels(40, 40);
    core.labelCells();
    const cells = realComps();
    assert.equal(cells.length, 4, 'four quadrants');
    for (const c of cells) {
      assert.ok(c.area > 250 && c.area < 400, `quadrant area ${c.area}`);
      for (const f of ['x0', 'y0', 'x1', 'y1']) {
        assert.equal(typeof c[f], 'number', `bbox.${f} present`); // data the v226 bug dropped
      }
      assert.ok(
        c.x0 >= 0 && c.x1 < 40 && c.y0 >= 0 && c.y1 < 40 && c.x1 >= c.x0 && c.y1 >= c.y0,
        'bbox valid',
      );
      assert.ok(c.bpx > 0, 'quadrant touches the image border');
    }
  });
  test('applyBg() reference is stable across edits (v227 fix)', () => {
    core.comps = [
      null,
      { bpx: 1000, merged: false, bg: false },
      { bpx: 300, merged: false, bg: false },
      { bpx: 100, merged: false, bg: false },
    ];
    core.bgTrim = 50; // bgRel = 0.35
    core.applyBg(true); // fresh -> reference 1000, threshold 350
    assert.equal(core.comps[1].bg, true);
    assert.equal(core.comps[2].bg, false);

    core.comps[1].bpx = 600; // an edit shrinks the biggest border
    core.applyBg(); // stable reference stays 1000
    assert.equal(core.comps[2].bg, false, 'unrelated cell must not flip to background');
    assert.equal(core.comps[1].bg, true);
  });
  test('snapshot/restore preserves every section field (v226 fix)', () => {
    core.labels = new Int32Array(16).fill(1);
    core.secColor = [null, [10, 20, 30]];
    core.secState = new Uint8Array([0, 1]);
    core.colored = new Uint8Array([0, 0]);
    core.comps = [
      null,
      { area: 100, bg: true, bpx: 42, cx: 5, cy: 6, h: 9, x0: 1, y0: 2, x1: 10, y1: 11, merged: false },
    ];
    core.snapshotSeg();
    core.comps[1].bpx = 999;
    core.comps[1].x0 = -1;
    core.comps[1].x1 = -1;
    core.comps[1].area = 0;
    core.restoreSnap();
    const c = core.comps[1];
    assert.equal(c.bpx, 42, 'bpx restored (dropped before the fix)');
    assert.equal(c.x0, 1);
    assert.equal(c.y0, 2);
    assert.equal(c.x1, 10);
    assert.equal(c.y1, 11);
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
    core.W = 40;
    core.H = 40;
    core.enhance = false;
    core.gray = plusGray(40, 40);
    core.segment();
    assert.equal(realComps().length, 4);
  });
  // ---- From the design pass ----
  test('labels sit inside the section even when its centroid does not (C-shape)', () => {
    // 30x30: ink everywhere except a thick "C" of label 0 (fillable)
    const W = 30,
      H = 30,
      lab = new Int32Array(W * H).fill(-1);
    const inC = (x, y) => x >= 3 && x < 27 && y >= 3 && y < 27 && !(x >= 11 && y >= 11 && y < 19);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inC(x, y)) lab[y * W + x] = 0;
    core.W = W;
    core.H = H;
    core.labels = lab;
    core.labelCells();
    core.labelPts = null;
    const c = core.comps[1];
    const at = (x, y) => core.labels[Math.floor(y) * W + Math.floor(x)];
    assert.notEqual(at(c.cx, c.cy), 1, 'fixture: centroid falls outside the C');
    const p = core.labelPos(1);
    assert.equal(at(p.x, p.y), 1, 'label point is inside the section');
    assert.ok(p.r >= 3, `inscribed radius ${p.r}`);
    assert.ok(p.aw >= 6, `available width ${p.aw}`);
  });
}

// ---- from v303.test.mjs ----
// v303: a small picture of the person's own (a page downloaded at 400-800 pixels) is enlarged before its sections are
// found, so lines that ran together at the small size come apart; Min section size and the specks cleared are measured
// on the picture as it came; the "tiny fragments" warning counts only fragments that are in the guide.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  // N x N rings drawn smoothly (each pixel the share of it under ink, as a downloaded picture has them): lines lw wide
  // with gaps gap wide between them
  function rings(N, lw, gap) {
    const g = new Uint8Array(N * N),
      c = N / 2;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let ink = 0;
        for (let s = 0; s < 16; s++) {
          const xx = x + ((s % 4) + 0.5) / 4,
            yy = y + (((s / 4) | 0) + 0.5) / 4,
            r = Math.hypot(xx - c, yy - c);
          if (r % (lw + gap) < lw && r < c - 2) ink++;
        }
        g[y * N + x] = Math.round(255 - (255 * ink) / 16);
      }
    return g;
  }
  const find = (g, W, H, k) => {
    core.srcK = k;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.segment();
    core.applyBg(true);
    return core.countedList().length;
  };
  // a 300 x 300 page: a black frame 30 wide round a white middle split by a plus (about a third of it ink), with holes
  // in the frame
  function framed(hole) {
    const W = 300,
      F = 30,
      g = new Uint8Array(W * W).fill(255);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++) {
        const inFrame = x < F || y < F || x >= W - F || y >= W - F,
          plus = Math.abs(x - W / 2) < 2 || Math.abs(y - W / 2) < 2;
        if (inFrame || plus) g[y * W + x] = 0;
      }
    // holes on a grid in the frame (white specks in the ink), clear of its edges
    let n = 0;
    for (let y = 3; y < W - 3 - hole; y += 7)
      for (let x = 3; x < W - 3 - hole; x += 7) {
        if (!(x + hole < F - 2 || y + hole < F - 2 || x >= W - F + 2 || y >= W - F + 2)) continue;
        for (let dy = 0; dy < hole; dy++) for (let dx = 0; dx < hole; dx++) g[(y + dy) * W + x + dx] = 255;
        n++;
      }
    return { g, W, n };
  }
  test('rings 3 pixels apart run together at their own size and come apart enlarged 3 times', () => {
    const N = 120,
      g = rings(N, 1.2, 1.6);
    const small = find(g, N, N, 1);
    const big = find(core.grayUp(g, N, N, N * 3, N * 3), N * 3, N * 3, 3);
    assert.ok(small <= 2, 'at their own size: ' + small);
    assert.ok(big >= 18 && big <= 21, 'enlarged, a section between each two rings: ' + big);
    core.srcK = 1;
  });
  test('grayUp: a flat grey stays flat, an edge stays within black and white, and the size is the one asked', () => {
    const flat = core.grayUp(new Uint8Array(20 * 10).fill(137), 20, 10, 53, 27);
    assert.equal(flat.length, 53 * 27);
    assert.ok(flat.every((v) => v === 137));
    // a hard edge: Catmull-Rom overshoots it, kept to 0-255
    const e = new Uint8Array(10 * 4);
    for (let y = 0; y < 4; y++) for (let x = 5; x < 10; x++) e[y * 10 + x] = 255;
    const u = core.grayUp(e, 10, 4, 40, 16);
    assert.equal(u[0], 0);
    assert.equal(u[39], 255);
    // left to right along a row: never lighter, then darker again by more than the overshoot kept in range
    const row = Array.from(u.subarray(40 * 8, 40 * 8 + 40));
    for (let i = 1; i < row.length; i++) assert.ok(row[i] >= row[i - 1] - 30, 'row ' + row.join());
  });
  test('Min section size is measured on the picture as it came: enlarged 2 times, 4 times the pixels', () => {
    core.srcK = 1;
    const a = core.minPx(50);
    core.srcK = 2;
    assert.equal(core.minPx(50), Math.round(2 * Math.pow(200, 0.5) * 4), 'four times as many pixels');
    assert.equal(a, Math.round(2 * Math.pow(200, 0.5)));
    core.srcK = 1;
  });
  test('the "tiny fragments" warning: not for specks Min section size leaves out, still for fragments in the guide', () => {
    core.enhance = false;
    // 2 x 2 specks (4 pixels): under Min section size, left out, so the page is fine
    const a = framed(2);
    find(a.g, a.W, a.W, 1);
    assert.ok(core.comps.filter((c) => c && !c.merged).length > a.n * 0.8, 'the specks are found');
    assert.equal(core.segWarn.ok, true, 'no warning: ' + JSON.stringify(core.segWarn));
    // 4 x 4 fragments (16 pixels): over Min section size, so in the guide: the warning, as before
    const b = framed(4);
    find(b.g, b.W, b.W, 1);
    assert.equal(core.segWarn.code, 'noisy');
    core.enhance = true;
  });
  test('boxBlur (now by running sums) gives exactly what the 3 x 3 box did, edges and all', () => {
    for (const [W, H] of [
      [37, 23],
      [5, 4],
      [1, 7],
      [200, 3],
    ]) {
      let s = 7;
      const g = new Uint8Array(W * H).map(() => (s = (s * 16807) % 2147483647) & 255);
      const old = new Uint8Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let t = 0,
            c = 0;
          for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++)
            for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) {
              t += g[yy * W + xx];
              c++;
            }
          old[y * W + x] = (t / c + 0.5) | 0;
        }
      core.W = W;
      core.H = H;
      assert.deepEqual(Array.from(core.boxBlur(g, 1)), Array.from(old), W + 'x' + H);
    }
  });
}

// ---- from v304-photo.test.mjs ----
// v304 (Photo pattern and photos read in): a picture is shrunk in steps no larger than 16 million pixels, each freed
// as the next is drawn (a step past Safari's canvas limit on iPad came out blank); the Photo pattern works out its
// table of colour differences once per laying, shared by the marker choice and the suggested count. The browser
// tests (e2e/v304-photo.test.mjs) cover the photo through crop, turn, tilt and straighten, its size limits, late
// photos, Palette › From photo's picks and a photo with no colour.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  // drawShrunk with canvases that only record their sizes (the harness has no real canvas)
  let canvasHook = null;
  const base = createApp().document,
    doc = new Proxy(base, {
      get: (t, k) =>
        k === 'createElement'
          ? (tag) => (tag === 'canvas' && canvasHook ? canvasHook() : t.createElement(tag))
          : t[k],
    }),
    shrinkApp = createApp({ document: doc });
  function shrinkRun(sw, sh, w, h) {
    const made = [],
      sizes = [];
    let last = null;
    canvasHook = () => {
      const c = {
        width: 0,
        height: 0,
        // (each step's size as it is drawn: it is freed, set to 0, afterwards)
        getContext: () => ({ drawImage: () => sizes.push([c.width, c.height]) }),
      };
      made.push(c);
      return c;
    };
    const img = { naturalWidth: sw, naturalHeight: sh, width: sw, height: sh },
      dest = { drawImage: (src) => (last = src) };
    try {
      shrinkApp.drawShrunk(dest, img, w, h);
    } finally {
      canvasHook = null;
    }
    return { made, sizes, last: { w: last.width } };
  }
  test('a 108-megapixel photo is shrunk in steps of at most 16 million pixels, each one freed', () => {
    const r = shrinkRun(12000, 9000, 1600, 1200);
    assert.ok(r.sizes.length >= 1);
    for (const [w, h] of r.sizes) assert.ok(w * h <= 16e6, 'step ' + w + 'x' + h + ' is over the limit');
    // (v303: its first half was 6000 x 4500 = 27 million pixels)
    for (const c of r.made) assert.equal(c.width * c.height, 0, 'every step canvas is freed');
    // (the last step was drawn to the picture before it was freed: its size then is the last recorded)
    const lw = r.sizes[r.sizes.length - 1][0];
    assert.ok(lw >= 1600 && lw < 3200, 'the last step is less than twice the size wanted: ' + lw);
  });
  test('a 12-megapixel photo is still halved as before', () => {
    const r = shrinkRun(4032, 3024, 1000, 750);
    assert.deepEqual(r.sizes, [
      [2016, 1512],
      [1008, 756],
    ]);
    assert.equal(r.last.w, 0, 'drawn from the last step (freed since)');
  });
  test('the Photo pattern works out its colour differences once for the marker choice and the suggested count', () => {
    const app = createApp(),
      core = app.__mstest,
      pool = [
        { mkey: 'A', lab: [60, 10, 0] },
        { mkey: 'B', lab: [60, -5, 9] },
        { mkey: 'C', lab: [40, 0, -20] },
      ],
      t = [
        { l: 1, lab: [60, 9, 0], w: 1 },
        { l: 2, lab: [41, 0, -19], w: 2 },
      ];
    const a = core.photoPrepDist(t, pool);
    assert.ok(a.D && a.D.length === a.pr.targets.length * a.pr.pool.length);
    assert.equal(core.photoPrepDist(t, pool), a, 'the same targets and markers: the same table');
    assert.notEqual(core.photoPrepDist(t.slice(), pool), a, 'other targets: worked out afresh');
    // and the choice is the same as before
    assert.deepEqual([...core.photoPick(t, pool, 2, false).chosen.map((m) => m.mkey)].sort(), ['A', 'C']);
  });
}

// ---- from v304-segmentation.test.mjs ----
// v304 (sections): a section picked to Merge is let go when the sections are found again; the page's margin merged into
// a section keeps it the page; table pieces left out because of the page found in a photo are saved as left out, worked
// out when saving (so an Undo can't lose them); a Split or Add stroke cuts the section it runs through furthest, so one
// begun on the outline works; a very dense page has its specks saved as part of the lines, so the guide can be opened
// again (never anything with a marker, a tick, a pin or a tap that kept it).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const desc = () => [...core.comps].map((c, l) => (c && !c.merged ? { l, ...c } : null)).filter(Boolean);
  // a guide's saved secStates (a built guide is needed to save: one with no markers will do)
  const saved = () => {
    core.assignData = { assign: {}, order: [], N: 0 };
    const d = core.currentDesignObj(false, true);
    core.assignData = null;
    return d.payload;
  };
  // the harness's section map: raw RGBA after 'data:image/x-mslabels;w,h,'
  const mapLabels = (url) => {
    const m = /^data:image\/x-mslabels;(\d+),(\d+),(.*)$/.exec(url),
      b = Buffer.from(m[3], 'base64'),
      out = new Set();
    let hi = 0;
    for (let j = 0; j < b.length; j += 4) {
      const v = b[j] | (b[j + 1] << 8) | (b[j + 2] << 16);
      if (v) {
        out.add(v - 1);
        if (v - 1 > hi) hi = v - 1;
      }
    }
    return { n: out.size, hi, has: (l) => out.has(l) };
  };
  // A photo of a page on a table: dark table, a bright page with a band of ink round it, a square drawn on it, and a
  // little piece of the table cut off at a corner by a line (it touches the edge, but too little to be background by
  // the edge rule: it is background only because it lies outside the page)
  function pagePhoto() {
    const W = 200,
      H = 200,
      gray = new Uint8Array(W * H).fill(90),
      lab = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x,
          inPage = x >= 20 && x < 180 && y >= 20 && y < 180;
        if (inPage) gray[p] = 245;
        const band = x >= 18 && x < 182 && y >= 18 && y < 182 && !inPage,
          sq = x >= 60 && x < 140 && y >= 60 && y < 140 && !(x >= 62 && x < 138 && y >= 62 && y < 138),
          cut = Math.abs(x + y - 12) <= 1;
        lab[p] = band || sq || cut ? -1 : 0;
      }
    core.W = W;
    core.H = H;
    core.gray = gray;
    core.labels = lab;
    core.bgTrim = 50;
    core.labelCells();
    const cs = desc();
    return {
      page: cs.find((c) => c.page).l,
      sliver: cs.find((c) => c.bpx > 0 && c.area < 200).l,
      inner: cs.find((c) => !c.bg && c.area > 3000 && c.area < 7000).l,
    };
  }
  // a page of tiny specks (2 x 2 paper cells in a grid of 1-pixel lines) beside two big sections
  function denseSpecks(S) {
    const W = S,
      H = S,
      lab = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const big = x < 60,
          edge = x === 60 || x === 61 || (y === 100 && big);
        lab[y * W + x] = edge ? -1 : big ? 0 : x % 3 === 0 || y % 3 === 0 ? -1 : 0;
      }
    core.W = W;
    core.H = H;
    core.labels = lab;
    core.gray = new Uint8Array(W * H).fill(255);
    core.minPos = 30;
    core.labelCells();
    core.secState = new Uint8Array(core.comps.length);
    core.colored = new Uint8Array(core.comps.length);
  }
  test('a table piece left out because of the page is saved as left out, and still is after an Undo', () => {
    const s = pagePhoto();
    assert.equal(core.comps[s.sliver].bg, true, 'background on screen');
    let ss = saved().secStates;
    assert.equal(ss[s.sliver], 2, 'saved as left out');
    assert.equal(ss[s.page], 2, 'the page too');
    // a Split stroke that didn't divide anything is taken back from its Undo step, which doesn't know the page rule
    core.snapshotSeg();
    core.restoreSnap();
    ss = saved().secStates;
    assert.equal(ss[s.sliver], 2, 'still left out after the Undo step');
    assert.equal(ss[s.inner], undefined, 'the drawing is not');
  });
  test('the page margin merged into a section keeps that section the page (and its background)', () => {
    const s = pagePhoto();
    core.mergeCellsSnap(s.inner, s.page);
    assert.equal(core.comps[s.inner].page, true);
    core.applyBg();
    assert.equal(
      core.comps[s.sliver].bg,
      true,
      'the table piece is still background after the page rule runs again',
    );
  });
  test('a section picked to merge is let go when the sections are found again', () => {
    core.W = 40;
    core.H = 40;
    core.enhance = true;
    const g = new Uint8Array(1600).fill(255);
    for (let i = 0; i < 40; i++) {
      g[20 * 40 + i] = 0;
      g[i * 40 + 20] = 0;
    }
    core.gray = g;
    core.segment();
    core.mergeSel = 2;
    core.segment();
    assert.equal(core.mergeSel, -1);
  });
  test('a stroke is for the section it runs through furthest, lines not counted', () => {
    // three columns of paper between two ink lines: x 0-9 | 10-11 ink | 12-37 | 38-39 ink | 40-49
    const W = 50,
      H = 20,
      lab = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) lab[y * W + x] = (x >= 10 && x < 12) || (x >= 38 && x < 40) ? -1 : 0;
    core.W = W;
    core.H = H;
    core.labels = lab;
    core.gray = new Uint8Array(W * H).fill(255);
    core.labelCells();
    const at = (x, y) => core.labels[y * W + x];
    // begun on the line, across the middle column and a little way into the next
    assert.equal(
      core.strokeSection([
        { x: 10, y: 10 },
        { x: 42, y: 10 },
      ]),
      at(20, 10),
    );
    // begun a pixel into the left column
    assert.equal(
      core.strokeSection([
        { x: 9, y: 5 },
        { x: 36, y: 5 },
      ]),
      at(20, 5),
    );
    // only on the line: none
    assert.equal(
      core.strokeSection([
        { x: 10, y: 1 },
        { x: 11, y: 18 },
      ]),
      0,
    );
  });
  test('a very dense page: the specks are saved as part of the lines until 90,000 sections are left', () => {
    denseSpecks(960); // about 300 x 300 = 90,000+ specks
    const live = desc().length;
    assert.ok(live > 95000, 'sections: ' + live);
    const bigs = desc()
      .filter((c) => c.area > 1000)
      .map((c) => c.l);
    assert.equal(bigs.length, 2);
    // a speck kept in the guide by a tap, and one ticked, are never folded; nor the highest-numbered ones last
    const specks = desc()
        .filter((c) => c.area < 10)
        .map((c) => c.l),
      top = specks[specks.length - 1],
      low = specks[0];
    core.secState[top] = 1;
    core.colored[specks[specks.length - 2]] = 1;
    const m = mapLabels(saved().lmap);
    assert.equal(m.n, 90000, 'sections saved: ' + m.n);
    for (const l of bigs) assert.ok(m.has(l), 'big section ' + l + ' kept');
    assert.ok(m.has(top), 'kept by a tap');
    assert.ok(m.has(specks[specks.length - 2]), 'ticked');
    assert.ok(m.has(low), 'the lowest numbers stay');
    // (the guide's own numbers are kept when it opens: no more than twice as high as how many there are)
    assert.ok(m.hi <= m.n * 2 + 64, 'highest ' + m.hi);
    // the sections on screen are as they were
    assert.equal(desc().length, live);
    // which specks go depends on Min section size, so the saved map is made again when it changes
    core.minPos = 0;
    const m0 = mapLabels(saved().lmap);
    assert.ok(m0.n > 90000, 'nothing smaller than the smallest Min: ' + m0.n);
    core.minPos = 30;
  });
  test('a page with fewer sections is saved exactly as it is', () => {
    denseSpecks(300);
    const live = desc().length;
    assert.ok(live < 90000);
    assert.equal(core.foldSet(), null);
    assert.equal(mapLabels(saved().lmap).n, live);
  });
  test('Build is stopped when the sections left after folding would be more than a guide keeps', () => {
    denseSpecks(960);
    // Min section size at its smallest: the specks are sections in the guide, nothing to fold
    core.minPos = 0;
    const d = core.denseCount(0);
    assert.ok(d.cnt > 90000 && d.kept > 90000, JSON.stringify(d));
    const d30 = core.denseCount(30);
    assert.ok(d30.cnt <= 3000 && d30.kept === 90000, JSON.stringify(d30));
    core.minPos = 30;
  });
}

// ---- from v305-frame.test.mjs ----
// v305 (sections): a frame drawn round the picture on the same paper. On a fresh scan, the paper inside it is left
// white (as a page without a frame leaves its paper), and so is anything whose middle is outside the frame (a
// watermark's letters); Colour it brings it back. The rule (findFrame, 10-segment): the biggest section is 8% of the
// picture or more, its box spans half the width and height, each edge of its box is at least 75% that section, and
// the sections outside its box add up to 0.5% of the picture at most. Pages drawn here in code: a lone figure in a
// frame triggers it; a framed sky over a ruled horizon, a board in the middle of a drawing and art breaking out of
// its frame don't. The flag goes through merges and the Undo snapshots. (Colour it, and guides opened again: e2e/v305-frame)
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const W = 800,
    H = 1000;
  // a W x H white page with ink where ink(x, y), its sections found as on a fresh scan
  function page(ink) {
    const g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
    core.srcK = 1;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.bgTrim = 50;
    core.minPos = 20;
    core.assign.sfmode = 'review';
    core.assignData = null;
    core.segment();
    return core.countedList();
  }
  const ring =
    (cx, cy, r, w = 2) =>
    (x, y) =>
      Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const box =
    (x0, y0, x1, y1, w = 2) =>
    (x, y) =>
      x >= x0 - w &&
      x <= x1 + w &&
      y >= y0 - w &&
      y <= y1 + w &&
      (Math.abs(x - x0) <= w || Math.abs(x - x1) <= w || Math.abs(y - y0) <= w || Math.abs(y - y1) <= w);
  // a frame 60 px in from the page's edges, 4 px thick
  const frame = (x, y) => {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    return e >= 60 && e < 64;
  };
  const any =
    (...fs) =>
    (x, y) =>
      fs.some((f) => f(x, y));
  const big = () => {
    let b = 0;
    for (let l = 1; l < core.comps.length; l++) {
      const c = core.comps[l];
      if (c && !c.merged && (!b || c.area > core.comps[b].area) && !c.bpx) b = l;
    }
    return b;
  };
  const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);
  // a lone figure: a flower of rings and a cross in the middle; a watermark's "O" below the frame
  const figure = any(
    ring(400, 480, 200),
    ring(400, 480, 120),
    (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
  );
  const watermark = ring(700, 970, 18);
  test('a lone figure in a frame: the paper inside is left white, and the watermark outside it; the figure is all there', () => {
    const cl = page(any(frame, figure, watermark));
    const p = big(),
      c = core.comps[p];
    assert.ok(c.area > 0.25 * W * H, 'the paper inside the frame is the biggest: ' + c.area);
    assert.equal(c.framed, true, 'found as a frame');
    assert.equal(c.bg, true);
    assert.ok(!cl.includes(p), 'left white');
    assert.equal(core.frameLeft(), p, 'the line to Colour it shows');
    // the watermark's "O" (its middle below the frame) is left white too
    const wm = core.labels[970 * W + 700];
    assert.ok(wm > 0 && core.comps[wm].bg && !cl.includes(wm), 'the watermark');
    // the figure's eight pieces are sections
    assert.equal(cl.length, 8, cl.length + ' sections');
    // saved as left out (so a guide opened again has it white too)
    core.assignData = { assign: {}, order: [], N: 0 };
    const ss = core.currentDesignObj(false, true).payload.secStates;
    assert.equal(ss[p], 2);
    assert.equal(ss[wm], 2);
    core.assignData = null;
  });
  test('not a frame: a framed sky over a ruled horizon, a board in the middle of a drawing, art breaking out of the frame', () => {
    // the sky (the biggest) spans the frame, but the ground below the horizon is outside its box
    page(
      any(
        frame,
        (x, y) => Math.abs(y - 600) < 2 && x > 60 && x < W - 60,
        ring(600, 220, 60),
        box(150, 700, 350, 880),
      ),
    );
    assert.equal(framed(), -1, 'sky over a horizon');
    // a big board with a drawing round it (no frame): the drawing is outside the board's box
    page(
      any(
        box(200, 200, 600, 800),
        ring(100, 100, 60),
        ring(700, 120, 60),
        ring(100, 900, 60),
        ring(700, 900, 60),
        (x, y) => Math.abs(x - 400) < 2 && y > 200 && y < 800,
      ),
    );
    const b = big();
    assert.ok(core.comps[b].area > 0.08 * W * H, 'the board is big enough');
    assert.equal(framed(), -1, 'board in the middle');
    // a frame with a figure that breaks out of it on the left
    page(any(frame, figure, box(20, 300, 300, 700)));
    assert.equal(framed(), -1, 'art breaking out of the frame');
    // and plain paper with no frame: as before
    page(figure);
    assert.equal(framed(), -1);
    // (the same figure in a frame does count)
    page(any(frame, figure));
    assert.ok(framed() > 0);
  });
  test('the frame’s paper keeps its flag through a merge and the Undo snapshots', () => {
    const cl = page(any(frame, figure));
    const p = framed(),
      q = cl[0];
    // merged into another section: that one is the paper now
    core.mergeCellsSnap(q, p);
    assert.equal(core.comps[q].framed, true);
    core.restoreSnap();
    assert.equal(core.comps[p].framed, true, 'the Undo snapshot keeps it');
    assert.equal(core.comps[q].framed, undefined);
    core.applyBg();
    assert.equal(core.comps[p].bg, true, 'still white after the background is worked out again');
  });
}

// ---- from v306-frame.test.mjs ----
// v306 (sections): the paper inside a drawn frame is saved with the guide (payload `frame`: its section number, left
// white or brought back), so a guide opened again has its line to Colour it. It follows a merge (the section the
// paper went into) and the Undo snapshots; a page without a frame saves none. Opening, Colour it's Undo step and the
// guides saved before: e2e/v306-frame.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const W = 800,
    H = 1000;
  function page(ink) {
    const g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
    core.srcK = 1;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.bgTrim = 50;
    core.minPos = 20;
    core.assign.sfmode = 'review';
    core.assignData = null;
    core.segment();
    return core.countedList();
  }
  const ring =
    (cx, cy, r, w = 2) =>
    (x, y) =>
      Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const frame = (x, y) => {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    return e >= 60 && e < 64;
  };
  const any =
    (...fs) =>
    (x, y) =>
      fs.some((f) => f(x, y));
  const figure = any(
    ring(400, 480, 200),
    ring(400, 480, 120),
    (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
  );
  const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);
  // the guide as saved (with section edits not built, so it needn't be built here), and as shared
  const saved = (share) => {
    core.assignData = { assign: {}, order: [], N: 0 };
    const d = core.currentDesignObj(share, true);
    core.assignData = null;
    return d.payload;
  };
  test('the paper inside a frame is saved with the guide, left white or brought back; a page without one saves none', () => {
    page(any(frame, figure));
    const p = framed();
    assert.ok(p > 0, 'the frame is found');
    assert.equal(saved().frame, p, 'left white');
    assert.equal(saved(true).frame, p, 'in a guide file to share too');
    // brought back as a section (Colour it on Edit sections): still the frame's paper
    core.secState[p] = 1;
    assert.equal(saved().frame, p, 'brought back');
    // (in its place among the rest: after upk, before the section settings)
    const k = Object.keys(saved());
    assert.equal(k[k.indexOf('upk') + 1], 'frame');
    page(figure);
    assert.equal(framed(), -1);
    assert.equal(saved().frame, undefined, 'no frame');
  });
  test('the saved frame follows a merge and the Undo snapshots', () => {
    const cl = page(any(frame, figure));
    const p = framed(),
      q = cl[0];
    core.mergeCellsSnap(q, p);
    assert.equal(saved().frame, q, 'the section the paper went into');
    core.restoreSnap();
    assert.equal(saved().frame, p, 'back after Undo');
  });
}

// ---- from v308-intake.test.mjs ----
// v308 (getting a picture in): the warnings for a hatched page and a page coloured in already; a frame with corner
// ornaments; Auto crop to the largest ruled rectangle; "Ignore faint grey marks", offered only when the ink splits
// clearly into dark outlines and pale marks; and the paper's tint, used to find a page under a warm lamp. Pages are
// drawn here in code. (A tilt's corners, Straighten's corners, Merge and the browser side: e2e/v308-intake)
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const W = 800,
    H = 1000;
  // a W x H white page, grey g(x, y) where it's drawn (0 black, 255 paper), its sections found as on a fresh picture
  function page(ink, opts = {}) {
    const g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = ink(x, y);
        if (v !== false && v != null) g[y * W + x] = v === true ? 0 : v;
      }
    core.srcK = 1;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.bgTrim = 50;
    core.minPos = 20;
    core.enhance = true;
    core.adaptC = 9;
    core.faintCut = opts.faintCut || 0;
    core.srcColour = null;
    core.assign.sfmode = 'review';
    core.assignData = null;
    core.segment();
    return core.countedList();
  }
  const ring =
    (cx, cy, r, w = 2) =>
    (x, y) =>
      Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const box =
    (x0, y0, x1, y1, w = 2) =>
    (x, y) =>
      x >= x0 - w &&
      x <= x1 + w &&
      y >= y0 - w &&
      y <= y1 + w &&
      (Math.abs(x - x0) <= w || Math.abs(x - x1) <= w || Math.abs(y - y0) <= w || Math.abs(y - y1) <= w);
  const any =
    (...fs) =>
    (x, y) => {
      for (const f of fs) {
        const v = f(x, y);
        if (v !== false && v != null) return v;
      }
      return false;
    };
  const grey = (v, f) => (x, y) => (f(x, y) ? v : false);
  // a frame line `e0` to `e0 + 4` px in from the page's edges
  const frameAt = (e0) => (x, y) => {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    return e >= e0 && e < e0 + 4;
  };
  const figure = any(
    ring(400, 480, 200),
    ring(400, 480, 120),
    (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
  );
  // a double frame (lines 40 and 60 px in) with a circle at each corner, cutting the strip between the lines in four
  const corners = any(
    ring(52, 52, 22, 2),
    ring(W - 53, 52, 22, 2),
    ring(52, H - 53, 22, 2),
    ring(W - 53, H - 53, 22, 2),
  );
  const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);
  // ---- Auto crop ----
  // a screenshot: a grey browser bar with "text" across the top, the page's own frame, tab dots at the bottom
  const bar = (x, y) => (y < 70 ? (y > 25 && y < 45 && x % 40 < 14 && x > 30 && x < 500 ? 0 : 200) : false);
  const dots = any(
    ring(250, 960, 8, 3),
    ring(325, 960, 8, 3),
    ring(400, 960, 8, 3),
    ring(475, 960, 8, 3),
    ring(550, 960, 8, 3),
  );
  // ---- faint grey marks ----
  // pale grey (210) rings, as a watermark's letters, on the paper round the figure
  const pale = any(
    grey(210, ring(650, 150, 40, 4)),
    grey(210, ring(150, 150, 40, 4)),
    grey(210, ring(650, 850, 40, 4)),
  );
  // ---- hatched and coloured pages ----
  // a made-up set of sections: `small` under 3x Min section size (10 px here), `big` over it, `specks` under it
  function sections(small, big, specks) {
    const px = 1000000,
      L = new Int32Array(px).fill(1);
    for (let i = 0; i < 100000; i++) L[i] = -1;
    core.srcK = 1;
    core.minPos = 30;
    core.W = px;
    core.H = 1;
    core.labels = L;
    const comps = [null];
    for (let i = 0; i < small; i++) comps.push({ area: 25, merged: false });
    for (let i = 0; i < big; i++) comps.push({ area: 2000, merged: false });
    for (let i = 0; i < specks; i++) comps.push({ area: 4, merged: false });
    core.comps = comps;
  }
  // ---- the paper's tint ----
  // RGBA pixels: paper in colour p, with a share `ink` black and a share `col` magenta
  function px(p, ink = 0.1, col = 0) {
    const n = 40000,
      d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const c = i % 100 < ink * 100 ? [20, 20, 20] : i % 100 < (ink + col) * 100 ? [220, 40, 200] : p;
      d.set([c[0], c[1], c[2], 255], i * 4);
    }
    return { d, n };
  }
  // ---- frames with corner ornaments ----
  test('a double frame with corner circles is found: the strips between its lines and the circles are the frame’s own', () => {
    const cl = page(any(frameAt(40), frameAt(60), corners, figure));
    const p = framed();
    assert.ok(p > 0, 'found as a frame');
    assert.ok(core.comps[p].area > 0.4 * W * H, 'the paper inside the inner line');
    assert.ok(!cl.includes(p), 'left white');
    // and a double frame without the circles, a single frame with them: found, as before
    page(any(frameAt(40), frameAt(60), figure));
    assert.ok(framed() > 0, 'double frame');
    page(any(frameAt(60), corners, figure));
    assert.ok(framed() > 0, 'single frame with corner circles');
  });
  test('still not a frame: art breaking out of it, or a board in the middle of a drawing', () => {
    page(any(frameAt(60), figure, box(20, 300, 300, 700)));
    assert.equal(framed(), -1, 'art breaking out on the left');
    page(
      any(
        box(200, 200, 600, 800),
        ring(100, 100, 60),
        ring(700, 120, 60),
        ring(100, 900, 60),
        ring(700, 900, 60),
        (x, y) => Math.abs(x - 400) < 2 && y > 200 && y < 800,
      ),
    );
    assert.equal(framed(), -1, 'board in the middle');
  });
  test('Auto crop: to the inside of the page’s own frame, padded 3%, in a screenshot with the browser round it', () => {
    page(any(bar, dots, box(100, 120, 700, 900, 2), figure));
    const b = core.autoCropBox();
    assert.ok(b && b.ruled, 'the ruled rectangle');
    // (the paper inside the frame, 103..697 x 123..897, and 3% of the picture round it)
    assert.ok(Math.abs(b.x0 - (103 - 24)) <= 2 && Math.abs(b.x1 - (697 + 24)) <= 2, `x ${b.x0}..${b.x1}`);
    assert.ok(Math.abs(b.y0 - (123 - 30)) <= 2 && Math.abs(b.y1 - (897 + 30)) <= 2, `y ${b.y0}..${b.y1}`);
  });
  test('Auto crop: a board in the middle of a drawing isn’t taken for the page; a page with ink to its edges has nothing to trim', () => {
    page(
      any(
        box(200, 200, 600, 800),
        ring(100, 100, 60),
        ring(700, 120, 60),
        ring(100, 900, 60),
        ring(700, 900, 60),
        (x, y) => Math.abs(x - 400) < 2 && y > 200 && y < 800,
      ),
    );
    const b = core.autoCropBox();
    assert.equal(b.ruled, false, 'where the ink is, as before');
    assert.ok(b.x0 < 50 && b.x1 > 750, 'the corner circles are kept');
    // ink right to the edges
    page(any(box(8, 8, W - 9, H - 9, 2), figure));
    const c = core.autoCropBox();
    assert.ok(c.x1 - c.x0 >= 0.97 * W && c.y1 - c.y0 >= 0.97 * H, 'nothing to trim');
  });
  test('Ignore faint grey marks: offered on a clear split, and ticked, the pale marks are paper and the figure is whole', () => {
    const before = page(any(figure, pale));
    const T = core.faintOffer;
    assert.ok(T >= 160 && T <= 210, 'offered: ' + T);
    // the pale rings are outlines as they are: each ring's inside is a section
    const inside = () => core.labels[150 * W + 650];
    assert.ok(core.comps[inside()].area < 6000, 'a pale ring’s inside is a section of its own');
    const after = page(any(figure, pale), { faintCut: T });
    assert.equal(
      core.labels[150 * W + 720],
      core.labels[150 * W + 650],
      'the pale ring is gone: paper through it',
    );
    assert.equal(after.length, 8, 'the figure’s eight pieces: ' + after.length);
    assert.ok(before.length > after.length);
  });
  test('Ignore faint grey marks: not offered for clean line art, nor for a page drawn all in mid-grey', () => {
    page(figure);
    assert.equal(core.faintOffer, 0, 'clean line art');
    // the outlines mid-grey (120) and pale marks beside them: no dark outlines to keep
    page(any(grey(120, figure), pale));
    assert.equal(core.faintOffer, 0, 'mid-grey outlines');
    // pale marks a sliver of the ink: not a clear split
    page(any(figure, grey(210, ring(650, 150, 10, 1))));
    assert.equal(core.faintOffer, 0, 'too few pale marks');
  });
  test('a hatched page: 200 sections or more, over half of them under 3x Min section size', () => {
    core.srcColour = null;
    sections(720, 280, 0);
    assert.equal(core.segQuality().code, 'hatched', 'a hatched page, 72% slivers');
    sections(290, 710, 0);
    assert.equal(core.segQuality().ok, true, 'the most of any real page, 29%');
    sections(120, 60, 0);
    assert.equal(core.segQuality().ok, true, 'under 200 sections');
  });
  test('a page coloured in already: much of it coloured and broken into specks; checked only with the picture', () => {
    sections(10, 40, 1250);
    core.srcColour = 0.33;
    assert.equal(core.segQuality().code, 'coloured');
    core.srcColour = 0.004;
    assert.equal(core.segQuality().ok, true, 'a line-art page');
    core.srcColour = null;
    assert.equal(core.segQuality().ok, true, 'a guide opened again without its picture');
    core.srcColour = 0.33;
    sections(10, 400, 900);
    assert.equal(core.segQuality().ok, true, 'colour that isn’t specks');
    core.srcColour = null;
  });
  test('the paper’s tint: gains that make warm paper white, each at most x2; none for white paper', () => {
    const w = px([242, 209, 145]),
      g = core.paperGains(w.d, w.n, 1);
    assert.ok(g, 'warm paper');
    assert.ok(Math.abs(g[0] - 1) < 1e-6, 'red is the brightest');
    assert.ok(Math.abs(209 * g[1] - 242) < 1 && Math.abs(145 * g[2] - 242) < 1, g.join());
    const deep = core.paperGains(px([240, 150, 90]).d, 40000, 1);
    assert.equal(deep[2], 2, 'capped at x2');
    assert.equal(core.paperGains(px([246, 244, 240]).d, 40000, 1), null, 'near enough white');
  });
  test('how coloured a page is, the paper’s tint taken out: a warm line-art page is not; a coloured-in one is', () => {
    const warm = px([242, 209, 145]);
    assert.ok(core.colourShare(warm.d, warm.n) < 0.01, 'warm paper, black lines');
    const col = px([246, 244, 240], 0.1, 0.33);
    assert.ok(core.colourShare(col.d, col.n) > 0.3, 'a third coloured');
  });
}

// ---- from v308-output.test.mjs ----
// v308 (output): the photo's debris left out of what's printed and saved (outDebris), on synthetic pictures: the black
// band of a table along an edge, the next page's dashed edge and specks go; the drawing's own lines, open strokes that
// touch it and decorations away from the edges stay, and a clean drawing loses nothing. Save image's least code size.
{
  // a W x H picture: ink (-1) where ink(x, y), else section 1 (left) / 2 (right) inside the drawing's box, else
  // background (3, not coloured)
  function picture(W, H, ink, box) {
    const L = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const inBox = x > box[0] && x < box[2] && y > box[1] && y < box[3];
        L[y * W + x] = ink(x, y) ? -1 : inBox ? (x < (box[0] + box[2]) / 2 ? 1 : 2) : 3;
      }
    return L;
  }
  function load(t, W, H, L) {
    t.W = W;
    t.H = H;
    t.labels = L;
    t.comps = [
      null,
      { area: 1000, cx: 0, cy: 0 },
      { area: 1000, cx: 0, cy: 0 },
      { area: 1000, cx: 0, cy: 0, bg: true },
    ];
    const m = { mkey: 'Ohuhu:R46', hex: '#d98b8b', code: 'R46', brand: 'Ohuhu' };
    t.assignData = { assign: { 1: m, 2: m }, order: [1, 2], N: 2 };
    t.outDebrisReset();
  }
  // the drawing: a box (60..140 each way) with 4 px lines round it and down its middle
  const BOX = [64, 64, 136, 136];
  const drawing = (x, y) =>
    (x >= 60 && x <= 140 && y >= 60 && y <= 140 && (x < 64 || x > 136 || y < 64 || y > 136)) ||
    (x >= 98 && x <= 101 && y >= 60 && y <= 140);
  test('a clean drawing loses nothing to the debris clean-up', () => {
    const app = createApp(),
      t = app.__mstest;
    // an open stroke touching it, and a ring away from the edges, outside the drawing's box
    const ring = (x, y) => {
      const d = Math.hypot(x - 35, y - 35);
      return d > 8 && d < 12;
    };
    load(
      t,
      200,
      200,
      picture(
        200,
        200,
        (x, y) => drawing(x, y) || (y >= 99 && y <= 102 && x > 140 && x < 185) || ring(x, y),
        BOX,
      ),
    );
    assert.ok(t.outDebris() === null, 'nothing left out');
  });
  test('the band along an edge, a dashed page edge and specks are left out; the drawing and what touches it stay', () => {
    const app = createApp(),
      t = app.__mstest,
      W = 200,
      H = 200;
    const band = (x, y) => y < 22 && x > 10 && x < 190,
      // (the drawing's middle line runs up into the band, as the lines of Ben's page run into the table's shadow)
      up = (x, y) => x >= 98 && x <= 101 && y < 60,
      dash = (x, y) => x >= 194 && x <= 196 && y % 10 < 5 && y > 30 && y < 180,
      speck = (x, y) => x >= 20 && x <= 21 && y >= 170 && y <= 171,
      stroke = (x, y) => y >= 99 && y <= 102 && x > 140 && x < 185;
    const L = picture(
      W,
      H,
      (x, y) => drawing(x, y) || band(x, y) || up(x, y) || dash(x, y) || speck(x, y) || stroke(x, y),
      BOX,
    );
    load(t, W, H, L);
    const m = t.outDebris();
    assert.ok(m !== null && m !== undefined, 'something to leave out');
    const at = (x, y) => m[y * W + x];
    assert.equal(at(195, 50), 1, 'the dashed edge');
    assert.equal(at(20, 170), 1, 'a speck');
    assert.equal(at(50, 5), 1, 'the band, away from the drawing');
    assert.equal(at(150, 10), 1);
    // the drawing's lines, the line up to the band and the stroke touching it: all kept
    for (const [x, y] of [
      [62, 100],
      [100, 100],
      [138, 62],
      [100, 40],
      [100, 25],
      [170, 100],
    ])
      assert.equal(at(x, y), 0, `kept: ${x},${y}`);
    // nothing that isn't ink is ever marked
    for (let p = 0; p < W * H; p++) if (m[p]) assert.equal(L[p], -1);
  });
  test('a thick frame drawn round the page stays (a band along three or four edges is the drawing’s, not a table’s)', () => {
    const app = createApp(),
      t = app.__mstest,
      W = 200,
      H = 200;
    const frame = (x, y) => x < 20 || y < 20 || x >= 180 || y >= 180;
    load(
      t,
      W,
      H,
      picture(W, H, (x, y) => drawing(x, y) || frame(x, y), BOX),
    );
    assert.ok(t.outDebris() === null, 'nothing left out');
  });
  test('Save image: codes no smaller than 10 px on the image as saved, more on a wide one', () => {
    const app = createApp(),
      t = app.__mstest;
    t.W = 600;
    assert.equal(t.exportMinPx(1), 10);
    t.W = 2400;
    assert.equal(t.exportMinPx(1), 15);
    assert.equal(t.exportMinPx(0.5), 10);
  });
}

// ---- from v31812-edges.test.mjs ----
// v318.12: an edge-to-edge drawing keeps its edge shapes (bgRule 1, new guides only: a guide saved before opens with
// its background as it was), a page with a margin keeps its margin as background; and a sketchbook page photographed
// from above, whose only outline the finder could find was the drawing's, is built as taken rather than opening the
// corner handles. Fails on v318.11.
{
  // a page W x H: lines 3 px wide every `step` px; edge to edge (running off all four sides), or inside a frame with a
  // blank margin round it
  function page(W, H, step, margin) {
    const g = new Uint8Array(W * H).fill(250),
      m = margin || 0,
      h = step >> 1;
    for (let y = m; y < H - m; y++)
      for (let x = m; x < W - m; x++) {
        const line = (x - m + h) % step < 3 || (y - m + h) % step < 3,
          frame = m > 0 && (x < m + 3 || y < m + 3 || x >= W - m - 3 || y >= H - m - 3);
        if (line || frame) g[y * W + x] = 20;
      }
    return g;
  }
  function seg(g, W, H, rule) {
    const app = createApp(),
      t = app.__mstest,
      E = app.__eval;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    if (rule != null) t.styleVars.bgRule = rule;
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    const bg = [];
    for (let l = 1; l < t.comps.length; l++)
      if (t.comps[l] && !t.comps[l].merged && t.comps[l].bg) bg.push(l);
    return { t, E, bg };
  }
  test('a new guide takes bgRule 1; it is saved, and 2 is not a value', () => {
    const core = createApp().__mstest;
    core.assign.resetForNewPicture();
    assert.equal(core.styleVars.bgRule, 1);
    const f = [...core.styleFields].find((x) => x.key === 'bgRule');
    assert.equal(f.in, 'payload');
    assert.equal(f.check(1, f.def), 1);
    assert.equal(f.check(2, f.def), 0);
    core.styleVars.bgRule = 0;
    assert.equal(f.save(), undefined, 'a guide saved before saves as it was');
    core.styleVars.bgRule = 1;
    assert.equal(f.save(), 1);
  });
  test('an edge-to-edge drawing: no edge shape is background (bgRule 1); a guide saved before (0) as before', () => {
    const W = 600,
      H = 780,
      g = page(W, H, 70, 0);
    const now = seg(g, W, H, 1),
      was = seg(g, W, H, 0);
    assert.equal(now.t.bgEdgeAll, true);
    assert.deepEqual(now.bg, []);
    assert.ok(was.bg.length >= 3, `before: ${was.bg.length} edge shapes left out`);
  });
  test('a page with a margin keeps its margin as background (bgRule 1)', () => {
    const W = 600,
      H = 780,
      g = page(W, H, 70, 40);
    const r = seg(g, W, H, 1);
    assert.equal(r.t.bgEdgeAll, false);
    assert.equal(r.bg.length, 1, 'the margin');
  });
  test('pgJudge: an unsure outline that is the drawing’s is built as taken (none, drawing); the paper’s stays unsure', () => {
    const core = createApp().__mstest;
    const mk = (kind) => ({
      kind,
      q: [
        [80, 140],
        [430, 190],
        [410, 450],
        [30, 410],
      ],
      cover: [0.5, 0.5, 0.58, 0.67],
      fill: 0.92,
      touch: 0,
      step: 27,
      cross: 0,
      sharp: 1,
      sharpN: 0,
    });
    const d = mk('drawing'),
      p = mk('paper');
    core.pgJudge(d, 720, 540);
    core.pgJudge(p, 720, 540);
    assert.deepEqual([d.tier, d.why], ['none', 'drawing']);
    assert.deepEqual([p.tier, p.why], ['unsure', 'unclear']);
  });
  test('an edge-to-edge drawing: what a save works out as background matches (bgByEdge), and the Background slider leaves its edge shapes', () => {
    const W = 600,
      H = 780,
      r = seg(page(W, H, 70, 0), W, H, 1);
    const n = r.t.comps.length;
    for (let l = 1; l < n; l++) {
      const c = r.t.comps[l];
      if (!c || c.merged) continue;
      assert.equal(r.t.bgByEdge(c), !!c.bg && !c.page, 'section ' + l);
    }
    for (const trim of [0, 100]) {
      r.t.styleVars.bgTrim = trim;
      r.t.applyBg();
      const bg = [];
      for (let l = 1; l < n; l++) if (r.t.comps[l] && !r.t.comps[l].merged && r.t.comps[l].bg) bg.push(l);
      assert.deepEqual(bg, [], 'trim ' + trim);
    }
  });
  test('pgJudge: a finished page’s photo (opt.coloured) keeps the drawing’s outline as before', () => {
    const core = createApp().__mstest;
    const f = {
      kind: 'drawing',
      q: [
        [80, 140],
        [430, 190],
        [410, 450],
        [30, 410],
      ],
      cover: [0.5, 0.5, 0.58, 0.67],
      fill: 0.92,
      touch: 0,
      step: 27,
      cross: 0,
      sharp: 1,
      sharpN: 0,
    };
    core.pgJudge(f, 720, 540, { coloured: true });
    assert.deepEqual([f.tier, f.why], ['unsure', 'unclear']);
  });
}

// ---- from v31813-photo.test.mjs ----
// v318.13, taking a photo of a page: a new picture's Min section size is about 1 mm on the page (in the picture's own
// pixels, whatever size it came at; a small download keeps the old default); the coloured-page warning counts specks at
// the size it was tuned at, whatever Min section size is; a steep photo's note is in the warning box; the faint
// warning's tip names the control that's there; an unsure find on a busy surface starts its corner handles 3% in.
// Fails on v318.12.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const MM = (L) => Math.pow(L / 279.4, 2);
  // a synthetic segmentation: px pixels, `ink` of them ink, sections of the given areas
  function seg(t, px, ink, areas) {
    const L = new Int32Array(px).fill(1);
    for (let i = 0; i < ink && i < px; i++) L[i] = -1;
    t.W = px;
    t.H = 1;
    t.labels = L;
    const comps = [null];
    for (const a of areas) comps.push({ area: a, merged: false });
    t.comps = comps;
  }
  const fill = (n, a) => Array.from({ length: n }, () => a);
  // pixels in 1 mm² on a Letter page whose long side is L pixels

  test('Min section size for a new picture: about 1 mm on the page, at any size; small pictures keep the default', () => {
    const t = createApp().__mstest;
    t.srcK = 1;
    for (const [w, h] of [
      [1800, 2400],
      [3024, 4032],
      [2400, 1800],
    ]) {
      t.srcDims = { w, h };
      const pos = t.minPosAuto(),
        want = MM(Math.max(w, h));
      t.styleVars.minPos = pos;
      const got = t.minPx(pos);
      assert.ok(Math.abs(got / want - 1) < 0.06, `${w}x${h}: ${got.toFixed(1)} px for ${want.toFixed(1)}`);
      assert.match(t.minMmText(), /^about 1(\.0)? mm$/, t.minMmText());
    }
    // a picture too small for 1 mm to be over the old default's 10 px keeps the default, and none known too
    t.srcDims = { w: 600, h: 800 };
    assert.equal(t.minPosAuto(), t.MIN_DEF);
    t.srcDims = null;
    assert.equal(t.minPosAuto(), t.MIN_DEF);
    // a new picture follows it until Min section size is moved
    t.assign.resetForNewPicture();
    assert.equal(t.minAuto, true);
  });
  test('Min section size as an enlarged picture is worked on: the same size on the page (srcK)', () => {
    const t = createApp().__mstest;
    t.srcDims = { w: 1500, h: 2000 };
    t.srcK = 1;
    const a = t.minPx(t.minPosAuto());
    t.srcK = 2;
    const b = t.minPx(t.minPosAuto());
    assert.ok(Math.abs(b / (4 * a) - 1) < 0.02, `${a} x4 = ${b}`); // (minPx rounds to whole pixels)
  });
  test('coloured page: specks counted at the default size, not the (bigger) Min section size', () => {
    const t = createApp().__mstest;
    t.srcK = 1;
    t.srcDims = null;
    t.srcColour = 0.3;
    // a line page on a wooden table, as taken: 120 small bits of the table (20 px, over the default's 10) and 40 sections;
    // with Min section size raised (82 px) they're left out, but they aren't a coloured page's specks
    t.styleVars.minPos = 70;
    seg(t, 100000, 15000, [...fill(120, 20), ...fill(40, 1500)]);
    assert.notEqual(t.segQuality().code, 'coloured');
    // a coloured page: its colour in specks under 10 px, many to a section
    seg(t, 100000, 15000, [...fill(400, 4), ...fill(40, 1500)]);
    const q = t.segQuality();
    assert.equal(q.code, 'coloured');
    assert.equal(q.retake, true);
  });
  test('a steep photo: the warning box says so, with Choose another photo; only for a photo chosen now', () => {
    const t = createApp().__mstest;
    t.srcK = 1;
    t.srcDims = null;
    t.srcColour = 0;
    seg(t, 100000, 15000, fill(60, 1500));
    t.pgSteep = true;
    t.pgOrig = null;
    assert.equal(t.segQuality().ok, true, 'a guide opened again: nothing');
    t.pgOrig = { width: 1200, height: 1600 };
    const q = t.segQuality();
    assert.equal(q.code, 'steep');
    assert.equal(q.retake, true);
    assert.match(q.msg, /steep angle/);
    assert.match(q.tip, /holding the phone flatter/);
    t.pgSteep = false;
    assert.equal(t.segQuality().ok, true);
    // another warning says more, and comes first
    t.pgSteep = true;
    seg(t, 100000, 60000, fill(10, 4000));
    assert.equal(t.segQuality().code, 'dark');
  });
  test('faint: the tip names the control that is there (Sensitivity once Enhance is on)', () => {
    const t = createApp().__mstest;
    t.srcK = 1;
    t.srcDims = null;
    seg(t, 100000, 0, [100000]);
    t.enhance = true;
    assert.match(t.segQuality().tip, /raise Sensitivity/);
    t.enhance = false;
    assert.match(t.segQuality().tip, /turn on Enhance/);
  });
  test('an unsure find on a busy surface starts its corner handles 3% in; on a plain one, at its outline', () => {
    const q = [
      [100, 200],
      [900, 180],
      [950, 1400],
      [80, 1450],
    ];
    assert.equal(core.pgStartQ({ q, flick: 4.2 }, 1200, 1600), q);
    assert.equal(core.pgStartQ({ q }, 1200, 1600), q);
    const r = core.pgStartQ({ q, flick: core.PG_BUSY + 1.3 }, 1200, 1600).flat(),
      want = [36, 48, 1164, 48, 1164, 1552, 36, 1552];
    assert.ok(
      r.every((v, k) => Math.abs(v - want[k]) < 1e-6),
      r.join(' '),
    );
  });
}

// ---- from v31815-specks.test.mjs ----
// v318.15: specks in the blank paper round a drawing are made paper (a faint one up to 3 mm², grain lighter than the
// lines in the margin up to 10 mm², with the crumbs of paper a clump closes in); a dark dot in the margin and a speck
// inside a section stay. A binding or table along the
// edge of an uncoloured photo is found (edgeBandsOf) and Trim it is offered only then (trimOffer). Fails on v318.14.
{
  const W = 800,
    H = 1040,
    M = 120;
  // a page with a 120 px blank margin round a grid of lines (grey 30), and marks put on it
  function page(marks) {
    const g = new Uint8Array(W * H).fill(245);
    for (let y = M; y < H - M; y++)
      for (let x = M; x < W - M; x++)
        if ((x - M) % 80 < 3 || (y - M) % 80 < 3 || x >= W - M - 3 || y >= H - M - 3) g[y * W + x] = 30;
    for (const [x0, y0, s, v] of marks)
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) g[y * W + x] = v;
    return g;
  }
  const MARKS = [
    [40, 40, 4, 190], // faint, in the margin: goes
    [60, 300, 5, 120], // lighter than the lines, in the margin: goes
    [40, 600, 5, 30], // as dark as the lines, in the margin: stays
    [300, 300, 4, 190], // faint, inside a section (not in the paper round the drawing): stays
    [660, 960, 8, 120], // a clump of grain in the margin ...
    [663, 963, 2, 245], // ... with a crumb of paper inside it: both go
  ];
  function seg(g) {
    const app = createApp(),
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    return t;
  }
  const what = (t, x, y) => {
    const l = t.labels[y * W + x];
    return l < 1 ? 'ink' : t.comps[l].bg ? 'paper' : 'section';
  };
  // (the steps with a paint between them, segRun, are in e2e/v31815.test.mjs: the harness has no timers)

  // an RGB picture w x h of paper (240) with bands put on it
  function rgb(w, h, fill) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4,
          c = fill(x, y) || [240, 240, 236];
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
        d[j + 3] = 255;
      }
    return d;
  }
  test('specks in the paper round a drawing: faint ones and grain lighter than the lines go; a dark dot stays', () => {
    const t = seg(page(MARKS));
    assert.equal(what(t, 41, 41), 'paper', 'faint speck');
    assert.equal(what(t, 61, 301), 'paper', 'light grain');
    assert.equal(what(t, 41, 601), 'ink', 'a dark dot in the margin stays');
    assert.equal(what(t, 301, 301), 'ink', 'a speck inside a section stays');
    assert.equal(what(t, 661, 961), 'paper', 'the clump');
    assert.equal(what(t, 663, 963), 'paper', 'the crumb inside it');
    // 16 + 25 + the clump's 60: what went, each pixel once
    assert.equal(t.speckGone, 16 + 25 + 60);
    // the paper round them is one section, and its area counts them
    const bg = t.labels[41 * W + 41];
    assert.equal(t.labels[601 * W + 61 - 300 * W], bg);
    const n = t.labels.reduce((s, v) => s + (v === bg), 0);
    assert.equal(t.comps[bg].area, n);
    // the lines are untouched
    assert.equal(what(t, M + 1, M + 40), 'ink');
  });
  test('the size limits are on the page: 3 mm² for a faint speck, 10 mm² in the margin (the picture as a Letter page)', () => {
    const t = seg(page([]));
    const mm2 = Math.pow(Math.max(W, H) / 279.4, 2);
    assert.ok(Math.abs(t.speckCap(3) / (3 * mm2) - 1) < 0.05, String(t.speckCap(3)));
    assert.ok(Math.abs(t.speckCap() / (10 * mm2) - 1) < 0.05, String(t.speckCap()));
    // a faint mark bigger than 3 mm² away from the margin's rule isn't a speck; one too big for 10 mm² stays anywhere
    const big = Math.ceil(Math.sqrt(t.speckCap())) + 2;
    const t2 = seg(page([[30, 400, big, 120]]));
    assert.equal(what(t2, 31, 401), 'ink');
    assert.equal(t2.speckGone, 0);
  });
  test('a page with no margin (edge to edge) keeps its marks: none of it is the paper round a drawing', () => {
    const g = new Uint8Array(W * H).fill(245);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 80 < 3 || y % 80 < 3) g[y * W + x] = 30;
    const t = seg(g);
    assert.equal(t.speckGone, 0);
  });
  test('a binding or table along an edge: dark grey or brown bands are found, hatching and colour are not', () => {
    const t = createApp().__mstest,
      w = 600,
      h = 800;
    // a dark binding across the top 30 px, a brown table down the right 24 px
    const b = t.edgeBandsOf(
      rgb(w, h, (x, y) => (y < 30 ? [50, 50, 52] : x >= w - 24 ? [140, 110, 85] : null)),
      w,
      h,
    );
    assert.ok(b, 'found');
    assert.ok(Math.abs(b.t - 30 / h) < 0.003, 'top ' + b.t);
    assert.ok(Math.abs(b.r - 24 / w) < 0.003, 'right ' + b.r);
    assert.equal(b.l, 0);
    assert.equal(b.b, 0);
    // a binding's wire and holes: dark runs of 8 px with gaps, along a shadowed strip
    const wire = t.edgeBandsOf(
      rgb(w, h, (x, y) => (y < 20 ? (x % 14 < 8 ? [40, 40, 40] : [150, 150, 150]) : null)),
      w,
      h,
    );
    assert.ok(wire && wire.t > 0.02, 'wire ' + JSON.stringify(wire));
    // hatching at the edge (lines 2 px wide), a page of coloured pencil and a page with nothing: none
    assert.equal(
      t.edgeBandsOf(
        rgb(w, h, (x, y) => (y < 40 && x % 6 < 2 ? [30, 30, 30] : null)),
        w,
        h,
      ),
      null,
    );
    assert.equal(
      t.edgeBandsOf(
        rgb(w, h, (x, y) => (y < 40 ? [40, 90, 200] : null)),
        w,
        h,
      ),
      null,
    );
    assert.equal(
      t.edgeBandsOf(
        rgb(w, h, () => null),
        w,
        h,
      ),
      null,
    );
    // no more than 6% of the picture is taken
    const deep = t.edgeBandsOf(
      rgb(w, h, (x, y) => (y < 200 ? [50, 50, 52] : null)),
      w,
      h,
    );
    assert.ok(deep.t <= 0.06 + 1e-9, String(deep.t));
  });
  test('Trim it is offered for a photo as taken, not coloured in, with bands, when Auto crop would crop; not once cropped', () => {
    // (a drawing with a margin round it, which Auto crop would trim)
    const t = seg(page([]));
    assert.equal(t.edgeBands, null, 'a new picture starts without bands');
    assert.equal(t.trimOffer(), false);
    t.edgeBands = { t: 0.04, b: 0, l: 0, r: 0.02 };
    t.pgOrig = {};
    t.srcColour = 0.01;
    assert.equal(t.trimOffer(), true);
    t.srcColour = 0.2;
    assert.equal(t.trimOffer(), false, 'coloured in');
    t.srcColour = 0.01;
    t.cropRect = { x: 0, y: 0, w: 0.5, h: 0.5 };
    assert.equal(t.trimOffer(), false, 'cropped');
    t.cropRect = null;
    t.pgOrig = null;
    assert.equal(t.trimOffer(), false, 'not a photo taken now');
    // a drawing filling the page edge to edge: Auto crop would find nothing to trim, so it isn't offered
    const g = new Uint8Array(W * H).fill(245);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 80 < 3 || y % 80 < 3) g[y * W + x] = 30;
    const e = seg(g);
    e.edgeBands = { t: 0.015, b: 0, l: 0, r: 0 };
    e.pgOrig = {};
    e.srcColour = 0.01;
    assert.equal(e.trimOffer(), false, 'nothing to trim');
  });
}

// ---- from v31832-crumbs.test.mjs ----
// v318.32: the crumbs of paper a photo's grain and edge leave (crumbClean). A textured band along the picture's edge
// (one ink blob, shallow, a solid strip pocked with holes under 3 mm²) is made paper with its holes; a clump of grain
// dots in the margin keeps its ink but the crumbs between its dots (under 3 mm²) go to the paper. The drawing's own
// small sections stay, and so do a small shape drawn on its own, a hole inside one ring, bead, letter or flower (Fable
// P1-1), a hole counted at a hand-set Min section size (P1-2), and the ink of a lace strip or fine hatching along the
// edge (P1-5). segQuality counts only the crumbs under its reference size (P1-3), read off the sections, so an Undo
// counts the restored detection's (P1-4). Fails on v318.31 (no crumbClean) and on the first v318.32 (one ring's hole
// taken, limits from the user's Min, every crumb a speck, stale count after Undo, lace erased).
{
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
    assert.equal(
      t.labels[500 * W2 + 20],
      t.labels[500 * W2 + 200],
      'the band is the paper round the drawing',
    );
    // (whole segment(): 0.8-1.5 s on the shared test box; crumbClean a fifth of it)
    assert.ok(ms < 6000, 'segment took ' + ms.toFixed(0) + ' ms');
  });
}

// ---- from v31835-coloured.test.mjs ----
// v318.35: a page partly coloured in (Fable E1-3). Ink is dark AND colourless: on a page with colour on it, a pixel
// clearly coloured (chroma over COLOUR_CHROMA once the paper's tint is taken out) is paper to the ink unless it's as
// dark as a line, so a section filled with a mid or dark marker stays a section instead of reading as ink and
// vanishing. chromaOf gives null for a greyscale page (and for one under COLOUR_PAGE coloured), so those pages'
// sections are found exactly as before. colourSecs lists the sections coloured in, for the offer to mark them done
// (never automatic: `colored` stays zero after segment). Fails on v318.34 (no chromaOf; the filled cells vanish).
{
  const W = 800,
    H = 1040,
    M = 120;
  // a page with a 120 px blank margin round a grid of 80 px cells (lines grey 30), in RGBA; fills: [[col, row, rgb]]
  // colours a cell (bleeding 1 px over its lines, as a marker does)
  function page(fills) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 245;
      d[i * 4 + 3] = 255;
    }
    const put = (x, y, rgb) => {
      const j = (y * W + x) * 4;
      d[j] = rgb[0];
      d[j + 1] = rgb[1];
      d[j + 2] = rgb[2];
    };
    (fills || []).forEach(([cx, cy, rgb]) => {
      const x0 = M + cx * 80 + 2,
        y0 = M + cy * 80 + 2;
      for (let y = y0; y < y0 + 79; y++) for (let x = x0; x < x0 + 79; x++) put(x, y, rgb);
    });
    for (let y = M; y < H - M; y++)
      for (let x = M; x < W - M; x++)
        if ((x - M) % 80 < 3 || (y - M) % 80 < 3 || x >= W - M - 3 || y >= H - M - 3) put(x, y, [30, 30, 30]);
    return d;
  }
  function seg(d, o) {
    o = o || {};
    const app = createApp(),
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    const n = W * H,
      g = new Uint8Array(n);
    for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    const colour = t.colourShare(d, n);
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.srcColour = colour;
    t.chroma = o.noChroma ? null : t.chromaOf(d, n, colour);
    t.srcDims = { w: W, h: H };
    t.minPos = t.minPosAuto();
    t.segment();
    return t;
  }
  const cellAt = (t, cx, cy) => {
    const l = t.labels[(M + cy * 80 + 40) * W + M + cx * 80 + 40];
    return l < 1 ? 'ink' : t.comps[l].bg ? 'paper' : 'section';
  };
  const cellLabel = (t, cx, cy) => t.labels[(M + cy * 80 + 40) * W + M + cx * 80 + 40];
  const cellArea = (t, cx, cy) => {
    const l = cellLabel(t, cx, cy);
    return l > 0 ? t.comps[l].area : 0;
  };
  const counted = (t) => t.countedList().length;
  // marker fills: a mid blue, a red, a green; a dark navy (as dark as a line)
  const BLUE = [116, 168, 232],
    RED = [232, 96, 96],
    GREEN = [112, 192, 142],
    NAVY = [30, 36, 70];
  const FILLS = [
    [1, 1, BLUE],
    [3, 2, RED],
    [5, 7, GREEN],
    [2, 5, BLUE],
  ];
  test('sections filled with a mid marker stay sections, the same count as the plain page; on the grey alone they vanished', () => {
    const plain = seg(page()),
      t = seg(page(FILLS)),
      old = seg(page(FILLS), { noChroma: true });
    assert.ok(t.chroma, 'a page with colour on it has its chroma');
    assert.equal(counted(plain), 70, 'the grid: 7 x 10 cells');
    assert.equal(counted(t), counted(plain), 'the coloured page has every cell');
    const full = cellArea(plain, 0, 0);
    FILLS.forEach(([cx, cy]) => {
      assert.equal(cellAt(t, cx, cy), 'section', `cell ${cx},${cy} coloured in`);
      assert.equal(cellArea(t, cx, cy), full, `cell ${cx},${cy} whole, its fill paper`);
      // (on the grey alone the fill's rim is ink and the cell shrinks to a scrap in its middle, 400-825 px of 5,929)
      assert.ok(
        cellArea(old, cx, cy) < 0.2 * full,
        `cell ${cx},${cy} on the grey alone: ` + cellArea(old, cx, cy),
      );
    });
    // the lines round a fill still part it from its neighbours
    assert.notEqual(cellLabel(t, 1, 1), cellLabel(t, 2, 1));
    assert.notEqual(cellLabel(t, 1, 1), cellLabel(t, 1, 2));
    assert.ok(t.segWarn && t.segWarn.ok, JSON.stringify(t.segWarn));
    // offered, never marked by itself
    assert.equal([...t.colored].filter((x) => x).length, 0);
  });
  test('colourSecs lists the sections coloured in, by number, and nothing on a plain page', () => {
    const t = seg(page(FILLS));
    const secs = t.colourSecs();
    assert.equal(secs.length, FILLS.length, JSON.stringify(secs));
    FILLS.forEach(([cx, cy]) => assert.ok(secs.includes(cellLabel(t, cx, cy)), `cell ${cx},${cy}`));
    assert.equal(seg(page()).colourSecs().length, 0);
  });
  test('a greyscale page has no chroma and the same sections as before; a line pixel with colour smeared on it stays ink', () => {
    const d = page(),
      n = W * H,
      t = seg(d);
    assert.equal(t.chroma, null);
    assert.equal(t.chromaOf(d, n, 0.005), null, 'under COLOUR_PAGE: none');
    // a navy fill is barely coloured (chroma 40, under COLOUR_CHROMA): no colour read, the page as before
    const navy = seg(page([[1, 1, NAVY]]));
    assert.equal(navy.chroma, null);
    assert.equal(navy.srcColour, 0);
    // a JPEG smears a fill's colour onto the dark line beside it: the line pixel keeps its ink and the cells stay apart
    const sm = page([[1, 1, RED]]);
    for (let y = M + 80; y < M + 160; y++)
      for (let x = M + 160; x < M + 163; x++) {
        const j = (y * W + x) * 4;
        sm[j] = 90;
        sm[j + 1] = 10;
        sm[j + 2] = 10;
      }
    const ts = seg(sm);
    assert.notEqual(cellLabel(ts, 1, 1), cellLabel(ts, 2, 1), 'the smeared line still parts the cells');
    assert.equal(counted(ts), 70);
  });
  test('the warning for a page coloured in already says a partly coloured page works', () => {
    // (the condition itself is unchanged: many coloured specks for every section. Read off the words)
    const t = seg(page(FILLS));
    const src = String(t.segQuality);
    assert.match(src, /A partly coloured page works/);
    assert.match(src, /mark them done/);
  });
}

// ---- from v31835-hatching.test.mjs ----
// v318.35: hatching as one section (hatchMerge, 10-segment; Fable E1-2, plan Stage 4.3). The slivers between close
// parallel shading lines, and the cells of cross-hatching, merge into one section with their lines kept as drawn;
// a striped motif with wide stripes keeps its stripes, and a ladder of five rungs (under the group of six) keeps
// its five, and a photo kept as photographed (scale unknown) keeps every sliver. Treat hatching as one section is on by default, saved with the guide only when off, and turning it off
// leaves every sliver as it was; the "hatched" warning is softer once patches were merged and names the switch when
// it's off. Fails on v318.34 (no hatchMerge, no hatchOne).
{
  const W = 800,
    H = 1040;
  // a blank page (grey 245) with a 3 px frame 120 px in from the edge; draw(g) adds ink (30)
  function page(draw) {
    const g = new Uint8Array(W * H).fill(245);
    for (let y = 120; y < H - 120; y++)
      for (let x = 120; x < W - 120; x++)
        if (x < 123 || y < 123 || x >= W - 123 || y >= H - 123) g[y * W + x] = 30;
    if (draw) draw(g);
    return g;
  }
  const px = (g, x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = 30;
  };
  // a box of lines t px thick; hatch: horizontal lines every `every` px inside; cross: vertical ones too
  function box(g, x0, y0, w, h, every, cross, t) {
    t = t || 2;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const edge = x < x0 + t || y < y0 + t || x >= x0 + w - t || y >= y0 + h - t;
        const hy = every && (y - y0) % every < t,
          hx = cross && every && (x - x0) % every < t;
        if (edge || hy || hx) px(g, x, y);
      }
  }
  function seg(g, o) {
    o = o || {};
    const app = createApp(),
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    if (o.hatchOne === false) t.hatchOne = false;
    if (o.kept) t.pgHint = 'kept';
    // (v318.37: a camera photo, its lens known: only that kind of kept picture waits for straightening, X1-2)
    if (o.f35) t.pgF35 = o.f35;
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.srcDims = { w: W, h: H };
    t.minPos = t.minPosAuto();
    t.segment();
    return t;
  }
  // the sections (not background, not merged away) whose box lies inside x0,y0,w,h
  const inside = (t, x0, y0, w, h) => {
    const a = [];
    for (let l = 1; l < t.comps.length; l++) {
      const c = t.comps[l];
      if (!c || c.bg || c.merged) continue;
      if (c.x0 >= x0 && c.y0 >= y0 && c.x1 < x0 + w && c.y1 < y0 + h) a.push(l);
    }
    return a;
  };
  const inkIn = (t, x0, y0, w, h) => {
    let k = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (t.labels[y * W + x] === -1) k++;
    return k;
  };
  test('parallel lines in a box (4 px gaps, about 1 mm): one section, its lines kept as drawn', () => {
    const g = page((g) => box(g, 300, 300, 200, 200, 6));
    const t = seg(g);
    const ls = inside(t, 300, 300, 200, 200);
    assert.equal(ls.length, 1, 'sections in the hatched box: ' + ls.length);
    const c = t.comps[ls[0]];
    assert.ok(c.hatch >= 30, 'slivers merged in: ' + c.hatch);
    // (every sliver's pixels now carry the one label; the lines stay ink)
    assert.equal(
      c.area + inkIn(t, 300, 300, 200, 200),
      200 * 200,
      'all the paper in the box, and the lines still ink',
    );
    assert.equal(t.hatchMade, 1);
    // the sliver merged away says where it went
    let gone = 0;
    for (let l = 1; l < t.comps.length; l++) if (t.comps[l].hatched) gone++;
    assert.equal(gone, c.hatch - 1);
    assert.equal(t.comps[ls[0]].hatch, gone + 1);
    // the same page without the merge: every sliver its own section
    const t0 = seg(
      page((g) => box(g, 300, 300, 200, 200, 6)),
      { hatchOne: false },
    );
    assert.equal(inside(t0, 300, 300, 200, 200).length, c.hatch);
    assert.equal(t0.hatchMade, 0);
  });
  // (v318.37: a camera photo, pgF35; a lens-less picture kept as is on the unsure outline merges as a scan does, X1-2)
  test('a photo kept as photographed (its scale on the page unknown) keeps its slivers', () => {
    const t = seg(
      page((g) => box(g, 300, 300, 200, 200, 6)),
      { kept: true, f35: 26 },
    );
    assert.ok(inside(t, 300, 300, 200, 200).length >= 30);
    assert.equal(t.hatchMade, 0);
    const s = seg(
      page((g) => box(g, 300, 300, 200, 200, 6)),
      { kept: true },
    );
    assert.equal(s.hatchMade, 1, 'kept as is without a lens: merged');
  });
  test('a striped motif with wide stripes (12 px, about 3 mm) keeps its stripes', () => {
    const t = seg(page((g) => box(g, 300, 300, 200, 198, 14)));
    const ls = inside(t, 300, 300, 200, 198);
    assert.equal(ls.length, 14, 'stripes: ' + ls.length);
    assert.equal(t.hatchMade, 0);
  });
  test('cross-hatching (5 px cells): one section (its four corner cells, with cells on two sides only, stay)', () => {
    const t = seg(page((g) => box(g, 300, 300, 198, 198, 7, true)));
    const ls = inside(t, 300, 300, 198, 198).filter((l) => t.comps[l].area > 25);
    assert.equal(ls.length, 1, 'sections in the cross-hatched box: ' + ls.length);
    assert.equal(t.comps[ls[0]].hatch, 28 * 28 - 4, 'cells merged in: ' + t.comps[ls[0]].hatch);
    assert.equal(t.hatchMade, 1);
  });
  test('a ladder of five rungs keeps its five (a group needs six)', () => {
    const t = seg(page((g) => box(g, 300, 300, 120, 32, 6)));
    const ls = inside(t, 300, 300, 120, 32);
    assert.equal(ls.length, 5, 'rungs: ' + ls.length);
    assert.equal(t.hatchMade, 0);
    // six rungs: hatching
    const t6 = seg(page((g) => box(g, 300, 300, 120, 38, 6)));
    assert.equal(inside(t6, 300, 300, 120, 38).length, 1);
  });
  test('a hatched patch beside a plain one across a thicker line: the plain one is not taken in', () => {
    // the hatched box's own outline is the 2 px lines are; the big plain box beside it shares a 4 px side
    const t = seg(
      page((g) => {
        box(g, 300, 300, 200, 200, 6);
        box(g, 498, 300, 150, 200, 0, false, 4);
      }),
    );
    assert.equal(inside(t, 300, 300, 200, 200).length, 1);
    assert.equal(inside(t, 498, 300, 150, 200).length, 1, 'the plain box is a section of its own');
    assert.equal(t.hatchMade, 1);
  });
  test('the "hatched" warning: softer once patches were merged, names the switch when it is off', () => {
    // a page of 10 narrow hatched boxes (2 px gaps): 390 slivers, each under 3 x Min section size
    const draw = (g) => {
      for (let i = 0; i < 10; i++) box(g, 140 + i * 50, 300, 14, 160, 4);
    };
    const t0 = seg(page(draw), { hatchOne: false });
    assert.equal(t0.segWarn.code, 'hatched', JSON.stringify(t0.segWarn));
    assert.match(t0.segWarn.tip, /Treat hatching as one section/);
    const t = seg(page(draw));
    assert.equal(t.hatchMade, 10);
    assert.ok(t.segWarn.ok, 'merged: no warning: ' + JSON.stringify(t.segWarn));
    // the switch on, and still lots of slivers (a page of 60 five-rung ladders): the warning stays, worded as before
    const t1 = seg(
      page((g) => {
        for (let i = 0; i < 60; i++) box(g, 140 + (i % 10) * 50, 140 + ((i / 10) | 0) * 60, 14, 24, 4);
      }),
    );
    assert.equal(t1.segWarn.code, 'hatched');
    assert.equal(t1.hatchMade, 0);
    assert.doesNotMatch(t1.segWarn.tip, /Treat hatching/);
  });
  test('Treat hatching as one section: on to begin with, saved only when off, opens as saved', () => {
    const core = createApp().__mstest;
    assert.equal(core.styleVars.hatchOne, true);
    const f = [...core.styleFields].find((x) => x.key === 'hatchOne');
    assert.ok(f, 'a style field');
    assert.deepEqual([f.in, f.def, f.undo], ['payload', true, false]);
    assert.equal(f.save(), undefined, 'on: not written, so a guide saves exactly as before');
    core.styleVars.hatchOne = false;
    assert.equal(f.save(), false);
    assert.equal(f.check(false, true), false);
    assert.equal(f.check(undefined, true), true, 'a guide saved before: on');
    assert.equal(f.check('no', true), true);
  });
}

// ---- from v31835-page-edges.test.mjs ----
// v318.35: the page finder's edge fallback (Fable E1-1). A page on a desk nearly as bright as the paper, under light
// that falls off across the photo, has no paper/table split the block views can find (the paper candidate "fills"),
// yet its edge is a sharp step everywhere: four lines fitted to the strongest long gradient ridges give the page,
// judged as any other candidate. Fails on v318.34 (tier 'none', why 'fills').
{
  const W = 640,
    H = 480;
  // a photo W x H of a page (pw x ph, centred at cx,cy, turned by deg) on a desk: the light falls from `light` at the
  // top to `light * (1 - fall)` at the bottom, the desk is `desk` bright, the paper `paper`, with a drawing (a grid of
  // ink lines inside a margin), the edges blended over a pixel and a little noise. o.shadow: a soft shadow on the desk
  // below the page's bottom edge. Returns {d (RGBA), C (the true corners)}.
  function photo(o) {
    const pw = o.pw || 360,
      ph = o.ph || 270,
      cx = o.cx == null ? W / 2 : o.cx,
      cy = o.cy == null ? H / 2 : o.cy,
      a = ((o.deg || 0) * Math.PI) / 180,
      ca = Math.cos(a),
      sa = Math.sin(a),
      d = new Uint8ClampedArray(W * H * 4);
    let seed = 7;
    const rnd = function () {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        // page coordinates (u, v) from the page's centre
        const u = (x - cx) * ca + (y - cy) * sa,
          v = -(x - cx) * sa + (y - cy) * ca,
          du = pw / 2 - Math.abs(u),
          dv = ph / 2 - Math.abs(v),
          inside = Math.min(du, dv), // signed distance in from the page's edge
          cov = Math.max(0, Math.min(1, inside + 0.5));
        let desk = o.desk;
        if (o.shadow && v > ph / 2 && Math.abs(u) < pw / 2 + 20) {
          const s = Math.max(0, 1 - (v - ph / 2) / 40);
          desk *= 1 - 0.3 * s;
        }
        let paper = o.paper;
        if (du > 24 && dv > 24 && ((u + 1000) % 36 < 2.5 || (v + 1000) % 36 < 2.5)) paper = 30;
        const light = (o.light || 1) * (1 - (o.fall || 0) * (y / H)),
          g = Math.max(0, Math.min(255, (paper * cov + desk * (1 - cov)) * light + (rnd() - 0.5) * 4)),
          j = (y * W + x) * 4;
        d[j] = g;
        d[j + 1] = g;
        d[j + 2] = g;
        d[j + 3] = 255;
      }
    const C = [
      [-pw / 2, -ph / 2],
      [pw / 2, -ph / 2],
      [pw / 2, ph / 2],
      [-pw / 2, ph / 2],
    ].map(function (p) {
      return [cx + p[0] * ca - p[1] * sa, cy + p[0] * sa + p[1] * ca];
    });
    return { d: d, C: C };
  }
  function find(p) {
    const t = createApp().__mstest;
    return t.pgFind({ width: W, height: H, naturalWidth: W, naturalHeight: H, __buf: p.d, __w: W, __h: H });
  }
  // the worst corner's distance from the truth, as a share of the photo's diagonal (either way round, from any corner)
  function cornerErr(q, C) {
    let best = Infinity;
    for (let s = 0; s < 4; s++)
      for (const dir of [1, -1]) {
        let worst = 0;
        q.forEach(function (p, i) {
          const c = C[(((s + dir * i) % 4) + 4) % 4];
          worst = Math.max(worst, Math.hypot(p[0] - c[0], p[1] - c[1]));
        });
        best = Math.min(best, worst);
      }
    return best / Math.hypot(W, H);
  }
  // the light falls by a third down the photo, so the desk at the top is brighter than the paper at the bottom: no
  // one paper/table split works (v318.34: 'fills'); the page's edge is still a step everywhere
  const LIGHT = { desk: 205, paper: 240, light: 1.0, fall: 0.35 };
  test('a light page on a light desk under falling light: found sure by its edges, corners right', () => {
    const p = photo({ ...LIGHT, deg: 6 }),
      r = find(p);
    assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
    assert.equal(r.kind, 'edges');
    assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1% of the diagonal: ' + cornerErr(r.q, p.C));
  });
  test('a shadowed edge (the desk darker just below the page): still found, corners right', () => {
    const p = photo({ ...LIGHT, deg: -5, shadow: true }),
      r = find(p);
    assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
    assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1%: ' + cornerErr(r.q, p.C));
  });
  test('a page turned 22 degrees: found sure, corners right', () => {
    const p = photo({ ...LIGHT, deg: 22, pw: 300, ph: 220 }),
      r = find(p);
    assert.equal(r.tier, 'sure', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind, edges: r.edges }));
    assert.ok(cornerErr(r.q, p.C) < 0.01, 'corners within 1%: ' + cornerErr(r.q, p.C));
  });
  test('a page cut off by the photo edge: the fallback invents no fourth side', () => {
    // the page's bottom runs off the photo: three edges only
    const p = photo({ ...LIGHT, deg: 4, cy: H / 2 + 160 }),
      r = find(p);
    assert.notEqual(r.kind, 'edges', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind }));
    assert.notEqual(r.tier, 'sure');
  });
  test('the drawing itself offers no page: a grid drawn to the edge of a plain copy is not an outline (edges)', () => {
    // the page fills the photo (no desk at all): nothing to find, and the fallback does not take the grid for a page
    const p = photo({ desk: 240, paper: 240, light: 1, fall: 0, pw: W + 40, ph: H + 40 }),
      r = find(p);
    assert.notEqual(r.kind, 'edges', JSON.stringify({ tier: r.tier, why: r.why, kind: r.kind }));
    assert.notEqual(r.tier, 'sure');
  });
}

// ---- from v31837-segment.test.mjs ----
// (v318.37) The sections' fixes after the X1 review: coloured outlines kept by the chroma ink rule (X1-1), the hatch
// switch after Keep as is on a lens-less picture (X1-2), Undo's byte budget counting the colour (X1-3), the warning
// judged after Undo put the hatching state back (X1-4), a cross-hatched page called hatched rather than noisy (X1-5)
// and hatchMade reset for a new picture (X1-6)
{
  const W = 800,
    H = 1000;
  // an RGBA page: white paper, a grid of 3 px outlines in `line` (30 cells), `band`: a 20 px black title band (2% of
  // the pixels), `fills`: three cells filled with a dark blue marker
  function rgba(line, band, fills) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c = [250, 250, 250];
        const inDraw = x >= 100 && x < 700 && y >= 100 && y < 820;
        if (inDraw && ((x - 100) % 120 < 3 || (y - 100) % 120 < 3 || x >= 697 || y >= 817)) c = line;
        else if (fills && inDraw && y < 220 && x < 460) c = [20, 60, 150];
        if (band && y >= 900 && y < 920 && x >= 100 && x < 700) c = [0, 0, 0];
        const j = (y * W + x) * 4;
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
        d[j + 3] = 255;
      }
    return d;
  }
  function seg(d, enhance) {
    const app = createApp(),
      t = app.__mstest,
      n = W * H;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    t.srcK = 1;
    t.W = W;
    t.H = H;
    const g = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4)
      g[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
    t.gray = g;
    const share = t.colourShare(d, n);
    t.chroma = t.chromaOf(d, n, share);
    t.srcColour = share;
    t.srcDims = { w: W, h: H };
    t.minPos = t.minPosAuto();
    t.enhance = enhance;
    t.segment();
    return t;
  }
  function counted(t) {
    let k = 0;
    for (let l = 1; l < t.comps.length; l++) {
      const c = t.comps[l];
      if (c && !c.bg && !c.merged && c.area >= t.minPx()) k++;
    }
    return k;
  }
  const LINES = { red: [220, 30, 30], blue: [40, 60, 200], green: [30, 150, 40] };
  // a cross-hatched box every 5 px (1 px lines) on the left, cells of pitch q on the right
  const HW = 800,
    HH = 800;
  function hatchPage(q) {
    const g = new Uint8Array(HW * HH).fill(245);
    for (let y = 100; y < 700; y++)
      for (let x = 100; x < 700; x++) {
        if (x < 103 || x >= 697 || y < 103 || y >= 697 || Math.abs(x - 400) < 2) g[y * HW + x] = 30;
        else if (x < 400 && ((x - 103) % 5 === 0 || (y - 103) % 5 === 0)) g[y * HW + x] = 30;
        else if (x > 400 && ((x - 400) % q < 2 || (y - 100) % q < 2)) g[y * HW + x] = 30;
      }
    return g;
  }
  function hatched(o) {
    const t = createApp().__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    t.srcK = 1;
    t.W = HW;
    t.H = HH;
    t.gray = hatchPage(o.q || 100);
    t.srcDims = { w: HW, h: HH };
    t.minPos = t.minPosAuto();
    if (o.hatchOne != null) t.hatchOne = o.hatchOne;
    if (o.kept) t.pgHint = 'kept';
    if (o.f35) t.pgF35 = o.f35;
    t.segment();
    return t;
  }
  for (const band of [false, true])
    for (const enh of [true, false])
      test(
        'X1-1: coloured outlines keep their sections (black band ' + band + ', Enhance ' + enh + ')',
        () => {
          const base = counted(seg(rgba([0, 0, 0], band), enh));
          assert.ok(base >= 28, 'black lines: ' + base);
          for (const nm in LINES) {
            const t = seg(rgba(LINES[nm], band), enh),
              n = counted(t);
            assert.ok(n >= base - 2, nm + ' lines: ' + n + ' sections of ' + base);
            // (v319: the picture keeps its colour, the cut being per patch now, inkColourCut; its lines are ink, so no
            // section is coloured and there's no colour offer. Until then the colour was dropped for a coloured-line page)
            assert.ok(t.chroma, nm + ': colour kept');
            assert.equal(t.colourSecs().length, 0, nm + ': nothing offered');
          }
        },
      );
  test('X1-1: a black-lined page with dark fills still keeps the filled sections (v318.35), and its colour', () => {
    for (const enh of [true, false]) {
      const t = seg(rgba([0, 0, 0], false, true), enh);
      assert.equal(counted(t), 30, 'Enhance ' + enh);
      assert.ok(t.chroma, 'chroma kept');
      assert.equal(t.colourSecs().length, 3);
    }
  });
  test('X1-2: after Keep as is on a lens-less picture the hatching still merges; a camera photo waits, and says so', () => {
    const scan = hatched({ hatchOne: true, kept: true });
    assert.ok(scan.hatchMade > 0, 'scan kept as is: merged ' + scan.hatchMade);
    assert.equal(scan.hatchUnsure(), false);
    assert.match(scan.hatchNoteText(), /Found 1 hatched patch/);
    const photo = hatched({ hatchOne: true, kept: true, f35: 26 });
    assert.equal(photo.hatchMade, 0);
    assert.equal(photo.hatchUnsure(), true);
    assert.match(photo.hatchNoteText(), /Not until the page is straightened/);
    assert.doesNotMatch(photo.hatchNoteText(), /Found/);
  });
  test('X1-3: a geo step counts its colour in the Undo budget', () => {
    const t = createApp().__mstest,
      gray = new Uint8Array(1000),
      chroma = new Uint8Array(1000),
      s = { t: 'seg', keep: { geo: { gray: gray, chroma: chroma } } };
    assert.equal(t.snapBytes(s), 2000);
    assert.equal(t.snapBytes({ t: 'seg', keep: { geo: { gray: gray, chroma: null } } }), 1000);
  });
  test('X1-4: after Undo of switching hatching on, the warning is the one from before', () => {
    const t = hatched({ hatchOne: false, q: 7 });
    const w0 = t.segWarn;
    assert.equal(w0 && w0.code, 'hatched');
    assert.match(w0.msg, /^Lots of slivers/);
    // (as the switch does: the settings kept for Undo first, hatchWire)
    t.reFrom();
    t.hatchOne = true;
    t.segSync = true;
    try {
      assert.equal(t.resegment(), true);
    } finally {
      t.segSync = false;
    }
    assert.ok(t.hatchMade > 0);
    assert.match(t.segWarn.msg, /^Still lots of slivers/);
    t.doUndoSeg();
    assert.equal(t.hatchOne, false);
    assert.equal(t.hatchMade, 0);
    assert.equal(t.segWarn.msg, w0.msg);
    assert.equal(t.segWarn.tip, w0.tip);
  });
  test('X1-5: a cross-hatched page with the switch off is called hatched, naming the switch, not noisy', () => {
    const t = hatched({ hatchOne: false });
    assert.equal(t.segWarn && t.segWarn.code, 'hatched');
    assert.match(t.segWarn.tip, /Treat hatching as one section/);
    // (the sections untouched by the dry run)
    assert.equal(t.hatchMade, 0);
    assert.ok(counted(t) > 5000, 'still unmerged: ' + counted(t));
    const on = hatched({ hatchOne: true });
    assert.equal(on.hatchMade, 1);
    assert.ok(!on.segWarn || on.segWarn.ok, 'merged: no warning');
  });
  test('X1-6: hatchMade is reset for a new picture', () => {
    const t = hatched({ hatchOne: true });
    assert.equal(t.hatchMade, 1);
    t.assign.resetForNewPicture();
    assert.equal(t.hatchMade, 0);
  });
}

// ---- from v319-colour-ink.test.mjs ----
// (v319) The colour cut patch by patch (inkColourCut) after Fable's Y1 review: a page drawn in coloured outlines keeps
// every line beside any number of dark fills, with a black title band or not, Enhance on or off (Y1-1; v318.37's
// page-level verdict, inkLinesColoured, lost every section from the fifth fill); coloured lines 2 mm and thicker
// stay lines (Y1-2); the picture keeps its colour, so the fills are offered as done and a page of coloured outlines
// with no fills gets no offer (Y1-5); a fill scribbled in strokes with hairline gaps is one section (Y1-4); black
// lines with dark fills or coloured stipple are as v318.35 had them. And the page finder's 'kept' state cleared for
// the next picture (Y1-3), the dry hatch merge's answer kept from the detection (Y1-6). Fails on v318.37.
{
  const W = 800,
    H = 1000,
    RED = [220, 30, 30],
    BLUE = [20, 60, 150],
    BLACK = [0, 0, 0];
  // an RGBA page: white paper, a 5 x 6 grid of 120 px cells (30) in `lw` px outlines in `line`; `fills` cells (from
  // the top left, along the rows, every other cell as on a chessboard: a line between two dark fills is cut with them,
  // a known limit) filled with a dark blue marker; `band`: a 20 px black title band (2% of the pixels);
  // `streak`: the fills in vertical strokes `streak[0]` px wide with `streak[1]` px of paper between; `dots`: a
  // stipple of `dots` px dots in every cell instead
  function rgba(o) {
    const d = new Uint8ClampedArray(W * H * 4),
      lw = o.lw || 3,
      line = o.line || RED;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c = [250, 250, 250];
        const inDraw = x >= 100 && x < 700 && y >= 100 && y < 820,
          px = (x - 100) % 120,
          py = (y - 100) % 120,
          cx = Math.floor((x - 100) / 120),
          cy = Math.floor((y - 100) / 120),
          // the chessboard's cells in order: 0, 2, 4 on the first row, 6, 8 on the second...
          cell = (cx + cy) % 2 ? -1 : (cy * 5 + cx) >> 1;
        if (inDraw && (px < lw || py < lw || x >= 700 - lw || y >= 820 - lw)) c = line;
        else if (inDraw && o.fills && cell >= 0 && cell < o.fills) {
          if (!o.streak || x % (o.streak[0] + o.streak[1]) < o.streak[0]) c = BLUE;
        } else if (inDraw && o.dots && px % 14 < o.dots && py % 14 < o.dots && px > 6 && py > 6) c = BLUE;
        if (o.band && y >= 900 && y < 920 && x >= 100 && x < 700) c = BLACK;
        const j = (y * W + x) * 4;
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
        d[j + 3] = 255;
      }
    return d;
  }
  function seg(d, enhance) {
    const t = createApp().__mstest,
      n = W * H;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    t.srcK = 1;
    t.W = W;
    t.H = H;
    const g = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4)
      g[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
    t.gray = g;
    const share = t.colourShare(d, n);
    t.chroma = t.chromaOf(d, n, share);
    t.srcColour = share;
    t.srcDims = { w: W, h: H };
    t.minPos = t.minPosAuto();
    t.enhance = enhance;
    t.segment();
    return t;
  }
  function counted(t) {
    let k = 0;
    for (let l = 1; l < t.comps.length; l++) {
      const c = t.comps[l];
      if (c && !c.bg && !c.merged && c.area >= t.minPx()) k++;
    }
    return k;
  }
  const SETTINGS = [
    [true, false],
    [false, false],
    [true, true],
    [false, true],
  ];
  // the hatching pages of v31837-segment: a cross-hatched box every 5 px on the left, cells of pitch q on the right
  const HW = 800,
    HH = 800;
  function hatchPage(q) {
    const g = new Uint8Array(HW * HH).fill(245);
    for (let y = 100; y < 700; y++)
      for (let x = 100; x < 700; x++) {
        if (x < 103 || x >= 697 || y < 103 || y >= 697 || Math.abs(x - 400) < 2) g[y * HW + x] = 30;
        else if (x < 400 && ((x - 103) % 5 === 0 || (y - 103) % 5 === 0)) g[y * HW + x] = 30;
        else if (x > 400 && ((x - 400) % q < 2 || (y - 100) % q < 2)) g[y * HW + x] = 30;
      }
    return g;
  }
  function hatched(t) {
    t.srcK = 1;
    t.W = HW;
    t.H = HH;
    t.gray = hatchPage(100);
    t.srcDims = { w: HW, h: HH };
    t.minPos = t.minPosAuto();
    t.segment();
    return t;
  }
  for (const lw of [3, 8, 14])
    test(
      'Y1-1/2/5: ' +
        lw +
        ' px red outlines keep their cells beside 0-10 dark fills, and the colour for the offer',
      () => {
        for (const [enh, band] of SETTINGS)
          for (const fills of [0, 1, 3, 5, 10]) {
            const t = seg(rgba({ lw: lw, band: band, fills: fills }), enh),
              n = counted(t),
              nm = lw + ' px, Enhance ' + enh + ', band ' + band + ', ' + fills + ' fills: ';
            assert.equal(n, 30, nm + n + ' sections');
            assert.ok(!t.segWarn || t.segWarn.ok, nm + 'warned ' + (t.segWarn && t.segWarn.code));
            assert.ok(t.chroma, nm + 'colour kept');
            assert.equal(t.colourSecs().length, fills, nm + 'fills offered');
          }
      },
    );
  test("Y1-1: black outlines with dark fills keep v318.35's gain, and with a coloured stipple every cell", () => {
    for (const enh of [true, false]) {
      const t = seg(rgba({ line: BLACK, fills: 3 }), enh);
      assert.equal(counted(t), 30, 'fills, Enhance ' + enh);
      assert.equal(t.colourSecs().length, 3);
      for (const dots of [2, 4])
        assert.equal(counted(seg(rgba({ line: BLACK, dots: dots }), enh)), 30, dots + ' px dots');
    }
  });
  test('Y1-4: a fill scribbled in strokes with hairline gaps is one section, offered as done', () => {
    for (const [sw, gap] of [
      [5, 2],
      [6, 1],
      [10, 2],
      [20, 3],
    ])
      for (const enh of [true, false]) {
        const t = seg(rgba({ line: BLACK, fills: 3, streak: [sw, gap] }), enh),
          nm = sw + ' px strokes, ' + gap + ' px gaps, Enhance ' + enh + ': ';
        assert.equal(counted(t), 30, nm + 'sections');
        assert.equal(t.colourSecs().length, 3, nm + 'offered');
      }
  });
  test("Y1-3: a camera photo kept as photographed doesn't leave the next picture 'kept'", () => {
    const t = createApp().__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    // as pgBegin and pgFound leave a camera photo the finder left as it was
    t.pgF35 = 26;
    t.pgHint = 'kept';
    t.pgSteep = true;
    // the sample, or a guide saved before v318.34: resetForNewPicture and no pgBegin
    t.assign.resetForNewPicture();
    assert.equal(t.pgHint, null);
    assert.equal(t.pgF35, 0);
    assert.equal(t.pgSteep, false);
    assert.equal(t.hatchUnsure(), false);
    hatched(t);
    assert.ok(t.hatchMade > 0, 'its hatching merged: ' + t.hatchMade);
    assert.doesNotMatch(t.hatchNoteText(), /straightened/);
  });
  test("Y1-6: segQuality's 'hatched' answer with the switch off is the detection's dry merge, not run again", () => {
    const t = createApp().__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    t.hatchOne = false;
    hatched(t);
    assert.ok(t.hatchWould > 0, 'the dry merge counted: ' + t.hatchWould);
    assert.equal(t.hatchMade, 0);
    assert.equal(t.segQuality().code, 'hatched');
    // were the dry merge run again now, it would find nothing (a camera photo kept as photographed waits for the
    // page to be straightened, hatchUnsure) and the page would be called 'noisy'
    t.pgHint = 'kept';
    t.pgF35 = 26;
    assert.equal(t.hatchMerge(true), 0);
    assert.equal(t.segQuality().code, 'hatched');
    // a new picture starts from nothing
    t.assign.resetForNewPicture();
    assert.equal(t.hatchWould, 0);
  });
}
