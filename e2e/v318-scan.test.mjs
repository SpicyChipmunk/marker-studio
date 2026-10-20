// v318: Scan reads a set's name in what's pasted (its box, an order email) and offers its markers, asked first; Find my
// set goes straight to the set named; Open a list file reads a .csv or .txt as a paste. Its line says so, Find mode's
// its own. Fails on v317.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const paste = (page, text) =>
  page.evaluate((t) => {
    const d = new DataTransfer();
    d.setData('text/plain', t);
    document
      .getElementById('scBox')
      .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
  }, text);
const marks = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
const setKeysOf = (page, n) => page.evaluate((n) => presetMkeys(MARKER_SETS.find((p) => p.n === n)), n);
const shown = (page, id) =>
  page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);

test('a box’s text pasted: the set named, asked first; its markers into the list with a tap, then added', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  assert.match(
    await page.textContent('#scLensT'),
    /the set’s box or an order email.*A set’s name adds the whole set/,
  );
  assert.ok(await page.isVisible('#scFile'), 'Open a list file');
  await paste(page, 'OHUHU\nHONOLULU\nALCOHOL MARKERS\nDual Tips\n120\nCOLORS\nFor artists and beginners');
  await idle(page);
  // (nothing in the list unasked, nor its size read as a code: Ohuhu 120 is Black)
  assert.deepEqual(await marks(page), [], 'nothing in the list unasked');
  assert.match(
    await page.textContent('#scStat'),
    /^\?Found a set: Ohuhu Honolulu 120Add all 120 of its markers to the list\?(?!.*codes)/,
  );
  assert.equal(await page.textContent('#scStat .scpick button'), 'Add all 120 to the list');
  await page.click('#scStat .scpick button');
  await idle(page);
  const want = await setKeysOf(page, 'Honolulu 120');
  assert.deepEqual((await marks(page)).sort(), want.slice().sort());
  assert.match(
    await page.textContent('#scStat'),
    // (v318.28: its colours, the blender said apart, as "Add all 120" counted them)
    /^.*120 and a Colorless Blender added to the list.*Honolulu 120/,
  );
  // (a box's other words aren't "lines not read" on Add's toast)
  await page.click('#scAdd');
  await idle(page);
  assert.match(
    await page.textContent('#msToast'),
    /^Added 120 markers and a Colorless Blender to your collection(?!.*not read)/,
  );
  assert.equal(await page.evaluate(() => state.owned.size), want.length);
  // the welcome: Some are missing, as after a set ticked
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.ok(await shown(page, 'wcMoreMiss'));
  assert.deepEqual(errors, []);
});

test('an order email with two sets, one without its letter: a button each; adding one keeps the other’s', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-scan-brand': '' } });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await paste(
    page,
    'Your order #112-4824839-1234567\nOhuhu Honolulu Markers, 72 Colors\nQty: 1  $48.99\nCopic Ciao Markers 36 Colors\n$120.00',
  );
  await idle(page);
  assert.match(await page.textContent('#scStat b'), /^Found 2 sets$/);
  const btns = await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent));
  // (the Ciao 36's letter not read: its sets under a heading, by their letters)
  assert.deepEqual(btns, ['Add Honolulu 72', 'Set A', 'Set B', 'Set C', 'Set D', 'Set E']);
  assert.equal(await page.textContent('#scStat .scphead'), 'Ciao 36: which one?');
  await page.click('#scStat .scpick button:text-is("Set C")');
  await idle(page);
  const c = await setKeysOf(page, 'Ciao 36 - Set C');
  assert.deepEqual((await marks(page)).sort(), c.slice().sort());
  // the Honolulu 72's button still there; the 120 (Honolulu 120's, the collection) already yours
  assert.deepEqual(await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent)), [
    'Add Honolulu 72',
  ]);
  await page.click('#scStat .scpick button');
  await idle(page);
  assert.match(await page.textContent('#scStat'), /already yours/);
  assert.deepEqual(errors, []);
});

