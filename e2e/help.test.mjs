// Help: How it works (three cards, shown once the first time the guide opens a picture, and from "?"), the help sheet
// (photo tips, glossary, your data, keyboard and screen readers, About with the version) from the guide and Home, and
// What's new on Home after an update. The automatic parts stay off under the test seam unless a test sets
// window.__MS_HELP_AUTO.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, welcome, idle, shot, ROOT, ARTIFACTS, menuItem, pause, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

const on = (page, id) => page.evaluate((id) => document.getElementById(id).classList.contains('on'), id);
const seen = (page) => page.evaluate(() => localStorage.getItem('ms-hiw-seen'));
const autoHelp = (page) => page.evaluate(() => { window.__MS_HELP_AUTO = true; });
const activeId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
async function withAutoHelp(ctx, page) { await ctx.addInitScript(() => { window.__MS_HELP_AUTO = true; }); await page.reload(); await idle(page); }

test('How it works shows once, the first time the guide opens the sample, never over the welcome, and reopens from ?', async () => {
  const { page, errors } = await openApp();
  await autoHelp(page);
  assert.ok(await page.isVisible('#welcome'), 'welcome first');
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd'); await idle(page);
  assert.equal(await on(page, 'hiwOverlay'), false, 'not over the welcome');
  await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await page.waitForSelector('#hiwOverlay.on', { timeout: 5000 });
  assert.equal(await on(page, 'welcome'), false);
  // a proper dialog, with focus on Next
  const attrs = await page.evaluate(() => { const o = document.getElementById('hiwOverlay'); return [o.getAttribute('role'), o.getAttribute('aria-modal'), document.getElementById(o.getAttribute('aria-labelledby')).textContent]; });
  assert.deepEqual(attrs, ['dialog', 'true', 'How it works']);
  await idle(page);
  assert.equal(await activeId(page), 'hiwNext');
  assert.equal(await seen(page), '1');
  // Next / arrow keys / Back step through the three cards
  const step = () => page.evaluate(() => [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on')));
  const hidden = () => page.evaluate(() => [...document.querySelectorAll('#hiwTrack .hiwslide')].map((s) => s.getAttribute('aria-hidden') === 'true'));
  assert.equal(await step(), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hiwBack')).visibility), 'hidden', 'no Back on the first card');
  await page.click('#hiwNext'); await idle(page);
  assert.equal(await step(), 1);
  assert.deepEqual(await hidden(), [true, false, true]);
  assert.match(await page.textContent('#hiwLive'), /Step 2 of 3: Sections and colours/);
  await page.keyboard.press('ArrowRight'); await idle(page);
  assert.equal(await step(), 2);
  assert.equal((await page.textContent('#hiwNext')).trim(), 'Got it');
  assert.ok(await page.evaluate(() => { const t = document.getElementById('hiwTrack'), s = document.querySelectorAll('.hiwslide')[2]; return Math.abs(s.getBoundingClientRect().left - t.getBoundingClientRect().left) < 2; }), 'the third card is in view');
  await page.keyboard.press('ArrowLeft'); await idle(page);
  assert.equal(await step(), 1);
  await page.click('#hiwBack'); await idle(page);
  assert.equal(await step(), 0);
  await page.click('#hiwDots .hiwdot[data-i="2"]'); await idle(page);
  assert.equal(await step(), 2);
  await page.click('#hiwNext'); await idle(page);
  assert.equal(await on(page, 'hiwOverlay'), false, 'Got it closes');
  // not again: another sample, and after a reload
  await menuItem(page, 'Try the sample'); await idle(page, 1800);
  assert.equal(await on(page, 'hiwOverlay'), false, 'not shown a second time');
  await page.reload(); await autoHelp(page);
  await page.evaluate(() => { setMode('sections'); SF.loadSample(); });
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page, 1500);
  assert.equal(await on(page, 'hiwOverlay'), false, 'not shown after a reload either');
  // on the guide screen help is in the ⋯ menu (the only ⋯, no "?" of its own); it opens the help sheet, which reopens How it works
  assert.equal(await page.locator('#sfRoot .hlpq:visible').count(), 0, 'no separate "?" on the guide screen');
  await menuItem(page, 'Help'); await idle(page);
  assert.ok(await on(page, 'helpOverlay'));
  await page.click('#helpHiw'); await idle(page);
  assert.ok(await on(page, 'hiwOverlay'), 'How it works opens from the help sheet');
  assert.equal(await step(), 0, 'from the first card');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await on(page, 'hiwOverlay'), false, 'Escape closes How it works');
  assert.ok(await on(page, 'helpOverlay'), '... back on the help sheet');
  await idle(page);
  assert.equal(await activeId(page), 'helpHiw', 'focus back on the button that opened it');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await on(page, 'helpOverlay'), false);
  assert.equal(await activeId(page), 'sfMore', 'focus back on ⋯');
  assert.deepEqual(errors, []);
});

