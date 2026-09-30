// The Library (from UX release 2, part A). A whole row opens its item, the pencil renames in place, names show on two
// lines, the line under a name says what it is (and how much of a guide is coloured), new palettes get names from
// their colours, the list uses the dialog's full height, delete by keyboard, and the Library picture.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, idle, guideName, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

const libOpen = (page) => page.evaluate(() => savedOverlay.classList.contains('on'));
async function openLibrary(page) {
  await page.click('#mHome'); await page.click('#homeLibCard'); await idle(page);
  assert.ok(await libOpen(page), 'the Library is open');
}
// a palette straight into the Library (no generated name), for tests about rows rather than names
function addPalette(page, name, idxs = [11, 120, 280], ts = Date.now()) {
  return page.evaluate(({ name, idxs, ts }) => { const id = Date.now() + Math.floor(Math.random() * 1e6); state.saved.unshift({ id, type: 'palette', name, keys: idxs.map(mkey), ts }); save(); return id; }, { name, idxs, ts });
}
async function savedGuide(page) {
  await sampleGuide(page); await page.click('#sfSave'); await idle(page);
  return page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
}
const row = (page, id) => `#savedList .srow[data-id="${id}"]`;
const nameOf = (page, id) => page.evaluate((id) => state.saved.find((s) => s.id === id).name, id);

test('tapping a palette row’s name opens the palette and closes the Library', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const id = await addPalette(page, 'Row test');
  await openLibrary(page);
  await page.click(row(page, id) + ' .sname');
  await idle(page);
  assert.equal(await libOpen(page), false, 'the Library closed');
  assert.equal(await page.evaluate(() => state.mode), 'palette');
  assert.deepEqual(await page.evaluate(() => state.customPal.slice(0, 3)), [11, 120, 280]);
  assert.equal(await page.locator('#savedList .savename').count(), 0, 'no name input in the rows');
  assert.deepEqual(errors, []);
});

test('tapping a guide row opens the guide', async () => {
  const { page, errors } = await openApp();
  const id = await savedGuide(page);
  await page.evaluate(() => SF.loadSample()); await idle(page, 1500);
  await openLibrary(page);
  await page.click(row(page, id) + ' .smeta');
  await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, id, { timeout: 10000 });
  assert.equal(await libOpen(page), false);
  assert.equal(await page.evaluate(() => state.mode), 'sections');
  assert.deepEqual(errors, []);
});

test('the pencil renames in place: Enter keeps, Escape cancels, leaving the field keeps, an empty name keeps the old one', async () => {
  const { page, errors } = await openApp();
  const id = await savedGuide(page);
  const first = await nameOf(page, id);
  await openLibrary(page);
  assert.equal(await page.getAttribute(row(page, id) + ' .sren', 'aria-label'), 'Rename ' + first);

  // pencil -> a focused input holding the name
  await page.click(row(page, id) + ' .sren');
  const inp = row(page, id) + ' .sname-in';
  assert.ok(await page.evaluate((s) => document.activeElement === document.querySelector(s), inp), 'the input is focused');
  assert.equal(await page.inputValue(inp), first);
  assert.equal(await page.locator(row(page, id) + ' button.sopen').count(), 0, 'no button around the input');

  // Enter saves; nothing opens, the Library stays, Home shows the new name
  await page.fill(inp, 'Harbour Lights');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await nameOf(page, id), 'Harbour Lights');
  assert.ok(await libOpen(page), 'Enter keeps the Library open');
  assert.equal(await page.evaluate(() => state.mode), 'home', 'nothing was loaded');
  assert.equal(await page.textContent(row(page, id) + ' .sname'), 'Harbour Lights');
  assert.match(await page.textContent('#sfRecent'), /Harbour Lights/);
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('sren')), 'focus goes back to the pencil');

  // Escape cancels and leaves the Library open
  await page.click(row(page, id) + ' .sren'); await page.fill(inp, 'Not this');
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(await libOpen(page), 'Escape only cancels the rename');
  assert.equal(await nameOf(page, id), 'Harbour Lights');
  assert.equal(await page.textContent(row(page, id) + ' .sname'), 'Harbour Lights');

  // leaving the field saves
  await page.click(row(page, id) + ' .sren'); await page.fill(inp, 'Tidal Glow');
  await page.click('#libTitle'); await idle(page);
  assert.equal(await nameOf(page, id), 'Tidal Glow');
  assert.equal(await page.locator('#savedList .sname-in').count(), 0);
  assert.equal(await page.locator('#savedList .srow').count(), 1, 'the blur and the redraw save once, no duplicate row');

  // an empty name keeps the old one
  await page.click(row(page, id) + ' .sren'); await page.fill(inp, '   ');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await nameOf(page, id), 'Tidal Glow');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved[0].name), 'Tidal Glow', 'the rename is stored');
  assert.deepEqual(errors, []);
});

