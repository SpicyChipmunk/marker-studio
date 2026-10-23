// v319 (Fable Y2-1): a guide saved before v319 (its `src` settings without the v: 2 mark: v318.34–37, the crop and
// corners rounded to 1/100) whose picture rebuilt from them is within 1/100 of the map's long side is fitted and
// back (srcFit, 25-source-photo.js: 2 px had rescued a quarter of them, fitsim); one saved from v319 on (v: 2, the
// crop exact) keeps the 2 px fit, so a picture 4 px off is refused as not the sections' picture. Fails on v318.37
// (no mark written; the legacy ARB crop, 4 px off, was refused).
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

const ARB = { x: 0.1234, y: 0.0871, w: 0.7312, h: 0.8149 }; // an arbitrary crop, as a drag or Auto crop gives

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
