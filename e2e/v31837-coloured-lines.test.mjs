// v318.37 in the browser (Fable X1-1): a page whose outlines are drawn in colour (a red pen) with a black title band
// keeps every section, through the worker's own copy of the ink (v318.36): the chroma ink rule had taken the coloured
// lines for a marker's fill and erased them (0 sections, 'few'). Build makes no colour offer: no section is coloured
// (v319: the picture keeps its colour, the cut being per patch, inkColourCut; until then it was dropped). Fails on
// v318.36 (0 or 1 sections).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in 8 px lines of colour `line`, a 40 px black title band under
// it (2% of the page); as a PNG
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
    g.strokeStyle = o.line;
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
async function settle(page) {
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
}
const warn = (page) =>
  page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
const count = (page) => page.evaluate(() => __mstest.countedList().length);

test('red outlines with a black title band keep all 35 cells (black ones as many); no colour offer for it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await picture(page, { line: '#111', band: true }));
  await settle(page);
  const black = await count(page);
  assert.equal(black, 35, 'black lines: every cell');
  for (const line of ['rgb(220,30,30)', 'rgb(40,60,200)']) {
    await page.setInputFiles('#sfFile', await picture(page, { line, band: true }));
    await settle(page);
    assert.equal(await warn(page), '', line + ': no warning');
    assert.equal(await count(page), black, line + ': every cell');
    assert.ok(await page.evaluate(() => !!__mstest.chroma), line + ': its colour kept (v319)');
    assert.equal(await page.evaluate(() => __mstest.colourSecs().length), 0, line + ': nothing offered');
  }
  // (the ink ran in the worker, the v318.36 path, when there is one)
  const off = await page.evaluate(() => __mstest.segOffCount);
  assert.ok(off == null || off > 0, 'worker runs: ' + off);
  assert.deepEqual(errors, []);
});
