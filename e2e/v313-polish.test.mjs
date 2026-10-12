// v313 polish (D11): Markers' line about the view under its row; Palette's Undo, Clear, Save and ⋯ on one row; the
// Library's empty state (what's kept there, Try the sample, no search box); the guide's start card in Home's words;
// Edit sections' shorter intro; the shimmer three times; the sample's ticks not on Home's Continue card until it's
// printed or renamed; Continue's "Last coloured N days ago". Each test fails on v312.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, welcome, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

const box = (page, s) => page.locator(s).boundingBox();
// the sample, once the welcome has gone
const loadSample = async (page) => {
  await page.evaluate(() => {
    window.__ld = __mstest.assignData;
    SF.loadSample();
  });
  await page.waitForFunction(() => !!__mstest.assignData && __mstest.assignData !== window.__ld, null, {
    timeout: 60000,
  });
  await idle(page);
};

test('Markers: the line about the view sits under the row, whole; Owned has none (v316: "Your collection." said what the switch says)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  assert.equal(await page.isVisible('#ownHint'), false);
  await page.click('#ownView [data-v="unowned"]');
  await idle(page);
  assert.match(await page.textContent('#ownHint'), /^Markers you don’t own yet/);
  const h = await box(page, '#ownHint'),
    a = await box(page, '#mkAddBtn');
  assert.ok(h.y >= a.y + a.height - 1, 'under the row');
  assert.deepEqual(errors, []);
});

test('Palette: Undo, Clear, Save and ⋯ on one row', async () => {
  for (const width of [390, 820]) {
    const { page, errors } = await openApp({ width, height: 900 });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await idle(page);
    await page.click('#draw');
    await idle(page);
    const u = await box(page, '#undo'),
      s = await box(page, '#saveBtn');
    assert.ok(Math.abs(u.y - s.y) < 2, `${width}: one row`);
    assert.deepEqual(errors, []);
    await page.context().close();
  }
});

test('the Library, empty: what gets kept there and Try the sample; no search box or sort with nothing to search', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.click('#mHome');
  await page.click('#homeLibCard');
  await idle(page);
  assert.equal(await page.isVisible('#savedOverlay .libbar'), false);
  assert.match(await page.textContent('#savedList .empty'), /A guide saves itself here once it’s built/);
  await page.click('#libTrySample');
  await page.waitForFunction(() => !!__mstest.assignData, null, { timeout: 60000 });
  await idle(page);
  assert.equal(await page.isVisible('#savedOverlay'), false);
  assert.deepEqual(errors, []);
});

test('wording: the guide’s start card as Home says it; Edit sections’ intro; the shimmer runs three times', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.click('#mSections');
  await idle(page);
  assert.equal(
    await page.textContent('#sfStart .sftag'),
    'Turn a photo of a colouring page into a marker-by-number guide, built from the markers you own.',
  );
  assert.match(
    await page.textContent('#sfMeta'),
    /Lay the page flat in even light, and get all of it in the frame\./,
  );
  await loadSample(page);
  await answerAsks(page);
  // the shimmer on Colour along
  const it = await page.evaluate(() => {
    const b = document.querySelector('.sfcolorcta');
    return b ? getComputedStyle(b, '::before').animationIterationCount : null;
  });
  assert.equal(it, '3');
  await page.click('#sfBack2');
  await idle(page);
  const lines = await page.$$eval('#sfCtl .sfedline', (e) => e.map((x) => x.textContent.trim()));
  assert.ok(
    lines.includes('Merge, split or add where the lines didn’t come out right.'),
    JSON.stringify(lines),
  );
  assert.deepEqual(errors, []);
});

const home = async (page) => {
  await page.click('#mHome');
  await idle(page);
};
const cont = (page) => page.evaluate(() => !!document.querySelector('#homeCont [data-cont]'));

test('the sample with a few ticks isn’t on Home’s Continue card; once it’s no longer just tried (renamed or printed), it is', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest;
    for (const l of t.assignData.order.slice(0, 3)) t.colored[l] = 1;
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  await home(page);
  assert.equal(await cont(page), false, 'not on Continue');
  // renamed: on it
  await page.click('#mSections');
  await idle(page);
  await page.evaluate(() => {
    __mstest.styleVars.smpTry = 0;
    __mstest.guideDirty = true;
    __mstest.saveNow();
  });
  await idle(page);
  await home(page);
  assert.equal(await cont(page), true, 'on Continue');
  assert.deepEqual(errors, []);
});

test('the sample renamed with the name box, or its page printed, comes off "tried": smpTry', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1);
  // the test strip doesn't count
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await page.click('[data-pwhat="strip"]');
  let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
  await dl.path();
  assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1, 'not for the test strip');
  await page.click('[data-pwhat="page"]');
  [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
  await dl.path();
  assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 0, 'its page printed');
  await page.click('#sfSheet [data-pr="cancel"]');
  await idle(page);
  // a fresh sample, renamed
  await loadSample(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1);
  await page.click('#sfRename');
  await page.fill('#sfGName', 'My jellyfish');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 0, 'renamed');
  assert.deepEqual(errors, []);
});

test('Home’s Continue card: “Last coloured 3 days ago” under how far along (nothing the same day)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.smpTry = 0;
    t.curName = 'Days test';
    for (const l of t.assignData.order.slice(0, 3)) t.colored[l] = 1;
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  await home(page);
  assert.equal(await page.isVisible('#homeCont .hcwhen'), false, 'today: nothing');
  await page.evaluate(() => {
    const g = state.saved.find((s) => s.type === 'guide' && s.name === 'Days test');
    g.lc = Date.now() - 3 * 864e5;
    renderRecent();
  });
  await idle(page);
  assert.equal(await page.textContent('#homeCont .hcwhen'), 'Last coloured 3 days ago');
  assert.match(
    await page.getAttribute('#homeCont [data-cont]', 'aria-label'),
    /\. Last coloured 3 days ago$/,
  );
  assert.deepEqual(errors, []);
});
