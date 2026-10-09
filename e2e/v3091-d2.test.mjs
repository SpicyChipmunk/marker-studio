// v309.1 (review 2): colouring and output, and the Library. "Did any run low?" › Another… with the code of your
// Colorless Blender (the Ohuhu sets come with one since v309) said it wasn't one of your markers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// the sample, every section ticked but the first marker's, then that marker's Mark all: Page finished
async function finished(page) {
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const k = await page.evaluate(() => {
    const t = __mstest,
      k = t.assignData.assign[t.assignData.order[0]].mkey;
    t.assignData.order.forEach((l) => {
      if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
    });
    t.updateProgress();
    return k;
  });
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await page.click('#sfMarkAll');
  await idle(page);
}

test('run low › Another…: your Colorless Blender’s code says what it is, not “isn’t one of your markers”', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await finished(page);
  // (Honolulu 120 from the welcome brings its blender)
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0')));
  await page.click('#sfLowA [data-lmore]');
  await idle(page);
  await page.fill('#sfLowInA', '0');
  await page.press('#sfLowInA', 'Enter');
  await idle(page);
  assert.equal(await page.textContent('#sfLowLA'), '0 is your Colorless Blender: mark it in Markers');
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|0']), undefined, 'not marked');
  // not yours: as before
  await page.evaluate(() => {
    state.owned.delete('Ohuhu|0');
    save();
  });
  await page.fill('#sfLowInA', '0');
  await page.press('#sfLowInA', 'Enter');
  await idle(page);
  assert.equal(await page.textContent('#sfLowLA'), '0 isn’t one of your markers');
  assert.deepEqual(errors, []);
});
