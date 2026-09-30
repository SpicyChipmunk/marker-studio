// Changing one section's colour, and pins, from a tap (from UX release 2, part B). A tap in the guide editor shows the
// section's marker with "Change colour" and "Pin"; the marker picker is grouped by colour family with codes on
// the tiles and a "Recently used" row; Pin colours mode toggles pins directly; Blend keeps taps for anchors and
// uses press and hold; Manual keeps opening the picker; Fill unpinned sections.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// big sections whose label points are well inside the picture (not under the zoom row), biggest first
const bigSections = (page, n = 6) => page.evaluate((n) => {
  const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), z = document.getElementById('sfZoomCtl').getBoundingClientRect();
  return t.assignData.order.filter((l) => { const q = t.labelPos(l), y = r.top + (q.y / c.height) * r.height, x = r.left + (q.x / c.width) * r.width; return y > r.top + 12 && y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 && x > r.left + 12 && x < r.right - 12; })
    .sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n);
}, n);
const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
const lock = (page, l) => page.evaluate((l) => __mstest.locks[l] ?? null, l);
async function tap(page, l) { await scrollTop(page); const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
async function styleTab(page) { await page.click('.sftabbtn[data-t="pattern"]'); }
async function pattern(page, v) { await styleTab(page); await page.click(`#sfFam [data-v="${v}"]`); await idle(page); }
// a marker in the collection that is not `not`, from a different family, and its tile
const otherKey = (page, not) => page.evaluate((not) => { const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')]; const cur = b.find((x) => x.dataset.k === not); const g = cur && cur.closest('.sfswg'); const o = b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g); return o.dataset.k; }, not);
const pickTile = (page, k) => page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
// compare the canvas with a from-scratch redraw of the same state
const vsFull = (page) => page.evaluate(() => {
  const c = document.getElementById('sfCanvas'), g = c.getContext('2d');
  __mstest.renderGuide(); const a = g.getImageData(0, 0, c.width, c.height).data.slice();
  __mstest.forceFullRender(); __mstest.renderGuide(); const b = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n;
});

test('Gradient: a tap shows the marker with Change colour and Pin; Pin survives Shuffle; Unpin goes back to the pattern', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1), code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
  await tap(page, l);
  assert.ok(await page.isVisible('.sftip'), 'tip shown');
  assert.match(await page.textContent('.sftip'), new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(await page.textContent('.sftip [data-a="change"]'), 'Change colour');
  assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Pin');
  assert.ok(!(await page.isVisible('.sftippin')), 'no Pinned chip yet');
  assert.match(await page.textContent('#sfLive'), new RegExp(code));
  // it stays (no timer) and sits inside the picture's frame
  await idle(page, 2600);
  assert.ok(await page.isVisible('.sftip'), 'a tip with buttons does not go by itself');
  const inside = await page.evaluate(() => { const t = document.querySelector('.sftip').getBoundingClientRect(), v = document.getElementById('sfView').getBoundingClientRect(); return t.left >= v.left && t.right <= v.right && t.top >= v.top && t.bottom <= v.bottom; });
  assert.ok(inside, 'tip inside the picture frame');
  const orig = await mk(page, l);
  await page.click('.sftip [data-a="pin"]'); await idle(page);
  assert.equal(await lock(page, l), orig, 'pinned to its marker');
  assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Unpin');
  assert.ok(await page.isVisible('.sftippin'), 'Pinned chip');
  await styleTab(page);
  assert.match(await page.textContent('#sfLock'), /· 1/);
  // Shuffle: the pinned section keeps its marker, the others change
  const before = await page.evaluate(() => { const a = __mstest.assignData.assign, o = {}; for (const k in a) o[k] = a[k].mkey; return o; });
  await styleTab(page); await page.click('#sfVary'); await idle(page);
  const after1 = await page.evaluate(() => { const a = __mstest.assignData.assign, o = {}; for (const k in a) o[k] = a[k].mkey; return o; });
  assert.equal(after1[l], orig, 'pinned section kept');
  assert.ok(Object.keys(before).filter((k) => before[k] !== after1[k]).length > 3, 'others changed');
  // Unpin: back to the pattern's colour
  await tap(page, l);
  await page.click('.sftip [data-a="pin"]'); await idle(page);
  assert.equal(await lock(page, l), null);
  const back = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l);
  assert.equal(await mk(page, l), back, "Unpin gives the section the pattern's colour");
  assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Pin');
  assert.deepEqual(errors, []);
});

test('Change colour: pick, Done pins it through Shuffle and every pattern; Cancel and Escape undo; picker layout', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1), orig = await mk(page, l);
  await tap(page, l); await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet', { state: 'visible' });
  assert.ok(!(await page.isVisible('.sftip')), 'the tip gives way to the picker');
  assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
  const lay = await page.evaluate(() => {
    const pop = document.getElementById('sfSheet'), tiles = [...pop.querySelectorAll('.sfsw')];
    return { role: pop.getAttribute('role'), lab: document.getElementById(pop.getAttribute('aria-labelledby'))?.textContent,
      sub: pop.querySelector('.sfpops')?.textContent || '',
      codes: tiles.every((b) => b.querySelector('.sfswt').textContent.toUpperCase() === b.dataset.code && b.hasAttribute('aria-pressed')),
      groups: [...pop.querySelectorAll('.sfswg:not(.sfswrec)')].map((g) => g.querySelector('.sfswh').textContent),
      roles: [...pop.querySelectorAll('.sfswg')].every((g) => g.getAttribute('role') === 'group' && g.getAttribute('aria-labelledby')),
      order: FAM_ORDER, recent: !!pop.querySelector('.sfswrec'), n: new Set(tiles.map((b) => b.dataset.k)).size, coll: sfCollection().length,
      confirmBg: getComputedStyle(document.getElementById('sfPopConfirm')).backgroundColor, cancelBg: getComputedStyle(document.getElementById('sfPopCancel')).backgroundColor,
      light: [...pop.querySelectorAll('.sfswg:not(.sfswrec)')].every((g) => { const L = [...g.querySelectorAll('.sfsw')].map((b) => __mstest.assignData && sfCollection().find((m) => m.mkey === b.dataset.k).lab[0]); return L.every((v, i) => i === 0 || v <= L[i - 1] + 1e-9); }),
      w: pop.getBoundingClientRect().width, inline: pop.querySelector('#sfPopSw').style.maxHeight };
  });
  assert.equal(lay.role, 'dialog'); assert.equal(lay.lab, 'Change colour');
  assert.match(lay.sub, /Now/);
  assert.ok(lay.codes, 'every tile shows its code, matching data-code');
  assert.ok(lay.roles, 'groups are labelled groups');
  const idx = lay.groups.map((g) => lay.order.indexOf(g));
  assert.ok(idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])), 'groups follow the family order: ' + lay.groups.join(', '));
  assert.ok(lay.light, 'each group runs light to dark');
  assert.equal(lay.recent, false, 'nothing recently used yet');
  assert.equal(lay.n, lay.coll, 'every marker in the collection');
  assert.equal(lay.confirmBg, 'rgb(111, 78, 245)', 'Done is the primary button');
  assert.equal(await page.textContent('#sfPopConfirm'), 'Done');
  assert.notEqual(lay.cancelBg, lay.confirmBg);
  assert.equal(lay.w, 390, 'the picker is a sheet across the screen: ' + lay.w);
  assert.equal(lay.inline, '', 'no fixed 150px list height');
  // Cancel undoes the preview
  const k1 = await otherKey(page, orig);
  await pickTile(page, k1); await idle(page);
  assert.equal(await mk(page, l), k1, 'previews live');
  assert.equal(await page.evaluate((k) => [...document.querySelectorAll(`#sfPopSw .sfsw[data-k="${k}"]`)].every((b) => b.classList.contains('on') && b.getAttribute('aria-pressed') === 'true'), k1), true);
  await page.click('#sfPopCancel'); await idle(page);
  assert.equal(await mk(page, l), orig); assert.equal(await lock(page, l), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-recent-mk')), null, 'Cancel does not count as used');
  // Escape undoes too
  await tap(page, l); await page.click('.sftip [data-a="change"]'); await pickTile(page, k1); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(!(await page.isVisible('#sfSheet')));
  assert.equal(await mk(page, l), orig); assert.equal(await lock(page, l), null);
  // Done keeps it as a pin
  await tap(page, l); await page.click('.sftip [data-a="change"]'); await pickTile(page, k1); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await mk(page, l), k1); assert.equal(await lock(page, l), k1);
  await styleTab(page); await page.click('#sfVary'); await idle(page);
  assert.equal(await mk(page, l), k1, 'kept through Shuffle');
  for (const v of ['random', 'blend', 'manual', 'gradient']) { await pattern(page, v); assert.equal(await mk(page, l), k1, 'kept in ' + v); }
  await page.click('#sfSurprise'); await idle(page);
  assert.equal(await mk(page, l), k1, 'kept through Surprise');
  // the next picker starts with it under "Recently used", which survives a reload
  await tap(page, l); await page.click('.sftip [data-a="change"]');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sfPopSw .sfswrec .sfsw')].map((b) => b.dataset.k)), [k1]);
  assert.equal(await page.evaluate(() => document.querySelector('#sfPopSw .sfswg').classList.contains('sfswrec')), true, 'recent row first');
  // filtering hides the recent row and empty groups
  const code = await page.evaluate(() => document.querySelector('#sfPopSw .sfswg:not(.sfswrec) .sfsw').dataset.code);
  await page.fill('#sfPopFilter', code.slice(0, 2).toLowerCase()); await idle(page);
  const f = await page.evaluate((q) => { const sw = document.getElementById('sfPopSw'), vis = (e) => !!e.offsetParent; return { rec: vis(sw.querySelector('.sfswrec')), groups: [...sw.querySelectorAll('.sfswg:not(.sfswrec)')].filter(vis).map((g) => [...g.querySelectorAll('.sfsw')].filter(vis).length), bad: [...sw.querySelectorAll('.sfsw')].filter(vis).some((b) => !b.dataset.code.startsWith(q)) }; }, code.slice(0, 2).toUpperCase());
  assert.equal(f.rec, false, 'recent row hidden while filtering');
  assert.ok(f.groups.length >= 1 && f.groups.every((n) => n > 0), 'only groups with matches: ' + JSON.stringify(f.groups));
  assert.equal(f.bad, false);
  await page.click('#sfPopCancel');
  await page.reload(); await page.waitForFunction(() => window.__mstest);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-recent-mk'))), [k1]);
  assert.deepEqual(errors, []);
});

