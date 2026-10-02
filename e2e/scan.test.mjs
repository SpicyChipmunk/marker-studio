// Markers › Scan or type codes (v296): codes typed, pasted or read off the caps with the iPad's Scan Text collect in a
// list to check, and Add puts the new ones in the collection.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

// an app with the Honolulu 120 set, on Markers, with the dialog open
async function opened() {
  const a = await openApp();
  await welcome(a.page, 'look'); await idle(a.page);
  await a.page.click('#mCollection'); await idle(a.page);
  await a.page.click('#scanOpen'); await idle(a.page);
  return a;
}
const type = async (page, text) => { await page.fill('#scBox', text); await page.press('#scBox', 'Enter'); await idle(page); };
// what Scan Text does: puts what the camera reads into the box (not a letter at a time), and swaps it as you aim
const scanText = async (page, text) => {
  await page.evaluate((t) => { const b = document.getElementById('scBox'); b.value = t; b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' })); }, text);
};
const paste = (page, text) => page.evaluate((t) => { const d = new DataTransfer(); d.setData('text/plain', t); document.getElementById('scBox').dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d })); }, text);
const list = (page) => page.$$eval('#scList .scrow', (rs) => rs.map((r) => r.querySelector('.sccode').textContent + (r.classList.contains('mine') ? ' (mine)' : '')));
const owns = (page, k) => page.evaluate((k) => state.owned.has(k), k);
const stat = (page) => page.textContent('#scStat');

test('typed codes and a pasted list collect in a list to check; Add puts the new ones in the collection, Undo takes them out', async () => {
  const { page, errors } = await opened();
  assert.equal(await page.isVisible('#scanOverlay'), true);
  assert.equal(await page.textContent('#scAdd'), 'Add to my collection');
  assert.equal(await page.isDisabled('#scAdd'), true);
  // a mix-up put right, with its name: B015 (not in the 120 set)
  await type(page, 'BO15 Celadon Blue');
  assert.deepEqual(await list(page), ['B015']);
  assert.match(await stat(page), /B015 Celadon Blue.*Added to the list/);
  assert.equal(await page.inputValue('#scBox'), '', 'the box is ready for the next');
  // one already in the collection is listed as yours and not counted
  await type(page, 'R014');
  assert.deepEqual(await list(page), ['R014 (mine)', 'B015']);
  assert.match(await stat(page), /Already in your collection/);
  // the same again: said so, listed once
  await type(page, 'B015');
  assert.match(await stat(page), /Already in the list/);
  assert.equal((await list(page)).length, 2);
  // a pasted list: every code in it, at once
  await paste(page, 'E19 Dried Sage\nE49 Honey Brown\nnot a code');
  await idle(page);
  assert.deepEqual(await list(page), ['E49', 'E19', 'R014 (mine)', 'B015']);
  assert.match(await stat(page), /2 added to the list/);
  assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '4 markers · 3 new');
  assert.equal(await page.textContent('#scAdd'), 'Add 3 to my collection');
  // nothing in it is a code: said so
  await type(page, 'hello');
  assert.match(await stat(page), /No marker code found/);
  // ✕ takes one off the list
  await page.click('#scList .scrow:nth-child(1) .scdel'); await idle(page);
  assert.deepEqual(await list(page), ['E19', 'R014 (mine)', 'B015']);
  await page.click('#scAdd'); await idle(page);
  assert.equal(await page.isVisible('#scanOverlay'), false);
  assert.equal(await owns(page, 'Ohuhu|B015'), true);
  assert.equal(await owns(page, 'Ohuhu|E19'), true);
  assert.equal(await owns(page, 'Ohuhu|E49'), false);
  assert.match(await page.textContent('#msToast'), /Added 2 markers to your collection/);
  // it was saved
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).owned.includes('Ohuhu|B015')), 'saved');
  await page.click('#toastAct'); await idle(page);
  assert.equal(await owns(page, 'Ohuhu|B015'), false);
  assert.equal(await owns(page, 'Ohuhu|R014'), true, 'Undo leaves what was there before');
  // Undo brings the list back too, to put right and add again
  await page.click('#scanOpen'); await idle(page);
  assert.deepEqual(await list(page), ['E19', 'R014 (mine)', 'B015']);
  // Add empties it
  await page.click('#scAdd'); await idle(page);
  await page.click('#scanOpen'); await idle(page);
  assert.deepEqual(await list(page), []);
  assert.deepEqual(errors, []);
});

