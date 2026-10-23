// v318.37 (Fable X2): a cropped guide's kept picture after a reopen. X2-1: srcSettings saved the crop rounded to 1/100,
// so srcPlace rebuilt a picture of another size and gave the photo up ("The photo isn't kept…") for every cropped
// guide; now the crop is saved exactly, and a guide saved before v318.37 whose rebuilt picture is within 2 px of its
// map's size is fitted rather than refused (srcPlace, SRC_FIT). X2-2: a first save that lands after the person
// opened something else still writes the picture's record (firstSave's gen branch, srcKeepLate).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet, saveGuide, ROOT } from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

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

const ARB = { x: 0.1234, y: 0.0871, w: 0.7312, h: 0.8149 }; // an arbitrary crop, as a drag or Auto crop gives

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
