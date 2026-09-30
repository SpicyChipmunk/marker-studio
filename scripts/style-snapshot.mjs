// Proves a change is look-preserving: drives two builds of the app side by side (a base, by default the index.html of
// git HEAD, and the current index.html) through the same screens, and at every stop compares the computed style of
// every element in the page (all ~400 properties) and, for a subset of stops, a screenshot, pixel for pixel.
// Written for moving inline styles into CSS classes (docs/CODE-TOOLS.md, "Style snapshot"); useful for any CSS change
// that should change nothing.
//
//   node scripts/style-snapshot.mjs                       base = HEAD, every screen size and text size
//   node scripts/style-snapshot.mjs --base 956b007        base = that commit's index.html (or --base-html FILE)
//   options: --new-html FILE             compare with this file instead of the current index.html
//            --configs phone@1,ipad@1.6   only these (sizes: phone landscape ipad desktop; text sizes: 1 1.3 1.6)
//            --only guide,palette         only these scenarios        --jobs N   configs run in parallel (default 2)
//            --out DIR                    where differing screenshots and the report go (default: a temp folder)
//            --no-shots                   skip the screenshots (full page on portrait screens, else the viewport)
// Exit code 1 if anything differs or a scenario could not run the same way on both builds.
//
// How it stays fair: both builds run in fresh browser profiles with the same seeded Math.random and the same clock
// (Date starts at a fixed moment), step by step in lockstep, and every stop waits for the app to go idle (the e2e
// idle() tracker) and settles CSS animations the same way (finite ones finished, endless ones held at their start)
// before reading. An element is identified by its id, or by its parent's identity and its place among its siblings,
// so the comparison is independent of classes and style attributes, which are what such a change rewrites.
// Also compared: each element appended straight to <body> (toasts, the confetti canvas, Reveal's flash), read the
// moment it is added; and the elements listed in TRACKED under forced :hover, :active, :focus and :focus-visible
// (an inline style beats any rule; a class can lose to a state rule, so those states are checked explicitly).
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { inflateSync } from 'node:zlib';
import * as pw from 'playwright';
import { trackIdle, idle } from '../e2e/helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? dflt : args[i + 1];
};
const VIEWPORTS = { phone: [390, 844], landscape: [844, 390], ipad: [820, 1180], desktop: [1280, 800] };
const SCALES = [1, 1.3, 1.6];
const ALL_CONFIGS = Object.keys(VIEWPORTS).flatMap((v) => SCALES.map((s) => v + '@' + s));

// Elements whose inline styles were moved into CSS (both builds must match these selectors): compared under forced
// :hover / :active / :focus / :focus-visible too, with everything inside them.
const TRACKED = [
  '#sfResume', '#sfRecent', '#photoWrap', '#photoBody', '#photoBody > .optrow', '#findWrap', '#ownHint',
  '#seedGrid', '#savedOverlay .dcard > .drow', '#savedOverlay .dcard > .dsub', '#backupShow', '#backupTextWrap',
  '#backupText', '#sfPlanOverlay > .ocard', '#sfPlanList', '#sfStart > div:has(#sfPick)', '#sfPick', '#sfSample',
  '#sfLib', '#sfImport', '#sfWork', '#sfCanvas', '#matchResult .mbname', '#matchOverlay > div:not(.mcard)',
  '#msToast span', '.sftip > span', 'label:has(> #sfPhRough)', '#sfEdAsk .dcard > div:last-child',
  '.sfrevbar > div',
];
const PSEUDO = ['hover', 'active', 'focus', 'focus-visible'];

