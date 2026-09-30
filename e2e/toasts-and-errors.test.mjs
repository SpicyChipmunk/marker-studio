// Toasts and error messages: toasts sit above the bottom bar, let taps through, stay with their screen and stage,
// never over an open sheet, centred on their own width, and can't be reached hidden; errors appear where they
// happened, error cards stay until the tap that dismisses them is over, and unexpected errors get a calm message.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, welcome, scrollTop, pause, sectionPoint, ENGINE } from './helpers.mjs';

before(setup);
after(teardown);

const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });

test('an unexpected error shows a calm message with Copy details; noise is ignored', async () => {
  const { page, errors } = await openApp({ storage: onboarded() });
  await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  // noise: a ResizeObserver loop notice, a cancelled request, an error from another origin (no file)
  await page.evaluate(() => {
    dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.', filename: location.href }));
    dispatchEvent(new ErrorEvent('error', { message: 'Script error.', filename: '' }));
    dispatchEvent(new ErrorEvent('error', { message: 'x', filename: 'chrome-extension://abc/content.js' }));
    Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
  });
  await idle(page);
  assert.equal(await page.isVisible('#msToast.on'), false, 'noise shows nothing');
  // a real error in the app's own code (it reads the collection, which is briefly broken)
  const breakOnce = () => page.evaluate(() => { const o = state.owned; state.owned = null; setTimeout(backupDue, 0); setTimeout(() => { state.owned = o; }, 50); });
  await breakOnce();
  await page.waitForSelector('#msToast.on #errCopy');
  assert.match(await page.textContent('#msToast'), /Something went wrong\. Your saved work is safe — reload if anything looks odd\./);
  // (Safari's engine words and reports it differently: there, at least once)
  const nulls = () => errors.filter((m) => /null/.test(m)).length;
  if (ENGINE === 'chromium') assert.equal(nulls(), 1, 'the error still reaches the page error log');
  else assert.ok(nulls() >= 1, 'the error still reaches the page error log');
  await page.click('#errCopy'); await idle(page);
  const copied = await page.evaluate(() => window.__copied);
  assert.match(copied, /null/);
  assert.match(copied, /Marker Studio v\d+/);
  assert.match(copied, /Source: http:\/\/127\.0\.0\.1:\d+\/:\d+/);
  assert.ok(copied.includes(await page.evaluate(() => navigator.userAgent)), 'user agent included');
  assert.match(await page.textContent('#msToast'), /Details copied/);
  // rate-limited: another error straight away doesn't bring the message back
  await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
  await breakOnce(); await idle(page);
  assert.equal(await page.isVisible('#msToast.on'), false);
  if (ENGINE === 'chromium') assert.equal(nulls(), 2);
  else assert.ok(nulls() >= 1);
  assert.deepEqual(errors.filter((m) => !/null|aborted a request/.test(m)), []);
});

// ---- From UX release 1 (v260) ----
test('toasts sit above the bottom bar and let taps through; progress is not a toast', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(() => toast('Hello there', 4000)); await idle(page);
  const r = await page.evaluate(() => { const t = document.getElementById('msToast').getBoundingClientRect(), b = document.querySelector('.sfbar').getBoundingClientRect(); return { gap: b.top - t.bottom, pe: getComputedStyle(document.getElementById('msToast')).pointerEvents }; });
  assert.ok(r.gap >= 0 && r.gap < 30, `just above the bar (${r.gap})`);
  assert.equal(r.pe, 'none');
  await page.evaluate(() => { document.getElementById('msToast').classList.remove('on'); }); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint');
  await page.evaluate(() => { navigator.canShare = () => false; });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  assert.ok(dl);
  assert.doesNotMatch(await page.textContent('#msToast'), /Preparing/, 'no "Preparing PDF…" toast');
  assert.deepEqual(errors, []);
});

