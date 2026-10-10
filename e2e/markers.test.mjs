// The Markers screen: ticking markers in place, details on press and hold and by keyboard, the marker sheet, the tick
// wording, and the ⓘ hint above the grid.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, welcome, idle, longPress } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From UX release 1 (v260) ----
test('Markers: unticking keeps the marker in place until the list is redrawn; press and hold shows its details', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection'); await idle(page);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#results .cell')].slice(0, 6).map((c) => +c.dataset.i));
  const before = await order();
  await page.click(`#results .cell[data-i="${before[1]}"]`); await idle(page);
  assert.deepEqual(await order(), before, 'nothing moved');
  // (the idle() after the tap has already let any long-press timer run out, so the details would be open by now)
  assert.ok(!(await page.isVisible('#mkOverlay')), 'a quick tap does not open the details');
  assert.ok(await page.evaluate((i) => document.querySelector(`#results .cell[data-i="${i}"]`).classList.contains('notown'), before[1]), 'shown as unticked');
  assert.equal(await page.evaluate((i) => isOwned(i), before[1]), false);
  // tapping it again ticks it back, still in place
  await page.click(`#results .cell[data-i="${before[1]}"]`); await idle(page);
  assert.equal(await page.evaluate((i) => isOwned(i), before[1]), true);
  // untick, then a search redraws the list without it
  await page.click(`#results .cell[data-i="${before[2]}"]`); await idle(page);
  await page.fill('#q', 'r'); await page.fill('#q', ''); await idle(page);
  assert.ok(!(await order()).includes(before[2]), 'gone after the list is redrawn');
  // press and hold opens the details sheet
  const box = await page.locator(`#results .cell[data-i="${before[0]}"]`).boundingBox();
  await longPress(page, box.x + box.width / 2, box.y + box.height / 2); await idle(page);
  assert.ok(await page.isVisible('#mkOverlay'), 'details open');
  assert.equal(await page.evaluate((i) => isOwned(i), before[0]), true, 'holding did not untick it');
  const code = await page.textContent('#mkCode');
  assert.match(code, /Ohuhu /);
  await page.click('#mkOwn'); await idle(page);
  assert.equal(await page.evaluate((i) => isOwned(i), before[0]), false, 'the switch unticks it');
  await page.click('#mkSimilar'); await idle(page);
  assert.ok(await page.isVisible('#matchOverlay'), 'Find similar opens Match a colour');
  assert.ok(await page.evaluate(() => document.getElementById('matchResult').textContent.length > 20), 'with results for that colour');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('marker sheet: after ticking "In my collection", closing it returns focus to the marker', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
  await page.focus(`#results .cell[data-i="${i}"]`);
  await page.evaluate((i) => openMarkerSheet(i), i); await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkOwn'); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.i), String(i));
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });

test('Markers: tick wording, "Showing" or "Matches", and the keyboard way to details', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }) });
  await page.click('#mCollection'); await page.waitForSelector('#ownAll', { state: 'visible' });
  assert.equal(await page.textContent('#ownAll'), 'Tick all shown');
  await page.click('#mkMore');
  assert.equal(await page.textContent('#ownNone'), 'Untick all shown');
  await page.click('#ownNone');
  assert.equal(await page.isVisible('#mkMenu'), true, 'the first tap asks in the menu, which stays open');
  assert.match(await page.textContent('#ownNone'), /^Untick \d+ markers?\? Tap again$/);
  // (the heading's words: without Copy codes and the ⋯ menu beside it, v289)
  const head = async () => page.$eval('#findResults .pile-head', (h) => { const c = h.cloneNode(true); c.querySelectorAll('.copybtn, .mkmore').forEach((e) => e.remove()); return c.textContent.trim(); });
  assert.match(await head(), /^Showing \d+ markers$/);
  await page.fill('#q', 'blue'); await idle(page);
  assert.match(await head(), /^Matches\s*\(\d+ markers\)$/);
  await page.fill('#q', ''); await page.evaluate(() => { fgTap('brand', 'Copic'); filterChanged(); });
  assert.match(await head(), /^Matches/);
  assert.equal(await page.getAttribute('#results .cell', 'aria-description'), 'Shift+F10 for details');
  assert.doesNotMatch(await page.textContent('#mkHint'), /Shift\+F10/);
  await page.keyboard.press('Tab'); await idle(page);
  assert.match(await page.textContent('#mkHint'), /Shift\+F10/);
  // and Shift+F10 on a cell opens its details
  await page.focus('#results .cell'); await page.keyboard.press('Shift+F10');
  await page.waitForSelector('#mkOverlay.on');
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState3 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved: [], ...extra });
const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });

test('Markers: the ⓘ hint above the grid, in full the first time, then one line that opens; mouse and touch wording', async () => {
  const { page, errors } = await openApp({ storage: onboardedNoVer({ [KEY]: appState3(), 'ms-seen-hints': '["along"]' }) });
  await page.click('#mCollection'); await page.waitForSelector('#mkHint .sfinfo');
  const hint = '#mkHint .sfinfo';
  assert.equal((await page.textContent(hint)).trim(), 'iTap a marker to tick or untick it. Right-click for details.', 'a mouse: right-click');
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  const r = await page.evaluate(() => [document.getElementById('mkHint').getBoundingClientRect().bottom, document.querySelector('#results .cell').getBoundingClientRect().top]);
  assert.ok(r[0] <= r[1], 'above the grid');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints'))), ['along', 'mk-tick'], 'one list with the guide’s');
  // still in full for the rest of this visit
  await page.click('#mHome'); await page.click('#mCollection');
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  // the next visit: one line, which opens and closes
  await page.reload(); await page.click('#mCollection'); await page.waitForSelector(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
  assert.equal((await page.textContent(hint)).trim(), 'iTap to tick · right-click for details');
  await page.click(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
  assert.match(await page.textContent(hint), /Tap a marker to tick or untick it\. Right-click for details\./);
  await page.click(hint);
  assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
  // a tap on the hint doesn't tick anything
  assert.equal(await page.evaluate(() => state.owned.size), OWN3.length);
  // not on other screens
  await page.click('#mPalette');
  assert.equal(await page.isVisible('#mkHint'), false);
  assert.deepEqual(errors, []);

  // a touch screen: press and hold
  const touch = () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/pointer:\s*fine/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : /pointer:\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); };
  const b = await openApp({ init: touch, storage: onboardedNoVer({ [KEY]: appState3() }) });
  await b.page.click('#mCollection'); await b.page.waitForSelector(hint);
  assert.equal((await b.page.textContent(hint)).trim(), 'iTap a marker to tick or untick it. Press and hold (or right-click) for details.');
  await b.page.reload(); await b.page.click('#mCollection'); await b.page.waitForSelector(hint);
  assert.equal((await b.page.textContent(hint)).trim(), 'iTap to tick · press and hold for details');
  assert.deepEqual(b.errors, []);
});

// ---- v284: search beyond the view, true colours in All, and the way down to the tools ----
const inkOf = (page) => page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--ink)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
// a code that finds exactly one marker, which you don't own (for "isn’t in your collection")
const loneUnowned = (page) => page.evaluate(() => COLORS.map((c, i) => [c.code, i]).find(([code, i]) => !isOwned(i) && COLORS.filter((m) => (m.code + ' ' + m.name + ' ' + (m.old || '')).toLowerCase().includes(code.toLowerCase())).length === 1)[0]);

