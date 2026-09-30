// Backups: the reminder's count, and restoring when storage is full or the backup has no markers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

// ---- From the design pass ----
const KEY = 'ohuhu-hb320-picker-v3';
const base = (extra = {}) => JSON.stringify({ mode: 'home', tones: ['pale', 'light', 'mid', 'dark'], sats: ['neutral', 'muted', 'medium', 'vivid'], brands: ['Ohuhu', 'Copic'], satsUpgraded: true, scopeFlipped: true, ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, owned: [], saved: [], ...extra });

test('guide backup reminder counts guides changed since the last backup', () => {
  const now = Date.now();
  const guides = [1, 2, 3].map((k) => ({ id: k, type: 'guide', name: 'g' + k, keys: [], ts: now - k * 864e5 }));
  const ls = memoryStorage({ [KEY]: base({ saved: guides }) });
  const a = createApp({ localStorage: ls });
  assert.equal(a.guidesAtRisk(), 3, 'never backed up: all at risk');
  ls.setItem('ms-guides-backup-ts', String(now - 1.5 * 864e5));
  assert.equal(a.guidesAtRisk(), 1, 'only the guide saved after the backup');
});

// ---- From the fifth review ----
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const stored = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [{ id: 7, type: 'palette', name: 'P', keys: ['Ohuhu|R014'], ts: 7 }], ...extra });
const boot = (json) => { const ls = memoryStorage(json == null ? {} : { [KEY]: json }); const a = createApp({ localStorage: ls }); a.__eval('fullRender=function(){};renderSaved=function(){}'); return { a, ls, ev: (s) => a.__eval(s) }; };
const owned = (ev) => JSON.parse(ev('JSON.stringify([...state.owned].sort())'));
// the next writes of the app's state fail as if the storage were full
const fill = (ls) => { const set = ls.setItem; ls.setItem = (k, v) => { if (k === KEY) throw new Error('QuotaExceededError'); set(k, v); }; };

test('restore with storage full: nothing changes and it says it failed', () => {
  const { ev, ls } = boot(stored());
  const before = ls.getItem(KEY);
  fill(ls);
  const backup = { v: 3, type: 'ms-backup', ts: 5, owned: ['Ohuhu|B08', 'Ohuhu|G36'], wish: [{ k: 'Ohuhu|R16', why: 'x', ts: 1 }], ink: { 'Ohuhu|B08': 'low' }, saved: [{ id: 99, type: 'palette', name: 'New', keys: ['Ohuhu|G36'], ts: 99 }] };
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
  assert.deepEqual(JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(backup)},5))`)), { failed: true });
  assert.equal(ev('state.saved.length'), 1);
});

test('a backup with no markers leaves the markers here alone and asks nothing; its palettes are added', () => {
  const { ev, ls } = boot(stored());
  ev('confirm=function(){throw new Error("asked");}');
  const backup = { v: 3, type: 'ms-backup', ts: 5, owned: [], saved: [{ id: 99, type: 'palette', name: 'New', keys: ['Ohuhu|G36'], ts: 99 }] };
  const r = JSON.parse(ev(`JSON.stringify(applyCollectionBackup(${JSON.stringify(backup)},5))`));
  assert.deepEqual(r, { mk: false, pals: 1 });
  assert.deepEqual(owned(ev), [...OWN].sort());
  assert.equal(JSON.parse(ls.getItem(KEY)).saved.length, 2, 'saved');
  assert.equal(ev(`restoredWords({mk:false,pals:1})`), 'Kept your markers; 1 palette added.');
  assert.equal(ev(`restoredList({markers:0,palettes:2,guides:1})`), '2 palettes and 1 guide');
  // with no markers here either, nothing claims to keep them
  const e2 = boot(stored({ owned: [] })).ev;
  e2('confirm=function(){throw new Error("asked");}');
  e2(`applyCollectionBackup(${JSON.stringify(backup)},5)`);
  assert.equal(e2(`restoredWords({mk:false,pals:1})`), '1 palette added.');
});
