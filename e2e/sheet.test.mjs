// The section tip and the shared sheet (Release 3, #2, docs/GUIDE-LAYOUT.md): the tip sits outside the shrinking
// picture, above or below the tapped section and never over it, and closes on scroll; Change colour, Manual's picker,
// the Paint brush picker and Blend's anchor menu are the shared sheet under the picture pinned at its floor size, with
// a pulsing outline on the section(s) being changed; a tap on another section keeps the pick (one Undo step) and
// moves the sheet there. Also: sheets in portrait (the page locked while open) and on a tablet.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, until } from './helpers.mjs';

before(setup);
after(teardown);

// the app with console errors collected alongside page errors
async function open(opts) {
  const app = await openApp(opts);
  app.page.on('console', (m) => { if (m.type() === 'error') app.errors.push('console: ' + m.text()); });
  await sampleGuide(app.page);
  return app;
}
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// big sections whose label points show on the picture (above an open sheet and the tool row), biggest first
const shownSecs = (page, n = 8, not = []) => page.evaluate(([n, not]) => {
  const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), sh = document.getElementById('sfSheet'), z = document.getElementById('sfZoomCtl').getBoundingClientRect(), k = r.width / c.width;
  const bot = Math.min(r.bottom, innerHeight, sh && !sh.classList.contains('sfshside') ? sh.getBoundingClientRect().top : 1e9, z.top > r.top + 20 ? z.top : 1e9), top = Math.max(r.top, 0);
  return t.assignData.order.filter((l) => !not.includes(l)).filter((l) => { const q = t.labelPos(l), x = r.left + q.x * k, y = r.top + q.y * k; return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5; })
    .sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n);
}, [n, not]);
const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
const lock = (page, l) => page.evaluate((l) => __mstest.locks[l] ?? null, l);
const plans = (page) => page.evaluate(() => __mstest.planCount);
const outlined = (page) => page.evaluate(() => { const o = document.querySelector('.sfoutline'); return o && o.style.display !== 'none' && o.dataset.secs ? o.dataset.secs.split(' ').map(Number) : []; });
const pickerOpen = (page) => page.evaluate(() => !!document.querySelector('#sfSheet.sfpicksh'));
// a click on a section's label point where it is on the screen now (no scrolling)
async function click(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
// a marker from a family other than `not`'s
const otherKey = (page, not) => page.evaluate((not) => { const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')]; const cur = b.find((x) => x.dataset.k === not); const g = cur && cur.closest('.sfswg'); return b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g).dataset.k; }, not);
const pickTile = (page, k) => page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
async function changeColour(page, l) { await scrollTop(page); await click(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page); }
async function pattern(page, v) { await page.click('.sftabbtn[data-t="pattern"]'); await page.click(`#sfFam [data-v="${v}"]`); await idle(page); }
// the section's box on the screen (from its pixels)
const secBox = (page, l) => page.evaluate((l) => { const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), k = r.width / t.W; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < t.H; y++) for (let x = 0; x < t.W; x++) if (t.labels[y * t.W + x] === l) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { left: r.left + x0 * k, top: r.top + y0 * k, right: r.left + (x1 + 1) * k, bottom: r.top + (y1 + 1) * k }; }, l);

for (const [w, h, avail] of [[390, 844, 420], [375, 667, 356]]) {
  test(`${w}×${h}: Change colour opens as a sheet under the picture pinned at its floor size, never over it`, async () => {
    const { page, errors } = await open({ width: w, height: h });
    const [l] = await shownSecs(page, 1);
    await changeColour(page, l);
    // (waiting for the sheet to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished)
    await until(page, ([w, h]) => { const s = document.getElementById('sfSheet').getBoundingClientRect(); return Math.abs(s.bottom - h) < 1 && s.left === 0 && s.width === w; }, [w, h], 'the sheet in place', 15000).catch(() => {});
    const g = await page.evaluate(() => ({ s: __mstest.picScale, geo: __mstest.geo, y: scrollY, lock: getComputedStyle(document.documentElement).overflow }));
    // (v289: on a short phone the Plan's picture may start at its floor already, so that the tabs show)
    assert.ok(Math.abs(g.s - g.geo.comp / g.geo.full) < 0.003, `picture at its floor size (${g.s} vs ${g.geo.comp / g.geo.full})`);
    const sh = await rect(page, '#sfSheet'), cv = await rect(page, '#sfCanvas'), v = await rect(page, '#sfView');
    assert.ok(sh.top >= v.bottom - 0.5 && sh.top >= cv.bottom - 0.5, `the sheet starts under the picture (${sh.top} vs ${v.bottom})`);
    assert.ok(Math.abs(sh.bottom - h) < 1 && sh.left === 0 && sh.width === w, 'to the bottom of the screen, across it');
    assert.ok(Math.abs(sh.height - avail) < 12, `about ${avail}px of room: ${sh.height}`);
    // header: title and the code field, never focused by itself; footer Cancel / Done
    assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
    assert.ok(await page.evaluate(() => document.getElementById('sfSheet').querySelector('.sfshhd #sfPopFilter') !== null));
    assert.deepEqual(await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.id + ':' + x.textContent)), ['sfPopCancel:Cancel', 'sfPopConfirm:Done']);
    assert.ok(await page.evaluate(() => document.activeElement.id !== 'sfPopFilter' && document.getElementById('sfSheet').contains(document.activeElement)), 'focus in the sheet, not in the code field');
    // the outline on the tapped section, pulsing
    assert.deepEqual(await outlined(page), [l]);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).animationName), 'sfolpulse');
    const ol = await rect(page, '.sfoutline'), bx = await secBox(page, l);
    assert.ok(ol.left <= bx.left && ol.top <= bx.top && ol.right >= bx.right && ol.bottom >= bx.bottom && ol.width < bx.right - bx.left + 20, 'the outline is round that section');
    // the page doesn't scroll under the sheet
    assert.equal(g.lock, 'hidden');
    await page.mouse.move(cv.left + cv.width / 2, cv.top + 30); await page.mouse.wheel(0, 300); await idle(page);
    assert.equal(await page.evaluate(() => scrollY), g.y, 'page scroll locked');
    // Done: nothing picked, nothing saved; the page stays where the sheet put it
    const n0 = await plans(page);
    await page.click('#sfPopConfirm'); await idle(page);
    assert.equal(await pickerOpen(page), false);
    assert.equal(await plans(page), n0);
    assert.deepEqual(await outlined(page), [], 'outline gone');
    assert.equal(await page.evaluate(() => scrollY), g.y);
    assert.deepEqual(errors, []);
  });
}

