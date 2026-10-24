// Markers › Scan or type codes: typed, pasted and Scan Text.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addFromMarkers,
  answerAsks,
  haveSet,
  idle,
  openApp,
  openAtScale,
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

before(setup);
after(teardown);

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  // Scan's reader decoded a photo whole before shrinking it to the 2048 px it reads (a 24 MP photo about 98 MB, 48 MP
  // about 190 MB). Where the browser can, it's now decoded straight to that size, turned upright from its camera data as
  // before; the pixels read are the same but for rounding.
  test('the reader decodes a big photo straight to the size it reads, upright, with the same pixels', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
    const r = await page.evaluate(async () => {
      // a 6000 × 4000 photo with a green corner, stored on its side (EXIF orientation 6: turned a quarter clockwise)
      const c = document.createElement('canvas');
      c.width = 6000;
      c.height = 4000;
      const g = c.getContext('2d'),
        gr = g.createLinearGradient(0, 0, 6000, 4000);
      gr.addColorStop(0, '#c33');
      gr.addColorStop(1, '#33c');
      g.fillStyle = gr;
      g.fillRect(0, 0, 6000, 4000);
      g.fillStyle = '#fff';
      g.font = 'bold 300px sans-serif';
      g.fillText('B111 R14 Y15', 400, 2000);
      g.fillStyle = '#0f0';
      g.fillRect(0, 0, 600, 600);
      const jb = new Uint8Array(
        await (await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))).arrayBuffer(),
      );
      c.width = c.height = 1;
      const ex = [
          0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 1, 0x12, 0,
          3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0,
        ],
        o = new Uint8Array(jb.length + ex.length);
      o.set(jb.subarray(0, 2));
      o.set(ex, 2);
      o.set(jb.subarray(2), 2 + ex.length);
      const file = new File([o], 'caps.jpg', { type: 'image/jpeg' }),
        asked = [],
        cib = window.createImageBitmap;
      window.createImageBitmap = function (src, opt) {
        if (src === file) asked.push(opt ? [opt.resizeWidth, opt.resizeHeight] : null);
        return cib.apply(this, arguments);
      };
      const a = await ocrPhoto(file);
      window.createImageBitmap = cib;
      // the same photo decoded whole, as before
      const img = new Image(),
        u = URL.createObjectURL(file);
      img.src = u;
      await img.decode();
      const k = document.createElement('canvas');
      k.width = a.w;
      k.height = a.h;
      const kx = k.getContext('2d');
      kx.drawImage(img, 0, 0, a.w, a.h);
      URL.revokeObjectURL(u);
      const b = kx.getImageData(0, 0, a.w, a.h).data;
      let sum = 0;
      for (let i = 0; i < b.length; i++) sum += Math.abs(a.data.data[i] - b[i]);
      const px = (x, y) => Array.from(a.data.data.slice((y * a.w + x) * 4, (y * a.w + x) * 4 + 3));
      return {
        size: [a.w, a.h],
        asked,
        whole: ocrBmpWhole(),
        diff: sum / b.length,
        topRight: px(a.w - 20, 20),
        topLeft: px(20, 20),
      };
    });
    assert.deepEqual(r.size, [1365, 2048], 'upright: taller than wide, 2048 px tall');
    // (v318.22: Chrome decodes it whole into a bitmap of its own and shrinks it on a canvas: its resize kept every
    // photo's full-size decode in its image cache)
    assert.deepEqual(
      r.asked,
      r.whole ? [null] : [[1365, 2048]],
      'decoded at the size it reads, or whole in Chrome',
    );
    assert.ok(
      r.topRight[1] > 200 && r.topRight[0] < 60,
      'the green corner at the top right, as taken: ' + r.topRight,
    );
    assert.ok(r.topLeft[1] < 100, 'not at the top left: ' + r.topLeft);
    assert.ok(r.diff < 0.5, 'the same pixels but for rounding: ' + r.diff);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-scan.test.mjs ----
