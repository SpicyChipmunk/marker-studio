// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, letterGuide, idle, saveGuide, sectionPoint, scrollTop, answerAsks, welcome, ROOT, notOnWebKit, WK } from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

const AUTO = 2300;
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, n: Object.keys(p.assign || {}).length }), id);
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
const bigSec = (page, i = 2) => page.evaluate((i) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[i]; }, i);
async function excludeOne(page) {
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const l = await bigSec(page);
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y);
  await page.waitForFunction((l) => !__mstest.counted(l), l);
  return l;
}

test('← Plan › Discard edits on section edits brought back by Resume opens the guide as built; a tick then saves it as built', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId), n0 = await page.evaluate(() => __mstest.assignData.N);
  await tickN(page, 3); await idle(page, AUTO);
  const l = await excludeOne(page);
  await hide(page); await idle(page);
  await page.reload();
  await page.waitForSelector('#sfResume', { state: 'visible' });
  await page.click('#sfResumeGo');
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  // ← Plan asks; Discard edits
  await page.evaluate(() => scrollTo(0, 99999)); await idle(page);
  await page.click('#sfToPlan');
  await page.waitForSelector('#sfEdAsk'); await page.click('#sfEdAsk [data-a="discard"]');
  await page.waitForFunction(() => __mstest.sfmode !== 'review' && __mstest.assignData); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), l), true, 'the section left out is back');
  assert.equal(await page.evaluate(() => __mstest.assignData.N), n0, 'as built');
  await tickN(page, 1, 5); await page.evaluate(() => __mstest.flushSave()); await idle(page, AUTO);
  assert.equal((await stored(page, id)).n, n0, 'the Library guide keeps every section');
  assert.deepEqual(errors, []);
});

test('Use in a guide › New guide with it, then a file that won’t open: the open guide keeps its own palette', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const src0 = await page.evaluate(() => __mstest.styleVars.paletteSource);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfEdAsk [data-a="new"]')]);
  await fc.setFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), src0, 'still its own');
  // and the palette still waits for the next new guide, shown on Home
  await page.click('#mHome'); await idle(page);
  assert.match(await page.textContent('#homePalNote'), /for your next new guide/);
  assert.deepEqual(errors, []);
});

test('Discard edits with more section edits than Undo keeps: it says so and stays in Edit sections, nothing lost', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await saveGuide(page);
  await page.click('#sfBack2'); await idle(page);
  // 30 merges, more than the 25 steps Undo keeps
  await page.evaluate(() => { const t = __mstest; for (let i = 0; i < 30; i++) { const o = t.assignData.order.filter((l) => t.counted(l) && t.comps[l] && !t.comps[l].merged); t.mergeCellsSnap(o[2 * i % o.length], o[(2 * i + 1) % o.length]); } t.render(); });
  await idle(page);
  await page.evaluate(() => scrollTo(0, 99999)); await idle(page);
  await page.click('#sfToPlan');
  await page.waitForSelector('#sfEdAsk'); await page.click('#sfEdAsk [data-a="discard"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review', 'stays');
  assert.match(await page.textContent('#sfMeta'), /couldn’t be undone/);
  assert.deepEqual(errors, []);
});

test('Palette › Use in a guide › Recolour from Colour along: back to the Plan and laid with the palette; with section edits it waits', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page); await tickN(page, 3);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  const pal = await page.evaluate(() => currentPaletteIdxs().map(mkey));
  await page.click('#useInGuide'); await page.click('#sfEdAsk [data-a="recolour"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'in the Plan');
  const used = await page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey))]);
  assert.ok(used.some((k) => pal.includes(k)), 'laid with the palette');
  // (v308: the palette isn't saved to the Library for it; the plan keeps it as handed over, and the toast offers Undo)
  assert.match(await page.textContent('#msToast'), /Recoloured the guide with this palette|Palette: .+Undo/);
  // with section edits not built: nothing changes, and it says why
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { const t = __mstest, l = t.assignData.order[4]; t.secState[l] = 2; t.render(); }); await idle(page);
  const src = await page.evaluate(() => [__mstest.styleVars.paletteSource, __mstest.sfmode]);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide'); await page.click('#sfEdAsk [data-a="recolour"]'); await idle(page);
  assert.match(await page.textContent('#msToast'), /Build again or discard your section edits first/);
  assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.paletteSource, __mstest.sfmode]), src);
  assert.deepEqual(errors, []);
});