// ---- in the page -----------------------------------------------------------------------------------------------
// installed before the app's own scripts: a seeded Math.random, a clock that starts at a fixed moment, and __ss, the
// reader. `window.__MS_TEST` switches on the app's test seam, as in the e2e tests.
function pageInit() {
  window.__MS_TEST = true;
  let seed = 20260615;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // reseeded before every step, so a step's random choices don't depend on how many numbers an animation drew before it
  window.__ssSeed = (n) => (seed = n);
  const RD = Date, base = RD.UTC(2026, 5, 15, 15, 0, 0), p0 = performance.now();
  const now = () => base + Math.floor(performance.now() - p0);
  function D(...a) {
    if (!new.target) return new RD(now()).toString();
    return a.length ? new RD(...a) : new RD(now());
  }
  D.prototype = RD.prototype;
  D.now = now;
  D.UTC = RD.UTC;
  D.parse = RD.parse;
  window.Date = D;
  // a new guide's name is seeded with Date.now() (names.js evoName): the builds reach that moment a few ms apart
  document.addEventListener('DOMContentLoaded', () => {
    const evo = window.evoName;
    if (typeof evo === 'function') window.evoName = (hexes, seedExtra, avoid) => evo(hexes, seedExtra ? 1 : seedExtra, avoid);
  });

  const SKIP = new Set(['script', 'style', 'template', 'noscript', 'link', 'meta', 'title']);
  const props = (el) => {
    const cs = getComputedStyle(el), out = [];
    for (let i = 0; i < cs.length; i++) out.push(cs[i] + '\u0002' + cs.getPropertyValue(cs[i]));
    // sorted: custom properties come in no fixed order
    return out.sort().join('\u0001');
  };
  const hash = (s) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
  };
  let cache = new Map();
  const pathOf = (el) => {
    if (cache.has(el)) return cache.get(el);
    let p;
    if (el === document.documentElement) p = 'html';
    else if (el.id && document.getElementById(el.id) === el) p = '#' + el.id;
    else {
      let i = 0;
      for (let s = el; (s = s.previousElementSibling); ) i++;
      p = (el.parentElement ? pathOf(el.parentElement) : '?') + '>' + el.localName + ':' + i;
    }
    cache.set(el, p);
    return p;
  };
  let skip = [];
  const elements = (root) => {
    const list = [root];
    for (const e of root.querySelectorAll('*')) if (!SKIP.has(e.localName) && !skip.some((s) => e.closest(s))) list.push(e);
    return list;
  };
  // finite animations and transitions run to their end; endless ones are held at their start while reading
  const settle = () => {
    const held = [];
    for (const a of document.getAnimations()) {
      try {
        const t = a.effect && a.effect.getComputedTiming();
        if (t && t.iterations === Infinity) {
          if (a.playState === 'running') held.push(a);
          a.pause();
          a.currentTime = 0;
        } else if (a.playState === 'running') a.finish();
      } catch (_) {}
    }
    return () => held.forEach((a) => a.play());
  };
  // the last reading's property lists, so a difference is reported as it was read, not as it is a moment later
  let last = new Map();
  const read = (roots) => {
    cache = new Map();
    last = new Map();
    const resume = settle(), out = [];
    for (const r of roots)
      for (const e of elements(r)) {
        const p = pathOf(e), v = props(e);
        last.set(p, v);
        out.push([p, hash(v)]);
      }
    resume();
    return out;
  };
  const transient = [];
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver((ms) => {
      for (const m of ms)
        for (const n of m.addedNodes) if (n.nodeType === 1) transient.push([n.localName + (n.id ? '#' + n.id : ''), props(n)]);
    }).observe(document.body, { childList: true });
  });
  window.__ss = {
    // [path, hash] for every element (or those under `scope`)
    capture(scope, exclude) {
      skip = exclude || [];
      const roots = scope ? [...document.querySelectorAll(scope)] : [document.documentElement];
      return read(roots);
    },
    // the last reading's full property lists for these paths
    detail(paths) {
      return Object.fromEntries(paths.map((p) => [p, last.get(p)]));
    },
    // the i-th element matching `sel` and everything inside it; with `full`, the property lists instead of hashes
    subtree(sel, i, full) {
      const el = document.querySelectorAll(sel)[i];
      if (!el) return null;
      cache = new Map();
      const resume = settle(), out = [];
      for (const e of elements(el)) out.push([pathOf(e), full ? props(e) : hash(props(e))]);
      resume();
      return out;
    },
    // on screen, and not inside what the last reading left out
    visible(sel) {
      return [...document.querySelectorAll(sel)].map((e) => e.getClientRects().length > 0 && !skip.some((s) => e.closest(s)));
    },
    takeTransient() {
      return transient.splice(0);
    },
  };
}

// ---- servers: the same files, a different index.html ----------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
async function serve(indexFile) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = p === '/index.html' ? indexFile : normalize(join(ROOT, p));
    if (file !== indexFile && !file.startsWith(ROOT)) return void res.writeHead(403).end();
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) };
}

// ---- PNG: count differing pixels (8-bit RGB/RGBA, not interlaced: what Chromium writes) ---------------------------
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') [w, h, ct] = [data.readUInt32BE(0), data.readUInt32BE(4), data[9]];
    else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
function pixelDiff(a, b) {
  const A = decodePng(a), B = decodePng(b);
  if (A.w !== B.w || A.h !== B.h) return { size: [A.w + '×' + A.h, B.w + '×' + B.h] };
  let n = 0;
  for (let i = 0; i < A.w * A.h; i++) {
    for (let k = 0; k < 3; k++) {
      if (A.px[i * A.bpp + k] !== B.px[i * B.bpp + k]) {
        n++;
        break;
      }
    }
  }
  return { pixels: n };
}

