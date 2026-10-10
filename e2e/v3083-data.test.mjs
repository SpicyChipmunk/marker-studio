// v308.3 (data): a marker added back by hand (ticked, Add a set, Scan's Add) loses its Running low or Dry mark, and
// leaves To buy; Undo, and a restore, keep marks as they were. Copic's fluorescent cap codes (FB2, FY1…) with Ohuhu
// chosen in Scan are asked about as another brand's. Markers' search shows the families its words name when no name
// matches ("skin"), and offers them in a line when names do ("red").
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, idle, scanFromMarkers, addFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const SHOTS = process.env.V3083_SHOTS || '';
const onboarded = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v308.2',
  'ms-scan-brand': '',
  ...extra,
});
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|Y26'];
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
    wish: [],
    ink: {},
    ...extra,
  });
const Y26 = 'Ohuhu|Y26';
const idx = (page, k) => page.evaluate((k) => keyIdx(k), k);
const toastText = (page) =>
  page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, ''));
const undo = async (page) => {
  await page.click('#toastAct');
  await idle(page);
};
// whether it's yours, its mark, on To buy, in the palettes' pool and the guides' markers; and as saved
const where = (page, k) =>
  page.evaluate(
    ([k, KEY]) => {
      const i = keyIdx(k),
        v = JSON.parse(localStorage.getItem(KEY));
      return {
        owned: state.owned.has(k),
        ink: state.ink[k] || '',
        wish: isWished(k),
        pool: inPool(i),
        guides: sfCollection().some((m) => m.mkey === k),
        saved: { owned: v.owned.includes(k), ink: (v.ink || {})[k] || '' },
      };
    },
    [k, KEY],
  );
async function tapCell(page, code) {
  await page.fill('#q', code);
  await idle(page);
  await page.click(`#results .cell[data-i="${await idx(page, 'Ohuhu|' + code)}"]`);
  await idle(page);
}
const dryOn = (wish) =>
  onboarded({
    [KEY]: appState({ ink: { [Y26]: 'dry' }, wish: wish ? [{ k: Y26, why: 'ran dry', ts: 1 }] : [] }),
  });

test('Ticked back in the grid, a dry marker is fresh again (in palettes and guides, off To buy); Undo puts its mark back; Undo of the untick keeps it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: dryOn(true) });
  await page.click('#mCollection');
  await idle(page);
  const yours = {
    owned: true,
    ink: 'dry',
    wish: true,
    pool: false,
    guides: false,
    saved: { owned: true, ink: 'dry' },
  };
  assert.deepEqual(await where(page, Y26), yours, 'dry: left out of palettes and guides');
  // unticked: the mark stays with it (only an add by hand clears it)
  await tapCell(page, 'Y26');
  assert.equal(await toastText(page), 'Removed Ohuhu Y26');
  assert.equal((await where(page, Y26)).ink, 'dry');
  // that untick's Undo: exactly as it was, mark and all
  await undo(page);
  assert.deepEqual(await where(page, Y26), yours, 'Undo of the untick keeps the mark');
  // unticked, then ticked again by hand: no longer dry, back in palettes and guides, and off To buy
  await tapCell(page, 'Y26');
  await page.click(`#results .cell[data-i="${await idx(page, Y26)}"]`);
  await idle(page);
  assert.equal(await toastText(page), 'Added Ohuhu Y26 · taken off To buy');
  assert.deepEqual(await where(page, Y26), {
    owned: true,
    ink: '',
    wish: false,
    pool: true,
    guides: true,
    saved: { owned: true, ink: '' },
  });
  assert.equal(
    await page.locator(`#results .cell[data-i="${await idx(page, Y26)}"] .inkb`).count(),
    0,
    'no badge',
  );
  // its Undo: unticked again, with its mark and its To buy entry
  await undo(page);
  assert.deepEqual(await where(page, Y26), {
    owned: false,
    ink: 'dry',
    wish: true,
    pool: false,
    guides: false,
    saved: { owned: false, ink: 'dry' },
  });
  // the details' tick box does the same
  await page.evaluate((i) => openMarkerSheet(i), await idx(page, Y26));
  await page.waitForSelector('#mkOverlay.on');
  await page.click('#mkOwn');
  await idle(page);
  assert.equal((await where(page, Y26)).ink, '');
  await undo(page);
  assert.equal((await where(page, Y26)).ink, 'dry');
  assert.deepEqual(errors, []);
});