test('Change colour open as an iPad turns from landscape to portrait (or a phone size): the sheet keeps its room, Done on screen', async () => {
  for (const to of [[834, 1194], [390, 844], [320, 568]]) {
    const { page, errors, ctx } = await openApp({ width: 1194, height: 834 });
    await sampleGuide(page);
    const l = await bigSec(page); await scrollTop(page);
    const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
    await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet', { state: 'visible' }); await idle(page);
    await page.setViewportSize({ width: to[0], height: to[1] }); await idle(page); await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({ h: document.getElementById('sfSheet').getBoundingClientRect().height, done: document.getElementById('sfPopConfirm').getBoundingClientRect().bottom, vh: innerHeight }));
    assert.ok(m.h >= to[1] * 0.45, `${to}: the sheet's room (${m.h})`);
    assert.ok(m.done <= m.vh, `${to}: Done on screen`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('a backup restored over a guide deleted while open: the open guide becomes the restored one, saved as it shows', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await tickN(page, 3); await page.evaluate(() => __mstest.flushSave()); await idle(page, AUTO);
  await page.evaluate(() => openLibrary());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const file = await dl.path();
  await page.keyboard.press('Escape'); await idle(page);
  await tickN(page, 3, 3); await page.evaluate(() => __mstest.flushSave()); await idle(page, AUTO);
  // deleted in the Library, its Undo let go
  await page.evaluate((id) => { openLibrary(); libDelete(id); libFinish(); }, id); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  await page.setInputFiles('#guidesFile', file); await idle(page, 2000);
  assert.equal(await page.evaluate(() => [...__mstest.colored].reduce((a, b) => a + b, 0)), 3, 'the open guide is the restored one');
  assert.equal((await stored(page, id)).prog, 3);
  assert.doesNotMatch(await page.textContent('#sfSaveSt'), /Removed/);
  assert.deepEqual(errors, []);
});

test('Generate palette and Draw a marker by keyboard: the focus stays on the button', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#mPalette'); await idle(page);
  await page.focus('#draw'); await page.keyboard.press('Enter'); await idle(page, 1200);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'draw');
  await page.keyboard.press(' '); await idle(page, 1200);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'draw');
  assert.deepEqual(errors, []);
});

test('phone: a new photo’s Edit sections shows its tools above the bar on the first screen', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await page.evaluate(() => scrollTo(0, 0)); await idle(page);
  const m = await page.evaluate(() => ({ ed: document.getElementById('sfEdit').getBoundingClientRect().bottom, bar: document.querySelector('#sfWork>.sfbar').getBoundingClientRect().top }));
  assert.ok(m.ed <= m.bar, JSON.stringify(m));
  assert.deepEqual(errors, []);
});

test('leaving the guide saves at once: Home shows the guide just coloured, its Continue card there straight away', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await tickN(page, 4); await idle(page, 200);
  await page.click('#mHome'); await idle(page, 600);
  assert.equal(await page.isVisible('#homeCont'), true, 'Continue');
  assert.match(await page.textContent('#homeCont .hcmeta'), /^4 of \d+ coloured/);
  assert.deepEqual(errors, []);
});

test('Change colour › Done by keyboard: focus stays on screen (the section’s tip, or Unpin), not ⋯ at the top', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const l = await bigSec(page); await scrollTop(page);
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
  await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet', { state: 'visible' }); await idle(page);
  await page.click('#sfPopSw .sfswrec .sfsw:not(.on)'); await idle(page);
  await page.focus('#sfPopConfirm'); await page.keyboard.press('Enter'); await idle(page);
  // (back on the section's tip, its Change colour, when the keyboard brought it there; else Unpin or the tab)
  const a = await page.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(); return { id: e.id, tip: !!e.closest('.sftip'), on: r.top >= 0 && r.bottom <= innerHeight }; });
  assert.ok(a.tip || a.id === 'sfPinUn' || /^sfTab-/.test(a.id), JSON.stringify(a));
  assert.ok(a.on, 'on screen');
  assert.deepEqual(errors, []);
});

