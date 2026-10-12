// v315 (Q11): a Gradient's markers seen only on specks are named on the Pattern tab, last, with what spreads them and
// Show them, which rings their sections (Hide them, or the plan laid again, takes the rings away). Not when scattered,
// nor for a marker only on sections you pinned. Fails on v314.1, which said nothing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, letterGuide, welcome, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

const lay = (page, o) =>
  page.evaluate((o) => {
    Object.assign(__mstest.styleVars, { family: 'gradient', gradShape: 'serpentine', gradScat: 0 }, o);
    __mstest.reassign();
  }, o);
const line = (page) =>
  page.evaluate(() => {
    const e = document.getElementById('sfSpeck');
    return e ? e.textContent : null;
  });
const rings = (page) => page.$$eval('.sfspecks .sfring', (a) => a.length);

test('the Letter page at 24 markers: the speck marker named, its section ringed with Show them; gone when laid again, scattered or pinned', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  await page.click('#sfTab-pattern');
  await lay(page, { limitN: 8 });
  await idle(page);
  assert.equal(await line(page), null, 'none at 8');
  await lay(page, { limitN: 24 });
  await idle(page);
  assert.match(
    await line(page),
    /^\S+ only colours specks of this page\. Fewer markers would spread the colours further\. Show them$/,
  );
  await page.click('#sfSpeckShow');
  await idle(page);
  assert.ok((await rings(page)) >= 1, 'ringed');
  assert.equal(await page.textContent('#sfSpeckShow'), 'Hide them');
  // another tab: the rings go; back on Pattern, they're back
  await page.click('#sfTab-colours');
  await idle(page);
  assert.equal(await rings(page), 0, 'not on the Colours tab');
  await page.click('#sfTab-pattern');
  await idle(page);
  assert.ok((await rings(page)) >= 1, 'back on Pattern');
  await page.click('#sfSpeckShow');
  await idle(page);
  assert.equal(await rings(page), 0, 'Hide them');
  await page.click('#sfSpeckShow');
  await idle(page);
  await lay(page, { limitN: 24, gradShape: 'serpentine' });
  await idle(page);
  assert.equal(await rings(page), 0, 'laid again: the rings go');
  // Sparkle: specks are the look
  await lay(page, { limitN: 24, gradScat: 3 });
  await idle(page);
  assert.equal(await line(page), null, 'not when scattered');
  // the speck marker's sections pinned: not named
  await lay(page, { limitN: 24, gradScat: 0 });
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      a = {};
    let all = 0;
    for (const l of t.assignData.order) {
      a[A[l].mkey] = (a[A[l].mkey] || 0) + t.comps[l].area;
      all += t.comps[l].area;
    }
    for (const l of t.assignData.order) if (a[A[l].mkey] < 0.003 * all) t.locks[l] = A[l].mkey;
    t.renderControls();
  });
  await idle(page);
  assert.equal(await line(page), null, 'only on pinned sections');
  assert.deepEqual(errors, []);
});
