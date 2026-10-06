// v307 (markers branch): Palette › From photo's "Photo looks warm · Balance it" for a photo with no paper (a tray of
// caps under a lamp) and "Tap something white"; the service worker's page loads; Markers' search for a hex code;
// Help › Your data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createApp, memoryStorage } from './harness.mjs';

const app = () => createApp({ localStorage: memoryStorage() });

// ---- synthetic photos (drawn here) -------------------------------------------------------------------------------
function canvas(w, h, bg) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) d.set([...bg, 255], p * 4);
  return { w, h, d };
}
function rect(im, x0, y0, x1, y1, c) {
  for (let y = Math.max(0, y0); y < Math.min(im.h, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(im.w, x1); x++) im.d.set(c, (y * im.w + x) * 4);
}
function ellipse(im, cx, cy, rx, ry, c) {
  for (let y = 0; y < im.h; y++)
    for (let x = 0; x < im.w; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) im.d.set(c, (y * im.w + x) * 4);
}
const toLin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
const toS = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
// the light's colour, per channel in linear light
function cast(im, k) {
  for (let i = 0; i < im.d.length; i += 4)
    for (let c = 0; c < 3; c++) im.d[i + c] = toS(Math.min(1, toLin(im.d[i + c]) * k[c]));
  return im;
}
function hsl(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12,
      a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
// a tray of caps seen from above, as Ben photographs his: a rainbow of round caps (strong and pale rows) on a dark
// bag, each with a small white label, under a dim, warm lamp (the light measured on his photo: white labels at
// linear 0.53 / 0.39 / 0.25)
const TRAY_LIGHT = [0.55, 0.41, 0.26];
function tray(w, h, light = TRAY_LIGHT) {
  const im = canvas(w, h, [26, 22, 24]),
    cols = 10,
    rows = 7,
    cw = w / cols,
    rh = h / rows,
    r = Math.min(cw, rh) * 0.45;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * cw,
        cy = (j + 0.5) * rh;
      ellipse(im, cx, cy, r, r, hsl(((i + j * 0.3) / cols) * 330, 0.6, j % 2 ? 0.62 : 0.4));
      const lw = Math.max(1, Math.round(r * 0.7));
      rect(
        im,
        Math.round(cx - lw / 2),
        Math.round(cy - lw / 2),
        Math.round(cx + lw / 2),
        Math.round(cy + lw / 2),
        [246, 245, 240],
      );
    }
  return cast(im, light);
}
// sunsets: a sky from violet to orange over dark land, a pale sun and warm clouds (the sun blown out to near-white in
// one); the same exposed darker
function sunset(w, h, { sun = [255, 240, 200], light = [1, 1, 1] } = {}) {
  const im = canvas(w, h, [30, 25, 40]);
  for (let y = 0; y < h * 0.66; y++) {
    const t = y / h;
    rect(
      im,
      0,
      y,
      w,
      y + 1,
      [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round),
    );
  }
  ellipse(im, w / 2, h / 2, w * 0.075, w * 0.075, sun);
  ellipse(im, w / 4, h / 6, w * 0.19, h * 0.07, [250, 214, 190]);
  ellipse(im, w * 0.72, h * 0.22, w * 0.18, h * 0.06, [250, 214, 190]);
  return cast(im, light);
}
const SUNSETS = {
  'a sunset': sunset(160, 120),
  'a sunset with the sun blown out': sunset(160, 120, { sun: [255, 253, 248] }),
  'a sunset exposed darker': sunset(160, 120, { light: [0.55, 0.5, 0.45] }),
  'a dim sunset, warm all over': sunset(160, 120, { light: [0.6, 0.45, 0.3] }),
};
const arr = (im) => JSON.stringify([...im.d]);
// paperWarm and photoWarm on one photo (as the app reads it: 160 × 120)
function offers(E, im) {
  return JSON.parse(
    E(`(function () { const d = new Uint8ClampedArray(${arr(im)}), p = paperWarm(d), q = photoWarm(d, ${im.w});
      return JSON.stringify({ paper: !!p, photo: q && { lab: [...q.lab], warm: q.warm, gain: [...q.fix.gain] } }); })()`),
  );
}
// an image the harness's canvas reads back exactly, for extractPhotoPalette (no more than 9000 pixels: not scaled)
function harnessImage(a, im) {
  const x = new (a.__eval('Image'))();
  x.src = 'data:image/x-mslabels;' + im.w + ',' + im.h + ',' + Buffer.from(im.d.buffer).toString('base64');
  return x;
}

test('Photo looks warm: a warm, dim tray of caps with no paper is offered a balance from its white labels', () => {
  const E = app().__eval;
  const r = offers(E, tray(160, 120));
  assert.equal(r.paper, false, 'no paper in the photo');
  assert.ok(r.photo, 'offered');
  assert.equal(r.photo.warm, true, 'warm, not only dim: ' + r.photo.lab);
  assert.ok(r.photo.lab[0] >= 35 && r.photo.lab[0] < 80, 'the labels are dim: L* ' + r.photo.lab[0]);
  assert.ok(r.photo.gain[2] > r.photo.gain[0] * 1.5, 'it cools the picture: ' + r.photo.gain);
  // the white labels come out about paper white (L* 95) and grey
  const lab = JSON.parse(
    E(`(function () { const d = new Uint8ClampedArray(${arr(tray(160, 120))}), q = photoWarm(d, 160);
      let best = null;
      for (let i = 0; i < d.length; i += 4) if (!best || d[i] + d[i + 1] + d[i + 2] > best[0] + best[1] + best[2]) best = [d[i], d[i + 1], d[i + 2]];
      const px = lightApply(q.fix, best[0], best[1], best[2]); return JSON.stringify([...rgbLab8(px[0], px[1], px[2])]); })()`),
  );
  assert.ok(lab[0] > 92 && lab[0] < 98, 'about L* 95: ' + lab);
  assert.ok(Math.hypot(lab[1], lab[2]) < 4, 'the cast gone: ' + lab);
  // the same tray in a darker, neutral room: offered as dim, not warm
  const dim = offers(E, tray(160, 120, [0.4, 0.4, 0.4]));
  assert.ok(dim.photo && dim.photo.warm === false, JSON.stringify(dim));
  // and in daylight: nothing to offer
  assert.equal(offers(E, tray(160, 120, [1, 1, 1])).photo, null);
});

test('Photo looks warm: balancing the tray brings back its blues, greens and violets (Ben’s markers)', () => {
  const a = createApp(),
    E = a.__eval;
  const im = tray(100, 75),
    fix = E(`photoWarm(new Uint8ClampedArray(${arr(tray(160, 120))}), 160).fix`);
  const hues = (fixOrNull) =>
    [...a.extractPhotoPalette(harnessImage(a, im), 8, fixOrNull).markers]
      .map((i) => E(`LCH[${i}]`))
      .map((l) => [...l]);
  const cool = (pal) => pal.filter((l) => l[1] >= 15 && l[2] >= 130 && l[2] <= 320).length,
    browns = (pal) => pal.filter((l) => l[2] >= 30 && l[2] < 100 && l[0] < 72 && l[1] < 45).length;
  const before = hues(null),
    after = hues(fix);
  // (v308: From photo's first pass keeps hues apart, so the tray as photographed has some already)
  assert.ok(cool(after) >= cool(before), `cool colours ${cool(before)} → ${cool(after)}`);
  assert.ok(
    browns(before) >= 1,
    'as photographed it gives browns and beiges: ' + JSON.stringify(before.map((l) => l.map(Math.round))),
  );
  assert.equal(
    browns(after),
    0,
    'none once balanced: ' + JSON.stringify(after.map((l) => l.map(Math.round))),
  );
  assert.ok(
    cool(after) >= 3,
    'blues, greens and violets: ' + JSON.stringify(after.map((l) => l.map(Math.round))),
  );
});

test('Photo looks warm: never offered for a sunset, pale fur, a beach or one lamp; paper under a lamp is still "Paper looks warm"', () => {
  const E = app().__eval;
  const others = {
    ...SUNSETS,
    'pale fur': canvas(160, 120, [178, 166, 150]),
    'a beach': (() => {
      const im = canvas(160, 120, [225, 200, 160]);
      rect(im, 0, 0, 160, 48, [140, 190, 235]);
      rect(im, 0, 48, 160, 60, [40, 110, 160]);
      return im;
    })(),
    'a dim, warm room with one white lamp shade': (() => {
      const im = canvas(160, 120, [70, 60, 55]);
      rect(im, 20, 60, 140, 120, [110, 70, 50]);
      ellipse(im, 40, 30, 10, 12, [245, 245, 240]);
      return cast(im, TRAY_LIGHT);
    })(),
  };
  for (const [name, im] of Object.entries(others)) {
    const r = offers(E, im);
    assert.equal(r.photo, null, name + ': ' + JSON.stringify(r));
    assert.equal(r.paper, false, name);
  }
  // caps on white paper under a lamp: the paper is found, so the app offers "Paper looks warm · Make it white" (v306)
  const page = canvas(160, 120, [250, 250, 248]);
  for (let i = 0; i < 12; i++)
    ellipse(page, 15 + (i % 6) * 26, 40 + ((i / 6) | 0) * 40, 9, 9, hsl(i * 28, 0.7, 0.5));
  assert.equal(offers(E, cast(page, [1, 0.88, 0.7])).paper, true);
});

test('Tap something white: a small white label among dark caps can be tapped; red, a pale yellow cap or the dark can’t', () => {
  const E = app().__eval;
  const im = tray(160, 120);
  const at = (x, y, loose = true, fn = 'whiteLin') =>
    JSON.parse(
      E(`(function () { const d = new Uint8ClampedArray(${arr(im)}), lin = ${fn}(d, 160, 120, ${x}, ${y}, 3);
        const r = paperSpot(lin, ${loose}); return JSON.stringify({ bad: !!r.bad, fix: !!r.fix, note: r.note }); })()`),
    );
  // the first cap's label is at (8, 8.6); the patch (7 × 7) is mostly cap and bag
  assert.deepEqual(at(8, 9), { bad: false, fix: true, note: '' }, 'the label');
  assert.equal(at(8, 9, false).bad, true, 'paper’s limits (v306) refused it');
  assert.equal(at(8, 9, true, 'patchLin').bad, true, 'the average of the patch is the cap, not white');
  assert.equal(at(0, 0).bad, true, 'the bag');
  const spot = E('paperSpot'),
    lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
  for (const c of [
    [200, 50, 60],
    [15, 15, 15],
    [250, 235, 150],
    [180, 220, 140],
  ]) {
    const r = spot(lin8(...c), true);
    assert.equal(r.bad, true, String(c));
    assert.equal(
      r.note,
      'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
    );
  }
  // a plain white thing: the brightest quarter of the patch is the patch
  const flat = new Uint8ClampedArray(5 * 5 * 4).fill(200);
  const wl = [...E('whiteLin')(flat, 5, 5, 2, 2, 2)],
    pl = [...E('patchLin')(flat, 5, 5, 2, 2, 2)];
  wl.forEach((v, k) => assert.ok(Math.abs(v - pl[k]) < 1e-9, wl + ' / ' + pl));
  // paper as before: the grey paper of a phone photo, and paper already white
  assert.ok(spot(lin8(186, 176, 160), true).fix);
  assert.equal(spot(lin8(242, 242, 242), true).note, 'That already looks white: nothing to correct.');
});

// ---- the service worker: page loads ignore the query ------------------------------------------------------------
// service-worker.js run in a sandbox with a made-up Cache Storage (caches.match with ignoreSearch, as browsers do it)
// and network; `online` says whether fetch reaches the server
function swSandbox() {
  const ORIGIN = 'https://ms.test/';
  const stores = new Map(),
    fetched = [],
    handlers = {};
  const key = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN).href;
  const cache = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (r, o) => {
        const u = new URL(key(r));
        for (const [k, v] of m) {
          const c = new URL(k);
          if (o && o.ignoreSearch ? c.origin + c.pathname === u.origin + u.pathname : k === u.href) return v;
        }
      },
      put: async (r, res) => void m.set(key(r), res),
      add: async (u) =>
        void m.set(key(u), {
          ok: true,
          body: 'file ' + key(u),
          clone() {
            return this;
          },
        }),
      addAll: async (l) =>
        l.forEach((u) =>
          m.set(key(u), {
            ok: true,
            body: 'file ' + key(u),
            clone() {
              return this;
            },
          }),
        ),
    };
  };
  const ctx = {
    online: true,
    URL,
    Promise,
    Request: function (u) {
      return { url: key(u), method: 'GET', mode: 'cors' };
    },
    caches: {
      open: async (n) => cache(n),
      keys: async () => [...stores.keys()],
      delete: async (n) => stores.delete(n),
      match: async (r, o) => {
        for (const n of stores.keys()) {
          const hit = await cache(n).match(r, o);
          if (hit) return hit;
        }
      },
    },
    fetch: async (r) => {
      fetched.push(key(r));
      if (!ctx.online) throw new TypeError('offline');
      return {
        ok: true,
        body: 'net ' + key(r),
        clone() {
          return this;
        },
      };
    },
    self: null,
  };
  ctx.self = {
    addEventListener: (t, f) => (handlers[t] = f),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8'), ctx);
  const life = async (t) => {
    let p;
    handlers[t]({ waitUntil: (x) => (p = x) });
    await p;
  };
  // a request through the worker: what it answered with
  const get = async (path, mode = 'navigate') => {
    let p;
    handlers.fetch({ request: { url: ORIGIN + path, method: 'GET', mode }, respondWith: (x) => (p = x) });
    const res = await p;
    await new Promise((r) => setTimeout(r, 0));
    return res && res.body;
  };
  const stored = () => [...stores.values()].flatMap((m) => [...m.keys()]).map((k) => k.slice(ORIGIN.length));
  return { ctx, stores, fetched, life, get, stored };
}

