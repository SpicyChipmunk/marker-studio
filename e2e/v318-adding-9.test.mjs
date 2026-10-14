// v318 review (adding markers, 9): smaller fixes in Scan and the photo reader. A brand tapped with nothing to answer says
// the brand now reading; Find mode leaves another brand's code out, with no Add; Scan closed after the toast's Open
// puts the keyboard back on Add markers; a paste too long for a list is said, not read; a set's name read quietly by
// Scan Text ("Honolulu 120") is the set's card, not Ohuhu's 120 Black, unless Black's name is read with it; Photograph
// your caps with the reader stored shows the reader under the picker; a batch stopped at its first photo is said as
// one photo. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const skip = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' };
const paste = (page, text) =>
  page.evaluate((t) => {
    const d = new DataTransfer();
    d.setData('text/plain', t);
    document
      .getElementById('scBox')
      .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
  }, text);
const marks = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
// (text arriving at once, as Scan Text puts it in: read quietly once it holds still)
const quiet = async (page, t) => {
  await page.fill('#scBox', t);
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
  await idle(page);
};

test('a brand tapped with nothing to answer: the card says the brand now reading', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
  await page.evaluate(() => openScan());
  await idle(page);
  await page.click('#scBrand [data-b="Ohuhu"]');
  assert.match(await page.textContent('#scStat'), /Ohuhu codes only/);
  await page.click('#scBrand [data-b="Copic"]');
  assert.match(await page.textContent('#scStat'), /Copic codes only/);
  assert.doesNotMatch(await page.textContent('#scStat'), /Ohuhu/);
  await page.click('#scBrand [data-b=""]');
  assert.match(await page.textContent('#scStat'), /Ohuhu and Copic codes/);
  assert.deepEqual(errors, []);
});

test('Find mode: another brand’s code is said, with no Add; in a list it’s left out, said', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await page.click('#wcFBrand [data-b="Ohuhu"]');
  await page.click('#wcFCount [data-n="1"]');
  await page.click('#wcFindNext');
  await idle(page);
  await page.fill('#scBox', 'E000');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.match(await page.textContent('#scStat'), /Not an Ohuhu code: this looks for Ohuhu sets/);
  assert.equal(await page.$$eval('#scStat button', (b) => b.length), 0, 'no Add');
  await paste(page, 'R014\nBG314\nE000');
  await idle(page);
  assert.deepEqual((await marks(page)).sort(), ['Ohuhu|BG314', 'Ohuhu|R014']);
  assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 0, 'not asked about');
  assert.match(await page.textContent('#scStat'), /1 not Ohuhu, left out/);
  assert.deepEqual(errors, []);
});

test('the toast’s Open, then Scan closed: the keyboard on Add markers', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await page.fill('#scBox', 'R014');
  await page.keyboard.press('Enter');
  await page.fill('#scBox', 'Y28');
  await page.keyboard.press('Enter');
  await idle(page);
  await page.click('#scAdd');
  await idle(page);
  await page.click('#toastAct2');
  await idle(page);
  assert.ok(await page.isVisible('#scBox'), 'Scan open again');
  await page.click('#scClose');
  await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mkAddBtn');
  assert.deepEqual(errors, []);
});

test('a paste too long for a list of markers is said, not read', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
  await page.evaluate(() => openScan());
  await idle(page);
  await paste(page, 'R014 Y28 B04 shipping $12.99 '.repeat(8000));
  await idle(page);
  assert.match(await page.textContent('#scStat'), /Too much text for a list of markers/);
  assert.deepEqual(await marks(page), []);
  // a long list still is
  await paste(page, 'R014, 2 pcs, $3.49\n'.repeat(5000));
  await idle(page);
  assert.deepEqual(await marks(page), ['Ohuhu|R014']);
  assert.deepEqual(errors, []);
});

