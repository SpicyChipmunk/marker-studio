// Backups, restore, storage, two tabs, unreadable data, deleting data.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  ROOT,
  addFromMarkers,
  answerAsks,
  haveSet,
  idle,
  openApp,
  openAtScale,
  openBackupDialog,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v308-ticks.test.mjs ----
// v308: ticks made just before a reload are kept on a guide whose section map was encoded by another browser engine
// (a backup or guide file made in Chrome and opened in Safari, or the other way). Opening such a guide re-encoded its
// map, so the copy kept as the page went away fingerprinted a different map from the stored one and was thrown away
// at the next start (pt8-pc §4). The stored map now stays the one saved until the sections change.
{
  // a PNG of these RGBA pixels written the way no browser writes one (no row filters, the strongest compression), so
  // the same picture comes back as a different file: what another engine's encoder makes of it
  const CRC = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc32 = (buf) => {
    let c = -1;
    for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii'),
      len = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  function pngOf(rgba, w, h) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    return (
      'data:image/png;base64,' +
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
      ]).toString('base64')
    );
  }
  // the sample guide as a backup whose section map was encoded "elsewhere" (the same pixels, a different file)
  async function foreignBackup() {
    const { page, ctx } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const g = await page.evaluate(async () => {
      const s = state.saved.find((x) => x.type === 'guide'),
        pl = await IDB.get('guide-' + s.id);
      const img = new Image();
      await new Promise((r) => {
        img.onload = r;
        img.src = pl.lmap;
      });
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      let bin = '';
      for (let i = 0; i < px.length; i += 0x8000)
        bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
      return {
        meta: { id: s.id, name: s.name, W: s.W, H: s.H, keys: s.keys, n: s.n, ts: s.ts },
        pl,
        w: c.width,
        h: c.height,
        px: btoa(bin),
        owned: [...state.owned],
      };
    });
    await ctx.close();
    const lmap = pngOf(Buffer.from(g.px, 'base64'), g.w, g.h);
    assert.notEqual(lmap, g.pl.lmap, 'a different file for the same picture');
    const backup = {
      v: 3,
      type: 'ms-backup',
      ts: g.meta.ts,
      owned: g.owned,
      saved: [],
      guides: [{ ...g.meta, payload: { ...g.pl, lmap } }],
    };
    return { backup, lmap, id: g.meta.id };
  }
  async function restoreInto(page, backup) {
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await until(page, () => state.saved.some((s) => s.type === 'guide'), null, 'the guide restored');
    await idle(page);
  }
  const stored = (page, id) =>
    page.evaluate(
      (id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, lmap: p.lmap }),
      id,
    );
  test('ticks just before a reload are kept on a guide whose section map another engine encoded', async () => {
    const { backup, lmap, id } = await foreignBackup();
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await restoreInto(page, backup);
    await page.evaluate((id) => loadGuide({ id }), id);
    await until(
      page,
      (id) => __mstest.curId === id && __mstest.assignData && __mstest.sfmode === 'guide',
      id,
      'the restored guide open',
    );
    await idle(page);
    // five ticks, then the page goes at once
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 5).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
    });
    await page.reload();
    await idle(page);
    const s = await stored(page, id);
    assert.equal(s.prog, 5, 'all five ticks kept');
    assert.equal(
      await page.evaluate((id) => state.saved.find((x) => x.id === id).done, id),
      5,
      'and the Library row says so',
    );
    assert.equal(s.lmap, lmap, 'the stored section map is still the one restored');
    assert.deepEqual(errors, []);
  });
  test('the stored section map stays byte-identical through a save, and a section edit still saves a new one', async () => {
    const { backup, lmap, id } = await foreignBackup();
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await restoreInto(page, backup);
    await page.evaluate((id) => loadGuide({ id }), id);
    await until(
      page,
      (id) => __mstest.curId === id && __mstest.assignData && __mstest.sfmode === 'guide',
      id,
      'the restored guide open',
    );
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 2).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    const s = await stored(page, id);
    assert.equal(s.prog, 2);
    assert.equal(s.lmap, lmap, 'not encoded again');
    // the sections changed: the map saved is the new one
    const changed = await page.evaluate(() => {
      const t = __mstest,
        L = t.labels;
      for (let i = 0; i < L.length; i++)
        if (L[i] > 0) {
          const was = L[i];
          L[i] = -1;
          // (an edit in place, said as Edit sections says its own: v318 review keeps the map's signature in the Plan
          // and Colour along until an edit lets it go)
          t.labels = L;
          const u = t.lmapURL();
          L[i] = was;
          t.labels = L;
          return u;
        }
      return '';
    });
    assert.ok(changed && changed !== lmap, 'a change to the sections is encoded afresh');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3083-data.test.mjs ----
// v308.3 (data): a marker added back by hand (ticked, Add a set, Scan's Add) loses its Running low or Dry mark, and
// leaves To buy; Undo, and a restore, keep marks as they were. Copic's fluorescent cap codes (FB2, FY1…) with Ohuhu
// chosen in Scan are asked about as another brand's. Markers' search shows the families its words name when no name
// matches ("skin"), and offers them in a line when names do ("red").
{
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
    assert.equal(await toastText(page), 'Ohuhu Y26 unticked');
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
  test('Scan with Ohuhu chosen: a Copic fluorescent’s cap code, typed, is another brand’s marker to add, not a line not read', async () => {
    const { page, errors } = await scanOhuhu();
    await page.fill('#scBox', 'FY1');
    await page.press('#scBox', 'Enter');
    await idle(page);
    assert.match(await stat(page), /Copic FY /);
    assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
    assert.doesNotMatch(await stat(page), /FY01|not read|No marker code/);
    // (v318.22: typed, a question in the list, not a card the next code typed would replace)
    await page.click('#scList .scask .scchoose');
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
  // (v318.26: "skin" shows the skin tones, Ohuhu's 36 Skin Tones set and Copic's picks, lightest first, with the family
  // as a link; with none of them in the view, the family as before)
  test('Markers’ search: “skin” shows the skin tones, with the Earth / Skin / Brown family as a link', async () => {
    for (const width of [820, 390]) {
      const { ctx, page, errors } = await openApp({
        width,
        height: width === 820 ? 1180 : 844,
        storage: onboarded({ [KEY]: appState() }),
      });
      await page.click('#mCollection');
      await idle(page);
      await search(page, 'skin');
      assert.equal(await famLine(page), 'Skin tones (72) · the Earth / Skin / Brown family (94) ›');
      assert.equal(await cells(page), 72);
      assert.ok(
        await page.evaluate(() => {
          const sk = skinIdx(),
            got = [...document.querySelectorAll('#results .cell')].map((c) => +c.dataset.i);
          return got.join() === sk.join();
        }),
        'the skin tones, lightest first',
      );
      assert.equal((await page.textContent('#matchn')).trim(), '(72 markers)');
      await shot(page, 'skin-' + width);
      // Owned (none of the skin tones yours here): the family's markers you own, counted so, as before
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
      assert.deepEqual(
        await page.evaluate(() => families.map((f) => f.name).filter((n) => fgSel('fam', n))),
        ['Red'],
      );
      assert.equal(await cells(page), 69);
      assert.equal(await famLine(page), '');
      // as its chips would: the chips show them on
      assert.deepEqual(
        await page.$$eval('#fams .chip[aria-pressed="1"]', (b) => b.map((x) => x.dataset.fam)),
        ['Red'],
      );
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
    // (v318.26: the skin tones, Copic's 36, with the family's count in the link)
    assert.equal(await famLine(page), `Skin tones (36) · the Earth / Skin / Brown family (${n}) ›`);
    assert.equal(await cells(page), 36);
    // the Blue family only: Earth / Skin / Brown and every skin tone are left out, so "skin" is as before
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
}

// ---- from v3101-d4.test.mjs ----
// v310.1 (reviewer 4: the first run and the app as a whole): a returning tester's backup restored on a new device keeps
// the full section step (a backup made before v310); the quick check is said to a screen reader; Ctrl+Z from a Mood picture keeps the keyboard there.
{
  const flag = (page) => page.evaluate(() => localStorage.getItem('ms-sec-tools'));
  test('guides from a backup made before v310, restored into a Library with none (a new iPad): the full section step stays', async () => {
    const a = await openApp({ width: 820, height: 1180 });
    await sampleGuide(a.page);
    await saveGuide(a.page);
    await openBackupDialog(a.page);
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#backupDownload')]);
    const d = JSON.parse(await readFile(await dl.path(), 'utf8'));
    // (the app's own version, whatever it is now: v310 or later)
    assert.match(d.app, /^v3(1\d|[2-9]\d)(\.\d+)?$/);
    assert.equal(d.guides.length, 1);
    const dir = await mkdtemp(join(tmpdir(), 'v3101-d4-'));
    const as = async (app, name) => {
      const f = join(dir, name);
      await writeFile(f, JSON.stringify({ ...d, app }));
      return f;
    };
    // [the version that made the backup, guides in it, the step after]: a v310 backup is a new tester moving from a
    // Safari tab to the Home Screen app (docs/TESTERS.md), who keeps the quick check
    for (const [app, guides, want] of [
      ['v309.2', true, '1'],
      [undefined, true, '1'],
      ['v310', true, '0'],
      ['v309.2', false, '0'],
    ]) {
      // a fresh install: the first start of v310 finds no guide and sets the quick check
      const b = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': null } });
      await answerAsks(b.page);
      assert.equal(await flag(b.page), '0');
      const f = await as(app, 'b-' + app + '-' + guides + '.json');
      if (!guides) await writeFile(f, JSON.stringify({ ...d, app, guides: [] }));
      const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
      await fc.setFiles(f);
      await idle(b.page, 1500);
      assert.equal(await b.page.isVisible('#welcome'), false);
      assert.equal(
        await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
        guides ? 1 : 0,
      );
      assert.equal(await flag(b.page), want, app + (guides ? ' with guides' : ' without'));
      assert.deepEqual(b.errors, []);
      await b.ctx.close();
    }
    assert.deepEqual(a.errors, []);
  });
}

// ---- from v318-data.test.mjs ----
// v318 data-safety review, and its audit: a guide whose section map can't be read for want of memory isn't called
// damaged, and an import, a lost guide or a restore says memory too (a restore keeps a "damaged" guide's whole stored
// copy aside rather than putting an older copy over it unseen); Tester tasks answers in backups; what Send feedback
// says it sends; the browser's storage not answering; a snooze given while the clock was ahead; a Library guide not
// stored at all, said apart by Back up.
{
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, done: s.done || 0 })),
    );
  const openLib = async (page) => {
    if (!(await page.isVisible('#savedOverlay'))) {
      await page.evaluate(() => openLibrary());
      await page.waitForSelector('#savedOverlay.on');
    }
  };
  // a guide in the Library, a backup of it, then 12 sections coloured and one section's marker changed since
  async function guideAndOlderBackup(page) {
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await openLib(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const backup = await readFile(await dl.path());
    await idle(page);
    await page.evaluate(() => closeDialog(savedOverlay));
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        a = t.assignData,
        l = a.order[20],
        o = a.order.find((x) => a.assign[x].mkey !== a.assign[l].mkey);
      a.assign[l] = a.assign[o];
      a.order.slice(0, 12).forEach((x) => {
        t.colored[x] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal((await guides(page))[0].done, 12);
    return { g, backup };
  }
  test('a section map that can’t be read for want of memory says so, isn’t called damaged, and opens next time', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const { g } = await guideAndOlderBackup(page);
    // (v318 review: the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
    await page.waitForFunction(
      () => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1),
    );
    await page.reload();
    await idle(page);
    // the next canvas the size of the guide's section map gets no 2D context, as Safari's when its canvas memory is used up
    await page.evaluate(
      (g) => {
        const o = HTMLCanvasElement.prototype.getContext;
        let left = 1;
        HTMLCanvasElement.prototype.getContext = function (k, a) {
          if (k === '2d' && this.width === g.W && this.height === g.H && left > 0) {
            left--;
            return null;
          }
          return o.call(this, k, a);
        };
      },
      await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id),
    );
    await openLib(page);
    await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
    await until(page, () => /short of memory/.test(document.body.innerText), null, 'said');
    assert.equal(await page.$('#sfEdAsk'), null, 'not the damaged guide’s question');
    assert.match(await page.evaluate(() => document.body.innerText), /Your guide is still saved/);
    assert.equal(await page.evaluate((id) => _damaged.has(id), g.id), false, 'not marked damaged');
    await openLib(page);
    await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
    await until(page, (id) => __mstest.curId === id && !!__mstest.assignData, g.id, 'it opens');
    assert.equal(await page.evaluate(() => __mstest.colored.filter(Boolean).length), 12);
    assert.deepEqual(errors, []);
  });
  test('restoring over a guide called damaged keeps its stored copy as “… (before restore)” when that copy is whole', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const { g, backup } = await guideAndOlderBackup(page);
    await page.evaluate((id) => guideDamaged(id), g.id);
    await openLib(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await until(
      page,
      () => /before restore/.test(document.getElementById('backupCap').textContent),
      null,
      'the restore',
    );
    const gs = await guides(page);
    assert.equal(gs.length, 2);
    const kept = gs.find((x) => / \(before restore\)$/.test(x.name)),
      back = gs.find((x) => x.id === g.id);
    assert.ok(kept, 'kept aside');
    assert.equal(kept.done, 12, 'with its colouring');
    assert.equal(back.done, 0, 'the backup’s copy in its place');
    assert.deepEqual(errors, []);
  });
  test('a lost guide that couldn’t be checked for want of memory is offered again, not put aside for good', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    const row = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
    // its Library row gone (as when the list couldn't be read), its stored guide still here
    await page.evaluate((id) => {
      state.saved = state.saved.filter((s) => s.id !== id);
      save(true);
    }, g.id);
    await page.evaluate((r) => {
      const o = HTMLCanvasElement.prototype.getContext;
      let left = 1;
      HTMLCanvasElement.prototype.getContext = function (k, a) {
        if (k === '2d' && this.width === r.W && this.height === r.H && left > 0) {
          left--;
          return null;
        }
        return o.call(this, k, a);
      };
    }, row);
    // (v318 audit: said as memory, not as a guide that couldn't be read)
    assert.equal(
      await page.evaluate((id) => addLost([id]), g.id),
      '1 guide couldn’t be checked just now: this device is short of memory. Close other apps or tabs, then try again.',
    );
    assert.equal((await guides(page)).length, 0, 'not added this time');
    assert.equal(await page.evaluate((id) => lostSkip().includes(id), g.id), false, 'not put aside');
    assert.match(await page.evaluate((id) => addLost([id]), g.id), /^Added 1 guide back/);
    assert.equal((await guides(page)).length, 1);
    assert.deepEqual(errors, []);
  });
  // (v318 audit) a restore whose guide couldn't be checked for want of memory says so, not that it couldn't be read; the
  // next restore brings it
  test('a restore whose guide couldn’t be checked for want of memory says so, and restoring again brings it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    const row = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
    await openLib(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const backup = await readFile(await dl.path());
    // on another device
    const fresh = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await fresh.page.evaluate((r) => {
      const o = HTMLCanvasElement.prototype.getContext;
      let left = 1;
      HTMLCanvasElement.prototype.getContext = function (k, a) {
        if (k === '2d' && this.width === r.W && this.height === r.H && left > 0) {
          left--;
          return null;
        }
        return o.call(this, k, a);
      };
    }, row);
    await openLib(fresh.page);
    const restore = async () => {
      const [fc] = await Promise.all([
        fresh.page.waitForEvent('filechooser'),
        fresh.page.click('#guidesRestore'),
      ]);
      await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    };
    await restore();
    await until(
      fresh.page,
      () => /short of memory/.test(document.getElementById('backupCap').textContent),
      null,
      'the restore',
    );
    const cap = await fresh.page.textContent('#backupCap');
    assert.match(cap, /1 guide couldn’t be checked — this device is short of memory/);
    assert.doesNotMatch(cap, /couldn’t be read/);
    assert.equal((await guides(fresh.page)).length, 0);
    await idle(fresh.page);
    await restore();
    await until(
      fresh.page,
      () => /1 guide restored/.test(document.getElementById('backupCap').textContent),
      null,
      'again',
    );
    assert.equal((await guides(fresh.page)).length, 1);
    assert.deepEqual([...errors, ...fresh.errors], []);
  });
  test('Tester tasks answers go in the backup and come back with it (all of them on a device with none; yours stay)', async () => {
    const answers = {
      id: 'TABC123',
      name: 'Sam',
      t: { add: { r: 'easy', n: 'quick', v: 'v318' }, guide: { r: 'hard', n: 'sections odd', v: 'v318' } },
      q: { confused: 'the tabs', next: 'yes' },
      sends: 0,
      sig: '',
    };
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-tester': JSON.stringify(answers) },
    });
    await page.evaluate(() => {
      state.owned = new Set(['Ohuhu|R014', 'Ohuhu|Y111']);
      save();
    });
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const backup = JSON.parse(await readFile(await dl.path(), 'utf8'));
    assert.equal(backup.tester.id, 'TABC123');
    assert.equal(backup.tester.t.guide.n, 'sections odd');
    // a fresh device (the Home Screen app): restored with the markers
    const fresh = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await fresh.page.evaluate(() => openLibrary());
    await fresh.page.waitForSelector('#savedOverlay.on');
    const [fc] = await Promise.all([
      fresh.page.waitForEvent('filechooser'),
      fresh.page.click('#guidesRestore'),
    ]);
    await fc.setFiles({
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await until(fresh.page, () => state.owned.size === 2, null, 'restored');
    const got = await fresh.page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')));
    assert.equal(got.id, 'TABC123', 'the same tester');
    assert.deepEqual(got.t, answers.t);
    assert.deepEqual(got.q, answers.q);
    assert.match(await fresh.page.textContent('#homeTasks'), /2 of 6/);
    // a device with answers of its own keeps them, and gains only the ones it hasn't given
    const mine = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ms-tester': JSON.stringify({
          id: 'TMINE1',
          name: '',
          t: { add: { r: 'ok', n: '', v: 'v318' } },
          q: {},
          sends: 0,
          sig: '',
        }),
      },
    });
    await mine.page.evaluate((b) => testerRestore(b.tester), backup);
    const m = await mine.page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')));
    assert.equal(m.id, 'TMINE1');
    assert.equal(m.t.add.r, 'ok', 'yours stays');
    assert.equal(m.t.guide.r, 'hard', 'the one not given here comes in');
    assert.equal(m.name, 'Sam');
    assert.deepEqual([...errors, ...fresh.errors, ...mine.errors], []);
  });
  // (v318 audit) a backup's Tester tasks with only a name and a send, restored on a device with none: kept, the tester's
  // id with them (it had been taken in but not stored)
  test('Tester tasks with only a name, restored on a device with none: stored, with the tester’s id', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.evaluate(() =>
      testerRestore({ id: 'TSAM42', name: 'Sam', t: {}, q: {}, sends: 1, sig: '[{},{},"Sam"]' }),
    );
    const got = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester') || 'null'));
    assert.ok(got, 'stored');
    assert.equal(got.id, 'TSAM42');
    assert.equal(got.name, 'Sam');
    assert.deepEqual(errors, []);
  });
  test('Send feedback says everything it sends: the counts and the tester number, not the name given in Tester tasks', async () => {
    const N = 27,
      FORM =
        'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
        Array.from({ length: N }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ms-tester': JSON.stringify({ id: 'TABC123', name: 'Sam', t: {}, q: {}, sends: 0, sig: '' }),
      },
      init: `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`,
    });
    const posts = [];
    await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
      posts.push([...new URLSearchParams(r.request().postData() || '').values()]);
      return r.fulfill({ status: 200, body: 'ok' });
    });
    await page.click('#homeFeedback');
    await idle(page);
    const said = await page.textContent('#fbOverlay .ttwhat');
    await page.fill('#fbText', 'A note.');
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    assert.equal(posts.length, 1);
    // (v318.1: the name was given for the results; the tester number links the note to them)
    assert.ok(!posts[0].includes('Sam'), 'not the name');
    assert.ok(posts[0].includes('TABC123'), 'the tester number');
    assert.match(said, /a tester number made on this device \(not your name\)/);
    assert.match(said, /how many markers, guides and palettes/);
    assert.match(said, /screen/);
    assert.deepEqual(errors, []);
  });
  test('a guide the browser’s storage doesn’t give back says to reload, not that it is missing', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    // (v318 review: the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
    await page.waitForFunction(
      () => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1),
    );
    await page.reload();
    await idle(page);
    await page.evaluate((id) => {
      const get = IDB.get;
      IDB.get = (k) =>
        k === 'guide-' + id ? Promise.reject(new DOMException('gone', 'UnknownError')) : get(k);
    }, g.id);
    await openLib(page);
    await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
    await until(page, () => /isn’t answering/.test(document.body.innerText), null, 'said');
    assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /missing from this browser/);
    assert.match(await page.evaluate(() => document.body.innerText), /reload Marker Studio/);
    assert.deepEqual(errors, []);
  });
  test('a browser database that never answers: the guide says to reload, not “Saving…” for good', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      init: () => {
        // (an open request that fires no event at all)
        IDBFactory.prototype.open = function () {
          return {};
        };
      },
    });
    await sampleGuide(page);
    // (v285: a change to the sample is its first save)
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await until(
      page,
      () => document.getElementById('sfSaveSt').textContent === 'Not saved — reload to try again',
      null,
      'said',
      20000,
    );
    assert.equal(await page.evaluate(() => storeErr()), 'TimeoutError');
    assert.deepEqual(errors, []);
  });
  test('a Later (or Not now) given while the device’s clock was a year ahead rests a week, not a year', async () => {
    const now = Date.now(),
      yearOn = String(now + 365 * 864e5);
    const { page, errors } = await openApp({
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ohuhu-hb320-picker-v3': JSON.stringify({
          mode: 'home',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'],
          saved: [],
        }),
        'ms-first-use': String(now - 15 * 864e5),
        'ms-backup-snooze': yearOn,
        'ms-install-snooze': yearOn,
      },
    });
    await page.waitForSelector('#backupNudge', { state: 'visible' });
    assert.match(await page.textContent('#backupNudge'), /Your 3 markers are only stored on this device/);
    assert.deepEqual(errors, []);
  });
  test('Back up with a Library guide not stored on this device at all: said by name, with what to do, and no endless reminder', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await page.evaluate((id) => IDB.del('guide-' + id), g.id);
    await openLib(page);
    await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    await idle(page);
    assert.equal(
      await page.textContent('#msToast'),
      'Backed up, but “' +
        g.name +
        '” isn’t stored on this device any more, so it isn’t in it. If it won’t open from the Library, delete it there.',
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-backup-missed')),
      null,
      'not “couldn’t be read”',
    );
    assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'not counted as still to back up');
    await page.evaluate(() => closeDialog(savedOverlay));
    await page.click('#mHome');
    await idle(page);
    assert.equal(
      await page.isVisible('#backupNudge'),
      false,
      'no reminder that a reload and a backup can’t answer',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  // A guide the browser's storage doesn't give back says to reload (v318 review), but why the read failed was one note for
  // every guide: a read of another guide begun before the open looked at it (a thumbnail's, a backup's) cleared it, and
  // the guide was called missing from this browser, which sends people to an older backup.
  test('a guide the storage doesn’t give back says to reload, also with another guide read meanwhile', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    // (the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
    await page.waitForFunction(
      () => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1),
    );
    await page.reload();
    await idle(page);
    await page.evaluate((id) => {
      const get = IDB.get;
      IDB.get = (k) => {
        if (k !== 'guide-' + id) return get(k);
        const p = Promise.reject(new DOMException('gone', 'UnknownError'));
        // (another guide's read begun after this one's failure is noted, before the open reads the note)
        p.catch(() => Promise.resolve().then(() => Promise.resolve().then(() => sfLoadDesign(-1))));
        return p;
      };
    }, id);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.click(`#savedList .srow[data-id="${id}"] .sopen`);
    await until(page, () => /Couldn’t open that guide/.test(document.body.innerText), null, 'said');
    const t = await page.evaluate(() => document.body.innerText);
    assert.match(t, /isn’t answering/);
    assert.doesNotMatch(t, /missing from this browser/);
    assert.deepEqual(errors, []);
  });
  // A restore over a guide called damaged as it opened kept its stored copy aside as "… (before restore)" when that copy's
  // section map was a whole PNG (v318 review: it may only have been short of memory), even one that still can't open:
  // here a map too big for any guide, which is said as damaged every time.
  test('restoring over a guide called damaged keeps no “(before restore)” copy that can’t open either', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const backup = await readFile(await dl.path());
    await idle(page);
    await page.evaluate(() => closeDialog(savedOverlay));
    await idle(page);
    // its stored copy changed since (12 sections coloured) and its section map now a whole PNG too big to be a guide's
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 12).forEach((x) => (t.colored[x] = 1));
      t.guideDirty = true;
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.evaluate(async (id) => {
      const c = document.createElement('canvas');
      c.width = 5000;
      c.height = 8;
      const p = await IDB.get('guide-' + id);
      p.lmap = c.toDataURL('image/png');
      await IDB.put('guide-' + id, p);
      guideDamaged(id);
    }, id);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await until(
      page,
      () => /Restored|restored|replaced/.test(document.getElementById('backupCap').textContent),
      null,
      'the restore',
    );
    await idle(page);
    const gs = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
    assert.deepEqual(
      gs.filter((n) => /before restore/.test(n)),
      [],
      'nothing kept aside',
    );
    assert.equal(gs.length, 1);
    assert.doesNotMatch(await page.textContent('#backupCap'), /before restore/);
    assert.deepEqual(errors, []);
  });
  // Tester tasks answers come back with a backup (v318 review), but the restore's summary didn't say so.
  test('a restore says when Tester tasks answers came back', async () => {
    const answers = {
      id: 'TABC123',
      name: 'Sam',
      t: { add: { r: 'easy', n: 'quick', v: 'v318' } },
      q: { next: 'yes' },
      sends: 0,
      sig: '',
    };
    const a = await openApp({
      width: 820,
      height: 1180,
      storage: { ...ONBOARDED, 'ms-tester': JSON.stringify(answers) },
    });
    await a.page.evaluate(() => {
      state.owned = new Set(['Ohuhu|R014', 'Ohuhu|Y111']);
      save();
    });
    await a.page.evaluate(() => SF.loadSample());
    await idle(a.page, 1500);
    await saveGuide(a.page);
    await a.page.evaluate(() => openLibrary());
    await a.page.waitForSelector('#savedOverlay.on');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
    const backup = await readFile(await dl.path());
    // a fresh device: the Library's Restore (a guide and markers in it), and the welcome's (Home's summary)
    const b = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
    await b.page.evaluate(() => openLibrary());
    await b.page.waitForSelector('#savedOverlay.on');
    const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
    await fc.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: backup });
    await until(
      b.page,
      () => /restored/.test(document.getElementById('backupCap').textContent),
      null,
      'restored',
    );
    assert.match(await b.page.textContent('#backupCap'), /Your Tester tasks answers came back\./);
    // a restore of the same again: nothing new among the answers, and not said
    const [fc2] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
    await fc2.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: backup });
    await until(
      b.page,
      () => /already here/.test(document.getElementById('backupCap').textContent),
      null,
      'restored again',
    );
    await idle(b.page);
    assert.doesNotMatch(await b.page.textContent('#backupCap'), /Tester/);
    assert.equal(
      await b.page.evaluate(() => restoreSummary({ tester: 2 }).text),
      'Restored your Tester tasks answers',
    );
    assert.deepEqual([...a.errors, ...b.errors], []);
  });
  // Section edits not built yet are kept for Resume as the page is hidden: the guide in the browser's database and a small
  // note in localStorage, which Resume is offered from. With localStorage full to the last byte the note wasn't written
  // and nothing said so: no Resume came. Said now, once the page is back.
  test('section edits that can’t be kept for Resume (storage full) are said, once the page is back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2];
    });
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((l) => !__mstest.counted(l), l);
    await page.evaluate(() => {
      const os = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'ms-guide-auto') throw new DOMException('full', 'QuotaExceededError');
        return os.call(this, k, v);
      };
    });
    const vis = (v) =>
      page.evaluate((v) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.visibilityState;
      }, v);
    await vis('hidden');
    await until(
      page,
      () => IDB.get('guide-autosave').then((d) => !!(d && d.edits)),
      null,
      'the edits in the database',
    );
    await idle(page);
    await vis('visible');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /isn’t kept for Resume: this browser’s storage is full/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3181-backup-words.test.mjs ----
