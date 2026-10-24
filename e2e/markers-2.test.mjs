// Markers: the grid, details, sets, To buy, the swatch chart, dry and running low.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  addFromMarkers,
  answerAsks,
  haveSet,
  idle,
  letterGuide,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  scanFromMarkers,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v305-tobuy.test.mjs ----
// v305: a marker that becomes yours leaves To buy (ticked in the grid or its details, or by Tick all shown), unless
// it's marked Running low or dry (that entry is its replacement). Only the toast's Undo puts it back, in its old place;
// unticking it later leaves the list alone. A marker you own that is on the list (from before, or from a backup) says
// "already yours".
// (v308.3: a marker added by hand loses its Running low or Dry mark first, so it leaves the list too.)
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v305',
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
  const WISH = ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28'].map((k, j) => ({
    k,
    why: 'from Match a colour',
    ts: j + 1,
  }));
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      collView: 'all',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      wish: WISH,
      ink: {},
      ...extra,
    });
  const wishKeys = (page) => page.evaluate(() => state.wish.map((w) => w.k));
  const stored = (page) =>
    page.evaluate((KEY) => {
      const v = JSON.parse(localStorage.getItem(KEY));
      return { wish: v.wish.map((w) => w.k), owned: v.owned };
    }, KEY);
  const idx = (page, k) => page.evaluate((k) => keyIdx(k), k);
  const toastText = (page) =>
    page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, ''));
  async function tapCell(page, code) {
    await page.fill('#q', code);
    await idle(page);
    const i = await idx(page, 'Ohuhu|' + code);
    await page.click(`#results .cell[data-i="${i}"]`);
    await idle(page);
  }
  const undo = async (page) => {
    await page.click('#toastAct');
    await idle(page);
  };
  test('To buy: ticking a marker in the grid takes it off the list; Undo puts it back in its place; unticking later doesn’t', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await page.click('#mCollection');
    await idle(page);
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (3)');
    await tapCell(page, 'Y26');
    assert.equal(await toastText(page), 'Added Ohuhu Y26 · taken off To buy');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    assert.deepEqual((await stored(page)).wish, ['Ohuhu|G43', 'Ohuhu|R28'], 'saved');
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (2)');
    // Undo: not yours, and back where it was
    await undo(page);
    assert.equal(await page.evaluate((i) => isOwned(i), await idx(page, 'Ohuhu|Y26')), false);
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
    assert.deepEqual((await stored(page)).wish, ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
    // ticked again, then unticked by a tap (not Undo): the list stays as it is
    await tapCell(page, 'Y26');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    await page.click(`#results .cell[data-i="${await idx(page, 'Ohuhu|Y26')}"]`);
    await idle(page);
    assert.equal(await toastText(page), 'Ohuhu Y26 unticked');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28'], 'unticking doesn’t put it back');
    // and that untick's Undo makes it yours again without touching the list
    await undo(page);
    assert.equal(await page.evaluate((i) => isOwned(i), await idx(page, 'Ohuhu|Y26')), true);
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    // a marker not on the list: the toast is as before
    await tapCell(page, 'Y06');
    assert.equal(await toastText(page), 'Added Ohuhu Y06 to your collection');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    // the marker's details tick box does the same
    await page.evaluate((i) => openMarkerSheet(i), await idx(page, 'Ohuhu|R28'));
    await page.waitForSelector('#mkOverlay.on');
    await page.click('#mkOwn');
    await idle(page);
    assert.equal(await toastText(page), 'Added Ohuhu R28 · taken off To buy');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43']);
    await undo(page);
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    assert.equal(await page.isChecked('#mkOwn'), false);
    assert.deepEqual(errors, []);
  });
  test('To buy: a dry marker you had unticked, ticked again by hand, is fresh: its mark goes and it leaves the list; Undo puts both back', async () => {
    // (v308.3, Ben's decision: ticking a marker back clears its Running low or Dry mark, so it leaves To buy as any added
    // marker does. Before, the mark was kept and the entry stayed as its replacement. An owned marker marked dry still
    // says why it's on the list.)
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ ink: { 'Ohuhu|Y26': 'dry' } }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    await tapCell(page, 'Y26');
    assert.equal(await toastText(page), 'Added Ohuhu Y26 · taken off To buy');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|R28']);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|Y26'] || ''), '');
    await undo(page);
    assert.deepEqual(await wishKeys(page), ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|Y26']), 'dry');
    // one you own, marked dry: its row says why it's there, not "already yours"
    await page.evaluate(() => {
      state.owned.add('Ohuhu|Y26');
      save();
    });
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.match(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y26"] .wwhy'), /· yours is dry$/);
    assert.deepEqual(errors, []);
  });
  test('To buy: a marker you own that is on the list (older data, or a backup) says "already yours"', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ owned: [...OWN, 'Ohuhu|G43'], collView: 'wish' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal(
      await page.textContent('#wishView .wrow[data-k="Ohuhu|G43"] .wwhy'),
      'from Match a colour · already yours',
    );
    assert.equal(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y26"] .wwhy'), 'from Match a colour');
    assert.deepEqual(errors, []);
  });
  test('To buy: Tick all shown takes the markers it adds off the list, says how many, and Undo puts them back', async () => {
    const wish = ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215'].map((k, j) => ({
      k,
      why: 'from Match a colour',
      ts: j + 1,
    }));
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ wish, ink: { 'Ohuhu|R28': 'low' } }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    // shown: R210, R28 and R215 among others; Y26 isn't shown
    // (v308.3: R28, unticked and marked low, is added by hand, so its mark goes and it comes off too; it had stayed)
    await page.fill('#q', 'R2');
    await idle(page);
    const shown = await page.evaluate(() => shownMatches().map((i) => mkey(i)));
    assert.ok(
      ['Ohuhu|R210', 'Ohuhu|R28', 'Ohuhu|R215'].every((k) => shown.includes(k)) &&
        !shown.includes('Ohuhu|Y26'),
      shown.join(' '),
    );
    await page.click('#ownAll');
    await idle(page);
    assert.match(await toastText(page), /^Added \d+ markers · 3 off To buy$/);
    assert.deepEqual(await wishKeys(page), ['Ohuhu|Y26']);
    assert.deepEqual((await stored(page)).wish, ['Ohuhu|Y26']);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|R28'] || ''), '');
    await undo(page);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|R28']), 'low');
    assert.deepEqual(await wishKeys(page), ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215']);
    assert.deepEqual((await stored(page)).wish, ['Ohuhu|R210', 'Ohuhu|Y26', 'Ohuhu|R28', 'Ohuhu|R215']);
    assert.ok(!(await stored(page)).owned.includes('Ohuhu|R210'));
    assert.deepEqual(errors, []);
  });
  test('To buy: with two tabs open, the other tab’s list follows a tick and its Undo', async () => {
    const a = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
    const b = await a.ctx.newPage(),
      errs = [];
    b.on('pageerror', (e) => errs.push(e.message));
    await b.goto(a.page.url());
    await idle(b);
    await b.click('#mCollection');
    await b.click('#ownView [data-v="wish"]');
    await idle(b);
    await a.page.click('#mCollection');
    await idle(a.page);
    await tapCell(a.page, 'Y26');
    await b.waitForFunction(
      () => !state.wish.some((w) => w.k === 'Ohuhu|Y26') && state.owned.has('Ohuhu|Y26'),
      null,
      { timeout: 3000 },
    );
    await b.waitForFunction(() => !document.querySelector('#wishView .wrow[data-k="Ohuhu|Y26"]'), null, {
      timeout: 3000,
    });
    await undo(a.page);
    await b.waitForFunction(
      () =>
        state.wish.map((w) => w.k).join() === 'Ohuhu|G43,Ohuhu|Y26,Ohuhu|R28' &&
        !state.owned.has('Ohuhu|Y26'),
      null,
      { timeout: 3000 },
    );
    // B's next save keeps the list as it is
    await b.click('#ownView [data-v="all"]');
    await idle(b);
    assert.deepEqual((await stored(b)).wish, ['Ohuhu|G43', 'Ohuhu|Y26', 'Ohuhu|R28']);
    assert.deepEqual([...a.errors, ...errs], []);
  });
}

