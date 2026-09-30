// Speed work must not change what you see: partial redraws have to match a full redraw pixel for pixel (pinned
// sections too), big phone photos (up to 48 megapixels) are kept at working size, and the cheap paths (one section
// per Done, no PNG re-encode on autosave, one-section zone markers) give the same answers as the slow ones.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// compare the canvas as it is now with a from-scratch redraw of the same state
const vsFull = (page) => page.evaluate(() => {
  const c = document.getElementById('sfCanvas'), g = c.getContext('2d');
  // the focus bar can change height after a step (longer text), which resizes the picture and the outline;
  // a normal (partial) redraw catches that up first, as the app's next redraw would
  __mstest.renderGuide();
  const a = g.getImageData(0, 0, c.width, c.height).data.slice();
  __mstest.forceFullRender(); __mstest.renderGuide();
  const b = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > mx) mx = d; } }
  return { n, mx };
});
const same = async (page, what) => { const r = await vsFull(page); assert.equal(r.n, 0, `${what}: ${r.n} channel values differ (max ${r.mx})`); };

test('partial redraws match a full redraw (colour along, focus mode, shading, tone steps)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('.sftabbtn[data-t="colours"]');
  await page.click('#sfColor'); await idle(page);
  await same(page, 'entering colour along');
  const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 5));
  await scrollTop(page);
  for (const l of ls.slice(0, 3)) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
  await same(page, 'after ticking sections');
  const p0 = await sectionPoint(page, ls[0]); await page.mouse.click(p0.x, p0.y); await idle(page);
  await same(page, 'after un-ticking one');
  await page.evaluate(() => { __mstest.hlKey = __mstest.assignData.assign[__mstest.assignData.order[4]].mkey; __mstest.renderGuide(); });
  await same(page, 'after highlighting a colour');
  await page.evaluate(() => { __mstest.hlKey = null; __mstest.renderGuide(); });
  await page.click('#sfFocus'); await idle(page);
  await same(page, 'entering focus mode');
  for (let i = 0; i < 4; i++) { await page.click('#sfFDone'); await idle(page); await same(page, `after Done #${i + 1}`); }
  await page.click('#sfFBack'); await idle(page);
  await same(page, 'after Back');
  await page.click('#sfFDone'); await idle(page);
  await same(page, 'after Undo');
  // jump to a different colour (most of the picture changes)
  await page.evaluate(() => { const t = __mstest, cur = t.focusOrd[t.focusPos], k = t.assignData.assign[cur].mkey; const j = t.focusOrd.findIndex((l) => t.assignData.assign[l].mkey !== k); t.goFocus(j, false); });
  await idle(page);
  await same(page, 'after switching colour');
  // step through each tone
  await page.evaluate(() => { __mstest.toneSteps = true; __mstest.buildFocusOrder(); __mstest.goFocus(__mstest.nextUndone(-1), false); });
  await idle(page);
  for (let i = 0; i < 3; i++) { await page.click('#sfFDone'); await idle(page); await same(page, `after tone step #${i + 1}`); }
  assert.deepEqual(errors, []);
});

