// The bottom bar and the tool row under the picture: the bar on the bottom edge (short phones, the end of the page,
// the largest text size), the tool row's contents and wording, and its place under the picture and above the bar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, toolStatus, openAtScale, scrollTop, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// scroll the page and let the shrink (a requestAnimationFrame after the scroll) catch up
const scrollAt = (page, y) => page.evaluate((y) => new Promise((r) => { window.scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY))); }), y);
// big sections whose label points are inside the picture, biggest first
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);

test('tool row: Undo when there is something to undo, the stage status, ◐ in Photo only, codes, −/+, Fit only zoomed in, full screen', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const vis = (ids) => page.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); return e && e.offsetParent; }), ids);
  const ALL = ['sfPlanUndo', 'sfStat', 'sfPhPeek', 'sfCodes', 'sfZout', 'sfZin', 'sfZrst', 'sfFull'];
  const N = await page.evaluate(() => __mstest.assignData.N), mk = await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size);
  assert.equal(await toolStatus(page), `${N} sections · ${mk} markers`);
  assert.deepEqual(await vis(ALL), ['sfStat', 'sfCodes', 'sfZout', 'sfZin', 'sfFull'], 'Plan at the start');
  const row = await rect(page, '#sfZoomCtl'), box = await rect(page, '#sfPicBox');
  assert.equal(Math.round(row.height), 40, 'a 40px row');
  assert.ok(Math.abs(row.top - box.bottom) <= 1, 'directly under the picture');
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('#sfZoomCtl .sfz')].every((b) => b.offsetParent === null || Math.round(b.getBoundingClientRect().height) === 34)), 'buttons 34px high');
  // Fit only while zoomed in
  await page.click('#sfZin'); await idle(page);
  assert.ok((await vis(['sfZrst'])).length, 'Fit while zoomed in');
  await page.click('#sfZrst'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.zoom), 1);
  assert.equal((await vis(['sfZrst'])).length, 0, 'no Fit at the whole picture');
  // codes on/off (aria-pressed)
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
  await page.click('#sfCodes');
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => __mstest.hideLabels), true);
  await page.click('#sfCodes');
  assert.equal(await page.evaluate(() => __mstest.hideLabels), false);
  // Undo after a change; it takes it back
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfVary'); await idle(page);
  assert.ok((await vis(['sfPlanUndo'])).length, 'Undo after a change');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal((await vis(['sfPlanUndo'])).length, 0);
  // Colour along: "n of N done" and the progress line; no Undo
  await page.click('#sfColor'); await idle(page); await scrollAt(page, 0);
  assert.equal(await toolStatus(page), `0 of ${N} done`);
  const [l] = await bigSections(page, 1), p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal(await toolStatus(page), `1 of ${N} done`);
  const prog = await page.evaluate(() => { const i = document.getElementById('sfToolProg'); return [getComputedStyle(i.parentElement).display, i.style.width]; });
  assert.deepEqual(prog, ['block', Math.round(100 / N) + '%'], 'a thin progress line along the row');
  assert.deepEqual(await vis(ALL), ['sfStat', 'sfCodes', 'sfZout', 'sfZin', 'sfFull'], 'Colour along');
  // Edit sections: "N sections", no codes; the section-edit undo is here too
  page.on('dialog', (d) => d.accept());
  await page.click('#sfDoneBtn'); await page.click('#sfBack2'); await idle(page); await scrollAt(page, 0);
  assert.match(await toolStatus(page), /^\d+ sections$/);
  assert.deepEqual(await vis(ALL), ['sfStat', 'sfZout', 'sfZin', 'sfFull'], 'Edit sections');
  const n0 = await page.evaluate(() => __mstest.countedList().length), q = await sectionPoint(page, l);
  await page.mouse.click(q.x, q.y); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.countedList().length), n0 - 1, 'excluded');
  assert.equal(await toolStatus(page), `${n0 - 1} sections`);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo the last section edit');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.countedList().length), n0, 'undone from the tool row');
  assert.equal((await vis(['sfPlanUndo'])).length, 0);
  assert.deepEqual(errors, []);
});

