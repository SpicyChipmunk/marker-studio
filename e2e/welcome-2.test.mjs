// The welcome (first run): sets, the steps, adding markers on the way in.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  addFromMarkers,
  haveSet,
  idle,
  notOnWebKit,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v318-adding-3.test.mjs ----
// v318 review (adding markers, 3 and 4): the welcome's Scan the caps says iPad or iPhone (Scan Text is on both), and on
// Android Gboard's Scan text, as Markers' Scan or type codes does; the privacy lines name photographing caps too.
// Fails on v318.
{
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  test('Scan the caps: iPad or iPhone; the privacy line names photographing caps', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    assert.match(
      await page.textContent('.wcpriv'),
      /the camera is used only to scan or photograph caps, or to Match a colour\./,
    );
    await page.click('#wcOneByOne');
    assert.match(await page.textContent('#wcOneScan'), /On an iPad or iPhone: hold up each cap/);
    assert.deepEqual(errors, []);
  });
  test('Android: Gboard’s Scan text on the welcome and in Markers’ Add markers', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, userAgent: ANDROID });
    await page.click('#wcOneByOne');
    assert.match(
      await page.textContent('#wcOneScan'),
      /With Gboard’s Scan text: photograph each cap and tap Insert/,
    );
    const m = await openApp({
      width: 820,
      height: 1180,
      userAgent: ANDROID,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await m.page.click('#mCollection');
    await idle(m.page);
    assert.match(await m.page.textContent('#mkcScan'), /scan caps with Gboard’s Scan text/);
    assert.deepEqual(errors.concat(m.errors), []);
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  // The first-run welcome's steps: the browser's Back (an iPad's swipe from the edge in a Safari tab, Android's Back) goes
  // back a step, as its Back link does. Fails on v318 as released: Back left the app from any step.
  test('Back in the welcome goes back a step, not out of the app', notOnWebKit(WK.back), async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await page.waitForSelector('#welcome.on');
    await idle(page);
    const url = page.url();
    const step = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#welcome .wcstep')]
          .filter((s) => s.getClientRects().length)
          .map((s) => s.id)
          .join(),
      );
    await page.click('#wcHaveSet');
    await idle(page);
    assert.equal(await step(), 'wcStep1');
    await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
    await page.goBack();
    await idle(page);
    assert.equal(page.url(), url, 'still in the app');
    assert.equal(await step(), 'wcStep0', 'back on the first step');
    assert.ok(await page.isVisible('#welcome.on'));
    // two steps in (one by one, then the chart over it): Back closes the chart, then goes back a step
    await page.click('#wcOneByOne');
    await idle(page);
    await page.click('#wcOneChart');
    await idle(page);
    await page.waitForFunction(() => history.state && history.state.msLayer >= 2);
    await page.goBack();
    await idle(page);
    assert.ok(!(await page.isVisible('#chartOverlay')), 'the chart closed');
    assert.equal(await step(), 'wcStepOne');
    await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
    await page.goBack();
    await idle(page);
    assert.equal(await step(), 'wcStep0');
    assert.equal(page.url(), url);
    // Skip, then its Back link: no entry left over once the welcome is done
    await page.click('#wcSkip');
    await idle(page);
    await page.click('#wcLook');
    await idle(page);
    await page.waitForFunction(() => !(history.state && history.state.msLayer));
    assert.ok(!(await page.isVisible('#welcome.on')));
    assert.deepEqual(errors, []);
  });
}

