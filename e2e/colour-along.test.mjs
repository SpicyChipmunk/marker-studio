// Colour along (Release 3, docs/GUIDE-LAYOUT.md #10): the marker list starts straight under the pinned picture, one
// 48px row per marker; tapping a row opens it in place (Mark all done ↔ Clear ticks, Find next, ◐ Blends) and
// highlights the marker; the open row is always scrolled fully into view between the picture and the bar; markers
// finished earlier are gathered in a "Done (n)" group when Colour along is entered again. Also: Clear ticks and
// Reset progress, press and hold on a section, the first-time instructions, finishing the page, and the wake lock.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop, sectionPoint, toolStatus, menuItem, longPress, pause, openMenu } from './helpers.mjs';

before(setup);
after(teardown);

// the app with page errors and console errors collected
async function open(opts) {
  const app = await openApp(opts);
  app.page.on('console', (m) => { if (m.type() === 'error') app.errors.push('console: ' + m.text()); });
  return app;
}
async function along(page) { await sampleGuide(page); await idle(page); await page.click('#sfColor'); await idle(page); await scrollTop(page); }
const rows = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => ({ k: r.dataset.k, open: r.classList.contains('open'), full: r.classList.contains('full'), exp: r.querySelector('.sfah').getAttribute('aria-expanded'), cnt: r.querySelector('.cnt').textContent, h: Math.round(r.querySelector('.sfah').getBoundingClientRect().height) })));
const clickRow = async (page, i) => { await page.locator('#sfAlist .sfarow .sfah').nth(i).click(); await idle(page); };
const hl = (page) => page.evaluate(() => __mstest.hlKey);
// where the open row is, against the bottom of the pinned block and the top of the bar
const openBox = (page) => page.evaluate(() => {
  const r = document.querySelector('#sfAlist .sfarow.open').getBoundingClientRect(), bar = document.querySelector('#sfRoot .sfbar').getBoundingClientRect();
  const side = document.getElementById('sfWork').classList.contains('sfside'), pin = side ? 0 : document.getElementById('sfView').getBoundingClientRect().bottom;
  return { top: r.top, bottom: r.bottom, pin, bar: bar.top };
});
function assertInView(b, what) {
  assert.ok(b.top >= b.pin - 1, `${what}: the open row's top (${b.top}) is below the pinned block (${b.pin})`);
  assert.ok(b.bottom <= b.bar + 1, `${what}: the open row's bottom (${b.bottom}) is above the bar (${b.bar})`);
}
const secsOf = (page, k) => page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k), k);
// a marker's biggest section (easy to hit on a small picture)
const bigOf = (page, k) => page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k).sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0], k);
// scroll so the picture sits pinned at the top (the list scrolls under it)
const pinPic = (page) => page.evaluate(() => new Promise((res) => { const v = document.getElementById('sfView'), side = document.getElementById('sfWork').classList.contains('sfside'); scrollTo(0, Math.round(scrollY + v.getBoundingClientRect().top - (side ? 8 : 0))); requestAnimationFrame(() => requestAnimationFrame(res)); }));
async function hold(page, l) {
  const p = await sectionPoint(page, l);
  await longPress(page, p.x, p.y); await idle(page);
}

