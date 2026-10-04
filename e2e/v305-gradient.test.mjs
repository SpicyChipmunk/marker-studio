// v305 (the Gradient): the smoothing pass after it's laid, in the app (a guide laid with it opens again with exactly
// its markers; the Start colour still starts the flow), and Around, the fifth Flow: round Radial's centre, with its ⊕
// and the line under Flow, saved with the guide and taken back by Undo; the Flow row on an iPad either way round and
// a phone. The engine is unit-tested in test/v305-gradient.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, letterGuide, idle, saveGuide, shot } from './helpers.mjs';

before(setup);
after(teardown);

const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const tab = (page, t) => click(page, `.sftabbtn[data-t="${t}"]`);
const assignMap = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign,
      o = {};
    for (const k in a) o[k] = a[k].mkey;
    return JSON.stringify(o);
  });
async function reopen(page) {
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
}

test('smoothing: a new guide from a photo is smoothed; it opens again with exactly its markers, the Start colour first', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  // Ben's own markers, one to each section
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
  });
  await letterGuide(page);
  await tab(page, 'pattern');
  await page.evaluate(() => {
    __mstest.styleVars.limitN = 999;
    SF.reassign();
  });
  await idle(page);
  const s = await page.evaluate(() => __mstest.grad.smoothed);
  assert.ok(s && s.swaps > 0, 'smoothed: ' + JSON.stringify(s));
  // the flow's first section has the marker it has unsmoothed (the Photo pattern before its photo lays the Gradient
  // without smoothing), so the Start colour still starts the flow
  const firsts = await page.evaluate(() => {
    const t = __mstest,
      cl = t.assignData.order.slice(),
      f = () => t.assignData.assign[t.assignData.order[0]].mkey,
      a = f();
    t.styleVars.family = 'photo';
    t.grad.build(cl);
    const b = f();
    t.styleVars.family = 'gradient';
    t.grad.build(cl);
    return [a, b, f()];
  });
  assert.equal(firsts[0], firsts[1]);
  assert.equal(firsts[2], firsts[0], 'laid the same again');
  const was = await assignMap(page);
  await reopen(page);
  assert.equal(await assignMap(page), was, 'exactly its markers');
  assert.equal(await page.evaluate(() => __mstest.styleVars.limitN), 999);
  assert.deepEqual(errors, []);
});

test('Around: a fifth Flow; colours go round the centre, with the ⊕ and its line; one Undo step; saved with the guide', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await idle(page);
  const flows = await page.evaluate(() =>
    [...document.querySelectorAll('#sfShape button')].map((b) => b.textContent),
  );
  assert.deepEqual(flows, ['Serpentine', 'Vertical', 'Diagonal', 'Radial', 'Around']);
  assert.equal(await page.isVisible('#sfRadC'), false, 'no ⊕ for Serpentine');
  await page.click('#sfShape [data-v="around"]');
  await idle(page);
  assert.equal(await page.getAttribute('#sfShape [data-v="around"]', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'around');
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Flow: Around');
  assert.ok(await page.isVisible('#sfRadC'), 'the ⊕ shows');
  assert.match(await page.getAttribute('#sfRadC', 'aria-label'), /what the colours go round/);
  assert.match(await page.textContent('#sfRadNote'), /Centre: in the middle/);
  // the flow goes round the middle, clockwise from the top
  const angles = await page.evaluate(() => {
    const t = __mstest,
      c = t.comps,
      o = t.assignData.order;
    return o.map((l) => {
      let a = Math.atan2(c[l].cy - t.H / 2, c[l].cx - t.W / 2) + Math.PI / 2;
      return a < 0 ? a + 2 * Math.PI : a;
    });
  });
  for (let i = 1; i < angles.length; i++)
    assert.ok(angles[i] >= angles[i - 1] - 1e-9, 'round in turn at ' + i);
  // the ⊕ moved by the keys: the flow starts somewhere else; one Undo step says so
  const was = await assignMap(page);
  await page.focus('#sfRadC');
  await page.keyboard.press('ArrowLeft');
  await idle(page);
  assert.notEqual(await assignMap(page), was);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Centre moved');
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.equal(await assignMap(page), was);
  // saved with the guide, opened again as it was
  await reopen(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'around');
  assert.equal(await assignMap(page), was);
  await tab(page, 'pattern');
  assert.equal(await page.getAttribute('#sfShape [data-v="around"]', 'aria-pressed'), 'true');
  // Undo back to Radial: its own words again
  await page.click('#sfShape [data-v="radial"]');
  await idle(page);
  assert.match(await page.getAttribute('#sfRadC', 'aria-label'), /where the rings start/);
  assert.deepEqual(errors, []);
});

test('the Flow row with five: one row on an iPad either way round and a phone 390 wide; narrower, each choice whole', async () => {
  for (const [w, h, one] of [
    [820, 1180, true],
    [1180, 820, true],
    [390, 844, true],
    [360, 780, false],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await page.click('#sfShape [data-v="around"]');
    await idle(page);
    const r = await page.evaluate(() => {
      const row = document.getElementById('sfShape'),
        bs = [...row.querySelectorAll('button')];
      return {
        tops: [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
        clipped: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
        over: row.scrollWidth > row.clientWidth + 1,
        page: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (one) assert.equal(r.tops, 1, `${w}×${h}: one row`);
    assert.deepEqual(r.clipped, [], `${w}×${h}: no choice cut off`);
    assert.equal(r.over, false, `${w}×${h}: the row fits`);
    assert.equal(r.page, false, `${w}×${h}: no sideways scroll`);
    await page.evaluate(() => document.getElementById('sfShape').scrollIntoView({ block: 'center' }));
    await shot(page, `v305-flow-${w}x${h}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
