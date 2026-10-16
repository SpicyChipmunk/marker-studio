// v318.7 Scan, section 10, in the browser: when the list and your collection cover nearly all of a set, the set is
// named with what's missing — on Done's card after a photo and on a list's card, "Ciao 36 - Set A: all but 3 are here
// — G00, G05 and G17. Not read, or not yours?" with Add these 3 (to the list) and I don't have them (remembered); after
// a sweep, in Add's toast, with Open for the card, which is also kept for the next opening of Scan. Nothing enters the
// collection from any of them by itself. Each test fails on v318.6 (no such card or toast line).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
// Ciao 36 Set A but six of it (E00 E21 E29 G00 G05 G17), as the collection
const CIAO_OWNED =
  '100 B00 B24 B29 BG01 BG09 BG23 BV00 BV02 BV08 C-3 E37 R20 R29 R32 RV02 RV04 RV10 V04 V09 V12 Y00 Y06 Y17 YG03 YG06 YG11 YR02 YR07 YR20'
    .split(' ')
    .map((c) => 'Copic|' + c);
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
    owned: owned,
    saved: [],
  }),
});
async function opened(owned) {
  const a = await openApp({ width: 820, height: 1180, storage: stored(owned) });
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
// a cap read by Scan Text: the text arrives without a key and holds still
const scanText = async (page, text) => {
  await page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value = t;
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }, text);
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
  await idle(page);
};
const card = async (page) => ({
  big: await page.textContent('#scStat b'),
  small: await page.textContent('#scStat .sctext > span'),
  head: (await page.locator('#scStat .scphead').count()) ? await page.textContent('#scStat .scphead') : null,
  buttons: await page.$$eval('#scStat .scpick button', (bs) => bs.map((b) => b.textContent)),
});
const listCodes = (page) => page.evaluate(() => scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code)));
// a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: the codes given; the reader's view with
// its buttons left as a real photo leaves it, for Done
function photo(page, codes) {
  return page.evaluate((codes) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 400;
    const g = cv.getContext('2d');
    g.fillStyle = '#888';
    g.fillRect(0, 0, 400, 400);
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
    r.img = { w: 400, h: 400, data: g.getImageData(0, 0, 400, 400) };
    ocrRun = r;
    ocrShow(
      '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
        '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
    );
    const lines = codes.map((t, k) => ({
      id: k + 1,
      look: 1,
      text: t,
      conf: 0.98,
      unsure: false,
      nameOf: 0,
      box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
    }));
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    scanRender();
    return scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0));
  }, codes);
}

test('Done’s card after a photo names the set nearly all here with what’s missing; Add these 3 puts them in the list, not the collection; said once', async () => {
  const { page, errors } = await opened(CIAO_OWNED);
  assert.deepEqual(await photo(page, ['E00', 'E21', 'E29']), ['E29@1', 'E21@1', 'E00@1']);
  await page.click('#ocrDone');
  await idle(page);
  const c = await card(page);
  assert.equal(c.big, 'From the photo: 3 added to the list');
  assert.equal(c.head, 'Ciao 36 - Set A: all but 3 are here — G00, G05 and G17. Not read, or not yours?');
  assert.deepEqual(c.buttons, ['Add these 3', 'I don’t have them']);
  await page.click('#scStat .scpick button:has-text("Add these 3")');
  await idle(page);
  assert.deepEqual(await listCodes(page), ['G17', 'G05', 'G00', 'E29', 'E21', 'E00']);
  assert.equal(await page.textContent('#scAdd'), 'Add 6 to my collection');
  assert.equal(await page.evaluate(() => state.owned.size), 30, 'nothing in the collection by itself');
  assert.equal((await card(page)).big, '3 added to the list');
  assert.equal((await card(page)).small, 'Ciao 36 - Set A · Check them below, then Add');
  // the set complete now (listed or yours): another photo's Done has no set to name
  await photo(page, ['E00']);
  await page.click('#ocrDone');
  await idle(page);
  assert.equal((await card(page)).head, null);
  assert.deepEqual(errors, []);
});

test('a list’s card names it too; I don’t have them is remembered for the set, through a reload', async () => {
  const { page, errors } = await opened(CIAO_OWNED);
  await type(page, 'E00 E21 E29');
  let c = await card(page);
  assert.equal(c.big, '3 added to the list');
  assert.equal(c.head, 'Ciao 36 - Set A: all but 3 are here — G00, G05 and G17. Not read, or not yours?');
  await page.click('#scStat .scpick button:has-text("I don’t have them")');
  await idle(page);
  c = await card(page);
  assert.equal(c.big, 'Not yours, then');
  assert.equal(c.small, 'Ciao 36 - Set A’s missing markers aren’t asked about again');
  assert.equal(
    await page.evaluate(() => localStorage.getItem('ms-scan-nothave')),
    '["Copic|Ciao 36 - Set A"]',
  );
  assert.deepEqual(await listCodes(page), ['E29', 'E21', 'E00']);
  // not again: the list cleared and pasted again, and after a reload
  await page.click('#scClear');
  await page.click('#scClear');
  await idle(page);
  await type(page, 'E00 E21 E29');
  assert.equal((await card(page)).head, null);
  await page.reload();
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await page.click('#scClear');
  await page.click('#scClear');
  await idle(page);
  await type(page, 'E00 E21 E29');
  assert.equal((await card(page)).big, '3 added to the list');
  assert.equal((await card(page)).head, null);
  assert.deepEqual(errors, []);
});