test('the list starts right under the pinned block: an ⓘ line, then one 48px row per marker, and nothing else', async () => {
  const { page, errors } = await open();
  await along(page);
  const g = await page.evaluate(() => {
    const pane = document.querySelector('#sfCtl .sfpane'), vis = [...pane.children].filter((e) => e.getClientRects().length);
    const tools = document.getElementById('sfZoomCtl').getBoundingClientRect(), info = document.querySelector('#sfCtl .sfinfo'), list = document.getElementById('sfAlist');
    return { first: vis[0] && vis[0].className, gap: Math.round(info.getBoundingClientRect().top - tools.bottom), infoOpen: info.classList.contains('open'), text: info.textContent, listGap: Math.round(list.getBoundingClientRect().top - info.getBoundingClientRect().bottom), inputs: document.querySelectorAll('#sfCtl input').length, kids: vis.map((e) => e.id || e.className.split(' ')[0]) };
  });
  assert.match(g.first, /sfinfo/, 'the ⓘ line comes first');
  assert.ok(g.gap >= 0 && g.gap <= 16, `straight under the tool row (${g.gap}px)`);
  assert.ok(g.infoOpen && /^iTap a marker to see its sections, then tap each section on the picture as you colour it\.More$/.test(g.text.trim()), 'the first line of the instructions and More, the first time');
  assert.ok(g.listGap >= 0 && g.listGap <= 16, `the list right after it (${g.listGap}px)`);
  assert.equal(g.inputs, 0, 'no name box');
  assert.deepEqual(g.kids, ['sfAlHint', 'sfAlist'], 'only the ⓘ line (the first time: its first line and More) and the list: no progress bar or Mark all above it (progress is in the tool row and on each row)');
  const rs = await rows(page), N = await page.evaluate(() => __mstest.assignData.N);
  assert.ok(rs.length > 5);
  assert.deepEqual([...new Set(rs.map((r) => r.h))], [48], 'every closed row is one 48px line');
  assert.ok(rs.every((r) => r.exp === 'false' && !r.open && /^0 of \d+ done$/.test(r.cnt)));
  assert.equal(await page.locator('#sfAlist .sfarow .sfah .nm b').first().textContent(), await page.evaluate(() => { const k = document.querySelector('#sfAlist .sfarow').dataset.k; return k.split('|').pop(); }), 'code first in the row');
  assert.equal(await toolStatus(page), `0 of ${N} coloured`, 'progress lives in the tool row');
  assert.ok(await page.evaluate(() => { const n = document.querySelector('#sfAlist .sfah .nm'); return getComputedStyle(n).textOverflow === 'ellipsis' && getComputedStyle(n).whiteSpace === 'nowrap'; }), 'the name is cut short with an ellipsis');
  assert.deepEqual(errors, []);
});

test('after the first time the instructions are one ⓘ line that opens in place', async () => {
  const { page, errors } = await open({ storage: { 'ms-seen-hints': '["along"]' } });
  await along(page);
  const i = page.locator('#sfCtl .sfinfo[data-info="along"]');
  assert.equal(await i.getAttribute('aria-expanded'), 'false');
  assert.equal((await i.textContent()).trim(), 'iHow colour along works');
  assert.ok((await i.locator('.sfit').boundingBox()).height <= 24, 'one line');
  assert.ok((await i.boundingBox()).height >= 44, 'a 44px tap height');
  await i.click();
  assert.equal(await i.getAttribute('aria-expanded'), 'true');
  assert.match(await i.textContent(), /Mark all done/);
  assert.deepEqual(errors, []);
});