// v289 decisions
test('Focus mode on a phone: Greyscale, zoom and Fit in a strip of their own above the bottom bar, off the picture', async () => {
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    await page.click('#sfColor'); await idle(page); await page.click('#sfFocus'); await idle(page);
    const g = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { z: r('#sfZoomCtl'), c: r('#sfCanvas'), b: r('#sfFocBot') }; });
    assert.ok(Math.abs(g.z.bottom - g.b.top) <= 1, `${w}×${h}: the strip sits on the bottom bar`);
    // (v308: Focus mode opens zoomed in on the first section, so the canvas runs on past the strip. What the user
    // sees: the picture right down to the strip, and the strip solid over the rest, nothing of the picture through it
    // or beside its buttons. It had checked the canvas's own box, which ended above the strip at Fit.)
    const seen = await page.evaluate(() => {
      const z = document.getElementById('sfZoomCtl').getBoundingClientRect(), c = document.getElementById('sfCanvas');
      const at = (x, y) => document.elementFromPoint(x, y);
      const xs = [4, z.width / 4, z.width / 2, z.width - 4];
      return {
        above: xs.every((x) => at(x, z.top - 2) === c),
        strip: xs.every((x) => document.getElementById('sfZoomCtl').contains(at(x, z.top + 2)) || document.getElementById('sfZoomCtl').contains(at(x, z.bottom - 2))),
        solid: (() => { let e = document.getElementById('sfZoomCtl'); for (; e; e = e.parentElement) { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] === 1)) return true; if (e.id === 'sfFocBot' || e === document.body) break; } return false; })(),
      };
    });
    assert.ok(seen.above, `${w}×${h}: the picture shows right down to the strip`);
    assert.ok(seen.strip && seen.solid, `${w}×${h}: the strip sits solid over the picture (${JSON.stringify(seen)})`);
    // and zoomed all the way out (Fit frames the section in Focus mode), the whole picture ends above the strip
    for (let i = 0; i < 8 && (await page.evaluate(() => __mstest.zoom)) > 1.001; i++) { await page.click('#sfZout'); await idle(page); }
    const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON());
    assert.ok(c.bottom <= g.z.top + 1, `${w}×${h}: zoomed out, the picture ends above the strip (${c.bottom}, ${g.z.top})`);
    assert.ok(g.z.left <= 1 && g.z.right >= w - 1, 'the strip spans the screen');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Markers: ⋯ beside Copy codes in the heading, its menu clear of Palette from these; Random and Match are small', async () => {
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
  const st = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v289', 'ohuhu-hb320-picker-v3': JSON.stringify({ mode: 'collection', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [] }) };
  const { page, errors } = await openApp({ storage: st });
  await idle(page);
  const r = (s) => page.$eval(s, (e) => e.getBoundingClientRect().toJSON());
  const more = await r('#mkMore'), copy = await r('#copyBtn');
  assert.ok(Math.abs(more.top - copy.top) < 2 && more.left > copy.right, 'on the heading’s row, after Copy codes');
  assert.equal(await page.isVisible('#ownStateWrap'), false, 'no row of its own in Owned (Tick all shown is for the others)');
  await page.click('#mkMore');
  const menu = await r('#mkMenu'), pal = await r('#toPalette');
  assert.ok(menu.bottom < pal.top, 'the menu covers nothing it acts on');
  await page.keyboard.press('Escape');
  const d = await r('#mkDrawBtn'), m = await r('#mkMatchBtn'), w = await page.evaluate(() => innerWidth);
  assert.ok(d.width + m.width < w * 0.75, `small buttons (${d.width}, ${m.width})`);
  // not on other screens
  await page.click('#mPalette'); await idle(page);
  assert.equal(await page.isVisible('#mkMore'), false);
  assert.deepEqual(errors, []);
});