test('errors appear where they happened, in the warning style, and clear on the next tap', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#homeLibCard'); await idle(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles({ name: 'nope.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.waitForSelector('#savedOverlay .mserr', { timeout: 5000 });
  assert.match(await page.textContent('#savedOverlay .mserr'), /isn’t a Marker Studio backup/);
  await page.click('#savedOverlay .mtitle'); await idle(page);
  assert.equal(await page.locator('#savedOverlay .mserr').count(), 0, 'cleared by the next tap');
  // Match a colour: an impossible hex says what's expected
  await page.evaluate(() => { savedOverlay.classList.remove('on'); });
  await page.click('#mCollection'); await page.click('#mkMatchBtn'); await idle(page);
  if (!(await page.isVisible('#matchOverlay'))) await page.evaluate(() => window.msMatchHex('#3a7bd5'));
  await page.click('#matchOverlay [data-src="hex"]');
  await page.fill('#matchHex', '#zz'); await idle(page);
  assert.match(await page.textContent('#matchHexHint'), /6 hex digits/);
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('a hidden toast can’t be reached with the keyboard', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.evaluate(() => toastAction('Removed.', 'Undo', () => {}));
  await page.evaluate(() => document.getElementById('msToast').classList.remove('on')); await idle(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('msToast')).visibility), 'hidden');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// a real mouse tap where the element is on the screen now (no scrolling it into view first)
async function tapAt(page, sel) { const r = await rect(page, sel); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); }
const toastOn = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return !!(t && t.classList.contains('on')); });

test('toasts end with their stage, and give way to full screen, focus mode and Reveal', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // (✨ Surprise: Plan's one step with a toast, since it says what it chose)
  const shuffle = async () => { await scrollTop(page); await page.click('#sfSurprise'); await idle(page); assert.equal(await toastOn(page), true); };
  await shuffle(); await tapAt(page, '#sfColor'); await idle(page);
  assert.equal(await toastOn(page), false, 'Colour along');
  await page.click('#sfDoneBtn'); await idle(page);
  await shuffle(); await page.click('#sfFull'); await idle(page);
  assert.equal(await toastOn(page), false, 'full screen');
  await page.keyboard.press('Escape'); await idle(page);
  await shuffle(); await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfReveal'); await idle(page);
  assert.equal(await toastOn(page), false, 'Reveal');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboardedV263 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });

test('a start-up screen that fails to draw is reported, and the welcome, Match and Help still start', async () => {
  // the first look-up of the page frame (the first screen drawn at start-up) throws
  const boom = () => { const q = Document.prototype.querySelector; let n = 0; Document.prototype.querySelector = function (s) { if (s === '.wrap' && !n++) throw new Error('boom'); return q.call(this, s); }; };
  const { page, errors } = await openApp({ init: boom });
  await page.waitForSelector('#welcome.on');
  assert.deepEqual(errors, ['boom'], 'the error still reaches the page (and the error net)');
  await page.click('#wcSkip'); await page.click('#wcLook');
  await page.keyboard.press('Tab'); await page.click('#mCollection'); await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  await page.keyboard.press('Escape'); await page.click('#mHome'); await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  assert.equal(await page.evaluate(() => document.querySelectorAll('body > script').length >= 4), true, 'start-up, Match and Help each have a script');
});

