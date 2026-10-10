// Shared setup for the browser (end-to-end) tests. Each test file starts its own
// static server on a free port and a headless Chromium, and drives the real
// index.html the way a person would. The service worker is blocked so every run
// sees the current file, and the __MS_TEST seam is switched on so tests can read
// guide state (it is inert in normal use).
//
// Waiting: never sleep a guessed number of milliseconds. After an action use idle(page) (the app has finished
// everything it started); for one specific thing use until(page, fn, arg, what); for layout catching up, frames(page).
// Only a delay that is itself being tested (a long press, a time window) uses pause()/longPress(), with its reason.
// Details under "Waiting for the app" below.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import * as pw from 'playwright';

// E2E_BROWSER=webkit runs the same tests on Safari's engine (CI runs it as a separate, informational job)
export const ENGINE = process.env.E2E_BROWSER || 'chromium';
// Tests left out of the WebKit job, each with its reason (Chromium runs them all): only causes that fail every time.
// Where the reason is how GitHub runs WebKit rather than Safari itself, the behaviour was checked in WebKit's own browser
// (WebKitGTK's MiniBrowser) first. Tests that fail there only now and then (a frame or a scroll event arriving late)
// aren't listed: the WebKit job runs one file at a time and retries a failed test once (e2e/ci-retry.mjs).
export const WK = {
  font: 'text measures differently with the fonts GitHub’s WebKit has (the layout is right in WebKit itself)',
  touch: 'touch can’t be made up in desktop WebKit (no Touch objects)',
  storage: 'this WebKit build has no navigator.storage',
  speed: 'GitHub’s WebKit is several times slower',
  scale: 'Safari’s engine smooths a scaled picture differently, so a section of a made-up page painted exactly in a marker’s colour can come out between two markers (a 9th marker for one section)',
  back: 'Back is left to the browser under test automation in Safari’s engine (Playwright’s WebKit crashes reloading a page twice after pushState; Safari itself doesn’t)',
};
export const notOnWebKit = (why) => ({ skip: ENGINE === 'webkit' && 'not on WebKit in CI: ' + why });

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARTIFACTS = join(ROOT, 'e2e', '.artifacts');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

export async function startServer() {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) };
}

let browser = null, server = null;
export async function setup() {
  server = await startServer();
  browser = await pw[ENGINE].launch(ENGINE === 'chromium' ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } : {});
}
export async function teardown() {
  await browser?.close(); await server?.close();
  if (process.env.E2E_IDLE_LOG && idleLog.length) await writeFile(process.env.E2E_IDLE_LOG, idleLog.map((x) => JSON.stringify(x)).join('\n') + '\n', { flag: 'a' });
}

// A fresh profile (empty storage) at a given screen size. `errors` collects uncaught page errors.
// Optional: `userAgent` (e.g. an iPhone's) and `init`, a function run in the page before the app (to stub browser APIs).
export async function openApp({ width = 390, height = 844, storage = null, userAgent = undefined, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true, hasTouch: false, ...(userAgent ? { userAgent } : {}) });
  await trackIdle(ctx);
  if (init) await ctx.addInitScript(init);
  await ctx.addInitScript((st) => {
    window.__MS_TEST = true;
    if (st && !sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(st)) if (v != null) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); }
    // (v310) the full Check the sections step, as the tests were written for, unless a test asks for the quick check
    // ('ms-sec-tools': '0' in its storage) or for none set at all (null: the first start of v310 sets it)
    try { if (!(st && 'ms-sec-tools' in st) && localStorage.getItem('ms-sec-tools') == null) localStorage.setItem('ms-sec-tools', '1'); } catch (_) {}
  }, storage);
  // (v310) E2E_MOODPICS=1: the Mood pictures made in every test (off in the tests unless asked for: they take a moment
  // after each change). Each one checks it left the guide as it was, and a tap that it laid what its picture showed,
  // and says so as an error in the page.
  if (process.env.E2E_MOODPICS) await ctx.addInitScript(() => { try { localStorage.setItem('ms-test-moodpics', '1'); } catch (_) {} });
  // keep tests offline: fonts and anything else off-origin are dropped
  // (blob: and data: addresses are the page's own: Playwright's WebKit sends blob: ones through this too, and stopping
  // them kept every photo from opening there — the photo tests were left out on WebKit for it until v294)
  await ctx.route((u) => !u.href.startsWith(server.url) && !/^(blob|data):/.test(u.href), (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.url);
  return { ctx, page, errors };
}