test('Library: the line under the title fits what is there', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(() => { state.saved = []; save(); openLibrary(); });
  assert.equal(await page.textContent('#libSub'), 'Palettes and guides you save are kept here.');
  await page.evaluate(() => { state.saved.push({ id: 9001, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 3), ts: Date.now() }); save(); renderSaved(); });
  assert.equal(await page.textContent('#libSub'), 'Tap a palette to load it.');
  await page.evaluate(() => { state.saved = [{ id: 9002, type: 'guide', name: 'G', keys: [...state.owned].slice(0, 3), ts: Date.now(), n: 10, done: 0 }]; save(); renderSaved(); });
  assert.equal(await page.textContent('#libSub'), 'Tap a guide to open it.');
  assert.deepEqual(errors, []);
});

test('iPad Home: with Your guides showing, the Library card stays beside All guides (v308.1); the backup card waits the usual 14 days', async () => {
  const g = (id, d) => ({ id, type: 'guide', name: 'G' + id, keys: ['Ohuhu|R014', 'Ohuhu|Y111'], n: 40, done: d, ts: Date.now() - id });
  const st = (first) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v289', 'ms-first-use': String(Date.now() - first * 864e5), 'ohuhu-hb320-picker-v3': JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: ['Ohuhu|R014', 'Ohuhu|Y111'], saved: [g(1, 5), g(2, 9), g(3, 0)] }) });
  // (v304: in a Safari tab a guide's first coloured section brings the backup card at once (v304-persist); the
  // 14 days are the rule for other browsers, so this checks them in Chrome, also in Safari's engine)
  const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  {
    const { page, errors, ctx } = await openApp({ width: 834, height: 1194, storage: st(1), userAgent: CHROME });
    await idle(page);
    assert.equal(await page.isVisible('#sfRecent'), true);
    // (v308.1: it had been hidden here since v289, so it vanished from Home once a restore brought guides in)
    assert.equal(await page.isVisible('#homeLibCard'), true, 'the Library card beside All guides');
    assert.equal(await page.isVisible('#backupNudge'), false, 'no backup card on day one, however many guides');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  {
    const { page, errors, ctx } = await openApp({ width: 834, height: 1194, storage: st(15), userAgent: CHROME });
    await page.waitForSelector('#backupNudge', { state: 'visible' });
    assert.doesNotMatch(await page.textContent('#backupNudge'), /One file holds/, 'one short line');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  {
    // a phone keeps its Library card
    const { page, errors, ctx } = await openApp({ storage: st(1) });
    await idle(page);
    assert.equal(await page.isVisible('#homeLibCard'), true);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Palette: a Saved palettes link at the top opens the Library with palettes first; Custom and Photo on a row of their own', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await page.click('#mPalette'); await idle(page);
  assert.equal(await page.isVisible('#palSaved'), false, 'nothing saved: no link');
  assert.equal((await page.textContent('#seedWrap .szlbl')).trim(), 'Start from');
  const row = (h) => page.$eval(`#harm [data-h="${h}"]`, (b) => b.getBoundingClientRect().top);
  assert.ok(await row('custom') > await row('mono'), 'Custom starts a row');
  assert.equal(await row('custom'), await row('photo'), 'Photo beside it');
  await page.click('#draw'); await idle(page); await page.click('#saveBtn'); await idle(page);
  assert.equal(await page.isVisible('#palSaved'), true);
  assert.match(await page.textContent('#palSaved'), /^Saved palettes \(1\)/);
  assert.ok((await page.$eval('#palSaved', (b) => b.getBoundingClientRect().height)) >= 44, '44px to tap');
  await page.click('#palSaved'); await idle(page);
  assert.equal(await page.isVisible('#savedOverlay'), true);
  assert.equal(await page.getAttribute('#savedList .stile', 'class').then((c) => /spalette|sdraw/.test(c)), true, 'a palette first');
  assert.deepEqual(errors, []);
});

test('Back closes what is open first: the Library, a sheet, Focus mode, then Colour along; then it would leave', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const back = async () => { await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await page.waitForTimeout(150); await idle(page); };
  const url = page.url();
  // the Library (a dialog)
  await page.evaluate(() => openLibrary()); await idle(page); await page.waitForTimeout(100);
  await back();
  assert.equal(await page.isVisible('#savedOverlay'), false, 'Library closed');
  assert.equal(page.url(), url, 'still in the app');
  // a sheet (⋯)
  await page.click('#sfMore'); await idle(page); await page.waitForTimeout(100);
  await page.waitForSelector('#sfSheet .sfmitem');
  assert.equal(await page.evaluate(() => __mstest.sheetOpen()), true);
  await back();
  assert.equal(await page.evaluate(() => __mstest.sheetOpen()), false, 'sheet closed');
  // Colour along, Focus mode
  await page.click('#sfColor'); await idle(page); await page.click('#sfFocus'); await idle(page); await page.waitForTimeout(100);
  await back();
  assert.deepEqual(await page.evaluate(() => [__mstest.focus, __mstest.sfmode]), [false, 'color'], 'Focus mode first');
  await back();
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'then Colour along, back to the Plan');
  assert.equal(page.url(), url);
  // closed in the app, its entry goes too: nothing left for Back to close
  await page.evaluate(() => openLibrary()); await idle(page); await page.waitForTimeout(100);
  await page.click('#savedClose'); await idle(page); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => history.state && history.state.msLayer), null);
  assert.deepEqual(errors, []);
});