test('colour along never shows the buttons, and an open tip closes when colouring starts', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l, l2] = await bigSections(page, 2);
  await tap(page, l);
  assert.ok(await page.isVisible('.sftip [data-a="pin"]'));
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.locator('.sftip').count(), 0, 'tip closed on entering colour along');
  await tap(page, l2);
  assert.equal(await page.locator('.sftip [data-a]').count(), 0, 'no buttons while colouring');
  assert.deepEqual(errors, []);
});

test('Pin colours mode: a tap toggles the pin, with no picker', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1), orig = await mk(page, l);
  await styleTab(page); await page.click('#sfLock'); await idle(page);
  assert.match(await page.textContent('.sftab[data-tab="pattern"]'), /Tap sections to pin or unpin their colour\./);
  await tap(page, l);
  assert.ok(!(await page.isVisible('#sfSheet')), 'no picker');
  assert.equal(await page.locator('.sftip').count(), 0, 'no tip');
  assert.equal(await lock(page, l), orig);
  assert.match(await page.textContent('#sfLock'), /· 1/);
  await tap(page, l);
  assert.equal(await lock(page, l), null, 'second tap unpins');
  assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
  assert.deepEqual(errors, []);
});

test('shading on: a new colour brings its own tones, drawn exactly as a full redraw', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('.sftabbtn[data-t="colours"]');
  const [l] = await bigSections(page, 1), orig = await mk(page, l);
  await page.evaluate((l) => { __mstest.tonePart[l] = 1; }, l);
  await tap(page, l); await page.click('.sftip [data-a="change"]');
  const k1 = await otherKey(page, orig); await pickTile(page, k1); await page.click('#sfPopConfirm'); await idle(page);
  const code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
  assert.equal(await page.evaluate((l) => __mstest.tonePart[l], l), 0, 'part-done tones reset for the new marker');
  await tap(page, l);
  assert.match(await page.textContent('.sftip .sftipsh'), new RegExp('B ' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'tip lists the new base');
  assert.equal(await vsFull(page), 0, 'redraw matches a full redraw');
  assert.deepEqual(errors, []);
});

