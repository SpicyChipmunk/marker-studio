// Escape and the guide's layers, one press at a time: the marker picker, any other sheet (the ⋯ menu, Reset
// progress's question, Print), the tip over a tapped section, focus mode and its Colours sheet, Reveal and full
// screen, each alone and with a dialog open over them; the rename field and the Section edits question; Ctrl+Z
// behind an open sheet or dialog. Written against v267 before Escape was brought into one place (src/js/layers.js),
// so each test says what the app did then: every Escape closes one thing, the top one, and focus lands where it did.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, sectionPoint, scrollTop, openMenu, menuItem } from './helpers.mjs';

before(setup);
after(teardown);

// everything that can be open, in one object, so each step says exactly what is still open
const layers = (page) =>
  page.evaluate(() => {
    const rt = document.getElementById('sfRoot'),
      fs = document.getElementById('sfFocSheet'),
      sh = document.getElementById('sfSheet');
    return {
      dialogs: [...document.querySelectorAll('.overlay.on')].map((o) => o.id),
      sheet: sh ? (sh.classList.contains('sfpicksh') ? 'picker' : sh.classList.contains('sfmenush') ? 'menu' : sh.classList.contains('sfasksh') ? 'ask' : 'other') : null,
      tip: !!document.querySelector('.sftip'),
      renaming: !!document.getElementById('sfGName'),
      full: rt.classList.contains('sffull'),
      reveal: rt.classList.contains('sfrev'),
      focus: rt.classList.contains('sffoc'),
      focusSheet: !!(fs && fs.style.display !== 'none' && rt.classList.contains('sffoc')),
    };
  });
const NONE = { dialogs: [], sheet: null, tip: false, renaming: false, full: false, reveal: false, focus: false, focusSheet: false };
const open = (o) => ({ ...NONE, ...o });
const esc = async (page) => { await page.keyboard.press('Escape'); await idle(page); };
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || (a.dataset && a.dataset.a && 'tip:' + a.dataset.a) || a.className || a.tagName) : null; });
const bigSections = (page, n = 3) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
const tickN = (page, n) => page.evaluate((n) => { const t = __mstest; t.assignData.order.slice(0, n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, n);
const ticks = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));

test('the ⋯ menu alone: Escape closes it and focus goes back to ⋯; a second Escape does nothing', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.focus('#sfMore'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet .sfmitem');
  assert.deepEqual(await layers(page), open({ sheet: 'menu' }));
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfMore');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfMore');
  assert.deepEqual(errors, []);
});

test('the tip alone (by mouse): Escape hides it; the picker from it: Escape undoes the pick, closes it, and focus goes to ⋯', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l] = await bigSections(page, 1), m0 = await mk(page, l);
  await scrollTop(page); await tapSection(page, l);
  assert.deepEqual(await layers(page), open({ tip: true }));
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  // Change colour: a pick previews, Escape takes it back
  await scrollTop(page); await tapSection(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh');
  assert.deepEqual(await layers(page), open({ sheet: 'picker' }));
  await page.click(`#sfPopSw .sfsw:not(.on):not([data-k="${m0}"])`); await idle(page);
  assert.notEqual(await mk(page, l), m0, 'previewed');
  await esc(page);
  assert.deepEqual(await layers(page), NONE, 'the picker closed, and with the mouse the tip does not come back');
  assert.equal(await mk(page, l), m0, 'Escape is Cancel: the pick is undone');
  assert.equal(await active(page), 'sfMore');
  assert.deepEqual(errors, []);
});

test('picker over the tip, by keyboard: Escape closes the picker and brings the tip back focused; the next closes the tip', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l] = await bigSections(page, 1);
  await scrollTop(page); await tapSection(page, l);
  await page.focus('.sftip [data-a="change"]'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  assert.deepEqual(await layers(page), open({ sheet: 'picker' }));
  // Escape on the code filter is the picker's Escape too (the field doesn't keep it)
  await page.focus('#sfPopFilter'); await page.keyboard.type('R');
  await esc(page);
  assert.deepEqual(await layers(page), open({ tip: true }));
  assert.equal(await active(page), 'tip:change');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.deepEqual(errors, []);
});

