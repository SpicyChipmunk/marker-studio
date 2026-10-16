// v318.7 Scan, section 3: the pictures of the questions waiting (a photo's question's cap) are kept in a small database
// of the app's own, 'ms-scan-pics', through a reload: the list shows first, the pictures a moment later ("?" until
// then, and for good when the storage fails); only what's changed is written (nothing at a draw that changed nothing);
// a question answered or taken off, or the list cleared, takes its picture out; at most 60 are kept; and Delete all my
// data deletes the database. Each test fails on v318.6 (the pictures lived only in memory: "?" after a reload).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = {
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  'ms-scan-brand': '',
  [KEY]: JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014'],
    saved: [],
  }),
};
// an app with a marker, Either brand chosen, Scan open
async function opened(opts = {}) {
  const a = await openApp({ width: 820, height: 1180, storage: onboarded, ...opts });
  await idle(a.page);
  await scanFromMarkers(a.page);
  await idle(a.page);
  return a;
}
// the same app again, as a reload: its storage as the page left it
const reopen = async (page) => {
  await page.reload();
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
};
// a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: eight Ohuhu codes and "808" (asked
// about, with its cap's picture)
function read(page) {
  return page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 400;
    const g = cv.getContext('2d');
    g.fillStyle = '#888';
    g.fillRect(0, 0, 400, 400);
    const data = g.getImageData(0, 0, 400, 400);
    scanList = [];
    ocrAnswered = [];
    ocrPhotos = 0;
    scanBrand = '';
    const r = {
      n: ++ocrPhotos,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
    };
    r.img = { w: 400, h: 400, data: data };
    ocrRun = r;
    const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115'].map((t, k) => ({
      id: k + 1,
      look: 1,
      text: t,
      conf: 0.98,
      unsure: false,
      nameOf: 0,
      box: [20 + k * 40, 380, 30, 14, 0],
    }));
    lines.push({
      id: 20,
      look: 1,
      text: '808',
      conf: 0.97,
      unsure: false,
      nameOf: 0,
      box: [200, 200, 100, 40, 0],
      turn: 0,
    });
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    ocrRun = null;
    scanRender();
    return scanList.map((e) => (e.ask ? e.ask : COLORS[e.i].code) + (e.crop ? ' pic' : ''));
  });
}
// the database's rows, read here: [ask, at] each; null when there's no database (or no store in it)
const rows = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('ms-scan-pics');
        r.onerror = () => res(null);
        r.onsuccess = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('p')) {
            d.close();
            res(null);
            return;
          }
          const st = d.transaction('p', 'readonly').objectStore('p'),
            a = st.getAllKeys(),
            b = st.getAll();
          b.onsuccess = () => {
            d.close();
            res(a.result.map((k, n) => [k, b.result[n].at]));
          };
        };
      }),
  );
const counts = (page) => page.evaluate(() => [scanPics.writes, scanPics.deletes]);

test('a photo’s question keeps its picture through a reload; a draw that changes nothing writes nothing; the answer takes the picture out', async () => {
  const { page, errors } = await opened();
  const list = await read(page);
  assert.equal(list[0], 'confirm 808 pic');
  await page.waitForFunction(() => scanPics.writes === 1);
  assert.deepEqual(
    (await rows(page)).map((r) => r[0]),
    ['confirm 808'],
  );
  // drawn again, nothing changed: nothing written
  await page.evaluate(() => {
    scanRender();
    scanRender();
    scanSaveList();
  });
  await page.waitForTimeout(300);
  assert.deepEqual(await counts(page), [1, 0]);
  // a reload: the question back with its picture, to see larger
  await reopen(page);
  assert.equal(await page.locator('#scList .scask').count(), 1);
  await page.waitForSelector('#scList .scask.sccropped .sccrop img', { timeout: 5000 });
  assert.match(await page.getAttribute('#scList .sccrop img', 'src'), /^data:image\/jpeg/);
  assert.deepEqual(await counts(page), [0, 0], 'nothing written again on load');
  // answered: the picture goes from the database
  await page.click('#scList .scask .scchoose');
  await idle(page);
  await page.waitForFunction(() => scanPics.deletes === 1);
  assert.deepEqual(await rows(page), []);
  assert.deepEqual(errors, []);
});