// ---- from v306-smalls.test.mjs ----
// v306 small changes: find by code for a code that's only a highlight or shadow in the guide; "Did any run low?" ›
// Another… says when a marker is already marked (and Escape clears, then closes, its box); the run-low chips follow
// a change to a marker made while they show; the shorter untick toast; a guide smoothed with shading on reopens as
// saved.
{
  // ---- the untick toast ----

  test('the untick toast: “Copic BG0000 unticked” (v318.32 wording), one line at 390 with Undo', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      state.owned.add('Copic|BG0000');
      state.mode = 'collection';
      save();
    });
    await page.reload();
    await idle(page);
    if (await page.isVisible('#mCollection')) await page.click('#mCollection');
    await idle(page);
    await page.fill('#q', 'BG0000');
    await idle(page);
    const i = await page.evaluate(() => keyIdx('Copic|BG0000'));
    await page.click(`#results .cell[data-i="${i}"]`);
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, '')),
      'Copic BG0000 unticked',
    );
    const lines = await page.evaluate(() => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('msToast'));
      return new Set(
        [...r.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top + q.height / 2)),
      ).size;
    });
    assert.equal(lines, 1, 'one line');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate((i) => isOwned(i), i), true, 'Undo: yours again');
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-markers.test.mjs ----
// v308 Markers: Add a set says what it added, with Undo (the To buy entries too), and the page stays put; Owned's
// "Running low"; Scan's Add says what's still to choose and lines it couldn't read, and asks "Which R14?"; a search that
// is a list of codes points to Scan; Unowned's orders follow Brands I'd buy; the BGY and YGY greys are listed with the
// greys; Random's empty pile and the small links are easy to read and tap.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v307',
    'ms-scan-brand': '',
    ...extra,
  });
  const OWN = ['Ohuhu|R014', 'Ohuhu|B08'];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      collView: 'owned',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const paste = (page, text) =>
    page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, text);
  test('Add a set: a toast with Undo that takes the markers out and puts their To buy entries back; the page stays where it was', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({
        [KEY]: appState({
          wish: [
            { k: 'Ohuhu|Y26', why: 'mine', ts: 1 },
            { k: 'Copic|E09', why: 'x', ts: 2 },
          ],
        }),
      }),
    });
    // (v311: from Add markers' sheet, which closes once the set is added)
    await page.click('#mCollection');
    await idle(page);
    const y0 = await page.evaluate(() => scrollY);
    await addFromMarkers(page, 'set');
    await page.check('#wcSets input[data-i="0"]'); // Honolulu 24 (has Y26)
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.isVisible('#welcome'), false, 'the sheet closed');
    assert.ok(
      Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2,
      'stayed: ' + y0 + ' → ' + (await page.evaluate(() => scrollY)),
    );
    const n = await page.evaluate(() => state.owned.size);
    assert.equal(await toastText(page), 'Added ' + (n - 2) + ' markers · 1 off To buy Undo');
    assert.deepEqual(await page.evaluate(() => state.wish.map((w) => w.k)), ['Copic|E09']);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), [...OWN].sort());
    assert.deepEqual(
      await page.evaluate(() => state.wish.map((w) => w.k)),
      ['Ohuhu|Y26', 'Copic|E09'],
      'back where it was',
    );
    // a set you have already: said so
    for (let i = 0; i < 2; i++) {
      await addFromMarkers(page, 'set');
      await page.check('#wcSets input[data-i="0"]');
      await page.click('#wcAdd');
      await idle(page);
    }
    assert.equal(await toastText(page), 'Honolulu 24 is already in your collection.');
    assert.deepEqual(errors, []);
  });
  test('Owned › Running low · 2 lists only the markers marked running low or dry', async () => {
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: onboarded({
        [KEY]: appState({
          owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y26'],
          ink: { 'Ohuhu|B08': 'low', 'Ohuhu|Y26': 'low' },
        }),
      }),
    });
    await page.waitForSelector('#lowChip', { state: 'visible' });
    assert.equal(await page.textContent('#lowChip'), 'Running low · 2');
    assert.equal(await page.locator('#results .cell').count(), 3);
    await page.click('#lowChip');
    await idle(page);
    assert.equal(await page.getAttribute('#lowChip', 'aria-pressed'), 'true');
    assert.deepEqual(
      await page.$$eval('#results .cell', (c) => c.map((x) => COLORS[+x.dataset.i].code).sort()),
      ['B08', 'Y26'],
    );
    assert.match(await page.textContent('#ownHint'), /running low or dry/);
    // not in the other views
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    assert.equal(await page.isVisible('#lowChip'), false);
    // and gone once none is marked
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    await page.evaluate(() => {
      state.ink = {};
      save();
      fullRender();
    });
    assert.equal(await page.isVisible('#lowChip'), false);
    assert.equal(await page.locator('#results .cell').count(), 3, 'all yours again');
    assert.deepEqual(errors, []);
  });
  test('Scan: Add says what’s still to choose and the lines it couldn’t read, with Open; an old code asks “Which R14?”', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanFromMarkers(page);
    await idle(page);
    // (v317: a line of plain words beside codes isn't counted, a tray photo's names and noise; one with a digit is)
    await paste(page, 'B015\nR14\nfoo 7 bar\nBGY24');
    await idle(page);
    assert.match(await page.textContent('#scStat'), /1 line not read/);
    assert.ok((await page.textContent('#scList')).includes('Which R14?'));
    await page.click('#scAdd');
    await idle(page);
    assert.equal(
      await toastText(page),
      'Added 2 markers to your collection · 1 still to choose · 1 line not read Undo Open',
    );
    await page.click('#toastAct2');
    await idle(page);
    assert.ok(await page.isVisible('#scanOverlay'), 'Open: back to the question');
    assert.ok((await page.textContent('#scList')).includes('Which R14?'));
    assert.deepEqual(errors, []);
  });
  test('a search that is a list of codes points to Scan or type codes, which reads them', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.fill('#q', 'b02, b03');
    await idle(page);
    assert.match(await page.textContent('#results'), /looks like a list of codes/);
    await page.click('#results .mkscanlist');
    await idle(page);
    assert.ok(await page.isVisible('#scanOverlay'));
    const codes = await page.$$eval('#scList .scrow', (r) => r.map((x) => x.textContent));
    assert.ok(codes.some((t) => /B02/.test(t)) && codes.some((t) => /B03/.test(t)), codes.join(' / '));
    assert.deepEqual(errors, []);
  });
  test('Unowned › Fill the biggest gaps for an Ohuhu-only collection: Ohuhu first; the BGY and YGY greys are Blue Grey and Yellow Grey, with the greys', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await haveSet(page);
    await page.check('#wcSets input[data-i="0"]');
    await haveSet(page);
    await page.check('#wcSets input[data-i="1"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await page.click('#mCollection');
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    await page.selectOption('#gapSort', 'gap');
    await idle(page);
    const first = await page.$$eval('#results .cell', (c) =>
      c.slice(0, 40).map((x) => COLORS[+x.dataset.i].brand),
    );
    assert.deepEqual([...new Set(first)], ['Ohuhu']);
    await page.selectOption('#gapSort', 'code');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    const heads = await page.$$eval('#results .rghead', (h) =>
      h.map((x) => x.firstChild.nextSibling.textContent.trim()),
    );
    assert.ok(heads.includes('Blue Grey') && heads.includes('Yellow Grey'), heads.join(', '));
    assert.ok(
      heads.indexOf('Blue Grey') > heads.indexOf('Warm Grey') &&
        heads.indexOf('Yellow Grey') > heads.indexOf('Warm Grey'),
      'with the greys',
    );
    assert.ok(!heads.some((h) => /Green-Yellow/.test(h)));
    assert.deepEqual(errors, []);
  });
  test('Random’s empty pile reads across the grid; the welcome’s Scan link and Hide text are at least 24px to tap', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const h = (sel) => page.$eval(sel, (e) => e.getBoundingClientRect().height);
    // (v309: the link in the set list is "Not sure which? Find it from 3 caps")
    await haveSet(page);
    assert.ok((await h('#wcToFind')) >= 24, 'Find it from 3 caps: ' + (await h('#wcToFind')));
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => setMode('random'));
    await idle(page);
    const w = await page.evaluate(() => [
      document.getElementById('pileEmpty').getBoundingClientRect().width,
      document.getElementById('pile').getBoundingClientRect().width,
    ]);
    assert.ok(w[0] >= w[1] - 2, 'across: ' + w.join(' of '));
    await page.evaluate(() => openBackup());
    await page.click('#backupShow');
    assert.equal(await page.textContent('#backupShow'), 'Hide text');
    assert.ok((await h('#backupShow')) >= 24, 'Hide text: ' + (await h('#backupShow')));
    assert.deepEqual(errors, []);
  });
}

