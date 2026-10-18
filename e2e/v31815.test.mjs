// v318.15 in the browser: a new photo is on the picture at once, with the controls out of sight until its sections are
// in place (a guide open before stays out of sight too); specks in the paper round a drawing go, found in steps just
// as in one go; Trim it for a binding along the top, then Undo; the shading presets and Light from › The edges; Radial ›
// Rings › Follow the drawing, its row at phone width; Matching shapes alike on a mandala.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

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
  const st = () => page.evaluate(() => ({ mode: __mstest.shadeMode, light: __mstest.styleVars.shadeLight }));
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
  assert.equal(await page.getAttribute('#sfShape [data-v="radial"]', 'aria-pressed'), 'true', 'under Radial');
  const fit = await page.evaluate(() => {
    const r = document.getElementById('sfRingKind').getBoundingClientRect();
    return { right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth };
  });
  assert.ok(fit.right <= fit.vw + 1 && fit.sw <= fit.vw + 1, JSON.stringify(fit));
  assert.deepEqual(errors, []);
});

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
