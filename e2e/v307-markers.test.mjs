// v307 (markers branch): Palette › From photo's "Photo looks warm · Balance it" and "Tap something white"; Help › Your
// data for an iPhone or iPad, with whether the browser keeps the data; contrast of the instructions on disabled
// buttons, the Palette's brand letters and the Print sheet's icon; the service worker's page loads; a hex code in the
// Markers search.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import * as pw from 'playwright';
import { setup, teardown, openApp, idle, until, welcome, sampleGuide, ENGINE, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

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
    im.rect(0, y, w, y + 1, [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round));
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

test('Help › Your data: for an iPhone or iPad, the Home Screen app’s own storage, Library › Restore, and whether Safari keeps your data', async () => {
  // Safari agreed to keep it, when the welcome asked
  const a = await openApp({ width: 820, height: 1180, userAgent: IPAD, init: `(${storageIs})(true)` });
  await a.page.check('#wcSets input[data-i="3"]');
  await a.page.click('#wcAdd');
  await idle(a.page);
  assert.equal(await a.page.evaluate(() => localStorage.getItem('ms-persisted')), '1', 'the answer is kept');
  await a.page.click('#wcLook');
  await idle(a.page);
  const t = await yourData(a.page);
  // (v307-final: Ben's shorter wording)
  assert.match(t, /On iPhone and iPad, Safari deletes a site’s data after about seven days without opening it\./);
  assert.match(t, /has its own storage: back up here first, then restore the file there\./);
  // (v308: named as the Library's button is)
  assert.match(t, /Library › Restore brings it back on any iPhone, iPad or computer\./);
  assert.doesNotMatch(t, /On iPhone,|any phone/);
  assert.equal(await a.page.textContent('#helpKeep'), 'Safari has agreed to keep your data on this device.');
  // Safari said no
  const b = await openApp({ width: 820, height: 1180, userAgent: IPAD, init: `(${storageIs})(false)` });
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

// ---- contrast ----------------------------------------------------------------------------------------------------
// the text's contrast with what is behind it, as seen: colours and opacities composited down from the page
const contrastOf = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
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
    assert.equal(await page.textContent('#results .empty'), `“${q}” looks like a colour, not a marker code.`);
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