// ---- from v3081-d2.test.mjs ----
// v308.2 (reviewer 2: Markers and Palette): marking a marker Running low or Dry in its details shows Owned's
// "Running low · N" straight away (it waited for the next view change); Palette's Rainbow offers only the sizes the
// markers in play can fill (with 12 markers, 14 and 16 were offered and Generate refused them); Save image's file
// is named for the palette.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v307',
    'ms-scan-brand': '',
    ...extra,
  });
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      collView: 'owned',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y26'],
      saved: [],
      ...extra,
    });
  const ink = async (page, code, v) => {
    await page.evaluate(
      (c) => openMarkerSheet(COLORS.findIndex((x) => x.brand === 'Ohuhu' && x.code === c)),
      code,
    );
    await idle(page);
    await page.click(`#mkInk [data-ink="${v}"]`);
    await idle(page);
    await page.click('#mkClose');
    await idle(page);
  };
  test('marking a marker Running low or Dry in its details shows Owned’s Running low chip at once, and its count follows', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await page.waitForSelector('#results .cell');
    assert.equal(await page.isVisible('#lowChip'), false, 'none marked yet');
    await ink(page, 'B08', 'low');
    assert.equal(await page.isVisible('#lowChip'), true, 'the chip once one is marked');
    assert.equal(await page.textContent('#lowChip'), 'Running low · 1');
    await ink(page, 'Y26', 'dry');
    assert.equal(await page.textContent('#lowChip'), 'Running low or dry · 2');
    // back to OK: the count follows, and the chip goes once none is marked
    await ink(page, 'Y26', '');
    assert.equal(await page.textContent('#lowChip'), 'Running low · 1');
    await ink(page, 'B08', '');
    assert.equal(await page.isVisible('#lowChip'), false);
    assert.equal(await page.locator('#results .cell').count(), 3);
    assert.deepEqual(errors, []);
  });
  test('Palette › Rainbow with 12 markers: sizes stop at 12, a bigger size moves down, and Generate works', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.harmony = 'rainbow';
      state.palSize = 16;
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Ciao 12')));
      save();
    });
    await page.click('#mPalette');
    await idle(page);
    const shown = () =>
      page.$$eval('#segs [data-n]', (b) =>
        b.filter((x) => !x.disabled && x.style.display !== 'none').map((x) => +x.dataset.n),
      );
    assert.deepEqual(await shown(), [6, 8, 10, 12]);
    assert.equal(await page.evaluate(() => state.palSize), 12, '16 moved down to 12');
    assert.equal(
      await page.isDisabled('#draw'),
      false,
      'Generate works: ' + (await page.textContent('#draw')),
    );
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    assert.equal(await page.evaluate(() => state.palettes[state.palettes.length - 1].length), 11);
    // a bigger collection offers them all again
    await page.evaluate(() => {
      presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k));
      save();
      fullRender();
    });
    await idle(page);
    assert.deepEqual(await shown(), [6, 8, 10, 12, 14, 16]);
    assert.deepEqual(errors, []);
  });
  test('Palette: a size the markers in play can no longer fill moves down, and the Colours row shows the one it moved to', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.harmony = 'complementary';
      state.palSize = 8;
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Ciao 12')));
      save();
    });
    await page.click('#mPalette');
    await idle(page);
    const n = await page.evaluate(() => state.palSize);
    assert.ok(n < 8, 'moved down: ' + n);
    assert.equal(await page.getAttribute(`#segs [data-n="${n}"]`, 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('Palette › Save image: the file is named for the palette, as its card is', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await idle(page);
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    const name = (await page.textContent('#readout .name')).trim();
    await page.click('#libMore');
    await page.click('#exportBtn');
    await until(page, () => !!document.getElementById('cardImg').getAttribute('src'), null, 'the card');
    const want =
      name
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '') + '.png';
    assert.equal(await page.getAttribute('#dlLink', 'download'), want);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3091-d3.test.mjs ----
// v309.2 (reviewer 3): Markers and Palette.
{
  const seeded = (owned, extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ohuhu-hb320-picker-v3': JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned,
      saved: [],
      ...extra,
    }),
  });
  test('Palette with only a Colorless Blender (or dry markers): says so and leads to Markers, not "Clear filters"', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: seeded(['Ohuhu|0', 'Ohuhu|R16'], { ink: { 'Ohuhu|R16': 'dry' } }),
    });
    await idle(page);
    await page.click('[data-go="palette"]');
    await idle(page);
    const say = (await page.textContent('#palNone')).replace(/\s+/g, ' ');
    assert.match(say, /None of your markers lays down colour/);
    assert.doesNotMatch(say, /filters/);
    await page.click('#palNoneClear');
    await idle(page);
    assert.equal(await page.evaluate(() => state.mode), 'collection');
    assert.deepEqual(errors, []);
  });
  test('Palette with a filter that leaves none still offers Clear filters', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: seeded(['Ohuhu|R16']) });
    await idle(page);
    await page.click('[data-go="palette"]');
    await idle(page);
    // (only the Blue family: none of R16's)
    await page.evaluate(() => {
      fgTap('fam', 'Blue');
      filterChanged();
    });
    await idle(page);
    const say = (await page.textContent('#palNone')).replace(/\s+/g, ' ');
    assert.match(say, /No markers match these filters · Clear filters/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3101-d3.test.mjs ----
// v310.1 (reviewer 3): Markers and Palette.
{
  const seeded = (owned, extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ohuhu-hb320-picker-v3': JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned,
      saved: [],
      ...extra,
    }),
  });
  // Honolulu 48's colours (no blender), set up in the page and kept
  async function own48(page, extra = {}) {
    await page.evaluate((extra) => {
      const p = MARKER_SETS.find((x) => x.n === 'Honolulu 48');
      state.owned = new Set(presetMkeys(p).filter((k) => k !== 'Ohuhu|0'));
      Object.assign(state, extra);
      save();
    }, extra);
    await page.reload();
    await idle(page);
  }
  // a set's count in the sets list (v311: Add markers' sheet's, opened afresh and closed again)
  async function row(page, name) {
    await addFromMarkers(page, 'set');
    const t = await page.evaluate(
      (name) =>
        [...document.querySelectorAll('#wcSets .presetrow')]
          .filter((r) => r.querySelector('.presetnm').textContent === name)
          .map((r) => r.querySelector('.presetn').textContent)[0],
      name,
    );
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await idle(page);
    return t;
  }
  // (v311: the list is in Add markers' sheet, drawn as it opens: the counts as the collection is then)
  test('the sets list counts the collection as it is: after a marker ticked in the grid, Tick all shown, and their Undo', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: seeded(['Ohuhu|Y06']) });
    await idle(page);
    await own48(page);
    assert.equal(await row(page, 'Honolulu 48'), '✓ 48');
    // one of the 48's markers unticked in the grid
    const i = await page.evaluate(() => keyIdx('Ohuhu|R014'));
    await page.click(`#results .cell[data-i="${i}"]`);
    await idle(page);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await row(page, 'Honolulu 48'), '✓ 48');
    await page.click(`#results .cell[data-i="${i}"]`);
    await idle(page);
    assert.equal(await row(page, 'Honolulu 48'), '47/48');
    assert.equal(await row(page, 'Honolulu 72'), '46/72');
    // Tick all shown: GG03 and GG05 (in the 72) and GG07 (not), by search
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    await page.fill('#q', 'GG0');
    await idle(page);
    await page.click('#ownAll');
    await idle(page);
    assert.equal(await row(page, 'Honolulu 72'), '48/72');
    assert.deepEqual(errors, []);
  });
  test('Add a set: the Colorless Blender an Ohuhu set brings is said, so the count adds up', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: seeded(['Ohuhu|Y06'], { wish: [{ k: 'Ohuhu|R16', why: 'y', ts: 2 }] }),
    });
    await idle(page);
    await own48(page);
    const n0 = await page.evaluate(() => state.owned.size);
    assert.equal(await row(page, 'Honolulu 120'), '47/120');
    await addFromMarkers(page, 'set');
    await page.check('#wcSets input[data-i="3"]'); // Honolulu 120
    await page.click('#wcAdd');
    await idle(page);
    const n1 = await page.evaluate(() => state.owned.size);
    assert.equal(n1 - n0, 74);
    assert.equal(
      (await page.textContent('#msToast')).replace(/\s+/g, ' ').trim(),
      'Added 73 markers and a Colorless Blender · 1 off To buy Undo',
    );
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), n0);
    // a set with no blender (Honolulu 24, inside the 48): said to be yours already
    await addFromMarkers(page, 'set');
    await page.check('#wcSets input[data-i="0"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /^Honolulu 24 is already in your collection\./);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3102.test.mjs ----
// v310.2: Ben's decisions from the v310.1 pass. An open guide follows a marker marked dry or unticked in Markers as
// opening it again would (sections still to colour show the closest you own; coloured ones keep theirs; the guide
// keeps the marker; back when it's yours again; not an Undo step); a locked Palette colour that can't be used is
// unlocked on Generate, with a word; Undo on "Page straightened" leaves "Page kept as photographed · Straighten";
// Home's guide card counts the colours guides use, saying how many marked dry are left out.
{
  // a marker the guide uses in at least 3 sections, one of them coloured
  async function pickMarker(page) {
    return page.evaluate(() => {
      const t = __mstest,
        by = {};
      for (const l in t.assignData.assign)
        (by[t.assignData.assign[l].mkey] = by[t.assignData.assign[l].mkey] || []).push(+l);
      const k = Object.keys(by).find((x) => by[x].length >= 3);
      t.colored[by[k][0]] = 1;
      return { k, secs: by[k] };
    });
  }
  const keysOf = (page, secs) => page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), secs);
  // to Markers, a change there, and back to the guide (as a tester would)
  async function viaMarkers(page, fn, arg) {
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate(fn, arg);
    await page.click('#mSections');
    await idle(page);
  }
  test('a marker marked dry in Markers: the open guide’s sections still to colour show the closest you own, as reopening would; back when it isn’t', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const { k, secs } = await pickMarker(page);
    const n0 = await page.evaluate(() => __mstest.assign.planStack.length);
    await viaMarkers(
      page,
      (k) => {
        state.ink[k] = 'dry';
        save();
        chrome();
      },
      k,
    );
    const after = await keysOf(page, secs);
    assert.equal(after[0], k, 'the coloured section keeps its marker');
    assert.ok(
      after.slice(1).every((x) => x !== k),
      'the others show a stand-in',
    );
    assert.match(
      await page.evaluate(() => document.body.innerText),
      /1 marker is dry — sections still to colour show the closest you own\. The guide keeps it until you change those sections\./,
    );
    // the guide still keeps the marker; the swap isn't an Undo step
    const kept = await page.evaluate(
      ([k, secs]) => {
        const d = __mstest.currentDesignObj();
        return secs.filter((l) => d.payload.assign[l] === k).length;
      },
      [k, secs],
    );
    assert.equal(kept, secs.length);
    assert.equal(await page.evaluate(() => __mstest.assign.planStack.length), n0);
    // marked as having ink again: back in its sections
    await viaMarkers(
      page,
      (k) => {
        delete state.ink[k];
        save();
        chrome();
      },
      k,
    );
    assert.ok((await keysOf(page, secs)).every((x) => x === k));
    assert.deepEqual(errors, []);
  });
  test('a marker unticked in Markers: "no longer in your collection"; ticked again, it’s back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const { k, secs } = await pickMarker(page);
    await viaMarkers(
      page,
      (k) => {
        state.owned.delete(k);
        save();
        chrome();
      },
      k,
    );
    assert.ok((await keysOf(page, secs)).slice(1).every((x) => x !== k));
    assert.match(
      await page.evaluate(() => document.body.innerText),
      /1 marker is no longer in your collection — sections still to colour/,
    );
    // a change after it is one Undo step, its own
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    const st = await page.evaluate(() => __mstest.assign.planStack.map((e) => e.label));
    assert.equal(st[st.length - 1], 'Mood: Bright');
    // the coloured section keeps the marker it's coloured with, through the change
    assert.equal((await keysOf(page, secs))[0], k);
    await page.click('#sfPlanUndo');
    await idle(page);
    await viaMarkers(
      page,
      (k) => {
        state.owned.add(k);
        save();
        chrome();
      },
      k,
    );
    assert.ok((await keysOf(page, secs)).every((x) => x === k));
    assert.deepEqual(errors, []);
  });
}

