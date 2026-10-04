// v306 debugging pass, end to end as Ben (his 451 markers, one marker per section): Colour it on the paper round the
// drawing brings it back as a section of its own colour, so a Gradient with a marker for every section still has one
// for every section (it took a marker another section kept, and the count's label said one more than there were).
// Pages drawn here in code, as in e2e/v306-frame.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 × 1500 page: a frame 90 px in, a flower in the middle
const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
g.strokeRect(90,90,W-180,H-180);
ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();`;
async function fresh(page) {
  const b64 = await page.evaluate(async (src) => {
    const W = 1200,
      H = 1500,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    new Function('g', 'W', 'H', src)(c.getContext('2d'), W, H);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return await new Promise((res) => {
      const f = new FileReader();
      f.onload = () => res(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  }, DRAW);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}
async function built(page) {
  await sampleGuide(page);
  await fresh(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  return paper(page);
}
const paper = (page) => page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
const used = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData,
      ks = a.order.map((l) => a.assign[l].mkey);
    return { n: ks.length, m: new Set(ks).size, label: document.getElementById('sfMkNlbl').textContent };
  });

for (const scat of [0, 2]) {
  test(`Colour it with a marker for every section (Scatter ${scat}): the paper gets one no other section has, and the count says so; Undo and Redo as before`, async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await built(page);
    await page.evaluate((scat) => {
      const t = __mstest;
      state.owned = new Set(defaultOwned());
      save();
      t.coll = sfCollection();
      t.styleVars.limitN = 999;
      t.styleVars.gradScat = scat;
      t.reassign();
    }, scat);
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    const u0 = await used(page);
    assert.equal(u0.m, u0.n, 'one marker per section to start with');
    const before = await page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
    const p = await paper(page);
    await page.click('#sfFrameColour');
    await idle(page);
    const u1 = await used(page);
    assert.equal(u1.n, u0.n + 1, 'the paper is a section');
    assert.equal(u1.m, u1.n, 'and has a marker of its own: ' + JSON.stringify(u1));
    assert.equal(u1.label, 'all · ' + u1.n + ' used');
    const after1 = await page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
    for (const l in before) assert.equal(after1[l], before[l], 'section ' + l + ' keeps its marker');
    assert.ok(after1[p]);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await used(page), u0);
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await used(page), u1);
    assert.deepEqual(errors, []);
  });
}
