// Escape and the app's dialogs (.overlay), one press at a time: every dialog alone (one Escape closes exactly it,
// and focus goes back to what opened it), two at once, a text field inside one, the Library's rename field, the
// welcome, Tab held inside the top dialog (and reaching a toast's Undo), a toast from before a dialog opened, and
// where focus lands when what opened the dialog has gone. Written against v267 before Escape and the dialogs were
// brought into one place (src/js/layers.js), so each test says what the app did then.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, pause, libItem } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v267', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });
const at = (mode, extra = {}) => ({ storage: onboarded({ [KEY]: appState({ mode, ...extra }) }) });

// (v288) by keyboard: Markers' ⋯ › Back up & restore opens the Library; its text line opens the backup dialog over it
async function openBackupKb(page) {
  await page.focus('#mkMore'); await page.keyboard.press('Enter');
  await page.focus('#backupBtn'); await page.keyboard.press('Enter'); await page.waitForSelector('#savedOverlay.on');
  await page.focus('#libBkText'); await page.keyboard.press('Enter'); await page.waitForSelector('#backupOverlay.on');
}
const dialogs = (page) => page.evaluate(() => [...document.querySelectorAll('.overlay.on')].map((o) => o.id));
const esc = async (page) => { await page.keyboard.press('Escape'); await idle(page); };
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || (a.dataset && a.dataset.i != null ? 'cell:' + a.dataset.i : '') || a.className || a.tagName) : null; });
const inside = (page, id) => page.evaluate((id) => document.getElementById(id).contains(document.activeElement), id);
const toastOn = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return !!(t && t.classList.contains('on')); });

// each: where it opens from, the key that opens it on the focused opener, the dialog
const ALONE = [
  ['home', '#homeLibCard', 'Enter', 'savedOverlay'],
  ['home', '#homeHelp', 'Enter', 'helpOverlay'],
  ['home', '#homeHiw', 'Enter', 'hiwOverlay'],
  // (v288) Back up & restore, in Markers' ⋯: chosen there, the Library opens at its backup buttons; focus back on ⋯
  ['collection', '#mkMore', () => { document.getElementById('mkMore').click(); document.getElementById('backupBtn').click(); }, 'savedOverlay'],
  ['collection', '#mkMatchBtn', 'Enter', 'matchOverlay'],
  ['collection', '#swatchBtn', 'Enter', 'swOverlay'],
  ['collection', '#results .cell', 'Shift+F10', 'mkOverlay'],
  ['palette', '#seedBtn', 'Enter', 'seedOverlay'],
  // Library and Save image are in the ⋯ menu: chosen there, the menu closes and focus comes back to ⋯
  ['palette', '#libMore', () => { document.getElementById('libMore').click(); document.getElementById('savedBtn').click(); }, 'savedOverlay'],
  // the swatch card itself takes a palette to draw: shown straight away here, as the button shows it
  ['palette', '#libMore', () => showOverlay('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'x.png'), 'imgOverlay'],
];
for (const [mode, sel, key, id] of ALONE) {
  test(`${id} alone (from ${sel} in ${mode}): focus moves in, one Escape closes it and focus goes back`, async () => {
    const { page, errors } = await openApp(at(mode));
    await idle(page);
    await page.focus(sel);
    const opener = await active(page);
    if (typeof key === 'function') await page.evaluate(key);
    else await page.keyboard.press(key);
    await page.waitForSelector('#' + id + '.on', { timeout: 10000 }); await idle(page);
    assert.deepEqual(await dialogs(page), [id]);
    assert.ok(await inside(page, id), 'focus is in the dialog: ' + await active(page));
    await esc(page);
    assert.deepEqual(await dialogs(page), [], 'closed');
    assert.equal(await active(page), opener, 'focus back on what opened it');
    if (id === 'imgOverlay') assert.equal(await page.getAttribute('#cardImg', 'src'), '', 'the card image is let go');
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), opener, 'a second Escape does nothing');
    assert.deepEqual(errors, []);
  });
}

test('the guide’s dialogs: Blend plan closes with Escape, back on its button; Print’s sheet too', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.focus('#sfPlan'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfPlanOverlay.on'); await idle(page);
  assert.ok(await inside(page, 'sfPlanOverlay'));
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'sfPlan');
  await page.focus('#sfPrint'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet.sfprsh');
  await esc(page);
  assert.equal(await page.locator('#sfSheet').count(), 0);
  assert.equal(await active(page), 'sfPrint');
  assert.deepEqual(errors, []);
});

