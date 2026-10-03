// v304, Match a colour. The camera: its colour is read under the ring after a pinch (it came from somewhere else),
// a pinch doesn't move the ring, a zoom is read at once, the live result isn't redrawn under a tap or a keyboard focus
// (taps on + To buy were lost) but can't stay stuck after a right-click or a lost press, a request that never answered
// can be started again, a torch that failed isn't shown on, and a failed copy says so, to screen readers too. The
// photo: read from a patch 6 CSS px across (it was 1 to 4 canvas pixels), not the whole ring (that mixed the outlines
// into small areas), and the ring stays on the photo. To buy: your brands first, another brand's marker only when
// it's clearly closer, under its own heading. Find similar: the marker itself left out, said what it's similar to;
// not on the Colorless Blenders.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, until, pause, ENGINE } from './helpers.mjs';

before(setup);
after(teardown);

const CAM = { skip: ENGINE !== 'chromium' && 'needs Chromium’s canvas camera' };
// a fake camera: a 640x480 canvas as a captureStream, 8x6 cells of their own colour (window.__grid, changeable), or
// a gradient (R = x, G = y) with window.__gradient; ± window.__camNoise on every channel
const fakeCam = () => {
  window.__gum = 0; window.__gumMode = 'ok'; window.__camNoise = 0;
  const md = navigator.mediaDevices || {};
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: md });
  md.getUserMedia = function () {
    window.__gum++;
    if (window.__gumMode === 'never') return new Promise(() => {});
    const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d');
    if (!window.__grid) window.__grid = Array.from({ length: 48 }, (_, k) => { g.fillStyle = `hsl(${(k * 137.5) % 360},70%,${35 + (k % 3) * 18}%)`; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); });
    const paint = () => {
      if (window.__gradient) { const im = g.createImageData(640, 480); for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) im.data.set([Math.round((x * 255) / 639), Math.round((y * 255) / 479), 128, 255], (y * 640 + x) * 4); g.putImageData(im, 0, 0); return; }
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { const n = window.__camNoise; g.fillStyle = `rgb(${window.__grid[y * 8 + x].map((u) => Math.max(0, Math.min(255, Math.round(u + (n ? (Math.random() * 2 - 1) * n : 0)))))})`; g.fillRect(x * 80, y * 80, 80, 80); }
    };
    paint(); setInterval(paint, 50);
    const st = c.captureStream(20), t = st.getVideoTracks()[0];
    if (window.__torch) { t.getCapabilities = () => ({ torch: true }); t.applyConstraints = () => Promise.reject(new Error('no torch')); }
    return Promise.resolve(st);
  };
};
async function camera(opts = {}) {
  const { page, ctx, errors } = await openApp({ width: 820, height: 1180, init: fakeCam });
  if (opts.gradient || opts.torch) await page.evaluate((o) => { window.__gradient = !!o.gradient; window.__torch = !!o.torch; }, opts);
  await welcome(page, 'look'); await page.click('#mCollection'); await page.click('#mkMatchBtn'); await idle(page);
  await page.click('.msrc [data-src="camera"]');
  await until(page, () => { const v = document.getElementById('matchVideo'); return v.readyState >= 2 && v.videoWidth > 0; }, null, 'the camera running');
  return { page, ctx, errors };
}
// pointer events on the video at fractions of its box
const onVideo = (page, evs) => page.evaluate((evs) => {
  const v = document.getElementById('matchVideo'), b = document.getElementById('matchVideoBox').getBoundingClientRect();
  for (const [t, id, fx, fy] of evs) v.dispatchEvent(new PointerEvent(t, { pointerId: id, button: 0, clientX: b.left + b.width * fx, clientY: b.top + b.height * fy, bubbles: true, cancelable: true }));
}, evs);
const tapVideo = (page, fx, fy) => onVideo(page, [['pointerdown', 3, fx, fy], ['pointerup', 3, fx, fy]]);
const ringAt = (page) => page.evaluate(() => { const r = document.getElementById('matchReticle'); return [Math.round(parseFloat(r.style.left) * 10) / 1000, Math.round(parseFloat(r.style.top) * 10) / 1000]; });
const hexNow = (page) => page.inputValue('#matchHex');
const shown = (page) => page.evaluate(() => { const s = document.querySelector('#matchResult .mcmp span'); return s ? s.style.background : ''; });
const rgbOf = (hex) => `rgb(${[1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)).join(', ')})`;
// on the gradient camera: how far (frame pixels; one step of the gradient is 2.5) the colour shown came from the frame's
// pixel under the ring
const ringOff = (page) => page.evaluate(() => {
  const v = document.getElementById('matchVideo'), rt = document.getElementById('matchReticle').getBoundingClientRect(), vr = v.getBoundingClientRect();
  const px = rt.left + rt.width / 2, py = rt.top + rt.height / 2, vw = v.videoWidth, vh = v.videoHeight, sc = Math.max(vr.width / vw, vr.height / vh);
  const u = (px - (vr.left + (vr.width - vw * sc) / 2)) / sc, w = (py - (vr.top + (vr.height - vh * sc) / 2)) / sc;
  const hex = document.getElementById('matchHex').value;
  return Math.hypot((parseInt(hex.slice(1, 3), 16) / 255) * 639 - u, (parseInt(hex.slice(3, 5), 16) / 255) * 479 - w);
});

