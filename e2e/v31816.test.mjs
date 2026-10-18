// v318.16, the guide's controls tidied: Shading as one row (Off and the styles; Custom a line, not a button; Shadows
// only as Highlights › None), More options on a phone (Shading and Colours fold their fine controls; wider, nothing
// folds), Radial's rings on one line, choices 44px. Fails on v318.15.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
const row = (page) =>
  page.$$eval('#sfShade button', (b) =>
    b.map((x) => x.dataset.v + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')),
  );

test('Shading: one row, Off and four styles; a style is one Undo step; a slider moved is Custom; Off keeps the amounts', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await tab(page, 'shading');
  assert.deepEqual(await row(page), ['off*', 'soft', 'dramatic', 'rounded', 'neuro']);
  assert.equal(await page.$('#sfShPre'), null, 'no second row');
  await page.click('#sfShade [data-v="dramatic"]');
  await idle(page);
  assert.deepEqual(await row(page), ['off', 'soft', 'dramatic*', 'rounded', 'neuro']);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Shading: Dramatic');
  assert.equal(await page.isVisible('#sfShCustom'), false);
  // a slider moved: no style chosen, and the line says Custom
  await page.$eval('#sfRound', (r) => {
    r.value = '20';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page);
  assert.deepEqual(await row(page), ['off', 'soft', 'dramatic', 'rounded', 'neuro']);
  assert.match(await page.textContent('#sfShCustom'), /^Custom: your own amounts/);
  // Off, then Undo: the amounts as they were
  const r0 = await page.evaluate(() => __mstest.zsh(0).round);
  await page.click('#sfShade [data-v="off"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Shading: Off');
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeMode), 'full');
  assert.equal(await page.evaluate(() => __mstest.zsh(0).round), r0);
  assert.deepEqual(errors, []);
});

test('Shadows only is Highlights › None: the mode, its line, no highlight amount; another highlight turns them back on', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="soft"]');
  await idle(page);
  await page.selectOption('#sfHiStyle', 'none');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeMode), 'shadow');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: None (shadows only)');
  assert.equal(await page.inputValue('#sfHiStyle'), 'none');
  assert.equal(await page.$('#sfShHi'), null, 'no highlight amount');
  assert.match(await page.textContent('#sfShCustom'), /^Shadows only/);
  await page.selectOption('#sfHiStyle', 'warm');
  await idle(page);
  assert.equal(await page.evaluate(() => [__mstest.shadeMode, __mstest.zsh(0).hilite].join()), 'full,warm');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: Warmer');
  assert.deepEqual(errors, []);
});

test('More options on a phone: Shading and Colours fold their fine controls; the bar opens them; wider, nothing folds', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, moreShut: true });
  await sampleGuide(page);
  await tab(page, 'shading');
  // shading off: nothing to fold
  assert.equal(await page.$('#sfMore-shading'), null);
  await page.click('#sfShade [data-v="soft"]');
  await idle(page);
  assert.equal(await page.getAttribute('#sfMore-shading', 'aria-expanded'), 'false');
  for (const id of ['#sfRound', '#sfShLines', '#sfTex']) assert.equal(await page.isVisible(id), false, id);
  assert.equal(await page.isVisible('#sfShLight'), true, 'Light from stays');
  await page.click('#sfMore-shading');
  assert.equal(await page.getAttribute('#sfMore-shading', 'aria-expanded'), 'true');
  for (const id of ['#sfRound', '#sfShLines', '#sfTex']) assert.equal(await page.isVisible(id), true, id);
  // the keyboard stays on the bar
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore-shading');
  // kept open as the controls are drawn again (a style tapped)
  await page.click('#sfShade [data-v="rounded"]');
  await idle(page);
  assert.equal(await page.isVisible('#sfRound'), true);
  // Colours: Mood and the count stay; Filters, Temperature and Include fold
  await tab(page, 'colours');
  assert.equal(await page.getAttribute('#sfMore-colours', 'aria-expanded'), 'false');
  for (const id of ['#sfFiltToggle', '#sfPal', '#sfPoolCt'])
    assert.equal(await page.isVisible(id), false, id);
  assert.equal(await page.isVisible('#sfSrc'), true, 'Colours from stays');
  assert.equal(await page.isVisible('#sfMkList'), true);
  await page.click('#sfMore-colours');
  assert.equal(await page.isVisible('#sfPal'), true);
  // wider: no bar, nothing folded
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  await idle(page);
  assert.equal(await page.$('#sfMore-colours'), null);
  await tab(page, 'shading');
  assert.equal(await page.$('#sfMore-shading'), null);
  assert.equal(await page.isVisible('#sfRound'), true);
  assert.deepEqual(errors, []);
});

test('Radial’s rings on one line; the guide’s choices are 44px', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await page.click('#sfFam [data-v="gradient"]');
  await idle(page);
  await page.click('#sfShape [data-v="radial"]');
  await idle(page);
  const r = await page.evaluate(() => {
    const k = document.getElementById('sfRingKind'),
      bs = [...k.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
    return {
      tops: new Set(bs.map((b) => Math.round(b.top))).size,
      h: Math.round(bs[0].height),
      lbl: k.querySelector('.sfringl').textContent,
    };
  });
  assert.deepEqual(r, { tops: 1, h: 44, lbl: 'Rings' });
  await page.click('#sfRingKind [data-v="rings"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Rings: Follow the drawing');
  assert.deepEqual(errors, []);
});
