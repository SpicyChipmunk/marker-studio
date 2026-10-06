// v308 merge (fixes pass A): Delete all my data with the app open in a second tab; a backup that can't be read
// from the Library; the toast after a restore that kept your markers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, saveGuide, idle, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

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
