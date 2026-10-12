// v315 (Q10): small fixes. A photo of the finished page changed elsewhere (another tab, a restore) is shown when the
// tab comes back into view; a restore brings the backup's photo in when it's newer than the one here; the photo's
// record is read as a guide opens (so Put back always has it), without decoding the picture; and opening a PDF
// offline, before the PDF reader was ever fetched, says it needs the internet once. Each test fails on v314.1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// the sample, every section coloured, in the Library and open in Colour along
async function finished(page) {
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.smpTry = 0;
    t.curName = 'Finished jellyfish';
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfFin [data-fin="add"]');
  return page.evaluate(() => __mstest.curId);
}
// a photo record put straight in (a plain JPEG of one colour, as another tab or a restore would leave it)
const putRec = (page, id, ts, col) =>
  page.evaluate(
    ([id, ts, col]) => {
      const c = document.createElement('canvas');
      c.width = 170;
      c.height = 220;
      const g = c.getContext('2d');
      g.fillStyle = col;
      g.fillRect(0, 0, 170, 220);
      const r = { u: c.toDataURL('image/jpeg', 0.8), w: 170, h: 220, ts, flat: 1 };
      return IDB.put('fin-' + id, r).then(() => r.u);
    },
    [id, ts, col],
  );
const stored = (page, id) => page.evaluate((id) => IDB.get('fin-' + id).then((r) => r || null), id);
// (in the page: waitForFunction doesn't wait for a promise) until the stored photo is u
const storedIs = (page, id, u) =>
  page.evaluate(
    ([id, u]) =>
      new Promise((res, rej) => {
        const t0 = Date.now(),
          go = () =>
            IDB.get('fin-' + id).then((r) => {
              if (r && r.u === u) res();
              else if (Date.now() - t0 > 30000) rej(new Error('not the photo expected'));
              else setTimeout(go, 100);
            });
        go();
      }),
    [id, u],
  );
// a restore of the Library's backup file, to its end (it reads the open guide's photo again last)
async function restore(page, file) {
  await page.evaluate(() => {
    window.__fr = 0;
    const o = SF.finRefresh;
    SF.finRefresh = function () {
      window.__fr++;
      return o.apply(this, arguments);
    };
  });
  await page.setInputFiles('#guidesFile', file);
  await page.waitForFunction(() => window.__fr > 0, null, { timeout: 30000 });
  await idle(page);
}
const backInView = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('a photo added, changed or removed in another tab shows when this tab comes back into view', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  // added elsewhere
  const u1 = await putRec(page, id, Date.now(), '#c33');
  await backInView(page);
  await page.waitForSelector('#sfFin .sffinpic img');
  assert.equal(await page.evaluate(() => __mstest.fin.rec.u), u1);
  // changed elsewhere
  const u2 = await putRec(page, id, Date.now() + 1000, '#36c');
  await backInView(page);
  await page.waitForFunction((u) => document.querySelector('#sfFin .sffinpic img').src === u, u2);
  // removed elsewhere
  await page.evaluate((id) => IDB.del('fin-' + id), id);
  await backInView(page);
  await page.waitForSelector('#sfFin [data-fin="add"]');
  assert.equal(await page.evaluate(() => __mstest.fin.rec), null);
  assert.deepEqual(errors, []);
});

test('restoring a backup: its photo comes in when newer than the one here, not when older', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  const t0 = Date.now();
  const uOld = await putRec(page, id, t0, '#c33');
  await page.evaluate(() => openLibrary());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const file = await dl.path();
  await page.keyboard.press('Escape');
  await idle(page);
  // a newer photo here: the backup's older one doesn't replace it
  const uNew = await putRec(page, id, t0 + 5000, '#36c');
  await restore(page, file);
  assert.equal((await stored(page, id)).u, uNew, 'the newer one here kept');
  // an older photo here: the backup's newer one comes in, and the open guide shows it
  const fs = await import('node:fs/promises');
  const bk = JSON.parse(await fs.readFile(file, 'utf8'));
  bk.guides.find((g) => g.id === id).fin.ts = t0 + 9000;
  await fs.writeFile(file, JSON.stringify(bk));
  await restore(page, file);
  await storedIs(page, id, uOld);
  await page.waitForFunction((u) => __mstest.fin.rec && __mstest.fin.rec.u === u, uOld, { timeout: 15000 });
  assert.deepEqual(errors, []);
});

test('the photo’s record is read as a guide opens, without decoding the picture', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const id = await finished(page);
  const u = await putRec(page, id, Date.now(), '#c33');
  // not finished any more (Reset progress keeps the photo): it opens on its plan, with no Page finished panel
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 0;
    });
    t.guideDirty = true;
    t.saveNow();
  });
  await idle(page);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.fin.read, id, { timeout: 15000 });
  assert.equal(await page.evaluate(() => __mstest.fin.rec && __mstest.fin.rec.u), u, 'read');
  assert.equal(await page.evaluate(() => __mstest.fin.decoded), false, 'not decoded');
  assert.deepEqual(errors, []);
});

test('offline, before the PDF reader was ever fetched: opening a PDF says it needs the internet once', async () => {
  const { page, ctx, errors } = await openApp({ width: 820, height: 1180 });
  await page.waitForFunction(() => window.SF && SF.pickPhoto);
  await ctx.setOffline(true);
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'latin1',
  );
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.waitForFunction(
    () =>
      /Opening a PDF needs the internet the first time/.test(document.getElementById('sfRoot').textContent),
    null,
    { timeout: 30000 },
  );
  await ctx.setOffline(false);
  assert.deepEqual(errors, []);
});