test('Home › New colouring guide with section edits not built: the Guide screen asks first; Discard edits opens the picker', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await saveGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { const t = __mstest, l = t.assignData.order[4]; t.secState[l] = 2; t.render(); }); await idle(page);
  assert.equal(await page.evaluate(() => SF.secEdPending()), true);
  await page.click('#mHome'); await idle(page);
  let chose = false;
  page.on('filechooser', () => { chose = true; });
  await page.click('#homeNew');
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.isVisible('#sfRoot'), true, 'on the Guide screen');
  assert.equal(await page.textContent('#sfEdAskT'), 'Section edits not saved');
  assert.equal(chose, false, 'no picker yet');
  await page.click('#sfEdAsk [data-a="stay"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review', 'Cancel: still in Edit sections, edits kept');
  // Discard edits: the photo picker opens in the same tap, the edits gone
  await page.click('#mHome'); await idle(page);
  await page.click('#homeNew'); await page.waitForSelector('#sfEdAsk');
  await Promise.all([page.waitForEvent('filechooser'), page.click('#sfEdAsk [data-a="discard"]')]);
  await idle(page);
  assert.equal(await page.evaluate(() => [__mstest.sfmode, SF.secEdPending()].join()), 'guide,false');
  await page.click('#mHome'); await idle(page);
  await Promise.all([page.waitForEvent('filechooser'), page.click('#homeNew')]);
  assert.deepEqual(errors, []);
});

