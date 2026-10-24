// Backups, restore, storage, two tabs, unreadable data, deleting data.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  answerAsks,
  askAnswer,
  asked,
  buildGo,
  haveSet,
  idle,
  letterGuide,
  libItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openBackupDialog,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from backup.test.mjs ----
// Making a backup: on a phone through the share sheet (a download when files can't be shared, a Share button when
// the tap has expired), a download on a computer; the backup reminder and Home's Back up now; and a backup takes the
// open guide's last changes.
{
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const KEY = 'ohuhu-hb320-picker-v3';
  const DAY = 864e5;
  // Safari in a tab says navigator.standalone === false; from the Home Screen it's true
  const safariTab = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
  };
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  // saved app state as the app writes it (the flags stop the one-off marker additions for older collections)
  const appStateOf = (owned) =>
    JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned, saved: [] });
  const collection = (extra = {}) =>
    onboarded({ [KEY]: appStateOf(['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08']), ...extra });
  const stubShare = (mode) => {
    window.__shares = [];
    navigator.canShare = (d) => mode !== 'cannot' && !!(d && d.files && d.files.length);
    navigator.share = (d) => {
      window.__shares.push(d.files[0].name);
      return d.files[0].text().then((t) => {
        window.__shareText = t;
        const first = window.__shares.length === 1;
        if (mode === 'notallowed' && first)
          throw new DOMException('Must be handling a user gesture', 'NotAllowedError');
        if (mode === 'abort') throw new DOMException('Share canceled', 'AbortError');
      });
    };
  };
  const backupTs = (page) => page.evaluate(() => localStorage.getItem('ms-guides-backup-ts'));
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  // ---- From the fourth review (outside the guide screen) ----
  const onboardedV263 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  // ---- From the fifth review (data safety) ----
  const AUTO = 2300;
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const shown = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    }, sel);
  test('backup on an iPhone goes to the share sheet, and counts as made once shared', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
    await page.evaluate(stubShare, 'ok');
    await page.evaluate(() => openBackup());
    await page.click('#backupDownload');
    await idle(page);
    const names = await page.evaluate(() => window.__shares);
    assert.equal(names.length, 1);
    assert.match(names[0], /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
    const d = JSON.parse(await page.evaluate(() => window.__shareText));
    assert.equal(d.type, 'ms-backup');
    assert.equal(d.owned.length, 3);
    assert.ok(await backupTs(page), 'marked as backed up');
    assert.match(await page.textContent('#backupDownload'), /Saved/);
    assert.deepEqual(errors, []);
  });
  test("backup falls back to a download when files can't be shared", async () => {
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
    await page.click('#toastAct');
    await idle(page);
    assert.equal((await page.evaluate(() => window.__shares)).length, 2);
    assert.ok(await backupTs(page), 'backed up once shared');

    const b = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
    await b.page.evaluate(stubShare, 'abort');
    await b.page.evaluate(() => openBackup());
    let downloaded = false;
    b.page.on('download', () => {
      downloaded = true;
    });
    await b.page.click('#backupDownload');
    await idle(b.page);
    assert.equal((await b.page.evaluate(() => window.__shares)).length, 1);
    assert.equal(await backupTs(b.page), null, 'a cancelled share is not a backup');
    assert.equal(downloaded, false, 'and no download instead');
    assert.equal(await b.page.isVisible('#msToast.on'), false, 'and no message');
    assert.equal(await b.page.textContent('#backupDownload'), 'Back up', 'button back to normal');
    assert.deepEqual([...errors, ...b.errors], []);
  });
  test('the backup reminder appears for a markers-only collection that was never, or long ago, backed up', async () => {
    const now = Date.now();
    // never backed up, and the collection is 15 days old (v289: the usual 14 days, from the first day too)
    const a = await openApp({ storage: collection({ 'ms-first-use': String(now - 15 * DAY) }) });
    await a.page.waitForSelector('#backupNudge', { state: 'visible' });
    assert.match(await a.page.textContent('#backupNudge'), /Your 3 markers are only stored on this device/);
    // Later snoozes it, as before
    await a.page.click('#backupNudge [data-bk="later"]');
    assert.equal(await a.page.isVisible('#backupNudge'), false);

    // never backed up, but only 10 days old: not yet
    const b = await openApp({ storage: collection({ 'ms-first-use': String(now - 10 * DAY) }) });
    await idle(b.page);
    assert.equal(await b.page.isVisible('#backupNudge'), false);

    // backed up 20 days ago and the collection has changed since
    const c = await openApp({
      storage: collection({
        'ms-first-use': String(now - 40 * DAY),
        'ms-guides-backup-ts': String(now - 20 * DAY),
        'ms-backup-sig': 'old',
      }),
    });
    await c.page.waitForSelector('#backupNudge', { state: 'visible' });
    assert.match(
      await c.page.textContent('#backupNudge'),
      /Your markers or palettes have changed since your last backup/,
    );
    // unchanged since that backup: no reminder
    await c.page.evaluate(() => {
      localStorage.setItem('ms-backup-sig', dataSig());
      renderBackupNudge();
    });
    assert.equal(await c.page.isVisible('#backupNudge'), false);
    // a recent backup: no reminder even with changes
    await c.page.evaluate(() => {
      localStorage.setItem('ms-backup-sig', 'old');
      localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 3 * 864e5));
      renderBackupNudge();
    });
    assert.equal(await c.page.isVisible('#backupNudge'), false);
    // "Back up now" makes the backup and the reminder goes
    await c.page.evaluate(() => {
      localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 20 * 864e5));
      renderBackupNudge();
    });
    const [dl] = await Promise.all([
      c.page.waitForEvent('download'),
      c.page.click('#backupNudge [data-bk="go"]'),
    ]);
    assert.ok(dl);
    await idle(c.page);
    assert.equal(await c.page.isVisible('#backupNudge'), false);
    assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
  });
  test('Back up saves the last changes first', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    await tickN(page, 2);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => backupAll())]);
    const fs = await import('node:fs/promises');
    const d = JSON.parse(await fs.readFile(await dl.path(), 'utf8'));
    assert.equal(d.guides[0].payload.prog.length, 2);
    assert.deepEqual(errors, []);
  });
  test('backup from the Home reminder: Preparing on the button, a failure shown there with the right place to go', async () => {
    const now = Date.now();
    const { page, errors } = await openApp({
      storage: onboardedV263({ [KEY]: appState(), 'ms-first-use': String(now - 15 * 864e5) }),
    });
    await page.waitForSelector('#backupNudge', { state: 'visible' });
    await page.evaluate(() => {
      window.__bk = [];
      const g = gatherGuides;
      window.gatherGuides = function () {
        window.__bk.push(
          document.getElementById('bkGo').textContent + '|' + document.getElementById('bkGo').disabled,
        );
        return g();
      };
      URL.createObjectURL = () => {
        throw new Error('blocked');
      };
    });
    await page.click('#bkGo');
    await page.waitForSelector('#backupNudge .mserr');
    assert.deepEqual(await page.evaluate(() => window.__bk), ['Preparing…|true']);
    const card = await page.textContent('#backupNudge .mserr');
    assert.match(card, /couldn’t be saved/);
    assert.match(card, /Library › Markers & palettes as text/, 'not "below" (v289: it lives in the Library)');
    assert.equal(await page.textContent('#bkGo'), 'Back up now');
    assert.deepEqual(errors, []);
  });
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run

  test('Back up takes the open guide not yet in the Library, and a guide it couldn’t read still counts as not backed up', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickN(page, 2);
    await idle(page, AUTO);
    const gs = await page.evaluate(() =>
      gatherGuides().then((a) =>
        a.map((g) => ({ id: g.id, name: g.name, prog: (g.payload.prog || []).length })),
      ),
    );
    assert.equal(gs.length, 1);
    assert.equal(gs[0].name, await page.evaluate(() => __mstest.curName), 'named as it is');
    assert.equal(gs[0].prog, 2);
    // a Library guide whose stored guide can't be read is left out of the backup and stays "not backed up"
    // (v318 review: one the database won't give back; one not stored at all is said apart, e2e/v318-data)
    await page.evaluate(() =>
      sfSaveDesign({ name: 'Lost', W: 10, H: 10, keys: [], n: 0, payload: { lmap: 'x' } }).then((id) => {
        const get = IDB.get;
        IDB.get = (k) =>
          k === 'guide-' + id ? Promise.reject(new DOMException('gone', 'UnknownError')) : get(k);
      }),
    );
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => backupAll('noSuchButton')),
    ]);
    assert.ok(dl);
    assert.ok((await page.evaluate(() => guidesAtRisk())) >= 1, 'still at risk');
    assert.deepEqual(errors, []);
  });
  test('Home › Back up now: a toast says it was made, and focus moves to what takes the card’s place', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState(), 'ms-first-use': String(Date.now() - 15 * 864e5) }),
    });
    await page.waitForSelector('#bkGo');
    await page.focus('#bkGo');
    await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    await idle(page);
    assert.equal(await shown(page, '#backupNudge'), false, 'the card is gone');
    assert.match(await toastText(page), /Backed up ✓/);
    const act = await page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a.tagName, id: a.id, vis: !!a.getClientRects().length };
    });
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
      els
        .filter((e) => getComputedStyle(e).display !== 'none' && e.type !== 'file' && e.textContent.trim())
        .map((e) => [e.id || e.className, e.getBoundingClientRect().height]),
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
}