test('two dialogs: How it works over Help closes first (focus back on its button), then Help', async () => {
  const { page, errors } = await openApp(at('home'));
  await page.focus('#homeHelp'); await page.keyboard.press('Enter'); await page.waitForSelector('#helpOverlay.on');
  await page.focus('#helpHiw'); await page.keyboard.press('Enter'); await page.waitForSelector('#hiwOverlay.on'); await idle(page);
  assert.deepEqual(await dialogs(page), ['helpOverlay', 'hiwOverlay']);
  assert.equal(await active(page), 'hiwNext');
  await esc(page);
  assert.deepEqual(await dialogs(page), ['helpOverlay']);
  assert.equal(await active(page), 'helpHiw');
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'homeHelp');
  // opened the other way round in the page (How it works first, then the Library by code): the one later in the
  // page is the one Escape closes, whichever opened last
  await page.evaluate(() => { openLibrary(); document.getElementById('homeHiw').click(); }); await idle(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay', 'hiwOverlay']);
  await esc(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay']);
  await page.evaluate(() => { document.getElementById('savedOverlay').classList.remove('on'); document.getElementById('homeHiw').click(); openLibrary(); }); await idle(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay', 'hiwOverlay']);
  await esc(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay'], 'How it works (later in the page) closed first, though the Library opened last');
  assert.deepEqual(errors, []);
});

test('Escape in a dialog’s text field closes the dialog (search, hex code, backup text)', async () => {
  const { page, errors } = await openApp(at('collection'));
  await openBackupKb(page);
  await page.focus('#backupText');
  await esc(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay'], 'the backup dialog closes, over the Library');
  assert.equal(await active(page), 'libBkText');
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'mkMore');
  await page.focus('#mkMatchBtn'); await page.keyboard.press('Enter'); await page.waitForSelector('#matchOverlay.on');
  await page.click('.msrc [data-src="hex"]'); await page.fill('#matchHex', '#ff0000');
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'mkMatchBtn');
  await page.evaluate(() => openLibrary()); await page.fill('#libSearch', 'x');
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.deepEqual(errors, []);
});

test('the Library’s rename field: Escape cancels the rename only (focus on its ⋯); the next Escape closes the Library', async () => {
  const { page, errors } = await openApp(at('home', { saved: [pal(['Ohuhu|R014'], 2, 'Two'), pal(['Ohuhu|B08'], 1, 'One')] }));
  await page.focus('#homeLibCard'); await page.keyboard.press('Enter'); await page.waitForSelector('#savedOverlay.on');
  await libItem(page, '#savedList .srow[data-id="2"]', 'sren');
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('sname-in')));
  await page.keyboard.type('New name');
  await esc(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay'], 'the Library stays');
  assert.equal(await page.evaluate(() => state.saved.find((s) => s.id === 2).name), 'Two', 'name as it was');
  assert.equal(await page.locator('#savedList .sname-in').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('smore') && document.activeElement.closest('.srow').dataset.id), '2', 'on its ⋯ (v288)');
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'homeLibCard');
  assert.deepEqual(errors, []);
});

test('the welcome: Escape leaves it open', async () => {
  const { page, errors } = await openApp();
  await idle(page);
  assert.deepEqual(await dialogs(page), ['welcome']);
  await esc(page);
  assert.deepEqual(await dialogs(page), ['welcome']);
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd'); await idle(page);
  await esc(page);
  assert.deepEqual(await dialogs(page), ['welcome'], 'nor on its second step');
  await page.click('#wcLook'); await idle(page);
  assert.deepEqual(await dialogs(page), []);
  assert.deepEqual(errors, []);
});