test('sheets: the markers list counts its shading markers in the title; a sideways row fades at its edge; Print says less on a small phone', async () => {
  {
    const { page, errors, ctx } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
    await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
    await page.click('#sfMkList'); await page.waitForSelector('#sfSheet', { state: 'visible' }); await idle(page);
    const n = await page.$$eval('#sfSheet button.sfmlrow', (b) => b.length), t = await page.$$eval('#sfSheet .sfmlgrp ~ .sfmlrow', (b) => b.length);
    assert.ok(t > 0, 'some markers for shading');
    assert.equal(await page.textContent('#sfSheetT'), `${n} markers on this page, ${t} more for shading`);
    await page.click('#sfSheet [data-ml="done"]'); await idle(page);
    // Change colour's rows: the faded edge goes once a row is scrolled to its end
    const p = await page.evaluate(() => { const t = __mstest, l = t.assignData.order[10], q = t.labelPos(l), c = document.getElementById('sfCanvas').getBoundingClientRect(); return { x: c.left + (q.x / t.W) * c.width, y: c.top + (q.y / t.H) * c.height }; });
    await page.mouse.click(p.x, p.y); await page.waitForSelector('.sftip');
    await page.click('.sftip >> text=Change colour'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
    const row = '#sfPopSw .sfswrow .sfswl';
    assert.equal(await page.$eval(row, (r) => r.classList.contains('sffade') === r.scrollWidth > r.clientWidth + 2), true, 'faded when there is more');
    await page.$eval(row, (r) => { r.scrollLeft = r.scrollWidth; r.dispatchEvent(new Event('scroll')); });
    assert.equal(await page.$eval(row, (r) => r.classList.contains('sffade')), false, 'not at its end');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  {
    const { page, errors, ctx } = await openApp({ width: 320, height: 568 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh'); await idle(page);
    assert.match(await page.textContent('#sfPrSum'), /^\d+ pages · Letter · Codes\d+ small sections on \d+ close-up pages?\.$/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Change colour by keyboard: one Tab stop per row or group, the arrow keys within it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const p = await page.evaluate(() => { const t = __mstest, l = t.assignData.order[10], q = t.labelPos(l), c = document.getElementById('sfCanvas').getBoundingClientRect(); return { x: c.left + (q.x / t.W) * c.width, y: c.top + (q.y / t.H) * c.height }; });
  await page.mouse.click(p.x, p.y); await page.waitForSelector('.sftip');
  await page.click('.sftip >> text=Change colour'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  const stops = () => page.evaluate(() => { const ls = [...document.querySelectorAll('#sfPopSw .sfswl')].filter((l) => l.closest('.sfswg:not([hidden])')); return { lists: ls.length, stops: ls.map((l) => [...l.querySelectorAll('.sfsw')].filter((b) => b.tabIndex === 0 && !b.hidden).length) }; });
  const s = await stops();
  assert.ok(s.lists > 5);
  assert.deepEqual(s.stops, s.stops.map(() => 1), 'one Tab stop in each');
  assert.ok(await page.evaluate(() => document.querySelectorAll('#sfPopSw .sfsw').length) > 100, 'of a hundred and more markers');
  // a family group of several lines: → along, ↓ to the line under, End and Home
  const g = await page.evaluate(() => { const l = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfswl')].find((x) => x.children.length > 12); const b = l.querySelector('.sfsw'); b.tabIndex = 0; b.focus(); return [...l.querySelectorAll('.sfsw')].indexOf(b); });
  assert.equal(g, 0);
  const at = () => page.evaluate(() => { const a = document.activeElement, l = a.closest('.sfswl'); return { i: [...l.querySelectorAll('.sfsw')].indexOf(a), top: a.offsetTop, tab: a.tabIndex }; });
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await at().then((x) => [x.i, x.tab]), [1, 0]);
  const t0 = (await at()).top;
  await page.keyboard.press('ArrowDown');
  assert.ok((await at()).top > t0, 'the line under');
  await page.keyboard.press('End');
  const n = await page.evaluate(() => document.activeElement.closest('.sfswl').querySelectorAll('.sfsw').length);
  assert.equal((await at()).i, n - 1);
  await page.keyboard.press('Home');
  assert.equal((await at()).i, 0);
  // Enter picks it
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('on')), true);
  // filtered: still one stop in each group shown
  await page.fill('#sfPopFilter', 'B'); await idle(page);
  const f = await stops();
  assert.deepEqual(f.stops, f.stops.map(() => 1));
  assert.deepEqual(errors, []);
});

test('Back after a reload with something open, and after closing things in the app, still closes one thing at a time', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await saveGuide(page); await idle(page);
  const back = async () => { await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await page.waitForTimeout(150); await idle(page); };
  await page.evaluate(() => openLibrary()); await page.waitForTimeout(100);
  await page.reload(); await idle(page);
  assert.ok(await page.evaluate(() => history.state && history.state.msLayer), 'an entry left from before the reload');
  // the entry left from before the reload belongs to nothing: opened and closed things count from it
  await page.evaluate(() => openLibrary()); await page.waitForTimeout(100);
  await back();
  assert.equal(await page.isVisible('#savedOverlay'), false, 'Back closes the Library');
  for (let i = 0; i < 3; i++) { await page.evaluate(() => openLibrary()); await page.waitForTimeout(80); await page.click('#savedClose'); await page.waitForTimeout(120); }
  await page.evaluate(() => openLibrary()); await page.waitForTimeout(100);
  await page.click('#savedList .stile .sopen'); await idle(page);
  await page.click('#sfColor'); await idle(page); await page.waitForTimeout(100);
  await back();
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'Back from Colour along goes to the Plan');
  assert.equal(await page.isVisible('#sfRoot'), true, 'still in the app');
  assert.deepEqual(errors, []);
});