test('a row opens in place, one at a time: Mark all done ↔ Clear ticks, Find next, Blends; tapping it again closes it', async () => {
  const { page, errors } = await open();
  await along(page);
  const N = await page.evaluate(() => __mstest.assignData.N);
  const r0 = (await rows(page))[0];
  await clickRow(page, 0);
  let rs = await rows(page);
  assert.equal(rs[0].open, true); assert.equal(rs[0].exp, 'true');
  assert.equal(await hl(page), r0.k, 'the open row is the marker highlighted on the picture');
  assert.deepEqual(await page.$$eval('#sfAlist .sfarow.open .sfacts button', (bs) => bs.map((b) => b.id + ':' + b.textContent.trim())), ['sfMarkAll:✓ Mark all done', 'sfFindNext:Find next', 'sfBlends:Blends']);
  // another row: the first one closes
  await clickRow(page, 1);
  rs = await rows(page);
  assert.deepEqual(rs.map((r) => r.open).slice(0, 3), [false, true, false], 'one open at a time');
  assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 1);
  const k = rs[1].k, n = (await secsOf(page, k)).length;
  // Mark all done: the tool row and the row count; the row stays open and in place, and the button becomes Clear ticks
  await page.click('#sfMarkAll'); await idle(page);
  assert.equal(await toolStatus(page), `${n} of ${N} coloured`);
  assert.equal(await page.$eval('#sfToolProg', (e) => e.style.width), Math.round((n / N) * 100) + '%', 'the progress line moves');
  rs = await rows(page);
  assert.equal(rs[1].k, k, 'stays in place'); assert.ok(rs[1].open && rs[1].full, 'open and dimmed');
  assert.equal(rs[1].cnt, `All ${n} done ✓`);
  assert.equal(await page.textContent('#sfMarkAll'), 'Clear ticks');
  assert.equal(await hl(page), k, 'still highlighted');
  assert.equal(await page.locator('#sfFindNext').count(), 0, 'no Find next on a finished marker');
  // (a second tap within 400 ms of Mark all done is the rest of a double tap, not Clear ticks; see "Clear ticks can be undone…" below)
  await pause(page, 400, 'a tap after the double-tap window is a Clear ticks');
  await page.click('#sfMarkAll'); await idle(page);
  assert.equal(await toolStatus(page), `0 of ${N} coloured`);
  assert.equal(await page.textContent('#sfMarkAll'), '✓ Mark all done');
  assert.match(await page.textContent('#msToast'), /Ticks cleared for .+Undo/, 'Clear ticks offers Undo');
  // a tick on the picture keeps the row open and updates its count
  const secs = await secsOf(page, k);
  await scrollTop(page);
  let p = await sectionPoint(page, secs[0]); await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], secs[0]), 1);
  assert.equal(await toolStatus(page), `1 of ${N} coloured`);
  rs = await rows(page);
  assert.ok(rs[1].open, 'stays open across progress updates'); assert.equal(rs[1].cnt, `1 of ${n} done`);
  // Find next zooms in on a section still to do: to fit it (v284: as focus mode does, 1× to 4×), its label's point in
  // view, and says how many are left
  await page.click('#sfFindNext'); await idle(page);
  const f = await page.evaluate((secs) => {
    const t = __mstest, c = document.getElementById('sfCanvas').getBoundingClientRect(), v = document.querySelector('.sfpicbox').getBoundingClientRect();
    const l = t.fnLast, q = t.labelPos(l), x = c.left + (q.x / t.W) * c.width, y = c.top + (q.y / t.H) * c.height;
    return { zoom: t.zoom, inside: x > v.left && x < v.right && y > v.top && y < v.bottom, done: t.colored[l], ofRow: secs.includes(l), sz: t.secOnScreen(l), v: [v.width, v.height] };
  }, secs);
  // (v288: only as far as it needs: about 44px across, unless that would fill the view or pass 4×)
  assert.ok(f.zoom >= 1 && f.zoom <= 4, 'zoomed to fit: ' + f.zoom);
  assert.ok(Math.min(f.sz.w, f.sz.h) >= 43 || f.zoom === 4 || Math.max(f.sz.w / f.v[0], f.sz.h / f.v[1]) >= 0.75, 'big enough to see: ' + JSON.stringify(f));
  if (f.zoom > 1.05) assert.ok(Math.min(f.sz.w, f.sz.h) <= 46 || Math.max(f.sz.w / f.v[0], f.sz.h / f.v[1]) >= 0.75, 'no further than it needs: ' + JSON.stringify(f)); assert.ok(f.inside, 'on the next section still to do'); assert.equal(f.done, 0); assert.ok(f.ofRow, 'of the open marker');
  await page.waitForFunction(() => /^Next section to colour: \d+ of \d+ left\.$/.test(document.getElementById('sfLive').textContent));
  // (and outlined, which ticking it takes away)
  assert.ok(await page.evaluate(() => { const o = document.querySelector('.sfoutline'); return !!o && o.style.display !== 'none'; }), 'the section found is outlined');
  await page.click('#sfZrst'); await idle(page);
  // Blends: the lighter and darker companions under the row
  await page.click('#sfBlends'); await idle(page);
  assert.equal(await page.getAttribute('#sfBlends', 'aria-expanded'), 'true');
  const strip = await page.$$eval('#sfAlist .sfarow.open .blendstrip .bslot', (s) => s.map((x) => x.textContent));
  assert.equal(strip.length, 3);
  assert.match(strip[0], /lighter/); assert.match(strip[1], new RegExp(k.split('|').pop() + 'base')); assert.match(strip[2], /darker/);
  await page.click('#sfBlends'); await idle(page);
  assert.equal(await page.locator('#sfAlist .blendstrip').count(), 0);
  // tapping the open row closes it: all colours again
  await clickRow(page, 1);
  assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 0);
  assert.equal(await hl(page), null, 'nothing highlighted');
  assert.equal(await page.locator('#sfMarkAll').count(), 0);
  assert.deepEqual(errors, []);
});