test('the tip keeps its size outside the shrunk picture, never covers its section, and closes on scroll', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  // shrink the picture to its floor
  const top0 = await page.evaluate(() => document.getElementById('sfView').getBoundingClientRect().top + scrollY);
  await page.evaluate((y) => new Promise((r) => { scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(r)); }), Math.round(top0) + 120);
  assert.ok(await page.evaluate(() => __mstest.picScale < 1 && Math.abs(__mstest.picScale - __mstest.geo.comp / __mstest.geo.full) < 0.003), 'picture shrunk');
  const ls = await shownSecs(page, 40), tried = [];
  // sections from the top, middle and bottom of the picture, big and small
  const pick = await page.evaluate((ls) => { const t = __mstest, f = (l) => t.labelPos(l).y / t.H; return [ls.find((l) => f(l) < 0.25), ls.find((l) => f(l) > 0.4 && f(l) < 0.6), ls.find((l) => f(l) > 0.75), ls[ls.length - 1]].filter((l) => l != null); }, ls);
  for (const l of pick) {
    await click(page, l); await page.waitForSelector('.sftip');
    const t = await rect(page, '.sftip'), b = await secBox(page, l), v = await rect(page, '#sfView');
    const unscaled = await page.evaluate(() => { const e = document.querySelector('.sftip'); return Math.abs(e.getBoundingClientRect().height - e.offsetHeight) < 0.5 && !e.closest('#sfPic'); });
    assert.ok(unscaled, 'not in the scaled wrapper');
    const clear = t.bottom <= Math.max(b.top, v.top) + 0.5 || t.top >= Math.min(b.bottom, v.bottom) - 0.5 || t.right <= b.left || t.left >= b.right;
    assert.ok(clear, `tip clear of section ${l}: tip ${JSON.stringify(t)} section ${JSON.stringify(b)}`);
    assert.ok(t.left >= 0 && t.right <= 390 && t.top >= 0 && t.bottom <= 844, 'on the screen');
    tried.push(t.bottom <= b.top + 0.5 ? 'above' : 'below');
  }
  assert.ok(tried.includes('above'), 'above where there is room: ' + tried);
  // a section at the top of the pinned picture has no room above: the tip goes below it
  const topL = await page.evaluate(() => { const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), k = r.width / t.W;
    return t.assignData.order.filter((l) => { const q = t.labelPos(l), y = r.top + q.y * k; return y > r.top + 8 && y < r.top + 60 && q.r * k > 5; }).sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; });
  if (topL != null) { await click(page, topL); const t = await rect(page, '.sftip'), b = await secBox(page, topL); assert.ok(t.top >= Math.min(b.bottom, (await rect(page, '#sfView')).bottom) - 0.5, 'below a section at the top'); }
  // scrolling closes it
  await page.evaluate(() => scrollBy(0, -40)); await idle(page);
  assert.equal(await page.locator('.sftip').count(), 0, 'closed on scroll');
  assert.deepEqual(errors, []);
});

