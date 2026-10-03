// v303: Scan or type codes in the dialog — text left in the box is read on Add, a card's Add clears the text it was
// about, the brand switch answers what it can and says so, the list outlasts a reload, a phone at a large text size
// gets the code over its name, Add leaves focus where it was opened from and the sets' ticks follow.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function opened(o = {}) {
  const a = await openApp(o);
  await welcome(a.page, 'look'); await idle(a.page);
  await a.page.click('#mCollection'); await idle(a.page);
  await a.page.click('#scanOpen'); await idle(a.page);
  return a;
}
const type = async (page, text) => { await page.fill('#scBox', text); await page.press('#scBox', 'Enter'); await idle(page); };
const list = (page) => page.$$eval('#scList .scrow', (rs) => rs.map((r) => (r.classList.contains('scask') ? '?' : r.querySelector('.sccode').textContent)));

test('Add reads what’s still in the box (typed without Enter); a card’s Add takes its text out of the box', async () => {
  const { page, errors } = await opened();
  // (nothing new in the list yet: Add is on while there's text in the box)
  assert.equal(await page.isDisabled('#scAdd'), true);
  await page.fill('#scBox', 'B015');
  assert.equal(await page.isDisabled('#scAdd'), false);
  await page.click('#scAdd'); await idle(page);
  assert.ok(await page.evaluate(() => state.owned.has(mkey(COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'B015')))), 'B015 added');
  // a name only: a card with Add; after it, the box is clear for the next code
  await page.click('#scanOpen'); await idle(page);
  await type(page, 'Honey Brown');
  assert.equal(await page.inputValue('#scBox'), 'Honey Brown', 'kept, nothing in it to clear the box for');
  await page.click('#scStat .scpick button'); await idle(page);
  assert.equal(await page.inputValue('#scBox'), '', 'the name’s gone from the box');
  await type(page, 'YG06');
  assert.deepEqual((await list(page)).filter((x) => x !== '?'), ['E49']);
  assert.ok((await list(page)).includes('?'), 'YG06: Ohuhu or Copic, asked');
  assert.deepEqual(errors, []);
});

test('the brand switch answers the questions it can, says so, and goes back to the box', async () => {
  const { page, errors } = await opened();
  await type(page, 'B04');
  assert.deepEqual(await list(page), ['?']);
  await page.click('#scBrand button[data-b="Copic"]'); await idle(page);
  assert.deepEqual(await list(page), ['B04']);
  assert.match(await page.textContent('#scStat'), /1 question answered/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
  // with Ohuhu chosen, Copic's C-3 read beside an Ohuhu code waits as "another brand"; Either brand answers it
  await page.click('#scBrand button[data-b="Ohuhu"]'); await idle(page);
  await type(page, 'E19 C-3');
  assert.ok((await list(page)).includes('?'));
  await page.click('#scBrand button[data-b=""]'); await idle(page);
  assert.deepEqual((await list(page)).sort(), ['B04', 'C-3', 'E19']);
  assert.deepEqual(errors, []);
});

test('the list outlasts a reload (Safari reloading a tab put away mid-sweep)', async () => {
  const { page, errors } = await opened();
  await type(page, 'E19 Dried Sage');
  await type(page, 'B04');
  await page.reload(); await idle(page);
  await page.click('#mCollection'); await idle(page);
  await page.click('#scanOpen'); await idle(page);
  assert.deepEqual(await list(page), ['?', 'E19']);
  assert.equal(await page.textContent('#scAdd'), 'Add 1 to my collection');
  // emptied by Add
  await page.click('#scAdd'); await idle(page);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list') || '[]').filter((e) => !e.ask).length), 0);
  assert.deepEqual(errors, []);
});

test('a phone at the largest text size: a row’s code over its name, the name the row’s width', async () => {
  const { page, errors } = await opened({ width: 320, height: 640 });
  await page.evaluate(() => { document.documentElement.style.setProperty('--tpx0', '1.6px'); });
  await type(page, 'YG06 Sugarcane');
  await idle(page);
  const r = await page.$eval('#scList .scrow', (row) => { const c = row.querySelector('.sccode').getBoundingClientRect(), n = row.querySelector('.scname').getBoundingClientRect(); return { cTop: c.top, nTop: n.top, nW: n.width, rowW: row.getBoundingClientRect().width, over: row.scrollWidth > row.clientWidth + 1 }; });
  assert.ok(r.nTop > r.cTop + 5, 'the name under the code');
  assert.ok(r.nW > r.rowW * 0.5, 'the name has room: ' + JSON.stringify(r));
  assert.equal(r.over, false);
  assert.deepEqual(errors, []);
});

test('Add into an empty collection: focus goes back to the button it was opened from, and the sets’ counts follow', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.evaluate(() => { state.owned.clear(); save(); });
  await page.click('#mCollection'); await idle(page);
  await page.click('#scanOpen'); await idle(page);
  await type(page, 'E19 Dried Sage');
  await page.click('#scAdd'); await idle(page); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'scanOpen');
  assert.deepEqual(errors, []);
});

test('several read at once, all already yours: said so, not “added” with the success sound', async () => {
  const { page, errors } = await opened();
  // two codes of the Honolulu 120 set, only Ohuhu's
  const two = await page.evaluate(() => { const ix = scanIndex(), c = (k) => COLORS[keyIdx(k)].code, own = [...state.owned].filter((k) => { const s = scanKey(c(k)); return /\D/.test(s) && ix.byCode.get(s).length === 1 && !ix.byOld.has(s); }); return own.slice(0, 2).map(c); });
  await type(page, two.join(' '));
  const s = await page.textContent('#scStat');
  assert.match(s, /All already in your collection/);
  assert.equal(await page.getAttribute('#scStat', 'class'), 'scstat same');
  assert.deepEqual(errors, []);
});