// (v311) Markers' ways to add: + Add markers' sheet (with a collection), or the card at the top (none yet). `way`: 'scan',
// 'chart', 'set' (the sets list: #wcSets, Add: #wcAdd) or 'find'. On Markers already, or taken there.
export async function addFromMarkers(page, way) {
  if (!(await page.evaluate(() => state.mode === 'collection'))) {
    await page.click('#mCollection');
    await idle(page);
  }
  const W = way.charAt(0).toUpperCase() + way.slice(1);
  if (await page.isVisible('#mkAddBtn')) {
    await page.click('#mkAddBtn');
    await page.click('#mka' + W);
  } else await page.click('#mkc' + W);
  await idle(page);
}
export const scanFromMarkers = (page) => addFromMarkers(page, 'scan');
export const chartFromMarkers = (page) => addFromMarkers(page, 'chart');
// Markers' Clear collection (v311: in ⋯), both taps
export async function clearCollection(page) {
  await page.click('#mkMore');
  await page.click('#mkClear');
  await pause(page, 450, 'its second tap is not a double tap');
  await page.click('#mkClear');
  await idle(page);
}

// First run: pick "Honolulu 120" in the welcome dialog, then choose how to continue.
// (v309) the welcome opens on three ways in: "I have a set" leads to the set list. Nothing when the list is showing.
// (v309.2: waits for the welcome to be up first: on a busy machine it could still be opening, and the list never came)
export const haveSet = async (page) => {
  await page.waitForFunction(() => {
    const b = document.getElementById('wcHaveSet'),
      l = document.getElementById('wcStep1');
    return (b && b.offsetParent) || (l && l.offsetParent);
  });
  await page.evaluate(() => {
    const b = document.getElementById('wcHaveSet');
    if (b && b.offsetParent) b.click();
  });
};
export async function welcome(page, next = 'sample') {
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click(next === 'sample' ? '#wcSample' : '#wcLook');
}

// Sample picture -> guide, ready on the Colours tab.
export async function sampleGuide(page) {
  await welcome(page, 'sample');
  // the sample opens as a finished guide
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
}

// a guide built from a Letter-shaped page (e2e/fixtures/letter-page.png: line art drawn for the tests), for layouts that the
// tall sample would hide
export async function letterGuide(page) {
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 }); await idle(page);
}
// put the open guide in the Library (what Save did before guides saved themselves) and wait until it's there
export async function saveGuide(page) {
  await page.evaluate(() => __mstest.saveNow());
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
}

// Screen position of a section's label point (measured after the next frames: the picture's scroll-linked size
// catches up with a scroll one frame later).
export function sectionPoint(page, l) {
  return page.evaluate((l) => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = __mstest.labelPos(l);
    res({ x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height });
  }))), l);
}
// scroll to the top of the page and wait until the picture has its size for it
export const scrollTop = (page) => page.evaluate(() => new Promise((res) => { scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(res)); }));

export async function shot(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, name + '.png') });
}
export async function saveArtifact(name, bytes) { await mkdir(ARTIFACTS, { recursive: true }); await writeFile(join(ARTIFACTS, name), bytes); }

