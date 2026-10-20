// v318.26 (W3): Leave white. A section's tip has a third button, Leave white: the section is the paper from then on,
// through Shuffle, Mood, every pattern and a zone laid again, out of the key, Colour along and the counts, and saved;
// its tip says Left white, with Colour it. Undo and Redo; Manual's Change colour has Leave white beside Unpin; Blend's
// press and hold. The tip's three buttons fit it at 320 px with large text. Fails on v318.25 (no Leave white).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, sampleGuide, sectionPoint, idle, scrollTop, saveGuide, longPress } from './helpers.mjs';

before(setup);
after(teardown);

// big sections whose label points are well inside the picture (not under the zoom row), biggest first
const bigSections = (page, n = 6) => page.evaluate((n) => {
  const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), z = document.getElementById('sfZoomCtl').getBoundingClientRect();
  return t.assignData.order.filter((l) => { const q = t.labelPos(l), y = r.top + (q.y / c.height) * r.height, x = r.left + (q.x / c.width) * r.width; return y > r.top + 12 && y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 && x > r.left + 12 && x < r.right - 12; })
    .sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n);
}, n);
async function tap(page, l) { await scrollTop(page); const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
async function pattern(page, v) { await tab(page, 'pattern'); await page.click(`#sfFam [data-v="${v}"]`); await idle(page); }
// the state of section l: its marker, white pin, paper, place in the order; and the guide's count
const sec = (page, l) => page.evaluate((l) => {
  const t = __mstest, a = t.assignData;
  return { m: a.assign[l] ? a.assign[l].mkey : null, w: t.whitePins[l] ?? null, paper: !!(a.paper && a.paper[l]), inOrder: a.order.includes(l), N: a.N, lock: t.locks[l] ?? null, tick: t.colored[l] };
}, l);
// the canvas pixel at the section's label point
const px = (page, l) => page.evaluate((l) => { const c = document.getElementById('sfCanvas'), q = __mstest.labelPos(l); return [...c.getContext('2d').getImageData(Math.round(q.x), Math.round(q.y), 1, 1).data].slice(0, 3); }, l);
const isPaper = (p) => p[0] >= 240 && p[1] >= 237 && p[2] >= 230 && Math.abs(p[0] - 247) <= 6 && Math.abs(p[2] - 238) <= 8;
const vsFull = (page) => page.evaluate(() => {
  const c = document.getElementById('sfCanvas'), g = c.getContext('2d');
  __mstest.renderGuide(); const a = g.getImageData(0, 0, c.width, c.height).data.slice();
  __mstest.forceFullRender(); __mstest.renderGuide(); const b = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n;
});
const photoFile = (page) => page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); for (let i = 0; i < 4; i++) { g.fillStyle = ['#c33', '#3a6', '#36c', '#dc3'][i]; g.fillRect((i % 2) * 32, (i >> 1) * 24, 32, 24); } return c.toDataURL('image/png').split(',')[1]; }).then((b) => ({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));

test('Leave white from the tip: white on the page, one section fewer, out of Colour along; kept through Shuffle, Mood, Random and Photo; Undo, Redo, Colour it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1), s0 = await sec(page, l);
  await tap(page, l);
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Change colour', 'Pin', 'Leave white']);
  await page.click('.sftip [data-a="white"]'); await idle(page);
  let s = await sec(page, l);
  assert.deepEqual([s.m, s.w, s.paper, s.inOrder, s.N], [null, s0.m, true, false, s0.N - 1]);
  assert.ok(isPaper(await px(page, l)), 'the paper at its label point: ' + (await px(page, l)));
  // the white tip: Left white, Colour it (the keyboard on it)
  assert.equal(await page.getAttribute('.sftip', 'aria-label'), 'Section left white');
  assert.match(await page.textContent('.sftip'), /Left white/);
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'colour');
  assert.equal(await page.evaluate(() => document.getElementById('sfPlanUndo').getAttribute('aria-label')), 'Undo: Section left white');
  assert.equal(await vsFull(page), 0, 'partial redraw matches a full one');
  // laid again every way: still white
  await page.mouse.click(5, 5); await idle(page);
  await tab(page, 'pattern'); await page.click('#sfVary'); await idle(page);
  assert.equal((await sec(page, l)).w, s0.m, 'Shuffle');
  await tab(page, 'colours'); await page.click('#sfMood [data-v="vivid"]'); await idle(page);
  assert.equal((await sec(page, l)).m, null, 'Mood');
  await page.click('#sfSurprise'); await idle(page);
  assert.equal((await sec(page, l)).m, null, 'Surprise');
  await pattern(page, 'random');
  assert.equal((await sec(page, l)).m, null, 'Random');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles(await photoFile(page));
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking); await idle(page);
  if (await page.evaluate(() => __mstest.photoAlign)) { await page.click('#sfPhAlign'); await idle(page); }
  s = await sec(page, l);
  assert.deepEqual([s.m, s.paper, s.N], [null, true, s0.N - 1], 'Photo');
  await pattern(page, 'gradient');
  assert.ok(isPaper(await px(page, l)));
  // Colour along: no row has it, the count is one fewer
  const along = await page.evaluate((l) => { const t = __mstest; return t.assignData.order.includes(l); }, l);
  assert.equal(along, false);
  // Colour it, then Undo (white again), Redo (coloured again)
  await tap(page, l);
  await page.click('.sftip [data-a="colour"]'); await idle(page);
  s = await sec(page, l);
  assert.deepEqual([s.m, s.w, s.paper, s.inOrder, s.N, s.lock], [s0.m, null, false, true, s0.N, null]);
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Change colour', 'Pin', 'Leave white'], 'its usual tip');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal((await sec(page, l)).w, s0.m, 'Undo: white again');
  await page.click('#sfPlanRedo'); await idle(page);
  assert.equal((await sec(page, l)).m, s0.m, 'Redo: coloured again');
  assert.equal(await vsFull(page), 0);
  assert.deepEqual(errors, []);
});

