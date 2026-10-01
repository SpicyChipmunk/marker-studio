// The sections editor (Edit sections), driven the way a person would: merge, split, add, include/exclude, undo, the
// size slider, crop and rotate; a Split that misses, Ctrl+Z, the tool row and sliders there, cropping's message, and
// nothing left over from the guide stages.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop, toolStatus, sectionPoint, answerAsks, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

// screen point for an image point
const scr = (page, x, y) => page.evaluate(([x, y]) => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(); return { x: r.left + (x / c.width) * r.width, y: r.top + (y / c.height) * r.height }; }, [x, y]);
const count = (page) => page.evaluate(() => __mstest.countedList ? __mstest.countedList().length : null);
const sig = (page) => page.evaluate(() => __mstest.labelsSig());
async function editor(page) {
  await sampleGuide(page);
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page);
  await scrollTop(page);
}
const tool = (page, m) => page.click(`#sfEdit [data-m="${m}"]`);
// the biggest counted section and its middle row
const biggest = (page) => page.evaluate(() => { const t = __mstest, cl = t.countedList(); let best = cl[0]; for (const l of cl) if (t.comps[l].area > t.comps[best].area) best = l; const p = t.labelPos(best), c = t.comps[best]; return { l: best, x: p.x, y: p.y, x0: c.x0, x1: c.x1 }; });

test('merge two sections, then undo', async () => {
  const { page, errors } = await openApp();
  await editor(page);
  const n0 = await count(page), s0 = await sig(page);
  const [a, b] = await page.evaluate(() => { const t = __mstest, cl = t.countedList(); const adj = (x, y) => { const W = t.W, L = t.labels; for (let i = 0; i < L.length; i++) { if (L[i] !== x) continue; const X = i % W; for (const d of [-3, 3, -3 * W, 3 * W]) { const j = i + d; if (j >= 0 && j < L.length && L[j] === y && Math.abs((j % W) - X) <= 3) return true; } } return false; };
    for (const x of cl) for (const y of cl) if (x < y && t.comps[x].area > 400 && t.comps[y].area > 400 && adj(x, y)) return [x, y]; return [cl[0], cl[1]]; });
  await tool(page, 'merge');
  for (const l of [a, b]) { const p = await page.evaluate((l) => __mstest.labelPos(l), l); const q = await scr(page, p.x, p.y); await page.mouse.click(q.x, q.y); await idle(page); }
  assert.equal(await count(page), n0 - 1, 'one fewer section');
  // the section-edit undo is ↶ in the tool row under the picture
  assert.ok(await page.isVisible('#sfPlanUndo'), 'Undo in the tool row');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await count(page), n0); assert.equal(await sig(page), s0, 'undo restores the sections exactly');
  assert.deepEqual(errors, []);
});

test('split a section with a line, add one with a loop, undo both', async () => {
  const { page, errors } = await openApp();
  await editor(page);
  const n0 = await count(page), s0 = await sig(page), B = await biggest(page);
  await tool(page, 'split');
  const p0 = await scr(page, B.x, B.y), pl = await scr(page, B.x0 - 6, B.y), pr = await scr(page, B.x1 + 6, B.y);
  await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(pl.x, pl.y, { steps: 10 }); await page.mouse.move(pr.x, pr.y, { steps: 20 }); await page.mouse.up(); await idle(page);
  assert.ok(await count(page) > n0, 'the line divided the section');
  // add: a small closed loop inside the biggest remaining section
  const n1 = await count(page), C = await biggest(page), R = 10;
  await tool(page, 'add'); await idle(page);
  if (!(await page.isChecked('#sfAutoClose'))) await page.check('#sfAutoClose');
  const pts = []; for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI * 2; pts.push(await scr(page, C.x + Math.cos(t) * R * 3, C.y + Math.sin(t) * R * 3)); }
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 2 }); await page.mouse.up(); await idle(page);
  assert.ok(await count(page) > n1, 'the loop added a section');
  await page.click('#sfPlanUndo'); await idle(page); await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await sig(page), s0, 'two undos: back to the start');
  assert.deepEqual(errors, []);
});

test('include / exclude and the size slider change what the guide colours', async () => {
  const { page, errors } = await openApp();
  await editor(page);
  const n0 = await count(page), B = await biggest(page);
  await tool(page, 'toggle'); await idle(page);
  const q = await scr(page, B.x, B.y); await page.mouse.click(q.x, q.y); await idle(page);
  assert.equal(await count(page), n0 - 1, 'tapped section excluded');
  await buildGo(page); await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 0); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l], B.l), undefined, 'excluded section gets no marker');
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await count(page), n0, 'undo includes it again');
  await page.evaluate(() => { const el = document.getElementById('sfMin'); el.value = 95; el.dispatchEvent(new Event('input', { bubbles: true })); }); await idle(page);
  assert.ok(await count(page) < n0, 'a bigger minimum size drops small sections');
  assert.deepEqual(errors, []);
});