test('the open row scrolls fully into view: a row near the bottom, and a press and hold on a marker far down', async () => {
  const { page, errors } = await open();
  await along(page); await pinPic(page);
  // the lowest row whose line shows above the bar: its actions would be under the bar
  const i = await page.evaluate(() => { const bar = document.querySelector('#sfRoot .sfbar').getBoundingClientRect().top; let i = -1; document.querySelectorAll('#sfAlist .sfarow').forEach((r, j) => { if (r.getBoundingClientRect().bottom <= bar) i = j; }); return i; });
  assert.ok(i >= 0);
  const y0 = await page.evaluate(() => scrollY);
  await clickRow(page, i);
  assert.ok(await page.evaluate(() => scrollY) > y0, 'the page scrolled');
  assertInView(await openBox(page), 'a row near the bottom');
  // Blends makes it taller: still in view
  await page.click('#sfBlends'); await idle(page);
  assertInView(await openBox(page), 'with Blends open');
  // press and hold a section whose marker is at the bottom of the list
  await scrollTop(page); await pinPic(page);
  const k = await page.evaluate(() => { const r = document.querySelectorAll('#sfAlist .sfarow'); return r[r.length - 1].dataset.k; });
  const l = await bigOf(page, k);
  await hold(page, l);
  assert.equal(await hl(page), k, 'its marker is open and highlighted');
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'a press and hold does not tick it');
  assert.equal(await page.getAttribute(`#sfAlist .sfarow[data-k="${k}"] .sfah`, 'aria-expanded'), 'true');
  assertInView(await openBox(page), 'found by press and hold');
  assert.match(await page.textContent('#sfLive'), /^Found .+, 0 of \d+ done$/, 'announced');
  assert.deepEqual(errors, []);
});

