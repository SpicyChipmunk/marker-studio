// v318.7 Scan, sections 8 and 9, in the browser: Markers' Add markers sheet says the questions still waiting in Scan's
// list, "2 questions still to answer · Answer them", which opens Scan at the first question's first answer with no
// keyboard; a question every answer of which is in your collection is dropped (after Add, and when the sheet opens);
// with two tabs open the list is read again from the other tab's save, its pictures found again; and the list has a
// small heading over each photo's markers, kept through a reload and numbered 1.. in turn, the batch's summary
// numbered the same way. Each test fails on v318.6.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const stored = (owned) => ({
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
    owned: owned || ['Ohuhu|R014'],
    saved: [],
  }),
});
const type = async (page, text) => {
  await page.fill('#scBox', text);
  await page.press('#scBox', 'Enter');
  await idle(page);
};
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a.id || a.className + ':' + a.textContent.trim().slice(0, 20);
  });
const waitLine = async (page) => {
  const el = page.locator('#mkaWait');
  if (!(await el.count())) return null;
  return (await el.isHidden()) ? '' : (await el.textContent()).trim();
};
// a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: the codes given, and "808" (asked
// about, with its cap's picture) when asked for. keep: the list as it is (another photo after the first)
function read(page, codes, ask, keep) {
  return page.evaluate(
    ([codes, ask, keep]) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 400;
      const g = cv.getContext('2d');
      g.fillStyle = '#888';
      g.fillRect(0, 0, 400, 400);
      const data = g.getImageData(0, 0, 400, 400);
      if (!keep) {
        scanList = [];
        ocrAnswered = [];
        ocrPhotos = 0;
      }
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
      const lines = codes.map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
      }));
      if (ask)
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
      return scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0));
    },
    [codes, !!ask, !!keep],
  );
}
const headings = (page) =>
  page.$$eval('#scList .scgroup', (hs) => hs.map((h) => h.textContent.replace(/ /g, ' ')));

test('Add markers says the questions waiting; Answer them opens Scan at the first question without the keyboard; the line goes when none', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  assert.equal(await waitLine(page), '', 'none waiting: hidden');
  await type(page, 'B04');
  await type(page, 'B05');
  assert.equal(await page.locator('#scList .scask').count(), 2);
  await page.click('#scClose');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '2 questions still to answerAnswer them');
  await page.click('#mkaQuestions');
  await page.waitForSelector('#scanOverlay.on');
  await idle(page);
  assert.match(await active(page), /^scchoose:B05 /, 'the first question’s first answer, not the box');
  assert.notEqual(await active(page), 'scBox');
  // answered, the line says one; the last answered, it goes
  await page.keyboard.press('Enter');
  await idle(page);
  await page.click('#scClose');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '1 question still to answerAnswer them');
  await page.click('#mkaQuestions');
  await page.waitForSelector('#scanOverlay.on');
  await page.click('#scList .scask .scchoose');
  await idle(page);
  await page.click('#scClose');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '');
  assert.deepEqual(errors, []);
});

