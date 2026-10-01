// Planning realistic colours by hand: "Everywhere" in the Change colour picker swaps a marker in every section that
// uses it (pinned, one Undo step), and Paint in the Manual pattern fills the sections a tap or a drag passes over
// (one stroke = one Undo step) while two fingers still move and zoom the picture.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, fitPicture, scrollTop, until, ENGINE } from './helpers.mjs';

// touch is driven through Chromium's own protocol (CDP): Safari's engine skips those tests
const CDP_ONLY = { skip: ENGINE !== 'chromium' && 'touch is driven through Chromium\u2019s protocol' };

before(setup);
after(teardown);

// big sections whose label points are well inside the picture (not under the zoom row), biggest first
const bigSections = (page, n = 6) => page.evaluate((n) => {
  const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), z = document.getElementById('sfZoomCtl').getBoundingClientRect();
  return t.assignData.order.filter((l) => { const q = t.labelPos(l), y = r.top + (q.y / c.height) * r.height, x = r.left + (q.x / c.width) * r.width; return y > r.top + 12 && y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 && x > r.left + 12 && x < r.right - 12; })
    .sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n);
}, n);
const plan = (page) => page.evaluate(() => { const a = __mstest.assignData.assign, o = {}; for (const k in a) o[k] = a[k].mkey; return { a: o, locks: { ...__mstest.locks }, n: __mstest.planCount, label: __mstest.planLabel }; });
async function tap(page, l) { await scrollTop(page); const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
async function manual(page) { await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page); }
// compare the canvas with a from-scratch redraw of the same state
const vsFull = (page) => page.evaluate(() => {
  const c = document.getElementById('sfCanvas'), g = c.getContext('2d');
  __mstest.renderGuide(); const a = g.getImageData(0, 0, c.width, c.height).data.slice();
  __mstest.forceFullRender(); __mstest.renderGuide(); const b = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n;
});
// a marker in the collection that the guide doesn't use yet
const unusedKey = (page) => page.evaluate(() => { const used = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)); return sfCollection().find((m) => !used.has(m.mkey)).mkey; });
// a big section whose marker is shared with at least `n` other sections
const sharedSection = (page, ls, n = 2) => page.evaluate(([ls, n]) => { const a = __mstest.assignData.assign; return ls.find((l) => Object.keys(a).filter((x) => a[x].mkey === a[l].mkey).length > n); }, [ls, n]);
async function touch(cdp) { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); }
const T = (cdp, type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i + 1 })) });

