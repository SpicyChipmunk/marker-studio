// v308 data safety: restore's "Add the backup's markers" (merge rules) and Undo, what a restore of the same markers
// says, guides only further along here (no "(from backup)" copy), "… (n)" names, safe file names, the app version in
// files, and the words for an empty, cut-short or picture file.
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
  const backup = { v: 3, type: 'ms-backup', ts: 5, owned: ['Copic|E09'], wish: [W('Copic|B02')], saved: [] };
  for (const how of [true, 'add', false]) {
    const { ev, ls } = boot(
      stored({ wish: [W('Copic|B000')], ink: { 'Ohuhu|B08': 'low' }, buyBrands: ['Ohuhu'] }),
    );
    const before = J(ev, '[[...state.owned].sort(), state.wish.map((w) => w.k), state.ink, state.buyBrands]');
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
  assert.equal(ahead({ ...b, out: { 3: { k: 'Ohuhu|B08', done: 2, t: 3 } } }), true, 'further done outside');
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