test('Running low too: ticked back by hand it is OK again; Tick all shown clears the marks of what it adds, and its Undo puts them back', async () => {
  const st = onboarded({
    [KEY]: appState({
      owned: OWN.filter((k) => k !== Y26),
      ink: { [Y26]: 'low', 'Ohuhu|R28': 'dry', 'Ohuhu|R014': 'low' },
      wish: [{ k: 'Ohuhu|R28', why: 'ran dry', ts: 1 }],
    }),
  });
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: st });
  await page.click('#mCollection');
  await idle(page);
  await tapCell(page, 'Y26');
  assert.equal(await toastText(page), 'Added Ohuhu Y26 to your collection');
  assert.equal((await where(page, Y26)).ink, '');
  // Tick all shown: R28 (unticked, dry) comes back fresh and off To buy; R014, yours already and low, keeps its mark
  await page.fill('#q', 'R');
  await idle(page);
  await page.click('#ownAll');
  await idle(page);
  assert.match(await toastText(page), /^Added \d+ markers · 1 off To buy$/);
  assert.deepEqual(await page.evaluate(() => ({ ...state.ink })), { 'Ohuhu|R014': 'low' });
  assert.equal(await page.evaluate(() => state.wish.length), 0);
  await undo(page);
  assert.deepEqual(await page.evaluate(() => ({ ...state.ink })), {
    'Ohuhu|R28': 'dry',
    'Ohuhu|R014': 'low',
  });
  assert.deepEqual(await page.evaluate(() => state.wish.map((w) => w.k)), ['Ohuhu|R28']);
  assert.deepEqual(errors, []);
});

test('Add a set: an unticked dry marker in it comes back fresh and off To buy; its Undo puts the mark and the entry back', async () => {
  const st = onboarded({
    [KEY]: appState({
      owned: OWN.filter((k) => k !== Y26),
      ink: { [Y26]: 'dry' },
      wish: [{ k: Y26, why: 'ran dry', ts: 1 }],
    }),
  });
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: st });
  await page.click('#mCollection');
  await idle(page);
  await addFromMarkers(page, 'set');
  await page.check('#wcSets input[data-i="0"]'); // Honolulu 24 (has Y26)
  await page.click('#wcAdd');
  await idle(page);
  assert.match(await toastText(page), /^Added \d+ markers · 1 off To buy$/);
  const w = await where(page, Y26);
  assert.deepEqual(
    [w.owned, w.ink, w.wish, w.pool, w.guides, w.saved.ink],
    [true, '', false, true, true, ''],
  );
  await undo(page);
  const u = await where(page, Y26);
  assert.deepEqual([u.owned, u.ink, u.wish, u.saved.ink], [false, 'dry', true, 'dry']);
  assert.deepEqual(errors, []);
});

test('Scan’s Add: an unticked dry marker comes back fresh; its Undo puts the mark back', async () => {
  const st = onboarded({ [KEY]: appState({ owned: OWN.filter((k) => k !== Y26), ink: { [Y26]: 'dry' } }) });
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: st });
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await page.fill('#scBox', 'Y26');
  await page.press('#scBox', 'Enter');
  await idle(page);
  await page.click('#scAdd');
  await idle(page);
  assert.match(await toastText(page), /^Added 1 marker/);
  const w = await where(page, Y26);
  assert.deepEqual([w.owned, w.ink, w.pool, w.guides, w.saved.ink], [true, '', true, true, '']);
  await page.click('#toastAct');
  await idle(page);
  const u = await where(page, Y26);
  assert.deepEqual([u.owned, u.ink, u.saved.ink], [false, 'dry', 'dry']);
  assert.deepEqual(errors, []);
});

test('a restore keeps the backup’s marks: Add the backup’s and Use the backup’s bring a dry marker in still dry', async () => {
  const file = (o) => ({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  const BK = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - 864e5,
    owned: ['Ohuhu|R014', 'Copic|E09', 'Ohuhu|R16'],
    wish: [],
    ink: { 'Copic|E09': 'dry', 'Ohuhu|R16': 'low' },
    saved: [],
    guides: [],
  };
  for (const a of ['add', 'replace']) {
    const { ctx, page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ mode: 'home' }) }),
    });
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.setInputFiles('#guidesFile', file(BK));
    await page.waitForSelector('#sfEdAsk', { timeout: 10000 });
    await page.click(`#sfEdAsk [data-a="${a}"]`);
    await idle(page);
    const e = await where(page, 'Copic|E09'),
      r = await where(page, 'Ohuhu|R16');
    assert.deepEqual([e.owned, e.ink, e.pool, r.owned, r.ink], [true, 'dry', false, true, 'low'], a);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// ---- Decision 4: Copic's fluorescent cap codes with Ohuhu chosen ----
