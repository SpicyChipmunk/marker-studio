// Match a colour.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { extname, join, normalize } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import {
  ENGINE,
  ROOT,
  buildGo,
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
  shot,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { createServer } from 'node:http';
import * as pw from 'playwright';

before(setup);
after(teardown);

// ---- from match.test.mjs ----
// Match a colour: photo (default), hex and live camera; errors that clear, unreadable photos, and its layout at large
// text sizes.
{
  async function openMatch(page) {
    await welcome(page, 'look');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await idle(page);
  }
  const best = (page) =>
    page.evaluate(() => {
      const b = document.querySelector('#matchResult .mbname');
      return b ? b.textContent.trim() : '';
    });
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  // ---- From the fifth review (outside the guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  // a folder: the layout tests save their screenshots there
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  async function shotToDir(page, name) {
    if (!SHOTS) return;
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/g3-${name}.png` });
  }
  // a photo of a page: warm grey paper (as a phone takes white paper under a lamp) on the left, a red and a blue patch
  // on the right; as a PNG file for the file input
  const pagePhoto = (page, paper = '#baafa0') =>
    page
      .evaluate((paper) => {
        const c = document.createElement('canvas');
        c.width = 240;
        c.height = 160;
        const g = c.getContext('2d');
        g.fillStyle = paper;
        g.fillRect(0, 0, 240, 160);
        g.fillStyle = '#b8363c';
        g.fillRect(140, 10, 90, 60);
        g.fillStyle = '#2c4f8c';
        g.fillRect(140, 90, 90, 60);
        return c.toDataURL('image/png').split(',')[1];
      }, paper)
      .then((b) => ({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
  // a tap on the photo, at fractions of its width and height
  async function tapPhoto(page, fx, fy) {
    const r = await page.locator('#matchCanvas').boundingBox();
    await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy);
    await idle(page);
  }
  const hexNow = (page) => page.inputValue('#matchHex');
  // (the canvas is set to 1 pixel first, so its width says when the new photo is drawn; the photo is sized to the space
  // it has, not to the canvas before it)
  const loadPhoto = async (page, paper) => {
    await page.evaluate(() => {
      document.getElementById('matchCanvas').width = 1;
    });
    await page.setInputFiles('#matchFile', await pagePhoto(page, paper));
    await until(page, () => document.getElementById('matchCanvas').width === 240, null, 'the photo drawn');
    await idle(page);
  };
  test('opens on Photo; tapping a photo gives a best match from your markers', async () => {
    const { page, errors } = await openApp();
    await openMatch(page);
    assert.equal(await page.getAttribute('.msrc button.on', 'data-src'), 'photo');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#matchPhotoBtn')]);
    await fc.setFiles(join(ROOT, 'src/assets/sample-jellyfish.png'));
    await idle(page);
    const cb = await page.locator('#matchCanvas').boundingBox();
    await page.mouse.click(cb.x + cb.width * 0.5, cb.y + cb.height * 0.15);
    await idle(page);
    assert.ok((await best(page)).length > 0, 'shows a match');
    await shot(page, 'match-photo');
    assert.deepEqual(errors, []);
  });
  test('a typed hex code finds the closest owned marker', async () => {
    const { page, errors } = await openApp();
    await openMatch(page);
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#2b2c2b');
    await idle(page);
    assert.match(await best(page), /120/, 'near-black matches Ohuhu 120 Black');
    assert.deepEqual(errors, []);
  });
  test(
    'the live camera shows a match and turns off when the dialog closes',
    { skip: ENGINE !== 'chromium' && 'needs Chromium\u2019s fake camera' },
    async () => {
      const { ctx, page, errors } = await openApp();
      await ctx.grantPermissions(['camera']);
      await openMatch(page);
      await page.click('.msrc [data-src="camera"]');
      await page.click('#matchCamBtn');
      await page.waitForFunction(() => {
        const v = document.getElementById('matchVideo');
        return v && v.readyState >= 2;
      });
      await idle(page);
      assert.ok((await best(page)).length > 0, 'live match shown');
      await shot(page, 'match-camera');
      // (the stream is kept from before the close: the close also takes it off the video, so the video can't say whether
      // its tracks were stopped)
      const liveNow = () =>
        page.evaluate(() => window.__camS.getTracks().some((t) => t.readyState === 'live'));
      const keep = () =>
        page.evaluate(() => {
          window.__camS = document.getElementById('matchVideo').srcObject;
        });
      // the camera on again: Match opened if it was closed, on Camera (which starts it), or Start camera
      const restart = async () => {
        if (!(await page.isVisible('#matchOverlay.on'))) await page.click('#mkMatchBtn');
        if (await page.isVisible('#matchCamOff')) await page.click('#matchCamOff');
        else if (!(await page.isVisible('#matchCamWrap'))) await page.click('.msrc [data-src="camera"]');
        await page.waitForFunction(() => {
          const v = document.getElementById('matchVideo');
          return v.srcObject && v.readyState >= 2;
        });
        await keep();
      };
      await keep();
      assert.equal(await liveNow(), true, 'live while shown');
      // released by ✕, Escape, Hex, Photo and the page being put away
      await page.click('#matchClose');
      await idle(page);
      assert.equal(await liveNow(), false, 'camera released by ✕');
      for (const [how, act] of [
        ['Escape', () => page.keyboard.press('Escape')],
        ['Hex', () => page.click('.msrc [data-src="hex"]')],
        ['Photo', () => page.click('.msrc [data-src="photo"]')],
        [
          'the page put away',
          () =>
            page.evaluate(() => {
              Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
              document.dispatchEvent(new Event('visibilitychange'));
              delete document.visibilityState;
            }),
        ],
      ]) {
        await restart();
        await act();
        await idle(page);
        assert.equal(await liveNow(), false, 'camera released by ' + how);
      }
      // a camera that stops by itself (another app took it) says so, and isn't shown as live
      await restart();
      await page.evaluate(() => {
        const t = window.__camS.getVideoTracks()[0];
        t.stop();
        t.dispatchEvent(new Event('ended'));
      });
      await idle(page);
      assert.equal(await page.isVisible('#matchCamWrap'), false, 'no live view of a stopped camera');
      assert.match(await page.textContent('#matchResult'), /The camera stopped/);
      assert.deepEqual(errors, []);
    },
  );
  test('unreadable photos are said by their button, in Match and in Palette › Photo', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    await page.setInputFiles('#matchFile', {
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not a picture'),
    });
    await page.waitForSelector('#matchOverlay .mserr');
    assert.match(await page.textContent('#matchOverlay .mserr'), /Couldn’t read that image/);
    await page.click('#matchClose');
    await page.click('#mPalette');
    await page.click('#harm [data-h="photo"]');
    await page.setInputFiles('#photoFile', {
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not a picture'),
    });
    await page.waitForSelector('#photoWrap .mserr');
    assert.equal(
      await page.evaluate(() =>
        document.getElementById('photoPick').nextElementSibling.classList.contains('mserr'),
      ),
      true,
    );
    assert.deepEqual(errors, []);
  });
  test('Match: a new colour clears a stale hex error; #f00 works; no purple before a colour; one instruction per source', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    assert.equal(await page.textContent('#matchResult'), '', 'no second instruction under the drop zone');
    await page.click('.msrc [data-src="hex"]');
    assert.equal(
      await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')),
      true,
      'an empty swatch before a colour',
    );
    await page.fill('#matchHex', 'zzzzzzz');
    await idle(page);
    assert.ok(await page.isVisible('#matchHexHint'));
    await page.evaluate(() => window.msMatchHex('#3a7bd5'));
    await idle(page);
    assert.equal(await page.isVisible('#matchHexHint'), false, 'hint gone');
    assert.equal(
      await page.evaluate(() => document.getElementById('matchResult').style.opacity),
      '',
      'results not greyed',
    );
    assert.equal(
      await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')),
      false,
    );
    await page.fill('#matchHex', '#f00');
    await page.press('#matchHex', 'Enter');
    await idle(page);
    assert.equal(await page.inputValue('#matchHex'), '#ff0000');
    assert.match(await page.getAttribute('.mcmp span', 'style'), /background: ?(#ff0000|rgb\(255, 0, 0\))/);
    // reopening starts clean
    await page.click('#matchClose');
    await page.click('#mkMatchBtn');
    assert.equal(
      await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')),
      true,
    );
    assert.deepEqual(errors, []);
  });
  for (const [w, scale] of [
    [360, 1.6],
    [390, 1.3],
  ]) {
    test(`Match at ${w}px, ${scale}x: tab names whole, and + To buy under the name`, async () => {
      const { page, errors } = await openAtScale(scale, {
        width: w,
        height: 760,
        storage: onboardedV265({ [KEY]: appState() }),
      });
      await page.click('#mCollection');
      await page.click('#mkMatchBtn');
      await page.evaluate(() => {
        document.getElementById('matchCamBtn').style.display = '';
      });
      const tabs = await page.$$eval('#matchOverlay .msrc button', (l) =>
        l
          .filter((b) => b.getClientRects().length)
          .map((b) => {
            const s = getComputedStyle(b);
            return {
              t: b.textContent,
              lines: Math.round(b.getBoundingClientRect().height / parseFloat(s.lineHeight) - 0.2),
              over: b.scrollWidth > b.clientWidth + 1,
            };
          }),
      );
      assert.ok(
        tabs.some((x) => x.t === 'Hex'),
        'called "Hex"',
      );
      for (const x of tabs) {
        assert.ok(!x.over, x.t + ' fits its tab');
        assert.ok(x.lines <= 2, JSON.stringify(x));
      }
      const tabText = await page.$$eval('#matchOverlay .msrc button', (l) =>
        l
          .filter((b) => b.getClientRects().length)
          .map((b) => {
            const r = document.createRange();
            r.selectNodeContents(b);
            return r.getClientRects().length;
          }),
      );
      assert.ok(
        tabText.every((n) => n === 1),
        'each name on one line: ' + tabText,
      );
      await page.click('#matchOverlay .msrc [data-src="hex"]');
      await page.fill('#matchHex', '#3a7bd5');
      await idle(page);
      const rows = await page.$$eval('#matchResult .mrow.buy', (l) =>
        l.map((r) => {
          const n = r.querySelector('.mnm').getBoundingClientRect(),
            b = r.querySelector('.wishbtn').getBoundingClientRect(),
            h = [...document.querySelectorAll('#matchResult .mlh')].pop().getBoundingClientRect();
          return {
            nw: n.width,
            below: b.top >= n.bottom - 1,
            left: Math.round(b.left - n.left),
            inFlow: r.getBoundingClientRect().top >= h.bottom - 1,
          };
        }),
      );
      assert.ok(rows.length, 'there are markers to buy');
      for (const r of rows) {
        assert.ok(r.inFlow, 'under its heading');
        assert.ok(r.nw >= 80, 'the name has room: ' + JSON.stringify(r));
        assert.ok(r.below && r.left === 0, '+ To buy on its own line under the name: ' + JSON.stringify(r));
      }
      await page.evaluate(() =>
        document.querySelector('#matchResult .mrow.buy').scrollIntoView({ block: 'center' }),
      );
      await idle(page);
      await shotToDir(page, `match-${w}-${scale}x`);
      assert.deepEqual(errors, []);
    });
  }
  // ---- Colour engines round 2 (v270): ranked by eye, words on CIEDE2000, a buy list only when clearly closer, the
  // camera's pointer to a photo, and Tap the white paper ----
  test('Match ranks by eye (CIEDE2000): where plain L*a*b* distance would pick a violet, a blue wins; words and tooltips say ΔE00', async () => {
    const { page, errors } = await openApp();
    await openMatch(page);
    // with Honolulu 120, #005ab4 is 18.2 from V216 Morning Glory and 20.7 from B115 Classic Blue in plain distance, but
    // by eye B115 is much closer (CIEDE2000 4.7 against 14.4)
    const why = await page.evaluate(() => {
      const t = hexToLab('#005ab4'),
        f = (c) => COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === c);
      const d76 = (i) => Math.hypot(t[0] - LAB[i][0], t[1] - LAB[i][1], t[2] - LAB[i][2]);
      return [
        isOwned(f('V216')) && isOwned(f('B115')),
        d76(f('V216')) < d76(f('B115')),
        de2000(t, LAB[f('B115')]) < de2000(t, LAB[f('V216')]) - 5,
      ];
    });
    assert.deepEqual(why, [true, true, true], 'both owned, and the two measures disagree here');
    await page.evaluate(() => window.msMatchHex('#005ab4'));
    await idle(page);
    assert.match(await best(page), /B115/);
    assert.equal(await page.textContent('#matchResult .mbq'), 'Close match', '4.7 is Close (4 to 7)');
    assert.equal(await page.getAttribute('#matchResult .mbq', 'title'), 'ΔE00 4.7');
    const rows = await page.$$eval('#matchResult .mrow', (l) =>
      l.map((r) => {
        const m = /^ΔE00 ([\d.]+) · tap to copy$/.exec(r.title);
        return [r.title, r.querySelector('.mq').textContent, m && matchWord(+m[1])];
      }),
    );
    assert.ok(rows.length && rows.every(([, w, want]) => w === want), JSON.stringify(rows));
    // a marker you own matches itself exactly, its code typed or opened on (Find similar leaves it out, v304: v304-match)
    const own = await page.evaluate(() => COLORS[COLORS.findIndex((m, i) => isOwned(i))].hex);
    await page.evaluate((h) => window.msMatchHex(h), own);
    await idle(page);
    assert.equal(await page.textContent('#matchResult .mbq'), 'Near-exact match');
    assert.deepEqual(errors, []);
  });
  test('Match: markers to buy are listed only when at least 2 ΔE00 closer than your best', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    const buyHead = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#matchResult .mlh')].some(
          (h) => h.textContent === 'Closer ones you could buy',
        ),
      );
    // #cc6666: your best is 5.8 away and R410 5.2: barely closer, so not listed (it was before)
    await page.evaluate(() => window.msMatchHex('#cc6666'));
    await idle(page);
    const near = await page.evaluate(() => {
      const t = hexToLab('#cc6666');
      let bo = 1e9,
        bu = 1e9;
      for (let i = 0; i < LAB.length; i++) {
        const d = de2000(t, LAB[i]);
        if (isOwned(i)) bo = Math.min(bo, d);
        else bu = Math.min(bu, d);
      }
      return { bo, bu };
    });
    assert.ok(near.bu < near.bo && near.bo - near.bu < 2, JSON.stringify(near));
    assert.equal(await buyHead(), false, 'no near-ties to buy');
    assert.equal(await page.locator('#matchResult .mrow.buy').count(), 0);
    // #3a7bd5: B06 is 2.9 against your 5.5: listed, and every row listed is at least 2 closer (v304: B06 is Copic, and
    // nothing of your Ohuhu is clearly closer, so it's listed alone under "Closer in Copic")
    await page.evaluate(() => window.msMatchHex('#3a7bd5'));
    await idle(page);
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('#matchResult .mlh')].some((h) => h.textContent === 'Closer in Copic'),
      ),
      true,
    );
    const gains = await page.evaluate(() => {
      const r = matchNearest(hexToLab('#3a7bd5'));
      return r.buy.concat(r.other).map((o) => r.owned[0].d - o.d);
    });
    assert.ok(gains.length && gains.every((g) => g >= 2), JSON.stringify(gains));
    assert.equal(await page.locator('#matchResult .mrow.buy').count(), gains.length);
    assert.deepEqual(errors, []);
  });
  test('Match › Camera says a still photo gives a truer match', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    await page.evaluate(() => {
      document.getElementById('matchCamBtn').style.display = '';
      navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
    });
    assert.equal(await page.isVisible('#matchCamTip'), false, 'not on the Photo pane');
    await page.click('.msrc [data-src="camera"]');
    assert.equal(
      await page.textContent('#matchCamTip'),
      'For the truest match, take a photo and tap something white.',
    );
    assert.ok(await page.isVisible('#matchCamTip'));
    assert.deepEqual(errors, []);
  });
  test('Match › Photo: a photo after a tall one is drawn as sharp as it was on its own', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    const file = (w, h) =>
      page
        .evaluate(
          ([w, h]) => {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            g.fillStyle = '#3a7bd5';
            g.fillRect(0, 0, w, h);
            return c.toDataURL('image/png').split(',')[1];
          },
          [w, h],
        )
        .then((b) => ({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
    // (the hint under the photo is hidden first: it shows again when the photo is drawn)
    const load = async (w, h) => {
      await page.evaluate(() => {
        document.getElementById('mPhotoHint').style.display = 'none';
      });
      await page.setInputFiles('#matchFile', await file(w, h));
      await until(
        page,
        () => document.getElementById('mPhotoHint').style.display === '',
        null,
        'the photo drawn',
      );
      await idle(page);
      return page.evaluate(() => document.getElementById('matchCanvas').width);
    };
    const alone = await load(2000, 1500);
    await load(400, 3000);
    assert.equal(await load(2000, 1500), alone, 'the same size after a tall photo');
    assert.ok(alone >= 600, 'drawn at the dialog’s width in device pixels: ' + alone);
    assert.deepEqual(errors, []);
  });
  test('Match › Photo: Tap the white paper corrects the lighting; a bad spot says so; ✕ and a new photo take it away; Escape leaves the mode', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    assert.equal(await page.isVisible('#matchPaper'), false, 'no paper button before a photo');
    await loadPhoto(page);
    assert.ok(await page.isVisible('#matchPaper'));
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
    assert.equal(await page.textContent('#matchPaper'), 'Tap something white');
    await tapPhoto(page, 0.77, 0.25);
    const red0 = await hexNow(page);
    assert.equal(red0, '#b8363c', 'the red as photographed');
    // into the mode: the next tap sets the paper, not a sample
    await page.click('#matchPaper');
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'true');
    assert.match(await page.textContent('#matchPaperNote'), /tap something white in the photo/);
    // Escape leaves the mode, not the dialog
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
    assert.ok(await page.isVisible('#matchOverlay'), 'the dialog stays open');
    assert.equal(await page.textContent('#matchPaperNote'), '');
    // the red patch can't be paper: said plainly, and the mode stays for another try
    await page.click('#matchPaper');
    await tapPhoto(page, 0.77, 0.25);
    assert.equal(
      await page.textContent('#matchPaperNote'),
      'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
    );
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'true');
    assert.equal(await page.isVisible('#matchLight'), false);
    assert.equal(await hexNow(page), red0, 'no sample taken');
    // the paper: corrected, and the red sampled before is sampled again through the correction
    await tapPhoto(page, 0.2, 0.5);
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
    assert.ok(await page.isVisible('#matchLight'));
    assert.match(await page.textContent('#matchLight'), /^Lighting corrected/);
    const want = await page.evaluate(() => {
      const f = lightFix([srgbToLin(0xba), srgbToLin(0xaf), srgbToLin(0xa0)]),
        c = lightApply(f, 0xb8, 0x36, 0x3c);
      return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    });
    assert.notEqual(want, red0);
    assert.equal(await hexNow(page), want, 'the red, corrected');
    assert.ok(
      (await page.getAttribute('#matchResult .mcmp', 'title')).includes(want.toUpperCase()),
      'the result shows the corrected colour',
    );
    // the paper now reads as white, and the photo shows the correction
    await tapPhoto(page, 0.2, 0.5);
    const paper = await page.evaluate(() => {
      const l = hexToLab(document.getElementById('matchHex').value);
      return [l[0], Math.hypot(l[1], l[2])];
    });
    assert.ok(paper[0] > 92 && paper[1] < 3, 'paper about white: ' + paper);
    const px = () =>
      page.evaluate(() =>
        [...document.getElementById('matchCanvas').getContext('2d').getImageData(20, 20, 1, 1).data].slice(
          0,
          3,
        ),
      );
    assert.ok(
      (await px()).every((v) => v > 230),
      'the photo shows the paper white: ' + (await px()),
    );
    // ✕ takes it away: the sample and the photo as they were
    await tapPhoto(page, 0.77, 0.25);
    await page.click('#matchLight');
    await idle(page);
    assert.equal(await page.isVisible('#matchLight'), false);
    assert.equal(await hexNow(page), red0);
    assert.deepEqual(await px(), [0xba, 0xaf, 0xa0]);
    // a new photo starts without a correction
    await page.click('#matchPaper');
    await tapPhoto(page, 0.2, 0.5);
    assert.ok(await page.isVisible('#matchLight'));
    await loadPhoto(page, '#c0b8a8');
    assert.equal(await page.isVisible('#matchLight'), false, 'the chip goes with the old photo');
    assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
    await tapPhoto(page, 0.77, 0.25);
    assert.equal(await hexNow(page), red0, 'samples uncorrected');
    // paper that is already white: nothing to correct
    await loadPhoto(page, '#f1f1f1');
    await page.click('#matchPaper');
    await tapPhoto(page, 0.2, 0.5);
    assert.equal(await page.textContent('#matchPaperNote'), 'That already looks white: nothing to correct.');
    assert.equal(await page.isVisible('#matchLight'), false);
    assert.deepEqual(errors, []);
  });
  // ---- v284: a row's rating reads as a label, not a Close button ----
  test('Match: each row’s rating is a muted, regular-weight word after a dot meter filled by closeness', async () => {
    const { page, errors } = await openApp();
    await openMatch(page);
    await page.evaluate(() => window.msMatchHex('#005ab4'));
    await idle(page);
    const rows = await page.$$eval('#matchResult .mrow', (l) =>
      l.map((r) => {
        const q = r.querySelector('.mq'),
          cs = getComputedStyle(q),
          dots = q.querySelector('.mqdots');
        return {
          word: q.textContent,
          weight: +cs.fontWeight,
          colour: cs.color,
          hidden: dots && dots.getAttribute('aria-hidden'),
          dots: dots ? dots.children.length : 0,
          on: dots ? dots.querySelectorAll('.on').length : -1,
          label: r.getAttribute('aria-label'),
        };
      }),
    );
    assert.ok(rows.length > 1, 'some rows');
    const filled = { 'Near-exact': 4, 'Very close': 3, Close: 2, Rough: 1, Loose: 0 };
    const sub = await page.evaluate(() => {
      const s = document.createElement('span');
      s.style.color = 'var(--sub)';
      document.body.appendChild(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    });
    for (const r of rows) {
      assert.ok(r.word in filled, 'the same words: ' + r.word);
      assert.equal(r.weight, 400, 'regular weight');
      assert.equal(r.colour, sub, 'muted, like the marker’s name');
      assert.equal(r.dots, 4);
      assert.equal(r.on, filled[r.word], r.word + ' fills ' + filled[r.word] + ' dots');
      assert.equal(r.hidden, 'true', 'the dots are decoration');
      assert.ok(r.label.includes(', ' + r.word + ', copy'), 'the row still says the word: ' + r.label);
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v299.test.mjs ----
// v299: fixes from the third fresh-eyes review — two of v298's own fixes put right (section edits from an earlier visit
// kept; Undo of a merge after a build gives the ticks back); a split-off coloured part keeps its marker and zone; the
// copy kept as the page goes works for edited guides; changes that couldn't be saved open instead of the older copy;
// Undo for Mark all coloured, Focus's Mark all done and a palette colour re-rolled; an old guide using Copic 0; and
// Scan's paste, typing and Clear list, Match's announcements, Random with nothing to draw.
{
  test('Match: the result isn’t a live region; the best match is said once the colour holds still', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => msMatchHex('#cc3344'));
    await idle(page);
    assert.equal(await page.getAttribute('#matchResult', 'aria-live'), null);
    await page.waitForFunction(() => document.getElementById('matchSay').textContent.length > 0, null, {
      timeout: 3000,
    });
    assert.match(await page.textContent('#matchSay'), / match: /);
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-match.test.mjs ----
// v304, Match a colour. The camera: its colour is read under the ring after a pinch (it came from somewhere else),
// a pinch doesn't move the ring, a zoom is read at once, the live result isn't redrawn under a tap or a keyboard focus
// (taps on + To buy were lost) but can't stay stuck after a right-click or a lost press, a request that never answered
// can be started again, a torch that failed isn't shown on, and a failed copy says so, to screen readers too. The
// photo: read from a patch 6 CSS px across (it was 1 to 4 canvas pixels), not the whole ring (that mixed the outlines
// into small areas), and the ring stays on the photo. To buy: your brands first, another brand's marker only when
// it's clearly closer, under its own heading. Find similar: the marker itself left out, said what it's similar to;
// not on the Colorless Blenders.
{
  const CAM = { skip: ENGINE !== 'chromium' && 'needs Chromium’s canvas camera' };
  // a fake camera: a 640x480 canvas as a captureStream, 8x6 cells of their own colour (window.__grid, changeable), or
  // a gradient (R = x, G = y) with window.__gradient; ± window.__camNoise on every channel
  const fakeCam = () => {
    window.__gum = 0;
    window.__gumMode = 'ok';
    window.__camNoise = 0;
    const md = navigator.mediaDevices || {};
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: md });
    md.getUserMedia = function () {
      window.__gum++;
      if (window.__gumMode === 'never') return new Promise(() => {});
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 480;
      const g = c.getContext('2d');
      if (!window.__grid)
        window.__grid = Array.from({ length: 48 }, (_, k) => {
          g.fillStyle = `hsl(${(k * 137.5) % 360},70%,${35 + (k % 3) * 18}%)`;
          g.fillRect(0, 0, 1, 1);
          return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
        });
      const paint = () => {
        if (window.__gradient) {
          const im = g.createImageData(640, 480);
          for (let y = 0; y < 480; y++)
            for (let x = 0; x < 640; x++)
              im.data.set(
                [Math.round((x * 255) / 639), Math.round((y * 255) / 479), 128, 255],
                (y * 640 + x) * 4,
              );
          g.putImageData(im, 0, 0);
          return;
        }
        for (let y = 0; y < 6; y++)
          for (let x = 0; x < 8; x++) {
            const n = window.__camNoise;
            g.fillStyle = `rgb(${window.__grid[y * 8 + x].map((u) => Math.max(0, Math.min(255, Math.round(u + (n ? (Math.random() * 2 - 1) * n : 0)))))})`;
            g.fillRect(x * 80, y * 80, 80, 80);
          }
      };
      paint();
      setInterval(paint, 50);
      const st = c.captureStream(20),
        t = st.getVideoTracks()[0];
      if (window.__torch) {
        t.getCapabilities = () => ({ torch: true });
        t.applyConstraints = () => Promise.reject(new Error('no torch'));
      }
      return Promise.resolve(st);
    };
  };
  async function camera(opts = {}) {
    const { page, ctx, errors } = await openApp({ width: 820, height: 1180, init: fakeCam });
    if (opts.gradient || opts.torch)
      await page.evaluate((o) => {
        window.__gradient = !!o.gradient;
        window.__torch = !!o.torch;
      }, opts);
    await welcome(page, 'look');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await idle(page);
    await page.click('.msrc [data-src="camera"]');
    await until(
      page,
      () => {
        const v = document.getElementById('matchVideo');
        return v.readyState >= 2 && v.videoWidth > 0;
      },
      null,
      'the camera running',
    );
    return { page, ctx, errors };
  }
  // pointer events on the video at fractions of its box
  const onVideo = (page, evs) =>
    page.evaluate((evs) => {
      const v = document.getElementById('matchVideo'),
        b = document.getElementById('matchVideoBox').getBoundingClientRect();
      for (const [t, id, fx, fy] of evs)
        v.dispatchEvent(
          new PointerEvent(t, {
            pointerId: id,
            button: 0,
            clientX: b.left + b.width * fx,
            clientY: b.top + b.height * fy,
            bubbles: true,
            cancelable: true,
          }),
        );
    }, evs);
  const tapVideo = (page, fx, fy) =>
    onVideo(page, [
      ['pointerdown', 3, fx, fy],
      ['pointerup', 3, fx, fy],
    ]);
  const ringAt = (page) =>
    page.evaluate(() => {
      const r = document.getElementById('matchReticle');
      return [
        Math.round(parseFloat(r.style.left) * 10) / 1000,
        Math.round(parseFloat(r.style.top) * 10) / 1000,
      ];
    });
  const hexNow = (page) => page.inputValue('#matchHex');
  const shown = (page) =>
    page.evaluate(() => {
      const s = document.querySelector('#matchResult .mcmp span');
      return s ? s.style.background : '';
    });
  const rgbOf = (hex) => `rgb(${[1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)).join(', ')})`;
  // on the gradient camera: how far (frame pixels; one step of the gradient is 2.5) the colour shown came from the frame's
  // pixel under the ring
  const ringOff = (page) =>
    page.evaluate(() => {
      const v = document.getElementById('matchVideo'),
        rt = document.getElementById('matchReticle').getBoundingClientRect(),
        vr = v.getBoundingClientRect();
      const px = rt.left + rt.width / 2,
        py = rt.top + rt.height / 2,
        vw = v.videoWidth,
        vh = v.videoHeight,
        sc = Math.max(vr.width / vw, vr.height / vh);
      const u = (px - (vr.left + (vr.width - vw * sc) / 2)) / sc,
        w = (py - (vr.top + (vr.height - vh * sc) / 2)) / sc;
      const hex = document.getElementById('matchHex').value;
      return Math.hypot(
        (parseInt(hex.slice(1, 3), 16) / 255) * 639 - u,
        (parseInt(hex.slice(3, 5), 16) / 255) * 479 - w,
      );
    });
  // a picture made in the page: w x h, fill(x, y) -> [r, g, b]
  async function photo(page, w, h, fill) {
    const b64 = await page.evaluate(
      ([w, h, fill]) => {
        const f = new Function('return ' + fill)(),
          c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d'),
          im = g.createImageData(w, h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) im.data.set([...f(x, y), 255], (y * w + x) * 4);
        g.putImageData(im, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      },
      [w, h, fill.toString()],
    );
    await page.evaluate(() => {
      document.getElementById('matchCanvas').width = 1;
    });
    await page.setInputFiles('#matchFile', {
      name: 'p.png',
      mimeType: 'image/png',
      buffer: Buffer.from(b64, 'base64'),
    });
    await until(page, () => document.getElementById('matchCanvas').width > 1, null, 'the photo shown');
  }
  const tapCanvas = (page, fx, fy) =>
    page.evaluate(
      ([fx, fy]) =>
        new Promise((res) => {
          const cv = document.getElementById('matchCanvas'),
            r = cv.getBoundingClientRect(),
            x = r.left + r.width * fx,
            y = r.top + r.height * fy;
          cv.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 5,
              button: 0,
              clientX: x,
              clientY: y,
              bubbles: true,
              cancelable: true,
            }),
          );
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              cv.dispatchEvent(
                new PointerEvent('pointerup', { pointerId: 5, clientX: x, clientY: y, bubbles: true }),
              );
              res(document.getElementById('matchHex').value);
            }),
          );
        }),
      [fx, fy],
    );
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
    'Ohuhu|RV34',
  ];
  const storage = {
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    [KEY]: JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
    }),
  };
  const heads = (page) => page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));
  test(
    'Camera: a pinch zooms without moving the ring, and the colour is read under the ring at once, live, frozen and after Stop',
    CAM,
    async () => {
      const { page, errors } = await camera({ gradient: true });
      await tapVideo(page, 0.8, 0.7);
      await idle(page);
      assert.ok((await ringOff(page)) < 4, 'before the zoom');
      // two fingers either side of the middle, spread to 2.5x
      await onVideo(page, [
        ['pointerdown', 11, 0.4, 0.5],
        ['pointerdown', 12, 0.6, 0.5],
        ['pointermove', 11, 0.25, 0.5],
        ['pointermove', 12, 0.75, 0.5],
      ]);
      assert.deepEqual(await ringAt(page), [0.8, 0.7], 'the first finger of the pinch didn’t move the ring');
      // (one frame, not the next camera reading: the zoom is read straight away)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert.ok((await ringOff(page)) < 4, 'read under the ring after the zoom: ' + (await ringOff(page)));
      // the finger left after the pinch doesn't drag the ring
      await onVideo(page, [
        ['pointerup', 12, 0.75, 0.5],
        ['pointermove', 11, 0.1, 0.2],
      ]);
      assert.deepEqual(await ringAt(page), [0.8, 0.7]);
      await onVideo(page, [['pointerup', 11, 0.1, 0.2]]);
      await page.click('#matchFreeze');
      await onVideo(page, [
        ['pointerdown', 13, 0.45, 0.5],
        ['pointerdown', 14, 0.55, 0.5],
        ['pointermove', 13, 0.4, 0.5],
        ['pointermove', 14, 0.6, 0.5],
        ['pointerup', 13, 0.4, 0.5],
        ['pointerup', 14, 0.6, 0.5],
      ]);
      await idle(page);
      assert.ok(
        (await ringOff(page)) < 4,
        'frozen: ' +
          JSON.stringify([
            await ringOff(page),
            await ringAt(page),
            await hexNow(page),
            await page.evaluate(() => document.getElementById('matchVideo').style.transform),
          ]),
      );
      await page.click('#matchFreeze');
      await page.click('#matchCamStop');
      await page.click('#matchCamOff');
      await until(
        page,
        () => document.getElementById('matchVideo').readyState >= 2,
        null,
        'the camera again',
      );
      await idle(page);
      assert.ok((await ringOff(page)) < 4, 'after Stop and Start (back to 1x)');
      assert.deepEqual(errors, []);
    },
  );
  test(
    'Camera: taps on + To buy count while live; a right-press or a lost press doesn’t leave the result stuck',
    CAM,
    async () => {
      const { page, errors } = await camera();
      await page.evaluate(() => {
        window.__camNoise = 8;
        navigator.clipboard.writeText = async () => {};
      });
      await tapVideo(page, 0.1, 0.1);
      await idle(page);
      let worked = 0;
      for (let k = 0; k < 8; k++) {
        let b = null;
        for (let t = 0; !b && t < 20; t++)
          b = await page.locator('#matchResult .wishbtn').first().boundingBox();
        const was = await page.evaluate(() => state.wish.length);
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await pause(page, 80 + k * 20, 'a finger held as long as a tap');
        await page.mouse.up();
        await pause(page, 300, 'the click after the tap, and the hold let go');
        if ((await page.evaluate(() => state.wish.length)) !== was) worked++;
      }
      assert.ok(worked >= 7, worked + ' of 8 taps on + To buy worked');
      await page.evaluate(() => {
        window.__camNoise = 0;
      });
      // a right-press (a Mac opens its menu on the press, and the pointerup never comes), then the camera on another colour
      const paint = (rgb) =>
        page.evaluate(
          (rgb) =>
            window.__grid.forEach((c, i, a) => {
              a[i] = rgb;
            }),
          rgb,
        );
      await page.evaluate(() => {
        const r = document.querySelector('#matchResult .mbest');
        r.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 2, buttons: 2 }),
        );
        r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 }));
      });
      await paint([30, 60, 200]);
      await until(
        page,
        () => document.getElementById('matchHex').value === '#1e3cc8',
        null,
        'the camera reading blue',
      );
      await pause(page, 400, 'a few camera readings');
      assert.equal(await shown(page), rgbOf('#1e3cc8'), 'not held by a right-press');
      // a press whose end is lost: held, then let go within 1.5 s
      await page.evaluate(() =>
        document
          .querySelector('#matchResult .mbest')
          .dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0, buttons: 1 }),
          ),
      );
      await paint([200, 60, 30]);
      await pause(page, 600, 'camera readings while pressed');
      assert.notEqual(await hexNow(page), '#1e3cc8', 'the camera reads another colour');
      assert.equal(await shown(page), rgbOf('#1e3cc8'), 'held while pressed');
      await pause(page, 1200, 'past the longest hold');
      // (the swatch and the hex box read in one go, and given a reading to agree: read one after the other, a camera
      // reading in between could leave them a unit apart, v314 on GitHub)
      await until(
        page,
        () => {
          const s = document.querySelector('#matchResult .mcmp span'),
            h = document.getElementById('matchHex').value;
          return (
            !!s &&
            s.style.background === `rgb(${[1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).join(', ')})`
          );
        },
        null,
        'let go without a pointerup',
        2000,
      );
      assert.deepEqual(errors, []);
    },
  );
  test(
    'Camera: a row with the keyboard’s focus stays put while live, and the result catches up when the focus leaves',
    CAM,
    async () => {
      const { page, errors } = await camera();
      await tapVideo(page, 0.1, 0.1);
      await idle(page);
      // Tab to the first row (the keyboard: :focus-visible), the camera still
      await page.focus('#matchResult .mcopy');
      await page.keyboard.press('Tab');
      const focused = () => page.evaluate(() => !!document.activeElement.closest('#matchResult .mrow'));
      assert.ok(await focused(), 'on a row');
      await page.evaluate(() =>
        window.__grid.forEach((c, i, a) => {
          a[i] = [30, 60, 200];
        }),
      );
      await until(
        page,
        () => document.getElementById('matchHex').value === '#1e3cc8',
        null,
        'the camera reading blue',
      );
      await page.evaluate(() => {
        window.__camNoise = 8;
      });
      await pause(page, 1000, 'live readings, with the camera’s flicker, while the row has the focus');
      assert.ok(await focused(), 'the focus is still on the row');
      assert.notEqual(await shown(page), rgbOf('#1e3cc8'), 'not redrawn under the focus');
      await page.evaluate(() => {
        window.__camNoise = 0;
      });
      await page.focus('#matchFreeze');
      await until(
        page,
        () => {
          const h = document.getElementById('matchHex').value;
          return (
            document.querySelector('#matchResult .mcmp span').style.background ===
            `rgb(${[1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).join(', ')})`
          );
        },
        null,
        'the result catching up',
      );
      assert.deepEqual(errors, []);
    },
  );
  test(
    'Camera: Start camera again after a request that never answered; a torch that failed stays off; a failed copy says so, as a status',
    CAM,
    async () => {
      const { page, errors } = await camera({ torch: true });
      await page.click('#matchTorch');
      await idle(page);
      assert.equal(await page.textContent('#matchTorch'), 'Light', 'not "Light on"');
      await page.click('#matchCamStop');
      await page.evaluate(() => {
        window.__gumMode = 'never';
      });
      await page.click('#matchCamOff');
      await page.evaluate(() => {
        window.__gumMode = 'ok';
      });
      await page.click('#matchCamOff');
      await until(
        page,
        () => document.getElementById('matchVideo').readyState >= 2,
        null,
        'the camera after a second Start',
      );
      // a copy that fails
      await page.evaluate(() => {
        navigator.clipboard.writeText = () => Promise.reject(new Error('no'));
        document.execCommand = () => false;
      });
      await page.click('#matchFreeze');
      await page.click('#matchResult .mcopy');
      await until(
        page,
        () => /Couldn’t copy/.test(document.querySelector('#matchOverlay .mcopied').textContent),
        null,
        'the failure said',
      );
      assert.equal(await page.getAttribute('#matchOverlay .mcopied', 'role'), 'status');
      assert.deepEqual(errors, []);
    },
  );
  test('Photo: a noisy colour reads steadier than before, a stripe 7 px wide between outlines is still its own colour, and the ring stays on the photo', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await idle(page);
    // grey 128 with ±60 noise (fixed), 1600 x 1200
    await photo(page, 1600, 1200, (x, y) => {
      const n = (((x * 7919 + y * 104729) ^ (x * y)) % 121) - 60;
      return [128 + n, 128 + n, 128 + n];
    });
    const L = [];
    for (let k = 0; k < 24; k++) {
      const hex = await tapCanvas(page, 0.2 + (k % 6) * 0.12, 0.2 + Math.floor(k / 6) * 0.15);
      L.push(parseInt(hex.slice(1, 3), 16));
    }
    const mean = L.reduce((s, v) => s + v, 0) / L.length,
      sd = Math.sqrt(L.reduce((s, v) => s + (v - mean) ** 2, 0) / L.length);
    // (1.3 now; 2.6 from v303's patch)
    assert.ok(sd < 1.9, 'spread of 24 readings: ' + sd.toFixed(2));
    // stripes: an orange one 7 CSS px wide between 2 px black lines, on white
    const geo = await page.evaluate(() => {
      const cv = document.getElementById('matchCanvas');
      return cv.width / cv.getBoundingClientRect().width;
    });
    const W = 800,
      sw = Math.round(7 * geo * (W / 892)),
      x0 = 400;
    await photo(
      page,
      W,
      600,
      new Function(
        `return (x, y) => (x >= ${x0 - 4} && x < ${x0}) || (x >= ${x0 + sw} && x < ${x0 + sw + 4}) ? [0, 0, 0] : x >= ${x0} && x < ${x0 + sw} ? [240, 140, 60] : [255, 255, 255]`,
      )(),
    );
    assert.equal(await tapCanvas(page, (x0 + sw / 2) / W, 0.5), '#f08c3c', 'the stripe’s own colour');
    // a drag past the photo's edge: the ring at the edge, not over the black beside it
    const out = await page.evaluate(
      () =>
        new Promise((res) => {
          const cv = document.getElementById('matchCanvas'),
            r = cv.getBoundingClientRect();
          cv.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerId: 6,
              button: 0,
              clientX: r.left + 10,
              clientY: r.top + 10,
              bubbles: true,
              cancelable: true,
            }),
          );
          cv.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerId: 6,
              clientX: r.right + 40,
              clientY: r.bottom + 40,
              bubbles: true,
              cancelable: true,
            }),
          );
          cv.dispatchEvent(
            new PointerEvent('pointerup', {
              pointerId: 6,
              clientX: r.right + 40,
              clientY: r.bottom + 40,
              bubbles: true,
            }),
          );
          const g = document.getElementById('matchRing').getBoundingClientRect();
          res({ cx: g.left + g.width / 2, cy: g.top + g.height / 2, right: r.right, bottom: r.bottom });
        }),
    );
    assert.ok(out.cx <= out.right && out.cy <= out.bottom, JSON.stringify(out));
    assert.deepEqual(errors, []);
  });
  test('To buy: an Ohuhu collection sees Ohuhu markers first, and a Copic one only when clearly closer, named in full under its own heading', async () => {
    const { page, errors } = await openApp({ storage });
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    // #005ab4: Copic B37 is 4.6 and Ohuhu B115 4.7: Ohuhu only
    await page.evaluate(() => window.msMatchHex('#005ab4'));
    await idle(page);
    assert.deepEqual(
      (await heads(page)).filter((h) => /Closer/.test(h)),
      ['Closer ones you could buy'],
    );
    assert.ok(
      (await page.$$eval('#matchResult .mrow.buy', (l) => l.map((r) => r.getAttribute('aria-label')))).every(
        (t) => /^Ohuhu /.test(t),
      ),
    );
    // #3a7bd5: only Copic B06 is clearly closer
    await page.evaluate(() => window.msMatchHex('#3a7bd5'));
    await idle(page);
    assert.ok((await heads(page)).includes('Closer in Copic'), JSON.stringify(await heads(page)));
    assert.equal(await page.textContent('#matchResult .mrow.buy .mnm b'), 'Copic B06');
    assert.equal(
      await page.locator('#matchResult .mtag').count(),
      0,
      'no brand letters on an Ohuhu-only result',
    );
    // #000022: both
    await page.evaluate(() => window.msMatchHex('#000022'));
    await idle(page);
    const h = await heads(page);
    assert.ok(
      h.includes('Closer ones you could buy') && h.includes('Closer still in Copic'),
      JSON.stringify(h),
    );
    assert.equal(await page.locator('#matchResult .mrow.buy').count(), 4);
    assert.deepEqual(errors, []);
  });
  test('Find similar leaves the marker out and says what it’s like; a same-colour twin says "Same colour"; none on a Colorless Blender', async () => {
    const { page, errors } = await openApp({ storage });
    const sheet = (brand, code) =>
      page.evaluate(
        ([b, c]) => openMarkerSheet(COLORS.findIndex((m) => m.brand === b && m.code === c)),
        [brand, code],
      );
    await sheet('Ohuhu', 'R014');
    await page.click('#mkSimilar');
    await idle(page);
    assert.equal(await page.textContent('#matchResult .msimh'), 'Similar to Ohuhu R014');
    assert.equal(await page.textContent('#matchResult .mcmp span i'), 'R014');
    assert.doesNotMatch(await page.textContent('#matchResult .mbname'), /^R014 /);
    assert.equal(await page.locator('#matchResult [data-copy^="Ohuhu R014 "]').count(), 0, 'R014 not listed');
    // the same colour typed again is an ordinary match, R014 first
    await page.fill('#matchHex', '');
    await page.fill(
      '#matchHex',
      await page.evaluate(() => COLORS.find((m) => m.code === 'R014' && m.brand === 'Ohuhu').hex),
    );
    await idle(page);
    assert.equal(await page.locator('#matchResult .msimh').count(), 0);
    // RV33 (not owned) made the same colour as RV34 (owned), as they were until v318.29
    await page.click('#matchClose');
    await page.evaluate(() => {
      const i = COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === 'RV33'),
        j = COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === 'RV34');
      COLORS[i].hex = COLORS[j].hex;
      LAB[i] = LAB[j];
    });
    await sheet('Ohuhu', 'RV33');
    await page.click('#mkSimilar');
    await idle(page);
    assert.match(await page.textContent('#matchResult .mbname'), /^RV34 /);
    assert.equal(await page.textContent('#matchResult .mbq'), 'Same colour');
    await page.click('#matchClose');
    for (const brand of ['Copic', 'Ohuhu']) {
      await sheet(brand, '0');
      assert.equal(await page.isVisible('#mkSimilar'), false, brand + ' Colorless Blender');
      await page.click('#mkClose');
    }
    await sheet('Ohuhu', 'R014');
    assert.equal(await page.isVisible('#mkSimilar'), true, 'back on another marker');
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-small.test.mjs ----
// v305 small items: Back up & restore's two Restore buttons say which; Match's hex code part-typed greys the last result
// and, on Enter, says what's expected; Scan with a collection all of one brand starts on that brand, visibly, when no
// brand was ever chosen and Brands I'd buy is that brand too (or automatic), and the choices say which are yours.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v305',
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
  test('Match a colour: a hex code part-typed greys the last result; Enter on 1 to 5 digits says what’s expected', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#40e0d0');
    await idle(page);
    const dim = () => page.$eval('#matchResult', (r) => r.style.opacity);
    const hint = () =>
      page.evaluate(() => {
        const h = document.getElementById('matchHexHint');
        return h && h.style.display !== 'none' ? h.textContent : '';
      });
    assert.equal(await dim(), '');
    for (const part of ['#4', '#40e', '#40e0d']) {
      await page.fill('#matchHex', part);
      await idle(page);
      assert.equal(
        await dim(),
        part === '#40e' ? '' : '0.35',
        part + ': ' + (part === '#40e' ? 'a 3-digit code is a colour' : 'the last result greyed'),
      );
      assert.equal(await hint(), '', part + ': no hint while typing');
    }
    await page.press('#matchHex', 'Enter');
    await idle(page);
    assert.equal(await hint(), 'Enter 6 hex digits, e.g. #3A7BD5', 'five digits, then Enter');
    await page.fill('#matchHex', '#40e0d0');
    await idle(page);
    assert.equal(await hint(), '');
    assert.equal(await dim(), '');
    assert.deepEqual(errors, []);
  });
}

// ---- from v307-markers.test.mjs ----
// v307 (markers branch): Palette › From photo's "Photo looks warm · Balance it" and "Tap something white"; Help › Your
// data for an iPhone or iPad, with whether the browser keeps the data; contrast of the instructions on disabled
// buttons, the Palette's brand letters and the Print sheet's icon; the service worker's page loads; a hex code in the
// Markers search.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  const IPAD =
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  // ---- synthetic photos (drawn here; as test/v307-markers.test.mjs) --------------------------------------------------
  const toLin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const toS = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  function hsl(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12,
        a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }
  function image(w, h, bg) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) d.set([...bg, 255], p * 4);
    const im = { w, h, d };
    im.rect = (x0, y0, x1, y1, c) => {
      for (let y = Math.max(0, y0); y < Math.min(h, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) d.set(c, (y * w + x) * 4);
    };
    im.ellipse = (cx, cy, rx, ry, c) => {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) d.set(c, (y * w + x) * 4);
    };
    im.cast = (k) => {
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; c++) d[i + c] = toS(Math.min(1, toLin(d[i + c]) * k[c]));
      return im;
    };
    return im;
  }
  // a tray of caps with white labels under a dim, warm lamp; the label centres, as fractions of the picture
  const TRAY = { cols: 10, rows: 7 };
  function tray(w, h) {
    const im = image(w, h, [26, 22, 24]),
      cw = w / TRAY.cols,
      rh = h / TRAY.rows,
      r = Math.min(cw, rh) * 0.45;
    for (let j = 0; j < TRAY.rows; j++)
      for (let i = 0; i < TRAY.cols; i++) {
        const cx = (i + 0.5) * cw,
          cy = (j + 0.5) * rh,
          lw = Math.max(1, Math.round(r * 0.7));
        im.ellipse(cx, cy, r, r, hsl(((i + j * 0.3) / TRAY.cols) * 330, 0.6, j % 2 ? 0.62 : 0.4));
        im.rect(
          Math.round(cx - lw / 2),
          Math.round(cy - lw / 2),
          Math.round(cx + lw / 2),
          Math.round(cy + lw / 2),
          [246, 245, 240],
        );
      }
    return im.cast([0.55, 0.41, 0.26]);
  }
  const labelAt = (i, j) => [(i + 0.5) / TRAY.cols, (j + 0.5) / TRAY.rows];
  function sunset(w, h) {
    const im = image(w, h, [30, 25, 40]);
    for (let y = 0; y < h * 0.66; y++) {
      const t = y / h;
      im.rect(
        0,
        y,
        w,
        y + 1,
        [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round),
      );
    }
    im.ellipse(w / 2, h / 2, w * 0.075, w * 0.075, [255, 240, 200]);
    im.ellipse(w / 4, h / 6, w * 0.19, h * 0.07, [250, 214, 190]);
    im.ellipse(w * 0.72, h * 0.22, w * 0.18, h * 0.06, [250, 214, 190]);
    return im.cast([0.55, 0.5, 0.45]);
  }
  // a PNG of it, made by the page's canvas
  async function png(page, im, name) {
    const b64 = await page.evaluate(
      ([w, h, s]) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const bin = atob(s),
          d = new Uint8ClampedArray(bin.length);
        for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
        c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      },
      [im.w, im.h, Buffer.from(im.d.buffer).toString('base64')],
    );
    return { name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  const photoPal = (page) => page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
  async function choose(page, file) {
    const n = await page.evaluate(() => state.palettes.length);
    await page.setInputFiles('#photoFile', file);
    await until(page, (n) => state.palettes.length > n, n, 'the photo palette');
    await idle(page);
  }
  async function tapThumb(page, fx, fy) {
    const r = await page.locator('#photoThumb').boundingBox();
    await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy);
    await idle(page);
  }
  // ---- Help › Your data ------------------------------------------------------------------------------------------------
  // navigator.storage as the browser answers: `kept` from persisted() and persist(); null: none (Safari's engine in tests)
  const storageIs = (kept) => {
    Object.defineProperty(Navigator.prototype, 'storage', {
      configurable: true,
      get: () =>
        kept === null
          ? undefined
          : {
              persisted: () => Promise.resolve(window.__kept === true),
              persist: () => {
                window.__kept = kept;
                return Promise.resolve(kept);
              },
              estimate: () => Promise.resolve({ usage: 0, quota: 1e9 }),
            },
    });
  };
  async function yourData(page) {
    await page.evaluate(() => openHelpSheet());
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await idle(page);
    return (await page.textContent('#helpData .hlpbody')).replace(/\s+/g, ' ');
  }
  // ---- contrast ----------------------------------------------------------------------------------------------------
  // the text's contrast with what is behind it, as seen: colours and opacities composited down from the page
  const contrastOf = (page, sel) =>
    page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      // (v318.23: a colour or fade still running on it, or on what's behind it, finished first: measured part-way
      // through the Print sheet's 250 ms fade-in, WebKit on GitHub read 4.32:1 for an 8.1:1 icon)
      const up = [];
      for (let n = el; n; n = n.parentElement) up.push(n);
      const runs = document
        .getAnimations()
        .filter(
          (a) => up.includes(a.effect && a.effect.target) && isFinite(a.effect.getComputedTiming().endTime),
        );
      await Promise.race([
        Promise.all(runs.map((a) => a.finished.catch(() => {}))),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
      const P = (s) => {
        const m = /rgba?\(([^)]+)\)/.exec(s);
        if (!m) return [0, 0, 0, 0];
        const v = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
      };
      const over = (c, b) => [0, 1, 2].map((k) => c[k] * c[3] + b[k] * (1 - c[3]));
      const mix = (a, b, o) => [0, 1, 2].map((k) => a[k] * o + b[k] * (1 - o));
      const chain = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
      function walk(i, behind) {
        const n = chain[i],
          cs = getComputedStyle(n),
          svg = n instanceof SVGElement,
          inner = over(svg ? [0, 0, 0, 0] : P(cs.backgroundColor), behind);
        let fg, b;
        if (i === chain.length - 1) {
          fg = over(svg && n.tagName !== 'svg' ? P(cs.fill) : P(cs.color), inner);
          b = inner;
        } else [fg, b] = walk(i + 1, inner);
        return [mix(fg, behind, +cs.opacity), mix(b, behind, +cs.opacity)];
      }
      const [fg, bg] = walk(0, [255, 255, 255]);
      const L = (c) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const a = L(fg),
        b = L(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, sel);
  // ---- the service worker ------------------------------------------------------------------------------------------
  // the app served with its service worker allowed (the other tests block it), from a server that can be stopped
  async function swServer() {
    const TYPES = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.webmanifest': 'application/manifest+json',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    };
    const srv = createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      try {
        res
          .writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
          .end(await readFile(file));
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    return {
      url: `http://127.0.0.1:${srv.address().port}/`,
      stop: () =>
        new Promise((r) => {
          srv.closeAllConnections();
          srv.close(r);
        }),
    };
  }
  test('From photo: a warm, dim tray of caps offers "Photo looks warm · Balance it", never by itself; ✕ undoes it; a sunset gets no offer', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.owned = defaultOwned();
      save();
    });
    await page.click('#mPalette');
    await page.click('#harm [data-h="photo"]');
    await idle(page);
    assert.equal((await page.textContent('#photoPaper')).trim(), 'Tap something white');
    await choose(page, await png(page, tray(300, 225), 'tray.png'));
    await page.click('#photoSize [data-n="8"]');
    await idle(page);
    assert.ok(await page.isVisible('#photoWarm'), 'offered');
    assert.equal((await page.textContent('#photoWarm')).trim(), 'Photo looks warm · Balance it');
    assert.equal(await page.evaluate(() => _photoFix), null, 'never automatic');
    const p0 = await photoPal(page),
      src0 = await page.getAttribute('#photoThumb', 'src');
    await page.click('#photoWarm');
    await idle(page);
    assert.equal(await page.isVisible('#photoWarm'), false);
    assert.ok(await page.isVisible('#photoLight'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'photoLight');
    const p1 = await photoPal(page);
    assert.notDeepEqual(p1, p0, 'a new palette');
    assert.deepEqual(
      p1,
      await page.evaluate(() => extractPhotoPalette(_photoImg, 8, _photoFix).markers.slice()),
    );
    // the browns as photographed are gone (Safari's engine shrinks the photo a little differently: which blues and
    // greens come back differs, test/v307-markers checks them)
    const browns = (p) =>
      page.evaluate(
        (p) =>
          p
            .filter((i) => LCH[i][2] >= 30 && LCH[i][2] < 100 && LCH[i][0] < 72 && LCH[i][1] < 45)
            .map((i) => COLORS[i].code),
        p,
      );
    assert.ok((await browns(p0)).length >= 1, 'browns before: ' + (await browns(p0)));
    // (v308: From photo's first pass keeps hues apart, so the tray's dark yellow caps can bring one ochre with them)
    assert.ok((await browns(p1)).length <= 1, 'none after, or one ochre: ' + (await browns(p1)));
    // ✕: as it was, and offered again
    await page.click('#photoLight');
    await idle(page);
    assert.equal(await page.evaluate(() => _photoFix), null);
    assert.deepEqual(await photoPal(page), p0);
    assert.equal(await page.getAttribute('#photoThumb', 'src'), src0);
    assert.ok(await page.isVisible('#photoWarm'), 'offered again');
    // Tap something white: a cap's label is white enough (v306 refused it)
    await page.click('#photoPaper');
    assert.match(await page.textContent('#photoPaperNote'), /tap something white in the photo/i);
    // first a cap (too coloured), then a label
    const [lx, ly] = labelAt(3, 2);
    await tapThumb(page, lx + 0.3 / TRAY.cols, ly);
    assert.equal(
      await page.textContent('#photoPaperNote'),
      'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
    );
    await tapThumb(page, lx, ly);
    assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'false');
    assert.ok(await page.isVisible('#photoLight'), 'corrected from the label');
    assert.equal(await page.isVisible('#photoWarm'), false);
    // a sunset: no offer
    await choose(page, await png(page, sunset(300, 225), 'sunset.png'));
    assert.equal(await page.isVisible('#photoWarm'), false, 'not for a sunset');
    assert.equal(await page.evaluate(() => _photoFix), null);
    // a page under a lamp is still "Paper looks warm · Make it white" (v306)
    const pg = image(300, 180, [250, 250, 248]);
    for (let i = 0; i < 6; i++) pg.ellipse(40 + i * 45, 90, 16, 16, hsl(i * 55, 0.7, 0.5));
    await choose(page, await png(page, pg.cast([0.85, 0.75, 0.6]), 'page.png'));
    assert.equal((await page.textContent('#photoWarm')).trim(), 'Paper looks warm · Make it white');
    assert.deepEqual(errors, []);
  });
  test('Help › Your data: for an iPhone or iPad, the Home Screen app’s own storage, Library › Restore, and whether Safari keeps your data', async () => {
    // Safari agreed to keep it, when the welcome asked
    const a = await openApp({ width: 820, height: 1180, userAgent: IPAD, init: `(${storageIs})(true)` });
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    await idle(a.page);
    assert.equal(
      await a.page.evaluate(() => localStorage.getItem('ms-persisted')),
      '1',
      'the answer is kept',
    );
    await a.page.click('#wcLook');
    await idle(a.page);
    const t = await yourData(a.page);
    // (v307-final: Ben's shorter wording)
    assert.match(
      t,
      /On iPhone and iPad, Safari deletes a site’s data after about seven days without opening it\./,
    );
    assert.match(t, /has its own storage: back up here first, then restore the file there\./);
    // (v308: named as the Library's button is)
    assert.match(t, /Library › Restore brings it back on any iPhone, iPad or computer\./);
    assert.doesNotMatch(t, /On iPhone,|any phone/);
    assert.equal(
      await a.page.textContent('#helpKeep'),
      'Safari has agreed to keep your data on this device.',
    );
    // Safari said no
    const b = await openApp({ width: 820, height: 1180, userAgent: IPAD, init: `(${storageIs})(false)` });
    await haveSet(b.page);
    await b.page.check('#wcSets input[data-i="3"]');
    await b.page.click('#wcAdd');
    await idle(b.page);
    assert.equal(await b.page.evaluate(() => localStorage.getItem('ms-persisted')), '0');
    await b.page.click('#wcLook');
    await idle(b.page);
    await yourData(b.page);
    const careful =
      'Safari may clear your data if space runs low or you don’t open the app for a while, so keep a backup.';
    assert.equal(await b.page.textContent('#helpKeep'), careful);
    // Safari's engine without navigator.storage: the cautious line
    const c = await openApp({
      width: 820,
      height: 1180,
      userAgent: IPAD,
      init: `(${storageIs})(null)`,
      storage: onboarded(),
    });
    await yourData(c.page);
    assert.equal(await c.page.textContent('#helpKeep'), careful);
    // another browser says so in its own name
    const d = await openApp({
      width: 820,
      height: 1180,
      userAgent: CHROME,
      // (kept since an earlier visit: persisted() says so)
      init: `window.__kept = true; (${storageIs})(true)`,
      storage: onboarded({ 'ms-persisted': '1' }),
    });
    await yourData(d.page);
    assert.equal(
      await d.page.textContent('#helpKeep'),
      'Your browser has agreed to keep your data on this device.',
    );
    assert.deepEqual([...a.errors, ...b.errors, ...c.errors, ...d.errors], []);
  });
  test('contrast 4.5:1: "Tick a set above" and Scan’s Add on their disabled buttons (still plainly disabled), the Palette’s brand letters, the Print sheet’s icon', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const look = (sel) =>
      page.evaluate((s) => {
        const c = getComputedStyle(document.querySelector(s));
        return { bg: c.backgroundColor, shadow: c.boxShadow, op: c.opacity };
      }, sel);
    assert.equal(await page.textContent('#wcAdd'), 'Tick a set above');
    const r1 = await contrastOf(page, '#wcAdd');
    assert.ok(r1 >= 4.5, 'Tick a set above: ' + r1.toFixed(2) + ':1 (v306: 2.5)');
    const off = await look('#wcAdd');
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await idle(page);
    const on = await look('#wcAdd');
    assert.notEqual(off.bg, on.bg, 'disabled has its own, paler fill');
    assert.equal(off.shadow, 'none', 'and no glow');
    assert.notEqual(on.shadow, 'none');
    assert.ok((await contrastOf(page, '#wcAdd')) >= 4.5);
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await page.evaluate(() => {
      state.owned = defaultOwned();
      save();
      openScan();
    });
    await idle(page);
    assert.equal(await page.textContent('#scAdd'), 'Add to my collection');
    assert.equal(await page.isDisabled('#scAdd'), true);
    const r2 = await contrastOf(page, '#scAdd');
    assert.ok(r2 >= 4.5, 'Scan’s Add: ' + r2.toFixed(2) + ':1 (v306: 2.4)');
    await page.keyboard.press('Escape');
    await idle(page);
    // the Palette's brand letters (both brands owned)
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page, 1500);
    const r3 = await contrastOf(page, '.readout.rpal .rbt');
    assert.ok(r3 >= 4.5, 'brand letter: ' + r3.toFixed(2) + ':1 (v306: 3.7)');
    // the Print sheet's Numbers icon
    const b = await openApp({ width: 820, height: 1180 });
    await sampleGuide(b.page);
    await b.page.click('.sftabbtn[data-t="share"]');
    await b.page.click('#sfPrint');
    await b.page.waitForSelector('#sfSheet.sfprsh');
    await idle(b.page);
    const r4 = await contrastOf(b.page, '[data-plabels="numbers"] svg text');
    assert.ok(r4 >= 4.5, 'the “3”: ' + r4.toFixed(2) + ':1 (v306: 3.7)');
    assert.deepEqual([...errors, ...b.errors], []);
  });
  // ---- Markers' search: a hex code -----------------------------------------------------------------------------------
  test('Markers search: a hex code offers "Match this colour", which opens Match on it; other searches as before', async () => {
    const { page, errors } = await openApp({ storage: onboarded() });
    await page.evaluate(() => {
      state.owned = defaultOwned();
      save();
      setMode('collection');
    });
    await idle(page);
    for (const [q, hex] of [
      ['#ff0000', '#ff0000'],
      ['3a7bd5', '#3a7bd5'],
      ['f00', '#ff0000'],
    ]) {
      await page.fill('#q', q);
      await idle(page);
      assert.equal(
        await page.textContent('#results .empty'),
        `“${q}” looks like a colour, not a marker code.`,
      );
      assert.equal((await page.textContent('#results .mkhexgo')).trim(), 'Match this colour');
      assert.doesNotMatch(await page.textContent('#results'), /No markers match/);
      await page.click('#results .mkhexgo');
      await page.waitForSelector('#matchOverlay.on');
      await idle(page);
      assert.equal(await page.inputValue('#matchHex'), hex);
      assert.equal(await page.getAttribute('#matchOverlay [data-src="hex"]', 'aria-pressed'), 'true');
      assert.ok(await page.locator('#matchResult .mcmp').count(), 'a match shown');
      await page.click('#matchClose');
      await idle(page);
    }
    // a code that is also hex finds its marker as before (Copic E00)
    await page.click('#ownView [data-v="all"]');
    await page.fill('#q', 'E00');
    await idle(page);
    assert.ok(await page.locator('#results .cell').count());
    assert.equal(await page.locator('#results .mkhexgo').count(), 0);
    await page.fill('#q', 'zzzz');
    await idle(page);
    assert.match(await page.textContent('#results .empty'), /^No markers match “zzzz”/);
    assert.deepEqual(errors, []);
  });
  test('service worker: a page load with a query is the cached page, offline too, and no copy of it is cached', async () => {
    const srv = await swServer(),
      browser = await pw[ENGINE].launch(),
      ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } }),
      page = await ctx.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(srv.url);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await page.goto(srv.url + '?back=1');
      await page.goto(srv.url + 'index.html?from=home');
      await page.waitForFunction(() => !!document.getElementById('appVer'));
      const keys = await page.evaluate(async () => {
        const out = [];
        for (const n of await caches.keys())
          for (const r of await (await caches.open(n)).keys())
            out.push(new URL(r.url).pathname + new URL(r.url).search);
        return out;
      });
      // (v308: the page is kept once, as index.html, and answers / too)
      assert.ok(!keys.includes('/') && keys.includes('/index.html'), String(keys));
      assert.deepEqual(
        keys.filter((k) => k.includes('?')),
        [],
        'no copy per address',
      );
      // offline: any query still opens the app
      await srv.stop();
      await page.goto(srv.url + '?back=2');
      await page.waitForFunction(() => !!document.getElementById('appVer'));
      assert.match(await page.textContent('#appVer'), /^v\d+(\.\d+)?$/);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await srv.stop().catch(() => {});
    }
  });
}