test('Camera: a pinch zooms without moving the ring, and the colour is read under the ring at once, live, frozen and after Stop', CAM, async () => {
  const { page, errors } = await camera({ gradient: true });
  await tapVideo(page, 0.8, 0.7); await idle(page);
  assert.ok((await ringOff(page)) < 4, 'before the zoom');
  // two fingers either side of the middle, spread to 2.5x
  await onVideo(page, [['pointerdown', 11, 0.4, 0.5], ['pointerdown', 12, 0.6, 0.5], ['pointermove', 11, 0.25, 0.5], ['pointermove', 12, 0.75, 0.5]]);
  assert.deepEqual(await ringAt(page), [0.8, 0.7], 'the first finger of the pinch didn’t move the ring');
  // (one frame, not the next camera reading: the zoom is read straight away)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  assert.ok((await ringOff(page)) < 4, 'read under the ring after the zoom: ' + (await ringOff(page)));
  // the finger left after the pinch doesn't drag the ring
  await onVideo(page, [['pointerup', 12, 0.75, 0.5], ['pointermove', 11, 0.1, 0.2]]);
  assert.deepEqual(await ringAt(page), [0.8, 0.7]);
  await onVideo(page, [['pointerup', 11, 0.1, 0.2]]);
  await page.click('#matchFreeze');
  await onVideo(page, [['pointerdown', 13, 0.45, 0.5], ['pointerdown', 14, 0.55, 0.5], ['pointermove', 13, 0.4, 0.5], ['pointermove', 14, 0.6, 0.5], ['pointerup', 13, 0.4, 0.5], ['pointerup', 14, 0.6, 0.5]]);
  await idle(page);
  assert.ok((await ringOff(page)) < 4, 'frozen: ' + JSON.stringify([await ringOff(page), await ringAt(page), await hexNow(page), await page.evaluate(() => document.getElementById('matchVideo').style.transform)]));
  await page.click('#matchFreeze'); await page.click('#matchCamStop'); await page.click('#matchCamOff');
  await until(page, () => document.getElementById('matchVideo').readyState >= 2, null, 'the camera again');
  await idle(page);
  assert.ok((await ringOff(page)) < 4, 'after Stop and Start (back to 1x)');
  assert.deepEqual(errors, []);
});

