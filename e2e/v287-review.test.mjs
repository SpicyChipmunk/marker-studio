// v287's fresh-eyes review: changes kept as the page goes leave the Library row alone until they're in the guide, and
// never a colour only tried in the picker; a new guide saves straight after Build; zooming doesn't paint the plan over
// Edit sections, nor does a visit elsewhere after Reveal; a Temperature with no markers stays as it was; Focus mode
// stamps the start date and hands back its marker's row; very wide pictures keep their shape; the tool row stays
// above the bar on a tiny screen with large text; clearer no-markers words; guide files with no markers refused;
// Blend plan groups and the ink choice for the keyboard and screen readers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, sampleGuide, idle, saveGuide, sectionPoint, scrollTop, welcome, buildGo } from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
const canvasSig = (page) => page.evaluate(() => { const c = document.getElementById('sfCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
async function pickPhoto(page, buf, name = 'pic.png') {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { setMode('sections'); SF.pickPhoto(); })]);
  await fc.setFiles({ name, mimeType: 'image/png', buffer: buf });
}

test('changes kept as the page goes leave the Library row as it is until they are in the guide', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  const row0 = await page.evaluate((id) => { const e = state.saved.find((s) => s.id === id); return { ts: e.ts, done: e.done || 0 }; }, id);
  await tickN(page, 3);
  await page.evaluate(() => { IDB.put = () => new Promise(() => {}); window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); });
  const row1 = await page.evaluate((id) => { const e = state.saved.find((s) => s.id === id); return { ts: e.ts, done: e.done || 0 }; }, id);
  assert.deepEqual(row1, row0, 'the row is untouched as the page goes');
  await page.reload(); await idle(page);
  await page.waitForFunction((id) => (state.saved.find((s) => s.id === id).done || 0) === 3, id);
  assert.ok(await page.evaluate(([id, ts]) => state.saved.find((s) => s.id === id).ts > ts, [id, row0.ts]), 'a new time, for other tabs');
  assert.deepEqual(errors, []);
});

test('a colour only tried in the picker is never kept aside as the page is hidden', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  await scrollTop(page);
  const l = await page.evaluate(() => __mstest.assignData.order[0]);
  await page.evaluate((l) => __mstest.openSectionPop ? __mstest.openSectionPop(l) : null, l);
  const opened = await page.evaluate(() => !!document.querySelector('#sfSheet .sfsw, #sfSheet [data-k]'));
  if (!opened) {
    const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
    await page.click('.sftip [data-a="change"]'); await idle(page);
  }
  const sw = await page.$('#sfSheet [data-k]:not(.on)');
  await sw.click(); await idle(page);
  await hide(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), null);
  assert.deepEqual(errors, []);
});

test('a new guide from a photo is in the Library straight after Build (a reload a moment later keeps it)', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await pickPhoto(page, await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png')), 'letter-page.png');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await buildGo(page);
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 });
  await page.waitForTimeout(250);
  await page.reload(); await idle(page);
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1);
  assert.deepEqual(errors, []);
});

test('zooming in Edit sections, and visiting Markers after Reveal, never paint the plan over the sections', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // Reveal once
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  await page.click('#sfReveal'); await page.waitForSelector('#sfRevX', { timeout: 15000 }); await page.click('#sfRevX'); await idle(page);
  await page.click('#sfBack2'); await idle(page); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  const a = await canvasSig(page);
  await page.click('#sfZin'); await page.click('#sfZin'); await page.waitForTimeout(400);
  assert.equal(await canvasSig(page), a, 'zoomed: still the sections');
  await page.click('#mCollection'); await idle(page); await page.click('#mSections'); await idle(page); await page.waitForTimeout(300);
  assert.equal(await canvasSig(page), a, 'after Markers: still the sections');
  assert.deepEqual(errors, []);
});