// v318.1: Back up & restore says the file holds the Tester tasks answers and name too (they went into backups in the
// v318 review), and that one guide is shared by its Guide file, which holds no answers. Fails on v318.
{
  test('Back up & restore: the file holds the Tester tasks answers and name; one guide goes by its Guide file', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.evaluate(() => openBackup());
    await idle(page);
    const t = await page.textContent('#backupOverlay .dsub');
    assert.match(t, /and your Tester tasks answers and name\./);
    assert.match(t, /To share one guide, use its Share & print › Guide file instead\./);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3181-markers-reminder.test.mjs ----
// v318.1: in a Safari tab, a markers-only collection changed since the last backup brings the reminder on a visit after
// five days away, as guides and palettes do (it had come only after two weeks). Fails on v318.
{
  const DAY = 864e5,
    KEY = 'ohuhu-hb320-picker-v3',
    IPHONE =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    safariTab = () => {
      Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
    },
    own = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G07'],
    state = JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: own,
      saved: [],
    }),
    storage = (extra) => ({
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-last-ver': 'v318',
      [KEY]: state,
      'ms-first-use': String(Date.now() - 6 * DAY),
      ...extra,
    });
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  test('a Safari tab, markers only, never backed up: a visit after six days away brings Keep your work safe, Not now or not', async () => {
    const { page, errors } = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      // (Add to Home Screen put off with Not now two days ago)
      storage: storage({
        'ms-last-visit': String(Date.now() - 6 * DAY),
        'ms-install-snooze': String(Date.now() + 5 * DAY),
      }),
    });
    await idle(page);
    assert.deepEqual(await page.evaluate(() => backupDue() && backupDue().why), 'gap');
    assert.ok(await shown(page, 'installCard'));
    assert.match(
      await page.textContent('#installCard'),
      /^Keep your work safe on this iPhone Safari deletes/,
    );
    assert.equal(await page.textContent('#installCard .nb1'), 'Back up now');
    // a day away only: nothing from the backup
    const b = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      storage: storage({ 'ms-last-visit': String(Date.now() - DAY) }),
    });
    await idle(b.page);
    assert.equal(await b.page.evaluate(() => !!backupDue()), false);
    // backed up since, nothing changed: nothing either
    const c = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      storage: storage({ 'ms-last-visit': String(Date.now() - 6 * DAY) }),
    });
    await idle(c.page);
    await c.page.evaluate(() => {
      localStorage.setItem(BK_SIG, dataSig());
      localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 2 * 864e5));
    });
    assert.equal(await c.page.evaluate(() => !!backupDue()), false);
    assert.deepEqual([...errors, ...b.errors, ...c.errors], []);
  });
}

