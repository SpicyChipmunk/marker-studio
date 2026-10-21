// v318.29 (fixer Z1) in the browser: codes typed from the welcome put Add's Undo on "Anything else?" as a link, as a
// set's and the chart's are (v318.26), not a toast over the step's choices (on a 375 x 667 phone with 1.3x text it
// sat on Look around first, and a tap there took the markers back out); and "Which R27?" asked before the reading
// switched to both brands is answered by Copic tapped. Each fails on v318.29's HEAD.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openAtScale, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const typeCode = async (page, c) => {
  await page.fill('#scBox', c);
  await page.press('#scBox', 'Enter');
  await idle(page);
};

test('the welcome’s typed codes: no toast over "Anything else?", its Undo a link that takes them back out', async () => {
  for (const [width, height, scale] of [
    [375, 667, 1.3],
    [320, 568, 1.6],
  ]) {
    const { ctx, page, errors } = await openAtScale(scale, { width, height });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await page.click('#scBrand button[data-b="Copic"]');
    for (const c of 'B000 B23 YG17 G28 R27 E00 V12 C-3 N-5 Y08'.split(' ')) await typeCode(page, c);
    await page.click('#scAdd');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = document.getElementById('msToast'),
        b = document.getElementById('wcLook');
      b.scrollIntoView({ block: 'nearest' });
      const rc = b.getBoundingClientRect(),
        at = document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2);
      return {
        step: document.querySelector('.wcard').dataset.step,
        toast: !!(t && t.classList.contains('on')),
        look: at === b || b.contains(at),
        owned: state.owned.size,
      };
    });
    assert.deepEqual(r, { step: 'wcStep2', toast: false, look: true, owned: 10 }, width + ' wide');
    assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take these 10 markers back out');
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0, 'Undo took them back out');
    assert.equal(await page.evaluate(() => document.querySelector('.wcard').dataset.step), 'wcStepOne');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Honolulu 120, then B000, R27, YG17 typed: "Which R27?" offers Copic R27, and Copic tapped answers it', async () => {
  const { ctx, page, errors } = await openApp({ width: 375, height: 667 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcMoreExtra');
  await page.click('#wcOneType');
  for (const c of ['B000', 'R27', 'YG17']) await typeCode(page, c);
  const q = await page.$$eval('#scList li', (ls) =>
    ls.map((l) => l.textContent).find((t) => /Which R27\?/.test(t)),
  );
  assert.match(q || '', /Cadmium Red/, 'Copic R27 offered');
  await page.click('#scBrand button[data-b="Copic"]');
  await idle(page);
  const list = await page.$$eval('#scList li', (ls) => ls.map((l) => l.textContent));
  assert.ok(!list.some((t) => /Which R27\?/.test(t)), 'the question answered');
  assert.ok(
    list.some((t) => /R27/.test(t) && /Cadmium Red/.test(t)),
    'Copic R27 in the list',
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});