test('toasts stay with their screen, and go when a dialog opens', async () => {
  const { page, errors } = await openApp({ storage: onboardedV263({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#results .cell'); await page.waitForSelector('#msToast.on');
  assert.match(await toastText(page), /Removed/);
  await page.click('#mPalette'); await idle(page);
  assert.equal(await toastText(page), '', 'gone on Palette');
  await page.click('#mCollection'); await page.click('#results .cell'); await idle(page);
  await pause(page, 200, 'a toast under 150 ms old is kept by a dialog opening (it came with it); this one is older');
  assert.match(await toastText(page), /Added|Removed/);
  await page.click('#mkMatchBtn'); await idle(page);
  assert.equal(await toastText(page), '', 'gone when Match opens');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review’s leftovers ----
const OWN4 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const appState4 = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN4, saved: [], ...extra });
const file = (o) => ({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });

test('the toast is centred on its own width, up to the whole width of a phone, not squeezed into half of it', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState4() }) });
  await page.evaluate(() => toast('Couldn’t save — this browser’s storage is full. Back up your guides and delete a few from the Library.', 8000));
  await page.waitForFunction(() => { const t = document.getElementById('msToast'); return t && getComputedStyle(t).opacity === '1'; });
  const r = await page.evaluate(() => { const b = document.getElementById('msToast').getBoundingClientRect(); return { l: b.left, w: b.width, h: b.height }; });
  assert.ok(r.w > 340 && r.w <= 360, `92% of the screen (${r.w}px)`);
  assert.ok(Math.abs(r.l + r.w / 2 - 195) < 1.5, 'centred');
  assert.ok(r.h < 110, `a few lines, not a tall column (${r.h}px)`);
  await page.evaluate(() => toast('Saved ✓'));
  const s = await page.evaluate(() => document.getElementById('msToast').getBoundingClientRect().width);
  assert.ok(s < 150, `a short one stays small (${s}px)`);
  assert.deepEqual(errors, []);
});

test('an error card stays while the finger is down, so the tap that dismisses it can’t land on the backdrop', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState4() }) });
  await page.click('#mCollection'); await page.click('#backupBtn'); await page.waitForSelector('#backupOverlay.on');
  await page.setInputFiles('#backupFile', file({ hello: 1 }));
  await page.waitForSelector('#backupOverlay .mserr');
  // near the bottom of the dialog: once the card goes the dialog is shorter, and this point is the backdrop
  const p = await page.evaluate(() => { const r = document.querySelector('#backupOverlay .ocard').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 4 }; });
  const under = () => page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.id || e.className : ''; }, p);
  const was = await under();
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await idle(page);
  assert.equal(await page.locator('#backupOverlay .mserr').count(), 1, 'still there while the finger is down');
  assert.equal(await under(), was, 'the same thing under the finger');
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('#backupOverlay .mserr'));
  assert.ok(await page.evaluate(() => document.getElementById('backupOverlay').classList.contains('on')), 'the dialog stays open');
  // its ✕ still puts it away at once
  await page.setInputFiles('#backupFile', file({ hello: 1 }));
  await page.waitForSelector('#backupOverlay .mserr');
  await page.click('#backupOverlay .mserrx');
  assert.equal(await page.locator('#backupOverlay .mserr').count(), 0);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
async function changeColour(page, l) { await scrollTop(page); await tapSection(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page); }

test('a toast never sits over an open sheet: one showing goes when the sheet opens, one raised meanwhile sits above it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l, l2] = await bigSections(page, 2);
  // a toast is showing (a colour change no longer makes one: ↶ Undo says it), then another section's picker opens
  await changeColour(page, l); await page.click('#sfPopSw .sfsw:not(.on)'); await page.click('#sfPopConfirm'); await idle(page);
  assert.equal(await toastOn(page), false, 'no toast for the step');
  await page.evaluate(() => toastAction('Something to undo', 'Undo', () => {})); await page.waitForSelector('#msToast.on');
  assert.equal(await toastOn(page), true);
  await changeColour(page, l2);
  assert.equal(await toastOn(page), false, 'the toast went when the sheet opened');
  // a toast raised while the sheet is open: above the sheet, over the picture
  await page.evaluate(() => toast('Something happened'));
  await idle(page);
  const t = await rect(page, '#msToast'), s = await rect(page, '#sfSheet');
  assert.ok(t.bottom <= s.top + 0.5, `the toast (${t.top}–${t.bottom}) ends above the sheet (${s.top})`);
  // side by side: over the picture's column, not the sheet's
  await page.setViewportSize({ width: 1024, height: 700 }); await idle(page);
  await page.evaluate(() => toast('Something else'));
  await idle(page);
  const t2 = await rect(page, '#msToast'), s2 = await rect(page, '#sfSheet');
  assert.ok(t2.right <= s2.left + 0.5, `side by side: the toast (${t2.left}–${t2.right}) is left of the sheet (${s2.left})`);
  assert.deepEqual(errors, []);
});