test('a big phone photo is kept at working size, Done repaints one section, autosave skips re-encoding', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  // a 4000 x 3000 "photo" of line art
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 4000; c.height = 3000; const g = c.getContext('2d');
    g.fillStyle = '#f2ece2'; g.fillRect(0, 0, 4000, 3000); g.strokeStyle = '#222'; g.lineWidth = 10; let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 220; i++) { g.beginPath(); g.arc(r() * 4000, r() * 3000, 60 + r() * 300, 0, 6.283); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(r() * 4000, r() * 3000); g.lineTo(r() * 4000, r() * 3000); g.stroke(); }
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
    return await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result.split(',')[1]); f.readAsDataURL(blob); });
  });
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  const size = await page.evaluate(() => ({ src: __mstest.srcSize, W: __mstest.W, H: __mstest.H }));
  assert.ok(Math.max(...size.src) <= 2400, `photo kept at working size, got ${size.src}`);
  assert.equal(size.W, 2400); assert.equal(size.H, 1800);
  await page.click('#sfBuild');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData), null, { timeout: 60000 });
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfFocus'); await idle(page, 2200); // let the first autosave happen
  const t = await page.evaluate(async () => {
    let png = 0; const orig = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type, q) { if ((!type || type === 'image/png') && this.width === __mstest.W) png++; return orig.call(this, type, q); };
    let t0 = performance.now(); __mstest.forceFullRender(); __mstest.renderGuide(); const full = performance.now() - t0;
    const before = __mstest.colored.reduce((a, b) => a + b, 0);
    t0 = performance.now(); document.getElementById('sfFDone').click(); const done = performance.now() - t0;
    await window.__idle.wait(2200, 20000); // until the auto-save (1.5 s after the change) has run
    const saved = await IDB.get('guide-autosave');
    return { full, done, png, before, savedProg: saved && saved.payload.prog.length };
  });
  assert.ok(t.done < t.full * 0.5, `Done took ${t.done.toFixed(0)} ms vs ${t.full.toFixed(0)} ms for a full redraw`);
  assert.equal(t.png, 0, 'autosave reused the saved section map');
  assert.equal(t.savedProg, t.before + 1, 'autosave still stored the new tick');
  await page.click('#sfFDone'); await idle(page);
  await same(page, 'big photo after Done');
  assert.deepEqual(errors, []);
});

test('zone markers worked out per section match the whole-picture calculation', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const r = await page.evaluate(() => {
    const t = __mstest; t.shadeMode = 'full'; const sh = t.shadePrep(false);
    const key = (z) => [z.l, z.zone, z.x, z.y, z.r.toFixed(3)].join(':');
    const whole = t.shadeZoneLabels(sh, 4).map(key), per = t.shadeZoneLabelsAll(sh, 4).map(key);
    return { whole, per };
  });
  assert.ok(r.whole.length > 3);
  assert.deepEqual(r.per, r.whole);
  assert.deepEqual(errors, []);
});

test('the section map is only re-encoded when the sections change', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const r = await page.evaluate(() => {
    const t = __mstest, a = t.lmapURL(), s1 = t.labelsSig();
    const b = t.lmapURL();
    const o = t.assignData.order; t.mergeCellsSnap(o[0], o[1]);
    const s2 = t.labelsSig(), c = t.lmapURL();
    return { same: a === b, sigChanged: s1 !== s2, reencoded: c !== a };
  });
  assert.ok(r.same && r.sigChanged && r.reencoded, JSON.stringify(r));
  assert.deepEqual(errors, []);
});

test('undo snapshots are packed and undo restores the sections exactly', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfBack2'); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest, before = t.labelsSig(), o = t.assignData.order, b0 = t.undoBytes;
    t.mergeCellsSnap(o[0], o[1]); t.render();
    const used = t.undoBytes - b0, full = t.W * t.H * 4, changed = t.labelsSig() !== before;
    t.doUndoSeg();
    return { used, full, changed, restored: t.labelsSig() === before };
  });
  assert.ok(r.changed && r.restored, JSON.stringify(r));
  assert.ok(r.used < r.full / 4, `snapshot ${r.used} bytes vs ${r.full} unpacked`);
  assert.deepEqual(errors, []);
});

