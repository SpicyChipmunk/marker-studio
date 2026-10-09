// Installing and keeping work on the device: the Add to Home Screen card (iPhone Safari) and install prompt (Chrome),
// asking for persistent storage, and fonts served from the app itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, notOnWebKit, WK, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const KEY = 'ohuhu-hb320-picker-v3';
const DAY = 864e5;
// Safari in a tab says navigator.standalone === false; from the Home Screen it's true
const safariTab = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); };
const safariHomeScreen = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true }); };
const displayStandalone = () => {
  Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
  const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
};
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
// saved app state as the app writes it (the flags stop the one-off marker additions for older collections)
const appState = (owned) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned, saved: [] });
const collection = (extra = {}) => onboarded({ [KEY]: appState(['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08']), ...extra });

const stubPersist = () => {
  window.__persist = 0;
  const st = navigator.storage;
  st.persisted = () => Promise.resolve(false);
  st.persist = () => { window.__persist++; return Promise.resolve(true); };
};

test('iPhone Safari (not installed): Home suggests Add to Home Screen, and Not now hides it for a week', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: onboarded() });
  await page.waitForSelector('#installCard', { state: 'visible' });
  const txt = await page.textContent('#installCard');
  assert.match(txt, /Add Marker Studio to your Home Screen/);
  assert.match(txt, /so your iPhone keeps your markers and guides/);
  assert.match(txt, /Tap the Share button/);
  assert.match(txt, /Add to Home Screen/);
  assert.doesNotMatch(txt, /Back up first/, 'nothing to carry over yet');
  assert.equal(await page.isVisible('#installCard [data-inst="go"]'), false, 'no install button on iPhone');
  await page.click('#installCard [data-inst="later"]');
  assert.equal(await page.isVisible('#installCard'), false);
  const until = await page.evaluate(() => +localStorage.getItem('ms-install-snooze'));
  assert.ok(Math.abs(until - (Date.now() + 7 * DAY)) < 60000, 'snoozed for 7 days');
  await page.reload(); await idle(page);
  assert.equal(await page.isVisible('#installCard'), false, 'still hidden after a reload');
  // a week later it comes back
  await page.evaluate(() => { localStorage.setItem('ms-install-snooze', String(Date.now() - 1000)); setMode('collection'); setMode('home'); });
  assert.ok(await page.isVisible('#installCard'));
  assert.deepEqual(errors, []);
});

test('iPhone Safari with work already made: the card suggests backing up first', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
  await page.waitForSelector('#installCard', { state: 'visible' });
  assert.match(await page.textContent('#installCard'), /Back up first/);
  assert.deepEqual(errors, []);
});

test('never shown once installed: Home Screen app on iPhone, or display-mode standalone', async () => {
  for (const init of [safariHomeScreen, displayStandalone]) {
    const { page, errors } = await openApp({ userAgent: IPHONE, init, storage: onboarded() });
    await idle(page);
    assert.equal(await page.isVisible('#installCard'), false, init.name);
    // an install prompt can't show it either
    await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); });
    assert.equal(await page.isVisible('#installCard'), false, init.name + ' + beforeinstallprompt');
    assert.deepEqual(errors, []);
  }
});

test('Chrome: beforeinstallprompt shows Install app, which opens the browser prompt', async () => {
  const { page, errors } = await openApp({ storage: onboarded() });
  await idle(page);
  assert.equal(await page.isVisible('#installCard'), false, 'nothing without an install prompt');
  const prevented = await page.evaluate(() => {
    window.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(prevented, true, 'the mini-infobar is held back so the card can offer it');
  await page.waitForSelector('#installCard', { state: 'visible' });
  assert.match(await page.textContent('#installCard'), /Install Marker Studio/);
  await page.click('#installCard [data-inst="go"]');
  assert.equal(await page.evaluate(() => window.__prompted), 1);
  await idle(page);
  assert.equal(await page.isVisible('#installCard'), false, 'a used prompt is gone');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-install-snooze')), null, 'accepted: no snooze needed');
  assert.deepEqual(errors, []);
});

test('persistent storage is asked for when the collection is set up in the welcome, and on a first palette save', notOnWebKit(WK.storage), async () => {
  const { page, errors } = await openApp({ init: stubPersist });
  await haveSet(page); await page.check('#wcSets input[data-i="3"]'); await idle(page);
  assert.equal(await page.evaluate(() => window.__persist), 0, 'not for ticking a set');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-first-use')), null);
  await page.click('#wcAdd'); await idle(page);
  assert.equal(await page.evaluate(() => window.__persist), 1, 'asked after Add');
  assert.ok(+(await page.evaluate(() => localStorage.getItem('ms-first-use'))) > Date.now() - 60000, 'first use noted');
  await page.click('#wcLook');
  assert.equal(await page.isVisible('#backupNudge'), false, 'no reminder on day one');

  // someone who skipped the markers and saves a palette
  const b = await openApp({ init: stubPersist, storage: onboarded({ [KEY]: appState([]) }) });
  assert.equal(await b.page.evaluate(() => state.owned.size), 0);
  await b.page.click('#mPalette'); await idle(b.page);
  await b.page.click('#draw'); await idle(b.page, 1300);
  assert.equal(await b.page.evaluate(() => window.__persist), 0);
  await b.page.click('#saveBtn'); await idle(b.page);
  assert.equal(await b.page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length), 1);
  assert.equal(await b.page.evaluate(() => window.__persist), 1, 'asked after the palette save');
  assert.deepEqual([...errors, ...b.errors], []);
});

test('fonts come from the app itself, not Google', async () => {
  const { page, errors } = await openApp();
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.reload(); await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Fraunces' && f.status === 'loaded'));
  const st = await page.evaluate(() => ({ fraunces: document.fonts.check('500 22px Fraunces'), hanken: document.fonts.check('600 13px "Hanken Grotesk"'), title: getComputedStyle(document.querySelector('.title')).fontFamily }));
  assert.ok(st.fraunces && st.hanken, JSON.stringify(st));
  assert.ok(reqs.some((u) => /\/src\/assets\/fonts\/fraunces-latin-opsz-normal\.woff2$/.test(u)), 'Fraunces from the same origin');
  assert.ok(reqs.some((u) => /\/src\/assets\/fonts\/hanken-grotesk-latin-wght-normal\.woff2$/.test(u)), 'Hanken Grotesk from the same origin');
  assert.ok(!reqs.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), 'nothing from Google Fonts');
  assert.ok(reqs.every((u) => u.startsWith(new URL(page.url()).origin) || u.startsWith('data:') || u.startsWith('blob:')), 'no off-origin requests at all: ' + reqs.filter((u) => !u.startsWith(new URL(page.url()).origin)).join(', '));
  assert.deepEqual(errors, []);
});