test('service worker: a page load with a query (?back=1) is the cached page, and no copy of it is stored', async () => {
  const sw = swSandbox();
  await sw.life('install');
  await sw.life('activate');
  const before = sw.stored().sort();
  // (v308: the page is stored once, as index.html, not also as ./)
  assert.ok(!before.includes('') && before.includes('index.html'), String(before));
  sw.fetched.length = 0;
  assert.equal(await sw.get('?back=1'), 'file https://ms.test/index.html', 'the cached page');
  assert.equal(await sw.get('index.html?from=home'), 'file https://ms.test/index.html');
  assert.deepEqual(sw.fetched, [], 'no network for a page the cache has');
  assert.deepEqual(sw.stored().sort(), before, 'no copy per address');
  // offline too
  sw.ctx.online = false;
  assert.equal(await sw.get('?back=1&x=2'), 'file https://ms.test/index.html');
  // anything else is matched exactly, as before: a file with a query is its own entry, kept once fetched
  sw.ctx.online = true;
  assert.equal(await sw.get('icon-192.png?v=2', 'no-cors'), 'net https://ms.test/icon-192.png?v=2');
  assert.ok(sw.stored().includes('icon-192.png?v=2'));
  // a page with a query the cache doesn't have (another path) comes from the network and isn't stored
  assert.equal(await sw.get('other.html?a=1'), 'net https://ms.test/other.html?a=1');
  assert.ok(!sw.stored().some((k) => k.startsWith('other.html')));
  // without a query it is, as before
  assert.equal(await sw.get('other.html'), 'net https://ms.test/other.html');
  assert.ok(sw.stored().includes('other.html'));
});

