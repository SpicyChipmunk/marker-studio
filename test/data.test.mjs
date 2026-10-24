// Saved state, backups, restore, style settings.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core, createApp, memoryStorage } from './harness.mjs';
import fs, { readFileSync } from 'node:fs';

// ---- from backup-restore.test.mjs ----
// Backups: the reminder's count, and restoring when storage is full or the backup has no markers.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  // ---- From the design pass ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const base = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      tones: ['pale', 'light', 'mid', 'dark'],
      sats: ['neutral', 'muted', 'medium', 'vivid'],
      brands: ['Ohuhu', 'Copic'],
      satsUpgraded: true,
      scopeFlipped: true,
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      owned: [],
      saved: [],
      ...extra,
    });
  // ---- From the fifth review ----
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const stored = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [{ id: 7, type: 'palette', name: 'P', keys: ['Ohuhu|R014'], ts: 7 }],
      ...extra,
    });
  const boot = (json) => {
    const ls = memoryStorage(json == null ? {} : { [KEY]: json });
    const a = createApp({ localStorage: ls });
    a.__eval('fullRender=function(){};renderSaved=function(){}');
    return { a, ls, ev: (s) => a.__eval(s) };
  };
  const owned = (ev) => JSON.parse(ev('JSON.stringify([...state.owned].sort())'));
  // the next writes of the app's state fail as if the storage were full
  const fill = (ls) => {
    const set = ls.setItem;
    ls.setItem = (k, v) => {
      if (k === KEY) throw new Error('QuotaExceededError');
      set(k, v);
    };
  };
  test('guide backup reminder counts guides changed since the last backup', () => {
    const now = Date.now();
    const guides = [1, 2, 3].map((k) => ({
      id: k,
      type: 'guide',
      name: 'g' + k,
      keys: [],
      ts: now - k * 864e5,
    }));
    const ls = memoryStorage({ [KEY]: base({ saved: guides }) });
    const a = createApp({ localStorage: ls });
    assert.equal(a.guidesAtRisk(), 3, 'never backed up: all at risk');
    ls.setItem('ms-guides-backup-ts', String(now - 1.5 * 864e5));
    assert.equal(a.guidesAtRisk(), 1, 'only the guide saved after the backup');
  });
  test('restore with storage full: nothing changes and it says it failed', () => {
    const { ev, ls } = boot(stored());
    const before = ls.getItem(KEY);
    fill(ls);
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: 5,
      owned: ['Ohuhu|B08', 'Ohuhu|G36'],
      wish: [{ k: 'Ohuhu|R16', why: 'x', ts: 1 }],
      ink: { 'Ohuhu|B08': 'low' },
      saved: [{ id: 99, type: 'palette', name: 'New', keys: ['Ohuhu|G36'], ts: 99 }],
    };
    const r = JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(backup)},5))`));
    assert.deepEqual(r, { failed: true });
    assert.deepEqual(owned(ev), [...OWN].sort(), 'the markers are as they were');
    assert.equal(ev('state.saved.length'), 1, 'no palette added');
    assert.equal(ev('state.wish.length'), 0);
    assert.equal(ev('JSON.stringify(state.ink)'), '{}');
    assert.equal(ls.getItem(KEY), before);
    assert.equal(ls.getItem('ms-backup-sig'), null, 'not marked as backed up');
    assert.equal(ev(`restoredWords({failed:true})`), '');
    // declining the markers, palettes only: the same
    ev('confirm=function(){return false;}');
    assert.deepEqual(JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(backup)},5))`)), {
      failed: true,
    });
    assert.equal(ev('state.saved.length'), 1);
  });
  test('a backup with no markers leaves the markers here alone and asks nothing; its palettes are added', () => {
    const { ev, ls } = boot(stored());
    ev('confirm=function(){throw new Error("asked");}');
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: 5,
      owned: [],
      saved: [{ id: 99, type: 'palette', name: 'New', keys: ['Ohuhu|G36'], ts: 99 }],
    };
    const r = JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(backup)},5))`));
    // (v305: Keep mine also says what came in beside your markers: here nothing)
    assert.deepEqual(r, { mk: false, pals: 1, wish: 0, low: 0, dry: 0, buy: false });
    assert.deepEqual(owned(ev), [...OWN].sort());
    assert.equal(JSON.parse(ls.getItem(KEY)).saved.length, 2, 'saved');
    assert.equal(ev(`restoredWords({mk:false,pals:1})`), 'Kept your markers; added 1 palette.');
    assert.equal(ev(`restoredList({markers:0,palettes:2,guides:1})`), '2 palettes and 1 guide');
    // with no markers here either, nothing claims to keep them
    const e2 = boot(stored({ owned: [] })).ev;
    e2('confirm=function(){throw new Error("asked");}');
    e2(`applyCollectionBackup(${JSON.stringify(backup)},5)`);
    assert.equal(e2(`restoredWords({mk:false,pals:1})`), 'Added 1 palette.');
  });
}

// ---- from save-load.test.mjs ----
// Round-trip tests for guide persistence, driven through the seam with the
// harness's lossless canvas/Image polyfill; and opening guide files safely.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    core = _app.__mstest;
  // Decode a label-map data URL the way openDesignObj does (Image -> drawImage ->
  // getImageData -> v-1). Returns the recovered Int32Array of labels.
  function decodeLmap(url, W, H) {
    let out = null;
    const img = new app.Image();
    img.onload = () => {
      const c = app.document.createElement('canvas');
      c.width = W;
      c.height = H;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, W, H).data;
      out = new Int32Array(W * H);
      for (let p = 0, j = 0; p < W * H; p++, j += 4) {
        const v = d[j] | (d[j + 1] << 8) | (d[j + 2] << 16);
        out[p] = v === 0 ? -1 : v - 1;
      }
    };
    img.src = url;
    return out;
  }
  test('lmapURL() round-trips the label map losslessly', () => {
    const W = 8,
      H = 6,
      n = W * H;
    const lab = new Int32Array(n);
    for (let i = 0; i < n; i++) lab[i] = i % 7 === 0 ? -1 : i % 4; // labels 0..3 + ink
    core.W = W;
    core.H = H;
    core.labels = lab;

    const url = core.lmapURL();
    const recovered = decodeLmap(url, W, H);
    assert.ok(recovered, 'decode ran');
    for (let i = 0; i < n; i++) assert.equal(recovered[i], lab[i], `pixel ${i}`);
  });
  test('lmapURL() preserves labels above 255 (multi-byte encoding)', () => {
    const W = 4,
      H = 4,
      n = W * H;
    const lab = new Int32Array(n).fill(300); // > 255 exercises the g/b bytes
    lab[0] = -1;
    lab[5] = 70000; // and > 65535 exercises the third byte
    core.W = W;
    core.H = H;
    core.labels = lab;

    const recovered = decodeLmap(core.lmapURL(), W, H);
    for (let i = 0; i < n; i++) assert.equal(recovered[i], lab[i], `pixel ${i} (label ${lab[i]})`);
  });
  test('currentDesignObj() persists Toggle state and settings (v227 #2)', () => {
    const W = 4,
      H = 4;
    core.W = W;
    core.H = H;
    core.labels = new Int32Array(W * H).fill(1);
    core.secState = new Uint8Array([0, 1, 0, 2]); // label 1 -> include, label 3 -> exclude
    core.colored = new Uint8Array([0, 0, 0, 0]);
    core.minPos = 33;
    core.bgTrim = 40;
    core.addAutoClose = true;
    core.curName = 'Test Guide'; // avoids the name-generator path
    core.assignData = { order: [1, 3], assign: { 1: { mkey: 'Ohuhu|120' }, 3: { mkey: 'Copic|100' } }, N: 2 };

    const d = core.currentDesignObj();
    assert.ok(d, 'design object built');
    // (minSize on the slider's scale since v277; minPos is the same size on the old scale, for older copies)
    assert.equal(d.payload.minSize, 33);
    assert.equal(d.payload.minPos, 7);
    assert.equal(d.payload.bgTrim, 40);
    assert.equal(d.payload.addAutoClose, true);
    // sparse map: only non-auto states, keyed by label
    assert.deepEqual({ ...d.payload.secStates }, { 1: 1, 3: 2 });
    // lmap present and non-trivial
    assert.ok(typeof d.payload.lmap === 'string' && d.payload.lmap.startsWith('data:'), 'lmap encoded');
  });
  // ---- From the persistence / import-safety fixes ----
  test('esc() and safeThumb() neutralise markup', () => {
    assert.equal(app.esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    assert.equal(app.safeThumb('data:image/jpeg;base64,AAAA+/=='), 'data:image/jpeg;base64,AAAA+/==');
    assert.equal(app.safeThumb('data:image/jpeg;base64,AA" onerror="x'), '');
    assert.equal(app.safeThumb('javascript:alert(1)'), '');
    assert.equal(app.safeThumb(null), '');
  });
  test('generated-palette source is saved with the guide (was always [])', () => {
    const W = 4,
      H = 4;
    core.W = W;
    core.H = H;
    core.labels = new Int32Array(W * H).fill(1);
    core.secState = new Uint8Array([0, 0]);
    core.colored = new Uint8Array([0, 0]);
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
  // v248: a guide file that isn't a guide is turned away before anything changes
  test('opening something that is not a guide changes nothing', () => {
    core.W = 4;
    core.H = 4;
    core.labels = new Int32Array(16).fill(1);
    const before = (core.assignData = { assign: {}, order: [], N: 0 });
    core.openDesignObj({ lmap: 'https://example.com/x.png', W: 50000, H: 50000 }, 99);
    assert.equal(core.assignData, before);
    core.openDesignObj({ lmap: 12 }, 99);
    assert.equal(core.assignData, before);
  });
}

// ---- from saved-state.test.mjs ----
// Reading and writing the saved state: one bad field costs only that field, marker numbers out of range or unknown
// are dropped, unreadable state is copied and left alone until the person acts, a save never drops Library entries
// another tab wrote, and the one-time collection migrations run once. Each test boots a fresh app instance against
// an in-memory localStorage, so we can simulate "what happens on the next launch".
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const stored = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [{ id: 7, type: 'palette', name: 'P', keys: ['Ohuhu|R014'], ts: 7 }],
      ...extra,
    });
  const boot = (json, more = {}) => {
    const ls = memoryStorage(json == null ? {} : { [KEY]: json, ...more });
    const a = createApp({ localStorage: ls });
    return { a, ls, ev: (s) => a.__eval(s) };
  };
  // ---- From the fifth review ----
  const bootQuiet = (json) => {
    const ls = memoryStorage(json == null ? {} : { [KEY]: json });
    const a = createApp({ localStorage: ls });
    a.__eval('fullRender=function(){};renderSaved=function(){}');
    return { a, ls, ev: (s) => a.__eval(s) };
  };
  const owned = (ev) => JSON.parse(ev('JSON.stringify([...state.owned].sort())'));
  // ---- From the persistence / import-safety fixes ----
  // A saved state as an existing user would have it after the one-time
  // migrations have run once.
  function storedState(extra = {}) {
    return JSON.stringify({
      mode: 'home',
      palSize: 4,
      harmony: 'complementary',
      tones: ['pale', 'light', 'mid', 'dark'],
      sats: ['neutral', 'muted', 'medium', 'vivid'],
      drawn: [],
      excluded: [],
      palettes: [],
      pool: null,
      brands: ['Ohuhu', 'Copic'],
      satsUpgraded: true,
      scopeFlipped: true,
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      owned: ['Ohuhu|120', 'Copic|E09'],
      saved: [],
      ...extra,
    });
  }
  const bootOwned = (json) => {
    const ls = memoryStorage(json == null ? {} : { [KEY]: json });
    const a = createApp({ localStorage: ls });
    return { a, ls, owned: () => [...a.__eval('state.owned')] };
  };
  // ---- From the fourth review ----
  test('a bad field is dropped on its own: the collection and the Library stay', () => {
    for (const bad of [
      { excluded: 5 },
      { excluded: 'x' },
      { tones: 3 },
      { palettes: 'abc' },
      { drawn: {} },
      { locked: 1 },
      { customPal: 'q' },
      { harmony: 12 },
      { palSize: 'big' },
    ]) {
      const { ev, ls } = boot(stored(bad));
      assert.equal(ev('state.owned.size'), 3, JSON.stringify(bad));
      assert.equal(ev('state.saved.length'), 1, JSON.stringify(bad));
      // v266: a setting put back to its default is a repair, not a loss: no copy is kept (review 5)
      assert.equal(ls.getItem('ms-state-backup'), null, 'no copy for a repaired setting');
    }
    // nothing to repair: no copy
    assert.equal(boot(stored()).ls.getItem('ms-state-backup'), null);
  });
  test('marker numbers out of range (or not numbers) are dropped', () => {
    const { ev } = boot(
      stored({
        mode: 'palette',
        palettes: [[5000, 1], [2, 3], 'x', []],
        drawn: [9999, 2, 2, -1, 'a', 1.5],
        customPal: [7000, 3, null],
        pool: [99999],
        locked: [4, 8000],
      }),
    );
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.palettes)')), [[2, 3]]);
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.drawn)')), [2]);
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.customPal)')), [null, 3, null]);
    assert.equal(ev('state.pool'), null);
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.locked)')), [4]);
  });
  test('a broken collection in a recent state is empty, not the 451-marker default; a real pre-v2 state still migrates', () => {
    assert.equal(boot(stored({ owned: 'abc' })).ev('state.owned.size'), 0);
    assert.equal(boot(stored({ owned: { a: 1 } })).ev('state.owned.size'), 0);
    const legacy = JSON.parse(stored());
    delete legacy.ownedSeedV;
    delete legacy.copicAdd1;
    delete legacy.libAdj1;
    delete legacy.setFix1;
    assert.ok(boot(JSON.stringify(legacy)).ev('state.owned.size') > 100);
    legacy.owned = [];
    assert.equal(
      boot(JSON.stringify(legacy)).ev('state.owned.size'),
      0,
      'an empty old collection stays empty',
    );
  });
  test('unreadable state is copied and not written over until the person acts', () => {
    const { a, ls } = boot('{"owned":["Ohuhu|R014"],');
    assert.equal(ls.getItem('ms-state-backup'), '{"owned":["Ohuhu|R014"],');
    assert.equal(a.save(), true);
    assert.equal(ls.getItem(KEY), '{"owned":["Ohuhu|R014"],', 'left as it was');
    a.__eval('_saveHold=false');
    a.save();
    assert.equal(JSON.parse(ls.getItem(KEY)).ownedSeedV, 2, 'saves again after a tap');
  });
  test('a save keeps Library entries another tab wrote meanwhile, but not ones this tab deleted', () => {
    const { a, ls, ev } = boot(stored());
    const other = JSON.parse(ls.getItem(KEY));
    other.saved.push(
      { id: 8, type: 'palette', name: 'From B', keys: ['Ohuhu|Y111'], ts: 8 },
      { id: 9, type: 'guide', name: 'G', keys: [], ts: 9 },
    );
    ls.setItem(KEY, JSON.stringify(other));
    a.save();
    assert.deepEqual(
      JSON.parse(ls.getItem(KEY))
        .saved.map((s) => s.id)
        .sort(),
      [7, 8, 9],
    );
    assert.equal(ev('state.saved.length'), 3, 'and this tab now has them too');
    // deleted here: another tab's older copy doesn't bring it back
    ev('state.saved=state.saved.filter(s=>s.id!==8);forgetSaved(8)');
    ls.setItem(KEY, JSON.stringify(other));
    a.save();
    assert.deepEqual(
      JSON.parse(ls.getItem(KEY))
        .saved.map((s) => s.id)
        .sort(),
      [7, 9],
    );
  });
  test('storage full: keep() puts the change back and reports false', () => {
    const ls = memoryStorage({ [KEY]: stored() });
    const a = createApp({ localStorage: ls });
    ls.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    a.__eval("state.owned.delete('Ohuhu|R014')");
    assert.equal(a.__eval("keep(function(){state.owned.add('Ohuhu|R014')})"), false);
    assert.equal(a.__eval("state.owned.has('Ohuhu|R014')"), true);
  });
  test('v265: only losses the person would notice leave a note for Home (markers, palettes, guides, or all of it)', () => {
    const note = (json) => {
      const n = boot(json).ls.getItem('ms-load-note');
      return n == null ? null : JSON.parse(n);
    };
    for (const bad of [
      { excluded: 5 },
      { tones: 3 },
      { palettes: 'abc' },
      { drawn: {} },
      { harmony: 12 },
      { palSize: 'big' },
    ])
      assert.equal(note(stored(bad)), null, JSON.stringify(bad));
    assert.equal(note(stored()), null);
    assert.deepEqual(note(stored({ owned: [...OWN, 5, null] })), { markers: 2, palettes: 0, guides: 0 });
    assert.deepEqual(note(stored({ owned: 'abc' })), { markers: -1, palettes: 0, guides: 0 });
    assert.deepEqual(
      note(
        stored({
          saved: [
            { id: 7, type: 'palette', keys: [] },
            { id: 'x', type: 'palette' },
            { id: -2, type: 'guide' },
            null,
          ],
        }),
      ),
      { markers: 0, palettes: 2, guides: 1 },
    );
    assert.deepEqual(note(stored({ saved: 'abc' })), { markers: 0, palettes: -1, guides: -1 });
    assert.deepEqual(note('{"owned":["Ohuhu|R014"],'), { all: true });
    // a copy of the original is kept whenever there is a note
    const { ls } = boot(stored({ owned: [...OWN, 5] }));
    assert.equal(ls.getItem('ms-state-backup'), stored({ owned: [...OWN, 5] }));
  });
  test('marker keys the app does not know are dropped; a renamed code is moved to its new one', () => {
    const { ev, ls } = bootQuiet(stored({ owned: [...OWN, 'Ohuhu|NOPE1', 'Copic|ZZ9', 'Ohuhu|B090'] }));
    assert.deepEqual(
      owned(ev),
      ['Ohuhu|B015', 'Ohuhu|B08', 'Ohuhu|R014', 'Ohuhu|Y111'],
      'B090 is now B015; the unknown two are gone',
    );
    assert.equal(ev('state.owned.size'), 4, 'counted as shown');
    assert.equal(ls.getItem('ms-load-note'), null, 'not a loss to report: they could never be shown');
    assert.equal(ls.getItem('ms-state-backup'), null);
    ev('save(true)');
    assert.deepEqual(
      JSON.parse(ls.getItem(KEY)).owned.sort(),
      ['Ohuhu|B015', 'Ohuhu|B08', 'Ohuhu|R014', 'Ohuhu|Y111'],
      'and not written back',
    );
    // an old code that is also another marker's current code stays that marker
    assert.equal(ev("knownMkey('Ohuhu|R23')"), 'Ohuhu|R23');
    assert.equal(ev("knownMkey('Ohuhu|NOPE')"), null);
  });
  test('the copy of the saved text is kept only when something was lost', () => {
    assert.equal(
      bootQuiet(stored({ excluded: 5, tones: 3 })).ls.getItem('ms-state-backup'),
      null,
      'repaired settings: no copy',
    );
    assert.equal(
      bootQuiet(stored({ saved: [{ id: -1, type: 'palette' }] })).ls.getItem('ms-state-backup'),
      stored({ saved: [{ id: -1, type: 'palette' }] }),
      'a palette lost: kept',
    );
  });
  test('Photo: a size that is not one of its choices moves to the nearest', () => {
    const { ev } = bootQuiet(stored());
    assert.deepEqual(
      [3, 5, 7, 9, 11, 13, 14, 15, 2].map((n) => ev(`photoSnap(${n})`)),
      [4, 4, 6, 8, 10, 12, 12, 16, 4],
    );
    ev("state.mode='home';state.harmony='complementary';state.palSize=5;setHarmony('photo')");
    assert.equal(ev('state.palSize'), 4);
    assert.equal(
      bootQuiet(stored({ harmony: 'photo', palSize: 7 })).ev('state.palSize'),
      6,
      'also a saved one',
    );
  });
  test('one-time collection migrations do not re-run on every launch', () => {
    // User owns Copic E09 (the migration deletes it) and not Copic B26 (the migration adds it).
    const { a, ls, owned } = bootOwned(storedState());
    assert.ok(owned().includes('Copic|E09'), 'E09 must not be removed again');
    assert.ok(!owned().includes('Copic|B26'), 'B26 must not be re-added');
    a.save();
    const saved = JSON.parse(ls.getItem(KEY));
    assert.equal(saved.copicAdd1, 1, 'copicAdd1 flag persisted');
    assert.equal(saved.libAdj1, 1, 'libAdj1 flag persisted');
    // second launch from what was just saved: still intact
    const again = bootOwned(ls.getItem(KEY));
    assert.deepEqual(again.owned().sort(), ['Copic|E09', 'Ohuhu|120']);
  });
  test('an intentionally empty collection stays empty after relaunch', () => {
    const { owned } = bootOwned(storedState({ owned: [] }));
    assert.equal(owned().length, 0);
  });
  test('a brand-new install starts with an empty collection (no author defaults)', () => {
    const { a, ls, owned } = bootOwned(null);
    assert.equal(owned().length, 0);
    a.save();
    const saved = JSON.parse(ls.getItem(KEY));
    // the author-specific one-time migrations are marked done, so they never add markers later
    assert.equal(saved.ownedSeedV, 2);
    assert.equal(saved.copicAdd1, 1);
    assert.equal(saved.libAdj1, 1);
    assert.equal(bootOwned(ls.getItem(KEY)).owned().length, 0, 'still empty on relaunch');
  });
  test('existing users keep their collection (defaults only for legacy pre-v2 state)', () => {
    const legacy = JSON.parse(storedState());
    delete legacy.ownedSeedV;
    delete legacy.copicAdd1;
    delete legacy.libAdj1;
    const { owned } = bootOwned(JSON.stringify(legacy));
    assert.ok(owned().length > 100, 'legacy (pre-seed-v2) state still migrates to the old default');
  });
  test('library entries are sanitised on load (ids, thumbs, keys)', () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const { a } = bootOwned(
      storedState({
        saved: [
          { id: evil, type: 'palette', name: 'bad id', keys: ['Ohuhu|120'] },
          {
            id: 5,
            type: 'guide',
            name: 'x',
            keys: ['Ohuhu|120', 3, null],
            thumb: 'data:x" onerror="alert(1)',
          },
          { id: 6, type: 'palette', name: 'fine', keys: ['Ohuhu|120'] },
          'junk',
        ],
      }),
    );
    const saved = JSON.parse(JSON.stringify(a.__eval('state.saved')));
    assert.deepEqual(
      saved.map((s) => s.id),
      [5, 6],
      'non-numeric id and junk dropped',
    );
    assert.equal(saved[0].thumb, '', 'unsafe thumb cleared');
    assert.deepEqual(saved[0].keys, ['Ohuhu|120'], 'non-string keys dropped');
  });
  test('a guide’s coloured count survives loading only as a whole number', () => {
    const { a } = bootOwned(
      storedState({
        saved: [
          { id: 1, type: 'guide', name: 'a', keys: [], n: 10, done: 4 },
          { id: 2, type: 'guide', name: 'b', keys: [], n: 10, done: 2.5 },
          { id: 3, type: 'guide', name: 'c', keys: [], n: 10, done: -1 },
          { id: 4, type: 'guide', name: 'd', keys: [], n: 10, done: '3' },
          { id: 5, type: 'guide', name: 'e', keys: [], n: 10, done: 0 },
        ],
      }),
    );
    const saved = JSON.parse(JSON.stringify(a.__eval('state.saved')));
    assert.deepEqual(
      saved.map((s) => ('done' in s ? s.done : null)),
      [4, null, null, null, 0],
    );
  });
  // v244: set lists that were one colour short.
  test('owners of a set that was one colour short get the missing colour once', () => {
    const sets = createApp({ localStorage: memoryStorage() }).__eval('OHUHU_SETS');
    const old120 = sets['120']
      .split(' ')
      .filter((c) => c !== 'BV38')
      .map((c) => 'Ohuhu|' + c);
    const st = JSON.parse(storedState({ owned: [...old120, 'Copic|E09'] }));
    delete st.setFix1;
    const { a, ls, owned } = bootOwned(JSON.stringify(st));
    assert.ok(owned().includes('Ohuhu|BV38'), 'BV38 added for a 120-set owner');
    assert.ok(!owned().includes('Ohuhu|YR06'), 'no colours from sets they do not own');
    assert.equal(JSON.parse(ls.getItem(KEY)).setFix1, 1, 'runs once');
    // someone who deliberately removed it afterwards keeps it removed
    a.__eval("state.owned.delete('Ohuhu|BV38');save()");
    assert.ok(!bootOwned(ls.getItem(KEY)).owned().includes('Ohuhu|BV38'));
  });
  test('the set fix leaves partial collections alone', () => {
    const st = JSON.parse(storedState({ owned: ['Ohuhu|Y07', 'Ohuhu|Y111'] }));
    delete st.setFix1;
    const { owned } = bootOwned(JSON.stringify(st));
    assert.deepEqual(owned().sort(), ['Ohuhu|Y07', 'Ohuhu|Y111']);
  });
}

// ---- from style-fields.test.mjs ----
// A guide's style settings in the saved guide: the exact form currentDesignObj() writes them in (names, nesting,
// order), and the value each setting starts with. The browser tests (e2e/style-fields.test.mjs) cover opening,
// Undo and the rest; these pin the saved text itself, so any change to how the style is listed shows up here.
{
  // every setting, by the name of the variable that holds it (as __mstest.styleVars reads them)
  const NAMES = [
    'family',
    'palette',
    'theme',
    'gradShape',
    'dir',
    'look',
    'emphasis',
    'limitN',
    'gradIncl',
    'noAdj',
    'balance',
    'balM',
    'balS',
    'balA',
    'balSeed',
    'noRep',
    'matchAlike',
    'gradSeed',
    'blendFall',
    'blendMix',
    'texAmt',
    'radC',
    'shadeMode',
    'shadeSun',
    'shadeRound',
    'shadeLines',
    'shadeHi',
    'shadeLo',
    'shadeLight',
    'shadeMain',
    'shadeShadow',
    'shadeHilite',
    'shadeFlat',
    'photoXf',
    'photoOp',
    'photoPaper',
    'expand',
    'expandChar',
    'paletteSource',
    'savedPalId',
    'genHarmony',
    'genPal',
    'fromPal',
    'minPos',
    'bgTrim',
    'addAutoClose',
    'famRule',
    'lowX',
    'smpTry',
    'gradArea',
    'bgRule',
    'hatchOne',
  ];
  const plain = (v) => JSON.parse(JSON.stringify(v));
  // a small guide with every setting away from its default
  function scene() {
    const app = createApp(),
      core = app.__mstest,
      sv = core.styleVars;
    const W = 4,
      H = 4;
    core.W = W;
    core.H = H;
    core.labels = new Int32Array(W * H).fill(1);
    for (let i = 8; i < 16; i++) core.labels[i] = 3;
    core.secState = new Uint8Array(4);
    core.colored = new Uint8Array(4);
    core.curName = 'Styled';
    core.assignData = { order: [1, 3], assign: { 1: { mkey: 'Ohuhu|R16' }, 3: { mkey: 'Ohuhu|B06' } }, N: 2 };
    Object.assign(sv, {
      family: 'blend',
      palette: 'cool',
      theme: 'ocean',
      gradShape: 'diagonal',
      dir: -1,
      look: 'ltd',
      emphasis: 'pastel',
      limitN: 7,
      noAdj: true,
      balance: 'mixed',
      balM: 'blue',
      balS: 'auto',
      balA: 'orange',
      balSeed: 0.5,
      noRep: true,
      gradSeed: 0.25,
      blendFall: 3.4,
      blendMix: 'vivid',
      texAmt: 0.75,
      radC: { x: 0.3, y: 0.7 },
      shadeMode: 'shadow',
      shadeSun: { x: 0.9, y: 0.05 },
      shadeRound: 0.35,
      shadeLines: false,
      shadeHi: 0.6,
      shadeLo: 0.15,
      shadeLight: 'sun',
      shadeShadow: 'grey',
      shadeHilite: 'paper',
      shadeFlat: { 3: 1, 1: 1 },
      photoOp: 0.4,
      photoPaper: false,
      expand: true,
      expandChar: 0.1,
      paletteSource: 'saved',
      savedPalId: 99,
      // (a palette marker kept as a catalogue index is saved as its key)
      genHarmony: 'tetradic',
      genPal: ['Ohuhu|R16', 0, 'Ohuhu|B06'],
      minPos: 12,
      bgTrim: 64,
      addAutoClose: true,
      // (v308: the palette handed over from Palette's Use in a guide, its name and scheme)
      fromPal: { name: 'Sunset strip', h: 'photo' },
    });
    return { app, core };
  }
  test('each style setting’s first value (a guide that changes nothing is saved with these)', () => {
    const sv = createApp().__mstest.styleVars;
    const got = {};
    for (const k of NAMES) got[k] = plain(sv[k]);
    assert.deepEqual(got, {
      family: 'gradient',
      palette: 'all',
      theme: '',
      gradShape: 'serpentine',
      dir: 1,
      look: 'auto',
      emphasis: 'neutral',
      limitN: 16,
      // (v308: no Include row until a new picture gives it one; a guide saved before has none)
      gradIncl: null,
      // (v323: on for a new guide)
      noAdj: true,
      balance: 'main',
      balM: 'auto',
      balS: 'auto',
      balA: 'auto',
      balSeed: 0,
      noRep: false,
      matchAlike: false,
      gradSeed: 0,
      blendFall: 2,
      blendMix: 'soft',
      texAmt: 0.5,
      radC: null,
      shadeMode: 'off',
      shadeSun: { x: 0.2, y: 0.12 },
      shadeRound: 0.5,
      shadeLines: true,
      shadeHi: 0.5,
      shadeLo: 0.5,
      shadeLight: 'auto',
      shadeMain: true,
      shadeShadow: 'same',
      shadeHilite: 'same',
      shadeFlat: {},
      photoXf: null,
      photoOp: 0.65,
      photoPaper: true,
      expand: false,
      expandChar: 0.5,
      paletteSource: 'owned',
      savedPalId: null,
      genHarmony: 'analogous',
      genPal: [],
      // (v308: no palette handed over from Palette's Use in a guide)
      fromPal: null,
      minPos: 30,
      bgTrim: 50,
      addAutoClose: false,
      // (v313: a guide saved before keeps v312's family rule; a new picture sets 1)
      famRule: 0,
      // (v313: no running-low line closed)
      lowX: null,
      // (v313: not the sample tried)
      smpTry: 0,
      // (v314: a guide saved before keeps v313's Gradient area rule)
      gradArea: 0,
      // (v318.12: a guide saved before keeps its background as it was)
      bgRule: 0,
      // (v318.35: Treat hatching as one section, on unless turned off)
      hatchOne: true,
    });
  });
  test('the saved style: its exact text, nesting and order', () => {
    const { app, core } = scene();
    const k0 = app.__eval('mkey(0)');
    const d = core.currentDesignObj();
    assert.equal(
      JSON.stringify(d.payload.style),
      '{"family":"blend","palette":"cool","theme":"ocean","gradShape":"diagonal","dir":-1,"look":"ltd","emphasis":"pastel","limitN":7,' +
        '"noAdj":true,"balance":"mixed","balM":"blue","balS":"auto","balA":"orange","balSeed":0.5,"noRep":true,' +
        '"gradSeed":0.25,"blendFall":3.4,"blendVivid":true,"blendMix":"vivid","texAmt":0.75,"radC":{"x":0.3,"y":0.7},' +
        '"shade":{"mode":"shadow","x":0.9,"y":0.05,"round":0.35,"lines":false,"hi":0.6,"lo":0.15,"lightSrc":"sun","light":"sun","main":true,"shadow":"grey","hilite":"paper","flat":[1,3]},' +
        '"photo":null,"expand":true,"expandChar":0.1,"paletteSource":"saved","savedPalId":99,"genHarmony":"tetradic",' +
        // (v308: fromPal, last, written only while a palette handed over from Palette is in use: see below)
        '"genPal":["Ohuhu|R16","' +
        k0 +
        '","Ohuhu|B06"],"fromPal":{"name":"Sunset strip","h":"photo"}}',
    );
    // the section settings are saved beside the style, in this place among the rest
    // (v318.34: `src`, the picture's settings, after frame; undefined here, as for the sample: written only for a guide
    // built from a picture of the person's own)
    assert.deepEqual(Object.keys(d.payload), [
      'lmap',
      'ref',
      'paper',
      'assign',
      'style',
      'anchors',
      'prog',
      'tones',
      'held',
      'dates',
      'out',
      'edits',
      'base',
      'locks',
      'white',
      'upk',
      'frame',
      'src',
      'minPos',
      'minSize',
      'bgTrim',
      'addAutoClose',
      'secStates',
    ]);
    assert.equal(d.payload.src, undefined);
    // (the smallest section: minSize on the slider's scale since v277, minPos on the old one for older copies)
    assert.deepEqual(
      [d.payload.minSize, d.payload.minPos, d.payload.bgTrim, d.payload.addAutoClose],
      [12, 3, 64, true],
    );
    // a guide file to share has the same style
    assert.equal(JSON.stringify(core.currentDesignObj(true).payload.style), JSON.stringify(d.payload.style));
  });
  test('fromPal (v308): not written without a palette handed over, so other guides save as before; odd values open as none', () => {
    const { core } = scene();
    core.styleVars.fromPal = null;
    const st = core.currentDesignObj().payload.style;
    assert.ok(!('fromPal' in st));
    assert.equal(Object.keys(st).pop(), 'genPal');
    const f = [...core.styleFields].find((x) => x.key === 'fromPal');
    assert.deepEqual(plain(f.check({ name: 'Rainbow', h: 'rainbow' }, null)), {
      name: 'Rainbow',
      h: 'rainbow',
    });
    // (a scheme the app doesn't know is none; no name is "Palette"; a long one is cut short)
    assert.deepEqual(plain(f.check({ name: '', h: 'loud' }, null)), { name: 'Palette', h: null });
    assert.equal(f.check({ name: 'x'.repeat(200) }, null).name.length, 80);
    for (const v of [undefined, null, 'Rainbow', 3, true, ['a']])
      assert.equal(f.check(v, null), null, String(v));
  });
  test('the saved style with a photo: its placement, see-through, white areas and lighting correction', () => {
    const { core } = scene();
    core.photoXf = { cx: 1, cy: 2, sx: 0.5, sy: 0.75, r: 0.1 };
    // (no photo loaded: nothing is saved for it)
    assert.equal(core.currentDesignObj().payload.style.photo, null);
    // a photo in place (the rest of setPhotoRef, lining it up and recolouring, needs a page and stops here; the photo
    // is set first)
    try {
      core.setPhotoRef(
        { w: 4, h: 4, data: new Uint8ClampedArray(64), url: 'data:image/jpeg;base64,AAAA' },
        true,
      );
    } catch (_) {}
    core.photoXf = { cx: 1, cy: 2, sx: 0.5, sy: 0.75, r: 0.1 };
    core.styleVars.family = 'gradient';
    core.styleVars.photoOp = 0.4;
    core.styleVars.photoPaper = false;
    const d = core.currentDesignObj();
    // (a black 4 x 4 photo is no page: no lighting correction found, light: false)
    assert.equal(
      JSON.stringify(d.payload.style.photo),
      '{"xf":{"cx":1,"cy":2,"sx":0.5,"sy":0.75,"r":0.1},"op":0.4,"paper":false,"light":false}',
    );
    assert.equal(d.payload.ref, 'data:image/jpeg;base64,AAAA');
    // a guide file to share leaves the photo out unless the pattern uses it, but keeps its settings
    const s = core.currentDesignObj(true);
    assert.equal(s.payload.ref, undefined);
    assert.equal(JSON.stringify(s.payload.style), JSON.stringify(d.payload.style));
    core.styleVars.family = 'photo';
    assert.equal(core.currentDesignObj(true).payload.ref, 'data:image/jpeg;base64,AAAA');
  });
  // ---- the list itself (STYLE_FIELDS, js/guide/05-style-fields.js) ----

  test('STYLE_FIELDS: every default is its variable’s first value, and what a file that says nothing opens with', () => {
    const core = createApp().__mstest,
      sv = core.styleVars;
    const VAR = {
      mode: 'shadeMode',
      round: 'shadeRound',
      lines: 'shadeLines',
      hi: 'shadeHi',
      lo: 'shadeLo',
      lightSrc: 'shadeLight',
      main: 'shadeMain',
      shadow: 'shadeShadow',
      hilite: 'shadeHilite',
      minSize: 'minPos',
      incl: 'gradIncl',
      smp: 'smpTry',
    };
    let n = 0;
    for (const f of core.styleFields) {
      if (!('def' in f)) continue;
      const first = f.key === 'x' ? sv.shadeSun.x : f.key === 'y' ? sv.shadeSun.y : sv[VAR[f.key] || f.key];
      // (v323: a setting a new guide starts with otherwise than an old file that says nothing: first, noAdj)
      assert.deepEqual(plain('first' in f ? f.first : f.def), plain(first), f.key);
      assert.deepEqual(plain(f.check(undefined, f.def)), plain(f.def), f.key + ' (missing)');
      n++;
    }
    // (v306: 42, with Scatter's gradScat, gradJit and gradFix; v308: 43, with the Gradient's Include row; 44 with
    // fromPal, the palette Palette's Use in a guide handed over, which Mood and Shuffle keep as it is; v313:
    // 45 with famRule, the family rule; 46 with lowX, the running-low lines closed;
    // 47 with smp, the sample not yet printed or renamed; v314: 48 with gradArea, the Gradient's area rule; v318.12: 49
    // with bgRule, the background rule; v318.15: 50 with matchAlike, Matching shapes alike; v318.18: 51 with theme;
    // v318.35: 52 with hatchOne, Treat hatching as one section; v323: 54 with colOffer, the coloured-in sections offered as
    // done, and focusAt, the section Focus mode was left on)
    assert.equal(n, 54);
  });
  test('STYLE_FIELDS: where each setting is saved (in the order written) and which ones Undo keeps', () => {
    const core = createApp().__mstest;
    assert.deepEqual(
      [...core.styleFields].map((f) => f.in + '.' + f.key + (f.undo ? '' : ' (no undo)')),
      [
        'style.family',
        'style.palette',
        'style.theme',
        'style.gradShape',
        'style.dir',
        'style.look',
        'style.emphasis',
        'style.limitN',
        'style.incl',
        'style.noAdj',
        'style.balance',
        'style.balM',
        'style.balS',
        'style.balA',
        'style.balSeed',
        'style.noRep',
        'style.matchAlike',
        'style.gradSeed',
        'style.gradScat',
        'style.gradJit',
        'style.gradFix',
        'style.blendFall',
        'style.blendVivid (no undo)',
        'style.blendMix',
        'style.texAmt',
        'style.radC',
        'shade.mode',
        'shade.x',
        'shade.y',
        'shade.round',
        'shade.lines',
        'shade.hi',
        'shade.lo',
        'shade.lightSrc',
        'shade.light (no undo)',
        'shade.main',
        'shade.shadow',
        'shade.hilite',
        'shade.flat',
        'style.photo (no undo)',
        'style.expand',
        'style.expandChar',
        'style.paletteSource',
        'style.savedPalId',
        'style.genHarmony',
        'style.genPal',
        'style.fromPal',
        'payload.minPos (no undo)',
        'payload.minSize (no undo)',
        'payload.bgTrim (no undo)',
        'payload.addAutoClose (no undo)',
        'payload.famRule (no undo)',
        'payload.lowX (no undo)',
        'payload.colOffer (no undo)',
        'payload.focusAt (no undo)',
        'payload.smp (no undo)',
        'payload.gradArea (no undo)',
        'payload.bgRule (no undo)',
        'payload.hatchOne (no undo)',
      ],
    );
  });
  test('STYLE_FIELDS: Mood takes all six (an old guide’s vivid and muted are Bright and Soft), Look its three', () => {
    const core = createApp().__mstest,
      f = (k) => [...core.styleFields].find((x) => x.key === k);
    const em = f('emphasis'),
      lk = f('look');
    for (const v of ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'])
      assert.equal(em.check(v, em.def), v);
    assert.equal(em.check('loud', em.def), 'neutral');
    assert.equal(em.check(undefined, em.def), 'neutral');
    for (const v of ['auto', 'smooth', 'ltd']) assert.equal(lk.check(v, lk.def), v);
    assert.equal(lk.check('fancy', lk.def), 'auto');
    assert.equal(lk.check(undefined, lk.def), 'auto');
  });
  test('Blend’s Mix: its three; a guide saved before it (only blendVivid) opens as Vivid if that was ticked; blendVivid is still written, for older copies of the app', () => {
    const core = createApp().__mstest,
      sv = core.styleVars,
      f = [...core.styleFields].find((x) => x.key === 'blendMix');
    for (const v of ['soft', 'vivid', 'paint']) assert.equal(f.check(v, f.def, { blendMix: v }), v);
    // an older guide: no blendMix, the tick box as it was
    assert.equal(f.check(undefined, f.def, { blendVivid: true }), 'vivid');
    assert.equal(f.check(undefined, f.def, { blendVivid: false }), 'soft');
    assert.equal(f.check(undefined, f.def, {}), 'soft');
    // anything but true (a hand-edited file) is not ticked; a Mix that is saved wins over the old tick box
    assert.equal(f.check(undefined, f.def, { blendVivid: 1 }), 'soft');
    assert.equal(f.check('paint', f.def, { blendVivid: true }), 'paint');
    assert.equal(f.check('loud', f.def, { blendVivid: false }), 'soft');
    assert.equal(f.check('loud', f.def, { blendVivid: true }), 'vivid');
    // what is written: blendVivid true only for Vivid (Like paint opens as Soft in an older copy)
    const saved = (mix) => {
      sv.blendMix = mix;
      return core.styleFields.find((x) => x.key === 'blendVivid').save();
    };
    assert.deepEqual(['soft', 'vivid', 'paint'].map(saved), [false, true, false]);
  });
  test('the smallest section (v277): 2 to 400 px evenly by ratio, 10 px to begin with; a guide saved before keeps its size', () => {
    const core = createApp().__mstest;
    assert.deepEqual([core.minPx(0), core.minPx(core.MIN_DEF), core.minPx(100)], [2, 10, 400]);
    const f = (k) => [...core.styleFields].find((x) => x.key === k);
    // a guide from before v277 says only minPos, on the old scale (2 + t² × 1998 px): 26 was 137 px, now about 80
    assert.equal(f('minSize').check(undefined, 30, { minPos: 26 }), 80);
    assert.ok(Math.abs(core.minPx(80) - 137) <= 3);
    assert.equal(f('minSize').check(undefined, 30, { minPos: 0 }), 0);
    assert.equal(f('minSize').check(undefined, 30, {}), 30, 'nothing saved: the new first place');
    // minSize wins when both are there; out of range is kept in range
    assert.equal(f('minSize').check(45, 30, { minPos: 26 }), 45);
    assert.equal(f('minSize').check(140, 30, {}), 100);
    // and what older copies read back: the same size on their scale
    assert.equal(core.minPosOld(80), 26);
  });
  test('Light from (v281): auto, the sun or the photo; a guide saved before has only light, whose photo was its default (auto), and light is still written for older copies of the app', () => {
    const core = createApp().__mstest,
      f = (k) => [...core.styleFields].find((x) => x.key === k);
    const ls = f('lightSrc');
    for (const v of ['auto', 'sun', 'photo']) assert.equal(ls.check(v, ls.def, { light: 'sun' }), v);
    assert.equal(
      ls.check(undefined, ls.def, { light: 'photo' }),
      'auto',
      'the old default: the photo only with the Photo pattern',
    );
    assert.equal(ls.check(undefined, ls.def, { light: 'sun' }), 'sun');
    assert.equal(ls.check(undefined, ls.def, {}), 'auto');
    assert.equal(ls.check('moon', ls.def, {}), 'auto');
    // (older copies are told the sun only when it's chosen; else their own default, the photo with the Photo pattern)
    assert.equal(f('light').save(), 'photo');
    core.styleVars.shadeLight = 'sun';
    assert.equal(f('light').save(), 'sun');
    core.styleVars.shadeLight = 'photo';
    assert.equal(f('light').save(), 'photo');
    assert.equal(f('light').check, undefined, 'only written');
  });
}

// ---- from v304-persist.test.mjs ----
// v304 (backup and saving): in a browser tab where Safari's seven-day rule applies (any browser on an iPhone or iPad,
// Safari on a Mac; not the Home Screen app), the backup reminder is also due once after a guide's first coloured
// section and on a visit after five days or more away, for guides or palettes (not markers only); a guide the last
// backup couldn't read makes it due at once; a restore says what it kept beside the backup's guides; and markers.json
// may only grow at the end (saved palettes and draws keep positions in it).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const KEY = 'ohuhu-hb320-picker-v3',
    DAY = 864e5;
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const stored = (saved = []) =>
    JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved });
  const UA = {
    ipad: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      maxTouchPoints: 5,
      standalone: false,
    },
    iphone: {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      maxTouchPoints: 5,
      standalone: false,
    },
    homeScreen: {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      maxTouchPoints: 5,
      standalone: true,
    },
    macSafari: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      maxTouchPoints: 0,
    },
    macChrome: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      maxTouchPoints: 0,
    },
    android: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      maxTouchPoints: 5,
    },
    linuxWebKit: {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      maxTouchPoints: 0,
    },
  };
  const guide = (id, extra = {}) => ({
    id,
    type: 'guide',
    name: 'G' + id,
    keys: [],
    W: 1,
    H: 1,
    n: 4,
    ts: Date.now() - DAY / 2,
    ...extra,
  });
  function boot(nav, saved, extra = {}) {
    const ls = memoryStorage({ [KEY]: stored(saved), 'ms-onboarded': '1', ...extra });
    const a = createApp({ localStorage: ls, navigator: nav });
    return { a, ls, why: () => a.__eval('(backupDue() || {}).why || null') };
  }
  test('v304 D8: in a Safari tab, due once after a guide’s first coloured section; never in the Home Screen app or other browsers', () => {
    const coloured = [guide(5, { done: 1 })];
    assert.equal(boot(UA.ipad, coloured).why(), 'first', 'iPad tab');
    assert.equal(boot(UA.iphone, coloured).why(), 'first', 'iPhone tab');
    assert.equal(boot(UA.macSafari, coloured).why(), 'first', 'Safari on a Mac');
    for (const k of ['homeScreen', 'macChrome', 'android', 'linuxWebKit'])
      assert.equal(boot(UA[k], coloured).why(), null, k + ': only the 14-day rule (v303)');
    // a guide only built (nothing coloured), or markers only: not yet
    assert.equal(boot(UA.ipad, [guide(5, { fresh: 1 })]).why(), null);
    assert.equal(boot(UA.ipad, [guide(5)]).why(), null, 'saved but nothing coloured');
    assert.equal(boot(UA.ipad, []).why(), null, 'markers only');
    // once: put away (Later / Not now), it doesn't come back as "first"
    const b = boot(UA.ipad, coloured);
    b.a.__eval('backupLater()');
    assert.equal(b.ls.getItem('ms-backup-first'), '1');
    assert.ok(+b.ls.getItem('ms-backup-snooze') > Date.now() + 6 * DAY, 'a week’s rest');
    assert.equal(b.why(), null);
    // a backup was made once: then it's the gap rule's turn, not this one
    assert.equal(
      boot(UA.ipad, coloured, { 'ms-guides-backup-ts': String(Date.now() - 3 * DAY) }).why(),
      null,
    );
  });
  test('v304 D8: in a Safari tab, due on a visit after five days or more away, for guides or palettes changed since the last backup', () => {
    const at = { 'ms-guides-backup-ts': String(Date.now() - 8 * DAY) },
      changed = [guide(5, { done: 2, bk: Date.now() - 8 * DAY })];
    assert.equal(
      boot(UA.ipad, changed, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(),
      'gap',
    );
    assert.equal(
      boot(UA.ipad, changed, { ...at, 'ms-last-visit': String(Date.now() - 4 * DAY) }).why(),
      null,
      'four days away',
    );
    assert.equal(boot(UA.ipad, changed, at).why(), null, 'no visit before this one');
    assert.equal(
      boot(UA.macChrome, changed, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(),
      null,
      'not Chrome',
    );
    // markers only (changed since the backup): due too (v318.1; it had waited for the 14-day rule)
    assert.equal(
      boot(UA.ipad, [], {
        ...at,
        'ms-backup-sig': 'old',
        'ms-last-visit': String(Date.now() - 6 * DAY),
      }).why(),
      'gap',
    );
    // nothing changed since the backup: nothing to say (v318.1: the markers' fingerprint the backup kept, as theirs count)
    const safe = [guide(5, { done: 2, ts: Date.now() - 9 * DAY, bk: Date.now() - 8 * DAY })],
      s0 = boot(UA.ipad, safe, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) });
    s0.ls.setItem('ms-backup-sig', s0.a.__eval('dataSig()'));
    assert.equal(s0.why(), null);
    // this visit is noted for the next one
    const b = boot(UA.ipad, changed, at);
    assert.ok(Math.abs(+b.ls.getItem('ms-last-visit') - Date.now()) < 5000);
    // the 14-day rule is unchanged everywhere
    assert.equal(
      boot(UA.macChrome, changed, { 'ms-guides-backup-ts': String(Date.now() - 15 * DAY) }).why(),
      'age',
    );
  });
  test('v304 P4: a guide the last backup couldn’t read makes the reminder due at once, until it is backed up or gone', () => {
    const gs = [guide(5, { done: 1, bk: 1 }), guide(6, { done: 1, bk: Date.now() })];
    const b = boot(UA.macChrome, gs, {
      'ms-guides-backup-ts': String(Date.now()),
      'ms-backup-missed': '[5]',
    });
    assert.equal(b.why(), 'missed');
    assert.equal(b.a.__eval('backupDue().miss'), 1);
    b.a.__eval('state.saved = state.saved.filter((s) => s.id !== 5)');
    assert.equal(b.why(), null, 'deleted: nothing left to back up');
    assert.equal(
      boot(UA.macChrome, gs, { 'ms-guides-backup-ts': String(Date.now()) }).why(),
      null,
      'without it (v303): two weeks',
    );
  });
  test('v304: what a restore kept beside the backup’s guides, in words', () => {
    const { a } = boot(UA.macChrome, []);
    assert.equal(a.restoreKeptWords({}), '');
    assert.equal(
      a.restoreKeptWords({ kept: 1 }),
      ' 1 guide changed here since your last backup was kept as “… (before restore)”.',
    );
    assert.equal(
      a.restoreKeptWords({ lost: 1 }),
      ' 1 guide stored on this device but not in your Library was left as it is — add it back from Home.',
    );
    assert.equal(
      a.restoreKeptWords({ lost: 2, copies: 1 }),
      ' 1 guide was newer here, so it was kept and the backup’s version added as “(from backup)”. 2 guides stored on this device but not in your Library were left as they are — add them back from Home.',
    );
  });
  // P10: saved palettes, draws, the pool, locked colours and Custom keep positions in markers.json (state.js), so a marker
  // may only ever be added at the end. This pins every position a saved state can already hold (722 markers at v303).
  test('v304 P10: markers.json only grows at the end — every saved position still names the same marker', () => {
    const now = JSON.parse(fs.readFileSync(new URL('../src/data/markers.json', import.meta.url), 'utf8')).map(
      (c) => c.brand + '|' + c.code,
    );
    const pinned = JSON.parse(
      fs.readFileSync(new URL('./fixtures/marker-order.json', import.meta.url), 'utf8'),
    );
    assert.equal(pinned.length, 722);
    assert.ok(now.length >= pinned.length, 'no marker removed');
    const moved = pinned.map((k, i) => (now[i] === k ? null : i + ': ' + k + ' → ' + now[i])).filter(Boolean);
    assert.deepEqual(moved.slice(0, 5), [], moved.length + ' positions changed');
  });
}

// ---- from v305-restore.test.mjs ----
// v305: Restore › Keep mine keeps your markers and now merges the backup's To buy list (once each; markers you own only
// when marked Running low or dry), its ink marks for markers you own (yours win) and its Brands I'd buy when yours is
// automatic. The toast, the Back up & restore dialog and Welcome/Home's toast say what came in.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const stored = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const boot = (json) => {
    const ls = memoryStorage({ [KEY]: json });
    const a = createApp({ localStorage: ls });
    a.__eval('fullRender=function(){};renderSaved=function(){}');
    return { ls, ev: (s) => a.__eval(s) };
  };
  const W = (k, why = 'x', ts = 1) => ({ k, why, ts });
  const BACKUP = {
    v: 3,
    type: 'ms-backup',
    ts: 5,
    owned: ['Ohuhu|R014', 'Copic|E09'],
    wish: [
      W('Ohuhu|G43'),
      W('Copic|B000', 'dup'),
      W('Ohuhu|R014', 'owned here'),
      W('Ohuhu|Y111', 'low'),
      W('Ohuhu|G43', 'twice'),
    ],
    ink: { 'Ohuhu|B08': 'low', 'Copic|E09': 'dry', 'Ohuhu|Y111': 'low', 'Ohuhu|R014': 'dry' },
    buyBrands: ['Ohuhu'],
    saved: [{ id: 99, type: 'palette', name: 'New', keys: ['Ohuhu|G36'], ts: 99 }],
  };
  const keepMine = (ev, b = BACKUP) => {
    ev('confirm=function(){return false;}');
    return JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(b)},5,false))`));
  };
  test('Keep mine: the backup’s To buy merges (once each; owned only when low or dry), ink only for your markers with yours winning, Brands I’d buy when yours is automatic', () => {
    const { ev, ls } = boot(stored({ wish: [W('Copic|B000', 'mine')], ink: { 'Ohuhu|B08': 'dry' } }));
    const r = keepMine(ev);
    assert.deepEqual(r, { mk: false, pals: 1, wish: 3, low: 1, dry: 1, buy: true });
    assert.deepEqual(
      JSON.parse(ev('JSON.stringify([...state.owned].sort())')),
      [...OWN].sort(),
      'your markers kept',
    );
    // B000 once (yours first), G43 once; R014 and Y111 are yours, and the backup's marks for them (dry, low) came in,
    // so each is a replacement and goes on the list (with no mark they stay off: next test)
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.wish.map((w) => w.k))')), [
      'Copic|B000',
      'Ohuhu|G43',
      'Ohuhu|R014',
      'Ohuhu|Y111',
    ]);
    assert.equal(ev('state.wish[0].why'), 'mine', 'your entry wins');
    assert.deepEqual(
      JSON.parse(ev('JSON.stringify(state.ink)')),
      { 'Ohuhu|B08': 'dry', 'Ohuhu|Y111': 'low', 'Ohuhu|R014': 'dry' },
      'yours wins; none for E09 (not yours)',
    );
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.buyBrands)')), ['Ohuhu']);
    const saved = JSON.parse(ls.getItem(KEY));
    assert.deepEqual(
      saved.wish.map((w) => w.k),
      ['Copic|B000', 'Ohuhu|G43', 'Ohuhu|R014', 'Ohuhu|Y111'],
      'saved',
    );
    assert.equal(saved.saved.length, 1, 'and the palette');
  });
  test('Keep mine: a marker you own with no ink mark stays off To buy; Brands I’d buy you chose is kept', () => {
    const { ev } = boot(stored({ buyBrands: ['Copic'] }));
    const b = { ...BACKUP, ink: {}, saved: [] };
    const r = keepMine(ev, b);
    assert.deepEqual(r, { mk: false, pals: 0, wish: 2, low: 0, dry: 0, buy: false });
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.wish.map((w) => w.k))')), [
      'Ohuhu|G43',
      'Copic|B000',
    ]);
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.buyBrands)')), ['Copic'], 'yours kept');
    // nothing new at all: nothing to say (the dialog says "Nothing changed.")
    assert.deepEqual(keepMine(ev, b), { mk: false, pals: 0, wish: 0, low: 0, dry: 0, buy: false });
  });
  test('Keep mine: the toast, the dialog and Welcome/Home say what came in', () => {
    const { ev } = boot(stored());
    const words = (r) => ev(`restoredWords(${JSON.stringify(r)})`);
    assert.equal(
      words({ mk: false, pals: 0, wish: 2, low: 1 }),
      'Kept your markers; added 2 to buy and 1 Running low note.',
    );
    assert.equal(
      words({ mk: false, pals: 2, wish: 1, low: 2, dry: 1, buy: true }),
      'Kept your markers; added 1 to buy, 2 Running low notes, 1 dry note and 2 palettes. Brands I’d buy set from the backup.',
    );
    assert.equal(
      words({ mk: false, pals: 0, buy: true }),
      'Kept your markers. Brands I’d buy set from the backup.',
    );
    // (v308: Keep mine is said even when nothing else came in; it gave no toast at all from pasted text)
    assert.equal(words({ mk: false, pals: 0, wish: 0 }), 'Kept your markers.');
    assert.equal(
      words({ mk: true, pals: 1 }),
      'Restored — 3 markers. 1 palette added.',
      'replacing: as before',
    );
    // the Back up & restore dialog, with guides
    const gw = (col, ok, x) =>
      ev(`guideRestoreWords(${JSON.stringify(col)}, ${ok}, ${JSON.stringify(x || {})})`);
    // (v308: with guides restored beside the markers you kept, it says they are as they were)
    assert.equal(
      gw({ mk: false, pals: 1, wish: 2 }, 2),
      'Added 2 to buy and 1 palette; 2 guides restored. Your markers are as they were.',
    );
    assert.equal(
      gw({ mk: false, pals: 0, wish: 0, buy: true }, 1, { dup: 1 }),
      '1 guide restored. Your markers are as they were. Brands I’d buy set from the backup. 1 guide was already here.',
    );
    assert.equal(
      gw({ mk: true, pals: 1 }, 2),
      'Markers restored, 1 palette added; 2 guides restored.',
      'replacing: as before',
    );
    // Welcome and Home
    const rl = (r) => ev(`restoredList(${JSON.stringify(r)})`);
    assert.equal(
      rl({ markers: 0, palettes: 1, wish: 2, dry: 1, guides: 1 }),
      '1 palette, 2 markers to buy, 1 dry note and 1 guide',
    );
    assert.equal(rl({ markers: 0, palettes: 0, wish: 0, buy: true, guides: 0 }), 'Brands I’d buy');
    assert.equal(rl({ markers: 0, palettes: 2, guides: 1 }), '2 palettes and 1 guide', 'as before');
  });
  test('Keep mine with storage full: To buy, ink and Brands I’d buy are as they were', () => {
    const { ev, ls } = boot(stored({ wish: [W('Copic|B000', 'mine')] }));
    const before = ls.getItem(KEY),
      set = ls.setItem;
    ls.setItem = (k, v) => {
      if (k === KEY) throw new Error('QuotaExceededError');
      set(k, v);
    };
    assert.deepEqual(keepMine(ev), { failed: true });
    assert.deepEqual(JSON.parse(ev('JSON.stringify(state.wish.map((w) => w.k))')), ['Copic|B000']);
    assert.equal(ev('JSON.stringify(state.ink)'), '{}');
    assert.equal(ev('state.buyBrands'), null);
    assert.equal(ls.getItem(KEY), before);
  });
}