// ---- Waiting for the app -------------------------------------------------------------------------------------
// Don't sleep for a guessed number of milliseconds: wait for the thing the next line relies on.
//  - idle(page): after an action, before reading its result. Resolves once the app has nothing left to do: no
//    timer set for `within` ms or less (default 1 s: the app's work timers - debounces, focus moves, re-renders -
//    are all well under that; toast lifetimes, "Copied" flashes and auto-save's 1.5 s are over it), no IndexedDB
//    transaction, file read, image load or canvas encode in flight, no CSS animation/transition that short still
//    running, no scroll still moving; then two quiet frames. Also the positive signal to wait for before asserting
//    that something did NOT happen.
//  - idle(page, 2000) etc.: the same, when the thing waited for is itself on a longer timer (auto-save, a toast
//    going away); it still returns as soon as that timer has run.
//  - until(page, fn, arg, what): a specific condition (e.g. another tab receiving a change), with a readable failure.
//  - frames(page, n): only n animation frames (a layout/scroll-linked size catching up).
//  - pause(page, ms, why), longPress(page, x, y): a delay that IS the behaviour under test (a finger held down, a
//    window that must pass). Say why; never use it just to "let things settle".
// idle() works through a tracker installed before the app's own scripts (trackIdle, done by openApp).
function idleTracker() {
  if (window.__idle) return;
  const W = window, now = () => performance.now();
  const oST = W.setTimeout.bind(W), oCT = W.clearTimeout.bind(W), oSI = W.setInterval.bind(W), oCI = W.clearInterval.bind(W);
  const oRAF = W.requestAnimationFrame.bind(W), oCAF = W.cancelAnimationFrame.bind(W);
  const timers = new Map(), intervals = new Map(), rafs = new Set(), ops = new Map();
  let seq = 0, lastScroll = -1e9, smoothAt = -1e9;
  // an async operation in flight until the returned function is called
  const op = (kind) => { const id = ++seq; ops.set(id, { kind, at: now() }); return () => ops.delete(id); };
  W.setTimeout = function (fn, ms, ...a) {
    if (typeof fn !== 'function') return oST(fn, ms, ...a);
    const id = oST(function () { timers.delete(id); return fn.apply(this, arguments); }, ms, ...a);
    timers.set(id, Math.max(0, +ms || 0));
    return id;
  };
  W.clearTimeout = function (id) { timers.delete(id); return oCT(id); };
  W.setInterval = function (fn, ms, ...a) {
    if (typeof fn !== 'function') return oSI(fn, ms, ...a);
    const every = Math.max(4, +ms || 0), id = oSI(function () { intervals.set(id, now() + every); return fn.apply(this, arguments); }, ms, ...a);
    intervals.set(id, now() + every);
    return id;
  };
  W.clearInterval = function (id) { intervals.delete(id); return oCI(id); };
  W.requestAnimationFrame = function (cb) { const id = oRAF(function (t) { rafs.delete(id); return cb(t); }); rafs.add(id); return id; };
  W.cancelAnimationFrame = function (id) { rafs.delete(id); return oCAF(id); };
  const wrap = (obj, name, fn) => { if (obj && typeof obj[name] === 'function') { const o = obj[name]; obj[name] = function () { return fn.call(this, o, arguments); }; } };
  const promised = (kind) => function (o, a) { const done = op(kind), p = o.apply(this, a); if (p && p.then) p.then(done, done); else done(); return p; };
  if (W.IDBDatabase) wrap(IDBDatabase.prototype, 'transaction', function (o, a) {
    const tx = o.apply(this, a), done = op('IndexedDB transaction');
    tx.addEventListener('complete', done); tx.addEventListener('abort', done); return tx;
  });
  if (W.IDBFactory) for (const n of ['open', 'deleteDatabase']) wrap(IDBFactory.prototype, n, function (o, a) {
    const r = o.apply(this, a), done = op('IndexedDB ' + n);
    r.addEventListener('success', done); r.addEventListener('error', done); return r;
  });
  if (W.FileReader) for (const n of ['readAsDataURL', 'readAsArrayBuffer', 'readAsText', 'readAsBinaryString']) wrap(FileReader.prototype, n, function (o, a) {
    this.addEventListener('loadend', op('file read'), { once: true }); return o.apply(this, a);
  });
  wrap(HTMLCanvasElement.prototype, 'toBlob', function (o, a) {
    const done = op('canvas toBlob'), cb = a[0];
    return o.call(this, function (b) { done(); return cb.apply(this, arguments); }, ...[...a].slice(1));
  });
  if (W.OffscreenCanvas) wrap(OffscreenCanvas.prototype, 'convertToBlob', promised('canvas convertToBlob'));
  wrap(W, 'createImageBitmap', promised('createImageBitmap'));
  wrap(W, 'fetch', promised('fetch'));
  wrap(HTMLImageElement.prototype, 'decode', promised('image decode'));
  for (const n of ['arrayBuffer', 'text']) wrap(Blob.prototype, n, promised('blob ' + n));
  if (W.StorageManager) for (const n of ['persist', 'persisted', 'estimate']) wrap(StorageManager.prototype, n, promised('storage ' + n));
  if (W.Clipboard) for (const n of ['writeText', 'write']) wrap(Clipboard.prototype, n, promised('clipboard ' + n));
  if (W.MediaDevices) wrap(MediaDevices.prototype, 'getUserMedia', promised('getUserMedia'));
  wrap(HTMLMediaElement.prototype, 'play', promised('media play'));
  // (v307) a job sent to a worker, until its answer (the app's worker answers each message once)
  if (W.Worker) wrap(Worker.prototype, 'postMessage', function (o, a) {
    const q = this.__idleQ || (this.__idleQ = []);
    if (!this.__idleOn) {
      this.__idleOn = true;
      const next = () => { const d = q.shift(); if (d) d(); };
      this.addEventListener('message', next);
      this.addEventListener('error', () => { while (q.length) q.shift()(); });
    }
    q.push(op('worker job'));
    // (a message that couldn't be sent gets no answer)
    try { return o.apply(this, a); } catch (e) { const d = q.pop(); if (d) d(); throw e; }
  });
  // (a worker stopped with jobs in flight answers none of them: JOBS.off, or the app giving up on it)
  if (W.Worker) wrap(Worker.prototype, 'terminate', function (o, a) {
    const q = this.__idleQ;
    while (q && q.length) q.shift()();
    return o.apply(this, a);
  });
  // images loading
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, enumerable: src.enumerable, get() { return src.get.call(this); },
    set(v) {
      if (this.__idleDone) this.__idleDone();
      src.set.call(this, v);
      if (!this.complete) {
        const done = op('image load'), img = this;
        const fin = () => { done(); img.removeEventListener('load', fin); img.removeEventListener('error', fin); if (img.__idleDone === fin) img.__idleDone = null; };
        this.__idleDone = fin; this.addEventListener('load', fin); this.addEventListener('error', fin);
      }
    },
  });
  // smooth scrolls: moving until no scroll event for a while
  const smooth = (a) => a && a[0] && typeof a[0] === 'object' && a[0].behavior === 'smooth';
  for (const [obj, names] of [[Element.prototype, ['scrollIntoView', 'scrollTo', 'scrollBy']], [W, ['scrollTo', 'scrollBy']]])
    for (const n of names) wrap(obj, n, function (o, a) { if (smooth(a)) smoothAt = now(); return o.apply(this, a); });
  W.addEventListener('scroll', () => { lastScroll = now(); }, { capture: true, passive: true });

  // What is still going on (a description), or '' when nothing is. Timers set for up to `within` ms and animations up
  // to `within` ms long count however late they started (so a chain of short steps is followed to its end); interval
  // ticks and animation frames count until `deadline` (an animation loop is not work to wait out).
  function busy(within, deadline) {
    const t = now(), why = [];
    let n = 0; for (const ms of timers.values()) if (ms <= within) n++;
    if (n) why.push(n + ' timer(s)');
    n = 0; for (const due of intervals.values()) if (due <= deadline) n++;
    if (n) why.push(n + ' interval(s)');
    if (rafs.size && t < deadline) why.push(rafs.size + ' animation-frame callback(s)');
    for (const o of ops.values()) why.push(o.kind + ' (' + Math.round(t - o.at) + ' ms)');
    if (document.fonts && document.fonts.status === 'loading') why.push('fonts loading');
    for (const im of document.images) if (!im.complete && im.loading !== 'lazy') { why.push('image in the page loading'); break; }
    if (t - lastScroll < 60 || t - smoothAt < 60) why.push('scrolling');
    if (document.getAnimations) for (const an of document.getAnimations()) {
      if (an.playState !== 'running' && an.pending !== true) continue;
      const c = an.effect && an.effect.getComputedTiming();
      if (!c || !isFinite(c.endTime) || an.currentTime == null) continue;
      if (c.endTime / Math.abs(an.playbackRate || 1) <= within) why.push('animation ' + (an.animationName || an.transitionProperty || an.id || '?'));
    }
    return why.join(', ');
  }
  const frame = () => new Promise((r) => { const a = oRAF(() => { oCT(b); r(); }), b = oST(() => { oCAF(a); r(); }, 100); });
  async function wait(within, limit) {
    const t0 = now(), deadline = t0 + within;
    const seen = new Set();
    for (let quiet = 0, why = ''; quiet < 2;) {
      await frame();
      why = busy(within, deadline);
      quiet = why ? 0 : quiet + 1;
      if (why) for (const w of why.split(', ')) seen.add(w.replace(/^\d+ | \(\d+ ms\)$/g, ''));
      if (why && now() - t0 > limit) throw new Error(`the page did not go idle in ${Math.round(now() - t0)} ms: ${why}`);
    }
    api.waitedFor = [...seen].join(', ');
    return Math.round(now() - t0);
  }
  async function frames(n) { for (let i = 0; i < n; i++) await frame(); }
  const api = { wait, frames, busy: (w = 1000) => busy(w, now() + w), waitedFor: '' };
  Object.defineProperty(W, '__idle', { value: api });
}
// install the tracker in every page of a browser context (openApp does this; call it for a context made by hand)
export const trackIdle = (ctx) => ctx.addInitScript(idleTracker);

