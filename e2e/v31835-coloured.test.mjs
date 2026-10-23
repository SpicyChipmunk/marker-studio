// v318.35 in the browser (Fable E1-3): a page partly coloured in with markers keeps its coloured sections (they had
// read as ink), gets no "coloured in already" warning, and after Build offers to mark them done: a toast with a
// button, never by itself; taken, it ticks them and says so with an Undo that puts the ticks back. A plain page gets
// no offer. Fails on v318.34 (the filled cells shrink to scraps; no offer).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, toolStatus } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in 8 px black lines, a blank margin; o.fills cells coloured in
// with mid markers (a 2 px bleed over the lines, as a marker leaves); as a PNG
async function picture(page, o = {}) {
  const b64 = await page.evaluate(async (o) => {
    const W = 1200,
      H = 1600,
      M = 110,
      S = 180,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    (o.fills || []).forEach(([cx, cy, col]) => {
      g.fillStyle = col;
      g.fillRect(M + cx * S - 2, M + cy * S - 2, S + 4, S + 4);
    });
    g.strokeStyle = '#111';
    g.lineWidth = 8;
    for (let i = 0; i <= 5; i++) {
      g.beginPath();
      g.moveTo(M + i * S, M);
      g.lineTo(M + i * S, M + 7 * S);
      g.stroke();
    }
    for (let j = 0; j <= 7; j++) {
      g.beginPath();
      g.moveTo(M, M + j * S);
      g.lineTo(M + 5 * S, M + j * S);
      g.stroke();
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  }, o);
  return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}
const FILLS = [
  [1, 1, 'rgb(116,168,232)'],
  [3, 2, 'rgb(232,96,96)'],
  [0, 5, 'rgb(112,192,142)'],
];
async function settle(page) {
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
}
const warn = (page) =>
  page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
const count = (page) => page.evaluate(() => __mstest.countedList().length);
const ticked = (page) => page.evaluate(() => [...__mstest.colored].filter((x) => x).length);
async function build(page) {
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
}
const toastOn = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return t && t.classList.contains('on') ? t.textContent : '';
  });

test('coloured-in sections stay sections with no warning; Build offers to mark them done; Undo puts the ticks back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await picture(page, { fills: FILLS }));
  await settle(page);
  assert.equal(await warn(page), '', 'no warning for a partly coloured page');
  const n = await count(page);
  assert.equal(n, 35, 'every cell, the coloured ones too');
  // the coloured cells are whole: as big as a plain one
  const areas = await page.evaluate(() => {
    const t = __mstest,
      at = (cx, cy) => t.comps[t.labels[(110 + cy * 180 + 90) * t.W + 110 + cx * 180 + 90]];
    return [at(1, 1), at(3, 2), at(0, 5), at(2, 2)].map((c) => (c && !c.bg ? c.area : 0));
  });
  assert.ok(
    areas[3] > 0 && areas.every((a) => Math.abs(a - areas[3]) < areas[3] * 0.05),
    JSON.stringify(areas),
  );
  assert.equal(await ticked(page), 0, 'nothing ticked by itself');
  await build(page);
  // the offer, after the bloom
  await page.waitForFunction(
    () => /look coloured in already/.test(document.getElementById('msToast')?.textContent || ''),
    null,
    { timeout: 20000 },
  );
  assert.match(await toastOn(page), /^3 sections look coloured in already\./);
  assert.equal(await page.textContent('#toastAct'), 'Mark them done');
  assert.equal(await ticked(page), 0, 'still nothing ticked: an offer');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await ticked(page), 3);
  assert.match(await toastOn(page), /^Marked 3 sections done/);
  assert.equal(await page.textContent('#toastAct'), 'Undo');
  // the ticks are the guide's progress: Colour along would count them
  assert.equal(await page.evaluate(() => [...__mstest.colored].filter((x) => x).length), 3);
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await ticked(page), 0, 'Undo: the ticks as they were');
  // Colour along counts none, and the offer isn't made again
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  // (WebKit's first Colour along adds "· screen stays on" to the status)
  assert.match(await toolStatus(page), new RegExp(`^0 of ${n} coloured`));
  assert.doesNotMatch(await toastOn(page), /coloured in already/);
  assert.deepEqual(errors, []);
});

test('a plain page gets no offer', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await picture(page));
  await settle(page);
  assert.equal(await page.evaluate(() => __mstest.chroma), null, 'no colour read on a greyscale page');
  await build(page);
  await page.waitForTimeout(2500);
  assert.doesNotMatch(await toastOn(page), /coloured in already/);
  assert.equal(await ticked(page), 0);
  assert.deepEqual(errors, []);
});