test('pinning colours (labels that stick out of their section) still redraws pixel for pixel', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.evaluate(() => document.getElementById('sfLock').click()); await idle(page);
  await scrollTop(page);
  const ls = await page.evaluate(() => __mstest.assignData.order.slice(10, 14));
  // Pin colours mode: a tap pins (or unpins) straight away
  for (const l of ls) {
    const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
    assert.ok(await page.evaluate((l) => !!__mstest.locks[l], l), 'pinned');
    await same(page, `after pinning section ${l}`);
  }
  const p0 = await sectionPoint(page, ls[0]); await page.mouse.click(p0.x, p0.y); await idle(page);
  await same(page, 'after unpinning one');
  // a new colour from the section's tip: previewed, then undone with Escape
  await page.evaluate(() => document.getElementById('sfLock').click()); await idle(page);
  await scrollTop(page);
  for (const l of ls.slice(1, 3)) {
    const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
    await page.click('.sftip [data-a="change"]'); await idle(page);
    const picked = await page.evaluate(() => { const b = document.querySelectorAll('#sfPopSw .sfsw'); if (b.length < 4) return false; b[3].click(); return true; });
    assert.ok(picked, 'colour picker opened');
    await idle(page); await same(page, `after a new colour for section ${l}`);
    await page.keyboard.press('Escape'); await idle(page); await same(page, `after closing the picker for ${l}`);
  }
  assert.deepEqual(errors, []);
});

test('H/S markers follow the shading mode and marker changes, not just the light', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const r = await page.evaluate(() => {
    const t = __mstest, count = () => { const sh = t.shadePrep(false); const all = t.shadeZoneLabelsAll(sh, 4), fresh = t.shadeZoneLabels(sh, 4); return { h: all.filter((z) => z.tone === 'H').length, same: JSON.stringify(all) === JSON.stringify(fresh) }; };
    t.shadeMode = 'full'; const full = count();
    t.shadeMode = 'shadow'; const shadow = count();
    t.shadeMode = 'full'; const back = count();
    return { full, shadow, back };
  });
  assert.ok(r.full.h > 0 && r.full.same, JSON.stringify(r.full));
  assert.ok(r.shadow.h === 0 && r.shadow.same, 'no highlight markers in shadow-only mode: ' + JSON.stringify(r.shadow));
  assert.ok(r.back.h === r.full.h && r.back.same, JSON.stringify(r.back));
  assert.deepEqual(errors, []);
});

test('a 48-megapixel photo loads, is scaled to working size, and builds', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  const b64 = await page.evaluate(async () => {
    const W = 8000, H = 6000, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#f3efe6'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1d1d1d'; g.lineWidth = 18; let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(r() * W, r() * H, 120 + r() * 700, 0, 6.283); g.stroke(); }
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    c.width = c.height = 1;
    return await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result.split(',')[1]); f.readAsDataURL(blob); });
  });
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  const t0 = Date.now();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 90000 });
  const sz = await page.evaluate(() => ({ src: __mstest.srcSize, W: __mstest.W, H: __mstest.H }));
  assert.ok(Math.max(...sz.src) <= 2400, 'kept at working size: ' + sz.src);
  assert.equal(Math.max(sz.W, sz.H), 2400);
  await page.click('#sfBuild'); await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 20, null, { timeout: 90000 });
  assert.ok(Date.now() - t0 < 60000, 'done in under a minute on the test machine');
  assert.deepEqual(errors, []);
});

// ---- From the review leftovers ----
test('pinning sections redraws exactly as a full redraw would (both pin styles)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  for (const fam of ['gradient', 'manual']) {
    await page.click('.sftabbtn[data-t="pattern"]'); await page.click(`#sfFam [data-v="${fam}"]`); await idle(page);
    const d = await page.evaluate(() => { const t = __mstest, c = document.getElementById('sfCanvas'), g = c.getContext('2d'); let worst = 0;
      const cmp = () => { t.renderGuide(); const a = g.getImageData(0, 0, c.width, c.height).data.slice(); t.forceFullRender(); t.renderGuide(); const b = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
      cmp(); for (let k = 0; k < 8; k++) { const l = t.assignData.order[k * 3]; t.locks[l] = t.assignData.assign[l].mkey; t.renderGuide(); worst = Math.max(worst, cmp()); }
      for (let k = 0; k < 8; k++) { delete t.locks[t.assignData.order[k * 3]]; t.renderGuide(); worst = Math.max(worst, cmp()); } return worst; });
    assert.equal(d, 0, `${fam}: pixels differ`);
  }
  assert.deepEqual(errors, []);
});
