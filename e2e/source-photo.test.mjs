// The picture kept with each guide (Edit sections › Adjust photo after reopening).
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  answerAsks,
  haveSet,
  idle,
  letterGuide,
  openApp,
  openAtScale,
  sampleGuide,
  saveCopy,
  saveGuide,
  setup,
  teardown,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v31832-fixes.test.mjs ----
// v318.32 bug fixes (Fable R32: U1-1, D3-1, D1-3, decisions 6.9 and 6.10). Each fails on v318.31.
{
  // U1-1: Adjust photo opens into view, its rows above the Build bar (they had opened under the sticky bar, or below the
  // fold, so nothing seemed to happen)
  async function adjustGeo(page) {
    return page.evaluate(() => {
      const r = (s) => {
        const e = document.querySelector(s);
        return e ? e.getBoundingClientRect() : null;
      };
      const tg = r('#sfAdjToggle'),
        // (the panel's last row: Tilt, or Sensitivity when Enhance is on)
        sens = document.getElementById('sfSensWrap'),
        last = sens && sens.offsetParent !== null ? sens : document.getElementById('sfTilt').closest('label'),
        pn = last ? last.getBoundingClientRect() : null,
        bar = r('#sfWork>.sfbar'),
        pic = r('#sfView');
      return {
        toggleTop: tg && tg.top,
        panelBottom: pn && pn.bottom,
        barTop: bar && bar.top,
        picBottom: pic && pic.bottom,
        vh: innerHeight,
      };
    });
  }
  for (const [name, size] of [
    ['phone 390×844', { width: 390, height: 844, touch: true }],
    ['iPad portrait 820×1180', { width: 820, height: 1180, touch: true }],
  ]) {
    test('U1-1 ' + name + ': Adjust photo opens with its rows in view above the Build bar', async () => {
      const { page, errors } = await openApp(size);
      await sampleGuide(page);
      await idle(page);
      await answerAsks(page);
      await page.click('#sfBack2');
      await idle(page);
      // (as a finger would: the toggle in view, the page not scrolled further by the click)
      await page.$eval('#sfAdjToggle', (b) => b.scrollIntoView({ block: 'center' }));
      await idle(page);
      await page.$eval('#sfAdjToggle', (b) => b.click());
      await idle(page);
      const g = await adjustGeo(page);
      assert.ok(g.panelBottom != null && g.barTop != null, 'panel and bar: ' + JSON.stringify(g));
      assert.ok(
        g.panelBottom <= g.barTop + 1,
        `the panel's last row above the Build bar: ${g.panelBottom} vs ${g.barTop} (v318.31: under it)`,
      );
      assert.ok(g.panelBottom <= g.vh, 'and on the screen');
      assert.ok(
        g.toggleTop >= g.picBottom - 1,
        `the toggle below the pinned picture: ${g.toggleTop} vs ${g.picBottom}`,
      );
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from v31834-source-photo.test.mjs ----
// v318.34 (Stage 3 C): a guide built from a picture keeps that picture on this device ('src-<id>' beside the guide, its
// settings in the payload as `src`), so Edit sections' Adjust photo works after the guide is opened again (after
// another guide and a reload), for a photo that was straightened and for a scan: the picture is read only when Adjust
// photo opens ("Getting the photo ready…"), the controls then show the stored values, a turn asks before clearing
// progress and Undo brings it back, and detecting again gives about the sections of a fresh build. Backups take the
// pictures only when "Include guide photos" is ticked; a failed src- write never blocks the guide; Save a copy carries
// it; delete then Put back keeps it; the sample keeps none. Each test fails on v318.33 (no record is written).
{
  // an iPad (11-inch class), portrait, with touch
  const IPAD = { width: 820, height: 1180, touch: true };
  const rec = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('src-' + id).then((r) =>
          r ? { w: r.w, h: r.h, kind: r.kind, ts: r.ts, head: r.u.slice(0, 15), len: r.u.length } : null,
        ),
      id,
    );
  const payloadSrc = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && p.src), id);
  const count = (page) => page.evaluate(() => (__mstest.assignData ? __mstest.assignData.N : null));
  const adj = (page) =>
    page.evaluate(() => {
      const g = (id) => document.getElementById(id);
      return {
        crop: !!g('sfCrop'),
        load: g('sfAdjLoad') ? g('sfAdjLoad').textContent : '',
        note: g('sfAdjNone') ? g('sfAdjNone').textContent : '',
        sens: g('sfSens') ? +g('sfSens').value : null,
        tilt: g('sfTilt') ? +g('sfTilt').value : null,
        enh: g('sfEnh') ? g('sfEnh').checked : null,
        straight: !!g('sfPgUndo'),
      };
    });
  // another guide, a reload, then this one from the Library: opened from its stored copy, nothing of it in memory
  async function reopen(page, id) {
    await page.click('#mHome');
    await idle(page);
    const other = await page.evaluate(
      (id) => state.saved.find((s) => s.type === 'guide' && s.id !== id).id,
      id,
    );
    for (const gid of [other, id]) {
      if (gid === id) {
        await page.reload();
        await idle(page, 2500);
      }
      await page.evaluate(() => openLibrary());
      await idle(page);
      await page.click(`.srow[data-id="${gid}"] button.sopen`);
      await page.waitForFunction(
        (g) =>
          __mstest.curId === g &&
          !!__mstest.assignData &&
          (__mstest.sfmode === 'guide' || __mstest.sfmode === 'color'),
        gid,
      );
      await idle(page);
      // (part-way coloured, it opens in Colour along: back to the plan)
      if (await page.evaluate(() => __mstest.sfmode === 'color')) {
        await page.click('#sfDoneBtn');
        await idle(page);
      }
      if (gid !== id) {
        await page.click('#mHome');
        await idle(page);
      }
    }
  }
  // Edit sections, Adjust photo open (a slow read, so the loading state can be seen), its tools in place
  async function adjustOpen(page, slow) {
    await page.click('#sfBack2');
    await idle(page);
    if (slow)
      await page.evaluate(() => {
        const g = IDB.get;
        window.__get = g;
        IDB.get = (k) =>
          /^src-/.test(k) ? new Promise((r) => setTimeout(() => r(g.call(IDB, k)), 700)) : g.call(IDB, k);
      });
    if (!(await page.$('#sfCrop')) && !(await page.$('#sfAdjLoad')) && !(await page.$('#sfAdjNone')))
      await page.click('#sfAdjToggle');
    const a0 = await adj(page);
    await page.waitForFunction(
      () => !!document.getElementById('sfCrop') || !!document.getElementById('sfAdjNone'),
      null,
      {
        timeout: 30000,
      },
    );
    if (slow) await page.evaluate(() => (IDB.get = window.__get));
    await idle(page);
    return a0;
  }
  async function fresh(size) {
    const a = await openApp(size);
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  // a photo of a page on a table, straightened (e2e/v313-photo), built, in the Library
  async function photoGuide(page) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({
      name: 'lit-mandala-table.png',
      mimeType: 'image/png',
      buffer: await readFile(join(ROOT, 'e2e', 'fixtures', 'lit-mandala-table.png')),
    });
    await page.waitForSelector('#sfPgGo', { timeout: 40000 });
    await page.click('#sfPgGo');
    await sections(page);
    await idle(page);
    assert.ok(await page.evaluate(() => !!__mstest.pgQ), 'straightened');
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
  }
  test('1: a straightened photo: the picture is kept with the guide; opened again after another guide and a reload, Adjust photo loads it, shows the stored values, Adjust corners is back, and detecting again finds about the same sections', async () => {
    const { page, errors } = await fresh(IPAD);
    await photoGuide(page);
    const id = await page.evaluate(() => __mstest.curId),
      n0 = await count(page),
      set0 = await page.evaluate(() => __mstest.srcSettings());
    const r = await rec(page, id);
    assert.ok(r, 'a src- record');
    assert.equal(r.kind, 'photo');
    assert.equal(r.head, 'data:image/jpeg');
    assert.ok(r.w >= 600 && r.h >= 600, 'the photo as taken ' + JSON.stringify(r));
    const ps = await payloadSrc(page, id);
    assert.equal(ps.k, 'photo');
    assert.ok(Array.isArray(ps.q) && ps.q.length === 4, 'its corners in the payload');
    assert.deepEqual(ps, set0);
    // the sample beside it (it keeps no picture), then this one again
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(
      () => document.getElementById('sfSaveSt').textContent === 'Sample · change it to keep it',
    );
    await idle(page);
    await saveGuide(page);
    const sid = await page.evaluate(() => __mstest.curId);
    assert.notEqual(sid, id);
    assert.equal(await rec(page, sid), null, 'the sample keeps none');
    assert.equal(await payloadSrc(page, sid), undefined, 'and no settings');
    await reopen(page, id);
    assert.equal(await page.evaluate(() => __mstest.srcSize), null, 'nothing read at open');
    assert.deepEqual(await page.evaluate(() => __mstest.srcSet), ps, 'its settings known');
    const a0 = await adjustOpen(page, true);
    assert.equal(a0.load, 'Getting the photo ready…', 'the loading state');
    assert.equal(a0.crop, false);
    const a = await adj(page);
    assert.ok(a.crop, 'the tools');
    assert.equal(a.note, '');
    assert.ok(a.straight, 'Page straightened · Undo · Adjust corners');
    assert.equal(a.sens, Math.round((16 - ps.c) / 1.4));
    assert.equal(a.enh, true);
    assert.ok(await page.evaluate(() => !!__mstest.pgQ && !!__mstest.pgOrig && !!__mstest.gray));
    // detecting again with the same settings: about the sections of the fresh build (the kept JPEG isn't the original)
    await page.evaluate(() => __mstest.resegment());
    await page.waitForFunction(() => !__mstest.segBusy, null, { timeout: 60000 });
    await idle(page);
    const n1 = await page.evaluate(() => __mstest.comps.filter((c, i) => i && c && !c.merged).length);
    assert.ok(Math.abs(n1 - n0) <= Math.max(3, n0 * 0.1), `sections after: ${n1}, fresh build: ${n0}`);
    assert.deepEqual(errors, []);
  });
  test('2: a scan (line art, no lens): kept as a PNG; after a reopen a turn works as on a first build; with progress it asks first (the dialog) and Undo brings the progress back', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId),
      dims = await page.evaluate(() => [__mstest.W, __mstest.H]);
    const r = await rec(page, id);
    assert.ok(r, 'a src- record');
    assert.equal(r.kind, 'scan');
    assert.equal(r.head, 'data:image/png;');
    assert.equal((await payloadSrc(page, id)).up, 1, 'enlarged, as a small download is');
    // a section ticked
    const l = await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[0];
      t.colored[l] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return l;
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await reopen(page, id);
    assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), dims);
    assert.ok(await page.evaluate((l) => __mstest.colored[l] === 1, l), 'the tick is back');
    await adjustOpen(page, false);
    assert.ok((await adj(page)).crop);
    // turn right: the question, as when the guide was first built
    await page.click('#sfRotR');
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAsk'), /Rebuild the sections\?/);
    assert.match(
      await page.textContent('#sfEdAsk'),
      /This redraws the sections and clears your colouring progress \(ticks, part-done tones, pins and flat sections\)\. Undo in Edit sections brings it all back\./,
    );
    await page.click('#sfEdAsk [data-a="go"]');
    await page.waitForFunction((d) => __mstest.W === d[1] && __mstest.H === d[0] && !__mstest.segBusy, dims, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.colored.some((c) => c === 1)), false, 'progress cleared');
    assert.equal(await page.evaluate(() => __mstest.rot90), 90);
    await page.click('#sfPlanUndo');
    await page.waitForFunction((d) => __mstest.W === d[0] && __mstest.H === d[1], dims);
    await idle(page);
    assert.ok(await page.evaluate((l) => __mstest.colored[l] === 1, l), 'Undo: the tick is back');
    assert.equal(await page.evaluate(() => __mstest.rot90), 0);
    assert.deepEqual(errors, []);
  });
  test('3: backups: the pictures only with "Include guide photos" ticked (off by default, both dialogs agree); restore puts them back', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    assert.ok(await rec(page, id));
    const fs = await import('node:fs/promises');
    const backup = async () => {
      const [dl] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => backupAll('backupDownload')),
      ]);
      return JSON.parse(await fs.readFile(await dl.path(), 'utf8'));
    };
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    assert.equal(await page.isChecked('#bkPhotos'), false, 'off by default');
    let d = await backup();
    assert.ok(
      d.guides.every((g) => g.src === undefined),
      'no pictures without the tick',
    );
    await page.click('#bkPhotos');
    assert.equal(await page.isChecked('#bkPhotos2'), true, 'the other dialog agrees');
    d = await backup();
    const g = d.guides.find((x) => x.id === id);
    assert.ok(
      g && g.src && /^data:image\/png;base64,/.test(g.src.u) && g.src.kind === 'scan',
      'the picture in the backup',
    );
    assert.ok(d.guides.filter((x) => x.src).length === 1, 'the sample has none');
    // restored where it's gone: the record is back
    await page.evaluate((id) => IDB.del('src-' + id), id);
    assert.equal(await rec(page, id), null);
    await page.evaluate((g) => new Promise((r) => restoreGuideList(g, 0, r)), d.guides);
    await idle(page, 1200);
    const r2 = await rec(page, id);
    assert.ok(r2 && r2.kind === 'scan', 'restored');
    assert.deepEqual(errors, []);
  });
  test('4: storage full for the picture alone (the guide put worked): the guide is saved, said once, and opens again as a guide without its picture', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await page.evaluate(() => {
      window.__put = IDB.put;
      window.__srcTries = 0;
      IDB.put = function (k, v) {
        if (/^src-/.test(k)) {
          window.__srcTries++;
          return Promise.reject(new DOMException('full', 'QuotaExceededError'));
        }
        return window.__put.call(IDB, k, v);
      };
    });
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    assert.equal(await rec(page, id), null);
    assert.equal(await page.evaluate(() => window.__srcTries), 1);
    await page.waitForSelector('#msToast.on');
    assert.match(
      await page.textContent('#msToast'),
      /The guide is saved, but its photo couldn’t be kept with it \(this browser’s storage may be full\), so it can’t be turned or cropped again later\./,
    );
    // more saves don't say it again or try again
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal(await page.evaluate(() => window.__srcTries), 1);
    assert.ok(
      (await payloadSrc(page, id)) && (await payloadSrc(page, id)).k === 'scan',
      'its settings are still saved',
    );
    await page.evaluate(() => (IDB.put = window.__put));
    await reopen(page, id);
    await adjustOpen(page, false);
    const a = await adj(page);
    assert.equal(a.crop, false);
    assert.match(a.note, /^The photo isn’t kept with a saved guide/);
    assert.deepEqual(errors, []);
  });
  test('5: Save a copy carries the picture; delete, then Put back from Recently deleted, keeps it; Delete now removes it', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    const r0 = await rec(page, id);
    await saveCopy(page);
    await page.waitForFunction((id) => __mstest.curId !== id && __mstest.inLibrary, id);
    await idle(page);
    const cid = await page.evaluate(() => __mstest.curId);
    const r1 = await rec(page, cid);
    assert.ok(r1 && r1.len === r0.len && r1.kind === r0.kind, 'the copy has the picture');
    assert.ok(await rec(page, id), 'the original keeps its own');
    // deleted from the Library, Put back from Recently deleted: the record was never touched
    await page.evaluate(() => setMode('home'));
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.evaluate((id) => libDelete(id), id);
    await idle(page);
    await page.evaluate(() => libFinish());
    assert.ok(await rec(page, id), 'kept while in Recently deleted');
    await page.click('#libBin');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="put:' + id + '"]');
    await idle(page);
    assert.ok(await page.evaluate((id) => state.saved.some((s) => s.id === id), id), 'in the Library again');
    assert.ok(await rec(page, id), 'with its picture');
    // deleted for good: gone with the guide
    await page.evaluate((id) => libDelete(id), id);
    await idle(page);
    await page.evaluate(() => libFinish());
    await page.evaluate((id) => libPurge(id), id);
    await idle(page);
    assert.equal(await rec(page, id), null, 'purged with the guide');
    assert.equal(await page.evaluate((id) => IDB.get('guide-' + id).then((g) => g || null), id), null);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31837-src-crop.test.mjs ----