test('How it works: a pause while a card glides into view keeps the dots on the card chosen, so a quick second Next goes on', async () => {
  // A busy device (GitHub's WebKit, run 23) can pause the glide long enough for the track's "where did a swipe leave
  // it" check to run half-way; it read the first card and put the dots back. The glide is held still here to force it.
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await menuItem(page, 'Help'); await idle(page);
  await page.click('#helpHiw'); await idle(page);
  const step = () => page.evaluate(() => [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on')));
  assert.equal(await step(), 0);
  await page.evaluate(() => { const t = document.getElementById('hiwTrack'); t._scrollTo = t.scrollTo; t.scrollTo = function () {}; });
  await page.click('#hiwNext');
  await page.evaluate(() => document.getElementById('hiwTrack').dispatchEvent(new Event('scroll')));
  await pause(page, 250, 'longer than the 90 ms the track waits after its last scroll event');
  assert.equal(await step(), 1, 'still the second card');
  await page.click('#hiwNext'); await idle(page);
  assert.equal(await step(), 2, 'a second Next goes on to the third card');
  // a swipe of the track itself still counts: the track left on the first card reads as the first card
  await page.evaluate(() => { const t = document.getElementById('hiwTrack'); t.dispatchEvent(new PointerEvent('pointerdown')); t.dispatchEvent(new Event('scroll')); });
  await pause(page, 250, 'longer than the 90 ms the track waits after its last scroll event');
  assert.equal(await step(), 0, 'after a swipe the dots follow the track');
  assert.deepEqual(errors, []);
});

test('How it works also shows the first time a photo is chosen, over the sections editor, and the ⋯ is there too', async () => {
  const { page, errors } = await openApp();
  await autoHelp(page);
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles(join(ROOT, 'src', 'assets', 'sample-jellyfish.png'));
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#hiwOverlay.on', { timeout: 5000 });
  await page.click('#hiwClose'); await idle(page);
  assert.equal(await on(page, 'hiwOverlay'), false, '✕ closes');
  assert.ok(await page.isVisible('#sfMore'), '⋯ (with Help) in the sections editor');
  await buildGo(page); await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page, 1200);
  assert.equal(await on(page, 'hiwOverlay'), false, 'once only');
  assert.deepEqual(errors, []);
});

test('under the test seam How it works stays out of the way unless a test asks for it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page, 1500);
  assert.equal(await on(page, 'hiwOverlay'), false);
  assert.equal(await seen(page), null);
  // the guide is usable straight away: a tap on a tab goes through
  await page.click('.sftabbtn[data-t="pattern"]');
  assert.equal(await page.getAttribute('.sftabbtn[data-t="pattern"]', 'aria-selected'), 'true');
  assert.deepEqual(errors, []);
});

