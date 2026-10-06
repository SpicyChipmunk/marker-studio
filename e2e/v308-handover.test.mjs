// v308 Palette's Use in a guide hands the palette over without saving it to the Library. The guide holds it as its
// Generate palette's markers, and marks it (style.fromPal: its name and scheme) so it is used as it is, as a saved
// palette is: Mood greyed out, Shuffle reshuffling only, the line under the Colours tab naming it, until a new palette
// is asked for (a harmony chosen, Generate palette tapped, Surprise). Before, a Mood tap or Shuffle made a new palette
// in its place (a 6-colour Rainbow became 16 other colours after Soft). The mark is kept through Undo, a reload, a
// guide file and a backup.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  setup,
  teardown,
  openApp,
  idle,
  until,
  welcome,
  sampleGuide,
  saveGuide,
  answerAsks,
} from './helpers.mjs';

before(setup);
after(teardown);

async function handOver(page, h, n) {
  await page.click('#mPalette');
  await idle(page);
  await page.click(`#harm [data-h="${h}"]`);
  await idle(page);
  await page.click(`#segs [data-n="${n}"]`);
  await idle(page);
  await page.click('#draw');
  await until(page, () => !rolling, null, 'the roll');
  await idle(page);
  const keys = await page.evaluate(() => currentPaletteIdxs().map(mkey));
  const name = (await page.textContent('#readout .name')).trim();
  await page.click('#useInGuide');
  await page.click('#sfEdAsk [data-a="recolour"]');
  await page.waitForFunction(
    (k) => __mstest.styleVars.paletteSource === 'generate' && __mstest.styleVars.genPal.join() === k,
    keys.join(),
  );
  await idle(page);
  return { keys, name };
}
const sv = (page) =>
  page.evaluate(() => {
    const s = __mstest.styleVars;
    return {
      src: s.paletteSource,
      genPal: s.genPal.slice(),
      fromPal: s.fromPal && { ...s.fromPal },
      emphasis: s.emphasis,
    };
  });
const pageKeys = (page) =>
  page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((a) => a.mkey))]);
const moodOff = (page) =>
  page.evaluate(() => [...document.querySelectorAll('#sfMood button')].every((b) => b.disabled));
const poolLine = (page) => page.evaluate(() => document.getElementById('sfPoolCt').textContent);
const harmShown = (page) =>
  page.evaluate(() => {
    const s = document.getElementById('sfHarm');
    return s.options[s.selectedIndex].textContent;
  });

