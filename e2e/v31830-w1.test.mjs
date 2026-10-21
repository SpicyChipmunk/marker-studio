// v318.30 (fixer W1) in the browser: the welcome's Type or paste codes opens Scan with Scan Text's three steps folded
// into one line and the box in view (on a 375 x 667 phone at 1.3x text it sat below the Photograph card, off the first
// screen, while step 1 said "Tap the box"); Scan caps one at a time keeps the steps. And what Scan's Add from the
// welcome leaves to do (questions still to choose, lines not read, the caps' offer) is in the step's line beside its
// Undo, "1 still to choose: Open · Undo", not a 10 s toast over the step's choices; Scan from Markers keeps its toast.
// Each fails on v318.30's HEAD.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openAtScale, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

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