test('Change colour → Everywhere replaces the marker in every section that uses it (and only those), pinned, as one Undo step', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const l = await sharedSection(page, await bigSections(page, 12), 3), p0 = await plan(page), old = p0.a[l];
  const same = Object.keys(p0.a).filter((x) => p0.a[x] === old).map(Number), k1 = await unusedKey(page);
  const code = (k) => page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k), oc = await code(old), nc = await code(k1);
  const mkN = () => page.evaluate(() => +document.querySelector('#sfStat .sfsp2 b').textContent);
  const m0 = await mkN();
  await tap(page, l);
  // the tip keeps its two buttons: the choice lives in the picker
  assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Change colour', 'Pin']);
  await page.click('.sftip [data-a="change"]');
  assert.deepEqual(await page.$$eval('.sfpopscope [data-sc]', (b) => b.map((x) => [x.textContent, x.getAttribute('aria-pressed')])), [['Only this section', 'true'], [`Everywhere (${same.length} sections)`, 'false']]);
  // a pick previews on this section only; Everywhere spreads it; Only this section takes it back
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`); await idle(page);
  let p = await plan(page);
  assert.equal(p.a[l], k1); assert.equal(same.filter((x) => p.a[x] === k1).length, 1);
  await page.click('.sfpopscope [data-sc="all"]'); await idle(page);
  p = await plan(page);
  assert.ok(same.every((x) => p.a[x] === k1), 'every section with the old marker previews the new one');
  await page.click('.sfpopscope [data-sc="one"]'); await idle(page);
  p = await plan(page);
  assert.deepEqual(same.filter((x) => p.a[x] === k1), [l], 'back to this section only');
  await page.click('.sfpopscope [data-sc="all"]'); await page.click('#sfPopConfirm'); await idle(page);
  p = await plan(page);
  for (const x in p0.a) assert.equal(p.a[x], same.includes(+x) ? k1 : p0.a[x], 'section ' + x);
  assert.ok(same.every((x) => p.locks[x] === k1), 'all pinned');
  assert.deepEqual(Object.keys(p.locks).map(Number).sort((a, b) => a - b), same.slice().sort((a, b) => a - b), 'nothing else pinned');
  assert.equal(p.n, p0.n + 1, 'one Undo step');
  assert.equal(p.label, `Replaced ${oc} with ${nc} in ${same.length} sections`);
  // no toast: ↶ Undo says it, and a screen reader hears it
  assert.equal(await page.evaluate(() => { const t = document.getElementById('msToast'); return !!(t && t.classList.contains('on')); }), false);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), `Undo: Replaced ${oc} with ${nc} in ${same.length} sections`);
  assert.match(await page.textContent('#sfLive'), new RegExp(`^${oc} → ${nc} .*, ${same.length} sections\\.?( Pinned: changes to the plan leave them as they are\\.)?$`), 'the picker says what it did (then, the first time, that they are pinned)');
  assert.equal(await mkN(), m0, 'markers used: one out, one in');
  assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
  // Recently used remembers the new marker
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-recent-mk'))[0]), k1);
  // Undo (the button under the picture) takes it all back in one go
  await page.click('#sfPlanUndo'); await idle(page);
  p = await plan(page);
  assert.deepEqual(p.a, p0.a); assert.deepEqual(p.locks, {}); assert.equal(p.n, p0.n);
  assert.deepEqual(errors, []);
});

test('Everywhere leaves sections already coloured with the old marker as they are; Cancel restores everything', async () => {
  const { page, errors } = await openApp({ width: 360, height: 780 });
  await sampleGuide(page);
  const l = await sharedSection(page, await bigSections(page, 12), 3), p0 = await plan(page), old = p0.a[l];
  const same = Object.keys(p0.a).filter((x) => p0.a[x] === old).map(Number), done = same.find((x) => x !== l), k1 = await unusedKey(page);
  await page.evaluate((d) => { __mstest.colored[d] = 1; }, done);
  await tap(page, l);
  // at 360 px the tip and the choice both fit
  const fit = await page.evaluate(() => { const t = document.querySelector('.sftip').getBoundingClientRect(); return t.left >= 0 && t.right <= 360; });
  assert.ok(fit, 'tip fits at 360 px');
  await page.click('.sftip [data-a="change"]');
  const sc = await page.evaluate(() => { const pop = document.getElementById('sfSheet').getBoundingClientRect(); return [...document.querySelectorAll('.sfpopscope [data-sc]')].map((b) => { const r = b.getBoundingClientRect(); return { cut: b.scrollWidth > b.clientWidth, in: r.left >= pop.left && r.right <= pop.right }; }); });
  assert.deepEqual(sc, [{ cut: false, in: true }, { cut: false, in: true }], 'both choices readable in the picker');
  assert.equal(await page.textContent('.sfpopscope [data-sc="all"]'), `Everywhere (${same.length - 1} sections)`);
  assert.ok(!(await page.isVisible('.sfpopnote')));
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k1}"]`); await page.click('.sfpopscope [data-sc="all"]'); await idle(page);
  assert.match(await page.textContent('.sfpopnote'), /^1 coloured section keeps /);
  let p = await plan(page);
  assert.equal(p.a[done], old, 'the coloured section keeps its marker');
  assert.equal(same.filter((x) => p.a[x] === k1).length, same.length - 1);
  await page.click('#sfPopCancel'); await idle(page);
  p = await plan(page);
  assert.deepEqual(p.a, p0.a); assert.deepEqual(p.locks, {}); assert.equal(p.n, p0.n, 'Cancel is no step');
  // and when confirmed, the tick stays
  await tap(page, l); await page.click('.sftip [data-a="change"]');
  await page.click(`#sfPopSw .sfsw[data-k="${k1}"] >> nth=0`); await page.click('.sfpopscope [data-sc="all"]'); await page.click('#sfPopConfirm'); await idle(page);
  p = await plan(page);
  assert.equal(p.a[done], old); assert.equal(await page.evaluate((d) => __mstest.colored[d], done), 1, 'tick kept');
  assert.match(p.label, /\(1 coloured kept /);
  assert.deepEqual(errors, []);
});

