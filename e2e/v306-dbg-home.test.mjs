// v306 debugging pass (home): Plan › Colours from › Generate palette › Rainbow, whose Shuffle gave the same Rainbow
// every time; Home's latest piece when the newest finished guide is a copy with section edits still to be built, and
// when it's the guide open in Colour along.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const genPal = (page) => page.evaluate(() => JSON.stringify(__mstest.genPal));

test('Plan › Generate palette › Rainbow: Shuffle rolls another rainbow, as Palette’s Generate does', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    __mstest.coll = sfCollection();
    SF.reassign();
  });
  await idle(page);
  await click(page, '.sftabbtn[data-t="colours"]');
  await idle(page);
  await click(page, '#sfSrc [data-v="generate"]');
  await idle(page);
  await page.selectOption('#sfHarm', 'rainbow');
  await idle(page);
  const first = await genPal(page);
  // chosen: the Gradient's own Rainbow, as Palette makes it first
  assert.equal(
    first,
    await page.evaluate(() =>
      JSON.stringify(
        genPalette(Math.max(6, Math.min(16, __mstest.styleVars.limitN)), 'rainbow', {
          mood: __mstest.styleVars.emphasis,
        }).map((i) => mkey(i)),
      ),
    ),
  );
  for (const fam of ['random', 'gradient']) {
    await page.evaluate((f) => {
      __mstest.styleVars.family = f;
      SF.reassign();
    }, fam);
    await idle(page);
    await click(page, '.sftabbtn[data-t="pattern"]');
    await idle(page);
    const seen = new Set([await genPal(page)]);
    for (let k = 0; k < 3; k++) {
      await click(page, fam === 'gradient' ? '#sfVary' : '#sfShuffle');
      await idle(page);
      const p = JSON.parse(await genPal(page));
      assert.ok(
        await page.evaluate((p) => palOnScheme(p.map(keyIdx), 'rainbow'), p),
        fam + ': still round the wheel',
      );
      seen.add(JSON.stringify(p));
    }
    assert.ok(seen.size >= 3, fam + ': ' + seen.size + ' different Rainbows in 4');
  }
  assert.deepEqual(errors, []);
});

// the sample guide, every section ticked and saved: its id
async function finishedSample(page) {
  await sampleGuide(page);
  await saveGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.updateProgress();
    t.renderGuide();
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page, 1500);
  return page.evaluate(() => __mstest.curId);
}
const revealing = (page) =>
  page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'));

// (v306 smalls: such a copy is left out of the latest piece, which went to it and opened it in Edit sections before)
test('Home’s latest piece: a copy with section edits to build is left out; the guide it was kept from leads', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const a = await finishedSample(page);
  const name = await page.evaluate((a) => state.saved.find((s) => s.id === a).name, a);
  // as a tab kept it (keepSlot): "… (section edits)", the guide finished, its edits waiting
  await page.evaluate(
    (a) =>
      IDB.get('guide-' + a).then((pl) => {
        const e = state.saved.find((s) => s.id === a);
        return sfSaveDesign({
          id: 9401,
          name: 'Edited (section edits)',
          W: e.W,
          H: e.H,
          keys: e.keys,
          n: e.n,
          payload: { ...pl, edits: 1 },
          quiet: true,
        });
      }),
    a,
  );
  assert.equal(await page.evaluate(() => state.saved.find((s) => s.id === 9401).eds), 1);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  assert.equal(await page.textContent('#homeHero .hhname'), name);
  await page.click('#homeHeroGo');
  await page.waitForFunction((a) => __mstest.curId === a, a);
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
  assert.deepEqual(errors, []);
});

test('Home’s latest piece: Reveal & share for the guide open in Colour along plays its Reveal', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  const a = await finishedSample(page);
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  await page.click('#homeHeroGo');
  await page.waitForFunction((a) => __mstest.curId === a, a);
  await page.waitForFunction(() => document.getElementById('sfRoot').classList.contains('sfrev'));
  await page.keyboard.press('Escape');
  await idle(page, 1500);
  assert.equal(await revealing(page), false);
  assert.deepEqual(errors, []);
});