async function inPage(page, fn, arg) {
  try { return await page.evaluate(fn, arg); }
  catch (e) {
    // the action navigated or reloaded the page: wait for the new document, then ask it
    if (!/Execution context was destroyed|navigation/i.test(e.message)) throw e;
    await page.waitForLoadState('load');
    return page.evaluate(fn, arg);
  }
}
// the app has finished what it was doing (see the note above); `within`: how far ahead a pending timer counts
export async function idle(page, within = 1000) {
  const ms = await inPage(page, ([w, l]) => {
    if (!window.__idle) throw new Error('idle(): no tracker in this page (make its context with openApp, or call trackIdle(ctx))');
    return window.__idle.wait(w, l);
  }, [within, within + 15000]);
  if (process.env.E2E_IDLE_LOG) idleLog.push([ms, within, (new Error().stack.split('\n').find((l) => /\.test\.mjs/.test(l)) || '').trim(), await page.evaluate(() => window.__idle.waitedFor).catch(() => '?')]);
  return ms;
}
// E2E_IDLE_LOG=<file>: append how long each idle() took (and where from) to that file, to find slow waits
const idleLog = [];
// n animation frames
export const frames = (page, n = 2) => inPage(page, (n) => new Promise((r) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); }), n);
// wait for a condition in the page (fn(arg) truthy); `what` names it in the failure
export async function until(page, fn, arg, what = String(fn), timeout = 15000) {
  try { return await page.waitForFunction(fn, arg, { timeout }); }
  catch (e) { throw new Error(`waited ${timeout} ms for: ${what}\n${e.message}`); }
}
// A delay that IS the behaviour under test (a finger held down, a time window that must pass). Only these.
export const pause = (page, ms, why) => { if (!why) throw new Error('pause(): say why this delay is part of the test'); return page.waitForTimeout(ms); };
// press and hold with the mouse at (x, y): the app treats a press held 480 ms as a long press; hold comfortably longer
export const LONG_PRESS = 650;
export async function longPress(page, x, y) {
  await page.mouse.move(x, y); await page.mouse.down();
  await pause(page, LONG_PRESS, 'a press held this long is a long press');
  await page.mouse.up();
}

