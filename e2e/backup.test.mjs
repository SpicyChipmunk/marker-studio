// Making a backup: on a phone through the share sheet (a download when files can't be shared, a Share button when
// the tap has expired), a download on a computer; the backup reminder and Home's Back up now; and a backup takes the
// open guide's last changes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KEY = 'ohuhu-hb320-picker-v3';
const DAY = 864e5;
// Safari in a tab says navigator.standalone === false; from the Home Screen it's true
const safariTab = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); };
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
// saved app state as the app writes it (the flags stop the one-off marker additions for older collections)
const appStateOf = (owned) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned, saved: [] });
const collection = (extra = {}) => onboarded({ [KEY]: appStateOf(['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08']), ...extra });

const stubShare = (mode) => {
  window.__shares = [];
  navigator.canShare = (d) => mode !== 'cannot' && !!(d && d.files && d.files.length);
  navigator.share = (d) => {
    window.__shares.push(d.files[0].name);
    return d.files[0].text().then((t) => {
      window.__shareText = t;
      const first = window.__shares.length === 1;
      if (mode === 'notallowed' && first) throw new DOMException('Must be handling a user gesture', 'NotAllowedError');
      if (mode === 'abort') throw new DOMException('Share canceled', 'AbortError');
    });
  };
};
const backupTs = (page) => page.evaluate(() => localStorage.getItem('ms-guides-backup-ts'));

test('backup on an iPhone goes to the share sheet, and counts as made once shared', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
  await page.evaluate(stubShare, 'ok');
  await page.evaluate(() => openBackup());
  await page.click('#backupDownload'); await idle(page);
  const names = await page.evaluate(() => window.__shares);
  assert.equal(names.length, 1);
  assert.match(names[0], /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
  const d = JSON.parse(await page.evaluate(() => window.__shareText));
  assert.equal(d.type, 'ms-backup'); assert.equal(d.owned.length, 3);
  assert.ok(await backupTs(page), 'marked as backed up');
  assert.match(await page.textContent('#backupDownload'), /Saved/);
  assert.deepEqual(errors, []);
});

test('backup falls back to a download when files can\'t be shared', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
  await page.evaluate(stubShare, 'cannot');
  await page.evaluate(() => openBackup());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupDownload')]);
  assert.match(dl.suggestedFilename(), /^marker-studio-backup-.*\.json$/);
  assert.equal((await page.evaluate(() => window.__shares)).length, 0);
  assert.ok(await backupTs(page));
  assert.deepEqual(errors, []);
});

test('on a computer the backup downloads even where sharing files is possible', async () => {
  const { page, errors } = await openApp({ storage: collection() });
  await page.evaluate(stubShare, 'ok');
  await page.evaluate(() => openBackup());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupDownload')]);
  assert.ok(dl);
  assert.equal((await page.evaluate(() => window.__shares)).length, 0);
  assert.deepEqual(errors, []);
});

test('share after the tap expired: a toast offers Share; cancelling the sheet is left alone', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
  await page.evaluate(stubShare, 'notallowed');
  await page.evaluate(() => openBackup());
  await page.click('#backupDownload');
  await page.waitForSelector('#msToast.on #toastAct');
  assert.match(await page.textContent('#msToast'), /Your backup is ready/);
  assert.equal(await page.textContent('#toastAct'), 'Share');
  assert.equal(await backupTs(page), null, 'not backed up yet');
  await page.click('#toastAct'); await idle(page);
  assert.equal((await page.evaluate(() => window.__shares)).length, 2);
  assert.ok(await backupTs(page), 'backed up once shared');

  const b = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
  await b.page.evaluate(stubShare, 'abort');
  await b.page.evaluate(() => openBackup());
  let downloaded = false; b.page.on('download', () => { downloaded = true; });
  await b.page.click('#backupDownload'); await idle(b.page);
  assert.equal((await b.page.evaluate(() => window.__shares)).length, 1);
  assert.equal(await backupTs(b.page), null, 'a cancelled share is not a backup');
  assert.equal(downloaded, false, 'and no download instead');
  assert.equal(await b.page.isVisible('#msToast.on'), false, 'and no message');
  assert.equal(await b.page.textContent('#backupDownload'), 'Back up', 'button back to normal');
  assert.deepEqual([...errors, ...b.errors], []);
});

test('the backup reminder appears for a markers-only collection that was never, or long ago, backed up', async () => {
  const now = Date.now();
  // never backed up, and the collection is 4 days old
  const a = await openApp({ storage: collection({ 'ms-first-use': String(now - 4 * DAY) }) });
  await a.page.waitForSelector('#backupNudge', { state: 'visible' });
  assert.match(await a.page.textContent('#backupNudge'), /Your 3 markers are only stored on this device/);
  // Later snoozes it, as before
  await a.page.click('#backupNudge [data-bk="later"]');
  assert.equal(await a.page.isVisible('#backupNudge'), false);

  // never backed up, but only a day old: not yet
  const b = await openApp({ storage: collection({ 'ms-first-use': String(now - 1 * DAY) }) });
  await idle(b.page);
  assert.equal(await b.page.isVisible('#backupNudge'), false);

  // backed up 20 days ago and the collection has changed since
  const c = await openApp({ storage: collection({ 'ms-first-use': String(now - 40 * DAY), 'ms-guides-backup-ts': String(now - 20 * DAY), 'ms-backup-sig': 'old' }) });
  await c.page.waitForSelector('#backupNudge', { state: 'visible' });
  assert.match(await c.page.textContent('#backupNudge'), /Your markers or palettes have changed since your last backup/);
  // unchanged since that backup: no reminder
  await c.page.evaluate(() => { localStorage.setItem('ms-backup-sig', dataSig()); renderBackupNudge(); });
  assert.equal(await c.page.isVisible('#backupNudge'), false);
  // a recent backup: no reminder even with changes
  await c.page.evaluate(() => { localStorage.setItem('ms-backup-sig', 'old'); localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 3 * 864e5)); renderBackupNudge(); });
  assert.equal(await c.page.isVisible('#backupNudge'), false);
  // "Back up now" makes the backup and the reminder goes
  await c.page.evaluate(() => { localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 20 * 864e5)); renderBackupNudge(); });
  const [dl] = await Promise.all([c.page.waitForEvent('download'), c.page.click('#backupNudge [data-bk="go"]')]);
  assert.ok(dl); await idle(c.page);
  assert.equal(await c.page.isVisible('#backupNudge'), false);
  assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = async (page) => { await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)); };
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);