async function scanOhuhu() {
  const a = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ 'ms-scan-brand': 'Ohuhu', [KEY]: appState() }),
  });
  await a.page.click('#mCollection');
  await idle(a.page);
  await scanFromMarkers(a.page);
  await idle(a.page);
  assert.equal(await a.page.getAttribute('#scBrand button[data-b="Ohuhu"]', 'aria-pressed'), 'true');
  return a;
}
const stat = (page) => page.textContent('#scStat');
const rows = (page) =>
  page.$$eval('#scList .scrow', (rs) =>
    rs
      .map((r) => r.querySelector('.sccode'))
      .filter(Boolean)
      .map((c) => c.textContent),
  );

test('Scan with Ohuhu chosen: a Copic fluorescent’s cap code, typed, is another brand’s marker to add, not a line not read', async () => {
  const { page, errors } = await scanOhuhu();
  await page.fill('#scBox', 'FY1');
  await page.press('#scBox', 'Enter');
  await idle(page);
  assert.match(await stat(page), /Copic FY /);
  assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
  assert.doesNotMatch(await stat(page), /FY01|not read|No marker code/);
  await page.click('#scStat .scpick button');
  await idle(page);
  assert.deepEqual(await rows(page), ['FY']);
  assert.match(await page.textContent('#scList .scrow'), /Copic/);
  // as Scan Text puts it in the box, while you aim at the cap
  await page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value = t;
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }, 'FRV1');
  await page.waitForFunction(() => /Copic FRV /.test(document.getElementById('scStat').textContent), null, {
    timeout: 5000,
  });
  assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
  assert.deepEqual(errors, []);
});

test('Scan with Ohuhu chosen: a pasted list of cap codes asks about each, in the list, with nothing counted as not read', async () => {
  const { page, errors } = await scanOhuhu();
  await page.evaluate((t) => {
    const d = new DataTransfer();
    d.setData('text/plain', t);
    document
      .getElementById('scBox')
      .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
  }, 'FB2\nFYR1\nB02');
  await idle(page);
  const asks = await page.$$eval('#scList .scask', (r) => r.map((x) => x.textContent));
  assert.equal(asks.length, 2, asks.join(' / '));
  assert.ok(
    asks.every((t) => /Another brand than the one chosen \(Ohuhu\)/.test(t)),
    asks.join(' / '),
  );
  assert.ok(
    asks.some((t) => /FB Fluorescent Blue · Copic/.test(t)) &&
      asks.some((t) => /FYR Fluorescent Orange · Copic/.test(t)),
    asks.join(' / '),
  );
  assert.ok((await rows(page)).includes('B02'));
  const labels = await page.$$eval('#scList .scask .scchoose', (b) => b.map((x) => x.textContent));
  assert.deepEqual(labels.sort(), ['FB Fluorescent Blue · Copic', 'FYR Fluorescent Orange · Copic']);
  for (let n = 0; n < 2; n++) {
    await page.click('#scList .scask .scchoose');
    await idle(page);
  }
  await page.click('#scAdd');
  await idle(page);
  assert.doesNotMatch(await toastText(page), /not read/);
  assert.deepEqual(
    await page.evaluate(() => ['Copic|FB', 'Copic|FYR', 'Ohuhu|B02'].map((k) => state.owned.has(k))),
    [true, true, true],
  );
  assert.deepEqual(errors, []);
});

// ---- Decision 5: colour families in Markers' search ----
const famLine = (page) =>
  page.evaluate(() => {
    const l = document.querySelector('#results .famline');
    return l ? l.textContent : '';
  });
const cells = (page) => page.locator('#results .cell').count();
async function search(page, q) {
  await page.fill('#q', q);
  await idle(page);
}
async function shot(page, name) {
  if (!SHOTS) return;
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: SHOTS + '/' + name + '.png' });
}