// ---- from v3082.test.mjs ----
// v308.2, from the v308.1 debugging pass: a hex code pasted with a space still matches; the restore's Undo marker
// change leaves the keyboard in the Library.
{
  test('Match: a hex code pasted with spaces round it is read (the box had cut it at 7 characters)', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await idle(page);
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', ' #3a7bd5 ');
    await idle(page);
    assert.notEqual(
      await page.evaluate(() => document.querySelector('#matchResult .mbname')?.textContent.trim() || ''),
      '',
    );
    assert.equal(
      await page.evaluate(() => document.getElementById('matchHexHint')?.textContent || ''),
      '',
      'no complaint',
    );
    assert.deepEqual(errors, []);
  });
  test('Restore, then Undo marker change from its toast: the keyboard is back on the Library’s Restore', async () => {
    const KEY = 'ohuhu-hb320-picker-v3';
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ms-last-ver': 'v308',
        [KEY]: JSON.stringify({
          mode: 'home',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Ohuhu|R014', 'Ohuhu|B08'],
          saved: [],
        }),
      },
    });
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    const bk = {
      v: 3,
      type: 'ms-backup',
      app: 'v308',
      ts: Date.now(),
      owned: ['Copic|E19', 'Copic|G09'],
      wish: [],
      ink: {},
      saved: [],
      guides: [],
    };
    await page.setInputFiles('#guidesFile', {
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bk)),
    });
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="add"]');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 4);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 2, 'put back');
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'guidesRestore',
    );
    assert.deepEqual(errors, []);
  });
}