test('the bar keeps two 44px buttons on one row at the largest text size, shortening labels only when it must (and ✨ drops its word)', async () => {
  const row = (page, a, b) => page.evaluate(([a, b]) => { const x = document.getElementById(a).getBoundingClientRect(), y = document.getElementById(b).getBoundingClientRect(), bar = document.querySelector('.sfbar'); return { same: Math.abs(x.top - y.top) < 1, h: [Math.round(x.height), Math.round(y.height)], fits: bar.scrollWidth <= bar.clientWidth + 1, inside: x.left >= 0 && y.right <= innerWidth }; }, [a, b]);
  const all = [];
  for (const [w, back, done, foc] of [[360, '← Edit sections', 'Done colouring', '⛶ Focus mode'], [320, '← Sections', 'Done', '⛶ Focus']]) {
    const { page, errors, ctx } = await openAtScale(2, { width: w, height: 740 });
    await sampleGuide(page); await idle(page);
    assert.deepEqual(await row(page, 'sfBack2', 'sfColor'), { same: true, h: [44, 44], fits: true, inside: true }, `${w}px Plan`);
    assert.equal(await page.textContent('#sfBack2'), back);
    assert.equal(await page.getAttribute('#sfBack2', 'aria-label'), 'Back to editing sections');
    // the header: ✨ Surprise drops its word before the name gets squeezed under about 140px (and keeps its label)
    const hdr = () => page.evaluate(() => ({ ic: document.getElementById('sfSurprise').classList.contains('sfic'), name: document.querySelector('.sfgname').getBoundingClientRect().width, label: document.getElementById('sfSurprise').getAttribute('aria-label') }));
    let hd = await hdr();
    assert.deepEqual([hd.ic, hd.name >= 140], [true, true], `${w}px: ✨ alone at the largest text size, the name ${hd.name}px`);
    if (w === 320) {
      await page.setViewportSize({ width: 300, height: 740 }); await idle(page);
      hd = await hdr();
      assert.equal(hd.ic, true, '300px: ✨ alone');
      assert.ok(hd.name >= 90, `300px: the name keeps ${hd.name}px`);
      assert.match(hd.label, /^Surprise/, 'still "Surprise" for screen readers');
      await page.setViewportSize({ width: 320, height: 740 }); await idle(page);
    }
    await page.click('#sfColor'); await idle(page);
    assert.deepEqual(await row(page, 'sfDoneBtn', 'sfFocus'), { same: true, h: [44, 44], fits: true, inside: true }, `${w}px Colour along`);
    assert.deepEqual([await page.textContent('#sfDoneBtn'), await page.textContent('#sfFocus')], [done, foc]);
    all.push(...errors); await ctx.close();
  }
  // at the default size: the full labels (✨ Surprise with its word), 8px padding
  const d = await openApp({ width: 390 });
  await sampleGuide(d.page); await idle(d.page);
  assert.equal(await d.page.textContent('#sfBack2'), '← Edit sections');
  assert.equal(await d.page.evaluate(() => document.getElementById('sfSurprise').classList.contains('sfic')), false);
  const pad = await d.page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.sfbar')); return [cs.paddingTop, cs.paddingBottom]; });
  assert.deepEqual(pad, ['8px', '8px']);
  assert.deepEqual([...all, ...d.errors], []);
});

test('the bottom bar sits on the bottom edge at the top of the page on short phones, in every stage', async () => {
  for (const [w, h] of [[375, 667], [360, 740]]) {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    const gap = () => page.evaluate(() => { scrollTo(0, 0); const b = document.querySelector('#sfRoot .sfbar').getBoundingClientRect(); return Math.round(innerHeight - b.bottom); });
    assert.equal(await gap(), 0, `plan ${w}×${h}`);
    await page.click('#sfColor'); await idle(page);
    assert.equal(await gap(), 0, `colour along ${w}×${h}`);
    await page.click('#sfDoneBtn'); await idle(page);
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#sfBack2'); await idle(page);
    assert.equal(await gap(), 0, `edit sections ${w}×${h}`);
    assert.equal(await page.locator('#sfRoot .sfbar').count(), 1, 'one bar');
    assert.deepEqual(errors, []);
  }
});

