// v315 (Q5, Q11): a Gradient made since v315 (gradArea 2): the adapting area rule, a pinned section bigger than one
// marker's share counting for nothing (not a coloured one the re-lay holds), and no two markers too alike in the run.
// Saved with the guide and opened as saved; a v314 guide (1) keeps its rule. Fails on v314.1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, letterGuide, welcome, answerAsks, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// the Letter page laid as a Gradient of 16 with this rule; the markers by section, each one's share of the page
const lay = (page, rule) =>
  page.evaluate((rule) => {
    const t = __mstest;
    Object.assign(t.styleVars, {
      family: 'gradient',
      gradShape: 'serpentine',
      limitN: 16,
      gradScat: 0,
      gradArea: rule,
    });
    t.reassign();
    return info();
    function info() {
      const A = t.assignData.assign,
        area = {};
      let all = 0;
      for (const l of t.assignData.order) {
        area[A[l].mkey] = (area[A[l].mkey] || 0) + t.comps[l].area;
        all += t.comps[l].area;
      }
      const big = t.assignData.order.reduce((b, l) => (t.comps[l].area > t.comps[b].area ? l : b));
      return {
        big,
        others: t.assignData.order
          .filter((l) => l !== big)
          .map((l) => A[l].mkey)
          .join(','),
        specks: Object.values(area).filter((a) => a < 0.003 * all).length,
      };
    }
  }, rule);

test('a new guide takes rule 2, saves it and opens with it; pinning the big section spreads the others, colouring it doesn’t', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 2);
  const a = await lay(page, 2);
  // coloured, then laid again: as before
  await page.evaluate((l) => {
    __mstest.colored[l] = 1;
  }, a.big);
  const held = await lay(page, 2);
  assert.equal(held.others, a.others, 'a coloured section isn’t a pin');
  await page.evaluate((l) => {
    __mstest.colored[l] = 0;
    __mstest.locks[l] = __mstest.assignData.assign[l].mkey;
  }, a.big);
  const pinned = await lay(page, 2);
  assert.notEqual(pinned.others, a.others, 'the run shared out again');
  assert.ok(pinned.specks <= a.specks, `no more on specks: ${pinned.specks} ≤ ${a.specks}`);
  // saved and opened again: rule 2
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.gradArea), 2);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => __mstest.curId === id, id);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 2);
  assert.deepEqual(errors, []);
});