test('crop and rotate rebuild the picture at the new shape', async () => {
  const { page, errors } = await openApp();
  await editor(page);
  const d0 = await page.evaluate(() => [__mstest.W, __mstest.H]);
  await page.click('#sfAdjToggle'); await idle(page);
  await page.click('#sfRotR'); await idle(page, 1200);
  const d1 = await page.evaluate(() => [__mstest.W, __mstest.H]);
  assert.ok(d0[0] < d0[1] && d1[0] > d1[1], `rotated: ${d0} -> ${d1}`);
  await page.click('#sfCrop'); await idle(page);
  const c = await page.locator('#sfCanvas').boundingBox();
  await page.mouse.move(c.x + c.width * 0.1, c.y + c.height * 0.1); await page.mouse.down(); await page.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.7, { steps: 8 }); await page.mouse.up();
  await page.click('#sfCropApply'); await idle(page, 1200);
  const d2 = await page.evaluate(() => [__mstest.W, __mstest.H]);
  assert.ok(d2[0] < d1[0] * 0.7 && d2[1] < d1[1] * 0.8, `cropped: ${d1} -> ${d2}`);
  assert.ok(await count(page) > 5, 'sections found in the crop');
  await buildGo(page); await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 0);
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
test('back in the sections editor there is no sun or colour picker left over', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  assert.ok(await page.isVisible('#sfSun'));
  await page.click('#sfBack2'); await idle(page);
  assert.ok(!(await page.isVisible('#sfSun')), 'sun hidden');
  assert.ok(!(await page.isVisible('#sfSheet')), 'no picker');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
test('a Split stroke that does not divide the section leaves nothing behind', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await page.click('#sfBack2'); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest; let best = 0, ba = 0; for (let l = 1; l < t.comps.length; l++) if (t.counted(l) && t.comps[l].area > ba) { ba = t.comps[l].area; best = l; }
    const c = t.comps[best], x = Math.round(c.cx), y = Math.round(c.cy), u0 = t.undoCount, sig = t.labelsSig();
    // a short dab in the middle: it can't cut the section in two
    const made = t.splitAt(best, [{ x, y }, { x: x + 2, y }]);
    return { made, undo: t.undoCount - u0, same: t.labelsSig() === sig };
  });
  assert.deepEqual(r, { made: 0, undo: 0, same: true });
  assert.match(await page.textContent('#sfHint'), /didn’t divide the section/);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);

test('Edit sections: the section count only in the tool row; the two sliders line up', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page);
  assert.equal(await page.isVisible('#sfCount'), false);
  assert.match(await toolStatus(page), /^\d+ sections$/);
  const a = await rect(page, '#sfMin'), b = await rect(page, '#sfBg');
  assert.ok(Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1, 'same left and width');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
test('turn then crop: each is its own Undo step', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await answerAsks(page);
  await page.click('#sfBack2'); await page.click('#sfAdjToggle'); await page.click('#sfRotR'); await idle(page);
  const w1 = await page.evaluate(() => __mstest.W);
  await page.click('#sfAutoCrop'); await idle(page);
  assert.ok(await page.evaluate(() => !!__mstest.cropRect), 'cropped');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.rot90, !!__mstest.cropRect, __mstest.W]), [90, false, w1], 'one Undo: turned, not cropped');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.rot90, !!__mstest.cropRect]), [0, false], 'two: as it was');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }

test('cropping: no Full screen button, and the instruction is said once (in the pane, not again in a toast)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  assert.equal(await page.isVisible('#sfFull'), true);
  await page.click('#sfBack2'); await idle(page); await page.click('#sfAdjToggle'); await page.click('#sfCrop'); await idle(page);
  assert.equal(await page.isVisible('#sfFull'), false, 'Full screen is gone while cropping');
  assert.equal(await page.isVisible('#sfZin'), true, 'zoom stays');
  assert.doesNotMatch(await toastText(page), /Drag a box/, 'no toast repeating the pane');
  assert.match(await page.textContent('#sfCtl'), /Drag a box over the area to keep/);
  await page.click('#sfCropCancel'); await idle(page);
  assert.equal(await page.isVisible('#sfFull'), true, 'back after cropping');
  assert.deepEqual(errors, []);
});

test('Ctrl+Z in Edit sections undoes the last section edit, as ↶ Undo does (not while typing or with a sheet open)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const n0 = await page.evaluate(() => __mstest.undoCount);
  const [l] = await bigSections(page, 1);
  await tapSection(page, l); await idle(page);
  const n1 = await page.evaluate(() => __mstest.undoCount);
  assert.equal(n1, n0 + 1, 'the tap is an edit');
  await page.focus('#sfMore'); await page.click('#sfMore'); await page.waitForSelector('#sfSheet');
  await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.undoCount), n1, 'not behind a sheet');
  await page.keyboard.press('Escape'); await idle(page);
  await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.undoCount), n0, 'undone');
  assert.equal(await page.isVisible('#sfPlanUndo'), n0 > 0);
  assert.deepEqual(errors, []);
});