test('Back up saves the last changes first', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  await tickN(page, 2);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => backupAll())]);
  const fs = await import('node:fs/promises');
  const d = JSON.parse(await fs.readFile(await dl.path(), 'utf8'));
  assert.equal(d.guides[0].payload.prog.length, 2);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const onboardedV263 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('backup from the Home reminder: Preparing on the button, a failure shown there with the right place to go', async () => {
  const now = Date.now();
  const { page, errors } = await openApp({ storage: onboardedV263({ [KEY]: appState(), 'ms-first-use': String(now - 5 * 864e5) }) });
  await page.waitForSelector('#backupNudge', { state: 'visible' });
  await page.evaluate(() => { window.__bk = []; const g = gatherGuides; window.gatherGuides = function () { window.__bk.push(document.getElementById('bkGo').textContent + '|' + document.getElementById('bkGo').disabled); return g(); }; URL.createObjectURL = () => { throw new Error('blocked'); }; });
  await page.click('#bkGo'); await page.waitForSelector('#backupNudge .mserr');
  assert.deepEqual(await page.evaluate(() => window.__bk), ['Preparing…|true']);
  const card = await page.textContent('#backupNudge .mserr');
  assert.match(card, /couldn’t be saved/);
  assert.match(card, /Markers › Back up & restore/, 'not "below"');
  assert.equal(await page.textContent('#bkGo'), 'Back up now');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run

test('Back up takes the open guide not yet in the Library, and a guide it couldn’t read still counts as not backed up', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickN(page, 2); await idle(page, AUTO);
  const gs = await page.evaluate(() => gatherGuides().then((a) => a.map((g) => ({ id: g.id, name: g.name, prog: (g.payload.prog || []).length }))));
  assert.equal(gs.length, 1);
  assert.equal(gs[0].name, await page.evaluate(() => __mstest.curName), 'named as it is');
  assert.equal(gs[0].prog, 2);
  // a Library guide whose stored guide can't be read is left out of the backup and stays "not backed up"
  await page.evaluate(() => sfSaveDesign({ name: 'Lost', W: 10, H: 10, keys: [], n: 0, payload: { lmap: 'x' } }).then((id) => IDB.del('guide-' + id)));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => backupAll('noSuchButton'))]);
  assert.ok(dl);
  assert.ok(await page.evaluate(() => guidesAtRisk()) >= 1, 'still at risk');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const shown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);

test('Home › Back up now: a toast says it was made, and focus moves to what takes the card’s place', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState(), 'ms-first-use': String(Date.now() - 6 * 864e5) }) });
  await page.waitForSelector('#bkGo');
  await page.focus('#bkGo');
  await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]); await idle(page);
  assert.equal(await shown(page, '#backupNudge'), false, 'the card is gone');
  assert.match(await toastText(page), /Backed up ✓/);
  const act = await page.evaluate(() => { const a = document.activeElement; return { tag: a.tagName, id: a.id, vis: !!a.getClientRects().length }; });
  assert.notEqual(act.tag, 'BODY');
  assert.ok(act.vis, JSON.stringify(act));
  assert.deepEqual(errors, []);
});

// found by the style check after v267: on a sideways phone at a large text size the dialog squashed its rows to fit,
// and the "as text" link that hides the text box again ended up 0px tall; the dialog scrolls instead
test('Back up & restore on a sideways phone at a large text size: the text box opens and every row keeps its height', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 844, height: 390, storage: collection() });
  await page.evaluate(() => openBackup());
  await idle(page);
  await page.click('#backupShow');
  await idle(page);
  // every row with something in it keeps at least a line's height (the link was squashed to 0px; it is 23px unsquashed)
  const rows = await page.$$eval('#backupOverlay .dcard > *', (els) =>
    els.filter((e) => getComputedStyle(e).display !== 'none' && e.type !== 'file' && e.textContent.trim()).map((e) => [e.id || e.className, e.getBoundingClientRect().height]),
  );
  assert.ok(rows.some(([name]) => name === 'backupShow'));
  for (const [name, h] of rows) assert.ok(h >= 20, `${name} is only ${h}px tall`);
  const card = await page.$eval('#backupOverlay .dcard', (c) => [c.scrollHeight, c.clientHeight]);
  assert.ok(card[0] > card[1], 'the dialog scrolls');
  // the link can be scrolled to and tapped: it hides the text box again
  await page.click('#backupShow');
  await idle(page);
  assert.equal(await page.$eval('#backupTextWrap', (w) => getComputedStyle(w).display), 'none');
  assert.deepEqual(errors, []);
});
