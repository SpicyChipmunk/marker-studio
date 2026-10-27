// A finished page, Reveal, Save image, share, the photo of your page.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  buildGo,
  frames,
  haveSet,
  idle,
  letterGuide,
  menuItem,
  openApp,
  openAtScale,
  openMenu,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GEN_PAGE_PHOTO } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from reveal.test.mjs ----
// Reveal: its solid bar, closing with the X or Escape, and starting zoomed out without planning marks.
{
  // ---- From the UX polish pass ----
  const box = (page, sel) => page.locator(sel).boundingBox();
  // Reveal's animation takes about 4.6 s by the clock (3.4 s, a 0.9 s hold, then Close), drawing the whole picture each
  // frame; on GitHub's WebKit frames can come so slowly that 15 s wasn't always enough (run 22). Allow 30 s.
  const REV_WAIT = 30000;
  test('Reveal has a solid bar and closes with the X or Escape', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX', { timeout: REV_WAIT });
    const cv = await box(page, '#sfCanvas'),
      bar = await box(page, '#sfRevealBar');
    assert.ok(cv.y + cv.height <= bar.y + 1, 'the picture stops above the bar');
    assert.ok(!(await page.isVisible('#sfZoomCtl')), 'zoom buttons hidden');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(
      !(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'))),
      'Escape closes Reveal',
    );
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX', { timeout: REV_WAIT });
    await page.click('#sfRevX');
    await idle(page);
    assert.ok(
      !(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'))),
      'the X closes Reveal',
    );
    assert.deepEqual(errors, []);
  });
  // ---- From the third full review (v259) ----
  test('Reveal starts zoomed out and without planning marks', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX', { timeout: REV_WAIT });
    // (the ✕ comes a frame before the first frame of the reveal is drawn: Safari's engine can be measured in between)
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))),
        ),
    );
    const r = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d'),
        d = g.getImageData(0, 0, c.width, c.height).data;
      let white = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) white++;
      return { zoom: __mstest.zoom, white };
    });
    assert.equal(r.zoom, 1);
    assert.ok(r.white < 50, `no white anchor rings (${r.white})`);
    assert.deepEqual(errors, []);
  });
}

// ---- from saved-image-size.test.mjs ----
// v318 review: Save image with its codes, for a narrow picture (the sample is 568 px wide), is saved up to twice its
// size, about 1100 px wide, its codes and key drawn at that size (sharp) and the same codes placed as before; a picture
// that wide already (a page of the person's own, 1600 px or more on its long side) is saved as it was; the picture
// without its codes (its card) is unchanged.
{
  // the saved image's size, and each code's text, where, and its size on the image as saved
  const saved = (page, noCodes = false) =>
    page.evaluate((noCodes) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t, x, y) {
        const m = this.getTransform();
        log.push({
          t: String(t),
          y: y * m.d + m.f,
          fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) * m.a,
        });
        return of.apply(this, arguments);
      };
      let c;
      try {
        c = __mstest.buildExportCanvas(false, noCodes);
      } finally {
        P.fillText = of;
      }
      const codes = new Set(Object.values(__mstest.assignData.assign).map((m) => m.code));
      return {
        w: c.width,
        h: c.height,
        W: __mstest.W,
        H: __mstest.H,
        placed: __mstest.exPlaced ? __mstest.exPlaced.boxes.length : 0,
        dropped: __mstest.exPlaced ? __mstest.exPlaced.dropped.length : 0,
        // (on the picture, not in the key under it)
        codes: log.filter((e) => codes.has(e.t) && e.y < (__mstest.H * c.width) / __mstest.W),
      };
    }, noCodes);
  test('the sample saved with its codes is about 1100 px wide, its codes as placed before and none under 10 px', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const r = await saved(page);
    assert.equal(r.W, 568, 'the sample is 568 px wide');
    assert.ok(r.w >= 1090 && r.w <= 1136, `saved ${r.w} px wide (568 before)`);
    const k = r.w / r.W;
    assert.ok(Math.abs(r.h / k - Math.round(r.h / k)) < 1, 'the whole image, key and all, at the same scale');
    // (the same placing as at its own size: v304-export's checks of it still hold)
    assert.ok(r.placed > 100 && r.dropped > 0, `${r.placed} codes placed, ${r.dropped} dots`);
    assert.ok(
      r.codes.every((e) => e.fs >= 10 * k - 0.01),
      'each code at least 10 picture px, drawn at the larger size',
    );
    // the picture without codes is the card, as before
    const off = await saved(page, true);
    assert.equal(off.w, 568, 'without codes: the picture at its own size, for its card');
    assert.deepEqual(errors, []);
  });
  test('a page of the person’s own, wide enough already, is saved at its own size', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    const r = await saved(page);
    assert.ok(r.W >= 1100, `the page is ${r.W} px wide`);
    assert.equal(r.w, r.W, 'saved at its own width');
    assert.deepEqual(errors, []);
  });
}