// The guide's header row (Release 3): the ⋯ menu is a sheet; Save a copy lives in it; the name is renamed in place.
export async function openMenu(page) {
  await page.click('#sfMore');
  // (if the menu doesn't open, say what was showing instead: seen once on GitHub's WebKit, run 36942766302)
  await page.waitForSelector('#sfSheet .sfmitem', { timeout: 15000 }).catch(async (e) => {
    const was = await page.evaluate(() => {
      const m = document.getElementById('sfMore'), r = m && m.getBoundingClientRect(), sh = document.getElementById('sfSheet');
      const top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { sheet: sh ? sh.className + ' ' + (sh.textContent || '').trim().slice(0, 60) : null, more: m ? { shown: !!m.offsetParent, expanded: m.getAttribute('aria-expanded') } : null, atMore: top ? top.id || top.className || top.tagName : null, layers: [...document.querySelectorAll('.overlay.on')].map((o) => o.id), toast: (document.querySelector('#msToast.on') || {}).textContent || '', mode: window.__mstest && __mstest.sfmode };
    }).catch(() => null);
    throw new Error(`the ⋯ menu didn't open: ${JSON.stringify(was)} (${String(e.message).split('\n')[0]})`);
  });
}
export async function menuItem(page, label) { await openMenu(page); await page.click(`#sfSheet .sfmitem:text-is("${label}")`); }
export const saveCopy = (page) => menuItem(page, 'Save a copy');
export async function rename(page, name) { await page.click('#sfRename'); await page.fill('#sfGName', name); await page.press('#sfGName', 'Enter'); }
export const guideName = (page) => page.textContent('#sfGTitle');
// the text in the tool row under the picture ("166 sections · 16 markers", "3 of 166 done")
// (its parts are joined with non-breaking spaces so a part never breaks: read as ordinary spaces)
export const toolStatus = async (page) => (await page.textContent('#sfStat')).replace(/\u00a0/g, ' ');
// Fit (only there while zoomed in): back to the whole picture
export async function fitPicture(page) { if (await page.isVisible('#sfZrst')) await page.click('#sfZrst'); await idle(page); }

