// Restoring a backup (Home, the Library, the welcome, pasted text): markers, palettes and guides come back into a
// fresh install; older backup files still restore; palettes are merged and the only question is about markers;
// guides already here, unreadable ones and ones with no room are said; a newer guide is never overwritten; and a
// full storage or a backup with no markers changes nothing it shouldn't.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, teardown, openApp, welcome, sampleGuide, idle, sectionPoint, scrollTop, saveGuide, answerAsks, askAnswer, asked, openBackupDialog, libItem } from './helpers.mjs';

before(setup);
after(teardown);

test('collection backup downloads and restores into a fresh install', async () => {
  const a = await openApp();
  await welcome(a.page, 'look');
  const owned = await a.page.evaluate(() => [...state.owned].sort());
  await openBackupDialog(a.page);
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#backupDownload')]);
  const file = await dl.path();
  JSON.parse(await readFile(file, 'utf8'));

  // the welcome's Restore a backup opens the file picker straight away
  const b = await openApp();
  await answerAsks(b.page);
  const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
  await fc.setFiles(file); await idle(b.page);
  assert.equal(await b.page.isVisible('#welcome'), false);
  assert.deepEqual(await b.page.evaluate(() => [...state.owned].sort()), owned);
  assert.deepEqual([...a.errors, ...b.errors], []);
});

test('guides backup restores guides with their dates; a deleted guide comes back from it', async () => {
  const a = await openApp();
  await sampleGuide(a.page);
  await saveGuide(a.page); await idle(a.page);
  await a.page.click('#mHome'); await a.page.click('#homeLibCard');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
  const file = await dl.path();
  const ts = await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.ts));

  // one tap deletes (with Undo in a toast)
  await libItem(a.page, '#savedList', 'sdel'); await idle(a.page);
  assert.equal(await a.page.locator('#savedList .srow').count(), 0);
  assert.equal(await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 0);

  const [fc] = await Promise.all([a.page.waitForEvent('filechooser'), a.page.click('#guidesRestore')]);
  await fc.setFiles(file); await idle(a.page, 1200);
  assert.deepEqual(await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.ts)), ts);
  assert.deepEqual(a.errors, []);
});

const colourSome = async (page, n) => {
  const ls = await page.evaluate((n) => __mstest.assignData.order.slice(0, n), n);
  await scrollTop(page);
  for (const l of ls) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); }
  return ls;
};

test('restoring an older backup never overwrites a newer guide', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page);
  await saveGuide(page); await idle(page);
  await page.click('#mHome'); await page.click('#homeLibCard');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const file = await dl.path();
  await page.keyboard.press('Escape');
  await page.click('#mSections'); await page.click('#sfColor'); await colourSome(page, 3);
  await page.evaluate(() => __mstest.flushSave()); await idle(page); // it saves itself into its Library entry
  await page.click('#mHome'); await page.click('#homeLibCard');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles(file); await idle(page, 1500);
  const guides = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
  assert.equal(guides.length, 2, 'the backup came back as a copy');
  assert.ok(guides.some((n) => /\(from backup\)$/.test(n)));
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide' && !/from backup/.test(s.name)).id);
  const prog = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => (p.prog || []).length), id);
  assert.equal(prog, 3, 'the newer guide kept its progress');
  assert.deepEqual(errors, []);
});