test('finished markers stay in place while colouring; entering again gathers them in a collapsed Done (n) group', async () => {
  const { page, errors } = await open();
  await along(page);
  const before = await rows(page);
  await clickRow(page, 0); await page.click('#sfMarkAll'); await idle(page);
  await clickRow(page, 2); await page.click('#sfMarkAll'); await idle(page);
  let rs = await rows(page);
  assert.deepEqual(rs.map((r) => r.k), before.map((r) => r.k), 'nothing moved');
  assert.deepEqual(rs.filter((r) => r.full).map((r) => r.k), [before[0].k, before[2].k], 'dimmed ✓');
  assert.equal(await page.locator('#sfDoneGrp').count(), 0, 'no group while colouring');
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('#sfColor'); await idle(page);
  rs = await rows(page);
  assert.deepEqual(rs.map((r) => r.k), before.map((r) => r.k).filter((k, j) => j !== 0 && j !== 2), 'the done ones are out of the list');
  const g = page.locator('#sfDoneGrp');
  assert.equal((await g.textContent()).replace(/\s+/g, ' ').trim(), 'Done (2)');
  assert.equal(await g.locator('use').getAttribute('href'), '#i-chevron-right', 'closed: ›');
  assert.equal(await g.getAttribute('aria-expanded'), 'false', 'collapsed');
  assert.ok(await page.evaluate(() => { const g = document.getElementById('sfDoneGrp'); return !g.nextElementSibling && g.previousElementSibling.classList.contains('sfarow'); }), 'at the bottom');
  await g.click(); await idle(page);
  assert.equal(await g.getAttribute('aria-expanded'), 'true');
  const grp = await page.evaluate(() => { const out = []; for (let e = document.getElementById('sfDoneGrp').nextElementSibling; e; e = e.nextElementSibling) out.push({ k: e.dataset.k, full: e.classList.contains('full') }); return out; });
  assert.deepEqual(grp, [{ k: before[0].k, full: true }, { k: before[2].k, full: true }], 'expanded: the two done markers');
  // clearing a done marker's ticks puts it back in the list, open and in view
  await page.locator(`#sfAlist .sfarow[data-k="${before[2].k}"] .sfah`).click(); await idle(page);
  await page.click('#sfMarkAll'); await idle(page);
  assert.equal((await g.textContent()).replace(/\s+/g, ' ').trim(), 'Done (1)', 'the count follows');
  assert.equal(await g.locator('use').getAttribute('href'), '#i-chevron-down', 'open: ⌄');
  assert.equal(await hl(page), before[2].k);
  assertInView(await openBox(page), 'back in the list');
  // Reset progress (⋯, then Clear in the sheet that asks) empties the group
  await menuItem(page, 'Reset progress'); await page.click('#sfResetGo'); await idle(page);
  assert.equal(await page.locator('#sfDoneGrp').count(), 0);
  assert.match(await toolStatus(page), /^0 of \d+ coloured$/);
  assert.deepEqual(errors, []);
});

test('keyboard and screen readers: rows are buttons with aria-expanded, the actions follow by Tab, changes are announced', async () => {
  const { page, errors } = await open();
  await along(page);
  const first = page.locator('#sfAlist .sfah').first();
  await first.focus(); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await first.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.evaluate(() => document.activeElement.matches('#sfAlist .sfarow.open .sfah')), 'focus stays on the row');
  assert.match(await page.textContent('#sfLive'), /, 0 of \d+ done$/);
  const order = [];
  for (let j = 0; j < 3; j++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.id)); }
  assert.deepEqual(order, ['sfMarkAll', 'sfFindNext', 'sfBlends']);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMarkAll', 'focus kept after the list redraws');
  assert.equal(await page.textContent('#sfMarkAll'), 'Clear ticks');
  assert.match(await page.textContent('#sfLive'), /^(All \d+ .+ sections|The .+ section) ticked$/);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await first.getAttribute('aria-expanded'), 'false', 'Enter on the open row closes it');
  assert.equal(await page.textContent('#sfLive'), 'Showing all colours');
  assert.deepEqual(errors, []);
});

test('with shading on, each row has its highlight › base › shadow line', async () => {
  const { page, errors } = await open();
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => { __mstest.shadeMode = 'full'; __mstest.normalizeTones(); __mstest.renderGuide(); });
  await page.click('#sfColor'); await idle(page);
  const t = await page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => ({ tones: (r.querySelector('.sfatones') || {}).textContent || '', h: r.querySelector('.sfah').getBoundingClientRect().height })));
  assert.ok(t.every((x) => /B .+›/.test(x.tones)), 'every row lists its tones');
  assert.ok(t.every((x) => x.h > 48 && x.h < 72), 'one line more than a closed row');
  assert.deepEqual(errors, []);
});

