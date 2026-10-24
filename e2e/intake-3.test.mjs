// Getting a picture in: photos, scans, PDFs, straightening, sections found, specks, frames, hatching.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  haveSet,
  idle,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  until,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  // What the screen showed, frame by frame: a status read as a frame starts (its callbacks) and still the same once it is
  // laid out to be drawn (a ResizeObserver's callback, just before the drawing). A status set and replaced within one
  // piece of work is never drawn, nor one replaced by work done in the frame's own callbacks.
  function watchStatus(page) {
    return page.evaluate(() => {
      const seen = (window.__painted = new Set());
      const read = () =>
        ['sfMeta', 'sfBuild', 'sfPgGo']
          .map((id) => document.getElementById(id))
          .filter((e) => e && e.offsetParent)
          .map((e) => e.textContent.trim());
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;pointer-events:none';
      document.body.appendChild(probe);
      let a = [];
      new ResizeObserver(() => {
        const b = read();
        a.forEach((t) => b.includes(t) && seen.add(t));
      }).observe(probe);
      const tick = () => {
        a = read();
        probe.style.width = probe.style.width === '1px' ? '2px' : '1px';
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  const painted = (page) => page.evaluate(() => [...window.__painted]);
  // The note before heavy work on the page was set in the same piece of work as it: "Reading photo…" stayed up while the
  // sections were found, and Build's "Building…" never showed once the label points were already worked out.
  test('Detecting sections…, Building… and Straightening… are on screen while that work is done', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
    await page.click('#mSections');
    await idle(page);
    await watchStatus(page);
    const buf = await readFile(new URL('./fixtures/letter-page.png', import.meta.url));
    // (into the file box straight, not through the file picker: Playwright's WebKit draws no frames while it's "open")
    await page.setInputFiles('#sfFile', { name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    assert.ok(
      (await painted(page)).includes('Detecting sections…'),
      'Detecting sections… shown: ' + (await painted(page)).join(' / '),
    );
    // Adjust photo › Straighten page › Straighten
    if (!(await page.isVisible('#sfPgOpen'))) await page.click('#sfAdjToggle');
    await page.click('#sfPgOpen');
    await page.waitForSelector('#sfPgGo');
    await idle(page);
    await page.click('#sfPgGo');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    assert.ok(
      (await painted(page)).includes('Straightening…'),
      'Straightening… shown: ' + (await painted(page)).join(' / '),
    );
    assert.match(await page.textContent('.sfpgline'), /Page straightened/);
    // Build, its label points worked out on the page (as where there's no worker; with one, as when they're known)
    await page.evaluate(() => __mstest.jobs.off());
    await page.click('#sfBuild');
    await until(page, () => __mstest.assignData && __mstest.sfmode === 'guide', null, 'the guide', 60000);
    await idle(page);
    assert.ok(
      (await painted(page)).includes('Building…'),
      'Building… shown: ' + (await painted(page)).join(' / '),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31813-photo.test.mjs ----
// v318.13: the photo tips. The first time a photo is chosen on a device (here the welcome's Choose a photo), a card of
// tips comes first, and its own Choose a photo opens the picker in that tap (iOS opens it only from a tap); after that
// the picker opens straight away (Home's Choose a photo). Its close or Escape opens nothing; the Guide screen's
// Photo tips link shows it again. A new photo's Min section size is about 1 mm on the page, shown beside the slider.
{
  const tipsOn = () => {
    window.__MS_PHOTO_TIPS = true;
  };
  // a 900 x 1200 line drawing (a grid of rings) as a PNG
  async function drawing(page) {
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 1200;
      const g = c.getContext('2d');
      g.fillStyle = '#fbfaf6';
      g.fillRect(0, 0, 900, 1200);
      g.strokeStyle = '#111';
      g.lineWidth = 4;
      for (let y = 150; y < 1200; y += 220)
        for (let x = 150; x < 900; x += 220) {
          g.beginPath();
          g.arc(x, y, 80, 0, 6.283);
          g.stroke();
          g.beginPath();
          g.arc(x, y, 40, 0, 6.283);
          g.stroke();
        }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  const tipsShown = (page) =>
    page.evaluate(() => {
      const o = document.getElementById('ptOverlay');
      return !!o && o.classList.contains('on') && !!o.getClientRects().length;
    });
  // counts file pickers opened
  async function watchPickers(page) {
    const n = { v: 0 };
    page.on('filechooser', () => n.v++);
    return n;
  }
  test('the first photo: the tips first, their Choose a photo opens the picker; the next photo goes straight to it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, init: tipsOn });
    const n = await watchPickers(page);
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcPhoto');
    await idle(page);
    assert.equal(await tipsShown(page), true, 'the tips show');
    assert.equal(n.v, 0, 'no picker yet');
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'ptGo',
      'focus on its Choose a photo',
    );
    const tips = await page.$$eval('#ptOverlay .pttips li', (l) => l.map((x) => x.textContent));
    assert.equal(tips.length, 5);
    assert.match(tips.join(' '), /flat.*above.*shadow.*whole page.*sent by message/is);
    // the card fits an iPad's screen without scrolling
    const fit = await page.evaluate(() => {
      const c = document.querySelector('#ptOverlay .ptcard');
      return c.scrollHeight <= c.clientHeight + 1;
    });
    assert.ok(fit, 'no scrolling in the card');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ptGo')]);
    assert.equal(await tipsShown(page), false);
    await fc.setFiles(await drawing(page));
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-photo-tips')), '1');
    // Min section size: about 1 mm on the page for a new photo
    assert.match(await page.textContent('#sfMinMm'), /about 1(\.\d)? mm/);
    // the next photo (Home's start card: the guide isn't begun): straight to the picker
    await page.click('#mHome');
    await idle(page);
    const [fc2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#homeCont [data-start="photo"]'),
    ]);
    assert.ok(fc2);
    assert.equal(await tipsShown(page), false, 'not again');
    assert.deepEqual(errors, []);
  });
  test('the tips’ close and Escape open nothing; the Guide screen’s Photo tips link shows them again', async () => {
    const { page, errors } = await openApp({ init: tipsOn });
    const n = await watchPickers(page);
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await page.click('#mSections');
    await idle(page);
    await page.click('#sfPick');
    await idle(page);
    assert.equal(await tipsShown(page), true, 'the Guide screen’s Choose a photo: the tips first');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await tipsShown(page), false, 'Escape closes them');
    assert.equal(n.v, 0, 'and opens no picker');
    // seen: the next Choose a photo goes to the picker
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
    assert.ok(fc);
    // the link on the start card shows them again; the close button opens nothing
    await page.click('#sfMeta [data-pttips]');
    await idle(page);
    assert.equal(await tipsShown(page), true, 'Photo tips shows them again');
    await page.click('#ptClose');
    await idle(page);
    assert.equal(await tipsShown(page), false);
    assert.equal(n.v, 1);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31814-steps.test.mjs ----
// v318.14: a photo's sections are found with a paint between the steps (segRun), so the page isn't held for a second
// or more at a time. The sections are exactly those found in one go (segment()); a newer change takes over from an
// older one before it puts anything in place; while the steps run, the picture and its controls can't be used, and
// Undo and Build wait.
{
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
        const n = (s / 2147483647 - 0.5) * 18;
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
      await page.evaluate(
        () => document.getElementById('sfView').inert || document.getElementById('sfCtl').inert,
      ),
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
    await page.waitForFunction(() => __mstest.curName !== undefined && __mstest.W === 568, null, {
      timeout: 30000,
    });
    await idle(page);
    const s = await page.evaluate(() => ({
      W: __mstest.W,
      H: __mstest.H,
      busy: __mstest.segBusy,
      n: __mstest.comps.length,
    }));
    assert.deepEqual([s.W, s.H, s.busy], [568, 1500, false]);
    assert.notEqual(await page.evaluate(() => __mstest.labelsSig()), s1);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31815.test.mjs ----
// v318.15 in the browser: a new photo is on the picture at once, with the controls out of sight until its sections are
// in place (a guide open before stays out of sight too); specks in the paper round a drawing go, found in steps just
// as in one go; Trim it for a binding along the top, then Undo; the shading presets and Light from › The edges; Radial ›
// Rings › Follow the drawing, its row at phone width; Matching shapes alike on a mandala.
{
  // a 1500 x 2000 photo of a sketchbook page: a dark wire binding along the top, a blank margin with grain and specks,
  // circles in the middle; as a JPEG
  async function photo(page, opts = {}) {
    const b64 = await page.evaluate(async (o) => {
      const c = document.createElement('canvas');
      c.width = 1500;
      c.height = 2000;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, 1500, 2000);
      if (o.binding) {
        g.fillStyle = '#9a9792';
        g.fillRect(0, 0, 1500, 90);
        g.fillStyle = '#2a2a2c';
        for (let x = 10; x < 1500; x += 40) g.fillRect(x, 0, 24, 80);
      }
      g.strokeStyle = '#1a1a1a';
      g.lineWidth = 6;
      for (let y = 450; y < 1700; y += 300)
        for (let x = 400; x < 1200; x += 300) {
          g.beginPath();
          g.arc(x, y, 120, 0, 6.283);
          g.stroke();
        }
      // specks in the margin: faint ones and grain lighter than the lines
      let s = 11;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = i % 2 ? '#b8b5ae' : '#8c8a85';
        const x = rnd() < 0.5 ? 40 + rnd() * 160 : 1300 + rnd() * 160,
          y = 200 + rnd() * 1700;
        g.fillRect(x, y, 3 + rnd() * 3, 3 + rnd() * 3);
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, opts);
    return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
  }
  // what's on screen from the moment the photo is chosen until its sections are in place
  const watch = (page) =>
    page.evaluate(() => {
      window.__gap = [];
      const look = () => {
        const t = __mstest,
          cv = document.getElementById('sfCanvas'),
          ctl = document.getElementById('sfCtl'),
          bar = document.querySelector('#sfWork>.sfbar');
        window.__gap.push({
          busy: t.segBusy,
          cw: cv.width,
          ch: cv.height,
          ctl: ctl ? getComputedStyle(ctl).visibility : '',
          bar: bar ? getComputedStyle(bar).visibility : '',
          built: !!t.assignData,
        });
        if (window.__gap.length < 4000) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
  async function settle(page) {
    const first = await Promise.race([
      page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }).then(() => 'build'),
      page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 60000 }).then(() => 'corners'),
    ]);
    if (first === 'corners') {
      await page.click('#sfPgNo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    }
    await page.waitForFunction(() => !__mstest.segBusy);
    await idle(page);
  }
  // a mandala drawn as a PNG: a disc and rings of 8, 16 and 24 cells
  async function mandala(page) {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1100;
      c.height = 1100;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 1100, 1100);
      g.strokeStyle = '#000';
      g.lineWidth = 5;
      for (const r of [75, 200, 350, 500]) {
        g.beginPath();
        g.arc(550, 550, r, 0, 6.2832);
        g.stroke();
      }
      for (const [r0, r1, k] of [
        [75, 200, 8],
        [200, 350, 16],
        [350, 500, 24],
      ])
        for (let i = 0; i < k; i++) {
          const a = (i * 2 * Math.PI) / k;
          g.beginPath();
          g.moveTo(550 + r0 * Math.cos(a), 550 + r0 * Math.sin(a));
          g.lineTo(550 + r1 * Math.cos(a), 550 + r1 * Math.sin(a));
          g.stroke();
        }
      return c.toDataURL('image/png').split(',')[1];
    });
    return { name: 'mandala.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  test('a new photo is on the picture at once, the previous guide and the controls out of sight until it’s ready', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await idle(page);
    const was = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await watch(page);
    await page.setInputFiles('#sfFile', await photo(page));
    await settle(page);
    const gap = await page.evaluate(() => window.__gap);
    // while its sections were found: the photo's own size on the canvas, and no controls or Build to tap
    const busy = gap.filter((g) => g.busy);
    assert.ok(busy.length > 0, 'seen while busy');
    assert.ok(
      busy.every((g) => g.ctl === 'hidden' && g.bar === 'hidden'),
      JSON.stringify(busy.slice(0, 3)),
    );
    assert.ok(
      busy.every((g) => !(g.cw === was[0] && g.ch === was[1])),
      'not the sample’s picture meanwhile',
    );
    // then the controls are back
    const end = await page.evaluate(() => ({
      ctl: getComputedStyle(document.getElementById('sfCtl')).visibility,
      built: !!__mstest.assignData,
      preview: __mstest.sfmode,
    }));
    assert.deepEqual(end, { ctl: 'visible', built: false, preview: 'review' });
    assert.deepEqual(errors, []);
  });
  test('specks in the margin go, found in steps just as in one go; a binding along the top: Trim it, then Undo', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await photo(page, { binding: true }));
    await settle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        one = () => ({ sig: t.labelsSig(), n: t.comps.length, gone: t.speckGone, faint: t.faintOffer });
      const a = one();
      t.segment();
      t.render();
      return { steps: a, once: one(), bands: t.edgeBands, offer: t.trimOffer() };
    });
    assert.ok(r.steps.gone > 0, 'specks gone: ' + r.steps.gone);
    assert.deepEqual(r.steps, r.once);
    assert.ok(r.bands && r.bands.t > 0.02, 'the binding: ' + JSON.stringify(r.bands));
    assert.equal(r.offer, true);
    await page.evaluate(() => __mstest.renderControls());
    await page.waitForSelector('#sfTrimLine', { state: 'visible' });
    await page.click('#sfTrim');
    await page.waitForFunction(() => !!__mstest.cropRect && !__mstest.segBusy, null, { timeout: 60000 });
    await idle(page);
    const crop = await page.evaluate(() => __mstest.cropRect);
    // the crop starts below the binding (in the picture's fraction or pixels, whichever it keeps)
    const top = crop.y0 != null ? crop.y0 : crop.y;
    assert.ok(top >= (top > 1 ? 0.04 * 2000 : 0.04), 'below the binding: ' + JSON.stringify(crop));
    assert.equal(await page.isVisible('#sfTrimLine'), false, 'not offered again once cropped');
    await page.evaluate(() => __mstest.doUndoSeg());
    await page.waitForFunction(() => !__mstest.cropRect && !__mstest.segBusy, null, { timeout: 60000 });
    await idle(page);
    assert.equal(await page.isVisible('#sfTrimLine'), true, 'offered again after Undo');
    assert.deepEqual(errors, []);
  });
  test('shading presets and Light from › The edges; Radial › Rings › Follow the drawing fits at phone width', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    const st = () =>
      page.evaluate(() => ({ mode: __mstest.shadeMode, light: __mstest.styleVars.shadeLight }));
    const before = await st();
    await page.click('#sfShade [data-v="neuro"]');
    await idle(page);
    const s = await page.evaluate(() => ({
      mode: __mstest.shadeMode,
      light: __mstest.styleVars.shadeLight,
      on: document.querySelector('#sfShade [data-v="neuro"]').getAttribute('aria-pressed'),
      edges: document.querySelector('#sfShLight [data-v="edges"]').getAttribute('aria-pressed'),
    }));
    assert.deepEqual(s, { mode: 'full', light: 'edges', on: 'true', edges: 'true' });
    // one step, which Undo takes back
    assert.match(await page.evaluate(() => __mstest.planLabel), /^Shading|^Light from/);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await st(), before);
    await page.click('#sfShade [data-v="soft"]');
    await idle(page);
    // (v318.16: a sun style leaves Light from as it was, here auto, the sun with no photo)
    assert.equal(await page.evaluate(() => __mstest.styleVars.shadeLight), 'auto');
    // Radial's rings follow the drawing, all of its row on screen
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    await page.click('#sfRingKind [data-v="rings"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'rings');
    assert.equal(
      await page.getAttribute('#sfShape [data-v="radial"]', 'aria-pressed'),
      'true',
      'under Radial',
    );
    const fit = await page.evaluate(() => {
      const r = document.getElementById('sfRingKind').getBoundingClientRect();
      return { right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth };
    });
    assert.ok(fit.right <= fit.vw + 1 && fit.sw <= fit.vw + 1, JSON.stringify(fit));
    assert.deepEqual(errors, []);
  });
  test('Matching shapes alike: on a mandala, each ring’s matching shapes take one marker; off, as before', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await mandala(page));
    await settle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    // (Diagonal: across the rings, so each ring has several markers before)
    await page.click('#sfShape [data-v="diagonal"]');
    await idle(page);
    const markers = () =>
      page.evaluate(() => {
        const t = __mstest,
          A = t.assignData.assign,
          gs = [...t.mandalaGroups(t.countedList())];
        return gs.map((g) => new Set([...g].map((l) => A[l] && A[l].mkey)).size);
      });
    const off = await markers();
    assert.ok(off.length >= 3, 'groups: ' + off.length);
    assert.ok(
      off.some((n) => n > 1),
      JSON.stringify(off),
    );
    assert.equal(await page.isVisible('#sfMatchAlike'), true);
    await page.check('#sfMatchAlike');
    await idle(page);
    const on = await markers();
    assert.ok(
      on.every((n) => n === 1),
      JSON.stringify(on),
    );
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.matchAlike), true);
    await page.uncheck('#sfMatchAlike');
    await idle(page);
    assert.deepEqual(await markers(), off);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.matchAlike), undefined);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31835-coloured.test.mjs ----
