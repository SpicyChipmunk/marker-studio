#!/usr/bin/env node
// The guide benchmark, step 5: the side-by-side comparison page (scripts/bench/README.md).
//
//   node scripts/bench/ab.mjs [--out DIR]   reads DIR/ab/session1-gradient-rough.json (colour.mjs), renders both guides
//                                           of every pair on the page's true sections, and writes DIR/ab/session1.html,
//                                           a page to publish as an artifact (answers kept in its own store)
//
// Blind: left and right are drawn at random per pair, the settings and the measure are not on the page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNE, HELD } from './pages.mjs';
import { products } from './lib/build.mjs';
import { jpegBytes, close as closeBrowser } from './lib/browser.mjs';
import { seeded } from './lib/colour.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2),
  arg = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : d;
  };
const OUT = path.resolve(
  arg('--out', process.env.BENCH_OUT || path.join(os.tmpdir(), 'marker-studio-bench')),
);
if (OUT.startsWith(ROOT + path.sep)) {
  console.error('--out must be outside the repo');
  process.exit(2);
}
const src = JSON.parse(fs.readFileSync(path.join(OUT, 'ab', 'session1-gradient-rough.json'), 'utf8'));
const SIDE = 560; // width of each picture

// a guide as the app shows it: each section in its marker's colour, the page's own lines over it
function render(page, assign, hex) {
  const m = page.meta,
    W = m.W,
    H = m.H,
    w = SIDE,
    h = Math.round((SIDE * H) / W),
    out = new Uint8ClampedArray(w * h * 4);
  const col = new Map();
  for (const [l, k] of Object.entries(assign)) {
    const x = hex[k];
    if (x)
      col.set(+l, [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]);
  }
  const kx = W / w,
    ky = H / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let yy = Math.floor(y * ky); yy < Math.min(H, Math.ceil((y + 1) * ky)); yy++)
        for (let xx = Math.floor(x * kx); xx < Math.min(W, Math.ceil((x + 1) * kx)); xx++) {
          const p = yy * W + xx,
            l = page.truth[p],
            c = l > 0 && col.get(l),
            gr = (m.rgb ? page.input[p * 3] : page.input[p]) / 255;
          r += (c ? c[0] : 255) * gr;
          g += (c ? c[1] : 255) * gr;
          b += (c ? c[2] : 255) * gr;
          n++;
        }
      const j = (y * w + x) * 4;
      out[j] = r / n;
      out[j + 1] = g / n;
      out[j + 2] = b / n;
      out[j + 3] = 255;
    }
  return { w, h, d: out };
}

const pairs = [];
for (const p of src.pairs) {
  const spec = [...TUNE, ...HELD].find((s) => s.id === p.page);
  const page = (await products(spec, [1200], path.join(OUT, 'cache'), console.log))[1200];
  const img = async (side) => {
    const r = render(page, side.assign, side.hex);
    return 'data:image/jpeg;base64,' + (await jpegBytes(r.w, r.h, r.d, 0.82)).toString('base64');
  };
  const left = seeded(1000 + p.n, () => (Math.random() < 0.5 ? 'a' : 'b'));
  pairs.push({
    n: p.n,
    left,
    a: await img(p.a),
    b: await img(p.b),
    ratio: +(page.meta.H / page.meta.W).toFixed(4),
  });
  console.log(`pair ${p.n}: ${p.page} on ${p.coll} (${p.differs})`);
}
await closeBrowser();
const tpl = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ab-page.html'), 'utf8');
const html = tpl.replace('/*PAIRS*/[]', JSON.stringify(pairs));
fs.writeFileSync(path.join(OUT, 'ab', 'session1.html'), html);
console.log(`wrote ${path.join(OUT, 'ab', 'session1.html')} (${(html.length / 1e6).toFixed(1)} MB)`);
