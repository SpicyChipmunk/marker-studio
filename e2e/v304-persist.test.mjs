// v304 (backup and saving): a restore never overwrites a lost guide (kept, offered on Home) or changes made here since
// the last backup (kept as "… (before restore)", taken out again if the backup's copy can't be saved), and a guide whose
// delete is still finishing comes back as itself; a save that failed because the browser's database stopped answering
// says so (not "storage is full"), and the next failure says what it is; Back up says which guides it couldn't read and
// the reminder asks again at once; in a Safari tab on an iPhone or iPad the reminder after a first coloured section, or
// after five days away, is one card with Add to Home Screen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, saveGuide, idle, pause } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3',
  DAY = 864e5;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const CHROME_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const safariTab = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); };
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState = (saved = []) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved });
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v304', ...extra });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const shown = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.getClientRects().length > 0; }, id);

// a device with markers and one Library guide "name" (id), stored and marked as backed up 3 days ago; returns the
// backup file of that moment
async function withGuide(id, name) {
  const a = await openApp();
  await welcome(a.page, 'look'); await idle(a.page);
  const T0 = Date.now() - 3 * DAY;
  const bk = await a.page.evaluate(async ([PNG, id, name, T0]) => {
    window.PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
    window.rows = () => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name }));
    window.restoreFile = (o, cb) => new Promise((r) => {
      const t = document.getElementById('msToast'); if (t) t.classList.remove('on');
      restoreAny(new File([JSON.stringify(o)], 'b.json', { type: 'application/json' }), 'guidesRestore', cb ? (x) => r(x) : undefined);
      if (!cb) setTimeout(() => r({ toast: (document.getElementById('msToast').classList.contains('on') && document.getElementById('msToast').textContent) || '', card: (document.querySelector('.mserr') || {}).textContent || '' }), 1500);
    });
    window.change = (id, name, k) => sfSaveDesign({ id, name, W: 1, H: 1, keys: [k], n: 1, payload: PL(k, { prog: [0] }), quiet: true });
    await sfSaveDesign({ id, name, W: 1, H: 1, keys: ['Ohuhu|R014'], n: 1, payload: PL('Ohuhu|R014'), ts: T0, keepTs: true, quiet: true });
    state.saved.find((s) => s.id === id).bk = T0; save(true);
    localStorage.setItem('ms-guides-backup-ts', String(T0));
    const gs = await gatherGuides();
    return { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
  }, [PNG, id, name, T0]);
  return { ...a, bk };
}

test('v304 P1: restoring never overwrites a lost guide: it is left as it is, said, and offered on Home', async () => {
  const { page, errors, bk } = await withGuide(5004, 'Owl');
  const r = await page.evaluate(async (bk) => {
    await change(5004, 'Owl', 'Ohuhu|Y111'); // coloured since the backup
    state.saved = state.saved.filter((s) => s.id !== 5004); save(true); // then its row couldn't be read
    const r = await restoreFile(bk);
    return { ...r, rows: rows(), prog: (await IDB.get('guide-5004')).prog };
  }, bk);
  assert.deepEqual(r.prog, [0], 'the lost guide keeps its progress (v303: the backup’s copy replaced it)');
  assert.deepEqual(r.rows.map((x) => x.name), ['Owl (from backup)']);
  assert.match(r.toast, /1 guide stored on this device but not in your Library was left as it is — add it back from Home\./);
  assert.doesNotMatch(r.toast, /newer here/);
  await page.click('#mHome'); await page.waitForSelector('#lostNote', { state: 'visible', timeout: 8000 });
  assert.match(await page.textContent('#lostNote'), /Found 1 guide that isn’t in your Library/);
  // the same backup again: nothing more
  const r2 = await page.evaluate((bk) => restoreFile(bk).then((x) => ({ ...x, n: rows().length })), bk);
  assert.equal(r2.n, 1);
  assert.match(r2.toast, /already here/);
  assert.deepEqual(errors, []);
});