// ---- from v311-markers.test.mjs ----
// v311: Markers' Add markers. With a collection, + Add markers at the top opens a sheet (the welcome's card) with the
// ways to add (a set, Scan, the chart) and "Not sure which set you have? Find it from 3 caps"; with none yet, the same
// ways are in a card at the top. Find ends where it started: a set added closes the sheet with the usual message and
// Undo; "None of these" goes back to the ways. Clear collection is in ⋯.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const coll = (owned) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    [KEY]: JSON.stringify({
      mode: 'collection',
      collView: 'owned',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned,
      saved: [],
    }),
  });
  const h48 = (page) => page.evaluate(() => presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 48')));
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.getClientRects().length > 0;
    }, id);
  const step = (page) =>
    page.evaluate(() =>
      document.getElementById('welcome').classList.contains('on')
        ? [...document.querySelectorAll('#welcome .wcstep')]
            .filter((e) => e.style.display !== 'none')
            .map((e) => e.id)[0]
        : null,
    );
  const focused = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
  async function scanCaps(page, codes) {
    for (const c of codes) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
    await page.click('#scAdd');
    await idle(page);
  }
  async function withH48(w = 820, h = 1180) {
    const a = await openApp({ width: w, height: h, storage: coll([]) });
    await a.page.evaluate(() => {
      presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 48')).forEach((k) => state.owned.add(k));
      save();
    });
    await a.page.reload();
    await idle(a.page);
    return a;
  }
  test('with a collection: + Add markers on the first screen opens the ways to add; Escape closes it, back on the button', async () => {
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await withH48(w, h);
      assert.ok(await shown(page, 'mkAddBtn'));
      assert.ok((await page.locator('#mkAddBtn').boundingBox()).y < h, w + ': on the first screen');
      assert.equal(await shown(page, 'mkAddCard'), false);
      await page.click('#mkAddBtn');
      await idle(page);
      assert.equal(await step(page), 'wcStepAdd');
      assert.equal(await page.textContent('#wcTA'), 'Add markers');
      assert.deepEqual(await page.$$eval('#wcAddWays .wcc b', (b) => b.map((x) => x.textContent)), [
        'Add a set you own',
        // (v318: where the photo reader runs, as in Chromium and WebKit here)
        'Photograph your caps',
        'Scan or type codes',
        'Tick colours on a chart',
      ]);
      assert.match(
        await page.textContent('#wcAddWays .mkfind'),
        /Not sure which set you have\? Find it from 3 caps/,
      );
      // (none of the welcome's first-run lines)
      assert.equal(await shown(page, 'wcSkip'), false);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        'no sideways scroll',
      );
      await page.keyboard.press('Escape');
      await idle(page);
      assert.equal(await step(page), null);
      assert.equal(await focused(page), 'mkAddBtn');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Add a set you own from the sheet: added with the message and Undo, the sheet closed; Back from the list to the ways', async () => {
    const { page, errors } = await withH48();
    await page.click('#mkAddBtn');
    await page.click('#mkaSet');
    await idle(page);
    assert.equal(await step(page), 'wcStep1');
    // Back: the ways again
    await page.click('#wcStep1 .wcback');
    assert.equal(await step(page), 'wcStepAdd');
    await page.click('#mkaSet');
    const n0 = await page.evaluate(() => state.owned.size);
    // (what Honolulu 120 brings that Honolulu 48 didn't)
    const add = await page.evaluate(
      () => presetMkeys(MARKER_SETS[3]).filter((k) => !state.owned.has(k)).length,
    );
    assert.ok(add >= 72, 'new: ' + add);
    await page.check('#wcSets input[data-i="3"]'); // Honolulu 120
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await step(page), null, 'closed, no "Anything else?"');
    assert.equal(await page.evaluate(() => state.owned.size), n0 + add);
    assert.match(
      await page.textContent('#msToast'),
      new RegExp('^Added ' + add + ' markers to your collection'),
    );
    assert.equal(await focused(page), 'mkAddBtn');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), n0);
    assert.deepEqual(errors, []);
  });
  test('Find it from 3 caps from the sheet: Yes adds the set (its blender said) and closes; None of these goes back to the ways', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: coll(['Ohuhu|Y06']) });
    await idle(page);
    await page.click('#mkAddBtn');
    await page.click('#mkaFind');
    await idle(page);
    assert.equal(await step(page), 'wcStepFind');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await idle(page);
    await scanCaps(page, ['R014', 'Y28', 'BG314']);
    assert.equal(await step(page), 'wcStepRes');
    assert.equal(await page.textContent('#wcFindNone'), 'None of these: other ways to add');
    await page.click('#wcFindNone');
    assert.equal(await step(page), 'wcStepAdd');
    // and again, to Yes
    await page.click('#mkaFind');
    await page.click('#wcFindNext');
    await idle(page);
    await scanCaps(page, ['R014', 'Y28', 'BG314']);
    await page.click('#wcFindYes');
    await idle(page);
    assert.equal(await step(page), null);
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.has('Ohuhu|R014')));
    assert.match(await page.textContent('#msToast'), /^Added 1\d\d markers and a Colorless Blender/);
    assert.equal(await focused(page), 'mkAddBtn');
    // Scan's own list is as it was (Find's caps kept apart)
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list') || '[]')), []);
    assert.deepEqual(errors, []);
  });
  test('a set found that is yours already: said so, nothing added', async () => {
    const { page, errors } = await withH48();
    const n0 = await page.evaluate(() => state.owned.size);
    await page.click('#mkAddBtn');
    await page.click('#mkaFind');
    await page.click('#wcFCount [data-n="1"]');
    await page.click('#wcFindNext');
    await idle(page);
    const caps = (await h48(page))
      .filter((k) => k !== 'Ohuhu|0')
      .slice(0, 3)
      .map((k) => k.split('|')[1]);
    await scanCaps(page, caps);
    assert.match(await page.textContent('#wcRes'), /Honolulu 48/);
    await page.click('#wcFindYes');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), n0);
    assert.equal(await page.textContent('#msToast'), 'Honolulu 48 is already in your collection.');
    assert.deepEqual(errors, []);
  });
  test('Scan or the chart from the sheet: the sheet closes, the tool opens as always; closed, the keyboard on Add markers', async () => {
    const { page, errors } = await withH48();
    for (const [row, ov, x] of [
      ['#mkaScan', 'scanOverlay', '#scClose'],
      ['#mkaChart', 'chartOverlay', '#chClose'],
    ]) {
      await page.click('#mkAddBtn');
      await page.click(row);
      await idle(page);
      assert.equal(await step(page), null);
      assert.ok(await page.evaluate((id) => document.getElementById(id).classList.contains('on'), ov));
      await page.click(x);
      await idle(page);
      assert.equal(await focused(page), 'mkAddBtn', row);
    }
    assert.deepEqual(errors, []);
  });
  test('no markers yet: the ways in a card at the top; Find from it opens on its own, and Back closes it; the first set shows the top', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: coll([]) });
    await idle(page);
    assert.ok(await shown(page, 'mkAddCard'));
    assert.equal(await shown(page, 'mkAddBtn'), false);
    assert.ok((await page.locator('#mkcSet').boundingBox()).y < 844, 'on the first screen');
    assert.match(
      await page.textContent('#findResults'),
      /Your collection is empty\. Add your markers above, or switch to All/,
    );
    await page.click('#mkcFind');
    await idle(page);
    assert.equal(await step(page), 'wcStepFind');
    await page.click('#wcStepFind .wcback');
    await idle(page);
    assert.equal(await step(page), null);
    assert.equal(await focused(page), 'mkcFind');
    // None of these, from Find opened on its own: the ways, Back from which closes
    await page.click('#mkcFind');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await idle(page);
    await scanCaps(page, ['R014']);
    await page.click('#wcFindNone');
    assert.equal(await step(page), 'wcStepAdd');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await step(page), null);
    // a set from the card: the card goes, the top of the collection and Add markers
    await page.click('#mkcSet');
    await page.check('#wcSets input[data-i="1"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await shown(page, 'mkAddCard'), false);
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal(await focused(page), 'mkAddBtn');
    assert.deepEqual(errors, []);
  });
  test('Clear collection in ⋯: the first tap asks with the menu open, a double tap doesn’t clear, the second clears; Undo', async () => {
    const { page, errors } = await withH48();
    const n0 = await page.evaluate(() => state.owned.size);
    await page.click('#mkMore');
    assert.deepEqual(
      await page.$$eval('#mkMenu button', (b) =>
        b.filter((x) => x.style.display !== 'none').map((x) => x.textContent.trim()),
      ),
      // (v318.21: and the codes on your caps, with Ohuhu markers of yours)
      [
        'Untick all shown',
        'Clear collection',
        'Show the codes on older Ohuhu caps (R6, not R213)',
        'Back up & restore (in the Library)',
      ],
    );
    assert.match(await page.getAttribute('#mkMore', 'aria-label'), /Clear collection/);
    await page.dblclick('#mkClear');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), n0, 'a double tap only asks');
    assert.ok(await page.isVisible('#mkMenu'));
    assert.match(await page.textContent('#mkClear'), /^Clear all \d+ markers\? Tap again$/);
    await pause(page, 450, 'its second tap, not a double tap');
    await page.click('#mkClear');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.equal(await page.isVisible('#mkMenu'), false);
    assert.match(await page.textContent('#msToast'), new RegExp('^Cleared ' + n0 + ' markers'));
    assert.ok(await shown(page, 'mkAddCard'), 'the ways to add at the top again');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), n0);
    // nothing to clear: not offered
    await page.evaluate(() => {
      state.owned.clear();
      save();
      fullRender();
    });
    await page.click('#mkMore');
    assert.equal(await page.isVisible('#mkClear'), false);
    assert.deepEqual(errors, []);
  });
  test('larger text: the button, the card and the sheet fit a phone and an iPad without sideways scroll', async () => {
    for (const [w, h, owned] of [
      [390, 844, true],
      [390, 844, false],
      [820, 1180, true],
    ]) {
      const { page, errors, ctx } = await openAtScale(1.6, {
        width: w,
        height: h,
        storage: coll(owned ? ['Ohuhu|Y06', 'Ohuhu|R014'] : []),
      });
      await idle(page);
      const wide = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      assert.ok(await wide(), w + ' page');
      await page.click(owned ? '#mkAddBtn' : '#mkcSet');
      await idle(page);
      assert.ok(await wide(), w + ' sheet');
      const fits = await page.evaluate(() => {
        const c = document.querySelector('#welcome .wcard').getBoundingClientRect();
        return c.left >= 0 && c.right <= innerWidth + 1;
      });
      assert.ok(fits, w + ' card in view');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v313-polish.test.mjs ----
// v313 polish (D11): Markers' line about the view under its row; Palette's Undo, Clear, Save and ⋯ on one row; the
// Library's empty state (what's kept there, Try the sample, no search box); the guide's start card in Home's words;
// Edit sections' shorter intro; the shimmer three times; the sample's ticks not on Home's Continue card until it's
// printed or renamed; Continue's "Last coloured N days ago". Each test fails on v312.
{
  const box = (page, s) => page.locator(s).boundingBox();
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
}

// ---- from v316-tobuy.test.mjs ----
// v316: To buy's "From your guides" — the markers your saved guides' blend plans would ask you to buy, across the
// Library without opening a guide, each with the plan's reason and how many guides want it, and the markers a guide
// uses that are dry; a tap adds one, Add all the rest. After your own list, above Brands I'd buy. Fails on v315.
{
  async function withGuide(page) {
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    await page.click('#mCollection');
    await idle(page);
  }
  // a collection, then To buy shown again
  const own = (page, set) =>
    page.evaluate((set) => {
      state.owned =
        set === 'ben' ? defaultOwned() : new Set(presetMkeys(MARKER_SETS.find((p) => p.n === set)));
      save();
      fullRender();
    }, set);
  const toBuy = async (page) => {
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
  };
  const rows = (page) =>
    page.$$eval('.gbuy .gbrow', (a) =>
      a.map((r) => ({
        k: r.querySelector('[data-wk]').dataset.wk,
        why: r.querySelector('.gbwhy').textContent,
      })),
    );
  test('no guides: no card; your markers with a guide: every blend complete, nothing to buy', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await toBuy(page);
    assert.equal(await page.$('.gbuy'), null, 'no guides');
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    await page.click('#mCollection');
    await own(page, 'ben');
    await toBuy(page);
    assert.match(await page.textContent('.gbuy.ok'), /Every blend in your guide is complete/);
    assert.deepEqual(errors, []);
  });
  test('a 24-marker set: the blend plan’s markers to buy with its reasons; one added with its reason, then all; a dry marker the guide uses', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await withGuide(page);
    await own(page, 'Honolulu 24');
    await toBuy(page);
    // the rows are what the guide's own markers want, as its plan finds them
    const want = await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      return Object.keys(SF.guideWants(g.keys, g.fr, sfCollection(), {}).want).sort();
    });
    const r = await rows(page);
    assert.ok(want.length >= 2, 'wants: ' + want.length);
    assert.deepEqual(r.map((x) => x.k).sort(), want);
    for (const x of r) assert.match(x.why, /^(Lighter|Darker) than .+ · your guide$/);
    assert.match(
      await page.textContent('.gbsum'),
      new RegExp('^' + want.length + ' markers would complete every blend in your guide\\.$'),
    );
    // one added: on the list with the plan's reason, out of the card
    await page.click('.gbuy .gbrow [data-wk]');
    await idle(page);
    const w = await page.evaluate(() => state.wish.map((x) => x.why));
    assert.equal(w.length, 1);
    assert.match(w[0], /^blend for \S+$/);
    assert.equal((await rows(page)).length, want.length - 1);
    assert.match(await page.textContent('.gbsum'), /· 1 on your list\.$/);
    // the card after the list and Copy list, above Brands I'd buy
    const at = await page.evaluate(() => ({
      acts: document.querySelector('.wishacts').getBoundingClientRect().bottom,
      card: document.querySelector('.gbuy').getBoundingClientRect().top,
    }));
    assert.ok(at.card >= at.acts, 'after Copy list');
    await page.click('.gbuy .wishall');
    await idle(page);
    assert.equal(await page.evaluate(() => state.wish.length), want.length);
    assert.match(await page.textContent('.gbuy.ok'), /all on your list/);
    // a marker the guide uses, now marked dry (still yours, but left out of plans): offered for a refill
    const k = await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide'),
        k = g.keys.find((x) => state.owned.has(x));
      state.ink[k] = 'dry';
      save();
      fullRender();
      return k;
    });
    await idle(page);
    const d = (await rows(page)).find((x) => x.k === k);
    assert.ok(d, 'the dry marker offered');
    assert.equal(d.why, 'Dry · your guide uses it');
    assert.deepEqual(errors, []);
  });
  test('a phone: the card after your list, every reason under its marker; a row saved before v316 (no rule) still read', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await withGuide(page);
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      delete g.fr;
      state.wish = [];
      save();
    });
    await own(page, 'Honolulu 24');
    await toBuy(page);
    assert.ok((await rows(page)).length >= 2);
    const lay = await page.$$eval('.gbuy .gbrow', (a) =>
      a.map(
        (r) =>
          r.querySelector('.gbwhy').getBoundingClientRect().top -
          r.querySelector('.gbwho').getBoundingClientRect().bottom,
      ),
    );
    for (const g of lay) assert.ok(g >= 0, 'reason under its chip: ' + g);
    assert.deepEqual(errors, []);
  });
  test('the card asks for what the guide’s own blend plan asks for, its stand-ins’ companions included (markers it was planned with that aren’t yours now)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await withGuide(page);
    await own(page, 'Honolulu 24');
    await toBuy(page);
    const card = (await rows(page)).map((x) => x.k).sort();
    // the guide, open again with the smaller set: its plan's "To complete every blend, add …"
    await page.click('#mSections');
    await idle(page);
    await page.click('#sfTab-share');
    await idle(page);
    await page.click('#sfPlan');
    await idle(page);
    const plan = (await page.$$eval('#sfPlanBuy [data-wk]', (a) => a.map((b) => b.dataset.wk))).sort();
    assert.ok(plan.length >= 2, 'the plan asks for ' + plan.length);
    assert.deepEqual(card, plan);
    assert.deepEqual(errors, []);
  });
}
