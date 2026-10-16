// v318.7 Scan, sections 4 and 5, in the browser: after a question's answered the keyboard's place follows the keyboard
// (the box again only when it had the keyboard as the tap began; else the next question's first answer, then Add, then
// the count), the answer takes the question's place, and each chip is described by its question; the larger view of a
// cap answers the question with its chips or Not this cap, closes only by the picture, outside, Not now, Escape or
// Back, and ignores the tail of the tap that opened it. Each test fails on v318.6.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

// an app with the Honolulu 120 set, Either brand chosen, Scan open
async function opened(opts = {}) {
  const a = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' }, ...opts });
  await welcome(a.page, 'look');
  await idle(a.page);
  await a.page.click('#mCollection');
  await idle(a.page);
  await scanFromMarkers(a.page);
  await idle(a.page);
  return a;
}
const type = async (page, text) => {
  await page.fill('#scBox', text);
  await page.press('#scBox', 'Enter');
  await idle(page);
};
const rows = (page) =>
  page.$$eval('#scList .scrow', (rs) =>
    rs.map((r) => (r.querySelector('.sccode') ? r.querySelector('.sccode').textContent : r.querySelector('b').textContent.replace(/: .*$/, '?'))),
  );
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a.id || a.className + (a.dataset.n != null ? '#' + a.dataset.n : '') + ':' + a.textContent.trim().slice(0, 30);
  });
const blur = (page) => page.evaluate(() => document.activeElement.blur());

