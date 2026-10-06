// v308 Markers: Add a set says what it added, with Undo (the To buy entries too), and the page stays put; Owned's
// "Running low"; Scan's Add says what's still to choose and lines it couldn't read, and asks "Which R14?"; a search that
// is a list of codes points to Scan; Unowned's orders follow Brands I'd buy; the BGY and YGY greys are listed with the
// greys; Random's empty pile and the small links are easy to read and tap.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

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
  await page.click('#presetHdr');
  await page.check('#presetList input[data-i="0"]'); // Honolulu 24 (has Y26)
  await page.locator('#presetAdd').scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => scrollY);
  await page.click('#presetAdd');
  await idle(page);
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
  await page.check('#presetList input[data-i="0"]');
  await page.click('#presetAdd');
  await idle(page);
  await page.check('#presetList input[data-i="0"]');
  await page.click('#presetAdd');
  await idle(page);
  assert.equal(await toastText(page), 'That set is all in your collection already.');
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
  await page.click('#scanOpen');
  await idle(page);
  await paste(page, 'B015\nR14\nfoo bar\nBGY24');
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
  await page.check('#wcSets input[data-i="0"]');
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
  assert.ok((await h('#wcScan')) >= 24, 'Scan or type their codes: ' + (await h('#wcScan')));
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