test('Markers: a search in Owned says how many more are in All, with Show; one that only All has says so', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'owned' }) }) });
  await page.click('#mCollection'); await idle(page);
  await page.fill('#q', 'r0'); await idle(page);
  const outside = await page.evaluate(() => COLORS.filter((c, i) => avail(i) && !isOwned(i)).length);
  assert.ok(outside > 1 && (await page.locator('#results .cell').count()) > 0, 'some owned, more not');
  assert.equal((await page.textContent('#results .moreall')).replace(/\s+/g, ' ').trim(), outside + ' more in All · Show');
  const box = await page.locator('#results .moreall').boundingBox(), last = await page.locator('#results .cell').last().boundingBox();
  assert.ok(box.y >= last.y + last.height, 'under the results');
  // Show: All, with the same search
  await page.click('#results .moreshow'); await idle(page);
  assert.equal(await page.evaluate(() => state.collView), 'all');
  assert.equal(await page.inputValue('#q'), 'r0', 'the search stays');
  assert.equal(await page.locator('#results .moreall').count(), 0, 'nothing more to show in All');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.v), 'all', 'focus on All, which says it is chosen');
  // a code only All has: said plainly, with the same Show
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  const code = await loneUnowned(page);
  await page.fill('#q', code); await idle(page);
  assert.equal(await page.locator('#results .cell').count(), 0);
  assert.equal(await page.textContent('#results .empty'), code + ' isn’t in your collection.');
  assert.equal((await page.textContent('#results .moreall')).replace(/\s+/g, ' ').trim(), '1 in All · Show');
  assert.equal(await page.getAttribute('#results .moreshow', 'aria-label'), 'Show it in All');
  await page.click('#results .moreshow'); await idle(page);
  assert.equal(await page.locator('#results .cell').count(), 1, 'there it is');
  // Unowned: a marker you have says so
  await page.click('#ownView [data-v="unowned"]'); await page.fill('#q', 'Y111'); await idle(page);
  assert.equal(await page.textContent('#results .empty'), 'Y111 is already in your collection.');
  // nothing anywhere: as before, no Show
  await page.fill('#q', 'zzzz'); await idle(page);
  assert.match(await page.textContent('#results .empty'), /^No markers match “zzzz”/);
  assert.equal(await page.locator('#results .moreall').count(), 0);
  assert.deepEqual(errors, []);
});

test('Markers: the search’s ✕ shows only with text, clears it and keeps the keyboard in the field', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }) });
  await page.click('#mCollection'); await idle(page);
  assert.equal(await page.isVisible('#qClear'), false, 'nothing to clear');
  const all = await page.locator('#results .cell').count();
  await page.fill('#q', 'blue'); await idle(page);
  assert.ok(await page.isVisible('#qClear'));
  assert.equal(await page.getAttribute('#qClear', 'aria-label'), 'Clear search');
  const b = await page.locator('#qClear').boundingBox(), q = await page.locator('#q').boundingBox();
  assert.ok(b.width >= 44 && b.height >= 44, 'a 44px tap area');
  assert.ok(b.x >= q.x && b.x + b.width <= q.x + q.width && b.y >= q.y && b.y + b.height <= q.y + q.height, 'inside the field');
  assert.ok((await page.locator('#results .cell').count()) < all);
  await page.click('#qClear'); await idle(page);
  assert.equal(await page.inputValue('#q'), '');
  assert.equal(await page.locator('#results .cell').count(), all, 'every marker again');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
  assert.equal(await page.isVisible('#qClear'), false);
  assert.deepEqual(errors, []);
});

test('Markers › All: markers you don’t own keep their true colour, with a dashed edge and a quieter code; owned keep the tick', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }) });
  await page.click('#mCollection'); await idle(page);
  const look = (sel) => page.$eval(sel, (c) => { const cs = getComputedStyle(c), sq = c.querySelector('.sq'), cc = getComputedStyle(c.querySelector('.cc')); return { op: +cs.opacity, edge: cs.borderTopStyle, sq: getComputedStyle(sq).backgroundColor, hex: COLORS[+c.dataset.i].hex, code: cc.color, tick: !!c.querySelector('.owncheck') }; });
  const rgb = (h) => 'rgb(' + [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).join(', ') + ')';
  const un = await look('#results .cell.notown'), own = await look('#results .cell.own');
  assert.equal(un.op, 1, 'not faded');
  assert.equal(un.sq, rgb(un.hex), 'its true colour');
  assert.equal(un.edge, 'dashed');
  assert.equal(un.tick, false);
  assert.equal(own.edge, 'solid');
  assert.equal(own.tick, true, 'the tick as before');
  assert.equal(own.code, await inkOf(page), 'an owned code at full contrast');
  assert.notEqual(un.code, own.code, 'an unowned code quieter');
  // the quieter code still reads: over 4.5:1 on the cell's background
  const ratio = await page.$eval('#results .cell.notown', (c) => {
    const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, k) => a + v * [0.2126, 0.7152, 0.0722][k], 0);
    const m = getComputedStyle(c.querySelector('.cc')).color.match(/[\d.]+/g).map(Number), bg = getComputedStyle(c).backgroundColor.match(/[\d.]+/g).map(Number), a = m[3] ?? 1;
    const L1 = lum([0, 1, 2].map((k) => m[k] * a + bg[k] * (1 - a))), L2 = lum(bg.slice(0, 3));
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  });
  assert.ok(ratio >= 4.5, 'contrast ' + ratio.toFixed(2));
  assert.deepEqual(errors, []);
});

