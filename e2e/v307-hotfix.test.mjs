// v307.1 hotfix: a new guide's first save doesn't wait on the worker (with no Build bloom it goes at once, its section
// map encoded on the page; with the bloom, the worker has the bloom's time and LMAP_WAIT more, no longer).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, letterGuide, sampleGuide, saveGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// the worker's section-map jobs never answer (the others go on as usual); each one asked for is counted
const lmapHangs = (page) =>
  page.evaluate(() => {
    const J = __mstest.jobs,
      run = J.run;
    window.__lmapAsked = 0;
    J.run = function (k, d, t) {
      if (k !== 'lmap') return run.call(J, k, d, t);
      window.__lmapAsked++;
      return new Promise(() => {});
    };
  });

test('with no bloom, a new guide is saved straight after Build, not waiting on the worker', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await lmapHangs(page);
  await letterGuide(page);
  assert.equal(await page.evaluate(() => __mstest.bloomCount), 0);
  await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 2000 });
  assert.equal(await page.evaluate(() => window.__lmapAsked), 0, 'the worker not asked');
  assert.equal(
    await page.evaluate(() => sfLoadDesign(__mstest.curId).then((d) => d.lmap === __mstest.lmapHere())),
    true,
    'the section map saved is the one encoded here',
  );
  assert.deepEqual(errors, []);
});

test('with the bloom, a worker that doesn’t answer holds the first save up only until just after the bloom', async () => {
  const { page, errors } = await openApp({
    init: () => {
      window.__MS_BLOOM = true;
    },
  });
  await welcome(page, 'look');
  await idle(page);
  await lmapHangs(page);
  await letterGuide(page);
  assert.equal(await page.evaluate(() => __mstest.bloomCount), 1);
  await page.waitForFunction(() => !__mstest.bloomOn, null, { timeout: 5000 });
  await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 1500 });
  assert.equal(await page.evaluate(() => window.__lmapAsked), 1, 'the worker was asked');
  assert.equal(
    await page.evaluate(() => sfLoadDesign(__mstest.curId).then((d) => d.lmap === __mstest.lmapHere())),
    true,
    'the section map saved is the one encoded here',
  );
  assert.deepEqual(errors, []);
});

test('how many markers shading takes is on the Library row only, not in the guide, its autosave copy or a guide file; Home still says it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  // shading on: the guide as saved (to the Library, the autosave copy or a file) leaves sk out
  const x = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    t.guideDirty = true;
    t.renderGuide();
    return t.currentDesignObj().sk;
  });
  assert.ok(x > 0, 'shading takes other markers');
  const keys = await page.evaluate(() => [
    Object.keys(__mstest.currentDesignObj()),
    JSON.stringify(__mstest.currentDesignObj()).includes('"sk"'),
    JSON.stringify(__mstest.currentDesignObj(true)).includes('"sk"'),
  ]);
  assert.deepEqual(keys, [['v', 'type', 'name', 'W', 'H', 'keys', 'n', 'payload'], false, false]);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  // (finished, so Home shows it as its latest piece)
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.checkComplete();
    t.updateProgress();
  });
  await page.evaluate(() => __mstest.saveNow());
  await page.waitForFunction((id) => {
    const e = state.saved.find((s) => s.id === id);
    return e.sk > 0 && e.done > 0;
  }, id);
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).sk, id), x, 'on the row');
  assert.equal(
    await page.evaluate(
      (id) => IDB.get('guide-' + id).then((p) => 'sk' in p || JSON.stringify(p).includes('"sk"')),
      id,
    ),
    false,
    'not in the stored guide',
  );
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  assert.match(await page.textContent('#homeHero .hhmeta'), new RegExp(`\\+ ${x} for shading$`));
  assert.deepEqual(errors, []);
});
