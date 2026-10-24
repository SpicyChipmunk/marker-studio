// Help, What’s new, wording, the beta tester tasks and feedback.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ARTIFACTS,
  ROOT,
  WK,
  addFromMarkers,
  buildGo,
  haveSet,
  idle,
  menuItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openMenu,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  shot,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from help.test.mjs ----
// Help: How it works (three cards, shown once the first time the guide opens a picture, and from "?"), the help sheet
// (photo tips, glossary, your data, keyboard and screen readers, About with the version) from the guide and Home, and
// What's new on Home after an update. The automatic parts stay off under the test seam unless a test sets
// window.__MS_HELP_AUTO.
{
  const on = (page, id) => page.evaluate((id) => document.getElementById(id).classList.contains('on'), id);
  const seen = (page) => page.evaluate(() => localStorage.getItem('ms-hiw-seen'));
  const autoHelp = (page) =>
    page.evaluate(() => {
      window.__MS_HELP_AUTO = true;
    });
  const activeId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
  async function withAutoHelp(ctx, page) {
    await ctx.addInitScript(() => {
      window.__MS_HELP_AUTO = true;
    });
    await page.reload();
    await idle(page);
  }
  // ---- From v265 ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  const autoHelpInit = () => {
    window.__MS_HELP_AUTO = true;
  };
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  // ---- From v267 ----
  const SHOTS = ARTIFACTS;
  // screenshots for a person to look at, with the other tests' (not checked in)
  const snap = async (page, name) => {
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/b-${name}.png` });
  };
  test('How it works shows once, the first time the guide opens the sample, never over the welcome, and reopens from ?', async () => {
    const { page, errors } = await openApp();
    await autoHelp(page);
    assert.ok(await page.isVisible('#welcome'), 'welcome first');
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await on(page, 'hiwOverlay'), false, 'not over the welcome');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await page.waitForSelector('#hiwOverlay.on', { timeout: 5000 });
    assert.equal(await on(page, 'welcome'), false);
    // a proper dialog, with focus on Next
    const attrs = await page.evaluate(() => {
      const o = document.getElementById('hiwOverlay');
      return [
        o.getAttribute('role'),
        o.getAttribute('aria-modal'),
        document.getElementById(o.getAttribute('aria-labelledby')).textContent,
      ];
    });
    assert.deepEqual(attrs, ['dialog', 'true', 'How it works']);
    await idle(page);
    assert.equal(await activeId(page), 'hiwNext');
    assert.equal(await seen(page), '1');
    // Next / arrow keys / Back step through the three cards
    const step = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on')),
      );
    const hidden = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#hiwTrack .hiwslide')].map(
          (s) => s.getAttribute('aria-hidden') === 'true',
        ),
      );
    assert.equal(await step(), 0);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('hiwBack')).visibility),
      'hidden',
      'no Back on the first card',
    );
    await page.click('#hiwNext');
    await idle(page);
    assert.equal(await step(), 1);
    assert.deepEqual(await hidden(), [true, false, true]);
    assert.match(await page.textContent('#hiwLive'), /Step 2 of 3: Sections and colours/);
    await page.keyboard.press('ArrowRight');
    await idle(page);
    assert.equal(await step(), 2);
    assert.equal((await page.textContent('#hiwNext')).trim(), 'Got it');
    // (v318.1: waited for, not read once: a slow WebKit can be mid smooth scroll when idle() returns)
    assert.ok(
      await page
        .waitForFunction(
          () => {
            const t = document.getElementById('hiwTrack'),
              s = document.querySelectorAll('.hiwslide')[2];
            return Math.abs(s.getBoundingClientRect().left - t.getBoundingClientRect().left) < 2;
          },
          null,
          { timeout: 3000 },
        )
        .then(
          () => true,
          () => false,
        ),
      'the third card is in view',
    );
    await page.keyboard.press('ArrowLeft');
    await idle(page);
    assert.equal(await step(), 1);
    await page.click('#hiwBack');
    await idle(page);
    assert.equal(await step(), 0);
    await page.click('#hiwDots .hiwdot[data-i="2"]');
    await idle(page);
    assert.equal(await step(), 2);
    await page.click('#hiwNext');
    await idle(page);
    assert.equal(await on(page, 'hiwOverlay'), false, 'Got it closes');
    // not again: another sample, and after a reload
    await menuItem(page, 'Try the sample');
    await idle(page, 1800);
    assert.equal(await on(page, 'hiwOverlay'), false, 'not shown a second time');
    await page.reload();
    await autoHelp(page);
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page, 1500);
    assert.equal(await on(page, 'hiwOverlay'), false, 'not shown after a reload either');
    // on the guide screen help is in the ⋯ menu (the only ⋯, no "?" of its own); it opens the help sheet, which reopens How it works
    assert.equal(
      await page.locator('#sfRoot .hlpq:visible').count(),
      0,
      'no separate "?" on the guide screen',
    );
    await menuItem(page, 'Help');
    await idle(page);
    assert.ok(await on(page, 'helpOverlay'));
    await page.click('#helpHiw');
    await idle(page);
    assert.ok(await on(page, 'hiwOverlay'), 'How it works opens from the help sheet');
    assert.equal(await step(), 0, 'from the first card');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await on(page, 'hiwOverlay'), false, 'Escape closes How it works');
    assert.ok(await on(page, 'helpOverlay'), '... back on the help sheet');
    await idle(page);
    assert.equal(await activeId(page), 'helpHiw', 'focus back on the button that opened it');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await on(page, 'helpOverlay'), false);
    assert.equal(await activeId(page), 'sfMore', 'focus back on ⋯');
    assert.deepEqual(errors, []);
  });
  test('How it works: a pause while a card glides into view keeps the dots on the card chosen, so a quick second Next goes on', async () => {
    // A busy device (GitHub's WebKit, run 23) can pause the glide long enough for the track's "where did a swipe leave
    // it" check to run half-way; it read the first card and put the dots back. The glide is held still here to force it.
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await menuItem(page, 'Help');
    await idle(page);
    await page.click('#helpHiw');
    await idle(page);
    const step = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on')),
      );
    assert.equal(await step(), 0);
    await page.evaluate(() => {
      const t = document.getElementById('hiwTrack');
      t._scrollTo = t.scrollTo;
      t.scrollTo = function () {};
    });
    await page.click('#hiwNext');
    await page.evaluate(() => document.getElementById('hiwTrack').dispatchEvent(new Event('scroll')));
    await pause(page, 250, 'longer than the 90 ms the track waits after its last scroll event');
    assert.equal(await step(), 1, 'still the second card');
    await page.click('#hiwNext');
    await idle(page);
    assert.equal(await step(), 2, 'a second Next goes on to the third card');
    // a swipe of the track itself still counts: the track left on the first card reads as the first card
    await page.evaluate(() => {
      const t = document.getElementById('hiwTrack');
      t.dispatchEvent(new PointerEvent('pointerdown'));
      t.dispatchEvent(new Event('scroll'));
    });
    await pause(page, 250, 'longer than the 90 ms the track waits after its last scroll event');
    assert.equal(await step(), 0, 'after a swipe the dots follow the track');
    assert.deepEqual(errors, []);
  });
  test('How it works also shows the first time a photo is chosen, over the sections editor, and the ⋯ is there too', async () => {
    const { page, errors } = await openApp();
    await autoHelp(page);
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles(join(ROOT, 'src', 'assets', 'sample-jellyfish.png'));
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#hiwOverlay.on', { timeout: 5000 });
    await page.click('#hiwClose');
    await idle(page);
    assert.equal(await on(page, 'hiwOverlay'), false, '✕ closes');
    assert.ok(await page.isVisible('#sfMore'), '⋯ (with Help) in the sections editor');
    await buildGo(page);
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page, 1200);
    assert.equal(await on(page, 'hiwOverlay'), false, 'once only');
    assert.deepEqual(errors, []);
  });
  test('under the test seam How it works stays out of the way unless a test asks for it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page, 1500);
    assert.equal(await on(page, 'hiwOverlay'), false);
    assert.equal(await seen(page), null);
    // the guide is usable straight away: a tap on a tab goes through
    await page.click('.sftabbtn[data-t="pattern"]');
    assert.equal(await page.getAttribute('.sftabbtn[data-t="pattern"]', 'aria-selected'), 'true');
    assert.deepEqual(errors, []);
  });
  test('the help sheet: from the guide and Home, glossary, your data, About with the version, Send feedback and Copy diagnostics', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await menuItem(page, 'Help');
    await idle(page);
    assert.ok(await on(page, 'helpOverlay'), 'opens from the guide');
    const attrs = await page.evaluate(() => {
      const o = document.getElementById('helpOverlay');
      return [
        o.getAttribute('role'),
        o.getAttribute('aria-modal'),
        document.getElementById(o.getAttribute('aria-labelledby')).textContent,
      ];
    });
    assert.deepEqual(attrs, ['dialog', 'true', 'Help']);
    for (const s of ['Photographing a page', 'Glossary', 'Your data', 'About'])
      assert.ok((await page.textContent('#helpOverlay')).includes(s), s);
    // glossary
    await page.click('#helpGloss > summary');
    await idle(page);
    const terms = await page.evaluate(() =>
      [...document.querySelectorAll('#helpGloss dt')].map((d) => d.textContent),
    );
    // (v308: Flow, Look, Scatter, Rough spots, Mood, Include, Surprise and Colour along added; v318.26: Skin tones)
    // (v318.34: Colours from in the Glossary, before Mood)
    assert.deepEqual(terms, [
      'Section',
      'Background / left out',
      'Plan',
      'Colour pattern',
      'Flow',
      'Matching shapes alike',
      'Look',
      'Scatter',
      'Rough spots',
      'Colours from',
      'Mood',
      'Lean towards',
      'Include',
      'Surprise',
      'Zone',
      'Pin',
      'Kept',
      'Blend companions',
      'Skin tones',
      'Shading',
      'Highlight / Base / Shadow (H/B/S)',
      'Greyscale',
      'Colour along',
      'Focus mode',
      'Reveal',
      'Your page',
    ]);
    // (v318.26: Colour pattern is the fourth, after Plan)
    const pattern = await page.textContent('#helpGloss dd:nth-of-type(4)');
    for (const p of ['Gradient', 'Random', 'Blend', 'Photo', 'Manual']) assert.ok(pattern.includes(p), p);
    assert.ok(await page.isVisible('#helpGloss dt >> text=Focus mode'));
    // photo tips and your data
    await page.click('#helpPhoto > summary');
    await idle(page);
    assert.match(await page.textContent('#helpPhoto'), /flat[\s\S]*even light[\s\S]*straightens/);
    await page.click('#helpData > summary');
    await idle(page);
    const data = await page.textContent('#helpData');
    assert.match(data, /stay on this device/);
    assert.match(data, /no account/);
    assert.match(data, /Home Screen/);
    assert.match(data, /Back up/);
    // About: the version shown on Home, which is the service worker's version
    await page.click('#helpAbout > summary');
    await idle(page);
    const ver = (await page.textContent('#helpVer')).trim();
    assert.equal(ver, (await page.textContent('#appVer')).trim());
    const sw = await readFile(join(ROOT, 'service-worker.js'), 'utf8');
    assert.equal(ver, sw.match(/marker-studio-(v\d+(?:\.\d+)?)/)[1]);
    const about = await page.textContent('#helpAbout');
    assert.ok(about.includes('Nothing you add leaves this device. There are no accounts, ads or analytics.'));
    // (v308: not affiliated, said in full)
    assert.ok(
      about.includes(
        'Ohuhu and Copic are trademarks of their owners. Marker Studio isn’t affiliated with or endorsed by Ohuhu or Copic. Colours on screen are approximate — compare with your own swatches',
      ),
    );
    assert.match(about, /Fraunces[\s\S]*Hanken Grotesk[\s\S]*SIL Open Font License/);
    // (v308: Send feedback and Copy diagnostics, always there)
    assert.equal(await page.evaluate(() => FEEDBACK_EMAIL), '');
    assert.ok((await page.isVisible('#helpFeedback')) && (await page.isVisible('#helpDiag')));
    await shot(page, 'help-about');
    await page.click('#helpClose');
    await idle(page);
    assert.equal(await on(page, 'helpOverlay'), false, '✕ closes');
    // from Home, by keyboard
    await page.click('#mHome');
    await idle(page);
    assert.ok((await page.isVisible('#homeHelp')) && (await page.isVisible('#homeHiw')));
    await page.focus('#homeHelp');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(await on(page, 'helpOverlay'), 'opens from Home with Enter');
    assert.ok(
      await page.evaluate(() => document.getElementById('helpOverlay').contains(document.activeElement)),
      'focus moves into the sheet',
    );
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    assert.ok(
      await page.evaluate(() => document.getElementById('helpOverlay').contains(document.activeElement)),
      'Tab stays in the sheet',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await on(page, 'helpOverlay'), false, 'Escape closes');
    assert.equal(await activeId(page), 'homeHelp', 'focus returns to the Help link');
    // How it works from Home, by keyboard; a tap on the backdrop closes it
    await page.focus('#homeHiw');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(await on(page, 'hiwOverlay'));
    await idle(page);
    assert.equal(await activeId(page), 'hiwNext', 'focus on Next');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('#hiwDots .hiwdot')].findIndex((d) => d.classList.contains('on')),
      ),
      2,
      'the dots are buttons: Shift+Tab to the last one, Enter',
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
      'Step 3: Colour along',
    );
    await page.mouse.click(5, 5);
    await idle(page);
    assert.equal(await on(page, 'hiwOverlay'), false, 'tapping outside closes');
    assert.deepEqual(errors, []);
  });
  // (v318.32: one line, "Updated to v318.32 · What’s new", in place of the card of items; the items are in Help › What’s new)
  test('What’s new: shown after an update, not on a fresh install, and stays dismissed', async () => {
    // fresh install: nothing shown, the version is just remembered
    {
      const { ctx, page, errors } = await openApp();
      await withAutoHelp(ctx, page);
      assert.ok(await page.isVisible('#welcome'));
      assert.equal(await page.$('#whatsNew'), null, 'nothing on a fresh install');
      const ver = (await page.textContent('#appVer')).trim();
      assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
      await welcome(page, 'look');
      await page.click('#mHome');
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null);
      await page.reload();
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null, 'nor on the next launch');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // an update from an older version
    {
      const { ctx, page, errors } = await openApp({
        storage: { 'ms-onboarded': '1', 'ms-last-ver': 'v200' },
      });
      assert.equal(await page.$('#whatsNew'), null, 'not under the test seam by default');
      await withAutoHelp(ctx, page);
      const ver = (await page.textContent('#appVer')).trim();
      assert.ok(await page.isVisible('#whatsNew'), 'shown on Home');
      assert.equal((await page.textContent('#wnTitle')).trim(), `Updated to ${ver}`);
      assert.equal(await page.$('#whatsNew li'), null, 'a line, not the card (v318.32)');
      assert.equal((await page.textContent('#wnOpen')).trim(), 'What’s new');
      assert.equal(await page.getAttribute('#wnClose', 'aria-label'), 'Dismiss what’s new');
      await shot(page, 'help-whatsnew');
      await page.reload();
      await idle(page);
      assert.ok(await page.isVisible('#whatsNew'), 'still there until dismissed');
      await page.click('#wnClose');
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null, 'dismissed');
      assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
      await page.reload();
      await idle(page);
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
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    assert.equal(await on(page, 'savedOverlay'), true, 'the Library is still open');
    assert.equal(await on(page, 'hiwOverlay'), false, 'not over the Library');
    assert.deepEqual(errors, []);
  });
  test('What’s new: counts as shown only once on screen, goes by itself after 7 days, and is always in Help › What’s new', async () => {
    // due, but the app opens on Markers: made, not yet shown
    const { ctx, page, errors } = await openApp({
      init: autoHelpInit,
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }), 'ms-last-ver': 'v200' }),
    });
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-wn-shown')), null, 'not on screen yet');
    await page.click('#mHome');
    await idle(page);
    assert.ok(await shown(page, 'whatsNew'));
    const ver = (await page.textContent('#appVer')).trim();
    const t0 = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')).t);
    assert.ok(Math.abs(t0 - Date.now()) < 60000);
    // shown again on the next launch: the first time is kept
    await page.reload();
    await idle(page);
    assert.ok(await shown(page, 'whatsNew'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')).t), t0);
    // six days on: still there
    await page.evaluate(
      (v) => localStorage.setItem('ms-wn-shown', JSON.stringify({ v, t: Date.now() - 6 * 864e5 })),
      ver,
    );
    await page.reload();
    await idle(page);
    assert.ok(await shown(page, 'whatsNew'), 'day 6');
    // a week on: gone for good, as if dismissed
    await page.evaluate(
      (v) => localStorage.setItem('ms-wn-shown', JSON.stringify({ v, t: Date.now() - 7 * 864e5 - 1000 })),
      ver,
    );
    await page.reload();
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'day 7');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
    // a time kept for an older version doesn't count for this one
    await page.evaluate(() => {
      localStorage.setItem('ms-last-ver', 'v200');
      localStorage.setItem('ms-wn-shown', JSON.stringify({ v: 'v200', t: 1 }));
    });
    await page.reload();
    await idle(page);
    assert.ok(await shown(page, 'whatsNew'), 'an older version’s time is not this one’s');

    // Help › What's new lists the items, any time (v318.32: its own section; it had been in About)
    await page.click('#wnClose');
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpNews > summary');
    await page.waitForSelector('#helpNews .hlpwnt', { state: 'visible' });
    // (v308: this version's items only, each tagged with its version)
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), `What’s new in ${ver}`);
    const items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
    assert.deepEqual(
      items,
      await page.evaluate((v) => WHATS_NEW.filter((x) => x.v === v).map((x) => x.t), ver),
    );
    assert.ok(items.length >= 1);
    assert.ok(await page.isVisible('#helpWnList'));
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('Help › Keyboard and screen readers: what needs touch or a mouse, what works by keyboard, Shift+F10', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
    // (v308: the beta tester guide first)
    // (v318.32: What's new second, its own section, after the beta tester guide, which v308 put first)
    assert.deepEqual(secs, [
      'Beta tester guide',
      'What’s new',
      'Photographing a page',
      'Adding markers by code',
      'More you can do',
      'If something goes wrong',
      'Glossary',
      'Keyboard and screen readers',
      'Your data',
      'About',
    ]);
    await page.click('#helpKeys > summary');
    await page.waitForSelector('#helpKeys .hlpbody', { state: 'visible' });
    const t = await page.textContent('#helpKeys .hlpbody');
    assert.match(
      t,
      /needs touch or a mouse: Change colour, Pin, Leave white, Paint and ticking off one section/,
    );
    assert.match(
      t,
      /By keyboard, use Colour along’s list instead: open a marker, then Mark all coloured or Find next\. Focus mode and everything else work by keyboard too\./,
    );
    assert.match(t, /In Markers, press Shift\+F10 on a marker to open its details\./);
    await snap(page, 'help-keyboard');
    assert.deepEqual(errors, []);
  });
}

// ---- from wording.test.mjs ----
// Wording across the app: one word per idea, and small wording fixes (Help, What's new, the blend plan legend, the
// Library's caption, labels).
{
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  // ---- From UX release 1 (v260) ----
  test('one word per idea', async () => {
    const { page, errors } = await openApp();
    assert.equal(await page.textContent('#wcAdd'), 'Tick a set above');
    await haveSet(page);
    await page.check('#wcSets input[data-i="0"]');
    assert.equal(await page.textContent('#wcAdd'), 'Add 24 markers');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await page.click('.sftabbtn[data-t="share"]');
    assert.equal((await page.textContent('#sfPrint')).trim(), 'Print…');
    assert.equal((await page.textContent('#sfExport')).trim(), 'Save image');
    assert.match(await page.textContent('#sfBack2'), /Edit sections/);
    await page.click('#sfPrint');
    assert.equal(await page.textContent('#sfPDF'), 'Download PDF');
    const ord = await page.evaluate(() =>
      [...document.querySelectorAll('#sfSheet *')].map((e) => e.id || e.className),
    );
    const pi = ord.findIndex((c) => /\bsfpaper\b/.test(c));
    assert.ok(pi >= 0 && pi < ord.indexOf('sfPDF'), 'paper size before Download PDF');
    await page.keyboard.press('Escape');
    // on a phone that can share files the PDF goes to the share sheet, so the button says Save (as on the swatch chart);
    // a computer downloads it even where the browser could share it
    await page.evaluate(() => {
      window.__cs = navigator.canShare;
      window.__sh = navigator.share;
      navigator.canShare = (d) => !!(d && d.files && d.files.length);
      navigator.share = () => Promise.resolve();
    });
    await page.click('#sfPrint');
    assert.equal(await page.textContent('#sfPDF'), 'Download PDF');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.__sf = shareFirst;
      shareFirst = () => true;
    });
    await page.click('#sfPrint');
    assert.equal(await page.textContent('#sfPDF'), 'Save PDF');
    await page.keyboard.press('Escape');
    // (v318 review) on an iPhone or iPad the share sheet has Print too, and the sheet came from Print…: it says both;
    // the swatch chart's button the same
    await page.evaluate(() => {
      window.__io = isIOSDevice;
      isIOSDevice = () => true;
    });
    await page.click('#sfPrint');
    assert.equal(await page.textContent('#sfPDF'), 'Print or save PDF');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => swGoLabel()), 'Print or save PDF');
    await page.evaluate(() => {
      isIOSDevice = window.__io;
    });
    await page.evaluate(() => {
      navigator.canShare = window.__cs;
      navigator.share = window.__sh;
      shareFirst = window.__sf;
    });
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfColor');
    await idle(page);
    assert.equal((await page.textContent('#sfDoneBtn')).trim(), 'Plan');
    assert.match(await page.textContent('#sfAlist .sfarow .cnt'), /^0 of \d+ coloured$/);
    assert.equal(await page.textContent('#exportBtn'), 'Save image');
    assert.deepEqual(errors, []);
  });
  test('wording: Help is Help, What’s new has no "….", the iOS card in Chrome doesn’t say Safari', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    assert.equal(await page.textContent('#homeHelp'), 'Help');
    // (v308: each entry is { v, t })
    assert.equal(await page.evaluate(() => WHATS_NEW.some((x) => x.t.includes('….'))), false);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('appVer')).opacity), '1');
    await page.click('#mSections');
    await idle(page);
    assert.equal(await page.getAttribute('#sfHelpQ0', 'aria-label'), 'Help');
    const CRIOS =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
    const ios = await openApp({
      userAgent: CRIOS,
      init: () => {
        Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
      },
      storage: onboarded({ [KEY]: appState() }),
    });
    await ios.page.waitForSelector('#installCard', { state: 'visible' });
    const t = await ios.page.textContent('#installCard');
    assert.doesNotMatch(t, /in Safari/);
    assert.match(t, /Share menu/);
    assert.deepEqual([...errors, ...ios.errors], []);
  });
  test('small wording: blend plan legend, Library caption and empty list, seed search label, toast Undo outline', async () => {
    const g = { id: 3000, type: 'guide', name: 'G', keys: ['Ohuhu|R014'], ts: 3000, n: 4, W: 10, H: 10 };
    const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState({ saved: [g] }) }) });
    assert.match(
      await page.textContent('#sfPlanOverlay .dsub'),
      /Amber outline: a marker you don’t own yet\./,
    );
    await page.click('#homeLibCard');
    assert.equal(await page.textContent('#libStat'), 'Not backed up yet (1 guide)');
    await page.evaluate(() => {
      state.saved = [];
      renderSaved();
    });
    assert.equal(
      await page.textContent('#savedList .empty'),
      // (v320: under the sample's two pages and "Your guides will live here")
      'Every guide you make is kept on this device, with how far you’ve coloured it. A palette is kept with Save.',
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.getAttribute('#seedSearch', 'aria-label'), 'Search markers');
    await page.evaluate(() => toastAction('Deleted', 'Undo', () => {}));
    const border = await page.evaluate(
      () => getComputedStyle(document.querySelector('#msToast .sflink')).borderTopColor,
    );
    const [r, gg, b] = border.match(/[\d.]+/g).map(Number);
    assert.ok(r + gg + b < 600, 'a dark outline on the light toast: ' + border);
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-beta.test.mjs ----
// v308 (beta branch): Send feedback (Home's foot, the guide's ⋯ menu, beside an error, Help › About), caught errors with
// friendly words, Copy details and a record that outlives a reload (Copy diagnostics), What's new by version, the Beta
// label and the one-time thanks, the tester guide in Help, Delete all my data, the welcome's privacy line, and
// Scatter's Polished line.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    [KEY]: appState(),
    ...extra,
  });
  const IPAD = { width: 820, height: 1180 };
  // the share sheet and the clipboard, recorded
  const spy = () => {
    window.__shared = [];
    window.__copied = [];
    navigator.share = (o) => (window.__shared.push(o), Promise.resolve());
    try {
      navigator.clipboard.writeText = (t) => (window.__copied.push(t), Promise.resolve());
    } catch (_) {}
  };
  const shared = (page) => page.evaluate(() => window.__shared);
  const copied = (page) => page.evaluate(() => window.__copied);
  const after_ = (page, sel) =>
    page.evaluate((s) => getComputedStyle(document.querySelector(s), '::after').content, sel);
  test('Send feedback from Home’s foot: the share sheet with the version, device, Home Screen, screen and counts', async () => {
    const { page, errors } = await openApp({ ...IPAD, storage: onboarded(), init: spy });
    await idle(page);
    const ver = (await page.textContent('#appVer')).trim();
    assert.match(ver, /^v\d+(\.\d+)?$/, 'the version itself is unchanged');
    assert.equal(await after_(page, '#appVer'), '" · Beta"');
    // (v312: Tester tasks on a line of its own under them)
    const links = await page.$$eval('.homehelp button', (b) => b.map((x) => x.textContent));
    assert.deepEqual(links, ['How it works', 'Help', 'Send feedback', 'Tester tasks · 0 of 6']);
    await page.click('#homeFeedback');
    await until(page, () => window.__shared.length === 1, null, 'shared');
    const [s] = await shared(page);
    assert.equal(s.title, `Marker Studio ${ver} · Beta feedback`);
    for (const w of [
      `Marker Studio ${ver} · Beta`,
      'Device: ',
      'Home Screen app: no',
      'Screen: ',
      'window 820×1180',
      'Saved here: 3 markers, 0 guides, 0 palettes',
      'No errors recorded.',
    ])
      assert.ok(s.text.includes(w), w);
    // no share sheet (a computer's Chrome): copied, and said so
    await page.evaluate(() => {
      delete Navigator.prototype.share;
      navigator.share = undefined;
    });
    await page.click('#homeFeedback');
    await until(page, () => window.__copied.length === 1, null, 'copied');
    assert.equal((await copied(page))[0], s.text);
    await page.waitForSelector('#msToast.on');
    assert.match(await page.textContent('#msToast'), /^Report copied — paste it into your feedback message/);
    assert.deepEqual(errors, []);
  });
  test('a guide that can’t open: friendly words, Copy details and Send feedback; the record outlives a reload (Copy diagnostics)', async () => {
    const { page, errors } = await openApp({ ...IPAD, storage: onboarded(), init: spy });
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await saveGuide(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    // the stored copy can't be read: Safari's words for it
    await page.evaluate((id) => {
      SF.configure({
        loadDesign: () => Promise.reject(new TypeError("null is not an object (evaluating 'd.assign')")),
      });
      state.saved.push(
        Object.assign(
          {},
          state.saved.find((s) => s.id === id),
          { id: id + 1, name: 'Other' },
        ),
      );
      SF.openDesign(id + 1);
    }, id);
    await page.waitForFunction(() =>
      /Couldn’t open that guide\./.test(
        (document.querySelector('.mserr') || document.getElementById('msToast') || {}).textContent,
      ),
    );
    const box = await page.evaluate(() => {
      const c = document.querySelector('.mserr') || document.getElementById('msToast');
      return {
        t: c.textContent,
        b: [...c.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean),
      };
    });
    assert.ok(!box.t.includes('null is not'), 'not the engine’s words: ' + box.t);
    assert.ok(box.b.includes('Copy details') && box.b.includes('Send feedback'), String(box.b));
    // the meta line under the start card repeats the words without the buttons
    assert.equal(
      await page.evaluate(
        () =>
          [...document.querySelectorAll('.sfmeta .errbtns')].filter((e) => e.getClientRects().length).length,
      ),
      0,
    );
    await page.click('.mserr [data-errcopy], #msToast [data-errcopy]');
    await until(page, () => window.__copied.length === 1, null, 'copied');
    const d = (await copied(page))[0];
    assert.match(d, /· Opening a guide\nnull is not an object \(evaluating 'd\.assign'\)/);
    assert.match(
      d,
      /\nDevice: [^\n]+\nHome Screen app: no\nScreen: \d+×\d+, window 820×1180, 2× pixels, touch points \d+\n/,
    );
    // Send feedback beside it: the error is in the report
    await page.evaluate(() => {
      const c = document.querySelector('.mserr [data-feedback], #msToast [data-feedback]');
      c.click();
    });
    await until(page, () => window.__shared.length === 1, null, 'shared');
    assert.match(
      (await shared(page))[0].text,
      /Last errors:\n- \d{4}-\d\d-\d\d \d\d:\d\d · Opening a guide: null is not an object/,
    );
    // after a reload: Help › About › Copy diagnostics still has it
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpAbout > summary');
    await page.click('#helpDiag');
    await until(page, () => window.__copied.length === 1, null, 'copied after the reload');
    assert.match((await copied(page))[0], /Opening a guide\nnull is not an object/);
    await page.waitForSelector('#msToast.on');
    assert.match(await page.textContent('#msToast'), /^Diagnostics copied/);
    assert.deepEqual(errors, []);
  });
  test('the guide’s ⋯ menu has Send feedback, under Help', async () => {
    const { page, errors } = await openApp({ ...IPAD, init: spy });
    await sampleGuide(page);
    await idle(page);
    await openMenu(page);
    const items = await page.$$eval('#sfSheet [role="group"]:last-of-type .sfmitem', (b) =>
      b.map((x) => x.textContent),
    );
    assert.deepEqual(items, ['Help', 'Send feedback']);
    await page.click('#sfSheet .sfmitem:text-is("Send feedback")');
    await until(page, () => window.__shared.length === 1, null, 'shared');
    assert.match((await shared(page))[0].text, /Saved here: \d+ markers/);
    assert.deepEqual(errors, []);
  });
  test('an unexpected error: Send feedback beside Copy details', async () => {
    const { page } = await openApp({ storage: onboarded(), init: spy });
    await page.evaluate(() => {
      const o = state.owned;
      state.owned = null;
      setTimeout(backupDue, 0);
      setTimeout(() => {
        state.owned = o;
      }, 50);
    });
    await page.waitForSelector('#msToast.on #errCopy');
    assert.deepEqual(await page.$$eval('#msToast button', (b) => b.map((x) => x.textContent)), [
      'Copy details',
      'Send feedback',
    ]);
    await page.click('#msToast [data-feedback]');
    await until(page, () => window.__shared.length === 1, null, 'shared');
    assert.match((await shared(page))[0].text, /Last errors:\n- [^\n]*null/);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-errors')).length >= 1), 'kept');
  });
  // (v318.32: the Home card of items is one line, "Updated to vX · What’s new"; the items are in Help › What’s new, its own section)
  test('What’s new shows after an update (the line on Home); Help › What’s new lists this version’s', async () => {
    const { ctx, page, errors } = await openApp({
      ...IPAD,
      init: () => {
        window.__MS_HELP_AUTO = true;
      },
      storage: onboarded({ 'ms-last-ver': 'v306' }),
    });
    await idle(page);
    const ver = (await page.textContent('#appVer')).trim();
    const wn = await page.evaluate(() => WHATS_NEW);
    const num = (v) => {
      const m = /^v(\d+)(?:\.(\d+))?/.exec(v);
      return +m[1] + (+m[2] || 0) / 1000;
    };
    const want = wn
      .filter((x) => num(x.v) > 306 && num(x.v) <= num(ver))
      .slice(0, 4)
      .map((x) => x.t);
    assert.ok(want.length >= 1);
    assert.ok(await page.isVisible('#whatsNew'));
    assert.equal((await page.textContent('#wnTitle')).trim(), 'Updated to ' + ver);
    assert.equal(await page.$('#whatsNew li'), null, 'a line, not the items');
    // every entry has its version
    assert.ok(
      wn.every((x) => /^v\d+(\.\d+)?$/.test(x.v) && x.t),
      'tagged',
    );
    // Help › What's new: this version's (or the newest that has any)
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpNews > summary');
    await page.click('#helpAbout > summary');
    const top = wn.find((x) => num(x.v) <= num(ver)).v;
    assert.equal((await page.textContent('#helpWnVer')).trim(), top);
    assert.deepEqual(
      await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent)),
      wn.filter((x) => x.v === top).map((x) => x.t),
    );
    assert.equal(await after_(page, '#helpVer'), '" · Beta"');
    const about = await page.textContent('#helpAbout');
    assert.ok(about.includes('Marker Studio isn’t affiliated with or endorsed by Ohuhu or Copic.'));
    assert.ok(
      about.includes(
        'It works offline, and the camera is used only when you scan or photograph caps or Match a colour, and photos of caps are read on this device.',
      ),
    );
    assert.ok(about.includes('Icons: Lucide (ISC License), some from Feather (MIT License).'));
    assert.ok((await page.isVisible('#helpFeedback')) && (await page.isVisible('#helpDiag')));
    await page.click('#helpClose');
    // seen this version already: nothing
    await page.evaluate((v) => localStorage.setItem('ms-last-ver', v), ver);
    await page.reload();
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null);
    // from long ago: the line again (v318.32: it had listed the four newest)
    await page.evaluate(() => {
      localStorage.setItem('ms-last-ver', 'v200');
      localStorage.removeItem('ms-wn-shown');
    });
    await page.reload();
    await idle(page);
    assert.ok(await page.isVisible('#whatsNew'));
    assert.equal((await page.textContent('#wnTitle')).trim(), 'Updated to ' + ver);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('Thanks for testing: once, before What’s new; its Tester guide opens Help’s guide', async () => {
    const { page, errors } = await openApp({
      ...IPAD,
      init: () => {
        window.__MS_HELP_AUTO = true;
        window.__MS_THANKS_AUTO = true;
      },
      storage: onboarded({ 'ms-last-ver': 'v200' }),
    });
    await idle(page);
    assert.ok(await page.isVisible('#betaThanks'));
    assert.equal((await page.textContent('#btTitle')).trim(), 'Thanks for testing Marker Studio');
    assert.equal(await page.$('#whatsNew'), null, 'What’s new waits');
    await page.reload();
    await idle(page);
    assert.ok(await page.isVisible('#betaThanks'), 'until dismissed');
    await page.click('#btClose');
    await idle(page);
    assert.equal(await page.$('#betaThanks'), null);
    assert.ok(await page.isVisible('#whatsNew'), 'then What’s new');
    await page.reload();
    await idle(page);
    assert.equal(await page.$('#betaThanks'), null, 'once');
    // Tester guide: Help opens on the beta guide
    await page.evaluate(() => localStorage.removeItem('ms-beta-thanks'));
    await page.reload();
    await idle(page);
    await page.click('#btGuide');
    await page.waitForSelector('#helpOverlay.on');
    assert.equal(await page.evaluate(() => document.getElementById('helpBeta').open), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-beta-thanks')), '1');
    assert.deepEqual(errors, []);
  });
  test('Help: the beta tester guide first, the new glossary entries, “phone or iPad”, Library › Restore', async () => {
    const { page, errors } = await openApp({ ...IPAD, storage: onboarded() });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
    assert.deepEqual(secs, [
      'Beta tester guide',
      'What’s new', // (v318.32: its own section, second)
      'Photographing a page',
      'Adding markers by code',
      'More you can do',
      'If something goes wrong',
      'Glossary',
      'Keyboard and screen readers',
      'Your data',
      'About',
    ]);
    await page.click('#helpBeta > summary');
    const g = await page.textContent('#helpBeta');
    for (const w of [
      'Add to Home Screen',
      'before you set up your markers',
      'Back up once a week',
      'Ohuhu and Copic markers only',
      'approximate',
      'screenshot the page',
      'Known limits',
      'What to try',
      'Send feedback',
      'Copy details',
    ])
      assert.ok(g.includes(w), w);
    await page.click('#helpGloss > summary');
    const terms = await page.$$eval('#helpGloss dt', (d) => d.map((x) => x.textContent));
    for (const t of ['Flow', 'Look', 'Scatter', 'Rough spots', 'Mood', 'Include', 'Surprise', 'Colour along'])
      assert.ok(terms.includes(t), t);
    await page.click('#helpPhoto > summary');
    const ph = await page.textContent('#helpPhoto');
    assert.ok(
      // (v313: a PDF opens with Open the PDF, no longer by a screenshot)
      ph.includes('Hold your phone or iPad right above the page') && ph.includes('opens with Open the PDF'),
    );
    await page.click('#helpData > summary');
    assert.ok((await page.textContent('#helpData')).includes('Library › Restore brings it back'));
    assert.deepEqual(errors, []);
  });
  test('Delete all my data: a backup first, DELETE typed, then everything of this app is gone (other sites’ keys stay)', async () => {
    const { page, errors } = await openApp({ ...IPAD, storage: onboarded({ 'other-site': 'keep' }) });
    // a guide in the Library, its picture stored in the database
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await saveGuide(page);
    await page.evaluate(() => setMode('home'));
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved.length), 1);
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await page.click('#helpWipe');
    await page.waitForSelector('#sfEdAsk');
    assert.equal((await page.textContent('#sfEdAskT')).trim(), 'Delete all your data?');
    assert.ok(await page.isDisabled('#wipeGo'), 'not until DELETE is typed');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Back up first');
    assert.match(
      await page.textContent('#sfEdAskD'),
      /^This deletes your markers, palettes, guides and their photos from this device\. It can’t be undone\. Back up first/,
    );
    // Back up first: the backup, then the question again
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfEdAsk [data-a="backup"]')]);
    assert.match(dl.suggestedFilename(), /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAskD'), /^Your backup is made\./);
    await page.fill('#wipeWord', 'delet');
    assert.ok(await page.isDisabled('#wipeGo'));
    await page.fill('#wipeWord', 'delete');
    assert.equal(await page.isDisabled('#wipeGo'), false);
    await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
    await idle(page);
    assert.ok(await page.isVisible('#welcome'), 'back to the welcome');
    const st = await page.evaluate(() => ({
      other: localStorage.getItem('other-site'),
      owned: state.owned.size,
      saved: state.saved.length,
      keys: Object.keys(localStorage),
    }));
    assert.equal(st.other, 'keep');
    assert.equal(st.owned, 0);
    assert.equal(st.saved, 0);
    assert.ok(!st.keys.includes('ms-onboarded') && !st.keys.includes('ms-errors'), String(st.keys));
    const left = await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ms-guides', 1);
          r.onupgradeneeded = () => {};
          r.onsuccess = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains('g')) {
              d.close();
              res(0);
              return;
            }
            const t = d.transaction('g').objectStore('g').count();
            t.onsuccess = () => {
              d.close();
              res(t.result);
            };
          };
          r.onerror = () => res(-1);
        }),
    );
    assert.equal(left, 0, 'no guides stored');
    assert.deepEqual(errors, []);
  });
  test('Delete all my data: Cancel and Escape change nothing', async () => {
    const { page, errors } = await openApp({ storage: onboarded() });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await page.click('#helpWipe');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="stay"]');
    assert.equal(await page.$('#sfEdAsk'), null);
    await page.click('#helpWipe');
    await page.waitForSelector('#sfEdAsk');
    await page.fill('#wipeWord', 'DELETE');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await page.evaluate(() => state.owned.size), 3);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1');
    assert.deepEqual(errors, []);
  });
  test('the welcome says it works offline and what the camera is for', async () => {
    const { page, errors } = await openApp(IPAD);
    assert.ok(await page.isVisible('#welcome'));
    assert.equal(
      (await page.textContent('.wcpriv')).trim(),
      'Works offline. Nothing you add leaves this device; the camera is used only to scan or photograph caps, or to Match a colour.',
    );
    assert.ok(await page.isVisible('.wcpriv'));
    assert.deepEqual(errors, []);
  });
  test('Scatter at Polished has its line', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
    assert.ok(await page.isVisible('#sfGradScatNote'));
    assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
    // and back to it from another stop
    await page.evaluate(() => {
      const el = document.getElementById('sfGradScat');
      el.value = '1';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.ok(await page.isVisible('#sfGradScatNote'));
    assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
    assert.deepEqual(errors, []);
  });
}

// ---- from v312-tester.test.mjs ----
// v312: Tester tasks (tester.js). The ways in (Home's foot, the thanks card, Help's tester guide); answers kept on the
// device through a reload; Send results posting the answers to the Google Form, by field, and saying so (offline:
// kept, and said); no form: copied instead; Send feedback's own dialog posting to the same form, or sharing; tap areas
// and no sideways scroll on a small phone at a large text size.
{
  // a pre-filled link as docs/tester-form-setup.gs logs it: the form's 27 fields, entry.1000 to entry.1026
  const FIELDS = [
    'Kind',
    'Tester',
    'Name',
    'Send',
    'Version',
    'Device',
    'App or tab',
    'Markers',
    'Use so far',
    '1 Add your markers',
    '1 Note',
    '2 Make a guide',
    '2 Note',
    '3 Make the plan yours',
    '3 Note',
    '4 Colour along',
    '4 Note',
    '5 Come back to it',
    '5 Note',
    '6 Share or print',
    '6 Note',
    'Extras',
    'Confused most',
    'Change first',
    'Colours matched',
    'Next page',
    'Message',
  ];
  const FORM =
    'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
    FIELDS.map((_, i) => 'entry.' + (1000 + i) + '=x').join('&');
  const withForm = (more = '') => `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};` + more;
  // the clipboard and share sheet, recorded (Chromium under test has neither to hand)
  const STUBS = `window.__copied = []; window.__shared = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  navigator.share = (o) => { window.__shared.push(o); return Promise.resolve(); };`;
  const NO_SHARE = `window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  delete Navigator.prototype.share;`;
  // what the form got: {field: value}, one object per post
  function catchPosts(page, fail = false) {
    const posts = [];
    return page
      .route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
        if (fail) return r.abort();
        const q = new URLSearchParams(r.request().postData() || ''),
          o = {};
        FIELDS.forEach((f, i) => (o[f] = q.get('entry.' + (1000 + i))));
        posts.push(o);
        return r.fulfill({ status: 200, body: 'ok' });
      })
      .then(() => posts);
  }
  async function ready(o = {}) {
    const a = await openApp({ width: 820, height: 1180, ...o });
    await welcome(a.page, 'look');
    await idle(a.page);
    return a;
  }
  const said = (page) => page.textContent('#ttSaid');
  const foot = (page) => page.textContent('#homeTasks');
  const rate = (page, k, r) => page.click(`.ttrow[data-k="${k}"] [data-r="${r}"]`);
  const openRow = (page, k) => page.click(`.ttrow[data-k="${k}"] .tttop`);
  test('the ways in: Home’s foot counts, the thanks card and Help’s tester guide open it; Escape closes it, back where it was', async () => {
    const { page, errors } = await ready({ init: 'window.__MS_THANKS_AUTO = 1;' });
    assert.equal(await foot(page), 'Tester tasks · 0 of 6');
    await page.click('#homeTasks');
    await idle(page);
    assert.ok(await page.isVisible('#ttOverlay'));
    assert.equal(await page.textContent('#ttCount'), '0 of 6 answered');
    // the first one to answer is open
    assert.equal(await page.getAttribute('#ttTop-add', 'aria-expanded'), 'true');
    assert.equal(await page.isVisible('#ttBody-guide'), false);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.isVisible('#ttOverlay'), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'homeTasks');
    // the thanks card's, which then goes (the foot keeps the way in)
    await page.click('#btTasks');
    await idle(page);
    assert.ok(await page.isVisible('#ttOverlay'));
    await page.click('#ttClose');
    assert.equal(await page.isVisible('#betaThanks'), false);
    // Help › Beta tester guide
    await page.evaluate(() => window.openHelpSheet());
    await page.evaluate(() => (document.getElementById('helpBeta').open = true));
    await page.click('#helpTasks');
    await idle(page);
    assert.ok(await page.isVisible('#ttOverlay'));
    assert.deepEqual(errors, []);
  });
  test('answers: a rating answers a task (tapped again, taken back), notes and questions kept through a reload; all six: "ready to send"', async () => {
    const { page, errors } = await ready();
    await page.click('#homeTasks');
    await rate(page, 'add', 'easy');
    assert.equal(await page.textContent('#ttCount'), '1 of 6 answered');
    assert.equal(await page.textContent('.ttrow[data-k="add"] .ttchip'), 'Easy');
    assert.equal(await page.getAttribute('.ttrow[data-k="add"] [data-r="easy"]', 'aria-pressed'), 'true');
    // tapped again: taken back
    await rate(page, 'add', 'easy');
    assert.equal(await page.textContent('#ttCount'), '0 of 6 answered');
    await rate(page, 'add', 'ok');
    await page.fill('.ttrow[data-k="add"] .ttnote', 'Found my set straight away.');
    await openRow(page, 'match');
    await rate(page, 'match', 'hard');
    await page.fill('[data-q="confused"]', 'The Shading tab.');
    await page.click('[data-next="maybe"]');
    await page.fill('#ttName', 'Sam');
    await page.keyboard.press('Escape');
    assert.equal(await foot(page), 'Tester tasks · 1 of 6', 'the extras don’t count');
    // (the tasks' history entry taken back first: Escape's history.go(-1), on the next frame, had been under way as the
    // reload began, which the browser then gave up on — net::ERR_ABORTED on GitHub, v318's run)
    await idle(page);
    await page.waitForFunction(() => !(history.state && history.state.msLayer));
    await page.reload();
    await idle(page);
    await page.click('#homeTasks');
    await openRow(page, 'add');
    assert.equal(await page.inputValue('.ttrow[data-k="add"] .ttnote'), 'Found my set straight away.');
    assert.equal(await page.inputValue('[data-q="confused"]'), 'The Shading tab.');
    assert.equal(await page.getAttribute('[data-next="maybe"]', 'aria-pressed'), 'true');
    assert.equal(await page.inputValue('#ttName'), 'Sam');
    for (const k of ['guide', 'plan', 'along', 'back', 'share']) {
      await openRow(page, k);
      await rate(page, k, k === 'along' ? 'skip' : 'easy');
    }
    assert.equal(
      await page.textContent('.ttrow[data-k="along"] .ttn'),
      '–',
      'Didn’t try: answered, not ticked',
    );
    await page.keyboard.press('Escape');
    assert.equal(await foot(page), 'Tester tasks · ready to send');
    assert.deepEqual(errors, []);
  });
  test('Send results posts each answer to its field, says so, and a second send is marked an update', async () => {
    const { page, errors } = await ready({ init: withForm() });
    const posts = await catchPosts(page);
    await page.click('#homeTasks');
    await rate(page, 'add', 'easy');
    await openRow(page, 'plan');
    await rate(page, 'plan', 'hard');
    await page.fill('.ttrow[data-k="plan"] .ttnote', 'Couldn’t find the marker count.');
    await openRow(page, 'low');
    await rate(page, 'low', 'ok');
    await page.click('[data-next="yes"]');
    await page.fill('#ttName', 'Sam');
    assert.match(await page.textContent('#ttWhat'), /nothing until you tap it/);
    await page.click('#ttSend');
    await page.waitForFunction(() => /^Sent/.test(document.getElementById('ttSaid').textContent));
    assert.equal(posts.length, 1);
    const p = posts[0];
    assert.equal(p.Kind, 'Results');
    assert.match(p.Tester, /^T[0-9A-Z]{6}$/);
    assert.equal(p.Name, 'Sam');
    assert.equal(p.Send, '1');
    assert.match(p.Version, /^v\d+(\.\d+)? · Beta$/);
    assert.equal(p['App or tab'], 'browser tab');
    assert.match(p.Markers, /^Ohuhu \d+/);
    assert.equal(p['1 Add your markers'], 'Easy');
    assert.equal(p['3 Make the plan yours'], 'Hard');
    assert.equal(p['3 Note'], 'Couldn’t find the marker count.');
    assert.equal(p['2 Make a guide'], 'not yet');
    assert.equal(p.Extras, 'Running low and To buy: OK');
    assert.equal(p['Next page'], 'Yes');
    assert.equal(p.Message, '');
    await page.keyboard.press('Escape');
    assert.equal(await foot(page), 'Tester tasks · sent');
    // a change, then sent again from the top: the same tester, an update
    await page.click('#homeTasks');
    assert.match(await said(page), /Sent\. Thank you/);
    await openRow(page, 'guide');
    await rate(page, 'guide', 'ok');
    await page.click('#ttSendTop');
    await page.waitForFunction(() => document.getElementById('ttSaid').textContent.startsWith('Sent'));
    assert.equal(posts.length, 2);
    assert.equal(posts[1].Send, '2 (an update)');
    assert.equal(posts[1].Tester, p.Tester);
    assert.equal(posts[1]['2 Make a guide'], 'OK');
    assert.deepEqual(errors, []);
  });
  test('offline: nothing lost, said so; Copy my answers copies them', async () => {
    const { page, errors } = await ready({ init: withForm(STUBS) });
    await catchPosts(page, true);
    await page.click('#homeTasks');
    await rate(page, 'add', 'easy');
    await page.click('#ttSend');
    await page.waitForFunction(() => /^Couldn’t send/.test(document.getElementById('ttSaid').textContent));
    assert.match(await said(page), /Your answers are kept here/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')).sends), 0);
    assert.equal(await foot(page), 'Tester tasks · 1 of 6');
    await page.click('#ttCopy');
    await idle(page);
    const c = await page.evaluate(() => window.__copied[0] || '');
    assert.match(c, /^Kind: Results\nTester: T/);
    assert.match(c, /1 Add your markers: Easy/);
    assert.match(await said(page), /^Copied/);
    assert.deepEqual(errors, []);
  });
  test('no form: Send results opens the share sheet with the answers (or copies them, without one)', async () => {
    for (const init of [STUBS, NO_SHARE]) {
      const { page, errors, ctx } = await ready({ init });
      await page.click('#homeTasks');
      await rate(page, 'add', 'hard');
      assert.match(await page.textContent('#ttWhat'), /opens the share sheet/);
      await page.click('#ttSend');
      await idle(page);
      const out = await page.evaluate(
        () => (window.__shared && window.__shared[0] ? window.__shared[0].text : window.__copied[0]) || '',
      );
      assert.match(out, /1 Add your markers: Hard/);
      assert.match(await said(page), init === STUBS ? /^Shared/ : /^Copied/);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Send feedback with a form: its own dialog posts what was written, as Feedback; Share it instead shares it', async () => {
    const { page, errors } = await ready({ init: withForm(STUBS) });
    const posts = await catchPosts(page);
    await page.click('#homeFeedback');
    await idle(page);
    assert.ok(await page.isVisible('#fbOverlay'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fbText');
    await page.click('#fbSend');
    assert.match(await page.textContent('#fbSaid'), /Write a line first/);
    assert.equal(posts.length, 0);
    await page.fill('#fbText', 'The sun jumped when I dragged it.');
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    assert.equal(posts.length, 1);
    assert.equal(posts[0].Kind, 'Feedback');
    assert.match(posts[0].Message, /^The sun jumped when I dragged it\.\n\nNo errors recorded\./);
    assert.equal(posts[0]['1 Add your markers'], '');
    assert.equal(await page.inputValue('#fbText'), '', 'cleared once sent');
    // Share it instead: the share sheet, with what was written first
    await page.click('#homeFeedback');
    await page.fill('#fbText', 'A screenshot of the Plan.');
    await page.click('#fbShare');
    await idle(page);
    assert.equal(await page.isVisible('#fbOverlay'), false);
    assert.match(
      await page.evaluate(() => window.__shared[0].text),
      /^A screenshot of the Plan\.\n\n— Details/,
    );
    assert.deepEqual(errors, []);
  });
  test('Send feedback without a form shares as before; a small phone at 1.6× text: 44px tap areas, nothing sideways', async () => {
    const { page, errors, ctx } = await ready({ init: STUBS });
    await page.click('#homeFeedback');
    await idle(page);
    assert.equal(await page.isVisible('#fbOverlay'), false);
    assert.match(
      await page.evaluate(() => window.__shared[0].text),
      /^What happened, or what would you like\?/,
    );
    await ctx.close();
    const b = await openApp({ width: 320, height: 640 });
    await welcome(b.page, 'look');
    await b.page.evaluate(() => document.documentElement.style.setProperty('--tpx0', '1.6px'));
    await b.page.click('#homeTasks');
    await idle(b.page);
    const r = await b.page.evaluate(() => {
      const card = document.querySelector('#ttOverlay .dcard'),
        small = [];
      // (the ✕ is 36px with a 44px tap area, as every dialog's: e2e/buttons)
      for (const el of card.querySelectorAll('button:not(.mclose), textarea, input')) {
        const h = el.getBoundingClientRect().height;
        if (el.getClientRects().length && h < 40)
          small.push((el.id || el.className || el.tagName) + ' ' + Math.round(h));
      }
      return {
        small,
        side: card.scrollWidth > card.clientWidth + 1,
        page: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.deepEqual(r, { small: [], side: false, page: false });
    assert.deepEqual(errors, []);
    assert.deepEqual(b.errors, []);
  });
  test('the shipped form link (RESULTS_FORM) has every field this version sends: Send feedback posts to it', async () => {
    // (the tests' own "no form" taken away, so the app's link is used; the post is caught here, never sent)
    const { page, errors } = await ready({ init: 'window.__MS_RESULTS_FORM = undefined;' });
    const posts = [];
    await page.route(/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse/, (r) => {
      posts.push({ url: r.request().url(), body: r.request().postData() || '' });
      return r.fulfill({ status: 200, body: 'ok' });
    });
    await page.click('#homeFeedback');
    await idle(page);
    assert.ok(await page.isVisible('#fbOverlay'), 'the form’s dialog, not the share sheet');
    await page.fill('#fbText', 'Checking the form link.');
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    assert.equal(posts.length, 1);
    assert.match(posts[0].url, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
    const q = new URLSearchParams(posts[0].body);
    assert.equal([...q.keys()].filter((k) => /^entry\.\d+$/.test(k)).length, FIELDS.length);
    assert.ok([...q.values()].includes('Feedback'));
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  // Tester tasks' Send results with nothing answered says so and sends nothing. Fails on v318 as released (it shared six
  // "not yet"s).
  test('Send results with nothing answered sends nothing and says why', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
      init: () => {
        window.__shared = [];
        Object.defineProperty(navigator, 'share', {
          value: (d) => (window.__shared.push(d), Promise.resolve()),
          configurable: true,
        });
      },
    });
    await idle(page);
    await page.click('#homeTasks');
    await idle(page);
    await page.click('#ttSendTop');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__shared.length), 0);
    assert.match(await page.textContent('#ttSaid'), /^Nothing to send yet/);
    await page.click('.ttrow[data-k="add"] [data-r="ok"]');
    await idle(page);
    await page.click('#ttSend');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__shared.length), 1);
    assert.match(await page.textContent('#ttSaid'), /^Shared/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31823.test.mjs ----
// v318.23 in the browser: a new version's notice stays until it's used; a Library with a curly quote in a name still
// has the app's whole storage; the ink found in steps, a step per blur pass, as in one go; Copy diagnostics lists the
// longest waits; a guide's newer-version settings kept by its autosave.
{
  // ---- a new version is ready ----
  // (the service worker's controllerchange, as when a new release takes this page over: the first, at install, is
  // skipped, as with an app opened for the first time)
  const updated = (page) =>
    page.evaluate(() => {
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    });
  const back = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  // ---- the ink in steps ----
  // a 1800 x 2400 page of rings with grain of the strength given, as a JPEG (as e2e/v31814-steps)
  async function photo(page, grain) {
    const b64 = await page.evaluate(async (grain) => {
      const c = document.createElement('canvas');
      c.width = 1800;
      c.height = 2400;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, 1800, 2400);
      g.strokeStyle = '#1a1a1a';
      g.lineWidth = 6;
      for (let y = 200; y < 2400; y += 300)
        for (let x = 200; x < 1800; x += 300) {
          g.beginPath();
          g.arc(x, y, 120, 0, 6.283);
          g.stroke();
        }
      const im = g.getImageData(0, 0, 1800, 2400),
        d = im.data;
      let s = 7;
      for (let i = 0; i < d.length; i += 4) {
        s = (s * 16807) % 2147483647;
        const n = (s / 2147483647 - 0.5) * grain;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(im, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, grain);
    return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
  }
  async function choose(page, grain) {
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles(await photo(page, grain));
    const first = await Promise.race([
      page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }).then(() => 'build'),
      page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 60000 }).then(() => 'corners'),
    ]);
    if (first === 'corners') {
      await page.click('#sfPgNo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    }
    await idle(page);
  }
  // ---- a guide's settings from a newer version ----
  const idbGet = (page, id) =>
    page.evaluate(
      (id) =>
        new Promise((res) => {
          const r = indexedDB.open('ms-guides');
          r.onsuccess = () => {
            const q = r.result
              .transaction('g')
              .objectStore('g')
              .get('guide-' + id);
            q.onsuccess = () => res(q.result);
          };
        }),
      id,
    );
  const idbPut = (page, id, v) =>
    page.evaluate(
      ([id, v]) =>
        new Promise((res) => {
          const r = indexedDB.open('ms-guides');
          r.onsuccess = () => {
            const t = r.result.transaction('g', 'readwrite');
            t.objectStore('g').put(v, 'guide-' + id);
            t.oncomplete = () => res(1);
          };
        }),
      [id, v],
    );
  test('a new version: a banner that stays through an Undo toast, only one, ✕ until the page comes back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await updated(page);
    await page.waitForSelector('#msUpd');
    assert.match(await page.textContent('#msUpd'), /A new version of Marker Studio is ready\./);
    // (v318.28: said from #msSay, a live region in the page from the start, not by the banner inserted holding its words)
    assert.equal(await page.textContent('#msSay'), 'A new version of Marker Studio is ready.');
    // a toast with Undo comes and goes: the banner stays
    await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
    assert.equal(await page.isVisible('#toastAct'), true);
    assert.equal(await page.isVisible('#msUpd'), true);
    // only ever one
    await updated(page);
    await back(page);
    assert.equal(await page.locator('#msUpd').count(), 1);
    // ✕: gone until the page comes back to the screen
    const x = await page.locator('#msUpdX').boundingBox();
    assert.ok(x.width >= 44 && x.height >= 44, 'a finger-sized ✕');
    await page.click('#msUpdX');
    assert.equal(await page.locator('#msUpd').count(), 0);
    await back(page);
    assert.equal(await page.locator('#msUpd').count(), 1);
    assert.deepEqual(errors, []);
  });
  test('a new version on the guide’s screen: a toast, no banner (the picture doesn’t move), not over an Undo; the banner once back on Home', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const top = () =>
      page.evaluate(() => document.querySelector('#sfView canvas').getBoundingClientRect().top);
    const y0 = await top();
    // an action toast showing: not taken over
    await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
    await updated(page);
    await page.waitForTimeout(300);
    assert.match(await page.textContent('#msToast'), /Section cleared/);
    // the next time the page comes back
    await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
    await back(page);
    assert.match(await page.textContent('#msToast'), /A new version of Marker Studio is ready/);
    assert.equal(await page.locator('#msUpd').count(), 0, 'no banner on the guide’s screen');
    assert.equal(await top(), y0, 'the picture stays where it was');
    // leaving the guide's screen: the banner
    await page.evaluate(() => setMode('home'));
    await page.waitForSelector('#msUpd');
    assert.deepEqual(errors, []);
  });
  test('a new version: a page that already is it says nothing', async () => {
    const { page, errors } = await openApp();
    await page.evaluate(async () => {
      const v = /v?(\d+(?:\.\d+)?)/.exec(document.getElementById('appVer').textContent)[1];
      for (const k of await caches.keys()) await caches.delete(k);
      await caches.open('marker-studio-v' + v);
    });
    await updated(page);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#msUpd').count(), 0);
    assert.deepEqual(errors, []);
  });
  // ---- storage ----
  test('a Library with a curly quote in a name: the app’s storage holds what plain names would (WebKit counted it twice)', async () => {
    const { page, errors } = await openApp();
    const r = await page.evaluate(() => {
      const t = 'data:image/jpeg;base64,' + 'A'.repeat(24000);
      for (let i = 0; i < 110; i++)
        state.saved.push({
          id: 900 + i,
          type: 'guide',
          name: 'g' + i,
          ts: i + 1,
          keys: [],
          W: 100,
          H: 100,
          n: 1,
          thumb: t,
        });
      state.saved[state.saved.length - 1].name = 'Ben’s page';
      const ok = save(true),
        raw = localStorage.getItem('ohuhu-hb320-picker-v3');
      // a rename with a curly quote, a few guides more
      state.saved[0].name = 'Ziqi’s Ⅱ 🌼 page';
      const ok2 = save(true);
      return {
        ok,
        ok2,
        len: raw.length,
        wide: [...raw].some((c) => c.charCodeAt(0) > 0x7e),
        thumbs: state.saved.filter((s) => s.thumb).length,
      };
    });
    assert.ok(r.len > 2.65e6, 'over half of 5 MB: ' + r.len);
    assert.equal(r.wide, false);
    assert.equal(r.ok, true);
    assert.equal(r.ok2, true);
    assert.equal(r.thumbs, 110, 'no thumbnail had to go');
    assert.deepEqual(errors, []);
  });
  test('grainy photos (no blur, one pass, two): the ink found a step per pass, the same sections as in one go; the waits in Copy diagnostics', async () => {
    const passes = [];
    for (const grain of [0, 14, 70]) {
      const { page, errors } = await openApp({ width: 1180, height: 820 });
      await choose(page, grain);
      const r = await page.evaluate(() => {
        const t = __mstest,
          one = () => ({ sig: t.labelsSig(), n: t.comps.length, faint: t.faintOffer });
        const a = one();
        t.segment();
        return { steps: a, once: one(), d: errDetails(), passes: t.inkPasses() };
      });
      assert.ok(r.steps.n > 20, grain + ': sections ' + r.steps.n);
      assert.deepEqual(r.steps, r.once, 'grain ' + grain);
      passes.push(r.passes);
      // what held the page longest is listed (in memory only; v318.26: and in Send feedback, by Ben's decision)
      assert.match(r.d, /\nLongest waits, this visit:\n(New photo|Sections)/);
      assert.match(
        await page.evaluate(() => feedbackReport()),
        /\nLongest waits, this visit:\n(New photo|Sections)/,
      );
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    assert.deepEqual(passes, [0, 1, 2], 'no blur, one pass, two');
  });
  test('a guide saved by a newer version: its settings this version doesn’t know survive ticks and the autosave', async () => {
    const { page, errors } = await openApp({ width: 1024, height: 900 });
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    const pl = await idbGet(page, id);
    pl.zzTop = { a: 1, list: [1, 2, 3] };
    pl.style.zzStyle = 3;
    if (pl.style.shade) pl.style.shade.zzShade = 'x';
    await idbPut(page, id, pl);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 15000 });
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
      t.colored[t.assignData.order[1]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    // (the autosave: a moment after the change)
    let got = null;
    for (let t0 = Date.now(); Date.now() - t0 < 20000; await page.waitForTimeout(300)) {
      got = await idbGet(page, id);
      if (((got && got.prog) || []).length >= 2) break;
    }
    assert.ok(got.prog.length >= 2, 'the ticks saved');
    assert.deepEqual(got.zzTop, { a: 1, list: [1, 2, 3] });
    assert.equal(got.style.zzStyle, 3);
    if (pl.style.shade) assert.equal(got.style.shade.zzShade, 'x');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-beta-thanks': '1' };
  test('X3 G3: a tester task answered in another tab shows on Home’s card and foot line here', async () => {
    const KEYS = ['add', 'guide', 'plan', 'along', 'back', 'share'];
    const tester = (n) => {
      const t = {};
      KEYS.slice(0, n).forEach((k) => (t[k] = { r: 'easy', n: '', v: 'v318' }));
      return JSON.stringify({ id: 'TABC123', name: '', t, q: {}, sends: 0, sig: '' });
    };
    const { page, ctx, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(2) } });
    await idle(page);
    const card = () =>
      page.evaluate(() => [
        document.getElementById('homeTaskCard').innerText.replace(/\s+/g, ' ').trim(),
        document.getElementById('homeTasks').textContent,
      ]);
    assert.match((await card())[0], /^2\/6 /);
    const b = await ctx.newPage();
    await b.goto(page.url());
    await b.evaluate((v) => localStorage.setItem('ms-tester', v), tester(3));
    await page.waitForFunction(() => /3 of 6/.test(document.getElementById('homeTasks').textContent));
    assert.deepEqual(await card(), [
      '3/6 Beta tester tasks Next to answer: 4 · Colour along ›',
      'Tester tasks · 3 of 6',
    ]);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  // ---- D: Send feedback's waits, in the form's Message ----
  const FORM =
    'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
    Array.from({ length: 27 }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
  test('D Send feedback by the form: this visit’s longest waits after the Screen line; a long note cut, the details kept whole', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      init: `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`,
    });
    const msgs = [];
    await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
      const q = new URLSearchParams(r.request().postData() || '');
      // (the Message field: the 27th, whatever the fields after it)
      msgs.push(q.get('entry.1026'));
      return r.fulfill({ status: 200, body: 'ok' });
    });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await page.evaluate(() => {
      holdAdd('Sections', 2345, '2048×1536');
      holdAdd('Build', 812, '2048×1536');
    });
    await page.click('#homeFeedback');
    await page.fill('#fbText', 'Slow on my iPad.');
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    assert.match(
      msgs[0],
      /^Slow on my iPad\.\n\nNo errors recorded\.\nScreen: [^\n]+\nLongest waits, this visit:\nSections 2345 ms \(2048×1536\)\nBuild 812 ms \(2048×1536\)$/,
    );
    // the longest note, three long errors and eight waits: within the form's 4000, the waits all there
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) errLog('Opening a guide', new Error('long '.repeat(60) + i));
      for (let i = 0; i < 8; i++) holdAdd('Finding the page and sections ' + i, 3000 + i, '4032×3024');
    });
    await page.click('#homeFeedback');
    await page.fill('#fbText', 'x'.repeat(3000));
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    const m = msgs[1];
    assert.ok(m.length <= 4000, String(m.length));
    assert.match(
      m,
      /\nScreen: [^\n]+\nLongest waits, this visit:\n(Finding the page and sections \d 300\d ms \(4032×3024\)\n?){8}$/,
    );
    assert.ok(m.startsWith('x'.repeat(2000)));
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w2.test.mjs ----
// v318.26 in the browser (builder W2): Blends with in a marker's details, the Tester questions (two new ones, and a
// form of 27 fields or 29), and the skin tones (Change colour's row; Markers' search is in e2e/v3083-data).
{
  // ---- Blends with ----

  async function markers(o = {}) {
    const a = await openApp(o.width ? o : { width: 390, height: 844, ...o });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    return a;
  }
  // ---- Tester questions ----

  const FIELDS = [
    'Kind',
    'Tester',
    'Name',
    'Send',
    'Version',
    'Device',
    'App or tab',
    'Markers',
    'Use so far',
    '1 Add your markers',
    '1 Note',
    '2 Make a guide',
    '2 Note',
    '3 Make the plan yours',
    '3 Note',
    '4 Colour along',
    '4 Note',
    '5 Come back to it',
    '5 Note',
    '6 Share or print',
    '6 Note',
    'Extras',
    'Confused most',
    'Change first',
    'Colours matched',
    'Next page',
    'Message',
    'Other brands',
    'Colour most',
  ];
  const formOf = (n) =>
    'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
    Array.from({ length: n }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
  const STUBS = `window.__copied = []; window.__shared = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  navigator.share = (o) => { window.__shared.push(o); return Promise.resolve(); };`;
  function catchPosts(page) {
    const posts = [];
    return page
      .route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
        const q = new URLSearchParams(r.request().postData() || ''),
          o = { n: [...q.keys()].length };
        FIELDS.forEach((f, i) => (o[f] = q.get('entry.' + (1000 + i))));
        posts.push(o);
        return r.fulfill({ status: 200, body: 'ok' });
      })
      .then(() => posts);
  }
  async function tasks(n) {
    const a = await openApp({
      width: 820,
      height: 1180,
      init: `window.__MS_RESULTS_FORM = ${JSON.stringify(n ? formOf(n) : '')};` + STUBS,
    });
    a.warns = [];
    a.page.on('console', (m) => {
      if (m.type() === 'warning' && /RESULTS_FORM/.test(m.text())) a.warns.push(m.text());
    });
    await welcome(a.page, 'look');
    await idle(a.page);
    a.posts = n ? await catchPosts(a.page) : [];
    await a.page.click('#homeTasks');
    await idle(a.page);
    return a;
  }
  async function answer(page) {
    await page.click('.ttrow[data-k="add"] [data-r="easy"]');
    await page.fill('[data-q="brands"]', 'Copic, Spectrum Noir');
    await page.fill('[data-q="subjects"]', 'People and flowers');
  }
  test('Tester questions: the colours question asks which markers; two new ones, kept and copied', async () => {
    const { page, errors } = await tasks(0);
    const qs = await page.evaluate(() =>
      [...document.querySelectorAll('#ttQs .ttql')].map((e) => e.textContent),
    );
    assert.deepEqual(qs, [
      'What confused you most?',
      'What would you change first?',
      'Did the colours on paper match the screen well enough? Which markers looked most different?',
      'Which other marker brands do you use?',
      'What do you colour most (people, animals, flowers, patterns…)?',
      'Would you use it for your next page?',
    ]);
    await answer(page);
    await page.click('#ttCopy');
    await idle(page);
    const t = await page.evaluate(() => window.__copied.pop());
    assert.match(t, /\nOther brands: Copic, Spectrum Noir\nColour most: People and flowers$/);
    // kept through a reload
    await page.keyboard.press('Escape');
    await idle(page);
    await page.waitForFunction(() => !(history.state && history.state.msLayer));
    await page.reload();
    await idle(page);
    await page.click('#homeTasks');
    assert.equal(await page.inputValue('[data-q="brands"]'), 'Copic, Spectrum Noir');
    assert.equal(await page.inputValue('[data-q="subjects"]'), 'People and flowers');
    assert.deepEqual(errors, []);
  });
  test('Tester questions: to v318.25’s form (27 fields) the new answers go in Message; to the new one (29), their own', async () => {
    for (const n of [27, 29]) {
      const { page, errors, posts, warns, ctx } = await tasks(n);
      await answer(page);
      await page.click('#ttSend');
      await page.waitForFunction(() => /^Sent/.test(document.getElementById('ttSaid').textContent));
      assert.equal(posts.length, 1);
      const p = posts[0];
      assert.equal(p.n, n, 'one entry per field the form has');
      assert.equal(p.Kind, 'Results');
      assert.equal(p['1 Add your markers'], 'Easy');
      if (n === 27) {
        assert.equal(p.Message, 'Other brands: Copic, Spectrum Noir\nColour most: People and flowers');
        assert.equal(p['Other brands'], null);
      } else {
        assert.equal(p.Message, '');
        assert.equal(p['Other brands'], 'Copic, Spectrum Noir');
        assert.equal(p['Colour most'], 'People and flowers');
      }
      // Send feedback: its own dialog, the words in Message, nothing more
      await page.keyboard.press('Escape');
      await idle(page);
      await page.click('#homeFeedback');
      await idle(page);
      assert.ok(await page.isVisible('#fbOverlay'));
      await page.fill('#fbText', 'A note.');
      await page.click('#fbSend');
      await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
      assert.equal(posts.length, 2);
      assert.equal(posts[1].Kind, 'Feedback');
      assert.match(posts[1].Message, /^A note\./);
      assert.doesNotMatch(posts[1].Message, /Other brands/);
      assert.deepEqual(warns, []);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Tester questions: a form link of another length is passed over (the share sheet), said once in the console', async () => {
    const { page, errors, posts, warns } = await tasks(28);
    await answer(page);
    // the sheet redraws (formTarget asked each time): one warning
    await page.click('.ttrow[data-k="add"] [data-r="ok"]');
    await page.click('#ttSend');
    await idle(page);
    assert.equal(posts.length, 0);
    assert.equal(await page.evaluate(() => window.__shared.length), 1, 'the share sheet');
    assert.equal(warns.length, 1, JSON.stringify(warns));
    assert.match(warns[0], /RESULTS_FORM has 28 fields; this version sends 27 or 29/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y3.test.mjs ----
// v318.28 in the browser: using a guide, saving, output (Y3).
{
  // G2: Tester tasks says what is shared without a form as it says what a form is sent
  test('Y3 G2: Tester tasks with no form names every detail the shared text carries', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#homeTasks');
    const w = await page.textContent('#ttWhat');
    assert.match(w, /opens the share sheet/);
    assert.match(
      w,
      /tester number.*version.*device.*Home Screen app or browser tab.*markers of each brand.*guides and palettes/,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v319-shell.test.mjs ----
// v319, the shell (Fable Y4): Help › What's new from Home's "Updated to …" line on a device that used the app before
// the version last seen (ms-last-ver) was kept is headed plain "What's new" over the versions it lists, not "What's
// new in <this version>" (Y4-3: wnFill, help.js; fails on v318.37). The overlays' Close ✕ (.mclose: Library, Help,
// the swatch and colour charts) is 44 px to a tap at 390 and 320 px, as a finger finds it (Y4-2: measured by
// elementFromPoint, its ::after strip; it passed on v318.37 too, Y4's probe had measured the 36 px box).
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  // the tap area's width along the control's middle row and height along its middle column, 1px steps
  const tapArea = (page, sel) =>
    page.evaluate((sel) => {
      const e = document.querySelector(sel),
        r = e.getBoundingClientRect(),
        cx = (r.left + r.right) / 2,
        cy = (r.top + r.bottom) / 2,
        mine = (h) => !!h && (h === e || e.contains(h));
      let w = 0,
        h = 0;
      for (let y = r.top - 30; y <= r.bottom + 30; y++) if (mine(document.elementFromPoint(cx, y))) h++;
      for (let x = r.left - 30; x <= r.right + 30; x++) if (mine(document.elementFromPoint(x, cy))) w++;
      return { w, h };
    }, sel);
  test('Home: What’s new with no version last seen (an install from before ms-last-ver) opens Help headed “What’s new”, each item with its version', async () => {
    const { page, errors } = await openApp({
      storage: ONB,
      init: () => {
        window.__MS_HELP_AUTO = true;
      },
    });
    await idle(page);
    const ver = (await page.textContent('#appVer')).trim();
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), null, 'nothing seen yet');
    await page.waitForSelector('#whatsNew', { state: 'visible' });
    assert.equal((await page.textContent('#wnTitle')).trim(), `Updated to ${ver}`);
    await page.click('#wnOpen');
    await page.waitForSelector('#helpOverlay.on');
    await idle(page);
    assert.ok(
      await page.evaluate(() => document.getElementById('helpNews').open),
      'Help opens at What’s new',
    );
    assert.equal((await page.textContent('#helpNews .hlpwnt')).replace(/\s+/g, ' ').trim(), 'What’s new');
    const vs = await page.$$eval('#helpWnList li .hlpwnv', (l) => l.map((x) => x.textContent));
    assert.ok(
      vs.length >= 2 && vs[0] === ver && new Set(vs).size > 1,
      'each item headed with its version: ' + vs,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-last-ver')),
      ver,
      'this version remembered',
    );
    // Help by itself after: this version's, headed with it
    await page.click('#helpClose');
    await idle(page);
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    assert.equal(
      (await page.textContent('#helpNews .hlpwnt')).replace(/\s+/g, ' ').trim(),
      `What’s new in ${ver}`,
    );
    assert.deepEqual(errors, []);
  });
  for (const [name, scale, vp] of [
    ['390 phone', 1, { width: 390, height: 844 }],
    ['320 phone, Larger text', 1.6, { width: 320, height: 568 }],
  ]) {
    test(`${name}: the Close ✕ of Help, the Library and the swatch chart is 44 px to a tap`, async () => {
      const { page, errors } = await openAtScale(scale, { ...vp, touch: true, storage: ONB });
      await page.click('#homeHelp');
      await page.waitForSelector('#helpOverlay.on');
      await idle(page);
      let a = await tapArea(page, '#helpClose');
      assert.ok(a.w >= 44 && a.h >= 44, 'Help: ' + JSON.stringify(a));
      await page.click('#helpClose');
      await idle(page);
      await page.evaluate(() => openLibrary());
      await page.waitForSelector('#savedOverlay.on');
      await idle(page);
      a = await tapArea(page, '#savedOverlay .mclose');
      assert.ok(a.w >= 44 && a.h >= 44, 'Library: ' + JSON.stringify(a));
      await page.keyboard.press('Escape');
      await idle(page);
      await page.click('#mCollection');
      await idle(page);
      await page.click('#swatchBtn');
      await page.waitForSelector('#swOverlay.on');
      await idle(page);
      a = await tapArea(page, '#swOverlay .mclose');
      assert.ok(a.w >= 44 && a.h >= 44, 'swatch chart: ' + JSON.stringify(a));
      assert.deepEqual(errors, []);
    });
  }
}