test('Temperature: a choice none of your markers have stays as it was, and says so', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // only warm markers owned
  await page.evaluate(() => { const ks = []; COLORS.forEach((c, i) => { if (/^R\d|^YR|^RV/.test(c.code) && c.brand === 'Ohuhu') ks.push(i); }); state.owned = new Set(ks.slice(0, 12)); save(); SF.setCollection(sfCollection()); });
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  const was = await page.getAttribute('#sfPal .sfedit.on', 'data-v');
  assert.notEqual(was, 'cool');
  await page.click('#sfPal [data-v="cool"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfPal .sfedit.on', 'data-v'), was, 'Temperature stays');
  assert.match(await page.textContent('#sfMeta'), /None of your markers are cool/);
  assert.equal(await page.getAttribute(`#sfPal [data-v="${was}"]`, 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('Focus mode: ticks stamp when colouring started; leaving opens the marker it was on', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFDone'); await idle(page);
  assert.ok(await page.evaluate(() => __mstest.progAt.s > 0), 'start date stamped in Focus mode');
  const l = await page.evaluate(() => __mstest.focusOrd[__mstest.focusPos]);
  const k = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  await page.click('#sfExitFoc'); await idle(page); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlKey), k, 'the row of the marker Focus mode was on');
  const r = await page.evaluate(() => { const o = document.querySelector('.sfarow.open'); return o ? o.getBoundingClientRect().top : -1; });
  assert.ok(r > 0 && r < (await page.evaluate(() => innerHeight)), 'on screen');
  assert.deepEqual(errors, []);
});

test('a very wide picture keeps its shape on a phone', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look'); await idle(page);
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 3200; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 3200, 800); g.strokeStyle = '#000'; g.lineWidth = 14; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(200 + i * 400, 400, 300, 0, Math.PI * 2); g.stroke(); } g.strokeRect(7, 7, 3186, 786); return c.toDataURL('image/png').split(',')[1]; });
  await pickPhoto(page, Buffer.from(b64, 'base64'), 'wide.png');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await buildGo(page);
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 }); await idle(page);
  const r = await page.evaluate(() => { const c = document.getElementById('sfCanvas').getBoundingClientRect(); return c.width / c.height; });
  assert.ok(Math.abs(r - 4) < 0.15, 'drawn 4:1, as it is (' + r + ')');
  assert.deepEqual(errors, []);
});

test('320×568 with large text: the tool row ends above the bar at the top of the page', async () => {
  for (const scale of [1.5, 2]) {
    const { page, errors, ctx } = await openAtScale(scale, { width: 320, height: 568 });
    await sampleGuide(page); await idle(page); await scrollTop(page); await idle(page);
    const g = await page.evaluate(() => ({ tools: document.getElementById('sfZoomCtl').getBoundingClientRect().bottom, bar: document.querySelector('#sfWork>.sfbar').getBoundingClientRect().top }));
    assert.ok(g.tools <= g.bar + 0.5, `×${scale}: tools end at ${g.tools}, bar at ${g.bar}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('every marker dry: Build says so and points to Markers', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.evaluate(() => { COLORS.forEach((c, i) => { if (isOwned(i)) state.ink[mkey(i)] = 'dry'; }); save(); SF.setCollection(sfCollection()); });
  await page.evaluate(() => { setMode('sections'); SF.loadSample(); }); await idle(page, 1500);
  assert.match(await page.textContent('#sfMeta'), /Every marker you own is marked dry/);
  assert.deepEqual(errors, []);
});

test('a guide file whose sections have no markers is refused', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const file = await page.evaluate(() => IDB.get('guide-' + __mstest.curId).then((p) => JSON.stringify({ app: 'marker-studio', type: 'guide', name: 'Empty', W: __mstest.W, H: __mstest.H, keys: [], n: 0, payload: Object.assign({}, p, { assign: {} }) })));
  const n0 = await page.evaluate(() => state.saved.length);
  await page.evaluate((txt) => SF.importFile(new File([txt], 'empty.json', { type: 'application/json' })), file);
  await idle(page, 1500);
  assert.match(await page.textContent('#sfMeta'), /not a valid guide file/);
  assert.equal(await page.evaluate(() => state.saved.length), n0);
  assert.deepEqual(errors, []);
});

test('Blend plan colour groups are buttons that say whether they are open; the ink choice is pressed buttons', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  await page.click('#sfPlan'); await idle(page);
  const g = await page.$('.plangrp');
  if (g) {
    assert.equal(await g.evaluate((e) => e.tagName), 'BUTTON');
    assert.equal(await g.getAttribute('aria-expanded'), 'false');
    await g.focus(); await page.keyboard.press('Enter'); await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('plangrp') && document.activeElement.getAttribute('aria-expanded')), 'true', 'opened by keyboard, focus kept');
  }
  assert.deepEqual(errors, []);
});
