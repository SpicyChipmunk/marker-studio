// v306 (sections): the paper inside a drawn frame. Saved with the guide (`frame`), so a guide opened again (from the
// Library, a backup or a guide file) has "Paper round the drawing is left white · Colour it" while the paper is white;
// a guide saved before v306 has no `frame` and nothing is found again. Colour it in the Plan is one Undo step, the
// plan's earlier steps kept: Undo leaves the paper white again (in Edit sections too, nothing new to build), Redo
// colours it; with zones, and with the paper ticked (Undo takes the tick with it, Redo brings it back).
// Pages drawn here in code, as in e2e/v305-frame.
import { test, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  sampleGuide,
  idle,
  saveGuide,
  shot,
  sectionPoint,
  scrollTop,
} from './helpers.mjs';

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
const inGuide = (page, l) => page.evaluate((l) => !!__mstest.assignData.assign[l], l);
const markers = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign,
      o = {};
    for (const k in a) o[k] = a[k].mkey;
    return o;
  });
const without = (o, l) => {
  const r = Object.assign({}, o);
  delete r[l];
  return r;
};
const line = async (page) => {
  const el = await page.$('#sfFrameLine');
  return el ? (await el.textContent()).trim() : null;
};
const live = (page) =>
  page
    .waitForFunction(() => document.getElementById('sfLive').textContent)
    .then(() => page.textContent('#sfLive'));
async function undo(page) {
  await page.click('#sfPlanUndo');
  await idle(page);
}
async function redo(page) {
  await page.click('#sfPlanRedo');
  await idle(page);
}
async function reopen(page, id) {
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
}
const LINE = 'Paper round the drawing is left white · Colour it';
const STEP = 'Paper round the drawing coloured';

test('saved and opened again: the line is back while the paper is white, and Colour it works', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const p = await built(page);
  assert.ok(p > 0, 'the frame is found');
  assert.equal(await line(page), LINE);
  const was = await markers(page);
  assert.equal(
    await page.evaluate(() => __mstest.currentDesignObj().payload.frame),
    p,
    'saved with the guide',
  );
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.deepEqual(await markers(page), was, 'opens as it was saved');
  assert.equal(await inGuide(page, p), false, 'the paper still white');
  assert.equal(await line(page), LINE, 'the line is back');
  await shot(page, 'v306-frame-reopened-820x1180');
  // in Edit sections too
  await page.click('#sfBack2');
  await idle(page);
  assert.equal(await line(page), LINE, 'on Edit sections');
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), true);
  assert.equal(await live(page), 'Paper round the drawing is a section');
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.equal(await line(page), LINE, 'Undo: white again');
  await page.click('#sfToPlan');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  // Colour it: the paper has a marker, the rest keep theirs, one Undo step
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(await inGuide(page, p), true, 'the paper has a marker');
  const now = await markers(page);
  assert.deepEqual(without(now, p), was, 'the rest keep their markers');
  assert.equal(await line(page), null, 'the line goes');
  assert.equal(await page.evaluate(() => __mstest.planLabel), STEP);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: ' + STEP);
  // saved again and opened: coloured, no line, and it's still the frame's paper
  await saveGuide(page);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.frame), p);
  await reopen(page, id);
  assert.deepEqual(await markers(page), now);
  assert.equal(await line(page), null);
  assert.deepEqual(errors, []);
});