test('Use in a guide: Mood and Shuffle keep the palette’s markers; a harmony or Generate palette makes a new one; Undo goes back to it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const { keys, name } = await handOver(page, 'rainbow', 6);
  assert.equal(
    await page.evaluate(() => state.saved.filter((x) => x.type === 'palette').length),
    0,
    'not saved',
  );
  // a Mood tap (it had made a new 16-colour palette, Soft from a 6-colour Rainbow) changes nothing
  await page.evaluate(() => document.querySelector('#sfMood [data-v="muted"]').click());
  await idle(page);
  let s = await sv(page);
  assert.deepEqual(s.genPal, keys, 'the palette’s markers after a Mood tap');
  assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
  // used as it is, as a saved palette is: Mood greyed out, the line says so, the harmony list shows the palette
  assert.equal(await moodOff(page), true, 'Mood greyed out');
  assert.equal(await poolLine(page), 'All 6 of your palette’s markers, as it is');
  assert.equal(await harmShown(page), name + ' (Rainbow)');
  assert.ok(
    (await pageKeys(page)).every((k) => keys.includes(k)),
    'the page uses only the palette',
  );
  // Shuffle: the same markers, in another order
  const before = await page.evaluate(() => JSON.stringify(__mstest.assignData.assign));
  await page.evaluate(() => document.getElementById('sfVary').click());
  await idle(page);
  s = await sv(page);
  assert.deepEqual(s.genPal, keys, 'Shuffle kept the palette');
  assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
  assert.ok((await pageKeys(page)).every((k) => keys.includes(k)));
  assert.notEqual(
    await page.evaluate(() => JSON.stringify(__mstest.assignData.assign)),
    before,
    'reshuffled',
  );
  // choosing a harmony asks for a new palette: the guide's own from then on, its Mood back
  await page.evaluate(() => {
    const el = document.getElementById('sfHarm');
    el.value = 'triadic';
    el.dispatchEvent(new Event('change'));
  });
  await idle(page);
  s = await sv(page);
  assert.equal(s.fromPal, null);
  assert.notDeepEqual(s.genPal, keys);
  assert.equal(await moodOff(page), false);
  assert.match(await poolLine(page), /generated markers/);
  assert.equal(await harmShown(page), 'Triadic');
  // Undo brings the handed-over palette back, as it was
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  s = await sv(page);
  assert.deepEqual(s.genPal, keys);
  assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
  assert.equal(await moodOff(page), true);
  // Generate palette, tapped while it shows the handed-over palette, makes a new one (one Undo step, so named)
  await page.evaluate(() => document.querySelector('#sfSrc [data-v="generate"]').click());
  await idle(page);
  s = await sv(page);
  assert.equal(s.fromPal, null);
  assert.notDeepEqual(s.genPal, keys);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'New palette');
  // a generated palette follows the Mood as before: made again for it
  const g = s.genPal;
  await page.evaluate(() => document.querySelector('#sfMood [data-v="pastel"]').click());
  await idle(page);
  assert.notDeepEqual((await sv(page)).genPal, g, 'made again for the Mood');
  // Surprise is a new palette too
  await page.evaluate(() => __mstest.assign.planUndo());
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  assert.deepEqual((await sv(page)).fromPal, { name, h: 'rainbow' });
  await page.evaluate(() => __mstest.surprise());
  await idle(page);
  assert.equal((await sv(page)).fromPal, null, 'Surprise: the guide’s own palette');
  assert.deepEqual(errors, []);
});

test('the handed-over palette stays itself after a reload, in a guide file and in a backup', async () => {
  const a = await openApp();
  await sampleGuide(a.page);
  const { keys, name } = await handOver(a.page, 'rainbow', 6);
  await saveGuide(a.page);
  const id = await a.page.evaluate(() => __mstest.curId);
  const want = { src: 'generate', genPal: keys, fromPal: { name, h: 'rainbow' } };
  const check = async (page, what) => {
    const s = await sv(page);
    assert.deepEqual({ src: s.src, genPal: s.genPal, fromPal: s.fromPal }, want, what);
    assert.equal(await moodOff(page), true, what + ': Mood greyed out');
    // (and Shuffle still keeps it)
    await page.evaluate(() => document.getElementById('sfVary').click());
    await idle(page);
    assert.deepEqual((await sv(page)).genPal, keys, what + ': Shuffle');
  };
  // reload
  await a.page.reload();
  await idle(a.page);
  await a.page.evaluate((id) => loadGuide({ id }), id);
  await a.page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
  await idle(a.page);
  await check(a.page, 'reloaded');
  // a guide file, opened in a fresh copy of the app
  const file = await a.page.evaluate(() => __mstest.currentDesignObj(true));
  assert.deepEqual(file.payload.style.fromPal, { name, h: 'rainbow' });
  const b = await openApp();
  await welcome(b.page, 'look');
  await b.page.evaluate(
    (d) => SF.importFile(new File([JSON.stringify(d)], 'g.msguide.json', { type: 'application/json' })),
    file,
  );
  await b.page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 15000,
  });
  await idle(b.page);
  await check(b.page, 'guide file');
  // a backup, restored into a fresh copy of the app
  await a.page.click('#mHome');
  await a.page.click('#homeLibCard');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
  const bk = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.deepEqual(bk.guides[0].payload.style.fromPal, { name, h: 'rainbow' });
  const c = await openApp();
  await answerAsks(c.page);
  const [fc] = await Promise.all([c.page.waitForEvent('filechooser'), c.page.click('#wcRestore')]);
  await fc.setFiles(await dl.path());
  await idle(c.page, 1500);
  const gid = await c.page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await c.page.evaluate((id) => loadGuide({ id }), gid);
  await c.page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, gid, { timeout: 10000 });
  await idle(c.page);
  await check(c.page, 'backup');
  assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
});
