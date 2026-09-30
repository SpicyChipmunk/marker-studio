// Wording across the app: one word per idea, and small wording fixes (Help, What's new, the blend plan legend, the
// Library's caption, labels).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From UX release 1 (v260) ----
test('one word per idea', async () => {
  const { page, errors } = await openApp();
  assert.equal(await page.textContent('#wcAdd'), 'Tick a set above');
  await page.check('#wcSets input[data-i="0"]');
  assert.equal(await page.textContent('#wcAdd'), 'Add 24 markers');
  await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await page.click('.sftabbtn[data-t="share"]');
  assert.equal(await page.textContent('#sfPrint'), 'Print…');
  assert.equal(await page.textContent('#sfExport'), 'Save image');
  assert.match(await page.textContent('#sfBack2'), /Edit sections/);
  await page.click('#sfPrint');
  assert.equal(await page.textContent('#sfPDF'), 'Download PDF');
  const ord = await page.evaluate(() => [...document.querySelectorAll('#sfSheet *')].map((e) => e.id || e.className));
  const pi = ord.findIndex((c) => /\bsfpaper\b/.test(c));
  assert.ok(pi >= 0 && pi < ord.indexOf('sfPDF'), 'paper size before Download PDF');
  await page.keyboard.press('Escape');
  // on a phone that can share files the PDF goes to the share sheet, so the button says Save (as on the swatch chart);
  // a computer downloads it even where the browser could share it
  await page.evaluate(() => { window.__cs = navigator.canShare; window.__sh = navigator.share; navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = () => Promise.resolve(); });
  await page.click('#sfPrint');
  assert.equal(await page.textContent('#sfPDF'), 'Download PDF');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__sf = shareFirst; shareFirst = () => true; });
  await page.click('#sfPrint');
  assert.equal(await page.textContent('#sfPDF'), 'Save PDF');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { navigator.canShare = window.__cs; navigator.share = window.__sh; shareFirst = window.__sf; });
  await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfColor'); await idle(page);
  assert.equal(await page.textContent('#sfDoneBtn'), 'Done colouring');
  assert.match(await page.textContent('#sfAlist .sfarow .cnt'), /^0 of \d+ done$/);
  assert.equal(await page.textContent('#exportBtn'), 'Save image');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('wording: Help is Help, What’s new has no "….", the iOS card in Chrome doesn’t say Safari', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  assert.equal(await page.textContent('#homeHelp'), 'Help');
  assert.equal(await page.evaluate(() => WHATS_NEW.some((t) => t.includes('….'))), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('appVer')).opacity), '1');
  await page.click('#mSections'); await idle(page);
  assert.equal(await page.getAttribute('#sfHelpQ0', 'aria-label'), 'Help');
  const CRIOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
  const ios = await openApp({ userAgent: CRIOS, init: () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); }, storage: onboarded({ [KEY]: appState() }) });
  await ios.page.waitForSelector('#installCard', { state: 'visible' });
  const t = await ios.page.textContent('#installCard');
  assert.doesNotMatch(t, /in Safari/);
  assert.match(t, /Share menu/);
  assert.deepEqual([...errors, ...ios.errors], []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });

test('small wording: blend plan legend, Library caption and empty list, seed search label, toast Undo outline', async () => {
  const g = { id: 3000, type: 'guide', name: 'G', keys: ['Ohuhu|R014'], ts: 3000, n: 4, W: 10, H: 10 };
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ saved: [g] }) }) });
  assert.match(await page.textContent('#sfPlanOverlay .dsub'), /Amber outline: a marker you don’t own yet\./);
  await page.click('#homeLibCard');
  assert.equal(await page.textContent('#libStat'), 'Not backed up yet (1 guide)');
  await page.evaluate(() => { state.saved = []; renderSaved(); });
  assert.equal(await page.textContent('#savedList .empty'), 'No saved palettes or guides yet.');
  await page.keyboard.press('Escape');
  assert.equal(await page.getAttribute('#seedSearch', 'aria-label'), 'Search markers');
  await page.evaluate(() => toastAction('Deleted', 'Undo', () => {}));
  const border = await page.evaluate(() => getComputedStyle(document.querySelector('#msToast .sflink')).borderTopColor);
  const [r, gg, b] = border.match(/[\d.]+/g).map(Number);
  assert.ok(r + gg + b < 600, 'a dark outline on the light toast: ' + border);
  assert.deepEqual(errors, []);
});
