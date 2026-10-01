// Saved data the app can't read: one bad field costs only that field, out-of-range or unknown markers don't half-start
// the app, the unreadable text is copied and not written over, and Home's note says what was lost (only for real
// losses) and hands over the original.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });

test('an out-of-range marker in saved state doesn’t half-start the app', async () => {
  for (const bad of [{ mode: 'palette', palettes: [[5000, 1]], drawn: [9999, 2], customPal: [7000, 3] }, { mode: 'palette', palettes: 'abc' }, { mode: 'random', drawn: ['x', -1] }]) {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState(bad) }) });
    await idle(page);
    assert.deepEqual(errors, [], JSON.stringify(bad));
    const st = await page.evaluate(() => ({ p: state.palettes, d: state.drawn, c: state.customPal }));
    assert.ok(st.p.every((p) => p.every((i) => i < 1000)) && st.d.every((i) => Number.isInteger(i) && i >= 0 && i < 1000), 'bad markers dropped');
    // Match and Help still work (start-up ran to the end)
    await page.click('#mCollection'); await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
    await page.keyboard.press('Escape'); await idle(page);
    assert.equal(await page.isVisible('#matchOverlay'), false, 'Escape closes Match');
    await page.click('#mHome'); await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  }
});

test('one bad field costs only that field; unreadable state is copied and not written over until you act', async () => {
  let { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ excluded: 5, saved: [pal(['Ohuhu|R014'], 7)] }) }) });
  assert.equal(await page.evaluate(() => state.owned.size), 8, 'excluded:5 keeps the collection');
  assert.equal(await page.evaluate(() => state.saved.length), 1, 'and the Library');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null, 'a repaired setting is not a loss: no copy (review 5)');
  assert.deepEqual(errors, []);
  ({ page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ owned: 'abc' }) }) }));
  assert.equal(await page.evaluate(() => state.owned.size), 0, 'a broken collection is not replaced by 451 defaults');
  ({ page, errors } = await openApp({ storage: onboarded({ [KEY]: '{"owned":["Ohuhu|R014"],' }) }));
  await idle(page);
  assert.equal(await page.evaluate((KEY) => localStorage.getItem(KEY), KEY), '{"owned":["Ohuhu|R014"],', 'untouched after opening');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), '{"owned":["Ohuhu|R014"],');
  await page.evaluate(() => save());
  assert.equal(await page.evaluate((KEY) => localStorage.getItem(KEY), KEY), '{"owned":["Ohuhu|R014"],', 'a save before any tap waits');
  await page.click('#mCollection'); await idle(page); await page.evaluate(() => save());
  assert.notEqual(await page.evaluate((KEY) => localStorage.getItem(KEY), KEY), '{"owned":["Ohuhu|R014"],', 'after a tap, saving works');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const file = (o) => ({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
const BACKUP = { v: 3, type: 'ms-backup', ts: Date.now() - 864e5, owned: ['Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|R16'], wish: [], ink: {}, saved: [pal(['Ohuhu|G36'], 99, 'From backup')], guides: [] };
const stored = (page) => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);

test('unreadable data: the note says what was lost; everything lost offers Restore; the copy goes with the note', async () => {
  // two palettes lost: said with the count, and OK deletes the copy
  let { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ saved: [pal(['Ohuhu|R014'], 7), { id: -1, type: 'palette' }, { id: 'x', type: 'palette' }] }) }) });
  await idle(page);
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), '2 palettes couldn’t be read and were left out. A copy of the original was kept.');
  assert.equal(await shown(page, '#lnRestore'), false, 'no Restore when only some palettes went');
  assert.ok(await page.evaluate(() => !!localStorage.getItem('ms-state-backup')));
  await page.click('#lnOk'); await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null, 'dismissed: the copy is deleted');
  assert.deepEqual(errors, []);
  // Save a copy: the copy goes too
  ({ page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ owned: [...OWN, 5], saved: [{ id: 'x', type: 'guide' }] }) }) }));
  await idle(page);
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), '1 marker and 1 guide couldn’t be read and were left out. A copy of the original was kept.');
  await Promise.all([page.waitForEvent('download'), page.click('#lnSave')]); await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
  // a copy left behind by an older version, with no note waiting, is tidied away
  ({ page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState(), 'ms-state-backup': '{"old":1}' }) }));
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
  // everything lost: said so, with Restore a backup
  ({ page, errors } = await openApp({ storage: onboardedV265({ [KEY]: '{"owned":["Ohuhu|R014"],' }) }));
  await idle(page);
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), 'Your saved markers and Library couldn’t be read and were left out. A copy of the original was kept. If you have a backup file, restore it.');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#lnRestore')]);
  await fc.setFiles(file(BACKUP)); await idle(page);
  assert.equal(await shown(page, '#loadNote'), false, 'restored: the note goes');
  assert.match(await toastText(page), /Restored 3 markers and 1 palette/);
  assert.equal((await stored(page)).owned.length, 3, 'and it is saved');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
  assert.deepEqual(errors, []);
});