// (v311: Add markers at the top; the link goes down to Brands I'd buy and Print a swatch chart)
test('Markers: Add markers and a link to the swatch chart near the top; the bulk buttons stand clear, Untick in ⋯ at full contrast', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }) });
  await page.click('#mCollection'); await idle(page);
  assert.ok((await page.locator('#mkAddBtn').boundingBox()).y < 844, 'Add markers on the first screen');
  assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart↓');
  assert.ok((await page.locator('#mkJump').boundingBox()).y < 844, 'on the first screen');
  assert.ok(await page.evaluate(() => document.getElementById('presetWrap').getBoundingClientRect().top > 3000), 'the tools are far down');
  await page.click('#mkJump'); await idle(page);
  const inView = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  // (the scroll is smooth: Safari's engine can still be on its way when the page is otherwise idle)
  await page.waitForFunction(() => { const r = document.getElementById('swatchBtn').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 5000 }).catch(() => {});
  for (const sel of ['#buyOpen', '#swatchBtn']) assert.ok(await inView(sel), sel + ' in view');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'swatchBtn', 'focus on Print a swatch chart');
  // Tick / Untick all shown: clear of the last swatch, and Untick not faint
  const gap = await page.evaluate(() => { const c = [...document.querySelectorAll('#results .cell')].pop().getBoundingClientRect(); return document.getElementById('ownStateWrap').getBoundingClientRect().top - c.bottom; });
  assert.ok(gap >= 20, 'space above the bulk buttons: ' + gap);
  await page.click('#mkMore');
  const un = await page.$eval('#ownNone', (b) => ({ op: +getComputedStyle(b).opacity, c: getComputedStyle(b).color }));
  assert.deepEqual(un, { op: 1, c: await inkOf(page) });
  // not on other screens; with no markers yet, the ways to add are in a card at the top, and no Add markers
  await page.click('#mPalette');
  assert.equal(await page.isVisible('#mkJump'), false);
  await page.evaluate(() => { state.owned.clear(); save(); }); await page.click('#mCollection'); await idle(page);
  assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart↓');
  assert.equal(await page.isVisible('#mkAddBtn'), false);
  assert.ok(await page.isVisible('#mkAddCard'));
  await page.click('#mkJump'); await idle(page);
  await page.waitForFunction(() => { const r = document.getElementById('swatchBtn').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 5000 }).catch(() => {});
  assert.ok(await inView('#swatchBtn'));
  assert.deepEqual(errors, []);
});

test('Markers at 320 wide and 1.6x text: the search’s ✕, "more in All" and the link fit without sideways scroll', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 700, storage: onboardedV265({ [KEY]: appState({ collView: 'owned' }) }) });
  await page.click('#mCollection'); await page.fill('#q', 'r0'); await idle(page);
  const m = await page.evaluate(() => {
    const q = document.getElementById('q'), x = document.getElementById('qClear').getBoundingClientRect(), more = document.querySelector('#results .moreall').getBoundingClientRect(), j = document.getElementById('mkJump');
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, clear: x.right <= q.getBoundingClientRect().right + 0.5, more: more.right <= innerWidth, jump: j.scrollWidth <= j.clientWidth + 1 && j.getBoundingClientRect().right <= innerWidth };
  });
  assert.deepEqual(m, { sw: m.iw, iw: m.iw, clear: true, more: true, jump: true });
  assert.deepEqual(errors, []);
});
