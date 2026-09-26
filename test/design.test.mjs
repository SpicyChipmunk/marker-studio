// Tests for the design-pass behaviour: label placement, set picker state,
// and the guide-backup reminder logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage, core } from './harness.mjs';

test('labels sit inside the section even when its centroid does not (C-shape)', () => {
  // 30x30: ink everywhere except a thick "C" of label 0 (fillable)
  const W = 30, H = 30, lab = new Int32Array(W * H).fill(-1);
  const inC = (x, y) => x >= 3 && x < 27 && y >= 3 && y < 27 && !(x >= 11 && y >= 11 && y < 19);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inC(x, y)) lab[y * W + x] = 0;
  core.W = W; core.H = H; core.labels = lab; core.labelCells(); core.labelPts = null;
  const c = core.comps[1];
  const at = (x, y) => core.labels[Math.floor(y) * W + Math.floor(x)];
  assert.notEqual(at(c.cx, c.cy), 1, 'fixture: centroid falls outside the C');
  const p = core.labelPos(1);
  assert.equal(at(p.x, p.y), 1, 'label point is inside the section');
  assert.ok(p.r >= 3, `inscribed radius ${p.r}`);
  assert.ok(p.aw >= 6, `available width ${p.aw}`);
});

const KEY = 'ohuhu-hb320-picker-v3';
const base = (extra = {}) => JSON.stringify({ mode: 'home', tones: ['pale', 'light', 'mid', 'dark'], sats: ['neutral', 'muted', 'medium', 'vivid'], brands: ['Ohuhu', 'Copic'], satsUpgraded: true, scopeFlipped: true, ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, owned: [], saved: [], ...extra });

test('set picker marks sets you already fully own', () => {
  const probe = createApp({ localStorage: memoryStorage() });
  const set24 = probe.__eval("presetMkeys(MARKER_SETS[0])");
  const a = createApp({ localStorage: memoryStorage({ [KEY]: base({ owned: [...set24] }) }) });
  const html = a.presetListHTML();
  assert.match(html, /presetrow have"><input type="checkbox" data-i="0">/);
  assert.doesNotMatch(html, /presetrow have"><input type="checkbox" data-i="1">/, 'partially owned set is not marked');
});

test('guide backup reminder counts guides changed since the last backup', () => {
  const now = Date.now();
  const guides = [1, 2, 3].map((k) => ({ id: k, type: 'guide', name: 'g' + k, keys: [], ts: now - k * 864e5 }));
  const ls = memoryStorage({ [KEY]: base({ saved: guides }) });
  const a = createApp({ localStorage: ls });
  assert.equal(a.guidesAtRisk(), 3, 'never backed up: all at risk');
  ls.setItem('ms-guides-backup-ts', String(now - 1.5 * 864e5));
  assert.equal(a.guidesAtRisk(), 1, 'only the guide saved after the backup');
});
