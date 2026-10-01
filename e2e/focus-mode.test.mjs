// Focus mode: one section at a time, light -> dark, tick off and move on; its zoom chips and keyboard focus, and
// leaving it back to Colour along.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, shot } from './helpers.mjs';

before(setup);
after(teardown);

const state = (page) => page.evaluate(() => {
  const t = __mstest, l = t.focusOrd[t.focusPos];
  return { pos: t.focusPos, l, mk: t.hlKey, zoom: t.zoom, fin: t.focusFin, done: [...t.colored].reduce((a, b) => a + b, 0) };
});
// is the current section centred in the space between the two bars (on a phone, above the tool strip, v289)? (v284: or as near as the picture allows: off
// centre only where the picture's edge is at the edge of that space, so there's no blank beside it)
async function centred(page) {
  const s = await state(page), p = await sectionPoint(page, s.l);
  const g = await page.evaluate(() => { const c = document.getElementById('sfCanvas').getBoundingClientRect(); return { w: innerWidth, top: document.querySelector('.sffocbar').offsetHeight, bot: innerHeight - document.querySelector('.sffocbot').offsetHeight - (innerWidth < 700 ? document.getElementById('sfZoomCtl').offsetHeight : 0), c: { l: c.left, r: c.right, t: c.top, b: c.bottom } }; });
  // (or all the picture fits that way, and it's in the middle)
  const fitX = g.c.r - g.c.l <= g.w + 1 && Math.abs((g.c.l + g.c.r) / 2 - g.w / 2) < 2, fitY = g.c.b - g.c.t <= g.bot - g.top + 1 && Math.abs((g.c.t + g.c.b) / 2 - (g.top + g.bot) / 2) < 2;
  const inX = fitX || Math.abs(p.x - g.w / 2) < 40 || (g.c.l <= 1 && p.x < g.w / 2) || (g.c.r >= g.w - 1 && p.x > g.w / 2);
  const inY = fitY || Math.abs(p.y - (g.top + g.bot) / 2) < 40 || (g.c.t <= g.top + 1 && p.y < (g.top + g.bot) / 2) || (g.c.b >= g.bot - 1 && p.y > (g.top + g.bot) / 2);
  return inX && inY && p.x > 0 && p.x < g.w && p.y > g.top && p.y < g.bot;
}
async function enterFocus(page) {
  await page.click('#sfColor');
  await page.click('#sfFocus');
  await idle(page);
}

test('walks every section once, one marker at a time, light to dark', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await enterFocus(page);
  const o = await page.evaluate(() => {
    const t = __mstest, keys = t.focusOrd.map((l) => t.assignData.assign[l].mkey), runs = [];
    keys.forEach((k) => { if (runs[runs.length - 1] !== k) runs.push(k); });
    const hex = (k) => t.assignData.assign[t.focusOrd[keys.indexOf(k)]].hex;
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
    return { n: t.focusOrd.length, uniq: new Set(t.focusOrd).size, N: t.assignData.N, runs: runs.length, markers: new Set(keys).size, lums: runs.map((k) => lum(hex(k))) };
  });
  assert.equal(o.n, o.N); assert.equal(o.uniq, o.N);
  assert.equal(o.runs, o.markers, 'each marker is one run');
  for (let i = 1; i < o.lums.length; i++) assert.ok(o.lums[i] <= o.lums[i - 1] + 1e-9, 'lighter markers first');
  assert.ok(await centred(page), 'first section is centred');
  await shot(page, 'focus-start');
  assert.deepEqual(errors, []);
});

test('Done ticks one section and moves on; tapping another section only selects it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await enterFocus(page);
  const s0 = await state(page);
  await page.click('#sfFDone'); await idle(page);
  const s1 = await state(page);
  assert.equal(s1.done, 1); assert.equal(s1.pos, 1);
  // the same marker next while it has sections left (the gradient shares markers out by area, so a big section can
  // have a marker to itself: then it's the next marker's lightest)
  const n0 = await page.evaluate((k) => __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k).length, s0.mk);
  if (n0 > 1) assert.equal(s1.mk, s0.mk, 'same marker next');
  else assert.notEqual(s1.mk, s0.mk, 'the next marker');
  assert.ok(await centred(page), 'next section is centred');
  // tap the outlined section itself -> ticks it
  const p = await sectionPoint(page, s1.l); await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal((await state(page)).done, 2);
  // tap a section of another colour -> selected, not ticked
  const other = await page.evaluate(() => {
    const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), top = document.querySelector('.sffocbar').offsetHeight + 20, bot = innerHeight - document.querySelector('.sffocbot').offsetHeight - 70;
    for (const l of t.focusOrd) {
      if (t.assignData.assign[l].mkey === t.hlKey || t.colored[l]) continue;
      const q = t.labelPos(l), x = r.left + (q.x / c.width) * r.width, y = r.top + (q.y / c.height) * r.height;
      if (x > 20 && x < innerWidth - 80 && y > top && y < bot) return l;
    }
    return null;
  });
  assert.ok(other, 'found a visible section of another colour');
  const before = await state(page), op = await sectionPoint(page, other);
  await page.mouse.click(op.x, op.y); await idle(page);
  const after = await state(page);
  assert.equal(after.done, before.done, 'nothing ticked');
  assert.equal(after.l, other, 'it became the current section');
  // Back returns to where we were
  await page.click('#sfFBack'); await idle(page);
  assert.equal((await state(page)).pos, before.pos);
  assert.deepEqual(errors, []);
});

