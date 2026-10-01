// Radial's centre (v282): with Gradient › Radial, a ⊕ on the picture (Pattern tab only) marks where the rings start.
// Drag it, or move it with the arrow keys; the whole drag is one Undo step. "Back to the middle" puts it back. Each
// zone has its own (a new zone's rings start in its own middle), and it is saved with the guide.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const vis = (page) => page.evaluate(() => { const e = document.getElementById('sfRadC'); return !!e && e.style.display !== 'none' && e.offsetParent !== null; });
const radC = (page) => page.evaluate(() => __mstest.styleVars.radC);
const first = (page) => page.evaluate(() => __mstest.assignData.order.slice(0, 6).join(','));
// the handle's middle on the screen, and the picture's box
const handle = (page) => page.$eval('#sfRadC', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const picBox = (page) => page.$eval('#sfCanvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

test('the ⊕ shows with Radial on the Pattern tab only; a drag moves the rings’ centre, one Undo step; the keys move it too; Back to the middle', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await vis(page), false, 'not with Serpentine');
  assert.equal(await page.$('#sfRadNote'), null);
  await page.click('#sfShape [data-v="radial"]'); await idle(page);
  assert.equal(await vis(page), true);
  assert.match(await page.textContent('#sfRadNote'), /Centre: in the middle · drag the centre mark on the picture to move it/);
  assert.equal(await page.$('#sfRadReset'), null);
  assert.equal(await radC(page), null);
  // it sits in the middle of the picture
  await scrollTop(page);
  let h = await handle(page), b = await picBox(page);
  assert.ok(Math.abs(h.x - (b.x + b.w / 2)) < 3 && Math.abs(h.y - (b.y + b.h / 2)) < 3, 'in the middle');
  const o1 = await first(page), undo0 = await page.getAttribute('#sfPlanUndo', 'aria-label');
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  await page.mouse.move(b.x + b.w * 0.5, b.y + b.h * 0.3, { steps: 4 });
  await page.mouse.move(b.x + b.w * 0.2, b.y + b.h * 0.15, { steps: 8 }); await page.mouse.up(); await idle(page);
  const c = await radC(page);
  assert.ok(Math.abs(c.x - 0.2) < 0.02 && Math.abs(c.y - 0.15) < 0.02, JSON.stringify(c));
  assert.notEqual(await first(page), o1, 'the rings start there now');
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Radial centre moved');
  h = await handle(page);
  assert.ok(Math.abs(h.x - (b.x + b.w * 0.2)) < 3 && Math.abs(h.y - (b.y + b.h * 0.15)) < 3, 'the ⊕ where it was let go');
  assert.match(await page.textContent('#sfRadNote'), /Centre: moved/);
  // one Undo step for the whole drag
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await radC(page), null);
  assert.equal(await first(page), o1);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), undo0);
  // the keys: a twentieth of the picture a press
  await page.focus('#sfRadC');
  await page.keyboard.press('ArrowRight'); await idle(page);
  await page.keyboard.press('ArrowUp'); await idle(page);
  assert.deepEqual(await radC(page), { x: 0.55, y: 0.45 });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRadC', 'the ⊕ keeps the focus');
  // Back to the middle
  await page.click('#sfRadReset'); await idle(page);
  assert.equal(await radC(page), null);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Radial centre back to the middle');
  assert.match(await page.textContent('#sfRadNote'), /Centre: in the middle/);
  // the other tabs, Colour along and Reveal have no ⊕
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.equal(await vis(page), false);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await vis(page), true);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await vis(page), false);
  await page.click('#sfDoneBtn'); await idle(page);
  assert.equal(await vis(page), true);
  // it keeps to its place on the picture as the picture zooms (shading off: there's no sun to move it along)
  await page.focus('#sfRadC'); await page.keyboard.press('ArrowLeft'); await idle(page);
  await page.click('#sfZin'); await idle(page, 400);
  const c2 = await radC(page), h2 = await handle(page), b2 = await picBox(page);
  assert.ok(Math.abs(h2.x - (b2.x + b2.w * c2.x)) < 3 && Math.abs(h2.y - (b2.y + b2.h * c2.y)) < 3, 'on its place after zooming in');
  await page.click('#sfZrst'); await idle(page, 400);
  // a new picture: the middle again (a place on the old one means nothing there)
  assert.ok(await radC(page));
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => __mstest.assignData, null, { timeout: 10000 }); await idle(page, 1200);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await radC(page), null);
  // (another flow: gone)
  await page.click('#sfShape [data-v="diagonal"]'); await idle(page);
  assert.equal(await vis(page), false);
  assert.deepEqual(errors, []);
});

test('each zone has its own centre (a new one starts in its middle), hidden while choosing sections; saved with the guide', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfShape [data-v="radial"]'); await idle(page);
  await page.focus('#sfRadC');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await idle(page);
  const mainC = await radC(page);
  assert.ok(Math.abs(mainC.x - 0.3) < 1e-9);
  await page.click('#sfZoneAdd'); await idle(page);
  assert.equal(await vis(page), false, 'not while choosing the zone’s sections');
  await page.evaluate(() => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).filter((l) => t.comps[l].cy > t.H * 0.6); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); });
  await page.click('#sfZoneDone'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'radial', 'the new zone’s flow is Main’s');
  assert.equal(await radC(page), null, 'but its rings start in its own middle');
  await scrollTop(page);
  const h = await handle(page), b = await picBox(page);
  const box = await page.evaluate(() => { const t = __mstest, bx = t.zoneBoxOf(t.zoneSecs(t.zoneCur)); return { x: (bx.x0 + bx.x1) / 2 / t.W, y: (bx.y0 + bx.y1) / 2 / t.H }; });
  assert.ok(Math.abs(h.x - (b.x + b.w * box.x)) < 3 && Math.abs(h.y - (b.y + b.h * box.y)) < 3, 'the ⊕ in the zone’s middle');
  await page.focus('#sfRadC'); await page.keyboard.press('ArrowDown'); await idle(page);
  const zC = await radC(page);
  // Main keeps its own
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  assert.deepEqual(await radC(page), mainC);
  // saved and opened again
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  assert.deepEqual(d.payload.style.radC, mainC);
  assert.deepEqual(d.payload.zones[0].style.radC, zC);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  assert.deepEqual(await radC(page), mainC);
  assert.deepEqual(await page.evaluate(() => __mstest.zones[0].st.radC), zC);
  assert.deepEqual(errors, []);
});
