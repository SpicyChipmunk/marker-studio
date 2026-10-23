// v318.35: hatching as one section, in the browser. A page with a hatched box (close parallel lines) finds the box
// as one section with its lines kept; Edit sections has "Treat hatching as one section", ticked, with the count in
// its note; unticking it finds the sections again without the merge (every sliver its own), Undo brings the merged
// section and the tick back, and the switch is saved with the guide only when off. Fails on v318.34 (no switch).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

async function fresh() {
  const a = await openApp({ width: 820, height: 1180 });
  await haveSet(a.page);
  await a.page.check('#wcSets input[data-i="3"]');
  await a.page.click('#wcAdd');
  return a;
}
// a 1200 x 1600 page: a frame, a plain box, and a 300 x 300 box hatched with 2 px lines every 6 px (4 px gaps, about
// 0.7 mm on a Letter page); drawn with fillRect, so the lines are crisp
const pagePNG = (page) =>
  page.evaluate(async () => {
    const W = 1200,
      H = 1600,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    const rect = (x, y, w, h) => g.fillRect(x, y, w, h);
    const box = (x, y, w, h, t) => {
      rect(x, y, w, t);
      rect(x, y + h - t, w, t);
      rect(x, y, t, h);
      rect(x + w - t, y, t, h);
    };
    box(100, 100, 1000, 1400, 4);
    box(200, 300, 300, 300, 3);
    box(600, 300, 300, 300, 2);
    for (let y = 302; y < 598; y += 6) rect(602, y, 296, 2);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result.split(',')[1]);
      fr.readAsDataURL(blob);
    });
  });
async function pick(page, b64) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'hatched.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  await idle(page);
}
// the sections (not background, not merged away) lying inside the hatched box, in the picture's pixels
const inBox = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      k = t.W / 1200,
      a = [];
    for (let l = 1; l < t.comps.length; l++) {
      const c = t.comps[l];
      if (!c || c.bg || c.merged) continue;
      if (c.x0 >= 600 * k && c.y0 >= 300 * k && c.x1 <= 900 * k && c.y1 <= 600 * k) a.push(c.area);
    }
    return a;
  });
const made = (page) => page.evaluate(() => __mstest.hatchMade);

test('a hatched box is one section; the switch on Edit sections, off and Undo; saved only when off', async () => {
  const { page, errors } = await fresh();
  await pick(page, await pagePNG(page));
  if (await page.isVisible('#sfFix')) {
    await page.click('#sfFix');
    await idle(page);
  }
  assert.equal(await made(page), 1, 'one hatched patch merged');
  assert.equal((await inBox(page)).length, 1, 'the hatched box is one section');
  assert.equal(await page.isChecked('#sfHatch'), true);
  assert.match(await page.textContent('#sfHatchNote'), /Found 1 hatched patch on this page/);
  // 44 px row
  const box = await page.evaluate(
    () => document.querySelector('#sfHatchLine label').getBoundingClientRect().height,
  );
  assert.ok(box >= 44, 'row height ' + box);
  // off: found again without the merge, every sliver its own
  await page.uncheck('#sfHatch');
  await page.waitForFunction(() => !__mstest.segBusy && __mstest.hatchMade === 0);
  await idle(page);
  const slivers = await inBox(page);
  assert.ok(slivers.length >= 40, 'slivers: ' + slivers.length);
  assert.doesNotMatch(await page.textContent('#sfHatchNote'), /Found/);
  assert.equal(await page.evaluate(() => __mstest.styleVars.hatchOne), false);
  // Undo: the merged section and the tick are back
  await page.evaluate(() => __mstest.doUndoSeg());
  await idle(page);
  assert.equal((await inBox(page)).length, 1, 'undone: one section again');
  assert.equal(await page.isChecked('#sfHatch'), true);
  assert.equal(await made(page), 1);
  assert.match(await page.textContent('#sfHatchNote'), /Found 1 hatched patch/);
  // saved with the guide only when off
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.hatchOne), undefined);
  await page.evaluate(() => {
    __mstest.styleVars.hatchOne = false;
  });
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.hatchOne), false);
  assert.deepEqual(errors, []);
});