test('Find my set: its line; a name pasted goes straight to Is this your set?, a letter not read shows the others', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await page.click('#wcFBrand [data-b="Copic"]');
  await page.click('#wcFCount [data-n="1"]');
  await page.click('#wcFindNext');
  await idle(page);
  assert.equal(
    await page.textContent('#scLensT'),
    'Got the box or an order email? Paste its text: the set’s name finds it.',
  );
  assert.equal(await page.isVisible('#scFile'), false, 'no list file here');
  // (an Ohuhu set named: not the brand chosen, nothing found by name)
  await paste(page, 'Ohuhu Honolulu 120 Colors');
  await idle(page);
  assert.ok(await page.isVisible('#scanOverlay'), 'still scanning');
  await paste(page, 'Copic Ciao 36 Colors');
  await idle(page);
  assert.equal(
    await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
    false,
  );
  assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
  assert.match(await page.textContent('#wcRes'), /^Named in what you pastedCopic Ciao 36 - Set A36 markers/);
  assert.doesNotMatch(await page.textContent('#wcRes'), /cap/, 'no caps scanned: nothing said of them');
  assert.equal(await page.textContent('#wcFindOther'), 'No: show Ciao 36 - Set B');
  await page.click('#wcFindOther');
  assert.match(await page.textContent('#wcRes'), /Copic Ciao 36 - Set B/);
  // again, with a cap read along with the name: only the sets that have it (E00: Set A)
  await page.click('#wcStepRes .wcback');
  await idle(page);
  await page.click('#wcFindNext');
  await idle(page);
  await paste(page, 'COPIC\nciao\n36 colors\nE00');
  await idle(page);
  assert.match(await page.textContent('#wcRes'), /Copic Ciao 36 - Set A.*Has the cap you scanned: E00/);
  assert.equal(await page.isVisible('#wcFindOther'), false);
  await page.click('#wcFindYes');
  await idle(page);
  const a = await setKeysOf(page, 'Ciao 36 - Set A');
  assert.equal(await page.evaluate(() => state.owned.size), a.length);
  assert.ok(await shown(page, 'wcMoreMiss'));
  assert.deepEqual(errors, []);
});

test('Open a list file: a CSV read as a pasted list; its 44px tap area clear of the brands below', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-scan-brand': '' } });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const r = await page.evaluate(() => {
    const a = document.getElementById('scFile'),
      t = getComputedStyle(a, '::after'),
      b = a.getBoundingClientRect(),
      seg = document.getElementById('scBrand').getBoundingClientRect();
    return { h: parseFloat(t.height), bottom: b.top + b.height / 2 + 22, seg: seg.top };
  });
  assert.equal(r.h, 44);
  // (touching at most: the brands, drawn over it, keep their own taps)
  assert.ok(r.bottom <= r.seg + 2, 'clear of the brands: ' + JSON.stringify(r));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#scFile')]);
  await chooser.setFiles({
    name: 'my markers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('﻿Brand,Code\nOhuhu,BG314\nCopic,E00\nCopic,YG06\n'),
  });
  await page.waitForFunction(() => scanList.length === 3);
  assert.deepEqual((await marks(page)).sort(), ['Copic|E00', 'Copic|YG06', 'Ohuhu|BG314']);
  assert.match(await page.textContent('#scStat'), /3 added to the list/);
  assert.deepEqual(errors, []);
});

test('Find my set with a set’s name typed in the box (no Enter) and markers on the list kept for Add: no error', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // a marker on Scan's own list first (kept aside while Find mode runs)
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  await page.fill('#scBox', 'R014');
  await page.keyboard.press('Enter');
  await idle(page);
  await page.click('#scClose');
  await page.click('#wcStepOne .wcback');
  await page.click('#wcNotSure');
  await page.click('#wcFBrand [data-b="Copic"]');
  await page.click('#wcFCount [data-n="1"]');
  await page.click('#wcFindNext');
  await idle(page);
  // (typed a letter at a time: text that arrives at once is Scan Text's, read quietly once it holds still)
  await page.click('#scBox');
  await page.keyboard.type('Copic Ciao 36 Set A');
  // (Find my set reads the box first: the name hands the caps on and closes Scan; it had then gone on with the list
  // kept for Add and a Find that was over: "Cannot read properties of null (reading 'done')")
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
  assert.match(await page.textContent('#wcRes'), /^Named in what you pastedCopic Ciao 36 - Set A/);
  assert.equal(
    await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
    false,
  );
  // (the list kept for Add is back, as it was)
  assert.deepEqual(await marks(page), ['Ohuhu|R014']);
  assert.deepEqual(errors, []);
});

test('a question’s answer that is a marker by its old code says so: "Which R14?" offers RV18, was R14', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' },
  });
  await scanFromMarkers(page);
  await page.fill('#scBox', 'R14');
  await page.keyboard.press('Enter');
  await idle(page);
  const choices = await page.$$eval('#scList .scask .scchoose', (bs) => bs.map((b) => b.textContent));
  assert.ok(
    // (v318.21: as its older cap says it, R14 Pale Purple, the code it has now beside)
    choices.some((c) => /^R14 Pale Purple · Ohuhu · now RV18$/.test(c)),
    choices.join(' / '),
  );
  assert.ok(
    choices.some((c) => /^R14 Sheer Peach · Ohuhu$/.test(c)),
    choices.join(' / '),
  );
  // (v318 audit) an old code stored with the Roman numeral Ⅱ is said with plain letters, as everywhere else: BGII03
  const roman = await page.evaluate(() => {
    const i = COLORS.findIndex((c) => c.old === 'BGⅡ03');
    scanList.unshift({ ask: 'test', title: 'Which one?', opts: [{ i: i, how: 'old' }] });
    scanRender();
    return document.querySelector('#scList .scask .scchoose').textContent;
  });
  assert.match(roman, /^BGII03 .+ · now B310$/);
  assert.deepEqual(errors, []);
});