// ---- From the UX polish pass ----
test('one backup file restores markers, palettes and guides into a fresh install', async () => {
  const a = await openApp();
  await sampleGuide(a.page);
  await saveGuide(a.page); await idle(a.page);
  await a.page.evaluate(() => { state.saved.push({ id: 424242, type: 'palette', name: 'Test palette', keys: ['Ohuhu|R16', 'Ohuhu|B02'], ts: Date.now() }); save(); });
  const want = await a.page.evaluate(() => ({ owned: [...state.owned].sort(), pals: state.saved.filter((s) => s.type !== 'guide').map((s) => s.name), guides: state.saved.filter((s) => s.type === 'guide').map((s) => s.name) }));
  await a.page.click('#mHome'); await a.page.click('#homeLibCard');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
  assert.match(dl.suggestedFilename(), /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
  const file = await dl.path(), d = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(d.type, 'ms-backup'); assert.equal(d.guides.length, 1); assert.ok(d.owned.length > 50);

  const b = await openApp();
  await answerAsks(b.page);
  const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
  await fc.setFiles(file); await idle(b.page, 1500);
  const got = await b.page.evaluate(() => ({ owned: [...state.owned].sort(), pals: state.saved.filter((s) => s.type !== 'guide').map((s) => s.name), guides: state.saved.filter((s) => s.type === 'guide').map((s) => s.name) }));
  assert.deepEqual(got, want);
  assert.deepEqual([...a.errors, ...b.errors], []);
});

test('older backup files still restore (guides-only and collection-only)', async () => {
  const a = await openApp();
  await sampleGuide(a.page);
  await saveGuide(a.page); await idle(a.page);
  // build the two old formats from what's saved
  const old = await a.page.evaluate(async () => {
    const g = state.saved.find((s) => s.type === 'guide'), pl = await IDB.get('guide-' + g.id);
    return { guides: { v: 1, type: 'ms-guides', ts: Date.now(), guides: [{ id: g.id, name: g.name, W: g.W, H: g.H, keys: g.keys, n: g.n, ts: g.ts, payload: pl }] }, coll: { v: 2, owned: ['Ohuhu|R16', 'Ohuhu|B02', 'Copic|E09'], saved: [] } };
  });
  const dir = await mkdtemp(join(tmpdir(), 'ms-')), gf = join(dir, 'guides.json'), cf = join(dir, 'coll.json');
  await writeFile(gf, JSON.stringify(old.guides)); await writeFile(cf, JSON.stringify(old.coll));
  const b = await openApp();
  await answerAsks(b.page);
  await welcome(b.page, 'look');
  await b.page.click('#homeLibCard');
  let [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
  await fc.setFiles(gf); await idle(b.page, 1500);
  assert.equal(await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1, 'guides-only backup restored');
  [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
  await fc.setFiles(cf); await idle(b.page);
  assert.deepEqual(await b.page.evaluate(() => [...state.owned].sort()), ['Copic|E09', 'Ohuhu|B02', 'Ohuhu|R16'], 'collection-only backup restored');
  assert.equal(await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1, 'and the guide is still there');
  assert.deepEqual([...a.errors, ...b.errors], []);
});

// ---- From the second full review ----
test('restoring someone else’s newer backup does not mark this device’s guides as backed up', async () => {
  const b = await openApp();
  await sampleGuide(b.page); await saveGuide(b.page); await idle(b.page);
  const a = await openApp();
  await sampleGuide(a.page); await saveGuide(a.page); await idle(a.page);
  await a.page.click('#mHome'); await a.page.click('#homeLibCard');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
  const file = await dl.path();
  await b.page.click('#mHome'); await b.page.click('#homeLibCard');
  await answerAsks(b.page);
  const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
  await fc.setFiles(file); await idle(b.page, 1500);
  const r = await b.page.evaluate(() => ({ risk: guidesAtRisk(), n: state.saved.filter((s) => s.type === 'guide').length }));
  assert.equal(r.n, 2);
  assert.equal(r.risk, 1, 'this device’s own guide is still not in any backup');
  assert.deepEqual([...a.errors, ...b.errors], []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = (page) => saveGuide(page);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })));
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const doneN = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);

test('restoring a backup that replaces the open guide reopens it as restored (not undone by the open copy); twice adds no copies', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const id = await savedId(page);
  await tickN(page, 3); await idle(page, AUTO);
  // a backup from elsewhere with more done and a later date
  const bk = await page.evaluate(() => gatherGuides());
  bk[0].payload.prog = bk[0].payload.prog.concat(Object.keys(bk[0].payload.assign).slice(20, 26).map(Number));
  bk[0].ts = Date.now() + 5000;
  await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), bk); await idle(page, 1200);
  assert.equal(await doneN(page), 9, 'the open guide shows what was restored');
  await tickN(page, 0); await idle(page, AUTO);
  assert.equal((await stored(page, id)).prog, 9, 'and the Library keeps it');
  // a guide newer here: the backup's version is added once as "(from backup)", not again on a second restore
  await tickN(page, 1, 40); await idle(page, AUTO);
  const old = await page.evaluate((g) => { g[0].ts = 1; return g; }, bk);
  await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), old); await idle(page);
  await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), old); await idle(page);
  assert.equal((await guides(page)).filter((g) => / \(from backup\)$/.test(g.name)).length, 1);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });

test('restore: no question on an empty device, plurals right, and no backup reminder straight after', async () => {
  const { page, errors } = await openApp({ storage: { 'ms-last-ver': 'v263' } });
  await page.click('#wcSkip'); await page.click('#wcLook');
  await answerAsks(page, true);
  const file = JSON.stringify({ v: 3, type: 'ms-backup', ts: Date.now() - 864e5, owned: ['Ohuhu|R014'], saved: [pal(['Ohuhu|R014'], 9, 'Nine')], guides: [] });
  await page.click('#homeLibCard');
  await page.setInputFiles('#guidesFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(file) }); await idle(page);
  assert.deepEqual(await asked(page), [], 'nothing here to replace: no question');
  assert.equal(await page.evaluate(() => state.owned.size), 1);
  assert.match(await toastText(page), /Restored — 1 marker\./);
  await page.keyboard.press('Escape'); await page.click('#mHome'); await idle(page);
  assert.equal(await page.evaluate(() => backupDue()), null, 'no reminder for what was just restored');
  // with something here, the question uses the right words
  await page.evaluate(() => { state.owned.add('Ohuhu|Y111'); save(); });
  await page.click('#homeLibCard');
  await page.setInputFiles('#guidesFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(file) }); await idle(page);
  const q = await asked(page);
  assert.equal(q.length, 1);
  assert.equal(q[0], 'The backup has 1 marker; you have 2 markers. Either way, the backup’s palettes and guides are added.');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review’s leftovers ----
const KEY = 'ohuhu-hb320-picker-v3';
const DAY = 864e5;
const OWN4 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const appState4 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN4, saved: [], ...extra });
// a tiny label map is enough for a guide to be restored
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const guide = (id, name) => ({ id, name, W: 1, H: 1, keys: ['Ohuhu|R014'], n: 1, ts: Date.now() - DAY, payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } } });
const unreadable = (id) => ({ id, name: 'Broken', W: 10, H: 10, payload: { lmap: 12345, assign: {} } });
const file = (o) => ({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
const guideCount = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length);
const openLibrary = async (page) => { await page.click('#mHome'); await page.click('#homeLibCard'); await page.waitForSelector('#savedOverlay.on'); };
async function restoreInLibrary(page, o) {
  await page.evaluate(() => { const t = document.getElementById('msToast'); if (t) t.classList.remove('on'); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles(file(o));
  await page.waitForFunction(() => { const t = document.getElementById('msToast'); return (t && t.classList.contains('on')) || document.querySelector('#savedOverlay .mserr'); }, null, { timeout: 10000 });
}

test('restoring the same backup twice says the guides are already here, not "0 guides restored"; unreadable ones are said', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState4() }) });
  await openLibrary(page);
  const backup = { v: 3, type: 'ms-backup', ts: Date.now() - DAY, owned: OWN4, saved: [], guides: [guide(21, 'Owl'), guide(22, 'Cat')] };
  await restoreInLibrary(page, backup);
  assert.match(await toastText(page), /2 guides restored\./);
  assert.equal(await guideCount(page), 2);
  await restoreInLibrary(page, backup);
  const again = await toastText(page);
  assert.match(again, /2 guides were already here\./);
  assert.doesNotMatch(again, /\d+ guides? restored/, 'nothing counted as restored');
  assert.equal(await guideCount(page), 2, 'none added twice');
  assert.equal(await page.textContent('#backupCap'), again.replace(/\s+$/, ''), 'the caption says the same');
  // one here already, one new, one unreadable
  await restoreInLibrary(page, { v: 1, type: 'ms-guides', ts: Date.now(), guides: [guide(21, 'Owl'), guide(23, 'Fox'), unreadable(24)] });
  assert.equal(await toastText(page), '1 guide restored. 1 guide was already here; 1 guide couldn’t be read.');
  assert.equal(await guideCount(page), 3);
  // the same through restoreAny's callback (the Welcome and Home's note)
  const r = await page.evaluate((o) => new Promise((res) => restoreAny(new File([JSON.stringify(o)], 'b.json'), 'nope', (r, why) => res({ r, why, left: r && guidesLeft(r), list: r && restoredList(r) }))), backup);
  assert.equal(r.r.guides, 0);
  assert.equal(r.r.dup, 2);
  assert.equal(r.left, '2 guides were already here.');
  assert.deepEqual(errors, []);
});

