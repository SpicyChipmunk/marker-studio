// v318.25: fixes from the fifth deep debugging pass, in the browser. Fail on v318.24.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers, pause } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  ...extra,
});
const appState = (extra = {}) =>
  JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    saved: [],
    ...extra,
  });
const clip = () => {
  window.__clip = [];
  try {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (t) => void window.__clip.push(t) },
      configurable: true,
    });
  } catch (e) {}
};

// ---- X1: Markers and Scan ----

test('X1 a marker’s details: Copy copies the code its sheet shows, your older cap’s', async () => {
  const { page, errors } = await openApp({
    init: clip,
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState({ collView: 'owned', owned: ['Ohuhu|R213', 'Ohuhu|R014'] }) }),
  });
  await idle(page);
  await page.evaluate(() => {
    state.capDef = 'old';
    fullRender();
    openMarkerSheet(keyIdx('Ohuhu|R213'));
  });
  await idle(page);
  assert.equal(await page.textContent('#mkCode'), 'Ohuhu R6');
  await page.click('#mkCopy');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => window.__clip), ['R6']);
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('X1 Untick all shown counts your markers among those shown, and is off with none of yours shown', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({
      [KEY]: appState({ collView: 'all', owned: ['Ohuhu|R014', 'Ohuhu|Y27', 'Copic|E00'] }),
    }),
  });
  await idle(page);
  await page.click('#mkMore');
  await page.click('#ownNone');
  assert.equal(await page.textContent('#ownNone'), 'Untick 3 markers? Tap again');
  await pause(page, 450, 'past a double tap');
  await page.click('#ownNone');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  // (none of yours shown now: nothing to untick, so it's off rather than arming)
  assert.equal(await page.evaluate(() => document.getElementById('ownNone').disabled), true);
  // (one ticked by its swatch, the grid not redrawn: on again when the ⋯ menu next opens)
  await page.evaluate(() => setOwned(keyIdx('Ohuhu|R014'), true));
  if (!(await page.locator('#ownNone').isVisible())) await page.click('#mkMore');
  else {
    await page.click('#mkMore');
    await page.click('#mkMore');
  }
  assert.equal(await page.evaluate(() => document.getElementById('ownNone').disabled), false);
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('X1 Unowned’s “biggest gaps” and “complete” orders: the heading counts the markers shown', async () => {
  const owned = ['Ohuhu|R014', 'Ohuhu|R210', 'Ohuhu|Y27', 'Ohuhu|B000', 'Ohuhu|G020', 'Ohuhu|E47'];
  for (const gapSort of ['gap', 'complete']) {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ collView: 'unowned', gapSort, owned }) }),
    });
    await idle(page);
    const r = await page.evaluate(() => ({
      head: document.getElementById('matchLbl').textContent,
      cells: document.querySelectorAll('#results .cell').length,
      shown: shownMatches().length,
    }));
    assert.equal(r.cells, r.shown, gapSort);
    assert.equal(r.head, 'Showing ' + r.cells + ' markers', gapSort);
    assert.deepEqual(errors, []);
    await page.context().close();
  }
});

const scanStored = onboarded({ [KEY]: appState({ owned: ['Ohuhu|R014'] }) });

test('X1 the pictures of more than 60 questions waiting all come back after a reload', async () => {
  const { page, errors } = await openApp({ width: 1024, height: 768, storage: scanStored });
  await idle(page);
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const x = c.getContext('2d');
    const oh = COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Ohuhu');
    scanList = [];
    for (let k = 0; k < 75; k++) {
      x.fillStyle = 'hsl(' + k * 4 + ',70%,50%)';
      x.fillRect(0, 0, 40, 40);
      scanList.push({
        ask: 'fix Q' + k,
        title: 'Q' + k + '?',
        opts: [
          { i: oh[k * 2], how: 'chosen' },
          { i: oh[k * 2 + 1], how: 'chosen' },
        ],
        crop: c.toDataURL('image/jpeg'),
        photo: 1 + Math.floor(k / 5),
      });
    }
    scanSaveList();
  });
  await page.waitForFunction(() => scanPics.written().length === 75, null, { timeout: 5000 });
  for (let n = 0; n < 2; n++) {
    await page.reload();
    await idle(page);
    await page.waitForFunction(() => scanPics.loads > 0 && scanPics.written().length > 0, null, {
      timeout: 5000,
    });
    await pause(page, 300, 'the pictures put back');
    assert.deepEqual(
      await page.evaluate(() => ({
        asks: scanList.filter((e) => e.ask).length,
        withPic: scanList.filter((e) => e.ask && e.crop).length,
      })),
      { asks: 75, withPic: 75 },
      'reload ' + (n + 1),
    );
  }
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('X1 Add with another brand’s code left in the box: Scan stays open when that turns both brands on', async () => {
  const { page, errors } = await openApp({ width: 1024, height: 768, storage: scanStored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  for (const t of ['Ohuhu 0', 'R014', 'R210', 'Y27', 'B000']) {
    await page.fill('#scBox', t);
    await page.press('#scBox', 'Enter');
  }
  assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 1, 'B000 asked about');
  // (typed a key at a time, as a person types it: text arriving at once is Scan Text's, read when it holds still)
  await page.type('#scBox', 'E000');
  await pause(page, 800, 'longer than Scan Text’s hold');
  assert.equal(await page.inputValue('#scBox'), 'E000', 'still in the box, not read');
  await page.click('#scAdd');
  await idle(page);
  const r = await page.evaluate(() => ({
    open: document.getElementById('scanOverlay').classList.contains('on'),
    sw: scanSw.on,
    owned: [...state.owned].sort(),
  }));
  assert.equal(r.open, true, 'Scan left open on the changed list');
  assert.equal(r.sw, true);
  assert.deepEqual(r.owned, ['Ohuhu|R014'], 'nothing added yet');
  // (the list seen, Add again adds them: not stuck)
  await page.click('#scAdd');
  await idle(page);
  assert.equal(
    await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
    false,
  );
  assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), [
    'Copic|B000',
    'Copic|E000',
    'Ohuhu|0',
    'Ohuhu|R014',
    'Ohuhu|R210',
    'Ohuhu|Y27',
  ]);
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('X1 a photo’s canvases are emptied when its view goes (Done, Back, closing Scan: ocrHide)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: scanStored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const r = await page.evaluate(() => {
    ocrShow('<div class="ocrpic" id="ocrPic"></div><div class="ocrrow" id="ocrBtns"></div>');
    const a = document.createElement('canvas'),
      b = document.createElement('canvas');
    a.width = b.width = 675;
    a.height = b.height = 900;
    document.getElementById('ocrPic').append(a, b);
    ocrHide();
    return [a.width, a.height, b.width, b.height];
  });
  assert.deepEqual(r, [0, 0, 0, 0]);
  assert.deepEqual(errors, []);
  await page.context().close();
});
