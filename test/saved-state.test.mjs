// Reading and writing the saved state: one bad field costs only that field, marker numbers out of range or unknown
// are dropped, unreadable state is copied and left alone until the person acts, a save never drops Library entries
// another tab wrote, and the one-time collection migrations run once. Each test boots a fresh app instance against
// an in-memory localStorage, so we can simulate "what happens on the next launch".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const stored = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [{ id: 7, type: 'palette', name: 'P', keys: ['Ohuhu|R014'], ts: 7 }], ...extra });
const boot = (json, more = {}) => { const ls = memoryStorage(json == null ? {} : { [KEY]: json, ...more }); const a = createApp({ localStorage: ls }); return { a, ls, ev: (s) => a.__eval(s) }; };

// ---- From the fourth review ----
test('a bad field is dropped on its own: the collection and the Library stay', () => {
  for (const bad of [{ excluded: 5 }, { excluded: 'x' }, { tones: 3 }, { palettes: 'abc' }, { drawn: {} }, { locked: 1 }, { customPal: 'q' }, { harmony: 12 }, { palSize: 'big' }]) {
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
  const { ev } = boot(stored({ mode: 'palette', palettes: [[5000, 1], [2, 3], 'x', []], drawn: [9999, 2, 2, -1, 'a', 1.5], customPal: [7000, 3, null], pool: [99999], locked: [4, 8000] }));
  assert.deepEqual(JSON.parse(ev('JSON.stringify(state.palettes)')), [[2, 3]]);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(state.drawn)')), [2]);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(state.customPal)')), [null, 3, null]);
  assert.equal(ev('state.pool'), null);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(state.locked)')), [4]);
});

test('a broken collection in a recent state is empty, not the 451-marker default; a real pre-v2 state still migrates', () => {
  assert.equal(boot(stored({ owned: 'abc' })).ev('state.owned.size'), 0);
  assert.equal(boot(stored({ owned: { a: 1 } })).ev('state.owned.size'), 0);
  const legacy = JSON.parse(stored()); delete legacy.ownedSeedV; delete legacy.copicAdd1; delete legacy.libAdj1; delete legacy.setFix1;
  assert.ok(boot(JSON.stringify(legacy)).ev('state.owned.size') > 100);
  legacy.owned = [];
  assert.equal(boot(JSON.stringify(legacy)).ev('state.owned.size'), 0, 'an empty old collection stays empty');
});

test('unreadable state is copied and not written over until the person acts', () => {
  const { a, ls } = boot('{"owned":["Ohuhu|R014"],');
  assert.equal(ls.getItem('ms-state-backup'), '{"owned":["Ohuhu|R014"],');
  assert.equal(a.save(), true);
  assert.equal(ls.getItem(KEY), '{"owned":["Ohuhu|R014"],', 'left as it was');
  a.__eval('_saveHold=false'); a.save();
  assert.equal(JSON.parse(ls.getItem(KEY)).ownedSeedV, 2, 'saves again after a tap');
});

test('a save keeps Library entries another tab wrote meanwhile, but not ones this tab deleted', () => {
  const { a, ls, ev } = boot(stored());
  const other = JSON.parse(ls.getItem(KEY)); other.saved.push({ id: 8, type: 'palette', name: 'From B', keys: ['Ohuhu|Y111'], ts: 8 }, { id: 9, type: 'guide', name: 'G', keys: [], ts: 9 });
  ls.setItem(KEY, JSON.stringify(other));
  a.save();
  assert.deepEqual(JSON.parse(ls.getItem(KEY)).saved.map((s) => s.id).sort(), [7, 8, 9]);
  assert.equal(ev('state.saved.length'), 3, 'and this tab now has them too');
  // deleted here: another tab's older copy doesn't bring it back
  ev('state.saved=state.saved.filter(s=>s.id!==8);forgetSaved(8)');
  ls.setItem(KEY, JSON.stringify(other));
  a.save();
  assert.deepEqual(JSON.parse(ls.getItem(KEY)).saved.map((s) => s.id).sort(), [7, 9]);
});

test('storage full: keep() puts the change back and reports false', () => {
  const ls = memoryStorage({ [KEY]: stored() });
  const a = createApp({ localStorage: ls });
  ls.setItem = () => { throw new Error('QuotaExceededError'); };
  a.__eval("state.owned.delete('Ohuhu|R014')");
  assert.equal(a.__eval("keep(function(){state.owned.add('Ohuhu|R014')})"), false);
  assert.equal(a.__eval("state.owned.has('Ohuhu|R014')"), true);
});

test('v265: only losses the person would notice leave a note for Home (markers, palettes, guides, or all of it)', () => {
  const note = (json) => { const n = boot(json).ls.getItem('ms-load-note'); return n == null ? null : JSON.parse(n); };
  for (const bad of [{ excluded: 5 }, { tones: 3 }, { palettes: 'abc' }, { drawn: {} }, { harmony: 12 }, { palSize: 'big' }]) assert.equal(note(stored(bad)), null, JSON.stringify(bad));
  assert.equal(note(stored()), null);
  assert.deepEqual(note(stored({ owned: [...OWN, 5, null] })), { markers: 2, palettes: 0, guides: 0 });
  assert.deepEqual(note(stored({ owned: 'abc' })), { markers: -1, palettes: 0, guides: 0 });
  assert.deepEqual(note(stored({ saved: [{ id: 7, type: 'palette', keys: [] }, { id: 'x', type: 'palette' }, { id: -2, type: 'guide' }, null] })), { markers: 0, palettes: 2, guides: 1 });
  assert.deepEqual(note(stored({ saved: 'abc' })), { markers: 0, palettes: -1, guides: -1 });
  assert.deepEqual(note('{"owned":["Ohuhu|R014"],'), { all: true });
  // a copy of the original is kept whenever there is a note
  const { ls } = boot(stored({ owned: [...OWN, 5] }));
  assert.equal(ls.getItem('ms-state-backup'), stored({ owned: [...OWN, 5] }));
});

