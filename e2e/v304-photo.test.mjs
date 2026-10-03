// v304 (Photo pattern): the photo stays on the picture when it is turned, cropped (by hand or Auto), tilted or
// straightened, and Undo puts it back exactly (also a placement made by hand); a straightened guide saved before the
// Photo pattern was laid again places its photo afresh when reopened; the photo's size is kept within limits set by
// its Fill size, and only while it's being sized; a photo still loading when another is picked, or after another
// pattern was chosen, is dropped; with zones the match summary counts only the Photo zones; Palette › From photo
// keeps the newest of two quick picks; a photo with no colour in it leaves every section white and says so (with
// a way to colour its grey parts), and a photo off the drawing is said to be; the no-colour line and the suggested
// marker count follow Undo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, letterGuide, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// in the page: a coloured copy of the guide as it is (a smooth colour field over the picture, lines dark), laid over
// it exactly; and how far each section's photo colour is from that field (CIE76, mean), through turn and crop
const lib = () => {
  const t = __mstest;
  window.__truth = (u, v) => [35 + 45 * v, 45 * Math.cos(u * 2 * Math.PI), 45 * Math.sin(u * 2 * Math.PI)];
  window.__lab2rgb = (lab) => {
    const fy = (lab[0] + 16) / 116, fx = fy + lab[1] / 500, fz = fy - lab[2] / 200;
    const f = (x) => (x > 0.206893 ? x * x * x : (x - 16 / 116) / 7.787), X = f(fx) * 0.95047, Y = f(fy), Z = f(fz) * 1.08883;
    const g = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); };
    return [g(X * 3.2406 - Y * 1.5372 - Z * 0.4986), g(-X * 0.9689 + Y * 1.8758 + Z * 0.0415), g(X * 0.0557 - Y * 0.204 + Z * 1.057)];
  };
  // a photo of the guide as it is now, each section painted by fn(l, u, v) (rgb, or null for the paper)
  window.__paint = (fn, paper, noLines) => {
    const s = Math.min(1, 1000 / Math.max(t.W, t.H)), pw = Math.round(t.W * s), ph = Math.round(t.H * s);
    const c = document.createElement('canvas'); c.width = pw; c.height = ph;
    const g = c.getContext('2d'), im = g.createImageData(pw, ph), L = t.labels;
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const gx = Math.floor(((i + 0.5) / pw) * t.W), gy = Math.floor(((j + 0.5) / ph) * t.H), q = (j * pw + i) * 4, l = L[gy * t.W + gx];
      const rgb = l === -1 && !noLines ? [40, 36, 34] : (l > 0 && fn(l, (gx + 0.5) / t.W, (gy + 0.5) / t.H)) || paper || [252, 252, 250];
      im.data[q] = rgb[0]; im.data[q + 1] = rgb[1]; im.data[q + 2] = rgb[2]; im.data[q + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return { c, pw, ph };
  };
  window.__place = (fn, paper, noLines) => {
    const p = __paint(fn, paper, noLines);
    t.setPhotoRef(t.photoFromImage(p.c), true);
    t.photoXf = { cx: t.W / 2, cy: t.H / 2, sx: t.W / p.pw, sy: t.H / p.ph, r: 0 };
    t.photoRecolour();
  };
  // the guide point (normalised) back to the picture as it was when the photo was made (turned 0 or 90, cropped)
  window.__src = (gx, gy) => {
    const c = t.cropRect || { x: 0, y: 0, w: 1, h: 1 }, X = c.x + gx * c.w, Y = c.y + gy * c.h;
    return t.rot90 === 90 ? [Y, 1 - X] : [X, Y];
  };
  window.__err = () => {
    const C = t.photoColours(), lp = t.labelPts;
    let s = 0, n = 0;
    for (const l of t.assignData.order) {
      if (!C.has[l] || !lp[l]) continue;
      const uv = __src(lp[l].x / t.W, lp[l].y / t.H), T = __truth(uv[0], uv[1]);
      s += Math.hypot(T[0] - C.lab[l * 3], T[1] - C.lab[l * 3 + 1], T[2] - C.lab[l * 3 + 2]); n++;
    }
    return s / n;
  };
  window.__xf = () => { const X = t.photoXf; return [X.cx, X.cy, X.sx, X.sy, X.r]; };
};