test('a set’s name read quietly: the set’s card, its size offered as a cap; with the cap’s name, that marker', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
  await page.evaluate(() => openScan());
  await idle(page);
  await quiet(page, 'HONOLULU 120');
  assert.deepEqual(await marks(page), [], 'not Black unasked');
  assert.match(await page.textContent('#scStat b'), /Honolulu 120/);
  const btns = await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent));
  assert.deepEqual(btns, ['Add all 120 to the list', 'Add 120 Black']);
  await page.click('#scStat .scpick button:text-is("Add 120 Black")');
  await idle(page);
  assert.deepEqual(await marks(page), ['Ohuhu|120']);
  // said as colours: the box, no cap offered
  await page.evaluate(() => {
    scanList = [];
    scanRender();
  });
  await quiet(page, 'OHUHU HONOLULU 48 COLORS');
  assert.deepEqual(await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent)), [
    'Add all 48 to the list',
  ]);
  // the cap with its name: Black
  await quiet(page, 'HONOLULU 120 Black');
  assert.deepEqual(await marks(page), ['Ohuhu|120']);
  assert.deepEqual(errors, []);
});

// a tray of caps, 1536×2048 (a JPEG): round caps, each a code over its name, turned any way, a little noise; n caps of
// the brand from the colour list's first of that brand at `from`
const tray = (page, brand, from, n, seed) =>
  page.evaluate(
    ([brand, from, n, seed]) => {
      const caps = COLORS.filter((c) => c.brand === brand && /^[A-Z]{1,3}\d{2,3}$/.test(c.code)).slice(
          from,
          from + n,
        ),
        W = 1536,
        H = 2048,
        cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#2a2622';
      g.fillRect(0, 0, W, H);
      let s = seed;
      const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      const R = 62,
        cols = Math.floor(W / (R * 2.2));
      caps.forEach((c, i) => {
        g.save();
        g.translate(R * 1.2 + (i % cols) * R * 2.2, R * 1.2 + Math.floor(i / cols) * R * 2.2);
        g.fillStyle = '#d9d6cf';
        g.beginPath();
        g.arc(0, 0, R + 6, 0, 7);
        g.fill();
        g.fillStyle = c.hex;
        g.beginPath();
        g.arc(0, 0, R, 0, 7);
        g.fill();
        g.rotate((r() - 0.5) * Math.PI * 2);
        g.fillStyle = '#222';
        g.textAlign = 'center';
        g.font = 'bold 26px Helvetica, Arial, sans-serif';
        g.fillText(c.code, 0, -4);
        g.font = '15px Helvetica, Arial, sans-serif';
        g.fillText(String(c.name).slice(0, 14), 0, 15);
        g.restore();
      });
      return {
        jpg: cv.toDataURL('image/jpeg', 0.92).split(',')[1],
        keys: caps.map((c) => c.brand + '|' + c.code),
      };
    },
    [brand, from, n, seed],
  );

test('Photograph your caps, the reader stored: its view under the picker; a batch stopped at its first photo, said as one', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: skip });
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await page.evaluate(() => openScan());
  await idle(page);
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
  await page.click('#ocrNo');
  await page.click('#scClose');
  await idle(page);
  // (from Markers' Add markers' Photograph your caps: the picker, and the reader's view under it)
  await page.click('#mCollection');
  await idle(page);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate(() => openScan({ photo: true })),
  ]);
  assert.ok(await page.isVisible('#ocrPick'), 'Take or choose photos, under the picker');
  assert.equal(await page.isVisible('#scBox'), false);
  // three photos, Stop at once
  const t = await tray(page, 'Ohuhu', 20, 12, 5);
  const f = (n) => ({ name: n, mimeType: 'image/jpeg', buffer: Buffer.from(t.jpg, 'base64') });
  await fc.setFiles([f('a.jpg'), f('b.jpg'), f('c.jpg')]);
  await page.click('#ocrStop');
  await page.waitForSelector('#ocrDone', { timeout: 120000 });
  const say = await page.textContent('#ocrSay');
  assert.match(say, /stopped · the other 2 photos not read$/);
  assert.doesNotMatch(await page.textContent('#ocrSum'), /The last photo is shown/);
  assert.deepEqual(errors, []);
});