test('renaming: Escape in the name field only cancels the rename, even with the tip showing; the next Escape closes the tip', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const n0 = await page.textContent('#sfGTitle'), [l] = await bigSections(page, 1);
  await scrollTop(page);
  await page.click('#sfRename'); await page.fill('#sfGName', 'Not this');
  // a tap on a section that doesn't take focus from the field (a synthetic press): the tip shows while renaming
  const p = await sectionPoint(page, l);
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById('sfCanvas'), o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); c.dispatchEvent(new MouseEvent('click', o));
  }, p);
  await idle(page);
  assert.deepEqual(await layers(page), open({ tip: true, renaming: true }));
  assert.equal(await active(page), 'sfGName');
  await esc(page);
  assert.deepEqual(await layers(page), open({ tip: true }), 'the rename was cancelled, the tip stays');
  assert.equal(await page.textContent('#sfGTitle'), n0);
  assert.equal(await active(page), 'sfRename');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.deepEqual(errors, []);
});

test('full screen: the tip or a sheet in it closes first, then full screen; a dialog over full screen closes alone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l] = await bigSections(page, 1);
  await page.click('#sfFull'); await idle(page);
  assert.deepEqual(await layers(page), open({ full: true }));
  await tapSection(page, l);
  assert.deepEqual(await layers(page), open({ full: true, tip: true }), 'a tap shows the tip in full screen');
  await esc(page);
  assert.deepEqual(await layers(page), open({ full: true }));
  // the ⋯ menu, reached by keyboard behind full screen (a marker picker leaves full screen as it opens)
  await page.focus('#sfMore'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet .sfmitem');
  assert.deepEqual(await layers(page), open({ full: true, sheet: 'menu' }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ full: true }));
  assert.equal(await active(page), 'sfMore');
  // Help over full screen
  await page.focus('#sfFullX');
  await page.evaluate(() => openHelpSheet()); await idle(page);
  assert.deepEqual(await layers(page), open({ full: true, dialogs: ['helpOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ full: true }));
  assert.equal(await active(page), 'sfFullX', 'focus back where it was');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.deepEqual(errors, []);
});

test('Reveal: a dialog over it closes alone, then Escape ends Reveal', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfReveal'); await page.waitForSelector('#revDone', { timeout: 15000 });
  assert.deepEqual(await layers(page), open({ reveal: true }));
  await page.focus('#revDone');
  await page.evaluate(() => openLibrary()); await idle(page);
  assert.deepEqual(await layers(page), open({ reveal: true, dialogs: ['savedOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ reveal: true }));
  assert.equal(await active(page), 'revDone');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.deepEqual(errors, []);
});

test('a dialog over the ⋯ menu closes alone; then the menu; Help from ⋯ gives focus back to ⋯', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await openMenu(page);
  await page.evaluate(() => openLibrary()); await idle(page);
  assert.deepEqual(await layers(page), open({ sheet: 'menu', dialogs: ['savedOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ sheet: 'menu' }));
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)), 'focus back in the menu: ' + await active(page));
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  // Help from the menu (the menu closes as Help opens)
  await menuItem(page, 'Help'); await idle(page);
  assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfMore');
  // How it works from Help: one Escape each
  await menuItem(page, 'Help'); await idle(page);
  await page.focus('#helpHiw'); await page.keyboard.press('Enter'); await idle(page);
  assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay', 'hiwOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay'] }));
  assert.equal(await active(page), 'helpHiw');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfMore');
  assert.deepEqual(errors, []);
});

test('Colour along: Reset progress’s question closes with Escape and clears nothing; Ctrl+Z does nothing behind a sheet or dialog', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // Ctrl+Z in the guide editor: one Shuffle to undo
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfVary'); await idle(page);
  const n = await page.evaluate(() => __mstest.planCount);
  await page.evaluate(() => openLibrary()); await idle(page);
  await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the Library');
  await esc(page);
  await openMenu(page); await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the menu');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  // Colour along
  await page.click('#sfColor'); await idle(page);
  await tickN(page, 3);
  await menuItem(page, 'Reset progress'); await page.waitForSelector('#sfSheet.sfasksh');
  assert.match(await page.textContent('#sfSheetT'), /Clear all 3 ticks\?/);
  assert.deepEqual(await layers(page), open({ sheet: 'ask' }));
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await ticks(page), 3, 'nothing cleared');
  assert.equal(await active(page), 'sfMore');
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.deepEqual(errors, []);
});

test('focus mode: Escape closes its Colours sheet, then leaves it (focus back on ⛶ Focus mode); a dialog over it closes first', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page);
  await page.focus('#sfFocus'); await page.keyboard.press('Enter'); await idle(page);
  assert.deepEqual(await layers(page), open({ focus: true }));
  await page.click('#sfFocCols'); await idle(page);
  assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true }));
  // Help over focus mode has the keys
  await page.evaluate(() => openHelpSheet()); await idle(page);
  assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true, dialogs: ['helpOverlay'] }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ focus: true }));
  assert.equal(await page.evaluate(() => __mstest.focus), true);
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfFocus');
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.deepEqual(errors, []);
});