test('panning is free and the re-centre button brings the section back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await enterFocus(page);
  // (v284: a picture that fits in view stays in the middle: zoomed in, there's somewhere to pan to)
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  const p0 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
  await page.mouse.move(200, 430); await page.mouse.down(); await page.mouse.move(210, 438, { steps: 3 }); await page.mouse.up();
  const p1 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
  assert.equal(Math.round(p1[0] - p0[0]), 10); assert.equal(Math.round(p1[1] - p0[1]), 8);
  await page.click('#sfZrst'); await idle(page);
  assert.ok(await centred(page));
  assert.deepEqual(errors, []);
});

test('colour list jumps and marks a whole marker; finishing shows the whole picture', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await enterFocus(page);
  await page.click('#sfFocCols');
  assert.ok(await page.isVisible('#sfFocSheet'));
  const lastK = await page.evaluate(() => { const t = __mstest; return t.assignData.assign[t.focusOrd[t.focusOrd.length - 1]].mkey; });
  await page.click(`.focmk[data-k="${lastK}"]`); await idle(page);
  assert.equal((await state(page)).mk, lastK);
  await page.click('#sfFocCols'); await page.click('#sfFocAll'); await idle(page);
  const n = await page.evaluate((k) => __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k && __mstest.colored[l]).length, lastK);
  const tot = await page.evaluate((k) => __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k).length, lastK);
  assert.equal(n, tot, 'whole marker marked');
  for (let i = 0; i < 400 && !(await state(page)).fin; i++) await page.evaluate(() => document.getElementById('sfFDone').click());
  await idle(page);
  const s = await state(page);
  assert.ok(s.fin); assert.equal(s.zoom, 1);
  assert.match(await page.textContent('#sfFocName'), /Page finished/);
  await shot(page, 'focus-finished');
  const last = s.pos;
  await page.click('#sfFBack'); await idle(page);
  assert.equal((await state(page)).pos, last, 'Back goes to the last section');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => __mstest.focus), false);
  assert.deepEqual(errors, []);
});

test('landscape keeps the section centred; leaving the screen mid-focus resets cleanly', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await enterFocus(page);
  await page.setViewportSize({ width: 844, height: 390 }); await idle(page);
  assert.ok(await centred(page), 'centred after rotating');
  const bars = await page.evaluate(() => document.querySelector('.sffocbar').offsetHeight + document.querySelector('.sffocbot').offsetHeight);
  assert.ok(bars < 390 * 0.45, `bars use ${bars}px of 390`);
  await page.setViewportSize({ width: 390, height: 844 }); await idle(page);
  await page.evaluate(() => document.getElementById('mHome').click());
  await page.click('#mSections'); await idle(page);
  const s = await page.evaluate(() => ({ focus: __mstest.focus, zoom: __mstest.zoom, cls: document.getElementById('sfRoot').className }));
  assert.deepEqual(s, { focus: false, zoom: 1, cls: '' });
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : null; });

test('focus mode: solid zoom chips; focus moves in, Tab stays in, the page behind is inert, and focus returns to ⛶ Focus mode', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  await page.focus('#sfFocus'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await active(page), 'sfFDone', 'focus on ✓ Done');
  const bg = await page.evaluate(() => getComputedStyle(document.getElementById('sfZin')).backgroundColor);
  const alpha = +(bg.match(/rgba?\(([^)]+)\)/)[1].split(',')[3] ?? 1);
  assert.ok(alpha >= 0.9, 'a solid chip: ' + bg);
  assert.equal(await page.evaluate(() => document.getElementById('sfHead').inert && document.querySelector('.modes').inert), true, 'the page behind is inert');
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('.sffocbar,#sfFocSheet,#sfZoomCtl,#sfFocBot')), 'Tab stays in focus mode: ' + await active(page));
  }
  // Done keeps focus on the bottom buttons as they are redrawn
  await page.focus('#sfFDone'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await active(page), 'sfFDone');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await active(page), 'sfFocus', 'back on ⛶ Focus mode');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[inert]').length), 0, 'nothing left inert');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
test('leaving focus mode keeps the marker row that was open', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  const k = await page.$eval('#sfAlist .sfarow:nth-child(2)', (r) => r.dataset.k);
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFSkip'); await idle(page); await page.click('#sfFSkip'); await idle(page);
  await page.click('#sfExitFoc'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlKey), k);
  assert.equal(await page.$eval('#sfAlist .sfarow.open', (r) => r.dataset.k), k, 'the row is still open');
  // with no row open, none opens
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`); await idle(page);
  await page.click('#sfFocus'); await idle(page); await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 0);
  assert.deepEqual(errors, []);
});