test('a guide file and a backup carry the frame; a guide saved before v306 gets no line back', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  const p = await built(page);
  const was = await markers(page);
  // a guide file to share, opened (Import a guide opens it the same way)
  await page.evaluate(() => {
    const t = __mstest,
      d = t.currentDesignObj(true);
    window.__file = d;
    t.openDesignObj(Object.assign({}, d.payload, { name: 'Shared framed', W: d.W, H: d.H }), null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Shared framed' && __mstest.assignData);
  await idle(page);
  assert.equal(await page.evaluate(() => window.__file.payload.frame), p);
  assert.deepEqual(await markers(page), was);
  assert.equal(await line(page), LINE, 'the line, from a guide file');
  // a backup keeps the guide as saved, frame and all
  await saveGuide(page);
  await page.evaluate(() => openBackup());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupDownload')]);
  assert.match(await readFile(await dl.path(), 'utf8'), new RegExp('"frame":' + p + '\\b'), 'in the backup');
  await page.keyboard.press('Escape');
  await idle(page);
  // as v305 saved it: no `frame` (the paper left white, saved as left out)
  await page.evaluate(() => {
    const t = __mstest,
      d = t.currentDesignObj(),
      pl = d.payload;
    delete pl.frame;
    t.openDesignObj(Object.assign({}, pl, { name: 'Old framed', W: d.W, H: d.H }), null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Old framed' && __mstest.assignData);
  await idle(page);
  assert.deepEqual(await markers(page), was, 'opens as it was saved');
  assert.equal(await inGuide(page, p), false, 'the paper white');
  assert.equal(await paper(page), -1, 'nothing found again');
  assert.equal(await line(page), null, 'no line');
  await page.click('#sfBack2');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false, 'left out on Edit sections too');
  assert.equal(await line(page), null);
  assert.deepEqual(errors, []);
});

test('Colour it keeps the plan’s Undo: Undo leaves the paper white again, Redo colours it; nothing to build in Edit sections', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  const p = await built(page);
  const m0 = await markers(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfVary');
  await idle(page);
  const m1 = await markers(page);
  assert.notDeepEqual(m1, m0, 'shuffled');
  assert.equal(await page.evaluate(() => __mstest.planCount), 1);
  await page.click('#sfFrameColour');
  await idle(page);
  const m2 = await markers(page);
  assert.equal(await inGuide(page, p), true);
  assert.deepEqual(without(m2, p), m1, 'the rest keep their markers');
  assert.equal(
    await page.evaluate(() => __mstest.planCount),
    2,
    'the Shuffle step is kept, and Colour it is one more',
  );
  assert.equal(await live(page), STEP);
  await shot(page, 'v306-frame-coloured-1180x820');
  // Undo: white again, as after the Shuffle, the line back
  await undo(page);
  assert.equal(await inGuide(page, p), false);
  assert.deepEqual(await markers(page), m1);
  assert.equal(await line(page), LINE, 'the line is back');
  assert.equal(await page.getAttribute('#sfPlanRedo', 'aria-label'), 'Redo: ' + STEP);
  await shot(page, 'v306-frame-undone-1180x820');
  // and the Shuffle
  await undo(page);
  assert.deepEqual(await markers(page), m0);
  // Redo both: coloured again, with the marker it had
  await redo(page);
  assert.deepEqual(await markers(page), m1);
  await redo(page);
  assert.deepEqual(await markers(page), m2);
  assert.equal(await line(page), null);
  // Undo, then Edit sections: the paper left out there too, nothing to build
  await undo(page);
  await page.click('#sfBack2');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  assert.equal(await page.evaluate(() => __mstest.secEdPending()), false, 'nothing to build');
  assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false);
  assert.equal(await line(page), LINE);
  // ← Plan: as it was; saved and opened: white, with the line
  await page.click('#sfToPlan');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  assert.deepEqual(await markers(page), m1);
  await saveGuide(page);
  await reopen(page, await page.evaluate(() => __mstest.curId));
  assert.deepEqual(await markers(page), m1);
  assert.equal(await line(page), LINE);
  assert.deepEqual(errors, []);
});

test('Colour it with zones: Undo puts the zones back as they were, Redo colours the paper again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const p = await built(page);
  // a zone of the flower's top two pieces
  const top = await page.evaluate(() => {
    const t = __mstest;
    return Object.keys(t.assignData.assign)
      .map(Number)
      .filter((l) => t.comps[l].cy < 700)
      .slice(0, 2);
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  for (const l of top) {
    await scrollTop(page);
    const q = await sectionPoint(page, l);
    await page.mouse.click(q.x, q.y);
    await idle(page);
  }
  await page.click('#sfZoneDone');
  await idle(page);
  const zs = () =>
    page.evaluate(() =>
      JSON.stringify(
        __mstest.zones.map((z) =>
          Object.keys(z.secs)
            .map(Number)
            .sort((a, b) => a - b),
        ),
      ),
    );
  const z0 = await zs(),
    m0 = await markers(page);
  assert.equal(JSON.parse(z0)[0].length, 2, 'the zone has its two');
  const n0 = await page.evaluate(() => __mstest.planCount);
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(await inGuide(page, p), true);
  assert.equal(await page.evaluate(() => __mstest.planCount), n0 + 1);
  assert.deepEqual(without(await markers(page), p), m0);
  const z1 = await zs(),
    m1 = await markers(page);
  await undo(page);
  assert.equal(await inGuide(page, p), false);
  assert.equal(await zs(), z0, 'the zones as they were');
  assert.deepEqual(await markers(page), m0);
  assert.equal(await line(page), LINE);
  await redo(page);
  assert.equal(await zs(), z1);
  assert.deepEqual(await markers(page), m1);
  assert.deepEqual(errors, []);
});

test('Colour it, the paper ticked: Undo takes the tick with it, Redo brings it back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const p = await built(page);
  await page.click('#sfFrameColour');
  await idle(page);
  const N = await page.evaluate(() => __mstest.assignData.N);
  // Colour along: a tap on the paper ticks it
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  const q = await sectionPoint(page, p);
  await page.mouse.click(q.x, q.y);
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1, 'ticked');
  await page.click('#sfDoneBtn');
  await page.waitForFunction(() => __mstest.sfmode === 'guide');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), STEP, 'the tick is no step of its own');
  await undo(page);
  assert.equal(await inGuide(page, p), false);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 0, 'the tick goes with the paper');
  assert.equal(await page.evaluate(() => __mstest.assignData.N), N - 1);
  assert.equal(await line(page), LINE);
  await redo(page);
  assert.equal(await inGuide(page, p), true);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1, 'ticked again');
  // and again: Undo, Redo
  await undo(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 0);
  await redo(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1);
  // saved with the tick
  await saveGuide(page);
  assert.ok(await page.evaluate((l) => __mstest.currentDesignObj().payload.prog.includes(l), p));
  assert.deepEqual(errors, []);
});