test('focus mode is still entered from the bar and comes back to the list', async () => {
  const { page, errors } = await open();
  await along(page);
  await clickRow(page, 1);
  const k = await hl(page);
  await page.click('#sfFocus'); await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc')));
  assert.equal(await page.evaluate(() => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey), k, 'starts on the open marker');
  await page.click('#sfFDone'); await idle(page);
  await page.click('#sfExitFoc'); await idle(page);
  assert.ok(!(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc'))));
  assert.ok(await page.isVisible('#sfAlist'), 'the list is back');
  assert.match(await toolStatus(page), /^1 of \d+ coloured$/);
  assert.equal(await page.textContent('#sfDoneBtn'), '← Plan');
  assert.equal(await page.getAttribute('#sfDoneBtn', 'aria-label'), 'Back to the plan');
  assert.deepEqual(errors, []);
});

for (const [w, h] of [[375, 667], [844, 390]]) {
  test(`${w}×${h}: 48px rows, the open row in view, nothing sideways`, async () => {
    const { page, errors } = await open({ width: w, height: h });
    await along(page);
    assert.deepEqual([...new Set((await rows(page)).map((r) => r.h))], [48]);
    const n = (await rows(page)).length;
    await page.evaluate(() => scrollTo(0, 1e6)); await idle(page);
    await clickRow(page, n - 1);
    assertInView(await openBox(page), `${w}×${h} the last row`);
    await scrollTop(page);
    const k = await page.evaluate(() => { const r = document.querySelectorAll('#sfAlist .sfarow'); return r[r.length - 2].dataset.k; });
    await pinPic(page);
    await hold(page, await bigOf(page, k));
    assert.equal(await hl(page), k);
    assertInView(await openBox(page), `${w}×${h} press and hold`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    assert.deepEqual(errors, []);
  });
}

test('long-press a section while colouring along to find its colour in the list', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await scrollTop(page);
  const l = await page.evaluate(() => __mstest.assignData.order[5]);
  const p = await sectionPoint(page, l);
  await longPress(page, p.x, p.y); await idle(page);
  const k = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  assert.equal(await page.evaluate(() => __mstest.hlKey), k, 'its colour is highlighted');
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'a long-press does not tick it');
  assert.ok(await page.locator(`#sfAlist .sfarow[data-k="${k}"].open`).count() === 1, 'its row is open in the list');
  // a normal tap still ticks
  await idle(page);
  const p2 = await sectionPoint(page, l); await page.mouse.click(p2.x, p2.y);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
const doneN = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));

test('Clear ticks can be undone and a double tap on Mark all done does not clear; the open row’s buttons are 44px', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await page.click('#sfColor'); await idle(page); await scrollTop(page);
  await page.locator('#sfAlist .sfarow .sfah').nth(0).click(); await idle(page);
  const k = await page.evaluate(() => __mstest.hlKey), n = await page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k).length, k);
  const h = await page.$$eval('#sfAlist .sfarow.open .sfacts button', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
  assert.ok(h.every((x) => x >= 44), 'buttons at least 44px tall: ' + h);
  await page.dblclick('#sfMarkAll'); await idle(page);
  assert.equal(await doneN(page), n, 'the second tap of a double tap is not Clear ticks');
  await pause(page, 400, 'a tap after the 400 ms double-tap window is a Clear ticks');
  await page.click('#sfMarkAll'); await idle(page);
  assert.equal(await doneN(page), 0);
  await page.click('#toastAct'); await idle(page);
  assert.equal(await doneN(page), n, 'Undo puts the ticks back');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);

test('after a press and hold in Colour along, the click that follows the lift does not open another row', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  const [l] = await bigSections(page, 1), key = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  const p = await sectionPoint(page, l);
  await longPress(page, p.x, p.y);
  assert.equal(await page.evaluate(() => __mstest.hlKey), key, 'the hold opened its marker');
  // a click on another row straight after is ignored...
  const other = await page.evaluate((k) => [...document.querySelectorAll('#sfAlist .sfarow')].find((r) => r.dataset.k !== k).dataset.k, key);
  await page.evaluate((k) => document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`).click(), other);
  assert.equal(await page.evaluate(() => __mstest.hlKey), key, 'still the held marker');
  // ...but not for long
  await pause(page, 450, 'clicks are ignored for 400 ms after the lift');
  await page.evaluate((k) => document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`).click(), other);
  assert.equal(await page.evaluate(() => __mstest.hlKey), other);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const SHOTS = process.env.SHOTS || '';