// ---- from share-export.test.mjs ----
// Handing files over (Share › Guide file, image, PDF): the share sheet on a phone, with a Share button when the tap has
// expired and a download when sharing fails; a download on a computer.
{
  // ---- From the third full review (v259) ----
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  // ---- From the fifth review’s leftovers ----
  const stubShare = (fail) => {
    window.__shares = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (d) => !!(d && d.files && d.files.length),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (d) => {
        window.__shares.push(d.files[0].name);
        const n = window.__shares.length;
        return fail === 'notallowed' && n === 1
          ? Promise.reject(new DOMException('no gesture', 'NotAllowedError'))
          : fail === 'data'
            ? Promise.reject(new DOMException('x', 'DataError'))
            : Promise.resolve();
      },
    });
  };
  const shareTab = (page) => page.click('.sftabbtn[data-t="share"]');
  test('when the phone refuses to share (the tap has expired), the PDF is offered with a Share button, not lost', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE });
    await sampleGuide(page);
    await page.evaluate(() => {
      window.__shares = 0;
      navigator.canShare = () => true;
      navigator.share = () => {
        window.__shares++;
        return window.__shares === 1
          ? Promise.reject(new DOMException('x', 'NotAllowedError'))
          : Promise.resolve();
      };
    });
    // from inside the Print sheet
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.click('#sfSheet #sfPDF');
    await page.waitForSelector('#toastAct', { timeout: 20000 });
    assert.match(await page.textContent('#msToast'), /PDF is ready/);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__shares), 2, 'shared from the new tap');
    // any other failure downloads it instead
    await page.evaluate(() => {
      navigator.share = () => Promise.reject(new DOMException('x', 'DataError'));
    });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    assert.match(dl.suggestedFilename(), /\.pdf$/);
    assert.deepEqual(errors, []);
  });
  test('Share › Guide file on a phone: a Share button when the tap has expired, a download when sharing fails', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE });
    await sampleGuide(page);
    await page.evaluate(stubShare, 'notallowed');
    await shareTab(page);
    await page.click('#sfShareGuide');
    await page.waitForSelector('#msToast.on #toastAct');
    assert.match(await page.textContent('#msToast'), /Your guide file is ready\./);
    await page.click('#toastAct');
    await page.waitForFunction(() => window.__shares.length === 2);
    assert.match((await page.evaluate(() => window.__shares))[1], /\.msguide\.json$/);
    await page.evaluate(stubShare, 'data');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
    assert.match(dl.suggestedFilename(), /\.msguide\.json$/);
    await page.waitForFunction(() => /Guide file downloaded/.test(document.body.textContent));
    assert.deepEqual(errors, []);
  });
  test('on a computer the guide file, image and PDF download even where the browser could share them', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(stubShare, '');
    await shareTab(page);
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
    assert.match(dl.suggestedFilename(), /\.msguide\.json$/);
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfExport')]);
    assert.match(dl.suggestedFilename(), /\.png$/);
    await page.click('#sfPrint');
    assert.equal(await page.textContent('#sfPDF'), 'Download PDF', 'the button says what it does');
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    assert.match(dl.suggestedFilename(), /\.pdf$/);
    assert.deepEqual(await page.evaluate(() => window.__shares), [], 'nothing went to a share sheet');
    assert.deepEqual(errors, []);
  });
  test('handOver: the share sheet on a phone (cancel is left alone), a download on a computer or when asked', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE });
    await page.evaluate(stubShare, '');
    const go = (o) => page.evaluate((o) => handOver(new Blob(['x'], { type: 'text/plain' }), 'x.txt', o), o);
    assert.equal(await go({ title: 'X' }), 'share');
    const [dl, r] = await Promise.all([page.waitForEvent('download'), go({ preferShare: false })]);
    assert.equal(r, 'download');
    assert.equal(dl.suggestedFilename(), 'x.txt');
    const refuse = (name) =>
      page.evaluate((name) => {
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: () => Promise.reject(new DOMException('x', name)),
        });
      }, name);
    await refuse('AbortError');
    assert.equal(await go({ title: 'X' }), 'cancel');
    // no Share button offered when retry is off: it downloads
    await refuse('NotAllowedError');
    const [dl2, r2] = await Promise.all([page.waitForEvent('download'), go({ title: 'X', retry: false })]);
    assert.equal(r2, 'download');
    assert.ok(dl2);
    assert.deepEqual(errors, []);
  });
}

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  test('Reveal: the keyboard goes into its bar and back to Reveal & share; one Escape closes it, even with a tip left open', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => __mstest.assignData.order[0]);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.equal(
      await page.evaluate(() => {
        const t = document.getElementById('sfTip');
        return !!t && t.offsetParent !== null;
      }),
      false,
      'the tip goes with the tab',
    );
    await page.focus('#sfReveal');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#revShare', { timeout: 15000 });
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'revShare');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
      false,
      'closed with one Escape',
    );
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfReveal');
    assert.deepEqual(errors, []);
  });
}