test('v304 P1: a guide deleted a moment ago (Undo still showing) comes back from the backup as itself', async () => {
  const { page, errors, bk } = await withGuide(5001, 'Owl');
  const r = await page.evaluate(async (bk) => {
    await change(5001, 'Owl', 'Ohuhu|Y111');
    openLibrary(); libDelete(5001);
    const r = await restoreFile(bk);
    return { ...r, rows: rows() };
  }, bk);
  assert.deepEqual(r.rows, [{ id: 5001, name: 'Owl' }], 'not “Owl (from backup)”');
  assert.doesNotMatch(r.toast, /newer here|not in your Library/);
  await pause(page, 6500, 'the Undo time runs out: the delete finishes');
  assert.ok(await page.evaluate(() => IDB.get('guide-5001').then((p) => !!p)), 'the restored guide is still stored');
  assert.deepEqual(errors, []);
});

test('v304 P2: changes made here since the last backup are kept as “… (before restore)” when a newer backup replaces the guide', async () => {
  const { page, errors, bk } = await withGuide(5002, 'Cat');
  const r = await page.evaluate(async (bk) => {
    await change(5002, 'Cat', 'Ohuhu|Y111');
    const nb = JSON.parse(JSON.stringify(bk));
    nb.guides[0].ts = Date.now() + 1; nb.guides[0].payload = PL('Ohuhu|B08', { prog: [0] });
    const r1 = await restoreFile(nb);
    const rows1 = rows(), kept = rows1.find((x) => /before restore/.test(x.name));
    const keptPl = await IDB.get('guide-' + kept.id), mine = await IDB.get('guide-5002');
    const r2 = await restoreFile(nb), n2 = rows().length;
    // and through the Welcome's and Home's note's way (a callback): what was kept is there to say
    await new Promise((res) => setTimeout(res, 20));
    await change(5002, 'Cat', 'Ohuhu|G36');
    nb.guides[0].ts = Date.now() + 1; nb.guides[0].payload = PL('Ohuhu|R014', { prog: [0] });
    const r3 = await restoreFile(nb, true);
    return { r1, rows1, keptAssign: keptPl.assign[0], mineAssign: mine.assign[0], r2, n2, r3 };
  }, bk);
  assert.deepEqual(r.rows1.map((x) => x.name).sort(), ['Cat', 'Cat (before restore)']);
  assert.equal(r.keptAssign, 'Ohuhu|Y111', 'the copy holds the changes made here');
  assert.equal(r.mineAssign, 'Ohuhu|B08', 'the guide is the backup’s');
  assert.match(r.r1.toast, /1 guide changed here since your last backup was kept as “… \(before restore\)”\./);
  assert.match(r.r2.toast, /already here/);
  assert.equal(r.n2, 2, 'the same backup again adds no copy');
  assert.equal(r.r3.kept, 1);
  assert.equal(await page.evaluate((x) => restoreKeptWords(x), r.r3), ' 1 guide changed here since your last backup was kept as “… (before restore)”.');
  assert.deepEqual(errors, []);
});

test('v304 P2: when the backup’s copy can’t be saved, the copy kept of the guide here is taken out again', async () => {
  const { page, errors, bk } = await withGuide(5003, 'Fox');
  const r = await page.evaluate(async ([bk, KEY]) => {
    await change(5003, 'Fox', 'Ohuhu|Y111');
    const nb = JSON.parse(JSON.stringify(bk));
    nb.guides[0].ts = Date.now() + 60000; nb.guides[0].payload = PL('Ohuhu|B08', { prog: [0] });
    // the copy kept aside saves; the backup's copy then finds the storage full
    const o = Storage.prototype.setItem; let n = 0;
    Storage.prototype.setItem = function (k, v) { if (k === KEY && n++ >= 1) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); };
    const r1 = await restoreFile(nb);
    Storage.prototype.setItem = o;
    const rows1 = rows();
    const r2 = await restoreFile(nb);
    return { r1, rows1, r2, rows2: rows() };
  }, [bk, KEY]);
  assert.deepEqual(r.rows1.map((x) => x.name), ['Fox'], 'no copy left beside a guide that wasn’t replaced');
  const said = r.r1.card + r.r1.toast;
  assert.match(said, /couldn’t be saved — this browser’s storage is full/);
  assert.doesNotMatch(said, /before restore/);
  assert.deepEqual(r.rows2.map((x) => x.name).sort(), ['Fox', 'Fox (before restore)'], 'restored again with room: one copy');
  assert.deepEqual(errors, []);
});