const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const pinH = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')) || 0);
const toastOn = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return !!(t && t.classList.contains('on')); });

test('finishing the page in Colour along brings "Page complete!" and its Reveal & share into view, with no toast over the open row', async () => {
  for (const [w, h] of [[390, 844], [375, 667]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    await page.click('#sfColor'); await idle(page);
    // every marker but the last done at once; the last from its open row, far down the list
    await page.evaluate(() => { const t = __mstest, ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k), last = ks[ks.length - 1]; t.assignData.order.forEach((l) => { if (t.assignData.assign[l].mkey !== last) t.colored[l] = 1; }); });
    const last = await page.evaluate(() => { const ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k); return ks[ks.length - 1]; });
    await page.click(`#sfAlist .sfarow[data-k="${last}"] .sfah`); await idle(page);
    await page.click('#sfMarkAll'); await idle(page);
    const dn = await rect(page, '#sfDone'), bar = await rect(page, '#sfWork>.sfbar'), top = await pinH(page);
    assert.ok(dn && dn.height > 0, 'the banner shows');
    assert.ok(dn.top >= top - 1 && dn.bottom <= bar.top + 1, `${w}×${h}: the banner is on the screen under the pinned block (${dn.top}–${dn.bottom}, pinned ${top}, bar ${bar.top})`);
    const rv = await rect(page, '#sfAlongRev');
    assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [rv.x + rv.width / 2, rv.y + rv.height / 2]), 'sfAlongRev', 'Reveal & share can be tapped');
    assert.equal(await toastOn(page), false, 'no toast over the list');
    assert.match(await page.textContent('#sfLive'), /Finished/, 'screen readers hear it');
    if (w === 390) await shot(page, 'g1-1-after');
    // in focus mode the toast stays: Reveal & share is in its own bottom bar
    await page.click('#sfAlongRev'); await page.waitForSelector('#sfRoot.sfrev');
    assert.ok(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')), 'Reveal starts');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('coming back to Colour along from another screen keeps the screen awake again', async () => {
  const init = () => { window.__wl = { req: 0, rel: 0 }; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => { window.__wl.req++; return Promise.resolve({ release() { window.__wl.rel++; return Promise.resolve(); }, addEventListener() {} }); } } }); };
  const { page, errors } = await openApp({ init });
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await page.waitForFunction(() => window.__wl.req === 1);
  await page.click('#mHome'); await page.waitForFunction(() => window.__wl.rel === 1);
  await page.click('#mSections'); await page.waitForFunction(() => window.__wl.req === 2); // asked for again on coming back
  // not in Plan
  await page.click('#sfDoneBtn'); await idle(page); await page.click('#mHome'); await idle(page); await page.click('#mSections'); await idle(page);
  assert.equal(await page.evaluate(() => window.__wl.req), 2);
  assert.deepEqual(errors, []);
});

// ---- From v267 ----
// V267_SHOTS=<dir> also saves the screenshots looked at by hand
const SHOTS_V267 = process.env.V267_SHOTS || '';
const snap = async (page, name) => { if (SHOTS_V267) { await mkdir(SHOTS_V267, { recursive: true }); await page.screenshot({ path: SHOTS_V267 + '/' + name + '.png' }); } };
const toastOnText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const ticks = (page) => page.evaluate(() => { const c = __mstest.colored; let n = 0; for (let l = 1; l < c.length; l++) if (c[l]) n++; return n; });