test('a changed colour and a pin come back when the guide is saved and opened again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l, l2] = await bigSections(page, 2), orig = await mk(page, l);
  await tap(page, l); await page.click('.sftip [data-a="change"]');
  const k1 = await otherKey(page, orig); await pickTile(page, k1); await page.click('#sfPopConfirm'); await idle(page);
  await tap(page, l2); await page.click('.sftip [data-a="pin"]'); const k2 = await mk(page, l2);
  const cx = await page.evaluate((ls) => ls.map((l) => [__mstest.comps[l].cx, __mstest.comps[l].cy]), [l, l2]);
  await page.click('#sfSave'); await idle(page);
  await page.reload();
  await page.click('#mHome');
  await page.click('#sfRecent [data-gid]');
  await page.waitForFunction(() => __mstest.assignData);
  await idle(page);
  // section numbers can change on reopening: find them by position
  const r = await page.evaluate((cx) => { const t = __mstest; return cx.map(([x, y]) => { const l = t.labels[Math.round(y) * t.W + Math.round(x)]; return { m: t.assignData.assign[l].mkey, k: t.locks[l] ?? null, base: !!(t.assignData.base && t.assignData.base[l]) }; }); }, cx);
  assert.deepEqual(r.map((x) => [x.m, x.k]), [[k1, k1], [k2, k2]]);
  assert.ok(r.every((x) => x.base), 'Unpin has something to go back to');
  assert.deepEqual(errors, []);
});