// ---- from v287-review.test.mjs ----
// v287's fresh-eyes review: changes kept as the page goes leave the Library row alone until they're in the guide, and
// never a colour only tried in the picker; a new guide saves straight after Build; zooming doesn't paint the plan over
// Edit sections, nor does a visit elsewhere after Reveal; a Temperature with no markers stays as it was; Focus mode
// stamps the start date and hands back its marker's row; very wide pictures keep their shape; the tool row stays
// above the bar on a tiny screen with large text; clearer no-markers words; guide files with no markers refused;
// Blend plan groups and the ink choice for the keyboard and screen readers.
{
  const canvasSig = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
      return h;
    });
  test('zooming in Edit sections, and visiting Markers after Reveal, never paint the plan over the sections', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // Reveal once
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX', { timeout: 15000 });
    await page.click('#sfRevX');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    const a = await canvasSig(page);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await page.waitForTimeout(400);
    assert.equal(await canvasSig(page), a, 'zoomed: still the sections');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await page.waitForTimeout(300);
    assert.equal(await canvasSig(page), a, 'after Markers: still the sections');
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-show.test.mjs ----
// v305 (showing it off): Reveal ends with the piece on its paper, its title and markers, and Share sends that layout as
// a 1080 × 1350 card made while it played; the first Build of a new picture blooms; Save image's codes go automatic
// (and without them the picture is framed as the card is); the saved image's key goes by colour family and the PDF
// key's NO. looks like the page's numbers; Colour along's list can go lightest first, in rainbow order or by brand;
// ticks go from the art after a second with the codes on; no tick badges in the Owned view; Palette opens on a
// preview; the PDF's close-ups lighter.
{
  // Reveal takes about 4.6 s by the clock, much longer in WebKit on a slow machine (reveal.test.mjs)
  const REV = 30000;
  const finishAll = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.checkComplete();
      t.updateProgress();
      t.renderGuide();
    });
  async function reveal(page) {
    await page.click('#sfReveal');
    await page.waitForSelector('.sfshow', { timeout: REV });
  }
  const showCount = (page) => page.evaluate(() => document.querySelectorAll('.sfshow').length);
  // a PNG's size from its header
  const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
  // every text the card draws, with its font and where it reaches
  const cardTexts = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t, x, y) {
        const w = this.measureText(t).width,
          al = this.textAlign;
        log.push({
          t: String(t),
          font: this.font,
          l: al === 'center' ? x - w / 2 : al === 'right' ? x - w : x,
          r: al === 'center' ? x + w / 2 : al === 'right' ? x : x + w,
        });
        return of.apply(this, arguments);
      };
      let c;
      try {
        c = __mstest.buildShowCard();
      } finally {
        P.fillText = of;
      }
      return {
        log,
        w: c.width,
        h: c.height,
        codes: [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.code))],
      };
    });
  // ---- W2: the first Build's bloom ----
  async function pickLetter(page) {
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  const bloomOn = () => {
    window.__MS_BLOOM = true;
  };
  const count = (page) => page.evaluate(() => __mstest.bloomCount);
  // ---- W8 ----
  // pixels near a section's label in the ✓'s green (#3f7d4e)
  const green = (page, l) =>
    page.evaluate((l) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        q = t.labelPos(l),
        r = 24,
        d = c.getContext('2d').getImageData(Math.max(0, q.x - r), Math.max(0, q.y - r), 2 * r, 2 * r).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (Math.abs(d[i] - 63) < 14 && Math.abs(d[i + 1] - 125) < 14 && Math.abs(d[i + 2] - 78) < 14) n++;
      return n;
    }, l);
  test('Reveal ends with the piece on its paper; Replay, Escape and the ✕ take it away', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await finishAll(page);
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await reveal(page);
    assert.match(
      await page.getAttribute('.sfshow', 'aria-label'),
      /^Sample jellyfish\. \d+ sections · 16 Ohuhu markers · finished \d{1,2} \w{3,4} \d{4}$/,
    );
    await page.waitForSelector('.sfshow .sfsh-cap[data-drawn]');
    await page.waitForSelector('#revReplay', { timeout: REV });
    // the art sits inside the screen above the bar, the caption under it
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      return { p: q('.sfsh-paper'), c: q('.sfsh-cap'), bar: q('#sfRevealBar') };
    });
    assert.ok(
      r.p.top >= 0 && r.p.bottom <= r.c.top && r.c.bottom <= r.bar.top + 1,
      'paper, then caption, above the bar',
    );
    await page.click('#revReplay');
    assert.equal(await showCount(page), 0, 'Replay takes it away');
    await page.waitForSelector('.sfshow', { timeout: REV });
    await page.waitForSelector('#revReplay', { timeout: REV });
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await showCount(page), 0, 'Escape takes it away');
    await reveal(page);
    await page.click('#sfRevX');
    await idle(page);
    assert.equal(await showCount(page), 0, 'the ✕ takes it away');
    assert.deepEqual(errors, []);
  });
  test('Share sends the card made while Reveal played (1080 × 1350), at once', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await reveal(page);
    await until(page, () => !!__mstest.showBlob, null, 'the card made while it plays', REV);
    const wh = await page.evaluate(async () => {
      const b = await createImageBitmap(__mstest.showBlob);
      return [b.width, b.height];
    });
    assert.deepEqual(wh, [1080, 1350]);
    await page.waitForSelector('#revShare', { timeout: REV });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#revShare')]);
    // (v328 review: named for the guide)
    assert.match(dl.suggestedFilename(), /^[a-z0-9-]+-card\.png$/);
    assert.notEqual(dl.suggestedFilename(), 'marker-studio-card.png');
    assert.deepEqual(pngSize(await readFile(await dl.path())), [1080, 1350]);
    // not finished: nothing about finishing
    assert.doesNotMatch(await page.getAttribute('.sfshow', 'aria-label'), /finished/);
    assert.deepEqual(errors, []);
  });
  test('the card: 1080 × 1350, a long title kept inside it on two lines at most, codes only up to 16 markers', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    let c = await cardTexts(page);
    assert.deepEqual([c.w, c.h], [1080, 1350]);
    const shown = c.log.filter((e) => c.codes.includes(e.t));
    assert.equal(shown.length, c.codes.length, '16 markers: each code under the ribbon');
    await page.evaluate(() => {
      __mstest.curName =
        'The great big spiral mandala with the jellyfish and the octopus and all their friends under the sea';
    });
    c = await cardTexts(page);
    const title = c.log.filter((e) => /Fraunces/.test(e.font) && !/Made with/.test(e.t));
    assert.ok(title.length >= 1 && title.length <= 2, 'one or two lines: ' + title.length);
    for (const e of title)
      assert.ok(e.l >= 0 && e.r <= 1080, `"${e.t}" inside the card (${Math.round(e.l)}…${Math.round(e.r)})`);
    if (title.length === 2) assert.match(title[1].t, /…$/);
    // past 16 markers: the ribbon alone
    await page.evaluate(() => {
      const t = __mstest,
        a = t.assignData.assign,
        ids = Object.keys(a),
        base = a[ids[0]];
      const cs = COLORS.filter((c) => c.brand === 'Ohuhu');
      ids.forEach((l, i) => {
        if (i < 40) {
          const c = cs[(i * 5) % cs.length];
          a[l] = Object.assign({}, base, {
            mkey: c.brand + '|' + c.code,
            hex: c.hex,
            code: c.code,
            name: c.name,
            brand: c.brand,
            lab: null,
          });
        }
      });
    });
    c = await cardTexts(page);
    assert.ok(c.codes.length > 16);
    assert.equal(c.log.filter((e) => c.codes.includes(e.t)).length, 0, 'no codes row past 16 markers');
    assert.equal(await page.evaluate(() => __mstest.showModel().bands.length), 24, 'the ribbon in 24 bands');
    // a wide screen: the codes as chips in two rows (16 markers again)
    await page.evaluate(() => __mstest.reassign());
    const rows = await page.evaluate(() => {
      const g = document.createElement('canvas').getContext('2d'),
        M = __mstest.showModel();
      return M.codes ? __mstest.showLayout(g, M, 1180, 744, { top: 64 }).codes.rows : -1;
    });
    assert.equal(rows, 2);
    assert.deepEqual(errors, []);
  });
  test('with reduced motion Reveal ends on the finished view, nothing moving', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await reveal(page);
    const r = await page.evaluate(() => {
      const el = document.querySelector('.sfshow');
      return { still: el.classList.contains('still'), n: el.getAnimations({ subtree: true }).length };
    });
    assert.deepEqual(r, { still: true, n: 0 });
    await page.waitForSelector('.sfshow .sfsh-cap[data-drawn]');
    assert.deepEqual(errors, []);
  });
  test('the first Build of a new picture blooms, once; a tap during it ends it and still picks the section', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, init: bloomOn });
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.bloomOn, null, { timeout: 60000 });
    assert.equal(await count(page), 1);
    // the picture's own pixels are the guide's all along, with its codes, under the bloom
    assert.ok(await page.evaluate(() => !!document.querySelector('.sfpic .sfbloom')));
    const l = await page.evaluate(
      () =>
        __mstest.assignData.order.slice().sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[1],
    );
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForSelector('.sftip');
    assert.equal(await page.evaluate(() => __mstest.bloomOn), false, 'the tap ended it');
    await idle(page);
    // (its quick fade-out can still be running when idle returns on a slow runner: wait for it, v307)
    await page
      .waitForFunction(() => !document.querySelector('.sfbloom'), null, { timeout: 5000 })
      .catch(() => {});
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('.sfbloom').length),
      0,
      'and it has gone',
    );
    // Build again after an edit to the sections: once more (v320, Ben's D6b: the plan on the changed sections blooms
    // in); a guide opened again: none
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      t.mergeCellsSnap(o[0], o[1]);
      t.render();
    });
    await buildGo(page);
    await idle(page);
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    assert.equal(await count(page), 2, 'on Build after the sections were changed');
    await page.evaluate(() => {
      const t = __mstest;
      t.openDesignObj(Object.assign({}, t.currentDesignObj().payload, { name: 'Again' }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Again');
    await idle(page);
    assert.equal(await count(page), 2, 'not on opening a guide');
    assert.deepEqual(errors, []);
  });
  test('no bloom with reduced motion, nor in the tests unless asked for, nor for the sample', async () => {
    let { page, errors } = await openApp({ init: bloomOn });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await count(page), 0, 'reduced motion');
    assert.deepEqual(errors, []);
    ({ page, errors } = await openApp());
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await count(page), 0, 'the tests');
    ({ page, errors } = await openApp({ init: bloomOn }));
    await sampleGuide(page);
    await idle(page);
    assert.equal(await count(page), 0, 'the sample');
    assert.deepEqual(errors, []);
  });
  test('a device too slow for the bloom: it ends at once, the guide shows as usual, and it stays off there (v308: until the next launch)', async () => {
    // (setting up "took too long": any time at all counts as too long here)
    let { page, errors } = await openApp({
      init: () => {
        window.__MS_BLOOM = true;
        window.__MS_BLOOM_PREP_MAX = 1e-9;
      },
    });
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.bloomOn), false);
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('.sfbloom').length),
      0,
      'no overlay left',
    );
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ms-bloom-slow')), '1', 'remembered');
    assert.deepEqual(errors, []);
    // slow first frames do the same
    ({ page, errors } = await openApp({
      init: () => {
        window.__MS_BLOOM = true;
        window.__MS_BLOOM_FRAME_MAX = 1e-9;
      },
    }));
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await page.waitForFunction(() => !__mstest.bloomOn && __mstest.bloomCount === 1, null, {
      timeout: 10000,
    });
    assert.ok(
      (await page.evaluate(() => __mstest.bloomLast.frames.length)) <= 6,
      'ended after its first frames',
    );
    assert.equal(await page.evaluate(() => sessionStorage.getItem('ms-bloom-slow')), '1');
    assert.deepEqual(errors, []);
    // and once remembered, a new picture doesn't bloom (in the same launch)
    ({ page, errors } = await openApp({
      init: () => {
        window.__MS_BLOOM = true;
        sessionStorage.setItem('ms-bloom-slow', '1');
      },
    }));
    await welcome(page, 'look');
    await idle(page);
    await pickLetter(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await count(page), 0, 'remembered as too slow');
    assert.deepEqual(errors, []);
  });
  // ---- W4: Save image's codes ----
  test('Save image: codes on until the page is finished, then the picture framed as the card is; a choice of yours stays', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.equal(await page.isChecked('#sfExCodes'), true, 'codes while there is colouring to do');
    // the box follows the ticks while it's on screen
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.updateProgress();
    });
    assert.equal(await page.isChecked('#sfExCodes'), false, 'every section ticked: off');
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 0;
      t.updateProgress();
    });
    assert.equal(await page.isChecked('#sfExCodes'), true);
    // finished by colouring along
    await page.click('#sfColor');
    await idle(page);
    await finishAll(page);
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.equal(await page.isChecked('#sfExCodes'), false, 'finished: off');
    assert.equal(await page.evaluate(() => __mstest.exCodes), null, 'still automatic');
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#sfExport'),
    ]);
    // (v309.2: named after the guide, as its PDF is)
    const slug = await page.evaluate(() =>
      fileSlug(document.getElementById('sfGTitle').textContent.trim(), 'colour-guide', 80).toLowerCase(),
    );
    assert.ok(slug && slug !== 'colour-guide', slug);
    assert.equal(dl.suggestedFilename(), slug + '-picture.png');
    assert.deepEqual(
      pngSize(await readFile(await dl.path())),
      [2160, 2700],
      'framed as the card, at twice its size',
    );
    // your tick stays through finishing
    await page.check('#sfExCodes');
    assert.equal(await page.evaluate(() => __mstest.exCodes), true);
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 0;
      t.updateProgress();
      t.colored[t.assignData.order[0]] = 1;
      t.updateProgress();
    });
    assert.equal(await page.isChecked('#sfExCodes'), true, 'your choice stands');
    const [dl2] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#sfExport'),
    ]);
    assert.equal(dl2.suggestedFilename(), slug + '.png', 'the guide with its codes and key');
    assert.deepEqual(errors, []);
  });
  // ---- U8 ----
  test('the saved image’s key goes by colour family, lightest first in each, as the PDF’s', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [],
        t = __mstest;
      P.fillText = function (s, x, y) {
        log.push({ s: String(s), y });
        return of.apply(this, arguments);
      };
      try {
        t.buildExportCanvas(false, true);
      } finally {
        P.fillText = of;
      }
      const seen = {},
        mk = [];
      t.assignData.order.forEach((l) => {
        const m = t.assignData.assign[l];
        if (!seen[m.mkey]) {
          seen[m.mkey] = 1;
          mk.push(m);
        }
      });
      const want = mk
        .slice()
        .sort(t.famCmp)
        .map((m) => m.code);
      // (each key line: its code, then its name)
      const got = log
        .filter((e) => e.y > t.H)
        .map((e) => e.s.split(/\s+/).find((w) => want.includes(w)))
        .filter(Boolean);
      return { want, got };
    });
    assert.deepEqual(r.got, r.want);
    assert.deepEqual(errors, []);
  });
  // (v308: with Numbers, NO. is the one column, the colouring order: no ORDER "5th" beside it)
  test('the PDF key: NO. drawn as the page’s numbers are, and no ORDER beside it', async () => {
    // (v328: the Labelled page, whose page 1 has the labels; Page to colour's has none)
    const { page, errors } = await openApp({
      storage: { 'ms-pdf-labels': 'numbers', 'ms-pdf-what': 'page' },
    });
    await sampleGuide(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        os = P.strokeText,
        log = [];
      P.fillText = function (t, x, y) {
        log.push({
          cv: this.canvas,
          k: 'f',
          t: String(t),
          fill: this.fillStyle,
          font: this.font,
          al: this.textAlign,
        });
        return of.apply(this, arguments);
      };
      P.strokeText = function (t, x, y) {
        log.push({ cv: this.canvas, k: 's', t: String(t), stroke: this.strokeStyle, al: this.textAlign });
        return os.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = of;
        P.strokeText = os;
      }
      const pg = (c) => cvs.indexOf(c),
        keyP = pg(log.find((e) => e.t === 'Colour key').cv);
      const onArt = log.filter(
        (e) => pg(e.cv) === 0 && e.k === 'f' && /^\d+$/.test(e.t) && e.al === 'center',
      );
      const keyNo = log.filter(
        (e) =>
          pg(e.cv) >= keyP && e.k === 'f' && /^\d+$/.test(e.t) && e.al === 'right' && e.fill !== '#777777',
      );
      const keyNoS = log.filter(
        (e) => pg(e.cv) >= keyP && e.k === 's' && /^\d+$/.test(e.t) && e.al === 'right',
      );
      const ord = log.filter((e) => pg(e.cv) >= keyP && /^\d+(st|nd|rd|th)$/.test(e.t));
      const w = (f) => f.split(' ')[0];
      return {
        art: onArt.length ? { fill: onArt[0].fill, w: w(onArt[0].font) } : null,
        key: keyNo.map((e) => ({ fill: e.fill, w: w(e.font) })),
        stroked: keyNoS.length,
        strokes: [...new Set(keyNoS.map((e) => e.stroke))],
        ord: [...new Set(ord.map((e) => e.fill))],
        n: ord.length,
      };
    });
    assert.ok(r.art, 'numbers on the colouring page');
    assert.ok(r.key.length >= 10, 'a NO. for each row');
    for (const k of r.key) assert.deepEqual(k, r.art, 'NO. looks as the page’s numbers do');
    assert.equal(r.stroked, r.key.length, 'with their white edge');
    assert.deepEqual(r.strokes, ['#ffffff']);
    assert.deepEqual(r.ord, [], 'no ORDER column');
    assert.deepEqual(errors, []);
  });
  test('Colour along’s list: Lightest first, Rainbow or By brand (kept); Focus mode and Home’s Continue keep lightest first', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const rows = () => page.$$eval('#sfAlist .sfarow', (r) => r.map((x) => x.dataset.k));
    const light = await rows();
    assert.deepEqual(light, await page.evaluate(() => __mstest.alongList().map((e) => e.key)));
    assert.equal(await page.getAttribute('#sfAlSort [data-v="light"]', 'aria-pressed'), 'true');
    const ord0 = await page.evaluate(() => {
      __mstest.buildFocusOrder();
      return __mstest.focusOrd.slice();
    });
    await page.click('#sfAlSort [data-v="rainbow"]');
    await idle(page);
    const rb = await rows();
    assert.deepEqual(rb, await page.evaluate(() => __mstest.alongList('rainbow').map((e) => e.key)));
    assert.notDeepEqual(rb, light);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-along-sort')), 'rainbow');
    assert.deepEqual(
      await page.evaluate(() => {
        __mstest.buildFocusOrder();
        return __mstest.focusOrd.slice();
      }),
      ord0,
      'focus mode as before',
    );
    await page.evaluate(() => __mstest.alongResume());
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlKey), light[0], 'Continue: the lightest');
    await page.click('#sfAlSort [data-v="brand"]');
    await idle(page);
    assert.deepEqual(await rows(), await page.evaluate(() => __mstest.alongList('brand').map((e) => e.key)));
    // kept: Colour along again
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.getAttribute('#sfAlSort [data-v="brand"]', 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('Colour along: with the codes on a ✓ shows for about a second, then goes; with them off it stays', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const big = await page.evaluate(() =>
      __mstest.assignData.order
        .slice()
        .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)
        .slice(0, 3),
    );
    await scrollTop(page);
    let p = await sectionPoint(page, big[0]);
    // (v307.1: the ✓'s colour as it's drawn, however strongly, not read off the canvas: v307's ✓ fades out, and a slow
    // machine could read it part way through the fade, no longer the green looked for)
    await page.evaluate((l) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        q = __mstest.labelPos(l);
      window.__tk = [];
      window.__tkOff = () => {
        P.fillText = of;
      };
      P.fillText = function (t, x, y) {
        if (t === '✓' && Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5)
          window.__tk.push([this.fillStyle, this.globalAlpha]);
        return of.apply(this, arguments);
      };
    }, big[0]);
    await page.mouse.click(p.x, p.y);
    await until(page, (l) => __mstest.colored[l] === 1, big[0], 'ticked');
    assert.equal(await page.evaluate((l) => __mstest.tkFresh(l), big[0]), true, 'its ✓ showing');
    const tk = await page.evaluate(() => {
      window.__tkOff();
      return window.__tk;
    });
    assert.ok(tk.length && tk.every((x) => x[0] === '#3f7d4e'), 'drawn in green: ' + JSON.stringify(tk));
    await until(page, (l) => !__mstest.tkFresh(l), big[0], 'the ✓ gone after about a second', 4000);
    await frames(page);
    assert.equal(await green(page, big[0]), 0, 'no ✓ left on the art');
    // the codes off: every ✓ stays (the only mark of a done section there)
    await page.click('#sfCodes');
    await idle(page);
    await scrollTop(page);
    p = await sectionPoint(page, big[1]);
    await page.mouse.click(p.x, p.y);
    await until(page, (l) => __mstest.colored[l] === 1, big[1], 'ticked');
    await pause(page, 1300, 'longer than a ✓ shows with the codes on');
    const ticks = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText;
      let n = 0;
      P.fillText = function (t) {
        if (t === '✓') n++;
        return of.apply(this, arguments);
      };
      try {
        __mstest.forceFullRender();
        __mstest.renderGuide();
      } finally {
        P.fillText = of;
      }
      return n;
    });
    assert.equal(ticks, 2, 'both ✓ drawn');
    assert.deepEqual(errors, []);
  });
  test('Markers › Owned has no tick badges (every marker there is yours); All keeps them', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    assert.ok((await page.locator('#results .cell.own').count()) > 50);
    assert.equal(await page.locator('#results .owncheck').count(), 0);
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    assert.ok((await page.locator('#results .cell.own .owncheck').count()) > 50);
    assert.deepEqual(errors, []);
  });
  test('Palette’s first visit: a preview, not one of your palettes until you use it; not for From photo', async () => {
    let { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await idle(page);
    assert.ok((await page.locator('#bands .band').count()) >= 2, 'a palette to look at');
    assert.equal(await page.isVisible('#phint'), false);
    assert.equal(await page.evaluate(() => state.palettes.length), 0, 'not in your palettes');
    assert.equal(await page.isDisabled('#undo'), true, 'nothing to remove');
    assert.equal(await page.isDisabled('#saveBtn'), false, 'it can be saved as it is');
    // locking a colour makes it yours
    await page.click('#bands .band .blk');
    await idle(page);
    assert.equal(await page.evaluate(() => state.palettes.length), 1);
    await page.click('#draw');
    await idle(page, 1300);
    assert.equal(await page.evaluate(() => state.palettes.length), 2);
    assert.deepEqual(errors, []);
    // no markers yet: still a preview, and the note says every marker is used
    ({ page, errors } = await openApp());
    await page.click('#wcSkip');
    await page.click('#wcLook').catch(() => {});
    await idle(page);
    await page.click('#mPalette');
    await idle(page);
    assert.ok(await page.isVisible('#emptyOwned'));
    assert.ok((await page.locator('#bands .band').count()) >= 2);
    // From photo: the card waits for a photo
    await page.evaluate(() => setHarmony('photo'));
    await idle(page);
    assert.ok(await page.isVisible('#phint'));
    assert.equal(await page.evaluate(() => state.palettes.length), 0);
    assert.deepEqual(errors, []);
  });
  test('the PDF’s close-ups: lines in mid grey, their codes near-black', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push({ cv: this.canvas, t: String(t), fill: this.fillStyle, al: this.textAlign });
        return of.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = of;
      }
      const cp = cvs.findIndex((c) => log.some((e) => e.cv === c && e.t === 'Close-ups'));
      if (cp < 0) return null;
      const codes = new Set(Object.values(__mstest.assignData.assign).map((m) => m.code));
      const fills = [...new Set(log.filter((e) => e.cv === cvs[cp] && codes.has(e.t)).map((e) => e.fill))];
      // the first close-up's inside: its pixels by how dark
      const c = cvs[cp],
        d = c
          .getContext('2d')
          .getImageData(
            Math.round(c.width * 0.08),
            Math.round(c.height * 0.14),
            Math.round(c.width * 0.3),
            Math.round(c.height * 0.15),
          ).data;
      let dark = 0,
        mid = 0;
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (L < 80) dark++;
        else if (L > 110 && L < 185) mid++;
      }
      return { fills, dark, mid };
    });
    assert.ok(r, 'the sample has close-ups');
    assert.deepEqual(r.fills, ['#1a1a1a'], 'close-up codes near-black');
    assert.ok(r.mid > 1000 && r.mid > r.dark * 4, `lines in mid grey (${r.mid} mid, ${r.dark} dark)`);
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-smalls.test.mjs ----
// v306 small changes: find by code for a code that's only a highlight or shadow in the guide; "Did any run low?" ›
// Another… says when a marker is already marked (and Escape clears, then closes, its box); the run-low chips follow
// a change to a marker made while they show; the shorter untick toast; a guide smoothed with shading on reopens as
// saved.
{
  // the sample at one marker per section from Ben's 451
  async function benGuide(page) {
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      SF.setCollection(sfCollection());
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
  }
  const along = async (page) => {
    await page.click('#sfColor');
    await idle(page);
  };
  async function finishInList(page) {
    await along(page);
    const k = await page.evaluate(() => {
      const t = __mstest,
        k = t.assignData.assign[t.assignData.order[0]].mkey;
      t.assignData.order.forEach((l) => {
        if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
      });
      t.updateProgress();
      return k;
    });
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
  }
  test('run low: the chips follow a marker marked running low or dry while the finished page shows', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820, storage: { 'ms-wake-told': '1' } });
    await benGuide(page);
    await finishInList(page);
    const top = await page.evaluate(() => [...__mstest.lowTop()]);
    const pressed = (k) => page.getAttribute(`#sfLowA [data-lk="${k}"]`, 'aria-pressed');
    assert.equal(await pressed(top[0]), 'false');
    // the marker's details (as from Markers in another tab): Running low
    await page.evaluate((k) => setInk(keyIdx(k), 'low'), top[0]);
    await idle(page);
    assert.equal(await pressed(top[0]), 'true');
    // dry: no longer a button
    await page.evaluate((k) => setInk(keyIdx(k), 'dry'), top[1]);
    await idle(page);
    assert.equal(await page.$$eval(`#sfLowA button[data-lk="${top[1]}"]`, (b) => b.length), 0);
    // a code being typed in Another…'s box stays
    await page.click('#sfLowA [data-lmore]');
    await idle(page);
    await page.keyboard.type('r3');
    await page.evaluate((k) => setInk(keyIdx(k), ''), top[0]);
    await idle(page);
    assert.equal(await pressed(top[0]), 'false');
    assert.equal(await page.inputValue('#sfLowInA'), 'r3');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfLowInA');
    assert.deepEqual(errors, []);
  });
}