test('Scan Text: what arrives as you aim is read once it holds still, the box clears for the next cap; typing waits for Enter', async () => {
  const { page, errors } = await opened();
  // aiming: the text changes, then holds still
  await scanText(page, 'B0');
  await scanText(page, 'B015 Cela');
  await scanText(page, 'B015 Celadon Blue');
  await idle(page);
  assert.deepEqual(await list(page), ['B015'], 'read once, when it held still');
  assert.equal(await page.inputValue('#scBox'), '');
  await scanText(page, 'E19 Dried Sage'); await idle(page);
  assert.deepEqual(await list(page), ['E19', 'B015']);
  // nothing readable while aiming: no complaint (the camera is still moving)
  await scanText(page, 'Ohuhu'); await idle(page);
  assert.doesNotMatch(await stat(page), /No marker code/);
  // typing a letter at a time: nothing until Enter (Y, YG, YG0 aren't what was meant)
  await page.fill('#scBox', '');
  await page.type('#scBox', 'YG06 Sugarcane'); await idle(page);
  assert.equal((await list(page)).length, 2, 'not read while typing');
  await page.press('#scBox', 'Enter'); await idle(page);
  assert.deepEqual(await list(page), ['YG06 (mine)', 'E19', 'B015']);
  assert.deepEqual(errors, []);
});

