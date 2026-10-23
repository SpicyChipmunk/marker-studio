// v319 in the browser (Fable Y1-1/2/5): a page drawn in coloured outlines and partly coloured in with a dark marker
// keeps every cell, through the worker's own copy of the ink (v318.36), with a black title band or not, and in
// thick lines; the picture keeps its colour, so the filled cells are offered as done after Build (colourSecs). On
// v318.37 the page-level verdict (inkLinesColoured) took the lines for fills from the fifth fill on, or at 14 px,
// and the page came back blank ('faint'), its colour dropped. Fails on v318.37.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in `lw` px lines of colour `line`, `fills` cells coloured in
// with a dark blue marker (every other cell, as on a chessboard), a 40 px black title band under it (`band`); as a PNG
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
    if (o.band) {
      g.fillStyle = '#000';
      g.fillRect(M, H - M - 40, 5 * S, 40);
    }
    g.fillStyle = 'rgb(20,60,150)';
    for (let i = 0, k = 0; i < 35 && k < (o.fills || 0); i++) {
      const cx = i % 5,
        cy = (i / 5) | 0;
      if ((cx + cy) % 2) continue;
      g.fillRect(M + cx * S, M + cy * S, S, S);
      k++;
    }
    g.strokeStyle = o.line;
    g.lineWidth = o.lw || 8;
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
async function settle(page) {
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
}
const warn = (page) =>
  page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
const count = (page) => page.evaluate(() => __mstest.countedList().length);
const offered = (page) => page.evaluate(() => __mstest.colourSecs().length);

test('coloured outlines part coloured in keep every cell, and the filled ones are offered as done', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await sampleGuide(page);
  for (const o of [
    { line: 'rgb(220,30,30)', fills: 5, band: true },
    { line: 'rgb(220,30,30)', fills: 10, band: false },
    { line: 'rgb(40,60,200)', fills: 5, band: true },
    { line: 'rgb(220,30,30)', fills: 3, band: true, lw: 14 },
    { line: 'rgb(220,30,30)', fills: 0, band: true, lw: 14 },
  ]) {
    const nm = o.line + ', ' + o.fills + ' fills, band ' + o.band + ', ' + (o.lw || 8) + ' px: ';
    await page.setInputFiles('#sfFile', await picture(page, o));
    await settle(page);
    assert.equal(await warn(page), '', nm + 'no warning');
    assert.equal(await count(page), 35, nm + 'every cell');
    assert.ok(await page.evaluate(() => !!__mstest.chroma), nm + 'colour kept');
    assert.equal(await offered(page), o.fills, nm + 'fills offered');
  }
  // (the ink ran in the worker, the v318.36 path, when there is one)
  const off = await page.evaluate(() => __mstest.segOffCount);
  assert.ok(off == null || off > 0, 'worker runs: ' + off);
  assert.deepEqual(errors, []);
});