test('service worker: updates as before (the new version’s cache, the old one deleted on activate)', async () => {
  const sw = swSandbox();
  sw.stores.set('marker-studio-v1', new Map([['https://ms.test/', { body: 'old' }]]));
  await sw.life('install');
  await sw.life('activate');
  const name = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8').match(
    /CACHE='([^']+)'/,
  )[1];
  assert.deepEqual([...sw.stores.keys()], [name]);
  assert.equal(await sw.get('?back=1'), 'file https://ms.test/index.html');
});

// ---- Markers' search: a hex code offers Match this colour ---------------------------------------------------------
test('Markers search: a hex code (#ff0000, ff0000, f00) is read as a colour; codes and words aren’t', () => {
  const E = app().__eval,
    hex = E('searchHex');
  assert.equal(hex('#ff0000'), '#ff0000');
  assert.equal(hex('FF0000'), '#ff0000');
  assert.equal(hex(' f00 '), '#ff0000');
  assert.equal(hex('#3A7bD5'), '#3a7bd5');
  for (const q of ['R22', 'Y26', 'cool grey 3', 'ff00', '#ff00000', 'red', 'BG0000', ''])
    assert.equal(hex(q), null, q);
  // (the offer is only for a search that finds no marker: "E00" is a Copic code as well as a hex code)
  E(
    `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
  );
  assert.ok(E(`searchStr = 'e00'; finderMatches().length`) > 0);
  assert.equal(E(`searchStr = '#ff0000'; finderMatches().length`), 0);
});