test('Everywhere outlines every section it changes; the scope starts at Only this section each time; steady with reduced motion', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ls = await shownSecs(page, 20);
  const l = await page.evaluate((ls) => { const a = __mstest.assignData.assign; return ls.find((l) => Object.keys(a).filter((x) => a[x].mkey === a[l].mkey).length > 2); }, ls);
  await changeColour(page, l);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).animationName), 'none', 'a steady outline');
  const n = +(await page.textContent('.sfpopscope [data-sc="all"]')).match(/\((\d+) sections\)/)[1];
  const same = await page.evaluate((l) => { const a = __mstest.assignData.assign; return Object.keys(a).filter((x) => a[x].mkey === a[l].mkey).map(Number); }, l);
  await pickTile(page, await otherKey(page, await mk(page, l)));
  await page.click('.sfpopscope [data-sc="all"]'); await idle(page);
  const o = await outlined(page);
  assert.equal(o.length, n, `${n} outlined`);
  assert.deepEqual(o.slice().sort((a, b) => a - b), same.slice().sort((a, b) => a - b));
  // a tap on one of them changes nothing
  const other = (await shownSecs(page, 60)).find((x) => x !== l && same.includes(x));
  if (other != null) { await click(page, other); assert.equal((await outlined(page)).length, n, 'still the same sheet'); }
  await page.click('.sfpopscope [data-sc="one"]'); await idle(page);
  assert.deepEqual(await outlined(page), [l]);
  await page.click('.sfpopscope [data-sc="all"]'); await page.click('#sfPopCancel'); await idle(page);
  // opened again: Only this section
  await changeColour(page, l);
  assert.deepEqual(await page.$$eval('.sfpopscope [data-sc]', (b) => b.map((x) => x.getAttribute('aria-pressed'))), ['true', 'false']);
  assert.deepEqual(await outlined(page), [l]);
  assert.deepEqual(errors, []);
});