test('a long name shows in full on at most two lines at 390 px', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look');
  const long = 'Smoldering Garnet and Midnight Velvet Tryst!';
  assert.equal(long.length, 44);
  const id = await addPalette(page, long);
  await openLibrary(page);
  const m = await page.evaluate((s) => { const n = document.querySelector(s); const r = n.getBoundingClientRect(), lh = parseFloat(getComputedStyle(n).lineHeight); return { w: r.width, lines: Math.round(n.scrollHeight / lh), clipped: n.scrollHeight > n.clientHeight + 1, text: n.textContent }; }, row(page, id) + ' .sname');
  assert.equal(m.text, long);
  assert.ok(m.w >= 150, 'the name box is at least 150 px wide: ' + m.w);
  assert.ok(m.lines <= 2, 'two lines at most: ' + m.lines);
  assert.ok(!m.clipped, 'nothing is cut off');
  assert.deepEqual(errors, []);
});

test('the line under a name: type, markers, date; no type badge', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const ts = new Date(new Date().getFullYear(), 8, 27, 12).getTime();
  const pid = await addPalette(page, 'Meta palette', [11, 120, 280, 300, 12], ts);
  const did = await page.evaluate((ts) => { const id = 777001; state.saved.unshift({ id, type: 'draw', name: 'Draw · Sep 27', keys: [mkey(11)], ts, st: {} }); save(); return id; }, ts);
  await openLibrary(page);
  const when = await page.evaluate((ts) => evoWhen(ts), ts);
  assert.equal(await page.textContent(row(page, pid) + ' .smeta'), 'Palette · 5 markers · ' + when);
  assert.equal(await page.textContent(row(page, did) + ' .smeta'), 'Draw · 1 marker · ' + when);
  assert.equal(await page.locator('#savedList .sbadge').count(), 0);
  assert.deepEqual(errors, []);
});

test('a guide with about 40% of its sections ticked shows how much is coloured', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const { N, d } = await page.evaluate(() => { const t = __mstest, N = t.assignData.N; let d = 1; while (Math.floor((d * 100) / N) < 40) d++; t.assignData.order.slice(0, d).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; return { N, d }; });
  await page.click('#sfSave'); await idle(page);
  const g = await page.evaluate(() => state.saved.find((s) => s.type === 'guide'));
  assert.equal(g.done, d); assert.equal(g.n, N);
  await openLibrary(page);
  const meta = await page.textContent(`#savedList .srow[data-id="${g.id}"] .smeta`);
  const pct = Math.floor((d * 100) / N);
  assert.match(meta, new RegExp(`^Guide · ${g.keys.length} markers? · ${pct}% coloured · `));
  if (N >= 20) assert.equal(pct, 40);
  // untouched guide: no percentage
  await page.evaluate((id) => { state.saved.find((s) => s.id === id).done = 0; renderSaved(); }, g.id);
  assert.doesNotMatch(await page.textContent(`#savedList .srow[data-id="${g.id}"] .smeta`), /coloured/);
  assert.deepEqual(errors, []);
});