async function letter(page) {
  // Honolulu 320, a page downloaded at 850 x 1100 (enlarged before its sections are found)
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcLook'); await idle(page);
  await letterGuide(page);
  await page.evaluate(lib);
}
async function sample(page) {
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  await page.evaluate(lib);
}
const field = (l, u, v) => __lab2rgb(__truth(u, v));

test('the photo stays on the picture through Turn, Crop, Auto crop and Tilt; Undo puts it back exactly', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await letter(page);
  const r = await page.evaluate((fieldSrc) => {
    const t = __mstest, f = eval('(' + fieldSrc + ')'), out = {};
    __place(f);
    out.k = t.srcK;
    out.e0 = __err(); out.x0 = __xf();
    t.geoSet({ rot90: 90, crop: null }); t.buildGuide(); out.eRot = __err();
    t.geoSet({ crop: { x: 0.1, y: 0.15, w: 0.6, h: 0.65 } }); t.buildGuide(); out.eCrop = __err(); out.kCrop = t.srcK;
    t.autoCrop(); t.buildGuide(); out.eAuto = __err();
    const r0 = t.photoXf.r; t.geoSet({ tilt: 3 }); t.buildGuide(); out.turn = ((t.photoXf.r - r0) * 180) / Math.PI;
    for (let i = 0; i < 4; i++) t.doUndoSeg();
    t.buildGuide(); out.e1 = __err(); out.x1 = __xf(); out.geo = [t.rot90, t.cropRect];
    return out;
  }, field.toString());
  assert.ok(r.k > 1, 'the page was enlarged: ' + r.k);
  assert.ok(r.e0 < 8, 'placed: ' + r.e0);
  // (v303: 40 or more after each)
  assert.ok(r.eRot < r.e0 + 3, 'turned: ' + r.eRot);
  assert.ok(r.eCrop < r.e0 + 3, 'cropped: ' + r.eCrop + ' (enlarged ' + r.kCrop + ')');
  assert.ok(r.eAuto < r.e0 + 3, 'Auto crop: ' + r.eAuto);
  assert.ok(Math.abs(r.turn - 3) < 1e-6, 'tilted 3°: the photo turns 3° with it: ' + r.turn);
  assert.deepEqual(r.geo, [0, null]);
  r.x1.forEach((v, i) => assert.ok(Math.abs(v - r.x0[i]) < 1e-9, 'Undo: placed exactly as before'));
  assert.ok(Math.abs(r.e1 - r.e0) < 1e-6);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a photo placed by hand: Straighten, then Undo, keeps it where it was (not placed afresh at Build)', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await letter(page);
  await page.evaluate((fieldSrc) => {
    __place(eval('(' + fieldSrc + ')'));
    __mstest.photoXf = { cx: __mstest.W * 0.4, cy: __mstest.H * 0.55, sx: 0.9, sy: 0.9, r: 0.35 };
    __mstest.photoRecolour();
  }, field.toString());
  // Done lining up
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfPhAlign'); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest;
    const x0 = __xf(), a0 = t.photoAlign, w = t.pgOrig.width, h = t.pgOrig.height;
    t.geoSet({ q: [[w * 0.03, h * 0.02], [w * 0.98, h * 0.04], [w * 0.97, h * 0.97], [w * 0.02, h * 0.99]] });
    const waiting = t.phRefit;
    t.doUndoSeg();
    t.buildGuide();
    return { x0, x1: __xf(), waiting, after: t.phRefit, align: t.photoAlign, a0 };
  });
  assert.equal(r.waiting, true, 'straightened: to be placed again');
  assert.deepEqual(r.x1, r.x0);
  assert.equal(r.after, false);
  assert.equal(r.a0, false);
  assert.equal(r.align, false, 'lining up not switched on');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('straightened while another pattern was used, saved and reopened: choosing Photo places the photo afresh', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await letter(page);
  await page.evaluate((fieldSrc) => __place(eval('(' + fieldSrc + ')')), field.toString());
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  const d = await page.evaluate(() => {
    const t = __mstest, w = t.pgOrig.width, h = t.pgOrig.height;
    t.geoSet({ q: [[w * 0.03, h * 0.02], [w * 0.98, h * 0.04], [w * 0.97, h * 0.97], [w * 0.02, h * 0.99]] });
    t.buildGuide();
    return { d: t.currentDesignObj(), x: __xf(), fam: t.family };
  });
  assert.equal(d.fam, 'gradient');
  assert.equal(d.d.payload.style.photo.refit, true, 'saved as still to be placed again');
  await page.evaluate((d) => __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Straightened', W: d.W, H: d.H }), null), d.d);
  await page.waitForFunction(() => !!__mstest.photoRef && __mstest.phRefit); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="photo"]'); await idle(page);
  const after = await page.evaluate(() => ({ x: __xf(), refit: __mstest.phRefit, fam: __mstest.family }));
  assert.equal(after.fam, 'photo');
  assert.equal(after.refit, false);
  // (v303: still where it was on the picture before it was straightened)
  assert.notDeepEqual(after.x, d.x);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a new photo placed by hand is not placed afresh later because the picture was straightened before', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await letter(page);
  const r = await page.evaluate((fieldSrc) => {
    const t = __mstest, f = eval('(' + fieldSrc + ')'), w = t.pgOrig.width, h = t.pgOrig.height;
    __place(f);
    t.geoSet({ q: [[w * 0.03, h * 0.02], [w * 0.98, h * 0.04], [w * 0.97, h * 0.97], [w * 0.02, h * 0.99]] });
    const waiting = t.phRefit;
    __place(f);
    t.photoXf = { cx: t.W * 0.3, cy: t.H * 0.3, sx: 0.5, sy: 0.5, r: -0.2 };
    const x0 = __xf();
    t.buildGuide();
    return { waiting, x0, x1: __xf() };
  }, field.toString());
  assert.equal(r.waiting, true);
  assert.deepEqual(r.x1, r.x0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a small photo keeps its size when dragged; sizing it stops at 1/50 and 30 times its Fill size', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  const r = await page.evaluate(() => {
    const t = __mstest, c = document.createElement('canvas'); c.width = 20; c.height = 15;
    const g = c.getContext('2d'); g.fillStyle = '#2350c8'; g.fillRect(0, 0, 20, 15);
    t.setPhotoRef(t.photoFromImage(c), true);
    t.photoFit('fill');
    const fill = t.photoXf.sx;
    t.photoMove({ x: 100, y: 100 }, { x: 140, y: 120 }, 1, 0);
    const dragged = t.photoXf.sx;
    t.photoMove({ x: 100, y: 100 }, { x: 100, y: 100 }, 1e-6, 0);
    const small = t.photoXf.sx;
    t.photoMove({ x: 100, y: 100 }, { x: 100, y: 100 }, 1e9, 0);
    return { fill, dragged, small, big: t.photoXf.sx };
  });
  assert.ok(r.fill > 50, 'Fill is past the old fixed limit: ' + r.fill);
  // (v303: shrunk to 50 by a drag)
  assert.equal(r.dragged, r.fill);
  assert.ok(Math.abs(r.small - r.fill / 50) < 1e-6, 'smallest: ' + r.small);
  assert.ok(Math.abs(r.big - r.fill * 30) < 1e-6, 'largest: ' + r.big);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// the next photo picked stays undecoded until window.__release() is called