// v318: Scan reads a set's name in what's pasted (its box, an order email) and offers its markers, asked first; Find my
// set goes straight to the set named; Open a list file reads a .csv or .txt as a paste. Its line says so, Find mode's
// its own. Fails on v317.
{
  const paste = (page, text) =>
    page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, text);
  const marks = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  const setKeysOf = (page, n) => page.evaluate((n) => presetMkeys(MARKER_SETS.find((p) => p.n === n)), n);
  const shown = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  test('a box’s text pasted: the set named, asked first; its markers into the list with a tap, then added', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    assert.match(
      await page.textContent('#scLensT'),
      /the set’s box or an order email.*A set’s name adds the whole set/,
    );
    assert.ok(await page.isVisible('#scFile'), 'Open a list file');
    await paste(page, 'OHUHU\nHONOLULU\nALCOHOL MARKERS\nDual Tips\n120\nCOLORS\nFor artists and beginners');
    await idle(page);
    // (nothing in the list unasked, nor its size read as a code: Ohuhu 120 is Black)
    assert.deepEqual(await marks(page), [], 'nothing in the list unasked');
    assert.match(
      await page.textContent('#scStat'),
      /^\?Found a set: Ohuhu Honolulu 120Add all 120 of its markers to the list\?(?!.*codes)/,
    );
    assert.equal(await page.textContent('#scStat .scpick button'), 'Add all 120 to the list');
    await page.click('#scStat .scpick button');
    await idle(page);
    const want = await setKeysOf(page, 'Honolulu 120');
    assert.deepEqual((await marks(page)).sort(), want.slice().sort());
    assert.match(
      await page.textContent('#scStat'),
      // (v318.28: its colours, the blender said apart, as "Add all 120" counted them)
      /^.*120 and a Colorless Blender added to the list.*Honolulu 120/,
    );
    // (a box's other words aren't "lines not read" on Add's toast; v318.29: from the welcome there's a toast only when
    // there's more to say than what was added, Undo being the link on "Anything else?", so none at all here)
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.isVisible('#msToast.on'), false, 'no toast: nothing not read');
    assert.equal(await page.isVisible('#wcUndoBtn'), true);
    assert.equal(await page.evaluate(() => state.owned.size), want.length);
    // the welcome: Some are missing, as after a set ticked
    assert.equal(await page.textContent('#wcT2'), '120 markers added');
    assert.ok(await shown(page, 'wcMoreMiss'));
    assert.deepEqual(errors, []);
  });
  test('an order email with two sets, one without its letter: a button each; adding one keeps the other’s', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-scan-brand': '' } });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await paste(
      page,
      'Your order #112-4824839-1234567\nOhuhu Honolulu Markers, 72 Colors\nQty: 1  $48.99\nCopic Ciao Markers 36 Colors\n$120.00',
    );
    await idle(page);
    assert.match(await page.textContent('#scStat b'), /^Found 2 sets$/);
    const btns = await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent));
    // (the Ciao 36's letter not read: its sets under a heading, by their letters)
    assert.deepEqual(btns, ['Add Honolulu 72', 'Set A', 'Set B', 'Set C', 'Set D', 'Set E']);
    assert.equal(await page.textContent('#scStat .scphead'), 'Ciao 36: which one?');
    await page.click('#scStat .scpick button:text-is("Set C")');
    await idle(page);
    const c = await setKeysOf(page, 'Ciao 36 - Set C');
    assert.deepEqual((await marks(page)).sort(), c.slice().sort());
    // the Honolulu 72's button still there; the 120 (Honolulu 120's, the collection) already yours
    assert.deepEqual(await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent)), [
      'Add Honolulu 72',
    ]);
    await page.click('#scStat .scpick button');
    await idle(page);
    assert.match(await page.textContent('#scStat'), /already yours/);
    assert.deepEqual(errors, []);
  });
  test('Find my set: its line; a name pasted goes straight to Is this your set?, a letter not read shows the others', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await page.click('#wcFBrand [data-b="Copic"]');
    await page.click('#wcFCount [data-n="1"]');
    await page.click('#wcFindNext');
    await idle(page);
    assert.equal(
      await page.textContent('#scLensT'),
      'Got the box or an order email? Paste its text: the set’s name finds it.',
    );
    assert.equal(await page.isVisible('#scFile'), false, 'no list file here');
    // (an Ohuhu set named: not the brand chosen, nothing found by name)
    await paste(page, 'Ohuhu Honolulu 120 Colors');
    await idle(page);
    assert.ok(await page.isVisible('#scanOverlay'), 'still scanning');
    await paste(page, 'Copic Ciao 36 Colors');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
      false,
    );
    assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
    assert.match(
      await page.textContent('#wcRes'),
      /^Named in what you pastedCopic Ciao 36 - Set A36 markers/,
    );
    assert.doesNotMatch(await page.textContent('#wcRes'), /cap/, 'no caps scanned: nothing said of them');
    assert.equal(await page.textContent('#wcFindOther'), 'No: show Ciao 36 - Set B');
    await page.click('#wcFindOther');
    assert.match(await page.textContent('#wcRes'), /Copic Ciao 36 - Set B/);
    // again, with a cap read along with the name: only the sets that have it (E00: Set A)
    await page.click('#wcStepRes .wcback');
    await idle(page);
    await page.click('#wcFindNext');
    await idle(page);
    await paste(page, 'COPIC\nciao\n36 colors\nE00');
    await idle(page);
    assert.match(await page.textContent('#wcRes'), /Copic Ciao 36 - Set A.*Has the cap you scanned: E00/);
    assert.equal(await page.isVisible('#wcFindOther'), false);
    await page.click('#wcFindYes');
    await idle(page);
    const a = await setKeysOf(page, 'Ciao 36 - Set A');
    assert.equal(await page.evaluate(() => state.owned.size), a.length);
    assert.ok(await shown(page, 'wcMoreMiss'));
    assert.deepEqual(errors, []);
  });
  test('Open a list file: a CSV read as a pasted list; its 44px tap area clear of the brands below', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-scan-brand': '' } });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const a = document.getElementById('scFile'),
        t = getComputedStyle(a, '::after'),
        b = a.getBoundingClientRect(),
        seg = document.getElementById('scBrand').getBoundingClientRect();
      return { h: parseFloat(t.height), bottom: b.top + b.height / 2 + 22, seg: seg.top };
    });
    assert.equal(r.h, 44);
    // (touching at most: the brands, drawn over it, keep their own taps)
    assert.ok(r.bottom <= r.seg + 2, 'clear of the brands: ' + JSON.stringify(r));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#scFile')]);
    await chooser.setFiles({
      name: 'my markers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('﻿Brand,Code\nOhuhu,BG314\nCopic,E00\nCopic,YG06\n'),
    });
    await page.waitForFunction(() => scanList.length === 3);
    assert.deepEqual((await marks(page)).sort(), ['Copic|E00', 'Copic|YG06', 'Ohuhu|BG314']);
    assert.match(await page.textContent('#scStat'), /3 added to the list/);
    assert.deepEqual(errors, []);
  });
  test('Find my set with a set’s name typed in the box (no Enter) and markers on the list kept for Add: no error', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // a marker on Scan's own list first (kept aside while Find mode runs)
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    await page.fill('#scBox', 'R014');
    await page.keyboard.press('Enter');
    await idle(page);
    await page.click('#scClose');
    await page.click('#wcStepOne .wcback');
    await page.click('#wcNotSure');
    await page.click('#wcFBrand [data-b="Copic"]');
    await page.click('#wcFCount [data-n="1"]');
    await page.click('#wcFindNext');
    await idle(page);
    // (typed a letter at a time: text that arrives at once is Scan Text's, read quietly once it holds still)
    await page.click('#scBox');
    await page.keyboard.type('Copic Ciao 36 Set A');
    // (Find my set reads the box first: the name hands the caps on and closes Scan; it had then gone on with the list
    // kept for Add and a Find that was over: "Cannot read properties of null (reading 'done')")
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
    assert.match(await page.textContent('#wcRes'), /^Named in what you pastedCopic Ciao 36 - Set A/);
    assert.equal(
      await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
      false,
    );
    // (the list kept for Add is back, as it was)
    assert.deepEqual(await marks(page), ['Ohuhu|R014']);
    assert.deepEqual(errors, []);
  });
  test('a question’s answer that is a marker by its old code says so: "Which R14?" offers RV18, was R14', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' },
    });
    await scanFromMarkers(page);
    await page.fill('#scBox', 'R14');
    await page.keyboard.press('Enter');
    await idle(page);
    const choices = await page.$$eval('#scList .scask .scchoose', (bs) => bs.map((b) => b.textContent));
    assert.ok(
      // (v318.21: as its older cap says it, R14 Pale Purple, the code it has now beside)
      choices.some((c) => /^R14 Pale Purple · Ohuhu · now RV18$/.test(c)),
      choices.join(' / '),
    );
    assert.ok(
      choices.some((c) => /^R14 Sheer Peach · Ohuhu$/.test(c)),
      choices.join(' / '),
    );
    // (v318 audit) an old code stored with the Roman numeral Ⅱ is said with plain letters, as everywhere else: BGII03
    const roman = await page.evaluate(() => {
      const i = COLORS.findIndex((c) => c.old === 'BGⅡ03');
      scanList.unshift({ ask: 'test', title: 'Which one?', opts: [{ i: i, how: 'old' }] });
      scanRender();
      return document.querySelector('#scList .scask .scchoose').textContent;
    });
    assert.match(roman, /^BGII03 .+ · now B310$/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x1.test.mjs ----
// v318.25: fixes from the fifth deep debugging pass, in the browser. Fail on v318.24.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    ...extra,
  });
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      saved: [],
      ...extra,
    });
  const scanStored = onboarded({ [KEY]: appState({ owned: ['Ohuhu|R014'] }) });
  test('X1 the pictures of more than 60 questions waiting all come back after a reload', async () => {
    const { page, errors } = await openApp({ width: 1024, height: 768, storage: scanStored });
    await idle(page);
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 40;
      const x = c.getContext('2d');
      const oh = COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Ohuhu');
      scanList = [];
      for (let k = 0; k < 75; k++) {
        x.fillStyle = 'hsl(' + k * 4 + ',70%,50%)';
        x.fillRect(0, 0, 40, 40);
        scanList.push({
          ask: 'fix Q' + k,
          title: 'Q' + k + '?',
          opts: [
            { i: oh[k * 2], how: 'chosen' },
            { i: oh[k * 2 + 1], how: 'chosen' },
          ],
          crop: c.toDataURL('image/jpeg'),
          photo: 1 + Math.floor(k / 5),
        });
      }
      scanSaveList();
    });
    await page.waitForFunction(() => scanPics.written().length === 75, null, { timeout: 5000 });
    for (let n = 0; n < 2; n++) {
      await page.reload();
      await idle(page);
      await page.waitForFunction(() => scanPics.loads > 0 && scanPics.written().length > 0, null, {
        timeout: 5000,
      });
      await pause(page, 300, 'the pictures put back');
      assert.deepEqual(
        await page.evaluate(() => ({
          asks: scanList.filter((e) => e.ask).length,
          withPic: scanList.filter((e) => e.ask && e.crop).length,
        })),
        { asks: 75, withPic: 75 },
        'reload ' + (n + 1),
      );
    }
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X1 Add with another brand’s code left in the box: Scan stays open when that turns both brands on', async () => {
    const { page, errors } = await openApp({ width: 1024, height: 768, storage: scanStored });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    for (const t of ['Ohuhu 0', 'R014', 'R210', 'Y27', 'B000']) {
      await page.fill('#scBox', t);
      await page.press('#scBox', 'Enter');
    }
    assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 1, 'B000 asked about');
    // (typed a key at a time, as a person types it: text arriving at once is Scan Text's, read when it holds still)
    await page.type('#scBox', 'E000');
    await pause(page, 800, 'longer than Scan Text’s hold');
    assert.equal(await page.inputValue('#scBox'), 'E000', 'still in the box, not read');
    await page.click('#scAdd');
    await idle(page);
    const r = await page.evaluate(() => ({
      open: document.getElementById('scanOverlay').classList.contains('on'),
      sw: scanSw.on,
      owned: [...state.owned].sort(),
    }));
    assert.equal(r.open, true, 'Scan left open on the changed list');
    assert.equal(r.sw, true);
    assert.deepEqual(r.owned, ['Ohuhu|R014'], 'nothing added yet');
    // (the list seen, Add again adds them: not stuck)
    await page.click('#scAdd');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('scanOverlay').classList.contains('on')),
      false,
    );
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), [
      'Copic|B000',
      'Copic|E000',
      'Ohuhu|0',
      'Ohuhu|R014',
      'Ohuhu|R210',
      'Ohuhu|Y27',
    ]);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X1 a photo’s canvases are emptied when its view goes (Done, Back, closing Scan: ocrHide)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: scanStored });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    const r = await page.evaluate(() => {
      ocrShow('<div class="ocrpic" id="ocrPic"></div><div class="ocrrow" id="ocrBtns"></div>');
      const a = document.createElement('canvas'),
        b = document.createElement('canvas');
      a.width = b.width = 675;
      a.height = b.height = 900;
      document.getElementById('ocrPic').append(a, b);
      ocrHide();
      return [a.width, a.height, b.width, b.height];
    });
    assert.deepEqual(r, [0, 0, 0, 0]);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  // ---- A2: a batch's photos not read ----
  test('A2 Done after a batch: the photos not read said; all of them, said as that; Undo counts only the photos read', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.evaluate(() => openScan());
    await idle(page);
    const r = await page.evaluate(() => {
      const f = new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' }),
        out = {};
      // three photos, the second not read (the first and third added 2 and 1)
      const per = () => [
        { added: 2, asked: 0 },
        { added: 0, asked: 0, failed: true },
        { added: 1, asked: 0 },
      ];
      ocrQ = { files: [f, f, f], k: 3, n0: 1, per: per(), stop: false, t0: 0 };
      ocrRun = { n: 3, done: true, added: 1, asked: 0, note: '' };
      if (!document.getElementById('ocrBtns')) {
        const b = document.createElement('div');
        b.id = 'ocrBtns';
        document.body.appendChild(b);
      }
      ocrButtons(ocrRun);
      out.undo = document.getElementById('ocrUndo').textContent;
      ocrFinish();
      out.done = document.getElementById('scStat').textContent;
      // every photo not read
      ocrQ = {
        files: [f, f, f],
        k: 3,
        n0: 1,
        per: per().map(() => ({ added: 0, asked: 0, failed: true })),
        stop: false,
        t0: 0,
      };
      ocrRun = { n: 3, done: true, failed: true, added: 0, asked: 0, note: 'This photo couldn’t be opened.' };
      ocrFinish();
      out.none = document.getElementById('scStat').textContent;
      out.noneKind = document.getElementById('scStat').className;
      return out;
    });
    assert.equal(r.undo, 'Undo these 2 photos');
    assert.match(r.done, /From 3 photos: 3 added to the list1 not read/);
    assert.match(r.none, /None of the 3 photos could be readThis photo couldn’t be opened\./);
    assert.match(r.noneKind, /\bnone\b/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31832-fixes.test.mjs ----
// v318.32 bug fixes (Fable R32: U1-1, D3-1, D1-3, decisions 6.9 and 6.10). Each fails on v318.31.
{
  // D1-3: the page left while a photo is read: the busy mark cleared (left, the next photo was read gently for a
  // fortnight, with a note blaming the device). A read under way is stood in for: the mark set as ocrGo sets it
  test('D1-3 pagehide during a read clears the busy mark; a page put in the cache keeps it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const r = await page.evaluate(() => {
      const out = {};
      localStorage.setItem('ms-ocr-busy', '1');
      // (nothing being read: the mark isn't this page's to clear)
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      out.idle = localStorage.getItem('ms-ocr-busy');
      ocrRun = { n: 1, done: false };
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      out.persisted = localStorage.getItem('ms-ocr-busy');
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      out.left = localStorage.getItem('ms-ocr-busy');
      ocrRun = null;
      return out;
    });
    assert.deepEqual(r, { idle: '1', persisted: '1', left: null });
    assert.deepEqual(errors, []);
  });
  // 6.9: a picture pasted into Scan's box (an iPad's Photos, Copy): said, with where to go, when the reader isn't stored
  // (it had done nothing). Read by the reader when it is: e2e/v31832-ocr-start.test.mjs
  test('6.9 a picture pasted into the box, the reader not stored: "Paste text, or use Photograph your caps"', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    const r = await page.evaluate(async () => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png')),
        f = new File([blob], 'cap.png', { type: 'image/png' }),
        dt = new DataTransfer();
      dt.items.add(f);
      const box = document.getElementById('scBox');
      box.focus();
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      await new Promise((res) => setTimeout(res, 400));
      return {
        prevented: ev.defaultPrevented,
        files: dt.files.length,
        stat: document.getElementById('scStat').textContent.replace(/\s+/g, ' ').trim(),
        reading: !!(ocrRun && !ocrRun.done),
      };
    });
    assert.equal(r.files, 1, 'the paste carried the picture');
    assert.match(r.stat, /Paste text, or use Photograph your caps/);
    assert.equal(r.reading, false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-again.test.mjs ----
// v318.7: a tray photographed again, to see that nothing was missed, says what it read that's in the list already and
// draws those caps as read, not as to check; a cap read unsure stays to check (amber) even when its code is listed.
// The reader's lines are made up here, as v3184-flow's; the boxes' colours are read off the canvas. Fails on v318.6.
{
  const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
  // (and two codes both brands have, settled as Ohuhu's at the photo's end once its caps plainly show the brand)
  const middle = NOW.concat(['B04', 'Y06']).map((t, k) => [t, [200 + k * 200, 760, 110, 44, 0]]);
  // a photo W×H read: lines [text, box, unsure]; the list's markers, the photo's tally, what it found listed, and the
  // boxes' colours as drawn
  function photo(page, { lines, n = 1, pre = null }) {
    return page.evaluate(
      ([lines, n, pre]) => {
        const W = 2048,
          H = 1536,
          cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#ccc';
        g.fillRect(0, 0, W, H);
        if (n === 1) {
          scanList = [];
          ocrAnswered = [];
        }
        if (pre) pre.forEach((k) => scanList.push({ i: keyIdx(k), how: '' }));
        scanBrand = '';
        const r = {
          n,
          items: new Map(),
          taken: new Set(),
          brands: {},
          sure: 0,
          p: null,
          done: false,
          note: '',
        };
        r.img = { w: W, h: H, data: g.getImageData(0, 0, W, H) };
        ocrRun = r;
        const all = lines.map(([t, box, unsure], k) => ({
          id: k + 1,
          look: 1,
          text: t,
          conf: unsure ? 0.6 : 0.98,
          unsure: !!unsure,
          nameOf: 0,
          box,
          alts: [[t, 0.98, 0]],
        }));
        all.forEach((it) => ocrLine(r, it));
        ocrDone(r, { lines: all, stat: {}, ms: 1, aborted: false });
        clearTimeout(r.soon);
        // (drawn as the view draws it: a 600 px wide picture)
        const show = document.createElement('canvas');
        show.width = 600;
        show.height = 450;
        r.img.show = show;
        r.cv = document.createElement('canvas');
        ocrDraw(r);
        const x = r.cv.getContext('2d'),
          colour = (cx, cy) => {
            // (the box's left edge, where its stroke is)
            const k = 600 / W,
              d = x.getImageData(Math.round((cx - 55) * k), Math.round(cy * k), 1, 1).data;
            return d[3] === 0
              ? 'none'
              : d[1] > 180 && d[0] < 120
                ? 'green'
                : d[0] > 200 && d[2] < 120
                  ? 'amber'
                  : 'other';
          };
        return {
          list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),
          asks: scanList.filter((e) => e.ask).map((e) => e.title),
          added: r.added,
          same: r.same,
          listed: [...(r.listed || [])].map((i) => mkey(i)).sort(),
          boxes: lines.map(([t, box]) => colour(box[0], box[1])),
        };
      },
      [lines, n, pre],
    );
  }
  test('a tray photographed again: its caps are said to be in the list already, and drawn as read', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.evaluate(() => openScan());
    await idle(page);
    const a = await photo(page, { lines: middle });
    assert.equal(a.list.length, 10);
    assert.deepEqual([a.added, a.same], [10, 0]);
    assert.ok(
      a.boxes.every((c) => c === 'green'),
      a.boxes.join(' '),
    );
    const b = await photo(page, { lines: middle, n: 2 });
    assert.equal(b.list.length, 10, 'listed once');
    // (B04 and Y06, settled at the end, had been amber, to check, with no question in the list)
    assert.ok(
      b.boxes.every((c) => c === 'green'),
      'read already, not to check: ' + b.boxes.join(' '),
    );
    assert.deepEqual([b.added, b.same], [0, 10]);
    assert.equal(b.listed.length, 10);
    await page.evaluate(() => ocrFinish());
    await idle(page);
    assert.match(await page.textContent('#scStat'), /From the photo: nothing new10 already in the list/);
    assert.deepEqual(errors, []);
  });
  test('a cap read unsure whose code is in the list stays to check, amber and not counted; a sure cap listed from a sweep is read', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.evaluate(() => openScan());
    await idle(page);
    // the list from a sweep: the whole tray and B05 (a B06 cap, read unsure as "B05", is not that B05)
    const pre = NOW.concat(['B04', 'Y06', 'B05']).map((c) => 'Ohuhu|' + c);
    const lines = middle.concat([['B05', [400, 1100, 110, 44, 0], true]]);
    const a = await photo(page, { lines, pre });
    assert.equal(a.list.length, 11, a.list.join(' '));
    assert.deepEqual([a.added, a.same], [0, 10]);
    assert.ok(!a.listed.includes('Ohuhu|B05'), a.listed.join(' '));
    assert.deepEqual(
      a.boxes.slice(0, 10).filter((c) => c !== 'green'),
      [],
      a.boxes.join(' '),
    );
    assert.equal(a.boxes[10], 'amber', 'the unsure B05: ' + a.boxes.join(' '));
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-answer.test.mjs ----
// v318.7 Scan, sections 4 and 5, in the browser: after a question's answered the keyboard's place follows the keyboard
// (the box again only when it had the keyboard as the tap began; else the next question's first answer, then Add, then
// the count), the answer takes the question's place, and each chip is described by its question; the larger view of a
// cap answers the question with its chips or Not this cap, closes only by the picture, outside, Not now, Escape or
// Back, and ignores the tail of the tap that opened it. Each test fails on v318.6.
{
  // an app with the Honolulu 120 set, Either brand chosen, Scan open
  async function opened(opts = {}) {
    const a = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' }, ...opts });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  const rows = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) =>
        r.querySelector('.sccode')
          ? r.querySelector('.sccode').textContent
          : r.querySelector('b').textContent.replace(/: .*$/, '?'),
      ),
    );
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return (
        a.id ||
        a.className + (a.dataset.n != null ? '#' + a.dataset.n : '') + ':' + a.textContent.trim().slice(0, 30)
      );
    });
  const blur = (page) => page.evaluate(() => document.activeElement.blur());
  // a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: eight Ohuhu codes and "808" (asked
  // about, with its cap's picture), plus more lines when given. keep: the list as it is (another photo after the first),
  // and the reader's view with its buttons, as a real photo leaves it
  function read(page, more, keep) {
    return page.evaluate(
      ([more, keep]) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 400;
        const g = cv.getContext('2d');
        g.fillStyle = '#888';
        g.fillRect(0, 0, 400, 400);
        const data = g.getImageData(0, 0, 400, 400);
        if (!keep) {
          scanList = [];
          ocrAnswered = [];
          ocrPhotos = 0;
        }
        scanBrand = '';
        const r = {
          n: ++ocrPhotos,
          items: new Map(),
          taken: new Set(),
          brands: {},
          sure: 0,
          p: null,
          done: false,
          note: '',
        };
        r.img = { w: 400, h: 400, data: data };
        ocrRun = r;
        if (keep)
          ocrShow(
            '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
              '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
          );
        const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115']
          .concat(more || [])
          .map((t, k) => ({
            id: k + 1,
            look: 1,
            text: t,
            conf: 0.98,
            unsure: false,
            nameOf: 0,
            box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
          }));
        lines.push({
          id: 20,
          look: 1,
          text: '808',
          conf: 0.97,
          unsure: false,
          nameOf: 0,
          box: [200, 200, 100, 40, 0],
          turn: 0,
        });
        lines.forEach((it) => ocrLine(r, it));
        ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
        clearTimeout(r.soon);
        if (!keep) ocrRun = null;
        scanRender();
        return scanList.map((e) => (e.ask ? e.title : COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
      },
      [more || null, !!keep],
    );
  }
  const zoomOpen = async (page) => {
    await page.click('#scList .sccropped .sccrop');
    await page.waitForSelector('.sczoom.on');
    await page.waitForTimeout(350);
  };
  test('after an answer: back in the box when it had the keyboard as the tap began; else the next question’s first answer, nearest below then above; then Add; then the count', async () => {
    const { page, errors } = await opened();
    // three codes both brands use, asked: newest first
    for (const c of ['B04', 'B05', 'YR07']) await type(page, c);
    assert.deepEqual(await rows(page), ['YR07?', 'B05?', 'B04?']);
    // the box has the keyboard (typing): answer B05 → back in the box, as v303 did for a sweep
    assert.equal(await active(page), 'scBox');
    await page.click('#scList .scask[data-n="1"] .scchoose:has-text("Copic")');
    await idle(page);
    assert.equal(await active(page), 'scBox', 'the box had the keyboard');
    // (v318.7) and the answer in the question's place, not at the top
    assert.deepEqual(await rows(page), ['YR07?', 'B05', 'B04?']);
    // the keyboard down (nothing focused, as on an iPad after a photo): answer B04 (last) → nearest below: none; above: YR07
    await blur(page);
    await page.click('#scList .scask[data-n="2"] .scchoose:has-text("Ohuhu")');
    await idle(page);
    assert.match(await active(page), /^scchoose#0:YR07 /, 'the question above');
    assert.deepEqual(await rows(page), ['YR07?', 'B05', 'B04']);
    // Enter on that chip (no pointerdown: the box hadn't the keyboard): no question left → Add, which has 3 to add
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(await rows(page), ['YR07', 'B05', 'B04']);
    assert.equal(await active(page), 'scAdd');
    // a question whose answer is already yours, nothing else new: Add is off → the count over the list
    await page.evaluate(() => {
      scanList = [];
      scanRender();
    });
    await type(page, 'YG06');
    await blur(page);
    await page.click('#scList .scask .scchoose:has-text("Ohuhu")');
    await idle(page);
    assert.equal(await page.isDisabled('#scAdd'), true);
    assert.equal(await active(page), 'scCount');
    assert.match((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), /^1 marker/);
    assert.deepEqual(errors, []);
  });
  test('a question answered from the middle: the nearest question below it next; × on a question or a marker row follows the keyboard too', async () => {
    const { page, errors } = await opened();
    for (const c of ['B04', 'B05', 'YR07', 'R014']) await type(page, c);
    assert.deepEqual(await rows(page), ['R014', 'YR07?', 'B05?', 'B04?']);
    await blur(page);
    await page.click('#scList .scask[data-n="1"] .scchoose:has-text("Copic")');
    await idle(page);
    assert.match(await active(page), /^scchoose#2:B05 /, 'the question below');
    // × on a question with the keyboard down: the next question (below it: B04)
    await blur(page);
    await page.click('#scList .scask[data-n="2"] .scdel');
    await idle(page);
    assert.deepEqual(await rows(page), ['R014', 'YR07', 'B04?']);
    assert.match(await active(page), /^scchoose#2:B04 /);
    // × on a marker row with the keyboard down: the row that takes its place, its ×
    await blur(page);
    await page.click('#scList .scrow[data-n="0"] .scdel');
    await idle(page);
    assert.deepEqual(await rows(page), ['YR07', 'B04?']);
    assert.equal(await active(page), 'scdel#0:');
    // × on the last question: none left, so Add (on: Copic YR07 is new)
    await blur(page);
    await page.click('#scList .scask[data-n="1"] .scdel');
    await idle(page);
    assert.deepEqual(await rows(page), ['YR07']);
    assert.equal(await active(page), 'scAdd');
    // the last marker row taken off: the one above it
    await type(page, 'B000');
    assert.deepEqual(await rows(page), ['B000', 'YR07']);
    await blur(page);
    await page.click('#scList .scrow[data-n="1"] .scdel');
    await idle(page);
    assert.deepEqual(await rows(page), ['B000']);
    assert.equal(await active(page), 'scdel#0:');
    // the only row taken off with the keyboard down: nothing left and Add off, so the line that says so (v318.7 debug:
    // the count, empty then, had the keyboard's place and a screen reader heard nothing)
    await blur(page);
    await page.click('#scList .scrow[data-n="0"] .scdel');
    await idle(page);
    assert.deepEqual(await rows(page), []);
    assert.equal(await active(page), 'scEmpty');
    assert.match(await page.textContent('#scEmpty'), /^Nothing yet/);
    await type(page, 'B000');
    // with the box focused (typing on a Mac): × goes back to the box
    await page.focus('#scBox');
    await page.click('#scList .scrow[data-n="0"] .scdel');
    await idle(page);
    assert.equal(await active(page), 'scBox');
    assert.deepEqual(errors, []);
  });
  test('each chip is described by its question, for a screen reader', async () => {
    const { page, errors } = await opened();
    await type(page, 'B04');
    const d = await page.$$eval('#scList .scask .scchoose', (bs) =>
      bs.map((b) => document.getElementById(b.getAttribute('aria-describedby')).textContent),
    );
    assert.deepEqual(
      d.map((t) => t.replace(/: .*$/, '?')),
      ['B04?', 'B04?'],
    );
    assert.deepEqual(errors, []);
  });
  // the sweep's switch to both brands (section 6): its row's Keep Ohuhu and × follow the keyboard too
  test('Keep Ohuhu and the row’s × follow the keyboard: the first question when the box hadn’t it', async () => {
    const KEY = 'ohuhu-hb320-picker-v3';
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ms-last-ver': 'v318',
        [KEY]: JSON.stringify({
          mode: 'collection',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'],
          saved: [],
        }),
      },
    });
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    const scanText = async (text) => {
      await page.evaluate((t) => {
        const b = document.getElementById('scBox');
        b.value = t;
        b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
      }, text);
      await page.waitForFunction(() => document.getElementById('scBox').value === '', null, {
        timeout: 5000,
      });
      await idle(page);
    };
    await scanText('YR07');
    await scanText('E71 Champagne');
    await scanText('BG11 Moon White');
    assert.ok(await page.$('#scList .scswitch'), 'switched');
    // Keep Ohuhu, the box with the keyboard (a sweep): back in the box
    assert.equal(await active(page), 'scBox');
    await page.click('#scList .scswitch .scswkeep');
    await idle(page);
    assert.equal(await active(page), 'scBox');
    assert.equal(await page.$('#scList .scswitch'), null);
    // switched again after two more Copic caps; × on the row with the keyboard down: the first question (YR07, held)
    await scanText('B000');
    await scanText('C-3');
    assert.ok(await page.$('#scList .scswitch'), 'switched again');
    await blur(page);
    await page.click('#scList .scswitch .scswx');
    await idle(page);
    assert.equal(await page.$('#scList .scswitch'), null);
    assert.match(await active(page), /^scchoose#\d+:YR07 /, 'the first question');
    assert.deepEqual(errors, []);
  });
  test('the larger view: the question’s answers under the picture; a chip answers it (in place, the photo kept) and closes; focus follows the keyboard', async () => {
    const { page, errors } = await opened();
    const list = await read(page);
    assert.equal(list[0], '“808” read: is it this one?@1');
    await zoomOpen(page);
    assert.equal(await page.locator('.sczoom .scchoose').count(), 1);
    assert.match(await page.textContent('.sczoom .scchoose'), /^B08 .* · Ohuhu/);
    assert.equal(await page.textContent('.sczoom [data-a="not"]'), 'Not this cap');
    assert.equal(await page.textContent('.sczoom [data-a="close"]'), 'Not now');
    assert.equal(await active(page), 'btn-primary:Not now');
    await page.click('.sczoom .scchoose');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    const after = await page.evaluate(() =>
      scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + e.photo),
    );
    assert.equal(after[0], 'B08@1', 'answered in its place, its photo kept');
    assert.equal(after.length, 9);
    assert.equal(await page.locator('#scList .scask').count(), 0);
    // no question left: Add, which has new markers
    assert.equal(await page.isDisabled('#scAdd'), false);
    assert.equal(await active(page), 'scAdd');
    assert.match(await page.textContent('#scStat'), /B08 .*Already in your collection/);
    assert.deepEqual(errors, []);
  });
  test('the larger view: Not this cap takes the question off; the picture, outside, Not now and Escape close it, the card’s words don’t', async () => {
    const { page, errors } = await opened();
    await read(page);
    // the title: stays open
    await zoomOpen(page);
    await page.click('.sczoom .dsub');
    await page.waitForTimeout(100);
    assert.ok(await page.isVisible('.sczoom'), 'a tap on the words doesn’t close it');
    // the picture: closes, focus back on the picture in the list
    await page.click('.sczoom img');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement.className), 'sccrop');
    // outside the card
    await zoomOpen(page);
    await page.mouse.click(5, 5);
    await page.waitForSelector('.sczoom', { state: 'detached' });
    // Not now
    await zoomOpen(page);
    await page.click('.sczoom [data-a="close"]');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    // Escape
    await zoomOpen(page);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.equal(await page.locator('#scList .scask').count(), 1, 'the question still waits');
    // Not this cap: the question goes, not asked again while the cap's in view; focus on to Add
    await zoomOpen(page);
    await page.click('.sczoom [data-a="not"]');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.equal(await page.locator('#scList .scask').count(), 0);
    assert.equal(await page.evaluate(() => scanList.length), 8);
    assert.ok(await page.evaluate(() => scanAnsweredAt.has('confirm 808')));
    assert.equal(await active(page), 'scAdd');
    assert.deepEqual(errors, []);
  });
  test('the larger view ignores the tail of the tap that opened it, and says when the question has gone meanwhile', async () => {
    const { page, errors } = await opened();
    await read(page);
    // a chip tapped within 300 ms of opening: nothing
    await page.click('#scList .sccropped .sccrop');
    await page.waitForSelector('.sczoom.on');
    await page.click('.sczoom .scchoose', { timeout: 250 }).catch(() => {});
    await page.waitForTimeout(50);
    assert.ok(await page.isVisible('.sczoom'), 'still open');
    assert.equal(await page.locator('#scList .scask').count(), 1, 'not answered');
    // the question answered meanwhile (a cap read, a photo): the chip closes the view and says so
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      scanList = scanList.filter((e) => !e.ask);
      scanRender();
    });
    await page.click('.sczoom .scchoose');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.match(await page.textContent('#scStat'), /That question’s gone/);
    assert.equal(await page.evaluate(() => scanList.length), 8);
    assert.deepEqual(errors, []);
  });
  test('Undo this photo gives a question the photo answered back at its own photo’s group', async () => {
    const { page, errors } = await opened();
    // photo 1: the tray and "808" (B08, asked); a typed question of no photo above it; photo 2 reads B08 plainly: the
    // question's every answer is in the list, so it goes, kept for Undo
    await read(page);
    await type(page, 'B04');
    const two = await read(page, ['B08'], true);
    assert.deepEqual(
      two.slice(0, 2).map((t) => t.replace(/: .*\?/, '?')),
      ['B08@2', 'B04?'],
    );
    assert.match(two[2], /@1$/, 'then photo 1’s');
    assert.equal(two.filter((t) => /808/.test(t)).length, 0, 'answered by photo 2');
    assert.equal(await page.evaluate(() => ocrAnswered.length), 1);
    await page.click('#ocrUndo');
    await idle(page);
    const after = await page.evaluate(() =>
      scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0)),
    );
    assert.deepEqual(
      after.slice(0, 2),
      ['?@0', '?@1'],
      'back at the top of photo 1’s group, under the typed question',
    );
    assert.match(after[2], /^B\d+@1$/);
    assert.equal(after.filter((t) => /@2$/.test(t)).length, 0, 'photo 2’s out');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-brands.test.mjs ----
