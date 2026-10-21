// v318.29 fixer Z2: the Colours tab's count of markers left out a marker you pinned that the guide isn't laid from (Q2).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

test('Q2: a section changed to a marker the guide isn’t laid from: Markers in this guide counts it, as the list under it does', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  const pageCount = async () =>
    +/^(\d+) markers? on this page/.exec((await page.textContent('#sfMkList')).trim())[1];
  const label = async () => +/(\d+)\D*$/.exec(await page.textContent('#sfMkNlbl'))[1];
  assert.equal(await label(), await pageCount(), 'the two counts agree to start with');
  // the biggest section, changed (Change colour pins it) to a grey or brown the guide's pattern doesn't draw from
  // (one whose marker other sections have too, so the page has a marker more after; the guide laid afresh first, by a
  // step of the count and back, so it isn't the guide as it was opened, whose count was its own already)
  await page.click('#sfMkMinus');
  await idle(page);
  await page.click('#sfMkPlus');
  await idle(page);
  const l = await page.evaluate(() => {
    const A = __mstest.assignData.assign,
      n = {};
    for (const s in A) n[A[s].mkey] = (n[A[s].mkey] || 0) + 1;
    return __mstest.assignData.order
      .filter((s) => n[A[s].mkey] > 1)
      .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0];
  });
  const k = await page.evaluate(() => {
    const used = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey));
    return sfCollection().find((m) => !used.has(m.mkey) && /^(CG|WG|BG9|E)/.test(m.mkey.split('|').pop()))
      .mkey;
  });
  const pt = await sectionPoint(page, l);
  await page.mouse.click(pt.x, pt.y);
  await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet', { state: 'visible' });
  await page.locator(`#sfSheet .sfsw[data-k="${k}"]`).first().click();
  await page.click('#sfPopConfirm');
  await idle(page);
  const n = await pageCount();
  assert.equal(
    await label(),
    n,
    `Markers in this guide says “${await page.textContent('#sfMkNlbl')}” over “${n} markers on this page”`,
  );
  assert.deepEqual(errors, []);
});