// ---- from restore.test.mjs ----
// Restoring a backup (Home, the Library, the welcome, pasted text): markers, palettes and guides come back into a
// fresh install; older backup files still restore; palettes are merged and the only question is about markers;
// guides already here, unreadable ones and ones with no room are said; a newer guide is never overwritten; and a
// full storage or a backup with no markers changes nothing it shouldn't.
{
  const colourSome = async (page, n) => {
    const ls = await page.evaluate((n) => __mstest.assignData.order.slice(0, n), n);
    await scrollTop(page);
    for (const l of ls) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
    }
    return ls;
  };
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })),
    );
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              base: p.base || null,
              style: p.style,
            },
        ),
      id,
    );
  const doneN = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  // ---- From the fourth review (outside the guide screen) ----
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });
  // ---- From the fifth review’s leftovers ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const DAY = 864e5;
  const OWN4 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const appState4 = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN4,
      saved: [],
      ...extra,
    });
  // a tiny label map is enough for a guide to be restored
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const guide = (id, name) => ({
    id,
    name,
    W: 1,
    H: 1,
    keys: ['Ohuhu|R014'],
    n: 1,
    ts: Date.now() - DAY,
    payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } },
  });
  const unreadable = (id) => ({ id, name: 'Broken', W: 10, H: 10, payload: { lmap: 12345, assign: {} } });
  const file = (o) => ({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const guideCount = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length);
  const openLibrary = async (page) => {
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedOverlay.on');
  };
  async function restoreInLibrary(page, o) {
    await page.evaluate(() => {
      const t = document.getElementById('msToast');
      if (t) t.classList.remove('on');
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles(file(o));
    await page.waitForFunction(
      () => {
        const t = document.getElementById('msToast');
        return (t && t.classList.contains('on')) || document.querySelector('#savedOverlay .mserr');
      },
      null,
      { timeout: 10000 },
    );
  }
  // ---- From the fifth review (data safety) ----
  const guidesR5 = (page) =>
    page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })),
    );
  // ---- From the fifth review (outside the guide screen) ----
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  const fillStorage = (page) =>
    page.evaluate((KEY) => {
      const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === KEY) throw new DOMException('full', 'QuotaExceededError');
        return o.call(this, k, v);
      };
    }, KEY);
  const jsonFile = (o) => ({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const BACKUP = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - 864e5,
    owned: ['Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|R16'],
    wish: [],
    ink: {},
    saved: [pal(['Ohuhu|G36'], 99, 'From backup')],
    guides: [],
  };
  const storedState = (page) => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  // ---- From v265 ----
  const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const onePal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });
  const backupFile = (o) => ({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const onboardedV264 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v264',
    ...extra,
  });
  const palAt = (keys, id, name, ts) => ({
    id,
    type: 'palette',
    name: name || 'Pal ' + id,
    keys,
    ts: ts || id,
  });
  const backup = (owned, saved, extra = {}) =>
    Buffer.from(
      JSON.stringify({ v: 3, type: 'ms-backup', ts: Date.now() - 864e5, owned, saved, guides: [], ...extra }),
    );
  async function restore(page, buf) {
    if (!(await page.isVisible('#savedOverlay'))) {
      await page.click('#mHome');
      await page.click('#homeLibCard');
    }
    await page.setInputFiles('#guidesFile', { name: 'b.json', mimeType: 'application/json', buffer: buf });
    await idle(page);
  }
  const palettes = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type !== 'guide')
        .map((s) => s.id + ':' + s.name)
        .sort(),
    );
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
    await fc.setFiles(file);
    await idle(b.page);
    assert.equal(await b.page.isVisible('#welcome'), false);
    assert.deepEqual(await b.page.evaluate(() => [...state.owned].sort()), owned);
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  test('guides backup restores guides with their dates; a deleted guide comes back from it', async () => {
    const a = await openApp();
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await idle(a.page);
    await a.page.click('#mHome');
    await a.page.click('#homeLibCard');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
    const file = await dl.path();
    const ts = await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.ts));

    // one tap deletes (with Undo in a toast)
    await libItem(a.page, '#savedList', 'sdel');
    await idle(a.page);
    assert.equal(await a.page.locator('#savedList .srow').count(), 0);
    assert.equal(await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 0);

    const [fc] = await Promise.all([a.page.waitForEvent('filechooser'), a.page.click('#guidesRestore')]);
    await fc.setFiles(file);
    await idle(a.page, 1200);
    assert.deepEqual(
      await a.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.ts)),
      ts,
    );
    assert.deepEqual(a.errors, []);
  });
  test('restoring an older backup never overwrites a newer guide', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    await page.click('#mHome');
    await page.click('#homeLibCard');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const file = await dl.path();
    await page.keyboard.press('Escape');
    await page.click('#mSections');
    // (v308: and a change to its plan here: a guide only further along here is left as it is, with no copy, v308-restore)
    await page.click('.sftabbtn[data-t="pattern"]');
    const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
    await page.click(`#sfShape [data-v="${shape}"]`);
    await idle(page);
    await page.click('#sfColor');
    await colourSome(page, 3);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page); // it saves itself into its Library entry
    await page.click('#mHome');
    await page.click('#homeLibCard');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles(file);
    await idle(page, 1500);
    const guides = await page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => s.name),
    );
    assert.equal(guides.length, 2, 'the backup came back as a copy');
    assert.ok(guides.some((n) => /\(from backup\)$/.test(n)));
    const id = await page.evaluate(
      () => state.saved.find((s) => s.type === 'guide' && !/from backup/.test(s.name)).id,
    );
    const prog = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => (p.prog || []).length), id);
    assert.equal(prog, 3, 'the newer guide kept its progress');
    assert.deepEqual(errors, []);
  });
  // ---- From the UX polish pass ----
  test('one backup file restores markers, palettes and guides into a fresh install', async () => {
    const a = await openApp();
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await idle(a.page);
    await a.page.evaluate(() => {
      state.saved.push({
        id: 424242,
        type: 'palette',
        name: 'Test palette',
        keys: ['Ohuhu|R16', 'Ohuhu|B02'],
        ts: Date.now(),
      });
      save();
    });
    const want = await a.page.evaluate(() => ({
      owned: [...state.owned].sort(),
      pals: state.saved.filter((s) => s.type !== 'guide').map((s) => s.name),
      guides: state.saved.filter((s) => s.type === 'guide').map((s) => s.name),
    }));
    await a.page.click('#mHome');
    await a.page.click('#homeLibCard');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
    assert.match(dl.suggestedFilename(), /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
    const file = await dl.path(),
      d = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(d.type, 'ms-backup');
    assert.equal(d.guides.length, 1);
    assert.ok(d.owned.length > 50);

    const b = await openApp();
    await answerAsks(b.page);
    const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
    await fc.setFiles(file);
    await idle(b.page, 1500);
    const got = await b.page.evaluate(() => ({
      owned: [...state.owned].sort(),
      pals: state.saved.filter((s) => s.type !== 'guide').map((s) => s.name),
      guides: state.saved.filter((s) => s.type === 'guide').map((s) => s.name),
    }));
    assert.deepEqual(got, want);
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  test('older backup files still restore (guides-only and collection-only)', async () => {
    const a = await openApp();
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await idle(a.page);
    // build the two old formats from what's saved
    const old = await a.page.evaluate(async () => {
      const g = state.saved.find((s) => s.type === 'guide'),
        pl = await IDB.get('guide-' + g.id);
      return {
        guides: {
          v: 1,
          type: 'ms-guides',
          ts: Date.now(),
          guides: [{ id: g.id, name: g.name, W: g.W, H: g.H, keys: g.keys, n: g.n, ts: g.ts, payload: pl }],
        },
        coll: { v: 2, owned: ['Ohuhu|R16', 'Ohuhu|B02', 'Copic|E09'], saved: [] },
      };
    });
    const dir = await mkdtemp(join(tmpdir(), 'ms-')),
      gf = join(dir, 'guides.json'),
      cf = join(dir, 'coll.json');
    await writeFile(gf, JSON.stringify(old.guides));
    await writeFile(cf, JSON.stringify(old.coll));
    const b = await openApp();
    await answerAsks(b.page);
    await welcome(b.page, 'look');
    await b.page.click('#homeLibCard');
    let [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
    await fc.setFiles(gf);
    await idle(b.page, 1500);
    assert.equal(
      await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
      1,
      'guides-only backup restored',
    );
    [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
    await fc.setFiles(cf);
    await idle(b.page);
    assert.deepEqual(
      await b.page.evaluate(() => [...state.owned].sort()),
      ['Copic|E09', 'Ohuhu|B02', 'Ohuhu|R16'],
      'collection-only backup restored',
    );
    assert.equal(
      await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
      1,
      'and the guide is still there',
    );
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  // ---- From the second full review ----
  test('restoring someone else’s newer backup does not mark this device’s guides as backed up', async () => {
    const b = await openApp();
    await sampleGuide(b.page);
    await saveGuide(b.page);
    await idle(b.page);
    const a = await openApp();
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await idle(a.page);
    await a.page.click('#mHome');
    await a.page.click('#homeLibCard');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
    const file = await dl.path();
    await b.page.click('#mHome');
    await b.page.click('#homeLibCard');
    await answerAsks(b.page);
    const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
    await fc.setFiles(file);
    await idle(b.page, 1500);
    const r = await b.page.evaluate(() => ({
      risk: guidesAtRisk(),
      n: state.saved.filter((s) => s.type === 'guide').length,
    }));
    assert.equal(r.n, 2);
    assert.equal(r.risk, 1, 'this device’s own guide is still not in any backup');
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  test('restoring a backup that replaces the open guide reopens it as restored (not undone by the open copy); twice adds no copies', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page);
    await tickN(page, 3);
    await idle(page, AUTO);
    // a backup from elsewhere with more done and a later date
    const bk = await page.evaluate(() => gatherGuides());
    bk[0].payload.prog = bk[0].payload.prog.concat(
      Object.keys(bk[0].payload.assign).slice(20, 26).map(Number),
    );
    bk[0].ts = Date.now() + 5000;
    await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), bk);
    await idle(page, 1200);
    assert.equal(await doneN(page), 9, 'the open guide shows what was restored');
    await tickN(page, 0);
    await idle(page, AUTO);
    assert.equal((await stored(page, id)).prog, 9, 'and the Library keeps it');
    // a guide newer here: the backup's version is added once as "(from backup)", not again on a second restore
    await tickN(page, 1, 40);
    await idle(page, AUTO);
    // (v308: with a plan that differs, a marker changed: one only further along here gets no copy, v308-restore)
    const old = await page.evaluate((g) => {
      g[0].ts = 1;
      const a = g[0].payload.assign,
        k = Object.keys(a)[0];
      a[k] = a[k] === 'Ohuhu|R014' ? 'Ohuhu|B08' : 'Ohuhu|R014';
      return g;
    }, bk);
    await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), old);
    await idle(page);
    await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), old);
    await idle(page);
    assert.equal((await guides(page)).filter((g) => / \(from backup\)$/.test(g.name)).length, 1);
    assert.deepEqual(errors, []);
  });
  test('restore: no question on an empty device, plurals right, and no backup reminder straight after', async () => {
    const { page, errors } = await openApp({ storage: { 'ms-last-ver': 'v263' } });
    await page.click('#wcSkip');
    await page.click('#wcLook');
    await answerAsks(page, true);
    const file = JSON.stringify({
      v: 3,
      type: 'ms-backup',
      ts: Date.now() - 864e5,
      owned: ['Ohuhu|R014'],
      saved: [pal(['Ohuhu|R014'], 9, 'Nine')],
      guides: [],
    });
    await page.click('#homeLibCard');
    await page.setInputFiles('#guidesFile', {
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(file),
    });
    await idle(page);
    assert.deepEqual(await asked(page), [], 'nothing here to replace: no question');
    assert.equal(await page.evaluate(() => state.owned.size), 1);
    assert.match(await toastText(page), /Restored — 1 marker\./);
    await page.keyboard.press('Escape');
    await page.click('#mHome');
    await idle(page);
    assert.equal(await page.evaluate(() => backupDue()), null, 'no reminder for what was just restored');
    // with something here, the question uses the right words
    await page.evaluate(() => {
      state.owned.add('Ohuhu|Y111');
      save();
    });
    await page.click('#homeLibCard');
    await page.setInputFiles('#guidesFile', {
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(file),
    });
    await idle(page);
    const q = await asked(page);
    assert.equal(q.length, 1);
    // (v308: the question's new words; this file has no guides)
    assert.equal(
      q[0],
      'You have 2 markers; the backup has 1 (all of them yours too). Either way, the backup’s palettes are added.',
    );
    assert.deepEqual(errors, []);
  });
  test('restoring the same backup twice says the guides are already here, not "0 guides restored"; unreadable ones are said', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState4() }) });
    await openLibrary(page);
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: Date.now() - DAY,
      owned: OWN4,
      saved: [],
      guides: [guide(21, 'Owl'), guide(22, 'Cat')],
    };
    await restoreInLibrary(page, backup);
    assert.match(await toastText(page), /2 guides restored\./);
    assert.equal(await guideCount(page), 2);
    await restoreInLibrary(page, backup);
    const again = await toastText(page);
    assert.match(again, /2 guides were already here\./);
    assert.doesNotMatch(again, /\d+ guides? restored/, 'nothing counted as restored');
    assert.equal(await guideCount(page), 2, 'none added twice');
    assert.equal(
      await page.textContent('#backupCap'),
      again.replace(/\s+$/, ''),
      'the caption says the same',
    );
    // one here already, one new, one unreadable
    await restoreInLibrary(page, {
      v: 1,
      type: 'ms-guides',
      ts: Date.now(),
      guides: [guide(21, 'Owl'), guide(23, 'Fox'), unreadable(24)],
    });
    assert.equal(
      await toastText(page),
      '1 guide restored. 1 guide was already here; 1 guide couldn’t be read.',
    );
    assert.equal(await guideCount(page), 3);
    // the same through restoreAny's callback (the Welcome and Home's note)
    const r = await page.evaluate(
      (o) =>
        new Promise((res) =>
          restoreAny(new File([JSON.stringify(o)], 'b.json'), 'nope', (r, why) =>
            res({ r, why, left: r && guidesLeft(r), list: r && restoredList(r) }),
          ),
        ),
      backup,
    );
    assert.equal(r.r.guides, 0);
    assert.equal(r.r.dup, 2);
    assert.equal(r.left, '2 guides were already here.');
    assert.deepEqual(errors, []);
  });
  test('the Welcome says which guides it couldn’t read, and one with only guides already here isn’t called empty', async () => {
    const { page, errors } = await openApp();
    await page.waitForSelector('#welcome.on');
    await page.setInputFiles(
      '#wcFile',
      file({
        v: 3,
        type: 'ms-backup',
        ts: Date.now() - DAY,
        owned: OWN4,
        saved: [],
        guides: [guide(21, 'Owl'), unreadable(22)],
      }),
    );
    await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'));
    assert.equal(await toastText(page), 'Restored 4 markers and 1 guide. 1 guide couldn’t be read.');
    // the words Welcome and Home's note use when only guides already here came back
    assert.equal(
      await page
        .evaluate(() => {
          const r = { markers: 0, palettes: 0, guides: 0, dup: 1, bad: 0, full: 0 };
          return [restoredList(r), guidesLeft(r)];
        })
        .then((a) => a.join('|')),
      '|1 guide was already here.',
    );
    assert.deepEqual(errors, []);
  });
  test('a guide the storage has no room for is said as a failure, not counted as restored', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState4() }) });
    await openLibrary(page);
    await page.evaluate((KEY) => {
      const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === KEY) throw new DOMException('full', 'QuotaExceededError');
        return o.call(this, k, v);
      };
    }, KEY);
    await restoreInLibrary(page, {
      v: 1,
      type: 'ms-guides',
      ts: Date.now(),
      guides: [guide(21, 'Owl'), guide(22, 'Cat')],
    });
    const card = await page.textContent('#savedOverlay .mserr');
    assert.match(
      card,
      /2 guides couldn’t be saved — this browser’s storage is full\. Delete a few guides from the Library, then restore again\./,
    );
    assert.doesNotMatch(card, /restored\./);
    assert.equal(await toastText(page), '', 'no toast saying it worked');
    assert.equal(await guideCount(page), 0);
    assert.match(await page.textContent('#guidesRestore'), /Restore/, 'the button doesn’t say Restored');
    assert.deepEqual(errors, []);
  });
  test('restore skips unreadable guides and counts duplicates apart; a single guide file restored twice is added once', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const restore = (list) =>
      page.evaluate(
        (list) =>
          new Promise((r) =>
            restoreGuideList(list, 0, (ok, copies, info) =>
              r({ ok, copies, dup: info && info.dup, bad: info && info.bad }),
            ),
          ),
        list,
      );
    const bad = [
      { id: 11, name: 'numeric', W: 10, H: 10, payload: { lmap: 12345, assign: {} } },
      {
        id: 12,
        name: 'jpeg',
        W: 10,
        H: 10,
        payload: { lmap: 'data:image/jpeg;base64,AAAAAAAAAAAAAAAAAAAA', assign: {} },
      },
      {
        id: 13,
        name: 'broken',
        W: 10,
        H: 10,
        payload: { lmap: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA', assign: {} },
      },
    ];
    assert.deepEqual(await restore(bad), { ok: 0, copies: 0, dup: 0, bad: 3 });
    assert.equal((await guidesR5(page)).length, 1, 'none added');
    // a single guide file (no id) restored twice
    const one = await page.evaluate(() =>
      gatherGuides().then((a) => {
        const g = a[0];
        delete g.id;
        g.name = 'Shared guide';
        return [g];
      }),
    );
    assert.deepEqual(
      await restore(one),
      { ok: 0, copies: 0, dup: 1, bad: 0 },
      'the same as the guide already here',
    );
    // (deleted as the Library does it, so the open guide knows: v285 would otherwise put it in the Library again)
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      sfDeleteDesign(g.id);
      SF.libChanged(g.id, false);
    });
    assert.deepEqual(await restore(one), { ok: 1, copies: 0, dup: 0, bad: 0 });
    assert.deepEqual(await restore(one), { ok: 0, copies: 0, dup: 1, bad: 0 });
    assert.equal((await guidesR5(page)).length, 1);
    // a backup restored twice
    const all = await page.evaluate(() => gatherGuides());
    assert.deepEqual(await restore(all), { ok: 0, copies: 0, dup: 1, bad: 0 });
    assert.deepEqual(errors, []);
  });
  test('restore with storage full: the dialog, the Welcome and pasted text say it failed and change nothing', async () => {
    let { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await openBackupDialog(page);
    await fillStorage(page);
    await answerAsks(page, false);
    await page.setInputFiles('#backupFile', jsonFile(BACKUP));
    await idle(page);
    assert.match(await page.textContent('#backupOverlay .mserr'), /storage is full, so nothing was changed/);
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length, 'the markers are as they were');
    assert.equal(await page.evaluate(() => state.saved.length), 0, 'no palette added');
    assert.doesNotMatch(await toastText(page), /Restored/);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-backup-sig')),
      null,
      'not recorded as backed up',
    );
    // pasted text (the error card is put away first)
    await page.click('#backupOverlay .mserrx');
    if (!(await page.isVisible('#backupText'))) await page.click('#backupShow'); // (open already from the Library's line, v288)
    await page.fill('#backupText', JSON.stringify({ v: 2, owned: ['Ohuhu|B08'], saved: [] }));
    await answerAsks(page, true);
    await page.click('#backupRestore');
    await page.waitForFunction(() =>
      /Couldn’t restore — this browser’s storage is full/.test(
        document.getElementById('backupCap').textContent,
      ),
    );
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
    assert.ok(await page.isVisible('#backupOverlay'), 'the dialog stays open');
    assert.deepEqual(errors, []);
    // the Welcome
    ({ page, errors } = await openApp());
    await page.waitForSelector('#welcome.on');
    await fillStorage(page);
    await page.setInputFiles('#wcFile', jsonFile(BACKUP));
    await idle(page);
    assert.match(await page.textContent('#wcErr'), /storage is full/);
    assert.ok(await page.isVisible('#welcome'), 'the Welcome stays');
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.deepEqual(errors, []);
  });
  test('a backup with no markers leaves yours alone, asks nothing, and adds its palettes', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await answerAsks(page, true);
    await openBackupDialog(page);
    await page.setInputFiles('#backupFile', jsonFile({ ...BACKUP, owned: [] }));
    await idle(page);
    assert.deepEqual(await asked(page), [], 'no "Replace your 8 markers with the backup’s 0 markers?"');
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
    assert.equal((await storedState(page)).saved.length, 1, 'the palette is added and saved');
    assert.match(await page.textContent('#backupCap'), /Kept your markers; added 1 palette\./);
    assert.deepEqual(errors, []);
  });
  test('welcome › Restore a backup: the file picker opens in the same tap; cancel or a wrong file stays; success lands on Home', async () => {
    const { page, errors } = await openApp();
    assert.ok(await page.isVisible('#welcome'));
    // cancelled
    let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
    await fc.setFiles([]);
    await idle(page);
    assert.ok(await page.isVisible('#welcome'), 'cancel: still on the welcome');
    assert.equal(
      await page.evaluate(() => document.getElementById('backupOverlay').classList.contains('on')),
      false,
      'no Back up & restore dialog',
    );
    // not a backup: said in the welcome
    [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
    await fc.setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await idle(page);
    assert.ok(await page.isVisible('#welcome'));
    assert.match(await page.textContent('#welcome .mserr'), /isn’t a Marker Studio backup/);
    // an empty backup: nothing to restore, said there
    [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
    await fc.setFiles(
      backupFile({ v: 3, type: 'ms-backup', ts: Date.now(), owned: [], saved: [], guides: [] }),
    );
    await idle(page);
    assert.ok(await page.isVisible('#welcome'));
    assert.match(await page.textContent('#welcome .mserr'), /That backup is empty/);
    // a backup with markers, palettes and guides
    [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcRestore')]);
    await fc.setFiles(
      backupFile({
        v: 3,
        type: 'ms-backup',
        ts: Date.now() - DAY,
        owned: OWN3,
        saved: [onePal(11, 'A'), onePal(12, 'B')],
        guides: [guide(21, 'Owl'), guide(22, 'Cat')],
      }),
    );
    await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'));
    assert.equal(await toastText(page), 'Restored 3 markers, 2 palettes and 2 guides');
    assert.equal(await page.evaluate(() => state.mode), 'home');
    assert.ok(await page.isVisible('#homeView'));
    assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 2);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1', 'the welcome is done');
    await page.reload();
    await idle(page);
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
  test('restore: palettes are merged (local ones kept, new ones added, a shared id keeps the local one); no question with the same markers', async () => {
    const local = [palAt(['Ohuhu|R014'], 101, 'Local only'), palAt(['Ohuhu|Y111'], 202, 'Mine')];
    const { page, errors } = await openApp({ storage: onboardedV264({ [KEY]: appState({ saved: local }) }) });
    await answerAsks(page, true);
    await restore(
      page,
      backup(OWN, [
        palAt(['Ohuhu|B08', 'Ohuhu|G36'], 202, 'Theirs'),
        palAt(['Ohuhu|RV08'], 303, 'Backup only'),
      ]),
    );
    assert.deepEqual(await asked(page), [], 'same markers: nothing to ask');
    assert.deepEqual(await palettes(page), ['101:Local only', '202:Mine', '303:Backup only']);
    assert.deepEqual(
      await page.evaluate(() => state.saved.find((s) => s.id === 202).keys),
      ['Ohuhu|Y111'],
      'the local copy of a shared id is kept as it was',
    );
    // (v308: the same markers aren't "restored")
    assert.match(await toastText(page), /Your markers already match the backup; added 1 palette\./);
    // kept after a reload
    await page.reload();
    await idle(page);
    assert.deepEqual(await palettes(page), ['101:Local only', '202:Mine', '303:Backup only']);
    // not everything here is in that file (the local palettes), so it doesn't count as backed up
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-backup-sig')), null);
    assert.deepEqual(errors, []);
  });
  test('restore: the question is only about markers, with the right plurals; Cancel keeps them but still adds palettes', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV264({ [KEY]: appState({ saved: [palAt(['Ohuhu|R014'], 101, 'Local only')] }) }),
    });
    await answerAsks(page, false);
    await restore(
      page,
      backup(['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09'], [palAt(['Ohuhu|B08'], 404, 'From file')], {
        wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
      }),
    );
    // (v308: the question's new words; these files have no guides)
    assert.deepEqual(await asked(page), [
      'You have 8 markers; the backup has 3 (2 of them yours too). Either way, the backup’s palettes are added.',
    ]);
    assert.equal(await page.evaluate(() => state.owned.size), 8, 'Cancel keeps the markers');
    assert.deepEqual(
      await page.evaluate(() => state.wish.map((w) => w.k)),
      ['Ohuhu|G43'],
      'the backup’s To buy merges in (v305)',
    );
    assert.deepEqual(
      await palettes(page),
      ['101:Local only', '404:From file'],
      'the palettes are added anyway',
    );
    assert.match(await toastText(page), /Kept your markers; added 1 to buy and 1 palette\./);
    // OK: the backup's markers (and its To buy list); the local palette is still there
    await askAnswer(page, true);
    await restore(
      page,
      backup(['Ohuhu|R014'], [palAt(['Ohuhu|B08'], 404, 'From file')], {
        wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
      }),
    );
    assert.equal(
      (await asked(page))[1],
      'You have 8 markers; the backup has 1 (all of them yours too). Either way, the backup’s palettes are added.',
    );
    assert.deepEqual(await page.evaluate(() => [...state.owned]), ['Ohuhu|R014']);
    assert.deepEqual(await page.evaluate(() => state.wish.map((w) => w.k)), ['Ohuhu|G43']);
    assert.deepEqual(await palettes(page), ['101:Local only', '404:From file']);
    // one marker here now: singular
    await restore(page, backup(['Ohuhu|R014', 'Ohuhu|B08'], []));
    assert.equal(
      (await asked(page))[2],
      'You have 1 marker; the backup has 2 (1 of them yours too). Either way, the backup’s palettes are added.',
    );
    assert.deepEqual(
      await palettes(page),
      ['101:Local only', '404:From file'],
      'a backup without palettes removes none',
    );
    // pasted text (Markers › Back up & restore) merges the same way
    await page.keyboard.press('Escape');
    await page.evaluate(
      (t) => {
        document.getElementById('backupText').value = t;
        document.getElementById('backupRestore').click();
      },
      JSON.stringify({
        v: 2,
        owned: ['Ohuhu|R014', 'Ohuhu|B08'],
        saved: [palAt(['Ohuhu|G36'], 505, 'Pasted')],
      }),
    );
    await idle(page);
    assert.equal((await asked(page)).length, 3, 'same markers: no question');
    assert.deepEqual(await palettes(page), ['101:Local only', '404:From file', '505:Pasted']);
    assert.deepEqual(errors, []);
  });
  test('restore: no question on a device without markers (even with palettes); a file holding everything counts as backed up', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV264({ [KEY]: appState({ owned: [], saved: [palAt(['Ohuhu|R014'], 101, 'Kept')] }) }),
    });
    await answerAsks(page, true);
    await restore(
      page,
      backup(
        ['Ohuhu|R014', 'Ohuhu|B08'],
        [palAt(['Ohuhu|R014'], 101, 'Kept'), palAt(['Ohuhu|B08'], 606, 'New')],
      ),
    );
    assert.deepEqual(await asked(page), []);
    assert.equal(await page.evaluate(() => state.owned.size), 2);
    assert.deepEqual(await palettes(page), ['101:Kept', '606:New']);
    // everything here is in the file: marked as restored, no reminder, and the reminder's fingerprint matches
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-backup-sig') === dataSig()), true);
    assert.ok(+(await page.evaluate(() => localStorage.getItem('ms-guides-backup-ts'))) > 0);
    assert.equal(await page.evaluate(() => backupDue()), null);
    // a palette made afterwards is a change since that backup
    await page.evaluate(() => {
      state.saved.push({ id: 707, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 707 });
      save();
    });
    assert.notEqual(
      await page.evaluate(() => localStorage.getItem('ms-backup-sig')),
      await page.evaluate(() => dataSig()),
    );
    assert.deepEqual(errors, []);
  });
  // v289
  test('restore: Cancel on Replace your markers (and Escape) restores nothing; a newer copy of the open guide says it replaced it', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV264({ [KEY]: appState({ saved: [palAt(['Ohuhu|R014'], 101, 'Local only')] }) }),
    });
    const before = await page.evaluate(() => [[...state.owned].length, state.saved.length]);
    for (const how of ['cancel', 'escape']) {
      await restore(
        page,
        backup(['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09'], [palAt(['Ohuhu|B08'], 404, 'From file')]),
      );
      await page.waitForSelector('#sfEdAsk [data-a="stay"]');
      if (how === 'cancel') await page.click('#sfEdAsk [data-a="stay"]');
      else await page.keyboard.press('Escape');
      await idle(page);
      assert.deepEqual(
        await page.evaluate(() => [[...state.owned].length, state.saved.length]),
        before,
        how + ': nothing restored',
      );
      assert.equal(await toastText(page), 'Nothing restored.');
    }
    assert.deepEqual(errors, []);
  });
  test('restore: when the backup’s copy of the open guide is newer, the summary says the open guide was replaced', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const g = await page.evaluate(async () => {
      const s = state.saved.find((x) => x.type === 'guide'),
        p = await IDB.get('guide-' + s.id);
      return { id: s.id, name: s.name, W: s.W, H: s.H, keys: s.keys, n: s.n, payload: p };
    });
    const pl = JSON.parse(JSON.stringify(g.payload));
    pl.name = (pl.name || '') + ' ';
    const buf = Buffer.from(
      JSON.stringify({
        v: 3,
        type: 'ms-backup',
        ts: Date.now() + 60000,
        owned: await page.evaluate(() => [...state.owned]),
        saved: [],
        guides: [{ ...g, payload: pl, ts: Date.now() + 60000 }],
      }),
    );
    await page.evaluate(() => openLibrary());
    await page.setInputFiles('#guidesFile', { name: 'b.json', mimeType: 'application/json', buffer: buf });
    await idle(page);
    await page.waitForFunction(() => /restored/.test(document.getElementById('msToast').textContent));
    // (v308 merge: the backup's markers match yours, so they are said to be as they were)
    assert.match(
      await toastText(page),
      new RegExp(
        '1 guide restored\\. Your markers are as they were\\. “' +
          g.name +
          '” was replaced by the backup’s newer copy\\.',
      ),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from storage-full.test.mjs ----
// Storage that is full or blocked: Save, ticking a marker, changing the collection, Use in a guide and renaming say so,
// keep nothing and offer no Undo; blocked storage shows one clear banner.
{
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  // the next writes of the app's state fail as if the storage were full
  const fillStorage = (page) =>
    page.evaluate((KEY) => {
      const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === KEY) throw new DOMException('full', 'QuotaExceededError');
        return o.call(this, k, v);
      };
    }, KEY);
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });
  test('when storage is full, a new guide’s first save says so, Save tries again and says so too, and the guide stays unsaved', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => {
      IDB.put = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
    });
    // (v285: a change to the sample is its first save)
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal(await page.textContent('#sfSaveSt'), 'Not saved — storage is full');
    await page.click('#sfSave');
    await page.waitForFunction(() => /Couldn.t save/.test(document.getElementById('sfSave').textContent));
    assert.equal(
      await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
      0,
      'nothing half-saved in the Library',
    );
    assert.equal(await page.evaluate(() => __mstest.guideDirty), true, 'still marked unsaved');
    assert.deepEqual(errors, []);
  });
  test('when the settings storage is full, changing the collection warns once', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      window.__origSet = orig;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'ohuhu-hb320-picker-v3') throw new DOMException('full', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    });
    const r = await page.evaluate(() => {
      state.owned.add('Copic|B26');
      const ok = save();
      return ok;
    });
    assert.equal(r, false);
    await idle(page);
    assert.match(await page.textContent('#msToast'), /storage is full/);
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__origSet;
    });
    assert.equal(await page.evaluate(() => save()), true, 'saves again once there is room');
    assert.deepEqual(errors, []);
  });
  test('storage full: Save and ticking a marker say so, keep nothing and offer no Undo', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await fillStorage(page);
    await page.click('#saveBtn');
    await idle(page);
    assert.notEqual(await page.textContent('#saveBtn'), 'Saved ✓');
    assert.equal(await page.evaluate(() => state.saved.length), 0, 'not listed in the Library');
    assert.match(await toastText(page), /storage is full/);
    // ticking a marker: the full-storage message, not "Removed … Undo"
    await page.click('#mCollection');
    await idle(page);
    const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
    await page.click(`#results .cell[data-i="${i}"]`);
    await page.waitForSelector('#msToast.on');
    assert.match(await toastText(page), /storage is full/);
    assert.equal(await page.evaluate(() => !!document.getElementById('toastAct')), false, 'no Undo');
    assert.equal(await page.evaluate((i) => isOwned(i), i), true, 'still owned');
    // (v305: the Owned view has no tick badges, every marker in it being yours; the cell is still shown as owned)
    assert.equal(
      await page.evaluate((i) => document.querySelector(`#results .cell.own[data-i="${i}"]`) != null, i),
      true,
      'and still shown as owned',
    );
    // Own all / Clear / the shopping list / ink leave things as they were too
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    await page.click('#ownAll');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 8);
    await page.evaluate(() => openMarkerSheet(COLORS.findIndex((c, j) => isOwned(j))));
    await page.waitForSelector('#mkOverlay.on');
    await page.click('#mkInk button[data-ink="dry"]');
    await idle(page);
    assert.equal(await page.evaluate(() => Object.keys(state.ink).length), 0);
    assert.match(await toastText(page), /storage is full/);
    assert.deepEqual(errors, []);
  });
  test('blocked storage: one clear banner, the welcome still shows, no storage-full toasts', async () => {
    const block = () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    };
    const { page, errors } = await openApp({ init: block });
    await page.waitForSelector('#welcome.on');
    assert.match(
      await page.textContent('.msblocked'),
      /isn’t letting Marker Studio save — nothing will be kept/,
    );
    await page.click('#wcSkip');
    await page.click('#wcLook');
    for (const m of ['#mCollection', '#mPalette', '#mHome']) {
      await page.click(m);
      await idle(page);
      assert.doesNotMatch(await toastText(page), /storage is full/);
    }
    assert.ok(await page.isVisible('.msblocked'), 'the banner stays on every screen');
    // changes still work for this visit
    await page.click('#mCollection');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    await page.click('#results .cell');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 1);
    assert.deepEqual(errors, []);
  });
  test('Use in a guide and a Library rename with storage full: nothing changes and the message stays', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({
        [KEY]: appState({ saved: [pal(['Ohuhu|R014', 'Ohuhu|B08'], 5, 'Old name')] }),
      }),
    });
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await fillStorage(page);
    // (v308: Use in a guide saves nothing to the Library, so storage being full doesn't stop it)
    await page.click('#useInGuide');
    await idle(page);
    assert.equal(await page.evaluate(() => state.mode), 'sections', 'on to the Guide screen');
    assert.equal(await page.evaluate(() => state.saved.length), 1, 'nothing added to the Library');
    await page.click('#mPalette');
    await idle(page);
    // rename
    await page.click('#libMore');
    await page.click('#savedBtn');
    await libItem(page, '#savedList .srow[data-id="5"]', 'sren');
    await page.fill('#savedList .sname-in', 'New name');
    await page.press('#savedList .sname-in', 'Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved[0].name), 'Old name', 'the old name is back');
    assert.equal(await page.textContent('#savedList .srow[data-id="5"] .sname'), 'Old name');
    assert.match(await toastText(page), /storage is full/);
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (data safety) ----
  test('with storage blocked, the guide’s header says to keep it as a guide file', async () => {
    const { page, errors } = await openApp({
      init: () => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('blocked', 'SecurityError');
          },
        });
      },
    });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal(await page.textContent('#sfSaveSt'), 'Not saved — use Share & print › Guide file');
    assert.match(await page.evaluate(() => document.body.innerText), /isn’t letting Marker Studio save/);
    assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /storage may be full/);
    assert.deepEqual(errors, []);
  });
}

