// Home: the app's name and the brands you own, guide names, the tiles at every text size, and one card at a time under
// the tiles (the backup reminder when due, then Add to Home Screen, then What's new).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, idle, sampleGuide, openAtScale } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the review leftovers ----
test('Home names the app once, and the header names the brands you own', async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="0"]'); await page.click('#wcAdd'); await page.click('#wcLook'); await idle(page);
  const count = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && e.children.length === 0 && /^Marker Studio$/.test(e.textContent.trim())).length);
  assert.equal(count, 1, '"Marker Studio" shows once');
  assert.equal(await page.textContent('.head .set'), 'Ohuhu · your collection');
  await page.evaluate(() => { presetMkeys(MARKER_SETS[14]).forEach((k) => state.owned.add(k)); save(); fullRender(); });
  assert.equal(await page.textContent('.head .set'), 'Ohuhu + Copic · your collection');
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('Home shows a guide renamed in the Library', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await page.click('#sfSave'); await idle(page);
  await page.click('#mHome'); await page.click('#homeLibCard'); await idle(page);
  await page.click('#savedList .sren'); await page.fill('#savedList .sname-in', 'Renamed here'); await page.keyboard.press('Enter');
  await page.evaluate(() => savedOverlay.classList.remove('on')); await idle(page);
  assert.match(await page.textContent('#homeView'), /Renamed here/);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('Home keeps < and > in guide names', async () => {
  const g = { id: 5, type: 'guide', name: 'Cats <3 & dogs >', keys: ['Ohuhu|R014'], ts: Date.now() };
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [g] }) }) });
  await page.waitForSelector('#sfRecent .sfRecName');
  assert.equal(await page.textContent('#sfRecent .sfRecName'), 'Cats <3 & dogs >');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const SHOTS = process.env.SHOTS || '';// a folder: the layout tests save their screenshots there
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
async function shot(page, name) { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/g3-${name}.png` }); }

test('Home keeps a name that starts with "Guide"; the Resume card uses the app’s buttons', async () => {
  const g = (id, name) => ({ id, type: 'guide', name, keys: ['Ohuhu|R014', 'Ohuhu|B08'], ts: id, n: 4, W: 10, H: 10 });
  const auto = JSON.stringify({ name: 'Guide for Mum', dirty: true, ts: Date.now(), keys: ['Ohuhu|R014'] });
  const { page, errors } = await openAtScale(1.6, { storage: onboardedV265({ [KEY]: appState({ saved: [g(2000, 'Guide for Mum'), g(1000, 'Guide')] }), 'ms-guide-auto': auto }) });
  await page.waitForSelector('#sfRecent .sfRecName');
  const names = await page.$$eval('#sfRecent .sfRecName', (l) => l.map((x) => x.textContent));
  assert.equal(names[0], 'Guide for Mum');
  assert.notEqual(names[1], 'Guide', 'the default name still gets a made-up one');
  await page.waitForSelector('#sfResumeGo');
  assert.equal(await page.textContent('#sfResume .rsnm'), 'Guide for Mum');
  const b = await page.evaluate(() => ['sfResumeGo', 'sfResumeNo'].map((id) => { const e = document.getElementById(id), s = getComputedStyle(e); return { h: e.getBoundingClientRect().height, fs: parseFloat(s.fontSize), style: e.getAttribute('style'), primary: e.classList.contains('btn-primary') }; }));
  assert.ok(b[0].primary && !b[1].primary, 'Resume is the main action');
  for (const x of b) { assert.ok(x.h >= 44, 'at least 44px'); assert.equal(x.style, null, 'no inline style'); }
  const other = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('homeNew')).fontSize));
  assert.ok(b[1].fs <= other, 'no bigger than the other buttons at 1.6x');
  assert.deepEqual(errors, []);
});

for (const [w, scale] of [[360, 1.3], [390, 1.3], [360, 1.6], [390, 1]]) {
  test(`Home tiles at ${w}px, ${scale}x: all in one row, or each a full-width row`, async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: 800, storage: onboardedV265({ [KEY]: appState() }) });
    const t = await page.$$eval('.homegrid .homecard', (l) => l.map((c) => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }));
    const grid = await page.evaluate(() => Math.round(document.querySelector('.homegrid').getBoundingClientRect().width));
    const oneRow = t.every((x) => x.top === t[0].top), rows = t.every((x) => x.w === grid);
    assert.ok(oneRow || rows, JSON.stringify({ t, grid }));
    if (scale > 1 && w === 360) assert.ok(rows, 'full-width rows here');
    if (rows) {
      const lay = await page.evaluate(() => { const c = document.querySelector('.homegrid .homecard'), i = c.querySelector('.hcicon').getBoundingClientRect(), l = c.querySelector('.hclabel').getBoundingClientRect(); return i.right <= l.left; });
      assert.ok(lay, 'icon left, text right');
    }
    await shot(page, `home-${w}-${scale}x`);
    assert.deepEqual(errors, []);
  });
}

// ---- From v265 ----
const DAY = 864e5;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState3 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN3, saved: [], ...extra });
const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
// Safari in a tab (not on the Home Screen), with the automatic What's new switched on (it is off under the test seam)
const safariTab = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); window.__MS_HELP_AUTO = true; };
const shown = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.getClientRects().length > 0; }, id);
const cards = async (page) => ({ install: await shown(page, 'installCard'), backup: await shown(page, 'backupNudge'), news: await shown(page, 'whatsNew') });
const top = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
const pal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });

test('Home: one card at a time under the tiles, in order; putting one away shows the next', async () => {
  const storage = onboardedNoVer({
    [KEY]: appState3({ saved: [pal(7, 'P'), { id: 'x', type: 'guide' }] }), // one Library entry can't be read
    'ms-first-use': String(Date.now() - 5 * DAY), // the backup reminder is due
    'ms-last-ver': 'v200', // What's new is due
    'ms-guide-auto': JSON.stringify({ dirty: true, name: 'Owl', keys: ['Ohuhu|R014'], ts: Date.now() }), // Resume
  });
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
  await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: true, news: false }, 'only the backup reminder (v267: first when due)');
  assert.ok(await shown(page, 'sfResume'), 'Resume is there too (not one of the three)');
  assert.ok(await shown(page, 'loadNote'), 'and the note about unreadable data');
  // Resume, then the note, then New colouring guide and the tiles, then the one card
  assert.ok(await top(page, '#sfResume') < await top(page, '#loadNote'));
  assert.ok(await top(page, '#loadNote') < await top(page, '#homeNew'));
  assert.ok(await top(page, '.homegrid') < await top(page, '#backupNudge'));
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-wn-shown')), null, 'What’s new waiting its turn has not been shown');

  await page.focus('#backupNudge [data-bk="later"]');
  await page.keyboard.press('Enter'); await idle(page);
  assert.deepEqual(await cards(page), { install: true, backup: false, news: false }, 'Later: Add to Home Screen');
  assert.match(await page.textContent('#installCard'), /Back up first/, 'which says to back up first');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'instBackup', 'focus moves to the card that took its place');
  assert.ok(await top(page, '.homegrid') < await top(page, '#installCard'));

  await page.click('#installCard [data-inst="later"]'); await page.waitForSelector('#installCard', { state: 'hidden' });
  assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
  const at = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')));
  assert.equal(at.v, (await page.textContent('#appVer')).trim());
  assert.ok(Math.abs(at.t - Date.now()) < 60000, 'shown now');

  await page.click('#wnClose'); await page.waitForSelector('#whatsNew', { state: 'hidden' });
  assert.deepEqual(await cards(page), { install: false, backup: false, news: false }, '✕: nothing left');
  await page.reload(); await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: false, news: false }, 'and after a reload');
  assert.ok(await shown(page, 'loadNote'), 'the note stays until it is dismissed');
  assert.deepEqual(errors, []);
});

// ---- From v267 ----
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });

test('Home cards: Back up comes first when it is due, then Add to Home Screen, then What’s new', async () => {
  const storage = onboardedNoVer({ [KEY]: appState3(), 'ms-first-use': String(Date.now() - 5 * DAY), 'ms-last-ver': 'v200' });
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
  await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: true, news: false }, 'the backup reminder first');
  assert.ok(await top(page, '.homegrid') < await top(page, '#backupNudge'));
  // Later: the install card takes its turn, with focus
  await page.focus('#backupNudge [data-bk="later"]');
  await page.keyboard.press('Enter'); await idle(page);
  assert.deepEqual(await cards(page), { install: true, backup: false, news: false }, 'Later: Add to Home Screen');
  assert.equal(await page.evaluate(() => document.activeElement.closest('#installCard') != null), true, 'focus moves to it');
  // Not now: What's new
  await page.click('#installCard [data-inst="later"]'); await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
  await page.click('#wnClose'); await page.waitForSelector('#whatsNew', { state: 'hidden' });
  assert.deepEqual(await cards(page), { install: false, backup: false, news: false });
  assert.deepEqual(errors, []);
});

test('Home cards: after backing up, the install card takes its turn', async () => {
  const storage = onboardedNoVer({ [KEY]: appState3(), 'ms-first-use': String(Date.now() - 5 * DAY) });
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
  await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: true, news: false });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bkGo')]);
  assert.match(dl.suggestedFilename(), /^marker-studio-backup-/);
  await page.waitForSelector('#installCard', { state: 'visible' });
  assert.deepEqual(await cards(page), { install: true, backup: false, news: false }, 'backed up: Add to Home Screen');
  assert.equal(await toastText(page), 'Backed up ✓');
  assert.deepEqual(errors, []);
});

test('Home cards: with no backup due, Add to Home Screen comes first as before', async () => {
  // work made today: the reminder isn't due yet
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: onboardedNoVer({ [KEY]: appState3(), 'ms-last-ver': 'v200' }) });
  await idle(page);
  assert.deepEqual(await cards(page), { install: true, backup: false, news: false });
  await page.click('#installCard [data-inst="later"]'); await idle(page);
  assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
  // a backup made recently: still the install card first (on another visit, once it's not snoozed)
  const b = await openApp({ userAgent: IPHONE, init: safariTab, storage: onboardedNoVer({ [KEY]: appState3(), 'ms-first-use': String(Date.now() - 30 * DAY), 'ms-guides-backup-ts': String(Date.now() - DAY) }) });
  await idle(b.page);
  assert.equal(await b.page.evaluate(() => !!backupDue()), false);
  assert.deepEqual(await cards(b.page), { install: true, backup: false, news: false });
  assert.deepEqual([...errors, ...b.errors], []);
});