// ---- from v3181-private.test.mjs ----
// v318.1: Help › Your data says a private window keeps nothing once it's closed. Fails on v318.
{
  test('Help › Your data: a private window keeps nothing once closed', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    const t = await page.textContent('#helpData');
    assert.match(t, /In a private window \(Private Browsing\) everything is deleted when you close it\./);
    // (after the seven-day line it belongs with)
    assert.ok(t.indexOf('seven days') < t.indexOf('private window'));
    assert.deepEqual(errors, []);
  });
}

// ---- from v3181-wipe.test.mjs ----
// v318.1: Delete all my data takes the photo reader's download (its own cache, about 22 MB) with it; the app's own
// files and PDF.js's stay, for the welcome it starts again at. Fails on v318.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = {
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    [KEY]: JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R014'],
      saved: [],
    }),
  };
  test('Delete all my data: the photo reader’s cache goes too; the app’s and PDF.js’s stay', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded });
    const names = await page.evaluate(async () => {
      for (const n of [OCR_CACHE, 'marker-studio-v318', 'marker-studio-pdfjs-test']) {
        const c = await caches.open(n);
        await c.put(new Request(location.origin + '/' + n + '.bin'), new Response('x'));
      }
      return caches.keys();
    });
    assert.ok(names.includes('marker-studio-ocr-1'), names.join(' '));
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    assert.match(await page.textContent('#helpData'), /and the photo reader if you downloaded it\./);
    await page.click('#helpWipe');
    await page.waitForSelector('#sfEdAsk');
    await page.fill('#wipeWord', 'DELETE');
    await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
    await idle(page);
    const left = await page.evaluate(() => caches.keys());
    assert.ok(!left.includes('marker-studio-ocr-1'), left.join(' '));
    assert.ok(
      left.includes('marker-studio-v318') && left.includes('marker-studio-pdfjs-test'),
      left.join(' '),
    );
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-beta-thanks': '1' };
  test('X3 G2: an older copy of the app in another tab leaves the newer version seen as it is', async () => {
    const { page, errors } = await openApp({
      storage: { ...ONB, 'ms-first-use': String(Date.now()), 'ms-last-ver': 'v318.23' },
      init: () => {
        window.__MS_HELP_AUTO = true;
      },
    });
    await idle(page);
    // What's new shown, and closed: this version seen
    assert.equal(await page.isVisible('#whatsNew'), true);
    await page.click('#wnClose');
    await idle(page);
    // (this page standing in for the older one: a version newer than its own seen already)
    const v = await page.evaluate(() => {
      // (v319: a version can have no point, "v319": the next is then v319.1)
      const m = /^v(\d+)(?:\.(\d+))?/.exec(localStorage.getItem('ms-last-ver'));
      const newer = 'v' + m[1] + '.' + ((+m[2] || 0) + 1);
      localStorage.setItem('ms-last-ver', newer);
      window.renderWhatsNew(true);
      return [newer, localStorage.getItem('ms-last-ver')];
    });
    assert.equal(v[1], v[0]);
    assert.equal(await page.isVisible('#whatsNew'), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x4.test.mjs ----
// v318.25 in the browser.
{
  // ==== X4: saving, versions, layout and access ====
  const KEY = 'ohuhu-hb320-picker-v3',
    DAY = 864e5;
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  // F1: ticks made while an earlier save runs, the page then put away and stopped: kept for the next start. Another
  // tab's save after that still wins over the copy kept aside.
  async function leaveRun(otherTab) {
    const { page, ctx, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    await idle(page, 2000);
    const id = await page.evaluate(() => __mstest.curId);
    const r = await page.evaluate(
      async ([KEY, otherTab]) => {
        const t = __mstest,
          o = t.assignData.order;
        const A = o.slice(10, 13),
          B = o.slice(20, 23);
        A.forEach((l) => (t.colored[l] = 1));
        t.guideDirty = true;
        t.renderGuide();
        const p = t.flushSave(); // A's save begins
        B.forEach((l) => (t.colored[l] = 1));
        t.guideDirty = true;
        t.renderGuide();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        await p; // A's save lands; then the page is stopped
        IDB.put = () => new Promise(() => {});
        const os = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === 'ms-guide-leave') return;
          return os.call(this, k, v);
        };
        if (otherTab) {
          // another tab saves the guide after that: its row has a new time
          const v = JSON.parse(localStorage.getItem(KEY));
          v.saved.find((s) => s.id === t.curId).ts = Date.now() + 5000;
          os.call(localStorage, KEY, JSON.stringify(v));
        }
        return { A, B };
      },
      [KEY, otherTab],
    );
    await page.reload();
    await idle(page, 2500);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => window.__mstest && __mstest.assignData && __mstest.curId === id, id, {
      timeout: 30000,
    });
    await idle(page, 1500);
    const got = await page.evaluate(
      ({ A, B }) => ({
        A: A.filter((l) => __mstest.colored[l]).length,
        B: B.filter((l) => __mstest.colored[l]).length,
        left: !!localStorage.getItem('ms-guide-leave'),
      }),
      r,
    );
    await ctx.close();
    return { got, errors };
  }
  const back = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  // F4, F5: restoring a backup
  async function withGuide(page, id, name) {
    const T0 = Date.now() - 3 * DAY;
    return page.evaluate(
      async ([PNG, id, name, T0]) => {
        window.PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
        window.rows = () =>
          state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name }));
        window.restoreFile = (o) =>
          new Promise((r) => {
            const t = document.getElementById('msToast');
            if (t) t.classList.remove('on');
            restoreAny(
              new File([JSON.stringify(o)], 'b.json', { type: 'application/json' }),
              'guidesRestore',
            );
            setTimeout(
              () =>
                r({
                  toast:
                    (t && t.classList.contains('on') && t.textContent) ||
                    document.getElementById('msToast').textContent,
                }),
              1500,
            );
          });
        await sfSaveDesign({
          id,
          name,
          W: 1,
          H: 1,
          keys: ['Ohuhu|R014'],
          n: 1,
          payload: PL('Ohuhu|R014'),
          ts: T0,
          keepTs: true,
          quiet: true,
        });
        state.saved.find((s) => s.id === id).bk = T0;
        save(true);
        localStorage.setItem('ms-guides-backup-ts', String(T0));
        const gs = await gatherGuides();
        return { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
      },
      [PNG, id, name, T0],
    );
  }
  test('X4 F1: ticks made while a save runs survive the page being stopped; another tab’s later save still wins', async () => {
    const a = await leaveRun(false);
    assert.deepEqual(a.got, { A: 3, B: 3, left: false }, 'B’s ticks kept (v318.24: B 0)');
    assert.deepEqual(a.errors, []);
    const b = await leaveRun(true);
    assert.equal(b.got.B, 0, 'the copy kept aside doesn’t go over another tab’s save');
    assert.equal(b.got.left, false);
  });
  test('X4 F4: restoring a backup leaves a newer guide in Recently deleted as it is; the backup’s comes in beside it', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    const bk = await withGuide(page, 5101, 'Owl');
    const r = await page.evaluate(async (bk) => {
      await sfSaveDesign({
        id: 5101,
        name: 'Owl',
        W: 1,
        H: 1,
        keys: ['Ohuhu|Y111'],
        n: 1,
        payload: PL('Ohuhu|Y111', { prog: [0] }),
        quiet: true,
      });
      openLibrary();
      libDelete(5101);
      libFinish(); // the Undo's time is over: it waits in Recently deleted
      const r = await restoreFile(bk);
      return {
        ...r,
        rows: rows(),
        prog: (await IDB.get('guide-5101')).prog,
        bin: libPendList().map((x) => x.id),
      };
    }, bk);
    assert.deepEqual(r.prog, [0], 'its progress kept (v318.24: the backup’s older copy replaced it)');
    assert.deepEqual(r.bin, [5101], 'still in Recently deleted');
    assert.deepEqual(
      r.rows.map((x) => x.name),
      ['Owl (from backup)'],
    );
    assert.match(r.toast, /1 guide in Recently deleted was left there \(Put back brings it back as it was\)/);
    // the same backup again: nothing more
    const n2 = await page.evaluate((bk) => restoreFile(bk).then(() => rows().length), bk);
    assert.equal(n2, 1);
    // one the same as the backup's still comes back as itself
    const r3 = await page.evaluate(async (bk) => {
      state.saved = state.saved.filter((s) => s.type !== 'guide');
      save(true);
      libPendSet([]);
      await IDB.put('guide-5101', bk.guides[0].payload);
      libPendSet([{ id: 5101, t: Date.now() - 864e5, e: { id: 5101, type: 'guide', name: 'Owl' } }]);
      await restoreFile(bk);
      return { rows: rows(), bin: libPendList().map((x) => x.id) };
    }, bk);
    assert.deepEqual(r3.rows, [{ id: 5101, name: 'Owl' }]);
    assert.deepEqual(r3.bin, []);
    assert.deepEqual(errors, []);
  });
  test('X4 F5: a “(before restore)” copy taken out again isn’t brought back by another tab’s save', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    const r = await page.evaluate(
      async ([KEY, PNG]) => {
        const k = await sfSaveDesign({
          id: 5201,
          name: 'Cat (before restore)',
          W: 1,
          H: 1,
          keys: [],
          n: 1,
          payload: { lmap: PNG },
          quiet: true,
        });
        // another tab saves meanwhile (its Library, which has the copy too)
        const v = JSON.parse(localStorage.getItem(KEY));
        v.other = 1;
        localStorage.setItem(KEY, JSON.stringify(v));
        dropKept(k);
        await new Promise((res) => setTimeout(res, 300));
        return {
          here: state.saved.some((s) => s.id === 5201),
          stored: JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === 5201),
        };
      },
      [KEY, PNG],
    );
    assert.deepEqual(r, { here: false, stored: false }, 'v318.24: back as an empty row');
    assert.deepEqual(errors, []);
  });
  // H6: Library › Back up from the keyboard
  test('X4 H6: Back up from the keyboard keeps focus on the button', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => openLibrary());
    await idle(page);
    await page.focus('#guidesBackup');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('guidesBackup').disabled, null, {
      timeout: 8000,
    });
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'guidesBackup',
      'v318.24: BODY',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y3.test.mjs ----
