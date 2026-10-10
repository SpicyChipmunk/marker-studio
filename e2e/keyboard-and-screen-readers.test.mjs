// Keyboard and screen readers in the guide and the shell: where focus goes after a dialog, a marker picker or a change
// of stage, Ctrl+Z and Escape behind sheets, tabs and segments, and what screen readers hear (no glyphs, emoji or
// arrows read out). Escape one layer at a time is in escape-stack-guide and escape-stack-shell.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, welcome, sectionPoint, idle, scrollTop, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the third full review (v259) ----
test('the marker picker closes with Escape and starts with focus inside it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  const l = await page.evaluate(() => __mstest.assignData.order[4]); await scrollTop(page); const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y); await page.waitForSelector('#sfSheet', { state: 'visible' }); await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)), 'focus is in the picker');
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(!(await page.isVisible('#sfSheet')));
  assert.deepEqual(errors, []);
});

test('closing a dialog with Escape gives focus back to what opened it', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.focus('#homeLibCard'); await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await page.evaluate(() => savedOverlay.contains(document.activeElement)), 'focus moved into the Library');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'homeLibCard');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// a real mouse tap where the element is on the screen now (no scrolling it into view first)
async function tapAt(page, sel) { const r = await rect(page, sel); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); }
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : null; });
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }

test('from the keyboard a change of stage moves focus to the new stage\'s first control', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.focus('#sfColor'); await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('sfCtl').contains(document.activeElement)), 'focus in Colour along: ' + await active(page));
  await page.focus('#sfDoneBtn'); await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('sftabbtn') && document.activeElement.getAttribute('aria-selected') === 'true'), 'focus on the chosen tab: ' + await active(page));
  // a tap doesn't move focus anywhere
  await tapAt(page, '#sfColor'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('sfCtl').contains(document.activeElement)), false);
  assert.deepEqual(errors, []);
});

test('closing a marker picker puts focus back, never on the page itself', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l, l2] = await bigSections(page, 2);
  // Change colour from the tip with the keyboard: Escape brings the tip back with Change colour focused
  await scrollTop(page); await tapSection(page, l);
  await page.focus('.sftip [data-a="change"]'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'change', 'Change colour in the tip again: ' + await active(page));
  // with the mouse: Done, then focus on ⋯ rather than <body>
  await page.keyboard.press('Escape'); await scrollTop(page); await tapSection(page, l2); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh');
  await page.click('#sfPopConfirm'); await idle(page);
  assert.notEqual(await active(page), 'BODY');
  // the Paint brush picker: back on the brush
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  await page.click('#sfPaint'); await page.click('#sfBrush'); await page.waitForSelector('#sfSheet.sfpicksh');
  await page.click('#sfPopCancel'); await idle(page);
  assert.equal(await active(page), 'sfBrush');
  // Manual: a tap on a section opens the picker straight away
  await page.click('#sfPaint'); await scrollTop(page); await tapSection(page, l); await page.waitForSelector('#sfSheet.sfpicksh');
  await page.click('#sfPopCancel'); await idle(page);
  assert.notEqual(await active(page), 'BODY');
  // Blend's anchor menu
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page); await scrollTop(page);
  const a = await page.evaluate(() => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), p = __mstest.anchors[0]; return { x: r.left + p.x / c.width * r.width, y: r.top + p.y / c.height * r.height }; });
  await page.mouse.click(a.x, a.y); await page.waitForSelector('#sfSheet.sfpicksh');
  await page.keyboard.press('Escape'); await idle(page);
  assert.notEqual(await active(page), 'BODY');
  assert.deepEqual(errors, []);
});

test('Escape closes only a dialog open over full screen; Ctrl+Z does nothing behind an open sheet', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfFull'); await idle(page);
  await page.evaluate(() => document.getElementById('savedOverlay').classList.add('on')); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('savedOverlay').classList.contains('on')), false, 'the dialog closed');
  assert.equal(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')), true, 'still full screen');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')), false);
  // Ctrl+Z with the ⋯ menu open
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfVary'); await idle(page);
  const n = await page.evaluate(() => __mstest.planCount);
  assert.ok(n > 0);
  await page.click('#sfMore'); await page.waitForSelector('#sfSheet'); await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the sheet');
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planCount), n - 1, 'and it undoes once the sheet is closed');
  assert.deepEqual(errors, []);
});