// ---- from v318.test.mjs ----
// v318: a new collection with less typing. After a set on the welcome, "Some are missing" opens the chart with the
// set's markers ticked, to untick the few lost or used up; it isn't offered after caps or the chart alone. Fails on v317.
{
  const shown = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  test('a set on the welcome, then Some are missing: the chart with its markers ticked; two unticked, saved, removed', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.ok(await shown(page, 'wcMoreMiss'), 'offered after a set');
    assert.match(await page.textContent('#wcMoreMiss'), /Some are missing.*Untick them on a chart/);
    await page.click('#wcMoreMiss');
    await idle(page);
    assert.ok(await shown(page, 'chGrid'), 'the chart');
    const two = await page.$$eval('#chGrid .chsw[aria-pressed="true"]', (l) =>
      l.slice(0, 2).map((b) => b.dataset.i),
    );
    assert.equal(two.length, 2, 'the set’s markers ticked');
    for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
    assert.equal(await page.textContent('#chSave'), 'Remove 2');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 119);
    assert.equal(await page.textContent('#wcT2'), '2 markers removed');
    assert.ok(await shown(page, 'wcMoreMiss'), 'still offered, for more');
    // the Undo (v318.26: a link under "Anything else?", not the toast's): both back, and the card as it was
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 121);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.ok(await shown(page, 'wcMoreMiss'));
    assert.deepEqual(errors, []);
  });
  test('caps or the chart alone: no Some are missing; the set’s Undo takes it away again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    for (const c of ['R014', 'BG314']) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    assert.equal(await shown(page, 'wcMoreMiss'), false, 'not after caps');
    // then a set from Anything else, and its Undo
    await page.click('#wcMoreSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.ok(await shown(page, 'wcMoreMiss'), 'after the set');
    // (v318.26: the set's Undo is the link under "Anything else?")
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 2);
    assert.ok(await shown(page, 'wcStep1'), 'back on the list it was added from');
    await page.click('#wcStep1 .wcback');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    assert.equal(await shown(page, 'wcMoreMiss'), false, 'the set taken back out');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  const visible = (page, id) =>
    page.evaluate((id) => !!document.getElementById(id).getClientRects().length, id);
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!t && t.classList.contains('on') && getComputedStyle(t).visibility !== 'hidden';
    });
  // ---- A6: the welcome's Undo, a link on "Anything else?" ----
  test('A6 a set added in the welcome: no toast; an Undo link under the sentence takes them out and goes back to the list', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
    );
    assert.equal(await toastOn(page), false, 'no toast over the step');
    assert.ok(await visible(page, 'wcUndoBtn'));
    assert.equal(
      await page.getAttribute('#wcUndoBtn', 'aria-label'),
      'Undo: take these 120 markers back out',
    );
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.ok(await visible(page, 'wcStep1'), 'back on the list');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcT1');
    // added again, then another step: the link goes with the step, and isn't back when Back returns there
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.ok(await visible(page, 'wcUndoBtn'));
    await page.click('#wcMoreExtra');
    await idle(page);
    await page.click('#wcStepOne .wcback');
    await idle(page);
    assert.ok(await visible(page, 'wcStep2'));
    assert.equal(await visible(page, 'wcUndoBtn'), false);
    assert.equal(await page.evaluate(() => state.owned.size), 121, 'still added');
    assert.deepEqual(errors, []);
  });
  test('A6 the chart from the welcome: its Undo is the link too, named for what it does; Markers’ own Add a set keeps its toast', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneChart');
    await idle(page);
    await page.click('#chGrid .chsw >> nth=0');
    await page.click('#chGrid .chsw >> nth=1');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    assert.equal(await toastOn(page), false);
    assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take these 2 markers back out');
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.ok(await visible(page, 'wcStepOne'), 'back where the chart was opened from');
    // a set and then Some are missing, unticking one: "put your collection back as it was"
    await page.click('#wcStepOne .wcback');
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    await page.click('#wcMoreMiss');
    await idle(page);
    await page.click('#chGrid .chsw[aria-pressed="true"] >> nth=0');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '1 marker removed');
    assert.equal(
      await page.getAttribute('#wcUndoBtn', 'aria-label'),
      'Undo: put your collection back as it was',
    );
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 121);
    assert.equal(await page.textContent('#wcT2'), '121 markers added', 'as it said before');
    assert.equal(await visible(page, 'wcUndoBtn'), false, 'only the latest add is undone by the link');
    // Markers' Add markers sheet: its set still says so in a toast with Undo
    await page.click('#wcLook');
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set();
      save();
      fullRender();
    });
    await addFromMarkers(page, 'set');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.ok(await toastOn(page));
    assert.match(await page.textContent('#msToast'), /^Added 120 markers/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31829-z1.test.mjs ----
// v318.29 (fixer Z1) in the browser: codes typed from the welcome put Add's Undo on "Anything else?" as a link, as a
// set's and the chart's are (v318.26), not a toast over the step's choices (on a 375 x 667 phone with 1.3x text it
// sat on Look around first, and a tap there took the markers back out); and "Which R27?" asked before the reading
// switched to both brands is answered by Copic tapped. Each fails on v318.29's HEAD.
{
  const typeCode = async (page, c) => {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  test('the welcome’s typed codes: no toast over "Anything else?", its Undo a link that takes them back out', async () => {
    for (const [width, height, scale] of [
      [375, 667, 1.3],
      [320, 568, 1.6],
    ]) {
      const { ctx, page, errors } = await openAtScale(scale, { width, height });
      await page.click('#wcOneByOne');
      await page.click('#wcOneType');
      await page.click('#scBrand button[data-b="Copic"]');
      for (const c of 'B000 B23 YG17 G28 R27 E00 V12 C-3 N-5 Y08'.split(' ')) await typeCode(page, c);
      await page.click('#scAdd');
      await idle(page);
      const r = await page.evaluate(() => {
        const t = document.getElementById('msToast'),
          b = document.getElementById('wcLook');
        b.scrollIntoView({ block: 'nearest' });
        const rc = b.getBoundingClientRect(),
          at = document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2);
        return {
          step: document.querySelector('.wcard').dataset.step,
          toast: !!(t && t.classList.contains('on')),
          look: at === b || b.contains(at),
          owned: state.owned.size,
        };
      });
      assert.deepEqual(r, { step: 'wcStep2', toast: false, look: true, owned: 10 }, width + ' wide');
      assert.equal(
        await page.getAttribute('#wcUndoBtn', 'aria-label'),
        'Undo: take these 10 markers back out',
      );
      await page.click('#wcUndoBtn');
      await idle(page);
      assert.equal(await page.evaluate(() => state.owned.size), 0, 'Undo took them back out');
      assert.equal(await page.evaluate(() => document.querySelector('.wcard').dataset.step), 'wcStepOne');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Honolulu 120, then B000, R27, YG17 typed: "Which R27?" offers Copic R27, and Copic tapped answers it', async () => {
    const { ctx, page, errors } = await openApp({ width: 375, height: 667 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcMoreExtra');
    await page.click('#wcOneType');
    for (const c of ['B000', 'R27', 'YG17']) await typeCode(page, c);
    const q = await page.$$eval('#scList li', (ls) =>
      ls.map((l) => l.textContent).find((t) => /Which R27\?/.test(t)),
    );
    assert.match(q || '', /Cadmium Red/, 'Copic R27 offered');
    await page.click('#scBrand button[data-b="Copic"]');
    await idle(page);
    const list = await page.$$eval('#scList li', (ls) => ls.map((l) => l.textContent));
    assert.ok(!list.some((t) => /Which R27\?/.test(t)), 'the question answered');
    assert.ok(
      list.some((t) => /R27/.test(t) && /Cadmium Red/.test(t)),
      'Copic R27 in the list',
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v31830-w1.test.mjs ----
// v318.30 (fixer W1) in the browser: the welcome's Type or paste codes opens Scan with Scan Text's three steps folded
// into one line and the box in view (on a 375 x 667 phone at 1.3x text it sat below the Photograph card, off the first
// screen, while step 1 said "Tap the box"); Scan caps one at a time keeps the steps. And what Scan's Add from the
// welcome leaves to do (questions still to choose, lines not read, the caps' offer) is in the step's line beside its
// Undo, "1 still to choose: Open · Undo", not a 10 s toast over the step's choices; Scan from Markers keeps its toast.
// Each fails on v318.30's HEAD.
{
  const typeCode = async (page, c) => {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!t && t.classList.contains('on') && getComputedStyle(t).visibility !== 'hidden';
    });
  const layout = (page) =>
    page.evaluate(() => {
      const vis = (id) => document.getElementById(id).getClientRects().length > 0,
        box = document.getElementById('scBox').getBoundingClientRect(),
        add = document.getElementById('scAdd').getBoundingClientRect(),
        card = document.querySelector('.sccard').getBoundingClientRect();
      return {
        steps: vis('scHow'),
        line: vis('scType'),
        text: document.getElementById('scType').textContent,
        // the box whole, between the card's top and its sticky Add
        boxIn: box.top >= card.top && box.bottom <= add.top,
        focus: document.activeElement.id,
      };
    });
  test('Type or paste codes from the welcome: the steps one line, the box in view above Add (375 x 667 at 1.3x, 320 x 568 at 1.6x); Scan caps keeps the steps', async () => {
    for (const [width, height, scale] of [
      [375, 667, 1.3],
      [320, 568, 1.6],
      [390, 844, 1],
      [820, 1180, 1],
    ]) {
      const { ctx, page, errors } = await openAtScale(scale, { width, height, touch: true });
      await page.click('#wcOneByOne');
      await page.click('#wcOneType');
      await idle(page);
      const t = await layout(page);
      assert.equal(t.steps, false, width + ': no steps');
      assert.equal(t.line, true, width + ': the one line');
      assert.match(
        t.text,
        /^Type a code and tap return after it\. Or scan caps: tap the box, then AutoFill › Scan Text/,
      );
      assert.equal(t.boxIn, true, width + ': the box in view');
      assert.equal(t.focus, 'scBox');
      await page.click('#scClose');
      await idle(page);
      await page.click('#wcOneScan');
      await idle(page);
      const s = await layout(page);
      assert.equal(s.steps, true, width + ': Scan caps keeps the steps');
      assert.equal(s.line, false);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Android: the one line says Gboard’s Scan text', async () => {
    const { ctx, page, errors } = await openApp({
      width: 375,
      height: 667,
      touch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    const t = await layout(page);
    assert.equal(t.line, true);
    assert.match(
      t.text,
      /^Type a code and tap ✓ after it\. Or scan caps with Gboard: open its tools .* tap Scan text, snap a cap and tap Insert\.$/,
    );
    assert.equal(t.boxIn, true);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a question left after the welcome’s Add: no toast; "1 still to choose: Open · Undo" in the step, Open reopens Scan as the welcome’s and its Add counts there', async () => {
    const { ctx, page, errors } = await openAtScale(1.3, { width: 375, height: 667, touch: true });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await page.click('#scBrand button[data-b="Copic"]');
    // R2T: R21 or R27? stays a question; 9 go in
    for (const c of 'B000 B23 YG17 G28 R2T E00 V12 C-3 N-5 Y08'.split(' ')) await typeCode(page, c);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '9 markers added');
    assert.equal(await toastOn(page), false, 'no toast over the step');
    assert.equal(await page.textContent('#wcUndo'), '1 still to choose: Open · Undo');
    assert.equal(
      await page.getAttribute('#wcOpenBtn', 'aria-label'),
      'Open Scan or type codes: 1 still to choose',
    );
    assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take these 9 markers back out');
    // the step's choices all reachable
    const look = await page.evaluate(() => {
      const b = document.getElementById('wcLook');
      b.scrollIntoView({ block: 'nearest' });
      const rc = b.getBoundingClientRect(),
        at = document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2);
      return at === b || b.contains(at);
    });
    assert.equal(look, true, 'Look around first not covered');
    await page.click('#wcOpenBtn');
    await idle(page);
    assert.ok(await page.isVisible('#scanOverlay.on'));
    assert.deepEqual(await page.evaluate(() => [scanWelcome, scanTyped, scanAsks()]), [true, true, 1]);
    assert.equal((await layout(page)).line, true, 'as Type or paste codes opened it');
    await page.click('#scList .scchoose >> nth=0');
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '1 more marker added');
    assert.equal(await page.textContent('#wcDone'), '10 markers are in your collection. Anything else?');
    assert.equal(await toastOn(page), false);
    assert.equal(await page.textContent('#wcUndo'), 'Undo', 'nothing left to do');
    assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take this marker back out');
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 9);
    assert.equal(await page.textContent('#wcT2'), '9 markers added', 'as it said before');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('Scan from Markers keeps its toast: "… 1 still to choose" with Undo and Open', async () => {
    const { ctx, page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    await page.click('#wcLook');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await page.click('#scBrand button[data-b="Copic"]');
    for (const c of ['B000', 'R2T']) await typeCode(page, c);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await toastOn(page), true);
    assert.match(
      await page.textContent('#msToast'),
      /Added 1 marker to your collection · 1 still to choose\s*Undo\s*Open/,
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v31832-ui-wins.test.mjs ----
// v318.32, stage 1C (Fable U1-2, U1-3, U1-4, U1-8, U1-9, U1-10; V1-8, V1-9): the welcome's Done on "Add your markers
// one by one" and on the Markers sheet; a fresh photo's corner step says to drag the yellow corners and makes
// Straighten the main button when the corners cover most of the photo; What's new as its own Help section and one
// Home line after an update; the Marker texture hint and the Neuro line; the mandala box's one sentence; "Start from a
// marker… (random)"; the tester card's chevron never alone on a line, and the foot's Tester tasks line away meanwhile.
// Each fails on v318.31.
{
  const IPAD = { width: 820, height: 1180, touch: true };
  const PHONE = { width: 390, height: 844 };
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  const vis = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0;
    }, sel);
  const rect = (page, sel) =>
    page.$eval(sel, (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right };
    });
  // ---- 2. a fresh photo's corner step ----

  async function freshPhotoApp(o = {}) {
    const a = await openApp(o);
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  async function pickFixture(page, name) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({
      name,
      mimeType: 'image/png',
      buffer: await readFile(join(ROOT, 'e2e', 'fixtures', name)),
    });
  }
  const pgBtns = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.sfpgbtns button')].map(
        (b) => b.id + ':' + b.className + ':' + b.textContent,
      ),
    );
  // ---- 6. the mandala box ----

  async function mandala(page) {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1100;
      c.height = 1100;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 1100, 1100);
      g.strokeStyle = '#000';
      g.lineWidth = 5;
      for (const r of [75, 200, 350, 500]) {
        g.beginPath();
        g.arc(550, 550, r, 0, 6.2832);
        g.stroke();
      }
      for (const [r0, r1, k] of [
        [75, 200, 8],
        [200, 350, 16],
        [350, 500, 24],
      ])
        for (let i = 0; i < k; i++) {
          const a = (i * 2 * Math.PI) / k;
          g.beginPath();
          g.moveTo(550 + r0 * Math.cos(a), 550 + r0 * Math.sin(a));
          g.lineTo(550 + r1 * Math.cos(a), 550 + r1 * Math.sin(a));
          g.stroke();
        }
      return c.toDataURL('image/png').split(',')[1];
    });
    return { name: 'mandala.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  // ---- 1. the welcome's Done ----

  for (const [name, o] of [
    ['phone', PHONE],
    ['iPad portrait', IPAD],
  ]) {
    test(`welcome (${name}): "Add your markers one by one" has Done, 44px, in view, that opens the sample as "That's all" does`, async () => {
      const { page, errors } = await openAtScale(name === 'phone' ? 1.3 : 1, o);
      await page.waitForSelector('#wcOneByOne');
      await page.click('#wcOneByOne');
      await idle(page);
      assert.ok(await vis(page, '#wcOneDone'), 'Done shows');
      const r = await rect(page, '#wcOneDone');
      assert.ok(r.h >= 44, 'Done is ' + r.h + 'px tall');
      assert.ok(r.b <= o.height && r.y >= 0, 'Done is in view: ' + JSON.stringify(r));
      assert.equal((await page.textContent('#wcOneDone')).trim(), 'Done');
      await page.click('#wcOneDone');
      await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData), null, { timeout: 60000 });
      assert.equal(await vis(page, '#welcome'), false, 'the welcome is closed');
      assert.deepEqual(errors, []);
    });
  }
  test('Markers › Add markers (the welcome as a sheet): Done closes the sheet, as Back does', async () => {
    const { page, errors } = await openApp(PHONE);
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    assert.ok(await page.isVisible('#mkAddBtn'), 'Add markers is there');
    await page.click('#mkAddBtn');
    await page.waitForSelector('#wcStepAdd', { state: 'visible' });
    assert.ok(await vis(page, '#wcAddDone'), 'Done shows on the sheet');
    await page.click('#wcAddDone');
    await idle(page);
    assert.equal(await vis(page, '#welcome'), false, 'the sheet is closed');
    assert.equal(await page.evaluate(() => state.mode), 'collection', 'still on Markers');
    assert.deepEqual(errors, []);
  });
  test('the finder unsure, the corners right (a page under a lamp): the note says to drag the yellow corners, and Straighten is the main button', async () => {
    const { page, errors } = await freshPhotoApp();
    await pickFixture(page, 'lit-mandala-table.png');
    await page.waitForSelector('#sfPgGo', { timeout: 40000 });
    const note = await page.textContent('.sfpgnote');
    assert.match(note, /hidden or bent|outside the photo/, 'v313’s reason stays');
    assert.match(note, /Drag the yellow corners onto the page’s corners, then Straighten\./);
    assert.deepEqual(await pgBtns(page), ['sfPgGo:btn-primary:Straighten', 'sfPgNo:btn-soft:Keep as is']);
    // the corners cover most of the photo
    const cover = await page.evaluate(() => {
      const e = __mstest.pgEd,
        q = e.q,
        cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const area = Math.abs(cr(q[0], q[1], q[2])) / 2 + Math.abs(cr(q[0], q[2], q[3])) / 2;
      return area / (720 * 720);
    });
    assert.ok(cover > 0.5, 'covers ' + cover.toFixed(2));
    // a corner dragged well inside: no longer most of the photo, so Keep as is is first again
    await page.evaluate(() => {
      const e = __mstest.pgEd;
      e.q[2] = [360, 360];
      e.q[1] = [360, e.q[1][1]];
    });
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    assert.deepEqual(await pgBtns(page), ['sfPgNo:btn-primary:Keep as is', 'sfPgGo:btn-soft:Straighten']);
    assert.deepEqual(errors, []);
  });
  test('a corner off the photo: Keep as is stays the main button, and the note still says how to drag', async () => {
    const { page, errors } = await freshPhotoApp();
    await pickFixture(page, 'lit-mandala-table.png');
    await page.waitForSelector('#sfPgGo', { timeout: 40000 });
    // the same step with one corner past the photo's edge (as the finder's 'off' outline has)
    await page.evaluate(() => {
      const e = __mstest.pgEd;
      e.q[1] = [760, e.q[1][1]];
      __mstest.renderControls();
    });
    await idle(page);
    assert.deepEqual(await pgBtns(page), ['sfPgNo:btn-primary:Keep as is', 'sfPgGo:btn-soft:Straighten']);
    assert.match(
      await page.textContent('.sfpgnote'),
      /Drag the yellow corners onto the page’s corners, then Straighten\./,
    );
    // Adjust corners later (not a fresh photo): its note and buttons as they were
    await page.click('#sfPgNo');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
    assert.deepEqual(errors, []);
  });
  // ---- 3. What's new ----

  test('Help: What’s new is its own section, second after the beta tester guide, listing this version’s', async () => {
    const { page, errors } = await openApp({ storage: ONB });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
    assert.equal(secs[0], 'Beta tester guide', 'v308: the tester guide first');
    assert.equal(secs[1], 'What’s new');
    assert.equal(await page.$('#helpAbout .hlpwnt'), null, 'no longer in About');
    await page.click('#helpNews > summary');
    await page.waitForSelector('#helpNews .hlpwnt', { state: 'visible' });
    const ver = (await page.textContent('#appVer')).trim();
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), `What’s new in ${ver}`);
    const items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
    assert.deepEqual(
      items,
      await page.evaluate((v) => WHATS_NEW.filter((x) => x.v === v).map((x) => x.t), ver),
    );
    assert.ok(items.length >= 1);
    assert.deepEqual(errors, []);
  });
  for (const [name, o] of [
    ['phone, Larger text', { ...PHONE, scale: 1.3 }],
    ['iPad portrait', { ...IPAD, scale: 1 }],
  ]) {
    test(`Home (${name}): one line "Updated to vX · What’s new" after an update; What’s new opens Help there and the line goes for good; never on a fresh install`, async () => {
      const { scale, ...vp } = o;
      // an update from an older version (the version seen is remembered; nothing shown by itself under the test seam,
      // so the switch is set and the page opened again: openAtScale on WebKit has an init of its own)
      const { ctx, page, errors } = await openAtScale(scale, {
        ...vp,
        storage: { ...ONB, 'ms-last-ver': 'v200' },
      });
      await ctx.addInitScript(() => {
        window.__MS_HELP_AUTO = true;
      });
      await page.reload();
      await idle(page);
      const ver = (await page.textContent('#appVer')).trim();
      assert.ok(await vis(page, '#whatsNew'), 'the line shows on Home');
      assert.equal((await page.textContent('#wnTitle')).trim(), `Updated to ${ver}`);
      assert.equal(
        (await page.textContent('#whatsNew')).replace(/\s+/g, ' ').trim(),
        `Updated to ${ver} · What’s new`,
      );
      assert.equal(await page.$('#whatsNew li'), null, 'a line, not the card of items');
      const r = await rect(page, '#whatsNew');
      assert.ok(r.w <= vp.width && r.x >= 0 && r.r <= vp.width, 'fits the width: ' + JSON.stringify(r));
      assert.ok((await rect(page, '#wnOpen')).h >= 40 && (await rect(page, '#wnClose')).h >= 40, 'tappable');
      assert.equal(await page.getAttribute('#wnClose', 'aria-label'), 'Dismiss what’s new');
      await page.reload();
      await idle(page);
      assert.ok(await vis(page, '#whatsNew'), 'still there until tapped');
      await page.click('#wnOpen');
      await page.waitForSelector('#helpOverlay.on');
      assert.ok(
        await page.evaluate(() => document.getElementById('helpNews').open),
        'Help opens at What’s new',
      );
      // (v318.37: every version since the one last seen, e2e/v31837-shell)
      assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v200');
      assert.equal(await page.$('#whatsNew'), null, 'the line is gone');
      assert.equal(
        await page.evaluate(() => localStorage.getItem('ms-last-ver')),
        ver,
        'this version remembered as seen',
      );
      await page.click('#helpClose');
      await idle(page);
      await page.waitForFunction(() => !(history.state && history.state.msLayer));
      await page.reload();
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null, 'and stays gone');
      assert.deepEqual(errors, []);
    });
  }
  test('What’s new: ✕ dismisses the line; a fresh install never sees it', async () => {
    {
      const { page, errors } = await openApp({
        storage: { ...ONB, 'ms-last-ver': 'v200' },
        init: () => {
          window.__MS_HELP_AUTO = true;
        },
      });
      await idle(page);
      assert.ok(await vis(page, '#whatsNew'));
      await page.click('#wnClose');
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null);
      assert.equal(
        await page.evaluate(() => localStorage.getItem('ms-last-ver')),
        (await page.textContent('#appVer')).trim(),
      );
      assert.deepEqual(errors, []);
    }
    {
      const { page, errors } = await openApp({
        init: () => {
          window.__MS_HELP_AUTO = true;
        },
      });
      await welcome(page, 'look');
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null, 'nothing on a fresh install');
      await page.reload();
      await idle(page);
      assert.equal(await page.$('#whatsNew'), null, 'nor on its next launch');
      assert.deepEqual(errors, []);
    }
  });
  // ---- 5. Shading's hints ----

  for (const [name, o] of [
    ['phone, Larger text', { ...PHONE, scale: 1.3 }],
    ['iPad portrait', { ...IPAD, scale: 1 }],
  ]) {
    test(`Shading (${name}): a hint under Marker texture, and a line saying what Neuro is`, async () => {
      const { scale, ...vp } = o;
      const { page, errors } = await openAtScale(scale, vp);
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="shading"]');
      await idle(page);
      assert.ok(await vis(page, '#sfShNeuro'), 'the Neuro line shows with shading off');
      assert.match(await page.textContent('#sfShNeuro'), /^Neuro is for neurographic art/);
      if (vp.width < 600) {
        const more = await page.$('#sfPanel-shading .sfmorebar button, #sfPanel-shading [data-more]');
        if (more && !(await vis(page, '#sfTex'))) await more.click();
        await idle(page);
      }
      assert.ok(await vis(page, '#sfTexHint'), 'the texture hint shows');
      assert.match(await page.textContent('#sfTexHint'), /^Higher: /);
      assert.equal(await page.getAttribute('#sfTex', 'aria-describedby'), 'sfTexHint');
      assert.equal(await page.getAttribute('#sfTex', 'aria-label'), 'Marker texture');
      // under the slider, not beside it, and inside the pane
      const h = await rect(page, '#sfTexHint'),
        s = await rect(page, '#sfTex');
      assert.ok(h.y >= s.b - 1, 'hint under the slider');
      assert.ok(h.r <= vp.width, 'fits');
      assert.deepEqual(errors, []);
    });
  }
  test('Pattern › Gradient on a mandala: the box is one sentence, "Matching shapes get the same colour (mandalas)", no heading over it', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await mandala(page));
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfMatchAlike'), true);
    const label = await page.evaluate(() =>
      document.getElementById('sfMatchAlike').closest('label').textContent.trim(),
    );
    assert.equal(label, 'Matching shapes get the same colour (mandalas)');
    assert.equal(await page.$('#sfMandLbl'), null, 'no "Looks like a mandala" heading');
    assert.deepEqual(errors, []);
  });
  // ---- 7. Start from a marker… ----

  test('Palette: the base button reads "Start from a marker… (random)" until one is chosen, then "Start from  Ohuhu R014"', async () => {
    const { page, errors } = await openApp(PHONE);
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await idle(page);
    assert.equal(
      (await page.textContent('#seedBtn')).replace(/\s+/g, ' ').trim(),
      'Start from a marker… (random)',
    );
    assert.equal(
      await vis(page, '#seedWrap .szlbl'),
      false,
      'the row’s "Start from" label is away: the button says it',
    );
    assert.ok((await rect(page, '#seedBtn')).h >= 44, '44px');
    await page.click('#seedBtn');
    await page.waitForSelector('#seedOverlay.on');
    await page.click('#seedGrid [data-i="' + (await page.evaluate(() => keyIdx('Ohuhu|R014'))) + '"]');
    await idle(page);
    assert.ok(await vis(page, '#seedWrap .szlbl'), 'with a marker chosen the label is back');
    assert.equal((await page.textContent('#seedWrap .szlbl')).trim(), 'Start from');
    assert.match((await page.textContent('#seedBtn')).trim(), /^Ohuhu R014/);
    assert.deepEqual(errors, []);
  });
  // ---- 8. the tester card ----

  // (v318.36 kept the foot's Tester tasks line while the card shows, V1-8 undone: the test said "away" until v318.37)
  test('Home’s tester card on an iPad in portrait: the › sits with the last word, never alone on a line; the foot’s Tester tasks line stays while the card shows', async () => {
    const { page, errors } = await openApp({ ...IPAD, storage: ONB });
    await idle(page);
    const r = await page.evaluate(() => {
      const nw = document.querySelector('#homeTaskCard .ttnw');
      if (!nw) return null;
      const rects = [...nw.getClientRects()].filter((q) => q.width > 0);
      const tops = new Set(rects.map((q) => Math.round(q.top)));
      return {
        text: nw.textContent.replace(/\s+/g, ' ').trim(),
        lines: tops.size,
        style: getComputedStyle(nw).whiteSpace,
      };
    });
    assert.ok(r, 'the nowrap span is there');
    assert.equal(r.style, 'nowrap');
    assert.equal(r.lines, 1, 'the last word and › on one line');
    assert.match(r.text, /^markers ›$/);
    assert.equal(
      await page.evaluate(() =>
        document.getElementById('homeTaskCard').innerText.replace(/\s+/g, ' ').trim(),
      ),
      '0/6 Beta tester tasks Next to answer: 1 · Add your markers ›',
    );
    assert.equal(await vis(page, '#homeTasks'), true, 'the foot line stays (v318.36)');
    assert.deepEqual(errors, []);
  });
}