// ---- from two-tabs.test.mjs ----
// Two tabs sharing storage: palettes, deleted guides, the same Library guide, and the Resume slot.
{
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  // ---- From the fifth review (data safety) ----
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const guides = (page) =>
    page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })),
    );
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              progL: p.prog || [],
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              photo: (p.style && p.style.photo) || null,
              out: p.out || null,
              secStates: p.secStates || {},
              lmap: p.lmap,
            },
        ),
      id,
    );
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t ? t.textContent : '';
    });
  test('two tabs: a palette saved in one is kept when the other changes screen, and a delete there reaches this one', async () => {
    const a = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    const b = { page: await a.ctx.newPage(), errors: [] };
    b.page.on('pageerror', (e) => b.errors.push(e.message));
    await b.page.goto(a.page.url());
    await idle(b.page);
    // A saves a palette
    await a.page.click('#mPalette');
    await a.page.click('#draw');
    await idle(a.page);
    await a.page.click('#saveBtn');
    await a.page.waitForFunction(() => state.saved.length > 0);
    const id = await a.page.evaluate(() => state.saved[0].id);
    // B hears about it, and changing screen there keeps it
    await b.page.waitForFunction((id) => state.saved.some((s) => s.id === id), id, { timeout: 3000 });
    await b.page.click('#mCollection');
    await idle(b.page);
    assert.ok(
      await b.page.evaluate(
        ([KEY, id]) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === id),
        [KEY, id],
      ),
      'still in the stored Library',
    );
    // the safety net: a write B never heard about (no storage event) survives B's next save
    await b.page.evaluate((KEY) => {
      const v = JSON.parse(localStorage.getItem(KEY));
      v.saved.push({ id: 42, type: 'palette', name: 'Quiet', keys: ['Ohuhu|R014'], ts: 42 });
      localStorage.setItem(KEY, JSON.stringify(v));
    }, KEY);
    await b.page.click('#mPalette');
    await idle(b.page);
    assert.ok(
      await b.page.evaluate(
        (KEY) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === 42),
        KEY,
      ),
      'merged by id, not written over',
    );
    // a delete in A reaches B's open Library
    await b.page.click('#libMore');
    await b.page.click('#savedBtn');
    await idle(b.page);
    await a.page.click('#libMore');
    await a.page.click('#savedBtn');
    await libItem(a.page, `#savedList .srow[data-id="${id}"]`, 'sdel');
    await idle(a.page);
    await b.page.waitForFunction((id) => !document.querySelector(`#savedList .srow[data-id="${id}"]`), id, {
      timeout: 3000,
    });
    await b.page.keyboard.press('Escape');
    await b.page.click('#mCollection');
    await idle(b.page);
    assert.equal(
      await b.page.evaluate(
        ([KEY, id]) => JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === id),
        [KEY, id],
      ),
      false,
      'not written back',
    );
    assert.equal(
      await b.page.evaluate((id) => state.saved.some((s) => s.id === id), id),
      false,
      'B did not bring it back',
    );
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  test('two tabs: a guide deleted in one tab stops the other saving into it', async () => {
    const a = await openApp();
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await idle(a.page);
    const id = await a.page.evaluate(() => __mstest.curId);
    const b = await a.ctx.newPage();
    const errs = [];
    b.on('pageerror', (e) => errs.push(e.message));
    await b.goto(a.page.url());
    await idle(b);
    await b.evaluate(() => {
      savedOverlay.classList.add('on');
      renderSaved();
    });
    await libItem(b, `#savedList .srow[data-id="${id}"]`, 'sdel');
    await idle(b);
    await a.page.waitForFunction(
      () => /Removed from your Library/.test(document.getElementById('sfSaveSt').textContent),
      null,
      { timeout: 3000 },
    );
    assert.equal(await a.page.evaluate((id) => state.saved.some((s) => s.id === id), id), false);
    // a third tab starting during the Undo time leaves the guide's picture alone, so Undo still brings it all back
    const c = await a.ctx.newPage();
    await c.goto(a.page.url());
    await idle(c, 2000); // until its start-up tidy (1.5 s in) has run
    await b.click('#toastAct');
    await idle(b);
    assert.ok(
      await b.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), id),
      'the stored guide is still there',
    );
    await a.page.waitForFunction(
      () =>
        /Saved in your Library|Saves itself from now on/.test(
          document.getElementById('sfSaveSt').textContent,
        ),
      null,
      { timeout: 3000 },
    );
    assert.deepEqual([...a.errors, ...errs], []);
  });
  test('two tabs with the same Library guide: neither loses the other’s ticks (shown there, merged when both changed)', async () => {
    const { ctx, page: a, errors } = await openApp();
    await sampleGuide(a);
    await saveGuide(a);
    await idle(a);
    const id = await savedId(a);
    const b = await ctx.newPage();
    b.on('pageerror', (e) => errors.push(e.message));
    await b.goto(a.url());
    await idle(b);
    await openSaved(b, id);
    await tickN(a, 5);
    await idle(a, AUTO);
    await b.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 5, null, { timeout: 5000 });
    await tickN(b, 3, 10);
    await idle(b, AUTO);
    assert.equal((await stored(a, id)).prog, 8);
    await a.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 8, null, { timeout: 5000 });
    await tickN(a, 1, 20);
    await idle(a, AUTO);
    assert.equal((await stored(a, id)).prog, 9, 'A’s tick joins B’s');
    // both change at once: B has a change still to save when A saves
    await b.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 9, null, { timeout: 5000 });
    await tickN(b, 2, 30);
    await tickN(a, 1, 40);
    await a.evaluate(() => __mstest.flushSave());
    await idle(b, AUTO + 500);
    assert.equal((await stored(a, id)).prog, 12, 'merged: the union of both tabs’ ticks');
    assert.match(await toastText(b), /also changed in another tab/);
    await a.waitForFunction(() => __mstest.colored.reduce((x, y) => x + y, 0) === 12, null, {
      timeout: 5000,
    });
    assert.deepEqual(errors, []);
  });
  test('two tabs each colouring a new guide: each goes into the Library once, and each saves into its own', async () => {
    const { ctx, page: a, errors } = await openApp();
    await sampleGuide(a);
    await tickN(a, 3);
    await idle(a, AUTO);
    const b = await ctx.newPage();
    b.on('pageerror', (e) => errors.push(e.message));
    await b.goto(a.url());
    await idle(b);
    await b.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await b.waitForFunction(() => __mstest.assignData);
    await tickN(b, 2, 10);
    await idle(b, AUTO);
    await tickN(a, 1, 20);
    await idle(a, AUTO);
    const ia = await a.evaluate(() => __mstest.curId),
      ib = await b.evaluate(() => __mstest.curId);
    assert.ok(ia && ib && ia !== ib, 'each in an entry of its own');
    assert.equal((await stored(a, ia)).prog, 4);
    assert.equal((await stored(a, ib)).prog, 2);
    await tickN(b, 1, 30);
    await idle(b, AUTO);
    assert.equal((await guides(b)).length, 2, 'two in the Library, none twice');
    assert.equal((await stored(b, ib)).prog, 3);
    assert.equal(
      await a.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'nothing left in the Resume slot',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from unreadable-data.test.mjs ----
// Saved data the app can't read: one bad field costs only that field, out-of-range or unknown markers don't half-start
// the app, the unreadable text is copied and not written over, and Home's note says what was lost (only for real
// losses) and hands over the original.
{
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const shown = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    }, sel);
  const file = (o) => ({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const BACKUP = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - 864e5,
    owned: ['Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|R16'],
    wish: [],
    ink: {},
    saved: [pal(['Ohuhu|G36'], 99, 'From backup')],
    guides: [],
  };
  const stored = (page) => page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
  // ---- From v265 ----
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState3 = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN3,
      saved: [],
      ...extra,
    });
  const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  const shownId = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  const onePal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });
  // the note says what was lost (review 5): one wording per case below
  const KEPT = ' A copy of the original was kept.';
  test('an out-of-range marker in saved state doesn’t half-start the app', async () => {
    for (const bad of [
      { mode: 'palette', palettes: [[5000, 1]], drawn: [9999, 2], customPal: [7000, 3] },
      { mode: 'palette', palettes: 'abc' },
      { mode: 'random', drawn: ['x', -1] },
    ]) {
      const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState(bad) }) });
      await idle(page);
      assert.deepEqual(errors, [], JSON.stringify(bad));
      const st = await page.evaluate(() => ({ p: state.palettes, d: state.drawn, c: state.customPal }));
      assert.ok(
        st.p.every((p) => p.every((i) => i < 1000)) &&
          st.d.every((i) => Number.isInteger(i) && i >= 0 && i < 1000),
        'bad markers dropped',
      );
      // Match and Help still work (start-up ran to the end)
      await page.click('#mCollection');
      await page.click('#mkMatchBtn');
      await page.waitForSelector('#matchOverlay.on');
      await page.keyboard.press('Escape');
      await idle(page);
      assert.equal(await page.isVisible('#matchOverlay'), false, 'Escape closes Match');
      await page.click('#mHome');
      await page.click('#homeHelp');
      await page.waitForSelector('#helpOverlay.on');
    }
  });
  test('one bad field costs only that field; unreadable state is copied and not written over until you act', async () => {
    let { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ excluded: 5, saved: [pal(['Ohuhu|R014'], 7)] }) }),
    });
    assert.equal(await page.evaluate(() => state.owned.size), 8, 'excluded:5 keeps the collection');
    assert.equal(await page.evaluate(() => state.saved.length), 1, 'and the Library');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-state-backup')),
      null,
      'a repaired setting is not a loss: no copy (review 5)',
    );
    assert.deepEqual(errors, []);
    ({ page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ owned: 'abc' }) }) }));
    assert.equal(
      await page.evaluate(() => state.owned.size),
      0,
      'a broken collection is not replaced by 451 defaults',
    );
    ({ page, errors } = await openApp({ storage: onboarded({ [KEY]: '{"owned":["Ohuhu|R014"],' }) }));
    await idle(page);
    assert.equal(
      await page.evaluate((KEY) => localStorage.getItem(KEY), KEY),
      '{"owned":["Ohuhu|R014"],',
      'untouched after opening',
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-state-backup')),
      '{"owned":["Ohuhu|R014"],',
    );
    await page.evaluate(() => save());
    assert.equal(
      await page.evaluate((KEY) => localStorage.getItem(KEY), KEY),
      '{"owned":["Ohuhu|R014"],',
      'a save before any tap waits',
    );
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate(() => save());
    assert.notEqual(
      await page.evaluate((KEY) => localStorage.getItem(KEY), KEY),
      '{"owned":["Ohuhu|R014"],',
      'after a tap, saving works',
    );
    assert.deepEqual(errors, []);
  });
  test('unreadable data: the note says what was lost; everything lost offers Restore; the copy goes with the note', async () => {
    // two palettes lost: said with the count, and OK deletes the copy
    let { page, errors } = await openApp({
      storage: onboardedV265({
        [KEY]: appState({
          saved: [pal(['Ohuhu|R014'], 7), { id: -1, type: 'palette' }, { id: 'x', type: 'palette' }],
        }),
      }),
    });
    await idle(page);
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      '2 palettes couldn’t be read and were left out. A copy of the original was kept.',
    );
    assert.equal(await shown(page, '#lnRestore'), false, 'no Restore when only some palettes went');
    assert.ok(await page.evaluate(() => !!localStorage.getItem('ms-state-backup')));
    await page.click('#lnOk');
    await idle(page);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-state-backup')),
      null,
      'dismissed: the copy is deleted',
    );
    assert.deepEqual(errors, []);
    // Save a copy: the copy goes too
    ({ page, errors } = await openApp({
      storage: onboardedV265({
        [KEY]: appState({ owned: [...OWN, 5], saved: [{ id: 'x', type: 'guide' }] }),
      }),
    }));
    await idle(page);
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      '1 marker and 1 guide couldn’t be read and were left out. A copy of the original was kept.',
    );
    await Promise.all([page.waitForEvent('download'), page.click('#lnSave')]);
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
    // a copy left behind by an older version, with no note waiting, is tidied away
    ({ page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState(), 'ms-state-backup': '{"old":1}' }),
    }));
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
    // everything lost: said so, with Restore a backup
    ({ page, errors } = await openApp({ storage: onboardedV265({ [KEY]: '{"owned":["Ohuhu|R014"],' }) }));
    await idle(page);
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      'Your saved markers and Library couldn’t be read and were left out. A copy of the original was kept. If you have a backup file, restore it.',
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#lnRestore')]);
    await fc.setFiles(file(BACKUP));
    await idle(page);
    assert.equal(await shown(page, '#loadNote'), false, 'restored: the note goes');
    assert.match(await toastText(page), /Restored 3 markers and 1 palette/);
    assert.equal((await stored(page)).owned.length, 3, 'and it is saved');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-state-backup')), null);
    assert.deepEqual(errors, []);
  });
  test('marker keys the app does not know are not counted: Home and the grid agree', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ owned: ['Ohuhu|R014', 'Ohuhu|GONE1', 'Copic|NOPE'] }) }),
    });
    assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '1 marker');
    await page.click('#mCollection');
    await page.waitForSelector('#results .cell');
    assert.equal(await page.locator('#results .cell').count(), 1);
    assert.deepEqual((await stored(page)).owned, ['Ohuhu|R014'], 'dropped from the saved state too');
    assert.deepEqual(errors, []);
  });
  test('unreadable data: a note only for real losses; OK puts it away for good', async () => {
    // settings put back to their defaults: repaired quietly
    let { page, errors } = await openApp({
      storage: onboardedNoVer({ [KEY]: appState3({ excluded: 5, palSize: 'big', tones: 3 }) }),
    });
    await idle(page);
    assert.equal(await shownId(page, 'loadNote'), false, 'no note for small repairs');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-load-note')), null);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-state-backup')),
      null,
      'no copy for a repair (review 5)',
    );
    assert.deepEqual(errors, []);
    // a marker, a palette, a whole collection
    for (const [bad, said] of [
      [{ owned: [...OWN3, 42] }, '1 marker couldn’t be read and was left out.' + KEPT],
      [
        { saved: [onePal(7, 'P'), { id: -1, type: 'palette' }] },
        '1 palette couldn’t be read and was left out.' + KEPT,
      ],
      [
        { owned: 'abc' },
        'Your saved markers couldn’t be read and were left out.' +
          KEPT +
          ' If you have a backup file, restore it.',
      ],
    ]) {
      ({ page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: appState3(bad) }) }));
      await idle(page);
      assert.ok(await shownId(page, 'loadNote'), JSON.stringify(bad));
      assert.equal((await page.textContent('#loadNote .ntxt')).trim(), said);
      assert.deepEqual(errors, []);
    }
    // OK: gone, and not back after a reload
    await page.click('#lnOk');
    await page.waitForSelector('#loadNote', { state: 'hidden' });
    assert.equal(await shownId(page, 'loadNote'), false);
    await page.reload();
    await idle(page);
    assert.equal(await shownId(page, 'loadNote'), false, 'dismissed for good');
    assert.deepEqual(errors, []);
  });
  test('unreadable data: Save a copy hands over the original text (download on a computer, share sheet on a phone)', async () => {
    const RAW = '{"owned":["Ohuhu|R014"],';
    const { page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: RAW }) });
    await idle(page);
    assert.ok(await shownId(page, 'loadNote'), 'the whole state unreadable');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#lnSave')]);
    assert.match(
      dl.suggestedFilename(),
      /^marker-studio-original-\d{4}-\d\d-\d\d\.txt$/,
      'not JSON any more: a text file',
    );
    assert.equal(await readFile(await dl.path(), 'utf8'), RAW, 'exactly as it was');
    await idle(page);
    assert.equal(await shownId(page, 'loadNote'), false, 'saved: the note goes');
    await page.reload();
    await idle(page);
    assert.equal(await shownId(page, 'loadNote'), false, 'for good');

    // on an iPhone the share sheet; cancelling it keeps the note
    const bad = appState3({ owned: [...OWN3, null] });
    const b = await openApp({ userAgent: IPHONE, storage: onboardedNoVer({ [KEY]: bad }) });
    await b.page.evaluate(() => {
      window.__shares = [];
      window.__abort = true;
      navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = (d) => {
        const f = d.files[0];
        window.__shares.push(f.name);
        return f.text().then((t) => {
          window.__shareText = t;
          if (window.__abort) throw new DOMException('cancelled', 'AbortError');
        });
      };
    });
    await b.page.click('#lnSave');
    await idle(b.page);
    assert.equal(await shownId(b.page, 'loadNote'), true, 'share sheet closed: the note stays');
    await b.page.evaluate(() => {
      window.__abort = false;
    });
    await b.page.click('#lnSave');
    await b.page.waitForSelector('#loadNote', { state: 'hidden' });
    const names = await b.page.evaluate(() => window.__shares);
    assert.equal(names.length, 2);
    assert.match(names[1], /^marker-studio-original-\d{4}-\d\d-\d\d\.json$/);
    assert.equal(await b.page.evaluate(() => window.__shareText), bad);
    assert.equal(await shownId(b.page, 'loadNote'), false);
    assert.deepEqual([...errors, ...b.errors], []);
  });
}

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              n: Object.keys(p.assign || {}).length,
              shape: p.style && p.style.gradShape,
            },
        ),
      id,
    );
  test('changes kept as the page went away are dropped when another tab saved the guide meanwhile', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await tickN(page, 3);
    // (the page going away: its own save never lands, as when the browser drops it)
    await page.evaluate(() => {
      IDB.put = () => new Promise(() => {});
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    });
    assert.ok(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), 'kept aside');
    // (another tab's save: a newer row)
    await page.evaluate((id) => {
      const e = state.saved.find((s) => s.id === id);
      e.ts = Date.now() + 5000;
      save(true);
    }, id);
    await page.reload();
    await idle(page);
    assert.equal((await stored(page, id)).prog, 0, 'not put over the other tab’s save');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), null);
    assert.deepEqual(errors, []);
  });
  test('with storage blocked, opening something else asks before the guide goes', async () => {
    const { page, errors } = await openApp({
      init: () => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('blocked', 'SecurityError');
          },
        });
      },
    });
    await sampleGuide(page);
    await tickN(page, 2);
    await idle(page);
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAsk'), /isn’t letting Marker Studio save/);
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)),
      2,
      'Cancel: still open',
    );
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="go"]');
    await page.waitForFunction(
      () => __mstest.assignData && __mstest.colored.reduce((a, b) => a + b, 0) === 0,
    );
    await idle(page);
    assert.equal(await page.locator('#sfEdAsk').count(), 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  const AUTO = 2300;
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) => p && { prog: (p.prog || []).length, n: Object.keys(p.assign || {}).length },
        ),
      id,
    );
  // (v318.25: a guide in Recently deleted that differs from the backup's stays there, and the backup's comes in beside it
  // as "(from backup)": the open guide, deleted, is shown as it was; before, it became the restored one)
  test('a backup restored over a guide deleted while open: the deleted one stays as it was, the backup’s comes in beside it', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await tickN(page, 3);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, AUTO);
    await page.evaluate(() => openLibrary());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const file = await dl.path();
    await page.keyboard.press('Escape');
    await idle(page);
    await tickN(page, 3, 3);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, AUTO);
    // deleted in the Library, its Undo let go
    await page.evaluate((id) => {
      openLibrary();
      libDelete(id);
      libFinish();
    }, id);
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    await page.setInputFiles('#guidesFile', file);
    await idle(page, 2000);
    assert.equal(
      await page.evaluate(() => [...__mstest.colored].reduce((a, b) => a + b, 0)),
      6,
      'the open guide as it was',
    );
    assert.equal((await stored(page, id)).prog, 6, 'its stored copy kept, for Put back');
    assert.match(await page.textContent('#sfSaveSt'), /Removed/);
    const nid = await page.evaluate(() => state.saved.find((s) => / \(from backup\)$/.test(s.name)).id);
    assert.equal((await stored(page, nid)).prog, 3, 'the backup’s copy beside it');
    assert.deepEqual(errors, []);
  });
}

