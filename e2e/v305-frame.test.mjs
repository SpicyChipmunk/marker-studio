// v305 (sections): a frame drawn round the picture on the same paper. On a fresh scan the paper inside it is left white,
// as a page without a frame leaves its paper, with a line on Edit sections and in the Plan: "Paper round the drawing
// is left white · Colour it" (v306's words). Colour it brings it back as a section (in the Plan, laid by the pattern, the rest keeping
// their markers), and that survives the guide being opened again. A guide saved before keeps its sections as saved.
// Pages drawn here in code; the rule itself is unit-tested in test/v305-frame.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide, shot } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 × 1500 page: o.frame (a frame 90 px in), o.figure (a flower in the middle), o.wm (a watermark's O under the
// frame), o.horizon (a ruled horizon with a house below it), o.board (a board in the middle with flowers round it),
// o.out (a shape breaking out of the frame on the left)
const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
if(o.frame)g.strokeRect(90,90,W-180,H-180);
if(o.figure){ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();}
if(o.wm){g.lineWidth=4;ring(1050,1455,24);}
if(o.horizon){g.beginPath();g.moveTo(90,900);g.lineTo(W-90,900);g.stroke();g.strokeRect(250,1000,300,250);ring(850,330,90);}
if(o.board){g.strokeRect(300,300,600,900);ring(150,150,90);ring(1050,150,90);ring(150,1350,90);ring(1050,1350,90);}
if(o.out)g.strokeRect(30,500,400,500);`;
async function fresh(page, o) {
  const b64 = await page.evaluate(
    async ([src, o]) => {
      const W = 1200,
        H = 1500,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      new Function('g', 'W', 'H', 'o', src)(c.getContext('2d'), W, H, o);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    },
    [DRAW, o],
  );
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}
const paper = (page) => page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
const inGuide = (page, l) => page.evaluate((l) => !!__mstest.assignData.assign[l], l);
const markers = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign,
      o = {};
    for (const k in a) o[k] = a[k].mkey;
    return o;
  });
const LINE = 'Paper round the drawing is left white · Colour it';

test('a lone figure in a frame: the paper is left white with a line to Colour it; in the Plan it’s laid, the rest keep theirs; it stays after opening again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await fresh(page, { frame: 1, figure: 1, wm: 1 });
  const p = await paper(page);
  assert.ok(p > 0, 'the frame is found');
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false, 'left white');
  // the watermark's O, under the frame: left white too
  const wm = await page.evaluate(() => __mstest.labels[1455 * __mstest.W + 1050]);
  assert.ok(wm > 0 && !(await page.evaluate((l) => __mstest.counted(l), wm)), 'the watermark is left white');
  assert.equal((await page.textContent('#sfFrameLine')).trim(), LINE);
  await shot(page, 'v305-frame-sections-820x1180');
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  assert.equal(await inGuide(page, p), false);
  assert.equal(await page.evaluate(() => __mstest.countedList().length), 8, 'the flower’s eight pieces');
  assert.equal((await page.textContent('#sfFrameLine')).trim(), LINE, 'the line in the Plan');
  await shot(page, 'v305-frame-plan-820x1180');
  const was = await markers(page);
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
  assert.equal(await inGuide(page, p), true, 'the paper has a marker');
  const now = await markers(page);
  for (const l in was) assert.equal(now[l], was[l], 'section ' + l + ' keeps its marker');
  assert.equal(await page.$('#sfFrameLine'), null, 'the line goes');
  // opened again: still coloured, and no line
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
  assert.deepEqual(await markers(page), now);
  assert.equal(await page.$('#sfFrameLine'), null);
  assert.deepEqual(errors, []);
});

test('Colour it on Edit sections makes it a section; Undo leaves it white again', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await fresh(page, { frame: 1, figure: 1 });
  const p = await paper(page);
  await shot(page, 'v305-frame-sections-1180x820');
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), true);
  assert.equal(await page.$('#sfFrameLine'), null);
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false);
  assert.ok(await page.isVisible('#sfFrameLine'), 'the line is back');
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  await shot(page, 'v305-frame-plan-1180x820');
  assert.ok(await page.isVisible('#sfFrameLine'));
  assert.deepEqual(errors, []);
});

test('not a frame: a framed sky over a ruled horizon, a board in the middle of a drawing, art breaking out of the frame', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  for (const [what, o] of [
    ['sky over a horizon', { frame: 1, horizon: 1 }],
    ['board in the middle', { board: 1 }],
    ['art breaking out', { frame: 1, figure: 1, out: 1 }],
  ]) {
    await fresh(page, o);
    assert.equal(await paper(page), -1, what);
    assert.equal(await page.$('#sfFrameLine'), null, what);
  }
  assert.deepEqual(errors, []);
});

test('a guide saved before v305 with the paper inside its frame coloured opens just as it was', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await fresh(page, { frame: 1, figure: 1 });
  const p = await paper(page);
  await page.click('#sfFrameColour');
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  // as v304 saved it: the paper an ordinary section (no "brought back" state, since it was never left out)
  await page.evaluate((p) => {
    const t = __mstest,
      d = t.currentDesignObj(),
      pl = d.payload;
    delete pl.secStates[p];
    // (v306 saves the frame's paper, `frame`: a guide saved before has none)
    delete pl.frame;
    window.__want = JSON.stringify(pl.assign);
    t.openDesignObj(Object.assign({}, pl, { name: 'Old framed', W: d.W, H: d.H }), null);
  }, p);
  await page.waitForFunction(() => __mstest.curName === 'Old framed' && __mstest.assignData);
  await idle(page);
  assert.equal(
    await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.assign)),
    await page.evaluate(() => window.__want),
  );
  assert.equal(await page.evaluate(() => __mstest.countedList().length), 9, 'the flower and the paper');
  assert.equal(await page.$('#sfFrameLine'), null, 'nothing found again on opening');
  // Edit sections: the paper is a section there too
  await page.click('#sfBack2');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  assert.equal(await page.evaluate(() => __mstest.countedList().length), 9);
  assert.equal(await page.$('#sfFrameLine'), null);
  assert.deepEqual(errors, []);
});