// v318.7 Scan, in the browser: with Ohuhu set for you (an all-Ohuhu collection, no brand ever tapped), two Copic caps
// read whole switch the reading to both brands, with a row at the top of the list and Keep Ohuhu; the row isn't a
// question, isn't saved, and × takes it off; a brand tapped ends it; a reload brings the brand set for you back. And a
// brand tapped answers "Which R29?" between two brands' markers (section 0). Each test fails on v318.6.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    ...extra,
  });
  const OHUHU = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|B04',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OHUHU,
      saved: [],
      ...extra,
    });
  const scanOpen = async (page) => {
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
  };
  const pressed = (page) => page.$eval('#scBrand button[aria-pressed="true"]', (b) => b.dataset.b);
  // as Scan Text puts a cap's text in the box, then holds still
  const scanText = async (page, text) => {
    await page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
    await idle(page);
  };
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  const rows = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
    );
  const row = (page) => page.$('#scList .scswitch');
  test('Scan with Ohuhu set for you: two Copic caps read whole switch to both brands, said on a row with Keep Ohuhu; the row is no question and isn’t saved; Keep Ohuhu takes it back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanOpen(page);
    assert.equal(await pressed(page), 'Ohuhu');
    // a code both brands use, Ohuhu's for now; then a Copic cap read whole: a question in the list, not a vanishing card
    await scanText(page, 'YR07');
    await scanText(page, 'E71 Champagne');
    assert.deepEqual(await rows(page), ['Copic E71 Champagne: add it? Ohuhu was set for you', 'YR07']);
    assert.equal(await pressed(page), 'Ohuhu');
    assert.equal(await row(page), null);
    // the second: switched. Either pressed (not stored), the row at the top, the first cap in, YR07 asked
    await scanText(page, 'BG11 Moon White');
    assert.equal(await pressed(page), '');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), null, 'not stored');
    assert.ok(await row(page), 'the row');
    assert.match(await page.textContent('#scList .scswitch'), /Reading both brands: Copic caps were read/);
    assert.equal(await page.textContent('#scList .scswitch .scswkeep'), 'Keep Ohuhu');
    assert.deepEqual(await rows(page), [
      'Reading both brands: Copic caps were read',
      'BG11',
      'E71',
      'YR07: Ohuhu or Copic?',
    ]);
    assert.match(
      await page.textContent('#scStat'),
      /Reading both brands: Copic caps were read.*Codes both brands use are asked from now on · Keep Ohuhu is at the top of the list/,
    );
    // counted as the one question it is, the row not among them; nor saved for a reload
    assert.match(await page.textContent('#scCount'), /2.markers · 1.to.choose/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list')));
    assert.equal(saved.length, 3, JSON.stringify(saved));
    // Keep Ohuhu: Ohuhu pressed, YR07 Ohuhu's again, the Copic caps asked about, the row gone
    await page.click('#scList .scswitch .scswkeep');
    await idle(page);
    assert.equal(await pressed(page), 'Ohuhu');
    assert.equal(await row(page), null);
    assert.deepEqual(await rows(page), [
      'Copic BG11 Moon White: add it? Ohuhu was set for you',
      'Copic E71 Champagne: add it? Ohuhu was set for you',
      'YR07',
    ]);
    assert.match(await page.textContent('#scStat'), /Ohuhu again.*Copic codes read since are asked below/);
    // two more distinct Copic caps: switched again, the row back; × takes the row off, the reading stays
    await scanText(page, 'B000');
    assert.equal(await pressed(page), 'Ohuhu');
    await scanText(page, 'C-3');
    assert.equal(await pressed(page), '');
    assert.ok(await row(page), 'the row again');
    await page.click('#scList .scswitch .scswx');
    await idle(page);
    assert.equal(await row(page), null);
    assert.equal(await pressed(page), '');
    // a reload: the brand set for you is back, nothing of the switch kept
    await page.keyboard.press('Escape');
    await idle(page);
    await page.reload();
    await idle(page);
    await scanOpen(page);
    assert.equal(await pressed(page), 'Ohuhu');
    assert.equal(await row(page), null);
    assert.match(await page.textContent('#scStat'), /Set to Ohuhu, the brand of all your markers/);
    assert.deepEqual(errors, []);
  });
  test('Scan: a brand tapped on the switch ends the switch and its row, kept from then on; Clear list brings the brand set for you back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanOpen(page);
    await scanText(page, 'E71 Champagne');
    await scanText(page, 'BG11 Moon White');
    assert.ok(await row(page));
    await page.click('#scClear');
    await page.click('#scClear');
    await idle(page);
    assert.equal(await row(page), null);
    assert.equal(await pressed(page), 'Ohuhu');
    await scanText(page, 'E71 Champagne');
    await scanText(page, 'BG11 Moon White');
    assert.ok(await row(page));
    await page.click('#scBrand button[data-b="Copic"]');
    await idle(page);
    assert.equal(await row(page), null);
    assert.equal(await pressed(page), 'Copic');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), 'Copic');
    // (a Copic cap read now is simply Copic's: the switch is over for good)
    await scanText(page, 'C-3');
    assert.equal(await row(page), null);
    assert.ok((await rows(page)).includes('C-3'));
    assert.deepEqual(errors, []);
  });
  test('Scan with Ohuhu chosen: "Which R29?" offers Ohuhu YR47 by its old code and Copic R29; a brand tapped answers it', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanOpen(page);
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await idle(page);
    await type(page, 'R29');
    assert.deepEqual(await rows(page), ['Which R29?']);
    const chips = await page.$$eval('#scList .scask .scchoose', (b) => b.map((x) => x.textContent));
    // (v318.21: by its old code, as its older cap says it, the code it has now beside)
    assert.deepEqual(chips, ['R29 Pear Color · Ohuhu · now YR47', 'R29 Lipstick Red · Copic']);
    await page.click('#scBrand button[data-b="Copic"]');
    await idle(page);
    assert.deepEqual(await rows(page), ['R29']);
    assert.match(await page.textContent('#scList .scrow'), /Copic/);
    assert.match(await page.textContent('#scStat'), /1 question answered/);
    // and back under Ohuhu, typed again: the Ohuhu marker's turn
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await idle(page);
    await type(page, 'R30');
    assert.deepEqual(await rows(page), ['Which R30?', 'R29']);
    // (v318.21: the answer and its row as the older cap says it, R30, "now E81")
    await page.click('#scList .scask .scchoose:has-text("now E81")');
    await idle(page);
    assert.deepEqual(await rows(page), ['R30', 'R29']);
    assert.match(await page.textContent('#scList .scrow'), /now E81/);
    assert.deepEqual(errors, []);
  });
  test('Scan: codes both brands use added to the collection as Ohuhu’s before the switch are named on the row, not rewritten', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanOpen(page);
    await scanText(page, 'YR07');
    await scanText(page, 'B015');
    await page.click('#scAdd');
    await idle(page);
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR07')));
    await scanFromMarkers(page);
    await idle(page);
    assert.equal(await pressed(page), 'Ohuhu');
    await scanText(page, 'E71 Champagne');
    await scanText(page, 'BG11 Moon White');
    assert.ok(await row(page));
    assert.match(
      await page.textContent('#scList .scswitch small'),
      /^YR07 went into your collection as Ohuhu$/,
    );
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR07')), 'not rewritten');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-gaps.test.mjs ----
// v318.7 Scan, section 10, in the browser: when the list and your collection cover nearly all of a set, the set is
// named with what's missing — on Done's card after a photo and on a list's card, "Ciao 36 - Set A: all but 3 are here
// — G00, G05 and G17. Not read, or not yours?" with Add these 3 (to the list) and I don't have them (remembered); after
// a sweep, in Add's toast, with Open for the card, which is also kept for the next opening of Scan. Nothing enters the
// collection from any of them by itself. Each test fails on v318.6 (no such card or toast line).
{
  const KEY = 'ohuhu-hb320-picker-v3';
  // Ciao 36 Set A but six of it (E00 E21 E29 G00 G05 G17), as the collection
  const CIAO_OWNED =
    '100 B00 B24 B29 BG01 BG09 BG23 BV00 BV02 BV08 C-3 E37 R20 R29 R32 RV02 RV04 RV10 V04 V09 V12 Y00 Y06 Y17 YG03 YG06 YG11 YR02 YR07 YR20'
      .split(' ')
      .map((c) => 'Copic|' + c);
  const stored = (owned) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    'ms-scan-brand': '',
    [KEY]: JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: owned,
      saved: [],
    }),
  });
  async function opened(owned) {
    const a = await openApp({ width: 820, height: 1180, storage: stored(owned) });
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  // a cap read by Scan Text: the text arrives without a key and holds still
  const scanText = async (page, text) => {
    await page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
    await idle(page);
  };
  const card = async (page) => ({
    big: await page.textContent('#scStat b'),
    small: await page.textContent('#scStat .sctext > span'),
    head: (await page.locator('#scStat .scphead').count())
      ? await page.textContent('#scStat .scphead')
      : null,
    buttons: await page.$$eval('#scStat .scpick button', (bs) => bs.map((b) => b.textContent)),
  });
  const listCodes = (page) => page.evaluate(() => scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code)));
  // a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: the codes given; the reader's view with
  // its buttons left as a real photo leaves it, for Done
  function photo(page, codes) {
    return page.evaluate((codes) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 400;
      const g = cv.getContext('2d');
      g.fillStyle = '#888';
      g.fillRect(0, 0, 400, 400);
      const r = {
        n: ++ocrPhotos,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: 400, h: 400, data: g.getImageData(0, 0, 400, 400) };
      ocrRun = r;
      ocrShow(
        '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
          '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
      );
      const lines = codes.map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
      }));
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      scanRender();
      return scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0));
    }, codes);
  }
  // Honolulu 120 but eight of it (B08 B111 B114 B115 B310 B315 B411 B415), as the collection
  const H_OUT = ['B08', 'B111', 'B114', 'B115', 'B310', 'B315', 'B411', 'B415'].map((c) => 'Ohuhu|' + c);
  async function honolulu() {
    const { page } = await openApp({ width: 820, height: 1180, storage: stored(['Ohuhu|R014']) });
    const keys = await page.evaluate(() => presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 120')));
    await page.close();
    return keys.filter((k) => H_OUT.indexOf(k) < 0);
  }
  // three caps swept, then Add: the toast names what wasn't read (more than four: their number), with Open
  async function swept(page) {
    for (const c of ['B08', 'B111', 'B114']) await scanText(page, c);
    assert.deepEqual(await listCodes(page), ['B114', 'B111', 'B08']);
    assert.equal((await card(page)).head, null, 'a cap at a time: no card for the set');
    await page.click('#scAdd');
    await idle(page);
    const toast = (await page.textContent('#msToast')).replace(/\u00a0/g, ' ');
    assert.match(toast, /^Added 3 markers to your collection · Honolulu 120: 5 weren’t read/);
    assert.deepEqual(await page.$$eval('#msToast button', (bs) => bs.map((b) => b.textContent)), [
      'Undo',
      'Open',
    ]);
    assert.equal(await page.evaluate(() => state.owned.size), 116);
  }
  const HEAD = 'Honolulu 120: all but 5 are here — B115, B310, B315, B411 and B415. Not read, or not yours?';
  test('Done’s card after a photo names the set nearly all here with what’s missing; Add these 3 puts them in the list, not the collection; said once', async () => {
    const { page, errors } = await opened(CIAO_OWNED);
    assert.deepEqual(await photo(page, ['E00', 'E21', 'E29']), ['E29@1', 'E21@1', 'E00@1']);
    await page.click('#ocrDone');
    await idle(page);
    const c = await card(page);
    assert.equal(c.big, 'From the photo: 3 added to the list');
    assert.equal(c.head, 'Ciao 36 - Set A: all but 3 are here — G00, G05 and G17. Not read, or not yours?');
    assert.deepEqual(c.buttons, ['Add these 3', 'I don’t have them']);
    await page.click('#scStat .scpick button:has-text("Add these 3")');
    await idle(page);
    assert.deepEqual(await listCodes(page), ['G17', 'G05', 'G00', 'E29', 'E21', 'E00']);
    assert.equal(await page.textContent('#scAdd'), 'Add 6 to my collection');
    assert.equal(await page.evaluate(() => state.owned.size), 30, 'nothing in the collection by itself');
    assert.equal((await card(page)).big, '3 added to the list');
    assert.equal((await card(page)).small, 'Ciao 36 - Set A · Check them below, then Add');
    // the set complete now (listed or yours): another photo's Done has no set to name
    await photo(page, ['E00']);
    await page.click('#ocrDone');
    await idle(page);
    assert.equal((await card(page)).head, null);
    assert.deepEqual(errors, []);
  });
  test('a list’s card names it too; I don’t have them is remembered for the set, through a reload', async () => {
    const { page, errors } = await opened(CIAO_OWNED);
    await type(page, 'E00 E21 E29');
    let c = await card(page);
    assert.equal(c.big, '3 added to the list');
    assert.equal(c.head, 'Ciao 36 - Set A: all but 3 are here — G00, G05 and G17. Not read, or not yours?');
    await page.click('#scStat .scpick button:has-text("I don’t have them")');
    await idle(page);
    c = await card(page);
    assert.equal(c.big, 'Not yours, then');
    assert.equal(c.small, 'Ciao 36 - Set A’s missing markers aren’t asked about again');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-scan-nothave')),
      '["Copic|Ciao 36 - Set A"]',
    );
    assert.deepEqual(await listCodes(page), ['E29', 'E21', 'E00']);
    // not again: the list cleared and pasted again, and after a reload
    await page.click('#scClear');
    await page.click('#scClear');
    await idle(page);
    await type(page, 'E00 E21 E29');
    assert.equal((await card(page)).head, null);
    await page.reload();
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await page.click('#scClear');
    await page.click('#scClear');
    await idle(page);
    await type(page, 'E00 E21 E29');
    assert.equal((await card(page)).big, '3 added to the list');
    assert.equal((await card(page)).head, null);
    assert.deepEqual(errors, []);
  });
  test('after a sweep, Add’s toast names what wasn’t read; the card with Add these N is kept for the next opening of Scan, once; nothing enters the collection by itself', async () => {
    const { page, errors } = await opened(await honolulu());
    await swept(page);
    // the toast let go by: Scan opened from Markers has the card
    await page.waitForTimeout(300);
    await scanFromMarkers(page);
    await idle(page);
    const c = await card(page);
    assert.equal(c.big, 'Ready');
    assert.equal(c.head, HEAD);
    assert.deepEqual(c.buttons, ['Add these 5', 'I don’t have them']);
    await page.click('#scStat .scpick button:has-text("Add these 5")');
    await idle(page);
    assert.deepEqual(await listCodes(page), ['B415', 'B411', 'B315', 'B310', 'B115']);
    assert.equal(await page.textContent('#scAdd'), 'Add 5 to my collection');
    assert.equal(await page.evaluate(() => state.owned.size), 116, 'to the list, not the collection');
    // closed and opened again: the card isn't kept twice (the list is)
    await page.click('#scClose');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal((await card(page)).head, null);
    assert.deepEqual(await listCodes(page), ['B415', 'B411', 'B315', 'B310', 'B115']);
    // Add: the set complete, nothing more named, and no Open
    await page.click('#scAdd');
    await idle(page);
    assert.match(
      (await page.textContent('#msToast')).replace(/\u00a0/g, ' '),
      /^Added 5 markers to your collection Undo$/,
    );
    assert.deepEqual(await page.$$eval('#msToast button', (bs) => bs.map((b) => b.textContent)), ['Undo']);
    assert.equal(await page.evaluate(() => state.owned.size), 121);
    assert.deepEqual(errors, []);
  });
  test('the toast’s Open opens Scan with the card', async () => {
    const { page, errors } = await opened(await honolulu());
    await swept(page);
    await page.click('#toastAct2');
    await page.waitForSelector('#scanOverlay.on');
    await idle(page);
    assert.equal((await card(page)).head, HEAD);
    await page.click('#scStat .scpick button:has-text("I don’t have them")');
    await idle(page);
    assert.equal((await card(page)).big, 'Not yours, then');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-scan-nothave')),
      '["Ohuhu|Honolulu 120"]',
    );
    assert.deepEqual(await listCodes(page), []);
    assert.deepEqual(errors, []);
  });
  // (v318.7 debug) an opening in Find mode (Scan 3 caps) doesn't show the card, and doesn't let it go either: the next
  // ordinary opening has it
  test('the card kept after a sweep survives an opening of Scan in Find mode', async () => {
    const { page, errors } = await opened(await honolulu());
    await swept(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => openScan({ find: { brand: 'Ohuhu' } }));
    await page.waitForSelector('#scanOverlay.on');
    await idle(page);
    assert.equal((await card(page)).head, null, 'not in Find mode');
    await page.click('#scClose');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal((await card(page)).head, HEAD);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-pics.test.mjs ----
// v318.7 Scan, section 3: the pictures of the questions waiting (a photo's question's cap) are kept in a small database
// of the app's own, 'ms-scan-pics', through a reload: the list shows first, the pictures a moment later ("?" until
// then, and for good when the storage fails); only what's changed is written (nothing at a draw that changed nothing);
// a question answered or taken off, or the list cleared, takes its picture out; every waiting one's kept (v318.25:
// at most 60 had been); and Delete all my
// data deletes the database. Each test fails on v318.6 (the pictures lived only in memory: "?" after a reload).
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = {
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    'ms-scan-brand': '',
    [KEY]: JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R014'],
      saved: [],
    }),
  };
  // an app with a marker, Either brand chosen, Scan open
  async function opened(opts = {}) {
    const a = await openApp({ width: 820, height: 1180, storage: onboarded, ...opts });
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  // the same app again, as a reload: its storage as the page left it
  const reopen = async (page) => {
    await page.reload();
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
  };
  // a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: eight Ohuhu codes and "808" (asked
  // about, with its cap's picture)
  function read(page) {
    return page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 400;
      const g = cv.getContext('2d');
      g.fillStyle = '#888';
      g.fillRect(0, 0, 400, 400);
      const data = g.getImageData(0, 0, 400, 400);
      scanList = [];
      ocrAnswered = [];
      ocrPhotos = 0;
      scanBrand = '';
      const r = {
        n: ++ocrPhotos,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: 400, h: 400, data: data };
      ocrRun = r;
      const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115'].map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [20 + k * 40, 380, 30, 14, 0],
      }));
      lines.push({
        id: 20,
        look: 1,
        text: '808',
        conf: 0.97,
        unsure: false,
        nameOf: 0,
        box: [200, 200, 100, 40, 0],
        turn: 0,
      });
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      ocrRun = null;
      scanRender();
      return scanList.map((e) => (e.ask ? e.ask : COLORS[e.i].code) + (e.crop ? ' pic' : ''));
    });
  }
  // the database's rows, read here: [ask, at] each; null when there's no database (or no store in it)
  const rows = (page) =>
    page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ms-scan-pics');
          r.onerror = () => res(null);
          r.onsuccess = () => {
            const d = r.result;
            if (!d.objectStoreNames.contains('p')) {
              d.close();
              res(null);
              return;
            }
            const st = d.transaction('p', 'readonly').objectStore('p'),
              a = st.getAllKeys(),
              b = st.getAll();
            b.onsuccess = () => {
              d.close();
              res(a.result.map((k, n) => [k, b.result[n].at]));
            };
          };
        }),
    );
  const counts = (page) => page.evaluate(() => [scanPics.writes, scanPics.deletes]);
  // the names of the databases here, where the browser can list them (Chromium and Safari can; null where not)
  const dbNames = (page) =>
    page.evaluate(async () =>
      indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null,
    );
  test('a photo’s question keeps its picture through a reload; a draw that changes nothing writes nothing; the answer takes the picture out', async () => {
    const { page, errors } = await opened();
    const list = await read(page);
    assert.equal(list[0], 'confirm 808 pic');
    await page.waitForFunction(() => scanPics.writes === 1);
    assert.deepEqual(
      (await rows(page)).map((r) => r[0]),
      ['confirm 808'],
    );
    // drawn again, nothing changed: nothing written
    await page.evaluate(() => {
      scanRender();
      scanRender();
      scanSaveList();
    });
    await page.waitForTimeout(300);
    assert.deepEqual(await counts(page), [1, 0]);
    // a reload: the question back with its picture, to see larger
    await reopen(page);
    assert.equal(await page.locator('#scList .scask').count(), 1);
    await page.waitForSelector('#scList .scask.sccropped .sccrop img', { timeout: 5000 });
    assert.match(await page.getAttribute('#scList .sccrop img', 'src'), /^data:image\/jpeg/);
    assert.deepEqual(await counts(page), [0, 0], 'nothing written again on load');
    // answered: the picture goes from the database
    await page.click('#scList .scask .scchoose');
    await idle(page);
    await page.waitForFunction(() => scanPics.deletes === 1);
    assert.deepEqual(await rows(page), []);
    assert.deepEqual(errors, []);
  });
  test('the list shows first, the picture a moment later; when the storage fails, "?" as before', async () => {
    const { ctx, page, errors } = await opened();
    await read(page);
    await page.waitForFunction(() => scanPics.writes === 1);
    // (the database made slow to answer, as a device busy or waking can be: the app is handed a request of the test's
    // own, answered only when the test lets it go. v318.7 debug: the first way, an accessor put over the real request's
    // onsuccess, held in Chromium and in WebKit here but not in WebKit on GitHub, where the picture was there at once)
    await ctx.addInitScript(() => {
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = function (name, v) {
        if (name !== 'ms-scan-pics') return open(name, v);
        const fake = {
          result: null,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null,
        };
        const real = open(name, v);
        real.onupgradeneeded = (ev) => {
          fake.result = real.result;
          if (fake.onupgradeneeded) fake.onupgradeneeded.call(fake, ev);
        };
        real.onsuccess = (ev) => {
          fake.result = real.result;
          window.__picsGo = () => fake.onsuccess && fake.onsuccess.call(fake, ev);
        };
        real.onerror = (ev) => {
          fake.error = real.error;
          if (fake.onerror) fake.onerror.call(fake, ev);
        };
        real.onblocked = (ev) => fake.onblocked && fake.onblocked.call(fake, ev);
        return fake;
      };
    });
    await reopen(page);
    assert.equal(await page.locator('#scList .scask').count(), 1);
    assert.equal(await page.locator('#scList .scask.sccropped').count(), 0, 'the question first, "?"');
    assert.equal(await page.textContent('#scList .scask .scmark'), '?');
    await page.waitForFunction(() => typeof window.__picsGo === 'function');
    await page.evaluate(() => window.__picsGo());
    await page.waitForSelector('#scList .scask.sccropped', { timeout: 5000 });
    // the storage failing: "?" stays, no error. (v318.11: in a session of its own, the list as this one left it, the
    // database's open made to throw from the start: on GitHub's WebKit a second init script added to this session was
    // not in force on the reload, and the picture came back at once, 1 !== 0; and a check that the throw was met)
    const listLeft = await page.evaluate(() => localStorage.getItem('ms-scan-list'));
    assert.ok(listLeft && listLeft.includes('808'), 'the question is in the saved list');
    const b = await openApp({
      width: 820,
      height: 1180,
      storage: { ...onboarded, 'ms-scan-list': listLeft },
      init: () => {
        window.__picsThrew = 0;
        const open = indexedDB.open;
        indexedDB.open = function (name, v) {
          if (name === 'ms-scan-pics') {
            window.__picsThrew++;
            throw new Error('no storage here');
          }
          return open.call(indexedDB, name, v);
        };
      },
    });
    await idle(b.page);
    await scanFromMarkers(b.page);
    await idle(b.page);
    await b.page.waitForTimeout(800);
    const why = async () =>
      JSON.stringify(
        await b.page.evaluate(() => ({
          threw: window.__picsThrew,
          loads: scanPics.loads,
          open: String(indexedDB.open).slice(0, 80),
        })),
      );
    assert.ok(
      await b.page.evaluate(() => window.__picsThrew > 0),
      'the database was asked for and failed ' + (await why()),
    );
    assert.equal(await b.page.locator('#scList .scask').count(), 1);
    assert.equal(await b.page.locator('#scList .scask.sccropped').count(), 0, 'no picture ' + (await why()));
    assert.equal(await b.page.textContent('#scList .scask .scmark'), '?');
    assert.deepEqual(b.errors, []);
    assert.deepEqual(errors, []);
  });
  test('Clear list takes the pictures out; every question waiting keeps its picture, and those of no question waiting are pruned', async () => {
    const { page, errors } = await opened();
    await read(page);
    await page.waitForFunction(() => scanPics.writes === 1);
    await page.click('#scClear');
    await page.click('#scClear');
    await idle(page);
    await page.waitForFunction(() => scanPics.deletes === 1);
    assert.deepEqual(await rows(page), []);
    // 63 questions waiting, their pictures in the database with their times (the rows put here), and 2 rows of
    // questions long gone: a reload keeps all 63 (v318.25: it had kept the 60 newest) and prunes the 2
    await page.evaluate(
      () =>
        new Promise((res) => {
          const codes = COLORS.filter((c) => c.brand === 'Copic' && c.code.length <= 4)
            .map((c) => c.code)
            .slice(0, 63);
          localStorage.setItem(
            'ms-scan-list',
            JSON.stringify(
              codes.map((c) => ({
                ask: 'brands ' + c,
                title: c + ': Ohuhu or Copic?',
                opts: [{ k: 'Copic|' + c, how: 'chosen' }],
              })),
            ),
          );
          const r = indexedDB.open('ms-scan-pics');
          r.onsuccess = () => {
            const d = r.result,
              st = d.transaction('p', 'readwrite').objectStore('p');
            codes.forEach((c, n) =>
              st.put({ crop: 'data:image/jpeg;base64,' + n, at: 1000 + n }, 'brands ' + c),
            );
            st.put({ crop: 'data:image/jpeg;base64,x', at: 5000 }, 'confirm 999');
            st.put({ crop: 'data:image/jpeg;base64,y', at: 1 }, 'brands ZZZ');
            st.transaction.oncomplete = () => {
              d.close();
              res();
            };
          };
        }),
    );
    await reopen(page);
    await page.waitForFunction(() => scanPics.deletes === 2, null, { timeout: 5000 });
    const left = await rows(page);
    assert.equal(left.length, 63);
    const ats = left.map((r) => r[1]).sort((a, b) => a - b);
    assert.equal(ats[0], 1000, 'the oldest kept too');
    assert.ok(
      !left.some((r) => r[0] === 'confirm 999' || r[0] === 'brands ZZZ'),
      'no question waiting: pruned',
    );
    assert.equal(await page.locator('#scList .scask.sccropped').count(), 63);
    assert.equal(await page.locator('#scList .scask').count(), 63);
    assert.deepEqual(errors, []);
  });
  test('Delete all my data deletes the pictures’ database, and nothing’s written back; the page starting again with no question waiting makes none', async () => {
    const { page, errors } = await opened();
    await read(page);
    await page.waitForFunction(() => scanPics.writes === 1);
    const before = await dbNames(page);
    if (before) assert.ok(before.includes('ms-scan-pics'), before.join(' '));
    // the wipe itself (what Help › Your data › Delete all my data runs before the page starts again): the database
    // gone, and a draw after it writes nothing back
    const after = await page.evaluate(async () => {
      await wipeAllData();
      scanRender();
      scanSaveList();
      await new Promise((r) => setTimeout(r, 400));
      return {
        dbs: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null,
        writes: scanPics.writes,
      };
    });
    if (after.dbs) assert.ok(!after.dbs.includes('ms-scan-pics'), after.dbs.join(' '));
    assert.equal(after.writes, 1, 'nothing written back');
    // the page again, as the wipe starts it: the welcome, no list, and no database made for it
    await page.reload();
    await idle(page);
    await page.waitForTimeout(400);
    const fresh = await dbNames(page);
    if (fresh) assert.ok(!fresh.includes('ms-scan-pics'), fresh.join(' '));
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-list')), null);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    // (and opened afresh here, it has no store: nothing in it)
    assert.equal(await rows(page), null);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3187-waiting.test.mjs ----
// v318.7 Scan, sections 8 and 9, in the browser: Markers' Add markers sheet says the questions still waiting in Scan's
// list, "2 questions still to answer · Answer them", which opens Scan at the first question's first answer with no
// keyboard; a question every answer of which is in your collection is dropped (after Add, and when the sheet opens);
// with two tabs open the list is read again from the other tab's save, its pictures found again; and the list has a
// small heading over each photo's markers, kept through a reload and numbered 1.. in turn, the batch's summary
// numbered the same way. Each test fails on v318.6.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const stored = (owned) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    'ms-scan-brand': '',
    [KEY]: JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: owned || ['Ohuhu|R014'],
      saved: [],
    }),
  });
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a.id || a.className + ':' + a.textContent.trim().slice(0, 20);
    });
  const waitLine = async (page) => {
    const el = page.locator('#mkaWait');
    if (!(await el.count())) return null;
    return (await el.isHidden()) ? '' : (await el.textContent()).trim();
  };
  // a photo 400×400, drawn here (nothing of anyone's), the reader's lines made up: the codes given, and "808" (asked
  // about, with its cap's picture) when asked for. keep: the list as it is (another photo after the first)
  function read(page, codes, ask, keep) {
    return page.evaluate(
      ([codes, ask, keep]) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 400;
        const g = cv.getContext('2d');
        g.fillStyle = '#888';
        g.fillRect(0, 0, 400, 400);
        const data = g.getImageData(0, 0, 400, 400);
        if (!keep) {
          scanList = [];
          ocrAnswered = [];
          ocrPhotos = 0;
        }
        scanBrand = '';
        const r = {
          n: ++ocrPhotos,
          items: new Map(),
          taken: new Set(),
          brands: {},
          sure: 0,
          p: null,
          done: false,
          note: '',
        };
        r.img = { w: 400, h: 400, data: data };
        ocrRun = r;
        const lines = codes.map((t, k) => ({
          id: k + 1,
          look: 1,
          text: t,
          conf: 0.98,
          unsure: false,
          nameOf: 0,
          box: [20 + (k % 8) * 40, 380 - Math.floor(k / 8) * 60, 30, 14, 0],
        }));
        if (ask)
          lines.push({
            id: 20,
            look: 1,
            text: '808',
            conf: 0.97,
            unsure: false,
            nameOf: 0,
            box: [200, 200, 100, 40, 0],
            turn: 0,
          });
        lines.forEach((it) => ocrLine(r, it));
        ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
        clearTimeout(r.soon);
        ocrRun = null;
        scanRender();
        return scanList.map((e) => (e.ask ? '?' : COLORS[e.i].code) + '@' + (e.photo || 0));
      },
      [codes, !!ask, !!keep],
    );
  }
  const headings = (page) =>
    page.$$eval('#scList .scgroup', (hs) => hs.map((h) => h.textContent.replace(/ /g, ' ')));
  test('Add markers says the questions waiting; Answer them opens Scan at the first question without the keyboard; the line goes when none', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal(await waitLine(page), '', 'none waiting: hidden');
    await type(page, 'B04');
    await type(page, 'B05');
    assert.equal(await page.locator('#scList .scask').count(), 2);
    await page.click('#scClose');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '2 questions still to answerAnswer them');
    await page.click('#mkaQuestions');
    await page.waitForSelector('#scanOverlay.on');
    await idle(page);
    assert.match(await active(page), /^scchoose:B05 /, 'the first question’s first answer, not the box');
    assert.notEqual(await active(page), 'scBox');
    // answered, the line says one; the last answered, it goes
    await page.keyboard.press('Enter');
    await idle(page);
    await page.click('#scClose');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '1 question still to answerAnswer them');
    await page.click('#mkaQuestions');
    await page.waitForSelector('#scanOverlay.on');
    await page.click('#scList .scask .scchoose');
    await idle(page);
    await page.click('#scClose');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '');
    assert.deepEqual(errors, []);
  });
  test('a question every answer of which is in your collection is dropped, after Add and when the sheet opens, its picture with it', async () => {
    // Ohuhu B05 and Copic B05 both yours: "B05: Ohuhu or Copic?" is still asked when typed (already yours, either)
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: stored(['Ohuhu|R014', 'Ohuhu|B05', 'Copic|B05', 'Ohuhu|B08']),
    });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'B05');
    await type(page, 'Y213');
    assert.equal(await page.locator('#scList .scask').count(), 1);
    // Add: Y213 goes in, and the question, every answer yours, is dropped: not "1 still to choose"
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Added 1 marker to your collection/);
    assert.doesNotMatch(await page.textContent('#msToast'), /still to choose/);
    assert.equal(await page.evaluate(() => scanList.length), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-list')), null);
    // (v318.7 debug) Undo: Y213 back on the list, not the question, whose answers were yours before (it would only be
    // dropped again); but a question the Add itself answered by owning, "B04: Ohuhu or Copic?" with Copic B04 added,
    // comes back open with its Undo (it had gone for good)
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)), ['Y213']);
    await page.evaluate(() => {
      state.owned.add('Ohuhu|B04');
    });
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'B04');
    await type(page, 'Copic B04');
    assert.deepEqual(await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)), [
      'B04',
      'brands B04',
      'Y213',
    ]);
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Added 2 markers to your collection/);
    assert.doesNotMatch(await page.textContent('#msToast'), /still to choose/);
    assert.equal(await page.evaluate(() => scanList.length), 0);
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => scanList.map((e) => e.ask || COLORS[e.i].code)),
      ['B04', 'brands B04', 'Y213'],
      'as the list was',
    );
    assert.match(await page.evaluate(() => localStorage.getItem('ms-scan-list')), /"ask":"brands B04"/);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '1 question still to answerAnswer them');
    await page.keyboard.press('Escape');
    await idle(page);
    // a photo's question with its picture ("808": B08, yours already) waits; owning its answer, then opening the sheet,
    // drops it and its picture
    await scanFromMarkers(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned.delete('Ohuhu|B08');
    });
    const list = await read(page, ['B015', 'B03'], true);
    assert.deepEqual(list, ['?@1', 'B03@1', 'B015@1']);
    await page.waitForFunction(() => scanPics.writes === 1);
    await page.click('#scClose');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '1 question still to answerAnswer them');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.evaluate(() => {
      state.owned.add('Ohuhu|B08');
    });
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '');
    assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 0);
    await page.waitForFunction(() => scanPics.deletes === 1);
    // (v318.7 debug) the same question asked again, dropped by an Add that owns B08, given back by its Undo with its
    // picture, written again
    await page.keyboard.press('Escape');
    await idle(page);
    await page.evaluate(() => {
      state.owned.delete('Ohuhu|B08');
    });
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await read(page, ['B111'], true, true), ['?@2', 'B111@2', 'B03@1', 'B015@1']);
    await page.waitForFunction(() => scanPics.writes === 2);
    await type(page, 'B08');
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Added 4 markers to your collection/);
    assert.equal(await page.evaluate(() => scanList.length), 0);
    await page.waitForFunction(() => scanPics.deletes === 2);
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => scanList.map((e) => (e.ask || COLORS[e.i].code) + (e.crop ? ' pic' : ''))),
      ['B08', 'confirm 808 pic', 'B111', 'B03', 'B015'],
    );
    await page.waitForFunction(() => scanPics.writes === 3);
    assert.deepEqual(errors, []);
  });
  test('two tabs: the list is read again from the other tab’s save, with its pictures, while Scan isn’t open here', async () => {
    const { ctx, page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    // this tab: a photo's question with its picture, Scan closed
    const list = await read(page, ['B015', 'B03'], true);
    assert.deepEqual(list, ['?@1', 'B03@1', 'B015@1']);
    await page.waitForFunction(() => scanPics.writes === 1);
    await page.click('#scClose');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await waitLine(page), '1 question still to answerAnswer them');
    // the other tab: a question typed, Scan closed (the list saved)
    const other = await ctx.newPage();
    const errors2 = [];
    other.on('pageerror', (e) => errors2.push(e.message));
    await other.goto(page.url());
    await idle(other);
    assert.equal(await other.evaluate(() => scanList.length), 3, 'the list as saved');
    await scanFromMarkers(other);
    await idle(other);
    await other.waitForSelector('#scList .scask.sccropped', { timeout: 5000 });
    await type(other, 'B04');
    await other.click('#scClose');
    await idle(other);
    // this tab heard: the line says two, the list has both, and the photo's picture is found again
    await page.waitForFunction(() => scanList.length === 4, null, { timeout: 5000 });
    assert.equal(await waitLine(page), '2 questions still to answerAnswer them');
    await page.waitForFunction(() => scanList.some((e) => e.ask === 'confirm 808' && e.crop), null, {
      timeout: 5000,
    });
    assert.deepEqual(
      await page.evaluate(() =>
        scanList.map((e) => (e.ask ? e.ask : COLORS[e.i].code) + '@' + (e.photo || 0)),
      ),
      ['brands B04@0', 'confirm 808@1', 'B03@1', 'B015@1'],
    );
    // the other tab answers the photo's question: this one's line says one
    await scanFromMarkers(other);
    await idle(other);
    await other.click('#scList .scask.sccropped .scchoose');
    await idle(other);
    await other.click('#scClose');
    await idle(other);
    await page.waitForFunction(() => scanList.filter((e) => e.ask).length === 1, null, { timeout: 5000 });
    assert.equal(await waitLine(page), '1 question still to answerAnswer them');
    // not while Scan is open here: what's being done here isn't overwritten
    await page.keyboard.press('Escape');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'B05');
    await scanFromMarkers(other);
    await idle(other);
    await other.click('#scClear');
    await other.click('#scClear');
    await idle(other);
    await other.waitForTimeout(300);
    assert.equal(await page.evaluate(() => scanList.length), 5, 'kept here');
    await other.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(errors2, []);
  });
  test('a heading over each photo’s markers, and over the typed ones while photos are there; kept through a reload, numbered in turn; the batch’s summary the same', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'B04');
    assert.deepEqual(await headings(page), [], 'no photo: no headings');
    await read(page, ['B015', 'B03', 'B111'], true, true);
    assert.deepEqual(await headings(page), [
      'Photo 1 · 3 markers · 1 to choose',
      'Typed or scanned · 1 to choose',
    ]);
    await read(page, ['B112', 'B114'], false, true);
    assert.deepEqual(await headings(page), [
      'Photo 2 · 2 markers',
      'Photo 1 · 3 markers · 1 to choose',
      'Typed or scanned · 1 to choose',
    ]);
    // the photo's question answered: its marker in its place, under its heading
    await page.click('#scList .scask.sccropped .scchoose');
    await idle(page);
    assert.deepEqual(await headings(page), [
      'Photo 2 · 2 markers',
      'Photo 1 · 4 markers',
      'Typed or scanned · 1 to choose',
    ]);
    await type(page, 'Y213');
    assert.deepEqual(await headings(page), [
      'Typed or scanned · 1',
      'Photo 2 · 2 markers',
      'Photo 1 · 4 markers',
      'Typed or scanned · 1 to choose',
    ]);
    // a screen reader hears each heading whole
    assert.equal(
      await page.$eval('#scList .scgroup', (h) => h.tagName + ' ' + h.parentElement.id),
      'LI scList',
    );
    // a reload: the headings back, numbered 1.. in turn (saved as photos 3 and 5 here), the next photo after them
    await page.evaluate(() => {
      scanList.forEach((e) => {
        if (e.photo === 1) e.photo = 3;
        else if (e.photo === 2) e.photo = 5;
      });
      scanRender();
    });
    assert.match(await page.evaluate(() => localStorage.getItem('ms-scan-list')), /"p":5/);
    await page.reload();
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await headings(page), [
      'Typed or scanned · 1',
      'Photo 2 · 2 markers',
      'Photo 1 · 4 markers',
      'Typed or scanned · 1 to choose',
    ]);
    assert.equal(await page.evaluate(() => ocrPhotos), 2);
    await read(page, ['B115'], false, true);
    assert.deepEqual((await headings(page))[0], 'Photo 3 · 1 marker');
    // a batch's summary numbers its photos as the headings do: on from the photos before it
    const sum = await page.evaluate(() => {
      ocrShow(
        '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div><div class="ocrbar"><b id="ocrBar"></b></div>' +
          '<div class="ocrpic" id="ocrPic"></div><div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
      );
      ocrQ = {
        files: [1, 2],
        k: 2,
        n0: 4,
        per: [
          { added: 1, asked: 0 },
          { added: 2, asked: 1 },
        ],
        stop: false,
        t0: Date.now(),
      };
      const r = { n: 5, done: true, added: 2, asked: 1, p: {} };
      ocrStatus(r);
      const t = document.getElementById('ocrSum').textContent;
      ocrQ = null;
      ocrHide();
      return t;
    });
    assert.match(sum, /Photo 4: 1 added · Photo 5: 2 added, 1 to choose/);
    // Find mode: no headings
    assert.deepEqual(errors, []);
  });
  // (v318.7 debug) Clear list numbers the next photo 1 again (it had said "Photo 3" over an empty list); and with Scan
  // open here while another tab answers a question and deletes its picture, this tab's list, still asking it, puts the
  // picture back when it's saved (it had been left with none after a reload)
  test('Clear list numbers photos afresh; a picture another tab deleted is put back by this tab’s list, which still asks', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await read(page, ['B015'], false);
    await read(page, ['B03'], true, true);
    assert.deepEqual((await headings(page))[0], 'Photo 2 · 1 marker · 1 to choose');
    await page.waitForFunction(() => scanPics.writes === 1);
    // another tab answered "808" and deleted its picture; its list saved (this tab hears a storage event)
    await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ms-scan-pics');
          r.onsuccess = () => {
            const t = r.result.transaction('p', 'readwrite');
            t.objectStore('p').delete('confirm 808');
            t.oncomplete = () => {
              r.result.close();
              res();
            };
          };
        }),
    );
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ms-scan-list' })));
    // this tab's list, still asking, saved: the picture's put back
    await page.evaluate(() => scanRender());
    await page.waitForFunction(() => scanPics.writes === 2, null, { timeout: 5000 });
    const kept = await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('ms-scan-pics');
          r.onsuccess = () => {
            const q = r.result.transaction('p').objectStore('p').get('confirm 808');
            q.onsuccess = () => {
              r.result.close();
              res(!!(q.result && q.result.crop));
            };
          };
        }),
    );
    assert.equal(kept, true, 'the picture is in the database again');
    // Clear list: the next photo is Photo 1
    await page.click('#scClear');
    await page.click('#scClear');
    await idle(page);
    assert.equal(await page.evaluate(() => scanList.length), 0);
    await read(page, ['B111'], false, true);
    assert.equal(await page.evaluate(() => scanList[0].photo), 1, 'numbered 1');
    assert.deepEqual(errors, []);
  });
}