test('a tap on another section keeps the pick as one Undo step and moves the sheet; nothing saved when nothing was picked', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  const [l1] = await shownSecs(page, 1), o1 = await mk(page, l1);
  await changeColour(page, l1);
  await page.evaluate(() => { document.getElementById('sfSheet').__mark = 1; });
  const n0 = await plans(page), y0 = await page.evaluate(() => scrollY);
  const k1 = await otherKey(page, o1); await pickTile(page, k1); await idle(page);
  assert.equal(await plans(page), n0, 'a preview is no step yet');
  const [l2, l3, l4] = await shownSecs(page, 3, [l1]), o2 = await mk(page, l2), o3 = await mk(page, l3);
  await click(page, l2);
  assert.equal(await mk(page, l1), k1); assert.equal(await lock(page, l1), k1, 'first pick kept, pinned');
  assert.equal(await plans(page), n0 + 1, 'one Undo step');
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').__mark === 1), 'the same sheet, moved');
  assert.equal(await page.evaluate(() => scrollY), y0, 'nothing moved on the page');
  const c2 = await page.evaluate((l) => __mstest.assignData.assign[l].code, l2);
  assert.match(await page.textContent('#sfSheet .sfpops'), new RegExp('Now ' + c2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the sheet is for the new section');
  assert.deepEqual(await outlined(page), [l2]);
  const sc = await page.$$eval('.sfpopscope [data-sc]', (b) => b.map((x) => x.getAttribute('aria-pressed')));
  assert.ok(!sc.length || sc[0] === 'true', 'scope back to Only this section');
  await idle(page);
  assert.match(await page.textContent('#sfLive'), new RegExp('Now changing the section with ' + c2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // nothing picked for this one: moving on saves nothing
  await click(page, l3);
  assert.equal(await plans(page), n0 + 1, 'no step for a section left as it was');
  assert.equal(await mk(page, l2), o2); assert.equal(await lock(page, l2), null);
  assert.deepEqual(await outlined(page), [l3]);
  // tapping the same section again changes nothing
  await click(page, l3); assert.deepEqual(await outlined(page), [l3]); assert.ok(await pickerOpen(page));
  // pick for this one, then Cancel: only this section's preview goes
  const k3 = await otherKey(page, o3); await pickTile(page, k3); await idle(page);
  assert.equal(await mk(page, l3), k3);
  await page.click('#sfPopCancel'); await idle(page);
  assert.equal(await pickerOpen(page), false);
  assert.equal(await mk(page, l3), o3, 'Cancel undid this section');
  assert.equal(await mk(page, l1), k1, 'and kept the earlier one');
  assert.equal(await plans(page), n0 + 1);
  // Escape is Cancel
  await changeColour(page, l4);
  const before4 = await mk(page, l4); await pickTile(page, await otherKey(page, before4)); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await pickerOpen(page), false); assert.equal(await mk(page, l4), before4, 'Escape undid it');
  // two kept picks are two Undo steps
  await changeColour(page, l2); await pickTile(page, await otherKey(page, o2)); await click(page, l3); await pickTile(page, await otherKey(page, o3)); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await plans(page), n0 + 3);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await mk(page, l3), o3); assert.notEqual(await mk(page, l2), o2);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await mk(page, l2), o2); assert.equal(await mk(page, l1), k1);
  assert.deepEqual(errors, []);
});

test('Manual picker and the Paint brush picker are the same sheet', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  await pattern(page, 'manual');
  const [l] = await shownSecs(page, 1);
  await scrollTop(page); await click(page, l);
  assert.ok(await pickerOpen(page), 'a tap in Manual opens the sheet');
  assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
  assert.ok((await rect(page, '#sfSheet')).top >= (await rect(page, '#sfView')).bottom - 0.5, 'under the picture');
  assert.deepEqual(await outlined(page), [l]);
  const k1 = await otherKey(page, await mk(page, l)); await pickTile(page, k1);
  const [l2] = await shownSecs(page, 1, [l]); const n0 = await plans(page);
  await click(page, l2);
  assert.equal(await mk(page, l), k1); assert.equal(await plans(page), n0 + 1);
  assert.deepEqual(await outlined(page), [l2], 'moved to the next section');
  await page.click('#sfPopCancel'); await idle(page);
  // the brush
  await scrollTop(page);
  await page.click('#sfPaint'); await idle(page);
  await page.click('#sfBrush'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Paint with');
  assert.ok((await rect(page, '#sfSheet')).top >= (await rect(page, '#sfView')).bottom - 0.5, 'under the picture');
  assert.deepEqual(await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.textContent)), ['Cancel', 'Done']);
  const k2 = await page.evaluate(() => [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== __mstest.paintKey).dataset.k);
  await pickTile(page, k2); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintKey), k2);
  assert.equal(await pickerOpen(page), false);
  assert.deepEqual(errors, []);
});