// v318.37 (Fable X2): a cropped guide's kept picture after a reopen. X2-1: srcSettings saved the crop rounded to 1/100,
// so srcPlace rebuilt a picture of another size and gave the photo up ("The photo isn't kept…") for every cropped
// guide; now the crop is saved exactly, and a guide saved before v318.37 whose rebuilt picture is within 2 px of its
// map's size is fitted rather than refused (srcPlace, SRC_FIT). X2-2: a first save that lands after the person
// opened something else still writes the picture's record (firstSave's gen branch, srcKeepLate).
{
  const VIEW = { width: 820, height: 1180, touch: true };
  // the welcome: a set, then the photo (e2e/fixtures/letter-page.png, 850 × 1100, so it's enlarged to 1600: srcUp),
  // cropped as given (a fraction of the picture, as a drag or Auto crop leaves it) and built
  async function croppedGuide(page, crop, again) {
    if (!again) {
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      await page.click('#wcAdd');
    }
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      again ? page.evaluate(() => SF.pickPhoto()) : page.click('#wcPhoto'),
    ]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    if (crop) {
      await page.evaluate((c) => __mstest.geoSet({ crop: c }), crop);
      await page.waitForFunction(() => !__mstest.segBusy && __mstest.cropRect, null, { timeout: 60000 });
      await idle(page);
    }
    const dims = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    return dims;
  }
  async function reopen(page, id) {
    await page.click('#mHome');
    await idle(page);
    await page.reload();
    await idle(page, 2500);
    await page.evaluate(() => openLibrary());
    await idle(page);
    await page.click(`.srow[data-id="${id}"] button.sopen`);
    await page.waitForFunction((g) => __mstest.curId === g && !!__mstest.assignData, id);
    await idle(page);
    if (await page.evaluate(() => __mstest.sfmode === 'color')) {
      await page.click('#sfDoneBtn');
      await idle(page);
    }
  }
  // Edit sections › Adjust photo: whether the Crop tool is there (the picture is back) or the "isn't kept" note
  async function adjustOpen(page) {
    await page.click('#sfBack2');
    await idle(page);
    if (!(await page.$('#sfCrop')) && !(await page.$('#sfAdjLoad')) && !(await page.$('#sfAdjNone')))
      await page.click('#sfAdjToggle');
    await page.waitForFunction(
      () => !!document.getElementById('sfCrop') || !!document.getElementById('sfAdjNone'),
      null,
      { timeout: 30000 },
    );
    await idle(page);
    return page.evaluate(() => ({
      crop: !!document.getElementById('sfCrop'),
      note: document.getElementById('sfAdjNone') ? document.getElementById('sfAdjNone').textContent : '',
      WH: [__mstest.W, __mstest.H],
      cropRect: __mstest.cropRect,
    }));
  }
  // the guide's saved `src` crop as v318.34-36 wrote it: rounded to 1/100 (and marked v: 1 as they did; v319 writes
  // v: 2 for the exact crop)
  function legacyCrop(page, id) {
    return page.evaluate(async (id) => {
      const p = await IDB.get('guide-' + id),
        r = (v) => Math.round(v * 100) / 100,
        c = p.src.crop;
      p.src.crop = { x: r(c.x), y: r(c.y), w: r(c.w), h: r(c.h) };
      p.src.v = 1;
      await IDB.put('guide-' + id, p);
      return p.src.crop;
    }, id);
  }
  const ARB = { x: 0.1234, y: 0.0871, w: 0.7312, h: 0.8149 };
  // an arbitrary crop, as a drag or Auto crop gives

  for (const crop of [ARB, { x: 0.1, y: 0.1, w: 0.75, h: 0.8 }]) {
    test(
      'a cropped scan ' +
        JSON.stringify(crop) +
        ': saved exactly, and Adjust photo after a reopen has the picture',
      async () => {
        const { page, errors } = await openApp(VIEW);
        const dims = await croppedGuide(page, crop);
        await saveGuide(page);
        const id = await page.evaluate(() => __mstest.curId);
        const ps = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && p.src), id);
        const rec = await page.evaluate((id) => IDB.get('src-' + id).then((r) => !!r), id);
        console.log('payload src', JSON.stringify(ps), 'record', rec, 'dims', dims);
        assert.deepEqual(ps.crop, crop, 'the crop as it was, not rounded');
        assert.ok(rec, 'the record is there');
        await reopen(page, id);
        const a = await adjustOpen(page);
        console.log('after reopen', JSON.stringify(a));
        assert.deepEqual(a.WH, dims, 'the saved sections');
        assert.equal(a.note, '', 'no "no photo" note');
        assert.ok(a.crop, 'the picture is back');
        assert.deepEqual(a.cropRect, crop);
        assert.deepEqual(errors, []);
      },
    );
  }
  // a guide saved before v318.37 (its crop rounded to 1/100): within 2 px of the saved map's size, the picture is
  // fitted and back. (v319, Y2-1: settings without v319's v: 2 mark get 1/100 of the long side, srcFit, so the 4 px
  // case is fitted too now; the one refused is in e2e/v319-src-fit)
  for (const [crop, back] of [
    [{ x: 0.1234, y: 0.1, w: 0.7312, h: 0.8 }, true], // 0.73 × 850 = 621 for 622: 2 px at 1600 tall
    [ARB, true], // 0.81 × 1100 = 891 for 896: enlarged to 1600 tall, 4 px wider
  ]) {
    test(
      'saved before v318.37 with the crop rounded ' +
        JSON.stringify(crop) +
        ': ' +
        (back ? 'fitted, the picture back' : 'too far off, refused'),
      async () => {
        const { page, errors } = await openApp(VIEW);
        const dims = await croppedGuide(page, crop);
        await saveGuide(page);
        const id = await page.evaluate(() => __mstest.curId);
        const lc = await legacyCrop(page, id);
        console.log('legacy crop', JSON.stringify(lc), 'dims', dims);
        await reopen(page, id);
        const a = await adjustOpen(page);
        console.log('after reopen', JSON.stringify(a));
        assert.deepEqual(a.WH, dims, 'the saved sections');
        assert.deepEqual(a.cropRect, lc, 'the settings as saved');
        if (back) {
          assert.equal(a.note, '', 'no "no photo" note');
          assert.ok(a.crop, 'the picture is back');
        } else {
          assert.match(a.note, /isn’t kept/);
          assert.equal(a.crop, false);
        }
        assert.deepEqual(errors, []);
      },
    );
  }
  test('a first save that lands after another picture was opened: the picture the save was of is kept beside the entry', async () => {
    const { page, errors } = await openApp(VIEW);
    await croppedGuide(page, null);
    assert.equal(await page.evaluate(() => __mstest.inLibrary), false);
    // (the Library's write held back, so the sample is open before the save lands: firstSave's gen branch)
    await page.evaluate(() => {
      const put = IDB.put;
      IDB.put = (k, v) =>
        /^guide-(?!autosave)/.test(k)
          ? new Promise((r) => setTimeout(r, 1500)).then(() => put(k, v))
          : put(k, v);
    });
    // (the save in flight, then the switch that doesn't wait for it, as a PDF page chosen meanwhile: resetForNewPicture,
    // which moves the save's generation; the sample then opens in its place)
    await page.evaluate(() => {
      __mstest.saveNow();
      __mstest.assign.resetForNewPicture();
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null, null, { timeout: 30000 });
    // (the entry lands about 1.5 s on, its record a moment after: the guides' store polled for both)
    const keys = await page.evaluate(async () => {
      let ks = [];
      for (let i = 0; i < 60; i++) {
        ks = (await IDB.keys()).filter((k) => /^(guide|src)-/.test(k));
        const g = ks.find((k) => /^guide-(?!autosave)/.test(k));
        if (g && ks.includes('src-' + g.slice(6))) return { ok: true, ks };
        await new Promise((r) => setTimeout(r, 250));
      }
      return { ok: false, ks };
    });
    console.log('keys', JSON.stringify(keys));
    assert.ok(keys.ok, 'the entry and its picture are both there');
    assert.equal(await page.evaluate(() => __mstest.curId), null, 'the sample stays the open guide, unsaved');
    assert.deepEqual(errors, []);
  });
  // X2-2, slotAdopt: another tab moved this tab's new guide from the Resume slot into the Library (keepSlot: it has the
  // sections, not the picture, and notes the entry in ms-slot-kept); this tab adopts the entry at its next save, and now
  // writes the picture beside it. (The other tab's part is done here as keepSlot does it: a tab's new guide waits in
  // the slot only while its Library writes fail, so that's A's storage failing, then working again)
  test('a new guide another tab kept in the Library: this tab adopts the entry and keeps its picture beside it', async () => {
    const { page: a, errors } = await openApp(VIEW);
    // (A's Library writes fail, as with storage full: its new guide waits in the Resume slot instead)
    await a.evaluate(() => {
      const put = IDB.put;
      window.__put0 = put;
      IDB.put = (k, v) => (/^guide-(?!autosave)/.test(k) ? Promise.reject(new Error('full')) : put(k, v));
    });
    await croppedGuide(a, null);
    await idle(a, 2300);
    assert.equal(await a.evaluate(() => __mstest.inLibrary), false);
    const note = await a.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'));
    assert.ok(
      note && note.dirty && note.tab && note.savedId == null,
      'in the Resume slot: ' + JSON.stringify(note),
    );
    // the other tab keeps it (keepSlot): the slot's guide saved as an entry, noted for this tab
    const kept = await a.evaluate(async (note) => {
      IDB.put = window.__put0;
      const d = await IDB.get('guide-autosave');
      const id = await sfSaveDesign({
        name: d.name,
        W: d.W,
        H: d.H,
        keys: d.keys || [],
        n: d.n,
        payload: d.payload,
        quiet: true,
      });
      localStorage.setItem('ms-slot-kept', JSON.stringify([{ tab: note.tab, tok: note.tok, id }]));
      return id;
    }, note);
    assert.ok(kept, 'kept in the Library');
    assert.equal(
      await a.evaluate((id) => IDB.get('src-' + id).then((r) => !!r), kept),
      false,
      'no picture with it yet',
    );
    // A's next change: it adopts the entry, and its picture goes beside it
    await a.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    await a.evaluate(() => __mstest.flushSave());
    await a.waitForFunction((id) => __mstest.curId === id, kept, { timeout: 10000 });
    // (the record a moment after the adopt: the store polled; waitForFunction doesn't wait on a promise)
    const rec = await a.evaluate(async (id) => {
      for (let i = 0; i < 40; i++) {
        const r = await IDB.get('src-' + id);
        if (r) return { w: r.w, h: r.h, kind: r.kind };
        await new Promise((r) => setTimeout(r, 250));
      }
      return null;
    }, kept);
    console.log('adopted', kept, 'record', JSON.stringify(rec));
    assert.ok(rec, 'the picture is beside the entry');
    assert.deepEqual(errors, []);
  });
}

