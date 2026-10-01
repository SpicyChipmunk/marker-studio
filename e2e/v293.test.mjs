// v293: zoomed in, the codes are drawn on a sharper canvas of their own over the picture (they were blurry, magnified
// from the picture's own pixels); it lines up with the picture, follows pan and zoom, and goes when zoomed out, in Edit
// sections and in focus mode.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const hi = (page) => page.evaluate(() => {
  const h = document.getElementById('sfLabHi'), c = document.getElementById('sfCanvas');
  if (!h || h.style.display === 'none') return null;
  const a = h.getBoundingClientRect(), b = c.getBoundingClientRect();
  return { w: h.width, cw: c.width, dx: a.left - b.left, dy: a.top - b.top, dw: a.width - b.width, dh: a.height - b.height };
});

test('zoomed in, the codes are on a sharper canvas over the picture, lined up with it; gone zoomed out, in Edit sections and in focus mode', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  assert.equal(await hi(page), null, 'not at 1×');
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await page.waitForFunction(() => { const h = document.getElementById('sfLabHi'); return h && h.style.display !== 'none' && h.width > 0; });
  const a = await hi(page);
  assert.ok(a.w > a.cw * 1.5, `more pixels than the picture's (${a.w} vs ${a.cw})`);
  for (const k of ['dx', 'dy', 'dw', 'dh']) assert.ok(Math.abs(a[k]) <= 1.5, `lined up: ${k} ${a[k]}`);
  // panned: still lined up
  const v = await page.locator('#sfView').boundingBox();
  await page.mouse.move(v.x + v.width / 2, v.y + 150); await page.mouse.down(); await page.mouse.move(v.x + v.width / 2 - 60, v.y + 90, { steps: 4 }); await page.mouse.up(); await idle(page);
  const b = await hi(page);
  for (const k of ['dx', 'dy', 'dw', 'dh']) assert.ok(Math.abs(b[k]) <= 1.5, `lined up after a pan: ${k} ${b[k]}`);
  // zoomed out: gone
  await page.click('#sfZout'); await page.click('#sfZout'); await idle(page);
  await page.waitForFunction(() => { const h = document.getElementById('sfLabHi'); return !h || h.style.display === 'none'; });
  // Edit sections and focus mode: none
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  assert.equal(await hi(page), null, 'not over Edit sections');
  await page.click('#sfToPlan'); await idle(page);
  await page.click('#sfColor'); await idle(page); await page.click('#sfFocus'); await idle(page);
  assert.equal(await hi(page), null, 'not in focus mode');
  assert.deepEqual(errors, []);
});
