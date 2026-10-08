// v308.6: Scan Text on iPadOS 27 puts each cap's text in as a composition and takes it out itself when the cap leaves
// view (Ben's log from the Scan Text Bench). The app cleared the box mid-composition, which stopped Scan Text after the
// first cap. Now the box is left alone during a composition; each cap is read as it arrives.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function opened() {
  const a = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
  await welcome(a.page, 'look');
  await idle(a.page);
  await a.page.click('#mCollection');
  await idle(a.page);
  await a.page.click('#scanOpen');
  await idle(a.page);
  return a;
}
// what the iPad sent (Ben's log): compositionstart, then the text as insertCompositionText; when the cap goes,
// deleteCompositionText to empty, then compositionend
const capIn = (page, t) =>
  page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    b.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: t }));
    b.value = t;
    b.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        isComposing: true,
        data: t,
      }),
    );
  }, t);
const capOut = (page) =>
  page.evaluate(() => {
    const b = document.getElementById('scBox');
    b.value = '';
    b.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteCompositionText', isComposing: true }),
    );
    b.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
  });
const list = (page) => page.$$eval('#scList .sccode', (l) => l.map((x) => x.textContent));

test('Scan Text’s composition: each cap read, the box left for Scan Text to clear, cap after cap', async () => {
  const { page, errors } = await opened();
  await capIn(page, 'RV33 Thistle');
  await page.waitForTimeout(1300);
  assert.deepEqual(await list(page), ['RV33']);
  assert.equal(await page.inputValue('#scBox'), 'RV33 Thistle', 'not cleared by the app mid-composition');
  await capOut(page);
  await capIn(page, 'RV311 Pansy');
  await page.waitForTimeout(900);
  await capOut(page);
  // a cap re-read with a misreading, then the next cap
  await capIn(page, 'RV39 Bright Fuchsia');
  await page.waitForTimeout(300);
  await capOut(page);
  await capIn(page, 'RV39 angr uchsa');
  await page.waitForTimeout(900);
  await capOut(page);
  await capIn(page, 'RV310 Fuchsia');
  await page.waitForTimeout(900);
  assert.deepEqual(await list(page), ['RV310', 'RV39', 'RV311', 'RV33']);
  // text with no code, mid-composition: left alone too (it had been cleared after 1.5 s)
  await capOut(page);
  await capIn(page, 'Fuchsia');
  await page.waitForTimeout(1900);
  assert.equal(await page.inputValue('#scBox'), 'Fuchsia');
  await capOut(page);
  assert.deepEqual(errors, []);
});

test('Add while Scan Text’s text is still in the box: it is read and added (Add then closes Scan, as before)', async () => {
  const { page, errors } = await opened();
  await capIn(page, 'YR58');
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.has('Ohuhu|YR58')), true);
  assert.equal(await page.isVisible('#scanOverlay'), false);
  // opened again: a new Scan Text session, read as usual
  await page.click('#scanOpen');
  await idle(page);
  await capIn(page, 'YR59 Cantaloupe');
  await page.waitForTimeout(900);
  assert.deepEqual(await list(page), ['YR59']);
  assert.deepEqual(errors, []);
});

test('without a composition (an older iPadOS, a paste, typing) the box still clears after a read, as before', async () => {
  const { page, errors } = await opened();
  await page.evaluate(() => {
    const b = document.getElementById('scBox');
    b.value = 'B015 Celadon Blue';
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  });
  await page.waitForTimeout(1200);
  assert.deepEqual(await list(page), ['B015']);
  assert.equal(await page.inputValue('#scBox'), '');
  assert.deepEqual(errors, []);
});