// ---- from v319-src-fit.test.mjs ----
// v319 (Fable Y2-1): a guide saved before v319 (its `src` settings without the v: 2 mark: v318.34–37, the crop and
// corners rounded to 1/100) whose picture rebuilt from them is within 1/100 of the map's long side is fitted and
// back (srcFit, 25-source-photo.js: 2 px had rescued a quarter of them, fitsim); one saved from v319 on (v: 2, the
// crop exact) keeps the 2 px fit, so a picture 4 px off is refused as not the sections' picture. Fails on v318.37
// (no mark written; the legacy ARB crop, 4 px off, was refused).
{
  const VIEW = { width: 820, height: 1180, touch: true };
  // the welcome: a set, then the photo (e2e/fixtures/letter-page.png, 850 × 1100, so it's enlarged to 1600: srcUp),
  // cropped as given (a fraction of the picture, as a drag or Auto crop leaves it) and built
  async function croppedGuide(page, crop, again) {
    if (!again) {
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      await page.click('#wcAdd');
    }
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      again ? page.evaluate(() => SF.pickPhoto()) : page.click('#wcPhoto'),
    ]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    if (crop) {
      await page.evaluate((c) => __mstest.geoSet({ crop: c }), crop);
      await page.waitForFunction(() => !__mstest.segBusy && __mstest.cropRect, null, { timeout: 60000 });
      await idle(page);
    }
    const dims = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    return dims;
  }
  async function reopen(page, id) {
    await page.click('#mHome');
    await idle(page);
    await page.reload();
    await idle(page, 2500);
    await page.evaluate(() => openLibrary());
    await idle(page);
    await page.click(`.srow[data-id="${id}"] button.sopen`);
    await page.waitForFunction((g) => __mstest.curId === g && !!__mstest.assignData, id);
    await idle(page);
    if (await page.evaluate(() => __mstest.sfmode === 'color')) {
      await page.click('#sfDoneBtn');
      await idle(page);
    }
  }
  // Edit sections › Adjust photo: whether the Crop tool is there (the picture is back) or the "isn't kept" note
  async function adjustOpen(page) {
    await page.click('#sfBack2');
    await idle(page);
    if (!(await page.$('#sfCrop')) && !(await page.$('#sfAdjLoad')) && !(await page.$('#sfAdjNone')))
      await page.click('#sfAdjToggle');
    await page.waitForFunction(
      () => !!document.getElementById('sfCrop') || !!document.getElementById('sfAdjNone'),
      null,
      { timeout: 30000 },
    );
    await idle(page);
    return page.evaluate(() => ({
      crop: !!document.getElementById('sfCrop'),
      note: document.getElementById('sfAdjNone') ? document.getElementById('sfAdjNone').textContent : '',
      WH: [__mstest.W, __mstest.H],
      cropRect: __mstest.cropRect,
    }));
  }
  // the guide's saved `src` crop as v318.34-36 wrote it: rounded to 1/100, or moved by `off` (a fraction of the
  // picture, to put it further off); its mark as given (v: 1 as v318.34–37 wrote, none, or v: 2 as v319 does)
  function legacyCrop(page, id, v, off) {
    return page.evaluate(
      async ([id, v, off]) => {
        const p = await IDB.get('guide-' + id),
          r = (x) => Math.round(x * 100) / 100,
          c = p.src.crop;
        p.src.crop = { x: r(c.x), y: r(c.y), w: r(c.w) + (off || 0), h: r(c.h) };
        if (v == null) delete p.src.v;
        else p.src.v = v;
        await IDB.put('guide-' + id, p);
        return p.src.crop;
      },
      [id, v, off],
    );
  }
  const ARB = { x: 0.1234, y: 0.0871, w: 0.7312, h: 0.8149 };
  // an arbitrary crop, as a drag or Auto crop gives

  test('a cropped scan saved now: its settings carry the v: 2 mark', async () => {
    const { page, errors } = await openApp(VIEW);
    await croppedGuide(page, ARB);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    const ps = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && p.src), id);
    assert.equal(ps.v, 2, JSON.stringify(ps));
    assert.deepEqual(ps.crop, ARB);
    assert.deepEqual(errors, []);
  });
  // ARB rounded: 0.81 × 1100 = 891 for 896, enlarged to 1600 tall: 4 px wider (1115 for 1111). Legacy settings (v: 1
  // or none) take it (the allowance is 16 px at 1600); v319's own (v: 2) don't; and a legacy crop a further 1/50 of
  // the picture wider (about 34 px off) is beyond the allowance
  for (const [mark, off, back] of [
    [1, 0, true],
    [null, 0, true],
    [2, 0, false],
    [1, 0.02, false],
  ]) {
    test(
      'the crop rounded, settings ' +
        (mark == null ? 'without a mark' : 'v: ' + mark) +
        (off ? ', a further ' + off + ' wider' : '') +
        ': ' +
        (back ? 'fitted, the picture back' : 'too far off, refused'),
      async () => {
        const { page, errors } = await openApp(VIEW);
        const dims = await croppedGuide(page, ARB);
        await saveGuide(page);
        const id = await page.evaluate(() => __mstest.curId);
        const lc = await legacyCrop(page, id, mark, off);
        console.log('legacy crop', JSON.stringify(lc), 'dims', dims);
        await reopen(page, id);
        const a = await adjustOpen(page);
        console.log('after reopen', JSON.stringify(a));
        assert.deepEqual(a.WH, dims, 'the saved sections');
        assert.deepEqual(a.cropRect, lc, 'the settings as saved');
        if (back) {
          assert.equal(a.note, '', 'no "no photo" note');
          assert.ok(a.crop, 'the picture is back');
        } else {
          assert.match(a.note, /isn’t kept/);
          assert.equal(a.crop, false);
        }
        assert.deepEqual(errors, []);
      },
    );
  }
  // (Y2-2) the note when a guide's picture can't be kept says why (srcFail): a photo whose record would be over
  // SRC_MAX (8e6 characters of data: URL; srcWrite passes 'big') is "too big to keep", not "storage may be full",
  // which is kept for a write that failed. Said once per guide
  test('the note when a picture can’t be kept: too big for its record, or the write failed', async () => {
    const { page, errors } = await openApp(VIEW);
    await haveSet(page);
    await idle(page);
    const say = (id, why) =>
      page.evaluate(
        ([id, why]) => {
          const t = document.getElementById('msToast');
          if (t) t.textContent = '';
          __mstest.srcFail(id, why);
          const u = document.getElementById('msToast');
          return u ? u.textContent : '';
        },
        [id, why],
      );
    assert.equal(
      await say(1, 'big'),
      'The guide is saved, but its photo is too big to keep with it, so it can’t be turned or cropped again later.',
    );
    assert.equal(await say(1, ''), '', 'said once per guide');
    assert.equal(
      await say(2, ''),
      'The guide is saved, but its photo couldn’t be kept with it (this browser’s storage may be full), so it can’t be turned or cropped again later.',
    );
    assert.deepEqual(errors, []);
  });
}