// ---- one screen size and text size, both builds in lockstep -----------------------------------------------------
async function runConfig(config, urls, outDir, shots, only) {
  const [vp, sc] = config.split('@'), [width, height] = VIEWPORTS[vp], scale = +sc;
  const browser = await pw.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const report = { config, snaps: 0, elements: 0, pseudo: 0, transient: 0, shots: 0, diffs: [], gaps: [], errors: [], notes: [] };
  const open = async (url) => {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true, hasTouch: false });
    await trackIdle(ctx);
    await ctx.addInitScript(pageInit);
    await ctx.route((u) => !u.href.startsWith(url), (r) => r.abort());
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (scale !== 1) await cdp.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * scale) } });
    await page.goto(url);
    await idle(page);
    return { ctx, page, cdp };
  };
  const diff = (where, what) => {
    report.diffs.push({ where, ...what });
    console.error(`[${config}] DIFF ${where}: ${JSON.stringify(what).slice(0, 2000)}`);
  };
  // property-level difference between two property lists (name \u0002 value, joined by \u0001)
  const propDiff = (a, b) => {
    const m = (s) => new Map(s.split('\u0001').map((x) => x.split('\u0002')));
    const A = m(a || ''), B = m(b || ''), out = [];
    for (const k of new Set([...A.keys(), ...B.keys()])) if (A.get(k) !== B.get(k)) out.push(`${k}: ${A.get(k)} → ${B.get(k)}`);
    if (!out.length && a !== b) {
      let i = 0;
      while (i < Math.min((a || '').length, (b || '').length) && a[i] === b[i]) i++;
      out.push(`(lists differ at ${i}: ${JSON.stringify((a || '').slice(i - 40, i + 40))} → ${JSON.stringify((b || '').slice(i - 40, i + 40))})`);
    }
    return out;
  };

  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    if (only && !only.includes(name)) continue;
    let A, B;
    try {
      [A, B] = [await open(urls[0]), await open(urls[1])];
    } catch (e) {
      report.errors.push(`${name}: could not open: ${e.message}`);
      continue;
    }
    const both = [A, B];
    let step = 0;
    const T = {
      // run a step on both builds; a step that fails on one build only is a difference
      async do(fn, label = 'step', { wait = true } = {}) {
        const r = [];
        step++;
        for (const x of both) {
          try {
            await x.page.evaluate((n) => __ss && __ssSeed(n), 7919 * step).catch(() => {});
            r.push(['ok', await fn(x.page)]);
          } catch (e) {
            const ls = e.message.split('\n');
            // what was on screen, to tell why
            const at = await x.page
              .evaluate(() => `open: ${[...document.querySelectorAll('.overlay.on,[role=dialog]:not(.overlay)')].map((o) => o.id || o.className).join(',') || 'none'}, focus: ${document.activeElement && (document.activeElement.id || document.activeElement.localName)}`)
              .catch(() => '');
            r.push(['err', [ls[0], ...ls.filter((l) => /intercepts|not visible|outside|not stable|detached/.test(l)).slice(-1), at].join(' / ')]);
          }
        }
        if (r[0][0] !== r[1][0]) diff(`${name} / ${label}`, { step: r.map((x) => x.join(': ')) });
        if (r[0][0] === 'err' || r[1][0] === 'err') throw new Error(`${label}: ${r.map((x) => x[1]).join(' | ')}`);
        if (wait) for (const x of both) await idle(x.page);
        return r[0][1];
      },
      click: (sel, label) => T.do((p) => p.click(sel, { timeout: 8000 }), label || 'click ' + sel),
      async snap(stop, { shot = false, scope = null, exclude = [], expect = [], wait = true } = {}) {
        const where = `${name} / ${stop}`;
        if (wait) for (const x of both) await idle(x.page);
        const [ca, cb] = await Promise.all(both.map((x) => x.page.evaluate(([s, e]) => __ss.capture(s, e), [scope, exclude])));
        report.snaps++;
        report.elements += ca.length;
        const ma = new Map(ca), mb = new Map(cb);
        const onlyA = ca.filter(([p]) => !mb.has(p)).map(([p]) => p), onlyB = cb.filter(([p]) => !ma.has(p)).map(([p]) => p);
        if (onlyA.length || onlyB.length) diff(where, { structure: { onlyInBase: onlyA.slice(0, 20), onlyInNew: onlyB.slice(0, 20) } });
        const diffPaths = ca.filter(([p, h]) => mb.has(p) && mb.get(p) !== h).map(([p]) => p);
        if (diffPaths.length) {
          const [da, db] = await Promise.all(both.map((x) => x.page.evaluate((ps) => __ss.detail(ps), diffPaths.slice(0, 25))));
          diff(where, { elements: diffPaths.length, detail: Object.fromEntries(diffPaths.slice(0, 25).map((p) => [p, propDiff(da[p], db[p])])) });
        }
        // expected elements on screen (in the base): otherwise this stop doesn't cover what it's meant to
        for (const sel of expect) {
          const v = await A.page.evaluate((s) => __ss.visible(s), sel);
          if (!v.some(Boolean)) report.gaps.push(`${where}: ${sel} not on screen`);
        }
        // tracked elements under forced states
        for (const sel of scope ? TRACKED.filter((t) => t.startsWith(scope)) : TRACKED) {
          const vis = await A.page.evaluate((s) => __ss.visible(s), sel);
          const visB = await B.page.evaluate((s) => __ss.visible(s), sel);
          if (vis.join() !== visB.join()) diff(where, { visibility: sel, base: vis, now: visB });
          for (let i = 0; i < vis.length; i++) {
            if (!vis[i]) continue;
            for (const ps of PSEUDO) try {
              const got = [];
              for (const x of both) {
                const { root } = await x.cdp.send('DOM.getDocument', { depth: 0 });
                const { nodeIds } = await x.cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
                await x.cdp.send('CSS.enable');
                await x.cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [ps] });
                got.push(await x.page.evaluate(([s, k]) => __ss.subtree(s, k, false), [sel, i]));
                await x.cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
              }
              report.pseudo++;
              if (JSON.stringify(got[0]) !== JSON.stringify(got[1])) {
                const full = [];
                for (const x of both) {
                  const { root } = await x.cdp.send('DOM.getDocument', { depth: 0 });
                  const { nodeIds } = await x.cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
                  await x.cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [ps] });
                  full.push(await x.page.evaluate(([s, k]) => __ss.subtree(s, k, true), [sel, i]));
                  await x.cdp.send('CSS.forcePseudoState', { nodeId: nodeIds[i], forcedPseudoClasses: [] });
                }
                const fb = new Map(full[1]);
                diff(where, { pseudo: ps, sel, detail: full[0].filter(([p, v]) => fb.get(p) !== v).slice(0, 5).map(([p, v]) => [p, propDiff(v, fb.get(p))]) });
              }
            } catch (e) {
              report.gaps.push(`${where}: ${sel} :${ps} not read (${e.message.split('\n')[0]})`);
            }
          }
        }
        // elements added straight to <body> (or the document) since the last stop, read as they were added
        const [ta, tb] = await Promise.all(both.map((x) => x.page.evaluate(() => __ss.takeTransient())));
        report.transient += ta.length;
        if (ta.length !== tb.length || ta.some((t, i) => t[0] !== tb[i][0] || t[1] !== tb[i][1]))
          diff(where, {
            transient: Array.from({ length: Math.max(ta.length, tb.length) }, (_, i) => [ta[i] && ta[i][0], tb[i] && tb[i][0], propDiff(ta[i] && ta[i][1], tb[i] && tb[i][1])]).filter((x) => x[0] !== x[1] || x[2].length),
          });
        if (shot && shots) {
          // a full-page screenshot lays the page out at its whole height: on a landscape screen that turns it portrait,
          // which the app reacts to (side-by-side layout, open sheets), so those, and the guide, get the viewport
          const full = shot !== 'viewport' && height > width;
          // the same scroll position on both (a scroll a few pixels apart is timing, not style: noted, not failed)
          const [ya, yb] = await Promise.all(both.map((x) => x.page.evaluate(() => scrollY)));
          if (ya !== yb) {
            report.notes.push(`${where}: scrolled to ${ya} (base) and ${yb} (new); the new one moved to ${ya} for the screenshot`);
            await B.page.evaluate((y) => scrollTo(0, y), ya);
            for (const x of both) await idle(x.page);
          }
          const [sa, sb] = await Promise.all(both.map((x) => x.page.screenshot({ fullPage: full, animations: 'disabled', caret: 'hide' })));
          report.shots++;
          if (!sa.equals(sb)) {
            const d = pixelDiff(sa, sb);
            if (d.size || d.pixels) {
              const f = join(outDir, `${config}-${name}-${stop}`.replace(/[^\w.@-]+/g, '_'));
              await writeFile(f + '-base.png', sa);
              await writeFile(f + '-new.png', sb);
              diff(where, { screenshot: d, files: f + '-{base,new}.png' });
            }
          }
        }
      },
    };
    try {
      await scenario(T);
    } catch (e) {
      report.errors.push(`${name}: ${e.message.split('\n')[0]}`);
      console.error(`[${config}] scenario ${name} stopped: ${e.message.split('\n')[0]}`);
    }
    for (const x of both) await x.ctx.close();
  }
  await browser.close();
  return report;
}