test('marker keys the app does not know are not counted: Home and the grid agree', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ owned: ['Ohuhu|R014', 'Ohuhu|GONE1', 'Copic|NOPE'] }) }) });
  assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '1 marker');
  await page.click('#mCollection'); await page.waitForSelector('#results .cell');
  assert.equal(await page.locator('#results .cell').count(), 1);
  assert.deepEqual((await stored(page)).owned, ['Ohuhu|R014'], 'dropped from the saved state too');
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState3 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved: [], ...extra });
const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
const shownId = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.getClientRects().length > 0; }, id);
const onePal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });
// the note says what was lost (review 5): one wording per case below
const KEPT = ' A copy of the original was kept.';

test('unreadable data: a note only for real losses; OK puts it away for good', async () => {
  // settings put back to their defaults: repaired quietly
  let { page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: appState3({ excluded: 5, palSize: 'big', tones: 3 }) }) });
  await idle(page);
  assert.equal(await shownId(page, 'loadNote'), false, 'no note for small repairs');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-load-note')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null, 'no copy for a repair (review 5)');
  assert.deepEqual(errors, []);
  // a marker, a palette, a whole collection
  for (const [bad, said] of [[{ owned: [...OWN3, 42] }, '1 marker couldn’t be read and was left out.' + KEPT], [{ saved: [onePal(7, 'P'), { id: -1, type: 'palette' }] }, '1 palette couldn’t be read and was left out.' + KEPT], [{ owned: 'abc' }, 'Your saved markers couldn’t be read and were left out.' + KEPT + ' If you have a backup file, restore it.']]) {
    ({ page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: appState3(bad) }) }));
    await idle(page);
    assert.ok(await shownId(page, 'loadNote'), JSON.stringify(bad));
    assert.equal((await page.textContent('#loadNote .ntxt')).trim(), said);
    assert.deepEqual(errors, []);
  }
  // OK: gone, and not back after a reload
  await page.click('#lnOk'); await page.waitForSelector('#loadNote', { state: 'hidden' });
  assert.equal(await shownId(page, 'loadNote'), false);
  await page.reload(); await idle(page);
  assert.equal(await shownId(page, 'loadNote'), false, 'dismissed for good');
  assert.deepEqual(errors, []);
});

test('unreadable data: Save a copy hands over the original text (download on a computer, share sheet on a phone)', async () => {
  const RAW = '{"owned":["Ohuhu|R014"],';
  const { page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: RAW }) });
  await idle(page);
  assert.ok(await shownId(page, 'loadNote'), 'the whole state unreadable');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#lnSave')]);
  assert.match(dl.suggestedFilename(), /^marker-studio-original-\d{4}-\d\d-\d\d\.txt$/, 'not JSON any more: a text file');
  assert.equal(await readFile(await dl.path(), 'utf8'), RAW, 'exactly as it was');
  await idle(page);
  assert.equal(await shownId(page, 'loadNote'), false, 'saved: the note goes');
  await page.reload(); await idle(page);
  assert.equal(await shownId(page, 'loadNote'), false, 'for good');

  // on an iPhone the share sheet; cancelling it keeps the note
  const bad = appState3({ owned: [...OWN3, null] });
  const b = await openApp({ userAgent: IPHONE, storage: onboardedNoVer({ [KEY]: bad }) });
  await b.page.evaluate(() => {
    window.__shares = []; window.__abort = true;
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = (d) => { const f = d.files[0]; window.__shares.push(f.name); return f.text().then((t) => { window.__shareText = t; if (window.__abort) throw new DOMException('cancelled', 'AbortError'); }); };
  });
  await b.page.click('#lnSave'); await idle(b.page);
  assert.equal(await shownId(b.page, 'loadNote'), true, 'share sheet closed: the note stays');
  await b.page.evaluate(() => { window.__abort = false; });
  await b.page.click('#lnSave'); await b.page.waitForSelector('#loadNote', { state: 'hidden' });
  const names = await b.page.evaluate(() => window.__shares);
  assert.equal(names.length, 2);
  assert.match(names[1], /^marker-studio-original-\d{4}-\d\d-\d\d\.json$/);
  assert.equal(await b.page.evaluate(() => window.__shareText), bad);
  assert.equal(await shownId(b.page, 'loadNote'), false);
  assert.deepEqual([...errors, ...b.errors], []);
});
