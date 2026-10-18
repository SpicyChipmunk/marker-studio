// v318.18 in the browser: Theme, its own row of twelve under Lean towards (Any, Cool, Warm), each with a strip of its
// colours from your markers; 3 across on a phone, 4 on an iPad; tap again for none; a temperature that empties the
// theme turns it off in the same step. Fails on v318.17.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
const cols = (page) =>
  page.$eval('#sfTheme', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length);

test('Theme: twelve in order, 3 across on a phone and 4 on an iPad, strips, tap on and off, Undo', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await tab(page, 'colours');
  const chips = await page.$$eval('#sfTheme button', (b) =>
    b.map((x) => ({
      v: x.dataset.v,
      name: x.textContent,
      pressed: x.getAttribute('aria-pressed'),
      strip: !!x.querySelector('.sfstrip[aria-hidden="true"]'),
      grad: /linear-gradient/.test(getComputedStyle(x.querySelector('.sfstrip')).backgroundImage),
    })),
  );
  assert.deepEqual(
    chips.map((c) => c.name),
    [
      'Blossom',
      'Tropical',
      'Autumn',
      'Winter',
      'Sunset',
      'Desert',
      'Forest',
      'Ocean',
      'Coral',
      'Berry',
      'Galaxy',
      'Twilight',
    ],
  );
  assert.ok(
    chips.every((c) => c.pressed === 'false' && c.strip && c.grad),
    JSON.stringify(chips),
  );
  assert.equal(await page.getAttribute('#sfTheme', 'aria-labelledby'), 'sfThemeLbl');
  assert.equal(await cols(page), 3);
  // nothing cut off, no sideways scroll
  const fit = await page.evaluate(() => {
    const g = document.getElementById('sfTheme');
    return {
      clipped: [...g.querySelectorAll('.sfthn')].filter(
        (n) => n.getBoundingClientRect().right > n.parentNode.getBoundingClientRect().right + 1,
      ).length,
      page: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.deepEqual(fit, { clipped: 0, page: false });
  // on
  await page.click('#sfTheme [data-v="coral"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.theme), 'coral');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Theme: Coral');
  assert.equal(await page.getAttribute('#sfTheme [data-v="coral"]', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#sfPoolCt'), / in Coral/);
  // every marker on the page is one of the theme's
  const inPool = await page.evaluate(() => {
    const t = __mstest,
      pool = new Set(t.colour.poolFor('all', 'coral').map((m) => m.mkey));
    return t.assignData.order.every((l) => pool.has(t.assignData.assign[l].mkey));
  });
  assert.equal(inPool, true);
  // off again: tapped a second time
  await page.click('#sfTheme [data-v="coral"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.theme), '');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Theme off');
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.theme), 'coral');
  // an iPad: four across
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  await tab(page, 'colours');
  assert.equal(await cols(page), 4);
  assert.deepEqual(errors, []);
});

test('Warm with a cool theme: greyed chips say why; Warm tapped with Ocean on turns Ocean off, one Undo step', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'colours');
  await page.click('#sfTheme [data-v="ocean"]');
  await idle(page);
  await page.click('#sfPal [data-v="warm"]');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.palette, __mstest.styleVars.theme]), [
    'warm',
    '',
  ]);
  assert.match(
    await page.textContent('#sfThemeNote'),
    /Ocean is off: next to none of its colours are warm\./,
  );
  assert.match(
    await page.textContent('#sfThemeNote'),
    /Greyed themes have next to none of your warm colours\./,
  );
  assert.equal(await page.getAttribute('#sfTheme [data-v="ocean"]', 'aria-disabled'), 'true');
  assert.equal(await page.getAttribute('#sfTheme [data-v="sunset"]', 'aria-disabled'), null);
  // a greyed one tapped: nothing changes, a note says why (aria-disabled: still a button)
  await page.click('#sfTheme [data-v="ocean"]', { force: true });
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.theme), '');
  // Undo: Any and Ocean back together
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.palette, __mstest.styleVars.theme]), [
    'all',
    'ocean',
  ]);
  assert.equal(await page.$('#sfThemeNote'), null, 'the note goes with it');
  assert.deepEqual(errors, []);
});