test('Camera: taps on + To buy count while live; a right-press or a lost press doesn’t leave the result stuck', CAM, async () => {
  const { page, errors } = await camera();
  await page.evaluate(() => { window.__camNoise = 8; navigator.clipboard.writeText = async () => {}; });
  await tapVideo(page, 0.1, 0.1); await idle(page);
  let worked = 0;
  for (let k = 0; k < 8; k++) {
    let b = null;
    for (let t = 0; !b && t < 20; t++) b = await page.locator('#matchResult .wishbtn').first().boundingBox();
    const was = await page.evaluate(() => state.wish.length);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await pause(page, 80 + k * 20, 'a finger held as long as a tap');
    await page.mouse.up();
    await pause(page, 300, 'the click after the tap, and the hold let go');
    if ((await page.evaluate(() => state.wish.length)) !== was) worked++;
  }
  assert.ok(worked >= 7, worked + ' of 8 taps on + To buy worked');
  await page.evaluate(() => { window.__camNoise = 0; });
  // a right-press (a Mac opens its menu on the press, and the pointerup never comes), then the camera on another colour
  const paint = (rgb) => page.evaluate((rgb) => window.__grid.forEach((c, i, a) => { a[i] = rgb; }), rgb);
  await page.evaluate(() => { const r = document.querySelector('#matchResult .mbest'); r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 2, buttons: 2 })); r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 })); });
  await paint([30, 60, 200]);
  await until(page, () => document.getElementById('matchHex').value === '#1e3cc8', null, 'the camera reading blue');
  await pause(page, 400, 'a few camera readings');
  assert.equal(await shown(page), rgbOf('#1e3cc8'), 'not held by a right-press');
  // a press whose end is lost: held, then let go within 1.5 s
  await page.evaluate(() => document.querySelector('#matchResult .mbest').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0, buttons: 1 })));
  await paint([200, 60, 30]);
  await pause(page, 600, 'camera readings while pressed');
  assert.notEqual(await hexNow(page), '#1e3cc8', 'the camera reads another colour');
  assert.equal(await shown(page), rgbOf('#1e3cc8'), 'held while pressed');
  await pause(page, 1200, 'past the longest hold');
  assert.equal(await shown(page), rgbOf(await hexNow(page)), 'let go without a pointerup');
  assert.deepEqual(errors, []);
});

test('Camera: a row with the keyboard’s focus stays put while live, and the result catches up when the focus leaves', CAM, async () => {
  const { page, errors } = await camera();
  await tapVideo(page, 0.1, 0.1); await idle(page);
  // Tab to the first row (the keyboard: :focus-visible), the camera still
  await page.focus('#matchResult .mcopy'); await page.keyboard.press('Tab');
  const focused = () => page.evaluate(() => !!document.activeElement.closest('#matchResult .mrow'));
  assert.ok(await focused(), 'on a row');
  await page.evaluate(() => window.__grid.forEach((c, i, a) => { a[i] = [30, 60, 200]; }));
  await until(page, () => document.getElementById('matchHex').value === '#1e3cc8', null, 'the camera reading blue');
  await page.evaluate(() => { window.__camNoise = 8; });
  await pause(page, 1000, 'live readings, with the camera’s flicker, while the row has the focus');
  assert.ok(await focused(), 'the focus is still on the row');
  assert.notEqual(await shown(page), rgbOf('#1e3cc8'), 'not redrawn under the focus');
  await page.evaluate(() => { window.__camNoise = 0; });
  await page.focus('#matchFreeze');
  await until(page, () => { const h = document.getElementById('matchHex').value; return document.querySelector('#matchResult .mcmp span').style.background === `rgb(${[1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).join(', ')})`; }, null, 'the result catching up');
  assert.deepEqual(errors, []);
});