test('a ticked section left white is unticked, and Undo brings back its marker, pin and tick; the white pin is saved and opens again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const [l, l2] = await bigSections(page, 2), s0 = await sec(page, l);
  await page.evaluate((l) => { __mstest.colored[l] = 1; }, l);
  await tap(page, l);
  await page.click('.sftip [data-a="pin"]'); await idle(page);
  await page.click('.sftip [data-a="white"]'); await idle(page);
  let s = await sec(page, l);
  assert.deepEqual([s.m, s.tick, s.lock], [null, 0, null]);
  await page.click('#sfPlanUndo'); await idle(page);
  s = await sec(page, l);
  assert.deepEqual([s.m, s.tick, s.lock, s.w], [s0.m, 1, s0.m, null]);
  // left white again (another one too), saved, and the page reloaded: still white
  await page.click('#sfPlanRedo'); await idle(page);
  await tap(page, l2); await page.click('.sftip [data-a="white"]'); await idle(page);
  await page.evaluate(() => __mstest.flushSave());
  const id = await page.evaluate(() => __mstest.curId);
  const st = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { white: p.white, paper: p.paper }), id);
  assert.ok(st.white && st.white[l] === s0.m && st.paper.includes(l), 'saved: ' + JSON.stringify(st));
  await page.reload(); await idle(page);
  await page.click('#mHome'); await page.click('#homeLibCard'); await idle(page);
  await page.click(`#savedList .srow[data-id="${id}"] .sname`);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  // (part-way coloured, it opens in Colour along)
  if (await page.evaluate(() => __mstest.sfmode === 'color')) await page.click('#sfDoneBtn');
  await idle(page);
  s = await sec(page, l);
  assert.deepEqual([s.m, s.w, s.paper, s.inOrder], [null, s0.m, true, false], 'reopened white');
  assert.ok((await sec(page, l2)).w, 'the other too');
  assert.equal(s.N, s0.N - 2);
  assert.ok(isPaper(await px(page, l)));
  assert.deepEqual(errors, []);
});

test('Manual: Change colour has Leave white beside Unpin; a tap on a white section shows Left white · Colour it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await pattern(page, 'manual');
  const [l] = await bigSections(page, 1), s0 = await sec(page, l);
  await tap(page, l);
  await page.waitForSelector('#sfSheet', { state: 'visible' });
  assert.equal(await page.textContent('#sfPopWhite'), 'Leave white');
  // with a pin, Unpin (allow fill) is there too, both on the one line
  await page.click('#sfPopCancel'); await idle(page);
  await page.evaluate(([l, k]) => { __mstest.locks[l] = k; }, [l, s0.m]);
  await tap(page, l);
  await page.waitForSelector('#sfPopExtra', { state: 'visible' });
  const r = await page.evaluate(() => { const a = document.getElementById('sfPopExtra').getBoundingClientRect(), b = document.getElementById('sfPopWhite').getBoundingClientRect(), sh = document.getElementById('sfSheet').getBoundingClientRect(); return { same: Math.abs(a.top - b.top) < 4, inside: b.right <= sh.right + 1 && a.left >= sh.left - 1 }; });
  assert.ok(r.same && r.inside, JSON.stringify(r));
  await page.click('#sfPopWhite'); await idle(page);
  assert.ok(!(await page.isVisible('#sfSheet')), 'the picker closes');
  const s = await sec(page, l);
  assert.deepEqual([s.m, s.w, s.N, s.lock], [null, s0.m, s0.N - 1, null]);
  assert.equal(await page.evaluate(() => document.getElementById('sfPlanUndo').getAttribute('aria-label')), 'Undo: Section left white');
  await page.mouse.click(5, 5); await idle(page);
  await tap(page, l);
  assert.ok(!(await page.isVisible('#sfSheet')), 'no picker for a white section');
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
  await page.click('.sftip [data-a="colour"]'); await idle(page);
  assert.equal((await sec(page, l)).m, s0.m);
  assert.deepEqual(errors, []);
});

