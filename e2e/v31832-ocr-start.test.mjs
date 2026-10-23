// v318.32 D1-1 (Fable R32): Scan closed while the reader's worker is starting (files loaded, 'init' sent, 'ready' not
// yet back): ocrEnd() terminated the worker, but the ocrStart promise awaited by ocrGo never settled, so ocrGo's frame
// (and its photo's pixels, r.img.data, ~12 MB) stayed for good, each time. Now ocrEnd tells it. And decision 6.9: a
// picture pasted into the box is read by the reader when it's stored. Fails on v318.31.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

// a dark tray with one code on it (drawn here: no photo of anyone's is in the repo)
const tray = (page) =>
  page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 1536;
    cv.height = 2048;
    const g = cv.getContext('2d');
    g.fillStyle = '#2a2622';
    g.fillRect(0, 0, 1536, 2048);
    g.fillStyle = '#ddd';
    g.font = 'bold 40px Arial';
    g.fillText('B02', 100, 100);
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
  });

test('D1-1 Scan closed while the reader starts: ocrStart settles, ocrGo does not hang, Look closer is let go of', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  // (Playwright's WebKit, with any route set, fails the worker's blob: loads: the route keeping the app offline is
  // lifted, as e2e/v318-ocr does; all it loads is the app's own server)
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
  // ocrStart wrapped, to see whether its promise settles
  await page.evaluate(() => {
    const orig = ocrStart;
    window.__starts = [];
    ocrStart = function () {
      const p = orig();
      const rec = { settled: false };
      p.then(
        () => (rec.settled = 'ok'),
        (e) => (rec.settled = 'rej:' + e.message),
      );
      window.__starts.push(rec);
      return p;
    };
  });
  const jpg = await tray(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
  await fc.setFiles({ name: 'tray.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') });
  // the worker exists but hasn't said ready yet
  await page.waitForFunction(() => ocrW && !ocrW._up && window.__starts.length === 1, null, {
    timeout: 60000,
    polling: 5,
  });
  const state = await page.evaluate(() => ({ up: !!ocrW._up, sent: !!(ocrRun && ocrRun.sent) }));
  // (a closer look's state stood in for too: ocrClose lets go of it, so it's offered again on the next photo)
  await page.evaluate(() => {
    ocrCl = { stop: false, k: 0, of: 1, done: 0, all: 0, wait: null };
  });
  await page.click('#scClose');
  await idle(page);
  assert.equal(await page.evaluate(() => ocrW), null, 'worker ended');
  assert.equal(await page.evaluate(() => ocrCl), null, 'Look closer let go of');
  await page.waitForTimeout(4000);
  const rec = await page.evaluate(() => window.__starts[0]);
  console.log('state at close:', state, 'ocrStart promise:', rec);
  // (rejected 'ended' when Scan closed before the worker's 'ready'; 'ok' when the ready came first, which a fast
  // start in WebKit can: settled either way, and ocrGo let the photo go)
  assert.notEqual(rec.settled, false, 'ocrStart settled after Scan closed mid-start (v318.31: never)');
  assert.equal(await page.evaluate(() => ocrRun), null, 'no read under way');
  assert.deepEqual(errors, []);
});

test('6.9 a picture pasted into the box is read by the reader when it is stored', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
  await page.click('#ocrNo');
  await idle(page);
  const jpg = await tray(page);
  const r = await page.evaluate(async (b64) => {
    const bin = atob(b64),
      u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const f = new File([u], 'tray.jpg', { type: 'image/jpeg' }),
      dt = new DataTransfer();
    dt.items.add(f);
    const box = document.getElementById('scBox');
    box.focus();
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    box.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented };
  }, jpg);
  assert.ok(r.prevented, 'the paste taken');
  await page.waitForFunction(() => ocrRun && ocrRun.n >= 1, null, { timeout: 15000 });
  assert.ok(await page.isVisible('#ocrView'), "the reader's view, reading");
  // the read runs to its end, the photo counted
  await page.waitForFunction(() => ocrRun && ocrRun.done, null, { timeout: 180000 });
  assert.match(await page.textContent('#ocrView'), /B02|read|Done/);
  await page.click('#scClose');
  await idle(page);
  assert.deepEqual(errors, []);
});
