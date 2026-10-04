// v305: Restore › Keep mine keeps your markers and now merges the backup's To buy list (once each; markers you own only
// when marked Running low or dry), its ink marks for markers you own (yours win) and its Brands I'd buy when yours is
// automatic. The toast, the Back up & restore dialog and Welcome/Home's toast say what came in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

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
  assert.deepEqual(JSON.parse(ev('JSON.stringify(state.wish.map((w) => w.k))')), ['Ohuhu|G43', 'Copic|B000']);
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
  assert.equal(words({ mk: false, pals: 0, wish: 0 }), '');
  assert.equal(
    words({ mk: true, pals: 1 }),
    'Restored — 3 markers. 1 palette added.',
    'replacing: as before',
  );
  // the Back up & restore dialog, with guides
  const gw = (col, ok, x) =>
    ev(`guideRestoreWords(${JSON.stringify(col)}, ${ok}, ${JSON.stringify(x || {})})`);
  assert.equal(gw({ mk: false, pals: 1, wish: 2 }, 2), 'Added 2 to buy and 1 palette; 2 guides restored.');
  assert.equal(
    gw({ mk: false, pals: 0, wish: 0, buy: true }, 1, { dup: 1 }),
    '1 guide restored. Brands I’d buy set from the backup. 1 guide was already here.',
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