test('Paint: a tap fills one section with the brush (default: the most recently used marker) and pins it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const k1 = await unusedKey(page);
  await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k1);
  await manual(page);
  assert.equal(await page.textContent('#sfPaint'), 'Paint');
  assert.equal(await page.locator('#sfBrush').count(), 0, 'no brush until Paint is on');
  await page.click('#sfPaint'); await idle(page);
  assert.equal(await page.textContent('#sfPaint'), 'Done painting');
  assert.equal(await page.getAttribute('#sfPaint', 'aria-pressed'), 'true');
  const code = await page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k1);
  assert.match(await page.textContent('#sfBrush'), new RegExp('^' + code));
  assert.equal(await page.evaluate(() => document.getElementById('sfCanvas').style.cursor), 'crosshair');
  const [l] = await bigSections(page, 1), p0 = await plan(page);
  await tap(page, l);
  const p = await plan(page);
  assert.ok(!(await page.isVisible('#sfSheet')), 'no picker while painting');
  assert.equal(await page.locator('.sftip').count(), 0, 'no tip');
  assert.equal(p.a[l], k1); assert.equal(p.locks[l], k1);
  assert.deepEqual(Object.keys(p0.a).filter((x) => p.a[x] !== p0.a[x]).map(Number), [l], 'only that section');
  assert.equal(p.n, p0.n + 1); assert.equal(p.label, 'Painted 1 section with ' + code);
  assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
  // change the brush from the chip: the picker, then the next tap uses it
  await page.click('#sfBrush');
  assert.equal(await page.textContent('#sfSheetT'), 'Paint with');
  const k2 = await page.evaluate((k) => [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== k).dataset.k, k1);
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k2}"]`); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintKey), k2);
  const [, l2] = await bigSections(page, 2);
  await tap(page, l2);
  assert.equal((await plan(page)).a[l2], k2);
  assert.deepEqual(errors, []);
});

test('Paint: a drag fills every section it passes over, as one Undo step', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const k = await unusedKey(page);
  await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k);
  await manual(page); await page.click('#sfPaint'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintKey), k);
  await scrollTop(page);
  // down through the middle of the picture, across many sections
  const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON());
  const a = { x: c.x + c.width * 0.45, y: c.y + c.height * 0.1 }, b = { x: c.x + c.width * 0.6, y: c.y + c.height * 0.9 };
  const p0 = await plan(page);
  // where the pointer went, in picture pixels
  await page.evaluate(() => { window.__path = []; const c = document.getElementById('sfCanvas'); ['pointerdown', 'pointermove'].forEach((t) => c.addEventListener(t, (e) => { if (!e.buttons) return; const r = c.getBoundingClientRect(); __path.push({ x: Math.floor((e.clientX - r.left) / r.width * __mstest.W), y: Math.floor((e.clientY - r.top) / r.height * __mstest.H) }); })); });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); await idle(page);
  const p = await plan(page), got = Object.keys(p.a).filter((x) => p.locks[x] === k).map(Number).sort((x, y) => x - y);
  // every section under the pointer's path, joining its points with straight lines (a fast drag skips nothing)
  const want = await page.evaluate(() => {
    const t = __mstest, P = __path, s = new Set();
    const at = (x, y) => { if (x < 0 || y < 0 || x >= t.W || y >= t.H) return; const l = t.labels[y * t.W + x]; if (l > 0 && t.assignData.assign[l]) s.add(l); };
    at(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) { const A = P[i - 1], B = P[i], dx = B.x - A.x, dy = B.y - A.y, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))); for (let j = 1; j <= n; j++) at(Math.round(A.x + dx * j / n), Math.round(A.y + dy * j / n)); }
    return [...s].sort((x, y) => x - y);
  });
  assert.ok(want.length >= 8, 'the drag crosses many sections: ' + want.length);
  assert.ok((await page.evaluate(() => __path.length)) >= 5, 'several pointer moves');
  assert.deepEqual(got, want, 'exactly the passed-over sections are painted and pinned');
  for (const x in p0.a) if (!got.includes(+x)) assert.equal(p.a[x], p0.a[x], 'section ' + x + ' untouched');
  assert.equal(p.n, p0.n + 1, 'one stroke, one Undo step');
  assert.equal(p.label, `Painted ${got.length} sections with ` + (await page.evaluate((k) => sfCollection().find((m) => m.mkey === k).code, k)));
  assert.doesNotMatch(await page.evaluate(() => { const t = document.getElementById('msToast'); return t ? t.textContent : ''; }), /Painted/, 'no toast after each stroke: ↶ Undo is in the zoom row');
  assert.equal(await vsFull(page), 0, 'incremental redraw matches a full redraw');
  await page.click('#sfPlanUndo'); await idle(page);
  const u = await plan(page);
  assert.deepEqual(u.a, p0.a); assert.deepEqual(u.locks, p0.locks); assert.equal(u.n, p0.n);
  assert.deepEqual(errors, []);
});