test('Reset progress asks in the guide’s sheet: Cancel keeps the ticks, Clear clears them (with Undo); greyed out with nothing ticked', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfAlist .sfarow .sfah'); await idle(page);
  await page.click('#sfMarkAll'); await idle(page);
  await page.click('#sfAlist .sfarow:not(.full) .sfah'); await idle(page);
  await page.click('#sfMarkAll'); await idle(page);
  const n = await ticks(page);
  assert.ok(n > 2);
  await openMenu(page);
  assert.equal(await page.getAttribute('#sfResetP', 'aria-disabled'), null);
  await page.click('#sfResetP'); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Reset progress?');
  assert.equal((await page.textContent('#sfSheet .sfshbody')).trim(), `This clears what you’ve coloured on ${n} sections.`);
  assert.deepEqual(await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.textContent + (x.classList.contains('sfprimary') ? '*' : ''))), ['Cancel', 'Reset*']);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent), 'Cancel', 'focus in the sheet');
  await snap(page, 'a-reset-sheet');
  await page.click('#sfSheet [data-rp="cancel"]'); await idle(page);
  assert.equal(await page.isVisible('#sfSheet'), false);
  assert.equal(await ticks(page), n, 'Cancel keeps the ticks');
  await openMenu(page); await page.click('#sfResetP'); await idle(page);
  await page.click('#sfResetGo'); await idle(page);
  assert.equal(await page.isVisible('#sfSheet'), false);
  assert.equal(await ticks(page), 0, 'Clear clears them');
  assert.match(await toastOnText(page), /^Progress reset Undo$/);
  await page.click('#toastAct'); await idle(page);
  assert.equal(await ticks(page), n, 'Undo puts them back');
  await openMenu(page); await page.click('#sfResetP'); await page.click('#sfResetGo'); await idle(page);
  assert.equal(await ticks(page), 0);
  // nothing ticked: the item is there, greyed, and does nothing
  await openMenu(page);
  assert.equal(await page.getAttribute('#sfResetP', 'aria-disabled'), 'true');
  assert.ok(+(await page.$eval('#sfResetP', (b) => getComputedStyle(b).opacity)) < 1, 'greyed');
  await page.click('#sfResetP', { force: true }); await idle(page);
  assert.equal(await page.locator('#sfResetGo').count(), 0, 'no question');
  assert.ok(await page.isVisible('#sfSheet .sfmenu'), 'the menu stays open');
  assert.deepEqual(errors, []);
});

test('Colour along, the first time: two lines and More; opening a marker folds them into the ⓘ line, as later visits show', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  const h = '#sfAlHint';
  assert.ok(await page.isVisible(h));
  assert.equal((await page.textContent(h + ' .sfit')).trim(), 'Tap a marker to see its sections, then tap each section on the picture as you colour it.More');
  assert.equal(await page.textContent('#sfAlMore'), 'More');
  const seen = () => page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints') || '[]').includes('along'));
  assert.equal(await seen(), false, 'not seen yet');
  await snap(page, 'a-along-first');
  await page.click('#sfAlMore'); await idle(page);
  assert.equal((await page.textContent(h + ' .sfit')).trim(), 'Tap a marker to see its sections, then tap each section on the picture as you colour it. Use ✓ Mark all done for a whole marker. Press and hold a section to find its marker here.');
  assert.equal(await page.locator('#sfAlMore').count(), 0);
  // the first row opened: the ⓘ line, closed, and seen
  await page.click('#sfAlist .sfarow .sfah'); await idle(page);
  assert.equal(await page.locator(h).count(), 0);
  const i = page.locator('#sfCtl button.sfinfo[data-info="along"]');
  assert.equal((await i.textContent()).trim(), 'iHow colour along works');
  assert.equal(await i.getAttribute('aria-expanded'), 'false');
  assert.equal(await seen(), true);
  // it opens in place with all of it
  await i.click();
  assert.match(await i.textContent(), /Tap a marker to see its sections, then tap each section on the picture as you colour it\. Use ✓ Mark all done for a whole marker\./);
  await i.click();
  // later visits: the ⓘ line
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.locator(h).count(), 0);
  assert.equal((await page.locator('#sfCtl button.sfinfo[data-info="along"]').textContent()).trim(), 'iHow colour along works');
  assert.deepEqual(errors, []);
});