test('Blend: press and hold a white section shows its tip; anchors laid again keep it white', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1);
  await tap(page, l); await page.click('.sftip [data-a="white"]'); await idle(page);
  await pattern(page, 'blend');
  assert.equal((await sec(page, l)).m, null);
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await longPress(page, p.x, p.y); await idle(page);
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
  await page.evaluate(() => __mstest.assign.blendNow()); await idle(page);
  assert.equal((await sec(page, l)).m, null);
  assert.deepEqual(errors, []);
});

test('with a zone and shading: the zone laid again keeps it white; the three buttons fit the tip at 320 px with large text', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await sampleGuide(page); await idle(page);
  const [l, l2] = await page.evaluate(() => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(1, 3); });
  // a zone with l in it, and shading on
  await page.evaluate(([l, l2]) => { const t = __mstest, A = t.assign, z = A.zoneNew(); A.zoneSelect(z.id); t.reassign(t.zoneMove([l, l2], z.id)); t.locks[l] = t.assignData.assign[l].mkey; }, [l, l2]);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="soft"]');
  await idle(page);
  await tap(page, l);
  const fit = await page.evaluate(() => {
    const t = document.querySelector('.sftip'), r = t.getBoundingClientRect(), v = document.getElementById('sfView').getBoundingClientRect();
    const bs = [...t.querySelectorAll('.sftipbtn')].map((b) => b.getBoundingClientRect());
    return { r: [r.left, r.top, r.right, r.bottom].map(Math.round), v: [v.left, v.top, v.right, v.bottom].map(Math.round), n: bs.length, inTip: bs.every((b) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.bottom <= r.bottom + 0.5), inView: r.left >= v.left - 0.5 && r.right <= v.right + 0.5 && r.top >= 0 && r.bottom <= innerHeight, zone: !!t.querySelector('.sftipzone'), rows: new Set(bs.map((b) => Math.round(b.top))).size };
  });
  assert.equal(fit.n, 3);
  assert.ok(fit.inTip, 'every button inside the tip');
  // (inside the picture's width, and on the screen: with shading's tones and the zone line at this text size the tip
  // is taller than the picture's frame here, as it was with two buttons in v318.25)
  assert.ok(fit.inView, 'the tip on the screen: ' + JSON.stringify(fit));
  assert.ok(fit.zone, 'with its zone line');
  assert.equal(fit.rows, 2, 'Leave white on a row of its own');
  await page.click('.sftip [data-a="white"]'); await idle(page);
  assert.equal((await sec(page, l)).lock, null, 'its pin goes');
  // the zone laid again (Shuffle with the zone chosen), and all of them (Mood)
  await tab(page, 'pattern'); await page.click('#sfVary'); await idle(page);
  assert.equal((await sec(page, l)).m, null, 'the zone laid again');
  assert.ok((await sec(page, l2)).m, 'its other section has a marker');
  await page.evaluate(() => __mstest.layPlan(null)); await idle(page);
  assert.equal((await sec(page, l)).m, null);
  assert.ok(isPaper(await px(page, l)) || (await px(page, l))[0] > 200, 'paper (shading leaves it white)');
  assert.equal(await vsFull(page), 0);
  assert.deepEqual(errors, []);
});

test('the last unticked section left white finishes the page', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1);
  // every other section ticked, then the last one left white
  await page.evaluate((l) => { const t = __mstest; for (const x of t.assignData.order) if (x !== l) t.colored[x] = 1; }, l);
  await tap(page, l); await page.click('.sftip [data-a="white"]'); await idle(page);
  const done = await page.evaluate(() => { const t = __mstest; return t.assignData.order.every((x) => t.colored[x]); });
  assert.ok(done, 'every section with a marker is ticked');
  await page.mouse.click(5, 5);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.isVisible('#sfDone'), true, 'Page finished');
  assert.match(await page.textContent('#sfDone'), /finished/i);
  assert.deepEqual(errors, []);
});