// ---- From the fifth review ----
const bootQuiet = (json) => { const ls = memoryStorage(json == null ? {} : { [KEY]: json }); const a = createApp({ localStorage: ls }); a.__eval('fullRender=function(){};renderSaved=function(){}'); return { a, ls, ev: (s) => a.__eval(s) }; };
const owned = (ev) => JSON.parse(ev('JSON.stringify([...state.owned].sort())'));

test('marker keys the app does not know are dropped; a renamed code is moved to its new one', () => {
  const { ev, ls } = bootQuiet(stored({ owned: [...OWN, 'Ohuhu|NOPE1', 'Copic|ZZ9', 'Ohuhu|B090'] }));
  assert.deepEqual(owned(ev), ['Ohuhu|B015', 'Ohuhu|B08', 'Ohuhu|R014', 'Ohuhu|Y111'], 'B090 is now B015; the unknown two are gone');
  assert.equal(ev('state.owned.size'), 4, 'counted as shown');
  assert.equal(ls.getItem('ms-load-note'), null, 'not a loss to report: they could never be shown');
  assert.equal(ls.getItem('ms-state-backup'), null);
  ev('save(true)');
  assert.deepEqual(JSON.parse(ls.getItem(KEY)).owned.sort(), ['Ohuhu|B015', 'Ohuhu|B08', 'Ohuhu|R014', 'Ohuhu|Y111'], 'and not written back');
  // an old code that is also another marker's current code stays that marker
  assert.equal(ev("knownMkey('Ohuhu|R23')"), 'Ohuhu|R23');
  assert.equal(ev("knownMkey('Ohuhu|NOPE')"), null);
});

test('the copy of the saved text is kept only when something was lost', () => {
  assert.equal(bootQuiet(stored({ excluded: 5, tones: 3 })).ls.getItem('ms-state-backup'), null, 'repaired settings: no copy');
  assert.equal(bootQuiet(stored({ saved: [{ id: -1, type: 'palette' }] })).ls.getItem('ms-state-backup'), stored({ saved: [{ id: -1, type: 'palette' }] }), 'a palette lost: kept');
});

test('Photo: a size that is not one of its choices moves to the nearest', () => {
  const { ev } = bootQuiet(stored());
  assert.deepEqual([3, 5, 7, 9, 11, 13, 14, 15, 2].map((n) => ev(`photoSnap(${n})`)), [4, 4, 6, 8, 10, 12, 12, 16, 4]);
  ev("state.mode='home';state.harmony='complementary';state.palSize=5;setHarmony('photo')");
  assert.equal(ev('state.palSize'), 4);
  assert.equal(bootQuiet(stored({ harmony: 'photo', palSize: 7 })).ev('state.palSize'), 6, 'also a saved one');
});

// ---- From the persistence / import-safety fixes ----
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
const bootOwned = (json) => {
  const ls = memoryStorage(json == null ? {} : { [KEY]: json });
  const a = createApp({ localStorage: ls });
  return { a, ls, owned: () => [...a.__eval('state.owned')] };
};

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
  delete legacy.ownedSeedV; delete legacy.copicAdd1; delete legacy.libAdj1;
  const { owned } = bootOwned(JSON.stringify(legacy));
  assert.ok(owned().length > 100, 'legacy (pre-seed-v2) state still migrates to the old default');
});

test('library entries are sanitised on load (ids, thumbs, keys)', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const { a } = bootOwned(storedState({
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

test('a guide’s coloured count survives loading only as a whole number', () => {
  const { a } = bootOwned(storedState({
    saved: [
      { id: 1, type: 'guide', name: 'a', keys: [], n: 10, done: 4 },
      { id: 2, type: 'guide', name: 'b', keys: [], n: 10, done: 2.5 },
      { id: 3, type: 'guide', name: 'c', keys: [], n: 10, done: -1 },
      { id: 4, type: 'guide', name: 'd', keys: [], n: 10, done: '3' },
      { id: 5, type: 'guide', name: 'e', keys: [], n: 10, done: 0 },
    ],
  }));
  const saved = JSON.parse(JSON.stringify(a.__eval('state.saved')));
  assert.deepEqual(saved.map((s) => ('done' in s ? s.done : null)), [4, null, null, null, 0]);
});

// v244: set lists that were one colour short.
test('owners of a set that was one colour short get the missing colour once', () => {
  const sets = createApp({ localStorage: memoryStorage() }).__eval('OHUHU_SETS');
  const old120 = sets['120'].split(' ').filter((c) => c !== 'BV38').map((c) => 'Ohuhu|' + c);
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