// ---- from v308-data.test.mjs ----
// v308 data safety: restore's "Add the backup's markers" (merge rules) and Undo, what a restore of the same markers
// says, guides only further along here (no "(from backup)" copy), "… (n)" names, safe file names, the app version in
// files, and the words for an empty, cut-short or picture file.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const stored = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const boot = (json) => {
    const ls = memoryStorage({ [KEY]: json });
    const a = createApp({ localStorage: ls });
    a.__eval('fullRender=function(){};renderSaved=function(){};preRestoreRender=function(){}');
    return { ls, ev: (s) => a.__eval(s), a };
  };
  const W = (k, why = 'x', ts = 1) => ({ k, why, ts });
  const J = (ev, s) => JSON.parse(ev('JSON.stringify(' + s + ')'));
  test('Add the backup’s markers: yours and its together; its To buy only for markers still not yours; yours off for the markers it brought unless low or dry; your ink wins', () => {
    const { ev } = boot(
      stored({
        wish: [W('Copic|E09', 'mine'), W('Ohuhu|G43', 'mine too'), W('Copic|B000', 'keep')],
        ink: { 'Ohuhu|B08': 'dry' },
      }),
    );
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: 5,
      owned: ['Ohuhu|R014', 'Copic|E09', 'Ohuhu|G43'],
      wish: [W('Copic|B02', 'theirs'), W('Ohuhu|G43', 'theirs')],
      ink: { 'Ohuhu|B08': 'low', 'Ohuhu|G43': 'low' },
      buyBrands: ['Copic'],
    };
    const r = J(ev, `applyCollectionBackup(${JSON.stringify(backup)},5,'add')`);
    assert.equal(r.mk, false);
    assert.equal(r.add, 2, 'E09 and G43 came in');
    assert.deepEqual(J(ev, '[...state.owned].sort()'), [...OWN, 'Copic|E09', 'Ohuhu|G43'].sort());
    // E09 came in with no ink mark: off your list. G43 came in marked low (the backup's ink, for a marker now yours):
    // your entry stays, as a running-low replacement (the backup's for it doesn't come in twice). B000 isn't yours:
    // stays. B02 from the backup comes in.
    assert.deepEqual(J(ev, 'state.wish.map((w) => w.k)'), ['Ohuhu|G43', 'Copic|B000', 'Copic|B02']);
    assert.equal(ev("state.wish.find((w) => w.k === 'Ohuhu|G43').why"), 'mine too', 'yours');
    assert.deepEqual(J(ev, 'state.ink'), { 'Ohuhu|B08': 'dry', 'Ohuhu|G43': 'low' }, 'yours wins for B08');
    assert.deepEqual(J(ev, 'state.buyBrands'), ['Copic'], 'yours was automatic: the backup’s');
    assert.match(
      ev(`restoredWords(${JSON.stringify(r)})`),
      /^Added 2 markers from the backup \(5 now\); also .*\.( Brands I’d buy set from the backup\.)?$/,
    );
  });
  test('every restore that changes your markers can be undone: Use the backup’s, Add and Keep mine’s merges; the snapshot is kept for 7 days while nothing changes', () => {
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: 5,
      owned: ['Copic|E09'],
      wish: [W('Copic|B02')],
      saved: [],
    };
    for (const how of [true, 'add', false]) {
      const { ev, ls } = boot(
        stored({ wish: [W('Copic|B000')], ink: { 'Ohuhu|B08': 'low' }, buyBrands: ['Ohuhu'] }),
      );
      const before = J(
        ev,
        '[[...state.owned].sort(), state.wish.map((w) => w.k), state.ink, state.buyBrands]',
      );
      ev(`window.__r = applyCollectionBackup(${JSON.stringify(backup)},5,${JSON.stringify(how)})`);
      assert.ok(ev('!!__r.undo'), String(how) + ': undoable');
      assert.ok(!('undo' in J(ev, '__r')), 'not part of what the restore says');
      const pre = JSON.parse(ls.getItem('ms-pre-restore'));
      assert.deepEqual(pre.snap.owned.sort(), OWN.slice().sort(), 'kept aside');
      assert.ok(ev('!!preRestoreGet()'), 'offered while the markers are as the restore left them');
      assert.ok(ev('restoreUndo(__r.undo)'));
      assert.deepEqual(
        J(ev, '[[...state.owned].sort(), state.wish.map((w) => w.k), state.ink, state.buyBrands]'),
        before,
        String(how) + ': as they were',
      );
      assert.equal(ls.getItem('ms-pre-restore'), null, 'and the fallback goes');
    }
    // a change after the restore: the fallback isn't offered (it would undo that change too)
    const { ev, ls } = boot(stored());
    ev(`applyCollectionBackup(${JSON.stringify(backup)},5,true)`);
    assert.ok(ev('!!preRestoreGet()'));
    ev("state.owned.add('Ohuhu|G43')");
    assert.equal(ev('preRestoreGet()'), null, 'the markers changed since');
    // and only for 7 days
    ev("state.owned.delete('Ohuhu|G43')");
    const j = JSON.parse(ls.getItem('ms-pre-restore'));
    j.t -= 8 * 864e5;
    ls.setItem('ms-pre-restore', JSON.stringify(j));
    assert.equal(ev('preRestoreGet()'), null, 'older than 7 days');
    // nothing to undo when you had no markers
    const e2 = boot(stored({ owned: [] }));
    e2.ev(`window.__r = applyCollectionBackup(${JSON.stringify(backup)},5,true)`);
    assert.equal(e2.ev('!!__r.undo'), false);
    assert.equal(e2.ls.getItem('ms-pre-restore'), null);
  });
  test('the same markers aren’t “restored”; Keep mine is said even when nothing else came in', () => {
    const { ev } = boot(stored());
    const r = J(
      ev,
      `applyCollectionBackup(${JSON.stringify({ v: 3, type: 'ms-backup', ts: 5, owned: OWN, saved: [] })},5,true)`,
    );
    assert.equal(r.mk, false);
    assert.equal(r.same, true);
    assert.equal(ev(`restoredWords(${JSON.stringify(r)})`), 'Your markers already match the backup.');
    assert.doesNotMatch(ev(`guideRestoreWords(${JSON.stringify(r)}, 1, {})`), /Markers restored/);
    // (v308 merge: and that they are as they were)
    assert.equal(
      ev(`guideRestoreWords(${JSON.stringify(r)}, 1, {})`),
      '1 guide restored. Your markers are as they were.',
    );
    assert.equal(ev(`restoredWords({ mk: false, pals: 0 })`), 'Kept your markers.');
  });
  test('restore toasts say each guide in the file once: restored ones aren’t also counted as newer here or not in the Library', () => {
    const { ev } = boot(stored());
    // a 1-guide file whose guide was newer here: one clause (v307: "1 guide restored. 1 guide was newer here…")
    const one = J(ev, 'restoreSummary({ guides: 0, copies: 1 })');
    assert.doesNotMatch(one.text, /restored\b.*restored/);
    assert.match(one.text, /^1 guide was newer here/);
    // further along here: its own words, not "already here"
    assert.equal(ev('guidesLeft({ ahead: 1 })'), '1 guide is further along here, so it was left as it is.');
    assert.equal(
      ev('guidesLeft({ ahead: 2, dup: 1 })'),
      '1 guide was already here; 2 guides are further along here, so they were left as they are.',
    );
    // nothing came back but a guide added beside one here: not "That backup is empty"
    assert.ok(!J(ev, 'restoreSummary({ guides: 0, lost: 1 })').err);
    assert.equal(J(ev, 'restoreSummary({})').err, 'That backup is empty — there’s nothing in it to restore.');
    assert.equal(J(ev, 'restoreSummary({ guides: 2 })').text, 'Restored 2 guides');
  });
  test('guideAhead: the same guide with more coloured here is further along; a plan or section change, or a tick the backup has and this doesn’t, isn’t', () => {
    const { ev } = boot(stored());
    const b = {
      lmap: 'data:image/png;base64,AAAA',
      assign: { 1: 'Ohuhu|R014', 2: 'Ohuhu|B08' },
      style: { mood: 'any' },
      prog: [1],
      tones: { 2: 1 },
      held: { 2: [1] },
      out: { 3: { k: 'Ohuhu|B08', done: 1, t: 2 } },
      dates: { s: 1 },
    };
    const ahead = (h) => ev(`guideAhead(${JSON.stringify(h)}, ${JSON.stringify(b)})`);
    assert.equal(ahead(b), true, 'the same');
    assert.equal(
      ahead({ ...b, prog: [1, 2], tones: {}, dates: { s: 1, e: 9 } }),
      true,
      'more ticked (its tone section now done)',
    );
    assert.equal(ahead({ ...b, tones: { 2: 2 } }), true, 'further toned');
    assert.equal(
      ahead({ ...b, out: { 3: { k: 'Ohuhu|B08', done: 2, t: 3 } } }),
      true,
      'further done outside',
    );
    assert.equal(ahead({ ...b, prog: [] }), false, 'a tick of the backup’s is missing here');
    assert.equal(ahead({ ...b, tones: {} }), false, 'a tone of the backup’s is missing');
    assert.equal(ahead({ ...b, held: {} }), false, 'kept shading differs');
    assert.equal(ahead({ ...b, style: { mood: 'deep' } }), false, 'a pattern change');
    assert.equal(ahead({ ...b, assign: { 1: 'Ohuhu|R014', 2: 'Ohuhu|Y111' } }), false, 'a marker change');
    assert.equal(ahead({ ...b, lmap: 'data:image/png;base64,BBBB' }), false, 'section edits');
    assert.equal(
      ahead({ ...b, out: { 3: { k: 'Ohuhu|Y111', done: 1, t: 2 } } }),
      false,
      'a different marker outside',
    );
  });
  test('names: "… (n)" for a clash, the name itself when free', () => {
    const { ev } = boot(
      stored({
        saved: [
          { id: 1, type: 'guide', name: 'Moss', keys: [] },
          { id: 2, type: 'guide', name: 'Moss (2)', keys: [] },
        ],
      }),
    );
    assert.equal(ev("freeName('Fern')"), 'Fern');
    assert.equal(ev("freeName('moss')"), 'moss (3)');
    assert.equal(ev("copyName('Moss (2)')"), 'Moss (3)');
  });
  test('file names keep letters and digits in any script', () => {
    const { ev } = boot(stored());
    assert.equal(ev("fileSlug('Sample jellyfish', 'guide', 40, true)"), 'Sample jellyfish');
    assert.equal(ev("fileSlug('Rose: Tango!', 'guide', 40, true)"), 'Rose Tango');
    assert.equal(ev("fileSlug('紫陽花の庭', 'guide', 40, true)"), '紫陽花の庭');
    assert.equal(ev("fileSlug('Сад №2', 'guide', 40, true)"), 'Сад 2');
    assert.equal(ev("fileSlug('Café crème', 'colour-guide', 80).toLowerCase()"), 'café-crème');
    assert.equal(ev("fileSlug('★☆★', 'guide', 40, true)"), 'guide', 'nothing left: the fallback');
    assert.equal(Array.from(ev("fileSlug('花'.repeat(100), 'guide', 40, true)")).length, 40);
  });
  test('the app version: written as Home shows it, and a newer file is told apart (files from before v308 have none)', () => {
    const { ev } = boot(stored());
    ev(
      "document = { getElementById: (id) => (id === 'appVer' ? { textContent: 'v308' } : null), createElement: () => ({}) }",
    );
    assert.equal(ev('appVersion()'), 'v308');
    assert.equal(ev("fileNewer({ app: 'v309' })"), true);
    assert.equal(ev("fileNewer({ app: 'v308.1' })"), true);
    assert.equal(ev("fileNewer({ app: 'v308' })"), false);
    assert.equal(ev("fileNewer({ app: 'v307.1' })"), false);
    assert.equal(ev('fileNewer({ v: 3 })'), false, 'no version: not asked');
    ev(
      "document = { getElementById: (id) => (id === 'appVer' ? { textContent: 'v307.1' } : null), createElement: () => ({}) }",
    );
    assert.equal(ev("fileNewer({ app: 'v307.2' })"), true, 'a point release');
  });
  test('a file that isn’t JSON: empty, a picture, or a backup or guide file cut short, each with its own words', () => {
    const { ev } = boot(stored());
    const tr = (f, t) => ev(`fileTrouble(${JSON.stringify(f)}, ${JSON.stringify(t)})`);
    assert.equal(tr({ name: 'b.json', type: 'application/json' }, '  '), 'empty');
    assert.equal(tr({ name: 'IMG_1.jpg', type: 'image/jpeg' }, '���JFIF'), 'picture');
    assert.equal(tr({ name: 'x.json', type: '' }, '�PNG\r\n'), 'picture');
    assert.equal(
      tr(
        { name: 'marker-studio-backup.json', type: 'application/json' },
        '{"v":3,"type":"ms-backup","ts":1,"owned":["Ohuhu|R0',
      ),
      'damaged',
    );
    assert.equal(
      tr({ name: 'g.msguide.json', type: '' }, '{"name":"x","payload":{"lmap":"data:image/png;base64,iVBO'),
      'damaged',
    );
    assert.equal(tr({ name: 'notes.txt', type: 'text/plain' }, 'hello'), 'bad');
    assert.match(ev("restoreWhy('damaged')"), /incomplete or damaged — it may not have finished downloading/);
    assert.match(ev("restoreWhy('empty')"), /^That file is empty/);
    assert.match(ev("restoreWhy('picture')"), /^That’s a picture, not a backup/);
  });
}