test('asks when it cannot be sure, in the list (sweeping on loses no question); the brand chosen settles codes and is remembered', async () => {
  const { page, errors } = await opened();
  // B04: Ohuhu Pale Cyan or Copic Tahitian Blue — a question waiting in the list, not counted until answered
  await type(page, 'B04');
  assert.match(await stat(page), /B04: .*\?/);
  assert.equal(await page.locator('#scList .scask').count(), 1);
  assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '1 to choose');
  assert.equal(await page.isDisabled('#scAdd'), true);
  // reading on doesn't lose it, and the same question isn't asked twice
  await type(page, 'B015');
  await type(page, 'B04');
  assert.equal(await page.locator('#scList .scask').count(), 1);
  assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '1 marker · 1 to choose');
  await page.click('#scList .scask .scchoose:has-text("Copic")'); await idle(page);
  assert.deepEqual(await list(page), ['B04', 'B015']);
  assert.match(await page.textContent('#scList .scrow'), /Copic/);
  // only the name read: offered by the card above the list
  await type(page, 'Honey Brown');
  assert.match(await stat(page), /Is it E49 Honey Brown\?/);
  await page.click('#scStat .scpick button'); await idle(page);
  assert.deepEqual(await list(page), ['E49', 'B04', 'B015']);
  // upside down: E19 reads "6L3" (Ohuhu E19, Copic E19 or E79); with Ohuhu chosen it's E19, added and marked
  await page.click('#scBrand button[data-b="Ohuhu"]');
  assert.equal(await page.getAttribute('#scBrand button[data-b="Ohuhu"]', 'aria-pressed'), 'true');
  await type(page, '6L3');
  assert.deepEqual(await list(page), ['E19', 'E49', 'B04', 'B015']);
  assert.match(await page.textContent('#scList .scrow'), /read upside down/);
  // YR213 upside down with its Y lost reads as R213: asked, in the list
  await type(page, 'ELZと');
  assert.match(await stat(page), /Upside down: which one\?/);
  await page.click('#scList .scask .scchoose:has-text("YR213")'); await idle(page);
  assert.equal((await list(page))[0], 'YR213');
  // a code the brand chosen doesn't have: said so, and can be added anyway
  await type(page, 'C-3');
  assert.match(await stat(page), /Copic C-3 /);
  assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
  await page.click('#scStat .scpick button'); await idle(page);
  assert.equal((await list(page))[0], 'C-3');
  // the brand chosen is remembered
  await page.keyboard.press('Escape'); await idle(page);
  await page.reload(); await idle(page);
  await page.click('#mCollection'); await idle(page);
  await page.click('#scanOpen'); await idle(page);
  assert.equal(await page.getAttribute('#scBrand button[data-b="Ohuhu"]', 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('words on the caps are not codes; holding one cap in view says it once', async () => {
  const { page, errors } = await opened();
  // names and words that look a little like codes: Egg (E66), Bog (B06), No.3 (N-0), Sea upside down (Y35)
  for (const w of ['Robin Egg Blue', 'Bog Mist Green', 'Neutral Gray No.3', 'Sea']) { await scanText(page, w); await idle(page); }
  assert.deepEqual(await list(page), []);
  // the camera held on one cap: the same text comes again after the box clears; one beep, not one a second
  await page.evaluate(() => { window.__said = 0; const el = document.getElementById('scStat'); new MutationObserver(() => window.__said++).observe(el, { childList: true }); });
  for (let k = 0; k < 3; k++) { await scanText(page, 'B015 Celadon Blue'); await idle(page); }
  assert.deepEqual(await list(page), ['B015']);
  assert.equal(await page.evaluate(() => window.__said), 1, 'said once');
  // typed again on purpose: said
  await type(page, 'B015');
  assert.match(await stat(page), /Already in the list/);
  assert.equal(await page.inputValue('#scBox'), '', 'the box clears for a marker already listed, too');
  assert.deepEqual(errors, []);
});

test('two caps held in view say so once; a question answered isn’t asked again; choosing a brand answers its questions; focus stays in the box', async () => {
  const { page, errors } = await opened();
  await page.evaluate(() => { window.__said = 0; new MutationObserver(() => window.__said++).observe(document.getElementById('scStat'), { childList: true }); });
  for (let k = 0; k < 3; k++) { await scanText(page, 'B015 Celadon Blue E19 Dried Sage'); await idle(page); }
  assert.deepEqual(await list(page), ['E19', 'B015']);
  assert.equal(await page.evaluate(() => window.__said), 1, 'said once');
  // B04 asked, answered, read again by Scan Text with the cap still in view: not asked again (v299: typed again, it
  // is asked: that could be the other brand's B04)
  await type(page, 'B04');
  await page.click('#scList .scask .scchoose:has-text("Copic")'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox', 'back in the box');
  await scanText(page, 'B04'); await idle(page);
  assert.equal(await page.locator('#scList .scask').count(), 0);
  // a question between brands, then the brand chosen: answered
  await type(page, 'B05');
  assert.equal(await page.locator('#scList .scask').count(), 1);
  await page.click('#scBrand button[data-b="Ohuhu"]'); await idle(page);
  assert.equal(await page.locator('#scList .scask').count(), 0);
  assert.equal((await list(page))[0], 'B05');
  assert.match(await page.textContent('#scList .scrow'), /Ohuhu/);
  // ✕: back in the box
  await page.click('#scList .scrow .scdel'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
  // text with nothing to read in it doesn't stay to run into the next cap's
  await scanText(page, 'Ohuhu'); await idle(page, 2200);
  assert.equal(await page.inputValue('#scBox'), '');
  assert.deepEqual(errors, []);
});

test('a whole collection pasted at once: every marker listed, quickly', async () => {
  const { page, errors } = await opened();
  const codes = await page.evaluate(() => COLORS.filter((c) => c.brand === 'Ohuhu').map((c) => c.code + ' ' + c.name).join('\n'));
  const t0 = Date.now();
  await paste(page, codes); await idle(page);
  const ms = Date.now() - t0;
  const n = await page.evaluate(() => COLORS.filter((c) => c.brand === 'Ohuhu').length);
  assert.equal((await list(page)).length, n);
  assert.ok(ms < 8000, ms + ' ms');
  assert.match(await page.textContent('#scAdd'), new RegExp('Add ' + (n - 120) + ' to my collection'));
  assert.deepEqual(errors, []);
});

test('a marker on the To buy list is taken off it when added (bought), and Undo puts it back', async () => {
  const { page, errors } = await opened();
  await page.evaluate(() => { addWish('Ohuhu|B015', 'test', true); save(); });
  await type(page, 'B015');
  await page.click('#scAdd'); await idle(page);
  assert.match(await page.textContent('#msToast'), /Added 1 marker to your collection \(1 off your To buy list\)/);
  assert.equal(await page.evaluate(() => isWished('Ohuhu|B015')), false);
  await page.click('#toastAct'); await idle(page);
  assert.equal(await page.evaluate(() => isWished('Ohuhu|B015')), true);
  assert.equal(await owns(page, 'Ohuhu|B015'), false);
  assert.deepEqual(errors, []);
});

test('Escape closes it with focus back on its button; the list is kept until added', async () => {
  const { page, errors } = await opened();
  await type(page, 'B015');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.isVisible('#scanOverlay'), false);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'scanOpen');
  await page.click('#scanOpen'); await idle(page);
  assert.deepEqual(await list(page), ['B015']);
  // a tap outside the card closes it too
  await page.mouse.click(5, 830); await idle(page);
  assert.equal(await page.isVisible('#scanOverlay'), false);
  assert.deepEqual(errors, []);
});

test('the welcome offers it for markers bought one at a time: Markers, with the dialog open and the box ready', async () => {
  const { page, errors } = await openApp();
  assert.ok(await page.isVisible('#welcome'));
  await page.click('#wcScan'); await idle(page);
  assert.equal(await page.isVisible('#welcome'), false);
  assert.equal(await page.evaluate(() => state.mode), 'collection');
  assert.ok(await page.isVisible('#scanOverlay'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
  await type(page, 'B015');
  await page.click('#scAdd'); await idle(page);
  assert.deepEqual(await page.evaluate(() => [...state.owned]), ['Ohuhu|B015']);
  // the welcome doesn't come back
  await page.reload(); await idle(page);
  assert.equal(await page.isVisible('#welcome'), false);
  assert.deepEqual(errors, []);
});

