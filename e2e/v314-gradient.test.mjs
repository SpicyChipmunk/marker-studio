// v314 (D8): a Gradient made since v314 shares its run out by area softened (gradArea), laid Polished or Natural: on a
// page with big sections, fewer markers are seen only on specks. A guide saved before, and Textured, Sparkle and
// Confetti, are laid as v313 laid them. Fails on v313.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, letterGuide, welcome, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

// lay it with this rule and Scatter; the markers' keys by section, and how many markers are on under 1% of the page
const lay = (page, rule, scat) =>
  page.evaluate(
    ([rule, scat]) => {
      const t = __mstest;
      Object.assign(t.styleVars, {
        family: 'gradient',
        gradShape: 'serpentine',
        limitN: 16,
        gradScat: scat,
        gradArea: rule,
      });
      t.reassign();
      const A = t.assignData.assign,
        area = {};
      let all = 0;
      for (const l of t.assignData.order) {
        area[A[l].mkey] = (area[A[l].mkey] || 0) + t.comps[l].area;
        all += t.comps[l].area;
      }
      return {
        keys: t.assignData.order.map((l) => A[l].mkey).join(','),
        specks: Object.values(area).filter((a) => a < 0.01 * all).length,
      };
    },
    [rule, scat],
  );

test('a page with big sections: a new guide takes the softened rule, with fewer markers on specks; a guide saved before, and Sparkle, as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  // (v315: a new guide takes the newer rule, 2; v314's, 1, is still laid as it was)
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 2, 'a new guide');
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.gradArea), 2, 'saved with it');
  const soft = await lay(page, 1, 0),
    plain = await lay(page, 0, 0);
  assert.notEqual(soft.keys, plain.keys, 'laid differently');
  assert.ok(soft.specks < plain.specks, `fewer on specks: ${soft.specks} < ${plain.specks}`);
  // Sparkle: as v313 laid it
  const s1 = await lay(page, 1, 3),
    s0 = await lay(page, 0, 3);
  assert.equal(s1.keys, s0.keys, 'Sparkle as before');
  assert.deepEqual(errors, []);
});