const holdNext = (page) => page.evaluate(() => {
  const Real = window.Image, d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  window.__release = null;
  window.Image = function () {
    const im = new Real();
    Object.defineProperty(im, 'src', { configurable: true, set(v) { if (String(v).startsWith('blob:') && !window.__release) { window.Image = Real; window.__release = () => d.set.call(im, v); } else d.set.call(im, v); }, get() { return d.get.call(im); } });
    return im;
  };
});
const png = (page, w, h, col) => page.evaluate(async ([w, h, col]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, w, h);
  const b = await new Promise((r) => c.toBlob(r, 'image/png'));
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); });
}, [w, h, col]);
async function pickRef(page, b64) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => __mstest.pickPhotoRef())]);
  await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
}

test('a Photo pattern photo that loads after another pattern was chosen, or after a newer pick, is dropped', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const red = await png(page, 300, 200, '#c8281e'), blue = await png(page, 200, 300, '#2350c8');
  // picked, then Gradient chosen while it decodes
  await holdNext(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
  await page.waitForFunction(() => !!window.__release);
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 400))); await idle(page);
  // (v303: the pattern went back to Photo)
  assert.equal(await page.evaluate(() => __mstest.family), 'gradient');
  assert.equal(await page.evaluate(() => !!__mstest.photoRef), false);
  // two picks: the first still decoding when the second arrives
  await holdNext(page);
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc2.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
  await page.waitForFunction(() => !!window.__release);
  await pickRef(page, blue);
  await page.waitForFunction(() => !!__mstest.photoRef && __mstest.photoRef.w === 200); await idle(page);
  await page.evaluate(() => window.__release());
  await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 400))); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoRef.w), 200, 'the newer photo stays');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('with zones, the match summary counts only the sections of zones with the Photo pattern', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  await page.evaluate((fieldSrc) => __place(eval('(' + fieldSrc + ')')), field.toString());
  const all = await page.evaluate(() => __mstest.assignData.order.length);
  await page.click('.sftabbtn[data-t="pattern"]');
  const half = await page.evaluate(() => {
    const t = __mstest, ls = t.assignData.order.filter((l) => t.comps[l].cy > t.H / 2), z = t.zoneNew();
    t.zoneMove(ls, z.id); t.zoneSelect(z.id); t.renderControls();
    return { n: ls.length, id: z.id };
  });
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  const r = await page.evaluate((id) => {
    const t = __mstest; t.zoneSelect(0); t.photoRecolour(); t.photoStatsHTML();
    return { tot: t.phStats.tot, fams: [t.family], zoneFam: id };
  }, half.id);
  // (v303: every section, the Gradient zone's too)
  assert.ok(r.tot <= all - half.n, r.tot + ' counted of ' + all + ', ' + half.n + ' in the Gradient zone');
  assert.ok(r.tot > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Palette › From photo: of two quick picks, the newer one is used even when the older is read last', async () => {
  const { page, errors, ctx } = await openApp({
    width: 1180, height: 820,
    // the first photo read is slow
    init: () => {
      const real = FileReader.prototype.readAsDataURL;
      let first = true;
      FileReader.prototype.readAsDataURL = function (f) {
        if (first && f && f.name === 'slow.png') { first = false; setTimeout(() => real.call(this, f), 600); } else real.call(this, f);
      };
    },
  });
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  const red = await png(page, 60, 40, '#c8281e'), blue = await png(page, 60, 40, '#2350c8');
  await page.setInputFiles('#photoFile', { name: 'slow.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
  await page.setInputFiles('#photoFile', { name: 'fast.png', mimeType: 'image/png', buffer: Buffer.from(blue, 'base64') });
  await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 1000)));
  const src = await page.evaluate(() => document.getElementById('photoThumb').src);
  // (v303: the slow red one, read last, replaced the blue)
  assert.ok(src.endsWith(blue.slice(-40)), 'the thumbnail is the newer photo');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// a photo of a page before it was coloured (here a blank sheet): warm paper, a little shading
const uncoloured = (l) => (l % 25 === 0 ? [228, 220, 204] : null);
const cream = [240, 232, 214];

test('a photo with no colour leaves every section white and says so; the guide saves and reopens with none coloured', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const r = await page.evaluate(([fSrc, paper]) => {
    const t = __mstest;
    __place(eval('(' + fSrc + ')'), paper, true);
    // (it can't be lined up: no lines in it)
    t.photoTryAutoAlign(true);
    t.photoRecolour();
    t.renderControls();
    const d = t.currentDesignObj();
    return { N: t.assignData.N, paper: Object.keys(t.assignData.paper || {}).length, none: t.phNone[0], text: (document.querySelector('.sfphstat') || {}).textContent, n: d.n, keys: d.keys.length, d };
  }, [uncoloured.toString(), cream]);
  // (v303: every section coloured in near-white greys)
  assert.equal(r.N, 0);
  assert.ok(r.paper > 100);
  assert.ok(r.none && !r.none.off && r.none.grey < 0.05, JSON.stringify(r.none));
  assert.match(r.text, /^No colour in this photo, so every section is left white\. Choose a photo of the page once it’s coloured in\./);
  assert.match(r.text, /If it’s a coloured page, line it up first\./);
  assert.ok(!/grey markers/.test(r.text));
  assert.equal(r.n, 0);
  assert.equal(r.keys, 0);
  await page.evaluate((d) => __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Uncoloured', W: d.W, H: d.H }), null), r.d);
  await page.waitForFunction(() => !!__mstest.photoRef && __mstest.assignData); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.assignData.N), 0);
  await page.evaluate(() => __mstest.saveNow());
  await page.waitForFunction(() => __mstest.inLibrary); await idle(page);
  // white areas coloured after all: laid as before
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfPhPaper'); await idle(page);
  assert.ok((await page.evaluate(() => __mstest.assignData.N)) > 100);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('pale colouring, or a few coloured sections, is laid as before', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  const r = await page.evaluate(() => {
    const t = __mstest, hsl = (h, s, l) => { const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
    __place((l) => hsl((l * 47) % 360, 0.6, 0.9));
    const pale = { N: t.assignData.N, none: !!t.phNone[0] };
    __place((l) => (l % 12 === 0 ? hsl((l * 47) % 360, 0.7, 0.5) : null));
    return { pale, few: { N: t.assignData.N, none: !!t.phNone[0] } };
  });
  assert.ok(r.pale.N > 100 && !r.pale.none, JSON.stringify(r.pale));
  assert.ok(r.few.N > 3 && !r.few.none, JSON.stringify(r.few));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('grey shading with no colour: Use grey markers for the grey parts colours it, and is saved with the photo', async () => {
  const { page, errors, ctx } = await openApp({ width: 390, height: 844 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.evaluate(() => { __place((l) => (l % 2 ? [175, 175, 172] : null)); __mstest.renderControls(); });
  assert.equal(await page.evaluate(() => __mstest.assignData.N), 0);
  await page.click('#sfPhGreys'); await idle(page);
  const r = await page.evaluate(() => ({ N: __mstest.assignData.N, greys: __mstest.photoGreys, d: __mstest.currentDesignObj() }));
  assert.ok(r.N > 30, 'the grey sections coloured: ' + r.N);
  assert.equal(r.greys, true);
  assert.equal(r.d.payload.style.photo.greys, true);
  await page.evaluate((d) => __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Grey', W: d.W, H: d.H }), null), r.d);
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoGreys), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a photo dragged off the drawing is said to be, and the sections are laid as before', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const r = await page.evaluate((fSrc) => {
    const t = __mstest;
    __place(eval('(' + fSrc + ')'));
    t.photoXf = Object.assign({}, t.photoXf, { cx: t.W * 3 });
    t.photoRecolour(); t.renderControls();
    return { N: t.assignData.N, none: t.phNone[0], text: (document.querySelector('.sfphstat') || {}).textContent };
  }, field.toString());
  assert.ok(r.none && r.none.off);
  assert.ok(r.N > 100);
  assert.match(r.text, /^The photo isn’t over the picture\. Drag it onto the drawing, or tap Line up photo\./);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('with zones, a photo with no colour says so of the zone', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const r = await page.evaluate(([fSrc, paper]) => {
    const t = __mstest;
    __place(eval('(' + fSrc + ')'), paper, true);
    const ls = t.assignData.paper ? Object.keys(t.assignData.paper).map(Number).filter((l) => t.comps[l].cy > t.H / 2) : [];
    const z = t.zoneNew();
    t.zoneMove(ls, z.id); t.zoneSelect(z.id);
    t.photoRecolour(); t.renderControls();
    return { fam: t.family, n: ls.length, none: t.phNone[z.id], text: (document.querySelector('.sfphstat') || {}).textContent };
  }, [uncoloured.toString(), cream]);
  assert.equal(r.fam, 'photo');
  assert.ok(r.n > 10);
  assert.ok(r.none && !r.none.off);
  assert.match(r.text, /^No colour in the photo over this zone, so every section is left white\./);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Undo from a photo with no colour back to a coloured one takes the no-colour line away', async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await sample(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.evaluate(([fSrc, uSrc, paper]) => {
    __place(eval('(' + fSrc + ')'));
    window.__coloured = __mstest.photoRef;
    __place(eval('(' + uSrc + ')'), paper, true);
    __mstest.renderControls();
  }, [field.toString(), uncoloured.toString(), cream]);
  assert.match(await page.textContent('.sfphstat'), /^No colour in this photo/);
  // Undo back to the coloured photo (choosing a photo and placing it are steps of their own)
  for (let i = 0; i < 4 && !(await page.evaluate(() => __mstest.photoRef === window.__coloured)); i++) {
    await page.click('#sfPlanUndo'); await idle(page);
  }
  assert.equal(await page.evaluate(() => __mstest.photoRef === window.__coloured), true);
  const r = await page.evaluate(() => ({ N: __mstest.assignData.N, none: __mstest.phNone[0] || null, text: (document.querySelector('.sfphstat') || {}).textContent || '' }));
  assert.ok(r.N > 100, 'the coloured photo’s laying is back: ' + r.N);
  // (before the fix: the line stayed after Undo)
  assert.equal(r.none, null);
  assert.ok(!/No colour/.test(r.text), r.text);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Use N, a change of marker count, then Undo: the suggestion to use N doesn’t come back', notOnWebKit(WK.scale), async () => {
  const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  // the guide's own sections painted with 8 markers from the collection (as e2e/photo-choice.test.mjs)
  const b64 = await page.evaluate(async () => {
    const M = __mstest, pool = M.colour.poolFor('all').filter((m) => m.lab && m.lab[0] < 85), truth = [];
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    while (truth.length < 8) { const m = pool[Math.floor(rnd() * pool.length)]; if (!truth.some((o) => de2000(o.lab, m.lab) < 10)) truth.push(m); }
    const of = {}; M.countedList().forEach((l, i) => { of[l] = truth[i % 8]; });
    const W = M.W, H = M.H, lab = M.labels, gr = M.gray, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
    for (let p = 0; p < W * H; p++) {
      const m = lab[p] > 0 && of[lab[p]];
      const rgb = m ? [1, 3, 5].map((k) => parseInt(m.hex.slice(k, k + 2), 16)) : [gr[p], gr[p], gr[p]].map((v) => Math.min(255, v * 1.2));
      d[p * 4] = rgb[0]; d[p * 4 + 1] = rgb[1]; d[p * 4 + 2] = rgb[2]; d[p * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking); await idle(page);
  await page.evaluate(() => { const M = __mstest, r = M.photoRef; M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 }; M.limitN = 4; M.photoRecolour(); });
  await page.waitForFunction(() => __mstest.photoSug && !__mstest.photoSug.pending); await idle(page);
  assert.match((await page.textContent('#sfPhSug')).trim(), /^About 8 markers .* Use 8$/);
  await page.click('#sfPhUse'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.limitN), 8);
  assert.equal((await page.textContent('#sfPhSug')).trim(), '');
  // a nudge of the marker count, then Undo back to the 8
  await page.evaluate(() => { __mstest.limitN = 9; __mstest.photoRecolour(); }); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.limitN), 8);
  // (before the fix: “About 8 markers … Use 8” again, with 8 already in use)
  assert.equal((await page.textContent('#sfPhSug')).trim(), '');
  assert.deepEqual(errors, []);
  await ctx.close();
});