test('the Welcome says which guides it couldn’t read, and one with only guides already here isn’t called empty', async () => {
  const { page, errors } = await openApp();
  await page.waitForSelector('#welcome.on');
  await page.setInputFiles('#wcFile', file({ v: 3, type: 'ms-backup', ts: Date.now() - DAY, owned: OWN4, saved: [], guides: [guide(21, 'Owl'), unreadable(22)] }));
  await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'));
  assert.equal(await toastText(page), 'Restored 4 markers and 1 guide. 1 guide couldn’t be read.');
  // the words Welcome and Home's note use when only guides already here came back
  assert.equal(await page.evaluate(() => { const r = { markers: 0, palettes: 0, guides: 0, dup: 1, bad: 0, full: 0 }; return [restoredList(r), guidesLeft(r)]; }).then((a) => a.join('|')), '|1 guide was already here.');
  assert.deepEqual(errors, []);
});

test('a guide the storage has no room for is said as a failure, not counted as restored', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState4() }) });
  await openLibrary(page);
  await page.evaluate((KEY) => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === KEY) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }, KEY);
  await restoreInLibrary(page, { v: 1, type: 'ms-guides', ts: Date.now(), guides: [guide(21, 'Owl'), guide(22, 'Cat')] });
  const card = await page.textContent('#savedOverlay .mserr');
  assert.match(card, /2 guides couldn’t be saved — this browser’s storage is full\. Delete a few guides from the Library, then restore again\./);
  assert.doesNotMatch(card, /restored\./);
  assert.equal(await toastText(page), '', 'no toast saying it worked');
  assert.equal(await guideCount(page), 0);
  assert.match(await page.textContent('#guidesRestore'), /Restore/, 'the button doesn’t say Restored');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
const guidesR5 = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })));

