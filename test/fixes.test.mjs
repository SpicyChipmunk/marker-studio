// Regression tests for the persistence / import-safety / guide-persistence fixes.
// Each persistence test boots a fresh app instance against an in-memory
// localStorage, so we can simulate "what happens on the next launch".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage, app, core } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';

// A saved state as an existing user would have it after the one-time
// migrations have run once.
function storedState(extra = {}) {
  return JSON.stringify({
    mode: 'home', palSize: 4, harmony: 'complementary',
    tones: ['pale', 'light', 'mid', 'dark'], sats: ['neutral', 'muted', 'medium', 'vivid'],
    drawn: [], excluded: [], palettes: [], pool: null, brands: ['Ohuhu', 'Copic'],
    satsUpgraded: true, scopeFlipped: true, ownedSeedV: 2, copicAdd1: 1, libAdj1: 1,
    owned: ['Ohuhu|120', 'Copic|E09'], saved: [],
    ...extra,
  });
}
const boot = (json) => {
  const ls = memoryStorage(json == null ? {} : { [KEY]: json });
  const a = createApp({ localStorage: ls });
  return { a, ls, owned: () => [...a.__eval('state.owned')] };
};

test('one-time collection migrations do not re-run on every launch', () => {
  // User owns Copic E09 (the migration deletes it) and not Copic B26 (the migration adds it).
  const { a, ls, owned } = boot(storedState());
  assert.ok(owned().includes('Copic|E09'), 'E09 must not be removed again');
  assert.ok(!owned().includes('Copic|B26'), 'B26 must not be re-added');
  a.save();
  const saved = JSON.parse(ls.getItem(KEY));
  assert.equal(saved.copicAdd1, 1, 'copicAdd1 flag persisted');
  assert.equal(saved.libAdj1, 1, 'libAdj1 flag persisted');
  // second launch from what was just saved: still intact
  const again = boot(ls.getItem(KEY));
  assert.deepEqual(again.owned().sort(), ['Copic|E09', 'Ohuhu|120']);
});

test('an intentionally empty collection stays empty after relaunch', () => {
  const { owned } = boot(storedState({ owned: [] }));
  assert.equal(owned().length, 0);
});

test('a brand-new install starts with an empty collection (no author defaults)', () => {
  const { a, ls, owned } = boot(null);
  assert.equal(owned().length, 0);
  a.save();
  const saved = JSON.parse(ls.getItem(KEY));
  // the author-specific one-time migrations are marked done, so they never add markers later
  assert.equal(saved.ownedSeedV, 2);
  assert.equal(saved.copicAdd1, 1);
  assert.equal(saved.libAdj1, 1);
  assert.equal(boot(ls.getItem(KEY)).owned().length, 0, 'still empty on relaunch');
});

test('existing users keep their collection (defaults only for legacy pre-v2 state)', () => {
  const legacy = JSON.parse(storedState());
  delete legacy.ownedSeedV; delete legacy.copicAdd1; delete legacy.libAdj1;
  const { owned } = boot(JSON.stringify(legacy));
  assert.ok(owned().length > 100, 'legacy (pre-seed-v2) state still migrates to the old default');
});

test('library entries are sanitised on load (ids, thumbs, keys)', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const { a } = boot(storedState({
    saved: [
      { id: evil, type: 'palette', name: 'bad id', keys: ['Ohuhu|120'] },
      { id: 5, type: 'guide', name: 'x', keys: ['Ohuhu|120', 3, null], thumb: 'data:x" onerror="alert(1)' },
      { id: 6, type: 'palette', name: 'fine', keys: ['Ohuhu|120'] },
      'junk',
    ],
  }));
  const saved = JSON.parse(JSON.stringify(a.__eval('state.saved')));
  assert.deepEqual(saved.map((s) => s.id), [5, 6], 'non-numeric id and junk dropped');
  assert.equal(saved[0].thumb, '', 'unsafe thumb cleared');
  assert.deepEqual(saved[0].keys, ['Ohuhu|120'], 'non-string keys dropped');
});

test('esc() and safeThumb() neutralise markup', () => {
  assert.equal(app.esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(app.safeThumb('data:image/jpeg;base64,AAAA+/=='), 'data:image/jpeg;base64,AAAA+/==');
  assert.equal(app.safeThumb('data:image/jpeg;base64,AA" onerror="x'), '');
  assert.equal(app.safeThumb('javascript:alert(1)'), '');
  assert.equal(app.safeThumb(null), '');
});

test('generated-palette source is saved with the guide (was always [])', () => {
  const W = 4, H = 4;
  core.W = W; core.H = H; core.labels = new Int32Array(W * H).fill(1);
  core.secState = new Uint8Array([0, 0]); core.colored = new Uint8Array([0, 0]);
  core.curName = 'Gen test';
  core.assignData = { order: [1], assign: { 1: { mkey: 'Ohuhu|120' } }, N: 1 };
  core.genPal = ['Ohuhu|120', 'Copic|100', 7];
  const d = core.currentDesignObj();
  const gp = [...d.payload.style.genPal];
  assert.equal(gp.length, 3);
  assert.equal(gp[0], 'Ohuhu|120');
  assert.equal(gp[1], 'Copic|100');
  assert.equal(app.keyIdx(gp[2]), 7, 'numeric entries are converted to marker keys');
});