// ---- the screens ----------------------------------------------------------------------------------------------
// a colourful reference photo (a hue sweep, light to dark), made in the page
const photoPng = (page) =>
  page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 640;
    const g = c.getContext('2d');
    for (let x = 0; x < 480; x += 8)
      for (let y = 0; y < 640; y += 8) {
        g.fillStyle = `hsl(${(x / 480) * 360},${40 + (y % 160) / 3}%,${20 + (y / 640) * 60}%)`;
        g.fillRect(x, y, 8, 8);
      }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
const setPhoto = (sel) => async (page) => {
  const b64 = await photoPng(page);
  await page.setInputFiles(sel, { name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
};
const esc = (T) => T.do((p) => p.keyboard.press('Escape'), 'Escape');
async function welcomeLook(T) {
  await T.do((p) => p.check('#wcSets input[data-i="3"]'), 'tick a set');
  await T.click('#wcAdd');
  await T.click('#wcLook');
}
async function welcomeSample(T) {
  await T.do((p) => p.check('#wcSets input[data-i="3"]'), 'tick a set');
  await T.click('#wcAdd');
  await T.click('#wcSample');
  await T.do((p) => p.waitForFunction(() => !!(window.__mstest && __mstest.assignData)), 'sample guide');
}
// a tap on one of the bigger sections whose label point is on the screen (a short landscape screen shows only part
// of the picture)
const sectionTap = async (page) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const pt = await page.evaluate(() => {
    const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect();
    for (const l of t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(1, 40)) {
      const q = t.labelPos(l), x = r.left + (q.x / c.width) * r.width, y = r.top + (q.y / c.height) * r.height;
      if (x > 0 && y > 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y) === c) return { x, y };
    }
    throw new Error('no section on the screen');
  });
  await page.mouse.click(pt.x, pt.y);
};