test('the help sheet: from the guide and Home, glossary, your data, About with the version, no feedback link while FEEDBACK_URL is empty', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await menuItem(page, 'Help'); await idle(page);
  assert.ok(await on(page, 'helpOverlay'), 'opens from the guide');
  const attrs = await page.evaluate(() => { const o = document.getElementById('helpOverlay'); return [o.getAttribute('role'), o.getAttribute('aria-modal'), document.getElementById(o.getAttribute('aria-labelledby')).textContent]; });
  assert.deepEqual(attrs, ['dialog', 'true', 'Help']);
  for (const s of ['Photographing a page', 'Glossary', 'Your data', 'About']) assert.ok((await page.textContent('#helpOverlay')).includes(s), s);
  // glossary
  await page.click('#helpGloss > summary'); await idle(page);
  const terms = await page.evaluate(() => [...document.querySelectorAll('#helpGloss dt')].map((d) => d.textContent));
  assert.deepEqual(terms, ['Section', 'Background / left out', 'Colour pattern', 'Zone', 'Pin', 'Kept', 'Blend companions', 'Shading', 'Highlight / Base / Shadow (H/B/S)', 'Greyscale', 'Focus mode', 'Reveal']);
  const pattern = await page.textContent('#helpGloss dd:nth-of-type(3)');
  for (const p of ['Gradient', 'Random', 'Blend', 'Photo', 'Manual']) assert.ok(pattern.includes(p), p);
  assert.ok(await page.isVisible('#helpGloss dt >> text=Focus mode'));
  // photo tips and your data
  await page.click('#helpPhoto > summary'); await idle(page);
  assert.match(await page.textContent('#helpPhoto'), /flat[\s\S]*even light[\s\S]*straightens/);
  await page.click('#helpData > summary'); await idle(page);
  const data = await page.textContent('#helpData');
  assert.match(data, /stay on this device/); assert.match(data, /no account/); assert.match(data, /Home Screen/); assert.match(data, /Back up/);
  // About: the version shown on Home, which is the service worker's version
  await page.click('#helpAbout > summary'); await idle(page);
  const ver = (await page.textContent('#helpVer')).trim();
  assert.equal(ver, (await page.textContent('#appVer')).trim());
  const sw = await readFile(join(ROOT, 'service-worker.js'), 'utf8');
  assert.equal(ver, sw.match(/marker-studio-(v\d+)/)[1]);
  const about = await page.textContent('#helpAbout');
  assert.ok(about.includes('Nothing you add leaves this device. There are no accounts, ads or analytics.'));
  assert.ok(about.includes('Ohuhu and Copic are trademarks of their owners; colours on screen are approximate — compare with your own swatches'));
  assert.match(about, /Fraunces[\s\S]*Hanken Grotesk[\s\S]*SIL Open Font License/);
  assert.equal(await page.evaluate(() => FEEDBACK_URL), '');
  assert.equal(await page.isVisible('#helpFeedback'), false, 'no feedback link');
  assert.equal(await page.evaluate(() => document.getElementById('helpFeedback').hidden), true);
  await shot(page, 'help-about');
  await page.click('#helpClose'); await idle(page);
  assert.equal(await on(page, 'helpOverlay'), false, '✕ closes');
  // from Home, by keyboard
  await page.click('#mHome'); await idle(page);
  assert.ok(await page.isVisible('#homeHelp') && await page.isVisible('#homeHiw'));
  await page.focus('#homeHelp'); await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await on(page, 'helpOverlay'), 'opens from Home with Enter');
  assert.ok(await page.evaluate(() => document.getElementById('helpOverlay').contains(document.activeElement)), 'focus moves into the sheet');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.getElementById('helpOverlay').contains(document.activeElement)), 'Tab stays in the sheet');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await on(page, 'helpOverlay'), false, 'Escape closes');
  assert.equal(await activeId(page), 'homeHelp', 'focus returns to the Help link');
  // How it works from Home, by keyboard; a tap on the backdrop closes it
  await page.focus('#homeHiw'); await page.keyboard.press('Enter'); await idle(page);
  assert.ok(await on(page, 'hiwOverlay'));
  await idle(page);
  assert.equal(await activeId(page), 'hiwNext', 'focus on Next');
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on'))), 2, 'the dots are buttons: Shift+Tab to the last one, Enter');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Step 3: Colour along');
  await page.mouse.click(5, 5); await idle(page);
  assert.equal(await on(page, 'hiwOverlay'), false, 'tapping outside closes');
  assert.deepEqual(errors, []);
});

test('What’s new: shown after an update, not on a fresh install, and stays dismissed', async () => {
  // fresh install: nothing shown, the version is just remembered
  {
    const { ctx, page, errors } = await openApp();
    await withAutoHelp(ctx, page);
    assert.ok(await page.isVisible('#welcome'));
    assert.equal(await page.$('#whatsNew'), null, 'nothing on a fresh install');
    const ver = (await page.textContent('#appVer')).trim();
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
    await welcome(page, 'look'); await page.click('#mHome'); await idle(page);
    assert.equal(await page.$('#whatsNew'), null);
    await page.reload(); await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'nor on the next launch');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // an update from an older version
  {
    const { ctx, page, errors } = await openApp({ storage: { 'ms-onboarded': '1', 'ms-last-ver': 'v200' } });
    assert.equal(await page.$('#whatsNew'), null, 'not under the test seam by default');
    await withAutoHelp(ctx, page);
    const ver = (await page.textContent('#appVer')).trim();
    assert.ok(await page.isVisible('#whatsNew'), 'shown on Home');
    assert.equal((await page.textContent('#wnTitle')).trim(), `What’s new in ${ver}`);
    const n = await page.evaluate(() => document.querySelectorAll('#whatsNew li').length);
    assert.ok(n >= 1 && n <= 4, `${n} bullets`);
    // (the newest first: v302's and v300's lines)
    assert.match(await page.textContent('#whatsNew'), /When you tap a section, the box that opens now points to it/);
    assert.match(await page.textContent('#whatsNew'), /On an iPad, the Home, Markers and Palette screens/);
    assert.equal(await page.getAttribute('#wnClose', 'aria-label'), 'Dismiss what’s new');
    await shot(page, 'help-whatsnew');
    await page.reload(); await idle(page);
    assert.ok(await page.isVisible('#whatsNew'), 'still there until dismissed');
    await page.click('#wnClose'); await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'dismissed');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
    await page.reload(); await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'stays dismissed');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // someone who used the app before What's new existed (no version remembered) sees it too
  {
    const { ctx, page } = await openApp({ storage: { 'ms-onboarded': '1' } });
    await withAutoHelp(ctx, page);
    assert.ok(await page.isVisible('#whatsNew'));
    await ctx.close();
  }
});