test('restore skips unreadable guides and counts duplicates apart; a single guide file restored twice is added once', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const restore = (list) => page.evaluate((list) => new Promise((r) => restoreGuideList(list, 0, (ok, copies, info) => r({ ok, copies, dup: info && info.dup, bad: info && info.bad }))), list);
  const bad = [
    { id: 11, name: 'numeric', W: 10, H: 10, payload: { lmap: 12345, assign: {} } },
    { id: 12, name: 'jpeg', W: 10, H: 10, payload: { lmap: 'data:image/jpeg;base64,AAAAAAAAAAAAAAAAAAAA', assign: {} } },
    { id: 13, name: 'broken', W: 10, H: 10, payload: { lmap: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA', assign: {} } },
  ];
  assert.deepEqual(await restore(bad), { ok: 0, copies: 0, dup: 0, bad: 3 });
  assert.equal((await guidesR5(page)).length, 1, 'none added');
  // a single guide file (no id) restored twice
  const one = await page.evaluate(() => gatherGuides().then((a) => { const g = a[0]; delete g.id; g.name = 'Shared guide'; return [g]; }));
  assert.deepEqual(await restore(one), { ok: 0, copies: 0, dup: 1, bad: 0 }, 'the same as the guide already here');
  // (deleted as the Library does it, so the open guide knows: v285 would otherwise put it in the Library again)
  await page.evaluate(() => { const g = state.saved.find((s) => s.type === 'guide'); sfDeleteDesign(g.id); SF.libChanged(g.id, false); });
  assert.deepEqual(await restore(one), { ok: 1, copies: 0, dup: 0, bad: 0 });
  assert.deepEqual(await restore(one), { ok: 0, copies: 0, dup: 1, bad: 0 });
  assert.equal((await guidesR5(page)).length, 1);
  // a backup restored twice
  const all = await page.evaluate(() => gatherGuides());
  assert.deepEqual(await restore(all), { ok: 0, copies: 0, dup: 1, bad: 0 });
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const fillStorage = (page) => page.evaluate((KEY) => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === KEY) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }, KEY);
const jsonFile = (o) => ({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
const BACKUP = { v: 3, type: 'ms-backup', ts: Date.now() - 864e5, owned: ['Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|R16'], wish: [], ink: {}, saved: [pal(['Ohuhu|G36'], 99, 'From backup')], guides: [] };
const storedState = (page) => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);

test('restore with storage full: the dialog, the Welcome and pasted text say it failed and change nothing', async () => {
  let { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await openBackupDialog(page);
  await fillStorage(page);
  await answerAsks(page, false);
  await page.setInputFiles('#backupFile', jsonFile(BACKUP)); await idle(page);
  assert.match(await page.textContent('#backupOverlay .mserr'), /storage is full, so nothing was changed/);
  assert.equal(await page.evaluate(() => state.owned.size), OWN.length, 'the markers are as they were');
  assert.equal(await page.evaluate(() => state.saved.length), 0, 'no palette added');
  assert.doesNotMatch(await toastText(page), /Restored/);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-backup-sig')), null, 'not recorded as backed up');
  // pasted text (the error card is put away first)
  await page.click('#backupOverlay .mserrx'); if (!(await page.isVisible('#backupText'))) await page.click('#backupShow'); // (open already from the Library's line, v288)
  await page.fill('#backupText', JSON.stringify({ v: 2, owned: ['Ohuhu|B08'], saved: [] }));
  await answerAsks(page, true);
  await page.click('#backupRestore');
  await page.waitForFunction(() => /Couldn’t restore — this browser’s storage is full/.test(document.getElementById('backupCap').textContent));
  assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
  assert.ok(await page.isVisible('#backupOverlay'), 'the dialog stays open');
  assert.deepEqual(errors, []);
  // the Welcome
  ({ page, errors } = await openApp());
  await page.waitForSelector('#welcome.on');
  await fillStorage(page);
  await page.setInputFiles('#wcFile', jsonFile(BACKUP)); await idle(page);
  assert.match(await page.textContent('#wcErr'), /storage is full/);
  assert.ok(await page.isVisible('#welcome'), 'the Welcome stays');
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.deepEqual(errors, []);
});

test('a backup with no markers leaves yours alone, asks nothing, and adds its palettes', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await answerAsks(page, true);
  await openBackupDialog(page);
  await page.setInputFiles('#backupFile', jsonFile({ ...BACKUP, owned: [] })); await idle(page);
  assert.deepEqual(await asked(page), [], 'no "Replace your 8 markers with the backup’s 0 markers?"');
  assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
  assert.equal((await storedState(page)).saved.length, 1, 'the palette is added and saved');
  assert.match(await page.textContent('#backupCap'), /Kept your markers; 1 palette added\./);
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const onePal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });
const backupFile = (o) => ({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });

test('welcome › Restore a backup: the file picker opens in the same tap; cancel or a wrong file stays; success lands on Home', async () => {
  const { page, errors } = await openApp();
  assert.ok(await page.isVisible('#welcome'));
  // cancelled
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
  await fc.setFiles([]); await idle(page);
  assert.ok(await page.isVisible('#welcome'), 'cancel: still on the welcome');
  assert.equal(await page.evaluate(() => document.getElementById('backupOverlay').classList.contains('on')), false, 'no Back up & restore dialog');
  // not a backup: said in the welcome
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
  await fc.setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') }); await idle(page);
  assert.ok(await page.isVisible('#welcome'));
  assert.match(await page.textContent('#welcome .mserr'), /isn’t a Marker Studio backup/);
  // an empty backup: nothing to restore, said there
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
  await fc.setFiles(backupFile({ v: 3, type: 'ms-backup', ts: Date.now(), owned: [], saved: [], guides: [] })); await idle(page);
  assert.ok(await page.isVisible('#welcome'));
  assert.match(await page.textContent('#welcome .mserr'), /That backup is empty/);
  // a backup with markers, palettes and guides
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
  await fc.setFiles(backupFile({ v: 3, type: 'ms-backup', ts: Date.now() - DAY, owned: OWN3, saved: [onePal(11, 'A'), onePal(12, 'B')], guides: [guide(21, 'Owl'), guide(22, 'Cat')] }));
  await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'));
  assert.equal(await toastText(page), 'Restored 3 markers, 2 palettes and 2 guides');
  assert.equal(await page.evaluate(() => state.mode), 'home');
  assert.ok(await page.isVisible('#homeView'));
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 2);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1', 'the welcome is done');
  await page.reload(); await idle(page);
  assert.equal(await page.isVisible('#welcome'), false);
  assert.deepEqual(errors, []);

  // only what came back is named, with the right plural
  const b = await openApp();
  [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
  await fc.setFiles(backupFile({ v: 2, owned: ['Ohuhu|R014'] }));
  await b.page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'));
  assert.equal(await toastText(b.page), 'Restored 1 marker');
  assert.deepEqual(b.errors, []);
});
const onboardedV264 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v264', ...extra });
const palAt = (keys, id, name, ts) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: ts || id });
const backup = (owned, saved, extra = {}) => Buffer.from(JSON.stringify({ v: 3, type: 'ms-backup', ts: Date.now() - 864e5, owned, saved, guides: [], ...extra }));
async function restore(page, buf) {
  if (!(await page.isVisible('#savedOverlay'))) { await page.click('#mHome'); await page.click('#homeLibCard'); }
  await page.setInputFiles('#guidesFile', { name: 'b.json', mimeType: 'application/json', buffer: buf }); await idle(page);
}
const palettes = (page) => page.evaluate(() => state.saved.filter((s) => s.type !== 'guide').map((s) => s.id + ':' + s.name).sort());

