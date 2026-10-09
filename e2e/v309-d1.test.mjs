// v309.1 (review 1): the welcome's steps. Back puts the keyboard back on what led on, wherever a step was reached from
// (not only from the first step), and a set or caps already yours say so rather than "0 more markers added".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const type = async (page, codes) => {
  for (const c of codes) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
};
// what has the keyboard, and whether it is on screen
const focus = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      id: (a && a.id) || (a && a.tagName),
      shown: !!a && a !== document.body && a.getClientRects().length > 0,
    };
  });

test('Back from a step reached from "Anything else?", the set list or the result puts the keyboard back on what led there', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneScan');
  await type(page, ['R014', 'BG314']);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  // I have another set › Back
  await page.click('#wcMoreSet');
  await page.click('#wcStep1 .wcback');
  await idle(page);
  assert.deepEqual(await focus(page), { id: 'wcMoreSet', shown: true });
  // I have extra markers › Escape
  await page.click('#wcMoreExtra');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.deepEqual(await focus(page), { id: 'wcMoreExtra', shown: true });
  // the list › Find it from 3 caps › Back
  await page.click('#wcMoreSet');
  await page.click('#wcToFind');
  await page.click('#wcStepFind .wcback');
  await idle(page);
  assert.deepEqual(await focus(page), { id: 'wcToFind', shown: true });
  // Find › Scan › the result › None of these › Back, then Back to the find step
  await page.click('#wcToFind');
  await page.click('#wcFCount [data-n="3"]');
  await page.click('#wcFindNext');
  await type(page, ['R014', 'Y28', 'BG314']);
  await page.click('#scAdd');
  await idle(page);
  await page.click('#wcFindNone');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.deepEqual(await focus(page), { id: 'wcFindNone', shown: true });
  await page.keyboard.press('Escape');
  await idle(page);
  assert.deepEqual(await focus(page), { id: 'wcFindNext', shown: true });
  // and from the first step's ways in, as before
  await page.keyboard.press('Escape');
  await idle(page);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => document.querySelector('#welcome .wcard').dataset.step), 'wcStep2');
  assert.deepEqual(await focus(page), { id: 'wcMoreSet', shown: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a set already in your collection, added again: said so, not "0 more markers added"', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  await page.click('#wcMoreSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 121); // (with the blender that comes with it, v309.1)
  assert.equal(await page.textContent('#wcT2'), 'Nothing new to add');
  assert.equal(
    await page.textContent('#wcDone'),
    'Honolulu 120 was already in your collection. Anything else?',
  );
  // a set with some new: as before
  await page.click('#wcMoreSet');
  await page.check('#wcSets input[data-i="4"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.match(await page.textContent('#wcT2'), /^\d+ more markers added$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
