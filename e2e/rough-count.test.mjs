// v318 review: Smooth them brings markers the guide doesn't use, so the page could end up with more markers than
// "Markers in this guide" says, without a word. Its line now says how many more before the tap ("Smooth them (+1 marker)",
// read out "Smooth them, with 1 more marker on the page"), and the page has that many more after it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, sectionPoint, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

const pageCount = (page) =>
  page.evaluate(() => {
    const A = __mstest.assignData.assign;
    return new Set(__mstest.assignData.order.filter((l) => A[l]).map((l) => A[l].mkey)).size;
  });
const said = async (page) => {
  const t = await page.textContent('#sfRoughGo');
  const m = /^Smooth them(?: \(\+(\d+) markers?\))?$/.exec(t.trim());
  assert.ok(m, 'the button says: ' + t);
  return m[1] ? +m[1] : 0;
};

test('a small Gradient zone at the top of the sample: the line says how many more markers, and the page has them', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const top = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order
      .map((l) => [l, t.comps[l].cy])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map((x) => x[0]);
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfZoneAdd');
  await idle(page);
  for (const l of top) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  await page.click('#sfZoneDone');
  await idle(page);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
  await idle(page);
  assert.ok(await page.isVisible('#sfRoughGo'), 'rough spots to smooth');
  const n = await said(page),
    before = await pageCount(page);
  assert.ok(n > 0, 'it brings at least one');
  await page.click('#sfRoughGo');
  await idle(page);
  assert.equal(await pageCount(page), before + n, `${before} + ${n} markers on the page`);
  assert.match(
    (await page.textContent('#sfStat')).replace(/\s+/g, ' '),
    new RegExp(`${before + n} markers`),
    'the tool row says so',
  );
  assert.deepEqual(errors, []);
});

test('all of a big collection in play: the count it says is the count it adds', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.gradIncl = null;
    state.owned = new Set(defaultOwned());
    save();
    t.coll = sfCollection();
    t.styleVars.limitN = 999;
    t.reassign();
  });
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  const n = await said(page),
    before = await pageCount(page);
  await page.click('#sfRoughGo');
  await idle(page);
  assert.equal(await pageCount(page), before + n, `${before} + ${n}`);
  assert.deepEqual(errors, []);
});