// ---- from v3083-data.test.mjs ----
// v308.3 (data): Scan reads Copic's eight fluorescent cap codes (FB2, FY1…) as another brand's markers when Ohuhu is
// chosen, and no other old code of Copic's or Ohuhu's opens up; Markers' search names the colour families its words
// match (searchFams), for the fallback and the offer.
{
  const app = createApp({ localStorage: memoryStorage() }),
    E = app.__eval;
  const C = E('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const read = (t, b) => {
    const r = app.scanRead(t, b);
    return JSON.parse(
      JSON.stringify({
        codes: r.codes.map((c) => c.opts.map(nm).sort().join('|')),
        byName: r.byName >= 0 ? nm(r.byName) : '',
        other: r.other.map(nm),
        unread: r.unread || 0,
      }),
    );
  };
  const CAP = {
    FB2: 'FB',
    FBG2: 'FBG',
    FYG2: 'FG',
    FRV1: 'FRV',
    FV2: 'FV',
    FY1: 'FY',
    FYG1: 'FYG',
    FYR1: 'FYR',
  };
  test('Scan, Ohuhu chosen: each Copic fluorescent cap code is that Copic marker, asked about as another brand’s', () => {
    // (the eight are what the data has: every Copic fluorescent with an old code)
    assert.deepEqual(
      [...C.filter((c) => c.brand === 'Copic' && c.old && c.old !== c.code).map((c) => c.old)].sort(),
      Object.keys(CAP).sort(),
    );
    for (const [cap, now] of Object.entries(CAP)) {
      const want = { codes: [], byName: '', other: ['Copic ' + now], unread: 0 };
      assert.deepEqual(read(cap, 'Ohuhu'), want, cap);
      assert.deepEqual(read(cap.toLowerCase(), 'Ohuhu'), want, cap + ' typed in small letters');
      // read in two pieces, as Scan Text can: "FY 1"
      assert.deepEqual(read(cap.replace(/(\d)$/, ' $1'), 'Ohuhu'), want, cap + ' in pieces');
      // with Copic chosen, or either, it's the marker, as before
      assert.deepEqual(read(cap, 'Copic').codes, ['Copic ' + now], cap + ' Copic');
      assert.deepEqual(read(cap, '').codes, ['Copic ' + now], cap + ' either');
    }
    // a pasted list: each line its question, none "not read"; the Ohuhu code beside them is added as before
    assert.deepEqual(read('FB2\nFY1\nB02', 'Ohuhu'), {
      codes: ['Ohuhu B02'],
      byName: '',
      other: ['Copic FB', 'Copic FY'],
      unread: 0,
    });
    // the cap's brand and colour name with it: still Copic's (the name had offered Ohuhu FY00 Fluorescent Yellow)
    assert.deepEqual(read('Copic FY1', 'Ohuhu').other, ['Copic FY']);
    assert.deepEqual(read('FY1 Fluorescent Yellow', 'Ohuhu'), {
      codes: [],
      byName: '',
      other: ['Copic FY'],
      unread: 0,
    });
  });
  test('Scan, Ohuhu chosen: FY1 is never Ohuhu’s FY01 (nor its old FY010 or FY020), and Ohuhu’s own fluorescents read as before', () => {
    assert.deepEqual(read('FY1', 'Ohuhu').codes, []);
    assert.deepEqual(read('FY01', 'Ohuhu').codes, ['Ohuhu FY01']);
    assert.deepEqual(read('FY010', 'Ohuhu').codes, ['Ohuhu FY00']);
    assert.deepEqual(read('FY020', 'Ohuhu').codes, ['Ohuhu FY01']);
    assert.deepEqual(read('FY1 FY00', 'Ohuhu'), {
      codes: ['Ohuhu FY00'],
      byName: '',
      other: ['Copic FY'],
      unread: 0,
    });
  });
  test('Scan: no other old code opens up for the other brand (OCR noise such as R4 or G6 stays as it was)', () => {
    // Ohuhu's short old codes with Copic chosen: nothing, not "another brand's"
    for (const t of ['R4', 'G6', 'FY010', 'B090', 'BG4'])
      assert.deepEqual(read(t, 'Copic'), { codes: [], byName: '', other: [], unread: 0 }, t);
    // and with Ohuhu chosen they are Ohuhu's own old codes, as before
    assert.deepEqual(read('R4', 'Ohuhu').codes, ['Ohuhu R412']);
    // another Copic code with Ohuhu chosen is still asked about as before
    assert.deepEqual(read('E000', 'Ohuhu').other, ['Copic E000']);
  });
  test('Markers’ search names the families every word of it is in: “skin”, “yellow grey”, “red”; not a list of codes, not outside Markers', () => {
    E(
      `state.mode = 'collection'; state.collView = 'all'; state.pool = null; poolSet = null; state.ink = {};`,
    );
    const fams = (q) => {
      E(`searchStr = ${JSON.stringify(q)}`);
      return JSON.parse(
        E(
          'JSON.stringify(searchFams() && { names: searchFams().names, n: searchFams().list.length, names0: finderMatches().length })',
        ),
      );
    };
    assert.deepEqual(fams('skin'), { names: ['Earth / Skin / Brown'], n: 94, names0: 0 });
    assert.deepEqual(fams('earth skin'), { names: ['Earth / Skin / Brown'], n: 94, names0: 0 });
    // (grey and gray are one word, as search folds them; the one name with both words is Copic YG93 Grayish Yellow)
    assert.deepEqual(fams('yellow grey'), { names: ['Yellow Grey'], n: 6, names0: 1 });
    assert.deepEqual(fams('Gray Yellow'), { names: ['Yellow Grey'], n: 6, names0: 1 });
    // (v308.3, after the build: a search that is a family's whole name names that family only, not Red-Violet and
    // Yellow-Red / Orange too)
    assert.deepEqual(fams('red'), { names: ['Red'], n: 69, names0: 17 });
    assert.deepEqual(fams('neutral'), {
      names: ['Neutral Grey', 'Neutral / Black'],
      n: 16,
      names0: fams('neutral').names0,
    });
    assert.equal(fams('reds'), null, 'whole words only');
    assert.equal(fams('skin tone'), null, 'every word');
    assert.equal(fams('b02, b03'), null, 'a list of codes: the Scan hint');
    E(`state.mode = 'palette'`);
    assert.equal(fams('skin'), null, 'Markers only');
    E(`state.mode = 'collection'`);
    // the line: one family, three, and more than three named briefly
    E(`searchStr = 'skin'`);
    assert.equal(E('famPhrase(searchFams())'), 'the Earth / Skin / Brown family (94)');
    E(`searchStr = 'red'`);
    assert.equal(E('famPhrase(searchFams())'), 'the Red family (69)');
    E(`searchStr = 'neutral'`);
    assert.equal(E('famPhrase(searchFams())'), 'the Neutral Grey and Neutral / Black families (16)');
    E(`searchStr = 'grey'`);
    assert.match(E('famPhrase(searchFams())'), /^the Warm Grey, Yellow Grey and 5 other families \(87\)$/);
  });
}