test('Markers’ search: no names match “skin”, so the Earth / Skin / Brown family is shown, with a line saying so', async () => {
  for (const width of [820, 390]) {
    const { ctx, page, errors } = await openApp({
      width,
      height: width === 820 ? 1180 : 844,
      storage: onboarded({ [KEY]: appState() }),
    });
    await page.click('#mCollection');
    await idle(page);
    await search(page, 'skin');
    assert.equal(await famLine(page), 'No names match “skin” · showing the Earth / Skin / Brown family (94)');
    assert.equal(await cells(page), 94);
    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll('#results .cell')].every(
          (c) => COLORS[+c.dataset.i].fam === 'Earth / Skin / Brown',
        ),
      ),
    );
    assert.equal((await page.textContent('#matchn')).trim(), '(94 markers)');
    assert.ok(!(await page.isVisible('#results .famline button')), 'no link: the results are the family');
    await shot(page, 'skin-' + width);
    // Owned: the family's markers you own, counted so
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    const own = await page.evaluate(
      () => [...state.owned].filter((k) => COLORS[keyIdx(k)].fam === 'Earth / Skin / Brown').length,
    );
    if (own)
      assert.equal(
        await famLine(page),
        `No names match “skin” · showing the Earth / Skin / Brown family (${own})`,
      );
    else assert.equal(await famLine(page), '');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Markers’ search: “yellow grey” finds one name (Copic YG93 Grayish Yellow) and offers the Yellow Grey family (6)', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState() }),
  });
  await page.click('#mCollection');
  await idle(page);
  await search(page, 'yellow grey');
  assert.equal(await cells(page), 1);
  assert.equal(await famLine(page), 'Also: the Yellow Grey family (6) ›');
  assert.deepEqual(errors, []);
});

test('Markers’ search: “red” keeps its 17 names and offers the Red family in one line; the link turns its filter on and clears the search', async () => {
  for (const width of [820, 390]) {
    const { ctx, page, errors } = await openApp({
      width,
      height: width === 820 ? 1180 : 844,
      storage: onboarded({ [KEY]: appState() }),
    });
    await page.click('#mCollection');
    await idle(page);
    await search(page, 'red');
    assert.equal(await cells(page), 17, 'the results are the names, as before');
    assert.equal(await famLine(page), 'Also: the Red family (69) ›');
    assert.equal(await page.locator('#results .famline').count(), 1, 'one line');
    const box = await page.locator('#results .famline button').boundingBox();
    assert.ok(box.height >= 44, 'tap target ' + box.height);
    await shot(page, 'red-' + width);
    await page.click('#results .famline button');
    await idle(page);
    assert.equal(await page.inputValue('#q'), '');
    assert.equal(await page.evaluate(() => searchStr), '');
    assert.deepEqual(await page.evaluate(() => families.map((f) => f.name).filter((n) => fgSel('fam', n))), [
      'Red',
    ]);
    assert.equal(await cells(page), 69);
    assert.equal(await famLine(page), '');
    // as its chips would: the chips show them on
    assert.deepEqual(await page.$$eval('#fams .chip[aria-pressed="1"]', (b) => b.map((x) => x.dataset.fam)), [
      'Red',
    ]);
    if (width === 390) await shot(page, 'red-after-390');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Markers’ search: the counts follow the filters, and a family the filters leave out isn’t offered', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState() }),
  });
  await page.click('#mCollection');
  await idle(page);
  // Copic only
  await page.evaluate(() => {
    state.brands = new Set(['Copic']);
    filterChanged();
  });
  await search(page, 'skin');
  const n = await page.evaluate(
    () => COLORS.filter((c) => c.brand === 'Copic' && c.fam === 'Earth / Skin / Brown').length,
  );
  assert.equal(await famLine(page), `No names match “skin” · showing the Earth / Skin / Brown family (${n})`);
  assert.equal(await cells(page), n);
  // the Blue family only: Earth / Skin / Brown is left out, so "skin" is as before
  await page.evaluate(() => {
    state.brands = new Set(['Ohuhu', 'Copic']);
    fgTap('fam', 'Blue');
    filterChanged();
  });
  await search(page, 'skin');
  assert.equal(await famLine(page), '');
  assert.match(await page.textContent('#results'), /No markers match “skin” with the current filters/);
  assert.deepEqual(errors, []);
});

test('Markers’ search: a list of codes gets the Scan hint, never the family line (the hint wins when both apply)', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState() }),
  });
  await page.click('#mCollection');
  await idle(page);
  await search(page, 'b02, b03');
  assert.match(await page.textContent('#results'), /looks like a list of codes/);
  assert.equal(await famLine(page), '');
  // a search both would answer (no family word is a code, so it's made so here): the hint, alone
  await page.evaluate(() => {
    window.searchList = () => true;
  });
  await search(page, 'skin');
  assert.match(await page.textContent('#results'), /looks like a list of codes/);
  assert.equal(await famLine(page), '');
  await search(page, 'red');
  assert.equal(await famLine(page), '', 'nor the offer');
  assert.deepEqual(errors, []);
});