test('Blend: the section and anchor menus are the sheet; a tap while it is open moves it and adds no anchor', async () => {
  const { page, errors } = await open({ width: 390, height: 844 });
  await pattern(page, 'blend');
  await scrollTop(page);
  const n0 = await page.evaluate(() => __mstest.anchors.length);
  const far = (ls) => page.evaluate((ls) => ls.filter((l) => { const t = __mstest, c = t.comps[l], tol = Math.max(t.W, t.H) * 0.06; return t.anchors.every((a) => Math.hypot(a.x - c.cx, a.y - c.cy) > tol && Math.hypot(a.x - t.labelPos(l).x, a.y - t.labelPos(l).y) > tol); }), ls);
  const [l1] = await far(await shownSecs(page, 12));
  // press and hold: the tip; Change colour: the sheet
  const p = await sectionPoint(page, l1);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await idle(page); await page.mouse.up(); await idle(page);
  await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  assert.deepEqual(await outlined(page), [l1]);
  // a tap on another section moves it there, and adds no anchor
  const [l2] = await far(await shownSecs(page, 12, [l1]));
  await click(page, l2);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'no anchor added');
  assert.ok(await pickerOpen(page)); assert.deepEqual(await outlined(page), [l2], 'moved to the tapped section');
  // a tap on an anchor: its menu, in the same sheet
  const ap = await page.evaluate(() => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), sh = document.getElementById('sfSheet').getBoundingClientRect(), t = __mstest;
    const i = t.anchors.findIndex((a) => { const y = r.top + a.y / t.H * r.height; return y > Math.max(r.top, 0) + 10 && y < sh.top - 10; }); if (i < 0) return null; const a = t.anchors[i]; return { i, x: r.left + a.x / t.W * r.width, y: r.top + a.y / t.H * r.height }; });
  assert.ok(ap, 'an anchor above the sheet');
  await page.mouse.click(ap.x, ap.y); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Anchor ' + (ap.i + 1));
  assert.equal(await page.textContent('#sfPopExtra'), 'Remove anchor');
  assert.deepEqual(await outlined(page), []);
  // and from the anchor menu, a tap on a section moves to that section
  await click(page, l1);
  assert.equal(await page.textContent('#sfSheetT'), 'Change colour'); assert.deepEqual(await outlined(page), [l1]);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'still no anchor added');
  await page.click('#sfPopConfirm'); await idle(page);
  // with the sheet closed, a tap adds an anchor again
  await click(page, l2);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1);
  assert.deepEqual(errors, []);
});

test('side by side (844×390): the sheet covers the controls column, beside the picture', async () => {
  const { page, errors } = await open({ width: 844, height: 390 });
  const [l] = await shownSecs(page, 1);
  await changeColour(page, l);
  const sh = await rect(page, '#sfSheet'), v = await rect(page, '#sfView'), cv = await rect(page, '#sfCanvas'), ctl = await rect(page, '#sfCtl');
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').classList.contains('sfshside')));
  assert.ok(sh.left >= v.right - 0.5 && sh.left >= cv.right - 0.5, 'beside the picture, not over it');
  assert.ok(sh.left <= ctl.left + 0.5 && Math.abs(sh.right - 844) < 1 && sh.top === 0 && Math.abs(sh.height - 390) < 1, 'over the whole controls column: ' + JSON.stringify([sh, ctl]));
  // a tap on the picture moves it here too
  const [l2] = await shownSecs(page, 1, [l]); await click(page, l2);
  assert.deepEqual(await outlined(page), [l2]);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await pickerOpen(page), false);
  assert.deepEqual(errors, []);
});

// ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
const picH = (page) => page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
// scroll the page and let the shrink (a requestAnimationFrame after the scroll) catch up
const scrollAt = (page, y) => page.evaluate((y) => new Promise((r) => { window.scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY))); }), y);