test('restore: palettes are merged (local ones kept, new ones added, a shared id keeps the local one); no question with the same markers', async () => {
  const local = [palAt(['Ohuhu|R014'], 101, 'Local only'), palAt(['Ohuhu|Y111'], 202, 'Mine')];
  const { page, errors } = await openApp({ storage: onboardedV264({ [KEY]: appState({ saved: local }) }) });
  await answerAsks(page, true);
  await restore(page, backup(OWN, [palAt(['Ohuhu|B08', 'Ohuhu|G36'], 202, 'Theirs'), palAt(['Ohuhu|RV08'], 303, 'Backup only')]));
  assert.deepEqual(await asked(page), [], 'same markers: nothing to ask');
  assert.deepEqual(await palettes(page), ['101:Local only', '202:Mine', '303:Backup only']);
  assert.deepEqual(await page.evaluate(() => state.saved.find((s) => s.id === 202).keys), ['Ohuhu|Y111'], 'the local copy of a shared id is kept as it was');
  assert.match(await toastText(page), /Restored — 8 markers\. 1 palette added\./);
  // kept after a reload
  await page.reload(); await idle(page);
  assert.deepEqual(await palettes(page), ['101:Local only', '202:Mine', '303:Backup only']);
  // not everything here is in that file (the local palettes), so it doesn't count as backed up
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-backup-sig')), null);
  assert.deepEqual(errors, []);
});

