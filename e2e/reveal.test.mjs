// Reveal: its solid bar, closing with the X or Escape, and starting zoomed out without planning marks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the UX polish pass ----
const box = (page, sel) => page.locator(sel).boundingBox();

// Reveal's animation takes about 4.6 s by the clock (3.4 s, a 0.9 s hold, then Close), drawing the whole picture each
// frame; on GitHub's WebKit frames can come so slowly that 15 s wasn't always enough (run 22). Allow 30 s.
const REV_WAIT = 30000;
test('Reveal has a solid bar and closes with the X or Escape', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfReveal'); await page.waitForSelector('#revDone', { timeout: REV_WAIT });
  const cv = await box(page, '#sfCanvas'), bar = await box(page, '#sfRevealBar');
  assert.ok(cv.y + cv.height <= bar.y + 1, 'the picture stops above the bar');
  assert.ok(!(await page.isVisible('#sfZoomCtl')), 'zoom buttons hidden');
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(!(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'))), 'Escape closes Reveal');
  await page.click('#sfReveal'); await page.waitForSelector('#revDone', { timeout: REV_WAIT });
  await page.click('#sfRevX'); await idle(page);
  assert.ok(!(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'))), 'the X closes Reveal');
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('Reveal starts zoomed out and without planning marks', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfReveal'); await page.waitForSelector('#revDone', { timeout: REV_WAIT });
  const r = await page.evaluate(() => { const c = document.getElementById('sfCanvas'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let white = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) white++; return { zoom: __mstest.zoom, white }; });
  assert.equal(r.zoom, 1);
  assert.ok(r.white < 50, `no white anchor rings (${r.white})`);
  assert.deepEqual(errors, []);
});