test('after an answer: back in the box when it had the keyboard as the tap began; else the next question’s first answer, nearest below then above; then Add; then the count', async () => {
  const { page, errors } = await opened();
  // three codes both brands use, asked: newest first
  for (const c of ['B04', 'B05', 'YR07']) await type(page, c);
  assert.deepEqual(await rows(page), ['YR07?', 'B05?', 'B04?']);
  // the box has the keyboard (typing): answer B05 → back in the box, as v303 did for a sweep
  assert.equal(await active(page), 'scBox');
  await page.click('#scList .scask[data-n="1"] .scchoose:has-text("Copic")');
  await idle(page);
  assert.equal(await active(page), 'scBox', 'the box had the keyboard');
  // (v318.7) and the answer in the question's place, not at the top
  assert.deepEqual(await rows(page), ['YR07?', 'B05', 'B04?']);
  // the keyboard down (nothing focused, as on an iPad after a photo): answer B04 (last) → nearest below: none; above: YR07
  await blur(page);
  await page.click('#scList .scask[data-n="2"] .scchoose:has-text("Ohuhu")');
  await idle(page);
  assert.match(await active(page), /^scchoose#0:YR07 /, 'the question above');
  assert.deepEqual(await rows(page), ['YR07?', 'B05', 'B04']);
  // Enter on that chip (no pointerdown: the box hadn't the keyboard): no question left → Add, which has 3 to add
  await page.keyboard.press('Enter');
  await idle(page);
  assert.deepEqual(await rows(page), ['YR07', 'B05', 'B04']);
  assert.equal(await active(page), 'scAdd');
  // a question whose answer is already yours, nothing else new: Add is off → the count over the list
  await page.evaluate(() => {
    scanList = [];
    scanRender();
  });
  await type(page, 'YG06');
  await blur(page);
  await page.click('#scList .scask .scchoose:has-text("Ohuhu")');
  await idle(page);
  assert.equal(await page.isDisabled('#scAdd'), true);
  assert.equal(await active(page), 'scCount');
  assert.match((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), /^1 marker/);
  assert.deepEqual(errors, []);
});

test('a question answered from the middle: the nearest question below it next; × on a question or a marker row follows the keyboard too', async () => {
  const { page, errors } = await opened();
  for (const c of ['B04', 'B05', 'YR07', 'R014']) await type(page, c);
  assert.deepEqual(await rows(page), ['R014', 'YR07?', 'B05?', 'B04?']);
  await blur(page);
  await page.click('#scList .scask[data-n="1"] .scchoose:has-text("Copic")');
  await idle(page);
  assert.match(await active(page), /^scchoose#2:B05 /, 'the question below');
  // × on a question with the keyboard down: the next question (below it: B04)
  await blur(page);
  await page.click('#scList .scask[data-n="2"] .scdel');
  await idle(page);
  assert.deepEqual(await rows(page), ['R014', 'YR07', 'B04?']);
  assert.match(await active(page), /^scchoose#2:B04 /);
  // × on a marker row with the keyboard down: the row that takes its place, its ×
  await blur(page);
  await page.click('#scList .scrow[data-n="0"] .scdel');
  await idle(page);
  assert.deepEqual(await rows(page), ['YR07', 'B04?']);
  assert.equal(await active(page), 'scdel#0:');
  // × on the last question: none left, so Add (on: Copic YR07 is new)
  await blur(page);
  await page.click('#scList .scask[data-n="1"] .scdel');
  await idle(page);
  assert.deepEqual(await rows(page), ['YR07']);
  assert.equal(await active(page), 'scAdd');
  // the last marker row taken off: the one above it
  await type(page, 'B000');
  assert.deepEqual(await rows(page), ['B000', 'YR07']);
  await blur(page);
  await page.click('#scList .scrow[data-n="1"] .scdel');
  await idle(page);
  assert.deepEqual(await rows(page), ['B000']);
  assert.equal(await active(page), 'scdel#0:');
  // the only row taken off with the keyboard down: nothing left and Add off, so the line that says so (v318.7 debug:
  // the count, empty then, had the keyboard's place and a screen reader heard nothing)
  await blur(page);
  await page.click('#scList .scrow[data-n="0"] .scdel');
  await idle(page);
  assert.deepEqual(await rows(page), []);
  assert.equal(await active(page), 'scEmpty');
  assert.match(await page.textContent('#scEmpty'), /^Nothing yet/);
  await type(page, 'B000');
  // with the box focused (typing on a Mac): × goes back to the box
  await page.focus('#scBox');
  await page.click('#scList .scrow[data-n="0"] .scdel');
  await idle(page);
  assert.equal(await active(page), 'scBox');
  assert.deepEqual(errors, []);
});

test('each chip is described by its question, for a screen reader', async () => {
  const { page, errors } = await opened();
  await type(page, 'B04');
  const d = await page.$$eval('#scList .scask .scchoose', (bs) =>
    bs.map((b) => document.getElementById(b.getAttribute('aria-describedby')).textContent),
  );
  assert.deepEqual(d.map((t) => t.replace(/: .*$/, '?')), ['B04?', 'B04?']);
  assert.deepEqual(errors, []);
});

// the sweep's switch to both brands (section 6): its row's Keep Ohuhu and × follow the keyboard too
test('Keep Ohuhu and the row’s × follow the keyboard: the first question when the box hadn’t it', async () => {
  const KEY = 'ohuhu-hb320-picker-v3';
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-last-ver': 'v318',
      [KEY]: JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'],
        saved: [],
      }),
    },
  });
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const scanText = async (text) => {
    await page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
    await idle(page);
  };
  await scanText('YR07');
  await scanText('E71 Champagne');
  await scanText('BG11 Moon White');
  assert.ok(await page.$('#scList .scswitch'), 'switched');
  // Keep Ohuhu, the box with the keyboard (a sweep): back in the box
  assert.equal(await active(page), 'scBox');
  await page.click('#scList .scswitch .scswkeep');
  await idle(page);
  assert.equal(await active(page), 'scBox');
  assert.equal(await page.$('#scList .scswitch'), null);
  // switched again after two more Copic caps; × on the row with the keyboard down: the first question (YR07, held)
  await scanText('B000');
  await scanText('C-3');
  assert.ok(await page.$('#scList .scswitch'), 'switched again');
  await blur(page);
  await page.click('#scList .scswitch .scswx');
  await idle(page);
  assert.equal(await page.$('#scList .scswitch'), null);
  assert.match(await active(page), /^scchoose#\d+:YR07 /, 'the first question');
  assert.deepEqual(errors, []);
});

// a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: eight Ohuhu codes and "808" (asked
// about, with its cap's picture), plus more lines when given. keep: the list as it is (another photo after the first),
// and the reader's view with its buttons, as a real photo leaves it
function read(page, more, keep) {
  return page.evaluate(
    ([more, keep]) => {
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
      const r = { n: ++ocrPhotos, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '' };
      r.img = { w: 400, h: 400, data: data };
      ocrRun = r;
      if (keep)
        ocrShow(
          '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
            '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
        );
      const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115'].concat(more || []).map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
      }));
      lines.push({ id: 20, look: 1, text: '808', conf: 0.97, unsure: false, nameOf: 0, box: [200, 200, 100, 40, 0], turn: 0 });
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      if (!keep) ocrRun = null;
      scanRender();
      return scanList.map((e) => (e.ask ? e.title : COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
    },
    [more || null, !!keep],
  );
}
const zoomOpen = async (page) => {
  await page.click('#scList .sccropped .sccrop');
  await page.waitForSelector('.sczoom.on');
  await page.waitForTimeout(350);
};