// ---- from v31823.test.mjs ----
// v318.23: the app's storage written as 1-byte text, the oldest thumbnails left out when it's full, smaller stored
// thumbnails, the longest waits kept for Copy diagnostics, and a guide's newer-version settings carried by its autosave.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const KEY = 'ohuhu-hb320-picker-v3';
  const quota = () => {
    const e = new Error('The quota has been exceeded.');
    e.name = 'QuotaExceededError';
    e.code = 22;
    return e;
  };
  // storage that holds at most `max` characters for the app's key, as a full browser would
  function fullAt(max) {
    const ls = memoryStorage(),
      set = ls.setItem;
    ls.calls = 0;
    ls.setItem = (k, v) => {
      if (k === KEY) {
        ls.calls++;
        if (String(v).length > ls.max) throw quota();
      }
      set(k, v);
    };
    ls.max = max;
    return ls;
  }
  const thumb = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n);
  // ---- a guide's newer-version settings ----
  const core = () => createApp().__mstest;
  test('narrow(): stored text is plain ASCII and reads back the same (curly quotes, Ⅱ, emoji, line separators)', () => {
    const a = createApp({ TextEncoder, TextDecoder });
    const v = { n: 'Ben’s “page” Ⅱ 🌼 café   \\ \u007f', k: ['R23*'] };
    const s = a.__eval(`narrow(${JSON.stringify(JSON.stringify(v))})`);
    assert.ok(
      [...s].every((c) => c.charCodeAt(0) < 0x7f),
      'nothing past U+007E: ' + s,
    );
    assert.deepEqual(JSON.parse(s), v);
    // without TextEncoder (an old browser): escaped all the same
    const b = createApp();
    assert.equal(b.__eval(`narrow(${JSON.stringify(JSON.stringify(v))})`), s);
  });
  test('save() writes the narrowed text, and remembers that as what it wrote', () => {
    const ls = memoryStorage();
    const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
    a.__eval(
      `state.saved.push({ id: 7, type: 'guide', name: 'Ziqi’s page', ts: 1, keys: [], W: 10, H: 10, n: 1, thumb: '' }); save(true)`,
    );
    const raw = ls.getItem(KEY);
    assert.ok(raw.includes('Ziqi\\u2019s page'));
    assert.ok(![...raw].some((c) => c.charCodeAt(0) > 0x7e));
    assert.equal(a.__eval('_lastRaw'), raw);
    // and it opens as it was
    const b = createApp({ localStorage: ls, TextEncoder, TextDecoder });
    assert.equal(b.__eval('state.saved.find((s) => s.id === 7).name'), 'Ziqi’s page');
  });
  test('storage full: the oldest thumbnails go first, as few as fit, and nothing else changes', () => {
    const ls = memoryStorage();
    const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
    a.__eval(
      `for (let i = 1; i <= 6; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: 1000 * (7 - i), keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(3000))} }); save(true)`,
    );
    const full = ls.getItem(KEY).length;
    // room for everything but ~one thumbnail
    const f = fullAt(full - 1000);
    for (const [k, v] of ls._map) f._map.set(k, v);
    const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
    const before = JSON.parse(b.__eval('JSON.stringify(state.saved)'));
    assert.equal(b.__eval('save(true)'), true);
    const after = JSON.parse(b.__eval('JSON.stringify(state.saved)'));
    const gone = after.filter((s) => !s.thumb).map((s) => s.id);
    // the oldest saved (id 6: ts 1000) only
    assert.deepEqual(gone, [6]);
    assert.deepEqual(
      after.map((s) => ({ ...s, thumb: '' })),
      before.map((s) => ({ ...s, thumb: '' })),
      'every other field as it was',
    );
    assert.equal(JSON.parse(f.getItem(KEY)).saved.find((s) => s.id === 6).thumb, '');
  });
  test('storage full whatever is left out: the thumbnails are put back, it fails as before, and isn’t tried again until a save works', () => {
    const ls = memoryStorage();
    const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
    a.__eval(
      `for (let i = 1; i <= 5; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: i, keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(2000))} }); save(true)`,
    );
    const f = fullAt(100);
    for (const [k, v] of ls._map) f._map.set(k, v);
    const stored = f.getItem(KEY);
    const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
    f.calls = 0;
    assert.equal(b.__eval('save(true)'), false);
    const first = f.calls;
    assert.ok(first > 1 && first <= 5, 'one try, then growing batches: ' + first);
    assert.equal(b.__eval('state.saved.filter((s) => s.thumb).length'), 5, 'all put back');
    assert.equal(f.getItem(KEY), stored, 'the stored copy untouched');
    f.calls = 0;
    assert.equal(b.__eval('save(true)'), false);
    assert.equal(f.calls, 1, 'no batches the second time');
    // room again: saves, and the next full store tries the thumbnails again
    f.max = 1e9;
    assert.equal(b.__eval('save(true)'), true);
    f.max = 100;
    f.calls = 0;
    b.__eval('save(true)');
    assert.ok(f.calls > 1);
  });
  test('storage full: a redrawn thumbnail being stored never pushes another out (noDrop); another error isn’t taken for full', () => {
    const ls = memoryStorage();
    const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
    a.__eval(
      `for (let i = 1; i <= 3; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: i, keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(2000))} }); save(true)`,
    );
    const f = fullAt(1e9);
    for (const [k, v] of ls._map) f._map.set(k, v);
    const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
    b.__eval('save(true)');
    f.max = f.getItem(KEY).length - 10;
    f.calls = 0;
    assert.equal(b.__eval('save(true, true)'), false);
    assert.equal(f.calls, 1);
    assert.equal(b.__eval('state.saved.filter((s) => s.thumb).length'), 3);
    // an error that isn't a full store (the old fakes throw a plain Error): one try, nothing left out
    const g = memoryStorage(),
      gset = g.setItem;
    g.setItem = (k, v) => {
      if (k === KEY) throw new Error('QuotaExceededError');
      gset(k, v);
    };
    const c = createApp({ localStorage: g, TextEncoder, TextDecoder });
    c.__eval(
      `state.saved.push({ id: 1, type: 'guide', name: 'g', ts: 1, keys: [], W: 10, H: 10, n: 1, thumb: 'x' })`,
    );
    assert.equal(c.__eval('save(true)'), false);
    assert.equal(c.__eval('state.saved[state.saved.length - 1].thumb'), 'x');
  });
  test('a stored thumbnail’s size: the long side 144 px whatever the page’s shape', () => {
    const a = createApp();
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(1600, 1600))')), [144, 144]);
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(568, 1500))')), [55, 144]);
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(1600, 1236))')), [144, 111]);
  });
  test('the longest waits: the 8 longest of this visit, at least 50 ms, in Copy diagnostics; nothing said when there are none', () => {
    const a = createApp();
    const plainD = a.__eval('errDetails()');
    assert.ok(!plainD.includes('Longest waits'));
    a.__eval(
      `[30, 120, 400, 90, 51, 700, 60, 300, 250, 80, 49].forEach((ms, i) => holdAdd('step ' + i, ms, i === 5 ? '3000×4000' : ''))`,
    );
    const d = a.__eval('errDetails()');
    assert.match(
      d,
      /\nLongest waits, this visit:\nstep 5 700 ms \(3000×4000\)\nstep 2 400 ms\nstep 7 300 ms\nstep 8 250 ms\nstep 1 120 ms\nstep 3 90 ms\nstep 9 80 ms\nstep 6 60 ms$/,
    );
    // holdTime times a piece of work and hands back what it returns
    assert.equal(a.__eval(`holdTime('x', () => 42)`), 42);
  });
  test('plCarry: a newer version’s keys at the top, in style and in style.shade are kept; this version’s own are its own', () => {
    const t = core();
    const prev = {
      lmap: 'L',
      assign: { 1: 'a' },
      prog: [1],
      zzTop: { a: 1 },
      style: { family: 'x', zzStyle: 2, shade: { mode: 'on', zzShade: 3 } },
    };
    const pl = {
      lmap: 'L',
      assign: { 1: 'b' },
      prog: [1, 2],
      style: { family: 'y', shade: { mode: 'off' } },
    };
    const out = t.plCarry(prev, pl);
    assert.deepEqual(JSON.parse(JSON.stringify(out)), {
      lmap: 'L',
      assign: { 1: 'b' },
      prog: [1, 2],
      zzTop: { a: 1 },
      style: { family: 'y', zzStyle: 2, shade: { mode: 'off', zzShade: 3 } },
    });
    assert.deepEqual(
      pl,
      { lmap: 'L', assign: { 1: 'b' }, prog: [1, 2], style: { family: 'y', shade: { mode: 'off' } } },
      'the payload given isn’t changed',
    );
  });
  test('plCarry: a setting cleared here isn’t brought back; other sections, or nothing to carry, change nothing', () => {
    const t = core();
    // keys this version writes only when they're used: cleared here, so not in this save
    const prev = {
      lmap: 'L',
      held: { 3: 1 },
      dates: { s: 1 },
      out: { 2: 1 },
      edits: 1,
      base: { 1: 'x' },
      upk: 2,
      frame: [1],
      ref: 'r',
      paper: [1],
      zones: [{}],
      famRule: 1,
      lowX: 1,
      smp: 1,
      gradArea: 1,
      bgRule: 1,
      minPos: 3,
      style: {
        matchAlike: true,
        theme: 't',
        incl: [1],
        gradScat: 1,
        gradJit: 1,
        gradFix: 1,
        fromPal: 'p',
        photo: {},
        shade: { flat: { 1: 1 }, hilite: 'h' },
      },
    };
    const pl = { lmap: 'L', style: { shade: {} } };
    assert.equal(t.plCarry(prev, pl), pl, 'nothing to carry: the same payload');
    // other sections (Edit sections, a rebuild): nothing carried
    const pl2 = { lmap: 'M', style: {} };
    assert.equal(t.plCarry({ lmap: 'L', zz: 1, style: { zz: 1 } }, pl2), pl2);
    assert.equal(t.plCarry({ zz: 1 }, pl2), pl2, 'no section map stored: nothing');
  });
  test('plCarry knows every key this version writes in a payload (the literal in currentDesignObj, STYLE_FIELDS)', () => {
    const src = readFileSync(new URL('../src/js/guide/60-persist.js', import.meta.url), 'utf8');
    const at = src.indexOf('    payload: Object.assign(\n'),
      body = src.slice(at, src.indexOf('\n  };', at));
    // (the literal's own keys, 8 spaces in; the objects added to it, 6 spaces in: zones, secStates)
    const written = new Set(
      [...body.matchAll(/^ {8}(\w+):/gm)]
        .map((m) => m[1])
        .concat([...body.matchAll(/^ {6}(?! )[^\n]*?\{ (\w+): /gm)].map((m) => m[1])),
    );
    const K = core().plKnown();
    for (const k of written) assert.ok(K.top.has(k), 'payload.' + k + ' is known');
    assert.ok(
      written.has('zones') && written.has('secStates') && written.has('frame'),
      'the parse found the whole literal: ' + [...written],
    );
    // and the lists themselves: every STYLE_FIELDS key where it's written
    for (const f of core().styleFields)
      assert.ok(K[f.in === 'payload' ? 'top' : f.in].has(f.key), f.in + '.' + f.key);
    assert.ok(K.style.has('shade'));
  });
}