test('Tab stays in the top dialog and reaches a toast’s Undo after the last control', async () => {
  const { page, errors } = await openApp(at('collection'));
  await openBackupKb(page); await idle(page);
  const first = 'backupClose', last = 'backupRestore';
  assert.equal(await active(page), first, 'with a keyboard, the first control has focus');
  await page.focus('#' + last); await page.keyboard.press('Tab');
  assert.equal(await active(page), first, 'Tab from the last wraps to the first');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await active(page), last, 'Shift+Tab from the first wraps to the last');
  // focus outside the dialog: Tab brings it to the first control, Shift+Tab to the last
  await page.evaluate(() => document.getElementById('mCollection').focus()); await page.keyboard.press('Tab');
  assert.equal(await active(page), first);
  await page.evaluate(() => document.getElementById('mCollection').focus()); await page.keyboard.press('Shift+Tab');
  assert.equal(await active(page), last);
  // a toast with Undo raised while the dialog is open
  await page.evaluate(() => toastAction('Removed.', 'Undo', () => {}));
  await page.focus('#' + last); await page.keyboard.press('Tab');
  assert.equal(await active(page), 'toastAct', 'Tab from the last control reaches Undo');
  await page.keyboard.press('Tab');
  assert.equal(await active(page), first, 'then wraps to the first');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await active(page), 'toastAct', 'Shift+Tab from the first goes to Undo');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await active(page), last, 'and from Undo back to the last control');
  // two dialogs: Tab stays in the top one
  await page.evaluate(() => { document.getElementById('msToast').classList.remove('on'); openHelpSheet(); document.getElementById('helpHiw').click(); }); await idle(page);
  assert.deepEqual(await dialogs(page), ['savedOverlay', 'backupOverlay', 'helpOverlay', 'hiwOverlay']);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    assert.ok(await inside(page, 'hiwOverlay'), 'in How it works: ' + await active(page));
  }
  assert.deepEqual(errors, []);
});

test('a toast from before a dialog opened goes; one raised as it opens stays', async () => {
  const { page, errors } = await openApp(at('collection'));
  await page.evaluate(() => toast('Earlier', 8000)); await idle(page);
  assert.equal(await toastOn(page), true);
  await pause(page, 200, 'a toast under 150 ms old is kept by a dialog opening (it came with it); this one is older');
  await page.evaluate(() => openBackup()); await idle(page);
  assert.equal(await toastOn(page), false, 'hidden when the dialog opened');
  await esc(page);
  await page.evaluate(() => { toast('Just now', 8000); openBackup(); }); await idle(page);
  assert.equal(await toastOn(page), true, 'a toast about the dialog itself stays');
  await esc(page);
  // Help hides any toast itself
  await page.evaluate(() => { toast('Just now', 8000); openHelpSheet(); }); await idle(page);
  assert.equal(await toastOn(page), false);
  assert.deepEqual(errors, []);
});

test('focus after closing: a redrawn marker is found again by its number; with the opener gone, the open mode tab; focus moved elsewhere stays', async () => {
  const { page, errors } = await openApp(at('collection'));
  const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
  await page.focus(`#results .cell[data-i="${i}"]`); await page.keyboard.press('Shift+F10'); await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkOwn'); await idle(page);
  assert.equal(await page.evaluate((i) => document.querySelector(`#results .cell[data-i="${i}"]`) === null || !document.querySelector(`#results .cell[data-i="${i}"]`).isConnected, i), false);
  await esc(page);
  assert.equal(await active(page), 'cell:' + i, 'the marker redrawn while its sheet was open');
  // the opener removed while the dialog is open: the open mode tab
  await page.evaluate(() => { const b = document.createElement('button'); b.id = 'tmpOpener'; b.textContent = 'x'; document.body.appendChild(b); b.focus(); openBackup(); });
  await idle(page);
  await page.evaluate(() => document.getElementById('tmpOpener').remove());
  await esc(page);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.modes button.on')), true, 'on the open mode tab: ' + await active(page));
  // focus moved outside the dialog before it closed: left there
  await page.focus('#mkMore'); await page.keyboard.press('Enter'); await page.evaluate(() => { document.getElementById('mkMenu').hidden = true; openBackup(); }); await page.waitForSelector('#backupOverlay.on'); await idle(page);
  await page.evaluate(() => document.getElementById('mkMatchBtn').focus());
  await esc(page);
  assert.deepEqual(await dialogs(page), []);
  assert.equal(await active(page), 'mkMatchBtn');
  assert.deepEqual(errors, []);
});

test('on a touch screen the dialog’s card takes focus, not its first button', async () => {
  const coarse = `(function () { const mm = window.matchMedia.bind(window); window.matchMedia = function (q) { if (String(q).replace(/\\s/g, '') === '(pointer:coarse)') return { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; return mm(q); }; })()`;
  const { page, errors } = await openApp({ ...at('home'), init: coarse });
  await page.focus('#homeLibCard'); await page.keyboard.press('Enter'); await page.waitForSelector('#savedOverlay.on'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#savedOverlay > .ocard')), true, 'the card: ' + await active(page));
  await esc(page);
  assert.equal(await active(page), 'homeLibCard');
  assert.deepEqual(errors, []);
});
