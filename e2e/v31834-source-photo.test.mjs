// v318.34 (Stage 3 C): a guide built from a picture keeps that picture on this device ('src-<id>' beside the guide, its
// settings in the payload as `src`), so Edit sections' Adjust photo works after the guide is opened again (after
// another guide and a reload), for a photo that was straightened and for a scan: the picture is read only when Adjust
// photo opens ("Getting the photo ready…"), the controls then show the stored values, a turn asks before clearing
// progress and Undo brings it back, and detecting again gives about the sections of a fresh build. Backups take the
// pictures only when "Include guide photos" is ticked; a failed src- write never blocks the guide; Save a copy carries
// it; delete then Put back keeps it; the sample keeps none. Each test fails on v318.33 (no record is written).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  idle,
  sampleGuide,
  saveGuide,
  letterGuide,
  haveSet,
  saveCopy,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

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
  await page.waitForFunction(() => document.getElementById('sfSaveSt').textContent === 'Sample');
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