test('Camera: Start camera again after a request that never answered; a torch that failed stays off; a failed copy says so, as a status', CAM, async () => {
  const { page, errors } = await camera({ torch: true });
  await page.click('#matchTorch');
  await idle(page);
  assert.equal(await page.textContent('#matchTorch'), 'Light', 'not "Light on"');
  await page.click('#matchCamStop');
  await page.evaluate(() => { window.__gumMode = 'never'; });
  await page.click('#matchCamOff');
  await page.evaluate(() => { window.__gumMode = 'ok'; });
  await page.click('#matchCamOff');
  await until(page, () => document.getElementById('matchVideo').readyState >= 2, null, 'the camera after a second Start');
  // a copy that fails
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('no')); document.execCommand = () => false; });
  await page.click('#matchFreeze');
  await page.click('#matchResult .mcopy');
  await until(page, () => /Couldn’t copy/.test(document.querySelector('#matchOverlay .mcopied').textContent), null, 'the failure said');
  assert.equal(await page.getAttribute('#matchOverlay .mcopied', 'role'), 'status');
  assert.deepEqual(errors, []);
});

// a picture made in the page: w x h, fill(x, y) -> [r, g, b]
async function photo(page, w, h, fill) {
  const b64 = await page.evaluate(([w, h, fill]) => {
    const f = new Function('return ' + fill)(), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) im.data.set([...f(x, y), 255], (y * w + x) * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, [w, h, fill.toString()]);
  await page.evaluate(() => { document.getElementById('matchCanvas').width = 1; });
  await page.setInputFiles('#matchFile', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await until(page, () => document.getElementById('matchCanvas').width > 1, null, 'the photo shown');
}
const tapCanvas = (page, fx, fy) => page.evaluate(([fx, fy]) => new Promise((res) => {
  const cv = document.getElementById('matchCanvas'), r = cv.getBoundingClientRect(), x = r.left + r.width * fx, y = r.top + r.height * fy;
  cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  requestAnimationFrame(() => requestAnimationFrame(() => { cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: x, clientY: y, bubbles: true })); res(document.getElementById('matchHex').value); }));
}), [fx, fy]);

test('Photo: a noisy colour reads steadier than before, a stripe 7 px wide between outlines is still its own colour, and the ring stays on the photo', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look'); await page.click('#mCollection'); await page.click('#mkMatchBtn'); await idle(page);
  // grey 128 with ±60 noise (fixed), 1600 x 1200
  await photo(page, 1600, 1200, (x, y) => { const n = (((x * 7919 + y * 104729) ^ (x * y)) % 121) - 60; return [128 + n, 128 + n, 128 + n]; });
  const L = [];
  for (let k = 0; k < 24; k++) { const hex = await tapCanvas(page, 0.2 + (k % 6) * 0.12, 0.2 + Math.floor(k / 6) * 0.15); L.push(parseInt(hex.slice(1, 3), 16)); }
  const mean = L.reduce((s, v) => s + v, 0) / L.length, sd = Math.sqrt(L.reduce((s, v) => s + (v - mean) ** 2, 0) / L.length);
  // (1.3 now; 2.6 from v303's patch)
  assert.ok(sd < 1.9, 'spread of 24 readings: ' + sd.toFixed(2));
  // stripes: an orange one 7 CSS px wide between 2 px black lines, on white
  const geo = await page.evaluate(() => { const cv = document.getElementById('matchCanvas'); return cv.width / cv.getBoundingClientRect().width; });
  const W = 800, sw = Math.round(7 * geo * (W / 892)), x0 = 400;
  await photo(page, W, 600, new Function(`return (x, y) => (x >= ${x0 - 4} && x < ${x0}) || (x >= ${x0 + sw} && x < ${x0 + sw + 4}) ? [0, 0, 0] : x >= ${x0} && x < ${x0 + sw} ? [240, 140, 60] : [255, 255, 255]`)());
  assert.equal(await tapCanvas(page, (x0 + sw / 2) / W, 0.5), '#f08c3c', 'the stripe’s own colour');
  // a drag past the photo's edge: the ring at the edge, not over the black beside it
  const out = await page.evaluate(() => new Promise((res) => {
    const cv = document.getElementById('matchCanvas'), r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 6, button: 0, clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true }));
    cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 6, clientX: r.right + 40, clientY: r.bottom + 40, bubbles: true, cancelable: true }));
    cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 6, clientX: r.right + 40, clientY: r.bottom + 40, bubbles: true }));
    const g = document.getElementById('matchRing').getBoundingClientRect();
    res({ cx: g.left + g.width / 2, cy: g.top + g.height / 2, right: r.right, bottom: r.bottom });
  }));
  assert.ok(out.cx <= out.right && out.cy <= out.bottom, JSON.stringify(out));
  assert.deepEqual(errors, []);
});