test('a question every answer of which is in your collection is dropped, after Add and when the sheet opens, its picture with it', async () => {
  // Ohuhu B05 and Copic B05 both yours: "B05: Ohuhu or Copic?" is still asked when typed (already yours, either)
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: stored(['Ohuhu|R014', 'Ohuhu|B05', 'Copic|B05', 'Ohuhu|B08']),
  });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await type(page, 'B05');
  await type(page, 'Y213');
  assert.equal(await page.locator('#scList .scask').count(), 1);
  // Add: Y213 goes in, and the question, every answer yours, is dropped: not "1 still to choose"
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /Added 1 marker to your collection/);
  assert.doesNotMatch(await page.textContent('#msToast'), /still to choose/);
  assert.equal(await page.evaluate(() => scanList.length), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-list')), null);
  // (v318.7 debug) Undo: Y213 back on the list, not the question, whose answers were yours before (it would only be
  // dropped again); but a question the Add itself answered by owning, "B04: Ohuhu or Copic?" with Copic B04 added,
  // comes back open with its Undo (it had gone for good)
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)), ['Y213']);
  await page.evaluate(() => {
    state.owned.add('Ohuhu|B04');
  });
  await scanFromMarkers(page);
  await idle(page);
  await type(page, 'B04');
  await type(page, 'Copic B04');
  assert.deepEqual(await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)), [
    'B04',
    'brands B04',
    'Y213',
  ]);
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /Added 2 markers to your collection/);
  assert.doesNotMatch(await page.textContent('#msToast'), /still to choose/);
  assert.equal(await page.evaluate(() => scanList.length), 0);
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)),
    ['B04', 'brands B04', 'Y213'],
    'as the list was',
  );
  assert.match(await page.evaluate(() => localStorage.getItem('ms-scan-list')), /"ask":"brands B04"/);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '1 question still to answerAnswer them');
  await page.keyboard.press('Escape');
  await idle(page);
  // a photo's question with its picture ("808": B08, yours already) waits; owning its answer, then opening the sheet,
  // drops it and its picture
  await scanFromMarkers(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned.delete('Ohuhu|B08');
  });
  const list = await read(page, ['B015', 'B03'], true);
  assert.deepEqual(list, ['?@1', 'B03@1', 'B015@1']);
  await page.waitForFunction(() => scanPics.writes === 1);
  await page.click('#scClose');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '1 question still to answerAnswer them');
  await page.keyboard.press('Escape');
  await idle(page);
  await page.evaluate(() => {
    state.owned.add('Ohuhu|B08');
  });
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '');
  assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 0);
  await page.waitForFunction(() => scanPics.deletes === 1);
  // (v318.7 debug) the same question asked again, dropped by an Add that owns B08, given back by its Undo with its
  // picture, written again
  await page.keyboard.press('Escape');
  await idle(page);
  await page.evaluate(() => {
    state.owned.delete('Ohuhu|B08');
  });
  await scanFromMarkers(page);
  await idle(page);
  assert.deepEqual(await read(page, ['B111'], true, true), ['?@2', 'B111@2', 'B03@1', 'B015@1']);
  await page.waitForFunction(() => scanPics.writes === 2);
  await type(page, 'B08');
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /Added 4 markers to your collection/);
  assert.equal(await page.evaluate(() => scanList.length), 0);
  await page.waitForFunction(() => scanPics.deletes === 2);
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => scanList.map((e) => (e.ask || COLORS[e.i].code) + (e.crop ? ' pic' : ''))),
    ['B08', 'confirm 808 pic', 'B111', 'B03', 'B015'],
  );
  await page.waitForFunction(() => scanPics.writes === 3);
  assert.deepEqual(errors, []);
});

test('two tabs: the list is read again from the other tab’s save, with its pictures, while Scan isn’t open here', async () => {
  const { ctx, page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  // this tab: a photo's question with its picture, Scan closed
  const list = await read(page, ['B015', 'B03'], true);
  assert.deepEqual(list, ['?@1', 'B03@1', 'B015@1']);
  await page.waitForFunction(() => scanPics.writes === 1);
  await page.click('#scClose');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await waitLine(page), '1 question still to answerAnswer them');
  // the other tab: a question typed, Scan closed (the list saved)
  const other = await ctx.newPage();
  const errors2 = [];
  other.on('pageerror', (e) => errors2.push(e.message));
  await other.goto(page.url());
  await idle(other);
  assert.equal(await other.evaluate(() => scanList.length), 3, 'the list as saved');
  await scanFromMarkers(other);
  await idle(other);
  await other.waitForSelector('#scList .scask.sccropped', { timeout: 5000 });
  await type(other, 'B04');
  await other.click('#scClose');
  await idle(other);
  // this tab heard: the line says two, the list has both, and the photo's picture is found again
  await page.waitForFunction(() => scanList.length === 4, null, { timeout: 5000 });
  assert.equal(await waitLine(page), '2 questions still to answerAnswer them');
  await page.waitForFunction(() => scanList.some((e) => e.ask === 'confirm 808' && e.crop), null, {
    timeout: 5000,
  });
  assert.deepEqual(
    await page.evaluate(() => scanList.map((e) => (e.ask ? e.ask : COLORS[e.i].code) + '@' + (e.photo || 0))),
    ['brands B04@0', 'confirm 808@1', 'B03@1', 'B015@1'],
  );
  // the other tab answers the photo's question: this one's line says one
  await scanFromMarkers(other);
  await idle(other);
  await other.click('#scList .scask.sccropped .scchoose');
  await idle(other);
  await other.click('#scClose');
  await idle(other);
  await page.waitForFunction(() => scanList.filter((e) => e.ask).length === 1, null, { timeout: 5000 });
  assert.equal(await waitLine(page), '1 question still to answerAnswer them');
  // not while Scan is open here: what's being done here isn't overwritten
  await page.keyboard.press('Escape');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await type(page, 'B05');
  await scanFromMarkers(other);
  await idle(other);
  await other.click('#scClear');
  await other.click('#scClear');
  await idle(other);
  await other.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scanList.length), 5, 'kept here');
  await other.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(errors2, []);
});