// ---- from v314-page-photo.test.mjs ----
// v314 (D9): a photo of the finished page. Added from the Page finished panel, Home's latest piece or the guide's ⋯
// menu; found and straightened by itself when the finder is sure, else four corner handles with Keep as is; kept on
// this device beside the guide ('fin-<id>'), in the Library's backup, gone with the guide and back with Put back;
// Home shows it first with Your page | Plan; Reveal and the panel make a card of the plan beside it. Each test fails
// on v313, which had no photo of the finished page.
{
  // A made-up phone photo of a Letter page (the sample's picture on it), turned and tilted in front of a 25 mm lens, on
  // a table (wood, or white: the finder can't find a white page on it), with uneven light, noise and JPEG; and where its
  // corners really are. (As straighten.test.mjs makes them.)
  const GEN = GEN_PAGE_PHOTO;
  const photo = (page, o) =>
    page.evaluate(
      ([src, o]) => {
        eval(src);
        return makePhoto(o);
      },
      [GEN, o],
    );
  // eslint-disable-line no-eval
  const FOUND = { tilt: 25, roll: 8, size: 0.6 },
    PALE = { tilt: 20, roll: 4, size: 0.6, bg: 'white' };
  // the sample, every section coloured, in the Library and open in Colour along (its Page finished panel showing)
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
  async function choose(page, ph, sel) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  }
  const stored = (page, id) => page.evaluate((id) => IDB.get('fin-' + id).then((r) => r || null), id);
  // (in the page: waitForFunction doesn't wait for a promise)
  const finIs = (page, id, there) =>
    page.evaluate(
      ([id, there]) =>
        new Promise((res, rej) => {
          const t0 = Date.now(),
            go = () =>
              IDB.get('fin-' + id).then((r) => {
                if (!!r === there) res();
                else if (Date.now() - t0 > 30000)
                  rej(new Error(there ? 'the photo isn’t back' : 'the photo is still there'));
                else setTimeout(go, 100);
              });
          go();
        }),
      [id, there],
    );
  const rec = (page) => page.evaluate(() => __mstest.fin.rec);
  const waitRec = (page, ts0 = 0) =>
    page.waitForFunction((t) => __mstest.fin.rec && __mstest.fin.rec.ts > t, ts0, { timeout: 30000 });
  const near = (a, b, tol) => Math.abs(a / b - 1) < tol;
  const LETTER = 8.5 / 11;
  // the corner handles' places on the screen
  const handle = (page, i) =>
    page.evaluate((i) => {
      const e = __mstest.fin.editing,
        c = document.getElementById('sfFinCv'),
        r = c.getBoundingClientRect(),
        s = r.width / c.width;
      return { x: r.left + (e.pad + e.q[i][0] * e.k) * s, y: r.top + (e.pad + e.q[i][1] * e.k) * s };
    }, i);
  const spot = (page, p) =>
    page.evaluate((p) => {
      const e = __mstest.fin.editing,
        c = document.getElementById('sfFinCv'),
        r = c.getBoundingClientRect(),
        s = r.width / c.width;
      return { x: r.left + (e.pad + p[0] * e.k) * s, y: r.top + (e.pad + p[1] * e.k) * s };
    }, p);
  async function drag(page, i, to) {
    const a = await handle(page, i),
      b = await spot(page, to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
  }
  const home = async (page) => {
    await page.click('#mHome');
    await idle(page);
  };
  const heroImg = (page) =>
    page.waitForFunction(() => !!document.querySelector('#homeHero .hhbox img'), null, { timeout: 20000 });
  const pressed = (page) =>
    page.$$eval('#homeHero .hhseg [aria-pressed="true"]', (b) => b.map((x) => x.getAttribute('data-v')));
  test('a photo of the finished page, found and straightened: kept beside the guide and shown in the Page finished panel; ⋯ Change and Remove; Reset progress keeps it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    assert.match(
      await page.textContent('#sfFin'),
      /Add a photo of your page.*Keep your finished page beside its plan\. It stays on this device\./,
    );
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await waitRec(page);
    const r = await rec(page);
    assert.equal(r.flat, 1, 'straightened');
    assert.ok(near(r.w / r.h, LETTER, 0.03), 'its true shape: ' + (r.w / r.h).toFixed(3));
    assert.ok(Math.max(r.w, r.h) <= 1600 && /^data:image\/jpeg;base64,/.test(r.u));
    assert.equal((await stored(page, id)).ts, r.ts, 'kept on this device, beside the guide');
    assert.equal(await page.evaluate(() => __mstest.fin.editing), null, 'no corners asked for');
    assert.match(await page.textContent('#msToast'), /Photo of your page added, straightened\./);
    assert.match(
      await page.textContent('#sfFin'),
      /Your page.*Added today · straightened.*Show beside the plan/,
    );
    // ⋯: Change and Remove (not Add)
    await openMenu(page);
    const items = await page.$$eval('#sfSheet .sfmitem', (b) => b.map((x) => x.textContent));
    assert.ok(
      items.includes('Change the photo of your page') && items.includes('Remove the photo of your page'),
      items.join(),
    );
    assert.ok(!items.includes('Add a photo of your page'));
    await page.keyboard.press('Escape');
    await idle(page);
    // Reset progress says it's kept
    await menuItem(page, 'Reset progress');
    assert.match(
      await page.textContent('#sfSheet'),
      /Your photo of the page is kept, and shows again once the page is finished\./,
    );
    await page.click('#sfSheet [data-rp="cancel"]');
    await idle(page);
    // Remove asks first
    await menuItem(page, 'Remove the photo of your page');
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAsk'), /Remove your photo\?.*The guide stays as it is\./);
    await page.click('#sfEdAsk [data-a="go"]');
    await page.waitForSelector('#sfFin [data-fin="add"]');
    assert.equal(await stored(page, id), null, 'gone from the device');
    assert.deepEqual(errors, []);
  });
  test('a page the finder can’t find (a white desk): four corner handles; corners that cross say so; Straighten, Keep as is, Cancel and Escape', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    const ph = await photo(page, PALE);
    await choose(page, ph, '#sfFin [data-fin="add"]');
    await page.waitForSelector('#sfFinEd #sfFinCv');
    assert.match(
      await page.textContent('#sfFinEd .dsub'),
      /Drag the four corners onto the corners of your page, or keep the photo as it is\./,
    );
    assert.equal(await page.isEnabled('#sfFinEd [data-a="go"]'), true);
    // crossed over: Straighten waits
    await drag(
      page,
      0,
      ph.C[2].map((v) => v + 40),
    );
    assert.equal(await page.isEnabled('#sfFinEd [data-a="go"]'), false);
    assert.equal(await page.isVisible('#sfFinX'), true);
    // onto the page's corners
    for (let i = 0; i < 4; i++) await drag(page, i, ph.C[i]);
    const q = (await page.evaluate(() => __mstest.fin.editing)).q;
    const off = Math.max(...q.map((p, i) => Math.hypot(p[0] - ph.C[i][0], p[1] - ph.C[i][1])));
    assert.ok(off < 6, 'on the corners: ' + off.toFixed(1));
    assert.equal(await page.isVisible('#sfFinX'), false);
    await page.click('#sfFinEd [data-a="go"]');
    await waitRec(page);
    let r = await rec(page);
    assert.equal(r.flat, 1);
    assert.ok(near(r.w / r.h, LETTER, 0.04), 'its true shape: ' + (r.w / r.h).toFixed(3));
    assert.equal(await page.locator('#sfFinEd').count(), 0);
    // Adjust corners: the same photo, its corners where they were left
    await page.click('#sfFin [data-fin="adjust"]');
    await page.waitForSelector('#sfFinEd');
    const q2 = (await page.evaluate(() => __mstest.fin.editing)).q;
    assert.ok(Math.hypot(q2[0][0] - ph.C[0][0], q2[0][1] - ph.C[0][1]) < 6);
    // Escape: nothing changes
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('#sfFinEd').count(), 0);
    assert.equal((await rec(page)).ts, r.ts);
    // Change, then Keep as is: the photo as taken
    await choose(page, ph, '#sfFin [data-fin="change"]');
    await page.waitForSelector('#sfFinEd');
    await page.click('#sfFinEd [data-a="keep"]');
    await waitRec(page, r.ts);
    r = await rec(page);
    assert.equal(r.flat, 0);
    assert.equal(r.w / r.h, 1200 / 1600, 'as taken');
    assert.match(await page.textContent('#sfFin'), /Added today/);
    assert.doesNotMatch(await page.textContent('#sfFin'), /straightened/);
    // Change, then Cancel: as it was
    await choose(page, ph, '#sfFin [data-fin="change"]');
    await page.waitForSelector('#sfFinEd');
    await page.click('#sfFinEd [data-a="cancel"]');
    await idle(page);
    assert.equal((await stored(page, id)).ts, r.ts);
    // the keyboard: arrow keys move the corner, Space the next one
    await page.click('#sfFin [data-fin="adjust"]');
    await page.waitForSelector('#sfFinEd');
    const k0 = (await page.evaluate(() => __mstest.fin.editing)).q.map((p) => p.slice());
    await page.focus('#sfFinCv');
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
    const k1 = (await page.evaluate(() => __mstest.fin.editing)).q;
    assert.equal(k1[0][0], k0[0][0], 'the first corner stays');
    assert.ok(k1[1][0] > k0[1][0], 'the second moves right');
    await page.click('#sfFinEd [data-a="cancel"]');
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: Add a photo of your page (✕ puts it away for that guide); with one it shows first, the plan a tap away, remembered', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    await home(page);
    await heroImg(page);
    await page.waitForSelector('#homeHero .hhfin:not([hidden])');
    assert.equal(await page.isVisible('#homeHero .hhseg'), false, 'no switch without a photo');
    // ✕: put away, still after a reload
    await page.click('#homeHero .hhfinx');
    assert.equal(await page.isVisible('#homeHero .hhfin'), false);
    await page.reload();
    await idle(page);
    await home(page);
    await heroImg(page);
    // (the offer is shown or not with the picture)
    assert.equal(await page.isVisible('#homeHero .hhfin'), false, 'still put away');
    // brought back, and a photo added from Home itself
    await page.evaluate(() => localStorage.removeItem('ms-finx'));
    await page.reload();
    await idle(page);
    await home(page);
    await page.waitForSelector('#homeHero .hhfin:not([hidden])');
    await choose(page, await photo(page, FOUND), '#homeHero .hhfinadd');
    await page.waitForSelector('#homeHero .hhbox.ph img', { timeout: 30000 });
    assert.equal((await stored(page, id)).flat, 1);
    assert.match(await page.textContent('#homeHero .hhwhen'), /^Finished · .+ · your photo$/);
    assert.deepEqual(await pressed(page), ['page']);
    assert.equal(await page.isVisible('#homeHero .hhfin'), false);
    // the plan, remembered for the guide
    await page.click('#homeHero .hhseg [data-v="plan"]');
    assert.equal(await page.locator('#homeHero .hhbox.ph').count(), 0);
    assert.doesNotMatch(await page.textContent('#homeHero .hhwhen'), /your photo/);
    await page.reload();
    await idle(page);
    await home(page);
    await page.waitForSelector('#homeHero .hhseg:not([hidden])');
    assert.deepEqual(await pressed(page), ['plan']);
    assert.equal(await page.locator('#homeHero .hhbox.ph').count(), 0);
    // a tap on the picture still opens the guide
    await page.click('#homeHero .hhseg [data-v="page"]');
    await page.click('#homeHero .hhpic');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    assert.deepEqual(errors, []);
  });
  test('the photo stays while the guide waits in Recently deleted, and comes back with Put back; Save a copy doesn’t copy it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await waitRec(page);
    const ts = (await rec(page)).ts;
    // deleted in the Library while open, its Undo let go (v318.1: it waits a week in Recently deleted, photo and all;
    // it went with the Undo window before)
    await page.evaluate((id) => {
      libDelete(id);
      libFinish();
    }, id);
    await idle(page, 600);
    await finIs(page, id, true);
    // Put back
    await page.click('#sfHead .sfsave');
    await finIs(page, id, true);
    assert.equal((await stored(page, id)).ts, ts, 'the same photo');
    // Save a copy (on the plan): the copy has none
    await page.click('#sfDoneBtn');
    await idle(page);
    await menuItem(page, 'Save a copy');
    await page.waitForFunction((id) => __mstest.curId !== id && __mstest.inLibrary, id);
    const cid = await page.evaluate(() => __mstest.curId);
    assert.equal(await stored(page, cid), null);
    assert.ok(await stored(page, id), 'the first keeps its own');
    assert.deepEqual(errors, []);
  });
  test('the Library’s backup holds the photo (a guide file doesn’t); restoring puts it back, for the guide here and for one deleted', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await waitRec(page);
    const r = await rec(page);
    // the backup reminder counts the photo as a change
    assert.ok(await page.evaluate((id) => +state.saved.find((s) => s.id === id).fn > 0, id));
    await page.evaluate(() => openLibrary());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const file = await dl.path();
    const bk = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
    const g = bk.guides.find((x) => x.id === id);
    assert.equal(g.fin.u, r.u, 'in the backup');
    assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'backed up');
    await page.keyboard.press('Escape');
    await idle(page);
    // a guide file: the guide only
    assert.doesNotMatch(
      await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj(true))),
      /data:image\/jpeg/,
    );
    // the photo gone here, then the backup restored: back for the same guide
    await page.evaluate((id) => IDB.del('fin-' + id), id);
    await page.setInputFiles('#guidesFile', file);
    await finIs(page, id, true);
    assert.equal((await stored(page, id)).u, r.u);
    await idle(page, 1500);
    // the guide deleted for good, photo and all; restored, both come back
    await page.evaluate((id) => {
      libDelete(id);
      libFinish();
      // (v318.1: Recently deleted's Delete them now)
      libPurge(id);
    }, id);
    await finIs(page, id, false);
    await page.setInputFiles('#guidesFile', file);
    await page.waitForFunction((id) => state.saved.some((s) => s.id === id), id, { timeout: 30000 });
    await finIs(page, id, true);
    assert.equal((await stored(page, id)).u, r.u);
    assert.deepEqual(errors, []);
  });
  test('Reveal’s end: Plan and your page shows the plan beside the photo (side by side for a tall page), over Reveal, with Share', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await finished(page);
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await waitRec(page);
    // the card: 1080 × 1350
    await page.waitForFunction(() => __mstest.fin.card() !== null);
    const c = await page.evaluate(() => {
      const k = __mstest.fin.card();
      return { w: k.width, h: k.height, at: k.finAt };
    });
    assert.deepEqual([c.w, c.h], [1080, 1350]);
    assert.equal(c.at.side, true, 'side by side');
    assert.ok(c.at.plan.x + c.at.plan.w < c.at.page.x, 'the plan on the left');
    assert.ok(Math.abs(c.at.plan.h - c.at.page.h) < 1, 'the same height');
    await page.click('#sfDoneRev');
    await page.waitForSelector('#revFin', { timeout: 30000 });
    assert.equal(await page.textContent('#revFin'), 'Plan and your page');
    await page.click('#revFin');
    await page.waitForSelector('#sfFinCard img');
    // over Reveal
    assert.equal(
      await page.evaluate(() => {
        const b = document.querySelector('#sfFinCard [data-a="share"]').getBoundingClientRect();
        return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).closest('#sfFinCard');
      }),
      true,
    );
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#sfFinCard [data-a="share"]'),
    ]);
    assert.equal(dl.suggestedFilename(), 'finished-jellyfish-plan-and-page.jpg');
    // Escape closes the card, then Reveal
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('#sfFinCard').count(), 0);
    assert.equal(await page.isVisible('#revFin'), true, 'Reveal still open');
    assert.deepEqual(errors, []);
  });
  // (v323.1: the id looked for had gone in a rename, and the keyboard was left on the page)
  test('Reveal opened from the finished page, closed: back on Reveal & share', async () => {
    const { page, errors } = await openApp();
    await finished(page);
    await page.click('#sfDoneRev');
    await page.waitForSelector('#sfRevX', { timeout: 30000 });
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
      false,
    );
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfDoneRev');
    assert.deepEqual(errors, []);
  });
}