test('v304 P3: a save the browser’s database didn’t answer says reload, not “storage is full”; the next failure says what it is', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page); await idle(page);
  const tick = (k) => page.evaluate((k) => { const t = __mstest; t.colored[t.assignData.order[k]] = 1; t.guideDirty = true; t.renderGuide(); }, k);
  const status = () => page.evaluate(() => document.getElementById('sfSaveSt').textContent);
  await page.evaluate(() => { window.__put = IDB.put; IDB.put = (k, v) => (/^guide-\d/.test(k) ? Promise.reject(new DOMException('gone', 'UnknownError')) : window.__put.call(IDB, k, v)); });
  await tick(0); await page.evaluate(() => __mstest.flushSave()); await idle(page, 1500);
  assert.match(await toastText(page), /^Couldn’t save “[^”]+” — this browser’s storage isn’t answering\. Reload Marker Studio and try again; your changes are still open here\.$/);
  assert.equal(await status(), 'Not saved — reload to try again');
  // the database answers again, but now the app's own storage is full: said as full (v304 first draft: still "isn't answering")
  await page.evaluate((KEY) => { IDB.put = window.__put; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === KEY) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }, KEY);
  await tick(1); await page.evaluate(() => __mstest.flushSave()); await idle(page, 1500);
  assert.equal(await status(), 'Not saved — storage is full');
  assert.equal(await page.evaluate(() => storeErr()), 'QuotaExceededError');
  assert.deepEqual(errors, []);
});

test('v304 P4: Back up says which guides it couldn’t read, the reminder asks again at once, and focus follows the card', async () => {
  const gone = { id: 77, type: 'guide', name: 'Unreadable', keys: [], W: 1, H: 1, n: 1, done: 1, ts: Date.now() - 20 * DAY };
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState([gone]), 'ms-first-use': String(Date.now() - 15 * DAY) }) });
  await page.waitForSelector('#bkGo');
  await page.focus('#bkGo');
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]); await idle(page);
  assert.match(await toastText(page), /^Backed up, but 1 guide couldn’t be read and isn’t in it\. Reload Marker Studio and back up again before deleting anything\.$/);
  assert.ok(await shown(page, 'backupNudge'), 'the reminder is due again at once');
  assert.match(await page.textContent('#backupNudge'), /1 guide couldn’t be read by your last backup\. Reload Marker Studio, then back up again\./);
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  assert.deepEqual(errors, []);
});

test('v304 D8: in a Safari tab on an iPhone, a guide’s first coloured section brings one card: keep it safe — Back up now, or Not now for both', async () => {
  const g = { id: 88, type: 'guide', name: 'Owl', keys: [], W: 1, H: 1, n: 4, done: 1, ts: Date.now() - DAY / 4 };
  const storage = onboarded({ [KEY]: appState([g]) });
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
  await idle(page);
  assert.ok(await shown(page, 'installCard'));
  assert.equal(await shown(page, 'backupNudge'), false, 'one card');
  const txt = await page.textContent('#installCard');
  assert.match(txt, /^Keep your guide safe on this iPhone Safari deletes a website’s saved work after about seven days of using Safari without opening it\. Add Marker Studio to your Home Screen to stop that — back up first, then restore the file in the Home Screen app\./);
  assert.equal(await page.textContent('#installCard .nb1'), 'Back up now');
  await page.focus('#installCard [data-inst="later"]'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await shown(page, 'installCard'), false);
  assert.equal(await shown(page, 'backupNudge'), false, 'Not now rests both');
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  await page.reload(); await idle(page);
  assert.equal(await shown(page, 'installCard'), false);
  assert.equal(await shown(page, 'backupNudge'), false);
  // the same work in Chrome on a computer: nothing yet (two weeks, as before). (Chrome's user agent named: in
  // Safari's engine the default one is Safari's, which is a Safari tab)
  const b = await openApp({ storage, userAgent: CHROME_DESKTOP });
  await idle(b.page);
  assert.equal(await shown(b.page, 'backupNudge'), false);
  assert.deepEqual([...errors, ...b.errors], []);
});