test('a heading over each photo’s markers, and over the typed ones while photos are there; kept through a reload, numbered in turn; the batch’s summary the same', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await type(page, 'B04');
  assert.deepEqual(await headings(page), [], 'no photo: no headings');
  await read(page, ['B015', 'B03', 'B111'], true, true);
  assert.deepEqual(await headings(page), [
    'Photo 1 · 3 markers · 1 to choose',
    'Typed or scanned · 1 to choose',
  ]);
  await read(page, ['B112', 'B114'], false, true);
  assert.deepEqual(await headings(page), [
    'Photo 2 · 2 markers',
    'Photo 1 · 3 markers · 1 to choose',
    'Typed or scanned · 1 to choose',
  ]);
  // the photo's question answered: its marker in its place, under its heading
  await page.click('#scList .scask.sccropped .scchoose');
  await idle(page);
  assert.deepEqual(await headings(page), [
    'Photo 2 · 2 markers',
    'Photo 1 · 4 markers',
    'Typed or scanned · 1 to choose',
  ]);
  await type(page, 'Y213');
  assert.deepEqual(await headings(page), [
    'Typed or scanned · 1',
    'Photo 2 · 2 markers',
    'Photo 1 · 4 markers',
    'Typed or scanned · 1 to choose',
  ]);
  // a screen reader hears each heading whole
  assert.equal(
    await page.$eval('#scList .scgroup', (h) => h.tagName + ' ' + h.parentElement.id),
    'LI scList',
  );
  // a reload: the headings back, numbered 1.. in turn (saved as photos 3 and 5 here), the next photo after them
  await page.evaluate(() => {
    scanList.forEach((e) => {
      if (e.photo === 1) e.photo = 3;
      else if (e.photo === 2) e.photo = 5;
    });
    scanRender();
  });
  assert.match(await page.evaluate(() => localStorage.getItem('ms-scan-list')), /"p":5/);
  await page.reload();
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  assert.deepEqual(await headings(page), [
    'Typed or scanned · 1',
    'Photo 2 · 2 markers',
    'Photo 1 · 4 markers',
    'Typed or scanned · 1 to choose',
  ]);
  assert.equal(await page.evaluate(() => ocrPhotos), 2);
  await read(page, ['B115'], false, true);
  assert.deepEqual((await headings(page))[0], 'Photo 3 · 1 marker');
  // a batch's summary numbers its photos as the headings do: on from the photos before it
  const sum = await page.evaluate(() => {
    ocrShow(
      '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
        '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
    );
    ocrQ = {
      files: [1, 2],
      k: 2,
      n0: 4,
      per: [
        { added: 1, asked: 0 },
        { added: 2, asked: 1 },
      ],
      stop: false,
      t0: Date.now(),
    };
    const r = { n: 5, done: true, added: 2, asked: 1, p: {} };
    ocrStatus(r);
    const t = document.getElementById('ocrSum').textContent;
    ocrQ = null;
    ocrHide();
    return t;
  });
  assert.match(sum, /Photo 4: 1 added · Photo 5: 2 added, 1 to choose/);
  // Find mode: no headings
  assert.deepEqual(errors, []);
});

// (v318.7 debug) Clear list numbers the next photo 1 again (it had said "Photo 3" over an empty list); and with Scan
// open here while another tab answers a question and deletes its picture, this tab's list, still asking it, puts the
// picture back when it's saved (it had been left with none after a reload)
test('Clear list numbers photos afresh; a picture another tab deleted is put back by this tab’s list, which still asks', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await read(page, ['B015'], false);
  await read(page, ['B03'], true, true);
  assert.deepEqual((await headings(page))[0], 'Photo 2 · 1 marker · 1 to choose');
  await page.waitForFunction(() => scanPics.writes === 1);
  // another tab answered "808" and deleted its picture; its list saved (this tab hears a storage event)
  await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('ms-scan-pics');
        r.onsuccess = () => {
          const t = r.result.transaction('p', 'readwrite');
          t.objectStore('p').delete('confirm 808');
          t.oncomplete = () => {
            r.result.close();
            res();
          };
        };
      }),
  );
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ms-scan-list' })));
  // this tab's list, still asking, saved: the picture's put back
  await page.evaluate(() => scanRender());
  await page.waitForFunction(() => scanPics.writes === 2, null, { timeout: 5000 });
  const kept = await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('ms-scan-pics');
        r.onsuccess = () => {
          const q = r.result.transaction('p').objectStore('p').get('confirm 808');
          q.onsuccess = () => {
            r.result.close();
            res(!!(q.result && q.result.crop));
          };
        };
      }),
  );
  assert.equal(kept, true, 'the picture is in the database again');
  // Clear list: the next photo is Photo 1
  await page.click('#scClear');
  await page.click('#scClear');
  await idle(page);
  assert.equal(await page.evaluate(() => scanList.length), 0);
  await read(page, ['B111'], false, true);
  assert.equal(await page.evaluate(() => scanList[0].photo), 1, 'numbered 1');
  assert.deepEqual(errors, []);
});
