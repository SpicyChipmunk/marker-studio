// v318.12: an edge-to-edge drawing keeps its edge shapes (bgRule 1, new guides only: a guide saved before opens with
// its background as it was), a page with a margin keeps its margin as background; and a sketchbook page photographed
// from above, whose only outline the finder could find was the drawing's, is built as taken rather than opening the
// corner handles. Fails on v318.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

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
  for (let l = 1; l < t.comps.length; l++) if (t.comps[l] && !t.comps[l].merged && t.comps[l].bg) bg.push(l);
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