test('a guide saved without a coloured count gets one when the Library opens', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.slice(0, 3).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; });
  await page.click('#sfSave'); await idle(page);
  const id = await page.evaluate(() => { const g = state.saved.find((s) => s.type === 'guide'); delete g.done; save(); return g.id; });
  await page.reload(); await idle(page);
  assert.equal(await page.evaluate((id) => 'done' in state.saved.find((s) => s.id === id), id), false);
  await openLibrary(page);
  await page.waitForFunction((id) => /% coloured/.test(document.querySelector(`#savedList .srow[data-id="${id}"] .smeta`).textContent), id, { timeout: 5000 });
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id), 3);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved.find((s) => s.id === id).done, id), 3, 'and it is stored');
  assert.deepEqual(errors, []);
});

test('new palettes are named from their colours, never twice the same; old names stay', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.evaluate(() => { state.saved.push({ id: 5, type: 'palette', name: 'Complementary · Sep 3', keys: [mkey(11), mkey(120)], ts: 5 }); save(); });
  await page.click('#mPalette'); await idle(page);
  await page.click('#draw'); await idle(page, 1300);
  const expected = await page.evaluate(() => paletteName(currentPaletteIdxs()));
  await page.click('#saveBtn'); await idle(page, 1300);
  const n1 = await page.evaluate(() => state.saved[0].name);
  assert.equal(n1, expected);
  assert.doesNotMatch(n1, /·|\d/, 'no date in the name: ' + n1);
  assert.notEqual(n1, 'Palette');
  await page.click('#saveBtn'); await idle(page);
  const n2 = await page.evaluate(() => state.saved[0].name);
  assert.notEqual(n2.toLowerCase(), n1.toLowerCase(), 'the second save of the same palette gets another name');
  await page.reload(); await idle(page);
  assert.equal(await page.evaluate(() => state.saved.find((s) => s.id === 5).name), 'Complementary · Sep 3', 'an existing name is never changed');
  assert.deepEqual(errors, []);
});

test('with 20 items the list fills the dialog and the last row clears its bottom edge', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) state.saved.push({ id: 1000 + i, type: 'palette', name: 'Palette number ' + i, keys: [mkey(i), mkey(i + 40), mkey(i + 90)], ts: Date.now() - i * 1000 }); save(); });
  await openLibrary(page);
  const m = await page.evaluate(() => { const l = document.getElementById('savedList'); l.scrollTop = l.scrollHeight; const lr = l.getBoundingClientRect(), rows = l.querySelectorAll('.srow'), last = rows[rows.length - 1].getBoundingClientRect(); return { h: lr.height, vh: innerHeight, gap: lr.bottom - last.bottom, rows: rows.length, scrolls: l.scrollHeight > l.clientHeight }; });
  assert.equal(m.rows, 20);
  assert.ok(m.scrolls, 'the list scrolls');
  assert.ok(m.h >= m.vh * 0.5, `the list is at least half the screen: ${m.h} of ${m.vh}`);
  assert.ok(m.gap >= 12, 'room under the last row: ' + m.gap);
  assert.deepEqual(errors, []);
});

test('keyboard: Tab to a row and Enter opens it', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const id = await addPalette(page, 'Keyboard palette');
  await openLibrary(page);
  await page.focus('#libSort');
  for (let i = 0; i < 6; i++) { if (await page.evaluate(() => document.activeElement.classList.contains('sopen'))) break; await page.keyboard.press('Tab'); }
  assert.ok(await page.evaluate((id) => document.activeElement.matches(`.srow[data-id="${id}"] button.sopen`), id), 'the row’s open button has focus');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Keyboard palette/);
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await libOpen(page), false);
  assert.equal(await page.evaluate(() => state.mode), 'palette');
  assert.equal(await page.locator('#savedList [role="button"]').count(), 0, 'no role=button stand-ins left');
  assert.deepEqual(errors, []);
});

