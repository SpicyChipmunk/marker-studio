// v309.2 (reviewer 3): Markers and Palette.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const seeded = (owned, extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ohuhu-hb320-picker-v3': JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned, saved: [], ...extra }),
});

test('Palette with only a Colorless Blender (or dry markers): says so and leads to Markers, not "Clear filters"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: seeded(['Ohuhu|0', 'Ohuhu|R16'], { ink: { 'Ohuhu|R16': 'dry' } }) });
  await idle(page);
  await page.click('[data-go="palette"]');
  await idle(page);
  const say = (await page.textContent('#palNone')).replace(/\s+/g, ' ');
  assert.match(say, /None of your markers lays down colour/);
  assert.doesNotMatch(say, /filters/);
  await page.click('#palNoneClear');
  await idle(page);
  assert.equal(await page.evaluate(() => state.mode), 'collection');
  assert.deepEqual(errors, []);
});

test('Palette with a filter that leaves none still offers Clear filters', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: seeded(['Ohuhu|R16']) });
  await idle(page);
  await page.click('[data-go="palette"]');
  await idle(page);
  // (only the Blue family: none of R16's)
  await page.evaluate(() => {
    fgTap('fam', 'Blue');
    filterChanged();
  });
  await idle(page);
  const say = (await page.textContent('#palNone')).replace(/\s+/g, ' ');
  assert.match(say, /No markers match these filters · Clear filters/);
  assert.deepEqual(errors, []);
});