// open the app with the browser's text size set to `scale` × 16px (the phone's text-size setting)
export async function openAtScale(scale, opts = {}) {
  // Safari's engine has no browser font-size setting to drive, so there the root size is set directly
  if (ENGINE !== 'chromium') return openApp({ ...opts, init: scale === 1 ? null : `(function f() { if (document.documentElement) document.documentElement.style.fontSize = '${Math.round(16 * scale)}px'; else document.addEventListener('readystatechange', f, { once: true }); })()` });
  const app = await openApp(opts);
  if (scale !== 1) {
    const cdp = await app.ctx.newCDPSession(app.page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * scale) } });
    await app.page.reload(); await idle(app.page);
  }
  return app;
}

// v288: the questions that were the browser's OK/Cancel (re-detect, rebuild the sections, replace your markers, a
// backup opened as a guide) are the app's own dialog (marked data-confirm). answerAsks answers both kinds, now and
// after reloads: yes clicks the primary button (or accepts), no clicks Cancel / Keep mine (or dismisses). What was
// asked collects in window.__asked (the dialog's question) and in the returned array (the browser's messages).
// v308: answered by the buttons' data-a, as Keep my markers became the restore question's primary button: yes is
// "Use the backup's" there (data-a="replace"), as before, and the primary button elsewhere; no is Keep mine or Cancel;
// a string answers with that data-a ('add', 'keep', 'go'…), or Cancel when the question has no such button.
export async function answerAsks(page, yes = true) {
  const fn = (y) => {
    window.__askYes = y;
    window.__asked = window.__asked || [];
    if (window.__askObs) return;
    const go = () => {
      document.querySelectorAll('[data-confirm]').forEach((o) => {
        if (o.__ans) return;
        o.__ans = 1;
        const q = o.querySelector('.dsub');
        window.__asked.push(q ? q.textContent : '');
        setTimeout(() => {
          const y = window.__askYes;
          const b = typeof y === 'string' ? o.querySelector(`[data-a="${y}"]`) || o.querySelector('[data-a="stay"]') : y ? o.querySelector('[data-a="replace"]') || o.querySelector('.btn-primary') : o.querySelector('[data-a="keep"]') || o.querySelector('[data-a="stay"]');
          if (b) b.click();
        }, 0);
      });
    };
    window.__askObs = new MutationObserver(go);
    const start = () => window.__askObs.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once: true });
  };
  await page.addInitScript(fn, yes);
  await page.evaluate(fn, yes);
  page.__askYes = yes;
  if (!page.__askNative) {
    page.__askNative = [];
    page.on('dialog', (d) => { page.__askNative.push(d.message()); if (page.__askYes) d.accept(); else d.dismiss(); });
  }
  return page.__askNative;
}
// change the answer answerAsks gives from now on
export const askAnswer = (page, yes) => { page.__askYes = yes; return page.evaluate((y) => { window.__askYes = y; }, yes); };
export const asked = (page) => page.evaluate(() => window.__asked || []);

// v288: Back up & restore lives in the Library; its markers-and-palettes text opens the backup dialog over it
export async function openBackupDialog(page) {
  await page.evaluate(() => openLibrary()); await page.waitForSelector('#savedOverlay.on');
  await page.click('#libBkText'); await page.waitForSelector('#backupOverlay.on');
}

// v288: a Library tile's Rename and Delete are in its ⋯ menu
export async function libItem(page, rowSel, cls) {
  await page.click(rowSel + ' .smore');
  await page.click(rowSel + ' .' + cls);
}

// v288: Edit sections' bar has Build (a new picture, or something edited: "Build again") or, with nothing edited, ← Plan
// back to the guide as built; either way to the guide
export async function buildGo(page) {
  // (the bar follows edits made straight through the test seam once the sections are drawn again)
  await page.evaluate(() => { if (window.__mstest && __mstest.sfmode === 'review' && __mstest.render) __mstest.render(); });
  if (await page.isVisible('#sfBuild')) await page.click('#sfBuild');
  else await page.click('#sfToPlan');
}
