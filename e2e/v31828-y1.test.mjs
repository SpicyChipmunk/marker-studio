// v318.28 (fixer Y1) in the browser: Home's Markers card counts Copic's 0 as its set does; Markers' "skin" says the
// skin tones in All, and with none yours names them, not "No markers match"; Tick all shown off with every one shown
// yours; Scan's set card counts a set's colours, the blender said apart; a photo that fails to open after Scan was closed
// leaves the next photo's view alone; a batch that ended early says the photos not read. Each fails on v318.27.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const storage = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318.27',
  [KEY]: JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: [],
    saved: [],
    ...extra,
  }),
});

test('Home’s Markers card: All Copic markers 358 and Ciao 36 Set B 36, as the set list says; Honolulu 120 still 120', async () => {
  const { page, errors } = await openApp({ storage: storage() });
  await idle(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const n of ['All Copic markers', 'Ciao 36 - Set B', 'Honolulu 120']) {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === n)));
      save();
      document.getElementById('mCollection').click();
      document.getElementById('mHome').click();
      out[n] = document.querySelector('.homecard[data-go="collection"] .hcsub').textContent;
    }
    return out;
  });
  assert.deepEqual(r, {
    'All Copic markers': '358 markers',
    'Ciao 36 - Set B': '36 markers',
    'Honolulu 120': '120 markers',
  });
  assert.deepEqual(errors, []);
});

test('Markers’ "skin": Owned says the skin tones in All; none of them yours names them, with Show', async () => {
  const { page, errors } = await openApp({ storage: storage({ mode: 'collection', collView: 'owned' }) });
  await idle(page);
  const look = async (q) => {
    await page.fill('#q', '');
    await page.fill('#q', q);
    await idle(page);
    return page.evaluate(() => ({
      line: (results.querySelector('.famline') || {}).textContent || '',
      more: (results.querySelector('.moreall') || {}).textContent || '',
      empty: (results.querySelector('.empty') || {}).textContent || '',
      cells: results.querySelectorAll('.cell').length,
    }));
  };
  await page.evaluate(() => {
    state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 120')));
    save();
    fullRender();
  });
  const a = await look('skin');
  assert.match(a.line, /^Skin tones \(12\)/);
  assert.equal(a.cells, 12);
  assert.match(a.more, /^60 more in All · Show/);
  await page.evaluate(() => {
    state.owned = new Set(['Ohuhu|B08', 'Ohuhu|B111']);
    save();
    fullRender();
  });
  const b = await look('skin tones');
  assert.match(b.empty, /None of the markers matching “skin tones” are in your collection/);
  assert.match(b.more, /^72 in All · Show/);
  // (Show: All, the 72 skin tones, the search kept)
  await page.click('.moreall .moreshow');
  await idle(page);
  assert.equal(await page.evaluate(() => state.collView), 'all');
  assert.equal(await page.evaluate(() => results.querySelectorAll('.cell').length), 72);
  assert.deepEqual(errors, []);
});

test('Tick all shown is off when every marker shown is yours, and follows a single tick', async () => {
  const { page, errors } = await openApp({ storage: storage({ mode: 'collection', collView: 'all' }) });
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(['Ohuhu|R014']);
    save();
    fullRender();
  });
  await page.fill('#q', 'r014');
  await idle(page);
  const r = await page.evaluate(() => {
    const out = { shown: shownMatches().map((i) => COLORS[i].code), off: ownAllBtn.disabled };
    setOwned(keyIdx('Ohuhu|R014'), false);
    out.afterUntick = ownAllBtn.disabled;
    setOwned(keyIdx('Ohuhu|R014'), true);
    out.afterTick = ownAllBtn.disabled;
    return out;
  });
  assert.deepEqual(r, { shown: ['R014'], off: true, afterUntick: false, afterTick: true });
  assert.deepEqual(errors, []);
});

test('Scan’s set card: "Add all 24", then "24 and a Colorless Blender added to the list"', async () => {
  const { page, errors } = await openApp({ storage: storage() });
  await idle(page);
  const r = await page.evaluate(() => {
    openScan();
    scanHandle('Ohuhu Alcohol Markers 24 Skin Tone Colors Portrait', true);
    const add = [...document.querySelectorAll('#scStat button')].find((b) => /Add all/.test(b.textContent));
    const label = add && add.textContent;
    add.click();
    return { label, stat: document.getElementById('scStat').textContent, list: scanList.length };
  });
  assert.equal(r.label, 'Add all 24 to the list');
  assert.match(r.stat, /24 and a Colorless Blender added to the list/);
  assert.equal(r.list, 25);
  assert.deepEqual(errors, []);
});

test('A photo that fails to open after Scan was closed leaves the next photo’s view as it is', async () => {
  const { page, errors } = await openApp({ storage: storage() });
  await idle(page);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    openScan();
    ocrOk = true;
    // (photo A fails to open after 400 ms; photo B is still opening)
    ocrPhoto = (file) =>
      file.name === 'a.jpg'
        ? new Promise((res, rej) => setTimeout(() => rej(new Error('bad')), 400))
        : new Promise(() => {});
    ocrChosen([new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' })]);
    await wait(50);
    closeScan();
    openScan();
    ocrChosen([new File([new Uint8Array(8)], 'b.jpg', { type: 'image/jpeg' })]);
    await wait(700);
    return {
      say: document.getElementById('ocrSay').textContent,
      run: ocrRun && ocrRun.file.name,
      done: ocrRun && ocrRun.done,
      done_btn: !!document.getElementById('ocrDone'),
    };
  });
  assert.deepEqual(r, { say: 'Opening the photo…', run: 'b.jpg', done: false, done_btn: false });
  assert.deepEqual(errors, []);
});

test('A batch that ended early: Done says "From 2 of 5 photos"; one stopped at its first, the others not read', async () => {
  const { page, errors } = await openApp({ storage: storage() });
  await idle(page);
  const r = await page.evaluate(() => {
    openScan();
    const f = (n) => new File([new Uint8Array(8)], n + '.jpg', { type: 'image/jpeg' });
    const files = [1, 2, 3, 4, 5].map(f);
    ocrQ = {
      files,
      k: 3,
      stop: true,
      per: [
        { added: 2, asked: 0 },
        { added: 1, asked: 0 },
      ],
      n0: 1,
    };
    ocrRun = { n: 2, done: true, added: 1, asked: 0, file: files[1] };
    ocrFinish();
    const early = document.getElementById('scStat').textContent;
    ocrQ = { files: files.slice(0, 3), k: 1, stop: true, per: [{ added: 2, asked: 0 }], n0: 1 };
    ocrRun = { n: 3, done: true, added: 2, asked: 0, file: files[0] };
    ocrFinish();
    return { early, first: document.getElementById('scStat').textContent };
  });
  assert.match(r.early, /From 2 of 5 photos: 3 added to the list/);
  assert.match(r.first, /From the photo: 2 added to the list/);
  assert.match(r.first, /the other 2 photos not read/);
  assert.deepEqual(errors, []);
});