const SCENARIOS = {
  async welcome(T) {
    await T.snap('step 1', { shot: true });
    await T.click('.wcbrands [data-b="Copic"]');
    await T.snap('Copic');
    await T.do(setPhoto('#wcFile'), 'restore a bad file');
    await T.snap('restore error', { expect: ['#wcErr'] });
    await T.do((p) => p.check('#wcSets input[data-i="3"]'), 'tick a set');
    await T.snap('ticked');
    await T.click('#wcAdd');
    await T.snap('step 2', { shot: true });
    await T.click('#wcLook');
    await T.snap('home', { shot: true });
    for (const go of ['collection', 'palette']) {
      await T.click(`.homecard[data-go="${go}"]`);
      await T.snap('home card ' + go);
      await T.click('#mHome');
    }
    await T.click('#homeLibCard');
    await T.snap('home card library', { expect: ['#savedOverlay .dcard > .drow'] });
    await esc(T);
    await T.click('#homeNew');
    await T.snap('home: new guide', { shot: 'viewport', expect: ['#sfPick', '#sfSample', '#sfLib', '#sfImport'] });
  },
  async markers(T) {
    await welcomeLook(T);
    await T.click('#mCollection');
    await T.snap('owned', { shot: true, expect: ['#findWrap', '#ownHint'] });
    await T.click('#ownView [data-v="unowned"]');
    await T.snap('unowned');
    await T.do((p) => p.selectOption('#gapSort', 'gap'), 'fill the gaps');
    await T.snap('unowned: gaps', { shot: true });
    await T.do((p) => p.selectOption('#gapSort', 'code'), 'code order');
    await T.click('#ownView [data-v="all"]');
    await T.snap('all');
    await T.click('#ownView [data-v="wish"]');
    await T.snap('to buy');
    await T.click('#ownView [data-v="owned"]');
    await T.click('#presetHdr');
    await T.snap('add a set', { shot: true });
    await T.click('#presetHdr');
    await T.click('#filterBar');
    await T.snap('filters', { shot: true });
    await T.click('#filterBar');
    await T.do((p) => p.fill('#q', 'blue'), 'search');
    await T.snap('search');
    await T.do((p) => p.fill('#q', ''), 'clear the search');
    await T.click('#backupBtn');
    await T.snap('backup', { shot: true, expect: ['#backupShow'] });
    await T.click('#backupShow');
    await T.snap('backup: text', { shot: true, expect: ['#backupTextWrap', '#backupText'] });
    // (a DOM click: on a short screen at a large text size the link is squeezed to no height once the text shows)
    await T.do((p) => p.$eval('#backupShow', (b) => b.click()), 'hide the text');
    await T.snap('backup: text hidden');
    await esc(T);
    await T.click('#swatchBtn');
    await T.do((p) => p.waitForSelector('#swOverlay.on'), 'swatch chart');
    await T.snap('swatch chart', { shot: true });
    await esc(T);
    await T.click('#ownView [data-v="unowned"]');
    await T.do((p) => p.evaluate(() => openMarkerSheet(document.querySelector('#results .cell[data-i]').dataset.i * 1)), 'details');
    await T.do((p) => p.waitForSelector('#mkOverlay.on'), 'details open');
    await T.snap('details sheet', { shot: true });
    await T.click('#mkWish .wishbtn');
    await T.snap('details: to buy');
    await esc(T);
    await T.click('#ownView [data-v="owned"]');
    await T.click('#mkDrawBtn');
    await T.snap('random', { shot: true });
    await T.click('#rndBack');
  },
  async match(T) {
    await welcomeLook(T);
    await T.click('#mCollection');
    await T.click('#mkMatchBtn');
    await T.snap('photo', { shot: true });
    await T.do(setPhoto('#matchFile'), 'a photo');
    await T.do((p) => p.waitForSelector('#matchPhotoWrap', { state: 'visible' }), 'photo shown');
    await T.do(async (p) => {
      const b = await p.locator('#matchCanvas').boundingBox();
      await p.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.5);
    }, 'sample the photo');
    await T.snap('photo: sampled', { shot: true });
    await T.click('#matchOverlay .msrc [data-src="hex"]');
    await T.do((p) => p.fill('#matchHex', '#3a7bd5'), 'hex');
    await T.snap('hex', { shot: true });
    await T.click('#matchResult [data-copy]');
    await T.snap('copied', { expect: ['#matchOverlay > div:not(.mcard)'] });
    await T.do((p) => p.fill('#matchHex', '#0bd6c8'), 'hex 2');
    await T.click('#matchResult .mrow .wishbtn');
    await T.snap('to buy toast', { expect: ['#msToast span'] });
    if (await T.do((p) => p.isVisible('#matchCamBtn'), 'camera?')) {
      await T.click('#matchCamBtn');
      if (await T.do((p) => p.isVisible('#matchCamOff'), 'camera off?')) await T.click('#matchCamOff');
      await T.do((p) => p.waitForSelector('#matchCamWrap', { state: 'visible' }), 'camera on');
      await T.snap('camera', { exclude: ['#matchResult'] });
    }
    await esc(T);
  },
  async 'match without markers'(T) {
    await T.click('#wcSkip');
    await T.click('#wcLook');
    await T.snap('home, no markers', { shot: true });
    await T.click('#mCollection');
    await T.snap('markers, none owned', { shot: true });
    await T.click('#mkMatchBtn');
    await T.click('#matchOverlay .msrc [data-src="hex"]');
    await T.do((p) => p.fill('#matchHex', '#c0392b'), 'hex');
    await T.snap('no markers yet', { shot: true, expect: ['#matchResult .mbname'] });
  },
  async palette(T) {
    await welcomeLook(T);
    await T.click('#mPalette');
    await T.snap('palette', { shot: true });
    await T.click('#draw');
    await T.snap('generated', { shot: true });
    for (const h of ['analogous', 'triadic', 'split', 'tetradic', 'mono', 'custom']) {
      await T.click(`#harm [data-h="${h}"]`);
      await T.snap(h, { shot: h === 'custom' });
    }
    await T.click('#harm [data-h="photo"]');
    await T.snap('photo', { expect: ['#photoWrap'] });
    await T.do(setPhoto('#photoFile'), 'reference photo');
    await T.do((p) => p.waitForSelector('#photoBody', { state: 'visible' }), 'photo body');
    await T.snap('photo: loaded', { shot: true, expect: ['#photoBody', '#photoBody > .optrow'] });
    await T.click('#harm [data-h="complementary"]');
    await T.click('#seedBtn');
    await T.snap('seed', { shot: true, expect: ['#seedGrid'] });
    await esc(T);
    await T.click('#saveBtn');
    await T.click('#savedBtn');
    await T.snap('library', { shot: true, expect: ['#savedOverlay .dcard > .drow'] });
    await esc(T);
    await T.click('#exportBtn');
    await T.do((p) => p.waitForSelector('#imgOverlay.on'), 'export card');
    await T.snap('export card', { shot: true });
    await esc(T);
    await T.click('#mHome');
    await T.snap('home after saving');
  },
  async help(T) {
    await welcomeLook(T);
    await T.click('#homeHelp');
    await T.snap('help', { shot: true });
    for (const s of ['helpPhoto', 'helpGloss', 'helpKeys', 'helpData', 'helpAbout']) {
      await T.click(`#${s} > summary`);
      await T.snap(s, { shot: s === 'helpGloss' });
    }
    await T.click('#helpLost');
    await T.snap('find lost guides');
    await T.click('#helpHiw');
    await T.snap('how it works 1', { shot: true });
    await T.click('#hiwNext');
    await T.snap('how it works 2');
    await T.click('#hiwNext');
    await T.snap('how it works 3', { shot: true });
    await esc(T);
  },
  async guide(T) {
    await welcomeSample(T);
    await T.do((p) => p.evaluate(() => scrollTo(0, 0)), 'top');
    await T.snap('colours', { shot: 'viewport', expect: ['#sfWork', '#sfCanvas'] });
    await T.do(sectionTap, 'tap a section');
    await T.snap('tip', { expect: ['.sftip > span'] });
    for (const t of ['pattern', 'shading', 'share']) {
      await T.click(`.sftabbtn[data-t="${t}"]`);
      await T.snap(t, { shot: t !== 'shading' && 'viewport' });
    }
    await T.click('.sftabbtn[data-t="shading"]');
    await T.click('#sfShade [data-v="full"]');
    await T.snap('shading on', { shot: 'viewport' });
    await T.click('.sftabbtn[data-t="share"]');
    await T.click('#sfPlan');
    await T.do((p) => p.waitForSelector('#sfPlanOverlay.on'), 'blend plan');
    await T.snap('blend plan', { shot: 'viewport', expect: ['#sfPlanOverlay > .ocard', '#sfPlanList'] });
    await esc(T);
    await T.click('.sftabbtn[data-t="colours"]');
    await T.click('#sfColor');
    await T.snap('colour along', { shot: 'viewport' });
    await T.click('#sfAlist .sfarow .sfah');
    await T.snap('colour along: a row');
    await T.click('#sfBlends');
    await T.snap('blends');
    await esc(T);
    await T.do(
      (p) =>
        p.evaluate(() => {
          const t = __mstest, ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k), last = ks[ks.length - 1];
          t.assignData.order.forEach((l) => {
            if (t.assignData.assign[l].mkey !== last) t.colored[l] = 1;
          });
          return last;
        }),
      'all but one colour done',
    );
    const last = await T.do((p) => p.evaluate(() => [...document.querySelectorAll('#sfAlist .sfarow')].pop().dataset.k), 'last');
    await T.click(`#sfAlist .sfarow[data-k="${last}"] .sfah`);
    await T.click('#sfMarkAll');
    await T.snap('page complete', { expect: ['#sfDone'] });
    // read while it plays (no waiting for the app to go idle: that is the end of the animation)
    await T.do((p) => p.click('#sfDoneRev').then(() => p.waitForSelector('.sfrevbar[data-mode="anim"] > div')), 'reveal', { wait: false });
    await T.snap('revealing', { scope: '.sfrevbar', expect: ['.sfrevbar > div'], wait: false });
    await T.do((p) => p.waitForSelector('#revDone', { timeout: 20000 }), 'revealed');
    await T.snap('revealed');
    await esc(T);
  },
  async 'guide photo'(T) {
    await T.do((p) => p.check('#wcSets input[data-i="3"]'), 'tick a set');
    await T.click('#wcAdd');
    await T.click('#wcSample');
    await T.do((p) => p.waitForFunction(() => !!(window.__mstest && __mstest.assignData)), 'sample guide');
    await T.click('.sftabbtn[data-t="pattern"]');
    await T.do(async (p) => {
      const b64 = await photoPng(p);
      const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#sfFam [data-v="photo"]')]);
      await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await p.waitForFunction(() => !!__mstest.photoRef);
    }, 'colour from a photo');
    await T.snap('photo', { shot: 'viewport', expect: ['label:has(> #sfPhRough)'] });
    await T.click('#sfPhAlign');
    await T.snap('lining up');
  },
  async 'guide edits'(T) {
    await welcomeSample(T);
    await T.click('#sfSave');
    await T.do((p) => p.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)), 'saved');
    await T.click('#sfBack2');
    await T.do(sectionTap, 'exclude a section');
    await T.do((p) => p.evaluate(() => SF.loadSample()), 'another sample');
    await T.do((p) => p.waitForSelector('#sfEdAsk'), 'the question');
    await T.snap('section edits question', { shot: 'viewport', expect: ['#sfEdAsk .dcard > div:last-child'] });
    await esc(T);
  },
  async 'home with guides'(T) {
    await welcomeSample(T);
    await T.click('#sfSave');
    await T.do((p) => p.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)), 'saved');
    await T.do(
      (p) => p.evaluate(() => localStorage.setItem('ms-guide-auto', JSON.stringify({ dirty: true, name: 'Moon jellies', ts: Date.UTC(2026, 5, 15, 14, 0), keys: [] }))),
      'an unsaved session',
    );
    await T.do((p) => p.reload(), 'reload');
    await T.click('#mHome');
    await T.snap('home: resume and recent', { shot: true, expect: ['#sfResume', '#sfRecent'] });
    await T.click('#mSections');
    await T.snap('guide after reload');
  },
};