// v318.28 in the browser: using a guide, saving, output (Y3).
{
  const DAY = 864e5;
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  // F1: a guide only put away (its save landed) isn't written again at the next start
  test('Y3 F1: after a restart, a guide put away and backed up since is still in the backup', async () => {
    const { page, ctx, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    await idle(page, 2000);
    const a = await page.evaluate(async () => {
      const t = __mstest,
        id = t.curId;
      t.assignData.order.slice(5, 8).forEach((l) => (t.colored[l] = 1));
      t.guideDirty = true;
      t.renderGuide();
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await t.flushSave();
      await new Promise((r) => setTimeout(r, 500));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      const row = state.saved.find((s) => s.id === id),
        lv = JSON.parse(localStorage.getItem('ms-guide-leave') || 'null');
      // a backup made now, as backupAll's made() records it
      const now = Date.now();
      localStorage.setItem('ms-guides-backup-ts', String(now));
      row.bk = now;
      save();
      return { id, ts: row.ts, kept: !!lv && lv.base === row.ts, risk: guidesAtRisk() };
    });
    assert.ok(a.kept, 'the copy kept aside stays, based on the row the save wrote (v318.25)');
    assert.equal(a.risk, 0);
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(
      () => typeof state !== 'undefined' && !localStorage.getItem('ms-guide-leave'),
      null,
      {
        timeout: 15000,
      },
    );
    await idle(page, 2000);
    const b = await page.evaluate(async (id) => {
      const row = state.saved.find((s) => s.id === id);
      return { ts: row.ts, risk: guidesAtRisk(), prog: ((await IDB.get('guide-' + id)) || {}).prog };
    }, a.id);
    assert.equal(b.ts, a.ts, 'the row’s time is the save’s: nothing new was written');
    assert.equal(b.risk, 0, 'not “not in a backup”');
    assert.equal(b.prog.length, 3, 'the ticks are there');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  // F3: a delete still finishing with no row kept isn't in Recently deleted, and isn't said to be
  test('Y3 F3: restoring a guide whose unfinished delete kept no row: the backup’s copy takes its place', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    const T0 = Date.now() - 3 * DAY;
    const r = await page.evaluate(
      async ([PNG, T0]) => {
        const id = 5201,
          PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
        await sfSaveDesign({
          id,
          name: 'Owl',
          W: 1,
          H: 1,
          keys: ['Ohuhu|R014'],
          n: 1,
          payload: PL('Ohuhu|R014'),
          ts: T0,
          keepTs: true,
          quiet: true,
        });
        const gs = await gatherGuides(),
          bk = { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
        await sfSaveDesign({
          id,
          name: 'Owl',
          W: 1,
          H: 1,
          keys: ['Ohuhu|Y111'],
          n: 1,
          payload: PL('Ohuhu|Y111', { prog: [0] }),
          quiet: true,
        });
        // as sfDeleteDesign leaves it until the stored guide is gone (an import that never opened): no row kept
        state.saved = state.saved.filter((s) => s.id !== id);
        save(true);
        libPendSet([{ id, t: 0 }]);
        const t = document.getElementById('msToast');
        if (t) t.classList.remove('on');
        restoreAny(new File([JSON.stringify(bk)], 'b.json', { type: 'application/json' }), 'guidesRestore');
        await new Promise((res) => setTimeout(res, 1500));
        return {
          toast: document.getElementById('msToast').textContent,
          rows: state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name })),
          key: ((await IDB.get('guide-' + id)) || {}).assign,
          bin: libBinList().length,
        };
      },
      [PNG, T0],
    );
    assert.deepEqual(r.rows, [{ id: 5201, name: 'Owl' }]);
    assert.deepEqual(r.key, { 0: 'Ohuhu|R014' }, 'the backup’s');
    assert.equal(r.bin, 0);
    assert.doesNotMatch(r.toast, /Recently deleted/);
    assert.deepEqual(errors, []);
  });
}