test('keyboard: Tab reaches the tip buttons, Escape closes the tip', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l] = await bigSections(page, 1);
  await tap(page, l);
  let got = null;
  for (let i = 0; i < 12 && !got; i++) { await page.keyboard.press('Tab'); got = await page.evaluate(() => document.activeElement?.closest('.sftip') ? document.activeElement.dataset.a : null); }
  assert.equal(got, 'change', 'Tab lands on Change colour');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'pin');
  await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await lock(page, l), 'Enter pins');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'pin', 'focus stays on the button');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.locator('.sftip').count(), 0);
  assert.deepEqual(errors, []);
});

test('Blend: a tap still adds an anchor; press and hold shows the tip without adding one', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await pattern(page, 'blend');
  const n0 = await page.evaluate(() => __mstest.anchors.length);
  const ls = await bigSections(page, 6);
  const far = await page.evaluate((ls) => ls.find((l) => { const t = __mstest, c = t.comps[l], tol = Math.max(t.W, t.H) * 0.06; return t.anchors.every((a) => Math.hypot(a.x - c.cx, a.y - c.cy) > tol); }), ls);
  await scrollTop(page);
  const p = await sectionPoint(page, far);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await idle(page); await page.mouse.up(); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'press and hold adds no anchor');
  assert.ok(await page.isVisible('.sftip [data-a="pin"]'), 'tip with buttons');
  assert.match(await page.textContent('.sftab[data-tab="pattern"]'), /Press and hold a section to change or pin its colour/);
  await page.click('.sftip [data-a="pin"]'); await idle(page);
  assert.ok(await lock(page, far), 'pinned in Blend');
  await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1, 'a plain tap adds an anchor');
  assert.equal(await page.locator('.sftip').count(), 0, 'and closes the tip');
  assert.deepEqual(errors, []);
});

test('Manual: a tap still opens the picker, with Unpin (allow fill) on a pinned section', async () => {
  const { page, errors } = await openApp({ width: 1100, height: 900 });
  await sampleGuide(page);
  await pattern(page, 'manual');
  assert.match(await page.textContent('.sftab[data-tab="pattern"]'), /Tap a section to set its colour/);
  const [l] = await bigSections(page, 1), orig = await mk(page, l);
  await tap(page, l);
  assert.ok(await page.isVisible('#sfSheet'), 'picker straight away');
  assert.equal(await page.locator('.sftip').count(), 0);
  assert.equal(await page.locator('#sfPopExtra').count(), 0, 'not pinned: no Unpin');
  const k1 = await otherKey(page, orig); await pickTile(page, k1);
  // a tap on another section (one the picker doesn't cover) keeps this one and opens the picker for that one
  const l2 = await page.evaluate((l) => { const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), pr = document.getElementById('sfSheet').getBoundingClientRect();
    return t.assignData.order.filter((k) => k !== l && t.comps[k].area > 400).find((k) => { const q = t.labelPos(k), x = r.left + (q.x / c.width) * r.width, y = r.top + (q.y / c.height) * r.height; return y > r.top + 8 && y < r.bottom - 8 && x > r.left + 8 && x < r.right - 8 && (x < pr.left - 8 || x > pr.right + 8 || y < pr.top - 8 || y > pr.bottom + 8) && document.elementFromPoint(x, y) === c; }); }, l);
  assert.ok(l2, 'a section outside the picker');
  await tap(page, l2);
  assert.equal(await mk(page, l), k1); assert.equal(await lock(page, l), k1);
  assert.ok(await page.isVisible('#sfSheet'), 'picker open for the next section');
  await page.click('#sfPopCancel'); await idle(page);
  await tap(page, l);
  assert.equal(await page.textContent('#sfPopExtra'), 'Unpin (allow fill)');
  await page.click('#sfPopExtra'); await idle(page);
  assert.equal(await lock(page, l), null); assert.equal(await mk(page, l), k1, 'Manual keeps the colour when unpinned');
  assert.deepEqual(errors, []);
});

