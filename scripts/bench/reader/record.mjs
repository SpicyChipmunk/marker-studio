// Records photo reads for the replay bench: each photo through Scan › Photograph your caps in the real app (Chromium,
// or WebKit with WEBKIT=1), with the OCR, and one line per photo appended to OUT: every line read (text, box, the name
// line it belongs to), the read copy's size, what was listed and asked, and the time. Slow (~15 s a photo); replay.mjs
// then re-reads these lines through any build in about a second.
//
//   OUT=/private/place/reads.jsonl node scripts/bench/reader/record.mjs PHOTO.jpg [PHOTO2.jpg ...]
//   env: HTML=another build's index.html; IOS=0 to read as a desktop does (default: as an iPad, in two strips);
//        BRAND=Ohuhu|Copic chosen first; WEBKIT=1; EVERY=5 photos to a fresh page (0: one page for all)
//
// The photos and the recordings are the owners' own: keep them out of the repo (OUT is required, nothing is written
// here). Builds the page with two small hooks for the recording (the read copy's size, the text handed to Scan); an
// anchor not found means photo-read.js changed — update the anchor.
import { chromium, webkit } from 'playwright';
import { readFileSync, appendFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../e2e/helpers.mjs';

const OUT = process.env.OUT;
const files = process.argv.slice(2);
if (!OUT || !files.length) {
  console.error('usage: OUT=reads.jsonl record.mjs PHOTO.jpg...');
  process.exit(2);
}
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
let html = readFileSync(process.env.HTML || ROOT + 'index.html', 'utf8');
const rep = (a, b) => {
  if (html.indexOf(a) < 0) throw new Error('anchor not found: ' + a.slice(0, 60));
  html = html.split(a).join(b);
};
rep(
  "scanHandleCodes(t.join('\\n'), true, true, true);",
  "(window.__txt = t.join('\\n')), scanHandleCodes(t.join('\\n'), true, true, true);",
);
rep(
  "ocrW.postMessage({ t: 'read', img: { width: r.img.w, height: r.img.h, data: px }, o: o }, [px]);",
  "window.__imgWH = [r.img.w, r.img.h];\n  ocrW.postMessage({ t: 'read', img: { width: r.img.w, height: r.img.h, data: px }, o: o }, [px]);",
);
const ios = process.env.IOS !== '0';
// (v318.22) a fresh page every EVERY photos: one recording doesn't depend on how long the page has been reading, and a
// leak in the page (Chrome's, fixed in v318.22, ended reading after about 10 photos) can't spoil the photos after it
const EVERY = process.env.EVERY === undefined ? 5 : Number(process.env.EVERY);
const srv = await startServer();
const br = await (process.env.WEBKIT ? webkit : chromium).launch();
// (WebKit: a route breaks the worker's blob: loads, so the page is served from a file of its own)
const zz = ROOT + 'zz-reader-bench.html';
if (process.env.WEBKIT) writeFileSync(zz, html);
const errs = [];
let ctx = null,
  page = null;
async function open() {
  if (ctx) await ctx.close();
  ctx = await br.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'block' });
  if (!process.env.WEBKIT)
    await ctx.route(/\/index\.html$/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: html }),
    );
  await ctx.addInitScript((ios) => {
    window.__MS_RESULTS_FORM = '';
    window.__MS_TEST = true;
    if (ios) {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      Object.defineProperty(navigator, 'userAgent', {
        get: () =>
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      });
    }
  }, ios);
  page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + (process.env.WEBKIT ? 'zz-reader-bench.html' : 'index.html'));
  await page.waitForTimeout(800);
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await page.waitForTimeout(300);
  if (process.env.BRAND) await page.click('#scBrand button[data-b="' + process.env.BRAND + '"]');
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
}
try {
  let n = 0;
  for (const f of files) {
    const first = !page || (EVERY > 0 && n % EVERY === 0);
    if (first) await open();
    n++;
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click(first ? '#ocrPick' : '#ocrMore'),
    ]);
    const t = Date.now();
    await fc.setFiles([f]);
    await page.waitForSelector('#ocrDone', { timeout: 900000 });
    const ms = Date.now() - t;
    const d = await page.evaluate(() => ({
      imgWH: window.__imgWH,
      txt: window.__txt || '',
      lines: (window.__ocrLast || {}).lines || [],
      failed: !!(ocrRun && ocrRun.failed),
      list: scanList
        .filter((e) => e.photo === ocrPhotos)
        .map((e) =>
          e.ask
            ? { ask: e.title, opts: e.opts.map((o) => COLORS[o.i].brand + '|' + COLORS[o.i].code) }
            : COLORS[e.i].brand + '|' + COLORS[e.i].code,
        ),
    }));
    // (a photo that "finished" without being read: the page's reading had stopped; say so rather than record it)
    if (ms < 1500 || d.failed) throw new Error(f + ': not read (' + ms + ' ms)');
    appendFileSync(
      OUT,
      JSON.stringify(Object.assign({ file: [f.split('/').pop()], ios: ios, ms: ms }, d)) + '\n',
    );
    console.log(f.split('/').pop(), ms + ' ms', d.lines.length + ' lines', d.list.length + ' in the list');
  }
} finally {
  if (errs.length) console.log('page errors:', errs);
  await br.close();
  await srv.close();
  if (process.env.WEBKIT)
    try {
      unlinkSync(zz);
    } catch (_) {}
}