test('renaming the open guide in the Library survives its next auto-save', async () => {
  const { page, errors } = await openApp();
  const id = await savedGuide(page);
  await openLibrary(page);
  await page.click(row(page, id) + ' .sren'); await page.fill(row(page, id) + ' .sname-in', 'Renamed While Open');
  await page.keyboard.press('Enter'); await idle(page);
  await page.click('#savedClose'); await page.click('#mSections'); await idle(page);
  assert.equal(await guideName(page), 'Renamed While Open');
  await page.evaluate(() => { __mstest.colored[__mstest.assignData.order[0]] = 1; __mstest.guideDirty = true; });
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  assert.equal(await nameOf(page, id), 'Renamed While Open');
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id), 1, 'the change was saved');
  assert.deepEqual(errors, []);
});

test('delete is one tap with Undo, and the ✕ never opens the item', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const keep = await addPalette(page, 'Keep me');
  const id = await addPalette(page, 'Delete me', [30, 31, 32]);
  await openLibrary(page);
  const del = row(page, id) + ' .sdel';
  assert.equal(await page.getAttribute(del, 'aria-label'), 'Delete Delete me');
  await page.click(del); await idle(page);
  assert.ok(await libOpen(page), 'the Library stays open');
  assert.equal(await page.evaluate(() => state.mode), 'home', 'nothing was loaded');
  assert.deepEqual(await page.evaluate(() => state.saved.map((s) => s.id)), [keep]);
  assert.equal(await page.locator('#savedList .srow').count(), 1);
  assert.match(await page.textContent('#msToast'), /Deleted “Delete me”/);
  await page.click('#toastAct'); await idle(page);
  assert.deepEqual(await page.evaluate(() => state.saved.map((s) => s.id)).then((a) => a.sort()), [keep, id].sort(), 'Undo puts it back');
  assert.equal(await page.locator('#savedList .srow').count(), 2);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = async (page) => { await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)); };
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })));

test('the Library picture is not replaced by the sections editor’s tints', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const t0 = (await guides(page))[0].thumb;
  assert.ok(t0);
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { const t = __mstest, l = t.assignData.order[3]; t.secState[l] = 2; t.guideDirty = true; t.render(); });
  // (opening something else asks about the section edits first: discarded here)
  await page.evaluate(() => SF.loadSample()); await page.click('#sfEdAsk [data-a="discard"]'); await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null); await idle(page);
  assert.equal((await guides(page))[0].thumb, t0);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });

test('Library delete by keyboard: focus moves to the next row, Tab reaches Undo, Undo puts focus back', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [pal(['Ohuhu|R014'], 3, 'Three'), pal(['Ohuhu|Y111'], 2, 'Two'), pal(['Ohuhu|B08'], 1, 'One')] }) }) });
  await page.click('#homeLibCard'); await page.waitForSelector('#savedOverlay.on');
  await page.focus('#savedList .srow[data-id="3"] .sdel'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.closest('.srow') && document.activeElement.closest('.srow').dataset.id), '2', 'on the next row’s ✕');
  // Tab from the dialog's last control goes to the toast's Undo
  await page.focus('#guidesRestore'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'toastAct');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => state.saved.some((s) => s.id === 3)), true);
  assert.equal(await page.evaluate(() => document.activeElement.closest('.srow') && document.activeElement.closest('.srow').dataset.id), '3', 'back on the restored row');
  // deleting the last row lands on the one before; the last of all on the list
  for (const id of [1, 2, 3]) { await page.focus(`#savedList .srow[data-id="${id}"] .sdel`); await page.keyboard.press('Enter'); await idle(page); }
  assert.equal(await page.evaluate(() => document.activeElement.id), 'savedList');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const guidesR5 = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })));
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);

test('Colour along with a marker highlighted leaves the Library picture as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const th0 = (await guidesR5(page))[0].thumb;
  assert.ok(th0);
  await page.click('#sfColor'); await idle(page); await scrollTop(page);
  await page.locator('#sfAlist .sfarow .sfah').nth(0).click(); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.makeThumb()), '', 'no picture from the highlight view');
  await tickN(page, 2); await idle(page, AUTO);
  assert.equal((await guidesR5(page))[0].thumb, th0);
  assert.deepEqual(errors, []);
});