test('Photo: a pinned section is not left white, and its tip has the buttons', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const [l, l2] = await bigSections(page, 2), orig = await mk(page, l);
  await tap(page, l); await page.click('.sftip [data-a="pin"]'); await idle(page);
  // a white photo: every section it covers would be left white
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#fcfcfa'; g.fillRect(0, 0, 600, 800);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  await styleTab(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'white.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking); await idle(page);
  if (await page.evaluate(() => __mstest.photoAlign)) { await page.click('#sfPhAlign'); await idle(page); }
  const r = await page.evaluate(([l, l2]) => { const a = __mstest.assignData; return { m: a.assign[l] && a.assign[l].mkey, paper: !!(a.paper && a.paper[l]), paper2: !!(a.paper && a.paper[l2]) }; }, [l, l2]);
  assert.equal(r.paper2, true, 'an unpinned section is left white');
  assert.equal(r.paper, false); assert.equal(r.m, orig, 'the pinned one keeps its marker');
  await tap(page, l);
  assert.ok(await page.isVisible('.sftip [data-a="pin"]'));
  assert.match(await page.textContent('.sftip'), /\(pinned\)/);
  assert.equal(await page.textContent('.sftip [data-a="pin"]'), 'Unpin');
  // a white section: no buttons
  await tap(page, l2);
  assert.equal(await page.locator('.sftip [data-a]').count(), 0);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const biggestSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }

test('while a marker picker is open: no Undo in the tool row, no auto-save of the preview; Done is announced', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfSave'); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id), savedAssign = () => page.evaluate((id) => IDB.get('guide-' + id).then((p) => JSON.stringify(p.assign)), id);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfVary'); await idle(page, 2500);
  assert.equal(await page.isVisible('#sfPlanUndo'), true);
  const before = await savedAssign();
  const [l] = await biggestSections(page, 1), code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
  await scrollTop(page); await tapSection(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh');
  assert.equal(await page.isVisible('#sfPlanUndo'), false, 'Undo hidden: the sheet has Cancel');
  const k = await page.evaluate((cur) => [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find((b) => b.dataset.k !== cur).dataset.k, await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l));
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`); await idle(page, 2500);
  assert.equal(await savedAssign(), before, 'the preview is not saved');
  await page.click('#sfPopConfirm'); await idle(page);
  assert.match(await page.textContent('#sfLive'), new RegExp('^' + code + ' → \\S+ .*1 section'), 'announced: ' + await page.textContent('#sfLive'));
  await idle(page, 2500);
  assert.notEqual(await savedAssign(), before, 'saved once confirmed');
  assert.equal(await page.isVisible('#sfPlanUndo'), true);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
test('Fill unpinned sections leaves sections ticked done with their marker', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  const l = await page.evaluate(() => __mstest.assignData.order[3]);
  await page.evaluate((l) => { __mstest.colored[l] = 1; __mstest.renderGuide(); }, l);
  const m0 = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  const k = await page.evaluate((m0) => sfCollection().find((m) => m.mkey !== m0).mkey, m0);
  await page.evaluate(() => __mstest.openFillPop()); await page.waitForSelector('#sfPopSw');
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), m0, 'the done section keeps its marker');
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[__mstest.assignData.order[5]].mkey, l), k, 'the others are filled');
  assert.deepEqual(errors, []);
});