test('focus mode: Escape from a form field in it (the tone-steps box) does nothing', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFocCols'); await idle(page);
  await page.focus('#sfToneSteps');
  await esc(page);
  assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true }), 'Escape on a checkbox in focus mode is left alone');
  assert.deepEqual(errors, []);
});

test('Section edits question: Escape is Cancel (nothing opens), focus goes back, and it leaves no Escape behind', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent));
  const id = await page.evaluate(() => __mstest.curId);
  await page.click('#sfBack2'); await idle(page); await scrollTop(page);
  const [, , l] = await bigSections(page, 3);
  await tapSection(page, l);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), l), false, 'excluded');
  await page.focus('#sfBuild');
  await page.evaluate(() => { SF.loadSample(); }); await page.waitForSelector('#sfEdAsk');
  assert.deepEqual(await layers(page), open({ dialogs: ['sfEdAsk'] }));
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'build', 'focus on Build guide');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await page.locator('#sfEdAsk').count(), 0, 'removed');
  assert.equal(await page.evaluate(() => __mstest.curId), id, 'nothing else opened');
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  assert.equal(await active(page), 'sfBuild');
  // a later Escape reaches the guide's own layers as usual (the question's key handling went with it)
  await page.focus('#sfMore'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet .sfmitem');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.equal(await active(page), 'sfMore');
  // asked again: the new question takes Escape the same way
  await page.evaluate(() => { SF.loadSample(); }); await page.waitForSelector('#sfEdAsk');
  await esc(page);
  assert.equal(await page.locator('#sfEdAsk').count(), 0);
  assert.equal(await page.evaluate(() => __mstest.curId), id);
  assert.deepEqual(errors, []);
});

// Changed with layers.js (a bug unified): the rename field is reachable by keyboard behind full screen (full screen
// doesn't hold focus). In v267 Escape there left full screen and kept the rename open, as full screen's Escape didn't
// leave the name field alone the way the tip's and the sheets' did. Now the field keeps its Escape wherever it is.
test('renaming behind full screen: Escape cancels the rename and full screen stays; the next Escape leaves it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const n0 = await page.textContent('#sfGTitle');
  await page.click('#sfFull'); await idle(page);
  await page.focus('#sfRename'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await active(page), 'sfGName');
  await page.keyboard.type('x');
  assert.deepEqual(await layers(page), open({ full: true, renaming: true }));
  await esc(page);
  assert.deepEqual(await layers(page), open({ full: true }));
  assert.equal(await page.textContent('#sfGTitle'), n0, 'the name as it was');
  assert.equal(await active(page), 'sfRename');
  await esc(page);
  assert.deepEqual(await layers(page), NONE);
  assert.deepEqual(errors, []);
});