test('How it works never opens by itself over another dialog (the Library here)', async () => {
  const { page, errors } = await openApp();
  await autoHelp(page);
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => openLibrary());
  await idle(page);
  // the guide opens the sample behind the Library, the moment How it works would otherwise show
  await page.evaluate(() => { setMode('sections'); SF.loadSample(); });
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await idle(page);
  assert.equal(await on(page, 'savedOverlay'), true, 'the Library is still open');
  assert.equal(await on(page, 'hiwOverlay'), false, 'not over the Library');
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
const autoHelpInit = () => { window.__MS_HELP_AUTO = true; };
const shown = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.getClientRects().length > 0; }, id);

test('What’s new: counts as shown only once on screen, goes by itself after 7 days, and is always in Help › About', async () => {
  // due, but the app opens on Markers: made, not yet shown
  const { ctx, page, errors } = await openApp({ init: autoHelpInit, storage: onboarded({ [KEY]: appState({ mode: 'collection' }), 'ms-last-ver': 'v200' }) });
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-wn-shown')), null, 'not on screen yet');
  await page.click('#mHome'); await idle(page);
  assert.ok(await shown(page, 'whatsNew'));
  const ver = (await page.textContent('#appVer')).trim();
  const t0 = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')).t);
  assert.ok(Math.abs(t0 - Date.now()) < 60000);
  // shown again on the next launch: the first time is kept
  await page.reload(); await idle(page);
  assert.ok(await shown(page, 'whatsNew'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')).t), t0);
  // six days on: still there
  await page.evaluate((v) => localStorage.setItem('ms-wn-shown', JSON.stringify({ v, t: Date.now() - 6 * 864e5 })), ver);
  await page.reload(); await idle(page);
  assert.ok(await shown(page, 'whatsNew'), 'day 6');
  // a week on: gone for good, as if dismissed
  await page.evaluate((v) => localStorage.setItem('ms-wn-shown', JSON.stringify({ v, t: Date.now() - 7 * 864e5 - 1000 })), ver);
  await page.reload(); await idle(page);
  assert.equal(await page.$('#whatsNew'), null, 'day 7');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
  // a time kept for an older version doesn't count for this one
  await page.evaluate(() => { localStorage.setItem('ms-last-ver', 'v200'); localStorage.setItem('ms-wn-shown', JSON.stringify({ v: 'v200', t: 1 })); });
  await page.reload(); await idle(page);
  assert.ok(await shown(page, 'whatsNew'), 'an older version’s time is not this one’s');

  // Help › About lists the same items, any time
  await page.click('#wnClose');
  await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpAbout > summary'); await page.waitForSelector('#helpAbout .hlpwnt', { state: 'visible' });
  assert.equal((await page.textContent('#helpAbout .hlpwnt')).trim(), `What’s new in ${ver}`);
  const items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
  assert.deepEqual(items, await page.evaluate(() => WHATS_NEW.slice(0, 4)));
  assert.ok(items.length >= 1);
  assert.ok(await page.isVisible('#helpWnList'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---- From v267 ----
const SHOTS = ARTIFACTS; // screenshots for a person to look at, with the other tests' (not checked in)
const snap = async (page, name) => { await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/b-${name}.png` }); };

test('Help › Keyboard and screen readers: what needs touch or a mouse, what works by keyboard, Shift+F10', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
  assert.deepEqual(secs, ['Photographing a page', 'Glossary', 'Keyboard and screen readers', 'Your data', 'About']);
  await page.click('#helpKeys > summary'); await page.waitForSelector('#helpKeys .hlpbody', { state: 'visible' });
  const t = await page.textContent('#helpKeys .hlpbody');
  assert.match(t, /needs touch or a mouse: Change colour, Pin, Paint and ticking off one section/);
  assert.match(t, /By keyboard, use Colour along’s list instead: open a marker, then Mark all coloured or Find next\. Focus mode and everything else work by keyboard too\./);
  assert.match(t, /In Markers, press Shift\+F10 on a marker to open its details\./);
  await snap(page, 'help-keyboard');
  assert.deepEqual(errors, []);
});