test('v304 D8: in a Safari tab, a visit after five days away with changes since the last backup brings the reminder', async () => {
  const g = { id: 89, type: 'guide', name: 'Cat', keys: [], W: 1, H: 1, n: 4, done: 2, ts: Date.now() - 6 * DAY, bk: Date.now() - 8 * DAY };
  const storage = onboarded({ [KEY]: appState([g]), 'ms-guides-backup-ts': String(Date.now() - 8 * DAY), 'ms-last-visit': String(Date.now() - 6 * DAY) });
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
  await idle(page);
  assert.ok(await shown(page, 'installCard'));
  assert.match(await page.textContent('#installCard'), /^Keep your work safe on this iPhone Safari deletes .* 1 guide has changed since your last backup\. Add Marker Studio/);
  // a day away only: no card from the backup
  const b = await openApp({ userAgent: IPHONE, init: safariTab, storage: { ...storage, 'ms-last-visit': String(Date.now() - DAY) } });
  await idle(b.page);
  assert.equal(await b.page.evaluate(() => !!backupDue()), false);
  assert.deepEqual([...errors, ...b.errors], []);
});

test('v304 P4: a backup that couldn’t read a guide brings the reminder back on Home even while an earlier Later is resting it', async () => {
  const gone = { id: 78, type: 'guide', name: 'Unreadable', keys: [], W: 1, H: 1, n: 1, done: 1, ts: Date.now() - 20 * DAY };
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState([gone]), 'ms-first-use': String(Date.now() - 15 * DAY), 'ms-backup-snooze': String(Date.now() + 5 * DAY) }) });
  await idle(page);
  assert.equal(await shown(page, 'backupNudge'), false, 'put off with Later two days ago');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => backupAll('noSuchButton'))]);
  assert.ok(dl); await idle(page);
  assert.match(await toastText(page), /^Backed up, but 1 guide couldn’t be read/);
  assert.ok(await shown(page, 'backupNudge'), 'due at once, Later or not');
  assert.match(await page.textContent('#backupNudge'), /1 guide couldn’t be read by your last backup\. Reload Marker Studio, then back up again\./);
  await page.reload(); await idle(page);
  assert.ok(await shown(page, 'backupNudge'), 'and after a reload');
  assert.deepEqual(errors, []);
});

test('v304 P3: changes to a guide no longer open that the database didn’t take say reload, without “still open here”', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page); await idle(page);
  const a = await page.evaluate(() => __mstest.curId), nm = await page.evaluate(() => __mstest.curName);
  // a second Library guide to switch to (a copy of the first)
  const b = await page.evaluate((a) => IDB.get('guide-' + a).then((pl) => { const e = state.saved.find((s) => s.id === a); return sfSaveDesign({ name: 'Other', W: e.W, H: e.H, keys: e.keys, n: e.n, payload: pl, quiet: true }); }), a);
  assert.ok(b);
  // the open guide's next save is slow and then fails (the database dropped), and meanwhile another guide is put in place
  await page.evaluate((a) => {
    const put = IDB.put;
    IDB.put = (k, v) => (k === 'guide-' + a ? new Promise((_, rej) => setTimeout(() => rej(new DOMException('gone', 'UnknownError')), 1500)) : put.call(IDB, k, v));
    const t = document.getElementById('msToast'); if (t) t.classList.remove('on');
  }, a);
  await page.evaluate(() => { const t = __mstest; t.colored[t.assignData.order[0]] = 1; t.guideDirty = true; t.renderGuide(); t.flushSave(); });
  await page.evaluate((b) => sfLoadDesign(b).then((d) => __mstest.openDesignObj(d, b)), b);
  await page.waitForFunction((b) => __mstest.curId === b, b);
  await page.waitForFunction(() => /isn’t answering|storage is full/.test((document.getElementById('msToast') || {}).textContent || ''), null, { timeout: 8000 });
  const t = await toastText(page);
  assert.equal(t, 'Couldn’t save “' + nm + '” — this browser’s storage isn’t answering. Reload Marker Studio and try again.');
  assert.doesNotMatch(t, /still open|storage is full/);
  assert.deepEqual(errors, []);
});