// ---- From the UX polish pass ----
const box = (page, sel) => page.locator(sel).boundingBox();
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('sample opens built; the tool row is under the picture; full screen opens and closes', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.equal(await page.evaluate(() => document.getElementById('sfBuild')), null, 'no sections editor for the sample');
  // let the layout settle (fonts, the pinned block's size) before measuring
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')) > 0, null, { timeout: 5000 }).catch(() => {});
  await idle(page);
  const cv = await box(page, '#sfCanvas'), zr = await box(page, '#sfZoomCtl');
  assert.ok(!overlaps(cv, zr) && zr.y >= cv.y + cv.height - 1, 'the tool row does not cover the picture');
  // the tabs stick below the pinned block: the picture at its floor size (45% of 844) and the tool row
  const pin = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')));
  assert.ok(Math.abs(pin - (380 + zr.height)) <= 2, `--pinH ${pin} covers the floor-size picture + tool row`);

  await page.click('#sfFull');
  await page.waitForFunction((h) => document.getElementById('sfCanvas').getBoundingClientRect().height > h * 1.5, cv.height, { timeout: 5000 }).catch(() => {});
  const big = await box(page, '#sfCanvas');
  assert.ok(big.height > cv.height * 1.5, 'picture is much bigger full screen');
  assert.ok(await page.isVisible('#sfFullX'));
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(!(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull'))), 'Escape closes');
  await page.click('#sfFull'); await idle(page);
  await page.click('#sfFullX');
  await page.waitForFunction((h) => Math.abs(document.getElementById('sfCanvas').getBoundingClientRect().height - h) <= 2, cv.height, { timeout: 5000 }).catch(() => {});
  const back = await box(page, '#sfCanvas');
  assert.ok(Math.abs(back.height - cv.height) <= 2, 'back to the pinned size');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
test('short screens and larger text: at the top of the page the tool row ends above the bar (never under the floor)', async () => {
  for (const [w, h, sc] of [[375, 667, 1.6], [375, 667, 1], [360, 740, 1.3], [390, 844, 1]]) {
    const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
    await sampleGuide(page); await idle(page); await scrollTop(page);
    const tools = await rect(page, '#sfZoomCtl'), bar = await rect(page, '#sfWork>.sfbar'), g = await page.evaluate(() => __mstest.geo);
    assert.ok(tools.bottom <= bar.top + 0.5, `${w}×${h} @${sc}: tools end at ${tools.bottom}, the bar starts at ${bar.top}`);
    assert.ok(g.full >= g.comp, 'never below the floor');
    if (w === 390) assert.equal(g.full, 464, 'the 55% start where it fits');
    // the bar's buttons are all on the screen and can be tapped
    for (const id of ['sfBack2', 'sfColor']) { const r = await rect(page, '#' + id); assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('button')?.id, [r.x + r.width / 2, r.y + r.height / 2]), id); }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('tool row: singular words, parts dropped whole when tight, one part side by side', notOnWebKit(WK.font), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // every section one marker: "1 marker"
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  await page.click('#sfFillAll'); await page.waitForSelector('#sfSheet.sfpicksh'); await page.click('#sfPopSw .sfswg:not(.sfswrec) .sfsw'); await page.click('#sfPopConfirm'); await idle(page);
  assert.match(await toolStatus(page), /^\d+ sections · 1 marker$/);
  // a narrow row with Undo: "· 1 marker" goes first, whole; nothing is cut mid-word
  await page.setViewportSize({ width: 300, height: 844 }); await idle(page);
  const s = await page.evaluate(() => { const st = document.getElementById('sfStat'), p2 = st.querySelector('.sfsp2'); return { cut: st.scrollWidth > st.clientWidth + 1, p2: !!p2 && p2.offsetParent !== null, undo: document.getElementById('sfPlanUndo').offsetParent !== null }; });
  assert.deepEqual(s, { cut: false, p2: false, undo: true });
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sfStat')).textOverflow), 'clip');
  await page.setViewportSize({ width: 390, height: 844 }); await idle(page);
  assert.deepEqual(errors, []);
  // side by side: one part, never two to four lines, never a leading "·"
  const sb = await openApp({ width: 844, height: 390 });
  await sampleGuide(sb.page); await idle(sb.page);
  for (const stage of ['plan', 'along']) {
    if (stage === 'along') { await sb.page.click('#sfColor'); await idle(sb.page); }
    const t = await sb.page.evaluate(() => { const st = document.getElementById('sfStat'); return { text: st.innerText, h: st.getBoundingClientRect().height, w: st.scrollWidth <= st.parentElement.clientWidth }; });
    assert.ok(!t.text.includes('·') && t.h <= 40 && t.w, `${stage}: ${JSON.stringify(t)}`);
  }
  assert.deepEqual(sb.errors, []);
});

test('the bar sits on the bottom edge at the end of the page; Crop keeps the page where it was, with the tool row', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await scrollAt(page, 99999);
  assert.ok(Math.abs(await page.evaluate(() => innerHeight - document.querySelector('#sfWork>.sfbar').getBoundingClientRect().bottom)) <= 0.5, 'flush at the end');
  page.on('dialog', (d) => d.accept());
  await page.click('#sfBack2'); await idle(page); await page.click('#sfAdjToggle'); await idle(page);
  const y0 = await scrollAt(page, 200);
  await page.click('#sfCrop'); await idle(page);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y0) <= 2, 'Crop keeps the scroll');
  assert.equal(await page.isVisible('#sfZin'), true, 'zoom buttons stay');
  await page.click('#sfCropCancel'); await idle(page);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y0) <= 2, 'Cancel comes back to the same place');
  assert.deepEqual(errors, []);
});