test('the larger view: the question’s answers under the picture; a chip answers it (in place, the photo kept) and closes; focus follows the keyboard', async () => {
  const { page, errors } = await opened();
  const list = await read(page);
  assert.equal(list[0], '“808” read: is it this one?@1');
  await zoomOpen(page);
  assert.equal(await page.locator('.sczoom .scchoose').count(), 1);
  assert.match(await page.textContent('.sczoom .scchoose'), /^B08 .* · Ohuhu/);
  assert.equal(await page.textContent('.sczoom [data-a="not"]'), 'Not this cap');
  assert.equal(await page.textContent('.sczoom [data-a="close"]'), 'Not now');
  assert.equal(await active(page), 'btn-primary:Not now');
  await page.click('.sczoom .scchoose');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  const after = await page.evaluate(() => scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + e.photo));
  assert.equal(after[0], 'B08@1', 'answered in its place, its photo kept');
  assert.equal(after.length, 9);
  assert.equal(await page.locator('#scList .scask').count(), 0);
  // no question left: Add, which has new markers
  assert.equal(await page.isDisabled('#scAdd'), false);
  assert.equal(await active(page), 'scAdd');
  assert.match(await page.textContent('#scStat'), /B08 .*Already in your collection/);
  assert.deepEqual(errors, []);
});

test('the larger view: Not this cap takes the question off; the picture, outside, Not now and Escape close it, the card’s words don’t', async () => {
  const { page, errors } = await opened();
  await read(page);
  // the title: stays open
  await zoomOpen(page);
  await page.click('.sczoom .dsub');
  await page.waitForTimeout(100);
  assert.ok(await page.isVisible('.sczoom'), 'a tap on the words doesn’t close it');
  // the picture: closes, focus back on the picture in the list
  await page.click('.sczoom img');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement.className), 'sccrop');
  // outside the card
  await zoomOpen(page);
  await page.mouse.click(5, 5);
  await page.waitForSelector('.sczoom', { state: 'detached' });
  // Not now
  await zoomOpen(page);
  await page.click('.sczoom [data-a="close"]');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  // Escape
  await zoomOpen(page);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  assert.equal(await page.locator('#scList .scask').count(), 1, 'the question still waits');
  // Not this cap: the question goes, not asked again while the cap's in view; focus on to Add
  await zoomOpen(page);
  await page.click('.sczoom [data-a="not"]');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  assert.equal(await page.locator('#scList .scask').count(), 0);
  assert.equal(await page.evaluate(() => scanList.length), 8);
  assert.ok(await page.evaluate(() => scanAnsweredAt.has('confirm 808')));
  assert.equal(await active(page), 'scAdd');
  assert.deepEqual(errors, []);
});

test('the larger view ignores the tail of the tap that opened it, and says when the question has gone meanwhile', async () => {
  const { page, errors } = await opened();
  await read(page);
  // a chip tapped within 300 ms of opening: nothing
  await page.click('#scList .sccropped .sccrop');
  await page.waitForSelector('.sczoom.on');
  await page.click('.sczoom .scchoose', { timeout: 250 }).catch(() => {});
  await page.waitForTimeout(50);
  assert.ok(await page.isVisible('.sczoom'), 'still open');
  assert.equal(await page.locator('#scList .scask').count(), 1, 'not answered');
  // the question answered meanwhile (a cap read, a photo): the chip closes the view and says so
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    scanList = scanList.filter((e) => !e.ask);
    scanRender();
  });
  await page.click('.sczoom .scchoose');
  await page.waitForSelector('.sczoom', { state: 'detached' });
  assert.match(await page.textContent('#scStat'), /That question’s gone/);
  assert.equal(await page.evaluate(() => scanList.length), 8);
  assert.deepEqual(errors, []);
});

test('Undo this photo gives a question the photo answered back at its own photo’s group', async () => {
  const { page, errors } = await opened();
  // photo 1: the tray and "808" (B08, asked); a typed question of no photo above it; photo 2 reads B08 plainly: the
  // question's every answer is in the list, so it goes, kept for Undo
  await read(page);
  await type(page, 'B04');
  const two = await read(page, ['B08'], true);
  assert.deepEqual(two.slice(0, 2).map((t) => t.replace(/: .*\?/, '?')), ['B08@2', 'B04?']);
  assert.match(two[2], /@1$/, 'then photo 1’s');
  assert.equal(two.filter((t) => /808/.test(t)).length, 0, 'answered by photo 2');
  assert.equal(await page.evaluate(() => ocrAnswered.length), 1);
  await page.click('#ocrUndo');
  await idle(page);
  const after = await page.evaluate(() => scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0)));
  assert.deepEqual(after.slice(0, 2), ['?@0', '?@1'], 'back at the top of photo 1’s group, under the typed question');
  assert.match(after[2], /^B\d+@1$/);
  assert.equal(after.filter((t) => /@2$/.test(t)).length, 0, 'photo 2’s out');
  assert.deepEqual(errors, []);
});
