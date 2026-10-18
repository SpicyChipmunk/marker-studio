// v318.14: a photo's sections are found with a paint between the steps (segRun), so the page isn't held for a second
// or more at a time. The sections are exactly those found in one go (segment()); a newer change takes over from an
// older one before it puts anything in place; while the steps run, the picture and its controls can't be used, and
// Undo and Build wait.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

// a 1800 x 2400 photo of a page filling it: rings, a hatched corner and some grain, as a JPEG
async function photo(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 2400;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 1800, 2400);
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 6;
    for (let y = 200; y < 2400; y += 300)
      for (let x = 200; x < 1800; x += 300) {
        g.beginPath();
        g.arc(x, y, 120, 0, 6.283);
        g.stroke();
        g.beginPath();
        g.arc(x + 40, y, 50, 0, 6.283);
        g.stroke();
      }
    g.lineWidth = 2;
    for (let i = 0; i < 400; i += 9) {
      g.beginPath();
      g.moveTo(1300 + i, 1900);
      g.lineTo(1300, 1900 + i);
      g.stroke();
    }
    const im = g.getImageData(0, 0, 1800, 2400),
      d = im.data;
    let s = 7;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const n = ((s / 2147483647) - 0.5) * 18;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(im, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}
async function choose(page) {
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles(await photo(page));
  const first = await Promise.race([
    page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }).then(() => 'build'),
    page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 60000 }).then(() => 'corners'),
  ]);
  if (first === 'corners') {
    await page.click('#sfPgNo');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  }
  await idle(page);
}
// the sections as they are, and as segment() finds them in one go on the same picture
const sigs = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      one = () => ({
        sig: t.labelsSig(),
        n: t.comps.length,
        bg: t.comps.filter((c) => c && c.bg).length,
        warn: t.segWarn.ok ? '' : t.segWarn.code,
        faint: t.faintOffer,
      });
    const a = one();
    t.segment();
    return { steps: a, once: one() };
  });

test('a photo found in steps: the same sections as in one go, and again after a Sensitivity change', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await choose(page);
  const r = await sigs(page);
  assert.ok(r.steps.n > 40, 'sections: ' + r.steps.n);
  assert.deepEqual(r.steps, r.once);
  // Sensitivity changed: found again in steps, the same as in one go at that setting
  await page.evaluate(() => {
    __mstest.adaptC = 11;
    __mstest.resegment();
  });
  assert.equal(await page.evaluate(() => __mstest.segBusy), true, 'in steps');
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
  const r2 = await sigs(page);
  assert.deepEqual(r2.steps, r2.once);
  assert.notEqual(r2.steps.sig, r.steps.sig, 'a different setting, different sections');
  assert.deepEqual(errors, []);
});

test('a newer Sensitivity takes over from an older one; while they run, Undo, Build and the picture wait', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await choose(page);
  const r0 = await page.evaluate(() => ({ sig: __mstest.labelsSig(), undo: __mstest.undoCount }));
  const during = await page.evaluate(() => {
    const t = __mstest;
    t.adaptC = 4;
    t.resegment();
    // (another change straight after: the first is dropped before it puts anything in place)
    t.adaptC = 12;
    t.resegment();
    return {
      busy: t.segBusy,
      sig: t.labelsSig(),
      inert: document.getElementById('sfView').inert,
      // (the controls stay usable: the Sensitivity slider keeps going, each change taking over)
      ctl: document.getElementById('sfCtl').inert,
    };
  });
  assert.equal(during.busy, true);
  assert.equal(during.sig, r0.sig, 'the open sections as they were until the end');
  assert.equal(during.inert, true, 'the picture can’t be used meanwhile');
  assert.equal(during.ctl, false, 'its controls can');
  // Build and Undo wait
  await page.evaluate(() => {
    __mstest.buildGuide();
    __mstest.doUndoSeg();
  });
  assert.equal(await page.evaluate(() => !!__mstest.assignData), false, 'not built meanwhile');
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
  const r = await sigs(page);
  assert.deepEqual(r.steps, r.once);
  assert.equal(await page.evaluate(() => __mstest.adaptC), 12);
  assert.equal(
    await page.evaluate(() => document.getElementById('sfView').inert || document.getElementById('sfCtl').inert),
    false,
  );
  // one Undo goes back to the sections before both changes
  await page.evaluate(() => __mstest.doUndoSeg());
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.labelsSig()), r0.sig);
  assert.deepEqual(errors, []);
});

test('another photo while one is being found: only the newer one’s sections are put in place', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await choose(page);
  const s1 = await page.evaluate(() => __mstest.labelsSig());
  // the first photo turned, found again in steps; the sample opened meanwhile takes over
  await page.evaluate(() => {
    __mstest.processSrcAsync();
    SF.loadSample();
  });
  await page.waitForFunction(() => __mstest.curName !== undefined && __mstest.W === 568, null, { timeout: 30000 });
  await idle(page);
  const s = await page.evaluate(() => ({ W: __mstest.W, H: __mstest.H, busy: __mstest.segBusy, n: __mstest.comps.length }));
  assert.deepEqual([s.W, s.H, s.busy], [568, 1500, false]);
  assert.notEqual(await page.evaluate(() => __mstest.labelsSig()), s1);
  assert.deepEqual(errors, []);
});