// ---- from v31825-x1.test.mjs ----
// v318.25: fixes from the fifth deep debugging pass. Fail on v318.24.
{
  // ---- X1: Markers (Find my set) and Scan's box ----
  {
    const a = createApp();
    const E = a.__eval;

    test('X1 Find my set: a scanned Ohuhu blender cap doesn’t count, so a Honolulu 24’s caps show the 24 first', () => {
      const first = (keys) =>
        JSON.parse(
          E(
            `JSON.stringify(findList(findSets('Ohuhu', 0, ${JSON.stringify(keys)})).map((x) => MARKER_SETS[x.i].n))`,
          ),
        );
      assert.equal(first(['Ohuhu|Y111', 'Ohuhu|R014', 'Ohuhu|0'])[0], 'Honolulu 24');
      assert.deepEqual(
        first(['Ohuhu|Y111', 'Ohuhu|R014', 'Ohuhu|0']),
        first(['Ohuhu|Y111', 'Ohuhu|R014']),
        'the same as without the blender',
      );
      // (a 24 Portrait's two caps and the blender: the 24 Portrait among the sets with every cap)
      assert.ok(first(['Ohuhu|YR02', 'Ohuhu|E47', 'Ohuhu|0']).includes('24 Portrait'));
      // (the blender alone still finds the sets with it)
      const lone = JSON.parse(E(`JSON.stringify(findSets('Ohuhu', 0, ['Ohuhu|0']).map((x) => x.hits))`));
      assert.ok(lone.length > 0 && lone.every((h) => h === 1));
      // (Copic's 0 is a real member of its sets: still counted)
      assert.equal(+E(`findSets('Copic', -1, ['Copic|0', 'Copic|E00'])[0].of`), 2);
    });

    // what scanHandle puts in the list, typed with a brand chosen above the box
    const typed = (brand, t) =>
      JSON.parse(
        E(`(function () {
        scanList = []; scanBrand = ${JSON.stringify(brand)}; scanBrandChosen = true;
        scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear();
        scanHandle(${JSON.stringify(t)}, true);
        return JSON.stringify(scanList.map((e) => e.ask ? '?' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code).join('|') : COLORS[e.i].brand + ' ' + COLORS[e.i].code));
      })()`),
      );

    test('X1 Scan’s box: a Copic grey upside down with Ohuhu chosen is asked about as another brand’s, as upright', () => {
      assert.deepEqual(typed('Ohuhu', '8-N'), ['?Copic N-8']);
      assert.deepEqual(typed('Ohuhu', '8-N'), typed('Ohuhu', 'N-8'));
      // (with Copic chosen, as before: added, read upside down)
      assert.deepEqual(typed('Copic', '8-N'), ['Copic N-8']);
      // (digits only, or a grey's shape with no digit, still aren't taken as another brand's)
      assert.deepEqual(typed('Ohuhu', 'S-M'), []);
      assert.deepEqual(typed('Ohuhu', '6-13'), []);
    });

    test('X1 a list over 20,000 characters keeps its brand (a shop’s list of every Copic marker, Ohuhu chosen)', () => {
      const out = JSON.parse(
        E(`(function () {
        state.owned = new Set(COLORS.filter((c) => c.brand === 'Ohuhu').slice(0, 50).map((c) => c.brand + '|' + c.code));
        scanBrandChosen = true; scanBrand = 'Ohuhu'; scanList = [];
        const cop = COLORS.filter((c) => c.brand === 'Copic');
        const t = cop.map((c) => c.code + ' ' + c.name + ' - alcohol marker, in stock, add to cart').join('\\n');
        scanHandle(t, true);
        const ins = scanList.filter((e) => !e.ask);
        return JSON.stringify({ chars: t.length, n: cop.length, listed: ins.length, copic: ins.filter((e) => COLORS[e.i].brand === 'Copic').length, asks: scanList.filter((e) => e.ask).length });
      })()`),
      );
      assert.ok(out.chars > 20000, 'over the limit: ' + out.chars);
      assert.equal(out.listed, out.n);
      assert.equal(out.copic, out.n, 'every one as Copic’s, the code both brands have too');
      assert.equal(out.asks, 0);
      // (a list of both brands past the limit: read as either, the reading of its first part not reused for the whole)
      const mixed = JSON.parse(
        E(`(function () {
        scanBrandChosen = true; scanBrand = 'Ohuhu'; scanList = [];
        const pad = ' - alcohol marker, in stock, add to cart';
        const t = COLORS.filter((c) => c.brand === 'Copic').slice(0, 200).map((c) => c.code + ' ' + c.name + pad)
          .concat(COLORS.filter((c) => c.brand === 'Ohuhu').slice(-200).map((c) => c.code + ' ' + c.name + pad)).join('\\n');
        const lb = scanListBrand(t);
        scanHandle(t, true);
        return JSON.stringify({ chars: t.length, mixed: !!(lb && lb.mixed), r: lb && lb.r, last: COLORS[scanList.filter((e) => !e.ask).slice(-1)[0].i].brand + ' ' + COLORS[scanList.filter((e) => !e.ask).slice(-1)[0].i].code, want: 'Ohuhu ' + COLORS.filter((c) => c.brand === 'Ohuhu').slice(-1)[0].code, listed: scanList.filter((e) => !e.ask).length });
      })()`),
      );
      assert.ok(mixed.chars > 20000);
      assert.equal(mixed.mixed, true);
      assert.equal(mixed.r, null);
      assert.ok(mixed.listed > 300, 'the lines past the limit read too: ' + mixed.listed);
    });
  }
}

// (v324.1) "today", "yesterday", "3 days ago" by the calendar, as Home's Continue card counts: a guide saved at 11 pm
// had read "today" the next morning; a time ahead of now is "today", not nothing; another year's date has its year
{
  const a = createApp({ localStorage: memoryStorage() });
  const rel = (ts) => a.__eval('relDate(' + ts + ')');
  test('relDate counts calendar days, says "today" for a time ahead, and gives another year its year', () => {
    const now = new Date(),
      at = (dd, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + dd, h, m).getTime();
    assert.equal(rel(at(0, 0, 1)), 'today');
    assert.equal(rel(at(-1, 23, 59)), 'yesterday');
    assert.equal(rel(at(-1, 0, 1)), 'yesterday');
    assert.equal(rel(at(-3, 12, 0)), '3 days ago');
    assert.equal(rel(Date.now() + 5 * 864e5), 'today');
    assert.match(
      rel(new Date(now.getFullYear() - 2, 2, 3).getTime()),
      new RegExp(String(now.getFullYear() - 2)),
    );
    assert.doesNotMatch(rel(at(-10, 12, 0)), /ago|today/);
    assert.equal(rel(0), '');
  });
}
