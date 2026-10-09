// v309.1 (review 4): the welcome. The toast's Undo of a set, tapped after the welcome went on (another set, extra
// markers), leaves no way Back to "120 markers added"; the chosen brand's small print on the find step reads at 4.5:1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const where = (page) =>
  page.evaluate(() => ({
    step: document.querySelector('#welcome .wcard').dataset.step,
    owned: state.owned.size,
    focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
  }));

test('Undo of a set after the welcome went on: Back no longer shows it as added', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  // I have another set, then the toast's Undo (still showing)
  await page.click('#wcMoreSet');
  await idle(page);
  await page.click('#msToast button:text-is("Undo")');
  await idle(page);
  assert.deepEqual(await where(page), { step: 'wcStep1', owned: 0, focus: 'wcT1' });
  // Back: to the ways in, where the set was added from, not to "120 markers added … Anything else?"
  await page.click('#wcStep1 .wcback');
  await idle(page);
  assert.deepEqual(await where(page), { step: 'wcStep0', owned: 0, focus: 'wcHaveSet' });
  // and through the find step too: extra markers › … the set list › Find it from 3 caps, then Undo
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  await page.click('#wcMoreSet');
  await page.click('#wcToFind');
  await idle(page);
  await page.click('#msToast button:text-is("Undo")');
  await idle(page);
  assert.deepEqual(await where(page), { step: 'wcStepFind', owned: 0, focus: 'wcTF' });
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal((await where(page)).step, 'wcStep1');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal((await where(page)).step, 'wcStep0');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the chosen brand’s small print on "Let’s find your set" reads at 4.5:1 or better', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await idle(page);
  const cr = await page.evaluate(() => {
    const p = (c) => c.match(/[\d.]+/g).map(Number);
    const L = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (t, b) => [0, 1, 2].map((i) => t[i] * (t[3] ?? 1) + b[i] * (1 - (t[3] ?? 1)));
    const el = document.querySelector('#wcFBrand [aria-pressed="true"] small'),
      layers = [];
    for (let a = el; a; a = a.parentElement) {
      const c = p(getComputedStyle(a).backgroundColor);
      if ((c[3] ?? 1) > 0) layers.push(c);
      if ((c[3] ?? 1) === 1) break;
    }
    const bg = layers.reverse().reduce((b, c) => over(c, b), [0, 0, 0]),
      fg = over(p(getComputedStyle(el).color), bg),
      a = L(fg),
      b = L(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert.ok(cr >= 4.5, 'contrast ' + cr.toFixed(2));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a question left in Scan from the welcome, answered through the toast’s Open: the welcome counts it, and its Undo goes back to the count before', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneScan');
  // R014 is Ohuhu's alone; Y28 is a code in both brands: asked
  for (const c of ['R014', 'Y28']) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '1 marker added');
  // the toast's Open: Scan again, the question answered, Add
  await page.click('#msToast button:text-is("Open")');
  await idle(page);
  await page.click('#scList .scchoose >> nth=0');
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 2);
  assert.equal(await page.textContent('#wcT2'), '1 more marker added');
  assert.equal(await page.textContent('#wcDone'), '2 markers are in your collection. Anything else?');
  // its Undo: the welcome says what it said before
  await page.click('#msToast button:text-is("Undo")');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 1);
  assert.equal(await page.evaluate(() => document.querySelector('#welcome .wcard').dataset.step), 'wcStep2');
  assert.equal(await page.textContent('#wcT2'), '1 marker added');
  assert.equal(await page.textContent('#wcDone'), '1 marker is in your collection. Anything else?');
  assert.deepEqual(errors, []);
  await ctx.close();
});