test('Paint with touch: one finger paints, two fingers zoom and pan without painting, a late second finger stops the stroke', CDP_ONLY, async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const k1 = await unusedKey(page);
  await page.evaluate((k) => localStorage.setItem('ms-recent-mk', JSON.stringify([k])), k1);
  await manual(page); await page.click('#sfPaint'); await idle(page);
  const cdp = await page.context().newCDPSession(page); await touch(cdp);
  await scrollTop(page);
  const k = await page.evaluate(() => __mstest.paintKey), ls = await bigSections(page, 3);
  const pts = []; for (const l of ls) pts.push(await sectionPoint(page, l));
  const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON()), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  let p0 = await plan(page);
  // two fingers together: pinch out and move — zooms and pans, paints nothing
  await T(cdp, 'touchStart', [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }]);
  for (let i = 1; i <= 6; i++) await T(cdp, 'touchMove', [{ x: cx - 20 - i * 12, y: cy + i * 4 }, { x: cx + 20 + i * 12, y: cy + i * 4 }]);
  await T(cdp, 'touchEnd', []); await idle(page);
  let s = await page.evaluate(() => ({ z: __mstest.zoom, x: __mstest.panX, y: __mstest.panY }));
  assert.ok(s.z > 1.5, 'zoomed in: ' + s.z);
  let p = await plan(page);
  assert.deepEqual(p.a, p0.a, 'nothing painted'); assert.equal(p.n, p0.n, 'no Undo step');
  // two fingers moving together pan the zoomed picture
  await T(cdp, 'touchStart', [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
  for (let i = 1; i <= 5; i++) await T(cdp, 'touchMove', [{ x: cx - 30 + i * 8, y: cy + i * 5 }, { x: cx + 30 + i * 8, y: cy + i * 5 }]);
  await T(cdp, 'touchEnd', []); await idle(page);
  const s2 = await page.evaluate(() => ({ z: __mstest.zoom, x: __mstest.panX, y: __mstest.panY }));
  assert.ok(s2.x !== s.x || s2.y !== s.y, 'panned');
  assert.deepEqual((await plan(page)).a, p0.a, 'still nothing painted');
  // back to the whole picture for the rest
  await page.click('#sfZrst'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.zoom), 1);
  const q = []; for (const l of ls) q.push(await sectionPoint(page, l));
  // a second finger landing just after the first (before it paints): nothing painted
  const f2 = { x: c.x + c.width * 0.75, y: q[0].y + 30 };
  await T(cdp, 'touchStart', [{ x: q[0].x, y: q[0].y, id: 1 }]); // (the second lands at once: well inside the 110 ms before a touch paints)
  await T(cdp, 'touchStart', [{ x: q[0].x, y: q[0].y, id: 1 }, { x: f2.x, y: f2.y, id: 2 }]);
  for (let i = 1; i <= 4; i++) await T(cdp, 'touchMove', [{ x: q[0].x - i * 4, y: q[0].y - i * 4, id: 1 }, { x: f2.x + i * 4, y: f2.y + i * 4, id: 2 }]);
  await T(cdp, 'touchEnd', []); await idle(page);
  p = await plan(page);
  assert.deepEqual(p.a, p0.a, 'a pinch that starts one finger at a time paints nothing'); assert.equal(p.n, p0.n);
  await fitPicture(page);
  // one finger: tap paints its section
  await T(cdp, 'touchStart', [{ x: q[0].x, y: q[0].y }]); await T(cdp, 'touchEnd', []); await idle(page);
  p = await plan(page);
  assert.equal(p.a[ls[0]], k); assert.equal(p.n, p0.n + 1, 'a touch tap is one step');
  // one finger held (so it paints), then a second finger: the painted section stays, the stroke ends, the rest is a pinch
  p0 = p;
  await T(cdp, 'touchStart', [{ x: q[1].x, y: q[1].y, id: 1 }]);
  await until(page, ([l, k]) => __mstest.assignData.assign[l].mkey === k, [ls[1], k], 'the held finger painting its section');
  await T(cdp, 'touchStart', [{ x: q[1].x, y: q[1].y, id: 1 }, { x: q[2].x, y: q[2].y, id: 2 }]);
  for (let i = 1; i <= 4; i++) await T(cdp, 'touchMove', [{ x: q[1].x - i * 10, y: q[1].y, id: 1 }, { x: q[2].x + i * 10, y: q[2].y, id: 2 }]);
  await T(cdp, 'touchEnd', []); await idle(page);
  p = await plan(page);
  assert.equal(p.a[ls[1]], k, 'painted before the second finger: kept');
  assert.deepEqual(Object.keys(p.a).filter((x) => p.a[x] !== p0.a[x]).map(Number), [ls[1]], 'the second finger paints nothing');
  assert.equal(p.n, p0.n + 1, 'one step');
  assert.deepEqual(errors, []);
});

