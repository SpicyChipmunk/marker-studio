#!/usr/bin/env node
// The photo-to-page bench (docs: Claude's plan v4, decisions 76-82, 99), step 1 of 3: each bench photo through the
// app's own path in headless Chromium (the built index.html: the photo opened as a page to make, ppPrepare's crop,
// shrink and colour bins), and what ppPrepare made kept for the Node bench: the working picture (rgb, w × h), the
// guide's size (GW × GH) and the colours the markers are chosen for (tl, tw).
//
//   node scripts/bench/pp-prep.mjs --in <bench-photos folder> --out <cache folder> [--only id,id] [--sets TUNE,HELD]
//
// Photos are Open Images' (CC BY 2.0), read where they are; nothing of them is written into the repo. Restartable: a
// photo already in the cache is skipped. Safari shrinks photos with its own filter: the iPad's working picture can differ
// from Chromium's by a level or two (the bench says so).
import fs from 'node:fs';
import path from 'node:path';
import { setup, teardown, openApp } from '../../e2e/helpers.mjs';
import { BUILD, PREP_HASH } from './lib/pp.mjs';

const argv = process.argv.slice(2),
  arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const IN = arg('--in'),
  OUT = arg('--out'),
  ONLY = arg('--only') ? new Set(arg('--only').split(',')) : null,
  SETS = new Set((arg('--sets') || 'TUNE,HELD,FINAL').split(','));
if (!IN || !OUT) {
  console.error('usage: pp-prep.mjs --in <bench-photos> --out <cache> [--only ids] [--sets TUNE,HELD,FINAL]');
  process.exit(2);
}
// (a bench-photos folder, by its index; or a plain folder of photos, e.g. Ben's own for the blind comparison: their
// file names as ids, kept only in the cache outside the repo)
const rows = fs.existsSync(path.join(IN, 'index.csv'))
  ? fs
      .readFileSync(path.join(IN, 'index.csv'), 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((l) => {
        const [id, set] = l.split(',');
        return { id, set, file: path.join(IN, set, id + '.jpg') };
      })
      .filter((r) => SETS.has(r.set) && (!ONLY || ONLY.has(r.id)))
  : fs
      .readdirSync(IN)
      .filter((f) => /\.(jpe?g|png)$/i.test(f)) // (not HEIC: Chromium can't open it; export those as JPEG)
      .map((f) => ({
        id: f.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_'),
        set: '',
        file: path.join(IN, f),
      }))
      .filter((r) => !ONLY || ONLY.has(r.id));
fs.mkdirSync(path.join(OUT, 'prep'), { recursive: true });
// (FINDINGS-AM 5: which ppPrepare made this cache; one cache, one ppPrepare. pp-bench.mjs refuses a cache made by another)
const HEAD = path.join(OUT, 'prep', '_head.json');
if (fs.existsSync(HEAD)) {
  const h = JSON.parse(fs.readFileSync(HEAD));
  if (h.prepare !== PREP_HASH) {
    console.error(
      `REFUSED: ${OUT}/prep was made by another ppPrepare (${h.prepare}, now ${PREP_HASH}): use a new --out`,
    );
    process.exit(3);
  }
} else fs.writeFileSync(HEAD, JSON.stringify({ prepare: PREP_HASH, build: BUILD }));
const todo = rows.filter((r) => !fs.existsSync(path.join(OUT, 'prep', r.id + '.json')));
const skipped = [];
console.log(`pp-prep: ${rows.length} photos, ${todo.length} to prepare`);

await setup();
let page = null,
  n = 0;
const t0 = Date.now();
async function fresh() {
  if (page) await page.context().close();
  ({ page } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  }));
  await page.waitForTimeout(500);
}
async function one(r) {
  const file = r.file,
    sig = Buffer.alloc(4);
  // (not a JPEG or PNG by its first bytes: skipped at once, not after two 2-minute waits)
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, sig, 0, 4, 0);
  fs.closeSync(fd);
  if (!(sig[0] === 0xff && sig[1] === 0xd8) && sig.readUInt32BE(0) !== 0x89504e47)
    throw Object.assign(new Error('not a JPEG or PNG'), { bad: true });
  const before = await page.evaluate(() => (window.__mstest && __mstest.ppPrep ? __mstest.ppPrep.pid : 0));
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 30000 }),
    page.evaluate(() => SF.ppPick(() => setMode('sections'))),
  ]);
  await fc.setFiles(file);
  await page.waitForFunction(
    (b) => window.__mstest && __mstest.ppPrep && __mstest.ppPrep.pid !== b && __mstest.pp && !__mstest.ppBusy,
    before,
    { timeout: 120000, polling: 100 },
  );
  const p = await page.evaluate(() => {
    const q = __mstest.ppPrep,
      b64 = (u8) => {
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000)
          s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      };
    return {
      w: q.w,
      h: q.h,
      GW: q.GW,
      GH: q.GH,
      rgb: b64(q.rgb),
      tl: Array.from(q.tl),
      tw: Array.from(q.tw),
      ua: navigator.userAgent,
    };
  });
  const rgb = Buffer.from(p.rgb, 'base64');
  if (rgb.length !== p.w * p.h * 3)
    throw new Error(`${r.id}: working picture ${rgb.length} bytes for ${p.w}x${p.h}`);
  fs.writeFileSync(path.join(OUT, 'prep', r.id + '.rgb'), rgb);
  delete p.rgb;
  p.build = BUILD;
  p.prepare = PREP_HASH;
  fs.writeFileSync(path.join(OUT, 'prep', r.id + '.json'), JSON.stringify(p));
}
try {
  await fresh();
  for (const r of todo) {
    try {
      await one(r);
    } catch (e) {
      if (e.bad) {
        console.log(`  ${r.id}: SKIPPED (${e.message})`);
        skipped.push(r.id);
        continue;
      }
      // (one retry in a fresh page: a dialogue left open, a stuck worker)
      console.log(`  ${r.id}: ${String(e.message || e).slice(0, 120)}; trying again in a fresh page`);
      await fresh();
      try {
        await one(r);
      } catch (e2) {
        // (FINDINGS-AM 8: one bad file doesn't stop the run)
        console.log(`  ${r.id}: SKIPPED (${String(e2.message || e2).slice(0, 120)})`);
        skipped.push(r.id);
        await fresh();
      }
    }
    n++;
    if (n % 25 === 0 || n === todo.length)
      console.log(`  ${n} of ${todo.length} (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
    if (n % 100 === 0) await fresh(); // (a fresh page now and then: memory)
  }
} finally {
  await teardown();
}
console.log(`pp-prep: done${skipped.length ? `; ${skipped.length} skipped: ${skipped.join(', ')}` : ''}`);