test('restore: the question is only about markers, with the right plurals; Cancel keeps them but still adds palettes', async () => {
  const { page, errors } = await openApp({ storage: onboardedV264({ [KEY]: appState({ saved: [palAt(['Ohuhu|R014'], 101, 'Local only')] }) }) });
  await answerAsks(page, false);
  await restore(page, backup(['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09'], [palAt(['Ohuhu|B08'], 404, 'From file')], { wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }] }));
  assert.deepEqual(await asked(page), ['The backup has 3 markers; you have 8 markers. Either way, the backup’s palettes and guides are added.']);
  assert.equal(await page.evaluate(() => state.owned.size), 8, 'Cancel keeps the markers');
  assert.deepEqual(await page.evaluate(() => state.wish), [], 'and the To buy list that goes with them');
  assert.deepEqual(await palettes(page), ['101:Local only', '404:From file'], 'the palettes are added anyway');
  assert.match(await toastText(page), /Kept your markers; 1 palette added\./);
  // OK: the backup's markers (and its To buy list); the local palette is still there
  await askAnswer(page, true);
  await restore(page, backup(['Ohuhu|R014'], [palAt(['Ohuhu|B08'], 404, 'From file')], { wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }] }));
  assert.equal((await asked(page))[1], 'The backup has 1 marker; you have 8 markers. Either way, the backup’s palettes and guides are added.');
  assert.deepEqual(await page.evaluate(() => [...state.owned]), ['Ohuhu|R014']);
  assert.deepEqual(await page.evaluate(() => state.wish.map((w) => w.k)), ['Ohuhu|G43']);
  assert.deepEqual(await palettes(page), ['101:Local only', '404:From file']);
  // one marker here now: singular
  await restore(page, backup(['Ohuhu|R014', 'Ohuhu|B08'], []));
  assert.equal((await asked(page))[2], 'The backup has 2 markers; you have 1 marker. Either way, the backup’s palettes and guides are added.');
  assert.deepEqual(await palettes(page), ['101:Local only', '404:From file'], 'a backup without palettes removes none');
  // pasted text (Markers › Back up & restore) merges the same way
  await page.keyboard.press('Escape');
  await page.evaluate((t) => { document.getElementById('backupText').value = t; document.getElementById('backupRestore').click(); }, JSON.stringify({ v: 2, owned: ['Ohuhu|R014', 'Ohuhu|B08'], saved: [palAt(['Ohuhu|G36'], 505, 'Pasted')] }));
  await idle(page);
  assert.equal((await asked(page)).length, 3, 'same markers: no question');
  assert.deepEqual(await palettes(page), ['101:Local only', '404:From file', '505:Pasted']);
  assert.deepEqual(errors, []);
});

test('restore: no question on a device without markers (even with palettes); a file holding everything counts as backed up', async () => {
  const { page, errors } = await openApp({ storage: onboardedV264({ [KEY]: appState({ owned: [], saved: [palAt(['Ohuhu|R014'], 101, 'Kept')] }) }) });
  await answerAsks(page, true);
  await restore(page, backup(['Ohuhu|R014', 'Ohuhu|B08'], [palAt(['Ohuhu|R014'], 101, 'Kept'), palAt(['Ohuhu|B08'], 606, 'New')]));
  assert.deepEqual(await asked(page), []);
  assert.equal(await page.evaluate(() => state.owned.size), 2);
  assert.deepEqual(await palettes(page), ['101:Kept', '606:New']);
  // everything here is in the file: marked as restored, no reminder, and the reminder's fingerprint matches
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-backup-sig') === dataSig()), true);
  assert.ok(+(await page.evaluate(() => localStorage.getItem('ms-guides-backup-ts'))) > 0);
  assert.equal(await page.evaluate(() => backupDue()), null);
  // a palette made afterwards is a change since that backup
  await page.evaluate(() => { state.saved.push({ id: 707, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 707 }); save(); });
  assert.notEqual(await page.evaluate(() => localStorage.getItem('ms-backup-sig')), await page.evaluate(() => dataSig()));
  assert.deepEqual(errors, []);
});