test('tabs: arrow keys move between them, one tab stop, panels labelled by their tab; segments say which is on', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.focus('.sftabbtn[aria-selected="true"]');
  const t0 = await page.evaluate(() => document.activeElement.dataset.t);
  await page.keyboard.press('ArrowRight'); await idle(page);
  const st = await page.evaluate(() => ({ f: document.activeElement.dataset.t, sel: document.querySelector('.sftabbtn[aria-selected="true"]').dataset.t, stops: [...document.querySelectorAll('.sftabbtn')].map((b) => b.tabIndex) }));
  assert.notEqual(st.f, t0); assert.equal(st.sel, st.f, 'the focused tab is chosen');
  assert.deepEqual(st.stops.filter((x) => x === 0).length, 1, 'one tab stop');
  await page.keyboard.press('End'); assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'share');
  await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'colours', 'wraps round');
  await page.keyboard.press('ArrowLeft'); assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'share');
  const panels = await page.$$eval('.sftab', (p) => p.map((x) => [x.getAttribute('role'), document.getElementById(x.getAttribute('aria-labelledby'))?.dataset.t === x.dataset.tab]));
  assert.deepEqual(panels, [['tabpanel', true], ['tabpanel', true], ['tabpanel', true], ['tabpanel', true]]);
  // every chosen segment in every tab says so; the rest say they're not
  for (const t of ['colours', 'pattern', 'shading']) {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    const seg = await page.$$eval(`#sfPanel-${t} [role="group"] .sfedit`, (b) => b.map((x) => [x.classList.contains('on'), x.getAttribute('aria-pressed')]));
    assert.ok(seg.length >= 3 && seg.every(([on, p]) => p === String(on)), `${t}: ${JSON.stringify(seg)}`);
  }
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfEmMerge');
  assert.deepEqual(await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getAttribute('aria-pressed'))), ['false', 'true', 'false', 'false']);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
test('screen readers: glyphs are not read out, and a tone line says base and shadow in words', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  for (const name of ['Reveal & share', 'Blend plan']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1, name);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await page.getByRole('button', { name: 'Shuffle', exact: true }).count(), 1, 'Shuffle');
  // shading on: the tone line of each row in Colour along
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('#sfColor'); await idle(page);
  const t = await page.$eval('#sfAlist .sfarow .sfatones', (e) => ({ vis: e.querySelector('[aria-hidden="true"]')?.textContent, sr: e.querySelector('.sfsr')?.textContent }));
  assert.match(t.vis, /B \S+/);
  assert.match(t.sr, /base \S+, shadow/);
  const k = await page.$eval('#sfAlist .sfarow', (r) => r.dataset.k);
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`); await idle(page);
  assert.equal(await page.getByRole('button', { name: 'Mark all coloured', exact: true }).count(), 1, 'Mark all done');
  // focus mode's buttons and its tone line
  await page.click('#sfFocus'); await idle(page);
  assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 1, 'Done');
  assert.equal(await page.getByRole('button', { name: 'Skip', exact: true }).count(), 1, 'Skip');
  const fs = await page.$eval('#sfFocSub', (e) => ({ txt: e.textContent, sr: e.querySelector('.sfsr')?.textContent || '' }));
  assert.match(fs.sr + fs.txt, /base \S+/);
  const sub = await rect(page, '#sfFocSub');
  assert.ok(sub.height > 0 && sub.height < 80, 'the second line keeps its size');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('Home, Markers and the shell: emoji and arrows are not read out', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  assert.equal(await page.$$eval('.hcicon', (l) => l.every((x) => x.getAttribute('aria-hidden') === 'true')), true);
  await page.click('#mCollection');
  assert.equal(await page.getByRole('button', { name: 'Match a colour', exact: true }).count(), 1);
  // (v311: + Add markers, its + not read out)
  assert.equal(await page.getByRole('button', { name: 'Add markers', exact: true }).count(), 1);
  await page.click('#mkDrawBtn');
  assert.equal(await page.getByRole('button', { name: 'Markers', exact: true }).count(), 2, 'the tab and ← Markers');
  assert.deepEqual(errors, []);
});