test('the list shows first, the picture a moment later; when the storage fails, "?" as before', async () => {
  const { page, errors } = await opened();
  await read(page);
  await page.waitForFunction(() => scanPics.writes === 1);
  // (the database made slow to answer, as a device busy or waking can be)
  await page.addInitScript(() => {
    const open = indexedDB.open;
    indexedDB.open = function (name, v) {
      const r = open.call(indexedDB, name, v);
      if (name !== 'ms-scan-pics') return r;
      let fn = null;
      Object.defineProperty(r, 'onsuccess', {
        set(f) {
          fn = f;
        },
        get() {
          return fn;
        },
      });
      // (held until the test lets it go: a wait of so many seconds isn't the same on every engine)
      r.addEventListener('success', (ev) => {
        window.__picsGo = () => fn && fn.call(r, ev);
      });
      return r;
    };
  });
  await reopen(page);
  assert.equal(await page.locator('#scList .scask').count(), 1);
  assert.equal(await page.locator('#scList .scask.sccropped').count(), 0, 'the question first, "?"');
  assert.equal(await page.textContent('#scList .scask .scmark'), '?');
  await page.waitForFunction(() => typeof window.__picsGo === 'function');
  await page.evaluate(() => window.__picsGo());
  await page.waitForSelector('#scList .scask.sccropped', { timeout: 5000 });
  // the storage failing: "?" stays, no error
  await page.addInitScript(() => {
    const open = indexedDB.open;
    indexedDB.open = function (name, v) {
      if (name === 'ms-scan-pics') throw new Error('no storage here');
      return open.call(indexedDB, name, v);
    };
  });
  await reopen(page);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#scList .scask').count(), 1);
  assert.equal(await page.locator('#scList .scask.sccropped').count(), 0);
  assert.equal(await page.textContent('#scList .scask .scmark'), '?');
  assert.deepEqual(errors, []);
});

test('Clear list takes the pictures out; at most 60 are kept, the newest, and those of no question waiting are pruned', async () => {
  const { page, errors } = await opened();
  await read(page);
  await page.waitForFunction(() => scanPics.writes === 1);
  await page.click('#scClear');
  await page.click('#scClear');
  await idle(page);
  await page.waitForFunction(() => scanPics.deletes === 1);
  assert.deepEqual(await rows(page), []);
  // 63 questions waiting, their pictures in the database with their times (the rows put here), and 2 rows of
  // questions long gone: a reload keeps the 60 newest and prunes the rest
  await page.evaluate(
    () =>
      new Promise((res) => {
        const codes = COLORS.filter((c) => c.brand === 'Copic' && c.code.length <= 4)
          .map((c) => c.code)
          .slice(0, 63);
        localStorage.setItem(
          'ms-scan-list',
          JSON.stringify(
            codes.map((c) => ({
              ask: 'brands ' + c,
              title: c + ': Ohuhu or Copic?',
              opts: [{ k: 'Copic|' + c, how: 'chosen' }],
            })),
          ),
        );
        const r = indexedDB.open('ms-scan-pics');
        r.onsuccess = () => {
          const d = r.result,
            st = d.transaction('p', 'readwrite').objectStore('p');
          codes.forEach((c, n) =>
            st.put({ crop: 'data:image/jpeg;base64,' + n, at: 1000 + n }, 'brands ' + c),
          );
          st.put({ crop: 'data:image/jpeg;base64,x', at: 5000 }, 'confirm 999');
          st.put({ crop: 'data:image/jpeg;base64,y', at: 1 }, 'brands ZZZ');
          st.transaction.oncomplete = () => {
            d.close();
            res();
          };
        };
      }),
  );
  await reopen(page);
  await page.waitForFunction(() => scanPics.deletes === 5, null, { timeout: 5000 });
  const left = await rows(page);
  assert.equal(left.length, 60);
  const ats = left.map((r) => r[1]).sort((a, b) => a - b);
  assert.equal(ats[0], 1003, 'the three oldest pruned');
  assert.ok(
    !left.some((r) => r[0] === 'confirm 999' || r[0] === 'brands ZZZ'),
    'no question waiting: pruned',
  );
  assert.equal(await page.locator('#scList .scask.sccropped').count(), 60);
  assert.equal(await page.locator('#scList .scask').count(), 63);
  assert.deepEqual(errors, []);
});

// the names of the databases here, where the browser can list them (Chromium and Safari can; null where not)
const dbNames = (page) =>
  page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null));

test('Delete all my data deletes the pictures’ database, and nothing’s written back; the page starting again with no question waiting makes none', async () => {
  const { page, errors } = await opened();
  await read(page);
  await page.waitForFunction(() => scanPics.writes === 1);
  const before = await dbNames(page);
  if (before) assert.ok(before.includes('ms-scan-pics'), before.join(' '));
  // the wipe itself (what Help › Your data › Delete all my data runs before the page starts again): the database
  // gone, and a draw after it writes nothing back
  const after = await page.evaluate(async () => {
    await wipeAllData();
    scanRender();
    scanSaveList();
    await new Promise((r) => setTimeout(r, 400));
    return {
      dbs: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null,
      writes: scanPics.writes,
    };
  });
  if (after.dbs) assert.ok(!after.dbs.includes('ms-scan-pics'), after.dbs.join(' '));
  assert.equal(after.writes, 1, 'nothing written back');
  // the page again, as the wipe starts it: the welcome, no list, and no database made for it
  await page.reload();
  await idle(page);
  await page.waitForTimeout(400);
  const fresh = await dbNames(page);
  if (fresh) assert.ok(!fresh.includes('ms-scan-pics'), fresh.join(' '));
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-list')), null);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  // (and opened afresh here, it has no store: nothing in it)
  assert.equal(await rows(page), null);
  assert.deepEqual(errors, []);
});