test('Paint off: a tap opens the picker as before; leaving the Pattern tab or Manual turns Paint off; the page still scrolls outside the picture', CDP_ONLY, async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await manual(page);
  await page.click('#sfPaint'); await idle(page);
  await page.click('#sfPaint'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintOn), false);
  assert.equal(await page.evaluate(() => document.getElementById('sfCanvas').style.cursor), '');
  const [l] = await bigSections(page, 1), p0 = await plan(page);
  await tap(page, l);
  assert.ok(await page.isVisible('#sfSheet'), 'picker straight away');
  assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
  await page.click('#sfPopCancel'); await idle(page);
  assert.deepEqual((await plan(page)).a, p0.a);
  // leaving the Pattern tab
  await page.click('#sfPaint'); await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintOn), false, 'off after leaving Pattern');
  await page.click('.sftabbtn[data-t="pattern"]');
  assert.equal(await page.textContent('#sfPaint'), 'Paint');
  // leaving Manual
  await page.click('#sfPaint'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintOn), false, 'off after leaving Manual');
  assert.equal(await page.locator('#sfPaint').count(), 0);
  await page.click('#sfFam [data-v="manual"]'); await idle(page);
  assert.equal(await page.textContent('#sfPaint'), 'Paint', 'still off back in Manual');
  // a finger swipe on the controls (outside the picture) scrolls the page while painting
  await page.click('#sfPaint'); await idle(page);
  const cdp = await page.context().newCDPSession(page); await touch(cdp);
  await scrollTop(page);
  const y0 = await page.evaluate(() => scrollY), box = await page.evaluate(() => document.querySelector('.sfbar').getBoundingClientRect().toJSON());
  const sx = 195, sy = Math.min(800, box.y - 20);
  await T(cdp, 'touchStart', [{ x: sx, y: sy }]);
  for (let i = 1; i <= 8; i++) await T(cdp, 'touchMove', [{ x: sx, y: sy - i * 30 }]);
  await T(cdp, 'touchEnd', []); await idle(page);
  assert.ok((await page.evaluate(() => scrollY)) > y0, 'page scrolled');
  assert.deepEqual(errors, []);
});