// ---- from v299.test.mjs ----
// v299: fixes from the third fresh-eyes review — two of v298's own fixes put right (section edits from an earlier visit
// kept; Undo of a merge after a build gives the ticks back); a split-off coloured part keeps its marker and zone; the
// copy kept as the page goes works for edited guides; changes that couldn't be saved open instead of the older copy;
// Undo for Mark all coloured, Focus's Mark all done and a palette colour re-rolled; an old guide using Copic 0; and
// Scan's paste, typing and Clear list, Match's announcements, Random with nothing to draw.
{
  const slot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'));
  const reopen = async (page, id) => {
    // (v307.1: page.reload waits for the new page. location.reload() from evaluate returned before the reload began, so
    // waitForLoadState answered for the old page, and what came next could run there and be cut off by the reload:
    // "Execution context was destroyed", seen once in CI. Not a reload of the app's own: checked, there's only this one)
    await page.reload();
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => window.__mstest && __mstest.assignData && __mstest.curId === id, id);
    await idle(page, 1500);
  };
  test('changes that couldn’t be saved (storage full) open from the Library instead of the older copy, and are then saved', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    await idle(page, 2000);
    const id = await page.evaluate(() => __mstest.curId);
    await page.evaluate(() => {
      const op = IDB.put;
      IDB.put = function (k, v) {
        if (/^guide-\d/.test(k)) return Promise.reject(new Error('QuotaExceededError'));
        return op(k, v);
      };
    });
    await page.click('#sfColor');
    await idle(page);
    const ls = await page.evaluate(() => {
      const t = __mstest,
        ls = t.assignData.order.slice(5, 15);
      ls.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      return ls;
    });
    await page.waitForFunction(
      () => {
        const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
        return m && m.dirty;
      },
      null,
      { timeout: 8000 },
    );
    await page.evaluate(() => {
      const os = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'ms-guide-leave') throw new Error('QuotaExceededError');
        return os.call(this, k, v);
      };
    });
    await reopen(page, id);
    assert.equal(
      await page.evaluate((ls) => ls.filter((l) => __mstest.colored[l]).length, ls),
      10,
      'the newer copy opened',
    );
    // a change: saved to the Library with the ticks, and the slot then goes
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[30]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    let saved = 0;
    for (let t = 0; t < 40 && saved < 11; t++) {
      await page.waitForTimeout(200); // polling the stored copy until the save lands
      saved = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.prog.length), id);
    }
    assert.ok(saved >= 11, 'saved with the ticks: ' + saved);
    await page.waitForFunction(() => !localStorage.getItem('ms-guide-auto'), null, { timeout: 8000 });
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-persist.test.mjs ----
// v304 (backup and saving): a restore never overwrites a lost guide (kept, offered on Home) or changes made here since
// the last backup (kept as "… (before restore)", taken out again if the backup's copy can't be saved), and a guide whose
// delete is still finishing comes back as itself; a save that failed because the browser's database stopped answering
// says so (not "storage is full"), and the next failure says what it is; Back up says which guides it couldn't read and
// the reminder asks again at once; in a Safari tab on an iPhone or iPad the reminder after a first coloured section, or
// after five days away, is one card with Add to Home Screen.
{
  const KEY = 'ohuhu-hb320-picker-v3',
    DAY = 864e5;
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const CHROME_DESKTOP =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const safariTab = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
  };
  const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState = (saved = []) =>
    JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved });
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v304',
    ...extra,
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  // a device with markers and one Library guide "name" (id), stored and marked as backed up 3 days ago; returns the
  // backup file of that moment
  async function withGuide(id, name) {
    const a = await openApp();
    await welcome(a.page, 'look');
    await idle(a.page);
    const T0 = Date.now() - 3 * DAY;
    const bk = await a.page.evaluate(
      async ([PNG, id, name, T0]) => {
        window.PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
        window.rows = () =>
          state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name }));
        window.restoreFile = (o, cb) =>
          new Promise((r) => {
            const t = document.getElementById('msToast');
            if (t) t.classList.remove('on');
            restoreAny(
              new File([JSON.stringify(o)], 'b.json', { type: 'application/json' }),
              'guidesRestore',
              cb ? (x) => r(x) : undefined,
            );
            if (!cb)
              setTimeout(
                () =>
                  r({
                    toast:
                      (document.getElementById('msToast').classList.contains('on') &&
                        document.getElementById('msToast').textContent) ||
                      '',
                    card: (document.querySelector('.mserr') || {}).textContent || '',
                  }),
                1500,
              );
          });
        window.change = (id, name, k) =>
          sfSaveDesign({ id, name, W: 1, H: 1, keys: [k], n: 1, payload: PL(k, { prog: [0] }), quiet: true });
        await sfSaveDesign({
          id,
          name,
          W: 1,
          H: 1,
          keys: ['Ohuhu|R014'],
          n: 1,
          payload: PL('Ohuhu|R014'),
          ts: T0,
          keepTs: true,
          quiet: true,
        });
        state.saved.find((s) => s.id === id).bk = T0;
        save(true);
        localStorage.setItem('ms-guides-backup-ts', String(T0));
        const gs = await gatherGuides();
        return { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
      },
      [PNG, id, name, T0],
    );
    return { ...a, bk };
  }
  test('v304 P1: restoring never overwrites a lost guide: it is left as it is, said, and offered on Home', async () => {
    const { page, errors, bk } = await withGuide(5004, 'Owl');
    const r = await page.evaluate(async (bk) => {
      await change(5004, 'Owl', 'Ohuhu|Y111'); // coloured since the backup
      state.saved = state.saved.filter((s) => s.id !== 5004);
      save(true); // then its row couldn't be read
      const r = await restoreFile(bk);
      return { ...r, rows: rows(), prog: (await IDB.get('guide-5004')).prog };
    }, bk);
    assert.deepEqual(r.prog, [0], 'the lost guide keeps its progress (v303: the backup’s copy replaced it)');
    assert.deepEqual(
      r.rows.map((x) => x.name),
      ['Owl (from backup)'],
    );
    assert.match(
      r.toast,
      /1 guide stored on this device but not in your Library was left as it is — add it back from Home\./,
    );
    assert.doesNotMatch(r.toast, /newer here/);
    await page.click('#mHome');
    await page.waitForSelector('#lostNote', { state: 'visible', timeout: 8000 });
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
      openLibrary();
      libDelete(5001);
      const r = await restoreFile(bk);
      return { ...r, rows: rows() };
    }, bk);
    assert.deepEqual(r.rows, [{ id: 5001, name: 'Owl' }], 'not “Owl (from backup)”');
    assert.doesNotMatch(r.toast, /newer here|not in your Library/);
    await pause(page, 6500, 'the Undo time runs out: the delete finishes');
    assert.ok(
      await page.evaluate(() => IDB.get('guide-5001').then((p) => !!p)),
      'the restored guide is still stored',
    );
    assert.deepEqual(errors, []);
  });
  test('v304 P2: changes made here since the last backup are kept as “… (before restore)” when a newer backup replaces the guide', async () => {
    const { page, errors, bk } = await withGuide(5002, 'Cat');
    const r = await page.evaluate(async (bk) => {
      await change(5002, 'Cat', 'Ohuhu|Y111');
      const nb = JSON.parse(JSON.stringify(bk));
      nb.guides[0].ts = Date.now() + 1;
      nb.guides[0].payload = PL('Ohuhu|B08', { prog: [0] });
      const r1 = await restoreFile(nb);
      const rows1 = rows(),
        kept = rows1.find((x) => /before restore/.test(x.name));
      const keptPl = await IDB.get('guide-' + kept.id),
        mine = await IDB.get('guide-5002');
      const r2 = await restoreFile(nb),
        n2 = rows().length;
      // and through the Welcome's and Home's note's way (a callback): what was kept is there to say
      await new Promise((res) => setTimeout(res, 20));
      await change(5002, 'Cat', 'Ohuhu|G36');
      nb.guides[0].ts = Date.now() + 1;
      nb.guides[0].payload = PL('Ohuhu|R014', { prog: [0] });
      const r3 = await restoreFile(nb, true);
      return { r1, rows1, keptAssign: keptPl.assign[0], mineAssign: mine.assign[0], r2, n2, r3 };
    }, bk);
    assert.deepEqual(r.rows1.map((x) => x.name).sort(), ['Cat', 'Cat (before restore)']);
    assert.equal(r.keptAssign, 'Ohuhu|Y111', 'the copy holds the changes made here');
    assert.equal(r.mineAssign, 'Ohuhu|B08', 'the guide is the backup’s');
    assert.match(
      r.r1.toast,
      /1 guide changed here since your last backup was kept as “… \(before restore\)”\./,
    );
    assert.match(r.r2.toast, /already here/);
    assert.equal(r.n2, 2, 'the same backup again adds no copy');
    assert.equal(r.r3.kept, 1);
    assert.equal(
      await page.evaluate((x) => restoreKeptWords(x), r.r3),
      ' 1 guide changed here since your last backup was kept as “… (before restore)”.',
    );
    assert.deepEqual(errors, []);
  });
  test('v304 P2: when the backup’s copy can’t be saved, the copy kept of the guide here is taken out again', async () => {
    const { page, errors, bk } = await withGuide(5003, 'Fox');
    const r = await page.evaluate(
      async ([bk, KEY]) => {
        await change(5003, 'Fox', 'Ohuhu|Y111');
        const nb = JSON.parse(JSON.stringify(bk));
        nb.guides[0].ts = Date.now() + 60000;
        nb.guides[0].payload = PL('Ohuhu|B08', { prog: [0] });
        // the copy kept aside saves; the backup's copy then finds the storage full
        const o = Storage.prototype.setItem;
        let n = 0;
        Storage.prototype.setItem = function (k, v) {
          if (k === KEY && n++ >= 1) throw new DOMException('full', 'QuotaExceededError');
          return o.call(this, k, v);
        };
        const r1 = await restoreFile(nb);
        Storage.prototype.setItem = o;
        const rows1 = rows();
        const r2 = await restoreFile(nb);
        return { r1, rows1, r2, rows2: rows() };
      },
      [bk, KEY],
    );
    assert.deepEqual(
      r.rows1.map((x) => x.name),
      ['Fox'],
      'no copy left beside a guide that wasn’t replaced',
    );
    const said = r.r1.card + r.r1.toast;
    assert.match(said, /couldn’t be saved — this browser’s storage is full/);
    assert.doesNotMatch(said, /before restore/);
    assert.deepEqual(
      r.rows2.map((x) => x.name).sort(),
      ['Fox', 'Fox (before restore)'],
      'restored again with room: one copy',
    );
    assert.deepEqual(errors, []);
  });
  test('v304 P3: a save the browser’s database didn’t answer says reload, not “storage is full”; the next failure says what it is', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const tick = (k) =>
      page.evaluate((k) => {
        const t = __mstest;
        t.colored[t.assignData.order[k]] = 1;
        t.guideDirty = true;
        t.renderGuide();
      }, k);
    const status = () => page.evaluate(() => document.getElementById('sfSaveSt').textContent);
    await page.evaluate(() => {
      window.__put = IDB.put;
      IDB.put = (k, v) =>
        /^guide-\d/.test(k)
          ? Promise.reject(new DOMException('gone', 'UnknownError'))
          : window.__put.call(IDB, k, v);
    });
    await tick(0);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, 1500);
    assert.match(
      await toastText(page),
      /^Couldn’t save “[^”]+” — this browser’s storage isn’t answering\. Reload Marker Studio and try again; your changes are still open here\.$/,
    );
    assert.equal(await status(), 'Not saved — reload to try again');
    // the database answers again, but now the app's own storage is full: said as full (v304 first draft: still "isn't answering")
    await page.evaluate((KEY) => {
      IDB.put = window.__put;
      const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === KEY) throw new DOMException('full', 'QuotaExceededError');
        return o.call(this, k, v);
      };
    }, KEY);
    await tick(1);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, 1500);
    assert.equal(await status(), 'Not saved — storage is full');
    assert.equal(await page.evaluate(() => storeErr()), 'QuotaExceededError');
    assert.deepEqual(errors, []);
  });
  test('v304 P4: Back up says which guides it couldn’t read, the reminder asks again at once, and focus follows the card', async () => {
    const gone = {
      id: 77,
      type: 'guide',
      name: 'Unreadable',
      keys: [],
      W: 1,
      H: 1,
      n: 1,
      done: 1,
      ts: Date.now() - 20 * DAY,
    };
    // (v318 review: its stored guide one the database won't give back; one not stored at all is said apart, e2e/v318-data)
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState([gone]), 'ms-first-use': String(Date.now() - 15 * DAY) }),
      init: () => {
        addEventListener('DOMContentLoaded', () => {
          const get = IDB.get;
          IDB.get = (k) =>
            k === 'guide-77' ? Promise.reject(new DOMException('gone', 'UnknownError')) : get(k);
        });
      },
    });
    await page.waitForSelector('#bkGo');
    await page.focus('#bkGo');
    await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    await idle(page);
    assert.match(
      await toastText(page),
      /^Backed up, but 1 guide couldn’t be read and isn’t in it\. Reload Marker Studio and back up again before deleting anything\.$/,
    );
    assert.ok(await shown(page, 'backupNudge'), 'the reminder is due again at once');
    assert.match(
      await page.textContent('#backupNudge'),
      /1 guide couldn’t be read by your last backup\. Reload Marker Studio, then back up again\./,
    );
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
    assert.deepEqual(errors, []);
  });
  test('v304 D8: in a Safari tab on an iPhone, a guide’s first coloured section brings one card: keep it safe — Back up now, or Not now for both', async () => {
    const g = {
      id: 88,
      type: 'guide',
      name: 'Owl',
      keys: [],
      W: 1,
      H: 1,
      n: 4,
      done: 1,
      ts: Date.now() - DAY / 4,
    };
    const storage = onboarded({ [KEY]: appState([g]) });
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
    await idle(page);
    assert.ok(await shown(page, 'installCard'));
    assert.equal(await shown(page, 'backupNudge'), false, 'one card');
    const txt = await page.textContent('#installCard');
    assert.match(
      txt,
      /^Keep your guide safe on this iPhone Safari deletes a website’s saved work after about seven days of using Safari without opening it\. Add Marker Studio to your Home Screen to stop that — back up first, then restore the file in the Home Screen app\./,
    );
    assert.equal(await page.textContent('#installCard .nb1'), 'Back up now');
    await page.focus('#installCard [data-inst="later"]');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await shown(page, 'installCard'), false);
    assert.equal(await shown(page, 'backupNudge'), false, 'Not now rests both');
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
    await page.reload();
    await idle(page);
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
    const g = {
      id: 89,
      type: 'guide',
      name: 'Cat',
      keys: [],
      W: 1,
      H: 1,
      n: 4,
      done: 2,
      ts: Date.now() - 6 * DAY,
      bk: Date.now() - 8 * DAY,
    };
    const storage = onboarded({
      [KEY]: appState([g]),
      'ms-guides-backup-ts': String(Date.now() - 8 * DAY),
      'ms-last-visit': String(Date.now() - 6 * DAY),
    });
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
    await idle(page);
    assert.ok(await shown(page, 'installCard'));
    assert.match(
      await page.textContent('#installCard'),
      /^Keep your work safe on this iPhone Safari deletes .* 1 guide has changed since your last backup\. Add Marker Studio/,
    );
    // a day away only: no card from the backup
    const b = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      storage: { ...storage, 'ms-last-visit': String(Date.now() - DAY) },
    });
    await idle(b.page);
    assert.equal(await b.page.evaluate(() => !!backupDue()), false);
    assert.deepEqual([...errors, ...b.errors], []);
  });
  test('v304 P4: a backup that couldn’t read a guide brings the reminder back on Home even while an earlier Later is resting it', async () => {
    const gone = {
      id: 78,
      type: 'guide',
      name: 'Unreadable',
      keys: [],
      W: 1,
      H: 1,
      n: 1,
      done: 1,
      ts: Date.now() - 20 * DAY,
    };
    // (v318 review: its stored guide one the database won't give back, after a reload too; one not stored at all is said
    // apart, e2e/v318-data)
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState([gone]),
        'ms-first-use': String(Date.now() - 15 * DAY),
        'ms-backup-snooze': String(Date.now() + 5 * DAY),
      }),
      init: () => {
        addEventListener('DOMContentLoaded', () => {
          const get = IDB.get;
          IDB.get = (k) =>
            k === 'guide-78' ? Promise.reject(new DOMException('gone', 'UnknownError')) : get(k);
        });
      },
    });
    await idle(page);
    assert.equal(await shown(page, 'backupNudge'), false, 'put off with Later two days ago');
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => backupAll('noSuchButton')),
    ]);
    assert.ok(dl);
    await idle(page);
    assert.match(await toastText(page), /^Backed up, but 1 guide couldn’t be read/);
    assert.ok(await shown(page, 'backupNudge'), 'due at once, Later or not');
    assert.match(
      await page.textContent('#backupNudge'),
      /1 guide couldn’t be read by your last backup\. Reload Marker Studio, then back up again\./,
    );
    await page.reload();
    await idle(page);
    assert.ok(await shown(page, 'backupNudge'), 'and after a reload');
    assert.deepEqual(errors, []);
  });
  test('v304 P3: changes to a guide no longer open that the database didn’t take say reload, without “still open here”', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const a = await page.evaluate(() => __mstest.curId),
      nm = await page.evaluate(() => __mstest.curName);
    // a second Library guide to switch to (a copy of the first)
    const b = await page.evaluate(
      (a) =>
        IDB.get('guide-' + a).then((pl) => {
          const e = state.saved.find((s) => s.id === a);
          return sfSaveDesign({
            name: 'Other',
            W: e.W,
            H: e.H,
            keys: e.keys,
            n: e.n,
            payload: pl,
            quiet: true,
          });
        }),
      a,
    );
    assert.ok(b);
    // the open guide's next save is slow and then fails (the database dropped), and meanwhile another guide is put in place
    await page.evaluate((a) => {
      const put = IDB.put;
      IDB.put = (k, v) =>
        k === 'guide-' + a
          ? new Promise((_, rej) => setTimeout(() => rej(new DOMException('gone', 'UnknownError')), 1500))
          : put.call(IDB, k, v);
      const t = document.getElementById('msToast');
      if (t) t.classList.remove('on');
    }, a);
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
      t.guideDirty = true;
      t.renderGuide();
      t.flushSave();
    });
    await page.evaluate((b) => sfLoadDesign(b).then((d) => __mstest.openDesignObj(d, b)), b);
    await page.waitForFunction((b) => __mstest.curId === b, b);
    await page.waitForFunction(
      () =>
        /isn’t answering|storage is full/.test((document.getElementById('msToast') || {}).textContent || ''),
      null,
      { timeout: 8000 },
    );
    const t = await toastText(page);
    assert.equal(
      t,
      'Couldn’t save “' +
        nm +
        '” — this browser’s storage isn’t answering. Reload Marker Studio and try again.',
    );
    assert.doesNotMatch(t, /still open|storage is full/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-restore.test.mjs ----
// v305: Restore › Keep mine keeps your markers but no longer drops the backup's To buy list, ink marks and Brands I'd
// buy: they merge in for your markers (yours win on a clash) and every message says what came in.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v305',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const guide = (id, name) => ({
    id,
    name,
    W: 1,
    H: 1,
    keys: ['Ohuhu|R014'],
    n: 1,
    ts: Date.now() - 864e5,
    payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } },
  });
  const BACKUP = (extra = {}) => ({
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - 864e5,
    owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09'],
    saved: [],
    guides: [],
    wish: [
      { k: 'Ohuhu|G43', why: 'x', ts: 1 },
      { k: 'Copic|B000', why: 'dup', ts: 2 },
      { k: 'Ohuhu|R014', why: 'owned here', ts: 3 },
      { k: 'Ohuhu|Y111', why: 'low', ts: 4 },
    ],
    ink: { 'Ohuhu|B08': 'low', 'Copic|E09': 'dry', 'Ohuhu|Y111': 'low' },
    buyBrands: ['Ohuhu'],
    ...extra,
  });
  const file = (o) => ({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const mine = { wish: [{ k: 'Copic|B000', why: 'mine', ts: 1 }], ink: { 'Ohuhu|B08': 'dry' } };
  test('restore › Keep mine merges the backup’s To buy, ink and Brands I’d buy into yours, and says so', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState(mine) }),
    });
    await answerAsks(page, false);
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedOverlay.on');
    await page.setInputFiles('#guidesFile', file(BACKUP()));
    await idle(page);
    const s = await page.evaluate(() => ({
      wish: state.wish.map((w) => w.k),
      ink: state.ink,
      buy: state.buyBrands,
      n: state.owned.size,
    }));
    assert.equal(s.n, 8, 'your markers kept');
    assert.deepEqual(
      s.wish,
      ['Copic|B000', 'Ohuhu|G43', 'Ohuhu|Y111'],
      'once each; R014 is yours (no ink mark) so it stays off; Y111 is now marked low',
    );
    assert.deepEqual(
      s.ink,
      { 'Ohuhu|B08': 'dry', 'Ohuhu|Y111': 'low' },
      'yours wins; none for E09 (not yours)',
    );
    assert.deepEqual(s.buy, ['Ohuhu'], 'Brands I’d buy from the backup: yours was automatic');
    // (v308: with Undo, as Keep mine changed your To buy, ink and Brands I'd buy)
    assert.equal(
      await toastText(page),
      'Kept your markers; added 2 to buy and 1 Running low note. Brands I’d buy set from the backup. Undo marker change',
    );
    await page.reload();
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => ({ wish: state.wish.map((w) => w.k), ink: state.ink, buy: state.buyBrands })),
      { wish: s.wish, ink: s.ink, buy: s.buy },
      'saved',
    );
    // the To buy view shows them
    await page.click('#mCollection');
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal(await page.locator('#wishView .wrow').count(), 3);
    assert.match(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y111"] .wwhy'), /^low/);
    assert.deepEqual(errors, []);
  });
  test('restore › Keep mine with guides: the Back up & restore dialog and Welcome/Home’s words count what came in', async () => {
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: onboarded({ [KEY]: appState({ buyBrands: ['Copic'] }) }),
    });
    await answerAsks(page, false);
    await openBackupDialog(page);
    await page.setInputFiles('#backupFile', file(BACKUP({ guides: [guide(21, 'Owl')] })));
    await idle(page);
    await page.waitForFunction(() => /guide/.test(document.getElementById('backupCap').textContent), null, {
      timeout: 10000,
    });
    // (v308 merge: and that your markers are as they were)
    assert.equal(
      await page.textContent('#backupCap'),
      'Added 3 to buy and 2 Running low notes; 1 guide restored. Your markers are as they were.',
    );
    assert.deepEqual(await page.evaluate(() => state.buyBrands), ['Copic'], 'yours chosen: kept');
    // Welcome and Home's note (restoreAny's callback): a backup with only To buy entries isn't called empty
    const r = await page.evaluate(
      (o) =>
        new Promise((res) =>
          restoreAny(new File([JSON.stringify(o)], 'b.json'), 'nope', (r) =>
            res(r && { list: restoredList(r), wish: r.wish }),
          ),
        ),
      BACKUP({
        wish: [
          { k: 'Ohuhu|R16', why: 'x', ts: 1 },
          { k: 'Ohuhu|R28', why: 'x', ts: 1 },
        ],
        ink: {},
      }),
    );
    assert.deepEqual(r, { list: '2 markers to buy', wish: 2 });
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-small.test.mjs ----
// v305 small items: Back up & restore's two Restore buttons say which; Match's hex code part-typed greys the last result
// and, on Enter, says what's expected; Scan with a collection all of one brand starts on that brand, visibly, when no
// brand was ever chosen and Brands I'd buy is that brand too (or automatic), and the choices say which are yours.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v305',
    ...extra,
  });
  const OHUHU = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|B04',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OHUHU,
      saved: [],
      ...extra,
    });
  test('Back up & restore: "Restore a file" and "Restore from text"', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await openBackupDialog(page);
    assert.equal(await page.textContent('#backupImport'), 'Restore a file');
    await page.click('#backupShow');
    assert.equal(await page.textContent('#backupRestore'), 'Restore from text');
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-merge-fa.test.mjs ----
// v308 merge (fixes pass A): Delete all my data with the app open in a second tab; a backup that can't be read
// from the Library; the toast after a restore that kept your markers.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v308',
    [KEY]: JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
    }),
    ...extra,
  });
  const guidesInDb = (page) =>
    page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ms-guides', 1);
          r.onupgradeneeded = () => {};
          r.onerror = () => res(-1);
          r.onsuccess = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains('g')) {
              d.close();
              res(0);
              return;
            }
            const t = d.transaction('g').objectStore('g').count();
            t.onsuccess = () => {
              d.close();
              res(t.result);
            };
          };
        }),
    );
  // Copy details copies into __copied; the browser's file reading fails (as an iCloud file not downloaded can)
  const unreadable = () => {
    window.__copied = [];
    try {
      navigator.clipboard.writeText = (t) => (window.__copied.push(t), Promise.resolve());
    } catch (_) {}
    FileReader.prototype.readAsText = function () {
      Object.defineProperty(this, 'error', {
        value: new DOMException('The file could not be read.', 'NotReadableError'),
      });
      setTimeout(() => this.onerror && this.onerror(new ProgressEvent('error')), 0);
    };
  };
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const guide = (id, name) => ({
    id,
    name,
    W: 1,
    H: 1,
    keys: ['Ohuhu|R014'],
    n: 1,
    ts: Date.now() - 864e5,
    payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } },
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  test('Delete all my data with the app open in another tab: that tab starts again too, and writes nothing back', async () => {
    const a = await openApp({ width: 820, height: 1180, storage: onboarded() });
    await idle(a.page);
    // the other tab has the collection in memory and a guide open, saved in the Library (its picture in the database)
    const b = { page: await a.ctx.newPage(), errors: [] };
    b.page.on('pageerror', (e) => b.errors.push(e.message));
    await b.page.goto(a.page.url());
    await idle(b.page);
    await b.page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await b.page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await saveGuide(b.page);
    assert.equal(await guidesInDb(a.page), 1);
    // this tab deletes everything
    await a.page.click('#homeHelp');
    await a.page.waitForSelector('#helpOverlay.on');
    await a.page.click('#helpData > summary');
    await a.page.click('#helpWipe');
    await a.page.waitForSelector('#sfEdAsk');
    await a.page.fill('#wipeWord', 'DELETE');
    const bLoad = b.page.waitForEvent('load', { timeout: 6000 }).then(
      () => true,
      () => false,
    );
    await Promise.all([a.page.waitForEvent('load'), a.page.click('#wipeGo')]);
    const reloaded = await bLoad;
    await idle(b.page);
    // whatever it does now saves nothing of what it had
    await b.page.evaluate(async () => {
      try {
        save();
      } catch (_) {}
      try {
        if (window.__mstest && __mstest.flushSave) await __mstest.flushSave();
      } catch (_) {}
    });
    await idle(a.page);
    const st = await a.page.evaluate((KEY) => {
      const v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        owned: (v.owned || []).length,
        saved: (v.saved || []).length,
        onboarded: localStorage.getItem('ms-onboarded'),
      };
    }, KEY);
    assert.deepEqual(st, { owned: 0, saved: 0, onboarded: null }, 'nothing written back');
    assert.equal(await guidesInDb(a.page), 0, "the guides' database stays empty");
    assert.ok(reloaded, 'the other tab starts again');
    assert.ok(await b.page.isVisible('#welcome'), 'the other tab is at the welcome');
    assert.ok(await a.page.isVisible('#welcome'), 'this one too');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
    await a.ctx.close();
  });
  test('a backup file that can’t be read, from the Library: the error card with Copy details, as other restore errors have', async () => {
    const { page, errors, ctx } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded(),
      init: unreadable,
    });
    await idle(page);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.setInputFiles('#guidesFile', {
      name: 'marker-studio-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await page.waitForFunction(() => {
      const c = document.getElementById('guidesRestore').parentNode.nextElementSibling;
      return !!(c && c.classList.contains('mserr'));
    });
    const card = await page.evaluate(() => {
      const c = document.getElementById('guidesRestore').parentNode.nextElementSibling;
      return {
        t: c.textContent,
        b: [...c.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean),
        shown: c.getClientRects().length > 0,
      };
    });
    assert.ok(card.shown && card.t.includes('Couldn’t read that file.'), card.t);
    assert.ok(card.b.includes('Copy details') && card.b.includes('Send feedback'), String(card.b));
    await page.click('.mserr [data-errcopy]');
    await page.waitForFunction(() => window.__copied.length === 1);
    assert.match(
      await page.evaluate(() => window.__copied[0]),
      /· Restoring a backup\nThe file could not be read\./,
    );
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length, 'nothing changed');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a restore that kept your markers (Keep mine) and brought only guides says your markers are as they were', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: onboarded() });
    await answerAsks(page, false);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: Date.now() - 864e5,
      owned: ['Ohuhu|R014', 'Copic|E09'],
      saved: [],
      guides: [guide(21, 'Owl')],
    };
    await page.setInputFiles('#guidesFile', {
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.waitForFunction(() => document.getElementById('msToast')?.classList.contains('on'), null, {
      timeout: 10000,
    });
    assert.deepEqual(await page.evaluate(() => window.__asked.length), 1, 'Keep mine was asked');
    assert.equal(await toastText(page), '1 guide restored. Your markers are as they were.');
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), OWN.slice().sort(), 'they are');
    // Welcome's and Home's words say it too
    assert.equal(
      await page.evaluate(() => restoreSummary({ guides: 1, keptMine: true }).text),
      'Restored 1 guide. Your markers are as they were',
    );
    // not when the backup's markers came in, or when only markers came back
    assert.equal(
      await page.evaluate(() => restoreSummary({ guides: 1, markers: 3 }).text),
      'Restored 3 markers and 1 guide',
    );
    assert.equal(
      await page.evaluate(() => guideRestoreWords({ mk: true, pals: 0 }, 1, {})),
      'Markers restored; 1 guide restored.',
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v308-restore.test.mjs ----
// v308 restore: Keep my markers is the highlighted answer, "Add the backup's" merges, and every change to your
// markers has Undo (and a 7-day fallback); a guide only further along here gets no "(from backup)" copy and each guide
// in the file is said once; a long restore shows its progress and holds the controls; damaged, empty and picture files
// and files from a newer version are said as such; toasts are plain text.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const DAY = 864e5;
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v307',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
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
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const guide = (id, name) => ({
    id,
    name,
    W: 1,
    H: 1,
    keys: ['Ohuhu|R014'],
    n: 1,
    ts: Date.now() - DAY,
    payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } },
  });
  const file = (o, name = 'b.json') => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)),
  });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const hideToast = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      if (t) t.classList.remove('on');
    });
  const mk = (page) =>
    page.evaluate(() => ({ owned: [...state.owned].sort(), wish: state.wish.map((w) => w.k) }));
  const openLib = async (page) => {
    if (!(await page.isVisible('#savedOverlay'))) {
      await page.evaluate(() => openLibrary());
      await page.waitForSelector('#savedOverlay.on');
    }
  };
  const restoreFile = async (page, o) => {
    await hideToast(page);
    await openLib(page);
    await page.setInputFiles('#guidesFile', file(o));
  };
  const ask = (page) => page.waitForSelector('#sfEdAsk', { timeout: 10000 });
  const BK = (extra = {}) => ({
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - DAY,
    owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09', 'Ohuhu|R16'],
    wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
    ink: {},
    saved: [],
    guides: [],
    ...extra,
  });
  // the toast once it says this (what it said instead, when it doesn't)
  const waitToast = (page, re) =>
    page
      .waitForFunction(
        (src) => new RegExp(src).test((document.getElementById('msToast') || {}).textContent || ''),
        re.source,
        { timeout: 15000 },
      )
      .catch(async (e) => {
        const t = await page.textContent('#msToast').catch(() => '');
        const er = await page
          .evaluate(() =>
            errNet.list.map((x) => x.msg + ' @' + x.src + ':' + x.line + ' ' + x.stack).join(' | '),
          )
          .catch(() => '');
        throw new Error(
          'the toast didn’t say ' + re + ': “' + t + '” ' + er + ' ' + e.message.split('\n')[0],
        );
      });
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  const guideNames = (page) =>
    page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
  test('different markers: Keep my 8 is highlighted; Add the backup’s merges and says so; Undo marker change puts them back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ wish: [{ k: 'Copic|E09', why: 'mine', ts: 1 }] }) }),
    });
    await restoreFile(page, BK());
    await ask(page);
    assert.equal(await page.textContent('#sfEdAskT'), 'Your markers differ from the backup’s');
    assert.equal(
      await page.textContent('#sfEdAskD'),
      'You have 8 markers; the backup has 4 (2 of them yours too). Either way, the backup’s palettes are added.',
    );
    assert.deepEqual(
      await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.dataset.a + ':' + x.textContent)),
      [
        'keep:Keep my 8',
        'add:Add the backup’s 2 to mine (10)',
        'replace:Use the backup’s 4 (6 of yours go)',
        'stay:Cancel',
      ],
    );
    assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'keep');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'keep', 'and has the keyboard');
    await page.click('#sfEdAsk [data-a="add"]');
    await idle(page);
    const after = await mk(page);
    assert.equal(after.owned.length, 10);
    // E09 came in, so your To buy entry for it comes off; the backup's G43 (not yours) comes in
    assert.deepEqual(after.wish, ['Ohuhu|G43']);
    assert.equal(
      await toastText(page),
      'Added 2 markers from the backup (10 now); also 1 to buy. Undo marker change',
    );
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await mk(page), { owned: [...OWN].sort(), wish: ['Copic|E09'] }, 'as they were');
    assert.equal(await toastText(page), 'Put back your 8 markers as they were before the restore.');
    await page.reload();
    await idle(page);
    assert.equal((await mk(page)).owned.length, 8, 'kept');
    // with nothing new in the backup, no Add
    await restoreFile(page, BK({ owned: ['Ohuhu|R014'] }));
    await ask(page);
    assert.deepEqual(await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.dataset.a)), [
      'keep',
      'replace',
      'stay',
    ]);
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.deepEqual(errors, []);
  });
  test('Use the backup’s: Undo in the toast, and for 7 days “Put back the 8 markers…” in the Library and Back up & restore until your markers change', async () => {
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: onboarded({ [KEY]: appState() }),
    });
    await restoreFile(page, BK());
    await ask(page);
    await page.click('#sfEdAsk [data-a="replace"]');
    await idle(page);
    assert.equal((await mk(page)).owned.length, 4);
    assert.match(await toastText(page), /^Restored — 4 markers\. Undo marker change$/);
    await page.reload();
    await idle(page);
    await openLib(page);
    assert.equal(
      await page.textContent('#libPreRestore'),
      'Put back the 8 markers you had before today’s restore',
    );
    await page.keyboard.press('Escape');
    await openBackupDialog(page);
    assert.ok(await page.isVisible('#bkPreRestore'));
    await page.click('#bkPreRestore');
    await idle(page);
    assert.deepEqual((await mk(page)).owned, [...OWN].sort());
    assert.equal(await page.isVisible('#bkPreRestore'), false, 'gone once used');
    await page.keyboard.press('Escape');
    // a change to your markers since: not offered (it would undo that too)
    await restoreFile(page, BK());
    await ask(page);
    await page.click('#sfEdAsk [data-a="replace"]');
    await idle(page);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      state.owned.add('Ohuhu|G43');
      save();
    });
    await openLib(page);
    assert.equal(await page.isVisible('#libPreRestore'), false);
    assert.deepEqual(errors, []);
  });
  test('restore from text: Keep mine is said (with Undo when its lists changed); the same markers aren’t “restored”', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await openBackupDialog(page);
    const paste = (o) =>
      page.evaluate((t) => {
        document.getElementById('backupText').value = t;
        document.getElementById('backupRestore').click();
      }, JSON.stringify(o));
    await paste({
      v: 2,
      owned: ['Ohuhu|R014', 'Copic|E09'],
      wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
      saved: [],
    });
    await ask(page);
    await page.click('#sfEdAsk [data-a="keep"]');
    await idle(page);
    assert.equal(await page.textContent('#backupCap'), 'Kept your markers; added 1 to buy.');
    assert.equal(await toastText(page), 'Kept your markers; added 1 to buy. Undo marker change');
    // nothing new: still said (v307 gave no word at all)
    await hideToast(page);
    await paste({ v: 2, owned: ['Ohuhu|R014', 'Copic|E09'], saved: [] });
    await ask(page);
    await page.click('#sfEdAsk [data-a="keep"]');
    await idle(page);
    assert.equal(await page.textContent('#backupCap'), 'Kept your markers.');
    assert.equal(await toastText(page), 'Kept your markers.');
    // the same markers
    await paste({ v: 2, owned: OWN, saved: [] });
    await idle(page);
    assert.equal(await page.textContent('#backupCap'), 'Your markers already match the backup.');
    assert.doesNotMatch(await toastText(page), /restored/i);
    assert.deepEqual(errors, []);
  });
  test('a guide only further along here gets no “(from backup)” copy, one with a plan change still does, and each guide is said once', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await tickN(page, 2);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    const bk = {
      v: 3,
      type: 'ms-backup',
      ts: Date.now(),
      owned: await page.evaluate(() => [...state.owned]),
      saved: [],
      guides: await page.evaluate(() => gatherGuides()),
    };
    // three more ticked here since
    await tickN(page, 3, 2);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await restoreFile(page, bk);
    await waitToast(page, /further along/);
    assert.equal(await toastText(page), '1 guide is further along here, so it was left as it is.');
    assert.deepEqual(
      (await guideNames(page)).filter((n) => /from backup/.test(n)),
      [],
      'no copy',
    );
    // a plan changed here too: the backup's version comes in beside it, said once (v307: "1 guide restored. 1 guide was
    // newer here…")
    await page.keyboard.press('Escape');
    await page.click('#mSections');
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
    await page.click(`#sfShape [data-v="${shape}"]`);
    await idle(page);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await restoreFile(page, bk);
    await waitToast(page, /newer here/);
    const t = await toastText(page);
    assert.match(
      t,
      /^1 guide was newer here, so it was kept and the backup’s version added as “\(from backup\)”\.$/,
    );
    assert.equal((await guideNames(page)).filter((n) => /\(from backup\)$/.test(n)).length, 1);
    assert.deepEqual(errors, []);
  });
  test('a restore of many guides says “Restoring 3 of 6…” and holds the Welcome’s controls until it’s done; a second one waits', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.waitForSelector('#welcome.on');
    // (each guide's write slowed, as a big backup's are on an iPad)
    await page.evaluate(() => {
      const put = IDB.put;
      IDB.put = function (k, v) {
        return new Promise((r) => setTimeout(r, 120)).then(() => put.call(IDB, k, v));
      };
      window.__seen = new Set();
      window.__held = [];
      window.__toasts = [];
      const t = window.toast;
      window.toast = function (m, ms) {
        __toasts.push(String(m));
        return t(m, ms);
      };
      new MutationObserver(() => {
        const b = document.getElementById('wcRestore');
        __seen.add(b.textContent);
        if (/Restoring/.test(b.textContent)) {
          __held.push(
            ['wcAdd', 'wcSkip', 'wcHaveSet', 'wcOneByOne', 'wcNotSure'].every(
              (id) => document.getElementById(id).disabled,
            ) && document.querySelector('#wcSets input').disabled,
          );
          // a second restore meanwhile is turned away
          if (/Restoring 3 of 6/.test(b.textContent) && !window.__second) {
            window.__second = true;
            restoreAny(new File(['{}'], 'x.json'), 'guidesRestore');
          }
        }
      }).observe(document.getElementById('wcRestore'), {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    const bk = {
      v: 3,
      type: 'ms-backup',
      ts: Date.now() - DAY,
      owned: OWN,
      saved: [],
      guides: [1, 2, 3, 4, 5, 6].map((i) => guide(20 + i, 'G' + i)),
    };
    await page.setInputFiles('#wcFile', file(bk));
    await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'), null, {
      timeout: 20000,
    });
    assert.ok(await page.evaluate(() => __held.length > 0 && __held.every(Boolean)), 'held throughout');
    // (each step said on the button, and the controls held all the while)
    assert.deepEqual(
      await page.evaluate(() => [1, 2, 3, 4, 5, 6].filter((i) => __seen.has('Restoring ' + i + ' of 6…'))),
      [1, 2, 3, 4, 5, 6],
    );
    assert.ok(
      await page.evaluate(() => __toasts.some((m) => /A restore is already under way/.test(m))),
      'the second waits',
    );
    assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 6);
    assert.equal(
      await page.evaluate(() => document.querySelector('#wcSets input').disabled),
      false,
      'free again',
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains('msrestoring')),
      false,
    );
    assert.deepEqual(errors, []);
  });
  test('a backup cut short, an empty file and a picture each have their own words', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    const full = JSON.stringify({
      v: 3,
      type: 'ms-backup',
      ts: 1,
      owned: OWN,
      saved: [],
      guides: [guide(21, 'Owl')],
    });
    const say = async (f) => {
      await openLib(page);
      await page.evaluate(() => document.querySelectorAll('.mserr').forEach((c) => c.remove()));
      await page.setInputFiles('#guidesFile', f);
      await page.waitForSelector('#savedOverlay .mserr');
      return page.textContent('#savedOverlay .mserr');
    };
    assert.match(
      await say(file(full.slice(0, Math.round(full.length * 0.6)))),
      /This backup is incomplete or damaged — it may not have finished downloading\. Download it again from Files or iCloud Drive, or choose an earlier backup\./,
    );
    assert.match(await say(file('')), /That file is empty\./);
    const png = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    assert.match(
      await say({ name: 'IMG_0001.png', mimeType: 'image/png', buffer: png }),
      /That’s a picture, not a backup\./,
    );
    assert.match(await say(file('{"hello":1}')), /That file isn’t a Marker Studio backup/, 'as before');
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length, 'nothing changed');
    assert.deepEqual(errors, []);
  });
  test('backups carry the app’s version; one from a newer version is asked about, and Cancel restores nothing', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await openLib(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const made = JSON.parse(await readFile(await dl.path(), 'utf8'));
    assert.equal(made.app, await page.evaluate(() => appVersion()));
    assert.match(made.app, /^v\d+/);
    await idle(page);
    const newer = {
      v: 3,
      type: 'ms-backup',
      app: 'v999',
      ts: Date.now(),
      owned: OWN,
      saved: [{ id: 77, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 77 }],
      guides: [],
    };
    await restoreFile(page, newer);
    await ask(page);
    assert.equal(await page.textContent('#sfEdAskT'), 'Made by a newer Marker Studio');
    assert.match(
      await page.textContent('#sfEdAskD'),
      /^This backup was made by Marker Studio v999; this is v\d+(\.\d+)?\. Update first: close and reopen the app, then try again\.$/,
    );
    assert.equal(
      await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'),
      'stay',
      'Cancel is the highlighted answer',
    );
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal(await toastText(page), 'Nothing restored.');
    assert.equal(await page.evaluate(() => state.saved.length), 0);
    await restoreFile(page, newer);
    await ask(page);
    await page.click('#sfEdAsk [data-a="go"]');
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved.length), 1, 'Restore anyway');
    assert.deepEqual(errors, []);
  });
  test('toasts are plain text: a name with markup in it is shown as written', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({
          saved: [{ id: 5, type: 'palette', name: '<b>Bold</b> & <i>co</i>', keys: ['Ohuhu|R014'], ts: 5 }],
        }),
      }),
    });
    await openLib(page);
    await page.click('#savedList .srow .smore');
    await page.click('#savedList .srow .sdel');
    assert.equal(await toastText(page), 'Deleted “<b>Bold</b> & <i>co</i>” Undo');
    assert.equal(await page.locator('#msToast b, #msToast i').count(), 0);
    await page.click('#toastAct');
    assert.equal(await page.evaluate(() => state.saved.length), 1, 'Undo still works');
    // the plain toast never makes markup; toastHTML is the explicit way
    await page.evaluate(() => toast('<b>x</b>'));
    assert.equal(await toastText(page), '<b>x</b>');
    assert.equal(await page.locator('#msToast b').count(), 0);
    await page.evaluate(() => toastHTML('<b>x</b>'));
    assert.equal(await page.locator('#msToast b').count(), 1);
    assert.deepEqual(errors, []);
  });
}