// ---- main -------------------------------------------------------------------------------------------------------
const child = args.includes('--child');
if (child) {
  const r = await runConfig(opt('configs'), [opt('a'), opt('b')], opt('out'), !args.includes('--no-shots'), opt('only') ? opt('only').split(',') : null);
  process.stdout.write('\n@@REPORT ' + JSON.stringify(r) + '\n');
  process.exit(0);
}
const outDir = opt('out') || (await mkdtemp(join(tmpdir(), 'style-snapshot-')));
await mkdir(outDir, { recursive: true });
let baseHtml = opt('base-html');
if (!baseHtml) {
  const ref = opt('base', 'HEAD');
  baseHtml = join(outDir, 'base-index.html');
  await writeFile(baseHtml, execFileSync('git', ['show', ref + ':index.html'], { cwd: ROOT, maxBuffer: 1 << 30 }));
}
const configs = opt('configs') ? opt('configs').split(',') : ALL_CONFIGS;
for (const c of configs) if (!VIEWPORTS[c.split('@')[0]]) throw new Error('unknown config ' + c);
const servers = [await serve(baseHtml), await serve(opt('new-html') || join(ROOT, 'index.html'))];
const jobs = +opt('jobs', 2), queue = [...configs], reports = [];
console.log(`style snapshot: ${configs.length} configs, base ${baseHtml}, output ${outDir}`);
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const c = queue.shift(), t0 = Date.now();
      const extra = ['--configs', c, '--a', servers[0].url, '--b', servers[1].url, '--out', outDir];
      if (args.includes('--no-shots')) extra.push('--no-shots');
      if (opt('only')) extra.push('--only', opt('only'));
      const out = await new Promise((res) => {
        const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child', ...extra], { stdio: ['ignore', 'pipe', 'inherit'] });
        let s = '';
        p.stdout.on('data', (d) => (s += d));
        p.on('close', () => res(s));
      });
      const m = out.match(/@@REPORT (.*)/);
      const r = m ? JSON.parse(m[1]) : { config: c, errors: ['no report'], diffs: [], gaps: [] };
      reports.push(r);
      console.log(`${c}: ${r.snaps} stops, ${r.elements} element reads, ${r.pseudo} forced-state reads, ${r.transient} added-to-body reads, ${r.shots} screenshot pairs; ${r.diffs.length} differences, ${r.errors.length} scenario errors, ${r.gaps.length} coverage gaps (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
  }),
);
for (const s of servers) await s.close();
await writeFile(join(outDir, 'report.json'), JSON.stringify(reports, null, 1));
const bad = reports.filter((r) => r.diffs.length || r.errors.length);
const tot = (k) => reports.reduce((n, r) => n + (r[k] || 0), 0);
console.log(`\ntotal: ${tot('snaps')} stops, ${tot('elements')} element reads, ${tot('pseudo')} forced-state reads, ${tot('transient')} added-to-body reads, ${tot('shots')} screenshot pairs`);
for (const r of reports) for (const g of r.gaps) console.log(`coverage gap [${r.config}] ${g}`);
for (const r of reports) for (const n of r.notes || []) console.log(`note [${r.config}] ${n}`);
for (const r of reports) for (const e of r.errors) console.log(`scenario error [${r.config}] ${e}`);
console.log(bad.length ? `DIFFERENT (${outDir}/report.json)` : 'identical');
process.exit(bad.length ? 1 : 0);
