// v318.24 in the browser: the Print sheet shows the pages in order under its choices, as many as the summary says,
// following each choice, without pushing the Paper choices down or the sheet sideways.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

async function printSheet(page) {
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
}
const order = (page) =>
  page.evaluate(() => {
    const o = document.getElementById('sfPrOrd'),
      n = +/<b>(\d+) page/.exec(document.getElementById('sfPrSum').innerHTML)[1];
    return {
      n: n,
      tiles: o.querySelectorAll('.sfprordp').length,
      words: [...o.querySelectorAll('.sfprordw')].map((w) => w.textContent),
      said: o.querySelector('.sfsr').textContent,
      kinds: __mstest.pdfKinds.map((k) => k.k),
      // under the choices, before the note on what's printed; not in the summary's live region
      after: o.previousElementSibling.classList.contains('swopts') && o.nextElementSibling.id === 'sfPrWhat',
      live: !!o.closest('[aria-live]'),
      hidden: o.querySelector('.sfprordr').getAttribute('aria-hidden'),
    };
  });

test('the Print sheet: the pages in order, as the summary counts them, following each choice', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await printSheet(page);
  let o = await order(page);
  assert.equal(o.tiles, o.n, 'a page shape for each page');
  assert.equal(o.kinds.length, o.n);
  assert.equal(o.kinds[0], 'pic');
  assert.ok(o.kinds.includes('key'));
  assert.equal(o.words[0], 'Picture');
  assert.match(o.said, /^Page 1: your picture with (codes|numbers)[;.]/);
  assert.ok(!/; Pages/.test(o.said), 'lower case after the first');
  assert.equal(o.after, true);
  assert.equal(o.live, false, 'not read out on every tap');
  assert.equal(o.hidden, 'true');
  // Key + reference with no labels: one page, the picture beside the key
  await page.click('[data-pwhat="ref"]');
  await page.click('[data-plabels="none"]');
  o = await order(page);
  assert.equal(o.kinds[0], 'refkey');
  assert.equal(o.words[0], 'Picture + key');
  assert.equal(o.tiles, o.n);
  // the test strip: only its pages
  await page.click('[data-pwhat="strip"]');
  o = await order(page);
  assert.ok(o.kinds.length >= 1 && o.kinds.every((k) => k === 'strip'));
  assert.deepEqual(o.words, ['Test strip']);
  assert.equal(o.tiles, o.n);
  assert.deepEqual(errors, []);
});

test('the pages in order on a small phone at large text: on one sheet, nothing pushed sideways, Paper where it was', async () => {
  for (const scale of [1, 1.6]) {
    const { page, errors } = await openApp({ width: 320, height: 568 });
    if (scale > 1)
      await page.evaluate((s) => (document.documentElement.style.fontSize = 16 * s + 'px'), scale);
    await printSheet(page);
    const r = await page.evaluate(() => {
      const sh = document.getElementById('sfSheet'),
        o = document.getElementById('sfPrOrd'),
        paperTop = () => document.querySelector('#sfSheet [data-paper]').getBoundingClientRect().top;
      const withRow = paperTop();
      o.style.display = 'none';
      const without = paperTop();
      o.style.display = '';
      const b = o.getBoundingClientRect(),
        s = sh.getBoundingClientRect();
      return {
        moved: withRow - without,
        right: b.right - s.right,
        wide: sh.scrollWidth - sh.clientWidth,
        tiles: o.querySelectorAll('.sfprordp').length,
      };
    });
    assert.ok(r.tiles >= 2, 'tiles: ' + r.tiles);
    assert.equal(r.moved, 0, 'Paper not moved (' + scale + '×)');
    assert.ok(
      r.right <= 1 && r.wide <= 1,
      'nothing past the sheet’s edge (' + scale + '×): ' + JSON.stringify(r),
    );
    assert.deepEqual(errors, []);
    await page.context().close();
  }
});