test('sheets: portrait from under the pinned picture to the bottom; the page is locked while open; Escape and focus', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await scrollAt(page, 0);
  await page.focus('#sfMore'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sheetOpen()), true);
  // (waiting for the sheet to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished, run 23)
  await until(page, () => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().bottom - innerHeight) <= 1, null, 'the sheet at the bottom', 15000).catch(() => {});
  // the page moved so the picture is pinned at its floor size; the menu is as tall as its items, at the bottom, never
  // over the pinned block (pickers take all the room under it: sheet.test.mjs)
  const v = await rect(page, '#sfView'), s = await rect(page, '#sfSheet'), c = await rect(page, '#sfCanvas');
  assert.equal(await picH(page), 380, 'picture at its floor size');
  assert.ok(s.top >= v.bottom - 1 && s.top >= c.bottom, `sheet under the pinned block (${s.top} vs ${v.bottom})`);
  assert.ok(await page.evaluate(() => { const b = document.querySelector('#sfSheet .sfshbody'); return b.scrollHeight <= b.clientHeight + 1; }), 'sized to its content');
  assert.ok(Math.abs(s.bottom - 844) <= 1, 'to the bottom of the screen');
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)), 'focus moved into the sheet');
  assert.equal(await page.evaluate(() => [document.getElementById('sfSheet').getAttribute('role'), document.getElementById('sfSheet').getAttribute('aria-modal')].join()), 'dialog,true');
  // header, a scrolling body, a footer
  assert.deepEqual(await page.$$eval('#sfSheet > *', (k) => k.map((x) => x.className)), ['sfshhd', 'sfshbody', 'sfshft']);
  // locked: a wheel over the page doesn't scroll it; the picture still zooms
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.move(195, s.top - 30 > 0 ? 100 : 100); await page.mouse.wheel(0, 400); await idle(page);
  await page.mouse.move(195, s.top + 40); await page.mouse.wheel(0, 400); await idle(page);
  assert.equal(await page.evaluate(() => scrollY), y0, 'the page does not scroll');
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control'); await idle(page);
  assert.ok(await page.evaluate(() => __mstest.zoom) > 1, 'pinch (ctrl + wheel) still zooms the picture');
  // Tab stays inside
  for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)), 'Tab stays in the sheet');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sheetOpen()), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
  assert.equal(await page.evaluate(() => scrollY), 0, 'the page is back where it was');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'visible', 'unlocked');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const SHOTS = process.env.SHOTS || '';
const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
async function openChangeColour(page, l) { await scrollTop(page); await tapSection(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page); }

test('on a tablet in portrait sheets are as wide as the guide card, centred over it; on a phone the whole width', async () => {
  for (const [w, h] of [[820, 1180], [768, 1024], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    await page.click('#sfMore'); await page.waitForSelector('#sfSheet'); await idle(page);
    const s = await rect(page, '#sfSheet'), c = await rect(page, '#sfWork');
    if (w === 390) assert.ok(s.left <= 0.5 && s.right >= w - 0.5, 'phone: the whole width');
    else {
      // (v285: the card is up to 92% of a tablet's width in portrait)
      assert.ok(s.width <= c.width + 36 + 1 && s.width <= w * 0.92 + 1, `${w}: the sheet (${s.width}) keeps to the card (${c.width})`);
      assert.ok(Math.abs((s.left + s.right) / 2 - (c.left + c.right) / 2) <= 1, 'centred over the card');
    }
    if (w === 820) await shot(page, 'g1-10-menu');
    await page.keyboard.press('Escape'); await idle(page);
    // the picker too, with its Cancel and Done
    const [l] = await bigSections(page, 1);
    await openChangeColour(page, l);
    const p = await rect(page, '#sfSheet'), cn = await rect(page, '#sfPopCancel');
    assert.ok(p.left >= c.left - 19 && p.right <= c.right + 19, 'the picker keeps to the card');
    assert.ok(cn.width < (w === 390 ? 200 : 300), `Cancel is ${cn.width}px wide`);
    if (w === 820) await shot(page, 'g1-10-picker');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