// Honolulu 120 but eight of it (B08 B111 B114 B115 B310 B315 B411 B415), as the collection
const H_OUT = ['B08', 'B111', 'B114', 'B115', 'B310', 'B315', 'B411', 'B415'].map((c) => 'Ohuhu|' + c);
async function honolulu() {
  const { page } = await openApp({ width: 820, height: 1180, storage: stored(['Ohuhu|R014']) });
  const keys = await page.evaluate(() => presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 120')));
  await page.close();
  return keys.filter((k) => H_OUT.indexOf(k) < 0);
}
// three caps swept, then Add: the toast names what wasn't read (more than four: their number), with Open
async function swept(page) {
  for (const c of ['B08', 'B111', 'B114']) await scanText(page, c);
  assert.deepEqual(await listCodes(page), ['B114', 'B111', 'B08']);
  assert.equal((await card(page)).head, null, 'a cap at a time: no card for the set');
  await page.click('#scAdd');
  await idle(page);
  const toast = (await page.textContent('#msToast')).replace(/\u00a0/g, ' ');
  assert.match(toast, /^Added 3 markers to your collection · Honolulu 120: 5 weren’t read/);
  assert.deepEqual(await page.$$eval('#msToast button', (bs) => bs.map((b) => b.textContent)), [
    'Undo',
    'Open',
  ]);
  assert.equal(await page.evaluate(() => state.owned.size), 116);
}
const HEAD = 'Honolulu 120: all but 5 are here — B115, B310, B315, B411 and B415. Not read, or not yours?';

test('after a sweep, Add’s toast names what wasn’t read; the card with Add these N is kept for the next opening of Scan, once; nothing enters the collection by itself', async () => {
  const { page, errors } = await opened(await honolulu());
  await swept(page);
  // the toast let go by: Scan opened from Markers has the card
  await page.waitForTimeout(300);
  await scanFromMarkers(page);
  await idle(page);
  const c = await card(page);
  assert.equal(c.big, 'Ready');
  assert.equal(c.head, HEAD);
  assert.deepEqual(c.buttons, ['Add these 5', 'I don’t have them']);
  await page.click('#scStat .scpick button:has-text("Add these 5")');
  await idle(page);
  assert.deepEqual(await listCodes(page), ['B415', 'B411', 'B315', 'B310', 'B115']);
  assert.equal(await page.textContent('#scAdd'), 'Add 5 to my collection');
  assert.equal(await page.evaluate(() => state.owned.size), 116, 'to the list, not the collection');
  // closed and opened again: the card isn't kept twice (the list is)
  await page.click('#scClose');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  assert.equal((await card(page)).head, null);
  assert.deepEqual(await listCodes(page), ['B415', 'B411', 'B315', 'B310', 'B115']);
  // Add: the set complete, nothing more named, and no Open
  await page.click('#scAdd');
  await idle(page);
  assert.match(
    (await page.textContent('#msToast')).replace(/\u00a0/g, ' '),
    /^Added 5 markers to your collection Undo$/,
  );
  assert.deepEqual(await page.$$eval('#msToast button', (bs) => bs.map((b) => b.textContent)), ['Undo']);
  assert.equal(await page.evaluate(() => state.owned.size), 121);
  assert.deepEqual(errors, []);
});

test('the toast’s Open opens Scan with the card', async () => {
  const { page, errors } = await opened(await honolulu());
  await swept(page);
  await page.click('#toastAct2');
  await page.waitForSelector('#scanOverlay.on');
  await idle(page);
  assert.equal((await card(page)).head, HEAD);
  await page.click('#scStat .scpick button:has-text("I don’t have them")');
  await idle(page);
  assert.equal((await card(page)).big, 'Not yours, then');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-nothave')), '["Ohuhu|Honolulu 120"]');
  assert.deepEqual(await listCodes(page), []);
  assert.deepEqual(errors, []);
});

// (v318.7 debug) an opening in Find mode (Scan 3 caps) doesn't show the card, and doesn't let it go either: the next
// ordinary opening has it
test('the card kept after a sweep survives an opening of Scan in Find mode', async () => {
  const { page, errors } = await opened(await honolulu());
  await swept(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => openScan({ find: { brand: 'Ohuhu' } }));
  await page.waitForSelector('#scanOverlay.on');
  await idle(page);
  assert.equal((await card(page)).head, null, 'not in Find mode');
  await page.click('#scClose');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  assert.equal((await card(page)).head, HEAD);
  assert.deepEqual(errors, []);
});