const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311', 'Ohuhu|RV34'];
const storage = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', [KEY]: JSON.stringify({ mode: 'collection', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [] }) };
const heads = (page) => page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));

test('To buy: an Ohuhu collection sees Ohuhu markers first, and a Copic one only when clearly closer, named in full under its own heading', async () => {
  const { page, errors } = await openApp({ storage });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  // #005ab4: Copic B37 is 4.6 and Ohuhu B115 4.7: Ohuhu only
  await page.evaluate(() => window.msMatchHex('#005ab4')); await idle(page);
  assert.deepEqual((await heads(page)).filter((h) => /Closer/.test(h)), ['Closer ones you could buy']);
  assert.ok((await page.$$eval('#matchResult .mrow.buy', (l) => l.map((r) => r.getAttribute('aria-label')))).every((t) => /^Ohuhu /.test(t)));
  // #3a7bd5: only Copic B06 is clearly closer
  await page.evaluate(() => window.msMatchHex('#3a7bd5')); await idle(page);
  assert.ok((await heads(page)).includes('Closer in Copic'), JSON.stringify(await heads(page)));
  assert.equal(await page.textContent('#matchResult .mrow.buy .mnm b'), 'Copic B06');
  assert.equal(await page.locator('#matchResult .mtag').count(), 0, 'no brand letters on an Ohuhu-only result');
  // #000022: both
  await page.evaluate(() => window.msMatchHex('#000022')); await idle(page);
  const h = await heads(page);
  assert.ok(h.includes('Closer ones you could buy') && h.includes('Closer still in Copic'), JSON.stringify(h));
  assert.equal(await page.locator('#matchResult .mrow.buy').count(), 4);
  assert.deepEqual(errors, []);
});

test('Find similar leaves the marker out and says what it’s like; a same-colour twin says "Same colour"; none on a Colorless Blender', async () => {
  const { page, errors } = await openApp({ storage });
  const sheet = (brand, code) => page.evaluate(([b, c]) => openMarkerSheet(COLORS.findIndex((m) => m.brand === b && m.code === c)), [brand, code]);
  await sheet('Ohuhu', 'R014');
  await page.click('#mkSimilar'); await idle(page);
  assert.equal(await page.textContent('#matchResult .msimh'), 'Similar to Ohuhu R014');
  assert.equal(await page.textContent('#matchResult .mcmp span i'), 'R014');
  assert.doesNotMatch(await page.textContent('#matchResult .mbname'), /^R014 /);
  assert.equal(await page.locator('#matchResult [data-copy^="Ohuhu R014 "]').count(), 0, 'R014 not listed');
  // the same colour typed again is an ordinary match, R014 first
  await page.fill('#matchHex', ''); await page.fill('#matchHex', await page.evaluate(() => COLORS.find((m) => m.code === 'R014' && m.brand === 'Ohuhu').hex)); await idle(page);
  assert.equal(await page.locator('#matchResult .msimh').count(), 0);
  // RV33 (not owned) and RV34 (owned) are the same colour
  await page.click('#matchClose');
  await sheet('Ohuhu', 'RV33');
  await page.click('#mkSimilar'); await idle(page);
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