// v318.35 in the browser (Fable E1-3): a page partly coloured in with markers keeps its coloured sections (they had
// read as ink), gets no "coloured in already" warning, and after Build offers to mark them done: a toast with a
// button, never by itself; taken, it ticks them and says so with an Undo that puts the ticks back. A plain page gets
// no offer. Fails on v318.34 (the filled cells shrink to scraps; no offer).
{
  // a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in 8 px black lines, a blank margin; o.fills cells coloured in
  // with mid markers (a 2 px bleed over the lines, as a marker leaves); as a PNG
  async function picture(page, o = {}) {
    const b64 = await page.evaluate(async (o) => {
      const W = 1200,
        H = 1600,
        M = 110,
        S = 180,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      (o.fills || []).forEach(([cx, cy, col]) => {
        g.fillStyle = col;
        g.fillRect(M + cx * S - 2, M + cy * S - 2, S + 4, S + 4);
      });
      g.strokeStyle = '#111';
      g.lineWidth = 8;
      for (let i = 0; i <= 5; i++) {
        g.beginPath();
        g.moveTo(M + i * S, M);
        g.lineTo(M + i * S, M + 7 * S);
        g.stroke();
      }
      for (let j = 0; j <= 7; j++) {
        g.beginPath();
        g.moveTo(M, M + j * S);
        g.lineTo(M + 5 * S, M + j * S);
        g.stroke();
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, o);
    return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  const FILLS = [
    [1, 1, 'rgb(116,168,232)'],
    [3, 2, 'rgb(232,96,96)'],
    [0, 5, 'rgb(112,192,142)'],
  ];
  async function settle(page) {
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => !__mstest.segBusy);
    await idle(page);
  }
  const warn = (page) =>
    page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
  const count = (page) => page.evaluate(() => __mstest.countedList().length);
  const ticked = (page) => page.evaluate(() => [...__mstest.colored].filter((x) => x).length);
  async function build(page) {
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
  }
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  test('coloured-in sections stay sections with no warning; Build offers to mark them done; Undo puts the ticks back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await picture(page, { fills: FILLS }));
    await settle(page);
    assert.equal(await warn(page), '', 'no warning for a partly coloured page');
    const n = await count(page);
    assert.equal(n, 35, 'every cell, the coloured ones too');
    // the coloured cells are whole: as big as a plain one
    const areas = await page.evaluate(() => {
      const t = __mstest,
        at = (cx, cy) => t.comps[t.labels[(110 + cy * 180 + 90) * t.W + 110 + cx * 180 + 90]];
      return [at(1, 1), at(3, 2), at(0, 5), at(2, 2)].map((c) => (c && !c.bg ? c.area : 0));
    });
    assert.ok(
      areas[3] > 0 && areas.every((a) => Math.abs(a - areas[3]) < areas[3] * 0.05),
      JSON.stringify(areas),
    );
    assert.equal(await ticked(page), 0, 'nothing ticked by itself');
    await build(page);
    // the offer, after the bloom
    await page.waitForFunction(
      () => /look coloured in already/.test(document.getElementById('msToast')?.textContent || ''),
      null,
      { timeout: 20000 },
    );
    assert.match(await toastOn(page), /^3 sections look coloured in already\./);
    assert.equal(await page.textContent('#toastAct'), 'Mark them done');
    assert.equal(await ticked(page), 0, 'still nothing ticked: an offer');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await ticked(page), 3);
    assert.match(await toastOn(page), /^Marked 3 sections done/);
    assert.equal(await page.textContent('#toastAct'), 'Undo');
    // the ticks are the guide's progress: Colour along would count them
    assert.equal(await page.evaluate(() => [...__mstest.colored].filter((x) => x).length), 3);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await ticked(page), 0, 'Undo: the ticks as they were');
    // (v323) the offer is kept with the guide, and Colour along makes it again at its top, the sections outlined
    assert.equal(
      (await page.evaluate(() => __mstest.currentDesignObj().payload.colOffer || [])).length,
      3,
      'saved with the guide',
    );
    await page.click('#sfColor');
    await page.waitForFunction(() => __mstest.sfmode === 'color');
    await idle(page);
    // (WebKit's first Colour along adds "· screen stays on" to the status)
    assert.match(await toolStatus(page), new RegExp(`^0 of ${n} coloured`));
    assert.doesNotMatch(await toastOn(page), /coloured in already/);
    assert.match(
      await page.textContent('#sfColOffer'),
      /^3 sections look coloured in already\. Mark them done/,
    );
    assert.equal(await page.evaluate(() => (__mstest.olSet || []).length), 3, 'outlined on the picture');
    await page.click('#sfColGo');
    await idle(page);
    assert.equal(await ticked(page), 3);
    assert.equal(await page.locator('#sfColOffer').count(), 0, 'taken: the line goes');
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.colOffer), undefined);
    // Undo brings the ticks and the line back; ✕ closes it for good
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await ticked(page), 0);
    assert.equal(await page.isVisible('#sfColOffer'), true);
    await page.click('#sfColX');
    await idle(page);
    assert.equal(await page.locator('#sfColOffer').count(), 0);
    assert.equal(await page.evaluate(() => (__mstest.olSet || []).length), 0, 'its outline goes with it');
    assert.equal(await page.evaluate(() => __mstest.colOffer), null);
    assert.deepEqual(errors, []);
  });
  test('a plain page gets no offer', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await picture(page));
    await settle(page);
    assert.equal(await page.evaluate(() => __mstest.chroma), null, 'no colour read on a greyscale page');
    await build(page);
    await page.waitForTimeout(2500);
    assert.doesNotMatch(await toastOn(page), /coloured in already/);
    assert.equal(await ticked(page), 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31835-hatching.test.mjs ----
// v318.35: hatching as one section, in the browser. A page with a hatched box (close parallel lines) finds the box
// as one section with its lines kept; Edit sections has "Treat hatching as one section", ticked, with the count in
// its note; unticking it finds the sections again without the merge (every sliver its own), Undo brings the merged
// section and the tick back, and the switch is saved with the guide only when off. Fails on v318.34 (no switch).
{
  async function fresh() {
    const a = await openApp({ width: 820, height: 1180 });
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  // a 1200 x 1600 page: a frame, a plain box, and a 300 x 300 box hatched with 2 px lines every 6 px (4 px gaps, about
  // 0.7 mm on a Letter page); drawn with fillRect, so the lines are crisp
  const pagePNG = (page) =>
    page.evaluate(async () => {
      const W = 1200,
        H = 1600,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#000';
      const rect = (x, y, w, h) => g.fillRect(x, y, w, h);
      const box = (x, y, w, h, t) => {
        rect(x, y, w, t);
        rect(x, y + h - t, w, t);
        rect(x, y, t, h);
        rect(x + w - t, y, t, h);
      };
      box(100, 100, 1000, 1400, 4);
      box(200, 300, 300, 300, 3);
      box(600, 300, 300, 300, 2);
      for (let y = 302; y < 598; y += 6) rect(602, y, 296, 2);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result.split(',')[1]);
        fr.readAsDataURL(blob);
      });
    });
  async function pick(page, b64) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'hatched.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
  }
  // the sections (not background, not merged away) lying inside the hatched box, in the picture's pixels
  const inBox = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        k = t.W / 1200,
        a = [];
      for (let l = 1; l < t.comps.length; l++) {
        const c = t.comps[l];
        if (!c || c.bg || c.merged) continue;
        if (c.x0 >= 600 * k && c.y0 >= 300 * k && c.x1 <= 900 * k && c.y1 <= 600 * k) a.push(c.area);
      }
      return a;
    });
  const made = (page) => page.evaluate(() => __mstest.hatchMade);
  test('a hatched box is one section; the switch on Edit sections, off and Undo; saved only when off', async () => {
    const { page, errors } = await fresh();
    await pick(page, await pagePNG(page));
    if (await page.isVisible('#sfFix')) {
      await page.click('#sfFix');
      await idle(page);
    }
    assert.equal(await made(page), 1, 'one hatched patch merged');
    assert.equal((await inBox(page)).length, 1, 'the hatched box is one section');
    assert.equal(await page.isChecked('#sfHatch'), true);
    assert.match(await page.textContent('#sfHatchNote'), /Found 1 hatched patch on this page/);
    // 44 px row
    const box = await page.evaluate(
      () => document.querySelector('#sfHatchLine label').getBoundingClientRect().height,
    );
    assert.ok(box >= 44, 'row height ' + box);
    // off: found again without the merge, every sliver its own
    await page.uncheck('#sfHatch');
    await page.waitForFunction(() => !__mstest.segBusy && __mstest.hatchMade === 0);
    await idle(page);
    const slivers = await inBox(page);
    assert.ok(slivers.length >= 40, 'slivers: ' + slivers.length);
    assert.doesNotMatch(await page.textContent('#sfHatchNote'), /Found/);
    assert.equal(await page.evaluate(() => __mstest.styleVars.hatchOne), false);
    // Undo: the merged section and the tick are back
    await page.evaluate(() => __mstest.doUndoSeg());
    await idle(page);
    assert.equal((await inBox(page)).length, 1, 'undone: one section again');
    assert.equal(await page.isChecked('#sfHatch'), true);
    assert.equal(await made(page), 1);
    assert.match(await page.textContent('#sfHatchNote'), /Found 1 hatched patch/);
    // saved with the guide only when off
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.hatchOne), undefined);
    await page.evaluate(() => {
      __mstest.styleVars.hatchOne = false;
    });
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.hatchOne), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31837-coloured-lines.test.mjs ----
// v318.37 in the browser (Fable X1-1): a page whose outlines are drawn in colour (a red pen) with a black title band
// keeps every section, through the worker's own copy of the ink (v318.36): the chroma ink rule had taken the coloured
// lines for a marker's fill and erased them (0 sections, 'few'). Build makes no colour offer: no section is coloured
// (v319: the picture keeps its colour, the cut being per patch, inkColourCut; until then it was dropped). Fails on
// v318.36 (0 or 1 sections).
{
  // a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in 8 px lines of colour `line`, a 40 px black title band under
  // it (2% of the page); as a PNG
  async function picture(page, o = {}) {
    const b64 = await page.evaluate(async (o) => {
      const W = 1200,
        H = 1600,
        M = 110,
        S = 180,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      if (o.band) {
        g.fillStyle = '#000';
        g.fillRect(M, H - M - 40, 5 * S, 40);
      }
      g.strokeStyle = o.line;
      g.lineWidth = 8;
      for (let i = 0; i <= 5; i++) {
        g.beginPath();
        g.moveTo(M + i * S, M);
        g.lineTo(M + i * S, M + 7 * S);
        g.stroke();
      }
      for (let j = 0; j <= 7; j++) {
        g.beginPath();
        g.moveTo(M, M + j * S);
        g.lineTo(M + 5 * S, M + j * S);
        g.stroke();
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, o);
    return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  async function settle(page) {
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => !__mstest.segBusy);
    await idle(page);
  }
  const warn = (page) =>
    page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
  const count = (page) => page.evaluate(() => __mstest.countedList().length);
  test('red outlines with a black title band keep all 35 cells (black ones as many); no colour offer for it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await picture(page, { line: '#111', band: true }));
    await settle(page);
    const black = await count(page);
    assert.equal(black, 35, 'black lines: every cell');
    for (const line of ['rgb(220,30,30)', 'rgb(40,60,200)']) {
      await page.setInputFiles('#sfFile', await picture(page, { line, band: true }));
      await settle(page);
      assert.equal(await warn(page), '', line + ': no warning');
      assert.equal(await count(page), black, line + ': every cell');
      assert.ok(await page.evaluate(() => !!__mstest.chroma), line + ': its colour kept (v319)');
      assert.equal(await page.evaluate(() => __mstest.colourSecs().length), 0, line + ': nothing offered');
    }
    // (the ink ran in the worker, the v318.36 path, when there is one)
    const off = await page.evaluate(() => __mstest.segOffCount);
    assert.ok(off == null || off > 0, 'worker runs: ' + off);
    assert.deepEqual(errors, []);
  });
}

// ---- from v319-colour-ink.test.mjs ----
// v319 in the browser (Fable Y1-1/2/5): a page drawn in coloured outlines and partly coloured in with a dark marker
// keeps every cell, through the worker's own copy of the ink (v318.36), with a black title band or not, and in
// thick lines; the picture keeps its colour, so the filled cells are offered as done after Build (colourSecs). On
// v318.37 the page-level verdict (inkLinesColoured) took the lines for fills from the fifth fill on, or at 14 px,
// and the page came back blank ('faint'), its colour dropped. Fails on v318.37.
{
  // a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in `lw` px lines of colour `line`, `fills` cells coloured in
  // with a dark blue marker (every other cell, as on a chessboard), a 40 px black title band under it (`band`); as a PNG
  async function picture(page, o = {}) {
    const b64 = await page.evaluate(async (o) => {
      const W = 1200,
        H = 1600,
        M = 110,
        S = 180,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      if (o.band) {
        g.fillStyle = '#000';
        g.fillRect(M, H - M - 40, 5 * S, 40);
      }
      g.fillStyle = 'rgb(20,60,150)';
      for (let i = 0, k = 0; i < 35 && k < (o.fills || 0); i++) {
        const cx = i % 5,
          cy = (i / 5) | 0;
        if ((cx + cy) % 2) continue;
        g.fillRect(M + cx * S, M + cy * S, S, S);
        k++;
      }
      g.strokeStyle = o.line;
      g.lineWidth = o.lw || 8;
      for (let i = 0; i <= 5; i++) {
        g.beginPath();
        g.moveTo(M + i * S, M);
        g.lineTo(M + i * S, M + 7 * S);
        g.stroke();
      }
      for (let j = 0; j <= 7; j++) {
        g.beginPath();
        g.moveTo(M, M + j * S);
        g.lineTo(M + 5 * S, M + j * S);
        g.stroke();
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, o);
    return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
  }
  async function settle(page) {
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => !__mstest.segBusy);
    await idle(page);
  }
  const warn = (page) =>
    page.evaluate(() => (__mstest.segWarn && !__mstest.segWarn.ok ? __mstest.segWarn.code : ''));
  const count = (page) => page.evaluate(() => __mstest.countedList().length);
  const offered = (page) => page.evaluate(() => __mstest.colourSecs().length);
  test('coloured outlines part coloured in keep every cell, and the filled ones are offered as done', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
    await sampleGuide(page);
    for (const o of [
      { line: 'rgb(220,30,30)', fills: 5, band: true },
      { line: 'rgb(220,30,30)', fills: 10, band: false },
      { line: 'rgb(40,60,200)', fills: 5, band: true },
      { line: 'rgb(220,30,30)', fills: 3, band: true, lw: 14 },
      { line: 'rgb(220,30,30)', fills: 0, band: true, lw: 14 },
    ]) {
      const nm = o.line + ', ' + o.fills + ' fills, band ' + o.band + ', ' + (o.lw || 8) + ' px: ';
      await page.setInputFiles('#sfFile', await picture(page, o));
      await settle(page);
      assert.equal(await warn(page), '', nm + 'no warning');
      assert.equal(await count(page), 35, nm + 'every cell');
      assert.ok(await page.evaluate(() => !!__mstest.chroma), nm + 'colour kept');
      assert.equal(await offered(page), o.fills, nm + 'fills offered');
    }
    // (the ink ran in the worker, the v318.36 path, when there is one)
    const off = await page.evaluate(() => __mstest.segOffCount);
    assert.ok(off == null || off > 0, 'worker runs: ' + off);
    assert.deepEqual(errors, []);
  });
}
